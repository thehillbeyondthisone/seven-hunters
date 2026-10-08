import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import '../../test/headless.mjs';
import { installBrowser } from './browser.mjs';
import { writePNG, bgraShot, writeSheet } from './png.mjs';

const out = resolve( 'artifacts/first-watch/experience' ), width = 960, height = 540;
mkdirSync( out, { recursive: true } );
installBrowser( { search: '?bench&noAudio&firstWatchPreview', width, height, root: resolve( 'public' ) } );
await import( '../../src/core/BenchSeed.js' );
const { App } = await import( '../../src/App.js' );
const { Story } = await import( '../../src/story/Story.js' );
const { TOWER, ROOM, updateDoor } = await import( '../../src/world/flannan/Station.js' );
const { VIEWS } = await import( '../../src/core/DebugViews.js' );
const { GPU } = await import( '../../src/engine/gpu/GPU.js' );
const { Texture } = await import( '../../src/engine/gpu/Texture.js' );
const { readTexture } = await import( '../../src/engine/gpu/Readback.js' );
const app = new App();
await app.init( ( p, label ) => { if ( label ) console.log( `${ Math.round( p * 100 ) }% ${ label }` ); } );
app.ui = { ui: { photoMode: false, toast() {} }, update() {} };
const s = app.story = new Story( app ); s.ui.card = s.ui.fade = async () => {};
await s.start(); s.paused = true;
for ( const door of s.doors.house ) { door.target = door.open = 1; updateDoor( door, 0 ); }
app.setFreeCam( true );
const output = new Texture( { width, height, format: GPU.format, usage: [ 'render', 'copySrc', 'sample' ], label: 'first watch review' } );
app.post.outputTexture = output;
app.post.autoExposure.snap.value = 1;
const apparatusFeet = [ Math.cos( TOWER.crankAngle ) * 1.95, TOWER.deck + 1.62, Math.sin( TOWER.crankAngle ) * 1.95 ];
const poses = [
	{ name: 'entering', ...VIEWS.dFirstRoom, h: 14.1 },
	{ name: 'your-bag', ...VIEWS.dFirstBag, h: 14.1 },
	{ name: 'desk-at-night', ...VIEWS.dFirstDesk, h: 19 },
	{ name: 'prepared-apparatus', p: apparatusFeet, at: [ 0, TOWER.deck + 1.6, 0 ], h: 14.9 },
	{ name: 'working-light', p: apparatusFeet, at: [ 0, TOWER.deck + 1.6, 0 ], h: 15.3, working: true },
];
const images = [];
for ( const pose of poses ) {
	s.h = pose.h; s._applyClock();
	s.beat = pose.working || pose.name === 'prepared-apparatus' ? 'machine' : 'letter';
	if ( pose.working ) { s.lamp.wind = .9; s.lamp.ignite(); s.lamp.start(); s.lamp.update( 30, 0 ); }
	else { s.lamp.extinguish(); s.lamp.stop(); s.lamp.glow = s.lamp.speed = 0; }
	s.keeper.sync();
	app.camera.position.set( ...pose.p ); app.camera.lookAt( ...pose.at );
	app.camera.fov = pose.fov || 70; app.camera.updateProjectionMatrix();
	const dir = app.camera.getWorldDirection( app.player.position.clone() );
	app.fly.setPose( app.camera.position.clone(), Math.atan2( -dir.x, -dir.z ), Math.asin( dir.y ) );
	app.cameraCut();
	for ( let i = 0; i < 24; i++ ) { app.frame( 1 / 60 ); await GPU.queue.onSubmittedWorkDone(); }
	const shot = await readTexture( output ), body = new Uint8Array( 8 + shot.data.byteLength );
	new Uint32Array( body.buffer, 0, 2 ).set( [ width, height ] ); body.set( new Uint8Array( shot.data ), 8 );
	const rgba = bgraShot( Buffer.from( body ) ); images.push( rgba );
	writePNG( resolve( out, `${ pose.name }.png` ), width, height, rgba.rgba );
	console.log( `${ pose.name}: ${ s.beat }, keeper routine ${ s.keeper.enabled }, weight cover ${ s.moving.weightCover.visible }` );
}
writeSheet( resolve( out, 'experience-sheet.png' ), images, 2 );
process.exit( 0 );
