import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import '../../test/headless.mjs';
import { installBrowser } from './browser.mjs';
import { writePNG, bgraShot, writeSheet } from './png.mjs';

const out = resolve( 'artifacts/morning-servicing' ), width = 960, height = 600;
mkdirSync( out, { recursive: true } );
installBrowser( { search: '?bench&noAudio&morningPreview', width, height, root: resolve( 'public' ) } );
await import( '../../src/core/BenchSeed.js' );
const { App } = await import( '../../src/App.js' );
const { Story } = await import( '../../src/story/Story.js' );
const { TOWER, updateDoor } = await import( '../../src/world/flannan/Station.js' );
const { GPU } = await import( '../../src/engine/gpu/GPU.js' );
const { Texture } = await import( '../../src/engine/gpu/Texture.js' );
const { readTexture } = await import( '../../src/engine/gpu/Readback.js' );
const app = new App();
await app.init( ( p, label ) => { if ( label ) console.log( `${ Math.round( p * 100 ) }% ${ label }` ); } );
app.ui = { ui: { photoMode: false, toast() {} }, update() {} };
const s = app.story = new Story( app ); s.ui.card = async () => {};
await s.start();
const m = s.morning, q = m.state, F = m.layout.floor, a = m.layout.angle;
// Fixed engine views of documented study states. Interaction and walking
// acceptance are tested separately; these frames verify the actual meshes.
m.update = () => { s._applyClock(); m.sync(); };
s.lamp.extinguish(); s.lamp.stop(); s.lamp.glow = s.lamp.speed = 0;
for ( const d of s.moving.doors ) { if ( [ 'house', 'oilStore' ].includes( d.name ) ) d.target = d.open = 1; updateDoor( d, 0 ); }
app.setFreeCam( true );
const output = new Texture( { width, height, format: GPU.format, usage: [ 'render', 'copySrc', 'sample' ], label: 'morning service review' } );
app.post.outputTexture = output; app.post.autoExposure.snap.value = 1;
const r = ( radius, y, ang = a ) => [ Math.cos( ang ) * radius, y, Math.sin( ang ) * radius ];
const poses = [
	{ name: 'oil-store', p: [ 9.3, F + 1.62, -1.2 ], at: [ 9.3, F + 1.1, -3.7 ], fov: 75 },
	{ name: 'carrying-can-and-kit', p: [ 9.3, F + 1.62, -.8 ], at: [ 9.3, F + .9, 2.5 ], stage: () => { q.canPlace = q.kitPlace = 'carried'; q.oil.can = .65; q.oil.bulk = 2.35; } },
	{ name: 'apparatus-before', p: r( 1.95, TOWER.deck + 1.7, a -.12 ), at: [ 0, m.layout.focal - .2, 0 ], stage: () => { q.canPlace = q.kitPlace = 'shelf'; } },
	{ name: 'service-opening', p: r( 1.95, m.layout.focal - .3 ), at: [ 0, m.layout.focal - .25, 0 ], fov: 78, stage: () => { q.panelOpen = true; } },
	{ name: 'wiping-the-glass', p: r( 1.95, m.layout.focal - .3, a -.35 ), at: m.at( 'glass' ).toArray(), stage: () => { m.motion = { action: 'glass', t: 1 }; } },
	{ name: 'replenishing-oil', p: r( 1.95, TOWER.deck + 1.65, a + .8 ), at: m.at( 'fountain' ).toArray(), stage: () => { q.fountainCapped = q.canCapped = false; m.motion = { action: 'pour', t: 1 }; } },
	{ name: 'apparatus-prepared', p: r( 1.95, TOWER.deck + 1.7, a -.12 ), at: [ 0, m.layout.focal - .2, 0 ], stage: () => { q.panelOpen = false; q.glass = q.housing = q.wick = 0; q.canCapped = q.fountainCapped = true; q.oil.fountain = 1; q.oil.can = 0; s.lamp.wind = 1; m.motion = null; } },
];
const images = [];
for ( const pose of poses ) {
	pose.stage?.();
	app.camera.position.set( ...pose.p ); app.camera.lookAt( ...pose.at ); app.camera.fov = pose.fov || 70; app.camera.updateProjectionMatrix();
	const dir = app.camera.getWorldDirection( app.player.position.clone() );
	app.fly.setPose( app.camera.position.clone(), Math.atan2( -dir.x, -dir.z ), Math.asin( dir.y ) ); app.cameraCut();
	for ( let i = 0; i < 24; i++ ) { app.frame( 1 / 60 ); await GPU.queue.onSubmittedWorkDone(); }
	const shot = await readTexture( output ), body = new Uint8Array( 8 + shot.data.byteLength );
	new Uint32Array( body.buffer, 0, 2 ).set( [ width, height ] ); body.set( new Uint8Array( shot.data ), 8 );
	const rgba = bgraShot( Buffer.from( body ) ); images.push( rgba ); writePNG( resolve( out, `${ pose.name }.png` ), width, height, rgba.rgba );
	console.log( `Rendered ${ pose.name }` );
}
writeSheet( resolve( out, 'morning-sheet.png' ), images, 2 );
writeFileSync( resolve( out, 'index.html' ), `<!doctype html><meta charset="utf-8"><title>Morning service · engine review</title><style>body{background:#10191d;color:#eee4cf;font:18px/1.5 Georgia;margin:30px}img{max-width:100%;display:block}figure{margin:25px 0}a{color:#f5d6a1}</style><h1>Preparing the next light</h1><p>Engine-rendered study states. Access, containers, tools and conditions are authored reconstructions. These staged views establish rendering, not completion of the interaction flow or physical-device acceptance.</p><p><a href="../../morning-servicing.html">Play the morning study</a></p>${ poses.map( p => `<figure><figcaption>${ p.name.replaceAll( '-', ' ' ) }</figcaption><img src="${ p.name }.png"></figure>` ).join( '' ) }` );
process.exit( 0 );
