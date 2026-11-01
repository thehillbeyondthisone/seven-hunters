// Continuous live-wave coverage for the authored Blender MCP elbow planes.
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import './headless.mjs';
import { installBrowser } from '../tools/shots/browser.mjs';
import { GPU } from '../src/engine/gpu/GPU.js';
import { Group, Vector3, Matrix4, Quaternion } from '../src/engine/index.js';
import { Boatman, authoredElbowPole } from '../src/world/boat/Boatman.js';
import { BOATMAN_ELBOW_RIG } from '../src/world/boat/BoatmanRig.js';
import { rowingPose, ROWING_PERIOD } from '../src/story/ArrivalRowing.js';

assert.equal( BOATMAN_ELBOW_RIG.samples, 91 );
for ( const samples of [ BOATMAN_ELBOW_RIG.left, BOATMAN_ELBOW_RIG.right ] ) {
	assert.equal( new Set( samples.map( v => v.join( ',' ) ) ).size, 90, 'each phase samples the actual authored frame' );
	assert.deepEqual( samples[ 0 ], samples.at( -1 ), 'the authored rig closes its loop exactly' );
	for ( let i = 0; i < samples.length; i ++ ) {
		const v = new Vector3().fromArray( samples[ i ] );
		assert.ok( Math.abs( v.length() - 1 ) < 1e-6 );
		if ( i ) assert.ok( v.dot( new Vector3().fromArray( samples[ i - 1 ] ) ) > .9, 'the pole plane does not flip between adjacent frames' );
	}
}
for ( const side of [ -1, 1 ] ) assert.ok( authoredElbowPole( 1, side ).distanceTo( authoredElbowPole( 0, side ) ) < 1e-9 );
installBrowser( { root: resolve( 'public' ) } );
await GPU.init( { headless: true } );
GPU.device.pushErrorScope( 'validation' );
const parent = new Group(), rower = await new Boatman( parent ).load();
// Check the imported glTF bind-axis contract against the actual baked clip.
// This catches a rotated but unit-length pole that grip-only tests cannot see.
const modifier = rower.model.poseModifier;
rower.model.poseModifier = null;
for ( const phase of [ 0, .25, .5, .75 ] ) {
 rower.model.sample( 'rowing', phase * rower.model.clipDuration( 'rowing' ) );
 const at = i => new Vector3().setFromMatrixPosition( new Matrix4().fromArray( rower.model.world, i * 16 ) );
 const chest = new Quaternion().setFromRotationMatrix( new Matrix4().extractRotation( new Matrix4().fromArray( rower.model.world, rower.chest * 16 ) ) );
 for ( const arm of rower.arms ) {
  const [ u, f, h ] = arm.indices, shoulder = at( u ), elbow = at( f ), axis = at( h ).sub( shoulder ).normalize();
  const bend = elbow.sub( shoulder ); bend.addScaledVector( axis, -bend.dot( axis ) ).normalize();
  assert.ok( authoredElbowPole( phase, arm.side ).applyQuaternion( chest ).dot( bend ) > .995, 'the authored pole agrees with the imported seated clip and bind axes' );
 }
}
rower.model.poseModifier = modifier;
const oars = [ -1, 1 ].map( side => { const g = new Group(); g.position.set( side * 1.16, 1.25, -.65 ); parent.add( g ); return g; } );
const previous = [ null, null ];
let largestElbowStep = 0, worstGrip = 0, narrowestElbow = Infinity;
for ( let i = 0; i <= 720; i ++ ) {
	const time = i / 120, stroke = rowingPose( time, true );
	const dip = .06 + .84 * ( .5 + .5 * Math.sin( time * 1.1 ) );
	for ( let j = 0; j < 2; j ++ ) {
		const side = j ? 1 : -1;
		oars[ j ].rotation.set( 0, side * stroke.sweep, -side * ( -.045 + ( dip + .045 ) * stroke.immersion ) );
	}
	rower.update( oars, stroke.lean, null, { dt: 1 / 120, phase: stroke.phase } );
	worstGrip = Math.max( worstGrip, rower.gripError );
	for ( let j = 0; j < 2; j ++ ) {
		const elbow = rower.arms[ j ].fore.position;
		assert.ok( elbow.toArray().every( Number.isFinite ) );
		narrowestElbow = Math.min( narrowestElbow, Math.abs( elbow.x ) );
		if ( previous[ j ] ) largestElbowStep = Math.max( largestElbowStep, elbow.distanceTo( previous[ j ] ) );
		previous[ j ] = elbow.clone();
	}
}
assert.ok( worstGrip < .002, 'the correction retains physical contact with the moving oars' );
assert.ok( largestElbowStep < .05, `no temporal elbow pop across pull, recovery or loop: ${largestElbowStep}m` );
assert.ok( narrowestElbow > .12, 'the elbow stays outside the torso centreline' );
assert.equal( await GPU.device.popErrorScope(), null );
const out = resolve( 'artifacts/boatman/elbows-20261101' ); mkdirSync( out, { recursive: true } );
writeFileSync( resolve( out, 'temporal-verification.json' ), JSON.stringify( { frames: 721, fps: 120, rowingPeriod: ROWING_PERIOD, largestElbowStep, worstGrip, narrowestElbow, liveWaveDipRange: [ .06, .9 ], modelAuthoring: 'Blender MCP', physicalDeviceTested: false }, null, 2 ) );
console.log( `PASS Blender-authored elbow planes: complete live-wave cycles, no plane flips, maximum 120fps elbow step ${(largestElbowStep*1000).toFixed(2)}mm, grip ${(worstGrip*1000).toFixed(3)}mm.` );
process.exit( 0 );


