import assert from 'node:assert/strict';
import { Watcher, MORSE } from '../src/story/Watcher.js';
import { GuidedSignal, SIGNAL_PRACTICE } from '../src/story/GuidedSignal.js';
import { WATCHER } from '../src/story/Script.js';

const fixture = ( watcher = new Watcher(), flags = {} ) => {
	const sounds = [], saved = [];
	const s = { watcher, flags, signal: true, paused: false, app: {}, signalLight: { scale: 0 },
		ui: { open: false, strip() {} }, sound: { signalShutter( on ) { sounds.push( on ); } },
		save() { saved.push( watcher.save() ); }, _leaveSignal() { this.signal = false; } };
	const guide = s.guidedSignal = new GuidedSignal( s );
	return { s, guide, sounds, saved };
};
const tick = ( guide, seconds ) => { for ( let t = 0; t < seconds - 1e-8; t += .02 ) guide.update( Math.min( .02, seconds - t ) ); };
const hold = ( guide, duration ) => { guide.press( true ); tick( guide, duration ); guide.press( false ); };

const f = fixture(), { s, guide } = f;
s.watcher.appear(); s.watcher.call();
assert.equal( guide.enter(), true );
assert.equal( guide.phase, 'demo' );
tick( guide, 2.2 );
assert.equal( guide.phase, 'practice' );
assert.ok( f.sounds.includes( true ) && f.sounds.includes( false ), 'demonstration drives existing shutter audio and lamp together' );
assert.equal( guide.lamp, 0 );
assert.deepEqual( SIGNAL_PRACTICE, [ 'E', 'T', 'A' ] );
guide.press( true ); tick( guide, .1 ); s.app.mobile = { paused: true }; guide.update( 0 );
assert.equal( guide.pressed, false ); assert.equal( guide.lamp, 0 ); assert.equal( guide.chunk.symbol, 0, 'mobile pause cancels a partial shutter hold' );
s.app.mobile.paused = false;
assert.equal( guide.flash( '.' ), true ); s.app.mobile.paused = true; guide.update( 0 ); s.app.mobile.paused = false; tick( guide, 1 );
assert.equal( guide.chunk.symbol, 0, 'a paused accessible pulse cannot silently complete later' );

hold( guide, .15 ); tick( guide, .6 );
assert.equal( guide.chunk.letter, 'T', 'a tap sends E without memorising gaps' );
hold( guide, .72 ); tick( guide, .6 );
assert.equal( guide.chunk.letter, 'A' );
hold( guide, .9 );
assert.equal( guide.chunk.symbol, 0, 'a mistaken long flash retries this letter' );
assert.equal( guide.chunk.index, 2, 'a retry retains the completed practice letters' );
hold( guide, .13 );
assert.equal( guide.chunk.symbol, 1 );
guide.press( true ); tick( guide, .2 );
guide.pause();
assert.equal( guide.lamp, 0 );
assert.equal( guide.pressed, false, 'interruption releases the shutter without accepting a half flash' );
assert.equal( guide.enter(), true );
assert.equal( guide.chunk.symbol, 1, 'returning keeps completed practice marks' );
hold( guide, .75 ); tick( guide, .6 );
assert.equal( guide.active, false );
assert.equal( s.flags.signalLesson.practised, true );
assert.equal( s.watcher.state, 'sending' );
assert.equal( s.watcher.node, WATCHER.nodes.hello, 'practice answers the original call, with its original first message' );

s.watcher.update( .01, { watched: true, hurry: true } );
assert.equal( s.watcher.state, 'waiting' );
assert.equal( s.watcher.reply( 99 ), null, 'an invalid choice cannot strand the conversation' );
assert.equal( guide.reply( 1 ), true );
assert.equal( s.watcher.manualReply, true );
assert.equal( s.watcher.log.at( -1 ).text, WATCHER.nodes.hello.options[ 1 ].text );
let charged = 0;
s.watcher.onSent = ( text, minutes ) => { charged += minutes; assert.equal( text, WATCHER.nodes.hello.options[ 1 ].text ); };
s.watcher.update( 999, { watched: true, hurry: true } );
assert.equal( s.watcher.manualChunk.index, 0, 'a hurry request cannot auto-send the guided reply' );
assert.equal( charged, 0 );
assert.equal( s.watcher.finishManualReply(), false, 'the lesson cannot advance a branch before its chosen message is sent' );

// Send a prefix, make a mistake in a later letter, and save midway through it.
for ( const mark of MORSE.N ) { assert.equal( guide.flash( mark ), true ); tick( guide, mark === '.' ? .3 : 1 ); }
tick( guide, .6 );
assert.equal( s.watcher.manualChunk.letter, 'E' );
hold( guide, .15 ); tick( guide, .6 );
assert.equal( s.watcher.manualChunk.letter, 'W' );
hold( guide, .14 );
assert.equal( s.watcher.manualChunk.symbol, 1 );
hold( guide, .14 );
assert.equal( s.watcher.manualChunk.symbol, 0 );
assert.equal( s.watcher.manualChunk.index, 2, 'an outgoing typo retries only W, retaining NE' );
hold( guide, .14 );
guide.press( true ); tick( guide, .1 );
const snapshot = s.watcher.save();
assert.equal( snapshot.progress.manual.pressed, false, 'saved state never restores an open shutter' );
guide.pause();
const restored = new Watcher(); restored.load( snapshot );
restored.onSent = ( text, minutes ) => { charged += minutes; assert.equal( text, WATCHER.nodes.hello.options[ 1 ].text ); };
const resumed = fixture( restored, structuredClone( s.flags ) );
assert.equal( resumed.guide.enter(), true );
assert.equal( restored.manualChunk.index, 2 );
assert.equal( restored.manualChunk.symbol, 1 );
assert.equal( restored.yourLamp, 0 );
assert.equal( restored.log.filter( row => row.from === 'you' ).length, 1, 'restoring a selected reply does not record the choice twice' );

resumed.guide.help(); tick( resumed.guide, 2 );
assert.equal( restored.manualChunk.symbol, 1, 'help pauses manual progress' );
resumed.guide.closeHelp();
let guard = 0;
while ( resumed.guide.active && guard ++ < 250 ) {
	const chunk = restored.manualChunk;
	if ( chunk.complete ) { tick( resumed.guide, .6 ); break; }
	const mark = chunk.code[ chunk.symbol ];
	assert.equal( resumed.guide.flash( mark ), true );
	tick( resumed.guide, mark === '.' ? .4 : 1.4 );
	tick( resumed.guide, .6 );
}
assert.ok( guard < 250 );
assert.equal( resumed.guide.active, false );
assert.equal( resumed.s.flags.signalLesson.firstReplyDone, true );
assert.equal( charged, WATCHER.nodes.hello.options[ 1 ].minutes, 'a resumed guided message charges its original minutes once' );
assert.equal( restored.node, WATCHER.nodes.alone );
assert.equal( restored.state, 'sending' );
assert.equal( restored.text, '', 'finishing one chosen reply leaves the next incoming line unread' );
restored.update( .01, { watched: true, hurry: true } );
assert.equal( restored.state, 'waiting' );
assert.equal( resumed.guide.reply( 0 ), false, 'successful first sending eases subsequent replies back to the existing flow' );
restored.onSent = null;
restored.reply( 0 );
restored.update( .01, { watched: true, hurry: true } );
assert.equal( restored.node, WATCHER.nodes.ceit );
assert.equal( restored.text, '' );
assert.ok( WATCHER.nodes.ceit.options.some( option => option.next === 'december' ), 'the original optional December branch remains available' );

// Reloading a complete pending message is safe and does not require another mark.
const full = new Watcher(); full.appear(); full.answer(); full.update( 1, { watched: true, hurry: true } ); full.reply( 0, { manual: true } );
while ( ! full.manualChunk.complete ) full.manualMark( full.manualChunk.code[ full.manualChunk.symbol ] );
const fullReload = new Watcher(); fullReload.load( full.save() );
let completed = 0; fullReload.onSent = () => completed ++;
assert.equal( fullReload.finishManualReply(), true );
assert.equal( fullReload.finishManualReply(), false );
assert.equal( completed, 1 );

console.log( 'Guided signal: demonstration, forgiving holds, retries, interrupted/reloaded reply and exact branches passed.' );
