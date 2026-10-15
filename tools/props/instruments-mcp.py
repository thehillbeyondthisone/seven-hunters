"""Run this text through Blender MCP; never by launching a separate Blender.

All dimensions are metres, engine Y up / +Z forwards. These are deliberately
labelled reconstructions rather than a recovered Flannan equipment inventory.
"""
import bpy, math, json, os
from mathutils import Vector
from pathlib import Path

ROOT = Path('C:/Users/fillt/Desktop/flannan')
OUT = ROOT / 'artifacts/instruments/blender'
OUT.mkdir(parents=True, exist_ok=True)
original_scene = bpy.context.scene
scene = bpy.data.scenes.new('Flannan instruments - isolated MCP pass')
bpy.context.window.scene = scene
scene['provenance'] = 'MCP-authored reconstruction; exact station models and makers unverified.'
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
roots, materials = {}, {}

def coord(v): return Vector((v[0], -v[2], v[1]))

finishes = {
 'mahogany': ('Varnished mahogany', (0.145, .055, .022, 1), 0, .32),
 'brass': ('Aged warm brass', (.48, .29, .085, 1), .85, .27),
 'darkBrass': ('Recessed brass', (.19, .105, .03, 1), .8, .38),
 'iron': ('Blackened iron', (.024, .026, .026, 1), .65, .48),
 'leather': ('Dark leather', (.045, .028, .019, 1), 0, .72),
 'ivory': ('Ivory painted timber', (.68, .65, .55, 1), 0, .74),
 'glass': ('Recessed blue optical glass', (.017, .055, .075, 1), .25, .13),
 'silver': ('Thermometer bulb and clips', (.42, .44, .43, 1), .85, .24),
 'ink': ('Dial ink', (.015, .017, .014, 1), 0, .66),
}
for key, (label, color, metal, rough) in finishes.items():
 m = bpy.data.materials.new('Flannan instruments / ' + label); m.diffuse_color = color; m.use_nodes = True
 bs = m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value = color
 bs.inputs['Metallic'].default_value = metal; bs.inputs['Roughness'].default_value = rough
 materials[key] = m

def root(name, offset):
 r = bpy.data.objects.new(name + ' / origin', None); scene.collection.objects.link(r)
 r.location = coord(offset); r['instrument'] = name; roots[name] = r; return r
root('barometer', (-.34, .86, 0)); root('thermometer', (.12, .7, 0)); root('telescope', (-.08, .17, .1))

def register(o, instrument, finish):
 o.name = instrument + ' / ' + o.name; o.parent = roots[instrument]
 o['instrument'] = instrument; o['finish'] = finish; o.data.materials.append(materials[finish]); return o

def bevel(o, width=.0015, segments=2):
 mod = o.modifiers.new('Small crafted edge bevel', 'BEVEL'); mod.width=width; mod.segments=segments
 mod = o.modifiers.new('Preserve broad face normals', 'WEIGHTED_NORMAL'); mod.keep_sharp=True

def box(name, at, size, instrument, finish, edge=.001):
 bpy.ops.mesh.primitive_cube_add(size=1, location=coord(at)); o=bpy.context.object; o.name=name
 o.scale=(size[0],size[2],size[1]); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 register(o,instrument,finish)
 if edge: bevel(o,edge)
 return o

def lathe(name, profile, instrument, finish, axis='Z', segs=40):
 # Profile entries (distance along axis, radius); all surfaces are closed by explicit points.
 verts, faces=[],[]
 for d,r in profile:
  for i in range(segs):
   a=i/segs*math.tau
   p=(r*math.cos(a),r*math.sin(a),d) if axis=='Z' else (d,r*math.cos(a),r*math.sin(a))
   verts.append(coord(p))
 for j in range(len(profile)-1):
  for i in range(segs): faces.append((j*segs+i,j*segs+(i+1)%segs,(j+1)*segs+(i+1)%segs,(j+1)*segs+i))
 mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update()
 o=bpy.data.objects.new(name,mesh); scene.collection.objects.link(o); register(o,instrument,finish)
 import bmesh
 bm=bmesh.new(); bm.from_mesh(mesh); bmesh.ops.recalc_face_normals(bm,faces=bm.faces); bm.to_mesh(mesh); bm.free()
 for p in mesh.polygons: p.use_smooth=True
 mod=o.modifiers.new('Crisp lathe shoulders', 'EDGE_SPLIT'); mod.split_angle=math.radians(34); mod.use_edge_angle=True
 return o

def ring(name,radius,tube,at,instrument,finish,segs=40,cross=6,axis='Z'):
 profile=[]
 for j in range(cross+1):
  a=j/cross*math.tau; profile.append((at[2]+tube*math.sin(a),radius+tube*math.cos(a)))
 o=lathe(name,profile,instrument,finish,axis,segs)
 if axis=='Z': o.location=coord((at[0],at[1],0))
 return o

def cylinder(name,at,r,depth,instrument,finish,axis='Z',segs=16):
 o=lathe(name,[(-depth/2,0),(-depth/2,r),(depth/2,r),(depth/2,0)],instrument,finish,axis,segs)
 o.location=coord(at); return o

# Aneroid-style room instrument: a restrained mahogany plaque and turned brass rim.
box('backboard', (0,-.105,-.039), (.171,.43,.026), 'barometer','mahogany',.009)
lathe('turned mahogany surround',[(-.059,0),(-.059,.108),(-.054,.123),(-.039,.124),(-.027,.117),(-.024,.107),(-.024,0)],'barometer','mahogany',segs=48)
lathe('turned brass bezel',[(-.029,.094),(-.029,.106),(-.024,.111),(-.009,.111),(-.003,.106),(.003,.101),(.003,.095),(-.001,.094),(-.029,.094)],'barometer','brass',segs=48)
ring('fine outer bead',.108,.002,(0,0,-.007),'barometer','darkBrass',48)
ring('inner polished bead',.095,.0016,(0,0,.003),'barometer','brass',48)
ring('hanging ring',.014,.0025,(0,.151,-.042),'barometer','brass',24)
for y in [-.285,.155]:
 cylinder('slotted mounting screw',(0,y,-.024),.004,.003,'barometer','brass',segs=12)
 box('screw slot',(0,y,-.0223),(.005,.0007,.0004),'barometer','ink',0)
cylinder('pointer centre cap',(0,0,.0045),.006,.005,'barometer','brass',segs=20)
box('small makerless brass plaque',(0,-.235,-.023),(.076,.022,.002),'barometer','darkBrass',.001)

# North-facing shaded thermometer. Open centre keeps every graduation visible;
# side louvres ventilate the cabinet and the projecting pitched cap sheds rain.
box('rear painted board',(0,0,-.025),(.181,.6,.024),'thermometer','ivory',.003)
for x in [-.083,.083]:
 box('front stile',(x,0,.009),(.018,.596,.04),'thermometer','ivory',.002)
 for i in range(14):
  slat=box('ventilating side louvre',(x,-.261+i*.04,.049),(.014,.025,.077),'thermometer','ivory',.001)
  slat.rotation_euler.x=math.radians(18)
box('lower sill',(0,-.304,.024),(.207,.026,.11),'thermometer','ivory',.003)
box('upper lintel',(0,.303,.02),(.207,.026,.1),'thermometer','ivory',.002)
for x,angle in [(-.057,-9),(.057,9)]:
 o=box('pitched weather cap',(x,.326,.035),(.122,.014,.16),'thermometer','ivory',.002)
 o.rotation_euler.y=math.radians(angle)
for y in [-.195,.14]:
 box('capillary support clip',(.017,y,.004),(.023,.006,.004),'thermometer','silver',.001)
# The clear capillary is left optically open: the separate live liquid column
# must remain the only filled stroke against the printed scale in the engine.
cylinder('liquid bulb',(.017,-.18,.002),.006,.003,'thermometer','silver',segs=16)
for x in [-.081,.081]:
 for y in [-.278,.278]: cylinder('frame screw',(x,y,.031),.0023,.002,'thermometer','darkBrass',segs=10)

# Hand telescope, lying on its existing sill. +X is the eyepiece end.
lathe('objective hood',[(-.393,.029),(-.393,.037),(-.388,.04),(-.335,.04),(-.329,.035),(-.329,.031),(-.393,.029)],'telescope','brass',axis='X',segs=40)
lathe('main barrel',[(-.337,.031),(-.337,.034),(-.151,.034),(-.147,.032),(.128,.032),(.132,.029),(.132,.027),(-.337,.027),(-.337,.031)],'telescope','brass',axis='X',segs=40)
lathe('leather hand grip',[(-.272,.0342),(-.272,.0358),(-.268,.0365),(-.071,.0365),(-.067,.0358),(-.067,.0342),(-.272,.0342)],'telescope','leather',axis='X',segs=40)
for i in range(13):
 x=-.26+i*.0145
 lathe('subtle leather rib',[(x-.0005,.0364),(x,.0369),(x+.0005,.0364)],'telescope','leather',axis='X',segs=32)
lathe('first draw tube',[(.12,.0245),(.12,.027),(.262,.027),(.266,.025),(.266,.022),(.12,.022),(.12,.0245)],'telescope','brass',axis='X',segs=36)
lathe('second draw tube',[(.255,.0185),(.255,.022),(.383,.022),(.386,.02),(.386,.017),(.255,.017),(.255,.0185)],'telescope','brass',axis='X',segs=32)
lathe('eyepiece collar',[(.373,.017),(.373,.025),(.381,.026),(.407,.026),(.414,.022),(.414,.011),(.408,.009),(.385,.009),(.385,.017),(.373,.017)],'telescope','iron',axis='X',segs=32)
for x,r in [(-.33,.035),(-.277,.0368),(-.061,.0368),(.132,.029),(.261,.025)]:
 lathe('turned brass ferrule',[(x-.003,r-.002),(x-.003,r),(x-.0015,r+.001),(x+.002,r+.001),(x+.003,r),(x+.003,r-.002),(x-.003,r-.002)],'telescope','darkBrass',axis='X',segs=40)
cylinder('recessed objective glass',(-.389,0,0),.0286,.0018,'telescope','glass',axis='X',segs=40)
cylinder('recessed eye lens',(.408,0,0),.009,.001,'telescope','glass',axis='X',segs=24)
box('leather longitudinal seam',(-.169,-.0368,0),(.19,.001,.0015),'telescope','darkBrass',.0003)

print(json.dumps({'scene':scene.name,'original_scene_preserved':original_scene.name,'objects':len(scene.objects),'instruments':list(roots)}))
