import { GPU } from '../engine/gpu/GPU.js';
import { Texture } from '../engine/gpu/Texture.js';
import { FullscreenPass } from '../engine/render/FullscreenPass.js';
import { FrameUniforms, G, setFrameCamera } from '../engine/render/Frame.js';
import { DEPTH_FORMAT } from '../engine/render/SceneRenderer.js';
import { Matrix4, Vector3 } from '../engine/math/index.js';
import { reversedProjection } from './Locomotion.js';
import { webglReversedProjection } from './XRWebGLBridge.js';
import { XRLegacyRenderer } from './XRLegacyRenderer.js';
import { XRGPUTimer } from './GPUTimer.js';

// One forward color/depth pass per eye, resolved into the XR texture (or the
// compatibility canvas). No HDR copies, motion buffers or postprocessing.
export class XRRenderer {
	constructor( app, format, { sampleCount = app.xr?.sampleCount || 4 } = {} ) {
		if ( app.qs?.has( 'xrLegacy' ) ) return new XRLegacyRenderer( app, format );
		this.app = app;
		this.format = format;
		this.sampleCount = sampleCount === 1 ? 1 : 4;
		this.world = new Matrix4(); this.eye = new Matrix4(); this.scale = new Vector3();
		this.depth = new Texture( { label: 'XR private depth', format: DEPTH_FORMAT, sampleCount: this.sampleCount, usage: [ 'render' ] } );
		this.color = this.sampleCount === 4 ? new Texture( { label: 'XR multisample color', format, sampleCount: 4, usage: [ 'render' ] } ) : null;
		this.timer = new XRGPUTimer();
		this.metrics = {};
		if ( app.sky ) this.sky = new FullscreenPass( {
			label: 'XR forward sky', modules: [ app.sky.module ], colorFormats: [ format ],
			depthFormat: DEPTH_FORMAT, depthCompare: 'equal', depth: 0, sampleCount: this.sampleCount,
			code: `fn fragment( in: FSIn ) -> vec4f {
	let uv = ( in.pos.xy - frame.viewportOrigin ) * frame.invResolution;
	let color = xrToneMap( skyViewRadiance( viewRay( uv ) ) );
	return vec4f( ${ format.endsWith( '-srgb' ) ? 'color' : 'linearToSrgb( color )' }, 1.0 );
}`,
		} );
	}

	_drawEye( target, width, height, viewport, clear, timestampWrites ) {
		this.depth.resize( width, height ); this.color?.resize( width, height );
		this.app.engine.meshRenderer.render( this.app.scene, {
			label: 'XR forward eye', kind: 'color', camera: this.app.camera, layerMask: 7,
			colorViews: [ this.color ? this.color.view() : target ], colorFormats: [ this.format ],
			resolveTargets: this.color ? [ target ] : undefined,
			depthView: this.depth.view(), depthFormat: DEPTH_FORMAT, clearDepth: 0,
			clearColors: [ clear ? [ 0, 0, 0, 1 ] : null ], viewport,
			sampleCount: this.sampleCount, defines: { XR_FORWARD: 1, XR_SRGB: this.format.endsWith( '-srgb' ) ? 1 : 0 },
			betweenLists: this.sky ? rp => this.sky.draw( rp ) : undefined, timestampWrites,
		} );
	}

	async prewarm() {
		const mr = this.app.engine.meshRenderer, was = mr.precompiling;
		const target = new Texture( { label: 'XR warmup', width: 8, height: 8, format: this.format, usage: [ 'render' ] } );
		try {
			GPU.beginFrame(); setFrameCamera( this.app.camera, 8, 8 ); mr.precompiling = true;
			this._drawEye( target.view(), 8, 8, [ 0, 0, 8, 8, 0, 1 ], true ); GPU.submit();
		} finally { mr.precompiling = was; }
		await GPU.pipelinesReady(); await GPU.queue.onSubmittedWorkDone(); target.destroy();
	}

	render( views, rig, bridge = null ) {
		const app = this.app, camera = app.camera, mr = app.engine.meshRenderer;
		const position = camera.position.clone(), quaternion = camera.quaternion.clone();
		const projection = camera.projectionMatrix.clone(), t0 = performance.now();
		let transferCpuMs = 0, eyeCpuMs = 0, draws = 0, triangles = 0;
		this.timer.beginFrame();
		setFrameCamera( camera, app.sceneRenderer.width, app.sceneRenderer.height );
		app.shadows.render( app.scene, mr, app.shadows.update( camera, G.sunDir.value ) );
		// Separate submissions preserve camera/material buffer ordering.
		GPU.submit();
		const sharedCpuMs = performance.now() - t0;
		try {
			bridge?.beginFrame();
			const cleared = new Map();
			for ( const [ i, { view, subImage } ] of views.entries() ) {
				const begin = performance.now();
				GPU.beginFrame(); FrameUniforms.fields.frameIndex.value = GPU.frame;
				this.world.multiplyMatrices( rig, this.eye.fromArray( view.transform.matrix ) );
				this.world.decompose( camera.position, camera.quaternion, this.scale );
				( bridge ? webglReversedProjection : reversedProjection )( camera.projectionMatrix, view.projectionMatrix );
				camera.projectionMatrixInverse.copy( camera.projectionMatrix ).invert(); camera.updateMatrixWorld();
				const v = subImage.viewport, x = bridge ? 0 : v.x, y = bridge ? 0 : v.y;
				setFrameCamera( camera, v.width, v.height, { viewportX: x, viewportY: y } );
				FrameUniforms.fields.outputResolution.value.set( v.width, v.height );
				const descriptor = bridge ? null : subImage.getViewDescriptor();
				let layers = cleared.get( subImage.colorTexture );
				if ( ! layers ) cleared.set( subImage.colorTexture, layers = new Set() );
				const layer = descriptor?.baseArrayLayer || 0;
				const target = bridge ? bridge.target( v.width, v.height ) : subImage.colorTexture.createView( descriptor );
				this._drawEye( target, bridge ? v.width : subImage.colorTexture.width, bridge ? v.height : subImage.colorTexture.height,
					[ x, y, v.width, v.height, 0, 1 ], !! bridge || ! layers.has( layer ), this.timer.writes( i ) );
				layers.add( layer ); draws += mr.stats.draws; triangles += mr.stats.triangles;
				if ( i === views.length - 1 ) this.timer.finish( views.length );
				GPU.submit(); eyeCpuMs += performance.now() - begin;
				if ( bridge ) {
					const start = performance.now(); bridge.present( v ); transferCpuMs += performance.now() - start;
				}
			}
			this.metrics = { sharedCpuMs, eyeCpuMs, transferCpuMs, draws, triangles,
				sampleCount: this.sampleCount, renderPath: 'forward', transferMode: bridge?.transferMode || ( bridge ? 'unknown' : 'none' ),
				grassTrianglesPerEye: app.sward?.triangles || 0, gpu: this.timer.latest || null };
		} finally {
			camera.position.copy( position ); camera.quaternion.copy( quaternion ); camera.projectionMatrix.copy( projection );
			camera.projectionMatrixInverse.copy( projection ).invert(); camera.updateMatrixWorld();
			FrameUniforms.fields.viewportOrigin.value.set( 0, 0 );
		}
	}
	dispose() { this.depth.destroy(); this.color?.destroy(); this.timer.dispose(); }
}
