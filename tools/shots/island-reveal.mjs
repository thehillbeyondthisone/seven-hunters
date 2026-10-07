// Render the actual story director at reviewable points in its short timeline.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import '../../test/headless.mjs';
import { installBrowser } from './browser.mjs';
import { writePNG, bgraShot, writeSheet } from './png.mjs';
import { ISLAND_REVEAL_SPEED } from '../../src/story/IslandReveal.js';

const out = resolve( 'artifacts/stair-crest' ), width = 960, height = 540;
mkdirSync( out, { recursive: true } );
installBrowser( { search: '?bench&noAudio&setting=flannan&islandRevealPreview', width, height, root: resolve( 'public' ) } );
await import( '../../src/core/BenchSeed.js' );
const { App } = await import( '../../src/App.js' );
const { Story } = await import( '../../src/story/Story.js' );
const { GPU } = await import( '../../src/engine/gpu/GPU.js' );
const { Texture } = await import( '../../src/engine/gpu/Texture.js' );
const { readTexture } = await import( '../../src/engine/gpu/Readback.js' );
const app = new App();
await app.init( ( p, label ) => { if ( label ) console.log( `${ Math.round( p * 100 ) }% ${ label }` ); } );
app.ui = { ui: { photoMode: false, toast() {} }, update() {} };
app.story = new Story( app ); app.story.ui.card = async () => {};
await app.story.start();
const r = app.story.islandReveal;
if ( ! r.start() ) throw new Error( 'Crest preview did not trigger' );
const initial = r.save().shot;
app.story.paused = true;
app.engine.canvas.width = width; app.engine.canvas.height = height;
app.camera.aspect = width / height; app.camera.updateProjectionMatrix();
const output = new Texture( { width, height, format: GPU.format, usage: [ 'render', 'copySrc', 'sample' ], label: 'island reveal review' } );
app.post.outputTexture = output;
const images = [];
for ( const [ name, elapsed ] of [ [ 'lighthouse-before', 0 ], [ 'sunset-left', 3.5 ], [ 'ocean', 6.5 ], [ 'gull-glance', 10.5 ], [ 'gull-follow', 12.4 ], [ 'lighthouse-return', 21 ] ] ) {
	r.state = { ...initial, elapsed }; r.gulls.elapsed = elapsed; r.apply();
	app.story.arrival.departure = 45 + elapsed / ISLAND_REVEAL_SPEED; app.story.arrival.pose( 0 ); app.cameraCut();
	for ( let i = 0; i < 20; i ++ ) { app.frame( 1 / 60 ); await GPU.queue.onSubmittedWorkDone(); }
	const img = await readTexture( output ), body = new Uint8Array( 8 + img.data.byteLength );
	new Uint32Array( body.buffer, 0, 2 ).set( [ width, height ] ); body.set( new Uint8Array( img.data ), 8 );
	const rgba = bgraShot( Buffer.from( body ) ); images.push( rgba );
	writePNG( resolve( out, `${ name }.png` ), width, height, rgba.rgba ); console.log( `Saved ${ name } at ${ ( elapsed / ISLAND_REVEAL_SPEED ).toFixed( 2 ) }s` );
}
writeSheet( resolve( out, 'sequence-sheet.png' ), images, 2 );
process.exit( 0 );
