// Loader for the lighthouse tender Hesperus (1896), exported from tools/ships/hesperus.blend by
// tools/ships/hesperus_export.py into public/models/hesperus/ (hesperus.json + hesperus.bin + the ensign texture).
// Metres, engine Y up. Origin: amidships on the load waterline. +Z is forward (the bow), +X is port; the keel is at
// y = -3. Three levels of detail: 'full' (boarding, under 600 m), 'lod1' (to 4 km), 'lod2' (the horizon silhouette).
// Each level is a list of finishes (one per material): float32 positions, int8 normals (divide by 127, or upload as
// normalised bytes), float32 uvs where the finish has a texture (v up), uint16 or uint32 triangle indices that are
// relative to the finish's own vertices. The arrays are views into the one downloaded buffer, not copies.
// Not wired into the game yet. Written without a JS runtime to hand: untested.

const INDEX_TYPES = { uint16: Uint16Array, uint32: Uint32Array };

export async function loadHesperus( baseUrl ) {

	const base = baseUrl.endsWith( '/' ) ? baseUrl : baseUrl + '/';
	const get = async ( name ) => {

		const res = await fetch( base + name );
		if ( ! res.ok ) throw new Error( 'HesperusModel: ' + name + ' ' + res.status );
		return res;

	};
	const manifest = await ( await get( 'hesperus.json' ) ).json();
	if ( manifest.format !== 'hesperus-model' || manifest.version !== 1 ) throw new Error( 'HesperusModel: unknown manifest version' );
	const bin = await ( await get( manifest.bin ) ).arrayBuffer();
	if ( bin.byteLength !== manifest.byteLength ) throw new Error( 'HesperusModel: hesperus.bin is ' + bin.byteLength + ' bytes, manifest says ' + manifest.byteLength );

	// every block starts on a 4-byte boundary, so plain typed-array views are valid (little-endian hosts)
	const level = ( lod ) => ( {
		name: lod.name,
		range: lod.range ?? null,
		triangles: lod.triangles,
		bounds: lod.bounds,
		finishes: lod.finishes.map( ( f ) => ( {
			name: f.name,
			color: f.color,
			roughness: f.roughness,
			metallic: f.metallic,
			// alpha below 1 is glass (the wheelhouse windows): draw it blended and two-sided. emission above 0 is a lit
			// lamp, or the sky seen through a scuttle or skylight from inside ('int_daylight': put it out at night).
			alpha: f.alpha ?? 1,
			emission: f.emission ?? 0,
			texture: f.texture ? base + f.texture : null,
			vertexCount: f.vertexCount,
			indexCount: f.indexCount,
			positions: new Float32Array( bin, f.position.byteOffset, f.vertexCount * 3 ),
			normals: new Int8Array( bin, f.normal.byteOffset, f.vertexCount * 3 ),
			uvs: f.uv ? new Float32Array( bin, f.uv.byteOffset, f.vertexCount * 2 ) : null,
			indices: new INDEX_TYPES[ f.indexType ]( bin, f.index.byteOffset, f.indexCount ),
		} ) ),
	} );
	const lods = manifest.lods.map( level );
	// The rooms (wheelhouse and chart house furniture, galley, after deckhouse, saloon) are a block of their own, kept
	// out of 'full': draw it with 'full' only when the player is aboard.
	const interior = manifest.interior ? level( manifest.interior ) : null;

	return { manifest, lods, interior, lights: manifest.lights, waterlineY: manifest.waterlineY, midships: manifest.midships };

}

// The level of detail suggested for a viewing distance in metres.
export function hesperusLod( model, distance ) {

	for ( const lod of model.lods ) if ( lod.range.max === null || distance < lod.range.max ) return lod;
	return model.lods[ model.lods.length - 1 ];

}
