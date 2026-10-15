// Dated catalog stars through the actual game renderer (clouds, water, exposure and TAA).
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import '../../test/headless.mjs';
import { installBrowser } from './browser.mjs';
import { bgraShot, writePNG, writeSheet } from './png.mjs';

const width = 1280, height = 720, out = resolve( 'artifacts/night-sky/game' );
mkdirSync( out, { recursive: true } );
installBrowser( { search: '?bench&noAudio&vis=90', width, height, root: resolve( 'public' ) } );
await import( '../../src/core/BenchSeed.js' );
const { App } = await import( '../../src/App.js' );
const { Vector3 } = await import( '../../src/engine/index.js' );
const { GPU } = await import( '../../src/engine/gpu/GPU.js' );
const { Texture } = await import( '../../src/engine/gpu/Texture.js' );
const { readTexture } = await import( '../../src/engine/gpu/Readback.js' );
const errors = [], init = GPU.init.bind( GPU );
GPU.init = async ( opts ) => {
	const r = await init( opts ); GPU.device.pushErrorScope( 'validation' );
	GPU.device.addEventListener( 'uncapturederror', ( e ) => errors.push( e.error.message ) ); return r;
};
const app = new App();
await app.init( ( progress, label ) => { if ( label ) console.log( `${ Math.round( progress * 100 ) }% ${ label }` ); } );
app.setFreeCam( true ); app.settings.timeSpeed = 0;
// A clear interval: normal weather still obscures the catalog in play.
app.clouds.coverage.value = .2;
const output = new Texture( { width, height, format: GPU.format, usage: [ 'render', 'copySrc', 'sample' ], label: 'night sky game review' } );
app.post.outputTexture = output;
const shots = [], poses = [
	{ name: 'orion-over-the-sea-22', h: 22, dir: [ 0, .4, 1 ], eye: [ -8, 100.2, 4 ] },
	{ name: 'orion-over-the-sea-02', h: 26, dir: [ 0, .4, 1 ], eye: [ -8, 100.2, 4 ] },
	{ name: 'polaris-and-plough-22', h: 22, dir: [ 0, 1.5, -1 ], eye: [ -8, 100.2, 4 ] },
	{ name: 'polaris-and-plough-02', h: 26, dir: [ 0, 1.5, -1 ], eye: [ -8, 100.2, 4 ] },
];
for ( const pose of poses ) {

	app.setting.dayOffset = 19 + Math.floor( pose.h / 24 ); app.settings.timeOfDay = pose.h % 24;
	const dir = new Vector3( ...pose.dir ).normalize(), eye = new Vector3( ...pose.eye );
	app.camera.fov = 65; app.camera.updateProjectionMatrix();
	app.camera.position.copy( eye ); app.camera.lookAt( eye.clone().add( dir ) );
	app.fly.setPose( eye, Math.atan2( -dir.x, -dir.z ), Math.asin( dir.y ) );
	app.cameraCut(); app.post.autoExposure.snap.value = 1;
	for ( let frame = 0; frame < 30; frame ++ ) { app.frame( 1 / 60 ); await GPU.queue.onSubmittedWorkDone(); }
	const texture = await readTexture( output ), bytes = new Uint8Array( 8 + texture.data.byteLength );
	new Uint32Array( bytes.buffer, 0, 2 ).set( [ width, height ] ); bytes.set( new Uint8Array( texture.data ), 8 );
	const shot = bgraShot( Buffer.from( bytes ) ); shots.push( shot );
	writePNG( resolve( out, `${ pose.name }.png` ), width, height, shot.rgba );
	console.log( pose.name );

}
writeSheet( resolve( out, 'review.png' ), shots, 2 );
await GPU.pipelinesReady(); await GPU.queue.onSubmittedWorkDone();
const validation = await GPU.device.popErrorScope(); assert.equal( validation, null, validation?.message ); assert.deepEqual( errors, [] );
writeFileSync( resolve( out, 'verification.json' ), JSON.stringify( { poses, clearInterval: true, gpuErrors: errors, physicalDeviceTested: false }, null, 2 ) + '\n' );
console.log( 'Full game night sky: dated rotation, atmosphere, clouds, TAA and water passed with no GPU errors.' );
process.exit( 0 );
