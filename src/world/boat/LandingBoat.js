import { Group, Mesh, Vector3 } from '../../engine/index.js';
import { Builder } from '../village/GeoBuilder.js';
import { lin, WOOD, HARD, ropeCoil } from '../Props.js';
import { standard } from '../../materials/Materials.js';
import { commonModule } from '../../engine/render/wgsl/common.js';
import { detailedLandingMaterials } from './LandingBoatMaterials.js';

// Artistic reconstruction of an open clinker landing boat. +Z is the bow;
// y=0 is its design waterline. No measured Hesperus boat dimensions are claimed.
export const LANDING_FLOOR = 0.36;
export const LANDING_EYE = new Vector3( 0, 2.02, 1.05 );
export const LANDING_PROBES = [
	[ 0, 0 ], [ 0, 2.8 ], [ 0, - 2.8 ], [ - 0.85, 0 ], [ 0.85, 0 ],
	[ - 0.62, 1.9 ], [ 0.62, 1.9 ], [ - 0.62, - 1.9 ], [ 0.62, - 1.9 ],
];

export function landingWidth( z ) {
	const t = Math.max( 0, Math.min( 1, ( z + 3.45 ) / 7.1 ) );
	return 1.18 * Math.pow( Math.sin( t * Math.PI ), 0.64 );
}
const sheer = ( z ) => 1.02 + 0.34 * Math.pow( Math.abs( z ) / 3.65, 3 );
const shell = ( z, t, side, inset = 0 ) => new Vector3(
	side * ( landingWidth( z ) * ( 0.12 + 0.88 * Math.sin( t * Math.PI / 2 ) ) - inset ),
	- 0.53 + ( sheer( z ) + 0.53 ) * t, z,
);

// Boat-local grain/wear avoids the village shader's world-height algae belt
// crawling across the interior as the boat rises and falls.
function materials() {
	const base = { modules: [ commonModule ], underwaterLighting: 'lite',
		attributes: { tint: 'vec3f', vdata: 'vec4f' },
		varyings: { vTint: 'vec3f', vData: 'vec4f', vBoat: 'vec3f' },
		vertex: 'o.vTint = v.tint; o.vData = v.vdata; o.vBoat = v.position;',
	};
	const wood = standard( { ...base, name: 'LandingBoatTimber', roughness: 0.7 } );
	wood.surface = /* wgsl */`
	let p = in.vs.vBoat; let d = in.vs.vData;
	let uv = in.uv;
	let grain = mx_noise_float3( vec3f( uv.x * 1.7, uv.y * 110.0, d.x * 37.0 ) );
	let broad = mx_noise_float3( vec3f( uv * vec2f( 2.0, 17.0 ), d.x * 19.0 ) );
	let pores = smoothstep( 0.28, 0.6, grain + broad * 0.32 );
	let wear = mx_noise_float3( vec3f( uv * 6.0, d.x * 13.0 ) );
	let paint = d.y * smoothstep( -0.58, -0.32, wear );
	let raw = vec3f( 0.33, 0.22, 0.12 ) * ( 0.82 + broad * 0.24 - pores * 0.22 );
	var c = mix( raw * ( in.vs.vTint * 1.8 + 0.6 ), in.vs.vTint * ( 0.92 + broad * 0.1 ), paint );
	let damp = 1.0 - smoothstep( -0.1, 0.55, p.y );
	c *= 1.0 - damp * 0.2;
	let bump = grain * 0.00065 + pores * 0.0004;
	s.albedo = c;
	s.roughness = mix( 0.74, 0.42, damp ) - paint * 0.1;
	s.normal = perturbNormalByHeight( in.P, in.N, dpdx( bump ), dpdy( bump ), 1.0 );
`;
	const hard = standard( { ...base, name: 'LandingBoatFittings', roughness: 0.65 } );
	hard.surface = /* wgsl */`
	let d = in.vs.vData; let p = in.vs.vBoat;
	let n = mx_noise_float3( p * 43.0 + vec3f( d.x * 7.0 ) );
	s.albedo = in.vs.vTint * ( 0.94 + n * 0.1 );
	s.roughness = d.w; s.metalness = d.z;
	let rust = smoothstep( 0.1, 0.6, n ) * d.y;
	s.albedo = mix( s.albedo, vec3f( 0.2, 0.075, 0.025 ), rust );
	let bump = n * 0.0004 * ( 1.0 - d.z );
	s.normal = perturbNormalByHeight( in.P, in.N, dpdx( bump ), dpdy( bump ), 1.0 );
`;
	return { wood, hard, rope: hard, cloth: hard };
}

function meshes( B, parent, mats, name ) {
	for ( const [ key, batch ] of Object.entries( B.batches ) ) {
		const mesh = new Mesh( batch.build(), mats[ key ] );
		mesh.name = name + '-' + key;
		mesh.castShadow = mesh.receiveShadow = true;
		parent.add( mesh );
	}
}

export function buildLandingBoat( group, { detailed = false, textures = null } = {} ) {
	const B = new Builder(), mats = detailed && textures?.indoorWoodN ? detailedLandingMaterials( textures ) : materials(), oars = [], arms = [];
	const oak = { tint: lin( 0xb49a73 ), data: WOOD( 0.37, 0.2, 0 ) };
	const pale = { tint: lin( 0xd4c3a0 ), data: WOOD( 0.54, 0.14, 0 ) };
	const paint = { tint: lin( 0x344e4b ), data: WOOD( 0.61, 0.2, 0.95 ) };
	const cream = { tint: lin( 0xc5bda1 ), data: WOOD( 0.45, 0.1, 0.9 ) };
	const iron = { tint: lin( 0x414640 ), data: HARD( 0.3, 0.18, 0.72, 0.42 ) };
	const brass = { tint: lin( 0xae8f50 ), data: HARD( 0.4, 0.04, 0.8, 0.3 ) };
	const rope = { tint: lin( 0xa9946f ), data: HARD( 0.7, 0, 0, 0.96 ) };
	// Nine broad overlapping strakes, continuous curves with copper clenches.
	const N = 46;
	for ( let i = 0; i < N; i ++ ) {
		const z0 = - 3.43 + i * 7.06 / N, z1 = z0 + 7.06 / N;
		for ( const s of [ - 1, 1 ] ) {
			for ( let j = 0; j < 9; j ++ ) {
				const a = Math.max( 0, ( j - 0.08 ) / 9 ), b = ( j + 1 ) / 9;
				B.slab( 'wood', [ shell( z0, a, s ), shell( z1, a, s ), shell( z1, b, s ), shell( z0, b, s ) ], 0.033,
					{ ...( j === 8 ? cream : j < 6 ? paint : oak ), data: WOOD( 0.13 + j * 0.079, 0.2, j === 8 || j < 6 ? 0.9 : 0 ), uDir: new Vector3( 0, 0, 1 ) } );
				if ( i % 3 === 0 && j > 2 ) {
					const p = shell( z0, b - 0.028, s, 0.038 );
					B.box( 'hard', p.x, p.y, p.z, 0.012, 0.012, 0.013, brass );
				}
			}
			B.beam( 'wood', [ s * landingWidth( z0 ), sheer( z0 ) + 0.018, z0 ], [ s * landingWidth( z1 ), sheer( z1 ) + 0.018, z1 ], 0.1, 0.095, oak );
			B.beam( 'wood', [ s * ( landingWidth( z0 ) - 0.052 ), sheer( z0 ) - 0.15, z0 ], [ s * ( landingWidth( z1 ) - 0.052 ), sheer( z1 ) - 0.15, z1 ], 0.032, 0.055, oak );
		}
	}
	B.beam( 'wood', [ 0, - 0.53, - 3.44 ], [ 0, - 0.53, 3.64 ], 0.13, 0.14, oak );
	B.beam( 'wood', [ 0, - 0.49, 3.64 ], [ 0, 1.4, 3.64 ], 0.13, 0.1, oak );
	B.beam( 'wood', [ 0, - 0.49, - 3.44 ], [ 0, 1.34, - 3.44 ], 0.13, 0.1, oak );
	// Bent frames inside the planking, with longitudinal seat risers.
	for ( let z = - 2.9; z < 3.1; z += 0.43 ) for ( const s of [ - 1, 1 ] ) {
		for ( let k = 2; k < 12; k ++ ) {
			const a = shell( z, k / 12, s, 0.055 ), b = shell( z, ( k + 1 ) / 12, s, 0.055 );
			B.beam( 'wood', a.toArray(), b.toArray(), 0.042, 0.05, pale );
		}
	}
	// Fore-and-aft duckboards: narrow boards, small open seams, staggered butt ends.
	for ( let x = - 0.78, col = 0; x <= 0.78; x += 0.156, col ++ ) {
		let start = - 2.97;
		while ( start < 3.06 && landingWidth( start ) * 0.72 < Math.abs( x ) + 0.074 ) start += 0.03;
		let end = 3.06;
		while ( end > start && landingWidth( end ) * 0.72 < Math.abs( x ) + 0.074 ) end -= 0.03;
		const mid = - 0.5 + ( col % 3 ) * 0.47;
		for ( const [ a, b ] of [ [ start, mid - 0.003 ], [ mid + 0.003, end ] ] ) {
			if ( b <= a ) continue;
			B.box( 'wood', x, LANDING_FLOOR, ( a + b ) / 2, b - a, 0.058, 0.149,
				{ ...pale, data: WOOD( 0.15 + col * 0.069, 0.24, 0 ), ry: Math.PI / 2 } );
		}
	}
	// Thwarts, knees and fasteners; the forward passenger has a visible seat edge.
	for ( const z of [ - 2.3, - 0.4, 1.42 ] ) {
		B.box( 'wood', 0, 0.81, z, landingWidth( z ) * 1.83, 0.09, 0.37, pale );
		for ( const s of [ - 1, 1 ] ) {
			const x = s * landingWidth( z ) * 0.84;
			B.beam( 'wood', [ x, 0.77, z ], [ s * landingWidth( z ) * 0.94, 0.47, z ], 0.09, 0.08, oak );
			for ( const dz of [ - 0.12, 0.12 ] ) B.cyl( 'hard', x, 0.86, z + dz, 0.014, 0.014, 0.005, { ...brass, segs: 8 } );
		}
	}
	// Small triangular breast-hooks close both pointed ends without a flat floating lid.
	for ( const [ z, tip ] of [ [ 2.93, 3.64 ], [ - 2.91, - 3.44 ] ] ) {
		B.slab( 'wood', [ new Vector3( - landingWidth( z ) * 0.94, 1.08, z ), new Vector3( 0, 1.29, tip ), new Vector3( landingWidth( z ) * 0.94, 1.08, z ) ], 0.065, { ...oak, up: new Vector3( 0, 1, 0 ) } );
	}
	// Painted supply chest with individual slats, hinged lid, straps and brass latch.
	for ( let k = 0; k < 5; k ++ ) B.box( 'wood', 0.3, 0.43 + k * 0.075, 2.24, 0.63, 0.072, 0.73, { ...paint, data: WOOD( 0.2 + k * 0.13, 0.15, 0.83 ) } );
	B.box( 'wood', 0.3, 0.79, 2.24, 0.68, 0.07, 0.78, oak );
	for ( const z of [ 1.99, 2.49 ] ) {
		B.box( 'hard', 0.3, 0.82, z, 0.69, 0.012, 0.035, iron );
		for ( const x of [ - 0.03, 0.63 ] ) B.box( 'hard', x, 0.6, z, 0.012, 0.41, 0.035, iron );
	}
	B.box( 'hard', 0.3, 0.75, 1.862, 0.055, 0.12, 0.018, brass );
	// Wrapped packet and folded canvas bag, lashed to the forward stores.
	const paper = { tint: lin( 0xded1ae ), data: HARD( 0.1, 0, 0, 0.91 ) };
	B.box( 'hard', 0.25, 0.846, 2.21, 0.33, 0.022, 0.24, { ...paper, ry: - 0.16 } );
	B.box( 'hard', 0.25, 0.86, 2.21, 0.008, 0.008, 0.255, rope );
	B.box( 'hard', 0.25, 0.86, 2.21, 0.35, 0.008, 0.008, rope );
	B.cyl( 'hard', 0.3, 0.861, 2.2, 0.019, 0.019, 0.004, { tint: lin( 0x73352c ), data: HARD( 0.3, 0, 0, 0.75 ), segs: 12 } );
	const canvas = { tint: lin( 0x8a8265 ), data: HARD( 0.4, 0, 0, 0.95 ) };
	B.lathe( 'hard', - 0.53, 0.4, 2.5, [ [ 0.16, 0 ], [ 0.23, 0.06 ], [ 0.21, 0.25 ], [ 0.1, 0.36 ], [ 0.02, 0.4 ] ], { ...canvas, segs: 16 } );
	ropeCoil( B, - 0.38, 0.41, 1.98, 0.016, 0.2, 5, 0.41 );
	B.tube( 'hard', [ new Vector3( - 0.5, 0.43, 2.02 ), new Vector3( - 0.65, 0.43, 2.3 ), new Vector3( - 0.71, 0.7, 2.86 ), new Vector3( - 0.5, 1.12, 3.03 ) ], 0.014, rope );
	// Cleats and leather-protected bronze rowlocks.
	for ( const z of [ 2.9, - 2.85 ] ) {
		B.box( 'hard', 0, 1.18, z, 0.19, 0.028, 0.09, iron );
		for ( const x of [ - 0.05, 0.05 ] ) B.cyl( 'hard', x, 1.19, z, 0.019, 0.024, 0.07, iron );
		B.rod( 'hard', [ - 0.15, 1.27, z ], [ 0.15, 1.27, z ], 0.022, 0.022, iron );
	}
	for ( const s of [ - 1, 1 ] ) {
		const x = s * 1.16, z = - 0.65;
		B.box( 'wood', x, 1.07, z, 0.14, 0.07, 0.29, oak );
		B.cyl( 'hard', x, 1.1, z, 0.038, 0.033, 0.14, brass );
		for ( const dz of [ - 0.057, 0.057 ] ) B.rod( 'hard', [ x, 1.18, z + dz ], [ x, 1.32, z + dz ], 0.018, 0.018, brass );
		const O = new Builder(), oar = new Group();
		oar.position.set( x, 1.25, z );
		O.rod( 'wood', [ - s * 0.85, 0, 0 ], [ s * 2.45, - 0.39, 0 ], 0.039, 0.029, pale );
		O.rod( 'wood', [ - s * 0.85, 0, 0 ], [ - s * 0.63, - 0.026, 0 ], 0.027, 0.027, oak );
		O.box( 'hard', 0, 0, 0, 0.17, 0.088, 0.087, { tint: lin( 0x59452f ), data: HARD( 0.1, 0, 0, 0.8 ), rz: - s * 0.12 } );
		// Tapered, rounded-ended blade, instead of a rectangular paddle stuck on a rod.
		const blade = [ [ 1.82, 0.04 ], [ 2.02, 0.105 ], [ 2.68, 0.12 ], [ 2.82, 0.055 ], [ 2.85, 0 ], [ 2.82, - 0.055 ], [ 2.68, - 0.12 ], [ 2.02, - 0.105 ], [ 1.82, - 0.04 ] ];
		O.slab( 'wood', blade.map( ( [ a, z ] ) => new Vector3( s * a, - a * 0.16, z ) ), 0.024, { ...pale, up: new Vector3( 0, 1, 0 ), uDir: new Vector3( 1, 0, 0 ) } );
		meshes( O, oar, mats, 'arrival-oar' ); group.add( oar ); oars.push( oar );
	}
	const C = new Builder(), rower = new Group();
	// Boatman facing aft: oilskin cape, knitted cap, trousers and separate boots.
	const coat = { tint: lin( 0x6f6a4f ), data: HARD( 0.6, 0, 0, 0.76 ) };
	const wool = { tint: lin( 0x343c3c ), data: HARD( 0.2, 0, 0, 0.98 ) };
	const skin = { tint: lin( 0xab856b ), data: HARD( 0.2, 0, 0, 0.88 ) };
	const boot = { tint: lin( 0x322b25 ), data: HARD( 0.4, 0, 0, 0.64 ) };
	C.lathe( 'cloth', 0, 0.86, - 0.42, [ [ 0.24, 0 ], [ 0.3, 0.12 ], [ 0.27, 0.46 ], [ 0.19, 0.57 ] ], { ...coat, segs: 24 } );
	C.lathe( 'cloth', 0, 1.36, - 0.42, [ [ 0.09, 0 ], [ 0.13, 0.04 ], [ 0.09, 0.09 ] ], { ...wool, segs: 20 } );
	C.lathe( 'hard', 0, 1.41, - 0.45, [ [ 0.062, 0 ], [ 0.09, 0.045 ], [ 0.113, 0.12 ], [ 0.105, 0.22 ], [ 0.06, 0.265 ], [ 0, 0.28 ] ], { ...skin, segs: 24 } );
	C.cyl( 'hard', 0, 1.54, - 0.55, 0.018, 0.027, 0.05, { ...skin, rx: - Math.PI / 2, segs: 10 } );
	// Small face features, ears and collar; readable on an exterior inspection.
	const beard = { tint: lin( 0x5e5548 ), data: HARD( 0.8, 0, 0, 0.96 ) };
	for ( const s of [ - 1, 1 ] ) {
		C.cyl( 'hard', s * 0.11, 1.54, - 0.45, 0.023, 0.023, 0.025, { ...skin, rz: s * Math.PI / 2, segs: 12 } );
		C.box( 'cloth', s * 0.043, 1.585, - 0.551, 0.018, 0.006, 0.006, wool );
		C.beam( 'cloth', [ s * 0.11, 1.38, - 0.47 ], [ s * 0.08, 1.3, - 0.61 ], 0.09, 0.022, coat );
	}
	C.lathe( 'cloth', 0, 1.445, - 0.495, [ [ 0.06, 0 ], [ 0.095, 0.04 ], [ 0.088, 0.08 ] ], { ...beard, segs: 20 } );
	C.beam( 'cloth', [ 0, 0.93, - 0.715 ], [ 0, 1.31, - 0.62 ], 0.024, 0.016, wool );
	for ( const y of [ 1.0, 1.12, 1.24 ] ) C.box( 'hard', 0.022, y, - 0.7 + ( y - 1 ) * 0.25, 0.014, 0.014, 0.013, iron );
	C.lathe( 'cloth', 0, 1.64, - 0.45, [ [ 0.132, 0 ], [ 0.132, 0.035 ], [ 0.113, 0.035 ], [ 0.11, 0.11 ], [ 0.025, 0.15 ] ], { ...wool, segs: 24 } );
	for ( const s of [ - 1, 1 ] ) {
		C.rod( 'cloth', [ s * 0.14, 0.9, - 0.5 ], [ s * 0.2, 0.61, - 0.97 ], 0.11, 0.09, wool );
		C.rod( 'cloth', [ s * 0.2, 0.61, - 0.97 ], [ s * 0.19, 0.43, - 0.87 ], 0.085, 0.07, wool );
		C.box( 'hard', s * 0.19, 0.42, - 1.0, 0.17, 0.14, 0.32, boot );
		const A = new Builder(), arm = new Group();
		arm.position.set( s * 0.22, 1.33, - 0.42 );
		A.rod( 'hard', [ 0, 0, 0 ], [ s * 0.17, - 0.26, - 0.3 ], 0.093, 0.065, coat );
		A.rod( 'hard', [ s * 0.17, - 0.26, - 0.3 ], [ s * 0.12, - 0.1, - 0.25 ], 0.065, 0.043, coat );
		A.rod( 'hard', [ s * 0.12, - 0.1, - 0.25 ], [ s * 0.13, - 0.08, - 0.27 ], 0.054, 0.052, skin );
		meshes( A, arm, mats, 'arrival-rower-arm' ); rower.add( arm ); arms.push( arm );
	}
	meshes( C, rower, mats, 'arrival-rower' ); group.add( rower );
	meshes( B, group, mats, 'arrival' );
	// Closed exclusion volume follows the actual tapered hull, not a vertically
	// extruded waterplane (which cuts dark wedges out of the sea beside the boat).
	const M = new Builder();
	for ( let i = 0; i < N; i ++ ) {
		const z0 = - 3.43 + i * 7.06 / N, z1 = z0 + 7.06 / N;
		for ( const s of [ - 1, 1 ] ) for ( let j = 0; j < 9; j ++ ) {
			M.slab( 'wood', [ shell( z0, j / 9, s ), shell( z1, j / 9, s ), shell( z1, ( j + 1 ) / 9, s ), shell( z0, ( j + 1 ) / 9, s ) ], 0 );
		}
		for ( const t of [ 0, 1 ] ) M.slab( 'wood', [ shell( z0, t, - 1 ), shell( z1, t, - 1 ), shell( z1, t, 1 ), shell( z0, t, 1 ) ], 0 );
	}
	for ( const z of [ - 3.43, 3.63 ] ) {
		const end = [];
		for ( let j = 0; j <= 9; j ++ ) end.push( shell( z, j / 9, 1 ) );
		for ( let j = 9; j >= 0; j -- ) end.push( shell( z, j / 9, - 1 ) );
		M.slab( 'wood', end, 0 );
	}
	return { oars, arms, rower, hullVolume: M.batches.wood.build(), materials: mats, triangles: B.triangles + C.triangles };
}
