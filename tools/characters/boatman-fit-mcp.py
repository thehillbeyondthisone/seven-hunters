"""Fit the lower jacket over the seated lap, then invert the skin deformation.

The actor is seated throughout his appearance. Fitting in the actual seated
pose avoids the angular trouser intersections produced by a standing coat hem.
"""
from mathutils.bvhtree import BVHTree
def smoothstep(x):x=max(0,min(1,x));return x*x*(3-2*x)
scene.frame_set(24);bpy.context.view_layer.update()
pants=next(o for o in scene.objects if o.name.startswith('Boatman / retained wool'))
tree=BVHTree.FromObject(pants,bpy.context.evaluated_depsgraph_get())
deforms={b.name:arm.pose.bones[b.name].matrix@b.matrix_local.inverted() for b in arm.data.bones}
corrected=0;largest=0;clearances=[]
for o in scene.objects:
 if not o.get('boatman_finish') or o['boatman_finish'] not in ['oilskin','horn']:continue
 if not any(s in o.name for s in ['continuous tailored','bound jacket hem','soft storm fly','fly edge stitching','filled horn button','linen button thread']):continue
 names={g.index:g.name for g in o.vertex_groups}
 for v in o.data.vertices:
  original=engine(v.co)
  if original.y>1.065 or original.z>-.015:continue
  weighted=Matrix(((0,0,0,0),(0,0,0,0),(0,0,0,0),(0,0,0,0)))
  total=sum(g.weight for g in v.groups)
  for g in v.groups:
   transform=deforms[names[g.group]];w=g.weight/total
   for r in range(4):
    for c in range(4):weighted[r][c]+=transform[r][c]*w
  posed=weighted@v.co;p=engine(posed)
  low=smoothstep((1.065-original.y)/.145);front=smoothstep((-original.z-.015)/.11)
  lift=.067*low*front;highest=None
  # Expand the contact field slightly so the fabric eases over the leg edge.
  for dx,dz in [(0,0),(-.012,0),(.012,0),(0,-.012),(0,.012)]:
   hit,normal,face,distance=tree.ray_cast(coord((p.x+dx,p.y+.35,p.z+dz)),coord((0,-1,0)),.7)
   if hit is not None:
    y=engine(hit).y;highest=y if highest is None else max(highest,y)
  if highest is not None:lift=max(lift,highest+.012-p.y)
  if lift>.00001:
   posed+=coord((0,lift,0));v.co=weighted.inverted()@posed;corrected+=1;largest=max(largest,lift)
  if highest is not None:clearances.append(engine(posed).y-highest)
 o.data.update()
manifest['lap_fit']={'vertices_fitted':corrected,'largest_adjustment_m':largest,'minimum_clearance_m':min(clearances) if clearances else None,'pose_frame':24}
print(json.dumps({'seated_jacket_fit':manifest['lap_fit']}))
