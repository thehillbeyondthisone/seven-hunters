import assert from 'node:assert/strict';
import { fixture, E } from './helpers/morning-fixture.mjs';
import { Input } from '../src/core/Input.js';
import { LocalLights } from '../src/materials/LocalLights.js';
import { RevealGulls } from '../src/story/RevealGulls.js';
import { REVIEW_SCENES } from '../src/story/CutsceneReview.js';

localStorage.setItem( 'sevenhunters.night1.v1', 'protected normal watch' );
const { app, s, player: p, camera } = await fixture( false, { search: 'keeperPreview', morningStudy: false } );
const input = new Input( document.createElement( 'canvas' ) );
app.input = p.input = s.interact.input = s.ui.input = input;
input.requestLock = () => {};
app.localLights = new LocalLights();
app.islandGulls = new RevealGulls();
app.islandGulls.begin( [ 1, 2, 3 ], [ .8, .6 ], 9 );
// Mirror the normal safety controller's travel/review pause without requiring
// a sea simulation: Player.update must remain unavailable to scene placement.
p.safety = { get paused() { return s.cutsceneReview.active; } };
let cuts = 0, warnings = 0, stopped = 0;
app.cameraCut = () => cuts++;
s.lamp.onWarning = () => warnings++;
s.lamp.onStopped = () => stopped++;
Object.assign( s.lamp, { lit: false, glow: .42, wind: .43, running: false, speed: .37, angle: 2.345, warned: true } );
s.hand.carried = true; s.hand.lit = false; s.hand.glow = .31;
p.velocity.set( .2, -.1, .3 );
p.bob = .27; p.camOff = .008; p.camOffV = .003; p.groundCamOff = .014; p.groundCamOffV = -.01; p.lookScale = .7;
camera.position.add( new E.Vector3( .013, .014, -.027 ) );
camera.fov = 76; camera.updateProjectionMatrix();
app.settings.timeSpeed = .123; app.setting.dayOffset = 7;
s.rows.push( { h: s.h, text: 'Protected watch entry.' } );
s.save();
const savedSlot = localStorage.getItem( s.saveKey ), flags = s.flags;
const review = s.cutsceneReview;
const playerFields = [ 'yaw', 'pitch', 'mode', 'grounded', 'busy', 'bob', 'stepDist', 'camOff', 'camOffV', 'groundCamOff', 'groundCamOffV', '_camY', 'lookScale' ];
const snapshot = () => ( {
  player: Object.fromEntries( playerFields.map( key => [ key, p[ key ] ] ) ),
  position: p.position.toArray(), velocity: p.velocity.toArray(), camera: camera.position.toArray(), quaternion: camera.quaternion.toArray(), fov: camera.fov,
  hour: s.h, beat: s.beat, paused: s.paused, saveT: s.saveT, rows: structuredClone( s.rows ), flags: structuredClone( s.flags ), obs: structuredClone( s.obs ),
  lamp: s.lamp.save(), speed: s.lamp.speed, hand: s.hand.save(), handGlow: s.hand.glow,
  timeOfDay: app.settings.timeOfDay, timeSpeed: app.settings.timeSpeed, dayOffset: app.setting.dayOffset,
  voyage: { elapsed: s.arrival.elapsed, departure: s.arrival.departure, visible: s.arrival.group.visible },
  gulls: { elapsed: app.islandGulls.elapsed, origin: app.islandGulls.origin, dir: app.islandGulls.dir },
} );
const before = snapshot();
assert.equal( review.start( 'unknown' ), false, 'unknown review IDs have no side effects' );
assert.deepEqual( snapshot(), before );

for ( const mode of [ 'complete', 'escape', 'continue' ] ) for ( const { id } of REVIEW_SCENES ) {
  input.keys.add( 'KeyW' ); input.keys.add( 'KeyE' ); input.pressed.add( 'KeyE' ); input.setTouchKey( 'KeyE', true ); input.look.x = 40;
  assert.equal( review.start( id ), true, `${ id }: starts without reloading the map` );
  const scene = review.scene;
  assert( review.active && p.busy && ! input.enabled, 'review owns the player and input' );
  assert.equal( review.start( id ), false, 'another replay cannot overlap the current scene' );
  s.save();
  assert.equal( localStorage.getItem( s.saveKey ), savedSlot, 'explicit saves cannot write the borrowed replay pose' );
  s.update( 1 );
  const elapsed = scene.state?.elapsed ?? scene.elapsed, cueElapsed = scene.cueElapsed, eye = camera.position.clone();
  document.hidden = true; s.update( 1 ); document.hidden = false;
  assert.equal( scene.state?.elapsed ?? scene.elapsed, elapsed, 'hidden tabs hold the shot' );
  assert.equal( scene.cueElapsed, cueElapsed, 'hidden tabs hold the cue' );
  assert( camera.position.equals( eye ), 'hidden tabs hold the camera' );
  app.mobile = { paused: true }; s.update( 1 ); app.mobile = null;
  app.devMenu = { open: true }; s.update( 1 ); app.devMenu = null;
  assert.equal( scene.state?.elapsed ?? scene.elapsed, elapsed, 'touch pause and development menu hold the shot' );
  if ( mode === 'complete' ) {
    for ( let frame = 0; frame < 120 && review.active; frame++ ) s.update( 1 );
  } else if ( mode === 'escape' ) {
    let prevented = false;
    review.key( { code: 'Escape', repeat: false, preventDefault() { prevented = true; }, stopImmediatePropagation() {} } );
    assert( prevented, 'Escape belongs to the replay' );
  } else if ( id === 'reveal' ) scene.skip();
  else scene.finish();
  assert.equal( review.active, false, `${ id }: ${ mode } exits the replay` );
  assert.equal( s.ui.open, false, 'review closes its own modal' );
  assert.equal( review.scene, null );
  assert.equal( review.facade, null );
  assert.equal( review.update( 1 ), false );
  assert.deepEqual( snapshot(), before, `${ id }: ${ mode } restores the exact watch, player, camera, apparatus, boat and gulls` );
  assert.equal( s.flags, flags, 'the watch retains its original flags object' );
  assert.equal( warnings + stopped, 0, 'borrowed apparatus never calls watch warning callbacks' );
  assert.equal( input.enabled, true );
  assert.equal( input.keys.size + input.pressed.size + input.touchKeys.size + input.touchPressed.size, 0, 'review consumes held and pressed keyboard/touch actions' );
  assert.deepEqual( input.consumeLook(), { x: 0, y: 0 }, 'review consumes mouse motion' );
  assert.equal( s.interact.held, 0, 'a held action cannot leak into the resumed watch' );
  assert.equal( localStorage.getItem( s.saveKey ), savedSlot );
  assert.equal( localStorage.getItem( 'sevenhunters.night1.v1' ), 'protected normal watch' );
}
assert.equal( app.localLights.sources.length, 0, 'repeated weight reviews release their temporary fill light' );
assert( cuts >= 18, 'each replay resets camera history on entry and return' );

input.enabled = false;
assert.equal( review.start( 'weight' ), true, 'a review can borrow input released by a closed menu' );
review.finish();
assert.equal( input.enabled, false, 'review restores the caller’s disabled input state too' );
input.enabled = true;

for ( const block of [ 'reading', 'stairs', 'cinematic', 'photograph', 'signal', 'free', 'photo', 'xr', 'aboard', 'dead', 'busy', 'telescope', 'ruin', 'hidden' ] ) {
  if ( block === 'reading' ) s.ui.modal = 1;
  if ( block === 'stairs' ) s.towerTravel.active = true;
  if ( block === 'cinematic' ) s.keeper.firstLight.active = true;
  if ( block === 'photograph' ) s.photography.capturing = true;
  if ( block === 'signal' ) s.signal = true;
  if ( block === 'free' ) app.freeCam = true;
  if ( block === 'photo' ) app.ui.ui.photoMode = true;
  if ( block === 'xr' ) app.xr = { active: true };
  if ( block === 'aboard' ) s.beat = 'crossing';
  if ( block === 'dead' ) app.keeperSafety = { state: 'dead' };
  if ( block === 'busy' ) p.busy = true;
  if ( block === 'telescope' ) s.tel = 1;
  if ( block === 'ruin' ) s.ruinInspect = {};
  if ( block === 'hidden' ) document.hidden = true;
  assert.equal( review.start( 'light' ), false, `${ block } blocks replay without interrupting the current action` );
  s.ui.modal = 0; s.towerTravel.active = false; s.keeper.firstLight.active = false; s.photography.capturing = false; s.signal = false;
  app.freeCam = false; app.ui.ui.photoMode = false; app.xr = null; s.beat = before.beat; app.keeperSafety = null;
  p.busy = false; s.tel = 0; s.ruinInspect = null; document.hidden = false;
}
assert.deepEqual( snapshot(), before );
console.log( 'PASS live cutscene reviews: all three scenes complete, skip and replay; exact watch/camera/apparatus restoration; protected saves; hidden/menu pauses; consumed input; guards and temporary-light cleanup.' );
