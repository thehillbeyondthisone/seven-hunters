import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { installBrowser } from '../tools/shots/browser.mjs';
Object.defineProperty( globalThis, 'navigator', { value: {}, writable: true, configurable: true } );
installBrowser( { search: '?unpackingPreview', root: resolve( 'public' ) } );
const E = await import( '../src/engine/index.js' );
const { loadFlannanData } = await import( '../src/world/flannan/FlannanData.js' );
const { FlannanTerrainData } = await import( '../src/world/flannan/FlannanTerrain.js' );
const { buildStation, TOWER, ROOM } = await import( '../src/world/flannan/Station.js' );
const { Builder } = await import( '../src/world/village/GeoBuilder.js' );
const { InstancedProps, Rand } = await import( '../src/world/Props.js' );
const { Colliders } = await import( '../src/world/Colliders.js' );
const { mulberry32 } = await import( '../src/util/Noise.js' );
const { Player } = await import( '../src/player/Player.js' );
const { Lamp } = await import( '../src/station/Lamp.js' );
const { HandLamp } = await import( '../src/station/HandLamp.js' );
const { Story } = await import( '../src/story/Story.js' );
const { storyGuidance } = await import( '../src/story/Guidance.js' );
const { mobileAction } = await import( '../src/mobile/MobileOptions.js' );
const F = await loadFlannanData(), terrainData = new FlannanTerrainData( F.grids.island );
const B = new Builder(), colliders = new Colliders(), village = { buildings: [], footprints: [] };
const st = buildStation( { B, terrain: terrainData, colliders, rand: new Rand( mulberry32( 90210 ) ), lights: [], inst: new InstancedProps( B ), checks: [] }, village );
st.moving = { doors: st.parts.doors, telescope: { visible: true }, unpacking: {} };
for ( const name of Object.keys( st.parts.unpacking.builders ) ) st.moving.unpacking[ name ] = new E.Group();
village.station = st;
const keys = new Set(), input = { enabled: true, keys, rightDown: false, down: c => keys.has( c ), hit: () => false,
	consumeLook: () => ( { x: 0, y: 0 } ), consumeWheel: () => 0, requestLock() {} };
const camera = new E.PerspectiveCamera( 70, 16 / 9, .1, 150000 );
const query = { cpuValid: false, cpu: new Float32Array( 128 ), allocate: () => 0, setPoint() {} };
const player = new Player( { camera, input, terrain: terrainData, colliders, query, boat: null } );
const app = { qs: new URLSearchParams( 'unpackingPreview' ), village, terrainData, colliders, camera, player, input, query,
	lamp: new Lamp( { origin: new E.Vector3( 0, st.focal, 0 ) } ), handLamp: new HandLamp(),
	settings: { timeOfDay: 12, timeSpeed: 0 }, setting: { dayOffset: 0 }, haze: { density: { value: 1 } }, clouds: { coverage: { value: .4 } },
	ui: { ui: { toast() {} } }, flannan: F,
};
localStorage.setItem( 'sevenhunters.night1.v1', 'protected normal watch' );
const s = app.story = new Story( app ), u = s.unpacking;
s.ui.card = async () => {}; s.ui.fade = async () => {}; const papers = []; s.ui.read = async note => papers.push( note );
await s.start();
const frame = () => { player.update( 1 / 60 ); s.update( 1 / 60 ); };
const aim = at => {
	player.yaw = Math.atan2( player.position.x - at.x, player.position.z - at.z );
	player.pitch = Math.atan2( at.y - player.position.y - 1.62, Math.hypot( at.x - player.position.x, at.z - player.position.z ) );
	player._camY = null; frame();
};
assert.equal( s.saveKey, 'sevenhunters.unpacking-preview.v1' );
assert.ok( s.lamp.lit && s.lamp.running && s.keeper.state.rewound && s.beat === 'watch' );
assert.ok( u.pending && s.goal().includes( 'unpack' ) );
assert.equal( s._watchText(), '', 'the initial watch skip leaves time for the scene' );
const item = id => s.interact.get( id );
const visible = name => st.moving.unpacking[ name ].visible;
assert.ok( visible( 'closed' ) && ! visible( 'brownieOnDesk' ) );
const originalPose = camera.quaternion.clone();
await item( 'bag' ).use();
assert.equal( u.stage, 1 );
assert.ok( camera.quaternion.equals( originalPose ), 'unpacking leaves the view in the player’s hands' );
assert.ok( visible( 'open' ) && visible( 'packedClothes' ) && visible( 'parcel' ) && ! visible( 'closed' ) );
const stage1 = s.loadSave(), h = s.h, wind = s.lamp.wind;
for ( let i = 0; i < 120; i++ ) frame();
assert.equal( s.h, h, 'unpacking in the room holds story time' );
assert.equal( s.lamp.wind, wind, 'holding story time also holds the weight’s game-time descent' );
for ( const block of [ 'modal', 'pause', 'photo', 'hidden', 'free', 'mobile' ] ) {
	const remaining = u.state.lineRemaining;
	if ( block === 'modal' ) s.ui.modal = 1;
	if ( block === 'pause' ) s.paused = true;
	if ( block === 'photo' ) app.ui.ui.photoMode = true;
	if ( block === 'hidden' ) document.hidden = true;
	if ( block === 'free' ) app.freeCam = true;
	if ( block === 'mobile' ) app.mobile = { paused: true };
	await item( 'bag' ).use(); s.update( .5 );
	assert.equal( u.stage, 1, `${ block } cannot advance the scene` );
	assert.equal( u.state.lineRemaining, remaining, `${ block } holds the thought` );
	s.ui.modal = 0; s.paused = false; app.ui.ui.photoMode = false; document.hidden = false; app.freeCam = false; app.mobile = null;
}
s.lamp.extinguish(); await item( 'bag' ).use();
assert.equal( u.stage, 1, 'light out defers unpacking' );
s.lamp.ignite(); s.lamp.wind = .03;
assert.equal( u.pending, false ); assert.ok( s.goal().includes( 'Wind' ) || s.goal().includes( 'weight' ), 'winding takes priority' );
s.lamp.wind = wind; s.lamp.running = true;
s.h = 18;
assert.equal( u.pending, false ); assert.ok( s.goal().includes( 'barometer' ), 'the due observation round takes priority and begins with the instrument' );
s.h = h; s.watcher.appear();
assert.equal( u.pending, false ); assert.equal( storyGuidance( s ).id, 'towerDoor', 'the first signal routes toward the telescope' );
s.watcher.state = 'away';
player.position.set( 3.2, TOWER.floor, 4.5 );
assert.equal( u.holdsClock, false, 'leaving the room releases the clock' );
assert.equal( storyGuidance( s ).id, 'houseDoor' );
s._restore( stage1 );
assert.ok( visible( 'open' ) && ! visible( 'brownieOnDesk' ) );
for ( let stage = 1; stage <= 3; stage++ ) {
	const id = stage === 3 ? 'brownieParcel' : 'bag', it = item( id );
	aim( typeof it.at === 'function' ? it.at() : it.at );
	assert.equal( s.interact.current?.id, id, 'standing pose selects the current object' );
	app.isMobile = true;
	assert.equal( mobileAction( app ).target, id, 'touch names the same action' );
	app.isMobile = false;
	input.hit = code => code === 'KeyE'; s.interact.update( 1 / 60 ); input.hit = () => false;
	assert.equal( u.stage, stage + 1, 'one press advances one object' );
	const saved = s.loadSave();
	s._restore( saved ); assert.equal( u.stage, stage + 1, 'a restored scene retains its current object' );
}
assert.ok( visible( 'laidClothes' ) && visible( 'brownieOnDesk' ) && ! visible( 'brownieInBag' ) && ! visible( 'parcel' ) );
assert.equal( storyGuidance( s ).id, 'brownie', 'the camera gets its own discoverable desk target' );
assert.ok( u.pending && u.holdsClock, 'there is time to walk over and read the camera note' );
// Walk to the desk using the actual controller and room furniture colliders.
for ( let i = 0; i < 900 && Math.hypot( player.position.x + 5.99, player.position.z - .25 ) > .2; i++ ) {
	player.yaw = Math.atan2( player.position.x + 5.99, player.position.z - .25 ); player.pitch = 0;
	keys.add( 'KeyW' ); frame();
}
keys.clear(); frame(); aim( st.parts.unpacking.desk );
assert.equal( s.interact.current?.id, 'brownie', 'the Brownie is reachable after a real walk across the room' );
await item( 'brownie' ).use();
assert.ok( u.state.examined && ! u.pending && ! u.holdsClock );
assert.ok( papers.at( -1 ).body.some( line => line.includes( 'Six square pictures' ) ) );
const finished = s.loadSave(); s._restore( finished );
assert.ok( visible( 'brownieOnDesk' ) && u.state.examined && ! u.pending, 'the gift remains after save/load without replay' );
const legacy = structuredClone( finished ); delete legacy.flags.unpacking;
s._restore( legacy );
assert.ok( ! u.pending && visible( 'closed' ), 'established legacy watches receive no forced scene' );
const arrival = structuredClone( legacy ); arrival.beat = 'letter'; arrival.flags.litAt = 0; arrival.lamp.lit = false;
s._restore( arrival ); assert.equal( u.stage, 0 ); assert.ok( u.state, 'saved arrivals can discover the gift after lighting' );
assert.equal( localStorage.getItem( 'sevenhunters.night1.v1' ), 'protected normal watch' );
console.log( 'PASS unpacking: real E targets and desk walk, touch labels, four physical actions, clock/weight hold, duty priorities, pause states, per-stage restore, legacy arrivals and isolated save.' );
