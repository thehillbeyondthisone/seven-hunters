import { Group, Mesh, BufferGeometry, BufferAttribute, Color } from '../engine/index.js';
import { parseGLB as parseMaterials, decodeImage } from '../engine/loaders/GLTF.js';
import { parseGLB } from '../world/debris/GLB.js';
import { Texture } from '../engine/gpu/Texture.js';
import { generateMipmaps } from '../engine/gpu/Mipmaps.js';
import { standard } from '../materials/Materials.js';

const BASE = ( import.meta.env?.BASE_URL || '/' ) + 'models/dev-weapons/';

// The author's original meshes and PBR textures, flattened into metre-scale model space.
// Separate only the front barrel cluster so it can spin independently of the handles/body.
export async function loadMinigun() {
	const url = BASE + 'minigun.glb';
	const bytes = globalThis.__assetFile ? await globalThis.__assetFile( url ) : await fetch( url ).then( r => {
		if ( ! r.ok ) throw new Error( `Minigun model: HTTP ${ r.status }` );
		return r.arrayBuffer();
	} );
	const gltf = parseMaterials( bytes );
	const flat = parseGLB( bytes );
	const group = new Group(), barrels = new Group();
	group.name = 'TWORKS minigun'; barrels.name = 'rotating barrel cluster'; group.add( barrels );
	for ( let i = 0; i < flat.meshes.length; i ++ ) {
		const { geometry } = flat.meshes[ i ];
		const gm = gltf.materials[ gltf.meshes[ i ][ 0 ].material ], pbr = gm.pbrMetallicRoughness;
		const im = gltf.images[ gltf.textures[ pbr.metallicRoughnessTexture.index ].source ];
		const px = await decodeImage( im.bytes, im.mimeType );
		const orm = new Texture( { label: 'minigun ORM ' + i, width: px.width, height: px.height, data: px.data, mips: true, sampler: 'anisoRepeat' } );
		orm.getGPU(); generateMipmaps( orm );
		const mat = standard( {
			name: gm.name, color: new Color().setRGB( ...pbr.baseColorFactor.slice( 0, 3 ) ), roughness: 1, metalness: 1, side: gm.doubleSided ? 2 : 0,
			textures: { weaponOrm: orm },
			surface: 'let orm = textureSample( weaponOrm, smpAnisoRepeat, in.uv ); s.roughness *= orm.g; s.metalness *= orm.b;',
		} );
		const index = geometry.index.array, p = geometry.attributes.position.array;
		const rotating = [], fixed = [];
		for ( let t = 0; t < index.length; t += 3 ) {
			const ids = [ index[ t ], index[ t + 1 ], index[ t + 2 ] ];
			// Entire triangles only; rear receiver, top sight and grips stay fixed.
			const spin = ids.every( v => p[ v * 3 + 2 ] > 0.16 && Math.hypot( p[ v * 3 ], p[ v * 3 + 1 ] ) < 0.1 );
			( spin ? rotating : fixed ).push( ...ids );
		}
		for ( const [ indices, parent ] of [ [ fixed, group ], [ rotating, barrels ] ] ) {
			if ( ! indices.length ) continue;
			const geo = new BufferGeometry();
			for ( const name of [ 'position', 'normal', 'uv' ] ) geo.setAttribute( name, geometry.attributes[ name ].clone() );
			geo.setIndex( new BufferAttribute( new Uint32Array( indices ), 1 ) );
			geo.rotateY( Math.PI ); geo.computeBoundingSphere();
			const mesh = new Mesh( geo, mat ); mesh.frustumCulled = false; parent.add( mesh );
		}
	}
	return { group, barrels };
}
