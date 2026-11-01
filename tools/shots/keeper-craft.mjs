import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import '../../test/headless.mjs';
import {installBrowser} from './browser.mjs';
import {writePNG,bgraShot,writeSheet} from './png.mjs';

const width=1100,height=750,out=resolve('artifacts/keeper-craft/game');mkdirSync(out,{recursive:true});
installBrowser({search:'?bench&noAudio&morningPreview&arrivalAtmosphere',width,height,root:resolve('public')});
await import('../../src/core/BenchSeed.js');
const {App}=await import('../../src/App.js');
const {Story}=await import('../../src/story/Story.js');
const {GPU}=await import('../../src/engine/gpu/GPU.js');
const {Texture}=await import('../../src/engine/gpu/Texture.js');
const {readTexture}=await import('../../src/engine/gpu/Readback.js');
const {Vector3}=await import('../../src/engine/index.js');
const {TOWER,ROOM}=await import('../../src/world/flannan/Station.js');
const errors=[],init=GPU.init.bind(GPU);
GPU.init=async o=>{const r=await init(o);GPU.device.addEventListener('uncapturederror',e=>errors.push(e.error.message));GPU.device.pushErrorScope('validation');return r;};
const app=new App();await app.init((p,l)=>{if(l)console.log(`${Math.round(p*100)}% ${l}`);});
app.ui={ui:{photoMode:false,toast(){}},update(){}};
const s=app.story=new Story(app);s.save=()=>{};s.ui.card=s.ui.fade=async()=>{};await s.start();
const morning=s.morning,q=morning.state,F=TOWER.floor,a=TOWER.crankAngle;
app.player.update=()=>{};s.update=()=>{s._applyClock();morning.sync();};
s.arrival.update=()=>{};s.beat='morning';s.paused=false;s.signal=false;s.tel=0;
s.flags.unpacking={stage:4,examined:true};s.unpacking.sync();
s.hand.carried=false;
app.input.down=()=>false;app.freeCam=false;
const output=new Texture({width,height,format:GPU.format,usage:['render','copySrc','sample'],label:'Keeper craft game review'});app.post.outputTexture=output;
const radial=(r,y,ang=a)=>new Vector3(Math.cos(ang)*r,y,Math.sin(ang)*r);
const local=(xyz)=>s.arrival.group.localToWorld(new Vector3(...xyz));
const pose=(p,at,fov=60)=>{app.camera.position.copy(p);app.camera.lookAt(at);app.camera.fov=fov;app.camera.updateProjectionMatrix();app.player.position.copy(p).add(new Vector3(0,-1.62,0));const d=at.clone().sub(p).normalize();app.player.yaw=Math.atan2(-d.x,-d.z);app.player.pitch=Math.asin(d.y);app.cameraCut();app.post.autoExposure.snap.value=1;};
const views=[
 ['01-boatman',()=>{s.arrival.begin(35);s.arrival.elapsed=35;s.arrival.pose(.5);pose(local([.8,1.65,-2.0]),local([0,1.26,-.43]),45);}],
 ['02-rowing-recovery',()=>{s.arrival.rowingTime+=1.5;s.arrival.pose(.5);pose(local([.75,1.8,-1.8]),local([0,1.26,-.43]),55);}],
 ['03-brownie-on-desk',()=>{s.arrival.group.visible=false;const p=s.station.parts.unpacking.desk;pose(p.clone().add(new Vector3(.18,.16,.27)),p,39);}],
 ['04-lantern-in-hand',()=>{s.hand.carried=true;s.hand.lit=true;s.hand.glow=1;pose(new Vector3(-4.1,F+1.62,3.0),new Vector3(-4.1,F+.95,1.8),68);}],
 ['05-brownie-in-hand',()=>{app.qs.delete('morningPreview');s.beat='lw-photos';s.photography.state.taken=true;s.photography.raised=true;s.hand.lit=false;pose(new Vector3(-4.1,F+1.62,3.0),new Vector3(-5,F+.9,1.1),65);}],
 ['06-winding-camera',()=>{s.interact.current={id:'filmWind'};app.input.down=()=>true;}],
 ['07-carrying-supplies',()=>{app.qs.set('morningPreview','');s.photography.raised=false;s.beat='morning';s.interact.current=null;app.input.down=()=>false;q.canPlace=q.kitPlace='carried';pose(new Vector3(9.3,F+1.62,-.8),new Vector3(9.3,F+.95,1.7),70);}],
 ['08-pouring-oil',()=>{q.kitPlace='shelf';q.fountainCapped=q.canCapped=false;morning.motion={action:'pour',t:.8};pose(radial(1.95,TOWER.deck+1.65,a+.8),morning.at('fountain'),65);}],
 ['09-wiping-glass',()=>{q.canPlace='shelf';q.panelOpen=true;morning.motion={action:'glass',t:1};pose(radial(1.95,morning.layout.focal-.3,a-.35),morning.at('glass'),65);}],
 ['10-wick-trimming',()=>{morning.motion={action:'wick',t:1};pose(radial(1.95,morning.layout.focal-.3),morning.at('burner'),65);}],
 ['11-winding-machine',()=>{morning.motion=null;s.lamp.wind=.3;s.hand.carried=false;s.interact.current={id:'crank'};app.input.down=()=>true;pose(radial(1.7,TOWER.deck+1.62),TOWER.crank.clone(),65);}],
 ['12-bedding-and-cloth',()=>{s.interact.current=null;app.input.down=()=>false;q.canPlace=q.kitPlace='home';s.hand.carried=false;pose(new Vector3(-2.65,F+1.55,11.0),new Vector3(-4.05,F+.65,12.25),70);}],
 ['13-landing-ropes',()=>{const L=s.station.landings.east,p=new Vector3(L.stage.x,L.stage.y,L.stage.z);pose(p.clone().add(new Vector3(1.4,1.3,1.0)),p.clone().add(new Vector3(0,.15,0)),64);}],
 ['14-optic-carriage',()=>{pose(radial(1.7,morning.layout.focal-1.15,a+.8),new Vector3(0,morning.layout.focal-1.43,0),48);}],
];
const shots=[],modes=[];
for(const [name,stage] of views) {
 stage();morning.sync();
 for(let i=0;i<16;i++){app.frame(1/60);await GPU.queue.onSubmittedWorkDone();}
 const raw=await readTexture(output),body=new Uint8Array(8+raw.data.byteLength);new Uint32Array(body.buffer,0,2).set([width,height]);body.set(new Uint8Array(raw.data),8);
 const rgba=bgraShot(Buffer.from(body));shots.push(rgba);writePNG(resolve(out,name+'.png'),width,height,rgba.rgba);
 modes.push({view:name,hands:app.keeperHands.mode});console.log(name,app.keeperHands.mode);
}
writeSheet(resolve(out,'review.png'),shots,3);
await GPU.pipelinesReady();await GPU.queue.onSubmittedWorkDone();const validation=await GPU.device.popErrorScope();
assert.equal(validation,null,validation?.message);assert.deepEqual(errors,[]);
assert.equal(modes.find(v=>v.view==='04-lantern-in-hand').hands,'lantern');
assert.equal(modes.find(v=>v.view==='05-brownie-in-hand').hands,'camera');
assert.equal(modes.find(v=>v.view==='08-pouring-oil').hands,'pour');
writeFileSync(resolve(out,'verification.json'),JSON.stringify({views:modes,validationErrors:errors,physicalDeviceTested:false},null,2));
writeFileSync(resolve(out,'index.html'),`<!doctype html><meta charset="utf-8"><title>Keeper craft · game review</title><style>body{background:#111c20;color:#eee5d2;font:18px/1.5 Georgia;margin:30px}img{max-width:100%}figure{margin:30px 0}a{color:#edcf99}</style><h1>Keeper craft</h1><p>Fourteen views from Seven Hunters' own WebGPU renderer. Clothing, equipment and fittings are authored reconstructions. Rendering checks passed; physical phone and headset performance remains untested.</p>${views.map(([n])=>`<figure><figcaption>${n.replaceAll('-',' ')}</figcaption><img src="${n}.png"></figure>`).join('')}`);
console.log('PASS fourteen native WebGPU craft views; no validation errors.');process.exit(0);
