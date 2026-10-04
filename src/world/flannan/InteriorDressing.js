import { Color, Vector3 } from '../../engine/index.js';
import { lin, WOOD, HARD, lantern } from '../Props.js';

// A standing paraffin lamp. y is the table/shelf, unlike Props.lantern's
// hanging point. Keep the source aligned with the flame in the chimney.
export function deskOilLamp( B, x, y, z, seed = 0.5 ) {

	const metal = { tint: lin( 0x947348 ), data: HARD( seed, 0.01, 0.7, 0.4 ) };
	B.lathe( 'hard', x, y, z, [ [ 0, 0 ], [ 0.082, 0 ], [ 0.095, 0.018 ], [ 0.088, 0.065 ], [ 0.036, 0.084 ], [ 0.025, 0.10 ], [ 0, 0.10 ] ], { segs: 20, ...metal } );
	B.cyl( 'hard', x, y + 0.095, z, 0.027, 0.032, 0.019, { segs: 14, ...metal } );
	B.lathe( 'glass', x, y + 0.107, z, [ [ 0.032, 0 ], [ 0.047, 0.037 ], [ 0.045, 0.095 ], [ 0.025, 0.16 ], [ 0.026, 0.23 ] ], { segs: 20, tint: lin( 0xe5cc9a ), data: [ seed, 1, 1, 0 ] } );
	B.rod( 'hard', [ x + 0.025, y + 0.1, z ], [ x + 0.046, y + 0.1, z ], 0.004, 0.007, { segs: 6, ...metal } );
	return new Vector3( x, y + 0.15, z );

}

// Period-plausible furnishings, kept in the existing workroom. These are
// reconstruction choices, not a recovered inventory of the missing keepers.
export function dressKeepersRoom( ctx, room, floor ) {

	const { B, colliders, lights } = ctx, F = floor, R = room;
	const oak = { tint: lin( 0x74593d ), data: WOOD( 0.67, 0.18, 0, 0 ) };
	const darkOak = { tint: lin( 0x514634 ), data: WOOD( 0.72, 0.1, 0, 0 ) };
	const tin = { tint: lin( 0x66665f ), data: HARD( 0.34, 0.04, 0.65, 0.54 ) };
	const iron = { tint: lin( 0x303632 ), data: HARD( 0.64, 0.04, 0.6, 0.58 ) };
	const linen = { tint: lin( 0xc8bea1 ), data: HARD( 0.48, 0, 0, 0.94 ) };
	const cream = { tint: lin( 0xd8d1ba ), data: HARD( 0.23, 0, 0, 0.34 ) };
	const blue = { tint: lin( 0x40595e ), data: HARD( 0.25, 0, 0, 0.37 ) };
	const brass = { tint: lin( 0xa48247 ), data: HARD( 0.45, 0, 0.85, 0.4 ) };
	const cup = ( x, y, z, color = cream ) => {

		B.lathe( 'hard', x, y, z, [ [ 0.03, 0 ], [ 0.038, 0.006 ], [ 0.038, 0.08 ], [ 0.032, 0.08 ], [ 0.03, 0.012 ] ], { segs: 16, ...color } );
		B.torus( 'hard', x + 0.047, y + 0.044, z, 0.024, 0.005, { ry: Math.PI / 2, radial: 5, tubular: 14, ...color } );

	};
	const plate = ( x, y, z ) => B.lathe( 'hard', x, y, z, [ [ 0, 0 ], [ 0.06, 0 ], [ 0.098, 0.018 ], [ 0.103, 0.023 ], [ 0.092, 0.027 ], [ 0.055, 0.01 ], [ 0, 0.01 ] ], { segs: 20, ...cream } );

	// Skirting and picture rail give the plaster a human scale. Keep every door
	// and the tower threshold clear; furniture colliders stay against the walls.
	for ( const y of [ F + 0.11, F + 2.8 ] ) {

		B.box( 'stationTimber', - 5.9, y, R.z0 + 0.026, 6.15, y < F + 1 ? 0.2 : 0.045, 0.05, darkOak );
		B.box( 'stationTimber', - 7.3, y, R.z1 - 0.026, 3.3, y < F + 1 ? 0.2 : 0.045, 0.05, darkOak );
		for ( const [ z, depth ] of [ [ 0.6, 3.4 ], [ 4.6, 1.5 ] ] ) B.box( 'stationTimber', R.x0 + 0.026, y, z, 0.05, y < F + 1 ? 0.2 : 0.045, depth, darkOak );

	}
	// Narrow, gathered curtains beside the two real windows; they leave the
	// daylight aperture and the desk's interaction targets uncovered.
	for ( const [ x, z ] of [ [ - 6.5, R.z0 + 0.13 ], [ - 7.6, R.z1 - 0.13 ] ] ) {

		B.rod( 'stationTimber', [ x - 0.85, F + 2.67, z ], [ x + 0.85, F + 2.67, z ], 0.018, 0.018, { segs: 6, ...darkOak } );
		for ( const side of [ - 1, 1 ] ) for ( let fold = 0; fold < 5; fold ++ ) B.cyl( 'hard', x + side * 0.62 + fold * 0.028, F + 1.13, z + Math.sin( fold * 2 ) * 0.012, 0.032, 0.034, 1.49, { segs: 7, ...linen } );

	}

	// Dresser near the west wall, north of the bedroom door: storage, crockery,
	// labelled-by-shape tins and a brown glass bottle, all merged into existing draws.
	const cx = - 8.64, cz = 0.45;
	B.box( 'stationTimber', cx, F + 0.46, cz, 0.56, 0.84, 1.65, oak );
	B.box( 'stationTimber', cx + 0.02, F + 0.89, cz, 0.64, 0.06, 1.75, oak );
	for ( const z of [ cz - 0.4, cz + 0.4 ] ) {

		B.box( 'stationTimber', cx + 0.295, F + 0.48, z, 0.023, 0.66, 0.72, darkOak );
		B.cyl( 'hard', cx + 0.322, F + 0.52, z + 0.23, 0.016, 0.016, 0.018, { rz: Math.PI / 2, segs: 8, ...brass } );

	}
	for ( const y of [ 1.26, 1.78, 2.27 ] ) {

		B.box( 'stationTimber', cx - 0.1, F + y, cz, 0.38, 0.035, 1.62, oak );
		B.box( 'stationTimber', cx - 0.27, F + y + 0.04, cz, 0.04, 0.12, 1.7, darkOak );
		for ( let i = 0; i < 4; i ++ ) cup( cx - 0.06, F + y + 0.02, cz - 0.52 + i * 0.32, i % 2 ? blue : cream );

	}
	for ( const z of [ cz - 0.8, cz + 0.8 ] ) B.box( 'stationTimber', cx - 0.25, F + 1.62, z, 0.07, 1.44, 0.07, oak );
	plate( cx + 0.13, F + 0.94, cz );
	B.lathe( 'hard', cx + 0.06, F + 0.94, cz + 0.54, [ [ 0.05, 0 ], [ 0.06, 0.03 ], [ 0.06, 0.2 ], [ 0.022, 0.23 ], [ 0.022, 0.3 ], [ 0, 0.3 ] ], { segs: 14, tint: lin( 0x514f32 ), data: HARD( 0.62, 0, 0, 0.13 ) } );
	colliders.addBox( new Vector3( cx, F + 0.47, cz ), new Vector3( 0.33, 0.47, 0.9 ), 0, { tag: 'furniture' } );

	// The table: one used place, two cups set aside. A folded wool blanket and
	// biscuit tin suggest a long watch without inventing new story evidence.
	B.pushAt( - 5.4, F + 0.745, 3.3, 0.1 );
	plate( - 0.26, 0, 0.02 );
	cup( 0.02, 0.005, - 0.17 );
	cup( - 0.48, 0.005, - 0.15, blue );
	B.cyl( 'hard', 0.48, 0.008, 0.08, 0.09, 0.09, 0.055, { segs: 16, ...tin } );
	B.box( 'hard', 0.34, 0.018, - 0.12, 0.28, 0.03, 0.27, linen );
	B.rod( 'hard', [ - 0.13, 0.018, 0.12 ], [ - 0.02, 0.018, 0.18 ], 0.004, 0.006, { segs: 5, ...tin } );
	B.pop();
	// Hanging table lamp: its light falls on the table and dresser rather than
	// just the walls. The stem runs up to a small ceiling rose.
	B.rod( 'hard', [ - 5.4, F + 2.45, 3.3 ], [ - 5.4, R.ceiling - 0.03, 3.3 ], 0.008, 0.008, { segs: 6, ...iron } );
	B.cyl( 'hard', - 5.4, R.ceiling - 0.05, 3.3, 0.07, 0.07, 0.035, { segs: 16, ...iron } );
	const hanging = lantern( B, - 5.4, F + 2.45, 3.3, 0.52, 0.84 );
	lights.push( { position: new Vector3( ...hanging ), color: new Color( 1.0, 0.73, 0.47 ), intensity: 8, range: 6.2, kind: 'lamp', flicker: 0.025 } );
	B.box( 'hard', - 6.39, F + 0.5, 2.66, 0.38, 0.045, 0.29, { ry: 1.88, tint: lin( 0x596352 ), data: HARD( 0.59, 0, 0, 0.96 ) } );

	// Cold stove, kettle and coal scuttle: preserve the existing story's cold
	// stove, with no flame or new interaction. A hearth protects the timber floor.
	B.box( 'hard', - 8.52, F + 0.015, 3.9, 1.02, 0.03, 1.02, { tint: lin( 0x555957 ), data: HARD( 0.75, 0, 0, 0.9 ) } );
	B.lathe( 'hard', - 8.6, F + 0.9, 3.97, [ [ 0.065, 0 ], [ 0.13, 0.035 ], [ 0.14, 0.12 ], [ 0.10, 0.19 ], [ 0.035, 0.20 ], [ 0, 0.22 ] ], { segs: 20, ...iron } );
	B.rod( 'hard', [ - 8.48, F + 1, 3.97 ], [ - 8.36, F + 1.08, 3.97 ], 0.035, 0.023, { segs: 8, ...iron } );
	B.torus( 'hard', - 8.6, F + 1.13, 3.97, 0.105, 0.013, { radial: 5, tubular: 18, ...iron } );
	B.lathe( 'hard', - 7.85, F + 0.025, 4.7, [ [ 0.14, 0 ], [ 0.18, 0.29 ], [ 0.175, 0.31 ], [ 0.16, 0.29 ], [ 0.12, 0.02 ] ], { segs: 14, ...iron } );
	for ( let i = 0; i < 9; i ++ ) B.box( 'hard', - 7.85 + Math.sin( i * 4.4 ) * 0.10, F + 0.22 + i % 3 * 0.028, 4.7 + Math.cos( i * 2.2 ) * 0.09, 0.07, 0.065, 0.075, { ry: i, tint: lin( 0x252927 ), data: HARD( 0.84, 0, 0, 0.95 ) } );

	// Supplies bench against the south wall, clear of the kitchen door.
	B.box( 'stationTimber', - 5.05, F + 0.4, 5.05, 1.55, 0.07, 0.5, oak );
	for ( const x of [ - 5.66, - 4.44 ] ) B.box( 'stationTimber', x, F + 0.2, 5.05, 0.07, 0.4, 0.38, darkOak );
	B.box( 'stationTimber', - 5.4, F + 0.68, 5.05, 0.5, 0.5, 0.38, { ...oak, grain: 0 } );
	for ( const y of [ 0.5, 0.84 ] ) B.box( 'stationTimber', - 5.4, F + y, 5.255, 0.55, 0.05, 0.03, darkOak );
	for ( const x of [ - 4.85, - 4.56 ] ) B.lathe( 'hard', x, F + 0.44, 5.08, [ [ 0.09, 0 ], [ 0.1, 0.02 ], [ 0.1, 0.30 ], [ 0.07, 0.34 ], [ 0.025, 0.34 ], [ 0.025, 0.38 ], [ 0, 0.38 ] ], { segs: 14, ...tin } );
	colliders.addBox( new Vector3( - 5.05, F + 0.22, 5.05 ), new Vector3( 0.78, 0.22, 0.25 ), 0, { tag: 'furniture' } );

	// A second small oil lamp lights the room's entrance, backed by actual
	// geometry. The work table and the tower threshold now have distinct pools.
	B.box( 'stationTimber', - 0.8, F + 1.35, 5.18, 0.65, 0.045, 0.26, oak );
	for ( const x of [ - 1.02, - 0.58 ] ) B.beam( 'hard', [ x, F + 1.34, 5.23 ], [ x, F + 1.08, 5.37 ], 0.02, 0.035, iron );
	const entrance = deskOilLamp( B, - 0.8, F + 1.38, 5.13, 0.36 );
	lights.push( { position: entrance, color: new Color( 1.0, 0.72, 0.43 ), intensity: 4.2, range: 6.3, kind: 'lamp', flicker: 0.025 } );

	// An understated chart above the bench: a framed paper sheet, with three
	// ruled strokes rather than invented legible historical text.
	B.box( 'stationTimber', - 5.0, F + 1.85, R.z1 - 0.02, 1.04, 0.66, 0.045, darkOak );
	B.box( 'hard', - 5.0, F + 1.85, R.z1 - 0.047, 0.94, 0.56, 0.005, linen );
	for ( const y of [ 1.75, 1.85, 1.95 ] ) B.box( 'hard', - 5.0, F + y, R.z1 - 0.052, 0.72, 0.008, 0.004, { tint: lin( 0x7b7967 ), data: HARD( 0.23, 0, 0, 1 ) } );

}
