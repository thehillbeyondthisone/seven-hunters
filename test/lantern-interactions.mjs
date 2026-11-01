import assert from 'node:assert/strict';
import { installBrowser } from '../tools/shots/browser.mjs';
import { Vector3, PerspectiveCamera } from '../src/engine/index.js';
import { Interact } from '../src/story/Interact.js';
import { StoryUI } from '../src/story/StoryUI.js';
import { lanternPickupGuidance } from '../src/story/Guidance.js';
import { WeatherObservations } from '../src/story/WeatherObservations.js';
import { STATION, ROOM } from '../src/world/flannan/Station.js';
import { G } from '../src/engine/render/Frame.js';

Object.defineProperty( globalThis, 'navigator', { value: {}, configurable: true } );
installBrowser( { search: '', width: 1280, height: 720, root: 'public' } );
const camera = new PerspectiveCamera( 70, 16 / 9, .1, 5000 );
const player = { position: new Vector3( -23, STATION.yard, -4.3 ), busy: false };
camera.position.copy( player.position ).add( new Vector3( 0, 1.62, 0 ) );
const input = { down: () => false, hit: () => false };
const s = { beat: 'machine', hand: { carried: false, rest: { position: player.position.clone().add( new Vector3( 0, 1, -2 ) ) } },
	h: 18, flags: {}, obs: {}, ui: new StoryUI(), moving: {}, _obsDue: () => 18, save() {}, toast() {},
	app: { camera, player, input, settings: {}, village: { meshes: [] }, terrainData: { heightAt: () => -60 } },
	station: { parts: { windVane: new Vector3( 0, 106, 0 ) } },
};
const ui = s.ui, pickup = lanternPickupGuidance( s );
assert.equal( pickup.id, 'handLamp', 'urgent machine duty does not suppress the lantern reminder' );
ui.setObjective( 'Wind the machine' );
ui.guidance( { id: 'crank', at: pickup.at, label: 'Crank' }, camera );
ui.guidance( pickup, camera, false, ui.pickupGuide );
const mainKey = ui._guideKey, first = ui.pickupGuide._guidePingUntil;
assert.ok( first > performance.now() );
ui.pickupGuide._guidePingUntil = performance.now() - 1;
ui.guidance( pickup, camera, false, ui.pickupGuide );
assert.equal( ui.pickupGuide.guideEl.classList.contains( 'is-pinging' ), false );
assert.equal( ui.pickupGuide.guideEl.classList.contains( 'has-label' ), true );
ui.pickupGuide._guideNextPing = performance.now() - 1;
ui.guidance( pickup, camera, false, ui.pickupGuide );
assert.ok( ui.pickupGuide._guidePingUntil > first, 'the reminder pulses again after its interval' );
assert.equal( ui._guideKey, mainKey, 'equipment pulses leave the duty marker independent' );
const next = ui.pickupGuide._guideNextPing;
ui.setObjective( 'Observe the wind' ); ui.guidance( pickup, camera, false, ui.pickupGuide );
assert.equal( ui.pickupGuide._guideNextPing, next, 'changing duties does not restart the equipment pulse' );
ui.input = { touchMode: true };
ui.guidance( pickup, camera, false, ui.pickupGuide );
assert.ok( ! ui.pickupGuide.guideLabel.textContent.includes( '· E' ), 'touch reminders use the mobile action wording' );
ui.input = null;
s.hand.carried = true;
ui.guidance( lanternPickupGuidance( s ), camera, false, ui.pickupGuide );
assert.equal( ui.pickupGuide.guideEl.classList.contains( 'is-visible' ), false, 'pickup removes the cue immediately' );
s.hand.carried = false; s.app.settings.guidance = false; assert.equal( lanternPickupGuidance( s ), null );
s.app.settings.guidance = true; s.beat = 'crossing'; assert.equal( lanternPickupGuidance( s ), null ); s.beat = 'machine';

s.interact = new Interact( { camera, player, input } );
s.interact.add( { id: 'barometer', at: new Vector3() } );
ROOM.thermometer = new Vector3( -5, STATION.yard + 1.6, -2.2 );
const weather = new WeatherObservations( s ); weather.install();
const vane = s.interact.get( 'weatherVane' ), at = vane.at;
const forward = at.clone().sub( camera.position ).normalize();
const side = new Vector3().crossVectors( forward, new Vector3( 0, 1, 0 ) ).normalize();
const aim = degrees => camera.lookAt( camera.position.clone().addScaledVector( forward, Math.cos( degrees * Math.PI / 180 ) ).addScaledVector( side, Math.sin( degrees * Math.PI / 180 ) ) );
G.windDir.value.set( 1, 0 ); G.windSpeed.value = 8;
for ( const offset of [ -23, -18, 0, 18, 23 ] ) {
	// A successful reading removes its prompt. Test each angle on a fresh
	// observation rather than reusing the completed first reading.
	if ( weather.draft ) delete weather.draft.readings.wind;
	aim( offset ); assert.equal( s.interact.pick(), vane, `vane prompt is available ${ offset } degrees off centre` );
	assert.equal( weather.wind(), true, 'the same aim accepted by the prompt records the wind' );
}
aim( 25 ); assert.notEqual( s.interact.pick(), vane ); assert.equal( weather.wind(), false );
aim( 0 ); weather.clearForPrompt = () => false; weather.clear = () => false;
assert.notEqual( s.interact.pick(), vane, 'an obstructed vane has no misleading prompt' ); assert.equal( weather.wind(), false );
weather.clearForPrompt = () => true; weather.clear = () => true;
player.position.set( -6, STATION.yard, 2 ); assert.notEqual( s.interact.pick(), vane, 'indoor views cannot record yard observations' );
player.position.set( -23, STATION.yard, -4.3 ); s.paused = true; assert.notEqual( s.interact.pick(), vane );
console.log( 'PASS repeating independent pickup cue, immediate pickup removal, guidance settings, and matching broad vane prompt/capture with blocked/indoor/pause rejection.' );
