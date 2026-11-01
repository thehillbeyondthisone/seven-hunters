// One isolated actual-NextWatch timeline investigation. Keeps this App warm
// for at most one source-corrected plume pass; no unrelated scene reruns.
import '../../test/headless.mjs';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { installBrowser } from './browser.mjs';
import { bgraShot, writePNG, writeSheet } from './png.mjs';

const width = 1000, height = 720, root = resolve( 'artifacts/smoke-discovery/timeline' );
mkdirSync( root, { recursive: true } );
installBrowser( { search: '?bench&noAudio&chapterPreview=kitchen', width, height, root: resolve( 'public' ) } );
await import( '../../src/core/BenchSeed.js' );
const { App } = await import( '../../src/App.js' );
const { Story } = await import( '../../src/story/Story.js' );
const { Watcher } = await import( '../../src/story/Watcher.js' );
const { Vector3 } = await import( '../../src/engine/index.js' );
const { Player } = await import( '../../src/player/Player.js' );
const { KITCHEN, HAULING_SHED } = await import( '../../src/world/flannan/NextRooms.js' );
const { GPU } = await import( '../../src/engine/gpu/GPU.js' );
const { Texture } = await import( '../../src/engine/gpu/Texture.js' );
const { readTexture } = await import( '../../src/engine/gpu/Readback.js' );
const { hazeDensityForVisibility } = await import( '../../src/post/AirHaze.js' );
const { SMOKE_DISCOVERY_FOV } = await import( '../../src/story/NextWatchCutscenes.js' );
const files = [ 'src/story/NextWatch.js', 'src/story/NextWatchCutscenes.js', 'src/story/NextScript.js', 'src/world/flannan/ChimneySmoke.js', 'tools/shots/smoke-discovery-timeline.mjs' ];
const hashes = () => Object.fromEntries( files.map( path => [ path, createHash( 'sha256' ).update( readFileSync( path ) ).digest( 'hex' ) ] ) );
const errors = [], app = new App(); let stage = '';
console.log( 'BOOT actual NextWatch smoke timeline only' );
await app.init( ( p, label ) => { if ( label && label !== stage ) { stage = label; console.log( `${ Math.round( p * 100 ) }% ${ label }` ); } } );
app.ui = { ui: { photoMode: false, toast() {} }, update() {} };
const s = app.story = new Story( app ); s.ui.card = s.ui.read = s.ui.fade = async () => {};
await s.start(); app.player.update = Player.prototype.update;
GPU.device.addEventListener( 'uncapturederror', e => errors.push( e.error.message ) );
const output = new Texture( { width, height, format: GPU.format, usage: [ 'render', 'copySrc', 'sample' ], label: 'actual smoke timeline' } );
app.post.outputTexture = output;
const smooth = ( a, b, n ) => { const t = Math.max( 0, Math.min( 1, ( n - a ) / ( b - a ) ) ); return t * t * ( 3 - 2 * t ); };
const seeded = { time: s.moving.smoke.time, wind: s.moving.smoke.wind.clone() };

function projection() {
	const smoke = s.moving.smoke, wind = smoke.wind, speed = wind.y, time = smoke.time;
	const puffs = Array.from( { length: 22 }, ( _, id ) => {
		const raw = time * .095 + id / 22, age = raw - Math.floor( raw );
		const drift = age ** 1.25 * ( 3 + speed * 1.05 );
		const wander = Math.sin( age * 10 + id * 2.1 ) * age * ( .25 + age * .65 );
		const rise = Math.sqrt( age ) * .65 + age * ( 1.8 + 7 / ( 1 + speed * .18 ) );
		const point = smoke.origin.clone().add( new Vector3( wind.x * drift - wind.z * wander, rise, wind.z * drift + wind.x * wander ) );
		const ndc = point.clone().project( app.camera );
		return { id, age, life: smooth( 0, .08, age ) * ( 1 - smooth( .35, 1, age ) ), world: point.toArray(), ndc: ndc.toArray(), withinFrame: Math.abs( ndc.x ) < 1 && Math.abs( ndc.y ) < 1 && ndc.z > 0 && ndc.z < 1 };
	} );
	return { origin: smoke.origin.toArray(), actualChimney: KITCHEN.chimney.toArray(), emitterNdc: smoke.origin.clone().project( app.camera ).toArray(), target: s.next.smoke.target.toArray(), wind: wind.toArray(), strength: smoke.material.uniforms.strength.value, time, materialVisible: smoke.mesh.visible, groupVisible: smoke.group.visible, puffs };
}

async function pixels() {
	for ( let i = 0; i < 16; i ++ ) { app.frame( 0 ); await GPU.queue.onSubmittedWorkDone(); }
	const r = await readTexture( output );
	return bgraShot( Buffer.concat( [ Buffer.from( new Uint32Array( [ width, height ] ).buffer ), Buffer.from( r.data ) ] ) );
}

async function run( label ) {
	const out = resolve( root, label ); mkdirSync( out, { recursive: true } );
	const sourceHashes = hashes(), frames = [], images = [];
	GPU.device.pushErrorScope( 'validation' );
	s.next.smoke.release(); s.flags.nextWatch = { fogReturned: true, fireLit: true, banked: 65, chainSecured: 66 };
	s.h = 66; s.beat = 'd3remote'; s.paused = false; s.signal = false; s.titleView = false; s.tel = 0; s.watcher = new Watcher(); s.watcher.state = 'done';
	app.freeCam = false; app.input.enabled = true; app.input.down = () => false; app.player.busy = false;
	app.camera.fov = 70; app.camera.aspect = width / height; app.camera.updateProjectionMatrix();
	s.hand.carried = s.hand.lit = true;
	// An ordinary fully running lamp, with no artificial advance(30) phase.
	s.lamp.load( { lit: true, glow: 1, wind: 1, running: true, angle: 0, warned: false } ); s.lamp.update( 0, 0 );
	const smoke = s.moving.smoke; smoke.time = seeded.time; smoke.wind.copy( seeded.wind ); smoke.previousWind.copy( seeded.wind ); smoke.mesh.visible = true;
	app.haze.density.value = hazeDensityForVisibility( 2.5 ); app.clouds.coverage.value = .82;
	app.seaWeather?.reset(); app.seaDread?.setEnabled( false ); app.post.autoExposure.snap.value = 0;
	const p = app.player; p.position.set( -155, app.terrainData.heightAt( -155, 44 ), 44 ); p.velocity.set( 0, 0, 0 ); p.mode = 'walk'; p.grounded = true; p._camY = null;
	const delta = new Vector3( -160, HAULING_SHED.floor + 1, 40 ).sub( p.position.clone().add( new Vector3( 0, 1.62, 0 ) ) );
	p.yaw = Math.atan2( -delta.x, -delta.z ); p.pitch = Math.atan2( delta.y, Math.hypot( delta.x, delta.z ) ); p.update( 0 ); app.cameraCut();
	s.update = dt => { s._applyClock(); s.lamp.update( dt, 0 ); smoke.update( dt, app.camera, 1 ); };
	for ( let i = 0; i < 180; i ++ ) { app.frame( 1 / 30 ); await GPU.queue.onSubmittedWorkDone(); }
	s.beat = 'd3return'; if ( ! s.next.smoke.start() ) throw new Error( 'actual smoke discovery start failed' );
	const initial = { lampAngle: s.lamp.angle, feet: p.position.toArray(), eye: app.camera.position.toArray(), time: s.h, fov: s.next.smoke.state.fov };
	s.update = dt => s.next.update( dt, false );
	for ( const seconds of [ 2.1, 3.2, 4.4, 5.5 ] ) {
		while ( s.next.smoke.state.elapsed < seconds - 1e-7 ) { app.frame( Math.min( 1 / 60, seconds - s.next.smoke.state.elapsed ) ); await GPU.queue.onSubmittedWorkDone(); }
		const description = { seconds, h: s.h, lampAngle: s.lamp.angle, lampGlow: s.lamp.glow, lampTurning: s.lamp.turning, fov: app.camera.fov, camera: app.camera.position.toArray(), smoke: projection() };
		app.cameraCut(); const on = await pixels();
		smoke.mesh.visible = false; app.cameraCut(); const off = await pixels(); smoke.mesh.visible = true; app.cameraCut();
		const difference = new Uint8Array( on.rgba.length ); let changedPixels = 0, maxDifference = 0, sumDifference = 0, clearContrastPixels = 0;
		for ( let i = 0; i < on.rgba.length; i += 4 ) {
			let d = 0; for ( let c = 0; c < 3; c ++ ) d = Math.max( d, Math.abs( on.rgba[ i + c ] - off.rgba[ i + c ] ) );
			if ( d > 2 ) changedPixels ++; if ( d >= 12 ) clearContrastPixels ++; maxDifference = Math.max( maxDifference, d ); sumDifference += d;
			difference[ i ] = Math.min( 255, d * 8 ); difference[ i + 1 ] = Math.min( 255, d * 3 ); difference[ i + 2 ] = 0; difference[ i + 3 ] = 255;
		}
		description.pixelDifference = { changedPixels, clearContrastPixels, maxDifference, sumDifference };
		const name = `t-${ seconds.toFixed( 1 ) }`; writePNG( resolve( out, `${ name }-smoke.png` ), width, height, on.rgba ); writePNG( resolve( out, `${ name }-no-smoke.png` ), width, height, off.rgba ); writePNG( resolve( out, `${ name }-difference-x8.png` ), width, height, difference );
		frames.push( description ); images.push( on ); console.log( 'ACTUAL_FRAME', label, seconds, JSON.stringify( { ...description.pixelDifference, puffsWithinFrame: description.smoke.puffs.filter( n => n.withinFrame ).length, lampAngle: description.lampAngle, wind: description.smoke.wind } ) );
	}
	while ( s.next.smoke.active ) { app.frame( Math.min( 1 / 60, 7 - s.next.smoke.state.elapsed ) ); await GPU.queue.onSubmittedWorkDone(); }
	const restored = { fov: app.camera.fov, expectedFov: initial.fov, feet: p.position.toArray(), expectedFeet: initial.feet, busy: p.busy, inputEnabled: app.input.enabled, witnessedFlag: s.next.state.smokeSeen };
	if ( restored.fov !== initial.fov || restored.busy || ! restored.inputEnabled || restored.feet.some( ( n, i ) => n !== initial.feet[ i ] ) ) throw new Error( 'exact view/controls restoration failed' );
	const validation = await GPU.device.popErrorScope(); if ( validation ) errors.push( validation.message );
	writeSheet( resolve( out, 'temporal-sheet.png' ), images, 2 );
	const finalHashes = hashes(), verification = { mode: 'Actual NextWatch.update(dt,false), real rotating optic and wind, same h66 weather/feet; paired on/off at identical timeline timestamps.', productionFov: SMOKE_DISCOVERY_FOV, initial, frames, restored, sourceHashes, finalHashes, unchangedSource: JSON.stringify( sourceHashes ) === JSON.stringify( finalHashes ), validationErrors: errors };
	writeFileSync( resolve( out, 'verification.json' ), JSON.stringify( verification, null, 2 ) );
	if ( errors.length ) throw new Error( errors.join( '\n' ) ); console.log( 'REVIEW_READY', out );
}

await run( 'baseline' );
const rl = createInterface( { input: process.stdin, output: process.stdout, terminal: false } );
for await ( const line of rl ) {
	if ( line.trim() === 'finish' ) { console.log( 'GPU_RELEASED' ); rl.close(); process.exit( 0 ); }
	if ( line.trim() === 'corrected' ) {
		const old = s.moving.smoke, parent = old.group.parent;
		const { ChimneySmoke } = await import( `../../src/world/flannan/ChimneySmoke.js?correction=${ Date.now() }` );
		const replacement = new ChimneySmoke( old.origin ); parent.remove( old.group ); parent.add( replacement.group ); s.moving.smoke = replacement;
		await run( 'corrected' );
	} else console.log( 'Commands: corrected (one bounded plume source correction) / finish' );
}
