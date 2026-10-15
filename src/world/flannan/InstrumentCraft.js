import { Builder, Part } from '../village/GeoBuilder.js';
import { lin, HARD, WOOD } from '../Props.js';
import { INSTRUMENT_MODEL } from './InstrumentModel.js';

// Blender MCP authored reconstruction. Keep the existing live faces, pointer,
// liquid column and telescope pickup separate from these static crafted parts.
const FINISH = {
 mahogany: [ 'wood', lin( 0x633a21 ), WOOD( .39, .12 ) ],
 brass: [ 'hard', lin( 0xb99a57 ), HARD( .31, 0, .88, .27 ) ],
 darkBrass: [ 'hard', lin( 0x806335 ), HARD( .47, .015, .85, .36 ) ],
 iron: [ 'hard', lin( 0x242827 ), HARD( .53, .02, .65, .44 ) ],
 leather: [ 'hard', lin( 0x382b21 ), HARD( .66, 0, 0, .79 ) ],
 ivory: [ 'stationTimber', lin( 0xe2dfd0 ), WOOD( .24, .13, .94 ) ],
 glass: [ 'hard', lin( 0x24465b ), HARD( .2, 0, .3, .13 ) ],
 silver: [ 'hard', lin( 0xaaaead ), HARD( .6, 0, .8, .24 ) ],
 ink: [ 'hard', lin( 0x232620 ), HARD( .2, 0, 0, .66 ) ],
};
const geometry = new Map();

export function instrumentBuilder( name, B = new Builder() ) {
 for ( const [ finish, g ] of Object.entries( INSTRUMENT_MODEL[ name ] ) ) {
  const key = name + '/' + finish;
  if ( ! geometry.has( key ) ) geometry.set( key, new Part( g.p, g.n, g.uv, g.idx ) );
  const [ material, tint, data ] = FINISH[ finish ];
  B.part( material, geometry.get( key ), 0, 0, 0, { tint, data } );
 }
 return B;
}

export function stationInstrument( B, name, at, ry = 0 ) {
 B.pushAt( at.x, at.y, at.z, ry );
 instrumentBuilder( name, B );
 B.pop();
}
