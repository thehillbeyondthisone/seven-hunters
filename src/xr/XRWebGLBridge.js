import { GPU } from '../engine/gpu/GPU.js';

// Standard WebXR sessions supply WebGL [-1, 1] depth. The scene renderer uses
// reversed WebGPU [0, 1] depth; x/y and the asymmetric headset frustum stay intact.
export function webglReversedProjection( out, projection ) {

	out.fromArray( projection );
	for ( const i of [ 2, 6, 10, 14 ] ) out.elements[ i ] = ( projection[ i + 1 ] - projection[ i ] ) * 0.5;
	return out;

}

// Present the existing WebGPU scene through the standard WebGL XR compositor.
// Prefer a direct canvas upload, with a Canvas2D snapshot when the browser rejects
// WebGPU canvases as WebGL sources. Both paths need performance testing on Quest.
export class XRWebGLBridge {

	async init( session, scale ) {

		this.disposed = false;
		this.canvas = document.createElement( 'canvas' );
		const options = { alpha: false, antialias: false, depth: false, stencil: false };
		const gl = this.gl = this.canvas.getContext( 'webgl2', options ) || this.canvas.getContext( 'webgl', options );
		if ( ! gl ) throw new Error( 'A WebGL context is required for VR compatibility mode.' );
		if ( typeof gl.makeXRCompatible !== 'function' ) throw new Error( 'This browser cannot connect WebGL to its VR compositor.' );
		await gl.makeXRCompatible();
		if ( this.disposed ) throw new Error( 'VR entry was cancelled.' );
		this.layer = new XRWebGLLayer( session, gl, { antialias: false, depth: false, stencil: false, alpha: false, framebufferScaleFactor: scale } );
		const vertex = this._shader( gl.VERTEX_SHADER, 'attribute vec2 position; varying vec2 uv; void main() { uv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }' );
		let fragment;
		try {

			fragment = this._shader( gl.FRAGMENT_SHADER, 'precision mediump float; varying vec2 uv; uniform sampler2D scene; void main() { gl_FragColor = texture2D(scene, uv); }' );
			this.program = gl.createProgram();
			gl.attachShader( this.program, vertex );
			gl.attachShader( this.program, fragment );
			gl.linkProgram( this.program );
			if ( ! gl.getProgramParameter( this.program, gl.LINK_STATUS ) ) throw new Error( 'VR compatibility shader: ' + gl.getProgramInfoLog( this.program ) );

		} finally {

			gl.deleteShader( vertex );
			if ( fragment ) gl.deleteShader( fragment );

		}
		this.buffer = gl.createBuffer();
		gl.bindBuffer( gl.ARRAY_BUFFER, this.buffer );
		gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( [ - 1, - 1, 3, - 1, - 1, 3 ] ), gl.STATIC_DRAW );
		gl.useProgram( this.program );
		const position = this.positionAttribute = gl.getAttribLocation( this.program, 'position' );
		gl.enableVertexAttribArray( position );
		gl.vertexAttribPointer( position, 2, gl.FLOAT, false, 0, 0 );
		this.texture = gl.createTexture();
		gl.activeTexture( gl.TEXTURE0 );
		gl.bindTexture( gl.TEXTURE_2D, this.texture );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE );
		gl.pixelStorei( gl.UNPACK_FLIP_Y_WEBGL, true );
		gl.pixelStorei( gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE );
		gl.uniform1i( gl.getUniformLocation( this.program, 'scene' ), 0 );
		this.staging = document.createElement( 'canvas' );
		this.context = this.staging.getContext( 'webgpu' );
		if ( ! this.context ) throw new Error( 'Could not create the VR compatibility WebGPU canvas.' );
		this.format = navigator.gpu.getPreferredCanvasFormat();
		this.context.configure( { device: GPU.device, format: this.format, alphaMode: 'opaque', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC } );
		this.transferMode = 'direct';
		this._checkError( 'graphics setup' );
		return this;

	}

	_shader( type, source ) {

		const gl = this.gl, shader = gl.createShader( type );
		gl.shaderSource( shader, source );
		gl.compileShader( shader );
		if ( ! gl.getShaderParameter( shader, gl.COMPILE_STATUS ) ) {

			const message = gl.getShaderInfoLog( shader );
			gl.deleteShader( shader );
			throw new Error( 'VR compatibility shader: ' + message );

		}
		return shader;

	}

	beginFrame() {

		const gl = this.gl;
		if ( gl.isContextLost() ) throw new Error( 'The VR compatibility graphics context was lost.' );
		// WebXR clears the opaque framebuffer before each XR callback. Both eye
		// viewports are fully overwritten below, so no explicit clear is needed.
		// Leave it detached while the WebGPU scene and canvas uploads are prepared.
		gl.bindFramebuffer( gl.FRAMEBUFFER, null );
		this._checkError( 'frame start' );

	}

	target( width, height ) {

		if ( this.staging.width !== width ) this.staging.width = width;
		if ( this.staging.height !== height ) this.staging.height = height;
		return this.context.getCurrentTexture().createView();

	}

	present( viewport ) {

		const gl = this.gl;
		// Upload into our own texture with no opaque XR framebuffer bound. Restore
		// every binding used by the draw instead of relying on initialization state.
		gl.bindFramebuffer( gl.FRAMEBUFFER, null );
		gl.activeTexture( gl.TEXTURE0 );
		gl.bindTexture( gl.TEXTURE_2D, this.texture );
		gl.pixelStorei( gl.UNPACK_FLIP_Y_WEBGL, true );
		gl.pixelStorei( gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE );
		this._checkError( 'texture binding' );
		if ( this.transferMode === 'direct' ) {

			let failure;
			try { gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.staging ); }
			catch ( error ) { failure = error; }
			const error = gl.getError();
			if ( failure || error !== gl.NO_ERROR ) {

				if ( gl.isContextLost() ) throw new Error( 'The VR compatibility graphics context was lost.' );
				this.directTransferFailure = failure?.message || 'WebGL ' + error;
				this.transferMode = 'canvas2d';

			}

		}
		if ( this.transferMode === 'canvas2d' ) {

			if ( ! this.copyCanvas ) {

				this.copyCanvas = document.createElement( 'canvas' );
				this.copyContext = this.copyCanvas.getContext( '2d', { alpha: false } );
				if ( ! this.copyContext ) throw new Error( 'VR canvas transfer recovery requires a Canvas2D context.' );

			}
			if ( this.copyCanvas.width !== this.staging.width ) this.copyCanvas.width = this.staging.width;
			if ( this.copyCanvas.height !== this.staging.height ) this.copyCanvas.height = this.staging.height;
			try { this.copyContext.drawImage( this.staging, 0, 0 ); }
			catch ( error ) { throw new Error( 'VR compatibility Canvas2D snapshot failed: ' + error.message ); }
			try { gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.copyCanvas ); }
			catch ( error ) { throw new Error( 'VR compatibility Canvas2D texture upload failed: ' + error.message ); }
			this._checkError( 'Canvas2D texture upload (direct source rejected: ' + this.directTransferFailure + ')' );

		}
		gl.bindFramebuffer( gl.FRAMEBUFFER, this.layer.framebuffer );
		gl.viewport( viewport.x, viewport.y, viewport.width, viewport.height );
		gl.useProgram( this.program );
		gl.bindBuffer( gl.ARRAY_BUFFER, this.buffer );
		gl.enableVertexAttribArray( this.positionAttribute );
		gl.vertexAttribPointer( this.positionAttribute, 2, gl.FLOAT, false, 0, 0 );
		try {

			gl.drawArrays( gl.TRIANGLES, 0, 3 );
			this._checkError( 'compositor draw' );

		} finally {

			// Opaque framebuffers become incomplete when the XR callback returns.
			gl.bindFramebuffer( gl.FRAMEBUFFER, null );

		}

	}

	_checkError( stage ) {

		const gl = this.gl;
		const error = gl.getError();
		if ( error !== gl.NO_ERROR ) throw new Error( `VR compatibility ${ stage } failed (WebGL ${ error }).` );

	}

	dispose() {

		if ( this.disposed ) return;
		this.disposed = true;
		this.context?.unconfigure();
		const gl = this.gl;
		if ( gl ) {

			if ( this.texture ) gl.deleteTexture( this.texture );
			if ( this.buffer ) gl.deleteBuffer( this.buffer );
			if ( this.program ) gl.deleteProgram( this.program );
			gl.getExtension( 'WEBGL_lose_context' )?.loseContext();

		}
		this.layer = null;
		this.texture = this.buffer = this.program = null;
		this.context = this.gl = null;
		this.canvas = this.staging = null;
		this.copyContext = this.copyCanvas = null;

	}

}
