import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GPU as DefaultGPU } from '../../src/engine/gpu/GPU.js';
import { readTexture } from '../../src/engine/gpu/Readback.js';
import { Vector3 } from '../../src/engine/index.js';
import { TOWER,ROOM } from '../../src/world/flannan/Station.js';
import { hazeDensityForVisibility } from '../../src/post/AirHaze.js';
import { KEEPER_HAND_POSES } from '../../src/world/flannan/KeeperHandPosesModel.js';
import { writePNG,bgraShot,writeSheet } from './png.mjs';

// Reuse the review coordinator's initialized App and output texture. This
// creates no application, server, browser, save, or GPU adapter of its own.
export async function captureKeeperHands({app,story=app.story,s=story,GPU=DefaultGPU,output=app.post.outputTexture,out=resolve('artifacts/keeper-hands-review/final'),tableOnly=false}={}) {
 mkdirSync(out,{recursive:true});
 const previous={playerUpdate:app.player.update,storyUpdate:s.update,arrivalUpdate:s.arrival.update,inputDown:app.input.down,output:app.post.outputTexture,freeCam:app.freeCam,exposureSnap:app.post.autoExposure?.snap?.value};
 const errors=[],onError=event=>errors.push(event.error.message);
 GPU.device.addEventListener('uncapturederror',onError);GPU.device.pushErrorScope('validation');
 let scopeOpen=true;
 const width=output.width,height=output.height,F=TOWER.floor,chair=new Vector3(-6.5,F+.65,ROOM.z0+1),views=[],images=[];
 let held=false;
 const pose=(position,at,fov=65)=>{
  app.camera.position.copy(position);app.camera.lookAt(at);app.camera.fov=fov;app.camera.updateProjectionMatrix();
  app.player.position.copy(position).add(new Vector3(0,-1.62,0));app.player.velocity.set(0,0,0);app.player.grounded=true;app.player.mode='walk';
  const direction=at.clone().sub(position).normalize();app.player.yaw=Math.atan2(-direction.x,-direction.z);app.player.pitch=Math.asin(direction.y);app.player._camY=null;
  app.camera.updateMatrixWorld(true);app.cameraCut?.();if(app.post.autoExposure?.snap)app.post.autoExposure.snap.value=1;
 };
 const capture=async(name,stage,frames=16)=>{
  stage();
  for(let i=0;i<frames;i++){app.frame(1/60);await GPU.queue.onSubmittedWorkDone();}
  if(tableOnly&&!['08c-camera-table-contact-close','09-camera-table-shutter'].includes(name))return;
  const raw=await readTexture(output),body=new Uint8Array(8+raw.data.byteLength);new Uint32Array(body.buffer,0,2).set([width,height]);body.set(new Uint8Array(raw.data),8);
  const pixels=bgraShot(Buffer.from(body));writePNG(resolve(out,name+'.png'),width,height,pixels.rgba);images.push(pixels);
  const hands=app.keeperHands;
  const eyeInverse=app.camera.matrixWorld.clone().invert(),sleeveEnds=hands.hands.map(hand=>hand.sleeve.localToWorld(new Vector3(0,KEEPER_HAND_POSES.attachments.forearm.length,0)).applyMatrix4(eyeInverse).toArray());
  views.push({view:name,frames,mode:hands.mode,poses:hands.hands.map(hand=>hand.pose),cameraRaised:s.photography.raised,lanternCarried:s.hand.carried,body:hands.cameraRoot.position.toArray(),physicalLens:hands.photographyView?.position.toArray()||null,sleeveEndsInEyeSpace:sleeveEnds});
  console.log('hands',name,hands.mode);
 };
 try{
  app.post.outputTexture=output;app.player.update=()=>{};app.input.down=()=>held;app.freeCam=false;
  s.arrival.update=()=>{};s.arrival.group.visible=false;s.paused=false;s.signal=false;s.tel=0;s.flags.landed=true;
  s.keeper?.cutscene?.close?.();s.keeper?.firstLight?.close?.();s.firstWatch?.closeReveal?.();s.storm?.cutscene?.close?.();s.next?.smoke?.close?.();
  if(s.cutsceneReview?.active)s.cutsceneReview.finish();
  if(s.islandReveal?.active)s.islandReveal.finish();
  s.photography.restoreRenderView?.();s.photography.pending=null;s.photography.capturing=false;s.photography.captureView=null;
  s.h=225.5;s.beat='lw-photos';s.flags.photography={taken:true,frames:[],wound:true,tutorial:{braced:false}};
  s.flags.laterWatch={...s.flags.laterWatch,packed:false,ashore:false};
  s.flags.unpacking={stage:4,examined:true};s.unpacking.sync();
  if(s.moving.unpacking?.brownieOnDesk)s.moving.unpacking.brownieOnDesk.visible=false;
  app.qs.delete('morningPreview');
  s.update=()=>{s._applyClock();if(app.haze)app.haze.density.value=hazeDensityForVisibility(60);};
  await capture('04-lantern-in-hand',()=>{s.photography.raised=false;s.hand.carried=s.hand.lit=true;s.hand.glow=1;s.hand.resetMotion();s.interact.current=null;held=false;pose(new Vector3(-4.1,F+1.62,3),new Vector3(-4.1,F+.72,2),68);});
  await capture('05-brownie-in-hand',()=>{s.photography.raised=true;s.hand.lit=false;pose(new Vector3(-4.25,F+1.62,3.5),chair);});
  await capture('06-winding-camera',()=>{held=true;s.interact.current={id:'filmWind'};});
  await capture('07-camera-shutter',()=>{s.interact.current={id:'photo-chair'};});
  await capture('08-camera-table-approach',()=>{held=false;s.interact.current=null;s.photography.tutorial.braced=true;},2);
  await capture('08b-camera-table-supported',()=>{},18);
  await capture('08c-camera-table-contact-close',()=>{const p=KEEPER_HAND_POSES.attachments.braced.tablePosition;pose(new Vector3(-4.25,F+1.62,3.5),new Vector3(p[0],F+p[1]+.04,p[2]),64);});
  await capture('09-camera-table-shutter',()=>{held=true;s.interact.current={id:'photo-chair'};});
  await capture('10-camera-put-away',()=>{held=false;s.photography.raised=false;s.hand.carried=false;s.interact.current=null;},2);
  await capture('11-lantern-pickup',()=>{s.hand.carried=s.hand.lit=true;s.hand.glow=1;s.hand.resetMotion();pose(new Vector3(-4.1,F+1.62,3),new Vector3(-4.1,F+.72,2),68);},1);
  await capture('12-lantern-steady',()=>{},18);
  await capture('13-lantern-turn',()=>{pose(new Vector3(-4,F+1.62,3),new Vector3(-3,F+.72,2),68);},8);
  await capture('14-lantern-turn-settle',()=>{},24);
  const ca=TOWER.crankAngle;
  await capture('15-winding-machine-start',()=>{s.photography.raised=false;s.hand.carried=false;s.beat='watch';s.lamp.wind=.3;s.interact.current={id:'crank'};held=true;s.moving.crank.rotation.z=0;pose(new Vector3(Math.cos(ca)*1.7,TOWER.deck+1.62,Math.sin(ca)*1.7),TOWER.crank,65);});
  await capture('16-winding-machine-quarter',()=>{s.moving.crank.rotation.z=-Math.PI/2;});
  await capture('17-winding-machine-half',()=>{s.moving.crank.rotation.z=-Math.PI;});
  if(!tableOnly){
  assert.equal(views.find(view=>view.view==='05-brownie-in-hand').mode,'camera');
  assert.equal(views.find(view=>view.view==='08c-camera-table-contact-close').mode,'camera');
  assert.equal(views.find(view=>view.view==='10-camera-put-away').mode,'hidden');
  assert.equal(views.find(view=>view.view==='11-lantern-pickup').mode,'lantern');
  assert.ok(views.filter(view=>view.view.includes('winding-machine')).every(view=>view.mode==='winding'&&view.poses[1]==='crankGrip'));
  const approach=views.find(view=>view.view==='08-camera-table-approach').body,settled=views.find(view=>view.view==='08b-camera-table-supported').body,at=KEEPER_HAND_POSES.attachments.braced.tablePosition;
  assert.ok(new Vector3(...approach).distanceTo(new Vector3(...settled))>.05,'the intermediate table frame precedes the supported contact');
  assert.ok(new Vector3(...settled).distanceTo(new Vector3(at[0],F+at[1],at[2]))<1e-6,'settled camera rests at the authored supported attachment');
  }else{
   assert.equal(views.length,2);assert.ok(views.every(view=>view.mode==='camera'&&view.sleeveEndsInEyeSpace.every(end=>end[2]>0)),'both upper sleeve ends remain behind the eye in both close views');
  }
  writeSheet(resolve(out,'review.png'),images,3);
  await GPU.pipelinesReady();await GPU.queue.onSubmittedWorkDone();const validation=await GPU.device.popErrorScope();scopeOpen=false;
  assert.equal(validation,null,validation?.message);assert.deepEqual(errors,[]);
  const verification={scope:tableOnly?'Table camera sleeve continuation - two close views':'Complete equipment hands and winding crank',views,attachment:KEEPER_HAND_POSES.attachments,validationErrors:errors,physicalDeviceTested:false};
  writeFileSync(resolve(out,'verification.json'),JSON.stringify(verification,null,2));
  writeFileSync(resolve(out,'index.html'),`<!doctype html><meta charset="utf-8"><title>Keeper hands temporal review</title><style>body{background:#111c20;color:#eee5d2;font:18px/1.5 Georgia;margin:30px}img{max-width:100%}figure{margin:30px 0}</style><h1>${tableOnly?'Supported camera sleeve continuation':'Camera and lantern hands'}</h1><p>${tableOnly?'Two actual WebGPU close views verify the upper sleeve ends continue behind the eye while the hands retain their supported camera contacts.':`${views.length} actual WebGPU state captures using Blender MCP hand exports: exposure, film winding, supported table placement, pickup, moving carry and three phases of the mandatory winding crank.`} Physical phone and headset testing remains separate.</p>${views.map(({view})=>`<figure><figcaption>${view.replaceAll('-',' ')}</figcaption><img src="${view}.png"></figure>`).join('')}`);
  return verification;
 }finally{
  if(scopeOpen)await GPU.device.popErrorScope();
  app.player.update=previous.playerUpdate;s.update=previous.storyUpdate;s.arrival.update=previous.arrivalUpdate;app.input.down=previous.inputDown;app.post.outputTexture=previous.output;app.freeCam=previous.freeCam;
  if(previous.exposureSnap!==undefined)app.post.autoExposure.snap.value=previous.exposureSnap;
  GPU.device.removeEventListener('uncapturederror',onError);
 }
}
export async function captureTableSleeveFix(options={}) {return captureKeeperHands({...options,tableOnly:true,out:options.out||resolve('artifacts/keeper-hands-review/table-sleeve-final')});}
