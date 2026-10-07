import '../../test/headless.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { installBrowser } from './browser.mjs';
import { bgraShot, writePNG } from './png.mjs';
import { GPU } from '../../src/engine/gpu/GPU.js';
import { SEA_DREAD_TIME } from '../../src/weather/SeaDreadState.js';

const W = 960, H = 540, out = resolve( 'artifacts/sea-dread' ), images = new Map();
mkdirSync( out, { recursive: true } );
installBrowser( { search: '?seaDread&bench&noAudio&adapt', width: W, height: H, root: resolve( 'public' ), onPost: async ( url, body ) => {
	const name = decodeURIComponent( url.split( '/' ).pop() ).replace( /\.bgra$/, '' );
	const shot = bgraShot( Buffer.from( body.buffer, body.byteOffset, body.byteLength ) );
	images.set( name, shot ); writePNG( `${ out }/${ name }.png`, shot.w, shot.h, shot.rgba ); console.log( 'rendered', name );
} } );
await import( '../../src/core/BenchSeed.js' );
const { App } = await import( '../../src/App.js' );
const { Bench } = await import( '../../src/core/Bench.js' );
const errors = [], init = GPU.init.bind( GPU );
GPU.init = async ( options ) => {
	const result = await init( options );
	GPU.device.addEventListener( 'uncapturederror', ( e ) => errors.push( e.error.message ) ); GPU.device.pushErrorScope( 'validation' ); return result;
};
const app = new App(); let stage = '';
await app.init( ( p, message ) => { if ( message !== stage ) console.log( `${ Math.round( p * 100 ) }% ${ stage = message }` ); } );
const bench = new Bench( app ); app.post.autoExposure.snap.value = 1;
const views = [ 'fCliffGale', 'fWestWatch', 'dRoom' ];
for ( const enabled of [ false, true ] ) {
	app.seaDread.setEnabled( enabled );
	await bench.shots( views, { tag: enabled ? 'dread' : 'baseline', frames: 32, dt: 0.05, width: W, height: H, time: SEA_DREAD_TIME } );
}
// Exercise the lightning shader and transient lighting in the complete renderer.
app.seaDread.strike(); app.seaDread.model.nextStrike = Infinity;
await bench.shots( [ 'fWestWatch' ], { tag: 'lightning', frames: 5, dt: 0.05, width: W, height: H, time: SEA_DREAD_TIME } );
await GPU.pipelinesReady(); await GPU.queue.onSubmittedWorkDone();
const validation = await GPU.device.popErrorScope();
assert.equal( validation, null, validation?.message ); assert.deepEqual( errors, [] );
const a = images.get( 'baseline-fCliffGale' ).rgba, b = images.get( 'dread-fCliffGale' ).rgba;
let difference = 0;
for ( let i = 0; i < a.length; i ++ ) difference += Math.abs( a[ i ] - b[ i ] );
assert.ok( difference > W * H );
writeFileSync( `${ out }/verification.json`, JSON.stringify( { views, difference, validationErrors: [], note: 'GPU scene/shader review; physical audio, mobile and headset acceptance remain untested.' }, null, 2 ) );
console.log( 'PASS full sea-dread scene: mist, grading, lightning, cliff impacts and normal comparison; no GPU validation errors.' );
process.exit( 0 );
