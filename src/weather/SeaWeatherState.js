// Authored North Atlantic conditions, not a reconstruction of a particular day's weather.
// The swell retains energy after the wind drops; wet stone dries more slowly than the rain ends.
export const SEA_WEATHER = {
	settled: { label: 'Settled', wind: 6, clouds: 0.43, vis: 55, rain: 0, sea: 0.32, surf: 0.22 },
	fresh: { label: 'Rising sea', wind: 12, clouds: 0.68, vis: 22, rain: 0.18, sea: 0.72, surf: 0.58 },
	gale: { label: 'Atlantic gale', wind: 21, clouds: 0.92, vis: 4.5, rain: 0.85, sea: 1.3, surf: 1 },
	easing: { label: 'After the squall', wind: 9, clouds: 0.62, vis: 30, rain: 0.04, sea: 0.86, surf: 0.66 },
	storm: { label: 'Violent storm · force 11', wind: 30, clouds: 0.98, vis: 1.5, rain: 0.95, sea: 2.1, surf: 1.5 },
	hurricane: { label: 'Hurricane force · force 12', wind: 38, clouds: 1, vis: 0.65, rain: 1, sea: 3.1, surf: 2.2 },
};
const clamp = ( x, a = 0, b = 1 ) => Math.max( a, Math.min( b, x ) );
const smooth = ( x ) => { x = clamp( x ); return x * x * ( 3 - 2 * x ); };
const KEYS = [ [ 0, 'settled' ], [ 35, 'fresh' ], [ 95, 'gale' ], [ 155, 'gale' ], [ 215, 'easing' ], [ 260, 'settled' ] ];
export const WEATHER_CYCLE_SECONDS = 260;

export function configureSeaPreview( qs ) {
	if ( ! ( qs.has( 'weatherPreview' ) || qs.has( 'simulation' ) || qs.has( 'seaDread' ) ) || qs.has( 'vr' ) ) return false;
	qs.set( 'setting', 'flannan' );
	qs.set( 'nostory', '' );
	qs.set( 'lamp', '' );
	return true;
}

export function weatherCycleAt( seconds ) {
	const t = clamp( Number.isFinite( seconds ) ? seconds : 0, 0, WEATHER_CYCLE_SECONDS );
	let i = 0;
	while ( i < KEYS.length - 2 && t > KEYS[ i + 1 ][ 0 ] ) i ++;
	const [ a, ka ] = KEYS[ i ], [ b, kb ] = KEYS[ i + 1 ];
	const u = smooth( ( t - a ) / ( b - a ) ), A = SEA_WEATHER[ ka ], B = SEA_WEATHER[ kb ];
	const out = { label: u < 0.5 ? A.label : B.label };
	for ( const k of [ 'wind', 'clouds', 'vis', 'rain', 'sea', 'surf' ] ) out[ k ] = A[ k ] + ( B[ k ] - A[ k ] ) * u;
	return out;
}

export class SeaWeatherState {
	constructor( preset = 'gale' ) {
		this.preset = SEA_WEATHER[ preset ] ? preset : 'gale';
		this.state = { ...SEA_WEATHER[ this.preset ], wet: SEA_WEATHER[ this.preset ].rain };
		this.cycling = false;
		this.elapsed = 0;
	}
	select( preset ) {
		if ( ! SEA_WEATHER[ preset ] ) return false;
		this.preset = preset;
		this.cycling = false;
		return true;
	}
	cycle() {
		this.elapsed = 0;
		this.cycling = true;
	}
	update( dt ) {
		dt = clamp( Number.isFinite( dt ) ? dt : 0, 0, 0.1 );
		if ( this.cycling ) this.elapsed = Math.min( WEATHER_CYCLE_SECONDS, this.elapsed + dt );
		const target = this.cycling ? weatherCycleAt( this.elapsed ) : SEA_WEATHER[ this.preset ];
		const s = this.state;
		for ( const k of [ 'wind', 'clouds', 'vis', 'rain', 'sea', 'surf' ] ) {
			const tau = k === 'sea' || k === 'surf' ? 12 : 4;
			s[ k ] += ( target[ k ] - s[ k ] ) * ( 1 - Math.exp( - dt / tau ) );
		}
		s.wet += ( s.rain - s.wet ) * ( 1 - Math.exp( - dt / ( s.rain > s.wet ? 6 : 90 ) ) );
		s.label = target.label;
		if ( this.cycling && this.elapsed >= WEATHER_CYCLE_SECONDS ) { this.cycling = false; this.preset = 'settled'; }
		return s;
	}
}
