// The actual plume shader: wind direction/strength, held story time and one draw.
// node test/chimney-smoke-render.mjs [output-directory]
import './headless.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ChimneySmoke } from '../src/world/flannan/ChimneySmoke.js';
import { Scene, PerspectiveCamera, Vector3 } from '../src/engine/index.js';
import { GPU } from '../src/engine/gpu/GPU.js';
import { RenderTarget } from '../src/engine/gpu/Texture.js';
import { readTexture } from '../src/engine/gpu/Readback.js';
import { MeshRenderer } from '../src/engine/render/MeshRenderer.js';
import { SunShadows } from '../src/engine/render/Shadows.js';
import { G, setFrameCamera } from '../src/engine/render/Frame.js';
import { writePNG, writeSheet } from '../tools/shots/png.mjs';

const W = 640, H = 360, out = resolve( process.argv[ 2 ] || 'artifacts/chimney-smoke' );
mkdirSync( out, { recursive: true } );
await GPU.init( { headless: true } );
GPU.syncPipelines = true;
GPU.device.pushErrorScope( 'validation' );
const errors = [];
GPU.device.addEventListener( 'uncapturederror', event => errors.push( event.error.message ) );
const camera = new PerspectiveCamera( 50, W / H, .1, 200 );
camera.position.set( 0, 7, 45 ); camera.lookAt( 0, 4, 0 );
const renderer = new MeshRenderer();
const shadows = new SunShadows();
const target = new RenderTarget( W, H, { colors: [ 'rgba8unorm' ] } );
G.skyIrradiance.value.setRGB( .4, .5, .65 ); G.sunColor.value.setRGB( 1, .9, .75 );

async function draw( smoke, clear = [ .55, .65, .75, 1 ] ) {
	const scene = new Scene();
	if ( smoke ) scene.add( smoke.group );
	GPU.beginFrame(); setFrameCamera( camera, W, H );
	renderer.render( scene, { camera, kind: 'color', colorViews: [ target.texture.view() ], colorFormats: target.formats,
		clearColors: [ clear ] } );
	GPU.submit();
	await GPU.pipelinesReady(); await GPU.queue.onSubmittedWorkDone();
	const { data } = await readTexture( target.texture );
	return new Uint8Array( data );
}

const background = await draw( null ), shots = [], metrics = {};
function measure( rgba ) {
	let weight = 0, x = 0, y = 0, minX = W, maxX = 0, minY = H, maxY = 0;
	for ( let i = 0; i < W * H; i ++ ) {
		const difference = Math.max( 0, background[ i * 4 ] - rgba[ i * 4 ] );
		if ( difference <= 1 ) continue;
		const px = i % W, py = Math.floor( i / W );
		weight += difference; x += px * difference; y += py * difference;
		minX = Math.min( minX, px ); maxX = Math.max( maxX, px );
		minY = Math.min( minY, py ); maxY = Math.max( maxY, py );
	}
	return { weight, x: x / weight, y: y / weight, width: maxX - minX, height: maxY - minY };
}
for ( const [ name, speed, direction ] of [ [ 'light-air', 3, 1 ], [ 'gale-east', 21, 1 ], [ 'gale-west', 21, -1 ] ] ) {
	G.windSpeed.value = speed; G.windDir.value.set( direction, 0 );
	const smoke = new ChimneySmoke( new Vector3() );
	smoke.update( 4, camera, 1 );
	const rgba = await draw( smoke );
	assert.equal( renderer.stats.draws, 1, 'all wisps render in one instanced draw' );
	metrics[ name ] = measure( rgba );
	assert.ok( metrics[ name ].weight > 1000, `${ name } plume is visible` );
	writePNG( resolve( out, name + '.png' ), W, H, rgba );
	shots.push( { w: W, h: H, rgba } );

	// Reading/paused callers send dt=0. Even when external wind changes, the
	// authored plume must hold until their clock resumes.
	G.windSpeed.value = 38; G.windDir.value.set( 0, 1 );
	smoke.update( 0, camera, 1 );
	assert.deepEqual( await draw( smoke ), rgba, 'held story time preserves the rendered plume' );
	smoke.update( 0, camera, 0 );
	assert.deepEqual( await draw( smoke ), background, 'unlit stove has no plume' );
	assert.equal( renderer.stats.draws, 0, 'unlit stove costs no draw' );
}
assert.ok( metrics[ 'gale-east' ].x > W / 2 + 30, 'east wind carries the plume to the right' );
assert.ok( metrics[ 'gale-west' ].x < W / 2 - 30, 'reversing wind carries the plume to the left' );
assert.ok( metrics[ 'gale-east' ].width > metrics[ 'light-air' ].width * 1.5, 'gale stretches the plume downwind' );
assert.ok( metrics[ 'gale-east' ].y > metrics[ 'light-air' ].y + 8, 'gale keeps the plume lower than light air' );

// The return from the tramway uses the stove plume as a visual clue at twilight.
// It must retain the previous plume's faint readability even without daylight.
G.windSpeed.value = 9; G.windDir.value.set( 1, 0 );
G.skyIrradiance.value.setRGB( 0, 0, 0 ); G.sunColor.value.setRGB( 0, 0, 0 );
const twilight = new ChimneySmoke( new Vector3() ); twilight.update( 4, camera, 1 );
const clear = [ .004, .006, .009, 1 ], dark = await draw( null, clear ), cue = await draw( twilight, clear );
let contrast = 0;
for ( let i = 0; i < cue.length; i += 4 ) contrast += Math.abs( cue[ i ] - dark[ i ] );
assert.ok( contrast > 100, `twilight stove plume retains contrast at the authored strength (${ contrast })` );
metrics.twilightContrast = contrast;
writeSheet( resolve( out, 'plume-review.png' ), shots, 3 );
const validation = await GPU.device.popErrorScope();
assert.equal( validation, null, validation?.message ); assert.deepEqual( errors, [] );
writeFileSync( resolve( out, 'verification.json' ), JSON.stringify( { metrics, draws: 1, gpuErrors: errors,
	checks: [ 'wind reversal', 'low stretched gale plume', 'held time', 'stove strength', 'twilight cue', 'single instanced draw' ] }, null, 2 ) + '\n' );
console.log( 'PASS native WebGPU chimney plume: follows wind, stretches/lower in gale, pauses with story time, stove-controlled visibility, one draw; no GPU errors.' );
process.exit( 0 );
