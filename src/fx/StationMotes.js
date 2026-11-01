import { Mesh, PlaneGeometry } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';
import { ShaderModule } from '../engine/gpu/Shader.js';
import { shadowModule } from '../engine/render/wgsl/lighting.js';
import { LAYERS } from '../engine/render/SceneRenderer.js';
import { localLightsModule } from '../materials/LocalLights.js';
import { ROOM, TOWER } from '../world/flannan/Station.js';
import { KITCHEN, BERTH } from '../world/flannan/NextRooms.js';

const PER_ROOM = 192;
const MAX_AMOUNT = 10;
const STORAGE_KEY = 'sevenhunters.interiorDust';
const f = n => Number( n ).toFixed( 5 );

function clampAmount( amount ) {
	const n = Number( amount );
	return Number.isFinite( n ) ? Math.max( 0, Math.min( MAX_AMOUNT, n ) ) : 1;
}

export function loadStationDustAmount() {
	try {
		const saved = globalThis.localStorage?.getItem( STORAGE_KEY );
		if ( saved !== null && saved !== undefined && saved.trim() !== '' ) return clampAmount( saved );
	} catch { /* Private browsing can deny storage. */ }
	return 1;
}

export function saveStationDustAmount( amount ) {
	try { globalThis.localStorage?.setItem( STORAGE_KEY, String( clampAmount( amount ) ) ); } catch { /* The current session still works. */ }
}

// Quiet lint in fixed interior volumes, never a camera-following outdoor cloud.
// A single instanced draw shares the actual window/lamp colours and room masks.
// Sparse subpixel coverage makes particles appear in light, without fogging rooms.
export class StationMotes {

	constructor( { clouds = null, amount = 1 } = {} ) {
		this.volumes = [ ROOM, KITCHEN, BERTH ].map( r => ( {
			min: [ r.x0 + .2, TOWER.floor + .25, r.z0 + .2 ],
			max: [ r.x1 - .2, ROOM.ceiling - .18, r.z1 - .2 ],
		} ) );
		this.volumes.push( { min: [ -1.9, TOWER.deck + .25, -1.9 ], max: [ 1.9, TOWER.deck + 3.2, 1.9 ] } );
		const vector = a => `vec3f( ${ a.map( f ).join( ', ' ) } )`;
		const volumeCode = /* wgsl */`
const stationDustMin = array<vec3f, 4>( ${ this.volumes.map( r => vector( r.min ) ).join( ', ' ) } );
const stationDustMax = array<vec3f, 4>( ${ this.volumes.map( r => vector( r.max ) ).join( ', ' ) } );
fn stationDustHash( n: f32 ) -> vec3f {
	return fract( sin( vec3f( n + .13, n * 1.37 + 4.2, n * 2.71 + 7.3 ) ) * 43758.5453 );
}
fn stationDustPosition( id: f32, room: u32, t: f32 ) -> vec3f {
	let h = stationDustHash( id );
	let phase = h * 6.283185;
	let drift = vec3f( .011, -.007, .008 ) * t;
	let wander = sin( phase + t * vec3f( .27, .19, .23 ) ) * .025;
	let unit = fract( h + drift * (.7 + h.z) + wander );
	return mix( stationDustMin[ room ], stationDustMax[ room ], unit );
}
`;
		const module = new ShaderModule( { name: 'stationDust', deps: [ shadowModule, localLightsModule ], code: volumeCode } );
		const hasClouds = !!clouds;
		this.material = new Material( {
			name: 'Light in the station air',
			modules: [ module, hasClouds && ( clouds.shadowModule || clouds.module ) ].filter( Boolean ),
			lit: false, transparent: true, blending: 'premultiplied', side: 'double',
			depthWrite: true, underwaterLighting: 'none', defines: { VELOCITY_OPAQUE: 1 },
			uniforms: { intensity: [ 'f32', 1 ], population: [ 'f32', PER_ROOM ] },
			varyings: { vDust: 'vec4f', vDustUV: 'vec2f' },
			vertex: /* wgsl */`
	// Interleave rooms so every density treats all four spaces equally. The seed
	// mapping preserves the original field at 1x and never moves an existing mote.
	let room = v.instance % ${ this.volumes.length }u;
	let index = v.instance / ${ this.volumes.length }u;
	let batch = index / ${ PER_ROOM }u;
	let id = f32( batch * ${ PER_ROOM * this.volumes.length }u + room * ${ PER_ROOM }u + index % ${ PER_ROOM }u ) + 1.0;
	let p = stationDustPosition( id, room, frame.time );
	let previous = stationDustPosition( id, room, frame.time - frame.dt );
	let edge = min( p - stationDustMin[ room ], stationDustMax[ room ] - p );
	let wallFade = smoothstep( 0.0, .18, min( min( edge.x, edge.y ), edge.z ) );
	// The lantern is circular: keep its corners inside the glazing.
	let roundFade = select( 1.0, 1.0 - smoothstep( 1.8, 2.0, length( p.xz ) ), room == 3u );
	let toEye = frame.cameraPos - p;
	let distance = max( length( toEye ), .01 );
	let V = toEye / distance;
	let cosT = -dot( V, frame.sunDir );
	let phase = .025 + .065 / pow( max( 1.49 - 1.4 * cosT, .09 ), 1.5 );
	var sunVisibility = sunShadowHard( p );
${ hasClouds ? '\tsunVisibility *= cloudsShadow( p.xz );' : '' }
	var light = frame.sunColor * sunVisibility * phase;
	// Match local-light range, cones and partition masks; extinguished lights
	// cannot leave glowing dust behind, and adjacent rooms cannot illuminate it.
	for ( var i = 0; i < localLights.count; i++ ) {
		let source = localLights.pos[ i ];
		let delta = source.xyz - p;
		let d2 = max( dot( delta, delta ), .001 );
		let L = delta * inverseSqrt( d2 );
		let window = max( 0.0, 1.0 - pow( d2 / max( source.w, .001 ), 2.0 ) );
		let b = localLights.boundMin[ i ];
		let outside = max( max( b.xyz - p, p - localLights.boundMax[ i ].xyz ), vec3f( 0.0 ) );
		let mask = select( 1.0, 1.0 - smoothstep( 0.0, max( b.w, .001 ), length( outside ) ), b.w > 0.0 );
		let cone = localLightsSpotProfile( dot( -L, localLights.dir[ i ].xyz ), localLights.col[ i ].w, localLights.dir[ i ].w );
		let housing = handLampEmission( -L, localLights.shape[ i ] );
		var visibility = 1.0;
		if ( localLights.shape[ i ].w > .5 && handLampShadowActive( source.xyz ) ) { visibility = handLampShadowVisibility( p, vec3f( 0.0 ) ); }
		let scatter = .08 + .12 * pow( max( 0.0, -dot( V, L ) ), 4.0 );
		light += localLights.col[ i ].rgb * ( window * window * mask * cone * housing * visibility * scatter / ( d2 + .15 ) );
	}
	let h = stationDustHash( id + 127.0 );
	let radius = .00045 + h.x * h.x * .0011;
	let pixel = distance * 2.0 / ( frame.proj[ 1 ][ 1 ] * frame.resolution.y );
	let size = max( radius, pixel * 1.05 );
	let coverage = min( 1.0, 8.0 * pow( radius / size, 2.0 ) );
	let fade = wallFade * roundFade * smoothstep( .18, .55, distance ) * (1.0 - smoothstep( 5.0, 9.0, distance ));
	// Below the visible scattering threshold, discard even the particle core:
	// unlit lint must not leave dark specks or invisible foreground depth.
	let litFade = smoothstep( .008, .06, dot( light, vec3f( .2126, .7152, .0722 ) ) );
	// Fade the newest mote in each room across fractional population steps.
	let populationFade = clamp( mat.population - f32( index ), 0.0, 1.0 );
	let alpha = coverage * fade * litFade * mat.intensity * populationFade;
	let right = normalize( cross( vec3f( 0.0, 1.0, 0.0 ), V ) + vec3f( .00001, 0.0, 0.0 ) );
	let up = cross( V, right );
	let world = p + (right * v.position.x + up * v.position.y) * size;
	v.useWorld = true;
	v.worldPos = select( vec3f( 0.0, -1e5, 0.0 ), world, alpha > .002 );
	v.worldNormal = V;
	// Do not send a wrapping particle's discontinuity into temporal history.
	let motion = p - previous;
	v.prevWorldPos = world - select( vec3f( 0.0 ), motion, length( motion ) < .1 );
	o.vDust = vec4f( light * vec3f( .95, .9, .8 ), alpha );
	o.vDustUV = v.position.xy;
`,
			surface: /* wgsl */`
	let profile = exp( -3.5 * dot( in.vs.vDustUV, in.vs.vDustUV ) );
	let alpha = in.vs.vDust.a * profile;
	if ( profile < .35 || alpha < .006 ) { discard; }
	s.alpha = alpha;
	s.albedo = in.vs.vDust.rgb * alpha;
`,
			output: 'r.color = vec4f( s.albedo, s.alpha );',
		} );
		const geometry = new PlaneGeometry( 2, 2 );
		this.mesh = new Mesh( geometry, this.material );
		this.mesh.name = 'Station interior dust';
		this.mesh.frustumCulled = false;
		this.mesh.castShadow = false;
		this.mesh.layers.set( LAYERS.TRANSPARENT );
		this.mesh.renderOrder = 21;
		this.material.userData.warmup = 'station';
		this.amount = amount;
	}

	get amount() { return this._amount; }
	set amount( value ) {
		this._amount = clampAmount( value );
		const perRoom = PER_ROOM * this._amount;
		this.material.uniforms.population.value = perRoom;
		// The four-vertex plane and shader remain unchanged at every setting. Only
		// the instance count grows; there are no per-particle buffers to allocate.
		this.mesh.geometry.instanceCount = Math.ceil( perRoom ) * this.volumes.length;
		if ( this._amount === 0 ) this.mesh.visible = false;
	}

	get particleCount() { return this.mesh.geometry.instanceCount; }

	update( camera ) {
		const p = camera.position;
		this.mesh.visible = this.particleCount > 0 && this.material.uniforms.intensity.value > 0 && this.volumes.some( r =>
			Math.hypot( Math.max( r.min[ 0 ] - p.x, 0, p.x - r.max[ 0 ] ),
				Math.max( r.min[ 1 ] - p.y, 0, p.y - r.max[ 1 ] ),
				Math.max( r.min[ 2 ] - p.z, 0, p.z - r.max[ 2 ] ) ) < 9 );
	}

}
