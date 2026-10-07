import { Vector3, Ray, Box3 } from '../engine/index.js';

const point = new Vector3(), ray = new Ray(), local = new Ray(), box = new Box3();
// Closest hit against the existing collision world, terrain, sea, and temporary target spheres.
// Ring gaps use the same angles as player collision, so shots pass through open doors.
export function traceWeapon( origin, direction, { colliders, terrain, targets = [], seaLevel = 0 }, range = 180 ) {
	let distance = range, target = null, kind = 'air';
	ray.set( origin, direction );
	const accept = ( d, what, object = null ) => {
		if ( d >= 0 && d < distance ) { distance = d; kind = what; target = object; }
	};
	for ( const b of colliders.boxes ) {
		if ( ! b.solid || b.enabled === false ) continue;
		const dx = origin.x - b.center.x, dz = origin.z - b.center.z;
		local.origin.set( dx * b.cos - dz * b.sin, origin.y - b.center.y, dx * b.sin + dz * b.cos );
		local.direction.set( direction.x * b.cos - direction.z * b.sin, direction.y, direction.x * b.sin + direction.z * b.cos );
		box.min.copy( b.half ).negate(); box.max.copy( b.half );
		if ( local.intersectBox( box, point ) ) accept( point.distanceTo( local.origin ), 'stone' );
	}
	const round = ( c, radius, ring ) => {
		const ox = origin.x - c.x, oz = origin.z - c.z;
		const a = direction.x ** 2 + direction.z ** 2;
		if ( a < 1e-10 ) return;
		const b = 2 * ( ox * direction.x + oz * direction.z ), discriminant = b * b - 4 * a * ( ox * ox + oz * oz - radius * radius );
		if ( discriminant < 0 ) return;
		for ( const d of [ ( - b - Math.sqrt( discriminant ) ) / ( 2 * a ), ( - b + Math.sqrt( discriminant ) ) / ( 2 * a ) ] ) {
			if ( d < 0 || d > distance ) continue;
			const y = origin.y + direction.y * d;
			if ( y < c.yMin || y > c.yMax ) continue;
			if ( ring ) {
				const angle = Math.atan2( oz + direction.z * d, ox + direction.x * d );
				if ( c.gaps.some( ( [ a0, a1 ] ) => ( ( angle - a0 ) % ( Math.PI * 2 ) + Math.PI * 2 ) % ( Math.PI * 2 ) <= a1 - a0 ) ) continue;
			}
			accept( d, 'stone' );
		}
	};
	for ( const c of colliders.cylinders ) if ( c.enabled !== false ) round( c, c.radius, false );
	for ( const c of colliders.rings ) if ( c.enabled !== false ) { round( c, c.rIn, true ); round( c, c.rOut, true ); }
	for ( let d = 0.25; d < distance; d += 0.35 ) {
		ray.at( d, point );
		if ( point.y <= terrain.heightAt( point.x, point.z ) ) { accept( d, 'ground' ); break; }
		if ( point.y <= seaLevel ) { accept( d, 'water' ); break; }
	}
	for ( const t of targets ) {
		if ( ray.intersectSphere( { center: t.mesh.position, radius: t.radius }, point ) ) accept( point.distanceTo( origin ), 'target', t );
	}
	return { distance, kind, target, point: ray.at( distance, new Vector3() ) };
}
