// Matched native full-scene captures and bracketed GPU timestamps for station room air.
// node tools/shots/room-air.mjs [--mobile] [--mode=all|captures|timings]
// [--views=room,kitchen,berth,west,lamp,exterior --width=1340 --height=880]
// [--frames=32 --warm=16 --rounds=3 --captureFrames=48 --out=artifacts/room-air/desktop]
// Mobile is a 16-sampled-texture compatibility/render profile on the SAME desktop GPU.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { installBrowser } from './browser.mjs';
import { bgraShot, writePNG } from './png.mjs';

const arg = ( name, fallback ) => process.argv.find( a => a.startsWith( `--${name}=` ) )?.slice( name.length + 3 ) ?? fallback;
const positive = ( name, fallback ) => {

	const n = Number( arg( name, fallback ) );
	assert( Number.isInteger( n ) && n > 0, `${name} must be a positive integer` );
	return n;

};
const mobile = process.argv.includes( '--mobile' );
const mode = arg( 'mode', mobile ? 'captures' : 'all' );
assert( [ 'all', 'captures', 'timings' ].includes( mode ), '--mode must be all, captures or timings' );
if ( mobile ) process.env.WEBGPU_DEFAULT_LIMITS = '1';
await import( '../../test/headless.mjs' );
const width = positive( 'width', mobile ? 844 : 1340 ), height = positive( 'height', mobile ? 550 : 880 );
const frames = positive( 'frames', 32 ), warm = positive( 'warm', 16 ), rounds = positive( 'rounds', 3 );
const captureFrames = positive( 'captureFrames', 48 );
const out = resolve( arg( 'out', `artifacts/room-air/${mobile ? 'mobile' : 'desktop'}` ) );
const selected = arg( 'views', 'room,kitchen,berth,west,lamp,exterior' ).split( ',' );
const sourceFiles = [ 'src/App.js', 'src/post/RoomAir.js', 'src/post/AirHaze.js', 'src/post/PostFX.js', 'src/world/flannan/RoomAirLayout.js', 'src/world/flannan/StationLighting.js', 'src/world/flannan/StationMaterials.js', 'src/materials/LocalLights.js', 'src/core/Bench.js', 'tools/shots/room-air.mjs' ];
const hash = file => createHash( 'sha256' ).update( readFileSync( resolve( file ) ) ).digest( 'hex' );
// Snapshot BEFORE importing production modules. A file edited during native
// startup must never be misrepresented as the code this process has loaded.
const sourceHashes = Object.fromEntries( sourceFiles.filter( existsSync ).map( file => [ file, hash( file ) ] ) );
mkdirSync( out, { recursive: true } );
const captured = new Map();
installBrowser( {
	search: '?bench&noAudio&setting=flannan&adapt&lamp' + ( mobile ? '&mobile' : '' ),
	width, height, root: resolve( 'public' ),
	onPost: async ( url, body ) => {

		const name = decodeURIComponent( url.split( '/' ).pop() ).replace( /\.bgra$/, '' );
		const shot = bgraShot( Buffer.from( body.buffer, body.byteOffset, body.byteLength ) );
		writePNG( resolve( out, name + '.png' ), shot.w, shot.h, shot.rgba );
		captured.set( name, shot.rgba );
		console.log( 'saved', name );

	},
} );
await import( '../../src/core/BenchSeed.js' );
const { App } = await import( '../../src/App.js' );
const { startBench } = await import( '../../src/core/Bench.js' );
const { GPU } = await import( '../../src/engine/gpu/GPU.js' );
const { G } = await import( '../../src/core/Globals.js' );
const { VIEWS } = await import( '../../src/core/DebugViews.js' );
const errors = [], init = GPU.init.bind( GPU );
GPU.init = async options => {

	const result = await init( options );
	GPU.device.addEventListener( 'uncapturederror', event => errors.push( event.error.message ) );
	GPU.device.pushErrorScope( 'validation' );
	return result;

};
const views = {
	room: { p: [ -.4, 82.67, 4.4 ], at: [ -6.8, 82.1, .1 ], fov: 65, time: 14.2, label: 'Keepers’ room · winter afternoon' },
	kitchen: { p: [ -4.2, 82.67, 6.9 ], at: [ .9, 82.5, 9.6 ], fov: 74, time: 9.1, label: 'Kitchen · first winter light at the east window' },
	berth: { p: [ -.4, 82.67, 11.4 ], at: [ -3.5, 82.5, 14.6 ], fov: 72, time: 12.0, label: 'Berth · low winter sun through south windows' },
	berthSide: { p: [ 0, 82.6, 13 ], at: [ -4.7, 82.3, 13 ], fov: 68, time: 12.0, label: 'Berth · noon shafts seen from the side' },
	west: { p: [ -.4, 82.67, 11.4 ], at: [ -5.8, 82.5, 12 ], fov: 72, time: 14.9, label: 'Berth · last winter light at the west window' },
	lamp: { p: [ -5, 82.67, .35 ], at: [ -6.7, 81.84, -.6 ], fov: 62, time: 19, label: 'Desk lamp · night' },
	exterior: { ...VIEWS.fApproach, label: 'Exterior · room-air pass should be skipped' },
};
for ( const [ name, v ] of Object.entries( views ) ) {

	const [ x, y, z ] = v.p, [ a, b, c ] = v.at;
	VIEWS[ name ] = { ...v, yaw: Math.atan2( x - a, z - c ), pitch: Math.atan2( b - y, Math.hypot( a - x, c - z ) ) };

}
for ( const name of selected ) assert( views[ name ], `Unknown room-air camera: ${name}` );
const app = new App();
let stage = '';
await app.init( ( p, label ) => { if ( label !== stage ) console.log( `${Math.round( p * 100 )}% ${stage = label}` ); } );
app.engine.stop();
const bench = startBench( app );
const roomAir = app.roomAir || app.post.roomAir;
assert( roomAir && 'strength' in roomAir, 'RoomAir.strength API required for matched controls' );
const strength = n => {

	if ( typeof roomAir.strength === 'object' ) roomAir.strength.value = n;
	else roomAir.strength = n;

};
bench.setSize( width, height );
app.seaWeather?.reset();
const round = n => Number( n.toFixed( 6 ) );
const stats = values => {

	const sorted = values.slice().sort( ( a, b ) => a - b );
	const mean = sorted.reduce( ( a, b ) => a + b, 0 ) / sorted.length;
	const median = sorted.length % 2 ? sorted[ sorted.length >> 1 ] : ( sorted[ sorted.length / 2 - 1 ] + sorted[ sorted.length / 2 ] ) / 2;
	return { mean: round( mean ), median: round( median ), p95: round( sorted[ Math.ceil( sorted.length * .95 ) - 1 ] ), min: round( sorted[ 0 ] ), max: round( sorted.at( -1 ) ) };

};
const adapter = GPU.adapter.info;
const adapterInfo = Object.fromEntries( [ 'vendor', 'architecture', 'device', 'description', 'isFallbackAdapter' ].map( k => [ k, adapter?.[ k ] ?? GPU.adapter[ k ] ?? null ] ) );
const result = {
	createdAt: new Date().toISOString(),
	command: [ 'node', 'tools/shots/room-air.mjs', ...process.argv.slice( 2 ) ].join( ' ' ),
	sources: sourceHashes,
	runtime: { kind: 'native Dawn/WebGPU; inert browser DOM; offscreen full-scene rendering', node: process.version, adapter: adapterInfo, timestampQuery: GPU.hasTimestamp, browserMeasured: false, physicalMobileMeasured: false, mobileRenderProfile: mobile, textureLimit: GPU.limits.maxSampledTexturesPerShaderStage },
	method: { width, height, frames, warm, rounds, captureFrames, selected, dt: 0, clock: 1000, strengths: [ 0, 1, 3 ], lighting: 'Station oil lamps follow normal time-of-day selection; carried hand lantern remains unlit, so daylight captures isolate actual sun apertures.', exposure: 'Adapt baseline strength 0, then freeze the same metered exposure for all treatments at each camera; reset temporal history at every treatment.', controls: 'Repeated control-before, alternating default/stress order, control-after. Each treatment minus the average of its bracketing controls. No outlier removal.', queue: 'At most two frames in flight; full-scene GPU timestamps; all raw measurements retained.', limits: 'Native GPU timings exclude browser presentation, input, audio, physical-phone performance, and sustainable frame rate. Mobile is a compatibility profile on this desktop GPU. Small paired deltas within round-to-round variation are inconclusive.' },
	views: Object.fromEntries( selected.map( name => [ name, views[ name ] ] ) ),
	blocks: [], comparisons: [], captures: [],
};
const persist = () => writeFileSync( resolve( out, 'verification.json' ), JSON.stringify( result, null, 2 ) );
const started = performance.now();
const isRoomAir = name => /room.?air/i.test( name );
const airState = () => {

	const passes = [ ...( roomAir.activePassNames || [] ) ];
	return {
		room: passes.length ? roomAir.activeRoom?.id ?? roomAir.activeRoom?.name ?? null : null,
		activePassNames: passes,
		windows: passes.length ? roomAir.uniforms?.fields.windowCount.value ?? null : 0,
		lamps: passes.length ? roomAir.uniforms?.fields.lampCount.value ?? null : 0,
		marchDimensions: roomAir.low ? [ roomAir.low.width, roomAir.low.height ] : null,
	};

};

async function settle( value, count ) {

	strength( value );
	app.cameraCut?.();
	G.time.value = 1000;
	await bench._frames( count, 0 );
	await GPU.pipelinesReady();

}

async function sample( view, repetition, name, value ) {

	await settle( value, warm );
	bench.frames = [];
	bench._capture = true;
	const begin = performance.now();
	await bench._frames( frames, 0 );
	const wall = ( performance.now() - begin ) / frames;
	bench._capture = false;
	for ( let k = 0; k < 100 && bench.frames.length < frames; k++ ) await new Promise( r => setTimeout( r, 5 ) );
	assert.equal( bench.frames.length, frames, 'Every GPU timestamp frame must be returned' );
	const passNames = [ ...new Set( bench.frames.flatMap( f => [ ...f.passes.keys() ] ) ) ];
	const airNames = passNames.filter( isRoomAir );
	const block = {
		view, repetition, name, strength: value, gpuMs: stats( bench.frames.map( f => f.gpu ) ),
		roomAirMs: stats( bench.frames.map( f => airNames.reduce( ( sum, p ) => sum + ( f.passes.get( p ) || 0 ), 0 ) ) ),
		roomAirPasses: airNames, wallThroughputMs: round( wall ),
		roomAirState: airState(),
		passes: Object.fromEntries( passNames.map( p => [ p, stats( bench.frames.map( f => f.passes.get( p ) || 0 ) ) ] ) ),
		rawGpuMs: bench.frames.map( f => round( f.gpu ) ),
		actualDimensions: { output: [ app.post._outW, app.post._outH ], internal: [ app.post._inW, app.post._inH ] },
	};
	if ( view === 'exterior' || value === 0 ) assert.equal( airNames.length, 0, `${view} strength=${value} must skip all RoomAir GPU passes` );
	result.blocks.push( block );
	console.log( `${view} #${repetition} ${name}: ${block.gpuMs.mean.toFixed( 3 )} ms GPU, room air ${block.roomAirMs.mean.toFixed( 3 )} ms (${airNames.length} passes)` );
	persist();
	return block;

}

function imageDifference( before, after ) {

	let sum = 0, changed = 0, max = 0;
	for ( let i = 0; i < before.length; i += 4 ) {

		let pixel = 0;
		for ( let c = 0; c < 3; c++ ) { const d = Math.abs( after[ i + c ] - before[ i + c ] ); sum += d; pixel = Math.max( pixel, d ); }
		if ( pixel > 2 ) changed++;
		max = Math.max( max, pixel );

	}
	return { meanAbsoluteRGB8: round( sum / ( before.length / 4 * 3 ) ), changedPixelsAbove2: changed, changedPercentAbove2: round( changed / ( before.length / 4 ) * 100 ), maxChannelDifference: max };

}

if ( mode !== 'captures' ) assert( bench.enabled, 'GPU timestamp-query unavailable: refusing to substitute wall time for GPU costs' );
console.log( 'REVIEW BEGIN', JSON.stringify( adapterInfo ), `${width}x${height}`, mode );
for ( const view of selected ) {

	bench.pose( view );
	app.post.autoExposure.snap.value = 1;
	await settle( 0, captureFrames );
	app.post.autoExposure.snap.value = 0;
	const s = G.sunDir.value;
	result.views[ view ].actualSunDirection = [ s.x, s.y, s.z ];
	if ( mode !== 'timings' ) {

		for ( const [ tag, value ] of [ [ 'off', 0 ], [ 'default', 1 ], [ 'stress', 3 ] ] ) {

			strength( value );
			await bench.shots( [ view ], { tag, frames: captureFrames, width, height, dt: 0 } );
			const entry = { view, strength: value, file: `${tag}-${view}.png`, roomAirState: airState() };
			if ( tag !== 'off' ) entry.pixelDifferenceFromOff = imageDifference( captured.get( `off-${view}` ), captured.get( `${tag}-${view}` ) );
			result.captures.push( entry );
			persist();

		}

	}
	if ( mode !== 'captures' ) {

		const deltas = new Map( [ [ 'default', [] ], [ 'stress', [] ] ] );
		for ( let repetition = 1; repetition <= rounds; repetition++ ) {

			const treatments = repetition % 2 ? [ [ 'default', 1 ], [ 'stress', 3 ] ] : [ [ 'stress', 3 ], [ 'default', 1 ] ];
			const before = await sample( view, repetition, 'control-before', 0 );
			const measured = [];
			for ( const [ tag, value ] of treatments ) measured.push( [ tag, await sample( view, repetition, tag, value ) ] );
			const after = await sample( view, repetition, 'control-after', 0 );
			for ( const [ treatment, block ] of measured ) deltas.get( treatment ).push( {
				repetition,
				meanGpuDeltaMs: round( block.gpuMs.mean - ( before.gpuMs.mean + after.gpuMs.mean ) / 2 ),
				medianGpuDeltaMs: round( block.gpuMs.median - ( before.gpuMs.median + after.gpuMs.median ) / 2 ),
				roomAirMs: block.roomAirMs.mean,
			} );

		}
		for ( const [ treatment, pairs ] of deltas ) result.comparisons.push( {
			view, treatment, meanGpuDeltaMs: stats( pairs.map( p => p.meanGpuDeltaMs ) ), medianGpuDeltaMs: stats( pairs.map( p => p.medianGpuDeltaMs ) ),
			roomAirMs: stats( pairs.map( p => p.roomAirMs ) ), pairs,
		} );
		persist();

	}

}
await GPU.pipelinesReady();
await GPU.queue.onSubmittedWorkDone();
const validation = await GPU.device.popErrorScope();
result.validation = { error: validation?.message ?? null, uncaptured: errors };
result.sourcesChangedWhileRunning = Object.keys( sourceHashes ).filter( file => hash( file ) !== sourceHashes[ file ] );
result.elapsedSeconds = round( ( performance.now() - started ) / 1000 );
if ( result.blocks.length ) {

	const gcd = ( a, b ) => b ? gcd( b, a % b ) : a;
	result.method.observedFrameDurationQuantumNs = result.blocks.flatMap( b => b.rawGpuMs ).reduce( ( q, ms ) => gcd( q, Math.round( ms * 1e6 ) ), 0 );
	result.method.timestampNote = 'Raw frame durations are multiples of the observed quantum. Per-pass zero can reflect quantization; it does not imply zero work. Small paired differences within round-to-round variation are inconclusive.';

}
persist();
assert.equal( validation, null, validation?.message );
assert.deepEqual( errors, [] );
assert.deepEqual( result.sourcesChangedWhileRunning, [], 'Source changed while the review was running; rerun for a matched measurement' );
if ( mobile ) assert.equal( GPU.limits.maxSampledTexturesPerShaderStage, 16 );
const table = result.comparisons.map( c => `<tr><th>${c.view}</th><td>${c.treatment}</td><td>${c.roomAirMs.mean.toFixed( 3 )}</td><td>${c.meanGpuDeltaMs.mean.toFixed( 3 )} [${c.meanGpuDeltaMs.min.toFixed( 3 )}, ${c.meanGpuDeltaMs.max.toFixed( 3 )}]</td></tr>` ).join( '' );
const figures = mode === 'timings' ? '' : selected.map( name => `<section><h2>${views[ name ].label}</h2><p>Same camera, exposure and frozen simulation. Drag to compare off (left) with default (right).</p><div class="compare"><img src="default-${name}.png" alt="${name}, room air at default strength"><div class="before"><img src="off-${name}.png" alt="${name}, room air disabled"></div><i></i></div><label>Comparison split <input aria-label="${name} comparison split" type="range" min="0" max="100" value="50"></label><details><summary>3× strength stress view</summary><img src="stress-${name}.png" alt="${name}, room air at 3× strength"></details></section>` ).join( '' );
writeFileSync( resolve( out, 'index.html' ), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Seven Hunters · room air</title><style>body{max-width:1100px;margin:36px auto;padding:0 20px;background:#111a1e;color:#e2ddce;font:18px/1.55 Georgia}h1,h2{font-weight:normal}h2{font-size:25px}section{margin:42px 0}img{width:100%;display:block}a{color:#c1d9db}.compare{position:relative;overflow:hidden}.before{position:absolute;inset:0;clip-path:inset(0 50% 0 0)}.before img{width:100%;height:100%;object-fit:contain}.compare i{position:absolute;left:50%;top:0;bottom:0;border-left:2px solid #e2ddce;pointer-events:none}label{display:flex;gap:20px;align-items:center;margin:12px 0}input{flex:1}details{margin:18px 0}summary{cursor:pointer;margin:8px 0}table{width:100%;border-collapse:collapse;font:15px/1.5 system-ui}td,th{text-align:left;border-bottom:1px solid #445;padding:9px}</style><h1>Seven Hunters · window shafts & warm lamp air</h1><p>${width} × ${height} · ${mobile ? '16-texture mobile render profile on desktop GPU' : 'native desktop WebGPU'} · strength 0 / 1 / 3. <a href="verification.json">Raw verification and timings</a></p><p>The daylight follows the actual December sun: east kitchen windows in the morning, south berth windows at noon. The north-facing room window receives diffuse sky light.</p>${figures}${table ? `<h2>Matched GPU timings</h2><table><tr><th>Camera</th><th>Strength</th><th>Room air stage (ms)</th><th>Paired total delta (ms), round range</th></tr>${table}</table><p>${result.method.limits}</p>` : ''}<p>GPU validation: ${validation ? 'FAILED' : 'passed'}. ${mobile ? 'This checks rendering compatibility; no physical phone was measured.' : 'Native capture timings do not establish browser frame rate.'}</p><script>document.querySelectorAll('section input').forEach(input=>input.addEventListener('input',()=>{const c=input.closest('section').querySelector('.compare');c.querySelector('.before').style.clipPath='inset(0 '+(100-input.value)+'% 0 0)';c.querySelector('i').style.left=input.value+'%'}));</script></html>` );
console.log( 'REVIEW COMPLETE', out, `${result.elapsedSeconds}s` );
for ( const c of result.comparisons ) console.log( `${c.view} ${c.treatment}: room air ${c.roomAirMs.mean.toFixed( 3 )} ms; paired total delta ${c.meanGpuDeltaMs.mean.toFixed( 3 )} ms [${c.meanGpuDeltaMs.min.toFixed( 3 )}, ${c.meanGpuDeltaMs.max.toFixed( 3 )}]` );
process.exit( 0 );
