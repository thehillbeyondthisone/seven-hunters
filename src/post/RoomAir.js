import { ShaderModule, UniformBlock } from '../engine/gpu/Shader.js';
import { RenderTarget } from '../engine/gpu/Texture.js';
import { FullscreenPass } from '../engine/render/FullscreenPass.js';
import { G } from '../engine/render/Frame.js';
import { MathUtils, Vector4 } from '../engine/math/index.js';
import { handLampLightModule } from '../station/HandLampLight.js';
import { handLampShadowModule } from '../station/HandLampShadows.js';

const MAX_WINDOWS = 6;
const MAX_LAMPS = 4;
const STEPS = 16;
const NO_PASSES = [];
const ACTIVE_PASSES = [ 'room air' ];
const vectors = n => Array.from( { length: n }, () => new Vector4() );

// A small volume attached to the occupied room, rather than extra samples in
// the kilometre-long outdoor fog march. Panes, stone reveals and sash bars all
// clip the solar volume. Oil lamps share their *already selected and flickered*
// illumination with this pass; daylight bounce lights never create fake beams.
export class RoomAir {

	constructor( { depthTexture, haze, layout = [], localLights = null } ) {

		this.depthTexture = depthTexture;
		this.haze = haze;
		this.localLights = localLights;
		this.layout = layout;
		this.uniforms = new UniformBlock( 'RoomAirParams', {
			enabled: [ 'f32', 1 ], strength: [ 'f32', 1 ],
			sunStrength: [ 'f32', 1 ], lampStrength: [ 'f32', 1 ],
			roomGain: [ 'f32', 0 ], hasScatter: [ 'f32', 0 ], hazeEnabled: [ 'f32', 1 ], sunOn: [ 'f32', 0 ],
			windowCount: [ 'i32', 0 ], lampCount: [ 'i32', 0 ],
			boundsMin: [ 'vec4f', new Vector4() ], boundsMax: [ 'vec4f', new Vector4() ],
			// xyz = cylinder centre xz / radius; w = whether to remove the tower.
			excludeCylinder: [ 'vec4f', new Vector4() ],
			windowCenter: [ `vec4f[${ MAX_WINDOWS }]`, vectors( MAX_WINDOWS ) ],
			windowNormal: [ `vec4f[${ MAX_WINDOWS }]`, vectors( MAX_WINDOWS ) ],
			windowRight: [ `vec4f[${ MAX_WINDOWS }]`, vectors( MAX_WINDOWS ) ],
			windowShape: [ `vec4f[${ MAX_WINDOWS }]`, vectors( MAX_WINDOWS ) ],
			windowOuter: [ `vec4f[${ MAX_WINDOWS }]`, vectors( MAX_WINDOWS ) ],
			windowInner: [ `vec4f[${ MAX_WINDOWS }]`, vectors( MAX_WINDOWS ) ],
			lampPos: [ `vec4f[${ MAX_LAMPS }]`, vectors( MAX_LAMPS ) ],
			lampCol: [ `vec4f[${ MAX_LAMPS }]`, vectors( MAX_LAMPS ) ],
			lampDir: [ `vec4f[${ MAX_LAMPS }]`, vectors( MAX_LAMPS ) ],
			lampMin: [ `vec4f[${ MAX_LAMPS }]`, vectors( MAX_LAMPS ) ],
			lampMax: [ `vec4f[${ MAX_LAMPS }]`, vectors( MAX_LAMPS ) ],
			lampShape: [ `vec4f[${ MAX_LAMPS }]`, vectors( MAX_LAMPS ) ],
		}, { label: 'roomAir' } );
		for ( const key of [ 'enabled', 'strength', 'sunStrength', 'lampStrength' ] ) this[ key ] = this.uniforms.fields[ key ];
		this.low = new RenderTarget( 1, 1, { colors: [ 'rgba16float' ], label: 'roomAir' } );
		this.scale = 1;
		this.resolutionScale = 1;
		this._outputWidth = 0;
		this._outputHeight = 0;
		this.activePassNames = NO_PASSES;
		this.activeRoom = null;
		this._pass = null;

	}

	setLayout( rooms ) {

		this.layout = rooms || [];
		this.activeRoom = null;
		this.cut();

	}

	setScale( scale ) { this.scale = scale; }

	setQuality( value ) {

		const n = Number( value );
		if ( ! Number.isFinite( n ) ) return;
		this.resolutionScale = MathUtils.clamp( n, 0.5, 1.5 );
		if ( this._outputWidth ) this.setSize( this._outputWidth, this._outputHeight );

	}

	setSize( w, h ) {

		this._outputWidth = w; this._outputHeight = h;
		const s = .5 * this.scale * this.resolutionScale;
		this.low.setSize( Math.max( 1, Math.round( w * s ) ), Math.max( 1, Math.round( h * s ) ) );
		this.cut();

	}

	cut() { this.uniforms.fields.hasScatter.value = 0; }

	_packRoom( room ) {

		const U = this.uniforms.fields;
		U.boundsMin.value.set( ...room.min, 0 ); U.boundsMax.value.set( ...room.max, 0 );
		const e = room.excludeCylinder;
		if ( e ) U.excludeCylinder.value.set( e.center[ 0 ], e.center[ 1 ], e.radius, 1 );
		else U.excludeCylinder.value.set( 0, 0, 0, 0 );
		const windows = room.windows || [];
		U.windowCount.value = Math.min( windows.length, MAX_WINDOWS );
		for ( let i = 0; i < U.windowCount.value; i ++ ) {

			const w = windows[ i ];
			U.windowCenter.value[ i ].set( ...w.center, w.transmission ?? .82 );
			U.windowNormal.value[ i ].set( ...w.normal, w.halfWidth );
			U.windowRight.value[ i ].set( ...w.right, w.halfHeight );
			U.windowShape.value[ i ].set( w.mullionWidth ?? .022, w.muntinHeight ?? .045, w.openingHalfWidth ?? w.halfWidth, w.openingHalfHeight ?? w.halfHeight );
			U.windowOuter.value[ i ].set( ...( w.outerCenter || w.center ), 0 );
			U.windowInner.value[ i ].set( ...( w.innerCenter || w.center ), 0 );

		}

	}

	update( camera ) {

		const U = this.uniforms.fields;
		U.hasScatter.value = 0;
		U.roomGain.value = 0;
		U.sunOn.value = 0;
		U.hazeEnabled.value = this.haze.enabled?.value ?? 1;
		if ( this.enabled.value < .5 || this.haze.enabled?.value < .5 || this.strength.value <= 0 || G.cameraUnderwater.value >= .5 ) return;
		const p = camera?.position;
		if ( ! p ) return;
		let nearest = null, distance = 1.5;
		for ( const room of this.layout ) {

			const dx = Math.max( room.min[ 0 ] - p.x, 0, p.x - room.max[ 0 ] );
			const dy = Math.max( room.min[ 1 ] - p.y, 0, p.y - room.max[ 1 ] );
			const dz = Math.max( room.min[ 2 ] - p.z, 0, p.z - room.max[ 2 ] );
			const d = Math.hypot( dx, dy, dz );
			if ( d < distance ) { nearest = room; distance = d; }

		}
		if ( ! nearest ) { this.activeRoom = null; return; }
		if ( nearest !== this.activeRoom ) { this.activeRoom = nearest; this._packRoom( nearest ); }
		const sun = G.sunDir.value, colour = G.sunColor.value;
		if ( this.sunStrength.value > 0 && sun.y > 0 && Math.max( colour.r, colour.g, colour.b ) > 1e-5 ) {

			for ( const window of nearest.windows || [] ) {

				if ( sun.x * window.normal[ 0 ] + sun.y * window.normal[ 1 ] + sun.z * window.normal[ 2 ] > .025 ) { U.sunOn.value = 1; break; }

			}

		}
		// The room remains visible while crossing a doorway; its effect fades over
		// the same short approach instead of switching the whole screen abruptly.
		U.roomGain.value = 1 - MathUtils.smoothstep( distance, .15, 1.5 );
		let n = 0;
		for ( const light of this.localLights?.roomAirLights || [] ) {

			if ( n >= MAX_LAMPS ) break;
			if ( Math.max( light.color.x, light.color.y, light.color.z ) <= 1e-5 ) continue;
			const a = light.boundMin, b = light.boundMax;
			// A neighbouring room's lights cannot spend march work or brighten air
			// on the other side of its solid partition.
			if ( ! a || ! b || a.w <= 0 || a.x > nearest.max[ 0 ] || b.x < nearest.min[ 0 ] || a.y > nearest.max[ 1 ] || b.y < nearest.min[ 1 ] || a.z > nearest.max[ 2 ] || b.z < nearest.min[ 2 ] ) continue;
			U.lampPos.value[ n ].copy( light.position ); U.lampCol.value[ n ].copy( light.color );
			U.lampCol.value[ n ].x *= light.scatterStrength ?? 1;
			U.lampCol.value[ n ].y *= light.scatterStrength ?? 1;
			U.lampCol.value[ n ].z *= light.scatterStrength ?? 1;
			if ( light.shape ) U.lampShape.value[ n ].copy( light.shape );
			else U.lampShape.value[ n ].set( 0, 1, 0, 0 );
			U.lampDir.value[ n ].copy( light.direction ); U.lampMin.value[ n ].copy( a ); U.lampMax.value[ n ].copy( b );
			n ++;

		}
		U.lampCount.value = n;

	}

	render() {

		const U = this.uniforms.fields;
		U.hasScatter.value = 0;
		U.hazeEnabled.value = this.haze.enabled?.value ?? 1;
		const lit = ( this.sunStrength.value > 0 && U.sunOn.value > .5 ) || ( this.lampStrength.value > 0 && U.lampCount.value > 0 );
		if ( ! lit || U.roomGain.value <= 0 || this.enabled.value < .5 || this.haze.enabled?.value < .5 || this.strength.value <= 0 || G.cameraUnderwater.value >= .5 ) {

			this.activePassNames = NO_PASSES;
			return;

		}
		if ( ! this._pass ) this._build();
		this._pass.render( { colorViews: [ this.low.texture ], clear: [ 0, 0, 0, 0 ] } );
		U.hasScatter.value = 1;
		this.activePassNames = ACTIVE_PASSES;

	}

	get module() {

		if ( this._module ) return this._module;
		this._module = new ShaderModule( {
			name: 'room-air', deps: [ this.haze.module, handLampLightModule, handLampShadowModule ], uniforms: this.uniforms, uniformName: 'roomAir',
			code: /* wgsl */`
// Returns distance along the view ray inside the architectural room. The
// tower cylinder is removed from the keeper room's rectangular envelope.
fn roomAirInterval( dir: vec3f, dist: f32 ) -> vec2f {
	let safeDir = select( vec3f( 1e-6 ), dir, abs( dir ) > vec3f( 1e-6 ) );
	let a = ( roomAir.boundsMin.xyz - frame.cameraPos ) / safeDir;
	let b = ( roomAir.boundsMax.xyz - frame.cameraPos ) / safeDir;
	let lo = min( a, b ); let hi = max( a, b );
	return vec2f( max( max( lo.x, max( lo.y, lo.z ) ), 0.0 ), min( min( hi.x, min( hi.y, hi.z ) ), min( dist, 150.0 ) ) );
}

fn roomAirTowerInterval( dir: vec3f, span: vec2f ) -> vec2f {
	let e = roomAir.excludeCylinder;
	if ( e.w < .5 ) { return vec2f( 0.0 ); }
	let q = frame.cameraPos.xz - e.xy;
	let a = dot( dir.xz, dir.xz );
	let b = dot( q, dir.xz );
	let c = dot( q, q ) - e.z * e.z;
	let discriminant = b * b - a * c;
	if ( a < 1e-8 ) { return select( vec2f( 0.0 ), span, c < 0.0 ); }
	if ( discriminant <= 0.0 ) { return vec2f( 0.0 ); }
	let h = sqrt( discriminant );
	return vec2f( max( span.x, ( - b - h ) / a ), min( span.y, ( - b + h ) / a ) );
}

fn roomAirLength( dir: vec3f, dist: f32 ) -> f32 {
	let span = roomAirInterval( dir, dist );
	let tower = roomAirTowerInterval( dir, span );
	return max( max( span.y - span.x, 0.0 ) - max( tower.y - tower.x, 0.0 ), 0.0 );
}

fn roomAirDensity( P: vec3f ) -> f32 {
	let e = roomAir.excludeCylinder;
	if ( e.w > .5 && distance( P.xz, e.xy ) < e.z ) { return 0.0; }
	// A very thin indoor aerosol; it stays clear across the room. Individual
	// dust specks remain the separate instanced motes effect.
	return .009 * clamp( roomAir.strength, 0.0, 4.0 ) * roomAir.roomGain;
}

// Box-filter an architectural interval by the distance covered by one march
// step on its plane. This filters *along the integration ray*, so a narrow
// sash is stable without widening every beam sideways or adding frame noise.
fn roomAirCoverage( x: f32, halfWidth: f32, footprint: f32 ) -> f32 {
	return clamp( ( min( x + footprint, halfWidth ) - max( x - footprint, -halfWidth ) ) / ( 2.0 * footprint ), 0.0, 1.0 );
}

fn roomAirPane( P: vec3f, i: i32, stepDelta: vec3f ) -> f32 {
	let centre = roomAir.windowCenter[ i ];
	let normal = roomAir.windowNormal[ i ];
	let right = roomAir.windowRight[ i ];
	let shape = roomAir.windowShape[ i ];
	let facing = dot( frame.sunDir, normal.xyz );
	if ( facing < .025 || frame.sunDir.y <= 0.0 ) { return 0.0; }
	let t = dot( centre.xyz - P, normal.xyz ) / facing;
	if ( t <= 0.0 ) { return 0.0; }
	let q = P + frame.sunDir * t - centre.xyz;
	let x = dot( q, right.xyz ); let y = q.y;
	let projectedStep = stepDelta - frame.sunDir * ( dot( stepDelta, normal.xyz ) / facing );
	let fx = max( abs( dot( projectedStep, right.xyz ) ) * .5, .015 );
	let fy = max( abs( projectedStep.y ) * .5, .015 );
	let clearX = max( roomAirCoverage( x, normal.w, fx ) - roomAirCoverage( x, shape.x * .5, fx ), 0.0 );
	let clearY = max( roomAirCoverage( y, right.w, fy ) - roomAirCoverage( y, shape.y * .5, fy ), 0.0 );
	var aperture = clearX * clearY;
	if ( aperture <= 0.0 ) { return 0.0; }
	// Thick masonry matters at the low winter sun: both reveal planes must
	// fit, otherwise the apparent shaft would pass through a stone jamb.
	for ( var plane = 0; plane < 2; plane ++ ) {
		let c = select( roomAir.windowOuter[ i ].xyz, roomAir.windowInner[ i ].xyz, plane == 1 );
		let r = P + frame.sunDir * ( dot( c - P, normal.xyz ) / facing ) - c;
		aperture *= roomAirCoverage( dot( r, right.xyz ), shape.z, fx ) * roomAirCoverage( r.y, shape.w, fy );
	}
	return aperture * centre.w;
}

fn roomAirSun( P: vec3f, stepDelta: vec3f ) -> f32 {
	var open = 0.0;
	for ( var i = 0; i < roomAir.windowCount; i ++ ) { open = max( open, roomAirPane( P, i, stepDelta ) ); }
	if ( open <= 0.0 ) { return 0.0; }
	// The aperture guarantees the building's shadow. Real scene shadows add
	// furniture, roofs and exterior occluders; cloud/terrain visibility agrees
	// with the outdoor aerial perspective instead of inventing an indoor sun.
	return open * hazeVisibilityRest( P, sunShadowHard( P ) );
}

fn roomAirLamps( P: vec3f, viewDir: vec3f ) -> vec3f {
	var scattered = vec3f( 0.0 );
	for ( var i = 0; i < roomAir.lampCount; i ++ ) {
		let p = roomAir.lampPos[ i ];
		let d = p.xyz - P; let d2 = dot( d, d );
		if ( d2 >= p.w ) { continue; }
		let b = roomAir.lampMin[ i ];
		let outside = max( max( b.xyz - P, P - roomAir.lampMax[ i ].xyz ), vec3f( 0.0 ) );
		let bounds = 1.0 - smoothstep( 0.0, max( b.w, .01 ), length( outside ) );
		if ( bounds <= 0.0 ) { continue; }
		let L = d * inverseSqrt( max( d2, 1e-5 ) );
		let c = roomAir.lampCol[ i ]; let axis = roomAir.lampDir[ i ];
		let cosine = dot( - L, axis.xyz );
		let cone = smoothstep( axis.w, c.w, cosine );
		let spot = max( cone * cone, smoothstep( axis.w - .55, axis.w, cosine ) * .05 );
		let win = max( 1.0 - ( d2 / p.w ) * ( d2 / p.w ), 0.0 );
		// Broad, softly directional scattering around a finite flame. The
		// .24 m source radius avoids a hard white pin at the eye or lamp glass.
		let phase = .065 + .055 * pow( max( dot( viewDir, L ), 0.0 ), 3.0 );
		let housing = handLampEmission( -L, roomAir.lampShape[ i ] );
		var visibility = 1.0;
		if ( roomAir.lampShape[ i ].w > .5 && handLampShadowActive( p.xyz ) ) { visibility = handLampShadowVisibility( P, vec3f( 0.0 ) ); }
		scattered += c.rgb * ( win * win * spot * bounds * housing * visibility * phase / ( d2 + .24 ) );
	}
	return scattered * roomAir.lampStrength * 2.8;
}
`,
		} );
		return this._module;

	}

	_build() {

		this._pass = new FullscreenPass( {
			label: 'room air', colorFormats: [ 'rgba16float' ], modules: [ this.module ],
			defines: this.haze._defines?.() || {},
			code: /* wgsl */`
fn fragment( in: FSIn ) -> vec4f {
	let ray = hazeRay( in.uv );
	let span = roomAirInterval( ray.dir, ray.dist );
	if ( span.y <= span.x ) { return vec4f( 0.0, 0.0, 0.0, ray.dist ); }
	let stepSize = ( span.y - span.x ) / ${ STEPS }.0;
	var scatter = vec3f( 0.0 ); var opticalDepth = 0.0;
	// Fixed quadrature is stable while reading. TAA resolves only the normal
	// subpixel camera movement; this volume needs no second history buffer.
	for ( var i = 0; i < ${ STEPS }; i ++ ) {
		let t = span.x + ( f32( i ) + .5 ) * stepSize;
		let P = frame.cameraPos + ray.dir * t;
		let sigma = roomAirDensity( P );
		if ( sigma <= 0.0 ) { continue; }
		let tau = sigma * stepSize;
		let T = exp( - opticalDepth - tau * .5 );
		var light = vec3f( 0.0 );
		if ( roomAir.sunStrength > 0.0 && roomAir.sunOn > .5 ) {
			// A modest forward lobe and broad side scattering keep beams visible
			// from across the room without a full-screen glare toward the pane.
			let phase = .055 + .10 * pow( max( dot( ray.dir, frame.sunDir ), 0.0 ), 5.0 );
			light += frame.sunColor * ( phase * roomAirSun( P, ray.dir * stepSize ) * roomAir.sunStrength * 2.5 );
		}
		if ( roomAir.lampStrength > 0.0 ) { light += roomAirLamps( P, ray.dir ); }
		// The little skylight scattered between shafts balances extinction,
		// with enough contrast retained to read the room's dark corners.
		light += frame.skyIrradiance * .12;
		scatter += light * ( T * tau );
		opticalDepth += tau;
	}
	return vec4f( scatter, ray.dist );
}
`,
		} );

	}

	get compositeModule() {

		if ( this._compositeModule ) return this._compositeModule;
		this._compositeModule = new ShaderModule( {
			name: 'room-air-composite', deps: [ this.module ],
			bindings: { roomAirLow: { texture: () => this.low.texture } },
			code: /* wgsl */`
fn roomAirApply( uv: vec2f, colour: vec4f ) -> vec4f {
	if ( roomAir.hasScatter < .5 || roomAir.enabled < .5 || roomAir.hazeEnabled < .5 || roomAir.roomGain <= 0.0 || frame.cameraUnderwater > .5 ) { return colour; }
	let ray = hazeRay( uv );
	let airLength = roomAirLength( ray.dir, ray.dist );
	if ( airLength <= 0.0 ) { return colour; }
	let size = vec2i( textureDimensions( roomAirLow ) );
	let p = uv * vec2f( size ) - .5; let lo = vec2i( floor( p ) ); let f = fract( p );
	var accumulated = vec3f( 0.0 ); var weight = 0.0;
	var closest = vec3f( 0.0 ); var closestDelta = 1e9;
	for ( var y = 0; y < 2; y ++ ) {
		for ( var x = 0; x < 2; x ++ ) {
			let tap = textureLoad( roomAirLow, clamp( lo + vec2i( x, y ), vec2i( 0 ), size - 1 ), 0 );
			let delta = abs( tap.a - ray.dist );
			if ( delta < closestDelta ) { closest = tap.rgb; closestDelta = delta; }
			let bilinear = select( 1.0 - f.x, f.x, x == 1 ) * select( 1.0 - f.y, f.y, y == 1 );
			let w = bilinear * exp( - delta * 10.0 );
			accumulated += tap.rgb * w; weight += w;
		}
	}
	let scatter = select( closest, accumulated / max( weight, 1e-6 ), weight > 1e-5 );
	let T = exp( - airLength * .009 * clamp( roomAir.strength, 0.0, 4.0 ) * roomAir.roomGain );
	return vec4f( colour.rgb * T + scatter, colour.a );
}
`,
		} );
		return this._compositeModule;

	}

}

