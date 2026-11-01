import assert from 'node:assert/strict';
import { ROOM_AIR_LAYOUT } from '../src/world/flannan/RoomAirLayout.js';
import { ROOM, TOWER } from '../src/world/flannan/Station.js';
import { KITCHEN, BERTH } from '../src/world/flannan/NextRooms.js';
import { BEDROOMS } from '../src/world/flannan/BedroomWindows.js';
import { windowUnit } from '../src/world/village/Buildings.js';

const near = ( actual, expected, label ) => assert.ok( Math.abs( actual - expected ) < 1e-8, `${ label }: ${ actual } != ${ expected }` );
const dot = ( a, b ) => a.reduce( ( sum, v, i ) => sum + v * b[ i ], 0 );
const subtract = ( a, b ) => a.map( ( v, i ) => v - b[ i ] );
assert.equal( ROOM_AIR_LAYOUT.length, 5 );
for ( const [ i, bounds ] of [ ROOM, KITCHEN, BERTH, ...BEDROOMS ].entries() ) {
	const room = ROOM_AIR_LAYOUT[ i ];
	assert.deepEqual( [ room.min[ 0 ], room.min[ 2 ], room.max[ 0 ], room.max[ 2 ] ], [ bounds.x0, bounds.z0, bounds.x1, bounds.z1 ], 'air stays inside the existing playable room faces' );
	assert.ok( room.min[ 1 ] > TOWER.floor && room.max[ 1 ] < ROOM.ceiling );
	assert.ok( room.windows.length > 0 && room.windows.length <= 6 );
}

// Compare aperture metadata to actual shared joinery geometry, rather than
// checking only duplicated aperture numbers. No renderer or GPU is needed.
const boxes = [], parts = [];
const B = {
	box: ( material, x, y, z, width, height, depth ) => boxes.push( { material, x, y, z, width, height, depth } ),
	part: ( material, geometry, x, y, z ) => parts.push( { material, geometry, x, y, z } ),
};
const floor = TOWER.floor;
const openingBottom = floor + .68, openingTop = floor + 2.65;
const ww = .88 - .16, wh = openingTop - openingBottom - .2;
windowUnit( B, { next: () => .5, chance: () => false }, 0, openingBottom + .02, ww, wh,
	{ trim: [ 1, 1, 1 ], trimPaint: 1, weather: 0, curtain: [ 1, 1, 1 ] } );
const sides = boxes.filter( b => Math.abs( b.width - .05 ) < 1e-8 && Math.abs( b.height - wh ) < 1e-8 );
const topAndBottom = boxes.filter( b => Math.abs( b.width - ww ) < 1e-8 && Math.abs( b.height - .06 ) < 1e-8 );
const mullion = boxes.find( b => Math.abs( b.width - .022 ) < 1e-8 );
const horizontal = boxes.find( b => Math.abs( b.height - .045 ) < 1e-8 );
const glass = parts.find( p => p.material === 'glass' );
assert.equal( sides.length, 2 ); assert.equal( topAndBottom.length, 2 );
const minX = Math.min( ...sides.map( b => b.x ) ) + sides[ 0 ].width / 2;
const maxX = Math.max( ...sides.map( b => b.x ) ) - sides[ 0 ].width / 2;
const minY = Math.min( ...topAndBottom.map( b => b.y ) ) + topAndBottom[ 0 ].height / 2;
const maxY = Math.max( ...topAndBottom.map( b => b.y ) ) - topAndBottom[ 0 ].height / 2;

for ( const room of ROOM_AIR_LAYOUT ) for ( const window of room.windows ) {
	near( dot( window.normal, window.right ), 0, 'normal and tangent are perpendicular' );
	near( dot( window.normal, window.normal ), 1, 'outward normal has unit length' );
	near( dot( window.right, window.right ), 1, 'wall travel tangent has unit length' );
	near( window.halfWidth, ( maxX - minX ) / 2, 'shaft fits between real sash sides' );
	near( window.halfHeight, ( maxY - minY ) / 2, 'shaft fits between real sash top and bottom' );
	near( window.center[ 1 ], ( minY + maxY ) / 2, 'shaft is vertically centered in the clear sash' );
	near( window.mullionWidth, mullion.width, 'central muntin blocks its real width' );
	near( window.muntinHeight, horizontal.height, 'meeting rail blocks its real height' );
	near( dot( subtract( window.outerCenter, window.center ), window.normal ), .14 - glass.z, 'aperture lies on the actual inset glass plane' );
	near( dot( subtract( window.outerCenter, window.innerCenter ), window.normal ), .6, 'both ends of the thick stone reveal are represented' );
	assert.ok( window.center[ 1 ] - window.halfHeight > room.min[ 1 ] );
	assert.ok( window.center[ 1 ] + window.halfHeight < room.max[ 1 ] );
}

const byId = Object.fromEntries( ROOM_AIR_LAYOUT.map( room => [ room.id, room ] ) );
const facing = ( room, sun ) => byId[ room ].windows.filter( window => dot( sun, window.normal ) > 0 ).map( window => window.id );
assert.deepEqual( facing( 'keepersRoom', [ 0, .5, 1 ] ), [], 'winter southern sun cannot manufacture a north-window shaft' );
assert.deepEqual( facing( 'keepersRoom', [ 0, .5, -1 ] ), [ 'keepersNorth' ] );
assert.deepEqual( facing( 'kitchen', [ 1, .5, 0 ] ), [ 'kitchenEast' ] );
assert.deepEqual( facing( 'kitchen', [ -1, .5, 0 ] ), [] );
assert.equal( facing( 'berth', [ 0, .5, 1 ] ).length, 3, 'three real south windows catch midday light' );
assert.deepEqual( facing( 'berth', [ -1, .5, 0 ] ), [ 'berthWest' ], 'west window catches afternoon light' );
assert.deepEqual( byId.keepersRoom.excludeCylinder, { center: [ 0, 0 ], radius: 3.3 }, 'tower masonry is excluded from the main-room air volume' );

const expectedCenters = [ [ -6.5, -1.8 ], [ 1.8, 9.6 ], [ 1.8, 13 ], [ -6, 12 ], [ -4.65, 15 ], [ -2.1, 15 ], [ .45, 15 ], [ -10.5, -1.8 ], [ -14.5, -1.8 ], [ -22, .4 ], [ -22, 3.8 ], [ -18.4, 6 ] ];
for ( const [ i, window ] of ROOM_AIR_LAYOUT.flatMap( room => room.windows ).entries() ) {
	near( window.outerCenter[ 0 ], expectedCenters[ i ][ 0 ], 'opening follows the constructed wall travel in x' );
	near( window.outerCenter[ 2 ], expectedCenters[ i ][ 1 ], 'opening follows the constructed wall travel in z' );
}
assert.equal( ROOM_AIR_LAYOUT.flatMap( room => room.windows ).length, 12, 'all twelve real apertures are represented' );
assert.deepEqual( facing( 'eastBedroom', [ 0, .5, 1 ] ), [], 'north-facing bedroom cannot invent noon shafts' );
assert.deepEqual( facing( 'westBedroom', [ 0, .5, 1 ] ), [ 'westBedroomSouth' ], 'restored south opening admits winter noon light' );
assert.equal( facing( 'westBedroom', [ -1, .5, 0 ] ).length, 2, 'both west openings receive grazing afternoon light' );
console.log( 'Room-air layout: actual sash clearances, wall reveals, room bounds and sun-facing apertures verified.' );
