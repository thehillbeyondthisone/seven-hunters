"""Run in the boatman design scene, then run the export script."""
import bpy,math,json
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
ROOT=Path('C:/Users/thisi/OneDrive/Documents/flannan');OUT=ROOT/'artifacts/boatman'
scene=bpy.context.scene;arm=next(o for o in scene.objects if o.get('boatman_skeleton'))
manifest=json.loads((OUT/'design-manifest.json').read_text())
heads={n:Vector(v) for n,v in manifest['heads'].items()};rest={b.name:b.matrix_local.copy() for b in arm.data.bones}
def coord(v):return Vector((v[0],-v[2],v[1]))
def engine(v):return Vector((v[0],v[2],-v[1]))
assert scene.get('boatman_adaptation')
PERIOD=math.tau/1.7
def ease(t):t=max(0,min(1,t));return t*t*(3-2*t)
def stroke(phase):
 pull=ease((phase-.06)/.5);recover=ease((phase-.64)/.36);immersion=ease(phase/.06)*(1-ease((phase-.56)/.08))
 return -.32+.64*pull-.64*recover,immersion,math.sin((pull-recover)*math.pi)*.055
def solve(a,b,pole,l0,l1):
 axis=(b-a).normalized();distance=max(abs(l0-l1)+.0001,min(l0+l1-.0001,(b-a).length))
 along=(l0*l0-l1*l1+distance*distance)/(2*distance)
 bend=pole-a; bend=(bend-axis*bend.dot(axis)).normalized()
 elbow=a+axis*along+bend*math.sqrt(max(0,l0*l0-along*along))
 return elbow,a+axis*distance
def head_of(name):return engine(arm.pose.bones[name].head)
def orient(name,end):
 pb=arm.pose.bones[name];original=rest[name];rest_dir=original.to_3x3()@Vector((0,1,0))
 target=(coord(end)-pb.head).normalized();q=rest_dir.rotation_difference(target)@original.to_quaternion()
 pb.matrix=Matrix.Translation(pb.head)@q.to_matrix().to_4x4();bpy.context.view_layer.update()
def set_world_rotation(name,q):
 pb=arm.pose.bones[name];pb.matrix=Matrix.Translation(pb.head)@q.to_matrix().to_4x4();bpy.context.view_layer.update()
def basis(across,forward):
 across=across.normalized();forward=(forward-across*forward.dot(across)).normalized();normal=across.cross(forward).normalized()
 return Matrix((across,forward,normal)).transposed()
hand_info={}
for side,label in [(-1,'L'),(1,'R')]:
 wrist=heads[f'Bip01 {label} Hand'];knuckles=sum((heads[f'Bip01 {label} Finger{i}'] for i in [1,2,3,4]),Vector())/4
 across=heads[f'Bip01 {label} Finger1']-heads[f'Bip01 {label} Finger4']
 hand_basis=basis(across,knuckles-wrist);offset=knuckles-wrist
 hand_info[label]={'offset':offset,'contact_offset':offset+hand_basis.col[2]*(side*.027),'basis':hand_basis,'rest_q':rest[f'Bip01 {label} Hand'].to_quaternion()}

# Pose closure around the oars. Each finger flexes in its own anatomical plane.
def grip_fingers(label):
 for i in range(5):
  for j,suffix in enumerate(['','1','2']):
   pb=arm.pose.bones[f'Bip01 {label} Finger{i}{suffix}'];pb.rotation_mode='QUATERNION'
   pb.rotation_quaternion=Quaternion((1,0,0),(-1 if label=='L' else 1)*([.55,.75,.65] if i==0 else [.95,1.3,1.15])[j])

scene.render.fps=24;scene.frame_start=1;scene.frame_end=90
arm.animation_data_clear();arm.animation_data_create()
for frame in range(1,91,2):
 scene.frame_set(frame)
 phase=(frame-1)/89;sweep,immersion,lean=stroke(phase)
 for pb in arm.pose.bones:pb.matrix_basis.identity()
 pelvis=arm.pose.bones['Bip01 Pelvis'];pelvis.matrix=Matrix.Translation(coord((0,.945,-.42)))@rest['Bip01 Pelvis'].to_quaternion().to_matrix().to_4x4()
 bpy.context.view_layer.update()
 # Knees bend forward above the thwart, feet remain planted on the duckboards.
 for side,label in [(-1,'L'),(1,'R')]:
  hip=head_of(f'Bip01 {label} Thigh');ankle=Vector((side*.20,.465,-.86));knee,wrist=solve(hip,ankle,Vector((side*.24,.98,-1.05)),(heads[f'Bip01 {label} Calf']-heads[f'Bip01 {label} Thigh']).length,(heads[f'Bip01 {label} Foot']-heads[f'Bip01 {label} Calf']).length)
  orient(f'Bip01 {label} Thigh',knee);orient(f'Bip01 {label} Calf',ankle)
  set_world_rotation(f'Bip01 {label} Foot',rest[f'Bip01 {label} Foot'].to_quaternion())
 # Successive spinal rotations distribute the pull, with a little chest breath.
 for name,k in [('Spine',.30),('Spine1',.36),('Spine2',.34)]:
  pb=arm.pose.bones['Bip01 '+name];pb.rotation_mode='QUATERNION';pb.rotation_quaternion=Quaternion((1,0,0),-lean*k+.004*math.sin(phase*math.tau)*k)
 bpy.context.view_layer.update()
 for side,label in [(-1,'L'),(1,'R')]:
  # Matches LandingBoat's modeled handle and standard entry/pull/recovery arc.
  qy=Quaternion((0,1,0),side*sweep);qz=Quaternion((0,0,1),-side*(-.045+.25*immersion));oq=qy@qz
  anchor=Vector((side*1.16,1.25,-.65))+oq@Vector((-side*.75,-.012,0))
  across=oq@Vector((-side,.118,0));desired=basis(across,Vector((0,0,-1)))
  delta=desired@hand_info[label]['basis'].inverted();dq=delta.to_quaternion()
  hand_q=coord((0,0,0)) # overwritten with a coordinate-basis conjugation below
  conversion=Matrix(((1,0,0),(0,0,-1),(0,1,0)))
  hand_q=(conversion@delta@conversion.inverted()).to_quaternion()@hand_info[label]['rest_q']
  wrist=anchor-delta@hand_info[label]['contact_offset']
  shoulder=head_of(f'Bip01 {label} UpperArm')
  elbow,wrist=solve(shoulder,wrist,Vector((side*.64,1.07,-.29)),(heads[f'Bip01 {label} Forearm']-heads[f'Bip01 {label} UpperArm']).length,(heads[f'Bip01 {label} Hand']-heads[f'Bip01 {label} Forearm']).length)
  orient(f'Bip01 {label} UpperArm',elbow);orient(f'Bip01 {label} Forearm',wrist);set_world_rotation(f'Bip01 {label} Hand',hand_q);grip_fingers(label)
 for pb in arm.pose.bones:
  pb.rotation_mode='QUATERNION'
  pb.keyframe_insert(data_path='location',frame=frame);pb.keyframe_insert(data_path='rotation_quaternion',frame=frame)
# Exact loop closure, with a genuine one-period duration.
scene.frame_set(1)
for pb in arm.pose.bones:
 pb.keyframe_insert(data_path='location',frame=90);pb.keyframe_insert(data_path='rotation_quaternion',frame=90)
action=arm.animation_data.action;action.name='rowing';action.use_fake_user=True
scene.frame_set(24);bpy.context.view_layer.update()
scene['authoring_stage']='seated rowing performance'

# Retained hand rest basis is also used by the runtime inverse-kinematic correction.
manifest['hands']={k:{'offset':list(v['offset']),'contact_offset':list(v['contact_offset']),'basis':[list(r) for r in v['basis']]} for k,v in hand_info.items()}
manifest['rowing_period']=PERIOD
exec((ROOT/'tools/characters/boatman-fit-mcp.py').read_text())
(OUT/'design-manifest.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps({'rowing_clip':action.name,'frames':90,'bones':len(arm.pose.bones),'seat':'feet planted, thighs on thwart','hand_targets':'shared oar geometry'}))
