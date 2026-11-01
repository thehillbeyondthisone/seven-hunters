import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

const MODELS = new Set( [ 'RoomCraftModel', 'StationCraftModel', 'InstrumentModel', 'SignalLampModel', 'HandLampModel', 'KeeperCraftModel', 'UnpackingCraftModel', 'KeeperHandPosesModel', 'GateWorkModel', 'DomesticCraftModel', 'StormWorkModel' ] );

export function packModel( model ) {

	const chunks = [];
	let offset = 0;
	const encode = ( value, key ) => {

		if ( Array.isArray( value ) && value.every( n => typeof n === 'number' ) ) {

			const type = key === 'idx' ? 'u32' : 'f32';
			const data = type === 'u32' ? new Uint32Array( value ) : new Float32Array( value );
			const entry = { $array: [ type, offset, value.length ] };
			chunks.push( Buffer.from( data.buffer ) );
			offset += data.byteLength;
			return entry;

		}
		if ( Array.isArray( value ) ) return value.map( v => encode( v ) );
		if ( value && typeof value === 'object' ) return Object.fromEntries( Object.entries( value ).map( ( [ k, v ] ) => [ k, encode( v, k ) ] ) );
		return value;

	};
	const header = Buffer.from( JSON.stringify( { version: 1, model: encode( model ) } ) );
	const prefix = Buffer.alloc( Math.ceil( ( 4 + header.byteLength ) / 4 ) * 4 );
	prefix.writeUInt32LE( header.byteLength );
	header.copy( prefix, 4 );
	return Buffer.concat( [ prefix, ...chunks ] );

}

// Keep authored source modules and Node tools unchanged; only served/browser builds use binaries.
export function packedModels() {

	let root, dev;
	const assets = new Map();
	return {

		name: 'packed-station-models', enforce: 'pre',
		configResolved( config ) { root = config.root; dev = config.command === 'serve'; },
		configureServer( server ) {

			server.middlewares.use( '/__packed-models/', ( request, response, next ) => {

				const asset = assets.get( request.url.split( '?' )[ 0 ].replace( /^\//, '' ) );
				if ( ! asset ) return next();
				response.setHeader( 'Content-Type', 'application/octet-stream' );
				response.setHeader( 'Cache-Control', 'no-cache' );
				response.end( asset );

			} );

		},
		async transform( source, id ) {

			const path = id.split( '?' )[ 0 ].replaceAll( '\\', '/' );
			const name = path.split( '/' ).at( - 1 ).replace( /\.js$/, '' );
			if ( ! MODELS.has( name ) || ! path.startsWith( resolve( root, 'src' ).replaceAll( '\\', '/' ) + '/' ) ) return;
			const match = /export const (\w+)\s*=\s*([\s\S]*);\s*$/.exec( source );
			if ( ! match ) throw new Error( `Cannot pack ${ name }: expected a generated JSON model export` );
			// Some older authored exports use unquoted object keys rather than strict JSON.
			let model;
			try { model = JSON.parse( match[ 2 ] ); }
			catch { model = runInNewContext( '(' + match[ 2 ] + ')', Object.create( null ), { timeout: 1000 } ); }
			const binary = packModel( model );
			let url;
			if ( dev ) {

				const filename = name + '.bin';
				assets.set( filename, binary );
				const version = createHash( 'sha256' ).update( binary ).digest( 'hex' ).slice( 0, 12 );
				url = JSON.stringify( '/__packed-models/' + filename + '?v=' + version );

			} else {

				const reference = this.emitFile( { type: 'asset', name: name + '.bin', source: binary } );
				url = 'import.meta.ROLLUP_FILE_URL_' + reference;

			}
			const loader = resolve( root, 'src/world/flannan/PackedModels.js' ).replaceAll( '\\', '/' );
			return { code: `import { loadPackedModel } from ${ JSON.stringify( loader ) };\nexport const ${ match[ 1 ] } = await loadPackedModel( ${ url } );\n`, map: null };

		},

	};

}
