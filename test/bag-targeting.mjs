import assert from 'node:assert/strict';
import { fixture, E, TOWER } from './helpers/morning-fixture.mjs';
import { Interact } from '../src/story/Interact.js';

const { app, s, player: p, camera, place, face, taps } = await fixture( false, { search: 'unpackingPreview', morningStudy: false } );
const bag = s.interact.get( 'bag' ), u = s.unpacking;
assert( bag.halfSize && u.pending && u.stage === 0 );
const center = bag.at;
const aimPoints = [
  new E.Vector3( 0, .2, 0 ),
  new E.Vector3( -.46, .18, -.2 ), new E.Vector3( .46, .18, -.2 ),
  new E.Vector3( -.46, .18, .2 ), new E.Vector3( .46, .18, .2 ),
];
let views = 0;
for ( const [ x, z ] of [ [ -1.55, 4.05 ], [ -.8, 3.85 ], [ .05, 4.05 ], [ -.8, 4.45 ] ] ) {
  place( x, TOWER.floor, z );
  for ( const offset of aimPoints ) {
    face( center.clone().add( offset ) ); s.interact.update( 0 );
    assert.equal( s.interact.current?.id, 'bag', `the bag surface remains usable from (${ x }, ${ z }) at ${ offset.toArray() }` );
    assert.equal( p.prompt.text, 'Unbuckle your bag' );
    assert.equal( p.prompt.key, 'E' );
    assert.equal( u.guidance().label, 'Unbuckle your bag', 'selected guidance describes the same actual action as the E prompt' );
    views++;
  }
}
// Exercise the actual input path from an oblique top/end view, not a direct
// callback: this reproduces the screenshot's long bag seen at a steep angle.
place( -1.55, TOWER.floor, 4.05 ); face( center.clone().add( aimPoints[ 2 ] ) );
taps.add( 'KeyE' ); s.interact.update( 1 / 60 );
assert.equal( u.stage, 1, 'one E opens the bag from the oblique surface view' );
assert.equal( s.loadSave().flags.unpacking.stage, 1, 'the successful input persists unpacking progress' );

place( -3.4, TOWER.floor, 3.2 ); face( center ); s.interact.current = null;
assert.equal( u.guidance().label, 'Move closer to your bag', 'out-of-reach guidance explains the missing action' );
assert( ! u.guidance().label.includes( 'E' ), 'an objective marker never promises E before the object is usable' );
place( -.8, TOWER.floor, 3.85 ); face( center.clone().add( new E.Vector3( 2, 1.3, -2 ) ) ); s.interact.update( 0 );
assert.equal( u.guidance().label, 'Look at your bag', 'nearby guidance explains when the bag is not aimed at' );

// Isolate the halfSize intersection beyond the ordinary spherical aim radius.
// Check both angled rays and a parallel ray so the API handles axis boundaries.
const probeCamera = new E.PerspectiveCamera( 70, 1, .1, 100 );
const probe = new Interact( { camera: probeCamera, input: app.input, player: p } );
const item = probe.add( { id: 'longProp', at: new E.Vector3( 0, 0, -2 ), size: .05, reach: 3, halfSize: new E.Vector3( .8, .2, .2 ) } );
probeCamera.position.set( 0, 0, 0 ); probeCamera.lookAt( .78, .18, -2 );
assert.equal( probe.pick(), item, 'a box surface is selectable outside its small spherical center' );
probeCamera.position.set( .79, .19, 0 ); probeCamera.lookAt( .79, .19, -2 );
assert.equal( probe.pick(), item, 'parallel view rays select inside the box edges' );
probeCamera.position.set( .9, .3, 0 ); probeCamera.lookAt( .9, .3, -2 );
assert.equal( probe.pick(), null, 'box targeting does not extend beyond the visible surface' );
probeCamera.position.set( 0, 0, -3 ); probeCamera.lookAt( 0, 0, -4 );
assert.equal( probe.pick(), null, 'a prop behind the camera is never selectable' );
probeCamera.position.set( 0, 0, 2 ); probeCamera.lookAt( 0, 0, -2 );
assert.equal( probe.pick(), null, 'box targeting respects interaction reach' );
console.log( `PASS bag targeting: ${ views } real oblique/top/edge views, actual E unpacking and saved progress, useful range/aim guidance and bounded halfSize intersections.` );
