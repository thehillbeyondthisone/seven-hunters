"""Execute ONLY through live Blender MCP. Creates an isolated, editable study.

Metres, engine Y up. Personal belongings are authored reconstructions, not an
inventory recovered from Flannan. Existing Blender scenes and main file survive.
"""
from pathlib import Path
import bpy, bmesh, math, json
from mathutils import Vector

ROOT = Path('C:/Users/thisi/OneDrive/Documents/repos/flannan')
OUT = ROOT/'artifacts/unpacking-craft/blender'
OUT.mkdir(parents=True, exist_ok=True)
helpers = (ROOT/'tools/props/room-craft-mcp.py').read_text(encoding='utf-8').split('# Chair:')[0]
helpers = helpers.replace("ROOT = Path('C:/Users/thisi/OneDrive/Documents/flannan')", 'ROOT = Path('+repr(ROOT.as_posix())+')')
helpers = helpers.replace("OUT = ROOT/'artifacts/room-craft/blender'", "OUT = ROOT/'artifacts/unpacking-craft/blender'")
helpers = helpers.replace("bpy.data.scenes.new('Seven Hunters - room furniture and objects')", "bpy.data.scenes.new('Seven Hunters - unpacking belongings')")
exec(compile(helpers, 'retained room mesh helpers', 'exec'))
scene['unpacking_craft'] = True
scene['source_scene_retained'] = True

colors = {
 'canvas':(.36,.29,.18,0,.94), 'edge':(.23,.17,.095,0,.97),
 'thread':(.57,.47,.31,0,.95), 'lining':(.075,.062,.045,0,.97),
 'shirt':(.64,.61,.52,0,.97), 'shirtShade':(.43,.42,.36,0,.98),
 'stocking':(.047,.10,.16,0,.99), 'rib':(.07,.145,.21,0,.98),
 'string':(.56,.47,.31,0,.97), 'ink':(.085,.085,.07,0,.96),
}
for key,(r,g,b,metal,rough) in colors.items():
 mat=bpy.data.materials.new('Unpacking craft / '+key);mat.use_nodes=True
 bs=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 bs.inputs['Base Color'].default_value=(r,g,b,1)
 bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
 mat.diffuse_color=(r,g,b,1);mats[key]=mat

def signpow(v,p): return math.copysign(abs(v)**p,v)

def cord(name,points,r,model,finish,segs=6):
 pts=[];previous=None
 for i,p in enumerate(points):
  d=(Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])).normalized()
  if previous is None:
   ref=Vector((0,1,0)) if abs(d.y)<.95 else Vector((1,0,0));a=d.cross(ref).normalized()
  else: a=(previous-d*previous.dot(d)).normalized()
  b=d.cross(a).normalized();previous=a
  for j in range(segs):pts.append(tuple(Vector(p)+r*(a*math.cos(j/segs*math.tau)+b*math.sin(j/segs*math.tau))))
 faces=[(i*segs+j,i*segs+(j+1)%segs,(i+1)*segs+(j+1)%segs,(i+1)*segs+j) for i in range(len(points)-1) for j in range(segs)]
 return mesh(name,pts,faces,model,finish,True)

def ribbon(name,points,width,model,finish,axis=(1,0,0),thickness=.003):
 a=Vector(axis)*width*.5
 pts=[tuple(Vector(p)+s*a) for p in points for s in [-1,1]]
 faces=[(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(points)-1)]
 o=mesh(name,pts,faces,model,finish,True)
 if thickness:
  m=o.modifiers.new('Leather thickness','SOLIDIFY');m.thickness=thickness
 return o

def stitch(name,points,model,finish='thread',r=.0007):
 # Actual short thread segments along visible seams, merged by the exporter.
 for i in range(0,len(points)-1,2):cord(name,points[i:i+2],r,model,finish,4)

def closedpoint(u,a):
 x=(u-.5)*.86;fac=.82+.18*math.sin(u*math.pi)
 cr=signpow(math.cos(a),.73);sr=signpow(math.sin(a),.72)
 wrinkle=.003*math.sin(u*math.pi*14+math.sin(a)*2)*math.sin(a)**2
 return (x,.157+.149*cr*fac+wrinkle,.188*sr*fac+wrinkle*.7)

def endpanel(model,s):
 # Sewn oval end gussets, with a shallow gather toward the rolled seam.
 pts=[(s*.430,.157,0)]
 for k in range(1,5):
  for j in range(48):
   a=j/48*math.tau;q=k/4
   pts.append((s*(.430-.010*q*q),.157+signpow(math.cos(a),.73)*.122*q,.154*signpow(math.sin(a),.72)*q))
 faces=[(0,1+j,1+(j+1)%48) for j in range(48)]
 for k in range(3):
  for j in range(48):faces.append((1+k*48+j,1+k*48+(j+1)%48,1+(k+1)*48+(j+1)%48,1+(k+1)*48+j))
 mesh('stitched end gusset',pts,faces,model,'canvas',True)
 seam=[(s*.419,.157+.124*signpow(math.cos(j/64*math.tau),.73),.157*signpow(math.sin(j/64*math.tau),.72)) for j in range(65)]
 cord('rolled end piping',seam,.003,model,'edge',6)
 stitch('end-panel stitches',[(x-s*.003,y*1.01,z*1.025) for x,y,z in seam],model)

def buckle(model,x,y,z):
 # Open rectangular brass frame, central roller and tongue; no opaque gold cube.
 for dx in [-.022,.022]:rod('buckle side',(x+dx,y-.023,z),(x+dx,y+.023,z),.0028,model,'brass',8)
 for dy in [-.023,.023]:rod('buckle end',(x-.022,y+dy,z),(x+.022,y+dy,z),.0028,model,'brass',8)
 rod('buckle roller',(x-.023,y-.009,z-.001),(x+.023,y-.009,z-.001),.003,model,'brass',8)
 rod('buckle tongue',(x,y-.009,z-.003),(x,y+.019,z-.004),.0017,model,'brass',6)

def handles(model,opened=False):
 for s in [-1,1]:
  z=s*.106
  for x in [-.106,.106]:
   box('reinforced handle tab',(x,.285,z),(.040,.048,.009),model,'leather',.004)
   rod('handle brass rivet',(x,.283,z-s*.004),(x,.283,z+s*.006),.004,model,'brass',10)
  pts=[(-.106,.289,z),(-.118,.335,z),(-.105,.390,z),(-.073,.414,z),(.073,.414,z),(.105,.390,z),(.118,.335,z),(.106,.289,z)]
  if opened:pts=[(x,y-.027,z+s*(y-.285)*1.08) for x,y,z in pts]
  ribbon('broad loop carrying handle',pts,.026,model,'leather',(0,0,1),.004)
  for dz in [-.009,.009]:cord('handle edge stitching',[(x,y+.001,z+dz) for x,y,z in pts],.00065,model,'thread',4)

M='closed';root(M,(-.6,0,0))
surface('slumped sewn canvas holdall',lambda u,v:closedpoint(u,v*math.tau),32,48,M,'canvas',.003)
for s in [-1,1]:endpanel(M,s)
for x in [-.267,.267]:
 pts=[(x,*closedpoint((x/.86)+.5,j/64*math.tau)[1:]) for j in range(65)]
 pts=[(px,.157+(py-.157)*1.022,pz*1.025) for px,py,pz in pts]
 ribbon('wide wraparound leather belt',pts,.038,M,'leather',thickness=.004)
 for dx in [-.014,.014]:stitch('belt saddle stitches',[(px+dx,py+.001,pz*1.006) for px,py,pz in pts],M)
 buckle(M,x,.229,-.188)
 ribbon('buckled strap tail',[(x,.254,-.193),(x,.216,-.196),(x,.174,-.193),(x,.148,-.186)],.031,M,'leather',thickness=.003)
 for j in range(3):box('punched strap hole',(x,.173+j*.018,-.198),(.0038,.0048,.0008),M,'lining',.001)
# A closed mouth, two folded canvas lips and continuous piping read as a bag.
cord('closed mouth seam',[((i/32-.5)*.69,.308-.011*(abs(i/16-1)),.0015*math.sin(i/5)) for i in range(33)],.0022,M,'edge',6)
for z in [-.012,.012]:stitch('mouth seam stitches',[((i/64-.5)*.69,.307,z) for i in range(65)],M)
handles(M)

def rimpoint(a,scale=1,y=.263):
 return (.414*signpow(math.cos(a),.62)*scale,y+.008*math.sin(a*3+.7),.184*signpow(math.sin(a),.67)*scale)

M='open';root(M,(.6,0,0))
# Rounded rectangular shell curls over its rim into a separate dark lining.
profiles=[(.75,.014),(.94,.045),(1.0,.145),(1,.263),(.976,.271),(.954,.258),(.93,.15),(.85,.060),(.73,.041)]
pts=[]
for k,(scale,y) in enumerate(profiles):
 for j in range(64):
  a=j/64*math.tau;x,yy,z=rimpoint(a,scale,y)
  yy+=.004*math.sin(j*.8+k*.9)*(1 if k<4 else .35)
  pts.append((x,yy,z))
faces=[(k*64+j,k*64+(j+1)%64,(k+1)*64+(j+1)%64,(k+1)*64+j) for k in range(len(profiles)-1) for j in range(64)]
mesh('soft canvas side walls',pts[:64*5],faces[:64*4],M,'canvas',True)
mesh('deep cloth interior lining',pts,faces[64*4:],M,'lining',True)
box('lining bottom',(0,.041,0),(.60,.008,.24),M,'lining',.015)
cord('bound open mouth',[rimpoint(j/64*math.tau,.976,.271) for j in range(65)],.0034,M,'edge',6)
stitch('mouth binding stitches',[rimpoint(j/96*math.tau,.974,.273) for j in range(97)],M)
# Mouth panels fold visibly outward: front apron and rear flap have real hems.
for s in [-1,1]:
 surface('folded mouth panel',lambda u,v,s=s:((u-.5)*(.69-.10*v),.268-.112*v+.018*math.sin(v*math.pi),s*(.125+.12*v)),24,10,M,'canvas',.0027)
 cord('turned flap hem',[((i/32-.5)*.59,.159,s*.245) for i in range(33)],.0025,M,'edge',5)
 for x in [-.267,.267]:
  pts=[(x,.018,s*.11),(x,.045,s*.176),(x,.16,s*.193),(x,.259,s*.161),(x,.20,s*.229),(x,.117,s*.249)]
  ribbon('loose unfastened belt',pts,.037,M,'leather',thickness=.0035)
  if s==-1:buckle(M,x,.156,-.251)
handles(M,True)

def extruded(name,outline,height,model,finish,at=(0,0,0),edge=.003):
 n=len(outline);pts=[(x+at[0],y+at[1],z+at[2]) for y in [0,height] for x,z in outline]
 faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 return bevel(mesh(name,pts,faces,model,finish),edge,2)

M='clothes';root(M,(-.6,0,.7))
# Three soft layers and a folded shoulder front make a recognizable shirt.
for layer in range(3):
 surface('soft folded shirt layer',lambda u,v,layer=layer:((u-.5)*.292,.012+layer*.015+.004*math.sin(u*math.pi)*math.sin(v*math.pi)+(v*.003),(v-.5)*.233),20,16,M,'shirt' if layer!=1 else 'shirtShade',.003)
for s in [-1,1]:
 # Folded sleeves and turned button cuffs run beneath the shirt front.
 o=box('folded shirt sleeve',(s*.105,.058,.030),(.080,.028,.171),M,'shirt',.008)
 o.rotation_euler.z=s*.12
 box('buttoned cuff',(s*.106,.075,.095),(.080,.018,.047),M,'shirt',.004)
 lathe('cuff button',(s*.117,.087,.095),[(0,0),(.004,0),(.004,.001),(0,.001)],M,'cream',10)
extruded('shirt folded front',[(-.088,-.107),(.088,-.107),(.094,.104),(-.094,.104)],.018,M,'shirt',(0,.061,0),.004)
for s in [-1,1]:
 extruded('turned collar',[(-s*.003,-.107),(s*.070,-.107),(s*.059,-.049),(s*.007,-.065)],.007,M,'shirt',(0,.082,0),.002)
cord('shirt front placket',[(.006,.083,z) for z in [-.046,-.015,.02,.06,.10]],.0014,M,'shirtShade',5)
for z in [-.023,.02,.064]:lathe('shirt button',(.017,.085,z),[(0,0),(.0032,0),(.0032,.001),(0,.001)],M,'cream',10)
stitch('shirt hem seam',[((i/48-.5)*.28,.057,.116) for i in range(49)],M,'shirtShade',.00055)
# Blue wool stockings: shaped heels and toes, turned cuffs and knit ribs.
for x,z in [(-.073,.012),(.064,.004)]:
 outline=[(-.027,-.086),(.025,-.086),(.024,.034),(.049,.060),(.046,.084),(.022,.094),(-.019,.085),(-.030,.057)]
 extruded('folded blue stocking',outline,.022,M,'stocking',(x,.099,z),.005)
 box('turned stocking cuff',(x,.120,z-.070),(.058,.014,.041),M,'rib',.004)
 for dx in [-.019,-.011,-.003,.005,.013,.021]:
  cord('knitted stocking rib',[(x+dx,.123,z-.047),(x+dx,.124,z-.013),(x+dx,.122,z+.028)],.0009,M,'rib',4)
 for dz in [-.082,-.072,-.062]:cord('cuff rib',[(x-.025,.129,z+dz),(x+.025,.129,z+dz)],.00075,M,'stocking',4)
cord('shirt fold shadow',[(-.145,.039,-.115),(-.145,.039,.115),(.145,.039,.115)],.0017,M,'shirtShade',5)

M='parcel';root(M,(.1,0,.7))
box('paper wrapped camera parcel',(0,.063,0),(.176,.126,.148),M,'paper',.007)
# Folded triangular gussets avoid an unadorned cube silhouette.
for s in [-1,1]:
 extruded('folded paper end',[(-.083,-.072),(.083,-.072),(0,.026)],.002,M,'paper',(0,.129,s*.002),.001)
 cord('paper fold crease',[(-.082,.130,s*.067),(0,.131,s*.015),(.082,.130,s*.067)],.00065,M,'edge',4)
for x in [-.047,.047]:
 cord('parcel twine',[(x,.003,-.077),(x,.129,-.077),(x,.133,.077),(x,.003,.077),(x,.003,-.077)],.0015,M,'string',6)
cord('parcel cross twine',[(-.091,.003,0),(-.091,.132,0),(.091,.132,0),(.091,.003,0),(-.091,.003,0)],.0015,M,'string',6)
for s in [-1,1]:cord('twine bow',[(0,.136,0),(s*.030,.141,-.018),(s*.034,.139,.011),(0,.136,0),(s*.024,.136,.029)],.0013,M,'string',5)

M='wrapper';root(M,(.5,0,.7))
surface('creased opened wrapping paper',lambda u,v:((u-.5)*.29,.005+.004*math.sin(u*math.pi*3)*math.sin(v*math.pi*2),(v-.5)*.245),16,16,M,'paper',.001)
for s in [-1,1]:
 surface('bent wrapper flap',lambda u,v,s=s:(s*(.145+v*.052),.006+v*.033-.027*math.sin(v*math.pi),(u-.5)*(.245-.045*v)),10,5,M,'paper',.001)
cord('unwrapped string',[(-.12,.012,-.08),(-.15,.015,-.02),(-.09,.009,.02),(.04,.012,-.02),(.12,.013,.10)],.0013,M,'string',5)

M='note';root(M,(.9,0,.7))
surface('Mary folded note',lambda u,v:((u-.5)*.112,.0013+.001*abs(u-.5)*2+(v-.5)*.0006,(v-.5)*.068),6,4,M,'shirt',.0008)
cord('note crease',[(0,.002,-.034),(0,.0015,0),(0,.002,.034)],.00022,M,'shirtShade',4)
# Fine irregular strokes suggest handwriting without invented legible text.
for row in range(4):
 z=-.020+row*.010
 for j in range(6):
  x=-.043+j*.014;length=.008+(j+row)%3*.0014
  cord('handwritten ink stroke',[(x,.0031,z),(x+length*.35,.0032,z-.0015),(x+length*.7,.0031,z+.001),(x+length,.0031,z-.0004)],.00023,M,'ink',4)

# Mesh export evaluates modifiers in Blender, preserving metre coordinates and
# per-corner normals. No runtime geometry generation or extra material needed.
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
data={};cache={}
for obj in list(scene.objects):
 if obj.type!='MESH' or not obj.get('model'):continue
 name=obj['model'];finish=obj['finish']
 out=data.setdefault(name,{}).setdefault(finish,{'p':[],'n':[],'uv':[],'idx':[]})
 indices=cache.setdefault((name,finish),{})
 ev=obj.evaluated_get(deps);me=ev.to_mesh();me.calc_loop_triangles()
 transform=obj.parent.matrix_world.inverted()@ev.matrix_world
 normals=transform.to_3x3().inverted().transposed()
 for tri in me.loop_triangles:
  ps=[transform@me.vertices[me.loops[li].vertex_index].co for li in tri.loops]
  if (ps[1]-ps[0]).cross(ps[2]-ps[0]).length<1e-12:continue
  for li in tri.loops:
   p=uncoord(transform@me.vertices[me.loops[li].vertex_index].co)
   n=uncoord((normals@me.corner_normals[li].vector).normalized())
   if abs(n[1])>.5:uv=(p[0],p[2])
   elif abs(n[0])>.5:uv=(p[2],p[1])
   else:uv=(p[0],p[1])
   values=tuple(round(float(v),6) for v in (*p,*n,*uv))
   if values not in indices:
    indices[values]=len(out['p'])//3;out['p'].extend(values[:3]);out['n'].extend(values[3:6]);out['uv'].extend(values[6:])
   out['idx'].append(indices[values])
 ev.to_mesh_clear()
path=ROOT/'src/world/flannan/UnpackingCraftModel.js'
path.write_text('// GENERATED through live Blender MCP. Metres, Y up. Editable source: tools/props/unpacking-craft.blend.\nexport const UNPACKING_CRAFT_MODEL = '+json.dumps(data,separators=(',',':'))+';\n',encoding='utf-8')
counts={name:sum(len(g['idx'])//3 for g in finishes.values()) for name,finishes in data.items()}
bounds={}
for name,finishes in data.items():
 p=[g['p'] for g in finishes.values()]
 bounds[name]=[[min(v[k::3]) for v in p] for k in range(3)]
 bounds[name]={'min':[min(min(v[k::3]) for v in p) for k in range(3)],'max':[max(max(v[k::3]) for v in p) for k in range(3)]}
summary={'triangles':counts,'total_triangles':sum(counts.values()),'bounds':bounds,'source_scene_retained':True,'export':str(path)}
(OUT/'export-summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
t=bpy.data.texts.new('unpacking-craft-mcp.py');t.write((ROOT/'tools/props/unpacking-craft-mcp.py').read_text(encoding='utf-8'))
bpy.data.libraries.write(str(ROOT/'tools/props/unpacking-craft.blend'),{scene,t},fake_user=True,compress=True)
print(json.dumps(summary))
