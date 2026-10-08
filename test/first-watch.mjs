import assert from 'node:assert/strict';
import { Vector3 } from '../src/engine/index.js';
import { ROOM, TOWER } from '../src/world/flannan/Station.js';
import { KITCHEN, BERTH } from '../src/world/flannan/NextRooms.js';
import { stationAcoustics } from '../src/world/flannan/StationAcoustics.js';
import { RoomArrival } from '../src/story/RoomArrival.js';

const eye = new Vector3( .8, TOWER.floor + 1.62, ROOM.door.z );
const shut = stationAcoustics( eye, 0 ), open = stationAcoustics( eye, 1 );
assert.ok( shut.indoor > .99 && open.indoor < .7, 'the real house door admits outside sound when open' );
eye.x = -6;
assert.ok( stationAcoustics( eye, 1 ).indoor > .96, 'the desk remains sheltered with the distant door open' );
eye.x = ROOM.door.x + .1;
assert.equal( stationAcoustics( eye, 0 ).indoor, 0, 'the yard is exposed' );
eye.x = ROOM.door.x - .02;
assert.ok( stationAcoustics( eye, 0 ).indoor < .01, 'the doorway eases into shelter instead of switching abruptly' );
for ( const room of [ KITCHEN, BERTH ] ) {
	eye.set( ( room.x0 + room.x1 ) / 2, TOWER.floor + 1.62, ( room.z0 + room.z1 ) / 2 );
	assert.equal( stationAcoustics( eye ).indoor, 1, 'later rooms retain sheltered sound' );
}
eye.set( 1, TOWER.deck + 1.62, 0 );
assert.ok( stationAcoustics( eye ).inLantern && stationAcoustics( eye ).indoor === 0 );
eye.x = 3;
assert.ok( stationAcoustics( eye ).onWalkway && stationAcoustics( eye ).indoor === 0 );

const story = { flags: { roomArrival: { elapsed: 0, done: false } }, beat: 'letter', app: { player: { position: new Vector3( -.4, TOWER.floor, 4.3 ) } }, saves: 0, save() { this.saves++; } };
const arrival = new RoomArrival( story );
for ( let i = 0; i < 20; i++ ) assert.equal( arrival.update( 1, { blocked: true } ), null );
assert.equal( story.flags.roomArrival.elapsed, 0, 'reading, pause and hidden tabs do not consume the passage' );
assert.equal( arrival.update( 1 ), null );
assert.ok( arrival.update( 1 ).text.includes( 'Three chairs' ) );
const restored = structuredClone( story.flags ); story.flags = restored;
assert.ok( arrival.update( 1 ), 'the saved passage can resume' );
for ( let i = 0; i < 20; i++ ) arrival.update( 1 );
assert.ok( story.flags.roomArrival.done && story.saves === 1 );
assert.equal( arrival.update( 1 ), null, 'the arrival thought does not repeat' );
story.flags = {}; assert.equal( arrival.update( 1 ), null, 'legacy saves receive no unsolicited arrival passage' );
console.log( 'PASS door-dependent shelter, smooth threshold, later rooms, exposed balcony, arrival pause/resume and one-time passage.' );
