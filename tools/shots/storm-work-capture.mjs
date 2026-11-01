import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {readTexture} from '../../src/engine/gpu/Readback.js';
import {Vector3} from '../../src/engine/index.js';
import {Story} from '../../src/story/Story.js';
import {Player} from '../../src/player/Player.js';
import {HAULING_SHED as H} from '../../src/world/flannan/NextRooms.js';
import {TOWER} from '../../src/world/flannan/Station.js';
import {writePNG,bgraShot,writeSheet} from './png.mjs';

// Reuse an already warmed native renderer. The caller finishes its own capture
// first. This avoids a second full shader startup and adapter contention.
export async function captureStormWork({app,s,GPU,output}){
	const out=resolve('artifacts/story-review/storm-mechanics/game');mkdirSync(out,{recursive:true});
	GPU.device.pushErrorScope('validation');
	const sources=Object.fromEntries(['src/world/flannan/StormWorkModel.js','src/world/flannan/StormWorkProps.js','src/world/flannan/KeeperCraft.js','src/player/KeeperHands.js','src/App.js'].map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
	app.player.update=Player.prototype.update.bind(app.player);s.update=Story.prototype.update.bind(s);
	s.save=()=>{};s.ui.card=s.ui.fade=s.ui.read=async()=>{};
	s.photography.raised=false;s.photography.capturing=false;s.signal=false;s.tel=0;s.paused=false;s.arrival.group.visible=false;
	s.flags.laterWatch={...s.flags.laterWatch,tools:true,repaired:false};s.setBeat('lw-repair');s.h=609.5;s._applyClock();
	s.hand.carried=s.hand.lit=true;s.hand.glow=1;s.lamp.extinguish();s.lamp.stop();
	app.freeCam=false;app.input.enabled=true;let held=false;
	app.input.down=code=>held&&code==='KeyE';app.input.hit=()=>false;app.input.consumeLook=()=>({x:0,y:0});
	// The same close working square reached by the walking regression, outside
	// the existing brakecase collider, keeps the actual hand contact within reach.
	const player=app.player;player.busy=false;player.mode='walk';player.grounded=true;player.position.set(H.x,H.floor,H.z+.1);player.velocity.set(0,0,0);player._camY=null;
	const eye=player.position.clone().add(new Vector3(0,1.62,0)),target=s.storm.workProps.receiverRoot.position.clone();
	const dir=target.clone().sub(eye).normalize();player.yaw=Math.atan2(-dir.x,-dir.z);player.pitch=Math.asin(dir.y);player.update(0);
	app.camera.fov=s.baseFov;app.camera.updateProjectionMatrix();app.cameraCut();app.post.autoExposure.snap.value=1;
	const images=[],captures=[];
	const frame=async()=>{app.frame(1/30);await GPU.queue.onSubmittedWorkDone();};
	const shot=async name=>{
		const raw=await readTexture(output),bytes=new Uint8Array(8+raw.data.byteLength);new Uint32Array(bytes.buffer,0,2).set([raw.width,raw.height]);bytes.set(new Uint8Array(raw.data),8);
		const image=bgraShot(Buffer.from(bytes));writePNG(resolve(out,name+'.png'),raw.width,raw.height,image.rgba);images.push(image);
		captures.push({name,beat:s.beat,held:s.interact.held,progress:s.storm.workProps.progress,hands:app.keeperHands.mode,contacts:s.storm.workProps.handContacts().map(c=>({index:c.index,position:c.position.toArray(),pose:c.pose})),newPin:s.storm.workProps.newPin.position.toArray(),repaired:!!s.later.state.repaired,feet:player.position.toArray()});
		console.log('saved storm work',name,app.keeperHands.mode);
	};
	for(let i=0;i<20;i++)await frame();
	assert.equal(s.interact.pick()?.id,'repairBrake','the real repair prompt is reachable from the working position');
	await shot('01-before');held=true;
	let at=0;
	for(const [seconds,name]of [[.8,'02-withdraw'],[2.4,'03-seat'],[3.5,'04-tighten'],[4.3,'05-complete']]){
		while(at<seconds-1e-6){await frame();at+=1/30;}
		await shot(name);
	}
	held=false;await frame();
	assert.equal(s.later.state.repaired,true);assert.equal(s.beat,'lw-repair-return');assert.equal(app.input.enabled,true);assert.equal(player.busy,false);
	assert.ok(captures.filter(c=>['02-withdraw','03-seat','04-tighten'].includes(c.name)).every(c=>c.hands==='storm-work'),'working hands follow the authored fitting contacts');
	// The same authored closed bar grip also serves the existing horizontal
	// strap handle. This checks the later oil carry without changing the can.
	s.setBeat('storm-prepare');s.flags.storm={...s.flags.storm,elapsed:0,looked:0,oilTaken:true,oilStowed:false};
	player.pitch=-.7;player.update(0);app.cameraCut();
	for(let i=0;i<20;i++)await frame();
	await shot('06-capped-oil-carry');assert.equal(app.keeperHands.mode,'storm-work');
	writeSheet(resolve(out,'temporal-review.png'),images,3);
	await GPU.pipelinesReady();await GPU.queue.onSubmittedWorkDone();const validation=await GPU.device.popErrorScope();assert.equal(validation,null,validation?.message);
	writeFileSync(resolve(out,'verification.json'),JSON.stringify({createdAt:new Date().toISOString(),runtime:'Actual game renderer and real four-second held repair from a prepared upper-shed checkpoint; no asset or pose edits in capture',sources,captures,validationErrors:[],notes:'Receiver, pin, spanner, working axes and contact points were authored exclusively through live Blender MCP. Existing brakecase, drum and chain are retained. This is an authored reconstruction, not recovered Flannan equipment.'},null,2));
	console.log('PASS native storm fitting withdrawal, seating, tightening, MCP hand contacts, completed state and GPU validation.');
}

// A narrow final carry view can share a warmed renderer without repeating the
// already accepted repair sequence. No game asset, hand pose or duty is edited.
export async function captureStormOil({app,s,GPU,output}){
	const out=resolve('artifacts/story-review/storm-mechanics/oil');mkdirSync(out,{recursive:true});
	GPU.device.pushErrorScope('validation');
	const sources=Object.fromEntries(['src/world/flannan/StormWorkModel.js','src/world/flannan/StormWorkProps.js','src/world/flannan/KeeperCraft.js','src/player/KeeperHands.js','src/App.js','tools/shots/storm-work-capture.mjs'].map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
	s.storm.cutscene.close();s.firstWatch?.closeReveal();s.next?.smoke?.close?.();
	app.player.update=Player.prototype.update.bind(app.player);s.update=Story.prototype.update.bind(s);
	s.save=()=>{};s.ui.card=s.ui.fade=s.ui.read=async()=>{};
	s.photography.restore();s.photography.raised=false;s.signal=false;s.tel=0;s.paused=false;s.arrival.group.visible=false;
	s.flags.storm={...s.flags.storm,elapsed:0,looked:0,oilTaken:true,oilStowed:false,secured:false};s.setBeat('storm-prepare');s.h=615.5;s._applyClock();
	s.hand.carried=s.hand.lit=true;s.hand.glow=1;s.app.seaWeather?.select('fresh');
	app.freeCam=false;app.input.enabled=true;app.input.rightDown=false;app.input.down=()=>false;app.input.hit=()=>false;app.input.consumeLook=()=>({x:0,y:0});
	const player=app.player;player.busy=false;player.mode='walk';player.grounded=true;player.position.set(-1,TOWER.floor,4);player.velocity.set(0,0,0);player._camY=null;player.yaw=0;player.pitch=-.7;player.update(0);
	app.camera.fov=s.baseFov;app.camera.updateProjectionMatrix();app.cameraCut();app.post.autoExposure.snap.value=1;
	for(let i=0;i<40;i++){app.frame(1/60);await GPU.queue.onSubmittedWorkDone();}
	assert.equal(app.keeperHands.mode,'storm-work');
	const contact=s.storm.workProps.handContacts()[0];assert.equal(contact.pose,'stormSpanner');
	const ndc=contact.position.clone().applyMatrix4(app.camera.matrixWorldInverse).applyMatrix4(app.camera.projectionMatrix);
	assert.ok(Math.abs(ndc.x)<.9&&Math.abs(ndc.y)<.9&&ndc.z>-1&&ndc.z<1,'the actual can-handle grip must be visibly inside the final view');
	const raw=await readTexture(output),bytes=new Uint8Array(8+raw.data.byteLength);new Uint32Array(bytes.buffer,0,2).set([raw.width,raw.height]);bytes.set(new Uint8Array(raw.data),8);
	const image=bgraShot(Buffer.from(bytes));writePNG(resolve(out,'capped-oil-downward.png'),raw.width,raw.height,image.rgba);
	await GPU.pipelinesReady();await GPU.queue.onSubmittedWorkDone();const validation=await GPU.device.popErrorScope();assert.equal(validation,null,validation?.message);
	writeFileSync(resolve(out,'verification.json'),JSON.stringify({createdAt:new Date().toISOString(),runtime:'Actual game renderer, natural downward glance at the existing capped oil carry; no asset or pose edits in capture',sources,frames:40,beat:s.beat,position:player.position.toArray(),camera:app.camera.position.toArray(),pitch:player.pitch,oilCan:s.storm.oilCan.position.toArray(),hand:contact.pose,contact:contact.position.toArray(),projectedGrip:ndc.toArray(),validationErrors:[],notes:'The horizontal strap handle uses the MCP-authored closed bar grip. This isolated carry view supplements the separately accepted real held-repair sequence.'},null,2));
	console.log('PASS visible capped-oil carry with authored grip, projection bounds and native GPU validation.');
}
