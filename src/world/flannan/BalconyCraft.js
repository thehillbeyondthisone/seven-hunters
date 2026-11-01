import { lin, HARD, WOOD } from '../Props.js';
import { bolt, railShoe } from './ApparatusCraft.js';
import { GALLERY_WATCH_BAYS, galleryBayPosition } from './GalleryStations.js';

// Maintained 1901 fittings: shoes, collars, splices and drainage. Reconstruction.
export function balconyCraft( B, rail, tower ) {
	const deck = tower.deck, radius = tower.gallery.rail;
	const iron = { tint: lin( 0x3c4441 ), data: HARD( .47, -1, 0, .57 ) };
	const brass = { tint: lin( 0x928160 ), data: HARD( .43, 0, .7, .58 ) };
	const grip = { tint: lin( 0x9b8056 ), data: WOOD( .62, .035 ) };
	for ( let i = 0; i < 40; i ++ ) {
		const angle = ( i + .5 ) / 40 * Math.PI * 2, x = Math.cos( angle ) * radius, z = Math.sin( angle ) * radius;
		railShoe( rail, x, deck, z, iron );
		for ( const h of [ .55, 1.035 ] ) rail.cyl( 'hard', x, deck + h, z, .028, .028, .045, { segs: 12, ...iron } );
		if ( i % 5 === 0 ) bolt( rail, [ x * 1.009, deck + .55, z * 1.009 ], [ Math.cos( angle ), 0, Math.sin( angle ) ], iron, .008 );
	}
	// Raised outer drip and an inboard gutter; both stay outside the walking lane.
	B.torus( 'hard', 0, deck + .012, 0, 3.78, .018, { radial: 8, tubular: 192, ...iron } );
	for ( let i = 0; i < 16; i ++ ) {
		const angle = i / 16 * Math.PI * 2;
		B.pushAt( Math.cos( angle ) * 3.765, deck + .005, Math.sin( angle ) * 3.765, Math.PI / 2 - angle );
		B.box( 'hard', 0, 0, 0, .085, .009, .08, { ...iron } );
		for ( const x of [ -.024, 0, .024 ] ) B.box( 'hard', x, .006, 0, .007, .004, .06, { tint: lin( 0x161f20 ), data: HARD( .3, 0, 0, .9 ) } );
		B.pop();
	}
	for ( const bay of GALLERY_WATCH_BAYS ) {
		const at = galleryBayPosition( bay, deck, 0, radius );
		rail.pushAt( at.x, deck, at.z, Math.PI / 2 - bay.angle );
		// A broad pale timber hand-rest marks a generous working section of rail.
		rail.box( 'stationTimber', 0, 1.083, -.018, 1.8, .043, .095, { grain: 0, ...grip } );
		for ( const x of [ -.78, .78 ] ) {
			rail.box( 'hard', x, 1.054, -.012, .026, .055, .102, iron );
			bolt( rail, [ x, 1.109, -.018 ], [ 0, 1, 0 ], brass, .005 );
		}
		rail.box( 'hard', 0, .99, -.035, .13, .052, .006, brass );
		rail.pop();
		const stand = galleryBayPosition( bay, deck );
		B.cyl( 'hard', stand.x, deck + .004, stand.z, .105, .105, .005, { segs: 32, ...brass } );
		B.pushAt( stand.x, deck + .009, stand.z, Math.PI / 2 - bay.angle );
		B.box( 'hard', 0, 0, 0, .008, .002, .145, iron );
		B.box( 'hard', 0, 0, 0, .105, .002, .006, iron );
		B.pop();
	}
}
