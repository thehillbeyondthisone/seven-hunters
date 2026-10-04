import { BufferGeometry, Float32BufferAttribute, Mesh, Group, Color, Vector3 } from '../../engine/index.js';
import { standard } from '../../materials/Materials.js';
import { mulberry32, Noise2D } from '../../util/Noise.js';

// Short wind-combed winter sward, guided by the NRS exterior reference. Seeded dressing,
// not a botanical survey. No textures, alpha blending, collision or tropical vegetation.
// Spatial tiles cull independently; blades shrink into their roots between 45 and 90 m.
export class FlannanSward {
	constructor( { scene, terrain, village, seed = 1901 } ) {
		this.group = new Group();
		this.group.name = 'Flannan winter sward';
		const rand = mulberry32( seed ), noise = new Noise2D( seed ), n = new Vector3();
		const patches = new Map(), foot = village.getFootprints();
		const colors = [ 0x686943, 0x79744c, 0x62683e, 0x8b8059 ].map( c => new Color( c ) );
		const material = standard( {
			name: 'FlannanSward', vertexColors: true, side: 'double', roughness: 0.94,
			attributes: { root: 'vec3f' },
			vertex: /* wgsl */`
	let fade = 1.0 - smoothstep( 45.0, 90.0, distance( v.root, frame.cameraPos ) );
	let bend = v.uv.y * v.uv.y * sin( frame.time * 1.7 + v.root.x * 0.23 + v.root.z * 0.37 ) * 0.025;
	v.position = mix( v.root, v.position + vec3f( frame.windDir.x, 0.0, frame.windDir.y ) * bend, fade );
`,
			surface: 's.ao = mix( 0.65, 1.0, in.uv.y ); s.translucency = vec3f( 0.12 );',
		} );
		this.clumps = 0;
		for ( let z = -180; z < 190; z += 0.95 ) for ( let x = -350; x < 180; x += 0.95 ) {
			const px = x + rand() * 0.95, pz = z + rand() * 0.95;
			if ( rand() > 0.62 + noise.noise( px / 19, pz / 19 ) * 0.3 ) continue;
			const y = terrain.heightAt( px, pz );
			if ( y < 8 || y > 100 || terrain.pathDistance( px, pz ) < 0.45 ) continue;
			terrain.normalAt( px, pz, n );
			if ( n.y < 0.82 || foot.some( f => Math.hypot( px - f.x, pz - f.z ) < f.r + 0.3 ) ) continue;
			const i = Math.floor( ( px - terrain.origin ) / terrain.texel ), j = Math.floor( ( pz - terrain.origin ) / terrain.texel );
			if ( terrain.rock[ j * terrain.res + i ] > 100 ) continue;
			const key = Math.floor( px / 40 ) + ':' + Math.floor( pz / 40 );
			if ( ! patches.has( key ) ) patches.set( key, { position: [], normal: [], color: [], uv: [], root: [] } );
			const b = patches.get( key ), tone = colors[ Math.floor( rand() * colors.length ) ];
			this.clumps ++;
			for ( let k = 0; k < 7; k ++ ) {
				const a = rand() * Math.PI * 2, spread = rand() * 0.18;
				const bx = px + Math.cos( a ) * spread, bz = pz + Math.sin( a ) * spread;
				const by = terrain.heightAt( bx, bz ) - 0.015;
				const h = 0.07 + rand() * 0.13, w = 0.004 + rand() * 0.005;
				const ux = Math.cos( a ) * w, uz = Math.sin( a ) * w;
				const lean = 0.25 + rand() * 0.6, dx = h * ( 0.3 + Math.cos( a ) * lean ), dz = h * ( -0.2 + Math.sin( a ) * lean );
				const points = [ [ bx - ux, by, bz - uz ], [ bx + ux, by, bz + uz ],
					[ bx + dx * 0.35 - ux * 0.55, by + h * 0.6, bz + dz * 0.35 - uz * 0.55 ],
					[ bx + dx * 0.35 + ux * 0.55, by + h * 0.6, bz + dz * 0.35 + uz * 0.55 ],
					[ bx + dx, by + h, bz + dz ] ];
				for ( const v of [ 0, 1, 2, 1, 3, 2, 2, 3, 4 ] ) {
					const tip = v === 4 ? 1 : v > 1 ? 0.6 : 0;
					b.position.push( ...points[ v ] );
					b.uv.push( v % 2, tip );
					b.normal.push( n.x, n.y, n.z );
					b.root.push( bx, by, bz );
					const shade = 0.78 + tip * 0.22;
					b.color.push( tone.r * shade, tone.g * shade, tone.b * shade );
				}
			}
		}
		for ( const [ key, b ] of patches ) {
			const geo = new BufferGeometry();
			for ( const [ name, values ] of Object.entries( b ) ) geo.setAttribute( name, new Float32BufferAttribute( values, name === 'uv' ? 2 : 3 ) );
			geo.computeBoundingBox(); geo.computeBoundingSphere();
			// Small wind displacement is contained in a padded bound.
			geo.boundingSphere.radius += 0.1;
			const mesh = new Mesh( geo, material );
			mesh.name = 'sward-' + key;
			mesh.castShadow = false;
			mesh.receiveShadow = true;
			this.group.add( mesh );
		}
		this.stats = { clumps: this.clumps, triangles: this.clumps * 21, tiles: patches.size };
		scene.add( this.group );
	}
	update( camera ) {
		for ( const mesh of this.group.children ) {
			const b = mesh.geometry.boundingSphere;
			mesh.visible = b.center.distanceTo( camera.position ) < 90 + b.radius;
		}
	}
}
