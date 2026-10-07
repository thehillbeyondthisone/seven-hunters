import { Texture } from '../engine/gpu/Texture.js';

// Tiny original maker's stamp, generated locally; no external font or asset.
const LETTERS = {
	A: [ '01110','10001','10001','11111','10001','10001','10001' ], D: [ '11110','10001','10001','10001','10001','10001','11110' ],
	M: [ '10001','11011','10101','10101','10001','10001','10001' ], I: [ '11111','00100','00100','00100','00100','00100','11111' ],
	R: [ '11110','10001','10001','11110','10100','10010','10001' ], L: [ '10000','10000','10000','10000','10000','10000','11111' ],
	T: [ '11111','00100','00100','00100','00100','00100','00100' ], Y: [ '10001','10001','01010','00100','00100','00100','00100' ],
	G: [ '01110','10001','10000','10111','10001','10001','01110' ], V: [ '10001','10001','10001','10001','10001','01010','00100' ],
	'0': [ '01110','10001','10011','10101','11001','10001','01110' ], '3': [ '11110','00001','00001','01110','00001','00001','11110' ],
};
export function grabberBadge() {
	const size = 256, data = new Uint8Array( size * size * 4 );
	for ( let y = 0; y < size; y ++ ) for ( let x = 0; x < size; x ++ ) {
		const r = Math.hypot( x - 127.5, y - 127.5 ) / 128, grain = Math.sin( x * 2.1 + y * .4 ) * 5;
		const dark = ( r > .86 && r < .89 ) || ( r > .94 && r < .955 );
		data.set( dark ? [ 43, 61, 54, 255 ] : [ 157 + grain, 128 + grain, 68 + grain, 255 ], ( y * size + x ) * 4 );
	}
	const text = ( str, row, scale ) => {
		const left = Math.round( ( size - str.length * 6 * scale + scale ) / 2 );
		for ( let i = 0; i < str.length; i ++ ) for ( let y = 0; y < 7; y ++ ) for ( let x = 0; x < 5; x ++ ) {
			if ( LETTERS[ str[ i ] ]?.[ y ][ x ] !== '1' ) continue;
			for ( let dy = 0; dy < scale; dy ++ ) for ( let dx = 0; dx < scale; dx ++ ) data.set( [ 34, 46, 39, 255 ], ( ( row + y * scale + dy ) * size + left + i * 6 * scale + x * scale + dx ) * 4 );
		}
	};
	text( 'ADMIRALTY', 54, 3 ); text( '03', 100, 9 ); text( 'GRAVITY', 181, 3 );
	return new Texture( { label: 'original Admiralty maker stamp', width: size, height: size, data, sampler: 'linearClamp' } );
}
