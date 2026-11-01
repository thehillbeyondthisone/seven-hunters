import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Vector3 } from '../../src/engine/index.js';
import { Player } from '../../src/player/Player.js';
import { TOWER } from '../../src/world/flannan/Station.js';
import { KITCHEN, HAULING_SHED } from '../../src/world/flannan/NextRooms.js';
import { hazeDensityForVisibility } from '../../src/post/AirHaze.js';
import { Watcher } from '../../src/story/Watcher.js';
import { SMOKE_DISCOVERY_FOV } from '../../src/story/NextWatchCutscenes.js';
import { readTexture } from '../../src/engine/gpu/Readback.js';
import { bgraShot, writePNG, writeSheet } from './png.mjs';

// Reuses a caller's warm native renderer. No app/device initialization or exit.
export async function captureDomesticWork( { app, s, GPU, output, width = output.width, height = output.height, smokeOnly = false, diagnosticFov = null } ) {
	if ( diagnosticFov !== null && diagnosticFov !== 3.5 ) throw new Error( 'Only the approved 3.5 degree diagnostic is available' );
	const out = resolve( smokeOnly ? diagnosticFov ? 'artifacts/smoke-discovery/diagnostic-3.5' : 'artifacts/smoke-discovery/game' : 'artifacts/domestic-craft/game' ); mkdirSync( out, { recursive: true } );
	const before = { playerUpdate: app.player.update, snap: app.post.autoExposure.snap.value, update: s.update, down: app.input.down, h: s.h, beat: s.beat, flags: s.flags, rows: s.rows, watcher: s.watcher, paused: s.paused, signal: s.signal, titleView: s.titleView,
		current: s.interact.current, held: s.interact.held, position: app.player.position.clone(), yaw: app.player.yaw, pitch: app.player.pitch, busy: app.player.busy,
		aspect: app.camera.aspect, camera: app.camera.position.clone(), quaternion: app.camera.quaternion.clone(), fov: app.camera.fov, lamp: s.lamp.save(), hand: s.hand.save(),
		freeCam: app.freeCam, inputEnabled: app.input.enabled, photoMode: app.ui?.ui?.photoMode, density: app.haze?.density.value, shafts: app.haze?.shafts.value, clouds: app.clouds?.coverage.value };
	const errors = [], captures = [], images = [];
	const onError = e => errors.push( e.error.message ); GPU.device.addEventListener( 'uncapturederror', onError ); GPU.device.pushErrorScope( 'validation' );
	let scopePopped = false;
	let held = true, action = 'kitchenStove', progress = .5;
	const controlledUpdate = () => { s._applyClock(); const it = s.interact.get( action ); s.interact.current = it; s.interact.held = ( it?.hold || 1 ) * progress; };
	const view = ( x, y, z, at ) => {
		const p = app.player, delta = at.clone().sub( new Vector3( x, y + 1.62, z ) );
		p.position.set( x, y, z ); p.velocity.set( 0, 0, 0 ); p.mode = 'walk'; p.grounded = true; p._camY = null;
		p.yaw = Math.atan2( -delta.x, -delta.z ); p.pitch = Math.atan2( delta.y, Math.hypot( delta.x, delta.z ) ); p.update( 0 ); app.cameraCut();
	};
	async function capture( name, dt = 1 / 60, extra = {} ) {
		for ( let i = 0; i < 18; i ++ ) { app.frame( dt ); await GPU.queue.onSubmittedWorkDone(); }
		const pixels = await readTexture( output ), rgba = bgraShot( Buffer.concat( [ Buffer.from( new Uint32Array( [ width, height ] ).buffer ), Buffer.from( pixels.data ) ] ) );
		writePNG( resolve( out, `${ name }.png` ), width, height, rgba.rgba ); images.push( rgba );
		captures.push( { name, action, progress, fov: app.camera.fov, handsMode: app.keeperHands?.mode, camera: app.camera.position.toArray(), contacts: s.next.domestic.handContacts().map( c => ( { index: c.index, pose: c.pose, position: c.position.toArray() } ) ), waterStream: s.next.domestic.props.models.waterStream.visible, teaStream: s.next.domestic.props.models.teaStream.visible, ...extra } );
		console.log( 'rendered', name );
	}
	async function shot( name, index, id, t, x, z, state = {} ) {
		Object.assign( s.next.state.meals.d2, { stage: index, kettleCarried: index >= 2 && index < 5, kettleAt: index >= 5 ? 'table' : index >= 2 ? 'carried' : 'range', tea: index >= 5, breadBroken: false }, state );
		action = id; progress = t; held = !! id; s.interact.current = id ? s.interact.get( id ) : null;
		view( x, TOWER.floor, z, id === 'kitchenStove' ? s.interact.get( id ).at : s.next.domestic.target( id || 'breakfastBread' ) );
		await capture( name );
	}
	try {
		s.flags = structuredClone( s.flags ); s.rows = s.rows.slice(); s.h = 34; s.beat = 'd2kitchen'; s.paused = false; s.signal = false; s.titleView = false; s.lamp.extinguish(); s.lamp.stop(); s.hand.carried = false;
		s.flags.nextWatch = { fogReturned: true, fireLit: true, meals: { d2: { stage: 0, started: 33, kettleAt: 'range' } } };
		app.player.update = Player.prototype.update; app.freeCam = false; app.input.enabled = true; app.camera.fov = 70; app.camera.aspect = width / height; app.camera.updateProjectionMatrix(); if ( app.ui?.ui ) app.ui.ui.photoMode = false;
		app.seaWeather?.reset(); app.seaDread?.setEnabled( false ); app.post.autoExposure.snap.value = 1; app.post.outputTexture = output;
		app.input.down = code => code === 'KeyE' && held; s.update = controlledUpdate;
		if ( ! smokeOnly ) {
		await shot( 'a-stove', 0, 'kitchenStove', .55, -3.1, 7.6 );
		await shot( 'b-take-kettle', 1, 'breakfastKettleTake', .55, -3.1, 7.75 );
		await shot( 'c-carry-kettle', 2, null, 0, -.05, 8.25, { kettleCarried: true, kettleAt: 'carried' } );
		await shot( 'd-fill-from-jug', 2, 'breakfastWater', .55, -.05, 8.25 );
		await shot( 'e-heat-kettle', 3, 'breakfastKettle', .5, -3.1, 7.75 );
		await shot( 'f-pour-tea', 4, 'breakfastTea', .55, -2.65, 8.9 );
		await shot( 'g-break-bread', 5, 'breakfastBread', .7, -2.65, 8.9 );
		await shot( 'h-breakfast-ready', 6, null, 0, -2.65, 8.9, { kettleCarried: false, kettleAt: 'table', tea: true, breadBroken: true } );

		}

		// Same night, feet, plume and simulation time at both focal lengths. The
		// wide view is a retained baseline, not a different weather/lighting setup.
		s.update = dt => { s._applyClock(); if ( app.haze ) app.haze.density.value = hazeDensityForVisibility( 2.5 ); if ( app.clouds ) app.clouds.coverage.value = .82; s.moving.smoke.update( dt, app.camera, 1 ); s.next.smoke.update( dt, false ); }; app.input.down = () => false; app.post.autoExposure.snap.value = 0; held = false; action = 'smoke-cutscene'; progress = 0;
		app.player.busy = false; s.h = 66; s.beat = 'd3return'; s.lamp.ignite(); s.lamp.start(); s.lamp.wind = 1; s.lamp.update( 30, 0 ); s.watcher = new Watcher(); s.watcher.state = 'done'; s.next.state.banked = 65; s.next.state.chainSecured = 66;
		delete s.next.state.smokeSeen; delete s.next.state.smokeCutscene; s.hand.carried = s.hand.lit = true;
		view( -155, app.terrainData.heightAt( -155, 44 ), 44, new Vector3( -160, HAULING_SHED.floor + 1, 40 ) );
		// Ordinary eye adaptation settles to the existing evening before the turn.
		for ( let i = 0; i < 180; i ++ ) { app.frame( 1 / 30 ); await GPU.queue.onSubmittedWorkDone(); }
		if ( ! s.next.smoke.start() ) throw new Error( 'night smoke framing did not start' );
		for ( let i = 0; i < 360 && s.next.smoke.state.elapsed < 2.4; i ++ ) { app.frame( 1 / 60 ); await GPU.queue.onSubmittedWorkDone(); }
		if ( s.next.smoke.state.elapsed < 2.4 ) throw new Error( 'night smoke framing remained blocked' );
		s.update = () => s._applyClock(); app.camera.fov = 70; app.camera.updateProjectionMatrix(); app.cameraCut();
		await capture( 'i-smoke-night-wide-70', 0, { smokeSeen: s.next.state.smokeSeen, night: true, autoExposureSnap: app.post.autoExposure.snap.value, adaptationSettleSeconds: 6, samePlumeTime: s.moving.smoke.time } );
		s.next.smoke.apply();
		if ( diagnosticFov ) { app.camera.fov = diagnosticFov; app.camera.updateProjectionMatrix(); }
		app.cameraCut(); await capture( `j-smoke-night-framed-${ diagnosticFov || SMOKE_DISCOVERY_FOV }${ diagnosticFov ? '-diagnostic' : '' }`, 0, { smokeSeen: s.next.state.smokeSeen, night: true, samePlumeTime: s.moving.smoke.time, productionFov: SMOKE_DISCOVERY_FOV, diagnosticFov } );
		const smokeFeet = s.next.smoke.state.feet.slice(), smokeFov = s.next.smoke.state.fov;
		s.next.smoke.finish();
		const restored = { fov: app.camera.fov, expectedFov: smokeFov, feet: app.player.position.toArray(), expectedFeet: smokeFeet, busy: app.player.busy, inputEnabled: app.input.enabled };
		if ( restored.fov !== smokeFov || restored.busy || ! restored.inputEnabled || restored.feet.some( ( n, i ) => n !== smokeFeet[ i ] ) ) throw new Error( 'smoke discovery did not restore the exact lens, feet and controls' );
		await capture( 'k-smoke-control-returned', 0, { restored } );
		await GPU.pipelinesReady(); await GPU.queue.onSubmittedWorkDone(); const validation = await GPU.device.popErrorScope(); scopePopped = true; if ( validation ) errors.push( validation.message );
		writeSheet( resolve( out, 'temporal-sheet.png' ), images, 2 );
		writeFileSync( resolve( out, 'verification.json' ), JSON.stringify( { route: smokeOnly ? 'Same night, feet, weather and original plume; first-person framing only.' : 'all props, pivots, work poses and hand contact transforms exported through Blender MCP', productionFov: SMOKE_DISCOVERY_FOV, diagnosticFov, captures, validationErrors: errors }, null, 2 ) );
		if ( errors.length ) throw new Error( errors.join( '\n' ) );
		return { out, captures: captures.length, validationErrors: errors };
	} finally {
		if ( ! scopePopped ) { const validation = await GPU.device.popErrorScope(); if ( validation ) errors.push( validation.message ); }
		s.next.smoke.release(); s.next.releaseFogLighting(); app.player.update = before.playerUpdate; app.post.autoExposure.snap.value = before.snap; s.update = before.update; app.input.down = before.down;
		Object.assign( s, { h: before.h, beat: before.beat, flags: before.flags, rows: before.rows, watcher: before.watcher, paused: before.paused, signal: before.signal, titleView: before.titleView } );
		s.interact.current = before.current; s.interact.held = before.held; s.lamp.load( before.lamp ); s.hand.load( before.hand );
		app.freeCam = before.freeCam; app.input.enabled = before.inputEnabled; if ( app.ui?.ui ) app.ui.ui.photoMode = before.photoMode;
		app.player.position.copy( before.position ); app.player.yaw = before.yaw; app.player.pitch = before.pitch; app.player.busy = before.busy; app.player._camY = null;
		app.camera.position.copy( before.camera ); app.camera.quaternion.copy( before.quaternion ); app.camera.fov = before.fov; app.camera.aspect = before.aspect; app.camera.updateProjectionMatrix();
		if ( app.haze ) { app.haze.density.value = before.density; app.haze.shafts.value = before.shafts; } if ( app.clouds ) app.clouds.coverage.value = before.clouds;
		s.next.domestic.update( 0, false ); s._applyClock(); app.cameraCut(); GPU.device.removeEventListener( 'uncapturederror', onError );
	}
}

export const captureNightSmoke = args => captureDomesticWork( { ...args, smokeOnly: true } );
