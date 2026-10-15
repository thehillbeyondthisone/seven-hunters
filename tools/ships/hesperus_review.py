"""Verification overlays and review renders for the HESPERUS (1896) Blender model.

Pure ``bpy`` + ``numpy``.  Importing this module has no side effects; nothing is
built or rendered until one of the public functions is called.

Model contract (shared with the model generator)
------------------------------------------------
* Units are metres.  +X forward (bow), +Y port, +Z up.  Origin at the aft
  perpendicular on the centreline at the keel baseline; the forward
  perpendicular is at X = 53.34; the load waterline is at Z = 3.0.
* The model lives in the scene ``Hesperus`` under a top-level collection
  ``Hesperus``.
* Everything this module adds goes into a collection called ``Review`` in the
  same scene.  That collection can be deleted at any time and is rebuilt by
  :func:`ensure_review_rig`.  Outside ``Review`` the rig only touches
  ``scene.world``, ``scene.camera`` and the render settings.

Public API
----------
``ensure_review_rig(scene)``
``render_profile_overlay(scene, out_jpg, plan_jpg=..., alpha=0.55)``
``render_plan_overlay(scene, out_jpg, sheet_jpg=..., alpha=0.55)``
``render_beauty(scene, out_dir, quality='final')``
``render_photo_match(scene, out_jpg, photo_jpg=...)``
``review_all(scene, out_dir, quality='draft')``

Command line::

    blender -b --factory-startup -P tools/ships/hesperus_review.py -- \
        --blend model.blend --out some/dir [--quality draft|final] \
        [--only overlay_profile,overlay_plan,photo_match,beauty,beauty_high,...]

Registration convention
-----------------------
The drawing calibrations are given as pixel *indices* (``px = 228 + 31.006 X``
means the point X lands on the centre of pixel column ``px``).  Internally an
image is a continuous plane whose pixel ``i`` covers ``[i, i + 1)``, so half a
pixel is added (``PIXEL_CENTRE``).  The overlay renders use one sample per
pixel at the exact pixel centre of a supersampled grid, so the model/drawing
registration is exact to a fraction of an output pixel.

The reference scans are copyright study copies.  Any output that embeds them
(the overlays and the photo match) must only be written below
``artifacts/hesperus/blender/``.
"""

import math
import os
import shutil
import sys
import tempfile
import time

import bpy
import numpy as np
from mathutils import Matrix, Vector

# --------------------------------------------------------------------------- #
# Names, paths and calibrations
# --------------------------------------------------------------------------- #

SCENE_NAME = "Hesperus"
MODEL_COLLECTION = "Hesperus"
REVIEW_COLLECTION = "Review"
PREFIX = "Review_"
TAG = "hesperus_review_rig"      # custom property marking datablocks owned by this module

SEA_LEVEL = 3.0                  # load waterline, metres above the keel baseline
X_AP, X_FP = 0.0, 53.34
NOMINAL_BOUNDS = ((-2.9, -4.27, 0.0), (53.34, 4.27, 25.6))

_HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.normpath(os.path.join(_HERE, "..", ".."))
REFERENCE_DIR = os.path.join(REPO_ROOT, "docs", "references", "hesperus")
RIGGING_PLAN_JPG = os.path.join(REFERENCE_DIR, "lr-0126-rigging-plan-1896-07-16-a.jpg")
DECK_PLANS_JPG = os.path.join(REFERENCE_DIR, "lr-0124-profile-deck-plans-corrected-1896-07-16-a.jpg")
PHOTO_JPG = os.path.join(REFERENCE_DIR, "photo-ramsey-east-quay-southward.jpg")

PIXEL_CENTRE = 0.5

# Rigging plan (starboard outboard elevation, bow right): px = x0 + s X, py = z0 - s Z
PROFILE_CAL = {"size": (2000, 1235), "px_per_m": 31.006, "x0": 228.0, "z0": 998.0}

# Profile and deck plans sheet: px = x0 + s X, py = centre -/+ s Y (symmetric).
# 'upper' is the raised-quarter-deck + bridge-deck plan (drawn above Z = 5), 'main' the main-deck plan.
PLAN_CAL = {
    "size": (2000, 1583),
    # Frame ticks on the sheet give 31.08 px/m with the aft perpendicular at px 206.8 (measurements.md 0.2);
    # the model origin is 0.21 m forward of that. The plan breadths read about 1.5 % small at this scale.
    "px_per_m": 31.08,
    "x0": 213.3,
    "centres": {"upper": 808.0, "main": 1105.0},
    "upper_min_z": 5.0,
    "band_half_px": 148,         # half height of each rendered strip; the two centrelines are 297 px apart
}

# Camera solved from eight hand-picked points on the Ramsey photograph (stem head, both
# trucks, funnel top and base, stern, bridge-deck corners); RMS residual 5.7 px on 1600 px.
# azimuth/elevation give the viewing direction (degrees, azimuth counter-clockwise from +X).
PHOTO_CAM = {
    "size": (1600, 1300),
    "location": (57.59, 94.30, 5.43),
    "azimuth": -109.13,
    "elevation": 5.12,
    "roll": 2.51,
    "focal_px": 2284.8,          # for a 1600 px wide frame (51.4 mm on a 36 mm sensor)
    "crop": (0, 290, 1600, 1010),  # x0, y0, x1, y1 of the part of the photo shown in the comparison
    "water_z": 1.7,              # the harbour water stands about 1.3 m below the load waterline
    "sun": (25.0, 40.0),         # sun bearing / elevation used for the comparison render (summer light from ahead)
}

BEAUTY_SIZE = (1920, 1200)
DEFAULT_SUN = (-95.0, 12.0)      # bearing from the ship (deg, 0 = ahead, +90 = port beam) and elevation

# bearing: where the camera stands, seen from the ship (0 = dead ahead, +90 = port beam, -90 = starboard beam).
# Give either 'eye_height' (metres above the water) or 'pitch' (degrees, negative looks down).
# margins: (left, right, top, bottom) fractions of the frame kept clear around the model.
BEAUTY_SHOTS = {
    "beauty_stbd_bow": {
        "camera": "Cam_StbdBow", "bearing": -38.0, "eye_height": 6.0, "lens": 85.0,
        "margins": (0.06, 0.06, 0.07, 0.16), "sun": (-98.0, 12.0),
    },
    "beauty_port_quarter": {
        "camera": "Cam_PortQuarter", "bearing": 146.0, "eye_height": 11.0, "lens": 70.0,
        "margins": (0.06, 0.06, 0.07, 0.15), "sun": (98.0, 12.0),
    },
    "beauty_high": {
        "camera": "Cam_High", "bearing": 52.0, "pitch": -30.0, "lens": 50.0,
        "margins": (0.05, 0.05, 0.05, 0.07), "sun": (118.0, 16.0),
    },
    "beauty_broadside": {
        "camera": "Cam_Broadside", "bearing": -90.0, "eye_height": 2.5, "lens": 200.0,
        "margins": (0.05, 0.05, 0.10, 0.20), "sun": (-48.0, 12.0),
    },
    "beauty_distant": {
        "camera": "Cam_Distant", "bearing": -56.0, "eye_height": 9.0, "lens": 50.0,
        "distance": 600.0, "place": (0.40, 0.40), "sun": (-118.0, 11.0),
    },
    "beauty_detail_bridge": {
        "camera": "Cam_DetailBridge", "bearing": -40.0, "pitch": -11.0, "lens": 100.0,
        "margins": (0.05, 0.05, 0.06, 0.06), "sun": (-88.0, 14.0),
        # bridge, funnel and boats: x0, x1, z0, z1 of the framed part of the ship
        "region": (16.0, 32.6, 5.3, 15.6),
    },
}

LAST_TIMINGS = {}                # seconds per output of the most recent calls, for reporting
DEPTH_PERIOD = 2.0               # metres; see _data_materials


# --------------------------------------------------------------------------- #
# Small utilities
# --------------------------------------------------------------------------- #

def _log(msg):
    print("[hesperus_review] " + msg)
    sys.stdout.flush()


class _Restore:
    """Remembers attribute values and puts them back (last changed, first restored)."""

    def __init__(self):
        self._items = []

    def keep(self, owner, *attrs):
        for attr in attrs:
            old = getattr(owner, attr)
            if hasattr(old, "copy") and not isinstance(old, bpy.types.ID):
                old = old.copy()
            self._items.append((owner, attr, old))

    def set(self, owner, attr, value):
        self.keep(owner, attr)
        setattr(owner, attr, value)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        for owner, attr, old in reversed(self._items):
            try:
                setattr(owner, attr, old)
            except Exception:
                pass
        self._items = []
        return False


def _load_image(path):
    """Image file -> float32 array (H, W, 4), top row first.  8-bit files keep their stored (sRGB) values."""
    if not os.path.isfile(path):
        raise FileNotFoundError("image not found: %s" % path)
    img = bpy.data.images.load(path, check_existing=False)
    try:
        w, h = img.size
        if w == 0 or h == 0:
            raise RuntimeError("could not read image: %s" % path)
        n = len(img.pixels) // (w * h)
        buf = np.empty(w * h * n, dtype=np.float32)
        img.pixels.foreach_get(buf)
    finally:
        bpy.data.images.remove(img)
    buf = buf.reshape(h, w, n)[::-1]
    if n == 4:
        return np.ascontiguousarray(buf)
    out = np.ones((h, w, 4), dtype=np.float32)
    if n == 1:
        out[..., :3] = buf
    else:
        out[..., :min(n, 3)] = buf[..., :3]
    return out


def _save_image(arr, path, quality=93):
    """Float array (H, W, 1|3|4) of display values 0..1 -> PNG or JPEG chosen by extension."""
    arr = np.asarray(arr, dtype=np.float32)
    if arr.ndim == 2:
        arr = arr[..., None]
    h, w, c = arr.shape
    rgba = np.ones((h, w, 4), dtype=np.float32)
    if c == 1:
        rgba[..., :3] = arr
    else:
        rgba[..., :c] = arr[..., :4]
    np.clip(rgba, 0.0, 1.0, out=rgba)
    ext = os.path.splitext(path)[1].lower()
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    img = bpy.data.images.new(PREFIX + "save_tmp", w, h, alpha=(c == 4))
    try:
        img.alpha_mode = "STRAIGHT"
        img.pixels.foreach_set(np.ascontiguousarray(rgba[::-1]).ravel())
        img.filepath_raw = path
        img.file_format = "PNG" if ext == ".png" else "JPEG"
        img.save(quality=quality)
    finally:
        bpy.data.images.remove(img)
    return path


def _srgb(x):
    """Scene-linear -> sRGB display encoding (plain piecewise curve, no tone mapping)."""
    x = np.clip(x, 0.0, 1.0)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1.0 / 2.4) - 0.055).astype(np.float32)


def _box_down(a, s):
    """Mean over s x s blocks."""
    a = np.asarray(a, dtype=np.float32)
    if s == 1:
        return a
    h, w = a.shape[0] // s, a.shape[1] // s
    if a.ndim == 2:
        return a[:h * s, :w * s].reshape(h, s, w, s).mean(axis=(1, 3))
    return a[:h * s, :w * s].reshape(h, s, w, s, a.shape[2]).mean(axis=(1, 3))


def _dilate(m, r):
    """Square dilation of a boolean mask by r pixels."""
    if r <= 0:
        return m
    out = m.copy()
    for k in range(1, r + 1):
        out[:, k:] |= m[:, :-k]
        out[:, :-k] |= m[:, k:]
    m2 = out.copy()
    for k in range(1, r + 1):
        out[k:, :] |= m2[:-k, :]
        out[:-k, :] |= m2[k:, :]
    return out


def _blur3(a, passes=1):
    """Small separable 1-2-1 blur."""
    a = np.asarray(a, dtype=np.float32)
    for _ in range(passes):
        b = a.copy()
        b[:, 1:-1] = 0.25 * a[:, :-2] + 0.5 * a[:, 1:-1] + 0.25 * a[:, 2:]
        a = b.copy()
        a[1:-1, :] = 0.25 * b[:-2, :] + 0.5 * b[1:-1, :] + 0.25 * b[2:, :]
    return a


# 5 x 7 bitmap font for the labels on the composites (no external font or imaging library needed).
_FONT = {
    "A": "01110 10001 10001 11111 10001 10001 10001", "B": "11110 10001 10001 11110 10001 10001 11110",
    "C": "01110 10001 10000 10000 10000 10001 01110", "D": "11110 10001 10001 10001 10001 10001 11110",
    "E": "11111 10000 10000 11110 10000 10000 11111", "F": "11111 10000 10000 11110 10000 10000 10000",
    "G": "01110 10001 10000 10111 10001 10001 01111", "H": "10001 10001 10001 11111 10001 10001 10001",
    "I": "01110 00100 00100 00100 00100 00100 01110", "J": "00111 00010 00010 00010 00010 10010 01100",
    "K": "10001 10010 10100 11000 10100 10010 10001", "L": "10000 10000 10000 10000 10000 10000 11111",
    "M": "10001 11011 10101 10101 10001 10001 10001", "N": "10001 11001 10101 10011 10001 10001 10001",
    "O": "01110 10001 10001 10001 10001 10001 01110", "P": "11110 10001 10001 11110 10000 10000 10000",
    "Q": "01110 10001 10001 10001 10101 10010 01101", "R": "11110 10001 10001 11110 10100 10010 10001",
    "S": "01111 10000 10000 01110 00001 00001 11110", "T": "11111 00100 00100 00100 00100 00100 00100",
    "U": "10001 10001 10001 10001 10001 10001 01110", "V": "10001 10001 10001 10001 10001 01010 00100",
    "W": "10001 10001 10001 10101 10101 11011 10001", "X": "10001 10001 01010 00100 01010 10001 10001",
    "Y": "10001 10001 01010 00100 00100 00100 00100", "Z": "11111 00001 00010 00100 01000 10000 11111",
    "0": "01110 10001 10011 10101 11001 10001 01110", "1": "00100 01100 00100 00100 00100 00100 01110",
    "2": "01110 10001 00001 00010 00100 01000 11111", "3": "11110 00001 00001 01110 00001 00001 11110",
    "4": "00010 00110 01010 10010 11111 00010 00010", "5": "11111 10000 11110 00001 00001 10001 01110",
    "6": "00110 01000 10000 11110 10001 10001 01110", "7": "11111 00001 00010 00100 01000 01000 01000",
    "8": "01110 10001 10001 01110 10001 10001 01110", "9": "01110 10001 10001 01111 00001 00010 01100",
    " ": "00000 00000 00000 00000 00000 00000 00000", ".": "00000 00000 00000 00000 00000 01100 01100",
    ",": "00000 00000 00000 00000 01100 00100 01000", ":": "00000 01100 01100 00000 01100 01100 00000",
    "-": "00000 00000 00000 11111 00000 00000 00000", "+": "00000 00100 00100 11111 00100 00100 00000",
    "=": "00000 00000 11111 00000 11111 00000 00000", "/": "00001 00010 00010 00100 01000 01000 10000",
    "(": "00010 00100 01000 01000 01000 00100 00010", ")": "01000 00100 00010 00010 00010 00100 01000",
    "%": "11000 11001 00010 00100 01000 10011 00011", "'": "00100 00100 01000 00000 00000 00000 00000",
    "<": "00010 00100 01000 10000 01000 00100 00010", ">": "01000 00100 00010 00001 00010 00100 01000",
    "*": "00000 10101 01110 11111 01110 10101 00000", "_": "00000 00000 00000 00000 00000 00000 11111",
}
_GLYPHS = {k: np.array([[c == "1" for c in row] for row in v.split()], dtype=bool) for k, v in _FONT.items()}


def _text_width(text, scale=2):
    return len(text) * 6 * scale


def _draw_text(img, x, y, text, color=(1.0, 1.0, 1.0), scale=2, backing=None):
    """Draws upper-case text with its top-left corner at (x, y).  backing = (r, g, b, opacity) or None."""
    text = text.upper()
    h, w = img.shape[:2]
    tw, th = _text_width(text, scale), 7 * scale
    if backing is not None:
        pad = 2 * scale
        x0, y0, x1, y1 = max(0, x - pad), max(0, y - pad), min(w, x + tw + pad - scale), min(h, y + th + pad)
        if x1 > x0 and y1 > y0:
            o = backing[3]
            img[y0:y1, x0:x1, :3] = img[y0:y1, x0:x1, :3] * (1.0 - o) + np.array(backing[:3], dtype=np.float32) * o
    cx = x
    for ch in text:
        g = _GLYPHS.get(ch, _GLYPHS[" "])
        if scale > 1:
            g = np.repeat(np.repeat(g, scale, axis=0), scale, axis=1)
        gh, gw = g.shape
        x0, y0 = max(0, cx), max(0, y)
        x1, y1 = min(w, cx + gw), min(h, y + gh)
        if x1 > x0 and y1 > y0:
            sub = g[y0 - y:y1 - y, x0 - cx:x1 - cx]
            img[y0:y1, x0:x1, :3][sub] = color
        cx += 6 * scale
    return img


def _draw_rect(img, x0, y0, x1, y1, color, opacity=1.0):
    h, w = img.shape[:2]
    x0, x1 = max(0, int(round(x0))), min(w, int(round(x1)))
    y0, y1 = max(0, int(round(y0))), min(h, int(round(y1)))
    if x1 > x0 and y1 > y0:
        img[y0:y1, x0:x1, :3] = img[y0:y1, x0:x1, :3] * (1.0 - opacity) + np.array(color, dtype=np.float32) * opacity


def _hline(img, cy, x0, x1, color, half=0.5):
    """Horizontal mark centred on the continuous image row coordinate cy."""
    _draw_rect(img, x0, cy - half, x1, cy + half, color)


def _vline(img, cx, y0, y1, color, half=0.5):
    _draw_rect(img, cx - half, y0, cx + half, y1, color)


# --------------------------------------------------------------------------- #
# The model: collection, visible points, bounds
# --------------------------------------------------------------------------- #

def _model_collection(scene, required=True):
    coll = scene.collection.children.get(MODEL_COLLECTION)
    if coll is None:
        coll = bpy.data.collections.get(MODEL_COLLECTION)
        if coll is not None and coll not in scene.collection.children_recursive:
            coll = None
    if coll is None and required:
        raise RuntimeError("scene %r has no collection %r to review" % (scene.name, MODEL_COLLECTION))
    return coll


def _view_layer(scene):
    return scene.view_layers[0]


def _model_points(scene):
    """World-space vertices of everything under the model collection, as rendered (modifiers and
    instances applied), reduced to the points that matter for framing.  Returns (N, 3) float64."""
    coll = _model_collection(scene, required=False)
    if coll is None:
        return None
    members = {o.name for o in coll.all_objects}
    if not members:
        return None
    vl = _view_layer(scene)
    vl.update()
    dg = vl.depsgraph
    chunks = []
    for inst in dg.object_instances:
        ob = inst.object
        src = inst.parent if inst.is_instance and inst.parent is not None else ob
        orig = src.original
        if orig.name not in members or orig.hide_render:
            continue
        mw = np.array(inst.matrix_world, dtype=np.float64)
        co = None
        if ob.type == "MESH":
            me = ob.data
            n = len(me.vertices)
            if n:
                co = np.empty(n * 3, dtype=np.float32)
                me.vertices.foreach_get("co", co)
        elif ob.type in {"CURVE", "SURFACE", "FONT", "META"}:
            try:
                me = ob.to_mesh()
                n = len(me.vertices) if me else 0
                if n:
                    co = np.empty(n * 3, dtype=np.float32)
                    me.vertices.foreach_get("co", co)
                ob.to_mesh_clear()
            except Exception:
                co = None
        if co is None:
            if ob.type in {"CURVES", "POINTCLOUD", "VOLUME", "GREASEPENCIL"}:
                co = np.array([c[:] for c in ob.bound_box], dtype=np.float32).ravel()
            else:
                continue
        co = co.reshape(-1, 3).astype(np.float64)
        chunks.append(co @ mw[:3, :3].T + mw[:3, 3])
    if not chunks:
        return None
    return np.concatenate(chunks, axis=0)


def _support_points(pts, n_dirs=1500):
    """Reduces a point cloud to (approximately) its convex-hull vertices: enough for exact framing."""
    if pts is None or len(pts) <= 4000:
        return pts
    k = np.arange(n_dirs) + 0.5
    phi = np.arccos(1.0 - 2.0 * k / n_dirs)
    th = math.pi * (1.0 + 5.0 ** 0.5) * k
    dirs = np.stack([np.cos(th) * np.sin(phi), np.sin(th) * np.sin(phi), np.cos(phi)], axis=1)
    idx = set()
    lo, hi = pts.min(axis=0), pts.max(axis=0)
    for a in range(3):
        idx.add(int(pts[:, a].argmin()))
        idx.add(int(pts[:, a].argmax()))
    best = np.full(n_dirs, -np.inf)
    best_i = np.zeros(n_dirs, dtype=np.int64)
    step = max(1, 4_000_000 // n_dirs)
    centre = 0.5 * (lo + hi)
    for s in range(0, len(pts), step):
        d = (pts[s:s + step] - centre) @ dirs.T
        i = d.argmax(axis=0)
        v = d[i, np.arange(n_dirs)]
        better = v > best
        best[better] = v[better]
        best_i[better] = i[better] + s
    idx.update(int(i) for i in best_i)
    return pts[sorted(idx)]


def _model_bounds(pts):
    if pts is None or not len(pts):
        return np.array(NOMINAL_BOUNDS[0]), np.array(NOMINAL_BOUNDS[1])
    return pts.min(axis=0), pts.max(axis=0)


def _nominal_points():
    lo, hi = NOMINAL_BOUNDS
    return np.array([(x, y, z) for x in (lo[0], hi[0]) for y in (lo[1], hi[1]) for z in (lo[2], hi[2])], dtype=np.float64)


# --------------------------------------------------------------------------- #
# Node helpers
# --------------------------------------------------------------------------- #

def _set_in(nt, sock, value):
    if isinstance(value, bpy.types.NodeSocket):
        nt.links.new(value, sock)
    elif value is not None:
        sock.default_value = value


def _math(nt, op, a, b=None, c=None, clamp=False):
    n = nt.nodes.new("ShaderNodeMath")
    n.operation = op
    n.use_clamp = clamp
    _set_in(nt, n.inputs[0], a)
    _set_in(nt, n.inputs[1], b)
    _set_in(nt, n.inputs[2], c)
    return n.outputs[0]


def _vmath(nt, op, a, b=None, scale=None):
    n = nt.nodes.new("ShaderNodeVectorMath")
    n.operation = op
    _set_in(nt, n.inputs[0], a)
    _set_in(nt, n.inputs[1], b)
    if scale is not None:
        _set_in(nt, n.inputs[3], scale)
    return n.outputs["Value"] if op in {"DOT_PRODUCT", "LENGTH", "DISTANCE"} else n.outputs["Vector"]


def _col(c):
    return (c[0], c[1], c[2], 1.0)


def _mix(nt, fac, a, b, blend="MIX"):
    """Colour mix (a -> b by fac)."""
    n = nt.nodes.new("ShaderNodeMix")
    n.data_type = "RGBA"
    n.blend_type = blend
    n.clamp_factor = True
    _set_in(nt, n.inputs[0], fac)
    _set_in(nt, n.inputs[6], _col(a) if isinstance(a, (tuple, list)) else a)
    _set_in(nt, n.inputs[7], _col(b) if isinstance(b, (tuple, list)) else b)
    return n.outputs[2]


def _map_range(nt, value, from_min, from_max, to_min=0.0, to_max=1.0, interp="LINEAR"):
    n = nt.nodes.new("ShaderNodeMapRange")
    n.data_type = "FLOAT"
    n.interpolation_type = interp
    n.clamp = True
    _set_in(nt, n.inputs[0], value)
    n.inputs[1].default_value = from_min
    n.inputs[2].default_value = from_max
    n.inputs[3].default_value = to_min
    n.inputs[4].default_value = to_max
    return n.outputs[0]


def _noise(nt, vector, scale, detail=2.0, roughness=0.5, distortion=0.0, dims="3D"):
    n = nt.nodes.new("ShaderNodeTexNoise")
    n.noise_dimensions = dims
    _set_in(nt, n.inputs["Vector"], vector)
    n.inputs["Scale"].default_value = scale
    n.inputs["Detail"].default_value = detail
    n.inputs["Roughness"].default_value = roughness
    n.inputs["Distortion"].default_value = distortion
    return n.outputs[0]


def _tag(idblock):
    idblock[TAG] = 1
    return idblock


# --------------------------------------------------------------------------- #
# Sky (shared by the world and by the far sea), sea, sun
# --------------------------------------------------------------------------- #

SKY = {
    "zenith": (0.13, 0.22, 0.40),
    "horizon": (0.50, 0.64, 0.80),
    "cloud_light": (0.98, 0.93, 0.86),
    "cloud_dark": (0.19, 0.22, 0.28),
    "haze": (0.90, 0.87, 0.82),
    "glow": (1.00, 0.78, 0.52),
    "below": (0.26, 0.31, 0.32),
    "strength": 1.0,
}
SUN_COLOR = (1.0, 0.84, 0.66)
SUN_STRENGTH = 4.2
SEA_COLOR = (0.020, 0.044, 0.040)
EXPOSURE = 0.2


def _build_sky_group():
    """Node group Review_Sky: direction (sky space, sun azimuth along +X) -> radiance."""
    ng = bpy.data.node_groups.new(PREFIX + "Sky", "ShaderNodeTree")
    _tag(ng)
    ng.interface.new_socket("Vector", in_out="INPUT", socket_type="NodeSocketVector")
    ng.interface.new_socket("Color", in_out="OUTPUT", socket_type="NodeSocketColor")
    gi = ng.nodes.new("NodeGroupInput")
    go = ng.nodes.new("NodeGroupOutput")

    d = _vmath(ng, "NORMALIZE", gi.outputs[0])
    sep = ng.nodes.new("ShaderNodeSeparateXYZ")
    ng.links.new(d, sep.inputs[0])
    z = sep.outputs["Z"]
    za = _math(ng, "ABSOLUTE", z)
    comb = ng.nodes.new("ShaderNodeCombineXYZ")
    ng.links.new(sep.outputs["X"], comb.inputs["X"])
    ng.links.new(sep.outputs["Y"], comb.inputs["Y"])
    ng.links.new(za, comb.inputs["Z"])
    dm = comb.outputs[0]                               # mirrored below the horizon

    sun = ng.nodes.new("ShaderNodeCombineXYZ")
    sun.name = "SunDir"
    sun.inputs[0].default_value = math.cos(math.radians(DEFAULT_SUN[1]))
    sun.inputs[2].default_value = math.sin(math.radians(DEFAULT_SUN[1]))
    mu = _math(ng, "MAXIMUM", _vmath(ng, "DOT_PRODUCT", dm, sun.outputs[0]), 0.0)
    glow_wide = _math(ng, "POWER", mu, 3.0)
    glow_tight = _math(ng, "POWER", mu, 28.0)

    # clear-sky gradient
    grad = _math(ng, "POWER", za, 0.55)
    base = _mix(ng, grad, SKY["horizon"], SKY["zenith"])

    # cloud deck: noise on a flat layer seen in perspective, so it streaks toward the horizon
    inv = _math(ng, "DIVIDE", 1.0, _math(ng, "ADD", za, 0.10))
    uv = _vmath(ng, "MULTIPLY", dm, None)
    uvn = ng.nodes.new("ShaderNodeCombineXYZ")
    ng.links.new(_math(ng, "MULTIPLY", sep.outputs["X"], inv), uvn.inputs["X"])
    ng.links.new(_math(ng, "MULTIPLY", sep.outputs["Y"], inv), uvn.inputs["Y"])
    uv = uvn.outputs[0]
    n1 = _noise(ng, uv, 0.55, detail=7.0, roughness=0.58, distortion=0.35)
    n2 = _noise(ng, _vmath(ng, "ADD", uv, (11.3, 4.7, 0.0)), 1.9, detail=5.0, roughness=0.6, distortion=0.2)
    cover = _map_range(ng, n1, 0.43, 0.62, 0.0, 1.0, "SMOOTHSTEP")
    body = _map_range(ng, _math(ng, "MULTIPLY_ADD", n1, 0.6, _math(ng, "MULTIPLY", n2, 0.4)), 0.46, 0.68, 0.0, 1.0, "SMOOTHSTEP")
    # thin cloud and cloud edges are bright and warm in the low sun; thick cloud is slate grey
    lit = _math(ng, "SUBTRACT", _math(ng, "MULTIPLY_ADD", glow_wide, 0.40, 0.92), _math(ng, "MULTIPLY", body, 0.85), clamp=True)
    cloud = _mix(ng, lit, SKY["cloud_dark"], SKY["cloud_light"])
    sky = _mix(ng, _math(ng, "MULTIPLY", cover, 0.96), base, cloud)

    # warm light toward the sun, pale haze band along the horizon
    warm = ng.nodes.new("ShaderNodeVectorMath")
    warm.operation = "SCALE"
    warm.inputs[0].default_value = SKY["glow"]
    ng.links.new(_math(ng, "MULTIPLY_ADD", glow_tight, 1.5, _math(ng, "MULTIPLY", glow_wide, 0.35)), warm.inputs[3])
    sky = _mix(ng, 1.0, sky, warm.outputs[0], blend="ADD")
    hz = _math(ng, "POWER", 2.718281828, _math(ng, "MULTIPLY", za, -24.0))
    haze_col = _mix(ng, _math(ng, "MULTIPLY", glow_wide, 0.8, clamp=True), SKY["haze"], SKY["glow"])
    sky = _mix(ng, _math(ng, "MULTIPLY", hz, 0.78), sky, haze_col)

    # below the horizon: a dim, greenish mirror of the sky (what the sea sends back up)
    is_below = _math(ng, "LESS_THAN", z, 0.0)
    lower = _mix(ng, 1.0, sky, SKY["below"], blend="MULTIPLY")
    out = _mix(ng, is_below, sky, lower)
    ng.links.new(out, go.inputs[0])
    return ng


def _build_world(scene, sky_group):
    world = bpy.data.worlds.new(PREFIX + "World")
    _tag(world)
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.name = "SkyRotation"
    mp.vector_type = "POINT"
    nt.links.new(tc.outputs["Generated"], mp.inputs["Vector"])
    grp = nt.nodes.new("ShaderNodeGroup")
    grp.node_tree = sky_group
    nt.links.new(mp.outputs[0], grp.inputs[0])
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = SKY["strength"]
    nt.links.new(grp.outputs[0], bg.inputs["Color"])
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(bg.outputs[0], out.inputs["Surface"])
    try:
        world.use_sun_shadow = False
        world.probe_resolution = "1024"
    except Exception:
        pass
    return world


def _build_sea_material(sky_group):
    mat = bpy.data.materials.new(PREFIX + "Sea")
    _tag(mat)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    cam = nt.nodes.new("ShaderNodeCameraData")
    dist = cam.outputs["View Distance"]
    far = _map_range(nt, dist, 60.0, 3000.0, 0.0, 1.0, "SMOOTHERSTEP")

    # wave field: long-crested swell, wind sea, ripples.  Heights in metres for the bump node.
    wind = nt.nodes.new("ShaderNodeMapping")
    wind.vector_type = "POINT"
    wind.inputs["Rotation"].default_value = (0.0, 0.0, math.radians(28.0))
    nt.links.new(geo.outputs["Position"], wind.inputs["Vector"])
    stretch = nt.nodes.new("ShaderNodeMapping")
    stretch.vector_type = "POINT"
    stretch.inputs["Scale"].default_value = (1.0, 0.38, 1.0)
    nt.links.new(wind.outputs[0], stretch.inputs["Vector"])
    swell = _noise(nt, stretch.outputs[0], 0.060, detail=2.0, roughness=0.45, dims="2D")
    chop = _noise(nt, stretch.outputs[0], 0.42, detail=3.0, roughness=0.55, distortion=0.25, dims="2D")
    ripple = _noise(nt, wind.outputs[0], 2.6, detail=3.0, roughness=0.6, dims="2D")
    height = _math(nt, "ADD", _math(nt, "MULTIPLY", swell, 1.80),
                   _math(nt, "ADD", _math(nt, "MULTIPLY", chop, 0.42), _math(nt, "MULTIPLY", ripple, 0.055)))
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Distance"].default_value = 1.0
    nt.links.new(height, bump.inputs["Height"])
    nt.links.new(_math(nt, "SUBTRACT", 1.0, far, clamp=True), bump.inputs["Strength"])

    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    # the troughs between swells read a little deeper in colour than the crests
    tone = _mix(nt, _map_range(nt, swell, 0.30, 0.70), tuple(c * 0.75 for c in SEA_COLOR), tuple(c * 1.35 for c in SEA_COLOR))
    nt.links.new(tone, bsdf.inputs["Base Color"])
    bsdf.inputs["IOR"].default_value = 1.333
    nt.links.new(_math(nt, "MULTIPLY_ADD", far, 0.32, 0.07), bsdf.inputs["Roughness"])
    # Of a rough sea one mostly sees the wave faces that lean toward the eye, which is why it is
    # darker than the sky above it: lean the shading normal toward the viewer, more with distance.
    toward = _vmath(nt, "NORMALIZE", _vmath(nt, "MULTIPLY", geo.outputs["Incoming"], (1.0, 1.0, 0.0)))
    lean = _vmath(nt, "SCALE", toward, scale=_math(nt, "MULTIPLY_ADD", far, 0.13, 0.05))
    normal = _vmath(nt, "NORMALIZE", _vmath(nt, "ADD", bump.outputs[0], lean))
    nt.links.new(normal, bsdf.inputs["Normal"])

    # distance haze toward the sky colour just above the horizon in the viewing direction
    look = _vmath(nt, "SCALE", geo.outputs["Incoming"], scale=-1.0)
    flat = _vmath(nt, "MULTIPLY", look, (1.0, 1.0, 0.0))
    flat = _vmath(nt, "ADD", flat, (0.0, 0.0, 0.012))
    rot = nt.nodes.new("ShaderNodeMapping")
    rot.name = "SkyRotation"
    rot.vector_type = "POINT"
    nt.links.new(flat, rot.inputs["Vector"])
    grp = nt.nodes.new("ShaderNodeGroup")
    grp.node_tree = sky_group
    nt.links.new(rot.outputs[0], grp.inputs[0])
    haze = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(grp.outputs[0], haze.inputs["Color"])
    haze.inputs["Strength"].default_value = SKY["strength"]
    fog = _math(nt, "SUBTRACT", 1.0, _math(nt, "POWER", 2.718281828, _math(nt, "MULTIPLY", dist, -1.0 / 14000.0)), clamp=True)
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(fog, mix.inputs[0])
    nt.links.new(bsdf.outputs[0], mix.inputs[1])
    nt.links.new(haze.outputs[0], mix.inputs[2])
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    mat.diffuse_color = (SEA_COLOR[0] * 3, SEA_COLOR[1] * 3, SEA_COLOR[2] * 3, 1.0)
    mat.roughness = 0.2
    return mat


def _sun_vector(bearing_deg, elevation_deg):
    az, el = math.radians(bearing_deg), math.radians(elevation_deg)
    return Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)))


def _set_sun(scene, bearing_deg, elevation_deg):
    """Points the key light, and turns the sky (and its reflection haze on the sea) with it."""
    coll = scene.collection.children.get(REVIEW_COLLECTION)
    sun = coll.objects.get(PREFIX + "Sun") if coll else None
    if sun is not None:
        sun.rotation_mode = "QUATERNION"
        sun.rotation_quaternion = _sun_vector(bearing_deg, elevation_deg).to_track_quat("Z", "Y")
    rot = (0.0, 0.0, -math.radians(bearing_deg))
    world = scene.world
    if world is not None and world.get(TAG) and world.node_tree:
        node = world.node_tree.nodes.get("SkyRotation")
        if node:
            node.inputs["Rotation"].default_value = rot
    sea = bpy.data.materials.get(PREFIX + "Sea")
    if sea is not None and sea.node_tree:
        node = sea.node_tree.nodes.get("SkyRotation")
        if node:
            node.inputs["Rotation"].default_value = rot
    sky = bpy.data.node_groups.get(PREFIX + "Sky")
    if sky is not None:
        node = sky.nodes.get("SunDir")
        if node:
            node.inputs[0].default_value = math.cos(math.radians(elevation_deg))
            node.inputs[1].default_value = 0.0
            node.inputs[2].default_value = math.sin(math.radians(elevation_deg))
    if coll is not None:
        coll[PREFIX + "sun"] = (float(bearing_deg), float(elevation_deg))


def _get_sun(scene):
    coll = scene.collection.children.get(REVIEW_COLLECTION)
    try:
        v = coll[PREFIX + "sun"]
        return float(v[0]), float(v[1])
    except Exception:
        return DEFAULT_SUN


# --------------------------------------------------------------------------- #
# Cameras
# --------------------------------------------------------------------------- #

def _basis_from_angles(azimuth_deg, elevation_deg, roll_deg=0.0):
    """right, up, forward for a camera looking along azimuth/elevation (degrees), Z up."""
    az, el, roll = math.radians(azimuth_deg), math.radians(elevation_deg), math.radians(roll_deg)
    f = np.array([math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)])
    r = np.cross(f, [0.0, 0.0, 1.0])
    r /= np.linalg.norm(r)
    u = np.cross(r, f)
    c, s = math.cos(roll), math.sin(roll)
    return c * r + s * u, -s * r + c * u, f


def _set_camera_pose(cam, location, right, up, forward):
    m = Matrix((
        (right[0], up[0], -forward[0], location[0]),
        (right[1], up[1], -forward[1], location[1]),
        (right[2], up[2], -forward[2], location[2]),
        (0.0, 0.0, 0.0, 1.0),
    ))
    cam.rotation_mode = "XYZ"
    cam.matrix_world = m


def _fit_frustum(pts, right, up, fwd, tan_x, tan_y, margins=(0.05, 0.05, 0.05, 0.05)):
    """Closest camera position (for a fixed orientation) from which every point is inside the frame
    with the given (left, right, top, bottom) margins.  Returns the location."""
    ml, mr, mt, mb = margins
    txl, txr = tan_x * (1.0 - 2.0 * ml), tan_x * (1.0 - 2.0 * mr)
    tyt, tyb = tan_y * (1.0 - 2.0 * mt), tan_y * (1.0 - 2.0 * mb)
    u, v, w = pts @ right, pts @ up, pts @ fwd
    a1, a2 = np.max(u - txr * w), np.min(u + txl * w)
    b1, b2 = np.max(v - tyt * w), np.min(v + tyb * w)
    d = min((a2 - a1) / (txl + txr), (b2 - b1) / (tyt + tyb))
    a = 0.5 * ((a1 + txr * d) + (a2 - txl * d))
    b = 0.5 * ((b1 + tyt * d) + (b2 - tyb * d))
    return a * right + b * up + d * fwd


def _camera_tangents(lens, sensor_width, res):
    tan_x = 0.5 * sensor_width / lens
    return tan_x, tan_x * res[1] / res[0]


def _solve_shot(shot, pts, sea_level, res):
    """Camera pose (location, right, up, forward) for one beauty shot, framed on the points."""
    tan_x, tan_y = _camera_tangents(shot["lens"], 36.0, res)
    bearing = shot["bearing"]
    look_az = bearing + 180.0
    lo, hi = pts.min(axis=0), pts.max(axis=0)

    if "distance" in shot:
        # fixed stand-off: put the ship's waterline centre at a chosen place in the frame
        centre = np.array([0.5 * (lo[0] + hi[0]), 0.5 * (lo[1] + hi[1]), sea_level])
        b = math.radians(bearing)
        loc = centre + shot["distance"] * np.array([math.cos(b), math.sin(b), 0.0])
        loc[2] = sea_level + shot["eye_height"]
        to = centre - loc
        az = math.degrees(math.atan2(to[1], to[0]))
        el = math.degrees(math.atan2(to[2], math.hypot(to[0], to[1])))
        px, py = shot.get("place", (0.5, 0.45))        # fractions from the left / from the bottom
        az -= math.degrees(math.atan((0.5 - px) * 2.0 * tan_x))
        el += math.degrees(math.atan((0.5 - py) * 2.0 * tan_y))
        r, u, f = _basis_from_angles(az, el)
        return loc, r, u, f

    margins = shot.get("margins", (0.05, 0.05, 0.05, 0.05))
    if "pitch" in shot:
        r, u, f = _basis_from_angles(look_az, shot["pitch"])
        return _fit_frustum(pts, r, u, f, tan_x, tan_y, margins), r, u, f

    # fixed eye height: find the pitch at which the tightest framing puts the camera at that height
    target = sea_level + shot["eye_height"]
    lo_p, hi_p = -35.0, 25.0

    def height(p):
        r_, u_, f_ = _basis_from_angles(look_az, p)
        return _fit_frustum(pts, r_, u_, f_, tan_x, tan_y, margins)[2]

    for _ in range(40):
        mid = 0.5 * (lo_p + hi_p)
        if height(mid) > target:        # camera too high -> look less steeply down
            lo_p = mid
        else:
            hi_p = mid
    pitch = 0.5 * (lo_p + hi_p)
    r, u, f = _basis_from_angles(look_az, pitch)
    return _fit_frustum(pts, r, u, f, tan_x, tan_y, margins), r, u, f


def _shot_points(shot, pts, sea_level):
    """Points a shot has to keep in frame: the model above the water (or the named region of it)."""
    p = pts.copy()
    p[:, 2] = np.maximum(p[:, 2], sea_level)
    region = shot.get("region")
    if region is not None:
        x0, x1, z0, z1 = region
        sel = (p[:, 0] >= x0) & (p[:, 0] <= x1) & (p[:, 2] >= z0) & (p[:, 2] <= z1)
        if sel.sum() >= 8:
            p = p[sel]
        else:
            ylo, yhi = pts[:, 1].min(), pts[:, 1].max()
            p = np.array([(x, y, z) for x in (x0, x1) for y in (ylo, yhi) for z in (z0, z1)], dtype=np.float64)
    return p


def _new_camera(coll, name, **data_props):
    data = bpy.data.cameras.new(PREFIX + name)
    _tag(data)
    for k, v in data_props.items():
        setattr(data, k, v)
    ob = bpy.data.objects.new(PREFIX + name, data)
    _tag(ob)
    coll.objects.link(ob)
    return ob


def _place_ortho(cam, view, px_per_m, origin_px, window):
    """Registers an orthographic camera to a drawing.

    view: 'side' looks from starboard toward +Y (image right = +X, image up = +Z);
          'top' looks down (image right = +X, image up = +Y).
    origin_px: continuous image coordinates (x, y) of the model origin (X = 0 and Z = 0 or Y = 0).
    window: (x0, y0, w, h) pixel rectangle of the drawing that the camera frame covers.
    """
    x0, y0, w, h = window
    cx = (x0 + 0.5 * w - origin_px[0]) / px_per_m          # model X at the frame centre
    cv = (origin_px[1] - (y0 + 0.5 * h)) / px_per_m        # model Z (side) or Y (top) at the frame centre
    data = cam.data
    data.type = "ORTHO"
    data.sensor_fit = "HORIZONTAL"
    data.ortho_scale = w / px_per_m
    data.shift_x = data.shift_y = 0.0
    cam.rotation_mode = "XYZ"
    if view == "side":
        cam.location = (cx, -200.0, cv)
        cam.rotation_euler = (math.radians(90.0), 0.0, 0.0)
    else:
        cam.location = (cx, cv, 200.0)
        cam.rotation_euler = (0.0, 0.0, 0.0)
    cam["res_x"], cam["res_y"] = int(w), int(h)


def _profile_origin(scale=1.0):
    c = PROFILE_CAL
    return ((c["x0"] + PIXEL_CENTRE) * scale, (c["z0"] + PIXEL_CENTRE) * scale), c["px_per_m"] * scale


def _plan_origin(which, scale=1.0):
    c = PLAN_CAL
    return ((c["x0"] + PIXEL_CENTRE) * scale, (c["centres"][which] + PIXEL_CENTRE) * scale), c["px_per_m"] * scale


def _plan_window(which, scale=1.0):
    c = PLAN_CAL
    half = int(round(c["band_half_px"] * scale))
    cy = int(round((c["centres"][which] + PIXEL_CENTRE) * scale))
    w, h = int(round(c["size"][0] * scale)), int(round(c["size"][1] * scale))
    y0, y1 = max(0, cy - half), min(h, cy + half)
    return (0, y0, w, y1 - y0)


def _place_photo_camera(cam, width=None):
    pc = PHOTO_CAM
    width = width or pc["size"][0]
    r, u, f = _basis_from_angles(pc["azimuth"], pc["elevation"], pc["roll"])
    _set_camera_pose(cam, pc["location"], r, u, f)
    d = cam.data
    d.type = "PERSP"
    d.sensor_fit = "HORIZONTAL"
    d.sensor_width = 36.0
    d.lens = pc["focal_px"] / pc["size"][0] * 36.0
    d.shift_x = d.shift_y = 0.0
    d.clip_start, d.clip_end = 1.0, 150000.0
    cam["res_x"], cam["res_y"] = pc["size"]


def _place_beauty_cameras(scene, pts=None, names=None):
    """(Re)frames the beauty cameras on the model.  Returns {shot name: camera object}."""
    coll = scene.collection.children[REVIEW_COLLECTION]
    if pts is None:
        pts = _support_points(_model_points(scene))
    if pts is None:
        pts = _nominal_points()
    out = {}
    for name, shot in BEAUTY_SHOTS.items():
        if names is not None and name not in names:
            continue
        cam = coll.objects.get(PREFIX + shot["camera"])
        if cam is None:
            continue
        loc, r, u, f = _solve_shot(shot, _shot_points(shot, pts, SEA_LEVEL), SEA_LEVEL, BEAUTY_SIZE)
        _set_camera_pose(cam, loc, r, u, f)
        d = cam.data
        d.type = "PERSP"
        d.sensor_fit = "HORIZONTAL"
        d.sensor_width = 36.0
        d.lens = shot["lens"]
        d.clip_start, d.clip_end = 0.5, 150000.0
        cam["res_x"], cam["res_y"] = BEAUTY_SIZE
        out[name] = cam
    return out


# --------------------------------------------------------------------------- #
# Render settings
# --------------------------------------------------------------------------- #

def _apply_beauty_settings(scene, quality="final"):
    final = quality == "final"
    r, e = scene.render, scene.eevee
    r.engine = "BLENDER_EEVEE"
    r.resolution_x, r.resolution_y = BEAUTY_SIZE
    r.resolution_percentage = 100 if final else 50
    r.pixel_aspect_x = r.pixel_aspect_y = 1.0
    r.use_border = False
    r.film_transparent = False
    r.filter_size = 1.5
    r.use_freestyle = False
    r.use_motion_blur = False
    r.use_compositing = False
    r.use_sequencer = False
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGB"
    r.image_settings.color_depth = "8"
    r.image_settings.compression = 30

    e.taa_render_samples = 96 if final else 24
    e.use_shadows = True
    e.shadow_ray_count = 3 if final else 1
    e.shadow_step_count = 8 if final else 6
    e.shadow_resolution_scale = 1.0
    e.use_raytracing = True
    e.ray_tracing_method = "SCREEN"
    o = e.ray_tracing_options
    o.resolution_scale = "1" if final else "2"
    o.trace_max_roughness = 0.5
    o.screen_trace_quality = 0.5 if final else 0.25
    o.screen_trace_thickness = 0.5
    o.use_denoise = True
    e.use_fast_gi = True
    e.fast_gi_method = "GLOBAL_ILLUMINATION"
    e.fast_gi_resolution = "1" if final else "2"
    e.fast_gi_ray_count = 3 if final else 2
    e.fast_gi_step_count = 12 if final else 8
    e.fast_gi_quality = 0.5 if final else 0.25
    e.fast_gi_thickness_near = 0.25
    e.use_overscan = True
    e.overscan_size = 5.0

    scene.display_settings.display_device = "sRGB"
    vs = scene.view_settings
    vs.view_transform = "AgX"
    try:
        vs.look = "AgX - Medium High Contrast"
    except Exception:
        vs.look = "None"
    vs.exposure = EXPOSURE
    vs.gamma = 1.0
    vs.use_curve_mapping = False


_RENDER_ATTRS = ("engine", "resolution_x", "resolution_y", "resolution_percentage", "pixel_aspect_x", "pixel_aspect_y",
                 "use_border", "use_crop_to_border", "film_transparent", "filter_size", "use_freestyle", "use_motion_blur",
                 "use_compositing", "use_sequencer", "filepath", "dither_intensity", "use_file_extension")
_IMAGE_ATTRS = ("file_format", "color_mode", "color_depth", "compression", "quality", "exr_codec")
_EEVEE_ATTRS = ("taa_render_samples", "use_shadows", "shadow_ray_count", "shadow_step_count", "shadow_resolution_scale",
                "use_raytracing", "ray_tracing_method", "use_fast_gi", "fast_gi_method", "fast_gi_resolution",
                "fast_gi_ray_count", "fast_gi_step_count", "fast_gi_quality", "fast_gi_thickness_near",
                "use_overscan", "overscan_size")
_RT_ATTRS = ("resolution_scale", "trace_max_roughness", "screen_trace_quality", "screen_trace_thickness", "use_denoise")
_VIEW_ATTRS = ("view_transform", "look", "exposure", "gamma", "use_curve_mapping")


def _guard_render_state(scene):
    """A _Restore that already remembers every scene setting the render functions change."""
    g = _Restore()
    g.keep(scene, "camera")
    g.keep(scene.render, *_RENDER_ATTRS)
    # file_format first on restore so that depth/mode values are valid for it
    g.keep(scene.render.image_settings, *reversed(_IMAGE_ATTRS))
    g.keep(scene.eevee, *_EEVEE_ATTRS)
    g.keep(scene.eevee.ray_tracing_options, *_RT_ATTRS)
    g.keep(scene.view_settings, *reversed(_VIEW_ATTRS))
    vl = _view_layer(scene)
    g.keep(vl, "material_override", "world_override", "use_freestyle")
    return g


def _render_to(scene, path):
    scene.render.filepath = path
    scene.render.use_file_extension = False
    bpy.ops.render.render(write_still=True, scene=scene.name)
    if not os.path.isfile(path):
        raise RuntimeError("render did not produce %s" % path)
    return path


# --------------------------------------------------------------------------- #
# The rig
# --------------------------------------------------------------------------- #

def _review_collection(scene, create=True):
    coll = scene.collection.children.get(REVIEW_COLLECTION)
    if coll is None and create:
        coll = bpy.data.collections.get(REVIEW_COLLECTION)
        if coll is None:
            coll = bpy.data.collections.new(REVIEW_COLLECTION)
        scene.collection.children.link(coll)
    return coll


def _purge_owned():
    """Removes this module's unused datablocks so that a rebuild reuses the plain names."""
    for store in (bpy.data.meshes, bpy.data.cameras, bpy.data.lights, bpy.data.materials, bpy.data.worlds,
                  bpy.data.node_groups):
        for block in list(store):
            if block.get(TAG) and block.name.startswith(PREFIX):
                if store is bpy.data.node_groups and block.users > 0:
                    continue
                if store in (bpy.data.meshes, bpy.data.cameras, bpy.data.lights) and block.users > 0:
                    continue
                store.remove(block)


def ensure_review_rig(scene):
    """Builds (or rebuilds from scratch) the ``Review`` collection: sea, key light, sky and cameras.

    Safe to call repeatedly; the result is always the same.  Nothing outside ``Review`` is
    touched except ``scene.world``, ``scene.camera`` and the render settings.  Returns the collection.
    """
    coll = _review_collection(scene)
    for ob in list(coll.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for child in list(coll.children):
        coll.children.unlink(child)
    old_world = scene.world
    if old_world is not None and old_world.get(TAG):
        scene.world = None
    _purge_owned()

    # sea
    sky = _build_sky_group()
    sea_me = bpy.data.meshes.new(PREFIX + "Sea")
    _tag(sea_me)
    half = 60000.0
    sea_me.from_pydata([(-half, -half, 0.0), (half, -half, 0.0), (half, half, 0.0), (-half, half, 0.0)], [], [(0, 1, 2, 3)])
    sea_me.materials.append(_build_sea_material(sky))
    sea_me.update()
    sea = bpy.data.objects.new(PREFIX + "Sea", sea_me)
    _tag(sea)
    sea.location = (25.0, 0.0, SEA_LEVEL)
    sea.visible_shadow = False
    sea.hide_select = True
    coll.objects.link(sea)

    # key light
    sun_d = bpy.data.lights.new(PREFIX + "Sun", "SUN")
    _tag(sun_d)
    sun_d.energy = SUN_STRENGTH
    sun_d.color = SUN_COLOR
    sun_d.angle = math.radians(5.0)
    sun_d.use_shadow = True
    try:
        sun_d.use_shadow_jitter = True
        sun_d.shadow_jitter_overblur = 4.0
        sun_d.shadow_filter_radius = 1.5
    except Exception:
        pass
    sun = bpy.data.objects.new(PREFIX + "Sun", sun_d)
    _tag(sun)
    sun.location = (25.0, 0.0, 60.0)
    sun.hide_select = True
    coll.objects.link(sun)

    # sky
    scene.world = _build_world(scene, sky)
    _set_sun(scene, *DEFAULT_SUN)

    # cameras
    cam_profile = _new_camera(coll, "Cam_Profile", clip_start=1.0, clip_end=1000.0)
    origin, s = _profile_origin()
    _place_ortho(cam_profile, "side", s, origin, (0, 0) + PROFILE_CAL["size"])
    for which, name in (("upper", "Cam_PlanUpper"), ("main", "Cam_PlanMain")):
        cam = _new_camera(coll, name, clip_start=1.0, clip_end=1000.0)
        origin, s = _plan_origin(which)
        _place_ortho(cam, "top", s, origin, _plan_window(which))
        if which == "upper":
            cam.data.clip_end = cam.location.z - PLAN_CAL["upper_min_z"]
    for shot in BEAUTY_SHOTS.values():
        _new_camera(coll, shot["camera"])
    _place_beauty_cameras(scene)
    _place_photo_camera(_new_camera(coll, "Cam_PhotoMatch"))
    for ob in coll.objects:
        if ob.type == "CAMERA":
            ob.hide_select = True

    scene.camera = coll.objects[PREFIX + BEAUTY_SHOTS["beauty_stbd_bow"]["camera"]]
    _apply_beauty_settings(scene, "final")
    coll[TAG] = 1
    return coll


def _rig(scene):
    """The Review collection, built first if it is missing or incomplete."""
    coll = _review_collection(scene, create=False)
    needed = [PREFIX + "Sea", PREFIX + "Sun", PREFIX + "Cam_Profile", PREFIX + "Cam_PlanUpper", PREFIX + "Cam_PlanMain",
              PREFIX + "Cam_PhotoMatch"] + [PREFIX + s["camera"] for s in BEAUTY_SHOTS.values()]
    if coll is None or any(coll.objects.get(n) is None for n in needed) or scene.world is None or not scene.world.get(TAG):
        coll = ensure_review_rig(scene)
    return coll


# --------------------------------------------------------------------------- #
# Data renders and feature edges
# --------------------------------------------------------------------------- #

def _data_materials():
    """Two emission materials used as view-layer overrides: world normal, and depth + object identity."""
    mats = []
    for kind in ("Normal", "Ident"):
        m = bpy.data.materials.new(PREFIX + "Data" + kind)
        _tag(m)
        m.use_nodes = True
        nt = m.node_tree
        nt.nodes.clear()
        em = nt.nodes.new("ShaderNodeEmission")
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        nt.links.new(em.outputs[0], out.inputs["Surface"])
        if kind == "Normal":
            geo = nt.nodes.new("ShaderNodeNewGeometry")
            v = _vmath(nt, "MULTIPLY_ADD", geo.outputs["Normal"], (0.5, 0.5, 0.5))
            v.node.inputs[2].default_value = (0.5, 0.5, 0.5)
            nt.links.new(v, em.inputs["Color"])
        else:
            cam = nt.nodes.new("ShaderNodeCameraData")
            info = nt.nodes.new("ShaderNodeObjectInfo")
            # EEVEE accumulates colour in half floats (11 significant bits), so depth goes out twice:
            # wrapped every DEPTH_PERIOD metres (millimetre steps) and whole (decimetre steps).
            comb = nt.nodes.new("ShaderNodeCombineXYZ")
            nt.links.new(_math(nt, "FRACT", _math(nt, "MULTIPLY", cam.outputs["View Z Depth"], 1.0 / DEPTH_PERIOD)),
                         comb.inputs["X"])
            nt.links.new(info.outputs["Random"], comb.inputs["Y"])
            nt.links.new(_math(nt, "MULTIPLY", cam.outputs["View Z Depth"], 0.001), comb.inputs["Z"])
            nt.links.new(comb.outputs[0], em.inputs["Color"])
        mats.append(m)
    return mats


def _flat_world():
    w = bpy.data.worlds.new(PREFIX + "DataWorld")
    _tag(w)
    w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    if bg is not None:
        bg.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1.0)
        bg.inputs["Strength"].default_value = 1.0
    return w


def _render_data(scene, cam, res, supersample=3, paint=True):
    """One-sample, pixel-centre renders of the model only (Review hidden), at res * supersample.

    Returns a dict of arrays at the supersampled size:
      alpha (bool), normal (H, W, 3 world space), depth (view Z, metres), ident (float per object),
      albedo (H, W, 3 scene-linear colour under flat white light, only if paint=True),
      plus pixel_size (metres per supersampled pixel; an array for perspective cameras) and
      facing (|normal . view direction|).
    """
    coll = _review_collection(scene)
    vl = _view_layer(scene)
    s = int(supersample)
    w, h = int(res[0]) * s, int(res[1]) * s
    tmp = tempfile.mkdtemp(prefix="hesperus_review_")
    m_normal, m_ident = _data_materials()
    flat = _flat_world() if paint else None
    out = {}
    try:
        with _guard_render_state(scene) as g:
            g.set(coll, "hide_render", True)
            r, e = scene.render, scene.eevee
            scene.camera = cam
            r.engine = "BLENDER_EEVEE"
            r.resolution_x, r.resolution_y, r.resolution_percentage = w, h, 100
            r.pixel_aspect_x = r.pixel_aspect_y = 1.0
            r.use_border = False
            r.film_transparent = True
            r.filter_size = 0.0
            r.use_freestyle = False
            r.use_motion_blur = False
            r.use_compositing = False
            r.use_sequencer = False
            r.dither_intensity = 0.0
            r.image_settings.file_format = "OPEN_EXR"
            r.image_settings.color_mode = "RGBA"
            r.image_settings.color_depth = "32"
            r.image_settings.exr_codec = "ZIP"
            e.taa_render_samples = 1
            e.use_shadows = False
            e.use_raytracing = False
            e.use_fast_gi = False
            e.use_overscan = False
            scene.view_settings.view_transform = "Standard"
            scene.view_settings.look = "None"
            scene.view_settings.exposure = 0.0
            scene.view_settings.gamma = 1.0
            vl.use_freestyle = False

            vl.material_override = m_normal
            a = _load_image(_render_to(scene, os.path.join(tmp, "normal.exr")))
            out["alpha"] = a[..., 3] > 0.5
            n = a[..., :3] * 2.0 - 1.0
            del a
            ln = np.sqrt((n * n).sum(axis=-1, keepdims=True))
            np.maximum(ln, 1e-6, out=ln)
            n /= ln
            n[~out["alpha"]] = 0.0
            out["normal"] = n

            vl.material_override = m_ident
            a = _load_image(_render_to(scene, os.path.join(tmp, "ident.exr")))
            out["depth_fine"] = np.ascontiguousarray(a[..., 0])
            out["ident"] = np.ascontiguousarray(a[..., 1])
            out["depth"] = a[..., 2] * 1000.0
            del a

            if paint:
                vl.material_override = None
                vl.world_override = flat
                a = _load_image(_render_to(scene, os.path.join(tmp, "albedo.exr")))
                out["albedo"] = np.ascontiguousarray(a[..., :3])
                del a
    finally:
        for m in (m_normal, m_ident):
            bpy.data.materials.remove(m)
        if flat is not None:
            bpy.data.worlds.remove(flat)
        shutil.rmtree(tmp, ignore_errors=True)

    # per-pixel metres and facing ratio
    mw = cam.matrix_world
    right = np.array(mw.col[0][:3])
    up = np.array(mw.col[1][:3])
    fwd = -np.array(mw.col[2][:3])
    if cam.data.type == "ORTHO":
        out["pixel_size"] = cam.data.ortho_scale / w
        out["facing"] = np.abs(out["normal"] @ fwd).astype(np.float32)
    else:
        f_px = cam.data.lens / cam.data.sensor_width * w
        xs = ((np.arange(w, dtype=np.float32) + 0.5) - 0.5 * w) / f_px
        ys = (0.5 * h - (np.arange(h, dtype=np.float32) + 0.5)) / f_px
        inv = 1.0 / np.sqrt(1.0 + xs[None, :] ** 2 + ys[:, None] ** 2)
        nr, nu, nf = out["normal"] @ right, out["normal"] @ up, out["normal"] @ fwd
        out["facing"] = np.abs((nf + nr * xs[None, :] + nu * ys[:, None]) * inv).astype(np.float32)
        out["pixel_size"] = (out["depth"] / f_px).astype(np.float32)
    return out


def _feature_edges(d, crease_deg=34.0, depth_tol=0.06, depth_slope=4.0, paint_tol=0.085):
    """Boolean maps of the model's feature edges at the supersampled size.

    geometry: silhouettes, object boundaries, creases sharper than crease_deg and depth steps.
    paint: colour boundaries (boot-topping, paint bands) that are not geometric edges.
    An edge between two pixels marks both of them, so lines are centred on the true boundary.
    """
    a, n, z, ident = d["alpha"], d["normal"], d["depth"], d["ident"]
    zf = d.get("depth_fine")
    facing = np.maximum(d["facing"], 0.08)
    tan = np.sqrt(np.clip(1.0 - facing * facing, 0.0, 1.0)) / facing
    reach = tan * d["pixel_size"]                     # expected depth change across one pixel
    del tan
    cos_c = math.cos(math.radians(crease_deg))
    geom = np.zeros(a.shape, dtype=bool)
    paint = np.zeros(a.shape, dtype=bool) if "albedo" in d else None
    alb = np.sqrt(np.clip(d["albedo"], 0.0, 1.0)) if paint is not None else None
    for axis in (0, 1):
        s0 = (slice(0, -1), slice(None)) if axis == 0 else (slice(None), slice(0, -1))
        s1 = (slice(1, None), slice(None)) if axis == 0 else (slice(None), slice(1, None))
        both = a[s0] & a[s1]
        e = a[s0] != a[s1]
        e |= both & (np.abs(ident[s0] - ident[s1]) > 1e-6)
        e |= both & ((n[s0] * n[s1]).sum(axis=-1) < cos_c)
        dz = np.abs(z[s0] - z[s1])                        # whole depth: only good to a decimetre
        if zf is not None:
            df = zf[s0] - zf[s1]
            df -= np.round(df)
            dz = np.where(dz > 0.6 * DEPTH_PERIOD, dz, np.abs(df) * DEPTH_PERIOD)
        e |= both & (dz > depth_tol + depth_slope * np.maximum(reach[s0], reach[s1]))
        geom[s0] |= e
        geom[s1] |= e
        if paint is not None:
            p = both & ~e & (np.abs(alb[s0] - alb[s1]).max(axis=-1) > paint_tol)
            paint[s0] |= p
            paint[s1] |= p
    if paint is not None:
        # keep only connected runs: procedural texture speckle is not a paint boundary
        cnt = paint.astype(np.float32)
        k = np.zeros_like(cnt)
        for dy in (-2, -1, 0, 1, 2):
            for dx in (-2, -1, 0, 1, 2):
                ys0, ys1 = max(0, dy), cnt.shape[0] + min(0, dy)
                xs0, xs1 = max(0, dx), cnt.shape[1] + min(0, dx)
                k[ys0:ys1, xs0:xs1] += cnt[ys0 - dy:ys1 - dy, xs0 - dx:xs1 - dx]
        paint &= (k >= 5.0) & (k <= 14.0)
        paint &= ~_dilate(geom, 1)
    return geom, paint


def _overlay_layers(d, supersample, line_px=1.25):
    """Anti-aliased output-resolution layers from the supersampled data:
    coverage, geometry-edge alpha, paint-edge alpha (or None), and a neutral shaded RGBA 'clay' render."""
    s = int(supersample)
    geom, paint = _feature_edges(d)
    r = max(0, int(round((line_px * s - 2.0) / 2.0)))
    cover = _box_down(d["alpha"], s)
    edge = _box_down(_dilate(geom, r), s)
    pedge = _box_down(_dilate(paint, r), s) if paint is not None else None

    # clay render with dark edges, straight alpha
    light = np.array([-0.45, -0.55, 0.70])
    light /= np.linalg.norm(light)
    shade = np.clip(d["normal"] @ light, -1.0, 1.0).astype(np.float32)
    shade = 0.80 + 0.17 * shade
    shade[~d["alpha"]] = 0.0
    g = _dilate(geom, r)
    shade[g] = 0.10
    if paint is not None:
        pm = _dilate(paint, r) & d["alpha"] & ~g
        shade[pm] *= 0.55
    a_hi = (d["alpha"] | g).astype(np.float32)
    a_lo = _box_down(a_hi, s)
    c_lo = _box_down(shade * a_hi, s) / np.maximum(a_lo, 1e-4)
    clay = np.dstack([c_lo, c_lo, c_lo, a_lo]).astype(np.float32)
    return cover, edge, pedge, clay


def _composite(base, cover, edge, pedge, alpha, tint, edge_color, paint_color):
    """Tints the model area, then draws the model's edge lines, on top of a drawing (in place)."""
    k = (alpha * cover)[..., None]
    base[..., :3] = base[..., :3] * (1.0 - k) + np.array(tint, dtype=np.float32) * k
    if pedge is not None:
        k = (0.9 * pedge)[..., None]
        base[..., :3] = base[..., :3] * (1.0 - k) + np.array(paint_color, dtype=np.float32) * k
    k = np.clip(edge, 0.0, 1.0)[..., None]
    base[..., :3] = base[..., :3] * (1.0 - k) + np.array(edge_color, dtype=np.float32) * k
    return base


TINT = (1.0, 0.45, 0.05)         # model area: orange
EDGE_COLOR = (1.0, 0.95, 0.10)   # model geometry edges: yellow
PAINT_COLOR = (0.35, 1.0, 0.35)  # model paint boundaries: green
GUIDE_COLOR = (1.0, 0.25, 0.95)  # calibration marks: magenta


def _legend(img, lines, scale=2, corner="bl", margin=10):
    h, w = img.shape[:2]
    lh = 9 * scale
    width = max(_text_width(t, scale) for t in lines)
    x = margin + 2 * scale if corner in ("bl", "tl") else w - margin - width - 2 * scale
    y = h - margin - lh * len(lines) if corner in ("bl", "br") else margin + 2 * scale
    _draw_rect(img, x - 3 * scale, y - 3 * scale, x + width + 2 * scale, y + lh * len(lines) + scale, (0.02, 0.04, 0.10), 0.72)
    for k, t in enumerate(lines):
        _draw_text(img, x, y + k * lh, t, (1.0, 1.0, 1.0), scale)


def _drawing_scale(img, cal, what):
    h, w = img.shape[:2]
    sx, sy = w / cal["size"][0], h / cal["size"][1]
    if abs(sx - sy) > 0.002 * sx:
        raise ValueError("%s is %d x %d px; its calibration is for the %d x %d px scan (or a uniform resize of it)"
                         % (what, w, h, cal["size"][0], cal["size"][1]))
    return sx


def _suffix(path, suffix, ext=None):
    root, e = os.path.splitext(path)
    return root + suffix + (ext or e)


# --------------------------------------------------------------------------- #
# Overlays on the builder's drawings
# --------------------------------------------------------------------------- #

def render_profile_overlay(scene, out_jpg, plan_jpg=RIGGING_PLAN_JPG, alpha=0.55, supersample=3,
                           paint_edges=True, guides=True):
    """Orthographic starboard elevation of the model, registered to the rigging plan and laid over it.

    The model area is tinted orange at ``alpha``; its silhouette, object boundaries and creases are
    drawn as yellow lines and its paint boundaries as green lines, so any departure from the white
    drawing shows as two separate lines.  Magenta marks show where the calibration puts the
    perpendiculars, the baseline and the load waterline.

    Also writes ``<out>_render.png``: the same registered view as a shaded RGBA render without the
    drawing.  Returns ``(out_jpg, render_png)``.
    """
    t0 = time.time()
    coll = _rig(scene)
    _model_collection(scene)
    plan = _load_image(plan_jpg)
    h, w = plan.shape[:2]
    k = _drawing_scale(plan, PROFILE_CAL, "the rigging plan")
    origin, ppm = _profile_origin(k)
    cam = coll.objects[PREFIX + "Cam_Profile"]
    with _Restore() as g:
        g.keep(cam, "location", "rotation_euler")
        g.keep(cam.data, "ortho_scale", "clip_start", "clip_end")
        _place_ortho(cam, "side", ppm, origin, (0, 0, w, h))
        d = _render_data(scene, cam, (w, h), supersample, paint=paint_edges)
    cover, edge, pedge, clay = _overlay_layers(d, supersample)
    del d
    img = plan.copy()
    img[..., 3] = 1.0
    _composite(img, cover, edge, pedge, alpha, TINT, EDGE_COLOR, PAINT_COLOR)

    def px(x):
        return origin[0] + ppm * x

    def py(z):
        return origin[1] - ppm * z

    if guides:
        t = max(1.0, k)
        for x, name in ((X_AP, "AP"), (X_FP, "FP")):
            _vline(img, px(x), py(0.0) + 6 * t, py(0.0) + 34 * t, GUIDE_COLOR, 0.5 * t)
            _vline(img, px(x), py(27.5), py(26.6), GUIDE_COLOR, 0.5 * t)
            _draw_text(img, int(px(x)) - 11, int(py(0.0) + 38 * t), name, GUIDE_COLOR, 2)
        for z, name in ((0.0, "BASE"), (SEA_LEVEL, "LWL")):
            _hline(img, py(z), px(-2.9) - 70 * t, px(-2.9) - 16 * t, GUIDE_COLOR, 0.5 * t)
            _hline(img, py(z), px(X_FP) + 14 * t, px(X_FP) + 60 * t, GUIDE_COLOR, 0.5 * t)
            _draw_text(img, int(px(X_FP) + 64 * t), int(py(z)) - 7, name, GUIDE_COLOR, 2)
    lines = [
        "HESPERUS MODEL OVER RIGGING PLAN LR-0126   STARBOARD ELEVATION   ORANGE = MODEL   YELLOW = MODEL EDGES"
        + ("   GREEN = PAINT LINES" if pedge is not None else "") + "   WHITE = 1896 DRAWING",
        "PX = %.1f + %.3f X   PY = %.1f - %.3f Z   MAGENTA = CALIBRATION MARKS (AP, FP, BASELINE, LWL Z=%.1f)"
        % (PROFILE_CAL["x0"] * k, ppm, PROFILE_CAL["z0"] * k, ppm, SEA_LEVEL),
    ]
    _legend(img, lines, scale=1 if w < 1600 else 2 if w < 3000 else 3)
    _save_image(img[..., :3], out_jpg)
    render_png = _save_image(clay, _suffix(out_jpg, "_render", ".png"))
    LAST_TIMINGS["overlay_profile"] = time.time() - t0
    return out_jpg, render_png


def render_plan_overlay(scene, out_jpg, sheet_jpg=DECK_PLANS_JPG, alpha=0.55, supersample=3,
                        paint_edges=True, guides=True):
    """Orthographic top views of the model registered to both plan views of the profile-and-deck-plans
    sheet and laid over the whole sheet.

    Over the raised-quarter-deck / bridge-deck plan (centreline py = 808) only the model above
    Z = 5.0 is drawn (camera far clip); over the main-deck plan (py = 1105) the whole model.
    Port is toward the top of the sheet.  Also writes ``<out>_render.png`` (RGBA, no drawing).
    Returns ``(out_jpg, render_png)``.
    """
    t0 = time.time()
    coll = _rig(scene)
    _model_collection(scene)
    sheet = _load_image(sheet_jpg)
    h, w = sheet.shape[:2]
    k = _drawing_scale(sheet, PLAN_CAL, "the deck plans sheet")
    img = sheet.copy()
    img[..., 3] = 1.0
    bare = np.zeros((h, w, 4), dtype=np.float32)
    t = max(1.0, k)
    for which, cam_name in (("upper", "Cam_PlanUpper"), ("main", "Cam_PlanMain")):
        origin, ppm = _plan_origin(which, k)
        win = _plan_window(which, k)
        cam = coll.objects[PREFIX + cam_name]
        with _Restore() as g:
            g.keep(cam, "location", "rotation_euler")
            g.keep(cam.data, "ortho_scale", "clip_start", "clip_end")
            _place_ortho(cam, "top", ppm, origin, win)
            cam.data.clip_end = (cam.location.z - PLAN_CAL["upper_min_z"]) if which == "upper" else 1000.0
            d = _render_data(scene, cam, (win[2], win[3]), supersample, paint=paint_edges)
        cover, edge, pedge, clay = _overlay_layers(d, supersample)
        del d
        y0, y1 = win[1], win[1] + win[3]
        _composite(img[y0:y1], cover, edge, pedge, alpha, TINT, EDGE_COLOR, PAINT_COLOR)
        bare[y0:y1] = clay
        if guides:
            cy = origin[1]
            for x, name in ((X_AP, "AP"), (X_FP, "FP")):
                cx = origin[0] + ppm * x
                _vline(img, cx, cy - 14 * t, cy + 14 * t, GUIDE_COLOR, 0.5 * t)
            _hline(img, cy, origin[0] + ppm * X_FP + 8 * t, origin[0] + ppm * X_FP + 46 * t, GUIDE_COLOR, 0.5 * t)
            _hline(img, cy, origin[0] - ppm * 2.9 - 60 * t, origin[0] - ppm * 2.9 - 22 * t, GUIDE_COLOR, 0.5 * t)
            label = "MODEL ABOVE Z=%.1f" % PLAN_CAL["upper_min_z"] if which == "upper" else "WHOLE MODEL"
            lx = min(int(origin[0] + ppm * X_FP + 12 * t), w - _text_width(label, 1) - 4)
            _draw_text(img, lx, int(cy) + 8, label, GUIDE_COLOR, 1)
    lines = [
        "HESPERUS MODEL OVER DECK PLANS LR-0124   TOP VIEWS, PORT UP   ORANGE = MODEL   YELLOW = MODEL EDGES"
        + ("   GREEN = PAINT LINES" if paint_edges else "") + "   WHITE = 1896 DRAWING",
        "PX = %.1f + %.2f X   PY = %.0f OR %.0f - %.2f Y   MAGENTA = CENTRELINE, AP AND FP FROM THE CALIBRATION"
        % (PLAN_CAL["x0"] * k, PLAN_CAL["px_per_m"] * k, PLAN_CAL["centres"]["upper"] * k, PLAN_CAL["centres"]["main"] * k,
           PLAN_CAL["px_per_m"] * k),
    ]
    _legend(img, lines, scale=1 if w < 3000 else 2)
    _save_image(img[..., :3], out_jpg)
    render_png = _save_image(bare, _suffix(out_jpg, "_render", ".png"))
    LAST_TIMINGS["overlay_plan"] = time.time() - t0
    return out_jpg, render_png


# --------------------------------------------------------------------------- #
# Beauty renders
# --------------------------------------------------------------------------- #

def render_beauty(scene, out_dir, quality="final", shots=None):
    """Renders the review views to ``out_dir`` as PNG (1920 x 1200 at 'final', half that at 'draft').

    beauty_stbd_bow, beauty_port_quarter, beauty_high, beauty_broadside, beauty_distant and
    beauty_detail_bridge.  Each camera is re-framed on the model's actual extent first (every
    rendered vertex above the water, masts and flags included), so nothing is cropped.
    ``shots`` optionally limits the set.  Returns ``{shot name: path}``.
    """
    if quality not in ("final", "draft"):
        raise ValueError("quality must be 'final' or 'draft'")
    coll = _rig(scene)
    _model_collection(scene)
    names = [n for n in BEAUTY_SHOTS if shots is None or n in shots]
    cams = _place_beauty_cameras(scene, names=names)
    os.makedirs(out_dir, exist_ok=True)
    out = {}
    sun0 = _get_sun(scene)
    try:
        with _guard_render_state(scene) as g:
            g.set(coll, "hide_render", False)
            _apply_beauty_settings(scene, quality)
            for name in names:
                t0 = time.time()
                shot = BEAUTY_SHOTS[name]
                scene.camera = cams[name]
                _set_sun(scene, *shot.get("sun", DEFAULT_SUN))
                out[name] = _render_to(scene, os.path.join(out_dir, name + ".png"))
                LAST_TIMINGS[name] = time.time() - t0
                _log("%s (%s) %.1f s" % (name, quality, LAST_TIMINGS[name]))
    finally:
        _set_sun(scene, *sun0)
    return out


# --------------------------------------------------------------------------- #
# Photograph match
# --------------------------------------------------------------------------- #

def _percentiles(a, qs=(1.0, 50.0, 99.0)):
    return [float(v) for v in np.percentile(a, qs)]


def render_photo_match(scene, out_jpg, photo_jpg=PHOTO_JPG, quality="final"):
    """Renders the model from the viewpoint of the Ramsey photograph (port side, bow left, low, a
    little off the bow) in greyscale with the photograph's tonal range, and saves the pair stacked:
    photograph on top, render below, same width and same crop.

    Also writes ``<out>_overlay.jpg``: the photograph with the model's edge lines drawn over it,
    which is the quickest way to judge the viewpoint.  Returns ``(out_jpg, overlay_jpg)``.
    """
    t0 = time.time()
    coll = _rig(scene)
    _model_collection(scene)
    photo = _load_image(photo_jpg)
    h, w = photo.shape[:2]
    pw, ph = PHOTO_CAM["size"]
    if abs(w / pw - h / ph) > 0.002 * w / pw:
        raise ValueError("the photograph is %d x %d px; the camera match is for the %d x %d px scan" % (w, h, pw, ph))
    k = w / pw
    grey_photo = photo[..., :3].mean(axis=-1)
    x0, y0, x1, y1 = [int(round(v * k)) for v in PHOTO_CAM["crop"]]
    cam = coll.objects[PREFIX + "Cam_PhotoMatch"]
    sea = coll.objects[PREFIX + "Sea"]
    _place_photo_camera(cam)
    tmp = tempfile.mkdtemp(prefix="hesperus_review_")
    sun0 = _get_sun(scene)
    try:
        with _guard_render_state(scene) as g:
            g.set(coll, "hide_render", False)
            g.keep(sea, "location")
            sea.location.z = PHOTO_CAM["water_z"]
            _apply_beauty_settings(scene, quality)
            scene.render.resolution_x, scene.render.resolution_y = w, h
            scene.render.resolution_percentage = 100
            scene.view_settings.look = "None"
            scene.camera = cam
            _set_sun(scene, *PHOTO_CAM["sun"])
            rgb = _load_image(_render_to(scene, os.path.join(tmp, "photo_view.png")))[..., :3]
        d = _render_data(scene, cam, (w, h), 2, paint=True)
    finally:
        _set_sun(scene, *sun0)
        shutil.rmtree(tmp, ignore_errors=True)

    # blue-sensitive plate: weight blue and green, little red; then match the photograph's tones
    grey = rgb @ np.array([0.12, 0.48, 0.40], dtype=np.float32)
    grey = _blur3(grey, 1)
    a = grey[y0:y1, x0:x1]
    b = grey_photo[y0:y1, x0:x1]
    (a1, a50, a99), (b1, b50, b99) = _percentiles(a), _percentiles(b)
    tn = np.clip((a - a1) / max(1e-4, a99 - a1), 0.0, 1.0)
    mid_a = min(0.95, max(0.05, (a50 - a1) / max(1e-4, a99 - a1)))
    mid_b = min(0.95, max(0.05, (b50 - b1) / max(1e-4, b99 - b1)))
    gamma = float(np.clip(math.log(mid_b) / math.log(mid_a), 0.5, 2.0))
    a = b1 + (b99 - b1) * np.power(tn, gamma)

    gap = 6
    cw, chh = x1 - x0, y1 - y0
    pair = np.full((chh * 2 + gap, cw, 3), 0.04, dtype=np.float32)
    pair[:chh] = b[..., None]
    pair[chh + gap:] = a[..., None]
    sc = 2 if cw >= 1200 else 1
    _draw_text(pair, 12, 10, "PHOTOGRAPH: HESPERUS AT RAMSEY (PORT SIDE, BOW LEFT)", (1, 1, 1), sc, backing=(0, 0, 0, 0.55))
    _draw_text(pair, 12, chh + gap + 10, "MODEL FROM THE MATCHED CAMERA, PLATE-LIKE GREYSCALE (WATER AT Z=%.1f)"
               % PHOTO_CAM["water_z"], (1, 1, 1), sc, backing=(0, 0, 0, 0.55))
    _save_image(pair, out_jpg)

    cover, edge, pedge, _clay = _overlay_layers(d, 2, line_px=1.3)
    del d
    over = np.dstack([grey_photo, grey_photo, grey_photo, np.ones_like(grey_photo)]).astype(np.float32)
    _composite(over, cover, edge, pedge, 0.18, TINT, EDGE_COLOR, PAINT_COLOR)
    over = np.ascontiguousarray(over[y0:y1, x0:x1, :3])
    _draw_text(over, 12, 10, "MODEL EDGES (YELLOW) AND PAINT LINES (GREEN) OVER THE PHOTOGRAPH, MATCHED CAMERA", (1, 1, 1), sc,
               backing=(0, 0, 0, 0.55))
    overlay_jpg = _save_image(over, _suffix(out_jpg, "_overlay"))
    LAST_TIMINGS["photo_match"] = time.time() - t0
    return out_jpg, overlay_jpg


# --------------------------------------------------------------------------- #
# Everything
# --------------------------------------------------------------------------- #

OUTPUT_NAMES = ("overlay_profile", "overlay_plan", "photo_match") + tuple(BEAUTY_SHOTS)


def review_all(scene, out_dir, quality="draft", only=None):
    """Runs every check and render into ``out_dir`` and returns ``{name: path}``.

    overlay_profile.jpg, overlay_plan.jpg, photo_match.jpg, beauty_*.png, plus the companion files
    (``*_render.png``, ``photo_match_overlay.jpg``).  ``only`` optionally limits the set to names from
    ``OUTPUT_NAMES`` ('beauty' selects all six views).  Seconds per output are left in ``LAST_TIMINGS``.
    """
    want = set(OUTPUT_NAMES) if not only else set()
    for item in (only or ()):
        item = item.strip()
        if not item:
            continue
        if item == "beauty":
            want.update(BEAUTY_SHOTS)
        elif item in OUTPUT_NAMES:
            want.add(item)
        else:
            raise ValueError("unknown output %r; choose from %s or 'beauty'" % (item, ", ".join(OUTPUT_NAMES)))
    os.makedirs(out_dir, exist_ok=True)
    _rig(scene)
    paths = {}
    if "overlay_profile" in want:
        p, r = render_profile_overlay(scene, os.path.join(out_dir, "overlay_profile.jpg"))
        paths["overlay_profile"], paths["overlay_profile_render"] = p, r
        _log("overlay_profile %.1f s" % LAST_TIMINGS["overlay_profile"])
    if "overlay_plan" in want:
        p, r = render_plan_overlay(scene, os.path.join(out_dir, "overlay_plan.jpg"))
        paths["overlay_plan"], paths["overlay_plan_render"] = p, r
        _log("overlay_plan %.1f s" % LAST_TIMINGS["overlay_plan"])
    if "photo_match" in want:
        p, o = render_photo_match(scene, os.path.join(out_dir, "photo_match.jpg"), quality=quality)
        paths["photo_match"], paths["photo_match_overlay"] = p, o
        _log("photo_match %.1f s" % LAST_TIMINGS["photo_match"])
    shots = [n for n in BEAUTY_SHOTS if n in want]
    if shots:
        paths.update(render_beauty(scene, out_dir, quality=quality, shots=shots))
    return paths


def main(argv=None):
    import argparse
    if argv is None:
        argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser(prog="hesperus_review", description="Overlay and review renders for the Hesperus model.")
    ap.add_argument("--blend", help="blend file to open (default: the file already loaded)")
    ap.add_argument("--out", required=True, help="output directory")
    ap.add_argument("--quality", choices=("draft", "final"), default="draft")
    ap.add_argument("--only", default="", help="comma-separated subset: %s, or 'beauty' for all six views" % ", ".join(OUTPUT_NAMES))
    args = ap.parse_args(argv)
    if args.blend:
        bpy.ops.wm.open_mainfile(filepath=os.path.abspath(args.blend))
    scene = bpy.data.scenes.get(SCENE_NAME)
    if scene is None:
        raise SystemExit("no scene named %r in %s" % (SCENE_NAME, bpy.data.filepath or "the current file"))
    t0 = time.time()
    LAST_TIMINGS.clear()
    paths = review_all(scene, os.path.abspath(args.out), quality=args.quality,
                       only=[s for s in args.only.split(",") if s.strip()] or None)
    for name, path in paths.items():
        _log("%-26s %s" % (name, path))
    for name, secs in LAST_TIMINGS.items():
        _log("time %-22s %6.1f s" % (name, secs))
    _log("done in %.1f s" % (time.time() - t0))
    return paths


if __name__ == "__main__":
    main()
