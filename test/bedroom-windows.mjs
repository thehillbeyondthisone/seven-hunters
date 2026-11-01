// Geometry-level regression: actual house window apertures transmit sight and
// sunlight, while original collision envelopes and bedroom routes remain intact.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Vector3 } from '../src/engine/math/index.js';
import { Builder } from '../src/world/village/GeoBuilder.js';
import { Colliders } from '../src/world/Colliders.js';
import { Rand, InstancedProps } from '../src/world/Props.js';
import { mulberry32 } from '../src/util/Noise.js';
import { loadFlannanData } from '../src/world/flannan/FlannanData.js';
import { FlannanTerrainData } from '../src/world/flannan/FlannanTerrain.js';
import { buildStation, TOWER } from '../src/world/flannan/Station.js';
import { ROOM_AIR_LAYOUT } from '../src/world/flannan/RoomAirLayout.js';
import { DAY_SIGNALS, buildDaySignals } from '../src/world/flannan/DaySignals.js';

const dataRoot = resolve( 'public/terrain/flannan' );
globalThis.fetch = async url => new Response( readFileSync( resolve( dataRoot, String( url ).replaceAll( '\\', '/' ).split( '/' ).pop() ) ) );
const data = await loadFlannanData( dataRoot + '/' );
const terrain = new FlannanTerrainData( data.grids.island );
const B = new Builder(), colliders = new Colliders(), lights = [];
const station = buildStation( { B, terrain, colliders, rand: new Rand( mulberry32( 90210 ) ), lights, inst: new InstancedProps( B ), checks: [] }, { buildings: [], footprints: [] } );

const sub = ( a, b ) => a.map( ( value, i ) => value - b[ i ] );
const dot = ( a, b ) => a.reduce( ( total, value, i ) => total + value * b[ i ], 0 );
const cross = ( a, b ) => [ a[ 1 ] * b[ 2 ] - a[ 2 ] * b[ 1 ], a[ 2 ] * b[ 0 ] - a[ 0 ] * b[ 2 ], a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ] ];
function hits( batch, origin, direction, limit ) {
	const vertex = i => batch.pos.slice( i * 3, i * 3 + 3 );
	for ( let i = 0; i < batch.idx.length; i += 3 ) {
		const a = vertex( batch.idx[ i ] ), b = vertex( batch.idx[ i + 1 ] ), c = vertex( batch.idx[ i + 2 ] );
		// A cheap segment bounds check keeps the full station test inexpensive.
		if ( a.some( ( _, axis ) => Math.max( a[ axis ], b[ axis ], c[ axis ] ) < Math.min( origin[ axis ], origin[ axis ] + direction[ axis ] * limit ) - 1e-6 || Math.min( a[ axis ], b[ axis ], c[ axis ] ) > Math.max( origin[ axis ], origin[ axis ] + direction[ axis ] * limit ) + 1e-6 ) ) continue;
		const ab = sub( b, a ), ac = sub( c, a ), p = cross( direction, ac ), determinant = dot( ab, p );
		if ( Math.abs( determinant ) < 1e-8 ) continue;
		const t = sub( origin, a ), u = dot( t, p ) / determinant;
		if ( u < -1e-7 || u > 1 + 1e-7 ) continue;
		const q = cross( t, ab ), v = dot( direction, q ) / determinant;
		if ( v < -1e-7 || u + v > 1 + 1e-7 ) continue;
		const distance = dot( ac, q ) / determinant;
		if ( distance > 1e-6 && distance < limit ) return true;
	}
	return false;
}
const opaque = Object.entries( B.batches ).filter( ( [ key ] ) => key !== 'glass' ).map( ( [ , batch ] ) => batch );
const windows = ROOM_AIR_LAYOUT.filter( room => room.id.endsWith( 'Bedroom' ) ).flatMap( room => room.windows );
assert.equal( windows.length, 5 );
for ( const window of windows ) {
	for ( const across of [ -.16, .16 ] ) for ( const above of [ -.34, .34 ] ) {
		const origin = window.center.map( ( value, i ) => value - window.normal[ i ] * .8 + window.right[ i ] * across + ( i === 1 ? above : 0 ) );
		assert.equal( opaque.some( batch => hits( batch, origin, window.normal, 1.0 ) ), false, window.id + ' has a clear real glazed aperture' );
	}
	const high = window.outerCenter.map( ( value, i ) => value - window.normal[ i ] * .9 + ( i === 1 ? 1.2 : 0 ) );
	assert.ok( hits( B.batches.stationMasonry, high, window.normal, 1.1 ), window.id + ' retains masonry above its reveal' );
	const origin = new Vector3( ...window.innerCenter ).addScaledVector( new Vector3( ...window.normal ), -.2 );
	assert.ok( colliders.raycast( origin, new Vector3( ...window.normal ), 1 ) < 1, window.id + ' keeps its original perimeter collision' );
}
assert.equal( colliders.boxes.filter( box => box.tag === 'bedroom-wall' ).length, 9, 'original exterior/partition collision boxes retained' );
assert.ok( station.parts.doors.some( door => door.name === 'bedrooms' ) );
assert.ok( station.parts.doors.some( door => door.name === 'spareBedroom' ) );

const signals = new Builder();
const metadata = buildDaySignals( signals, TOWER );
assert.equal( metadata.state, 'stowed' ); assert.equal( metadata.purpose, 'assistance' );
assert.equal( DAY_SIGNALS.angles.length, 2 );
assert.ok( metadata.at.distanceTo( new Vector3( Math.cos( 1.45 ) * 3.2, TOWER.deck + 1.62, Math.sin( 1.45 ) * 3.2 ) ) < 1.2, 'inspection is within normal gallery reach' );
let triangles = 0;
for ( const batch of Object.values( signals.batches ) ) {
	triangles += batch.triangles;
	for ( let i = 0; i < batch.pos.length; i += 3 ) {
		assert.ok( Number.isFinite( batch.pos[ i ] + batch.pos[ i + 1 ] + batch.pos[ i + 2 ] ) );
		assert.ok( Math.hypot( batch.pos[ i ], batch.pos[ i + 2 ] ) > 3.68, 'fittings stay at/outside the outer rail' );
	}
}
assert.ok( triangles < 3500, 'small static fittings use existing material batches' );
console.log( 'PASS five real bedroom openings, original perimeter collisions and doors, bounded stowed daylight assistance fittings (' + triangles + ' triangles).' );
