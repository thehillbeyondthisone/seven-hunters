import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,readdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import '../../test/headless.mjs';
import {installBrowser} from './browser.mjs';

const arg=(name,fallback)=>process.argv.find(v=>v.startsWith(`--${name}=`))?.slice(name.length+3)??fallback;
const width=Number(arg('width',1000)),height=Number(arg('height',720));
assert.ok(Number.isInteger(width)&&width>0&&Number.isInteger(height)&&height>0);
const collect=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?collect(dir+'/'+entry.name):[dir+'/'+entry.name]);
const hookFiles=process.argv.filter(v=>v.startsWith('--hook=')).map(v=>'tools/shots/'+v.slice(7).split(':')[0]);
const sourceFiles=[...collect('src').filter(path=>/\.(js|wgsl)$/.test(path)),...hookFiles,'tools/shots/photography-tutorial.mjs','tools/shots/photography-capture.mjs','public/models/characters/boatman.glb','public/models/characters/boatman-manifest.json'].filter(existsSync).sort();
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const sourceHashes=Object.fromEntries(sourceFiles.map(path=>[path,hash(path)]));
const runOut=resolve('artifacts/story-review'),runId=new Date().toISOString().replace(/[:.]/g,'-'),completed=[];
mkdirSync(runOut,{recursive:true});
const manifest={startedAt:new Date().toISOString(),command:['node','tools/shots/photography-tutorial.mjs',...process.argv.slice(2)].join(' '),width,height,sourceHashes};
writeFileSync(resolve(runOut,'combined-start-'+runId+'.json'),JSON.stringify({...manifest,status:'started'},null,2));
try{
installBrowser({search:'?bench&adapt&noAudio&laterWatchPreview=photography',width,height,root:resolve('public')});
await import('../../src/core/BenchSeed.js');
const {App}=await import('../../src/App.js');
const {Story}=await import('../../src/story/Story.js');
const {GPU}=await import('../../src/engine/gpu/GPU.js');
const {Texture}=await import('../../src/engine/gpu/Texture.js');
const {readTexture}=await import('../../src/engine/gpu/Readback.js');
const errors=[],init=GPU.init.bind(GPU);
GPU.init=async options=>{const result=await init(options);GPU.device.addEventListener('uncapturederror',e=>errors.push(e.error.message));return result;};
const app=new App();let stage='';await app.init((p,label)=>{if(label&&label!==stage)console.log(`${Math.round(p*100)}% ${stage=label}`);});
const s=app.story=new Story(app);s.save=()=>{};s.loadSave=()=>null;s.ui.card=s.ui.fade=s.ui.read=async()=>{};await s.start();
const output=new Texture({width,height,format:GPU.format,usage:['render','copySrc','sample'],label:'Combined story review'});app.post.outputTexture=output;
const {capturePhotography}=await import('./photography-capture.mjs');
if(!process.argv.includes('--skip-photo'))completed.push({hook:'photography-capture.mjs:capturePhotography',result:await capturePhotography({app,s,story:s,GPU,output,width,height,readTexture})});
for(const option of process.argv.filter(v=>v.startsWith('--hook='))){
 const spec=option.slice(7),match=/^([a-z0-9-]+\.mjs):([A-Za-z][A-Za-z0-9_]*)$/.exec(spec);
 assert.ok(match,`Invalid local capture hook: ${spec}`);const module=await import('./'+match[1]);assert.equal(typeof module[match[2]],'function',spec);
 console.log('starting warm capture',spec);const result=await module[match[2]]({app,s,story:s,GPU,output,width,height,readTexture});completed.push({hook:spec,result:result??null});
}
if(process.argv.includes('--review-window')){
 const {createInterface}=await import('node:readline');const review=createInterface({input:process.stdin,output:process.stdout,terminal:false});
 console.log('REVIEW_READY: inspect the completed PNGs; commands are finish or smoke 3.5.');
 for await(const line of review){
  const command=line.trim();
  if(command==='finish'){review.close();break;}
  if(command==='smoke 3.5'){
   const {captureNightSmoke}=await import('./domestic-work-capture.mjs');
   const result=await captureNightSmoke({app,s,story:s,GPU,output,width,height,readTexture,diagnosticFov:3.5});
   completed.push({hook:'domestic-work-capture.mjs:captureNightSmoke',diagnosticFov:3.5,result:result??null});
   console.log('REVIEW_READY: diagnostic written; finish closes the warmed renderer.');
  }else console.log('Unknown review command; use finish or smoke 3.5.');
 }
}
await GPU.pipelinesReady();await GPU.queue.onSubmittedWorkDone();assert.deepEqual(errors,[]);
const changed=Object.entries(sourceHashes).filter(([path,before])=>hash(path)!==before).map(([path])=>path);assert.deepEqual(changed,[],'source freeze changed during native capture');
const out=resolve('artifacts/story-review');mkdirSync(out,{recursive:true});writeFileSync(resolve(out,'combined-verification.json'),JSON.stringify({createdAt:new Date().toISOString(),command:['node','tools/shots/photography-tutorial.mjs',...process.argv.slice(2)].join(' '),width,height,sourceHashes,completed,validationErrors:errors,scope:'One fresh native game App with ordinary adaptive exposure; each capture hook owns its isolated checkpoint, validation and source provenance. No browser input, audio or physical-device claim.'},null,2));
console.log('PASS combined native story capture hooks',completed.map(v=>v.hook));process.exit(0);
}catch(error){
 writeFileSync(resolve(runOut,'combined-failed-'+runId+'.json'),JSON.stringify({...manifest,status:'failed',failedAt:new Date().toISOString(),completed,error:{message:error.message,stack:error.stack}},null,2));
 throw error;
}
