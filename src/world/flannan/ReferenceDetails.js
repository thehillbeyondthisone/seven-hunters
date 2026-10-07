import { Matrix4, Vector3 } from '../../engine/index.js';
import { Part } from '../village/GeoBuilder.js';

const identity = new Matrix4();

function face( B, key, points, outward, options ) {
	const a = new Vector3( ...points[ 0 ] ), b = new Vector3( ...points[ 1 ] ), c = new Vector3( ...points[ 2 ] );
	let normal = b.sub( a ).cross( c.sub( a ) ).normalize();
	if ( normal.dot( new Vector3( ...outward ) ) < 0 ) {
		points = points.slice().reverse();
		normal.negate();
	}
	const uv = points.map( p => [ p[ 0 ] + p[ 2 ] * 0.37, p[ 1 ] ] ).flat();
	const indices = [];
	for ( let i = 1; i < points.length - 1; i ++ ) indices.push( 0, i, i + 1 );
	B.add( key, new Part( points.flat(), points.map( () => normal.toArray() ).flat(), uv, indices ), identity, options.tint, options.data );
}

// Photograph-led pale drum with actual circular openings. Count, spacing and
// dimensions are reconstruction; HES LB48143 establishes the porthole stage.
export function portholeDrum( B, { bottom, top, radius, doorAngle, doorHalf, paint, iron } ) {
	const count = 16, half = Math.PI / count, hole = 0.115, cy = bottom + 0.83;
	const inside = radius - 0.075, uMax = half * radius, low = bottom - cy, high = top - cy;
	const point = ( angle, u, v, r ) => [ Math.cos( angle + u / radius ) * r, cy + v, Math.sin( angle + u / radius ) * r ];
	const angles = Array.from( { length: 24 }, ( _, i ) => i * Math.PI * 2 / 24 );
	// Include the rectangle's corners so the annular patches meet their neighbours.
	for ( const u of [ -uMax, uMax ] ) for ( const v of [ low, high ] ) angles.push( ( Math.atan2( v, u ) + Math.PI * 2 ) % ( Math.PI * 2 ) );
	angles.sort( ( a, b ) => a - b );
	const uvAt = phi => {
		const x = Math.cos( phi ), y = Math.sin( phi );
		const reach = Math.min( uMax / Math.max( Math.abs( x ), 1e-8 ), ( y > 0 ? high : -low ) / Math.max( Math.abs( y ), 1e-8 ) );
		return { hole: [ x * hole, y * hole ], edge: [ x * reach, y * reach ] };
	};
	for ( let k = 0; k < count; k ++ ) {
		const angle = doorAngle + k * Math.PI * 2 / count;
		const outward = [ Math.cos( angle ), 0, Math.sin( angle ) ];
		if ( k === 0 ) {
			// Keep the established gallery door and its threshold open.
			for ( const sign of [ -1, 1 ] ) {
				const u0 = sign * doorHalf * radius, u1 = sign * uMax;
				face( B, 'hard', [ point( angle, u0, low, radius ), point( angle, u1, low, radius ), point( angle, u1, high, radius ), point( angle, u0, high, radius ) ], outward, paint );
			}
			continue;
		}
		for ( let i = 0; i < angles.length; i ++ ) {
			const a = uvAt( angles[ i ] ), b = uvAt( angles[ ( i + 1 ) % angles.length ] );
			for ( const [ r, n ] of [ [ radius, outward ], [ inside, outward.map( v => -v ) ] ] ) {
				face( B, 'hard', [ point( angle, ...a.hole, r ), point( angle, ...a.edge, r ), point( angle, ...b.edge, r ), point( angle, ...b.hole, r ) ], n, paint );
			}
			const middle = ( angles[ i ] + ( i + 1 === angles.length ? angles[ 0 ] + Math.PI * 2 : angles[ i + 1 ] ) ) / 2;
			face( B, 'hard', [ point( angle, ...a.hole, radius ), point( angle, ...b.hole, radius ), point( angle, ...b.hole, inside ), point( angle, ...a.hole, inside ) ], [ -Math.sin( angle ) * Math.cos( middle ), -Math.sin( middle ), Math.cos( angle ) * Math.cos( middle ) ], iron );
		}
		// A recessed dark pane, with a fine painted cast-iron rim.
		const ring = Array.from( { length: 24 }, ( _, i ) => point( angle, Math.cos( i / 24 * Math.PI * 2 ) * hole, Math.sin( i / 24 * Math.PI * 2 ) * hole, inside + 0.006 ) );
		face( B, 'hard', ring, outward, { ...iron, tint: [ 0.018, 0.025, 0.026 ] } );
		B.torus( 'hard', Math.cos( angle ) * ( radius + 0.004 ), cy, Math.sin( angle ) * ( radius + 0.004 ), hole + 0.007, 0.012, { ry: Math.PI / 2 - angle, rx: Math.PI / 2, radial: 6, tubular: 24, ...iron } );
		// Fine panel seams and small fastenings rather than heavy vertical ribs.
		const seamAngle = angle - half;
		B.rod( 'hard', point( seamAngle, 0, low + 0.06, radius + 0.008 ), point( seamAngle, 0, high - 0.05, radius + 0.008 ), 0.007, 0.007, { segs: 4, ...paint } );
	}
}

// Irregular flattened stones carry silhouette and contact shadows. This is a
// material/construction study, not a trace of the chapel's condition in 1901.
export function roughSlab( B, x, y, z, width, height, depth, seed, options ) {
	const jitter = ( i ) => {
		const v = Math.sin( seed * 127.1 + i * 311.7 ) * 43758.5453;
		return v - Math.floor( v ) - 0.5;
	};
	const outline = [ [ -.5, -.28 ], [ -.32, -.5 ], [ .37, -.5 ], [ .5, -.13 ], [ .36, .5 ], [ -.38, .5 ] ];
	const points = [];
	for ( const sy of [ -1, 1 ] ) for ( let k = 0; k < outline.length; k ++ ) {
		const [ sx, sz ] = outline[ k ];
		points.push( [ x + sx * width + jitter( k ) * Math.min( width * 0.22, 0.13 ), y + sy * height / 2 + jitter( k + 11 + ( sy + 1 ) * 9 ) * height * 0.5, z + sz * depth + jitter( k + 23 ) * Math.min( depth * 0.25, 0.11 ) ] );
	}
	const count = outline.length;
	face( B, 'stationMasonry', points.slice( 0, count ), [ 0, -1, 0 ], options );
	face( B, 'stationMasonry', points.slice( count ), [ 0, 1, 0 ], options );
	for ( let k = 0; k < count; k ++ ) {
		const next = ( k + 1 ) % count;
		const n = [ ( outline[ k ][ 0 ] + outline[ next ][ 0 ] ) / 2, 0, ( outline[ k ][ 1 ] + outline[ next ][ 1 ] ) / 2 ];
		face( B, 'stationMasonry', [ points[ k ], points[ next ], points[ next + count ], points[ k + count ] ], n, options );
	}
}
