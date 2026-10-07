// Touch play shares the first-night story and save. ?mobile enables desktop
// review; ?mobile=0 preserves mouse input on a hybrid device.
export function configureMobile( qs, env = globalThis ) {
	if ( qs.has( 'vr' ) || qs.get( 'setting' ) === 'tidewater' || qs.get( 'mobile' ) === '0' ) return false;
	const explicit = qs.has( 'mobile' );
	const touch = !! env.matchMedia?.( '(pointer: coarse)' ).matches;
	// Hybrid Windows devices can advertise coarse touch alongside a mouse.
	// Prefer the desktop path whenever a fine, hovering pointer is available.
	const mouse = !! env.matchMedia?.( '(any-pointer: fine)' ).matches && !! env.matchMedia?.( '(any-hover: hover)' ).matches;
	const nav = env.navigator || {};
	// iPad's desktop-site mode reports a Mac user agent. Keep phones/tablets
	// usable even if their browser advertises a fine pointer or no media query.
	const handheld = /Android|iPhone|iPad|iPod/i.test( nav.userAgent || '' )
		|| /Macintosh|MacIntel/i.test( `${ nav.userAgent || '' } ${ nav.platform || '' }` ) && nav.maxTouchPoints > 1;
	const touchOnly = nav.maxTouchPoints > 0 && ! mouse;
	const automatic = handheld || ( touch || touchOnly ) && ! mouse;
	if ( ! explicit && ( ! automatic || qs.has( 'bench' ) ) ) return false;
	for ( const flag of [ 'noSim', 'noCliffSurf' ] ) qs.set( flag, '' );
	if ( ! qs.has( 'G' ) ) qs.set( 'G', '16' );
	if ( ! qs.has( 'scale' ) ) qs.set( 'scale', '0.7' );
	return true;
}

export function stickMotion( dx, dy, radius = 46, deadZone = 0.12 ) {
	const distance = Math.hypot( dx, dy );
	const strength = Math.max( 0, ( Math.min( 1, distance / radius ) - deadZone ) / ( 1 - deadZone ) );
	return { x: strength ? dx / distance * strength : 0, y: strength ? -dy / distance * strength : 0,
		px: distance ? dx / distance * Math.min( distance, radius ) : 0,
		py: distance ? dy / distance * Math.min( distance, radius ) : 0 };
}

export function touchInstruction( text ) {
	return String( text || '' ).replace( /[BE] · Read your papers\./g, 'Read your papers in Tools.' )
		.replace( /[BE] reads your papers\./g, 'Read papers opens your packet.' )
		.replace( /hold E/gi, 'hold the action button' ).replace( /press E/gi, 'tap the action button' )
		.replace( /use E/gi, 'use the action button' );
}

export function mobileAction( app ) {
	const story = app.story;
	if ( story?.signal ) return { label: 'Leave signal', detail: 'Return to the watch', kind: 'leave' };
	if ( story?.aboard ) return { label: story.arrival.ready ? 'Step ashore' : 'Go to landing',
		detail: story.arrival.ready ? 'Leave the boat' : 'Skip the crossing', kind: 'landing' };
	const prompt = app.player?.prompt;
	if ( prompt ) return { label: prompt.text, detail: prompt.hold ? 'Keep pressed' : 'Tap to interact', kind: 'key', key: 'KeyE',
		hold: !! prompt.hold, progress: prompt.hideProgress ? 0 : prompt.progress ?? 0, target: story?.interact?.current?.id };
	return { label: 'Look at an object', kind: 'none', disabled: true };
}
