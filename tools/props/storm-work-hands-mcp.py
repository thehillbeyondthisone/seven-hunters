"""Run after storm-work-mcp.py, ONLY through live Blender MCP.

Adds independent small-item grips to the storm study. The camera and lantern
pose file, meshes and scenes remain untouched.
"""
import bpy,json,math
from pathlib import Path
ROOT=Path(r'C:\Users\thisi\OneDrive\Documents\repos\flannan')
OUT=ROOT/'artifacts/story-review/storm-mechanics/blender'
storm_scene=next(s for s in bpy.data.scenes if s.get('storm_repair_working_study'))
previous=bpy.context.window.scene
before_file=bpy.data.filepath
other_scenes={s.name:len(s.objects) for s in bpy.data.scenes if s!=storm_scene}
assert not any(o.get('pose') in ['stormPinch','stormSpanner'] for o in storm_scene.objects),'Author this isolated hand addition only once.'

# Reuse the inspected anatomical palm and segmented fingers, and the MCP-only
# editable contact-rig authoring helpers. The prefix is redirected into this
# already isolated scene; it never creates or rewrites the camera/lantern study.
author=(ROOT/'tools/props/keeper-hand-poses-mcp.py').read_text(encoding='utf-8')
prefix=author.split('poses={}',1)[0]
prefix=prefix.replace("OUT=ROOT/'artifacts/keeper-hands-review/blender'","OUT=ROOT/'artifacts/story-review/storm-mechanics/blender'")
prefix=prefix.replace("scene=bpy.data.scenes.new('Seven Hunters - camera and lantern hand contact review')",'scene=storm_scene')
exec(compile(prefix,'Existing anatomical contact helpers through Blender MCP','exec'))

pin_paths=[]
for i in range(4):
    x=(i-1.5)*.018
    if i==0:
        pin_paths.append([(-.027,.081,.034),(-.019,.104,.009),(.001,.093,-.012),(.006,.078,-.015)])
    else:
        pin_paths.append([(x,.081,.034),(x,.109,.019),(x,.095,-.004),(x,.072,.007)])
pin_thumb=[(-.033,.041,.030),(-.021,.066,.002),(-.006,.078,-.015)]
spanner_paths=[]
for i in range(4):
    x=(i-1.5)*.018
    spanner_paths.append([(x,.081,.034),(x,.105,.010),(x,.083,-.012),(x,.059,.001)])
spanner_thumb=[(-.033,.041,.030),(-.019,.064,.004),(.012,.072,-.013)]
poses={
    'stormPinch':hand('stormPinch',1,(0,0,.035),(0,1,0),(0,0,-1),pin_paths,pin_thumb,(0,0,0)),
    'stormSpanner':hand('stormSpanner',1,(0,0,.035),(0,1,0),(0,0,-1),spanner_paths,spanner_thumb,(.4,0,0)),
}

# Export only these two newly authored item-local poses, keeping all other
# generated data and the complete camera/lantern pose file byte-for-byte intact.
extract=author.split('bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();export={}',1)[1].split('attachments=',1)[0]
exec(compile('bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();export={}'+extract,'Storm grip export through Blender MCP','exec'))
path=ROOT/'src/world/flannan/StormWorkModel.js'
prior=path.read_text(encoding='utf-8')
(OUT/'before-item-grips-model.js').write_text(prior,encoding='utf-8')
data=json.loads(prior.split('export const STORM_WORK_MODEL = ',1)[1].strip().rstrip(';'))
data['poses']=export
data['gripChecks']={
    'stormPinch':{'indexTip':pin_paths[0][-1],'thumbTip':pin_thumb[-1],'target':[0,.075,-.015],'aperture':(Vector(pin_paths[0][-1])-Vector(pin_thumb[-1])).length},
    'stormSpanner':{'fingerTips':[path[-1] for path in spanner_paths],'thumbTip':spanner_thumb[-1],'target':[0,.075,-.015],'barAxis':[1,0,0]},
}
data['contacts']['pin']['pose']='stormPinch';data['contacts']['pin']['point']=[0,.014,.105]
data['contacts']['spanner']['pose']='stormSpanner'
data['contacts']['oilCan']['pose']='stormSpanner'
for role in ['pin','spanner']:
    e=next(o for o in scene.objects if o.get('contact_role')==role)
    e['hand_pose']=data['contacts'][role]['pose'];e['engine_point']=data['contacts'][role]['point'];e.location=coord(data['contacts'][role]['point'])
path.write_text('// GENERATED through live Blender MCP only. Metres, Y up. Editable source: tools/props/storm-work.blend.\nexport const STORM_WORK_MODEL = '+json.dumps(data,separators=(',',':'))+';\n',encoding='utf-8')
text=bpy.data.texts.new('storm-work-hands-mcp.py');text.write((ROOT/'tools/props/storm-work-hands-mcp.py').read_text(encoding='utf-8'))
base=next(t for t in bpy.data.texts if t.name=='storm-work-mcp.py')
bpy.data.libraries.write(str(ROOT/'tools/props/storm-work.blend'),{scene,text,base},fake_user=True,compress=True)
summary=json.loads((OUT/'export-summary.json').read_text(encoding='utf-8'))
summary['contacts']=data['contacts'];summary['poses']={name:sum(len(g['idx'])//3 for g in pose['finishes'].values()) for name,pose in export.items()}
summary['item_grip_source']='tools/props/storm-work-hands-mcp.py'
assert bpy.data.filepath==before_file
assert all(name in bpy.data.scenes and len(bpy.data.scenes[name].objects)==count for name,count in other_scenes.items())
summary['other_scenes_preserved']=other_scenes;summary['main_file_preserved']=True
(OUT/'export-summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
bpy.context.window.scene=previous
print(json.dumps({'poses':summary['poses'],'contacts':data['contacts'],'other_scenes_preserved':True,'main_file_preserved':True}))
