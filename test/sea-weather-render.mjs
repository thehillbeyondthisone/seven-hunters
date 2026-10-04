// Compile and draw the new materials on WebGPU before the much slower full-scene review.
import './headless.mjs';
import assert from 'node:assert/strict';
import { GPU } from '../src/engine/gpu/GPU.js';
import { ShaderModule } from '../src/engine/gpu/Shader.js';
import { RenderTarget } from '../src/engine/gpu/Texture.js';
import { MeshRenderer } from '../src/engine/render/MeshRenderer.js';
import { Material } from '../src/engine/render/Material.js';
import { SunShadows } from '../src/engine/render/Shadows.js';
import { setFrameCamera, G } from '../src/engine/render/Frame.js';
import { CliffSurge } from '../src/ocean/CliffSurge.js';
import { SeaWeather } from '../src/weather/SeaWeather.js';
import * as E from '../src/engine/index.js';

await GPU.init( { headless: true } );
GPU.syncPipelines = true;
const errors = [];
GPU.device.addEventListener( 'uncapturederror', ( e ) => errors.push( e.error.message ) );
GPU.device.pushErrorScope( 'validation' );
const terrain = {
	heightAt: ( x, z ) => Math.hypot( x, z ) < 60 ? 16 : - 12,
	landing: ( name ) => ( { stage: { x: name === 'west' ? - 60 : 60, z: 0 }, dir: [ name === 'west' ? - 1 : 1, 0 ] } ),
};
const terrainGPU = { module: new ShaderModule( { name: 'testCliffTerrain', code: 'fn terrainHeightAt( xz: vec2f ) -> f32 { return select( -12.0, 16.0, length( xz ) < 60.0 ); }' } ) };
const scene = new E.Scene(), camera = new E.PerspectiveCamera( 65, 1.5, 0.1, 1000 );
camera.position.set( - 90, 18, 28 ); camera.lookAt( - 60, 4, 0 );
const shore = { period: { value: 14 }, amplitude: { value: 0.4 } };
const surge = new CliffSurge( { scene, terrain, terrainGPU, shore, spray: { emit() {} } } );
const wet = new E.Mesh( new E.BoxGeometry( 5, 5, 5 ), new Material( { name: 'weather test stone', color: 0xccccaa } ) );
wet.position.set( - 62, 2, 0 ); scene.add( wet );
const root = new E.Group(); root.add( wet ); scene.add( root );
const app = { scene, camera, qs: new URLSearchParams( 'weatherPreview' ), terrain: { mesh: root }, terrainGPU,
	rocks: { group: new E.Group() }, village: { group: new E.Group() },
	fft: { local: {}, swell: {}, updateSpectrumUniforms() {} }, shore,
	sky: { sunDiskIntensity: { value: 1 } },
	surface: { amplitude: { value: 1 }, foamCoverage: { value: 1 } },
};
const weather = new SeaWeather( app );
const target = new RenderTarget( 240, 160, { colors: [ 'rgba16float', 'rgba16float', 'rgba8unorm' ], depth: 'depth32float' } );
const renderer = new MeshRenderer();
const shadows = new SunShadows();
G.time.value = 29; G.sunColor.value.setRGB( 1, 1, 1 ); G.skyIrradiance.value.setRGB( 0.3, 0.4, 0.5 );
for ( let i = 0; i < 3; i ++ ) {
	GPU.beginFrame(); G.dt.value = 1 / 60;
	weather.update( 1 / 60 ); surge.update( 1 / 60, camera, weather.state );
	setFrameCamera( camera, 240, 160 );
	shadows.render( scene, renderer, shadows.update( camera, G.sunDir.value ) );
	renderer.render( scene, { camera, kind: 'main', colorViews: target.textures.map( ( t ) => t.view() ), colorFormats: target.formats,
		clearColors: [ [ 0.05, 0.1, 0.12, 1 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ] ], depthView: target.depthTexture.view(), depthFormat: 'depth32float', clearDepth: 0 } );
	GPU.submit(); await GPU.pipelinesReady(); await GPU.queue.onSubmittedWorkDone();
}
const error = await GPU.device.popErrorScope();
assert.equal( error, null, error?.message ); assert.deepEqual( errors, [] );
assert.ok( renderer.stats.draws >= 3, 'cliff sheet, rain and wet stone all draw' );
console.log( 'PASS WebGPU cliff run-up, rain and wet-surface materials: no shader or validation errors.' );
process.exit( 0 );
