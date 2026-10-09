// The preview is deliberately separate from the saved first night.
export function configurePreview( qs ) {

	if ( ! qs.has( 'vr' ) ) return false;
	qs.set( 'setting', 'flannan' );
	for ( const flag of [ 'nostory', 'noClouds', 'noHaze', 'noSim', 'lite', 'lamp', 'handlamp' ] ) qs.set( flag, '' );
	if ( ! qs.has( 'G' ) ) qs.set( 'G', '16' );
	return true;

}

export function projectionScale( value ) {

	const n = Number( value );
	return Number.isFinite( n ) && n >= 0.4 && n <= 1 ? n : 0.65;

}

export function supportMessage( env = globalThis ) {

	if ( ! env.isSecureContext ) return 'Open this preview over HTTPS on your Quest, or localhost on desktop.';
	if ( ! env.navigator?.gpu ) return 'This browser does not expose WebGPU.';
	if ( ! env.navigator?.xr ) return 'No WebXR runtime found. You can still explore the preview on desktop.';
	if ( typeof env.XRGPUBinding !== 'function' && typeof env.XRWebGLLayer !== 'function' ) return 'WebXR is exposed, but this browser provides neither a WebGPU nor a WebGL VR presentation layer. Open this page directly in Meta Quest Browser and check the site’s VR permission.';
	return null;

}
