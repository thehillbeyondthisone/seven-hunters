// Real walking/interaction plumbing and reversible inspection, with the CPU DOM adapter.
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
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
const F=await loadFlannanData(),terrainData=new FlannanTerrainData(F.grids.island);
const B=new Builder(),colliders=new Colliders(),village={buildings:[],footprints:[]};
const st=buildStation({B,terrain:terrainData,colliders,rand:new Rand(mulberry32(90210)),lights:[],inst:new InstancedProps(B)},village);
st.moving={doors:st.parts.doors,telescope:{visible:true}};village.station=st;
const keys=new Set(),input={enabled:true,keys,down:c=>keys.has(c),hit:()=>false,consumeLook:()=>({x:0,y:0}),consumeWheel:()=>0,requestLock(){}};
const camera=new E.PerspectiveCamera(70,16/9,.1,150000),query={cpuValid:false,cpu:new Float32Array(128),allocate:()=>0,setPoint(){}};
const player=new Player({camera,input,terrain:terrainData,colliders,query,boat:null});
const app={qs:new URLSearchParams('interiorPreview&chapterPreview=kitchen'),village,terrainData,colliders,camera,player,input,query,
 lamp:new Lamp({origin:new E.Vector3(0,st.focal,0)}),handLamp:new HandLamp(),settings:{timeOfDay:12,timeSpeed:0},setting:{dayOffset:0},haze:{density:{value:1}},clouds:{coverage:{value:.4}},ui:{ui:{toast(){}}},flannan:F};
app.handLamp.setRest(new E.Vector3(-4.95,TOWER.floor+.74,3.12),.4);
localStorage.setItem('sevenhunters.night1.v1','protected normal watch');
const s=app.story=new Story(app);s.ui.card=async()=>{};await s.start();
let finish;
const originalPage=s.ui._page.bind(s.ui);
s.ui._page=(build,options)=>originalPage((page,done)=>{finish=done;build(page,done);},options);
function place(x,z){player.position.set(x,terrainData.heightAt(x,z),z);player.mode='walk';player.grounded=true;player.velocity.set(0,0,0);player._camY=null;player.pitch=0;player.update(0);}
function walk(points){
 place(...points[0]);keys.add('KeyW');
 for(const [x,z] of points.slice(1)){
  let frames=0;
  while(Math.hypot(x-player.position.x,z-player.position.z)>.25&&frames++<2400){
   player.yaw=Math.atan2(-(x-player.position.x),-(z-player.position.z));player.update(1/60);
   assert.equal(player.mode,'walk','ruin approach never drops into swimming');
  }
  assert.ok(frames<2400,'walking controller reaches each approach waypoint');
 }
 keys.clear();player.velocity.set(0,0,0);player.update(0);
}
walk(st.parts.history.bothies.path);
assert.ok(player.position.distanceTo(s.interact.get('bothyLarge').at)<2.5);
walk([[-329,23],[-340,24],[-355,24],[-355,14],[-349.3,13.9]]);
assert.ok(player.position.distanceTo(s.interact.get('bothySmall').at)<2.5);
walk([[-45,27.5],[-39.8,38],[-38.6,46],[-37.9,50.25]]);
assert.ok(player.position.distanceTo(s.interact.get('chapel').at)<2.2);
console.log('ok real walking controller reaches all three ruin entrances along their paths');
for(const id of ['chapel','bothyLarge','bothySmall']){
 const target=s.interact.get(id);place(target.at.x+(id==='chapel'?-1:0),target.at.z);
 camera.lookAt(target.at);camera.updateMatrixWorld();assert.equal(s.interact.pick()?.id,id);
 const saved=camera.position.clone(),orientation=camera.quaternion.clone(),feet=player.position.clone(),h=s.h,flags=JSON.stringify(s.flags),beat=s.beat;
 const pending=target.use();assert.equal(s.ui.open,true);assert.equal(input.enabled,false);
 s.update(1);assert.ok(camera.position.distanceTo(saved)>.1);assert.ok(player.position.equals(feet));
 assert.equal(s.h,h);assert.equal(s.beat,beat);assert.equal(JSON.stringify(s.flags),flags);
 finish(null);await pending;assert.equal(s.ui.open,false);assert.equal(input.enabled,true);
 assert.ok(camera.position.equals(saved)&&camera.quaternion.equals(orientation));assert.equal(s.ruinInspect,null);
}
app.xr={active:true};const pending=s.interact.get('chapel').use();assert.ok(!s.ruinInspect);
camera.position.add(new E.Vector3(.1,.2,.3));const physicalPose=camera.position.clone();finish(null);await pending;
assert.ok(camera.position.equals(physicalPose),'XR inspection never restores an obsolete head pose');
assert.equal(localStorage.getItem('sevenhunters.night1.v1'),'protected normal watch');
console.log('ok reachable interaction targets, paused watch, held player, reversible camera/input, unchanged flags/save and XR physical pose');
