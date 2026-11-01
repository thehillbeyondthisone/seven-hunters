import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import '../../test/headless.mjs';
import {installBrowser} from './browser.mjs';
import {writePNG,bgraShot,writeSheet} from './png.mjs';

const width=1100,height=750,out=resolve(process.env.BOATMAN_REVIEW_OUT||'artifacts/boatman/elbows-20261101/temporal');mkdirSync(out,{recursive:true});
const assetHash=()=>createHash('sha256').update(readFileSync(resolve('public/models/characters/boatman.glb'))).digest('hex');
const sourceHash=assetHash();
const rigHash=createHash('sha256').update(readFileSync(resolve('src/world/boat/BoatmanRig.js'))).digest('hex');
installBrowser({search:'?bench&noAudio&arrivalPreview',width,height,root:resolve('public')});
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
app.player.update=()=>{};s.update=(dt)=>{s._applyClock();s.arrival.pose(0);follow();};
s.beat='crossing';s.paused=false;s.signal=false;s.tel=0;
s.flags.unpacking={stage:4,examined:true};s.unpacking.sync();
s.hand.carried=false;
app.input.down=()=>false;app.freeCam=false;
const output=new Texture({width,height,format:GPU.format,usage:['render','copySrc','sample'],label:'Boatman game review'});app.post.outputTexture=output;
const radial=(r,y,ang=a)=>new Vector3(Math.cos(ang)*r,y,Math.sin(ang)*r);
const local=(xyz)=>s.arrival.group.localToWorld(new Vector3(...xyz));
let eye,aim;
const follow=()=>{if(!eye)return;const p=local(eye),at=local(aim);app.camera.position.copy(p);app.camera.lookAt(at);app.player.position.copy(p).add(new Vector3(0,-1.62,0));const d=at.clone().sub(p).normalize();app.player.yaw=Math.atan2(-d.x,-d.z);app.player.pitch=Math.asin(d.y);};
const pose=(p,at,fov=60)=>{eye=s.arrival.group.worldToLocal(p.clone()).toArray();aim=s.arrival.group.worldToLocal(at.clone()).toArray();follow();app.camera.fov=fov;app.camera.updateProjectionMatrix();app.cameraCut();app.post.autoExposure.snap.value=1;};
const stroke=(phase)=>{s.arrival.rowingTime=phase*Math.PI*2/1.7;s.arrival.pose(0);};
const views=Array.from({length:12},(_,i)=>[
 `phase-${String(i).padStart(2,'0')}`,
 ()=>{s.arrival.begin(35);stroke(i/12);pose(local([.8,1.8,-2.2]),local([0,1.2,-.43]),56);}
]);const shots=[],modes=[];
for(const [name,stage] of views) {
 stage();morning.sync();
 for(let i=0;i<16;i++){app.frame(1/60);await GPU.queue.onSubmittedWorkDone();}
 const raw=await readTexture(output),body=new Uint8Array(8+raw.data.byteLength);new Uint32Array(body.buffer,0,2).set([width,height]);body.set(new Uint8Array(raw.data),8);
 const rgba=bgraShot(Buffer.from(body));shots.push(rgba);writePNG(resolve(out,name+'.png'),width,height,rgba.rgba);
 modes.push({view:name,far:s.arrival.boatman.far,gripError:s.arrival.boatman.gripError});console.log(name,app.keeperHands.mode);
}
writeSheet(resolve(out,'review.png'),shots,3);
await GPU.pipelinesReady();await GPU.queue.onSubmittedWorkDone();const validation=await GPU.device.popErrorScope();
assert.equal(validation,null,validation?.message);assert.deepEqual(errors,[]);
assert.ok(modes.every(v=>v.gripError<.002));

assert.equal(createHash('sha256').update(readFileSync(resolve('src/world/boat/BoatmanRig.js'))).digest('hex'),rigHash,'the authored rig must stay fixed during capture');
assert.equal(assetHash(),sourceHash,'the reviewed character asset must stay fixed during capture');
writeFileSync(resolve(out,'verification.json'),JSON.stringify({assetSha256:sourceHash,rigSha256:rigHash,phases:views.map((_,i)=>i/12),views:modes,validationErrors:errors,physicalDeviceTested:false},null,2));
writeFileSync(resolve(out,'index.html'),`<!doctype html><meta charset="utf-8"><title>Joe · boatman review</title><style>body{background:#111c20;color:#eee5d2;font:18px/1.5 Georgia;margin:30px}img{max-width:100%}figure{margin:30px 0}a{color:#edcf99}</style><h1>Joe, the boatman</h1><p>Twelve fixed-camera rowing phases from the game’s own WebGPU renderer. Rocketbox Joe with original period wardrobe, seated rowing animation, wave-driven hand constraints and distance geometry.</p>${views.map(([n])=>`<figure><figcaption>${n.replaceAll('-',' ')}</figcaption><img src="${n}.png"></figure>`).join('')}`);
console.log("PASS twelve temporal native WebGPU boatman views; no validation errors.");process.exit(0);


