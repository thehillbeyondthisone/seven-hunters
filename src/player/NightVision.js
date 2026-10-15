// A short, deliberately playable version of dark adaptation. This changes
// perception only; it never changes the dated sky, weather or light sources.
export class NightVision {

	constructor() { this.amount = 0; }

	update( dt, { night = 0, outside = false, lit = false, glow = 0, underwater = false, paused = false } = {} ) {

		const target = outside && ! underwater && ! lit ? night * ( 1 - Math.min( 1, glow ) ) : 0;
		if ( ! paused ) this.amount += ( target - this.amount ) * ( 1 - Math.exp( - Math.max( 0, dt ) / ( target > this.amount ? 1.7 : .35 ) ) );
		// Suppress the lift indoors, in daylight and in water, even while the
		// eyes are still recovering from the change in surroundings.
		this.strength = outside && ! underwater ? this.amount * night : 0;
		this.exposure = 1 + this.strength * 1.5;
		return this.strength;

	}

}
