import { Group, Mesh, Vector3, Quaternion, CylinderGeometry, TorusGeometry, SphereGeometry, CircleGeometry, RoundedBoxGeometry, TubeGeometry, CatmullRomCurve3, mergeGeometries } from '../engine/index.js';
import { standard, physical } from '../materials/Materials.js';
import { grabberBadge } from './GrabberBadge.js';

// Original, metre-scale model. Static parts are merged by finish, with only the
// claw hinges, induction rotor and gauge needle kept separate for articulation.
export function createGravityGrabberModel() {
	const group = new Group(); group.name = 'Admiralty No. 03 · gravity manipulator';
	const wear = 'let grain = sin( in.uv.x * 713.0 + sin( in.uv.y * 131.0 ) * 2.0 ) * sin( in.uv.y * 547.0 ); let tarnish = smoothstep( .55, .9, sin( in.uv.x * 47.0 + sin( in.uv.y * 39.0 ) ) * .5 + .5 ); s.roughness = clamp( s.roughness + grain * 0.055 + tarnish * .16, 0.12, 0.8 ); s.albedo = mix( s.albedo * ( 0.92 + 0.08 * grain ), s.albedo * vec3f( .44, .54, .48 ), tarnish * .4 );';
	const brass = physical( { name: 'brushed aged brass', color: 0xc49747, metalness: .82, roughness: .29, clearcoat: .25, surface: wear } );
	const copper = standard( { name: 'wound copper', color: 0xb4683f, metalness: .87, roughness: .28, surface: wear } );
	const steel = standard( { name: 'blued machined steel', color: 0x293b40, metalness: .8, roughness: .3, surface: wear } );
	const ceramic = physical( { name: 'ivory ceramic insulator', color: 0xe0d7ba, roughness: .28, clearcoat: .55 } );
	const leather = standard( { name: 'ribbed oxblood leather', color: 0x3c2521, roughness: .85, surface: 's.albedo *= 0.87 + 0.13 * sin( in.uv.x * 121.0 ) * sin( in.uv.y * 97.0 );' } );
	const glow = standard( { name: 'contained turquoise induction', color: 0x063d40, emissive: 0x3cf6d7, emissiveIntensity: 2.4, roughness: .22, defines: { NO_LOCAL_LIGHTS: 1 } } );
	const amber = standard( { name: 'amber charge lamp', color: 0x5a2705, emissive: 0xffac39, emissiveIntensity: 1.8, roughness: .3, defines: { NO_LOCAL_LIGHTS: 1 } } );
	const batches = new Map();
	const add = ( parent, geometry, mat, position = [ 0, 0, 0 ], rotation = [ 0, 0, 0 ] ) => {
		const temp = new Mesh( geometry, mat ); temp.position.set( ...position ); temp.rotation.set( ...rotation ); temp.updateMatrix();
		const g = geometry.index ? geometry.toNonIndexed() : geometry;
		g.applyMatrix4( temp.matrix );
		if ( ! batches.has( parent ) ) batches.set( parent, new Map() );
		const map = batches.get( parent ); if ( ! map.has( mat ) ) map.set( mat, [] ); map.get( mat ).push( g );
	};
	const cyl = ( parent, mat, radius, length, z, x = 0, y = 0, sides = 32 ) => add( parent, new CylinderGeometry( radius, radius, length, sides ), mat, [ x, y, z ], [ Math.PI / 2, 0, 0 ] );
	const ring = ( parent, mat, radius, tube, z, x = 0, y = 0 ) => add( parent, new TorusGeometry( radius, tube, 8, 48 ), mat, [ x, y, z ] );
	const link = ( parent, mat, a, b, radius, sides = 10 ) => {
		const start = new Vector3( ...a ), end = new Vector3( ...b ), delta = end.clone().sub( start );
		const geometry = new CylinderGeometry( radius, radius, delta.length(), sides );
		geometry.applyQuaternion( new Quaternion().setFromUnitVectors( new Vector3( 0, 1, 0 ), delta.normalize() ) );
		add( parent, geometry, mat, start.add( end ).multiplyScalar( .5 ).toArray() );
	};
	// Ribbed receiver, replaceable porcelain cartridge, copper windings and cage rails.
	cyl( group, steel, .102, .16, .065 ); cyl( group, brass, .113, .027, .145 );
	const badge = standard( { name: 'engraved Admiralty 03 stamp', color: 0xffffff, metalness: .65, roughness: .5, textures: { makerStamp: grabberBadge() }, surface: 's.albedo = srgbToLinear( textureSample( makerStamp, smpLinearClamp, in.uv ).rgb );' } );
	add( group, new CircleGeometry( .094, 64 ), badge, [ 0, 0, .16 ] );
	for ( let i = 0; i < 6; i ++ ) { const a = i * Math.PI / 3; cyl( group, steel, .006, .004, .161, Math.cos( a ) * .103, Math.sin( a ) * .103, 6 ); }
	cyl( group, ceramic, .087, .245, - .13 ); cyl( group, glow, .069, .26, - .13 );
	for ( const z of [ .015, - .275, - .318 ] ) { cyl( group, brass, .116, .025, z ); ring( group, copper, .113, .009, z ); }
	for ( let i = 0; i < 15; i ++ ) ring( group, copper, .09, .0045, - .035 - i * .0145 );
	for ( let i = 0; i < 6; i ++ ) {
		const a = i * Math.PI / 3, x = Math.cos( a ) * .108, y = Math.sin( a ) * .108;
		link( group, steel, [ x, y, .01 ], [ x, y, - .278 ], .009 );
		cyl( group, brass, .012, .035, .026, x, y, 6 );
		cyl( group, steel, .005, .003, .045, x, y, 6 );
	}
	for ( let i = 0; i < 6; i ++ ) ring( group, brass, .105, .005, .02 + i * .017 );
	// An open induction throat, with a rotating scalloped armature.
	ring( group, steel, .103, .021, - .34 ); ring( group, glow, .083, .006, - .356 );
	const rotor = new Group(); rotor.name = 'induction rotor'; group.add( rotor );
	for ( let i = 0; i < 12; i ++ ) {
		const a = i * Math.PI / 6;
		add( rotor, new RoundedBoxGeometry( .015, .036, .023, 1, .004 ), brass, [ Math.cos( a ) * .082, Math.sin( a ) * .082, - .343 ], [ 0, 0, a - Math.PI / 2 ] );
	}
	add( group, new SphereGeometry( .05, 24, 16 ), glow, [ 0, 0, - .325 ] );
	// Three articulated fingers with pivot hardware and glowing ceramic fingertips.
	const claws = [];
	for ( let i = 0; i < 3; i ++ ) {
		const pivot = new Group(); pivot.name = 'articulated claw ' + ( i + 1 ); pivot.position.z = - .315; pivot.rotation.z = i * Math.PI * 2 / 3;
		const finger = new Group(); pivot.add( finger ); group.add( pivot ); claws.push( finger );
		link( finger, brass, [ 0, .105, 0 ], [ 0, .164, - .115 ], .023 );
		link( finger, steel, [ 0, .164, - .115 ], [ 0, .117, - .233 ], .018 );
		link( finger, ceramic, [ 0, .117, - .233 ], [ 0, .081, - .264 ], .013 );
		add( finger, new SphereGeometry( .015, 12, 8 ), glow, [ 0, .081, - .264 ] );
		add( finger, new CylinderGeometry( .035, .035, .055, 12 ), copper, [ 0, .11, - .005 ], [ 0, 0, Math.PI / 2 ] );
		add( finger, new CylinderGeometry( .021, .021, .061, 6 ), brass, [ 0, .11, - .005 ], [ 0, 0, Math.PI / 2 ] );
	}
	// Leather pistol grip, actual trigger guard, return hose, toggle and maker's plate.
	add( group, new RoundedBoxGeometry( .074, .185, .098, 3, .016 ), leather, [ 0, - .139, .059 ], [ - .24, 0, 0 ] );
	for ( let i = 0; i < 6; i ++ ) add( group, new RoundedBoxGeometry( .079, .009, .092, 1, .004 ), steel, [ 0, - .082 - i * .022, .072 - i * .006 ], [ - .24, 0, 0 ] );
	add( group, new RoundedBoxGeometry( .082, .019, .093, 2, .008 ), brass, [ 0, - .233, .037 ] );
	const guard = new CatmullRomCurve3( [ new Vector3( 0, - .06, - .06 ), new Vector3( 0, - .105, - .118 ), new Vector3( 0, - .185, - .09 ), new Vector3( 0, - .199, .015 ) ] );
	add( group, new TubeGeometry( guard, 28, .008, 8 ), brass );
	link( group, steel, [ 0, - .065, - .031 ], [ 0, - .126, - .047 ], .008 );
	const hose = new CatmullRomCurve3( [ new Vector3( .073, - .028, .1 ), new Vector3( .15, - .085, .139 ), new Vector3( .144, - .222, .075 ), new Vector3( .037, - .222, .03 ) ] );
	add( group, new TubeGeometry( hose, 42, .011, 8 ), leather );
	add( group, new RoundedBoxGeometry( .018, .052, .131, 2, .007 ), brass, [ .107, .01, .062 ] );
	for ( let i = 0; i < 3; i ++ ) add( group, new SphereGeometry( .01, 12, 8 ), i === 0 ? amber : glow, [ .119, .018, .099 - i * .036 ] );
	// A real dial: engraved tick ring, red danger sector, separate swinging needle.
	const gauge = new Group(); gauge.name = 'pressure dial'; gauge.position.set( 0, .134, .049 ); gauge.rotation.x = - .58; group.add( gauge );
	cyl( gauge, brass, .055, .025, 0 ); ring( gauge, steel, .048, .005, .016 );
	const dial = standard( { name: 'engraved pressure dial', color: 0xe9dcb6, roughness: .76, surface: `
		let q = in.uv * 2.0 - 1.0; let r = length( q ); let a = atan2( q.y, q.x );
		let tick = step( 0.86, cos( a * 24.0 ) ) * smoothstep( 0.66, 0.72, r ) * ( 1.0 - smoothstep( 0.91, 0.95, r ) );
		s.albedo = mix( s.albedo, vec3f( .055, .065, .055 ), tick );
		s.albedo = mix( s.albedo, vec3f( .52, .05, .026 ), smoothstep( .74, .79, r ) * ( 1.0 - step( .87, r ) ) * step( .8, a ) * ( 1.0 - step( 1.7, a ) ) );` } );
	add( gauge, new CircleGeometry( .046, 48 ), dial, [ 0, 0, .017 ] );
	const needle = new Group(); needle.name = 'live pressure needle'; gauge.add( needle );
	add( needle, new RoundedBoxGeometry( .004, .033, .003, 1, .001 ), steel, [ 0, .013, .019 ] );
	add( gauge, new SphereGeometry( .005, 10, 6 ), brass, [ 0, 0, .021 ] );
	for ( const [ parent, materials ] of batches ) for ( const [ mat, geometries ] of materials ) {
		const mesh = new Mesh( mergeGeometries( geometries ), mat ); mesh.name = mat.name; mesh.castShadow = false; mesh.frustumCulled = false; parent.add( mesh );
	}
	let triangles = 0, draws = 0;
	group.traverse( o => { if ( o.isMesh ) { triangles += o.geometry.attributes.position.count / 3; draws ++; } } );
	return { group, claws, rotor, needle, glow, amber, triangles, draws,
		animate( time, grip, charge ) {
			for ( const claw of claws ) claw.rotation.x = - .12 - grip * .22 + Math.sin( time * 2.2 ) * .012;
			rotor.rotation.z = time * ( .6 + grip * 1.6 + charge * 3 );
			needle.rotation.z = 1.8 - grip * 1.9 - charge * .7;
			glow.emissiveIntensity = 1.3 + grip * 1.5 + charge * 2;
			amber.emissiveIntensity = 1 + charge * 3;
		},
	};
}
