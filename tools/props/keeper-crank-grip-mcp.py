"""A measured winding-crank contact. Execute ONLY through live Blender MCP."""
from pathlib import Path
import json
ROOT=Path(r'C:\Users\thisi\OneDrive\Documents\repos\flannan')
helpers=(ROOT/'tools/props/keeper-hand-poses-mcp.py').read_text(encoding='utf-8').split('poses={}')[0]
helpers=helpers.replace('Seven Hunters - camera and lantern hand contact review','Seven Hunters - winding crank hand contact')
exec(compile(helpers,'existing Blender hand authoring helpers','exec'))
centre=Vector((0,.22,.10))
paths=[]
for i in range(4):
 z=.129-i*.019
 paths.append([tuple(Vector(point)-centre) for point in[(.046,.241,z),(.017,.259,z),(-.018,.251,z),(-.031,.227,z)]])
thumb=[tuple(Vector(point)-centre) for point in[(.050,.187,.132),(.025,.183,.153),(-.002,.197,.154)]]
grip=hand('crankGrip',1,tuple(Vector((.055,.155,.10))-centre),(0,1,0),(-1,0,0),paths,thumb,(0,0,0))
part('Actual winding crank reference','crank',grip,tuple(-centre),review=True)
attachment={'point':list(centre),'quaternion':[0,0,0,1],'freeSpinningGrip':True,'axis':[0,0,1],'radius':.029}
marker=bpy.data.objects.new('Winding handle contact / free spinning grip',None);scene.collection.objects.link(marker);marker.empty_display_type='ARROWS';marker.empty_display_size=.05
marker['engine_attachment']=json.dumps(attachment);marker['existing_handle_axis']='crank-local +Z'
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();finishes={};caches={}
for child in grip.children:
 if child.type!='MESH' or child.get('review_only'):continue
 finish=child['finish'];out=finishes.setdefault(finish,{'p':[],'n':[],'uv':[],'idx':[]});cache=caches.setdefault(finish,{})
 ev=child.evaluated_get(deps);mesh=ev.to_mesh();mesh.calc_loop_triangles();transform=grip.matrix_world.inverted()@ev.matrix_world;nm=transform.to_3x3().inverted().transposed()
 for tri in mesh.loop_triangles:
  for li in tri.loops:
   point=uncoord(transform@mesh.vertices[mesh.loops[li].vertex_index].co);normal=uncoord((nm@mesh.corner_normals[li].vector).normalized());values=tuple(round(float(v),6) for v in(*point,*normal,point[0]/.06,point[1]/.06))
   if values not in cache:cache[values]=len(out['p'])//3;out['p'].extend(values[:3]);out['n'].extend(values[3:6]);out['uv'].extend(values[6:])
   out['idx'].append(cache[values])
 ev.to_mesh_clear()
model_path=ROOT/'src/world/flannan/KeeperHandPosesModel.js'
data=json.loads(model_path.read_text(encoding='utf-8').split('export const KEEPER_HAND_POSES = ',1)[1].strip().rstrip(';'))
prior=json.dumps(data['poses'],sort_keys=True)
data['poses']['crankGrip']={'finishes':finishes,'wrist':list(grip['wrist'])};data['attachments']['crank']=attachment
assert prior==json.dumps({key:value for key,value in data['poses'].items() if key!='crankGrip'},sort_keys=True)
model_path.write_text('// GENERATED through live Blender MCP. Item-local metres, Y up.\nexport const KEEPER_HAND_POSES = '+json.dumps(data,separators=(',',':'))+';\n',encoding='utf-8')
source=bpy.data.texts.new('keeper-crank-grip-mcp.py');source.write((ROOT/'tools/props/keeper-crank-grip-mcp.py').read_text(encoding='utf-8'))
bpy.data.libraries.write(str(ROOT/'tools/props/keeper-crank-grip.blend'),{scene,source},fake_user=True,compress=True)
summary={'pose':'crankGrip','triangles':sum(len(g['idx'])//3 for g in finishes.values()),'attachment':attachment,'priorFiveMeshesUnchanged':True,'retainedMainScene':original_scene.name,'retainedMainFile':original_file}
(OUT/'crank-contact-verification.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
bpy.context.window.scene=original_scene
assert bpy.data.filepath==original_file
print(json.dumps(summary))
