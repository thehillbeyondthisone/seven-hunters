import { Vector3 } from '../../engine/index.js';
import { Builder } from '../village/GeoBuilder.js';
import { lin, HARD } from '../Props.js';

// Authored personal belongings. The Brownie follows the original 1900 box's
// 3 x 3 x 5 inch proportions, rather than a later model with integral finders.
export function unpackingProps( floor, room ) {
	const F = floor, builders = {};
	const canvas = { tint: lin( 0xa09170 ), data: HARD( .56, .025, 0, .9 ) };
	const leather = { tint: lin( 0x493b2e ), data: HARD( .61, .08, 0, .8 ) };
	const dark = { tint: lin( 0x282621 ), data: HARD( .41, .01, 0, .96 ) };
	const paper = { tint: lin( 0xd5c3a0 ), data: HARD( .39, 0, 0, .96 ) };
	const wool = { tint: lin( 0x465e73 ), data: HARD( .33, 0, 0, .98 ) };
	const linen = { tint: lin( 0xd6cebb ), data: HARD( .48, 0, 0, .98 ) };
	const metal = { tint: lin( 0x938b77 ), data: HARD( .43, .03, .65, .45 ) };
	const make = ( name, x, y, z, draw, ry = 0 ) => {
		const B = new Builder(); B.pushAt( x, y, z, ry ); draw( B ); B.pop(); builders[ name ] = B;
	};
	const bag = new Vector3( -.8, F + .28, 4.99 );
	make( 'closed', -.8, F + .22, 5.07, B => {
		B.lathe( 'hard', 0, 0, 0, [ [ 0, -.4 ], [ .12, -.36 ], [ .18, -.25 ], [ .19, .2 ], [ .15, .34 ], [ .06, .41 ], [ 0, .43 ] ], { rz: Math.PI / 2, segs: 18, sz: .82, ...canvas } );
		for ( const x of [ -.23, .23 ] ) B.torus( 'hard', x, 0, 0, .185, .018, { ry: Math.PI / 2, radial: 5, tubular: 20, sz: .83, ...leather } );
		B.torus( 'hard', 0, .14, 0, .075, .011, { radial: 5, tubular: 16, ...leather } );
	} );
	make( 'open', -.8, F, 5.07, B => {
		// An oval canvas pouch with a rolled lip and recessed interior. Its curved
		// ends retain the closed bag's shape when the mouth is folded open.
		B.lathe( 'hard', 0, 0, 0, [ [ 0, .035 ], [ .3, .045 ], [ .36, .09 ], [ .395, .2 ], [ .4, .28 ],
			[ .392, .295 ], [ .377, .28 ], [ .372, .2 ], [ .34, .10 ], [ .28, .075 ], [ 0, .067 ] ], { segs: 32, sz: .44, ...canvas } );
		B.box( 'hard', 0, .10, 0, .57, .01, .22, dark );
		B.torus( 'hard', 0, .282, 0, .393, .009, { radial: 5, tubular: 32, sz: .44, ...leather } );
		// Folded canvas mouth and loosened leather straps, toward the wall.
		B.cyl( 'hard', 0, .29, .15, .035, .035, .66, { rz: Math.PI / 2, segs: 12, ...canvas } );
		for ( const x of [ -.23, .23 ] ) {
			B.box( 'hard', x, .04, -.22, .035, .022, .24, { rx: -.18, ...leather } );
			B.box( 'hard', x, .031, -.33, .048, .015, .037, metal );
		}
	} );
	const clothes = B => {
		B.box( 'hard', 0, .018, 0, .25, .036, .19, linen );
		B.box( 'hard', -.015, .044, -.012, .23, .018, .17, linen );
		for ( const x of [ -.055, .045 ] ) {
			B.box( 'hard', x, .065, .02, .064, .03, .145, { ry: .08, ...wool } );
			B.box( 'hard', x + .015, .063, .09, .092, .035, .052, wool );
		}
	};
	make( 'packedClothes', -1.01, F + .18, 5.045, clothes );
	make( 'laidClothes', -4.7, F + .475, 2.55, clothes, -.2 );
	make( 'parcel', -.64, F + .18, 5.03, B => {
		B.box( 'hard', 0, .057, 0, .15, .114, .11, paper );
		for ( const x of [ -.055, .055 ] ) B.box( 'hard', x, .057, 0, .008, .118, .113, linen );
		B.box( 'hard', 0, .118, 0, .152, .004, .008, linen );
	} );
	make( 'wrapper', -.61, F + .165, 5.03, B => {
		B.box( 'hard', 0, 0, 0, .22, .006, .19, paper );
		B.box( 'hard', .12, .014, 0, .075, .006, .19, { rz: .3, ...paper } );
	} );
	const camera = B => {
		const body = { tint: lin( 0x242727 ), data: HARD( .57, .015, 0, .85 ) };
		B.box( 'hard', 0, .0381, 0, .0762, .0762, .127, body );
		B.box( 'hard', 0, .0381, .065, .077, .077, .004, dark );
		B.cyl( 'hard', 0, .0381, .068, .009, .009, .003, { rx: Math.PI / 2, segs: 20, ...metal } );
		B.cyl( 'hard', 0, .0381, .070, .0065, .0065, .001, { rx: Math.PI / 2, segs: 20, tint: lin( 0x111b22 ), data: HARD( .3, 0, .1, .12 ) } );
		// Top sight lines; no viewfinder. The side key winds the 117 film.
		for ( const x of [ -.024, .024 ] ) B.rod( 'hard', [ 0, .0768, -.046 ], [ x, .0768, .047 ], .00065, .00065, { segs: 4, ...metal } );
		B.box( 'hard', .029, .078, .046, .012, .003, .007, metal );
		B.cyl( 'hard', -.043, .037, -.032, .005, .005, .008, { rz: Math.PI / 2, segs: 12, ...metal } );
		B.box( 'hard', -.049, .037, -.032, .003, .018, .006, metal );
		B.cyl( 'hard', 0, .034, -.0645, .005, .005, .001, { rx: Math.PI / 2, segs: 12, tint: lin( 0x6e2722 ), data: HARD( .3, 0, 0, .22 ) } );
		B.box( 'hard', 0, .004, -.065, .028, .004, .003, metal );
	};
	make( 'brownieInBag', -.64, F + .18, 5.03, camera, -.12 );
	const desk = new Vector3( -5.99, F + .76, room.z0 + .61 );
	make( 'brownieOnDesk', desk.x, desk.y, desk.z, camera, -.18 );
	make( 'cameraNote', desk.x - .04, desk.y + .002, desk.z + .055, B => {
		B.box( 'hard', 0, 0, 0, .1, .004, .045, linen );
		for ( const z of [ -.01, 0, .01 ] ) B.box( 'hard', 0, .0025, z, .07, .0006, .001, dark );
	}, -.12 );
	return { builders, bag, parcel: new Vector3( -.64, F + .25, 5.03 ), desk: desk.clone().add( new Vector3( 0, .038, 0 ) ) };
}
