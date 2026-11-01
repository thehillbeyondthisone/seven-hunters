// Warm native-render hook: compare the exact legacy and corrected beauty
// shaders on the same authored return route, without another App initialization.
// Import captureFog({app,s,GPU,output}) from another native scene review.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Vector3 } from '../../src/engine/index.js';
import { TOWER } from '../../src/world/flannan/Station.js';
import { FrameUniforms } from '../../src/engine/render/Frame.js';
import { createShaderModule, group0ForBlock } from '../../src/engine/gpu/Shader.js';
import { readTexture } from '../../src/engine/gpu/Readback.js';
import { bgraShot, writePNG, writeSheet } from './png.mjs';

export async function captureFog( { app, s, GPU, output, directory = 'artifacts/fog-return-readability' } ) {
 const out=resolve(directory);mkdirSync(out,{recursive:true});
 const width=output.width,height=output.height,images=[],captures=[],errors=[];
 const error=e=>errors.push(e.error.message);GPU.device.addEventListener('uncapturederror',error);GPU.device.pushErrorScope('validation');
 const beauty=app.post._beautyPass;
 assert.ok(beauty?.source.includes('DENSE_SKY_BEGIN'),'The dense sky correction must be loaded before native App initialization.');
 const fixedHandle=beauty.handle;
 const legacySource=beauty.source.replace(/\/\/ DENSE_SKY_BEGIN[\s\S]*?\/\/ DENSE_SKY_END/,'');
 assert.notEqual(legacySource,beauty.source,'The comparison removes only the new dense-sky transport.');
 const module=createShaderModule(legacySource,'legacy dense-fog sky comparison');
 const legacyHandle=GPU.renderPipeline({label:'legacy dense-fog sky comparison',layout:GPU.device.createPipelineLayout({bindGroupLayouts:[group0ForBlock(FrameUniforms,'render').layout,beauty.bindings.layout]}),vertex:{module,entryPoint:'vs'},fragment:{module,entryPoint:'fs',targets:[{format:beauty.colorFormats[0],writeMask:GPUColorWrite.ALL}]},primitive:{topology:'triangle-list'},multisample:{count:1}});
 await GPU.pipelinesReady();
 const old={h:s.h,beat:s.beat,paused:s.paused,next:s.flags.nextWatch,save:s.save,playerUpdate:app.player.update,fov:app.camera.fov,aspect:app.camera.aspect,output:app.post.outputTexture};
 s.save=()=>{};
 try{
  app.post.outputTexture=output;app.post.autoExposure.snap.value=1;
  app.seaWeather?.reset();app.seaDread?.setEnabled(false);
  s.h=35;s.beat='d2rest';s.paused=true;s.signal=false;s.tel=0;
  s.flags.nextWatch={survey:true,fogThought:true,fireLit:true,fogReturned:false};
  s.photography.raised=false;s.hand.carried=false;s.lamp.extinguish();s.lamp.stop();
  app.camera.fov=70;app.camera.aspect=width/height;app.camera.updateProjectionMatrix();
  // The actual Story and renderer still update. Only walking is held at each
  // diagnostic viewpoint, so input cannot move the camera between A/B frames.
  app.player.update=()=>{};
  function view(x,z,target){
   const y=app.terrainData.heightAt(x,z),eye=new Vector3(x,y+1.62,z),d=target.clone().sub(eye),p=app.player;
   p.position.set(x,y,z);p.velocity.set(0,0,0);p.mode='walk';p.grounded=true;p._camY=null;p.yaw=Math.atan2(-d.x,-d.z);p.pitch=Math.atan2(d.y,Math.hypot(d.x,d.z));
   app.camera.position.copy(eye);app.camera.lookAt(target);app.camera.updateMatrixWorld();app.cameraCut();
  }
  function projection(point){const q=point.clone().project(app.camera);return{x:(q.x*.5+.5)*width,y:(.5-q.y*.5)*height};}
  function mean(image,point,r=2){const rgb=[0,0,0];let n=0;for(let y=Math.max(0,Math.round(point.y)-r);y<=Math.min(height-1,Math.round(point.y)+r);y++)for(let x=Math.max(0,Math.round(point.x)-r);x<=Math.min(width-1,Math.round(point.x)+r);x++){const i=(y*width+x)*4;for(let c=0;c<3;c++)rgb[c]+=image.rgba[i+c];n++;}return rgb.map(v=>v/n);}
  function contrast(image){const body=new Vector3(0,TOWER.floor+10,0),right=new Vector3(1,0,0).applyQuaternion(app.camera.quaternion);const center=mean(image,projection(body)),a=mean(image,projection(body.clone().addScaledVector(right,10))),b=mean(image,projection(body.clone().addScaledVector(right,-10)));return center.reduce((sum,v,c)=>sum+Math.abs(v-(a[c]+b[c])*.5),0)/(3*255);}
  function nearRailVariation(image){let sum=0,sq=0,n=0;for(let y=Math.floor(height*.68);y<Math.floor(height*.94);y++)for(let x=Math.floor(width*.36);x<Math.floor(width*.64);x++){const i=(y*width+x)*4,l=(image.rgba[i]*.2126+image.rgba[i+1]*.7152+image.rgba[i+2]*.0722)/255;sum+=l;sq+=l*l;n++;}return Math.sqrt(Math.max(0,sq/n-(sum/n)**2));}
  async function shot(name,legacy){
   beauty.handle=legacy?legacyHandle:fixedHandle;app.cameraCut();
   for(let i=0;i<18;i++){app.frame(0);await GPU.queue.onSubmittedWorkDone();}
   const image=bgraShot(Buffer.concat([Buffer.from(new Uint32Array([width,height]).buffer),Buffer.from((await readTexture(output)).data)]));images.push(image);writePNG(resolve(out,name+'.png'),width,height,image.rgba);
   const row={name,legacy,beat:s.beat,time:s.h,camera:app.camera.position.toArray(),density:app.haze.density.value,shafts:app.haze.shafts.value,seaWeatherActive:!!app.seaWeather?.active,fogReturned:!!s.next.state.fogReturned,towerContrast:contrast(image),nearRailVariation:nearRailVariation(image)};captures.push(row);console.log('fog rendered',name,{towerContrast:row.towerContrast,nearRailVariation:row.nearRailVariation});return{image,row};
  }
  view(-155,44,new Vector3(0,s.station.focal,0));
  const farBefore=await shot('a-legacy-dense-lighthouse',true),farAfter=await shot('b-fixed-dense-lighthouse',false);
  view(-120,29,new Vector3(-109,app.terrainData.heightAt(-109,28.45),28.45));
  const railBefore=await shot('c-legacy-near-tramway',true),railAfter=await shot('d-fixed-near-tramway',false);
  // Same eye position, now looking along the return rather than down at the
  // sleepers: verify the tower no longer supplies a distant silhouette cue.
  view(-120,29,new Vector3(0,s.station.focal,0));
  const returnBefore=await shot('e-legacy-return-bearing',true),returnAfter=await shot('f-fixed-return-bearing',false);
  s.next.state.fogReturned=true;
  view(-155,44,new Vector3(0,s.station.focal,0));
  const clearBefore=await shot('g-legacy-clear-control',true),clearAfter=await shot('h-fixed-clear-control',false);
  let clearDifference=0;for(let i=0;i<clearBefore.image.rgba.length;i+=4)for(let c=0;c<3;c++)clearDifference+=Math.abs(clearBefore.image.rgba[i+c]-clearAfter.image.rgba[i+c]);clearDifference/=width*height*3*255;
  const checks={farTowerSuppressed:farAfter.row.towerContrast<farBefore.row.towerContrast*.3&&farAfter.row.towerContrast<.025,returnTowerSuppressed:returnAfter.row.towerContrast<returnBefore.row.towerContrast*.3&&returnAfter.row.towerContrast<.025,railsReadable:railAfter.row.nearRailVariation>.035&&railAfter.row.nearRailVariation>railBefore.row.nearRailVariation*.55,clearWeatherUnchanged:clearDifference<.012};
  await GPU.queue.onSubmittedWorkDone();const validation=await GPU.device.popErrorScope();if(validation)errors.push(validation.message);
  writeSheet(resolve(out,'comparison-sheet.png'),images,2);
  writeFileSync(resolve(out,'verification.json'),JSON.stringify({checks,clearDifference,captures,validationErrors:errors,scope:'Actual game renderer, same authored scene-eight state and camera. A/B changes only dense sky fog transport; clear-weather control, local rails and distant tower are compared. No historical-weather claim.'},null,2));
  assert.deepEqual(errors,[],'Fog render has no WebGPU validation errors.');
  for(const [name,passed]of Object.entries(checks))assert.equal(passed,true,name);
  console.log('PASS dense fog: tower disappears, local tramway stays readable, clear control unchanged. Evidence:',out);
  return{checks,captures,clearDifference};
 }finally{
  beauty.handle=fixedHandle;app.player.update=old.playerUpdate;s.h=old.h;s.beat=old.beat;s.paused=old.paused;s.flags.nextWatch=old.next;s.save=old.save;app.camera.fov=old.fov;app.camera.aspect=old.aspect;app.camera.updateProjectionMatrix();app.post.outputTexture=old.output;GPU.device.removeEventListener('uncapturederror',error);
 }
}
