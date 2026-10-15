import { Group, Mesh, Vector3 } from '../../engine/index.js';
import { Builder, Part, lathePart } from '../village/GeoBuilder.js';
import { lin, HARD, WOOD } from '../Props.js';

// All service access, containers, tools and their dimensions are teaching
// reconstructions. Nothing here identifies the original Flannan burner.
const brass = { tint: lin( 0xb69a61 ), data: HARD( .43, .02, .75, .3 ) };
const tin = { tint: lin( 0x858e88 ), data: HARD( .55, .02, .65, .45 ) };
const dark = { tint: lin( 0x302b24 ), data: HARD( .66, .02, 0, .95 ) };
const linen = { tint: lin( 0xe5dcc7 ), data: HARD( .65, 0, 0, .95 ) };
const timber = { tint: lin( 0x796047 ), data: WOOD( .62, .07 ) };
const oil = { tint: lin( 0x96723b ), data: HARD( .2, 0, .1, .7 ) };

export function serviceGlass( G, profile, crankAngle ) {
	const angle = Math.round( crankAngle / ( Math.PI / 6 ) ) * Math.PI / 6;
	const part = lathePart( profile, 96 ), panel = [], fixed = [];
	for ( let i = 0; i < part.idx.length; i += 3 ) {
		const ids = [ part.idx[ i ], part.idx[ i + 1 ], part.idx[ i + 2 ] ];
		let x = 0, y = 0, z = 0;
		for ( const j of ids ) { x += part.p[ j * 3 ]; y += part.p[ j * 3 + 1 ]; z += part.p[ j * 3 + 2 ]; }
		const delta = Math.atan2( Math.sin( Math.atan2( z, x ) - angle ), Math.cos( Math.atan2( z, x ) - angle ) );
		( Math.abs( y / 3 ) < .72 && Math.abs( delta ) < Math.PI / 12 ? panel : fixed ).push( ...ids );
	}
	G.part( 'lens', new Part( part.p, part.n, part.uv, fixed ), 0, 0, 0 );
	const glass = new Builder();
	glass.part( 'lens', new Part( part.p, part.n, part.uv, panel ), 0, 0, 0 );
	return { angle, glass };
}

export function morningServiceProps( ctx, floor, deck, focal, angle ) {
	const { B, colliders } = ctx;
	const radial = ( r, y, a = angle ) => new Vector3( Math.cos( a ) * r, y, Math.sin( a ) * r );
	const targets = {
		door: new Vector3( 9.3, floor + 1.05, -.4 ),
		canHome: new Vector3( 9.55, floor + .96, -3.65 ),
		kitHome: new Vector3( 8.1, floor + 1.02, -3.65 ),
		fill: new Vector3( 10.45, floor + 1.43, -3.65 ),
		tin: new Vector3( 7.7, floor + .8, -1.8 ),
		shelf: radial( 1.85, deck + .84, angle + .55 ),
		panel: radial( 1.34, focal - .25 ),
		glass: radial( 1.34, focal - .38, angle - .40 ),
		burner: radial( .16, focal - .15 ),
		wick: radial( .09, focal - .04 ),
		fountain: radial( 1.45, deck + 1.0, angle + .55 ),
	};
	// The store is naturally lit through its existing west window and yard door.
	B.box( 'stationTimber', 9.3, floor + .83, -3.7, 3.6, .09, .62, timber );
	for ( const x of [ 7.6, 11 ] ) for ( const z of [ -3.95, -3.45 ] ) B.box( 'stationTimber', x, floor + .4, z, .07, .8, .07, timber );
	colliders.addBox( new Vector3( 9.3, floor + .43, -3.7 ), new Vector3( 1.8, .43, .31 ), 0, { tag: 'service-bench' } );
	// A closed bulk vessel, with no historical capacity or calibrated gauge.
	B.box( 'stationTimber', 10.6, floor + 1.075, -3.8, .58, .38, .54, timber );
	B.lathe( 'hard', 10.6, floor + 1.27, -3.8, [ [ .24, 0 ], [ .27, .04 ], [ .27, .4 ], [ .20, .49 ], [ .08, .52 ], [ 0, .52 ] ], { segs: 24, ...tin } );
	B.rod( 'hard', [ 10.55, floor + 1.4, -3.54 ], [ 10.32, floor + 1.4, -3.54 ], .018, .018, brass );
	// Clean cloth cupboard, distinct from the covered receptacle for used cloths.
	B.box( 'stationTimber', 7.55, floor + 1.65, -3.7, .43, .55, .36, timber );
	for ( let i = 0; i < 3; i++ ) B.box( 'hard', 7.55, floor + 1.49 + i * .045, -3.48, .28, .035, .23, linen );
	B.lathe( 'hard', targets.tin.x, floor, targets.tin.z, [ [ .21, 0 ], [ .24, .04 ], [ .24, .62 ], [ .22, .65 ] ], { segs: 24, ...tin } );
	B.cyl( 'hard', targets.tin.x, floor + .65, targets.tin.z, .25, .25, .035, tin );
	B.torus( 'hard', targets.tin.x, floor + .7, targets.tin.z, .055, .009, { radial: 6, ...tin } );
	colliders.addCylinder( targets.tin.x, targets.tin.z, .26, floor, floor + .7, { tag: 'used-cloth-tin' } );
	// A narrow shelf avoids the hatch and the walking ring. No new obstacle is
	// put across the already tight lantern route.
	B.pushAt( targets.shelf.x, deck, targets.shelf.z, -angle - .55 );
	B.box( 'stationTimber', 0, .78, 0, .30, .045, .68, timber );
	B.pop();
	return { targets, floor, deck, focal, angle };
}

export function createMorningModels( village, layout ) {
	if ( ! village.materials?.hard || ! village.station.moving.group ) return null;
	const group = new Group(); group.name = 'morning-servicing';
	village.station.moving.group.add( group );
	const make = ( name, draw ) => {
		const B = new Builder(); draw( B );
		const g = new Group(); g.name = 'morning-' + name;
		for ( const [ key, batch ] of Object.entries( B.batches ) ) {
			const mesh = new Mesh( batch.build(), village.materials[ key ] );
			mesh.castShadow = mesh.receiveShadow = true;
			mesh.onBeforeRender = () => village.textures.bake();
			g.add( mesh );
		}
		group.add( g ); return g;
	};
	const can = make( 'oil-can', B => {
		B.lathe( 'hard', 0, 0, 0, [ [ .13, 0 ], [ .16, .025 ], [ .16, .27 ], [ .12, .33 ], [ .055, .36 ], [ .055, .39 ] ], { segs: 24, ...tin } );
		B.torus( 'hard', 0, .43, 0, .10, .013, { rx: Math.PI / 2, radial: 6, ...tin } );
		B.rod( 'hard', [ .12, .27, 0 ], [ .29, .39, 0 ], .029, .018, tin );
	} );
	const cap = make( 'can-cap', B => B.cyl( 'hard', 0, .385, 0, .063, .063, .035, tin ) );
	const canOil = make( 'oil-in-can', B => B.cyl( 'hard', 0, 0, 0, .147, .147, .01, oil ) );
	const kit = make( 'service-kit', B => {
		B.box( 'stationTimber', 0, .06, 0, .36, .12, .24, timber );
		B.box( 'hard', -.08, .13, .02, .15, .04, .17, linen );
		B.box( 'hard', .10, .13, .02, .08, .04, .17, { ...linen, tint: lin( 0xb7b096 ) } );
		B.rod( 'hard', [ -.12, .15, -.05 ], [ .12, .15, -.05 ], .012, .012, brass );
		for ( const x of [ -.07, .07 ] ) B.torus( 'hard', x, .16, -.04, .022, .005, { radial: 5, ...tin } );
	} );
	const fountain = make( 'working-oil-supply', B => {
		B.lathe( 'hard', 0, 0, 0, [ [ .15, 0 ], [ .19, .04 ], [ .19, .23 ], [ .17, .27 ], [ .16, .27 ], [ .16, .06 ], [ 0, .06 ] ], { segs: 24, ...brass } );
		B.rod( 'hard', [ 0, .04, 0 ], [ -.28, -.06, 0 ], .015, .015, brass );
	} );
	fountain.position.copy( layout.targets.fountain ).add( new Vector3( 0, -.30, 0 ) );
	const fountainCap = make( 'fountain-cap', B => B.cyl( 'hard', 0, 0, 0, .195, .195, .025, brass ) );
	const fountainOil = make( 'oil-in-fountain', B => B.cyl( 'hard', 0, 0, 0, .155, .155, .012, oil ) );
	const glassFilm = make( 'glass-deposits', B => {
		for ( let i = 0; i < 9; i++ ) {
			const y = -.53 + i * .027, rr = 1.18 + ( y + .72 ) / .44 * .15 + .016, points = [];
			for ( let j = 0; j <= 8; j++ ) {
				const a = layout.angle - .4 + ( j / 8 - .5 ) * ( .07 + i % 3 * .035 );
				points.push( new Vector3( Math.cos( a ) * rr, layout.focal + y, Math.sin( a ) * rr ) );
			}
			B.tube( 'hard', points, .0016, { radial: 4, tint: lin( 0xb5a68e ), data: HARD( .85, 0, 0, .95 ) } );
		}
	} );
	const burnerFilm = make( 'burner-deposits', B => B.torus( 'hard', 0, layout.focal - .18, 0, .14, .012, { radial: 6, ...dark } ) );
	const wick = make( 'wick-edge', B => B.cyl( 'hard', 0, layout.focal - .08, 0, .105, .105, .025, linen ) );
	const carbon = make( 'wick-carbon', B => B.torus( 'hard', 0, layout.focal - .054, 0, .10, .012, { radial: 6, ...dark } ) );
	const tool = make( 'working-cloth', B => {
		B.box( 'hard', 0, 0, 0, .16, .035, .13, linen );
		B.rod( 'stationTimber', [ 0, -.02, 0 ], [ 0, -.28, 0 ], .018, .018, timber );
	} );
	const housingTool = make( 'housing-cloth', B => {
		B.box( 'hard', 0, 0, 0, .13, .035, .12, { ...linen, tint: lin( 0xb7b096 ) } );
		B.rod( 'stationTimber', [ 0, -.02, 0 ], [ 0, -.28, 0 ], .018, .018, timber );
	} );
	const trimmer = make( 'wick-trimmer', B => {
		for ( const x of [ -.022, .022 ] ) { B.rod( 'hard', [ x, 0, 0 ], [ -x, -.18, 0 ], .009, .006, tin ); B.torus( 'hard', -x, -.20, 0, .022, .006, { rx: Math.PI / 2, radial: 5, ...tin } ); }
	} );
	const stream = make( 'oil-stream', B => B.cyl( 'hard', 0, 0, 0, .007, .007, 1, oil ) );
	const usedCloths = make( 'used-cloths', B => B.box( 'hard', 0, .16, .02, .13, .04, .16, dark ) );
	return { group, can, cap, canOil, kit, fountain, fountainCap, fountainOil, glassFilm, burnerFilm, wick, carbon, tool, housingTool, trimmer, stream, usedCloths };
}
