// Native game renders, save-free before/after comparison, and a bounded local GPU benchmark.
// node tools/shots/sward.mjs [output directory]
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import '../../test/headless.mjs';
import { installBrowser } from './browser.mjs';
import { bgraShot, writePNG } from './png.mjs';
const out = resolve( process.argv[ 2 ] || 'artifacts/terra-integration' ); mkdirSync( out, { recursive: true } );
installBrowser( { search: '?bench&noAudio&setting=flannan', width: 1280, height: 720, root: resolve( 'public' ),
	onPost: async ( url, body ) => { const name = decodeURIComponent( url.split('/').pop() ).replace('.bgra','.png'); const img = bgraShot( Buffer.from(body.buffer,body.byteOffset,body.byteLength) ); writePNG( resolve(out,name),img.w,img.h,img.rgba ); console.log(name); } } );
await import( '../../src/core/BenchSeed.js' );
const { App } = await import( '../../src/App.js' );
const { Bench } = await import( '../../src/core/Bench.js' );
const { VIEWS } = await import( '../../src/core/DebugViews.js' );
const { GPU } = await import( '../../src/engine/gpu/GPU.js' );
const { G } = await import( '../../src/core/Globals.js' );
const { Vector3 } = await import( '../../src/engine/index.js' );
const { FlannanSward: LegacySward } = await import( '../../src/world/flannan/SwardLegacy.js' );
const app = new App(); await app.init( ( p, t ) => { if(t)console.log(`${Math.round(p*100)}% ${t}`); } );
const errors = []; GPU.device.addEventListener( 'uncapturederror', e => { errors.push(e.error.message); console.error(e.error.message); } );
const terra = app.sward, legacy = new LegacySward( { scene: app.scene, terrain: app.terrainData, village: app.village } ); legacy.group.visible = false;
for ( const [ name, x, z, tx, tz ] of [ ['swardFeet',-44,48,-38,43], ['swardPath',-32,35,-24,28] ] ) {
	const y = app.terrainData.heightAt(x,z)+1.62, ty=app.terrainData.heightAt(tx,tz)+.1, dx=tx-x,dz=tz-z;
	VIEWS[name]={p:[x,y,z],at:[tx,ty,tz],yaw:Math.atan2(-dx,-dz),pitch:Math.atan2(ty-y,Math.hypot(dx,dz)),time:12.4,fov:72};
}
const bench = new Bench( app ), setSize = bench.setSize.bind(bench); bench.setSize = (w=1280,h=720)=>setSize(w,h);
app.post.autoExposure.snap.value=1;
const report = { width:1280,height:720,warm:12,measuredFrames:36,errors,states:[] };
for ( const mode of ['legacy','terra'] ) {
	terra.group.visible = mode==='terra'; legacy.group.visible = mode==='legacy'; app.sward = mode==='terra'?terra:legacy;
	G.time.value=1000;
	await bench.shots(['swardFeet','swardPath','fTurf','fApproach'],{tag:mode,frames:64,dt:1/60,width:1280,height:720,time:12.4});
	report[mode]=await bench.run({views:['swardFeet','fTurf'],warm:12,frames:36,top:8});
	report.states.push({mode,...app.sward.stats});
}
await bench.shots(['swardFeet','swardPath'],{tag:'terra-night',frames:64,dt:1/60,width:1280,height:720,time:19});
// Walking across multiple cell/LOD boundaries also catches instance-buffer / motion-vector issues.
const v=VIEWS.swardFeet;
for(let i=0;i<100;i++) {
	const x=v.p[0]+i*.4,z=v.p[2]-i*.12,y=app.terrainData.heightAt(x,z)+1.62;
	app.fly.setPose(new Vector3(x,y,z),v.yaw,v.pitch);app.frame(1/60);await GPU.queue.onSubmittedWorkDone();
}
writeFileSync(resolve(out,'render-report.json'),JSON.stringify(report,null,2));
if(errors.length)throw new Error(`${errors.length} native GPU errors`);
console.log(JSON.stringify({legacy:report.legacy,terra:report.terra,errors},null,2));process.exit(0);
