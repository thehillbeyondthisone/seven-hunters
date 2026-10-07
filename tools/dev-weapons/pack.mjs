// Pack the licensed Sketchfab glTF download into a self-contained GLB. No dependencies.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
const source = resolve( 'tools/dev-weapons/source/minigun' );
const json = JSON.parse( readFileSync( resolve( source, 'scene.gltf' ), 'utf8' ) );
const chunks = [ readFileSync( resolve( source, json.buffers[ 0 ].uri ) ) ];
let length = chunks[ 0 ].length;
for ( const image of json.images ) {
	const pad = ( 4 - length % 4 ) % 4;
	chunks.push( Buffer.alloc( pad ) ); length += pad;
	const bytes = readFileSync( resolve( 'tools/dev-weapons/source/runtime-textures', image.uri.split( '/' ).pop() ) );
	image.bufferView = json.bufferViews.length;
	image.mimeType = 'image/png';
	json.bufferViews.push( { buffer: 0, byteOffset: length, byteLength: bytes.length } );
	delete image.uri;
	chunks.push( bytes ); length += bytes.length;
}
json.buffers = [ { byteLength: length } ];
json.asset.extras = { source: 'https://sketchfab.com/3d-models/minigun-9f0d4c65f1284914a8a8f9de76896b21', author: 'TWORKS / trbrick', license: 'CC-BY-4.0', changes: 'Embedded buffers in GLB; PNG textures expanded to RGBA with unchanged size/colours; runtime reorients and animates model.' };
const j = Buffer.from( JSON.stringify( json ) );
const jp = Buffer.alloc( Math.ceil( j.length / 4 ) * 4, 32 ); j.copy( jp );
const bin = Buffer.concat( [ ...chunks, Buffer.alloc( ( 4 - length % 4 ) % 4 ) ] );
const header = Buffer.alloc( 12 ); header.writeUInt32LE( 0x46546c67 ); header.writeUInt32LE( 2, 4 ); header.writeUInt32LE( 28 + jp.length + bin.length, 8 );
const chunkHeader = ( size, type ) => { const b = Buffer.alloc( 8 ); b.writeUInt32LE( size ); b.writeUInt32LE( type, 4 ); return b; };
const out = resolve( 'public/models/dev-weapons/minigun.glb' );
mkdirSync( dirname( out ), { recursive: true } );
writeFileSync( out, Buffer.concat( [ header, chunkHeader( jp.length, 0x4e4f534a ), jp, chunkHeader( bin.length, 0x004e4942 ), bin ] ) );
console.log( `Packed ${ out } (${ ( ( 28 + jp.length + bin.length ) / 1024 / 1024 ).toFixed( 2 ) } MiB)` );
