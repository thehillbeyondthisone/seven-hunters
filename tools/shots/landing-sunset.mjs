// Fixed-camera review of the landing defects and the actual first-look-back director.
// node tools/shots/landing-sunset.mjs artifacts/landing-sunset/before
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import '../../test/headless.mjs';
import { installBrowser } from './browser.mjs';
import { writePNG, bgraShot } from './png.mjs';

const out = resolve( process.argv[ 2 ] || 'artifacts/landing-sunset/after' );
const portrait = process.argv[ 3 ] === 'portrait';
const sunsetOnly = process.argv[ 3 ] === 'sunset';
const width = portrait ? 481 : 1280, height = portrait ? 866 : 720;
mkdirSync( out, { recursive: true } );
installBrowser( { search: '?bench&noAudio&setting=flannan&islandRevealPreview', width, height, root: resolve( 'public' ) } );
await import( '../../src/core/BenchSeed.js' );
const { App } = await import( '../../src/App.js' );
const { Story } = await import( '../../src/story/Story.js' );
const { Vector3 } = await import( '../../src/engine/math/index.js' );
const { GPU } = await import( '../../src/engine/gpu/GPU.js' );
const { G } = await import( '../../src/engine/render/Frame.js' );
const { Texture } = await import( '../../src/engine/gpu/Texture.js' );
const { readTexture, readBuffer } = await import( '../../src/engine/gpu/Readback.js' );
const { ComputeKernel } = await import( '../../src/engine/gpu/Compute.js' );
const { StorageBuffer } = await import( '../../src/engine/gpu/Texture.js' );
const app = new App();
await app.init( ( p, label ) => { if ( label ) console.log( `${ Math.round( p * 100 ) }% ${ label }` ); } );
app.ui = { ui: { photoMode: false, toast() {} }, update() {} };
app.engine.canvas.width = width; app.engine.canvas.height = height;
app.camera.aspect = width / height; app.camera.updateProjectionMatrix();
const output = new Texture( { width, height, format: GPU.format, usage: [ 'render', 'copySrc', 'sample' ], label: 'landing sunset review' } );
app.post.outputTexture = output;
let errors = 0;
GPU.device.addEventListener( 'uncapturederror', e => { errors ++; console.error( e.error.message ); } );
const report = {};
const diagnostic = new StorageBuffer( { count: 4, type: 'f32' } );
const probe = new ComputeKernel( {
	modules: [ app.clouds.module ],
	bindings: { fp: { uniform: app.post.flare.uniforms }, depth: { texture: () => app.sceneRenderer.sceneRT.depthTexture }, result: { storage: diagnostic, access: 'read_write' } },
	workgroupSize: [ 1, 1, 1 ],
	code: `@compute @workgroup_size(1) fn main() {
		let size = vec2i(textureDimensions(depth));
		let p = clamp(vec2i(fp.sunUV * vec2f(size)), vec2i(0), size-1);
		result[0] = textureLoad(depth, p, 0);
		result[1] = cloudsSampleView(fp.sunDir).a;
		result[2] = fp.aboveWater;
		result[3] = fp.dt;
	}`,
} );
await GPU.pipelinesReady();
async function shot( name ) {
	app.cameraCut();
	for ( let i = 0; i < 32; i ++ ) { app.frame( 1 / 60 ); await GPU.queue.onSubmittedWorkDone(); }
	const img = await readTexture( output ), body = new Uint8Array( 8 + img.data.byteLength );
	new Uint32Array( body.buffer, 0, 2 ).set( [ width, height ] ); body.set( new Uint8Array( img.data ), 8 );
	const rgba = bgraShot( Buffer.from( body ) );
	writePNG( resolve( out, `${ name }.png` ), width, height, rgba.rgba );
	const flare = app.post.flare;
	probe.dispatch( 1 ); GPU.submit();
	const probeValues = Array.from( new Float32Array( await readBuffer( diagnostic, 16 ) ) );
	report[ name ] = { sunY: app.atmosphere.sunDir.value.y, sunColor: G.sunColor.value.toArray(),
		sunUV: flare.sunUV.value.toArray(), inView: flare.inView.value,
		visibility: new Float32Array( await readBuffer( flare.visibility, 4 ) )[ 0 ], strength: flare.strength.value,
		anamorphic: flare.anamorphic.value, probeValues };
	console.log( 'Saved', name, JSON.stringify( report[ name ] ) );
}
const L = app.village.station.landings.east;
const local = ( x, y, z ) => new Vector3( L.head.x+x*L.dir[0]-z*L.dir[1], y, L.head.z+x*L.dir[1]+z*L.dir[0] );
app.settings.timeOfDay = 13.73;
if ( portrait ) {
	app.setFreeCam( true );
	for ( const [ name, elapsed ] of [ [ 'portrait-approach', 62 ], [ 'portrait-dock', 90 ] ] ) {
		app.arrival.begin( elapsed ); app.arrival.reviewView = {};
		app.player.pitch = .12; app.arrival.camera();
		app.fly.setPose( app.camera.position.clone(), app.player.yaw, app.player.pitch );
		await shot( name );
	}
	writeFileSync( resolve( out, 'report.json' ), JSON.stringify( { errors, views: report }, null, 2 ) );
	if ( errors ) throw new Error( `${ errors } GPU validation errors` );
	process.exit( 0 );
}
app.setFreeCam( true ); app.arrival.group.visible = false;
for ( const [ name, p, at, fov ] of sunsetOnly ? [] : [
	[ 'water-steps', local( 13, 2.65, -6.2 ), local( 7.8, 2.4, -2.55 ), 68 ],
	[ 'stair-apron', local( 1.0, 4.82, -.1 ), local( -1.5, 3.35, .15 ), 72 ],
	[ 'apron-flank', local( .5, 4.82, 2.5 ), local( -1.2, 3.2, .4 ), 72 ],
	[ 'flight', local( 32, 5, -4 ), local( -28, 32, 0 ), 60 ],
	[ 'stage', local( 5, 4.82, -1.15 ), local( -3.5, 5.3, 0 ), 70 ],
] ) {
	const d = at.clone().sub( p );
	app.camera.fov = fov; app.camera.updateProjectionMatrix();
	app.fly.setPose( p, Math.atan2( -d.x, -d.z ), Math.atan2( d.y, Math.hypot( d.x, d.z ) ) );
	await shot( name );
}
app.setFreeCam( false );
app.camera.fov = 72; app.camera.updateProjectionMatrix();
app.story = new Story( app ); app.story.ui.card = async () => {};
await app.story.start();
const r = app.story.islandReveal;
if ( ! r.start() ) throw new Error( 'Crest preview did not trigger' );
const initial = r.save().shot;
app.story.paused = true;
for ( const elapsed of [ 2.5, 3.5, 4.2 ] ) {
	r.state = { ...initial, elapsed }; r.gulls.elapsed = elapsed; r.apply();
	await shot( `sunset-${ elapsed }` );
}
writeFileSync( resolve( out, 'report.json' ), JSON.stringify( { errors, views: report }, null, 2 ) );
if ( errors ) throw new Error( `${ errors } GPU validation errors` );
process.exit( 0 );
