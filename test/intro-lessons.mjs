// Scheduling, real-route gates and saved reading progress, without a GPU.
import assert from 'node:assert/strict';
import { IntroLessons, INTRO_CLIMB, INTRO_PAPERS } from '../src/story/IntroLessons.js';

function watch() {
	const story = { beat: 'climb', flags: { landed: true }, saves: 0, save() { this.saves ++; },
		app: { player: { mode: 'walk', grounded: true, position: { x: 0, y: 3, z: 3 } } },
		station: { landings: { east: { steps: { pts: [ [ 0, 0, 0 ], [ 0, 10, 10 ] ] } } }, tracks: { east: [ [ 0, 10 ], [ 10, 10 ] ] } } };
	return { story, lessons: new IntroLessons( story ) };
}
{
	const { story, lessons } = watch();
	story.app.player.position.x = 30;
	assert.equal( lessons.update( 1 ), null, 'matching height far from the steps does not trigger lore' );
	story.app.player.position.x = 0;
	assert.equal( lessons.update( 1 ).id, 'landings' );
	const remaining = story.flags.introLessons.active.remaining;
	assert.equal( lessons.update( 100, { blocked: true } ), null );
	assert.equal( story.flags.introLessons.active.remaining, remaining, 'reading, reveal and hidden frames do not spend caption time' );
	const saved = JSON.parse( JSON.stringify( story.flags ) );
	lessons.update( 1 ); story.flags = saved;
	assert.equal( new IntroLessons( story ).update( 0 ).id, 'landings', 'reload retains the unfinished caption' );
	assert.equal( story.flags.introLessons.active.remaining, remaining );
	for ( let i = 0; i < 50; i ++ ) lessons.update( 1 );
	assert.equal( lessons.update( 1 ), null, 'staying on a tread does not replay its lesson' );
	story.app.player.position = { x: 0, y: 5, z: 5 };
	assert.equal( lessons.update( 1 ).id, 'rails' );
	const railTime = story.flags.introLessons.active.remaining;
	story.app.player.position = { x: 0, y: 8, z: 8 };
	assert.equal( lessons.update( 1 ).id, 'rails', 'a new milestone does not interrupt the current reading' );
	assert.equal( story.flags.introLessons.active.remaining, railTime - 1 );
	for ( let i = 0; i < Math.ceil( railTime ); i ++ ) lessons.update( 1 );
	assert.equal( lessons.update( 0 ), null, 'there is silence between passages' );
	for ( let i = 0; i < 6; i ++ ) lessons.update( 1 );
	assert.equal( lessons.update( 0 ).id, 'shore' );
	story.beat = 'room';
	for ( let i = 0; i < 40 && lessons.update( 0 )?.id !== 'yard'; i ++ ) lessons.update( 1 );
	assert.equal( lessons.update( 0 ).id, 'yard', 'entering the yard finishes with the keepers rather than a route backlog' );
	const yardSave = JSON.parse( JSON.stringify( story.flags ) ); story.flags = yardSave;
	assert.equal( new IntroLessons( story ).update( 0 ).id, 'yard' );
	for ( let i = 0; i < 40; i ++ ) lessons.update( 1 );
	assert.equal( lessons.update( 0 ), null ); story.beat = 'climb';
	assert.equal( lessons.update( 1 ), null, 'returning to the landing cannot repeat the first arrival' );
}
{
	const { story, lessons } = watch();
	story.app.player.position = { x: 5, y: 10, z: 10 };
	assert.equal( lessons.update( 1 ), null, 'approach lore waits until the hilltop reveal has completed' );
	story.flags.islandRevealSeen = true;
	assert.equal( lessons.update( 1 ), null, 'approach stays quiet after the hilltop scene' );
	story.beat = 'letter'; assert.equal( lessons.update( 1 ), null, 'intro ends before lighthouse duties' );
	story.beat = 'light'; lessons.afterBoardLetter();
	for ( let i = 0; i < 6; i ++ ) lessons.update( 1 );
	assert.equal( lessons.update( 0 ).id, 'station', 'working-station history follows the Board letter' );
	lessons.afterBoardLetter(); assert.equal( story.flags.introLessons.pending.length, 0, 'rereading cannot duplicate the history tip' );
	delete story.flags.introLessons; story.beat = 'room';
	assert.equal( lessons.update( 1 ), null, 'legacy saves already in the house do not replay an intro' );
}
assert.equal( new Set( INTRO_PAPERS.map( p => p.id ) ).size, INTRO_PAPERS.length );
{
	const { story, lessons } = watch();
	lessons.update( 1 );
	story.flags.introLessons.pending.push( 'rails', 'shore' );
	lessons.finishClimb();
	assert.equal( story.flags.introLessons.active, null, 'crest clears the visible stair note' );
	assert.deepEqual( story.flags.introLessons.pending, [], 'crest clears the stair backlog' );
	story.flags.islandRevealSeen = true;
	story.app.player.position = { x: 0, y: 8, z: 8 };
	for ( let i = 0; i < 10; i ++ ) assert.equal( lessons.update( 1 ), null, 'stair notes cannot replay after the cutscene' );
	story.app.player.position = { x: 5, y: 10, z: 10 };
	assert.equal( lessons.update( 1 ), null, 'station lore has moved away from the musical walk' );
}
{
	const { story, lessons } = watch(); lessons.finishClimb();
	story.flags.islandRevealSeen = true; story.beat = 'room';
	story.islandReveal = { quietWalk: true };
	const gap = story.flags.introLessons.gap;
	for ( let i = 0; i < 50; i ++ ) assert.equal( lessons.update( 1 ), null, 'no arrival captions during the musical walk' );
	assert.equal( story.flags.introLessons.gap, gap, 'music does not consume deferred caption time' );
	story.beat = 'light'; lessons.afterBoardLetter();
	assert.equal( lessons.update( 1 ), null, 'reading the letter early still respects the music' );
	story.islandReveal.quietWalk = false;
	for ( let i = 0; i < 6; i ++ ) lessons.update( 1 );
	assert.equal( lessons.update( 0 ).id, 'station' );
}
for ( const cue of INTRO_CLIMB ) assert.ok( INTRO_PAPERS.some( p => p.id === cue.topic ), 'every caption has a rereadable explanation' );
for ( const paper of INTRO_PAPERS ) assert.ok( paper.provenance && paper.sources.every( s => s.url.startsWith( 'https://' ) ), 'source and reconstruction notes accompany the lesson' );
console.log( 'PASS intro route gates, readable pacing, quiet gaps, pause/resume, save continuation, yard closure and provenance.' );
