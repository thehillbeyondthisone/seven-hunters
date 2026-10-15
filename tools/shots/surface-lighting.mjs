// Matched station plaster review. No story or persistent saves are started.
import '../../test/headless.mjs';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { installBrowser } from './browser.mjs';
import { bgraShot, writePNG } from './png.mjs';

const tag = process.argv[ 2 ] || 'after';
const mobile = process.env.SURFACE_REVIEW_MOBILE === '1';
const width = mobile ? 844 : 1340, height = mobile ? 550 : 880;
const directory = fileURLToPath( new URL( `../../artifacts/surface-lighting/${ tag }/`, import.meta.url ) );
if ( tag === 'before' && existsSync( directory + 'capture.json' ) ) throw new Error( 'The original baseline is preserved. Choose another tag to capture the current materials.' );
mkdirSync( directory, { recursive: true } );
let errors = 0;
const report = console.error;
console.error = ( ...args ) => { errors ++; report( ...args ); };
installBrowser( {
	search: '?bench&noAudio&setting=flannan&adapt&handlamp' + ( mobile ? '&mobile' : '' ), width, height,
	root: fileURLToPath( new URL( '../../public/', import.meta.url ) ),
	onPost: async ( url, body ) => {
		const name = decodeURIComponent( url.split( '/' ).pop() ).replace( /\.bgra$/, '' );
		const shot = bgraShot( Buffer.from( body.buffer, body.byteOffset, body.byteLength ) );
		writePNG( directory + name + '.png', shot.w, shot.h, shot.rgba );
		console.log( 'saved', name );
	},
} );
await import( '../../src/core/BenchSeed.js' );
const { App } = await import( '../../src/App.js' );
const { startBench } = await import( '../../src/core/Bench.js' );
const { GPU } = await import( '../../src/engine/gpu/GPU.js' );
const { VIEWS } = await import( '../../src/core/DebugViews.js' );
const corner = { p: [ -23.1, 82.3, -3.0 ], at: [ -21.3, 82.1, -1.25 ], fov: 74, vis: 60 };
const views = {
	cornerLamp: { ...corner, time: 19.47 },
	cornerDay: { ...corner, time: 12.4 },
	wallFrontal: { p: [ -21.0, 82.3, -2.85 ], at: [ -21.0, 82.3, -1.8 ], fov: 68, time: 19.47 },
	wallGrazing: { p: [ -21.6, 82.3, -2.25 ], at: [ -19.3, 82.25, -1.8 ], fov: 68, time: 19.47 },
	roomLamp: { p: [ -4, 82.67, .1 ], at: [ -4.1, 82.4, -1.2 ], fov: 68, time: 19.47 },
};
for ( const [ name, view ] of Object.entries( views ) ) {
	const [ x, y, z ] = view.p, [ tx, ty, tz ] = view.at;
	VIEWS[ name ] = { ...view, yaw: Math.atan2( x - tx, z - tz ), pitch: Math.atan2( ty - y, Math.hypot( tx - x, tz - z ) ) };
}
const app = new App();
let stage = '';
await app.init( ( p, message ) => {
	if ( message && message !== stage ) console.log( `${ Math.round( p * 100 ) }% ${ stage = message }` );
} );
const bench = startBench( app );
// Keep the carried lamp light, but omit its model as in the supplied close-up.
await bench.shots( Object.keys( views ), { tag, frames: 32, width, height, dt: 1 / 60 } );
await GPU.device.queue.onSubmittedWorkDone();
if ( errors ) throw new Error( `${ errors } render errors; review is invalid.` );
writeFileSync( directory + 'capture.json', JSON.stringify( { tag, views, width, height, frames: 32, dt: 1 / 60, gpuErrors: errors, mobile, textureLimit: GPU.limits.maxSampledTexturesPerShaderStage }, null, 2 ) );
console.log( 'Surface lighting review completed without render errors.' );
process.exit( 0 );
