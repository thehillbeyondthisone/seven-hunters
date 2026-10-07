// Real controller and tread colliders: camera continuity, descent support,
// landing/settling and immediate jump response at different frame rates.
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from '../src/engine/index.js';
import { Colliders } from '../src/world/Colliders.js';
import { Player } from '../src/player/Player.js';

function makePlayer() {

	const colliders = new Colliders();
	for ( let i = 0; i < 24; i ++ ) colliders.addBox( new Vector3( ( i + .5 ) * .28, ( i + 1 ) * .19 - .1, 0 ), new Vector3( .14, .1, 1 ), 0, { walkable: true, solid: false, tag: 'steps' } );
	colliders.addBox( new Vector3( 8, 24 * .19 - .1, 0 ), new Vector3( 1.28, .1, 1 ), 0, { walkable: true } );
	const keys = new Set(), hits = new Set();
	const input = { enabled: true, down: k => keys.has( k ), hit: k => hits.delete( k ), consumeLook: () => ( { x: 0, y: 0 } ) };
	const query = { cpuValid: true, cpu: new Float32Array( [ -100, 0, 0, 0 ] ), allocate: () => 0, setPoint() {} };
	const camera = new PerspectiveCamera( 70, 1, .1, 1000 );
	const player = new Player( { camera, input, terrain: { heightAt: () => 0 }, colliders, query, boat: null } );
	return { player, camera, keys, hits };

}

{
	const { player, keys } = makePlayer();
	player.position.set( -.6, 0, 0 ); player.grounded = true; player.yaw = -Math.PI / 2;
	keys.add( 'KeyW' ); keys.add( 'ShiftLeft' ); player.canSprint = () => false;
	for ( let i = 0; i < 30; i ++ ) player.update( 1 / 60 );
	assert.ok( Math.hypot( player.velocity.x, player.velocity.z ) <= 3.001, 'held sprint respects the story walking restriction' );
	player.canSprint = () => true;
	for ( let i = 0; i < 20; i ++ ) player.update( 1 / 60 );
	assert.ok( Math.hypot( player.velocity.x, player.velocity.z ) > 6, 'held sprint resumes after the restriction ends' );
}

for ( const fps of [ 30, 60, 120 ] ) for ( const descending of [ false, true ] ) for ( const sprint of [ false, true ] ) {

	const { player, camera, keys, hits } = makePlayer(), dt = 1 / fps;
	player.position.set( descending ? 7.5 : -.6, descending ? 24 * .19 : 0, 0 );
	player.grounded = true;
	player.yaw = descending ? Math.PI / 2 : -Math.PI / 2;
	player.update( dt );
	keys.add( 'KeyW' );
	if ( sprint ) keys.add( 'ShiftLeft' );
	let peakEye = 0, peakFeet = 0, airborne = 0;
	let lastEyeDelta = 0, lastFeetDelta = 0, eyeAcceleration = 0, feetAcceleration = 0;
	while ( descending ? player.position.x > -.5 : player.position.x < 7.5 ) {

		const y = camera.position.y, feet = player.position.y;
		player.update( dt );
		const eyeDelta = camera.position.y - y, feetDelta = player.position.y - feet;
		peakEye = Math.max( peakEye, Math.abs( eyeDelta ) );
		peakFeet = Math.max( peakFeet, Math.abs( feetDelta ) );
		eyeAcceleration = Math.max( eyeAcceleration, Math.abs( eyeDelta - lastEyeDelta ) );
		feetAcceleration = Math.max( feetAcceleration, Math.abs( feetDelta - lastFeetDelta ) );
		lastEyeDelta = eyeDelta; lastFeetDelta = feetDelta;
		if ( !player.grounded ) airborne ++;
		assert.ok( camera.position.y - player.position.y > 1, 'eye stays safely above the treads' );

	}
	assert.equal( airborne, 0, 'small descending treads keep grounded support' );
	assert.ok( peakFeet > .18, 'route actually crosses discrete risers' );
	assert.ok( peakEye < peakFeet * .95, `camera removes the full-riser snap (${ peakEye }m camera versus ${ peakFeet }m feet)` );
	assert.ok( eyeAcceleration < feetAcceleration * .5, 'camera softens changes in vertical speed between treads' );
	keys.clear();
	for ( let i = 0; i < fps; i ++ ) player.update( dt );
	assert.ok( Math.abs( player.groundCamOff ) < 1e-5, 'camera returns to standing height after stopping' );
	const feet = player.position.y;
	hits.add( 'Space' ); player.update( dt );
	assert.ok( !player.grounded && player.position.y > feet && player.velocity.y > 0, 'jump starts immediately' );
	console.log( `PASS ${ fps }fps ${ sprint ? 'running' : 'walking' } ${ descending ? 'descent' : 'ascent' }: peak camera ${ (peakEye*100).toFixed(1) }cm/frame versus ${(peakFeet*100).toFixed(1)}cm tread; grounded support, settled eye and jump.` );

}

// A cliff still releases the player into a fall rather than ground snapping.
{
	const { player } = makePlayer();
	player.position.set( -.5, 0, 0 ); player.grounded = true;
	player.ambientDrift = () => ( { x: 1.4, z: -1.4 } );
	const start = player.position.clone();
	for ( let i = 0; i < 600; i ++ ) player.update( 1 / 60 );
	assert.ok( Math.hypot( player.position.x - start.x, player.position.z - start.z ) < 1e-10, 'idle planted feet stay still even with storm drift available' );
	player.mode = 'swim'; player.waterH = 10; player.waterMean = 10; player.position.y = 9.9;
	player.updateSwim( 1 / 60 );
	assert.ok( player.velocity.x > 0 && player.velocity.z < 0, 'swimmers retain water currents' );
	console.log( 'PASS idle standing has no wind slide; swimmers retain currents.' );
}

// A cliff still releases the player into a fall rather than ground snapping.
{
	const { player, keys } = makePlayer();
	player.position.set( 8.8, 24 * .19, 0 ); player.grounded = true; player.yaw = -Math.PI / 2;
	keys.add( 'KeyW' );
	for ( let i = 0; i < 30; i ++ ) player.update( 1 / 60 );
	assert.ok( !player.grounded && player.velocity.y < -1 && player.position.y > 0, 'large drop retains gravity' );
	console.log( 'PASS large drop retains gravity.' );
}
