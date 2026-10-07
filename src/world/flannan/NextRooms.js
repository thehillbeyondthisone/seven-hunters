import { Color, Vector3 } from '../../engine/index.js';
import { lin, WOOD, HARD, ropeCoil } from '../Props.js';
import { deskOilLamp } from './InteriorDressing.js';
import { Builder } from '../village/GeoBuilder.js';

// Playable reconstruction, not a recovered station plan or inventory.
export const KITCHEN = { x0: -5.4, x1: 1.2, z0: 6, z1: 10.5, door: new Vector3() };
export const BERTH = { x0: -5.4, x1: 1.2, z0: 10.8, z1: 14.4, door: new Vector3() };
export const HAULING_SHED = { x: -160, z: 40, floor: 0, door: new Vector3(), brake: new Vector3() };

export function nextRooms( ctx, parts, floor, ceiling, palette, makeDoor ) {

	const { B, colliders, lights } = ctx, F = floor;
	const wood = { tint: lin( 0x786047 ), data: WOOD( 0.63, 0.08, 0, 0 ) };
	const cream = { tint: lin( 0xd8d0b8 ), data: HARD( 0.41, 0, 0, 0.7 ) };
	const iron = { tint: lin( 0x252c2a ), data: HARD( 0.48, 0.04, 0.6, 0.65 ) };
	const plaster = { tint: palette.white, data: [ 0.57, 1, 0.25, 1 ] };
	const wall = ( x0, z0, x1, z1, y0 = F, y1 = ceiling ) => {
		B.box( 'stationMasonry', ( x0 + x1 ) / 2, ( y0 + y1 ) / 2, ( z0 + z1 ) / 2, x1 - x0, y1 - y0, z1 - z0, plaster );
	};
	const block = ( x0, z0, x1, z1, tag = 'wall' ) => colliders.addBox( new Vector3( ( x0 + x1 ) / 2, ( F + ceiling ) / 2, ( z0 + z1 ) / 2 ), new Vector3( ( x1 - x0 ) / 2, ( ceiling - F ) / 2, ( z1 - z0 ) / 2 ), 0, { tag } );
	for ( const R of [ KITCHEN, BERTH ] ) {
		B.box( 'stationFloor', ( R.x0 + R.x1 ) / 2, F - 0.04, ( R.z0 + R.z1 ) / 2, R.x1 - R.x0, 0.08, R.z1 - R.z0, { grain: 0, ...wood } );
		B.box( 'stationMasonry', ( R.x0 + R.x1 ) / 2, ceiling, ( R.z0 + R.z1 ) / 2, R.x1 - R.x0, 0.08, R.z1 - R.z0, plaster );
		colliders.addBox( new Vector3( ( R.x0 + R.x1 ) / 2, F - 0.2, ( R.z0 + R.z1 ) / 2 ), new Vector3( ( R.x1 - R.x0 ) / 2, 0.2, ( R.z1 - R.z0 ) / 2 ), 0, { walkable: true, solid: false, tag: 'floor' } );
	}
	// The existing kitchen door becomes a real opening; the second leads to Walter's berth.
	for ( const [ name, z, R ] of [ [ 'kitchen', 5.7, KITCHEN ], [ 'berth', 10.65, BERTH ] ] ) {
		wall( -5.4, z - 0.15, -2.8, z + 0.15 ); block( -5.4, z - 0.15, -2.8, z + 0.15 );
		wall( -1.6, z - 0.15, 1.2, z + 0.15 ); block( -1.6, z - 0.15, 1.2, z + 0.15 );
		wall( -2.8, z - 0.15, -1.6, z + 0.15, F + 2.15 );
		B.box( 'stationFloor', -2.2, F - 0.02, z, 1.2, 0.04, 0.65, { grain: 0, ...wood } );
		colliders.addBox( new Vector3( -2.2, F - 0.1, z ), new Vector3( 0.6, 0.1, 0.34 ), 0, { walkable: true, solid: false, tag: 'floor' } );
		for ( const x of [ -2.8, -1.6 ] ) B.box( 'stationTimber', x, F + 1.08, z - 0.19, 0.09, 2.16, 0.05, { grain: 1, tint: palette.trim, data: WOOD( 0.44, 0, 1 ) } );
		B.box( 'stationTimber', -2.2, F + 2.18, z - 0.19, 1.4, 0.14, 0.05, { grain: 0, tint: palette.trim, data: WOOD( 0.45, 0, 1 ) } );
		parts.doors.push( makeDoor( ctx, { name, hinge: new Vector3( -2.76, F, z ), ry: 0, swing: -1.6, width: 1.12, height: 2.08,
			leaf: L => {
				const painted = { tint: palette.door, data: WOOD( 0.74, 0.02, 1 ) };
				L.box( 'stationTimber', 0.56, 1.04, 0, 1.12, 2.08, 0.045, { grain: 1, ...painted } );
				for ( const y of [ 0.1, 0.9, 1.98 ] ) L.box( 'stationTimber', 0.56, y, -0.03, 1.08, 0.12, 0.025, { grain: 0, ...painted } );
				L.cyl( 'hard', 1.02, 0.98, -0.06, 0.025, 0.025, 0.06, { rx: Math.PI / 2, segs: 10, tint: lin( 0x9d814e ), data: HARD( 0.44, 0, 0.7, 0.4 ) } );
			} } ) );
		R.door.set( -2.2, F + 1, z );
	}
	// The existing thick exterior walls already have inside faces and cut windows.
	// Keep those openings clear so both rooms really look onto the island.
	const table = ( x, z, w, d, h ) => {
		B.box( 'stationTimber', x, F + h, z, w, 0.065, d, { grain: 0, ...wood } );
		for ( const sx of [ -1, 1 ] ) for ( const sz of [ -1, 1 ] ) B.box( 'stationTimber', x + sx * ( w / 2 - 0.08 ), F + h / 2, z + sz * ( d / 2 - 0.08 ), 0.07, h, 0.07, { grain: 1, ...wood } );
		colliders.addBox( new Vector3( x, F + h / 2, z ), new Vector3( w / 2, h / 2, d / 2 ), 0, { tag: 'furniture' } );
	};
	// A range, kettle and coal scuttle, sharing the south-wing chimney.
	B.box( 'hard', -4.65, F + 0.42, 7.6, 0.95, 0.84, 0.74, iron );
	B.box( 'hard', -4.65, F + 0.87, 7.6, 1.02, 0.06, 0.8, iron );
	B.cyl( 'hard', -4.8, F + 0.9, 7.45, 0.065, 0.065, ceiling - F - 0.9, { segs: 12, ...iron } );
	B.lathe( 'hard', -4.45, F + 0.91, 7.75, [ [ 0, 0 ], [ 0.12, 0 ], [ 0.15, 0.08 ], [ 0.12, 0.19 ], [ 0.055, 0.22 ], [ 0, 0.22 ] ], { segs: 20, ...iron } );
	B.torus( 'hard', -4.45, F + 1.15, 7.75, 0.1, 0.008, { radial: 6, tubular: 16, ...iron } );
	B.rod( 'hard', [ -4.32, F + 1.01, 7.75 ], [ -4.21, F + 1.12, 7.75 ], 0.025, 0.016, { segs: 10, ...iron } );
	B.cyl( 'hard', -4.75, F, 8.45, 0.18, 0.14, 0.33, { segs: 16, ...iron } );
	colliders.addBox( new Vector3( -4.65, F + 0.45, 7.6 ), new Vector3( 0.5, 0.45, 0.42 ), 0, { tag: 'furniture' } );
	KITCHEN.stove = new Vector3( -4.12, F + 0.45, 7.6 );
	KITCHEN.chimney = new Vector3( -2.1, F + 5.52, 10.5 );
	// Table, bread, mugs and Walter's crate. Keep the centre aisle unobstructed.
	table( -3.8, 9.65, 1.8, 0.65, 0.76 );
	B.box( 'hard', -3.9, F + 0.81, 9.65, 0.47, 0.05, 0.31, cream );
	B.lathe( 'hard', -3.9, F + 0.84, 9.65, [ [ 0, 0 ], [ 0.1, 0 ], [ 0.13, 0.09 ], [ 0, 0.13 ] ], { segs: 18, sx: 1.5, tint: lin( 0xa77b3e ), data: HARD( 0.55, 0, 0, 0.95 ) } );
	for ( const x of [ -3.38, -4.35 ] ) B.cyl( 'hard', x, F + 0.81, 9.6, 0.045, 0.04, 0.09, { segs: 14, ...cream } );
	for ( let i = 0; i < 3; i ++ ) B.box( 'stationTimber', 0.82, F + 0.72 + i * 0.52, 8.2, 0.58, 0.055, 2.7, { grain: 2, ...wood } );
	for ( const z of [ 7.3, 7.7, 8.1, 8.6, 9.1 ] ) B.cyl( 'hard', 0.85, F + 0.77, z, 0.09, 0.09, 0.23, { segs: 12, ...cream } );
	B.box( 'stationTimber', -0.25, F + 0.29, 9.65, 0.92, 0.58, 0.66, { grain: 0, ...wood } );
	for ( const x of [ -0.58, 0.08 ] ) B.box( 'stationTimber', x, F + 0.3, 9.3, 0.1, 0.62, 0.03, { grain: 1, ...wood } );
	B.box( 'stationTimber', -0.25, F + 0.59, 9.65, 0.22, 0.008, 0.29, { grain: 0, tint: lin( 0xe8dec5 ), data: WOOD( 0.66, 0, 1 ) } );
	colliders.addBox( new Vector3( -0.25, F + 0.3, 9.65 ), new Vector3( 0.48, 0.3, 0.35 ), 0, { tag: 'furniture' } );
	KITCHEN.crate = new Vector3( -0.25, F + 0.61, 9.65 );
	const flame = deskOilLamp( B, -3.0, F + 0.8, 9.6, 0.65 );
	lights.push( { position: flame, color: new Color( 1, 0.72, 0.43 ), intensity: 5, range: 7, kind: 'kitchenLamp' } );
	lights.push( { position: KITCHEN.stove.clone(), color: new Color( 1, 0.4, 0.12 ), intensity: 2, range: 4, kind: 'kitchenFire' } );
	lights.push( { position: new Vector3( 0.95, F + 1.55, 9.55 ), dir: new Vector3( -1, -0.2, 0 ).normalize(), color: new Color( 0.8, 0.88, 1 ), intensity: 2, range: 7, kind: 'daylight', day: true } );
	// A spare berth: bedding, bag, washstand and the letter already in your coat.
	B.box( 'stationTimber', -4.05, F + 0.3, 12.5, 1.6, 0.16, 2.1, { grain: 2, ...wood } );
	B.box( 'hard', -4.05, F + 0.46, 12.5, 1.52, 0.22, 2.02, { tint: lin( 0xa2a394 ), data: HARD( 0.55, 0, 0, 1 ) } );
	B.box( 'hard', -4.05, F + 0.6, 13.13, 0.95, 0.12, 0.47, cream );
	for ( const z of [ 11.47, 13.53 ] ) B.box( 'stationTimber', -4.05, F + 0.6, z, 1.65, 0.85, 0.075, { grain: 0, ...wood } );
	colliders.addBox( new Vector3( -4.05, F + 0.43, 12.5 ), new Vector3( 0.85, 0.43, 1.1 ), 0, { tag: 'furniture' } );
	BERTH.bed = new Vector3( -3.14, F + 0.53, 12.5 );
	table( 0.6, 13.55, 0.78, 0.65, 0.72 );
	BERTH.lantern = new Vector3( 0.6, F +0.76, 13.25 );
	B.lathe( 'hard', 0.6, F + 0.76, 13.55, [ [ 0, 0 ], [ 0.14, 0 ], [ 0.23, 0.08 ], [ 0.23, 0.11 ], [ 0.2, 0.09 ], [ 0.12, 0.03 ], [ 0, 0.03 ] ], { segs: 24, ...cream } );
	B.box( 'stationTimber', -0.25, F + 0.2, 12.1, 0.7, 0.4, 0.42, { grain: 0, tint: lin( 0x68513a ), data: WOOD( 0.77, 0.12 ) } );
	lights.push( { position: new Vector3( -2.1, F + 1.6, 14.1 ), dir: new Vector3( 0, -0.2, -1 ).normalize(), color: new Color( 0.8, 0.88, 1 ), intensity: 1.8, range: 6, kind: 'daylight', day: true } );

}

export function haulingShed( ctx, village, parts ) {
	const { B, terrain: T, colliders } = ctx, H = HAULING_SHED;
	const F = H.floor = T.heightAt( H.x, H.z );
	const wood = { tint: lin( 0x64624e ), data: WOOD( 0.52, 0.65 ) };
	const iron = { tint: lin( 0x313936 ), data: HARD( 0.39, 0.2, 0.65, 0.7 ) };
	const box = ( x, y, z, w, h, d, key = 'stationTimber', material = wood, solid = true ) => {
		B.box( key, H.x + x, F + y, H.z + z, w, h, d, { grain: 1, ...material } );
		if ( solid ) colliders.addBox( new Vector3( H.x + x, F + y, H.z + z ), new Vector3( w / 2, h / 2, d / 2 ), 0, { tag: 'hauling-shed' } );
	};
	box( -2, 1.3, 0, 0.16, 2.6, 3.5 ); box( 2, 1.3, 0, 0.16, 2.6, 3.5 ); box( 0, 1.3, -1.75, 4.15, 2.6, 0.16 );
	box( -1.4, 1.3, 1.75, 1.2, 2.6, 0.16 ); box( 1.4, 1.3, 1.75, 1.2, 2.6, 0.16 );
	box( 0, 2.45, 1.75, 1.6, 0.3, 0.16, 'stationTimber', wood, false );
	box( 0, 2.65, 0, 4.3, 0.16, 3.8, 'hard', iron, false );
	box( 0, -0.04, 0, 4, 0.08, 3.5, 'stationFloor', wood, false );
	colliders.addBox( new Vector3( H.x, F - 0.15, H.z ), new Vector3( 2, 0.15, 1.8 ), 0, { walkable: true, solid: false, tag: 'floor' } );
	box( -0.55, 0.6, -0.75, 1.3, 0.8, 0.72, 'hard', iron );
	B.cyl( 'hard', H.x -0.55, F +1.07, H.z -0.75, 0.26, 0.26, 0.8, { rx: Math.PI / 2, segs: 20, ...iron } );
	B.torus( 'hard', H.x +0.12, F +0.97, H.z -0.5, 0.3, 0.025, { ry: Math.PI / 2, radial: 6, tubular: 24, ...iron } );
	ropeCoil( B, H.x +1, F +0.02, H.z -0.8, 0.24, 0.58 );
	H.brake.set( H.x +0.3, F +0.95, H.z -0.45 );
	H.door.set( H.x, F +1, H.z +2.1 );
	// The retaining chain has two visible arrangements, switched after the job.
	const loose = new Builder(), secured = new Builder();
	for ( let i = 0; i < 20; i ++ ) {
		loose.torus( 'hard', H.x +1.3 +Math.sin( i *0.35 ) *0.15, F +0.025, H.z -0.85 +i *0.055, 0.038, 0.009, { radial: 5, tubular: 10, rx: i %2 ? Math.PI /2 : 0, ...iron } );
		secured.torus( 'hard', H.x +0.15 +i *0.068, F +1.02 -Math.sin( i /19 *Math.PI ) *0.12, H.z -0.5 -i *0.055, 0.038, 0.009, { radial: 5, tubular: 10, rx: Math.PI /2, ry: i %2 ? Math.PI /2 : 0, ...iron } );
	}
	B.torus( 'hard', H.x +1.48, F +1.03, H.z -1.63, 0.055, 0.016, { rx: Math.PI /2, radial: 6, tubular: 14, ...iron } );
	parts.haulingChains = { loose, secured };
	ctx.marks.haulingBrake = H.brake.clone();
	village.footprints.push( { x: H.x, z: H.z, r: 3, kind: 'building' } );
	village.buildings.push( { name: 'hauling-shed', x: H.x, z: H.z, floorY: F, roofTop: F +2.8, stilts: false } );
}
