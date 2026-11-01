import { Vector3 } from '../engine/math/index.js';

// Things you look at and use with E (docs/PLAN.md §6 Interaction): the nearest one in reach that the view
// points at gets the prompt. A use is a press, or a hold for `hold` seconds (lighting the lamp, winding
// the machine: the prompt fills while E is held; onHold( dt ) runs every frame of it).
//
//   interact.add( { id, at: Vector3 | () => Vector3, reach: 1.8, size: 0.35, text: string | () => string,
//     when: () => bool, hold: 0, use: () => {}, onHold: ( dt ) => {}, onRelease, progress: () => 0..1,
//     rate: number | () => number, detail: string | () => string, key: 'E' } )
//
// `size` is the target's radius: it can be looked at from anywhere within that of its centre.
// `aimDegrees` optionally sets a fixed half-angle for distant observations;
// `distanceWeight` controls how strongly nearby objects take precedence.
// `halfSize` optionally replaces spherical aim with a world-aligned box.
const _eye = new Vector3(), _fwd = new Vector3(), _to = new Vector3();

// Optional world-aligned half extents let long, low props use their visible
// surface as the target instead of a small sphere hidden inside their centre.
function boxHit( center, half, reach ) {

	let near = 0, far = reach;
	for ( const axis of [ 'x', 'y', 'z' ] ) {
		const lo = center[ axis ] - half[ axis ], hi = center[ axis ] + half[ axis ];
		if ( Math.abs( _fwd[ axis ] ) < 1e-8 ) {
			if ( _eye[ axis ] < lo || _eye[ axis ] > hi ) return false;
			continue;
		}
		const a = ( lo - _eye[ axis ] ) / _fwd[ axis ], b = ( hi - _eye[ axis ] ) / _fwd[ axis ];
		near = Math.max( near, Math.min( a, b ) ); far = Math.min( far, Math.max( a, b ) );
		if ( far < near ) return false;
	}
	return far > 0;

}

export class Interact {

	constructor( { camera, input, player } ) {

		this.camera = camera;
		this.input = input;
		this.player = player;
		this.items = [];
		this.enabled = true;
		this.current = null;
		this.held = 0;

	}

	add( item ) {

		const it = { reach: 1.8, size: 0.35, hold: 0, key: 'E', when: () => true, ...item };
		this.items.push( it );
		return it;

	}

	get( id ) {

		return this.items.find( ( i ) => i.id === id );

	}

	_at( it ) {

		return typeof it.at === 'function' ? it.at() : it.at;

	}

	// the item the view points at, or null
	pick() {

		const cam = this.camera;
		cam.updateMatrixWorld();
		_eye.setFromMatrixPosition( cam.matrixWorld );
		_fwd.set( 0, 0, - 1 ).applyQuaternion( cam.quaternion );
		let best = null, bestScore = Infinity;
		for ( const it of this.items ) {

			if ( ! it.when() ) continue;
			const p = this._at( it );
			_to.subVectors( p, _eye );
			const d = _to.length();
			if ( d > it.reach + it.size || d < 1e-4 ) continue;
			const along = _to.dot( _fwd );
			if ( along <= 0 ) continue;
			// distance of the target's centre from the view ray, against its size
			const off = Math.sqrt( Math.max( 0, d * d - along * along ) );
			// Large distant observations use an angle, rather than requiring a
			// tiny physical point to sit under the reticle. Nearby tools keep the
			// original precise targeting and distance preference.
			const allow = it.aimDegrees ? Math.tan( it.aimDegrees * Math.PI / 180 ) * along : it.size + 0.04 * along;
			const hitsSurface = it.halfSize && boxHit( p, it.halfSize, it.reach + it.size );
			if ( it.halfSize ? ! hitsSurface : off > allow ) continue;
			const score = Math.min( off / allow, hitsSurface ? .95 : Infinity ) + d * ( it.distanceWeight ?? .05 );
			if ( score < bestScore ) {

				bestScore = score;
				best = it;

			}

		}

		return best;

	}

	// after the player's update (which clears its prompt)
	update( dt ) {

		const inp = this.input, p = this.player;
		if ( ! this.enabled || p.busy ) {

			if ( this.held > 0 ) this.current?.onRelease?.();
			this.current = null;
			this.held = 0;
			return;

		}

		const it = this.pick();
		if ( it !== this.current ) {
			if ( this.held > 0 ) this.current?.onRelease?.();
			this.held = 0;
		}
		this.current = it;
		if ( ! it ) return;
		const text = typeof it.text === 'function' ? it.text() : it.text;
		if ( ! text ) return;
		if ( it.hold > 0 ) {

			if ( inp.down( 'KeyE' ) ) {

				this.held += dt;
				if ( it.onHold ) it.onHold( dt );
				if ( this.held >= it.hold ) {

					this.held = 0;
					if ( it.use ) it.use();

				}

			} else {

				if ( this.held > 0 && it.onRelease ) it.onRelease();
				this.held = 0;

			}

			// (progress(): an item that shows its own, the machine's winding; rate: its progress per second
			// held, for the time left. detail: a line on what the work does.)
			const progress = it.progress ? it.progress() : this.held / it.hold;
			const rate = it.rate ? ( typeof it.rate === 'function' ? it.rate() : it.rate ) : it.progress || it.hold > 1e6 ? 0 : 1 / it.hold;
			p.prompt = { key: it.key, text, progress, hold: true, hideProgress: !! it.hideProgress, active: inp.down( 'KeyE' ),
				eta: rate > 0 && progress < 0.999 ? ( 1 - progress ) / rate : null,
				detail: typeof it.detail === 'function' ? it.detail() : it.detail };

		} else {

			p.prompt = { key: it.key, text, detail: typeof it.detail === 'function' ? it.detail() : it.detail };
			if ( inp.hit( 'KeyE' ) && it.use ) it.use();

		}

	}

}
