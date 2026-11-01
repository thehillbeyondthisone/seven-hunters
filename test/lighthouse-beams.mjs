// Render the actual beam shader against finite camera/depth intervals.
import './headless.mjs';
import assert from 'node:assert/strict';
import { GPU } from '../src/engine/gpu/GPU.js';
import { RenderTarget } from '../src/engine/gpu/Texture.js';
import { UniformBlock } from '../src/engine/gpu/Shader.js';
import { FullscreenPass } from '../src/engine/render/FullscreenPass.js';
import { readTexture } from '../src/engine/gpu/Readback.js';
import { Vector3 } from '../src/engine/math/index.js';
import { Beams } from '../src/station/Beams.js';

await GPU.init( { headless: true } ); GPU.syncPipelines = true;
GPU.device.pushErrorScope( 'validation' );
const errors = [];
GPU.device.addEventListener( 'uncapturederror', event => errors.push( event.error.message ) );
const U = Beams.uniforms;
U.origin.value.set( 0, 101, 0 ); U.count.value = 1;
U.dirs.value[ 0 ].set( 1, 0, 0, 4000 );
const fixture = new UniformBlock( 'BeamFixture', {
 camera: [ 'vec3f', new Vector3() ], ray: [ 'vec3f', new Vector3() ], depth: [ 'f32', 0 ],
}, { label: 'beam fixture' } );
const output = new RenderTarget( 1, 1, { colors: [ 'rgba32float' ] } );
const pass = new FullscreenPass( {
 label: 'finite lighthouse beam', modules: [ Beams.module ],
 colorFormats: [ 'rgba32float' ], bindings: { fixture: { uniform: fixture } },
 code: /* wgsl */`
fn fragment( in: FSIn ) -> vec4f {
 return vec4f( beamsInScatter( fixture.camera, fixture.ray, fixture.depth, 5.0, 0.0 ), 1.0 );
}`,
} );
async function sample( camera, ray, depth ) {
 fixture.fields.camera.value.set( camera[ 0 ], 101 + camera[ 1 ], camera[ 2 ] );
 fixture.fields.ray.value.set( ...ray ).normalize(); fixture.fields.depth.value = depth;
 GPU.beginFrame(); pass.render( { colorViews: [ output.texture ] } ); GPU.submit();
 const pixel = new Float32Array( ( await readTexture( output.texture ) ).data );
 assert.ok( [...pixel].every( Number.isFinite ), 'beam output stays finite' );
 assert.ok( pixel[ 0 ] >= 0, 'scattering is nonnegative' );
 return pixel[ 0 ];
}

assert.equal( await sample( [ 5, 0, 0 ], [ 0, 0, 1 ], 0 ), 0, 'zero visible air contributes no light' );
assert.equal( await sample( [ 0, -1, 0 ], [ 1, .1, 0 ], 2.6 ), 0, 'geometry inside the lantern clips all exterior scattering' );
assert.equal( await sample( [ 1, 0, 0 ], [ 0, 0, 1 ], 100 ), 0, 'a transverse ray inside the housing cannot pick up a full exterior tube' );
const short = await sample( [ 5, 0, -2 ], [ 0, 0, 1 ], 1 );
const middle = await sample( [ 5, 0, -2 ], [ 0, 0, 1 ], 2 );
const full = await sample( [ 5, 0, -2 ], [ 0, 0, 1 ], 4 );
assert.ok( short < middle && middle < full, 'scene depth progressively exposes the finite beam, without a clamped-endpoint wedge' );
assert.ok( short < full * .15, 'an opaque surface before the beam suppresses its light' );
assert.ok( await sample( [ 0, 0, 0 ], [ 1, 0, 0 ], 20 ) > 0, 'the seaward beam remains visible' );
assert.ok( await sample( [ 10, 0, 0 ], [ -1, 0, 0 ], 20 ) > 0, 'looking along the beam remains stable' );
U.count.value = 0;
assert.equal( await sample( [ 5, 0, -2 ], [ 0, 0, 1 ], 4 ), 0, 'an extinguished burner contributes no beam' );
U.far.value[ 0 ].set( 0, 101, 100, 10 );
assert.ok( await sample( [ 0, 0, 0 ], [ 0, 0, 1 ], 100 ) > 0, 'distant signal lights retain their independent scattering' );
await GPU.queue.onSubmittedWorkDone();
const validation = await GPU.device.popErrorScope(); assert.equal( validation, null, validation?.message ); assert.deepEqual( errors, [] );
console.log( 'PASS finite lighthouse beams: opaque depth, housing, axial views, burner state and distant signals; no GPU errors.' );
process.exit( 0 );
