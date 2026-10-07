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
import { createGravityGrabberModel } from '../src/dev/GravityGrabberModel.js';
import * as E from '../src/engine/index.js';

installBrowser( { search: '?playground', width: 1200, height: 800, root: 'public' } );
await GPU.init( { headless: true } ); GPU.syncPipelines = true;
const errors = []; GPU.device.addEventListener( 'uncapturederror', e => errors.push( e.error.message ) ); GPU.device.pushErrorScope( 'validation' );
const W = 1200, H = 800, scene = new E.Scene(), camera = new E.PerspectiveCamera( 38, W / H, .01, 100 );
const model = createGravityGrabberModel(); scene.add( model.group );
camera.position.set( .7, .38, - .96 ); camera.lookAt( 0, -.035, -.12 );
const ground = new E.Mesh( new E.PlaneGeometry( 10, 10 ).rotateX( - Math.PI / 2 ), standard( { color: 0x263637, roughness: .85 } ) ); ground.position.y = - .28; scene.add( ground );
G.sunDir.value.set( -.3, .8, -.6 ).normalize(); G.sunColor.value.setRGB( 2.6, 2.4, 2 ); G.skyIrradiance.value.setRGB( .5, .7, .8 );
const rt = new RenderTarget( W, H, { colors: [ 'rgba16float', 'rgba16float', 'rgba8unorm' ], depth: 'depth32float' } ), ldr = new RenderTarget( W, H, { colors: [ 'rgba8unorm' ] } );
const renderer = new MeshRenderer(), shadows = new SunShadows( { size: 512, splits: [ 1, 3, 10 ] } );
const tonemap = new FullscreenPass( { label: 'gravity grabber model review', colorFormats: [ 'rgba8unorm' ], bindings: { hdr: { texture: () => rt.texture } },
	code: 'fn fragment( in: FSIn ) -> vec4f { let c = textureLoad( hdr, vec2i( in.pos.xy ), 0 ).rgb; let t = ( c * ( 2.51 * c + 0.03 ) ) / ( c * ( 2.43 * c + 0.59 ) + 0.14 ); return vec4f( linearToSrgb( sat3( t ) ), 1.0 ); }' } );
mkdirSync( 'artifacts/playground', { recursive: true } );
for ( const side of [ 'front', 'rear' ] ) {
	if ( side === 'rear' ) { camera.position.set( .68, .4, .75 ); camera.lookAt( 0, -.04, -.12 ); }
	GPU.beginFrame(); model.animate( 2, .5, .2 ); setFrameCamera( camera, W, H ); shadows.render( scene, renderer, shadows.update( camera, G.sunDir.value ) );
	renderer.render( scene, { camera, kind: 'main', colorViews: rt.textures.map( t => t.view() ), colorFormats: rt.formats,
		clearColors: [ [ .022, .037, .043, 1 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ] ], depthView: rt.depthTexture.view(), depthFormat: 'depth32float', clearDepth: 0 } );
	tonemap.render( { colorViews: [ ldr.texture ] } ); GPU.submit(); await GPU.queue.onSubmittedWorkDone();
	const pixels = await readTexture( ldr.texture ); writePNG( `artifacts/playground/grabber-${ side }.png`, W, H, new Uint8Array( pixels.data ) );
}
assert.equal( await GPU.device.popErrorScope(), null ); assert.deepEqual( errors, [] );
console.log( `PASS native WebGPU grabber: ${ model.triangles } triangles, ${ model.draws } merged parts, front/rear renders, no shader or validation errors.` ); process.exit( 0 );
