import { ROOM, TOWER } from '../world/flannan/Station.js';

// One quiet thought after entering. It never takes the camera, stops the walker,
// or starts a new mystery. The state lives with the watch, including its preview.
export class RoomArrival {
	constructor( story ) { this.s = story; }
	update( dt, { blocked = false } = {} ) {
		const s = this.s, state = s.flags.roomArrival;
		if ( ! state || state.done || blocked || ! [ 'room', 'letter' ].includes( s.beat ) ) return null;
		const p = s.app.player.position;
		if ( p.x <= ROOM.x0 || p.x >= ROOM.x1 - .35 || p.z <= ROOM.z0 || p.z >= ROOM.z1 || Math.abs( p.y - TOWER.floor ) > .4 ) return null;
		if ( ! state.entered ) { state.entered = true; s.intro?.enterRoom(); }
		state.elapsed += Math.max( 0, Math.min( dt, 1 ) );
		if ( state.elapsed < 2 ) return null;
		if ( state.elapsed >= 16 ) { state.done = true; s.save(); return null; }
		return { from: 'The keepers’ room', text: 'Three chairs around the table. Only your bag has come ashore.', lesson: true };
	}
}
