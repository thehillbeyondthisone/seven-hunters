import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
globalThis.fetch=async u=>new Response(readFileSync('public/terrain/flannan/'+String(u).split('/').pop()));
const {loadFlannanData}=await import('../src/world/flannan/FlannanData.js');
const {FlannanTerrainData}=await import('../src/world/flannan/FlannanTerrain.js');
const {buildStation,STATION}=await import('../src/world/flannan/Station.js');
const {Builder}=await import('../src/world/village/GeoBuilder.js');
const {Colliders}=await import('../src/world/Colliders.js');
const {Rand,InstancedProps}=await import('../src/world/Props.js');
const {mulberry32}=await import('../src/util/Noise.js');
const {Vector3}=await import('../src/engine/index.js');
const {WinterEcology,WINTER_BIRDS}=await import('../src/world/flannan/WinterEcology.js');
const {winterCoverSites}=await import('../src/world/flannan/WinterCover.js');
const {WinterBirdCalls}=await import('../src/audio/WinterBirdCalls.js');
const F=await loadFlannanData(),T=new FlannanTerrainData(F.grids.island),B=new Builder(),C=new Colliders(),v={buildings:[],footprints:[]};
const st=buildStation({B,terrain:T,colliders:C,rand:new Rand(mulberry32(90210)),lights:[],inst:new InstancedProps(B)},v),H=st.parts.history;
assert.deepEqual(H.chapel.interior,[2.5,1.5]);assert.deepEqual(H.chapel.door,[.45,.95]);
assert.match(H.chapel.roof,/reconstructed/);
// An empty chamber, a physically narrow entrance and a proper lintel collider.
const ch=H.chapel,inside=new Vector3(ch.x,ch.floor,ch.z);
const old=inside.clone();C.resolveCapsule(inside,.15,.7);assert.ok(inside.distanceTo(old)<1e-5);
const crawl=new Vector3(ch.x-1.6,ch.floor,ch.z+.245),before=crawl.clone();C.resolveCapsule(crawl,.15,.7);assert.ok(crawl.distanceTo(before)<1e-5);
const upright=before.clone();C.resolveCapsule(upright,.3,1.75);assert.ok(upright.distanceTo(before)>.05);
assert.ok(H.bothies.sites[0].x<-300&&H.bothies.sites[1].x<H.bothies.sites[0].x);
for(const s of H.bothies.sites){assert.ok(T.heightAt(s.x,s.z)>15);assert.ok(v.footprints.some(f=>f.x===s.x&&f.z===s.z));}
for(const p of H.bothies.path)assert.ok(T.heightAt(...p)>10,'approach stays on land');
const main=H.bothies.sites[0],pass=new Vector3(main.x+2.5,main.floor,main.z),passBefore=pass.clone();
C.resolveCapsule(pass,.15,.45);assert.ok(pass.distanceTo(passBefore)<1e-5,'east crawl passage remains open');
const cover=winterCoverSites(T,v.footprints);assert.deepEqual(cover,winterCoverSites(T,v.footprints));assert.ok(cover.length>100&&cover.length<1500);
for(const p of cover){assert.ok(T.pathDistance(p.x,p.z)>1.14);assert.ok(v.footprints.every(f=>Math.hypot(p.x-f.x,p.z-f.z)>=f.r+.6));}
assert.equal(st.parts.winterCover.flowers,0);
console.log('ok chapel chamber, crawl-height threshold, bothy footprint/passage, dry-land approach, seeded off-path winter leaves');
const ecology=new WinterEcology({terrain:T}),camera={position:new Vector3(500,100,500)};
let max=0,empty=0,rest=0;
for(let i=0;i<12000;i++){
  ecology.update(.1,camera);const birds=ecology.snapshot();max=Math.max(max,birds.length);if(!birds.length)empty++;
  for(const a of ecology.agents.filter(a=>a.visible)){
    assert.ok(a.P.pos.every(Number.isFinite));assert.ok(a.P.pos[1]>=T.heightAt(a.P.pos[0],a.P.pos[2])+.18);if(a.resting)rest++;
  }
}
assert.ok(max<=4&&empty>500&&rest>0);assert.deepEqual(new Set(WINTER_BIRDS.map(a=>a.species)),new Set(['herring gull','great black-backed gull']));
ecology.update(.1,camera,{daylight:0});assert.equal(ecology.snapshot().length,0);
ecology.update(.1,camera,{suppressed:true});assert.equal(ecology.snapshot().length,0);
const clock=ecology.elapsed;ecology.update(.1,camera,{paused:true});assert.equal(ecology.elapsed,clock);
ecology.elapsed=100;ecology.update(0,camera);const a=ecology.agents[2];assert.ok(a.resting);
camera.position.set(a.x,a.P.pos[1]+1.6,a.z);ecology.update(.1,camera);assert.ok(!a.resting&&a.flee>30);
console.log('ok twenty-minute ecology simulation: four-bird ceiling, quiet intervals, terrain clearance, roost/flush, darkness/reveal/pause gates');
let calls=0;const audio=new WinterBirdCalls(ecology,()=>.5);audio.call=()=>calls++;
const scape={enabled:true,ctx:{state:'running'},env:{day:1,u:0,indoor:0,lx:a.x,lz:a.z}};
audio.remaining=0;audio.update(.1,scape);assert.equal(calls,1);
for(const [k,value] of [['day',0],['u',1],['indoor',1]]){const prev=scape.env[k];scape.env[k]=value;audio.remaining=0;audio.update(1,scape);assert.equal(calls,1);scape.env[k]=prev;}
scape.enabled=false;audio.remaining=0;audio.update(1,scape);assert.equal(calls,1);
console.log('ok positional calls use visible nearby birds and stop at night, underwater, indoors and when disabled');
console.log(JSON.stringify({cover:st.parts.winterCover,bothyStones:H.bothies.count,maximumBirds:max,emptyFrames:empty}));
