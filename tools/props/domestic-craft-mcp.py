"""Seven Hunters domestic mechanisms. Execute ONLY through live Blender MCP.

Reuses the existing authored kettle, cup and jug; adds a loaf split and liquid
parts. Independent origins, work poses and hand contacts are editable empties.
This is a fictional station reconstruction, not a recovered historical inventory.
"""
import bpy, bmesh, math, json, re
from pathlib import Path
from mathutils import Vector, Quaternion

ROOT=Path(r'C:\Users\thisi\OneDrive\Documents\repos\flannan')
OUT=ROOT/'artifacts/domestic-craft/blender'
OUT.mkdir(parents=True,exist_ok=True)
previous_scene=bpy.context.window.scene
source=(ROOT/'tools/props/room-craft-mcp.py').read_text(encoding='utf-8')
helpers=source.split('# Chair:')[0]
helpers=re.sub(r"ROOT = Path\([^\n]+\)", 'ROOT = ROOT', helpers)
helpers=helpers.replace("OUT = ROOT/'artifacts/room-craft/blender'", "OUT = ROOT/'artifacts/domestic-craft/blender'")
helpers=helpers.replace("Seven Hunters - room furniture and objects", "Seven Hunters - domestic work mechanisms")
exec(compile(helpers,'retained room furnishing author helpers','exec'))
scene['domestic_mechanisms']=True
scene['source_scene_retained']=previous_scene.name
scene['provenance']='Existing room-craft kettle, cup and jug reused; new split bread, liquid parts, pivots and work contacts authored through live Blender MCP.'
exec(compile(source[source.index("root('kettle'"):source.index("root('tin'")],'retained authored kettle cup jug','exec'))

# A removable kettle lid and its origin remain independent of the vessel.
root('kettleLid',(4,0,0))
for o in list(roots['kettle'].children):
 if 'lid' in o.name:
  o.parent=roots['kettleLid'];o['model']='kettleLid'

for key,color,rough in [('breadCrust',(.39,.225,.085),.91),('breadCrumb',(.68,.53,.29),.97),('water',(.26,.37,.39),.21),('tea',(.115,.052,.014),.24)]:
 m=bpy.data.materials.new('Domestic / '+key);m.use_nodes=True
 bs=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough
 m.diffuse_color=(*color,1);mats[key]=m

# The loaf is two independently pivoted pieces with an irregular torn face.
def loaf_piece(name,start,end):
 root(name,(0,0,0));pts=[];N=24;S=40
 for i in range(N+1):
  x=start+(end-start)*i/N;r=max(.02,math.sqrt(max(0,1-(x/.19)**2)))
  for j in range(S):
   a=j/S*math.tau;rough=1+.025*math.sin(j*2.7+i*.8)+.015*math.sin(j*4.1-i*.9)
   pts.append((x,max(.002,.067+.067*math.cos(a)*r*rough),.119*math.sin(a)*r*rough))
 faces=[(i*S+j,i*S+(j+1)%S,(i+1)*S+(j+1)%S,(i+1)*S+j) for i in range(N) for j in range(S)]
 mesh('baked crust',pts,faces,name,'breadCrust',True)
 for x in [start,end]:
  r=max(.02,math.sqrt(max(0,1-(x/.19)**2)))
  ringpts=[(x,.067+.062*math.cos(j/S*math.tau)*r,.114*math.sin(j/S*math.tau)*r) for j in range(S)]
  mesh('torn crumb face',[(x,.067,0)]+ringpts,[(0,1+j,1+(j+1)%S) for j in range(S)],name,'breadCrumb',True)
 for k in range(7):
  x=start+(end-start)*(.12+k*.12)
  y=.067+.061*math.sqrt(max(0,1-(x/.19)**2))
  tube('rough top scoring',[(x-.015,y+.001,-.07),(x,y+.004,0),(x+.015,y+.001,.07)],.0016,name,'breadCrumb',5)
loaf_piece('breadMain',-.189,.10)
loaf_piece('breadPiece',.10,.189)
root('waterStream');rod('pouring water',(0,0,0),(0,-1,0),.0038,'waterStream','water',8)
root('teaStream');rod('pouring tea',(0,0,0),(0,-1,0),.003,'teaStream','tea',8)
root('teaSurface');lathe('tea in the cup',(0,.066,0),[(0,0),(.030,0),(.030,.001),(0,.001)],'teaSurface','tea',32)

poses={};contacts={}
C=Quaternion((1,0,0),math.pi/2)
def engine_q(rotation):
 x,y,z=rotation
 return Quaternion((0,1,0),y) @ Quaternion((1,0,0),x) @ Quaternion((0,0,1),z)
def pose(name,at,rotation=(0,0,0),space='room'):
 q=engine_q(rotation);o=bpy.data.objects.new('Work pose / '+name,None);scene.collection.objects.link(o)
 o.empty_display_type='ARROWS';o.empty_display_size=.06;o.location=coord(at);o.rotation_mode='QUATERNION';o.rotation_quaternion=C@q@C.inverted()
 o['runtime_space']=space
 poses[name]={'position':list(at),'quaternion':[q.x,q.y,q.z,q.w],'space':space}
def contact(name,prop,index,at,rotation=(0,0,0),hand_pose='grip'):
 q=engine_q(rotation);o=bpy.data.objects.new('Hand contact / '+name,None);scene.collection.objects.link(o);o.parent=roots[prop]
 o.empty_display_type='ARROWS';o.empty_display_size=.05;o.location=coord(at);o.rotation_mode='QUATERNION';o.rotation_quaternion=C@q@C.inverted()
 o['hand_index']=index;o['hand_pose']=hand_pose
 contacts[name]={'prop':prop,'index':index,'position':list(at),'quaternion':[q.x,q.y,q.z,q.w],'pose':hand_pose}

pose('kettleRest',(-4.45,.91,7.75),(0,0,0))
pose('jugRest',(.82,1.28,8.25))
pose('cupRest',(-3.38,.81,9.6),(0,-math.pi/2,0))
pose('breadRest',(-3.9,.84,9.65))
pose('kettleTable',(-4.43,.81,9.65),(0,-.45,0))
pose('kettleCarry',(.21,-.51,-.48),(0,math.pi/2,0),'camera')
pose('kettleFill',(.48,1.15,8.25),(0,math.pi/2,0))
pose('jugLift',(.82,1.43,8.25),(0,math.pi/2,0))
pose('jugPour',(.79,1.49,8.25),(-.95,math.pi/2,0))
pose('kettleHeat',(-4.45,.91,7.75))
pose('kettlePour',(-3.64,1.02,9.6),(0,0,-.65))
pose('lidOpen',(-.10,.12,0),(0,0,.7),'prop')
pose('breadLift',(.02,.105,-.055),(0,.08,-.14),'prop')
pose('breadServed',(.035,.005,-.03),(0,.06,-.02),'prop')
contact('kettleGrip','kettle',1,(0,.317,0))
contact('jugGrip','jug',0,(.12,.175,0),(0,0,math.pi/2))
contact('breadSteady','breadMain',0,(-.045,.075,.045),(.25,0,-math.pi/2),'open')
contact('breadBreak','breadPiece',1,(.145,.085,.035),(.3,0,math.pi/2),'pinch')
contact('stoveDraught','kettle',1,(.35,-.41,-.15),(0,0,0),'pinch')

# Indexed evaluated export: only meshes in this new scene enter the runtime.
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();data={};caches={}
for obj in list(scene.objects):
 if obj.type!='MESH' or not obj.get('model') or obj.get('model')=='plate':continue
 model=obj['model'];finish=obj['finish'];out=data.setdefault(model,{}).setdefault(finish,{'p':[],'n':[],'uv':[],'idx':[]});cache=caches.setdefault((model,finish),{})
 ev=obj.evaluated_get(deps);me=ev.to_mesh();me.calc_loop_triangles();transform=obj.parent.matrix_world.inverted()@ev.matrix_world;normal=transform.to_3x3().inverted().transposed()
 for tri in me.loop_triangles:
  ps=[transform@me.vertices[me.loops[li].vertex_index].co for li in tri.loops]
  if (ps[1]-ps[0]).cross(ps[2]-ps[0]).length<1e-12:continue
  for li in tri.loops:
   p=uncoord(transform@me.vertices[me.loops[li].vertex_index].co);n=uncoord((normal@me.corner_normals[li].vector).normalized())
   uv=(p[0]/.06,p[2]/.06) if abs(n[1])>.5 else (p[0]/.06,p[1]/.06)
   values=tuple(round(float(v),6) for v in (*p,*n,*uv))
   if values not in cache:cache[values]=len(out['p'])//3;out['p'].extend(values[:3]);out['n'].extend(values[3:6]);out['uv'].extend(values[6:])
   out['idx'].append(cache[values])
 ev.to_mesh_clear()
manifest={'models':data,'poses':poses,'contacts':contacts,'tips':{'jug':[0,.269,-.07],'kettle':[.255,.188,0],'kettleMouth':[0,.19,0],'cup':[0,.066,0]},'provenance':scene['provenance']}
path=ROOT/'src/world/flannan/DomesticCraftModel.js'
path.write_text('// GENERATED ONLY through live Blender MCP by tools/props/domestic-craft-mcp.py. Metres, Y up.\nexport const DOMESTIC_CRAFT_MODEL = '+json.dumps(manifest,separators=(',',':'))+';\n',encoding='utf-8')
counts={name:sum(len(g['idx'])//3 for g in groups.values()) for name,groups in data.items()}
summary={'scene':scene.name,'sourceSceneRetained':previous_scene.name,'triangles':counts,'poses':len(poses),'contacts':len(contacts),'export':str(path),'route':'live Blender MCP only'}
(OUT/'export-summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
text=bpy.data.texts.new('domestic-craft-mcp.py');text.write((ROOT/'tools/props/domestic-craft-mcp.py').read_text(encoding='utf-8'))
bpy.data.libraries.write(str(ROOT/'tools/props/domestic-craft.blend'),{scene,text},fake_user=True,compress=True)
bpy.context.window.scene=previous_scene
print(json.dumps(summary))
