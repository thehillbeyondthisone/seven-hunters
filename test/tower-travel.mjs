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
assert.equal( colliders.boxes.filter( box => box.tag === 'towerTravelGuard' ).length, 2, 'guards mark both travel entrances' );
const actualTravel = s.ui.travel.bind( s.ui );
let animatedFrames = 0, bobFrames = 0;
s.ui.travel = ( label, move, animate ) => actualTravel( label, () => {
	assert.equal( s.ui.layer.children.at( -1 ).style.opacity, '1', 'destination changes under a fully opaque fade' ); move();
}, ( progress, arrived ) => {
	animate( progress, arrived );
	const offset = Math.abs( camera.position.y - p.position.y - 1.62 );
	if ( app.settings.cameraBob === false ) assert( offset < 1e-6, 'bob off keeps tower camera steady' );
	else if ( offset > .02 ) bobFrames ++;
	if ( progress > .05 && progress < .25 || progress > .7 && progress < .95 ) animatedFrames ++;
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
	assert.equal( mobileAction( app ).target, item.id, 'same journey is offered by mobile action button' );
	const started = performance.now(), done = travel.go( up );
	assert( travel.active && s.paused && p.busy && ! app.input.enabled && s.ui.open, 'fade freezes input, clock and interactions' );
	assert.equal( await travel.go( up ), false, 'repeated presses cannot start another trip' );
	assert.equal( await done, true );
	assert( performance.now() - started >= 1980, 'each direction animates for two seconds' );
	assert( ! travel.active && ! s.paused && ! p.busy && app.input.enabled && ! s.ui.open );
	const destination = up ? travel.top : travel.bottom;
	assert( p.position.distanceTo( destination ) < 1e-6, 'arrives on safe supported floor' );
	const resolved = p.position.clone(); colliders.resolveCapsule( resolved, .3, 1.75, .4 );
	assert( resolved.distanceTo( p.position ) < 1e-6, 'arrival has no wall, machinery or hatch-rail overlap' );
	assert( Math.abs( camera.position.y - p.position.y - 1.62 ) < 1e-6, 'arrival resets stair camera smoothing' );
	assert.equal( p.velocity.length(), 0 );
}
assert( animatedFrames > 30, 'departure and arrival are animated, not just held on a black card' );
assert( bobFrames > 10, 'bob on adds visible head motion to tower journeys' );
place( 1.2, ( T.floor + T.deck ) / 2 + 1, 0 ); travel.restorePosition();
assert( p.position.distanceTo( travel.top ) < 1e-6, 'old mid-stair save safely resumes at the nearer playable level' );
assert.equal( JSON.stringify( { h: s.h, beat: s.beat, flags: s.flags, rows: s.rows, lamp: app.lamp.wind, hand: s.hand.carried } ), before, 'journeys preserve duties, watch clock, story and held lamp' );
place( 3.3, T.deck, 0 ); assert.equal( travel.canUse( false ), false, 'cannot descend from outside the lantern wall' );
place( travel.bottom.x, T.floor + 1.5, travel.bottom.z ); assert.equal( travel.canUse( true ), false, 'journey is only available at the stair end' );
place( travel.bottom.x, T.floor, travel.bottom.z );
app.mobile = { paused: true }; assert.equal( travel.canUse( true ), false ); app.mobile = null;
s.ui.modal = 1; assert.equal( travel.canUse( true ), false ); s.ui.modal = 0;
assert.equal( s.saveKey, 'sevenhunters.morning-servicing-preview.first.v1', 'checks use an isolated save slot' );
console.log( 'PASS repeated quick trips, real target picking, mobile prompt, fade lock, safe arrivals, camera reset and unchanged watch/duty state.' );
