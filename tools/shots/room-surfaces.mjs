// Matched room material views through the real WebGPU renderer; no story or saves.
import '../../test/headless.mjs';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { installBrowser } from './browser.mjs';
import { bgraShot, writePNG } from './png.mjs';

const tag = process.argv[ 2 ] || 'after';
const mobile = process.env.SURFACE_REVIEW_MOBILE === '1';
const width = mobile ? 844 : 1340, height = mobile ? 550 : 880;
const directory = resolve( 'artifacts/room-surfaces', tag );
assert( ! ( tag === 'before' && existsSync( resolve( directory, 'capture.json' ) ) ), 'Baseline already captured' );
mkdirSync( directory, { recursive: true } );
installBrowser( {
	search: '?bench&noAudio&setting=flannan&adapt&handlamp' + ( mobile ? '&mobile' : '' ), width, height, root: resolve( 'public' ),
	onPost: async ( url, body ) => {
		const name = decodeURIComponent( url.split( '/' ).pop() ).replace( /\.bgra$/, '' );
		const shot = bgraShot( Buffer.from( body.buffer, body.byteOffset, body.byteLength ) );
		writePNG( resolve( directory, name + '.png' ), shot.w, shot.h, shot.rgba );
		console.log( 'saved', name );
	},
} );
await import( '../../src/core/BenchSeed.js' );
const { App } = await import( '../../src/App.js' );
const { startBench } = await import( '../../src/core/Bench.js' );
const { GPU } = await import( '../../src/engine/gpu/GPU.js' );
const { VIEWS } = await import( '../../src/core/DebugViews.js' );
const wall = { p: [ -5.2, 82.67, 2.65 ], at: [ -9, 82.55, 2.2 ], fov: 70 };
const close = { p: [ -7.1, 82.67, .58 ], at: [ -8.5, 81.65, .45 ], fov: 66 };
const views = {
	wallDay: { ...wall, time: 14.2 },
	wallNight: { ...wall, time: 19.0 },
	dresserDay: { ...close, time: 14.2 },
	dresserNight: { ...close, time: 19.0 },
	table: { p: [ -5.4, 82.67, 1.95 ], at: [ -5.4, 81.7, 3.3 ], fov: 65, time: 14.2 },
};
for ( const [ name, view ] of Object.entries( views ) ) {
	const [ x, y, z ] = view.p, [ tx, ty, tz ] = view.at;
	VIEWS[ name ] = { ...view, yaw: Math.atan2( x - tx, z - tz ), pitch: Math.atan2( ty - y, Math.hypot( tx - x, tz - z ) ) };
}
const errors = [], init = GPU.init.bind( GPU );
GPU.init = async options => {
	const result = await init( options );
	GPU.device.addEventListener( 'uncapturederror', event => errors.push( event.error.message ) );
	GPU.device.pushErrorScope( 'validation' );
	return result;
};
const app = new App();
let stage = '';
await app.init( ( p, message ) => {
	if ( message && message !== stage ) console.log( `${ Math.round( p * 100 ) }% ${ stage = message }` );
} );
const bench = startBench( app );
const selected = process.argv[ 3 ] ? process.argv[ 3 ].split( ',' ) : Object.keys( views );
await bench.shots( selected, { tag, frames: 40, width, height, dt: 0 } );
await GPU.pipelinesReady();
await GPU.device.queue.onSubmittedWorkDone();
const validation = await GPU.device.popErrorScope();
assert.equal( validation, null, validation?.message );
assert.deepEqual( errors, [] );
writeFileSync( resolve( directory, 'capture.json' ), JSON.stringify( { tag, views, selected, width, height, frames: 40, gpuErrors: errors, mobile, textureLimit: GPU.limits.maxSampledTexturesPerShaderStage }, null, 2 ) );
console.log( 'PASS room surfaces: real WebGPU render, no validation errors.' );
process.exit( 0 );
