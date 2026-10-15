import assert from 'node:assert/strict';
import { SWARD, QUEST_SWARD, swardRoots, swardPatch, buildSwardMask, FlannanSward } from '../src/world/flannan/Sward.js';
import { Scene, PerspectiveCamera } from '../src/engine/index.js';

const roots = swardRoots();
assert.deepEqual( roots, swardRoots(), 'repeatable scene dressing' );
assert.notDeepEqual( roots[ 0 ], swardRoots( 7 )[ 0 ], 'seed changes the distribution' );
for ( const r of roots ) {
	assert( r.x >= 0 && r.x < SWARD.cell && r.z >= 0 && r.z < SWARD.cell );
	assert( r.height >= SWARD.minHeight && r.height <= SWARD.maxHeight );
}
const patches = SWARD.counts.map( ( _, l ) => swardPatch( roots, l ) );
for ( const [ l, g ] of patches.entries() ) {
	assert.equal( g.index.count / 3, SWARD.counts[ l ] * ( SWARD.segments[ l ] * 2 - 1 ) );
	assert( Math.max( ...g.index.array.subarray( g.index.count - 15 ) ) < g.attributes.position.count );
	for ( const attr of Object.values( g.attributes ) ) assert( attr.array.every( Number.isFinite ) );
	for ( let i = 0; i < SWARD.counts[ l ]; i += 97 ) {
		const o = i * ( SWARD.segments[ l ] * 2 + 1 ) * 4;
		assert( Math.abs( g.attributes.aRoot.array[ o ] - roots[ i ].x ) < 1e-6, 'LOD keeps identical rooted blades' );
		assert( Math.abs( g.attributes.aRoot.array[ o + 3 ] - ( i + .5 ) / roots.length ) < 1e-7 );
	}
}

// Deliberate strips exercise each real exclusion independently, plus an open flat meadow.
const res = 128, terrain = {
	res, size: res, texel: 1, origin: -64, heights: new Float32Array( res * res ).fill( 40 ),
	rock: new Float32Array( res * res ), pathDistance: ( x, z ) => Math.abs( z ) - 1,
	normalAt: ( x, z, out ) => out.set( 0, x > 45 ? .7 : 1, 0 ),
};
for ( let j = 0; j < res; j ++ ) for ( let i = 0; i < res; i ++ ) {
	if ( i < 12 ) terrain.heights[ j * res + i ] = -2;
	if ( i >= 12 && i < 24 ) terrain.rock[ j * res + i ] = .8;
}
const foot = [ { x: 12, z: 14, r: 5 } ], mask = buildSwardMask( terrain, foot );
let covered = 0;
for ( let j = 0; j < res; j ++ ) for ( let i = 0; i < res; i ++ ) {
	if ( ! mask[ j * res + i ] ) continue; covered ++;
	const x = i - 63.5, z = j - 63.5;
	assert( i >= 24 && x <= 45 && Math.abs( z ) >= 2.05 );
	assert( Math.hypot( x - 12, z - 14 ) >= 6.05 );
}
assert( covered > 5000, 'open maritime turf remains populated' );
const scene = new Scene(), sward = new FlannanSward( { scene, terrain, village: { getFootprints: () => foot } } );
const cam = new PerspectiveCamera( 75, 1.6, .1, 500 );
for ( let x = -80; x <= 80; x += 3.7 ) {
	cam.position.set( x, 41.62, 20 ); cam.lookAt( x + 8, 40, 5 ); cam.updateMatrixWorld();
	sward.update( cam );
	assert( sward.levels.every( l => l.count <= l.max && l.geometry.instanceCount === l.count ) );
	const cells = sward.levels.flatMap( l => Array.from( { length: l.count }, ( _, i ) => `${l.arr[i*4]},${l.arr[i*4+1]}` ) );
	assert.equal( new Set( cells ).size, cells.length, 'one LOD per cell, no duplicate grass' );
}
cam.position.set( 500, 40, 500 ); cam.updateMatrixWorld(); sward.update( cam );
assert.equal( sward.triangles, 0, 'out-of-domain camera submits no grass' );
sward.dispose(); assert.equal( scene.children.length, 0 );

// Quest uses the same seeded roots, exclusion mask and world scale. It reduces
// submitted geometry, rather than merely hiding desktop blades in the shader.
const quest = new FlannanSward( { scene, terrain, village: { getFootprints: () => foot }, profile: QUEST_SWARD } );
assert.deepEqual( quest.mask, mask );
for ( const [ level, l ] of quest.levels.entries() ) {
	assert.equal( l.geometry.index.count / 3, QUEST_SWARD.counts[ level ] * ( QUEST_SWARD.segments[ level ] * 2 - 1 ) );
	assert.ok( l.geometry.index.count < patches[ level ].index.count * .13 );
	for ( let i = 0; i < QUEST_SWARD.counts[ level ]; i += 97 ) {
		const o = i * ( QUEST_SWARD.segments[ level ] * 2 + 1 ) * 4;
		assert.ok( Math.abs( l.geometry.attributes.aRoot.array[ o ] - roots[ i ].x ) < 1e-6 );
	}
}
cam.position.set( 0, 41.62, 20 ); cam.lookAt( 8, 40, 5 ); cam.updateMatrixWorld(); quest.update( cam );
assert.ok( quest.triangles > 0 );
assert.ok( quest.levels.every( l => l.count <= l.max ) );
quest.dispose();
console.log( 'Flannan sward: seeded roots, LOD prefixes/indices, height range, sea/rock/slope/path/building exclusions, camera traversal and disposal passed.' );
