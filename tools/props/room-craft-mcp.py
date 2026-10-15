"""Blender MCP room furnishing study. Metres, engine Y up. Reconstruction.

Creates an isolated scene; saves a library, never the user's open main file.
Opaque prototypes join existing batches; clear chimneys and flames use two draws.
"""
import bpy, bmesh, math, json
from pathlib import Path
from mathutils import Vector

ROOT = Path('C:/Users/thisi/OneDrive/Documents/flannan')
OUT = ROOT/'artifacts/room-craft/blender'
OUT.mkdir(parents=True, exist_ok=True)
scene = bpy.data.scenes.new('Seven Hunters - room furniture and objects')
scene['provenance'] = 'Authored reconstruction, not a recovered Flannan inventory.'
bpy.context.window.scene = scene
scene.unit_settings.system = 'METRIC'
roots, mats = {}, {}
def coord(v): return Vector((v[0],-v[2],v[1]))
def uncoord(v): return (v[0],v[2],-v[1])
palette = {
 'oak':(.28,.16,.075,0,.52), 'darkOak':(.12,.075,.035,0,.6),
 'iron':(.035,.043,.041,.65,.43), 'black':(.009,.014,.014,.1,.8),
 'brass':(.44,.29,.105,.85,.3), 'tin':(.29,.31,.29,.75,.45),
 'linen':(.66,.61,.47,0,.96), 'wool':(.10,.16,.19,0,.98),
 'oilskin':(.35,.26,.095,0,.7), 'leather':(.09,.045,.023,0,.78),
 'paper':(.80,.74,.59,0,.94), 'cream':(.68,.66,.55,0,.3),
 'blue':(.055,.12,.14,0,.32), 'glass':(.77,.67,.44,0,.12),
 'slate':(.035,.045,.05,0,.88), 'chalk':(.65,.66,.58,0,.98),
}
for key,(r,g,b,m,rough) in palette.items():
 mat=bpy.data.materials.new('Room craft / '+key); mat.use_nodes=True
 bs=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 bs.inputs['Base Color'].default_value=(r,g,b,1); bs.inputs['Metallic'].default_value=m; bs.inputs['Roughness'].default_value=rough
 if key=='glass': bs.inputs['Transmission Weight'].default_value=.8; bs.inputs['IOR'].default_value=1.45
 mat.diffuse_color=(r,g,b,1); mats[key]=mat

def root(name,at=(0,0,0)):
 o=bpy.data.objects.new(name+' / origin',None); scene.collection.objects.link(o); o.location=coord(at); roots[name]=o
 return o
def register(o,name,model,finish,grain='vertical'):
 o.name=model+' / '+name; o.parent=roots[model]; o['model']=model; o['finish']=finish; o['grain']=grain
 o.data.materials.append(mats[finish]); return o
def bevel(o,width=.002,segments=2):
 if width:
  m=o.modifiers.new('Eased manufactured edges','BEVEL'); m.width=width; m.segments=segments
  m=o.modifiers.new('Face normals','WEIGHTED_NORMAL'); m.keep_sharp=True
 return o
def box(name,at,size,model,finish,edge=.002,grain='vertical'):
 bpy.ops.mesh.primitive_cube_add(size=1,location=coord(at)); o=bpy.context.object; o.scale=(size[0],size[2],size[1])
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 return bevel(register(o,name,model,finish,grain),edge)
def mesh(name,pts,faces,model,finish,smooth=False,grain='vertical'):
 data=bpy.data.meshes.new(name); data.from_pydata([coord(p) for p in pts],[],faces); data.update()
 bm=bmesh.new(); bm.from_mesh(data); bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(data); bm.free()
 o=bpy.data.objects.new(name,data); scene.collection.objects.link(o); register(o,name,model,finish,grain)
 for p in data.polygons: p.use_smooth=smooth
 return o
def surface(name,fn,nu,nv,model,finish,thickness=.002):
 pts=[fn(i/nu,j/nv) for j in range(nv+1) for i in range(nu+1)]
 faces=[(j*(nu+1)+i,j*(nu+1)+i+1,(j+1)*(nu+1)+i+1,(j+1)*(nu+1)+i) for j in range(nv) for i in range(nu)]
 o=mesh(name,pts,faces,model,finish,True)
 if thickness:
  m=o.modifiers.new('Real fabric thickness','SOLIDIFY'); m.thickness=thickness
 return o
def lathe(name,at,profile,model,finish,segs=32,axis=(0,1,0),scale=(1,1,1)):
 pts=[(math.cos(i/segs*math.tau)*r,h,math.sin(i/segs*math.tau)*r) for r,h in profile for i in range(segs)]
 faces=[]
 for j in range(len(profile)-1):
  for i in range(segs): faces.append((j*segs+i,j*segs+(i+1)%segs,(j+1)*segs+(i+1)%segs,(j+1)*segs+i))
 o=mesh(name,pts,faces,model,finish,True)
 o.location=coord(at); o.rotation_euler=coord((0,1,0)).rotation_difference(coord(axis).normalized()).to_euler(); o.scale=(scale[0],scale[2],scale[1])
 return o
def rod(name,a,b,r,model,finish,segs=12):
 v=Vector(b)-Vector(a)
 return lathe(name,a,[(0,0),(r,0),(r,v.length),(0,v.length)],model,finish,segs,tuple(v))
def tube(name,points,r,model,finish,segs=8):
 pts=[]
 for i,p in enumerate(points):
  direction=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
  direction.normalize(); other=Vector((0,1,0)) if abs(direction.y)<.95 else Vector((1,0,0))
  a=direction.cross(other).normalized(); b=direction.cross(a).normalized()
  for j in range(segs): pts.append(tuple(Vector(p)+r*(a*math.cos(j/segs*math.tau)+b*math.sin(j/segs*math.tau))))
 faces=[(i*segs+j,i*segs+(j+1)%segs,(i+1)*segs+(j+1)%segs,(i+1)*segs+j) for i in range(len(points)-1) for j in range(segs)]
 return mesh(name,pts,faces,model,finish,True)
def ring(name,at,R,r,model,finish,axis=(0,1,0),segs=32):
 pts=[(at[0]+R*math.cos(i/segs*math.tau),at[1],at[2]+R*math.sin(i/segs*math.tau)) for i in range(segs+1)]
 if axis!=(0,1,0):
  q=Vector((0,1,0)).rotation_difference(Vector(axis)); pts=[tuple(Vector(at)+q@(Vector(p)-Vector(at))) for p in pts]
 return tube(name,pts,r,model,finish,8)
def screw(at,model,axis=(0,0,1),r=.003):
 rod('slotted screw',at,tuple(Vector(at)+Vector(axis)*.002),r,model,'tin',12)
 # Dark incised line on the screw head, visible at close range.
 if abs(axis[0])>.5: box('head slot',(at[0]+axis[0]*.0022,at[1],at[2]),(.0005,.001,r*1.4),model,'black',0)
 else: box('head slot',(at[0],at[1],at[2]+axis[2]*.0022),(r*1.4,.001,.0005),model,'black',0)

# Chair: rounded dished seat, splayed turned legs, curved crest and bowed slats.
root('chair',(-1.1,0,0))
outline=[(-.185,-.205),(.185,-.205),(.215,-.17),(.205,.15),(.17,.205),(-.17,.205),(-.205,.15),(-.215,-.17)]
pts=[(x,y,z) for y in [.424,.462] for x,z in outline]; n=len(outline)
faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
bevel(mesh('shaped seat edge',pts,faces,'chair','oak'),.008,3)
surface('saddled seat',lambda u,v:((u-.5)*.395,.464-.016*math.sin(u*math.pi)*math.sin(v*math.pi),(v-.5)*.37),18,16,'chair','oak',.003)
for sx in [-1,1]:
 for sz in [-1,1]:
  lathe('turned splayed leg',(sx*.19,.012,sz*.178),[(0,0),(.025,0),(.027,.016),(.024,.045),(.016,.10),(.020,.13),(.020,.145),(.014,.17),(.016,.265),(.026,.29),(.027,.31),(.023,.34),(.023,.42),(0,.42)],'chair','oak',16,(-sx*.055,1,-sz*.05))
for sx in [-1,1]:
 tube('rear post',[(sx*.17,.43,.17),(sx*.17,.62,.19),(sx*.17,.8,.217),(sx*.17,.965,.23)],.019,'chair','oak',12)
 rod('side stretcher',(sx*.184,.215,-.18),(sx*.177,.215,.185),.012,'chair','darkOak')
 screw((sx*.17,.94,.207),'chair',axis=(0,0,-1))
rod('front stretcher',(-.187,.24,-.18),(.187,.24,-.18),.013,'chair','oak')
rod('rear stretcher',(-.18,.225,.18),(.18,.225,.18),.012,'chair','darkOak')
box('lower back rail',(0,.551,.185),(.35,.048,.031),'chair','oak',.004,'horizontal')
surface('shaped crest',lambda u,v:((u-.5)*.41,.89+.09*v+.018*math.sin(u*math.pi),.225-.025*math.sin(u*math.pi)),24,4,'chair','oak',.032)
for x in [-.102,0,.102]:
 surface('bowed back slat',lambda u,v,x=x:(x+(u-.5)*(.036+.012*math.sin(v*math.pi)),.572+v*.325,.19+v*.033-.028*math.sin(v*math.pi)),4,16,'chair','oak',.012)
 for y,z in [(.58,.181),(.89,.207)]: rod('joinery peg',(x,y,z),(x,y,z-.003),.004,'chair','darkOak',8)

root('tableLeg',(-.6,0,0))
lathe('baluster turned leg',(0,0,0),[(0,0),(.027,0),(.032,.015),(.032,.035),(.025,.048),(.018,.11),(.022,.28),(.026,.32),(.034,.35),(.037,.37),(.037,.39),(.029,.405),(.024,.43),(.026,.47),(.035,.50),(.037,.52),(.035,.57),(.035,.62),(0,.62)],'tableLeg','oak',20)
box('square tenon block',(0,.655,0),(.074,.11,.074),'tableLeg','oak',.002)
root('tableTop',(-.6,0,-1))
for i in range(4): box('separate eased plank',(0,.025,-.5+(i+.5)/4),(1,.05,.248),'tableTop','oak',.003,'horizontal')

# Standing lamp: rolled fount, filler cap, pierced burner and wick wheel.
root('oilLamp',(0,0,0))
lathe('rolled brass fount',(0,0,0),[(0,0),(.068,0),(.087,.004),(.092,.011),(.092,.019),(.086,.024),(.087,.052),(.079,.068),(.056,.082),(.032,.087),(.028,.096),(0,.096)],'oilLamp','brass',40)
ring('foot rolled seam',(0,.014,0),.091,.002,'oilLamp','brass')
lathe('burner collar',(0,.087,0),[(.028,0),(.032,.003),(.032,.011),(.026,.016),(.026,.026),(.022,.031)],'oilLamp','brass',32)
lathe('filler cap',(-.052,.071,0),[(0,0),(.013,0),(.014,.004),(.014,.009),(.01,.012),(0,.012)],'oilLamp','brass',20)
for i in range(16):
 a=i/16*math.tau
 rod('burner ventilation rib',(.028*math.cos(a),.105,.028*math.sin(a)),(.028*math.cos(a),.123,.028*math.sin(a)),.0015,'oilLamp','brass',6)
ring('chimney support ring',(0,.123,0),.03,.002,'oilLamp','brass')
lathe('thin open glass chimney',(0,.122,0),[(.030,0),(.037,.011),(.045,.035),(.046,.060),(.043,.09),(.033,.127),(.025,.16),(.025,.211),(.026,.217),(.025,.218)],'oilLamp','glass',40)
rod('wick spindle',(.025,.107,0),(.061,.107,0),.0025,'oilLamp','brass')
lathe('knurled wick wheel',(.062,.107,0),[(0,0),(.011,0),(.011,.003),(0,.003)],'oilLamp','brass',24,(1,0,0))
for i in range(12):
 a=i/12*math.tau
 rod('wheel tooth',(.062,.107+math.cos(a)*.011,math.sin(a)*.011),(.066,.107+math.cos(a)*.011,math.sin(a)*.011),.001,'oilLamp','brass',6)
box('flat wick',(0,.13,0),(.014,.016,.0025),'oilLamp','black',.0005)

root('hangingLamp',(.5,0,0))
# Origin is the suspension point. Flame is exactly y=-.255*.84 in the game.
lathe('spun reflector',(0,-.17,0),[(.029,.11),(.035,.09),(.06,.068),(.096,.05),(.125,.027),(.128,.018),(.122,.014)],'hangingLamp','tin',40)
ring('reflector rolled edge',(0,-.153,0),.126,.003,'hangingLamp','tin')
lathe('ventilated cap',(0,-.09,0),[(.018,0),(.028,.014),(.025,.034),(.019,.05),(.017,.06)],'hangingLamp','iron',24)
ring('suspension eye',(0,-.015,0),.016,.003,'hangingLamp','iron',(0,0,1),20)
lathe('reservoir',(0,-.385,0),[(0,0),(.064,0),(.078,.012),(.075,.04),(.054,.052),(.032,.063),(0,.063)],'hangingLamp','brass',32)
lathe('guarded chimney',(0,-.323,0),[(.035,0),(.048,.02),(.053,.059),(.042,.10),(.027,.141),(.026,.17)],'hangingLamp','glass',32)
for sx in [-1,1]:
 tube('curved guard',[(sx*.067,-.36,0),(sx*.085,-.32,0),(sx*.085,-.22,0),(sx*.06,-.12,0),(sx*.027,-.07,0)],.004,'hangingLamp','iron')
ring('base seam',(0,-.368,0),.076,.002,'hangingLamp','brass')

# Dresser, facing +X. Framed inset doors and shelf backs replace monolithic box.
root('dresser',(1.25,0,0))
for z in [-.74,.74]:
 for x in [-.22,.22]: box('bracket foot',(x,.07,z),(.095,.14,.11),'dresser','darkOak',.008)
box('bottom board',(0,.15,0),(.54,.07,1.64),'dresser','oak',.003,'horizontal')
for z in [-.79,.79]: box('carcass side',(0,.48,z),(.55,.65,.06),'dresser','oak',.003)
box('cabinet back',(-.262,.48,0),(.025,.65,1.55),'dresser','darkOak',.001)
for z in [-.80,0,.80]: box('front stile',(.275,.48,z),(.045,.65,.055),'dresser','oak',.002)
for y in [.175,.805]: box('front rail',(.275,y,0),(.045,.065,1.65),'dresser','oak',.002,'horizontal')
for z in [-.405,.405]:
 box('recessed field',(.274,.49,z),(.023,.49,.61),'dresser','darkOak',.004)
 box('raised field',(.289,.49,z),(.012,.42,.54),'dresser','oak',.010)
 for zz in [z-.345,z+.345]: box('door stile',(.298,.49,zz),(.032,.60,.048),'dresser','oak',.003)
 for yy in [.214,.766]: box('door rail',(.298,yy,z),(.032,.048,.69),'dresser','oak',.003,'horizontal')
 for yy in [.24,.74]:
  box('panel bead',(.309,yy,z),(.012,.009,.60),'dresser','oak',.003,'horizontal')
 for zz in [z-.304,z+.304]: box('panel bead',(.309,.49,zz),(.012,.50,.009),'dresser','oak',.003)
 rod('knob stem',(.31,.52,z+.21),(.328,.52,z+.21),.005,'dresser','brass')
 lathe('turned knob',(.328,.52,z+.21),[(0,0),(.011,0),(.016,.006),(.013,.013),(0,.016)],'dresser','brass',20,(1,0,0))
 for yy in [.30,.68]:
  box('hinge leaf',(.316,yy,z-.31),(.005,.05,.038),'dresser','iron',.001)
  rod('hinge barrel',(.322,yy-.028,z-.333),(.322,yy+.028,z-.333),.006,'dresser','iron')
  screw((.32,yy,z-.30),'dresser',(1,0,0),.0025)
for y,depth,width in [(.85,.60,1.70),(.885,.64,1.75),(.914,.63,1.74)]: box('stepped worktop',(0,y,0),(depth,.029,width),'dresser','oak',.004,'horizontal')
for i in range(10): box('beaded backing',(-.266,1.64,-.765+(i+.5)*.153),(.024,1.44,.151),'dresser','darkOak',.001)
for z in [-.8,.8]: box('upper upright',(-.21,1.67,z),(.085,1.50,.075),'dresser','oak',.003)
for y in [1.26,1.78,2.27]:
 box('shelf',(-.09,y,0),(.40,.035,1.62),'dresser','oak',.003,'horizontal')
 box('rounded shelf lip',(.113,y+.002,0),(.018,.04,1.64),'dresser','oak',.005,'horizontal')
 # Scroll-free curved timber brackets visibly carry each shelf.
 for z in [-.73,.73]:
  shape=[(-.22,y-.19,z),(-.22,y-.02,z),(.07,y-.02,z),(.07,y-.06,z),(-.05,y-.08,z),(-.15,y-.16,z)]
  pts=shape+[(x,yy,zz+.035) for x,yy,zz in shape]; nn=len(shape)
  faces=[tuple(reversed(range(nn))),tuple(range(nn,nn*2))]+[(i,(i+1)%nn,(i+1)%nn+nn,i+nn) for i in range(nn)]
  bevel(mesh('shelf bracket',pts,faces,'dresser','oak'),.003)
for y,dep,wid in [(2.37,.12,1.74),(2.40,.18,1.79),(2.425,.20,1.82)]: box('crown moulding',(-.21,y,0),(dep,.03,wid),'dresser','oak',.004,'horizontal')

# Gathered curtain: independent folds, stitched hems, tie band and hanging rings.
root('curtain',(2.2,0,0))
def curtain(u,v):
 gather=1-.40*math.exp(-((v-.47)/.16)**2)
 return ((u-.5)*.25*gather+.027*math.sin(v*math.pi),v*1.49,.029*math.sin(u*math.tau*5)+.006*math.sin(v*12+u*15))
surface('folded linen',curtain,32,20,'curtain','linen',.002)
for v in [.016,.035,.97,.987]: tube('stitched hem',[curtain(i/40,v) for i in range(41)],.0011,'curtain','linen',6)
for u in [.018,.982]: tube('selvedge',[curtain(u,i/30) for i in range(31)],.0013,'curtain','linen',6)
surface('tieback',lambda u,v:((u-.5)*.17+.026,.67+v*.035,.036+.012*math.sin(u*math.pi)),20,2,'curtain','darkOak',.003)
for i in range(5): ring('curtain ring',((i/4-.5)*.25,1.515,0),.022,.003,'curtain','brass',(1,0,0),16)

# Stove fittings, facing +X: heavy frame, fitted doors, latch, cast ribs, ash lip.
root('stoveFront',(3,0,0))
for yy,hh,ww in [(.53,.34,.48),(.23,.16,.50)]:
 box('door frame',(.006,yy,0),(.035,hh+.035,ww+.035),'stoveFront','iron',.009)
 box('recess shadow',(.026,yy,0),(.008,hh-.014,ww-.014),'stoveFront','black',.004)
 box('cast door',(.034,yy,0),(.024,hh-.034,ww-.034),'stoveFront','iron',.008)
 for z in [-ww/2+.017,ww/2-.017]:
  box('raised border',(.05,yy,z),(.012,hh-.025,.012),'stoveFront','iron',.004)
 for y in [yy-hh/2+.018,yy+hh/2-.018]: box('raised border',(.05,y,0),(.012,.012,ww-.025),'stoveFront','iron',.004,'horizontal')
 for y in [yy-hh*.27,yy+hh*.27]:
  rod('hinge barrel',(.052,y-.026,-ww/2+.025),(.052,y+.026,-ww/2+.025),.010,'stoveFront','iron')
  rod('hinge pin',(.052,y-.032,-ww/2+.025),(.052,y+.032,-ww/2+.025),.004,'stoveFront','tin')
 rod('latch pivot',(.05,yy,ww*.28),(.077,yy,ww*.28),.010,'stoveFront','iron')
 tube('lifting latch',[(.079,yy,ww*.28),(.08,yy+.018,ww*.13),(.085,yy+.012,.015)],.007,'stoveFront','tin')
 for z in [-ww*.38,ww*.38]: screw((.053,yy+hh*.36,z),'stoveFront',(1,0,0),.0035)
for i in range(7): box('ash draft slot',(.048,.23,-.16+i*.052),(.002,.042,.016),'stoveFront','black',.004)
for z in [-.15,0,.15]: box('firebox casting rib',(.049,.53,z),(.009,.19,.012),'stoveFront','iron',.004)
box('ash shelf',(.075,.12,0),(.16,.025,.54),'stoveFront','iron',.006,'horizontal')
rod('front towel rail',(.075,.77,-.28),(.075,.77,.28),.012,'stoveFront','tin',20)
for z in [-.25,.25]: rod('rail bracket',(.01,.77,z),(.075,.77,z),.008,'stoveFront','iron')

root('hob',(3.6,0,0))
lathe('fitted hob plate',(0,0,0),[(0,0),(.103,0),(.108,.004),(.108,.009),(.098,.011),(0,.011)],'hob','iron',40)
for R in [.059,.085,.103]: ring('concentric casting',(0,.011,0),R,.0018,'hob','tin')
box('lifting slot',(0,.012,0),(.022,.001,.006),'hob','black',.002)

root('kettle',(4.0,0,0))
lathe('hammered body',(0,0,0),[(0,0),(.072,0),(.112,.01),(.132,.035),(.139,.085),(.13,.137),(.107,.177),(.079,.185),(.079,.193),(.071,.195)],'kettle','iron',40)
ring('base seam',(0,.016,0),.118,.0025,'kettle','tin')
lathe('fitted lid',(0,.185,0),[(0,.028),(.035,.024),(.069,.013),(.082,.009),(.082,.003),(.075,0)],'kettle','tin',32)
lathe('lid knob',(0,.212,0),[(0,0),(.012,0),(.012,.01),(.018,.014),(.017,.022),(0,.026)],'kettle','black',20)
pts=[]; faces=[]
for i in range(13):
 t=i/12; x=.105+.15*t; y=.08+.09*t+.018*t*t; R=.035*(1-t)+.019*t
 for j in range(20):
  a=j/20*math.tau; pts.append((x-.45*math.cos(a)*R,y+.9*math.cos(a)*R,math.sin(a)*R))
for i in range(12):
 for j in range(20): faces.append((i*20+j,i*20+(j+1)%20,(i+1)*20+(j+1)%20,(i+1)*20+j))
o=mesh('curved hollow spout',pts,faces,'kettle','iron',True); m=o.modifiers.new('Spout wall','SOLIDIFY'); m.thickness=.002
tube('arched carrying handle',[(.10*math.cos(i/24*math.pi),.135+.185*math.sin(i/24*math.pi),0) for i in range(25)],.009,'kettle','iron',10)
for x in [-.101,.101]:
 rod('handle hinge',(x,.137,-.014),(x,.137,.014),.013,'kettle','tin')
 screw((x,.137,.014),'kettle')

root('cup',(4.6,0,0))
lathe('hollow glazed cup',(0,0,0),[(0,0),(.028,0),(.03,.004),(.03,.009),(.034,.014),(.038,.073),(.039,.080),(.036,.082),(.033,.076),(.029,.015),(0,.012)],'cup','cream',32)
ring('blue rim',(0,.079,0),.0375,.0014,'cup','blue')
tube('attached handle',[(.033,.065,0),(.05,.071,0),(.065,.058,0),(.064,.037,0),(.049,.022,0),(.032,.025,0)],.005,'cup','cream',10)
root('plate',(5.0,0,0))
lathe('crockery plate',(0,0,0),[(0,0),(.049,0),(.052,.003),(.052,.007),(.067,.008),(.098,.021),(.103,.024),(.102,.027),(.092,.027),(.058,.012),(0,.011)],'plate','cream',40)
for R in [.092,.098]: ring('glazed blue line',(0,.027,0),R,.0008,'plate','blue')
root('jug',(5.4,0,0))
lathe('hollow stoneware jug',(0,0,0),[(0,0),(.052,0),(.057,.01),(.078,.045),(.083,.10),(.071,.18),(.047,.235),(.051,.265),(.049,.274),(.043,.272),(.04,.235),(.063,.17),(.07,.10),(.066,.05),(0,.017)],'jug','cream',36)
tube('jug handle',[(.052,.24,0),(.091,.25,0),(.12,.21,0),(.12,.14,0),(.083,.09,0)],.009,'jug','cream',10)
surface('pouring lip',lambda u,v:((u-.5)*.04,.265+.015*math.sin(v*math.pi),-.045-v*.025),10,8,'jug','cream',.004)

root('tin',(5.9,0,0))
lathe('pressed biscuit tin',(0,0,0),[(0,0),(.084,0),(.09,.005),(.09,.048),(.092,.05),(.092,.055),(.088,.059),(0,.059)],'tin','tin',40)
for y in [.006,.048,.055]: ring('rolled seam',(0,y,0),.09,.0015,'tin','tin')
lathe('lid inset',(0,.059,0),[(0,0),(.071,0),(.077,.002),(.077,.003),(.073,.004),(0,.004)],'tin','tin',32)
root('oilCan',(6.3,0,0))
lathe('seamed oil can',(0,0,0),[(0,0),(.087,0),(.099,.007),(.099,.025),(.095,.03),(.095,.29),(.099,.295),(.095,.31),(.067,.34),(.026,.34),(.026,.37),(.032,.37),(.032,.381),(0,.381)],'oilCan','tin',32)
for y in [.016,.296]: ring('rolled bead',(0,y,0),.098,.002,'oilCan','tin')
tube('strap handle',[(-.066,.321,0),(-.063,.405,0),(.045,.405,0),(.061,.333,0)],.009,'oilCan','tin',8)
for z in [-.025,.025]: box('cap grip',(.0,.382,z),(.05,.007,.006),'oilCan','tin',.002)

root('crate',(6.9,0,0))
for x in [-.22,.22]:
 for z in [-.16,.16]: box('corner cleat',(x,.25,z),(.05,.49,.045),'crate','darkOak',.002)
for i in range(5):
 y=.05+i*.099
 for z in [-.184,.184]:
  box('side plank',(0,y,z),(.50,.095,.025),'crate','oak',.001,'horizontal')
  for x in [-.22,.22]: rod('nail',(x,y,z),(x,y,z+math.copysign(.0015,z)),.003,'crate','iron',8)
 for x in [-.24,.24]: box('end plank',(x,y,0),(.025,.095,.34),'crate','oak',.001,'horizontal')
for z in [-.125,0,.125]: box('lid plank',(0,.50,z),(.5,.023,.122),'crate','oak',.002,'horizontal')
for x in [-.17,.17]: box('lid batten',(x,.518,0),(.045,.018,.38),'crate','darkOak',.002)

# Folded textile with separate rolled layers, a turned corner and stitched edge.
root('foldedCloth',(7.5,0,0))
for layer in range(3):
 surface('folded linen layer',lambda u,v,layer=layer:((u-.5)*(.275-layer*.008),.006+layer*.009+.005*math.sin(u*math.pi)+.002*math.sin(v*12+u*8),(v-.5)*(.26-layer*.009)),16,12,'foldedCloth','linen',.006)
tube('folded edge',[(-.13+i/32*.26,.027+.003*math.sin(i/32*math.pi),.12) for i in range(33)],.003,'foldedCloth','linen')
surface('turned corner',lambda u,v:(.1-u*.06,.03+.022*math.sin(v*math.pi/2),.12-v*.07+u*.015),8,8,'foldedCloth','linen',.002)

# Open journal: covers, gathered signatures, concave pages and cloth bookmark.
root('journal',(8,0,0))
for x in [-.132,.132]: box('leather cover',(x,.008,0),(.255,.014,.36),'journal','leather',.004,'horizontal')
for side in [-1,1]:
 for k in range(5):
  surface('gathered signature',lambda u,v,side=side,k=k:(side*(.008+u*.232),.017+k*.003+.009*(1-u)**2,(v-.5)*.334),10,2,'journal','paper',.002)
 surface('open leaf',lambda u,v,side=side:(side*(.006+u*.233),.034+.012*(1-u)**2+.003*math.sin(v*math.pi)*u,(v-.5)*.333),24,16,'journal','paper',.001)
 # Ruled lines only, no invented historical diary text.
 for k in range(12):
  z=-.14+k*.024
  tube('faint ruling',[(side*(.028+i/16*.196),.0348+.012*(1-(.022+i/16*.196)/.233)**2+.003*math.sin((z/.333+.5)*math.pi)*((.022+i/16*.196)/.233),z) for i in range(17)],.0003,'journal','tin',4)
tube('spine crease',[(0,.038,-.168),(0,.042,0),(0,.038,.168)],.003,'journal','leather')
surface('ribbon bookmark',lambda u,v:((u-.5)*.011-.04,.039-max(0,v-.68)*.10,.08+v*.17),3,18,'journal','wool',.001)

root('inkpot',(8.7,0,0))
lathe('glass ink bottle',(0,0,0),[(0,0),(.027,0),(.032,.006),(.032,.032),(.025,.045),(.014,.048),(.014,.061),(.010,.062),(.01,.048),(0,.040)],'inkpot','slate',24)
ring('bottle lip',(0,.06,0),.013,.0015,'inkpot','tin',segs=24)
box('paper label',(0,.023,.031),(.034,.022,.001),'inkpot','paper',.001)
lathe('loose cork',(.043,.002,.006),[(0,0),(.011,0),(.013,.013),(0,.014)],'inkpot','darkOak',16)
rod('pen holder',(-.03,.008,.07),(.09,.012,.18),.003,'inkpot','darkOak')
rod('metal nib',(.09,.012,.18),(.105,.0125,.194),.002,'inkpot','brass',8)

root('slate',(9.2,0,0))
box('slate stone',(0,.20,0),(.30,.36,.012),'slate','slate',.004)
for x in [-.165,.165]: box('frame stile',(x,.20,.0),(.03,.42,.028),'slate','oak',.004)
for y in [.005,.395]: box('frame end',(0,y,0),(.30,.03,.028),'slate','oak',.004,'horizontal')
for x in [-.15,.15]:
 for y in [.017,.383]: rod('frame peg',(x,y,.015),(x,y,.017),.0025,'slate','darkOak',8)
rod('chalk on ledge',(-.10,.025,.023),(-.025,.025,.023),.004,'slate','chalk')
box('chalk ledge',(0,.008,.025),(.30,.02,.035),'slate','oak',.003,'horizontal')

root('oilskins',(9.9,0,0))
def coat(u,v):
 a=.12+u*(math.tau-.24); width=.19+.035*math.sin(v*math.pi)-.11*v**7
 return (.3+math.sin(a)*width,.75+v*.99+.012*math.cos(a*3)*(1-v),.13+math.cos(a)*(.065+.013*math.sin(a*13+v*7)))
surface('hanging coat body',coat,40,26,'oilskins','oilskin',.003)
for side in [-1,1]:
 # Flattened hanging sleeves; shoulders pinch near the hook.
 lathe('creased sleeve',(.3+side*.17,1.58,.13),[(.055,0),(.06,.04),(.053,.10),(.044,.25),(.039,.38),(.042,.43)],'oilskins','oilskin',24,(side*.28,-1,.03),(1,1,.62))
 ring('cuff seam',(.3+side*.27,1.18,.142),.042,.002,'oilskins','darkOak',(side*.28,-1,.03),24)
surface('turned collar',lambda u,v:(.3+(u-.5)*.18,1.72-v*.09,.19+.03*math.sin(u*math.pi)-.018*v),20,6,'oilskins','oilskin',.004)
for v in [.06,.97]: tube('stitched coat hem',[coat(i/52,v) for i in range(53)],.0015,'oilskins','darkOak',6)
for u in [.0,1.0]: tube('front seam',[coat(u,i/30) for i in range(31)],.002,'oilskins','darkOak',6)
for i in range(5): rod('coat button',(.31,.98+i*.14,.208),(.31,.98+i*.14,.212),.005,'oilskins','darkOak',10)
for x in [.19,.39]: surface('patch pocket',lambda u,v,x=x:(x+(u-.5)*.09,.94+v*.12,.207+.006*math.sin(u*math.pi)),10,8,'oilskins','oilskin',.003)
lathe('sou wester crown',(-.10,1.76,.16),[(.13,0),(.12,.045),(.105,.10),(.065,.14),(0,.15)],'oilskins','oilskin',36,(0,1,0),(1,1,.9))
surface('asymmetric hat brim',lambda u,v:((.10+v*.10)*math.cos(u*math.tau)-.10,1.76-.06*v*(.5+.5*math.sin(u*math.tau)),.16+(.09+v*.11)*math.sin(u*math.tau)),48,6,'oilskins','oilskin',.003)

root('clock',(10.7,0,0))
lathe('turned wooden case',(0,0,0),[(0,-.01),(.15,-.01),(.168,-.004),(.176,.01),(.175,.032),(.162,.044),(.158,.052),(.145,.058),(.138,.055),(.138,.045)],'clock','darkOak',64,(0,0,1))
lathe('cream dial',(0,0,.052),[(0,0),(.138,0),(.138,.003),(0,.003)],'clock','cream',64,(0,0,1))
for R in [.143,.164]: ring('turned bezel',(0,0,.049),R,.003,'clock','brass',(0,0,1),64)
for i in range(60):
 a=i/60*math.tau; r0=.124 if i%5 else .117
 rod('minute graduation',(math.sin(a)*r0,math.cos(a)*r0,.059),(math.sin(a)*.130,math.cos(a)*.130,.059),.0007 if i%5 else .0012,'clock','black',4)
# Serif Roman numerals, converted to actual mesh; hands stay driven by game time.
for i,roman in enumerate(['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI']):
 a=i/12*math.tau; curve=bpy.data.curves.new('dial numeral','FONT'); curve.body=roman; curve.align_x='CENTER'; curve.align_y='CENTER'; curve.size=.021; curve.extrude=.00015
 o=bpy.data.objects.new('dial numeral',curve); scene.collection.objects.link(o); o.location=coord((math.sin(a)*.099,math.cos(a)*.099,.059))
 o.rotation_euler=(math.pi/2,0,0); bpy.context.view_layer.objects.active=o; o.select_set(True)
 bpy.ops.object.convert(target='MESH'); register(o,'Roman numeral '+roman,'clock','black'); o.select_set(False)

# Indexed evaluated export with split normals; weld only identical corner tuples.
bpy.context.view_layer.update(); deps=bpy.context.evaluated_depsgraph_get(); data={}; caches={}
for obj in list(scene.objects):
 if obj.type!='MESH' or not obj.get('model'): continue
 model=obj['model']; finish=obj['finish']; grain=obj['grain']; key=finish+'/'+grain
 out=data.setdefault(model,{}).setdefault(key,{'p':[],'n':[],'uv':[],'idx':[]}); cache=caches.setdefault((model,key),{})
 evaluated=obj.evaluated_get(deps); me=evaluated.to_mesh(); me.calc_loop_triangles(); transform=obj.parent.matrix_world.inverted() @ evaluated.matrix_world
 normal_matrix=transform.to_3x3().inverted().transposed()
 for tri in me.loop_triangles:
  ps=[transform @ me.vertices[me.loops[i].vertex_index].co for i in tri.loops]
  if (ps[1]-ps[0]).cross(ps[2]-ps[0]).length<1e-12: continue
  for li in tri.loops:
   p=uncoord(transform @ me.vertices[me.loops[li].vertex_index].co); n=uncoord((normal_matrix @ me.corner_normals[li].vector).normalized())
   if abs(n[1])>.5: uv=(p[0],p[2])
   elif abs(n[0])>.5: uv=(p[1],p[2]) if grain=='vertical' else (p[2],p[1])
   else: uv=(p[1],p[0]) if grain=='vertical' else (p[0],p[1])
   values=tuple(round(float(v),6) for v in (*p,*n,*uv))
   if values not in cache:
    cache[values]=len(out['p'])//3; out['p'].extend(values[:3]); out['n'].extend(values[3:6]); out['uv'].extend(values[6:])
   out['idx'].append(cache[values])
 evaluated.to_mesh_clear()
path=ROOT/'src/world/flannan/RoomCraftModel.js'
path.write_text('// GENERATED in live Blender by tools/props/room-craft-mcp.py. Metres, Y up.\n// Reconstruction; finish groups stamp into existing material batches.\nexport const ROOM_CRAFT_MODEL = '+json.dumps(data,separators=(',',':'))+';\n',encoding='utf-8')
counts={name:sum(len(g['idx'])//3 for g in batches.values()) for name,batches in data.items()}
(OUT/'export-summary.json').write_text(json.dumps({'triangles':counts,'source':str(path),'scene':scene.name},indent=2))

# Studio close-up set; reusable prototypes remain separately editable.
for name,o in roots.items(): o.hide_render=name not in ['chair','oilLamp','dresser','kettle','jug','journal','oilskins']
for name,at in {'chair':(-1.05,0,.3),'dresser':(.65,0,-.3),'oilLamp':(-.7,.76,.6),'kettle':(-.1,.76,.6),'jug':(.38,.76,.6),'journal':(-.35,.76,1.05),'oilskins':(1.6,0,.1)}.items(): roots[name].location=coord(at)
for o in scene.objects:
 if o.parent: o.hide_render=o.parent.hide_render
table=box('review tabletop',(-.35,.735,.8),(1.4,.05,.85),'tableLeg','oak',.006,'horizontal'); table.parent=None; table.hide_render=False; table['review_only']=True
for sx in [-1,1]:
 for sz in [-1,1]:
  for source in list(roots['tableLeg'].children):
   o=source.copy(); o.data=source.data; scene.collection.objects.link(o); o.parent=None
   o.location=source.location+coord((-.35+sx*.59,.015,.8+sz*.33)); o.hide_render=False; o['review_only']=True
world=bpy.data.worlds.new('Room craft studio'); world.use_nodes=True; scene.world=world
bg=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND'); bg.inputs[0].default_value=(.16,.18,.20,1); bg.inputs[1].default_value=.55
for name,at,power,size in [('Key',(-3,4,4),550,4),('Fill',(4,3,3),350,3),('Rim',(0,4,-3),450,3)]:
 lamp=bpy.data.lights.new(name,'AREA'); lamp.energy=power; lamp.size=size; o=bpy.data.objects.new(name,lamp); scene.collection.objects.link(o); o.location=coord(at); o.rotation_euler=(coord((0,1,0))-o.location).to_track_quat('-Z','Y').to_euler()
camera=bpy.data.cameras.new('Room craft review'); camera.type='ORTHO'; camera.ortho_scale=4.5
o=bpy.data.objects.new('Room craft review',camera); scene.collection.objects.link(o); o.location=coord((4,3.2,6)); o.rotation_euler=(coord((.25,1.15,.3))-o.location).to_track_quat('-Z','Y').to_euler(); scene.camera=o
scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.use_denoising=True
scene.render.resolution_x=1500; scene.render.resolution_y=1100; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(OUT/'room-craft.png')
source=bpy.data.texts.new('room-craft-mcp.py'); source.write((ROOT/'tools/props/room-craft-mcp.py').read_text(encoding='utf-8'))
bpy.data.libraries.write(str(ROOT/'tools/props/room-craft.blend'),{scene,source},fake_user=True,compress=True)
print(json.dumps({'scene':scene.name,'models':len(counts),'triangles':counts,'export':str(path)}))
