"""Bridge and galley furniture for the lighthouse tender HESPERUS (Gourlay Brothers, Dundee, 1896).

Procedural, low-polygon furniture of 1896 to 1901 for the steam steering gear house, the chart
house and the galley, seen at arm's length in a first-person game.  Pure bpy / bmesh /
mathutils; the bmesh wrapper is shared with the sister module ``hesperus_fittings``.  No side
effects at import (apart from putting this folder on ``sys.path`` to find the sister module).

Conventions
-----------
* Metres.  Local axes of every piece: +Z up, the piece FACES local +X (the side a person stands
  at or looks at), width runs along Y.
* Floor-standing pieces: origin on the floor at the centre of the footprint.  Wall-mounted
  pieces: back plane at X = 0, the piece projects toward +X, origin on the back plane (where
  exactly is stated in each docstring).  Deckhead-hung pieces: origin at the attachment point,
  the piece hangs toward -Z.
* Every builder returns ONE mesh object named by ``name``: scale 1, no modifiers, not linked to
  any collection.  Curved surfaces are smooth shaded, hard edges are marked sharp, normals point
  outward.  Lettering and dial marks are thin faces standing 0.5 to 3 mm proud of the dial.
* Materials are assigned by name through ``get_mat`` and are the interior set only (``int_*``,
  separate from the weathered exterior ones); the caller's materials are used when they exist,
  otherwise a plain Principled placeholder is made from ``_PALETTE``.

Contact sheet and triangle table:

    blender -b --factory-startup -P tools/ships/hesperus_furniture_bridge.py -- [out.png]
"""
import math
import os
import random
import sys

import bpy
from mathutils import Matrix, Vector

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)
import hesperus_fittings as F  # noqa: E402

TAU = math.tau
PI = math.pi
_T, _R = F._T, F._R
_MIRROR_Y = F._MIRROR_Y
_ID = Matrix.Identity(4)
tri_count, inspect = F.tri_count, F.inspect

__all__ = [
    'get_mat', 'tri_count', 'inspect', 'FURNITURE', 'BUDGETS', 'DEMO_SET', 'demo',
    'steering_engine', 'wheel_grating', 'voice_pipes', 'bulkhead_dial', 'chart_table', 'chronometer_box',
    'signal_flag_locker', 'book_shelf', 'long_glass_rack', 'settee_locker', 'electric_light', 'coat_hooks',
    'rudder_indicator', 'galley_range', 'kettle', 'stock_pot', 'saucepan', 'frying_pan', 'galley_dresser',
    'galley_sink', 'coal_box', 'utensil_rail', 'stool', 'bread_barge', 'mess_kid_shelf',
]

# ------------------------------------------------------------------------------------- materials

# name: (base colour linear RGB, roughness, metallic) -- placeholders, the ship script owns the real ones
_PALETTE = {
    'int_mahogany': ((0.20, 0.065, 0.03), 0.30, 0.0),
    'int_teak': ((0.30, 0.15, 0.06), 0.40, 0.0),
    'int_pine': ((0.62, 0.48, 0.30), 0.60, 0.0),
    'int_white': ((0.82, 0.80, 0.74), 0.45, 0.0),
    'int_cream': ((0.78, 0.72, 0.56), 0.50, 0.0),
    'int_iron': ((0.03, 0.03, 0.035), 0.55, 0.0),
    'int_steel': ((0.45, 0.46, 0.47), 0.35, 1.0),
    'int_brass': ((0.78, 0.57, 0.20), 0.30, 1.0),
    'int_copper': ((0.72, 0.35, 0.18), 0.30, 1.0),
    'int_leather': ((0.10, 0.16, 0.10), 0.50, 0.0),
    'int_plush': ((0.32, 0.04, 0.05), 0.90, 0.0),
    'int_carpet': ((0.30, 0.05, 0.05), 0.95, 0.0),
    'int_lino': ((0.33, 0.22, 0.13), 0.60, 0.0),
    'int_tile': ((0.42, 0.16, 0.10), 0.60, 0.0),
    'int_linen': ((0.85, 0.84, 0.80), 0.90, 0.0),
    'int_wool': ((0.20, 0.22, 0.30), 0.95, 0.0),
    'int_paper': ((0.80, 0.74, 0.60), 0.80, 0.0),
    'int_book': ((0.22, 0.07, 0.05), 0.70, 0.0),
    'int_glass': ((0.75, 0.82, 0.82), 0.05, 0.0),
    'int_mirror': ((0.8, 0.8, 0.8), 0.03, 1.0),
    'int_enamel': ((0.86, 0.86, 0.84), 0.20, 0.0),
    'int_dial': ((0.88, 0.86, 0.78), 0.40, 0.0),
    'int_lamp_glow': ((1.0, 0.72, 0.35), 0.5, 0.0),
    'int_oilskin': ((0.55, 0.42, 0.10), 0.45, 0.0),
    'int_bunting_red': ((0.60, 0.03, 0.03), 0.9, 0.0),
    'int_bunting_blue': ((0.03, 0.06, 0.30), 0.9, 0.0),
    'int_bunting_yellow': ((0.80, 0.62, 0.05), 0.9, 0.0),
    'int_coal': ((0.012, 0.012, 0.014), 0.5, 0.0),
    # additions to the brief's list
    'int_opal': ((0.90, 0.88, 0.80), 0.25, 0.0),     # opal (milk) glass lamp shades
    'int_lead': ((0.30, 0.31, 0.33), 0.60, 0.6),     # dressed sheet lead (sink lining, waste pipes)
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
    mat.use_backface_culling = True     # single-sided, as the game engine will draw it
    return mat


# ------------------------------------------------------------------------------------ mesh helpers

class _Builder(F._Builder):
    """The sister module's bmesh wrapper plus a few furniture helpers; interior placeholders."""

    def finish(self, name):
        for n in self._mats:
            get_mat(n)
        return super().finish(name)

    def quad(self, pts, mat, sg=None):
        return self.face([self.v(p) for p in pts], mat, sg)

    def rod(self, p0, p1, r, n, mat, cap0=False, cap1=False, phase=0.0):
        """Straight round bar; ``r`` is a number or (r0, r1)."""
        rad = list(r) if isinstance(r, (list, tuple)) else r
        return self.tube([p0, p1], rad, n, mat, cap0=cap0, cap1=cap1, phase=phase)

    def bar(self, p0, p1, w, h, mat, up=(0, 0, 1), skip=''):
        """Flat-sided bar from p0 to p1, ``h`` deep along ``up`` and ``w`` across.
        ``skip``: '-z' / '+z' the p0 / p1 ends, '+x' / '-x' the up / down faces, '-y' / '+y' the sides."""
        p0, p1 = Vector(p0), Vector(p1)
        t = (p1 - p0).normalized()
        s = t.cross(Vector(up))
        if s.length < 1e-6:
            s = t.cross(Vector((1.0, 0.0, 0.0)))
        s.normalize()
        u = s.cross(t)
        a, c = u * (h / 2.0), s * (w / 2.0)
        ring = [-a - c, a - c, a + c, -a + c]
        return self.hexa([p0 + q for q in ring] + [p1 + q for q in ring], mat, skip)

    def frame4(self, outer, inner, mat):
        """Flat mitred frame between two rectangles given counter-clockwise seen from outside
        (coordinates or existing verts).  Returns (outer verts, inner verts)."""
        bmv = type(self.bm.verts.new((0.0, 0.0, 0.0)))
        self.bm.verts.remove(self.bm.verts[-1]) if False else None
        O = [p if isinstance(p, bmv) else self.v(p) for p in outer]
        I = [p if isinstance(p, bmv) else self.v(p) for p in inner]
        g = self.group()
        for i in range(4):
            j = (i + 1) % 4
            self.face([O[i], O[j], I[j], I[i]], mat, g)
        return O, I

    def recess(self, outer, inner, depth, mat, wall=None, floor=None):
        """Frame as ``frame4`` with the opening sunk by the vector ``depth``; ``floor=False``
        leaves the bottom open.  Returns the floor verts."""
        O, I = self.frame4(outer, inner, mat)
        return self.well(I, depth, wall or mat, floor)

    def well(self, rim, depth, wall, floor=None):
        """Walls (facing inward) and floor below an existing rim of four verts."""
        d = Vector(depth)
        inv = self.M.inverted()
        Bk = [self.v(inv @ p.co + d) for p in rim]
        for i in range(4):
            j = (i + 1) % 4
            self.face([rim[i], rim[j], Bk[j], Bk[i]], wall)
        if floor is not False:
            self.face(Bk, floor or wall)
        return Bk

    def fan(self, bl, br, tops, mat):
        """Flat panel under a row of verts ``tops`` (left to right seen from outside) down to
        two bottom corners, as a triangle fan that shares every vert."""
        g = self.group()
        self.face([bl, br, tops[-1]], mat, g)
        for k in range(len(tops) - 1, 0, -1):
            self.face([bl, tops[k], tops[k - 1]], mat, g)

    # -- flat marks in the plane X = x, facing +X; (u, v) = (Y, Z) ----------------------------
    def flat(self, x, pts, mat, sg=None):
        """Polygon from (y, z) points given counter-clockwise seen from +X."""
        return self.face([self.v((x, u, w)) for u, w in pts], mat, sg)

    def stroke(self, x, p, q, w, mat, ext=0.5):
        (u0, v0), (u1, v1) = p, q
        du, dv = u1 - u0, v1 - v0
        ln = math.hypot(du, dv) or 1.0
        du, dv = du / ln, dv / ln
        e = ext * w
        u0, v0, u1, v1 = u0 - du * e, v0 - dv * e, u1 + du * e, v1 + dv * e
        nu, nv = -dv * w / 2.0, du * w / 2.0
        return self.flat(x, [(u0 - nu, v0 - nv), (u1 - nu, v1 - nv), (u1 + nu, v1 + nv), (u0 + nu, v0 + nv)], mat)

    def hand(self, x, c, ang, length, w, mat, tail=0.2):
        """Kite-shaped pointer from centre ``c`` toward ``ang`` degrees (0 = +Y, 90 = +Z)."""
        a = math.radians(ang)
        du, dv = math.cos(a), math.sin(a)
        nu, nv = -dv, du
        cu, cv = c
        return self.flat(x, [(cu - tail * length * du, cv - tail * length * dv),
                             (cu + 0.3 * length * du - w * nu, cv + 0.3 * length * dv - w * nv),
                             (cu + length * du, cv + length * dv),
                             (cu + 0.3 * length * du + w * nu, cv + 0.3 * length * dv + w * nv)], mat)

    def disc(self, x, c, r, n, mat):
        cu, cv = c
        return self.flat(x, [(cu + r * math.cos(TAU * k / n), cv + r * math.sin(TAU * k / n)) for k in range(n)], mat)

    def arc_text(self, x, s, c, radius, mid, h, w, mat, gap=0.32):
        """Stroke lettering along an arc about ``c``: baseline at ``radius``, caps ``h`` high
        standing radially outward, reading clockwise, centred on ``mid`` degrees."""
        adv = [(_GLYPHS[ch][0] + gap) * h for ch in s]
        ang = math.radians(mid) + 0.5 * (sum(adv) - gap * h) / radius
        for ch, a in zip(s, adv):
            gw, strokes = _GLYPHS[ch]
            th = ang - 0.5 * gw * h / radius
            ru, rv = math.cos(th), math.sin(th)       # glyph up
            tu, tv = rv, -ru                          # glyph right
            ou = c[0] + ru * radius - tu * 0.5 * gw * h
            ov = c[1] + rv * radius - tv * 0.5 * gw * h
            for (x0, y0), (x1, y1) in strokes:
                self.stroke(x, (ou + tu * x0 * h + ru * y0 * h, ov + tv * x0 * h + rv * y0 * h),
                            (ou + tu * x1 * h + ru * y1 * h, ov + tv * x1 * h + rv * y1 * h), w, mat)
            ang -= a / radius


# stroke capitals: letter -> (width, [((x0, y0), (x1, y1)), ...]) in units of the cap height
_P = [((0, 0), (0, 1)), ((0, 1), (0.5, 1)), ((0.5, 1), (0.5, 0.5)), ((0.5, 0.5), (0, 0.5))]
_GLYPHS = {
    'I': (0.0, [((0, 0), (0, 1))]),
    'V': (0.5, [((0, 1), (0.25, 0)), ((0.25, 0), (0.5, 1))]),
    'X': (0.5, [((0, 0), (0.5, 1)), ((0, 1), (0.5, 0))]),
    'P': (0.5, _P),
    'R': (0.5, _P + [((0.15, 0.5), (0.5, 0))]),
    'O': (0.5, [((0, 0), (0, 1)), ((0, 1), (0.5, 1)), ((0.5, 1), (0.5, 0)), ((0.5, 0), (0, 0))]),
    'T': (0.5, [((0.25, 0), (0.25, 1)), ((0, 1), (0.5, 1))]),
    'S': (0.5, [((0.5, 1), (0, 1)), ((0, 1), (0, 0.5)), ((0, 0.5), (0.5, 0.5)), ((0.5, 0.5), (0.5, 0)),
                ((0.5, 0), (0, 0))]),
    'A': (0.5, [((0, 0), (0.25, 1)), ((0.25, 1), (0.5, 0)), ((0.1, 0.38), (0.4, 0.38))]),
    'B': (0.5, [((0, 0), (0, 1)), ((0, 1), (0.42, 1)), ((0.42, 1), (0.42, 0.52)), ((0, 0.52), (0.5, 0.52)),
                ((0.5, 0.52), (0.5, 0)), ((0.5, 0), (0, 0))]),
    'D': (0.5, [((0, 0), (0, 1)), ((0, 1), (0.3, 1)), ((0.3, 1), (0.5, 0.75)), ((0.5, 0.75), (0.5, 0.25)),
                ((0.5, 0.25), (0.3, 0)), ((0.3, 0), (0, 0))]),
}


def _fillet(pts, d, steps=1):
    """Ease the corners of a polyline: each corner becomes ``steps`` + 1 points on a curve that
    leaves the legs ``d`` from the corner (so a round bar does not pinch at the bend)."""
    P = [Vector(p) for p in pts]
    out = [P[0]]
    for i in range(1, len(P) - 1):
        a, c = P[i] - P[i - 1], P[i + 1] - P[i]
        p0 = P[i] - a.normalized() * min(d, 0.45 * a.length)
        p2 = P[i] + c.normalized() * min(d, 0.45 * c.length)
        for k in range(steps + 1):
            t = k / steps
            out.append(p0.lerp(P[i], t).lerp(P[i].lerp(p2, t), t))
    out.append(P[-1])
    return out


def _tufted(b, org, au, av, an, nu, nv, su, sv, edge, puff, dimple, mat, buttons=True):
    """Buttoned upholstery: a pad ``su`` x ``sv`` on the plane through ``org`` spanned by the
    unit axes ``au`` and ``av`` (au x av = an), ``edge`` thick at the border, swelling by
    ``puff`` between the buttons and drawn in by ``dimple`` at them (diamond pattern)."""
    org, au, av, an = Vector(org), Vector(au), Vector(av), Vector(an)
    g = b.group()
    V, btn = {}, []
    for i in range(nu + 1):
        for j in range(nv + 1):
            if not (0 < i < nu and 0 < j < nv):
                h = edge
            elif (i + j) % 2 == 0:
                h = edge - dimple
                btn.append(org + au * (su * i / nu) + av * (sv * j / nv) + an * h)
            else:
                h = edge + puff
            V[i, j] = b.v(org + au * (su * i / nu) + av * (sv * j / nv) + an * h)
    for i in range(nu):
        for j in range(nv):
            p, q, r, s = V[i, j], V[i + 1, j], V[i + 1, j + 1], V[i, j + 1]
            if (i + j) % 2 == 0:
                b.face([p, q, r], mat, g)
                b.face([p, r, s], mat, g)
            else:
                b.face([p, q, s], mat, g)
                b.face([q, r, s], mat, g)
    c00, c10, c11, c01 = (b.v(org), b.v(org + au * su), b.v(org + au * su + av * sv), b.v(org + av * sv))
    b.fan(c00, c10, [V[i, 0] for i in range(nu + 1)], mat)
    b.fan(c10, c11, [V[nu, j] for j in range(nv + 1)], mat)
    b.fan(c11, c01, [V[i, nv] for i in range(nu, -1, -1)], mat)
    b.fan(c01, c00, [V[0, j] for j in range(nv, -1, -1)], mat)
    if buttons:
        rb = 0.011
        for p in btn:
            gb = b.group()
            top = b.v(p + an * 0.009)
            ring = [b.v(p + an * 0.004 + d * rb) for d in (au, av, -au, -av)]
            for k in range(4):
                b.face([ring[k], ring[(k + 1) % 4], top], mat, gb)


def _dial_case(b, R, depth=0.058, n=14, face='int_dial'):
    """Brass drum case with a flange against the bulkhead and a stepped bezel; back at X = 0.
    Returns (X of the dial face, radius of the dial)."""
    xd = depth
    b.lathe([(R, 0.0), (R, 0.010), (0.88 * R, 0.014), (0.88 * R, xd - 0.012), (0.95 * R, xd - 0.008),
             (0.95 * R, xd + 0.004), (0.81 * R, xd + 0.011), (0.78 * R, xd)], n, 'int_brass', axis='X',
            cap1=face, crease=30.0)
    return xd, 0.78 * R


# =========================================================================================
#  Steam steering gear house and chart house
# =========================================================================================

def steering_engine(name='steering_engine', wheel_d=1.0):
    """Combined steam steering engine of the 1890s (in the manner of John Hastie, Greenock):
    cast-iron bed lying athwartships, two small horizontal steam cylinders with mahogany
    lagging and brass bands, opposed and staggered, working cranks at right angles on a short
    fore-and-aft shaft that enters the worm-gear housing; valve chests, copper steam pipe with
    a brass stop valve; a column on the housing carrying the wheel shaft, a brass helm-indicator
    plate on its head, a brass maker's plate, and an eight-spoked teak wheel with a brass-faced
    rim and brass boss.

    Origin: on the floor at the centre of the bed (bed 0.60 along X by 0.85 along Y; its back
    edge X = -0.30 stands against the forward bulkhead).  The helmsman stands on the +X side;
    wheel plane X = +0.375, hub 1.00 above the floor; nothing but the wheel rises above 1.05.
    Depth over the wheel boss 0.745.  ``wheel_d`` is the diameter over the spoke handles."""
    b = _Builder()
    IR, ST, BR, CU, TK, MH = 'int_iron', 'int_steel', 'int_brass', 'int_copper', 'int_teak', 'int_mahogany'
    d = float(wheel_d)
    k = d
    zs, xw = 1.0, 0.375                              # wheel shaft height, wheel plane
    xh = 0.13                                        # centre of the gear housing and column
    zk = 0.16                                        # crankshaft and cylinder axes
    # bed
    b.box((-0.30, -0.425, 0.0), (0.30, 0.425, 0.045), IR, skip='-z +z')
    b.frustum((0.0, 0.0, 0.045), (0.30, 0.425), (0.0, 0.0, 0.07), (0.285, 0.41), IR, skip='-z')
    # gear housing with the round worm-wheel case, column, head
    b.frustum((xh, 0.0, 0.07), (0.15, 0.14), (xh, 0.0, 0.60), (0.115, 0.115), IR, skip='-z +z')
    with b.at(_T(xh, 0.0, 0.35)):
        b.lathe([(0.125, -0.168), (0.16, -0.15), (0.16, 0.15), (0.125, 0.168)], 10, IR, axis='Y',
                cap0=True, cap1=True, crease=20.0)
    b.box((xh - 0.125, -0.125, 0.60), (xh + 0.125, 0.125, 0.63), IR)
    b.frustum((xh, 0.0, 0.63), (0.10, 0.10), (xh, 0.0, 0.93), (0.085, 0.085), IR, skip='-z +z')
    b.box((xh - 0.095, -0.095, 0.93), (xh + 0.10, 0.095, 1.03), IR, skip='+z')
    b.box((xh + 0.089, -0.055, 0.735), (xh + 0.099, 0.055, 0.80), BR, skip='-x')      # maker's plate
    # helm indicator: brass plate on the head, pale arc, pointer on a pivot
    b.box((xh - 0.10, -0.10, 1.03), (xh + 0.105, 0.10, 1.04), BR, skip='-z')
    px = xh - 0.05
    angs = [math.radians(-40.0 + 20.0 * i) for i in range(5)]
    g = b.group()
    for a0, a1 in zip(angs, angs[1:]):
        b.quad([(px + r * math.cos(a), r * math.sin(a), 1.0406)
                for r, a in ((0.105, a0), (0.14, a0), (0.14, a1), (0.105, a1))], 'int_dial', g)
    for a in angs:
        c, s = math.cos(a), math.sin(a)
        b.quad([(px + 0.112 * c + 0.002 * s, 0.112 * s - 0.002 * c, 1.0412),
                (px + 0.136 * c + 0.002 * s, 0.136 * s - 0.002 * c, 1.0412),
                (px + 0.136 * c - 0.002 * s, 0.136 * s + 0.002 * c, 1.0412),
                (px + 0.112 * c - 0.002 * s, 0.112 * s + 0.002 * c, 1.0412)], IR)
    b.quad([(px - 0.02, 0.0, 1.0436), (px + 0.03, -0.007, 1.0436), (px + 0.128, 0.0, 1.0436),
            (px + 0.03, 0.007, 1.0436)], IR)
    with b.at(_T(px, 0.0, 0.0)):
        b.lathe([(0.013, 1.04), (0.013, 1.047), (0.0, 1.05)], 6, BR, crease=30.0)
    # wheel shaft and its bearing boss
    with b.at(_T(0.0, 0.0, zs)):
        b.lathe([(0.045, xh + 0.10), (0.045, xh + 0.125), (0.028, xh + 0.14)], 8, IR, axis='X', crease=30.0)
    b.rod((xh + 0.14, 0.0, zs), (xw - 0.04, 0.0, zs), 0.02, 5, ST)
    # cylinders (port one aft of the starboard one), valve chests, rods, cranks
    R, r = 0.085, 0.072
    for mir, xc, xa, xb, pin in ((_ID, -0.205, -0.05, 0.07, (0.0, 0.042)),
                                 (_MIRROR_Y, -0.085, -0.07, 0.05, (-0.042, 0.0))):
        with b.at(mir):
            with b.at(_T(xc, 0.0, zk)):
                b.lathe([(0.0, -0.415), (R, -0.415), (R, -0.40), (r, -0.40), (r, -0.37), (r, -0.26), (r, -0.23),
                         (R, -0.23), (R, -0.215), (0.0, -0.215)], 8,
                        [IR, IR, IR, BR, MH, BR, IR, IR, IR], axis='Y', crease=30.0)
            b.box((xc + xa, -0.395, zk + 0.055), (xc + xb, -0.235, zk + 0.115), IR, skip='-z')
            b.rod((xc, -0.215, zk), (xc, -0.125, zk), 0.010, 4, ST)
            b.box((xc - 0.02, -0.125, zk - 0.025), (xc + 0.02, -0.085, zk + 0.025), ST)
            b.rod((xc, -0.105, zk), (xc, pin[0], zk + pin[1]), (0.011, 0.016), 4, ST)
            b.rod((xc - 0.022, pin[0], zk + pin[1]), (xc + 0.026, pin[0], zk + pin[1]), 0.012, 4, ST, cap0=True)
    with b.at(_T(0.0, 0.0, zk)):
        for x0, x1 in ((-0.185, -0.165), (-0.125, -0.11), (-0.06, -0.045)):
            b.lathe([(0.058, x0), (0.058, x1)], 8, IR, axis='X', cap0=True, cap1=True)
    b.rod((-0.165, 0.0, zk), (-0.125, 0.0, zk), 0.02, 5, ST)
    b.rod((-0.045, 0.0, zk), (xh - 0.14, 0.0, zk), 0.02, 5, ST)
    # steam: riser with stop valve, branch pipe to both valve chests
    zp = 0.41
    b.tube(_fillet([(-0.145, -0.315, zk + 0.115), (-0.145, -0.315, zp), (-0.145, 0.315, zp),
                    (-0.145, 0.315, zk + 0.115)], 0.04), 0.016, 5, CU, up=(1, 0, 0))
    b.tube(_fillet([(-0.275, 0.0, 0.05), (-0.275, 0.0, zp), (-0.145, 0.0, zp)], 0.04), 0.016, 5, CU, up=(0, 1, 0))
    with b.at(_T(-0.275, 0.0, 0.0)):
        b.lathe([(0.017, 0.235), (0.03, 0.25), (0.03, 0.285), (0.017, 0.30)], 6, BR, crease=30.0)
    b.rod((-0.275, 0.025, 0.2675), (-0.275, 0.08, 0.2675), 0.006, 3, ST)
    with b.at(_T(-0.275, 0.0, 0.2675)):
        b.lathe([(0.036, 0.076), (0.036, 0.085)], 6, BR, axis='Y', cap0=True, cap1=True)
    # the wheel
    with b.at(_T(xw, 0.0, zs)):
        ro, ri, t = 0.37 * d, 0.315 * d, 0.024
        b.lathe([(ri, -t), (ro, -t), (ro, t), (ri, t)], 16, [TK, TK, BR, TK], axis='X', loop=True, crease=30.0)
        b.lathe([(0.075 * k, -0.04), (0.075 * k, 0.04), (0.058 * k, 0.05), (0.03 * k, 0.052), (0.024 * k, 0.066),
                 (0.0, 0.068)], 8, [TK, BR, BR, BR, BR], axis='X', cap0=TK, crease=30.0)
        for i in range(8):
            with b.at(_R('X', 45.0 * i)):
                b.rod((0.0, 0.0, 0.07 * k), (0.0, 0.0, ri + 0.004), (0.019 * k, 0.025 * k), 4, TK)
                b.tube([(0.0, 0.0, ro - 0.004), (0.0, 0.0, ro + 0.05 * k), (0.0, 0.0, 0.5 * d)],
                       [0.017 * k, 0.023 * k, 0.012 * k], 4, TK, cap1=True)
    return b.finish(name)


def wheel_grating(name='wheel_grating', length=0.9, width=1.2):
    """Teak grating for the helmsman to stand on: mitred frame, battens let into deeper ledges,
    open square holes of about 35 mm, 40 mm thick.
    Origin: on the floor at the centre.  ``length`` along X, ``width`` along Y."""
    b = _Builder()
    TK = 'int_teak'
    hx, hy, th = length / 2.0, width / 2.0, 0.04
    f = min(0.065, 0.25 * min(length, width))
    O = [(-hx, -hy, th), (hx, -hy, th), (hx, hy, th), (-hx, hy, th)]
    I = [(-hx + f, -hy + f, th), (hx - f, -hy + f, th), (hx - f, hy - f, th), (-hx + f, hy - f, th)]
    b.recess(O, I, (0.0, 0.0, -th), TK, floor=False)
    b.box((-hx, -hy, 0.0), (hx, hy, th), TK, skip='+z -z')
    bw, hole = 0.03, 0.036
    sx, sy = 2.0 * (hx - f), 2.0 * (hy - f)
    nx = max(1, round((sx - hole) / (bw + hole)))
    ny = max(1, round((sy - hole) / (bw + hole)))
    gx, gy = (sx - nx * bw) / (nx + 1), (sy - ny * bw) / (ny + 1)
    for i in range(nx):                              # battens, athwart
        x0 = -hx + f + gx * (i + 1) + bw * i
        b.box((x0, -hy + f, th - 0.02), (x0 + bw, hy - f, th), TK, skip='-z -y +y')
    for j in range(ny):                              # ledges, fore and aft, a hair lower
        y0 = -hy + f + gy * (j + 1) + bw * j
        b.box((-hx + f, y0, 0.0), (hx - f, y0 + bw, th - 0.0015), TK, skip='-z -x +x')
    return b.finish(name)


def voice_pipes(name='voice_pipes', n=2, length=1.1):
    """Brass speaking tubes: ``n`` pipes of 40 mm clipped to the bulkhead come down from the
    deckhead and sweep out and up to bell mouthpieces, each stopped with a whistle plug on a
    chain; an ivory tally plate beside each mouth.  Alternate pipes end 0.13 higher.

    Origin: on the bulkhead (X = 0) at the centre of the group, half way down the run: the
    pipes span Z = -length/2 .. +length/2 and stand 0.19 off the bulkhead at the mouths."""
    b = _Builder()
    BR = 'int_brass'
    n = max(1, int(n))
    L = float(length)
    r, pitch, Rb = 0.02, 0.15, 0.075
    x0 = r + 0.006
    for i in range(n):
        y = (i - (n - 1) / 2.0) * pitch
        zc = -L / 2.0 + Rb + r + 0.13 * (i % 2)
        C = Vector((x0 + Rb, y, zc))
        path = [(x0, y, L / 2.0), (x0, y, zc)]
        for deg in (30, 60, 90, 120):
            a = math.radians(deg)
            path.append(C + Vector((-math.cos(a), 0.0, -math.sin(a))) * Rb)
        b.tube(path, r, 6, BR, cap0=True, up=(1, 0, 0))
        M = _T(*path[-1]) @ _R('Y', 60.0)
        with b.at(M):
            b.lathe([(0.025, -0.004), (0.025, 0.02), (0.02, 0.02), (0.022, 0.045), (0.048, 0.08), (0.048, 0.086),
                     (0.038, 0.088), (0.038, 0.094), (0.011, 0.096), (0.011, 0.106), (0.0, 0.11)], 8, BR,
                    crease=30.0)
        p1 = M @ Vector((0.0, -0.012, 0.102))
        p2 = M @ Vector((0.0, -0.026, 0.008))
        mid = (p1 + p2) / 2.0 + Vector((0.0, -0.012, -0.055))
        b.tube([p1, p1.lerp(mid, 0.6) + Vector((0, 0, -0.012)), mid, p2.lerp(mid, 0.6) + Vector((0, 0, -0.012)), p2],
               0.0025, 3, BR)
        for z in (L / 2.0 - 0.10, zc + 0.09):
            b.box((0.0, y - r - 0.014, z - 0.012), (x0 + r + 0.003, y + r + 0.014, z + 0.012), BR, skip='-x')
        zl = zc + 0.02
        b.box((0.0, y - 0.108, zl), (0.003, y - 0.04, zl + 0.024), 'int_dial', skip='-x')
    return b.finish(name)


def bulkhead_dial(name='bulkhead_dial', kind='clock'):
    """Brass-cased bulkhead instrument, 0.2 m across.

    ``kind='clock'``: ship's clock, flanged drum case and bezel, pale dial with Roman numerals
    and blued hands.  ``'barometer'``: aneroid in the same case with a hanging ring, graduated
    arc, blued indicating hand and a brass setting hand on a milled knob.  ``'clinometer'``:
    brass sector plate on a teak board, pale graduated arc, pendulum with a brass bob.
    Origin: centre of the back face (clock, barometer: the case axis; clinometer: the centre of
    the board).  Back at X = 0; depth 0.07 to 0.08."""
    b = _Builder()
    BR, DI, IR = 'int_brass', 'int_dial', 'int_iron'
    if kind == 'clock':
        xd, rd = _dial_case(b, 0.10)
        for hr, num in enumerate(('XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI')):
            b.arc_text(xd + 0.0006, num, (0.0, 0.0), 0.049, 90.0 - 30.0 * hr, 0.017, 0.0026, IR, gap=0.26)
        hh, mm = 10, 9
        b.hand(xd + 0.002, (0.0, 0.0), 90.0 - 30.0 * (hh + mm / 60.0), 0.04, 0.0045, IR)
        b.hand(xd + 0.0032, (0.0, 0.0), 90.0 - 6.0 * mm, 0.064, 0.003, IR)
        b.disc(xd + 0.0042, (0.0, 0.0), 0.006, 6, BR)
    elif kind == 'barometer':
        xd, rd = _dial_case(b, 0.10)
        for i in range(19):
            a = math.radians(225.0 - 15.0 * i)
            r0 = 0.058 if i % 3 == 0 else 0.064
            b.stroke(xd + 0.0006, (r0 * math.cos(a), r0 * math.sin(a)),
                     (0.072 * math.cos(a), 0.072 * math.sin(a)), 0.0022, IR, ext=0.0)
        b.hand(xd + 0.002, (0.0, 0.0), 72.0, 0.056, 0.003, IR, tail=0.3)
        b.hand(xd + 0.0105, (0.0, 0.0), 118.0, 0.05, 0.0022, BR, tail=0.0)
        b.lathe([(0.004, xd), (0.004, xd + 0.010), (0.011, xd + 0.010), (0.011, xd + 0.021), (0.0, xd + 0.023)],
                6, BR, axis='X', crease=30.0)
        b.ring_loop([(0.006, 0.019 * math.cos(TAU * i / 6), 0.111 + 0.019 * math.sin(TAU * i / 6))
                     for i in range(6)], 0.004, 3, BR, (1.0, 0.0, 0.0), sg=None)
    elif kind == 'clinometer':
        b.box((0.0, -0.13, -0.105), (0.012, 0.13, 0.115), 'int_teak', skip='-x')
        pv = (0.0, 0.075)                            # pivot
        Ra = 0.168
        arc = [math.radians(-42.0 + 14.0 * i) for i in range(7)]
        outline = [(-0.03, 0.098)] + [(Ra * math.sin(a), pv[1] - Ra * math.cos(a)) for a in arc] + [(0.03, 0.098)]
        b.prism(outline, 0.012, 0.017, BR, plane='YZ', cap0=False, crease=50.0)
        sc = [math.radians(-39.0 + 13.0 * i) for i in range(7)]
        g = b.group()
        for a0, a1 in zip(sc, sc[1:]):
            b.flat(0.0176, [(r * math.sin(a), pv[1] - r * math.cos(a))
                            for r, a in ((0.158, a0), (0.158, a1), (0.124, a1), (0.124, a0))], DI, g)
        for i in range(13):
            a = math.radians(-36.0 + 6.0 * i)
            r0 = 0.132 if i % 2 == 0 else 0.142
            b.stroke(0.0182, (r0 * math.sin(a), pv[1] - r0 * math.cos(a)),
                     (0.154 * math.sin(a), pv[1] - 0.154 * math.cos(a)), 0.0022, IR, ext=0.0)
        b.bar((0.021, 0.0, pv[1]), (0.021, 0.0, pv[1] - 0.10), 0.006, 0.003, 'int_steel', up=(1, 0, 0), skip='-z +z')
        b.flat(0.0225, [(-0.006, pv[1] - 0.118), (0.0, pv[1] - 0.15), (0.006, pv[1] - 0.118)], IR)
        with b.at(_T(0.0, 0.0, pv[1] - 0.105)):
            b.lathe([(0.021, 0.018), (0.021, 0.026), (0.012, 0.03)], 8, BR, axis='X', cap1=True, crease=30.0)
        with b.at(_T(0.0, 0.0, pv[1])):
            b.lathe([(0.011, 0.017), (0.011, 0.025), (0.0, 0.028)], 6, BR, axis='X', crease=30.0)
    else:
        raise ValueError("bulkhead_dial kind must be 'clock', 'barometer' or 'clinometer'")
    return b.finish(name)


def chart_table(name='chart_table', length=1.5, depth=0.8, height=0.95):
    """Teak chart table: top with a raised lip (low at the front), three shallow full-width
    chart drawers with brass bail pulls, a two-door locker below, plinth.  On it an Admiralty
    chart lying half unrolled over a second sheet, a pair of parallel rules with brass links,
    brass dividers and a pencil.

    Origin: on the floor at the centre of the footprint.  Back at -X (against the bulkhead),
    user at +X; ``height`` is the working surface, the lip stands 0.035 above it."""
    b = _Builder()
    TK, BR, PA = 'int_teak', 'int_brass', 'int_paper'
    L, D, H = float(length), float(depth), float(height)
    hx, hy, tt = D / 2.0, L / 2.0, 0.035
    b.box((-hx, -hy, H - tt), (hx, hy, H), TK)
    b.box((-hx, -hy, H), (-hx + 0.022, hy, H + 0.035), TK, skip='-z')
    for s in (1.0, -1.0):
        y0, y1 = sorted((s * hy, s * (hy - 0.022)))
        b.box((-hx + 0.022, y0, H), (hx, y1, H + 0.022), TK, skip='-z -x')
    b.box((hx - 0.022, -hy + 0.022, H), (hx, hy - 0.022, H + 0.009), TK, skip='-z -y +y')
    xf = hx - 0.035                                  # carcase front
    b.box((-hx, -hy + 0.03, 0.07), (xf, hy - 0.03, H - tt), TK, skip='-z +z')
    b.box((-hx, -hy + 0.05, 0.0), (xf - 0.045, hy - 0.05, 0.07), TK, skip='-z +z')
    yd = hy - 0.055
    z = H - tt - 0.018
    for i in range(3):
        b.box((xf, -yd, z - 0.085), (xf + 0.012, yd, z), TK, skip='-x')
        for s in (1.0, -1.0):
            yc, zc = s * 0.55 * yd, z - 0.04
            b.tube([(xf + 0.012, yc - 0.045, zc), (xf + 0.034, yc - 0.038, zc - 0.006),
                    (xf + 0.034, yc + 0.038, zc - 0.006), (xf + 0.012, yc + 0.045, zc)], 0.0045, 3, BR)
        z -= 0.097
    zd0, zd1 = 0.10, z - 0.005
    for s in (1.0, -1.0):
        y0, y1 = sorted((s * 0.006, s * yd))
        b.box((xf, y0, zd0), (xf + 0.012, y1, zd1), TK, skip='-x')
        b.box((xf + 0.012, y0 + 0.07, zd0 + 0.07), (xf + 0.018, y1 - 0.07, zd1 - 0.07), TK, skip='-x')
        with b.at(_T(0.0, s * 0.04, 0.5 * (zd0 + zd1) + 0.05)):
            b.lathe([(0.007, xf + 0.012), (0.014, xf + 0.028), (0.012, xf + 0.038), (0.0, xf + 0.042)], 6, BR,
                    axis='X', crease=30.0)
    # the charts
    cw, cl = min(0.68, D - 0.12), min(1.0, L - 0.34)
    zc = H + 0.0012
    with b.at(_T(-0.02, 0.06, zc) @ _R('Z', -4.0)):
        b.quad([(-cw / 2, -cl / 2, 0.0), (cw / 2, -cl / 2, 0.0), (cw / 2, cl / 2, 0.0), (-cw / 2, cl / 2, 0.0)], PA)
    x0, y0, y1 = 0.012 - cw / 2, -hy + 0.10, -hy + 0.10 + 0.82 * cl
    b.quad([(x0, y0, zc + 0.001), (x0 + cw, y0, zc + 0.001), (x0 + cw, y1, zc + 0.001), (x0, y1, zc + 0.001)], PA)
    with b.at(_T(0.0, y1 + 0.004, zc + 0.024)):
        b.lathe([(0.016, x0 + 0.02), (0.016, x0), (0.024, x0), (0.024, x0 + cw), (0.016, x0 + cw),
                 (0.016, x0 + cw - 0.02)], 8, PA, axis='X', cap0=True, cap1=True, crease=30.0)
    # parallel rules, dividers, pencil
    zt = zc + 0.0015
    with b.at(_T(0.02, -0.12, zt) @ _R('Z', 62.0)):
        b.box((-0.19, -0.046, 0.0), (0.19, -0.014, 0.006), 'int_mahogany', skip='-z')
        b.box((-0.16, 0.014, 0.0), (0.22, 0.046, 0.006), 'int_mahogany', skip='-z')
        for xl in (-0.11, 0.09):
            b.bar((xl, -0.03, 0.0075), (xl + 0.03, 0.03, 0.0075), 0.009, 0.003, BR)
    with b.at(_T(0.16, 0.22, zt) @ _R('Z', 200.0)):
        for s in (1.0, -1.0):
            b.tube([(0.0, 0.0, 0.005), (0.075, s * 0.011, 0.004)], [0.0045, 0.0035], 3, BR)
            b.tube([(0.075, s * 0.011, 0.004), (0.15, s * 0.022, 0.0015)], [0.0035, 0.0008], 3, 'int_steel')
        b.lathe([(0.008, 0.0), (0.008, 0.009), (0.0, 0.011)], 6, BR, crease=30.0)
        b.rod((-0.022, 0.0, 0.005), (0.0, 0.0, 0.005), 0.004, 3, BR, cap0=True)
    with b.at(_T(-0.16, 0.30, zt + 0.0035) @ _R('Z', 28.0)):
        b.lathe([(0.0035, -0.08), (0.0035, 0.07), (0.0012, 0.082), (0.0, 0.086)], 5,
                ['int_bunting_yellow', 'int_pine', 'int_iron'], axis='X', cap0='int_pine', crease=30.0)
    return b.finish(name)


def chronometer_box(name='chronometer_box'):
    """Two-day marine chronometer in its brass-bound mahogany box, 0.19 m cube, lid standing
    open: brass corner straps, drop handles and escutcheon, the brass bowl slung in a gimbal
    ring, pale dial with hands, the maker's rating paper inside the lid.
    Origin: centre of the base.  The lid is hinged along the -X edge; the dial reads from +X."""
    b = _Builder()
    MH, BR, IR = 'int_mahogany', 'int_brass', 'int_iron'
    h, hb, hl, wt = 0.095, 0.132, 0.058, 0.012
    hi = h - wt
    b.box((-h, -h, 0.0), (h, h, hb), MH, skip='+z')
    b.recess([(-h, -h, hb), (h, -h, hb), (h, h, hb), (-h, h, hb)],
             [(-hi, -hi, hb), (hi, -hi, hb), (hi, hi, hb), (-hi, hi, hb)], (0.0, 0.0, -(hb - 0.02)), MH)

    def straps(x0, x1, z0, z1):
        for cx, sx in ((x0, -1.0), (x1, 1.0)):
            for sy in (1.0, -1.0):
                xa, xb2 = sorted((cx - sx * 0.017, cx + sx * 0.0012))
                ya, yb2 = sorted((sy * (h - 0.017), sy * (h + 0.0012)))
                b.box((xa, ya, z0), (xb2, yb2, z1), BR,
                      skip='+z -z ' + ('-x ' if sx > 0 else '+x ') + ('-y' if sy > 0 else '+y'))

    straps(-h, h, 0.0, hb)
    b.flat(h + 0.0008, [(-0.009, hb - 0.05), (0.009, hb - 0.05), (0.009, hb - 0.02), (-0.009, hb - 0.02)], BR)
    b.disc(h + 0.0008, (0.0, 0.045), 0.011, 8, 'int_dial')
    for s in (1.0, -1.0):
        b.tube([(-0.032, s * h, 0.085), (-0.03, s * (h + 0.012), 0.066), (0.03, s * (h + 0.012), 0.066),
                (0.032, s * h, 0.085)], 0.0035, 3, BR)
    with b.at(_T(-h, 0.0, hb) @ _R('Y', -100.0)):   # lid: closed it would lie along +X
        w2 = 2.0 * h
        b.box((0.0, -h, 0.0), (w2, h, hl), MH, skip='-z')
        b.recess([(0.0, -h, 0.0), (0.0, h, 0.0), (w2, h, 0.0), (w2, -h, 0.0)],
                 [(wt, -hi, 0.0), (wt, hi, 0.0), (w2 - wt, hi, 0.0), (w2 - wt, -hi, 0.0)],
                 (0.0, 0.0, hl - 0.014), MH)
        b.quad([(0.04, -0.055, hl - 0.0146), (0.04, 0.055, hl - 0.0146), (0.15, 0.055, hl - 0.0146),
                (0.15, -0.055, hl - 0.0146)], 'int_paper')
        with b.at(_T(h, 0.0, 0.0)):
            straps(-h, h, 0.0, hl)
    zg = hb - 0.022                                  # gimbal axis
    with b.at(_T(0.0, 0.0, zg)):
        b.lathe([(0.066, -0.004), (0.075, 0.0), (0.066, 0.004)], 12, BR, loop=True, crease=30.0)
        b.lathe([(0.0, -0.06), (0.036, -0.052), (0.057, -0.022), (0.059, 0.006), (0.063, 0.006), (0.063, 0.014),
                 (0.053, 0.016), (0.052, 0.011)], 12, BR, cap1='int_dial', crease=30.0)
        for s in (1.0, -1.0):
            b.rod((0.0, s * 0.072, 0.0), (0.0, s * hi, 0.0), 0.004, 3, BR)
            b.rod((s * 0.058, 0.0, 0.0), (s * 0.068, 0.0, 0.0), 0.004, 3, BR)
    with b.at(_T(0.0, 0.0, zg + 0.011) @ _R('Y', -90.0)):       # dial plane, twelve toward the hinge
        for i in range(12):
            a = TAU * i / 12
            b.stroke(0.0005, (0.038 * math.cos(a), 0.038 * math.sin(a)), (0.047 * math.cos(a), 0.047 * math.sin(a)),
                     0.0028, IR, ext=0.0)
        b.hand(0.0016, (0.0, 0.0), 215.0, 0.024, 0.003, IR)
        b.hand(0.0024, (0.0, 0.0), 40.0, 0.04, 0.002, IR)
        b.disc(0.0005, (0.0, -0.022), 0.009, 6, 'int_enamel')
        b.hand(0.0012, (0.0, -0.022), 130.0, 0.008, 0.001, IR, tail=0.0)
    return b.finish(name)


def signal_flag_locker(name='signal_flag_locker', cols=7, rows=4):
    """Pigeon-hole locker for the signal flags (International Code of 1857 / 1901), 1.0 wide,
    0.6 high, 0.25 deep, of ``cols`` by ``rows`` holes, a rolled bunting flag in each showing
    its end in red, blue, yellow or white.
    Origin: centre of the back face.  Back at X = 0."""
    b = _Builder()
    TK = 'int_teak'
    W, H, D, t = 1.0, 0.6, 0.25, 0.015
    cols, rows = max(1, int(cols)), max(1, int(rows))
    hw, hh = W / 2.0, H / 2.0
    b.box((0.0, -hw, -hh), (D, hw, hh), TK, skip='+x -x')
    b.recess([(D, -hw, -hh), (D, hw, -hh), (D, hw, hh), (D, -hw, hh)],
             [(D, -hw + t, -hh + t), (D, hw - t, -hh + t), (D, hw - t, hh - t), (D, -hw + t, hh - t)],
             (-(D - t), 0.0, 0.0), TK)
    cw = (W - 2 * t - (cols - 1) * t) / cols
    ch = (H - 2 * t - (rows - 1) * t) / rows
    for i in range(1, cols):
        y0 = -hw + t + i * cw + (i - 1) * t
        b.box((t, y0, -hh + t), (D - 0.003, y0 + t, hh - t), TK, skip='-x -z +z')
    for j in range(1, rows):
        z0 = -hh + t + j * ch + (j - 1) * t
        b.box((t, -hw + t, z0), (D, hw - t, z0 + t), TK, skip='-x -y +y')
    rng = random.Random(1896)
    cols4 = ['int_bunting_red', 'int_bunting_blue', 'int_bunting_yellow', 'int_linen']
    for j in range(rows):
        for i in range(cols):
            yc = -hw + t + i * (cw + t) + cw / 2.0
            zb = -hh + t + j * (ch + t)
            rr = 0.43 * min(cw, ch) * rng.uniform(0.84, 1.0)
            xe = D - 0.012 - 0.035 * rng.random()
            body, end = rng.sample(cols4, 2)
            with b.at(_T(0.0, yc + (cw / 2.0 - rr) * rng.uniform(-0.6, 0.6), zb + rr)):
                b.lathe([(rr, 0.08), (rr, xe)], 6, body, axis='X', cap1=end, phase=30.0 * rng.random())
    return b.finish(name)


def book_shelf(name='book_shelf', length=0.9):
    """Fiddled bulkhead book shelf: teak back, ends and top, a brass rail across the front
    holding a row of books of varied height (Admiralty pilots, the List of Lights, an almanac),
    the last one leaning; a rolled chart tied with red tape lying on top.
    Origin: centre of the back face (0.34 high).  Back at X = 0, projects 0.19."""
    b = _Builder()
    TK, BR = 'int_teak', 'int_brass'
    L = float(length)
    hy, zb, zt, e = L / 2.0, -0.17, 0.17, 0.018
    b.box((0.0, -hy, zb), (0.015, hy, zt), TK, skip='-x')
    b.box((0.015, -hy + e, zb), (0.19, hy - e, zb + 0.02), TK, skip='-x -y +y')
    b.box((0.015, -hy + e, zt - 0.02), (0.155, hy - e, zt), TK, skip='-x -y +y')
    b.box((0.143, -hy + e, zt), (0.155, hy - e, zt + 0.014), TK, skip='-z -y +y')
    cheek = [(0.015, zb), (0.19, zb), (0.19, zb + 0.11), (0.155, zb + 0.17), (0.155, zt + 0.014), (0.015, zt + 0.014)]
    for s in (1.0, -1.0):
        y0, y1 = sorted((s * hy, s * (hy - e)))
        b.prism(cheek, y0, y1, TK, plane='XZ', crease=20.0)
    zs = zb + 0.02
    b.rod((0.178, -hy + e, zs + 0.085), (0.178, hy - e, zs + 0.085), 0.005, 5, BR)
    b.rod((0.178, 0.0, zs), (0.178, 0.0, zs + 0.085), 0.004, 3, BR)
    rng = random.Random(11)
    covers = ['int_book', 'int_wool', 'int_book', 'int_leather', 'int_bunting_blue', 'int_mahogany', 'int_paper']
    y, yend = -hy + e + 0.004, hy - e - 0.11
    hprev = 0.2
    while True:
        t = rng.uniform(0.024, 0.056)
        if y + t > yend:
            break
        hgt, dep, mat = rng.uniform(0.17, 0.262), rng.uniform(0.115, 0.158), rng.choice(covers)
        b.box((0.016, y, zs), (0.016 + dep, y + t, zs + hgt), mat, skip='-x -z', fm={'+z': 'int_paper'})
        if mat != 'int_paper':
            z0 = zs + hgt * rng.uniform(0.62, 0.74)
            lab = 'int_paper' if rng.random() < 0.4 else BR
            b.flat(0.016 + dep + 0.0006, [(y + 0.004, z0), (y + t - 0.004, z0), (y + t - 0.004, z0 + 0.03),
                                          (y + 0.004, z0 + 0.03)], lab)
        y += t + 0.0012
        hprev = hgt
    lean, t, hgt = 13.0, 0.034, 0.235
    yp = y + min(hprev, hgt * math.cos(math.radians(lean))) * math.tan(math.radians(lean)) + 0.002
    with b.at(_T(0.0, yp, zs) @ _R('X', lean)):
        b.box((0.016, 0.0, 0.0), (0.156, t, hgt), 'int_wool', skip='-x', fm={'+z': 'int_paper'})
        b.flat(0.1566, [(0.004, 0.16), (t - 0.004, 0.16), (t - 0.004, 0.19), (0.004, 0.19)], BR)
    ya, yb2 = -0.42 * L, 0.36 * L
    with b.at(_T(0.078, 0.0, zt + 0.031)):
        b.lathe([(0.02, ya + 0.03), (0.02, ya), (0.031, ya), (0.031, yb2 - 0.20), (0.031, yb2 - 0.18), (0.031, yb2),
                 (0.02, yb2), (0.02, yb2 - 0.03)], 8,
                ['int_paper'] * 3 + ['int_bunting_red'] + ['int_paper'] * 3, axis='Y', cap0=True, cap1=True,
                crease=30.0)
    return b.finish(name)


def long_glass_rack(name='long_glass_rack'):
    """The ship's long glass in its rack: a single-draw officer's telescope 0.80 m closed
    (brass eyepiece and draw collar, tapered leather-covered barrel, brass sliding ray shade,
    objective glass) lying in two notched mahogany cradles on a bulkhead rail; below it a
    shelf with a pair of Galilean binoculars standing in their open leather case.

    Origin: centre of the back face of the top rail (rail 0.92 x 0.10).  Back at X = 0; the
    telescope axis is X = 0.075, Z = 0.012, eyepiece toward -Y; the shelf hangs to Z = -0.40."""
    b = _Builder()
    MH, BR, LE, IR = 'int_mahogany', 'int_brass', 'int_leather', 'int_iron'
    b.box((0.0, -0.46, -0.05), (0.018, 0.46, 0.05), MH, skip='-x')
    xa, za = 0.075, 0.012

    def rad(y):                                      # barrel radius along the taper
        return 0.0235 + (0.0295 - 0.0235) * (y + 0.305) / 0.52

    for yc in (-0.25, 0.20):
        rn = rad(yc) + 0.0015
        notch = [(xa + rn * math.cos(math.radians(a)), za + rn * math.sin(math.radians(a)))
                 for a in (0, -45, -90, -135, -180)]
        outline = [(0.018, -0.05), (0.095, -0.05), (0.118, -0.028), (0.118, za)] + notch + [(xa - rn, za + 0.016),
                                                                                             (0.018, za + 0.038)]
        b.prism(outline, yc - 0.011, yc + 0.011, MH, plane='XZ', crease=50.0)
    with b.at(_T(xa, 0.0, za)):
        prof = [(0.010, -0.400), (0.0195, -0.400), (0.0195, -0.372), (0.016, -0.368), (0.016, -0.335),
                (0.0245, -0.335), (0.0245, -0.305), (0.0235, -0.305), (0.0295, 0.215), (0.031, 0.215),
                (0.031, 0.245), (0.0335, 0.245), (0.0335, 0.400), (0.0295, 0.400), (0.0295, 0.386)]
        b.lathe(prof, 12, [BR] * 6 + [LE, LE, BR, BR, BR, BR, BR, BR], axis='Y', cap0=IR, cap1='int_glass',
                crease=30.0)
    # binocular shelf
    b.box((0.0, -0.14, -0.40), (0.018, 0.14, -0.05), MH, skip='-x +z')
    b.box((0.018, -0.14, -0.40), (0.15, 0.14, -0.384), MH, skip='-x')
    b.box((0.138, -0.14, -0.384), (0.15, 0.14, -0.362), MH, skip='-z')
    cx0, cx1, cy, z0, z1 = 0.05, 0.128, 0.098, -0.384, -0.262
    b.box((cx0, -cy, z0), (cx1, cy, z1), LE, skip='-z +z')
    wl = 0.006
    b.recess([(cx0, -cy, z1), (cx1, -cy, z1), (cx1, cy, z1), (cx0, cy, z1)],
             [(cx0 + wl, -cy + wl, z1), (cx1 - wl, -cy + wl, z1), (cx1 - wl, cy - wl, z1), (cx0 + wl, cy - wl, z1)],
             (0.0, 0.0, -0.035), LE, floor=IR)
    with b.at(_T(cx0, 0.0, z1) @ _R('Y', -97.0)):   # the lid thrown back against the board
        b.box((0.0, -cy - 0.004, 0.0), (cx1 - cx0 + 0.004, cy + 0.004, 0.022), LE)
    b.flat(cx1 + 0.0008, [(-0.012, z1 - 0.05), (0.012, z1 - 0.05), (0.012, z1 - 0.012), (-0.012, z1 - 0.012)], BR)
    xb = 0.5 * (cx0 + cx1)
    zq = z1 - 0.03
    for s in (1.0, -1.0):
        with b.at(_T(xb, s * 0.046, zq)):
            b.lathe([(0.028, 0.0), (0.025, 0.062), (0.0185, 0.07), (0.0185, 0.09), (0.0215, 0.093), (0.0215, 0.106),
                     (0.011, 0.106)], 8, [IR, BR, BR, IR, IR, IR], cap1='int_glass', crease=30.0)
    b.box((xb - 0.007, -0.03, zq + 0.045), (xb + 0.007, 0.03, zq + 0.062), IR)
    with b.at(_T(xb, 0.0, 0.0)):
        b.lathe([(0.011, zq + 0.062), (0.011, zq + 0.082)], 6, BR, cap1=True)
    return b.finish(name)


def settee_locker(name='settee_locker', length=1.8, depth=0.55):
    """Plain teak locker seat: framed front on a plinth, a deep-buttoned leather cushion and a
    low buttoned leather back under a teak capping.
    Origin: on the floor at the centre of the footprint.  Back at -X; seat 0.49 high, top of
    the capping 0.885."""
    b = _Builder()
    TK, LE = 'int_teak', 'int_leather'
    L, D = float(length), float(depth)
    hx, hy = D / 2.0, L / 2.0
    zl = 0.40                                        # locker top
    b.box((-hx, -hy, 0.06), (hx, hy, zl), TK, skip='-z')
    b.box((-hx, -hy + 0.03, 0.0), (hx - 0.05, hy - 0.03, 0.06), TK, skip='-z +z')
    xf = hx
    b.box((xf, -hy, zl - 0.06), (xf + 0.009, hy, zl), TK, skip='-x')
    b.box((xf, -hy, 0.06), (xf + 0.009, hy, 0.12), TK, skip='-x')
    npan = max(1, round(L / 0.6))
    for i in range(npan + 1):
        yc = -hy + 0.035 + (L - 0.07) * i / npan
        b.box((xf, yc - 0.035, 0.12), (xf + 0.009, yc + 0.035, zl - 0.06), TK, skip='-x -z +z')
    # back board with capping, the two pads
    b.box((-hx, -hy, zl), (-hx + 0.025, hy, 0.86), TK, skip='-z +z')
    b.box((-hx, -hy, 0.86), (-hx + 0.055, hy, 0.885), TK)
    ny = max(2, round(L / 0.128))
    x0 = -hx + 0.025
    _tufted(b, (x0, -hy + 0.008, zl), (1, 0, 0), (0, 1, 0), (0, 0, 1), 4, ny, D - 0.025 - 0.004, L - 0.016,
            0.075, 0.022, 0.012, LE)
    _tufted(b, (x0, -hy + 0.015, zl + 0.085), (0, 1, 0), (0, 0, 1), (1, 0, 0), ny, 3, L - 0.03, 0.36,
            0.042, 0.02, 0.01, LE)
    return b.finish(name)


def _lamp(b, x, z, n=12):
    """Brass lampholder with shade gallery, conical opal shade and pear-shaped carbon-filament
    bulb (tip down) hanging below the point (x, 0, z); the bulb tip is 0.15 below it."""
    with b.at(_T(x, 0.0, z)):
        b.lathe([(0.015, -0.064), (0.018, -0.060), (0.018, -0.038), (0.027, -0.036), (0.027, -0.029), (0.012, -0.022),
                 (0.012, 0.0)], 8, 'int_brass', crease=30.0)
        b.lathe([(0.108, -0.108), (0.074, -0.062), (0.024, -0.034), (0.021, -0.037), (0.071, -0.066),
                 (0.104, -0.111)], n, 'int_opal', loop=True, crease=50.0)
        b.lathe([(0.0, -0.150), (0.006, -0.144), (0.024, -0.128), (0.030, -0.108), (0.026, -0.086), (0.014, -0.067),
                 (0.013, -0.060)], 8, 'int_lamp_glow', crease=60.0)


def electric_light(name='electric_light', kind='deckhead'):
    """Incandescent electric light fitting of 1896 (she had 79 lamps): brass lampholder, opal
    glass shade and a pear-shaped bulb, hung either from a brass ceiling rose on a short stem
    (``kind='deckhead'``) or from a swan-neck arm on a round wall plate (``'bracket'``).

    Origin: 'deckhead' the centre of the rose on the deckhead, the fitting hangs 0.225 toward
    -Z; 'bracket' the centre of the back of the wall plate (X = 0), the lamp hangs at X = 0.21,
    the arm rising to Z = +0.17 and the bulb tip at Z = -0.045."""
    b = _Builder()
    BR = 'int_brass'
    if kind == 'deckhead':
        b.lathe([(0.009, -0.045), (0.021, -0.040), (0.050, -0.014), (0.056, -0.008), (0.056, 0.0)], 10, BR,
                crease=30.0)
        b.rod((0.0, 0.0, -0.075), (0.0, 0.0, -0.043), 0.006, 5, BR)
        _lamp(b, 0.0, -0.075)
    elif kind == 'bracket':
        b.lathe([(0.046, 0.0), (0.046, 0.006), (0.032, 0.013), (0.013, 0.02)], 10, BR, axis='X', crease=30.0)
        path = [(0.018, 0.0, 0.0), (0.055, 0.0, 0.008), (0.09, 0.0, 0.045), (0.11, 0.0, 0.10), (0.135, 0.0, 0.145),
                (0.172, 0.0, 0.162), (0.20, 0.0, 0.145), (0.21, 0.0, 0.103)]
        b.tube(path, 0.007, 5, BR, up=(0, 1, 0))
        _lamp(b, 0.21, 0.105)
    else:
        raise ValueError("electric_light kind must be 'deckhead' or 'bracket'")
    return b.finish(name)


def coat_hooks(name='coat_hooks', n=4, width=0.9):
    """Teak rail of ``n`` brass hat-and-coat hooks with a long oilskin coat hanging from one
    and a sou'wester over another; the rest empty.
    Origin: centre of the back face of the rail (rail ``width`` x 0.09).  Back at X = 0; the
    coat hangs to Z = -1.15 and stands 0.17 off the bulkhead."""
    b = _Builder()
    BR, OS = 'int_brass', 'int_oilskin'
    n = max(1, int(n))
    W = float(width)
    b.box((0.0, -W / 2.0, -0.045), (0.02, W / 2.0, 0.045), 'int_teak', skip='-x')
    ys = [-W / 2.0 + W * (i + 0.5) / n for i in range(n)]
    coat = 1 if n >= 4 else 0
    hat = None if n < 2 else (min(3, n - 1) if n >= 4 else n - 1)
    for i, y in enumerate(ys):
        b.box((0.02, y - 0.013, -0.032), (0.025, y + 0.013, 0.034), BR, skip='-x')
        if i == hat:
            continue                                 # hidden inside the hat
        b.tube([(0.025, y, -0.016), (0.055, y, -0.032), (0.08, y, -0.022), (0.088, y, 0.008)], 0.006, 4, BR,
               up=(0, 1, 0))
        b.sphere((0.089, y, 0.014), 0.009, BR, n=4, stacks=2)
        b.tube([(0.025, y, 0.018), (0.048, y, 0.03), (0.062, y, 0.055)], [0.0055, 0.005, 0.0045], 4, BR,
               cap1=True, up=(0, 1, 0))
    # the oilskin
    yc = ys[coat]
    N = 12
    levels = [(-0.012, 0.045, 0.045, 0.0), (-0.07, 0.10, 0.075, 0.0), (-0.15, 0.225, 0.10, 0.002),
              (-0.36, 0.24, 0.115, 0.006), (-0.75, 0.255, 0.125, 0.014), (-1.15, 0.285, 0.135, 0.024)]
    rings = []
    for z, hw, th, fold in levels:
        ring = []
        for kk in range(N):
            a = TAU * kk / N
            c, s = math.cos(a), math.sin(a)
            yy = hw * math.copysign(abs(c) ** 0.6, c)
            xx = 0.022 + th * (0.5 + 0.5 * math.copysign(abs(s) ** 0.75, s))
            if s > 0.0:
                xx += fold * math.cos(5.0 * a + 0.6)
            yy += fold * 0.8 * math.sin(3.0 * a + z * 4.0)
            ring.append((xx, yc + yy, z))
        rings.append(ring)
    b.loft(rings, OS, closed=True, cap0=True, cap1=True, orient='auto')
    for s in (1.0, -1.0):
        b.tube([(0.07, yc + s * 0.20, -0.16), (0.085, yc + s * 0.245, -0.44), (0.078, yc + s * 0.235, -0.73)],
               [0.062, 0.057, 0.05], 6, OS, cap1=True, up=(1, 0, 0))
    b.tube([(0.03, yc, -0.01), (0.06, yc, -0.034), (0.085, yc, -0.01)], 0.004, 3, OS, up=(0, 1, 0))
    # the sou'wester, crown outward, long back brim hanging down
    if hat is not None:
        with b.at(_T(0.038, ys[hat], -0.015) @ _R('Y', 84.0) @ _T(0.03, 0.0, 0.0) @ Matrix.Diagonal((1.22, 1.0, 1.0, 1.0))):
            b.lathe([(0.15, 0.0), (0.086, 0.032), (0.08, 0.075), (0.055, 0.108), (0.0, 0.122)], 10, OS, cap0=True,
                    crease=50.0)
    return b.finish(name)


def rudder_indicator(name='rudder_indicator', angle=0.0):
    """Rudder tell-tale: small brass bulkhead dial, 0.18 m across, a blued pointer swinging
    over a graduated arc lettered PORT and STARBD.  ``angle`` in degrees sets the pointer
    (positive to starboard; the arc is marked to 40 each way).
    Origin: centre of the back face (the case axis).  Back at X = 0, depth 0.065; seen from
    +X PORT is on the left (-Y)."""
    b = _Builder()
    IR = 'int_iron'
    xd, rd = _dial_case(b, 0.09, depth=0.052)
    pv = (0.0, -0.026)
    for i in range(17):
        a = math.radians(50.0 + 5.0 * i)
        r0 = 0.073 if i % 2 == 0 else 0.078
        b.stroke(xd + 0.0006, (pv[0] + r0 * math.cos(a), pv[1] + r0 * math.sin(a)),
                 (pv[0] + 0.084 * math.cos(a), pv[1] + 0.084 * math.sin(a)), 0.0018, IR, ext=0.0)
    b.arc_text(xd + 0.0006, 'PORT', pv, 0.056, 121.0, 0.011, 0.0019, IR)
    b.arc_text(xd + 0.0006, 'STARBD', pv, 0.056, 55.0, 0.011, 0.0019, IR)
    b.hand(xd + 0.002, pv, 90.0 - max(-45.0, min(45.0, float(angle))), 0.07, 0.004, IR, tail=0.15)
    b.disc(xd + 0.003, pv, 0.007, 6, 'int_brass')
    return b.finish(name)


# =========================================================================================
#  Galley
# =========================================================================================

def galley_range(name='galley_range', width=1.4, flue=1.2):
    """Cast-iron ship's coal range, 0.75 deep and 0.85 high: barred fire in the middle with the
    fire glowing behind it, ash door and ash pan below, an oven each side with steel handles
    and brass strap hinges, hotplate with ring covers, polished steel sea rails (fiddles) on
    stanchions with two movable cross bars, towel rail with a cloth along the front, short
    feet, and a flue pipe with joint band and damper rising from the back.

    Origin: on the floor at the centre of the footprint.  Back at -X.  The flue is on the
    centreline (Y = 0) at X = -0.245, 0.15 in diameter, and rises ``flue`` above the hotplate."""
    b = _Builder()
    IR, ST, BR = 'int_iron', 'int_steel', 'int_brass'
    W, D, H = float(width), 0.75, 0.85
    hx, hy = D / 2.0, W / 2.0
    zb, zt = 0.10, H - 0.03
    xf, yb = hx - 0.03, hy - 0.025
    for sx in (1.0, -1.0):
        for sy in (1.0, -1.0):
            c = (sx * (hx - 0.10), sy * (hy - 0.10))
            b.frustum((c[0], c[1], 0.0), (0.035, 0.035), (c[0], c[1], zb), (0.055, 0.055), IR, skip='-z +z')
    b.box((-hx, -yb, zb), (xf, yb, zt), IR, skip='+x +z')
    b.box((-hx, -hy, zt), (hx, hy, H), IR)
    # front: fire opening in the middle
    fy, f0, f1 = 0.15, 0.44, 0.66
    b.recess([(xf, -yb, zb), (xf, yb, zb), (xf, yb, zt), (xf, -yb, zt)],
             [(xf, -fy, f0), (xf, fy, f0), (xf, fy, f1), (xf, -fy, f1)], (-0.15, 0.0, 0.0), IR,
             floor='int_lamp_glow')
    g = b.group()
    ys = [-fy, -0.05, 0.05, fy]
    zc = [0.07, 0.10, 0.085, 0.075]
    for i in range(3):                               # the bed of coal
        b.quad([(xf - 0.012, ys[i], f0 + 0.02), (xf - 0.012, ys[i + 1], f0 + 0.02),
                (xf - 0.15, ys[i + 1], f0 + zc[i + 1] + 0.05), (xf - 0.15, ys[i], f0 + zc[i] + 0.05)], 'int_coal', g)
    for s in (1.0, -1.0):
        y0, y1 = sorted((s * fy, s * (fy + 0.035)))
        b.box((xf, y0, f0 - 0.03), (xf + 0.016, y1, f1 + 0.03), IR, skip='-x')
    for i in range(5):
        z = f0 + 0.022 + 0.044 * i
        b.rod((xf + 0.006, -fy - 0.004, z), (xf + 0.006, fy + 0.004, z), 0.009, 4, IR)
    b.box((xf, -fy - 0.035, f1 + 0.03), (xf + 0.012, fy + 0.035, zt - 0.015), IR, skip='-x')
    b.box((xf + 0.012, -0.07, f1 + 0.05), (xf + 0.016, 0.07, f1 + 0.092), BR, skip='-x')     # maker's plate
    b.box((xf, -fy - 0.035, 0.15), (xf + 0.012, fy + 0.035, f0 - 0.03), IR, skip='-x')        # ash door
    b.box((xf + 0.012, -0.12, 0.17), (xf + 0.03, 0.12, 0.28), IR, skip='-x')                  # ash pan
    b.tube([(xf + 0.03, -0.055, 0.225), (xf + 0.058, -0.05, 0.225), (xf + 0.058, 0.05, 0.225),
            (xf + 0.03, 0.055, 0.225)], 0.006, 4, ST, up=(0, 0, 1))
    b.box((xf + 0.012, -0.05, 0.325), (xf + 0.017, 0.05, 0.36), ST, skip='-x')                # draught slide
    # ovens
    for s in (1.0, -1.0):
        ya, yo = s * 0.215, s * (yb - 0.035)
        y0, y1 = sorted((ya, yo))
        b.box((xf, y0, 0.19), (xf + 0.014, y1, 0.70), IR, skip='-x')
        b.box((xf + 0.014, y0 + 0.05, 0.24), (xf + 0.021, y1 - 0.05, 0.65), IR, skip='-x')
        yh = ya + s * 0.028
        b.tube([(xf + 0.014, yh, 0.37), (xf + 0.05, yh, 0.385), (xf + 0.05, yh, 0.505), (xf + 0.014, yh, 0.52)],
               0.008, 4, ST, up=(0, 1, 0))
        for zh in (0.27, 0.60):
            h0, h1 = sorted((yo + s * 0.016, yo - s * 0.10))
            b.box((xf + 0.014, h0, zh), (xf + 0.02, h1, zh + 0.026), BR, skip='-x')
    # hotplate rings
    yov = 0.5 * (0.215 + yb - 0.035)
    with b.at(_T(0.075, 0.0, 0.0)):
        b.lathe([(0.125, H), (0.121, H + 0.004), (0.07, H + 0.004), (0.067, H + 0.007)], 12, IR, cap1=True,
                crease=20.0)
    for x, y, r in ((0.105, yov, 0.10), (0.105, -yov, 0.10), (-0.15, yov, 0.085), (-0.15, -yov, 0.085)):
        with b.at(_T(x, y, 0.0)):
            b.lathe([(r, H), (r - 0.004, H + 0.004)], 10, IR, cap1=True, crease=20.0)
            b.box((0.4 * r, -0.006, H + 0.004), (0.4 * r + 0.03, 0.006, H + 0.0055), 'int_coal', skip='-z')
    # sea rails with two movable cross bars
    zr = H + 0.115
    rx, ry = hx - 0.022, hy - 0.022
    b.ring_loop([(-rx, -ry, zr), (rx, -ry, zr), (rx, ry, zr), (-rx, ry, zr)], 0.0075, 4, ST, (0.0, 0.0, 1.0))
    posts = [(sx * rx, sy * ry) for sx in (1, -1) for sy in (1, -1)] + [(rx, 0.0), (-rx, 0.3 * W), (-rx, -0.3 * W)]
    for x, y in posts:
        b.rod((x, y, H), (x, y, zr), 0.007, 4, ST)
    for y in (-0.205, 0.205):
        b.bar((-rx - 0.016, y, zr + 0.011), (rx + 0.016, y, zr + 0.011), 0.024, 0.007, ST)
        for x in (-rx - 0.012, rx + 0.012):
            b.box((x - 0.004, y - 0.012, zr - 0.012), (x + 0.004, y + 0.012, zr + 0.0075), ST, skip='+z')
    # towel rail and cloth
    xt, ztw = hx + 0.05, H - 0.085
    b.rod((xt, -0.33 * W, ztw), (xt, 0.33 * W, ztw), 0.008, 6, ST, cap0=True, cap1=True)
    for y in (-0.30 * W, 0.30 * W):
        b.bar((hx - 0.005, y, H - 0.015), (xt, y, ztw), 0.014, 0.012, ST, up=(0, 1, 0), skip='-z')
    ty0, ty1 = 0.17, 0.39
    b.box((xt + 0.008, ty0, ztw - 0.27), (xt + 0.013, ty1, ztw + 0.006), 'int_linen')
    b.box((xt - 0.013, ty0, ztw - 0.17), (xt - 0.008, ty1, ztw + 0.006), 'int_linen')
    b.box((xt - 0.013, ty0, ztw + 0.006), (xt + 0.013, ty1, ztw + 0.011), 'int_linen', skip='-z')
    # flue
    xfl = -hx + 0.13
    zj = H + 0.48 * flue
    with b.at(_T(xfl, 0.0, 0.0)):
        b.lathe([(0.105, H), (0.105, H + 0.012), (0.082, H + 0.045), (0.075, H + 0.05), (0.075, zj), (0.08, zj),
                 (0.08, zj + 0.035), (0.075, zj + 0.035), (0.075, H + flue)], 10, IR, cap1=True, crease=30.0)
    zdm = H + min(0.30, 0.3 * flue)
    b.rod((xfl + 0.07, 0.0, zdm), (xfl + 0.115, 0.0, zdm), 0.005, 3, ST)
    b.bar((xfl + 0.115, 0.0, zdm - 0.035), (xfl + 0.115, 0.0, zdm + 0.035), 0.012, 0.006, ST, up=(1, 0, 0))
    return b.finish(name)


def kettle(name='kettle'):
    """Copper ship's kettle: broad flat base and conical body so it sits firm in a seaway,
    lid with a brass knob, swan-neck spout, fixed brass bail handle.  0.26 across the base,
    0.27 high.  Origin: base centre.  Seen from +X in profile: spout toward -Y."""
    b = _Builder()
    CU, BR = 'int_copper', 'int_brass'
    b.lathe([(0.122, 0.0), (0.130, 0.012), (0.074, 0.135), (0.070, 0.148), (0.066, 0.150), (0.030, 0.166),
             (0.011, 0.168), (0.016, 0.186), (0.0, 0.194)], 12, [CU] * 5 + [BR] * 3, cap0=True, crease=30.0)
    b.tube([(0.0, -0.10, 0.035), (0.0, -0.165, 0.068), (0.0, -0.195, 0.125), (0.0, -0.218, 0.152)],
           [0.025, 0.018, 0.013, 0.012], 6, CU, cap1=True, up=(1, 0, 0))
    b.tube([(0.0, 0.064, 0.138), (0.0, 0.088, 0.212), (0.0, 0.045, 0.264), (0.0, -0.045, 0.264),
            (0.0, -0.088, 0.212), (0.0, -0.064, 0.138)], [0.006, 0.006, 0.009, 0.009, 0.006, 0.006], 4, BR,
           up=(1, 0, 0))
    return b.finish(name)


def stock_pot(name='stock_pot', d=0.3):
    """Black iron stock pot with a fitted lid and knob and two loop handles; as high as it is
    wide.  Origin: base centre.  Handles toward +Y and -Y."""
    b = _Builder()
    IR = 'int_iron'
    k = d / 0.3
    prof = [(0.142, 0.0), (0.15, 0.012), (0.15, 0.25), (0.157, 0.25), (0.157, 0.262), (0.10, 0.278), (0.014, 0.284),
            (0.022, 0.304), (0.0, 0.311)]
    b.lathe([(r * k, z * k) for r, z in prof], 12, IR, cap0=True, crease=30.0)
    for s in (1.0, -1.0):
        b.tube([(-0.048 * k, s * 0.146 * k, 0.205 * k), (-0.04 * k, s * 0.192 * k, 0.195 * k),
                (0.04 * k, s * 0.192 * k, 0.195 * k), (0.048 * k, s * 0.146 * k, 0.205 * k)], 0.007 * k, 4, IR,
               up=(0, 0, 1))
    return b.finish(name)


def saucepan(name='saucepan', d=0.2):
    """Copper saucepan, tinned inside, with a long flat iron handle riveted on.
    Origin: base centre.  Handle toward +X."""
    b = _Builder()
    CU, TN, IR = 'int_copper', 'int_steel', 'int_iron'
    k = d / 0.2
    prof = [(0.088, 0.0), (0.10, 0.014), (0.10, 0.105), (0.105, 0.108), (0.097, 0.108), (0.097, 0.016), (0.0, 0.012)]
    b.lathe([(r * k, z * k) for r, z in prof], 12, [CU, CU, CU, CU, TN, TN], cap0=True, crease=30.0)
    b.box((0.096 * k, -0.02 * k, 0.062 * k), (0.106 * k, 0.02 * k, 0.10 * k), IR, skip='-x')
    b.bar((0.10 * k, 0.0, 0.088 * k), (0.33 * k, 0.0, 0.15 * k), 0.024 * k, 0.007 * k, IR, skip='-z')
    b.bar((0.33 * k, 0.0, 0.15 * k), (0.345 * k, 0.0, 0.145 * k), 0.024 * k, 0.007 * k, IR, skip='-z')
    return b.finish(name)


def frying_pan(name='frying_pan', d=0.27):
    """Black iron frying pan with sloping sides and a long flat handle.
    Origin: base centre.  Handle toward +X."""
    b = _Builder()
    IR = 'int_iron'
    k = d / 0.27
    prof = [(0.105, 0.0), (0.135, 0.04), (0.138, 0.043), (0.131, 0.043), (0.103, 0.006), (0.0, 0.005)]
    b.lathe([(r * k, z * k) for r, z in prof], 12, IR, cap0=True, crease=30.0)
    b.bar((0.128 * k, 0.0, 0.036 * k), (0.36 * k, 0.0, 0.082 * k), 0.028 * k, 0.006 * k, IR, skip='-z')
    b.bar((0.36 * k, 0.0, 0.082 * k), (0.385 * k, 0.0, 0.074 * k), 0.028 * k, 0.006 * k, IR, skip='-z')
    return b.finish(name)


def galley_dresser(name='galley_dresser', length=1.5):
    """Scrubbed pine galley dresser: work bench 0.6 deep and 0.9 high with two drawers over
    two cupboard doors, turned knobs, plinth; above it (a separate island of the same mesh,
    its back in the same plane) a plate rack with a fiddle bar holding a row of blue-rimmed
    enamel plates on edge and enamel mugs hanging from hooks beneath.

    Origin: on the floor at the centre of the bench footprint.  Back at -X (X = -0.30); the
    rack spans Z = 1.26 .. 1.62 and is 0.17 deep."""
    b = _Builder()
    PN, EN, BL = 'int_pine', 'int_enamel', 'int_bunting_blue'
    L = float(length)
    hx, hy = 0.30, L / 2.0
    b.box((-hx, -hy, 0.86), (hx, hy, 0.90), PN)
    xf = hx - 0.03
    b.box((-hx, -hy + 0.015, 0.08), (xf, hy - 0.015, 0.86), PN, skip='-z +z')
    b.box((-hx, -hy + 0.03, 0.0), (xf - 0.05, hy - 0.03, 0.08), PN, skip='-z +z')
    yd = hy - 0.045
    for s in (1.0, -1.0):
        y0, y1 = sorted((s * 0.008, s * yd))
        b.box((xf, y0, 0.70), (xf + 0.014, y1, 0.84), PN, skip='-x')
        b.box((xf, y0, 0.11), (xf + 0.014, y1, 0.68), PN, skip='-x')
        b.box((xf + 0.014, y0 + 0.06, 0.17), (xf + 0.019, y1 - 0.06, 0.62), PN, skip='-x')
        for yk, zk in ((0.5 * (y0 + y1), 0.77), (s * 0.045, 0.50)):
            with b.at(_T(0.0, yk, zk)):
                b.lathe([(0.009, xf + 0.014), (0.017, xf + 0.032), (0.013, xf + 0.042), (0.0, xf + 0.046)], 6,
                        'int_teak', axis='X', crease=30.0)
    # plate rack
    xr, dr = -hx, 0.17
    z0, z1 = 1.28, 1.62
    b.box((xr, -hy, z0 - 0.02), (xr + 0.012, hy, z1), PN, skip='-x')
    for s in (1.0, -1.0):
        y0, y1 = sorted((s * hy, s * (hy - 0.018)))
        b.box((xr + 0.012, y0, z0 - 0.02), (xr + dr, y1, z1), PN, skip='-x')
    b.box((xr + 0.012, -hy + 0.018, z0 - 0.02), (xr + dr, hy - 0.018, z0), PN, skip='-x -y +y')
    b.box((xr + 0.012, -hy + 0.018, z1 - 0.018), (xr + dr, hy - 0.018, z1), PN, skip='-x -y +y')
    b.box((xr + dr - 0.014, -hy + 0.018, z0 + 0.075), (xr + dr, hy - 0.018, z0 + 0.10), PN, skip='-y +y')
    span = L - 0.036
    npl = max(1, int(span / 0.262))
    rp = 0.12
    for i in range(npl):
        yc = -span / 2.0 + span * (i + 0.5) / npl
        with b.at(_T(xr + 0.078, yc, z0 + rp + 0.002) @ _R('Y', -18.0)):
            b.lathe([(rp, -0.006), (rp, 0.0), (0.66 * rp, -0.006)], 10, [BL, EN], axis='X', cap0=EN, cap1=EN,
                    crease=20.0)
    nm = max(1, int(span / 0.34))
    for i in range(nm):
        yc = -span / 2.0 + span * (i + 0.5) / nm
        b.tube([(xr + 0.10, yc, z0 - 0.02), (xr + 0.10, yc + 0.012, z0 - 0.034), (xr + 0.10, yc, z0 - 0.046)],
               0.0025, 3, 'int_brass', up=(1, 0, 0))
        with b.at(_T(xr + 0.10, yc, z0 - 0.043) @ _R('X', 28.0)):
            b.ring_loop([(0.0, 0.0, 0.0), (0.0, -0.02, -0.006), (0.0, -0.02, -0.052), (0.0, 0.0, -0.06)], 0.0045,
                        3, EN, (1.0, 0.0, 0.0), sg=None)
            with b.at(_T(0.0, 0.0, -0.03)):
                b.lathe([(0.0, 0.002), (0.039, 0.002), (0.041, 0.085), (0.036, 0.085), (0.0, 0.012)], 8,
                        [EN, EN, BL, EN], axis='Y', crease=30.0)
    return b.finish(name)


def galley_sink(name='galley_sink', length=1.0):
    """Teak sink bench with a lead-lined sink, splash board and shelf, and the two hand pumps
    of the builder's plumbing plan at the back: a brass lever pump for fresh water (toward -Y)
    and an iron lift-and-force pump for salt water with a copper air vessel, brass cock and a
    longer handle (toward +Y).  Lead suction and waste pipes below, a wooden bucket under.

    Origin: on the floor at the centre of the bench footprint (0.55 deep, 0.85 high).  Back at
    -X; the splash board rises to 1.32 and the salt-water pump handle to about 1.38."""
    b = _Builder()
    TK, BR, IR, LD, CU = 'int_teak', 'int_brass', 'int_iron', 'int_lead', 'int_copper'
    L = float(length)
    hx, hy, zt = 0.275, L / 2.0, 0.85
    b.box((-hx, -hy, zt - 0.04), (hx, hy, zt), TK, skip='+z')
    sy = hy - 0.17
    x0, x1, m = -0.12, 0.205, 0.016
    O, I = b.frame4([(-hx, -hy, zt), (hx, -hy, zt), (hx, hy, zt), (-hx, hy, zt)],
                    [(x0 - m, -sy - m, zt), (x1 + m, -sy - m, zt), (x1 + m, sy + m, zt), (x0 - m, sy + m, zt)], TK)
    zl = zt + 0.002
    O2, I2 = b.frame4([(x0 - m, -sy - m, zl), (x1 + m, -sy - m, zl), (x1 + m, sy + m, zl), (x0 - m, sy + m, zl)],
                      [(x0, -sy, zl), (x1, -sy, zl), (x1, sy, zl), (x0, sy, zl)], LD)
    b.well(I2, (0.0, 0.0, -0.17), LD)
    with b.at(_T(0.04, 0.0, zl - 0.17)):
        b.lathe([(0.022, 0.0), (0.019, 0.005)], 6, BR, cap1=True, crease=20.0)
    b.box((-hx + 0.02, -hy + 0.02, 0.66), (hx - 0.02, hy - 0.02, zt - 0.04), TK, skip='+z')
    for sx in (1.0, -1.0):
        for s in (1.0, -1.0):
            xa, xb2 = sorted((sx * (hx - 0.005), sx * (hx - 0.065)))
            ya, yb2 = sorted((s * (hy - 0.005), s * (hy - 0.065)))
            b.box((xa, ya, 0.0), (xb2, yb2, 0.66), TK, skip='-z +z')
    for s in (1.0, -1.0):
        b.bar((-hx + 0.065, s * (hy - 0.035), 0.16), (hx - 0.065, s * (hy - 0.035), 0.16), 0.03, 0.045, TK,
              skip='-z +z')
    b.bar((-hx + 0.035, -hy + 0.065, 0.16), (-hx + 0.035, hy - 0.065, 0.16), 0.03, 0.045, TK, skip='-z +z')
    b.box((-hx, -hy, zt), (-hx + 0.025, hy, 1.30), TK, skip='-x -z')
    b.box((-hx, -hy, 1.30), (-hx + 0.08, hy, 1.32), TK)
    xp = -0.20
    ya, yb = -hy + 0.27, hy - 0.26
    # fresh water: brass lever pump
    with b.at(_T(xp, ya, zt)):
        b.lathe([(0.042, 0.0), (0.042, 0.008), (0.028, 0.016), (0.028, 0.205), (0.035, 0.21), (0.035, 0.222),
                 (0.0, 0.226)], 8, BR, crease=30.0)
    b.tube([(xp + 0.02, ya, zt + 0.165), (xp + 0.085, ya, zt + 0.175), (xp + 0.12, ya, zt + 0.15),
            (xp + 0.128, ya, zt + 0.105)], 0.012, 5, BR, cap1=True, up=(0, 1, 0))
    b.bar((xp - 0.03, ya, zt + 0.20), (xp - 0.045, ya, zt + 0.30), 0.012, 0.018, BR, up=(1, 0, 0), skip='-z')
    b.bar((xp - 0.05, ya, zt + 0.295), (xp + 0.19, ya, zt + 0.40), 0.011, 0.018, BR, up=(0, 0, 1))
    b.sphere((xp + 0.20, ya, zt + 0.405), 0.016, BR, n=5, stacks=3)
    b.rod((xp, ya, zt + 0.224), (xp, ya, zt + 0.317), 0.005, 3, 'int_steel')
    # salt water: iron lift-and-force pump with air vessel
    with b.at(_T(xp, yb, zt)):
        b.lathe([(0.056, 0.0), (0.056, 0.01), (0.04, 0.022), (0.04, 0.262), (0.05, 0.264), (0.05, 0.28),
                 (0.016, 0.286), (0.016, 0.31)], 8, IR, cap1=True, crease=30.0)
    yv = yb - 0.115
    b.rod((xp, yb - 0.03, zt + 0.085), (xp, yv, zt + 0.085), 0.02, 5, IR)
    with b.at(_T(xp, yv, zt)):
        b.lathe([(0.022, 0.045), (0.024, 0.075), (0.044, 0.105), (0.046, 0.19), (0.03, 0.235), (0.0, 0.25)], 8,
                [IR, CU, CU, CU, CU], cap0=True, crease=40.0)
    b.tube([(xp + 0.015, yv, zt + 0.07), (xp + 0.10, yv, zt + 0.075), (xp + 0.125, yv, zt + 0.045)], 0.014, 5, IR,
           cap1=True, up=(0, 1, 0))
    b.box((xp + 0.05, yv - 0.02, zt + 0.057), (xp + 0.082, yv + 0.02, zt + 0.094), BR)
    b.bar((xp + 0.066, yv, zt + 0.094), (xp + 0.066, yv, zt + 0.118), 0.008, 0.008, BR, skip='-z +z')
    b.bar((xp + 0.066, yv - 0.03, zt + 0.121), (xp + 0.066, yv + 0.03, zt + 0.121), 0.007, 0.012, BR, up=(1, 0, 0))
    b.bar((xp - 0.045, yb, zt + 0.02), (xp - 0.052, yb, zt + 0.365), 0.018, 0.026, IR, up=(1, 0, 0), skip='-z')
    b.bar((xp - 0.058, yb, zt + 0.36), (xp + 0.24, yb, zt + 0.485), 0.014, 0.024, IR, up=(0, 0, 1))
    b.rod((xp + 0.235, yb, zt + 0.483), (xp + 0.345, yb, zt + 0.529), (0.013, 0.016), 5, 'int_teak', cap1=True)
    b.rod((xp, yb, zt + 0.31), (xp, yb, zt + 0.383), 0.006, 3, 'int_steel')
    # pipes below, bucket
    for y in (ya, yb):
        b.rod((xp, y, 0.0), (xp, y, 0.66), 0.016, 5, LD)
    b.tube(_fillet([(0.04, 0.0, zl - 0.17), (0.04, 0.0, 0.50), (-0.13, 0.0, 0.42), (-0.13, 0.0, 0.0)], 0.05), 0.02,
           5, LD, up=(0, 1, 0))
    with b.at(_T(0.085, min(0.14, hy - 0.2), 0.0)):
        b.lathe([(0.108, 0.0), (0.111, 0.035), (0.113, 0.06), (0.125, 0.20), (0.127, 0.225), (0.130, 0.26),
                 (0.121, 0.26), (0.102, 0.022), (0.0, 0.02)], 10,
                ['int_pine', IR, 'int_pine', IR, 'int_pine', 'int_pine', 'int_pine', 'int_pine'], crease=40.0)
        b.tube([(0.0, 0.127, 0.235), (0.045, 0.118, 0.275), (0.085, 0.0, 0.295), (0.045, -0.118, 0.275),
                (0.0, -0.127, 0.235)], 0.004, 3, IR, up=(0, 0, 1))
    return b.finish(name)


def coal_box(name='coal_box', length=0.7):
    """Iron-bound deal coal bunker box: sloping lid on strap hinges propped half open on a
    stick, coal heaped inside, a small iron shovel leaning against the front.
    Origin: on the floor at the centre of the box footprint (``length`` along Y by 0.44).
    Hinges at -X; the open lid rises to 0.73 and the shovel stands 0.14 clear of the front."""
    b = _Builder()
    PN, IR, CO = 'int_pine', 'int_iron', 'int_coal'
    L = float(length)
    hx, hy, zf, zk, t = 0.22, L / 2.0, 0.36, 0.52, 0.022
    O = [b.v(p) for p in ((-hx, -hy, zk), (hx, -hy, zf), (hx, hy, zf), (-hx, hy, zk))]
    Bt = [b.v(p) for p in ((-hx, -hy, 0.0), (hx, -hy, 0.0), (hx, hy, 0.0), (-hx, hy, 0.0))]
    for i in range(4):
        j = (i + 1) % 4
        b.face([Bt[i], Bt[j], O[j], O[i]], PN)
    sl = (zk - zf) / (2.0 * hx)
    zi = lambda x: zf + (hx - x) * sl                # noqa: E731  rim height at x
    xi0, xi1, yi = -hx + t, hx - t, hy - t
    O, I = b.frame4(O, [(xi0, -yi, zi(xi0)), (xi1, -yi, zi(xi1)), (xi1, yi, zi(xi1)), (xi0, yi, zi(xi0))], PN)
    Bk = [b.v(p) for p in ((xi0, -yi, 0.2), (xi1, -yi, 0.2), (xi1, yi, 0.2), (xi0, yi, 0.2))]
    for i in range(4):
        j = (i + 1) % 4
        b.face([I[i], I[j], Bk[j], Bk[i]], PN)
    # coal
    rng = random.Random(5)
    nxq, nyq = 3, 5
    g = b.group()
    V = {}
    for i in range(nxq + 1):
        for j in range(nyq + 1):
            edge = i in (0, nxq) or j in (0, nyq)
            z = 0.235 if edge else 0.27 + 0.05 * rng.random()
            V[i, j] = b.v((xi0 + (xi1 - xi0) * i / nxq, -yi + 2.0 * yi * j / nyq, z))
    for i in range(nxq):
        for j in range(nyq):
            b.face([V[i, j], V[i + 1, j], V[i + 1, j + 1], V[i, j + 1]], CO, None if (i + j) % 2 else g)
    for _ in range(5):
        c = Vector((rng.uniform(xi0 + 0.06, xi1 - 0.06), rng.uniform(-yi + 0.07, yi - 0.07), 0.295))
        s = rng.uniform(0.03, 0.045)
        with b.at(_T(*c) @ _R('Z', 360.0 * rng.random()) @ _R('X', 40.0 * rng.random())):
            b.frustum((0.0, 0.0, -s), (s, 0.8 * s), (0.01, 0.0, 0.6 * s), (0.45 * s, 0.5 * s), CO, skip='-z')
    # iron binding
    for sx in (1.0, -1.0):
        for s in (1.0, -1.0):
            xa, xb2 = sorted((sx * (hx - 0.03), sx * (hx + 0.002)))
            ya, yb2 = sorted((s * (hy - 0.03), s * (hy + 0.002)))
            ztop = zf if sx > 0 else zk
            b.box((xa, ya, 0.0), (xb2, yb2, ztop - 0.004), IR,
                  skip='-z ' + ('-x ' if sx > 0 else '+x ') + ('-y' if s > 0 else '+y'))
    b.box((hx, -hy + 0.03, 0.15), (hx + 0.002, hy - 0.03, 0.19), IR, skip='-x -y +y')
    # lid, hinges, prop
    ang = math.degrees(math.atan2(zk - zf, 2.0 * hx))
    ll = math.hypot(2.0 * hx, zk - zf) + 0.03
    op = 46.0
    with b.at(_T(-hx, 0.0, zk) @ _R('Y', ang - op)):
        b.box((0.0, -hy - 0.012, 0.0), (ll, hy + 0.012, 0.022), PN)
        for s in (1.0, -1.0):
            b.box((-0.004, s * 0.25 * L - 0.02, 0.022), (0.5 * ll, s * 0.25 * L + 0.02, 0.026), IR, skip='-z')
        b.box((ll - 0.05, -0.025, 0.022), (ll + 0.004, 0.025, 0.026), IR, skip='-z')
    a = math.radians(op - ang)
    tip = Vector((-hx + 0.86 * ll * math.cos(a), 0.0, zk + 0.86 * ll * math.sin(a)))
    b.bar((hx - 0.012, hy - 0.06, zf - 0.02), (tip.x, hy - 0.06, tip.z), 0.018, 0.018, PN)
    # shovel
    with b.at(_T(hx + 0.14, -0.2 * L, 0.0) @ _R('Y', -15.0)):
        b.box((-0.003, -0.075, 0.0), (0.003, 0.075, 0.19), IR)
        for s in (1.0, -1.0):
            y0, y1 = sorted((s * 0.075, s * 0.07))
            b.box((0.003, y0, 0.0), (0.03, y1, 0.19), IR, skip='-x')
        b.box((0.003, -0.07, 0.185), (0.03, 0.07, 0.19), IR, skip='-x -y +y')
        b.rod((0.012, 0.0, 0.17), (0.012, 0.0, 0.25), (0.016, 0.013), 5, IR)
        b.rod((0.012, 0.0, 0.25), (0.012, 0.0, 0.50), 0.013, 5, 'int_teak')
        b.rod((0.012, -0.055, 0.51), (0.012, 0.055, 0.51), 0.014, 5, 'int_teak', cap0=True, cap1=True)
    return b.finish(name)


def utensil_rail(name='utensil_rail', length=0.9):
    """Galley utensil rail: a teak batten with four steel hooks carrying a ladle, a brass
    skimmer, a two-pronged meat fork and a small cleaver.
    Origin: centre of the back face of the batten (``length`` x 0.07).  Back at X = 0; the
    utensils hang to Z = -0.40."""
    b = _Builder()
    ST, BR, TK = 'int_steel', 'int_brass', 'int_teak'
    L = float(length)
    b.box((0.0, -L / 2.0, -0.035), (0.018, L / 2.0, 0.035), TK, skip='-x')
    ys = [-L / 2.0 + L * (i + 0.5) / 4.0 for i in range(4)]
    for y in ys:
        b.tube([(0.018, y, 0.006), (0.04, y, -0.014), (0.052, y, -0.004), (0.052, y, 0.012)], 0.003, 3, ST,
               cap1=True, up=(0, 1, 0))
    xh, zh = 0.04, -0.012                            # where things hang
    with b.at(_T(xh, ys[0], zh)):                    # ladle
        b.box((-0.002, -0.008, -0.31), (0.002, 0.008, 0.012), ST)
        with b.at(_T(0.038, 0.0, -0.335)):
            b.lathe([(0.0, -0.036), (0.034, -0.022), (0.047, 0.012), (0.044, 0.012), (0.031, -0.018), (0.0, -0.031)],
                    8, ST, axis='X', crease=50.0)
    with b.at(_T(xh, ys[1], zh)):                    # skimmer
        b.box((-0.002, -0.008, -0.27), (0.002, 0.008, 0.012), 'int_iron')
        with b.at(_T(0.0, 0.0, -0.325)):
            b.lathe([(0.062, -0.002), (0.062, 0.003)], 10, BR, axis='X', cap0=True, cap1=True)
            for i in range(6):
                a = TAU * i / 6
                b.disc(0.0036, (0.034 * math.cos(a), 0.034 * math.sin(a)), 0.007, 4, 'int_coal')
            b.disc(0.0036, (0.0, 0.0), 0.007, 4, 'int_coal')
    with b.at(_T(xh, ys[2], zh)):                    # meat fork
        b.rod((0.0, 0.0, 0.01), (0.0, 0.0, -0.11), (0.011, 0.013), 5, TK, cap0=True, cap1=True)
        b.rod((0.0, 0.0, -0.11), (0.0, 0.0, -0.25), 0.004, 3, ST)
        for s in (1.0, -1.0):
            b.tube([(0.0, 0.0, -0.245), (0.0, s * 0.014, -0.265), (0.0, s * 0.013, -0.37)], [0.004, 0.0035, 0.001], 3,
                   ST, up=(1, 0, 0))
    with b.at(_T(xh, ys[3], zh)):                    # cleaver
        b.rod((0.0, 0.0, 0.01), (0.0, 0.0, -0.115), (0.012, 0.014), 5, TK, cap0=True, cap1=True)
        b.prism([(-0.014, -0.115), (0.075, -0.115), (0.085, -0.30), (-0.014, -0.29)], -0.002, 0.002, ST, plane='YZ')
    return b.finish(name)


def stool(name='stool', height=0.5):
    """Plain four-legged galley stool: round scrubbed pine seat, splayed turned legs, four
    stretchers.  Origin: on the floor at the centre.  Seat 0.31 across."""
    b = _Builder()
    PN = 'int_pine'
    H = float(height)
    b.lathe([(0.14, H - 0.036), (0.155, H - 0.03), (0.155, H - 0.006), (0.148, H)], 12, PN, cap0=True, cap1=True,
            crease=30.0)
    top, foot = 0.10, 0.185
    zst = 0.32 * H
    legs = []
    for i in range(4):
        a = TAU * (i + 0.5) / 4
        c, s = math.cos(a), math.sin(a)
        b.rod((foot * c, foot * s, 0.0), (top * c, top * s, H - 0.03), (0.016, 0.022), 5, PN, cap0=True)
        f = zst / (H - 0.03)
        rr = foot + (top - foot) * f
        legs.append((rr * c, rr * s, zst))
    for i in range(4):
        b.rod(legs[i], legs[(i + 1) % 4], 0.011, 4, PN)
    return b.finish(name)


def bread_barge(name='bread_barge'):
    """The mess bread barge: a small coopered tub, broader at the foot, with two brass hoops
    and a lid with a turned knob.  0.30 across, 0.25 high.  Origin: base centre."""
    b = _Builder()
    PN, BR = 'int_pine', 'int_brass'
    prof = [(0.150, 0.0), (0.147, 0.03), (0.1455, 0.052), (0.139, 0.125), (0.1375, 0.147), (0.134, 0.19),
            (0.141, 0.19), (0.141, 0.204), (0.03, 0.212), (0.016, 0.214), (0.024, 0.236), (0.0, 0.246)]
    b.lathe(prof, 12, [PN, BR, PN, BR, PN, PN, PN, PN, PN, PN, PN], cap0=True, crease=30.0)
    return b.finish(name)


def mess_kid_shelf(name='mess_kid_shelf', length=0.8):
    """Galley store shelf with a fiddle: pine back, shelf and shaped ends, holding a row of
    tin canisters (plain tinplate and black japanned), a square tin and two stoneware jars
    with cork bungs.
    Origin: centre of the back face (0.30 high).  Back at X = 0, projects 0.17."""
    b = _Builder()
    PN, ST, IR, CR = 'int_pine', 'int_steel', 'int_iron', 'int_cream'
    L = float(length)
    hy, zb, zt, e = L / 2.0, -0.15, 0.15, 0.018
    b.box((0.0, -hy, zb), (0.015, hy, zt), PN, skip='-x')
    b.box((0.015, -hy + e, zb), (0.17, hy - e, zb + 0.02), PN, skip='-x -y +y')
    cheek = [(0.015, zb), (0.17, zb), (0.17, zb + 0.09), (0.06, zt), (0.015, zt)]
    for s in (1.0, -1.0):
        y0, y1 = sorted((s * hy, s * (hy - e)))
        b.prism(cheek, y0, y1, PN, plane='XZ', crease=20.0)
    zs = zb + 0.02
    b.box((0.157, -hy + e, zs + 0.035), (0.17, hy - e, zs + 0.062), PN, skip='-y +y')

    def tin(y, r, h, mat):
        with b.at(_T(0.09, y, zs)):
            b.lathe([(r, 0.0), (r, h - 0.022), (r + 0.002, h - 0.022), (r + 0.002, h), (0.0, h + 0.002)], 8, mat,
                    crease=30.0)

    def jar(y, r, h):
        with b.at(_T(0.09, y, zs)):
            b.lathe([(0.86 * r, 0.0), (r, 0.012), (r, 0.70 * h), (0.62 * r, 0.88 * h), (0.66 * r, 0.9 * h),
                     (0.66 * r, 0.96 * h), (0.5 * r, 0.96 * h), (0.5 * r, h), (0.0, h)], 8,
                    [CR] * 6 + ['int_pine'] * 2, crease=30.0)

    def box_tin(y, w, h):
        b.box((0.045, y - w / 2, zs), (0.135, y + w / 2, zs + h - 0.02), CR, skip='-z +z')
        b.box((0.043, y - w / 2 - 0.002, zs + h - 0.02), (0.137, y + w / 2 + 0.002, zs + h), CR)

    items = [(0.10, lambda y: tin(y, 0.05, 0.15, ST)), (0.13, lambda y: jar(y, 0.065, 0.20)),
             (0.09, lambda y: tin(y, 0.045, 0.115, IR)), (0.11, lambda y: box_tin(y, 0.11, 0.13)),
             (0.11, lambda y: jar(y, 0.055, 0.16)), (0.084, lambda y: tin(y, 0.042, 0.165, ST))]
    avail = L - 2 * e - 0.02
    while items and sum(w for w, _ in items) + 0.012 * (len(items) - 1) > avail:
        items.pop()
    if items:
        gap = (avail - sum(w for w, _ in items)) / len(items)
        y = -avail / 2.0 + gap / 2.0
        for w, make in items:
            make(y + w / 2.0)
            y += w + gap
    return b.finish(name)


# ---------------------------------------------------------------------------------------- registry

FURNITURE = {
    'steering_engine': steering_engine,
    'wheel_grating': wheel_grating,
    'voice_pipes': voice_pipes,
    'bulkhead_dial': bulkhead_dial,
    'chart_table': chart_table,
    'chronometer_box': chronometer_box,
    'signal_flag_locker': signal_flag_locker,
    'book_shelf': book_shelf,
    'long_glass_rack': long_glass_rack,
    'settee_locker': settee_locker,
    'electric_light': electric_light,
    'coat_hooks': coat_hooks,
    'rudder_indicator': rudder_indicator,
    'galley_range': galley_range,
    'kettle': kettle,
    'stock_pot': stock_pot,
    'saucepan': saucepan,
    'frying_pan': frying_pan,
    'galley_dresser': galley_dresser,
    'galley_sink': galley_sink,
    'coal_box': coal_box,
    'utensil_rail': utensil_rail,
    'stool': stool,
    'bread_barge': bread_barge,
    'mess_kid_shelf': mess_kid_shelf,
}

# triangle ceilings for the default parameters
BUDGETS = {
    'steering_engine': 1200, 'wheel_grating': 400, 'voice_pipes': 600, 'bulkhead_dial': 400, 'chart_table': 500,
    'chronometer_box': 480, 'signal_flag_locker': 700, 'book_shelf': 450, 'long_glass_rack': 700,
    'settee_locker': 600, 'electric_light': 480, 'coat_hooks': 700, 'rudder_indicator': 400, 'galley_range': 1200,
    'kettle': 350, 'stock_pot': 300, 'saucepan': 250, 'frying_pan': 200, 'galley_dresser': 700,
    'galley_sink': 750, 'coal_box': 400, 'utensil_rail': 400, 'stool': 250, 'bread_barge': 300,
    'mess_kid_shelf': 500,
}

_WALL = (1.0, -0.62, 0.42)                           # a squarer look at things that hang on a bulkhead

# contact sheet: (label, key, keyword arguments[, view direction])
DEMO_SET = [
    ('steering_engine', 'steering_engine', {}),
    ('wheel_grating', 'wheel_grating', {}),
    ('voice_pipes', 'voice_pipes', {}, _WALL),
    ('bulkhead_dial clock', 'bulkhead_dial', dict(kind='clock'), _WALL),
    ('bulkhead_dial barometer', 'bulkhead_dial', dict(kind='barometer'), _WALL),
    ('bulkhead_dial clinometer', 'bulkhead_dial', dict(kind='clinometer'), _WALL),
    ('chart_table', 'chart_table', {}),
    ('chronometer_box', 'chronometer_box', {}),
    ('signal_flag_locker', 'signal_flag_locker', {}, _WALL),
    ('book_shelf', 'book_shelf', {}, _WALL),
    ('long_glass_rack', 'long_glass_rack', {}, _WALL),
    ('settee_locker', 'settee_locker', {}),
    ('electric_light deckhead', 'electric_light', dict(kind='deckhead'), (1.0, -1.3, -0.25)),
    ('electric_light bracket', 'electric_light', dict(kind='bracket'), (1.0, -1.3, 0.1)),
    ('coat_hooks', 'coat_hooks', {}, _WALL),
    ('rudder_indicator', 'rudder_indicator', {}, _WALL),
    ('galley_range', 'galley_range', {}),
    ('kettle', 'kettle', {}),
    ('stock_pot', 'stock_pot', {}),
    ('saucepan', 'saucepan', {}),
    ('frying_pan', 'frying_pan', {}),
    ('galley_dresser', 'galley_dresser', {}),
    ('galley_sink', 'galley_sink', {}),
    ('coal_box', 'coal_box', {}),
    ('utensil_rail', 'utensil_rail', {}, _WALL),
    ('stool', 'stool', {}),
    ('bread_barge', 'bread_barge', {}),
    ('mess_kid_shelf', 'mess_kid_shelf', {}, _WALL),
]


# -------------------------------------------------------------------------------------------- demo

def demo(out_png, cell=400, cols=7, items=None, view=None):
    """Build every piece, render a labelled contact sheet to ``out_png`` (2800 x 1600 with the
    defaults) and print a table of triangle counts.  ``items`` defaults to DEMO_SET; ``view``
    overrides every item's view direction.  Returns the table rows."""
    import shutil
    import tempfile
    import numpy as np

    items = DEMO_SET if items is None else items
    out_png = os.path.abspath(out_png)
    os.makedirs(os.path.dirname(out_png), exist_ok=True)
    studio = F._Studio()
    tmp = tempfile.mkdtemp(prefix='furniture_')
    rows_n = -(-len(items) // cols)
    sheet = np.zeros((rows_n * cell, cols * cell, 4), dtype=np.float32)
    sheet[..., :3] = 0.25
    sheet[..., 3] = 1.0
    table = []
    try:
        for n, item in enumerate(items):
            label, key, kw = item[:3]
            vw = view or (item[3] if len(item) > 3 else None)
            ob = FURNITURE[key]('demo_' + key, **kw)
            info = inspect(ob)
            dims = ob.dimensions
            lo = [min(v.co[i] for v in ob.data.vertices) for i in range(3)]
            hi = [max(v.co[i] for v in ob.data.vertices) for i in range(3)]
            table.append((label, key, info, tuple(dims), [s.name for s in ob.data.materials], BUDGETS[key], lo, hi))
            sub = '%d tris   %.2f x %.2f x %.2f m' % (info['tris'], dims.x, dims.y, dims.z)
            path = os.path.join(tmp, 'cell_%02d.png' % n)
            studio.render(ob, path, (cell, cell), view=vw,
                          labels=((label, 0.052, studio.ink), (sub, 0.038, studio.ink2)))
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
        img = bpy.data.images.new('furniture_sheet', cols * cell, rows_n * cell, alpha=False)
        img.pixels.foreach_set(sheet.ravel())
        img.filepath_raw = out_png
        img.file_format = 'PNG'
        img.save()
        bpy.data.images.remove(img)
    finally:
        studio.close()
        shutil.rmtree(tmp, ignore_errors=True)
    print('\n%-26s %5s %6s %5s %5s %4s  %-17s %-22s %-22s %s' % (
        'piece', 'tris', 'budget', 'verts', 'open', 'flip', 'size x y z', 'min x y z', 'max x y z', 'materials'))
    total = 0
    for label, key, info, dims, mats, budget, lo, hi in table:
        total += info['tris']
        print('%-26s %5d %6d %5d %5d %4d  %-17s %-22s %-22s %s' % (
            label, info['tris'], budget, info['verts'], info['open_edges'],
            info['inverted_shells'] + info['bad_winding'], '%.2f %.2f %.2f' % dims,
            '%.3f %.3f %.3f' % tuple(lo), '%.3f %.3f %.3f' % tuple(hi),
            ', '.join(m.replace('int_', '') for m in mats)))
    print('%-26s %5d' % ('total', total))
    print('contact sheet:', out_png)
    return table


if __name__ == '__main__':
    _args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    _dir = os.path.normpath(os.path.join(_HERE, '..', '..', 'artifacts', 'hesperus', 'blender'))
    demo(_args[0] if _args else os.path.join(_dir, 'furniture-bridge.png'))
