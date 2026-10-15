"""Execute in the instrument scene through Blender MCP after instruments-mcp.py."""
import bpy, json, math
from pathlib import Path
from mathutils import Vector
ROOT=Path('C:/Users/fillt/Desktop/flannan')
OUT=ROOT/'artifacts/instruments/blender'; OUT.mkdir(parents=True,exist_ok=True)
scene=bpy.context.scene
assert scene.name.startswith('Flannan instruments'), 'Only export the isolated instrument scene.'

def coord(v): return Vector((v[0],-v[2],v[1]))
def uncoord(v): return (v[0],v[2],-v[1])
def rounded(x): return round(float(x),6)

data={'barometer':{},'thermometer':{},'telescope':{}}
vertices={}
deps=bpy.context.evaluated_depsgraph_get()
counts={}
for obj in scene.objects:
 if obj.type!='MESH' or 'instrument' not in obj or obj.get('review_only'): continue
 instrument=obj['instrument']; finish=obj['finish']; out=data[instrument].setdefault(finish,{'p':[],'n':[],'uv':[],'idx':[]})
 evaluated=obj.evaluated_get(deps); mesh=evaluated.to_mesh(); mesh.calc_loop_triangles()
 transform=obj.parent.matrix_world.inverted() @ evaluated.matrix_world
 normal_matrix=transform.to_3x3().inverted().transposed()
 for triangle in mesh.loop_triangles:
  tri=[transform @ mesh.vertices[mesh.loops[i].vertex_index].co for i in triangle.loops]
  if (tri[1]-tri[0]).cross(tri[2]-tri[0]).length < 1e-12: continue
  for loop_index in triangle.loops:
   loop=mesh.loops[loop_index]; p=uncoord(transform @ mesh.vertices[loop.vertex_index].co)
   n=uncoord((normal_matrix @ mesh.corner_normals[loop_index].vector).normalized())
   # Physical UV scale, wood grain follows the longest visible member.
   if abs(n[2])>.5: uv=(p[1],p[0])
   elif abs(n[0])>.5: uv=(p[1],p[2])
   else: uv=(p[0],p[2])
   values=tuple(map(rounded,(*p,*n,*uv)))
   cache=vertices.setdefault((instrument,finish),{})
   index=cache.get(values)
   if index is None:
    index=len(out['p'])//3; cache[values]=index
    out['p'].extend(values[:3]); out['n'].extend(values[3:6]); out['uv'].extend(values[6:])
   out['idx'].append(index)
 evaluated.to_mesh_clear()
for name,finishes in data.items(): counts[name]=sum(len(p['idx'])//3 for p in finishes.values())
path=ROOT/'src/world/flannan/InstrumentModel.js'
path.write_text('// GENERATED through Blender MCP from tools/props/instruments.blend.\n// Metres, engine Y up. Wall instrument origins are their live dial centres; +Z faces out.\n// Telescope lies on X, objective at -X. Reconstructions, not recovered Flannan inventory.\nexport const INSTRUMENT_MODEL = '+json.dumps(data,separators=(',',':'))+';\n',encoding='utf-8')
(OUT/'export-summary.json').write_text(json.dumps({'triangles':counts,'total_triangles':sum(counts.values()),'original_scene_retained':'Scene','engine_export':str(path)},indent=2))

# Textured faces are authoring previews; the engine retains its existing live textures.
roots={o['instrument']:o for o in scene.objects if o.type=='EMPTY' and 'instrument' in o}
def preview_face(name):
 if name=='barometer':
  verts=[coord((0,0,0))]; uv=[(.5,.5)]
  for i in range(65):
   a=i/64*math.tau; verts.append(coord((.094*math.cos(a),.094*math.sin(a),0))); uv.append((.5+.5*math.cos(a),.5+.5*math.sin(a)))
  faces=[(0,i+1,i+2) for i in range(64)]
 else:
  verts=[coord((x,y,0)) for x,y in [(-.065,-.26),(.065,-.26),(.065,.26),(-.065,.26)]]
  uv=[(0,0),(1,0),(1,1),(0,1)]; faces=[(0,1,2,3)]
 mesh=bpy.data.meshes.new(name+' face preview'); mesh.from_pydata(verts,[],faces); mesh.update()
 texcoord=mesh.uv_layers.new(name='Face UV')
 for polygon in mesh.polygons:
  for loop_index in polygon.loop_indices: texcoord.data[loop_index].uv=uv[mesh.loops[loop_index].vertex_index]
 o=bpy.data.objects.new(name+' / face preview',mesh); scene.collection.objects.link(o); o.parent=roots[name]; o['review_only']=True
 m=bpy.data.materials.new(name+' / existing dial texture'); m.use_nodes=True
 nt=m.node_tree; tex=nt.nodes.new('ShaderNodeTexImage'); tex.image=bpy.data.images.load(str(ROOT/'public/instruments'/f'{name}.png'),check_existing=True); tex.image.pack()
 nt.links.new(tex.outputs['Color'],nt.nodes['Principled BSDF'].inputs['Base Color']); nt.nodes['Principled BSDF'].inputs['Roughness'].default_value=.78
 mesh.materials.append(m)
preview_face('barometer'); preview_face('thermometer')

def preview_readout(name,vertices,instrument,color):
 mesh=bpy.data.meshes.new(name); mesh.from_pydata([coord(v) for v in vertices],[],[(0,1,2,3)]); mesh.update()
 obj=bpy.data.objects.new(name,mesh); scene.collection.objects.link(obj); obj.parent=roots[instrument]; obj['review_only']=True
 m=bpy.data.materials.new(name); m.use_nodes=True; m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*color,1); mesh.materials.append(m)
a=math.radians(39.6)
pointer=[(x*math.cos(a)+y*math.sin(a),-x*math.sin(a)+y*math.cos(a),.002) for x,y in [(-.0016,-.022),(.0016,-.022),(.0007,.077),(-.0007,.077)]]
preview_readout('Review only / pointer at 29.94',pointer,'barometer',(.014,.016,.012))
y0=-.177; y1=y0+.335*(42-20)/40
preview_readout('Review only / liquid at 42F',[(.0156,y0,.0015),(.0184,y0,.0015),(.0184,y1,.0015),(.0156,y1,.0015)],'thermometer',(.3,.028,.014))

# Small studio setting is saved only with this isolated scene.
def mat(name,color,rough):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 bs=m.node_tree.nodes['Principled BSDF']; bs.inputs['Base Color'].default_value=(*color,1); bs.inputs['Roughness'].default_value=rough; return m
def cube(name,at,size,material):
 bpy.ops.mesh.primitive_cube_add(size=1,location=coord(at)); o=bpy.context.object; o.name=name; o.scale=(size[0],size[2],size[1]); o.data.materials.append(material); o['review_only']=True; return o
cube('Review / blue grey plaster', (0,.64,-.09),(1.48,1.38,.04),mat('Review wall',(.13,.17,.18),.9))
cube('Review / timber shelf',(0,.105,.04),(1.48,.055,.48),mat('Review timber',(.11,.064,.033),.55))
world=bpy.data.worlds.new('Instrument studio world'); world.use_nodes=True; world.node_tree.nodes['Background'].inputs[0].default_value=(.21,.25,.29,1); world.node_tree.nodes['Background'].inputs[1].default_value=.45; scene.world=world
for name,at,energy,size,color in [('Warm key',(-1.1,1.9,2.4),160,1.5,(1,.84,.65)),('Cool fill',(1.3,1.1,1.3),90,1.1,(.65,.8,1)),('Top strip',(.1,1.7,.1),65,.6,(1,.95,.83))]:
 ld=bpy.data.lights.new(name,'AREA'); ld.energy=energy; ld.shape='DISK'; ld.size=size; ld.color=color
 o=bpy.data.objects.new(name,ld); scene.collection.objects.link(o); o.location=coord(at); o.rotation_euler=(coord((0,.6,0))-o.location).to_track_quat('-Z','Y').to_euler()
camera=bpy.data.cameras.new('MCP instruments review camera'); camera.type='ORTHO'; camera.ortho_scale=1.35
o=bpy.data.objects.new('MCP instruments review camera',camera); scene.collection.objects.link(o); o.location=coord((.85,1.03,2.4)); o.rotation_euler=(coord((0,.59,0))-o.location).to_track_quat('-Z','Y').to_euler(); scene.camera=o
scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.use_denoising=True
scene.render.resolution_x=1600; scene.render.resolution_y=1200; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(OUT/'instruments-review.png')
scene.view_settings.view_transform='AgX'
texts=[]
for filename in ['instruments-mcp.py','instruments-export-mcp.py']:
 t=bpy.data.texts.new(filename); t.write((ROOT/'tools/props'/filename).read_text(encoding='utf-8')); texts.append(t)
bpy.data.libraries.write(str(ROOT/'tools/props/instruments.blend'),set([scene]+texts),fake_user=True,compress=True)
print(json.dumps({'exported':str(path),'triangles':counts,'saved':str(ROOT/'tools/props/instruments.blend'),'render':scene.render.filepath}))
