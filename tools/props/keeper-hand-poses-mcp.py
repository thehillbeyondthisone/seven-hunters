"""Author item-specific first-person grips. Execute ONLY through live Blender MCP."""
import bpy, bmesh, json, math
from pathlib import Path
from mathutils import Vector, Matrix

ROOT=Path(r'C:\Users\thisi\OneDrive\Documents\repos\flannan')
OUT=ROOT/'artifacts/keeper-hands-review/blender'
OUT.mkdir(parents=True,exist_ok=True)
original_scene=bpy.context.window.scene
original_file=bpy.data.filepath
source_text=(ROOT/'src/world/flannan/KeeperCraftModel.js').read_text(encoding='utf-8-sig')
source=json.loads(source_text.split('export const KEEPER_CRAFT_MODEL = ',1)[1].strip().rstrip(';'))
lantern_text=(ROOT/'src/station/HandLampModel.js').read_text(encoding='utf-8-sig')
lantern=json.loads(lantern_text.split('export const HAND_LAMP_MODEL = ',1)[1].strip().rstrip(';'))
scene=bpy.data.scenes.new('Seven Hunters - camera and lantern hand contact review')
scene['hand_contact_revision']='2026-11-01 / Blender MCP only'
bpy.context.window.scene=scene
materials={}
colors={'skin':(.43,.28,.20,1),'linen':(.57,.48,.39,1),'black':(.025,.031,.028,1),'leather':(.08,.06,.04,1),'tin':(.33,.36,.32,1),'slate':(.01,.02,.02,1),'red':(.15,.03,.03,1),'brass':(.36,.25,.10,1),'steel':(.24,.29,.26,1),'glass':(.18,.23,.21,.25),'flame':(1,.4,.09,1)}
def coord(p):return Vector((p[0],-p[2],p[1]))
def uncoord(p):return (p.x,p.z,-p.y)
def mat(key):
 if key not in materials:
  m=bpy.data.materials.new('Hand contacts / '+key);m.diffuse_color=colors.get(key,(.2,.2,.2,1));materials[key]=m
 return materials[key]
def basis(y,normal):
 y=Vector(y).normalized();normal=Vector(normal);normal=(normal-y*normal.dot(y)).normalized();z=-normal;x=y.cross(z).normalized()
 return Matrix((x,y,z)).transposed()
def create_mesh(name,data,parent,transform=Matrix.Identity(4),finish='skin',review=False,bone=None):
 verts=[]
 for i in range(0,len(data['p']),3):verts.append(coord(transform@Vector(data['p'][i:i+3])))
 faces=[tuple(data['idx'][i:i+3]) for i in range(0,len(data['idx']),3)]
 if transform.to_3x3().determinant()<0:faces=[tuple(reversed(face)) for face in faces]
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
 bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0000001);bm.to_mesh(mesh);bm.free();mesh.update()
 for poly in mesh.polygons:poly.use_smooth=True
 obj=bpy.data.objects.new(name,mesh);scene.collection.objects.link(obj);obj.parent=parent;obj.data.materials.append(mat(finish));obj['finish']=finish;obj['review_only']=review
 if bone:obj['hand_bone']=bone
 return obj
def part(name,prototype,parent,at,rotation=Matrix.Identity(3),scale=(1,1,1),review=False,bone=None):
 transform=Matrix.Translation(Vector(at))@rotation.to_4x4()@Matrix.Diagonal((*scale,1))
 for finish,data in source['models'][prototype]['near'].items():create_mesh(name+' / '+finish,data,parent,transform,finish,review,bone)
def root(name,offset):
 obj=bpy.data.objects.new(name,None);scene.collection.objects.link(obj);obj.location=coord(offset);return obj
def segment(name,a,b,parent,tip=False,thick=1,bone=None,normal=(0,0,-1)):
 delta=Vector(b)-Vector(a);length=delta.length
 # Nail faces away from the curled palm, preserving the short original nail.
 rotation=basis(delta,normal)
 part(name,'fingerTip' if tip else 'finger',parent,a,rotation,(thick,length/(.024 if tip else .034),thick),bone=bone)
def hand(name,side,wrist,forward,normal,paths,thumb,offset):
 obj=root(name,offset);obj['pose']=name;obj['wrist']=list(wrist)
 frame=basis(forward,normal)
 part(name+' / palm','handPalm',obj,wrist,frame,(side*.94,.96,.92),bone='wrist')
 bones=[('wrist',Vector(wrist),Vector(wrist)+frame@Vector((0,.078,0)),None)]
 for i,path in enumerate(paths):
  for j in range(3):
   bn=f'finger{i}.{j}';segment(name+' / '+bn,path[j],path[j+1],obj,j==2,1-i*.045,bn,normal);bones.append((bn,Vector(path[j]),Vector(path[j+1]),'wrist' if j==0 else f'finger{i}.{j-1}'))
 for j in range(2):
  bn=f'thumb.{j}';segment(name+' / '+bn,thumb[j],thumb[j+1],obj,j==1,1.13,bn,normal);bones.append((bn,Vector(thumb[j]),Vector(thumb[j+1]),'wrist' if j==0 else 'thumb.0'))
 arm=bpy.data.armatures.new(name+' / editable joints');rig=bpy.data.objects.new(name+' / contact rig',arm);scene.collection.objects.link(rig);rig.parent=obj;rig['review_only']=True
 bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
 for bn,a,b,parent in bones:
  bone=arm.edit_bones.new(bn);bone.head=coord(a);bone.tail=coord(b)
  if parent:bone.parent=arm.edit_bones[parent]
 bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
 for child in list(obj.children):
  if child.type!='MESH' or not child.get('hand_bone'):continue
  group=child.vertex_groups.new(name=child['hand_bone']);group.add(list(range(len(child.data.vertices))),1,'REPLACE')
  modifier=child.modifiers.new('Editable anatomical contact','ARMATURE');modifier.object=rig
 return obj
def camera_paths(side):
 paths=[]
 for i in range(4):
  y=.064-i*.018;factor=[1,.99,.93,.79][i]
  z=.003+(1-factor)*.065
  paths.append([(side*.062,y,z),(side*.061,y,z+.031*factor),(side*.060,y,z+.056*factor),(side*.039,y,z+.065*factor)])
 return paths
def camera_thumb(side):return [(side*.061,.068,-.050),(side*.046,.073,-.076),(side*.021,.066,-.077)]
poses={}
left_ready=camera_paths(1)
left_ready[0]=[(.061,.064,.003),(.053,.082,.029),(.037,.087,.045),(.029,.086,.046)]
left_press=[list(path) for path in left_ready];left_press[0]=[(.061,.064,.003),(.053,.080,.029),(.037,.083,.045),(.029,.082,.046)]
for name,paths,y in [('cameraLeft',left_ready,0),('cameraLeftShutter',left_press,1)]:
 poses[name]=hand(name,-1,(.062,.035,-.075),(0,0,1),(-1,0,0),paths,camera_thumb(1),(-.45,y*.45,0))
poses['cameraRight']=hand('cameraRight',1,(-.062,.035,-.075),(0,0,1),(1,0,0),camera_paths(-1),camera_thumb(-1),(0,0,0))
wind_paths=camera_paths(-1)
for i in range(1,4):
 y=.064-i*.018
 wind_paths[i]=[(-.090,y,-.015),(-.091,y,.015),(-.080,y,.020),(-.075,y,-.002)]
wind_paths[0]=[(-.083,.047,-.043),(-.074,.059,-.023),(-.063,.055,-.027),(-.058,.048,-.032)]
poses['cameraRightWind']=hand('cameraRightWind',1,(-.090,.032,-.097),(0,0,1),(1,0,0),wind_paths,[(-.084,.015,-.051),(-.071,.019,-.035),(-.058,.025,-.032)],(.45,0,0))
lantern_paths=[]
for i in range(4):
 x=(i-1.5)*.018;bar=.220+.097*math.sqrt(1-(x/.085)**2)
 lantern_paths.append([(x,bar+.034,.025),(x,bar+.012,-.003),(x,bar-.010,.005),(x,bar-.001,.025)])
poses['lanternBail']=hand('lanternBail',1,(0,.355,.105),(0,0,-1),(0,-1,0),lantern_paths,[(-.032,.340,.052),(-.026,.326,.033),(-.008,.320,.018)],(.9,0,0))

# Exact existing equipment is retained as non-exported context for contact QA.
for name,obj in poses.items():
 if name.startswith('camera'):
  part(name+' / Brownie context','brownie',obj,(0,0,0),review=True)
  part(name+' / key context','brownieKey',obj,(-.043,.037,-.032),review=True)
  part(name+' / shutter context','brownieShutter',obj,(.029,.078,.046),review=True)
 else:
  for finish,data in lantern.items():create_mesh(name+' / lantern context / '+finish,data,obj,finish=finish,review=True)

bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();export={}
for name,obj in poses.items():
 finishes={};cache={}
 for child in obj.children:
  if child.type!='MESH' or child.get('review_only'):continue
  finish=child['finish'];g=finishes.setdefault(finish,{'p':[],'n':[],'uv':[],'idx':[]});indices=cache.setdefault(finish,{})
  ev=child.evaluated_get(deps);mesh=ev.to_mesh();mesh.calc_loop_triangles()
  transform=obj.matrix_world.inverted()@ev.matrix_world;nm=transform.to_3x3().inverted().transposed()
  for tri in mesh.loop_triangles:
   for li in tri.loops:
    p=uncoord(transform@mesh.vertices[mesh.loops[li].vertex_index].co);n=uncoord((nm@mesh.corner_normals[li].vector).normalized())
    values=tuple(round(float(v),6) for v in (*p,*n,p[0]/.06,p[1]/.06))
    if values not in indices:
     indices[values]=len(g['p'])//3;g['p'].extend(values[:3]);g['n'].extend(values[3:6]);g['uv'].extend(values[6:])
    g['idx'].append(indices[values])
  ev.to_mesh_clear()
 export[name]={'finishes':finishes,'wrist':list(obj['wrist'])}

attachments={'camera':{'eyeOffset':[.015,-.245,-.43],'rotationY':math.pi,'key':[-.043,.037,-.032],'shutter':[.029,.078,.046],'shutterTravel':.0015,'lens':[0,.0381,.069],'windAngle':.65,'windSeconds':.8},
 'braced':{'tablePosition':[-5.2,.756,2.95],'chairTarget':[-6.5,.65,-.2]},
 'forearm':{'maxPresentationReach':2.0,'length':.28,'shoulderOffset':[.32,-.55,.03]},'transitionSeconds':.24,'transitionDrop':.16}
support_anchor=root('Brownie supported table camera attachment',attachments['braced']['tablePosition']);support_anchor['game_target']=attachments['braced']['chairTarget'];support_anchor.empty_display_type='ARROWS'
data={'poses':export,'attachments':attachments,'provenance':'Item-specific hand contacts authored and exported through live Blender MCP; source equipment and every existing scene retained.'}
path=ROOT/'src/world/flannan/KeeperHandPosesModel.js'
if path.exists() and not (OUT/'initial-poses.js').exists():(OUT/'initial-poses.js').write_bytes(path.read_bytes())
path.write_text('// GENERATED through live Blender MCP. Item-local metres, Y up.\nexport const KEEPER_HAND_POSES = '+json.dumps(data,separators=(',',':'))+';\n',encoding='utf-8')
text=bpy.data.texts.new('keeper-hand-poses-mcp.py');text.write((ROOT/'tools/props/keeper-hand-poses-mcp.py').read_text(encoding='utf-8'))
bpy.data.libraries.write(str(ROOT/'tools/props/keeper-hand-poses.blend'),{scene,text},fake_user=True,compress=True)
summary={'scene':scene.name,'poses':{name:sum(len(g['idx'])//3 for g in item['finishes'].values()) for name,item in export.items()},'export':str(path),'originalScene':original_scene.name,'originalFile':original_file,'modelsRetained':True}
(OUT/'export-summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
bpy.context.window.scene=original_scene
assert bpy.data.filepath==original_file
print(json.dumps(summary))
