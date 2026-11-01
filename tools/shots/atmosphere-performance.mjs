// Full-scene native Dawn/WebGPU GPU timestamps. This is not a browser/phone FPS test.
// node tools/shots/atmosphere-performance.mjs [--frames=24 --warm=12 --rounds=3]
// [--width=1340 --height=880 --views=room,lamp,fApproach,dBeams --out=artifacts/atmosphere-performance/native.json]
// Each treatment is bracketed by unchanged control blocks; repeated round deltas expose noise.
import '../../test/headless.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { installBrowser } from './browser.mjs';

const arg = ( name, fallback ) => process.argv.find( a => a.startsWith( `--${name}=` ) )?.split( '=' ).slice( 1 ).join( '=' ) ?? fallback;
const positive = ( name, fallback ) => {

	const n = Number( arg( name, fallback ) );
	assert( Number.isInteger( n ) && n > 0, `${name} must be a positive integer` );
	return n;

};
const width = positive( 'width', 1340 ), height = positive( 'height', 880 );
const frames = positive( 'frames', 24 ), warm = positive( 'warm', 12 ), rounds = positive( 'rounds', 3 );
const views = arg( 'views', 'room,lamp,fApproach,dBeams' ).split( ',' );
const out = resolve( arg( 'out', 'artifacts/atmosphere-performance/native.json' ) );
installBrowser( { search: '?bench&noAudio&setting=flannan&adapt&handlamp&lamp', width, height, root: resolve( 'public' ) } );
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
for ( const [ name, v ] of Object.entries( {
	room: { p: [ -.4, 82.67, 4.4 ], at: [ -6.8, 82.1, .1 ], fov: 65, time: 14.2 },
	lamp: { p: [ -5, 82.67, .35 ], at: [ -6.7, 81.84, -.6 ], fov: 62, time: 19 },
} ) ) {

	const [ x, y, z ] = v.p, [ a, b, c ] = v.at;
	VIEWS[ name ] = { ...v, yaw: Math.atan2( x - a, z - c ), pitch: Math.atan2( b - y, Math.hypot( a - x, c - z ) ) };

}
for ( const view of views ) assert( VIEWS[ view ], `Unknown review camera: ${view}` );
const app = new App();
let stage = '';
await app.init( ( p, text ) => { if ( text !== stage ) console.log( `${Math.round( p * 100 )}% ${stage = text}` ); } );
app.engine.stop();
const bench = startBench( app );
assert( bench.enabled, 'GPU timestamp-query unavailable: refusing to substitute wall time for GPU costs' );
assert( app.stationMotes && 'amount' in app.stationMotes, 'StationMotes.amount API required for matched draw-count controls' );
bench.setSize( width, height );
await GPU.pipelinesReady();
// Exact pre-optimization CPU scheduling, retained only in this benchmark. With shafts=0 the
// original march shader early-outs and the temporal pass still executes; the production path skips.
const optimizedHazeRender = app.haze.render;
const legacyHazeRender = function () {

	if ( ! this._passes ) this._build();
	const p = this._passes, clear = [ 0, 0, 0, 0 ];
	p.march.render( { colorViews: [ this.low.texture ], clear } );
	const on = this.enabled.value > .5 && this.shafts.value > 0;
	this.uniforms.fields.histValid.value = this._histValid && on ? 1 : 0;
	p.temporal[ this._hc ].render( { colorViews: [ this.hist[ 1 - this._hc ].texture ], clear } );
	this._hc = 1 - this._hc;
	this._histValid = on;
	if ( this.ssFade.value > .001 ) {

		p.mask.render( { colorViews: [ this.ssTargets[ 0 ].texture ], clear } );
		for ( let i = 0; i < 3; i++ ) p.blur[ i ].render( { colorViews: [ this.ssTargets[ i + 1 ].texture ], clear } );

	}

};

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
	command: [ 'node', 'tools/shots/atmosphere-performance.mjs', ...process.argv.slice( 2 ) ].join( ' ' ),
	sources: Object.fromEntries( [ 'src/App.js', 'src/fx/StationMotes.js', 'src/post/AirHaze.js', 'src/post/PostFX.js', 'src/core/Bench.js' ].map( file => [ file, createHash( 'sha256' ).update( readFileSync( resolve( file ) ) ).digest( 'hex' ) ] ) ),
	runtime: { kind: 'native Dawn via webgpu npm package; inert browser DOM; offscreen texture output', node: process.version, adapter: adapterInfo, timestampQuery: GPU.hasTimestamp, browserMeasured: false, physicalMobileMeasured: false },
	method: { width, height, frames, warm, rounds, views, dt: 0, clock: 1000, queue: 'at most two frames in flight; GPU timestamps include all recorded scene/compute/post passes', controls: 'Each treatment block is bracketed by control blocks; treatment mean minus average of its preceding/following control means. No outlier removal.', limits: 'Native full-scene GPU timings do not measure browser presentation, input, audio, physical mobile/headset performance or sustainable frame rate. Small paired differences may be timing noise. Global render scale also changes scene/cloud/post resolution; it is not a haze-only optimization.' },
	blocks: [], comparisons: [],
};
const persist = () => { mkdirSync( dirname( out ), { recursive: true } ); writeFileSync( out, JSON.stringify( result, null, 2 ) ); };

async function sample( experiment, view, repetition, name, settings ) {

	app.stationMotes.amount = settings.dust;
	app.haze.shafts.value = settings.shafts;
	app.setRenderScale( settings.scale );
	app.haze.render = settings.legacyHaze ? legacyHazeRender : optimizedHazeRender;
	app.haze.setQuality?.( settings.quality ?? 1 );
	G.time.value = 1000;
	await bench._frames( warm, 0 );
	await GPU.pipelinesReady();
	bench.frames = [];
	bench._capture = true;
	const t = performance.now();
	await bench._frames( frames, 0 );
	const wall = ( performance.now() - t ) / frames;
	bench._capture = false;
	for ( let k = 0; k < 100 && bench.frames.length < frames; k++ ) await new Promise( r => setTimeout( r, 5 ) );
	assert.equal( bench.frames.length, frames, 'Every GPU timestamp frame must be returned' );
	const passNames = [ ...new Set( bench.frames.flatMap( f => [ ...f.passes.keys() ] ) ) ];
	const block = {
		experiment, view, repetition, name, settings, particles: app.stationMotes.particleCount,
		gpuMs: stats( bench.frames.map( f => f.gpu ) ), wallThroughputMs: round( wall ),
		passes: Object.fromEntries( passNames.map( name => [ name, stats( bench.frames.map( f => f.passes.get( name ) || 0 ) ) ] ) ),
		rawGpuMs: bench.frames.map( f => round( f.gpu ) ),
		actualDimensions: { output: [ app.post._outW, app.post._outH ], internal: [ app.post._inW, app.post._inH ], hazeMarch: [ app.haze.low.width, app.haze.low.height ] },
	};
	result.blocks.push( block );
	console.log( `${experiment} ${view} #${repetition} ${name}: ${block.gpuMs.mean.toFixed( 3 )} ms GPU, ${block.gpuMs.median.toFixed( 3 )} median` );
	persist();
	return block;

}

async function experiment( name, view, control, treatments ) {

	bench.pose( view );
	app.stationMotes.amount = control.dust;
	app.setRenderScale( control.scale );
	app.haze.shafts.value = control.shafts;
	app.haze.render = control.legacyHaze ? legacyHazeRender : optimizedHazeRender;
	app.haze.setQuality?.( control.quality ?? 1 );
	G.time.value = 1000;
	await bench._frames( 40, 0 );
	await GPU.pipelinesReady();
	const deltas = new Map( treatments.map( ( [ key ] ) => [ key, [] ] ) );
	for ( let repetition = 1; repetition <= rounds; repetition++ ) {

		// Reverse treatment order on alternate repetitions to reduce order bias.
		const sequence = repetition % 2 ? treatments : treatments.slice().reverse();
		const before = await sample( name, view, repetition, 'control-before', control );
		const measured = [];
		for ( const [ key, settings ] of sequence ) measured.push( [ key, await sample( name, view, repetition, key, settings ) ] );
		const after = await sample( name, view, repetition, 'control-after', control );
		for ( const [ key, block ] of measured ) {

			const passNames = [ ...new Set( [ ...Object.keys( before.passes ), ...Object.keys( after.passes ), ...Object.keys( block.passes ) ] ) ];
			deltas.get( key ).push( {
				repetition, meanGpuDeltaMs: round( block.gpuMs.mean - ( before.gpuMs.mean + after.gpuMs.mean ) * .5 ),
				medianGpuDeltaMs: round( block.gpuMs.median - ( before.gpuMs.median + after.gpuMs.median ) * .5 ),
				passMeanDeltaMs: Object.fromEntries( passNames.map( p => [ p, round( ( block.passes[ p ]?.mean || 0 ) - ( ( before.passes[ p ]?.mean || 0 ) + ( after.passes[ p ]?.mean || 0 ) ) * .5 ) ] ) ),
			} );

		}

	}
	for ( const [ treatment, pairs ] of deltas ) {

		const passNames = Object.keys( pairs[ 0 ].passMeanDeltaMs );
		result.comparisons.push( { experiment: name, view, treatment, meanGpuDeltaMs: stats( pairs.map( p => p.meanGpuDeltaMs ) ), medianGpuDeltaMs: stats( pairs.map( p => p.medianGpuDeltaMs ) ), passMeanDeltaMs: Object.fromEntries( passNames.map( p => [ p, stats( pairs.map( pair => pair.passMeanDeltaMs[ p ] ) ) ] ) ), pairs } );

	}
	persist();

}

console.log( 'TIMINGS BEGIN', JSON.stringify( adapterInfo ), `${width}x${height}`, `frames=${frames} warm=${warm} rounds=${rounds}` );
const started = performance.now();
for ( const view of views ) {

	if ( view === 'room' || view === 'lamp' ) await experiment( 'dust', view, { dust: 0, shafts: 1, scale: 1 }, [ [ 'dust1', { dust: 1, shafts: 1, scale: 1 } ], [ 'dust10', { dust: 10, shafts: 1, scale: 1 } ] ] );
	await experiment( 'shafts', view, { dust: 1, shafts: 0, scale: 1 }, [ [ 'shafts1', { dust: 1, shafts: 1, scale: 1 } ] ] );
	await experiment( 'renderScale', view, { dust: 1, shafts: 1, scale: 1 }, [ [ 'scale0.5', { dust: 1, shafts: 1, scale: .5 } ] ] );
	if ( app.haze.setQuality && ( view === 'room' || view === 'fApproach' ) ) await experiment( 'hazeQuality', view, { dust: 1, shafts: 1, scale: 1, quality: 1 }, [ [ 'quality0.5', { dust: 1, shafts: 1, scale: 1, quality: .5 } ], [ 'quality1.5', { dust: 1, shafts: 1, scale: 1, quality: 1.5 } ] ] );
	await experiment( 'disabledPassSavings', view, { dust: 1, shafts: 0, scale: 1 }, [ [ 'legacyDisabled', { dust: 1, shafts: 0, scale: 1, legacyHaze: true } ] ] );

}
await GPU.queue.onSubmittedWorkDone();
const validation = await GPU.device.popErrorScope();
result.validation = { error: validation?.message ?? null, uncaptured: errors };
result.elapsedSeconds = round( ( performance.now() - started ) / 1000 );
const gcd = ( a, b ) => b ? gcd( b, a % b ) : a;
result.method.observedFrameDurationQuantumNs = result.blocks.flatMap( b => b.rawGpuMs ).reduce( ( q, ms ) => gcd( q, Math.round( ms * 1e6 ) ), 0 );
result.method.timestampNote = 'All raw frame durations are multiples of the observed quantum. Per-pass median zero can reflect quantization; it does not imply zero work. Small mean differences within round-to-round variation are inconclusive.';
persist();
assert.equal( validation, null, validation?.message );
assert.deepEqual( errors, [] );
console.log( 'TIMINGS COMPLETE', out, `${result.elapsedSeconds}s` );
for ( const c of result.comparisons ) console.log( `${c.experiment} ${c.view} ${c.treatment}: paired mean delta ${c.meanGpuDeltaMs.mean.toFixed( 3 )} ms [${c.meanGpuDeltaMs.min.toFixed( 3 )}, ${c.meanGpuDeltaMs.max.toFixed( 3 )}]` );
process.exit( 0 );
