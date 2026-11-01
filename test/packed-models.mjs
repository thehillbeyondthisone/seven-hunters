import { KEEPER_HAND_POSES } from '../src/world/flannan/KeeperHandPosesModel.js';
import { GATE_WORK_MODEL } from '../src/world/flannan/GateWorkModel.js';
import { DOMESTIC_CRAFT_MODEL } from '../src/world/flannan/DomesticCraftModel.js';
import { STORM_WORK_MODEL } from '../src/world/flannan/StormWorkModel.js';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import { packModel, packedModels } from '../tools/build/packed-models.mjs';
import { decodePackedModel } from '../src/world/flannan/PackedModels.js';
import { ROOM_CRAFT_MODEL } from '../src/world/flannan/RoomCraftModel.js';
import { STATION_CRAFT_MODEL } from '../src/world/flannan/StationCraftModel.js';
import { INSTRUMENT_MODEL } from '../src/world/flannan/InstrumentModel.js';
import { SIGNAL_LAMP } from '../src/world/flannan/SignalLampModel.js';
import { HAND_LAMP_MODEL } from '../src/station/HandLampModel.js';
import { resolve } from 'node:path';

const compare = ( source, decoded, buffer, key ) => {

	if ( Array.isArray( source ) && source.every( n => typeof n === 'number' ) ) {

		assert.equal( decoded.buffer, buffer, 'mesh arrays view the downloaded buffer without copies' );
		const expected = key === 'idx' ? new Uint32Array( source ) : new Float32Array( source );
		assert.deepEqual( decoded, expected, 'packed geometry matches the engine\'s exact numeric precision' );

	} else if ( source && typeof source === 'object' ) {

		assert.deepEqual( Object.keys( decoded ), Object.keys( source ) );
		for ( const name of Object.keys( source ) ) compare( source[ name ], decoded[ name ], buffer, name );

	} else assert.equal( decoded, source );

};
for ( const [ name, model ] of Object.entries( { ROOM_CRAFT_MODEL, STATION_CRAFT_MODEL, INSTRUMENT_MODEL, SIGNAL_LAMP, HAND_LAMP_MODEL, KEEPER_HAND_POSES, GATE_WORK_MODEL, DOMESTIC_CRAFT_MODEL, STORM_WORK_MODEL } ) ) {

	const packed = packModel( model );
	const buffer = packed.buffer.slice( packed.byteOffset, packed.byteOffset + packed.byteLength );
	compare( model, decodePackedModel( buffer ), buffer );
	console.log( name, { binaryBytes: packed.byteLength, gzipBytes: gzipSync( packed ).byteLength } );

}
assert.throws( () => decodePackedModel( new ArrayBuffer( 4 ) ) );
const plugin = packedModels();
plugin.configResolved( { root: resolve( '.' ), command: 'serve' } );
let route, handler;
plugin.configureServer( { middlewares: { use: ( path, middleware ) => { route = path; handler = middleware; } } } );
const id = resolve( 'src/world/flannan/RoomCraftModel.js' );
const source = await readFile( id, 'utf8' );
const result = await plugin.transform( source, id );
assert( result.code.includes( 'await loadPackedModel' ) );
assert( result.code.length < 300, 'browser receives a small loader rather than numeric JS arrays' );
assert.equal( route, '/__packed-models/' );
let response;
handler( { url: '/RoomCraftModel.bin?v=test' }, { setHeader() {}, end( data ) { response = data; } }, () => assert.fail( 'model endpoint must be registered' ) );
assert.deepEqual( response, packModel( ROOM_CRAFT_MODEL ) );
for ( const name of [ 'KeeperHandPosesModel', 'GateWorkModel', 'DomesticCraftModel', 'StormWorkModel' ] ) {
 const id = resolve( 'src/world/flannan/' + name + '.js' );
 const source = await readFile( id, 'utf8' );
 const result = await plugin.transform( source, id );
 assert.ok( result.code.includes( 'await loadPackedModel' ) && result.code.length < 350, 'new Blender exports use the existing binary delivery path' );
}
assert.equal( await plugin.transform( 'export const unrelated = {};', resolve( 'src/OtherModel.js' ) ), undefined );
console.log( 'All authored meshes round-trip exactly at engine precision; development asset delivery passed.' );
