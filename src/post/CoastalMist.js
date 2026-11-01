import { ShaderModule, UniformBlock } from '../engine/gpu/Shader.js';

// Artistic sea-spray banks in Eilean Mòr's geos and channels. World coordinates
// are metres from the light (east, south). These never change weather visibility.
export const COASTAL_MIST_BANKS = Object.freeze( [
	{ center: [ 186, 4, 82 ], radii: [ 98, 9, 66 ], sigma: .0019, phase: .3 }, // east geo
	{ center: [ -405, 4, 128 ], radii: [ 102, 10, 73 ], sigma: .0019, phase: 2.4 }, // west geo
	{ center: [ -100, 4, -143 ], radii: [ 160, 10, 62 ], sigma: .0012, phase: 4.1 }, // north coves
	{ center: [ -134, 3, 277 ], radii: [ 148, 9, 66 ], sigma: .0014, phase: 1.6 }, // south shore
] );
const literal = value => Number( value ).toFixed( 6 );
const vec = values => `vec3f( ${ values.map( literal ).join( ', ' ) } )`;

// Exact integration of the smooth, compact density (1 - radius²)². No extra
// texture, ray march, jitter, render pass or history. Scene depth stops the ray
// at foreground stone. The banks top out at 14 m, below every station room.
export class CoastalMist {
	constructor() {
		this.uniforms = new UniformBlock( 'CoastalMistParams', {
			enabled: [ 'f32', 1 ], strength: [ 'f32', 1 ],
		}, { label: 'coastalMist' } );
		this.module = new ShaderModule( {
			name: 'coastal-mist', uniforms: this.uniforms, uniformName: 'coastalMistParams',
			code: /* wgsl */`
fn coastalMistPrimitive( u: f32 ) -> f32 {
	let u2 = u * u;
	return u * ( 1.0 + u2 * ( -2.0 / 3.0 + u2 / 5.0 ) );
}
fn coastalMistBankDepth( origin: vec3f, dir: vec3f, dist: f32, center: vec3f, radii: vec3f, phase: f32 ) -> f32 {
	// Bounded, slow drift keeps each broken bank attached to its cove. Uses
	// simulation time: held frames stay still, and cuts need no history reset.
	let t = frame.time;
	let wind = frame.windDir;
	let crosswind = vec2f( -wind.y, wind.x );
	let travel = wind * sin( t * .018 + phase ) * 12.0 + crosswind * sin( t * .011 + phase * 1.7 ) * 5.0;
	let c = center + vec3f( travel.x, frame.seaLevel, travel.y );
	let q = ( origin - c ) / radii;
	let v = dir / radii;
	let a = max( dot( v, v ), 1e-12 );
	let closestT = -dot( q, v ) / a;
	let closest = q + v * closestT;
	let k = 1.0 - dot( closest, closest );
	if ( k <= 0.0 ) { return 0.0; }
	let halfChord = sqrt( k / a );
	var start = max( 0.0, closestT - halfChord );
	var end = min( dist, closestT + halfChord );
	// Keep the lower lobe out of the water; the composite also retains the
	// existing camera-underwater and per-pixel lens-medium bypasses.
	let floorY = frame.seaLevel + .25;
	if ( abs( dir.y ) < 1e-6 ) {
		if ( origin.y < floorY ) { return 0.0; }
	} else {
		let waterT = ( floorY - origin.y ) / dir.y;
		if ( dir.y > 0.0 ) { start = max( start, waterT ); }
		else { end = min( end, waterT ); }
	}
	if ( end <= start ) { return 0.0; }
	let u0 = clamp( ( start - closestT ) / halfChord, -1.0, 1.0 );
	let u1 = clamp( ( end - closestT ) / halfChord, -1.0, 1.0 );
	return max( 0.0, halfChord * k * k * ( coastalMistPrimitive( u1 ) - coastalMistPrimitive( u0 ) ) );
}
fn coastalMistOpticalDepth( origin: vec3f, dir: vec3f, dist: f32 ) -> f32 {
	if ( coastalMistParams.enabled < .5 || coastalMistParams.strength <= 0.0 || dist <= 0.0 ) { return 0.0; }
	// Most high station rays exit before the chord calculations. Local banks
	// all lie within 800 m of the light: high horizontal signal bearings clear them.
	let endY = origin.y + dir.y * dist;
	if ( min( origin.y, endY ) > frame.seaLevel + 15.0 ) { return 0.0; }
	var tau = 0.0;
${ COASTAL_MIST_BANKS.map( bank => `\ttau += coastalMistBankDepth( origin, dir, dist, ${ vec( bank.center ) }, ${ vec( bank.radii ) }, ${ literal( bank.phase ) } ) * ${ literal( bank.sigma ) };` ).join( '\n' ) }
	let spray = mix( .65, 1.0, smoothstep( 2.0, 14.0, frame.windSpeed ) );
	return min( tau * max( coastalMistParams.strength, 0.0 ) * spray, .28 );
}
`,
		} );
	}
	get enabled() { return this.uniforms.fields.enabled.value > .5; }
	set enabled( value ) { this.uniforms.fields.enabled.value = value ? 1 : 0; }
	get strength() { return this.uniforms.fields.strength.value; }
	set strength( value ) {
		const n = Number( value );
		if ( Number.isFinite( n ) ) this.uniforms.fields.strength.value = Math.min( 2, Math.max( 0, n ) );
	}
}

