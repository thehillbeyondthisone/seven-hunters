import assert from 'node:assert/strict';
import { installBrowser } from '../tools/shots/browser.mjs';
import { Group, PerspectiveCamera, Vector3 } from '../src/engine/index.js';
import { KeeperPlayground } from '../src/dev/KeeperPlayground.js';
import { Colliders } from '../src/world/Colliders.js';
import { LocalLights } from '../src/materials/LocalLights.js';
import { Lamp } from '../src/station/Lamp.js';
import { Beams } from '../src/station/Beams.js';
import { G } from '../src/core/Globals.js';
import { stepPlaygroundProp } from '../src/dev/PlaygroundPhysics.js';

Object.defineProperty( globalThis, 'navigator', { value: {}, configurable: true } );
installBrowser( { search: '?playground', width: 960, height: 540, root: 'public' } ); window.__ui = null;
const heldKeys = new Set(), pressed = new Set(); let wheel = 0;
const app = { qs: new URLSearchParams( 'playground' ), scene: new Group(), camera: new PerspectiveCamera( 65, 16 / 9, .1, 1000 ),
	terrainData: { heightAt: () => 0 }, colliders: new Colliders(), player: { velocity: new Vector3() }, localLights: new LocalLights(),
	settings: { timeOfDay: 12.4, timeSpeed: .05 }, haze: { density: { value: .7 } }, lamp: new Lamp(), ui: { ui: {} },
	input: { enabled: true, locked: true, mouseDown: false, rightDown: false, hit: key => pressed.has( key ), down: key => heldKeys.has( key ), consumeWheel: () => { const old = wheel; wheel = 0; return old; } } };
app.camera.position.set( 0, 1.7, 0 );
const play = app.playground = new KeeperPlayground( app );
assert.equal( play.model.claws.length, 3 ); assert.ok( play.model.triangles > 20000 && play.model.draws < 32 );
const count = play.root.children.length, lights = app.localLights.sources.length;
for ( let i = 0; i < 20; i ++ ) play.resetProps();
assert.equal( play.root.children.length, count ); assert.equal( app.localLights.sources.length, lights ); assert.equal( play.bodies.length, 9 );
const buoy = play.bodies[ 1 ]; app.camera.lookAt( buoy.mesh.position );
app.input.mouseDown = true; play.update( 1 / 60 ); app.input.mouseDown = false;
assert.equal( play.held, buoy, 'click acquires aimed buoy' );
for ( let i = 0; i < 120; i ++ ) play.update( 1 / 60 );
assert.ok( buoy.mesh.position.distanceTo( play.destination ) < .03, 'held buoy settles into stable suspension' );
assert.ok( play.tethers.every( m => m.visible ), 'live tether is visible' );
wheel = - 4; play.update( 1 / 60 ); assert.ok( play.reach < 4.5, 'wheel brings held body nearer' );
heldKeys.add( 'KeyR' ); const rotation = buoy.mesh.rotation.y; play.update( .05 ); heldKeys.clear(); assert.ok( buoy.mesh.rotation.y > rotation );
app.input.rightDown = true; for ( let i = 0; i < 60; i ++ ) play.update( 1 / 60 );
assert.equal( play.charge, 1 ); app.input.rightDown = false; play.update( 1 / 60 );
assert.equal( play.held, null ); assert.equal( play.thrown, 1 ); assert.ok( buoy.velocity.length() > 25, 'charged release throws the prop' );
// A wall blocks acquisition and high-speed travel, and holds cannot pull through it.
play.resetProps(); app.camera.lookAt( buoy.mesh.position );
app.colliders.addBox( new Vector3( 0, 1.5, - 2 ), new Vector3( 5, 2, .12 ) );
play.update( .016 ); assert.equal( play.aim, null, 'cannot acquire target through a wall' );
buoy.mesh.position.set( 0, 1.7, - 1 ); buoy.velocity.set( 0, 0, - 35 );
for ( let i = 0; i < 60; i ++ ) stepPlaygroundProp( buoy, 1 / 60, app );
assert.ok( buoy.mesh.position.z > - 2 + .12, 'thrown buoy does not tunnel through a thin wall' );
app.colliders.boxes = []; buoy.mesh.position.set( 0, 1.7, - 2.5 ); app.camera.lookAt( buoy.mesh.position ); play.update( .016 ); play.grab();
for ( const state of [ 'menu', 'photo', 'disabled', 'start', 'story' ] ) {
	play.held = buoy;
	if ( state === 'menu' ) app.devMenu = { open: true };
	if ( state === 'photo' ) app.ui.ui.photoMode = true;
	if ( state === 'disabled' ) app.input.enabled = false;
	if ( state === 'start' ) app.ui.ui._start = true;
	if ( state === 'story' ) app.story = {};
	play.update( .016 ); assert.equal( play.held, null, `${ state } safely releases prop` );
	app.devMenu = null; app.ui.ui.photoMode = false; app.ui.ui._start = false; app.input.enabled = true; app.story = null;
}
play.held = buoy; play.toggle(); assert.equal( play.held, null ); assert.equal( play.canUse(), false ); play.toggle();
// Buoyancy works in ordinary water, independently of extreme events.
app.terrainData.heightAt = () => - 20; buoy.mesh.position.set( 0, -.5, - 2 ); buoy.velocity.set( 0, 0, 0 );
for ( let i = 0; i < 600; i ++ ) stepPlaygroundProp( buoy, 1 / 60, app );
assert.ok( buoy.mesh.position.y > - .1 && buoy.mesh.position.y < .4, 'buoy floats without a tsunami' );
assert.ok( buoy.velocity.length() < .02 ); app.terrainData.heightAt = () => 0;
// Disco restores the exact previous clock, haze, lamp, beam spread and palette.
const initial = { time: app.settings.timeOfDay, speed: app.settings.timeSpeed, haze: app.haze.density.value, lamp: app.lamp.save(), spread: Beams.uniforms.spread.value };
for ( let i = 0; i < 10; i ++ ) {
	play.disco.setEnabled( true ); play.disco.configure( { palette: 'aurora', tempo: 500, intensity: - 4, mist: 'nope' } );
	assert.equal( play.disco.tempo, 160 ); assert.equal( play.disco.intensity, 0 ); assert.equal( play.disco.mist, .45 );
	play.disco.configure( { intensity: .75 } ); play.disco.update( .1 );
	assert.ok( Beams.uniforms.colors.value.every( v => v.w === 1 ) );
	const phase = play.disco.phase; play.disco.configure( { frozen: true } ); play.disco.update( .1 ); assert.equal( play.disco.phase, phase );
	play.disco.configure( { frozen: false } ); play.disco.setEnabled( false );
	assert.equal( app.settings.timeOfDay, initial.time ); assert.equal( app.settings.timeSpeed, initial.speed ); assert.equal( app.haze.density.value, initial.haze );
	assert.equal( Beams.uniforms.spread.value, initial.spread ); assert.deepEqual( app.lamp.save(), initial.lamp );
	assert.ok( Beams.uniforms.colors.value.every( v => v.w === 0 ) ); assert.equal( play.disco.root.visible, false );
}
assert.equal( app.localLights.sources.length, lights );
// Optional always-on lamps work in daylight; disabling lights still wins.
G.night.value = 0; play.coreLight.enabled = true; app.localLights.update( app.camera, .016 ); assert.ok( app.localLights.active > 0 );
app.localLights.enabled = false; app.localLights.update( app.camera, .016 ); assert.equal( app.localLights.active, 0 );
console.log( 'PASS playground: aimed grabbing, wall blocking, stable suspension, rotation/distance, charged throw, UI gates, ordinary buoyancy, bounded props/lights, disco freeze and complete restoration.' );
