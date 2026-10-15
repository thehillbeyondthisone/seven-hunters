import assert from 'node:assert/strict';
import { fixture, E, TOWER } from './helpers/morning-fixture.mjs';
import { CoastalState } from '../src/ocean/CoastalState.js';
import { WaterQuery } from '../src/ocean/WaterQuery.js';
import { KeeperSafety, STRUGGLE_SECONDS } from '../src/player/KeeperSafety.js';
import { ISLET_LIGHT, returningScript } from '../src/story/ReturningLight.js';
import { mobileAction } from '../src/mobile/MobileOptions.js';

const f=await fixture(false,{search:'returningLightPreview',morningStudy:false}),{app,s,terrain,player,keys,colliders,camera}=f;
app.qs.delete('morningPreview');s.saveKey='sevenhunters.test-coast.v1';app.coastal=new CoastalState(terrain);app.keeperSafety=new KeeperSafety(app,s);
s.ui.choose=async q=>q.options[0].value;s.ui.end=()=>{};s.ui.journal=async()=>({light:true});
const safety=app.keeperSafety,west=terrain.landing('west');
for(const fps of [30,60,120]){
	const c=new CoastalState(terrain);for(let n=0;n<fps*28;n++)c.update(1/fps,{strength:1});
	assert.ok(Math.abs(c.time-28)<1e-8);const t=c.time;c.update(.1,{paused:true,strength:2});assert.equal(c.time,t);assert.equal(c.strength,1);
}
let peak=0,incoming=false,drain=false;for(let t=0;t<70;t+=.05){const q=app.coastal.sample(west.stage,{time:t,strength:1.5});peak=Math.max(peak,q.height);incoming||=q.flowX*west.dir[0]+q.flowZ*west.dir[1]<-1;drain||=q.flowX*west.dir[0]+q.flowZ*west.dir[1]>1;}
assert.ok(peak>west.stage.y+.8&&incoming&&drain,'a large set overtops the stage, runs inland and drains seaward');
assert.equal(app.coastal.sample({x:0,y:TOWER.floor,z:0},{time:60,strength:2.2}).washDepth,0,'station remains dry');
const stale={time:54.66,strength:1.5},readback={surface:{coastal:app.coastal},resultCoast:stale,resultInputs:[west.stage.x,west.stage.z]};
const raw=.3+app.coastal.sample(west.stage,stale).height;
assert.ok(Math.abs(WaterQuery.prototype.currentHeight.call(readback,0,west.stage,raw)-(.3+app.coastal.sample(west.stage).height))<1e-8,'camera and walker remove stale local surge before sampling the current phase');

await s.returningLight.begin(true);player.position.set(-1,TOWER.floor,4);player.grounded=true;player.waterH=0;safety.reset();player.update(0);s.save();
assert.ok(s.safeCheckpoint&&s.safeCheckpoint.beat==='rl-light');const checkpoint=JSON.stringify(s.safeCheckpoint),saved=localStorage.getItem(s.saveKey);
player.mode='swim';player.position.set(west.stage.x+west.dir[0]*30,-.1,west.stage.z+west.dir[1]*30);player.waterH=0;safety.immerse();
assert.equal(safety.remaining,STRUGGLE_SECONDS);assert.equal(s.hand.lit,false);s.save();assert.equal(localStorage.getItem(s.saveKey),saved,'unsafe position never replaces a safe watch');
s.paused=true;safety.beforeFrame(.1);assert.equal(safety.remaining,12);s.paused=false;
for(const hold of [()=>{s.ui.modal++;return()=>s.ui.modal--;},()=>{app.ui.ui.photoMode=true;return()=>app.ui.ui.photoMode=false;},()=>{document.hidden=true;return()=>document.hidden=false;}]){
	const release=hold(),time=app.coastal.time;safety.beforeFrame(.1);assert.equal(app.coastal.time,time);assert.equal(safety.remaining,12);release();
}
for(let i=0;i<60;i++)safety.updateSwim(1/60);assert.ok(Math.abs(safety.remaining-11)<1e-8,'surfacing never refills the struggle budget');
s.retryFromSafety();assert.equal(s.beat,'rl-light');assert.equal(safety.state,'normal');assert.equal(JSON.stringify(s.safeCheckpoint),checkpoint);assert.ok(player.position.y>70);

const a=safety.anchors.find(a=>a.name==='east'),east=terrain.landing('east');
player.mode='swim';player.position.copy(a.at).add(new E.Vector3(east.dir[0]*1.05,0,east.dir[1]*1.05));player.position.y=1.08;player.waterH=1.2;safety.immerse();keys.add('KeyE');
for(let i=0;i<80&&player.mode==='swim';i++)safety.updateSwim(1/60);
keys.clear();assert.equal(player.mode,'walk','reachable rungs allow a short recovery hold');assert.ok(player.position.distanceTo(a.to)<.01);
const oldCoast=app.coastal.save(),westAnchor=safety.anchors.find(a=>a.name==='west');app.coastal.load({time:54.66,strength:1.5});assert.ok(app.coastal.sample(westAnchor.to).washDepth>.25);assert.equal(safety.recover(westAnchor.to),false,'a ledge still covered by heavy wash is not secure footing');app.coastal.load(oldCoast);
player.prompt={text:'Climb the landing rungs',hold:true,safetyTarget:'eastRungs',progress:.5};assert.equal(mobileAction(app).target,'eastRungs');

player.mode='swim';player.position.copy(a.at).add(new E.Vector3(east.dir[0],0,east.dir[1]));player.position.y=.9;
const middle=player.position.clone().add(new E.Vector3(0,.35,0)).lerp(a.at,.5);const box=colliders.addBox(middle,new E.Vector3(.3,.3,.3));assert.equal(safety.reachable(a.at),false,'a wall blocks a handhold');colliders.boxes.splice(colliders.boxes.indexOf(box),1);
safety.reset();s.retryFromSafety();

const chapter=s.returningLight;
await chapter.begin(true);chapter.useLens();s._wind(5);assert.equal(s.beat,'rl-look');
player.position.set(.5,TOWER.deck,3.2);player.mode='walk';player.grounded=true;player.update(0);camera.lookAt(chapter.light);camera.updateMatrixWorld();
assert.equal(chapter.looking(chapter.light),true,'the authored balcony has a clear sightline to the original islet bearing');
await chapter.finishSighting(true);assert.equal(s.beat,'rl-signal');assert.ok(!s.watcher.script.nodes.hello.options[0].text.includes('RETURNED'),'a missed first-night sighting is not invented');
s.flags.isletSeen=21.1;assert.ok(returningScript(true,chapter.state).nodes.hello.options[0].text.includes('RETURNED'));
const received=s.watcher.save();s.save();const snap=s._snapshot();s._restore(snap);assert.equal(s.watcher.save().state,received.state,'later signalling state survives loading');
s.setBeat('rl-rest');await chapter.daylight();assert.equal(s.beat,'rl-view');
player.position.copy(chapter.viewpoint);player.mode='walk';player.grounded=true;player.update(0);camera.lookAt(chapter.light);camera.updateMatrixWorld();
console.log('Investigation viewpoint',chapter.viewpoint.toArray(),'clear',chapter.looking(chapter.light));
assert.ok(chapter.looking(chapter.light),'the daytime viewpoint must see the ridge');
camera.lookAt(chapter.channel);camera.updateMatrixWorld();assert.ok(chapter.looking(chapter.channel),'the same safe viewpoint must see the actual channel');
chapter.observe();chapter.observe();assert.equal(s.beat,'rl-return');assert.ok(chapter.state.ridge&&chapter.state.channel);s.setBeat('rl-journal');await chapter.journal();assert.equal(s.beat,'rl-complete');assert.ok(s.rows.some(r=>r[1].includes('source not established')));

const completed=s._snapshot();
delete s.flags.isletSeen;await chapter.begin(true);s.setBeat('rl-look');await chapter.finishSighting(false);assert.equal(s.beat,'rl-rest');
s.ui.choose=async()=> 'stay';await chapter.daylight();assert.equal(s.beat,'rl-return');assert.equal(chapter.state.investigate,false);assert.ok(!chapter.state.seen&&!chapter.state.ridge&&!chapter.state.channel,'declining invents no observations');
let offered;s.ui.journal=async page=>{offered=page.remarks;return{light:true};};s.setBeat('rl-journal');const beforeDecline=s.rows.length;await chapter.journal();assert.deepEqual(offered,[]);assert.equal(s.rows.length,beforeDecline,'a missed sighting cannot create a journal claim');
await chapter.begin(true);s.setBeat('rl-view');player.position.copy(chapter.viewpoint);player.update(0);chapter.observe();chapter.observe();s.setBeat('rl-journal');await chapter.journal();assert.equal(offered.length,1,'daytime evidence can be recorded even when both night sightings were missed');assert.ok(!s.rows.at(-3)?.[1].includes('Small light observed'),'the daylight entry does not fabricate a night light');
assert.ok(s.rows.at(-2)[1].includes(`bearing ${chapter.state.ridge.bearing}°`));assert.ok(s.rows.at(-1)[1].includes('No vessel visible'));
s._restore(completed);s.ui.choose=async q=>q.options[0].value;

const canonical=JSON.parse(JSON.stringify(s._snapshot()));s.safeCheckpoint=JSON.parse(JSON.stringify(canonical));
let deaths=0;s.ui.choose=async q=>{assert.equal(q.options[0].label,'Retry from safety');assert.equal(q.cancel,null);deaths++;return'retry';};
for(const fps of [30,60,120]){
	s._restore(canonical);s.paused=false;player.position.set(700,-.1,700);player.mode='swim';player.waterH=0;safety.immerse();
	let spent=0;while(safety.state!=='dead'&&spent<13){safety.updateSwim(1/fps);spent+=1/fps;}
	assert.equal(safety.state,'dead');assert.ok(Math.abs(spent-12)<=1/fps+.001,'failure timing agrees across frame rates');
	await new Promise(resolve=>setImmediate(resolve));assert.equal(safety.state,'normal');assert.equal(s.h,canonical.h);assert.equal(s.rows.length,canonical.rows.length);assert.equal(s.lamp.wind,canonical.lamp.wind);
}
assert.equal(deaths,3,'repeated failures each offer one retry');
const legacy={...canonical,pos:[700,-1,700]};delete legacy.safeCheckpoint;s._restore(legacy);assert.ok(player.position.y>70,'an old free-swimming save resumes at shelter instead of creating a death loop');assert.equal(s.h,canonical.h);assert.deepEqual(s.flags,canonical.flags);
const rail=safety.rails.find(r=>r.name==='west'&&r.id.endsWith('5'));
const previousWeather=app.seaWeather;app.seaWeather={active:true,state:{surf:1.5}};
player.position.copy(rail.at).add(new E.Vector3(west.dir[1]*.45,-.8,-west.dir[0]*.45));player.mode='walk';player.grounded=true;app.coastal.load({time:54.66,strength:1.5});
assert.ok(app.coastal.sample(player.position).washDepth>.65,'brace test encounters heavy actual wash');keys.add('KeyE');safety.beforeFrame(1/30);assert.equal(safety.state,'braced');const braceAt=player.position.clone();player.update(1/30);assert.equal(player.mode,'walk');assert.ok(Math.hypot(player.position.x-braceAt.x,player.position.z-braceAt.z)<.001,'intact bracing prevents displacement');
keys.clear();safety.beforeFrame(1/30);player.update(1/30);assert.ok(player.mode==='swim'||safety.state==='swept','releasing the rail restores real water danger');
const washOutcomes=[];for(const fps of [30,60,120]){
	safety.reset();player.position.copy(westAnchor.to);player.mode='walk';player.waterH=0;player.grounded=true;player.velocity.set(0,0,0);app.coastal.load({time:54.66,strength:1.5});
	for(let i=0;i<fps/2;i++){safety.beforeFrame(1/fps);player.update(1/fps);}
	washOutcomes.push(`${player.mode}/${safety.state}`);assert.ok(player.mode==='swim'||safety.state==='swept',`unbraced heavy wash takes footing at ${fps} FPS`);
}
assert.equal(new Set(washOutcomes).size,1,'the same heavy set has equivalent physical outcomes at 30/60/120 FPS');
s.retryFromSafety();app.seaWeather=previousWeather;

app.qs.set('stormPreview','');await s.storm.begin();const before=terrain.heights.slice();s.storm.damage.set(true);assert.ok(s.storm.damage.changed.length>0);assert.ok(s.storm.damage.boxes.length>0);assert.equal(safety.anchors.find(a=>a.name==='west').intact,false);s.storm.damage.set(false);
assert.deepEqual(terrain.heights,before,'storm damage is reversible for checkpoint retries');assert.equal(safety.anchors.find(a=>a.name==='west').intact,true);
console.log('PASS coastal sets, pause, safe retry, immersion, reachable/blocked recovery, touch actions, recurring-light evidence and reversible storm damage.');
