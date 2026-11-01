"""Rocketbox Joe -> original Seven Hunters boatman, via the live Blender MCP.

Preserves all earlier scenes and both Tidewater vendors. Microsoft Rocketbox
geometry/textures remain MIT; wardrobe, shaping and performance are authored
reconstructions. Engine coordinates: metres, Y up, boatman faces local -Z.
"""
import bpy, bmesh, math, json, random
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
from mathutils.bvhtree import BVHTree

ROOT=Path('C:/Users/thisi/OneDrive/Documents/flannan')
OUT=ROOT/'artifacts/boatman';OUT.mkdir(parents=True,exist_ok=True)
scene=bpy.data.scenes.new('Seven Hunters - Joe boatman character')
scene['boatman_adaptation']=True;scene['provenance']='Microsoft Rocketbox Wood_Male_01 (MIT), original period wardrobe and rowing performance.'
bpy.context.window.scene=scene
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/models/characters/joe.glb'))
old_arm=next(o for o in scene.objects if o.type=='ARMATURE')
source=next(o for o in scene.objects if o.type=='MESH' and o.data.materials)
old_arm.animation_data_clear()
for p in old_arm.pose.bones:p.matrix_basis.identity()
bpy.context.view_layer.update()

def coord(v):return Vector((v[0],-v[2],v[1]))
def engine(v):return Vector((v[0],v[2],-v[1]))
turn=Matrix.Rotation(math.pi,4,'Z')
world=turn@source.matrix_world
heads={b.name:engine(turn@old_arm.matrix_world@b.head_local) for b in old_arm.data.bones}
old_parents={b.name:b.parent.name if b.parent else None for b in old_arm.data.bones}
old_materials=list(source.data.materials)

def mode(wanted):
 valid=[i.identifier for i in bpy.ops.object.mode_set.get_rna_type().properties['mode'].enum_items]
 assert wanted in valid;return bpy.ops.object.mode_set(mode=wanted)

# The glTF importer guesses very long display bones. Rebuild a metre-scale
# deform skeleton from the true joint centres, keeping every named weight group.
arm_data=bpy.data.armatures.new('Boatman deform skeleton')
arm=bpy.data.objects.new('Boatman',arm_data);scene.collection.objects.link(arm);arm['boatman_skeleton']=True
for o in scene.objects:o.select_set(False)
arm.select_set(True);bpy.context.view_layer.objects.active=arm;mode('EDIT')
next_bone={'Pelvis':'Spine','Spine':'Spine1','Spine1':'Spine2','Spine2':'Neck','Neck':'Head'}
for name,head in heads.items():
 tail=None;short=name.replace('Bip01 ','')
 if short in next_bone:tail=heads['Bip01 '+next_bone[short]]
 for a,b in [(' Clavicle',' UpperArm'),(' UpperArm',' Forearm'),(' Forearm',' Hand'),(' Thigh',' Calf'),(' Calf',' Foot'),(' Foot',' Toe0')]:
  if name.endswith(a):tail=heads.get(name[:-len(a)]+b)
 if name.endswith(' Hand'):tail=heads[name[:-5]+' Finger2']
 if ' Finger' in name:
  suffix=name.split(' Finger')[1]
  child=name+'1' if len(suffix)==1 else name[:-1]+'2' if suffix.endswith('1') else None
  tail=heads.get(child) if child else None
 if tail is None:tail=head+Vector((0,.025,0))
 if (tail-head).length<.005:tail=head+Vector((0,.025,0))
 b=arm_data.edit_bones.new(name);b.head=coord(head);b.tail=coord(tail)
 if 'Finger' in name:
  label='L' if ' L ' in name else 'R';wrist=heads[f'Bip01 {label} Hand']
  forward=sum((heads[f'Bip01 {label} Finger{i}'] for i in [1,2,3,4]),Vector())/4-wrist
  across=heads[f'Bip01 {label} Finger1']-heads[f'Bip01 {label} Finger4']
  b.align_roll(coord(across.cross(forward).normalized()))
for name in heads:
 parent=old_parents[name]
 if name.endswith(' Thigh'):parent='Bip01 Pelvis'
 if name.endswith(' Clavicle'):parent='Bip01 Spine2'
 if parent:arm_data.edit_bones[name].parent=arm_data.edit_bones[parent]
mode('OBJECT')
rest={b.name:b.matrix_local.copy() for b in arm_data.bones}

materials={};objects=[]
for key,base in [('head',old_materials[1]),('hands',old_materials[0])]:
 mat=base.copy();mat.name='Boatman / '+key;materials[key]=mat
 bs=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 # Existing photographs supply the face/hand detail; moderate the old specular.
 bs.inputs['Roughness'].default_value=.78

def cloth_material(name,color,rough,scale,strength):
 m=bpy.data.materials.new('Boatman / '+name);m.use_nodes=True;nt=m.node_tree
 bs=next(n for n in nt.nodes if n.type=='BSDF_PRINCIPLED');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough
 tex=nt.nodes.new('ShaderNodeTexCoord');noise=nt.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=scale;noise.inputs['Detail'].default_value=2
 nt.links.new(tex.outputs['UV'],noise.inputs['Vector'])
 wave=nt.nodes.new('ShaderNodeTexWave');wave.inputs['Scale'].default_value=scale*.64;wave.inputs['Distortion'].default_value=1.2
 nt.links.new(tex.outputs['UV'],wave.inputs['Vector'])
 mix=nt.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=.3;nt.links.new(noise.outputs['Fac'],mix.inputs[1]);nt.links.new(wave.outputs['Color'],mix.inputs[2])
 ramp=nt.nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=tuple(c*.78 for c in color)+(1,);ramp.color_ramp.elements[1].color=tuple(c*1.09 for c in color)+(1,)
 nt.links.new(noise.outputs['Fac'],ramp.inputs[0]);nt.links.new(ramp.outputs['Color'],bs.inputs['Base Color'])
 bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=strength;bump.inputs['Distance'].default_value=.0006
 nt.links.new(mix.outputs[0],bump.inputs['Height']);nt.links.new(bump.outputs[0],bs.inputs['Normal'])
 rr=nt.nodes.new('ShaderNodeMapRange');rr.inputs['From Min'].default_value=0;rr.inputs['From Max'].default_value=1;rr.inputs['To Min'].default_value=rough-.08;rr.inputs['To Max'].default_value=min(.99,rough+.06)
 nt.links.new(noise.outputs['Fac'],rr.inputs['Value']);nt.links.new(rr.outputs[0],bs.inputs['Roughness'])
 materials[name]=m;return m

cloth_material('oilskin',(.205,.182,.095),.53,135,.22)
cloth_material('wool',(.028,.044,.046),.94,180,.36)
cloth_material('leather',(.027,.022,.018),.73,95,.15)
for key,col,metal,rough in [('horn',(.055,.043,.027),0,.50),('stubble',(.045,.038,.029),0,.92),('grey',(.22,.20,.16),0,.94)]:
 m=bpy.data.materials.new('Boatman / '+key);m.use_nodes=True
 bs=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');bs.inputs['Base Color'].default_value=(*col,1);bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough;materials[key]=m

def bind(o,weights):
 groups={}
 for i,w in enumerate(weights):
  total=sum(w.values()) or 1
  for name,value in w.items():
   if value<=1e-5:continue
   if name not in groups:groups[name]=o.vertex_groups.get(name) or o.vertex_groups.new(name=name)
   groups[name].add([i],value/total,'REPLACE')
 mod=o.modifiers.new('Boatman deform','ARMATURE');mod.object=arm;o.parent=arm;objects.append(o);return o

def make(name,pts,faces,key,weights,uv=None,smooth=True):
 me=bpy.data.meshes.new(name);me.from_pydata([coord(p) for p in pts],[],faces);me.update();me.materials.append(materials[key])
 for p in me.polygons:p.use_smooth=smooth
 if uv:
  layer=me.uv_layers.new(name='UVMap')
  for poly in me.polygons:
   for li in poly.loop_indices:layer.data[li].uv=uv[me.loops[li].vertex_index]
 o=bpy.data.objects.new(name,me);scene.collection.objects.link(o);o['boatman_finish']=key
 return bind(o,weights)

def torso(p):
 y=p[1];levels=[(.895,'Bip01 Pelvis'),(1.015,'Bip01 Spine'),(1.168,'Bip01 Spine1'),(1.321,'Bip01 Spine2'),(1.52,'Bip01 Neck')]
 if y>1.32 and abs(p[0])>.12:
  clavicle='Bip01 L Clavicle' if p[0]<0 else 'Bip01 R Clavicle';k=min(.8,(y-1.32)*5)*min(1,(abs(p[0])-.12)/.08)
  return {'Bip01 Spine2':1-k,clavicle:k}
 for (lo,a),(hi,b) in zip(levels,levels[1:]):
  if y<=hi:
   t=max(0,min(1,(y-lo)/(hi-lo)));return{a:1-t,b:t}
 return {'Bip01 Neck':1}

# Preserve the original face, eyes, ears, hands, and useful trouser/boot topology.
# The baseball cap and modern shirt are removed, rather than recoloured.
groups={g.index:g.name for g in source.vertex_groups};src=source.data
kept={'head':[],'hands':[],'wool':[],'leather':[]}
head_faces={p.index:p for p in src.polygons if p.material_index==1};adjacency={}
for p in head_faces.values():
 for v in p.vertices:adjacency.setdefault(v,[]).append(p.index)
seen=set();cap_faces=set()
for face in head_faces:
 if face in seen:continue
 pending=[face];seen.add(face);component=[]
 while pending:
  i=pending.pop();component.append(i)
  for v in head_faces[i].vertices:
   for j in adjacency[v]:
    if j not in seen:seen.add(j);pending.append(j)
 heights=[(world@src.vertices[v].co).z for i in component for v in head_faces[i].vertices]
 xs=[(world@src.vertices[v].co).x for i in component for v in head_faces[i].vertices]
 if min(heights)>1.64 and (max(heights)>1.78 or max(xs)-min(xs)>.14):cap_faces.update(component)
body_image=next(n.image for n in old_materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and n.image and 'body_color' in n.image.name)
body_pixels=list(body_image.pixels);iw,ih=body_image.size
def skin_texel(poly):
 uv=sum((src.uv_layers.active.data[li].uv for li in poly.loop_indices),Vector((0,0)))/len(poly.loop_indices)
 x=max(0,min(iw-1,int(uv.x*iw)));y=max(0,min(ih-1,int(uv.y*ih)));i=(y*iw+x)*4;r,g,b=body_pixels[i:i+3]
 return r>b*1.12 and r>g*1.025 and r>.065
for poly in src.polygons:
 ps=[engine(world@src.vertices[i].co) for i in poly.vertices];centre=sum(ps,Vector())/len(ps)
 if poly.material_index==1:
  if poly.index not in cap_faces:kept['head'].append(poly)
 else:
  hand_weight=sum(sum(g.weight for g in src.vertices[i].groups if any(s in groups[g.group] for s in [' Hand',' Finger'])) for i in poly.vertices)/len(poly.vertices)
  if hand_weight>.60 and skin_texel(poly):kept['hands'].append(poly)
  elif max(p.y for p in ps)<.96:kept['leather' if centre.y<.245 else 'wool'].append(poly)
for key,polys in kept.items():
 used=sorted({i for p in polys for i in p.vertices});mapping={old:i for i,old in enumerate(used)}
 pts=[engine(world@src.vertices[i].co) for i in used]
 if key=='head':
  for p in pts:
   # Subtle leaner cheeks and a broader nose retain Joe's identity and eyes.
   cheek=math.exp(-((p.y-1.625)/.027)**2)*max(0,1-abs(p.z+.10)/.07)
   p.x*=1-.035*cheek
   if abs(p.x)<.023 and p.z<-.12:p.z-=.0018*math.exp(-((p.y-1.65)/.04)**2)
 weights=[{groups[g.group]:g.weight for g in src.vertices[i].groups} for i in used]
 faces=[tuple(mapping[i] for i in p.vertices) for p in polys]
 o=make('Boatman / retained '+key,pts,faces,key,weights)
 layer=o.data.uv_layers.new(name='UVMap');j=0
 for old,poly in zip(polys,o.data.polygons):
  for old_li,li in zip(old.loop_indices,poly.loop_indices):layer.data[li].uv=src.uv_layers.active.data[old_li].uv

def grid(name,nu,nv,fn,key,weight=torso,flip=False):
 pts=[Vector(fn(i/nu,j/nv)) for j in range(nv+1) for i in range(nu+1)]
 faces=[(j*(nu+1)+i,j*(nu+1)+i+1,(j+1)*(nu+1)+i+1,(j+1)*(nu+1)+i) for j in range(nv) for i in range(nu)]
 if flip:faces=[tuple(reversed(f)) for f in faces]
 return make(name,pts,faces,key,[weight(p) for p in pts],[(i/nu,j/nv) for j in range(nv+1) for i in range(nu+1)])

def tube(name,points,r,key,weight=torso,n=8):
 pts=[];uv=[];last=None
 for i,p in enumerate(points):
  d=(Vector(points[min(i+1,len(points)-1)])-Vector(points[max(i-1,0)])).normalized()
  a=d.cross(Vector((0,1,0)) if abs(d.y)<.95 else Vector((1,0,0))).normalized() if last is None else (last-d*last.dot(d)).normalized()
  b=d.cross(a).normalized();last=a
  for j in range(n):pts.append(Vector(p)+r*(math.cos(j/n*math.tau)*a+math.sin(j/n*math.tau)*b));uv.append((i/max(1,len(points)-1),j/n))
 faces=[(i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j) for i in range(len(points)-1) for j in range(n)]
 return make(name,pts,faces,key,[weight(p) for p in pts],uv)

exec((ROOT/'tools/characters/boatman-tailoring-mcp.py').read_text())

# Salt-and-pepper short whiskers sit on the retained jaw surface, rather than
# replacing the textured face with a solid beard shell.
head_mesh=next(o for o in objects if o.name.startswith('Boatman / retained head'))
bpy.context.view_layer.update();tree=BVHTree.FromObject(head_mesh,bpy.context.evaluated_depsgraph_get())
rng=random.Random(1901);beard={'stubble':([],[]),'grey':([],[])}
for i in range(480):
 x=rng.uniform(-.073,.073);y=rng.uniform(1.565,1.643)
 if abs(x)<.025 and y>1.601:continue
 hit,n,face,d=tree.ray_cast(coord((x,y,-.3)),coord((0,0,1)),.3)
 if hit is None:continue
 p=engine(hit);normal=engine(n);p+=normal*.0004;length=rng.uniform(.0008,.0018)
 end=p+Vector((rng.uniform(-.0005,.0005),-length,0))+normal*.001
 side=Vector((.0003,0,0));key='grey' if rng.random()<.14 else 'stubble';pts,faces=beard[key];j=len(pts)
 pts.extend([p-side,p+side,end+side*.45,end-side*.45]);faces.append((j,j+1,j+2,j+3))
for key,(pts,faces) in beard.items():
 if pts:make('Boatman / '+key+' whiskers',pts,faces,key,[{'Bip01 Head':1} for p in pts],[(0,0),(1,0),(1,1),(0,1)]*(len(pts)//4))

# Source objects are retained in a hidden reference collection in this new
# scene, and excluded from the selected-only game export.
reference=bpy.data.collections.new('Source Joe - retained reference');scene.collection.children.link(reference)
for o in list(scene.objects):
 if o not in objects and o!=arm:
  for c in list(o.users_collection):c.objects.unlink(o)
  reference.objects.link(o);o.hide_render=True;o.hide_set(True)

# Save the unposed metre-space design and bind basis for the performance pass.
manifest={'source':'Microsoft Rocketbox Wood_Male_01 / Tidewater joe.glb','license':'MIT','heads':{n:list(v) for n,v in heads.items()},'body_objects':len(objects),'bone_count':len(heads),'face_direction':'-Z','seat_height':.855,'tailoring_pass':2,'jacket':'continuous welded shell with sewn hem and cuff openings'}
manifest['nape_skin_colour']=list(skin_color);manifest['nape_skin_colour_space']='linear-sRGB'
(OUT/'design-manifest.json').write_text(json.dumps(manifest,indent=2))
scene['authoring_stage']='wardrobe and anatomy'
for o in scene.objects:o.select_set(False)
arm.select_set(True);bpy.context.view_layer.objects.active=arm
print(json.dumps({'scene':scene.name,'bones':len(heads),'character_objects':len(objects),'source_preserved':True,'retained_faces':{k:len(v) for k,v in kept.items()}}))
