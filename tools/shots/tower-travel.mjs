// Actual renderer review of the visible stair paths. Raw captures omit the DOM
// fade so geometry remains inspectable; verification.json records its opacity.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import '../../test/headless.mjs';
import { installBrowser } from './browser.mjs';
import { bgraShot, writePNG, writeSheet } from './png.mjs';

const width = 960, height = 540, out = resolve( 'artifacts/tower-travel' );
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
	const result = await init( opts ); GPU.device.pushErrorScope( 'validation' );
	GPU.device.addEventListener( 'uncapturederror', event => errors.push( event.error.message ) ); return result;
};
const app = new App();
await app.init( ( p, label ) => { if ( label ) console.log( `${ Math.round( p * 100 ) }% ${ label }` ); } );
app.ui = { ui: { photoMode: false, toast() {} }, update() {} };
const s = app.story = new Story( app ); s.save = () => {}; s.loadSave = () => null; s.ui.card = async () => {};
await s.start(); s.arrival.group.visible = false; s.beat = 'watch'; s.h = 16 + 50 / 60;
s.flags.keeperDuty = { inspected: true, verified: true, rewound: true, driveCutsceneSeen: true };
s.paused = false; app.freeCam = false; app.settings.timeSpeed = 0; app.settings.cameraBob = true;
s._applyClock();
app.handLamp.carried = true; app.handLamp.lit = true; app.handLamp.glow = 1; app.handInView = true;
const output = new Texture( { width, height, format: GPU.format, usage: [ 'render', 'copySrc', 'sample' ], label: 'tower stair review' } );
app.post.outputTexture = output; app.post.autoExposure.snap.value = 1;
const shots = [], evidence = [];
const ease = t => { const k = Math.max( 0, Math.min( 1, t ) ); return k * k * k * ( k * ( k * 6 - 15 ) + 10 ); };
const opacity = p => ease( ( p - .28 ) / .14 ) * ( 1 - ease( ( p - .57 ) / .33 ) );
async function shot( name, progress, arrived ) {
	for ( let i = 0; i < 10; i ++ ) { app.frame( 1 / 60 ); await GPU.queue.onSubmittedWorkDone(); }
	const texture = await readTexture( output ), bytes = new Uint8Array( 8 + texture.data.byteLength );
	new Uint32Array( bytes.buffer, 0, 2 ).set( [ width, height ] ); bytes.set( new Uint8Array( texture.data ), 8 );
	const result = bgraShot( Buffer.from( bytes ) ); shots.push( result ); writePNG( resolve( out, `${ name }.png` ), width, height, result.rgba );
	evidence.push( { name, progress, arrived, fadeOpacity: opacity( progress ), eye: app.camera.position.toArray(), rotation: app.camera.rotation.toArray() } ); console.log( name );
}
const guardNames = [];
s.moving.group?.traverse( node => { if ( /tower-travel-guards/.test( node.name ) ) guardNames.push( node.name ); } );
assert.deepEqual( guardNames, [], 'old invented gates are absent from scene geometry' );
assert.equal( app.colliders.boxes.filter( box => box.tag === 'towerTravelGuard' ).length, 0 );
for ( const up of [ true, false ] ) {
	const direction = up ? 'up' : 'down', p = app.player, foot = up ? s.towerTravel.bottom : s.towerTravel.top;
	p.position.copy( foot ); p.velocity.set( 0, 0, 0 ); p.grounded = true; p.mode = 'walk'; p.bob = 0; p._camY = null; p.update( 0 );
	const target = s.interact.get( up ? 'towerUp' : 'towerDown' ).at, look = target.clone().sub( app.camera.position ).normalize();
	p.yaw = Math.atan2( -look.x, -look.z ); p.pitch = Math.asin( look.y ); p.update( 0 ); app.cameraCut();
	s.ui.travel = async ( label, move, animate ) => {
		let arrived = false;
		for ( const progress of [ 0, .2, .28, .7, .82, 1 ] ) {
			if ( progress >= .5 && ! arrived ) { move(); arrived = true; }
			animate( progress, arrived ); app.cameraCut();
			await shot( `${ direction}-${ String( Math.round( progress * 100 ) ).padStart( 3, '0' ) }`, progress, arrived );
		}
	};
	assert.equal( await s.towerTravel.go( up ), true );
}
writeSheet( resolve( out, 'review.png' ), shots, 3 );
await GPU.pipelinesReady(); await GPU.queue.onSubmittedWorkDone();
const validation = await GPU.device.popErrorScope(); assert.equal( validation, null, validation?.message ); assert.deepEqual( errors, [] );
writeFileSync( resolve( out, 'verification.json' ), JSON.stringify( { evidence, guardNames, gpuErrors: errors, physicalDeviceTested: false }, null, 2 ) + '\n' );
console.log( 'PASS actual renderer: both visible stair paths, no invented gate meshes, no WebGPU validation errors.' );
process.exit( 0 );
