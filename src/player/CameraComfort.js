const KEY = 'sevenhunters.cameraBob';

export function loadCameraBob() {
	try {
		const saved = globalThis.localStorage?.getItem( KEY );
		if ( saved === 'true' || saved === 'false' ) return saved === 'true';
	} catch { /* Private browsing can deny storage. */ }
	return ! globalThis.matchMedia?.( '(prefers-reduced-motion: reduce)' )?.matches;
}

export function saveCameraBob( enabled ) {
	try { globalThis.localStorage?.setItem( KEY, String( enabled ) ); } catch { /* The current session still works. */ }
}
