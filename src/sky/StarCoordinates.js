import { Matrix3, Vector3 } from '../engine/math/index.js';

// Mean equator/equinox of date. Catalog coordinates and proper motions are J2000;
// see docs/NIGHT-SKY.md for sources and the deliberately omitted sub-arcminute effects.
const RAD = Math.PI / 180;
const MAS = RAD / 3600000;
const J2000 = Date.UTC( 2000, 0, 1, 12 );
export const REFERENCE_STAR_TIME = J2000;

export function greenwichSiderealTime( utMs ) {

	const d = ( utMs - J2000 ) / 86400000, t = d / 36525;
	const degrees = 280.46061837 + 360.98564736629 * d + 0.000387933 * t * t - t * t * t / 38710000;
	return ( degrees % 360 + 360 ) % 360;

}

// World +x east, +y up, -z north, including the same optional y-axis turn as sun/moon.
// Returns world -> equatorial-of-date (the inverse is its transpose).
export function worldToEquatorialMatrix( utMs, latDeg, lonDeg, azimuthRadians = 0, out = new Matrix3() ) {

	const l = ( greenwichSiderealTime( utMs ) + lonDeg ) * RAD, p = latDeg * RAD;
	const sl = Math.sin( l ), cl = Math.cos( l ), sp = Math.sin( p ), cp = Math.cos( p );
	const s = Math.sin( azimuthRadians ), c = Math.cos( azimuthRadians );
	return out.set(
		- sl * c + sp * cl * s, cp * cl, sl * s + sp * cl * c,
		cl * c + sp * sl * s, cp * sl, - cl * s + sp * sl * c,
		- cp * s, sp, - cp * c
	);

}

// IAU 1976 precession from J2000 (adequate to <1 arcsec around 1901).
export function precessJ2000( direction, utMs, out = new Vector3() ) {

	const t = ( utMs - J2000 ) / ( 86400000 * 36525 ), t2 = t * t, t3 = t2 * t;
	const zeta = ( 2306.2181 * t + 0.30188 * t2 + 0.017998 * t3 ) * RAD / 3600;
	const z = ( 2306.2181 * t + 1.09468 * t2 + 0.018203 * t3 ) * RAD / 3600;
	const theta = ( 2004.3109 * t - 0.42665 * t2 - 0.041833 * t3 ) * RAD / 3600;
	const x = direction.x * Math.cos( zeta ) - direction.y * Math.sin( zeta );
	const y = direction.x * Math.sin( zeta ) + direction.y * Math.cos( zeta );
	const a = x * Math.cos( theta ) - direction.z * Math.sin( theta );
	const b = x * Math.sin( theta ) + direction.z * Math.cos( theta );
	return out.set( a * Math.cos( z ) - y * Math.sin( z ), a * Math.sin( z ) + y * Math.cos( z ), b ).normalize();

}

// HYG pmra = mu_alpha*cos(dec), pmdec, in milliarcseconds per Julian year.
// Tangent-vector propagation stays well-behaved at the celestial poles.
export function propagateStar( row, utMs, out = new Vector3() ) {

	const ra = row[ 3 ] * RAD, dec = row[ 4 ] * RAD;
	const cr = Math.cos( ra ), sr = Math.sin( ra ), cd = Math.cos( dec ), sd = Math.sin( dec );
	const years = ( utMs - J2000 ) / ( 86400000 * 365.25 );
	const a = ( row[ 7 ] || 0 ) * years * MAS, d = ( row[ 8 ] || 0 ) * years * MAS;
	out.set( cd * cr - a * sr - d * sd * cr, cd * sr + a * cr - d * sd * sr, sd + d * cd ).normalize();
	return precessJ2000( out, utMs, out );

}
