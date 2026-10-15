"""What the Hesperus looks like through the keeper's telescope, by day and by night.

    blender -b tools/ships/hesperus.blend -P tools/ships/hesperus_telescope.py -- --out artifacts/hesperus/telescope

A study for the game, not a game asset. Each frame is the game's telescope view (3.5 degrees high) of the ship at a
given range, from a given height of eye, over a sea that falls away with the Earth's curvature exactly as the engine
drops it (src/world/flannan/FarShore.js: CURVATURE, standard refraction k = 0.13). The ship model is chosen by range:
the full model inside 600 m, Hesperus_LOD1 to 4 km, Hesperus_LOD2 beyond. Haze, funnel smoke and the glare of her
lights are painted on afterwards from the same geometry, so the frames show what could be seen and what could not:
from the lantern (101 m) the sea horizon is 38 km off and she is whole all the way to it; from the landings she is
hull-down beyond about 12 km and gone, smoke apart, beyond about 27 km. Lights use the arcs and ranges carried by the
HSP_light_* empties (1897 regulations and the 1896 lighting report).
"""
import bpy, math, os, sys
import numpy as np
from mathutils import Matrix, Vector
from bpy_extras.object_utils import world_to_camera_view

CURVATURE = (1 - 0.13) / (2 * 6371000)
FOV_DEG, W, H = 3.5, 1280, 720
LWL, MIDSHIPS = 3.0, 25.2
FUNNEL_TOP = Vector((23.6, 0.0, 15.5))

# label, eye height (m), range (m), aspect (0 = bow at you, 90 = her starboard side to you), night, visibility (m), state
CASES = [
    ('day_lantern_03km', 'From the lantern, 3 km: lying off the east landing', 101, 3000, 78, False, 40000, 'at anchor'),
    ('day_lantern_12km', 'From the lantern, 12 km: under way for the island', 101, 12000, 22, False, 35000, 'under way'),
    ('day_lantern_26km', 'From the lantern, 26 km: off Loch Roag in clear air', 101, 26000, 35, False, 45000, 'under way'),
    ('day_landing_12km', 'From the east landing, 12 km: the sea is taking her hull', 6, 12000, 40, False, 35000, 'under way'),
    ('day_landing_20km', 'From the east landing, 20 km: masts, funnel and smoke', 6, 20000, 40, False, 45000, 'under way'),
    ('day_haze_09km', 'From the lantern, 9 km in a 12 km haze', 101, 9000, 60, False, 12000, 'under way'),
    ('night_head_on_08km', 'Night, 8 km, coming straight in: masthead light over red and green', 101, 8000, 0, True, 30000, 'under way'),
    ('night_crossing_06km', 'Night, 6 km, crossing: masthead light and her green', 101, 6000, 70, True, 30000, 'under way'),
    ('night_anchor_02km', 'Night, 2.5 km, at anchor: two riding lights and the cabin ports', 101, 2500, 80, True, 30000, 'at anchor'),
    ('night_searchlight_05km', 'Night, 5 km: the 5000 candle-power searchlight turned on the island', 101, 5000, 30, True, 30000, 'searchlight'),
]

def ship_collection(d):
    name = 'Hesperus' if d < 600 else ('Hesperus_LOD1' if d < 4000 else 'Hesperus_LOD2')
    return bpy.data.collections.get(name) or bpy.data.collections['Hesperus']

def sea_mesh():
    radii = [0, 150, 400, 800, 1500, 2500, 4000, 6000, 8000, 10000, 12500, 15000, 18000, 21000, 25000, 30000, 36000, 44000, 55000, 70000]
    n = 160; verts = [(0, 0, 0)]; faces = []
    for r in radii[1:]:
        verts += [(r * math.cos(2 * math.pi * k / n), r * math.sin(2 * math.pi * k / n), -CURVATURE * r * r) for k in range(n)]
    faces += [(0, 1 + k, 1 + (k + 1) % n) for k in range(n)]
    for i in range(len(radii) - 2):
        a, b = 1 + i * n, 1 + (i + 1) * n
        faces += [(a + k, b + k, b + (k + 1) % n, a + (k + 1) % n) for k in range(n)]
    me = bpy.data.meshes.new('TEL_sea'); me.from_pydata(verts, [], faces)
    m = bpy.data.materials.new('TEL_sea'); m.use_nodes = True; b = next(q for q in m.node_tree.nodes if q.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (0.012, 0.022, 0.028, 1); b.inputs['Roughness'].default_value = 0.32
    me.materials.append(m)
    return bpy.data.objects.new('TEL_sea', me)

def set_glass_glow(strength):
    g = bpy.data.materials.get('glass')
    if not g: return
    b = next(q for q in g.node_tree.nodes if q.type == 'BSDF_PRINCIPLED')
    b.inputs['Emission Color'].default_value = (1.0, 0.72, 0.38, 1); b.inputs['Emission Strength'].default_value = strength

def render(scene, path):
    scene.render.filepath = path; bpy.ops.render.render(write_still=True, scene=scene.name)
    im = bpy.data.images.load(path); a = np.empty(W * H * 4, np.float32); im.pixels.foreach_get(a); bpy.data.images.remove(im)
    return a.reshape(H, W, 4)

def blob(img, x, y, sx, sy, colour, amp, mode='add'):
    if amp <= 0.003 or not (-60 < x < W + 60 and -60 < y < H + 60): return
    rx, ry = int(4 * sx) + 2, int(4 * sy) + 2
    x0, x1, y0, y1 = max(0, int(x) - rx), min(W, int(x) + rx + 1), max(0, int(y) - ry), min(H, int(y) + ry + 1)
    if x0 >= x1 or y0 >= y1: return
    yy, xx = np.mgrid[y0:y1, x0:x1]
    g = (amp * np.exp(-0.5 * (((xx - x) / sx) ** 2 + ((yy - y) / sy) ** 2)))[..., None]
    c = np.array(colour, np.float32)
    if mode == 'add': img[y0:y1, x0:x1, :3] += g * c
    else: img[y0:y1, x0:x1, :3] = img[y0:y1, x0:x1, :3] * (1 - np.clip(g, 0, 1)) + c * np.clip(g, 0, 1)

def study(case, out):
    key, title, eye, d, aspect, night, vis, state = case
    scene = bpy.data.scenes.new('TEL_' + key); coll = scene.collection
    r = scene.render; r.engine = 'BLENDER_EEVEE'; r.resolution_x, r.resolution_y, r.resolution_percentage = W, H, 100
    r.image_settings.file_format = 'PNG'; scene.view_settings.view_transform = 'Standard'; scene.eevee.taa_render_samples = 32
    haze = np.array((0.60, 0.65, 0.70) if not night else (0.010, 0.013, 0.020), np.float32)
    world = bpy.data.worlds.new('TEL_world'); world.use_nodes = True; scene.world = world
    bg = next(q for q in world.node_tree.nodes if q.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = (*(haze ** 2.2), 1); bg.inputs['Strength'].default_value = 1.0
    if not night:
        sun = bpy.data.objects.new('TEL_sun', bpy.data.lights.new('TEL_sun', 'SUN')); coll.objects.link(sun)
        sun.data.energy = 2.6; sun.data.color = (1.0, 0.93, 0.82); sun.rotation_euler = (math.radians(80), 0, math.radians(125))  # a low sun from the south
    sea = sea_mesh(); coll.objects.link(sea)
    ship = bpy.data.objects.new('TEL_ship', None); ship.instance_type = 'COLLECTION'; ship.instance_collection = ship_collection(d); coll.objects.link(ship)
    theta = math.radians(180 + aspect)
    ship.matrix_world = Matrix.Translation((d, 0, -LWL - CURVATURE * d * d)) @ Matrix.Rotation(theta, 4, 'Z') @ Matrix.Translation((-MIDSHIPS, 0, 0))
    cam = bpy.data.objects.new('TEL_cam', bpy.data.cameras.new('TEL_cam')); coll.objects.link(cam); scene.camera = cam
    cam.data.sensor_fit = 'VERTICAL'; cam.data.angle_y = math.radians(FOV_DEG); cam.data.clip_start = 30; cam.data.clip_end = 90000
    cam.location = (0, 0, eye)
    aim = Vector((d, 0, -CURVATURE * d * d + 7.0))
    # set the matrix outright: nothing re-evaluates this scene before the projections below are taken from it
    cam.matrix_world = Matrix.Translation((0, 0, eye)) @ (aim - Vector((0, 0, eye))).to_track_quat('-Z', 'Y').to_matrix().to_4x4()
    set_glass_glow(9.0 if night else 0.0)
    r.film_transparent = False; full = render(scene, os.path.join(out, key + '_a.png'))
    sea.is_holdout = True; r.film_transparent = True; alone = render(scene, os.path.join(out, key + '_b.png'))   # the sea still hides what is under it
    mask = alone[..., 3:4]

    # distance along each line of sight to the curved sea, for the haze
    mw = cam.matrix_world; rot = np.array(mw.to_3x3()); tan = math.tan(math.radians(FOV_DEG) / 2)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    cx = (xx + 0.5 - W / 2) / (H / 2) * tan; cy = (yy + 0.5 - H / 2) / (H / 2) * tan
    dirs = np.stack([cx, cy, -np.ones_like(cx)], -1) @ rot.T
    dirs /= np.linalg.norm(dirs, axis=-1, keepdims=True)
    q2 = dirs[..., 0] ** 2 + dirs[..., 1] ** 2; dz = dirs[..., 2]
    disc = dz * dz - 4 * CURVATURE * q2 * eye
    hit = (dz < 0) & (disc > 0)
    s = np.where(hit, (-dz - np.sqrt(np.maximum(disc, 0))) / (2 * CURVATURE * np.maximum(q2, 1e-9)), 1e9)
    f_sea = np.where(hit, 1 - np.exp(-3.912 * s / vis), 1.0)[..., None]
    f_ship = 1 - math.exp(-3.912 * d / vis)
    img = full[..., :3].copy()
    hazed = img * (1 - f_sea) + haze * f_sea
    ship_px = img * (1 - f_ship) + haze * f_ship
    img = hazed * (1 - mask) + ship_px * mask

    px_per_m = (H / 2) / (d * tan)
    def pix(local):
        co = world_to_camera_view(scene, cam, ship.matrix_world @ Vector(local))
        return co.x * W, co.y * H
    horizon_ok = True
    # funnel smoke: coal smoke streaming aft when she is under way, a thin column when she lies at anchor
    rng = np.random.default_rng(abs(hash(key)) % (2 ** 32))
    length = 650 if state == 'under way' else (160 if state == 'at anchor' else 300)
    for k in range(90):
        t = k / 89
        local = FUNNEL_TOP + Vector((-length * t * (1.0 if state == 'under way' else 0.45), 40 * t * t + rng.normal(0, 3 * t), 3 + 9 * (1 - math.exp(-4 * t)) + (14 * t if state != 'under way' else 0) + rng.normal(0, 1.2 * t)))
        x, y = pix(local); width = (0.9 + 7 * t ** 0.7) * px_per_m
        dens = (0.34 if state == 'under way' else 0.12) * (1 - t) ** 1.6
        smoke = (np.array((0.10, 0.095, 0.09)) if not night else np.array((0.004, 0.004, 0.005))) * (1 - f_ship) + haze * f_ship
        blob(img, x, y, max(width, 0.8), max(width * 0.7, 0.7), smoke, dens * min(1.0, 0.5 + width / 3), mode='over')

    if night:
        rel = math.degrees(math.atan2(math.sin(theta), -math.cos(theta)))   # bearing of the eye from her bow, positive to port
        trans = math.exp(-3.912 * d / vis)
        for e in ship.instance_collection.all_objects:
            if 'light' not in e.keys(): continue
            name, shown = e['light'], e['shown']
            lit = (shown == state) or (state == 'searchlight' and shown in ('under way', 'on demand'))
            diff = abs((rel - e['bearing_deg'] + 180) % 360 - 180)
            if not lit: continue
            col = tuple(e['colour']); x, y = pix(e.location)
            if name == 'searchlight':
                # a hand-trained arc projector pointed at the island: blinding in the glass, with a long glitter on the sea
                blob(img, x, y, 2.2, 2.2, col, 3.0); blob(img, x, y, 11, 11, col, 0.55); blob(img, x, y, 46, 30, col, 0.10)
                blob(img, x, y, 70, 0.9, col, 0.5); blob(img, x, y, 0.9, 70, col, 0.5)
                xw, yw = pix((MIDSHIPS, 0, LWL)); blob(img, x, yw - 40, 3.5, 34, col, 0.22)
                continue
            if e['arc_deg'] < 359 and diff > e['arc_deg'] / 2: continue
            reach = e['range_nm'] * 1852.0
            amp = 0.95 * math.sqrt((reach / d) ** 2 * trans)          # a telescope carries a light well past its stated range
            blob(img, x, y, 1.15, 1.15, col, min(amp, 1.6)); blob(img, x, y, 4.5, 4.5, col, min(amp, 1.6) * 0.22)
            xw, yw = pix((e.location.x, e.location.y, LWL)); blob(img, x, yw - 9, 1.4, 8, col, min(amp, 1.2) * 0.16)   # its wake on the water

    # the round field of the glass
    rr = np.sqrt(((xx - W / 2) / (H * 0.49)) ** 2 + ((yy - H / 2) / (H * 0.49)) ** 2)
    img *= np.clip((1.0 - rr) / 0.035, 0, 1)[..., None] * (1 - 0.18 * np.clip(rr, 0, 1) ** 3)[..., None]
    outp = np.concatenate([np.clip(img, 0, 1), np.ones((H, W, 1), np.float32)], -1)
    res = bpy.data.images.new('TEL_out', W, H, alpha=False); res.pixels.foreach_set(outp.ravel())
    res.filepath_raw = os.path.join(out, key + '.png'); res.file_format = 'PNG'; res.save(); bpy.data.images.remove(res)
    for tmp in ('_a.png', '_b.png'):
        try: os.remove(os.path.join(out, key + tmp))
        except OSError: pass
    hidden = CURVATURE * max(0.0, d - math.sqrt(eye / CURVATURE)) ** 2
    print(f'TELESCOPE {key}: {ship.instance_collection.name}, {px_per_m * 57.4:.0f} px long, hidden below the horizon {hidden:.1f} m, haze {f_ship:.2f} | {title}')
    bpy.data.scenes.remove(scene)

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = os.path.abspath(argv[argv.index('--out') + 1]) if '--out' in argv else os.path.abspath('artifacts/hesperus/telescope')
    only = argv[argv.index('--only') + 1].split(',') if '--only' in argv else None
    os.makedirs(out, exist_ok=True)
    for case in CASES:
        if only and case[0] not in only: continue
        study(case, out)
    set_glass_glow(0.0)
