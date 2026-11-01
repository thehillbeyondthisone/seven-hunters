import assert from 'node:assert/strict';
import { Scene } from '../src/engine/index.js';
import { buildTurfShelter, turfShelterAt, acquireMaritimeTurf } from '../src/world/flannan/MaritimeTurf.js';
import { buildSwardMask, FlannanSward } from '../src/world/flannan/Sward.js';

const res = 128;
const terrain = {
	res, size: res, texel: 1, origin: -64,
	heights: new Float32Array( res * res ).fill( 40 ), rock: new Float32Array( res * res ),
	heightAt: () => 40, pathDistance: () => Infinity,
	normalAt: ( x, z, out ) => out.set( 0, 1, 0 ),
};
const flat = buildTurfShelter( terrain );
assert.ok( flat.data.every( v => v === 0 ), 'flat unobstructed terrain has no invented shelter' );
assert.deepEqual( flat.data, buildTurfShelter( terrain ).data, 'repeatable terrain exposure' );
const wall = { center: { x: 0, y: 42, z: 0 }, half: { x: .3, y: 2, z: 16 }, tag: 'wall', solid: true };
const walls = buildTurfShelter( terrain, { boxes: [ wall ] } );
const east = turfShelterAt( walls, 6, 2 ), west = turfShelterAt( walls, -6, 2 );
assert.ok( east.channels[ 1 ] > .7 && east.channels[ 0 ] === 0, 'east of wall is sheltered only from the west' );
assert.ok( west.channels[ 0 ] > .7 && west.channels[ 1 ] === 0, 'west of wall is sheltered only from the east' );
assert.ok( turfShelterAt( walls, 30, 2 ).growth === 0, 'wall shelter has bounded reach' );
assert.ok( turfShelterAt( walls, 7.9, 2 ).growth >= 0 && turfShelterAt( walls, 7.9, 2 ).growth <= 1, 'filtered exposure stays bounded' );
for ( const tag of [ 'furniture', 'floor', 'door', 'gate' ] ) {
	assert.deepEqual( buildTurfShelter( terrain, { boxes: [ { ...wall, tag } ] } ).data, flat.data, `${ tag } does not invent a windbreak` );
}
const hill = buildTurfShelter( { ...terrain, heightAt: ( x, z ) => x > 0 ? 44 : 40 } );
assert.ok( turfShelterAt( hill, -6, 2 ).channels[ 0 ] > .7, 'real rising terrain provides directional shelter' );
assert.ok( turfShelterAt( hill, 6, 2 ).channels[ 1 ] === 0, 'falling terrain does not shelter the exposed brow' );

// Compare the same roots/noise/slope. Wear and exposure may only reduce density.
const openMask = buildSwardMask( terrain, [], 1901, flat );
const wornMask = buildSwardMask( { ...terrain, pathDistance: () => 1.25 }, [], 1901, flat );
const closedMask = buildSwardMask( { ...terrain, pathDistance: () => 1.04 }, [], 1901, flat );
assert.ok( closedMask.every( v => v === 0 ), 'the original 1.05 m path margin is preserved' );
assert.ok( wornMask.some( v => v > 0 ), 'feathered edge has surviving short turf' );
for ( let i = 0; i < openMask.length; i ++ ) assert.ok( wornMask[ i ] <= openMask[ i ], 'wear never increases blade density' );
const shelteredMask = buildSwardMask( terrain, [], 1901, { ...flat, data: new Uint8Array( flat.data.length ).fill( 255 ) } );
assert.ok( shelteredMask.some( ( v, i ) => v > openMask[ i ] ), 'sheltered patches retain fuller growth than exposed ground' );
assert.ok( Math.max( ...shelteredMask ) < 240, 'growth remains within the original nominal density ceiling' );

const field = acquireMaritimeTurf( terrain, { boxes: [ wall ] } );
const second = acquireMaritimeTurf( terrain );
assert.equal( second, field, 'ground and blades reuse the same field and texture' );
assert.equal( field.refs, 2 );
second.release(); assert.equal( field.refs, 1 );
field.release(); assert.equal( field.refs, 0 );
const renewed = acquireMaritimeTurf( terrain );
assert.notEqual( renewed, field, 'released fields can be built again without a stale destroyed texture' );
renewed.release();
const scene = new Scene(), sward = new FlannanSward( { scene, terrain, village: { getFootprints: () => [], colliders: { boxes: [ wall ] } } } );
assert.ok( sward.material.modules[ 0 ].deps.includes( sward.turf.module ), 'blade material consumes the shared ground palette and shelter module' );
sward.dispose(); assert.equal( sward.turf.refs, 0 );
console.log( 'PASS maritime turf: directional terrain/wall shelter, bounded footprint, ignored non-walls, filtered sampling, worn-edge margins/density and shared resource lifetime.' );
