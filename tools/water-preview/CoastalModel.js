// Isolated linear wave/flow experiment. No imports from the game, no saves.
// eta_t = -div(d u); u_t = -g grad(q)
// q = eta/6 + 5p/6; (I - 0.4 div(d^2 grad))p = eta.
// In constant depth this gives the [2,2] Pade fit of tanh(kd)/(kd).
// The variable-bottom extension is experimental, not a validated Boussinesq model.
export const G = 9.81;
export function waveNumber(depth, period) {
 let lo = 0, hi = 8, omega = 2 * Math.PI / period;
 for (let i = 0; i < 70; i++) { const k = (lo + hi) / 2; if (G * k * Math.tanh(k * depth) < omega * omega) lo = k; else hi = k; }
 return (lo + hi) / 2;
}
export function fittedOmega(depth, k, cell = 0) {
 const K = cell ? 2 * Math.sin(k * cell / 2) / cell : k, z2 = (K * depth) ** 2;
 return Math.sqrt(G * depth * K * K * (1 + z2 / 15) / (1 + 0.4 * z2));
}
export function waves(period = 14, angle = 0, amplitude = 0.5, irregular = true, depth = 35) {
 const dir = [-Math.cos(angle), Math.sin(angle)];
 return (irregular ? [[1, .55, 0], [.81, .3, 1.2], [1.23, .15, 2.4]] : [[1, 1, 0]]).map(([ratio, weight, phase]) => {
  const omega = 2 * Math.PI / (period * ratio), k = waveNumber(depth, period * ratio);
  return { kx: dir[0] * k, ky: dir[1] * k, omega, amplitude: amplitude * weight, phase, flow: omega / (k * depth) };
 });
}
export class CoastalModel {
 constructor(device, {n = 192, cell = 3, depths, texture, iterations = 64, periodic = false, sponge = 96} = {}) {
  this.device = device; this.n = n; this.cell = cell; this.depths = depths; this.iterations = iterations; this.sponge = sponge;
  this.time = 0; this.waveSet = waves(); this.buffers = []; this.params = [];
  const buffer = (label, size, usage) => { const b = device.createBuffer({label, size, usage}); this.buffers.push(b); return b; };
  const storage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC;
  this.depthBuffer = buffer('coast depths', n*n*4, storage); device.queue.writeBuffer(this.depthBuffer, 0, depths);
  this.state = buffer('coast height and face flow', n*n*16, storage);
  this.scratch = buffer('coast next face flow', n*n*16, storage);
  this.pressure = [buffer('coast pressure A', n*n*4, storage), buffer('coast pressure B', n*n*4, storage)];
  this.texture = texture || device.createTexture({label:'coast display',size:[n,n],format:'rgba16float',usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC});
  this.ownsTexture = !texture;
  for (let i=0;i<8;i++) this.params.push(buffer('coast substep '+i, 128, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST));
  const layout = device.createBindGroupLayout({entries:[
   {binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:'uniform'}},
   {binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:'read-only-storage'}},
   ...[2,3,5].map(binding=>({binding,visibility:GPUShaderStage.COMPUTE,buffer:{type:'storage'}})),
   {binding:4,visibility:GPUShaderStage.COMPUTE,buffer:{type:'read-only-storage'}},
   {binding:6,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:'write-only',format:'rgba16float'}}
  ]});
  const module = device.createShaderModule({label:'coast finite-volume waves',code:kernel(n, cell, periodic)});
  this.pipelines = Object.fromEntries(['pressureStep','velocityStep','heightStep','displayStep'].map(entryPoint=>[entryPoint,device.createComputePipeline({label:'coast '+entryPoint,layout:device.createPipelineLayout({bindGroupLayouts:[layout]}),compute:{module,entryPoint}})]));
  this.groups = this.params.map(params=>[0,1].map(swap=>device.createBindGroup({layout,entries:[
   {binding:0,resource:{buffer:params}},{binding:1,resource:{buffer:this.depthBuffer}},
   {binding:2,resource:{buffer:this.state}},{binding:3,resource:{buffer:this.scratch}},
   {binding:4,resource:{buffer:this.pressure[swap]}},{binding:5,resource:{buffer:this.pressure[1-swap]}},
   {binding:6,resource:this.texture.createView()}
  ]})));
 }
 reset(state = null, pressure = null) {
  this.time = 0;
  this.device.queue.writeBuffer(this.state, 0, state || new Float32Array(this.n*this.n*4));
  for (const p of this.pressure) this.device.queue.writeBuffer(p,0,pressure || new Float32Array(this.n*this.n));
 }
 uniform(slot, dt, {forced = true, sponge = this.sponge, time = this.time} = {}) {
  const a = new Float32Array(32); a.set([dt,time,sponge,forced?1:0]);
  this.waveSet.slice(0,3).forEach((w,i)=>{a.set([w.kx,w.ky,w.omega,w.amplitude],4+i*4); a.set([w.phase,w.flow,0,0],16+i*4);});
  this.device.queue.writeBuffer(this.params[slot],0,a);
 }
 encode(encoder, dt = 1/30, {slot=0, forced=true, sponge=this.sponge, iterations=this.iterations, timestampWrites} = {}) {
  this.time += dt; this.uniform(slot,dt,{forced,sponge});
  const pass=encoder.beginComputePass({label:'Coastal dispersive solve',timestampWrites}), count=Math.ceil(this.n/8);
  pass.setPipeline(this.pipelines.pressureStep);
  for(let i=0;i<iterations;i++){pass.setBindGroup(0,this.groups[slot][i%2]);pass.dispatchWorkgroups(count,count);}
  pass.setBindGroup(0,this.groups[slot][iterations%2]);
  for(const name of ['velocityStep','heightStep','displayStep']){pass.setPipeline(this.pipelines[name]);pass.dispatchWorkgroups(count,count);}
  pass.end();
 }
 destroy(){for(const b of this.buffers)b.destroy();if(this.ownsTexture)this.texture.destroy();}
}
function kernel(n, cell, periodic) { return /* wgsl */`
const N: i32 = ${n}; const DX: f32 = ${cell.toFixed(8)}; const GRAVITY: f32 = 9.81;
struct Params { control: vec4f, waves: array<vec4f,3>, extras: array<vec4f,3>, spare: vec4f }
@group(0) @binding(0) var<uniform> par: Params;
@group(0) @binding(1) var<storage,read> depth: array<f32>;
@group(0) @binding(2) var<storage,read_write> state: array<vec4f>;
@group(0) @binding(3) var<storage,read_write> next: array<vec4f>;
@group(0) @binding(4) var<storage,read> oldP: array<f32>;
@group(0) @binding(5) var<storage,read_write> newP: array<f32>;
@group(0) @binding(6) var display: texture_storage_2d<rgba16float,write>;
fn index(p:vec2i)->u32 { return u32(${periodic ? '((p.y+N)%N)*N+(p.x+N)%N' : 'clamp(p.y,0,N-1)*N+clamp(p.x,0,N-1)'}); }
fn valid(p:vec2i)->bool { return ${periodic ? 'true' : 'all(p>=vec2i(0)) && all(p<vec2i(N))'}; }
fn face(p:vec2i,r:vec2i)->f32 { if(!valid(r)){return 0.0;} let a=depth[index(p)]; let b=depth[index(r)]; if(min(a,b)<0.05){return 0.0;} return 2.0*a*b/(a+b); }
fn coefficient(p:vec2i,r:vec2i)->f32 { let d=face(p,r); return 0.4*d*d/(DX*DX); }
fn incoming(p:vec2f)->vec3f {
 var o=vec3f(0.0);
 for(var i=0u;i<3u;i++){let w=par.waves[i];if(w.w==0.0){continue;}let e=par.extras[i];let phase=dot(w.xy,p)-w.z*par.control.y+e.x;let h=w.w*cos(phase);o+=vec3f(h,normalize(w.xy)*h*e.y);}
 return o * smoothstep(0.0,8.0,par.control.y);
}
fn relax(p:vec2i)->f32 {
 if(par.control.z<=0.0){return 0.0;}
 let edge=f32(min(min(p.x,N-1-p.x),min(p.y,N-1-p.y)))*DX;
 let s=clamp(1.0-edge/par.control.z,0.0,1.0);
 return 1.0-exp(-par.control.x*1.25*s*s);
}
@compute @workgroup_size(8,8) fn pressureStep(@builtin(global_invocation_id) id:vec3u){
 let p=vec2i(id.xy);if(any(p>=vec2i(N))){return;}let i=index(p);
 if(depth[i]<0.05){newP[i]=0.0;return;}
 let e=p+vec2i(1,0);let w=p-vec2i(1,0);let n=p+vec2i(0,1);let s=p-vec2i(0,1);
 let a=coefficient(p,e);let b=coefficient(p,w);let c=coefficient(p,n);let d=coefficient(p,s);
 newP[i]=(state[i].x+a*oldP[index(e)]+b*oldP[index(w)]+c*oldP[index(n)]+d*oldP[index(s)])/(1.0+a+b+c+d);
}
fn head(p:vec2i)->f32 {let i=index(p);return state[i].x/6.0+oldP[i]*5.0/6.0;}
@compute @workgroup_size(8,8) fn velocityStep(@builtin(global_invocation_id) id:vec3u){
 let p=vec2i(id.xy);if(any(p>=vec2i(N))){return;}let i=index(p);
 let e=p+vec2i(1,0);let n=p+vec2i(0,1);let h=head(p);
 var u=state[i].yz-GRAVITY*par.control.x/DX*vec2f(head(e)-h,head(n)-h);
 var tu=vec2f(0.0);if(par.control.w>0.0){let pos=(vec2f(p)+0.5)*DX;tu=vec2f(incoming(pos+vec2f(DX/2.0,0.0)).y,incoming(pos+vec2f(0.0,DX/2.0)).z);}
 u=mix(u,tu,relax(p));
 if(face(p,e)==0.0){u.x=0.0;}if(face(p,n)==0.0){u.y=0.0;}
 next[i]=vec4f(state[i].x,u,state[i].w);
}
@compute @workgroup_size(8,8) fn heightStep(@builtin(global_invocation_id) id:vec3u){
 let p=vec2i(id.xy);if(any(p>=vec2i(N))){return;}let i=index(p);
 if(depth[i]<0.05){state[i]=vec4f(0.0);return;}
 let e=p+vec2i(1,0);let w=p-vec2i(1,0);let n=p+vec2i(0,1);let s=p-vec2i(0,1);
 let flux=face(p,e)*next[i].y-face(p,w)*next[index(w)].y+face(p,n)*next[i].z-face(p,s)*next[index(s)].z;
 let h=next[i].x-par.control.x/DX*flux;
 var t=0.0;if(par.control.w>0.0){t=incoming((vec2f(p)+0.5)*DX).x;}
 let r=relax(p);let hh=mix(h,t,r);
 state[i]=vec4f(hh,next[i].yz,next[i].w+(hh-h));
}
@compute @workgroup_size(8,8) fn displayStep(@builtin(global_invocation_id) id:vec3u){
 let p=vec2i(id.xy);if(any(p>=vec2i(N))){return;}let i=index(p);let h=state[i].x;
 let e=p+vec2i(1,0);let w=p-vec2i(1,0);let n=p+vec2i(0,1);let s=p-vec2i(0,1);
 let he=select(h,state[index(e)].x,face(p,e)>0.0);let hw=select(h,state[index(w)].x,face(p,w)>0.0);
 let hn=select(h,state[index(n)].x,face(p,n)>0.0);let hs=select(h,state[index(s)].x,face(p,s)>0.0);
 textureStore(display,p,vec4f(h,(he-hw)/(2.0*DX),(hn-hs)/(2.0*DX),length(state[i].yz)));
}
`; }
