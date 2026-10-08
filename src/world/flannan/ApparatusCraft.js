import { Vector3 } from '../../engine/index.js';

// Small construction fittings, deliberately visual only: stair and hatch
// clearance is still defined by Station's existing walking surfaces/colliders.
// Dimensions and patterns are modelling reconstruction, not archive measurements.
export function bolt( B, at, normal, material, radius = .012 ) {

	const p = new Vector3( ...at ), n = new Vector3( ...normal ).normalize();
	const along = distance => p.clone().addScaledVector( n, distance ).toArray();
	B.rod( 'hard', along( 0 ), along( .003 ), radius * 1.55, radius * 1.55, { segs: 12, ...material } );
	B.rod( 'hard', along( .003 ), along( .011 ), radius, radius, { segs: 6, ...material } );

}

export function railShoe( B, x, y, z, material ) {

	B.cyl( 'hard', x, y, z, .047, .047, .014, { segs: 12, ...material } );
	B.cyl( 'hard', x, y + .014, z, .023, .018, .047, { segs: 10, ...material } );
	for ( const dx of [ -.032, .032 ] ) bolt( B, [ x + dx, y + .014, z ], [ 0, 1, 0 ], material, .006 );

}
