// Authored game readings, not recovered observations from January 1901.
export const pressureAt = h => h < 19 ? 29.94 : h < 23 ? 29.86 : 29.81;
export const temperatureAt = h => 42 - 2 * Math.max( 0, Math.min( 1, ( h - 18 ) / 3 ) );
export const pressureAngle = p => ( ( p - 28 ) / 3 * 270 - 135 ) * Math.PI / 180;

// Engine wind is a vector TO (x east, z south); the log names the direction FROM.
export function windReading( x, z, speed ) {
	if ( ! [ x, z, speed ].every( Number.isFinite ) || Math.hypot( x, z ) < 1e-6 || speed < 0 ) return null;
	const bearing = ( Math.atan2( -x, z ) * 180 / Math.PI + 360 ) % 360;
	const direction = [ 'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW' ][ Math.round( bearing / 45 ) % 8 ];
	const bands = [ .3, 1.6, 3.4, 5.5, 8, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7 ];
	let force = bands.findIndex( limit => speed < limit );
	if ( force < 0 ) force = 12;
	const term = [ 'Calm', 'Light airs', 'Light breeze', 'Gentle breeze', 'Moderate breeze', 'Fresh breeze', 'Strong breeze', 'Near gale', 'Gale', 'Strong gale', 'Storm', 'Violent storm', 'Hurricane force' ][ force ];
	return { direction, bearing, speed, force, label: force ? `${ term }, ${ direction }` : term };
}

// Modern wave-height bands calibrate the simulation's qualitative descriptions;
// this does not assert an original station protocol or an ocean measurement.
export function seaReading( heights ) {
	if ( heights.length < 9 || ! heights.every( Number.isFinite ) ) return null;
	const mean = heights.reduce( ( a, b ) => a + b, 0 ) / heights.length;
	const height = 4 * Math.sqrt( heights.reduce( ( a, b ) => a + ( b - mean ) ** 2, 0 ) / heights.length );
	const limits = [ .5, 1.25, 2.5, 4, 6, 9, 14 ];
	let i = limits.findIndex( limit => height <= limit );
	if ( i < 0 ) i = 7;
	return { height, label: [ 'Smooth', 'Slight', 'Moderate', 'Rough', 'Very rough', 'High', 'Very high', 'Phenomenal' ][ i ] };
}

export function landmarkReport( { blocked, transmittance, daylight, lit, nearby } ) {
	if ( blocked ) return { status: 'blocked', label: 'View obstructed — move to an open part of the balcony' };
	if ( ! Number.isFinite( transmittance ) ) return null;
	if ( transmittance < ( lit ? .012 : .02 ) ) return { status: 'fog', label: nearby ? 'Nearby island lost in sea fog' : 'Gallan Head lost in haze' };
	if ( lit ) return { status: 'visible', label: 'Gallan Head’s light in sight' };
	if ( daylight < .15 ) return { status: 'dark', label: nearby ? 'Nearby island indistinct in darkness' : 'Distant shore cannot be judged in darkness' };
	return { status: 'visible', label: nearby ? 'Nearby island in sight' : 'Lewis in sight' };
}

export function visibilityReading( far, near ) {
	if ( ! far || ! near || far.status === 'blocked' || near.status === 'blocked' ) return null;
	return { label: `${ far.label }; ${ near.label.toLowerCase() }`, far, near };
}
