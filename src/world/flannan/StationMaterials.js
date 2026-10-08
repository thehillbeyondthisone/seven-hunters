import { standard, physical } from '../../materials/Materials.js';
import { villageMaterialModule, createHardMaterial } from '../village/VillageMaterials.js';
import { terrainShadingModule, rot2 } from '../terrain/TerrainShading.js';

// Dedicated station finishes use baked normal/roughness detail at metre scale.
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

	const m = stationSurface( T, [ 'indoorWoodA', 'indoorWoodN', 'keptPaintN' ], { defines: floor ? { STATION_BOARDS: 1 } : {} } );
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
	let grainUV = uv / vec2f( 2.8, 0.76 ) + off;
	let A = textureSample( stationindoorWoodA, smpAnisoRepeat, grainUV );
	let N = textureSample( stationindoorWoodN, smpAnisoRepeat, grainUV );
	let P = textureSample( stationkeptPaintN, smpAnisoRepeat, uv / vec2f( 1.0, 0.5 ) + off );
	let grain = A.rgb;
	let tone = 0.92 + vlmHash21( seed * 91.0, 3.8 ) * 0.16;
	let raw = in.vs.vTint * grain * tone * mix( 1.0, 0.82, end );
	let painted = step( 0.01, data.y );
	// Kept paint: brush relief and only a trace of exposed grain, no large flakes.
	let paint = in.vs.vTint * ( 0.99 + ( P.b - 0.54 ) * 0.045 );
	s.albedo = mix( raw, paint, painted ) * ( 1.0 - seam * 0.55 );
	s.roughness = clamp( mix( N.b + seam * 0.12, P.b, painted ), 0.42, 0.9 );
	s.ao = mix( 0.94 + N.a * 0.06, 1.0, painted ) * ( 1.0 - seam * 0.25 );
	let slope = mix( vlmSlopeOf( N ) * 0.8, vlmSlopeOf( P ) * 0.7 + vlmSlopeOf( N ) * 0.06, painted );
	s.normal = vlmNormalFromSlope( in.P, in.N, uv, slope + seamSlope );
`;
	return m;

}

// Flannan masonry has roughly squared stones and thin mortar beds. Keep this
// separate from Tidewater's cellular rubble and heavily weathered plaster.
export function createStationMasonry( T ) {
	const m = stationSurface( T, [ 'stoneN', 'limeA', 'limeN', 'grime', 'stoneGrainA', 'stoneGrainN' ], { roughness: 0.92 } );
	m.name = 'FlannanMasonry';
	m.surface = /* wgsl */`
	let data = in.vs.vData;
	// Modes 3/4 are physical stones / recessed mortar. Their joints and bevels
	// are geometry, so never stamp the legacy rectangular masonry pattern here.
	if ( data.y > 2.5 ) {
		let aN = abs( in.N );
		let sideUV = select( in.P.xy, in.P.zy, aN.x > aN.z );
		let stoneUV = select( sideUV, in.P.xz, aN.y > max( aN.x, aN.z ) );
		let grainUV = stoneUV * 1.3 + vec2f( data.x * .13, data.x * .07 );
		let grain = textureSample( stationstoneGrainN, smpAnisoRepeat, grainUV );
		let colour = textureSample( stationstoneGrainA, smpAnisoRepeat, grainUV ).rgb;
		let wash = textureSample( stationgrime, smpAnisoRepeat, stoneUV * .62 + vec2f( data.x * .31 ) );
		let mortar = step( 3.5, data.y );
		s.albedo = in.vs.vTint * mix( colour * (1.0 - wash.r*.035), vec3f(.96 + grain.a*.05), mortar );
		s.normal = vlmNormalFromSlope( in.P, in.N, stoneUV, vlmSlopeOf( grain ) * mix( .85, .12, mortar ) );
		s.roughness = mix( grain.b, .95 + grain.b * .025, mortar );
		s.ao = mix( data.w, .93, mortar );
	} else {
	let cap = step( 1500.0, in.uv.x );
	let end = step( 500.0, in.uv.x );
	let uv = in.uv - vec2f( mix( 1000.0, 2000.0, cap ) * end, 0.0 );
	let plaster = 1.0 - step( 0.5, abs( data.y - 1.0 ) );
	let coursed = 1.0 - step( 1.5, data.y );
	let rowCoord = ( uv.y + sin( uv.x * 1.9 + data.x * 8.0 ) * 0.013 ) / 0.29;
	let row = floor( rowCoord );
	let stoneWidth = 0.48 + vlmHash21( row, data.x * 19.0 ) * 0.35;
	let u = uv.x + vlmHash21( row, 3.7 ) * 2.0;
	let cell = floor( u / stoneWidth );
	let id = vlmHash21( cell + data.x * 113.0, row );
	let d = vec2f( min( fract( u / stoneWidth ), 1.0 - fract( u / stoneWidth ) ) * stoneWidth, min( fract( rowCoord ), 1.0 - fract( rowCoord ) ) * 0.29 );
	let aa = max( fwidth( uv ), vec2f( 0.0008 ) );
	let gap = 1.0 - clamp( ( d - vec2f( 0.006, 0.009 ) ) / aa + 0.5, vec2f( 0.0 ), vec2f( 1.0 ) );
	let mortar = max( gap.x, gap.y ) * coursed;
	let grain = textureSample( stationstoneN, smpAnisoRepeat, uv * 3.7 + vec2f( data.x ) ).a;
	let wash = textureSample( stationgrime, smpAnisoRepeat, uv * 0.13 + vec2f( data.x, 0.7 ) );
	let limeUV = uv / 1.6 + vec2f( data.x * .37, data.x * .13 );
	let paint = textureSample( stationlimeN, smpAnisoRepeat, limeUV );
	let lime = textureSample( stationlimeA, smpAnisoRepeat, limeUV );
	let stone = in.vs.vTint * ( 0.73 + id * 0.45 ) * ( 0.96 + grain * 0.08 );
	let jointCol = in.vs.vTint * 0.48;
	var raw = mix( stone, jointCol, mortar * 0.78 );
	let kept = in.vs.vTint * ( 0.96 + lime.r * 0.08 ) * ( 1.0 - wash.r * 0.018 - lime.g * 0.012 );
	var col = mix( raw, kept, plaster );
	let foot = 1.0 - smoothstep( 0.04, 0.42, uv.y );
	col *= 1.0 - foot * mix( 0.12, 0.045, plaster );
	let bevel = exp( -d / vec2f( 0.024 ) ) * ( 1.0 - smoothstep( vec2f( 0.008 ), vec2f( 0.055 ), aa ) );
	let sign = select( vec2f( -1.0 ), vec2f( 1.0 ), vec2f( fract( u / stoneWidth ), fract( rowCoord ) ) > vec2f( 0.5 ) );
	let slope = bevel * sign * 0.22 * coursed;
	let film = vlmSlopeOf( paint ) * 0.8;
	s.normal = vlmNormalFromSlope( in.P, in.N, in.uv, mix( slope, film, plaster ) );
	s.albedo = col;
	s.roughness = mix( 0.9 + grain * 0.06, paint.b, plaster );
	s.ao = 1.0 - mortar * 0.16 * ( 1.0 - plaster );
	}
`;
	return m;
}

// Landing concrete is exposed cast material, not limewashed station plaster.
// World-space mapping keeps aggregate consistent across stage, risers and kerbs.
export function createLandingConcrete( T ) {
	const m = stationSurface( T, [ 'stoneGrainN', 'grime' ], { roughness: 0.92, uniforms: { arrivalDetail: [ 'f32', 1 ] } } );
	m.name = 'FlannanLandingConcrete';
	m.surface = /* wgsl */`
	let n = abs( in.N );
	let top = step( 0.65, n.y );
	let wallUV = select( in.P.xy, in.P.zy, n.x > n.z );
	let uv = mix( wallUV, in.P.xz, top );
	let grain = textureSample( stationstoneGrainN, smpAnisoRepeat, uv * 4.5 );
	let broad = textureSample( stationgrime, smpAnisoRepeat, uv * 0.19 );
	let fine = textureSample( stationgrime, smpAnisoRepeat, uv * 2.3 );
	let aggregate = textureSample( stationstoneGrainN, smpAnisoRepeat, uv * 1.3 );
	let detail = mat.arrivalDetail;
	let tide = 1.0 - smoothstep( 0.5, 2.5 + broad.a * .5, in.P.y );
	let damp = tide * 0.32 + top * broad.r * 0.13;
	let tone = 0.85 + broad.a * 0.28 + ( grain.a - 0.5 ) * 0.14;
	let runnel = smoothstep( .56, .77, fine.a * .55 + broad.a * .45 ) * ( 1.0 - top );
	let salt = smoothstep( .72, .9, grain.a ) * ( 1.0 - tide ) * .045;
	// Sparse construction lifts on vertical faces; no brick courses on concrete.
	let lift = min( fract( uv.y / 0.9 ), 1.0 - fract( uv.y / 0.9 ) ) * 0.9;
	let aa = max( fwidth( uv.y ), 0.0005 );
	let joint = clamp( ( 0.0015 - lift ) / aa + 0.5, 0.0, 1.0 ) * min( 1.0, 0.003 / aa ) * ( 1.0 - top );
	s.albedo = in.vs.vTint * tone * ( 1.0 - damp - fine.r * 0.07 - broad.r * 0.12 - joint * 0.2 - runnel * .12 ) + salt;
	s.roughness = 0.93 - tide * ( 0.17 + detail * 0.18 ) - top * broad.r * 0.06;
	s.ao = 1.0 - joint * 0.06;
	let close = 1.0 - smoothstep( 0.006, 0.045, max( length( fwidth( uv ) ), 0.0001 ) );
	s.normal = vlmNormalFromSlope( in.P, in.N, uv, vlmSlopeOf( grain ) * 0.07 + vlmSlopeOf( aggregate ) * detail * close * 0.42 );
`;
	return m;
}

// One merged batch of bedrock at the east landing, using existing baked maps.
// Grey mineral faces, oblique quartz seams, ochre lichen above a dark tidal belt.
export function createLandingRock( T ) {
	const m = stationSurface( T, [ 'grime' ], { roughness: .86 } );
	m.modules = [ villageMaterialModule, terrainShadingModule( T.stoneGrainN ) ];
	m.name = 'EastLandingBedrock';
	m.surface = /* wgsl */`
	let p = in.P;
	let g = terrainImplicitGrad( p );
	let mcr = textureSample( terrainDetailTex, smpAniso4Repeat, ${ rot2( 'p.xz', .9 ) } / 61.0 ).w * .6
		+ textureSample( terrainDetailTex, smpAniso4Repeat, ${ rot2( 'p.xz', 2.3 ) } / 17.0 ).w * .4;
	// The same metre-scale fractured stone as the terrain, so the exposed
	// shelves read as the cliff's bedrock rather than separate pale boulders.
	let R = terrainRockSurface( p, in.N, p.y, mcr, .5, .65, g );
	let detail = terrainStoneDetail( p, in.N, g );
	let broad = textureSample( stationgrime, smpAnisoRepeat, p.xz * .22 );
	let axis = dot( p, vec3f( .17, .38, -.09 ) ) + ( broad.a-.5 ) * .16;
	let aa = max( fwidth( axis ), .001 );
	let quartz = ( 1.0-smoothstep( .009, .022 + aa, abs( fract( axis * .57 + .13 )-.5 ) ) )
		* smoothstep( .35, .6, broad.a );
	let grey = dot( R.albedo, vec3f( .2126, .7152, .0722 ) ) * vec3f( .93, .98, 1.0 );
	s.albedo = mix( grey, R.albedo, R.moss * .22 ) + quartz * .016 * ( 1.0-R.wet );
	s.roughness = mix( detail.rough, .34 + detail.rough * .13, R.wet );
	s.ao = .84 + smoothstep( .0, .35, R.height ) * .16;
	s.normal = terrainStoneNormal( terrainPerturbNormal( p, in.N, R.hd, 1.4 ), detail.slope );
`;
	return m;
}

export function createStationFlags( T ) {

	const m = stationSurface( T, [ 'stoneGrainN', 'grime' ] );
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
	let N = textureSample( stationstoneGrainN, smpAnisoRepeat, uv * 1.3 );
	let tone = 0.9 + vlmHash21( cell.x, cell.y + in.vs.vData.x ) * 0.16;
	s.albedo = in.vs.vTint * tone * ( 0.94 + G.a * 0.12 ) * ( 1.0 - seam * 0.5 );
	s.roughness = clamp( N.b - G.a * 0.1 + seam * 0.12, 0.7, 0.96 );
	s.ao = 1.0 - seam * 0.2;
	s.normal = vlmNormalFromSlope( in.P, in.N, uv, vlmSlopeOf( N ) * 0.45 );
`;
	return m;

}

// Keep the hard material's rope/tidal handling, with finer maintained cast iron.
// The replacement is per-station; the shared village hard material is untouched.
export function createStationIron( T ) {
	const m = createHardMaterial( { ...T, hardN: T.castIronN } );
	m.name = 'StationIronwork';
	m.defines.STATION_IRON = 1;
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

export function createBurnerFlameMaterial() {

	const m = physical( {
		transparent: true, depthWrite: false, side: 'double',
		defines: { NO_LOCAL_LIGHTS: 1 }, uniforms: { glow: [ 'f32', 0 ] },
	} );
	m.name = 'fixedBurnerFlame';
	m.surface = /* wgsl */`
	s.albedo = vec3f( 0.0 );
	s.alpha = mat.glow * 0.78;
	s.emissive = vec3f( 1.0, 0.57, 0.17 ) * mat.glow * 3.0;
`;
	return m;

}

export function createLensMaterial() {

	const m = physical( {
		color: 0xdbe5df, roughness: 0.06, metalness: 0, ior: 1.52,
		transparent: true, opacity: .26, side: 'double', depthWrite: false,
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
	// Concentric prism faces around the paired eyes bend the reflected light.
	// This is a surface study; the engine does not solve the optic's refraction.
	let height = annuli * 0.006 * ( 1.0 - smoothstep( 0.85, 1.25, nearest ) );
	let dx = dpdx( in.P ); let dy = dpdy( in.P );
	let r1 = cross( dy, in.N ); let r2 = cross( in.N, dx );
	let det = dot( dx, r1 );
	s.normal = normalize( abs( det ) * in.N - sign( det ) * ( dpdx( height ) * r1 + dpdy( height ) * r2 ) + in.N * 1e-12 );
	let grazing = pow( 1.0 - abs( dot( s.normal, in.V ) ), 3.0 );
	s.alpha = 0.33 + grazing * 0.32 + prism * 0.18;
	s.albedo = mat.color * ( 0.60 + prism * 0.30 );
	s.roughness = mix( 0.035, 0.075, prism );
	// The flame's local point light is deliberately excluded: inverse-square
	// lighting a shell from inside flattened every prism to white. Preserve dark
	// grooves and concentrate the bright flash in the bullseyes themselves.
	let transmission = 0.006 + prism * 0.025 + bull * 0.012;
	s.emissive = flame * mat.glow * ( transmission + flash * 1.8 );
`;
	return m;

}
