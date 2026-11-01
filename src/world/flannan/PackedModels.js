// Small JSON topology header followed by aligned float32 / uint32 mesh arrays.
// Geometry views share the downloaded buffer and need no numeric JS parsing or copies.
export function decodePackedModel( buffer ) {

	const headerLength = new DataView( buffer ).getUint32( 0, true );
	const dataStart = Math.ceil( ( 4 + headerLength ) / 4 ) * 4;
	if ( dataStart > buffer.byteLength ) throw new Error( 'Invalid packed model header' );
	const header = JSON.parse( new TextDecoder().decode( new Uint8Array( buffer, 4, headerLength ) ) );
	if ( header.version !== 1 ) throw new Error( 'Unsupported packed model version' );
	const decode = value => {

		if ( value && typeof value === 'object' && value.$array ) {

			const [ type, offset, length ] = value.$array;
			if ( ! [ 'f32', 'u32' ].includes( type ) || ! Number.isSafeInteger( offset ) || offset < 0 || offset % 4 || ! Number.isSafeInteger( length ) || length < 0 || dataStart + offset + length * 4 > buffer.byteLength ) throw new Error( 'Invalid packed model array' );
			return new ( type === 'u32' ? Uint32Array : Float32Array )( buffer, dataStart + offset, length );

		}
		if ( Array.isArray( value ) ) return value.map( decode );
		if ( value && typeof value === 'object' ) return Object.fromEntries( Object.entries( value ).map( ( [ key, item ] ) => [ key, decode( item ) ] ) );
		return value;

	};
	return decode( header.model );

}

export async function loadPackedModel( url ) {

	const response = await fetch( url );
	if ( ! response.ok ) throw new Error( `Could not load station model: ${ response.status }` );
	return decodePackedModel( await response.arrayBuffer() );

}
