import assert from 'node:assert/strict';
import { fixture, E, TOWER } from './helpers/morning-fixture.mjs';
import { KITCHEN, HAULING_SHED } from '../src/world/flannan/NextRooms.js';
import { hazeTransmittance } from '../src/station/Beams.js';
import { SMOKE_DISCOVERY_FOV } from '../src/story/NextWatchCutscenes.js';

const f = await fixture( false, { search: 'chapterPreview=kitchen' } ), { s, app, place, face, keys, step, player } = f;
const n = s.next, pages = [], notices = [], cues = [];
s.ui.read = async p => { pages.push( p ); };
s.ui.arrival = ( p, hint ) => { if ( p ) notices.push( { ...p, hint } ); };
s.onStoryCue = id => cues.push( id );
s.hand.setRest( new E.Vector3( -4.95, TOWER.floor + .74, 3.12 ), .4 );
s.flags.nextWatch = {}; s.h = 33; s.beat = 'd2kitchen'; s.paused = false; s.signal = false; s.watcher.state = 'done';
s.lamp.extinguish(); s.lamp.stop(); app.input.enabled = true;
const use = async id => { await s.interact.get( id ).use(); await Promise.resolve(); };
const locations = { kitchenStove: [ -3.1, 7.6 ], breakfastKettleTake: [ -3.1, 7.75 ], breakfastWater: [ -.05, 8.25 ], breakfastKettle: [ -3.1, 7.75 ], breakfastTea: [ -2.65, 8.9 ], breakfastBread: [ -2.65, 8.9 ] };
const first = n.mealStep().id;
await n.prepareMeal( 'breakfastBread' );
assert.equal( n.mealStep().id, first, 'out-of-order input cannot skip preparation' );
for ( let i = 0; i < 6; i ++ ) {
	const id = n.mealStep().id, it = s.interact.get( id );
	place( locations[ id ][ 0 ], TOWER.floor, locations[ id ][ 1 ] );
	face( typeof it.at === 'function' ? it.at() : it.at );
	assert.equal( s.interact.pick()?.id, id, `visible kitchen target selects ${ id }` );
	keys.add( 'KeyE' ); step( it.hold + .12 ); keys.delete( 'KeyE' ); step( .1 ); await Promise.resolve();
	assert.equal( n.mealState().stage || n.state.meals.d2.stage, i + 1 );
	if ( i === 1 ) {
		s.save(); const saved = s.loadSave(); s._restore( saved ); s.paused = false;
		assert.equal( n.mealStep().id, 'breakfastWater', 'interrupted preparation resumes at the next real action' );
	}
}
assert.equal( s.beat, 'd2crate' );
assert.equal( s.rows.filter( r => /Made tea and bread/.test( r[ 1 ] ) ).length, 1 );
assert.deepEqual( cues, [ 'morning-preparation', 'morning-preparation-end' ], 'only pending music hooks; no assumed asset' );
await use( 'kitchenStove' );
assert.equal( n.state.meals.d2.stage, 6, 'repeat stove inspection does not repeat a completed meal' );

s.beat = 'd3breakfast'; s.h = 58; s.lamp.lit = true; s.lamp.running = true; s.lamp.wind = .12;
const wind = s.lamp.wind; n.update( 40, false );
assert.equal( s.lamp.wind, wind, 'domestic work has no winding deadline' );
assert.equal( n.mealSteps().length, 4, 'later breakfast abbreviates the established routine' );
assert.ok( ! /running down/.test( n.goal() ) );
for ( const id of [ 'breakfastKettleTake', 'breakfastKettle', 'breakfastTea', 'breakfastBread' ] ) await use( id );
assert.equal( s.beat, 'd3light' );

s.beat = 'd2survey'; s.h = 35; s.lamp.extinguish(); s.lamp.stop();
place( -160, HAULING_SHED.floor, 40 ); await use( 'haulingBrake' ); n.update( .1, false );
assert.equal( s.beat, 'd2rest' );
assert.ok( ! n.state.fogReturned && ! n.state.fogThought );
place( -155, app.terrainData.heightAt( -155, 44 ), 44 ); n.update( .1, false ); await Promise.resolve(); await Promise.resolve();
assert.equal( pages.filter( p => p.title === 'The way back' ).length, 1 );
n.update( .1, false ); await Promise.resolve();
assert.equal( pages.filter( p => p.title === 'The way back' ).length, 1, 'fog thought appears once' );
const eye = new E.Vector3( -120, app.terrainData.heightAt( -120, 29 ) + 1.62, 29 );
const tower = new E.Vector3( 0, s.station.focal, 0 ), nearRail = eye.clone().add( new E.Vector3( 6, -1.55, -.3 ) );
const distantT = hazeTransmittance( eye, tower, app.haze.density.value ), railT = hazeTransmittance( eye, nearRail, app.haze.density.value );
assert.ok( distantT < .08 && railT > .7, `fog obscures the lighthouse while local rails remain visible (${ distantT.toFixed( 3 ) }, ${ railT.toFixed( 3 ) })` );
for ( const [ name, ds ] of Object.entries( s.doors ) ) for ( const d of ds ) d.target = d.open = name === 'southGate' ? 0 : 1;
place( -160, HAULING_SHED.floor, 40.8 ); player.busy = false; app.input.enabled = true;
keys.add( 'KeyW' ); let reached = false, openedSouthGate = false, maxGap = 0;
for ( let i = 0; i < 16000; i ++ ) {
	const guide = n.guidance();
	if ( guide?.id === 'houseDoor' ) { reached = true; break; }
	if ( guide?.id === 'southGate' && player.position.distanceTo( guide.at ) < 2.8 ) { await use( 'southGate' ); openedSouthGate = true; }
	assert.ok( guide, 'the fog return always has a recoverable next marker' );
	if ( player.position.x < -30 && player.position.z < 38 ) maxGap = Math.max( maxGap, player.position.distanceTo( guide.at ) );
	player.yaw = Math.atan2( player.position.x - guide.at.x, player.position.z - guide.at.z ); player.pitch = 0;
	step( 1 / 30 ); await Promise.resolve();
}
keys.delete( 'KeyW' );
assert.ok( reached && maxGap < 11, `following dense markers reaches the house through real collisions (${ maxGap.toFixed( 2 ) } m max rail marker)` );
assert.ok( openedSouthGate && s.doors.southGate.every( leaf => leaf.target > .5 ), 'closed south gate is discovered and both physical leaves open during the actual return' );
assert.ok( n.state.fogReturned, 'fog may clear only after the upper-route return reaches the station' );

s.beat = 'd3remote'; s.h = 66; delete n.state.smokeSeen; delete n.state.smokeCutscene;
place( -160, HAULING_SHED.floor, 40.8 ); await use( 'haulingBrake' ); n.update( .1, false );
assert.ok( ! n.smoke.active && ! n.state.smokeSeen, 'shed walls never count as witnessing the plume' );
place( -155, app.terrainData.heightAt( -155, 44 ), 44 ); player.yaw = Math.PI / 2; player.pitch = -.2; player.update( 0 );
n.update( .1, false ); assert.ok( n.smoke.active && ! app.input.enabled && player.busy );
const smokeFov = app.camera.fov;
const feet = player.position.toArray(), cueCount = cues.length;
n.smoke.update( 1, true ); assert.equal( n.smoke.state.elapsed, 0, 'pause stops the cinematic safely' );
n.smoke.update( 2.2 ); assert.equal( app.camera.fov, SMOKE_DISCOVERY_FOV, 'the held first-person lens frames the lower plume without requiring an instrument' );
const beaconFrame = new E.Vector3( 0, s.station.focal, 0 ).project( app.camera );
assert.ok( beaconFrame.y > 1, 'the bright optic core lies above the held plume frame; this is a geometric framing check' );
const chimneyFrame = KITCHEN.chimney.clone().project( app.camera );
assert.ok( Math.abs( chimneyFrame.x ) < 1 && Math.abs( chimneyFrame.y ) < 1, 'the physical chimney remains within the same first-person frame' );
assert.ok( n.state.smokeSeen && notices.some( q => /I banked/.test( q.text ) ), 'the mandatory head turn supplies honest witnessed state and a first-person thought' );
assert.deepEqual( player.position.toArray(), feet, 'smoke discovery remains at the player’s safe first-person viewpoint' );
s.save(); const interrupted = s.loadSave(); s._restore( interrupted ); s.paused = false; n.update( .1, false );
assert.ok( n.smoke.active && n.state.smokeSeen, 'reload retains the witnessed event and incomplete cutscene' );
n.smoke.update( 7 );
assert.ok( ! n.smoke.active && app.input.enabled && ! player.busy, 'control returns with no stale lock' );
assert.equal( app.camera.fov, smokeFov, 'the cinematic restores the exact original lens' );
const heading = player.yaw; n.update( 1, false );
assert.equal( player.yaw, heading ); assert.equal( cues.length, cueCount, 'smoke discovery has no music cue' );
delete n.state.smokeSeen; app.input.enabled = false; player.busy = true;
assert.ok( n.smoke.start(), 'a controller-locked direct invocation still preserves its original lock' );
n.smoke.update( 2.2 ); s.save(); s._restore( s.loadSave() ); s.paused = false; n.update( .1, false ); n.smoke.update( 7 );
assert.ok( ! app.input.enabled && player.busy, 'interrupted smoke discovery restores the exact original input and busy locks' );
n.update( .1, false ); assert.ok( ! n.smoke.active && ! app.input.enabled, 'a witnessed discovery cannot replay or unlock the controller' );
app.input.enabled = true; player.busy = false;
await use( 'kitchenStove' );
assert.equal( s.beat, 'd3sleep' ); assert.ok( /I left/.test( pages.at( -1 ).body[ 0 ] ) );
n.state.episode = 0; n.episode( 4 );
assert.ok( s.watcher.script.nodes.house.options.some( o => o.flag === 'toldSmoke' ), 'witnessing permits disclosure without making the choice for the player' );
let end, photography = 0;
s.ui.end = q => { end = q; }; s.later.begin = () => { photography ++; }; s.returningLight.begin = () => { throw new Error( 'cut scene 10 must not run' ); };
n.endShown = false; n.showEnd(); end.next.use(); assert.equal( photography, 1 );
console.log( JSON.stringify( { result: 'PASS', firstBreakfastActions: 6, repeatBreakfastActions: 4, fogLighthouseTransmittance: distantT, localRailTransmittance: railT, maxReturnMarkerMetres: maxGap, smokeCutsceneSeconds: 7, interruptedSaveRestored: true, smokeMusicCues: 0 }, null, 2 ) );
process.exit( 0 );
