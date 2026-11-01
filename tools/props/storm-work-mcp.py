"""Run this file ONLY as execute_blender_code through the live Blender MCP.

Adds a separate editable small repair study. It never runs Blender in batch,
rewrites existing models, clears a scene or saves over the user's main file.
"""
from pathlib import Path
import bpy, bmesh, json, math
from mathutils import Vector

ROOT = Path(r'C:\Users\thisi\OneDrive\Documents\repos\flannan')
OUT = ROOT / 'artifacts/story-review/storm-mechanics/blender'
OUT.mkdir(parents=True, exist_ok=True)
before_scenes = {s.name: len(s.objects) for s in bpy.data.scenes}
before_main = bpy.data.filepath
previous_scene = bpy.context.window.scene
helpers = (ROOT / 'tools/props/room-craft-mcp.py').read_text(encoding='utf-8').split('# Chair:')[0]
helpers = helpers.replace("ROOT = Path('C:/Users/thisi/OneDrive/Documents/flannan')", 'ROOT = ROOT')
helpers = helpers.replace("OUT = ROOT/'artifacts/room-craft/blender'", 'OUT = OUT')
helpers = helpers.replace("bpy.data.scenes.new('Seven Hunters - room furniture and objects')", "bpy.data.scenes.new('Seven Hunters - storm repair working study')")
exec(compile(helpers, 'Existing authored mesh helpers via Blender MCP', 'exec'))
scene['storm_repair_working_study'] = True
scene['provenance'] = 'Authored small repair fittings; not a recovered Flannan mechanism or tool inventory.'

# Receiver ears surround the existing secured chain's first link. Their shared
# axis is the pin's Z slide. Neither the old brake nor its chain is rebuilt.
root('receiver')
for z in [-.042, .042]:
    ring('clevis eye', (0, 0, z), .024, .008, 'receiver', 'iron', (0, 0, 1), 24)
    box('clevis web', (0, -.034, z), (.048, .042, .014), 'receiver', 'iron', .002)
box('receiver foot', (0, -.060, 0), (.130, .014, .112), 'receiver', 'iron', .002)
for z in [-.043, .043]:
    screw((.023, -.052, z), 'receiver', (0, 1, 0), .004)

# Separate origins keep slide and tool turn meaningful in the editable scene.
# The head and captive pull ring remain visible from the shed's open side.
root('pin')
rod('retaining pin shank', (0, 0, -.073), (0, 0, .065), .011, 'pin', 'iron', 20)
lathe('hexagonal seating head', (0, 0, .064), [(0,0),(.018,0),(.018,.014),(0,.014)], 'pin', 'iron', 6, (0,0,1))
ring('captive head ring', (0, .014, .082), .023, .0034, 'pin', 'iron', (1,0,0), 24)
roots['pin']['working_axis_engine'] = [0,0,1]
roots['pin']['travel_metres'] = .18
roots['pin']['purpose'] = 'Withdraw worn pin, seat replacement through retaining-chain receiver.'

root('washer')
ring('seating washer', (0, 0, .060), .017, .004, 'washer', 'tin', (0,0,1), 24)

# A forged open-ended spanner. The gap is modeled, rather than painted into a
# disk. Its local origin is the working head, so rotation does not slide it off.
root('spanner')
outline = [(-.034,.028),(-.016,.028),(-.016,-.010),(.016,-.010),(.016,.028),(.034,.028),(.034,-.018),(.018,-.045),(.013,-.205),(.007,-.216),(-.007,-.216),(-.013,-.205),(-.018,-.045),(-.034,-.018)]
n = len(outline)
pts = [(x,y,z) for z in [-.004,.004] for x,y in outline]
faces = [tuple(reversed(range(n))),tuple(range(n,n*2))] + [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
bevel(mesh('open jaws and forged handle', pts, faces, 'spanner', 'tin'), .0015, 2)
roots['spanner']['working_axis_engine'] = [0,0,1]
roots['spanner']['turn_radians'] = .78

# Actual mechanical pivots and contact empties are retained in the .blend.
# The runtime reads these exported contacts; it does not invent a new pose.
contacts = {
    'pin': {'point':[0,.014,.082], 'handQuaternion':[0,0,0,1], 'pose':'pinch'},
    'spanner': {'point':[0,-.135,.008], 'handQuaternion':[0,0,math.sqrt(.5),math.sqrt(.5)], 'pose':'grip'},
    'oilCan': {'point':[-.009,.405,0], 'handQuaternion':[0,0,0,1], 'pose':'grip', 'source':'Existing RoomCraft oilCan strap handle; source geometry retained.'},
}
for name, record in contacts.items():
    e = bpy.data.objects.new('Contact / ' + name, None)
    scene.collection.objects.link(e)
    e.empty_display_type='ARROWS'; e.empty_display_size=.045
    e.location=coord(record['point'])
    if name in roots: e.parent=roots[name]
    e['contact_role']=name; e['engine_point']=record['point']
    e['hand_quaternion_xyzw']=record['handQuaternion']; e['hand_pose']=record['pose']
    q=record['handQuaternion'];e.rotation_mode='QUATERNION';e.rotation_quaternion=(q[3],q[0],-q[2],q[1])

pin = roots['pin']
for frame,z in [(1,0),(16,.18),(25,.18),(43,0),(60,0)]:
    pin.location=coord((0,0,z)); pin.keyframe_insert(data_path='location',frame=frame)
spanner = roots['spanner']
spanner.location=coord((0,0,.071))
for frame,angle in [(1,0),(43,0),(58,.78),(60,.78)]:
    # Rotation about engine +Z equals Blender -Y; keep the modeled jaw centred.
    spanner.rotation_euler=(0,-angle,0)
    spanner.keyframe_insert(data_path='rotation_euler',frame=frame)
scene.frame_start=1; scene.frame_end=60; scene.frame_set(1)

def collect():
    parts={}; deps=bpy.context.evaluated_depsgraph_get()
    for obj in list(scene.objects):
        if obj.type!='MESH' or not obj.get('model'): continue
        name=obj['model']; finish=obj['finish']
        out=parts.setdefault(name,{}).setdefault(finish,{'p':[],'n':[],'uv':[],'idx':[]})
        cache={}
        ev=obj.evaluated_get(deps); me=ev.to_mesh(); me.calc_loop_triangles()
        transform=obj.parent.matrix_world.inverted() @ ev.matrix_world
        normals=transform.to_3x3().inverted().transposed()
        for tri in me.loop_triangles:
            ps=[transform @ me.vertices[me.loops[li].vertex_index].co for li in tri.loops]
            if (ps[1]-ps[0]).cross(ps[2]-ps[0]).length<1e-12: continue
            for li in tri.loops:
                p=uncoord(transform @ me.vertices[me.loops[li].vertex_index].co)
                no=uncoord((normals @ me.corner_normals[li].vector).normalized())
                uv=(p[0]*6,p[1]*6) if abs(no[2])>.5 else (p[2]*6,p[1]*6)
                key=tuple(round(float(v),6) for v in (*p,*no,*uv))
                assert all(math.isfinite(v) for v in key)
                if key not in cache:
                    cache[key]=len(out['p'])//3;out['p'].extend(key[:3]);out['n'].extend(key[3:6]);out['uv'].extend(key[6:])
                out['idx'].append(cache[key])
        ev.to_mesh_clear()
    return parts

bpy.context.view_layer.update()
data={'parts':collect(),'contacts':contacts,'rig':{
    'receiverOffset':[-.15,.07,-.05], 'receiverFootWidth':.13, 'pinAxis':[0,0,1], 'pinTravel':.18,
    'spannerPivot':[0,0,.071], 'spannerAxis':[0,0,1], 'spannerTurn':.78,
    'benchSpanner':{'offset':[-.15,-.045,.01],'quaternion':[math.sqrt(.5),0,0,math.sqrt(.5)]},
    'benchPin':{'offset':[.20,-.038,.07],'quaternion':[0,0,0,1]},
},'finishes':{name:list(palette[name]) for name in sorted({o.get('finish') for o in scene.objects if o.type=='MESH' and o.get('model')})},'provenance':scene['provenance']}
export=ROOT/'src/world/flannan/StormWorkModel.js'
export.write_text('// GENERATED through live Blender MCP only. Metres, Y up. Editable source: tools/props/storm-work.blend.\nexport const STORM_WORK_MODEL = '+json.dumps(data,separators=(',',':'))+';\n',encoding='utf-8')

texts=[]
text=bpy.data.texts.new('storm-work-mcp.py');text.write((ROOT/'tools/props/storm-work-mcp.py').read_text(encoding='utf-8'));texts.append(text)
bpy.data.libraries.write(str(ROOT/'tools/props/storm-work.blend'),set([scene]+texts),fake_user=True,compress=True)
summary={'scene':scene.name,'export':str(export),'parts':{name:sum(len(g['idx'])//3 for g in finishes.values()) for name,finishes in data['parts'].items()},'contacts':contacts,'preserved_scenes':before_scenes,'main_file_preserved':bpy.data.filepath==before_main}
assert bpy.data.filepath==before_main
assert all(name in bpy.data.scenes and len(bpy.data.scenes[name].objects)==count for name,count in before_scenes.items())
(OUT/'export-summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')

# A small neutral study render verifies the exported assembly. It runs inside
# the same Blender MCP call, using a new camera and lights in this scene only.
camera_data=bpy.data.cameras.new('Storm fitting study camera');camera=bpy.data.objects.new('Storm fitting study camera',camera_data);scene.collection.objects.link(camera)
camera.location=coord((.42,.27,.53));camera.rotation_euler=(coord((0,-.055,0))-camera.location).to_track_quat('-Z','Y').to_euler();scene.camera=camera
camera.data.type='ORTHO';camera.data.ortho_scale=.55
world=bpy.data.worlds.new('Storm fitting study world');scene.world=world;world.color=(.11,.11,.11)
for name,at,power,size in [('key',(.4,.5,.3),70,.5),('fill',(-.3,.2,.2),35,.4)]:
    ld=bpy.data.lights.new('Storm fitting '+name,'AREA');lo=bpy.data.objects.new('Storm fitting '+name,ld);scene.collection.objects.link(lo);lo.location=coord(at);lo.rotation_euler=(-lo.location).to_track_quat('-Z','Y').to_euler();ld.energy=power;ld.shape='DISK';ld.size=size
engines={i.identifier for i in scene.render.bl_rna.properties['engine'].enum_items}
scene.render.engine='CYCLES';scene.cycles.samples=12
scene.render.resolution_x=800;scene.render.resolution_y=600;scene.render.resolution_percentage=100
for frame,name in [(1,'seated'),(24,'withdrawn'),(58,'tightened')]:
    scene.frame_set(frame);scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
scene.frame_set(1)
bpy.context.window.scene=previous_scene
print(json.dumps(summary))
