// Run the real startup path on Dawn; reports local CPU/GPU preparation, excluding network.
import './headless.mjs';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { installBrowser } from '../tools/shots/browser.mjs';
import { GPU } from '../src/engine/gpu/GPU.js';

installBrowser( { search: process.env.STARTUP_QUERY || '?bench&noAudio', width: 640, height: 360, root: resolve( 'public' ), onPost: async () => {} } );
const { App } = await import( '../src/App.js' );
const app = new App(), errors = [], stages = [];
const reportError = console.error;
console.error = ( ...args ) => {

	const message = args.join( ' ' );
	if ( /WebGPU|WGSL|pipeline.*failed/i.test( message ) ) errors.push( message );
	reportError( ...args );

};
const init = GPU.init.bind( GPU );
GPU.init = async ( options ) => {

	await init( options );
	GPU.device.addEventListener( 'uncapturederror', ( e ) => errors.push( e.error.message ) );
	GPU.device.pushErrorScope( 'validation' );
	return GPU;

};
const start = performance.now();
await app.init( ( p, text ) => {

	stages.push( { stage: text, elapsedMs: Math.round( performance.now() - start ) } );
	console.log( stages.at( - 1 ) );

} );
const startupMs = Math.round( performance.now() - start );
const deferred = app.sceneWarmup?.handles.map( h => h.label ) || [];
await app.ensureSceneReady();
const validation = await GPU.device.popErrorScope();
if ( validation ) errors.push( validation.message );
console.log( JSON.stringify( {

	startupMs, wholeSceneMs: Math.round( performance.now() - start ), deferred, stages,
	materialVariants: app.engine.meshRenderer.pipelines.size,
	compiledPipelines: app.engine.meshRenderer.stats.pipelines,
	synchronousCompiles: GPU.syncCompiles.length, pending: GPU.pendingLabels(), errors,

}, null, 2 ) );
assert.deepEqual( errors, [], 'startup must render without GPU validation errors' );
assert.equal( GPU.pendingLabels().length, 0, 'all startup pipelines must be ready' );
if ( app.flannan ) {

	assert( ! app.scene.children.includes( app.boat.group ), 'unused fishing boat must not be precompiled in Flannan' );
	assert( ! app.sceneRenderer.hullMasks.some( ( h ) => h.object === app.boat.group ), 'unused fishing boat must not register a hull mask' );
	assert( app.sceneRenderer.hullMasks.some( ( h ) => h.object === app.arrival.group ), 'arrival boat retains its water mask' );

}
process.exit( 0 );
