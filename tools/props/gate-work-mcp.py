"""Execute exclusively through the live Blender MCP execute_blender_code tool."""
import bpy, math, json, shutil
from pathlib import Path
from mathutils import Vector

ROOT = Path('C:/Users/thisi/OneDrive/Documents/repos/flannan')
OUT = ROOT / 'artifacts/story-review/gate/blender'
OUT.mkdir(parents=True, exist_ok=True)
previous_scene = bpy.context.window.scene
previous_active = bpy.context.view_layer.objects.active
previous_selected = list(bpy.context.selected_objects)
previous_frame = previous_scene.frame_current
original_file = bpy.data.filepath
scene = bpy.data.scenes.new('Seven Hunters - rope-secured gates review')
scene['provenance'] = 'Authored reconstruction of quick rope wraps and matching station gates. Not recovered Flannan hardware.'
bpy.context.window.scene = scene
scene.unit_settings.system = 'METRIC'
objects = {}

def xyz(v): return Vector((v[0], -v[2], v[1]))
def engine(v): return [round(v.x,6),round(v.z,6),round(-v.y,6)]
def finish(obj, key):
    obj['finish'] = key
    return obj
def box(name, at, size, key='paint'):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz(at))
    obj=bpy.context.object;obj.name=name
    obj.dimensions=(size[0],size[2],size[1])
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    bevel=obj.modifiers.new('soft weathered edges','BEVEL');bevel.width=.004;bevel.segments=2
    finish(obj,key);return obj
def curve(name, pts, radius=.012, closed=False, key='rope'):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.bevel_depth=radius;data.bevel_resolution=2;data.resolution_u=8
    spline=data.splines.new('BEZIER');spline.bezier_points.add(len(pts)-1)
    for b,p in zip(spline.bezier_points,pts):b.co=xyz(p);b.handle_left_type=b.handle_right_type='AUTO'
    spline.use_cyclic_u=closed
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);finish(obj,key);return obj
def beam(name,a,b,width=.09,depth=.03):
    aa,bb=xyz(a),xyz(b);mid=(aa+bb)/2
    obj=box(name,(mid.x,mid.z,-mid.y),(width,(bb-aa).length,depth))
    obj.rotation_mode='QUATERNION';obj.rotation_quaternion=Vector((0,0,1)).rotation_difference((bb-aa).normalized());return obj

try:
    leaf=[]
    for i in range(9):leaf.append(box('South gate board %02d'%i,((i+.5)*1.68/9,.85,0),(1.68/9-.008,1.4,.045)))
    for y in [.35,1.35]:
        leaf.append(box('South gate ledge',( .84,y,-.045),(1.60,.12,.035)))
        leaf.append(box('South gate iron hinge',(.12,y,-.075),(.25,.045,.018),'iron'))
    leaf.append(beam('South gate diagonal brace',(.10,.40,-.045),(1.58,1.30,-.045)))
    objects['southLeaf']=leaf
    wraps=[]
    for y in [.94,.977]:
        wraps.append(curve('Quick rope wrap', [(-.125,y,-.082),(.125,y,-.082),(.125,y,.082),(-.125,y,.082)], .013, True))
    wraps.append(curve('Rope crossing',[(-.125,.977,-.09),(.12,.94,-.09),(.04,.90,-.095)],.013))
    wraps.append(curve('Short rope end',[(.04,.90,-.095),(.08,.79,-.10),(.02,.72,-.10)],.012))
    wraps.append(curve('Tucked rope bight',[(0,.94,.09),(.11,.88,.10),(.14,.82,.10),(.05,.84,.10)],.012))
    objects['wrapped']=wraps
    ready=[]
    for i in range(3):
        ready.append(curve('Rope ready on gatepier', [(-1.73,.96,-.08-i*.022),(-1.62,.89,-.08-i*.022),(-1.58,.60,-.08-i*.022),(-1.68,.53,-.08-i*.022),(-1.78,.65,-.08-i*.022)],.012,True))
    objects['ready']=ready
    model={}
    deps=bpy.context.evaluated_depsgraph_get()
    for name, sources in objects.items():
        groups={}
        for obj in sources:
            evaluated=obj.evaluated_get(deps);mesh=evaluated.to_mesh();mesh.calc_loop_triangles()
            key=obj['finish'];g=groups.setdefault(key,{'p':[],'n':[],'uv':[],'idx':[]})
            matrix=obj.matrix_world;normal_matrix=matrix.to_3x3().inverted().transposed()
            for triangle in mesh.loop_triangles:
                for vertex_index in triangle.vertices:
                    vertex=mesh.vertices[vertex_index]
                    p=matrix@vertex.co
                    n=(normal_matrix@(vertex.normal if mesh.polygons[triangle.polygon_index].use_smooth else triangle.normal)).normalized()
                    index=len(g['p'])//3
                    g['p']+=engine(p);g['n']+=engine(n);g['uv'] += [round(p.x*.1,6),round(p.z*.1,6)];g['idx'].append(index)
            evaluated.to_mesh_clear()
        model[name]=groups
    target=ROOT/'src/world/flannan/GateWorkModel.js'
    if target.exists():shutil.copy2(target,OUT/'GateWorkModel-before.js')
    payload={'models':model,'contacts':{'wrap':[0,.965,-.09]},'provenance':scene['provenance'],'authoring':'live Blender MCP'}
    target.write_text('// Generated through live Blender MCP; edit gate-work-mcp.py through MCP.\nexport const GATE_WORK_MODEL = '+json.dumps(payload,separators=(',',':'))+';\n',encoding='utf-8')
    bpy.data.libraries.write(str(OUT/'rope-gates.blend'),{scene},fake_user=True)
    summary={name:sum(len(g['idx'])//3 for g in groups.values()) for name,groups in model.items()}
    (OUT/'manifest.json').write_text(json.dumps({'triangles':summary,'main_file_unchanged':bpy.data.filepath==original_file,'provenance':scene['provenance']},indent=2),encoding='utf-8')
    # Model placement and moving gate build-out are also integrated through MCP.
    station=ROOT/'src/world/flannan/Station.js'
    text=station.read_text(encoding='utf-8')
    if "from './GateWorkProps.js'" not in text:
        shutil.copy2(station,OUT/'Station-before.js')
        text="import { gateWorkPart } from './GateWorkProps.js';\n"+text
        anchor='\n}\n\n// ------------------------------------------------------------------ the landings'
        insert="""
    // The west tramway has its own physical gate. Earlier interaction code
    // accidentally drove the second leaf of the east gate from this opening.
    for (const [hx,ry,swing] of [[sg.x-sg.w/2,0,-1.45],[sg.x+sg.w/2,Math.PI,1.45]]) {
        parts.doors.push(door(ctx,{name:'southGate',hinge:new Vector3(hx,Y0,sg.z),ry,swing,width:gl,height:gh+.2,leaf:L=>gateWorkPart(L,'southLeaf')}));
    }
"""
        if anchor not in text:raise RuntimeError('Station gate integration anchor absent')
        text=text.replace(anchor,'\n'+insert+anchor,1)
        station.write_text(text,encoding='utf-8')
    print(json.dumps({'export':str(target),'triangles':summary,'scene':scene.name,'main_file_unchanged':bpy.data.filepath==original_file}))
finally:
    bpy.context.window.scene=previous_scene
    previous_scene.frame_set(previous_frame)
    for obj in bpy.context.selected_objects:obj.select_set(False)
    for obj in previous_selected:
        if obj.name in previous_scene.objects:obj.select_set(True)
    if previous_active and previous_active.name in previous_scene.objects:bpy.context.view_layer.objects.active=previous_active
