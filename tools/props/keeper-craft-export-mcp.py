"""Run after keeper-craft-mcp.py in its isolated Blender scene."""
from pathlib import Path
import bpy, bmesh, math, json
from mathutils import Vector
ROOT=Path('C:/Users/thisi/OneDrive/Documents/flannan')
helpers=(ROOT/'tools/props/room-craft-mcp.py').read_text(encoding='utf-8').split('# Chair:')[0]
helpers=helpers.replace("OUT = ROOT/'artifacts/room-craft/blender'", "OUT = ROOT/'artifacts/keeper-craft/blender'")
helpers=helpers.replace("bpy.data.scenes.new('Seven Hunters - room furniture and objects')", 'bpy.context.scene')
exec(compile(helpers,'existing scene export helpers','exec'))
roots={o['model']:o.parent for o in scene.objects if o.type=='MESH' and o.get('model') and not o.get('review_only')}
functions=(ROOT/'tools/props/keeper-craft-mcp.py').read_text(encoding='utf-8').split('def ball(')[1].split('# Original box form')[0]
exec(compile('def ball('+functions,'craft surface helpers','exec'))
assert scene.get('craft_expansion'), 'Export only the isolated craft study.'

for M,opened in [('canvasBag',False),('canvasBagOpen',True)]:
 root(M,(3,0,-1.5))
 if not opened:
  surface('sewn canvas body',lambda u,v:((u-.5)*.80,.16*math.cos(v*math.tau)*(math.sin(u*math.pi)*.18+.82)+.006*math.sin(u*45+v*20),.17*math.sin(v*math.tau)*(math.sin(u*math.pi)*.18+.82)),28,24,M,'linen',.004)
  for s in [-1,1]:ball('rounded end',(s*.385,0,0),(.025,.137,.144),M,'linen',10,16)
 else:
  lathe('open oval body',(0,0,0),[(0,.035),(.30,.045),(.36,.09),(.395,.20),(.40,.28),(.392,.295),(.377,.28),(.372,.20),(.34,.10),(.28,.075),(0,.067)],M,'linen',48,scale=(1,1,.44))
  box('dark lining',(0,.075,0),(.57,.008,.22),M,'leather',.002)
 for s in [-1,1]:
  cord('leather straps',[(s*.23,.17*math.cos(i/32*math.tau),.18*math.sin(i/32*math.tau)) for i in range(33)],.009,M,'leather',6)
  box('strap buckle',(s*.23,.16,-.02),(.035,.007,.045),M,'brass',.003)
 cord('soft carrying handle',[(-.09,.14,0),(-.07,.23,0),(.07,.23,0),(.09,.14,0)],.012,M,'leather',7)

# A real pinned cloth study, simulated once and frozen in the export. Its
# .44 x .55 m panel is reused on a drying rail inside the station.
M='hangingCloth';root(M,(3.7,0,-1.5))
panel=surface('pinned linen panel',lambda u,v:((u-.5)*.44,-v*.55,.012*math.sin(u*math.pi*6)*v),24,30,M,'linen',0)
pin=panel.vertex_groups.new(name='top hem pins');pin.add(list(range(25)),1,'REPLACE')
cloth=panel.modifiers.new('Offline linen simulation','CLOTH');cloth.settings.quality=5;cloth.settings.mass=.18
cloth.settings.vertex_group_mass=pin.name;cloth.settings.tension_stiffness=18;cloth.settings.compression_stiffness=18
cloth.settings.shear_stiffness=6;cloth.settings.bending_stiffness=.8
cloth.point_cache.frame_start=1;cloth.point_cache.frame_end=24
for frame in range(1,25):scene.frame_set(frame)
bpy.context.view_layer.update()
evaluated=panel.evaluated_get(bpy.context.evaluated_depsgraph_get())
frozen=bpy.data.meshes.new_from_object(evaluated)
panel.modifiers.clear();panel.data=frozen;panel['simulated_frames']=24
solid=panel.modifiers.new('Frozen cloth thickness','SOLIDIFY');solid.thickness=.002
scene.frame_set(1)

# Bake a small seamless detail tile in Cycles. RG=tangent normal, B=roughness,
# A=ambient occlusion. Engine tint remains a separate finish parameter.
size=128
bake_mesh=bpy.data.meshes.new('Detail tile bake surface')
nu=32
pts=[(i/nu,j/nu,.0003*math.sin(i/nu*math.tau*8)*math.sin(j/nu*math.tau*8)) for j in range(nu+1) for i in range(nu+1)]
faces=[(j*(nu+1)+i,j*(nu+1)+i+1,(j+1)*(nu+1)+i+1,(j+1)*(nu+1)+i) for j in range(nu) for i in range(nu)]
bake_mesh.from_pydata(pts,[],faces);bake_mesh.update();uv=bake_mesh.uv_layers.new()
for poly in bake_mesh.polygons:
 poly.use_smooth=True
 for li in poly.loop_indices:
  p=bake_mesh.vertices[bake_mesh.loops[li].vertex_index].co;uv.data[li].uv=(p.x,p.y)
tile=bpy.data.objects.new('Review only / texture baking tile',bake_mesh);scene.collection.objects.link(tile);tile['review_only']=True;tile.location=(20,20,0)
mat=bpy.data.materials.new('Baked fine covering and cloth grain');mat.use_nodes=True;bake_mesh.materials.append(mat)
nt=mat.node_tree;bs=next(n for n in nt.nodes if n.type=='BSDF_PRINCIPLED')
texcoord=nt.nodes.new('ShaderNodeTexCoord');noise=nt.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=92;noise.inputs['Detail'].default_value=2
nt.links.new(texcoord.outputs['UV'],noise.inputs['Vector'])
ramp=nt.nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(.52,.52,.52,1);ramp.color_ramp.elements[1].color=(.94,.94,.94,1)
nt.links.new(noise.outputs['Fac'],ramp.inputs[0]);nt.links.new(ramp.outputs['Color'],bs.inputs['Roughness'])
bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.24;bump.inputs['Distance'].default_value=.0013
nt.links.new(noise.outputs['Fac'],bump.inputs['Height']);nt.links.new(bump.outputs['Normal'],bs.inputs['Normal'])
for o in scene.objects:o.select_set(False)
tile.select_set(True);bpy.context.view_layer.objects.active=tile
images={};scene.cycles.samples=8;scene.render.bake.margin=2
valid=[i.identifier for i in bpy.ops.object.bake.get_rna_type().properties['type'].enum_items]
for kind in ['NORMAL','ROUGHNESS','AO']:
 assert kind in valid, (kind,valid)
 im=bpy.data.images.new('Keeper detail / '+kind,width=size,height=size,alpha=True)
 im.colorspace_settings.name='Non-Color'
 node=nt.nodes.new('ShaderNodeTexImage');node.image=im;nt.nodes.active=node
 bpy.ops.object.bake(type=kind)
 im.filepath_raw=str(OUT/('detail-'+kind.lower()+'.png'))
 formats=[i.identifier for i in im.bl_rna.properties['file_format'].enum_items]
 assert 'PNG' in formats;im.file_format='PNG';im.save();im.pack();images[kind]=im
normal=list(images['NORMAL'].pixels);rough=list(images['ROUGHNESS'].pixels);ao=list(images['AO'].pixels)
detail=[]
for i in range(size*size):detail.extend([round(normal[i*4]*255),round(normal[i*4+1]*255),round(rough[i*4]*255),round(ao[i*4]*255)])
tile.hide_render=True;tile.hide_viewport=True

def collect(lod):
 data={};cache={};deps=bpy.context.evaluated_depsgraph_get()
 for obj in list(scene.objects):
  if obj.type!='MESH' or not obj.get('model') or obj.get('review_only'):continue
  name=obj['model'];finish=obj['finish'];dec=None
  if lod=='far' and len(obj.data.polygons)>12:
   dec=obj.modifiers.new('Export-only distance reduction','DECIMATE');dec.ratio=.32
   bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
  out=data.setdefault(name,{}).setdefault(finish,{'p':[],'n':[],'uv':[],'idx':[]});indices=cache.setdefault((name,finish),{})
  ev=obj.evaluated_get(deps);me=ev.to_mesh();me.calc_loop_triangles()
  transform=obj.parent.matrix_world.inverted() @ ev.matrix_world
  normals=transform.to_3x3().inverted().transposed()
  for tri in me.loop_triangles:
   ps=[transform@me.vertices[me.loops[li].vertex_index].co for li in tri.loops]
   if (ps[1]-ps[0]).cross(ps[2]-ps[0]).length<1e-12:continue
   for li in tri.loops:
    p=uncoord(transform@me.vertices[me.loops[li].vertex_index].co);n=uncoord((normals@me.corner_normals[li].vector).normalized())
    # Stable physical UVs; the small tile repeats every six centimetres.
    if abs(n[2])>.5:uv=(p[0]/.06,p[1]/.06)
    elif abs(n[0])>.5:uv=(p[2]/.06,p[1]/.06)
    else:uv=(p[0]/.06,p[2]/.06)
    values=tuple(round(float(v),6) for v in (*p,*n,*uv))
    if values not in indices:
     indices[values]=len(out['p'])//3;out['p'].extend(values[:3]);out['n'].extend(values[3:6]);out['uv'].extend(values[6:])
    out['idx'].append(indices[values])
  ev.to_mesh_clear()
  if dec:obj.modifiers.remove(dec)
 return data

bpy.context.view_layer.update()
near=collect('near');far=collect('far')
data={'models':{key:{'near':near[key],'far':far[key]} for key in near},'detail':{'size':size,'rgba':detail},'rig':{'upper':.34,'fore':.32,'palm':.08,'grip':.32},'provenance':'Authored reconstruction; all earlier Blender scenes retained.'}
path=ROOT/'src/world/flannan/KeeperCraftModel.js'
path.write_text('// GENERATED through live Blender MCP. Metres, Y up. Editable source: tools/props/keeper-craft.blend.\nexport const KEEPER_CRAFT_MODEL = '+json.dumps(data,separators=(',',':'))+';\n',encoding='utf-8')
counts={name:{lod:sum(len(g['idx'])//3 for g in data['models'][name][lod].values()) for lod in ['near','far']} for name in near}
summary={'models':counts,'near_triangles':sum(c['near'] for c in counts.values()),'far_triangles':sum(c['far'] for c in counts.values()),'baked_texture':{'size':size,'channels':'RG normal, B roughness, A AO'},'frozen_cloth_frames':24,'source_scene_retained':True,'export':str(path)}
(OUT/'export-summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
exec(compile((ROOT/'tools/props/keeper-hands-rig-mcp.py').read_text(encoding='utf-8'),'keeper-hands-rig-mcp.py','exec'))
texts=[]
for name in ['keeper-craft-mcp.py','keeper-craft-export-mcp.py','keeper-hands-rig-mcp.py']:
 t=bpy.data.texts.new(name);t.write((ROOT/'tools/props'/name).read_text(encoding='utf-8'));texts.append(t)
bpy.data.libraries.write(str(ROOT/'tools/props/keeper-craft.blend'),set([scene]+texts),fake_user=True,compress=True)
print(json.dumps(summary))
