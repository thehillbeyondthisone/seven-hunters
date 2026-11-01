import { ROOM, TOWER } from './Station.js';
import { KITCHEN, BERTH } from './NextRooms.js';
import { BEDROOMS, BEDROOM_WINDOWS } from './BedroomWindows.js';

// Optical volumes for the existing playable reconstruction, not an archival
// room plan. Coordinates follow Station.js: +x east, +z south, metres.
// Keep this small: each active room is marched in one localized screen region.
// Bounds stop at inside wall faces and below the existing timber ceilings.
const FLOOR = TOWER.floor;
const CEILING = ROOM.ceiling - .05;
const WALL_THICKNESS = .6;

// Reconstruct stationWall's default opening and its windowUnit call:
//   rough opening: floor+.68 .. floor+2.65, width .88
//   windowUnit: sill=opening bottom+.02, ww=opening width-.16,
//               wh=opening height-.2, at wall-local z=-.14
// windowUnit's sash consumes .05 at each side and .06 at top/bottom.
const ROUGH_WIDTH = .88;
const ROUGH_BOTTOM = FLOOR + .68;
const ROUGH_TOP = FLOOR + 2.65;
const SASH_WIDTH = ROUGH_WIDTH - .16;
const SASH_HEIGHT = ROUGH_TOP - ROUGH_BOTTOM - .2;
const SASH_BOTTOM = ROUGH_BOTTOM + .02;
const GLASS_INSET = .14 - .004;

function windowAperture( id, a, b, at ) {

	// This is Station.js wallFrame: wall-local +x travels a -> b, +z
	// faces outside. stationWall's masonry occupies local z=-.6 .. 0.
	const length = Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
	const right = [ ( b[ 0 ] - a[ 0 ] ) / length, 0, ( b[ 1 ] - a[ 1 ] ) / length ];
	const normal = [ -right[ 2 ], 0, right[ 0 ] ];
	const x = a[ 0 ] + right[ 0 ] * at, z = a[ 1 ] + right[ 2 ] * at;
	const outerCenter = [ x, ( ROUGH_BOTTOM + ROUGH_TOP ) / 2, z ];
	const innerCenter = outerCenter.map( ( v, i ) => v - normal[ i ] * WALL_THICKNESS );
	return {
		id,
		center: [ x - normal[ 0 ] * GLASS_INSET, SASH_BOTTOM + SASH_HEIGHT / 2, z - normal[ 2 ] * GLASS_INSET ],
		normal, right,
		halfWidth: ( SASH_WIDTH - .1 ) / 2,
		halfHeight: ( SASH_HEIGHT - .12 ) / 2,
		mullionWidth: .022,
		muntinHeight: .045,
		// Artistic scattering transmission through the existing glass. This
		// is deliberately separate from the architectural clear dimensions.
		transmission: .78,
		edgeFade: .035,
		outerCenter, innerCenter,
		openingHalfWidth: ROUGH_WIDTH / 2,
		openingHalfHeight: ( ROUGH_TOP - ROUGH_BOTTOM ) / 2,
		wallThickness: WALL_THICKNESS,
		glassInset: GLASS_INSET,
	};

}

function roomVolume( id, bounds, windows, extra = {} ) {
	return {
		id,
		min: [ bounds.x0, FLOOR + .02, bounds.z0 ],
		max: [ bounds.x1, CEILING, bounds.z1 ],
		windows,
		...extra,
	};
}

export const ROOM_AIR_LAYOUT = [
	roomVolume( 'keepersRoom', ROOM, [
		windowAperture( 'keepersNorth', [ -2.6, -1.8 ], [ -22, -1.8 ], 3.9 ),
	], {
		// rectAroundTower removes the tower from this rectangular room. Use
		// the outer radius at floor level so haze cannot appear in its masonry.
		excludeCylinder: { center: [ 0, 0 ], radius: 3.3 },
	} ),
	roomVolume( 'kitchen', KITCHEN, [
		windowAperture( 'kitchenEast', [ 1.8, 15 ], [ 1.8, 2.6 ], 5.4 ),
	] ),
	roomVolume( 'berth', BERTH, [
		windowAperture( 'berthEast', [ 1.8, 15 ], [ 1.8, 2.6 ], 2.0 ),
		windowAperture( 'berthWest', [ -6, 6 ], [ -6, 15 ], 6.0 ),
		windowAperture( 'berthSouthWest', [ -6, 15 ], [ 1.8, 15 ], 1.35 ),
		windowAperture( 'berthSouth', [ -6, 15 ], [ 1.8, 15 ], 3.9 ),
		windowAperture( 'berthSouthEast', [ -6, 15 ], [ 1.8, 15 ], 6.45 ),
	] ),
	...BEDROOMS.map( room => roomVolume( room.id, room, BEDROOM_WINDOWS
		.filter( window => window.room === room.id )
		.map( window => windowAperture( window.id, window.a, window.b, window.at ) ) ) ),
];

// The keepers' room's north window only admits direct northern sunlight; the
// winter midday/afternoon sun shines into the berth's south/west windows.
// The east bedroom has northern light. The west bedroom's existing south and
// west windows admit winter noon and grazing afternoon sun through deep reveals.
