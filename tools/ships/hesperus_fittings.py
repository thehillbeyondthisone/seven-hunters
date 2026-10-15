"""Deck fittings for the lighthouse tender HESPERUS (Gourlay Brothers, Dundee, 1896).

A library of procedural, low-polygon period fittings.  Pure bpy / bmesh / mathutils, no side
effects at import.

Conventions
-----------
* Metres.  Ship axes: +X forward, +Y port, +Z up.
* Every builder returns ONE mesh object named by ``name``: scale 1, no modifiers, not linked to
  any collection (the caller links and places it).  The mesh origin is given in each docstring.
* Curved surfaces are smooth shaded, hard edges are marked sharp (Blender 4.1+ sharp_edge
  attribute, the replacement for auto smooth).  Normals point outward.
* Materials are assigned by name through ``get_mat``; the caller's materials are used when they
  exist, otherwise a plain Principled placeholder is made.  Names used: white, buff, teak,
  deck_pine, brass, glass, canvas, iron, rope, red_port, green_stbd, vent_red, hull_black,
  galvanised.

Contact sheets / triangle tables (the twenty main fittings, then the close-up hardware):

    blender -b --factory-startup -P tools/ships/hesperus_fittings.py -- [out.png]
    blender -b --factory-startup -P tools/ships/hesperus_fittings.py -- --batch2 [out.png]
"""
import math
import os
import sys
from contextlib import contextmanager

import bpy
import bmesh
from mathutils import Matrix, Vector

TAU = math.tau
PI = math.pi

__all__ = [
    'get_mat', 'tri_count', 'inspect', 'FITTINGS', 'BUDGETS', 'demo',
    'ships_boat', 'radial_davit', 'cowl_vent', 'stockless_anchor', 'windlass', 'bitts', 'binnacle',
    'searchlight', 'skylight', 'companion', 'cargo_hatch', 'life_ring', 'side_light',
    'masthead_lantern', 'steam_whistle', 'engine_telegraph', 'propeller', 'accommodation_ladder',
    'ship_wheel', 'ventilator_mushroom',
    'DEMO_SET', 'DEMO_SET_2', 'ships_bell', 'rigging_block', 'rigging_screw', 'deck_cleat', 'mooring_chock',
    'awning_stanchion', 'coal_scuttle', 'rope_coil', 'oar', 'stove_pipe', 'chain_cable', 'hawse_bolster',
    'davit_fall', 'boat_chock', 'anchor_lantern', 'swan_neck_vent', 'oil_cask', 'stores_box', 'coal_sack',
    'mail_bag',
]

# ------------------------------------------------------------------------------------- materials

# name: (base colour, roughness, metallic) -- placeholders only, the ship script owns the real ones
_PALETTE = {
    'white': ((0.80, 0.80, 0.76), 0.50, 0.0),
    'buff': ((0.62, 0.40, 0.14), 0.50, 0.0),
    'mast_brown': ((0.30, 0.16, 0.07), 0.50, 0.0),
    'teak': ((0.30, 0.15, 0.06), 0.35, 0.0),
    'deck_pine': ((0.58, 0.44, 0.27), 0.70, 0.0),
    'brass': ((0.78, 0.57, 0.20), 0.30, 1.0),
    'glass': ((0.02, 0.03, 0.04), 0.06, 0.0),
    'canvas': ((0.72, 0.69, 0.60), 0.90, 0.0),
    'iron': ((0.02, 0.02, 0.022), 0.60, 0.0),
    'rope': ((0.30, 0.23, 0.14), 0.90, 0.0),
    'red_port': ((0.60, 0.02, 0.02), 0.50, 0.0),
    'green_stbd': ((0.02, 0.33, 0.12), 0.50, 0.0),
    'vent_red': ((0.50, 0.05, 0.03), 0.60, 0.0),
    'hull_black': ((0.015, 0.015, 0.017), 0.60, 0.0),
    'galvanised': ((0.50, 0.52, 0.54), 0.50, 0.6),
}


def get_mat(name):
    """Return bpy.data.materials[name]; make a simple Principled placeholder if it is missing."""
    mat = bpy.data.materials.get(name)
    if mat is not None:
        return mat
    col, rough, metal = _PALETTE.get(name, ((0.8, 0.0, 0.8), 0.5, 0.0))
    mat = bpy.data.materials.new(name)
    if mat.node_tree is None:           # Blender < 5: node tree is opt-in
        mat.use_nodes = True
    bsdf = next((n for n in mat.node_tree.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled'), None)
    if bsdf is not None:
        bsdf.inputs['Base Color'].default_value = (*col, 1.0)
        bsdf.inputs['Roughness'].default_value = rough
        bsdf.inputs['Metallic'].default_value = metal
    mat.diffuse_color = (*col, 1.0)
    mat.roughness = rough
    mat.metallic = metal
    return mat


# ------------------------------------------------------------------------------------ mesh helpers

def _T(x=0.0, y=0.0, z=0.0):
    return Matrix.Translation((x, y, z))


def _R(axis, deg):
    return Matrix.Rotation(math.radians(deg), 4, axis)


_MIRROR_Y = Matrix.Diagonal((1.0, -1.0, 1.0, 1.0))
_MIRROR_X = Matrix.Diagonal((-1.0, 1.0, 1.0, 1.0))

# lathe axis -> (radial cos, radial sin, height) to xyz; all are proper rotations
_AXES = {
    'Z': lambda a, c, h: (a, c, h),      # angle 0 = +X, 90 = +Y
    'X': lambda a, c, h: (h, a, c),      # angle 0 = +Y, 90 = +Z
    'Y': lambda a, c, h: (c, h, a),      # angle 0 = +Z, 90 = +X
}

# prism plane -> ((u, v, depth) to xyz, mapping is orientation preserving)
_PLANES = {
    'XY': (lambda u, w, d: (u, w, d), True),
    'YZ': (lambda u, w, d: (d, u, w), True),
    'ZX': (lambda u, w, d: (w, d, u), True),
    'XZ': (lambda u, w, d: (u, d, w), False),
}


def _bend(a, c):
    d = abs(a - c) % TAU
    return math.degrees(min(d, TAU - d))


def _resample(poly, fracs):
    """Points at the given fractions (ascending, 0..1) of the length of a 2D polyline."""
    cum = [0.0]
    for p, q in zip(poly, poly[1:]):
        cum.append(cum[-1] + math.hypot(q[0] - p[0], q[1] - p[1]))
    out, i = [], 0
    for f in fracs:
        s = f * cum[-1]
        while i < len(poly) - 2 and cum[i + 1] < s:
            i += 1
        seg = cum[i + 1] - cum[i]
        u = 0.0 if seg <= 1e-12 else min(max((s - cum[i]) / seg, 0.0), 1.0)
        out.append((poly[i][0] + (poly[i + 1][0] - poly[i][0]) * u,
                    poly[i][1] + (poly[i + 1][1] - poly[i][1]) * u))
    return out


class _Builder:
    """Thin bmesh wrapper: material slots by name, smoothing groups, a transform stack.

    Every face carries a smoothing-group id; at finish() an edge is marked sharp exactly when
    its two faces are in different groups, so low-count cylinders stay round while profile
    corners stay crisp.  Faces built under a mirroring transform are re-wound automatically.
    """

    def __init__(self):
        self.bm = bmesh.new()
        self._lay = self.bm.faces.layers.int.new('_sg')
        self._mats = []
        self._sg = 0
        self.M = Matrix.Identity(4)
        self._neg = False

    # -- state ------------------------------------------------------------------------------
    @contextmanager
    def at(self, m):
        saved = (self.M, self._neg)
        self.M = self.M @ m
        self._neg = self.M.determinant() < 0.0
        try:
            yield self
        finally:
            self.M, self._neg = saved

    def group(self):
        self._sg += 1
        return self._sg

    def _mi(self, name):
        if name not in self._mats:
            self._mats.append(name)
        return self._mats.index(name)

    # -- primitives -------------------------------------------------------------------------
    def v(self, co):
        return self.bm.verts.new(self.M @ Vector(co))

    def face(self, verts, mat, sg=None, flip=False):
        vs = []
        for x in verts:
            if not vs or vs[-1] is not x:
                vs.append(x)
        if len(vs) > 1 and vs[0] is vs[-1]:
            vs.pop()
        if len(vs) < 3 or len(set(vs)) < len(vs):
            return None
        if self._neg != bool(flip):
            vs.reverse()
        try:
            f = self.bm.faces.new(vs)
        except ValueError:
            return None
        f.material_index = self._mi(mat)
        f.smooth = True
        f[self._lay] = self.group() if sg is None else sg
        return f

    def _orient(self, faces, ref):
        """Flip ``faces`` as a set so that they face away from ``ref`` ('auto' = their centroid)."""
        faces = [f for f in faces if f is not None]
        if not faces:
            return
        if isinstance(ref, str):
            vs = {v for f in faces for v in f.verts}
            c = sum((v.co for v in vs), Vector()) / len(vs)
        else:
            c = self.M @ Vector(ref)
        s = 0.0
        for f in faces:
            f.normal_update()
            s += f.calc_area() * f.normal.dot(f.calc_center_median() - c)
        if s < 0.0:
            bmesh.ops.reverse_faces(self.bm, faces=faces)

    def weld(self, verts, dist=1e-5):
        bmesh.ops.remove_doubles(self.bm, verts=[v for v in verts if v.is_valid], dist=dist)

    # -- solids of revolution ---------------------------------------------------------------
    def lathe(self, prof, n, mat, axis='Z', cap0=False, cap1=False, crease=35.0, phase=0.0,
              arc=None, loop=False):
        """Revolve the profile [(radius, height), ...] about ``axis``.

        Trace the profile so the outside is on the right of travel: out along the bottom, up
        the outside, in along the top (an inner wall is traced downward).  A radius of 0 at an
        end makes a pole.  ``mat`` is a name, a per-segment list, or f(segment, column).
        ``cap0`` / ``cap1`` close the first / last ring with an n-gon (True or a material name).
        ``arc=(a0, a1)`` in degrees gives an open sector, ``loop`` closes the profile on itself.
        Profile corners sharper than ``crease`` degrees become hard edges.
        """
        put = _AXES[axis]
        if arc is None:
            cols, wrap = n, True
            angs = [math.radians(phase) + TAU * j / n for j in range(n)]
        else:
            cols, wrap = n + 1, False
            a0, a1 = math.radians(arc[0]), math.radians(arc[1])
            angs = [a0 + (a1 - a0) * j / n for j in range(n + 1)]
        rings = []
        for r, h in prof:
            if r <= 1e-9 and wrap:
                p = self.v(put(0.0, 0.0, h))
                rings.append([p] * cols)
            else:
                rings.append([self.v(put(r * math.cos(a), r * math.sin(a), h)) for a in angs])
        pts = list(prof)
        if loop:
            rings.append(rings[0])
            pts.append(pts[0])
        nseg = len(rings) - 1
        dirs = [math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]) for i in range(nseg)]
        groups = [self.group()]
        for i in range(1, nseg):
            groups.append(groups[-1] if _bend(dirs[i], dirs[i - 1]) <= crease else self.group())
        if loop and nseg > 1 and _bend(dirs[0], dirs[-1]) <= crease:
            first, last = groups[0], groups[-1]
            groups = [first if g == last else g for g in groups]
        for i in range(nseg):
            for j in range(n):
                j2 = (j + 1) % cols if wrap else j + 1
                if callable(mat):
                    m = mat(i, j)
                elif isinstance(mat, (list, tuple)):
                    m = mat[i]
                else:
                    m = mat
                self.face([rings[i][j], rings[i][j2], rings[i + 1][j2], rings[i + 1][j]], m, groups[i])

        def cap_mat(c, seg):
            if isinstance(c, str):
                return c
            if callable(mat):
                return mat(seg, 0)
            return mat[seg] if isinstance(mat, (list, tuple)) else mat

        if cap0 and wrap:
            self.face(rings[0][::-1], cap_mat(cap0, 0))
        if cap1 and wrap:
            self.face(list(rings[-1]), cap_mat(cap1, nseg - 1))
        return rings

    def sphere(self, centre, r, mat, n=8, stacks=4):
        prof = [(r * math.sin(PI * i / stacks), -r * math.cos(PI * i / stacks)) for i in range(stacks + 1)]
        prof[0], prof[-1] = (0.0, -r), (0.0, r)
        with self.at(_T(*centre)):
            self.lathe(prof, n, mat, crease=180.0)

    # -- sweeps -----------------------------------------------------------------------------
    def tube(self, path, radius, n, mat, cap0=False, cap1=False, up=None, phase=0.0):
        """Round bar along a polyline; ``radius`` is a number or one value per path point."""
        pts = [Vector(p) for p in path]
        m = len(pts)
        rad = list(radius) if isinstance(radius, (list, tuple)) else [radius] * m
        tang = [(pts[min(i + 1, m - 1)] - pts[max(i - 1, 0)]).normalized() for i in range(m)]
        t0 = tang[0]
        ref = Vector(up) if up is not None else (Vector((0, 0, 1)) if abs(t0.z) < 0.9 else Vector((1, 0, 0)))
        nrm = (ref - t0 * ref.dot(t0)).normalized()
        rings = []
        for i in range(m):
            t = tang[i]
            nrm = (nrm - t * nrm.dot(t)).normalized()
            bn = t.cross(nrm)
            rings.append([self.v(pts[i] + (nrm * math.cos(a) + bn * math.sin(a)) * rad[i])
                          for a in (math.radians(phase) + TAU * j / n for j in range(n))])
        g = self.group()
        for i in range(m - 1):
            for j in range(n):
                j2 = (j + 1) % n
                self.face([rings[i][j], rings[i][j2], rings[i + 1][j2], rings[i + 1][j]], mat, g)
        if cap0:
            self.face(rings[0][::-1], mat)
        if cap1:
            self.face(list(rings[-1]), mat)
        return rings

    def loft(self, rings, mat, closed=True, cap0=False, cap1=False, sg=None, flip=False,
             orient=None, skip=()):
        """Skin consecutive rings (lists of points or existing verts, equal counts).

        Outward when each ring runs counter-clockwise seen from ahead of the direction of
        travel; ``flip`` reverses, ``orient`` ('auto' or an interior point) decides for you.
        ``sg``: None = one smooth surface, 'flat' = faceted, or f(ring, segment) -> group key.
        ``mat``: name or f(ring, segment).  ``skip``: section segments to leave open.
        """
        bmv = bmesh.types.BMVert
        R = [[p if isinstance(p, bmv) else self.v(p) for p in ring] for ring in rings]
        K = len(R[0])
        nk = K if closed else K - 1
        g0, gmap, made = self.group(), {}, []
        for i in range(len(R) - 1):
            for k in range(nk):
                if k in skip:
                    continue
                k2 = (k + 1) % K
                if sg is None:
                    g = g0
                elif sg == 'flat':
                    g = None
                else:
                    key = sg(i, k)
                    if key is None:
                        g = None
                    else:
                        g = gmap.get(key)
                        if g is None:
                            g = gmap[key] = self.group()
                m = mat(i, k) if callable(mat) else mat
                made.append(self.face([R[i][k], R[i][k2], R[i + 1][k2], R[i + 1][k]], m, g, flip=flip))

        def cap_mat(c, i):
            if isinstance(c, str):
                return c
            return mat(i, 0) if callable(mat) else mat

        if cap0:
            made.append(self.face(R[0][::-1], cap_mat(cap0, 0), None, flip=flip))
        if cap1:
            made.append(self.face(list(R[-1]), cap_mat(cap1, len(R) - 2), None, flip=flip))
        if orient is not None:
            self._orient(made, orient)
        return R

    def ring_loop(self, pts, rad, n, mat, normal, sg='flat'):
        """Closed bar of ``n`` sides through the corner points of a planar loop (mitred)."""
        pts = [Vector(p) for p in pts]
        P = Vector(normal).normalized()
        m = len(pts)
        R = []
        for i in range(m):
            d0 = (pts[i] - pts[i - 1]).normalized()
            d1 = (pts[(i + 1) % m] - pts[i]).normalized()
            t = d0 + d1
            t = t.normalized() if t.length > 1e-9 else d1
            D = t.cross(P).normalized()
            s = 1.0 / max(0.35, t.dot(d1))
            R.append([self.v(pts[i] + D * (rad * s * math.cos(TAU * j / n)) + P * (rad * math.sin(TAU * j / n)))
                      for j in range(n)])
        self.loft(R + [R[0]], mat, closed=True, sg=sg, orient='auto')

    # -- flat-sided solids ------------------------------------------------------------------
    def hexa(self, corners, mat, skip='', fm=None):
        """Six-sided block from 8 corners: bottom ring counter-clockwise seen from above, then
        the top ring.  ``skip`` names faces to omit ('-z +x' ...), ``fm`` overrides materials."""
        v = [self.v(c) for c in corners]
        quads = {'-z': (0, 3, 2, 1), '+z': (4, 5, 6, 7), '-y': (0, 1, 5, 4),
                 '+x': (1, 2, 6, 5), '+y': (2, 3, 7, 6), '-x': (3, 0, 4, 7)}
        for key, idx in quads.items():
            if key in skip:
                continue
            self.face([v[i] for i in idx], (fm or {}).get(key, mat))
        return v

    def box(self, lo, hi, mat, skip='', fm=None):
        (x0, y0, z0), (x1, y1, z1) = lo, hi
        return self.hexa([(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
                          (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], mat, skip, fm)

    def frustum(self, c0, s0, c1, s1, mat, skip='', fm=None):
        """Tapered block: rectangle (centre c0, half-sizes s0) up to rectangle (c1, s1)."""
        (x0, y0, z0), (a0, b0) = c0, s0
        (x1, y1, z1), (a1, b1) = c1, s1
        return self.hexa([(x0 - a0, y0 - b0, z0), (x0 + a0, y0 - b0, z0), (x0 + a0, y0 + b0, z0), (x0 - a0, y0 + b0, z0),
                          (x1 - a1, y1 - b1, z1), (x1 + a1, y1 - b1, z1), (x1 + a1, y1 + b1, z1), (x1 - a1, y1 + b1, z1)],
                         mat, skip, fm)

    def prism(self, poly, d0, d1, mat, plane='XZ', cap0=True, cap1=True, crease=35.0):
        """Extrude a 2D outline (either winding) drawn in ``plane`` along the third axis."""
        put, even = _PLANES[plane]
        pts = list(poly)
        n = len(pts)
        area = sum(pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1] for i in range(n))
        if d1 < d0:
            d0, d1 = d1, d0
        if (area > 0.0) != even:
            pts.reverse()
        lo = [self.v(put(u, w, d0)) for u, w in pts]
        hi = [self.v(put(u, w, d1)) for u, w in pts]
        dirs = [math.atan2(pts[(i + 1) % n][1] - pts[i][1], pts[(i + 1) % n][0] - pts[i][0]) for i in range(n)]
        groups = [self.group()]
        for i in range(1, n):
            groups.append(groups[-1] if _bend(dirs[i], dirs[i - 1]) <= crease else self.group())
        if _bend(dirs[0], dirs[-1]) <= crease:
            first, last = groups[0], groups[-1]
            groups = [first if g == last else g for g in groups]
        for i in range(n):
            j = (i + 1) % n
            self.face([lo[i], lo[j], hi[j], hi[i]], mat, groups[i])
        if cap0:
            self.face(lo[::-1], mat)
        if cap1:
            self.face(hi, mat)

    # -- output -----------------------------------------------------------------------------
    def finish(self, name):
        bm, lay = self.bm, self._lay
        for e in bm.edges:
            lf = e.link_faces
            e.smooth = not (len(lf) == 2 and lf[0][lay] != lf[1][lay])
        bm.faces.layers.int.remove(lay)
        bm.normal_update()
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        for n in self._mats:
            me.materials.append(get_mat(n))
        me.update()
        return bpy.data.objects.new(name, me)


def tri_count(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def inspect(obj):
    """Mesh diagnostics: triangles, verts, open edges, edges with more than two faces,
    zero-area faces and closed shells whose normals point inward."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.normal_update()
    info = {
        'tris': sum(len(f.verts) - 2 for f in bm.faces),
        'verts': len(bm.verts),
        'open_edges': sum(1 for e in bm.edges if len(e.link_faces) == 1),
        'multi_edges': sum(1 for e in bm.edges if len(e.link_faces) > 2),
        'bad_winding': sum(1 for e in bm.edges if len(e.link_faces) == 2 and not e.is_contiguous),
        'zero_faces': sum(1 for f in bm.faces if f.calc_area() < 1e-9),
        'loose_verts': sum(1 for v in bm.verts if not v.link_faces),
        'inverted_shells': 0,
        'shells': 0,
    }
    seen = set()
    for f0 in bm.faces:
        if f0.index in seen:
            continue
        stack, shell = [f0], []
        seen.add(f0.index)
        while stack:
            f = stack.pop()
            shell.append(f)
            for e in f.edges:
                for g in e.link_faces:
                    if g.index not in seen:
                        seen.add(g.index)
                        stack.append(g)
        info['shells'] += 1
        if all(len(e.link_faces) == 2 for f in shell for e in f.edges):
            vol = 0.0
            for f in shell:
                vs = [v.co for v in f.verts]
                for i in range(1, len(vs) - 1):
                    vol += vs[0].dot(vs[i].cross(vs[i + 1])) / 6.0
            if vol < 0.0:
                info['inverted_shells'] += 1
    bm.free()
    return info


# =========================================================================================
#  1  ship's boat
# =========================================================================================

def ships_boat(name='ships_boat', length=7.35, beam=2.0, depth=0.8, transom=False, cover=False):
    """Open clinker-built ship's boat, double-ended (whaler form) or with a transom stern.

    Eight lapped strakes a side as real steps, keel with stem and stern posts, gunwale and
    rubbing strake, thwarts, stern and bow sheets, bottom boards.  ``cover`` replaces the open
    interior with a canvas cover laced over a ridge spar.
    Origin: underside of keel at mid-length.  Bow +X, depth is keel to gunwale amidships.
    """
    b = _Builder()
    L, B, D = float(length), float(beam), float(depth)
    k = D / 0.8                       # detail scale
    S = 8                             # strakes per side
    kh = 0.07 * k                     # keel below the garboard rabbet
    yk = 0.028 * k                    # half siding of keel, stem and stern post
    lap = 0.024 * k                   # plank land (slightly proud of scale so it reads)
    tk = 0.045 * k                    # planking + timbers
    Rf = 0.46 * D                     # forefoot radius
    rake = 0.10                       # stem rake above the forefoot
    zc = kh + Rf                      # top of the forefoot arc

    def sheer(t):
        if t >= 0.0:
            return D * (1.0 + 0.30 * t * t)
        return D * (1.0 + (0.16 if transom else 0.26) * t * t)

    xr = L / 2 - 0.075 * k - rake * (sheer(1.0) + 0.07 * k - zc)   # stem rabbet at the forefoot
    xa = L / 2                                                     # transom face

    if transom:
        ts = [-1.0, -0.8, -0.6, -0.4, -0.2, 0.0, 0.18, 0.36, 0.54, 0.70, 0.84, 0.94, 1.0]
    else:
        ts = [-1.0, -0.94, -0.84, -0.70, -0.54, -0.36, -0.18, 0.0, 0.18, 0.36, 0.54, 0.70, 0.84, 0.94, 1.0]
    nst = len(ts)

    def aft_tr(t):
        return transom and t < 0.0

    def x_of(t):
        return t * (xa if aft_tr(t) else xr)

    def t_of(x):
        return x / (xa if (transom and x < 0.0) else xr)

    def half_breadth(t):
        if aft_tr(t):
            return B / 2 * (1.0 - 0.40 * abs(t) ** 2.6)
        return max(yk, B / 2 * max(0.0, 1.0 - abs(t) ** 2.0) ** 0.75)

    def rabbet(t):
        if aft_tr(t):
            return kh + 0.30 * D * max(0.0, (abs(t) - 0.35) / 0.65) ** 1.8
        dx = abs(x_of(t)) - (xr - Rf)
        if dx <= 0.0:
            return kh
        dx = min(dx, Rf * 0.999)
        return zc - math.sqrt(Rf * Rf - dx * dx)

    def fullness(t):
        a = abs(t)
        if aft_tr(t):
            return 2.6 - 0.8 * a * a
        return 2.6 - 1.45 * a ** 1.6

    def section(t, npts=33):
        """Fair half section (y, z), keel to sheer."""
        hb, zs, zr, e = half_breadth(t), sheer(t), rabbet(t), 2.0 / fullness(t)
        out = []
        for i in range(npts):
            th = (i / (npts - 1)) * PI / 2
            fy = math.sin(th) ** e
            fz = 0.88 * (1.0 - math.cos(th) ** e) + 0.12 * fy      # 12 % deadrise
            out.append((yk + (hb - yk) * fy, zr + (zs - zr) * fz))
        return out

    def y_at(x, z):
        """Half breadth of the fair hull at fore-and-aft position x and height z."""
        sec = section(max(-1.0, min(1.0, t_of(x))))
        for (y0, z0), (y1, z1) in zip(sec, sec[1:]):
            if z0 <= z <= z1:
                return y0 + (y1 - y0) * (z - z0) / (z1 - z0) if z1 > z0 else y0
        return sec[-1][0] if z > sec[-1][1] else sec[0][0]

    def stem_pts(sign):
        """Hood ends of the strakes up the stem (or stern post) rabbet."""
        ztop = sheer(float(sign))
        a0 = math.radians(-42.0)
        arc = Rf * -a0
        slope = math.sqrt(1.0 + rake * rake)
        total = arc + (ztop - zc) * slope
        pts = []
        for j in range(S + 1):
            s = total * j / S
            if s < arc:
                a = a0 + s / Rf
                pts.append((sign * (xr - Rf + Rf * math.cos(a)), yk, zc + Rf * math.sin(a)))
            else:
                dz = (s - arc) / slope
                pts.append((sign * (xr + rake * dz), yk, zc + dz))
        return pts

    def is_stem(i):
        return abs(ts[i]) >= 1.0 and not aft_tr(ts[i])

    P = []                                                         # P[i][j]  station, strake edge
    for i, t in enumerate(ts):
        if is_stem(i):
            P.append(stem_pts(1 if t > 0 else -1))
        else:
            P.append([(x_of(t), y, z) for y, z in _resample(section(t), [j / S for j in range(S + 1)])])

    def sec_normal(i, j):
        """Outward unit normal of the section polyline in the station plane."""
        j0, j1 = max(j - 1, 0), min(j + 1, S)
        ty, tz = P[i][j1][1] - P[i][j0][1], P[i][j1][2] - P[i][j0][2]
        n = math.hypot(ty, tz) or 1.0
        return tz / n, -ty / n

    def plan_normal(i):
        """Outward unit normal of the sheer line in plan (port side)."""
        i0, i1 = max(i - 1, 0), min(i + 1, nst - 1)
        tx, ty = P[i1][S][0] - P[i0][S][0], P[i1][S][1] - P[i0][S][1]
        n = math.hypot(tx, ty) or 1.0
        return -ty / n, tx / n

    def fade(t):
        return max(0.0, min(1.0, (1.0 - abs(t)) / 0.10))

    # ---- shell plating, one side -------------------------------------------------------
    def plating():
        U = [[b.v(p) for p in P[i]] for i in range(nst)]
        Lw = []
        for i in range(nst):
            f = fade(ts[i]) * lap
            row = [U[i][0]]
            for j in range(1, S):
                if f <= 1e-6:
                    row.append(U[i][j])
                    continue
                ny, nz = sec_normal(i, j)
                x, y, z = P[i][j]
                row.append(b.v((x, y + ny * f, z + nz * f)))
            Lw.append(row)
        # each land shares the smoothing group of the strake above it: the strake's lower edge
        # then shades toward the down-facing land, so the laps read as dark lines from above too
        gs = [b.group() for _ in range(S)]
        for i in range(nst - 1):
            for s in range(S):
                b.face([Lw[i][s], U[i][s + 1], U[i + 1][s + 1], Lw[i + 1][s]], 'white', gs[s])
            for j in range(1, S):
                b.face([U[i][j], Lw[i][j], Lw[i + 1][j], U[i + 1][j]], 'white', gs[j])
        return U

    # ---- inner skin, one side ----------------------------------------------------------
    pick = [0, 3, 6, S]

    def inner_pts(i):
        t, pts = ts[i], []
        for j in pick:
            x, y, z = P[i][j]
            if is_stem(i):
                pts.append((x - math.copysign(1.4 * tk, t), 0.0, z + (tk if j == 0 else 0.0)))
            elif j == 0:
                pts.append((x, 0.0, z + tk))
            else:
                ny, nz = sec_normal(i, j)
                if j == S:
                    ny, nz = 1.0, 0.0
                pts.append((x, max(y - ny * tk, 0.0), z - nz * tk))
        if aft_tr(t) and abs(t) >= 1.0:
            pts = [(x + tk, y, z) for x, y, z in pts]
        return pts

    inner_verts = []

    def lining():
        Q = [[b.v(p) for p in inner_pts(i)] for i in range(nst)]
        g = b.group()
        for i in range(nst - 1):
            for m in range(len(pick) - 1):
                b.face([Q[i][m], Q[i + 1][m], Q[i + 1][m + 1], Q[i][m + 1]], 'white', g)
        for row in Q:
            inner_verts.extend(row)
        return Q

    # ---- gunwale and rubbing strake, one side -------------------------------------------
    wo, wi, ht, hg = 0.032 * k, 0.058 * k, 0.018 * k, 0.065 * k

    def gunwale():
        rings = []
        for i in range(nst):
            x, y, z = P[i][S]
            nx, ny = plan_normal(i)
            ox, oy = x + nx * wo, y + ny * wo
            ix, iy = x - nx * wi, y - ny * wi
            if iy < 0.0:
                ix, iy = x - nx * wi * (y / (ny * wi)) if ny > 1e-6 else x, 0.0
            rings.append([(ox, oy, z - hg), (ox, oy, z + ht), (ix, iy, z + ht), (ix, iy, z - hg)])
        b.loft(rings, 'teak', closed=True, cap0=True, cap1=True, sg=lambda i, s: s, orient='auto')

    with b.at(_MIRROR_Y):
        Us = plating()
    Up = plating()

    # ---- keel, stem and stern post -------------------------------------------------------
    inner = [(P[i][0][0], P[i][0][2]) for i in range(nst)]
    head = 0.07 * k

    def stem_run(sign):
        ztop = sheer(float(sign)) + head
        return [(sign * (xr - Rf + Rf * math.cos(math.radians(a))), zc + Rf * math.sin(math.radians(a)))
                for a in (-21.0, 0.0)] + [(sign * (xr + rake * (ztop - zc)), ztop)]

    inner = inner + stem_run(1)
    if not transom:
        inner = stem_run(-1)[::-1] + inner
    slim = [inner[0]]
    for a, c, d in zip(inner, inner[1:], inner[2:]):                # drop collinear points
        if _bend(math.atan2(c[1] - a[1], c[0] - a[0]), math.atan2(d[1] - c[1], d[0] - c[0])) > 0.4:
            slim.append(c)
    slim.append(inner[-1])
    rings = []
    for i, (x, z) in enumerate(slim):
        a, c = slim[max(i - 1, 0)], slim[min(i + 1, len(slim) - 1)]
        tx, tz = c[0] - a[0], c[1] - a[1]
        n = math.hypot(tx, tz) or 1.0
        ox, oz = x + tz / n * kh, z - tx / n * kh
        if transom and x < 0.0:
            ox, oz = x, 0.0
        elif abs(tz) < 1e-6 * n:
            oz = 0.0
        rings.append([(x, yk, z), (ox, yk, oz), (ox, -yk, oz), (x, -yk, z)])
    b.loft(rings, 'white', closed=False, cap0=True, cap1=True, sg=lambda i, s: s, orient=(0.0, 0.0, D * 0.6))

    if transom:
        b.face([Us[0][j] for j in range(S + 1)] + [Up[0][j] for j in range(S, -1, -1)], 'white')

    if cover:
        # ---- canvas cover over a ridge spar ---------------------------------------------
        def ridge_z(t):
            return max(sheer(t) + 0.07 * D, D * (1.46 - 0.07 * t * t))

        ridge, edge, skirt = [], {1: [], -1: []}, {1: [], -1: []}
        for i, t in enumerate(ts):
            x, y, z = P[i][S]
            nx, ny = plan_normal(i)
            ext = 0.0
            if is_stem(i):
                ext = math.copysign(0.10 * k, t)
            elif aft_tr(t) and abs(t) >= 1.0:
                ext = -0.035 * k
            ex, ey = x + nx * 0.05 * k + ext, y + ny * 0.05 * k
            ridge.append(b.v((x + ext, 0.0, ridge_z(t))))
            for s in (1, -1):
                edge[s].append(b.v((ex, s * ey, z + 0.03 * k)))
                skirt[s].append(b.v((ex + nx * 0.004, s * (ey + ny * 0.004), z - 0.11 * k)))
        for s in (1, -1):
            g1, g2 = b.group(), b.group()
            for i in range(nst - 1):
                b.face([edge[s][i], ridge[i], ridge[i + 1], edge[s][i + 1]], 'canvas', g1, flip=s < 0)
                b.face([skirt[s][i], edge[s][i], edge[s][i + 1], skirt[s][i + 1]], 'canvas', g2, flip=s < 0)
        for i, fl in ((nst - 1, False), (0, True)):
            b.face([skirt[-1][i], skirt[1][i], edge[1][i], edge[-1][i]], 'canvas', flip=fl)
            b.face([edge[-1][i], edge[1][i], ridge[i]], 'canvas', flip=fl)
        return b.finish(name)

    # ---- open boat: gunwales, lining, thwarts, sheets, bottom boards -----------------------
    with b.at(_MIRROR_Y):
        gunwale()
        Qs = lining()
    gunwale()
    Qp = lining()
    if transom:
        nq = len(pick)
        b.face([Qp[0][m] for m in range(nq)] + [Qs[0][m] for m in range(nq - 1, 0, -1)], 'white')
        b.face([Up[0][S], Us[0][S], Qs[0][nq - 1], Qp[0][nq - 1]], 'teak')

    zt = 0.72 * D                                                   # top of the thwarts
    tw, tt = 0.115 * k, 0.04 * k                                    # thwart half width, thickness
    n_th = max(2, round(L / 1.5))
    t_a, t_f = -0.42, 0.60
    xs_th = [x_of(t_a + (t_f - t_a) * i / (n_th - 1)) for i in range(n_th)]
    for xc in xs_th:
        yw = min(y_at(xc - tw, zt - tt), y_at(xc + tw, zt - tt)) - 0.025 * k
        b.box((xc - tw, -yw, zt - tt), (xc + tw, yw, zt), 'teak', skip='-y +y')

    def deck_strip(xs, z, inset, mat):
        """Flat platform following the inside of the planking at height z."""
        rows = []
        for x in xs:
            y = max(y_at(x, z) - inset, 0.0)
            rows.append((b.v((x, -y, z)), b.v((x, y, z))) if y > 1e-4 else (b.v((x, 0.0, z)),) * 2)
        g = b.group()
        for (a0, a1), (c0, c1) in zip(rows, rows[1:]):
            b.face([a0, c0, c1, a1], mat, g)

    x0 = xs_th[-1] + tw                                             # bow sheets
    deck_strip([x0 + (x_of(0.93) - x0) * f for f in (0.0, 0.4, 0.75, 1.0)], zt, 0.03 * k, 'teak')
    x1 = xs_th[0] - tw                                              # stern sheets
    x_end = -xa + tk if transom else x_of(-0.93)
    deck_strip([x_end + (x1 - x_end) * f for f in (0.0, 0.25, 0.6, 1.0)], zt, 0.03 * k, 'teak')
    zb = kh + 0.17 * D                                              # bottom boards
    deck_strip([x_of(t) for t in (-0.62, -0.4, -0.15, 0.15, 0.4, 0.66)], zb, 0.055 * k, 'deck_pine')

    b.weld([v for v in inner_verts if abs(v.co.y) < 1e-6])
    return b.finish(name)


# =========================================================================================
#  2  radial davit
# =========================================================================================

def radial_davit(name='radial_davit', height=2.3, reach=0.9, radius=0.045):
    """Round-bar radial (goose-neck) boat davit with a ball end, in a deck socket.

    Origin: base centre.  The head curves over toward +X; ``height`` is the top of the head,
    ``reach`` the horizontal distance from the post axis to the tip of the ball.
    """
    b = _Builder()
    r = float(radius)
    rb = 1.6 * r                                    # ball end
    zc = height - rb                                # head centreline
    Rh = min(0.84 * (reach - rb), 0.55 * zc)
    Rv = min(1.15 * Rh, 0.55 * zc)
    path = [(0.0, 0.0, 0.02), (0.0, 0.0, zc - Rv)]
    rad = [r, r * 0.97]
    for i in range(1, 7):
        a = math.radians(15.0 * i)
        path.append((Rh - Rh * math.cos(a), 0.0, zc - Rv + Rv * math.sin(a)))
        rad.append(r * (0.97 - 0.22 * i / 6))
    path.append((reach - rb, 0.0, zc))
    rad.append(r * 0.72)
    b.tube(path, rad, 6, 'white', up=(1, 0, 0))
    b.sphere((reach - rb, 0.0, zc), rb, 'white', n=6, stacks=3)
    hs = 0.13 * height                              # socket
    b.lathe([(3.0 * r, 0.0), (3.0 * r, 0.025), (1.9 * r, 0.05), (1.7 * r, hs), (1.02 * r, hs + 0.03)],
            6, 'white', crease=30.0)
    return b.finish(name)


# =========================================================================================
#  3  cowl ventilator
# =========================================================================================

def cowl_vent(name='cowl_vent', height=3.05, trunk_d=0.5, mouth_d=0.95):
    """Steamer cowl ventilator: coaming, trunk, swivel collar, swept bell-mouth cowl, rolled rim.

    Origin: base centre.  Mouth faces +X; ``height`` is the top of the cowl.  When the cowl
    head would take more than two thirds of the height, the diameters are reduced in
    proportion so that short ventilators keep a trunk.
    """
    b = _Builder()
    rt, rm = trunk_d / 2.0, mouth_d / 2.0

    def head_height(rm_):
        return 1.04 * rm_ + rm_ + 0.07 * rm_
    if head_height(rm) > 0.66 * height:
        s = 0.66 * height / head_height(rm)
        rt, rm = rt * s, rm * s
    Rb = 1.04 * rm                                  # bend radius of the cowl centreline
    bead = 0.07 * rm                                # rolled rim
    z0 = height - (Rb + rm + bead)                  # spring of the bend
    r0 = 1.08 * rt                                  # swivel collar
    rc = 1.16 * rt                                  # deck coaming
    hc = min(0.26, 0.42 * z0)
    sl = min(0.20, 0.25 * z0)
    N = 12
    X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))

    def ring(c, u, r):
        return [c + (u * math.cos(TAU * j / N) - Y * math.sin(TAU * j / N)) * r for j in range(N)]

    def sweep(deg, shrink=0.0):
        a = math.radians(deg)
        f = deg / 90.0
        r = r0 + (rm - r0) * (0.45 * f + 0.55 * f * f) - shrink
        c = Vector((Rb - Rb * math.cos(a), 0.0, z0 + Rb * math.sin(a)))
        return ring(c, Vector((-math.cos(a), 0.0, math.sin(a))), r)

    rings, tags = [], []

    def add(pts, tag):
        rings.append(pts)
        tags.append(tag)

    add(ring(Z * 0.0, -X, rc), None)
    add(ring(Z * hc, -X, rc), 'coaming')
    add(ring(Z * (hc + 0.12 * rt), -X, rt), 'shoulder')
    add(ring(Z * (z0 - sl), -X, rt), 'trunk')
    add(ring(Z * (z0 - sl), -X, r0), 'step')
    for deg in (0, 15, 30, 45, 60, 75, 90):
        add(sweep(deg), 'cowl')
    c90 = Vector((Rb, 0.0, z0 + Rb))
    add(ring(c90 + X * 0.045 * rm, Z, rm + bead), 'rim')
    add(ring(c90 + X * 0.10 * rm, Z, rm - 0.015 * rm), 'rim')
    for deg in (74, 50, 24):
        add(sweep(deg, 0.035 * rm), 'inside')
    tags = tags[1:]
    b.loft(rings, lambda i, s: 'vent_red' if tags[i] == 'inside' else 'buff', closed=True,
           cap1='vent_red', sg=lambda i, s: tags[i])
    return b.finish(name)


# =========================================================================================
#  4  stockless anchor
# =========================================================================================

def stockless_anchor(name='stockless_anchor', shank=1.7, fluke_angle=35.0):
    """Smith's patent stockless bower anchor: tapered shank with ring, crown with two flukes
    and tripping palms.

    Origin: crown pivot.  Shank along +Z.  The two flukes lie side by side along Y (the pivot
    pin is the Y axis) and are swung ``fluke_angle`` degrees from the shank toward +X, as when
    the anchor is hove up against the bow plating; 0 lays them parallel to the shank.
    """
    b = _Builder()
    k = shank / 1.7
    b.frustum((0.0, 0.0, -0.03 * k), (0.085 * k, 0.058 * k), (0.0, 0.0, shank), (0.055 * k, 0.045 * k),
              'iron', skip='-z')
    R1, r1 = 0.125 * k, 0.024 * k                   # ring through the head of the shank
    with b.at(_T(0.0, 0.0, shank + 0.08 * k)):
        b.lathe([(R1 + r1 * math.cos(TAU * i / 5), r1 * math.sin(TAU * i / 5)) for i in range(5)],
                10, 'iron', axis='Y', loop=True, crease=180.0)
    with b.at(_R('Y', fluke_angle)):
        w = 0.58 * k                                # half width over the flukes
        crown = [(-0.10, 0.11), (-0.165, 0.0), (-0.145, -0.10), (-0.07, -0.17),
                 (0.07, -0.17), (0.145, -0.10), (0.165, 0.0), (0.10, 0.11)]
        b.prism([(x * k, z * k) for x, z in crown], -w, w, 'iron', plane='XZ', crease=50.0)
        Lf = 1.05 * k                               # crown to fluke tip
        for mir in (Matrix.Identity(4), _MIRROR_Y):
            with b.at(mir):
                rings = []
                for z, yi, yo, th in ((0.05, 0.105, 0.58, 0.085), (0.46, 0.105, 0.57, 0.062),
                                      (0.82, 0.17, 0.50, 0.038), (1.0, 0.29, 0.38, 0.014)):
                    z, yi, yo, th = z * Lf, yi * k, yo * k, th * k
                    rings.append([(-th, yi, z), (th, yi, z), (th, yo, z), (-th, yo, z)])
                b.loft(rings, 'iron', closed=True, cap1=True, sg=lambda i, s: s, orient='auto')
        for sx in (1.0, -1.0):                      # tripping palms
            b.loft([[(sx * 0.14 * k, -0.21 * k, -0.12 * k), (sx * 0.14 * k, 0.21 * k, -0.12 * k),
                     (sx * 0.14 * k, 0.21 * k, 0.02 * k), (sx * 0.14 * k, -0.21 * k, 0.02 * k)],
                    [(sx * 0.27 * k, -0.13 * k, -0.10 * k), (sx * 0.27 * k, 0.13 * k, -0.10 * k),
                     (sx * 0.25 * k, 0.13 * k, -0.05 * k), (sx * 0.25 * k, -0.13 * k, -0.05 * k)]],
                   'iron', closed=True, cap1=True, sg='flat', orient='auto')
    return b.finish(name)


# =========================================================================================
#  5  steam windlass
# =========================================================================================

def windlass(name='windlass', width=2.3):
    """Clarke, Chapman pattern steam windlass of the 1890s: bedplate, two side frames, main
    shaft with two cable lifters and band-brake drums, warping ends outboard, central spur
    wheel under a guard, two horizontal steam cylinders driving a crank shaft abaft.

    Origin: centre of the bedplate on deck.  Main shaft along Y, engine on the -X (after)
    side, cables lead off toward +X.  ``width`` is over the warping ends.
    """
    b = _Builder()
    k = width / 2.3
    zs = 0.62 * k                                   # main shaft height
    xk, zk = -0.40 * k, 0.33 * k                    # crank shaft
    b.box((-1.04 * k, -0.98 * k, 0.0), (0.52 * k, 0.98 * k, 0.06 * k), 'iron', skip='-z')
    frame = [(-0.58, 0.06), (0.44, 0.06), (0.41, 0.16), (0.15, 0.56), (0.13, 0.72), (0.0, 0.79),
             (-0.13, 0.72), (-0.17, 0.55), (-0.50, 0.44), (-0.58, 0.30)]
    for s in (1.0, -1.0):
        y0, y1 = sorted((s * 0.76 * k, s * 0.85 * k))
        b.prism([(x * k, z * k) for x, z in frame], y0, y1, 'iron', plane='XZ', crease=50.0)
    with b.at(_T(0.0, 0.0, zs)):
        b.lathe([(0.06 * k, -0.90 * k), (0.06 * k, 0.90 * k)], 6, 'iron', axis='Y')
        b.lathe([(0.40 * k, -0.055 * k), (0.40 * k, 0.055 * k)], 12, 'iron', axis='Y', cap0=True, cap1=True)
        b.lathe([(0.30 * k, -0.09 * k), (0.445 * k, -0.09 * k), (0.445 * k, 0.09 * k), (0.30 * k, 0.09 * k)],
                8, 'iron', axis='Y', arc=(-112.0, 112.0), crease=50.0)
        for mir in (Matrix.Identity(4), _MIRROR_Y):
            with b.at(mir):
                # cable lifter (gypsy), brake drum, warping end
                b.lathe([(0.27 * k, 0.30 * k), (0.27 * k, 0.355 * k), (0.165 * k, 0.43 * k),
                         (0.27 * k, 0.505 * k), (0.27 * k, 0.56 * k)], 10, 'iron', axis='Y', cap0=True, crease=30.0)
                b.lathe([(0.235 * k, 0.56 * k), (0.235 * k, 0.665 * k)], 10, 'iron', axis='Y', cap1=True)
                b.lathe([(0.215 * k, 0.875 * k), (0.215 * k, 0.91 * k), (0.14 * k, 0.975 * k),
                         (0.15 * k, 1.08 * k), (0.205 * k, 1.15 * k)], 10, 'iron', axis='Y', cap1=True, crease=30.0)
                # brake screw and handwheel
                b.tube([(0.0, 0.61 * k, 0.22 * k), (0.0, 0.61 * k, 0.50 * k)], 0.018 * k, 3, 'iron')
                with b.at(_T(0.0, 0.61 * k, 0.0)):
                    b.lathe([(0.115 * k, 0.49 * k), (0.115 * k, 0.515 * k)], 7, 'brass', cap0=True, cap1=True)
    for mir in (Matrix.Identity(4), _MIRROR_Y):
        with b.at(mir):
            # steam cylinder with valve chest, piston rod to the crank disc
            with b.at(_T(0.0, 0.43 * k, 0.175 * k)):
                b.lathe([(0.11 * k, -0.99 * k), (0.11 * k, -0.67 * k)], 8, 'iron', axis='X',
                        cap0='brass', cap1=True)
            b.box((-0.95 * k, 0.37 * k, 0.26 * k), (-0.71 * k, 0.49 * k, 0.345 * k), 'iron', skip='-z')
            b.tube([(-0.67 * k, 0.43 * k, 0.175 * k), (xk - 0.02 * k, 0.43 * k, zk + 0.06 * k)], 0.022 * k, 3, 'iron')
            with b.at(_T(xk, 0.0, zk)):
                b.lathe([(0.10 * k, 0.40 * k), (0.10 * k, 0.46 * k)], 6, 'iron', axis='Y', cap0=True, cap1=True)
    with b.at(_T(xk, 0.0, zk)):
        b.lathe([(0.035 * k, -0.76 * k), (0.035 * k, 0.76 * k)], 6, 'iron', axis='Y')
    return b.finish(name)


# =========================================================================================
#  6  bitts
# =========================================================================================

def bitts(name='bitts', spacing=0.5, height=0.45, d=0.2):
    """Pair of mooring bollards with flanged heads on a base plate.
    Origin: base centre.  The pair lies along X."""
    b = _Builder()
    r = d / 2.0
    t = 0.07 * height
    b.box((-spacing / 2 - 0.85 * d, -0.85 * d, 0.0), (spacing / 2 + 0.85 * d, 0.85 * d, t), 'iron', skip='-z')
    for sx in (-1.0, 1.0):
        with b.at(_T(sx * spacing / 2, 0.0, 0.0)):
            b.lathe([(r, t), (r, 0.80 * height), (1.28 * r, 0.86 * height), (1.28 * r, 0.965 * height),
                     (0.0, height)], 8, 'iron', crease=40.0)
    return b.finish(name)


# =========================================================================================
#  7  binnacle
# =========================================================================================

def binnacle(name='binnacle', height=1.3):
    """Kelvin (Thomson) pattern compass binnacle: turned teak pedestal, brass helmet hood with
    a window, two iron quadrantal correcting spheres on brackets, Flinders bar forward.

    Origin: base centre.  Window faces aft (-X, toward the helmsman), spheres port and
    starboard (+/-Y), Flinders bar on the fore side (+X)."""
    b = _Builder()
    k = height / 1.3
    prof = [(0.24, 0.0), (0.24, 0.045), (0.17, 0.10), (0.145, 0.72), (0.21, 0.86), (0.21, 0.95),
            (0.20, 1.08), (0.14, 1.20), (0.055, 1.275), (0.0, 1.30)]
    b.lathe([(r * k, z * k) for r, z in prof], 10, ['teak'] * 4 + ['brass'] * 5, crease=30.0)
    b.box((-0.225 * k, -0.07 * k, 1.01 * k), (-0.15 * k, 0.07 * k, 1.14 * k), 'brass', skip='+x',
          fm={'-x': 'glass'})
    b.tube([(0.215 * k, 0.0, 0.52 * k), (0.215 * k, 0.0, 1.02 * k)], 0.03 * k, 4, 'brass', cap1=True, phase=45.0)
    for s in (1.0, -1.0):
        y0, y1 = sorted((s * 0.17 * k, s * 0.30 * k))
        b.box((-0.028 * k, y0, 0.905 * k), (0.028 * k, y1, 0.945 * k), 'iron', skip='-y +y')
        b.sphere((0.0, s * 0.385 * k, 0.925 * k), 0.095 * k, 'iron', n=8, stacks=4)
        y0, y1 = sorted((s * 0.17 * k, s * 0.245 * k))
        b.box((-0.04 * k, y0, 1.02 * k), (0.04 * k, y1, 1.11 * k), 'brass', skip='-y' if s > 0 else '+y')
    return b.finish(name)


# =========================================================================================
#  8  searchlight
# =========================================================================================

def searchlight(name='searchlight', height=1.15, drum_d=0.45):
    """1890s marine arc-lamp searchlight projector: short drum with glass front and brass bezel,
    carbon-fume chimney, lamp box, trunnioned in a U yoke on a turned pedestal.

    Origin: base centre.  Beam toward +X; ``height`` is the top of the chimney."""
    b = _Builder()
    k = height / 1.15
    R = drum_d / 2.0
    Ld = 0.86 * drum_d
    zc = height - 1.27 * R                           # trunnion height
    zy = zc - R - 0.075 * k                          # top of the yoke cross bar
    b.lathe([(0.19 * k, 0.0), (0.19 * k, 0.03 * k), (0.085 * k, 0.10 * k), (0.06 * k, zy - 0.13 * k),
             (0.10 * k, zy - 0.04 * k)], 8, 'iron', crease=30.0)
    ya = R + 0.022 * k
    b.box((-0.045 * k, -ya - 0.04 * k, zy - 0.04 * k), (0.045 * k, ya + 0.04 * k, zy), 'iron')
    for s in (1.0, -1.0):
        y0, y1 = sorted((s * ya, s * (ya + 0.04 * k)))
        b.frustum((0.0, (y0 + y1) / 2, zy), (0.045 * k, 0.02 * k), (0.0, (y0 + y1) / 2, zc + 0.06 * k),
                  (0.03 * k, 0.02 * k), 'iron', skip='-z')
    with b.at(_T(0.0, 0.0, zc)):
        h = Ld / 2
        b.lathe([(0.0, -h - 0.16 * R), (0.62 * R, -h - 0.10 * R), (R, -h), (R, h - 0.16 * R),
                 (1.09 * R, h - 0.16 * R), (1.09 * R, h), (0.90 * R, h)],
                12, ['iron'] * 4 + ['brass'] * 2, axis='X', cap1='glass', crease=30.0)
        for mir in (Matrix.Identity(4), _MIRROR_Y):
            with b.at(mir):
                b.lathe([(0.055 * k, ya + 0.04 * k), (0.055 * k, ya + 0.075 * k)], 6, 'brass', axis='Y', cap1=True)
        with b.at(_T(-0.10 * R, 0.0, 0.0)):         # chimney
            b.lathe([(0.21 * R, 0.93 * R), (0.21 * R, 1.27 * R)], 6, 'iron', cap1=True)
        b.box((-0.5 * Ld, -0.42 * R, -1.22 * R), (0.28 * Ld, 0.42 * R, -0.86 * R), 'iron', skip='+z')
    return b.finish(name)


# =========================================================================================
#  9  skylight
# =========================================================================================

def skylight(name='skylight', length=1.85, width=1.1, height=0.9):
    """Teak deck skylight: coaming box on a plinth, pitched roof of two hinged leaves, each
    glazed in one to four lights under brass guard bars, capped ridge.

    Origin: centre of the base.  Ridge along X; ``height`` is the top of the ridge."""
    b = _Builder()
    L, W, H = float(length), float(width), float(height)
    hw = W / 2.0
    cap = min(0.07, 0.16 * H)                        # ridge cap allowance
    rise = min(0.58 * hw, 0.60 * H)
    zr = H - cap                                     # underside of the leaves at the ridge
    hc = zr - rise                                   # coaming height at the sides
    pitch = math.atan2(rise, hw)
    th = min(0.045, 0.1 * H)                         # leaf thickness
    # coaming with gable ends, plinth
    gable = [(-hw, 0.0), (hw, 0.0), (hw, hc), (0.0, zr), (-hw, hc)]
    for sx, order in ((-1.0, gable[::-1]), (1.0, gable)):
        b.face([b.v((sx * L / 2, y, z)) for y, z in order], 'teak')
    for s in (1.0, -1.0):
        vs = [b.v(p) for p in ((-L / 2, s * hw, 0.0), (L / 2, s * hw, 0.0), (L / 2, s * hw, hc), (-L / 2, s * hw, hc))]
        b.face(vs, 'teak', flip=s > 0)
    pl = min(0.03, 0.03 * W)
    b.box((-L / 2 - pl, -hw - pl, 0.0), (L / 2 + pl, hw + pl, min(0.09, 0.3 * hc)), 'teak', skip='-z')
    # leaves
    Lf = L + 0.07
    Wf = hw / math.cos(pitch) + 0.045
    sw = min(0.075, 0.16 * min(Lf, Wf))              # stiles and rails
    npane = max(1, min(4, round(L / 0.62)))
    pw = (Lf - (npane + 1) * sw) / npane
    rec = 0.4 * th
    nbar = max(2, min(4, round(pw / 0.13)))
    for mir in (Matrix.Identity(4), _MIRROR_Y):
        with b.at(mir @ _T(0.0, 0.0, zr) @ _R('X', -math.degrees(pitch))):
            O = [b.v(p) for p in ((-Lf / 2, 0.0, th), (Lf / 2, 0.0, th), (Lf / 2, Wf, th), (-Lf / 2, Wf, th))]
            Bt = [b.v(p) for p in ((-Lf / 2, 0.0, 0.0), (Lf / 2, 0.0, 0.0), (Lf / 2, Wf, 0.0), (-Lf / 2, Wf, 0.0))]
            y0, y1 = sw, Wf - sw
            panes = []
            for i in range(npane):
                xa = -Lf / 2 + sw + i * (pw + sw)
                xb = xa + pw
                rim = [b.v(p) for p in ((xa, y0, th), (xb, y0, th), (xb, y1, th), (xa, y1, th))]
                flo = [b.v(p) for p in ((xa + 0.008, y0 + 0.008, th - rec), (xb - 0.008, y0 + 0.008, th - rec),
                                        (xb - 0.008, y1 - 0.008, th - rec), (xa + 0.008, y1 - 0.008, th - rec))]
                panes.append(rim)
                for e in range(4):
                    f = (e + 1) % 4
                    b.face([rim[e], rim[f], flo[f], flo[e]], 'teak')
                b.face(flo, 'glass')
                for j in range(nbar):               # guard bars, triangular section
                    xc = xa + pw * (j + 1) / (nbar + 1)
                    bw, bh, ya, yb = 0.011, 0.02, y0 - 0.5 * sw, y1 + 0.5 * sw
                    l0, a0, r0 = b.v((xc - bw, ya, th)), b.v((xc, ya, th + bh)), b.v((xc + bw, ya, th))
                    l1, a1, r1 = b.v((xc - bw, yb, th)), b.v((xc, yb, th + bh)), b.v((xc + bw, yb, th))
                    b.face([l0, a0, a1, l1], 'brass')
                    b.face([a0, r0, r1, a1], 'brass')
                    b.face([l0, r0, a0], 'brass')
                    b.face([l1, a1, r1], 'brass')
            top = [O[0], O[1]]
            bot = []
            for rim in reversed(panes):
                top += [rim[1], rim[0]]
            for rim in panes:
                bot += [rim[3], rim[2]]
            b.face(top, 'teak')
            b.face(bot + [O[2], O[3]], 'teak')
            b.face([O[0], panes[0][0], panes[0][3], O[3]], 'teak')
            b.face([O[1], O[2], panes[-1][2], panes[-1][1]], 'teak')
            for p, q in zip(panes, panes[1:]):
                b.face([p[1], q[0], q[3], p[2]], 'teak')
            b.face([Bt[1], Bt[2], O[2], O[1]], 'teak')
            b.face([Bt[2], Bt[3], O[3], O[2]], 'teak')
            b.face([Bt[3], Bt[0], O[0], O[3]], 'teak')
            b.face([Bt[0], Bt[3], Bt[2], Bt[1]], 'teak')
    b.box((-Lf / 2 - 0.01, -0.05, zr), (Lf / 2 + 0.01, 0.05, H), 'teak', skip='-z')
    return b.finish(name)


# =========================================================================================
#  10  companion
# =========================================================================================

def companion(name='companion', length=0.9, width=0.8, height=0.9):
    """Teak companion-way hood: arched sliding top on a box that falls away aft, panelled
    double doors with brass knobs on the +X face, plinth.
    Origin: base centre."""
    b = _Builder()
    L, W, H = float(length), float(width), float(height)
    hw = W / 2.0 - 0.03
    crown = 0.09 * W
    ts_ = 0.035                                      # slide thickness
    hf = H - crown - ts_ - 0.012                     # side height at the front
    hb = hf - 0.10 * H                               # and at the back
    xf, xb = L / 2 - 0.03, -L / 2 + 0.03

    def arch(half, z, c):
        return [(half * math.cos(a), z + c * math.sin(a)) for a in (math.radians(d) for d in (0, 45, 90, 135, 180))]

    def body(x, zs):
        return [(x, hw, 0.0)] + [(x, y, z) for y, z in arch(hw, zs, crown)] + [(x, -hw, 0.0)]

    b.loft([body(xb, hb), body(xf, hf)], 'teak', closed=False, cap0=True, cap1=True,
           sg=lambda i, s: 0 if s == 0 else (2 if s == 5 else 1), orient='auto')
    # sliding top
    xs0, xs1 = xb + 0.26 * L, xf + 0.045

    def slide(x):
        zs = hb + (hf - hb) * (x - xb) / (xf - xb) + 0.012
        return ([(x, hw + 0.03, zs - 0.035)] + [(x, y, z) for y, z in arch(hw + 0.03, zs + ts_, crown)]
                + [(x, -hw - 0.03, zs - 0.035)])

    b.loft([slide(xs0), slide(xs1)], 'teak', closed=False, cap0=True, cap1=True,
           sg=lambda i, s: 0 if s == 0 else (2 if s == 5 else 1), orient='auto')
    # doors, each with two fielded panels and a knob
    zd0, zd1 = 0.11 * H, hf - 0.03
    for s in (1.0, -1.0):
        ya, yb = sorted((s * 0.012, s * (hw - 0.055)))
        b.box((xf, ya, zd0), (xf + 0.022, yb, zd1), 'teak', skip='-x')
        zm = zd0 + 0.45 * (zd1 - zd0)
        for za, zb in ((zd0 + 0.05, zm - 0.025), (zm + 0.025, zd1 - 0.05)):
            p0, p1 = ya + 0.05, yb - 0.05
            x0 = xf + 0.022
            b.loft([[(x0, p0, za), (x0, p1, za), (x0, p1, zb), (x0, p0, zb)],
                    [(x0 + 0.012, p0 + 0.03, za + 0.03), (x0 + 0.012, p1 - 0.03, za + 0.03),
                     (x0 + 0.012, p1 - 0.03, zb - 0.03), (x0 + 0.012, p0 + 0.03, zb - 0.03)]],
                   'teak', closed=True, cap1=True, sg='flat', orient='auto')
        yk_ = s * 0.045
        b.box((xf + 0.022, yk_ - 0.014, zm - 0.014), (xf + 0.05, yk_ + 0.014, zm + 0.014), 'brass', skip='-x')
    b.box((-L / 2, -W / 2, 0.0), (L / 2, W / 2, 0.075 * H), 'teak', skip='-z')
    return b.finish(name)


# =========================================================================================
#  11  cargo hatch
# =========================================================================================

def cargo_hatch(name='cargo_hatch', length=2.8, width=2.45, coaming=0.3):
    """Cargo hatch: white steel coaming, crowned canvas tarpaulin over the hatch boards turned
    down over the coaming, iron battens in cleats with wooden wedges along all four sides.
    Origin: centre at deck level.  Length along X."""
    b = _Builder()
    L, W, hc = float(length), float(width), float(coaming)
    hx, hy = L / 2.0, W / 2.0
    b.box((-hx, -hy, 0.0), (hx, hy, hc), 'white', skip='-z +z')
    e = 0.014                                        # tarpaulin stands off the plating
    drop = min(0.17, 0.55 * hc)
    ze, zb = hc + 0.02, hc - drop
    crown = 0.045 * W
    sec = [(hy + e, zb), (hy + e, ze)]
    sec += [((hy + e) * f, ze + crown * (1.0 - f * f)) for f in (0.6, 0.0, -0.6)]
    sec += [(-hy - e, ze), (-hy - e, zb)]
    b.loft([[(x, y, z) for y, z in sec] for x in (-hx - e, hx + e)], 'canvas', closed=False,
           cap0=True, cap1=True, sg=lambda i, s: 0 if s == 0 else (2 if s == 5 else 1), orient='auto')
    # battens
    bz0, bz1, bt = zb + 0.025, zb + 0.085, 0.016
    ox, oy = hx + e, hy + e
    b.box((-ox + 0.04, oy, bz0), (ox - 0.04, oy + bt, bz1), 'iron', skip='-y')
    b.box((-ox + 0.04, -oy - bt, bz0), (ox - 0.04, -oy, bz1), 'iron', skip='+y')
    b.box((ox, -oy + 0.04, bz0), (ox + bt, oy - 0.04, bz1), 'iron', skip='-x')
    b.box((-ox - bt, -oy + 0.04, bz0), (-ox, oy - 0.04, bz1), 'iron', skip='+x')
    # cleats and wedges
    cw, c0, c1 = 0.055, bz0 - 0.03, bz1 + 0.035

    def wedges(n, half, put, skip):
        for i in range(n):
            c = -half + 2.0 * half * (i + 0.5) / n
            lo = [put(c - cw, bt), put(c + cw, bt), put(c + cw, bt + 0.045), put(c - cw, bt + 0.045)]
            hi = [put(c - cw * 0.8, bt), put(c + cw * 0.8, bt), put(c + cw * 0.8, bt + 0.012), put(c - cw * 0.8, bt + 0.012)]
            ring0 = [(x, y, c0) for x, y in lo]
            ring1 = [(x, y, c1) for x, y in hi]
            b.loft([ring0, ring1], 'deck_pine', closed=True, cap0=True, cap1=True, sg='flat',
                   orient='auto', skip=skip)

    nl, ns = max(2, round(L / 0.9)), max(2, round(W / 1.0))
    wedges(nl, hx * 0.86, lambda c, o: (c, oy + o), (0,))
    wedges(nl, hx * 0.86, lambda c, o: (c, -oy - o), (0,))
    wedges(ns, hy * 0.86, lambda c, o: (ox + o, c), (0,))
    wedges(ns, hy * 0.86, lambda c, o: (-ox - o, c), (0,))
    return b.finish(name)


# =========================================================================================
#  12  lifebuoy
# =========================================================================================

def life_ring(name='life_ring', d=0.76):
    """Cork lifebuoy, white with four red bands on the diagonals.
    Origin: centre.  The ring lies in the XZ plane (axis along Y)."""
    b = _Builder()
    k = d / 0.76
    a, c = 0.055 * k, 0.04 * k                       # half section: radial, thickness
    R = d / 2.0 - a
    prof = [(R + a * math.cos(TAU * i / 6), c * math.sin(TAU * i / 6)) for i in range(6)]
    b.lathe(prof, 16, lambda i, j: 'red_port' if j % 4 == 1 else 'white', axis='Y', loop=True,
            crease=180.0, phase=11.25)
    return b.finish(name)


# =========================================================================================
#  13  sidelight
# =========================================================================================

def side_light(name='side_light', side='port'):
    """Sidelight screen with lantern: a dark screen board 0.9 m long and 0.45 m high along X
    with a return (chock) at its after end and a shelf, carrying a brass lantern with a red
    (port) or green (starboard) lens.

    Origin: inboard lower corner of the board at its AFTER end; the board runs forward from
    there along +X and the lantern stands outboard of it, shining forward and outboard."""
    b = _Builder()
    stbd = str(side).lower().startswith('s')
    lens = 'green_stbd' if stbd else 'red_port'
    with b.at(_MIRROR_Y if stbd else Matrix.Identity(4)):
        t = 0.028
        b.box((0.0, 0.0, 0.0), (0.90, t, 0.45), 'iron')
        b.box((0.0, t, 0.0), (t, 0.30, 0.45), 'iron', skip='-y')
        b.box((t, t, 0.0), (0.30, 0.30, t), 'iron', skip='-x -y')
        r = 0.095
        with b.at(_T(0.165, 0.165, 0.0)):
            b.lathe([(r, t), (r, 0.085), (r, 0.235), (0.5 * r, 0.31), (0.0, 0.345)], 8,
                    lambda i, j: lens if (i == 1 and j < 3) else 'brass', crease=30.0)
    return b.finish(name)


# =========================================================================================
#  14  masthead light
# =========================================================================================

def masthead_lantern(name='masthead_lantern'):
    """Masthead steaming light: copper/brass lantern 0.35 m tall with a glass lens showing over
    the forward 225 degrees, on a shelf bracket.

    Origin: bracket face against the mast, at the underside of the shelf.  Lens toward +X."""
    b = _Builder()
    r = 0.10
    xc = 0.045 + r
    b.box((0.0, -0.065, 0.0), (xc + 0.07, 0.065, 0.015), 'brass', skip='-x')
    b.box((0.0, -0.065, 0.015), (0.012, 0.065, 0.30), 'brass', skip='-x -z')
    with b.at(_T(xc, 0.0, 0.0)):
        b.lathe([(r, 0.015), (r, 0.075), (r, 0.215), (0.45 * r, 0.30), (0.0, 0.35)], 8,
                lambda i, j: 'glass' if (i == 1 and j in (0, 1, 2, 6, 7)) else 'brass',
                crease=30.0, phase=-22.5)
    return b.finish(name)


# =========================================================================================
#  15  steam whistle
# =========================================================================================

def steam_whistle(name='steam_whistle', height=0.6):
    """Brass organ-pipe (bell) steam whistle on a short stand pipe with valve and lever.
    Origin: base of the pipe.  The valve lever points aft (-X)."""
    b = _Builder()
    k = height / 0.6
    b.lathe([(0.02 * k, 0.0), (0.02 * k, 0.215 * k), (0.047 * k, 0.27 * k)], 6, 'brass', cap1=True, crease=30.0)
    b.lathe([(0.047 * k, 0.305 * k), (0.047 * k, 0.535 * k), (0.03 * k, 0.58 * k), (0.0, 0.60 * k)], 6, 'brass',
            cap0=True, crease=30.0)
    b.tube([(0.0, 0.0, 0.27 * k), (0.0, 0.0, 0.305 * k)], 0.012 * k, 3, 'brass')
    b.box((-0.032 * k, -0.028 * k, 0.10 * k), (0.032 * k, 0.028 * k, 0.165 * k), 'brass')
    b.box((-0.19 * k, -0.007 * k, 0.125 * k), (-0.032 * k, 0.007 * k, 0.142 * k), 'brass', skip='+x')
    return b.finish(name)


# =========================================================================================
#  16  engine-room telegraph
# =========================================================================================

def engine_telegraph(name='engine_telegraph', height=1.1):
    """Brass engine-order telegraph: turned pedestal, dial drum with white dials facing port
    and starboard, a handle each side.
    Origin: base centre.  Drum axis along Y; ``height`` is the top of the drum."""
    b = _Builder()
    k = height / 1.1
    rd = 0.155 * k
    zc = height - rd
    b.lathe([(0.15 * k, 0.0), (0.15 * k, 0.03 * k), (0.07 * k, 0.10 * k), (0.05 * k, zc - 0.27 * k),
             (0.075 * k, zc - 0.10 * k)], 8, 'brass', crease=30.0)
    with b.at(_T(0.0, 0.0, zc)):
        b.lathe([(0.87 * rd, -0.075 * k), (rd, -0.058 * k), (rd, 0.058 * k), (0.87 * rd, 0.075 * k)], 12, 'brass',
                axis='Y', cap0='white', cap1='white', crease=30.0)
        for s in (1.0, -1.0):
            y0, y1 = sorted((s * 0.078 * k, s * 0.094 * k))
            with b.at(_R('Y', 32.0)):
                b.box((-0.014 * k, y0, -0.02 * k), (0.014 * k, y1, rd + 0.07 * k), 'brass',
                      skip='-y' if s > 0 else '+y')
    return b.finish(name)


# =========================================================================================
#  17  screw propeller
# =========================================================================================

def propeller(name='propeller', diameter=2.0, blades=3, right_handed=True):
    """Bronze screw propeller: boss with fairing cone and broad, twisted, constant-pitch blades.

    Origin: boss centre.  Shaft along X, the ship's head toward +X (cone aft).  A right-handed
    screw turns clockwise seen from astern when going ahead."""
    b = _Builder()
    Dm = float(diameter)
    R = Dm / 2.0
    pd = 1.15                                        # pitch ratio
    b.lathe([(0.0, -0.215 * Dm), (0.05 * Dm, -0.165 * Dm), (0.082 * Dm, -0.09 * Dm), (0.09 * Dm, 0.0),
             (0.086 * Dm, 0.10 * Dm)], 12, 'brass', axis='X', cap1=True, crease=40.0)
    stations = ((0.15, 0.17, 0.050), (0.30, 0.23, 0.042), (0.45, 0.28, 0.034), (0.60, 0.31, 0.026),
                (0.75, 0.30, 0.019), (0.88, 0.25, 0.013), (0.96, 0.17, 0.008), (1.0, 0.08, 0.005))
    section = ((-0.5, 0.0), (-0.18, 0.55), (0.2, 0.5), (0.5, 0.0), (0.2, -0.12), (-0.18, -0.12))
    with b.at(Matrix.Identity(4) if right_handed else _MIRROR_Y):
        for n in range(int(blades)):
            with b.at(_R('X', 360.0 * n / blades)):
                rings = []
                for rho, c, tm in stations:
                    r, c, tm = rho * R, c * Dm, tm * Dm
                    phi = math.atan2(pd * Dm, TAU * r)
                    ring = []
                    for s, tt in section:
                        along, thick = s * c, tt * tm
                        dth = (along * math.cos(phi) - thick * math.sin(phi)) / r
                        x = along * math.sin(phi) + thick * math.cos(phi)
                        ring.append((x, r * math.cos(dth), r * math.sin(dth)))
                    rings.append(ring)
                b.loft(rings, 'brass', closed=True, cap1=True, sg=lambda i, s: 0 if s < 3 else 1, orient='auto')
    return b.finish(name)


# =========================================================================================
#  18  accommodation ladder
# =========================================================================================

def accommodation_ladder(name='accommodation_ladder', length=4.2, width=0.6):
    """Side (accommodation) ladder: top platform, two stringers, level teak treads, rope
    handrails rove through stanchions on both sides.

    Origin: centre of the top surface of the platform.  The ladder leaves the platform's +X
    edge and descends toward +X and -Z at 40 degrees; ``length`` is measured down the slope."""
    b = _Builder()
    ang = math.radians(40.0)
    ca, sa = math.cos(ang), math.sin(ang)
    hw = width / 2.0
    px = 0.38
    b.box((-px, -hw - 0.03, -0.05), (px, hw + 0.03, 0.0), 'teak')
    with b.at(_T(px, 0.0, 0.0) @ _R('Y', 40.0)):
        for s in (1.0, -1.0):
            y0, y1 = sorted((s * hw, s * (hw + 0.03)))
            b.box((-0.06, y0, -0.16), (length, y1, 0.05), 'white')
    step = 0.24 / sa
    for i in range(int((length - 0.12) / step)):
        u = (i + 0.62) * step
        xc, zc = px + u * ca, -u * sa - 0.035
        b.box((xc - 0.12, -hw, zc - 0.03), (xc + 0.12, hw, zc), 'teak', skip='-y +y')
    for s in (1.0, -1.0):
        y = s * (hw + 0.015)
        tops = [Vector((-px + 0.05, y, 0.90))]
        b.tube([(-px + 0.05, y, -0.02), tops[0]], 0.016, 3, 'white')
        for u in (0.18, 0.5 * length, length - 0.18):
            base = Vector((px + u * ca, y, -u * sa))
            tops.append(base + Vector((0.0, 0.0, 0.90)))
            b.tube([base, tops[-1]], 0.016, 3, 'white')
        b.tube(tops, 0.012, 3, 'rope', up=(0, 1, 0))
    return b.finish(name)


# =========================================================================================
#  19  steering wheel
# =========================================================================================

def ship_wheel(name='ship_wheel', d=1.1):
    """Eight-spoked teak steering wheel with brass boss on a teak steering standard.

    Origin: base centre of the standard.  The wheel is parallel to the YZ plane (axle along X)
    and stands 0.24 m abaft the standard's centre, on the helmsman's side (-X); ``d`` is the
    diameter over the spoke handles."""
    b = _Builder()
    k = d / 1.1
    zc = d / 2.0 + 0.42 * k                          # axle height
    xw = -0.24 * k                                   # wheel plane
    b.frustum((0.0, 0.0, 0.0), (0.16 * k, 0.20 * k), (0.0, 0.0, zc + 0.13 * k), (0.11 * k, 0.14 * k), 'teak',
              skip='-z')
    with b.at(_T(0.0, 0.0, zc)):
        b.lathe([(0.03 * k, xw), (0.03 * k, -0.10 * k)], 6, 'brass', axis='X')
    with b.at(_T(xw, 0.0, zc)):
        ro, ri, t = 0.37 * d, 0.315 * d, 0.03 * k
        b.lathe([(ri, -t), (ro, -t), (ro, t), (ri, t)], 16, 'teak', axis='X', loop=True, crease=30.0)
        b.lathe([(0.075 * k, -0.05 * k), (0.075 * k, 0.05 * k)], 8, 'brass', axis='X', cap0=True, cap1=True)
        for i in range(8):
            with b.at(_R('X', 45.0 * i)):
                b.frustum((0.0, 0.0, 0.06 * k), (0.02 * k, 0.02 * k), (0.0, 0.0, d / 2.0), (0.013 * k, 0.013 * k),
                          'teak', skip='-z')
    return b.finish(name)


# =========================================================================================
#  20  mushroom ventilator
# =========================================================================================

def ventilator_mushroom(name='ventilator_mushroom', height=0.5, d=0.3):
    """Small mushroom-top deck ventilator.  Origin: base centre; ``d`` is the cap diameter."""
    b = _Builder()
    r = d / 2.0
    b.lathe([(0.70 * r, 0.0), (0.50 * r, 0.07 * height), (0.50 * r, 0.70 * height), (r, 0.745 * height),
             (0.72 * r, 0.93 * height), (0.0, height)], 8, 'white', crease=30.0)
    return b.finish(name)


# =========================================================================================
#  Batch 2: close-up deck and rigging hardware (seen from 1 to 10 m)
# =========================================================================================

def ships_bell(name='ships_bell', height=0.6):
    """Brass ship's bell, 0.3 m across the mouth, hung in an iron gallows (two uprights and an
    arch on a base plate) with clapper and lanyard.
    Origin: centre of the base plate.  The gallows stands across Y."""
    b = _Builder()
    k = height / 0.6
    z0 = 0.27 * k                                    # mouth of the bell
    prof = [(0.0, 0.19), (0.08, 0.13), (0.132, 0.006), (0.15, 0.0), (0.122, 0.055), (0.085, 0.15),
            (0.07, 0.215), (0.0, 0.255)]
    b.lathe([(r * k, z0 + z * k) for r, z in prof], 10, 'brass', crease=50.0)
    b.box((-0.06 * k, -0.26 * k, 0.0), (0.06 * k, 0.26 * k, 0.018 * k), 'iron', skip='-z')
    arch = [(0.0, -0.20, 0.01), (0.0, -0.20, 0.42), (0.0, -0.14, 0.54), (0.0, 0.0, 0.584),
            (0.0, 0.14, 0.54), (0.0, 0.20, 0.42), (0.0, 0.20, 0.01)]
    b.tube([(x * k, y * k, z * k) for x, y, z in arch], 0.016 * k, 4, 'iron', phase=45.0)
    b.box((-0.014 * k, -0.014 * k, 0.515 * k), (0.014 * k, 0.014 * k, 0.575 * k), 'iron', skip='-z +z')
    b.tube([(0.0, 0.0, z0 + 0.19 * k), (0.0, 0.0, z0 + 0.03 * k)], 0.008 * k, 3, 'iron')
    b.sphere((0.0, 0.0, z0 + 0.03 * k), 0.026 * k, 'iron', n=4, stacks=2)
    b.tube([(0.0, 0.0, z0 + 0.01 * k), (0.0, 0.0, z0 - 0.20 * k)], 0.006 * k, 3, 'rope')
    return b.finish(name)


def _block(b, Ls, zc, sheaves=1, nsh=8):
    """Wooden block shell (cheeks, sheaves, iron strop straps) centred at height zc, pin along
    Y.  Returns the half thickness over the straps."""
    tc, tsw = 0.09 * Ls, 0.13 * Ls                   # cheek and swallow thickness
    outline = [(-0.17, 0.5), (0.17, 0.5), (0.36, 0.2), (0.36, -0.2), (0.17, -0.5), (-0.17, -0.5),
               (-0.36, -0.2), (-0.36, 0.2)]
    poly = [(x * Ls, zc + z * Ls) for x, z in outline]
    half = (sheaves * tsw + (sheaves + 1) * tc) / 2.0
    y = -half
    for i in range(sheaves + 1):
        b.prism(poly, y, y + tc, 'teak', plane='XZ', cap0=(i == 0), cap1=(i == sheaves), crease=60.0)
        y += tc
        if i < sheaves:
            with b.at(_T(0.0, 0.0, zc + 0.03 * Ls)):
                b.lathe([(0.30 * Ls, y), (0.30 * Ls, y + tsw)], nsh, 'iron', axis='Y')
            y += tsw
    st = 0.03 * Ls
    b.box((-0.07 * Ls, half, zc - 0.52 * Ls), (0.07 * Ls, half + st, zc + 0.52 * Ls), 'iron', skip='-y')
    b.box((-0.07 * Ls, -half - st, zc - 0.52 * Ls), (0.07 * Ls, -half, zc + 0.52 * Ls), 'iron', skip='+y')
    return half + st


def rigging_block(name='rigging_block', sheaves=1, shell=0.22):
    """Iron-stropped wooden block: teak cheeks, iron sheave(s) showing in the swallow, strop
    down both cheeks with an eye above and a becket below.
    Origin: centre of the top eye.  The block hangs toward -Z, sheave pin along Y (the rope
    runs in the XZ plane); ``shell`` is the length of the wooden shell."""
    b = _Builder()
    Ls = float(shell)
    zc = -0.72 * Ls
    hy = _block(b, Ls, zc, max(1, int(sheaves))) - 0.015 * Ls
    zt, zb, re = zc + 0.5 * Ls, zc - 0.5 * Ls, 0.11 * Ls
    b.tube([(0.0, hy, zt), (0.0, re, 0.35 * re), (0.0, -re, 0.35 * re), (0.0, -hy, zt)], 0.035 * Ls, 3, 'iron')
    b.tube([(0.0, hy, zb), (0.0, 0.0, zb - 0.17 * Ls), (0.0, -hy, zb)], 0.03 * Ls, 3, 'iron')
    return b.finish(name)


def rigging_screw(name='rigging_screw', length=0.65):
    """Bottle screw for the foot of a wire shroud: lower fork on its pin, screw, barrel, upper
    eye (thimble shape).  Galvanised.
    Origin: centre of the lower pin (pin along X).  Body along +Z, ``length`` pin to top of eye."""
    b = _Builder()
    k = length / 0.65
    m = 'galvanised'
    b.box((-0.02 * k, -0.014 * k, -0.03 * k), (0.02 * k, 0.014 * k, 0.065 * k), m, skip='+z')
    b.tube([(-0.034 * k, 0.0, 0.0), (0.034 * k, 0.0, 0.0)], 0.009 * k, 3, m)
    b.tube([(0.0, 0.0, 0.06 * k), (0.0, 0.0, 0.20 * k)], 0.008 * k, 3, m)
    b.lathe([(0.011 * k, 0.17 * k), (0.022 * k, 0.21 * k), (0.022 * k, 0.43 * k), (0.011 * k, 0.47 * k)],
            5, m, crease=60.0)
    b.ring_loop([(0.0, 0.0, 0.47 * k), (0.036 * k, 0.0, 0.625 * k), (-0.036 * k, 0.0, 0.625 * k)],
                0.011 * k, 3, m, (0.0, 1.0, 0.0))
    return b.finish(name)


def deck_cleat(name='deck_cleat', length=0.42):
    """Two-horned iron cleat on a base.  Origin: base centre.  Horns along X."""
    b = _Builder()
    k = length / 0.42
    b.box((-0.11 * k, -0.035 * k, 0.0), (0.11 * k, 0.035 * k, 0.012 * k), 'iron', skip='-z')
    b.frustum((0.0, 0.0, 0.012 * k), (0.075 * k, 0.022 * k), (0.0, 0.0, 0.066 * k), (0.05 * k, 0.016 * k), 'iron',
              skip='-z +z')
    b.tube([(-0.21 * k, 0.0, 0.094 * k), (-0.11 * k, 0.0, 0.075 * k), (0.0, 0.0, 0.07 * k),
            (0.11 * k, 0.0, 0.075 * k), (0.21 * k, 0.0, 0.094 * k)],
           [0.008 * k, 0.017 * k, 0.021 * k, 0.017 * k, 0.008 * k], 4, 'iron', cap0=True, cap1=True, phase=45.0)
    return b.finish(name)


def mooring_chock(name='mooring_chock', length=0.55):
    """Open (roller-less) fairlead: two inward-curving horns over a saddle on a base plate.
    Origin: base centre.  The horns stand at the +/-X ends; the rope passes along Y."""
    b = _Builder()
    k = length / 0.55
    b.box((-0.275 * k, -0.06 * k, 0.0), (0.275 * k, 0.06 * k, 0.02 * k), 'iron', skip='-z')
    b.frustum((0.0, 0.0, 0.02 * k), (0.24 * k, 0.05 * k), (0.0, 0.0, 0.055 * k), (0.20 * k, 0.036 * k), 'iron',
              skip='-z')
    for mir in (Matrix.Identity(4), _MIRROR_X):
        with b.at(mir):
            b.tube([(0.20 * k, 0.0, 0.03 * k), (0.235 * k, 0.0, 0.10 * k), (0.19 * k, 0.0, 0.16 * k),
                    (0.085 * k, 0.0, 0.165 * k)], [0.042 * k, 0.038 * k, 0.032 * k, 0.022 * k], 6, 'iron',
                   cap1=True, up=(0, 1, 0))
    return b.finish(name)


def awning_stanchion(name='awning_stanchion', height=2.1):
    """Slender tapered awning stanchion in a deck socket, ball and eye at the head.
    Origin: base centre.  The eye lies in the XZ plane."""
    b = _Builder()
    k = height / 2.1
    rb = 0.022 * k
    zb = height - 0.04 * k - rb                      # ball centre
    b.lathe([(0.055 * k, 0.0), (0.032 * k, 0.018 * k), (0.028 * k, 0.11 * k)], 5, 'white', crease=30.0)
    b.tube([(0.0, 0.0, 0.02 * k), (0.0, 0.0, zb)], [0.021 * k, 0.013 * k], 5, 'white')
    b.sphere((0.0, 0.0, zb), rb, 'white', n=4, stacks=2)
    b.tube([(-0.02 * k, 0.0, zb + 0.4 * rb), (0.0, 0.0, height - 0.006 * k), (0.02 * k, 0.0, zb + 0.4 * rb)],
           0.006 * k, 3, 'white', up=(0, 1, 0))
    return b.finish(name)


def coal_scuttle(name='coal_scuttle', d=0.46):
    """Flush cast-iron bunker scuttle: bevelled ring frame, recessed lid with two bayonet lugs.
    Stands 12 mm proud.  Origin: centre at deck level."""
    b = _Builder()
    r = d / 2.0
    b.lathe([(r, 0.0), (0.89 * r, 0.012), (0.83 * r, 0.004)], 10, 'iron', cap1=True, crease=20.0)
    for s in (1.0, -1.0):
        x0, x1, w = s * 0.42 * r, s * 0.76 * r, 0.035 * r
        b.loft([[(x0, -w, 0.004), (x0, 0.0, 0.012), (x0, w, 0.004)],
                [(x1, -w, 0.004), (x1, 0.0, 0.012), (x1, w, 0.004)]], 'iron', closed=False,
               cap0=True, cap1=True, sg='flat', orient='auto')
    return b.finish(name)


def rope_coil(name='rope_coil', d=0.55, turns=6):
    """Flat cheesed-down (Flemish) coil of rope on deck, a true spiral.
    Origin: centre at deck level.  The rope is d / (2 turns + 1.5) thick."""
    b = _Builder()
    turns = max(1, int(turns))
    N = max(8, min(14, 320 // (4 * turns)))          # steps per turn
    th0 = 0.75 * TAU
    p = (d / 2.0) / (turns + 0.75)                   # pitch of the spiral = rope diameter
    rings = []
    for i in range(turns * N + 1):
        th = th0 + TAU * i / N
        rv = p * th / TAU
        c, s = math.cos(th), math.sin(th)
        zo = 0.42 * p if i < (turns - 1) * N else 0.0
        zi = 0.42 * p if i >= N else 0.05 * p
        rings.append([((rv + p) * c, (rv + p) * s, zo), ((rv + 0.5 * p) * c, (rv + 0.5 * p) * s, 0.95 * p),
                      (rv * c, rv * s, zi)])
    b.loft(rings, 'rope', closed=False, orient=(0.0, 0.0, -5.0))
    return b.finish(name)


def oar(name='oar', length=4.3):
    """Ash pulling oar: grip, round loom with a leather (a raised sleeve), flat blade with a
    copper tip band.
    Origin: handle end.  Oar along +X, blade flat (thin in Z)."""
    b = _Builder()
    L = float(length)
    k = L / 4.3
    m = 'deck_pine'
    xb = 0.67 * L                                    # root of the blade
    b.lathe([(0.017 * k, 0.0), (0.027 * k, 0.19 * k), (0.022 * k, xb + 0.06 * k)], 5, m, axis='X', cap0=True,
            crease=60.0)
    b.lathe([(0.034 * k, 0.24 * L), (0.034 * k, 0.31 * L)], 5, m, axis='X')
    xt = L - 0.05 * k
    sec = [(xb, 0.022 * k, 0.020 * k), (xb + 0.30 * (L - xb), 0.064 * k, 0.011 * k), (xt, 0.078 * k, 0.006 * k)]
    b.loft([[(x, -w, -t), (x, w, -t), (x, w, t), (x, -w, t)] for x, w, t in sec], m, closed=True, sg='flat',
           orient='auto')
    w, t = 0.079 * k, 0.007 * k
    b.loft([[(x, -w, -t), (x, w, -t), (x, w, t), (x, -w, t)] for x in (xt, L)], 'brass', closed=True, cap1=True,
           sg='flat', orient='auto')
    return b.finish(name)


def stove_pipe(name='stove_pipe', height=1.5, d=0.16):
    """Galley or stove funnel ('Charlie Noble'): pipe on a deck collar, conical rain cap on
    three stays.  Origin: base centre; ``height`` is the apex of the cap."""
    b = _Builder()
    r = d / 2.0
    N = 10
    hp = height - 0.9 * d                            # top of the pipe
    hc = hp + 0.35 * d                               # rim of the cap
    b.lathe([(1.9 * r, 0.0), (1.9 * r, 0.012), (1.25 * r, 0.10 * d + 0.012), (r, 1.1 * d), (r, hp)], N, 'iron',
            cap1=True, crease=30.0)
    b.lathe([(1.9 * r, hc), (0.0, hc + 0.55 * d)], N, 'iron', cap0=True)
    for i in range(3):
        a = TAU * (i + 0.25) / 3
        c, s = math.cos(a), math.sin(a)
        b.tube([(0.98 * r * c, 0.98 * r * s, hp - 0.25 * d), (1.6 * r * c, 1.6 * r * s, hc)], 0.07 * r, 3, 'iron')
    return b.finish(name)


def chain_cable(name='chain_cable', points=((0.0, 0.0, 0.054), (1.5, 0.0, 0.054)), link=0.18, wire=0.036):
    """Chain cable laid along the polyline ``points`` (the centreline of the chain, used as
    given): alternate links lie flat and on edge, each link a mitred four-sided loop, 24
    triangles.  ``link`` is the length of a link, ``wire`` the bar diameter; links are 0.6 link
    wide, so a cable lying on deck wants its points 0.3 * link above the planking.
    Origin: the origin of the points."""
    b = _Builder()
    pts = []
    for p in points:
        p = Vector(p)
        if not pts or (p - pts[-1]).length > 1e-6:
            pts.append(p)
    segs = [(q - p).length for p, q in zip(pts, pts[1:])]
    total = sum(segs)
    pitch = link - 2.0 * wire
    a, c = link / 2.0 - wire / 2.0, 0.3 * link - wire / 2.0
    n = int(total / pitch) if segs else 0
    s = (total - n * pitch) / 2.0 + pitch / 2.0
    i_seg, acc = 0, 0.0
    for i in range(n):
        while i_seg < len(segs) - 1 and acc + segs[i_seg] < s:
            acc += segs[i_seg]
            i_seg += 1
        T = (pts[i_seg + 1] - pts[i_seg]).normalized()
        P = pts[i_seg] + T * (s - acc)
        up = Vector((0, 0, 1)) if abs(T.z) < 0.95 else Vector((1, 0, 0))
        B = T.cross(up).normalized()
        Nn = B.cross(T).normalized()
        side, nrm = (B, Nn) if i % 2 == 0 else (Nn, B)
        b.ring_loop([P + T * (a * sx) + side * (c * sy) for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1))],
                    0.55 * wire, 3, 'iron', nrm)
        s += pitch
    return b.finish(name)


def hawse_bolster(name='hawse_bolster', d=0.34):
    """Oval cast lip (bolster) of a hawse pipe on the shell plating; ``d`` is the bore across.
    Origin: centre of the opening on the plating.  Opening normal +X, long axis of the oval Z."""
    b = _Builder()
    r = d / 2.0
    with b.at(Matrix.Diagonal((1.0, 1.0, 1.35, 1.0))):
        b.lathe([(1.50 * r, 0.0), (1.42 * r, 0.14 * r), (1.14 * r, 0.24 * r), (0.98 * r, 0.12 * r),
                 (0.95 * r, -0.25 * r)], 12, 'hull_black', axis='X', crease=60.0)
    return b.finish(name)


def davit_fall(name='davit_fall', drop=1.5):
    """Boat fall: upper block hung by its eye, lower block ``drop`` below it with a hook, three
    parts of rope between them and the hauling part leading down and 0.5 m away to -X.
    Origin: eye of the upper block.  Sheave pins along Y (the parts spread along X)."""
    b = _Builder()
    Ls = 0.22
    zu = -0.72 * Ls
    hy = _block(b, Ls, zu, 1, nsh=6) - 0.015 * Ls
    re = 0.11 * Ls
    b.tube([(0.0, hy, zu + 0.5 * Ls), (0.0, re, 0.35 * re), (0.0, -re, 0.35 * re), (0.0, -hy, zu + 0.5 * Ls)],
           0.035 * Ls, 3, 'iron')
    with b.at(_T(0.0, 0.0, -drop)):
        _block(b, Ls, 0.0, 1, nsh=6)
        z0 = -0.5 * Ls
        b.tube([(0.0, 0.0, z0 + 0.02), (0.0, 0.0, z0 - 0.07), (0.045, 0.0, z0 - 0.13), (0.085, 0.0, z0 - 0.075)],
               [0.014, 0.014, 0.013, 0.008], 3, 'iron', cap1=True, up=(0, 1, 0))
    for x in (-0.2 * Ls, 0.0, 0.2 * Ls):
        b.tube([(x, 0.0, zu - 0.25 * Ls), (x, 0.0, -drop + 0.25 * Ls)], 0.011, 3, 'rope')
    b.tube([(-0.26 * Ls, 0.0, zu), (-0.30, 0.0, -0.55 * drop), (-0.50, 0.0, -drop)], 0.011, 3, 'rope')
    return b.finish(name)


def boat_chock(name='boat_chock', beam=1.9, rise=0.35):
    """Boat chock: a timber on edge across the deck, cut to the turn of the bilge with a notch
    for the keel.  Origin: centre at deck level.  Plank across Y, 0.10 m thick in X; the keel
    rests 0.07 m above the deck and the horns rise to ``rise``."""
    b = _Builder()
    hw = 0.43 * beam
    zk, slot, n = 0.07, 0.045, 5
    yo = hw - 0.07
    half = [(slot + (yo - slot) * (i / n), zk + 0.04 + (rise - zk - 0.04) * (i / n) ** 2.2) for i in range(n + 1)]
    pts = [(-hw, 0.0), (hw, 0.0), (hw, rise)] + half[::-1] + [(slot, zk), (-slot, zk)]
    pts += [(-y, z) for y, z in half] + [(-hw, rise)]
    b.prism(pts, -0.05, 0.05, 'white', plane='YZ', crease=40.0)
    return b.finish(name)


def anchor_lantern(name='anchor_lantern'):
    """All-round white riding light, 0.4 m overall: globular glass on a brass base, brass top
    with a chimney cone, three guard rods and a bail handle.
    Origin: top of the bail (the lantern hangs below it)."""
    b = _Builder()
    zb = -0.40
    prof = [(0.065, 0.0), (0.065, 0.035), (0.088, 0.125), (0.06, 0.215), (0.06, 0.24), (0.03, 0.29), (0.0, 0.31)]
    with b.at(_T(0.0, 0.0, zb)):
        b.lathe(prof, 6, ['brass', 'glass', 'glass', 'brass', 'brass', 'brass'], cap0=True, crease=40.0)
        for i in range(3):
            a = TAU * (i + 0.25) / 3
            c, s = math.cos(a), math.sin(a)
            b.tube([(0.068 * c, 0.068 * s, 0.03), (0.099 * c, 0.099 * s, 0.125), (0.064 * c, 0.064 * s, 0.225)],
                   0.005, 3, 'brass')
    z1 = zb + 0.245
    b.tube([(0.0, 0.06, z1), (0.0, 0.085, -0.07), (0.0, 0.0, -0.004), (0.0, -0.085, -0.07), (0.0, -0.06, z1)],
           0.005, 3, 'brass', up=(1, 0, 0))
    return b.finish(name)


def swan_neck_vent(name='swan_neck_vent', height=1.1, d=0.15):
    """Plain gooseneck ventilator: pipe turned over through 180 degrees, mouth facing down, on a
    deck collar.  Origin: base centre.  The return bend goes toward +X; ``height`` is the top
    of the bend.  The dark disc inside the mouth is 'iron'."""
    b = _Builder()
    r = d / 2.0
    R = 0.95 * d
    n = 7
    zc = height - R - r
    path = [(0.0, 0.0, 0.0), (0.0, 0.0, zc)]
    path += [(R - R * math.cos(math.radians(a)), 0.0, zc + R * math.sin(math.radians(a)))
             for a in (36, 72, 108, 144, 180)]
    zm = zc - 0.6 * d
    path.append((2.0 * R, 0.0, zm))
    b.tube(path, r, n, 'white', up=(1, 0, 0))
    b.face([b.v((2.0 * R + 0.86 * r * math.cos(-TAU * j / n), 0.86 * r * math.sin(-TAU * j / n), zm + 0.25 * d))
            for j in range(n)], 'iron')
    b.lathe([(1.75 * r, 0.0), (1.15 * r, 0.07)], n, 'white')
    return b.finish(name)


def oil_cask(name='oil_cask', height=0.9, bilge_d=0.66):
    """Coopered paraffin cask standing on end: bulged pine staves, six iron hoops, flat head
    with a bung.  Origin: centre of the lower head."""
    b = _Builder()
    H, rb = float(height), bilge_d / 2.0
    rh = 0.80 * rb                                   # radius at the heads
    fr = [0.0, 0.055, 0.14, 0.19, 0.275, 0.325, 0.5, 0.675, 0.725, 0.81, 0.86, 0.945, 1.0]
    mats = ['iron', 'deck_pine', 'iron', 'deck_pine', 'iron', 'deck_pine', 'deck_pine', 'iron', 'deck_pine',
            'iron', 'deck_pine', 'iron']
    b.lathe([(rh + (rb - rh) * (1.0 - (2.0 * f - 1.0) ** 2), f * H) for f in fr], 10, mats, cap1='deck_pine',
            crease=40.0)
    bx, bs = 0.45 * rh, 0.035 * rb / 0.33
    b.box((bx - bs, -bs, H), (bx + bs, bs, H + 0.6 * bs), 'teak', skip='-z')
    return b.finish(name)


def stores_box(name='stores_box', x=0.8, y=0.5, z=0.45):
    """Rough deal provision case: battens on the ends and across the lid, a rope becket on each
    end.  Origin: base centre.  ``x``, ``y``, ``z`` are the sizes of the case itself."""
    b = _Builder()
    hx, hy = x / 2.0, y / 2.0
    bt, bw = 0.018, min(0.07, 0.2 * y)
    b.box((-hx, -hy, 0.0), (hx, hy, z), 'deck_pine')
    for sx in (1.0, -1.0):
        for sy in (1.0, -1.0):
            x0, x1 = sorted((sx * hx, sx * (hx + bt)))
            y0, y1 = sorted((sy * hy, sy * (hy - bw)))
            b.box((x0, y0, 0.0), (x1, y1, z), 'deck_pine', skip='-x' if sx > 0 else '+x')
        xe, xo = sx * (hx + 0.004), sx * (hx + 0.055)
        b.tube([(xe, -0.09, 0.64 * z), (xo, -0.06, 0.50 * z), (xo, 0.06, 0.50 * z), (xe, 0.09, 0.64 * z)], 0.011, 3,
               'rope')
        xc = sx * 0.30 * x
        b.box((xc - bw / 2, -hy, z), (xc + bw / 2, hy, z + bt), 'deck_pine', skip='-z')
    return b.finish(name)


def coal_sack(name='coal_sack'):
    """Filled hessian coal sack standing slumped and tied at the neck, 0.9 m tall.
    Origin: base centre.  It leans toward +X."""
    b = _Builder()
    N = 10
    prof = [(0.19, 0.0), (0.27, 0.09), (0.29, 0.30), (0.26, 0.52), (0.17, 0.70), (0.065, 0.775), (0.10, 0.84),
            (0.07, 0.90), (0.0, 0.885)]
    rings = b.lathe(prof, N, 'rope', crease=50.0)
    seen = set()
    for ring in rings:
        for j, v in enumerate(ring):
            if v in seen:
                continue
            seen.add(v)
            z, a = v.co.z, TAU * j / N
            f = 1.0 + 0.07 * math.sin(3.0 * a + 4.0 * z) + 0.05 * math.sin(2.0 * a + 1.3)
            v.co.x = v.co.x * f * 0.84 + 0.10 * (z / 0.9) ** 2
            v.co.y *= f
            v.co.z = z * (1.0 - 0.05 * math.sin(a + 0.5) * (z / 0.9))
    return b.finish(name)


def mail_bag(name='mail_bag'):
    """Small canvas mail bag lying on its side, neck drawn tight, with a label tab; 0.7 m long.
    Origin: base centre.  Bag along X, neck toward +X."""
    b = _Builder()
    sz, rmax = 0.62, 0.155
    prof = [(0.0, -0.35), (0.11, -0.33), (0.15, -0.20), (rmax, 0.0), (0.12, 0.17), (0.035, 0.25), (0.06, 0.30),
            (0.05, 0.35)]
    with b.at(_T(0.0, 0.0, rmax * sz) @ Matrix.Diagonal((1.0, 1.0, sz, 1.0))):
        b.lathe(prof, 8, 'canvas', axis='X', cap1=True, crease=50.0)
    b.box((0.22, 0.05, 0.0), (0.34, 0.12, 0.006), 'deck_pine', skip='-z')
    return b.finish(name)


# ---------------------------------------------------------------------------------------- registry

FITTINGS = {
    'ships_boat': ships_boat,
    'radial_davit': radial_davit,
    'cowl_vent': cowl_vent,
    'stockless_anchor': stockless_anchor,
    'windlass': windlass,
    'bitts': bitts,
    'binnacle': binnacle,
    'searchlight': searchlight,
    'skylight': skylight,
    'companion': companion,
    'cargo_hatch': cargo_hatch,
    'life_ring': life_ring,
    'side_light': side_light,
    'masthead_lantern': masthead_lantern,
    'steam_whistle': steam_whistle,
    'engine_telegraph': engine_telegraph,
    'propeller': propeller,
    'accommodation_ladder': accommodation_ladder,
    'ship_wheel': ship_wheel,
    'ventilator_mushroom': ventilator_mushroom,
    # batch 2
    'ships_bell': ships_bell,
    'rigging_block': rigging_block,
    'rigging_screw': rigging_screw,
    'deck_cleat': deck_cleat,
    'mooring_chock': mooring_chock,
    'awning_stanchion': awning_stanchion,
    'coal_scuttle': coal_scuttle,
    'rope_coil': rope_coil,
    'oar': oar,
    'stove_pipe': stove_pipe,
    'chain_cable': chain_cable,
    'hawse_bolster': hawse_bolster,
    'davit_fall': davit_fall,
    'boat_chock': boat_chock,
    'anchor_lantern': anchor_lantern,
    'swan_neck_vent': swan_neck_vent,
    'oil_cask': oil_cask,
    'stores_box': stores_box,
    'coal_sack': coal_sack,
    'mail_bag': mail_bag,
}

# triangle budgets from the brief (chain_cable: per link)
BUDGETS = {
    'ships_bell': 240, 'rigging_block': 110, 'rigging_screw': 70, 'deck_cleat': 60, 'mooring_chock': 110,
    'awning_stanchion': 50, 'coal_scuttle': 60, 'rope_coil': 320, 'oar': 60, 'stove_pipe': 140,
    'chain_cable': 24, 'hawse_bolster': 100, 'davit_fall': 220, 'boat_chock': 80, 'anchor_lantern': 140,
    'swan_neck_vent': 120, 'oil_cask': 260, 'stores_box': 120, 'coal_sack': 180, 'mail_bag': 140,
    'ships_boat': 1600, 'radial_davit': 180, 'cowl_vent': 420, 'stockless_anchor': 260, 'windlass': 800,
    'bitts': 140, 'binnacle': 340, 'searchlight': 320, 'skylight': 360, 'companion': 140,
    'cargo_hatch': 180, 'life_ring': 200, 'side_light': 110, 'masthead_lantern': 100, 'steam_whistle': 90,
    'engine_telegraph': 180, 'propeller': 420, 'accommodation_ladder': 220, 'ship_wheel': 260,
    'ventilator_mushroom': 80,
}

# contact sheet: (label, key, keyword arguments)
DEMO_SET = [
    ('ships_boat', 'ships_boat', {}),
    ('ships_boat transom=True 5.4 m', 'ships_boat', dict(length=5.4, beam=1.7, depth=0.72, transom=True)),
    ('ships_boat cover=True', 'ships_boat', dict(cover=True)),
    ('radial_davit', 'radial_davit', {}),
    ('cowl_vent 3.05 m', 'cowl_vent', {}),
    ('cowl_vent height=1.0', 'cowl_vent', dict(height=1.0)),
    ('stockless_anchor', 'stockless_anchor', {}),
    ('windlass', 'windlass', {}),
    ('bitts', 'bitts', {}),
    ('binnacle', 'binnacle', {}),
    ('searchlight', 'searchlight', {}),
    ('skylight', 'skylight', {}),
    ('companion', 'companion', {}),
    ('cargo_hatch', 'cargo_hatch', {}),
    ('life_ring', 'life_ring', {}),
    ('side_light stbd', 'side_light', dict(side='stbd')),
    ('side_light port', 'side_light', dict(side='port')),
    ('masthead_lantern', 'masthead_lantern', {}),
    ('steam_whistle', 'steam_whistle', {}),
    ('engine_telegraph', 'engine_telegraph', {}),
    ('propeller', 'propeller', {}),
    ('accommodation_ladder', 'accommodation_ladder', {}),
    ('ship_wheel', 'ship_wheel', {}),
    ('ventilator_mushroom', 'ventilator_mushroom', {}),
]

# second sheet: (label, key, keyword arguments[, budget for this variant])
_DEMO_CHAIN = [(0.0, 0.0, 0.054), (0.55, 0.16, 0.054), (1.15, -0.12, 0.054), (1.8, 0.05, 0.054)]
DEMO_SET_2 = [
    ('ships_bell', 'ships_bell', {}),
    ('rigging_block', 'rigging_block', {}),
    ('rigging_block sheaves=2', 'rigging_block', dict(sheaves=2), 150),
    ('rigging_screw', 'rigging_screw', {}),
    ('deck_cleat', 'deck_cleat', {}),
    ('mooring_chock', 'mooring_chock', {}),
    ('awning_stanchion', 'awning_stanchion', {}),
    ('coal_scuttle', 'coal_scuttle', {}),
    ('rope_coil', 'rope_coil', {}),
    ('oar', 'oar', {}),
    ('stove_pipe', 'stove_pipe', {}),
    ('chain_cable 17 links', 'chain_cable', dict(points=_DEMO_CHAIN), 17 * 24),
    ('hawse_bolster', 'hawse_bolster', {}),
    ('davit_fall', 'davit_fall', {}),
    ('boat_chock', 'boat_chock', {}),
    ('anchor_lantern', 'anchor_lantern', {}),
    ('swan_neck_vent', 'swan_neck_vent', {}),
    ('oil_cask', 'oil_cask', {}),
    ('stores_box', 'stores_box', {}),
    ('coal_sack', 'coal_sack', {}),
    ('mail_bag', 'mail_bag', {}),
    ('ships_boat (lap shading)', 'ships_boat', {}),
]


# -------------------------------------------------------------------------------------------- demo

class _Studio:
    """Neutral studio scene that renders one object at a time with an orthographic camera."""

    VIEW = (1.0, -1.3, 0.72)                         # from the object toward the camera

    def __init__(self, samples=32):
        self.made = []
        sc = bpy.data.scenes.new('fittings_demo')
        self.scene = sc
        sc.render.engine = 'BLENDER_EEVEE'
        sc.view_settings.view_transform = 'Standard'
        sc.render.image_settings.file_format = 'PNG'
        sc.render.image_settings.color_mode = 'RGB'
        sc.render.film_transparent = False
        try:
            sc.eevee.taa_render_samples = samples
            sc.eevee.use_raytracing = True
        except Exception:
            pass
        world = bpy.data.worlds.new('fittings_demo')
        if world.node_tree is None:
            world.use_nodes = True
        bg = next((n for n in world.node_tree.nodes if n.bl_idname == 'ShaderNodeBackground'), None)
        if bg is not None:
            bg.inputs['Color'].default_value = (0.42, 0.44, 0.47, 1.0)
            bg.inputs['Strength'].default_value = 1.0
        sc.world = world
        self.world = world
        cam = bpy.data.cameras.new('fittings_demo_cam')
        cam.type = 'ORTHO'
        cam.clip_start, cam.clip_end = 0.05, 2000.0
        self.cam = self._link(bpy.data.objects.new('fittings_demo_cam', cam))
        sc.camera = self.cam
        self.key = self._light('key', 3.2, 12.0, True)
        self.fill = self._light('fill', 0.9, 30.0, False)
        me = bpy.data.meshes.new('fittings_demo_floor')
        me.from_pydata([(-400, -400, 0), (400, -400, 0), (400, 400, 0), (-400, 400, 0)], [], [(0, 1, 2, 3)])
        me.materials.append(self._mat('fittings_demo_floor', (0.36, 0.37, 0.39), False))
        self.floor = self._link(bpy.data.objects.new('fittings_demo_floor', me))
        self.ink = self._mat('fittings_demo_ink', (0.012, 0.012, 0.014), True)
        self.ink2 = self._mat('fittings_demo_ink2', (0.10, 0.10, 0.11), True)
        self.axis_mats = [self._mat('fittings_demo_x', (0.9, 0.05, 0.05), True),
                          self._mat('fittings_demo_y', (0.1, 0.65, 0.1), True),
                          self._mat('fittings_demo_z', (0.1, 0.25, 0.95), True)]
        self.temp = []

    def _link(self, ob):
        self.scene.collection.objects.link(ob)
        self.made.append(ob)
        return ob

    def _light(self, name, energy, angle, shadow):
        li = bpy.data.lights.new('fittings_demo_' + name, 'SUN')
        li.energy = energy
        li.angle = math.radians(angle)
        li.use_shadow = shadow
        return self._link(bpy.data.objects.new('fittings_demo_' + name, li))

    def _mat(self, name, col, emit):
        m = bpy.data.materials.new(name)
        if m.node_tree is None:
            m.use_nodes = True
        nt = m.node_tree
        out = next(n for n in nt.nodes if n.bl_idname == 'ShaderNodeOutputMaterial')
        if emit:
            em = nt.nodes.new('ShaderNodeEmission')
            em.inputs['Color'].default_value = (*col, 1.0)
            nt.links.new(em.outputs[0], out.inputs['Surface'])
        else:
            bsdf = next(n for n in nt.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled')
            bsdf.inputs['Base Color'].default_value = (*col, 1.0)
            bsdf.inputs['Roughness'].default_value = 0.9
        m.diffuse_color = (*col, 1.0)
        self.made.append(m)
        return m

    def _text(self, body, size, mat):
        cu = bpy.data.curves.new('fittings_demo_text', 'FONT')
        cu.body = body
        cu.size = size
        cu.align_x = 'CENTER'
        cu.materials.append(mat)
        ob = bpy.data.objects.new('fittings_demo_text', cu)
        ob.visible_shadow = False
        self.scene.collection.objects.link(ob)
        self.temp.append(ob)
        return ob

    def _bar(self, a, c, w, mat):
        """Camera-facing emissive line from a to c (world), used for the axis triad."""
        me = bpy.data.meshes.new('fittings_demo_axis')
        side = (c - a).cross(self.dcam)
        side = side.normalized() * w if side.length > 1e-9 else self.right * w
        me.from_pydata([a - side, a + side, c + side * 0.4, c - side * 0.4], [], [(0, 1, 2, 3)])
        me.materials.append(mat)
        ob = bpy.data.objects.new('fittings_demo_axis', me)
        ob.visible_shadow = False
        self.scene.collection.objects.link(ob)
        self.temp.append(ob)

    def render(self, ob, path, res=(400, 400), view=None, labels=(), axes=True, margin=1.0):
        """Render ``ob`` (placed at the world origin) to ``path``."""
        sc = self.scene
        linked = ob.name in sc.collection.objects
        if not linked:
            sc.collection.objects.link(ob)
        ob.location, ob.rotation_euler, ob.scale = (0, 0, 0), (0, 0, 0), (1, 1, 1)
        d = Vector(view or self.VIEW).normalized()
        q = d.to_track_quat('Z', 'Y')
        right, up = q @ Vector((1, 0, 0)), q @ Vector((0, 1, 0))
        self.dcam, self.right = d, right
        cos = [v.co for v in ob.data.vertices]
        rs, us, ds = [c.dot(right) for c in cos], [c.dot(up) for c in cos], [c.dot(d) for c in cos]
        wr, wu = max(rs) - min(rs), max(us) - min(us)
        aspect = res[1] / res[0]
        top, bot = (0.46, 0.30) if labels else (0.46, 0.46)       # usable fractions of the frame height
        scale = max(wr / 0.86, wu / ((top + bot) * 0.94) / aspect) * margin
        cr = (max(rs) + min(rs)) / 2
        cu = (max(us) + min(us)) / 2 - (top - bot) / 2 * scale * aspect
        dist = max(ds) + 0.25 * scale + 30.0
        self.cam.data.ortho_scale = scale
        self.cam.location = right * cr + up * cu + d * dist
        self.cam.rotation_euler = q.to_euler()
        for li, off in ((self.key, (-0.55, 0.55, 0.62)), (self.fill, (0.75, 0.15, 0.65))):
            to_light = (right * off[0] + up * off[1] + d * off[2]).normalized()
            li.rotation_euler = to_light.to_track_quat('Z', 'Y').to_euler()
        self.floor.location = (0.0, 0.0, min(c.z for c in cos) - 0.002 * scale)
        sc.render.resolution_x, sc.render.resolution_y = res
        sc.render.resolution_percentage = 100
        near = self.cam.location - d * 1.0                        # just in front of the lens
        for i, (txt, rel, mat) in enumerate(labels):
            t = self._text(txt, rel * scale, mat)
            t.rotation_euler = q.to_euler()
            t.location = near + up * (-(0.335 + 0.062 * i) * scale * aspect)
        if axes:
            lift = d * (dist - 2.0)                               # same screen position, drawn on top
            ln = 0.11 * scale
            o = Vector((0, 0, 0)) + lift
            for ax, mat in zip((Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))), self.axis_mats):
                self._bar(o, o + ax * ln, 0.006 * scale, mat)
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True, scene=sc.name)
        for t in self.temp:
            data = t.data
            bpy.data.objects.remove(t, do_unlink=True)
            if data.users == 0:
                (bpy.data.curves if isinstance(data, bpy.types.Curve) else bpy.data.meshes).remove(data)
        self.temp = []
        if not linked:
            sc.collection.objects.unlink(ob)

    def close(self):
        for item in self.made:
            if isinstance(item, bpy.types.Object):
                data = item.data
                bpy.data.objects.remove(item, do_unlink=True)
                if data is not None and data.users == 0:
                    coll = {bpy.types.Mesh: bpy.data.meshes, bpy.types.Camera: bpy.data.cameras}.get(type(data))
                    if coll is None and isinstance(data, bpy.types.Light):
                        coll = bpy.data.lights
                    if coll is not None:
                        coll.remove(data)
            else:
                bpy.data.materials.remove(item)
        bpy.data.scenes.remove(self.scene)
        bpy.data.worlds.remove(self.world)


def demo(out_png, cell=400, cols=6, items=None):
    """Build every fitting, render a labelled contact sheet to ``out_png`` (2400 x 1600 with the
    defaults) and print a table of triangle counts.  ``items`` defaults to DEMO_SET (the first
    twenty fittings); pass DEMO_SET_2 for the close-up hardware.  Returns the table rows."""
    import shutil
    import tempfile
    import numpy as np

    items = DEMO_SET if items is None else items
    out_png = os.path.abspath(out_png)
    os.makedirs(os.path.dirname(out_png), exist_ok=True)
    studio = _Studio()
    tmp = tempfile.mkdtemp(prefix='fittings_')
    rows_n = -(-len(items) // cols)
    sheet = np.zeros((rows_n * cell, cols * cell, 4), dtype=np.float32)
    sheet[..., :3] = 0.25
    sheet[..., 3] = 1.0
    table = []
    try:
        for n, item in enumerate(items):
            label, key, kw = item[:3]
            ob = FITTINGS[key]('demo_' + key, **kw)
            info = inspect(ob)
            dims = ob.dimensions
            table.append((label, key, info, tuple(dims), [s.name for s in ob.data.materials],
                          item[3] if len(item) > 3 else BUDGETS[key]))
            sub = '%d tris   %.2f x %.2f x %.2f m' % (info['tris'], dims.x, dims.y, dims.z)
            path = os.path.join(tmp, 'cell_%02d.png' % n)
            studio.render(ob, path, (cell, cell), labels=((label, 0.052, studio.ink), (sub, 0.038, studio.ink2)))
            img = bpy.data.images.load(path)
            px = np.empty(cell * cell * 4, dtype=np.float32)
            img.pixels.foreach_get(px)
            bpy.data.images.remove(img)
            r, c = divmod(n, cols)
            y0 = (rows_n - 1 - r) * cell
            sheet[y0:y0 + cell, c * cell:(c + 1) * cell] = px.reshape(cell, cell, 4)
            me = ob.data
            bpy.data.objects.remove(ob, do_unlink=True)
            bpy.data.meshes.remove(me)
        for r in range(1, rows_n):
            sheet[r * cell - 1:r * cell + 1, :, :3] = 0.22
        for c in range(1, cols):
            sheet[:, c * cell - 1:c * cell + 1, :3] = 0.22
        img = bpy.data.images.new('fittings_sheet', cols * cell, rows_n * cell, alpha=False)
        img.pixels.foreach_set(sheet.ravel())
        img.filepath_raw = out_png
        img.file_format = 'PNG'
        img.save()
        bpy.data.images.remove(img)
    finally:
        studio.close()
        shutil.rmtree(tmp, ignore_errors=True)
    print('\n%-32s %6s %7s %6s %5s %5s  %s' % ('fitting', 'tris', 'budget', 'verts', 'open', 'flip', 'materials'))
    for label, key, info, dims, mats, budget in table:
        print('%-32s %6d %7d %6d %5d %5d  %s' % (label, info['tris'], budget, info['verts'],
                                                   info['open_edges'], info['inverted_shells'] + info['bad_winding'],
                                                   ', '.join(mats)))
    print('contact sheet:', out_png)
    return table


if __name__ == '__main__':
    # -- [out.png]            first sheet (the twenty main fittings)
    # -- --batch2 [out.png]   second sheet (close-up deck and rigging hardware)
    _args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    _here = os.path.dirname(os.path.abspath(__file__))
    _dir = os.path.normpath(os.path.join(_here, '..', '..', 'artifacts', 'hesperus', 'blender'))
    if _args and _args[0] == '--batch2':
        demo(_args[1] if len(_args) > 1 else os.path.join(_dir, 'fittings-sheet-2.png'), items=DEMO_SET_2)
    else:
        demo(_args[0] if _args else os.path.join(_dir, 'fittings-sheet.png'))
