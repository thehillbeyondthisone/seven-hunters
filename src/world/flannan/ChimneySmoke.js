import { Group, Mesh, PlaneGeometry } from '../../engine/index.js';
import { Material } from '../../engine/render/Material.js';
import { LAYERS } from '../../engine/render/SceneRenderer.js';

// Sparse soft puffs, with no texture or additional simulation. The stove's
// embers/draught are the authored cause; the story never labels the distant plume.
export class ChimneySmoke {
	constructor( origin ) {
		this.group = new Group();
		this.group.name = 'kitchen-chimney-smoke';
		this.group.visible = false;
		this.origin = origin.clone();
		this.time = 0;
		this.puffs = [];
		const geo = new PlaneGeometry( 1, 1 );
		for ( let i = 0; i < 22; i ++ ) {
			const mat = new Material( { name: 'soft chimney smoke', transparent: true, depthWrite: false, side: 'double', lit: false,
				uniforms: { density: [ 'f32', 0 ], seed: [ 'f32', i * 0.71 ] },
				surface: `
	let q = (in.uv - vec2f(0.5)) * 2.0;
	let r = dot(q, q);
	let wisps = 0.76 + 0.24 * sin(q.x * 7.0 + mat.seed) * sin(q.y * 6.0 - mat.seed);
	s.alpha = (1.0 - smoothstep(0.12, 1.0, r)) * mat.density * wisps;
	s.albedo = vec3f(0.035, 0.041, 0.045);
` } );
			const mesh = new Mesh( geo, mat );
			mesh.layers.set( LAYERS.TRANSPARENT );
			mesh.castShadow = false;
			this.group.add( mesh ); this.puffs.push( mesh );
		}
	}
	update( dt, camera, strength = 0 ) {
		this.time += dt;
		this.group.visible = strength > 0;
		if ( ! this.group.visible ) return;
		for ( let i = 0; i < this.puffs.length; i ++ ) {
			const p = this.puffs[ i ], age = ( this.time * 0.07 + i / this.puffs.length ) % 1;
			p.position.copy( this.origin );
			p.position.x += age * 12 + Math.sin( age * 11 + i ) * age * 0.6;
			p.position.z += age * 3.2;
			p.position.y += age * 12;
			p.quaternion.copy( camera.quaternion );
			p.scale.setScalar( 0.65 + age * 6 );
			p.material.uniforms.density.value = strength * 0.2 * Math.sin( age * Math.PI );
		}
	}
}
