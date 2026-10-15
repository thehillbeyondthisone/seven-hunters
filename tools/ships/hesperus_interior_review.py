"""Review renders of the HESPERUS interiors, path traced so daylight comes through the real openings.

    blender -b tools/ships/hesperus.blend -P tools/ships/hesperus_interior_review.py -- --out artifacts/hesperus/interiors
                                                       [--only wheelhouse,saloon_fwd] [--samples 96] [--night] [--size 1280x800]

One PNG per view in hesperus_interiors.VIEWS.  By day the lamps are out and the rooms are lit by the sky through the
windows, skylights and scuttles; with --night the daylight is put out and the electric lamps are lit.
"""
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path: sys.path.insert(0, HERE)
import hesperus_interiors as INT


def setup(scene, samples, size, night):
    r = scene.render
    r.engine = 'CYCLES'; r.resolution_x, r.resolution_y = size; r.resolution_percentage = 100; r.film_transparent = False
    c = scene.cycles
    c.samples = samples; c.use_adaptive_sampling = True; c.adaptive_threshold = 0.03; c.max_bounces = 6; c.diffuse_bounces = 4
    c.use_denoising = True; c.sample_clamp_indirect = 6.0
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        for kind in ('OPTIX', 'CUDA', 'HIP', 'ONEAPI'):
            try:
                prefs.compute_device_type = kind; prefs.get_devices()
                devs = [d for d in prefs.devices if d.type == kind]
                if devs:
                    for d in prefs.devices: d.use = d.type == kind
                    c.device = 'GPU'; print('interior review: rendering on', kind, devs[0].name); break
            except Exception: continue
    except Exception: pass
    scene.view_settings.view_transform = 'AgX'; scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0.4 if night else 1.4
    w = bpy.data.worlds.new('HSP_interior_sky'); scene.world = w; w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = (0.012, 0.016, 0.03, 1) if night else (0.62, 0.72, 0.86, 1)
    bg.inputs['Strength'].default_value = 0.05 if night else 1.6
    for ob in list(scene.objects):                                  # one sun of our own; drop any review-rig lights
        if ob.type == 'LIGHT' and '_int_lamp_' not in ob.name: ob.hide_render = True
    if not night:
        sun = bpy.data.lights.new('HSP_interior_sun', 'SUN'); sun.energy = 2.2; sun.angle = 0.12; sun.color = (1.0, 0.95, 0.86)
        so = bpy.data.objects.new(sun.name, sun); scene.collection.objects.link(so)
        so.rotation_euler = (Vector((0.55, 0.45, -0.42))).to_track_quat('-Z', 'Y').to_euler()
    day = bpy.data.materials.get('int_daylight')
    if day:                                                         # at night the glass is black and only mirrors the room
        b = next(n for n in day.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        b.inputs['Emission Strength'].default_value = 0.0 if night else INT.EMISSION['int_daylight']
        if night:
            b.inputs['Base Color'].default_value = (0.01, 0.012, 0.016, 1); b.inputs['Roughness'].default_value = 0.08
    for ob in scene.objects:
        if ob.type == 'LIGHT' and '_int_lamp_' in ob.name: ob.hide_render = not night


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    get = lambda k, d: argv[argv.index(k) + 1] if k in argv else d
    out = os.path.abspath(get('--out', 'artifacts/hesperus/interiors')); os.makedirs(out, exist_ok=True)
    only = [s for s in get('--only', '').split(',') if s]
    night = '--night' in argv
    size = tuple(int(v) for v in get('--size', '1280x800').split('x'))
    scene = bpy.data.scenes.get('Hesperus') or bpy.context.scene
    if bpy.context.window: bpy.context.window.scene = scene
    setup(scene, int(get('--samples', '96')), size, night)
    cam = bpy.data.objects.new('HSP_interior_cam', bpy.data.cameras.new('HSP_interior_cam')); scene.collection.objects.link(cam)
    cam.data.clip_start = 0.02; cam.data.clip_end = 3000; cam.data.sensor_width = 36; scene.camera = cam
    for name, (eye, target, lens) in INT.VIEWS.items():
        if only and name not in only: continue
        cam.location = eye; cam.data.lens = lens
        cam.rotation_euler = (Vector(target) - Vector(eye)).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = os.path.join(out, f'{name}{"_night" if night else ""}.png')
        bpy.ops.render.render(write_still=True, scene=scene.name)
        print('RENDERED', scene.render.filepath)


if __name__ == '__main__':
    main()
