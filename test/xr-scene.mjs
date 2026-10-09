// Actual game materials through the XR renderer, using synthetic tracked views.
// WEBGPU_DEFAULT_LIMITS=1 additionally checks the conservative mobile binding limits.
import './headless.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { installBrowser } from '../tools/shots/browser.mjs';
import { writePNG, writeSheet } from '../tools/shots/png.mjs';
import { GPU } from '../src/engine/gpu/GPU.js';
import { Texture } from '../src/engine/gpu/Texture.js';
import { readTexture } from '../src/engine/gpu/Readback.js';
import { Matrix4, Vector3, Quaternion } from '../src/engine/math/index.js';
import { XRRenderer } from '../src/xr/XRRenderer.js';
import { XRPreview, LOCATIONS } from '../src/xr/XRPreview.js';
import { Locomotion } from '../src/xr/Locomotion.js';

const W = 480, H = 360, out = process.env.XR_TEST_OUT || 'artifacts/xr-preview';
installBrowser( { search: '?vr&bench&noAudio&syncPipelines', width: W, height: H, root: resolve( 'public' ), onPost: async () => {} } );
const { App } = await import( '../src/App.js' );
const app = new App(), errors = [];
const originalInit = GPU.init.bind( GPU );
GPU.init = async ( options ) => {

	const result = await originalInit( options );
	GPU.device.addEventListener( 'uncapturederror', ( e ) => errors.push( e.error.message ) );
	GPU.device.pushErrorScope( 'validation' );
	return result;

};
let stage = '';
await app.init( ( p, text ) => { if ( text !== stage ) console.log( `${ Math.round( p * 100 ) }% ${ stage = text }` ); } );
const renderer = new XRRenderer( app, 'rgba8unorm' );
const output = new Texture( { width: W, height: H, depth: 2, dimension: '2d-array', format: 'rgba8unorm', usage: [ 'render', 'copySrc' ] } );
const projection = new Matrix4().makePerspective( - 0.06 * W / H, 0.06 * W / H, 0.06, - 0.06, 0.06, app.camera.far, undefined, false ).toArray();
const views = [ - 0.032, 0.032 ].map( ( x, i ) => ( {
	view: { eye: i ? 'right' : 'left', projectionMatrix: projection, transform: { matrix: new Matrix4().compose( new Vector3( x, 0, 0 ), new Quaternion(), new Vector3( 1, 1, 1 ) ).toArray() } },
	subImage: { colorTexture: output.getGPU(), viewport: { x: 0, y: 0, width: W, height: H }, getViewDescriptor: () => ( { dimension: '2d', baseArrayLayer: i, arrayLayerCount: 1 } ) },
} ) );
const rig = new Matrix4(), scale = new Vector3( 1, 1, 1 );
app.xr = { active: true, render: () => renderer.render( views, rig ) };
const preview = Object.create( XRPreview.prototype );
Object.assign( preview, { app, locationSelect: {}, controllers: new Map(), _matrix: new Matrix4(), _scale: new Vector3(), space: null } );
// Exercise the actual VR spawn/capsule path, rather than only debug-camera shots.
const head = { transform: { position: new Vector3( 0, 1.62, 0 ), orientation: new Quaternion() } };
for ( let i = 0; i < LOCATIONS.length; i ++ ) {
	preview.selectLocation( i );
	const before = app.player.position.clone(), loco = new Locomotion( app.player );
	loco.update( head, { x: 0, z: 0, turn: 0 }, 1 / 72 );
	assert.ok( app.player.position.distanceTo( before ) < 0.15, `${ LOCATIONS[i][0] } spawned inside a collider` );
	assert.ok( app.player.position.y > 0.25, `${ LOCATIONS[i][0] } spawned below land` );
	console.log( 'PASS actual VR spawn', LOCATIONS[i][0] );
}
mkdirSync( out, { recursive: true } );
const report = { mobileLimits: !! process.env.WEBGPU_DEFAULT_LIMITS, sampledTextures: GPU.limits.maxSampledTexturesPerShaderStage, locations: [] };
for ( const [ name, hour ] of [ ...LOCATIONS.map( ( [ , view ] ) => [ view, 13.6 ] ), [ 'dRoom', 19 ], [ 'dLantern', 19 ] ] ) {

	window.__view( name );
	app.settings.timeOfDay = hour;
	app.camera.fov = 110;
	app.camera.near = 0.06;
	app.camera.updateProjectionMatrix();
	rig.compose( app.camera.position, app.camera.quaternion, scale );
	const controllerSources = [ 'left', 'right' ].map( handedness => ( { handedness, targetRaySpace: handedness } ) );
	preview._controllers( { session: { inputSources: controllerSources }, getPose: space => ( {
		transform: { matrix: new Matrix4().compose( new Vector3( space === 'left' ? -0.35 : 0.35, -0.3, -0.5 ), new Quaternion(), scale ).toArray() },
	} ) }, rig );
	await GPU.pipelinesReady();
	for ( let i = 0; i < 3; i ++ ) { app.frame( 1 / 72 ); await GPU.queue.onSubmittedWorkDone(); }
	const images = [];
	for ( const layer of [ 0, 1 ] ) {

		const bytes = new Uint8Array( ( await readTexture( output, { layer } ) ).data );
		let light = 0;
		for ( let i = 0; i < bytes.length; i += 4 ) light += bytes[ i ] + bytes[ i + 1 ] + bytes[ i + 2 ];
		assert.ok( light > W * H * 10, name + ' eye ' + layer + ' is dark/empty' );
		images.push( { w: W, h: H, rgba: bytes } );
		writePNG( `${ out }/xr-${ name }${ hour === 19 ? '-night' : '' }-${ layer ? 'right' : 'left' }.png`, W, H, bytes );

	}
	let difference = 0;
	for ( let i = 0; i < images[ 0 ].rgba.length; i ++ ) difference += Math.abs( images[ 0 ].rgba[ i ] - images[ 1 ].rgba[ i ] );
	assert.ok( difference > 1000, name + ' did not produce distinct eyes' );
	writeSheet( `${ out }/xr-${ name }${ hour === 19 ? '-night' : '' }-stereo.png`, images, 2 );
	report.locations.push( { name, hour, difference, controllerRays: true } );
	console.log( 'PASS actual XR scene', name, hour, 'eye difference', difference );

}
const validation = await GPU.device.popErrorScope();
assert.equal( validation, null, validation?.message );
assert.deepEqual( errors, [] );
writeFileSync( `${ out }/scene-result.json`, JSON.stringify( report, null, 2 ) );
console.log( 'PASS full scene XR materials and water, with no GPU validation errors. This is local rendering, not Quest certification.' );
process.exit( 0 );
