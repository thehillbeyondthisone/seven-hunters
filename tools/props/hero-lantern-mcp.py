"""Editable Blender study for the carried/table storm lantern. Reconstruction.

Foot Y=0, bail top Y=.32, flame centre Y=.13; no change to game handling.
Reuses the room study's mesh helpers, preserving every previously open scene.
"""
from pathlib import Path
ROOT=Path('C:/Users/thisi/OneDrive/Documents/flannan')
helpers=(ROOT/'tools/props/room-craft-mcp.py').read_text(encoding='utf-8').split('# Chair:')[0]
helpers=helpers.replace("OUT = ROOT/'artifacts/room-craft/blender'", "OUT = ROOT/'artifacts/hero-lantern/blender'")
helpers=helpers.replace("bpy.data.scenes.new('Seven Hunters - room furniture and objects')", "bpy.data.scenes.new('Seven Hunters - hero storm lantern')")
exec(compile(helpers,'room-craft mesh helpers','exec'))

# Transport the tube frame through bends. Switching reference axes midway would
# pinch the bail and the curved air tubes at near-vertical tangents.
def tube(name,points,r,model,finish,segs=8):
 pts=[];previous=None
 for i,p in enumerate(points):
  direction=(Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])).normalized()
  if previous is None:
   other=Vector((0,1,0)) if abs(direction.y)<.95 else Vector((1,0,0))
   a=direction.cross(other).normalized()
  else:a=(previous-direction*previous.dot(direction)).normalized()
  b=direction.cross(a).normalized();previous=a
  for j in range(segs):pts.append(tuple(Vector(p)+r*(a*math.cos(j/segs*math.tau)+b*math.sin(j/segs*math.tau))))
 faces=[(i*segs+j,i*segs+(j+1)%segs,(i+1)*segs+(j+1)%segs,(i+1)*segs+j) for i in range(len(points)-1) for j in range(segs)]
 return mesh(name,pts,faces,model,finish,True)

for key,color,metal,rough in [
 ('tin',(.095,.115,.105,1),.72,.44),('steel',(.38,.42,.38,1),.85,.30),
 ('brass',(.49,.31,.12,1),.88,.33),('black',(.013,.017,.014,1),.1,.85),
 ('glass',(.78,.86,.82,1),0,.055),('flame',(1,.54,.13,1),0,.6)]:
 if key not in mats:
  mat=bpy.data.materials.new('Hero lantern / '+key);mat.use_nodes=True;mats[key]=mat
 mat=mats[key]; bs=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 bs.inputs['Base Color'].default_value=color;bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough;mat.diffuse_color=color
 if key=='glass':bs.inputs['Transmission Weight'].default_value=1;bs.inputs['IOR'].default_value=1.45
 if key=='flame':bs.inputs['Emission Color'].default_value=(1,.42,.08,1);bs.inputs['Emission Strength'].default_value=4

M='stormLantern';root(M)
def annulus(name,y,r0,r1,h,finish='tin',n=48):
 return lathe(name,(0,y,0),[(r0,0),(r1,0),(r1,h),(r0,h),(r0,0)],M,finish,n)
def knob(name,at,r,h,axis=(0,1,0),finish='brass',teeth=24):
 # Scalloped edge gives the control a tangible knurled silhouette.
 pts=[];faces=[];q=Vector((0,1,0)).rotation_difference(Vector(axis))
 count=teeth*2
 for yy in [0,h]:
  for i in range(count):
   a=i/count*math.tau;rr=r*(1 if i%2==0 else .91)
   pts.append(tuple(Vector(at)+q@Vector((rr*math.cos(a),yy,rr*math.sin(a)))))
 faces=[tuple(reversed(range(count))),tuple(range(count,count*2))]+[(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
 return bevel(mesh(name,pts,faces,M,finish),.0004,1)

# Rolled and pressed reservoir: foot, vertical skirt, recessed shoulder and neck.
lathe('pressed reservoir',(0,0,0),[(0,0),(.062,0),(.073,.002),(.077,.006),(.077,.010),(.074,.013),(.074,.039),(.071,.047),(.061,.054),(.044,.059),(.032,.060),(.028,.064),(0,.064)],M,'tin',64)
ring('rolled foot',(0,.008,0),.0758,.0017,M,'steel',segs=64)
ring('pressed skirt bead',(0,.017,0),.074,.0011,M,'tin',segs=64)
ring('shoulder seam',(0,.044,0),.0718,.0012,M,'steel',segs=64)
annulus('reservoir neck seam',.061,.027,.032,.003,'steel')
# A recessed radial stamping in the shoulder, split around the filler cap.
for i in range(12):
 a=i/12*math.tau
 if i in [2,3]:continue
 tube('pressed shoulder rib',[(r*math.cos(a),.059-(r-.038)*.18,r*math.sin(a)) for r in [.038,.046,.054,.062]],.00065,M,'tin',6)

# Filler neck and removable cap, deliberately unbranded.
fill=(-.042,.052,.037)
lathe('filler neck',fill,[(0,0),(.013,0),(.014,.004),(.013,.008),(0,.008)],M,'steel',32)
knob('knurled filler cap',(-.042,.059,.037),.015,.006,finish='brass',teeth=24)
lathe('cap crown',(-.042,.065,.037),[(0,.0015),(.009,.0015),(.013,0)],M,'brass',32)
box('cap cross grip',(-.042,.068,.037),(.019,.003,.003),M,'brass',.0007)

# Gallery, visible wick, toothed chimney claws and a pierced burner crown.
lathe('burner pedestal',(0,.061,0),[(.027,0),(.032,.003),(.035,.006),(.035,.010),(.030,.014),(.027,.017)],M,'brass',48)
annulus('burner lower rolled rim',.075,.024,.029,.003,'steel')
for i in range(18):
 a=i/18*math.tau
 rod('open burner cage rib',(.025*math.cos(a),.079,.025*math.sin(a)),(.025*math.cos(a),.094,.025*math.sin(a)),.00125,M,'brass',6)
annulus('burner crown',.094,.014,.027,.003,'brass')
box('flat wick',(0,.100,0),(.014,.013,.003),M,'black',.0005)
for i in range(4):
 a=i/4*math.tau+math.pi/4
 tube('globe retaining spring',[(r*math.cos(a),y,r*math.sin(a)) for r,y in [(.031,.076),(.038,.080),(.039,.090),(.035,.097)]],.0017,M,'steel',8)

# Clear globe with a real open rim and rolled lip, seated on the burner gallery.
lathe('clear blown globe',(0,.080,0),[(.034,0),(.039,.009),(.048,.023),(.054,.042),(.056,.062),(.055,.081),(.050,.101),(.042,.117),(.033,.129),(.031,.136),(.032,.139)],M,'glass',64)
ring('lower glass lip',(0,.082,0),.035,.0011,M,'glass',segs=48)
ring('upper glass lip',(0,.218,0),.0315,.0011,M,'glass',segs=48)
lathe('wick flame',(0,.111,0),[(0,0),(.003,.003),(.006,.012),(.0055,.022),(.0025,.033),(0,.041)],M,'flame',24,scale=(1,1,.65))

# Curved side air tubes, swaged end collars and riveted handle pivot ears.
for side in [-1,1]:
 path=[(side*x,y,0) for x,y in [(.061,.041),(.074,.051),(.081,.072),(.083,.105),(.083,.182),(.081,.209),(.073,.229),(.059,.241),(.040,.244)]]
 tube('formed air tube',path,.0072,M,'tin',14)
 for yy in [.072,.202]:
  lathe('swaged tube collar',(side*.083,yy,0),[(.0071,0),(.0083,.001),(.0083,.006),(.0071,.007)],M,'steel',24)
 box('bail pivot ear',(side*.083,.223,0),(.011,.025,.017),M,'tin',.003)
 rod('bail hinge rivet',(side*.076,.223,0),(side*.092,.223,0),.004,M,'steel',20)
 lathe('rivet domed head',(side*.092,.223,0),[(0,0),(.004,0),(.0044,.001),(.003,.0025),(0,.003)],M,'steel',20,(side,0,0))
 # Shaped uprights trace the globe instead of four straight placeholder rods.
for i in range(4):
 a=(i+.5)/4*math.tau
 tube('curved globe guard',[(r*math.cos(a),yy,r*math.sin(a)) for r,yy in [(.035,.077),(.046,.091),(.061,.116),(.064,.146),(.057,.180),(.041,.210),(.034,.220)]],.0019,M,'steel',8)
for yy,R in [(.103,.055),(.155,.064)]: ring('guard hoop',(0,yy,0),R,.0018,M,'steel',segs=48)

# Wick spindle, toothed wheel, lift lever and formed stop: separate readable parts.
rod('wick spindle',(.015,.077,.023),(.015,.077,.078),.0021,M,'brass')
knob('toothed wick wheel',(.015,.077,.077),.0082,.003,(0,0,1),teeth=20)
rod('wheel axle pin',(.015,.077,.080),(.015,.077,.082),.002,M,'steel',12)
box('globe lift bracket',(-.062,.072,.019),(.012,.018,.019),M,'tin',.002)
tube('globe lift lever',[(-.061,.073,.023),(-.073,.083,.033),(-.074,.099,.038),(-.068,.105,.039)],.0022,M,'brass',10)
box('lever thumb pad',(-.068,.105,.039),(.013,.006,.008),M,'brass',.002)
rod('lift hinge pin',(-.071,.075,.024),(-.055,.075,.024),.0025,M,'steel',16)

# Spun hood under the air chamber. Its vent band contains actual open apertures.
lathe('spun hood skirt',(0,.211,0),[(.032,0),(.057,.001),(.071,.004),(.081,.008),(.083,.011),(.079,.015),(.063,.021),(.044,.028),(.036,.030)],M,'tin',64)
ring('hood rolled edge',(0,.222,0),.0815,.0018,M,'steel',segs=64)
annulus('vent lower rim',.240,.029,.036,.0025,'steel')
annulus('vent upper rim',.255,.025,.032,.003,'steel')
for i in range(16):
 a=i/16*math.tau; delta=.065
 pts=[]
 for y,r in [(.242,.035),(.255,.031)]:
  for dr,aa in [(0,a-delta),(0,a+delta),(-.0015,a+delta),(-.0015,a-delta)]:pts.append(((r+dr)*math.cos(aa),y,(r+dr)*math.sin(aa)))
 faces=[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)]
 mesh('open vent bridge',pts,faces,M,'tin')
lathe('rain cap',(0,.257,0),[(.026,0),(.036,.001),(.036,.003),(.029,.007),(.018,.010),(.012,.011),(0,.011)],M,'tin',48)
ring('cap rolled seam',(0,.261,0),.034,.001,M,'steel',segs=48)
rod('top cap stud',(0,.266,0),(0,.271,0),.0035,M,'brass',16)

# Bail's highest point is .3197 m, preserving the player's .32 m grip point.
tube('hinged carrying bail',[(.085*math.cos(i/40*math.pi),.220+.097*math.sin(i/40*math.pi),.003*math.sin(i/40*math.tau)) for i in range(41)],.0027,M,'steel',10)
for side in [-1,1]: ring('bail hinge eye',(side*.085,.223,0),.005,.0018,M,'steel',(1,0,0),20)

# Evaluated triangles with split normals; local positions stay in metres, Y up.
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();data={};caches={}
for obj in list(scene.objects):
 if obj.type!='MESH' or not obj.get('model'):continue
 finish=obj['finish'];out=data.setdefault(finish,{'p':[],'n':[],'uv':[],'idx':[]});cache=caches.setdefault(finish,{})
 evaluated=obj.evaluated_get(deps);me=evaluated.to_mesh();me.calc_loop_triangles()
 transform=obj.parent.matrix_world.inverted() @ evaluated.matrix_world;normal_matrix=transform.to_3x3().inverted().transposed()
 for tri in me.loop_triangles:
  ps=[transform @ me.vertices[me.loops[i].vertex_index].co for i in tri.loops]
  if (ps[1]-ps[0]).cross(ps[2]-ps[0]).length<1e-12:continue
  for li in tri.loops:
   p=uncoord(transform @ me.vertices[me.loops[li].vertex_index].co);n=uncoord((normal_matrix @ me.corner_normals[li].vector).normalized());uv=(math.atan2(p[2],p[0])/math.tau+.5,p[1])
   values=tuple(round(float(v),6) for v in (*p,*n,*uv))
   if values not in cache:
    cache[values]=len(out['p'])//3;out['p'].extend(values[:3]);out['n'].extend(values[3:6]);out['uv'].extend(values[6:])
   out['idx'].append(cache[values])
 evaluated.to_mesh_clear()
(ROOT/'src/station/HandLampModel.js').write_text('// GENERATED in Blender by tools/props/hero-lantern-mcp.py. Reconstruction.\n// Metres, Y up. Foot=0, grip=.32, flame=.13.\nexport const HAND_LAMP_MODEL = '+json.dumps(data,separators=(',',':'))+';\n',encoding='utf-8')
counts={finish:len(g['idx'])//3 for finish,g in data.items()}
(OUT/'export-summary.json').write_text(json.dumps({'triangles':counts,'total':sum(counts.values()),'objects':len(roots[M].children),'height':.32,'flame':.13},indent=2))

# Focused studio render. No unrelated room geometry or source scene is changed.
world=bpy.data.worlds.new('Hero lantern studio');world.use_nodes=True;scene.world=world
bg=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs[0].default_value=(.09,.12,.13,1);bg.inputs[1].default_value=.6
for name,at,power,size in [('Key',(-.5,.6,.65),35,.5),('Fill',(.6,.35,.5),20,.4),('Rim',(-.25,.4,-.4),30,.3)]:
 lamp=bpy.data.lights.new(name,'AREA');lamp.energy=power;lamp.size=size;o=bpy.data.objects.new(name,lamp);scene.collection.objects.link(o);o.location=coord(at);o.rotation_euler=(coord((0,.15,0))-o.location).to_track_quat('-Z','Y').to_euler()
camera=bpy.data.cameras.new('Hero lantern close view');camera.type='ORTHO';camera.ortho_scale=.41
o=bpy.data.objects.new('Hero lantern close view',camera);scene.collection.objects.link(o);o.location=coord((.39,.28,.65));o.rotation_euler=(coord((0,.16,0))-o.location).to_track_quat('-Z','Y').to_euler();scene.camera=o
scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.render.resolution_x=1100;scene.render.resolution_y=1300;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/'hero-lantern.png')
source=bpy.data.texts.new('hero-lantern-mcp.py');source.write((ROOT/'tools/props/hero-lantern-mcp.py').read_text(encoding='utf-8'))
bpy.data.libraries.write(str(ROOT/'tools/props/hero-lantern.blend'),{scene,source},fake_user=True,compress=True)
print(json.dumps({'scene':scene.name,'triangles':counts,'total':sum(counts.values()),'objects':len(roots[M].children)}))
bpy.ops.render.render(write_still=True)
