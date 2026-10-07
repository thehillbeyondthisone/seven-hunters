import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installBrowser } from '../tools/shots/browser.mjs';
import { Group, PerspectiveCamera, Vector3 } from '../src/engine/index.js';
import { parseGLB } from '../src/engine/loaders/GLTF.js';
import { Colliders } from '../src/world/Colliders.js';
import { DevArmory } from '../src/dev/DevArmory.js';
import { traceWeapon } from '../src/dev/WeaponTrace.js';

const bytes = readFileSync( 'public/models/dev-weapons/minigun.glb' );
const gltf = parseGLB( bytes.buffer.slice( bytes.byteOffset, bytes.byteOffset + bytes.byteLength ) );
assert.equal( gltf.meshes.length, 3 );
assert.equal( gltf.images.length, 3 );
assert.ok( gltf.images.every( im => im.bytes.length && im.mimeType === 'image/png' ) );
const triangles = gltf.meshes.flat().reduce( ( n, p ) => n + p.indices.length / 3, 0 );
assert.ok( triangles > 46000 && triangles < 47000 );
assert.equal( gltf.json.asset.extras.license, 'CC-BY-4.0' );

const origin = new Vector3( 0, 1.7, 0 ), direction = new Vector3( 0, 0, - 1 ), colliders = new Colliders();
const target = { mesh: { position: new Vector3( 0, 1.7, - 6 ) }, radius: 0.34 };
const world = { colliders, terrain: { heightAt: () => 0 }, targets: [ target ] };
assert.equal( traceWeapon( origin, direction, world ).target, target );
colliders.addBox( new Vector3( 0, 1.7, - 3 ), new Vector3( 2, 2, 0.15 ) );
assert.equal( traceWeapon( origin, direction, world ).kind, 'stone', 'wall blocks target behind it' );
assert.equal( traceWeapon( origin, direction, world ).target, null );
colliders.boxes[ 0 ].solid = false;
assert.equal( traceWeapon( origin, direction, world ).target, target, 'open box does not block' );
colliders.boxes = [];
colliders.addRing( 0, - 6, 2, 2.2, 0, 4, { gaps: [ [ 1.2, 1.9 ] ] } );
assert.equal( traceWeapon( origin, direction, world ).target, target, 'tower doorway gap passes shots' );
colliders.rings[ 0 ].gaps = [];
assert.equal( traceWeapon( origin, direction, world ).kind, 'stone', 'closed tower blocks shots' );
colliders.rings = [];
assert.equal( traceWeapon( origin, new Vector3( 0, - 1, 0 ), world ).kind, 'ground' );
assert.equal( traceWeapon( origin, new Vector3( 0, - 1, 0 ), { ...world, terrain: { heightAt: () => - 20 } } ).kind, 'water' );
assert.equal( traceWeapon( origin, new Vector3( 0, 1, 0 ), world ).kind, 'air' );

Object.defineProperty( globalThis, 'navigator', { value: {}, configurable: true } );
installBrowser( { search: '?devWeapons', width: 960, height: 540, root: 'public' } );
window.__ui = null;
const pressed = new Set(), held = new Set();
const app = {
	qs: new URLSearchParams(), scene: new Group(), camera: new PerspectiveCamera( 65, 16 / 9, 0.1, 1000 ),
	terrainData: { heightAt: () => 0 }, colliders: new Colliders(), player: { velocity: new Vector3() },
	input: { enabled: true, locked: true, mouseDown: false, down: key => held.has( key ), hit: key => pressed.has( key ) },
	ui: { ui: {} },
};
app.camera.position.copy( origin );
const model = { group: new Group(), barrels: new Group() }; model.group.add( model.barrels );
const gun = new DevArmory( app, model );
gun.resetTargets();
assert.equal( gun.targets.length, 7 );
const oldTargets = gun.targets.slice(), poolSize = gun.root.children.length;
gun.resetTargets();
assert.equal( gun.root.children.length, poolSize, 'reset replaces targets without growing scene' );
assert.ok( oldTargets.every( t => gun.root.children.includes( t.mesh ) && t.velocity.length() === 0 ), 'reset reuses the bounded buoy pool' );
app.camera.lookAt( gun.targets[ 3 ].mesh.position );
app.input.mouseDown = true;
for ( let i = 0; i < 12; i ++ ) gun.update( 1 / 60 );
assert.equal( gun.shots, 0, 'motor must spin up first' );
for ( let i = 0; i < 45; i ++ ) gun.update( 1 / 60 );
assert.ok( gun.shots >= 20, 'continuous firing after spin-up' );
assert.ok( gun.hits > 0, 'aimed shots hit a buoy' );
assert.ok( gun.targets.some( t => t.velocity.length() > 0.5 ), 'hits move targets' );
assert.notEqual( model.barrels.rotation.z, 0, 'barrels rotate' );
assert.ok( gun.tracers.some( t => t.life > 0 ) && gun.cases.some( t => t.life > 0 ), 'tracers and brass emit' );
let before = gun.shots;
gun.toggle(); for ( let i = 0; i < 30; i ++ ) gun.update( 1 / 60 );
assert.equal( gun.shots, before, 'holstering stops held trigger' ); assert.equal( gun.held.visible, false );
gun.toggle();
for ( const state of [ { ui: { open: true } }, { ui: { open: false }, paused: true }, { ui: { open: false }, aboard: true }, { ui: { open: false }, signal: true }, { ui: { open: false }, tel: 1 } ] ) {
	app.story = state;
	assert.equal( gun.canUse(), false );
	gun.update( 0.05 ); assert.equal( gun.shots, before, 'story panels and tools suppress fire' );
}
app.story = null; app.ui.ui.photoMode = true; assert.equal( gun.canUse(), false );
app.ui.ui.photoMode = false; app.ui.ui._start = true; assert.equal( gun.canUse(), false );
app.ui.ui._start = false; app.input.enabled = false; assert.equal( gun.canUse(), false );
app.input.enabled = true; app.input.mouseDown = false; app.input.locked = false;
gun.spin = 1; gun.update( 0.05 ); assert.equal( gun.shots, before, 'uncaptured mouse cannot fire' );
held.add( 'KeyX' ); gun.update( 0.05 ); assert.ok( gun.shots > before, 'keyboard firing alternative works' ); held.clear();
pressed.add( 'KeyG' ); gun.update( 1 / 60 ); pressed.clear();
assert.equal( gun.hits, 0 ); assert.equal( gun.targets.length, 7 );
for ( let i = 0; i < 600; i ++ ) gun.update( 1 / 60 );
assert.ok( gun.targets.every( t => Math.abs( t.mesh.position.y - t.radius ) < 1e-5 && t.velocity.length() < 0.01 ), 'buoys settle on ground' );
assert.ok( gun.tracers.every( t => ! t.mesh.visible ) && gun.cases.every( t => ! t.mesh.visible ), 'effects expire' );
console.log( `PASS dev minigun: ${ triangles } imported triangles; walls and doorway blocking; spin-up, firing, buoy impulse/bounce/settling, bounded pools, holster and story/UI gates.` );
