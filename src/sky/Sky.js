import { ShaderModule, UniformBlock } from '../engine/gpu/Shader.js';
import { FullscreenPass } from '../engine/render/FullscreenPass.js';
import { SCENE_FORMATS, DEPTH_FORMAT } from '../engine/render/SceneRenderer.js';
import { commonModule } from '../engine/render/wgsl/common.js';
import { Vector3, Matrix3, MathUtils } from '../engine/math/index.js';
import { SUN_ANGULAR_RADIUS } from './Atmosphere.js';
import { StorageBuffer } from '../engine/gpu/Texture.js';
import catalog from './data/bright-stars.json' with { type: 'json' };
import { buildStarIndex, STAR_GRID, STAR_SUPPORT } from './CatalogStars.js';
import { worldToEquatorialMatrix, precessJ2000, REFERENCE_STAR_TIME } from './StarCoordinates.js';

// Sky radiance: atmosphere (sky view LUT) + sun disk, stars, moon and moonlit sky, composited with
// the clouds.
//
// WGSL module (`sky.module`, prefix `sky`; built on first use, after `sky.clouds` is set):
//   uniform var skyParams: SkyParams (sunDiskIntensity, starIntensity, moonDir)
//   fn skySunDisk( dir: vec3f ) -> vec3f           sun disk radiance (atmospheric transmittance included)
//   fn skyStars( dir: vec3f ) -> vec3f
//   fn skyMoon( dir: vec3f ) -> vec3f
//   fn skyMoonSky( dir: vec3f ) -> vec3f           faint moonlit sky + aureole
//   fn skyBackground( dir: vec3f, starK: f32 ) -> vec3f   everything behind the clouds but the disks
//   fn skyRadiance( dir: vec3f, withSun: bool ) -> vec3f  no clouds
//   fn skyRadianceWithClouds( dir: vec3f, withSun: bool ) -> vec3f   panorama clouds composited
//   fn skyReflectionRadiance( dir: vec3f ) -> vec3f       water reflections (no moon disk, a trace of stars)
//   fn skyViewRadiance( dir: vec3f ) -> vec3f             main view (full resolution view clouds)
// `sky.background`: the scene background for SceneRenderer.background (draw( renderPassEncoder )).

// ICRS north galactic pole: the faint artistic band shares the catalog's orientation.
const MW_RA = 192.85948 * Math.PI / 180, MW_DEC = 27.12825 * Math.PI / 180;
const MW = new Vector3( Math.cos( MW_DEC ) * Math.cos( MW_RA ), Math.cos( MW_DEC ) * Math.sin( MW_RA ), Math.sin( MW_DEC ) );
// reflections spread point sources over rough water: only a trace of the stars survives
const STAR_REFLECTION = 0.08;

const f = ( x ) => {

	const s = String( x );
	return s.includes( '.' ) || s.includes( 'e' ) ? s : s + '.0';

};

export class Sky {

	constructor( atmosphere ) {

		this.atmosphere = atmosphere;
		this.clouds = null; // set later: Clouds (module with cloudsSample / cloudsSampleView)
		this.params = new UniformBlock( 'SkyParams', {
			moonDir: [ 'vec3f', new Vector3( - 0.3, 0.5, 0.8 ).normalize() ],
			sunDiskIntensity: [ 'f32', 1 ],
			starIntensity: [ 'f32', 0 ],
			darkAdaptation: [ 'f32', 0 ],
			worldToStars: [ 'mat3x3f', new Matrix3() ],
			galacticPole: [ 'vec3f', MW.clone() ],
			// 1: the moon disc shows its phase (lit by the true sun, src/sky/Setting.js); 0: a full disc
			moonShade: [ 'f32', 0 ],
			// brightness of the moonlit sky (the moon's illuminated fraction; 1 = full)
			moonLight: [ 'f32', 1 ],
		}, { label: 'sky' } );
		this.sunDiskIntensity = this.params.fields.sunDiskIntensity;
		this.moonDir = this.params.fields.moonDir;
		this.starIntensity = this.params.fields.starIntensity;
		this.darkAdaptation = this.params.fields.darkAdaptation;
		this.moonShade = this.params.fields.moonShade;
		this.moonLight = this.params.fields.moonLight;
		this._starEpochDay = null;
		this.starCatalog = null;
		this.setStarTime( REFERENCE_STAR_TIME, 24, 0 );
		this._module = null;
		this._background = null;

	}

	// Same UT, location and azimuth as the dated sun/moon. The daily rebuild applies
	// proper motion and precession; only the small orientation matrix changes per frame.
	setStarTime( utMs, lat, lon, azimuth = 0 ) {

		worldToEquatorialMatrix( utMs, lat, lon, azimuth, this.params.fields.worldToStars.value );
		const day = Math.floor( utMs / 86400000 );
		if ( day === this._starEpochDay ) return;
		this._starEpochDay = day;
		const epoch = ( day + .5 ) * 86400000;
		precessJ2000( MW, epoch, this.params.fields.galacticPole.value );
		const index = buildStarIndex( catalog.stars, epoch );
		this.starIndex = index;
		if ( ! this.starCatalog || index.data.byteLength > this.starCatalog.byteLength ) {

			if ( this.starCatalog ) this.starCatalog.destroy();
			this.starCatalog = new StorageBuffer( { label: 'HYG bright stars', count: Math.ceil( index.data.length / 4 * 1.1 ), type: 'vec4f', data: index.data } );

		} else if ( this.starCatalog.gpu ) this.starCatalog.write( index.data );
		else this.starCatalog.pendingData = index.data;

	}

	get module() {

		if ( ! this._module ) this._module = this._buildModule();
		return this._module;

	}

	_buildModule() {

		const clouds = this.clouds;
		const deps = [ commonModule, this.atmosphere.module ];
		if ( clouds ) deps.push( clouds.module );
		const composite = ( sampler ) => clouds
			? `let c = skyStyleClouds( ${ sampler }( dir ), dir );\n\treturn base * c.a + c.rgb;`
			: 'return base;';

		return new ShaderModule( {
			name: 'sky',
			deps,
			uniforms: this.params,
			uniformName: 'skyParams',
			bindings: { skyCatalog: { storage: () => this.starCatalog, access: 'read', type: 'vec4f' } },
			code: /* wgsl */`
// Sun disk radiance along dir (already includes atmospheric transmittance).
fn skySunDisk( dir: vec3f ) -> vec3f {
	let cosA = dot( dir, atmosphereParams.sunDir ); // the real sun (frame.sunDir is the moon at night)
	let ang = acos( clamp( cosA, -1.0, 1.0 ) );
	let r = ang / ${ f( SUN_ANGULAR_RADIUS ) };
	let mask = smoothstep( 1.0, 0.9, r );
	let mu = sqrt( max( 1.0 - r * r, 0.0 ) );
	let limb = 1.0 - 0.6 * ( 1.0 - mu );
	let T = atmosphereTransmittanceToSpace( dir );
	// physically the disk radiance is E / solid angle (~1.6e5); clamp for fp16 targets
	let physical = T * mask * limb * 2500.0 * skyParams.sunDiskIntensity * smoothstep( -0.02, 0.0, dir.y );
	if ( frame.styleMix.y <= 0.0 ) { return physical; }
	// Style Lab: a flat, slightly larger disc in the glow colour
	let disc = styleScene( frame.styleSkyGlow.rgb ) * 3.0 * smoothstep( 1.6, 1.3, r ) * smoothstep( -0.02, 0.0, dir.y );
	return mix( physical, disc, frame.styleMix.y );
}

// ---- Style Lab (src/style/StyleDirector.js, frame.style*)

// a painted sky: horizon to zenith by elevation (exponent < 1 keeps more horizon colour), with a glow
// around the true sun; below the horizon the horizon colour
fn skyStyleGradient( dir: vec3f ) -> vec3f {
	let g = pow( sat( dir.y ), max( frame.styleSkyZenith.w, 0.05 ) );
	let col = mix( frame.styleSkyHorizon.rgb, frame.styleSkyZenith.rgb, g );
	let ang = acos( clamp( dot( dir, atmosphereParams.sunDir ), -1.0, 1.0 ) );
	let glow = exp( - ang / max( frame.styleSkyGlow.w, 0.02 ) ) * smoothstep( -0.3, 0.02, atmosphereParams.sunDir.y );
	// (sRGB colours, blended as painted: common.js styleScene)
	return styleScene( mix( col, frame.styleSkyGlow.rgb, glow ) );
}

// clouds cut into a few flat layers: the cover (1 - transmittance) rounded to levels with soft
// steps, each cloud painted in the lit or the shaded colour by how much brighter than the clear sky
// behind it the physical cloud is (lit tops and edges vs grey undersides)
fn skyStyleClouds( c: vec4f, dir: vec3f ) -> vec4f {
	let k = frame.styleMix.w;
	if ( k <= 0.0 ) { return c; }
	let cover = 1.0 - c.a;
	let levels = max( frame.styleCloudLit.w, 1.0 );
	let s = clamp( frame.styleCloudShade.w * levels, 0.005, 0.5 );
	let y = cover * levels;
	// near the horizon the flat clouds dissolve into the painted gradient (low clouds foreshortened into
	// a band of flat blocks otherwise)
	let q = sat( ( floor( y ) + smoothstep( 0.5 - s, 0.5 + s, fract( y ) ) ) / levels ) * smoothstep( 0.03, 0.2, dir.y );
	let ratio = luminance( c.rgb ) / max( cover, 1e-3 ) / max( luminance( atmosphereSkyLuminance( dir ) ), 1e-6 );
	// two tones: lit where the cloud is clearly brighter than the sky behind it (a wide edge: near a low
	// sun the ratio is noisy, and a narrow one turns the noise into speckles)
	let col = styleScene( mix( frame.styleCloudShade.rgb, frame.styleCloudLit.rgb, smoothstep( 0.8, 1.6, ratio ) ) );
	return mix( c, vec4f( col * q, 1.0 - q ), k );
}

// A cube grid indexes the HYG catalog in the mean equatorial frame of date.
// The duplicated border candidates keep complete star profiles across cell and face seams.
fn skyStarCell( d: vec3f ) -> u32 {
	let a = abs( d );
	var face: u32;
	var uv: vec2f;
	if ( a.x >= a.y && a.x >= a.z ) {
		face = select( 0u, 1u, d.x < 0.0 ); uv = d.yz / a.x;
	} else if ( a.y >= a.z ) {
		face = select( 2u, 3u, d.y < 0.0 ); uv = d.xz / a.y;
	} else {
		face = select( 4u, 5u, d.z < 0.0 ); uv = d.xy / a.z;
	}
	let cell = vec2u( clamp( floor( ( uv * 0.5 + 0.5 ) * ${ f( STAR_GRID ) } ), vec2f( 0.0 ), vec2f( ${ f( STAR_GRID - 1 ) } ) ) );
	return face * ${ STAR_GRID * STAR_GRID }u + cell.y * ${ STAR_GRID }u + cell.x;
}

// The catalog supplies positions, magnitudes, B-V colours and proper motions.
// Twilight, moonlight, horizon extinction and subtle scintillation control visibility.
fn skyStars( dir: vec3f ) -> vec3f {
	if ( dir.y <= 0.0 ) { return vec3f( 0.0 ); }
	let eq = normalize( skyParams.worldToStars * dir );
	let range = skyCatalog[ skyStarCell( eq ) ];
	let dark = 1.0 - smoothstep( -0.28, -0.1, atmosphereParams.sunDir.y );
	let limit = dark * ( 7.5 + skyParams.darkAdaptation * 0.7 ) - 1.0 - 0.9 * skyParams.moonLight * smoothstep( 0.0, 0.3, skyParams.moonDir.y );
	// A pixel-scale point spread also keeps magnified stars pinpoints in the telescope.
	let pixelAngle = 2.0 * abs( frame.invProj[ 1 ].y ) * frame.invResolution.y;
	let baseSigma = clamp( pixelAngle * 0.38, 0.000035, 0.00045 );
	var star = vec3f( 0.0 );
	for ( var j = 0u; j < u32( range.y ); j ++ ) {
		let at = u32( range.x ) + j * 2u;
		let s = skyCatalog[ at ];
		let d = length( eq - s.xyz );
		if ( d > ${ f( STAR_SUPPORT ) } ) { continue; }
		let col = skyCatalog[ at + 1u ];
		let vis = smoothstep( s.w - 0.6, s.w + 0.6, limit );
		let flux = pow( 10.0, 0.4 * ( 6.5 - s.w ) );
		let size = 1.0 + log2( flux ) * 0.08;
		let sigma = baseSigma * size;
		let psf = exp( -0.5 * d * d / ( sigma * sigma ) ) / ( size * size );
		let tw = 1.0 + sin( frame.time * ( 5.0 + col.w * 9.0 ) + col.w * 60.0 ) * mix( 0.18, 0.06, sat( dir.y * 2.0 ) );
		star += col.rgb * ( psf * flux * vis * tw * 0.0075 );
	}
	let bx = dot( eq, skyParams.galacticPole ) * 4.0;
	// Broad artistic glow only: the discrete stars above all come from the catalog.
	let glow = vec3f( 0.55, 0.6, 0.75 ) * ( exp( -bx * bx ) * dark * 0.0035 );
	let extinction = exp( -0.14 * ( 1.0 / max( dir.y, 0.03 ) - 1.0 ) );
	return ( star + glow ) * skyParams.starIntensity * extinction * smoothstep( 0.0, 0.025, dir.y );
}

fn skyMoon( dir: vec3f ) -> vec3f {
	let cosA = dot( dir, skyParams.moonDir );
	let ang = acos( clamp( cosA, -1.0, 1.0 ) );
	let r = ang / 0.0048;
	let mask = smoothstep( 1.0, 0.92, r );
	var lit = 1.0;
	if ( skyParams.moonShade > 0.5 && mask > 0.0 ) {
		// the phase: the moon as a sphere lit by the true sun. The disc point's normal faces back toward
		// the observer (-moonDir) and leans out along its offset from the disc centre; a faint
		// earthshine keeps the dark limb just visible
		let t = dir - skyParams.moonDir * cosA;
		let tl = length( t );
		let rr = min( r, 1.0 );
		let n = select( vec3f( 0.0 ), t / tl, tl > 1e-7 ) * rr - skyParams.moonDir * sqrt( 1.0 - rr * rr );
		lit = smoothstep( -0.04, 0.06, dot( n, atmosphereParams.sunDir ) ) + 0.015;
	}
	return vec3f( 0.9, 0.92, 1.0 ) * mask * lit * 3.0 * skyParams.starIntensity * smoothstep( -0.02, 0.02, dir.y );
}

// Faint blue-grey moonlit sky (a little brighter toward the horizon) and the moon's aureole.
// Physically dim: about the level of the app's night ambient light.
fn skyMoonSky( dir: vec3f ) -> vec3f {
	let cosA = dot( dir, skyParams.moonDir );
	let ang = acos( clamp( cosA, -1.0, 1.0 ) );
	let aureole = exp( ang * -14.0 ) * 2.4 + exp( ang * -2.5 ) * 0.9;
	let grad = mix( 1.7, 1.0, sat( dir.y * 3.0 ) );
	let up = smoothstep( -0.05, 0.15, skyParams.moonDir.y );
	return vec3f( 0.005, 0.0068, 0.0105 ) * ( grad + aureole ) * frame.night * up * skyParams.moonLight;
}

// Everything behind the clouds except the sun and moon disks. The night terms are only
// evaluated at night (uniform branch). Style Lab: the painted gradient over the atmosphere (the
// environment probe renders this too, so the ambient light follows the painted sky).
fn skyBackground( dir: vec3f, starK: f32 ) -> vec3f {
	var L = atmosphereSkyLuminance( dir );
	if ( frame.styleMix.y > 0.0 ) { L = mix( L, skyStyleGradient( dir ), frame.styleMix.y ); }
	if ( skyParams.starIntensity > 0.001 ) {
		L += skyMoonSky( dir ) + skyStars( dir ) * starK;
	}
	return L;
}

// Full sky radiance for a direction (no clouds).
fn skyRadiance( dir: vec3f, withSun: bool ) -> vec3f {
	var L = skyBackground( dir, 1.0 ) + skyMoon( dir );
	if ( withSun ) { L += skySunDisk( dir ); }
	return L;
}

// Sky with clouds composited (low resolution cloud panorama). withSun = false (environment
// map): no sun or moon disk, the key light is lit directly.
fn skyRadianceWithClouds( dir: vec3f, withSun: bool ) -> vec3f {
	var base: vec3f;
	if ( withSun ) { base = skyBackground( dir, 1.0 ) + skyMoon( dir ) + skySunDisk( dir ); }
	else { base = skyBackground( dir, ${ f( STAR_REFLECTION ) } ); }
	${ composite( 'cloudsSample' ) }
}

// Water reflections: no moon disk (the water's specular lobe reflects the key light) and only a
// trace of the stars, which rough water would spread into flickering sparkles.
fn skyReflectionRadiance( dir: vec3f ) -> vec3f {
	let base = skyBackground( dir, ${ f( STAR_REFLECTION ) } );
	${ composite( 'cloudsSample' ) }
}

// Main view background: full resolution clouds for the camera's view (the sun's disc behind them
// with cloudsSunTransmittance: no sun through the cut-off remainder of thick cloud)
fn skyViewRadiance( dir: vec3f ) -> vec3f {
	let base = skyBackground( dir, 1.0 ) + skyMoon( dir );
	let sun = skySunDisk( dir );
	${ clouds ? `let c = skyStyleClouds( cloudsSampleView( dir ), dir );
	return base * c.a + sun * cloudsSunTransmittance( c.a ) + c.rgb;` : 'return base + sun;' }
}
`,
		} );

	}

	// The main view background (SceneRenderer.background): drawn after the opaques where the depth is
	// still 0 (reversed-Z clear), writes the sky color, the camera-only motion of a direction at infinity
	// and a zero water mask.
	get background() {

		if ( ! this._background ) {

			const pass = new FullscreenPass( {
				label: 'sky background',
				modules: [ this.module ],
				colorFormats: SCENE_FORMATS,
				depthFormat: DEPTH_FORMAT,
				depthCompare: 'equal',
				depthWrite: false,
				depth: 0,
				code: /* wgsl */`
struct SkyOut {
	@location( 0 ) color: vec4f,
	@location( 1 ) velocity: vec4f,
	@location( 2 ) mask: vec4f,
};
@fragment fn fs( in: FSIn ) -> SkyOut {
	let uv = in.pos.xy * frame.invResolution;
	let dir = viewRay( uv );
	var o: SkyOut;
	o.color = vec4f( skyViewRadiance( dir ), 1.0 );
	// a direction at infinity: only the camera rotation moves it
	let c = frame.viewProjNoJitter * vec4f( dir, 0.0 );
	let p = frame.prevViewProjNoJitter * vec4f( dir, 0.0 );
	let cur = c.xy / max( abs( c.w ), 1e-6 ) * sign( c.w );
	let prev = p.xy / max( abs( p.w ), 1e-6 ) * sign( p.w );
	o.velocity = vec4f( select( vec2f( 0.0 ), ( cur - prev ) * vec2f( 0.5, -0.5 ), c.w > 1e-6 && p.w > 1e-6 ), 0.0, 1.0 );
	o.mask = vec4f( 0.0 );
	return o;
}
`,
			} );
			this._background = { pass, draw: ( rp ) => pass.draw( rp ) };

		}

		return this._background;

	}

	// three-compatible alias
	backgroundNode() {

		return this.background;

	}

}

// Simple solar position model. Returns direction toward the sun (world: +x east, -z north, +y up).
export function sunDirectionFromTime( hours, latitudeDeg = 24, declinationDeg = 6, out = new Vector3() ) {

	const phi = MathUtils.degToRad( latitudeDeg );
	const dec = MathUtils.degToRad( declinationDeg );
	const H = MathUtils.degToRad( ( hours - 12 ) * 15 );
	const east = - Math.cos( dec ) * Math.sin( H );
	const north = Math.cos( phi ) * Math.sin( dec ) - Math.sin( phi ) * Math.cos( dec ) * Math.cos( H );
	const up = Math.sin( phi ) * Math.sin( dec ) + Math.cos( phi ) * Math.cos( dec ) * Math.cos( H );
	return out.set( east, up, - north ).normalize();

}
