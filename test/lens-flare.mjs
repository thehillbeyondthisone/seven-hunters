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
const blockerShader = GPU.device.createShaderModule( { code: `
@vertex fn main(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
	let p = array<vec2f,3>(vec2f(-1.0,-1.0),vec2f(3.0,-1.0),vec2f(-1.0,3.0));
	return vec4f(p[i],0.002,1.0);
}` } );
const blocker = GPU.device.createRenderPipeline( { layout: 'auto',
	vertex: { module: blockerShader, entryPoint: 'main' },
	depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'always' },
} );
await GPU.pipelinesReady();
async function visibility( { depth = 0, cloud = 1, glare = .7, aboveWater = true, wallX = null } = {} ) {
	cloudParams.fields.transmittance.value = cloud;
	flare.cloudGlare.value = glare;
	for ( let i = 0; i < 16; i ++ ) {
		GPU.beginFrame();
		const p = GPU.getEncoder().beginRenderPass( { colorAttachments: [], depthStencilAttachment: {
			view: rt.depthTexture.view(), depthLoadOp: 'clear', depthStoreOp: 'store', depthClearValue: depth,
		} } );
		if ( wallX !== null ) { p.setPipeline( blocker ); p.setScissorRect( wallX, 0, 4, 32 ); p.draw( 3 ); }
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

// A low sun should leave useful flare on both passes through the frame, including
// a narrow phone viewport. Geometry at the sun-facing border remains an occluder.
const originalSun = sunDir.value.clone();
const direction = degrees => {
	const angle = degrees * Math.PI / 180;
	sunDir.value.set( Math.sin( angle ), .1, -Math.cos( angle ) ).normalize();
};
flare.anamorphic.value = 2;
for ( const aspect of [ 16 / 9, 480 / 860 ] ) {
	camera.aspect = aspect; camera.updateProjectionMatrix();
	const edge = Math.atan( Math.tan( camera.fov * Math.PI / 360 ) * aspect ) * 180 / Math.PI;
	for ( const sign of [ -1, 1 ] ) {
		direction( sign * ( edge - .1 ) );
		assert( await visibility() > .99, 'no early fade just inside the sensor edge' );
		direction( sign * ( edge + 10 ) );
		const near = await visibility();
		assert( near > .7, 'strong flare ten degrees beyond landscape and portrait edges' );
		assert( await visibility( { wallX: sign < 0 ? 0 : 28 } ) < 1e-6, 'border geometry blocks offscreen glare' );
		assert( await visibility( { wallX: sign < 0 ? 28 : 0 } ) > .7, 'unrelated opposite-edge geometry does not hide glare' );
		assert( await visibility( { cloud: 0 } ) < 1e-6, 'opaque clouds still block offscreen glare' );
		assert( await visibility( { aboveWater: false } ) < 1e-6, 'offscreen glare stays suppressed underwater' );
		direction( sign * ( edge + 24 ) );
		const far = await visibility();
		assert( far > .1 && far < near, 'offscreen response fades gradually with angle' );
		direction( sign * ( edge + 40 ) );
		assert( await visibility() < 1e-6, 'far-offscreen light fully fades' );
	}
}
camera.aspect = 1; camera.updateProjectionMatrix();
flare.anamorphic.value = 0;
direction( 51 );
assert( await visibility() < 1e-6, 'ordinary glass has a smaller fringe than the cinematic lens' );
for ( const angle of [ 89.9, 90, 90.1, 120, 180 ] ) {
	direction( angle );
	assert( await visibility() < 1e-6, 'grazing and rear light cannot flare or produce invalid admission' );
}
sunDir.value.copy( originalSun );
sunDir.value.y = -.12; sunDir.value.normalize();
assert( await visibility() < 1e-6, 'no solar flare at night' );
assert.equal( errors, 0, 'no GPU validation errors' );
console.log( `PASS flare GPU visibility: clear sky, diffused evening (${ diffused.toFixed(4) }), opaque cloud, geometry, underwater, frame exit and night.` );
console.log( 'PASS cinematic angular fringe: both edges, landscape/portrait, gradual fade, edge occlusion, cloud/water blocking and grazing/rear rejection.' );
process.exit( 0 );
