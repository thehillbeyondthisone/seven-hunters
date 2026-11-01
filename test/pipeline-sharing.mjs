import './headless.mjs';
import assert from 'node:assert/strict';
import { GPU } from '../src/engine/gpu/GPU.js';
import { RenderTarget, Texture } from '../src/engine/gpu/Texture.js';
import { readTexture } from '../src/engine/gpu/Readback.js';
import { setFrameCamera } from '../src/engine/render/Frame.js';
import { basicMaterial } from '../src/engine/render/Material.js';
import { MeshRenderer } from '../src/engine/render/MeshRenderer.js';
import { SunShadows } from '../src/engine/render/Shadows.js';
import { Mesh, Scene, PlaneGeometry, OrthographicCamera } from '../src/engine/index.js';

await GPU.init( { headless: true } );
GPU.device.pushErrorScope( 'validation' );
const errors = [];
GPU.device.addEventListener( 'uncapturederror', ( e ) => errors.push( e.error.message ) );
const renderer = new MeshRenderer();
new SunShadows(); // Initialize the shared shadow resources referenced by mesh shader modules.
renderer.syncPipelines = false;
const scene = new Scene(), geometry = new PlaneGeometry( 0.8, 0.8 );
const red = basicMaterial( { name: 'red', color: 0xff0000 } );
const green = basicMaterial( { name: 'green', color: 0x00ff00, roughness: 0.5 } );
const blue = red.clone();
blue.color = 0x0000ff;
for ( const [ i, material ] of [ red, green, blue ].entries() ) {

	const mesh = new Mesh( geometry, material );
	mesh.position.x = i - 1;
	scene.add( mesh );

}
const camera = new OrthographicCamera( - 1.5, 1.5, 0.5, - 0.5, 0.1, 10 );
camera.position.z = 3;
camera.lookAt( 0, 0, 0 );
const target = new RenderTarget( 96, 32, { colors: [ 'rgba8unorm' ], depth: 'depth32float' } );
const pass = { camera, kind: 'color', colorViews: [ target.texture.view() ], colorFormats: target.formats,
	clearColors: [ [ 0, 0, 0, 1 ] ], depthView: target.depthTexture.view(), depthFormat: 'depth32float', clearDepth: 0 };
function render() {

	GPU.beginFrame();
	setFrameCamera( camera, 96, 32 );
	renderer.render( scene, pass );
	GPU.submit();

}
render();
await GPU.pipelinesReady();
assert.equal( renderer.pipelines.size, 3, 'each material keeps its own bindings' );
assert.equal( renderer.stats.pipelines, 1, 'uniform-only differences and clones compile once' );
render();
const { data } = await readTexture( target.texture );
const pixels = new Uint8Array( data );
for ( let i = 0; i < 3; i ++ ) {

	const pixel = pixels.slice( ( 16 * 96 + 16 + i * 32 ) * 4, ( 16 * 96 + 16 + i * 32 ) * 4 + 3 );
	assert( pixel[ i ] > 240 && pixel.every( ( v, channel ) => channel === i || v < 5 ), `material ${ i } retains its own color: ${ pixel }` );

}

function handleFor( material, options = {}, geo = geometry ) {

	const mesh = new Mesh( geo, material );
	const layout = renderer._cachedLayout( mesh, geo, material );
	return renderer._pipeline( material, layout, { ...pass, depthCompare: 'greater-equal', passKey: 'test' + JSON.stringify( options ), ...options } ).handle;

}
const base = handleFor( red );
assert.equal( base, handleFor( green ), 'identical code and state share a handle' );
const changed = red.clone();
changed.surface = 's.albedo = vec3f( 0.5 );';
assert.notEqual( base, handleFor( changed ), 'different shader code must not share' );
const biased = red.clone();
biased.depthBias = 1;
assert.notEqual( base, handleFor( biased ), 'different depth state must not share' );
assert.notEqual( base, handleFor( red, { sampleCount: 4 } ), 'MSAA variants stay separate' );
assert.notEqual( base, handleFor( red, { colorFormats: [ 'rgba16float' ] } ), 'target formats stay separate' );
const withoutUV = geometry.clone();
withoutUV.deleteAttribute( 'uv' );
assert.notEqual( base, handleFor( red, {}, withoutUV ), 'different vertex layouts stay separate' );

const a = new Texture( { width: 1, height: 1, format: 'rgba8unorm', data: new Uint8Array( [ 255, 0, 0, 255 ] ) } );
const b = new Texture( { width: 1, height: 1, format: 'rgba8unorm', data: new Uint8Array( [ 0, 255, 0, 255 ] ) } );
const options = { textures: { tint: a }, surface: 's.albedo = textureLoad( tint, vec2i( 0 ), 0 ).rgb;' };
const texturedA = basicMaterial( options );
const texturedB = basicMaterial( { ...options, textures: { tint: b } } );
assert.equal( handleFor( texturedA ), handleFor( texturedB ), 'texture identity does not change a compatible pipeline' );
const extended = basicMaterial( { uniforms: { extra: [ 'vec4f', [ 1, 0, 0, 1 ] ] }, surface: 's.albedo = mat.extra.rgb;' } );
assert.notEqual( base, handleFor( extended ), 'uniform layout and shader differences stay separate' );
await GPU.pipelinesReady();
renderer.deferMaterial = () => true;
const deferredMaterial = basicMaterial( { surface: 's.albedo = vec3f( 0.125 );' } );
const deferredHandle = handleFor( deferredMaterial );
assert.equal( deferredHandle.pipeline, null );
assert.equal( deferredHandle.promise, undefined, 'deferred shaders do not compile or block startup readiness' );
assert.equal( GPU.pendingLabels().length, 0 );
renderer.deferMaterial = null;
assert.equal( handleFor( deferredMaterial ), deferredHandle, 'activating a cached material reuses the queued handle' );
assert( deferredHandle.promise, 'removing deferral activates cached pipeline lookups' );
assert.equal( deferredHandle.start(), deferredHandle.start(), 'starting twice never recompiles' );
await GPU.pipelinesReady();
scene.children[ 0 ].material = texturedA;
scene.children[ 1 ].material = texturedB;
render();
const texturePixels = new Uint8Array( ( await readTexture( target.texture ) ).data );
assert.deepEqual( [ ...texturePixels.slice( ( 16 * 96 + 16 ) * 4, ( 16 * 96 + 16 ) * 4 + 3 ) ], [ 255, 0, 0 ], 'first material samples its red texture' );
assert.deepEqual( [ ...texturePixels.slice( ( 16 * 96 + 48 ) * 4, ( 16 * 96 + 48 ) * 4 + 3 ) ], [ 0, 255, 0 ], 'shared pipeline samples the second material\'s green texture' );
await GPU.queue.onSubmittedWorkDone();
const validation = await GPU.device.popErrorScope();
assert.equal( validation, null, validation?.message );
assert.deepEqual( errors, [] );
console.log( 'Pipeline sharing: independent colors, clones, textures and incompatible variants verified.' );
process.exit( 0 );
