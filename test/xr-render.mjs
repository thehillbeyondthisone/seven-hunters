import './headless.mjs';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { GPU } from '../src/engine/gpu/GPU.js';
import { Texture } from '../src/engine/gpu/Texture.js';
import { readTexture } from '../src/engine/gpu/Readback.js';
import { SceneRenderer } from '../src/engine/render/SceneRenderer.js';
import { MeshRenderer } from '../src/engine/render/MeshRenderer.js';
import { Material } from '../src/engine/render/Material.js';
import { SunShadows } from '../src/engine/render/Shadows.js';
import { XRRenderer } from '../src/xr/XRRenderer.js';
import { writePNG } from './headless.mjs';
import { Scene, Mesh, BoxGeometry, PerspectiveCamera, Matrix4, Quaternion, Vector3 } from '../src/engine/index.js';

await GPU.init( { headless: true } );
const errors = [];
GPU.device.addEventListener( 'uncapturederror', ( e ) => errors.push( e.error.message ) );
GPU.device.pushErrorScope( 'validation' );
const W = 320, H = 240;
const scene = new Scene();
const cube = new Mesh( new BoxGeometry( 0.9, 1.2, 0.9 ), new Material( { name: 'XR stereo near cube', lit: false, color: 0xef6840 } ) );
cube.position.set( - 0.18, 1.62, - 1.5 );
const far = new Mesh( new BoxGeometry( 1.5, 1.5, 1.5 ), new Material( { name: 'XR stereo far cube', lit: false, color: 0x69accc } ) );
far.position.set( 1, 1.62, - 5 );
scene.add( cube, far );
const camera = new PerspectiveCamera( 110, W / H, 0.06, 1000 );
camera.position.set( 0, 1.62, 0 );
const mr = new MeshRenderer();
const sr = new SceneRenderer( mr, scene, camera );
sr.clearColor = [ 0.02, 0.04, 0.07, 1 ];
sr.setSize( W, H );
const app = { camera, scene, sceneRenderer: sr, engine: { meshRenderer: mr }, shadows: new SunShadows( { size: 256, splits: [ 10, 30, 60 ] } ) };
const renderer = new XRRenderer( app, 'rgba8unorm' );
await GPU.pipelinesReady();
const projection = new Matrix4().makePerspective( - 0.06 * W / H, 0.06 * W / H, 0.06, - 0.06, 0.06, 1000, undefined, false ).toArray();
const views = [ - 0.032, 0.032 ].map( ( x, i ) => ( {
	view: { eye: i ? 'right' : 'left', projectionMatrix: projection, transform: { matrix: new Matrix4().compose( new Vector3( x, 1.62, 0 ), new Quaternion(), new Vector3( 1, 1, 1 ) ).toArray() } },
} ) );
const array = new Texture( { width: W, height: H, depth: 2, dimension: '2d-array', format: 'rgba8unorm', usage: [ 'render', 'copySrc' ] } );
const arrayViews = views.map( ( v, i ) => ( { ...v, subImage: {
	colorTexture: array.getGPU(), viewport: { x: 0, y: 0, width: W, height: H },
	getViewDescriptor: () => ( { dimension: '2d', baseArrayLayer: i, arrayLayerCount: 1 } ),
} } ) );
const before = camera.projectionMatrix.clone();
GPU.beginFrame();
renderer.render( arrayViews, new Matrix4() );
await GPU.queue.onSubmittedWorkDone();
assert.ok( camera.projectionMatrix.equals( before ), 'XR rendering did not restore the central projection' );
assert.equal( camera.position.y, 1.62 );
const left = new Uint8Array( ( await readTexture( array, { layer: 0 } ) ).data );
const right = new Uint8Array( ( await readTexture( array, { layer: 1 } ) ).data );
let difference = 0;
for ( let i = 0; i < left.length; i ++ ) difference += Math.abs( left[ i ] - right[ i ] );
assert.ok( difference > 10000, 'left and right eye output is identical or empty' );
const redPixels = ( data, width, x0 = 0, x1 = width ) => {

	let n = 0;
	for ( let y = 0; y < H; y ++ ) for ( let x = x0; x < x1; x ++ ) {

		const i = ( y * width + x ) * 4;
		if ( data[ i ] > data[ i + 1 ] * 1.2 && data[ i ] > 100 ) n ++;

	}
	return n;

};
assert.ok( redPixels( left, W ) > 1000 );
assert.ok( redPixels( right, W ) > 1000 );

// An atlas runtime shares one layer between eye viewports. Rendering eye two
// must load the attachment rather than erase the first eye with a full clear.
const atlas = new Texture( { width: W * 2, height: H, format: 'rgba8unorm', usage: [ 'render', 'copySrc' ] } );
const atlasViews = views.map( ( v, i ) => ( { ...v, subImage: {
	colorTexture: atlas.getGPU(), viewport: { x: i * W, y: 0, width: W, height: H },
	getViewDescriptor: () => ( { dimension: '2d' } ),
} } ) );
GPU.beginFrame();
renderer.render( atlasViews, new Matrix4() );
await GPU.queue.onSubmittedWorkDone();
const both = new Uint8Array( ( await readTexture( atlas ) ).data );
assert.ok( redPixels( both, W * 2, 0, W ) > 1000, 'right-eye clear erased the left viewport' );
assert.ok( redPixels( both, W * 2, W, W * 2 ) > 1000 );

// The compatibility renderer uses ordinary WebGL-session projection matrices,
// private WebGPU canvas targets and an immediate transfer after each eye submit.
const bridgeTargets = views.map( () => new Texture( { width: W, height: H, format: 'rgba8unorm', usage: [ 'render', 'copySrc' ] } ) );
const transferred = [];
let bridgeEye = 0;
const bridge = {
	beginFrame() { bridgeEye = 0; },
	target( width, height ) { assert.equal( width, W ); assert.equal( height, H ); return bridgeTargets[ bridgeEye ].view(); },
	present( viewport ) { assert.equal( GPU.encoder, null, 'compatibility canvas was copied before eye submission' ); transferred.push( viewport.x ); bridgeEye++; },
};
const webglProjection = new Matrix4().makePerspective( - 0.06 * W / H, 0.06 * W / H, 0.06, - 0.06, 0.06, 1000, 2000, false ).toArray();
const bridgeViews = views.map( ( v, i ) => ( { view: { ...v.view, projectionMatrix: webglProjection }, subImage: { viewport: { x: i * W, y: 0, width: W, height: H } } } ) );
GPU.beginFrame(); renderer.render( bridgeViews, new Matrix4(), bridge ); await GPU.queue.onSubmittedWorkDone();
assert.deepEqual( transferred, [ 0, W ] );
for ( const [ i, expected ] of [ left, right ].entries() ) {
	const rendered = new Uint8Array( ( await readTexture( bridgeTargets[ i ] ) ).data );
	assert.deepEqual( rendered, expected, 'WebGL projection or staging viewport changed the eye image' );
}
console.log( 'PASS compatibility eye images match native output, with WebGL projection depth and submission before transfer.' );
const validation = await GPU.device.popErrorScope();
assert.equal( validation, null, validation?.message );
assert.deepEqual( errors, [] );
mkdirSync( 'artifacts/xr-preview', { recursive: true } );
writePNG( 'artifacts/xr-preview/stereo-smoke.png', W * 2, H, both );
console.log( `PASS WebGPU XR render: distinct eyes (difference ${ difference }), array layers, atlas viewports, central-camera restoration and no GPU validation errors.` );
console.log( 'Rendered with synthetic XR views on the local GPU; physical Quest tracking and performance remain unmeasured.' );
process.exit( 0 );
