import { Part } from '../village/GeoBuilder.js';
import { lin, HARD, WOOD } from '../Props.js';
import { STATION_CRAFT_MODEL } from './StationCraftModel.js';

// Blender-authored solids, stamped into the existing station material batches.
// Leaf origins and the game's walking/collision geometry are independent of this detail.
const FINISH = {
	paint: [ 'stationTimber', lin( 0x536151 ), WOOD( .74, .02, 1 ) ],
	panel: [ 'stationTimber', lin( 0x505d4e ), WOOD( .76, .02, 1 ) ],
	iron: [ 'hard', lin( 0x343c38 ), HARD( .57, .025, .65, .48 ) ],
	brass: [ 'hard', lin( 0xa38955 ), HARD( .45, .015, .85, .36 ) ],
	concrete: [ 'landingConcrete', lin( 0xaaa79e ), [ .73, 0, 0, 0 ] ],
};
const geometry = new Map();

export function stationCraft( B, name, x = 0, y = 0, z = 0, options = {} ) {
	for ( const [ finish, g ] of Object.entries( STATION_CRAFT_MODEL[ name ] ) ) {
		const id = name + '/' + finish;
		if ( ! geometry.has( id ) ) geometry.set( id, new Part( g.p, g.n, g.uv, g.idx ) );
		const [ material, tint, data ] = FINISH[ finish.split( '/' )[ 0 ] ];
		B.part( material, geometry.get( id ), x, y, z, { tint, data, ...options } );
	}
}

export function workingDoorHardware( B, width, height = 2.08, handleHeight = .98 ) {
	for ( const y of [ .25, height / 2, height - .25 ] ) stationCraft( B, 'doorHinge', 0, y );
	stationCraft( B, 'doorKnob', width - .105, handleHeight );
}

export function exteriorDoorFrame( B, x, floor, width, palette ) {
	const lining = { tint: palette.trim, data: WOOD( .46, .02, 1 ) };
	// The masonry opening is taller than its working leaf. A substantial timber
	// head fills that construction allowance instead of leaving an open dark gap.
	B.box( 'stationTimber', x, floor + 2.1915, -.18, width, .217, .22, { grain: 0, ...lining } );
	for ( const side of [ -1, 1 ] ) {
		B.box( 'stationTimber', x + side * ( width / 2 - .0165 ), floor + 1.04, -.18, .033, 2.08, .22, { grain: 1, ...lining } );
		B.box( 'stationTimber', x + side * .52, floor + 1.04, -.146, .044, 2.08, .018, { grain: 1, ...lining } );
	}
}

// Casing on both sides of the real partition. Linings and stops end above the
// existing floor; skirting returns stop at the jambs, leaving the door swing clear.
export function interiorDoorFrame( B, floor, z, palette ) {
	const casing = { tint: palette.trim, data: WOOD( .44, .02, 1 ) };
	for ( const side of [ -1, 1 ] ) {
		for ( const x of [ -2.8, -1.6 ] ) {
			B.box( 'stationTimber', x, floor + 1.08, z + side * .185, .09, 2.16, .05, { grain: 1, ...casing } );
			B.box( 'stationTimber', x, floor + 1.08, z + side * .214, .065, 2.16, .013, { grain: 1, ...casing } );
		}
		B.box( 'stationTimber', -2.2, floor + 2.18, z + side * .185, 1.4, .14, .05, { grain: 0, ...casing } );
		B.box( 'stationTimber', -2.2, floor + 2.18, z + side * .214, 1.37, .11, .013, { grain: 0, ...casing } );
		for ( const [ x, width ] of [ [ -4.1075, 2.525 ], [ -.1925, 2.725 ] ] ) {
			B.box( 'stationTimber', x, floor + .09, z + side * .174, width, .16, .04, { grain: 0, ...casing } );
			B.box( 'stationTimber', x, floor + .175, z + side * .174, width, .015, .045, { grain: 0, ...casing } );
		}
	}
	for ( const x of [ -2.79, -1.61 ] ) {
		B.box( 'stationTimber', x, floor + 1.067, z, .035, 2.134, .30, { grain: 1, ...casing } );
		B.box( 'stationTimber', x, floor + 1.05, z + .033, .055, 2.10, .018, { grain: 1, ...casing } );
	}
	B.box( 'stationTimber', -2.2, floor + 2.1165, z, 1.18, .067, .30, { grain: 0, ...casing } );
	B.box( 'stationTimber', -2.2, floor + 2.096, z + .033, 1.18, .025, .018, { grain: 0, ...casing } );
}
