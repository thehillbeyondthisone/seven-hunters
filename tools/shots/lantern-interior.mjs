// Matched checks of the gallery doorway, interior spill and the seaward beam.
import '../../test/headless.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { installBrowser } from './browser.mjs';
import { bgraShot, writePNG, writeSheet } from './png.mjs';

const width = 960, height = 540;
const out = resolve( 'artifacts/lantern-interior', process.argv[ 2 ] || 'after' );
mkdirSync( out, { recursive: true } );
installBrowser( { search: '?bench&noAudio&lamp&handlamp', width, height, root: resolve( 'public' ) } );
await import( '../../src/core/BenchSeed.js' );
const { App } = await import( '../../src/App.js' );
const { GPU } = await import( '../../src/engine/gpu/GPU.js' );
const { Texture } = await import( '../../src/engine/gpu/Texture.js' );
const { readTexture } = await import( '../../src/engine/gpu/Readback.js' );
const { Vector3 } = await import( '../../src/engine/index.js' );
const { TOWER } = await import( '../../src/world/flannan/Station.js' );
const { Beams } = await import( '../../src/station/Beams.js' );
const errors = [];
const app = new App();
await app.init( ( p, label ) => { if ( label ) console.log( `${ Math.round( p * 100 ) }% ${ label }` ); } );
app.engine.stop(); app.setFreeCam( true ); app.handInView = true;
GPU.device.pushErrorScope( 'validation' );
GPU.device.addEventListener( 'uncapturederror', event => errors.push( event.error.message ) );
app.settings.timeOfDay = 1.42; app.settings.timeSpeed = 0;
app.post.autoExposure.snap.value = 1; app.settings.exposure = 1;
app.lamp.speed = 0; app.lamp.stop(); app.lamp.angle = 0;
const output = new Texture( { width, height, format: GPU.format, usage: [ 'render', 'copySrc', 'sample' ] } );
app.post.outputTexture = output;
const shots = [], evidence = [];
const ga = TOWER.galleryDoor;
const views = [
 [ 'threshold', [ Math.cos( ga ) * 3.15, TOWER.deck + 1.62, Math.sin( ga ) * 3.15 ], [ 0, TOWER.deck + 2.1, 0 ] ],
 [ 'door', [ -Math.cos( ga ) * 1.5, TOWER.deck + 1.62, -Math.sin( ga ) * 1.5 ], [ Math.cos( ga ) * 2.3, TOWER.deck + 1.5, Math.sin( ga ) * 2.3 ] ],
 [ 'optic', [ 1.95, 100.35, .44 ], [ 0, 100.55, 0 ] ],
 [ 'seaward', [ -14, 82.3, 16 ], [ 0, 104, -3 ] ],
];
for ( const [ name, eye, target ] of views ) {
 const dir = new Vector3( ...target ).sub( new Vector3( ...eye ) ).normalize();
 app.fly.setPose( new Vector3( ...eye ), Math.atan2( -dir.x, -dir.z ), Math.asin( dir.y ) );
 for ( const mode of process.argv.includes( '--diagnose' ) ? [ 'all', 'no-haze', 'no-hand', 'no-local' ] : [ 'all' ] ) {
  app.haze.enabled.value = mode === 'no-haze' ? 0 : 1;
  app.handLamp.lit = mode !== 'no-hand'; app.handLamp.glow = app.handLamp.lit ? 1 : 0;
  app.localLights.enabled = mode !== 'no-local';
  app.handLamp.resetMotion(); app.cameraCut();
  for ( let i = 0; i < 24; i ++ ) { app.frame( 0 ); await GPU.queue.onSubmittedWorkDone(); }
  const raw = await readTexture( output ), bytes = new Uint8Array( 8 + raw.data.byteLength );
  new Uint32Array( bytes.buffer, 0, 2 ).set( [ width, height ] ); bytes.set( new Uint8Array( raw.data ), 8 );
  const shot = bgraShot( Buffer.from( bytes ) ); shots.push( shot );
  writePNG( resolve( out, `${ name }-${ mode }.png` ), width, height, shot.rgba );
  evidence.push( { name, mode, eye, target, beamOrigin: Beams.uniforms.origin.value.toArray(), exposure: app.settings.exposure } );
  console.log( 'captured', name, mode );
 }
}
writeSheet( resolve( out, 'review.png' ), shots, process.argv.includes( '--diagnose' ) ? 4 : 3 );
await GPU.pipelinesReady(); await GPU.queue.onSubmittedWorkDone();
const validation = await GPU.device.popErrorScope(); assert.equal( validation, null, validation?.message ); assert.deepEqual( errors, [] );
writeFileSync( resolve( out, 'verification.json' ), JSON.stringify( { evidence, gpuErrors: errors }, null, 2 ) );
console.log( 'PASS gallery lighting captures; no GPU validation errors.' );
process.exit( 0 );
