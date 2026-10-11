// Save-free native renders of the archaeology and January ecology pass.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import '../../test/headless.mjs';
import { installBrowser } from './browser.mjs';
import { bgraShot, writePNG } from './png.mjs';
const tag = process.argv[2] || 'after', out = resolve('artifacts/island-history');
mkdirSync(out, {recursive:true});
installBrowser({search:'?bench&nostory&noAudio&setting=flannan',width:1200,height:800,root:resolve('public'),onPost:async(url,body)=>{
  const name=decodeURIComponent(url.split('/').pop()).replace('.bgra','.png'), img=bgraShot(Buffer.from(body.buffer,body.byteOffset,body.byteLength));
  writePNG(resolve(out,name),img.w,img.h,img.rgba); console.log(name);
}});
await import('../../src/core/BenchSeed.js');
const {App}=await import('../../src/App.js'), {Bench}=await import('../../src/core/Bench.js');
const {VIEWS}=await import('../../src/core/DebugViews.js'), {GPU}=await import('../../src/engine/gpu/GPU.js');
const {STATION}=await import('../../src/world/flannan/Station.js');
const {winterCoverSites}=await import('../../src/world/flannan/WinterCover.js');
const app=new App(); await app.init();
const errors=[]; GPU.device.addEventListener('uncapturederror',e=>{errors.push(e.error.message);console.error(e.error.message);});
const ch=STATION.chapel, gy=app.village.station.parts.history?.chapel.floor ?? app.terrainData.heightAt(ch.x,ch.z);
app.winterEcology.elapsed=100;
app.winterEcology.update(0,{position:{x:500,y:100,z:500}});
const bird=app.winterEcology.agents[2].P.pos;
const herb=winterCoverSites(app.terrainData,app.village.footprints).filter(s=>s.kind==='plantain').sort((a,b)=>Math.hypot(a.x-ch.x,a.z-ch.z)-Math.hypot(b.x-ch.x,b.z-ch.z))[0];
console.log('Winter cover review',JSON.stringify(herb));
const views={
  historyChapel:{p:[ch.x-6,gy+1.62,ch.z+5],at:[ch.x,gy+1,ch.z]},
  historyDoor:{p:[ch.x-3.3,gy+.68,ch.z+.24],at:[ch.x+.7,gy+.48,ch.z+.24],fov:64},
  historyInterior:{p:[ch.x-1,gy+.65,ch.z+.24],at:[ch.x+1.1,gy+.65,ch.z-.4],fov:85},
  historyBothies:{p:[-319,0,32],terrainEye:1.62,at:[-340,0,12],terrainTarget:1},
  historyChambers:{p:[-331,0,14],terrainEye:2.5,at:[-335,0,12],terrainTarget:.5,fov:80},
  winterCover:{p:[herb.x+.35,0,herb.z+.45],terrainEye:.6,at:[herb.x,herb.y+.07,herb.z],fov:52},
  winterBird:{p:[bird[0]+16,Math.max(bird[1]+2,app.terrainData.heightAt(bird[0]+16,bird[2]+4)+1.62),bird[2]+4],at:[...bird],fov:25},
};
for(const [n,v] of Object.entries(views)){
  if(v.terrainEye!==undefined)v.p[1]=app.terrainData.heightAt(v.p[0],v.p[2])+v.terrainEye;
  if(v.terrainTarget!==undefined)v.at[1]=app.terrainData.heightAt(v.at[0],v.at[2])+v.terrainTarget;
  const dx=v.at[0]-v.p[0],dy=v.at[1]-v.p[1],dz=v.at[2]-v.p[2];
  VIEWS[n]={fov:68,time:12.4,...v,yaw:Math.atan2(-dx,-dz),pitch:Math.atan2(dy,Math.hypot(dx,dz))};
}
const bench=new Bench(app), setSize=bench.setSize.bind(bench);bench.setSize=(w=1200,h=800)=>setSize(w,h);
app.handLamp.carried=false;app.handInView=false;
if(tag==='detail'){
  await bench.shots(['winterCover','winterBird'],{tag:'after',frames:20,width:1200,height:800,time:12.4});
  writeFileSync(resolve(out,'detail-report.json'),JSON.stringify({errors,herb,views:{winterCover:views.winterCover,winterBird:views.winterBird}},null,2));
  if(errors.length)throw new Error(`${errors.length} GPU errors`);
  console.log('Native ecology detail renders passed');process.exit(0);
}
await bench.shots(Object.keys(views).filter(n=>n!=='winterBird'),{tag,frames:40,width:1200,height:800,time:12.4});
for(const a of app.winterEcology.agents){a.flee=0;a.wasResting=false;}
await bench.shots(['winterBird'],{tag,frames:40,width:1200,height:800,time:12.4});
if(tag!=='before'){app.post.autoExposure.snap.value=1;await bench.shots(['historyDoor','historyBothies'],{tag:'dusk',frames:40,width:1200,height:800,time:15.2});}
writeFileSync(resolve(out,`${tag}-report.json`),JSON.stringify({errors,views,history:app.village.station.parts.history,cover:app.village.station.parts.winterCover,birds:app.winterEcology?.snapshot?.()},null,2));
if(errors.length)throw new Error(`${errors.length} GPU errors`);
console.log('Native archaeology/ecology renders passed');process.exit(0);
