import { Matrix4, Vector3 } from '../../engine/index.js';
import { Part } from '../village/GeoBuilder.js';
import { mulberry32 } from '../../util/Noise.js';

const identity = new Matrix4();
const randFor = seed => mulberry32( Math.round( seed * 100003 ) );
const area = points => Math.abs( points.reduce( ( a, p, i ) => {
	const q = points[ ( i + 1 ) % points.length ];
	return a + p[ 0 ] * q[ 1 ] - q[ 0 ] * p[ 1 ];
}, 0 ) ) / 2;

// Clipping keeps stones at doors and gable slopes inside the construction envelope.
function clip( polygon, signedDistance ) {
	const result = [];
	for ( let i = 0; i < polygon.length; i ++ ) {
		const a = polygon[ i ], b = polygon[ ( i + 1 ) % polygon.length ];
		const da = signedDistance( a ), db = signedDistance( b );
		if ( da >= 0 ) result.push( a );
		if ( ( da >= 0 ) !== ( db >= 0 ) ) {
			const t = da / ( da - db );
			result.push( [ a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * t, a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * t ] );
		}
	}
	return result;
}

function subtractOpening( polygon, hole ) {
	const middle = clip( clip( polygon, p => p[ 0 ] - hole.x0 ), p => hole.x1 - p[ 0 ] );
	return [
		clip( polygon, p => hole.x0 - p[ 0 ] ), clip( polygon, p => p[ 0 ] - hole.x1 ),
		clip( middle, p => hole.y0 - p[ 1 ] ), clip( middle, p => p[ 1 ] - hole.y1 ),
	].filter( p => p.length >= 3 && area( p ) > 0.001 );
}

// A lowest-first skyline packs mixed-height stones and small snecks without
// overlaps. Local random streams leave the rest of the island's seed unchanged.
export function stoneLayout( { length, height, seed = 1, dry = false } ) {
	if ( ! Number.isFinite( length ) || ! Number.isFinite( height ) || length <= 0 || height <= 0 ) return [];
	const random = randFor( seed ), nx = Math.max( 1, Math.ceil( length / 0.13 ) );
	const ny = Math.max( 1, Math.ceil( height / ( dry ? 0.085 : 0.125 ) ) );
	const skyline = new Uint16Array( nx ), cells = [];
	while ( true ) {
		let low = ny;
		for ( const y of skyline ) low = Math.min( low, y );
		if ( low === ny ) break;
		const starts = [];
		for ( let i = 0; i < nx; i ++ ) if ( skyline[ i ] === low && ( i === 0 || skyline[ i - 1 ] !== low ) ) starts.push( i );
		const start = starts[ Math.floor( random() * starts.length ) ];
		let available = 0;
		while ( start + available < nx && skyline[ start + available ] === low ) available ++;
		let width = Math.min( available, 2 + Math.floor( random() * ( dry ? 6 : 5 ) ) );
		if ( available - width === 1 ) width ++;
		const heightRoll = random();
		let rows = dry ? ( heightRoll < .45 ? 1 : heightRoll < .85 ? 2 : 3 ) : 1 + Math.floor( heightRoll * 4 );
		if ( width <= 2 ) rows = 1; // Small packing pieces, rather than tall narrow pillars.
		rows = Math.min( rows, ny - low );
		cells.push( { x0: start * length / nx, x1: ( start + width ) * length / nx,
			y0: low * height / ny, y1: ( low + rows ) * height / ny, seed: random() * 1000 } );
		for ( let i = start; i < start + width; i ++ ) skyline[ i ] += rows;
	}
	return cells;
}

function stoneOutline( cell, random, gap, warp = p => p ) {
	const { x0, x1, y0, y1 } = cell;
	const w = x1 - x0, h = y1 - y0;
	const cut = () => Math.min( w, h ) * ( 0.07 + random() * 0.16 );
	const cuts = [ cut(), cut(), cut(), cut() ];
	const nick = () => Math.min( .021, h*.17 ) * random();
	const points = [ [ x0 + cuts[0], y0 ], [ x0+w*(.35+random()*.3), y0+nick() ],
		[ x1 - cuts[1], y0 ], [ x1, y0 + cuts[1] ], [ x1, y1 - cuts[2] ],
		[ x1 - cuts[2], y1 ], [ x0+w*(.35+random()*.3), y1-nick() ],
		[ x0 + cuts[3], y1 ], [ x0, y1 - cuts[3] ], [ x0, y0 + cuts[0] ] ].map( warp );
	const cx = points.reduce( ( n, p ) => n + p[0], 0 ) / points.length;
	const cy = points.reduce( ( n, p ) => n + p[1], 0 ) / points.length;
	return points.map( p => [ p[0] + ( cx - p[0] ) * Math.min( 0.18, gap / w ),
		p[1] + ( cy - p[1] ) * Math.min( 0.18, gap / h ) ] );
}

// Closed, individually bevelled volumes. Both faces and all exposed ends are
// geometry; the material carries only stone grain, never another brick grid.
export function emitStone( B, polygon, { back, front, seed, tint, dry = false, relief = 1, unworked = false } ) {
	if ( polygon.length < 3 || area( polygon ) < 0.001 ) return;
	const random = randFor( seed ), p = [], n = [], uv = [], idx = [], vertices = new Map();
	const cx = polygon.reduce( ( a, v ) => a + v[0], 0 ) / polygon.length;
	const cy = polygon.reduce( ( a, v ) => a + v[1], 0 ) / polygon.length;
	const minSide = Math.min( Math.max( ...polygon.map( v => v[0] ) ) - Math.min( ...polygon.map( v => v[0] ) ),
		Math.max( ...polygon.map( v => v[1] ) ) - Math.min( ...polygon.map( v => v[1] ) ) );
	const bevel = Math.min( dry ? 0.017 : 0.022, minSide * 0.12 );
	const center = [ cx, cy, ( front + back ) / 2 ];
	const triangle = ( a, b, c, group ) => {
		const ab = b.map( ( v, i ) => v - a[i] ), ac = c.map( ( v, i ) => v - a[i] );
		let normal = [ ab[1]*ac[2]-ab[2]*ac[1], ab[2]*ac[0]-ab[0]*ac[2], ab[0]*ac[1]-ab[1]*ac[0] ];
		const size = Math.hypot( ...normal );
		if ( size < 1e-10 ) return;
		if ( normal.reduce( ( s, v, i ) => s + v * ( ( a[i]+b[i]+c[i] ) / 3 - center[i] ), 0 ) < 0 ) {
			[ b, c ] = [ c, b ]; normal = normal.map( v => -v );
		}
		for ( const v of [ a, b, c ] ) {
			const key = group + ':' + v.join(',');
			let index = vertices.get(key);
			if ( index === undefined ) {
				index = p.length/3; vertices.set(key,index);
				p.push(...v); n.push(0,0,0); uv.push(v[0],v[1]);
			}
			for ( let k=0; k<3; k++ ) n[index*3+k] += normal[k];
			idx.push(index);
		}
	};
	const outerFront = polygon.map( v => [ ...v, front - bevel - ( unworked ? random() * (front-back) * .52 : 0 ) ] );
	const outerBack = polygon.map( v => [ ...v, back + bevel ] );
	const inside = ( v, z ) => {
		const dx = v[0]-cx, dy = v[1]-cy, d = Math.hypot( dx, dy );
		const f = 1 - Math.min( 0.18, bevel / Math.max( d, 0.01 ) );
		return [ cx + dx*f, cy + dy*f, z + ( random() - .5 ) * minSide * .022 * relief ];
	};
	const innerFront = polygon.map( ( v, i ) => inside( v, unworked ? outerFront[i][2] + bevel : front ) );
	const innerBack = polygon.map( v => inside( v, back ) );
	const crownFront = [ cx + (random()-.5)*minSide*(unworked ? .5 : .18), cy + (random()-.5)*minSide*(unworked ? .5 : .16),
		front + minSide * .017 * relief + (unworked ? (front-back)*(.15+random()*.3) : 0) ];
	const crownBack = [ cx, cy, back - minSide * .017 * relief ];
	// Fractured edges continue through the depth, particularly visible at dry
	// masonry corners: avoid the perfectly straight sides of extruded pavers.
	const middle = polygon.map( v => {
		const inset = random() * Math.min( .027, minSide*.2 ) / Math.max( .01, Math.hypot(v[0]-cx,v[1]-cy) );
		return [ v[0]+(cx-v[0])*inset, v[1]+(cy-v[1])*inset, (front+back)/2+(random()-.5)*(front-back)*.12 ];
	} );
	for ( let i = 0; i < polygon.length; i ++ ) {
		const j = ( i + 1 ) % polygon.length;
		triangle( crownFront, innerFront[i], innerFront[j], 0 );
		triangle( innerFront[i], outerFront[i], outerFront[j], 2 ); triangle( innerFront[i], outerFront[j], innerFront[j], 2 );
		triangle( outerFront[i], middle[i], middle[j], 4+i ); triangle( outerFront[i], middle[j], outerFront[j], 4+i );
		triangle( middle[i], outerBack[i], outerBack[j], 4+i ); triangle( middle[i], outerBack[j], middle[j], 4+i );
		triangle( outerBack[i], innerBack[i], innerBack[j], 3 ); triangle( outerBack[i], innerBack[j], outerBack[j], 3 );
		triangle( crownBack, innerBack[j], innerBack[i], 1 );
	}
	// Share vertices within a face, retaining a crease at the bevel and each
	// fractured side. This reduces buffer size and removes triangular face shading.
	for ( let i=0; i<n.length; i+=3 ) {
		const length = Math.hypot(n[i],n[i+1],n[i+2]) || 1;
		n[i]/=length; n[i+1]/=length; n[i+2]/=length;
	}
	const tone = 0.69 + random() * 0.49, warm = random() - .5;
	B.add( 'stationMasonry', new Part( p, n, uv, idx ), identity,
		tint.map( ( v, i ) => v * tone * [ .94, 1, 1.08 ][i] * ( 1 + warm * [ .17, .04, -.12 ][i] ) ), [ seed, 3, 0, dry ? .87 : .96 ] );
}

export function stoneBlock( B, { x0, x1, y0, y1, back, front, seed = 1, tint, dry = false, relief = 1, unworked = false } ) {
	const random = randFor(seed);
	const polygon = unworked ? Array.from( { length: 7 }, (_,i) => {
		const angle = (i+.18+random()*.3)*Math.PI*2/7, r = .7+random()*.3;
		return [ (x0+x1)/2 + Math.cos(angle)*(x1-x0)/2*r, (y0+y1)/2 + Math.sin(angle)*(y1-y0)/2*r ];
	} ) : stoneOutline( { x0, x1, y0, y1 }, random, 0.002 );
	emitStone( B, polygon, { back, front, seed, tint, dry, relief, unworked } );
}

export function fittedStoneWall( B, { length, bottom, top, depth, seed = 1, tint, dry = false, contour = null, openings = [] } ) {
	const height = top - bottom, cells = stoneLayout( { length, height, seed, dry } );
	const warp = ( [x,y] ) => {
		// A shared distortion keeps adjoining beds aligned while varying their slope.
		const ex = Math.sin( Math.PI*x/length ), ey = Math.sin( Math.PI*y/height );
		return [ x + ex * ( dry ? .033 : .027 ) * Math.sin( y*8 + x*3.1 + seed ),
			y + bottom + ey * ( dry ? .037 : .031 ) * Math.sin( x*4.1 + y*2.3 + seed ) ];
	};
	let count = 0;
	for ( const cell of cells ) {
		const random = randFor( cell.seed );
		let polygon = stoneOutline( cell, random, dry ? .006 : .012, warp );
		if ( contour ) for ( let i = 0; i < contour.length; i ++ ) {
			const a = contour[i], b = contour[(i+1)%contour.length];
			polygon = clip( polygon, p => (b[0]-a[0])*(p[1]-a[1]) - (b[1]-a[1])*(p[0]-a[0]) );
		}
		let fragments = [ polygon ];
		for ( const opening of openings ) fragments = fragments.flatMap( p => subtractOpening( p, opening ) );
		for ( const fragment of fragments ) {
			if ( fragment.length < 3 || area( fragment ) < .002 ) continue;
			const protrude = ( random() - .35 ) * ( dry ? .085 : .025 );
			emitStone( B, fragment, { back: -depth - protrude*.4, front: protrude, seed: cell.seed, tint, dry } );
			count ++;
		}
	}
	return count;
}

// Broken, unworked versions of the same stone volumes in sparse off-path patches.
// These placements are art direction, not a surveyed distribution of island stones.
export function islandStoneScatter( B, terrain, footprints, tint ) {
	const random = randFor( 617.3 ), placed = [], normal = new Vector3();
	for ( const [ cx, cz, radius, count ] of [ [ -3.5,55.5,3.3,24 ], [ -18,59,4,24 ], [ 29,15,4.5,24 ], [ -38,37,4,24 ], [ -72,37,5,28 ] ] ) {
		for ( let i = 0; i < count; i ++ ) {
			const a = random()*Math.PI*2, r = Math.sqrt(random())*radius;
			const x = cx + Math.cos(a)*r, z = cz + Math.sin(a)*r;
			const width = .18 + random()*.65, span = width*(.5+random()*.6), thickness = Math.min( width*.6, .07+random()*.26 );
			const h = terrain.heightAt(x,z);
			terrain.normalAt(x,z,normal);
			if ( h < 5 || normal.y < .92 || terrain.pathDistance(x,z) < width + .7 || footprints.some( p => Math.hypot(x-p.x,z-p.z) < p.r+width+.4 ) ) continue;
			if ( x > -28 && x < 14 && z > -7 && z < 22 ) continue;
			B.pushAt( x, h + thickness*.1, z, random()*Math.PI*2, -Math.PI/2, (random()-.5)*.16 );
			stoneBlock( B, { x0: -width/2, x1: width/2, y0: -span/2, y1: span/2, back: -thickness/2, front: thickness/2,
				seed: random()*1000, tint, dry: true, relief: 2.3, unworked: true } );
			B.pop();
			placed.push( { x, z, width, height: h } );
		}
	}
	return placed;
}
