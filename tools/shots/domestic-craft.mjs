// Standalone entry; the shared helper can also reuse a warm native renderer.
import '../../test/headless.mjs';
import { resolve } from 'node:path';
import { installBrowser } from './browser.mjs';
import { captureDomesticWork } from './domestic-work-capture.mjs';
const width = 960, height = 640;
installBrowser( { search: '?bench&noAudio&chapterPreview=kitchen', width, height, root: resolve( 'public' ) } );
await import( '../../src/core/BenchSeed.js' );
const { App } = await import( '../../src/App.js' ), { Story } = await import( '../../src/story/Story.js' );
const { GPU } = await import( '../../src/engine/gpu/GPU.js' ), { Texture } = await import( '../../src/engine/gpu/Texture.js' );
const app = new App(); let stage = '';
await app.init( ( p, label ) => { if ( label && label !== stage ) { stage = label; console.log( `${ Math.round( p * 100 ) }% ${ label }` ); } } );
app.ui = { ui: { photoMode: false, toast() {} }, update() {} };
const s = app.story = new Story( app ); s.ui.card = s.ui.read = s.ui.fade = async () => {}; await s.start();
const output = new Texture( { width, height, format: GPU.format, usage: [ 'render', 'copySrc', 'sample' ], label: 'domestic review' } );
app.post.outputTexture = output;
console.log( await captureDomesticWork( { app, s, GPU, output, width, height } ) );
process.exit( 0 );
