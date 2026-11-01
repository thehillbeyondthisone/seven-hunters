import assert from 'node:assert/strict';
import { fixture, ROOM, STATION } from './helpers/morning-fixture.mjs';
import { CoastalState } from '../src/ocean/CoastalState.js';
import { KeeperSafety } from '../src/player/KeeperSafety.js';
import { Beams } from '../src/station/Beams.js';
import { clearTerrainSightline } from '../src/story/ReturningLight.js';

const f = await fixture( false, { search: 'stormPreview', morningStudy: false } );
const { app, s, player, camera, place, face } = f;
app.coastal = new CoastalState( app.terrainData );
app.keeperSafety = new KeeperSafety( app, s );
s.ui.end = () => {};
s.save = () => {};
const storm = s.storm, checks = [];
const step = dt => {
	app.keeperSafety.beforeFrame( dt );
	if ( !storm.cutscene.active ) player.update( dt );
	s.update( dt ); app.keeperSafety.afterFrame();
};

for ( const phase of [ 0, 7, 14, 28, 53.66, 69 ] ) {
	await storm.begin();
	await s.interact.get( 'stormOil' ).use();
	assert.equal( player.carryingHeavy, true );
	await s.interact.get( 'stormShelf' ).use();
	assert.equal( player.carryingHeavy, false );
	s.lamp.wind = 1; storm.onWind();
	place( STATION.southGate.x, STATION.yard, STATION.southGate.z - 1.8 );
	await s.interact.get( 'stormGate' ).use();
	assert.equal( storm.state.secured, undefined, 'opening the gate inside is not the securing task' );
	assert.equal( s.interact.get( 'stormGate' ).hold, 0 );
	place( STATION.southGate.x, STATION.yard, STATION.southGate.z + 1.4 );
	assert.equal( s.interact.get( 'stormGate' ).hold, 1.5 );
	await s.interact.get( 'stormGate' ).use();
	assert.equal( storm.state.ropeSecured, true );
	assert.ok( !s.interact.get( 'stormGate' ).when(), 'the rope task cannot repeat after completion' );
	assert.equal( s.beat, 'storm-look' );
	assert.equal( storm.lantern, undefined, 'cut scene sixteen creates no lantern model' );
	place( ...storm.lookout.toArray() ); face( storm.damageTarget );
	assert.ok( player.position.y > 32, 'scope uses safe upper footing' );
	assert.ok( clearTerrainSightline( app.terrainData, camera.position, storm.damageTarget ), 'the lower landing is visible from the selected upper lookout' );
	assert.equal( s.interact.pick()?.id, 'stormScope', 'the inspection is discoverable when looking at the lower landing' );
	app.coastal.load( { time: phase, strength: 1.5 } );
	const position = player.position.toArray(), wind = s.lamp.wind, clock = s.h;
	const priorDamageRows = s.rows.filter( ( [ , text ] ) => text === 'A large sea destroyed the lower west landing. Upper tramway remains passable.' ).length;
	assert.equal( storm.startWave(), true );
	assert.equal( storm.startWave(), false, 'repeated activation cannot restart the set' );
	assert.equal( storm.cutscene.active, true );
	assert.equal( app.input.enabled, false );
	assert.equal( player.busy, true );
	const start = app.coastal.time;
	for ( let i = 0; i < 60; i++ ) step( 1 / 60 );
	const pausedAt = app.coastal.time, elapsed = storm.state.scopeElapsed;
	s.paused = true;
	for ( let i = 0; i < 60; i++ ) step( 1 / 60 );
	assert.equal( app.coastal.time, pausedAt );
	assert.equal( storm.state.scopeElapsed, elapsed );
	s.paused = false;

	// Save and resume an interrupted scope without a second wave or a duplicate
	// journal event. This uses the chapter restore API and persisted coastal state.
	if ( phase === 14 ) {
		const flags = structuredClone( s.flags ), coast = app.coastal.save();
		storm.cutscene.close();
		s.flags = flags; app.coastal.load( coast ); storm.restore(); storm.update( 0 );
		assert.equal( storm.cutscene.active, true );
		assert.equal( storm.state.scopeElapsed, elapsed );
	}
	let impact = null;
	for ( let i = 0; i < 60 * 40 && s.beat === 'storm-wave'; i++ ) {
		step( 1 / 60 );
		assert.equal( Beams.uniforms.far.value[ 1 ].w, 0, 'there is no replacement human-looking light' );
		if ( storm.state.routeDestroyed && impact === null ) {
			impact = app.coastal.time;
			assert.ok( app.coastal.sample( storm.damageTarget, { ground: storm.platformY } ).washDepth > 3 );
		}
	}
	assert.ok( impact - start > 7, 'intact platform is readable before the impact' );
	assert.ok( app.coastal.time - impact > 8, 'the water drains before control returns' );
	assert.equal( s.beat, 'storm-return' );
	assert.equal( storm.cutscene.active, false );
	assert.equal( storm.state.scopeSeen, true );
	assert.equal( app.input.enabled, true );
	assert.equal( player.busy, false );
	assert.equal( camera.fov, s.baseFov );
	assert.equal( s.tel, 0 );
	assert.deepEqual( player.position.toArray(), position, 'the view never takes the keeper down to the landing' );
	assert.equal( s.lamp.wind, wind, 'away work has no winding deadline' );
	assert.equal( s.h, clock, 'scope and return remain within the prepared watch milestone' );
	assert.equal( s.rows.filter( ( [ , text ] ) => text === 'A large sea destroyed the lower west landing. Upper tramway remains passable.' ).length, priorDamageRows + 1 );
	checks.push( { phase, impactAfter: +( impact - start ).toFixed( 2 ), controlAfter: +( app.coastal.time - start ).toFixed( 2 ) } );
}

await storm.begin( false, { connected: true } );
storm.state.routeDestroyed = true; storm.damage.set( true );
s.setBeat( 'storm-return' );
place( ( ROOM.x0 + ROOM.x1 ) / 2, 50, ( ROOM.z0 + ROOM.z1 ) / 2 );
let holdReason = '', reliefCalls = 0;
s.later.holdForStoryReview = reason => { holdReason = reason; s.setBeat( 'lw-review-hold' ); };
s.later.beginRelief = () => { reliefCalls++; };
storm.update( 1 / 60 );
assert.equal( s.beat, 'storm-contact-pending', 'homecoming is part of scene seventeen, with no extra return checklist' );
assert.equal( holdReason, '', 'shelter has a quiet pause before the review boundary' );
for ( let i = 0; i < 125; i++ ) storm.update( 1 / 60 );
assert.equal( holdReason, 'storm-contact' );
assert.equal( reliefCalls, 0, 'revised play never enters the held ending' );
assert.equal( storm.state.reliefStory.status, 'awaiting-authored-contact' );
assert.equal( storm.state.reliefStory.promise, null, 'an unapproved promise has not been claimed as received' );
assert.equal( storm.state.reliefStory.missedArrival, null, 'no arbitrary missed-arrival time or cause is invented' );
s.setBeat( 'storm-signal' );
storm.restore( { state: 'waiting', node: 'seen', log: [], flags: {} } );
assert.equal( s.beat, 'storm-contact-pending', 'a connected old save reaches the same pending review boundary' );
assert.equal( storm.state.legacyContact.beat, 'storm-signal', 'old contact source/progress is retained for review' );
storm.damage.set( false );
console.log( 'PASS rope/oil preparation, discoverable scope, no service lantern, real wave impact/drainage, pause/resume, controls, protected winding, absorbed homecoming and held narrative boundary.' );
console.log( JSON.stringify( { lookout: storm.lookout.toArray(), landingTarget: storm.damageTarget.toArray(), checks } ) );
