// The optional papers on the real station: physical reach, story-clock pause,
// no objective/flag progression, original bytes and separate preview saves.
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { installBrowser } from '../tools/shots/browser.mjs';
Object.defineProperty(globalThis,'navigator',{value:{},writable:true,configurable:true});
installBrowser({search:'?interiorPreview&chapterPreview=kitchen',root:resolve('public')});
const E=await import('../src/engine/index.js');
const {loadFlannanData}=await import('../src/world/flannan/FlannanData.js');
const {FlannanTerrainData}=await import('../src/world/flannan/FlannanTerrain.js');
const {buildStation,TOWER}=await import('../src/world/flannan/Station.js');
const {Builder}=await import('../src/world/village/GeoBuilder.js');
const {InstancedProps,Rand}=await import('../src/world/Props.js');
const {Colliders}=await import('../src/world/Colliders.js');
const {mulberry32}=await import('../src/util/Noise.js');
const {Player}=await import('../src/player/Player.js');
const {Lamp}=await import('../src/station/Lamp.js');
const {HandLamp}=await import('../src/station/HandLamp.js');
const {Story}=await import('../src/story/Story.js');
const {ARCHIVE_DOCUMENTS}=await import('../src/story/ArchiveDocuments.js');
const F=await loadFlannanData(),terrainData=new FlannanTerrainData(F.grids.island);
const B=new Builder(),colliders=new Colliders(),village={buildings:[],footprints:[]};
const st=buildStation({B,terrain:terrainData,colliders,rand:new Rand(mulberry32(90210)),lights:[],inst:new InstancedProps(B),checks:[]},village);
st.moving={doors:st.parts.doors,telescope:{visible:true}};village.station=st;
const keys=new Set(),input={enabled:true,keys,rightDown:false,down:c=>keys.has(c),hit:()=>false,consumeLook:()=>({x:0,y:0}),consumeWheel:()=>0,requestLock(){}};
const camera=new E.PerspectiveCamera(70,16/9,.1,150000),query={cpuValid:false,cpu:new Float32Array(128),allocate:()=>0,setPoint(){}};
const player=new Player({camera,input,terrain:terrainData,colliders,query,boat:null});
const app={qs:new URLSearchParams('interiorPreview&chapterPreview=kitchen'),village,terrainData,colliders,camera,player,input,query,
 lamp:new Lamp({origin:new E.Vector3(0,st.focal,0)}),handLamp:new HandLamp(),settings:{timeOfDay:12,timeSpeed:0},setting:{dayOffset:0},haze:{density:{value:1}},clouds:{coverage:{value:.4}},ui:{ui:{toast(){}}},flannan:F};
app.handLamp.setRest(new E.Vector3(-4.95,TOWER.floor+.74,3.12),.4);
localStorage.setItem('sevenhunters.night1.v1','protected normal watch');
localStorage.setItem('sevenhunters.chapter-preview.kitchen.v1','protected chapter preview');
const s=app.story=new Story(app);s.ui.card=async()=>{};
await s.start();
assert.equal(s.saveKey,'sevenhunters.interior-preview.v1');
assert.equal(s.beat,'d2kitchen');
assert.ok(s.next.active,'both domestic doors can be opened in the interior preview');
assert.equal(st.parts.archiveDisplays.length,3,'house dressing preserves both tower drawings');
for(const display of st.parts.archiveDisplays){
 const it=s.interact.get(display.id);
 assert.ok(it && Number.isFinite(it.at.x) && Number.isFinite(it.at.y),'document target works without GPU texture loading');
 if(display.id==='islandMap')player.position.set(-5,TOWER.floor,4.0);
 else {const a=Math.atan2(display.z,display.x);player.position.set(Math.cos(a)*1.8,TOWER.deck,Math.sin(a)*1.8);}
 player.mode='walk';player.grounded=true;player.velocity.set(0,0,0);player._camY=null;player.pitch=0;player.update(0);
 camera.lookAt(it.at);camera.updateMatrixWorld();
 assert.equal(s.interact.pick()?.id,display.id,display.id+' can be selected from the real walking ring/room');
 const h=s.h,beat=s.beat,flags=JSON.stringify(s.flags);
 const pending=it.use();assert.ok(pending instanceof Promise);assert.equal(s.ui.open,true);assert.equal(input.enabled,false);
 s.update(1);
 assert.equal(s.h,h,'reading holds the watch clock');assert.equal(s.beat,beat);assert.equal(JSON.stringify(s.flags),flags,'studying a scan cannot complete a duty');
 s.ui._close();s.ui.layer.lastChild.remove();
 assert.equal(input.enabled,true);
}
s.save();assert.ok(localStorage.getItem(s.saveKey));
assert.equal(localStorage.getItem('sevenhunters.night1.v1'),'protected normal watch');
assert.equal(localStorage.getItem('sevenhunters.chapter-preview.kitchen.v1'),'protected chapter preview');
for(const beat of ['intro','crossing','end']){s.beat=beat;assert.equal(s.interact.get('islandMap').when(),false);}
const provenance=JSON.parse(readFileSync('public/archive/provenance.json','utf8'));
for(const paper of Object.values(ARCHIVE_DOCUMENTS)){
 const name=paper.image.split('/').pop(),bytes=readFileSync('public/archive/'+name);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),provenance.assets[name].sha256,'original scan bytes remain unchanged');
 assert.ok(readFileSync('public/archive/'+paper.texture.split('/').pop()).length>1000,'each in-world paper has a local texture');
}
console.log('PASS three papers reachable from real rooms/deck; reading pauses the watch without advancing duties; CPU targets, isolated saves and original scan hashes.');
