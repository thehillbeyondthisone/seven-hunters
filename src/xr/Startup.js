// Detect immersive hardware before the normal game can open a watch save.
// Renderer capability is checked separately: missing WebGPU XR must not hide a headset.
export function isQuestBrowser( env = globalThis ) {

	return /OculusBrowser|Meta Quest|Quest\/|Quest [23SP]/i.test( env.navigator?.userAgent || '' );

}

export async function configureXRLaunch( qs, env = globalThis, { timeoutMs = 1500 } = {} ) {

	// Explicit experiences and flat-browser choices take priority over automatic VR.
	if ( qs.has( 'vr' ) || qs.has( 'desktop' ) || qs.has( 'mobile' ) || qs.get( 'setting' ) === 'tidewater' ) return false;
	if ( Array.from( qs.keys() ).some( key => /preview/i.test( key ) ||
		[ 'bench', 'view', 'nostory', 'simulation', 'seaDread', 'playground', 'disco', 'devWeapons' ].includes( key ) ) ) return false;

	let immersive = isQuestBrowser( env );
	if ( ! immersive && env.isSecureContext && typeof env.navigator?.xr?.isSessionSupported === 'function' ) {

		let timer;
		try {

			immersive = await Promise.race( [
				Promise.resolve().then( () => env.navigator.xr.isSessionSupported( 'immersive-vr' ) ),
				new Promise( resolve => { timer = setTimeout( () => resolve( false ), timeoutMs ); } ),
			] );

		} catch { immersive = false; }
		finally { clearTimeout( timer ); }

	}
	if ( ! immersive ) return false;
	qs.set( 'vr', '' );
	return true;

}
