import { Group, Mesh, PlaneGeometry, Vector3 } from '../../engine/index.js';
import { Material } from '../../engine/render/Material.js';
import { ShaderModule } from '../../engine/gpu/Shader.js';
import { G } from '../../engine/render/Frame.js';
import { LAYERS } from '../../engine/render/SceneRenderer.js';

const PUFFS = 22;

const plumeModule = new ShaderModule( { name: 'chimneyPlume', code: /* wgsl */`
// A stove plume rises in light air, then bends and disperses in the same wind
// as the grass, rain and cloud. Wind is eased on the CPU to avoid a preset snap.
fn chimneyPose( id: f32, time: f32, wind: vec3f ) -> vec4f {
	let age = fract( time * 0.095 + id / ${ PUFFS }.0 );
	let direction = wind.xz;
	let speed = wind.y;
	let crosswind = vec2f( -direction.y, direction.x );
	let drift = pow( age, 1.25 ) * ( 3.0 + speed * 1.05 );
	let wander = sin( age * 10.0 + id * 2.1 ) * age * ( 0.25 + age * 0.65 );
	let xz = direction * drift + crosswind * wander;
	let rise = sqrt( age ) * 0.65 + age * ( 1.8 + 7.0 / ( 1.0 + speed * 0.18 ) );
	return vec4f( xz.x, rise, xz.y, age );
}
` } );

// Sparse soft wisps, without textures or a simulation. The stove's embers/draught
// remain the authored cause; callers still control only strength and elapsed time.
export class ChimneySmoke {
	constructor( origin ) {
		this.group = new Group();
		this.group.name = 'kitchen-chimney-smoke';
		this.group.visible = false;
		this.origin = origin.clone();
		this.time = 0;
		this.wind = new Vector3( G.windDir.value.x, G.windSpeed.value, G.windDir.value.y );
		this.previousWind = this.wind.clone();
		this.material = new Material( {
			name: 'wind-carried chimney smoke', modules: [ plumeModule ],
			transparent: true, depthWrite: false, side: 'double', lit: false,
			receiveShadows: false, underwaterLighting: 'none', velocityWeight: 0.25,
			uniforms: {
				origin: [ 'vec3f', this.origin ], wind: [ 'vec3f', this.wind ], previousWind: [ 'vec3f', this.previousWind ],
				time: [ 'f32', 0 ], previousTime: [ 'f32', 0 ], strength: [ 'f32', 0 ],
			},
			varyings: { vSmoke: 'vec3f' },
			vertex: /* wgsl */`
	let id = f32( v.instance );
	let pose = chimneyPose( id, mat.time, mat.wind );
	let previous = chimneyPose( id, mat.previousTime, mat.previousWind );
	let age = pose.w;
	let size = 0.38 + age * 3.5;
	let right = frame.invView[ 0 ].xyz;
	let up = frame.invView[ 1 ].xyz;
	// Stretch each soft wisp along the projected wind, without rotating the
	// whole plume toward the viewer. The path itself remains in world space.
	let along = normalize( vec3f( mat.wind.x, 0.3, mat.wind.z ) );
	let projected = vec2f( dot( along, right ), dot( along, up ) );
	let axis = normalize( projected + vec2f( 0.0001, 0.0001 ) );
	let across = vec2f( -axis.y, axis.x );
	let stretch = 1.0 + min( mat.wind.y, 30.0 ) * 0.018;
	let corner = axis * v.position.x * stretch + across * v.position.y;
	let offset = ( right * corner.x + up * corner.y ) * size;
	v.useWorld = true;
	v.worldPos = mat.origin + pose.xyz + offset;
	v.worldNormal = normalize( frame.cameraPos - v.worldPos );
	// A recycled puff has faded out: never give it a velocity across the plume.
	let continuous = abs( previous.w - age ) < 0.5;
	let previousSize = 0.38 + previous.w * 3.5;
	v.prevWorldPos = select( v.worldPos, mat.origin + previous.xyz + offset * previousSize / size, continuous );
	o.vSmoke = vec3f( age, id * 0.71, 1.0 / ( 1.0 + mat.wind.y * 0.035 ) );
`,
			surface: /* wgsl */`
	let age = in.vs.vSmoke.x;
	let seed = in.vs.vSmoke.y;
	let q = ( in.uv - vec2f( 0.5 ) ) * 2.0;
	let warp = vec2f( sin( q.y * 4.5 + seed ), sin( q.x * 5.2 - seed ) ) * 0.11;
	let r = dot( q + warp, q + warp );
	let wisps = 0.76 + 0.24 * sin( q.x * 7.0 + seed ) * sin( q.y * 6.0 - seed );
	let life = smoothstep( 0.0, 0.08, age ) * ( 1.0 - smoothstep( 0.35, 1.0, age ) );
	s.alpha = ( 1.0 - smoothstep( 0.08, 1.0, r ) ) * mat.strength * mix( 0.16, 0.30, frame.night ) * life * wisps * in.vs.vSmoke.z;
	if ( s.alpha < 0.001 ) { discard; }
	// The transparent wisp needs a perceptual floor after the night's HDR
	// tone mapping. This changes particle contrast, not scene illumination.
	// Its daylight treatment, source, shape and wind motion stay the same.
	let floor = mix( vec3f( 0.035, 0.041, 0.045 ), vec3f( 0.16, 0.17, 0.175 ), frame.night );
	s.albedo = max( floor, vec3f( 0.075, 0.079, 0.082 ) * ( frame.skyIrradiance * 0.65 + frame.sunColor * 0.08 ) );
`,
		} );
		const geometry = new PlaneGeometry( 1, 1 ); geometry.instanceCount = PUFFS;
		this.mesh = new Mesh( geometry, this.material );
		this.mesh.name = 'wind-carried stove plume';
		this.mesh.layers.set( LAYERS.TRANSPARENT );
		this.mesh.frustumCulled = false;
		this.mesh.castShadow = false;
		this.group.add( this.mesh );
	}
	update( dt, camera, strength = 0 ) {
		const step = Number.isFinite( dt ) ? Math.max( 0, dt ) : 0;
		this.material.uniforms.previousTime.value = this.time;
		this.time += step;
		this.material.uniforms.time.value = this.time;
		this.previousWind.copy( this.wind );
		const ease = 1 - Math.exp( -step / 1.5 );
		const direction = G.windDir.value, length = Math.hypot( direction.x, direction.y );
		const x = length > 0.0001 ? direction.x / length : this.wind.x;
		const z = length > 0.0001 ? direction.y / length : this.wind.z;
		this.wind.x += ( x - this.wind.x ) * ease;
		this.wind.z += ( z - this.wind.z ) * ease;
		this.wind.y += ( Math.max( 0, Math.min( 38, G.windSpeed.value ) ) - this.wind.y ) * ease;
		this.material.uniforms.strength.value = Number.isFinite( strength ) ? Math.max( 0, Math.min( 1, strength ) ) : 0;
		this.group.visible = this.material.uniforms.strength.value > 0;
	}
}
