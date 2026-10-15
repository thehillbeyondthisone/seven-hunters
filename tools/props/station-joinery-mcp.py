"""Run through the live Blender MCP. Keep the user's original scene intact.

Crafted reconstruction for Seven Hunters, not measured original Flannan fittings.
Coordinates in the authoring helpers are metres, engine Y up, leaf along +X.
"""
import bpy, math, json, bmesh
from pathlib import Path
from mathutils import Vector

ROOT = Path('C:/Users/thisi/OneDrive/Documents/flannan')
OUT = ROOT / 'artifacts/prop-quality/blender'
OUT.mkdir(parents=True, exist_ok=True)
original = bpy.data.scenes.get(bpy.context.scene.get('original_scene','')) or bpy.context.scene
scene = bpy.data.scenes.new('Seven Hunters - crafted station joinery')
scene['original_scene'] = original.name
scene['provenance'] = 'Blender MCP authored period-plausible reconstruction; hardware patterns unverified.'
bpy.context.window.scene = scene
scene.unit_settings.system = 'METRIC'
roots, materials = {}, {}

def coord(v): return Vector((v[0], -v[2], v[1]))
def uncoord(v): return (v[0], v[2], -v[1])

for key, color, metal, rough in [
    ('paint', (.086,.122,.081,1), 0, .55),
    ('panel', (.080,.114,.075,1), 0, .58),
    ('iron', (.035,.040,.038,1), .65, .46),
    ('brass', (.40,.27,.105,1), .85, .33),
    ('concrete', (.39,.40,.37,1), 0, .88),
]:
    m=bpy.data.materials.new('Station craft / '+key); m.use_nodes=True; m.diffuse_color=color
    bs=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    bs.inputs['Base Color'].default_value=color
    bs.inputs['Metallic'].default_value=metal; bs.inputs['Roughness'].default_value=rough
    materials[key]=m

def root(name, at, review_hidden=False):
    o=bpy.data.objects.new(name+' / origin',None); scene.collection.objects.link(o)
    o.location=coord(at); o['model']=name; roots[name]=o
    o['review_hidden']=review_hidden

root('interiorDoor',(-2.35,0,0))
for name in ['doorHinge','doorKnob','gateHinge','gateLatch','gateCatch']:
    root(name,(0,0,0),True)
root('entranceSteps',(1.55,0,.05))

def register(obj, name, model, finish, grain='vertical'):
    obj.name=model+' / '+name; obj.parent=roots[model]
    obj['model']=model; obj['finish']=finish; obj['grain']=grain
    obj.data.materials.append(materials[finish])
    if roots[model]['review_hidden']: obj.hide_render=True; obj.hide_viewport=True
    return obj

def box(name, at, size, model, finish, edge=.0015, grain='vertical'):
    bpy.ops.mesh.primitive_cube_add(size=1,location=coord(at)); o=bpy.context.object
    o.scale=(size[0],size[2],size[1]); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    register(o,name,model,finish,grain)
    if edge:
        bevel=o.modifiers.new('Crafted edge','BEVEL'); bevel.width=edge; bevel.segments=2 if finish=='concrete' else 1
        normal=o.modifiers.new('Broad face normals','WEIGHTED_NORMAL'); normal.keep_sharp=True
    return o

def cylinder(name, at, radius, length, model, finish, axis=(0,0,1), segs=16):
    direction=coord(axis).normalized()
    bpy.ops.mesh.primitive_cylinder_add(vertices=segs,radius=radius,depth=length,location=coord(at))
    o=bpy.context.object; o.rotation_euler=Vector((0,0,1)).rotation_difference(direction).to_euler()
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    register(o,name,model,finish)
    bevel=o.modifiers.new('Turned rim','BEVEL'); bevel.width=min(.0008,length*.12); bevel.segments=1
    normal=o.modifiers.new('Broad face normals','WEIGHTED_NORMAL'); normal.keep_sharp=True
    return o

def screw(at, model, finish='iron', radius=.003, side=-1):
    cylinder('slotted screw',at,radius,.0025,model,finish,segs=12)
    # Recessed-looking slot lies on the exposed head face, not through the plate.
    box('screw slot',(at[0],at[1],at[2]+side*.0014),(radius*1.35,.0007,.0003),model,'iron',0)

def hinge(model,y,gate=False):
    if gate:
        box('forged strap',(.207,y,-.031),(.374,.045,.009),model,'iron',.002, 'horizontal')
        # Tapered end is a closed bevelled solid, rather than a floating flat rectangle.
        box('strap end',(.391,y,-.031),(.035,.033,.009),model,'iron',.006)
        for x in [.07,.205,.335]:
            cylinder('coach bolt head',(x,y,-.038),.008,.006,model,'iron',segs=6)
        radius,height=.023,.13
    else:
        for side in [-1,1]:
            box('hinge leaf',(.028,y,side*.024),(.047,.095,.004),model,'iron',.001)
            for dy in [-.032,.032]: screw((.034,y+dy,side*.027),model,side=side)
        radius,height=.0105,.104
    for i in range(5):
        cylinder('hinge knuckle',(0,y+(i-2)*height/5,0),radius,height/5-.001,model,'iron',axis=(0,1,0),segs=16)
    for dy in [-height*.55,height*.55]:
        cylinder('pin head',(0,y+dy,0),radius*1.13,.006,model,'iron',axis=(0,1,0),segs=16)

def knob(model,x,y):
    for side in [-1,1]:
        cylinder('backplate rose',(x,y,side*.025),.027,.006,model,'brass',segs=20)
        cylinder('spindle collar',(x,y,side*.037),.009,.022,model,'brass',segs=16)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=10,radius=1,location=coord((x,y,side*.059)))
        o=bpy.context.object; o.scale=(.024,.016,.024)
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        register(o,'turned brass knob',model,'brass')
        for p in o.data.polygons: p.use_smooth=True
        for dy in [-.019,.019]: screw((x,y+dy,side*.030),model,'brass',.0023,side)
        box('key escutcheon',(x,y-.095,side*.025),(.022,.039,.005),model,'brass',.005)
        cylinder('keyhole',(x,y-.089,side*.028),.003,.0008,model,'iron',segs=10)
        box('keyhole slot',(x,y-.098,side*.0285),(.003,.011,.0007),model,'iron',0)
    box('mortice faceplate',(x+.096,y-.012,0),(.002,.15,.034),model,'brass',.0005)

# Working kitchen and berth leaves. Thin inset panels sit within true stiles/rails.
for x,w in [(.055,.11),(.56,.068),(1.065,.11)]:
    box('vertical stile',(x,1.04,0),(w,2.08,.045),'interiorDoor','paint',.0025)
for y,h in [(.065,.13),(.90,.13),(2.025,.11)]:
    for x in [.318,.802]:
        box('horizontal rail',(x,y,0),(.416,h,.045),'interiorDoor','paint',.0025,'horizontal')
for x in [.319,.801]:
    for y,h in [(.4825,.705),(1.4675,1.005)]:
        w=.414
        box('recessed panel',(x,y,0),(w,h,.022),'interiorDoor','panel',.002)
        field=box('raised panel field',(x,y,0),(w-.075,h-.075,.035),'interiorDoor','panel',.012)
        field.modifiers[0].segments=2
        for side in [-1,1]:
            # Continuous mitred moulding, with a rounded bead and a broad cove.
            profile=[(0,.0225),(.004,.025),(.009,.024),(.014,.018),(.023,.012)]
            points=[coord((x+sx*(w/2-inset),y+sy*(h/2-inset),side*depth)) for inset,depth in profile for sx,sy in [(-1,-1),(1,-1),(1,1),(-1,1)]]
            faces=[(j*4+i,j*4+(i+1)%4,(j+1)*4+(i+1)%4,(j+1)*4+i) for j in range(len(profile)-1) for i in range(4)]
            me=bpy.data.meshes.new('Mitred panel moulding'); me.from_pydata(points,[],faces); me.update()
            bm=bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(me); bm.free()
            if side<0:
                bm=bmesh.new(); bm.from_mesh(me); bmesh.ops.reverse_faces(bm,faces=list(bm.faces)); bm.to_mesh(me); bm.free()
            o=bpy.data.objects.new('Mitred panel moulding',me); scene.collection.objects.link(o); register(o,'mitred cove moulding','interiorDoor','paint')
for y in [.25,1.04,1.83]: hinge('interiorDoor',y)
knob('interiorDoor',1.015,.98)
hinge('doorHinge',0)
knob('doorKnob',0,0)
hinge('gateHinge',0,True)

# Gate latch and separate catch: the two gate leaves receive different fittings.
box('latch mounting plate',(-.075,0,-.032),(.16,.115,.008),'gateLatch','iron',.004)
for x in [-.13,-.02]:
    for y in [-.036,.036]: screw((x,y,-.039),'gateLatch',radius=.004)
cylinder('latch pivot',(-.09,0,-.046),.013,.015,'gateLatch','iron',segs=16)
box('latch bar',(-.015,.014,-.047),(.25,.022,.012),'gateLatch','iron',.004,'horizontal')
box('thumb lift',(-.09,-.035,-.064),(.025,.09,.013),'gateLatch','iron',.005)
box('catch plate',(0,0,-.032),(.09,.10,.009),'gateCatch','iron',.004)
for y in [-.032,.032]: screw((0,y,-.040),'gateCatch',radius=.004)
box('catch lip',(0,.006,-.052),(.032,.035,.032),'gateCatch','iron',.003)

# Existing entrance envelope: lower top .225, upper .44, front edge .72 from wall.
box('lower cast step',(0,-.0375,.36),(1.8,.525,.72),'entranceSteps','concrete',.006,'horizontal')
box('upper cast step',(0,.3325,.18),(1.5,.215,.36),'entranceSteps','concrete',.006,'horizontal')

# Review-only gate uses the same prototypes; it is never exported as a new game gate.
review=bpy.data.objects.new('Review gate / origin',None); scene.collection.objects.link(review); review.location=coord((1.4,0,.1)); review.rotation_euler.z=math.pi
for i in range(10):
    o=box('Review gate board',((i+.5)*.166-.0,.85,.1),(.164,1.4,.045),'interiorDoor','paint',.0015)
    o.parent=review; o['review_only']=True
for y in [.35,1.35]:
    o=box('Review gate ledge',(.83,y,.14),(1.58,.12,.03),'interiorDoor','paint',.002,'horizontal')
    o.parent=review; o['review_only']=True
for key,at in [('gateHinge',(0,.35,.1)),('gateHinge',(0,1.35,.1)),('gateLatch',(1.61,.94,.1))]:
    for source in list(roots[key].children):
        o=source.copy(); o.data=source.data; scene.collection.objects.link(o); o.parent=review
        o.location=source.location+coord(at); o.hide_render=False; o.hide_viewport=False; o['review_only']=True

# Export evaluated triangles with split corner normals, physical UVs and grain direction.
bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get(); data={}; caches={}
for obj in list(scene.objects):
    if obj.type!='MESH' or obj.get('review_only'): continue
    model=obj['model']; finish=obj['finish']; grain=obj['grain']
    key=finish+'/'+grain; out=data.setdefault(model,{}).setdefault(key,{'p':[],'n':[],'uv':[],'idx':[]})
    evaluated=obj.evaluated_get(deps); mesh=evaluated.to_mesh(); mesh.calc_loop_triangles()
    transform=obj.parent.matrix_world.inverted() @ evaluated.matrix_world
    normal_matrix=transform.to_3x3().inverted().transposed(); cache=caches.setdefault((model,key),{})
    for tri in mesh.loop_triangles:
        points=[transform @ mesh.vertices[mesh.loops[i].vertex_index].co for i in tri.loops]
        if (points[1]-points[0]).cross(points[2]-points[0]).length<1e-12: continue
        for li in tri.loops:
            p=uncoord(transform @ mesh.vertices[mesh.loops[li].vertex_index].co)
            n=uncoord((normal_matrix @ mesh.corner_normals[li].vector).normalized())
            if abs(n[1])>.5: uv=(p[0],p[2])
            elif abs(n[0])>.5: uv=(p[1],p[2]) if grain=='vertical' else (p[2],p[1])
            else: uv=(p[1],p[0]) if grain=='vertical' else (p[0],p[1])
            values=tuple(round(float(v),6) for v in (*p,*n,*uv))
            if values not in cache:
                cache[values]=len(out['p'])//3; out['p'].extend(values[:3]); out['n'].extend(values[3:6]); out['uv'].extend(values[6:])
            out['idx'].append(cache[values])
    evaluated.to_mesh_clear()
path=ROOT/'src/world/flannan/StationCraftModel.js'
path.write_text('// GENERATED through Blender MCP from tools/props/station-joinery.blend.\n// Metres, Y up; door hinge at origin, leaf along +X. Reconstruction.\nexport const STATION_CRAFT_MODEL = '+json.dumps(data,separators=(',',':'))+';\n',encoding='utf-8')
counts={name:sum(len(g['idx'])//3 for g in batches.values()) for name,batches in data.items()}
(OUT/'export-summary.json').write_text(json.dumps({'triangles':counts,'original_scene':original.name,'source':str(path)},indent=2))

# Studio scene contains only this pass; no original user's scene is saved or modified.
world=bpy.data.worlds.new('Station joinery studio'); world.use_nodes=True; scene.world=world
background=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND')
background.inputs[0].default_value=(.15,.18,.20,1); background.inputs[1].default_value=.5
for label,at,power,size in [('Key',(-3,4,4),700,4),('Fill',(4,3,3),450,3),('Rim',(0,4,-2),500,3)]:
    light=bpy.data.lights.new(label,'AREA'); light.energy=power; light.size=size
    obj=bpy.data.objects.new(label,light); scene.collection.objects.link(obj); obj.location=coord(at)
    obj.rotation_euler=(coord((0,1,0))-obj.location).to_track_quat('-Z','Y').to_euler()
camera=bpy.data.cameras.new('Craft review camera'); camera.type='ORTHO'; camera.ortho_scale=6.3
obj=bpy.data.objects.new('Craft review camera',camera); scene.collection.objects.link(obj); obj.location=coord((3,3.0,8))
obj.rotation_euler=(coord((0,1.0,0))-obj.location).to_track_quat('-Z','Y').to_euler(); scene.camera=obj
scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.use_denoising=True
scene.render.resolution_x=1500; scene.render.resolution_y=900; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(OUT/'station-joinery.png')
text=bpy.data.texts.new('station-joinery-mcp.py'); text.write((ROOT/'tools/props/station-joinery-mcp.py').read_text(encoding='utf-8'))
bpy.data.libraries.write(str(ROOT/'tools/props/station-joinery.blend'),{scene,text},fake_user=True,compress=True)
print(json.dumps({'scene':scene.name,'preserved_scene':original.name,'triangles':counts,'exported':str(path)}))
