// Review flare throughout the actual first-look-back camera path, with isolated saves.
// node tools/shots/reveal-flare.mjs artifacts/reveal-flare/before [portrait]
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import '../../test/headless.mjs';
import { installBrowser } from './browser.mjs';
import { writePNG, bgraShot, writeSheet } from './png.mjs';

const out = resolve( process.argv[ 2 ] || 'artifacts/reveal-flare/after' );
const portrait = process.argv[ 3 ] === 'portrait';
const width = portrait ? 480 : 960, height = portrait ? 860 : 540;
mkdirSync( out, { recursive: true } );
installBrowser( { search: '?bench&noAudio&setting=flannan&islandRevealPreview', width, height, root: resolve( 'public' ) } );
await import( '../../src/core/BenchSeed.js' );
const { App } = await import( '../../src/App.js' );
const { Story } = await import( '../../src/story/Story.js' );
const { GPU } = await import( '../../src/engine/gpu/GPU.js' );
const { Texture } = await import( '../../src/engine/gpu/Texture.js' );
const { readTexture, readBuffer } = await import( '../../src/engine/gpu/Readback.js' );
const app = new App();
await app.init( ( p, label ) => { if ( label ) console.log( `${ Math.round( p * 100 ) }% ${ label }` ); } );
app.ui = { ui: { photoMode: false, toast() {} }, update() {} };
app.story = new Story( app ); app.story.ui.card = async () => {};
await app.story.start();
const reveal = app.story.islandReveal;
if ( ! reveal.start() ) throw new Error( 'Crest preview did not trigger' );
const initial = reveal.save().shot;
app.story.paused = true;
app.engine.canvas.width = width; app.engine.canvas.height = height;
app.camera.aspect = width / height; app.camera.updateProjectionMatrix();
const output = new Texture( { width, height, format: GPU.format, usage: [ 'render', 'copySrc', 'sample' ], label: 'reveal flare review' } );
app.post.outputTexture = output;
let errors = 0;
GPU.device.addEventListener( 'uncapturederror', e => { errors ++; console.error( e.error.message ); } );
const images = [], views = [];
for ( const elapsed of [ 2, 2.5, 3.5, 4.2, 4.8, 5.5, 15, 16, 17, 18, 19, 20 ] ) {

	reveal.state = { ...initial, elapsed }; reveal.gulls.elapsed = elapsed; reveal.apply();
	app.story.arrival.departure = 45 + elapsed / reveal.settings.speed; app.story.arrival.pose( 0 ); app.cameraCut();
	for ( let i = 0; i < 24; i ++ ) { app.frame( 1 / 60 ); await GPU.queue.onSubmittedWorkDone(); }
	const img = await readTexture( output ), body = new Uint8Array( 8 + img.data.byteLength );
	new Uint32Array( body.buffer, 0, 2 ).set( [ width, height ] ); body.set( new Uint8Array( img.data ), 8 );
	const rgba = bgraShot( Buffer.from( body ) ); images.push( rgba );
	writePNG( resolve( out, `reveal-${ elapsed }.png` ), width, height, rgba.rgba );
	const flare = app.post.flare;
	const view = { elapsed, seconds: elapsed / reveal.settings.speed, sunUV: flare.sunUV.value.toArray(),
		inView: flare.inView.value, visibility: new Float32Array( await readBuffer( flare.visibility, 4 ) )[ 0 ],
		strength: flare.strength.value, anamorphic: flare.anamorphic.value };
	views.push( view ); console.log( JSON.stringify( view ) );

}
// Dense camera-only coverage complements the rendered/occluded samples above.
const coverage = [];
for ( let elapsed = 0; elapsed <= 21; elapsed += .05 ) {

	reveal.state = { ...initial, elapsed }; reveal.apply(); app.post.flare.update( app.camera, 1 / 60 );
	coverage.push( { seconds: elapsed / reveal.settings.speed, inView: app.post.flare.inView.value } );

}
const admissionSeconds = coverage.filter( p => p.inView > .1 ).length * .05 / reveal.settings.speed;
writeSheet( resolve( out, 'sequence.png' ), images, portrait ? 4 : 3 );
writeFileSync( resolve( out, 'report.json' ), JSON.stringify( { errors, admissionSeconds, views, coverage }, null, 2 ) );
console.log( `Admission > 10% for ${ admissionSeconds.toFixed( 2 ) }s of the ${ reveal.duration }s reveal; GPU errors: ${ errors }` );
if ( errors ) throw new Error( `${ errors } GPU validation errors` );
process.exit( 0 );
