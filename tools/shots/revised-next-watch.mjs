import '../../test/headless.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { installBrowser } from './browser.mjs';
import { bgraShot, writePNG, writeSheet } from './png.mjs';

const out = resolve( 'artifacts/revised-next-watch' ), width = 960, height = 540;
mkdirSync( out, { recursive: true } );
installBrowser( { search: '?bench&noAudio&adapt&chapterPreview=kitchen', width, height, root: resolve( 'public' ) } );
await import( '../../src/core/BenchSeed.js' );
const { App } = await import( '../../src/App.js' );
const { Story } = await import( '../../src/story/Story.js' );
const { TOWER } = await import( '../../src/world/flannan/Station.js' );
const { KITCHEN, HAULING_SHED } = await import( '../../src/world/flannan/NextRooms.js' );
const { Vector3 } = await import( '../../src/engine/index.js' );
const { GPU } = await import( '../../src/engine/gpu/GPU.js' );
const { Texture } = await import( '../../src/engine/gpu/Texture.js' );
const { readTexture } = await import( '../../src/engine/gpu/Readback.js' );
const errors = [], app = new App();
let stage = '';
await app.init( ( p, label ) => { if ( label && label !== stage ) { stage = label; console.log( `${ Math.round( p * 100 ) }% ${ label }` ); } } );
GPU.device.addEventListener( 'uncapturederror', e => errors.push( e.error.message ) ); GPU.device.pushErrorScope( 'validation' );
app.ui = { ui: { photoMode: false, toast() {} }, update() {} };
const s = app.story = new Story( app ); s.ui.card = s.ui.read = s.ui.fade = async () => {};
await s.start(); app.post.autoExposure.snap.value = 1; s.flags.nextWatch = { survey: true, fogThought: true, fireLit: true }; s.lamp.extinguish(); s.lamp.stop(); s.hand.carried = false;
const n = s.next, images = [], manifest = [], cues = []; s.onStoryCue = id => cues.push( id );
const output = new Texture( { width, height, format: GPU.format, usage: [ 'render', 'copySrc', 'sample' ], label: 'revised next watch' } ); app.post.outputTexture = output;
function view( x, z, target, y = app.terrainData.heightAt( x, z ) ) {
	const p = app.player, d = target.clone().sub( new Vector3( x, y + 1.62, z ) );
	p.position.set( x, y, z ); p.velocity.set( 0, 0, 0 ); p.mode = 'walk'; p.grounded = true; p._camY = null;
	p.yaw = Math.atan2( -d.x, -d.z ); p.pitch = Math.atan2( d.y, Math.hypot( d.x, d.z ) ); p.update( 0 ); app.cameraCut();
}
async function shot( name ) {
	for ( let i = 0; i < 18; i ++ ) { app.frame( 1 / 60 ); await GPU.queue.onSubmittedWorkDone(); }
	const rgba = bgraShot( Buffer.concat( [ Buffer.from( new Uint32Array( [ width, height ] ).buffer ), Buffer.from( ( await readTexture( output ) ).data ) ] ) );
	writePNG( resolve( out, `${ name }.png` ), width, height, rgba.rgba ); images.push( rgba );
	manifest.push( { name, beat: s.beat, time: s.h, camera: app.camera.position.toArray(), smokeCutsceneElapsed: n.smoke.state?.elapsed ?? null, smokeSeen: n.state.smokeSeen ?? null, density: app.haze.density.value, hazeEnabled: app.haze.enabled.value, shafts: app.haze.shafts.value, seaWeatherActive: app.seaWeather?.active, fogReturned: !! n.state.fogReturned } );
	console.log( 'rendered', name, { density: app.haze.density.value, seaWeatherActive: app.seaWeather?.active, hazeEnabled: app.haze.enabled.value } );
}
s.h = 35; s.beat = 'd2rest'; s.paused = true;
view( -155, 44, new Vector3( 0, s.station.focal, 0 ) ); await shot( 'a-fog-hidden-lighthouse' );
view( -120, 29, new Vector3( -109, app.terrainData.heightAt( -109, 28.45 ), 28.45 ) ); await shot( 'b-fog-readable-tramway' );
n.state.fogReturned = true; view( 4.5, 18.5, new Vector3( 0, s.station.focal, 0 ) ); await shot( 'c-home-after-fog-return' );
s.h = 66; s.beat = 'd3remote'; s.paused = false; n.state.banked = 65; n.state.chainSecured = 0; delete n.state.smokeSeen;
view( -155, 44, new Vector3( -160, HAULING_SHED.floor + 1, 40 ) ); await n.brake();
app.frame( 1 / 60 );
if ( ! n.smoke.active ) throw new Error( 'smoke head turn did not start' );
for ( const [ name, time ] of [ [ 'd-smoke-turn-start', .25 ], [ 'e-smoke-turn', 1.2 ], [ 'f-smoke-noticed', 2.4 ], [ 'g-smoke-held', 5.2 ] ] ) {
	s.paused = false; while ( n.smoke.active && n.smoke.state.elapsed < time ) s.update( 1 / 60 );
	s.paused = true; await shot( name );
}
s.paused = false; while ( n.smoke.active ) s.update( 1 / 60 ); s.paused = true; await shot( 'h-smoke-control-returned' );
await GPU.pipelinesReady(); await GPU.queue.onSubmittedWorkDone();
const validation = await GPU.device.popErrorScope(); if ( validation ) errors.push( validation.message );
writeSheet( resolve( out, 'temporal-sheet.png' ), images, 2 );
writeFileSync( resolve( out, 'verification.json' ), JSON.stringify( { captures: manifest, validationErrors: errors, smokeMusicCues: cues, scope: 'Native game renderer: authored fog continuity, local tramway readability and first-person smoke turn. DOM paper UI is verified separately.' }, null, 2 ) );
if ( errors.length ) throw new Error( errors.join( '\n' ) );
console.log( 'PASS native scene captures and WebGPU validation' ); process.exit( 0 );
