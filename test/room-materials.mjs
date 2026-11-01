// Regression: a wrong vertex-data layout turned plaster into sideways masonry.
import assert from 'node:assert/strict';
import { Builder } from '../src/world/village/GeoBuilder.js';
import { Colliders } from '../src/world/Colliders.js';
import { keepsakesRooms } from '../src/world/flannan/KeepsakesRooms.js';

const B = new Builder(), ceiling = 84.2;
keepsakesRooms( { B, colliders: new Colliders(), lights: [] }, { doors: [] }, 81.05, ceiling, ( ctx, door ) => door );
const walls = B.batches.stationMasonry;
assert( walls.vcount > 0 );
for ( let i = 0; i < walls.vcount; i ++ ) {
	assert.equal( walls.data[ i * 4 + 1 ], 1, 'every bedroom partition uses the plaster finish' );
}
const timber = B.batches.stationTimber;
let ceilingVertices = 0;
for ( let i = 0; i < timber.vcount; i ++ ) {
	if ( timber.pos[ i * 3 + 1 ] < ceiling - .05 ) continue;
	ceilingVertices ++;
	assert.equal( timber.data[ i * 4 + 1 ], 1, 'ceiling uses painted timber data' );
}
assert( ceilingVertices > 0 );
console.log( 'PASS bedroom walls and ceiling use the correct material layouts.' );
