"""Run after domestic-craft-mcp.py ONLY through live Blender MCP.

Item-specific handle, bread and stove grips. Existing camera/lantern/storm poses
and every other scene remain intact. No runtime finger-angle authoring.
"""
import bpy,json,math
from pathlib import Path
from mathutils import Vector,Quaternion,Matrix
ROOT=Path(r'C:\Users\thisi\OneDrive\Documents\repos\flannan')
OUT=ROOT/'artifacts/domestic-craft/blender'
domestic_scene=next(s for s in bpy.data.scenes if s.get('domestic_mechanisms'))
previous=bpy.context.window.scene
before_file=bpy.data.filepath
others={s.name:len(s.objects) for s in bpy.data.scenes if s!=domestic_scene}
assert not any(o.get('pose')=='domesticHandle' for o in domestic_scene.objects),'Run this isolated hand addition once.'
author=(ROOT/'tools/props/keeper-hand-poses-mcp.py').read_text(encoding='utf-8')
prefix=author.split('poses={}',1)[0]
prefix=prefix.replace("OUT=ROOT/'artifacts/keeper-hands-review/blender'","OUT=ROOT/'artifacts/domestic-craft/blender'")
prefix=prefix.replace("scene=bpy.data.scenes.new('Seven Hunters - camera and lantern hand contact review')",'scene=domestic_scene')
exec(compile(prefix,'Existing anatomical helpers through live Blender MCP','exec'))

handles=[];pinches=[];bread=[];support=[]
for i in range(4):
 x=(i-1.5)*.018
 handles.append([(x,.081,.034),(x,.105,.010),(x,.083,-.012),(x,.059,.001)])
 pinches.append([(-.027,.081,.034),(-.019,.104,.009),(.001,.093,-.012),(.006,.078,-.015)] if i==0 else [(x,.081,.034),(x,.109,.019),(x,.095,-.004),(x,.072,.007)])
 bread.append([(x,.081,.045),(x,.108,.012),(x,.090,-.035),(x,.062,-.015)])
 support.append([(x,.081,.035),(x,.111,.018),(x,.132,.002),(x,.145,-.002)])
handle_thumb=[(-.033,.041,.030),(-.019,.064,.004),(.012,.072,-.013)]
pinch_thumb=[(-.033,.041,.030),(-.021,.066,.002),(-.006,.078,-.015)]
bread_thumb=[(-.033,.04,.036),(-.022,.065,.012),(-.004,.076,-.025)]
support_thumb=[(-.033,.035,.030),(-.044,.057,.015),(-.047,.071,.002)]
def mirror(paths):return [[(-x,y,z) for x,y,z in path] for path in paths]
poses={
 'domesticHandle':hand('domesticHandle',1,(0,0,.035),(0,1,0),(0,0,-1),handles,handle_thumb,(0,0,0)),
 'domesticJug':hand('domesticJug',-1,(0,0,.035),(0,1,0),(0,0,-1),mirror(handles),mirror([handle_thumb])[0],(.4,0,0)),
 'domesticPinch':hand('domesticPinch',1,(0,0,.035),(0,1,0),(0,0,-1),pinches,pinch_thumb,(.8,0,0)),
 'domesticBread':hand('domesticBread',1,(0,0,.035),(0,1,0),(0,0,-1),bread,bread_thumb,(1.2,0,0)),
 'domesticSupport':hand('domesticSupport',-1,(0,0,.035),(0,1,0),(0,0,-1),mirror(support),mirror([support_thumb])[0],(1.6,0,0)),
}
path=ROOT/'src/world/flannan/DomesticCraftModel.js'
prior=path.read_text(encoding='utf-8');(OUT/'before-item-hands-model.js').write_text(prior,encoding='utf-8')
data=json.loads(prior.split('export const DOMESTIC_CRAFT_MODEL = ',1)[1].strip().rstrip(';'))
C=Quaternion((1,0,0),math.pi/2)
def eq(x,y,z):return Quaternion((0,1,0),y)@Quaternion((1,0,0),x)@Quaternion((0,0,1),z)
for role,pose_name,point,angles in [
 ('kettleGrip','domesticHandle',(0,.317,0),(0,0,0)),
 ('jugGrip','domesticJug',(.12,.175,0),(0,0,math.pi/2)),
 ('stoveDraught','domesticPinch',(.35,-.41,-.15),(0,math.pi/2,0)),
 ('breadSteady','domesticSupport',(-.055,.067,-.108),(.2,math.pi,-math.pi/2)),
 ('breadBreak','domesticBread',(.145,.075,-.08),(.2,math.pi,-math.pi/2)),
]:
 c=data['contacts'][role];o=next(o for o in scene.objects if o.name.startswith('Hand contact / '+role));q=eq(*angles)
 o.location=coord(point);o.rotation_mode='QUATERNION';o.rotation_quaternion=C@q@C.inverted();o['hand_pose']=pose_name
 c.update({'pose':pose_name,'position':list(point),'quaternion':[q.x,q.y,q.z,q.w]})
 # Exact prop geometry in the hand's own contact frame is retained as context.
 hand_root=poses[pose_name]
 attachment=Matrix.Translation(Vector(point))@q.to_matrix().to_4x4()
 prop_to_hand=Matrix.Translation(Vector((0,.075,-.015)))@attachment.inverted()
 for finish,g in data['models'][c['prop']].items():create_mesh(pose_name+' / prop context / '+finish,g,hand_root,prop_to_hand,finish,review=True)

extract=author.split('bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();export={}',1)[1].split('attachments=',1)[0]
exec(compile('bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();export={}'+extract,'Domestic contact mesh export through Blender MCP','exec'))
data['handPoses']=export
data['gripChecks']={'handle':{'thumbTip':handle_thumb[-1],'fingerTips':[p[-1] for p in handles],'barAxis':[1,0,0]},'bread':{'indexTip':bread[0][-1],'thumbTip':bread_thumb[-1],'aperture':(Vector(bread[0][-1])-Vector(bread_thumb[-1])).length}}
path.write_text('// GENERATED through live Blender MCP only. Metres, Y up. Source: domestic-craft-mcp.py then domestic-hands-mcp.py.\nexport const DOMESTIC_CRAFT_MODEL = '+json.dumps(data,separators=(',',':'))+';\n',encoding='utf-8')
text=bpy.data.texts.new('domestic-hands-mcp.py');text.write((ROOT/'tools/props/domestic-hands-mcp.py').read_text(encoding='utf-8'))
bpy.data.libraries.write(str(ROOT/'tools/props/domestic-craft.blend'),{scene,text},fake_user=True,compress=True)
summary=json.loads((OUT/'export-summary.json').read_text(encoding='utf-8'));summary['handPoses']={name:sum(len(g['idx'])//3 for g in item['finishes'].values()) for name,item in export.items()};summary['handSource']='tools/props/domestic-hands-mcp.py';summary['contacts']=data['contacts'];summary['otherScenesPreserved']=others
assert bpy.data.filepath==before_file
assert all(name in bpy.data.scenes and len(bpy.data.scenes[name].objects)==count for name,count in others.items())
bpy.context.window.scene=previous
(OUT/'export-summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
print(json.dumps({'handPoses':summary['handPoses'],'contacts':data['contacts'],'otherScenesPreserved':True,'mainFilePreserved':True}))
