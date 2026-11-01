import assert from 'node:assert/strict';
import { SceneWarmup, stageArrivalWarmup } from '../src/core/SceneWarmup.js';
const policy = ( query = '', saved = null ) => stageArrivalWarmup( new URLSearchParams( query ), () => ( { getItem: () => JSON.stringify( saved ) } ) );
assert.equal( policy(), true );
assert.equal( policy( '', { v: 1, beat: 'crossing' } ), true );
assert.equal( policy( '', { v: 1, beat: 'watch' } ), false );
for ( const route of [ 'keeperPreview', 'unpackingPreview', 'morningPreview', 'interiorPreview', 'vr', 'nostory', 'bench', 'syncPipelines', 'serialPipelines', 'view=dRoom', 'warmup=full' ] ) assert.equal( policy( route ), false, route );
for ( const route of [ 'arrivalPreview', 'arrivalAtmospherePreview', 'firstWatchPreview=crossing', 'bench&warmup=staged', 'mobile' ] ) assert.equal( policy( route ), true, route );
assert.equal( policy( 'firstWatchPreview' ), false );
assert.equal( stageArrivalWarmup( new URLSearchParams(), () => { throw new Error( 'storage denied' ); } ), true );
let active = 0, peak = 0, yielded = 0;
const handles = Array.from( { length: 4 }, ( _, i ) => ( {

	label: 'station ' + i, pipeline: null,
	async start() { active ++; peak = Math.max( peak, active ); await Promise.resolve(); this.pipeline = {}; active --; },

} ) );
const warmup = new SceneWarmup( [ ...handles, handles[ 0 ] ], { yieldTask: async () => { yielded ++; } } );
assert.equal( warmup.ready, false );
const first = warmup.start();
assert.equal( warmup.start(), first, 'repeated requests share one job' );
await first;
assert.equal( warmup.ready, true );
assert.equal( warmup.completed, 4 );
assert.equal( peak, 1, 'background warmup compiles one pipeline at a time' );
assert.equal( yielded, 4, 'each compile yields to the scene' );
const failed = new SceneWarmup( [ { label: 'broken', failed: true, start: async () => {} } ], { yieldTask: async () => {} } );
await assert.rejects( failed.start(), /Could not prepare broken/ );
assert.equal( failed.ready, false );
console.log( 'Arrival warmup policy, save/preview fallback, pacing, idempotence and failure propagation passed.' );

const { Story } = await import( '../src/story/Story.js' );
let finish, placed = 0;
const readiness = new Promise( resolve => { finish = resolve; } );
const story = {

	beat: 'crossing', paused: false, arrival: { ready: true, departure: null }, flags: {},
	app: { ensureSceneReady: () => readiness },
	ui: { open: false, fade: async ( text, hold, ready ) => ready() },
	_placeAtLanding() { placed ++; }, row() {}, setBeat( beat ) { this.beat = beat; }, toast() {},

};
const landing = Story.prototype._disembark.call( story );
await Story.prototype._disembark.call( story );
assert.equal( placed, 0, 'skipping the crossing must not move ashore before station readiness' );
assert.equal( story.paused, true, 'the landing gate pauses movement and duplicate input' );
finish();
await landing;
assert.equal( placed, 1 );
assert.equal( story.beat, 'climb' );
assert.equal( story.arrival.departure, 0 );
let shownError = false;
const failedStory = { ...story, beat: 'crossing', paused: false, flags: {}, arrival: { ready: true, departure: null }, app: { ensureSceneReady: async () => { throw new Error( 'test compile failure' ); } }, ui: { ...story.ui, card: async () => { shownError = true; } } };
const report = console.error; console.error = () => {};
try { await Story.prototype._disembark.call( failedStory ); }
finally { console.error = report; }
assert.equal( placed, 1, 'failure leaves the player aboard' );
assert.equal( failedStory.paused, false );
assert.equal( failedStory.flags.landed, undefined );
assert.equal( shownError, true );
console.log( 'Early skip, duplicate input, landing readiness and failure recovery passed.' );
