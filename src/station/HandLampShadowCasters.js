import { BufferAttribute } from '../engine/geometry/BufferAttribute.js';
import { Matrix4, Vector3 } from '../engine/math/index.js';

const CHUNK = 128 * 3;
const _inverse = new Matrix4(), _local = new Vector3();

// Large station material batches span the entire compound. Trim their index
// lists to chunks near the flame, while retaining the original shared vertex
// buffers, material hooks and transforms. Sun/main draws keep their own indices.
export class HandLampShadowCasters {

	constructor() { this.bounds = new WeakMap(); this.selections = new WeakMap(); }

	_chunks( item ) {

		const mesh = item.object, g = item.geometry, p = g.attributes.position, index = g.index;
		if ( ! p || ! index || index.count < CHUNK * 8 || mesh.isInstancedMesh || mesh.isSkinnedMesh || g.indirect || ( g.instanceCount ?? 1 ) > 1 ) return null;
		let cached = this.bounds.get( index );
		if ( cached && cached.position === p && cached.positionVersion === p.version && cached.indexVersion === index.version && cached.count === index.count ) return cached;
		const chunks = Math.ceil( index.count / CHUNK ), bounds = new Float32Array( chunks * 6 );
		for ( let c = 0; c < chunks; c ++ ) {
			const o = c * 6;
			bounds[ o ] = bounds[ o + 1 ] = bounds[ o + 2 ] = Infinity;
			bounds[ o + 3 ] = bounds[ o + 4 ] = bounds[ o + 5 ] = -Infinity;
			for ( let i = c * CHUNK; i < Math.min( ( c + 1 ) * CHUNK, index.count ); i ++ ) {
				const v = index.getX( i ), x = p.getX( v ), y = p.getY( v ), z = p.getZ( v );
				bounds[ o ] = Math.min( bounds[ o ], x ); bounds[ o + 3 ] = Math.max( bounds[ o + 3 ], x );
				bounds[ o + 1 ] = Math.min( bounds[ o + 1 ], y ); bounds[ o + 4 ] = Math.max( bounds[ o + 4 ], y );
				bounds[ o + 2 ] = Math.min( bounds[ o + 2 ], z ); bounds[ o + 5 ] = Math.max( bounds[ o + 5 ], z );
			}
		}
		cached = { bounds, chunks, position: p, positionVersion: p.version, indexVersion: index.version, count: index.count };
		this.bounds.set( index, cached );
		return cached;

	}

	prepare( scene ) {

		scene.traverse( object => { if ( object.isMesh && object.castShadow ) this._chunks( { object, geometry: object.geometry } ); } );

	}

	select( item, position, range ) {

		const chunks = this._chunks( item );
		if ( ! chunks ) return item;
		const mesh = item.object, g = item.geometry;
		_inverse.copy( mesh.matrixWorld ).invert(); _local.copy( position ).applyMatrix4( _inverse );
		const e = mesh.matrixWorld.elements;
		const minScale = Math.min( Math.hypot( e[0],e[1],e[2] ), Math.hypot( e[4],e[5],e[6] ), Math.hypot( e[8],e[9],e[10] ) );
		const radius = range / Math.max( minScale, 1e-6 );
		let selections = this.selections.get( mesh );
		if ( ! selections ) { selections = new Map(); this.selections.set( mesh, selections ); }
		const key = `${item.start}|${item.count}`;
		let selection = selections.get( key );
		if ( ! selection ) {
			selection = { attribute: new BufferAttribute( new Uint32Array( 0 ), 1 ), center: new Vector3( Infinity, Infinity, Infinity ) };
			selections.set( key, selection );
		}
		if ( selection.chunks !== chunks || selection.radius !== radius || selection.center.distanceToSquared( _local ) > .16 ) {
			// The extra .6 m contains the entire light sphere throughout the .4 m
			// reuse interval, including modest vertex deformation at the boundary.
			const r2 = ( radius + .6 ) ** 2, spans = [], b = chunks.bounds;
			let count = 0;
			for ( let c = 0; c < chunks.chunks; c ++ ) {
				const start = Math.max( item.start, c * CHUNK ), end = Math.min( item.start + item.count, ( c + 1 ) * CHUNK, g.index.count );
				if ( end <= start ) continue;
				const o = c * 6;
				const x = Math.max( b[o] - _local.x, 0, _local.x - b[o+3] );
				const y = Math.max( b[o+1] - _local.y, 0, _local.y - b[o+4] );
				const z = Math.max( b[o+2] - _local.z, 0, _local.z - b[o+5] );
				if ( x*x + y*y + z*z <= r2 ) { spans.push( [start,end] ); count += end - start; }
			}
			const indices = new Uint32Array( count ); let offset = 0;
			for ( const [ start, end ] of spans ) {
				for ( let i = start; i < end; i ++ ) indices[ offset ++ ] = g.index.getX( i );
			}
			selection.attribute.array = indices; selection.attribute.count = indices.length; selection.attribute.needsUpdate = true;
			selection.center.copy( _local ); selection.radius = radius; selection.chunks = chunks;
		}
		return { ...item, indexOverride: selection.attribute, start: 0, count: selection.attribute.count };

	}

}
