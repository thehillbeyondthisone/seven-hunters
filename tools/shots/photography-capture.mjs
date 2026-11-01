import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import jpeg from 'jpeg-js';
import {writePNG,bgraShot,writeSheet} from './png.mjs';
import {readTexture} from '../../src/engine/gpu/Readback.js';
import {Vector3} from '../../src/engine/index.js';
import {photographPixels,PRINT_SIZE} from '../../src/story/Photography.js';
import {hazeDensityForVisibility} from '../../src/post/AirHaze.js';

// One isolated author checkpoint in an already warmed game renderer. This
// never writes a player save or authors equipment/hand transforms.
export async function capturePhotography({app,s=app.story,GPU,output,width=output.width,height=output.height}){
const out=resolve('artifacts/story-review/photography');mkdirSync(out,{recursive:true});
const hashes=Object.fromEntries(['src/story/Photography.js','src/story/LaterWatch.js','src/player/KeeperHands.js','src/world/flannan/KeeperHandPosesModel.js','src/App.js','src/world/flannan/Station.js','src/post/AirHaze.js'].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]));
const incomingSnap=app.post.autoExposure.snap.value;
const errors=[],onError=e=>errors.push(e.error.message);GPU.device.addEventListener('uncapturederror',onError);GPU.device.pushErrorScope('validation');
app.ui={ui:{photoMode:false,toast(){}},update(){}};
s.save=()=>{};s.ui.card=s.ui.fade=s.ui.read=async()=>{};assert.equal(s.ui.open,false,'close reading before photography review');assert.equal(s.cinematic,false,'finish the active cutscene before photography review');app.input.enabled=true;app.freeCam=false;
s.flags.photography={frames:[],wound:true};await s.later.begin('photography');await s.photography.take();await s.later.belongings();
app.player.update=()=>{};s.update=()=>{s._applyClock();s.unpacking.sync();};s.arrival.update=()=>{};
app.input.hit=()=>false;let held=false;app.input.down=code=>held&&code==='KeyE';
s.paused=false;s.signal=false;s.tel=0;s.arrival.group.visible=false;s.hand.carried=false;s.hand.lit=false;
app.seaWeather?.reset();app.haze.density.value=hazeDensityForVisibility(60);app.clouds.coverage.value=.64;
const photo=s.photography,chair=photo.sites[0];app.keeperSafety?.reset();app.player.busy=false;app.player.mode='walk';app.player.grounded=true;app.player.velocity.set(0,0,0);app.player._camY=null;
app.player.position.copy(chair.stand);app.camera.position.copy(chair.stand).add(new Vector3(0,1.62,0));app.camera.lookAt(chair.at);
const direction=chair.at.clone().sub(app.camera.position).normalize();app.player.yaw=Math.atan2(-direction.x,-direction.z);app.player.pitch=Math.asin(direction.y);
app.camera.fov=70;app.camera.updateProjectionMatrix();app.cameraCut();app.post.autoExposure.snap.value=1;
app.post.outputTexture=output;
const captures=[],summary=[];
async function frames(n){for(let i=0;i<n;i++){app.frame(1/60);await GPU.queue.onSubmittedWorkDone();}}
async function shot(name){
 await frames(30);const raw=await readTexture(output),body=new Uint8Array(8+raw.data.byteLength);new Uint32Array(body.buffer,0,2).set([width,height]);body.set(new Uint8Array(raw.data),8);
 const image=bgraShot(Buffer.from(body));writePNG(resolve(out,name+'.png'),width,height,image.rgba);captures.push(image);
 summary.push({name,hands:app.keeperHands.mode,cameraRaised:photo.raised,clock:s.h});console.log('saved',name,app.keeperHands.mode);return image;
}
await frames(1);app.post.autoExposure.snap.value=incomingSnap;
await shot('01-chair-daylight');
assert.ok(photo.toggle());await shot('02-equip-camera');
s.interact.current=s.interact.get('photo-brace');held=true;await shot('03-steady-action');
held=false;photo.ready();s.interact.get('photo-brace').use();
s.interact.current=s.interact.get('photo-chair');held=true;await shot('04-shutter-action');held=false;
assert.ok(photo.expose(chair));const finish=photo.pending;photo.pending=null;
const actual=await shot('05-exposure-no-held-objects');
const pixels=photographPixels(actual.rgba,width,height),encoded=jpeg.encode({width:PRINT_SIZE,height:PRINT_SIZE,data:pixels},76);
await finish('data:image/jpeg;base64,'+encoded.data.toString('base64'));
writePNG(resolve(out,'06-chair-print.png'),PRINT_SIZE,PRINT_SIZE,pixels);
assert.equal(photo.state.frames[0].subject,'chair');assert.equal(photo.state.frames[0].supported,true);
assert.equal(app.player.busy,false);assert.equal(photo.state.wound,false);
s.interact.current=s.interact.get('filmWind');held=true;await shot('07-film-winding');held=false;
photo.ready();s.interact.get('filmWind').use();photo.ready();
assert.ok(photo.toggle());await shot('08-camera-put-away');
s.hand.carried=true;s.hand.lit=true;s.hand.glow=1;await shot('09-lantern-carry');
s.hand.lit=false;await shot('10-lantern-unlit');
const luminances=[];for(let i=0;i<pixels.length;i+=4)luminances.push(pixels[i]);luminances.sort((a,b)=>a-b);
const stats={mean:luminances.reduce((a,b)=>a+b,0)/luminances.length,p10:luminances[Math.floor(luminances.length*.1)],p50:luminances[Math.floor(luminances.length*.5)],p90:luminances[Math.floor(luminances.length*.9)]};
assert.ok(stats.mean>12,'the actual indoor image must have usable visible information');assert.ok(stats.p90-stats.p10>8,'the print must preserve visible tonal separation');
writeSheet(resolve(out,'temporal-review.png'),captures,3);
await GPU.pipelinesReady();await GPU.queue.onSubmittedWorkDone();const validation=await GPU.device.popErrorScope();assert.equal(validation,null,validation?.message);assert.deepEqual(errors,[]);GPU.device.removeEventListener('uncapturederror',onError);
writeFileSync(resolve(out,'verification.json'),JSON.stringify({createdAt:new Date().toISOString(),sources:hashes,runtime:'Actual game renderer, native Dawn/WebGPU, inert browser DOM; no browser input/audio or physical-device claim',clock:s.h,daylight:true,subject:'chair beside journal',position:app.player.position.toArray(),target:chair.at.toArray(),printLuminance:stats,captures:summary,frames:photo.state.frames.map(({image,...rest})=>({...rest,imageBytes:image.length})),validationErrors:errors,history:'The Kodak JAN1900 directions permit indoor time exposures with firm chair/table support. The 2.4-second hold is gameplay input pacing, not a measured film exposure. Scene brightness verifies screen legibility, not photometric reconstruction.',historicalSources:['https://manuals.plus/m/ad159776d5786e3094c8bdc6c3c72eeabcd3de73de75beb3e8b1b8069ac8fd0a_optim.pdf','https://collection.sciencemuseumgroup.org.uk/objects/co8406729/no-1-brownie-box-camera'],visualReview:'The camera support transform and hands are supplied by the live Blender MCP-authored contact data. This capture tool never edits assets or poses; final hand contact closeups are in the separate hands review.'},null,2));
app.post.autoExposure.snap.value=incomingSnap;assert.equal(app.post.autoExposure.snap.value,incomingSnap);
console.log('PASS actual midday chair print, temporal equipment captures, film winding and GPU validation; luminance',stats);
return {out,captures:summary.length,printLuminance:stats};
}
