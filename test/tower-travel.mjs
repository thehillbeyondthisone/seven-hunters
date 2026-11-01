import assert from 'node:assert/strict';
import { fixture, TOWER as T, mobileAction } from './helpers/morning-fixture.mjs';

const f = await fixture(), { s, app, player: p, camera, keys, colliders, place, face } = f;
app.input.keys = keys; // exercise the real modal input cleanup with the fixture's key set
const at = ( r, a ) => [ Math.cos( a ) * r, Math.sin( a ) * r ];
const radius = () => Math.hypot( p.position.x, p.position.z );
const G = T.gallery, lane = ( G.ledgeOuter + G.rail - G.railTube ) / 2;
for ( const d of f.st.parts.doors ) { d.block.solid = false; d.open = d.target = 1; }

function walk( x, z, dt, blocked = false ) {
	keys.add( 'KeyW' );
	let reached = false;
	for ( let t = 0; t < 3; t += dt ) {
		const dx = x - p.position.x, dz = z - p.position.z;
		if ( Math.hypot( dx, dz ) < 0.055 ) { reached = true; break; }
		p.yaw = Math.atan2( -dx, -dz ); p.update( dt );
		assert( Math.abs( p.position.y - T.deck ) < 0.015, 'balcony and door retain continuous floor support' );
		assert( radius() <= G.rail - G.railTube - 0.3 + 1e-6, 'capsule stays inside visible railing' );
	}
	keys.clear();
	if ( ! blocked ) assert( reached, `walk reached (${ x.toFixed( 2 ) }, ${ z.toFixed( 2 ) }), at ${ p.position.toArray() }` );
	return reached;
}

for ( const fps of [ 30, 60, 120 ] ) {
	for ( const direction of [ 1, -1 ] ) {
		place( ...[ at( 1.8, T.galleryDoor )[ 0 ], T.deck, at( 1.8, T.galleryDoor )[ 1 ] ] );
		walk( ...at( lane, T.galleryDoor ), 1 / fps );
		for ( let i = 1; i <= 240; i++ ) {
			const a = T.galleryDoor + direction * i / 240 * Math.PI * 2;
			walk( ...at( lane, a ), 1 / fps );
			const fromDoor = Math.abs( Math.atan2( Math.sin( a - T.galleryDoor ), Math.cos( a - T.galleryDoor ) ) );
			if ( fromDoor > 0.3 ) assert( radius() >= G.ledgeOuter + 0.3 - 1e-5, 'body and head clear visible lantern ledge' );
		}
		walk( ...at( 1.8, T.galleryDoor ), 1 / fps );
		assert( radius() < 1.9, 'return through the real gallery door' );
	}
	place( ...[ at( lane, T.galleryDoor + 1 )[ 0 ], T.deck, at( lane, T.galleryDoor + 1 )[ 1 ] ] );
	assert.equal( walk( ...at( 2.65, T.galleryDoor + 1 ), 1 / fps, true ), false );
	assert( radius() >= G.ledgeOuter + 0.3 - 1e-5, 'cannot stand in the painted wall or ledge' );
	assert.equal( walk( ...at( 5, T.galleryDoor + 1 ), 1 / fps, true ), false );
	console.log( `PASS ${ fps }fps: full balcony loop in both directions, doorway return, visible wall/ledge clearance and railing containment.` );
}

// A shut gallery door still blocks both sides after the wall collision changes.
const gallery = f.st.parts.doors.find( d => d.name === 'gallery' );
gallery.block.solid = true;
place( ...[ at( 1.8, T.galleryDoor )[ 0 ], T.deck, at( 1.8, T.galleryDoor )[ 1 ] ] );
assert.equal( walk( ...at( lane, T.galleryDoor ), 1 / 60, true ), false );
assert( radius() < 2.2 );
place( ...[ at( lane, T.galleryDoor )[ 0 ], T.deck, at( lane, T.galleryDoor )[ 1 ] ] );
assert.equal( walk( ...at( 1.8, T.galleryDoor ), 1 / 60, true ), false );
assert( radius() > 2.6 );
console.log( 'PASS shut gallery door blocks passage from inside and outside.' );
const signalStand = T.signalStand.clone(); colliders.resolveCapsule( signalStand, .3, 1.75, .4 );
assert( signalStand.distanceTo( T.signalStand ) < 1e-6, 'signal lamp standing point clears the balcony wall and ledge' );

const travel = s.towerTravel;
assert( colliders.surfaces.filter( surface => surface.tag === 'stair' ).every( surface => ! surface.enabled ), 'spiral cannot be climbed manually' );
assert( colliders.boxes.filter( box => box.tag === 'hatchStair' ).every( box => ! box.walkable ), 'hatch steps cannot be traversed manually' );
assert.equal( colliders.boxes.filter( box => box.tag === 'towerTravelGuard' ).length, 0, 'no invented stair gates' );
assert.equal( colliders.boxes.filter( box => box.tag === 'towerTravelThreshold' ).length, 2, 'safe automatic travel thresholds at both entrances' );
const actualTravel = s.ui.travel.bind( s.ui );
let visibleWalkFrames = 0, blackWordFrames = 0, steps = 0, previousFrame;
let departureEye, previousHeight, goingUp;
p.audio = { footstep: () => steps++ };
s.ui.travel = ( label, move, animate ) => actualTravel( label, () => {
	assert.equal( s.ui.layer.children.at( -1 ).style.opacity, '1', 'destination changes under a fully opaque fade' ); move();
}, ( progress, arrived ) => {
	animate( progress, arrived );
	const fade = s.ui.layer.children.at( -1 ), words = fade.children[ 0 ];
	if ( previousFrame && arrived === previousFrame.arrived ) {
		const seconds = ( progress - previousFrame.progress ) * 5.6;
		if ( seconds > 0 ) {
			assert( camera.position.distanceTo( previousFrame.eye ) / seconds < 5, 'visible camera path has no position snap' );
			const dot = Math.abs( camera.quaternion.dot( previousFrame.rotation ) );
			const turnSpeed = 2 * Math.acos( Math.min( 1, dot ) ) / seconds;
			assert( turnSpeed < 4, `camera turns smoothly without a fast spin (${ turnSpeed.toFixed( 2 ) } rad/s at ${ progress.toFixed( 3 ) }, up=${ goingUp })` );
		}
	}
	previousFrame = { progress, arrived, eye: camera.position.clone(), rotation: camera.quaternion.clone() };
	if ( progress > .25 && progress < .275 ) {
		assert.equal( fade.style.opacity, '0', 'the first footsteps are visible before the fade starts' );
		assert.equal( words.style.opacity, '0', 'journey words wait for black' );
		assert( Math.hypot( camera.position.x - departureEye.x, camera.position.z - departureEye.z ) > .15, 'camera walks into the stairs before fading' );
		assert( goingUp ? camera.position.y > departureEye.y : camera.position.y < departureEye.y, 'camera follows the first step up or down' );
		visibleWalkFrames ++;
	}
	if ( ! arrived ) {
		const rise = ( camera.position.y - previousHeight ) * ( goingUp ? 1 : -1 );
		if ( app.settings.cameraBob === false ) assert( rise >= -1e-6, 'bob off gives a smooth stair step without head oscillation' );
		previousHeight = camera.position.y;
	}
	if ( progress > .43 && progress < .56 ) {
		assert.equal( fade.style.opacity, '1', 'journey words appear against full black' );
		assert.equal( words.style.opacity, '.85' );
		assert.equal( words.textContent, goingUp ? 'You climb the iron stair to the lantern.' : 'You descend the iron stair to the keeper’s room.' );
		blackWordFrames ++;
	}
} );
place( travel.bottom.x, travel.bottom.y, travel.bottom.z );
const before = JSON.stringify( { h: s.h, beat: s.beat, flags: s.flags, rows: s.rows, lamp: app.lamp.wind, hand: s.hand.carried } );
for ( const up of [ true, false, true, false ] ) {
	app.settings.cameraBob = up;
	p.bob = 0; p.update( 0 );
	const item = s.interact.get( up ? 'towerUp' : 'towerDown' );
	face( item.at );
	assert.equal( s.interact.pick()?.id, item.id, 'quick journey is selectable at actual stair end' );
	s.interact.update( 0 );
	assert.match( p.prompt.detail, /automatically/, 'stair prompt explains that one press handles the walking' );
	assert.equal( mobileAction( app ).target, item.id, 'same journey is offered by mobile action button' );
	assert.match( mobileAction( app ).detail, /automatically/, 'touch players also see that no manual stair walking is needed' );
	departureEye = camera.position.clone(); previousHeight = camera.position.y; goingUp = up; previousFrame = null;
	const visibleBefore = visibleWalkFrames, wordsBefore = blackWordFrames;
	// Normal play's coastal safety controller pauses Player.update throughout
	// travel. A destination pose must not depend on that update being allowed.
	const safety = p.safety;
	p.safety = { paused: true };
	const started = performance.now(), done = travel.go( up );
	assert( travel.active && s.paused && p.busy && ! app.input.enabled && s.ui.open, 'fade freezes input, clock and interactions' );
	assert.equal( await travel.go( up ), false, 'repeated presses cannot start another trip' );
	assert.equal( await done, true );
	assert( performance.now() - started >= 5580, 'each direction leaves time for a gentle tread path and arrival' );
	assert( visibleWalkFrames > visibleBefore, 'each trip shows the first steps before fading' );
	assert( blackWordFrames > wordsBefore, 'each trip holds its words on black' );
	assert( ! travel.active && ! s.paused && ! p.busy && app.input.enabled && ! s.ui.open );
	const destination = up ? travel.top : travel.bottom;
	assert( p.position.distanceTo( destination ) < 1e-6, 'arrives on safe supported floor' );
	const resolved = p.position.clone(); colliders.resolveCapsule( resolved, .3, 1.75, .4 );
	assert( resolved.distanceTo( p.position ) < 1e-6, 'arrival has no wall, machinery or hatch-rail overlap' );
	assert( Math.abs( camera.position.y - p.position.y - 1.62 ) < 1e-6, 'arrival resets stair camera smoothing' );
	assert( Math.hypot( camera.position.x - p.position.x, camera.position.z - p.position.z ) < 1e-6, 'arrival camera stays at the destination while the safety controller is paused' );
	const handoffEye = camera.position.clone(), handoffRotation = camera.quaternion.clone();
	p.safety = safety; p.update( 0 );
	assert( camera.position.distanceTo( handoffEye ) < 1e-6, 'resuming the walker never snaps back from the departure end' );
	assert( Math.abs( camera.quaternion.dot( handoffRotation ) ) > 1 - 1e-10, 'resuming the walker preserves the arrival gaze' );
	assert.equal( p.velocity.length(), 0 );
}
assert( steps >= 32, 'paced footsteps accompany the visible and hidden parts of both directions' );

// Walking into the lower entrance starts ascent. The crank and hatch share
// the upper circulation route, so descent requires a fresh action press.
const actualGo = travel.go;
let automatic = null;
travel.go = up => { automatic = up; return true; };
const atEntrance = at( 1.35, T.start - .3 );
place( atEntrance[ 0 ], T.floor, atEntrance[ 1 ] );
p.yaw = Math.PI - T.start; keys.add( 'KeyW' );
assert.equal( travel.update(), true ); assert.equal( automatic, true );
automatic = null; s.update( 0 );
assert.equal( automatic, true, 'morning chapter dispatches the automatic entrance journey' );
p.yaw += Math.PI; automatic = null;
assert.equal( travel.update(), false, 'walking away does not trigger a journey' );
keys.clear();
const H = T.hatch, run = H.run + .38;
place( Math.cos( H.angle ) * H.r - Math.sin( H.angle ) * run, T.deck, Math.sin( H.angle ) * H.r + Math.cos( H.angle ) * run );
p.yaw = -H.angle; p.pitch = 0; app.input.move = { x: 0, y: 1 };
automatic = null;
assert.equal( travel.update(), false, 'walking past the hatch while looking ahead never starts a descent' );
p.pitch = -.45;
assert.equal( travel.update(), false, 'looking down while walking toward the crank cannot start a descent' );
assert.equal( automatic, null );
app.input.move.y = -1; automatic = null;
assert.equal( travel.update(), false, 'touch movement away from hatch is safe' );
app.input.move = null;
for ( const fps of [ 30, 60, 120 ] ) {
	const up = true;
	const foot = up ? travel.bottom : travel.top;
	place( foot.x, foot.y, foot.z ); face( s.interact.get( up ? 'towerUp' : 'towerDown' ).at );
	automatic = null; keys.add( 'KeyW' );
	for ( let frame = 0; frame < fps * 2 && automatic === null; frame++ ) { p.update( 1 / fps ); travel.update(); }
	keys.clear();
	assert.equal( automatic, up, `${ fps }fps: real collision walking hands ${ up ? 'ascent' : 'descent' } to automatic travel` );
}
for ( const fps of [ 30, 60, 120 ] ) {
	place( travel.top.x, travel.top.y, travel.top.z ); face( s.interact.get( 'towerDown' ).at );
	automatic = null; keys.add( 'KeyW' ); keys.add( 'KeyE' );
	for ( let frame = 0; frame < fps; frame++ ) { p.update( 1 / fps ); travel.update(); s.interact.update( 1 / fps ); }
	keys.clear();
	assert.equal( automatic, null, `${ fps }fps: walking or continuing to hold the crank action never descends` );
	assert( Math.abs( p.position.y - T.deck ) < .015, 'the hatch threshold still supports a walking player' );
}
place( travel.top.x, travel.top.y, travel.top.z ); face( s.interact.get( 'towerDown' ).at );
automatic = null; s.interact.update( 0 );
assert.equal( s.interact.current.id, 'towerDown', 'a deliberate stair target remains selectable' );
f.taps.add( 'KeyE' ); s.interact.update( 0 );
assert.equal( automatic, false, 'a fresh E or touch action starts the descent' );
travel.go = actualGo;

// Thresholds prevent free walking into the open hatch when the action is
// unavailable (pause, looking through equipment, or another task).
const threshold = colliders.boxes.find( box => box.tag === 'towerTravelThreshold' && box.center.y > T.deck );
const stopped = threshold.center.clone().setY( T.deck );
assert( colliders.resolveCapsule( stopped, .3, 1.75, .4 ), 'open hatch retains a safety boundary' );
place( 1.2, ( T.floor + T.deck ) / 2 + 1, 0 ); travel.restorePosition();
assert( p.position.distanceTo( travel.top ) < 1e-6, 'old mid-stair save safely resumes at the nearer playable level' );
assert.equal( JSON.stringify( { h: s.h, beat: s.beat, flags: s.flags, rows: s.rows, lamp: app.lamp.wind, hand: s.hand.carried } ), before, 'journeys preserve duties, watch clock, story and held lamp' );
place( 3.3, T.deck, 0 ); assert.equal( travel.canUse( false ), false, 'cannot descend from outside the lantern wall' );
const opposite = at( 1, T.start + Math.PI );
place( opposite[ 0 ], T.floor, opposite[ 1 ] ); face( s.interact.get( 'towerUp' ).at );
assert.equal( travel.canUse( true ), false, 'cannot pull the approach camera through the weight tube from across the tower' );
assert.notEqual( s.interact.pick()?.id, 'towerUp' );
place( travel.bottom.x, T.floor + 1.5, travel.bottom.z ); assert.equal( travel.canUse( true ), false, 'journey is only available at the stair end' );
place( travel.bottom.x, T.floor, travel.bottom.z );
app.mobile = { paused: true }; assert.equal( travel.canUse( true ), false ); app.mobile = null;
s.ui.modal = 1; assert.equal( travel.canUse( true ), false ); s.ui.modal = 0;
assert.equal( s.saveKey, 'sevenhunters.morning-servicing-preview.first.v1', 'checks use an isolated save slot' );
console.log( 'PASS repeated quick trips, real target picking, mobile prompt, fade lock, safe arrivals, camera reset and unchanged watch/duty state.' );

// Morning study intentionally disables telescope collection. Exercise its real
// story predicate in the first-watch preview instead of enabling a test stub.
const firstWatch = await fixture( false, { search: 'keeperPreview' } );
const top = firstWatch.s.towerTravel.top;
firstWatch.place( top.x, top.y, top.z ); firstWatch.face( T.telescope );
assert( firstWatch.s.interact.get( 'telescope' ).when(), 'first watch has a telescope available on its sill' );
assert.notEqual( firstWatch.s.interact.pick()?.id, 'telescope', 'even looking at the telescope from the stair arrival does not produce its prompt' );
const telescopeAngle = Math.atan2( T.telescope.z, T.telescope.x );
firstWatch.place( Math.cos( telescopeAngle ) * 1.55, T.deck, Math.sin( telescopeAngle ) * 1.55 ); firstWatch.face( T.telescope );
assert.equal( firstWatch.s.interact.pick()?.id, 'telescope', 'approaching the sill offers the telescope normally' );
console.log( 'PASS telescope waits for a deliberate approach from the stair arrival.' );
