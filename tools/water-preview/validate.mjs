import '../../test/headless.mjs';
import { create } from 'webgpu';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { CoastalModel, waveNumber, fittedOmega, waves } from './CoastalModel.js';
const provider=globalThis.__coastGPU=create(['backend=d3d12','adapter=NVIDIA GeForce RTX 4060']);
const adapter=await provider.requestAdapter(),device=await adapter.requestDevice({requiredFeatures:['timestamp-query']});
const errors=[];device.addEventListener('uncapturederror',e=>errors.push(e.error.message));device.pushErrorScope('validation');
const out='artifacts/water-preview';mkdirSync(out,{recursive:true});const results=[];
async function read(model){const b=device.createBuffer({size:model.state.size,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),e=device.createCommandEncoder();e.copyBufferToBuffer(model.state,0,b,0,b.size);device.queue.submit([e.finish()]);await b.mapAsync(GPUMapMode.READ);const a=new Float32Array(b.getMappedRange().slice(0));b.unmap();b.destroy();return a;}
async function steps(model,count,opts={}){for(let i=0;i<count;i+=8){const e=device.createCommandEncoder();for(let j=i;j<Math.min(i+8,count);j++)model.encode(e,opts.dt||1/30,{slot:j-i,...opts});device.queue.submit([e.finish()]);if(i%256===0)await device.queue.onSubmittedWorkDone();}await device.queue.onSubmittedWorkDone();}
function stats(s,depths){let peak=0,dry=0,mass=0,budget=0;for(let i=0;i<depths.length;i++){peak=Math.max(peak,Math.abs(s[i*4]));if(depths[i]<.05)dry=Math.max(dry,...s.subarray(i*4,i*4+3).map(Math.abs));mass+=s[i*4];budget+=s[i*4+3];}return{finite:s.every(Number.isFinite),peak,dry,mass,budget};}
const check=(name,data)=>{results.push({name,passed:true,...data});console.log('PASS',name,JSON.stringify(data));};
// Measure moving wave phase, rather than accepting the continuous fit alone.
for(const depth of [9,27,35,51])for(const period of [9,14]){
 const n=64,k=waveNumber(depth,period),cell=4*Math.PI/(k*n),d=new Float32Array(n*n).fill(depth);
 const m=new CoastalModel(device,{n,cell,depths:d,periodic:true,sponge:0,iterations:64});
 const K=2*Math.sin(k*cell/2)/cell,omega=fittedOmega(depth,k,cell),p=new Float32Array(n*n),s=new Float32Array(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=y*n+x;s[i*4]=.1*Math.cos(k*(x+.5)*cell);s[i*4+1]=.1*omega/(depth*K)*Math.cos(k*(x+1)*cell);p[i]=s[i*4]/(1+.4*(depth*K)**2);}
 m.reset(s,p);let prev=0,phase=0;const samples=[];
 for(let j=0;j<48;j++){
  await steps(m,15,{forced:false,sponge:0});const a=await read(m);let real=0,imag=0;
  for(let x=0;x<n;x++){real+=a[x*4]*Math.cos(k*(x+.5)*cell);imag+=a[x*4]*Math.sin(k*(x+.5)*cell);}
  const ph=Math.atan2(imag,real);let delta=ph-prev;while(delta>Math.PI)delta-=2*Math.PI;while(delta< -Math.PI)delta+=2*Math.PI;phase+=delta;prev=ph;samples.push([m.time,phase,Math.hypot(real,imag)]);
 }
 const meanT=samples.reduce((v,a)=>v+a[0],0)/samples.length,meanP=samples.reduce((v,a)=>v+a[1],0)/samples.length;
 const measured=samples.reduce((v,a)=>v+(a[0]-meanT)*(a[1]-meanP),0)/samples.reduce((v,a)=>v+(a[0]-meanT)**2,0);
 const error=measured/(2*Math.PI/period)-1,amplitudeRatio=samples.at(-1)[2]/samples[0][2];
 assert.ok(Math.abs(error)<.05,`speed ${depth}m ${period}s error ${error}`);assert.ok(amplitudeRatio>.85&&amplitudeRatio<1.15);
 check('moving-wave dispersion',{depth,period,cell,measuredSpeedError:error,amplitudeRatio});m.destroy();
}
{
 const n=64,d=Float32Array.from({length:n*n},(_,i)=>i%n<18?0:2+28*(i%n)/n),m=new CoastalModel(device,{n,cell:4,depths:d});
 await steps(m,300,{forced:false,sponge:0});const st=stats(await read(m),d);assert.equal(st.peak,0);assert.equal(st.dry,0);check('variable-depth still water',st);m.destroy();
}
// A travelling, broad positive pulse hits a Neumann wall, then flows outward.
{
 const n=128,cell=3,wall=16,depth=12,d=Float32Array.from({length:n*n},(_,i)=>i%n<wall?0:depth),s=new Float32Array(n*n*4),m=new CoastalModel(device,{n,cell,depths:d,sponge:0});
 for(let y=0;y<n;y++)for(let x=wall;x<n;x++){const i=y*n+x,h=.2*Math.exp(-1*((x*cell-180)/35)**2);s[i*4]=h;s[i*4+1]=-Math.sqrt(9.81/depth)*.2*Math.exp(-1*(((x+.5)*cell-180)/35)**2);}
 m.reset(s);let crest=0,outward=0,initial=stats(s,d).mass;
 for(let j=0;j<50;j++){await steps(m,20,{forced:false,sponge:0});const a=await read(m);crest=Math.max(crest,a[wall*4]);if(m.time>18)outward=Math.max(outward,a[40*4+1]);}
 const st=stats(await read(m),d),drift=Math.abs(st.mass-initial)/Math.abs(initial);
 assert.ok(crest>.25&&outward>.03);assert.ok(st.dry===0&&drift<1e-5&&st.finite);check('wall reflection and outward flow',{crest,outward,relativeMassDrift:drift,...st});m.destroy();
}
// Open-water pulse absorption: no source. Compare against a closed tank.
{
 const n=96,cell=4,depth=27,d=new Float32Array(n*n).fill(depth),s=new Float32Array(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=y*n+x,h=.1*Math.exp(-1*((x*cell-200)/40)**2);s[i*4]=h;s[i*4+1]=Math.sqrt(9.81/depth)*h;}
 const peaks=[];
 for(const sponge of [96,0]){const m=new CoastalModel(device,{n,cell,depths:d,sponge});m.reset(s);await steps(m,1800,{forced:false,sponge});const a=await read(m);let peak=0;for(let y=24;y<72;y++)for(let x=24;x<72;x++)peak=Math.max(peak,Math.abs(a[(y*n+x)*4]));peaks.push(peak);m.destroy();}
 const fraction=peaks[0]/peaks[1];assert.ok(fraction<.15);check('open boundary pulse absorption',{remainingInteriorPeak:peaks[0],closedInteriorPeak:peaks[1],fraction});
}
// Actual reconstructed patch, with source/sink accounting and mixed swell.
{
 const patch=JSON.parse(readFileSync(out+'/depths.json')),n=patch.n,cell=patch.cell;
 const d=new Float32Array(patch.depths),m=new CoastalModel(device,{n,cell,depths:d,sponge:96});m.waveSet=waves(14,.3,2,true);
 await steps(m,9000);const st=stats(await read(m),d),budgetError=Math.abs(st.mass-st.budget)/Math.max(1,Math.abs(st.budget));
 assert.ok(st.finite&&st.dry===0&&st.peak<12&&budgetError<1e-4);check('five-minute forced reconstructed coast',{...st,relativeSourceBudgetError:budgetError,seconds:m.time});
 m.reset();await steps(m,90,{dt:1/60});const reset=stats(await read(m),d);assert.ok(reset.finite&&reset.dry===0);check('reset and changed timestep',reset);
 const states=[];
 for(const angle of [-.4,.4]){m.reset();m.waveSet=waves(9,angle,1,false);await steps(m,1800);const a=await read(m),st=stats(a,d);assert.ok(st.finite&&st.dry===0);states.push(a);}
 let delta=0;for(let i=0;i<d.length;i++)delta+=(states[0][i*4]-states[1][i*4])**2;
 const rms=Math.sqrt(delta/d.length);assert.ok(rms>.1);check('regular waves and changed approach direction',{rmsHeightDifference:rms,secondsPerDirection:60});m.destroy();
}
{
 const n=192,d=new Float32Array(n*n).fill(35),m=new CoastalModel(device,{n,cell:3,depths:d}),query=device.createQuerySet({type:'timestamp',count:40});
 await steps(m,60);
 const resolve=device.createBuffer({size:320,usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC}),readback=device.createBuffer({size:320,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
 for(let b=0;b<20;b++){const e=device.createCommandEncoder();m.encode(e,1/30,{timestampWrites:{querySet:query,beginningOfPassWriteIndex:b*2,endOfPassWriteIndex:b*2+1}});device.queue.submit([e.finish()]);}
 const e=device.createCommandEncoder();e.resolveQuerySet(query,0,40,resolve,0);e.copyBufferToBuffer(resolve,0,readback,0,320);device.queue.submit([e.finish()]);await readback.mapAsync(GPUMapMode.READ);
 const t=new BigUint64Array(readback.getMappedRange().slice(0)),costs=Array.from({length:20},(_,i)=>Number(t[i*2+1]-t[i*2])/1e6).sort((a,b)=>a-b);
 check('compute timing',{grid:n,iterations:m.iterations,solveHz:30,medianMs:costs[10],p95Ms:costs[18],note:'per solve, not per rendered frame'});readback.unmap();query.destroy();resolve.destroy();readback.destroy();m.destroy();
}
assert.equal(await device.popErrorScope(),null);assert.deepEqual(errors,[]);
writeFileSync(out+'/validation.json',JSON.stringify({adapter:'NVIDIA GeForce RTX 4060',description:adapter.info.description,results,validationErrors:errors},null,2));console.log('All isolated coastal checks passed');process.exit(0);
