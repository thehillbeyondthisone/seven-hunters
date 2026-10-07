// Authored storm pacing. This controls presentation, not wave physics.
const clamp = ( x, a = 0, b = 1 ) => Math.max( a, Math.min( b, x ) );
export const SEA_DREAD_TIME = 15.55;

export class SeaDreadState {
	constructor( { reduced = false, seed = 731 } = {} ) {
		this.enabled = true; this.reduced = reduced; this.seed = seed;
		this.time = 0; this.nextStrike = 18; this.strikeAge = 100;
		this.thunderIn = - 1; this.impact = 0; this.strikes = 0;
		this.flash = 0; this.shake = 0;
	}
	rand() {
		this.seed = ( Math.imul( this.seed, 1664525 ) + 1013904223 ) >>> 0;
		return this.seed / 4294967296;
	}
	strike( distance = 900 ) {
		if ( ! this.enabled ) return false;
		this.strikeAge = 0; this.strikes ++;
		this.thunderIn = clamp( distance / 343, 1, 7 );
		this.nextStrike = this.time + 32 + this.rand() * 26;
		return true;
	}
	hit( strength ) {
		if ( this.enabled ) this.impact = Math.min( 1, this.impact + clamp( strength ) );
	}
	setEnabled( enabled ) {
		this.enabled = !! enabled;
		this.impact = this.flash = this.shake = 0;
		this.thunderIn = - 1; this.strikeAge = 100;
		this.nextStrike = this.time + 18;
	}
	update( dt, storm = 1 ) {
		dt = clamp( Number.isFinite( dt ) ? dt : 0, 0, 0.1 );
		this.time += dt; this.strikeAge += dt;
		const strike = this.enabled && storm > 0.55 && this.time >= this.nextStrike;
		// The controller supplies the actual source distance after this request.
		if ( strike ) this.nextStrike = this.time + 32;
		let thunder = false;
		if ( this.thunderIn >= 0 && dt > 0 ) {
			this.thunderIn -= dt;
			if ( this.thunderIn <= 0 ) { thunder = true; this.thunderIn = - 1; this.hit( 0.16 ); }
		}
		this.impact *= Math.exp( - dt * 3.4 );
		// One broad pulse, with no repeated strobe. Reduced effects keeps the atmosphere and sound.
		const t = this.strikeAge;
		this.flash = this.enabled && ! this.reduced && t < 0.55 ? Math.sin( Math.PI * clamp( t / 0.55 ) ) ** 2 : 0;
		this.shake = this.enabled && ! this.reduced ? this.impact : 0;
		return { strike, thunder };
	}
}
