// Exercise the actual instanced material through WebGPU rather than repeating
// its light equations on the CPU. An empty black fixture isolates scattered
// radiance, including a lamp's extinction and its architectural room mask.
import './headless.mjs';
import assert from 'node:assert/strict';
import { GPU } from '../src/engine/gpu/GPU.js';
import { Texture, RenderTarget } from '../src/engine/gpu/Texture.js';
import { readTexture } from '../src/engine/gpu/Readback.js';
import { G, setFrameCamera } from '../src/engine/render/Frame.js';
import { MeshRenderer } from '../src/engine/render/MeshRenderer.js';
import { ShadowUniforms, setShadowMap } from '../src/engine/render/wgsl/lighting.js';
import { StationMotes, loadStationDustAmount, saveStationDustAmount } from '../src/fx/StationMotes.js';
import { LocalLights } from '../src/materials/LocalLights.js';
import { ROOM, TOWER } from '../src/world/flannan/Station.js';
import { stationLightBounds } from '../src/world/flannan/StationLighting.js';
import { Scene, PerspectiveCamera, Vector3, Color } from '../src/engine/index.js';

// Saved controls must also work when storage is absent, corrupted or denied.
const originalStorage = Object.getOwnPropertyDescriptor( globalThis, 'localStorage' );
const saved = new Map();
Object.defineProperty( globalThis, 'localStorage', { configurable: true, value: {
	getItem: key => saved.get( key ) ?? null,
	setItem: ( key, value ) => saved.set( key, value ),
} } );
assert.equal( loadStationDustAmount(), 1, 'new devices start at the subtle recommended density' );
saveStationDustAmount( 8.5 );
assert.equal( loadStationDustAmount(), 8.5, 'dust amount persists across a reload' );
saveStationDustAmount( 0 );
assert.equal( loadStationDustAmount(), 0, 'off persists as zero, rather than reverting to default' );
saveStationDustAmount( 100 );
assert.equal( loadStationDustAmount(), 10, 'saved amounts cannot exceed the supported population' );
saved.set( 'sevenhunters.interiorDust', 'not a number' );
assert.equal( loadStationDustAmount(), 1, 'invalid saved settings recover to the recommended density' );
Object.defineProperty( globalThis, 'localStorage', { configurable: true, get() { throw new Error( 'storage denied' ); } } );
assert.equal( loadStationDustAmount(), 1 );
assert.doesNotThrow( () => saveStationDustAmount( 4 ) );
if ( originalStorage ) Object.defineProperty( globalThis, 'localStorage', originalStorage );
else delete globalThis.localStorage;

await GPU.init( { headless: true } );
GPU.syncPipelines = true;
GPU.device.pushErrorScope( 'validation' );
const errors = [];
GPU.device.addEventListener( 'uncapturederror', e => errors.push( e.error.message ) );
const W = 640, H = 400;
const scene = new Scene(), mr = new MeshRenderer();
const camera = new PerspectiveCamera( 70, W / H, .1, 100 );
camera.position.set( ( ROOM.x0 + ROOM.x1 ) / 2, TOWER.floor + 1.62, ROOM.z1 - .35 );
camera.lookAt( camera.position.x, camera.position.y, ROOM.z0 );
const motes = new StationMotes(); scene.add( motes.mesh );
const geometry = motes.mesh.geometry, material = motes.material;
const positions = geometry.getAttribute( 'position' ).array;
assert.equal( motes.amount, 1 );
assert.equal( motes.particleCount, 768, 'recommended density preserves the original population' );
for ( const [ input, expected ] of [ [ - 3, 0 ], [ 25, 10 ], [ NaN, 1 ], [ Infinity, 1 ], [ 'invalid', 1 ] ] ) {
	motes.amount = input;
	assert.equal( motes.amount, expected, `amount ${ input } is bounded safely` );
}
motes.amount = .12501;
assert.equal( motes.particleCount, 100, 'fractional density grows evenly in all four rooms' );
assert.equal( motes.material.uniforms.population.value, 192 * .12501, 'fractional newest motes fade in rather than jumping to full opacity' );
motes.amount = 1;
const lights = new LocalLights();
const lamp = lights.add( {
	position: camera.position.clone().add( new Vector3( 0, .2, -1 ) ),
	color: new Color( 1, .65, .3 ), intensity: 40, range: 12,
	always: true, scale: 1, flicker: 0,
} );
lamp.bounds = stationLightBounds( lamp.position );
const rt = new RenderTarget( W, H, { colors: [ 'rgba8unorm', 'rgba16float', 'rgba8unorm' ], depth: 'depth32float', label: 'station mote fixture' } );
G.time.value = 12; G.dt.value = 1 / 60;
G.sunColor.value.setRGB( 0, 0, 0 ); G.skyIrradiance.value.setRGB( 0, 0, 0 ); G.night.value = 1;
ShadowUniforms.fields.enabled.value = 0;
setShadowMap( new Texture( { label: 'disabled fixture shadows', width: 1, height: 1, depth: 1,
	dimension: '2d-array', format: 'depth32float', usage: [ 'sample', 'render' ] } ) );

async function readDepth() {
	const rowBytes = W * 4, padded = Math.ceil( rowBytes / 256 ) * 256;
	const staging = GPU.device.createBuffer( { size: padded * H, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ } );
	GPU.getEncoder().copyTextureToBuffer( { texture: rt.depthTexture.getGPU(), aspect: 'depth-only' },
		{ buffer: staging, bytesPerRow: padded, rowsPerImage: H }, { width: W, height: H } );
	GPU.submit(); await staging.mapAsync( GPUMapMode.READ );
	const bytes = new Uint8Array( staging.getMappedRange() );
	for ( let y = 0; y < H; y ++ ) assert.ok( bytes.subarray( y * padded, y * padded + rowBytes ).every( b => b === 0 ), 'unlit motes leave reversed depth clear' );
	staging.unmap(); staging.destroy();
}

async function render( clear = 0, assertBlank = false ) {
	GPU.beginFrame(); setFrameCamera( camera, W, H );
	lights.update( camera, 1 / 60 ); motes.update( camera );
	mr.render( scene, { camera, kind: 'main', late: true,
		colorViews: rt.textures.map( t => t.view() ), colorFormats: rt.formats,
		clearColors: [ [ clear, clear, clear, 1 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ] ], depthView: rt.depthTexture.view(), depthFormat: 'depth32float', clearDepth: 0 } );
	GPU.submit();
	const pixels = new Uint8Array( ( await readTexture( rt.texture ) ).data );
	let red = 0, green = 0, blue = 0, lit = 0;
	for ( let i = 0; i < pixels.length; i += 4 ) {
		red += pixels[ i ]; green += pixels[ i + 1 ]; blue += pixels[ i + 2 ];
		if ( pixels[ i ] > 0 ) lit ++;
		if ( assertBlank ) assert.deepEqual( Array.from( pixels.subarray( i, i + 4 ) ), [ Math.round( clear * 255 ), Math.round( clear * 255 ), Math.round( clear * 255 ), 255 ], 'unlit motes leave no alpha silhouette on a grey background' );
	}
	if ( assertBlank ) {
		await readDepth();
		const velocity = new Uint8Array( ( await readTexture( rt.textures[ 1 ] ) ).data );
		assert.ok( velocity.every( b => b === 0 ), 'unlit motes leave no invisible temporal velocity writes' );
	}
	return { red, green, blue, lit };
}

const on = await render();
assert.ok( on.lit > 10, `the actual lamp illuminates visible motes (${ on.lit } pixels)` );
assert.ok( on.red > on.green && on.green > on.blue, 'scattered lamp light retains the warm lamp colour' );
assert.equal( mr.stats.draws, 1, 'default dust is a single instanced draw' );
const pipelineCount = mr.pipelines.size, materialVersion = material.version;
motes.amount = 10;
const dense = await render();
assert.equal( motes.particleCount, 7680, 'the maximum increases actual population tenfold' );
assert.ok( dense.lit > on.lit * 3, `maximum dust adds visible particles (${ on.lit } → ${ dense.lit } lit pixels)` );
assert.equal( mr.stats.draws, 1, 'maximum dust remains a single draw' );
assert.equal( mr.pipelines.size, pipelineCount, 'density changes reuse the same compiled shader' );
assert.equal( material.version, materialVersion );
assert.equal( motes.mesh.geometry, geometry, 'density changes preserve the original geometry' );
assert.equal( geometry.getAttribute( 'position' ).array, positions, 'density changes allocate no particle buffers' );
motes.amount = 0;
await render( .4, true );
assert.equal( mr.stats.draws, 0, 'off removes the dust draw entirely' );
assert.equal( motes.particleCount, 0 );
assert.equal( motes.mesh.visible, false );
motes.amount = 1;
assert.deepEqual( await render(), on, 'changing density and restoring it preserves the same fixed particle field' );
lamp.scale = 0;
const off = await render();
assert.equal( off.red + off.green + off.blue, 0, 'extinguished lamp leaves no luminous motes' );
await render( .4, true );
lamp.scale = 1;
lamp.bounds = { min: [ 100, 100, 100 ], max: [ 101, 101, 101 ], softness: .25 };
const masked = await render();
assert.equal( masked.red + masked.green + masked.blue, 0, 'a light confined to another room cannot illuminate these motes' );
lamp.bounds = stationLightBounds( lamp.position );
const relit = await render();
assert.deepEqual( relit, on, 'relighting restores the same fixed particle field without stale light state' );
assert.equal( await GPU.device.popErrorScope(), null, 'motes compile and render without GPU validation errors' );
assert.deepEqual( errors, [] );
console.log( `PASS station dust: 0/768/7680 motes, ${ on.lit } → ${ dense.lit } warm pixels, stable fields and shared pipeline, bounded saved controls, lamp extinction, room masking and no unlit colour/depth/velocity writes.` );
process.exit( 0 );
