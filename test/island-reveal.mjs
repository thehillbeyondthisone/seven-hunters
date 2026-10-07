import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from '../src/engine/index.js';
import { IslandReveal, ISLAND_REVEAL_SECONDS, ISLAND_REVEAL_SPEED } from '../src/story/IslandReveal.js';
import { Setting } from '../src/sky/Setting.js';
import { RevealMusic } from '../src/audio/RevealMusic.js';

function fixture() {
	const camera = new PerspectiveCamera( 70, 16 / 9, 0.1, 1000 );
	const player = { position: new Vector3( 60, 75, 25 ), velocity: new Vector3(), grounded: true, mode: 'walk', yaw: 1.15, pitch: .12 };
	camera.position.copy( player.position ); camera.position.y += 1.6;
	const input = { enabled: true, consumeLook: () => ( { x: 400, y: 200 } ), reset() { this.resetCount = ( this.resetCount || 0 ) + 1; } };
	const app = { camera, player, input, freeCam: false, ui: { ui: {} }, mobile: { paused: false }, wildlife: {} };
	const story = { app, beat: 'climb', flags: { landed: true }, paused: false, ui: { open: false, islandReveal() {} },
		station: { focal: 100, landings: { east: { dir: [ .927, .375 ], steps: { to: { x: 60, y: 75, z: 25 } } } } }, save() {} };
	return { app, story, reveal: new IslandReveal( story ) };
}

for ( const fps of [ 30, 60, 120 ] ) {
	const { app, story, reveal } = fixture();
	assert.ok( reveal.start() );
	const feet = app.player.position.clone(); let last = app.camera.quaternion.clone(), peak = 0;
	for ( let i = 0; i < fps * ( ISLAND_REVEAL_SECONDS + 1 ) && reveal.active; i ++ ) {
		reveal.update( 1 / fps );
		peak = Math.max( peak, 2 * Math.acos( Math.min( 1, Math.abs( last.dot( app.camera.quaternion ) ) ) ) );
		last.copy( app.camera.quaternion );
		assert.equal( app.player.position.distanceTo( feet ), 0, 'feet stay fixed' );
		assert.equal( app.camera.fov, 70, 'no zoom' );
		assert.ok( Math.abs( app.camera.position.y - feet.y - 1.62 ) < .04, 'standing eye, subtle breathing only' );
	}
	assert.ok( peak < 0.045, 'no camera discontinuity, including the 180-degree boundary' );
	assert.ok( story.flags.islandRevealSeen && app.input.enabled );
	const musicTime = reveal.cueElapsed; reveal.update( 2 );
	assert.ok( reveal.cueElapsed > musicTime, 'cue continues after camera handoff' );
	assert.equal( reveal.start(), false, 'one time per story' );
	console.log( `PASS ${ fps }fps: smooth full turn, fixed feet, normal FOV and single control handoff.` );
}

{
	const { reveal } = fixture(); reveal.start(); reveal.update( 21 );
	assert.equal( ISLAND_REVEAL_SECONDS, 28 );
	assert.ok( reveal.active, '0.75x camera is still active after 21 real seconds' );
	assert.equal( reveal.state.elapsed, 21 * ISLAND_REVEAL_SPEED );
	assert.equal( reveal.gulls.elapsed, reveal.state.elapsed, 'gulls share the slowed camera clock' );
	assert.equal( reveal.cueElapsed, 21, 'music keeps its original speed' );
	reveal.update( 7 );
	assert.equal( reveal.active, false, 'control returns after 28 real seconds' );
	assert.equal( reveal.cueElapsed, 28 );
	assert.ok( reveal.quietWalk, 'music owns the quiet walking interval after handoff' );
	const birdTime = reveal.gulls.elapsed; reveal.update( 2 );
	assert.equal( reveal.gulls.elapsed, birdTime + 2 * ISLAND_REVEAL_SPEED, 'gulls keep their speed after control returns' );
	reveal.update( 15 ); assert.equal( reveal.quietWalk, false, 'quiet walking ends with the music cue' );
}

{
	const { app, story, reveal } = fixture(); app.qs = new URLSearchParams( 'islandRevealPreview' );
	story._placeAtRevealCrest = () => { app.player.position.set( 60, 75, 25 ); app.player.yaw = 1.15; app.player.pitch = .12; app.player.grounded = true; };
	assert.ok( reveal.replay(), 'preview can replay without reloading' );
	reveal.update( 28 ); assert.equal( reveal.active, false );
	assert.ok( reveal.replay(), 'completed preview can replay again' );
	assert.equal( reveal.cueElapsed, 0 );
	assert.ok( reveal.seek( 14 ) ); const pose = app.camera.quaternion.clone();
	assert.equal( reveal.state.elapsed, 10.5 );
	assert.equal( reveal.cueElapsed, 14 );
	reveal.update( 5 ); assert.equal( reveal.cueElapsed, 14, 'scrubbing pauses shot and music' );
	assert.ok( Math.abs( pose.dot( app.camera.quaternion ) ) > .999999999 );
	reveal.configure( { speed: .5, musicOffset: 4, musicDelay: 2 }, false );
	assert.equal( reveal.duration, 42 );
	assert.equal( reveal.state.elapsed, 10.5, 'speed adjustment preserves the current pose' );
	assert.equal( reveal.cueElapsed, 21, 'music resynchronizes to the retimed scene position' );
	reveal.editorPaused = false; app.devMenu = { open: true };
	reveal.update( 5 ); assert.equal( reveal.cueElapsed, 21, 'open editor freezes shot and audio' );
	app.devMenu.open = false; reveal.update( 1 ); assert.equal( reveal.cueElapsed, 22 );
	app.qs = new URLSearchParams(); const flags = JSON.stringify( story.flags );
	assert.equal( reveal.replay(), false, 'normal watch cannot be reset by replay controls' );
	assert.equal( JSON.stringify( story.flags ), flags );
}

{
	const { app, reveal } = fixture(); reveal.start(); reveal.update( 10.5 / ISLAND_REVEAL_SPEED );
	const poses = []; reveal.gulls.draw( { write: p => poses.push( p ) } );
	assert.equal( poses.length, 3, 'three real gull poses share the wildlife draw' );
	assert.ok( app.player.pitch > .1, 'brief upward glance follows the passing birds' );
	for ( const p of poses ) assert.ok( p.pos.every( Number.isFinite ) && p.pos[ 1 ] > app.camera.position.y + 4, 'birds pass above and beyond the crest' );
	assert.ok( Math.hypot( poses[ 0 ].pos[ 0 ] - app.camera.position.x, poses[ 0 ].pos[ 2 ] - app.camera.position.z ) < 15, 'closer pass at normal FOV' );
	for ( const t of [ 8.6, 10.5, 12.4 ] ) {
		reveal.state.elapsed = t; reveal.apply();
		const bird = new Vector3( ...reveal.gulls.point( t ) ).sub( app.camera.position ).normalize();
		const view = app.camera.getWorldDirection( new Vector3() );
		assert.ok( view.dot( bird ) > .99, 'head follows the flock for longer than the old brief glance' );
	}
	let previous;
	for ( let t = 12.4; t <= 21; t += .05 ) {
		reveal.state.elapsed = t; reveal.apply();
		if ( previous !== undefined ) assert.ok( app.player.yaw <= previous + 1e-9, 'birds lead directly into the lighthouse return without turning back to the bay' );
		previous = app.player.yaw;
	}
}

// Left is positive YXZ yaw even across +/-PI; the return retraces right.
for ( const heading of [ 1.15, 1.15 + Math.PI * 2, 1.15 - Math.PI * 2 ] ) {
	const { app, reveal } = fixture(); app.player.yaw = heading; reveal.start();
	const r = reveal.state;
	assert.ok( r.seaYaw > r.yaw && r.frontYaw < r.seaYaw );
	let last = app.player.yaw;
	for ( let t = 1; t <= 6; t += .1 ) {
		r.elapsed = t; reveal.apply();
		assert.ok( app.player.yaw >= last - 1e-9, 'outbound turn always goes left' ); last = app.player.yaw;
	}
	// The real arrival-day sun must fall on the chosen left arc.
	const setting = new Setting( 'flannan' ); setting.dayOffset = 19; // 3 January 1901, the arrival watch
	const sun = setting.update( 13 + 40 / 60 ).sun;
	const tau = Math.PI * 2, sunYaw = r.yaw + ( ( Math.atan2( -sun.x, -sun.z ) - r.yaw ) % tau + tau ) % tau;
	assert.ok( sunYaw > r.yaw && sunYaw < r.seaYaw, 'left turn passes the western sun' );
	for ( let t = 14; t <= 21; t += .1 ) {
		r.elapsed = t; reveal.apply();
		assert.ok( app.player.yaw <= last + 1e-9, 'return turns right to the lighthouse' ); last = app.player.yaw;
	}
}

for ( const blocker of [ 'modal', 'photo', 'mobile', 'freecam', 'airborne', 'xr', 'wrong-height', 'beside-stairs', 'later-watch', 'disabled-input' ] ) {
	const { app, story, reveal } = fixture();
	if ( blocker === 'modal' ) story.ui.open = true;
	if ( blocker === 'photo' ) app.ui.ui.photoMode = true;
	if ( blocker === 'mobile' ) app.mobile.paused = true;
	if ( blocker === 'freecam' ) app.freeCam = true;
	if ( blocker === 'airborne' ) app.player.grounded = false;
	if ( blocker === 'xr' ) app.xr = { active: true };
	if ( blocker === 'wrong-height' ) app.player.position.y -= 5;
	if ( blocker === 'beside-stairs' ) app.player.position.z += 5;
	if ( blocker === 'later-watch' ) story.beat = 'd2survey';
	if ( blocker === 'disabled-input' ) app.input.enabled = false;
	assert.equal( reveal.start(), false, blocker );
}

{
	const { app, story, reveal } = fixture(); reveal.start(); reveal.update( 9 );
	for ( const pause of [ () => { app.ui.ui.photoMode = true; }, () => { app.mobile.paused = true; }, () => { story.ui.open = true; }, () => { app.freeCam = true; } ] ) {
		pause(); reveal.update( 10 ); assert.equal( reveal.state.elapsed, 9 * ISLAND_REVEAL_SPEED );
		app.ui.ui.photoMode = app.mobile.paused = story.ui.open = app.freeCam = false;
	}
	const saved = reveal.save(), pose = app.camera.quaternion.clone();
	reveal.state = null; reveal.restore( saved );
	assert.ok( Math.abs( pose.dot( app.camera.quaternion ) ) > .999999999 );
	reveal.skip(); assert.ok( app.input.enabled && app.input.resetCount === 1 );
	assert.ok( Math.abs( pose.dot( app.camera.quaternion ) ) > .999999999, 'skip keeps current heading' );
	assert.ok( story.flags.islandRevealSeen );
}

// Pending music never touches fetch or creates a separate audio context.
const originalFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error( 'Pending cue must not request a file' ); };
new RevealMusic( () => ( { ctx: {}, master: {} } ), { file: null } ).update( 5, false );
globalThis.fetch = originalFetch;

// An approved/decoded cue uses the existing master and resumes at the current
// offset after a pause, rather than starting a second 45-second piece.
{
	const starts = [], stops = [], connections = [];
	const ctx = { state: 'running', currentTime: 10,
		createBufferSource: () => ( { connect( gain ) { return gain; }, start( time, offset ) { starts.push( offset ); }, stop() { stops.push( true ); }, disconnect() {} } ),
		createGain: () => ( { gain: { value: 0, setTargetAtTime() {}, cancelScheduledValues() {} }, connect( dest ) { connections.push( dest ); return dest; }, disconnect() {} } ),
	};
	const master = {}, music = new RevealMusic( () => ( { ctx, master } ), { file: 'approved.ogg', gain: .6, fadeIn: 2.5, fadeOut: 4, duration: 45 } );
	music.loading = true; music.buffer = { duration: 45 };
	music.update( 2, false ); music.update( 3, true ); music.update( 8, false );
	assert.deepEqual( starts, [ 2, 8 ] ); assert.equal( stops.length, 1 );
	assert.ok( connections.every( dest => dest === master ), 'shared volume and mute bus' );
	music.stop(); assert.equal( stops.length, 2 );
}
console.log( 'PASS trigger bounds, blocked modes, paused timeline, saved pose, smooth skip, pending music silence.' );

{
	const starts = [], gains = [];
	const ctx = { state: 'running', currentTime: 5,
		createBufferSource: () => ( { connect( gain ) { return gain; }, start( time, offset ) { starts.push( offset ); }, stop() {}, disconnect() {} } ),
		createGain: () => ( { gain: { value: 0, setTargetAtTime( value ) { gains.push( value ); }, cancelScheduledValues() {} }, connect( dest ) { return dest; }, disconnect() {} } ),
	};
	const music = new RevealMusic( () => ( { ctx, master: {} } ), { file: 'track.mp3', gain: .4, fadeIn: 0, fadeOut: 0, duration: 45, offset: 10, delay: 3 } );
	music.loading = true; music.buffer = { duration: 45.6 };
	music.update( 2, false ); assert.equal( starts.length, 0, 'music waits for its chosen scene start' );
	music.update( 5, false ); assert.deepEqual( starts, [ 12 ], 'music in-point and scene delay combine correctly' );
	assert.equal( gains.at( -1 ), .4, 'zero-length fades do not produce NaN' );
	assert.equal( music.end, 38.6, 'cue ends at the trimmed file end plus scene delay' );
	music.update( 6, true ); music.update( 8, false ); assert.deepEqual( starts, [ 12, 15 ], 'resuming uses the trimmed music timeline' );
	music.update( music.end, false ); assert.equal( music.source, null, 'trimmed cue stops at its actual end' );
}
console.log( 'PASS preview replay, paused scrubbing, timing adjustment, quiet walk, music in-point/delay and trimmed end.' );
