// Continuous first-person replay through the real App / Story / KeeperSafety path.
// Starts at a prepared storm checkpoint just inland of the upper west lookout.
// No free camera, forced route damage, replacement animation, or exposure override.
// node tools/shots/review-storm.mjs --preview [--max-seconds=8]
// node tools/shots/review-storm.mjs [--width=960 --height=540 --fps=30]
import '../../test/headless.mjs';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { installBrowser } from './browser.mjs';
import { bgraShot, writePNG, writeSheet } from './png.mjs';

const args = new Set( process.argv.slice( 2 ) );
const option = ( name, fallback ) => Number( process.argv.find( a => a.startsWith( `--${name}=` ) )?.split( '=' )[ 1 ] ?? fallback );
const preview = args.has( '--preview' );
const width = option( 'width', preview ? 640 : 960 ), height = option( 'height', preview ? 360 : 540 );
// Keep the walker at the same 30 Hz for previews and the final replay. Coarser
// ten-Hz stepping can skip an ascending tread during the return.
const fps = option( 'fps', 30 ), dt = 1 / fps;
const maxSeconds = option( 'max-seconds', 55 );
assert.ok( fps >= 10 && fps <= 60, 'Use 10–60 fps so the real simulation step stays at or below .1 seconds.' );
const out = resolve( 'artifacts/story-review/storm' ), runName = preview ? 'scope-preview' : 'scope-gameplay';
mkdirSync( out, { recursive: true } );

function findFFmpeg() {

	if ( process.env.FFMPEG_BIN ) return process.env.FFMPEG_BIN;
	// Managed shells can redirect LOCALAPPDATA to a sandbox package. Search the
	// ordinary user profile as well for the installed read-only runtime.
	const bases = [ process.env.LOCALAPPDATA && join( process.env.LOCALAPPDATA, 'hermes', 'tools' ), join( homedir(), 'AppData', 'Local', 'hermes', 'tools' ) ].filter( Boolean );
	for ( const base of bases ) if ( existsSync( base ) ) {

		for ( const name of readdirSync( base ).filter( n => n.startsWith( 'ffmpeg-' ) ).sort().reverse() ) {

			const file = join( base, name, 'bin', 'ffmpeg.exe' );
			if ( existsSync( file ) ) return file;

		}

	}
	return 'ffmpeg';

}

const ffmpegBinary = preview ? null : findFFmpeg();
if ( ffmpegBinary ) {

	const probe = spawnSync( ffmpegBinary, [ '-hide_banner', '-version' ], { windowsHide: true, encoding: 'utf8' } );
	assert.equal( probe.status, 0, `Cannot launch ffmpeg before scene startup: ${probe.error?.message || probe.stderr}` );

}

installBrowser( { search: '?bench&coastalReview&stormPreview&noAudio', width, height, root: resolve( 'public' ) } );
await import( '../../src/core/BenchSeed.js' );
const { App } = await import( '../../src/App.js' );
const { Story } = await import( '../../src/story/Story.js' );
const { Bench } = await import( '../../src/core/Bench.js' );
const { GPU } = await import( '../../src/engine/gpu/GPU.js' );
const { Texture } = await import( '../../src/engine/gpu/Texture.js' );
const { readTexture } = await import( '../../src/engine/gpu/Readback.js' );
const { Vector3 } = await import( '../../src/engine/index.js' );
const { G } = await import( '../../src/core/Globals.js' );

const errors = [], init = GPU.init.bind( GPU );
GPU.init = async options => {

	const result = await init( options );
	GPU.device.addEventListener( 'uncapturederror', e => errors.push( e.error.message ) );
	GPU.device.pushErrorScope( 'validation' );
	return result;

};

const app = new App();
let stage = '';
await app.init( ( progress, label ) => {

	if ( label && label !== stage ) console.log( `${Math.round( progress * 100 )}% ${stage = label}` );

} );
app.engine.stop();
new Bench( app ).setSize( width, height );
app.ui = { ui: { photoMode: false, toast() {} }, update() {} };
const s = app.story = new Story( app );
s.save = () => {};
s.ui.card = s.ui.fade = async () => {};
await s.start();

const storm = s.storm, player = app.player, keys = new Set();
app.input.down = code => keys.has( code );
app.input.hit = () => false;
app.input.consumeLook = () => ( { x: 0, y: 0 } );
app.input.enabled = true;
app.freeCam = false;
storm.state.oilTaken = storm.state.oilStowed = storm.state.secured = true;
s.lamp.wind = 1;
storm.prepared();
assert.equal( s.beat, 'storm-look' );

// A prepared checkpoint is the only staged state. From here the actual walker,
// collision world, scope observation gate and coupled wave impact run normally.
const track = s.station.tracks.west;
const home = new Vector3( track[ 1 ][ 0 ], 0, track[ 1 ][ 1 ] );
const inland = home.clone().sub( storm.lookout ); inland.y = 0; inland.normalize();
const start = storm.lookout.clone().addScaledVector( inland, 7 );
const startTerrain = app.terrainData.heightAt( start.x, start.z );
start.y = player.groundAt( start.x, start.z, Math.max( startTerrain, storm.lookout.y ) + 8 );
player.position.copy( start ); player.mode = 'walk'; player.grounded = true;
player.velocity.set( 0, 0, 0 ); player._camY = null;
const directionTo = target => {

	const d = target.clone().sub( app.camera.position );
	return { yaw: Math.atan2( - d.x, - d.z ), pitch: Math.atan2( d.y, Math.hypot( d.x, d.z ) ) };

};
player.yaw = Math.atan2( storm.lookout.x - start.x, storm.lookout.z - start.z ) + Math.PI;
player.pitch = - .10;
player.update( 0 );
app.camera.updateMatrixWorld();
// Begin with established gale weather, as it is by the end of the full walk
// from the station. This does not advance the coastal event or the Story.
for ( let i = 0; i < 600; i ++ ) app.seaWeather.update( .1 );
G.time.value = 1000;
app.cameraCut();
const output = new Texture( { width, height, format: GPU.format, usage: [ 'render', 'copySrc', 'sample' ], label: 'Storm gameplay capture' } );
app.post.outputTexture = output;
for ( let i = 0; i < 24; i ++ ) { app.frame( 0 ); await GPU.queue.onSubmittedWorkDone(); }

let encoder = null, encoderDone = null, encoderError = '', frames = 0;
const movie = join( out, 'review-storm-scope.mp4' );
if ( ! preview ) {

	encoder = spawn( ffmpegBinary, [ '-y', '-hide_banner', '-loglevel', 'warning', '-f', 'rawvideo', '-pixel_format', GPU.format.startsWith( 'bgra' ) ? 'bgra' : 'rgba', '-video_size', `${width}x${height}`, '-framerate', String( fps ), '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', movie ], { windowsHide: true } );
	encoder.stderr.on( 'data', data => { encoderError += data.toString(); } );
	encoder.stdin.on( 'error', () => {} );
	encoderDone = new Promise( ( resolveEncoder, reject ) => {

		encoder.on( 'error', reject );
		encoder.on( 'close', code => code === 0 ? resolveEncoder() : reject( new Error( `ffmpeg exited ${code}: ${encoderError}` ) ) );

	} );

}

const checkpoints = [], shots = [], beats = [], saved = new Set();
let arrived = false, returnAt = null, destroyedSeen = false;
let minEyeClearance = Infinity, maxTreadError = 0;
let previousBeat = s.beat;
beats.push( { seconds: 0, beat: s.beat } );
const shortest = angle => Math.atan2( Math.sin( angle ), Math.cos( angle ) );
const steer = ( target, rate = 2.8 ) => {

	const aim = directionTo( target );
	player.yaw += shortest( aim.yaw - player.yaw ) * Math.min( 1, rate * dt );
	player.pitch += ( aim.pitch - player.pitch ) * Math.min( 1, rate * dt );

};
const checkpoint = ( name, seconds, raw ) => {

	if ( saved.has( name ) ) return;
	saved.add( name );
	const bytes = new Uint8Array( 8 + raw.data.byteLength );
	new Uint32Array( bytes.buffer, 0, 2 ).set( [ raw.width, raw.height ] );
	bytes.set( new Uint8Array( raw.data ), 8 );
	const image = bgraShot( Buffer.from( bytes ) );
	writePNG( join( out, `${runName}-${name}.png` ), image.w, image.h, image.rgba );
	shots.push( image );
	checkpoints.push( { name, seconds: + seconds.toFixed( 3 ), beat: s.beat, coastalTime: app.coastal.time, rogue: app.coastal.rogue, routeDestroyed: !! storm.state.routeDestroyed, position: player.position.toArray(), camera: app.camera.position.toArray(), fov: app.camera.fov, scopeActive: storm.cutscene.active } );
	console.log( `${seconds.toFixed( 1 )}s ${name}: ${s.beat}` );

};

try {

	for ( let i = 0; i < Math.ceil( maxSeconds * fps ); i ++ ) {

		const seconds = i / fps;
		if ( ! arrived ) {

			const distance = Math.hypot( player.position.x - storm.lookout.x, player.position.z - storm.lookout.z );
			if ( distance > .28 ) {

				const aim = storm.lookout.clone(); aim.y = player.position.y + 1.2;
				// W and collision resolve position. Camera turns continuously.
				steer( aim, 8 ); keys.add( 'KeyW' );

			} else { arrived = true; keys.clear(); }

		} else if ( returnAt === null || seconds - returnAt < 2 ) {

			keys.clear(); steer( storm.damageTarget );

		} else {

			const aim = home.clone(); aim.y = app.terrainData.heightAt( home.x, home.z ) + 1.62;
			steer( aim, 1.4 );
			if ( seconds - returnAt > 3.4 ) keys.add( 'KeyW' );

		}
		app.frame( dt );
		const supported = player.groundAt( player.position.x, player.position.z, player.position.y + 4 );
		maxTreadError = Math.max( maxTreadError, Math.abs( player.position.y - supported ) );
		minEyeClearance = Math.min( minEyeClearance, app.camera.position.y - supported );
		assert.ok( Math.abs( player.position.y - supported ) < .4, `The replay walker must remain on the rendered tread: feet ${player.position.y}, support ${supported}.` );
		assert.ok( app.camera.position.y > supported + 1, 'The first-person camera must clear the actual landing tread.' );
		await GPU.queue.onSubmittedWorkDone();
		const raw = await readTexture( output );
		if ( encoder && ! encoder.stdin.write( Buffer.from( raw.data ) ) ) await once( encoder.stdin, 'drain' );
		frames ++;
		if ( i === 0 ) checkpoint( '01-approach', seconds, raw );
		if ( arrived && ! saved.has( '02-intact-lookout' ) && storm.state.looked > 1 ) checkpoint( '02-intact-lookout', seconds, raw );
		if ( s.beat !== previousBeat ) {

			beats.push( { seconds, beat: s.beat } ); previousBeat = s.beat;
			console.log( `${seconds.toFixed( 1 )}s beat ${s.beat}` );

		}
		if ( Number.isFinite( storm.state.crestAt ) && app.coastal.time > storm.state.crestAt - 2 && ! storm.state.routeDestroyed ) checkpoint( '03-approaching-set', seconds, raw );
		if ( storm.state.routeDestroyed && ! destroyedSeen ) { destroyedSeen = true; checkpoint( '04-impact', seconds, raw ); }
		if ( storm.state.routeDestroyed && app.coastal.time - ( storm.state.destroyedAt ?? app.coastal.time ) > 3 ) checkpoint( '05-drainage', seconds, raw );
		if ( s.beat === 'storm-return' && returnAt === null ) { returnAt = seconds; checkpoint( '06-broken-landing', seconds, raw ); }
		if ( returnAt !== null && seconds - returnAt > 5.5 ) { checkpoint( '07-upper-return-route', seconds, raw ); break; }
		if ( i % ( fps * 5 ) === 0 ) console.log( `${seconds.toFixed( 0 )}s replay; ${s.beat}; looked ${storm.state.looked.toFixed( 2 )}; ${player.mode}; feet ${player.position.toArray().map( n => n.toFixed( 1 ) )}` );

	}
	if ( encoder ) { encoder.stdin.end(); await encoderDone; }
	await GPU.pipelinesReady(); await GPU.queue.onSubmittedWorkDone();
	const validation = await GPU.device.popErrorScope();
	assert.equal( validation, null, validation?.message ); assert.deepEqual( errors, [] );
	if ( maxSeconds >= 50 ) {

		assert.ok( arrived, 'Actual walker reaches the upper lookout.' );
		assert.ok( destroyedSeen, 'Observed real wave destroys the route.' );
		assert.ok( returnAt !== null, 'Storm naturally advances to upper-route return.' );
		assert.ok( player.position.y > 28 && player.mode === 'walk', 'The upper route keeps the real player safe.' );

	}
	writeSheet( join( out, `${runName}-contact-sheet.png` ), shots, 3 );
	writeFileSync( join( out, `${runName}-verification.json` ), JSON.stringify( {

		capture: 'Deterministic continuous replay in Seven Hunters own WebGPU renderer, real first-person walker, Story and coastal hazards; no HUD.',
		checkpoint: 'Prepared storm supplies, winding and gate; begins seven metres inland of the upper west lookout.',
		audio: 'Silent: no replacement or synthetic audio track; user stings remain pending.', width, height, fps, frames, seconds: frames / fps,
		movie: preview ? null : movie, validationErrors: errors, supportChecks: { frames, minEyeClearance, maxTreadError }, beats, checkpoints,
		state: { routeDestroyed: !! storm.state.routeDestroyed, crestAt: storm.state.crestAt, destroyedAt: storm.state.destroyedAt },

	}, null, 2 ) );
	if ( ! preview ) writeFileSync( join( out, 'index.html' ), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Seven Hunters · storm readability</title><style>body{margin:0;background:#101619;color:#e9e5db;font:16px/1.5 system-ui,sans-serif}main{max-width:1100px;margin:32px auto;padding:0 20px}video{display:block;width:100%;background:#080c0d}p{max-width:75ch}a{color:#cddde4}</style><main><h1>Storm readability</h1><video controls playsinline preload="metadata" poster="scope-gameplay-02-intact-lookout.png"><source src="review-storm-scope.mp4" type="video/mp4"></video><p>${( frames / fps ).toFixed( 1 )} seconds · ${width} × ${height} · ${fps} fps. Continuous first-person replay through the game's own renderer, walker, story and storm hazards. Silent.</p><p>The keeper walks to the safe lookout, inspects the lower landing through the scope, witnesses the larger set and broken landing, then turns to the upper tramway and station.</p><p><a href="scope-gameplay-contact-sheet.png">View checkpoints</a> · <a href="scope-gameplay-verification.json">Capture verification</a></p></main></html>` );
	console.log( `PASS ${frames} native in-game frames, ${( frames / fps ).toFixed( 2 )}s, zero WebGPU validation errors${preview ? '' : `; ${movie}`}.` );

} catch ( error ) {

	encoder?.kill(); throw error;

} finally {

	app.post.outputTexture = null;

}
process.exit( 0 );
