// Actual WGSL checks with isolated external haze/shadow inputs. These exercise
// aperture direction, masonry reveals, real scene depth, lamp bounds, on/off
// transitions and quality sizing without relying on a particular story state.
import './headless.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GPU } from '../src/engine/gpu/GPU.js';
import { Texture, RenderTarget } from '../src/engine/gpu/Texture.js';
import { ShaderModule } from '../src/engine/gpu/Shader.js';
import { FullscreenPass } from '../src/engine/render/FullscreenPass.js';
import { readTexture } from '../src/engine/gpu/Readback.js';
import { G, setFrameCamera } from '../src/engine/render/Frame.js';
import { RoomAir } from '../src/post/RoomAir.js';
import { PerspectiveCamera, Vector3, Vector4 } from '../src/engine/index.js';
import { writePNG, writeSheet } from '../tools/shots/png.mjs';

await GPU.init( { headless: true } ); GPU.syncPipelines = true;
GPU.device.pushErrorScope( 'validation' );
const gpuErrors = [];
GPU.device.addEventListener( 'uncapturederror', event => gpuErrors.push( event.error.message ) );
const W = 640, H = 360;
const out = resolve( process.argv[ 2 ] || 'artifacts/room-air-fixture' ); mkdirSync( out, { recursive: true } );
const depthValues = new Float32Array( W * H ).fill( 10 );
const depth = new Texture( { width: W, height: H, format: 'r32float', data: depthValues } );
const external = new ShaderModule( { name: 'room-air-fixture-haze', bindings: { fixtureDepth: { texture: depth } }, code: /* wgsl */`
struct HazeRay { dist: f32, dir: vec3f, sky: bool, rayLen: f32 };
fn hazeRay( uv: vec2f ) -> HazeRay {
	let q = frame.invProj * vec4f( uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, .5, 1.0 );
	let viewRay = q.xyz / q.w;
	var r: HazeRay;
	r.dir = normalize( ( frame.invView * vec4f( viewRay, 0.0 ) ).xyz );
	r.dist = textureLoad( fixtureDepth, clamp( vec2i( uv * vec2f( textureDimensions( fixtureDepth ) ) ), vec2i( 0 ), vec2i( textureDimensions( fixtureDepth ) ) - 1 ), 0 ).r;
	r.sky = false; r.rayLen = 1.0; return r;
}
fn sunShadowHard( P: vec3f ) -> f32 { return 1.0; }
fn hazeVisibilityRest( P: vec3f, v: f32 ) -> f32 { return v; }
` } );
const room = { id: 'fixture', min: [ -4, 0, -6 ], max: [ 4, 3, 0 ], windows: [ {
	center: [ 0, 1.7, -6.15 ], normal: [ 0, 0, -1 ], right: [ 1, 0, 0 ], halfWidth: .68, halfHeight: .85,
	outerCenter: [ 0, 1.7, -6.6 ], innerCenter: [ 0, 1.7, -6 ], openingHalfWidth: .82, openingHalfHeight: 1,
	mullionWidth: .022, muntinHeight: .045, transmission: .8,
} ] };
const camera = new PerspectiveCamera( 66, W / H, .1, 100 );
camera.position.set( 2.5, 1.5, -1.15 ); camera.lookAt( -.5, 1.25, -4.5 );
const lights = { roomAirLights: [] };
const haze = { module: external, enabled: { value: 1 } };
const air = new RoomAir( { depthTexture: depth, haze, layout: [ room ], localLights: lights } );
air.setSize( W, H );
const output = new RenderTarget( W, H, { colors: [ 'rgba8unorm' ] } );
const composite = new FullscreenPass( { label: 'room air fixture composite', modules: [ air.compositeModule ], colorFormats: [ 'rgba8unorm' ], code: /* wgsl */`
fn fragment( in: FSIn ) -> vec4f {
	let c = roomAirApply( in.uv, vec4f( 0.0, 0.0, 0.0, 1.0 ) );
	return vec4f( c.rgb * 3.0, 1.0 );
}` } );
G.sunDir.value.set( .35, .25, -1 ).normalize(); G.sunColor.value.setRGB( 8, 6.7, 5.1 );
G.skyIrradiance.value.setRGB( 0, 0, 0 ); G.cameraUnderwater.value = 0;

async function draw() {
	GPU.beginFrame(); setFrameCamera( camera, W, H );
	air.update( camera ); air.render(); composite.render( { colorViews: [ output.texture ], clear: [ 0, 0, 0, 0 ] } );
	GPU.submit();
	return new Uint8Array( ( await readTexture( output.texture ) ).data );
}
function measure( pixels ) {
	let red = 0, green = 0, blue = 0, lit = 0;
	for ( let i = 0; i < pixels.length; i += 4 ) {
		red += pixels[ i ]; green += pixels[ i + 1 ]; blue += pixels[ i + 2 ];
		if ( pixels[ i ] + pixels[ i + 1 ] + pixels[ i + 2 ] > 0 ) lit ++;
	}
	return { red, green, blue, lit };
}
const screenshots = [], metrics = {};
function save( name, pixels ) {
	writePNG( resolve( out, `${ name }.png` ), W, H, pixels );
	screenshots.push( { w: W, h: H, rgba: pixels } ); metrics[ name ] = measure( pixels );
}

const sun = await draw(); save( 'window-shafts', sun );
assert.ok( metrics[ 'window-shafts' ].lit > 100, 'sunlight through the real aperture creates visible scattering' );
assert.ok( metrics[ 'window-shafts' ].lit < W * H * .65, 'a window shaft stays localized rather than washing the full room' );
assert.deepEqual( await draw(), sun, 'a held view is deterministic without temporal history or flicker' );
G.sunDir.value.z *= -1;
const wrongSide = await draw();
assert.equal( measure( wrongSide ).lit, 0, 'sun behind a solid wall cannot create a shaft' );
assert.deepEqual( air.activePassNames, [], 'a sunless room without a live lamp submits no volume pass' );
G.sunDir.value.z *= -1;
air.strength.value = 0;
assert.equal( measure( await draw() ).lit, 0, 'off skips stale scattering in the composite' );
assert.deepEqual( air.activePassNames, [], 'off submits no scatter pass' );
air.strength.value = 1;
assert.deepEqual( await draw(), sun, 're-enable reproduces the volume without history from the disabled interval' );
haze.enabled.value = 0;
assert.equal( measure( await draw() ).lit, 0, 'global haze off also disables room air and stale composite reads' );
assert.deepEqual( air.activePassNames, [] );
haze.enabled.value = 1;
assert.deepEqual( await draw(), sun, 'global haze re-enable reproduces the local effect' );

depthValues.fill( .2 ); depth.upload( depthValues );
assert.equal( measure( await draw() ).lit, 0, 'foreground scene depth stops the volume before the aperture beam' );
depthValues.fill( 10 ); depth.upload( depthValues );
G.sunColor.value.setRGB( 0, 0, 0 );
lights.roomAirLights.push( {
	position: new Vector4( 0, 1.65, -3.5, 25 ), color: new Vector4( 30, 15, 5, -1.5 ), direction: new Vector4( 0, -1, 0, -2 ),
	boundMin: new Vector4( ...room.min, .15 ), boundMax: new Vector4( ...room.max, 0 ),
} );
const warm = await draw(); save( 'warm-lamp-haze', warm );
const m = metrics[ 'warm-lamp-haze' ];
assert.ok( m.lit > 100 && m.red > m.green * 1.5 && m.green > m.blue * 1.5, 'haze keeps the lit oil lamp warm' );
lights.roomAirLights[ 0 ].boundMin.set( 30, 0, 30, .15 ); lights.roomAirLights[ 0 ].boundMax.set( 40, 3, 40, 0 );
assert.equal( measure( await draw() ).lit, 0, 'a neighbouring bounded lamp contributes no scatter to this room' );
lights.roomAirLights.length = 0;
assert.equal( measure( await draw() ).lit, 0, 'an extinguished source leaves no luminous residual haze' );
assert.deepEqual( air.activePassNames, [], 'extinguishing the last light removes the room air GPU pass' );
camera.position.set( 30, 1.5, 30 );
assert.equal( measure( await draw() ).lit, 0, 'exterior camera submits no local room effect' );
assert.deepEqual( air.activePassNames, [] );
camera.position.set( 2.5, 1.5, -1.15 ); camera.lookAt( -.5, 1.25, -4.5 );
G.sunColor.value.setRGB( 8, 6.7, 5.1 );
air.setQuality( .5 ); assert.deepEqual( [ air.low.width, air.low.height ], [ 160, 90 ] );
await draw(); air.setQuality( 1.5 ); assert.deepEqual( [ air.low.width, air.low.height ], [ 480, 270 ] );
await draw();
assert.equal( await GPU.device.popErrorScope(), null, 'volume and composite compile without validation errors' );
assert.deepEqual( gpuErrors, [] );
writeSheet( resolve( out, 'room-air-review.png' ), screenshots, 2 );
writeFileSync( resolve( out, 'verification.json' ), JSON.stringify( { metrics, gpuErrors, checks: [ 'aperture visibility', 'directional sunlight', 'stable held view', 'off/re-enable', 'scene depth occlusion', 'warm lamp color', 'partition bounds', 'extinction', 'exterior bypass', 'quality resizing' ] }, null, 2 ) + '\n' );
console.log( `PASS native WebGPU room air: ${ metrics[ 'window-shafts' ].lit } shaft pixels, ${ m.lit } warm haze pixels; aperture direction, depth, room bounds, extinguished/off/exterior bypass, deterministic held view and quality sizing; no GPU errors.` );
process.exit( 0 );
