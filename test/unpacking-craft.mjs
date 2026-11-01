import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { UNPACKING_CRAFT_MODEL as model } from '../src/world/flannan/UnpackingCraftModel.js';
import { unpackingCraft } from '../src/world/flannan/UnpackingCraft.js';
import { Builder } from '../src/world/village/GeoBuilder.js';
import { packModel } from '../tools/build/packed-models.mjs';
import { decodePackedModel } from '../src/world/flannan/PackedModels.js';

let triangles = 0;
for ( const [ name, finishes ] of Object.entries( model ) ) {

	for ( const g of Object.values( finishes ) ) {

		assert.equal( g.p.length, g.n.length, name + ' normals' );
		assert.equal( g.uv.length, g.p.length / 3 * 2, name + ' metre UVs' );
		assert.ok( [ ...g.p, ...g.n, ...g.uv ].every( Number.isFinite ), name );
		assert.ok( g.idx.every( i => Number.isInteger( i ) && i >= 0 && i < g.p.length / 3 ), name );
		for ( let i = 0; i < g.n.length; i += 3 ) assert.ok( Math.abs( Math.hypot( ...g.n.slice( i, i + 3 ) ) - 1 ) < .002, name + ' unit normal' );
		triangles += g.idx.length / 3;

	}
	const B = new Builder(); unpackingCraft( B, name );
	assert.deepEqual( Object.keys( B.batches ), [ 'hard' ], 'authored details reuse one existing station finish' );
	assert.ok( B.batches.hard.build().attributes.position.count > 0, name );

}
assert.ok( triangles < 32000, 'bounded six-prototype library' );
const bound = ( name, axis, min = true ) => ( min ? Math.min : Math.max )( ...Object.values( model[ name ] ).flatMap( g => g.p.filter( ( _, i ) => i % 3 === axis ) ) );
assert.ok( bound( 'closed', 1 ) >= 0 && bound( 'closed', 1, false ) < .43, 'holdall rests on the floor with a graspable handle' );
assert.ok( bound( 'open', 2 ) > -.27 && bound( 'open', 2, false ) < .27, 'opened flaps fit between the room floor and wall' );
assert.ok( model.closed.brass.idx.length > 0 && model.open.lining.idx.length > 0, 'separate working buckles and visible interior' );
assert.ok( model.clothes.stocking.idx.length > 0 && model.clothes.shirt.idx.length > 0, 'recognizable blue stockings and folded shirt' );
const packed = packModel( model ), buffer = packed.buffer.slice( packed.byteOffset, packed.byteOffset + packed.byteLength ), decoded = decodePackedModel( buffer );
for ( const [ name, finishes ] of Object.entries( model ) ) for ( const [ finish, g ] of Object.entries( finishes ) ) {

	assert.deepEqual( decoded[ name ][ finish ].p, new Float32Array( g.p ) );
	assert.deepEqual( decoded[ name ][ finish ].idx, new Uint32Array( g.idx ) );

}
console.log( `PASS six live-Blender unpacking prototypes; ${ triangles } library triangles; ${ gzipSync( packed ).byteLength } compressed bytes; finite indexed meshes, bounds, station batching and packed delivery.` );
