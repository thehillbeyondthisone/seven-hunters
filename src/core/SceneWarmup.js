// Only fresh boat arrivals have time to prepare the room in the background.
// Continue and preview routes may put the camera indoors immediately.
export function stageArrivalWarmup( qs, storage = () => globalThis.localStorage ) {

	if ( qs.get( 'warmup' ) === 'full' || qs.has( 'syncPipelines' ) || qs.has( 'serialPipelines' ) ) return false;
	if ( qs.has( 'handlamp' ) || qs.has( 'lamp' ) || qs.has( 'fly' ) || qs.has( 'debug' ) ) return false;
	if ( qs.has( 'vr' ) || qs.has( 'nostory' ) || qs.has( 'view' ) || qs.has( 'playground' ) || qs.has( 'devWeapons' ) || qs.has( 'simulation' ) ) return false;
	if ( qs.has( 'bench' ) && qs.get( 'warmup' ) !== 'staged' ) return false;
	for ( const key of qs.keys() ) {

		if ( key.endsWith( 'Preview' ) && key !== 'arrivalPreview' && key !== 'arrivalAtmospherePreview' && ! ( key === 'firstWatchPreview' && qs.get( key ) === 'crossing' ) ) return false;

	}
	const saveKey = qs.has( 'arrivalAtmospherePreview' ) ? 'sevenhunters.arrival-atmosphere-preview.v1' : qs.has( 'arrivalPreview' ) ? 'sevenhunters.arrival-preview.v1' : qs.has( 'firstWatchPreview' ) ? 'sevenhunters.first-watch-preview.v1' : 'sevenhunters.night1.v1';
	try {

		const saved = JSON.parse( storage()?.getItem( saveKey ) || 'null' );
		if ( saved?.v === 1 && saved.beat !== 'crossing' ) return false;

	} catch { /* No readable save: the normal entry starts on the boat. */ }
	return true;

}

export class SceneWarmup {

	constructor( handles, { yieldTask = () => new Promise( resolve => setTimeout( resolve, 16 ) ) } = {} ) {

		this.handles = [ ...new Set( handles ) ].filter( h => ! h.pipeline );
		this.yieldTask = yieldTask;
		this.ready = this.handles.length === 0;
		this.completed = 0;
		this.promise = null;

	}

	start() {

		if ( this.promise ) return this.promise;
		this.promise = ( async () => {

			// One compile at a time leaves the opening scene responsive, especially on phones.
			for ( const h of this.handles ) {

				if ( ! h.pipeline ) {

					await this.yieldTask();
					await h.start();

				}
				if ( h.failed || ! h.pipeline ) throw new Error( `Could not prepare ${ h.label }` );
				this.completed ++;

			}
			this.ready = true;

		} )();
		return this.promise;

	}

}
