import './headless.mjs';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { installBrowser } from '../tools/shots/browser.mjs';
import { bgraShot, writePNG } from '../tools/shots/png.mjs';
const out = fileURLToPath( new URL( '../artifacts/mobile-play/', import.meta.url ) ); mkdirSync( out, { recursive:true } );
let errors = 0; const report = console.error;
console.error = ( ...args ) => { if ( /WebGPU|WGSL|pipeline.*failed/i.test( args.join( ' ' ) ) ) errors ++; report( ...args ); };
installBrowser( { search:'?bench&mobile&noAudio&adapt&lamp', width:844, height:390,
	root:fileURLToPath( new URL( '../public/', import.meta.url ) ),
	onPost:async ( url, body ) => { const name = decodeURIComponent( url.split( '/' ).pop() ).replace( /\.bgra$/, '' ); const shot = bgraShot( Buffer.from( body.buffer, body.byteOffset, body.byteLength ) ); writePNG( out + name + '.png', shot.w, shot.h, shot.rgba ); console.log( 'saved', name ); },
} );
await import( '../src/core/BenchSeed.js' );
const { App } = await import( '../src/App.js' ); const { startBench } = await import( '../src/core/Bench.js' );
const { GPU } = await import( '../src/engine/gpu/GPU.js' );
const app = new App(); let last = '';
await app.init( ( p, message ) => { if ( message && message !== last ) console.log( Math.round( p*100 ) + '% ' + ( last = message ) ); } );
if ( ! app.isMobile || app.surface.wake || app.waterMaterial.refraction ) throw new Error( 'Mobile graphics profile not active' );
await startBench( app ).shots( [ 'fApproach', 'dRoom', 'dLantern', 'dCrossing', 'dBeams' ], { tag:'mobile',frames:8,width:844,height:390,dt:1/60 } );
await GPU.device.queue.onSubmittedWorkDone();
if ( errors ) throw new Error( `${ errors } GPU/shader errors in mobile renders` );
console.log( 'Mobile render checks passed; sampled texture limit:', GPU.limits.maxSampledTexturesPerShaderStage ); process.exit( 0 );
