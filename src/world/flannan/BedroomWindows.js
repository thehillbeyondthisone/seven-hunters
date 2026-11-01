import { lin, WOOD } from '../Props.js';

// The playable bedrooms are reconstructed. These are the existing house shell's
// openings, not new windows added to the station elevations.
export const BEDROOMS = [
	{ id: 'eastBedroom', x0: -15, x1: -9.6, z0: -1.2, z1: 5.4 },
	{ id: 'westBedroom', x0: -21.4, x1: -15.6, z0: -1.2, z1: 5.4 },
];
export const BEDROOM_WINDOWS = [
	{ id: 'eastBedroomNorthEast', room: 'eastBedroom', a: [ -2.6, -1.8 ], b: [ -22, -1.8 ], at: 7.9 },
	{ id: 'eastBedroomNorthWest', room: 'eastBedroom', a: [ -2.6, -1.8 ], b: [ -22, -1.8 ], at: 11.9 },
	{ id: 'westBedroomWestNorth', room: 'westBedroom', a: [ -22, -1.8 ], b: [ -22, 6 ], at: 2.2 },
	{ id: 'westBedroomWestSouth', room: 'westBedroom', a: [ -22, -1.8 ], b: [ -22, 6 ], at: 5.6 },
	{ id: 'westBedroomSouth', room: 'westBedroom', a: [ -22, 6 ], b: [ -6, 6 ], at: 3.6 },
];

// The shell supplies deep stone reveals and complete sashes. Interior casings
// stop outside those rough openings; another window or masonry box would block
// the existing glass or create coincident surfaces.
export function bedroomWindowLinings( B, floor ) {
	const paint = { tint: lin( 0xe8e2d4 ), data: WOOD( .61, .018, 1 ) };
	for ( const window of BEDROOM_WINDOWS ) {
		const dx = window.b[ 0 ] - window.a[ 0 ], dz = window.b[ 1 ] - window.a[ 1 ];
		const length = Math.hypot( dx, dz );
		B.pushAt( window.a[ 0 ] + dx / length * window.at, 0, window.a[ 1 ] + dz / length * window.at, Math.atan2( -dz, dx ) );
		for ( const side of [ -1, 1 ] ) B.box( 'stationTimber', side * .467, floor + 1.665, -.614, .054, 2.03, .028, { grain: 1, ...paint } );
		B.box( 'stationTimber', 0, floor + 2.68, -.614, 1.0, .06, .028, { grain: 0, ...paint } );
		B.box( 'stationTimber', 0, floor + .655, -.38, 1.04, .04, .62, { grain: 0, ...paint } );
		B.box( 'stationTimber', 0, floor + .596, -.614, .96, .078, .028, { grain: 0, ...paint } );
		B.pop();
	}
}
