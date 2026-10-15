"""Close-up surface finish for the HESPERUS model: procedural shader nodes only.

    import hesperus_finish
    hesperus_finish.apply_finish()        # after the ship and its materials exist

Upgrades the shared materials in place.  No image files and no UVs: everything is driven from
object-space position (the hull, decks and funnel are modelled in ship coordinates: +X forward,
+Z up, metres, waterline Z = 3.0), so every level of detail that shares a material gets the
same finish.  Each material keeps its flat ``diffuse_color`` and the default values on its
Principled BSDF untouched; those are read as the mean and only overridden by links, so calling
``apply_finish`` again rebuilds exactly the same graph.
"""
import bpy

WATERLINE = 3.0
STRAKE = 1.05          # height of a strake of plating
PLATE = 5.03           # nine 22 in frame spaces
PLANK = 0.127          # 5 in deck planks
BOARD = 4.6            # length of a deck plank between butts

__all__ = ['apply_finish', 'FINISHED']


class _G:
    """Tiny helper for wiring math / noise / mix nodes."""

    def __init__(self, nt):
        self.nt = nt
        self.n = 0

    def new(self, typ, **props):
        node = self.nt.nodes.new(typ)
        self.n += 1
        node.location = (-220 * (1 + self.n % 12), -160 * (self.n // 12))
        for k, v in props.items():
            setattr(node, k, v)
        return node

    def put(self, sock, val):
        if isinstance(val, bpy.types.NodeSocket):
            self.nt.links.new(val, sock)
        elif isinstance(val, (tuple, list)) and len(val) == 3 and len(sock.default_value) == 4:
            sock.default_value = (*val, 1.0)
        else:
            sock.default_value = val

    def m(self, op, a, b=0.0, c=0.0, clamp=False):
        node = self.new('ShaderNodeMath', operation=op, use_clamp=clamp)
        for sock, val in zip(node.inputs, (a, b, c)):
            self.put(sock, val)
        return node.outputs[0]

    def ramp(self, v, lo, hi, a=0.0, b=1.0):
        """Smooth step of v from lo..hi mapped to a..b (clamped)."""
        node = self.new('ShaderNodeMapRange', interpolation_type='SMOOTHSTEP', clamp=True)
        self.put(node.inputs[0], v)
        for i, val in enumerate((lo, hi, a, b)):
            node.inputs[i + 1].default_value = val
        return node.outputs[0]

    def noise(self, vec, scale, detail=2.0, rough=0.5):
        node = self.new('ShaderNodeTexNoise')
        self.put(node.inputs['Vector'], vec)
        node.inputs['Scale'].default_value = scale
        node.inputs['Detail'].default_value = detail
        node.inputs['Roughness'].default_value = rough
        return node.outputs[0]

    def white(self, vec):
        node = self.new('ShaderNodeTexWhiteNoise', noise_dimensions='2D')
        self.put(node.inputs['Vector'], vec)
        return node.outputs[0]

    def scale(self, vec, s):
        node = self.new('ShaderNodeVectorMath', operation='MULTIPLY')
        self.put(node.inputs[0], vec)
        node.inputs[1].default_value = s
        return node.outputs[0]

    def comb(self, x=0.0, y=0.0, z=0.0):
        node = self.new('ShaderNodeCombineXYZ')
        for sock, val in zip(node.inputs, (x, y, z)):
            self.put(sock, val)
        return node.outputs[0]

    def mix(self, fac, a, b):
        node = self.new('ShaderNodeMix', data_type='RGBA')
        f, sa, sb = [s for s in node.inputs if s.enabled][:3]
        self.put(f, fac)
        self.put(sa, a)
        self.put(sb, b)
        return [s for s in node.outputs if s.enabled][0]

    def bump(self, height, dist):
        node = self.new('ShaderNodeBump')
        node.inputs['Strength'].default_value = 1.0
        node.inputs['Distance'].default_value = dist
        self.put(node.inputs['Height'], height)
        return node.outputs['Normal']


def _mul(col, f):
    return tuple(min(1.0, c * f) for c in col)


def _begin(name):
    """Strip a material back to its Principled BSDF and output; return the wiring kit."""
    mat = bpy.data.materials.get(name)
    if mat is None or mat.node_tree is None:
        return None
    nt = mat.node_tree
    bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None)
    if bsdf is None or out is None:
        return None
    for node in list(nt.nodes):
        if node != bsdf and node != out:
            nt.nodes.remove(node)
    for sock in bsdf.inputs:
        for link in list(sock.links):
            nt.links.remove(link)
    if not out.inputs['Surface'].is_linked:
        nt.links.new(bsdf.outputs[0], out.inputs['Surface'])
    g = _G(nt)
    tc = g.new('ShaderNodeTexCoord')
    sep = g.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Object'], sep.inputs[0])
    base = tuple(bsdf.inputs['Base Color'].default_value)[:3]
    rough = bsdf.inputs['Roughness'].default_value
    return g, bsdf, tc.outputs['Object'], sep.outputs[0], sep.outputs[1], sep.outputs[2], base, rough


def _end(g, bsdf, col=None, rough=None, height=None, dist=0.002):
    if col is not None:
        g.put(bsdf.inputs['Base Color'], col)
    if rough is not None:
        g.put(bsdf.inputs['Roughness'], rough)
    if height is not None:
        g.put(bsdf.inputs['Normal'], g.bump(height, dist))


def _plating(g, X, Z):
    """In-and-out plating: returns (bump height in units of 12 mm, distance to the strake seam)."""
    s = g.m('DIVIDE', Z, STRAKE)
    row = g.m('FLOOR', s)
    proud = g.ramp(g.m('PINGPONG', g.m('ADD', s, 0.5), 1.0), 0.485, 0.515)      # alternate strakes out
    dz = g.m('MULTIPLY', g.m('PINGPONG', s, 0.5), STRAKE)                        # metres from a seam
    u = g.m('ADD', g.m('DIVIDE', X, PLATE), g.m('MULTIPLY', row, 0.37))          # staggered butts
    butt = g.ramp(g.m('MULTIPLY', g.m('PINGPONG', u, 0.5), PLATE), 0.003, 0.008, 1.0, 0.0)
    band = g.ramp(g.m('ABSOLUTE', g.m('SUBTRACT', dz, 0.034)), 0.004, 0.011, 1.0, 0.0)
    dot = g.ramp(g.m('PINGPONG', X, 0.0375), 0.006, 0.012, 1.0, 0.0)             # rivets at 75 mm
    rivet = g.m('MULTIPLY', band, dot)
    height = g.m('ADD', g.m('SUBTRACT', proud, g.m('MULTIPLY', butt, 0.35)), g.m('MULTIPLY', rivet, 0.3))
    return height, dz


def _hull_black():
    k = _begin('hull_black')
    if not k:
        return False
    g, bsdf, P, X, Y, Z, base, rough = k
    height, dz = _plating(g, X, Z)
    gl = g.noise(P, 0.5, 3.0)
    col = g.mix(gl, _mul(base, 0.75), _mul(base, 1.3))
    col = g.mix(g.ramp(dz, 0.004, 0.014, 0.22, 0.0), col, (0.07, 0.07, 0.075))          # dusty seam edge
    streak = g.ramp(g.noise(g.scale(P, (1.3, 1.3, 0.04)), 1.0, 4.0), 0.62, 0.74)
    where = g.ramp(g.noise(g.comb(X), 0.33, 1.0), 0.55, 0.68)                           # a few places only
    rust = g.m('MULTIPLY', g.m('MULTIPLY', streak, where), g.ramp(Z, 4.2, 5.8, 0.0, 0.38))
    col = g.mix(rust, col, (0.17, 0.075, 0.03))
    salt = g.m('MULTIPLY', g.ramp(Z, WATERLINE + 0.12, WATERLINE + 0.75, 0.17, 0.0),
               g.noise(g.scale(P, (1.2, 1.2, 5.0)), 2.2, 3.0))
    col = g.mix(salt, col, (0.42, 0.43, 0.44))
    r = g.m('ADD', g.m('ADD', rough - 0.12, g.m('MULTIPLY', gl, 0.24)), g.m('MULTIPLY', salt, 0.6), clamp=True)
    _end(g, bsdf, col, r, height, 0.012)
    return True


def _antifouling():
    k = _begin('antifouling')
    if not k:
        return False
    g, bsdf, P, X, Y, Z, base, rough = k
    height, dz = _plating(g, X, Z)
    mot = g.noise(P, 0.9, 4.0)
    col = g.mix(mot, _mul(base, 0.8), _mul(base, 1.18))
    slime = g.m('MULTIPLY', g.ramp(Z, WATERLINE - 0.7, WATERLINE, 0.0, 0.3), g.noise(P, 3.0, 3.0))
    col = g.mix(slime, col, (0.07, 0.10, 0.05))
    _end(g, bsdf, col, g.m('ADD', rough - 0.08, g.m('MULTIPLY', mot, 0.16), clamp=True), height, 0.012)
    return True


def _white():
    k = _begin('white')
    if not k:
        return False
    g, bsdf, P, X, Y, Z, base, rough = k
    height, dz = _plating(g, X, Z)
    # plating only where white is hull plating (boot-top and the bridge-side strake), not boats or houses
    on_hull = g.m('MULTIPLY', g.ramp(Z, 2.85, 2.95), g.ramp(Z, 6.5, 6.6, 1.0, 0.0))
    dirt = g.noise(P, 1.3, 3.0)
    col = g.mix(g.ramp(dirt, 0.45, 0.8, 0.0, 0.11), base, (0.52, 0.48, 0.40))
    boot = g.m('MULTIPLY', g.ramp(Z, 2.9, 2.98), g.ramp(Z, WATERLINE + 0.16, WATERLINE + 0.24, 1.0, 0.0))
    grime = g.m('MULTIPLY', boot, g.m('ADD', 0.22, g.m('MULTIPLY', g.noise(P, 3.5, 3.0), 0.4)))
    col = g.mix(grime, col, (0.22, 0.22, 0.17))
    _end(g, bsdf, col, g.m('ADD', rough - 0.05, g.m('MULTIPLY', dirt, 0.12), clamp=True),
         g.m('MULTIPLY', height, on_hull), 0.012)
    return True


def _deck():
    k = _begin('deck_pine')
    if not k:
        return False
    g, bsdf, P, X, Y, Z, base, rough = k
    v = g.m('DIVIDE', Y, PLANK)
    plank = g.m('FLOOR', v)
    seam = g.ramp(g.m('MULTIPLY', g.m('PINGPONG', v, 0.5), PLANK), 0.0025, 0.0055, 1.0, 0.0)
    r1 = g.white(g.comb(plank, 0.0, 0.0))
    u = g.m('ADD', g.m('DIVIDE', X, BOARD), g.m('MULTIPLY', r1, 7.0))                   # butts staggered
    butt = g.ramp(g.m('MULTIPLY', g.m('PINGPONG', u, 0.5), BOARD), 0.002, 0.0045, 1.0, 0.0)
    r2 = g.white(g.comb(plank, g.m('FLOOR', u), 0.0))                                   # one value per board
    col = g.mix(r2, _mul(base, 0.84), _mul(base, 1.10))
    lum = 0.25 * base[0] + 0.6 * base[1] + 0.15 * base[2]
    col = g.mix(g.m('MULTIPLY', g.noise(P, 0.7, 3.0), 0.5), col, (lum * 1.08, lum * 1.08, lum * 1.04))  # scrubbed grey
    grain = g.noise(g.scale(P, (2.5, 55.0, 55.0)), 1.0, 3.0, 0.6)
    col = g.mix(g.m('MULTIPLY', grain, 0.16), col, _mul(base, 0.68))
    wear = g.ramp(g.noise(P, 0.2, 3.0), 0.5, 0.8, 0.0, 0.2)
    col = g.mix(wear, col, _mul(base, 0.55))
    line = g.m('MAXIMUM', seam, butt)
    col = g.mix(line, col, (0.03, 0.025, 0.02))
    r = g.m('ADD', rough - 0.04, g.m('MULTIPLY', grain, 0.12), clamp=True)
    _end(g, bsdf, col, r, g.m('SUBTRACT', g.m('MULTIPLY', grain, 0.12), line), 0.003)
    return True


def _wood(name):
    k = _begin(name)
    if not k:
        return False
    g, bsdf, P, X, Y, Z, base, rough = k
    g1 = g.noise(g.scale(P, (7.0, 60.0, 60.0)), 1.0, 3.0, 0.6)
    g2 = g.noise(P, 45.0, 2.0)
    f = g.m('ADD', g.m('MULTIPLY', g1, 0.6), g.m('MULTIPLY', g2, 0.4))
    col = g.mix(f, _mul(base, 0.76), _mul(base, 1.24))
    r = g.m('ADD', rough - 0.08, g.m('MULTIPLY', g.noise(P, 1.5, 2.0), 0.16), clamp=True)
    _end(g, bsdf, col, r, f, 0.0006)
    return True


def _buff():
    k = _begin('buff')
    if not k:
        return False
    g, bsdf, P, X, Y, Z, base, rough = k
    n = g.noise(P, 1.2, 3.0)
    soot = g.m('MULTIPLY', g.ramp(Z, 13.5, 17.0, 0.0, 0.78), g.m('ADD', 0.55, g.m('MULTIPLY', n, 0.45)))
    streak = g.ramp(g.noise(g.scale(P, (6.0, 6.0, 0.25)), 1.0, 3.0), 0.58, 0.8, 0.0, 0.13)
    col = g.mix(streak, base, _mul(base, 0.55))
    col = g.mix(soot, col, (0.03, 0.028, 0.025))
    _end(g, bsdf, col, g.m('ADD', rough - 0.05, g.m('MULTIPLY', soot, 0.4), clamp=True))
    return True


def _canvas():
    k = _begin('canvas')
    if not k:
        return False
    g, bsdf, P, X, Y, Z, base, rough = k
    w = g.noise(P, 350.0, 1.0)
    col = g.mix(w, _mul(base, 0.90), _mul(base, 1.08))
    col = g.mix(g.ramp(g.noise(P, 1.0, 3.0), 0.5, 0.85, 0.0, 0.12), col, _mul(base, 0.7))
    _end(g, bsdf, col, None, w, 0.0004)
    return True


def _iron():
    k = _begin('iron')
    if not k:
        return False
    g, bsdf, P, X, Y, Z, base, rough = k
    bloom = g.ramp(g.noise(P, 5.0, 4.0), 0.56, 0.76, 0.0, 0.24)
    _end(g, bsdf, g.mix(bloom, base, (0.15, 0.065, 0.03)), g.m('ADD', rough, bloom, clamp=True))
    return True


def _brass():
    k = _begin('brass')
    if not k:
        return False
    g, bsdf, P, X, Y, Z, base, rough = k
    t = g.noise(P, 7.0, 3.0)
    _end(g, bsdf, g.mix(g.ramp(t, 0.45, 0.78, 0.0, 0.3), base, (0.24, 0.19, 0.08)),
         g.m('ADD', rough - 0.05, g.m('MULTIPLY', t, 0.22), clamp=True))
    return True


FINISHED = []       # names of the materials upgraded by the last call


def apply_finish(scene=None):
    """Upgrade the ship's shared materials in place (procedural nodes only).  Safe to call
    repeatedly.  ``scene`` is accepted for symmetry with the build script; materials are shared
    data, so it is not needed.  Returns the list of material names that were upgraded."""
    jobs = [('hull_black', _hull_black), ('antifouling', _antifouling), ('white', _white), ('deck_pine', _deck),
            ('teak', lambda: _wood('teak')), ('house_aft', lambda: _wood('house_aft')),
            ('mast_brown', lambda: _wood('mast_brown')), ('buff', _buff), ('canvas', _canvas), ('iron', _iron),
            ('brass', _brass)]
    done = []
    for name, job in jobs:
        try:
            if job():
                done.append(name)
        except Exception as exc:                      # never break the ship build over a finish
            print('hesperus_finish: %s skipped: %r' % (name, exc))
    FINISHED[:] = done
    print('hesperus_finish: finished', ', '.join(done) if done else 'nothing (materials not found)')
    return done
