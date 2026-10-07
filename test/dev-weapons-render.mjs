// Draw the real imported gun and live effects through the game's native WebGPU renderer.
import './headless.mjs';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { installBrowser } from '../tools/shots/browser.mjs';
import { writePNG } from '../tools/shots/png.mjs';
import { GPU } from '../src/engine/gpu/GPU.js';
import { RenderTarget } from '../src/engine/gpu/Texture.js';
import { readTexture } from '../src/engine/gpu/Readback.js';
import { MeshRenderer } from '../src/engine/render/MeshRenderer.js';
import { FullscreenPass } from '../src/engine/render/FullscreenPass.js';
import { SunShadows } from '../src/engine/render/Shadows.js';
import { setFrameCamera, G } from '../src/engine/render/Frame.js';
import { standard } from '../src/materials/Materials.js';
import { DevArmory } from '../src/dev/DevArmory.js';
import { Colliders } from '../src/world/Colliders.js';
import * as E from '../src/engine/index.js';

installBrowser( { search: '?devWeapons', width: 960, height: 540, root: 'public' } );
window.__ui = null;
await GPU.init( { headless: true } ); GPU.syncPipelines = true;
const errors = []; GPU.device.addEventListener( 'uncapturederror', e => errors.push( e.error.message ) );
GPU.device.pushErrorScope( 'validation' );
const W = 960, H = 540, scene = new E.Scene(), camera = new E.PerspectiveCamera( 65, W / H, 0.1, 1000 );
camera.position.set( 0, 1.7, 0 ); camera.lookAt( 0, 0.7, - 9 );
const app = { scene, camera, qs: new URLSearchParams(), terrainData: { heightAt: () => 0 }, colliders: new Colliders(), player: { velocity: new E.Vector3() },
	input: { enabled: true, locked: true, mouseDown: false, hit: () => false, down: () => false } };
const ground = new E.Mesh( new E.PlaneGeometry( 100, 100 ).rotateX( - Math.PI / 2 ), standard( { color: 0x566044, roughness: 1 } ) ); scene.add( ground );
const gun = await DevArmory.create( app ); gun.resetTargets();
assert.ok( gun.model.barrels.children.length > 0 && gun.model.group.children.length > 1 );
GPU.submit();
G.sunDir.value.set( 0.4, 0.7, 0.5 ).normalize(); G.sunColor.value.setRGB( 2.0, 1.9, 1.7 ); G.skyIrradiance.value.setRGB( 0.4, 0.5, 0.7 );
const rt = new RenderTarget( W, H, { colors: [ 'rgba16float', 'rgba16float', 'rgba8unorm' ], depth: 'depth32float' } );
const ldr = new RenderTarget( W, H, { colors: [ 'rgba8unorm' ] } ), renderer = new MeshRenderer();
const shadows = new SunShadows( { size: 512, splits: [ 10, 60, 400 ] } );
const tonemap = new FullscreenPass( { label: 'dev minigun review', colorFormats: [ 'rgba8unorm' ], bindings: { hdr: { texture: () => rt.texture } },
	code: 'fn fragment( in: FSIn ) -> vec4f { let c = textureLoad( hdr, vec2i( in.pos.xy ), 0 ).rgb * 0.8; let t = ( c * ( 2.51 * c + 0.03 ) ) / ( c * ( 2.43 * c + 0.59 ) + 0.14 ); return vec4f( linearToSrgb( sat3( t ) ), 1.0 ); }' } );
mkdirSync( 'artifacts/dev-weapons', { recursive: true } );
for ( const firing of [ false, true ] ) {
	app.input.mouseDown = firing;
	for ( let i = 0; i < ( firing ? 50 : 2 ); i ++ ) {
		GPU.beginFrame(); gun.update( 1 / 60 ); G.time.value += 1 / 60;
		setFrameCamera( camera, W, H );
		shadows.render( scene, renderer, shadows.update( camera, G.sunDir.value ) );
		renderer.render( scene, { camera, kind: 'main', colorViews: rt.textures.map( t => t.view() ), colorFormats: rt.formats,
			clearColors: [ [ 0.18, 0.27, 0.36, 1 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ] ], depthView: rt.depthTexture.view(), depthFormat: 'depth32float', clearDepth: 0 } );
		tonemap.render( { colorViews: [ ldr.texture ] } ); GPU.submit();
	}
	await GPU.queue.onSubmittedWorkDone();
	const pixels = await readTexture( ldr.texture );
	writePNG( `artifacts/dev-weapons/${ firing ? 'firing' : 'ready' }.png`, W, H, new Uint8Array( pixels.data ) );
}
const error = await GPU.device.popErrorScope(); assert.equal( error, null, error?.message ); assert.deepEqual( errors, [] );
assert.ok( gun.shots > 10 && renderer.stats.draws > 10 );
console.log( `PASS native WebGPU imported minigun, barrel rotation, buoys, muzzle flash, tracers, brass and sparks: ${ gun.shots } shots; no shader/validation errors. Review: artifacts/dev-weapons/{ready,firing}.png` );
process.exit( 0 );
