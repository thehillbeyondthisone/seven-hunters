// Actual App/Story first-person captures from explicit review checkpoints.
// Import captureGate for an already warm App, or run this file for its own App.
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,readdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';
import {createHash} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {installBrowser} from './browser.mjs';
import {bgraShot,writePNG,writeSheet} from './png.mjs';

export async function captureGate({app,s,GPU,output,preview=false,fps=20,out=resolve('artifacts/story-review/gate')}) {
 const width=output.width,height=output.height,dt=1/fps;
 const sourcePaths=['src/story/FirstWatchRevision.js','src/App.js','src/world/flannan/GateWorkProps.js','src/world/flannan/GateWorkModel.js','src/world/flannan/Station.js'];
 const sourceHash=path=>createHash('sha256').update(readFileSync(resolve(path))).digest('hex');
 const sources=Object.fromEntries(sourcePaths.map(path=>[path,sourceHash(path)]));
 mkdirSync(out,{recursive:true});
 const ffbase=join(homedir(),'AppData','Local','hermes','tools');
 const ffmpeg=process.env.FFMPEG_BIN||readdirSync(ffbase).filter(n=>n.startsWith('ffmpeg-')).sort().reverse().map(n=>join(ffbase,n,'bin','ffmpeg.exe')).find(existsSync)||'ffmpeg';
 if(!preview)assert.equal(spawnSync(ffmpeg,['-hide_banner','-version'],{windowsHide:true}).status,0);
 const {readTexture}=await import('../../src/engine/gpu/Readback.js');
 const {Vector3}=await import('../../src/engine/index.js');
 const {STATION,TOWER,updateDoor}=await import('../../src/world/flannan/Station.js');
 const {Watcher}=await import('../../src/story/Watcher.js');
 const {Story}=await import('../../src/story/Story.js');
 const {Player}=await import('../../src/player/Player.js');
 const {BoatArrival}=await import('../../src/story/BoatArrival.js');
 assert.equal(app.story,s,'The capture must drive the same Story that App renders');
 assert.ok(!Object.hasOwn(s,'cinematic'),'Do not shadow Story cinematic state in a gameplay capture');
 const {GATE_REVEAL_SECONDS,GATE_REVEAL_LEAN,GATE_REVEAL_FOV,GATE_FOCUS_EXPOSURE}=await import('../../src/story/FirstWatchRevision.js');
 assert.equal(app.post.autoExposure.enabled.value,1,'Gate proof uses ordinary automatic exposure');
 assert.equal(app.post.autoExposure.snap.value,0,'Gate proof must not inherit instantaneous photographic or benchmark exposure');
 const prior={snapshot:structuredClone(s._snapshot()),playerUpdate:app.player.update,storyUpdate:s.update,arrivalUpdate:s.arrival.update,fov:app.camera.fov,qs:app.qs,down:app.input.down,hit:app.input.hit,look:app.input.consumeLook,inputEnabled:app.input.enabled,freeCam:app.freeCam,photoRaised:s.photography.raised,output:app.post.outputTexture,save:s.save};
 const errors=[],onError=e=>errors.push(e.error.message);
 GPU.device.addEventListener('uncapturederror',onError);GPU.device.pushErrorScope('validation');
 let scopeOpen=true;
 try {
 app.qs=new URLSearchParams(prior.qs);app.qs.delete('morningPreview');
 s.save=()=>{};app.player.update=Player.prototype.update;s.update=Story.prototype.update;s.arrival.update=BoatArrival.prototype.update;
const p=app.player,keys=new Set(),taps=new Set();
app.input.down=c=>app.input.enabled&&keys.has(c);app.input.hit=c=>app.input.enabled&&taps.delete(c);app.input.consumeLook=()=>({x:0,y:0});
app.freeCam=false;app.input.enabled=true;
s.flags.landed=s.flags.islandRevealSeen=s.flags.talked=true;s.flags.firstLightMilestone=15.2;
s.flags.roomArrival={done:true};s.flags.introLessons={seen:[],pending:[],active:null,gap:0,yard:true,done:true};
s.flags.unpacking={stage:4,examined:true};s.unpacking.sync();s.flags.keeperRoutine=true;
Object.assign(s.keeper.state,{inspected:true,verified:true,rewound:true,driveCutsceneSeen:true});
s.watcher=new Watcher();s.watcher.state='done';s.lamp.ignite();s.lamp.wind=1;s.lamp.start();
s.arrival.group.visible=false;s.signal=false;s.tel=0;s.paused=false;s.titleView=false;
s.hand.carried=true;s.hand.lit=true;s.photography.raised=false;app.post.outputTexture=output;
const pose=(position,target)=>{keys.clear();taps.clear();p.position.copy(position);p.velocity.set(0,0,0);p.grounded=true;p.mode='walk';p._camY=null;p.busy=false;app.input.enabled=true;const d=target.clone().sub(position.clone().add(new Vector3(0,1.62,0)));p.yaw=Math.atan2(-d.x,-d.z);p.pitch=Math.atan2(d.y,Math.hypot(d.x,d.z));p.update(0);app.cameraCut();};
const settle=()=>{for(let i=0;i<150;i++)for(const d of s.moving.doors)updateDoor(d,1/60);s.gateWork.update();};
const images=[],checks=[],segments=[];
const snap=async(name,seconds)=>{const raw=await readTexture(output),b=new Uint8Array(8+raw.data.byteLength);new Uint32Array(b.buffer,0,2).set([width,height]);b.set(new Uint8Array(raw.data),8);const img=bgraShot(Buffer.from(b));writePNG(join(out,name+'.png'),width,height,img.rgba);images.push(img);checks.push({name,seconds,beat:s.beat,position:p.position.toArray(),camera:app.camera.position.toArray(),rotation:app.camera.quaternion.toArray(),fov:app.camera.fov,input:app.input.enabled,busy:p.busy,cinematic:s.cinematic,shieldedEyes:s.firstWatch.shieldsLantern,focusExposure:s.firstWatch.focusExposure,handLit:s.hand.lit,nightVision:{strength:app.nightVision.strength,exposure:app.nightVision.exposure},east:s.doors.gate.map(d=>({target:d.target,open:d.open,rotation:d.obj.rotation.y,solid:d.block.solid})),south:s.doors.southGate.map(d=>({target:d.target,open:d.open,solid:d.block.solid})),ropes:structuredClone(s.flags.gateRopes)});console.log(name,s.beat);};
const frame=async()=>{app.frame(dt);await GPU.queue.onSubmittedWorkDone();};
async function segment(name,seconds,control,at){
 let encoder=null,done=null,stderr='';
 if(!preview){encoder=spawn(ffmpeg,['-y','-hide_banner','-loglevel','warning','-f','rawvideo','-pixel_format',GPU.format.startsWith('bgra')?'bgra':'rgba','-video_size',`${width}x${height}`,'-framerate',String(fps),'-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',join(out,name+'.mp4')],{windowsHide:true});encoder.stderr.on('data',d=>stderr+=d.toString());done=new Promise((r,j)=>{encoder.on('error',j);encoder.on('close',c=>c===0?r():j(new Error(stderr)));});}
 try{for(let i=0;i<Math.ceil(seconds*fps);i++){const t=i/fps;control(t);await frame();if(encoder){const raw=await readTexture(output);if(!encoder.stdin.write(Buffer.from(raw.data)))await once(encoder.stdin,'drain');}for(const item of at)if(i===Math.round(item[0]*fps))await snap(name+'-'+item[1],t);}if(encoder){encoder.stdin.end();await done;}}catch(e){encoder?.kill();throw e;}segments.push({name,seconds,fps,movie:preview?null:name+'.mp4'});
}
// Checkpoint one: first-night gate task, inside the east entrance after contact.
s.h=18;s.beat='gate-secure';delete s.flags.firstWatchRevision;delete s.flags.gateRopes;s.flags.gateRopes={};
for(const d of s.doors.gate)d.open=d.target=1;settle();
pose(new Vector3(STATION.eastGate.x-1.25,STATION.yard,STATION.eastGate.z),s.interact.get('gate').at);
for(let i=0;i<100;i++)await frame();
assert.equal(s.interact.pick()?.id,'gate');
await segment('gate-wrap',7,t=>{keys.clear();if(t>.5&&t<1.4||t>2&&t<4.1)keys.add('KeyE');},[[0,'open'],[1.2,'interrupted'],[4.7,'secured'],[6.5,'rope-close']]);
assert.ok(s.flags.gateRopes[0].secured&&s.doors.gate.every(d=>d.open===0));
// Checkpoint two: later fog watch, actual east balcony standing point. A saved
// checkpoint changes the location/time between these separate capture segments.
s.h=s.haar+.6;s.beat='haar';const rail=s.firstWatch.rail,angle=Math.atan2(rail.z,rail.x),r=Math.hypot(rail.x,rail.z)-.3;
const stand=new Vector3(Math.cos(angle)*r,TOWER.deck,Math.sin(angle)*r);
const sea=stand.clone().add(new Vector3(Math.cos(angle)*20,1.4,Math.sin(angle)*20));
pose(stand,sea);for(const d of s.doors.gallery)d.open=d.target=1;settle();
for(let i=0;i<80;i++)await frame();
assert.equal(s.interact.pick()?.id,'gateLookout');
const home={position:app.camera.position.clone(),feet:p.position.clone(),q:app.camera.quaternion.clone(),fov:app.camera.fov,hand:structuredClone(s.hand.save())};
await segment('rail-reveal',GATE_REVEAL_SECONDS+4,t=>{keys.clear();if(t>.6&&t<2)keys.add('KeyE');},[[0,'sea-before'],[2.4,'looking-down'],[4.3,'open-gate'],[7.5,'recognition'],[GATE_REVEAL_SECONDS+2.8,'control-return']]);
assert.equal(s.beat,'gate');assert.ok(app.input.enabled&&!p.busy&&!s.cinematic);
assert.ok(app.camera.position.distanceTo(home.position)<.001&&app.camera.quaternion.angleTo(home.q)<.001&&app.camera.fov===home.fov,'the normal player camera returns exactly');
assert.ok(p.position.distanceTo(home.feet)<.001,'the player feet remain planted through the gate view');
assert.deepEqual(s.hand.save(),home.hand,'the lantern remains in its original saved state');
assert.equal(s.firstWatch.focusExposure,1,'the ordinary exposure returns after the reveal');
// Checkpoint three: the independent real south pair at its own opening.
s.h=18;s.beat='evening';s.firstWatch.secureGate(1,{reason:'review'});settle();
pose(new Vector3(STATION.southGate.x,STATION.yard,STATION.southGate.z-1.6),s.interact.get('southGate').at);
for(let i=0;i<60;i++)await frame();
assert.equal(s.interact.pick()?.id,'southGate');
const eastBefore=s.doors.gate.map(d=>d.target);
await segment('south-pair',5,t=>{keys.clear();if(t>.6&&t<.6+dt*1.1)taps.add('KeyE');if(t>3&&t<4.35)keys.add('KeyE');},[[0,'secured'],[2,'open'],[4.8,'shut']]);
keys.clear();assert.ok(s.doors.southGate.every(d=>d.target===0)&&s.flags.gateRopes[1].secured,'the routine south-gate close restores its rope');
assert.deepEqual(s.doors.gate.map(d=>d.target),eastBefore);
await GPU.pipelinesReady();await GPU.queue.onSubmittedWorkDone();const validation=await GPU.device.popErrorScope();scopeOpen=false;assert.equal(validation,null,validation?.message);assert.deepEqual(errors,[]);
for(const path of sourcePaths)assert.equal(sourceHash(path),sources[path],'Gate proof source changed during capture: '+path);
writeSheet(join(out,'gate-contact-sheet.png'),images,3);
writeFileSync(join(out,'gate-verification.json'),JSON.stringify({createdAt:new Date().toISOString(),sources,capture:'Actual native WebGPU game renderer, first-person player and Story interactions. Separate staged checkpoints; DOM HUD is not rasterized by this harness. No free camera, added light, capture-only exposure override or replacement model. The gate reveal uses the actual game camera focus and perceptual exposure treatment.',revealSeconds:GATE_REVEAL_SECONDS,leanMetres:GATE_REVEAL_LEAN,recognitionFov:GATE_REVEAL_FOV,maxFocusExposure:GATE_FOCUS_EXPOSURE,autoExposure:{enabled:app.post.autoExposure.enabled.value,snap:app.post.autoExposure.snap.value,base:app.settings.exposure,min:app.post.autoExposure.min.value,max:app.post.autoExposure.max.value},nightLanternLit:s.hand.lit,stagedCheckpoints:['18:00 east gate after contact, first rope task','Later fog watch east balcony, entrance previously secured','18:00 actual south gate opening'],audio:'Silent; user sting remains pending.',width,height,fps,validationErrors:errors,segments,checkpoints:checks},null,2));
writeFileSync(join(out,'index.html'),`<!doctype html><meta charset="utf-8"><title>Physical gate review</title><style>body{background:#111a1d;color:#eee6d6;font:18px/1.5 Georgia;max-width:1100px;margin:30px auto}video,img{max-width:100%}a{color:#d8c294}</style><h1>Physical gate review</h1><p>Actual first-person game captures from three explicit review checkpoints. Silent. No free camera or added lighting.</p>${segments.map(x=>`<h2>${x.name}</h2>${x.movie?`<video controls src="${x.movie}"></video>`:''}`).join('')}<p><a href="gate-verification.json">State and camera verification</a></p><img src="gate-contact-sheet.png">`);

 scopeOpen=false;
 console.log('PASS gate interaction/camera/GPU captures. Inspect the night rail frames for visual readiness.');
 return {out,segments,checkpoints:checks};
 } finally {
  if(scopeOpen)await GPU.device.popErrorScope();
  GPU.device.removeEventListener('uncapturederror',onError);
  app.qs=prior.qs;s.save=prior.save;app.input.down=prior.down;app.input.hit=prior.hit;app.input.consumeLook=prior.look;
  s._restore(prior.snapshot);for(const d of s.moving.doors)updateDoor(d,0);s.gateWork.update();app.player.update=prior.playerUpdate;s.update=prior.storyUpdate;s.arrival.update=prior.arrivalUpdate;app.camera.fov=prior.fov;app.camera.updateProjectionMatrix();s.photography.raised=prior.photoRaised;app.freeCam=prior.freeCam;app.input.enabled=prior.inputEnabled;app.post.outputTexture=prior.output;
 }
}

async function main(){
 await import('../../test/headless.mjs');
 installBrowser({search:'?bench&keeperPreview&noAudio',width:960,height:540,root:resolve('public')});
 await import('../../src/core/BenchSeed.js');
 const {App}=await import('../../src/App.js');
 const {Story}=await import('../../src/story/Story.js');
 const {Bench}=await import('../../src/core/Bench.js');
 const {GPU}=await import('../../src/engine/gpu/GPU.js');
 const {Texture}=await import('../../src/engine/gpu/Texture.js');
 const app=new App();await app.init((p,l)=>{if(l)console.log(`${Math.round(p*100)}% ${l}`);});
 app.engine.stop();new Bench(app).setSize(960,540);
 app.ui={ui:{photoMode:false,toast(){}},update(){}};
 const s=app.story=new Story(app);s.ui.card=s.ui.fade=async()=>{};await s.start();
 const output=new Texture({width:960,height:540,format:GPU.format,usage:['render','copySrc','sample'],label:'Physical gate review'});
 await captureGate({app,s,GPU,output,preview:process.argv.includes('--preview')});
 process.exit(0);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
