// Render a known shadow-map edge at sub-texel positions. A nearest-depth PCSS
// resolve produces only thirteen brightness steps; bilinear comparisons must
// retain a continuous penumbra, including while the temporal history is empty.
import './headless.mjs';
import assert from 'node:assert/strict';
import { GPU } from '../src/engine/gpu/GPU.js';
import { Texture, RenderTarget } from '../src/engine/gpu/Texture.js';
import { FullscreenPass } from '../src/engine/render/FullscreenPass.js';
import { readTexture } from '../src/engine/gpu/Readback.js';
import { shadowModule, ShadowUniforms, setShadowMap } from '../src/engine/render/wgsl/lighting.js';

await GPU.init( { headless: true } );
GPU.syncPipelines = true;
GPU.device.pushErrorScope( 'validation' );
const map = new Texture( { label: 'shadow edge fixture', width: 16, height: 16, depth: 1,
	dimension: '2d-array', format: 'depth32float', usage: [ 'sample', 'render' ] } );
setShadowMap( map );
const U = ShadowUniforms.fields;
U.mapSize.value = 16;
U.pcssCascades.value = 1;
U.bias.value = 0;
U.cascades.value[ 0 ].set( 10, 1, 0, 1 );
const depth = new FullscreenPass( { label: 'shadow edge depths', colorFormats: [], depthFormat: 'depth32float', depthWrite: true,
	code: '@fragment fn fs( in: FSIn ) -> @builtin( frag_depth ) f32 { return select( 0.35, 0.65, in.uv.x > 0.5 ); }' } );
const resolve = new FullscreenPass( { label: 'shadow edge resolve', modules: [ shadowModule ], colorFormats: [ 'rgba8unorm' ],
	code: `fn fragment( in: FSIn ) -> vec4f {
		let P = vec3f( ( in.uv.x - 0.5 ) * 0.4, 0.0, 0.5 );
		let vis = sunShadowCascade( P, vec3f( 0.0, 0.0, 1.0 ), 0, 0.0, 0.0 );
		return vec4f( vec3f( vis ), 1.0 );
	}` } );
const out = new RenderTarget( 256, 4, { colors: [ 'rgba8unorm' ] } );
depth.render( { colorViews: [], depthView: map.view( { dimension: '2d', baseArrayLayer: 0, arrayLayerCount: 1 } ) } );
resolve.render( { colorViews: [ out.texture ] } );
GPU.submit();
const shot = await readTexture( out.texture );
const pixels = new Uint8Array( shot.data );
const levels = new Set( Array.from( { length: 256 }, ( _, x ) => pixels[ x * 4 ] ) );
assert.ok( levels.size > 80, `a filtered penumbra has smooth sub-texel coverage (${ levels.size } levels)` );
assert.ok( pixels[ 0 ] < 10 && pixels[ 255 * 4 ] > 245, 'opaque shadow and full light stay distinct' );
assert.equal( await GPU.device.popErrorScope(), null, 'shadow filtering has no GPU validation errors' );
console.log( `PASS filtered shadow edge: ${ levels.size } coverage levels without temporal accumulation.` );
process.exit( 0 );
