import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3, Matrix4, Quaternion } from '../src/engine/index.js';
import { Colliders } from '../src/world/Colliders.js';
import { GPU } from '../src/engine/gpu/GPU.js';
import { XRPreview } from '../src/xr/XRPreview.js';
import { ControllerInput } from '../src/xr/Locomotion.js';
import { SessionStats } from '../src/xr/SessionStats.js';

// Exercise the production session/frame methods with a runtime that follows
// WebXR's async entry/end/reset semantics. GPU rendering is checked separately.
const originalNavigator = Object.getOwnPropertyDescriptor( globalThis, 'navigator' );
let requested, failLayer = false, failFloor = false, entryGate = null, lastSession;
class Session extends EventTarget {
	constructor() { super(); this.visibilityState = 'visible'; this.frameRate = 72; this.inputSources = []; this.space = new EventTarget(); this.callbacks = new Map(); this.raf = 0; this.ended = false; }
	updateRenderState( state ) { this.renderState = state; }
	async requestReferenceSpace( type ) { if ( type === 'local-floor' && failFloor ) throw Error( 'No floor' ); if ( entryGate ) await entryGate; this.spaceType = type; return this.space; }
	requestAnimationFrame( cb ) { this.callbacks.set( ++this.raf, cb ); return this.raf; }
	cancelAnimationFrame( id ) { this.callbacks.delete( id ); }
	async end() { if ( !this.ended ) { this.ended = true; this.callbacks.clear(); this.dispatchEvent( new Event( 'end' ) ); } }
}
Object.defineProperty( globalThis, 'navigator', { configurable: true, value: { gpu: {}, xr: {
	async requestSession( mode, options ) { requested = { mode, options }; return lastSession = new Session(); },
} } } );
globalThis.isSecureContext = true;
globalThis.document = { pointerLockElement: null };
globalThis.XRGPUBinding = class {
	getPreferredColorFormat() { return 'rgba8unorm'; }
	createProjectionLayer( init ) { if ( failLayer ) throw Error( 'Layer rejected' ); this.layer = { init, destroyed: false, destroy() { this.destroyed = true; } }; return this.layer; }
	getViewSubImage() { return {}; }
};
const make = () => {
	const p = Object.create( XRPreview.prototype );
	const input = { keys: new Set( ['KeyW'] ), pressed: new Set( ['KeyE'] ), mouseDown: true, rightDown: true, look: { x: 30, y: 20 }, enabled: true,
		reset() { this.keys.clear(); this.pressed.clear(); this.mouseDown = this.rightDown = false; this.look.x = this.look.y = 0; } };
	const player = { position: new Vector3( 0, 10, 0 ), velocity: new Vector3(), yaw: 0, pitch: 0, colliders: new Colliders(), groundAt: () => 10 };
	const app = p.app = { player, input, camera: new PerspectiveCamera( 62, 1, 0.1, 1000 ),
		sceneRenderer: { width: 640, height: 360, setSize( width, height ) { this.width = width; this.height = height; } }, post: {},
		engine: { stops: 0, resizes: 0, stop() { this.stops++; }, resize() { this.resizes++; app.camera.aspect = 2; } },
		village: { station: { moving: { doors: [] } } }, frames: 0, starts: 0, cameraCut() {}, start() { this.starts++; }, frame() { this.frames++; },
	};
	p.active = false; p.entering = false; p.session = null; p.location = 0; p.scale = 0.65;
	p.root = { hidden: false, querySelector: () => ( {} ) }; p.enterButton = {}; p.status = {}; p.locationSelect = {};
	p.controllers = new Map(); p.controllerInput = new ControllerInput(); p.stats = new SessionStats( 0.65 );
	p._matrix = new Matrix4(); p._scale = new Vector3(); p.rendererFormat = 'rgba8unorm'; p.renderer = { render() {} };
	p._controllers = () => {};
	return p;
};
const pose = ( x = 0, y = 1.62 ) => {
	const position = new Vector3( x, y, 0 ), orientation = new Quaternion();
	return { transform: { position, orientation, matrix: new Matrix4().compose( position, orientation, new Vector3( 1, 1, 1 ) ).toArray() }, views: [ {}, {} ] };
};
const source = ( handedness, { move = 0, turn = 0, use = false, next = false } = {} ) => ( {
	handedness, gamepad: { mapping: 'xr-standard', axes: [ 0, 0, turn, move ], buttons: Array.from( { length: 6 }, ( _, i ) => ( { pressed: i === 0 ? use : i === 4 ? next : false } ) ) },
} );
const tick = ( p, time, head = pose(), session = p.session ) => p._frame( time, { session, getViewerPose: () => head } );

try {
	const p = make(); await p.enter(); const session = p.session;
	assert.equal( requested.mode, 'immersive-vr' );
	assert.deepEqual( requested.options.requiredFeatures, ['webgpu'] );
	assert.equal( session.renderState.layers[0].init.scaleFactor, 0.65 );
	assert.equal( p.active, true ); assert.equal( p.app.input.enabled, false ); assert.equal( p.app.input.mouseDown, false );
	assert.equal( p.app.engine.stops, 1 );
	session.inputSources = [ source( 'left', { move: -1 } ), source( 'right', { turn: 1, use: true, next: true } ) ];
	tick( p, 0 ); assert.equal( p.location, 0 ); assert.equal( p.app.player.position.z, 0 );
	session.inputSources = []; tick( p, 14 );
	session.inputSources = [ source( 'left', { move: -1 } ) ]; tick( p, 28 );
	assert.ok( p.app.player.position.z < 0 );
	const before = p.app.player.position.clone(), frames = p.app.frames;
	session.visibilityState = 'visible-blurred'; tick( p, 500, pose( 8 ) ); tick( p, 600, pose( 8 ) );
	assert.equal( p.app.frames, frames ); assert.equal( p.stats.pauses, 1 );
	session.visibilityState = 'visible';
	session.inputSources = [ source( 'left', { move: -1 } ), source( 'right', { turn: 1, next: true } ) ];
	tick( p, 5000, pose( 8 ) );
	assert.equal( p.location, 0 ); assert.equal( p.app.player.position.distanceTo( before ), 0 );
	assert.ok( p.stats.frameIntervalMs < 15, 'system overlay time was counted as a dropped frame' );
	session.inputSources = []; tick( p, 5014, pose( 8 ) );
	const door = { center: new Vector3( 0, 11.4, before.z - 1 ), width: 1, target: 0, open: 0, block: { solid: true } };
	p.app.village.station.moving.doors.push( door );
	const right = { visible: true, position: new Vector3( 0, 11.4, before.z ), quaternion: new Quaternion() };
	p.controllers.set( 'right', right );
	session.inputSources = [ source( 'right', { use: true } ) ]; tick( p, 5016, pose( 8 ) );
	assert.equal( door.target, 1, 'tracked right trigger did not open the door' );
	session.inputSources = []; tick( p, 5018, pose( 8 ) );
	right.visible = false; session.inputSources = [ source( 'right', { use: true } ) ]; tick( p, 5020, pose( 8 ) );
	assert.equal( door.target, 1, 'untracked controller acted using head gaze' );
	session.space.dispatchEvent( new Event( 'reset' ) );
	session.inputSources = [ source( 'right', { next: true } ) ]; tick( p, 5028, pose( 20 ) );
	assert.equal( p.location, 0 ); assert.equal( p.app.player.position.distanceTo( before ), 0 );
	session.inputSources = []; tick( p, 5042 );
	tick( p, 5056, null ); assert.equal( p.stats.pauses, 2 );
	await p.exit(); assert.equal( p.active, false ); assert.equal( p.layer, null ); assert.equal( p.views, null );
	assert.equal( p.app.starts, 1 ); assert.equal( p.app.engine.resizes, 1 ); assert.equal( p.app.camera.fov, 62 );
	assert.equal( p.app.input.enabled, true ); assert.equal( p.app.input.look.x, 0 );
	await p.enter(); const frames2 = p.app.frames; tick( p, 9000, pose(), session );
	assert.equal( p.app.frames, frames2, 'stale session callback rendered into the new session' );
	await p.exit(); assert.equal( p.app.starts, 2 );
	console.log( 'PASS entry, neutral controls, overlays, lost pose, reference-space resets, exit/re-entry, resize and stale callbacks' );

	failFloor = true; const fallback = make(); await fallback.enter();
	assert.equal( fallback.session.spaceType, 'local' ); tick( fallback, 0, pose( 0, 0 ) );
	assert.ok( Math.abs( fallback.app.camera.position.y - 11.62 ) < 1e-6 ); await fallback.exit(); failFloor = false;
	console.log( 'PASS seated local-space fallback through the production session setup' );

	const errorOutput = console.error; console.error = () => {};
	try {
		failLayer = true; const failed = make(); await failed.enter(); failLayer = false;
		assert.equal( failed.active, false ); assert.equal( lastSession.ended, true );
		assert.equal( failed.app.engine.stops, 0 ); assert.match( failed.status.textContent, /Layer rejected/ );
		assert.equal( failed.enterButton.disabled, false );
		await failed.enter(); assert.equal( failed.active, true ); await failed.exit();
		const broken = make(); await broken.enter(); broken.app.frame = () => { throw Error( 'Synthetic frame failure' ); };
		tick( broken, 0 ); assert.equal( broken.active, false ); assert.equal( broken.app.starts, 1 );
		assert.match( broken.status.textContent, /Synthetic frame failure/ );
	} finally { console.error = errorOutput; }
	console.log( 'PASS rejected layer can retry; frame failure returns to a usable desktop' );

	let release; entryGate = new Promise( resolve => { release = resolve; } );
	const cancelled = make(), pending = cancelled.enter();
	await Promise.resolve(); const layer = cancelled.layer; await cancelled.session.end(); release(); await pending; entryGate = null;
	assert.equal( cancelled.active, false ); assert.equal( cancelled.session, null ); assert.equal( layer.destroyed, true );
	assert.equal( cancelled.app.engine.stops, 0 );
	console.log( 'PASS session end during async entry releases the layer and leaves desktop intact' );

	console.log( 'PASS synthetic XR runtime lifecycle. Physical Quest behavior remains unmeasured.' );
} finally {
	if ( originalNavigator ) Object.defineProperty( globalThis, 'navigator', originalNavigator );
	else delete globalThis.navigator;
}
