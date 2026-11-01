// Frames from the first-lighting view outside the lantern: node tools/shots/first-light.mjs
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import '../../test/headless.mjs';
import { installBrowser } from './browser.mjs';
import { writePNG, bgraShot, writeSheet } from './png.mjs';

const out = resolve( 'artifacts/first-light' ), width = 960, height = 540;
mkdirSync( out, { recursive: true } );
installBrowser( { search: '?bench&noAudio&keeperPreview', width, height, root: resolve( 'public' ) } );
await import( '../../src/core/BenchSeed.js' );
const { App } = await import( '../../src/App.js' );
const { Story } = await import( '../../src/story/Story.js' );
const { SUNSET } = await import( '../../src/story/Script.js' );
const { GPU } = await import( '../../src/engine/gpu/GPU.js' );
const { Texture } = await import( '../../src/engine/gpu/Texture.js' );
const { readTexture } = await import( '../../src/engine/gpu/Readback.js' );
const app = new App();
await app.init( ( p, label ) => { if ( label ) console.log( `${ Math.round( p * 100 ) }% ${ label }` ); } );
app.ui = { ui: { photoMode: false, toast() {} }, update() {} };
const s = app.story = new Story( app ); s.ui.card = async () => {};
await s.start();
s.h = SUNSET; s.beat = 'light'; s.paused = false;
s.flags.keeperDuty = { inspected: true, verified: false };
s.lamp.wind = 1; s.lamp.stop(); s.lamp.extinguish(); s.lamp.glow = 0; s.lamp.speed = 0;
s.keeper.drive.sync( s.lamp.wind );
s._applyClock();
await s.keeper.useLens();
if ( ! s.keeper.firstLight.active ) throw new Error( 'first-light view did not start' );
const output = new Texture( { width, height, format: GPU.format, usage: [ 'render', 'copySrc', 'sample' ], label: 'first light review' } );
app.post.outputTexture = output;
const images = [];
for ( const [ name, time ] of [ [ 'a-start', 0.8 ], [ 'b-warming', 2.6 ], [ 'c-flame-caption', 4.4 ], [ 'd-clockwork-caption', 7.5 ], [ 'e-end', 11.0 ] ] ) {
	s.paused = false;
	while ( s.keeper.firstLight.active && s.keeper.firstLight.elapsed < time - 1e-6 ) s.update( 1 / 60 );
	s.paused = true;
	for ( let i = 0; i < 16; i ++ ) { app.frame( 1 / 60 ); await GPU.queue.onSubmittedWorkDone(); }
	const shot = await readTexture( output ), body = new Uint8Array( 8 + shot.data.byteLength );
	new Uint32Array( body.buffer, 0, 2 ).set( [ width, height ] ); body.set( new Uint8Array( shot.data ), 8 );
	const rgba = bgraShot( Buffer.from( body ) ); images.push( rgba );
	writePNG( resolve( out, `${ name }.png` ), width, height, rgba.rgba );
	console.log( `${ name }: glow ${ s.lamp.glow.toFixed( 2 ) }; camera`, app.camera.position.toArray().map( v => +v.toFixed( 2 ) ) );
}
writeSheet( resolve( out, 'sheet.png' ), images, 2 );
process.exit( 0 );
