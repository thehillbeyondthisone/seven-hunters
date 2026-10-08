import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { installBrowser } from '../tools/shots/browser.mjs';
Object.defineProperty( globalThis, 'navigator', { value: {}, writable: true, configurable: true } );
installBrowser( { search: '?keeperPreview', root: resolve( 'public' ) } );
const E = await import( '../src/engine/index.js' );
const { loadFlannanData } = await import( '../src/world/flannan/FlannanData.js' );
const { FlannanTerrainData } = await import( '../src/world/flannan/FlannanTerrain.js' );
const { buildStation, TOWER } = await import( '../src/world/flannan/Station.js' );
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
const st = buildStation( { B, terrain: terrainData, colliders, keeperStudy: true, rand: new Rand( mulberry32( 90210 ) ), lights: [], inst: new InstancedProps( B ), checks: [] }, village );
st.moving = { doors: st.parts.doors, telescope: { visible: true } };
village.station = st;
const keys = new Set(), input = { enabled: true, keys, rightDown: false, down: c => keys.has( c ), hit: () => false,
	consumeLook: () => ( { x: 0, y: 0 } ), consumeWheel: () => 0, requestLock() {} };
const camera = new E.PerspectiveCamera( 70, 16 / 9, .1, 150000 );
const query = { cpuValid: false, cpu: new Float32Array( 128 ), allocate: () => 0, setPoint() {} };
const player = new Player( { camera, input, terrain: terrainData, colliders, query, boat: null } );
const app = { qs: new URLSearchParams( 'keeperPreview' ), village, terrainData, colliders, camera, player, input, query,
	lamp: new Lamp( { origin: new E.Vector3( 0, st.focal, 0 ) } ), handLamp: new HandLamp(),
	settings: { timeOfDay: 12, timeSpeed: 0 }, setting: { dayOffset: 0 }, haze: { density: { value: 1 } }, clouds: { coverage: { value: .4 } },
	ui: { ui: { toast() {} } }, flannan: F,
};
localStorage.setItem( 'sevenhunters.night1.v1', 'protected normal watch' );
const s = app.story = new Story( app );
s.ui.card = async () => {}; s.ui.fade = async () => {};
await s.start();
assert.equal( s.saveKey, 'sevenhunters.keeper-duty-preview.v1' );
assert.equal( s.beat, 'light' );
assert.equal( s.aboard, false );
assert.ok( s.goal().includes( 'Examine' ) );
assert.equal( s.interact.get( 'lens' ).hold, 0 );
const drive = s.keeper.drive;
assert.ok( st.parts.weightWay.top + .38 < TOWER.landing - .1, 'fully raised weight stays below the opaque upper landing' );
assert.equal( drive.at.y, st.parts.weightWay.bottom );

async function use( id ) {
	const it = s.interact.get( id ), at = typeof it.at === 'function' ? it.at() : it.at;
	camera.lookAt( at ); camera.updateMatrixWorld();
	assert.equal( s.interact.pick()?.id, id, `real lantern pose can select ${ id }` );
	await it.use();
}
await use( 'lens' );
assert.ok( s.flags.keeperDuty.inspected );
assert.equal( s.lamp.lit, false, 'inspection does not secretly ignite the lamp' );
assert.ok( s.keeper.note.text.includes( 'full' ) && s.keeper.note.text.includes( 'trimmed' ), 'sound apparatus does not require invented repairs' );
assert.equal( storyGuidance( s ).label, 'Winding crank' );

const crank = s.interact.get( 'crank' ); camera.lookAt( crank.at ); camera.updateMatrixWorld();
assert.equal( s.interact.pick()?.id, 'crank' );
keys.add( 'KeyE' ); s.interact.update( .3 ); keys.delete( 'KeyE' );
assert.equal( player.prompt.hideProgress, true );
assert.equal( mobileAction( app ).hold, true, 'touch winding is still a continuous physical hold' );
assert.equal( mobileAction( app ).progress, 0, 'touch winding has no fill meter' );
for ( let i = 0; i < 600; i ++ ) s._wind( 1 / 60 );
assert.equal( s.lamp.wind, 1 );
assert.equal( s.lamp.running, false, 'winding stores work; it does not release the stop' );
assert.equal( s.lamp.lit, false, 'winding cannot produce a flame' );
assert.equal( drive.at.y, st.parts.weightWay.top, 'winding raises the visible weight on the same state as the mechanism' );
const anchorY = drive.cable.position.y + drive.cable.scale.y / 2;
assert.ok( Math.abs( anchorY - st.parts.weightWay.anchor ) < 1e-6, 'winding takes up cable without moving its upper anchor' );

await use( 'lens' ); // Wait for sunset through the real story skip.
await use( 'lens' ); // Ignite the prepared lamp.
assert.ok( s.lamp.lit );
assert.equal( s.lamp.running, false, 'burner and clockwork remain independent' );
assert.equal( storyGuidance( s ).label, 'Clockwork stop' );
await use( 'machineStop' );
assert.ok( s.lamp.running );
await use( 'lens' );
assert.equal( s.flags.keeperDuty.verified, false, 'a newly started machine must actually settle before it is reported working' );
for ( let i = 0; i < 25 * 60; i ++ ) s.lamp.update( 1 / 60, 1 / 3600 );
await use( 'lens' );
assert.ok( s.flags.keeperDuty.verified && s.lamp.turning );
assert.equal( s.beat, 'watch' );
assert.ok( s.goal().includes( 'driving weight' ), 'the first-night weight lesson follows working-light inspection' );
assert.equal( storyGuidance( s ).label, 'Down to the driving weight', 'guidance uses the real hatch instead of pointing through the lantern floor' );

const lanternPosition = player.position.clone(), lanternCamera = camera.position.clone();
function lookAtWeight() {
	drive.sync( s.lamp.wind );
	// Stand on an actual upper tread, on the exposed side of the weightway.
	const candidates = Array.from( { length: TOWER.count }, ( _, i ) => ( { a: TOWER.start + ( i + .5 ) * TOWER.dTread, y: TOWER.floor + ( i + 1 ) * TOWER.riser } ) )
		.filter( t => Math.cos( t.a - TOWER.hatch.angle ) > .65 )
		.sort( ( a, b ) => Math.abs( a.y + 1.62 - drive.at.y ) - Math.abs( b.y + 1.62 - drive.at.y ) );
	const tread = candidates[ 0 ];
	player.position.set( Math.cos( tread.a ), tread.y, Math.sin( tread.a ) );
	player.yaw = Math.atan2( player.position.x, player.position.z );
	player.pitch = Math.atan2( drive.at.y - tread.y - 1.62, 1 );
	player.mode = 'walk'; player.grounded = true; player.velocity.set( 0, 0, 0 ); player._camY = null;
	for ( let i = 0; i < 30; i ++ ) player.update( 1 / 60 );
	camera.updateMatrixWorld();
	s.interact.update( 0 );
	assert.equal( s.interact.current?.id, 'drivingWeight', 'weight is reachable from the real tower stair' );
}
lookAtWeight(); await use( 'drivingWeight' );
assert.ok( s.flags.keeperDuty.weightLook );
const observedY = drive.at.y, observedWind = s.lamp.wind;
s.lamp.stop();
for ( let i = 0; i < 5 * 60; i ++ ) { s.lamp.update( 1 / 60, 1 / 3600 ); s.keeper.update( 1 / 60 ); }
assert.equal( s.lamp.wind, observedWind, 'brake holds the weight while the flame remains alight' );
assert.equal( drive.at.y, observedY );
assert.ok( ! s.flags.keeperDuty.descentSeen, 'elapsed time without a fall cannot complete the observation' );
s.lamp.start();
for ( let i = 0; i < 3 * 60; i ++ ) { s.lamp.update( 1 / 60, 1 / 3600 ); s.keeper.update( 1 / 60, { blocked: true } ); }
assert.ok( ! s.flags.keeperDuty.descentSeen, 'blocked or hidden observation cannot teach the lesson' );
lookAtWeight(); s.keeper.update( 0 );
assert.ok( s.flags.keeperDuty.descentSeen && drive.at.y < observedY );
assert.ok( s.goal().includes( 'Raise the weight again' ) );
player.position.copy( lanternPosition ); camera.position.copy( lanternCamera );
camera.lookAt( crank.at ); camera.updateMatrixWorld();
assert.equal( s.interact.pick()?.id, 'crank' );
for ( let i = 0; i < 120; i ++ ) s._wind( 1 / 60 );
assert.ok( s.flags.keeperDuty.rewound, 'raising the weight after observing the fall completes the first-night winding lesson' );
assert.ok( s.lamp.running && s.lamp.lit, 'rewinding keeps the mechanism and flame working' );
assert.equal( drive.at.y, st.parts.weightWay.top );

await use( 'machineStop' );
assert.ok( s.lamp.lit && ! s.lamp.running, 'the stop affects the optic, not the flame' );
for ( let i = 0; i < 60 * 60; i ++ ) s.lamp.update( 1 / 60, 0 );
assert.equal( s.lamp.turning, false );
await use( 'lens' );
assert.ok( s.keeper.note.text.includes( 'flashing character' ) );
assert.equal( s.flags.keeperDuty.verified, false );
await use( 'machineStop' );
assert.ok( s.lamp.running );
s.save(); const saved = s.loadSave();
s._restore( saved );
assert.ok( s.flags.keeperDuty.inspected && s.lamp.running, 'preview save restores physical and learned state' );
s.keeper.update( 0 );
assert.ok( s.flags.keeperDuty.descentSeen && s.flags.keeperDuty.rewound, 'save resumes the learned first-night routine' );
assert.equal( drive.at.y, st.parts.weightWay.top, 'visible height is restored from winding state' );
const olderStudy = structuredClone( saved );
olderStudy.flags.keeperDuty.verified = true;
for ( const key of [ 'weightLook', 'descentSeen', 'descentWind', 'rewound' ] ) delete olderStudy.flags.keeperDuty[ key ];
s._restore( olderStudy ); s.keeper.update( 0 );
assert.ok( s.lamp.running && s.flags.keeperDuty.verified && s.goal().includes( 'driving weight' ), 'an existing first-lighting save continues into the new lesson without restarting' );
s._restore( saved );
assert.equal( localStorage.getItem( 'sevenhunters.night1.v1' ), 'protected normal watch' );

// Legacy/default lamp behavior stays compatible with the existing chapters.
const normal = new Lamp(); normal.addWind( .5 );
assert.equal( normal.running, true );
normal.stop(); normal.wind = 0; normal.start(); assert.equal( normal.running, false );
console.log( 'PASS apparatus targets, physical weight/cable, brake holds descent, real stair reach, movement-based observation, winding while running, lesson restore, preview save isolation and legacy winding.' );
