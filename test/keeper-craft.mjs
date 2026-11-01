import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { KEEPER_CRAFT_MODEL as model } from '../src/world/flannan/KeeperCraftModel.js';
import { keeperCraft, handMesh } from '../src/world/flannan/KeeperCraft.js';
import { Boatman, armPoints } from '../src/world/boat/Boatman.js';
import { KeeperHands } from '../src/player/KeeperHands.js';
import { Builder } from '../src/world/village/GeoBuilder.js';
import { Group, PerspectiveCamera, Vector3 } from '../src/engine/index.js';
import { HandLamp } from '../src/station/HandLamp.js';
import { packModel } from '../tools/build/packed-models.mjs';
import { decodePackedModel } from '../src/world/flannan/PackedModels.js';

let near=0,far=0;
for(const [name,lods] of Object.entries(model.models)) {
 const count={};
 for(const [lod,finishes] of Object.entries(lods)) {
  count[lod]=0;
  for(const g of Object.values(finishes)) {
   assert.equal(g.n.length,g.p.length);assert.equal(g.uv.length,g.p.length/3*2);
   assert.ok([...g.p,...g.n,...g.uv].every(Number.isFinite),name);
   assert.ok(g.idx.every(i=>Number.isInteger(i)&&i>=0&&i<g.p.length/3));
   for(let i=0;i<g.n.length;i+=3)assert.ok(Math.abs(Math.hypot(...g.n.slice(i,i+3))-1)<.002,name+' normals');
   count[lod]+=g.idx.length/3;
  }
  const B=new Builder();keeperCraft(B,name,0,0,0,{lod});
  assert.ok(Object.values(B.batches).every(b=>b.build().attributes.position.count>0));
 }
 assert.ok(count.far<=count.near,name+' distance reduction');near+=count.near;far+=count.far;
}
assert.ok(near<65000&&far<26000);assert.equal(model.detail.rgba.length,128*128*4);
assert.ok(model.detail.rgba.every(x=>x>=0&&x<=255));
const packed=packModel(model),buffer=packed.buffer.slice(packed.byteOffset,packed.byteOffset+packed.byteLength),decoded=decodePackedModel(buffer);
assert.deepEqual(decoded.models.brownie.near.black.p,new Float32Array(model.models.brownie.near.black.p));
assert.deepEqual(decoded.detail.rgba,new Float32Array(model.detail.rgba));

// Reach solver preserves bone lengths and handles singular/extreme input.
for(const side of [-1,1])for(const target of [new Vector3(.3,1.2,-.65),new Vector3(0,1.34,-.42),new Vector3(100,100,100)]) {
 const shoulder=new Vector3(0,1.34,-.42),p=armPoints(shoulder,target,side);
 assert.ok(p.elbow.toArray().every(Number.isFinite));
 assert.ok(Math.abs(shoulder.distanceTo(p.elbow)-.34)<1e-6);
 assert.ok(Math.abs(p.elbow.distanceTo(p.wrist)-.32)<1e-6);
}
const parent=new Group(),rower=new Boatman(parent),camera=new PerspectiveCamera();
const oars=[-1,1].map(side=>{const g=new Group();g.position.set(side*1.16,1.25,-.65);parent.add(g);return g;});
for(let frame=0;frame<120;frame++) {
 const phase=frame/120*Math.PI*2;
 for(let i=0;i<2;i++){oars[i].rotation.y=(i?1:-1)*Math.sin(phase)*.32;oars[i].rotation.z=(i?-1:1)*(.12+.12*Math.sin(phase));}
 rower.update(oars,.04*Math.sin(phase));assert.ok(rower.gripError<.001,'oar grip remains reachable through the stroke');
}
camera.position.set(0,0,50);rower.update(oars,0,camera);assert.equal(rower.far,true);
camera.position.set(0,0,2);rower.update(oars,0,camera);assert.equal(rower.far,false);

const app={scene:new Group(),camera:new PerspectiveCamera(),input:{down:()=>false},handLamp:new HandLamp()};
app.camera.position.set(0,1.7,0);app.handLamp.carried=true;app.handLamp.update(1/60,app.camera);app.scene.add(app.handLamp.group);
const hands=new KeeperHands(app);hands.update(1/60);assert.equal(hands.mode,'lantern');
for(const hide of [{freeCam:true},{isVRPreview:true},{story:{ui:{open:true}}},{story:{ui:{open:false},photography:{capturing:true}}}]) {
 Object.assign(app,hide);hands.update(1/60);assert.equal(hands.mode,'hidden');app.freeCam=false;app.isVRPreview=false;app.story=null;
}
app.story={ui:{open:false},beat:'lw-photos',photography:{equipped:true,state:{taken:true},capturing:false},interact:{current:{id:'filmWind'}}};
app.input.down=()=>true;hands.update(.2);assert.equal(hands.mode,'camera');assert.ok(hands.key.rotation.x>0);
app.story.photography.capturing=true;hands.update(.1);assert.equal(hands.mode,'hidden','negative excludes held equipment');
for(const pose of ['grip','pinch','open'])for(const left of [false,true]) {
 const hand=handMesh(pose,'near',left);assert.ok(hand.geometry.attributes.position.count<6000,'one bounded merged hand draw');
}
console.log(`PASS ${Object.keys(model.models).length} Blender prototypes, ${near}/${far} near/far triangles; ${gzipSync(packed).length} compressed bytes; packed export, finite normals, complete rowing stroke, LOD, hand poses, reading/XR/photo suppression.`);
