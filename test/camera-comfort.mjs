import assert from 'node:assert/strict';
import { loadCameraBob, saveCameraBob } from '../src/player/CameraComfort.js';
import { PerspectiveCamera } from '../src/engine/index.js';
import { Player } from '../src/player/Player.js';
import { Colliders } from '../src/world/Colliders.js';

const storage = new Map();
globalThis.localStorage = { getItem: k => storage.get( k ) ?? null, setItem: ( k, v ) => storage.set( k, v ) };
globalThis.matchMedia = () => ( { matches: false } );
assert.equal( loadCameraBob(), true );
globalThis.matchMedia = () => ( { matches: true } );
assert.equal( loadCameraBob(), false, 'reduced-motion preference defaults to steady camera' );
saveCameraBob( true ); assert.equal( loadCameraBob(), true, 'explicit choice overrides the default' );
saveCameraBob( false ); assert.equal( loadCameraBob(), false, 'off persists across a reload' );
globalThis.localStorage = { getItem() { throw Error( 'denied' ); }, setItem() { throw Error( 'denied' ); } };
assert.equal( loadCameraBob(), false ); saveCameraBob( true );

for ( const fps of [ 30, 60, 120 ] ) {
	const results = [];
	for ( const cameraBob of [ true, false ] ) {
		const camera = new PerspectiveCamera(), comfort = { cameraBob };
		let steps = 0;
		const player = new Player( { camera, comfort, input: { enabled: true, down: k => k === 'KeyW', hit: () => false, consumeLook: () => ( { x: 0, y: 0 } ) },
			terrain: { heightAt: () => 0 }, colliders: new Colliders(), boat: null,
			query: { cpuValid: true, cpu: new Float32Array( [ -100, 0, 0, 0 ] ), allocate: () => 0, setPoint() {} }, audio: { footstep() { steps ++; } } } );
		player.position.set( 0, 0, 0 ); player.grounded = true;
		const heights = [];
		for ( let i = 0; i < fps * 3; i ++ ) { player.update( 1 / fps ); heights.push( camera.position.y - player.position.y ); }
		const range = Math.max( ...heights ) - Math.min( ...heights );
		assert( cameraBob ? range > .06 : range < 1e-9, 'preference controls visible head oscillation' );
		results.push( { at: player.position.toArray(), steps } );
	}
	assert.deepEqual( results[ 0 ], results[ 1 ], 'bob setting preserves movement and audible footsteps' );
	assert( results[ 0 ].steps > 5 );
}
console.log( 'PASS saved camera bob, reduced-motion default, denied storage, steady walking at 30/60/120fps and unchanged movement/footsteps.' );
