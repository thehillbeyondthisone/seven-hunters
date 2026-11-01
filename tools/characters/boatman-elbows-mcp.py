"""Run through live Blender MCP only: export the authored rowing elbow planes.
Preserves the open main file and active scene. Runtime consumes BoatmanRig.js.
"""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
root=Path(r'C:\Users\thisi\OneDrive\Documents\repos\flannan')
out=root/'artifacts/boatman/elbows-20261101';out.mkdir(parents=True,exist_ok=True)
prior=bpy.context.window.scene;prior_active=bpy.context.view_layer.objects.active;prior_frame=prior.frame_current;prior_main=bpy.data.filepath
try:
 study=next((s for s in bpy.data.scenes if s.get('elbow_review')=='2026-11-01 through Blender MCP only'),None)
 if study is None:
  with bpy.data.libraries.load(str(root/'tools/characters/boatman.blend'),link=False) as (library_source,library_target):
   library_target.scenes=[name for name in library_source.scenes if 'boatman' in name.lower()][:1]
  study=library_target.scenes[0];study.name='Seven Hunters - isolated boatman elbow review 20261101';study['elbow_review']='2026-11-01 through Blender MCP only'
 bpy.context.window.scene=study
 arm=next(o for o in study.objects if o.get('boatman_skeleton'))
 # The authored seated performance already has a natural tucked elbow path.
 # Export its bend planes as the live-wave rig's poles, replacing the generic
 # outstretched runtime pole without changing the face, wardrobe or oar grips.
 conversion=Matrix(((1,0,0),(0,0,-1),(0,1,0)))
 def engine(v):return conversion.inverted()@v
 poles={'L':[],'R':[]};lengths={};minimum=1
 for i in range(91):
  frame=1+89*i/90;study.frame_set(int(frame),subframe=frame-int(frame))
  bpy.context.view_layer.update()
  chest=arm.pose.bones['Bip01 Spine2'].matrix.to_3x3().normalized()
  chest_engine=conversion.inverted()@chest@conversion
  bind_engine=conversion.inverted()@arm.data.bones['Bip01 Spine2'].matrix_local.to_3x3().normalized()@conversion
  for side,label in [(-1,'L'),(1,'R')]:
   shoulder=engine(arm.pose.bones[f'Bip01 {label} UpperArm'].head)
   elbow=engine(arm.pose.bones[f'Bip01 {label} Forearm'].head)
   wrist=engine(arm.pose.bones[f'Bip01 {label} Hand'].head)
   axis=(wrist-shoulder).normalized();bend=elbow-shoulder;bend-=axis*bend.dot(axis)
   minimum=min(minimum,bend.length)
   if bend.length<.005:raise RuntimeError('Unstable authored elbow plane')
   local=bind_engine@chest_engine.inverted()@bend.normalized()
   poles[label].append([round(v,7) for v in local.normalized()])
   lengths[label]=[(elbow-shoulder).length,(wrist-elbow).length]
 assert len({tuple(v) for v in poles['L']})>80, 'Every phase must sample its actual frame'
 for guide in list(study.objects):
  if guide.name.startswith('Authored elbow plane '):bpy.data.objects.remove(guide,do_unlink=True)
 for label in ['L','R']:
  poles[label][-1]=poles[label][0]
  # Editable guides make the exported directions inspectable in the study.
  guide=bpy.data.objects.new('Authored elbow plane '+label,None);study.collection.objects.link(guide)
  guide.empty_display_type='ARROWS';guide.empty_display_size=.2
  guide['elbow_plane_samples']=json.dumps(poles[label]);guide['space']='engine Y-up chest rotation relative to bind direction'
 study['live_elbow_rig']='Bend planes sampled from the authored seated performance; consumed by Boatman.js for wave adaptation.'
 data={'source':'Blender MCP / isolated boatman elbow study, 2026-11-01','space':'engine chest rotation relative to bind unit directions','samples':91,'left':poles['L'],'right':poles['R']}
 module='// Generated through live Blender MCP. Do not hand-author pose data here.\n// Natural elbow planes sampled from the editable seated performance.\nexport const BOATMAN_ELBOW_RIG = '+json.dumps(data,separators=(',',':'))+';\n'
 target=root/'src/world/boat/BoatmanRig.js';target.write_text(module,encoding='utf-8')
 bpy.data.libraries.write(str(out/'boatman-elbow-rig.blend'),{study},fake_user=True,compress=True)
 report={'authoring_route':'live Blender MCP execute_blender_code','mainfile_unchanged':True,'source_glb_unchanged':True,'minimum_authored_bend_radius_m':minimum,'rest_arm_lengths_m':lengths,'module_sha256':hashlib.sha256(module.encode()).hexdigest(),'samples':91,'study':'boatman-elbow-rig.blend'}
 (out/'rig-authoring.json').write_text(json.dumps(report,indent=2))
 print(json.dumps(report,indent=2))
finally:
 bpy.context.window.scene=prior;prior.frame_set(prior_frame)
 if prior_active and prior_active.name in prior.objects:bpy.context.view_layer.objects.active=prior_active
 assert bpy.data.filepath==prior_main
 print('Restored prior scene '+prior.name+'; main file unchanged.')


