import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import '../../test/headless.mjs';
import { installBrowser } from './browser.mjs';
import { writePNG, bgraShot, writeSheet } from './png.mjs';

// Native WebGPU review of "Examine the signal lamp": the lamp's moving parts in its working states.
const out = resolve( 'artifacts/signal-lamp' ), width = 1200, height = 800;
mkdirSync( out, { recursive: true } );
installBrowser( { search: '?bench&noAudio&keeperPreview', width, height, root: resolve( 'public' ) } );
await import( '../../src/core/BenchSeed.js' );
const { App } = await import( '../../src/App.js' );
const { Story } = await import( '../../src/story/Story.js' );
const { Vector3 } = await import( '../../src/engine/index.js' );
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
const L = s.lampStudy;
assert.ok( s.moving.signalLamp && Object.keys( s.moving.signalLamp.parts ).length >= 15, 'moving lamp parts assembled' );
const output = new Texture( { width, height, format: GPU.format, usage: [ 'render', 'copySrc', 'sample' ], label: 'signal lamp review' } );
app.post.outputTexture = output; app.post.autoExposure.snap.value = 1;
const fresh = { oil: 1, char: 0, soot: 0, door: false, raised: false, lifted: false, lit: false, wick: 0.2, heat: 0, examined: true, seen: [] };
const poses = [
	{ name: '01-on-the-balcony', state: {}, eye: [ - 0.9, 1.62, - 0.75 ], at: [ 0, 1.0, 0.2 ], fov: 62 },
	{ name: '02-front-cold', state: {}, eye: [ 0.44, 1.26, 0.8 ], at: [ 0, 1.12, 0.06 ], fov: 50 },
	{ name: '03-door-lit-low', state: { door: true, lifted: true, lit: true, wick: 0.2 }, eye: [ 0.5, 1.18, 0.05 ], at: [ 0.02, 1.08, 0 ], fov: 50 },
	{ name: '04-chimney-drawn-up', state: { raised: true }, eye: [ 0.3, 1.62, 0.3 ], at: [ 0, 1.29, 0 ], fov: 50 },
	{ name: '05-key-pressed-burning', state: { raised: true, lit: true, wick: 0.9, heat: 1 }, press: true, eye: [ 0.44, 1.26, 0.8 ], at: [ 0, 1.12, 0.06 ], fov: 50 },
	{ name: '06-key-released', state: { raised: true, lit: true, wick: 0.9, heat: 1 }, eye: [ 0.17, 1.13, 0.55 ], at: [ 0, 1.09, 0.13 ], fov: 50 },
	{ name: '07-along-the-sights', state: { raised: true }, eye: [ 0.08, 1.287, - 0.34 ], at: 'her', fov: 30 },
	{ name: '08-tripod-and-can', state: {}, eye: [ 0.55, 0.55, - 0.55 ], at: [ - 0.13, 0.12, - 0.2 ], fov: 50 },
];
const images = [];
for ( const pose of poses ) {
	s.flags.signalLamp = { ...fresh, ...pose.state };
	L.pressed = !! pose.press; L.open = pose.press ? 1 : 0;
	s.h = 12.5; s._applyClock();
	const eye = L.world( new Vector3( ...pose.eye ) ), at = pose.at === 'her' ? s._herRender( new Vector3() ) : L.world( new Vector3( ...pose.at ) );
	app.camera.position.copy( eye ); app.camera.lookAt( at );
	app.camera.fov = pose.fov; app.camera.updateProjectionMatrix();
	const dir = app.camera.getWorldDirection( new Vector3() );
	app.fly.setPose( app.camera.position.clone(), Math.atan2( -dir.x, -dir.z ), Math.asin( dir.y ) );
	app.cameraCut();
	for ( let i = 0; i < 24; i++ ) { L.pressed = !! pose.press; app.frame( 1 / 60 ); await GPU.queue.onSubmittedWorkDone(); }
	const shot = await readTexture( output ), body = new Uint8Array( 8 + shot.data.byteLength );
	new Uint32Array( body.buffer, 0, 2 ).set( [ width, height ] ); body.set( new Uint8Array( shot.data ), 8 );
	const rgba = bgraShot( Buffer.from( body ) ); images.push( rgba );
	writePNG( resolve( out, `${ pose.name }.png` ), width, height, rgba.rgba );
	console.log( `${ pose.name }: output ${ L.output.toFixed( 2 ) } open ${ L.open.toFixed( 2 ) }` );
}
writeSheet( resolve( out, 'scene-sheet.png' ), images, 2 );
await GPU.pipelinesReady(); await GPU.queue.onSubmittedWorkDone();
const validation = await GPU.device.popErrorScope(); assert.equal( validation, null, validation?.message ); assert.deepEqual( errors, [] );
writeFileSync( resolve( out, 'verification.json' ), JSON.stringify( { views: poses.map( p => p.name ), validationErrors: errors, physicalDeviceTested: false }, null, 2 ) );
console.log( 'PASS native WebGPU signal lamp: eight views, no shader or validation errors.' );
process.exit( 0 );
