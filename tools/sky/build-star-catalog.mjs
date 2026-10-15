// Rebuild the naked-eye HYG subset from the pinned, openly licensed catalog.
// node tools/sky/build-star-catalog.mjs --download
// node tools/sky/build-star-catalog.mjs .local/sky/hygdata_v41.csv.gz
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';

const ROOT = fileURLToPath( new URL( '../../', import.meta.url ) );
const COMMIT = 'c7f7f883fe678cc7680169a50ccd7dcc49b060ce';
const EXPECTED_SHA256 = 'd9f69fd86bbf90a4e4d52b4c5c53eacfa6dfc0bfdef85bfd94f095e0bebe4ebd';
const SOURCE_URL = `https://raw.githubusercontent.com/astronexus/HYG-Database/${ COMMIT }/hyg/CURRENT/hygdata_v41.csv`;
const INPUT = resolve( ROOT, '.local/sky/hygdata_v41.csv.gz' );
const OUTPUT = resolve( ROOT, 'src/sky/data/bright-stars.json' );
const arg = process.argv[ 2 ];
let csv;
if ( arg === '--download' ) {

	const response = await fetch( SOURCE_URL );
	if ( ! response.ok ) throw new Error( `Catalog download failed: ${ response.status }` );
	csv = Buffer.from( await response.arrayBuffer() );
	await mkdir( dirname( INPUT ), { recursive: true } );
	await writeFile( INPUT, gzipSync( csv, { level: 9 } ) );

} else {

	const input = resolve( arg || INPUT );
	const bytes = await readFile( input );
	csv = input.endsWith( '.gz' ) ? gunzipSync( bytes ) : bytes;

}
const sha256 = createHash( 'sha256' ).update( csv ).digest( 'hex' );
if ( sha256 !== EXPECTED_SHA256 ) throw new Error( `Pinned catalog checksum mismatch: ${ sha256 }` );

// CSV parser also accepts quoted commas and escaped quotes in source names.
function parseRow( line ) {

	const fields = [];
	let field = '', quoted = false;
	for ( let i = 0; i < line.length; i ++ ) {

		const c = line[ i ];
		if ( c === '"' ) {

			if ( quoted && line[ i + 1 ] === '"' ) { field += c; i ++; }
			else quoted = ! quoted;

		} else if ( c === ',' && ! quoted ) { fields.push( field ); field = ''; }
		else field += c;

	}
	fields.push( field );
	return fields;

}

const lines = csv.toString( 'utf8' ).trim().split( /\r?\n/ );
const header = parseRow( lines.shift() );
const field = Object.fromEntries( header.map( ( value, index ) => [ value, index ] ) );
const number = ( value ) => value === '' || value === undefined ? null : Number( value );
const stars = [];
for ( const line of lines ) {

	const row = parseRow( line );
	const id = number( row[ field.id ] );
	const mag = number( row[ field.mag ] );
	const ra = number( row[ field.ra ] );
	const dec = number( row[ field.dec ] );
	if ( id === 0 || ! [ id, mag, ra, dec ].every( ( value ) => value !== null && Number.isFinite( value ) ) || mag > 6.5 ) continue;
	stars.push( [
		id,
		number( row[ field.hip ] ),
		( row[ field.proper ] || row[ field.bf ] || '' ).trim(),
		Number( ( ra * 15 ).toFixed( 8 ) ),
		dec,
		mag,
		number( row[ field.ci ] ),
		number( row[ field.pmra ] ) || 0,
		number( row[ field.pmdec ] ) || 0,
	] );

}

const catalog = {
	source: {
		title: 'HYG Stellar Database v4.1',
		creator: 'David Nash / Astronexus',
		url: SOURCE_URL,
		repository: 'https://github.com/astronexus/HYG-Database',
		currentRepository: 'https://codeberg.org/astronexus/hyg',
		commit: COMMIT,
		sha256,
		license: 'CC BY-SA 4.0',
		licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
		selection: 'All finite catalog records with visual magnitude <= 6.5; Sol omitted. Right ascension converted from hours to degrees; unnecessary fields omitted.',
	},
	epoch: 2000,
	columns: [ 'id', 'hip', 'name', 'ra', 'dec', 'mag', 'ci', 'pmra', 'pmdec' ],
	stars,
};
await mkdir( dirname( OUTPUT ), { recursive: true } );
// Keep each row on one line so the vendored data remains compact and reviewable.
const { stars: rows, ...metadata } = catalog;
const text = JSON.stringify( metadata, null, '\t' ).slice( 0, -2 )
	+ ',\n\t"stars": [\n' + rows.map( ( row ) => '\t\t' + JSON.stringify( row ) ).join( ',\n' ) + '\n\t]\n}\n';
await writeFile( OUTPUT, text );
console.log( `${ stars.length } stars -> ${ OUTPUT }` );
console.log( `Source SHA256: ${ catalog.source.sha256 }` );
