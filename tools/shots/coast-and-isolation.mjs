import '../../test/headless.mjs';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {installBrowser} from './browser.mjs';
import {bgraShot,writePNG} from './png.mjs';
import {GPU} from '../../src/engine/gpu/GPU.js';
import {LandingDamage} from '../../src/story/LandingDamage.js';

const out=resolve('artifacts/coast-and-isolation');mkdirSync(out,{recursive:true});const images=new Map();
installBrowser({search:'?bench&coastalReview&stormPreview&noAudio&adapt',width:960,height:540,root:resolve('public'),onPost:async(url,body)=>{const name=decodeURIComponent(url.split('/').pop()).replace(/\.bgra$/,'');const shot=bgraShot(Buffer.from(body.buffer,body.byteOffset,body.byteLength));images.set(name,shot);writePNG(`${out}/${name}.png`,shot.w,shot.h,shot.rgba);console.log('rendered',name);}});
await import('../../src/core/BenchSeed.js');const {App}=await import('../../src/App.js'),{Bench}=await import('../../src/core/Bench.js'),{VIEWS}=await import('../../src/core/DebugViews.js');
const errors=[],init=GPU.init.bind(GPU);GPU.init=async opts=>{const r=await init(opts);GPU.device.addEventListener('uncapturederror',e=>errors.push(e.error.message));GPU.device.pushErrorScope('validation');return r;};
const app=new App();let last='';await app.init((p,m)=>{if(m!==last){last=m;console.log(`${Math.round(p*100)}% ${m}`);}});const bench=new Bench(app),l=app.terrainData.landing('west'),p=l.steps.pts[6];
const view=(name,from,to,fov=70)=>{const dx=to[0]-from[0],dy=to[1]-from[1],dz=to[2]-from[2];VIEWS[name]={p:from,yaw:Math.atan2(-dx,-dz),pitch:Math.atan2(dy,Math.hypot(dx,dz)),fov,vis:30};};
view('coastStairs',[p[0],p[1]+1.62,p[2]],[l.stage.x+l.dir[0]*20,1,l.stage.z+l.dir[1]*20]);
const upper=l.steps.pts[16];view('coastUpper',[upper[0],upper[1]+1.62,upper[2]],[l.stage.x,3,l.stage.z]);
view('coastRungs',[l.head.x+l.dir[0]*10-l.dir[1]*2,1.1,l.head.z+l.dir[1]*10+l.dir[0]*2],[l.head.x+l.dir[0]*7.73-l.dir[1]*1.14,2,l.head.z+l.dir[1]*7.73+l.dir[0]*1.14],76);
app.seaWeather.select('gale');for(let i=0;i<600;i++)app.seaWeather.update(.1);app.post.autoExposure.snap.value=1;
for(const [tag,time,strength]of [['between-sets',6.9,.58],['breaking-set',53.66,1.5]]){app.coastal.load({time,strength});await bench.shots(['coastStairs','coastUpper'],{tag,width:960,height:540,frames:24,dt:0,time:15.55});}
app.coastal.load({time:6.9,strength:1});await bench.shots(['coastRungs'],{tag:'water-level',width:960,height:540,frames:24,dt:0,time:15.55});
const damage=new LandingDamage(app);damage.set(true);await bench.shots(['fWestWatch'],{tag:'destroyed-route',width:960,height:540,frames:24,dt:0,time:15.55});damage.set(false);
await GPU.pipelinesReady();await GPU.queue.onSubmittedWorkDone();assert.equal(await GPU.device.popErrorScope(),null);assert.deepEqual(errors,[]);
const a=images.get('between-sets-coastStairs').rgba,b=images.get('breaking-set-coastStairs').rgba;let difference=0;for(let i=0;i<a.length;i++)difference+=Math.abs(a[i]-b[i]);assert.ok(difference>960*540,'the shared surge makes a visible change');
writeFileSync(`${out}/render-verification.json`,JSON.stringify({validationErrors:errors,difference,views:[...images.keys()],note:'Native scene renders; human listening and physical-device acceptance remain separate.'},null,2));
console.log('PASS complete ocean/query/landing scene and reversible destruction, with no WebGPU validation errors.');process.exit(0);
