import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import '../../test/headless.mjs';
import { installBrowser } from './browser.mjs';
import { writePNG, bgraShot, writeSheet } from './png.mjs';

const out = resolve( 'artifacts/unpacking' ), width = 1200, height = 800;
mkdirSync( out, { recursive: true } );
installBrowser( { search: '?bench&noAudio&unpackingPreview', width, height, root: resolve( 'public' ) } );
await import( '../../src/core/BenchSeed.js' );
const { App } = await import( '../../src/App.js' );
const { Story } = await import( '../../src/story/Story.js' );
const { TOWER, ROOM } = await import( '../../src/world/flannan/Station.js' );
const { GPU } = await import( '../../src/engine/gpu/GPU.js' );
const { Texture } = await import( '../../src/engine/gpu/Texture.js' );
const { readTexture } = await import( '../../src/engine/gpu/Readback.js' );
const errors = [], init = GPU.init.bind( GPU );
GPU.init = async opts => {
	const result = await init( opts ); GPU.device.addEventListener( 'uncapturederror', e => errors.push( e.error.message ) );
	GPU.device.pushErrorScope( 'validation' ); return result;
};
const app = new App();
await app.init( ( p, label ) => { if ( label ) console.log( `${ Math.round( p * 100 ) }% ${ label }` ); } );
app.ui = { ui: { photoMode: false, toast() {} }, update() {} };
const s = app.story = new Story( app ); s.ui.card = s.ui.fade = async () => {};
await s.start(); s.paused = true; app.setFreeCam( true );
const output = new Texture( { width, height, format: GPU.format, usage: [ 'render', 'copySrc', 'sample' ], label: 'unpacking review' } );
app.post.outputTexture = output; app.post.autoExposure.snap.value = 1;
const F = TOWER.floor, dz = ROOM.z0 + .61;
const poses = [
	{ name: '01-your-bag', stage: 0, p: [ -1.25, F + 1.62, 4 ], at: [ -.8, F + .28, 5.07 ], fov: 64 },
	{ name: '02-open-bag', stage: 1, p: [ -1.25, F + 1.62, 4 ], at: [ -.8, F + .28, 5.07 ], fov: 64 },
	{ name: '03-unwrapped', stage: 3, p: [ -1.05, F + .85, 4.25 ], at: [ -.67, F + .235, 5.03 ], fov: 42 },
	{ name: '04-brownie-on-desk', stage: 4, p: [ -5.72, F + 1.62, .25 ], at: [ -6.14, F + .80, dz ], fov: 58 },
	{ name: '05-brownie-detail', stage: 4, p: [ -5.74, F + .99, dz + .31 ], at: [ -5.99, F + .80, dz ], fov: 36 },
	{ name: '06-room-unpacked', stage: 4, p: [ .6, F + 1.62, 4.6 ], at: [ -5.5, F + .95, 1.1 ], fov: 65 },
];
const images = [];
for ( const pose of poses ) {
	s.flags.unpacking.stage = pose.stage; s.unpacking.sync(); s.h = 15.65; s._applyClock();
	app.camera.position.set( ...pose.p ); app.camera.lookAt( ...pose.at );
	app.camera.fov = pose.fov; app.camera.updateProjectionMatrix();
	const dir = app.camera.getWorldDirection( app.player.position.clone() );
	app.fly.setPose( app.camera.position.clone(), Math.atan2( -dir.x, -dir.z ), Math.asin( dir.y ) );
	app.cameraCut();
	for ( let i = 0; i < 24; i++ ) { app.frame( 1 / 60 ); await GPU.queue.onSubmittedWorkDone(); }
	const shot = await readTexture( output ), body = new Uint8Array( 8 + shot.data.byteLength );
	new Uint32Array( body.buffer, 0, 2 ).set( [ width, height ] ); body.set( new Uint8Array( shot.data ), 8 );
	const rgba = bgraShot( Buffer.from( body ) ); images.push( rgba );
	writePNG( resolve( out, `${ pose.name }.png` ), width, height, rgba.rgba );
	console.log( `${ pose.name }: stage ${ pose.stage }` );
}
writeSheet( resolve( out, 'scene-sheet.png' ), images, 2 );
await GPU.pipelinesReady(); await GPU.queue.onSubmittedWorkDone();
const validation = await GPU.device.popErrorScope(); assert.equal( validation, null, validation?.message ); assert.deepEqual( errors, [] );
writeFileSync( resolve( out, 'verification.json' ), JSON.stringify( { views: poses.map( p => p.name ), validationErrors: errors, physicalDeviceTested: false }, null, 2 ) );
console.log( 'PASS native WebGPU unpacking scene: six views, no shader or validation errors.' );
process.exit( 0 );
