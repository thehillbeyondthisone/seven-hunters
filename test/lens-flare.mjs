// Actual visibility compute: low-sun cloud response, terrain/water occlusion,
// frame exit, and underwater/night suppression. No image-only assertions.
import './headless.mjs';
import assert from 'node:assert/strict';
import { GPU } from '../src/engine/gpu/GPU.js';
import { ShaderModule, UniformBlock } from '../src/engine/gpu/Shader.js';
import { RenderTarget } from '../src/engine/gpu/Texture.js';
import { readBuffer } from '../src/engine/gpu/Readback.js';
import '../src/engine/render/Frame.js';
import { Vector3, PerspectiveCamera } from '../src/engine/index.js';
import { LensFlare } from '../src/post/LensFlare.js';

await GPU.init( { headless: true } );
let errors = 0;
GPU.device.addEventListener( 'uncapturederror', () => { errors ++; } );
const rt = new RenderTarget( 32, 32, { depth: 'depth32float' } );
const cloudParams = new UniformBlock( 'FlareTestClouds', { transmittance: [ 'f32', 1 ] } );
const clouds = { module: new ShaderModule( {
	name: 'clouds', uniforms: cloudParams, uniformName: 'tc',
	code: `fn cloudsSampleView(d: vec3f) -> vec4f { return vec4f(1.0, 0.8, 0.5, tc.transmittance); }
	fn cloudsSunTransmittance(t: f32) -> f32 { return t * smoothstep(0.004, 0.04, t); }`,
} ) };
const sunDir = { value: new Vector3( .3, .1, -1 ).normalize() };
const camera = new PerspectiveCamera( 62, 1, .06, 60000 );
const flare = new LensFlare( { depthTexture: rt.depthTexture, clouds, sunDir } );
flare.setDepthHeight( 32 );
await GPU.pipelinesReady();
async function visibility( { depth = 0, cloud = 1, glare = .7, aboveWater = true } = {} ) {
	cloudParams.fields.transmittance.value = cloud;
	flare.cloudGlare.value = glare;
	for ( let i = 0; i < 16; i ++ ) {
		GPU.beginFrame();
		const p = GPU.getEncoder().beginRenderPass( { colorAttachments: [], depthStencilAttachment: {
			view: rt.depthTexture.view(), depthLoadOp: 'clear', depthStoreOp: 'store', depthClearValue: depth,
		} } );
		p.end();
		flare.update( camera, .1, { aboveWater } );
		flare.kernel.dispatch( 1 ); GPU.submit();
		await GPU.queue.onSubmittedWorkDone();
	}
	return new Float32Array( await readBuffer( flare.visibility, 4 ) )[0];
}
assert( await visibility() > .99, 'clear sky admits the flare' );
assert( await visibility( { cloud: .0005, glare: 0 } ) < 1e-6, 'ordinary disc cutoff retains its original behavior' );
const diffused = await visibility( { cloud: .0005 } );
assert( diffused > .03 && diffused < .08, 'cloudy evening gets a faint bounded flare' );
assert( await visibility( { cloud: 0 } ) < 1e-6, 'fully opaque cloud extinguishes it' );
assert( await visibility( { depth: .002 } ) < 1e-6, 'scene geometry hides the sun' );
assert( await visibility( { aboveWater: false } ) < 1e-6, 'no flare underwater' );
camera.rotation.y = Math.PI;
assert( await visibility() < 1e-6, 'turning away extinguishes it' );
camera.rotation.y = 0;
sunDir.value.y = -.12; sunDir.value.normalize();
assert( await visibility() < 1e-6, 'no solar flare at night' );
assert.equal( errors, 0, 'no GPU validation errors' );
console.log( `PASS flare GPU visibility: clear sky, diffused evening (${ diffused.toFixed(4) }), opaque cloud, geometry, underwater, frame exit and night.` );
process.exit( 0 );
