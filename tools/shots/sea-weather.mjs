// Full game rendering with strict WebGPU validation and matched weather comparisons.
import '../../test/headless.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { installBrowser } from './browser.mjs';
import { bgraShot, writePNG, writeSheet } from './png.mjs';
import { GPU } from '../../src/engine/gpu/GPU.js';
import { SeaWeatherState } from '../../src/weather/SeaWeatherState.js';

const W = 960, H = 540, out = resolve( 'artifacts/sea-weather' ), images = new Map();
mkdirSync( out, { recursive: true } );
installBrowser( { search: '?weatherPreview&bench&noAudio&adapt', width: W, height: H, root: resolve( 'public' ),
	onPost: async ( url, body ) => {
		const name = decodeURIComponent( url.split( '/' ).pop() ).replace( /\.bgra$/, '' );
		const shot = bgraShot( Buffer.from( body.buffer, body.byteOffset, body.byteLength ) );
		images.set( name, shot ); writePNG( `${ out }/${ name }.png`, shot.w, shot.h, shot.rgba );
		console.log( 'rendered', name );
	},
} );
await import( '../../src/core/BenchSeed.js' );
const { App } = await import( '../../src/App.js' );
const { Bench } = await import( '../../src/core/Bench.js' );
const errors = [], init = GPU.init.bind( GPU );
GPU.init = async ( options ) => {
	const result = await init( options );
	GPU.device.addEventListener( 'uncapturederror', ( e ) => errors.push( e.error.message ) );
	GPU.device.pushErrorScope( 'validation' );
	return result;
};
const app = new App();
let stage = '';
await app.init( ( p, text ) => { if ( stage !== text ) console.log( `${ Math.round( p * 100 ) }% ${ stage = text }` ); } );
const bench = new Bench( app );
app.post.autoExposure.snap.value = 1;
const views = [ 'fCliffGale', 'fWestWatch', 'fYard', 'dRoom' ];
for ( const preset of [ 'gale', 'settled' ] ) {
	app.seaWeather.model = new SeaWeatherState( preset ); app.seaWeather.update( 0 );
	await bench.shots( views, { tag: preset, frames: 48, dt: 0.1, width: W, height: H, time: 12.4 } );
	writeSheet( `${ out }/${ preset }-sheet.png`, views.map( ( v ) => images.get( `${ preset }-${ v }` ) ), 2 );
}
await GPU.pipelinesReady(); await GPU.queue.onSubmittedWorkDone();
const validation = await GPU.device.popErrorScope();
assert.equal( validation, null, validation?.message ); assert.deepEqual( errors, [] );
const a = images.get( 'gale-fCliffGale' ).rgba, b = images.get( 'settled-fCliffGale' ).rgba;
let difference = 0;
for ( let i = 0; i < a.length; i ++ ) difference += Math.abs( a[ i ] - b[ i ] );
assert.ok( difference > W * H, 'gale and settled conditions must visibly differ' );
writeFileSync( `${ out }/render-result.json`, JSON.stringify( { views, conditions: [ 'gale', 'settled' ], validationErrors: [], difference,
	sampledTextureLimit: GPU.limits.maxSampledTexturesPerShaderStage, note: 'Rendering comparison; not sustained performance or physical audio acceptance.' }, null, 2 ) );
console.log( 'PASS full scene: cliff/water/rain/wet materials in gale and settled weather, no GPU validation errors.' );
process.exit( 0 );
