import { ROOM, TOWER } from './Station.js';
import { KITCHEN, BERTH } from './NextRooms.js';

// Soft spill masks at existing partitions. No extra GPU textures or shadow
// lights: the visible sources and the sun's shadow maps retain their roles.
export function stationLightBounds( p ) {

	const T = TOWER, r = Math.hypot( p.x, p.z );
	if ( r < 3.9 && p.y >= T.deck - .4 && p.y < T.deck + 4.6 ) {
		return { min: [ -3.85, T.deck - .8, -3.85 ], max: [ 3.85, T.deck + 4.6, 3.85 ], softness: .25 };
	}
	if ( r < T.rIn && p.y > T.floor && p.y < T.deck ) {
		return { min: [ -T.rIn, T.floor - .15, -T.rIn ], max: [ T.rIn, T.deck + .2, T.rIn ], softness: .3 };
	}
	for ( const R of [ ROOM, KITCHEN, BERTH ] ) {
		if ( p.x > R.x0 && p.x < R.x1 + .35 && p.z > R.z0 && p.z < R.z1 && p.y > T.floor && p.y < ROOM.ceiling ) {
			return { min: [ R.x0 - .05, T.floor - .15, R.z0 - .05 ], max: [ R.x1 + .35, ROOM.ceiling + .05, R.z1 + .05 ], softness: .3 };
		}
	}
	return null;

}
