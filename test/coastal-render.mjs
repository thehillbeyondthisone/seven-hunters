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
const output=new StorageBuffer({label:'coastParity',count:8,type:'vec4f',data:new Float32Array(32)});
const probe=new ComputeKernel({name:'coastParity',modules:[coast.module],bindings:{samples:{storage:output,access:'read_write'}},workgroupSize:[8,1,1],code:'@compute @workgroup_size(8) fn main(@builtin(global_invocation_id) id:vec3u){let x=-80.0+f32(id.x)*5.0;samples[id.x]=coastalSample(vec2f(x,1.0));}'});
const target=new RenderTarget(240,160,{colors:['rgba16float','rgba16float','rgba8unorm'],depth:'depth32float'}),renderer=new MeshRenderer();
const camera=new E.PerspectiveCamera(65,1.5,.1,1000);camera.position.set(-85,10,25);camera.lookAt(-60,3,0);
const shadows=new SunShadows();
G.sunColor.value.setRGB(1,1,1);G.skyIrradiance.value.setRGB(.3,.4,.5);
for(const time of [3,15,58]){
	coast.load({time,strength:1.5,rogue:0});GPU.beginFrame();probe.dispatch(1);setFrameCamera(camera,240,160);
	shadows.render(scene,renderer,shadows.update(camera,G.sunDir.value));
	renderer.render(scene,{camera,kind:'main',colorViews:target.textures.map(t=>t.view()),colorFormats:target.formats,clearColors:[[.05,.1,.12,1],[0,0,0,0],[0,0,0,0]],depthView:target.depthTexture.view(),depthFormat:'depth32float',clearDepth:0});
	GPU.submit();await GPU.pipelinesReady();await GPU.queue.onSubmittedWorkDone();
	const read=GPU.device.createBuffer({size:128,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});const enc=GPU.device.createCommandEncoder();enc.copyBufferToBuffer(output.getGPU(),0,read,0,128);GPU.queue.submit([enc.finish()]);await read.mapAsync(GPUMapMode.READ);const values=new Float32Array(read.getMappedRange().slice(0));read.unmap();read.destroy();
	for(let i=0;i<8;i++){const q=coast.sample({x:-80+i*5,z:1});assert.ok(Math.abs(values[i*4]-q.height)<.0001,'CPU movement and GPU water heights agree');assert.ok(Math.abs(values[i*4+1]-q.flowX)<.0001,'CPU and GPU drainage agree');}
}
await GPU.pipelinesReady();assert.equal(await GPU.device.popErrorScope(),null);assert.deepEqual(errors,[]);
console.log('PASS native WebGPU landing sheets and CPU/GPU height, flow and phase parity.');process.exit(0);
