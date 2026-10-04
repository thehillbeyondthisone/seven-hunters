import assert from 'node:assert/strict';
import { Vector3, PerspectiveCamera } from '../src/engine/index.js';
import { projectGuidance, routeGuidance } from '../src/story/Guidance.js';
import { TOWER, ROOM } from '../src/world/flannan/Station.js';

const camera = new PerspectiveCamera( 70, 16 / 9, 0.1, 5000 );
const at = ( x, y, z ) => new Vector3( x, y, z );
const center = projectGuidance( at( 0, 0, - 10 ), camera, 1280, 720 );
assert.ok( center.onScreen && center.x === 640 && center.y === 360 );
const behind = projectGuidance( at( 0, 0, 10 ), camera, 1280, 720 );
assert.ok( ! behind.onScreen && behind.y === 634, 'directly behind gives a bottom-edge turn cue' );
for ( const [ x, y, z ] of [ [ 100, 0, - 10 ], [ - 100, 0, - 10 ], [ 2, 3, 5 ], [ - 2, - 3, 5 ], [ 0, 100, - 1 ] ] ) {

	for ( const [ width, height ] of [ [ 1280, 720 ], [ 390, 844 ] ] ) {

		camera.aspect = width / height; camera.updateProjectionMatrix();
		const p = projectGuidance( at( x, y, z ), camera, width, height );
		assert.ok( ! p.onScreen && p.x >= 40 && p.x <= width - 40 && p.y >= 80 && p.y <= height - 80, 'edge cues stay inside landscape and portrait safe areas' );
		assert.equal( Math.sign( p.x - width / 2 ), Math.sign( x ), 'behind-camera targets preserve their actual left/right bearing' );

	}

}
camera.position.set( 12, 4, 6 ); camera.lookAt( 2, 4, 6 );
const turned = projectGuidance( at( 2, 4, 6 ), camera, 1280, 720 );
assert.ok( turned.onScreen && Math.abs( turned.x - 640 ) < 0.001, 'camera transforms are applied before projection' );
const desk = { at: at( - 6.5, TOWER.floor + 0.8, - 0.8 ), label: 'Journal', id: 'journal' };
assert.equal( routeGuidance( at( 0, TOWER.floor + 6, 1.5 ), desk, 'room' ).id, 'stair', 'journal upstairs routes down the spiral, not through the floor' );
assert.equal( routeGuidance( at( 3, TOWER.deck, 0 ), desk, 'room' ).id, 'galleryDoor', 'a downstairs objective starts at the balcony door' );
assert.equal( routeGuidance( at( - 6, TOWER.floor, 2 ), desk, 'room' ).id, 'journal', 'the journal is targeted directly inside its own room' );
assert.equal( routeGuidance( at( 5, TOWER.floor, 4 ), desk, 'room' ).id, 'houseDoor', 'an outside player first finds the room entrance' );
assert.equal( routeGuidance( at( 15, TOWER.floor + 4, 6 ), desk, 'room' ).id, 'houseDoor', 'high outdoor terrain must not be mistaken for the tower stair' );
const lens = { at: at( 0, TOWER.deck + 2.1, 0 ), label: 'Lamp', id: 'lens' };
assert.equal( routeGuidance( at( - 6, TOWER.floor, 2 ), lens, 'lantern' ).id, 'towerDoor', 'an upstairs objective starts at the tower doorway' );
assert.equal( routeGuidance( at( 0, TOWER.floor + 6, 1.5 ), lens, 'lantern' ).id, 'stair' );
assert.equal( routeGuidance( at( 1.7, TOWER.deck, - 0.5 ), lens, 'lantern' ).id, 'lens' );
console.log( 'Guidance: camera projection, behind-camera bearings, portrait safe areas and station threshold routing passed.' );
