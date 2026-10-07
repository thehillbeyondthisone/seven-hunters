import { Vector2, Vector3, Mesh, PlaneGeometry } from '../engine/index.js';
import { UniformBlock, StorageBuffer, ShaderModule, Material, commonModule, LAYERS } from '../engine/webgpu.js';
import { G } from '../core/Globals.js';
import { ShallowSea } from './ShallowSea.js';

// Attached before the ocean composes its shaders. No simulation runs until an
// event is launched; its zero field contributes nothing to an ordinary watch.
export class ExtremeSea {
	constructor( app ) {
		this.app = app; this.active = false; this.age = 0; this.kind = null;
		this.tsunamiHeight = 10;
		this.res = 160; this.size = 1536;
		this.data = new StorageBuffer( { label: 'extremeSeaField', count: this.res ** 2, type: 'vec4f', data: new Float32Array( this.res ** 2 * 4 ) } );
		this.params = new UniformBlock( 'ExtremeSeaParams', { enabled: [ 'f32', 0 ], size: [ 'f32', this.size ], res: [ 'u32', this.res ], min: [ 'vec2f', new Vector2( - this.size / 2, - this.size / 2 ) ], blast: [ 'vec4f', [ 0, 0, - 1, 0 ] ] }, { label: 'extremeSea' } );
		this.module = new ShaderModule( { name: 'extremeSea', deps: [ commonModule ], uniforms: this.params, uniformName: 'extremeSeaP', bindings: { extremeSeaField: { storage: this.data, access: 'read' } }, code: /* wgsl */`
fn extremeSeaSample( xz: vec2f ) -> vec4f {
	if ( extremeSeaP.enabled < 0.5 ) { return vec4f( 0.0 ); }
	let uv = ( xz - extremeSeaP.min ) / extremeSeaP.size;
	if ( any( uv <= vec2f( 0.0 ) ) || any( uv >= vec2f( 1.0 ) ) ) { return vec4f( 0.0 ); }
	let p = clamp( uv * f32( extremeSeaP.res ) - 0.5, vec2f( 0.0 ), vec2f( f32( extremeSeaP.res ) - 1.001 ) );
	let q = vec2u( floor( p ) ); let t = fract( p ); let i = q.y * extremeSeaP.res + q.x;
	let a = extremeSeaField[ i ]; let b = extremeSeaField[ i + 1u ];
	let c = extremeSeaField[ i + extremeSeaP.res ]; let d = extremeSeaField[ i + extremeSeaP.res + 1u ];
	let weights = vec4f( ( 1.0 - t.x ) * ( 1.0 - t.y ), t.x * ( 1.0 - t.y ), ( 1.0 - t.x ) * t.y, t.x * t.y ) * smoothstep( vec4f( 0.005 ), vec4f( 0.1 ), vec4f( a.w, b.w, c.w, d.w ) );
	let sum = dot( weights, vec4f( 1.0 ) );
	let state = ( a * weights.x + b * weights.y + c * weights.z + d * weights.w ) / max( sum, 0.00001 );
	let border = smoothstep( 0.0, 0.07, min( min( uv.x, uv.y ), min( 1.0 - uv.x, 1.0 - uv.y ) ) );
	// Deep surge water stays clear; whitewater belongs to fast shallow bores.
	let froude = length( state.yz ) / sqrt( 9.81 * max( state.w, 0.1 ) );
	let foam = smoothstep( 0.65, 1.4, froude ) * ( 1.0 - smoothstep( 6.0, 24.0, state.w ) );
	return vec4f( state.xyz, foam ) * border * select( 0.0, 1.0, sum > 0.00001 );
}
fn extremeSeaNormal( xz: vec2f ) -> vec3f {
	let e = extremeSeaP.size / f32( extremeSeaP.res );
	let dx = extremeSeaSample( xz + vec2f( e, 0.0 ) ).x - extremeSeaSample( xz - vec2f( e, 0.0 ) ).x;
	let dz = extremeSeaSample( xz + vec2f( 0.0, e ) ).x - extremeSeaSample( xz - vec2f( 0.0, e ) ).x;
	return normalize( vec3f( - dx / ( 2.0 * e ), 1.0, - dz / ( 2.0 * e ) ) );
}` } );
		// Precompile includes hidden meshes. Warm the burst during loading so its
		// short lifetime cannot elapse while the first-use pipeline compiles.
		this.makePlume(); this.plume.visible = false;
	}
	setTsunamiHeight( value ) {
		if ( Number.isFinite( Number( value ) ) ) this.tsunamiHeight = Math.max( 1, Math.min( 250, Number( value ) ) );
		return this.tsunamiHeight;
	}
	launch( kind, { height = this.tsunamiHeight } = {} ) {
		if ( ! [ 'tsunami', 'blast' ].includes( kind ) ) return false;
		const a = this.app, l = a.terrainData.landing( 'west' );
		const out = new Vector3( l.dir[ 0 ], 0, l.dir[ 1 ] ).normalize();
		const amplitude = this.setTsunamiHeight( height );
		const width = Math.max( 65, amplitude * 3 );
		const distance = kind === 'tsunami' ? 320 : 145;
		let x = l.stage.x + out.x * distance, z = l.stage.z + out.z * distance;
		if ( kind === 'blast' ) {
			// Put the source in the sea in front of the camera when possible, otherwise
			// use the west geo. Never put an underwater source inside dry terrain.
			const f = new Vector3( 0, 0, - 1 ).applyQuaternion( a.camera.quaternion ); f.y = 0; f.normalize();
			for ( const d of [ 65, 95, 140, 200 ] ) {
				const px = a.camera.position.x + f.x * d, pz = a.camera.position.z + f.z * d;
				if ( Math.abs( px ) < 430 && Math.abs( pz ) < 430 && a.terrainData.heightAt( px, pz ) < - 3 ) { x = px; z = pz; break; }
			}
		}
		this.solver = new ShallowSea( { heightAt: ( x, z ) => a.terrainData.heightAt( x, z ), res: this.res, size: this.size, level: G.seaLevel.value } );
		if ( kind === 'tsunami' ) this.solver.seedTsunami( { x, z, nx: - out.x, nz: - out.z, amplitude, width } );
		else this.solver.seedBlast( { x, z } );
		this.kind = kind; this.age = 0; this.active = true; this.params.fields.enabled.value = 1;
		this.params.fields.blast.value = [ x, z, kind === 'blast' ? 0 : - 1, G.seaLevel.value ];
		this.data.write( this.solver.field );
		if ( kind === 'blast' ) { this.makePlume(); this.plume.visible = true; this.boom( x, z ); }
		else if ( this.plume ) this.plume.visible = false;
		return true;
	}
	reset() {
		this.active = false; this.kind = null; this.params.fields.enabled.value = 0;
		this.solver = null; if ( this.plume ) this.plume.visible = false;
	}
	update( dt ) {
		if ( ! this.active ) return;
		dt = Math.max( 0, Math.min( 0.1, Number.isFinite( dt ) ? dt : 0 ) ); this.age += dt;
		this.solver.update( dt ); this.data.write( this.solver.field );
		if ( this.kind === 'blast' ) {
			const b = this.params.fields.blast.value; this.params.fields.blast.value = [ b[ 0 ], b[ 1 ], this.age, b[ 3 ] ];
			if ( this.plume ) this.plume.visible = this.age < 5;
		}
		if ( this.age > ( this.kind === 'tsunami' ? 180 : 90 ) ) this.reset();
	}
	sample( x, z ) { return this.active ? this.solver.sample( x, z ) : { height: 0, u: 0, v: 0, foam: 0 }; }
	makePlume() {
		if ( this.plume ) return;
		const material = new Material( { name: 'Undersea blast water plume', modules: [ this.module, this.app.terrainGPU.module ], lit: false, transparent: true, blending: 'premultiplied', depthWrite: false, side: 'double', underwaterLighting: 'none', varyings: { vPlume: 'vec3f' }, vertex: /* wgsl */`
	let id = f32( v.instance );
	let h = fract( sin( vec3f( id * 1.37 + 0.1, id * 2.53 + 1.7, id * 3.11 + 3.7 ) ) * 43758.5453 );
	let t = extremeSeaP.blast.z - h.z * 0.12; let a = h.y * 6.283185;
	let speed = 2.0 + ( 1.0 - h.x ) * 10.0 + h.z * 3.0;
	let origin = vec3f( extremeSeaP.blast.x, extremeSeaP.blast.w, extremeSeaP.blast.y );
	let vel = vec3f( cos( a ) * speed, 22.0 + h.x * 32.0, sin( a ) * speed );
	let p = origin + vel * t + vec3f( 0.0, -4.905 * t * t, 0.0 );
	let camRight = vec3f( frame.invView[ 0 ].xyz ); let camUp = vec3f( frame.invView[ 1 ].xyz );
	let uv = v.uv * 2.0 - 1.0; let radius = ( 0.25 + h.z * 0.9 ) * ( 1.0 + max( t, 0.0 ) * 0.6 );
	let live = t > 0.0 && t < 5.0 && p.y > max( terrainHeightAt( p.xz ), frame.seaLevel ) && extremeSeaP.enabled > 0.5;
	v.useWorld = true; v.worldPos = select( vec3f( 0.0, -1e5, 0.0 ), p + ( camRight * uv.x + camUp * uv.y ) * radius, live );
	v.prevWorldPos = v.worldPos - vel * frame.dt; v.worldNormal = normalize( frame.cameraPos - p + vec3f( 0.001 ) );
	o.vPlume = vec3f( uv, select( 0.0, ( 1.0 - smoothstep( 2.0, 5.0, t ) ) * 0.45, live ) );
`, surface: /* wgsl */`
	let q = in.vs.vPlume; let alpha = ( 1.0 - smoothstep( 0.2, 1.0, dot( q.xy, q.xy ) ) ) * q.z;
	if ( alpha < 0.005 ) { discard; } s.alpha = alpha;
	s.albedo = ( frame.skyIrradiance * 1.2 + frame.sunColor * 0.08 ) * alpha;
`, output: 'r.color = vec4f( s.albedo, s.alpha );' } );
		const geometry = new PlaneGeometry( 1, 1 ); geometry.instanceCount = 1800;
		this.plume = new Mesh( geometry, material ); this.plume.frustumCulled = false; this.plume.castShadow = false;
		this.plume.layers.set( LAYERS.TRANSPARENT ); this.plume.renderOrder = 24; this.app.scene.add( this.plume );
	}
	boom( x, z ) {
		const s = this.app.audio; if ( ! s?.ctx || ! s.near || s.ctx.state !== 'running' ) return;
		const c = s.ctx, now = c.currentTime, distance = Math.hypot( x - this.app.camera.position.x, z - this.app.camera.position.z );
		const source = c.createOscillator(), gain = c.createGain(); source.type = 'sine';
		source.frequency.setValueAtTime( 95, now ); source.frequency.exponentialRampToValueAtTime( 24, now + 1.1 );
		gain.gain.setValueAtTime( 0.0001, now ); gain.gain.exponentialRampToValueAtTime( 0.16 / ( 1 + distance / 120 ), now + 0.03 );
		gain.gain.exponentialRampToValueAtTime( 0.0001, now + 1.8 ); source.connect( gain ).connect( s.near ); source.start(); source.stop( now + 1.9 );
		source.onended = () => { source.disconnect(); gain.disconnect(); };
	}
}
