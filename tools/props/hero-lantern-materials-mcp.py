"""Editable material study for the authored hero lantern; geometry is unchanged.
Runtime equivalents live in src/station/HandLampMaterials.js.
"""
import bpy
from pathlib import Path
ROOT=Path('C:/Users/thisi/OneDrive/Documents/flannan')
OUT=ROOT/'artifacts/lantern-materials/blender';OUT.mkdir(parents=True,exist_ok=True)
sources=[s for s in bpy.data.scenes if s.name.startswith('Seven Hunters - hero storm lantern')]
source=next((s for s in reversed(sources) if not s.name.endswith('materials')),sources[-1])
scene=bpy.data.scenes.new('Seven Hunters - lantern metal and glass materials')
scene['provenance']='Object-space material reconstruction: restrained handling wear, metal scratches and combustion soot.'
copies={}
for original in source.objects:
 o=original.copy()
 if original.type=='MESH':o.data=original.data.copy()
 scene.collection.objects.link(o);copies[original]=o
for original,o in copies.items():o.parent=copies.get(original.parent)
root=next(o for o in scene.objects if o.type=='EMPTY')
scene.camera=copies[source.camera];scene.world=source.world.copy()
bpy.context.window.scene=scene
valid_math={item.identifier for item in bpy.types.ShaderNodeMath.bl_rna.properties['operation'].enum_items}
materials={}
for finish,color,metal,rough in [
 ('tin',(.287,.314,.270,1),.98,.29),('steel',(.479,.509,.456,1),1,.23),
 ('brass',(.485,.296,.100,1),.96,.30),('black',(.014,.015,.011,1),0,.90),
 ('glass',(.776,.831,.761,1),0,.035),('flame',(1,.54,.13,1),0,.6)]:
 mat=bpy.data.materials.new('Lantern material study / '+finish);mat.use_nodes=True;mat.diffuse_color=color
 nodes=mat.node_tree.nodes;links=mat.node_tree.links
 bs=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
 bs.inputs['Base Color'].default_value=color;bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
 def set_input(socket,value):
  if hasattr(value,'node'):links.new(value,socket)
  else:socket.default_value=value
 def math(op,a,b=None,label=''):
  assert op in valid_math
  n=nodes.new('ShaderNodeMath');n.operation=op;n.label=label or op;set_input(n.inputs[0],a)
  if b is not None:set_input(n.inputs[1],b)
  return n.outputs[0]
 def ramp(value,low,high,color0,color1,label):
  n=nodes.new('ShaderNodeValToRGB');n.label=label;links.new(value,n.inputs[0])
  n.color_ramp.elements[0].position=low;n.color_ramp.elements[0].color=color0
  n.color_ramp.elements[1].position=high;n.color_ramp.elements[1].color=color1
  return n.outputs['Color']
 def mix(factor,a,b,label):
  n=nodes.new('ShaderNodeMixRGB');n.label=label;set_input(n.inputs[0],factor);set_input(n.inputs[1],a);set_input(n.inputs[2],b);return n.outputs[0]
 tex=nodes.new('ShaderNodeTexCoord');tex.object=root;tex.label='Metres in lantern frame'
 noise=nodes.new('ShaderNodeTexNoise');noise.label='Millimetre tarnish';links.new(tex.outputs['Object'],noise.inputs['Vector']);noise.inputs['Scale'].default_value=145;noise.inputs['Detail'].default_value=2
 micro=nodes.new('ShaderNodeTexNoise');micro.label='Microscopic metal relief';links.new(tex.outputs['Object'],micro.inputs['Vector']);micro.inputs['Scale'].default_value=3300;micro.inputs['Detail'].default_value=1
 mapping=nodes.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';links.new(tex.outputs['Object'],mapping.inputs[0]);mapping.inputs[1].default_value=(120,2300,150)
 scratchNoise=nodes.new('ShaderNodeTexNoise');scratchNoise.label='Fine drawn-metal scratches';links.new(mapping.outputs[0],scratchNoise.inputs['Vector']);scratchNoise.inputs['Scale'].default_value=1;scratchNoise.inputs['Detail'].default_value=2
 scratches=ramp(scratchNoise.outputs['Fac'],.62,.73,(0,0,0,1),(.18,.18,.18,1),'Sparse hairline scratches')
 xyz=nodes.new('ShaderNodeSeparateXYZ');links.new(tex.outputs['Object'],xyz.inputs[0])
 if finish=='glass':
  top=math('MULTIPLY',math('SUBTRACT',xyz.outputs['Z'],.177),1/.041,'Soot rises under hood')
  top=math('MINIMUM',math('MAXIMUM',top,0),1)
  soot=math('MULTIPLY',top,math('ADD',math('MULTIPLY',noise.outputs['Fac'],.60),.32),'Irregular soot film')
  links.new(mix(soot,color,(.065,.047,.025,1),'Warm combustion residue'),bs.inputs['Base Color'])
  links.new(math('ADD',.025,math('MULTIPLY',soot,.32)),bs.inputs['Roughness'])
  links.new(math('SUBTRACT',1,math('MULTIPLY',soot,.32)),bs.inputs['Transmission Weight']);bs.inputs['IOR'].default_value=1.47
  bump=nodes.new('ShaderNodeBump');bump.label='Minute blown-glass waviness';bump.inputs['Strength'].default_value=.14;bump.inputs['Distance'].default_value=.000009;links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs[0],bs.inputs['Normal'])
 elif finish=='flame':
  bs.inputs['Emission Color'].default_value=(1,.42,.08,1);bs.inputs['Emission Strength'].default_value=4
 else:
  tarnish=ramp(noise.outputs['Fac'],.36,.79,(0,0,0,1),(.11,.11,.11,1),'Thin patchy oxidation')
  oxide=(.12,.075,.027,1) if finish=='brass' else (.075,.083,.075,1)
  base=mix(tarnish,color,oxide,'Metal beneath oxidation')
  base=mix(scratches,base,tuple(min(1,c*1.20) for c in color[:3])+(1,),'Exposed scratch highlights')
  # Thin soot accumulates on the burner gallery and the underside of the hood.
  soot=ramp(xyz.outputs['Z'],.208,.240,(0,0,0,1),(.18,.18,.18,1),'Heat-darkened hood')
  links.new(mix(soot,base,(.012,.010,.008,1),'Restrained soot'),bs.inputs['Base Color'])
  roughField=math('ADD',rough,math('MULTIPLY',noise.outputs['Fac'],.06),'Varied metal roughness')
  links.new(roughField,bs.inputs['Roughness'])
  bump=nodes.new('ShaderNodeBump');bump.label='Micron relief, no silhouette damage';bump.inputs['Strength'].default_value=.15;bump.inputs['Distance'].default_value=.000002
  links.new(math('ADD',math('MULTIPLY',micro.outputs['Fac'],.4),scratches),bump.inputs['Height']);links.new(bump.outputs[0],bs.inputs['Normal'])
 # Spread the node graph for direct editing.
 for i,n in enumerate(nodes):
  if n.type not in ['BSDF_PRINCIPLED','OUTPUT_MATERIAL']:n.location=(-1100+(i%5)*200,400-(i//5)*190)
 bs.location=(100,100);next(n for n in nodes if n.type=='OUTPUT_MATERIAL').location=(440,100)
 materials[finish]=mat
for o in scene.objects:
 if o.type=='MESH' and o.get('finish') in materials:
  o.data.materials.clear();o.data.materials.append(materials[o['finish']])
scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.render.resolution_x=1100;scene.render.resolution_y=1300;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/'lantern-materials.png')
text=bpy.data.texts.new('hero-lantern-materials-mcp.py');text.write((ROOT/'tools/props/hero-lantern-materials-mcp.py').read_text(encoding='utf-8'))
bpy.data.libraries.write(str(ROOT/'tools/props/hero-lantern-materials.blend'),{scene,text},fake_user=True,compress=True)
print({'scene':scene.name,'sourceScenePreserved':source.name,'materials':list(materials),'geometry':'unchanged'})
bpy.ops.render.render(write_still=True)
