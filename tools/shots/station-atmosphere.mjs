// Matched working-apparatus and stair review, using the save-isolated keeper study.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import '../../test/headless.mjs';
import { installBrowser } from './browser.mjs';
import { writePNG, bgraShot, writeSheet } from './png.mjs';

const out = resolve( 'artifacts/climb-apparatus/duties' ), width = 1200, height = 675;
mkdirSync( out, { recursive: true } );
installBrowser( { search: '?bench&noAudio&keeperPreview', width, height, root: resolve( 'public' ) } );
await import( '../../src/core/BenchSeed.js' );
const { App } = await import( '../../src/App.js' );
const { Story } = await import( '../../src/story/Story.js' );
const { TOWER: T } = await import( '../../src/world/flannan/Station.js' );
const { VIEWS } = await import( '../../src/core/DebugViews.js' );
const { GPU } = await import( '../../src/engine/gpu/GPU.js' );
const { Texture } = await import( '../../src/engine/gpu/Texture.js' );
const { readTexture } = await import( '../../src/engine/gpu/Readback.js' );
const app = new App();
await app.init( ( p, label ) => { if ( label ) console.log( `${ Math.round( p * 100 ) }% ${ label }` ); } );
app.ui = { ui: { photoMode: false, toast() {} }, update() {} };
const s = app.story = new Story( app ); s.ui.card = s.ui.fade = async () => {};
await s.start(); s.paused = true;
app.setFreeCam( true );
const output = new Texture( { width, height, format: GPU.format, usage: [ 'render', 'copySrc', 'sample' ], label: 'apparatus study review' } );
app.post.outputTexture = output; app.post.autoExposure.snap.value = 1;
const crankEye = [ Math.cos( T.crankAngle ) * 1.95, T.deck + 1.62, Math.sin( T.crankAngle ) * 1.95 ];
const H = T.hatch, hp = ( run, across, y ) => [ Math.cos( H.angle ) * ( H.r + across ) - Math.sin( H.angle ) * run, y, Math.sin( H.angle ) * ( H.r + across ) + Math.cos( H.angle ) * run ];
const poses = [
	...[ 12.4, 15.3, 19 ].map( h => ( { name: `burner-${ h }`, p: crankEye, at: [ 0, s.station.focal - .1, 0 ], h, working: true } ) ),
	{ name: 'winding-cabinet', p: crankEye, at: T.crank.toArray(), h: 19, working: true, hand: true },
	{ name: 'hatch-fittings', p: hp( .1, 0, T.landing + 1.62 ), at: hp( H.run, 0, T.deck + .5 ), h: 19, hand: true, working: true },
	{ name: 'stair-with-lantern', ...VIEWS.dStair, h: 19, hand: true },
	{ name: 'raised-weight', h: 19, working: true, hand: true, weight: .96 },
	{ name: 'descending-weight', h: 19, working: true, hand: true, weight: .86 },
];
const images = [];
for ( const pose of poses ) {
	s.h = pose.h; s._applyClock(); s.beat = 'machine';
	s.lamp.wind = pose.weight ?? .9; s.lamp.running = !!pose.working; s.lamp.lit = !!pose.working;
	s.lamp.glow = pose.working ? 1 : 0; s.lamp.speed = pose.working ? 1 : 0; s.lamp.angle = .12; s.lamp.update( 0, 0 );
	s.keeper.sync(); app.handLamp.carried = true; app.handLamp.lit = !!pose.hand; app.handLamp.glow = pose.hand ? 1 : 0; app.handInView = !!pose.hand;
	if ( pose.weight !== undefined ) {
		const at = s.keeper.drive.at;
		const candidates = Array.from( { length: T.count }, ( _, i ) => ( { a: T.start + ( i + .5 ) * T.dTread, y: T.floor + ( i + 1 ) * T.riser } ) )
			.filter( t => Math.cos( t.a - H.angle ) > .65 && t.y + 1.62 < T.landing - .12 ).sort( ( a, b ) => Math.abs( a.y + 1.62 - at.y ) - Math.abs( b.y + 1.62 - at.y ) );
		const tread = candidates[ 0 ]; pose.p = [ Math.cos( tread.a ), tread.y + 1.62, Math.sin( tread.a ) ]; pose.at = at.toArray();
	}
	app.camera.position.set( ...pose.p );
	if ( pose.at ) app.camera.lookAt( ...pose.at );
	app.camera.fov = pose.fov || 70; app.camera.updateProjectionMatrix();
	const dir = app.camera.getWorldDirection( app.player.position.clone() );
	app.fly.setPose( app.camera.position.clone(), pose.yaw ?? Math.atan2( -dir.x, -dir.z ), pose.pitch ?? Math.asin( dir.y ) ); app.fly.velocity.set( 0, 0, 0 );
	app.cameraCut();
	for ( let i = 0; i < 24; i ++ ) { app.frame( 1 / 60 ); await GPU.queue.onSubmittedWorkDone(); }
	const shot = await readTexture( output ), body = new Uint8Array( 8 + shot.data.byteLength );
	new Uint32Array( body.buffer, 0, 2 ).set( [ width, height ] ); body.set( new Uint8Array( shot.data ), 8 );
	const rgba = bgraShot( Buffer.from( body ) ); images.push( rgba ); writePNG( resolve( out, `${ pose.name }.png` ), width, height, rgba.rgba );
	console.log( `${ pose.name}: fixed flame ${ s.lamp.glow }, optic speed ${ s.lamp.speed }, weight ${ s.lamp.wind.toFixed( 2 ) }` );
}
writeSheet( resolve( out, 'duties-sheet.png' ), images, 3 );
writeFileSync( resolve( out, 'poses.json' ), JSON.stringify( poses, null, 2 ) );
process.exit( 0 );
