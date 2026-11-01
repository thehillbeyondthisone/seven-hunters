"""Second tailoring pass. Executed by boatman-mcp.py in its authoring namespace.

Build a welded jacket shell before skinning, so shoulder motion cannot open
the armholes. Seams, turnover collar, welt pockets and ribbed wool are separate
tailored details. All earlier scenes and the original Joe remain preserved.
"""
from mathutils.kdtree import KDTree

def math_node(nt,op,*inputs):
 n=nt.nodes.new('ShaderNodeMath');n.operation=op
 for i,value in enumerate(inputs):
  if hasattr(value,'node'):nt.links.new(value,n.inputs[i])
  else:n.inputs[i].default_value=value
 return n.outputs[0]

# Yarn loops are baked into a normal map, rather than modeled as hard wires.
m=bpy.data.materials.new('Boatman / knitted guernsey wool');m.use_nodes=True;nt=m.node_tree;nt.nodes.clear()
out=nt.nodes.new('ShaderNodeOutputMaterial');bs=nt.nodes.new('ShaderNodeBsdfPrincipled');nt.links.new(bs.outputs[0],out.inputs['Surface'])
tex=nt.nodes.new('ShaderNodeTexCoord');sep=nt.nodes.new('ShaderNodeSeparateXYZ');nt.links.new(tex.outputs['UV'],sep.inputs[0])
x=math_node(nt,'FRACT',math_node(nt,'MULTIPLY',sep.outputs['X'],48));y=math_node(nt,'FRACT',math_node(nt,'MULTIPLY',sep.outputs['Y'],48))
chevron=math_node(nt,'ADD',.16,math_node(nt,'MULTIPLY',math_node(nt,'ABSOLUTE',math_node(nt,'SUBTRACT',x,.5)),.9))
dist=math_node(nt,'ABSOLUTE',math_node(nt,'SUBTRACT',y,chevron))
height=math_node(nt,'EXPONENT',math_node(nt,'MULTIPLY',math_node(nt,'POWER',math_node(nt,'DIVIDE',dist,.105),2),-1))
noise=nt.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=320;nt.links.new(tex.outputs['UV'],noise.inputs[0])
fibre=math_node(nt,'MULTIPLY',height,math_node(nt,'ADD',.72,math_node(nt,'MULTIPLY',noise.outputs['Fac'],.28)))
ramp=nt.nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(.018,.033,.042,1);ramp.color_ramp.elements[1].color=(.061,.084,.092,1)
nt.links.new(fibre,ramp.inputs[0]);nt.links.new(ramp.outputs['Color'],bs.inputs['Base Color'])
bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.65;bump.inputs['Distance'].default_value=.00085
nt.links.new(fibre,bump.inputs['Height']);nt.links.new(bump.outputs[0],bs.inputs['Normal'])
nt.links.new(math_node(nt,'SUBTRACT',.95,math_node(nt,'MULTIPLY',height,.045)),bs.inputs['Roughness']);materials['knit']=m

# Waxed canvas: broad wear and rain marks below a restrained fine fabric grain.
m=materials['oilskin'];nt=m.node_tree;bs=next(n for n in nt.nodes if n.type=='BSDF_PRINCIPLED')
tex=next(n for n in nt.nodes if n.type=='TEX_COORD')
coarse=nt.nodes.new('ShaderNodeTexNoise');coarse.inputs['Scale'].default_value=7;coarse.inputs['Detail'].default_value=3;coarse.inputs['Roughness'].default_value=.7
mapping=nt.nodes.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(1.1,2.7,1);nt.links.new(tex.outputs['UV'],mapping.inputs[0]);nt.links.new(mapping.outputs[0],coarse.inputs[0])
ramp=nt.nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.14;ramp.color_ramp.elements[0].color=(.103,.105,.068,1)
ramp.color_ramp.elements[1].position=.86;ramp.color_ramp.elements[1].color=(.241,.220,.139,1)
nt.links.new(coarse.outputs['Fac'],ramp.inputs[0]);nt.links.new(ramp.outputs[0],bs.inputs['Base Color'])
rough=nt.nodes.new('ShaderNodeMapRange');rough.inputs['To Min'].default_value=.40;rough.inputs['To Max'].default_value=.68
nt.links.new(coarse.outputs['Fac'],rough.inputs[0]);nt.links.new(rough.outputs[0],bs.inputs['Roughness'])
next(n for n in nt.nodes if n.type=='BUMP').inputs['Strength'].default_value=.12

def smoothstep(x):x=max(0,min(1,x));return x*x*(3-2*x)
HEM=.915;HEIGHT=.590
profile=[(HEM,.226,.145),(.98,.224,.142),(1.04,.225,.139),(1.15,.223,.135),(1.29,.248,.147),(1.39,.255,.140),(1.445,.244,.128),(1.48,.190,.107),(1.505,.091,.079)]
def radii(y):
 for (y0,r0,d0),(y1,r1,d1) in zip(profile,profile[1:]):
  if y<=y1:
   t=smoothstep((y-y0)/(y1-y0));return r0+(r1-r0)*t,d0+(d1-d0)*t
 return profile[-1][1:]
def coat(u,v,extra=0):
 y=HEM+v*HEIGHT;a=-math.pi/2+u*math.tau;r,d=radii(y)
 # Low, irregular folds converge at the waist and underarms.
 folds=.0024*math.sin(a*9+y*11)*math.sin(v*math.pi)+.0016*math.sin(a*17-y*9)
 return((r+folds+extra)*math.cos(a),y+.003*math.sin(a*5)*(1-v),(d+folds+extra)*math.sin(a))
def coat_uv(p):
 r,d=radii(p.y);return((math.atan2(p.z/d,p.x/r)+math.pi/2)/math.tau,(p.y-HEM)/HEIGHT)

# Closed rest volumes overlap at the shoulders, then become one continuous
# garment. Voxel fusion is done before posing; weights are projected afterwards.
body=grid('Jacket volume / body',80,44,coat,'oilskin',flip=True)
volumes=[body];sleeves={}
for side,label in [(-1,'L'),(1,'R')]:
 A=heads[f'Bip01 {label} UpperArm'];B=heads[f'Bip01 {label} Forearm'];C=heads[f'Bip01 {label} Hand']
 def sleeve_fn(u,v,A=A,B=B,C=C):
  if v<.5:
   t=(v-.08)/.42;p=A.lerp(B,t);d=(B-A).normalized();radius=(.018+.050*smoothstep(v/.12)) if v<.12 else .068*(1-max(0,t))+.053*max(0,t)
  else:
   t=(v-.5)/.5;p=B.lerp(C,t*.89);d=(C-B).normalized();radius=.053*(1-t)+.041*t
  x=d.cross(Vector((0,0,1))).normalized();z=d.cross(x).normalized();a=u*math.tau
  folds=(.0015+.0025*math.exp(-((v-.50)/.17)**2))*math.sin(v*42+a*2)+.0012*math.sin(a*5-v*9)
  return p+(radius+folds)*(x*math.cos(a)+z*math.sin(a))
 def sw(p,A=A,B=B,C=C,label=label):
  t=(p-A).dot((C-A).normalized())/(C-A).length;elbow=smoothstep((t-.37)/.25);attach=.78*(1-smoothstep(t/.20))
  return {f'Bip01 {label} Clavicle':attach,f'Bip01 {label} UpperArm':(1-elbow)*(1-attach),f'Bip01 {label} Forearm':elbow*(1-attach)}
 o=grid('Jacket volume / '+label+' sleeve',48,40,sleeve_fn,'oilskin',sw);volumes.append(o)
 sleeves[label]={'A':A,'B':B,'C':C,'axis':(C-B).normalized(),'weights':sw,'surface':sleeve_fn}

references=[];kd=KDTree(sum(len(o.data.vertices) for o in volumes));k=0
for o in volumes:
 names={g.index:g.name for g in o.vertex_groups}
 for v in o.data.vertices:
  references.append({names[g.group]:g.weight for g in v.groups});kd.insert(v.co,k);k+=1
kd.balance()
copies=[]
for o in volumes:
 me=o.data.copy();bm=bmesh.new();bm.from_mesh(me);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
 boundary=[e for e in bm.edges if e.is_boundary];bmesh.ops.holes_fill(bm,edges=boundary,sides=0)
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
 temp=bpy.data.objects.new('Jacket fusion volume',me);scene.collection.objects.link(temp);copies.append(temp)
for o in scene.objects:o.select_set(False)
for o in copies:o.select_set(True)
bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();shell=bpy.context.object
remesh=shell.modifiers.new('Weld shoulder and sleeve volumes','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.007
bpy.ops.object.modifier_apply(modifier=remesh.name)
sm=shell.modifiers.new('Relax the tailored shell','SMOOTH');sm.factor=.70;sm.iterations=14;bpy.ops.object.modifier_apply(modifier=sm.name)
for vertex in shell.data.vertices:
 p=engine(vertex.co)
 if abs(p.x)>.25:
  s=sleeves['L' if p.x<0 else 'R'];axis=(s['C']-s['A']).normalized();t=(p-s['A']).dot(axis)/(s['C']-s['A']).length
  radial=p-s['A']-axis*((p-s['A']).dot(axis));angle=math.atan2(radial.z,radial.y)
  fold=.0028*math.exp(-((t-.50)/.16)**2)*math.sin(t*48+angle*1.5)
  vertex.co+=coord(radial.normalized()*fold)
 elif p.y<1.27:
  a=math.atan2(p.z,p.x);fold=.0018*math.exp(-((p.y-1.05)/.13)**2)*math.sin(a*9+p.y*16)
  vertex.co+=coord(Vector((p.x,0,p.z)).normalized()*fold)
dec=shell.modifiers.new('Uniform game topology','DECIMATE');dec.ratio=.26;bpy.ops.object.modifier_apply(modifier=dec.name)
# Open the neck, lower hem and cuffs while retaining the welded armholes.
bm=bmesh.new();bm.from_mesh(shell.data);remove=[]
# True plane cuts leave sewn edges. Deleting whole voxel faces leaves a torn,
# stair-stepped hem and cuff even when the rest of the mesh is smooth.
bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=coord((0,HEM+.005,0)),plane_no=coord((0,1,0)))
for s in sleeves.values():
 bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=coord(s['C']-s['axis']*.038),plane_no=coord(s['axis']))
for f in bm.faces:
 p=engine(f.calc_center_median());cut=p.y<HEM+.005 or (p.y>1.491 and abs(p.x)<.10 and abs(p.z)<.095)
 for label,s in sleeves.items():
  axial=(p-s['C']).dot(s['axis']);radial=(p-s['C']-s['axis']*axial).length
  if axial>-.038 and radial<.075:cut=True
 # The open throat sits behind the turned-down collar and dark guernsey.
 if p.y>1.448 and abs(p.x)<.029 and p.z<-.055:cut=True
 if cut:remove.append(f)
bmesh.ops.delete(bm,geom=remove,context='FACES');bm.to_mesh(shell.data);bm.free()
pts=[engine(v.co) for v in shell.data.vertices];faces=[tuple(p.vertices) for p in shell.data.polygons];weights=[]
for v in shell.data.vertices:
 w={};near=kd.find_n(v.co,6);total=0
 for _,index,distance in near:
  strength=1/max(.000002,distance*distance);total+=strength
  for name,value in references[index].items():w[name]=w.get(name,0)+strength*value
 weights.append(torso(engine(v.co)) if engine(v.co).y<1.02 else {name:value/total for name,value in w.items()})
# Smooth influences across the fused armholes so the skin follows one piece of
# cloth. Localized nearest-surface weights otherwise leave a jagged seam in motion.
neighbors=[set() for p in pts]
for face in faces:
 for a,b in zip(face,face[1:]+face[:1]):neighbors[a].add(b);neighbors[b].add(a)
for iteration in range(6):
 previous=weights;weights=[]
 for i,p in enumerate(pts):
  amount=.45 if p.y>1.32 else .20 if p.y>1.02 else 0
  if not neighbors[i]:weights.append(previous[i]);continue
  w={name:value*(1-amount) for name,value in previous[i].items()}
  for j in neighbors[i]:
   for name,value in previous[j].items():w[name]=w.get(name,0)+value*amount/len(neighbors[i])
  weights.append(w)
jacket=make('Boatman / continuous tailored oilskin jacket',pts,faces,'oilskin',weights)
uv=jacket.data.uv_layers.new(name='UVMap')
for poly in jacket.data.polygons:
 values=[]
 for li in poly.loop_indices:
  p=pts[jacket.data.loops[li].vertex_index];best=min(sleeves.values(),key=lambda s:(p-s['A']).length)
  if abs(p.x)>.24 and (p-best['A']).length>.07:
   A=best['A'];C=best['C'];axis=(C-A).normalized();t=(p-A).dot(axis)/(C-A).length;centre=A+axis*((p-A).dot(axis))
   radial=p-centre;x=axis.cross(Vector((0,0,1))).normalized();z=axis.cross(x).normalized()
   values.append((math.atan2(radial.dot(z),radial.dot(x))/math.tau,1-t))
  else:values.append(coat_uv(p))
 if max(v[0] for v in values)-min(v[0] for v in values)>.7:values=[(u+1 if u<0 else u,v) for u,v in values]
 for li,value in zip(poly.loop_indices,values):uv.data[li].uv=value
bpy.data.objects.remove(shell,do_unlink=True)
for o in volumes:
 objects.remove(o);del o['boatman_finish'];o['tailoring_reference']=True
edge_uses={}
for face in faces:
 for a,b in zip(face,face[1:]+face[:1]):
  key=tuple(sorted((a,b)));edge_uses[key]=edge_uses.get(key,0)+1
hem_indices={i for edge,count in edge_uses.items() if count==1 for i in edge if abs(pts[i].y-(HEM+.005))<.00001}
hem_points=sorted((pts[i] for i in hem_indices),key=lambda p:math.atan2(p.z,p.x))
if hem_points:tube('Boatman / bound jacket hem',hem_points+[hem_points[0]],.0015,'oilskin',torso,n=6)

# Tailored front, raised edge stitching and genuine welt pockets. Every piece
# samples the same body-space fabric scale, avoiding rectangular colour patches.
def front(x,y,extra=.005):
 r,d=radii(y);a=math.asin(max(-.95,min(.95,x/r)));u=a/math.tau
 p=Vector(coat(u,(y-HEM)/HEIGHT));p.z-=extra;return p
def patch(name,fn,nu=12,nv=12,key='oilskin',weight=torso):
 o=grid(name,nu,nv,fn,key,weight,True)
 bm=bmesh.new();bm.from_mesh(o.data)
 for f in bm.faces:
  if engine(f.normal).z>0:f.normal_flip()
 bm.to_mesh(o.data);bm.free()
 for p in o.data.polygons:
  for li in p.loop_indices:o.data.uv_layers.active.data[li].uv=coat_uv(engine(o.data.vertices[o.data.loops[li].vertex_index].co))
 return o
patch('Boatman / soft storm fly',lambda u,v:front(-.014+u*.049,.978+v*.474,.009),6,30)
for x in [-.014,.035]:tube('Boatman / fly edge stitching',[front(x,.98+i/40*.47,.010) for i in range(41)],.00065,'oilskin')
for side in [-1,1]:
 # Slanted welt with a dark recess, rounded, thicker outer lip and short tacks.
 def welt(u,v,side=side):
  x=side*(.083+u*.103);y=1.087+u*.022+v*.014;return front(x,y,.008+v*.002)
 patch('Boatman / pocket welt',welt,20,4)
 tube('Boatman / pocket opening',[front(side*(.084+u/24*.101),1.100+u/24*.022,.011) for u in range(25)],.0015,'wool',n=6)
 for edge in [0,1]:tube('Boatman / pocket bartack',[welt(edge,i/5) for i in range(6)],.0010,'oilskin',n=6)
for j in range(6):
 y=1.00+j*.071;centre=front(.013,y,.015);r=.0075;n=16
 pts=[centre+Vector((r*math.cos(i/n*math.tau),r*math.sin(i/n*math.tau),-.001)) for i in range(n)]+[centre+Vector((0,0,-.002))]
 faces=[(n,(i+1)%n,i) for i in range(n)];make('Boatman / filled horn button',pts,faces,'horn',[torso(p) for p in pts],smooth=True)
 for x in [-.0018,.0018]:tube('Boatman / linen button thread',[centre+Vector((x,-.0018,-.0026)),centre+Vector((x,.0018,-.0026))],.00055,'oilskin',n=4)

# Turnover collar with a soft roll. The throat opens onto a knitted guernsey.
def collar(u,v):
 a=-math.pi/2+.30+u*(math.tau-.60);frontness=max(0,-math.sin(a));r=.080+.042*v
 y=1.497+.026*math.sin(v*math.pi)-v*(.018+.055*frontness)
 return(r*math.cos(a),y,(.091+.072*v)*math.sin(a)-.001)
collar_object=grid('Boatman / rolled collar',64,12,collar,'oilskin',torso)
assert 'SOLIDIFY' in [i.identifier for i in bpy.types.Modifier.bl_rna.properties['type'].enum_items]
for o in scene.objects:o.select_set(False)
collar_object.select_set(True);bpy.context.view_layer.objects.active=collar_object
solid=collar_object.modifiers.new('Soft doubled collar cloth','SOLIDIFY');solid.thickness=.0018
while list(collar_object.modifiers).index(solid)>0:bpy.ops.object.modifier_move_up(modifier=solid.name)
bpy.ops.object.modifier_apply(modifier=solid.name)
tube('Boatman / collar stitched edge',[collar(i/80,1) for i in range(81)],.0010,'oilskin')
def knit_grid(name,nu,nv,fn,weight,uv_scale,flip=True):
 o=grid(name,nu,nv,fn,'knit',weight,flip)
 for loop in o.data.uv_layers.active.data:loop.uv.x*=uv_scale[0];loop.uv.y*=uv_scale[1]
 return o
knit_grid('Boatman / shaped guernsey neck',48,16,lambda u,v:((.073+.025*(1-v))*math.cos(u*math.tau),1.422+v*.118,(.086+.045*(1-v))*math.sin(u*math.tau)),torso,(1.8,.46))
grid('Boatman / covered waistband',48,8,lambda u,v:(.208*math.cos(u*math.tau),.865+v*.14,.131*math.sin(u*math.tau)),'wool',lambda p:{'Bip01 Pelvis':1},True)
for side,label in [(-1,'L'),(1,'R')]:
 s=sleeves[label];C=s['C'];axis=s['axis'];x=axis.cross(Vector((0,0,1))).normalized();z=axis.cross(x).normalized();weight=s['weights']
 def cuff(u,v,C=C,axis=axis,x=x,z=z):
  a=u*math.tau;r=.033+.001*math.cos(a*30);return C+axis*(-.051+v*.060)+r*(x*math.cos(a)+z*math.sin(a))
 def cw(p,label=label,C=C,axis=axis):
  hand=.60*smoothstep(((p-C).dot(axis)+.025)/.035);return{f'Bip01 {label} Forearm':1-hand,f'Bip01 {label} Hand':hand}
 knit_grid('Boatman / '+label+' fitted wool cuff',48,12,cuff,cw,(1.4,.25),False)
 def lip(u,v,C=C,axis=axis,x=x,z=z):
  a=u*math.tau;r=.044-.010*v;return C-axis*(.038-.004*math.sin(v*math.pi))+r*(x*math.cos(a)+z*math.sin(a))
 grid('Boatman / '+label+' rolled sleeve opening',48,5,lip,'oilskin',weight)

# A shallow, soft, asymmetrical watch cap; the normal map carries the yarn.
def cap(u,v):
 a=u*math.tau;t=v*math.pi/2;r=.098*max(0,math.cos(t))**.92
 r+=.0017*math.sin(a*5+v*4)*math.sin(v*math.pi)*(1-v)
 return(r*math.cos(a)+.032*v*v,1.739+.099*math.sin(t)+.002*math.sin(a*3)*(1-v)*v,r*1.01*math.sin(a)-.025+.007*v*v)
knit_grid('Boatman / soft knitted cap crown',80,20,cap,lambda p:{'Bip01 Head':1},(3,.55))
def band(u,v):
 a=u*math.tau;r=.1005+.0035*math.sin(v*math.pi)+.0006*math.cos(a*60)
 return(r*math.cos(a),1.710-.005*math.sin(a)+v*.033,r*1.01*math.sin(a)-.025)
knit_grid('Boatman / folded wool cap band',80,10,band,lambda p:{'Bip01 Head':1},(3,.19))

# The original baseball cap's adjustment strap shares the head mesh and atlas.
# Replace that rear patch with a rounded neck and cropped hair, rather than
# carrying the rectangular strap and buckle into the new watch cap.
head_mesh=next(o for o in objects if o.name.startswith('Boatman / retained head'))
neck_samples=KDTree(len(head_mesh.data.vertices));neck_uv={};loop_uv={}
for loop in head_mesh.data.loops:
 loop_uv.setdefault(loop.vertex_index,head_mesh.data.uv_layers.active.data[loop.index].uv.copy())
count=0
for vertex in head_mesh.data.vertices:
 p=engine(vertex.co)
 if p.z<-.015 and 1.48<p.y<1.55 and abs(p.x)<.055:
  neck_samples.insert(p,count);neck_uv[count]=loop_uv[vertex.index];count+=1
neck_samples.balance();assert count>0
# NAPE_COLOUR_BEGIN
head_image=next(n.image for n in materials['head'].node_tree.nodes if n.type=='TEX_IMAGE' and n.image and 'head_color' in n.image.name)
iw,ih=head_image.size;skin_samples=[]
for vertex in head_mesh.data.vertices:
 p=engine(vertex.co)
 if not (.025<abs(p.x)<.065 and 1.615<p.y<1.655 and p.z<-.065):continue
 uv=loop_uv[vertex.index];px=max(0,min(iw-1,int(uv.x*iw)));py=max(0,min(ih-1,int(uv.y*ih)));index=(py*iw+px)*4
 r,g,b=(head_image.pixels[index+i] for i in range(3))
 if .035<r<.65 and r>g*1.08 and g>b*1.12:
  # Byte-image pixels are display encoded; glTF colour factors are linear.
  rgb=(r,g,b) if head_image.is_float else tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in (r,g,b))
  skin_samples.append(Vector(rgb))
skin_color=sum(skin_samples,Vector())/len(skin_samples) if skin_samples else Vector((.22,.11,.055))
# NAPE_COLOUR_END
nape_material=bpy.data.materials.new('Boatman / nape skin');nape_material.use_nodes=True
nb=next(n for n in nape_material.node_tree.nodes if n.type=='BSDF_PRINCIPLED');nb.inputs['Base Color'].default_value=(*skin_color,1);nb.inputs['Roughness'].default_value=.82
materials['nape']=nape_material
# The rear hair uses a dark, fine grain instead of a single untextured plate.
cloth_material('stubble',(.010,.0075,.0045),.96,180,.18)
bm=bmesh.new();bm.from_mesh(head_mesh.data)
rear=[f for f in bm.faces if (lambda p:p.z>.015 and p.y>1.52 and abs(p.x)<.082)(engine(f.calc_center_median()))]
bmesh.ops.delete(bm,geom=rear,context='FACES');bm.to_mesh(head_mesh.data);bm.free()
def nape_shape(a,y,extra=0):
 t=smoothstep((y-1.55)/.13);rx=.050+.032*t+extra;rz=.033+.035*t+extra
 return(rx*math.cos(a),y,rz*math.sin(a)-.004)
def nape_weights(p):
 k=smoothstep((p.y-1.54)/.09);return{'Bip01 Neck':1-k,'Bip01 Head':k}
skin=grid('Boatman / rounded nape skin',24,8,lambda u,v:nape_shape(u*math.pi,1.49+v*.145),'nape',nape_weights,True)
for loop in skin.data.loops:
 p=engine(skin.data.vertices[loop.vertex_index].co);query=Vector((max(-.035,min(.035,p.x)),min(1.535,p.y),-.052))
 _,index,_=neck_samples.find(query);skin.data.uv_layers.active.data[loop.index].uv=neck_uv[index]
def cropped_hair(u,v):
 a=u*math.pi;low=1.575+.035*abs(math.cos(a))**1.5;y=low+v*(1.745-low)
 return nape_shape(a,y,.0014)
grid('Boatman / close cropped nape hair',32,10,cropped_hair,'stubble',nape_weights,True)
hair_rng=random.Random(1901);hair_points=[];hair_faces=[]
for i in range(180):
 u=hair_rng.random();v=hair_rng.random();p=Vector(cropped_hair(u,v));a=u*math.pi
 normal=Vector((math.cos(a),0,math.sin(a)));tangent=Vector((-math.sin(a),0,math.cos(a)))*.00025
 end=p+normal*.0005+Vector((0,-.0012,0));j=len(hair_points)
 hair_points.extend([p-tangent,p+tangent,end+tangent*.25,end-tangent*.25]);hair_faces.append((j,j+1,j+2,j+3))
make('Boatman / short nape fibres',hair_points,hair_faces,'stubble',[nape_weights(p) for p in hair_points],[(0,0),(1,0),(1,1),(0,1)]*180)
scene['tailoring_pass']=2
print(json.dumps({'tailoring':'welded shoulder shell, turnover collar, welt pockets, fitted cuffs, baked yarn loops','shell_vertices':len(jacket.data.vertices),'shell_faces':len(jacket.data.polygons)}))
