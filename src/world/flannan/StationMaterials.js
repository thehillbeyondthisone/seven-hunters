import { standard, physical } from '../../materials/Materials.js';
import { villageMaterialModule } from '../village/VillageMaterials.js';

// Station finishes reuse the baked grain at metre scale, with indoor wear rules.
// tint is the actual linear albedo, rather than a multiplier on silver driftwood.
// vdata retains WOOD's seed / paint / pattern / weather layout. Board and panel
// construction belongs to geometry; the grain always follows the builder's u axis.
function stationSurface( T, names, params = {} ) {

	const textures = Object.fromEntries( names.map( ( name ) => [ 'station' + name, T[ name ] ] ) );
	return standard( {
		roughness: 0.75, metalness: 0, ...params,
		modules: [ villageMaterialModule ],
		attributes: { tint: 'vec3f', vdata: 'vec4f' },
		varyings: { vTint: 'vec3f', vData: 'vec4f' },
		vertex: '\to.vTint = v.tint;\n\to.vData = v.vdata;\n',
		textures,
	} );

}

export function createStationTimber( T, floor = false ) {

	const m = stationSurface( T, [ 'woodA', 'woodN', 'paintN' ], { defines: floor ? { STATION_BOARDS: 1 } : {} } );
	m.name = floor ? 'StationFloorboards' : 'StationJoinery';
	m.surface = /* wgsl */`
	let data = in.vs.vData;
	let cap = step( 1500.0, in.uv.x );
	let end = step( 500.0, in.uv.x );
	var uv = in.uv - vec2f( mix( 1000.0, 2000.0, cap ) * end, 0.0 );
	var seed = data.x;
	var seam = 0.0;
	var seamSlope = vec2f( 0.0 );
#if STATION_BOARDS
	// 190 mm boards with staggered 2.8 m lengths. Continuous planar mapping
	// keeps their scale and direction through the room, circular deck and hatch.
	let row = floor( uv.y / 0.19 );
	let offset = floor( vlmHash21( row, 2.7 ) * 4.0 ) * 0.7;
	let lengthId = floor( ( uv.x + offset ) / 2.8 );
	seed = vlmHash21( row + data.x * 19.0, lengthId + 4.1 );
	let across = fract( uv.y / 0.19 ) * 0.19;
	let along = fract( ( uv.x + offset ) / 2.8 ) * 2.8;
	let distance = vec2f( min( along, 2.8 - along ), min( across, 0.19 - across ) );
	let aa = max( fwidth( uv ), vec2f( 0.0003 ) );
	let gap = ( clamp( vec2f( 0.002 ) - distance + aa * 0.5, vec2f( 0.0 ), aa ) - clamp( vec2f( - 0.002 ) - distance + aa * 0.5, vec2f( 0.0 ), aa ) ) / aa;
	seam = max( gap.x, gap.y );
	let bevel = exp( - distance / vec2f( 0.003 ) ) * ( 1.0 - smoothstep( vec2f( 0.003 ), vec2f( 0.015 ), aa ) );
	seamSlope = bevel * select( vec2f( - 0.12 ), vec2f( 0.12 ), vec2f( along, across ) > vec2f( 1.4, 0.095 ) );
#endif
	let off = vec2f( vlmHash21( seed * 137.0, 1.3 ), vlmHash21( seed * 137.0, 7.9 ) );
	let grainUV = uv * vec2f( 0.38, 0.8 ) + off;
	let A = textureSample( stationwoodA, smpAnisoRepeat, grainUV );
	let N = textureSample( stationwoodN, smpAnisoRepeat, grainUV );
	let P = textureSample( stationpaintN, smpAnisoRepeat, uv * vec2f( 0.5, 1.5 ) + off );
	// Compress the old outdoor texture's cracks and bleaching into fine indoor grain.
	let grain = clamp( ( luminance( A.rgb ) - 0.3 ) * 1.25 + 1.0, 0.72, 1.16 );
	let tone = 0.92 + vlmHash21( seed * 91.0, 3.8 ) * 0.16;
	let raw = in.vs.vTint * grain * tone * mix( 1.0, 0.82, end );
	let painted = step( 0.01, data.y );
	// Kept paint: brush relief and only a trace of exposed grain, no large flakes.
	let paint = in.vs.vTint * ( 0.97 + P.b * 0.06 );
	s.albedo = mix( raw, paint, painted ) * ( 1.0 - seam * 0.55 );
	s.roughness = mix( 0.72 + N.b * 0.1, 0.53 + P.b * 0.12, painted );
	s.ao = mix( 0.94 + N.a * 0.06, 1.0, painted ) * ( 1.0 - seam * 0.25 );
	let slope = mix( vlmSlopeOf( N ) * 0.16, vlmSlopeOf( P ) * 0.12 + vlmSlopeOf( N ) * 0.025, painted );
	s.normal = vlmNormalFromSlope( in.P, in.N, uv, slope + seamSlope );
`;
	return m;

}

export function createStationFlags( T ) {

	const m = stationSurface( T, [ 'stoneN', 'grime' ] );
	m.name = 'StationStoneFlags';
	m.surface = /* wgsl */`
	// Planar metres: radial wall UVs collapsed to a fan on the tower floor.
	let uv = in.P.xz;
	let row = floor( uv.y / 0.56 );
	let q = uv + vec2f( fract( row * 0.5 ) * 0.76, 0.0 );
	let cell = floor( q / vec2f( 0.76, 0.56 ) );
	let local = fract( q / vec2f( 0.76, 0.56 ) ) * vec2f( 0.76, 0.56 );
	let distance = min( local, vec2f( 0.76, 0.56 ) - local );
	let aa = max( fwidth( uv ), vec2f( 0.0005 ) );
	let gaps = clamp( ( vec2f( 0.002 ) - distance ) / aa + 0.5, vec2f( 0.0 ), vec2f( 1.0 ) ) * min( vec2f( 1.0 ), vec2f( 0.004 ) / aa );
	let seam = max( gaps.x, gaps.y );
	let G = textureSample( stationgrime, smpAnisoRepeat, uv * 0.7 );
	let N = textureSample( stationstoneN, smpAnisoRepeat, uv * 1.7 );
	let tone = 0.9 + vlmHash21( cell.x, cell.y + in.vs.vData.x ) * 0.16;
	s.albedo = in.vs.vTint * tone * ( 0.94 + G.a * 0.12 ) * ( 1.0 - seam * 0.5 );
	s.roughness = 0.82 + G.a * 0.08;
	s.ao = 1.0 - seam * 0.2;
	s.normal = vlmNormalFromSlope( in.P, in.N, uv, vlmSlopeOf( N ) * 0.035 );
`;
	return m;

}

// Materials of the light station's own (Station.js assembleStation): the lantern's glazing and the lens.

// The lantern's sixteen panes: thin clear glass with a salt bloom (the boat's glass, src/world/boat/
// BoatMaterials.js), blended in the late pass so the lens and the lamp show through.
export function createLanternGlass() {

	const m = physical( {
		color: 0xb8c6c4, roughness: 0.05, metalness: 0, ior: 1.5,
		transparent: true, opacity: 0.2, side: 'double', depthWrite: false,
		// what is seen through the glass moves, the glass doesn't: keep the velocity of what lies behind
		velocityWeight: 0,
	} );
	m.name = 'lanternGlass';
	m.surface = /* wgsl */`
	let u = in.uv;
	let salt = sat( sin( u.x * 37.0 + sin( u.y * 11.0 ) * 2.0 ) * sin( u.y * 23.0 + u.x * 5.0 ) * 0.5 + 0.5 );
	let edge = 1.0 - smoothstep( 0.0, 0.12, min( min( u.x, 1.0 - u.x ), min( u.y, 1.0 - u.y ) ) );
	s.albedo = mat.color;
	s.alpha = 0.07 + salt * 0.06 + edge * 0.12;
	s.roughness = 0.03 + salt * 0.2;
`;
	m.output = /* wgsl */`
	r.velocity = vec4f( 0.0 );
`;
	return m;

}

// The lens: a drum of prism rings round the flame with four bullseye panels in two pairs, 25° apart in a
// pair, the pairs opposite: turning once a minute, it gives the light's character, two flashes every 30 s
// (src/station/Lamp.js). Its local frame has y = 0 on the focal plane; the group turns by -angle about y,
// so a panel at local azimuth c faces world azimuth c + angle (atan2( z, x )).
//   glow: the flame (0 out .. 1 burning bright); angle: the lens's turn (radians)
export const BULLSEYES = [ 0, 25 * Math.PI / 180, Math.PI, Math.PI + 25 * Math.PI / 180 ];

export function createLensMaterial() {

	const m = standard( {
		color: 0xa4bbb1, roughness: 0.06, metalness: 0,
		defines: { NO_LOCAL_LIGHTS: 1 },
		uniforms: { glow: [ 'f32', 0 ], angle: [ 'f32', 0 ] },
		varyings: { vLocal: 'vec3f' },
		vertex: /* wgsl */`
	o.vLocal = v.position;
`,
	} );
	m.name = 'lens';
	m.surface = /* wgsl */`
	let lp = in.vs.vLocal;
	let az = atan2( lp.z, lp.x );
	let R = max( length( lp.xz ), 0.05 );
	// the horizontal prism rings of the refracting belt and the crowns
	let belt = 0.5 + 0.5 * cos( lp.y * 6.2831853 / 0.045 );
	// which way the viewer looks at the lens, about its axis, and how far above or below its plane
	let vaz = atan2( in.V.z, in.V.x );
	let vy = in.V.y;
	var bull = 0.0;
	var nearest = 10.0;
	var flash = 0.0;
	var cs = array<f32, 4>( ${ BULLSEYES.map( ( v ) => v.toFixed( 6 ) ).join( ', ' ) } );
	for ( var i = 0; i < 4; i++ ) {
		let c = cs[ i ];
		let da = atan2( sin( az - c ), cos( az - c ) );
		let d = length( vec2f( da * R, lp.y ) );
		nearest = min( nearest, d );
		let inside = 1.0 - smoothstep( 0.32, 0.40, d );
		// concentric rings round the bullseye
		let rings = 0.5 + 0.5 * cos( d * 6.2831853 / 0.04 );
		bull = max( bull, inside * ( 0.55 + 0.45 * rings ) );
		// the panel's beam, as it sweeps past the viewer
		let w = c + mat.angle;
		let dv = atan2( sin( vaz - w ), cos( vaz - w ) );
		flash = max( flash, exp( - dv * dv / ( 2.0 * 0.09 * 0.09 ) ) * exp( - vy * vy / 0.35 ) * inside );
	}
	let flame = vec3f( 1.0, 0.78, 0.5 );
	let glass = mix( 0.25 + 0.35 * belt, 1.0, bull );
	let annuli = 0.5 + 0.5 * cos( nearest * 6.2831853 / 0.065 );
	let prism = mix( belt, annuli, 1.0 - smoothstep( 0.85, 1.25, nearest ) );
	s.albedo = mat.color * ( 0.58 + prism * 0.42 );
	s.roughness = mix( 0.035, 0.16, prism );
	// The flame's local point light is deliberately excluded: inverse-square
	// lighting a shell from inside flattened every prism to white. Preserve dark
	// grooves and concentrate the bright flash in the bullseyes themselves.
	let transmission = 0.012 + prism * 0.065 + bull * 0.02;
	s.emissive = flame * mat.glow * ( transmission + flash * 3.0 );
`;
	return m;

}
