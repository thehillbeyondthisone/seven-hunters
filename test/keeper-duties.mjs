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
const { FIRST_LIGHT_SECONDS } = await import( '../src/story/FirstLightCutscene.js' );
const { HandLamp } = await import( '../src/station/HandLamp.js' );
const { LocalLights } = await import( '../src/materials/LocalLights.js' );
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
	localLights: new LocalLights(),
	settings: { timeOfDay: 12, timeSpeed: 0 }, setting: { dayOffset: 0 }, haze: { density: { value: 1 } }, clouds: { coverage: { value: .4 } },
	ui: { ui: { toast() {} } }, flannan: F,
};
localStorage.setItem( 'sevenhunters.night1.v1', 'protected normal watch' );
const s = app.story = new Story( app );
s.ui.card = async () => {}; s.ui.fade = async () => {};
await s.start();
// Keep this apparatus fixture focused on chores; demo-story covers unpacking.
s.flags.unpacking = { stage: 4, examined: true };
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
const chores = [ 'lens', 'crank', 'machineStop', 'chair', 'stool' ];
function only( ...ids ) {
	assert.deepEqual( chores.filter( id => s.interact.get( id ).when() ), ids, `only the current chore is available (${ ids.join( ', ' ) })` );
}
async function rejectOtherChores( ...allowed ) {
	const before = { hour: s.h, lamp: s.lamp.save(), flags: structuredClone( s.flags ), rows: structuredClone( s.rows ) };
	if ( ! allowed.includes( 'lens' ) ) await s.interact.get( 'lens' ).use();
	if ( ! allowed.includes( 'crank' ) ) s.interact.get( 'crank' ).onHold( 2 );
	if ( ! allowed.includes( 'machineStop' ) ) await s.interact.get( 'machineStop' ).use();
	if ( ! allowed.includes( 'stool' ) ) await s.interact.get( 'stool' ).use();
	assert.deepEqual( { hour: s.h, lamp: s.lamp.save(), flags: structuredClone( s.flags ), rows: structuredClone( s.rows ) }, before, 'out-of-order callbacks cannot change the apparatus, clock or saved progress' );
}
only( 'lens' );
await rejectOtherChores( 'lens' );
await use( 'lens' );
only( 'crank' );
await rejectOtherChores( 'crank' );
assert.ok( s.flags.keeperDuty.inspected );
assert.equal( s.lamp.lit, false, 'inspection does not secretly ignite the lamp' );
assert.ok( s.keeper.note.text.includes( 'full' ) && s.keeper.note.text.includes( 'trimmed' ), 'sound apparatus does not require invented repairs' );
s.save(); s._restore( s.loadSave() );
only( 'crank' );
assert.equal( storyGuidance( s ).label, 'Winding crank' );

const crank = s.interact.get( 'crank' ); camera.lookAt( crank.at ); camera.updateMatrixWorld();
assert.equal( s.interact.pick()?.id, 'crank' );
keys.add( 'KeyE' ); s.interact.update( .3 ); keys.delete( 'KeyE' );
assert.equal( player.prompt.hideProgress, false );
assert.equal( player.prompt.progress, s.lamp.wind, 'the winding gauge reads the weight’s height' );
assert.ok( player.prompt.eta > 0 && Math.abs( player.prompt.eta - ( 1 - s.lamp.wind ) * 10 ) < 1e-6, 'the prompt says how long is left at the study’s winding pace' );
assert.equal( mobileAction( app ).hold, true, 'touch winding is still a continuous physical hold' );
assert.equal( mobileAction( app ).progress, s.lamp.wind, 'touch winding shows the same gauge' );
for ( let i = 0; i < 600; i ++ ) s._wind( 1 / 60 );
assert.equal( s.lamp.wind, 1 );
assert.equal( s.lamp.running, false, 'winding stores work; it does not release the stop' );
assert.equal( s.lamp.lit, false, 'winding cannot produce a flame' );
only( 'lens' );
await rejectOtherChores( 'lens' );
assert.equal( drive.at.y, st.parts.weightWay.top, 'winding raises the visible weight on the same state as the mechanism' );
const anchorY = drive.cable.position.y + drive.cable.scale.y / 2;
assert.ok( Math.abs( anchorY - st.parts.weightWay.anchor ) < 1e-6, 'winding takes up cable without moving its upper anchor' );

await use( 'lens' ); // Wait for sunset through the real story skip.
const litPosition = player.position.clone(), litCamera = camera.position.clone(), litHour = s.h;
await use( 'lens' ); // Ignite the prepared lamp.
// The first lighting swings the camera round outside the lantern, then hands back.
assert.ok( s.keeper.firstLight.active && s.keeper.cinematic && s.flags.keeperDuty.firstLightSeen, 'first lighting starts the lantern view' );
assert.ok( s.ui.open && player.busy, 'the lantern view owns input' );
only();
for ( let i = 0; i < 3; i ++ ) s.update( 1 );
assert.ok( Math.hypot( camera.position.x, camera.position.z ) > TOWER.gallery.rail + 1 && camera.position.y > st.focal, 'the camera is outside, above the gallery' );
assert.ok( player.position.equals( litPosition ), 'the player stays at the lens' );
assert.ok( s.lamp.glow > .3 && ! s.lamp.running, 'the burner warms during the shot; the optic stays still' );
assert.ok( s.keeper.firstLight.caption.textContent.includes( 'burner makes the light' ), 'the first caption explains the flame during the view' );
s.paused = true; s.update( 1 ); s.paused = false;
assert.equal( s.keeper.firstLight.elapsed, 3, 'pause gives the player time to read without consuming the view' );
for ( let i = 0; i < 4; i ++ ) s.update( 1 );
assert.ok( s.keeper.firstLight.active && s.keeper.firstLight.caption.textContent.includes( 'clockwork turns the optic' ), 'the longer view explains rotation and the next physical control' );
for ( let i = 7; i < FIRST_LIGHT_SECONDS; i ++ ) s.update( 1 );
assert.ok( ! s.keeper.firstLight.active && ! s.ui.open && ! player.busy, 'the lantern view finishes on its own' );
assert.ok( camera.position.distanceTo( litCamera ) < 1e-6, 'the view returns to the keeper' );
assert.ok( Math.abs( s.h - litHour - FIRST_LIGHT_SECONDS / 60 ) < 1e-8, 'the shot uses the ordinary watch clock' );
assert.ok( s.keeper.note?.text.includes( 'brass stop' ), 'the burner note follows the shot' );
assert.ok( s.keeper.firstLight.cueElapsed >= FIRST_LIGHT_SECONDS, 'the music cue keeps its own clock past the shot' );
only( 'machineStop' );
await rejectOtherChores( 'machineStop' );
assert.ok( s.lamp.lit );
assert.equal( s.lamp.running, false, 'burner and clockwork remain independent' );
assert.equal( storyGuidance( s ).label, 'Clockwork stop' );
// Even a direct callback cannot release a partially wound machine.
s.lamp.wind = .5;
only( 'crank' );
await rejectOtherChores( 'crank' );
assert.ok( ! s.lamp.running && ! s.keeper.cutscene.active );
assert.ok( ! s.keeper.driveTaught );
for ( let i = 0; i < 600; i ++ ) s._wind( 1 / 60 );
only( 'machineStop' );
const lanternPosition = player.position.clone(), lanternCamera = camera.position.clone();
const cutsceneHour = s.h, cutsceneWind = s.lamp.wind;
s.hand.lit = false; s.hand.glow = 0;
await use( 'machineStop' );
assert.ok( s.lamp.running && s.keeper.cutscene.active, 'first release after a full winding starts the cutaway immediately' );
assert.ok( s.ui.open && player.busy && ! input.enabled, 'the cutaway owns input and blocks walking and papers' );
only();
await rejectOtherChores();
assert.equal( storyGuidance( s ), null );
assert.equal( s.interact.get( 'drivingWeight' ), undefined, 'the hatch examination is no longer an interaction or quest requirement' );
s.update( 1 ); s.update( 1 );
assert.equal( s.keeper.cutscene.elapsed, 2 );
assert.ok( camera.position.y < TOWER.landing && player.position.equals( lanternPosition ), 'only the camera visits the column; the player stays at the crank' );
const firstWeightY = drive.at.y;
const weightLight = s.keeper.cutscene.weightLight;
assert.ok( weightLight.enabled && weightLight.always && ! s.hand.lit, 'weight view has its own light even with the carried lantern out' );
assert.ok( weightLight.position.distanceTo( drive.at ) < weightLight.range, 'the descending weight stays inside the light range' );
app.localLights.update( camera, 1 / 60 );
assert.equal( app.localLights.active, 1, 'the weight fill reaches the renderer without the handheld light' );
const columnView = camera.position.clone();
const framedWeight = drive.at.clone().project( camera );
assert.ok( Math.abs( framedWeight.x ) < .8 && Math.abs( framedWeight.y ) < .8 && framedWeight.z < 1, 'the actual descending weight is framed in the column view' );
s.paused = true; s.update( 1 ); s.paused = false;
assert.equal( s.keeper.cutscene.elapsed, 2, 'pausing preserves the current cutscene frame' );
Object.defineProperty( document, 'hidden', { value: true, configurable: true } ); s.update( 1 );
Object.defineProperty( document, 'hidden', { value: false, configurable: true } );
assert.equal( s.keeper.cutscene.elapsed, 2, 'hidden tabs do not consume the cutscene' );
app.mobile = { paused: true }; s.update( 1 ); delete app.mobile;
app.devMenu = { open: true }; s.update( 1 ); delete app.devMenu;
assert.equal( s.keeper.cutscene.elapsed, 2, 'mobile pause and debug also hold the cutscene' );
s.save(); const duringCutscene = s.loadSave();
s._restore( duringCutscene );
assert.equal( s.keeper.cutscene.active, false );
s.update( 0 );
assert.ok( s.keeper.cutscene.active && s.keeper.cutscene.elapsed === 2, 'reload resumes an unfinished cutaway at its saved frame' );
assert.ok( camera.position.equals( columnView ), 'resume preserves the column camera composition' );
assert.equal( app.localLights.sources.length, 1, 'resuming the cutaway reuses its light' );
for ( let i = 0; i < 5; i ++ ) s.update( 1 );
assert.ok( drive.at.y < firstWeightY - .3 && camera.position.equals( columnView ), 'real iron weights descend against a fixed view of the column' );
const descendedFrame = drive.at.clone().project( camera );
assert.ok( Math.abs( descendedFrame.y ) < .9, 'the weight stays in frame throughout the column shot' );
// Test the actual built tower, including iron treads and the landing, for occlusion.
{
	const direction = drive.at.clone().sub( camera.position ).normalize(), distance = camera.position.distanceTo( drive.at );
	const edge1 = new E.Vector3(), edge2 = new E.Vector3(), cross = new E.Vector3(), delta = new E.Vector3(), q = new E.Vector3();
	for ( const batch of Object.values( B.batches ) ) for ( let i = 0; i < batch.idx.length; i += 3 ) {
		const vertex = k => new E.Vector3( ...batch.pos.slice( batch.idx[ i + k ] * 3, batch.idx[ i + k ] * 3 + 3 ) );
		const a = vertex( 0 ), b = vertex( 1 ), c = vertex( 2 );
		edge1.subVectors( b, a ); edge2.subVectors( c, a ); cross.crossVectors( direction, edge2 );
		const det = edge1.dot( cross ); if ( Math.abs( det ) < 1e-8 ) continue;
		delta.subVectors( camera.position, a ); const u = delta.dot( cross ) / det; if ( u < 0 || u > 1 ) continue;
		q.crossVectors( delta, edge1 ); const v = direction.dot( q ) / det; if ( v < 0 || u + v > 1 ) continue;
		const t = edge2.dot( q ) / det;
		assert.ok( t <= 0 || t >= distance - .15, 'tower geometry leaves the descending weight visible' );
	}
}
// Next, the same renderer shows the optic turning around the burner.
s.update( 1 ); s.update( 1 );
assert.equal( s.keeper.cutscene.shot, 'optic' );
assert.equal( weightLight.enabled, false, 'the shaft fill switches off when the view returns to the optic' );
assert.ok( camera.position.y > TOWER.deck && s.lamp.angle > 0 && s.lamp.lit );
for ( let i = 0; i < 3; i ++ ) s.update( 1 );
assert.ok( ! s.keeper.cutscene.active && s.keeper.driveTaught && s.flags.keeperDuty.driveCutsceneSeen );
assert.ok( ! s.ui.open && ! player.busy && input.enabled, 'completion returns normal control' );
assert.ok( player.position.equals( lanternPosition ) && camera.position.equals( lanternCamera ), 'the player returns to the same lantern pose' );
assert.ok( Math.abs( s.h - cutsceneHour - 12 / 60 ) < 1e-8, 'the sequence uses the ordinary watch clock' );
assert.ok( Math.abs( s.lamp.wind - cutsceneWind + 12 / 60 / 3 ) < 1e-8, 'the descent comes from real clockwork state, without a separate animation' );
assert.ok( s.lamp.lit && s.lamp.running );
assert.ok( s.flags.keeperDuty.verified, 'the cutscene teaches the working apparatus without a repeat examination' );
only( 'crank' );
await rejectOtherChores( 'crank' );
s.save(); s._restore( s.loadSave() );
only( 'crank' );
assert.equal( s.beat, 'watch' );
assert.ok( s.goal().includes( 'Raise the weight again' ), 'the cutaway replaces the hatch observation and leads directly to winding again' );
assert.equal( storyGuidance( s ).label, 'Raise the weight again · hold E' );
const observedWind = s.lamp.wind;
s.lamp.stop(); s.lamp.update( 1, .1 ); s.keeper.sync();
assert.equal( s.lamp.wind, observedWind, 'the real brake still holds the weight' );
s.lamp.start();
camera.lookAt( crank.at ); camera.updateMatrixWorld();
assert.equal( s.interact.pick()?.id, 'crank' );
for ( let i = 0; i < 600; i ++ ) s._wind( 1 / 60 );
assert.ok( s.flags.keeperDuty.rewound, 'raising the weight after the demonstration completes the first-night winding lesson' );
assert.ok( s.lamp.running && s.lamp.lit, 'rewinding keeps the mechanism and flame working' );
assert.equal( drive.at.y, st.parts.weightWay.top );
only( 'chair', 'stool' );
await rejectOtherChores( 'chair', 'stool' );

// Mechanical failures can still be recovered, but a completed lesson no longer
// offers a stop button alongside passing time.
s.lamp.stop(); s.keeper.state.verified = false;
assert.ok( s.lamp.lit && ! s.lamp.running, 'the stop affects the optic, not the flame' );
for ( let i = 0; i < 60 * 60; i ++ ) s.lamp.update( 1 / 60, 0 );
assert.equal( s.lamp.turning, false );
only( 'machineStop' );
await rejectOtherChores( 'machineStop' );
assert.equal( s.flags.keeperDuty.verified, false );
await use( 'machineStop' );
assert.ok( s.lamp.running && ! s.keeper.cutscene.active, 'later fully wound stop releases never replay the scene' );
s.keeper.update( 0 );
assert.ok( s.flags.keeperDuty.verified, 'restarting a learned mechanism does not add another lamp examination' );
only( 'chair', 'stool' );
s.save(); const saved = s.loadSave();
s._restore( saved );
assert.ok( s.flags.keeperDuty.inspected && s.lamp.running, 'preview save restores physical and learned state' );
s.keeper.update( 0 );
assert.ok( s.flags.keeperDuty.descentSeen && s.flags.keeperDuty.rewound, 'save resumes the learned first-night routine' );
assert.equal( drive.at.y, st.parts.weightWay.top, 'visible height is restored from winding state' );
const olderStudy = structuredClone( saved );
olderStudy.flags.keeperDuty.verified = true;
for ( const key of [ 'weightLook', 'descentSeen', 'descentWind', 'rewound', 'driveCutsceneSeen' ] ) delete olderStudy.flags.keeperDuty[ key ];
s._restore( olderStudy ); s.keeper.update( 0 );
assert.ok( s.lamp.running && s.flags.keeperDuty.verified && s.goal().includes( 'release the stop' ), 'an existing first-lighting save continues into the new lesson without restarting' );
// Old completed observations count as learned, without replaying the replacement scene.
const oldCompleted = structuredClone( saved ); delete oldCompleted.flags.keeperDuty.driveCutsceneSeen;
s._restore( oldCompleted ); s.keeper.toggleStop(); s.keeper.toggleStop();
assert.ok( s.keeper.driveTaught && ! s.keeper.cutscene.active );
const oldAwaitingInspection = structuredClone( saved );
oldAwaitingInspection.flags.keeperDuty.verified = false;
oldAwaitingInspection.flags.keeperDuty.rewound = false;
oldAwaitingInspection.beat = 'machine';
s._restore( oldAwaitingInspection );
assert.ok( s.flags.keeperDuty.verified && s.beat === 'watch', 'an old save waiting for repeat inspection continues directly to winding' );
only( 'crank' );
s._restore( saved );
// A low weight makes winding the only action until it is fully raised, including
// after a save taken partway through the task.
s.lamp.wind = .04;
only( 'crank' );
s._wind( 1 );
s.save(); s._restore( s.loadSave() );
only( 'crank' );
await rejectOtherChores( 'crank' );
for ( let i = 0; i < 600; i ++ ) s._wind( 1 / 60 );
only( 'chair', 'stool' );
// An empty mechanism and a dark burner cannot release the stop out of order.
s.flags.keeperDuty = { inspected: true, verified: false }; s.lamp.stop(); s.lamp.wind = 0;
s.keeper.toggleStop(); assert.ok( ! s.lamp.running && ! s.keeper.cutscene.active );
s.lamp.extinguish(); for ( let i = 0; i < 600; i ++ ) s._wind( 1 / 60 );
s.keeper.toggleStop(); assert.ok( ! s.keeper.cutscene.active && ! s.lamp.lit );
await use( 'lens' );
assert.ok( s.keeper.firstLight.active, 'a fresh duty record shows the first lighting again' );
s.keeper.firstLight.finish();
assert.ok( ! s.keeper.cinematic && ! s.ui.open && ! player.busy && s.keeper.note?.text.includes( 'brass stop' ), 'skipping the lantern view restores control and the burner note' );
await use( 'machineStop' );
assert.ok( s.keeper.cutscene.active && s.lamp.lit );
s.keeper.cutscene.finish();
assert.equal( weightLight.enabled, false, 'skipping the cutaway also switches off the shaft fill' );
assert.ok( s.keeper.driveTaught && ! s.ui.open && input.enabled, 'skip records the lesson and restores input' );
assert.ok( s.flags.keeperDuty.verified && s.keeper.step !== 'verify', 'skip never adds a repeat inspection' );
s.keeper.toggleStop(); s.keeper.toggleStop(); assert.equal( s.keeper.cutscene.active, false );
s._restore( saved );
assert.equal( localStorage.getItem( 'sevenhunters.night1.v1' ), 'protected normal watch' );

// Legacy/default lamp behavior stays compatible with the existing chapters.
const normal = new Lamp(); normal.addWind( .5 );
assert.equal( normal.running, true );
normal.stop(); normal.wind = 0; normal.start(); assert.equal( normal.running, false );
console.log( 'PASS exclusive first-night chores and guarded callbacks, longer captioned first light, full-wind release, cutaway pause/resume/skip, direct rewind without repeat inspection, maintenance save recovery, physical weight/cable and brake, and legacy winding.' );
