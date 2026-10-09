import assert from 'node:assert/strict';
import { Matrix4, Vector3 } from '../src/engine/math/index.js';
import { GPU } from '../src/engine/gpu/GPU.js';
import { XRWebGLBridge, webglReversedProjection } from '../src/xr/XRWebGLBridge.js';

const projection = new Matrix4().makePerspective( - 0.04, 0.06, 0.065, - 0.045, 0.06, 1000, 2000, false );
const reversed = webglReversedProjection( new Matrix4(), projection.elements );
const close = ( a, b ) => assert.ok( Math.abs( a - b ) < 1e-6, `${ a } != ${ b }` );
for ( const i of [ 0, 4, 8, 12, 1, 5, 9, 13 ] ) close( reversed.elements[ i ], projection.elements[ i ] );
close( new Vector3( 0, 0, - 0.06 ).applyMatrix4( reversed ).z, 1 );
close( new Vector3( 0, 0, - 1000 ).applyMatrix4( reversed ).z, 0 );
console.log( 'PASS WebGL asymmetric eye projection converts to reversed WebGPU depth without changing x/y.' );

let calls, failContext = false, rejectDirect = false, rejectCopy = false, failDraw = false, failBind = false, lost = false, pendingError = 0, gate = null, deleted;
const context = { configure() { calls.push( 'configure' ); }, unconfigure() { calls.push( 'unconfigure' ); }, getCurrentTexture() { return { createView: () => ( {} ) }; } };
const gl = {
	VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7,
	TEXTURE0: 8, TEXTURE_2D: 9, TEXTURE_MIN_FILTER: 10, TEXTURE_MAG_FILTER: 11, LINEAR: 12, TEXTURE_WRAP_S: 13,
	TEXTURE_WRAP_T: 14, CLAMP_TO_EDGE: 15, UNPACK_FLIP_Y_WEBGL: 16, UNPACK_COLORSPACE_CONVERSION_WEBGL: 17, NONE: 0,
	FRAMEBUFFER: 18, COLOR_BUFFER_BIT: 19, RGBA: 20, UNSIGNED_BYTE: 21, TRIANGLES: 22, NO_ERROR: 0,
	async makeXRCompatible() { calls.push( 'compatible' ); if ( gate ) await gate; },
	createShader: () => ( {} ), shaderSource() {}, compileShader() {}, getShaderParameter: () => true, deleteShader() {},
	createProgram: () => ( {} ), attachShader() {}, linkProgram() {}, getProgramParameter: () => true,
	createBuffer: () => ( {} ), bindBuffer() {}, bufferData() {}, useProgram() {}, getAttribLocation: () => 0,
	enableVertexAttribArray() {}, vertexAttribPointer() {}, createTexture: () => ( {} ), activeTexture() {}, bindTexture() {},
	texParameteri() {}, pixelStorei() {}, uniform1i() {}, getUniformLocation: () => ( {} ), isContextLost: () => lost,
	bindFramebuffer( target, framebuffer ) { calls.push( [ 'framebuffer', framebuffer ] ); if ( failBind ) pendingError = 1282; }, clearColor() {}, clear() { calls.push( 'clear' ); },
	viewport( ...v ) { calls.push( [ 'viewport', ...v ] ); }, texImage2D( ...args ) {
		calls.push( [ 'upload', args[ 5 ] ] );
		if ( rejectDirect && args[ 5 ].isGPUCanvas || rejectCopy && args[ 5 ].is2DCanvas ) pendingError = 1282;
	},
	drawArrays() { calls.push( 'draw' ); if ( failDraw ) pendingError = 1282; },
	getError() { const error = pendingError; pendingError = 0; return error; },
	deleteTexture() { deleted.texture++; }, deleteBuffer() { deleted.buffer++; }, deleteProgram() { deleted.program++; },
	getExtension: () => ( { loseContext() { calls.push( 'lose' ); } } ),
};
globalThis.document = { createElement: () => ( { width: 300, height: 150, getContext( type ) {
	if ( type === 'webgpu' ) { this.isGPUCanvas = true; return context; }
	if ( type === '2d' ) { this.is2DCanvas = true; return { drawImage( ...args ) { calls.push( [ 'snapshot', ...args ] ); } }; }
	return failContext ? null : gl;
} } ) };
const originalNavigator = Object.getOwnPropertyDescriptor( globalThis, 'navigator' );
Object.defineProperty( globalThis, 'navigator', { configurable: true, value: { gpu: { getPreferredCanvasFormat: () => 'bgra8unorm' } } } );
globalThis.GPUTextureUsage = { RENDER_ATTACHMENT: 16, COPY_SRC: 1 };
globalThis.XRWebGLLayer = class {
	constructor( session, value, init ) { this.framebuffer = { atlas: true }; calls.push( [ 'layer', session, value, init ] ); }
};

try {
	calls = []; deleted = { texture: 0, buffer: 0, program: 0 };
	const session = {}, bridge = new XRWebGLBridge(); await bridge.init( session, 0.65 );
	assert.equal( calls[ 0 ], 'compatible' );
	assert.equal( calls[ 1 ][ 0 ], 'layer' ); assert.equal( calls[ 1 ][ 3 ].framebufferScaleFactor, 0.65 );
	pendingError = 1282; bridge.beginFrame();
	assert.equal( bridge.boundaryErrorCount, 1 ); assert.deepEqual( bridge.lastBoundaryErrors, [ 1282 ] );
	failBind = true; assert.throws( () => bridge.beginFrame(), /frame start failed.*1282/ ); failBind = false;
	lost = true; assert.throws( () => bridge.beginFrame(), /context was lost/ ); lost = false;
	bridge.beginFrame(); bridge.target( 640, 720 ); bridge.present( { x: 640, y: 0, width: 640, height: 720 } );
	assert.equal( bridge.staging.width, 640 ); assert.equal( bridge.staging.height, 720 );
	assert.deepEqual( calls.find( c => c[ 0 ] === 'viewport' ), [ 'viewport', 640, 0, 640, 720 ] );
	assert.equal( calls.find( c => c[ 0 ] === 'upload' )[ 1 ], bridge.staging );
	assert.ok( calls.findIndex( c => c[ 0 ] === 'upload' ) < calls.indexOf( 'draw' ) );
	const firstUpload = calls.findIndex( c => c[ 0 ] === 'upload' );
	assert.equal( calls.slice( 0, firstUpload ).filter( c => c[ 0 ] === 'framebuffer' ).at( - 1 )[ 1 ], null, 'canvas upload must not bind the opaque XR framebuffer' );
	assert.equal( bridge.transferMode, 'direct' );
	assert.equal( calls.includes( 'clear' ), false, 'WebXR owns clearing its opaque framebuffer' );
	assert.equal( calls.filter( c => c[ 0 ] === 'framebuffer' ).at( - 1 )[ 1 ], null, 'opaque framebuffer must be detached after presenting' );
	rejectDirect = true;
	const beforeRecovery = calls.length;
	bridge.present( { x: 0, y: 0, width: 640, height: 720 } );
	assert.equal( bridge.transferMode, 'canvas2d' );
	assert.equal( bridge.directTransferFailure, 'WebGL 1282' );
	assert.deepEqual( calls.slice( beforeRecovery ).filter( c => c[ 0 ] === 'upload' ).map( c => c[ 1 ] ), [ bridge.staging, bridge.copyCanvas ] );
	assert.equal( calls.find( c => c[ 0 ] === 'snapshot' )[ 1 ], bridge.staging );
	assert.equal( bridge.copyCanvas.width, 640 ); assert.equal( bridge.copyCanvas.height, 720 );
	bridge.target( 320, 240 );
	const beforeNextEye = calls.length;
	bridge.present( { x: 320, y: 0, width: 320, height: 240 } );
	assert.equal( bridge.copyCanvas.width, 320 ); assert.equal( bridge.copyCanvas.height, 240 );
	assert.deepEqual( calls.slice( beforeNextEye ).filter( c => c[ 0 ] === 'upload' ).map( c => c[ 1 ] ), [ bridge.copyCanvas ] );
	assert.equal( calls.filter( c => c[ 0 ] === 'snapshot' ).length, 2, 'each eye must snapshot its own current image' );
	rejectCopy = true;
	assert.throws( () => bridge.present( { x: 0, y: 0, width: 320, height: 240 } ), /Canvas2D texture upload.*WebGL 1282/ );
	rejectCopy = rejectDirect = false;
	failDraw = true;
	assert.throws( () => bridge.present( { x: 0, y: 0, width: 320, height: 240 } ), /compositor draw failed.*1282/ ); failDraw = false;
	assert.equal( calls.filter( c => c[ 0 ] === 'framebuffer' ).at( - 1 )[ 1 ], null, 'failed compositor drawing must also detach the framebuffer' );
	bridge.dispose(); bridge.dispose(); assert.deepEqual( deleted, { texture: 1, buffer: 1, program: 1 } );
	assert.equal( calls.filter( c => c === 'unconfigure' ).length, 1 ); assert.equal( bridge.gl, null );
	assert.equal( bridge.copyCanvas, null ); assert.equal( bridge.copyContext, null );
	console.log( 'PASS compositor viewport, upload-before-draw, 1282 recovery with fresh/resized eye snapshots, stage-specific failures and resource cleanup.' );

	calls = []; failContext = true; const failed = new XRWebGLBridge();
	await assert.rejects( failed.init( {}, 0.5 ), /WebGL context/ ); failed.dispose(); failContext = false;
	let release; gate = new Promise( resolve => { release = resolve; } );
	const cancelled = new XRWebGLBridge(), pending = cancelled.init( {}, 0.5 ); cancelled.dispose(); release();
	await assert.rejects( pending, /cancelled/ ); assert.equal( cancelled.layer, null ); gate = null;
	console.log( 'PASS rejected graphics initialization and cancellation during makeXRCompatible clean up.' );
} finally {
	if ( originalNavigator ) Object.defineProperty( globalThis, 'navigator', originalNavigator ); else delete globalThis.navigator;
}
