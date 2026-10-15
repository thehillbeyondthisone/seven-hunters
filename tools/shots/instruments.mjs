import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import '../../test/headless.mjs';
import { installBrowser } from './browser.mjs';
import { writePNG, bgraShot, writeSheet } from './png.mjs';

// Matched native WebGPU close views, including both authored weather readings.
const stage = process.argv[2] || 'after';
const width = 1200, height = 800, out = resolve( 'artifacts/instruments', stage );
mkdirSync( out, { recursive: true } );
installBrowser( { search: '?bench&noAudio&weatherObservationsPreview=18', width, height, root: resolve( 'public' ) } );
await import( '../../src/core/BenchSeed.js' );
const { App } = await import( '../../src/App.js' );
const { Story } = await import( '../../src/story/Story.js' );
const { Vector3 } = await import( '../../src/engine/index.js' );
const { ROOM, TOWER } = await import( '../../src/world/flannan/Station.js' );
const { GPU } = await import( '../../src/engine/gpu/GPU.js' );
const { Texture } = await import( '../../src/engine/gpu/Texture.js' );
const { readTexture } = await import( '../../src/engine/gpu/Readback.js' );
const errors = [], init = GPU.init.bind( GPU );
GPU.init = async opts => {
 const result = await init( opts );
 GPU.device.addEventListener( 'uncapturederror', e => errors.push( e.error.message ) );
 GPU.device.pushErrorScope( 'validation' ); return result;
};
const app = new App(); await app.init();
app.ui = { ui: { photoMode: false, toast() {} }, update() {} };
const s = app.story = new Story( app ); s.ui.card = s.ui.fade = async () => {};
await s.start(); s.paused = true; app.setFreeCam( true );
s.hasTelescope = false; s.moving.telescope.visible = true;
const output = new Texture( { width, height, format: GPU.format, usage: [ 'render', 'copySrc', 'sample' ], label: 'instrument review' } );
app.post.outputTexture = output;
const scope = s.station.parts.telescope.position;
const poses = [
 { name: '01-barometer', p: ROOM.barometer.clone().add( new Vector3( .19, -.05, .72 ) ), at: ROOM.barometer.clone().add( new Vector3( 0, -.09, 0 ) ), h: 18, fov: 43 },
 { name: '02-barometer-dial-six', p: ROOM.barometer.clone().add( new Vector3( 0, 0, .6 ) ), at: ROOM.barometer, h: 18, fov: 25 },
 { name: '03-barometer-dial-nine', p: ROOM.barometer.clone().add( new Vector3( 0, 0, .6 ) ), at: ROOM.barometer, h: 21, fov: 25 },
 { name: '04-thermometer', p: ROOM.thermometer.clone().add( new Vector3( -.24, .03, -.9 ) ), at: ROOM.thermometer, h: 18, fov: 48 },
 { name: '05-thermometer-nine', p: ROOM.thermometer.clone().add( new Vector3( 0, 0, -.7 ) ), at: ROOM.thermometer, h: 21, fov: 44 },
 { name: '06-telescope', p: new Vector3( scope.x*.55, scope.y+.36, scope.z*.55 ), at: scope, h: 12, fov: 52 },
];
const shots = [];
for ( const pose of poses ) {
 s.h = pose.h; s._applyClock(); s.weatherObservations.focus = null;
 app.camera.position.copy( pose.p ); app.camera.lookAt( pose.at );
 app.camera.fov = pose.fov; app.camera.updateProjectionMatrix();
 const dir = app.camera.getWorldDirection( new Vector3() );
 app.fly.setPose( pose.p.clone(), Math.atan2( -dir.x, -dir.z ), Math.asin( dir.y ) );
 app.cameraCut(); app.post.autoExposure.snap.value = 1;
 for ( let i = 0; i < 30; i++ ) { app.frame( 1/60 ); await GPU.queue.onSubmittedWorkDone(); }
 const shot = await readTexture( output ), body = new Uint8Array( 8 + shot.data.byteLength );
 new Uint32Array( body.buffer, 0, 2 ).set( [ width, height ] ); body.set( new Uint8Array( shot.data ), 8 );
 const rgba = bgraShot( Buffer.from( body ) ); shots.push( rgba );
 writePNG( resolve( out, `${ pose.name }.png` ), width, height, rgba.rgba );
 console.log( `${ pose.name}: hour ${ pose.h }` );
}
writeSheet( resolve( out, 'review.png' ), shots, 2 );
await GPU.pipelinesReady(); await GPU.queue.onSubmittedWorkDone();
const validation = await GPU.device.popErrorScope(); assert.equal( validation, null, validation?.message ); assert.deepEqual( errors, [] );
writeFileSync( resolve( out, 'verification.json' ), JSON.stringify( { views: poses.map( p => p.name ), validationErrors: errors, physicalDeviceTested: false }, null, 2 ) );
console.log( 'PASS six native WebGPU instrument views; no validation errors.' );
process.exit( 0 );
