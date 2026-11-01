// CPU integration checks for the live lamp data and post-chain lifecycle. The
// native room-air fixture separately validates the actual shader output.
import assert from 'node:assert/strict';
import { LocalLights, localLightsModule } from '../src/materials/LocalLights.js';
import { RoomAir } from '../src/post/RoomAir.js';
import { AirHaze } from '../src/post/AirHaze.js';
import { PostFX } from '../src/post/PostFX.js';
import { G } from '../src/engine/render/Frame.js';
import { PerspectiveCamera, Color, Vector3 } from '../src/engine/index.js';
import { ShaderModule, collectModules } from '../src/engine/gpu/Shader.js';

const camera = new PerspectiveCamera( 66, 16 / 9, .1, 100 );
camera.position.set( 0, 1.6, 0 );
const bounds = { min: [ -4, 0, -4 ], max: [ 4, 3, 4 ], softness: .2 };
const previous = { night: G.night.value, underwater: G.cameraUnderwater.value };
const lights = new LocalLights();
const source = ( kind, x, extra = {} ) => lights.add( {
	position: new Vector3( x, 1.5, 0 ), color: new Color( 1, .5, .2 ),
	intensity: 8, range: 5, kind, always: true, bounds, phase: 1,
	...extra,
} );

try {
	G.night.value = 1; G.cameraUnderwater.value = 0;
	// A nearer fill occupies slot zero. Air must use the actual selected slot,
	// not assume every selected light is a warm lamp or recompute its flicker.
	source( 'windowBounce', .5 );
	const lamp = source( 'lamp', 1, { flicker: .15, scale: .6 } );
	source( 'kitchenLamp', 2, { roomAir: false } );
	lights.strength = .7;
	lights.update( camera, .1 );
	assert.equal( lights.roomAirLights.length, 1, 'cool fills and explicitly excluded lamps do not scatter in room air' );
	const packed = localLightsModule.bindings.localLights.uniform.fields;
	const selected = lights.roomAirLights[ 0 ];
	for ( const [ air, shaded ] of [ [ 'position', 'pos' ], [ 'color', 'col' ], [ 'direction', 'dir' ], [ 'boundMin', 'boundMin' ], [ 'boundMax', 'boundMax' ] ] ) {
		assert.equal( selected[ air ], packed[ shaded ].value[ 1 ], `air shares the exact packed ${ shaded } used by surface lighting` );
	}
	const brightness = selected.color.x;
	lights.update( camera, .3 );
	assert.equal( lights.roomAirLights[ 0 ], selected, 'source slots reuse their CPU views rather than allocate per frame' );
	assert.notEqual( selected.color.x, brightness, 'the shared source follows the real animated flicker' );
	lamp.enabled = false;
	lights.update( camera, .1 );
	assert.equal( lights.roomAirLights.length, 0, 'extinguishing a lamp removes its previously selected air source' );
	lamp.enabled = true;
	lights.flashlight.on = true; lights.flashlight.bounds = bounds;
	lights.flashlight.at = new Vector3( .2, 1.3, -.2 );
	lights.update( camera, .1 );
	assert.equal( lights.roomAirLights.length, 2, 'the bounded carried lamp shares the same source path' );
	assert.equal( lights.roomAirLights[ 0 ].position, packed.pos.value[ 0 ] );
	lights.enabled = false;
	lights.update( camera, .1 );
	assert.equal( lights.roomAirLights.length, 0, 'global lighting off clears every cached source view' );
	lights.enabled = true; lights.update( camera, .1 );

	const haze = new AirHaze( { underwater: { module: new ShaderModule( { name: 'room-air-control-fixture' } ) } } );
	const room = { id: 'room', min: bounds.min, max: bounds.max, windows: [] };
	const air = haze.roomAir = new RoomAir( { haze, layout: [ room ], localLights: lights } );
	let submissions = 0;
	air._pass = { render() { submissions ++; } };
	air.update( camera );
	haze.shafts.value = 0;
	haze.render();
	assert.equal( submissions, 1, 'switching off outdoor sun rays keeps the real indoor lamps visible' );
	assert.deepEqual( air.activePassNames, [ 'room air' ] );
	assert.deepEqual( haze.activePassNames, [], 'the outdoor profiler excludes the indoor pass' );
	assert.equal( air.uniforms.fields.lampCount.value, 2 );
	assert.deepEqual( air.uniforms.fields.lampCol.value[ 0 ].toArray(), lights.roomAirLights[ 0 ].color.toArray(), 'room data copies the freshly packed carried lamp' );
	haze.enabled.value = 0; air.update( camera ); haze.render();
	assert.equal( submissions, 1, 'the global atmosphere switch removes the room pass too' );
	assert.equal( air.uniforms.fields.hasScatter.value, 0, 'disabled room air cannot composite an older lit texture' );
	haze.enabled.value = 1; air.update( camera ); haze.render();
	assert.equal( submissions, 2, 'indoor lamps return when atmosphere is re-enabled' );
	PostFX.prototype.cut.call( { haze, taau: {}, motionBlur: {} } );
	assert.equal( air.uniforms.fields.hasScatter.value, 0, 'a post camera cut invalidates the room composite immediately' );
	camera.position.set( 30, 1.6, 0 ); air.update( camera ); haze.render();
	assert.equal( submissions, 2, 'the outdoor camera adds no room march' );
	assert.deepEqual( air.activePassNames, [] );

	// Preserve the real target sizing while avoiding any GPU allocation in this
	// CPU check. All room sizing is driven through the normal haze lifecycle.
	for ( const target of [ haze.low, ...haze.hist, ...haze.ssTargets, air.low ] ) {
		for ( const texture of target.textures ) texture.resize = ( w, h ) => { texture.width = w; texture.height = h; };
	}
	haze.setScale( .8 ); haze.setSize( 1920, 1080 ); haze.setQuality( .5 );
	assert.deepEqual( [ air.low.width, air.low.height ], [ 384, 216 ], 'indoor and outdoor rays share quality and global scale controls' );
	haze.setQuality( 1.5 );
	assert.deepEqual( [ air.low.width, air.low.height ], [ 1152, 648 ] );
	const modules = collectModules( [ haze.compositeModule ] );
	assert.equal( modules.filter( m => m === air.module ).length, 1, 'shared haze dependencies introduce no duplicate or circular room module' );
	assert.ok( modules.includes( air.compositeModule ) );
	const fakePost = { haze, motionBlur: {}, aoPass: {}, underwater: {}, taau: { _resolve: [ {}, {} ] }, _bloomPasses: [] };
	const tracked = PostFX.prototype.passes.call( fakePost ).filter( ( [ name ] ) => name === 'room air' );
	assert.deepEqual( tracked, [ [ 'room air', air._pass ] ], 'the profiler registers exactly one room-air pass' );
	console.log( 'PASS room-air controls: exact live lamp packing, source extinction, independent indoor pass, global disable, cut, exterior bypass, shared quality and profiler integration.' );
} finally {
	G.night.value = previous.night; G.cameraUnderwater.value = previous.underwater;
}
