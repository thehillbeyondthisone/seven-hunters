import assert from 'node:assert/strict';
import { fixture, E } from './helpers/morning-fixture.mjs';
import { HAULING_SHED as H } from '../src/world/flannan/NextRooms.js';
import { STORM_WORK_MODEL as model } from '../src/world/flannan/StormWorkModel.js';
import { StormWorkProps } from '../src/world/flannan/StormWorkProps.js';

let triangles=0;
for(const [name,finishes] of Object.entries(model.parts))for(const [finish,data] of Object.entries(finishes)){
	assert.ok(model.finishes[finish],`${name}/${finish} retains its authored Blender material metadata`);
	assert.ok(data.p.length&&data.idx.length,`${name} is a real exported fitting`);
	assert.equal(data.n.length,data.p.length);assert.equal(data.uv.length,data.p.length/3*2);
	assert.ok([...data.p,...data.n,...data.uv].every(Number.isFinite));
	assert.ok(data.idx.every(i=>Number.isInteger(i)&&i>=0&&i<data.p.length/3));
	for(let i=0;i<data.n.length;i+=3)assert.ok(Math.abs(Math.hypot(...data.n.slice(i,i+3))-1)<.00001);
	triangles+=data.idx.length/3;
}
for(const contact of Object.values(model.contacts)){
	assert.ok(contact.point.every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...contact.handQuaternion)-1)<1e-6);
}
const spannerGripAxis=new E.Vector3(1,0,0).applyQuaternion(new E.Quaternion().fromArray(model.contacts.spanner.handQuaternion));
assert.ok(spannerGripAxis.distanceTo(new E.Vector3(0,1,0))<1e-6,'the authored grip bar axis follows the vertical spanner handle');
assert.ok(model.poses.stormPinch&&model.poses.stormSpanner,'the repair uses item-specific closed grips rather than the old open palm');
for(const [name,pose] of Object.entries(model.poses))for(const data of Object.values(pose.finishes)){
	assert.ok(data.p.every(Number.isFinite)&&data.n.every(Number.isFinite),`${name} exported finite mesh data`);
	assert.ok(data.idx.every(i=>Number.isInteger(i)&&i>=0&&i<data.p.length/3));
}
assert.ok(model.gripChecks.stormPinch.aperture<.014,'the thumb and index close around the small pin ring');
for(const role of ['pin','spanner'])assert.ok(model.poses[model.contacts[role].pose],`${role} contact selects its MCP-authored grip`);
const f=await fixture(false,{search:'stormPreview',morningStudy:false});
const {app,s,keys,colliders}=f;
app.scene=new E.Group();app.village.materials={hard:{name:'test metal'}};
const work=s.storm.workProps=new StormWorkProps(s);
const brakeCase=colliders.boxes.find(b=>b.tag==='hauling-shed'&&Math.abs(b.center.x-(H.x-.55))<.001&&Math.abs(b.half.x-.65)<.001);
assert.ok(brakeCase,'the existing brakecase supplies the physical mounting surface');
const receiverX=Object.values(model.parts.receiver).flatMap(data=>data.p.filter((_,i)=>i%3===0));
const receiverMin=H.brake.x+model.rig.receiverOffset[0]+Math.min(...receiverX);
assert.ok(receiverMin<brakeCase.center.x+brakeCase.half.x-.005,'the MCP-authored mounting pad overlaps the existing case rather than floating beside it');
assert.equal(work.bench.visible,true);assert.equal(work.oldPin.visible,true);assert.equal(work.newPin.visible,false);
s.flags.laterWatch={tools:true};s.setBeat('lw-repair');
s.interact.current={id:'repairBrake',hold:4};keys.add('KeyE');
for(const progress of [.2,.58,.85]){
	s.interact.held=progress*4;work.update();
	assert.equal(work.bench.visible,false,'taking the tools removes their visible bench copies');
	assert.equal(work.handContacts().length,1);
	const contact=work.handContacts()[0];assert.equal(contact.index,1);assert.ok(contact.position.toArray().every(Number.isFinite));
	if(progress<.34){assert.equal(work.oldPin.visible,true);assert.ok(work.oldPin.position.z>0);assert.equal(contact.pose,'stormPinch');}
	else if(progress<.72){assert.equal(work.oldPin.visible,false);assert.equal(work.newPin.visible,true);assert.ok(work.newPin.position.z>0&&work.newPin.position.z<model.rig.pinTravel);}
	else{assert.equal(work.spanner.visible,true);assert.ok(Math.abs(work.spanner.quaternion.z)>0);assert.equal(contact.pose,'stormSpanner');}
}
keys.delete('KeyE');s.interact.held=0;work.update();
assert.equal(work.oldPin.position.z,0,'releasing unfinished work returns to a recoverable state');
assert.equal(work.oldPin.visible,true);assert.equal(work.handContacts().length,0);
s.flags.laterWatch.repaired=true;s.setBeat('lw-repair-return');work.update();
assert.equal(work.oldPin.visible,false);assert.equal(work.newPin.visible,true);assert.equal(work.newPin.position.z,0);assert.equal(work.spanner.visible,false);
work.update();assert.equal(work.newPin.position.z,0,'repeated state sync cannot withdraw the completed pin');
const can=s.storm.oilCan=new E.Group();can.position.set(10,20,30);app.scene.add(can);
s.setBeat('storm-prepare');s.storm.state.oilTaken=true;s.storm.state.oilStowed=false;work.update();
assert.equal(work.handContacts().length,1,'the existing capped can uses its authored strap-handle contact');
assert.deepEqual(work.handContacts()[0].position.toArray(),model.contacts.oilCan.point.map((v,i)=>v+[10,20,30][i]));
s.storm.state.oilStowed=true;work.update();assert.equal(work.handContacts().length,0);
console.log(`PASS ${triangles} MCP-exported fitting triangles, finite unit normals, actual-case mounting, authored contacts, withdrawal/seat/turn, interrupted-work recovery and persistent completed state.`);
