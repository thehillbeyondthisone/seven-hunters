import { GPU } from '../engine/gpu/GPU.js';
import { FullscreenPass } from '../engine/render/FullscreenPass.js';
import { FrameUniforms, G, setFrameCamera } from '../engine/render/Frame.js';
import { Matrix4, Vector3 } from '../engine/math/index.js';
import { reversedProjection } from './Locomotion.js';

// Use the existing scene materials and water, but a single tone-map pass instead
// of desktop AO, temporal reconstruction, motion blur, bloom and lens effects.
export class XRRenderer {

	constructor( app, format ) {

		this.app = app;
		this.world = new Matrix4();
		this.scale = new Vector3();
		this.output = new FullscreenPass( {
			label: 'XR preview tone map', colorFormats: [ format ],
			bindings: { xrScene: { texture: () => app.sceneRenderer.sceneRT.texture } },
			code: `fn fragment( in: FSIn ) -> vec4f {
	let c = max( textureSampleLevel( xrScene, smpLinearClamp, in.uv, 0.0 ).rgb * frame.exposure, vec3f( 0.0 ) );
	let t = sat3( ( c * ( 2.51 * c + 0.03 ) ) / ( c * ( 2.43 * c + 0.59 ) + 0.14 ) );
	return vec4f( ${ format.endsWith( '-srgb' ) ? 't' : 'linearToSrgb( t )' }, 1.0 );
}`,
		} );

	}

	render( views, rig ) {

		const app = this.app, camera = app.camera;
		const position = camera.position.clone(), quaternion = camera.quaternion.clone();
		const projection = camera.projectionMatrix.clone();
		// Freeze the shared simulation and central-view shadows before writing eye
		// uniforms. queue.writeBuffer is ordered before an entire submitted command
		// buffer: reusing these buffers twice in one submission would mix the eyes.
		setFrameCamera( camera, app.sceneRenderer.width, app.sceneRenderer.height );
		app.shadows.render( app.scene, app.engine.meshRenderer, app.shadows.update( camera, G.sunDir.value ) );
		GPU.submit();
		try {

			const cleared = new Map();
			for ( const { view, subImage } of views ) {

				GPU.beginFrame();
				FrameUniforms.fields.frameIndex.value = GPU.frame;
				this.world.multiplyMatrices( rig, new Matrix4().fromArray( view.transform.matrix ) );
				this.world.decompose( camera.position, camera.quaternion, this.scale );
				reversedProjection( camera.projectionMatrix, view.projectionMatrix );
				camera.projectionMatrixInverse.copy( camera.projectionMatrix ).invert();
				camera.updateMatrixWorld();
				const v = subImage.viewport;
				app.sceneRenderer.setSize( v.width, v.height );
				setFrameCamera( camera, v.width, v.height );
				FrameUniforms.fields.outputResolution.value.set( v.width, v.height );
				app.sceneRenderer.render();
				// No compositor depth is supplied: the scene uses reversed depth, while
				// a projection layer expects ordinary depth. Scene depth stays private.
				const descriptor = subImage.getViewDescriptor();
				let layers = cleared.get( subImage.colorTexture );
				if ( ! layers ) cleared.set( subImage.colorTexture, layers = new Set() );
				const layer = descriptor.baseArrayLayer || 0;
				this.output.render( {
					colorViews: [ subImage.colorTexture.createView( descriptor ) ],
					viewport: [ v.x, v.y, v.width, v.height, 0, 1 ], clear: layers.has( layer ) ? null : [ 0, 0, 0, 1 ],
				} );
				layers.add( layer );
				GPU.submit();

			}

		} finally {

			camera.position.copy( position );
			camera.quaternion.copy( quaternion );
			camera.projectionMatrix.copy( projection );
			camera.projectionMatrixInverse.copy( projection ).invert();
			camera.updateMatrixWorld();

		}

	}

}
