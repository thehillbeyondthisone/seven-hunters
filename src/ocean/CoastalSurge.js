import { Vector4, PlaneGeometry, Mesh } from '../engine/index.js';
import { UniformBlock, ShaderModule, Material, commonModule, LAYERS } from '../engine/webgpu.js';
import { CoastalState, COAST_PERIOD, COAST_SETS } from './CoastalState.js';

export class CoastalSurge extends CoastalState {
	constructor( { terrain, terrainGPU, scene } ) {
		super( terrain );
		this.params = new UniformBlock( 'CoastalSurgeParams', {
			time: [ 'f32', 0 ], strength: [ 'f32', this.strength ], rogue: [ 'f32', 0 ],
			sites: [ 'vec4f[2]', this.sites.map( s => new Vector4( s.x, s.z, s.dx, s.dz ) ) ],
			shapes: [ 'vec4f[2]', this.sites.map( s => new Vector4( s.width, s.reach, s.exposure, s.phase ) ) ],
		}, { label: 'coastalSurge' } );
		this.module = new ShaderModule( { name: 'coastalSurge', deps: [ commonModule ], uniforms: this.params, uniformName: 'coast', code: /* wgsl */`
fn coastalSiteSample( xz: vec2f, i: u32 ) -> vec4f {
	let s = coast.sites[i]; let shape = coast.shapes[i]; let q = xz - s.xy;
	let along = dot(q, s.zw); let across = abs(dot(q, vec2f(-s.w, s.z)));
	let clock = max(0.0, coast.time + along / 9.0 + shape.w);
	let wave = floor(clock / ${ COAST_PERIOD }.0); let phase = fract(clock / ${ COAST_PERIOD }.0);
	let mask = (1.0-smoothstep(shape.x*.4,shape.x*.6,across)) * (1.0-smoothstep(0.0,shape.y,-along)) * (1.0-smoothstep(40.0,80.0,along));
	let pulse = smoothstep(0.0,.13,phase) * (1.0-smoothstep(.13,.49,phase));
	let sets = array<f32,5>(${ COAST_SETS.map( n => n.toFixed( 2 ) ).join( ',' ) });
	let amplitude = (.5+coast.strength*4.0)*sets[u32(wave)%5u]*shape.z + select(0.0,coast.rogue,i==1u);
	let speed = min(9.0,amplitude*.9)*pulse*mask*select(-1.0,.75,phase>.26);
	let ripple=.06*sin(xz.x*.8+coast.time*1.6)*sin(xz.y*.9+coast.time*1.2);
	return vec4f(max(0.0,(amplitude+ripple)*pulse*mask),s.zw*speed,pulse*mask);
}
fn coastalSample( xz: vec2f ) -> vec4f {
	let a=coastalSiteSample(xz,0u); let b=coastalSiteSample(xz,1u); return select(a,b,b.x>a.x);
}
fn coastalNormal( xz: vec2f ) -> vec3f {
	let e=.3; let dx=coastalSample(xz+vec2f(e,0.0)).x-coastalSample(xz-vec2f(e,0.0)).x;
	let dz=coastalSample(xz+vec2f(0.0,e)).x-coastalSample(xz-vec2f(0.0,e)).x;
	return normalize(vec3f(-dx/(2.0*e),1.0,-dz/(2.0*e)));
}` } );
		// Fine local sheets resolve the narrow stages even on the mobile ocean grid.
		this.meshes = this.sites.map( ( s, i ) => {
			const material = new Material( { name: 'Landing wash', modules: [ this.module, terrainGPU.module ], transparent: true, depthWrite: false, side: 'double', roughness: .48, underwaterLighting: 'none', varyings: { vWash: 'vec2f' }, vertex: /* wgsl */`
	let site=coast.sites[${ i }]; let shape=coast.shapes[${ i }];
	let along=mix(-shape.y,80.0,v.uv.y); let across=(v.uv.x-.5)*shape.x*1.2;
	let xz=site.xy+site.zw*along+vec2f(-site.w,site.z)*across;
	let q=coastalSample(xz); v.useWorld=true; v.worldPos=vec3f(xz.x,frame.seaLevel+q.x+.025,xz.y);
	v.worldNormal=coastalNormal(xz); v.prevWorldPos=v.worldPos; o.vWash=vec2f(q.w,q.x);
`, surface: /* wgsl */`
	let ground=terrainHeightAt(in.P.xz); let depth=in.P.y-ground;
	// The FFT material draws the sea and deep wash. These fine sheets add only
	// shallow moving foam over the landing, without covering the ocean's detail.
	if(ground<-.2 || depth<.025 || in.vs.vWash.y<.12){ discard; }
	let flow=coastalSample(in.P.xz).yz;
	let lace=.5+.5*mx_noise_float3(vec3f((in.P.xz-flow*coast.time*.15)*1.8,coast.time*.35));
	let foam=in.vs.vWash.x*smoothstep(.25,.75,lace);
	s.alpha=foam*.7*(1.0-smoothstep(1.5,3.0,depth))*smoothstep(.025,.15,depth);
	s.albedo=vec3f(.62,.72,.72); s.roughness=.65;
` } );
			const mesh = new Mesh( new PlaneGeometry( 1, 1, 12, 96 ), material ); mesh.name = `${ s.name } landing wash`;
			mesh.frustumCulled = false; mesh.castShadow = false; mesh.layers.set( LAYERS.TRANSPARENT ); scene.add( mesh ); return mesh;
		} );
		this.lastWaves = this.sites.map( () => -1 );
	}
	sync() {
		this.params.fields.time.value = this.time; this.params.fields.strength.value = this.strength; this.params.fields.rogue.value = this.rogue;
	}
	update( dt, options ) {
		super.update( dt, options ); this.sync();
		if ( options?.paused ) return;
		this.sites.forEach( ( s, i ) => {
			const q = this.sample( { x: s.x, z: s.z } );
			if ( q.wave !== this.lastWaves[ i ] && q.phase >= .075 && q.phase < .3 ) {
				this.lastWaves[ i ] = q.wave; this.onImpact?.( s, Math.min( 1.5, this.strength * s.exposure ) );
			}
		} );
	}
	load( data ) { super.load( data ); this.sync(); this.lastWaves = this.sites.map( () => -1 ); }
}
