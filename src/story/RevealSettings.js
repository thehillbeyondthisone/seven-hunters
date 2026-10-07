export const REVEAL_SETTINGS_KEY = 'sevenhunters.island-reveal-edit.v1';
export const REVEAL_DEFAULTS = { speed: 0.75, previewStart: 0, musicOffset: 0, musicDelay: 0, gain: 0.6, fadeIn: 2.5, fadeOut: 4 };
const bounds = { speed: [ 0.25, 2 ], previewStart: [ 0, 84 ], musicOffset: [ 0, 45 ], musicDelay: [ 0, 30 ], gain: [ 0, 1 ], fadeIn: [ 0, 15 ], fadeOut: [ 0, 15 ] };

export function normalizeRevealSettings( values = {} ) {
	const settings = Object.fromEntries( Object.entries( REVEAL_DEFAULTS ).map( ( [ key, fallback ] ) => {
		const value = values?.[ key ];
		return [ key, typeof value === 'number' && Number.isFinite( value ) ? Math.max( bounds[ key ][ 0 ], Math.min( bounds[ key ][ 1 ], value ) ) : fallback ];
	} ) );
	settings.previewStart = Math.min( settings.previewStart, 21 / settings.speed );
	return settings;
}

export function loadRevealSettings() {
	try { return normalizeRevealSettings( JSON.parse( globalThis.localStorage?.getItem( REVEAL_SETTINGS_KEY ) || '{}' ) ); }
	catch { return { ...REVEAL_DEFAULTS }; }
}

export function saveRevealSettings( values ) {
	try { globalThis.localStorage?.setItem( REVEAL_SETTINGS_KEY, JSON.stringify( values ) ); } catch {}
}
