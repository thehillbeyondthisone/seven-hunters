import { Vector3 } from '../engine/math/index.js';
import { propagateStar } from './StarCoordinates.js';

export const STAR_GRID = 64;
// Largest rendered point-source support; bins overlap by this angular radius,
// including across cube-face seams. One lookup, no scan over the whole catalog.
export const STAR_SUPPORT = 0.004;
const CELL_COUNT = 6 * STAR_GRID * STAR_GRID;

// Matching JS/WGSL convention: +X,-X,+Y,-Y,+Z,-Z; same uv signs on both sides.
export function starCell( d ) {

	const a = [ Math.abs( d.x ), Math.abs( d.y ), Math.abs( d.z ) ];
	const axis = a[ 0 ] >= a[ 1 ] && a[ 0 ] >= a[ 2 ] ? 0 : a[ 1 ] >= a[ 2 ] ? 1 : 2;
	const v = [ d.x, d.y, d.z ], face = axis * 2 + ( v[ axis ] < 0 ? 1 : 0 );
	const u = axis === 0 ? d.y : d.x, w = axis === 2 ? d.y : d.z;
	const x = Math.min( STAR_GRID - 1, Math.max( 0, Math.floor( ( u / a[ axis ] * .5 + .5 ) * STAR_GRID ) ) );
	const y = Math.min( STAR_GRID - 1, Math.max( 0, Math.floor( ( w / a[ axis ] * .5 + .5 ) * STAR_GRID ) ) );
	return face * STAR_GRID * STAR_GRID + y * STAR_GRID + x;

}

export function starColor( ci ) {

	// Restrained B-V tint (missing photometry is neutral); artistic radiance, real photometry.
	if ( ci === null || ! Number.isFinite( ci ) ) return [ 1, 1, 1 ];
	const t = Math.max( 0, Math.min( 1, ( ci + .3 ) / 2.3 ) );
	return [ .82 + .18 * t, .9 - .13 * t, 1 - .38 * t ];

}

export function buildStarIndex( stars, utMs ) {

	const bins = Array.from( { length: CELL_COUNT }, () => [] ), dir = new Vector3();
	const points = stars.map( ( row ) => {

		propagateStar( row, utMs, dir );
		return [ dir.x, dir.y, dir.z, row[ 5 ], ...starColor( row[ 6 ] ), ( row[ 0 ] * .61803398875 ) % 1 ];

	} );
	for ( let i = 0; i < points.length; i ++ ) {

		const v = points[ i ];
		for ( let axis = 0; axis < 3; axis ++ ) {

			const major = Math.abs( v[ axis ] );
			if ( major < .5 ) continue;
			const u = v[ axis === 0 ? 1 : 0 ] / major, w = v[ axis === 2 ? 1 : 2 ] / major;
			// A conservative derivative bound of 4 on this projection covers the entire support.
			const pad = STAR_SUPPORT * 4;
			if ( Math.abs( u ) > 1 + pad || Math.abs( w ) > 1 + pad ) continue;
			const face = axis * 2 + ( v[ axis ] < 0 ? 1 : 0 );
			const low = ( q ) => Math.max( 0, Math.floor( ( ( q - pad ) * .5 + .5 ) * STAR_GRID ) );
			const high = ( q ) => Math.min( STAR_GRID - 1, Math.floor( ( ( q + pad ) * .5 + .5 ) * STAR_GRID ) );
			for ( let y = low( w ); y <= high( w ); y ++ ) for ( let x = low( u ); x <= high( u ); x ++ ) bins[ face * STAR_GRID * STAR_GRID + y * STAR_GRID + x ].push( i );

		}

	}
	const entries = bins.reduce( ( n, b ) => n + b.length, 0 );
	const data = new Float32Array( CELL_COUNT * 4 + entries * 8 );
	let offset = CELL_COUNT, maxOccupancy = 0;
	for ( let cell = 0; cell < bins.length; cell ++ ) {

		const bin = bins[ cell ];
		data[ cell * 4 ] = offset; data[ cell * 4 + 1 ] = bin.length;
		maxOccupancy = Math.max( maxOccupancy, bin.length );
		for ( const i of bin ) { data.set( points[ i ], offset * 4 ); offset += 2; }

	}
	return { data, cellCount: CELL_COUNT, maxOccupancy, count: stars.length };

}
