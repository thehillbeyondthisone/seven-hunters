import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import '../../test/headless.mjs';
import { installBrowser } from './browser.mjs';
import { writePNG, bgraShot, writeSheet } from './png.mjs';

const out = resolve( 'artifacts/keeper-weight' ), width = 960, height = 540;
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
await s.start(); s.paused = true;
s.flags.keeperDuty = { inspected: true, verified: true };
s.lamp.wind = .88; s.lamp.start(); s.lamp.ignite(); s.lamp.glow = s.lamp.speed = 1;
s.keeper.drive.sync( s.lamp.wind );
const at = s.keeper.drive.at;
const treads = Array.from( { length: TOWER.count }, ( _, i ) => ( { a: TOWER.start + ( i + .5 ) * TOWER.dTread, y: TOWER.floor + ( i + 1 ) * TOWER.riser } ) )
 .filter( t => Math.cos( t.a - TOWER.hatch.angle ) > .65 )
 .sort( ( a, b ) => Math.abs( a.y + 1.62 - at.y ) - Math.abs( b.y + 1.62 - at.y ) );
const tread = treads[ 0 ];
app.player.position.set( Math.cos( tread.a ) * 1.0, tread.y, Math.sin( tread.a ) * 1.0 );
app.camera.position.copy( app.player.position ); app.camera.position.y += 1.62;
app.camera.lookAt( at );
app.setFreeCam( true );
app.handInView = true; s.hand.glow = 1;
const direction = at.clone().sub( app.camera.position ).normalize();
app.fly.setPose( app.camera.position.clone(), Math.atan2( -direction.x, -direction.z ), Math.asin( direction.y ) );
app.cameraCut();
const output = new Texture( { width, height, format: GPU.format, usage: [ 'render', 'copySrc', 'sample' ], label: 'keeper weight review' } );
app.post.outputTexture = output;
const images = [];
for ( const name of [ 'weight-before', 'weight-descended' ] ) {
 if ( name === 'weight-descended' ) s.lamp.update( 0, .06 );
 s.keeper.drive.sync( s.lamp.wind );
 for ( let i = 0; i < 16; i ++ ) { app.frame( 1 / 60 ); await GPU.queue.onSubmittedWorkDone(); }
 const shot = await readTexture( output ), body = new Uint8Array( 8 + shot.data.byteLength );
 new Uint32Array( body.buffer, 0, 2 ).set( [ width, height ] ); body.set( new Uint8Array( shot.data ), 8 );
 const rgba = bgraShot( Buffer.from( body ) ); images.push( rgba );
 writePNG( resolve( out, `${ name }.png` ), width, height, rgba.rgba );
 console.log( `${ name}: weight ${ s.keeper.drive.at.y.toFixed( 3 ) } m; wind ${ s.lamp.wind.toFixed( 3 ) }` );
}
writeSheet( resolve( out, 'weight-sheet.png' ), images, 2 );
process.exit( 0 );
