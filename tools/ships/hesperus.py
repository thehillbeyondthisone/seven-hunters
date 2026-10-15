"""Lighthouse tender HESPERUS (Gourlay Brothers & Co, Dundee, yard no. 171, 1896).

Builds the model in a scene named 'Hesperus'. Blender 5.2.

    blender -b --factory-startup -P tools/ships/hesperus.py -- --save tools/ships/hesperus.blend [--profile out.png]

Metres. +X forward, +Y port, +Z up. Origin: on the centreline at the top of the keel, at the fore side of the stern
post (frame 0, within the 0.05 m the drawing can be read to). The aft perpendicular is therefore about 0.2 m abaft
the origin and the stem face is at X = 53.15 (175 ft between perpendiculars). Frames are 22 in apart: frame n is
at X = 0.5588 n - 0.04. Load waterline Z = 3.0.

Every dimension below is scaled from the builder's drawings held by Lloyd's Register Foundation
(docs/references/hesperus): the rigging plan LRF-PUN-DUN124-0126-P (px = 228 + 31.006 X,
py = 998 - 31.006 Z), the corrected profile and deck plans -0124-P, the midship section -0125-P, the after-end
sheet -0134-P and the first-entry survey report -0119-R; docs/references/hesperus/measurements.md lists the
readings. Hull form away from the three drawn sections is faired, not recorded.
Colour follows the Ramsey photograph (tone only) and the builder's display model; see NOTES at the end.
"""
import bpy, math, os, sys
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else r'C:\Users\thisi\OneDrive\Documents\flannan\tools\ships'
if HERE not in sys.path:
    sys.path.insert(0, HERE)
try:
    import hesperus_fittings as FIT
except Exception as e:  # the fittings library is optional; the ship still builds without it
    FIT = None
    print('hesperus: fittings library not loaded:', e)
try:
    import hesperus_finish as FINISH   # procedural plating, planking and weathering for close views; optional
except Exception as e:
    FINISH = None
try:
    import hesperus_interiors as INT   # rooms for boarding her: wheelhouse, galley, after deckhouse, saloon; optional
except Exception as e:
    INT = None
    print('hesperus: interiors not loaded:', e)

LWL = 3.0
STEM_X = 53.15
PREFIX = 'HSP_'

# Three levels of detail from the same measurements. 'full' is for boarding her; 'mid' for the ship lying off, a few
# hundred metres to a few kilometres away; 'far' is the silhouette on the horizon, where a 3.5 degree telescope puts
# the whole ship on about a hundred pixels at ten kilometres and nothing thinner than a spar survives.
DETAIL = 'full'
LODS = {'full': ('Hesperus', 'HSP_'), 'mid': ('Hesperus_LOD1', 'HSP1_'), 'far': ('Hesperus_LOD2', 'HSP2_')}

def seg(n):  # sides of a round section at the current level of detail
    return n if DETAIL == 'full' else (max(4, (n + 1) // 2) if DETAIL == 'mid' else max(3, n // 3))

# --------------------------------------------------------------------------------------------- maths

def lin(t, x):
    if x <= t[0][0]: return t[0][1]
    for (x0, y0), (x1, y1) in zip(t, t[1:]):
        if x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0) if x1 > x0 else y1
    return t[-1][1]

def pchip(t):
    xs = [p[0] for p in t]; ys = [p[1] for p in t]; n = len(t)
    d = [(ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]) for i in range(n - 1)]
    m = [d[0]] + [0 if d[i - 1] * d[i] <= 0 else 2 * d[i - 1] * d[i] / (d[i - 1] + d[i]) for i in range(1, n - 1)] + [d[-1]]
    def f(x):
        if x <= xs[0]: return ys[0]
        if x >= xs[-1]: return ys[-1]
        i = max(j for j in range(n - 1) if xs[j] <= x)
        h = xs[i + 1] - xs[i]; s = (x - xs[i]) / h
        return (ys[i] * (2 * s ** 3 - 3 * s ** 2 + 1) + h * m[i] * (s ** 3 - 2 * s ** 2 + s)
                + ys[i + 1] * (-2 * s ** 3 + 3 * s ** 2) + h * m[i + 1] * (s ** 3 - s ** 2))
    return f

def smooth(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)

def hance(t):  # quarter-circle sweep: level at t=0, upright at t=1
    t = min(max(t, 0.0), 1.0)
    return 1 - math.sqrt(1 - t * t)

# ------------------------------------------------------------------------------------------ hull form

# Midship section, half-breadth by height, from the midship section drawing (36 px/ft).
MS = [(0.0, 0.0), (0.05, 0.65), (0.17, 2.22), (0.42, 3.06), (0.76, 3.66), (1.14, 3.98), (1.57, 4.15), (2.41, 4.25),
      (3.26, 4.267), (4.42, 4.19), (5.67, 4.07), (6.48, 3.93), (8.2, 3.74)]
# Stem and forefoot, x by height, from the rigging plan.
STEM = [(0.0, 50.9), (0.1, 51.05), (0.58, 52.06), (1.55, 52.8), (2.3, 53.12), (2.95, STEM_X), (9.5, STEM_X)]
FOREFOOT = [(50.9, 0.0), (51.05, 0.1), (52.06, 0.58), (52.8, 1.55), (53.12, 2.3), (STEM_X, 2.95)]
# Entrance: where it starts and how full it is, by height. The upper values fit the main-deck plan outline.
F_XS = [(0.0, 26.0), (0.6, 27.0), (1.8, 28.0), (9.5, 28.0)]
F_P = [(0.0, 3.0), (4.6, 3.0), (7.2, 4.6), (9.5, 4.6)]
F_B = [(0.0, 0.42), (0.6, 0.46), (1.8, 0.56), (3.0, 0.75), (3.5, 0.85), (4.6, 1.0), (9.5, 1.0)]  # below 1: hollow waterline endings
# Run. Recorded: the waterline at cabin-sole level (Z 3.5) from the 1/4 in 'Plan of Cabin Sole' on the after-end sheet,
# as a fraction of the midship breadth; and the two drawn sections, at bulkhead 11 (a straight V, half-breadth
# 0.846 Z) and bulkhead 20. Both sections follow fullness(x, z) = fullness(x, 3.5) ** G(z), which carries them aft.
FA35 = pchip([(0.0, 0.0), (0.71, 0.068), (1.11, 0.131), (1.67, 0.254), (2.51, 0.394), (3.07, 0.462), (3.9, 0.545), (4.74, 0.608),
              (5.3, 0.646), (5.86, 0.681), (6.97, 0.735), (8.09, 0.779), (9.22, 0.817), (10.35, 0.845), (11.06, 0.868),
              (14.0, 0.925), (18.0, 0.972), (22.0, 0.994), (26.0, 1.0)])
A_G = [(0.0, 8.0), (0.23, 6.6), (0.4, 5.6), (0.8, 4.35), (1.18, 3.5), (1.94, 2.3), (2.7, 1.5), (3.1, 1.22), (3.5, 1.0), (4.55, 0.8)]
# Deck breaks stand on frames 29, 57 and 80, which reproduces the register lengths in the survey report.
X_STERN, X_BRIDGE_A, X_BRIDGE_F, X_FC = -2.72, 16.17, 31.81, 44.66
# Deck edge heights: raised quarter deck, well-deck rail and forecastle from the rigging plan; bridge deck from the
# written 6 ft 9 in above the main deck, which is 14 ft 6 in moulded at side.
Z_RQD = pchip([(X_STERN, 6.32), (1.52, 6.03), (6.19, 5.77), (12.0, 5.62), (X_BRIDGE_A, 5.62)])
Z_BRIDGE = 6.48
RAIL = pchip([(33.6, 5.645), (36.5, 5.74), (41.2, 5.90), (43.3, 6.07)])
Z_FC = pchip([(X_FC, 6.92), (49.4, 7.26), (STEM_X, 7.45)])
BOW_BULWARK = pchip([(50.6, 0.0), (51.6, 0.2), (52.6, 0.42), (STEM_X, 0.50)])
# Raised quarter deck outline in plan (deck plans sheet, scaled 1.6 % up to the breadth of the 1/4 in section at
# bulkhead 20), and the underside of the counter: two straight slopes with a knuckle, on both profile sheets.
RQD_EDGE = pchip([(X_STERN, 0.0), (-2.69, 0.86), (-2.45, 1.72), (-2.25, 1.95), (-2.07, 2.11), (-1.75, 2.36), (-1.42, 2.54), (-1.10, 2.69),
                  (-0.78, 2.81), (-0.45, 2.91), (0.49, 3.11), (1.62, 3.29), (2.72, 3.40), (3.83, 3.50), (4.96, 3.58), (6.10, 3.65),
                  (7.23, 3.71), (8.33, 3.75), (9.44, 3.79), (10.57, 3.83), (11.70, 3.87), (12.83, 3.90), (13.92, 3.92), (15.02, 3.94),
                  (X_BRIDGE_A, 3.95)])
COUNTER = [(X_STERN, 6.32), (-1.72, 5.36), (-0.3, 4.55), (0.0, 4.55)]
HANCE_A, HANCE_F, HANCE_FC = 14.75, 33.6, 43.3  # where the three sweeps of the sheer start or finish

def z_keel(x):
    return lin(FOREFOOT, x) if x > 50.9 else 0.0

def z_sheer(x):  # top edge of the shell plating
    if x <= HANCE_A: return Z_RQD(x)
    if x < X_BRIDGE_A: return 5.62 + (Z_BRIDGE - 5.62) * hance((x - HANCE_A) / (X_BRIDGE_A - HANCE_A))
    if x <= X_BRIDGE_F: return Z_BRIDGE
    if x < HANCE_F: return 5.645 + (Z_BRIDGE - 5.645) * hance((HANCE_F - x) / (HANCE_F - X_BRIDGE_F))
    if x <= HANCE_FC: return RAIL(x)
    if x < X_FC: return 6.07 + (Z_FC(X_FC) - 6.07) * hance((x - HANCE_FC) / (X_FC - HANCE_FC))
    return Z_FC(x) + BOW_BULWARK(x)

def z_main_deck(x):  # 14 ft 6 in amidships, sheering 0.92 m to the stem (inboard profile)
    return 4.42 + 0.92 * max(0.0, (x - 26.67) / 26.52) ** 2.6

def z_deck(x):  # the weather deck at side
    if x <= X_BRIDGE_A: return Z_RQD(x)
    if x <= X_BRIDGE_F: return Z_BRIDGE
    if x < X_FC: return z_main_deck(x)
    return Z_FC(x)

def f_fore(x, z):
    xs = lin(F_XS, z)
    if x <= xs: return 1.0
    u = (x - xs) / (lin(STEM, z) - xs)
    return 0.0 if u >= 1 else (1 - u ** lin(F_P, z)) ** (1 / lin(F_B, z))

def f_aft(x, z):
    return 1.0 if x >= 26 else max(FA35(x), 0.0) ** lin(A_G, z)

def hb_lower(x, z):
    return lin(MS, z) * f_fore(x, z) * f_aft(x, z)

def z_blend(x):  # below this the hull is the lower body; above, it fairs to the deck edge
    if x >= 3: return 3.5
    if x >= 0: return 4.55 - 1.05 * smooth(x / 3)
    return lin(COUNTER, x)

def hb_top(x):
    if x <= X_BRIDGE_A: return RQD_EDGE(x)
    zs = z_sheer(x)
    return lin(MS, zs) * f_fore(x, zs)

def hull_hb(x, z):
    zb = z_blend(x)
    if z <= zb and x >= 0:
        return hb_lower(x, z)
    zs = z_sheer(x)
    s = min(max((z - zb) / (zs - zb), 0.0), 1.0) if zs > zb + 1e-6 else 1.0
    hb0 = hb_lower(x, zb) if x >= 0 else 0.0
    top = hb_top(x)
    # Aft, the side comes upright early (vertical from Z 4.2 at bulkhead 20); elsewhere it runs straight to the deck edge.
    e = 0.4 + 0.6 * smooth((x - 16) / 6) if top > hb0 else 1.0
    return hb0 + (top - hb0) * s ** e

def deck_edge_hb(x):
    if x <= X_BRIDGE_A: return RQD_EDGE(x) - 0.015
    if x <= X_BRIDGE_F: return hull_hb(x, Z_BRIDGE) - 0.015
    if x < X_FC: return hull_hb(x, z_main_deck(x)) - 0.05
    return hull_hb(x, Z_FC(x)) - 0.015

def deck_surface(x, y=0.0):  # height of the planking, with the 8 inch round of beam
    hb = max(deck_edge_hb(x), 0.01)
    return z_deck(x) + 0.2 * (hb / 4.27) * (1 - min(abs(y) / hb, 1.0) ** 2)

def hull_point(x, z, side=1):
    return Vector((x, side * hull_hb(x, z), z))

def hull_normal(x, z, side=1):
    d = 0.05
    tx = Vector((2 * d, hull_hb(x + d, z) - hull_hb(x - d, z), 0))
    tz = Vector((0, hull_hb(x, z + d) - hull_hb(x, z - d), 2 * d))
    n = tz.cross(tx).normalized()
    if n.y < 0: n = -n
    n.y *= side
    return n

# --------------------------------------------------------------------------------------- mesh builder

class MB:
    def __init__(self, name):
        self.name = name; self.v = []; self.f = []; self.fm = []; self.fs = []; self.mats = []

    def mi(self, mat):
        if mat not in self.mats: self.mats.append(mat)
        return self.mats.index(mat)

    def vert(self, co):
        self.v.append(Vector(co)); return len(self.v) - 1

    def face(self, idx, mat, want=None, smooth=False):
        idx = [i for k, i in enumerate(idx) if i != idx[k - 1]]
        if len(idx) < 3: return
        if want is not None:
            n = Vector((0, 0, 0))
            for k in range(len(idx)):
                a = self.v[idx[k]]; b = self.v[idx[(k + 1) % len(idx)]]
                n += Vector(((a.y - b.y) * (a.z + b.z), (a.z - b.z) * (a.x + b.x), (a.x - b.x) * (a.y + b.y)))
            if n.dot(want) < 0: idx = idx[::-1]
        self.f.append(idx); self.fm.append(self.mi(mat)); self.fs.append(smooth)

    def poly(self, pts, mat, want=None, smooth=False):
        self.face([self.vert(p) for p in pts], mat, want, smooth)

    def box(self, x0, x1, y0, y1, z0, z1, mat, skip=''):
        c = [self.vert((x, y, z)) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
        for key, ids, n in (('-x', (0, 1, 3, 2), (-1, 0, 0)), ('+x', (4, 5, 7, 6), (1, 0, 0)), ('-y', (0, 1, 5, 4), (0, -1, 0)),
                            ('+y', (2, 3, 7, 6), (0, 1, 0)), ('-z', (0, 2, 6, 4), (0, 0, -1)), ('+z', (1, 3, 7, 5), (0, 0, 1))):
            if key not in skip: self.face([c[i] for i in ids], mat, Vector(n))

    def ring(self, c, axis, r, n, ref=None):
        n = seg(n)
        axis = Vector(axis).normalized()
        ref = Vector(ref) if ref is not None else (Vector((0, 1, 0)) if abs(axis.y) < 0.9 else Vector((1, 0, 0)))
        u = (ref - axis * ref.dot(axis)).normalized(); w = axis.cross(u)
        return [self.vert(Vector(c) + (u * math.cos(2 * math.pi * k / n) + w * math.sin(2 * math.pi * k / n)) * r) for k in range(n)]

    def skin(self, ra, rb, mat, ca, cb, smooth=True):
        n = len(ra)
        for k in range(n):
            ids = [ra[k], ra[(k + 1) % n], rb[(k + 1) % n], rb[k]]
            mid = sum((self.v[i] for i in ids), Vector()) / 4
            self.face(ids, mat, mid - (Vector(ca) + Vector(cb)) / 2, smooth)

    def cyl(self, p0, p1, r0, r1, n, mat, caps=(True, True), smooth=True, cap_mat=None):
        p0 = Vector(p0); p1 = Vector(p1); ax = p1 - p0
        a = self.ring(p0, ax, r0, n); b = self.ring(p1, ax, r1, n)
        self.skin(a, b, mat, p0, p1, smooth)
        if caps[0]: self.face(a, cap_mat or mat, -ax)
        if caps[1]: self.face(b, cap_mat or mat, ax)

    def tube(self, pts, r, n, mat, caps=True, smooth=True):
        pts = [Vector(p) for p in pts]; rr = r if isinstance(r, (list, tuple)) else [r] * len(pts)
        rings = []
        for i, p in enumerate(pts):
            t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)])
            rings.append(self.ring(p, t, rr[i], n))
        for i in range(len(pts) - 1):
            self.skin(rings[i], rings[i + 1], mat, pts[i], pts[i + 1], smooth)
        if caps:
            self.face(rings[0], mat, pts[0] - pts[1]); self.face(rings[-1], mat, pts[-1] - pts[-2])

    def lathe(self, base, axis, prof, n, mat, smooth=True, caps=(False, False)):
        base = Vector(base); axis = Vector(axis).normalized(); rings = []
        for r, h in prof:
            rings.append(self.ring(base + axis * h, axis, max(r, 1e-4), n))
        for i in range(len(prof) - 1):
            self.skin(rings[i], rings[i + 1], mat if isinstance(mat, str) else mat[i], base + axis * prof[i][1], base + axis * prof[i + 1][1], smooth)
        if caps[0]: self.face(rings[0], mat if isinstance(mat, str) else mat[0], -axis)
        if caps[1]: self.face(rings[-1], mat if isinstance(mat, str) else mat[-1], axis)

    def sweep(self, sections, mat, caps=True, smooth=False):
        ids = [[self.vert(p) for p in s] for s in sections]
        cs = [sum((Vector(p) for p in s), Vector()) / len(s) for s in sections]
        for i in range(len(ids) - 1):
            self.skin(ids[i], ids[i + 1], mat, cs[i], cs[i + 1], smooth)
        if caps and len(ids) > 1:
            self.face(ids[0], mat, cs[0] - cs[1]); self.face(ids[-1], mat, cs[-1] - cs[-2])

    def mirror_y(self):
        n = len(self.v)
        self.v += [Vector((p.x, -p.y, p.z)) for p in self.v[:n]]
        for k in range(len(self.f)):
            self.f.append([i + n for i in self.f[k]][::-1]); self.fm.append(self.fm[k]); self.fs.append(self.fs[k])

    def obj(self, coll=None, weld=0.0, sharp=40):
        name = self.name if self.name.startswith(PREFIX) else PREFIX + self.name
        me = bpy.data.meshes.new(name)
        me.from_pydata([tuple(p) for p in self.v], [], self.f)
        for m in self.mats: me.materials.append(MAT[m])
        me.polygons.foreach_set('material_index', self.fm)
        me.polygons.foreach_set('use_smooth', self.fs)
        me.update()
        if not self.f:
            bpy.data.meshes.remove(me); return None
        if weld:
            import bmesh
            bm = bmesh.new(); bm.from_mesh(me)
            bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=weld)
            bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=weld / 2)
            bm.to_mesh(me); bm.free(); me.update()
        if sharp: me.set_sharp_from_angle(angle=math.radians(sharp))
        ob = bpy.data.objects.new(name, me)
        if coll: coll.objects.link(ob)
        return ob

# ------------------------------------------------------------------------------------------ materials

MAT = {}
PALETTE = {  # name: (base colour, roughness, metallic)
    'hull_black': ((0.012, 0.012, 0.014), 0.55, 0.0), 'antifouling': ((0.23, 0.045, 0.03), 0.75, 0.0),
    'white': ((0.80, 0.79, 0.74), 0.5, 0.0), 'buff': ((0.70, 0.49, 0.22), 0.5, 0.0), 'mast_brown': ((0.40, 0.25, 0.11), 0.5, 0.0),
    'teak': ((0.27, 0.13, 0.05), 0.35, 0.0), 'deck_pine': ((0.55, 0.43, 0.27), 0.75, 0.0), 'brass': ((0.78, 0.57, 0.18), 0.3, 1.0),
    'glass': ((0.02, 0.03, 0.04), 0.06, 0.0), 'canvas': ((0.72, 0.69, 0.60), 0.9, 0.0), 'iron': ((0.02, 0.02, 0.022), 0.6, 0.0),
    'rope': ((0.30, 0.23, 0.14), 0.9, 0.0), 'red_port': ((0.60, 0.02, 0.02), 0.5, 0.0), 'green_stbd': ((0.02, 0.33, 0.12), 0.5, 0.0),
    'vent_red': ((0.50, 0.05, 0.03), 0.6, 0.0), 'galvanised': ((0.33, 0.34, 0.35), 0.6, 0.0), 'gilt': ((0.85, 0.63, 0.18), 0.3, 1.0),
    'house_aft': ((0.27, 0.13, 0.05), 0.4, 0.0),
}

def make_materials():
    if MAT: return
    for name, (col, rough, metal) in PALETTE.items():
        m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
        m.use_nodes = True
        b = m.node_tree.nodes.get('Principled BSDF')
        b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
        m.diffuse_color = (*col, 1); m.roughness = rough; m.metallic = metal
        MAT[name] = m
    # deck planking: seams every 5 inches across the deck, drawn in the shader only
    nt = MAT['deck_pine'].node_tree; b = nt.nodes['Principled BSDF']
    geo = nt.nodes.new('ShaderNodeNewGeometry'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Position'], sep.inputs[0])
    wav = nt.nodes.new('ShaderNodeMath'); wav.operation = 'PINGPONG'; wav.inputs[1].default_value = 0.0635; nt.links.new(sep.outputs['Y'], wav.inputs[0])
    edge = nt.nodes.new('ShaderNodeMath'); edge.operation = 'LESS_THAN'; edge.inputs[1].default_value = 0.006; nt.links.new(wav.outputs[0], edge.inputs[0])
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.inputs['A'].default_value = (*PALETTE['deck_pine'][0], 1); mix.inputs['B'].default_value = (0.10, 0.07, 0.04, 1)
    nt.links.new(edge.outputs[0], mix.inputs['Factor']); nt.links.new(mix.outputs['Result'], b.inputs['Base Color'])

# -------------------------------------------------------------------------------------------- the hull

def stations():
    if DETAIL != 'full':
        step, sweep = (1.5, (0.0, 0.5, 0.85, 1.0)) if DETAIL == 'mid' else (4.5, (0.0, 1.0))
        xs = {X_STERN, X_STERN + 0.27, -1.75, -0.78, 0.0, X_BRIDGE_A, X_BRIDGE_F, X_FC, 50.6, 51.05, 52.06, 52.8, STEM_X}
        if DETAIL == 'mid': xs |= {X_STERN + 0.03, -2.25, -1.25, -0.3, 0.75, 49.5, 51.6, 52.45, 53.0}
        xs |= {round(step * k, 3) for k in range(1, int(48 / step) + 1)}
        xs |= {round(HANCE_A + (X_BRIDGE_A - HANCE_A) * t, 3) for t in sweep} | {round(HANCE_F - (HANCE_F - X_BRIDGE_F) * t, 3) for t in sweep}
        xs |= {round(HANCE_FC + (X_FC - HANCE_FC) * t, 3) for t in sweep}
        return sorted(x for x in xs if X_STERN <= x <= STEM_X)
    xs = set([X_STERN, X_STERN + 0.004, X_STERN + 0.012, X_STERN + 0.03, X_STERN + 0.06, X_STERN + 0.1, X_STERN + 0.18, X_STERN + 0.27, X_STERN + 0.47, -2.07, -1.75, -1.42, -1.1, -0.78, -0.45, -0.3, -0.15, 0.0])
    xs |= {round(0.25 * i, 3) for i in range(1, 13)} | {round(3 + 0.75 * i, 3) for i in range(1, 60)} | {round(48 + 0.3 * i, 3) for i in range(0, 18)}
    sweep = (0.0, 0.25, 0.45, 0.62, 0.76, 0.87, 0.95, 0.985, 1.0)  # closer stations where a hance turns upright
    xs |= {round(HANCE_A + (X_BRIDGE_A - HANCE_A) * t, 3) for t in sweep} | {round(HANCE_F - (HANCE_F - X_BRIDGE_F) * t, 3) for t in sweep}
    xs |= {round(HANCE_FC + (X_FC - HANCE_FC) * t, 3) for t in sweep}
    xs |= {X_BRIDGE_A, X_BRIDGE_F, X_FC, 50.6, 50.9, 51.05, 51.5, 52.06, 52.45, 52.8, 53.0, 53.08, STEM_X}
    return sorted(x for x in xs if X_STERN <= x <= STEM_X)

LOW_Z = [0.0, 0.02, 0.05, 0.1, 0.17, 0.28, 0.42, 0.6, 0.85, 1.14, 1.57, 2.0, 2.5, LWL, LWL + 0.14, 3.5]
UP_Z = [3.5, 4.0, 4.42, 4.9, 5.3, 5.645, 6.0, Z_BRIDGE, 6.9, 7.4, 9.0]

def hull_rows():  # waterline heights of the shell grid; the paint lines stay on rows at every level of detail
    if DETAIL == 'full': return LOW_Z, UP_Z
    if DETAIL == 'mid': return [0.0, 0.05, 0.17, 0.42, 0.85, 1.57, 2.5, LWL, LWL + 0.14, 3.5], [3.5, 4.42, 5.3, 5.645, Z_BRIDGE, 6.9, 7.4, 9.0]
    return [0.0, 0.17, 0.85, 2.0, LWL, 3.5], [3.5, 4.6, 5.645, Z_BRIDGE, 7.4, 9.0]

def build_hull(coll):
    mb = MB('hull'); X = stations(); L, U = hull_rows()
    cols = []
    for x in X:
        zk, zb, zs = z_keel(x), z_blend(x), z_sheer(x); col = []
        if x >= 0:
            for j, za in enumerate(L):
                z = zb if j == len(L) - 1 else min(max(za, zk), zb)
                col.append(mb.vert((x, hull_hb(x, z), z)))
        else:
            col += [None] * len(L)
        zde = min(zs, Z_FC(x)) if x >= X_FC else zs  # forecastle deck edge; the plating above it is the bow bulwark
        for j, za in enumerate(U):
            last = len(U) - 1
            z = zb if j == 0 else (zs if j == last else (zde if j == last - 1 else min(max(za, zb), zde)))
            if j == 0 and x >= 0: col.append(col[len(L) - 1])
            else: col.append(mb.vert((x, hull_hb(x, z), z)))
        cols.append(col)
    nl = len(L)
    for i in range(len(X) - 1):
        xm = (X[i] + X[i + 1]) / 2
        for j in range(len(cols[i]) - 1):
            if j == nl - 1: continue  # the top of the lower rows and the bottom of the upper rows are the same ring
            q = [cols[i][j], cols[i][j + 1], cols[i + 1][j + 1], cols[i + 1][j]]
            if any(k is None for k in q): continue
            if j < nl - 1:  # bottom colour to the waterline, then the white boot-top line, then black
                mat = 'antifouling' if L[j + 1] <= LWL + 1e-6 else ('white' if L[j + 1] <= LWL + 0.15 else 'hull_black')
            else:
                k = j - nl  # white strake along the bridge side; white bow bulwark (both as in the Ramsey photograph)
                mat = 'white' if ((U[k] >= 5.64 and k < len(U) - 2 and HANCE_A < xm < HANCE_F) or (k == len(U) - 2 and xm > 50.6)) else 'hull_black'
            mb.face(q, mat, Vector((0, 1, 0)) if xm > 0 else Vector((0, 0.3, -1)), True)
    mb.mirror_y()
    return mb.obj(coll, weld=0.004, sharp=50)

def deck_strip(mb, xs, zf, hbf, mat, camber=0.2, n=None):
    n = n or {'full': 6, 'mid': 4, 'far': 2}[DETAIL]
    rows = []
    for x in xs:
        hb = max(hbf(x), 0.0); z0 = zf(x)
        rows.append([mb.vert((x, hb * (2 * k / n - 1), z0 + camber * (hb / 4.27) * (1 - (2 * k / n - 1) ** 2))) for k in range(n + 1)])
    for i in range(len(rows) - 1):
        for k in range(n):
            mb.face([rows[i][k], rows[i + 1][k], rows[i + 1][k + 1], rows[i][k + 1]], mat, Vector((0, 0, 1)))

def build_decks(coll):
    X = stations(); mb = MB('decks')
    deck_strip(mb, [x for x in X if x <= X_BRIDGE_A], Z_RQD, lambda x: RQD_EDGE(x) - 0.015, 'deck_pine')
    deck_strip(mb, [x for x in X if X_BRIDGE_A <= x <= X_BRIDGE_F], lambda x: Z_BRIDGE, lambda x: hull_hb(x, Z_BRIDGE) - 0.015, 'deck_pine')
    deck_strip(mb, [x for x in X if X_BRIDGE_F <= x <= X_FC], z_main_deck, lambda x: hull_hb(x, z_main_deck(x)) - 0.05, 'deck_pine')
    deck_strip(mb, [x for x in X if x >= X_FC], Z_FC, lambda x: hull_hb(x, Z_FC(x)) - 0.015, 'deck_pine')
    # the breaks: after end of the bridge, bridge front, forecastle break
    for x, z0, z1, n in ((X_BRIDGE_A, Z_RQD(X_BRIDGE_A), Z_BRIDGE, -1), (X_BRIDGE_F, z_main_deck(X_BRIDGE_F), Z_BRIDGE, 1), (X_FC, z_main_deck(X_FC), Z_FC(X_FC), -1)):
        h0, h1 = hull_hb(x, z0), hull_hb(x, z1); cam = 0.2 * h1 / 4.27
        top = [(x, h1 * t, z1 + cam * (1 - t * t)) for t in (1, 0.5, 0, -0.5, -1)]
        mb.poly([(x, -h0, z0 - 0.02), (x, h0, z0 - 0.02)] + top, 'white', Vector((n, 0, 0)))
    # inner face of the well-deck bulwark and its teak rail
    xs = [x for x in X if X_BRIDGE_F <= x <= X_FC]
    for side in (1, -1):
        a = [mb.vert((x, side * (hull_hb(x, z_main_deck(x)) - 0.05), z_main_deck(x))) for x in xs]
        b = [mb.vert((x, side * (hull_hb(x, z_sheer(x)) - 0.05), z_sheer(x))) for x in xs]
        for i in range(len(xs) - 1):
            mb.face([a[i], a[i + 1], b[i + 1], b[i]], 'white', Vector((0, -side, 0)))
    ob = mb.obj(coll, weld=0.002)
    if DETAIL == 'far': return ob
    rail = MB('bulwark_rail')
    xs = [x for x in X if HANCE_F <= x <= HANCE_FC]
    for side in (1, -1):
        secs = []
        for x in xs:
            hb = hull_hb(x, z_sheer(x)); z = z_sheer(x)
            secs.append([(x, side * (hb - 0.19), z), (x, side * (hb + 0.04), z), (x, side * (hb + 0.04), z + 0.065), (x, side * (hb - 0.19), z + 0.065)])
        rail.sweep(secs, 'teak')
    rail.obj(coll)
    # white toe plates along the open deck edges, and the half-round mouldings on the shell
    tp = MB('toe_plates_mouldings')
    for side in (1, -1):
        for xs, zf, hf in (([x for x in X if x <= HANCE_A], Z_RQD, lambda x: RQD_EDGE(x)), ([x for x in X if X_BRIDGE_A <= x <= X_BRIDGE_F], lambda x: Z_BRIDGE, lambda x: hull_hb(x, Z_BRIDGE)),
                           ([x for x in X if X_FC <= x <= 51.5], Z_FC, lambda x: hull_hb(x, Z_FC(x)))):
            tp.sweep([[(x, side * max(hf(x) - 0.035, 0), zf(x)), (x, side * max(hf(x), 0), zf(x)), (x, side * max(hf(x), 0), zf(x) + 0.13), (x, side * max(hf(x) - 0.035, 0), zf(x) + 0.13)] for x in xs], 'white')
        if DETAIL != 'full': continue
        fz = lambda x: lin([(HANCE_FC, 6.07), (44.57, 6.39), (STEM_X, 6.55)], x)
        tp.tube([hull_point(x, fz(x), side) + hull_normal(x, fz(x), side) * 0.012 for x in X if HANCE_FC <= x <= STEM_X - 0.1], 0.03, 4, 'hull_black', smooth=False)
        # the two 3 x 1 1/2 in half-rounds written on the bridge side: at the deck edge and at the foot of the white strake
        for zm, mat in ((Z_BRIDGE - 0.03, 'white'), (5.645, 'hull_black')):
            tp.tube([hull_point(x, zm, side) + hull_normal(x, zm, side) * 0.012 for x in X if X_BRIDGE_A <= x <= X_BRIDGE_F], 0.035, 4, mat, smooth=False)
        # two freeing ports a side in the well bulwark, 28 x 25 in (survey report); their positions are not recorded
        for x0 in (33.9, 38.9):
            zf0 = z_main_deck(x0) + 0.06
            ring = [hull_point(x0 + dx, zf0 + dz, side) + hull_normal(x0 + dx, zf0 + dz, side) * 0.014 for dx, dz in ((0, 0), (0.71, 0), (0.71, 0.64), (0, 0.64), (0, 0))]
            tp.tube(ring, 0.018, 4, 'hull_black', smooth=False)
        kz = lambda x: lin([(-1.72, 5.36), (2.9, 5.06)], x)
        tp.tube([hull_point(x, kz(x), side) + hull_normal(max(x, 0.3), kz(x), side) * 0.012 for x in [-1.715] + [x for x in X if -1.7 < x <= 2.9]], 0.03, 4, 'hull_black', smooth=False)
    tp.obj(coll)
    return ob

def gangway_doors(coll):
    """Hinged bulwark sections in the well: both sides abreast the fore hatch, and the buoy gangway to starboard."""
    mb = MB('gangways')
    for side, x0, x1 in ((1, 34.87, 37.59), (-1, 34.87, 37.59), (-1, 40.80, 43.61)):
        for xa, xb in ((x0, x0 + 0.06), (x1 - 0.06, x1), ((x0 + x1) / 2 - 0.03, (x0 + x1) / 2 + 0.03)):
            secs = []
            for z in (z_main_deck(xa) + 0.12, z_sheer(xa) - 0.02):
                p = hull_point((xa + xb) / 2, z, side); n = hull_normal((xa + xb) / 2, z, side)
                secs.append([p + Vector((xa - (xa + xb) / 2, 0, 0)) - n * 0.01, p + Vector((xb - (xa + xb) / 2, 0, 0)) - n * 0.01,
                             p + Vector((xb - (xa + xb) / 2, 0, 0)) + n * 0.02, p + Vector((xa - (xa + xb) / 2, 0, 0)) + n * 0.02])
            mb.sweep(secs, 'hull_black')
        for z in (z_main_deck(x0) + 0.12,):
            pts = [hull_point(x, z, side) + hull_normal(x, z, side) * 0.012 for x in (x0, (x0 + x1) / 2, x1)]
            mb.tube(pts, 0.022, 4, 'hull_black', smooth=False)
    return mb.obj(coll)

# --------------------------------------------------------------------------------------------- rails

def resample(path, step):
    out = [Vector(path[0])]; acc = 0.0
    for a, b in zip(path, path[1:]):
        a = Vector(a); b = Vector(b); L = (b - a).length; d = step - acc
        while d <= L:
            out.append(a + (b - a) * (d / L)); d += step
        acc = (acc + L) % step
    if (out[-1] - Vector(path[-1])).length > step * 0.35: out.append(Vector(path[-1]))
    else: out[-1] = Vector(path[-1])
    return out

def rail_run(mb, path, height=1.05, courses=(0.36, 0.70), step=1.45, top='white'):
    if DETAIL == 'far': return
    if DETAIL == 'mid': step *= 2; courses = courses[:1]
    path = [Vector(p) for p in path]
    for p in resample(path, step):
        mb.cyl(p, p + Vector((0, 0, height)), 0.022, 0.018, 4, 'white', caps=(False, False), smooth=False)
    mb.tube([p + Vector((0, 0, height)) for p in path], 0.028, 4, top, smooth=False)
    for c in courses:
        mb.tube([p + Vector((0, 0, c)) for p in path], 0.011, 3, 'galvanised', smooth=False)

# Structures on the decks, from the corrected deck plans and inboard profile (measurements.md sections 1 and 2).
ZC = Z_BRIDGE + 0.18 + 0.46                      # casing coamings: written 18 in above the bridge deck planking
HOUSE_X0, HOUSE_X1, HOUSE_HW, HOUSE_Z1 = 1.51, 6.10, 1.23, 8.15   # after steel deckhouse, 15 ft long and 7 ft high
ENGINE_CASING, BOILER_CASING, CASING_HW = (18.03, 21.36), (24.00, 27.36), 1.18
WH_X0, WH_X1, WH_HW = 27.34, 31.04, 1.6          # chart house and steam steering gear house; no plan gives its width
WH_Z1 = Z_BRIDGE + 0.18 + 1.93                   # wall top; the roof oversails the front wall by 0.96 m
WH_TOP = WH_Z1 + 0.12
WH_ROOF_X1 = X_BRIDGE_F + 0.19

def build_rails(coll):
    mb = MB('rails'); X = stations()
    # raised quarter deck, round the stern: an open rail about 3 ft high with three courses (midship section)
    port = [Vector((x, RQD_EDGE(x) - 0.07, Z_RQD(x))) for x in X if X_STERN + 0.03 <= x <= X_BRIDGE_A - 1.0]
    stbd = [Vector((p.x, -p.y, p.z)) for p in port]
    rail_run(mb, port, 0.95); rail_run(mb, stbd, 0.95)
    rail_run(mb, [stbd[0], Vector((X_STERN + 0.05, 0, Z_RQD(X_STERN))), port[0]], 0.95, step=0.5)
    xa = X_BRIDGE_A + 0.07
    for side in (1, -1):
        # bridge deck sides, and its after end clear of the ladders and the teak companion to starboard
        rail_run(mb, [Vector((x, side * (hull_hb(x, Z_BRIDGE) - 0.07), Z_BRIDGE)) for x in [xa] + [x for x in X if xa < x <= X_BRIDGE_F - 1.25]], 1.0)
        rail_run(mb, [Vector((xa, side * (hull_hb(xa, Z_BRIDGE) - 0.07), Z_BRIDGE)), Vector((xa, side * (1.3 if side > 0 else 2.7), deck_surface(xa, 1.3)))], 1.0)
        # forecastle sides as far as the bow bulwark, and its after end clear of the ladders
        fc = [Vector((x, side * (hull_hb(x, Z_FC(x)) - 0.07), Z_FC(x))) for x in [X_FC + 0.08] + [x for x in X if X_FC + 0.08 < x <= 50.6]]
        rail_run(mb, fc, 0.95)
        rail_run(mb, [fc[0], Vector((X_FC + 0.08, side * 2.3, deck_surface(X_FC + 0.08, 2.3)))], 0.95)
    rail_run(mb, [Vector((X_FC + 0.08, -1.4, deck_surface(X_FC + 0.08, 1.4))), Vector((X_FC + 0.08, 1.4, deck_surface(X_FC + 0.08, 1.4)))], 0.95)
    return mb.obj(coll)

# ----------------------------------------------------------------------------------- deck structures

def house(mb, x0, x1, hw, z0, z1, wall, roof='white', overhang=0.12, crown=0.08):
    mb.box(x0, x1, -hw, hw, z0, z1, wall, skip='-z+z')
    secs = []
    for x in (x0 - overhang, x1 + overhang):
        secs.append([(x, -hw - overhang, z1), (x, hw + overhang, z1), (x, hw + overhang, z1 + 0.05), (x, 0, z1 + 0.05 + crown), (x, -hw - overhang, z1 + 0.05)])
    mb.sweep(secs, roof)

def panel(mb, c, n, u, w, h, mat, d=0.02):
    """A flat panel (door, window) centred at c on a wall with outward normal n; u is the horizontal direction."""
    if DETAIL == 'far': return
    c = Vector(c); n = Vector(n); u = Vector(u); v = Vector((0, 0, 1))
    p = [c + u * a * w / 2 + v * b * h / 2 for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    mb.sweep([[q + n * 0.002 for q in p], [q + n * d for q in p]], mat)

def port_light(mb, c, n, r=0.15):
    if DETAIL == 'far': return
    c = Vector(c); n = Vector(n).normalized()
    if DETAIL == 'mid':  # a dark disc is all that reads beyond a couple of hundred metres
        mb.face(mb.ring(c + n * 0.012, n, r * 0.8, 12), 'glass', n); return
    a = mb.ring(c + n * 0.006, n, r, 10); b = mb.ring(c + n * 0.03, n, r, 10); d = mb.ring(c + n * 0.03, n, r * 0.72, 10); e = mb.ring(c + n * 0.012, n, r * 0.72, 10)
    mb.skin(a, b, 'brass', c, c + n * 0.03, False)
    for k in range(10):
        mb.face([b[k], b[(k + 1) % 10], d[(k + 1) % 10], d[k]], 'brass', n)
        mb.face([d[k], d[(k + 1) % 10], e[(k + 1) % 10], e[k]], 'brass', -(mb.v[d[k]] - c).normalized())
    mb.face(e, 'glass', n)

def ladder_x(mb, x0, x1, y, width=0.65):
    """Fore-and-aft deck ladder from the planking at x0 to the planking at x1, with handrails."""
    if DETAIL != 'full': return
    z0, z1 = deck_surface(x0, y), deck_surface(x1, y); n = max(3, round(abs(z1 - z0) / 0.22))
    for s in (-1, 1):
        ys = y + s * width / 2
        mb.tube([(x0, ys, z0), (x1, ys, z1)], 0.03, 4, 'white', smooth=False)
        mb.tube([(x0, ys, z0 + 0.9), (x1, ys, z1 + 0.9)], 0.018, 4, 'white', smooth=False)
        for xa, za in ((x0, z0), (x1, z1)):
            mb.cyl((xa, ys, za), (xa, ys, za + 0.9), 0.018, 0.018, 4, 'white', caps=(False, False), smooth=False)
    for k in range(1, n):
        t = k / n; x = x0 + (x1 - x0) * t; z = z0 + (z1 - z0) * t
        mb.box(x - 0.11, x + 0.11, y - width / 2, y + width / 2, z - 0.015, z + 0.015, 'teak')

def build_structures(coll):
    mb = MB('structures')
    for side in (1, -1):
        ladder_x(mb, X_BRIDGE_A - 1.0, X_BRIDGE_A + 0.02, side * 0.85)     # quarter deck up to the bridge deck
        ladder_x(mb, X_BRIDGE_F + 1.75, X_BRIDGE_F - 0.01, side * 2.55)    # well deck up to the bridge deck
        ladder_x(mb, X_FC - 1.55, X_FC + 0.01, side * 1.85)                # well deck up to the forecastle
        zw = deck_surface(X_BRIDGE_F + 0.1, 1.5)
        panel(mb, (X_BRIDGE_F, side * 1.45, zw + 0.92), (1, 0, 0), (0, 1, 0), 0.65, 1.8, 'teak', 0.025)
        port_light(mb, (X_BRIDGE_F, side * 0.5, zw + 1.35), (1, 0, 0), 0.14); port_light(mb, (X_BRIDGE_F, side * 3.3, zw + 1.3), (1, 0, 0), 0.14)
        zw = deck_surface(X_FC - 0.1, 0.8)
        panel(mb, (X_FC, side * 0.75, zw + 0.92), (-1, 0, 0), (0, 1, 0), 0.65, 1.8, 'teak', 0.025)
        port_light(mb, (X_FC, side * 2.75, zw + 1.35), (-1, 0, 0), 0.14)
    # raised quarter deck: the steel deckhouse
    z0 = Z_RQD(3.8) + 0.1
    house(mb, HOUSE_X0, HOUSE_X1, HOUSE_HW, z0, HOUSE_Z1, 'house_aft')
    for side in (1, -1):
        panel(mb, (HOUSE_X0 + 0.65, side * HOUSE_HW, z0 + 1.0), (0, side, 0), (1, 0, 0), 0.62, 1.75, 'teak')
        for x in (2.84, 4.64): port_light(mb, (x, side * HOUSE_HW, 7.5), (0, side, 0), 0.14)
        port_light(mb, (HOUSE_X1, side * 0.62, 7.55), (1, 0, 0), 0.14)
    # bridge deck: separate engine and boiler casings with open deck between them
    for x0, x1 in (ENGINE_CASING, BOILER_CASING):
        mb.box(x0, x1, -CASING_HW, CASING_HW, Z_BRIDGE, ZC, 'white', skip='-z')
        for side in (1, -1):
            for x in (x0 + 0.75, x1 - 0.75):
                panel(mb, (x, side * CASING_HW, Z_BRIDGE + 0.42), (0, side, 0), (1, 0, 0), 0.5, 0.36, 'white', 0.015)
    # chart house and steam steering gear house: teak, five windows a side; its roof is the flying bridge
    # The boiler casing stands hard against its after wall and the rigging plan draws no door to starboard, so the door
    # is in the port side, in place of the aftermost window.
    zd = Z_BRIDGE + 0.18
    if INT and DETAIL == 'full':
        INT.wheelhouse_outer(sys.modules[__name__], mb)   # real window openings, for standing inside
    else:
        mb.box(WH_X0, WH_X1, -WH_HW, WH_HW, Z_BRIDGE, WH_Z1, 'teak', skip='-z+z')
        for side in (1, -1):
            for k in range(5):
                if side > 0 and k == 0: panel(mb, (27.777, WH_HW, zd + 0.92), (0, 1, 0), (1, 0, 0), 0.6, 1.74, 'teak', 0.025)
                else: panel(mb, (27.777 + k * 0.594, side * WH_HW, 8.035), (0, side, 0), (1, 0, 0), 0.46, 0.71, 'glass', 0.012)
        for y in (-1.0, 0.0, 1.0): panel(mb, (WH_X1, y, 8.035), (1, 0, 0), (0, 1, 0), 0.7, 0.71, 'glass', 0.012)
    mb.box(WH_X0 - 0.16, WH_ROOF_X1, -WH_HW - 0.25, WH_HW + 0.25, WH_Z1, WH_TOP, 'white')
    top = MB('bridge_top')
    xr = WH_ROOF_X1 - 0.05
    r = [Vector((WH_X0 - 0.1, -WH_HW - 0.2, WH_TOP)), Vector((xr, -WH_HW - 0.2, WH_TOP)), Vector((xr, WH_HW + 0.2, WH_TOP)), Vector((WH_X0 - 0.1, WH_HW + 0.2, WH_TOP))]
    rail_run(top, r + [r[0]], 0.95, step=1.0)
    # white canvas weather cloths round the fore end of the flying bridge (Ramsey photograph)
    zr = WH_TOP + 0.04; yy = WH_HW + 0.2
    for a, b, n in (((xr, -yy), (xr, yy), (1, 0, 0)), ((xr - 2.35, yy), (xr, yy), (0, 1, 0)), ((xr - 2.35, -yy), (xr, -yy), (0, -1, 0))):
        top.poly([(a[0], a[1], zr), (b[0], b[1], zr), (b[0], b[1], zr + 0.84), (a[0], a[1], zr + 0.84)], 'canvas', Vector(n))
    # teak dodger across the fore end of the bridge deck (dark in the photograph, panelled on the rigging plan)
    xf = X_BRIDGE_F - 0.05; hbf = hull_hb(xf, Z_BRIDGE) - 0.04
    for a, b in (((xf - 1.25, hbf), (xf, hbf)), ((xf, hbf), (xf, -hbf)), ((xf, -hbf), (xf - 1.25, -hbf))):
        mb.box(min(a[0], b[0]) - 0.025, max(a[0], b[0]) + 0.025, min(a[1], b[1]) - 0.025, max(a[1], b[1]) + 0.025, Z_BRIDGE, Z_BRIDGE + 0.96, 'teak', skip='-z')
    # steering gear cover and grating right aft
    mb.box(-2.05, -0.15, -0.95, 0.95, Z_RQD(-1.1) + 0.1, 7.1, 'teak', skip='-z')
    ob = mb.obj(coll, weld=0.0005); top.obj(coll)
    return ob

# -------------------------------------------------------------------------------------- funnel, masts

# Base and top from the rigging plan. That plan draws the funnel 2.05 m across and the Ramsey photograph shows
# about 2.2 m; the inboard profiles draw only the inner flue (1.7 to 1.8 m).
FUNNEL_BASE, FUNNEL_TOP, FUNNEL_D = Vector((25.19, 0, ZC)), Vector((23.69, 0, 15.35)), 2.1

def build_funnel(coll):
    mb = MB('funnel'); ax = (FUNNEL_TOP - FUNNEL_BASE); L = ax.length; a = ax.normalized(); r = FUNNEL_D / 2
    prof = [(r + 0.14, -0.12), (r + 0.14, 0.10), (r + 0.02, 0.26), (r, 0.30), (r, L * 0.775), (r + 0.035, L * 0.778), (r + 0.035, L * 0.80), (r, L * 0.803),
            (r, L - 0.10), (r + 0.045, L - 0.09), (r + 0.045, L), (r - 0.05, L), (r - 0.05, L - 1.2)]
    mats = ['buff'] * 10 + ['iron', 'iron']
    mb.lathe(FUNNEL_BASE, a, prof, 28, mats, caps=(False, True))
    # waste-steam pipe on the fore side, with the whistle bracket
    fwd = (Vector((1, 0, 0)) - a * a.x).normalized()
    p0 = FUNNEL_BASE + fwd * (r + 0.11); p1 = p0 + a * (L - 0.5)
    if DETAIL != 'far':
        mb.cyl(p0, p1, 0.07, 0.07, 8, 'buff'); mb.cyl(p1, p1 + a * 0.12, 0.09, 0.09, 8, 'brass')
    if DETAIL == 'full':
        for h in (0.3, 0.6, 0.85):
            c = p0 + a * (L * h); mb.box(c.x - 0.14, c.x + 0.02, -0.09, 0.09, c.z - 0.02, c.z + 0.02, 'buff')
        # Steam siren beside the whistle: Muirhead's report has Captain Harvie sound 'the steam whistle and siren' on
        # 26 December 1900. A trumpet on a short pipe, on the fore side of the funnel; its place there is not recorded.
        s0 = FUNNEL_BASE + a * 3.6 + Vector((r + 0.3, 0.32, 0))
        mb.cyl(s0 - Vector((0.3, 0, 0)), s0, 0.035, 0.035, 6, 'brass')
        mb.lathe(s0, Vector((1, 0, 0.12)), [(0.05, 0.0), (0.06, 0.18), (0.09, 0.4), (0.17, 0.62), (0.2, 0.66)], 10, 'brass', caps=(True, False))
    ob = mb.obj(coll, sharp=35)
    if DETAIL == 'far': return ob
    rg = MB('funnel_guys'); band = FUNNEL_BASE + a * (L * 0.79)
    for sx in (21.2, 27.3):
        for side in (1, -1):
            rg.tube([band + Vector((0, side * r * 0.9, 0)), Vector((sx, side * (hull_hb(sx, Z_BRIDGE) - 0.2), Z_BRIDGE + 0.05))], 0.012 * (2 if DETAIL == 'mid' else 1), 3, 'iron', smooth=False)
    rg.obj(coll)
    return ob

ENSIGN_HEEL, ENSIGN_HEAD = Vector((-2.03, 0, 6.39)), Vector((-4.68, 0, 10.29))   # ensign staff, raked aft 34 degrees (rigging plan)
MASTS = {  # truck, lower masthead, heel; diameters at partners and at the masthead (survey report, mast plan)
    'fore': dict(truck=Vector((36.99, 0, 25.64)), hounds=Vector((38.40, 0, 17.51)), heel=Vector((41.19, 0, 0.5)), d0=0.394, d1=0.318, cleats=6.4,
                 shrouds=(38.44, 38.96, 39.60), chain_z=lambda x: z_sheer(x)),
    'main': dict(truck=Vector((6.90, 0, 25.35)), hounds=Vector((8.74, 0, 17.42)), heel=Vector((12.12, 0, 2.68)), d0=0.368, d1=0.292, cleats=7.5,
                 shrouds=(9.45, 9.90, 10.37), chain_z=lambda x: Z_RQD(x)),
}

def mast_at(m, z):
    a, b = m['heel'], m['truck']
    return a + (b - a) * ((z - a.z) / (b.z - a.z))

def build_masts(coll):
    mb = MB('masts'); rg = MB('rigging')
    # At a distance wire vanishes and spars thin to nothing, so the lighter models carry stouter spars and wire.
    tk = {'full': 1.0, 'mid': 1.15, 'far': 1.7}[DETAIL]
    spar = mb.tube; mb.tube = lambda pts, r, n, mat, **k: spar(pts, [q * tk for q in r] if isinstance(r, (list, tuple)) else r * tk, n, mat, **k)
    wire = rg.tube
    rg.tube = (lambda *a, **k: None) if DETAIL == 'far' else (lambda pts, r, n, mat, **k: wire(pts, r * (2.2 if DETAIL == 'mid' else 1), n, mat, **k))
    for key, m in MASTS.items():
        ax = (m['truck'] - m['heel']).normalized(); deck = mast_at(m, z_deck(mast_at(m, 6.0).x) - 0.3)
        band = m['hounds'] + (m['truck'] - m['hounds']) * 0.77   # the topmast stay band
        mb.tube([deck, m['hounds'], band, m['truck']], [m['d0'] / 2, m['d1'] / 2, 0.075, 0.042], 12, 'mast_brown')
        # One straight pole: the steel lower mast with the wooden topmast continuing in line (mast plan). No crosstrees, cap, gaff or boom is drawn.
        for c, rr in ((m['hounds'], m['d1'] / 2 + 0.03), (band, 0.095), (mast_at(m, m['cleats']), m['d0'] / 2 + 0.035)): mb.cyl(c - ax * 0.05, c + ax * 0.05, rr, rr, 12, 'iron')




        mb.lathe(m['truck'], ax, [(0.045, 0.0), (0.075, 0.03), (0.075, 0.07), (0.02, 0.10)], 8, 'gilt', caps=(False, True))
        # shrouds with ratlines, topmast backstay
        for side in (1, -1):
            feet = [Vector((x, side * (hull_hb(x, m['chain_z'](x)) - 0.03), m['chain_z'](x) + 0.05)) for x in m['shrouds']]
            tops = [m['hounds'] + Vector((0.0, side * 0.2, 0.0)) for _ in feet]
            for f, t in zip(feet, tops): rg.tube([f, t], 0.014, 3, 'iron', smooth=False)
            for k in (range(1, 15) if DETAIL == 'full' else ()):
                s = 0.1 + 0.058 * k
                rg.tube([feet[0] + (tops[0] - feet[0]) * s, feet[-1] + (tops[-1] - feet[-1]) * s], 0.007, 3, 'rope', smooth=False)

    f, a = MASTS['fore'], MASTS['main']
    stem_head = Vector((STEM_X - 0.1, 0, z_sheer(STEM_X) + 0.05))
    rg.tube([f['hounds'] + Vector((0.2, 0, 0)), stem_head], 0.016, 3, 'iron', smooth=False)           # forestay
    rg.tube([f['hounds'] + (f['truck'] - f['hounds']) * 0.77, stem_head + Vector((0.05, 0, 0.3))], 0.011, 3, 'iron', smooth=False)  # fore topmast stay
    rg.tube([a['hounds'] + Vector((0.2, 0, 0)), Vector((23.6, 0, 7.6))], 0.016, 3, 'iron', smooth=False)             # mainstay, landing just abaft the funnel
    rg.tube([a['hounds'] + (a['truck'] - a['hounds']) * 0.77, Vector((23.6, 0, 7.6))], 0.011, 3, 'iron', smooth=False)  # main topmast stay, to the same place
    # derricks: one on the mainmast working the after hatch, two on the foremast (heel and head from the rigging plan)
    for heel, head, mast in ((Vector((11.26, 0, 8.03)), Vector((14.58, 0, 11.55)), a), (Vector((40.39, 0, 7.0)), Vector((45.39, 0, 12.13)), f), (Vector((39.87, 0, 7.03)), Vector((36.6, 0, 10.26)), f)):
        d = (head - heel).normalized()
        mb.tube([heel, heel + (head - heel) * 0.5, head], [0.085, 0.10, 0.07], 8, 'mast_brown')
        mb.cyl(heel - d * 0.12, heel + d * 0.06, 0.11, 0.11, 8, 'iron'); mb.cyl(head - d * 0.1, head, 0.085, 0.085, 8, 'iron')
        rg.tube([head, mast['hounds'] - Vector((0, 0, 0.3))], 0.011, 3, 'rope', smooth=False)      # topping lift
        rg.tube([head, Vector((head.x, 0, z_deck(head.x) + 1.4))], 0.009, 3, 'rope', smooth=False)  # cargo fall
        mb.box(head.x - 0.07, head.x + 0.07, -0.05, 0.05, z_deck(head.x) + 1.15, z_deck(head.x) + 1.4, 'iron')
    # ensign staff and jackstaff
    mb.tube([ENSIGN_HEEL, ENSIGN_HEAD], [0.045, 0.022], 6, 'mast_brown')
    mb.cyl((51.7, 0, Z_FC(51.7)), (51.7, 0, 8.33), 0.06, 0.05, 8, 'white'); mb.cyl((51.7, 0, 8.33), (51.7, 0, 8.39), 0.085, 0.085, 8, 'white')
    mb.obj(coll, sharp=35); rg.obj(coll, sharp=0)

# ------------------------------------------------------------------------------------- side scuttles

PORTS = {  # x, z from the rigging plan
    'rqd': [(0.29, 5.645), (2.52, 5.52), (4.13, 5.45), (5.84, 5.39), (6.97, 5.32), (8.03, 5.32), (9.13, 5.26), (10.84, 5.23)],
    'bridge': [(17.0, 5.97), (18.68, 5.97), (20.9, 5.97), (22.1, 5.97), (23.19, 5.97), (25.97, 5.97), (28.19, 5.97), (30.42, 5.97)],
    # The rigging plan also draws four scuttles high on the forecastle side (x 45.6-49.6, z 6.5-6.7). The Ramsey
    # photograph shows the ship's name in that band and no scuttles, so they are left out.
    'lower': [(43.29, 4.32), (45.03, 4.34), (46.71, 4.42), (48.42, 4.53), (50.06, 4.645)],
}

# Port side of the bridge strake as photographed at Ramsey: two scuttles sit about 0.9 m further forward than on
# the starboard side drawn in the rigging plan.
PORTS_PORT_SIDE = {'bridge': [(17.0, 5.97), (18.6, 5.97), (20.8, 5.97), (23.0, 5.97), (24.1, 5.97), (25.9, 5.97), (28.1, 5.97), (30.42, 5.97)]}

def build_ports(coll):
    mb = MB('side_scuttles')
    for key, row in PORTS.items():
        for side in (1, -1):
            for x, z in (PORTS_PORT_SIDE.get(key, row) if side > 0 else row):
                port_light(mb, hull_point(x, z, side), hull_normal(x, z, side))
    return mb.obj(coll, sharp=0)

# --------------------------------------------------------------------------- underwater, name, badge

def build_underwater(coll):
    mb = MB('rudder_shafts')
    out = [(0.0, 4.5), (-0.19, 4.5), (-0.75, 3.7), (-1.06, 3.1), (-1.36, 2.3), (-1.48, 1.55), (-1.3, 0.8), (-0.9, 0.26), (-0.3, 0.02), (0.0, 0.02)]
    zw = LWL + 0.14  # rudder and post are painted with the hull: bottom colour below the boot-top, black above
    low = [(0.0, zw), (-1.04, zw)] + out[4:]
    high = out[:3] + [(-1.04, zw), (0.0, zw)]
    for part, mat in ((low, 'antifouling'), (high, 'hull_black')):
        mb.sweep([[(x, -0.04, z) for x, z in part], [(x, 0.04, z) for x, z in part]], mat)
    mb.cyl((-0.02, 0, 0.0), (-0.02, 0, zw), 0.09, 0.09, 8, 'antifouling'); mb.cyl((-0.02, 0, zw), (-0.02, 0, 4.6), 0.09, 0.09, 8, 'hull_black')
    for side in ((1, -1) if DETAIL != 'far' else ()):
        mb.cyl((9.0, side * 1.3, 1.67), (1.55, side * 1.55, 1.42), 0.11, 0.11, 8, 'antifouling')
        mb.tube([(10.5, side * 1.26, 1.72), (8.6, side * 1.31, 1.66), (6.4, side * 1.38, 1.58), (5.2, side * 1.43, 1.54)], [0.5, 0.42, 0.26, 0.15], 10, 'antifouling')  # shaft bossing
        mb.tube([(1.9, side * 1.55, 1.44), (2.2, side * 0.75, 2.6)], 0.07, 4, 'antifouling', smooth=False)
        mb.tube([(1.9, side * 1.55, 1.44), (2.2, side * 1.25, 2.9)], 0.07, 4, 'antifouling', smooth=False)
    mb.obj(coll)
    if FIT and DETAIL == 'full':
        for side in (1, -1):
            place(FIT.propeller('HSP_propeller_' + ('P' if side > 0 else 'S'), diameter=2.79, blades=3, right_handed=side < 0), coll, (1.35, side * 1.68, 1.47))   # 9 ft 2 in, three blades (machinery report)

def build_name(coll):
    for side in (1, -1):
        # small widely spaced capitals, about 3.4 m overall, as in the Ramsey photograph
        cu = bpy.data.curves.new(PREFIX + 'name_curve', 'FONT'); cu.body = 'HESPERUS'; cu.size = 0.23; cu.extrude = 0.006; cu.align_x = 'LEFT'
        tmp = bpy.data.objects.new(PREFIX + 'name_tmp', cu); coll.objects.link(tmp)
        vl = SCENE.view_layers[0]
        for attempt in range(4):
            vl.update(); me = bpy.data.meshes.new_from_object(tmp.evaluated_get(vl.depsgraph))
            width = max(v.co.x for v in me.vertices)
            if abs(width - 3.4) < 0.15 or attempt == 3: break
            bpy.data.meshes.remove(me); cu.space_character *= 3.4 / width
        bpy.data.objects.remove(tmp); bpy.data.curves.remove(cu)
        me.materials.append(MAT['gilt'])
        xc = NAME_X; z = Z_FC(xc) - 0.5
        n = hull_normal(xc, z, side); t = Vector((1, side * (hull_hb(xc + 0.5, z) - hull_hb(xc - 0.5, z)), 0)).normalized()
        ex = -t * side; ex = (ex - n * ex.dot(n)).normalized(); ey = n.cross(ex)
        p0 = hull_point(xc, z, side) + n * 0.012 - ex * width / 2
        ob = bpy.data.objects.new(PREFIX + 'name_' + ('P' if side > 0 else 'S'), me); coll.objects.link(ob)
        ob.matrix_world = Matrix(((ex.x, ey.x, n.x, p0.x), (ex.y, ey.y, n.y, p0.y), (ex.z, ey.z, n.z, p0.z), (0, 0, 0, 1)))

NAME_X = 46.3

# ------------------------------------------------------------------------------------------ fittings

def place(ob, coll, loc, rz=0.0, rx=0.0, ry=0.0):
    if ob.name not in coll.objects: coll.objects.link(ob)
    ob.location = loc; ob.rotation_euler = (rx, ry, rz)
    return ob

def fallback_boat(name, length, beam, depth):
    mb = MB(name); n = 6 if DETAIL == 'far' else 12; rows = []
    for i in range(n + 1):
        t = i / n; x = (t - 0.5) * length; w = beam / 2 * (1 - abs(2 * t - 1) ** 2.6) ** 0.6; zk = depth * 0.35 * abs(2 * t - 1) ** 4
        rows.append([mb.vert((x, s * w * f, zk + (depth - zk) * g + depth * 0.12 * abs(2 * t - 1) ** 2 * (g == 1))) for s in (1, -1) for f, g in ((0, 0), (0.6, 0.18), (0.92, 0.6), (1.0, 1.0))])
    for i in range(n):
        for k in (0, 1, 2, 4, 5, 6):
            mb.face([rows[i][k], rows[i][k + 1], rows[i + 1][k + 1], rows[i + 1][k]], 'white', Vector((0, 1 if k < 4 else -1, -0.3)), True)
        mb.face([rows[i][3], rows[i][7], rows[i + 1][7], rows[i + 1][3]], 'canvas', Vector((0, 0, 1)))
    return mb.obj(None, weld=0.001)

def fallback_davit(name, height=2.3, reach=0.9):
    mb = MB(name)
    pts = [Vector((0, 0, 0)), Vector((0, 0, height - reach))] + [Vector((reach * (1 - math.cos(a)), 0, height - reach + reach * math.sin(a))) for a in (0.4, 0.8, 1.2, math.pi / 2)]
    mb.tube(pts, [0.06, 0.055, 0.05, 0.045, 0.04, 0.035], 6, 'white')
    return mb.obj(None)

def fallback_cowl(name, height=3.05, trunk_d=0.5, mouth_d=0.95):
    mb = MB(name); r = trunk_d / 2; R = mouth_d / 2; bend = 0.55
    pts = [Vector((0, 0, 0)), Vector((0, 0, height - bend))] + [Vector((bend * (1 - math.cos(a)), 0, height - bend + bend * math.sin(a))) for a in (0.5, 1.0, math.pi / 2)]
    pts.append(pts[-1] + Vector((0.12, 0, 0)))
    mb.tube(pts, [r, r, r * 1.15, r * 1.45, R * 0.95, R], 12, 'buff', caps=False)
    return mb.obj(None)

def simple_fittings(coll):
    """Stand-ins for the fittings that still read at a distance: boats, davits, cowls, hatches, skylights, windlass."""
    mb = MB('fittings')
    for side, tag in ((1, 'P'), (-1, 'S')):
        for nm, ln, bm, dp, pos in (('aft', 7.35, 1.95, 0.8, (19.78, side * 2.88, Z_BRIDGE + 0.32)), ('fwd', 6.0, 1.75, 0.72, (27.6, side * 3.0, Z_BRIDGE + 0.48))):
            place(fallback_boat(f'{PREFIX}boat_{nm}_{tag}', ln, bm, dp), coll, pos)
        place(fallback_cowl(f'{PREFIX}cowl_stokehold_{tag}', height=4.3, trunk_d=0.6, mouth_d=1.2), coll, (26.45, side * 0.72, ZC))
        if DETAIL == 'mid':
            for x in (17.87, 23.5, 25.06, 30.55):
                place(fallback_davit(f'{PREFIX}davit_{x:.0f}_{tag}', height=2.55, reach=0.85), coll, (x, side * (hull_hb(x, Z_BRIDGE) - 0.03), Z_BRIDGE), rz=math.pi)
    if DETAIL == 'mid':
        for x0, x1, hw, h, mat in ((6.15, 8.05, 0.65, 0.9, 'teak'), (13.36, 15.59, 1.06, 0.4, 'canvas'), (ENGINE_CASING[0] + 0.1, ENGINE_CASING[1] - 0.1, 1.0, None, 'teak'),
                                   (35.66, 38.48, 1.22, 0.4, 'canvas'), (34.55, 35.66, 0.51, 0.4, 'canvas'), (46.6, 48.1, 1.1, 0.95, 'iron')):
            z0 = ZC if h is None else deck_surface((x0 + x1) / 2) - 0.05
            mb.box(x0, x1, -hw, hw, z0, z0 + (0.6 if h is None else h + 0.05), mat, skip='-z')
    mb.obj(coll)

def build_fittings(coll):
    if DETAIL != 'full': return simple_fittings(coll)
    F = FIT
    boat = (lambda n, **k: F.ships_boat(n, **k)) if F else (lambda n, length=7.35, beam=2.0, depth=0.8, **k: fallback_boat(n, length, beam, depth))
    davit = (lambda n, **k: F.radial_davit(n, **k)) if F else (lambda n, **k: fallback_davit(n, **k))
    cowl = (lambda n, **k: F.cowl_vent(n, **k)) if F else (lambda n, **k: fallback_cowl(n, **k))
    ch = MB('boat_chocks')
    for side, tag in ((1, 'P'), (-1, 'S')):
        # 24 ft boat abaft the funnel, 17 ft 8 in boat abreast the wheelhouse, each under a pair of radial davits
        place(boat(f'HSP_boat_aft_{tag}', length=7.35, beam=1.95, depth=0.8), coll, (19.78, side * 2.88, Z_BRIDGE + 0.32))
        place(boat(f'HSP_boat_fwd_{tag}', length=6.0, beam=1.75, depth=0.72, transom=True), coll, (27.6, side * 3.0, Z_BRIDGE + 0.48))
        for x in (17.87, 23.5, 25.06, 30.55):
            # radial davits turned in over the boats, heads aft as the rigging plan draws them
            place(davit(f'HSP_davit_{x:.0f}_{tag}', height=2.55, reach=0.85), coll, (x, side * (hull_hb(x, Z_BRIDGE) - 0.03), Z_BRIDGE), rz=math.pi + side * 0.8)
        for x, y, z in ((18.2, 2.88, Z_BRIDGE + 0.32), (21.6, 2.88, Z_BRIDGE + 0.32), (26.5, 3.0, Z_BRIDGE + 0.48), (29.2, 3.0, Z_BRIDGE + 0.48)):
            ch.box(x - 0.06, x + 0.06, side * y - 0.55, side * y + 0.55, Z_BRIDGE, z + 0.12, 'white', skip='-z')
        # Stokehold ventilators. The rigging plan draws the cowl 3.1 m above the bridge deck; in the Ramsey photograph
        # it stands about 5.1 m above it, a little over half the funnel's height, with a mouth near 1.3 m across.
        place(cowl(f'HSP_cowl_stokehold_{tag}', height=4.3, trunk_d=0.6, mouth_d=1.2), coll, (26.45, side * 0.72, ZC))
        # white swan-neck ventilators at the after end of the forecastle (Ramsey photograph): the library's when it is there
        if not (F and hasattr(F, 'swan_neck_vent')):
            b = Vector((45.2, side * 2.1, Z_FC(45.2) + 0.1))
            ch.tube([b, b + Vector((0, 0, 0.85))] + [b + Vector((0.16 * (1 - math.cos(a)), 0, 0.85 + 0.16 * math.sin(a))) for a in (0.6, 1.2, 1.9, 2.5, math.pi)] + [b + Vector((0.32, 0, 0.72))], 0.075, 8, 'white')
    # anchor davit on the forecastle, head turned aft
    place(davit('HSP_davit_anchor', height=1.9, reach=1.25), coll, (51.45, 0, Z_FC(51.45) + 0.12), rz=math.pi)
    if not F:
        ch.obj(coll); return
    on = lambda x, y=0.0, dz=-0.02: (x, y, deck_surface(x, y) + dz)   # seated on the planking
    place(F.skylight('HSP_skylight_saloon', length=1.9, width=1.3, height=0.96), coll, on(7.11))            # hard against the deckhouse front
    place(F.skylight('HSP_skylight_small', length=1.3, width=0.6, height=0.6), coll, on(10.03), rz=math.pi / 2)  # small ridge-roofed skylight, athwartships
    place(F.cargo_hatch('HSP_hatch_after', length=2.24, width=2.13, coaming=0.30), coll, on(14.48, 0, -0.06))   # No. 2 hatch, 7 ft 4 in x 7 ft 0 in x 12 in
    place(F.companion('HSP_companion_bridge', length=1.05, width=1.2, height=0.95), coll, on(16.71, -1.96), rz=math.pi)  # 'Companion of teak', starboard
    place(F.skylight('HSP_skylight_engine', length=3.1, width=2.1, height=0.61), coll, (sum(ENGINE_CASING) / 2, 0, ZC))  # teak on the iron coaming
    place(F.skylight('HSP_skylight_galley', length=0.59, width=1.0, height=0.4), coll, on(23.15))                # on the open deck between the casings
    place(F.cargo_hatch('HSP_hatch_fore', length=2.79, width=2.44, coaming=0.30), coll, on(37.07, 0, -0.06))    # No. 1 hatch, 9 ft 2 in x 8 ft 0 in x 12 in
    place(F.cargo_hatch('HSP_hatch_small', length=1.11, width=1.02, coaming=0.30), coll, on(35.1, 0, -0.04))
    place(F.windlass('HSP_windlass', width=2.3), coll, on(47.35))
    for side, tag in ((1, 'P'), (-1, 'S')):
        place(F.bitts(f'HSP_bitts_fore_{tag}'), coll, on(51.5, side * 0.75))
        place(F.bitts(f'HSP_bitts_aft_{tag}'), coll, on(-1.2, side * 2.1))
        place(F.bitts(f'HSP_bitts_well_{tag}'), coll, on(34.0, side * 3.4))
        place(F.ventilator_mushroom(f'HSP_vent_fc_{tag}'), coll, on(46.0, side * 1.2))
        place(F.side_light(f'HSP_sidelight_{tag}', side='port' if side > 0 else 'stbd'), coll, (30.2, side * (WH_HW + 0.25), WH_TOP))
        # lifebuoys where the Ramsey photograph shows them: bridge front, after deckhouse side, stern rail
        place(F.life_ring(f'HSP_lifering_bridge_{tag}'), coll, (31.3, side * (hull_hb(31.3, Z_BRIDGE) + 0.02), Z_BRIDGE + 0.55))
        place(F.life_ring(f'HSP_lifering_house_{tag}'), coll, (3.9, side * (HOUSE_HW + 0.06), 7.25))
        place(F.life_ring(f'HSP_lifering_stern_{tag}'), coll, (-1.9, side * (RQD_EDGE(-1.9) - 0.04), Z_RQD(-1.9) + 0.62), rz=side * 0.9)
        # stockless bower anchors hove up in the hawse pipes
        # The shank runs up the hawse pipe, so it leans inboard until the flukes (35 degrees off it) lie on the plating.
        n = hull_normal(52.05, 5.9, side); flare = math.asin(max(-n.z, 0.0))
        an = place(F.stockless_anchor(f'HSP_anchor_{tag}', shank=1.5), coll, hull_point(52.05, 5.62, side) + n * 0.11,
                   rz=math.atan2(n.y, n.x), ry=-(math.radians(35) - flare))
        ch.lathe(hull_point(52.0, 6.12, side) - n * 0.03, n, [(0.16, 0.0), (0.24, 0.03), (0.22, 0.09), (0.15, 0.10)], 12, 'hull_black', caps=(False, False))
        for slot in an.material_slots:  # the housed anchors read pale against the hull in the Ramsey photograph
            if slot.material and slot.material.name == 'iron': slot.material = MAT['galvanised']
        place(F.life_ring(f'HSP_lifering_fc_{tag}'), coll, (46.4, side * (hull_hb(46.4, Z_FC(46.4)) - 0.05), Z_FC(46.4) + 0.6))
    place(F.binnacle('HSP_binnacle'), coll, (30.83, 0, WH_TOP))                 # standard compass, as drawn
    place(F.searchlight('HSP_searchlight'), coll, (27.85, 0, WH_TOP))
    place(F.engine_telegraph('HSP_telegraph'), coll, (29.67, 0, WH_TOP))        # the after roof instrument on the rigging plan
    fa = (FUNNEL_TOP - FUNNEL_BASE).normalized()
    place(F.steam_whistle('HSP_whistle'), coll, FUNNEL_BASE + fa * 4.4 + Vector((FUNNEL_D / 2 + 0.34, 0, 0)))
    place(F.masthead_lantern('HSP_masthead_light'), coll, mast_at(MASTS['fore'], MASTHEAD_LIGHT_Z) + Vector((0.22, 0, 0)))
    place(F.ship_wheel('HSP_wheel_aft', d=1.5), coll, on(0.29))                 # hand steering wheel aft, about 1.5 m across as drawn
    if hasattr(F, 'rigging_screw'):
        deck_hardware(coll, F, ch, on); relief_stores(coll, F)
    ch.obj(coll)

def winch(mb, x, half=0.62):
    """A small steam cargo winch: bed, side frames, barrel and two warping ends. Drawn only in outline on the rigging plan."""
    z = deck_surface(x, 0.0) - 0.03
    mb.box(x - 0.55, x + 0.55, -half - 0.12, half + 0.12, z, z + 0.07, 'iron')
    for s in (-1, 1):
        mb.box(x - 0.34, x + 0.34, s * half - 0.035, s * half + 0.035, z + 0.07, z + 0.62, 'iron')
        mb.cyl((x, s * half, z + 0.42), (x, s * (half + 0.3), z + 0.42), 0.13, 0.17, 10, 'iron')
        mb.cyl((x + 0.36, s * 0.3, z + 0.12), (x + 0.36, s * 0.3, z + 0.5), 0.09, 0.09, 8, 'iron')
    mb.cyl((x, -half, z + 0.42), (x, half, z + 0.42), 0.2, 0.2, 12, 'iron'); mb.cyl((x - 0.2, half - 0.12, z + 0.3), (x - 0.2, half - 0.06, z + 0.3), 0.26, 0.26, 12, 'iron')

DERRICKS = ((Vector((11.26, 0, 8.03)), Vector((14.58, 0, 11.55)), 'main'), (Vector((40.39, 0, 7.0)), Vector((45.39, 0, 12.13)), 'fore'), (Vector((39.87, 0, 7.03)), Vector((36.6, 0, 10.26)), 'fore'))

def deck_hardware(coll, F, ch, on):
    """Second pass, for standing on her deck: rigging screws, blocks and boat falls, ground tackle, deck furniture.
    The survey names the windlass maker, the cast-iron bunker scuttles flush in the deck and the hatches, and Muirhead's
    report has her anchor under the island; where each small fitting stood is drawn nowhere, so these places follow
    ordinary practice for a steamer of her kind and date."""
    def aim(ob, direction):  # turn a fitting's +Z along a direction
        ob.rotation_euler = Vector(direction).to_track_quat('Z', 'Y').to_euler(); return ob
    for key, m in MASTS.items():
        for side, tag in ((1, 'P'), (-1, 'S')):
            for i, x in enumerate(m['shrouds']):
                cz = m['chain_z'](x); foot = Vector((x, side * (hull_hb(x, cz) - 0.03), cz + 0.05))
                aim(place(F.rigging_screw(f'HSP_screw_{key}_{i}_{tag}', length=0.6), coll, foot), m['hounds'] + Vector((0, side * 0.2, 0)) - foot)
    for i, (heel, head, mast) in enumerate(DERRICKS):
        place(F.rigging_block(f'HSP_block_derrick_{i}', sheaves=1), coll, head - Vector((0, 0, 0.06)))
        place(F.rigging_block(f'HSP_block_span_{i}', sheaves=1), coll, MASTS[mast]['hounds'] + Vector((0.3, 0, -0.38)))
    for side, tag in ((1, 'P'), (-1, 'S')):
        for x, keel, depth in ((17.87, 0.32, 0.8), (23.5, 0.32, 0.8), (25.06, 0.48, 0.72), (30.55, 0.48, 0.72)):   # falls to the boats' hooks
            rz = math.pi + side * 0.8
            head = Vector((x + 0.8 * math.cos(rz), side * (hull_hb(x, Z_BRIDGE) - 0.03) + 0.8 * math.sin(rz), Z_BRIDGE + 2.46))
            place(F.davit_fall(f'HSP_fall_{x:.0f}_{tag}', drop=max(0.7, 2.3 - keel - depth)), coll, head, rz=math.pi)
        for k, dy in enumerate((-0.28, 0.28)):
            place(F.oar(f'HSP_oar_aft_{k}_{tag}', length=4.2), coll, (17.7, side * 2.88 + dy, Z_BRIDGE + 0.32 + 0.56))
            place(F.oar(f'HSP_oar_fwd_{k}_{tag}', length=3.3), coll, (26.2, side * 3.0 + dy, Z_BRIDGE + 0.48 + 0.5))
        cable = [(47.95, 0.56, 0.42), (48.6, 0.55, 0.07), (49.8, 0.55, 0.06), (50.9, 0.52, 0.06), (51.25, 0.5, -0.08)]   # windlass to the deck pipe
        place(F.chain_cable(f'HSP_cable_{tag}', [(x, side * y, deck_surface(x, y) + dz) for x, y, dz in cable]), coll, (0, 0, 0))
        place(F.swan_neck_vent(f'HSP_vent_swan_{tag}', height=1.1, d=0.15), coll, on(45.2, side * 2.1))
        for i, x in enumerate((50.0, 45.5, 13.5, 1.0)):
            place(F.mooring_chock(f'HSP_chock_{i}_{tag}'), coll, on(x, side * (deck_edge_hb(x) - 0.17)))
        for i, (x, y) in enumerate(((10.9, 0.9), (41.4, 0.9), (-1.9, 1.3))):
            place(F.deck_cleat(f'HSP_cleat_{i}_{tag}'), coll, on(x, side * y))
        for i, (x, y) in enumerate(((49.6, 1.7), (33.2, 3.0), (-0.6, 2.4))):
            place(F.rope_coil(f'HSP_coil_{i}_{tag}'), coll, on(x, side * y, 0.0))
        for i, (x, y) in enumerate(((32.55, 1.3), (33.15, 2.6))):
            place(F.coal_scuttle(f'HSP_scuttle_{i}_{tag}'), coll, on(x, side * y, 0.0))
        # awning stanchions and ridge over the flying bridge, dotted on the rigging plan
        for i, x in enumerate((WH_X0 - 0.1, WH_ROOF_X1 - 0.05)):
            place(F.awning_stanchion(f'HSP_awning_{i}_{tag}', height=1.95), coll, (x, side * (WH_HW + 0.2), WH_TOP))
        ch.tube([(WH_X0 - 0.1, side * (WH_HW + 0.2), WH_TOP + 1.95), (WH_ROOF_X1 - 0.05, side * (WH_HW + 0.2), WH_TOP + 1.95)], 0.012, 4, 'galvanised', smooth=False)
    for x in (WH_X0 - 0.1, WH_ROOF_X1 - 0.05):
        ch.tube([(x, -WH_HW - 0.2, WH_TOP + 1.95), (x, WH_HW + 0.2, WH_TOP + 1.95)], 0.012, 4, 'galvanised', smooth=False)
    place(F.ships_bell('HSP_bell'), coll, on(45.05, 0.0))
    for x in (12.6, 39.4): winch(ch, x)   # the two winches the rigging plan draws, between each mast and its hatch
    place(F.stove_pipe('HSP_galley_funnel', height=2.3, d=0.18), coll, on(22.45, 0.72))
    place(F.stove_pipe('HSP_saloon_stove_pipe', height=0.9, d=0.13), coll, (5.3, -0.75, HOUSE_Z1 + 0.06))

def relief_stores(coll, F):
    """What a relief landed: provisions in cases, paraffin for the lamp in casks, coal, and the mail. Stowed on the well
    deck by the port gangway, ready for the boat. They sit in their own collection so a scene can show or hide them."""
    sub = bpy.data.collections.new('Hesperus_relief_stores'); coll.children.link(sub)
    at = lambda x, y, dz=0.0: (x, y, deck_surface(x, y) + dz)
    for i, (x, y) in enumerate(((35.25, 2.75), (35.95, 2.8), (35.6, 2.15))):
        place(F.oil_cask(f'HSP_stores_cask_{i}'), sub, at(x, y))
    for i, (x, y, dz, rz) in enumerate(((36.95, 2.75, 0.0, 0.08), (36.95, 2.2, 0.0, -0.05), (36.97, 2.72, 0.47, 0.2), (37.75, 2.8, 0.0, 1.57))):
        place(F.stores_box(f'HSP_stores_box_{i}'), sub, at(x, y, dz), rz=rz)
    for i, (x, y, rz) in enumerate(((34.5, 2.9, 0.4), (34.45, 2.3, 2.6), (34.0, 2.65, 1.2))):
        place(F.coal_sack(f'HSP_stores_coal_{i}'), sub, at(x, y), rz=rz)
    place(F.mail_bag('HSP_stores_mail'), sub, at(36.95, 2.2, 0.47), rz=0.6)

# ---------------------------------------------------------------------------------- lights and colours

# The masthead light had to stand above the hull by at least the ship's breadth (28 ft) under the 1897 regulations.
MASTHEAD_LIGHT_Z = 18.48   # the rigging plan draws the lantern on a bracket on the fore side of the foremast, a metre above the lower masthead

def build_lights(coll):
    """Named empties for the lights she showed, each carrying what the record or the 1897 collision regulations say of
    it, and a small lamp mesh that stays out of renders until a night scene switches it on. bearing_deg is the middle
    of the arc, measured from right ahead and positive to port; an arc of 360 is an all-round light."""
    fore = MASTS['fore']; stem_head = Vector((STEM_X - 0.1, 0, z_sheer(STEM_X) + 0.05)); stay0 = fore['hounds'] + Vector((0.2, 0, 0))
    riding = stay0 + (stem_head - stay0) * ((stay0.z - 14.4) / (stay0.z - stem_head.z))
    white, red, green, arc = (1.0, 0.86, 0.62), (1.0, 0.05, 0.03), (0.04, 1.0, 0.42), (0.8, 0.9, 1.0)
    lights = (
        ('masthead', mast_at(fore, MASTHEAD_LIGHT_Z) + Vector((0.34, 0, 0.17)), white, 225.0, 0.0, 5.0, 'under way',
         'Two 16 candle-power lamps (lighting report, 1896). White over 20 points of the compass, to show 5 miles.'),
        ('side_port', Vector((30.65, WH_HW + 0.42, WH_TOP + 0.24)), red, 112.5, 56.25, 2.0, 'under way',
         'Two lamps (lighting report). Red from right ahead to 2 points abaft the port beam, to show 2 miles.'),
        ('side_starboard', Vector((30.65, -WH_HW - 0.42, WH_TOP + 0.24)), green, 112.5, -56.25, 2.0, 'under way',
         'Two lamps (lighting report). Green from right ahead to 2 points abaft the starboard beam, to show 2 miles.'),
        ('riding_forward', riding, white, 360.0, 0.0, 1.0, 'at anchor',
         'A vessel of 150 ft or more at anchor: a white all-round light forward, 20 to 40 ft above the hull, to show a mile.'),
        ('riding_aft', Vector((-3.53, 0, 8.6)), white, 360.0, 0.0, 1.0, 'at anchor',
         'The second riding light at the stern, at least 15 ft lower than the forward one.'),
        ('searchlight', Vector((28.07, 0, WH_TOP + 0.95)), arc, 10.0, 0.0, 0.0, 'on demand',
         'One projector of 5000 candle power (lighting report). Its place is not recorded: its cable ran 7 ft clear of the standard compass, so it is set at the after end of the flying bridge.'),
    )
    mb = {}
    for name, pos, col, arc_deg, bearing, miles, when, note in lights:
        e = bpy.data.objects.new(f'{PREFIX}light_{name}', None); coll.objects.link(e)
        e.empty_display_type = 'SPHERE'; e.empty_display_size = 0.25; e.location = pos
        e['light'] = name; e['colour'] = col; e['arc_deg'] = arc_deg; e['bearing_deg'] = bearing; e['range_nm'] = miles; e['shown'] = when; e['note'] = note
        key = 'lamp_' + {white: 'white', red: 'red', green: 'green', arc: 'arc'}[col]
        if key not in MAT:
            m = bpy.data.materials.new(key); m.use_nodes = True; b = next(q for q in m.node_tree.nodes if q.type == 'BSDF_PRINCIPLED')
            b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Emission Color'].default_value = (*col, 1); b.inputs['Emission Strength'].default_value = 60.0
            m.diffuse_color = (*col, 1); MAT[key] = m
        lamp = mb.setdefault(when, MB('lamps_' + when.replace(' ', '_')))
        lamp.lathe(pos - Vector((0, 0, 0.09)), (0, 0, 1), [(0.001, 0.0), (0.064, 0.026), (0.09, 0.09), (0.064, 0.154), (0.001, 0.18)], 8, key)
    for when, lamp in mb.items():
        ob = lamp.obj(coll, sharp=0)
        ob.hide_render = True; ob['shown'] = when   # a night scene turns the right set on

def ensign_image():
    """The Board's ensign: a Blue Ensign with a white lighthouse in the fly, worn by its tenders (adopted 1855, or by an
    Admiralty warrant of 1885; either way before her time). Older ensigns carried a slender tower after the Bell Rock,
    which is what is drawn here; the exact cut of the emblem in 1901 is not recorded."""
    import numpy as np
    name = 'hesperus_ensign'
    if name in bpy.data.images: return bpy.data.images[name]
    W, H = 1024, 512
    blue, red, white = (0.05, 0.10, 0.32), (0.72, 0.08, 0.10), (0.93, 0.92, 0.88)
    img = np.empty((H, W, 4), np.float32); img[..., :3] = blue; img[..., 3] = 1.0
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)          # row 0 is the foot of the flag, the hoist is at x = 0
    # canton: the Union Flag of 1801 on the upper hoist quarter, on its usual 60 x 30 grid
    px = xx / (W / 2) * 60 - 30; py = (yy - H / 2) / (H / 2) * 30 - 15; canton = (xx < W / 2) & (yy >= H / 2)
    e1, e2 = (0.8944, 0.4472), (0.8944, -0.4472)
    al1 = px * e1[0] + py * e1[1]; pe1 = -px * e1[1] + py * e1[0]
    al2 = px * e2[0] + py * e2[1]; pe2 = -px * e2[1] + py * e2[0]
    andrew = (np.abs(pe1) <= 3) | (np.abs(pe2) <= 3)
    patrick = (((al1 > 0) & (pe1 >= 0) & (pe1 <= 2)) | ((al1 < 0) & (pe1 <= 0) & (pe1 >= -2))
               | ((al2 > 0) & (pe2 >= 0) & (pe2 <= 2)) | ((al2 < 0) & (pe2 <= 0) & (pe2 >= -2)))   # counterchanged: red set anticlockwise
    for mask, col in ((andrew, white), (patrick, red), ((np.abs(px) <= 5) | (np.abs(py) <= 5), white), ((np.abs(px) <= 3) | (np.abs(py) <= 3), red)):
        img[canton & mask, :3] = col
    # the lighthouse in the fly, in units of the hoist
    fx = (xx - 0.75 * W) / H; fy = (yy - 0.5 * H) / H
    t = np.clip((fy + 0.30) / 0.40, 0, 1)
    tower = (fy >= -0.30) & (fy <= 0.10) & (np.abs(fx) <= 0.034 + 0.05 * (1 - t) ** 2.2)
    gallery = (fy > 0.10) & (fy <= 0.118) & (np.abs(fx) <= 0.058)
    lantern = (fy > 0.118) & (fy <= 0.19) & (np.abs(fx) <= 0.034)
    dome = (fy > 0.19) & ((fx / 0.04) ** 2 + ((fy - 0.19) / 0.05) ** 2 <= 1)
    finial = (fy > 0.235) & (fy <= 0.275) & (np.abs(fx) <= 0.006)
    rock = (fy < -0.30) & (fy >= -0.335) & (np.abs(fx) <= 0.12 + 1.5 * (fy + 0.30))
    img[tower | gallery | lantern | dome | finial | rock, :3] = white
    im = bpy.data.images.new(name, W, H, alpha=False); im.pixels.foreach_set(img.ravel())
    path = os.path.join(HERE, 'textures', name + '.png')
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True); im.filepath_raw = path; im.file_format = 'PNG'; im.save()
    except Exception as e:
        print('hesperus: ensign texture not written:', e)
    im.pack()
    return im

def build_ensign(coll):
    if DETAIL == 'far': return
    if 'ensign' not in MAT:
        m = bpy.data.materials.new('ensign'); m.use_nodes = True; nt = m.node_tree
        b = next(q for q in nt.nodes if q.type == 'BSDF_PRINCIPLED'); tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = ensign_image()
        nt.links.new(tex.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = 0.9
        m.diffuse_color = (0.05, 0.10, 0.32, 1); m.use_backface_culling = False; MAT['ensign'] = m
    base, top = ENSIGN_HEEL, ENSIGN_HEAD; ax = (top - base).normalized()
    hoist, fly = 0.9, 1.8; nx, ny = (16, 6) if DETAIL == 'full' else (5, 2)
    head = top - ax * 0.1; out = Vector((-0.8, 0, -0.6)).normalized()   # hanging aft and down in a light air
    verts, uvs, faces = [], [], []
    for i in range(ny + 1):
        for j in range(nx + 1):
            s = j / nx; t = i / ny
            p = head - ax * hoist * (1 - t) + out * fly * s
            verts.append(p + Vector((0, 0.11 * s * math.sin(2 * math.pi * (1.35 * s + 0.12 * t)), -0.16 * s * s * (1 - t)))); uvs.append((s, t))
    for i in range(ny):
        for j in range(nx):
            a = i * (nx + 1) + j; faces.append((a, a + 1, a + nx + 2, a + nx + 1))
    me = bpy.data.meshes.new(PREFIX + 'ensign'); me.from_pydata([tuple(p) for p in verts], [], faces)
    uv = me.uv_layers.new(name='UVMap')
    for lp in me.loops: uv.data[lp.index].uv = uvs[lp.vertex_index]
    me.materials.append(MAT['ensign']); me.polygons.foreach_set('use_smooth', [True] * len(faces)); me.update()
    coll.objects.link(bpy.data.objects.new(PREFIX + 'ensign', me))

def build_stern_name(coll):
    """Name and port of registry on the counter. The Merchant Shipping Act 1894 required both on the stern of a
    registered ship and she was registered at Leith; the lettering itself is not seen in any source found."""
    vl = SCENE.view_layers[0]; mb = MB('stern_name')
    def stern_x(y, z):  # the shell's x at height z and |y| off the centreline, round the counter
        lo, hi = X_STERN - 0.01, 3.0
        for _ in range(42):
            mid = (lo + hi) / 2
            if hull_hb(mid, z) <= abs(y) + 1e-4: lo = mid
            else: hi = mid
        return hi
    P = lambda y, z: Vector((stern_x(y, z), y, z))
    for text, z, size, pitch in (('HESPERUS', 5.88, 0.19, 0.29), ('LEITH', 5.58, 0.15, 0.24)):
        for k, ch in enumerate(text):
            y = ((len(text) - 1) / 2 - k) * pitch                      # port to starboard, as read from astern
            p = P(y, z); ex = (P(y - 0.06, z) - P(y + 0.06, z)).normalized(); tz = (P(y, z + 0.06) - P(y, z - 0.06)).normalized()
            n = ex.cross(tz); n = -n if n.x > 0 else n; n.normalize(); ey = n.cross(ex)
            cu = bpy.data.curves.new(PREFIX + 'letter', 'FONT'); cu.body = ch; cu.size = size; cu.extrude = 0.004; cu.align_x = 'CENTER'
            tmp = bpy.data.objects.new(PREFIX + 'letter_tmp', cu); coll.objects.link(tmp); vl.update()
            me = bpy.data.meshes.new_from_object(tmp.evaluated_get(vl.depsgraph))
            base = len(mb.v)
            for v in me.vertices: mb.v.append(p + ex * v.co.x + ey * (v.co.y - size * 0.36) + n * (v.co.z + 0.01))
            for poly in me.polygons:
                mb.f.append([base + i for i in poly.vertices]); mb.fm.append(mb.mi('gilt')); mb.fs.append(False)
            bpy.data.objects.remove(tmp); bpy.data.curves.remove(cu); bpy.data.meshes.remove(me)
    return mb.obj(coll, sharp=0)

# --------------------------------------------------------------------------------------------- scene

def build(detail='full'):
    global DETAIL, PREFIX, SCENE
    DETAIL = detail; scene_name, PREFIX = LODS[detail]
    old = bpy.data.scenes.get(scene_name)
    if old:
        for ob in list(old.collection.all_objects): bpy.data.objects.remove(ob, do_unlink=True)
        for c in list(old.collection.children_recursive): bpy.data.collections.remove(c)
        if len(bpy.data.scenes) > 1: bpy.data.scenes.remove(old)
    scene = bpy.data.scenes.get(scene_name) or bpy.data.scenes.new(scene_name)
    scene.unit_settings.system = 'METRIC'
    scene['hesperus_generated'] = True  # lets a later import find and replace this scene without touching others
    scene['detail'] = detail
    if bpy.context.window: bpy.context.window.scene = scene
    coll = bpy.data.collections.new(scene_name); scene.collection.children.link(coll)
    SCENE = scene
    make_materials()
    if INT and detail == 'full': INT.make_materials(sys.modules[__name__])
    build_hull(coll); build_decks(coll)
    if detail == 'full': gangway_doors(coll)
    build_rails(coll); build_structures(coll); build_funnel(coll); build_masts(coll); build_ports(coll); build_underwater(coll)
    if detail == 'full':
        build_name(coll); build_stern_name(coll)
    build_fittings(coll); build_ensign(coll); build_lights(coll)
    if INT and detail == 'full':
        try: INT.build(sys.modules[__name__], coll)
        except Exception as e:
            import traceback; traceback.print_exc(); print('hesperus: interiors not built:', e)
    if FINISH and detail == 'full':
        try: FINISH.apply_finish(scene)
        except Exception as e: print('hesperus: surface finish not applied:', e)
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in coll.all_objects if o.type == 'MESH')
    print(f'HESPERUS built [{detail}]: {len(coll.all_objects)} objects, {tris} triangles, fittings library: {"yes" if FIT else "no"}')
    return scene, coll

def render_profile(scene, path):
    """Flat starboard elevation registered to the rigging plan scan (2000 x 1235)."""
    cam = bpy.data.objects.new('HSP_profile_cam', bpy.data.cameras.new('HSP_profile_cam')); scene.collection.objects.link(cam)
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = 2000 / 31.006; cam.data.clip_end = 500
    cam.location = ((1000 - 228) / 31.006, -200, (998 - 617.5) / 31.006); cam.rotation_euler = (math.radians(90), 0, 0)
    scene.camera = cam; r = scene.render; r.engine = 'BLENDER_WORKBENCH'; r.resolution_x, r.resolution_y, r.resolution_percentage = 2000, 1235, 100
    r.film_transparent = True; scene.display.shading.light = 'FLAT'; scene.display.shading.color_type = 'MATERIAL'
    scene.display.shading.show_object_outline = True; scene.view_settings.view_transform = 'Standard'; r.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    # --lods also builds the two lighter models, as scenes Hesperus_LOD1 and Hesperus_LOD2 in the same file
    built = [build(d) for d in (('far', 'mid', 'full') if '--lods' in argv else ('full',))]
    scene = built[-1][0]
    if '--profile' in argv: render_profile(scene, argv[argv.index('--profile') + 1])
    if '--save' in argv:
        keep = {s for s, _ in built}
        for s in list(bpy.data.scenes):
            if s not in keep: bpy.data.scenes.remove(s)
        bpy.data.orphans_purge(do_recursive=True)
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(argv[argv.index('--save') + 1]), compress=True)

# ---------------------------------------------------------------------------------------------- NOTES
# What is recorded and what is reconstruction.
#
# Recorded (builder's drawings and survey, 1896): principal dimensions; stem, forefoot, keel, stern post, rudder and
# counter in profile; every deck edge height; deck outlines in plan; the midship section; positions, rake and sizes of
# both masts and the funnel; three derricks; deckhouse, casing, wheelhouse, hatch and skylight positions; two boats a
# side under radial davits; side-scuttle rows; four boats, stockless bower anchors, teak rails and skylights, pitch
# pine decks; one 5000 candle-power searchlight, one masthead and two side lights.
#
# From the Ramsey photograph (as fitted, between 1896 and 1910): white strake along the bridge side, white boot-top
# line, white bow bulwark, rails and toe plates; pale anchors hove up in the hawse pipes; the name in small spaced
# capitals high on the forecastle side, where the rigging plan had drawn four scuttles; swan-neck ventilators at
# the forecastle break; a waste-steam pipe on the fore side of the funnel; gangway doors in the well bulwark.
#
# Reconstruction, not recorded: the hull surface between the drawn sections (no lines plan survives in the set);
# shaft bossings, struts and propeller details; hull colours other than tone (black topsides, red-brown bottom, buff
# funnel follow the builder's display model in Oban, seen only in a stock photograph); the brown of the masts and
# of the after deckhouse (dark in the photograph); wheelhouse width and window layout across the front, and its door
# (put in the port side: the rigging plan draws none to starboard and the boiler casing blocks the after wall); ladders,
# doors and scuttles on the deck-break bulkheads; shroud and stay leads below the hounds; the lettering style.
# The rooms inside her are in hesperus_interiors.py, with their own notes on what is recorded.
# Not modelled: sails, awnings, flags, boat falls, the name on the stern, cargo winches (none is drawn).
