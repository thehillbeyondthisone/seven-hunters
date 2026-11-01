// Shaft quality and disable/re-enable transitions must leave no unrecorded
// history reads, stale cut history, or duplicate temporal GPU measurements.
import assert from 'node:assert/strict';
import { AirHaze } from '../src/post/AirHaze.js';
import { PostFX } from '../src/post/PostFX.js';
import { G } from '../src/engine/render/Frame.js';

const haze = new AirHaze( {} );
const previousUnderwater = G.cameraUnderwater.value;
const calls = [];
let builds = 0;
haze._build = () => { builds ++; throw new Error( 'Unused shaft passes must not be built' ); };

try {
	G.cameraUnderwater.value = 0;
	haze.shafts.value = 0;
	haze.ssFade.value = 1;
	haze.render();
	assert.equal( builds, 0, 'a cold disabled shaft system submits and builds nothing' );
	assert.deepEqual( haze.activePassNames, [] );

	const pass = name => ( {
		timestampWrites: null,
		render() { calls.push( { name, history: haze.uniforms.fields.histValid.value, timing: this.timestampWrites } ); },
	} );
	haze._passes = {
		march: pass( 'haze march' ), mask: pass( 'haze sun mask' ),
		blur: [ 0, 1, 2 ].map( i => pass( `haze god rays ${ i }` ) ),
		temporal: [ 0, 1 ].map( i => pass( `history ${ i }` ) ),
	};
	const timing = { slot: 'one shared temporal measurement' };
	haze._passes.temporal[ 0 ].timestampWrites = timing;
	haze.shafts.value = 1;
	haze.ssFade.value = 0;
	haze.render();
	assert.deepEqual( calls.map( c => c.name ), [ 'haze march', 'history 0' ] );
	assert.equal( calls.at( -1 ).history, 0, 'the first active frame never reads stale history' );
	haze.render();
	assert.equal( calls.at( -1 ).name, 'history 1', 'active frames alternate history targets' );
	assert.equal( calls.at( -1 ).history, 1 );
	assert.equal( calls.at( -1 ).timing, timing, 'both directions use the same GPU timestamp slot' );
	assert.deepEqual( haze.activePassNames, [ 'haze march', 'haze shafts temporal' ] );

	for ( const disable of [ () => { haze.shafts.value = 0; }, () => { haze.enabled.value = 0; }, () => { G.cameraUnderwater.value = 1; } ] ) {
		const count = calls.length, historyTarget = haze._hc;
		disable();
		haze.render();
		assert.equal( calls.length, count, 'unused shafts submit neither march, temporal nor radial passes' );
		assert.equal( haze._hc, historyTarget );
		assert.deepEqual( haze.activePassNames, [] );
		haze.shafts.value = 1; haze.enabled.value = 1; G.cameraUnderwater.value = 0;
		haze.render();
		assert.equal( calls.at( -1 ).history, 0, 're-enabling starts with fresh shafts' );
	}

	haze.ssFade.value = .6;
	const start = calls.length;
	haze.render();
	assert.equal( calls.length - start, 6, 'visible low sun adds one mask and three radial passes' );
	assert.equal( haze.activePassNames.length, 6 );
	const post = { haze, taau: {}, motionBlur: { _hasPrev: true }, _hasPrev: true };
	PostFX.prototype.cut.call( post );
	assert.equal( post.taau._needsRestart, true );
	assert.equal( post.motionBlur._hasPrev, false );
	assert.equal( haze._histValid, false, 'a real post-chain camera cut also resets shaft history' );
	haze.ssFade.value = 0;
	haze.render();
	assert.equal( calls.at( -1 ).history, 0 );

	// Keep the real target sizing code; stub only GPU allocations for this CPU check.
	for ( const target of [ haze.low, ...haze.hist, ...haze.ssTargets ] ) {
		for ( const texture of target.textures ) texture.resize = ( w, h ) => { texture.width = w; texture.height = h; };
	}
	haze.setScale( .8 );
	haze.setSize( 1920, 1080 );
	assert.deepEqual( [ haze.low.width, haze.low.height ], [ 768, 432 ], 'default quality preserves the former half-resolution target' );
	haze.setQuality( .5 );
	assert.deepEqual( [ haze.low.width, haze.low.height ], [ 384, 216 ], 'quality resizes immediately and composes with global scale' );
	assert.deepEqual( [ haze.ssTargets[ 0 ].width, haze.ssTargets[ 0 ].height ], [ 192, 108 ] );
	haze.setQuality( 1.5 );
	assert.deepEqual( [ haze.low.width, haze.low.height ], [ 1152, 648 ] );
	assert.ok( haze.hist.every( r => r.width === 1152 && r.height === 648 ), 'both history directions follow the ray target size' );
	assert.equal( haze._histValid, false, 'quality changes invalidate resized history' );
	haze.setQuality( -10 ); assert.equal( haze.resolutionScale, .5 );
	haze.setQuality( 10 ); assert.equal( haze.resolutionScale, 1.5 );
	haze.setQuality( NaN ); assert.equal( haze.resolutionScale, 1.5, 'invalid quality input cannot create invalid targets' );

	const fakePost = { haze, motionBlur: {}, aoPass: {}, underwater: {}, taau: { _resolve: [ {}, {} ] }, _bloomPasses: [] };
	const tracked = PostFX.prototype.passes.call( fakePost ).filter( ( [ name ] ) => name.startsWith( 'haze' ) );
	assert.equal( tracked.filter( ( [ name ] ) => name === 'haze shafts temporal' ).length, 1, 'the profiler counts one temporal resolve per frame' );
	assert.equal( tracked.find( ( [ name ] ) => name === 'haze shafts temporal' )[ 1 ], haze._passes.temporal[ 0 ] );
	console.log( 'PASS haze controls: no disabled GPU passes, clean history transitions, shared temporal timing and independent ray resolution.' );
} finally {
	G.cameraUnderwater.value = previousUnderwater;
}
