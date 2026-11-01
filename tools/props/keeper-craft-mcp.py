"""Seven Hunters craft expansion, executed through the live Blender MCP.

Keeps earlier scenes intact. Engine coordinates are metres, Y up. All new
construction, clothing and mechanisms are artistic reconstructions. No maker
marks or claims of recovered Flannan equipment. Run build, then export.
"""
from pathlib import Path
import bpy, bmesh, math, json
from mathutils import Vector

ROOT = Path('C:/Users/thisi/OneDrive/Documents/flannan')
OUT = ROOT/'artifacts/keeper-craft/blender'
OUT.mkdir(parents=True, exist_ok=True)
helpers = (ROOT/'tools/props/room-craft-mcp.py').read_text(encoding='utf-8').split('# Chair:')[0]
helpers = helpers.replace("OUT = ROOT/'artifacts/room-craft/blender'", "OUT = ROOT/'artifacts/keeper-craft/blender'")
helpers = helpers.replace("bpy.data.scenes.new('Seven Hunters - room furniture and objects')", "bpy.data.scenes.new('Seven Hunters - keeper craft expansion')")
exec(compile(helpers, 'retained room mesh helpers', 'exec'))
scene['craft_expansion'] = True
scene['source_scene_retained'] = True
for key,col,metal,rough in [('skin',(.39,.235,.16),0,.78),('hair',(.045,.036,.027),0,.94),('rope',(.34,.26,.15),0,.94),('red',(.20,.025,.017),0,.38)]:
 m=bpy.data.materials.new('Keeper craft / '+key);m.use_nodes=True
 bs=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 bs.inputs['Base Color'].default_value=(*col,1);bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
 m.diffuse_color=(*col,1);mats[key]=m

def ball(name,at,size,model,finish,rings=10,segs=16):
 return lathe(name,at,[(math.sin(j/rings*math.pi),-math.cos(j/rings*math.pi)) for j in range(rings+1)],model,finish,segs,scale=size)

# Parallel-transport frames keep long ropes and fingers smooth through bends.
def cord(name,points,r,model,finish,segs=7):
 pts=[];previous=None
 for i,p in enumerate(points):
  d=(Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])).normalized()
  if previous is None:
   ref=Vector((0,1,0)) if abs(d.y)<.95 else Vector((1,0,0));a=d.cross(ref).normalized()
  else:a=(previous-d*previous.dot(d)).normalized()
  b=d.cross(a).normalized();previous=a
  for j in range(segs):pts.append(tuple(Vector(p)+r*(a*math.cos(j/segs*math.tau)+b*math.sin(j/segs*math.tau))))
 faces=[(i*segs+j,i*segs+(j+1)%segs,(i+1)*segs+(j+1)%segs,(i+1)*segs+j) for i in range(len(points)-1) for j in range(segs)]
 return mesh(name,pts,faces,model,finish,True)

def seam(name,points,model,finish='leather',r=.0007):return cord(name,points,r,model,finish,5)

# Original box form and sight lines are retained; no later camera's finder.
M='brownie';root(M,(-.55,.0,0))
box('covered card body',(0,.0381,0),(.0762,.0762,.127),M,'black',.0013)
box('removable front',(0,.0381,.0644),(.077,.077,.003),M,'leather',.0008)
box('back panel',(0,.0381,-.0643),(.074,.073,.002),M,'black',.0005)
for s in [-1,1]:
 seam('folded covering edge',[(s*.0383,.001,-.062),(s*.0383,.075,-.062),(s*.0383,.075,.062),(s*.0383,.001,.062)],M)
 seam('front panel edge',[(s*.035,.003,.066),(s*.035,.073,.066)],M,r=.00045)
for yy in [.003,.073]:seam('panel return',[(-.035,yy,.066),(.035,yy,.066)],M,r=.00045)
lathe('recessed objective mount',(0,.0381,.0655),[(.0058,0),(.010,0),(.010,.002),(.0085,.003),(.0065,.003)],M,'tin',32,(0,0,1))
lathe('dark objective',(0,.0381,.0685),[(0,0),(.0063,0),(.0063,.0006),(0,.0006)],M,'slate',24,(0,0,1))
for x in [-.024,.024]:seam('top aiming line',[(0,.0768,-.046),(x,.0768,.047)],M,'tin',.0004)
lathe('red film window',(0,.034,-.0654),[(0,0),(.0048,0),(.0048,.0007),(0,.0007)],M,'red',24,(0,0,-1))
ring('film window rim',(0,.034,-.0654),.0051,.0005,M,'tin',(0,0,1),24)
box('back latch',(0,.004,-.066),(.028,.004,.003),M,'tin',.0004)
box('side seam',(-.0385,.0381,-.032),(.001,.071,.0015),M,'leather',.0002)
root('brownieKey',(-.7,0,0))
rod('winding spindle',(0,0,0),(-.008,0,0),.0034,'brownieKey','tin',16)
box('film key',(-.009,0,0),(.0024,.018,.006),'brownieKey','tin',.0006)
root('brownieShutter',(-.8,0,0))
box('shutter tab',(0,0,0),(.012,.003,.007),'brownieShutter','tin',.0005)

M='oilCan';root(M,(-.25,0,0))
lathe('spun tin body',(0,0,0),[(0,0),(.13,0),(.155,.012),(.16,.025),(.16,.27),(.154,.291),(.12,.33),(.058,.36),(.055,.39)],M,'tin',40)
for y,r in [(.018,.154),(.045,.161),(.27,.16)]:ring('rolled body seam',(0,y,0),r,.0022,M,'tin',segs=40)
for s in [-1,1]:box('handle attachment',(s*.071,.33,0),(.032,.04,.018),M,'tin',.003)
cord('folded carrying handle',[(-.071,.34,0),(-.10,.40,0),(-.07,.49,0),(.07,.49,0),(.10,.40,0),(.071,.34,0)],.010,M,'tin',10)
cord('swan-neck spout',[(.12,.27,0),(.18,.30,0),(.23,.345,0),(.29,.39,0)],.023,M,'tin',12)
ring('spout rolled lip',(.29,.39,0),.022,.002,M,'tin',(.7,.7,0),24)
box('folded body seam',(0,.155,-.160),(.007,.24,.003),M,'tin',.0008)
root('canCap',(0,0,0))
lathe('rolled threaded cap',(0,0,0),[(0,0),(.058,0),(.063,.004),(.063,.025),(.057,.034),(0,.034)],'canCap','tin',32)
for i in range(16):
 a=i/16*math.tau;rod('cap grip flute',(.063*math.cos(a),.007,.063*math.sin(a)),(.063*math.cos(a),.023,.063*math.sin(a)),.0012,'canCap','tin',5)

M='trimmer';root(M,(.15,0,0))
for s in [-1,1]:
 ring('oval finger loop',(s*.023,-.20,0),.022,.0045,M,'tin',(0,0,1),24)
 cord('scissor shank',[(s*.023,-.178,0),(s*.018,-.13,0),(-s*.010,-.07,0),(-s*.012,0,0)],.0055,M,'tin',8)
 box('flat cutting blade',(-s*.010,-.025,.001),(.016,.064,.004),M,'tin',.001)
rod('slotted pivot',(0,-.09,-.006),(0,-.09,.009),.007,M,'brass',16)
box('pivot slot',(0,-.09,.009),(.008,.0015,.001),M,'black',0)
M='serviceTray';root(M,(.45,0,0))
box('tray bottom',(0,.018,0),(.36,.036,.24),M,'oak',.003)
for x in [-.173,.173]:box('dovetailed end',(x,.075,0),(.014,.12,.24),M,'oak',.002)
for z in [-.113,.113]:box('low side',(0,.058,z),(.34,.08,.014),M,'oak',.002)
for s in [-1,1]:
 for j in range(3):box('end grain dovetail',(s*.181,.025+j*.034,.099),(.002,.016,.016),M,'darkOak',.0005)

M='fountain';root(M,(.8,0,0))
lathe('working supply',(0,0,0),[(0,0),(.15,0),(.19,.04),(.19,.23),(.18,.26),(.17,.27),(.16,.27),(.16,.06),(0,.06)],M,'brass',40)
for yy in [.036,.22]:ring('supply rolled bead',(0,yy,0),.191,.002,M,'brass',segs=40)
cord('feed tube',[(0,.04,0),(-.12,.04,0),(-.20,-.035,0),(-.28,-.06,0)],.015,M,'brass',10)
root('fountainCap',(1.1,0,0))
lathe('supply cover',(0,0,0),[(0,0),(.195,0),(.195,.015),(.17,.025),(0,.025)],'fountainCap','brass',40)
ring('cover grip',(0,.051,0),.029,.005,'fountainCap','brass',(0,0,1),24)

# Reusable fabric models: folds are modeled, then a pinned hanging panel is
# simulated separately below. No runtime cloth solver or additional colliders.
for M,w,d,col in [('foldedCloth',.15,.17,'linen'),('housingCloth',.13,.12,'linen'),('blanket',1.63,.43,'wool')]:
 root(M,(1.4+len(roots)*.02,0,0))
 for layer in range(3):
  surface('layer with turned edge',lambda u,v,w=w,d=d,layer=layer:((u-.5)*w,.009*layer+.006*math.sin(v*math.pi)+.003*math.sin(u*math.pi*6+v*2),(v-.5)*d),20 if w>1 else 12,12,M,col,.0025)
 for z in [-d*.48,d*.48]:seam('bound hem',[((i/20-.5)*w,.025+.003*math.sin(i/20*math.pi*6),z) for i in range(21)],M,col,.0015)
for M in ['glassTool','housingTool']:
 root(M,(2,0,0));finish='linen'
 surface('gathered working cloth',lambda u,v:((u-.5)*.16,.018*math.sin(u*math.pi*5)*math.sin(v*math.pi),(v-.5)*.13),16,12,M,finish,.003)
 lathe('short cleaning handle',(0,-.28,0),[(0,0),(.018,0),(.018,.23),(.022,.25),(0,.25)],M,'oak',12)
root('serviceKit',(2.3,0,0))
# Linked prototypes are translated into the kit; no mesh duplication in Blender.
for source,at in [('serviceTray',(0,0,0)),('foldedCloth',(-.08,.13,.02)),('housingCloth',(.10,.13,.02)),('trimmer',(0,.17,-.035))]:
 for src in list(roots[source].children):
  o=src.copy();o.data=src.data;scene.collection.objects.link(o);o.parent=roots['serviceKit'];o.location=src.location+coord(at);o['model']='serviceKit'

M='ropeCoil';root(M,(2.7,0,0))
path=[]
for i in range(241):
 t=i/240;a=t*math.tau*4.8;r=.095+.12*t;path.append((r*math.cos(a),.012+.004*math.sin(a*2),r*math.sin(a)))
cord('laid rope',path,.012,M,'rope',7)
# Three low raised strands carry the twist in silhouette at the exposed end.
tail=[(.215+.14*t,.012+.009*math.sin(t*math.pi),-.06*t) for t in [i/24 for i in range(25)]]
cord('loose end',tail,.012,M,'rope',7)
for j in range(3):
 points=[(p[0],p[1]+.009*math.cos(i*.65+j*math.tau/3),p[2]+.009*math.sin(i*.65+j*math.tau/3)) for i,p in enumerate(tail)]
 cord('twisted end strand',points,.0028,M,'rope',5)
M='ropeKnot';root(M,(3.2,0,0))
cord('crossed securing knot',[(.085*math.sin(i/96*math.tau),.025+.014*math.sin(i/96*math.tau*3),.045*math.sin(i/96*math.tau*2)) for i in range(97)],.012,M,'rope',7)
for s in [-1,1]:cord('knot tail',[(s*(.07+t*.12),.013,.03*math.sin(t*2)) for t in [i/16 for i in range(17)]],.012,M,'rope',7)

# Mechanism fittings preserve the existing optic profile, crank reach and weight.
M='opticRoller';root(M,(3.7,0,0))
box('bearing shoe',(0,0,0),(.16,.045,.09),M,'iron',.004)
lathe('grooved carriage roller',(0,.045,-.052),[(0,0),(.036,0),(.036,.012),(.030,.018),(.030,.073),(.036,.079),(.036,.09),(0,.09)],M,'brass',24,(0,0,1))
rod('axle',(-.065,.045,0),(.065,.045,0),.009,M,'iron',12)
for s in [-1,1]:box('axle cheek',(s*.061,.028,0),(.018,.075,.06),M,'iron',.003)
M='opticClamp';root(M,(4,0,0))
box('cast frame shoe',(0,0,0),(.055,.10,.035),M,'brass',.003)
for y in [-.027,.027]:screw((0,y,.018),M,r=.006)
M='weightStack';root(M,(4.3,0,0))
for i in range(5):
 lathe('stacked cast plate',(0,-.25+i*.1,0),[(0,0),(.139,0),(.147,.008),(.147,.078),(.139,.09),(0,.09)],M,'iron',28)
for y in [-.274,.248]:lathe('end plate',(0,y,0),[(0,0),(.151,0),(.151,.019),(0,.019)],M,'iron',28)
rod('central tie bolt',(0,-.292,0),(0,.287,0),.022,M,'iron',12)
ring('lifting eye',(0,.34,0),.055,.012,M,'iron',(0,0,1),24)
for y in [-.294,.268]:lathe('retaining nut',(0,y,0),[(0,0),(.033,0),(.033,.02),(0,.02)],M,'iron',6)
M='crank';root(M,(4.6,0,0))
box('forged arm',(0,.11,0),(.026,.245,.028),M,'brass',.006)
lathe('drive hub',(0,0,-.018),[(0,0),(.033,0),(.033,.04),(0,.04)],M,'iron',24,(0,0,1))
lathe('turned timber grip',(0,.22,.018),[(0,0),(.018,0),(.027,.015),(.029,.065),(.026,.13),(.018,.15),(0,.15)],M,'oak',20,(0,0,1))
ring('grip ferrule',(0,.22,.025),.022,.002,M,'brass',(0,0,1),24)

# Seated boatman: individually shaped anatomy, facial planes and folded clothing.
M='boatman';root(M,(0,0,-1.5))
profile=[(.0,.84,.0),(.24,.87,.20),(.29,.98,.21),(.28,1.12,.19),(.265,1.26,.17),(.245,1.36,.15),(.15,1.43,.11),(.085,1.45,.085)]
pts=[]
for radius,y,depth in profile:
 for i in range(32):
  a=i/32*math.tau;fold=.009*math.sin(a*7+y*8)*max(0,(1.45-y))
  pts.append(((radius+fold)*math.cos(a),y,-.42+(depth+fold)*math.sin(a)))
faces=[(j*32+i,j*32+(i+1)%32,(j+1)*32+(i+1)%32,(j+1)*32+i) for j in range(len(profile)-1) for i in range(32)]
mesh('tailored oilskin coat',pts,faces,M,'oilskin',True)
for s in [-1,1]:
 surface('storm collar',lambda u,v,s=s:(s*(.012+u*.15),1.42-v*.12,-.54-v*.055+u*.035),8,6,M,'oilskin',.007)
 seam('front sewn seam',[(s*.017,.91+j*.018,-.624+.025*math.sin(j*.07)) for j in range(25)],M,'leather',.0014)
 # Seated thighs and lower legs, with broad modeled knee creases.
 ball('trouser thigh',(s*.15,.79,-.66),(.11,.13,.29),M,'wool')
 ball('bent knee',(s*.19,.62,-.87),(.10,.105,.115),M,'wool')
 lathe('trouser shin',(s*.19,.43,-.86),[(.075,0),(.084,.07),(.072,.16),(.089,.21),(0,.22)],M,'wool',20)
 box('boot sole',(s*.19,.388,-.97),(.17,.025,.30),M,'black',.015)
 ball('leather boot upper',(s*.19,.432,-.965),(.081,.058,.145),M,'leather')
 for k in range(3):seam('boot vamp crease',[(s*.19+(u-.5)*.12,.472+.009*math.sin(u*math.pi),-1.02+k*.024) for u in [i/12 for i in range(13)]],M,'leather',.0015)
 ball('ear',(s*.109,1.56,-.425),(.025,.038,.015),M,'skin',8,12)
ball('neck',(0,1.43,-.42),(.061,.083,.06),M,'skin')
# Asymmetric radius/depth rings give forehead, cheek, jaw and chin distinct forms.
head=[(.035,1.465,.045),(.068,1.48,.065),(.092,1.52,.081),(.104,1.565,.085),(.100,1.61,.083),(.093,1.65,.077),(.077,1.69,.061),(.025,1.714,.025)]
pts=[(r*math.cos(i/32*math.tau),y,-.43+d*math.sin(i/32*math.tau)) for r,y,d in head for i in range(32)]
mesh('shaped head and jaw',pts,[(j*32+i,j*32+(i+1)%32,(j+1)*32+(i+1)%32,(j+1)*32+i) for j in range(len(head)-1) for i in range(32)],M,'skin',True)
ball('nose bridge',(0,1.565,-.517),(.018,.033,.017),M,'skin',8,12)
ball('nose tip',(0,1.542,-.538),(.023,.013,.017),M,'skin',8,12)
for s in [-1,1]:
 ball('eyelid',(s*.041,1.592,-.505),(.022,.009,.009),M,'skin',6,12)
 ball('eye',(s*.041,1.593,-.513),(.012,.003,.003),M,'slate',6,12)
 seam('brow',[(s*(.023+i*.004),1.607+.003*math.sin(i/9*math.pi),-.509) for i in range(10)],M,'hair',.003)
ball('short beard',(0,1.49,-.475),(.073,.035,.047),M,'hair',8,20)
seam('mouth',[(-.026,1.514,-.518),(0,1.510,-.522),(.026,1.514,-.518)],M,'skin',.0025)
lathe('knitted cap',(0,1.648,-.43),[(.107,0),(.113,.012),(.111,.038),(.105,.038),(.099,.070),(.074,.11),(.03,.135),(0,.14)],M,'wool',32,scale=(1,1,.86))
for i in range(24):
 a=i/24*math.tau;seam('cap rib',[(.113*math.cos(a),1.652,.097*math.sin(a)-.43),(.112*math.cos(a),1.68,.096*math.sin(a)-.43)],M,'wool',.0015)
for yy in [1.04,1.16,1.28]:rod('coat button',(0,yy,-.628), (0,yy,-.636),.009,M,'leather',12)

# Segment prototypes have their long axis along +Y. The runtime solves the two
# arm bones against the actual moving oar handle, so the hands cannot drift off.
for M,length,r0,r1 in [('upperSleeve',.34,.086,.064),('foreSleeve',.32,.067,.045)]:
 root(M,(.6,0,-1.5))
 lathe('shaped oilskin sleeve',(0,0,0),[(0,0),(r0,0),(r0*.97,.05),(r0*.88,length*.45),(r1*1.14,length*.73),(r1,length),(0,length)],M,'oilskin',20)
 for j in range(3):
  yy=length*(.55+j*.08);ring('folded sleeve crease',(0,yy,0),r0*(.82-j*.05),.003,M,'oilskin',segs=20)
 if M=='foreSleeve':lathe('wool cuff',(0,length-.032,0),[(r1*.95,0),(r1*1.05,0),(r1*1.05,.035),(r1*.95,.035)],M,'wool',20)
root('handPalm',(.9,0,-1.5))
ball('palm',(0,.043,0),(.039,.052,.019),'handPalm','skin',10,20)
ball('thumb pad',(-.029,.025,-.003),(.019,.028,.016),'handPalm','skin',8,12)
for i in range(4):ball('knuckle',((i-1.5)*.019,.080,-.003),(.011,.014,.015),'handPalm','skin',8,12)
root('finger', (1.1,0,-1.5))
lathe('finger phalanx',(0,0,0),[(0,0),(.009,0),(.010,.009),(.008,.027),(.007,.032),(0,.034)],'finger','skin',12,scale=(1,1,.9))
ball('joint crease',(0,.004,0),(.010,.005,.009),'finger','skin',6,12)
root('fingerTip',(1.25,0,-1.5))
lathe('rounded fingertip',(0,0,0),[(0,0),(.008,0),(.008,.011),(.006,.021),(0,.024)],'fingerTip','skin',12,scale=(1,1,.9))
surface('short fingernail',lambda u,v:((u-.5)*.010,.009+v*.010,.007+.001*math.sin(u*math.pi)),6,4,'fingerTip','linen',0)
root('keeperForearm',(1.5,0,-1.5))
lathe('wool shirt sleeve',(0,0,0),[(0,0),(.046,0),(.057,.04),(.064,.16),(.067,.28),(0,.28)],'keeperForearm','wool',20)
ring('stitched cuff',(0,.027,0),.049,.003,'keeperForearm','wool',segs=24)

# Editable articulated bone rig in the .blend, with a complete rowing loop.
# Rigid bone-bound parts are also the engine representation; no hidden skinning
# dependency. The high detail finger rig is shared with the first-person hands.
arm=bpy.data.armatures.new('Boatman articulated skeleton');rig=bpy.data.objects.new('Boatman / rowing rig',arm);scene.collection.objects.link(rig)
rig.location=coord((0,0,-3));bpy.context.view_layer.objects.active=rig;rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
spec=[('torso',(0,.85,-.42),(0,1.40,-.42),None)]
for s,label in [(-1,'L'),(1,'R')]:
 shoulder=(s*.23,1.34,-.42);elbow=(s*.35,1.08,-.60);wrist=(s*.36,1.20,-.83)
 spec += [('upper.'+label,shoulder,elbow,'torso'),('fore.'+label,elbow,wrist,'upper.'+label),('hand.'+label,wrist,(s*.36,1.28,-.83),'fore.'+label)]
for name,a,b,parent in spec:
 bone=arm.edit_bones.new(name);bone.head=coord(a);bone.tail=coord(b)
 if parent:bone.parent=arm.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
for source,bone in [('boatman','torso'),('upperSleeve','upper.L'),('upperSleeve','upper.R'),('foreSleeve','fore.L'),('foreSleeve','fore.R'),('handPalm','hand.L'),('handPalm','hand.R')]:
 b=arm.bones[bone];start=Vector(uncoord(b.head_local));end=Vector(uncoord(b.tail_local))
 for src in list(roots[source].children):
  o=src.copy();o.data=src.data;scene.collection.objects.link(o);o['review_only']=True;o.parent=rig
  if source!='boatman':
   q=Vector((0,1,0)).rotation_difference((end-start).normalized());o.location=coord(start)+coord(q@Vector(uncoord(src.location)));o.rotation_euler=(coord((0,1,0)).rotation_difference(coord(end-start).normalized())).to_euler()
  else:o.location=src.location.copy()
  # Armature modifier with a single rigid bone group preserves the authored
  # segmented joints and permits editing the clip in Blender.
  vg=o.vertex_groups.new(name=bone);vg.add(list(range(len(o.data.vertices))),1,'REPLACE')
  mod=o.modifiers.new('Articulated rig','ARMATURE');mod.object=rig
for frame in [1,13,25,37,49]:
 phase=(frame-1)/48*math.tau
 for b in rig.pose.bones:
  b.rotation_mode='XYZ';b.rotation_euler=(0,0,0)
  if b.name=='torso':b.rotation_euler.x=.045*math.sin(phase)
  elif b.name.startswith('upper'):b.rotation_euler.x=.25*math.sin(phase)
  elif b.name.startswith('fore'):b.rotation_euler.x=-.20*math.sin(phase)
  b.keyframe_insert(data_path='rotation_euler',frame=frame)
scene.frame_end=49;scene.frame_set(1)

world=bpy.data.worlds.new('Keeper craft studio');world.use_nodes=True;scene.world=world
bg=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs[0].default_value=(.13,.17,.19,1);bg.inputs[1].default_value=.7
for name,at,power,size in [('Craft key',(-2,3,4),350,4),('Craft fill',(3,2,2),200,3),('Craft rim',(0,3,-4),300,3)]:
 ld=bpy.data.lights.new(name,'AREA');ld.energy=power;ld.size=size;o=bpy.data.objects.new(name,ld);scene.collection.objects.link(o);o.location=coord(at);o.rotation_euler=(coord((0,.8,-1.5))-o.location).to_track_quat('-Z','Y').to_euler()
cam=bpy.data.cameras.new('Craft review');cam.type='ORTHO';cam.ortho_scale=2.1
o=bpy.data.objects.new('Craft review',cam);scene.collection.objects.link(o);o.location=coord((1.7,1.6,-4.3));o.rotation_euler=(coord((0,1.08,-1.5))-o.location).to_track_quat('-Z','Y').to_euler();scene.camera=o
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1000;scene.render.resolution_y=1000
print(json.dumps({'scene':scene.name,'prototypes':list(roots),'mesh_objects':sum(o.type=='MESH' for o in scene.objects),'rowing_rig':rig.name}))
