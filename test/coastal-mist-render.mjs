// Native WGSL fixture: finite-bank integration against independent numerical
// density quadrature, depth clipping, high bearings, drift and held-frame stability.
import './headless.mjs';
import assert from 'node:assert/strict';
import { GPU } from '../src/engine/gpu/GPU.js';
import { RenderTarget } from '../src/engine/gpu/Texture.js';
import { UniformBlock } from '../src/engine/gpu/Shader.js';
import { FullscreenPass } from '../src/engine/render/FullscreenPass.js';
import { readTexture } from '../src/engine/gpu/Readback.js';
import { G, FrameUniforms } from '../src/engine/render/Frame.js';
import { CoastalMist, COASTAL_MIST_BANKS } from '../src/post/CoastalMist.js';

await GPU.init( { headless: true } ); GPU.syncPipelines = true;
GPU.device.pushErrorScope( 'validation' );
const errors = []; GPU.device.addEventListener( 'uncapturederror', e => errors.push( e.error.message ) );
const W = 241, H = 135, mist = new CoastalMist();
const depth = new UniformBlock( 'MistFixture', { dist: [ 'f32', 400 ] } );
const target = new RenderTarget( W, H, { colors: [ 'r32float' ] } );
const pass = new FullscreenPass( { label: 'coastal-mist-fixture', modules: [ mist.module ], bindings: { fixture: { uniform: depth } }, colorFormats: [ 'r32float' ], code: /* wgsl */`
fn fragment( in: FSIn ) -> vec4f {
	let dir = normalize( vec3f( 1.0, ( .5 - in.uv.y ) * .3, ( in.uv.x - .5 ) * 1.3 ) );
	return vec4f( coastalMistOpticalDepth( frame.cameraPos, dir, fixture.dist ), 0.0, 0.0, 1.0 );
}` } );
FrameUniforms.fields.cameraPos.value.set( 65, 6, 82 ); G.seaLevel.value = 0; G.windDir.value.set( 1, 0 ); G.windSpeed.value = 14; G.time.value = 0;
async function draw() {
	GPU.beginFrame(); pass.render( { colorViews: [ target.texture ], clear: [ 0, 0, 0, 0 ] } ); GPU.submit();
	return new Float32Array( ( await readTexture( target.texture ) ).data );
}
const full = await draw();
assert.ok( full.every( Number.isFinite ) );
assert.ok( Math.max( ...full ) > .04 && Math.max( ...full ) <= .281, 'bank visible but opacity restrained' );
assert.deepEqual( await draw(), full, 'held simulation time has no jitter or temporal residue' );
// Independent midpoint quadrature of the density field along the centre ray.
let expected = 0; const ds = 400 / 16000;
for ( let i = 0; i < 16000; i ++ ) {
	const x = 65 + ( i + .5 ) * ds;
	for ( const b of COASTAL_MIST_BANKS ) {
		const c = [ b.center[ 0 ] + Math.sin( b.phase ) * 12, b.center[ 1 ], b.center[ 2 ] + Math.sin( b.phase * 1.7 ) * 5 ];
		const r2 = ( ( x - c[ 0 ] ) / b.radii[ 0 ] ) ** 2 + ( ( 6 - c[ 1 ] ) / b.radii[ 1 ] ) ** 2 + ( ( 82 - c[ 2 ] ) / b.radii[ 2 ] ) ** 2;
		expected += Math.max( 0, 1 - r2 ) ** 2 * ( r2 < 1 ? 1 : 0 ) * b.sigma * ds;
	}
}
assert.ok( Math.abs( full[ ( H >> 1 ) * W + ( W >> 1 ) ] - expected ) < .00002, 'analytic WGSL matches independent numerical integration' );
G.time.value = 1 / 60; const next = await draw();
assert.ok( next.some( ( v, i ) => v !== full[ i ] ), 'wind drift moves continuously with simulation time' );
assert.ok( Math.max( ...next.map( ( v, i ) => Math.abs( v - full[ i ] ) ) ) < .0002, 'one-frame bank movement remains smooth' );
G.time.value = 60; const later = await draw();
assert.ok( Math.max( ...later.map( ( v, i ) => Math.abs( v - full[ i ] ) ) ) > .005, 'bank changes slowly over a minute' );
mist.strength = 0; assert.ok( ( await draw() ).every( v => v === 0 ), 'off bypasses density' );
mist.strength = 1; mist.enabled = false; assert.ok( ( await draw() ).every( v => v === 0 ) );
mist.enabled = true; G.time.value = 0; assert.deepEqual( await draw(), full, 're-enable needs no history reset' );
depth.fields.dist.value = .2; assert.ok( ( await draw() ).every( v => v === 0 ), 'foreground depth blocks the bank behind it' );
depth.fields.dist.value = 400; FrameUniforms.fields.cameraPos.value.y = 100;
assert.ok( ( await draw() ).every( v => v === 0 ), 'station and distant light bearings above the coastal layer stay unchanged' );
FrameUniforms.fields.cameraPos.value.set( 186, -1, 82 ); depth.fields.dist.value = 1;
assert.ok( ( await draw() ).every( v => v === 0 ), 'below-water rays carry no mist' );
const validation = await GPU.device.popErrorScope(); assert.equal( validation, null ); assert.deepEqual( errors, [] );
console.log( 'PASS native coastal mist: exact density integral, finite clipping, high bearings, underwater bounds, zero validation errors, smooth drift and deterministic re-enable.' );
GPU.device.destroy();


