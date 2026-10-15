// A bounded, authored landing surge, not a coastal fluid solver. CPU movement
// and the WGSL surface use the same coordinates, coefficients and event clock.
export const COAST_PERIOD = 14;
export const COAST_SETS = [ .48, .62, .85, .56, 1.25 ];
const clamp = x => Math.max( 0, Math.min( 1, x ) );
const smooth = ( a, b, x ) => { const t = clamp( ( x - a ) / ( b - a ) ); return t * t * ( 3 - 2 * t ); };
export function coastalSample( site, time, strength, x, z, rogue = 0 ) {
	const along = ( x - site.x ) * site.dx + ( z - site.z ) * site.dz;
	const across = Math.abs( -( x - site.x ) * site.dz + ( z - site.z ) * site.dx );
	const clock = Math.max( 0, time + along / 9 + site.phase );
	const wave = Math.floor( clock / COAST_PERIOD ), phase = clock / COAST_PERIOD - wave;
	const mask = ( 1 - smooth( site.width * .4, site.width * .6, across ) )
		* ( 1 - smooth( 0, site.reach, -along ) ) * ( 1 - smooth( 40, 80, along ) );
	const pulse = smooth( 0, .13, phase ) * ( 1 - smooth( .13, .49, phase ) );
	const amplitude = ( .5 + Math.max( 0, strength ) * 4 ) * COAST_SETS[ wave % 5 ] * site.exposure + rogue;
	const ripple = .06 * Math.sin(x*.8+time*1.6) * Math.sin(z*.9+time*1.2);
	const height = Math.max(0,(amplitude+ripple) * pulse * mask);
	const draining = phase > .26;
	const speed = Math.min( 9, amplitude * .9 ) * pulse * mask * ( draining ? .75 : -1 );
	return { height, flowX: site.dx * speed, flowZ: site.dz * speed, phase, wave, foam: pulse * mask, mask, draining };
}
export class CoastalState {
	constructor( terrain ) {
		this.time = 0; this.strength = .22; this.rogue = 0;
		this.sites = [ 'east', 'west' ].map( ( name, i ) => {
			const l = terrain.landing( name );
			return { name, x: l.stage.x, z: l.stage.z, dx: l.dir[ 0 ], dz: l.dir[ 1 ], width: 13,
				reach: 75, exposure: i ? 1 : .62, phase: i * 4.3 };
		} );
	}
	update( dt, { paused = false, strength = this.strength } = {} ) {
		if ( paused ) return;
		this.time += Math.max( 0, Math.min( .1, Number.isFinite( dt ) ? dt : 0 ) );
		this.strength = Math.max( 0, Math.min( 2.2, Number.isFinite( strength ) ? strength : .22 ) );
	}
	sample( position, { ground = position.y ?? 0, level = 0, time = this.time, strength = this.strength, rogue = this.rogue } = {} ) {
		let best = { height: 0, flowX: 0, flowZ: 0, foam: 0, phase: 0, mask: 0, draining: false, site: null };
		for ( const site of this.sites ) {
			const q = coastalSample( site, time, strength, position.x, position.z, site.name === 'west' ? rogue : 0 );
			if ( q.height > best.height ) best = { ...q, site: site.name };
		}
		return { ...best, surfaceHeight: level + best.height, washDepth: Math.max( 0, level + best.height - ground ) };
	}
	save() { return { time: this.time, strength: this.strength, rogue: this.rogue }; }
	load( data ) {
		this.time = Math.max( 0, Number.isFinite( data?.time ) ? data.time : 0 );
		this.strength = Math.max( 0, Math.min( 2.2, Number.isFinite( data?.strength ) ? data.strength : .22 ) );
		this.rogue = Math.max( 0, Math.min( 48, Number.isFinite( data?.rogue ) ? data.rogue : 0 ) );
	}
}
