import assert from 'node:assert/strict';
import { KEEPER_HAND_POSES as authored } from '../src/world/flannan/KeeperHandPosesModel.js';
import { KeeperHands } from '../src/player/KeeperHands.js';
import { Group, PerspectiveCamera, Quaternion, Vector3 } from '../src/engine/index.js';
import { HandLamp } from '../src/station/HandLamp.js';
import { TOWER } from '../src/world/flannan/Station.js';

assert.deepEqual(Object.keys(authored.poses).sort(),['cameraLeft','cameraLeftShutter','cameraRight','cameraRightWind','crankGrip','lanternBail']);
for(const [name,pose] of Object.entries(authored.poses)) {
 let triangles=0;
 for(const part of Object.values(pose.finishes)) {
  assert.equal(part.p.length,part.n.length);assert.equal(part.uv.length,part.p.length/3*2);
  assert.ok([...part.p,...part.n,...part.uv].every(Number.isFinite),`${name} has finite exported geometry`);
  assert.ok(part.idx.every(index=>Number.isInteger(index)&&index>=0&&index<part.p.length/3));
  for(let i=0;i<part.n.length;i+=3)assert.ok(Math.abs(Math.hypot(...part.n.slice(i,i+3))-1)<.002,`${name} has unit split normals`);
  triangles+=part.idx.length/3;
 }
 assert.ok(triangles>3000&&triangles<4000,`${name} retains bounded finger detail`);
 assert.equal(pose.wrist.length,3);
}
const camera=new PerspectiveCamera(65,16/9,.1,150000);camera.position.set(-4.1,TOWER.floor+1.62,2.65);camera.lookAt(new Vector3(-6.5,TOWER.floor+.65,-.2));camera.updateMatrixWorld(true);
const app={scene:new Group(),camera,input:{down:()=>false},handLamp:new HandLamp()};
app.scene.add(app.handLamp.group);
app.story={ui:{open:false},photography:{equipped:true,tutorialPending:true,tutorial:{braced:false},atChairTable:true},interact:{current:null}};
const hands=new KeeperHands(app);hands.update(.3);
assert.equal(hands.mode,'camera');
assert.equal(hands.hands[0].pose,'cameraLeft');assert.equal(hands.hands[1].pose,'cameraRight');
const free=hands.photographyView;
assert.ok(free.position.distanceTo(camera.position)>.3,'the photograph uses the held lens rather than the eye');
const geoms=hands.hands.map(hand=>hand.mesh.geometry);
for(let i=0;i<30;i++)hands.update(1/60);
assert.ok(hands.hands.every((hand,i)=>hand.mesh.geometry===geoms[i]),'holding equipment reuses bounded merged hand geometry');

const heldPosition=hands.cameraRoot.position.clone();
app.story.photography.tutorial.braced=true;hands.update(1/60);
const table=authored.attachments.braced.tablePosition;
const tablePoint=new Vector3(table[0],TOWER.floor+table[1],table[2]);
assert.ok(hands.cameraRoot.position.distanceTo(heldPosition)>0&&hands.cameraRoot.position.distanceTo(tablePoint)>0.1,'table placement starts between the authored held and supported poses');
hands.update(.3);
assert.ok(hands.cameraRoot.position.distanceTo(new Vector3(table[0],TOWER.floor+table[1],table[2]))<1e-6,'the supported Brownie sits on the authored table edge');
const physical=hands.photographyView,chair=new Vector3(-6.5,TOWER.floor+.65,-.2);
const aim=new Vector3(0,0,-1).applyQuaternion(physical.quaternion);
assert.ok(aim.dot(chair.sub(physical.position).normalize())>.999,'the physical supported lens points at Mary’s chair');
assert.ok(physical.position.y<TOWER.floor+.9,'the supported exposure viewpoint stays at the table, below the player’s eye');
camera.lookAt(hands.cameraRoot.position);camera.updateMatrixWorld(true);hands.update(1/60);
const toEye=camera.matrixWorld.clone().invert();
for(const hand of hands.hands){hand.sleeve.updateWorldMatrix(true,false);const cap=hand.sleeve.localToWorld(new Vector3(0,authored.attachments.forearm.length,0)).applyMatrix4(toEye);assert.ok(cap.z>0,'looking down at the supported camera keeps each upper sleeve end behind the eye');}

app.input.down=()=>true;app.story.interact.current={id:'photo-chair'};hands.update(.1);
assert.equal(hands.hands[0].pose,'cameraLeftShutter');
assert.equal(hands.shutter.position.y,authored.attachments.camera.shutter[1]-authored.attachments.camera.shutterTravel);
app.story.interact.current={id:'filmWind'};hands.update(.2);
assert.equal(hands.hands[1].pose,'cameraRightWind');
assert.ok(Math.abs(hands.key.rotation.x)<=authored.attachments.camera.windAngle,'winding stays within the authored wrist range');
assert.ok(hands.photographyView.position.toArray().every(Number.isFinite));

app.story.photography.equipped=false;app.input.down=()=>false;
const contact={index:0,position:new Vector3(1,2,3),quaternion:new Quaternion(),pose:'grip'};
app.story.next={domestic:{handContacts:()=>[contact]}};hands.update(.1);
assert.equal(hands.mode,'domestic','carried domestic objects keep their hand contact after E is released');
app.story.next=null;app.handLamp.carried=true;app.handLamp.update(.1,camera);hands.update(.3);
assert.equal(hands.mode,'lantern');assert.equal(hands.hands[1].pose,'lanternBail');
const wrist=app.handLamp.group.localToWorld(new Vector3().fromArray(authored.poses.lanternBail.wrist));
assert.ok(hands.hands[1].sleeve.position.distanceTo(wrist)<1e-6,'the sleeve meets the authored lantern wrist throughout item placement');
assert.equal(hands.photographyView,null);

// A free-spinning wooden grip lets the hand orbit with the crank arm without
// making the player's wrist rotate through 360 degrees.
const base=new Group(),crank=new Group();base.position.set(1,TOWER.deck+1,2);base.rotation.y=.6;base.add(crank);app.scene.add(base);
app.story={ui:{open:false},interact:{current:{id:'crank'}},lamp:{wind:.3},moving:{crank}};app.input.down=()=>true;app.handLamp.carried=false;
let orientation;
for(let phase=0;phase<=24;phase++){
 crank.rotation.z=phase/24*Math.PI*2;base.updateMatrixWorld(true);hands.update(1/60);
 assert.equal(hands.mode,'winding');assert.equal(hands.hands[1].pose,'crankGrip');
 const centre=crank.localToWorld(new Vector3().fromArray(authored.attachments.crank.point));
 assert.ok(hands.crankContact.position.distanceTo(centre)<1e-6,'the closed grip follows the complete handle orbit');
 const now=hands.hands[1].group.quaternion.toArray();if(!orientation)orientation=now;assert.ok(now.every((value,index)=>Math.abs(value-orientation[index])<1e-6),'the grip frame does not force a full wrist roll');
}

for(const block of [{cinematic:true},{ui:{open:true}},{photography:{capturing:true}},{towerTravel:{active:true}}]) {
 app.story={ui:{open:false},...block};hands.update(.1);assert.equal(hands.mode,'hidden');
}
console.log('Keeper hand contacts: six finite Blender poses, physical table/lens alignment, shutter/film winding, full crank orbit without wrist roll, carried contacts and cinematic/photo suppression passed.');
