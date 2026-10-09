import assert from 'node:assert/strict';
import { Matrix4, PerspectiveCamera, Quaternion, Vector3 } from '../src/engine/index.js';
import { Colliders } from '../src/world/Colliders.js';
import { XRPreview } from '../src/xr/XRPreview.js';
import { XRWebGLBridge } from '../src/xr/XRWebGLBridge.js';
import { ControllerInput } from '../src/xr/Locomotion.js';
import { SessionStats } from '../src/xr/SessionStats.js';
import { GPU } from '../src/engine/gpu/GPU.js';

// Production XRPreview session routing and lifecycle, with only graphics/runtime
// allocation simulated. Actual canvas transfer is checked by xr-bridge-browser.html.
const originalNavigator = Object.getOwnPropertyDescriptor( globalThis, 'navigator' );
const originalInit = XRWebGLBridge.prototype.init, originalDispose = XRWebGLBridge.prototype.dispose;
let requests = [], disposed = 0, gate = null, failInit = false, failNative = false, rejectEnd = false, rejectNativeRequest = false;
class Session extends EventTarget {
	constructor() { super(); this.space = new EventTarget(); this.inputSources = []; this.visibilityState = 'visible'; this.frameRate = 72; this.raf = 0; }
	updateRenderState( state ) { this.renderState = state; }
	async requestReferenceSpace() { return this.space; }
	requestAnimationFrame() { return ++this.raf; }
	cancelAnimationFrame() {}
	async end() { if ( rejectEnd ) throw Error( 'Runtime end failed' ); this.ended = true; this.dispatchEvent( new Event( 'end' ) ); }
}
Object.defineProperty( globalThis, 'navigator', { configurable: true, value: { gpu: {}, xr: {
	async requestSession( mode, options ) {
		const session = new Session(); requests.push( { mode, options, session } );
		if ( rejectNativeRequest && options.requiredFeatures?.includes( 'webgpu' ) ) throw new DOMException( 'WebGPU XR feature rejected', 'NotSupportedError' );
		return session;
	},
	async isSessionSupported() { return true; },
} } } );
globalThis.isSecureContext = true;
globalThis.document = { pointerLockElement: null };
globalThis.XRWebGLLayer = function () {};
delete globalThis.XRGPUBinding;
XRWebGLBridge.prototype.init = async function ( session, scale ) {
	this.disposed = false; this.format = 'rgba8unorm';
	this.layer = { framebuffer: {}, scale, getViewport: view => ( { x: view.eye === 'right' ? 320 : 0, y: 0, width: 320, height: 240 } ) };
	if ( gate ) await gate;
	if ( failInit ) throw Error( 'Graphics initialization failed' );
	if ( this.disposed ) throw Error( 'Cancelled' );
	return this;
};
XRWebGLBridge.prototype.dispose = function () { if ( ! this.disposed ) { this.disposed = true; disposed++; } };
const make = qs => {
	const p = Object.create( XRPreview.prototype );
	const player = { position: new Vector3( 0, 10, 0 ), velocity: new Vector3(), yaw: 0, pitch: 0, colliders: new Colliders(), groundAt: () => 10 };
	const app = p.app = { qs: new URLSearchParams( qs ), player, input: { enabled: true, reset() {} }, camera: new PerspectiveCamera( 62, 1, 0.1, 1000 ),
		sceneRenderer: { width: 640, height: 360, setSize( width, height ) { this.width = width; this.height = height; } }, post: {},
		engine: { stops: 0, stop() { this.stops++; }, resize() {} }, village: { station: { moving: { doors: [] } } }, starts: 0,
		cameraCut() {}, start() { this.starts++; }, frame() { p.render(); },
	};
	p.active = false; p.entering = false; p.session = null; p.location = 0; p.scale = 0.65;
	p.features = {}; p.browser = {};
	p.root = { hidden: false, querySelector: name => name === '.xr-features' ? p.features : name === '.xr-browser' ? p.browser : ( {} ) };
	p.enterButton = {}; p.status = {}; p.locationSelect = {}; p.controllers = new Map();
	p.controllerInput = new ControllerInput(); p.stats = new SessionStats( 0.65 ); p._matrix = new Matrix4(); p._scale = new Vector3();
	p.rendererFormat = 'rgba8unorm'; p.renderer = { render( ...args ) { p.renderArgs = args; } }; p._controllers = () => {};
	return p;
};
const tick = p => {
	const position = new Vector3( 0, 1.62, 0 ), orientation = new Quaternion();
	const transform = { position, orientation, matrix: new Matrix4().compose( position, orientation, new Vector3( 1, 1, 1 ) ).toArray() };
	p._frame( 0, { session: p.session, getViewerPose: () => ( { transform, views: [ { eye: 'left' }, { eye: 'right' } ] } ) } );
};
const errorOutput = console.error; console.error = () => {};
try {
	const p = make(); await p._checkSupport(); assert.match( p.status.textContent, /Headset detected.*WebGL compatibility/ );
	await p.enter();
	assert.equal( p.active, true ); assert.equal( requests[ 0 ].options.requiredFeatures, undefined );
	assert.equal( p.session.renderState.baseLayer, p.bridge.layer ); assert.equal( p.session.renderState.layers, undefined );
	assert.equal( p.renderMode, 'WebGL compatibility' ); tick( p );
	assert.deepEqual( p.views.map( eye => eye.subImage.viewport.x ), [ 0, 320 ] ); assert.equal( p.renderArgs[ 2 ], p.bridge );
	p.renderArgs = null;
	p.render(); assert.equal( p.renderArgs, null, 'desktop events must not render into an opaque XR framebuffer' );
	assert.equal( p.renderingFrame, null ); tick( p ); assert.ok( p.renderArgs );
	p.renderer.render = () => { throw Error( 'Synthetic compositor failure' ); };
	// Verify the callback token also clears on a thrown render without ending this session.
	const originalExit = p.exit; p.exit = () => {};
	tick( p ); assert.equal( p.renderingFrame, null ); p.exit = originalExit;
	p.renderer.render = ( ...args ) => { p.renderArgs = args; }; p.failure = null;
	const firstBridge = p.bridge; firstBridge.boundaryErrorCount = 3; firstBridge.lastBoundaryErrors = [ 1282 ];
	await p.exit(); assert.equal( firstBridge.disposed, true ); assert.equal( p.bridge, null );
	assert.equal( p.lastBoundaryErrorCount, 3 ); assert.deepEqual( p.lastBoundaryErrors, [ 1282 ] );
	await p.enter(); assert.notEqual( p.bridge, firstBridge ); await p.exit(); assert.equal( p.app.starts, 2 );
	console.log( 'PASS standard WebXR request, base layer, eye viewports and bridge disposal across exit/re-entry.' );

	failInit = true; rejectEnd = true; const failed = make(), beforeFailed = disposed; await failed.enter();
	assert.equal( failed.active, false ); assert.equal( failed.bridge, null ); assert.equal( failed.session, null );
	assert.equal( disposed, beforeFailed + 1 ); assert.match( failed.status.textContent, /Graphics initialization failed/ );
	assert.equal( failed.app.engine.stops, 0 ); failInit = rejectEnd = false;
	let release; gate = new Promise( resolve => { release = resolve; } );
	const cancelled = make(), pending = cancelled.enter(); await Promise.resolve();
	const pendingBridge = cancelled.bridge; await cancelled.session.end(); release(); await pending; gate = null;
	assert.equal( pendingBridge.disposed, true ); assert.equal( cancelled.active, false ); assert.equal( cancelled.bridge, null );
	assert.equal( cancelled.app.engine.stops, 0 );
	console.log( 'PASS fallback initialization failure and asynchronous session cancellation release graphics, including rejected runtime end.' );

	globalThis.XRGPUBinding = class {
		getPreferredColorFormat() { return 'rgba8unorm'; }
		createProjectionLayer() { if ( failNative ) throw Error( 'Native layer rejected' ); return { destroy() {} }; }
	};
	GPU.xrCompatible = false; const ordinaryAdapter = make(); await ordinaryAdapter.enter();
	assert.ok( ordinaryAdapter.bridge ); assert.equal( requests.at( - 1 ).options.requiredFeatures, undefined ); await ordinaryAdapter.exit(); GPU.xrCompatible = null;
	const forced = make( 'xrBackend=webgl' ); await forced.enter();
	assert.equal( requests.at( - 1 ).options.requiredFeatures, undefined ); assert.ok( forced.bridge ); await forced.exit();
	failNative = true; const retry = make(), beforeNative = requests.length; await retry.enter(); failNative = false;
	assert.equal( requests.length, beforeNative + 1, 'fallback requested a second session without a new click' );
	assert.deepEqual( requests.at( - 1 ).options.requiredFeatures, [ 'webgpu' ] );
	assert.equal( retry.forceCompatibility, true ); assert.equal( retry.enterButton.textContent, 'Try compatibility VR' );
	assert.match( retry.status.textContent, /Native layer rejected/ );
	await retry.enter(); assert.ok( retry.bridge ); assert.equal( requests.at( - 1 ).options.requiredFeatures, undefined ); await retry.exit();
	rejectNativeRequest = true; const feature = make(), beforeFeature = requests.length; await feature.enter(); rejectNativeRequest = false;
	assert.equal( requests.length, beforeFeature + 1 ); assert.equal( feature.forceCompatibility, true ); assert.equal( feature.session, null );
	await feature.enter(); assert.ok( feature.bridge ); await feature.exit();
	console.log( 'PASS ordinary-adapter or forced compatibility route and explicit next-click fallback after native session-feature or layer rejection.' );

	const xr = navigator.xr; navigator.gpu = null; const diagnostic = make(); await diagnostic._checkSupport();
	assert.match( diagnostic.status.textContent, /Headset detected/ ); assert.match( diagnostic.features.textContent, /WebGPU: no.*headset detected/ );
	navigator.gpu = {}; navigator.xr = xr;
	console.log( 'PASS headset detection stays independent from graphics capability diagnostics.' );
} finally {
	console.error = errorOutput; XRWebGLBridge.prototype.init = originalInit; XRWebGLBridge.prototype.dispose = originalDispose;
	if ( originalNavigator ) Object.defineProperty( globalThis, 'navigator', originalNavigator ); else delete globalThis.navigator;
}
