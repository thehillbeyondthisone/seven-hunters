import { Part } from '../village/GeoBuilder.js';
import { lin, HARD } from '../Props.js';
import { UNPACKING_CRAFT_MODEL } from './UnpackingCraftModel.js';

// Editable Blender meshes reuse the station's opaque batch and metre UVs.
// Canvas, wool, paper and leather stay distinct at the warm room light level.
const finishes = {

	canvas: [ 0x9f8b69, HARD( .56, .015, 0, .96 ) ],
	edge: [ 0x796344, HARD( .49, .02, 0, .98 ) ],
	thread: [ 0xc7b18a, HARD( .51, 0, 0, .98 ) ],
	lining: [ 0x4c463a, HARD( .38, 0, 0, .99 ) ],
	leather: [ 0x493324, HARD( .61, .025, 0, .79 ) ],
	brass: [ 0xa48a50, HARD( .45, .015, .85, .38 ) ],
	shirt: [ 0xd2ccba, HARD( .48, 0, 0, .98 ) ],
	shirtShade: [ 0xafa997, HARD( .46, 0, 0, .99 ) ],
	stocking: [ 0x3e5971, HARD( .33, 0, 0, .99 ) ],
	rib: [ 0x4b6a83, HARD( .31, 0, 0, .99 ) ],
	cream: [ 0xd8d1ba, HARD( .23, 0, 0, .66 ) ],
	paper: [ 0xc4ab81, HARD( .39, 0, 0, .98 ) ],
	string: [ 0xb39e78, HARD( .43, 0, 0, .99 ) ],
	ink: [ 0x514c42, HARD( .41, 0, 0, .99 ) ],

};
const parts = new Map();

export function unpackingCraft( B, name, x = 0, y = 0, z = 0, options = {} ) {

	const model = UNPACKING_CRAFT_MODEL[ name ];
	if ( ! model ) throw new Error( `Unknown unpacking prototype ${ name }` );
	for ( const [ finish, g ] of Object.entries( model ) ) {

		const id = name + '/' + finish;
		if ( ! parts.has( id ) ) parts.set( id, new Part( g.p, g.n, g.uv, g.idx ) );
		const [ color, data ] = finishes[ finish ];
		B.part( 'hard', parts.get( id ), x, y, z, { tint: lin( color ), data, ...options } );

	}

}
