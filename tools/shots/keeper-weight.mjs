import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import '../../test/headless.mjs';
import { installBrowser } from './browser.mjs';
import { writePNG, bgraShot, writeSheet } from './png.mjs';

const lanternOut = process.argv.includes( '--lantern-out' );
const out = resolve( 'artifacts/keeper-weight', lanternOut ? 'lantern-out' : '.' ), width = 960, height = 540;
mkdirSync( out, { recursive: true } );
installBrowser( { search: '?bench&noAudio&keeperPreview', width, height, root: resolve( 'public' ) } );
await import( '../../src/core/BenchSeed.js' );
const { App } = await import( '../../src/App.js' );
const { Story } = await import( '../../src/story/Story.js' );
const { TOWER } = await import( '../../src/world/flannan/Station.js' );
const { GPU } = await import( '../../src/engine/gpu/GPU.js' );
const { Texture } = await import( '../../src/engine/gpu/Texture.js' );
const { readTexture } = await import( '../../src/engine/gpu/Readback.js' );
const app = new App();
await app.init( ( p, label ) => { if ( label ) console.log( `${ Math.round( p * 100 ) }% ${ label }` ); } );
app.ui = { ui: { photoMode: false, toast() {} }, update() {} };
const s = app.story = new Story( app ); s.ui.card = async () => {};
await s.start();
s.h = 15.35; s.beat = 'machine'; s.paused = false;
s.flags.keeperDuty = { inspected: true, verified: false };
s.lamp.wind = 1; s.lamp.stop(); s.lamp.ignite(); s.lamp.glow = 1; s.lamp.speed = 0;
s.hand.glow = 1;
if ( lanternOut ) { s.hand.lit = false; s.hand.glow = 0; }
s.keeper.drive.sync( s.lamp.wind );
s.keeper.toggleStop();
const output = new Texture( { width, height, format: GPU.format, usage: [ 'render', 'copySrc', 'sample' ], label: 'keeper weight review' } );
app.post.outputTexture = output;
const images = [];
for ( const [ name, time ] of [ [ 'column-start', 1 ], [ 'column-descended', 7 ], [ 'optic', 10 ], [ 'back-at-crank', 12 ] ] ) {
 s.paused = false;
 while ( s.keeper.cutscene.active && s.keeper.cutscene.elapsed < time - 1e-6 ) s.update( 1 / 60 );
 s.paused = true;
 for ( let i = 0; i < 16; i ++ ) { app.frame( 1 / 60 ); await GPU.queue.onSubmittedWorkDone(); }
 const shot = await readTexture( output ), body = new Uint8Array( 8 + shot.data.byteLength );
 new Uint32Array( body.buffer, 0, 2 ).set( [ width, height ] ); body.set( new Uint8Array( shot.data ), 8 );
 const rgba = bgraShot( Buffer.from( body ) ); images.push( rgba );
 writePNG( resolve( out, `${ name }.png` ), width, height, rgba.rgba );
 console.log( `${ name}: weight ${ s.keeper.drive.at.y.toFixed( 3 ) } m; wind ${ s.lamp.wind.toFixed( 3 ) }` );
 console.log( 'View', app.camera.position.toArray(), 'projected weight', s.keeper.drive.at.clone().project( app.camera ).toArray(), 'lamp bounds', app.localLights.flashlight.bounds );
}
writeSheet( resolve( out, 'live-sequence-sheet.png' ), images, 2 );
process.exit( 0 );
