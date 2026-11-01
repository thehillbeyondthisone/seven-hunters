// Matched, fixed-exposure views of the carried lantern in the actual renderer.
import '../../test/headless.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { installBrowser } from './browser.mjs';
import { bgraShot, writePNG, writeSheet } from './png.mjs';

const width = 960, height = 600, out = resolve( 'artifacts/lantern-light', process.argv[ 2 ] || 'after' );
const compareShadows = process.argv.includes( '--compare-shadows' ), measure = process.argv.includes( '--timings' );
mkdirSync( out, { recursive: true } );
installBrowser( { search: '?bench&noAudio&handlamp', width, height, root: resolve( 'public' ) } );
await import( '../../src/core/BenchSeed.js' );
const { App } = await import( '../../src/App.js' );
const { GPU } = await import( '../../src/engine/gpu/GPU.js' );
const { Texture } = await import( '../../src/engine/gpu/Texture.js' );
const { readTexture } = await import( '../../src/engine/gpu/Readback.js' );
const { G } = await import( '../../src/core/Globals.js' );
const { Vector3 } = await import( '../../src/engine/index.js' );
const { Bench } = await import( '../../src/core/Bench.js' );
const errors = [], init = GPU.init.bind( GPU );
GPU.init = async options => {

	const result = await init( options ); GPU.device.pushErrorScope( 'validation' );
	GPU.device.addEventListener( 'uncapturederror', event => errors.push( event.error.message ) ); return result;

};
const app = new App();
await app.init( ( p, text ) => { if ( text ) console.log( `${ Math.round( p * 100 ) }% ${ text }` ); } );
app.engine.stop(); app.setFreeCam( true ); app.handInView = true;
app.settings.timeOfDay = 19; app.settings.timeSpeed = 0;
app.post.autoExposure.enabled.value = 0; app.settings.exposure = 1;
app.handLamp.carried = true; app.handLamp.lit = true; app.handLamp.glow = 1;
app.handLamp._t = 2;
const bench = measure ? new Bench( app ) : null;
if ( measure ) assert( bench.enabled, 'GPU timestamp-query is required for performance measurements' );
const output = new Texture( { width, height, format: GPU.format, usage: [ 'render', 'copySrc', 'sample' ] } );
app.post.outputTexture = output;
const shots = [], evidence = [], timings = [];
for ( const [ name, eye, target ] of [
	[ 'room', [ -.4, 82.67, 4.4 ], [ -6.8, 82.1, .1 ] ],
	[ 'desk', [ -5, 82.67, .35 ], [ -6.7, 81.84, -.6 ] ],
	[ 'berth', [ -2.7, 82.67, 12.1 ], [ -.5, 82.3, 10.5 ] ],
	[ 'yard', [ 5, 82.22, 5 ], [ -1, 82.1, 4.7 ] ],
] ) {

	const dir = new Vector3( ...target ).sub( new Vector3( ...eye ) ).normalize();
	app.fly.setPose( new Vector3( ...eye ), Math.atan2( -dir.x, -dir.z ), Math.asin( dir.y ) );
	app.handLamp.resetMotion();
	for ( const enabled of compareShadows ? [ false, true ] : [ true ] ) {
	app.handLampShadows.enabled = enabled; app.cameraCut();
	let maxShadowTriangles = 0, maxShadowDraws = 0;
	for ( let i = 0; i < 32; i ++ ) {
		app.frame( 0 ); await GPU.queue.onSubmittedWorkDone();
		maxShadowTriangles = Math.max( maxShadowTriangles, app.handLampShadows.stats.triangles );
		maxShadowDraws = Math.max( maxShadowDraws, app.handLampShadows.stats.draws );
	}
	const raw = await readTexture( output ), bytes = new Uint8Array( 8 + raw.data.byteLength );
	new Uint32Array( bytes.buffer, 0, 2 ).set( [ width, height ] ); bytes.set( new Uint8Array( raw.data ), 8 );
	const shot = bgraShot( Buffer.from( bytes ) ); shots.push( shot );
	const file = name + ( compareShadows ? enabled ? '-shadows' : '-unshadowed' : '' );
	writePNG( resolve( out, file + '.png' ), width, height, shot.rgba );
	evidence.push( { name, file, shadows: enabled, eye, target, exposure: G.exposure.value, airLamps: app.roomAir.uniforms.fields.lampCount.value, light: app.localLights.flashlight.intensity, maxShadowTriangles, maxShadowDraws } );
	console.log( 'captured', file, maxShadowTriangles, 'shadow triangles' );
	}
	if ( measure && [ 'room', 'desk' ].includes( name ) ) for ( const [ label, enabled ] of [ [ 'off-before', false ], [ 'on-refresh-every-frame', true ], [ 'off-after', false ] ] ) {
		app.handLampShadows.enabled = enabled;
		bench.frames = []; bench._capture = true;
		for ( let i = 0; i < 24; i ++ ) {
			// Worst case for a moving source, with an otherwise matched scene.
			app.handLampShadows.valid = false;
			app.frame( 0 ); await GPU.queue.onSubmittedWorkDone();
		}
		bench._capture = false;
		for ( let i = 0; i < 100 && bench.frames.length < 24; i ++ ) await new Promise( r => setTimeout( r, 5 ) );
		assert.equal( bench.frames.length, 24 );
		const total = bench.frames.map( f => f.gpu ), shadows = bench.frames.map( f => [ ...f.passes ].filter( ([key]) => key.startsWith( 'lantern shadow ' ) ).reduce( (sum,[,ms]) => sum + ms, 0 ) );
		const mean = values => values.reduce( (a,b) => a+b, 0 ) / values.length;
		timings.push( { view: name, label, meanGpuMs: mean( total ), meanShadowGpuMs: mean( shadows ), rawGpuMs: total, rawShadowGpuMs: shadows } );
		console.log( name, label, mean( total ).toFixed( 3 ), 'ms GPU;', mean( shadows ).toFixed( 3 ), 'ms shadow maps' );
	}

}
writeSheet( resolve( out, 'review.png' ), shots, 2 );
await GPU.pipelinesReady(); await GPU.queue.onSubmittedWorkDone();
const validation = await GPU.device.popErrorScope(); assert.equal( validation, null, validation?.message ); assert.deepEqual( errors, [] );
writeFileSync( resolve( out, 'verification.json' ), JSON.stringify( { evidence, gpuErrors: errors, timings, method: measure ? 'Native Dawn/WebGPU timestamps, 24 full-scene frames per block, off/on/off controls, force all six shadow faces to refresh every on frame. Fixed 960x600 camera/exposure/time. Does not measure browser presentation or physical phone performance.' : 'Matched native fixed-exposure captures.' }, null, 2 ) );
console.log( 'PASS full-scene lantern lighting captures; no GPU validation errors.' );
process.exit( 0 );
