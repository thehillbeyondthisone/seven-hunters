// The complete scene, including the actual AirHaze colored-beam shader.
import './headless.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { installBrowser } from '../tools/shots/browser.mjs';
import { bgraShot, writePNG } from '../tools/shots/png.mjs';
import { GPU } from '../src/engine/gpu/GPU.js';

const W = 1100, H = 720, out = resolve( 'artifacts/playground' ), images = new Map(); mkdirSync( out, { recursive: true } );
installBrowser( { search: '?playground&bench&noAudio', width: W, height: H, root: resolve( 'public' ), onPost: async ( url, body ) => {
	const name = decodeURIComponent( url.split( '/' ).pop() ).replace( /\.bgra$/, '' ), shot = bgraShot( Buffer.from( body.buffer, body.byteOffset, body.byteLength ) );
	images.set( name, shot ); writePNG( `${ out }/${ name }.png`, shot.w, shot.h, shot.rgba );
} } );
await import( '../src/core/BenchSeed.js' );
const { App } = await import( '../src/App.js' ), { Bench } = await import( '../src/core/Bench.js' ), { VIEWS } = await import( '../src/core/DebugViews.js' );
VIEWS.playgroundYard = { p: [ - 11, 82.27, 14 ], yaw: -.48, pitch: -.12, fov: 65, time: 12.4 };
VIEWS.playgroundDisco = { p: [ - 14, 78, 34 ], yaw: Math.atan2( - 14, 34 ), pitch: Math.atan2( 17, Math.hypot( 14, 34 ) ), fov: 65, time: 18.8 };
const errors = [], init = GPU.init.bind( GPU );
GPU.init = async opts => { const result = await init( opts ); GPU.device.addEventListener( 'uncapturederror', e => errors.push( e.error.message ) ); GPU.device.pushErrorScope( 'validation' ); return result; };
const app = new App(); let stage = '';
await app.init( ( p, text ) => { if ( text !== stage ) console.log( `${ Math.round( p * 100 ) }% ${ stage = text }` ); } );
assert.ok( app.qs.has( 'nostory' ) && app.playground ); assert.equal( app.story, undefined );
const bench = new Bench( app ); app.handInView = true; app.post.autoExposure.snap.value = 1;
await bench.shots( [ 'playgroundYard' ], { tag: 'ready', frames: 6, dt: .016, width: W, height: H, time: 12.4 } );
app.playground.bodies[ 0 ].mesh.position.copy( app.camera.position ).addScaledVector( app.playground.direction, 3 );
app.playground.held = app.playground.bodies[ 0 ]; app.playground.reach = 3;
await bench.shots( [ 'playgroundYard' ], { tag: 'holding', frames: 12, dt: .016, width: W, height: H, time: 12.4 } );
assert.equal( app.playground.held, app.playground.bodies[ 0 ] ); assert.ok( app.playground.tethers.every( t => t.visible ) );
app.playground.drop(); app.playground.equipped = false;
app.playground.disco.setEnabled( true );
for ( const palette of [ 'prism', 'aurora', 'sunset' ] ) {
	app.playground.disco.configure( { palette } ); app.playground.disco.phase = palette === 'prism' ? 2 : palette === 'aurora' ? 6 : 9;
	await bench.shots( [ 'playgroundDisco' ], { tag: `disco-${ palette }`, frames: 8, dt: .016, width: W, height: H, time: 18.8 } );
	assert.ok( app.camera.matrixWorld.elements.every( Number.isFinite ), 'review camera stays finite' );
}
app.playground.disco.setEnabled( false );
assert.equal( app.settings.timeOfDay, 12.4, 'stopping disco restores the daylight inspection clock' );
await bench.shots( [ 'playgroundDisco' ], { tag: 'disco-stopped', frames: 6, dt: .016, width: W, height: H, time: app.settings.timeOfDay } );
await GPU.pipelinesReady(); await GPU.queue.onSubmittedWorkDone(); const validation = await GPU.device.popErrorScope(); assert.equal( validation, null, validation?.message ); assert.deepEqual( errors, [] );
const lit = images.get( 'disco-prism-playgroundDisco' ).rgba, plain = images.get( 'disco-stopped-playgroundDisco' ).rgba;
let changed = 0; for ( let i = 0; i < lit.length; i ++ ) changed += Math.abs( lit[ i ] - plain[ i ] ); assert.ok( changed > W * H, 'disco materially changes the lighthouse render' );
let paletteChanged = 0; const aurora = images.get( 'disco-aurora-playgroundDisco' ).rgba;
for ( let i = 0; i < lit.length; i ++ ) paletteChanged += Math.abs( lit[ i ] - aurora[ i ] );
assert.ok( paletteChanged > W * H * .1, 'different palettes change the visible nighttime beams' );
for ( const [ name, shot ] of images ) {
	let visible = 0, dark = 0;
	for ( let i = 0; i < shot.rgba.length; i += 4 ) { const sum = shot.rgba[ i ] + shot.rgba[ i + 1 ] + shot.rgba[ i + 2 ]; if ( sum > 20 && sum < 740 ) visible ++; if ( sum < 300 ) dark ++; }
	assert.ok( visible > W * H * .05 && dark > W * H * .05, `${ name } contains a visible scene, not a blank or blown-out frame` );
}
writeFileSync( `${ out }/verification.json`, JSON.stringify( { validationErrors: [], checks: [ 'actual island and held model', 'visible suspended buoy and tether', 'three lighthouse beam palettes', 'disco stop', 'no story constructed' ], physicalDeviceTested: false }, null, 2 ) );
console.log( 'PASS full native WebGPU playground: held grabber, suspended buoy/tether, three disco palettes, reset, no shader/validation errors.' ); process.exit( 0 );
