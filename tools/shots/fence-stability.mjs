// Native WebGPU regression: sub-pixel ironwork through an eight-phase jitter cycle.
// The same fence, camera and pixel size as the opening view; an isolated sky
// background keeps weather and grass motion out of the measured difference.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import '../../test/headless.mjs';
import { worldHarness } from '../../test/world-harness.mjs';
import { buildYardFence, assembleYardFence } from '../../src/world/flannan/YardFence.js';
import { Material } from '../../src/engine/render/Material.js';
import { setFrameCamera } from '../../src/engine/render/Frame.js';
import { readTexture } from '../../src/engine/gpu/Readback.js';
import { writePNG } from './png.mjs';

const out = resolve('artifacts/fence-stability'); mkdirSync(out,{recursive:true});
const width=1280,height=720;
const h=await worldHarness({width,height});
const {E,GPU,scene,camera}=h;
const errors=[]; GPU.device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
GPU.device.pushErrorScope('validation');
const parts={}, iron={tint:[.012,.013,.013],data:[.63,.035,.55,.5]};
for(const [a,b] of [[-26.965,-13.735],[-10.265,12.965]]) buildYardFence(new E.Matrix4(),parts,a,b,81.35,20.75,iron);
const detailMaterial=new Material({name:'review iron',color:0x1c1d1d,roughness:.65,metalness:.25,uniforms:{maintenance:['f32',1]}});
const group=assembleYardFence(parts,detailMaterial,()=>{});scene.add(group);
const detail=group.children[0],filtered=group.children[1];
const filteredSurface=detailMaterial.surface;
const halton=(n,b)=>{let f=1,v=0;while(n){f/=b;v+=f*(n%b);n=Math.floor(n/b)}return v};
let phase=0;
h.before.push(()=>setFrameCamera(camera,width,height,{jitterX:halton(phase%8+1,2)-.5,jitterY:halton(phase%8+1,3)-.5}));
let pixels;
// worldHarness owns its output, so capture a copy of its final tonemap target.
const {RenderTarget}=await import('../../src/engine/gpu/Texture.js');
const {FullscreenPass}=await import('../../src/engine/render/FullscreenPass.js');
const ldr=new RenderTarget(width,height,{colors:['rgba8unorm'],label:'fence output'});
const tonemap=new FullscreenPass({label:'fence tone',colorFormats:['rgba8unorm'],bindings:{hdr:{texture:()=>h.rt.texture}},code:`fn fragment(in:FSIn)->vec4f{let c=textureLoad(hdr,vec2i(in.pos.xy),0).rgb;let a=c*.6;let t=(a*(2.51*a+.03))/(a*(2.43*a+.59)+.14);return vec4f(linearToSrgb(sat3(t)),1.0);}`});
h.after=()=>tonemap.render({colorViews:[ldr.texture]});
const report={width,height,validationErrors:errors,cases:{}};
for(const close of [false,true]){
  h.setView(close?{pos:[-5,82.2,24],target:[0,82,20.75],fov:62}:{pos:[-46,76.5,48],target:[-15,88,5],fov:62});
  const roi=close?{x:30,y:180,w:850,h:360}:{x:625,y:380,w:360,h:65};
  for(const baseline of [true,false]){
    filtered.visible=!baseline;
    detailMaterial.surface=baseline?'':filteredSurface;
    detailMaterial.transparent=!baseline;detailMaterial.blending=baseline?'none':'normal';detailMaterial.depthWrite=baseline;detailMaterial.needsUpdate=true;
    const frames=[];
    for(phase=0;phase<16;phase++){
      h.renderFrame();await GPU.queue.onSubmittedWorkDone();
      pixels=new Uint8Array((await readTexture(ldr.texture)).data);
      if(phase>=8)frames.push(pixels);
    }
    const name=`${close?'close':'opening'}-${baseline?'baseline':'filtered'}`;
    writePNG(resolve(out,name+'.png'),width,height,pixels);
    let sum=0,n=0;
    for(let f=1;f<frames.length;f++)for(let y=roi.y;y<roi.y+roi.h;y++)for(let x=roi.x;x<roi.x+roi.w;x++)for(let c=0;c<3;c++){
      const k=(y*width+x)*4+c;sum+=Math.abs(frames[f][k]-frames[f-1][k]);n++;
    }
    report.cases[name]={meanJitterDelta8bit:sum/n,roi};
    console.log(name,JSON.stringify(report.cases[name]));
  }
}
await GPU.pipelinesReady();await GPU.queue.onSubmittedWorkDone();
const validation=await GPU.device.popErrorScope();assert.equal(validation,null,validation?.message);assert.deepEqual(errors,[]);
const before=report.cases['opening-baseline'].meanJitterDelta8bit,after=report.cases['opening-filtered'].meanJitterDelta8bit;
report.reduction=1-after/before;
writeFileSync(resolve(out,'native-verification.json'),JSON.stringify(report,null,2));
assert(after<before*.5,'filtered distant fence must cut jitter-induced variation by at least half');
console.log('PASS fence coverage, close/distant shaders, validation; variation reduced '+(report.reduction*100).toFixed(1)+'%.');
process.exit(0);
