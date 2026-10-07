// Full game's FFT/shore water, GPU readbacks and actual Story.update() path.
// Also writes the final review cameras; this is separate from analytic unit coverage.
import './headless.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { installBrowser } from '../tools/shots/browser.mjs';
import { bgraShot, writePNG, writeSheet } from '../tools/shots/png.mjs';

const detailed = process.argv.includes( '--atmosphere' );
const out = resolve( detailed ? 'artifacts/arrival-atmosphere/sea-check' : 'artifacts/boat-visual-pass/final' ), images = [];
mkdirSync( out, { recursive: true } );
installBrowser( { search: '?bench&noAudio&setting=flannan&arrivalPreview' + ( detailed ? '&arrivalAtmospherePreview' : '' ), width: 640, height: 360, root: resolve( 'public' ),
	onPost: async ( url, bytes ) => {
		const img = bgraShot( Buffer.from( bytes.buffer, bytes.byteOffset, bytes.byteLength ) );
		writePNG( join( out, decodeURIComponent( url.split( '/' ).pop() ).replace( '.bgra', '.png' ) ), img.w, img.h, img.rgba );
		images.push( img );
	},
} );
const { App } = await import( '../src/App.js' );
const { Story } = await import( '../src/story/Story.js' );
const { Bench } = await import( '../src/core/Bench.js' );
const { GPU } = await import( '../src/engine/gpu/GPU.js' );
const { G } = await import( '../src/engine/render/Frame.js' );
const app = new App();
await app.init( ( p, t ) => { if ( t ) console.log( `${ Math.round( p * 100 ) }% ${ t }` ); } );
const errors = [];
GPU.device.addEventListener( 'uncapturederror', ( e ) => errors.push( e.error.message ) );
app.story = new Story( app );
if ( detailed ) assert.equal( app.story.saveKey, 'sevenhunters.arrival-atmosphere-preview.v1', 'separate arrival study save' );
app.setFreeCam( false );
let minimumLens = Infinity, checks = 0, maxHeave = -Infinity, minHeave = Infinity;
const phases = [ [ 'title', 20, true ], [ 'crossing', 35, false ], [ 'papers', 20, true ], [ 'approach', 60, false ], [ 'landing wait', 20, false ] ];
for ( const [ name, seconds, paused ] of phases ) {
	app.story.beat = 'crossing'; app.story.paused = paused;
	const elapsed = app.arrival.elapsed;
	for ( let i = 0; i < seconds * 10; i ++ ) {
		app.frame( 0.1 ); await GPU.queue.onSubmittedWorkDone();
		await new Promise( ( r ) => setImmediate( r ) ); // let mapAsync callbacks deliver real results
		if ( i < 8 || ! app.arrival.hasWater ) continue;
		const clearance = app.camera.position.y - app.query.cpu[ 0 ];
		minimumLens = Math.min( minimumLens, clearance ); checks ++;
		assert.ok( clearance > 0.65, `${ name }: passenger lens above real queried sea (${ clearance }m)` );
		assert.equal( G.cameraUnderwater.value, 0, `${ name }: underwater camera state remains off` );
		maxHeave = Math.max( maxHeave, app.arrival.heave ); minHeave = Math.min( minHeave, app.arrival.heave );
	}
	if ( paused ) assert.equal( app.arrival.elapsed, elapsed, `${ name } holds crossing progress` );
	console.log( `PASS ${ name }: route ${ app.arrival.elapsed.toFixed( 1 ) }s, minimum lens ${ minimumLens.toFixed( 2 ) }m` );
}
assert.ok( checks > 1000, 'enough actual sea frames sampled' );
assert.ok( maxHeave - minHeave > 0.3, 'hull responds to the actual FFT sea' );
assert.ok( app.arrival.ready, 'approach completes and waits to land' );
assert.deepEqual( errors, [], 'no WebGPU validation errors' );
const report = { checks, simulatedSeconds: 155, dt: 0.1, minimumLens, heaveRange: [ minHeave, maxHeave ], errors };
writeFileSync( join( out, 'flotation.json' ), JSON.stringify( report, null, 2 ) + '\n' );
console.log( 'PASS real FFT / shore sea', report );
// Final matching review renders after the motion check.
app.story = null;
const bench = new Bench( app );
await bench.shots( [ 'dCrossing', 'dBoatPapers', 'dBoatCrew', 'dBoatSide', 'dBoatLanding' ], { tag: 'boat', frames: 48, dt: 1 / 60, width: 960, height: 540 } );
writeSheet( join( out, 'boat-sheet.png' ), images, 3 );
assert.deepEqual( errors, [], 'review cameras have no GPU validation errors' );
console.log( 'Review images:', out );
process.exit( 0 );
