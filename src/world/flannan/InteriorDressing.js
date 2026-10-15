import { Color, Vector3 } from '../../engine/index.js';
import { lin, WOOD, HARD } from '../Props.js';
import { unpackingProps } from './UnpackingProps.js';
import { clothSurface, roomJoinery } from './InteriorCraft.js';
import { roomCraft, roomLampFlame } from './RoomCraft.js';

// A standing paraffin lamp. y is the table/shelf, unlike Props.lantern's
// hanging point. Keep the source aligned with the flame in the chimney.
export function deskOilLamp( B, x, y, z, seed = 0.5 ) {

	roomCraft( B, 'oilLamp', x, y, z, { seed } );
	roomLampFlame( B, x, y+.15, z );
	return new Vector3( x, y + 0.15, z );

}

// Period-plausible furnishings, kept in the existing workroom. These are
// reconstruction choices, not a recovered inventory of the missing keepers.
export function dressKeepersRoom( ctx, room, floor, parts ) {

	const { B, colliders, lights } = ctx, F = floor, R = room;
	roomJoinery( B, R, F );
	const oak = { tint: lin( 0x74593d ), data: WOOD( 0.67, 0.18, 0, 0 ) };
	const darkOak = { tint: lin( 0x514634 ), data: WOOD( 0.72, 0.1, 0, 0 ) };
	const tin = { tint: lin( 0x66665f ), data: HARD( 0.34, 0.04, 0.65, 0.54 ) };
	const iron = { tint: lin( 0x303632 ), data: HARD( 0.64, 0.04, 0.6, 0.58 ) };
	const linen = { tint: lin( 0xc8bea1 ), data: HARD( 0.48, 0, 0, 0.94 ) };
	const cream = { tint: lin( 0xd8d1ba ), data: HARD( 0.23, 0, 0, 0.34 ) };
	const blue = { tint: lin( 0x40595e ), data: HARD( 0.25, 0, 0, 0.37 ) };
	const brass = { tint: lin( 0xa48247 ), data: HARD( 0.45, 0, 0.85, 0.4 ) };
	const cup = ( x, y, z, color = cream ) => {

		roomCraft( B, 'cup', x, y, z, {}, { cream:color } );

	};
	const plate = ( x, y, z ) => roomCraft( B, 'plate', x, y, z );

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
		for ( const side of [ - 1, 1 ] ) roomCraft( B, 'curtain', x + side * .64, F + 1.13, z, { sx:side } );
		for(const side of [-1,1]) B.lathe('stationTimber',x+side*.88,F+2.67,z,[[0,0],[.025,0],[.03,.022],[.018,.045],[0,.05]],{rz:-side*Math.PI/2,segs:16,...darkOak});

	}

	// Dresser near the west wall, north of the bedroom door: storage, crockery,
	// labelled-by-shape tins and a brown glass bottle, all merged into existing draws.
	const cx = - 8.64, cz = 0.45;
	roomCraft( B, 'dresser', cx, F, cz );
	for ( const y of [ 1.26, 1.78, 2.27 ] ) {

		// A working cupboard: a few cups, plates, a jug and stores, rather than a row of identical mugs.
		if ( y === 1.26 ) { for ( let i = 0; i < 3; i ++ ) cup( cx - .06, F+y+.02, cz-.47+i*.33, i===1 ? blue : cream ); }
		else if ( y === 1.78 ) {
			for (let i=0;i<4;i++) roomCraft(B,'plate',cx-.05,F+y+.02+i*.018,cz-.35,{sx:1.2,sz:1.2});
			roomCraft(B,'jug',cx-.05,F+y+.02,cz+.34,{ry:-Math.PI/2});
		} else for(const zz of [cz-.42,cz+.22]) roomCraft(B,'tin',cx-.05,F+y+.02,zz,{sx:.84,sy:3.8,sz:.84});

	}
	plate( cx + 0.13, F + 0.94, cz );
	B.lathe( 'hard', cx + 0.06, F + 0.94, cz + 0.54, [ [ 0.05, 0 ], [ 0.06, 0.03 ], [ 0.06, 0.2 ], [ 0.022, 0.23 ], [ 0.022, 0.3 ], [ 0, 0.3 ] ], { segs: 14, tint: lin( 0x514f32 ), data: HARD( 0.62, 0, 0, 0.13 ) } );
	colliders.addBox( new Vector3( cx, F + 0.47, cz ), new Vector3( 0.33, 0.47, 0.9 ), 0, { tag: 'furniture' } );

	// The table: crockery set aside for the working station. A folded wool blanket and
	// biscuit tin suggest a long watch without inventing new story evidence.
	B.pushAt( - 5.4, F + 0.745, 3.3, 0.1 );
	clothSurface( B, (u,v) => [(u-.5)*.66, .007+Math.sin(u*31)*.002-Math.max(0,Math.abs(v-.5)*1.12-.39)*.95, (v-.5)*1.12], linen );
	plate( - 0.26, 0, 0.02 );
	cup( 0.02, 0.005, - 0.17 );
	cup( - 0.48, 0.005, - 0.15, blue );
	roomCraft(B,'tin',.48,.008,.08);
	roomCraft(B,'foldedCloth',.34,.008,-.12);
	B.rod( 'hard', [ - 0.13, 0.018, 0.12 ], [ - 0.02, 0.018, 0.18 ], 0.004, 0.006, { segs: 5, ...tin } );
	B.lathe('hard',-.02,.019,.18,[[0,0],[.014,.001],[.019,.004],[.017,.006],[0,.004]],{segs:24,sx:.7,sz:1.3,...tin});
	B.pop();
	// Hanging table lamp: its light falls on the table and dresser rather than
	// just the walls. The stem runs up to a small ceiling rose.
	B.rod( 'hard', [ - 5.4, F + 2.45, 3.3 ], [ - 5.4, R.ceiling - 0.03, 3.3 ], 0.008, 0.008, { segs: 6, ...iron } );
	B.cyl( 'hard', - 5.4, R.ceiling - 0.05, 3.3, 0.07, 0.07, 0.035, { segs: 16, ...iron } );
	roomCraft(B,'hangingLamp',-5.4,F+2.45,3.3,{sx:.84,sy:.84,sz:.84,seed:.52});
	const hanging = [-5.4,F+2.45-.255*.84,3.3];
	roomLampFlame(B,...hanging,.84);
	lights.push( { position: new Vector3( ...hanging ), dir: new Vector3( 0, -1, 0 ), cosInner: .35, cosOuter: -.45, color: new Color( 1.0, 0.73, 0.47 ), intensity: 4.8, range: 4.8, kind: 'lamp', flicker: 0.025 } );
	roomCraft(B,'foldedCloth',-6.39,F+.473,2.66,{ry:1.88,sx:1.3,sz:1.1},{linen:{tint:lin(0x596352),data:HARD(.59,0,0,.96)}});

	// Cold stove, kettle and coal scuttle: preserve the existing story's cold
	// stove, with no flame or new interaction. A hearth protects the timber floor.
	B.box( 'hard', - 8.52, F + 0.015, 3.9, 1.02, 0.03, 1.02, { tint: lin( 0x555957 ), data: HARD( 0.75, 0, 0, 0.9 ) } );
	roomCraft(B,'kettle',-8.6,F+.9,3.97);
	B.lathe( 'hard', - 7.85, F + 0.025, 4.7, [ [ 0.14, 0 ], [ 0.18, 0.29 ], [ 0.175, 0.31 ], [ 0.16, 0.29 ], [ 0.12, 0.02 ] ], { segs: 14, ...iron } );
	B.torus('hard',-7.85,F+.329,4.7,.173,.006,{radial:6,tubular:32,...iron});
	B.torus('hard',-7.85,F+.34,4.7,.155,.008,{rx:Math.PI/2,arc:Math.PI,radial:6,tubular:24,...tin});
	for ( let i = 0; i < 9; i ++ ) B.box( 'hard', - 7.85 + Math.sin( i * 4.4 ) * 0.10, F + 0.22 + i % 3 * 0.028, 4.7 + Math.cos( i * 2.2 ) * 0.09, 0.07, 0.065, 0.075, { ry: i, tint: lin( 0x252927 ), data: HARD( 0.84, 0, 0, 0.95 ) } );

	// Supplies bench against the south wall, clear of the kitchen door.
	B.box( 'stationTimber', - 5.05, F + 0.4, 5.05, 1.55, 0.07, 0.5, oak );
	for ( const x of [ - 5.66, - 4.44 ] ) B.box( 'stationTimber', x, F + 0.2, 5.05, 0.07, 0.4, 0.38, darkOak );
	roomCraft(B,'crate',-5.4,F+.435,5.05);
	for ( const x of [ - 4.85, - 4.56 ] ) roomCraft(B,'oilCan',x,F+.44,5.08);
	colliders.addBox( new Vector3( - 5.05, F + 0.22, 5.05 ), new Vector3( 0.78, 0.22, 0.25 ), 0, { tag: 'furniture' } );

	// A second small oil lamp lights the room's entrance, backed by actual
	// geometry. The work table and the tower threshold now have distinct pools.
	B.box( 'stationTimber', - 0.8, F + 1.35, 5.18, 0.65, 0.045, 0.26, oak );
	for ( const x of [ - 1.02, - 0.58 ] ) B.beam( 'hard', [ x, F + 1.34, 5.23 ], [ x, F + 1.08, 5.37 ], 0.02, 0.035, iron );
	const entrance = deskOilLamp( B, - 0.8, F + 1.38, 5.13, 0.36 );
	lights.push( { position: entrance, dir: new Vector3( 0, -.7, -1 ).normalize(), cosInner: .2, cosOuter: -.65, color: new Color( 1.0, 0.72, 0.43 ), intensity: 3.2, range: 4.8, kind: 'lamp', flicker: 0.025 } );

	// Walter's own kitbag has come up with him. Keep it beside the entrance,
	// under the shelf and outside both the door swing and the walking route.
	parts.unpacking = unpackingProps( F, R );
	R.bag = parts.unpacking.bag;

	// The original 1898 island map replaces the old placeholder above the bench.
	// Its position here is fictional; the reader retains the unaltered scan.
	B.box( 'stationTimber', - 5.0, F + 1.85, R.z1 - 0.02, 1.04, 0.66, 0.045, darkOak );
	parts.archiveDisplays ||= [];
	parts.archiveDisplays.push( { id:'islandMap', x:-5, y:F+1.85, z:R.z1-.048, width:.94, height:.56, ry:Math.PI, rx:0 } );

}
