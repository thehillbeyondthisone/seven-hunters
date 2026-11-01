import { Vector3, Matrix4 } from '../engine/math/index.js';

// Station geometry is merged by material, so a single mesh can contain hundreds
// of thousands of triangles spread across the whole station. Keep exact triangle
// tests, but skip spatially separate chunks through a cached bounds hierarchy.
// Bounds stay in local space: opening a door only changes its world matrix.
const CHUNK_TRIANGLES = 128;
const geometryBounds = new WeakMap();

function triangleBounds( geometry ) {

	const position = geometry.getAttribute( 'position' ), index = geometry.index;
	const count = index?.count ?? position.count;
	const positionVersion = position.version ?? position.data?.version, indexVersion = index?.version ?? index?.data?.version;
	const previous = geometryBounds.get( geometry );
	if ( previous && previous.position === position && previous.index === index && previous.count === count && previous.positionVersion === positionVersion && previous.indexVersion === indexVersion ) return previous;
	let leaves = 1;
	while ( leaves * CHUNK_TRIANGLES * 3 < count ) leaves *= 2;
	const bounds = new Float32Array( leaves * 2 * 6 );
	for ( let node = leaves; node < leaves * 2; node ++ ) {

		const offset = node * 6;
		bounds[ offset ] = bounds[ offset + 1 ] = bounds[ offset + 2 ] = Infinity;
		bounds[ offset + 3 ] = bounds[ offset + 4 ] = bounds[ offset + 5 ] = -Infinity;
		const start = ( node - leaves ) * CHUNK_TRIANGLES * 3, end = Math.min( count, start + CHUNK_TRIANGLES * 3 );
		for ( let i = start; i < end; i ++ ) {

			const vertex = index ? index.getX( i ) : i;
			const x = position.getX( vertex ), y = position.getY( vertex ), z = position.getZ( vertex );
			bounds[ offset ] = Math.min( bounds[ offset ], x ); bounds[ offset + 3 ] = Math.max( bounds[ offset + 3 ], x );
			bounds[ offset + 1 ] = Math.min( bounds[ offset + 1 ], y ); bounds[ offset + 4 ] = Math.max( bounds[ offset + 4 ], y );
			bounds[ offset + 2 ] = Math.min( bounds[ offset + 2 ], z ); bounds[ offset + 5 ] = Math.max( bounds[ offset + 5 ], z );

		}

	}
	for ( let node = leaves - 1; node > 0; node -- ) {

		const offset = node * 6, left = node * 12, right = left + 6;
		for ( let axis = 0; axis < 3; axis ++ ) {

			bounds[ offset + axis ] = Math.min( bounds[ left + axis ], bounds[ right + axis ] );
			bounds[ offset + axis + 3 ] = Math.max( bounds[ left + axis + 3 ], bounds[ right + axis + 3 ] );

		}

	}
	const tree = { position, index, count, leaves, bounds, positionVersion, indexVersion };
	geometryBounds.set( geometry, tree );
	return tree;

}

function intersectsBounds( bounds, offset, origin, direction, distance ) {

	let near = .04, far = distance - .08;
	for ( let axis = 0; axis < 3; axis ++ ) {

		const o = axis === 0 ? origin.x : axis === 1 ? origin.y : origin.z;
		const d = axis === 0 ? direction.x : axis === 1 ? direction.y : direction.z;
		const min = bounds[ offset + axis ], max = bounds[ offset + axis + 3 ];
		if ( Math.abs( d ) < 1e-12 ) { if ( o < min || o > max ) return false; continue; }
		const a = ( min - o ) / d, b = ( max - o ) / d;
		near = Math.max( near, Math.min( a, b ) ); far = Math.min( far, Math.max( a, b ) );
		if ( near > far ) return false;

	}
	return true;

}

// Story installs while the loader is still visible. Prepare every opaque local
// geometry there, including hidden variants that may be shown later in a watch.
export function prepareObservationOcclusion( meshes ) {

	for ( const mesh of meshes ) {

		if ( ! mesh?.geometry?.getAttribute?.( 'position' ) || /glass|lens|flame/i.test( mesh.material?.name || mesh.name || '' ) ) continue;
		triangleBounds( mesh.geometry );

	}

}

export function opaqueSegmentBlocked( meshes, origin, target ) {

	const inverse = new Matrix4(), a = new Vector3(), b = new Vector3(), dir = new Vector3(), stack = [];
	for ( const mesh of meshes ) {

		if ( ! mesh.visible || ! mesh.geometry || /glass|lens|flame/i.test( mesh.material?.name || mesh.name || '' ) ) continue;
		let hidden = false;
		for ( let parent = mesh.parent; parent; parent = parent.parent ) if ( parent.visible === false ) { hidden = true; break; }
		if ( hidden ) continue;
		mesh.updateWorldMatrix?.( true, false );
		inverse.copy( mesh.matrixWorld ).invert();
		a.copy( origin ).applyMatrix4( inverse ); b.copy( target ).applyMatrix4( inverse );
		const distance = dir.subVectors( b, a ).length(); dir.normalize();
		const { position: pos, index: idx, count, leaves, bounds } = triangleBounds( mesh.geometry );
		stack.length = 0; stack.push( 1 );
		while ( stack.length ) {

			const node = stack.pop();
			if ( ! intersectsBounds( bounds, node * 6, a, dir, distance ) ) continue;
			if ( node < leaves ) { stack.push( node * 2, node * 2 + 1 ); continue; }
			const start = ( node - leaves ) * CHUNK_TRIANGLES * 3, end = Math.min( count, start + CHUNK_TRIANGLES * 3 );
			for ( let i = start; i < end; i += 3 ) {

				const ia = idx ? idx.getX( i ) : i, ib = idx ? idx.getX( i + 1 ) : i + 1, ic = idx ? idx.getX( i + 2 ) : i + 2;
				const ax = pos.getX( ia ), ay = pos.getY( ia ), az = pos.getZ( ia );
				const ex = pos.getX( ib ) - ax, ey = pos.getY( ib ) - ay, ez = pos.getZ( ib ) - az;
				const fx = pos.getX( ic ) - ax, fy = pos.getY( ic ) - ay, fz = pos.getZ( ic ) - az;
				const px = dir.y * fz - dir.z * fy, py = dir.z * fx - dir.x * fz, pz = dir.x * fy - dir.y * fx;
				const det = ex * px + ey * py + ez * pz;
				if ( Math.abs( det ) < 1e-9 ) continue;
				const tx = a.x - ax, ty = a.y - ay, tz = a.z - az;
				const u = ( tx * px + ty * py + tz * pz ) / det;
				if ( u < 0 || u > 1 ) continue;
				const qx = ty * ez - tz * ey, qy = tz * ex - tx * ez, qz = tx * ey - ty * ex;
				const v = ( dir.x * qx + dir.y * qy + dir.z * qz ) / det;
				if ( v < 0 || u + v > 1 ) continue;
				const t = ( fx * qx + fy * qy + fz * qz ) / det;
				if ( t > .04 && t < distance - .08 ) return true;

			}

		}

	}
	return false;

}
