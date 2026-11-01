import assert from 'node:assert/strict';
import {fixture,E,TOWER,ROOM} from './helpers/morning-fixture.mjs';
import {CoastalState} from '../src/ocean/CoastalState.js';
import {KeeperSafety} from '../src/player/KeeperSafety.js';
import {photographPixels,PRINT_SIZE} from '../src/story/Photography.js';
import {confessionScript} from '../src/story/LaterScript.js';
import {Watcher} from '../src/story/Watcher.js';
import {mobileAction} from '../src/mobile/MobileOptions.js';
import {stationShelter} from '../src/weather/SeaWeather.js';
import {stationAcoustics} from '../src/world/flannan/StationAcoustics.js';
import {routeGuidance} from '../src/story/Guidance.js';
import {upperShedRoute} from '../src/story/LaterWatch.js';
import {westRoute} from '../src/story/StormReview.js';
const f=await fixture(false,{search:'laterWatchPreview=photography',morningStudy:false}),{s,app,place,face,player}=f;
app.coastal=new CoastalState(app.terrainData);app.keeperSafety=new KeeperSafety(app,s);
s.ui.choose=async q=>q.options[0].value;s.ui.journal=async()=>({fragment:true,disclose:true});
s.ui.album=async q=>{assert.deepEqual(q.frames,s.photography.state.frames);};s.ui.end=q=>{s.lastEnd=q;};
app.capturePhotograph=async()=> 'data:image/jpeg;base64,c2NlbmU=';
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
assert.equal(s.beat,'lw-camera');assert.notEqual(s.saveKey,'sevenhunters.night1.v1');
await s.photography.take();await s.later.belongings();assert.equal(s.beat,'lw-photos');
place(...s.photography.sites[0].stand.toArray());face(s.photography.sites[0].at);s.interact.get('photo-brace').use();
for(const site of s.photography.sites){place(...site.stand.toArray());face(site.at);assert.ok(s.photography.expose(site));await flush();assert.equal(s.photography.state.wound,false);assert.equal(s.photography.expose(site),false);s.interact.get('filmWind').use();}
assert.equal(s.photography.state.frames.length,3);assert.equal(s.photography.missing,undefined);
place(-1,TOWER.floor,4);player.grounded=true;s.save();const photoSave=JSON.parse(JSON.stringify(s._snapshot()));
let finish;app.capturePhotograph=()=>new Promise(r=>{finish=r;});const site=s.photography.sites[0];place(...site.stand.toArray());face(site.at);s.photography.expose(site);await flush();s._restore(photoSave);finish('data:image/jpeg;base64,b2xk');await flush();assert.equal(s.photography.state.frames.length,3);
await s.later.finishPictures();assert.equal(s.beat,'lw-photo-signal');
await s.later.beginFog();place(TOWER.signalStand.x,TOWER.deck,TOWER.signalStand.z);s.app.camera.position.copy(player.position).add(new E.Vector3(0,1.62,0));s.app.camera.lookAt(s.later.fragmentAt);s.tel=1;
for(let i=0;i<420;i++)s.later.fragment(1/60);
assert.equal(s.beat,'lw-fog-journal');assert.ok(s.later.state.fragment.marks.length>0);
assert.equal(s.later.state.fragment.letters,'');const received=s.later.state.fragment.marks;await s.later.journal();
assert.equal(s.beat,'lw-review');assert.equal(s.later.state.reviewBoundary,'scene13');
assert.ok(s.rows.some(r=>r[1].includes(received)&&r[1].includes('tail missing')));
assert.equal(s.lastEnd.next.label,'Review storm preparations');await s.lastEnd.next.use();assert.equal(s.beat,'lw-workshop');
s.interact.get('workshopTools').use();assert.equal(s.beat,'lw-repair');
s.interact.get('repairBrake').use();assert.equal(s.later.state.repaired,true);const repairRows=s.rows.length;
assert.equal(s.later.renewPin(),false);assert.equal(s.rows.length,repairRows,'a completed repair cannot duplicate itself');

// The original scene13 script is retained for explicit legacy review only.
for(const choice of ['angry','kind','guarded']){
 const w=new Watcher(confessionScript(true));w.appear();w.answer();
 for(let i=0;i<100&&w.state!=='done';i++){if(w.state==='waiting')w.reply(Math.max(0,w.options.findIndex(o=>o.flag===choice)));w.update(100,{watched:true});}
 assert.ok(w.log.some(l=>l.text.includes('WEATHER HID IT')));assert.ok(w.log.some(l=>l.text.includes('CANNOT KNOW')));assert.equal(w.flags[choice],true);
}
await s.later.begin('admission');assert.equal(s.beat,'lw-confession');s.later.state.response='angry';s.setBeat('lw-confession-journal');await s.later.journal();assert.equal(s.beat,'lw-workshop');
s.flags.storm={connected:true,routeDestroyed:true};s.storm.damage.set(true);s.later.state.legacyReview=false;
await s.later.beginRelief();assert.equal(s.beat,'lw-review');assert.equal(s.lastEnd.next,null);
await s.later.begin('relief');assert.equal(s.beat,'lw-relief-look');assert.ok(s.storm.damage.destroyed);
const reliefSave=JSON.parse(JSON.stringify(s._snapshot()));s._restore(reliefSave);assert.ok(s.storm.damage.destroyed);assert.equal(s.beat,'lw-relief-look');
s.lamp.wind=1;s.setBeat('lw-handover');s.interact.get('handover').use();assert.ok(s.later.state.handover.journal.length);assert.equal(s.beat,'lw-farewell');s.setBeat('lw-pack');s.interact.get('packRoll').use();await s.later.ashore();assert.equal(s.beat,'lw-complete');assert.equal(s.later.state.ashore,true);assert.equal(s.lastEnd.heading,'Someone comes');
const legacy={...photoSave,beat:'rl-complete',flags:{returningLight:{recorded:true}}};s._restore(legacy);s.returningLight.showEnd();assert.equal(s.h,photoSave.h);
for(const doors of [[.1,.2,.3,.4],[.1,.2,.3,.4,.5,.6]]){const old={...legacy,doors};delete old.doorStates;s._restore(old);assert.equal(s.doors.gallery[0].target,.1);assert.equal(s.doors.house[0].target,.2);assert.equal(s.doors.bedrooms[0].target,0);assert.equal(s.doors.spareBedroom[0].target,0);assert.equal(s.doors.gate[1].target,doors.at(-1));}
await s.later.begin();await s.photography.take();await s.later.belongings();s.photography.state.frames=Array.from({length:6},()=>({subject:'chair',image:'data:image/jpeg;base64,eA=='}));assert.match(s.later.goal(),/roll is full/i);assert.equal(s.photography.guidance().id,'journal');await s.later.finishPictures();assert.equal(s.beat,'lw-photo-signal');
await s.later.beginFog();s.later.finishFragment();await s.later.journal();assert.equal(s.beat,'lw-review','unseen optional flashes still reach the review boundary');
const wind=s.interact.get('filmWind');assert.ok(wind.hold>0);assert.equal(mobileAction({player:{prompt:{text:wind.text,key:'E',hold:true,progress:.4}}}).label,wind.text);
for(const at of [new E.Vector3(-18,TOWER.floor+1.6,3),new E.Vector3(9.3,TOWER.floor+1.6,-2)]){assert.ok(stationShelter(at));assert.equal(stationAcoustics(at).indoor,1);}
assert.match(s.dayText(729.5),/2nd February 1901/);
const home={at:new E.Vector3(-3,TOWER.floor,1),label:'Home',id:'home'};
assert.equal(routeGuidance(new E.Vector3(-18,TOWER.floor,3),home,'room').id,'secondBedroom');assert.equal(routeGuidance(new E.Vector3(-12,TOWER.floor,3),home,'room').id,'westBedrooms');
place(9.3,TOWER.floor,-2);assert.equal(westRoute(s,s.storm.lookout,'West').id,'workshopDoor');s.setBeat('lw-repair');assert.equal(s.interact.get('workshopDoor').when(),true);
place(-160,app.terrainData.heightAt(-160,35),35);assert.equal(upperShedRoute(s).id,'repairShedSide');place(-160,app.terrainData.heightAt(-160,40),40);s.setBeat('lw-repair-return');assert.equal(s.later.guidance().id,'repairShedExit');
await s.later.begin('relief');assert.ok(s.storm.damage.destroyed);assert.equal(s.photography.state.frames.length,6);
s.flags.photography={taken:true,wound:true,frames:[]};s.beat='lw-photos';s.h=228;s.later.update(100000);assert.equal(s.h,230);s.later.update(100000);assert.equal(s.h,230);
app.capturePhotograph=async()=> 'data:image/jpeg;base64,c2NlbmU=';place(...s.photography.sites[0].stand.toArray());face(s.photography.sites[0].at);s.interact.get('photo-brace').use();s.photography.ready();
f.keys.add('KeyE');assert.ok(s.photography.expose(s.photography.sites[0]));await flush();s.interact.get('filmWind').use();assert.equal(s.photography.state.wound,false);f.keys.clear();s.interact.get('filmWind').use();assert.equal(s.photography.state.wound,true);f.keys.add('KeyE');assert.equal(s.photography.expose(s.photography.sites[0]),false);f.keys.clear();
const px=photographPixels(new Uint8Array([30,60,90,255]),1,1);assert.equal(px.length,PRINT_SIZE*PRINT_SIZE*4);assert.ok(px[0]<px[1]+5);assert.equal(px[3],255);
console.log('PASS required first chair photo, six-frame discipline, in-flight rollback, optional observed fragment, scene13 boundary, idempotent repair, guarded held ending and preserved explicit legacy sources/saves.');
