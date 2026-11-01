import assert from 'node:assert/strict';
import { ArrivalConversation, ARRIVAL_HANDOVER, CROSSING_PAPERS } from '../src/story/ArrivalConversation.js';
import { IntroLessons, INTRO_CLIMB, INTRO_PAPERS } from '../src/story/IntroLessons.js';

function crossing() {
	const s = { beat: 'crossing', flags: {}, arrival: { departure: null, ready: false }, app: { isMobile: false }, saves: 0, save() { this.saves ++; } };
	return { s, c: new ArrivalConversation( s ) };
}
{
	const { s, c } = crossing();
	assert.equal( c.active, true );
	assert.equal( c.advance(), true, 'input before the first rendered frame is consumed' );
	assert.equal( c.state.index, 0 );
	assert.equal( c.update( .2 ).text, ARRIVAL_HANDOVER[ 0 ].text );
	assert.equal( c.advance(), true );
	assert.equal( c.state.index, 1, 'a deliberate input advances only one remark' );
	c.advance();
	assert.equal( c.state.index, 1, 'double activation cannot dismiss the new remark' );
	c.update( .3 );
	const snapshot = structuredClone( s.flags );
	c.update( 200, { blocked: true } );
	assert.deepEqual( s.flags, snapshot, 'papers and paused views hold the handover clock' );
	s.flags = structuredClone( snapshot );
	const restored = new ArrivalConversation( s );
	assert.equal( restored.update( 0 ).text, ARRIVAL_HANDOVER[ 1 ].text );
	assert.equal( restored.state.elapsed, .3, 'reload preserves the current remark and its visible reading time' );
	s.arrival.ready = true;
	assert.equal( restored.active, true, 'bringing the landing closer cannot skip the conversation' );
	for ( let i = 1; i < ARRIVAL_HANDOVER.length; i ++ ) {
		restored.update( .2 );
		assert.equal( restored.state.index, i );
		assert.equal( restored.advance(), true );
	}
	assert.equal( restored.active, false );
	assert.equal( restored.advance(), false, 'only after the last remark can the landing action proceed' );
	assert.match( restored.update( 0 ).text, /step ashore/ );
	restored.depart(); s.flags.landed = true; s.beat = 'climb'; s.arrival.departure = 0;
	assert.equal( restored.update( 1 ), null );
	assert.equal( restored.advance(), false, 'the departing boat cannot be addressed again' );
}
{
	const { s, c } = crossing();
	const heard = new Set();
	for ( let i = 0; i < 120; i ++ ) { const line = c.update( 1 ); if ( line?.dialogue ) heard.add( line.text ); }
	assert.equal( heard.size, ARRIVAL_HANDOVER.length, 'a natural crossing presents the complete exchange once' );
	assert.equal( c.state.done, true );
	const before = structuredClone( s.flags );
	s.beat = 'room';
	assert.equal( c.update( 1000 ), null );
	assert.deepEqual( s.flags, before, 'later chapters do not reactivate arrival dialogue' );
}
{
	const s = { beat: 'climb', flags: { landed: true }, arrival: { departure: 0 }, save() {},
		app: { player: { mode: 'walk', grounded: true, position: { x: 0, y: 3, z: 3 } } },
		station: { landings: { east: { steps: { pts: [ [ 0, 0, 0 ], [ 0, 10, 10 ] ] } } }, tracks: { east: [ [ 0, 10 ], [ 10, 10 ] ] } } };
	const intro = new IntroLessons( s );
	assert.equal( intro.update( 1 ), null, 'the farewell gets breathing room before the first stair observation' );
	s.arrival.departure = 8;
	assert.equal( intro.update( 1 ).id, 'landings' );
	const remaining = s.flags.introLessons.active.remaining;
	assert.equal( intro.update( 50, { blocked: true } ), null );
	assert.equal( s.flags.introLessons.active.remaining, remaining );
}
assert.equal( CROSSING_PAPERS.length + INTRO_PAPERS.length, 6, 'two redundant background sheets have been cut' );
assert.ok( CROSSING_PAPERS.find( p => p.id === 'home' ).body.includes( 'Your sister, Mary' ) );
assert.match( CROSSING_PAPERS.find( p => p.id === 'moore' ).provenance, /28 December/ );
assert.ok( CROSSING_PAPERS.every( p => /fiction/i.test( p.provenance ) ) );
assert.ok( ! /first posting|three of you|replacement keepers|see about the others/i.test( JSON.stringify( [ CROSSING_PAPERS, ARRIVAL_HANDOVER ] ) ), 'no invented companions or generic first-posting premise' );
assert.ok( INTRO_CLIMB.every( cue => cue.from === 'Walter' ), 'subjective arrival notes belong to Walter' );
console.log( 'PASS arrival handover: complete natural and accelerated remarks, one-input pacing, paper pause, saved interruption, departure separation, first-ascent spacing and compact source-separated packet.' );
