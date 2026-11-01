// Reproducible native scene review; --baseline reads the preserved pre-pass source tree.
// node tools/shots/landscape-pass.mjs [--baseline] [--mobile] [--views=approach,turf,...] [--motion]
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { installBrowser } from './browser.mjs';
import { bgraShot, writePNG } from './png.mjs';

const option = ( key, fallback ) => process.argv.find( a => a.startsWith( `--${key}=` ) )?.slice( key.length + 3 ) ?? fallback;
const baseline = process.argv.includes( '--baseline' ), mobile = process.argv.includes( '--mobile' );
if ( mobile ) process.env.WEBGPU_DEFAULT_LIMITS = '1';
await import( '../../test/headless.mjs' );
const source = baseline ? 'artifacts/landscape-pass/baseline-src/src' : 'src';
const load = name => import( pathToFileURL( resolve( source, name ) ).href );
const tag = baseline ? 'before' : 'after';
const timingsOnly = process.argv.includes( '--timings-only' );
const width = Number( option( 'width', mobile ? 844 : 1280 ) ), height = Number( option( 'height', mobile ? 550 : 800 ) );
const out = resolve( 'artifacts/landscape-pass', mobile ? 'mobile' : 'desktop' );
mkdirSync( out, { recursive: true } );
const files = [ 'App.js', 'world/flannan/Sward.js', 'world/Terrain.js', 'world/flannan/MaritimeTurf.js', 'world/flannan/Station.js', 'world/flannan/KeepsakesRooms.js', 'world/flannan/RoomAirLayout.js', 'world/flannan/DaySignals.js', 'world/flannan/BedroomWindows.js', 'post/AirHaze.js', 'post/CoastalMist.js' ];
const hashes = Object.fromEntries( files.filter( name => existsSync( resolve( source, name ) ) ).map( name => [ name, createHash( 'sha256' ).update( readFileSync( resolve( source, name ) ) ).digest( 'hex' ) ] ) );
installBrowser( {

	search: '?bench&noAudio&setting=flannan&adapt&lamp' + ( mobile ? '&mobile' : '' ), width, height, root: resolve( 'public' ),
	onPost: async ( url, body ) => {
		const name = decodeURIComponent( url.split( '/' ).pop() ).replace( /\.bgra$/, '' );
		const shot = bgraShot( Buffer.from( body.buffer, body.byteOffset, body.byteLength ) );
		writePNG( resolve( out, name + '.png' ), shot.w, shot.h, shot.rgba );
		console.log( 'saved', name );
	},

} );
await load( 'core/BenchSeed.js' );
const { App } = await load( 'App.js' );
const { Bench } = await load( 'core/Bench.js' );
const { GPU } = await load( 'engine/gpu/GPU.js' );
const { G } = await load( 'core/Globals.js' );
const { VIEWS } = await load( 'core/DebugViews.js' );
const { Vector3 } = await load( 'engine/index.js' );
const { readTexture } = await load( 'engine/gpu/Readback.js' );
const errors = [], init = GPU.init.bind( GPU );
GPU.init = async options => {
	const result = await init( options );
	GPU.device.addEventListener( 'uncapturederror', event => errors.push( event.error.message ) );
	GPU.device.pushErrorScope( 'validation' );
	return result;
};
const views = {
	approach: { ...VIEWS.fApproach, label: 'The working station above the approach' },
	turf: { p: [ -44, 0, 48 ], terrainEye: 1.62, at: [ -35, 0, 40 ], terrainTarget: .25, fov: 68, time: 12.4, label: 'Walking-height maritime turf and worn ground' },
	path: { p: [ -32, 0, 35 ], terrainEye: 1.62, at: [ -24, 0, 28 ], terrainTarget: .3, fov: 70, time: 12.4, label: 'The worn edge of the station approach' },
	slope: { ...VIEWS.fTurf, label: 'Grass continuing into the distant slope' },
	bedroom: { p: [ -11.5, 82.67, 3.1 ], at: [ -12.9, 82.4, -1.6 ], fov: 69, time: 12.4, label: 'North light in the keeper’s bedroom' },
	spare: { p: [ -17.3, 82.67, 2.2 ], at: [ -18.8, 82.6, 5.7 ], fov: 74, time: 12.4, label: 'Winter daylight in the spare bedroom' },
	signals: { p: [ 6.8, 101.1, 8.5 ], at: [ 0, 101, 0 ], fov: 70, time: 12.4, label: 'Balcony daylight assistance-signal fittings' },
	eastCoast: { ...VIEWS.fEastSea, label: 'Low drifting mist around the east landing' },
	westCoast: { ...VIEWS.fWestLanding, label: 'Broken coastal mist in the west geo' },
	night: { ...VIEWS.dYardMoon, label: 'Maintained station and turf at night' },
};
for ( const [ name, view ] of Object.entries( views ) ) {
	const [ x, y, z ] = view.p, [ a, b, c ] = view.at;
	VIEWS[ name ] = { ...view, yaw: Math.atan2( x - a, z - c ), pitch: Math.atan2( b - y, Math.hypot( a - x, c - z ) ) };
}
const selected = option( 'views', 'approach,turf,path,slope,bedroom,spare,signals,eastCoast,westCoast,night' ).split( ',' );
for ( const name of selected ) assert( views[ name ], `Unknown landscape camera ${name}` );
const app = new App();
let stage = '';
await app.init( ( fraction, label ) => { if ( label !== stage ) console.log( `${Math.round( fraction * 100 )}% ${stage = label}` ); } );
app.engine.stop();
const bench = new Bench( app ), resize = bench.setSize.bind( bench );
bench.setSize = ( w = width, h = height ) => resize( w, h );
app.post.autoExposure.snap.value = 1;
const report = {
	createdAt: new Date().toISOString(), tag, source, hashes, width, height, mobile,
	method: 'Same cameras, frozen simulation time 1000, 48 settling frames, native game renderer. Separate immutable before-source snapshot. Timings are bounded desktop samples, not sustained browser/mobile frame rates.',
	adapter: GPU.adapter.info?.description ?? null, textureLimit: GPU.limits.maxSampledTexturesPerShaderStage,
	views: Object.fromEntries( selected.map( name => [ name, views[ name ] ] ) ), errors,
};
if ( ! timingsOnly ) await bench.shots( selected, { tag, width, height, frames: 48, dt: 0 } );
else {
 const previous = JSON.parse( readFileSync( resolve( out, `${tag}-verification.json` ), 'utf8' ) );
 report.motion = previous.motion;
 report.timingRun = 'Rerun with live browser paused, other scene render processes stopped.';
}
if ( timingsOnly || process.argv.includes( '--timings' ) ) {
	report.timings = [];
	for ( let round = 0; round < 3; round++ ) report.timings.push( await bench.run( { views: selected.filter( n => [ 'turf', 'approach', 'eastCoast', 'bedroom' ].includes( n ) ), warm: 12, frames: 32, dt: 0, top: 8 } ) );
}
if ( process.argv.includes( '--motion' ) ) {
	bench.pose( 'path' );
	app.post.outputTexture = bench._out;
	const frames = 180, samples = [], velocitySamples = [];
	try {
		for ( let frame = 0; frame < frames; frame++ ) {
			const t = frame / ( frames - 1 ), x = -48 + 17 * t, z = 45 - 10 * t;
			const eye = new Vector3( x, app.terrainData.heightAt( x, z ) + 1.62, z );
			const target = new Vector3( -10, 84, 12 ), delta = target.clone().sub( eye );
			app.fly.setPose( eye, Math.atan2( -delta.x, -delta.z ), Math.atan2( delta.y, Math.hypot( delta.x, delta.z ) ) );
			app.frame( 1 / 30 );
			await GPU.queue.onSubmittedWorkDone();
			assert( [ ...app.camera.position.toArray() ].every( Number.isFinite ), 'finite moving camera' );
			if ( frame % 15 === 0 || frame === frames - 1 ) {
				const velocity = await readTexture( app.sceneRenderer.velocityTexture );
				const half = new Uint16Array( velocity.data );
				let invalid = 0;
				for ( const component of half ) if ( ( component & 0x7c00 ) === 0x7c00 ) invalid++;
				velocitySamples.push( { frame, invalidComponents: invalid, checkedComponents: half.length } );
				assert.equal( invalid, 0, 'moving scene velocity must contain no NaN or infinity' );
				const raw = await readTexture( bench._out );
				const body = new Uint8Array( 8 + raw.data.byteLength );
				new Uint32Array( body.buffer, 0, 2 ).set( [ raw.width, raw.height ] );
				body.set( new Uint8Array( raw.data ), 8 );
				const shot = bgraShot( Buffer.from( body.buffer ) );
				const filename = `${tag}-walk-${String( frame ).padStart( 3, '0' )}.png`;
				writePNG( resolve( out, filename ), raw.width, raw.height, shot.rgba );
				samples.push( filename );
			}
		}
	} finally { app.post.outputTexture = null; }
	report.motion = { frames, simulatedSeconds: 6, travelledMetres: Math.hypot( 17, 10 ), samples, velocitySamples, status: 'Continuous camera and simulation across grass cells/LOD; no camera cuts during traversal.' };
}
await GPU.pipelinesReady();
await GPU.queue.onSubmittedWorkDone();
const validation = await GPU.device.popErrorScope();
if ( validation ) errors.push( validation.message );
report.hashesUnchanged = Object.entries( hashes ).every( ( [ name, hash ] ) => createHash( 'sha256' ).update( readFileSync( resolve( source, name ) ) ).digest( 'hex' ) === hash );
writeFileSync( resolve( out, `${tag}-verification.json` ), JSON.stringify( report, null, 2 ) );
assert.deepEqual( errors, [] );
assert( report.hashesUnchanged, 'source must remain unchanged during review' );
console.log( 'PASS landscape captures and native GPU validation', out );
process.exit( 0 );
