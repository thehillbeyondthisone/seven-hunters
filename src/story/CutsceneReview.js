import { Euler } from '../engine/math/index.js';
import { TOWER } from '../world/flannan/Station.js';
import { FirstLightCutscene } from './FirstLightCutscene.js';
import { WeightDriveCutscene } from './WeightDriveCutscene.js';
import { IslandReveal } from './IslandReveal.js';

export const REVIEW_SCENES = [
	{ id: 'reveal', label: 'First look back' },
	{ id: 'light', label: 'First lighting' },
	{ id: 'weight', label: 'The driving weight' },
];
const PLAYER_FIELDS = [ 'yaw', 'pitch', 'mode', 'grounded', 'busy', 'bob', 'camOff', 'camOffV', 'groundCamOff', 'groundCamOffV', '_camY', 'lookScale' ];

// Run the existing scenes against an unsaved story facade. Only the live
// apparatus and camera are borrowed; the watch's flags, rows and clock never
// enter the scene. On exit restore the exact pose and apparatus, including speed.
export class CutsceneReview {
	constructor( story ) { this.s = story; this.active = false; }

	get available() {
		const s = this.s, a = s.app;
		return ! this.active && ! s.aboard && ! s.titleView && ! [ 'intro', 'end' ].includes( s.beat ) &&
			! s.paused && ! s.ui.open && ! s.signal && ! s.ruinInspect && s.tel <= .1 && ! a.player.busy && ! s.towerTravel.active && ! s.keeper.cinematic &&
			! s.islandReveal.active && ! s.lampStudy?.active && ! s.photography?.capturing && ! s.later?.busy &&
			! a.xr?.active && ! a.freeCam && ! a.mobile?.paused && ! a.ui?.ui?.photoMode && ! globalThis.document?.hidden &&
			! [ 'struggling', 'recovering', 'dead' ].includes( a.keeperSafety?.state );
	}

	start( id ) {
		if ( ! this.available || ! REVIEW_SCENES.some( scene => scene.id === id ) ) return false;
		const s = this.s, a = s.app, p = a.player, cam = a.camera, lamp = s.lamp;
		this.saved = {
			player: Object.fromEntries( PLAYER_FIELDS.map( key => [ key, p[ key ] ] ) ),
			position: p.position.clone(), velocity: p.velocity.clone(), camera: cam.position.clone(), quaternion: cam.quaternion.clone(), fov: cam.fov,
			lamp: lamp.save(), speed: lamp.speed, warning: lamp.onWarning, stopped: lamp.onStopped,
			hand: s.hand.save(), handGlow: s.hand.glow, inputEnabled: a.input.enabled,
			interact: s.interact.current, held: s.interact.held,
			timeOfDay: a.settings.timeOfDay, dayOffset: a.setting.dayOffset,
			timeSpeed: a.settings.timeSpeed,
			gulls: a.islandGulls ? { origin: a.islandGulls.origin?.slice() ?? null, dir: a.islandGulls.dir?.slice() ?? null, elapsed: a.islandGulls.elapsed } : null,
			voyage: { elapsed: s.arrival.elapsed, departure: s.arrival.departure, visible: s.arrival.group.visible },
		};
		this.active = true; this.id = id;
		// Keep a lingering watch cue from playing over the review. Its clock is
		// untouched, so the normal director resumes it when the watch returns.
		s.keeper.firstLight.music.stop(); s.islandReveal.music.stop(); s.sound?.ratchet( false );
		const facade = this.facade = Object.create( s );
		facade.flags = structuredClone( s.flags ); facade.rows = []; facade.obs = {}; facade.h = 16.1;
		facade.beat = 'watch'; facade.paused = false; facade.save = facade.row = () => {};
		facade.intro = { finishClimb() {} };
		facade.interact = { current: null };
		facade.keeper = { state: {} };
		const keeper = { s: facade, state: {}, drive: s.keeper.drive, note: null,
			afterFirstLight: () => this.finish(), afterDriveCutscene: () => this.finish() };
		lamp.onWarning = lamp.onStopped = null;
		lamp.wind = .95; lamp.running = id === 'weight'; lamp.speed = id === 'weight' ? 1 : 0;
		lamp.lit = true; lamp.glow = id === 'light' ? 0 : 1;
		s.hand.carried = s.hand.lit = false;
		s.interact.current = null; s.interact.held = 0; p.prompt = null;
		s.ui.arrival( null ); s.ui.guidance( null, cam ); s.ui.guidance( null, cam, false, s.ui.pickupGuide );
		a.input.reset?.(); a.input.enabled = true;
		try {
			if ( id === 'reveal' ) {
				facade._placeAtRevealCrest();
				// Set the eye directly: the safety controller may be paused in a menu.
				cam.position.copy( p.position ); cam.position.y += 1.62;
				cam.quaternion.setFromEuler( new Euler( p.pitch, p.yaw, 0, 'YXZ' ) );
				p.busy = false; facade.beat = 'climb'; facade.flags.islandRevealSeen = false;
				this.scene = new IslandReveal( facade );
				this.scene.finish = () => { this.scene.state = null; s.ui.islandReveal( false ); this.finish(); };
				if ( ! this.scene.start() ) throw new Error( 'The hilltop view is unavailable.' );
			} else {
				p.position.set( Math.cos( TOWER.crankAngle ) * 1.95, TOWER.deck, Math.sin( TOWER.crankAngle ) * 1.95 );
				p.yaw = Math.atan2( p.position.x, p.position.z ); p.pitch = .15;
				p.mode = 'walk'; p.grounded = true; p.velocity.set( 0, 0, 0 );
				cam.position.copy( p.position ); cam.position.y += 1.62;
				cam.quaternion.setFromEuler( new Euler( p.pitch, p.yaw, 0, 'YXZ' ) );
				facade._applyClock();
				this.scene = id === 'light' ? new FirstLightCutscene( keeper ) : new WeightDriveCutscene( keeper );
				this.scene.start();
			}
			p.busy = true; a.cameraCut?.();
			this.key = e => {
				if ( e.code === 'Escape' && ! e.repeat && this.active ) {
					e.preventDefault(); e.stopImmediatePropagation(); this.finish();
				}
			};
			window.addEventListener( 'keydown', this.key, true );
			return true;
		} catch ( error ) {
			this.finish(); s.toast( error.message ); return false;
		}
	}

	update( dt ) {
		if ( ! this.active ) return false;
		const a = this.s.app, blocked = !! ( a.devMenu?.open || a.mobile?.paused || a.ui?.ui?.photoMode || globalThis.document?.hidden );
		if ( this.id === 'reveal' ) this.scene.update( blocked ? 0 : dt );
		else {
			this.scene.updateCue?.( dt, blocked );
			this.scene.update( dt, blocked );
		}
		return true;
	}

	finish() {
		if ( ! this.active ) return;
		const s = this.s, a = s.app, p = a.player, cam = a.camera, saved = this.saved;
		this.scene?.close?.(); this.scene?.music?.stop();
		if ( this.scene?.weightLight && a.localLights ) {
			const index = a.localLights.sources.indexOf( this.scene.weightLight );
			if ( index >= 0 ) a.localLights.sources.splice( index, 1 );
		}
		if ( this.id === 'reveal' ) s.ui.islandReveal( false );
		window.removeEventListener( 'keydown', this.key, true );
		this.active = false;
		Object.assign( p, saved.player ); p.position.copy( saved.position ); p.velocity.copy( saved.velocity ); p.prompt = null;
		cam.position.copy( saved.camera ); cam.quaternion.copy( saved.quaternion ); cam.fov = saved.fov; cam.updateProjectionMatrix();
		s.lamp.load( saved.lamp ); s.lamp.speed = saved.speed;
		s.lamp.onWarning = saved.warning; s.lamp.onStopped = saved.stopped; s.lamp.update( 0, 0 );
		s.hand.load( saved.hand ); s.hand.glow = saved.handGlow;
		s.keeper.drive?.sync( s.lamp.wind );
		Object.assign( s.arrival, { elapsed: saved.voyage.elapsed, departure: saved.voyage.departure } );
		s.arrival.pose( 0 ); s.arrival.group.visible = saved.voyage.visible;
		a.settings.timeOfDay = saved.timeOfDay; a.settings.timeSpeed = saved.timeSpeed; a.setting.dayOffset = saved.dayOffset;
		if ( saved.gulls ) { Object.assign( a.islandGulls, saved.gulls ); a.islandGulls.poses.forEach( pose => { pose.fresh = true; } ); a.islandGulls.update(); }
		s.interact.current = saved.interact; s.interact.held = saved.held;
		// Releasing E is required after every review; no held action leaks out.
		s.interact.held = 0; a.input.reset?.(); a.input.consumeLook(); a.input.enabled = saved.inputEnabled;
		s.hand.resetMotion?.(); s.ui.setHUD( true ); a.cameraCut?.();
		this.scene = null; this.facade = null;
	}
}
