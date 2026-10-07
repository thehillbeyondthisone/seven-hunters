import assert from 'node:assert/strict';
import { SeaDreadState } from '../src/weather/SeaDreadState.js';
import { SeaDread } from '../src/weather/SeaDread.js';
import { configureSeaPreview } from '../src/weather/SeaWeatherState.js';
import { PerspectiveCamera, Scene, Vector2, Vector4 } from '../src/engine/index.js';

const ordinary = new URLSearchParams();
assert.equal( configureSeaPreview( ordinary ), false ); assert.equal( ordinary.has( 'nostory' ), false );
const preview = new URLSearchParams( 'seaDread' );
assert.equal( configureSeaPreview( preview ), true ); assert.ok( preview.has( 'nostory' ) );
assert.equal( configureSeaPreview( new URLSearchParams( 'seaDread&vr' ) ), false );

const model = new SeaDreadState(); model.strike( 1029 );
let thunder = 0, flashFrames = 0;
for ( let i = 0; i < 179; i ++ ) {
	const e = model.update( 1 / 60 ); thunder += Number( e.thunder ); flashFrames += Number( model.flash > 0 );
}
assert.equal( thunder, 0, 'thunder cannot precede its distance delay' );
for ( let i = 0; i < 5; i ++ ) thunder += Number( model.update( 1 / 60 ).thunder );
assert.equal( thunder, 1, 'one thunder event per strike' ); assert.ok( flashFrames > 0 );
model.reduced = true; model.strike(); model.hit( 1 ); model.update( 0.1 );
assert.equal( model.flash, 0 ); assert.equal( model.shake, 0 );
model.setEnabled( false ); assert.equal( model.thunderIn, - 1 ); assert.equal( model.strike(), false );
for ( let i = 0; i < 1000; i ++ ) assert.deepEqual( model.update( 0.1 ), { strike: false, thunder: false } );

const camera = new PerspectiveCamera(); camera.position.set( - 200, 15, 80 ); camera.lookAt( - 600, 0, 80 );
const params = Object.fromEntries( Object.entries( { vignette: 0.28, saturation: 1.06, warmth: 0.02, contrast: 1.04 } ).map( ( [ k, v ] ) => [ k, { value: v } ] ) );
Object.assign( params, { gradeMode: { value: 0 }, gradeLift: { value: new Vector4() }, gradeGamma: { value: new Vector4( 1, 1, 1, 0 ) }, gradeGain: { value: new Vector4( 1, 1, 1, 1 ) } } );
const app = { qs: new URLSearchParams( 'seaDread' ), scene: new Scene(), camera, settings: {},
	post: { params }, spray: { params: { intensity: { value: 1 } } }, haze: { seaMist: { value: new Vector2( 0, 16 ) } }, cliffSurge: {}, seaWeather: { state: { surf: 1 } }, audio: null };
const dread = new SeaDread( app ), pose = camera.quaternion.clone(), position = camera.position.clone();
dread.model.hit( 1 ); dread.update( 0.05 );
for ( let i = 0; i < 300; i ++ ) {
	dread.beginRender(); assert.ok( camera.quaternion.angleTo( pose ) <= 0.008, 'shake bounded below half a degree' );
	dread.endRender(); assert.ok( camera.quaternion.equals( pose ), 'render shake must never accumulate into player aim' );
	assert.ok( camera.position.equals( position ), 'shake never moves player/collision position' );
}
dread.strike(); assert.ok( dread.bolt.geometry.attributes.position.array.every( Number.isFinite ) );
dread.setEnabled( false );
assert.equal( app.haze.seaMist.value.x, 0 ); assert.equal( app.spray.params.intensity.value, 1 );
assert.equal( params.vignette.value, 0.28 ); assert.ok( camera.quaternion.equals( pose ) );
assert.equal( params.gradeMode.value, 0 ); assert.ok( params.gradeGain.value.equals( new Vector4( 1, 1, 1, 1 ) ) );
console.log( 'PASS sea dread: isolated route, thunder delay, reduced effects, disable/reset, bounded render-only camera shake and lightning geometry.' );
