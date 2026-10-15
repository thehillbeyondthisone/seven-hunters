"""Interior rooms of the lighthouse tender HESPERUS (Gourlay Brothers, Dundee, 1896).

Called by hesperus.py at full detail:  hesperus_interiors.build(H, coll)  where H is the hesperus module.
Model axes as there: metres, +X forward, +Y port, +Z up.

Rooms, and what fixes them (docs/references/hesperus/measurements.md):

  Chart house and steam steering gear house   Walls X 27.34 to 31.04, 1.93 m headroom and the two names: inboard
      (bridge deck)                           profile.  Five windows a side: rigging plan, which draws no door to
                                              starboard.  Width is on no plan.
  Galley (main deck, between the casings)     X 21.71 to 23.98, 3.02 m wide: main deck plan.  A salt water lift
                                              force pump and a fresh water pump in it: plumber work plan.  Its
                                              skylight: bridge deck plan.
  Saloon entrance and state room              The steel deckhouse on the quarter deck, its two room names and the
      (after deckhouse)                       division near X 4.1: plumber work plan.  The hatch in it: deck plan.
  Stair lobby and saloon (cabin sole)         Sole from frame 1 to the bulkhead at frame 20, 7 ft 11 in below the
                                              quarter deck; skylights and side scuttles: deck plan, rigging plan.

Everything else is reconstruction: no drawing in the set shows joiner bulkheads, doors, panelling or a single piece
of furniture.  The partitions below the quarter deck are placed from the skylights and the spacing of the side
scuttles; the furniture is ordinary practice for a small British government steamer of the 1890s.  See NOTES at the
foot of this file.

Layout of the result: the wheelhouse walls, floor and deckhead go in the ship's own collection, because they show
through its windows from outside.  Everything else goes in the child collection 'Hesperus_interior'.
"""
import math
import os
import sys

import bpy
import bmesh
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path: sys.path.insert(0, HERE)
try: import hesperus_furniture_bridge as FB
except Exception as e: FB = None; print('hesperus_interiors: bridge and galley furniture not loaded:', e)
try: import hesperus_furniture_cabin as FC
except Exception as e: FC = None; print('hesperus_interiors: cabin furniture not loaded:', e)
try: import hesperus_fittings as FIT
except Exception: FIT = None

COLLECTION = 'Hesperus_interior'
MISSING = []

# ------------------------------------------------------------------------------------------ materials
# Interior finishes are kept apart from the weathered exterior ones (hesperus_finish.py works on those by name).

PALETTE = {  # name: (base colour, roughness, metallic)
    'int_mahogany': ((0.20, 0.065, 0.03), 0.30, 0.0), 'int_teak': ((0.30, 0.15, 0.06), 0.40, 0.0), 'int_pine': ((0.62, 0.48, 0.30), 0.60, 0.0),
    'int_white': ((0.82, 0.80, 0.74), 0.45, 0.0), 'int_cream': ((0.78, 0.72, 0.56), 0.50, 0.0), 'int_iron': ((0.03, 0.03, 0.035), 0.55, 0.0),
    'int_steel': ((0.45, 0.46, 0.47), 0.35, 1.0), 'int_brass': ((0.78, 0.57, 0.20), 0.30, 1.0), 'int_copper': ((0.72, 0.35, 0.18), 0.30, 1.0),
    'int_leather': ((0.10, 0.16, 0.10), 0.50, 0.0), 'int_plush': ((0.32, 0.04, 0.05), 0.90, 0.0), 'int_carpet': ((0.30, 0.05, 0.05), 0.95, 0.0),
    'int_lino': ((0.33, 0.22, 0.13), 0.60, 0.0), 'int_tile': ((0.42, 0.16, 0.10), 0.60, 0.0), 'int_linen': ((0.85, 0.84, 0.80), 0.90, 0.0),
    'int_wool': ((0.20, 0.22, 0.30), 0.95, 0.0), 'int_paper': ((0.80, 0.74, 0.60), 0.80, 0.0), 'int_book': ((0.22, 0.07, 0.05), 0.70, 0.0),
    'int_glass': ((0.75, 0.82, 0.82), 0.05, 0.0), 'int_mirror': ((0.8, 0.8, 0.8), 0.03, 1.0), 'int_enamel': ((0.86, 0.86, 0.84), 0.20, 0.0),
    'int_dial': ((0.88, 0.86, 0.78), 0.40, 0.0), 'int_lamp_glow': ((1.0, 0.72, 0.35), 0.5, 0.0), 'int_oilskin': ((0.55, 0.42, 0.10), 0.45, 0.0),
    'int_bunting_red': ((0.60, 0.03, 0.03), 0.9, 0.0), 'int_bunting_blue': ((0.03, 0.06, 0.30), 0.9, 0.0), 'int_bunting_yellow': ((0.80, 0.62, 0.05), 0.9, 0.0),
    'int_coal': ((0.012, 0.012, 0.014), 0.5, 0.0), 'int_gilt': ((0.85, 0.63, 0.18), 0.3, 1.0), 'int_print': ((0.30, 0.28, 0.24), 0.8, 0.0),
    'int_canvas': ((0.50, 0.45, 0.35), 0.9, 0.0), 'int_daylight': ((0.80, 0.88, 1.0), 0.5, 0.0),
}
EMISSION = {'int_lamp_glow': 5.0, 'int_daylight': 6.0}   # daylight: the sky seen through a scuttle or skylight
ALPHA = {'int_glass': 0.12}

def make_materials(H):
    for name, (col, rough, metal) in PALETTE.items():
        m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
        m.use_nodes = True
        b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
        m.diffuse_color = (*col, ALPHA.get(name, 1.0)); m.roughness = rough; m.metallic = metal
        if name in EMISSION:
            b.inputs['Emission Color'].default_value = (*col, 1); b.inputs['Emission Strength'].default_value = EMISSION[name]
        if name in ALPHA:
            b.inputs['Alpha'].default_value = ALPHA[name]
            try: m.surface_render_method = 'BLENDED'
            except Exception: pass
        m['interior'] = True
        H.MAT[name] = m

# --------------------------------------------------------------------------------------- shell helpers

def wall(mb, axis, c, s0, s1, z0, z1, n, mat, holes=()):
    """An upright wall face in the plane y = c running along x (axis 'x'), or in x = c running along y (axis 'y'),
    facing n (+1 or -1 along the plane's normal), with rectangular openings (s0, s1, z0, z1)."""
    S = sorted({s0, s1} | {v for h in holes for v in h[:2] if s0 < v < s1})
    Z = sorted({z0, z1} | {v for h in holes for v in h[2:] if z0 < v < z1})
    P = (lambda s, z: (s, c, z)) if axis == 'x' else (lambda s, z: (c, s, z))
    want = Vector((0, n, 0)) if axis == 'x' else Vector((n, 0, 0))
    for i in range(len(S) - 1):
        for j in range(len(Z) - 1):
            sm, zm = (S[i] + S[i + 1]) / 2, (Z[j] + Z[j + 1]) / 2
            if any(h[0] < sm < h[1] and h[2] < zm < h[3] for h in holes): continue
            mb.poly([P(S[i], Z[j]), P(S[i + 1], Z[j]), P(S[i + 1], Z[j + 1]), P(S[i], Z[j + 1])], mat, want)

def reveal(mb, axis, c0, c1, hole, mat):
    """The four inside faces of an opening through a wall, from plane c0 to plane c1."""
    s0, s1, z0, z1 = hole
    P = (lambda s, c, z: (s, c, z)) if axis == 'x' else (lambda s, c, z: (c, s, z))
    ctr = Vector(P((s0 + s1) / 2, (c0 + c1) / 2, (z0 + z1) / 2))
    for a, b in (((s0, z0), (s1, z0)), ((s1, z0), (s1, z1)), ((s1, z1), (s0, z1)), ((s0, z1), (s0, z0))):
        pts = [P(a[0], c0, a[1]), P(b[0], c0, b[1]), P(b[0], c1, b[1]), P(a[0], c1, a[1])]
        mb.poly(pts, mat, ctr - sum((Vector(p) for p in pts), Vector()) / 4)

def pane(mb, axis, c, hole, n, mat='int_glass'):
    s0, s1, z0, z1 = hole
    P = (lambda s, z: (s, c, z)) if axis == 'x' else (lambda s, z: (c, s, z))
    mb.poly([P(s0, z0), P(s1, z0), P(s1, z1), P(s0, z1)], mat, Vector((0, n, 0)) if axis == 'x' else Vector((n, 0, 0)))

def wall_x(mb, c, xs, zlo, zhi, n, mat):
    """A fore-and-aft wall in the plane y = c whose foot and head follow zlo(x) and zhi(x)."""
    for a, b in zip(xs, xs[1:]):
        mb.poly([(a, c, zlo(a)), (b, c, zlo(b)), (b, c, zhi(b)), (a, c, zhi(a))], mat, Vector((0, n, 0)))

def flat(mb, x0, x1, y0, y1, zf, n, mat, holes=(), step=0.0):
    """A floor (n = 1) or deckhead (n = -1) at height zf, a number or a function of x, with openings (x0, x1, y0, y1)."""
    f = zf if callable(zf) else (lambda x: zf)
    X = {x0, x1} | {v for h in holes for v in h[:2] if x0 < v < x1}
    if step:
        k = max(1, round((x1 - x0) / step)); X |= {x0 + (x1 - x0) * i / k for i in range(1, k)}
    X = sorted(X); Y = sorted({y0, y1} | {v for h in holes for v in h[2:] if y0 < v < y1})
    for i in range(len(X) - 1):
        for j in range(len(Y) - 1):
            xm, ym = (X[i] + X[i + 1]) / 2, (Y[j] + Y[j + 1]) / 2
            if any(h[0] < xm < h[1] and h[2] < ym < h[3] for h in holes): continue
            mb.poly([(X[i], Y[j], f(X[i])), (X[i + 1], Y[j], f(X[i + 1])), (X[i + 1], Y[j + 1], f(X[i + 1])), (X[i], Y[j + 1], f(X[i]))], mat, Vector((0, 0, n)))

def scuttle_in(mb, c, n, r=0.15):
    """The inboard side of a side scuttle: brass frame on the lining, daylight in the glass."""
    c = Vector(c); n = Vector(n).normalized()
    a = mb.ring(c + n * 0.004, n, r, 12); b = mb.ring(c + n * 0.032, n, r, 12); d = mb.ring(c + n * 0.032, n, r * 0.74, 12); e = mb.ring(c + n * 0.010, n, r * 0.74, 12)
    mb.skin(a, b, 'int_brass', c, c + n * 0.03, False)
    for k in range(len(a)):
        q = (k + 1) % len(a)
        mb.face([b[k], b[q], d[q], d[k]], 'int_brass', n)
        mb.face([d[k], d[q], e[q], e[k]], 'int_brass', -(mb.v[d[k]] - c).normalized())
    mb.face(e, 'int_daylight', n)
    for ang in (0.9, math.pi - 0.9):   # two dogs on the frame
        p = c + n * 0.032 + (Vector((0, 0, 1)) * math.sin(ang) + n.cross(Vector((0, 0, 1))) * math.cos(ang)) * r * 1.02
        mb.cyl(p, p + n * 0.03, 0.014, 0.014, 6, 'int_brass')

def skylight_dims(L, W, Hh):
    """Inside of a hesperus_fittings.skylight of this size: half length, half width, ridge and eave above its base."""
    hw = W / 2; cap = min(0.07, 0.16 * Hh); rise = min(0.58 * hw, 0.60 * Hh); zr = Hh - cap
    iw = hw - 0.07; il = L / 2 - 0.07
    return il, iw, zr - 0.03, zr - 0.03 - rise * iw / hw

def skylight_well(mb, cx, base, L, W, Hh, zc, lining='int_teak', bars=3):
    """The well of a deck skylight seen from below: lined sides up from the deckhead (zc), the two glazed leaves lit
    by the sky, glazing bars and ridge.  It stands inside the skylight the fittings library puts on deck."""
    il, iw, ridge, eave = skylight_dims(L, W, Hh); ridge += base; eave += base
    for s in (1, -1):
        mb.poly([(cx - il, s * iw, zc), (cx + il, s * iw, zc), (cx + il, s * iw, eave), (cx - il, s * iw, eave)], lining, Vector((0, -s, 0)))
        mb.poly([(cx + s * il, -iw, zc), (cx + s * il, iw, zc), (cx + s * il, iw, eave), (cx + s * il, 0, ridge), (cx + s * il, -iw, eave)], lining, Vector((-s, 0, 0)))
        mb.poly([(cx - il, 0, ridge), (cx + il, 0, ridge), (cx + il, s * iw, eave), (cx - il, s * iw, eave)], 'int_daylight', Vector((0, -s * 0.5, -1)))
        for k in range(bars):
            x = cx - il + 2 * il * (k + 1) / (bars + 1)
            mb.tube([(x, s * 0.02, ridge - 0.012), (x, s * (iw - 0.005), eave - 0.012)], 0.012, 4, lining, smooth=False)
    mb.box(cx - il, cx + il, -0.03, 0.03, ridge - 0.05, ridge - 0.004, lining, skip='+z')
    return (cx - il, cx + il, -iw, iw)

def cut_hole(ob, x0, x1, y0, y1, zmax=None):
    """Cut a rectangular opening (in plan, ship coordinates) through the level faces of a mesh, so a hatch or skylight
    is open below.  zmax keeps the cut to faces below that height.  The object may be moved but not turned."""
    if ob is None: return
    ox, oy, oz = ob.location; x0 -= ox; x1 -= ox; y0 -= oy; y1 -= oy
    zlim = None if zmax is None else zmax - oz
    me = ob.data; bm = bmesh.new(); bm.from_mesh(me); bm.normal_update()
    def level(f): return abs(f.normal.z) >= 0.5 and (zlim is None or max(v.co.z for v in f.verts) < zlim)
    def over(f):
        if not level(f): return False
        xs = [v.co.x for v in f.verts]; ys = [v.co.y for v in f.verts]
        return min(xs) < x1 and max(xs) > x0 and min(ys) < y1 and max(ys) > y0
    for co, no in (((x0, 0, 0), (1, 0, 0)), ((x1, 0, 0), (1, 0, 0)), ((0, y0, 0), (0, 1, 0)), ((0, y1, 0), (0, 1, 0))):
        faces = [f for f in bm.faces if over(f)]
        geom = list({e for f in faces for e in f.edges}) + list({v for f in faces for v in f.verts}) + faces
        bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-5, plane_co=co, plane_no=no)
        bm.normal_update()
    dead = []
    for f in bm.faces:
        c = f.calc_center_median()
        if level(f) and x0 < c.x < x1 and y0 < c.y < y1: dead.append(f)
    bmesh.ops.delete(bm, geom=dead, context='FACES')
    bm.to_mesh(me); bm.free(); me.update()

# ------------------------------------------------------------------------------------------ furniture

def make(H, mod, fn, name, **kw):
    """A piece from a furniture library, or None when the library or the piece is not there."""
    f = getattr(mod, fn, None) if mod else None
    if f is None:
        MISSING.append(fn); return None
    full = f'{H.PREFIX}int_{name}'
    try: return f(full, **kw)
    except TypeError:
        try: return f(full)
        except Exception as e: print('hesperus_interiors:', fn, 'failed:', e)
    except Exception as e: print('hesperus_interiors:', fn, 'failed:', e)
    MISSING.append(fn)
    return None

def box_of(ob, rz=0.0):
    R = Matrix.Rotation(rz, 3, 'Z'); pts = [R @ v.co for v in ob.data.vertices]
    return Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))), Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))

def snap(ob, coll, rz=0.0, x=None, y=None, z=None, **side):
    """Set a piece down: turn it about Z, then move it so its bounding box sits where asked.  x, y, z place the middle
    of the box; xmin, xmax, ymin, ymax, zmin, zmax place that face of it."""
    if ob is None: return None
    if ob.name not in coll.objects: coll.objects.link(ob)
    lo, hi = box_of(ob, rz); loc = Vector((0, 0, 0))
    for i, (mid, a, b) in enumerate(((x, 'xmin', 'xmax'), (y, 'ymin', 'ymax'), (z, 'zmin', 'zmax'))):
        if side.get(a) is not None: loc[i] = side[a] - lo[i]
        elif side.get(b) is not None: loc[i] = side[b] - hi[i]
        elif mid is not None: loc[i] = mid - (lo[i] + hi[i]) / 2
    ob.location = loc; ob.rotation_euler = (0, 0, rz)
    return ob

def at(ob, coll, loc, rz=0.0):
    """Place a piece by its own origin (wall-mounted and hanging pieces)."""
    if ob is None: return None
    if ob.name not in coll.objects: coll.objects.link(ob)
    ob.location = loc; ob.rotation_euler = (0, 0, rz)
    return ob

def flue_xy(ob):
    """Where the top of a placed stove's or range's flue comes through the deckhead."""
    mw = Matrix.Translation(ob.location) @ ob.rotation_euler.to_matrix().to_4x4()   # matrix_world is stale until the next evaluation
    pts = [mw @ v.co for v in ob.data.vertices]; zt = max(p.z for p in pts)
    top = [p for p in pts if p.z > zt - 0.02]
    return sum(p.x for p in top) / len(top), sum(p.y for p in top) / len(top)

def top_of(ob):
    """World height of the top of a placed piece."""
    lo, hi = box_of(ob, ob.rotation_euler.z)
    return ob.location.z + hi.z

def lamp(H, coll, name, loc, room, watts=14.0):
    """An electric lamp: a marker carrying what the game needs, and a point light for renders."""
    e = bpy.data.objects.new(f'{H.PREFIX}int_light_{name}', None); e.empty_display_size = 0.06; e.location = loc; coll.objects.link(e)
    e['light'] = 'electric, incandescent'; e['colour'] = 'warm white'; e['room'] = room; e['interior'] = True
    e['note'] = 'One of the 79 lamps of the 1896 installation; where each hung is not recorded.'
    li = bpy.data.lights.new(f'{H.PREFIX}int_lamp_{name}', 'POINT'); li.energy = watts; li.color = (1.0, 0.74, 0.45); li.shadow_soft_size = 0.04
    o = bpy.data.objects.new(li.name, li); o.location = loc; coll.objects.link(o)
    return e

def FRAME(n): return 0.5588 * n - 0.04

# --------------------------------------------------------------- chart house and steam steering gear house

class WH:
    """Numbers shared by the outside and the inside of the house on the bridge."""
    def __init__(self, H):
        self.t = 0.06                                    # framed teak walls
        self.zf = 6.70                                   # floor, clear of the round of the bridge deck beneath
        self.zc = H.WH_Z1
        wz = (8.035 - 0.355, 8.035 + 0.355)
        self.wz = wz
        side = [(27.777 + 0.594 * k - 0.23, 27.777 + 0.594 * k + 0.23) + wz for k in range(5)]
        # No door is drawn to starboard and the boiler casing stands hard against the after wall, so the door is put in
        # the port side, in place of the aftermost window.
        self.door = (side[0][0] - 0.07, side[0][1] + 0.07, self.zf, self.zf + 1.74)
        self.port = [self.door] + side[1:]; self.stbd = side
        self.front = [(y - 0.35, y + 0.35) + wz for y in (-1.0, 0.0, 1.0)]
        # The inboard profile puts the partition at X 29.03, inside the third window of the rigging plan; it is set on
        # the mullion 0.23 m further forward.  Chart house abaft it, steam steering gear before it.
        self.part = 27.777 + 2.5 * 0.594
        self.pdoor = (0.55, 1.20, self.zf, self.zf + 1.78)

def wheelhouse_outer(H, mb):
    """Outside walls of the house with real window and door openings (called from hesperus.build_structures)."""
    d = WH(H); X0, X1, HW, t = H.WH_X0, H.WH_X1, H.WH_HW, d.t; z0, z1 = H.Z_BRIDGE, H.WH_Z1
    wall(mb, 'x', HW, X0, X1, z0, z1, 1, 'teak', d.port); wall(mb, 'x', -HW, X0, X1, z0, z1, -1, 'teak', d.stbd)
    wall(mb, 'y', X1, -HW, HW, z0, z1, 1, 'teak', d.front); wall(mb, 'y', X0, -HW, HW, z0, z1, -1, 'teak')
    for holes, axis, c, n in ((d.port, 'x', HW, 1), (d.stbd, 'x', -HW, -1), (d.front, 'y', X1, 1)):
        for h in holes:
            reveal(mb, axis, c, c - n * t, h, 'teak')
            if h is not d.door: pane(mb, axis, c - n * t / 2, h, n)

def steering_compass(mb, c):
    """The steering compass on its shelf at the middle window: teak base, brass hood with a sight on the after side
    and a lamp at the side.  The lighting report puts it about 2 ft nearer the dynamo than the standard compass,
    which stands on the roof directly above."""
    x, y, z = c
    mb.box(x - 0.15, x + 0.15, y - 0.16, y + 0.16, z, z + 0.09, 'int_teak')
    mb.lathe((x, y, z + 0.09), (0, 0, 1), [(0.135, 0.0), (0.135, 0.09), (0.115, 0.16), (0.07, 0.21), (0.02, 0.235)], 12, 'int_brass', caps=(False, True))
    mb.poly([(x - 0.138, y - 0.06, z + 0.115), (x - 0.138, y + 0.06, z + 0.115), (x - 0.112, y + 0.05, z + 0.20), (x - 0.112, y - 0.05, z + 0.20)], 'int_dial', Vector((-1, 0, 0.3)))
    mb.cyl((x, y + 0.12, z + 0.15), (x, y + 0.21, z + 0.15), 0.036, 0.036, 8, 'int_brass')
    mb.cyl((x, y + 0.185, z + 0.18), (x, y + 0.185, z + 0.24), 0.016, 0.02, 6, 'int_brass')

def wheelhouse(H, coll, sub):
    d = WH(H); X0, X1, HW, t, zf, zc, px = H.WH_X0, H.WH_X1, H.WH_HW, d.t, d.zf, d.zc, d.part
    xi0, xi1, yi = X0 + t, X1 - t, HW - t
    mb = H.MB('wheelhouse_inner')
    wall(mb, 'x', yi, xi0, xi1, zf, zc, -1, 'int_teak', d.port); wall(mb, 'x', -yi, xi0, xi1, zf, zc, 1, 'int_teak', d.stbd)
    wall(mb, 'y', xi1, -yi, yi, zf, zc, -1, 'int_teak', d.front); wall(mb, 'y', xi0, -yi, yi, zf, zc, 1, 'int_teak')
    flat(mb, xi0, xi1, -yi, yi, zf, 1, 'int_pine'); flat(mb, xi0, xi1, -yi, yi, zc, -1, 'int_white')
    wall(mb, 'y', px - 0.025, -yi, yi, zf, zc, -1, 'int_teak', [d.pdoor]); wall(mb, 'y', px + 0.025, -yi, yi, zf, zc, 1, 'int_teak', [d.pdoor])
    reveal(mb, 'y', px - 0.025, px + 0.025, d.pdoor, 'int_teak')
    for x in (27.95, 28.6, 29.85, 30.45): mb.box(x - 0.03, x + 0.03, -yi, yi, zc - 0.07, zc, 'int_white', skip='+z')   # roof beams
    zs = d.wz[0]                                                                                                    # window ledges
    mb.box(xi0, xi1, -yi, -yi + 0.07, zs - 0.035, zs, 'int_teak'); mb.box(d.door[1] + 0.03, xi1, yi - 0.07, yi, zs - 0.035, zs, 'int_teak')
    mb.box(xi1 - 0.09, xi1, -yi + 0.07, yi - 0.07, zs - 0.035, zs, 'int_teak')
    mb.box(xi1 - 0.36, xi1 - 0.09, -0.21, 0.21, zs - 0.035, zs, 'int_teak'); steering_compass(mb, (xi1 - 0.19, 0.0, zs))
    mb.obj(coll)
    dm = H.MB('wheelhouse_door'); a, b = d.door[0], d.door[1]                                                         # the door, shut
    dm.box(a + 0.004, b - 0.004, HW - 0.05, HW - 0.01, zf + 0.004, d.door[3] - 0.004, 'teak')
    for z in (zf + 0.2, zf + 0.95):
        dm.box(a + 0.09, b - 0.09, HW - 0.01, HW - 0.004, z, z + 0.62, 'teak', skip='-y'); dm.box(a + 0.09, b - 0.09, HW - 0.056, HW - 0.05, z, z + 0.62, 'int_teak', skip='+y')
    dm.cyl((b - 0.07, HW - 0.01, zf + 0.92), (b - 0.07, HW + 0.035, zf + 0.92), 0.018, 0.026, 8, 'brass')
    dm.cyl((b - 0.07, HW - 0.05, zf + 0.92), (b - 0.07, HW - 0.095, zf + 0.92), 0.018, 0.026, 8, 'int_brass')
    dm.obj(coll)

    P = H.PREFIX
    # steam steering gear house: engine and wheel on the centreline, the man abaft it on a grating
    eng = snap(make(H, FB, 'steering_engine', 'steering_engine', wheel_d=1.0), sub, rz=math.pi, xmax=xi1 - 0.38, y=0.0, zmin=zf)
    snap(make(H, FB, 'wheel_grating', 'wheel_grating', length=0.6, width=1.2), sub, x=px + 0.36, y=0.0, zmin=zf)
    at(make(H, FB, 'voice_pipes', 'voice_pipes', n=2, length=1.1), sub, (px + 0.025, -1.15, zf + 1.3), 0.0)
    at(make(H, FB, 'bulkhead_dial', 'clinometer', kind='clinometer'), sub, (xi1, 0.5, 8.05), math.pi)
    at(make(H, FB, 'rudder_indicator', 'rudder_indicator'), sub, (xi1, -0.5, 8.05), math.pi)
    at(make(H, FB, 'electric_light', 'light_wheelhouse', kind='deckhead'), sub, (30.15, 0.75, zc), 0.0)
    if FIT and hasattr(FIT, 'engine_telegraph'):
        H.place(FIT.engine_telegraph(P + 'int_telegraph'), sub, (30.3, -1.05, zf))
    lamp(H, sub, 'wheelhouse', (30.15, 0.75, zc - 0.22), 'steam steering gear house', 6.0)
    # chart house
    tab = snap(make(H, FB, 'chart_table', 'chart_table', length=1.5, depth=0.7, height=0.95), sub, rz=0.0, xmin=xi0, y=-0.6, zmin=zf)
    ztab = top_of(tab) if tab else zf + 0.95
    snap(make(H, FB, 'chronometer_box', 'chronometer'), sub, x=xi0 + 0.2, y=-1.2, zmin=zf + 0.955)
    at(make(H, FB, 'book_shelf', 'book_shelf', length=0.9), sub, (xi0, -0.85, zf + 1.45), 0.0)
    at(make(H, FB, 'bulkhead_dial', 'clock', kind='clock'), sub, (xi0, -0.15, zf + 1.5), 0.0)
    at(make(H, FB, 'bulkhead_dial', 'barometer', kind='barometer'), sub, (xi0, 0.15, zf + 1.5), 0.0)
    at(make(H, FB, 'coat_hooks', 'oilskins', n=4, width=0.9), sub, (xi0, 0.95, zf + 1.62), 0.0)
    snap(make(H, FB, 'settee_locker', 'chart_settee', length=1.3, depth=0.5), sub, rz=math.pi, xmax=px - 0.025, y=-0.85, zmin=zf)
    at(make(H, FB, 'signal_flag_locker', 'flag_locker', cols=7, rows=4), sub, (px - 0.025, -1.0, zf + 1.42), math.pi)
    at(make(H, FB, 'long_glass_rack', 'long_glass'), sub, (px - 0.025, 0.0, zf + 1.45), math.pi)
    at(make(H, FB, 'electric_light', 'light_chart_house', kind='deckhead'), sub, (28.3, 0.2, zc), 0.0)
    lamp(H, sub, 'chart_house', (28.3, 0.2, zc - 0.22), 'chart house', 6.0)

# ------------------------------------------------------------------------------------------------ galley

def galley(H, coll, sub, deck):
    x0, x1, hw, zf, zc = 21.71, 23.98, 1.51, 4.62, 6.56
    sx, sl, sw, sh = 23.15, 0.59, 1.0, 0.4          # the galley skylight on the open deck between the casings
    base = H.deck_surface(sx, 0.0) - 0.02
    il, iw, _, _ = skylight_dims(sl, sw, sh); hole = (sx - il, sx + il, -iw, iw)
    mb = H.MB('int_galley')
    wall(mb, 'x', hw, x0, x1, zf, zc, -1, 'int_cream'); wall(mb, 'x', -hw, x0, x1, zf, zc, 1, 'int_cream')
    wall(mb, 'y', x0, -hw, hw, zf, zc, 1, 'int_cream'); wall(mb, 'y', x1, -hw, hw, zf, zc, -1, 'int_cream')
    flat(mb, x0, x1, -hw, hw, zf, 1, 'int_tile'); flat(mb, x0, x1, -hw, hw, zc, -1, 'int_white', [hole])
    for n in (40, 41, 42):
        x = FRAME(n)
        if not hole[0] - 0.04 < x < hole[1] + 0.04: mb.box(x - 0.035, x + 0.035, -hw, hw, zc - 0.10, zc, 'int_white', skip='+z')
        else:
            for s in (1, -1): mb.box(x - 0.035, x + 0.035, min(s * iw, s * hw), max(s * iw, s * hw), zc - 0.10, zc, 'int_white', skip='+z')
    skylight_well(mb, sx, base, sl, sw, sh, zc - 0.02, lining='int_white', bars=1)
    mb.box(x0, x1, -hw, -hw + 0.015, zf, zf + 0.12, 'int_iron', skip='-y'); mb.box(x0, x1, hw - 0.015, hw, zf, zf + 0.12, 'int_iron', skip='+y')   # coamings
    mb.obj(sub)
    cut_hole(deck, *hole); cut_hole(coll.objects.get(H.PREFIX + 'skylight_galley'), *hole, zmax=base + 0.06)   # deck, and the skylight's plinth
    # the range against the engine casing bulkhead, its funnel going up through the bridge deck
    rng = snap(make(H, FB, 'galley_range', 'galley_range', width=1.4, flue=zc - zf - 0.85), sub, rz=0.0, xmin=x0, y=0.72, zmin=zf)
    fun = coll.objects.get(H.PREFIX + 'galley_funnel')
    if rng and fun:                                   # the galley funnel on deck stands over the range's flue
        fx, fy = flue_xy(rng); fun.location = (fx, fy, H.deck_surface(fx, fy) - 0.02)
    zhot = zf + 0.86
    snap(make(H, FB, 'kettle', 'kettle'), sub, x=x0 + 0.42, y=1.1, zmin=zhot)
    snap(make(H, FB, 'stock_pot', 'stock_pot', d=0.3), sub, x=x0 + 0.42, y=0.45, zmin=zhot)
    snap(make(H, FB, 'coal_box', 'coal_box', length=0.7), sub, rz=0.0, xmin=x0, y=-0.6, zmin=zf)
    snap(make(H, FB, 'galley_sink', 'galley_sink', length=1.0), sub, rz=math.pi, xmax=x1, y=0.9, zmin=zf)
    dr = snap(make(H, FB, 'galley_dresser', 'galley_dresser', length=1.4), sub, rz=math.pi, xmax=x1, y=-0.75, zmin=zf)
    snap(make(H, FB, 'bread_barge', 'bread_barge'), sub, x=x1 - 0.3, y=-1.15, zmin=zf + 0.905)
    snap(make(H, FB, 'saucepan', 'saucepan', d=0.2), sub, x=x1 - 0.32, y=-0.35, zmin=zf + 0.905)
    at(make(H, FB, 'utensil_rail', 'utensil_rail', length=0.9), sub, (22.95, hw, zf + 1.38), -math.pi / 2)
    at(make(H, FB, 'mess_kid_shelf', 'mess_shelf', length=0.8), sub, (22.95, hw, zf + 1.62), -math.pi / 2)
    snap(make(H, FB, 'stool', 'galley_stool', height=0.5), sub, x=22.85, y=0.25, zmin=zf)
    at(make(H, FC, 'panelled_door', 'galley_door', width=0.66, height=1.8, open_deg=0), sub, (22.68, -hw + 0.036, zf), math.pi / 2)
    at(make(H, FB, 'electric_light', 'light_galley', kind='deckhead'), sub, (22.45, -0.5, zc), 0.0)
    lamp(H, sub, 'galley', (22.45, -0.5, zc - 0.22), 'galley', 8.0)
    return rng

# ------------------------------------------------------- after deckhouse: saloon entrance and state room

HATCH = (2.56, 4.06, 0.12, 1.05)    # the 'Hatch' of the quarter deck plan, inside the house, port of the centreline
DIVISION = 4.10                      # 'Saloon Entrance' abaft it, 'State Room' before it (plumber work plan)

def house_floor(H): return lambda x: H.deck_surface(x, 0.0) + 0.03

def deckhouse(H, sub, deck):
    X0, X1, HW, t = H.HOUSE_X0, H.HOUSE_X1, H.HOUSE_HW, 0.05
    xi0, xi1, yi = X0 + t, X1 - t, HW - t
    zf = house_floor(H); zc = H.HOUSE_Z1 - 0.05; dado = lambda x: zf(x) + 0.95; top = lambda x: zc
    hx0, hx1, hy0, hy1 = HATCH
    mb = H.MB('int_deckhouse')
    xs = [xi0 + (xi1 - xi0) * i / 8 for i in range(9)]
    for c, n in ((yi, -1), (-yi, 1)):
        wall_x(mb, c, xs, zf, dado, n, 'int_mahogany'); wall_x(mb, c, xs, dado, top, n, 'int_white')
    for x, n in ((xi0, 1), (xi1, -1)):
        wall(mb, 'y', x, -yi, yi, zf(x), dado(x), n, 'int_mahogany'); wall(mb, 'y', x, -yi, yi, dado(x), zc, n, 'int_white')
    door = (-0.75, -0.09, zf(DIVISION), zf(DIVISION) + 1.85)
    for x, n in ((DIVISION - 0.02, -1), (DIVISION + 0.02, 1)):
        wall(mb, 'y', x, -yi, yi, zf(DIVISION), dado(DIVISION), n, 'int_mahogany', [door]); wall(mb, 'y', x, -yi, yi, dado(DIVISION), zc, n, 'int_white', [door])
    reveal(mb, 'y', DIVISION - 0.02, DIVISION + 0.02, door, 'int_mahogany')
    flat(mb, xi0, xi1, -yi, yi, zf, 1, 'int_lino', [HATCH], step=0.5); flat(mb, xi0, xi1, -yi, yi, zc, -1, 'int_white')
    for x in (2.3, 3.2, 5.0): mb.box(x - 0.03, x + 0.03, -yi, yi, zc - 0.07, zc, 'int_white', skip='+z')
    for c, n in ((yi, -1), (-yi, 1)):                              # dado rail and skirting
        mb.sweep([[(x, c, dado(x) - 0.03), (x, c + n * 0.025, dado(x) - 0.03), (x, c + n * 0.025, dado(x) + 0.02), (x, c, dado(x) + 0.02)] for x in xs], 'int_mahogany')
    # the hatch: trunk down through the deck, brass rails on the two open sides
    zl = H.deck_surface(hx0, hy0) - 0.16
    for a, b, want in (((hx0, hy0), (hx1, hy0), (0, 1, 0)), ((hx1, hy0), (hx1, hy1), (-1, 0, 0)), ((hx1, hy1), (hx0, hy1), (0, -1, 0)), ((hx0, hy1), (hx0, hy0), (1, 0, 0))):
        mb.poly([(a[0], a[1], zl), (b[0], b[1], zl), (b[0], b[1], zf(b[0])), (a[0], a[1], zf(a[0]))], 'int_mahogany', Vector(want))
    for y in (hy0 - 0.03, hy1 + 0.03):
        xr = [hx0 + 0.02, (hx0 + hx1) / 2, hx1 - 0.02]
        for x in xr: mb.cyl((x, y, zf(x)), (x, y, zf(x) + 0.92), 0.016, 0.016, 6, 'int_brass')
        for h in (0.5, 0.92): mb.tube([(x, y, zf(x) + h) for x in xr], 0.014, 6, 'int_brass')
    # scuttles: one a side in each room and two in the front, where the house carries them outside
    for side in (1, -1):
        for x in (2.84, 4.64): scuttle_in(mb, (x, side * yi, 7.5), (0, -side, 0), 0.14)
        scuttle_in(mb, (xi1, side * 0.62, 7.55), (-1, 0, 0), 0.14)
    mb.obj(sub)
    cut_hole(deck, *HATCH)

    # saloon entrance
    for side in (1, -1):
        at(make(H, FC, 'panelled_door', f'house_door_{"P" if side > 0 else "S"}', width=0.62, height=1.72, open_deg=0), sub, (X0 + 0.65, side * (yi - 0.036), zf(X0 + 0.65)), -side * math.pi / 2)
    at(make(H, FC, 'panelled_door', 'state_room_door', width=0.66, height=1.85, open_deg=78), sub, (DIVISION, -0.42, zf(DIVISION)), math.pi)
    at(make(H, FC, 'coat_stand_pegs', 'entrance_pegs', width=0.6), sub, (xi0, -0.45, zf(xi0) + 1.6), 0.0)
    at(make(H, FC, 'gimbal_lamp', 'entrance_lamp'), sub, (xi0, 0.55, zf(xi0) + 1.5), 0.0)
    snap(make(H, FB, 'settee_locker', 'entrance_settee', length=1.15, depth=0.45), sub, rz=math.pi / 2, x=3.3, ymin=-yi, zmin=zf(3.3))
    at(make(H, FB, 'electric_light', 'light_entrance', kind='deckhead'), sub, (2.35, 0.0, zc), 0.0)
    lamp(H, sub, 'saloon_entrance', (2.35, 0.0, zc - 0.22), 'saloon entrance', 7.0)
    # state room: berth fore and aft on the port side, desk under the starboard scuttle, stove in the corner
    snap(make(H, FC, 'berth', 'berth', length=1.86, width=0.72), sub, rz=-math.pi / 2, x=(DIVISION + 0.02 + xi1) / 2, ymax=yi, zmin=zf(5.0))
    snap(make(H, FC, 'washstand', 'washstand'), sub, rz=math.pi, xmax=xi1, y=0.12, zmin=zf(xi1))
    stove = snap(make(H, FC, 'cabin_stove', 'state_room_stove', flue=zc - zf(5.7) - 0.6), sub, x=5.68, y=-0.82, zmin=zf(5.68))
    snap(make(H, FC, 'cabin_desk', 'state_room_desk', width=0.8), sub, rz=math.pi / 2, x=4.72, ymin=-yi, zmin=zf(4.72))
    snap(make(H, FC, 'cabin_chair', 'state_room_chair'), sub, rz=-math.pi / 2, x=4.72, y=-0.5, zmin=zf(4.72))
    snap(make(H, FC, 'gladstone_bag', 'keepers_bag'), sub, rz=0.4, x=4.45, y=0.2, zmin=zf(4.45))
    at(make(H, FC, 'water_carafe_rack', 'carafe_rack'), sub, (DIVISION + 0.02, 0.35, zf(DIVISION) + 1.45), 0.0)
    snap(make(H, FC, 'rug', 'state_room_rug', length=1.3, width=0.75), sub, x=5.0, y=-0.05, zmin=zf(5.0) - 0.004)
    at(make(H, FB, 'electric_light', 'light_state_room', kind='deckhead'), sub, (5.0, -0.1, zc), 0.0)
    lamp(H, sub, 'state_room', (5.0, -0.1, zc - 0.22), 'state room', 7.0)
    return stove

# --------------------------------------------------- below the quarter deck: stair lobby and saloon

SOLE = 3.50                 # cabin sole; the drawings give 3.40 to 3.61 along its length
LEDGE = SOLE + 0.95         # top of the locker fronts along the ship's side, and of the dado on the bulkheads
GAP = 0.20                  # frames and lining inside the shell plating
LOBBY = (2.30, 5.25)
SALOON = (5.30, 9.65)       # under the large skylight and the four evenly spaced scuttles (X 5.84 to 9.13)
PARTITION = -0.55           # fore-and-aft bulkhead on the starboard side of the lobby

class Hold:
    def __init__(self, H):
        self.H = H
    def ys(self, x): return max(self.H.hull_hb(x, SOLE) - GAP, 0.3)                    # foot of the locker front
    def lin(self, x, z): return max(self.H.hull_hb(x, z) - GAP, self.ys(x) + 0.01)     # the lining, following the shell
    def zt(self, x): return self.H.Z_RQD(x) - 0.14
    def yt(self, x): return max(self.lin(x, self.zt(x)), self.lin(x, LEDGE) + 0.01)    # where the lining meets the deckhead
    def cz(self, x, y): return self.H.deck_surface(x, y) - 0.14                        # deckhead lining between the beams
    def z_at(self, x, y):
        """Height at which the lining stands y off the centreline."""
        lo, hi = LEDGE, self.zt(x)
        if y >= self.lin(x, hi): return self.cz(x, y)
        for _ in range(22):
            mid = (lo + hi) / 2
            if self.lin(x, mid) < y: lo = mid
            else: hi = mid
        return (lo + hi) / 2

def hold_shell(g, mb, xa, xb, stbd=True, ymin=None, fixed=(), holes=()):
    """Sole, locker fronts, ledge, side lining, deckhead and beams of a compartment under the quarter deck."""
    frames = [FRAME(n) for n in range(0, 40) if xa + 0.08 < FRAME(n) < xb - 0.08]
    xs = sorted({xa, xb} | set(frames) | {v for h in holes for v in h[:2] if xa < v < xb})
    def prof(x, s):
        zs = (LEDGE + 0.45, LEDGE + 0.9)
        return [(x, s * g.ys(x), SOLE), (x, s * g.ys(x), LEDGE), (x, s * g.lin(x, LEDGE), LEDGE)] + [(x, s * g.lin(x, z), z) for z in zs if z < g.zt(x) - 0.05] + [(x, s * g.yt(x), g.cz(x, g.yt(x)))]
    def lanes(x):
        lo = -g.yt(x) if stbd else ymin; hi = g.yt(x); f = sorted(fixed)
        ys = [lo] + ([(lo + f[0]) / 2] if stbd and f else []) + f + ([(f[-1] + hi) / 2] if f else [(lo + hi) / 2]) + [hi]
        return ys
    for x0, x1 in zip(xs, xs[1:]):
        for s in ((1, -1) if stbd else (1,)):
            a, b = prof(x0, s), prof(x1, s); k = min(len(a), len(b))
            a = a[:k - 1] + [a[-1]]; b = b[:k - 1] + [b[-1]]
            for i in range(k - 1):
                mat = 'int_mahogany' if i < 2 else 'int_white'
                want = Vector((0, 0, 1)) if i == 1 else Vector((0, -s, 0.15))
                mb.poly([a[i], b[i], b[i + 1], a[i + 1]], mat, want)
        f0 = -g.ys(x0) if stbd else ymin; f1 = -g.ys(x1) if stbd else ymin
        mb.poly([(x0, f0, SOLE), (x1, f1, SOLE), (x1, g.ys(x1), SOLE), (x0, g.ys(x0), SOLE)], 'int_pine', Vector((0, 0, 1)))
        l0, l1 = lanes(x0), lanes(x1); xm = (x0 + x1) / 2
        for k in range(len(l0) - 1):
            ym = (l0[k] + l0[k + 1] + l1[k] + l1[k + 1]) / 4
            if any(h[0] < xm < h[1] and h[2] < ym < h[3] for h in holes): continue
            mb.poly([(x0, l0[k], g.cz(x0, l0[k])), (x1, l1[k], g.cz(x1, l1[k])), (x1, l1[k + 1], g.cz(x1, l1[k + 1])), (x0, l0[k + 1], g.cz(x0, l0[k + 1]))], 'int_white', Vector((0, 0, -1)))
    for x in frames:                                                # deck beams, one to a frame
        ly = lanes(x); run = []
        def flush():
            if len(run) > 1:
                mb.sweep([[(x - 0.035, y, g.cz(x, y) + 0.01), (x + 0.035, y, g.cz(x, y) + 0.01), (x + 0.035, y, g.cz(x, y) - 0.09), (x - 0.035, y, g.cz(x, y) - 0.09)] for y in run], 'int_white')
            run.clear()
        for k in range(len(ly) - 1):
            ym = (ly[k] + ly[k + 1]) / 2
            if any(h[0] - 0.04 < x < h[1] + 0.04 and h[2] < ym < h[3] for h in holes): flush(); continue
            if not run: run.append(ly[k])
            run.append(ly[k + 1])
        flush()

def bulkhead(g, mb, x, n, y0=None, y1=None, doors=()):
    """An athwartship joiner bulkhead at x facing n, fitted to the sole, lockers, lining and deckhead.  Mahogany to
    the ledge, white above.  doors: (y from, y to, height of the head)."""
    ysx, yl, yt = g.ys(x), g.lin(x, LEDGE), g.yt(x)
    lo = -yt if y0 is None else y0; hi = yt if y1 is None else y1
    cuts = {lo, hi, 0.0} | {s * v for s in (1, -1) for v in (ysx, yl, ysx / 2)} | {v for d in doors for v in d[:2]}
    cuts |= {s * (yl + (yt - yl) * k / 4) for s in (1, -1) for k in (1, 2, 3)}
    Y = sorted(v for v in cuts if lo - 1e-6 <= v <= hi + 1e-6); want = Vector((n, 0, 0))
    for ya, yb in zip(Y, Y[1:]):
        if yb - ya < 1e-5: continue
        ym = abs(ya + yb) / 2; door = next((d for d in doors if d[0] < (ya + yb) / 2 < d[1]), None)
        if door: fa = fb = door[2]
        elif ym <= ysx: fa = fb = SOLE
        elif ym <= yl: fa = fb = LEDGE
        else: fa, fb = g.z_at(x, abs(ya)), g.z_at(x, abs(yb))
        ha, hb = g.cz(x, ya), g.cz(x, yb)
        if fa < LEDGE - 1e-6:
            mb.poly([(x, ya, fa), (x, yb, fb), (x, yb, LEDGE), (x, ya, LEDGE)], 'int_mahogany', want); fa = fb = LEDGE
        mb.poly([(x, ya, min(fa, ha)), (x, yb, min(fb, hb)), (x, yb, hb), (x, ya, ha)], 'int_white', want)

def cabins(H, coll, sub, deck):
    g = Hold(H); zfh = house_floor(H); hx0, hx1, hy0, hy1 = HATCH
    sx, sl, sw, sh = 7.11, 1.9, 1.3, 0.96            # the saloon skylight as the fittings pass places it
    base = H.deck_surface(sx, 0.0) - 0.02
    il, iw, ridge, _ = skylight_dims(sl, sw, sh); well = (sx - il, sx + il, -iw, iw)
    door = (0.25, 0.91, SOLE + 1.85)
    mb = H.MB('int_cabins')
    hold_shell(g, mb, *LOBBY, stbd=False, ymin=PARTITION, fixed=(hy0, hy1), holes=[HATCH])
    hold_shell(g, mb, *SALOON, fixed=(-iw, 0.0, iw), holes=[well])
    bulkhead(g, mb, LOBBY[0], 1, y0=PARTITION)
    bulkhead(g, mb, LOBBY[1], -1, y0=PARTITION, doors=[door]); bulkhead(g, mb, SALOON[0], 1, doors=[door])
    reveal(mb, 'y', LOBBY[1], SALOON[0], (door[0], door[1], SOLE, door[2]), 'int_mahogany')
    bulkhead(g, mb, SALOON[1], -1)
    xs = [LOBBY[0] + (LOBBY[1] - LOBBY[0]) * i / 6 for i in range(7)]
    wall_x(mb, PARTITION, xs, lambda x: SOLE, lambda x: LEDGE, 1, 'int_mahogany'); wall_x(mb, PARTITION, xs, lambda x: LEDGE, lambda x: g.cz(x, PARTITION), 1, 'int_white')
    # the hatch trunk from the lobby deckhead up to the floor of the house
    for a, b, want in (((hx0, hy0), (hx1, hy0), (0, 1, 0)), ((hx1, hy0), (hx1, hy1), (-1, 0, 0)), ((hx1, hy1), (hx0, hy1), (0, -1, 0)), ((hx0, hy1), (hx0, hy0), (1, 0, 0))):
        mb.poly([(a[0], a[1], g.cz(a[0], a[1]) - 0.02), (b[0], b[1], g.cz(b[0], b[1]) - 0.02), (b[0], b[1], zfh(b[0]) - 0.2), (a[0], a[1], zfh(a[0]) - 0.2)], 'int_mahogany', Vector(want))
    zc0 = min(g.cz(x, y) for x in well[:2] for y in (0.0, iw)) - 0.02
    skylight_well(mb, sx, base, sl, sw, sh, zc0, lining='int_teak', bars=5)
    for x, z in H.PORTS['rqd']:                                     # the side scuttles, where the hull carries them
        for side in (1, -1):
            lobby = LOBBY[0] + 0.2 < x < LOBBY[1] - 0.2 and side > 0; saloon = SALOON[0] + 0.2 < x < SALOON[1] - 0.2
            if not (lobby or saloon): continue
            n = -H.hull_normal(x, z, side); n.z = 0
            scuttle_in(mb, (x, side * g.lin(x, z), z), n)
    mb.obj(sub)
    cut_hole(deck, *well); cut_hole(coll.objects.get(H.PREFIX + 'skylight_saloon'), *well, zmax=base + 0.2)

    # stair lobby
    rise = zfh(hx0) - SOLE; run = 1.75
    at(make(H, FC, 'companion_stair', 'companion_stair', rise=rise, run=run, width=hy1 - hy0 - 0.08), sub, (hx0 + run, (hy0 + hy1) / 2, SOLE), 0.0)
    at(make(H, FC, 'panelled_door', 'saloon_door', width=0.66, height=1.85, open_deg=80), sub, ((LOBBY[1] + SALOON[0]) / 2, 0.58, SOLE), 0.0)
    at(make(H, FC, 'panelled_door', 'cabin_door', width=0.62, height=1.8, open_deg=0, louvre=True), sub, (4.72, PARTITION + 0.036, SOLE), math.pi / 2)
    at(make(H, FC, 'gimbal_lamp', 'lobby_lamp'), sub, (LOBBY[1], -0.18, SOLE + 1.55), math.pi)
    at(make(H, FC, 'coat_stand_pegs', 'lobby_pegs', width=0.6), sub, (3.3, PARTITION, SOLE + 1.62), math.pi / 2)
    snap(make(H, FC, 'sea_chest', 'sea_chest', length=0.9), sub, rz=math.atan2(g.ys(5.1) - g.ys(4.3), 0.8), x=4.72, ymax=g.ys(4.72) - 0.03, zmin=SOLE)
    at(make(H, FB, 'electric_light', 'light_lobby', kind='deckhead'), sub, (4.7, 0.0, g.cz(4.7, 0.0)), 0.0)
    lamp(H, sub, 'lobby', (4.7, 0.0, g.cz(4.7, 0.0) - 0.22), 'stair lobby', 7.0)

    # saloon: table under the skylight, revolving chairs, sofa lockers along the sides, sideboard forward
    tab = make(H, FC, 'saloon_table', 'saloon_table', length=2.4, width=1.0, height=0.76)
    if tab:
        lo, hi = box_of(tab); snap(tab, sub, rz=0.0 if hi.x - lo.x >= hi.y - lo.y else math.pi / 2, x=sx + 0.05, y=0.0, zmin=SOLE)
    for side in (1, -1):
        for i, x in enumerate((sx - 0.75, sx + 0.05, sx + 0.85)):
            snap(make(H, FC, 'swivel_chair', f'chair_{i}_{"P" if side > 0 else "S"}'), sub, rz=-side * math.pi / 2, x=x, y=side * 0.92, zmin=SOLE)
        xm = 7.5; a = math.atan2(g.ys(xm + 1.4) - g.ys(xm - 1.4), 2.8)
        snap(make(H, FC, 'settee', f'settee_{"P" if side > 0 else "S"}', length=2.8, depth=0.6, back=0.5), sub, rz=-side * (math.pi / 2 - a), x=xm,
             y=side * (g.ys(xm) - 0.3 / math.cos(a) - 0.01), zmin=SOLE)
        for x, z in H.PORTS['rqd']:
            if SALOON[0] + 0.2 < x < SALOON[1] - 0.2:
                at(make(H, FC, 'port_curtains', f'curtains_{x:.0f}_{"P" if side > 0 else "S"}', d=0.3), sub, (x, side * (g.lin(x, z) - 0.035), z), -side * math.pi / 2)
    snap(make(H, FC, 'swivel_chair', 'chair_head'), sub, rz=math.pi, x=sx + 1.75, y=0.0, zmin=SOLE)
    snap(make(H, FC, 'sideboard', 'sideboard', length=1.6), sub, rz=math.pi, xmax=SALOON[1], y=-1.1, zmin=SOLE)
    snap(make(H, FC, 'bookcase', 'bookcase', width=0.9, height=1.2), sub, rz=0.0, xmin=SALOON[0], y=-1.15, zmin=SOLE)
    at(make(H, FC, 'panelled_door', 'pantry_door', width=0.62, height=1.8, open_deg=0), sub, (SALOON[1] - 0.036, 1.45, SOLE), math.pi)
    at(make(H, FC, 'framed_print', 'print_aft', width=0.6, height=0.45), sub, (SALOON[0], -2.25, SOLE + 1.5), 0.0)
    at(make(H, FC, 'framed_print', 'print_fwd', width=0.7, height=0.5), sub, (SALOON[1], 0.35, SOLE + 1.5), math.pi)
    at(make(H, FC, 'gimbal_lamp', 'saloon_lamp_fwd'), sub, (SALOON[1], 2.3, SOLE + 1.5), math.pi)
    at(make(H, FC, 'gimbal_lamp', 'saloon_lamp_aft'), sub, (SALOON[0], 1.7, SOLE + 1.5), 0.0)
    at(make(H, FB, 'bulkhead_dial', 'saloon_clock', kind='clock'), sub, (SALOON[1], -0.25, SOLE + 1.62), math.pi)
    zl = SOLE + 1.92
    at(make(H, FC, 'electrolier', 'electrolier', arms=3, drop=base + ridge - 0.06 - zl), sub, (sx, 0.0, base + ridge - 0.06), 0.0)
    snap(make(H, FC, 'rug', 'saloon_rug', length=3.6, width=2.3), sub, x=sx + 0.05, y=0.0, zmin=SOLE - 0.004)
    if tab: snap(make(H, FC, 'tea_tray', 'tea_tray'), sub, x=sx + 0.55, y=0.05, zmin=SOLE + 0.765)
    lamp(H, sub, 'saloon', (sx, 0.0, zl), 'saloon', 22.0)

# ------------------------------------------------------------------------------------------------- build

# Eye, target and lens for review renders (hesperus_interior_review.py)
VIEWS = {
    'wheelhouse': ((29.42, -0.75, 8.28), (31.0, 0.45, 7.72), 14), 'chart_house': ((29.12, 1.05, 8.3), (27.4, -0.75, 7.55), 14),
    'saloon_fwd': ((5.62, 1.75, 5.12), (9.0, -0.9, 4.25), 15), 'saloon_aft': ((9.3, -1.9, 5.1), (6.0, 0.6, 4.3), 15),
    'state_room': ((4.3, -0.95, 7.72), (5.9, 0.75, 6.85), 13), 'saloon_entrance': ((1.78, -0.95, 7.8), (4.0, 0.7, 6.7), 13),
    'stair_lobby': ((5.05, 1.5, 5.05), (2.9, 0.35, 4.75), 14), 'galley': ((23.8, -1.3, 6.3), (21.9, 0.85, 5.35), 13),
    'bridge_from_outside': ((34.2, 3.6, 9.3), (29.6, 0.0, 7.95), 40),
}

def build(H, coll):
    """Build the rooms into the ship's collection (wheelhouse walls) and the child collection Hesperus_interior."""
    del MISSING[:]
    make_materials(H)
    sub = bpy.data.collections.new(COLLECTION); coll.children.link(sub)
    deck = coll.objects.get(H.PREFIX + 'decks')
    wheelhouse(H, coll, sub)
    galley(H, coll, sub, deck)
    stove = deckhouse(H, sub, deck)
    pipe = coll.objects.get(H.PREFIX + 'saloon_stove_pipe')
    if stove and pipe:                                # the stove pipe on the house roof stands over the state room stove
        pipe.location.x, pipe.location.y = flue_xy(stove)
    cabins(H, coll, sub, deck)
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in sub.all_objects if o.type == 'MESH')
    print(f'HESPERUS interiors: {len(sub.all_objects)} objects, {tris} triangles' + (f'; furniture not found: {sorted(set(MISSING))}' if MISSING else ''))
    return sub

# ---------------------------------------------------------------------------------------------- NOTES
# Recorded (builder's drawings, 1896): the fore-and-aft extent and headroom of the chart house and steam steering
# gear house and the two names; five windows a side; the galley's walls and its skylight, and two hand pumps in it;
# the after deckhouse, its two room names, the division between them and the hatch inside it; the cabin sole from
# frame 1 to frame 20 at 7 ft 11 in below the quarter deck; the skylights and side scuttles; electric light throughout
# (79 lamps); a standard compass and a steering compass 2 ft apart in distance from the dynamo.
#
# Reconstruction: the wheelhouse door (port side, because none is drawn to starboard and the casing blocks the after
# wall) and its partition set 0.23 m forward of the drawn position to fall on a window mullion; every bulkhead, door
# and lining below the quarter deck (the saloon is placed under the large skylight between X 5.30 and 9.65, where
# four scuttles a side are evenly spaced; the stair runs forward from the hatch); the stove in the state room; the
# position of every lamp; all joinery, finishes and furniture, which follow ordinary practice of the 1890s.
# Not modelled: the spaces forward of the saloon and to starboard of the lobby (doors only), the alleyway outside the
# galley, the engine and boiler rooms, the officers' rooms and the crew space under the forecastle.
