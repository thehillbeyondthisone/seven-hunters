import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import '../../test/headless.mjs';
import { installBrowser } from './browser.mjs';
import { writePNG, bgraShot, writeSheet } from './png.mjs';

const width = 1100, height = 800, out = resolve( 'artifacts/unpacking-craft/game' );
mkdirSync( out, { recursive: true } );
installBrowser( { search: '?bench&noAudio&unpackingPreview', width, height, root: resolve( 'public' ) } );
await import( '../../src/core/BenchSeed.js' );
const { App } = await import( '../../src/App.js' );
const { Story } = await import( '../../src/story/Story.js' );
const { GPU } = await import( '../../src/engine/gpu/GPU.js' );
const { Texture } = await import( '../../src/engine/gpu/Texture.js' );
const { readTexture } = await import( '../../src/engine/gpu/Readback.js' );
const { Vector3 } = await import( '../../src/engine/index.js' );
const { TOWER } = await import( '../../src/world/flannan/Station.js' );
const errors = [], init = GPU.init.bind( GPU );
GPU.init = async options => {

	const result = await init( options );
	GPU.device.addEventListener( 'uncapturederror', e => errors.push( e.error.message ) );
	GPU.device.pushErrorScope( 'validation' ); return result;

};
const app = new App(); await app.init( ( p, label ) => { if ( label ) console.log( `${ Math.round( p * 100 ) }% ${ label }` ); } );
app.ui = { ui: { photoMode: false, toast() {} }, update() {} };
const s = app.story = new Story( app ); s.save = () => {}; s.ui.card = s.ui.fade = async () => {}; await s.start();
app.player.update = () => {}; s.update = () => s._applyClock(); s.arrival.update = () => {}; s.arrival.group.visible = false;
s.paused = false; s.hand.carried = true; s.hand.lit = true; s.hand.glow = 1; app.input.down = () => false;
const output = new Texture( { width, height, format: GPU.format, usage: [ 'render', 'copySrc', 'sample' ], label: 'Unpacking game review' } );
app.post.outputTexture = output;
const F = TOWER.floor, bag = new Vector3( -.8, F + .19, 5.03 );
const pose = ( position, at, fov = 60 ) => {

	app.camera.position.copy( position ); app.camera.lookAt( at ); app.camera.fov = fov; app.camera.updateProjectionMatrix();
	app.player.position.copy( position ).add( new Vector3( 0, -1.62, 0 ) );
	const d = at.clone().sub( position ).normalize(); app.player.yaw = Math.atan2( -d.x, -d.z ); app.player.pitch = Math.asin( d.y );
	app.cameraCut(); app.post.autoExposure.snap.value = 1;

};
const views = [
	[ '01-closed-bag', 0, () => pose( new Vector3( -1.12, F + 1.18, 4.15 ), bag, 58 ) ],
	[ '02-open-bag-and-contents', 1, () => pose( new Vector3( -.95, F + 1.12, 4.35 ), bag, 52 ) ],
	[ '03-unwrapped-brownie', 3, () => pose( new Vector3( -.94, F + .82, 4.53 ), bag, 49 ) ],
	[ '04-drying-clothes', 4, () => pose( new Vector3( -4.3, F + 1.10, 1.94 ), new Vector3( -4.7, F + .55, 2.55 ), 50 ) ],
	[ '05-brownie-and-note', 4, () => { const at = s.station.parts.unpacking.desk; pose( at.clone().add( new Vector3( .20, .20, .32 ) ), at, 42 ); } ],
];
const shots = [];
for ( const [ name, stage, setPose ] of views ) {

	s.flags.unpacking = { stage, examined: false }; s.unpacking.sync(); setPose();
	for ( let i = 0; i < 20; i++ ) { app.frame( 1 / 60 ); await GPU.queue.onSubmittedWorkDone(); }
	const raw = await readTexture( output ), body = new Uint8Array( 8 + raw.data.byteLength );
	new Uint32Array( body.buffer, 0, 2 ).set( [ width, height ] ); body.set( new Uint8Array( raw.data ), 8 );
	const shot = bgraShot( Buffer.from( body ) ); shots.push( shot ); writePNG( resolve( out, name + '.png' ), width, height, shot.rgba );
	console.log( name );

}
writeSheet( resolve( out, 'review.png' ), shots, 3 );
await GPU.pipelinesReady(); await GPU.queue.onSubmittedWorkDone();
const validation = await GPU.device.popErrorScope(); assert.equal( validation, null, validation?.message ); assert.deepEqual( errors, [] );
writeFileSync( resolve( out, 'verification.json' ), JSON.stringify( { views: views.map( ( [ name, stage ] ) => ( { name, stage } ) ), validationErrors: errors }, null, 2 ) );
console.log( 'PASS five game-rendered unpacking views with no WebGPU validation errors.' ); process.exit( 0 );
