import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import '../../test/headless.mjs';
import { installBrowser } from './browser.mjs';
import { writePNG, bgraShot, writeSheet } from './png.mjs';

const portrait = process.argv.includes( '--portrait' );
const width = portrait ? 390 : 1280, height = portrait ? 844 : 720;
const out = resolve( 'artifacts/weather-observations', portrait ? 'portrait' : 'desktop' );
mkdirSync( out, { recursive: true } );
installBrowser( { search: '?bench&noAudio&weatherObservationsPreview=18', width, height, root: resolve( 'public' ) } );
await import( '../../src/core/BenchSeed.js' );
const { App } = await import( '../../src/App.js' );
const { Story } = await import( '../../src/story/Story.js' );
const { Vector3 } = await import( '../../src/engine/index.js' );
const { TOWER, ROOM, STATION, updateDoor } = await import( '../../src/world/flannan/Station.js' );
const { Beams } = await import( '../../src/station/Beams.js' );
const { GPU } = await import( '../../src/engine/gpu/GPU.js' );
const { Texture } = await import( '../../src/engine/gpu/Texture.js' );
const { readTexture } = await import( '../../src/engine/gpu/Readback.js' );
const app = new App(); await app.init();
app.ui = { ui: { photoMode: false, toast() {} }, update() {} };
const s = app.story = new Story( app ); s.ui.card = s.ui.fade = async () => {};
await s.start(); s.paused = true;
for ( const door of s.doors.house ) { door.target = door.open = 1; updateDoor( door, 0 ); }
app.setFreeCam( true );
const output = new Texture( { width, height, format: GPU.format, usage: [ 'render', 'copySrc', 'sample' ], label: 'weather observation review' } );
app.post.outputTexture = output;
const balcony = new Vector3( Math.cos( TOWER.galleryDoor )*3.1, TOWER.deck+1.62, Math.sin( TOWER.galleryDoor )*3.1 );
const poses = [
 { name: 'barometer-six', p: ROOM.barometer.clone().add( new Vector3( 0, -.33, 1 ) ), at: ROOM.barometer, h: 18, instrument: 'pressure' },
 { name: 'barometer-nine', p: ROOM.barometer.clone().add( new Vector3( 0, -.33, 1 ) ), at: ROOM.barometer, h: 21, instrument: 'pressure' },
 { name: 'thermometer-six', p: ROOM.thermometer.clone().add( new Vector3( 0, .02, -1 ) ), at: ROOM.thermometer, h: 18, instrument: 'temperature' },
 { name: 'thermometer-nine', p: ROOM.thermometer.clone().add( new Vector3( 0, .02, -1 ) ), at: ROOM.thermometer, h: 21, instrument: 'temperature' },
 { name: 'roof-vane', p: new Vector3( -23, STATION.yard+1.62, -4.3 ), at: s.station.parts.windVane, h: 18, fov: 20 },
 { name: 'balcony-sea', p: balcony, at: new Vector3( 500, 0, 100 ), h: 18 },
 { name: 'gallan-clear', p: balcony, at: s.her.clone(), h: 18, fov: 8 },
 { name: 'gallan-haar', p: balcony, at: s.her.clone(), h: 21, fov: 8 },
 { name: 'island-darkness', p: balcony, at: s.weatherObservations.landmarkPosition( 'near' ), h: 18, fov: 30 },
];
const shots = [];
for ( const pose of poses ) {
 s.h = pose.h; s._applyClock();
 // Hold the existing lamp at its normal on-state for a matched haze comparison.
 // In play, the controller reads its current output, including fade/darkness.
 s.watcher.lamp = 1;
 Beams.uniforms.far.value[0].set( s.her.x, s.her.y, s.her.z, 1.5e5 );
 app.camera.position.copy( pose.p ); app.camera.lookAt( pose.at );
 app.camera.fov = pose.fov || 70; app.camera.updateProjectionMatrix();
 const dir = app.camera.getWorldDirection( new Vector3() );
 app.fly.setPose( pose.p.clone(), Math.atan2( -dir.x, -dir.z ), Math.asin( dir.y ) );
 const framing = pose.instrument ? pose.instrument === 'pressure' ? .188 : .52 : pose.fov ? 2*pose.p.distanceTo(pose.at)*.62*Math.tan(pose.fov*Math.PI/360) : null;
 s.weatherObservations.focus = framing ? { at: pose.at, key: pose.instrument || 'bearing', height: framing, previous: { camera: pose.p } } : null;
 s.weatherObservations.updateFocus();
 app.cameraCut(); app.post.autoExposure.snap.value = 1;
 for ( let i = 0; i < 30; i++ ) { app.frame( 1/60 ); await GPU.queue.onSubmittedWorkDone(); }
 const shot = await readTexture( output ), body = new Uint8Array( 8 + shot.data.byteLength );
 new Uint32Array( body.buffer, 0, 2 ).set( [ width, height ] ); body.set( new Uint8Array( shot.data ), 8 );
 const rgba = bgraShot( Buffer.from( body ) ); shots.push( rgba );
 writePNG( resolve( out, `${ pose.name }.png` ), width, height, rgba.rgba );
 console.log( `${ pose.name}: h=${ s.h }, fov=${ app.camera.fov.toFixed( 1 ) }` );
}
writeSheet( resolve( out, 'review.png' ), shots, portrait ? 3 : 2 );
process.exit( 0 );
