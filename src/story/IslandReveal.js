import { Euler } from '../engine/math/index.js';
import { RevealMusic } from '../audio/RevealMusic.js';
import { RevealGulls } from './RevealGulls.js';
import { loadRevealSettings, normalizeRevealSettings, saveRevealSettings, REVEAL_DEFAULTS } from './RevealSettings.js';

const REVEAL_TIMELINE_SECONDS = 21;
export const ISLAND_REVEAL_SPEED = 0.75;
export const ISLAND_REVEAL_SECONDS = REVEAL_TIMELINE_SECONDS / ISLAND_REVEAL_SPEED;
const rotation = new Euler( 0, 0, 0, 'YXZ' );
const clamp = ( x, a, b ) => Math.max( a, Math.min( b, x ) );
// Zero angular velocity and acceleration at each end of a head turn.
const ease = x => { x = clamp( x, 0, 1 ); return x * x * x * ( x * ( x * 6 - 15 ) + 10 ); };
const mix = ( a, b, t ) => a + ( b - a ) * t;
const unwrap = ( a, from ) => from + Math.atan2( Math.sin( a - from ), Math.cos( a - from ) );
const positiveAngle = a => ( ( a % ( Math.PI * 2 ) ) + Math.PI * 2 ) % ( Math.PI * 2 );

// The walker stays at the hill crest. Only a standing person's eyes and head move;
// no dolly, zoom, camera cut, or cinematic roll. The same pose feeds the walker on exit.
export class IslandReveal {

	constructor( story ) {
		this.story = story;
		this.app = story.app;
		this.state = null;
		this.cueElapsed = null;
		this.gulls = this.app.islandGulls || new RevealGulls();
		this.settings = loadRevealSettings();
		this.music = new RevealMusic( () => this.app.audio );
		this.editorPaused = false; this.anchor = null;
		this.configure( this.settings, false );
	}

	get active() { return this.state !== null; }
	get duration() { return REVEAL_TIMELINE_SECONDS / this.settings.speed; }
	get sceneTime() { return ( this.state?.elapsed ?? ( this.story.flags.islandRevealSeen ? REVEAL_TIMELINE_SECONDS : 0 ) ) / this.settings.speed; }
	get editingPreview() { return !! this.app.qs?.has( 'islandRevealPreview' ); }
	get quietWalk() { return ! this.active && this.cueElapsed !== null && this.cueElapsed < this.music.end; }

	configure( patch, persist = true ) {
		this.settings = normalizeRevealSettings( { ...this.settings, ...patch } );
		Object.assign( this.music.cue, { gain: this.settings.gain, fadeIn: this.settings.fadeIn, fadeOut: this.settings.fadeOut,
			offset: this.settings.musicOffset, delay: this.settings.musicDelay } );
		this.music.stop();
		if ( this.editingPreview && this.state ) this.cueElapsed = this.sceneTime;
		if ( persist ) saveRevealSettings( this.settings );
	}

	resetSettings() { this.configure( REVEAL_DEFAULTS ); }

	replay( at = 0 ) {
		if ( ! this.editingPreview || this.story.ui.open || this.app.xr?.active ) return false;
		this.music.stop(); this.state = null; this.editorPaused = false;
		this.app.freeCam = false;
		this.story._placeAtRevealCrest();
		this.story.beat = 'climb'; this.story.paused = false;
		this.story.flags.islandRevealSeen = false;
		this.app.input.enabled = true;
		if ( ! this.start() ) return false;
		if ( at > 0 ) { this.seek( at ); this.editorPaused = false; }
		this.app.cameraCut?.();
		return true;
	}

	seek( seconds ) {
		if ( ! this.editingPreview || this.story.ui.open ) return false;
		if ( ! this.anchor && ! this.replay() ) return false;
		const time = Number.isFinite( seconds ) ? clamp( seconds, 0, this.duration ) : 0;
		this.state = { ...this.anchor, elapsed: time * this.settings.speed };
		this.editorPaused = true; this.story.flags.islandRevealSeen = false;
		this.cueElapsed = time; this.gulls.elapsed = this.state.elapsed;
		this.story.beat = 'climb'; this.story.paused = false;
		if ( this.story.arrival ) { this.story.arrival.departure = 45 + time; this.story.arrival.pose( 0 ); }
		this.music.stop(); this.enter(); this.app.cameraCut?.();
		this.story.save();
		return true;
	}

	canStart() {
		const s = this.story, app = this.app, p = app.player;
		if ( s.beat !== 'climb' || ! s.flags.landed || s.flags.islandRevealSeen || s.paused || s.ui.open
			|| ! app.input.enabled
			|| app.freeCam || app.xr?.active || app.isVRPreview || app.ui?.ui?.photoMode || app.mobile?.paused
			|| globalThis.document?.hidden || p.mode !== 'walk' || ! p.grounded ) return false;
		const L = s.station.landings.east, top = L.top || L.steps.to;
		const x = p.position.x - top.x, z = p.position.z - top.z;
		const inland = - x * L.dir[ 0 ] - z * L.dir[ 1 ];
		const across = - x * L.dir[ 1 ] + z * L.dir[ 0 ];
		const ground = app.terrainData?.heightAt( top.x, top.z ) ?? L.steps.to.y;
		return inland >= - 0.12 && inland <= 2.5 && Math.abs( across ) < 1.35 && Math.abs( p.position.y - ground ) < 0.8;
	}

	start() {
		if ( this.active || ! this.canStart() ) return false;
		const p = this.app.player, cam = this.app.camera;
		const L = this.story.station.landings.east;
		// Positive YXZ yaw turns left. Choose that arc explicitly, through the
		// low western sun, instead of allowing a shortest-angle tie to turn right.
		const seaYaw = p.yaw + positiveAngle( Math.atan2( - L.dir[ 0 ], - L.dir[ 1 ] ) - p.yaw );
		// Retrace the turn to the right and finish facing the lighthouse.
		const frontYaw = seaYaw - positiveAngle( seaYaw - Math.atan2( p.position.x, p.position.z ) );
		const towerY = this.story.station.focal;
		const frontPitch = Math.atan2( towerY - p.position.y - 1.62, Math.hypot( p.position.x, p.position.z ) );
		this.state = { elapsed: 0, feet: [ p.position.x, p.position.y, p.position.z ],
			eye: [ cam.position.x, cam.position.y, cam.position.z ], yaw: p.yaw, pitch: p.pitch,
			seaYaw, frontYaw, frontPitch };
		this.cueElapsed = 0;
		this.anchor = { ...this.state };
		this.enter();
		this.story.save();
		return true;
	}

	enter() {
		this.story.intro?.finishClimb();
		this.app.player.velocity.set( 0, 0, 0 );
		this.app.player.prompt = null;
		this.app.input.enabled = false;
		this.app.input.consumeLook();
		this.story.ui.islandReveal( true, () => this.skip() );
		this.gulls.begin( this.state.eye, this.story.station.landings.east.dir, this.state.elapsed );
		this.apply();
	}

	apply() {
		const r = this.state, t = r.elapsed, p = this.app.player, cam = this.app.camera;
		// Saved elapsed stays in authored time, preserving existing saved poses.
		// At 0.75x this 21-second timeline takes 28 real seconds; music stays at 1x.
		// Authored: 0–1 settle; 1–6 left turn; 6–14 bay / gull glance; 14–20 return; 20–21 rest.
		const turn = ease( ( t - 1 ) / 5 ), back = ease( ( t - 14 ) / 6 );
		const breath = ease( t ) * ( 1 - ease( t - 20 ) );
		let seaYaw = r.seaYaw, seaPitch = - 0.12;
		if ( ( this.app.islandGulls || this.app.wildlife ) && t > 7 ) {
			// Hold the final bird heading as the return's starting pose. Do not
			// unwind the glance to the bay before turning toward the lighthouse.
			const bird = this.gulls.point( Math.min( t, 14 ) ), dx = bird[ 0 ] - r.eye[ 0 ], dz = bird[ 2 ] - r.eye[ 2 ];
			const glance = ease( ( t - 7 ) / 1.6 );
			const yaw = unwrap( Math.atan2( -dx, -dz ), r.seaYaw );
			seaYaw += clamp( yaw - r.seaYaw, -1.05, 1.05 ) * glance;
			seaPitch = mix( seaPitch, Math.atan2( bird[ 1 ] - r.eye[ 1 ], Math.hypot( dx, dz ) ), glance );
		}
		p.position.set( ...r.feet );
		p.yaw = mix( mix( r.yaw, seaYaw, turn ), r.frontYaw, back );
		p.pitch = mix( mix( r.pitch, seaPitch, turn ), r.frontPitch, back ) + Math.sin( t * 1.28 ) * 0.0015 * breath;
		p.velocity.set( 0, 0, 0 );
		cam.position.set( ...r.eye );
		cam.position.y = mix( r.eye[ 1 ], p.position.y + 1.62, ease( t ) ) + Math.sin( t * 1.28 ) * 0.006 * breath;
		cam.quaternion.setFromEuler( rotation.set( p.pitch, p.yaw, 0 ) );
	}

	update( dt ) {
		const app = this.app, s = this.story;
		const paused = this.editorPaused || s.paused || s.ui.open || app.devMenu?.open || app.mobile?.paused || app.freeCam || app.ui?.ui?.photoMode || globalThis.document?.hidden;
		if ( this.editorPaused && ! this.active ) { this.updateCue( 0, true ); return true; }
		if ( ! this.active && ! this.start() ) { this.updateCue( dt, paused ); return false; }
		app.input.enabled = false;
		app.input.consumeLook(); // discard accumulated mouse motion during the authored turn
		if ( ! paused ) {
			this.state.elapsed = Math.min( REVEAL_TIMELINE_SECONDS, this.state.elapsed + Math.max( 0, dt ) * this.settings.speed );
			this.apply();
		}
		this.gulls.elapsed = this.state.elapsed;
		this.updateCue( dt, paused );
		if ( ! paused && this.state.elapsed >= REVEAL_TIMELINE_SECONDS ) this.finish();
		return true;
	}

	updateCue( dt, paused ) {
		if ( this.cueElapsed === null ) return;
		if ( ! paused ) {
			this.cueElapsed = Math.min( this.music.end, this.cueElapsed + Math.max( 0, dt ) );
			if ( ! this.active ) this.gulls.elapsed += Math.max( 0, dt ) * this.settings.speed;
		}
		if ( this.cueElapsed >= this.music.end ) this.music.stop();
		else this.music.update( this.cueElapsed, paused );
	}

		skip() {
		if ( ! this.active || this.story.ui.open || this.app.mobile?.paused || this.app.ui?.ui?.photoMode || this.app.freeCam ) return;
		// A skip returns input at the current heading without an abrupt camera snap.
		this.editorPaused = false;
		this.finish();
	}

	finish() {
		const p = this.app.player;
		p.bob = 0; p.camOff = p.camOffV = p.groundCamOff = p.groundCamOffV = 0;
		p._camY = this.app.camera.position.y;
		// Absorb the few millimetres of breath (or the settling offset on an early skip).
		p.groundCamOff = this.app.camera.position.y - p.position.y - 1.62;
		this.state = null;
		this.story.flags.islandRevealSeen = true;
		this.story.ui.islandReveal( false );
		this.app.input.reset?.();
		this.app.input.enabled = ! this.app.devMenu?.open;
		this.story.save();
	}

	save() { return this.state || ( this.cueElapsed !== null && this.cueElapsed < this.music.end ) ? { shot: this.state ? { ...this.state } : null, cueElapsed: this.cueElapsed } : null; }

	restore( data ) {
		if ( ! data ) return;
		if ( Number.isFinite( data.cueElapsed ) ) this.cueElapsed = clamp( data.cueElapsed, 0, this.music.end );
		const state = data.shot ?? ( data.feet ? data : null );
		if ( ! state || this.story.flags.islandRevealSeen || this.story.beat !== 'climb' ) return;
		const scalars = [ 'elapsed', 'yaw', 'pitch', 'seaYaw', 'frontYaw', 'frontPitch' ];
		if ( ! scalars.every( k => Number.isFinite( state[ k ] ) )
			|| ! [ state.feet, state.eye ].every( a => Array.isArray( a ) && a.length === 3 && a.every( Number.isFinite ) ) ) return;
		this.state = { ...state, elapsed: clamp( state.elapsed, 0, REVEAL_TIMELINE_SECONDS ) };
		this.anchor = { ...state, elapsed: 0 };
		this.app.player.grounded = true;
		this.enter();
	}

}
