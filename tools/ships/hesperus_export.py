"""Game export of the lighthouse tender HESPERUS (1896).

    blender -b tools/ships/hesperus.blend -P tools/ships/hesperus_export.py -- --out public/models/hesperus

Writes, into --out:
    hesperus.bin    every level of detail, one little-endian buffer (all blocks 4-byte aligned)
    hesperus.json   the manifest: axes, levels of detail, finishes (materials) with the byte ranges of
                    their attributes, the ship's lights, the waterline and midships point; and under
                    "interior" the rooms, as one more block in the same form, kept out of the "full" level
    <texture>.png   image textures used by a finish (the ensign), copied beside the manifest

Model axes (Blender): metres, +X forward, +Y port, +Z up, origin at frame 0 on the keel.
Engine axes (house convention: metres, Y up, +Z is the way a thing faces, right-handed):
    engine = ( modelY, modelZ - 3.0, modelX - 25.2 )
that is +X port, +Y up, +Z forward, with the origin amidships on the load waterline.  The mapping is a
rotation (no mirroring), so triangle winding is unchanged: counter-clockwise from outside.

Per level of detail every renderable MESH object of the collection is evaluated (modifiers applied),
moved to world space and triangulated; the triangles are grouped by material name (the "finish") and
vertices with the same position, normal and uv are welded.  Positions are float32, normals int8
(divide by 127), uvs float32 (Blender convention, v up) and only written for finishes whose material
uses an image texture (--all-uvs writes them wherever a mesh has a UV map), indices uint16 where a
finish has fewer than 65536 vertices, else uint32.
"""

import argparse
import json
import os
import shutil
import sys

import bpy
import numpy as np

FORMAT_VERSION = 1
MODEL_ORIGIN = (25.2, 0.0, 3.0)          # midships on the load waterline, in model axes
WATERLINE_Z = 3.0
# key, collection (and scene) name, nearest and farthest suggested viewing distance in metres
LODS = (
    ("full", "Hesperus", 0.0, 600.0),
    ("lod1", "Hesperus_LOD1", 600.0, 4000.0),
    ("lod2", "Hesperus_LOD2", 4000.0, None),
)
# The rooms (tools/ships/hesperus_interiors.py) are a child collection of the full model.  They are left out of the
# "full" level and written as a block of their own, manifest key "interior", to load only when she is boarded.
INTERIOR = ("interior", "Hesperus_interior")


def to_engine(p):
    """Model-space points (N, 3) -> engine axes with the origin amidships on the waterline."""
    out = np.empty_like(p)
    out[:, 0] = p[:, 1] - MODEL_ORIGIN[1]
    out[:, 1] = p[:, 2] - MODEL_ORIGIN[2]
    out[:, 2] = p[:, 0] - MODEL_ORIGIN[0]
    return out


def dir_to_engine(n):
    out = np.empty_like(n)
    out[:, 0], out[:, 1], out[:, 2] = n[:, 1], n[:, 2], n[:, 0]
    return out


def plain(value):
    """Custom-property value -> JSON-ready python value."""
    if hasattr(value, "to_list"):
        return plain(value.to_list())
    if hasattr(value, "to_dict"):
        return plain(value.to_dict())
    if isinstance(value, dict):
        return {str(k): plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [plain(v) for v in value]
    if isinstance(value, float):
        return round(value, 6)
    if isinstance(value, (int, bool, str)) or value is None:
        return value
    try:
        return [plain(v) for v in value]
    except TypeError:
        return str(value)


def depsgraph_for(coll):
    """A dependency graph in which the collection's objects are evaluated."""
    scene = bpy.data.scenes.get(coll.name)
    if scene is None or coll not in scene.collection.children_recursive:
        scene = next((s for s in bpy.data.scenes if coll in s.collection.children_recursive), bpy.context.scene)
    vl = scene.view_layers[0]
    vl.update()
    return vl.depsgraph


def mesh_corners(ob, dg):
    """Triangle corners of one object in world (model) space: positions, normals, uvs or None, and the
    material name of every triangle."""
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    try:
        me.calc_loop_triangles()
        nt = len(me.loop_triangles)
        if nt == 0:
            return None
        co = np.empty(len(me.vertices) * 3, np.float32)
        me.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3).astype(np.float64)
        lv = np.empty(len(me.loops), np.int32)
        me.loops.foreach_get("vertex_index", lv)
        ln = np.empty(len(me.loops) * 3, np.float32)
        me.corner_normals.foreach_get("vector", ln)
        ln = ln.reshape(-1, 3).astype(np.float64)
        tl = np.empty(nt * 3, np.int32)
        me.loop_triangles.foreach_get("loops", tl)
        tm = np.empty(nt, np.int32)
        me.loop_triangles.foreach_get("material_index", tm)
        uv = None
        layer = me.uv_layers.active
        if layer is not None:
            raw = np.empty(len(me.loops) * 2, np.float32)
            try:
                layer.uv.foreach_get("vector", raw)
            except Exception:
                layer.data.foreach_get("uv", raw)
            uv = raw.reshape(-1, 2)[tl].astype(np.float64)
        mw = np.array(ob.matrix_world, dtype=np.float64)
        m3 = mw[:3, :3]
        pos = co[lv[tl]] @ m3.T + mw[:3, 3]
        nrm = ln[tl] @ np.linalg.inv(m3)                   # inverse transpose applied to row vectors
        nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-12)
        if np.linalg.det(m3) < 0.0:                        # mirrored object: restore the winding
            order = np.arange(nt * 3).reshape(-1, 3)[:, ::-1].ravel()
            pos, nrm = pos[order], nrm[order]
            if uv is not None:
                uv = uv[order]
        names = [s.material.name if s.material else "none" for s in ev.material_slots] or ["none"]
        tri_names = [names[min(int(i), len(names) - 1)] for i in tm]
        return pos, nrm, uv, tri_names
    finally:
        ev.to_mesh_clear()


def principled(name):
    """Base colour (linear RGB), roughness, metallic and image texture of a material."""
    info = {"color": [0.8, 0.8, 0.8], "roughness": 0.5, "metallic": 0.0, "image": None, "alpha": 1.0, "emission": 0.0}
    mat = bpy.data.materials.get(name)
    if mat is None:
        return info
    info["color"] = [round(float(c), 5) for c in mat.diffuse_color[:3]]
    info["roughness"] = round(float(mat.roughness), 4)
    info["metallic"] = round(float(mat.metallic), 4)
    if mat.node_tree is None:
        return info
    for node in mat.node_tree.nodes:
        if node.type == "BSDF_PRINCIPLED":
            info["color"] = [round(float(c), 5) for c in node.inputs["Base Color"].default_value[:3]]
            info["roughness"] = round(float(node.inputs["Roughness"].default_value), 4)
            info["metallic"] = round(float(node.inputs["Metallic"].default_value), 4)
            if "Alpha" in node.inputs and not node.inputs["Alpha"].is_linked:
                info["alpha"] = round(float(node.inputs["Alpha"].default_value), 4)
            if "Emission Strength" in node.inputs and not node.inputs["Emission Strength"].is_linked:
                info["emission"] = round(float(node.inputs["Emission Strength"].default_value), 4)
            break
    for node in mat.node_tree.nodes:
        if node.type == "TEX_IMAGE" and node.image is not None:
            info["image"] = node.image
            break
    return info


def weld(pos, nrm, uv):
    """Unique (position, normal, uv) vertices in order of first use, and the index of every corner."""
    n = len(pos)
    pos32 = (np.round(pos, 4) + 0.0).astype(np.float32)
    nrm8 = np.clip(np.round(nrm * 127.0), -127, 127).astype(np.int8)
    parts = [pos32.view(np.uint8).reshape(n, 12), nrm8.view(np.uint8).reshape(n, 3)]
    uv32 = None
    if uv is not None:
        uv32 = (np.round(uv, 5) + 0.0).astype(np.float32)
        parts.append(uv32.view(np.uint8).reshape(n, 8))
    key = np.ascontiguousarray(np.concatenate(parts, axis=1))
    void = key.view(np.dtype((np.void, key.shape[1]))).ravel()
    _, first, inverse = np.unique(void, return_index=True, return_inverse=True)
    order = np.argsort(first, kind="stable")
    rank = np.empty(len(order), np.int64)
    rank[order] = np.arange(len(order))
    keep = first[order]
    return pos32[keep], nrm8[keep], (uv32[keep] if uv32 is not None else None), rank[inverse.ravel()]


def collect_lod(coll, all_uvs, skip=()):
    """{finish: (positions, normals, uvs or None, indices)} in engine axes, and the object count."""
    dg = depsgraph_for(coll)
    groups = {}
    count = 0
    for ob in sorted(coll.all_objects, key=lambda o: o.name):
        if ob.type != "MESH" or ob.hide_render or ob in skip:
            continue
        got = mesh_corners(ob, dg)
        if got is None:
            continue
        count += 1
        pos, nrm, uv, tri_names = got
        tri_names = np.array(tri_names)
        for name in sorted(set(tri_names)):
            sel = np.repeat(tri_names == name, 3)
            g = groups.setdefault(name, {"pos": [], "nrm": [], "uv": [], "has_uv": False})
            g["pos"].append(pos[sel])
            g["nrm"].append(nrm[sel])
            g["uv"].append(uv[sel] if uv is not None else np.zeros((int(sel.sum()), 2)))
            g["has_uv"] = g["has_uv"] or uv is not None
    out = {}
    for name in sorted(groups):
        g = groups[name]
        info = principled(name)
        use_uv = g["has_uv"] and (all_uvs or info["image"] is not None)
        pos = to_engine(np.concatenate(g["pos"]))
        nrm = dir_to_engine(np.concatenate(g["nrm"]))
        uv = np.concatenate(g["uv"]) if use_uv else None
        out[name] = weld(pos, nrm, uv) + (info,)
    return out, count


def collect_lights(coll):
    lights = []
    for ob in sorted(coll.all_objects, key=lambda o: o.name):
        if ob.type != "EMPTY" or "light_" not in ob.name:
            continue
        p = to_engine(np.array([ob.matrix_world.translation[:]], dtype=np.float64))[0]
        entry = {"name": ob.name.split("light_", 1)[1], "object": ob.name, "position": [round(float(v), 4) for v in p]}
        for key in ("light", "colour", "arc_deg", "bearing_deg", "range_nm", "shown", "note"):
            if key in ob.keys():
                entry[key] = plain(ob[key])
        for key in ob.keys():
            if key not in entry and not key.startswith("_"):
                entry[key] = plain(ob[key])
        lights.append(entry)
    return lights


def export(out_dir, all_uvs=False):
    os.makedirs(out_dir, exist_ok=True)
    blob = bytearray()
    textures = {}

    def put(arr):
        while len(blob) % 4:
            blob.append(0)
        offset = len(blob)
        blob.extend(arr.tobytes())
        return offset, arr.nbytes

    lods, lights, interior = [], None, None
    inner = bpy.data.collections.get(INTERIOR[1])
    inner_objects = set(inner.all_objects) if inner else set()
    for key, coll_name, near, far in LODS + ((INTERIOR[0], INTERIOR[1], 0.0, None),):
        coll = bpy.data.collections.get(coll_name)
        if coll is None:
            print("hesperus_export: no collection %r in this file, level %r skipped" % (coll_name, key))
            continue
        finishes, objects = collect_lod(coll, all_uvs, skip=() if coll is inner else inner_objects)
        if coll is not inner and (lights is None or not lights):
            lights = collect_lights(coll)
        start = len(blob)
        entries, lo, hi, tris, verts = [], None, None, 0, 0
        for name, (pos, nrm, uv, idx, info) in finishes.items():
            itype = "uint16" if len(pos) < 65536 else "uint32"
            e = {"name": name, "color": info["color"], "roughness": info["roughness"], "metallic": info["metallic"],
                 "vertexCount": int(len(pos)), "indexCount": int(len(idx)), "indexType": itype}
            if info["alpha"] < 1.0:
                e["alpha"] = info["alpha"]          # glass: draw blended and two-sided
            if info["emission"] > 0.0:
                e["emission"] = info["emission"]    # lit lamps, and the sky seen through scuttles and skylights
            if info["image"] is not None:
                img = info["image"]
                fname = os.path.basename(bpy.path.abspath(img.filepath)) or (img.name + ".png")
                textures[fname] = img
                e["texture"] = fname
            o, n = put(pos.astype("<f4"))
            e["position"] = {"byteOffset": o, "byteLength": n, "type": "float32", "size": 3}
            o, n = put(nrm.astype(np.int8))
            e["normal"] = {"byteOffset": o, "byteLength": n, "type": "int8", "size": 3, "normalized": True}
            if uv is not None:
                o, n = put(uv.astype("<f4"))
                e["uv"] = {"byteOffset": o, "byteLength": n, "type": "float32", "size": 2}
            o, n = put(idx.astype("<u2" if itype == "uint16" else "<u4"))
            e["index"] = {"byteOffset": o, "byteLength": n, "type": itype}
            entries.append(e)
            lo = pos.min(axis=0) if lo is None else np.minimum(lo, pos.min(axis=0))
            hi = pos.max(axis=0) if hi is None else np.maximum(hi, pos.max(axis=0))
            tris += len(idx) // 3
            verts += len(pos)
        while len(blob) % 4:
            blob.append(0)
        level = {
            "name": key, "collection": coll_name, "objects": objects,
            "range": {"min": near, "max": far},
            "triangles": int(tris), "vertices": int(verts),
            "byteOffset": start, "byteLength": len(blob) - start,
            "bounds": {"min": [round(float(v), 4) for v in lo], "max": [round(float(v), 4) for v in hi]} if lo is not None else None,
            "finishes": entries,
        }
        if coll is inner:
            del level["range"]
            interior = level
        else:
            lods.append(level)

    copied = []
    for fname, img in textures.items():
        src = bpy.path.abspath(img.filepath)
        dst = os.path.join(out_dir, fname)
        if os.path.isfile(src):
            shutil.copyfile(src, dst)
        else:
            img.save(filepath=dst)
        copied.append(fname)

    manifest = {
        "format": "hesperus-model",
        "version": FORMAT_VERSION,
        "generator": "tools/ships/hesperus_export.py",
        "source": os.path.basename(bpy.data.filepath),
        "units": "metres",
        "axes": {
            "engine": "+X port, +Y up, +Z forward (bow); right-handed; triangles counter-clockwise from outside",
            "model": "+X forward, +Y port, +Z up; origin at frame 0 on the keel",
            "mapping": "engine = ( modelY, modelZ - %g, modelX - %g )" % (MODEL_ORIGIN[2], MODEL_ORIGIN[0]),
            "origin": "midships on the load waterline",
            "modelOrigin": list(MODEL_ORIGIN),
        },
        "waterlineY": 0.0,
        "modelWaterlineZ": WATERLINE_Z,
        "keelY": -WATERLINE_Z,
        "midships": [0.0, 0.0, 0.0],
        "bin": "hesperus.bin",
        "byteLength": len(blob),
        "littleEndian": True,
        "encoding": {
            "position": "float32 x 3, metres, engine axes",
            "normal": "int8 x 3, divide by 127",
            "uv": "float32 x 2, v up (Blender / OpenGL); only on finishes with a texture",
            "index": "uint16 or uint32 (see indexType), triangle list, relative to the finish's own vertices",
            "color": "linear RGB of the Principled base colour",
            "alignment": "every block starts on a 4-byte boundary",
        },
        "textures": copied,
        "lods": lods,
        "interior": interior,
        "lights": lights or [],
    }
    with open(os.path.join(out_dir, "hesperus.bin"), "wb") as f:
        f.write(bytes(blob))
    with open(os.path.join(out_dir, "hesperus.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(manifest, f, indent="\t", ensure_ascii=False)
        f.write("\n")
    return manifest


def verify(out_dir):
    """Reads the files back and checks every range, count and bound.  Returns True when all is well."""
    with open(os.path.join(out_dir, "hesperus.json"), encoding="utf-8") as f:
        man = json.load(f)
    data = np.fromfile(os.path.join(out_dir, man["bin"]), dtype=np.uint8)
    ok = len(data) == man["byteLength"]
    print("hesperus_export: verify: bin %d bytes (manifest %d), json %d bytes"
          % (len(data), man["byteLength"], os.path.getsize(os.path.join(out_dir, "hesperus.json"))))

    def view(block, dtype, size=1):
        a = data[block["byteOffset"]:block["byteOffset"] + block["byteLength"]].view(dtype)
        return a.reshape(-1, size) if size > 1 else a

    for lod in man["lods"] + ([man["interior"]] if man.get("interior") else []):
        lo, hi, tris = None, None, 0
        top = bow = None
        for fin in lod["finishes"]:
            pos = view(fin["position"], "<f4", 3)
            nrm = view(fin["normal"], np.int8, 3)
            idx = view(fin["index"], "<u2" if fin["indexType"] == "uint16" else "<u4")
            good = (len(pos) == fin["vertexCount"] and len(nrm) == fin["vertexCount"] and len(idx) == fin["indexCount"]
                    and len(idx) % 3 == 0 and int(idx.max()) < len(pos) and fin["position"]["byteOffset"] % 4 == 0
                    and fin["index"]["byteOffset"] % 4 == 0)
            if "uv" in fin:
                good = good and len(view(fin["uv"], "<f4", 2)) == fin["vertexCount"]
            ln = np.linalg.norm(nrm.astype(np.float64) / 127.0, axis=1)
            good = good and bool(np.all(np.abs(ln - 1.0) < 0.03))
            if not good:
                print("hesperus_export: verify: PROBLEM in %s / %s" % (lod["name"], fin["name"]))
            ok = ok and good
            lo = pos.min(axis=0) if lo is None else np.minimum(lo, pos.min(axis=0))
            hi = pos.max(axis=0) if hi is None else np.maximum(hi, pos.max(axis=0))
            tris += len(idx) // 3
            t = pos[int(pos[:, 1].argmax())]
            b = pos[int(pos[:, 2].argmax())]
            top = t if top is None or t[1] > top[1] else top
            bow = b if bow is None or b[2] > bow[2] else bow
        same = (tris == lod["triangles"] and np.allclose(lo, lod["bounds"]["min"], atol=2e-4)
                and np.allclose(hi, lod["bounds"]["max"], atol=2e-4))
        ok = ok and same
        print("hesperus_export: verify: %-4s %6d tris %6d verts %8d bytes  bounds %s .. %s  highest %s  foremost %s  %s"
              % (lod["name"], tris, lod["vertices"], lod["byteLength"], np.round(lo, 2).tolist(), np.round(hi, 2).tolist(),
                 np.round(top, 2).tolist(), np.round(bow, 2).tolist(), "ok" if same else "MISMATCH"))
    print("hesperus_export: verify: %d lights, textures %s: %s" % (len(man["lights"]), man["textures"], "ALL OK" if ok else "FAILED"))
    return ok


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser(prog="hesperus_export")
    ap.add_argument("--out", required=True, help="output directory, e.g. public/models/hesperus")
    ap.add_argument("--all-uvs", action="store_true", help="write uvs for every finish whose meshes have a UV map")
    args = ap.parse_args(argv)
    out_dir = os.path.abspath(args.out)
    man = export(out_dir, all_uvs=args.all_uvs)
    for lod in man["lods"] + ([man["interior"]] if man.get("interior") else []):
        print("hesperus_export: %-4s %6d triangles, %6d vertices, %2d finishes, %8d bytes"
              % (lod["name"], lod["triangles"], lod["vertices"], len(lod["finishes"]), lod["byteLength"]))
    if not verify(out_dir):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
