import assert from 'node:assert/strict';
import { fixture } from './helpers/morning-fixture.mjs';
import { CoastalState } from '../src/ocean/CoastalState.js';
import { KeeperSafety } from '../src/player/KeeperSafety.js';

const f=await fixture(false,{search:'returningLightPreview',morningStudy:false});
const {app,s,player,face,place}=f;
app.coastal=new CoastalState(app.terrainData);
app.keeperSafety=new KeeperSafety(app,s);
s.saveKey='sevenhunters.test-storm-readability.v1';
s.ui.end=()=>{};
const results=[];
for(const fps of [30,120])for(const phase of [0,7,14,28,53.66,69]){
	await s.storm.begin();
	s.setBeat('storm-look');
	app.coastal.load({time:phase,strength:1.5});
	place(...s.storm.lookout.toArray());face(s.storm.serviceLight);
	const step=()=>{app.keeperSafety.beforeFrame(1/fps);player.update(1/fps);s.update(1/fps);app.keeperSafety.afterFrame();};
	for(let i=0;i<fps*4.2&&s.beat==='storm-look';i++)step();
	assert.equal(s.beat,'storm-wave','looking at the service lantern starts the real storm sequence');
	const start=app.coastal.time;
	assert.ok(s.storm.state.crestAt-start>=7.99,'the crest gives time to read the intact landing');
	// Pausing during the buildup holds both the shared wave and its destruction.
	s.paused=true;for(let i=0;i<fps;i++)step();s.paused=false;
	assert.equal(app.coastal.time,start);assert.equal(s.storm.damage.destroyed,false);
	let impact=null;
	for(let i=0;i<fps*35&&s.beat==='storm-wave';i++){
		step();
		if(s.storm.state.routeDestroyed&&impact===null){
			impact=app.coastal.time;
			const wash=app.coastal.sample(s.storm.serviceLight,{ground:s.storm.platformY});
			assert.ok(wash.washDepth>3,'the visible shared water reaches the platform before it breaks');
		}
	}
	assert.equal(s.beat,'storm-return','the set drains and reveals the broken landing');
	assert.ok(impact-start>7,'destruction cannot hide the intact landing immediately after observation');
	assert.ok(app.coastal.time-impact>8,'the impact has a readable drainage and aftermath');
	assert.equal(app.coastal.rogue,0,'the single larger set ends before the return');
	assert.equal(player.mode,'walk');assert.ok(player.position.y>32,'the real upper lookout remains safe');
	results.push({fps,phase,impactAfter:+(impact-start).toFixed(2),returnAfter:+(app.coastal.time-start).toFixed(2)});
}
s.storm.damage.set(false);
console.log('PASS real observation, intact buildup, water-driven damage, drainage, pause and safe lookout at 30/120 FPS across six coastal phases.');
console.log(JSON.stringify(results));
