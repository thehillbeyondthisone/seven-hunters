import './headless.mjs';
import assert from 'node:assert/strict';
import { GPU } from '../src/engine/gpu/GPU.js';
import { ShaderModule, StorageBuffer, ComputeKernel } from '../src/engine/webgpu.js';
import { RenderTarget } from '../src/engine/gpu/Texture.js';
import { MeshRenderer } from '../src/engine/render/MeshRenderer.js';
import { SunShadows } from '../src/engine/render/Shadows.js';
import { setFrameCamera, G } from '../src/engine/render/Frame.js';
import { CoastalSurge } from '../src/ocean/CoastalSurge.js';
import * as E from '../src/engine/index.js';

await GPU.init({headless:true});GPU.syncPipelines=true;
const errors=[];GPU.device.addEventListener('uncapturederror',e=>errors.push(e.error.message));GPU.device.pushErrorScope('validation');
const terrain={landing:name=>({stage:{x:name==='east'?60:-60,z:0,y:3.2},dir:[name==='east'?1:-1,0]})};
const terrainGPU={module:new ShaderModule({name:'coastalTestTerrain',code:'fn terrainHeightAt(p:vec2f)->f32{return 0.0;}'})};
const scene=new E.Scene(),coast=new CoastalSurge({scene,terrain,terrainGPU});
// Both coasts, from the dry upper flight to the broad offshore footprint and
// across its shoulders: probe where the rogue field differs from ordinary sets.
const alongs=[-42,-24,-6,12,30,60,90,130],acrosses=[0,5,18,36];
const points=coast.sites.flatMap(s=>acrosses.flatMap(across=>alongs.map(along=>({x:s.x+s.dx*along-s.dz*across,z:s.z+s.dz*along+s.dx*across}))));
const output=new StorageBuffer({label:'coastParity',count:points.length,type:'vec4f',data:new Float32Array(points.length*4)});
const shaderPoints=points.map(p=>`vec2f(${p.x.toFixed(1)},${p.z.toFixed(1)})`).join(',');
const probe=new ComputeKernel({name:'coastParity',modules:[coast.module],bindings:{samples:{storage:output,access:'read_write'}},workgroupSize:[8,1,1],code:`@compute @workgroup_size(8) fn main(@builtin(global_invocation_id) id:vec3u){let points=array<vec2f,${points.length}>(${shaderPoints});samples[id.x]=coastalSample(points[id.x]);}`});
const target=new RenderTarget(240,160,{colors:['rgba16float','rgba16float','rgba8unorm'],depth:'depth32float'}),renderer=new MeshRenderer();
const camera=new E.PerspectiveCamera(65,1.5,.1,1000);camera.position.set(-85,10,25);camera.lookAt(-60,3,0);
const shadows=new SunShadows();
G.sunColor.value.setRGB(1,1,1);G.skyIrradiance.value.setRGB(.3,.4,.5);
for(const rogue of [0,24,48])for(const time of [3,15,58]){
	coast.load({time,strength:1.5,rogue});GPU.beginFrame();probe.dispatch(points.length/8);setFrameCamera(camera,240,160);
	shadows.render(scene,renderer,shadows.update(camera,G.sunDir.value));
	renderer.render(scene,{camera,kind:'main',colorViews:target.textures.map(t=>t.view()),colorFormats:target.formats,clearColors:[[.05,.1,.12,1],[0,0,0,0],[0,0,0,0]],depthView:target.depthTexture.view(),depthFormat:'depth32float',clearDepth:0});
	GPU.submit();await GPU.pipelinesReady();await GPU.queue.onSubmittedWorkDone();
	const bytes=points.length*16,read=GPU.device.createBuffer({size:bytes,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});const enc=GPU.device.createCommandEncoder();enc.copyBufferToBuffer(output.getGPU(),0,read,0,bytes);GPU.queue.submit([enc.finish()]);await read.mapAsync(GPUMapMode.READ);const values=new Float32Array(read.getMappedRange().slice(0));read.unmap();read.destroy();
	for(let i=0;i<points.length;i++){const q=coast.sample(points[i]);assert.ok(Math.abs(values[i*4]-q.height)<.0001,`CPU movement and GPU water heights agree, rogue=${rogue}, point=${i}`);assert.ok(Math.abs(values[i*4+1]-q.flowX)<.0001,'CPU and GPU drainage agree');assert.ok(Math.abs(values[i*4+3]-q.foam)<.0001,'CPU and GPU foam footprint agree');}
}
const west=coast.sites[1];let offshorePeak=0,runupPeak=0,upperPeak=0;
for(let time=0;time<70;time+=.05){
	const at=along=>({x:west.x+west.dx*along,z:west.z+west.dz*along});
	for(const along of [0,12,30,60,90])offshorePeak=Math.max(offshorePeak,coast.sample(at(along),{time,strength:1.5,rogue:48}).height);
	runupPeak=Math.max(runupPeak,coast.sample(at(-24),{time,strength:1.5,rogue:48}).height);
	upperPeak=Math.max(upperPeak,coast.sample(at(-38),{time,strength:1.5,rogue:48}).height);
}
assert.ok(offshorePeak>8&&offshorePeak<12.5,'the arriving rogue is a broad sea, not a 48 m wall');
assert.ok(runupPeak>26&&runupPeak<36,'the sea focuses into platform-height run-up');
assert.ok(upperPeak<33,'the run-up dissipates below the safe upper flight');
await GPU.pipelinesReady();assert.equal(await GPU.device.popErrorScope(),null);assert.deepEqual(errors,[]);
console.log('PASS native WebGPU landing sheets and CPU/GPU normal/rogue height, flow and foam parity across both coastlines.');process.exit(0);
