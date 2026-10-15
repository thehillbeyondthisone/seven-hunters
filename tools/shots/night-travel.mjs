// Local renderer review: actual lighting, star shader, wake lantern and guards.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import '../../test/headless.mjs';
import { installBrowser } from './browser.mjs';
import { bgraShot, writePNG, writeSheet } from './png.mjs';

const width = 960, height = 540, out = resolve( 'artifacts/night-travel' );
mkdirSync( out, { recursive: true } );
installBrowser( { search: '?bench&noAudio&vis=90', width, height, root: resolve( 'public' ) } );
await import( '../../src/core/BenchSeed.js' );
const { App } = await import( '../../src/App.js' );
const { Story } = await import( '../../src/story/Story.js' );
const { TOWER: T } = await import( '../../src/world/flannan/Station.js' );
const { Vector3 } = await import( '../../src/engine/index.js' );
const { GPU } = await import( '../../src/engine/gpu/GPU.js' );
const { Texture } = await import( '../../src/engine/gpu/Texture.js' );
const { readTexture } = await import( '../../src/engine/gpu/Readback.js' );
const errors = [], init = GPU.init.bind( GPU );
GPU.init = async opts => {
	const result = await init( opts ); GPU.device.pushErrorScope( 'validation' );
	GPU.device.addEventListener( 'uncapturederror', event => errors.push( event.error.message ) ); return result;
};
const app = new App();
await app.init( ( p, label ) => { if ( label ) console.log( `${ Math.round( p * 100 ) }% ${ label }` ); } );
app.setFreeCam( true ); app.settings.timeSpeed = 0;
app.setting.dayOffset = 21; app.settings.timeOfDay = 3 + 22 / 60;
app.clouds.coverage.value = .2; // Clear interval; clouds still obscure the stars normally.
const output = new Texture( { width, height, format: GPU.format, usage: [ 'render', 'copySrc', 'sample' ], label: 'night travel review' } );
app.post.outputTexture = output; app.post.autoExposure.snap.value = 1;
const shots = [], evidence = [];
function pose( eye, direction ) {
	const dir = new Vector3( ...direction ).normalize();
	app.fly.setPose( eye, Math.atan2( -dir.x, -dir.z ), Math.asin( dir.y ) ); app.cameraCut();
}
async function frames( count ) {
	for ( let i = 0; i < count; i ++ ) { app.frame( 1 / 30 ); await GPU.queue.onSubmittedWorkDone(); }
}
async function shot( name ) {
	const texture = await readTexture( output ), bytes = new Uint8Array( 8 + texture.data.byteLength );
	new Uint32Array( bytes.buffer, 0, 2 ).set( [ width, height ] ); bytes.set( new Uint8Array( texture.data ), 8 );
	const result = bgraShot( Buffer.from( bytes ) ); shots.push( result ); writePNG( resolve( out, `${ name }.png` ), width, height, result.rgba );
	evidence.push( { name, adaptation: app.nightVision.strength, exposure: app.nightVision.exposure } ); console.log( name );
}
pose( new Vector3( 15, 83, 9 ), [ .1, .38, 1 ] );
app.handLamp.carried = true; app.handLamp.lit = true; app.handLamp.glow = 1;
await frames( 30 ); app.handLamp.lit = false;
await frames( 1 ); await shot( 'outside-just-extinguished' );
await frames( 150 ); await shot( 'outside-eyes-adjusted' );
assert( app.nightVision.strength > .9 );

const s = app.story = new Story( app ); s.save = () => {}; s.loadSave = () => null; s.ui.card = async () => {};
await s.start(); s.arrival.group.visible = false; s.beat = 'd2wake'; s.h = 51 + 22 / 60;
s.next.wakeLantern();
pose( new Vector3( -2.7, T.floor + 1.62, 12.1 ), [ .55, -.1, -1 ] );
app.handInView = true;
await frames( 45 ); await shot( 'wake-with-lit-lantern' );
assert.equal( app.nightVision.exposure, 1 );

app.handLamp.lit = true;
for ( const [ name, foot, target ] of [ [ 'tower-ascent-guard', s.towerTravel.bottom, s.interact.get( 'towerUp' ).at ], [ 'tower-descent-guard', s.towerTravel.top, s.interact.get( 'towerDown' ).at ] ] ) {
	const eye = foot.clone().add( new Vector3( 0, 1.62, 0 ) );
	pose( eye, target.clone().sub( eye ).toArray() ); await frames( 30 ); await shot( name );
}
writeSheet( resolve( out, 'review.png' ), shots, 2 );
await GPU.pipelinesReady(); await GPU.queue.onSubmittedWorkDone();
const validation = await GPU.device.popErrorScope(); assert.equal( validation, null, validation?.message ); assert.deepEqual( errors, [] );
writeFileSync( resolve( out, 'verification.json' ), JSON.stringify( { evidence, gpuErrors: errors, physicalDeviceTested: false }, null, 2 ) + '\n' );
console.log( 'PASS actual renderer: exterior adaptation, wake light, both guards, no WebGPU validation errors.' );
process.exit( 0 );
