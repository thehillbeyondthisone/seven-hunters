"""Bake wardrobe finishes, preserve editable construction, export near/far skins."""
import bpy,math,json
from pathlib import Path
from mathutils import Vector
ROOT=Path('C:/Users/thisi/OneDrive/Documents/flannan');OUT=ROOT/'artifacts/boatman';OUT.mkdir(parents=True,exist_ok=True)
scene=bpy.context.scene;assert scene.get('boatman_adaptation')
arm=next(o for o in scene.objects if o.get('boatman_skeleton'))
objects=[o for o in scene.objects if o.get('boatman_finish') and not o.hide_render]
assert not any(o.get('tailoring_reference') for o in objects), 'Construction volumes must not enter the game mesh'
manifest=json.loads((OUT/'design-manifest.json').read_text())

# Bake the cloth's microscopic surface into a reusable texture tile. Geometry
# carries the large folds, seams and silhouette. The game loads only PBR images.
try:scene.render.engine='CYCLES'
except TypeError as error:raise RuntimeError('Cycles is required for wardrobe baking: '+str(error))
scene.cycles.samples=8;scene.render.bake.margin=2
mesh=bpy.data.meshes.new('Wardrobe texture bake tile');mesh.from_pydata([(0,0,0),(1,0,0),(1,1,0),(0,1,0)],[],[(0,1,2,3)]);mesh.update()
uv=mesh.uv_layers.new(name='UVMap')
for li,p in enumerate([(0,0),(1,0),(1,1),(0,1)]):uv.data[li].uv=p
tile=bpy.data.objects.new('Review only / wardrobe baking plane',mesh);scene.collection.objects.link(tile);tile.location=(20,20,0)
valid=[i.identifier for i in bpy.ops.object.bake.get_rna_type().properties['type'].enum_items]
assert all(k in valid for k in ['EMIT','NORMAL'])
for o in scene.objects:o.select_set(False)
tile.select_set(True);bpy.context.view_layer.objects.active=tile
baked={}
for key,size in [('oilskin',1024),('wool',512),('knit',1024),('stubble',512),('leather',256)]:
 material=next(o.data.materials[0] for o in objects if o['boatman_finish']==key);mesh.materials.clear();mesh.materials.append(material)
 nt=material.node_tree;bs=next(n for n in nt.nodes if n.type=='BSDF_PRINCIPLED');out=next(n for n in nt.nodes if n.type=='OUTPUT_MATERIAL')
 emission=nt.nodes.new('ShaderNodeEmission');images={}
 for kind in ['albedo','normal','orm']:
  im=bpy.data.images.new('Boatman '+key+' '+kind,width=size,height=size,alpha=False)
  if kind!='albedo':im.colorspace_settings.name='Non-Color'
  target=nt.nodes.new('ShaderNodeTexImage');target.image=im;nt.nodes.active=target
  if kind=='normal':nt.links.new(bs.outputs['BSDF'],out.inputs['Surface'])
  else:
   if kind=='albedo':nt.links.new(bs.inputs['Base Color'].links[0].from_socket,emission.inputs['Color'])
   else:
    combine=nt.nodes.new('ShaderNodeCombineColor');combine.inputs['Red'].default_value=1;combine.inputs['Blue'].default_value=0
    nt.links.new(bs.inputs['Roughness'].links[0].from_socket,combine.inputs['Green']);nt.links.new(combine.outputs[0],emission.inputs['Color'])
   nt.links.new(emission.outputs[0],out.inputs['Surface'])
  bpy.ops.object.bake(type='NORMAL' if kind=='normal' else 'EMIT')
  formats=[i.identifier for i in im.bl_rna.properties['file_format'].enum_items]
  fmt='PNG' if kind=='normal' else 'JPEG';assert fmt in formats
  im.file_format=fmt;im.filepath_raw=str(OUT/(f'{key}-{kind}.'+('png' if fmt=='PNG' else 'jpg')));im.save();im.pack();images[kind]=im
 # Rebuild a glTF-compatible metallic/roughness material with baked maps.
 nt.nodes.clear();out=nt.nodes.new('ShaderNodeOutputMaterial');bs=nt.nodes.new('ShaderNodeBsdfPrincipled');nt.links.new(bs.outputs[0],out.inputs['Surface'])
 for kind,im in images.items():
  node=nt.nodes.new('ShaderNodeTexImage');node.image=im
  if kind=='albedo':nt.links.new(node.outputs['Color'],bs.inputs['Base Color'])
  elif kind=='normal':
   normal=nt.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.85 if key=='knit' else .45;nt.links.new(node.outputs['Color'],normal.inputs['Color']);nt.links.new(normal.outputs[0],bs.inputs['Normal'])
  else:
   sep=nt.nodes.new('ShaderNodeSeparateColor');nt.links.new(node.outputs[0],sep.inputs[0]);nt.links.new(sep.outputs['Green'],bs.inputs['Roughness']);nt.links.new(sep.outputs['Blue'],bs.inputs['Metallic'])
 baked[key]=size
tile.hide_render=True;tile.hide_set(True)

# Keep the individual tailored pieces, and use copies for the merged game mesh.
construction=bpy.data.collections.new('Wardrobe construction - editable pieces');scene.collection.children.link(construction)
copies=[]
for original in objects:
 o=original.copy();o.data=original.data.copy();scene.collection.objects.link(o);copies.append(o)
 for coll in list(original.users_collection):coll.objects.unlink(original)
 construction.objects.link(original);original.hide_render=True;original.hide_set(True)
for o in scene.objects:o.select_set(False)
for o in copies:o.hide_set(False);o.select_set(True)
bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();near=bpy.context.object;near.name='Boatman near'
near['boatman_lod']='near';near['source']='Rocketbox Joe (MIT), authored wardrobe and rowing performance'
far=near.copy();far.data=near.data.copy();scene.collection.objects.link(far);far.name='Boatman far';far['boatman_lod']='far'
for o in scene.objects:o.select_set(False)
far.select_set(True);bpy.context.view_layer.objects.active=far
deform=next(m for m in far.modifiers if m.type=='ARMATURE');deform.show_viewport=False
dec=far.modifiers.new('Distance geometry reduction','DECIMATE');dec.ratio=.36
bpy.ops.object.modifier_apply(modifier=dec.name);deform.show_viewport=True
far.hide_render=True;far.hide_set(True)

action=arm.animation_data.action
track=arm.animation_data.nla_tracks.new();track.name='rowing';strip=track.strips.new('rowing',1,action)
if hasattr(strip,'action_slot') and action.slots:strip.action_slot=action.slots[0]
arm.animation_data.action=None
scene.frame_set(24);bpy.context.view_layer.update()

# Selected-only export excludes the reference Joe, source construction and stage.
for o in scene.objects:o.select_set(False)
for o in [arm,near,far]:o.hide_set(False);o.select_set(True)
bpy.context.view_layer.objects.active=arm
op=bpy.ops.export_scene.gltf.get_rna_type().properties
formats=[i.identifier for i in op['export_format'].enum_items]
assert not formats or 'GLB' in formats # Blender's dynamic format enum may be empty here.
assert 'NLA_TRACKS' in [i.identifier for i in op['export_animation_mode'].enum_items]
asset=ROOT/'public/models/characters/boatman.glb'
bpy.ops.export_scene.gltf(filepath=str(asset),export_format='GLB',use_selection=True,use_active_scene=True,export_skins=True,
 export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,
 export_optimize_animation_size=True,export_def_bones=False,export_morph=False,
 export_yup=True,export_apply=False,export_cameras=False,export_lights=False)
far.hide_render=True;far.hide_set(True)
counts={}
for name,o in [('near',near),('far',far)]:o.data.calc_loop_triangles();counts[name]=len(o.data.loop_triangles)
manifest.update({'triangles':counts,'baked_textures':baked,'glb_bytes':asset.stat().st_size,'materials':[m.name for m in near.data.materials],'export':str(asset),'row_clip':'rowing'})
(ROOT/'public/models/characters/boatman-manifest.json').write_text(json.dumps(manifest,indent=2))
(OUT/'export-summary.json').write_text(json.dumps(manifest,indent=2))

def coord(v):return Vector((v[0],-v[2],v[1]))
world=bpy.data.worlds.new('Boatman portrait studio');world.use_nodes=True;scene.world=world
bg=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs[0].default_value=(.09,.115,.13,1);bg.inputs[1].default_value=.5
for name,at,power,size,color in [('Soft north light',(-1.6,2.7,-2.5),180,2.1,(.72,.84,1)),('Warm reflection',(1.8,1.5,-1.2),65,1.5,(1,.78,.52)),('Sea rim',(.5,2.2,1.5),210,1.8,(.7,.82,1))]:
 ld=bpy.data.lights.new(name,'AREA');ld.energy=power;ld.size=size;ld.color=color;o=bpy.data.objects.new(name,ld);scene.collection.objects.link(o);o.location=coord(at);o.rotation_euler=(coord((0,1.36,-.42))-o.location).to_track_quat('-Z','Y').to_euler()
cam=bpy.data.cameras.new('Boatman portrait');cam.lens=65
o=bpy.data.objects.new('Boatman portrait',cam);scene.collection.objects.link(o);o.location=coord((.75,1.60,-2.85));o.rotation_euler=(coord((0,1.30,-.48))-o.location).to_track_quat('-Z','Y').to_euler();scene.camera=o
scene.cycles.samples=48;scene.cycles.use_denoising=True;scene.render.resolution_x=1200;scene.render.resolution_y=1400;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/'blender-portrait.png')
texts=[]
for name in ['boatman-mcp.py','boatman-tailoring-mcp.py','boatman-performance-mcp.py','boatman-fit-mcp.py','boatman-export-mcp.py']:
 t=bpy.data.texts.new(name);t.write((ROOT/'tools/characters'/name).read_text(encoding='utf-8'));texts.append(t)
bpy.data.libraries.write(str(ROOT/'tools/characters/boatman.blend'),set([scene]+texts),fake_user=True,compress=True)
print(json.dumps({'triangles':counts,'bytes':asset.stat().st_size,'bone_count':len(arm.data.bones),'materials':len(near.data.materials),'saved':'tools/characters/boatman.blend'}))
bpy.ops.render.render(write_still=True)
