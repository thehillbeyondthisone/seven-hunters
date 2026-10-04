import assert from 'node:assert/strict';
import { Matrix4, Quaternion, Vector3 } from '../src/engine/math/index.js';
import { Colliders } from '../src/world/Colliders.js';
import { Locomotion, axis, heading, controllerState, reversedProjection } from '../src/xr/Locomotion.js';
import { configurePreview, projectionScale, supportMessage } from '../src/xr/PreviewOptions.js';
import { XRPreview, pickDoor } from '../src/xr/XRPreview.js';

const near = ( a, b, epsilon = 1e-6 ) => assert.ok( Math.abs( a - b ) < epsilon, `${ a } != ${ b }` );
let checks = 0;
const test = ( name, fn ) => { fn(); checks ++; console.log( 'PASS', name ); };
const idle = () => ( { x: 0, z: 0, turn: 0 } );
function player( height = () => 10 ) {

	const colliders = new Colliders();
	return {
		position: new Vector3( 0, height( 0, 0 ), 0 ), velocity: new Vector3(), yaw: 0, colliders,
		groundAt: ( x, z, maxY ) => Math.max( height( x, z ), colliders.groundHeightAt( x, z, maxY ) ),
	};

}
function pose( x = 0, y = 1.62, z = 0, yaw = 0 ) {

	const position = new Vector3( x, y, z ), orientation = new Quaternion().setFromAxisAngle( new Vector3( 0, 1, 0 ), yaw );
	return { transform: { position, orientation, matrix: new Matrix4().compose( position, orientation, new Vector3( 1, 1, 1 ) ).toArray() } };

}

test( 'normal URL options stay untouched; VR never launches a saved night', () => {

	const normal = new URLSearchParams( 'setting=tidewater&arrivalPreview' );
	assert.equal( configurePreview( normal ), false );
	assert.equal( normal.toString(), 'setting=tidewater&arrivalPreview=' );
	const vr = new URLSearchParams( 'vr&setting=tidewater' );
	assert.equal( configurePreview( vr ), true );
	assert.equal( vr.get( 'setting' ), 'flannan' );
	for ( const flag of [ 'nostory', 'noClouds', 'noHaze', 'noSim', 'lite', 'lamp', 'handlamp' ] ) assert.ok( vr.has( flag ) );

} );

test( 'resolution values are bounded; unsupported browsers have clear fallback messages', () => {

	for ( const v of [ null, '', 'NaN', '0.1', '-1', '2' ] ) assert.equal( projectionScale( v ), 0.65 );
	assert.equal( projectionScale( '0.5' ), 0.5 );
	assert.match( supportMessage( {} ), /HTTPS/ );
	assert.match( supportMessage( { isSecureContext: true, navigator: { gpu: {} } } ), /WebXR/ );
	assert.match( supportMessage( { isSecureContext: true, navigator: { gpu: {}, xr: {} } } ), /WebGPU in WebXR/ );
	assert.equal( supportMessage( { isSecureContext: true, navigator: { gpu: {}, xr: {} }, XRGPUBinding: function () {} } ), null );

} );

test( 'headset asymmetric projection is preserved with correct reversed near/far depth', () => {

	const projection = new Matrix4().makePerspective( - 0.04, 0.06, 0.065, - 0.045, 0.06, 1000, undefined, false );
	const reversed = reversedProjection( new Matrix4(), projection.elements );
	for ( const i of [ 0, 4, 8, 12, 1, 5, 9, 13 ] ) near( reversed.elements[ i ], projection.elements[ i ] );
	near( new Vector3( 0, 0, - 0.06 ).applyMatrix4( reversed ).z, 1 );
	near( new Vector3( 0, 0, - 1000 ).applyMatrix4( reversed ).z, 0 );

} );

test( 'xr-standard thumbsticks, deadzone and face buttons map correctly', () => {

	assert.equal( axis( 0.17 ), 0 );
	near( axis( 1 ), 1 );
	const buttons = Array.from( { length: 6 }, () => ( { pressed: false } ) );
	buttons[ 4 ].pressed = buttons[ 0 ].pressed = true;
	const right = { handedness: 'right', gamepad: { mapping: 'xr-standard', axes: [ - 1, - 1, 0.9, 0 ], buttons } };
	const left = { handedness: 'left', gamepad: { mapping: 'xr-standard', axes: [ 0, 0, 0, - 1 ], buttons } };
	const state = controllerState( [ left, right ] );
	assert.equal( state.z, - 1 );
	assert.equal( state.x, 0 );
	assert.equal( state.turn, 0.9 );
	assert.equal( state.next, true );
	assert.equal( state.use, true );
	assert.equal( controllerState( [ { handedness: 'left', gamepad: { mapping: '', axes: [ 1, 1 ] } } ] ).x, 0 );

} );

test( 'initial tracked origin, eye separation and head height map into game metres', () => {

	const p = player(), loco = new Locomotion( p );
	p.yaw = Math.PI / 2;
	const tracked = pose( 3, 1.72, 4, 0.2 );
	const rig = loco.update( tracked, idle(), 0 );
	const head = new Vector3( 3, 1.72, 4 ).applyMatrix4( rig );
	near( head.x, 0 ); near( head.z, 0 ); near( head.y, 11.72 );
	const left = new Vector3( 2.968, 1.72, 4 ).applyMatrix4( rig ), right = new Vector3( 3.032, 1.72, 4 ).applyMatrix4( rig );
	near( left.distanceTo( right ), 0.064 );
	near( loco.yaw + heading( tracked.transform.orientation ), Math.PI / 2 );

} );

test( 'snap turning pivots at the head and fires once until the stick is released', () => {

	const p = player(), loco = new Locomotion( p ), head = pose( 2, 1.62, 3 );
	loco.update( head, idle(), 0 );
	for ( let i = 0; i < 30; i ++ ) loco.update( head, { ...idle(), turn: 0.9 }, 1 / 72 );
	near( loco.yaw, - Math.PI / 6 );
	const world = new Vector3( 2, 1.62, 3 ).applyMatrix4( loco.rig );
	near( world.x, 0 ); near( world.z, 0 );
	loco.update( head, idle(), 0 );
	loco.update( head, { ...idle(), turn: 0.9 }, 0 );
	near( loco.yaw, - Math.PI / 3 );

} );

test( 'head-relative motion is time based; diagonal speed stays bounded', () => {

	const p = player(), loco = new Locomotion( p ), head = pose( 0, 1.62, 0, Math.PI / 2 );
	loco.update( head, idle(), 0 );
	for ( let i = 0; i < 72; i ++ ) loco.update( head, { ...idle(), z: - 1 }, 1 / 72 );
	near( Math.hypot( p.position.x, p.position.z ), 1.6 );
	near( p.position.z, - 1.6 ); // initial gaze is aligned to the game's spawn heading
	const initial = p.position.clone();
	for ( let i = 0; i < 72; i ++ ) loco.update( head, { ...idle(), x: 1, z: - 1 }, 1 / 72 );
	near( Math.hypot( p.position.x - initial.x, p.position.z - initial.z ), 1.6 );

} );

test( 'walking and physical tracked steps respect station collision', () => {

	const p = player(), loco = new Locomotion( p );
	p.colliders.addBox( new Vector3( 0, 11, - 1 ), new Vector3( 2, 1, 0.1 ) );
	loco.update( pose(), idle(), 0 );
	for ( let i = 0; i < 180; i ++ ) loco.update( pose(), { ...idle(), z: - 1 }, 1 / 72 );
	assert.ok( p.position.z >= - 0.61, 'controller movement crossed a wall' );
	loco.update( pose( 0, 1.62, - 1 ), idle(), 0 );
	assert.ok( p.position.z >= - 0.61, 'physical movement crossed a wall' );

} );

test( 'small steps can be climbed; cliffs and deep water are blocked', () => {

	const p = player( ( x, z ) => z < - 0.5 ? 10.25 : 10 ), loco = new Locomotion( p );
	for ( let i = 0; i < 72; i ++ ) loco.update( pose(), { ...idle(), z: - 1 }, 1 / 72 );
	near( p.position.y, 10.25 );
	for ( const low of [ 8, - 2 ] ) {

		const p2 = player( ( x, z ) => z < - 0.5 ? low : 10 ), l2 = new Locomotion( p2 );
		for ( let i = 0; i < 72; i ++ ) l2.update( pose(), { ...idle(), z: - 1 }, 1 / 72 );
		assert.ok( p2.position.z >= - 0.5 );

	}

} );

test( 'local-space fallback supports seated head height without bob; recenter keeps position', () => {

	const p = player(), loco = new Locomotion( p, { localFloor: false } );
	loco.update( pose( 0, 0, 0 ), idle(), 0 );
	near( new Vector3( 0, 0, 0 ).applyMatrix4( loco.rig ).y, 11.62 );
	loco.update( pose( 0.2, - 0.3, 0 ), idle(), 0 );
	near( new Vector3( 0.2, - 0.3, 0 ).applyMatrix4( loco.rig ).y, 11.32 );
	const before = p.position.clone();
	loco.recenter();
	loco.update( pose( 5, 0, 5 ), idle(), 0 );
	near( p.position.distanceTo( before ), 0 );

} );

test( 'door ray selection ignores distant doors and doors behind the controller', () => {

	const front = { center: new Vector3( 0, 1.4, - 1 ), width: 1 };
	const back = { center: new Vector3( 0, 1.4, 1 ), width: 1 };
	const far = { center: new Vector3( 0, 1.4, - 4 ), width: 1 };
	assert.equal( pickDoor( [ back, far, front ], new Vector3( 0, 1.4, 0 ), new Vector3( 0, 0, - 1 ) ), front );

} );

test( 'session end restores desktop loop and input once, retaining the exploration position', () => {

	const preview = Object.create( XRPreview.prototype ), session = {};
	let starts = 0, cuts = 0;
	const p = player();
	preview.session = session; preview.active = true; preview.controllers = new Map();
	preview.saved = { fov: 62, near: 0.1, width: 640, height: 360 };
	preview.app = {
		camera: { fov: 110, near: 0.06, updateProjectionMatrix() {} },
		sceneRenderer: { setSize( w, h ) { assert.equal( w, 640 ); assert.equal( h, 360 ); } },
		post: {}, player: p,
		input: { enabled: false, keys: new Set( [ 'KeyW' ] ), pressed: new Set( [ 'KeyE' ] ), consumeLook() {} },
		cameraCut() { cuts ++; }, start() { starts ++; },
	};
	preview.root = {}; preview.enterButton = {}; preview.status = {};
	preview.stats = { frames: 12, maxCpuMs: 3.5 };
	preview._ended( session );
	preview._ended( session );
	assert.equal( starts, 1 ); assert.equal( cuts, 1 );
	assert.equal( preview.active, false ); assert.equal( preview.session, null );
	assert.equal( preview.app.input.enabled, true );
	assert.equal( preview.app.input.keys.size, 0 );
	assert.equal( preview.app.input.pressed.size, 0 );
	assert.equal( preview.app.camera.fov, 62 );
	near( p.position.y, 10 );

} );

console.log( `${ checks } XR logic / lifecycle checks passed. These do not validate a physical headset.` );
