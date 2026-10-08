import assert from 'node:assert/strict';
import { Vector3, Color, PerspectiveCamera } from '../src/engine/index.js';
import { stationAcoustics } from '../src/world/flannan/StationAcoustics.js';
import { stationLightBounds } from '../src/world/flannan/StationLighting.js';
import { ROOM, TOWER } from '../src/world/flannan/Station.js';
import { LocalLights, localLightsModule, addVillageLights } from '../src/materials/LocalLights.js';
import { Lamp } from '../src/station/Lamp.js';
import { StationSound } from '../src/audio/StationSound.js';
import { G } from '../src/engine/render/Frame.js';

const T = TOWER, p = new Vector3( 1.7, T.floor + 1.62, -1.3 );
const lower = stationAcoustics( p ); p.y = T.landing + 1.62;
const upper = stationAcoustics( p ); p.y = T.deck + 1.62;
const lantern = stationAcoustics( p );
assert.ok( lower.shaft && lower.clockAudibility > upper.clockAudibility, 'clock carries into the stair foot then fades up the shaft' );
assert.ok( upper.machineAudibility > lower.machineAudibility && lantern.machineAudibility > upper.machineAudibility, 'machine approaches audibly while climbing' );
assert.ok( lantern.shelter > .4 && lantern.shelter < .7, 'glazed lantern is partially sheltered' );
p.set( Math.cos( T.galleryDoor ) * 2.05, T.deck + 1.62, Math.sin( T.galleryDoor ) * 2.05 );
assert.ok( stationAcoustics( p, 0, 1 ).shelter < stationAcoustics( p, 0, 0 ).shelter * .5, 'open gallery door admits the gale' );
let previous = stationAcoustics( p ).shelter;
for ( let y = T.deck - .8; y <= T.deck + .8; y += .01 ) {
	p.set( 1.7, y, -1.3 ); const next = stationAcoustics( p ).shelter;
	if ( y > T.deck - .79 ) assert.ok( Math.abs( next - previous ) < .025, 'no shelter switch through the hatch' );
	previous = next;
}
previous = null;
for ( let r = 2.04; r <= 3; r += .01 ) {
	p.set( Math.cos( T.galleryDoor ) * r, T.deck + 1.62, Math.sin( T.galleryDoor ) * r );
	const next = stationAcoustics( p ).shelter;
	if ( previous !== null ) assert.ok( Math.abs( next - previous ) < .025, 'gallery threshold blends continuously' );
	previous = next;
}
assert.equal( stationAcoustics( p ).shelter, 0, 'walkway is exposed' );

const lights = new LocalLights(); G.night.value = 1;
const source = { position: new Vector3( -6, T.floor + 1.4, 1 ), color: new Color( 1, .7, .4 ), intensity: 4, range: 5, kind: 'lamp', dir: new Vector3( 0, -1, 0 ), cosInner: .2, cosOuter: -.7, flicker: .025 };
addVillageLights( lights, { getLightSources: () => [ source ] } );
const light = lights.sources[ 0 ]; light.bounds = stationLightBounds( light.position );
const camera = new PerspectiveCamera( 70, 1, .1, 100 ); camera.position.copy( light.position );
lights.update( camera, 1 / 60 );
const u = localLightsModule.bindings.localLights.uniform.fields;
assert.equal( light.cosInner, .2, 'authored lamp cone survives village light conversion' );
assert.equal( light.flicker, .025, 'gentle oil-lamp flicker survives conversion' );
assert.equal( u.boundMin.value[ 0 ].x, ROOM.x0 - .05 );
light.bounds = null; lights.update( camera, 1 / 60 );
assert.equal( u.boundMin.value[ 0 ].w, 0, 'unbounded light cannot inherit the previous room mask' );
light.always = true; G.night.value = 0; lights.update( camera, 1 / 60 );
assert.ok( lights.active > 0 && u.col.value[ 0 ].x > 0, 'state-controlled burner can illuminate its space in daylight' );
light.scale = 0; lights.update( camera, 1 / 60 );
assert.equal( lights.active, 0, 'extinguished state-controlled burner contributes no light' );
assert.equal( stationLightBounds( new Vector3( 20, T.floor + 1.4, 20 ) ), null, 'outside light remains unbounded' );

const burner = { uniforms: { glow: { value: 0 } } }, lens = { rotation: { y: 0 } };
const lamp = new Lamp( { lens, burnerMaterial: burner } ); lamp.wind = 1; lamp.start(); lamp.ignite();
lamp.update( 20, .1 );
assert.equal( burner.uniforms.glow.value, 1, 'flame reaches brightness with the burner' );
assert.ok( lens.rotation.y !== 0, 'the independent optic revolves' );
lamp.stop(); lamp.extinguish(); lamp.update( 4, 0 );
assert.equal( burner.uniforms.glow.value, 0, 'extinguished flame disappears while optic coasts' );

// Exercise actual audio graph construction, scheduling and room ramps. This
// verifies routing/state, not the perceptual result on speakers/headphones.
const param = () => ( { value: 0, setValueAtTime( v ) { this.value = v; }, linearRampToValueAtTime( v ) { this.value = v; }, setTargetAtTime( v ) { this.value = v; } } );
const nodes = [];
const node = () => { const n = { edges: [], gain: param(), frequency: param(), Q: param(), delayTime: param(), positionX: param(), positionY: param(), positionZ: param(), connect( to ) { this.edges.push( to ); return to; }, disconnect() { this.edges = []; }, start() {}, stop() {} }; nodes.push( n ); return n; };
const ctx = { sampleRate: 8000, currentTime: 1, createGain: node, createBiquadFilter: node, createDelay: node, createBufferSource: node, createBuffer: ( channels, length ) => ( { getChannelData: () => new Float32Array( length ) } ) };
const scape = { enabled: true, ctx, aboveOut: node(), _panner( dest ) { const p = node(); p.connect( dest ); return p; }, _ramp( p, v ) { p.value = v; } };
const sound = new StationSound( scape, { tower: { ...T, crank: new Vector3( .7, T.deck + 1, 0 ) } } );
const state = ( position ) => ( { ...stationAcoustics( position ), listener: position, roomClock: new Vector3( -2.2, T.floor + 2.55, ROOM.z1 - .06 ), lensTurning: true, lampGlow: 1, cliffSynced: true } );
p.set( 1.7, T.landing + 1.62, -1.3 ); sound.update( 1 / 60, state( p ) );
assert.ok( sound.machineBus.echo.gain.value > .1, 'stone shaft contributes an early machinery reflection' );
assert.ok( sound.machineBus.filter.frequency.value < 3000, 'hatch muffles distant high machinery frequencies' );
p.set( 1.7, T.deck + 1.62, -1.3 ); sound.update( 1 / 60, state( p ) );
assert.ok( sound.machineBus.filter.frequency.value > 5000, 'nearby lantern machinery is clear' );
p.set( 3, T.deck + 1.62, 0 ); sound.update( 1 / 60, state( p ) );
assert.equal( sound.machineBus.echo.gain.value, 0, 'open walkway loses the stone reflection' );
for ( const start of nodes ) {
	const visit = ( n, path ) => { assert.ok( !path.has( n ), 'reflections have no feedback loop' ); const next = new Set( path ); next.add( n ); for ( const edge of n.edges ) visit( edge, next ); };
	visit( start, new Set() );
}
console.log( 'PASS continuous hatch/gallery acoustics, door-dependent wind, distance-shaped clockwork, lamp cones/room masks, fixed burner state, and bounded audio reflections.' );
