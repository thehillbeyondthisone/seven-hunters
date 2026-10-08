import { ROOM, TOWER } from './Station.js';
import { KITCHEN, BERTH } from './NextRooms.js';

const clamp = v => Math.max( 0, Math.min( 1, v ) );
const smooth = v => { const t = clamp( v ); return t * t * ( 3 - 2 * t ); };

// Shelter follows the real threshold and swinging door. The house still sounds
// like an island: low surf remains audible, and an open door admits the gale.
export function stationAcoustics( p, houseOpen = 0, galleryOpen = 0 ) {
	const T = TOWER, r = Math.hypot( p.x, p.z );
	const inLantern = r < 2.2 && p.y > T.deck - .3 && p.y < T.deck + 4.5;
	const onWalkway = r >= 2.2 && r < 3.9 && Math.abs( p.y - T.deck - 1.6 ) < 1.5;
	let indoor = r < T.rIn && p.y > T.floor && p.y < T.deck - .1 ? 1 : 0;
	const inRoom = r > T.rIn - .12 && p.x > ROOM.x0 && p.x < ROOM.door.x && p.z > ROOM.z0 && p.z < ROOM.z1 && p.y > T.floor && p.y < ROOM.ceiling;
	if ( inRoom ) {
		const threshold = smooth( ( ROOM.door.x - p.x ) / .65 );
		const distance = Math.hypot( p.x - ROOM.door.x, p.z - ROOM.door.z );
		indoor = threshold * ( 1 - .62 * clamp( houseOpen ) * Math.exp( -distance / 2.2 ) );
	}
	if ( [ KITCHEN, BERTH ].some( room => p.x > room.x0 && p.x < room.x1 && p.z > room.z0 && p.z < room.z1 && p.y > T.floor && p.y < ROOM.ceiling ) ) indoor = 1;
	// Blend through the hatch at eye height. The enclosed lantern admits gusts
	// through its glazing; opening its gallery door admits more of the outside.
	const lantern = p.y < T.deck + 4.5 ? smooth( ( p.y - T.deck + .8 ) / 1.5 ) * ( 1 - smooth( ( r - 2.05 ) / .5 ) ) : 0;
	const shaft = r < T.rIn && p.y > T.floor && ! inRoom && p.y < T.deck + .7 ? 1 - lantern : 0;
	const walkway = onWalkway ? smooth( ( r - 2.2 ) / .35 ) : 0;
	const galleryDistance = Math.hypot( p.x - Math.cos( T.galleryDoor ) * 2.2, p.z - Math.sin( T.galleryDoor ) * 2.2 );
	const lanternShelter = .52 * ( 1 - .75 * clamp( galleryOpen ) * Math.exp( -galleryDistance / 1.5 ) );
	const shelter = inRoom || ! shaft && ! lantern ? indoor : Math.max( shaft, lantern * lanternShelter );
	const heightAboveRoom = Math.max( 0, p.y - T.floor - 1.62 );
	const clockAudibility = inRoom ? 1 : shaft * .42 * Math.exp( -heightAboveRoom / 3.2 );
	const depthBelowLantern = Math.max( 0, T.deck + 1.62 - p.y );
	const machineAudibility = lantern + walkway * .58 + shaft * .72 * Math.exp( -depthBelowLantern / 6 );
	return { indoor, inRoom, inLantern, onWalkway, shaft, lantern, walkway, shelter, clockAudibility, machineAudibility };
}
