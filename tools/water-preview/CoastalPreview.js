import { GPU, Texture, ShaderModule, UniformBlock } from '../../src/engine/webgpu.js';
import { Vector4 } from '../../src/engine/index.js';
import { WaterSurface } from '../../src/ocean/WaterSurface.js';
import { G as worldTime } from '../../src/core/Globals.js';
import { CoastalModel, waves } from './CoastalModel.js';

// Installed only by water-preview.html or its local review tool. The normal entry
// point never imports this file. Hooks are scoped to this preview's App instance.
export function installCoastalPreview(app, {n = 192, cell = 3, iterations = 64} = {}) {
 const original = WaterSurface.prototype._buildModule;
 WaterSurface.prototype._buildModule = function () {
  const module = original.call(this);
  if (this !== app.surface) return module;
  const coast = app.coastalPreview = new CoastalPreview(app, {n,cell,iterations});
  module.deps.push(coast.module);
  // Replace the total surface, rather than adding another incoming wave on top.
  const marker = '\n\tvar o: WaterSurfaceVertex;';
  if (!module.code.includes(marker)) throw new Error('Water preview vertex hook moved');
  module.code = module.code.replace(marker, /* wgsl */`
 if (coast.mode > 0.5) {
  let cs=coastSurface(worldXZ);
  total=vec3f(0.0,cs.x,0.0); y=frame.seaLevel+cs.x;
  if(depth<=0.05){y=min(y,ground-0.1);}
  shoreN=vec3f(0.0,1.0,0.0); shoreFoam=0.0; surfMask=vec2f(0.0); swash=0.0; foam=0.0;
 }
` + marker);
  const fragMarker = '\n\t// whitecaps:';
  if (!module.code.includes(fragMarker)) throw new Error('Water preview fragment hook moved');
  module.code = module.code.replace(fragMarker, /* wgsl */`
 if(coast.mode>0.5){let cs=coastSurface(lagXZ);slopes=cs.yz+slopes*0.18;normal=normalize(vec3f(-slopes.x,1.0,-slopes.y));}
` + fragMarker);
  return module;
 };
 return () => { WaterSurface.prototype._buildModule = original; };
}
export class CoastalPreview {
 constructor(app, {n,cell,iterations}) {
  this.app=app;this.n=n;this.cell=cell;this.size=n*cell;this.accumulator=0;this.running=true;this.solveEnabled=true;
  const l=app.terrainData.landing('west');this.landing=l;this.along=-80;this.across=-this.size/2;
  const [dx,dz]=l.dir, depth=new Float32Array(n*n);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
   const a=this.along+(x+.5)*cell,b=this.across+(y+.5)*cell;
   const h=app.terrainData.heightAt(l.stage.x+dx*a-dz*b,l.stage.z+dz*a+dx*b);
   depth[y*n+x]=h<-.05?-h:0;
  }
  this.texture=new Texture({label:'coastal surface preview',width:n,height:n,format:'rgba16float',usage:['sample','storage','copySrc']});
  this.model=new CoastalModel(GPU.device,{n,cell,depths:depth,texture:this.texture.getGPU(),iterations});
  this.params=new UniformBlock('CoastPreviewParams',{
   stage:['vec4f',new Vector4(l.stage.x,l.stage.z,dx,dz)],domain:['vec4f',new Vector4(this.along,this.across,this.size,cell)],
   clock:['f32',0],mode:['f32',2],
   wave0:['vec4f',new Vector4()],wave1:['vec4f',new Vector4()],wave2:['vec4f',new Vector4()],
   extra0:['vec4f',new Vector4()],extra1:['vec4f',new Vector4()],extra2:['vec4f',new Vector4()]
  });
  this.module=new ShaderModule({name:'coastPreview',uniforms:this.params,uniformName:'coast',bindings:{coastDisplay:{texture:this.texture}},code:/* wgsl */`
fn coastGrid(p:vec2f)->vec2f{let r=p-coast.stage.xy;let d=coast.stage.zw;return vec2f(dot(r,d),dot(r,vec2f(-d.y,d.x)))-coast.domain.xy;}
fn coastIncident(p:vec2f)->vec4f{
 let ws=array<vec4f,3>(coast.wave0,coast.wave1,coast.wave2);let es=array<vec4f,3>(coast.extra0,coast.extra1,coast.extra2);
 var o=vec4f(0.0);for(var i=0u;i<3u;i++){let w=ws[i];let ph=dot(w.xy,p)-w.z*coast.clock+es[i].x;o+=vec4f(w.w*cos(ph),-w.xy*w.w*sin(ph),0.0);}
 return o*smoothstep(0.0,8.0,coast.clock);
}
fn coastSurface(p:vec2f)->vec4f{
 let g=coastGrid(p);let d=coast.stage.zw;var incident=coastIncident(g);
 var s=incident;
 if(coast.mode>1.5){
  let edge=min(min(g.x,g.y),min(coast.domain.z-g.x,coast.domain.z-g.y));let blend=smoothstep(24.0,96.0,edge);
  let solved=textureSampleLevel(coastDisplay,smpLinearClamp,g/coast.domain.z,0.0);
  s=mix(incident,solved,blend);
 }
 let slope=d*s.y+vec2f(-d.y,d.x)*s.z;return vec4f(s.x,slope,s.w);
}
`});
  // Probe the nearest wet cell immediately beside a rock face at the landing.
  let best=Infinity;this.contact=0;
  for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){
   const i=y*n+x;if(depth[i]<.05||![i-1,i+1,i-n,i+n].some(j=>depth[j]<.05))continue;
   const distance=(this.along+(x+.5)*cell)**2+(this.across+(y+.5)*cell)**2;
   if(distance<best){best=distance;this.contact=i;}
  }
  this.configure();
  const update=app.fft.update.bind(app.fft);
  app.fft.update=dt=>{
   // _frame advances the shared clock before this hook. Keep prescribed shore
   // waves paused as well as FFT/coastal waves, while camera movement continues.
   if(!this.running)worldTime.time.value-=dt;
   update(this.running?dt:0);this.update(dt);
  };
 }
 configure({period=14,angle=0,amplitude=0.5,irregular=true}={}) {
  this.config={period,angle,amplitude,irregular};this.model.waveSet=waves(period,angle*Math.PI/180,amplitude,irregular);
  for(let i=0;i<3;i++){
   const w=this.model.waveSet[i]||{kx:0,ky:0,omega:1,amplitude:0,phase:0,flow:0};
   this.params.fields['wave'+i].value.set(w.kx,w.ky,w.omega,w.amplitude);
   this.params.fields['extra'+i].value.set(w.phase,w.flow,0,0);
  }
  this.model.reset();this.accumulator=0;this.params.fields.clock.value=0;
  this.crestCount=0;this.previousContact=0;this.contactRising=false;this.lastContactTime=-1;
 }
 update(dt){
  if(!this.running)return;
  this.accumulator+=Math.min(dt,.15);let slot=0;
  while(this.accumulator>=1/30&&slot<8){
   if(this.solveEnabled)this.model.encode(GPU.getEncoder(),1/30,{slot});else this.model.time+=1/30;
   this.accumulator-=1/30;slot++;
  }
  this.params.fields.clock.value=this.model.time;
 }
 mode(value){
  if(this.params.fields.mode.value!==value)this.app.cameraCut();
  this.params.fields.mode.value=value;
 }
 observe(state){
  const h=state[this.contact*4],flow=Math.hypot(state[this.contact*4+1],state[this.contact*4+2]);
  if(this.model.time!==this.lastContactTime){
   const rising=h>this.previousContact;
   if(this.contactRising&&!rising&&this.previousContact>.25)this.crestCount++;
   this.previousContact=h;this.contactRising=rising;this.lastContactTime=this.model.time;
  }
  return {height:h,flow,crests:this.crestCount};
 }
 async warm(seconds=45){
  const steps=Math.ceil(seconds*30);
  for(let start=0;start<steps;start+=8){
   const enc=GPU.device.createCommandEncoder();
   for(let i=start;i<Math.min(start+8,steps);i++)this.model.encode(enc,1/30,{slot:i-start});
   GPU.queue.submit([enc.finish()]);
   if(start%64===0)await GPU.queue.onSubmittedWorkDone();
  }
  await GPU.queue.onSubmittedWorkDone();this.params.fields.clock.value=this.model.time;
 }
 async read(){
  const b=GPU.device.createBuffer({size:this.n*this.n*16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
  const enc=GPU.device.createCommandEncoder();enc.copyBufferToBuffer(this.model.state,0,b,0,b.size);GPU.queue.submit([enc.finish()]);
  await b.mapAsync(GPUMapMode.READ);const data=new Float32Array(b.getMappedRange().slice(0));b.unmap();b.destroy();return data;
 }
}

export function preparePreviewScene(app){
 app.settings.timeSpeed=0;app.surface.foamCoverage.value=0;
 for(const s of [app.spray,app.boatSpray,app.breakers]){if(s?.update)s.update=()=>{};}
 if(app.cliffSurge){app.cliffSurge.mesh.visible=false;app.cliffSurge.update=()=>{};}
 if(app.wake)app.wake.update=()=>{};
 if(app.arrival)app.arrival.group.visible=false;
}
