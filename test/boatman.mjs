import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import './headless.mjs';
import { installBrowser } from '../tools/shots/browser.mjs';
import { GPU } from '../src/engine/gpu/GPU.js';
import { Group, PerspectiveCamera } from '../src/engine/index.js';
import { Boatman } from '../src/world/boat/Boatman.js';
import { rowingPose, ROWING_PERIOD } from '../src/story/ArrivalRowing.js';

installBrowser( { root: resolve( 'public' ) } );
await GPU.init( { headless: true } );
GPU.device.pushErrorScope( 'validation' );
const parent = new Group(), rower = await new Boatman( parent ).load(), camera = new PerspectiveCamera();
const oars = [ -1, 1 ].map( side => { const g = new Group(); g.position.set( side * 1.16, 1.25, -.65 ); parent.add( g ); return g; } );
assert.equal( rower.model.joints, 80 );
assert.equal( rower.model.meshes.length, 10 );
assert.equal( rower.model.gltf.nodes.filter( n => n.mesh !== undefined ).length, 2, 'export contains only the near/far character' );
const manifest = JSON.parse(readFileSync(resolve('public/models/characters/boatman-manifest.json'),'utf8'));
assert.equal(manifest.tailoring_pass,2);
assert.equal(manifest.nape_skin_colour_space,'linear-sRGB');
const napeColour=rower.model.materials.find(m=>m.name.includes('nape skin')).uniforms.color.value;
for(const[k,i]of[['r',0],['g',1],['b',2]])assert.ok(Math.abs(napeColour[k]-manifest.nape_skin_colour[i])<1e-6,'skin reflectance survives the glTF colour handoff');
assert.ok(manifest.lap_fit.minimum_clearance_m>=.01,'jacket fits above the seated lap');
assert.ok(manifest.triangles.near<45000 && manifest.triangles.far<18000,'construction volumes stay outside the game export');
for ( const lod of rower.lods ) for ( const geometry of [ lod.near, lod.far ] ) {
 for ( const a of Object.values( geometry.attributes ) ) assert.ok( a.array.every( Number.isFinite ) );
 const weights = geometry.attributes.skinWeight.array;
 for ( let i = 0; i < weights.length; i += 4 ) assert.ok( Math.abs( weights[i]+weights[i+1]+weights[i+2]+weights[i+3]-1 ) < 1e-5 );
}
let worst = 0;
// A translated, tilted hull tests the world-to-character constraint, including
// entry, power, recovery, and the range of wave-driven oar elevations.
parent.position.set( 40, 2, -18 ); parent.rotation.set( .07, 1.4, -.08 );
for ( const dip of [ .06, .12, .4, .9 ] ) for ( let f = 0; f <= 90; f++ ) {
 const stroke = rowingPose( f / 90 * ROWING_PERIOD, true );
 for ( let i = 0; i < 2; i++ ) { const side = i ? 1 : -1; oars[ i ].rotation.set( 0, side * stroke.sweep, -side * ( -.045 + ( dip + .045 ) * stroke.immersion ) ); }
 const before = rower.model.jointData.slice( 0, rower.model.joints * 16 );
 rower.update( oars, stroke.lean, null, { dt: 1 / 24, phase: stroke.phase } );
 assert.ok( rower.model.jointData.every( Number.isFinite ) );
 if ( f > 0 ) assert.deepEqual( rower.model.jointData.slice( rower.model.joints * 16 ), before, 'motion vectors preserve the preceding pose' );
 worst = Math.max( worst, rower.gripError );
}
assert.ok( worst < .002, `oar grip error ${worst}m` );
rower.update( oars, 0, null, { phase: .3 } );
const chestBefore = rower.model.local[ rower.chest ].r.slice();
rower.update( oars, 0, null, { phase: .3, dt: 1.7 } );
assert.notDeepEqual( rower.model.local[ rower.chest ].r, chestBefore, 'breathing continues independently of the rowing clock' );
assert.ok( rower.gripError < .002 );
camera.position.set( 100, 10, 100 ); rower.update( oars, 0, camera );
assert.equal( rower.far, true );
assert.ok( rower.lods.every( lod => lod.mesh.geometry === lod.far && lod.far.index.count <= lod.near.index.count ) );
assert.ok( rower.lods.reduce((n,lod)=>n+lod.far.index.count,0) < rower.lods.reduce((n,lod)=>n+lod.near.index.count,0)*.6 );
camera.position.copy( parent.position ); rower.update( oars, 0, camera ); assert.equal( rower.far, false );
const t = rower.lifeTime; rower.update( oars, 0, null, { dt: 1, paused: true } ); assert.equal( rower.lifeTime, t );
rower.model.hold();
assert.deepEqual( rower.model.jointData.slice( 0, rower.model.joints * 16 ), rower.model.jointData.slice( rower.model.joints * 16 ) );
const plain = rower.model.materials.find( m => m.name.includes( 'horn' ) );
assert.ok( plain.uniforms.color.value.r < .3, 'untextured horn keeps its glTF colour' );
await GPU.queue.onSubmittedWorkDone();
assert.equal( await GPU.device.popErrorScope(), null );
console.log( `PASS Joe: 80 joints, 10 materials, near/far geometry, wave-driven oar grips (${(worst*1000).toFixed(3)}mm), pause, motion history, glTF colour.` );
process.exit( 0 );
