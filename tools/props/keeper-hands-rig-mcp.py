"""Editable finger poses matching KeeperCraft.handMesh; run before saving study."""
import bpy, math
from mathutils import Vector, Matrix
scene=bpy.context.scene
assert scene.get('craft_expansion')
roots={o['model']:o.parent for o in scene.objects if o.type=='MESH' and o.get('model') and not o.get('review_only')}
def coord(v):return Vector((v[0],-v[2],v[1]))
if not any(o.get('keeper_hand_rig') for o in scene.objects):
 arm=bpy.data.armatures.new('Keeper hand bones');rig=bpy.data.objects.new('Keeper hand / open grip pinch',arm)
 scene.collection.objects.link(rig);rig['keeper_hand_rig']=True;rig.location=coord((1.1,.7,-3))
 for o in scene.objects:o.select_set(False)
 rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
 spec=[('wrist',(0,0,0),(0,.08,0),None,'handPalm',1)]
 for finger,length in enumerate([.88,1,.95,.74]):
  x=(finger-1.5)*.019;y=.081;parent='wrist'
  for j,(source,L) in enumerate([('finger',.031*length),('finger',.025*length),('fingerTip',.024*length)]):
   name=f'finger{finger}.{j}';spec.append((name,(x,y,0),(x,y+L,0),parent,source,length*(.78 if j==1 else 1)));parent=name;y+=L
 spec.extend([('thumb.0',(-.034,.026,-.002),(-.058,.048,-.002),'wrist','finger',1),('thumb.1',(-.058,.048,-.002),(-.074,.063,-.002),'thumb.0','fingerTip',1)])
 for name,a,b,parent,source,scale in spec:
  bone=arm.edit_bones.new(name);bone.head=coord(a);bone.tail=coord(b)
  if parent:bone.parent=arm.edit_bones[parent]
 bpy.ops.object.mode_set(mode='OBJECT')
 for name,a,b,parent,source,scale in spec:
  for src in roots[source].children:
   if src.type!='MESH':continue
   o=src.copy();o.data=src.data;scene.collection.objects.link(o);o['review_only']=True;o.parent=rig;o.name='Hand rig / '+name+' / '+src.name
   delta=Vector(b)-Vector(a);q=coord((0,1,0)).rotation_difference(coord(delta).normalized())
   o.location=coord(a)+q@src.location;o.rotation_euler=q.to_euler();o.scale=(1,1,scale)
   vg=o.vertex_groups.new(name=name);vg.add(list(range(len(o.data.vertices))),1,'REPLACE')
   mod=o.modifiers.new('Editable finger bone','ARMATURE');mod.object=rig
 for frame,curl in [(1,.12),(20,1.22),(40,.65),(49,.12)]:
  for bone in rig.pose.bones:
   bone.rotation_mode='XYZ';bone.rotation_euler=(0,0,0)
   if bone.name.startswith('finger'):
    j=int(bone.name.split('.')[-1]);bone.rotation_euler.x=-curl*[.55,1,.75][j]
   if bone.name.startswith('thumb'):bone.rotation_euler.x=-curl*.65
   bone.keyframe_insert(data_path='rotation_euler',frame=frame)
 scene.frame_set(1)
 print('Editable keeper hand rig: wrist and 14 finger/thumb joints; open / grip / pinch poses.')
