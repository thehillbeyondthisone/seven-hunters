import assert from 'node:assert/strict';
import { fixture, E, TOWER, ROOM, mobileAction } from './helpers/morning-fixture.mjs';

localStorage.setItem( 'sevenhunters.night1.v1', 'protected normal watch' );
for ( const familiar of [ false, true ] ) {
	const f = await fixture( familiar ), { s, m, step, place, face, app, keys } = f;
	const q = m.state, total = () => Object.values( m.state.oil ).reduce( ( a, b ) => a + b, 0 ), initialOil = total();
	assert.equal( s.saveKey, `sevenhunters.morning-servicing-preview.${ familiar ? 'familiar' : 'first' }.v1` );
	assert.equal( s.beat, 'morningService' ); assert.ok( s.lamp.lit && s.lamp.turning );
	assert.equal( m.act( 'panel' ), false ); assert.equal( m.act( 'check' ), false );
	assert.equal( await m.journal(), false );
	const use = async id => {
		const it = s.interact.get( id ), at = typeof it.at === 'function' ? it.at() : it.at;
		face( at ); assert.equal( s.interact.pick()?.id, id, `real pose selects ${ id }` );
		await it.use();
	};
	await use( 'lens' );
	assert.equal( s.lamp.lit, false ); assert.equal( s.lamp.running, false ); assert.ok( s.lamp.speed > 0 );
	await use( 'morningInspect' ); assert.ok( q.inspected );
	assert.equal( m.act( 'panel' ), false, 'inspection does not unlock moving machinery' );
	const coasting = s.lamp.speed; s.save(); s._restore( s.loadSave() );
	assert.equal( s.lamp.speed, coasting, 'preview restore preserves real coasting speed' );
	// State references are replaced by _restore, so always read through m.state.
	step( 50 ); assert.ok( m.safe );
	place( 9.3, m.layout.floor, -2.4 );
	await use( 'morningKit' );
	place( 9.55, m.layout.floor, -2.4 ); await use( 'morningCan' );
	place( 10.4, m.layout.floor, -2.4 );
	face( m.at( 'fill' ) ); s.interact.update( 0 );
	assert.equal( mobileAction( app ).hold, true ); assert.equal( mobileAction( app ).progress, 0 );
	app.handLamp.lit = true; m.work( 'fill', .1 ); assert.equal( m.state.oil.can, 0, 'no filling beside a flame' ); app.handLamp.lit = false;
	keys.add( 'KeyE' ); step( 1 ); keys.delete( 'KeyE' ); step( .1 );
	assert.ok( m.state.oil.can > 0 && m.state.oil.can < .65 ); assert.equal( m.state.canPlace, 'filling' );
	const partial = structuredClone( m.state ); s.save(); s._restore( s.loadSave() );
	assert.deepEqual( m.state.oil, partial.oil ); assert.equal( m.state.canCapped, false );
	const pausedOil = total(), before = m.state.oil.can;
	for ( const block of [ () => { s.paused = true; }, () => { s.ui.modal = 1; }, () => { app.devMenu = { open: true }; }, () => { document.hidden = true; }, () => { app.mobile = { paused: true }; }, () => { app.freeCam = true; }, () => { app.input.enabled = false; } ] ) {
		block(); m.work( 'fill', .1 ); step( .1 ); assert.equal( m.state.oil.can, before );
		s.paused = false; s.ui.modal = 0; app.devMenu = null; document.hidden = false; app.mobile = null; app.freeCam = false; app.input.enabled = true;
	}
	assert.equal( total(), pausedOil );
	keys.add( 'KeyE' ); step( 4 ); keys.delete( 'KeyE' ); step( .1 );
	assert.ok( Math.abs( total() - initialOil ) < 1e-8 );
	assert.equal( m.state.oil.can, .65 ); await use( 'morningCap' );
	assert.ok( m.state.canCapped );
	const stand = ( a, r = 1.9 ) => place( Math.cos( a ) * r, TOWER.deck, Math.sin( a ) * r );
	stand( m.layout.angle + .55 ); await use( 'morningShelf' );
	const openAngle = m.layout.angle + s.lamp.angle;
	stand( openAngle ); await use( 'morningPanel' );
	assert.ok( m.state.panelOpen );
	const work = ( id, seconds ) => { const it = s.interact.get( id ); face( typeof it.at === 'function' ? it.at() : it.at ); assert.equal( s.interact.pick()?.id, id ); keys.add( 'KeyE' ); step( seconds ); keys.delete( 'KeyE' ); step( .05 ); };
	if ( familiar ) work( 'morningFamiliar', 6.2 );
	else {
		stand( openAngle - .4 ); work( 'morningGlass', 1 );
		const film = m.state.glass; s.save(); s._restore( s.loadSave() ); assert.equal( m.state.glass, film );
		work( 'morningGlass', 2.2 );
		stand( openAngle + .5 ); m.work( 'housing', .1 ); assert.equal( m.state.housing, 1, 'cannot work through closed glass beside the opening' );
		stand( openAngle ); work( 'morningHousing', 3.2 ); work( 'morningWick', 3.2 );
	}
	assert.equal( m.state.glass + m.state.housing + m.state.wick, 0 );
	const rowsAfterCleaning = s.rows.length; m.work( 'glass', .1 ); assert.equal( s.rows.length, rowsAfterCleaning, 'clean surfaces require no repeat work' );
	stand( m.layout.angle + .55 ); await use( 'morningFountain' ); work( 'morningPour', 1 );
	const oilMidPour = structuredClone( m.state.oil ); s.save(); s._restore( s.loadSave() ); assert.deepEqual( m.state.oil, oilMidPour );
	work( 'morningPour', 3 ); await use( 'morningSeal' );
	assert.ok( Math.abs( total() - initialOil ) < 1e-8 ); assert.equal( m.state.oil.fountain, 1 );
	stand( openAngle ); await use( 'morningPanel' ); assert.equal( m.state.panelOpen, false );
	stand( TOWER.crankAngle ); work( 'crank', 7 );
	assert.ok( s.lamp.wind >= .999 ); assert.equal( s.lamp.running, false );
	stand( openAngle ); await use( 'morningCheck' ); assert.ok( m.state.checked );
	stand( m.layout.angle + .55 ); await use( 'morningShelf' );
	place( 8.2, m.layout.floor, -1.8 ); await use( 'morningCloths' );
	place( 8.1, m.layout.floor, -2.4 ); await use( 'morningKit' );
	place( 9.55, m.layout.floor, -2.4 ); await use( 'morningCan' );
	assert.ok( m.stowed );
	place( 9.3, m.layout.floor, .85 );
	s.doors.oilStore[ 0 ].target = 1; s.doors.oilStore[ 0 ].open = 1;
	await use( 'morningStoreDoor' ); step( 2 );
	place( ROOM.journal.x + .5, TOWER.floor, ROOM.journal.z + .7 ); await use( 'journal' );
	assert.ok( m.state.done ); assert.equal( s.beat, 'morningService' );
	assert.equal( s.next.active, false ); assert.equal( s.watcher.state, 'away' );
	assert.equal( m.state.records.signed, true );
	const signedRows = s.rows.length; await m.journal(); m.work( 'pour', .1 ); assert.equal( s.rows.length, signedRows );
	s.save(); s._restore( s.loadSave() ); assert.ok( m.state.done && m.stowed ); assert.equal( s.rows.length, signedRows );
	assert.equal( localStorage.getItem( 'sevenhunters.night1.v1' ), 'protected normal watch' );
	s.clearSave(); assert.equal( localStorage.getItem( 'sevenhunters.night1.v1' ), 'protected normal watch' );
	console.log( `PASS ${ familiar ? 'familiar' : 'first' } dawn: reachable actions, causal servicing, conserved oil, paused/interrupted work, coasting restore, touch holds, signed record and isolated restart.` );
}
