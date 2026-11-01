// Real station geometry, interactions and save migration; no replacement gate model.
import assert from 'node:assert/strict';
import { fixture, E, STATION, TOWER } from './helpers/morning-fixture.mjs';
import { updateDoor } from '../src/world/flannan/Station.js';
import { GateWorkProps } from '../src/world/flannan/GateWorkProps.js';
import { Watcher } from '../src/story/Watcher.js';
import { GATE_REVEAL_SECONDS, GATE_REVEAL_LEAN, GATE_REVEAL_FOV, GATE_FOCUS_EXPOSURE } from '../src/story/FirstWatchRevision.js';

const f = await fixture( false, { search: 'keeperPreview', morningStudy: false } );
const { s, app, player, camera, keys, face, place } = f;
s.flags.unpacking = { stage: 4, examined: true }; s.unpacking.sync();
s.flags.keeperRoutine = true;
Object.assign( s.keeper.state, { inspected: true, verified: true, rewound: true, driveCutsceneSeen: true } );
s.flags.firstLightMilestone = 15.2; s.flags.talked = true;
s.lamp.ignite(); s.lamp.wind = 1; s.lamp.start();
s.watcher = new Watcher(); s.watcher.state = 'done'; s.paused = false; s.h = 18; s.beat = 'evening';
for ( const name of [ 'gate', 'southGate' ] ) {
 assert.equal( s.doors[ name ].length, 2, `${name} has two independently authored leaves` );
 for ( const d of s.doors[ name ] ) { d.obj = new E.Group(); updateDoor( d, 0 ); assert.equal( d.block.tag, 'door-' + name ); }
}
assert.ok( s.doors.gate.every( d => Math.abs( d.hinge.x - 12.75 ) < .01 ) );
assert.ok( s.doors.southGate.every( d => Math.abs( d.hinge.z - STATION.southGate.z ) < .01 ) );
assert.ok( s.doors.southGate.every( d => ! s.doors.gate.includes( d ) && ! s.doors.gate.some( e => e.block === d.block ) ) );

// Instantiate the exported binding meshes without a GPU so their state predicates
// are checked alongside the actual named door pairs.
app.village.materials = { hard: {}, stationTimber: {} }; app.village.group = new E.Group();
s.gateWork = new GateWorkProps( s );
assert.equal( s.gateWork.gates.length, 2 );
const props = index => s.gateWork.gates.find( g => g.index === index );
const settle = () => { for ( let i = 0; i < 150; i ++ ) for ( const d of s.moving.doors ) updateDoor( d, 1 / 60 ); s.gateWork.update(); };

s.firstWatch.secureGate( 1, { reason: 'preparation-check' } );
assert.ok( s.flags.gateRopes[ 1 ].secured );
s._toggle( 'gate' );
assert.ok( s.doors.gate.every( d => d.target === 1 ), 'opening east moves BOTH east leaves' );
assert.ok( s.doors.southGate.every( d => d.target === 0 ) && s.flags.gateRopes[ 1 ].secured, 'opening east cannot clear the south binding' );
settle(); assert.ok( s.doors.gate.every( d => ! d.block.solid ) );
assert.equal( props( 1 ).wrapped.visible, true );

s.firstWatch.afterContact();
place( STATION.eastGate.x - 1.2, STATION.yard, STATION.eastGate.z ); face( s.interact.get( 'gate' ).at );
assert.equal( s.interact.pick()?.id, 'gate' );
keys.add( 'KeyE' ); for ( let i = 0; i < 50; i ++ ) s.interact.update( 1 / 60 ); keys.clear(); s.interact.update( 0 );
assert.equal( s.beat, 'gate-secure', 'release before the wrap finishes leaves the task available' );
keys.add( 'KeyE' ); for ( let i = 0; i < 115; i ++ ) s.interact.update( 1 / 60 ); keys.clear(); s.interact.update( 0 );
assert.equal( s.beat, 'evening' ); settle();
assert.ok( s.doors.gate.every( d => d.target === 0 && d.open === 0 && d.block.solid ), 'both east leaves are physically shut after wrapping' );
assert.equal( props( 0 ).wrapped.visible, true );
assert.equal( props( 0 ).ready.visible, false );
assert.equal( s.rows.filter( ( [ , text ] ) => text === 'Entrance gate closed and secured with a rope wrap.' ).length, 1 );
const wrappedSave = structuredClone( s._snapshot() );
s.interact.get( 'southGate' ).use(); settle();
assert.ok( s.doors.southGate.every( d => d.target === 1 && ! d.block.solid ), 'south interaction opens both actual south leaves' );
assert.ok( s.doors.gate.every( d => d.target === 0 ) && s.flags.gateRopes[ 0 ].secured, 'south interaction leaves east gate secured' );
place( STATION.southGate.x, STATION.yard, STATION.southGate.z - 1.6 ); face( s.interact.get( 'southGate' ).at );
assert.equal( s.interact.pick()?.id, 'southGate' );
assert.equal( s.interact.get( 'southGate' ).hold, 1.2, 'closing the south gate is the quick rope action' );
keys.add( 'KeyE' ); for ( let i = 0; i < 75; i ++ ) s.interact.update( 1 / 60 ); keys.clear(); s.interact.update( 0 ); settle();
assert.ok( s.doors.southGate.every( d => d.target === 0 && d.open === 0 && d.block.solid ) && s.flags.gateRopes[ 1 ].secured, 'a physical south-gate hold closes both leaves and restores the binding' );
assert.ok( props( 1 ).wrapped.visible && s.flags.gateRopes[ 0 ].secured, 'routine south rewrapping preserves the remembered east binding' );
s._restore( wrappedSave ); settle();
assert.ok( s.doors.gate.every( d => d.target === 0 ) && s.doors.southGate.every( d => d.target === 0 ) );
assert.ok( props( 0 ).wrapped.visible && props( 1 ).wrapped.visible, 'named saves restore both physical bindings' );

// Old four-door saves only know the east pair. New south doors begin shut.
const old = structuredClone( wrappedSave ); delete old.doorStates; old.doors = [ 0, 0, 1, 0 ];
s._restore( old ); settle();
assert.deepEqual( s.doors.gate.map( d => d.target ), [ 1, 0 ] );
assert.deepEqual( s.doors.southGate.map( d => d.target ), [ 0, 0 ] );
s._restore( wrappedSave ); settle();

s.h = s.haar + .6; s.beat = 'haar';
const rail = s.firstWatch.rail, radius = Math.hypot( rail.x, rail.z );
place( rail.x / radius * 1.7, TOWER.deck, rail.z / radius * 1.7 ); face( rail );
assert.ok( ! s.interact.get( 'gateLookout' ).when(), 'the rail examination cannot start from behind the lantern glazing' );
place( rail.x * ( radius - .3 ) / radius, TOWER.deck, rail.z * ( radius - .3 ) / radius ); face( rail );
const safe = player.position.clone(); app.colliders.resolveCapsule( safe, .3, 1.75, .4 );
assert.ok( safe.distanceTo( player.position ) < .015, 'the rail standing position clears real balcony collisions' );
assert.equal( s.interact.pick()?.id, 'gateLookout' );
const home = { position: camera.position.clone(), feet: player.position.clone(), quaternion: camera.quaternion.clone(), fov: camera.fov, busy: player.busy, inputEnabled: app.input.enabled };
assert.equal( s.firstWatch.focusExposure, 1, 'the ordinary view has no reveal exposure multiplier' );
s.hand.carried = s.hand.lit = true;
const lanternBefore = structuredClone( s.hand.save() );
s.firstWatch.startReveal();
assert.equal( s.firstWatch.focusExposure, 1, 'perceptual focus starts without an exposure jump' );
assert.ok( s.cinematic && player.busy && ! app.input.enabled );
assert.ok( s.doors.gate.every( d => d.open === 1 && d.target === 1 ) );
assert.ok( s.doors.gate.every( d => Math.abs( d.obj.rotation.y - ( d.ry + d.swing ) ) < 1e-8 && ! d.block.solid ), 'the opened leaves are visibly transformed DURING the reveal, before normal Story updates resume' );
s.update( 1 );
assert.ok( s.firstWatch.focusExposure > 1 && s.firstWatch.focusExposure < GATE_FOCUS_EXPOSURE, 'the first two seconds gradually focus the ordinary game view' );
const pausedExposure = s.firstWatch.focusExposure, pausedFov = camera.fov;
s.firstWatch.updateReveal( 1, true );
assert.equal( s.firstWatch.focusExposure, pausedExposure, 'a blocked reveal pauses its exposure envelope' );
assert.equal( camera.fov, pausedFov, 'a blocked reveal pauses its camera envelope' );
s.update( 1 ); s.update( 1 );
assert.equal( s.firstWatch.focusExposure, GATE_FOCUS_EXPOSURE, 'recognition holds the approved threefold perceptual exposure' );
assert.equal( camera.fov, Math.min( home.fov, GATE_REVEAL_FOV ), 'the same head view tightens during gate recognition' );
assert.ok( s.firstWatch.shieldsLantern, 'the recognition view can use normal dark adaptation behind the carried flame' );
assert.deepEqual( s.hand.save(), lanternBefore, 'perceptual shielding cannot change the lit lantern or its inventory state' );
assert.ok( Math.abs( camera.position.distanceTo( home.position ) - GATE_REVEAL_LEAN ) < .001, 'a modest head lean clears the rail while the feet stay planted' );
assert.ok( player.position.equals( home.feet ), 'the lookdown never moves the player capsule outside the railing' );
const interruption = structuredClone( s._snapshot() );
while ( s.firstWatch.elapsed < GATE_REVEAL_SECONDS - 1 ) s.firstWatch.updateReveal( .25 );
assert.ok( s.firstWatch.focusExposure > 1 && s.firstWatch.focusExposure < GATE_FOCUS_EXPOSURE, 'focus eases back during the return' );
assert.ok( camera.fov > Math.min( home.fov, GATE_REVEAL_FOV ) && camera.fov < home.fov, 'FOV eases back with the head view' );
for ( let i = 0; i < Math.ceil( GATE_REVEAL_SECONDS ); i ++ ) s.update( 1 );
assert.equal( s.beat, 'gate' );
assert.ok( ! s.cinematic && ! player.busy && app.input.enabled );
assert.ok( camera.position.equals( home.position ) && camera.quaternion.equals( home.quaternion ) && camera.fov === home.fov );
assert.ok( ! s.firstWatch.shieldsLantern, 'normal eye response resumes when the view returns' );
assert.equal( s.firstWatch.focusExposure, 1, 'the ordinary exposure is restored exactly at the return' );
assert.ok( player.position.equals( home.feet ) && player.busy === home.busy && app.input.enabled === home.inputEnabled, 'feet and pre-reveal control states return exactly' );
assert.deepEqual( s.hand.save(), lanternBefore, 'the lantern is still lit after the reveal' );
assert.match( s.goal(), /Secure the gate/ );
assert.equal( props( 0 ).wrapped.visible, false );
assert.equal( props( 0 ).ready.visible, false, 'the unresolved later rope condition is not invented as a conspicuous loose rope' );
s._restore( interruption ); settle();
assert.equal( s.beat, 'gate' ); assert.ok( ! s.cinematic && ! player.busy && app.input.enabled );
assert.equal( s.firstWatch.focusExposure, 1, 'mid-reveal loading cannot retain perceptual focus' );
assert.deepEqual( s.hand.save(), lanternBefore, 'mid-reveal loading cannot alter the lantern state' );
place( STATION.eastGate.x - 1.2, STATION.yard, STATION.eastGate.z ); face( s.interact.get( 'gate' ).at );
keys.add( 'KeyE' ); for ( let i = 0; i < 115; i ++ ) s.interact.update( 1 / 60 ); keys.clear(); s.interact.update( 0 ); settle();
assert.equal( s.beat, 'night' ); assert.ok( s.firstWatch.state.resecured && s.flags.gateRopes[ 0 ].secured );
assert.ok( props( 0 ).wrapped.visible && s.doors.gate.every( d => d.block.solid ) );
s._restore( structuredClone( s._snapshot() ) ); settle();
assert.equal( s.beat, 'night' ); assert.ok( app.input.enabled && ! player.busy );

// A forced close, such as a scene transition, also preserves non-default input
// and FOV states instead of blindly unlocking or resetting the whole view.
const completeSave = structuredClone( s._snapshot() ), completeControls = { busy: player.busy, input: app.input.enabled };
s.beat = 'haar'; delete s.firstWatch.state.revealed; delete s.firstWatch.state.resecured;
place( rail.x * ( radius - .3 ) / radius, TOWER.deck, rail.z * ( radius - .3 ) / radius ); face( rail );
camera.fov = 50; camera.updateProjectionMatrix(); player.busy = true; app.input.enabled = false;
const interruptedHome = { position: camera.position.clone(), feet: player.position.clone(), quaternion: camera.quaternion.clone(), fov: camera.fov };
s.firstWatch.startReveal();
for ( let i = 0; i < 180; i ++ ) {
 s.firstWatch.updateReveal( 1 / 60 );
 assert.ok( s.firstWatch.focusExposure >= 1 && s.firstWatch.focusExposure <= GATE_FOCUS_EXPOSURE );
}
assert.equal( camera.fov, GATE_REVEAL_FOV );
s.firstWatch.closeReveal();
assert.ok( camera.position.equals( interruptedHome.position ) && camera.quaternion.equals( interruptedHome.quaternion ) && camera.fov === interruptedHome.fov, 'an interrupted return restores the exact incoming view' );
assert.ok( player.position.equals( interruptedHome.feet ) && player.busy && ! app.input.enabled, 'an interrupted return preserves the incoming control lock and planted feet' );
assert.equal( s.firstWatch.focusExposure, 1 );
assert.deepEqual( s.hand.save(), lanternBefore );
s._restore( completeSave ); settle(); player.busy = completeControls.busy; app.input.enabled = completeControls.input; camera.fov = home.fov; camera.updateProjectionMatrix();
place( STATION.eastGate.x - 1.2, STATION.yard, STATION.eastGate.z );
// The secured entrance does not trap Walter outside or break the climb home.
async function walkTo( x, z, label ) {
 keys.add( 'KeyW' ); let best = Infinity, stuck = 0;
 for ( let i = 0; i < 1500; i ++ ) {
  const dx = x - player.position.x, dz = z - player.position.z, distance = Math.hypot( dx, dz );
  if ( distance < .2 ) { keys.clear(); f.step( .1 ); return; }
  if ( distance < best - .03 ) { best = distance; stuck = 0; } else stuck += 1 / 60;
  assert.ok( stuck < 3, `${label}: actual walker blocked at ${player.position.toArray()}` );
  player.yaw = Math.atan2( -dx, -dz ); player.pitch = 0; f.step( 1 / 60 );
 }
 throw new Error( label + ': walking route timed out' );
}
await walkTo( 6, 6, 'gate to yard' ); await walkTo( 3, 4.6, 'house entrance' );
face( s.interact.get( 'houseDoor' ).at ); assert.equal( s.interact.pick()?.id, 'houseDoor' );
await s.interact.get( 'houseDoor' ).use(); f.step( 1 );
await walkTo( .3, 4.6, 'through house door' ); await walkTo( -2.5, 3.2, 'keepers room' );
for ( const r of [ 4, 3, 2 ] ) await walkTo( Math.cos( TOWER.doorAngle ) * r, Math.sin( TOWER.doorAngle ) * r, 'tower doorway' );
keys.clear(); face( s.interact.get( 'towerUp' ).at );
assert.ok( s.towerTravel.canUse( true ), 'the real stair entrance remains reachable after securing the gate' );
await s.towerTravel.go( true );
assert.ok( Math.abs( player.position.y - TOWER.deck ) < .01 && ! player.busy && app.input.enabled );
const travelSupport = player.groundAt( player.position.x, player.position.z, TOWER.deck + .4 );
assert.ok( Math.abs( travelSupport - TOWER.deck ) < .02, 'the return climb ends on supported lantern floor' );
console.log( 'PASS actual east/south gate pairs, independent ropes and colliders, interrupted physical hold, named/legacy saves, visible opened leaves during first-person rail reveal, exact camera/control restoration and resecure recovery.' );
