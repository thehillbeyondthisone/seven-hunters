import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PerspectiveCamera, Vector3 } from '../../src/engine/index.js';
import { HandLamp } from '../../src/station/HandLamp.js';
import { HAND_LAMP_MODEL } from '../../src/station/HandLampModel.js';

const base=pathToFileURL(resolve('src/station/HandLamp.js'));
const original=readFileSync('artifacts/hero-lantern/original/HandLamp.js','utf8').replace(/from\s+(['"])(\.[^'"]+)\1/g,(all,q,path)=>`from ${q}${new URL(path,base).href}${q}`);
const {HandLamp:Before}=await import('data:text/javascript;base64,'+Buffer.from(original).toString('base64'));
const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
let triangles=0;
for(const [finish,g] of Object.entries(HAND_LAMP_MODEL)) {
 const count=g.p.length/3;
 assert.equal(g.n.length,g.p.length);assert.equal(g.uv.length,count*2);
 assert.ok(g.p.every(Number.isFinite)&&g.n.every(Number.isFinite)&&g.uv.every(Number.isFinite),finish+' attributes');
 assert.ok(g.idx.every(i=>Number.isInteger(i)&&i>=0&&i<count),finish+' indices');
 for(let i=0;i<count;i++) {
  assert.ok(Math.abs(Math.hypot(...g.n.slice(i*3,i*3+3))-1)<.001,finish+' normals');
  for(let a=0;a<3;a++){bounds.min[a]=Math.min(bounds.min[a],g.p[i*3+a]);bounds.max[a]=Math.max(bounds.max[a],g.p[i*3+a]);}
 }
 for(let i=0;i<g.idx.length;i+=3) {
  const p=g.idx.slice(i,i+3).map(j=>g.p.slice(j*3,j*3+3));
  const a=p[1].map((v,k)=>v-p[0][k]),b=p[2].map((v,k)=>v-p[0][k]);
  assert.ok(Math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])>1e-12,finish+' triangle area');
 }
 triangles+=g.idx.length/3;
}
assert.ok(bounds.min[1]>=-.0001&&bounds.max[1]<=.321,'foot and carrying grip envelope');
assert.ok(bounds.max[0]-bounds.min[0]<.20&&bounds.max[2]-bounds.min[2]<.18,'table footprint');
const before=new Before(),after=new HandLamp(),camera=new PerspectiveCamera(60,1,.1,100);
before._t=after._t=0;
for(const lamp of [before,after])lamp.setRest(new Vector3(-4.95,81.79,3.12),.4);
const compare=()=>{
 assert.ok(before.group.position.distanceTo(after.group.position)<1e-10,'position');
 assert.ok(before.lightPosition.distanceTo(after.lightPosition)<1e-10,'flame position');
 assert.deepEqual(before.group.quaternion.toArray(),after.group.quaternion.toArray(),'carrying swing');
 assert.equal(before.glow,after.glow,'warm-up and extinction');
 assert.equal(before.flicker,after.flicker,'flicker');
 assert.deepEqual(before.save(),after.save(),'saved inventory');
};
for(const carried of [false,true,false])for(const lit of [false,true,false]) {
 before.carried=after.carried=carried;before.lit=after.lit=lit;
 for(let i=0;i<50;i++) {
  camera.position.set(i*.005,82.7,Math.sin(i*.05)*.1);camera.rotation.y=i*.003;
  before.update(1/60,camera);after.update(1/60,camera);compare();
 }
}
assert.equal(after._glass.transparent,true);assert.equal(after._glass.depthWrite,false);
after.load({carried:true,lit:false});after.update(1/60,camera);assert.equal(after._flameMesh.visible,false,'unlit flame hidden');
const count=s=>s.group.children.reduce((n,m)=>n+(m.geometry.index?.count||0)/3,0);
const report={triangles,previousTriangles:count(before),meshDraws:after.group.children.length,previousMeshDraws:before.group.children.length,bounds,handlingLightAndSaveUnchanged:true,clearGlobe:true};
writeFileSync('artifacts/hero-lantern/geometry-audit.json',JSON.stringify(report,null,2));
console.log('PASS export health, grip/foot envelope, exact resting/carried motion, flame position, flicker, lighting transitions and save/load.');
console.log(JSON.stringify(report));
