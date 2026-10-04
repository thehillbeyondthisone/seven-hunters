import { Vector3, Vector4, PlaneGeometry, BufferAttribute, Mesh } from '../engine/index.js';
import { UniformBlock, ShaderModule, Material, commonModule, LAYERS } from '../engine/webgpu.js';
import { G } from '../core/Globals.js';
import { SPRAY } from '../fx/Spray.js';
import { buildCliffSites, cliffPulse } from './CliffImpact.js';

export class CliffSurge {
	constructor( { scene, terrain, terrainGPU, spray, shore, audio = null } ) {
		this.sites = buildCliffSites( terrain );
		this.spray = spray;
		this.shore = shore;
		this.audio = audio;
		this.emission = 0;
		this.position = new Vector3(); this.end = new Vector3(); this.velocity = new Vector3();
		this.lastWaves = new Map();
		this.impacts = 0;
		this.uniforms = new UniformBlock( 'CliffSurgeParams', {
			strength: [ 'f32', 0.38 ], period: [ 'f32', 14 ],
			sites: [ 'vec4f[8]', Array.from( { length: 8 }, () => new Vector4( 1e6, 1e6, 0, 0 ) ) ],
		}, { label: 'cliffSurge' } );
		this.module = new ShaderModule( { name: 'cliffSurge', deps: [ commonModule ], uniforms: this.uniforms, uniformName: 'cliff', code: /* wgsl */`
fn cliffPulse( phase: f32 ) -> f32 {
	let p = fract( frame.time / max( cliff.period, 4.0 ) + phase );
	return smoothstep( 0.0, 0.075, p ) * ( 1.0 - smoothstep( 0.13, 0.34, p ) );
}
// Residual aerated water spreads out from an impact and drains between sets. No extra textures.
fn cliffFoamAt( xz: vec2f ) -> f32 {
	var foam = 0.0;
	for ( var i = 0u; i < 8u; i ++ ) {
		let site = cliff.sites[ i ];
		let p = fract( frame.time / max( cliff.period, 4.0 ) + site.w );
		let radius = 12.0 + p * 25.0;
		let d = length( xz - site.xy );
		let wash = ( 0.18 + cliffPulse( site.w ) * 0.85 ) * ( 1.0 - smoothstep( 0.4, 0.95, p ) );
		foam = max( foam, ( 1.0 - smoothstep( radius * 0.25, radius, d ) ) * wash * site.z * cliff.strength );
	}
	return foam;
}
` } );
		const material = this.material = new Material( {
			name: 'Cliff run-up', modules: [ this.module, terrainGPU.module ], transparent: true, side: 'double',
			depthWrite: false, roughness: 0.42, metalness: 0, underwaterLighting: 'none',
			attributes: { aSite: 'vec4f', aCliff: 'vec4f' }, varyings: { vCliff: 'vec3f' },
			vertex: /* wgsl */`
	let u = v.uv.y;
	let across = ( v.uv.x - 0.5 ) * v.aCliff.z;
	let n = v.aCliff.xy;
	let tangent = vec2f( - n.y, n.x );
	let pulse = cliffPulse( v.aSite.w );
	let H = ( 1.3 + 7.5 * cliff.strength ) * v.aSite.z * pulse;
	let spread = 1.5 + ( 1.0 - u ) * 19.0 + sin( u * PI ) * H * 0.28;
	let xz = v.aSite.xy + n * spread + tangent * across;
	let crest = pow( u, 2.6 );
	let y = frame.seaLevel + 0.2 + H * crest + sin( u * PI ) * H * 0.14;
	v.useWorld = true; v.worldPos = vec3f( xz.x, y, xz.y );
	v.worldNormal = normalize( vec3f( n.x * u, 1.0 - u * 0.8, n.y * u ) );
	v.prevWorldPos = v.worldPos;
	o.vCliff = vec3f( pulse * v.aSite.z, u, v.uv.x );
`,
			surface: /* wgsl */`
	let q = in.vs.vCliff;
	if ( in.P.y < terrainHeightAt( in.P.xz ) + 0.08 ) { discard; }
	let edge = smoothstep( 0.0, 0.16, q.z ) * ( 1.0 - smoothstep( 0.84, 1.0, q.z ) );
	let lace = 0.65 + 0.35 * sin( in.P.x * 3.7 + sin( in.P.z * 4.3 ) + frame.time * 2.0 );
	let a = edge * q.x * smoothstep( 0.0, 0.18, q.y ) * ( 1.0 - smoothstep( 0.82, 1.0, q.y ) ) * cliff.strength * 0.75;
	if ( a < 0.008 ) { discard; }
	let froth = smoothstep( 0.38, 0.88, q.y ) * lace;
	s.albedo = mix( vec3f( 0.035, 0.12, 0.13 ), vec3f( 0.65, 0.76, 0.74 ), froth );
	s.alpha = a; s.roughness = mix( 0.24, 0.85, froth );
	s.translucency = vec3f( 0.2 * ( 1.0 - froth ) );
`,
		} );
		const geometry = new PlaneGeometry( 1, 1, 8, 20 );
		const a = new Float32Array( this.sites.length * 4 ), b = new Float32Array( a.length );
		this.sites.forEach( ( s, i ) => {
			a.set( [ s.x, s.z, s.exposure, s.phase ], i * 4 );
			b.set( [ s.nx, s.nz, s.width, s.height ], i * 4 );
		} );
		for ( const [ name, data ] of [ [ 'aSite', a ], [ 'aCliff', b ] ] ) {
			const attr = new BufferAttribute( data, 4 ); attr.isInstancedBufferAttribute = true; attr.meshPerAttribute = 1;
			geometry.setAttribute( name, attr );
		}
		geometry.instanceCount = this.sites.length;
		this.mesh = new Mesh( geometry, material );
		this.mesh.name = 'Atlantic cliff surf'; this.mesh.frustumCulled = false;
		this.mesh.castShadow = false; this.mesh.layers.set( LAYERS.TRANSPARENT );
		scene.add( this.mesh );
	}
	update( dt, camera, weather = null ) {
		const strength = weather ? weather.surf : Math.min( 0.65, Math.max( 0.15, G.windSpeed.value / 24 ) );
		const period = this.shore.period.value;
		this.uniforms.fields.strength.value = strength;
		this.uniforms.fields.period.value = period;
		const p = camera.position, t = G.time.value;
		const near = this.sites.map( ( s ) => ( { s, d: Math.hypot( s.x - p.x, s.z - p.z ) } ) ).sort( ( a, b ) => a.d - b.d ).slice( 0, 8 );
		near.forEach( ( { s, d }, i ) => this.uniforms.fields.sites.value[ i ].set( s.x, s.z, d < 380 ? s.exposure : 0, s.phase ) );
		this.emission += Math.max( 0, dt );
		const emit = this.emission >= 1 / 30;
		const step = Math.min( this.emission, 0.1 );
		if ( emit ) this.emission = 0;
		// Four nearby emitters * three requests leave room in Spray's 32-request ring for other systems.
		for ( const { s, d } of near.slice( 0, 4 ) ) {
			const wave = Math.floor( t / period + s.phase - 0.075 );
			const phase = ( t / period + s.phase ) - Math.floor( t / period + s.phase );
			if ( this.lastWaves.has( s ) && wave === this.lastWaves.get( s ) + 1 && phase < 0.13 && d < 340 ) {
				this.impacts ++;
				this.audio?.cliffImpact( s, strength * s.exposure );
			}
			this.lastWaves.set( s, wave );
			const pulse = cliffPulse( t, s.phase, period ) * strength * s.exposure;
			if ( ! emit || d > 270 || pulse < 0.025 ) continue;
			this.position.set( s.x + s.nx * 3 + s.nz * s.width / 2, 0.9, s.z + s.nz * 3 - s.nx * s.width / 2 );
			this.end.set( s.x + s.nx * 3 - s.nz * s.width / 2, 1.2, s.z + s.nz * 3 + s.nx * s.width / 2 );
			const h = 2 + 8 * pulse;
			this.velocity.set( s.nx * ( 1.5 + 3 * pulse ), Math.sqrt( 19.62 * h ), s.nz * ( 1.5 + 3 * pulse ) );
			const count = Math.ceil( step * pulse * 1100 );
			this.spray.emit( this.position, this.velocity, count, 0.3 + pulse * 0.35, SPRAY.SPRAY, { to: this.end, life: 3, spread: 3, jitter: 0.5 } );
			this.spray.emit( this.position, this.velocity, Math.ceil( count * 0.6 ), 0.035, SPRAY.DROPLET, { to: this.end, life: 3, spread: 4, jitter: 1 } );
			this.velocity.multiplyScalar( 0.4 );
			this.spray.emit( this.position, this.velocity, Math.ceil( count * 0.3 ), 0.7, SPRAY.MIST, { to: this.end, life: 4, spread: 2, jitter: 1.3 } );
		}
	}
}
