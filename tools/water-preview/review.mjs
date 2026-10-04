import '../../test/headless.mjs';
import { create } from 'webgpu';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { installBrowser } from '../shots/browser.mjs';
import { bgraShot, writePNG } from '../shots/png.mjs';
import { GPU } from '../../src/engine/webgpu.js';
import { readTexture } from '../../src/engine/gpu/Readback.js';
import { installCoastalPreview, preparePreviewScene } from './CoastalPreview.js';
const width=960,height=540,out=resolve('artifacts/water-preview'),images=new Map();mkdirSync(out,{recursive:true});
installBrowser({search:'?bench&nostory&noAudio&noCliffSurf&adapt',width,height,root:resolve('public'),onPost:async(url,body)=>{
 const name=decodeURIComponent(url.split('/').pop()).replace(/\.bgra$/,''),shot=bgraShot(Buffer.from(body.buffer,body.byteOffset,body.byteLength));images.set(name,shot);writePNG(out+'/'+name+'.png',shot.w,shot.h,shot.rgba);
}});
Object.defineProperty(globalThis,'navigator',{value:{gpu:create(['backend=d3d12','adapter=NVIDIA GeForce RTX 4060'])},configurable:true});
await import('../../src/core/BenchSeed.js');const { App }=await import('../../src/App.js'),{ Bench }=await import('../../src/core/Bench.js');
const errors=[],init=GPU.init.bind(GPU);GPU.init=async options=>{const r=await init(options);GPU.device.addEventListener('uncapturederror',e=>errors.push(e.error.message));GPU.device.pushErrorScope('validation');return r;};
const app=new App();installCoastalPreview(app);let stage='';await app.init((p,t)=>{if(stage!==t)console.log(Math.round(p*100)+'% '+(stage=t));});
preparePreviewScene(app);const coast=app.coastalPreview,bench=new Bench(app);app.post.autoExposure.snap.value=1;
console.log('Warming incoming swell');await coast.warm(55);coast.running=false;
// Matched camera and wave clock. No simulation steps during these screenshots.
for(const [mode,name] of [[0,'current'],[1,'free'],[2,'solved']]){coast.mode(mode);await bench.shots(['fWestWatch','fCliffGale'],{tag:name,frames:32,dt:0,width,height,time:12.4});}
console.log('Capturing moving comparison');bench.pose('fCliffGale');coast.mode(2);coast.running=true;
const motion={free:[],solved:[]};
for(let frame=0;frame<80;frame++){
 // 0.15 s is below the preview's timestep clamp; five-ish samples per second.
 coast.mode(2);app.frame(.15);await GPU.queue.onSubmittedWorkDone();
 for(const [mode,name] of [[1,'free'],[2,'solved']]){
  coast.mode(mode);
  // Reset history on mode changes, then settle it at the unchanged wave time.
  for(let warm=0;warm<4;warm++)app.frame(0);
  await GPU.queue.onSubmittedWorkDone();
  const current=GPU.context.getCurrentTexture();
  const capture=await readTexture({getGPU:()=>current,width,height,format:GPU.format});
  const data=new Uint8Array(capture.data);
  const rgba=Buffer.alloc(width*height*4);for(let i=0;i<rgba.length;i+=4){rgba[i]=data[i+2];rgba[i+1]=data[i+1];rgba[i+2]=data[i];rgba[i+3]=255;}
  const file=`${name}-${String(frame).padStart(3,'0')}.png`;writePNG(out+'/'+file,width,height,rgba);motion[name].push(file);
 }
 if(frame%20===0)console.log('motion frame',frame);
}
// Per-frame full-scene GPU times, alternating runs at unchanged output size.
const perf=[];
for(const enabled of [false,true,true,false]){
 coast.solveEnabled=enabled;coast.mode(enabled?2:0);coast.running=true;
 await bench.run({views:['fWestWatch'],warm:32,frames:100,dt:1/60,top:8});
 const times=bench.frames.map(f=>f.gpu).sort((a,b)=>a-b);assert.equal(times.length,100);
 perf.push({enabled,count:times.length,median:times[50],p95:times[94],mean:times.reduce((a,b)=>a+b,0)/times.length,coastSolveMeanMs:bench.frames.reduce((a,f)=>a+(f.passes.get('Coastal dispersive solve')||0),0)/times.length});
 console.log('full scene',JSON.stringify(perf.at(-1)));
}
coast.solveEnabled=true;const state=await coast.read();assert.ok(state.every(Number.isFinite));
const error=await GPU.device.popErrorScope();assert.equal(error,null,error?.message);assert.deepEqual(errors,[]);
const result={width,height,adapter:GPU.adapter.info.description,incomingConfig:coast.config,motionFrames:80,motionDt:.15,perf,validationErrors:[],conditions:'Foam and spray disabled in all modes. Diagnostic incoming swell, not full FFT boundary coupling. Full-scene timings exclude the map readback.'};
writeFileSync(out+'/render-result.json',JSON.stringify(result,null,2));
writeFileSync(out+'/index.html',`<!doctype html><meta charset="utf-8"><title>West landing water comparison</title><style>body{margin:24px;background:#152024;color:#e7eddf;font:16px system-ui}h1{font:30px Georgia}img{width:100%}.row{display:grid;grid-template-columns:1fr 1fr;gap:16px}button{font:inherit;padding:8px}p{max-width:900px}</style><h1>West landing · water experiment</h1><p>Identical incoming swell, camera and clock. Free swell ignores rocks; the solver responds to the coast. Foam and spray are off. Fixed shoreline, linear waves; no overturning or climbing sheets.</p><button id="pause">Pause</button> <a href="../../water-preview.html" style="color:#e0d0ab">Open live preview</a><div class="row"><figure><figcaption>Free swell</figcaption><img id="free"></figure><figure><figcaption>Coastal solver</figcaption><img id="solved"></figure></div><p id="time"></p><h2>Current water / coastal solver</h2><div class="row"><img src="current-fWestWatch.png"><img src="solved-fWestWatch.png"></div><script>const motion=${JSON.stringify(motion)};let frame=0,running=true;function show(){for(const name of ['free','solved'])document.getElementById(name).src=motion[name][frame];document.getElementById('time').textContent=(frame*.15).toFixed(2)+' s into the 12-second recording';}document.getElementById('pause').onclick=e=>{running=!running;e.target.textContent=running?'Pause':'Play';};setInterval(()=>{if(running){frame=(frame+1)%80;show();}},150);show();</script>`);
console.log('PASS full scene coastal render, moving matched comparison and timing');process.exit(0);
