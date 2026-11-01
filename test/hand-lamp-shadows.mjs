// Actual geometry rendered from the flame in all six directions. No collision
// proxies or screen-space occlusion: blockers can be behind the viewing camera.
import './headless.mjs';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { GPU } from '../src/engine/gpu/GPU.js';
import { RenderTarget } from '../src/engine/gpu/Texture.js';
import { FullscreenPass } from '../src/engine/render/FullscreenPass.js';
import { MeshRenderer } from '../src/engine/render/MeshRenderer.js';
import { Material } from '../src/engine/render/Material.js';
import { SunShadows } from '../src/engine/render/Shadows.js';
import { HandLampShadows, handLampShadowModule, handLampShadowParams } from '../src/station/HandLampShadows.js';
import { LocalLights, localLightsModule } from '../src/materials/LocalLights.js';
import { readTexture } from '../src/engine/gpu/Readback.js';
import { G } from '../src/engine/render/Frame.js';
import { setFrameCamera } from '../src/engine/render/Frame.js';
import { Scene, Mesh, BoxGeometry, Vector3, PerspectiveCamera, BufferGeometry, Float32BufferAttribute, BufferAttribute } from '../src/engine/index.js';
import { writePNG } from '../tools/shots/png.mjs';

await GPU.init( { headless: true } ); GPU.syncPipelines = true;
GPU.device.pushErrorScope( 'validation' );
const errors = []; GPU.device.addEventListener( 'uncapturederror', e => errors.push( e.error.message ) );
const atlas = new SunShadows( { size: 768, splits: [ 10 ], localShadowLayer: true } );
const shadow = new HandLampShadows( atlas, { size: 256 } );
const scene = new Scene(), renderer = new MeshRenderer();
const material = new Material( { color: 0xffffff } );
const blocker = new Mesh( new BoxGeometry( .65, .65, .65 ), material ); blocker.castShadow = true; scene.add( blocker );
const light = { on: true, lantern: true, position: new Vector3(), range: 6.5, scale: 1 };
const W = 193, H = 6, out = new RenderTarget( W, H, { colors: ['rgba8unorm'] } );
const pass = new FullscreenPass( { modules: [ handLampShadowModule ], colorFormats: ['rgba8unorm'], code: /* wgsl */`
fn fragment( in: FSIn ) -> vec4f {
	let dirs = array<vec3f,6>( vec3f(1,0,0), vec3f(-1,0,0), vec3f(0,1,0), vec3f(0,-1,0), vec3f(0,0,1), vec3f(0,0,-1) );
	let face = clamp( i32( in.uv.y * 6.0 ), 0, 5 ); let dir = dirs[ face ];
	let tangent = select( vec3f(0,1,0), vec3f(1,0,0), abs( dir.y ) > .5 );
	let P = dir * 3.0 + tangent * ( ( in.uv.x - .5 ) * 3.0 );
	return vec4f( vec3f( handLampShadowVisibility( P, vec3f(0) ) ), 1.0 );
}` } );
async function draw() {
	GPU.beginFrame(); shadow.render( scene, renderer, light );
	pass.render( { colorViews: [ out.texture ] } ); GPU.submit();
	return new Uint8Array( ( await readTexture( out.texture ) ).data );
}
const dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const centre = ( pixels, face ) => pixels[ ( face * W + Math.floor( W / 2 ) ) * 4 ];
for ( let f = 0; f < 6; f ++ ) {
	blocker.position.set( ...dirs[f] ).multiplyScalar( 1.5 );
	const px = await draw();
	assert.equal( shadow.stats.passes, 6 );
	for ( let i = 0; i < 6; i ++ ) assert.ok( i === f ? centre( px, i ) < 10 : centre( px, i ) > 245, `geometry casts on the correct face: ${ f } / ${ i }` );
	const tangent = Math.abs( dirs[f][1] ) ? new Vector3(1,0,0) : new Vector3(0,1,0);
	blocker.position.addScaledVector( tangent, .6 );
	const offset = await draw();
	assert.ok( offset[(f * W + 174) * 4] < 10 && centre( offset, f ) > 245, `off-centre geometry retains the correct orientation on face ${f}` );
}
blocker.position.set( 0, 0, -1.5 ); await draw();
await draw(); assert.equal( shadow.stats.passes, 0, 'stationary light and geometry reuse the map' );
atlas.enabled = false; await draw(); assert.equal( shadow.stats.passes, 0 ); assert.equal( handLampShadowParams.fields.enabled.value, 0, 'the graphics Shadows setting disables the lantern maps too' );
atlas.enabled = true; await draw(); assert.equal( shadow.stats.passes, 6 );
blocker.position.x = .45;
const shifted = await draw(); assert.equal( shadow.stats.passes, 6, 'a moving door refreshes immediately' );
assert.ok( centre( shifted, 5 ) > 245, 'opening the sightline releases the previous shadow' );
blocker.visible = false;
assert.ok( centre( await draw(), 5 ) > 245, 'hidden variants do not cast' );
blocker.visible = true; blocker.position.x = 0;
material.shadow = 'return false;'; material.needsUpdate = true;
assert.ok( centre( await draw(), 5 ) > 245, 'the real material shadow hook lets clear glass transmit light' );
material.shadow = ''; material.needsUpdate = true;
assert.ok( centre( await draw(), 5 ) < 10 );
light.position.x = 1.3;
assert.ok( centre( await draw(), 5 ) > 245, 'moving the flame moves the cast shadow in the same frame' );
light.on = false; await draw();
assert.equal( shadow.stats.passes, 0 ); assert.equal( handLampShadowParams.fields.enabled.value, 0, 'extinguished lights submit no maps and leave no stale shadow state' );
light.on = true; light.position.x = 0; await draw(); assert.equal( shadow.stats.passes, 6, 'relighting refreshes all faces' );

// A distant material batch must not be submitted in full six times. Put the
// nearby cube in the middle of the source index buffer, so sharing/overwriting
// the main index buffer would erase its shadow and fail this check.
const base = new BoxGeometry( .65, .65, .65 ), count = 512, nearby = 256;
const p = base.attributes.position, indices = base.index;
const positions = new Float32Array( p.count * count * 3 ), batchIndex = new Uint32Array( indices.count * count );
for ( let c = 0; c < count; c ++ ) {
	for ( let i = 0; i < p.count; i ++ ) positions.set( [ p.getX(i) + ( c === nearby ? 0 : 30 + c ), p.getY(i), p.getZ(i) ], ( c * p.count + i ) * 3 );
	for ( let i = 0; i < indices.count; i ++ ) batchIndex[ c * indices.count + i ] = c * p.count + indices.getX(i);
}
const batch = new BufferGeometry(); batch.setAttribute( 'position', new Float32BufferAttribute( positions, 3 ) ); batch.setIndex( new BufferAttribute( batchIndex, 1 ) );
blocker.geometry = batch; shadow.prepare( scene );
assert.ok( centre( await draw(), 5 ) < 10, 'nearby triangles inside a large batch still cast correctly' );
assert.ok( shadow.stats.triangles < batchIndex.length / 3, 'six local faces submit fewer triangles than one whole distant batch' );
assert.equal( batch.index.array, batchIndex, 'bounded shadow indices never replace the original geometry indices' );
const mainCamera = new PerspectiveCamera( 60, 1, .1, 10 );
material.lit = false; material.needsUpdate = true;
const main = new RenderTarget( 33, 33, { colors: ['rgba8unorm'], depth: 'depth32float' } );
GPU.beginFrame(); shadow.valid = false; shadow.render( scene, renderer, light ); setFrameCamera( mainCamera, 33, 33 );
renderer.render( scene, { camera: mainCamera, kind: 'color', colorViews: [ main.texture.view() ], colorFormats: ['rgba8unorm'],
	depthView: main.depthTexture.view(), depthFormat: 'depth32float', clearDepth: 0, clearColors: [[0,0,0,1]] } );
GPU.submit(); const mainPixels = new Uint8Array( ( await readTexture( main.texture ) ).data );
assert.ok( mainPixels[(16*33+16)*4] > 245, 'main rendering retains the complete original index buffer in the same submission' );

// Resolve the actual local-light BRDF hook across a wall behind the blocker.
const lights = new LocalLights(), camera = new PerspectiveCamera(); G.night.value = 1; G.seaLevel.value = -100;
Object.assign( lights.flashlight, { on: true, lantern: true, at: light.position, intensity: 10, range: 6.5, cosInner: -1.5, cosOuter: -2 } );
const surface = new RenderTarget( 193, 129, { colors: ['rgba8unorm'] } );
const shade = new FullscreenPass( { modules: [ localLightsModule ], colorFormats: ['rgba8unorm'], defines: { LOCAL_LIGHTS_CHEAP: 1 }, code: /* wgsl */`
fn fragment( in: FSIn ) -> vec4f {
	let P = vec3f( ( in.uv.x - .5 ) * 4.0, ( .5 - in.uv.y ) * 3.0, -3.0 ); let N = vec3f(0,0,1);
	var acc: LightAccum; hookLocalLights( defaultSurface( N ), P, N, N, &acc );
	return vec4f( acc.directDiffuse, 1.0 );
}` } );
async function wall() {
	GPU.beginFrame(); lights.update( camera, 0 ); shade.render( { colorViews: [ surface.texture ] } ); GPU.submit();
	return new Uint8Array( ( await readTexture( surface.texture ) ).data );
}
const shaded = await wall(); handLampShadowParams.fields.enabled.value = 0; const unshaded = await wall();
const mid = (64 * 193 + 96) * 4;
assert.equal( shaded[ mid ], 0 ); assert.ok( unshaded[ mid ] > 20, 'the actual lantern contribution is occluded on the receiver' );
assert.ok( shaded[ (64 * 193 + 15) * 4 ] > 5, 'unobstructed parts of the same wall stay lit' );
handLampShadowParams.fields.enabled.value = 1;
lights.flashlight.bounds = { min: [-1,-1,-1], max: [1,1,1], softness: .1 };
assert.ok( ( await wall() )[ (64 * 193 + 15) * 4 ] > 5, 'real visibility permits light through an opening beyond the old room box' );
mkdirSync( 'artifacts/lantern-shadows', { recursive: true } );
writePNG( 'artifacts/lantern-shadows/fixture-shadow.png', 193, 129, shaded );
assert.equal( await GPU.device.popErrorScope(), null ); assert.deepEqual( errors, [] );
console.log( 'PASS real six-direction lantern depth shadows, moving flame/doors, hidden casters, glass transmission, bounded batches with independent main indices, opening spill, map reuse, extinction and surface shading; no GPU errors.' );
process.exit( 0 );
