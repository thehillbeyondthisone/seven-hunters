import { Vector3 } from '../engine/math/index.js';
import { RevealMusic } from '../audio/RevealMusic.js';
import { BULLSEYES } from '../world/flannan/StationMaterials.js';

// The first lighting of the watch, seen from outside the lantern. The camera
// swings round the top of the tower while the burner warms; the music cue then
// plays on (about 30 s) after the player has their view back.
// Drop the score at public/audio/<file>; a missing file plays nothing.
export const FIRST_LIGHT_MUSIC = { file: null, gain: 0.6, fadeIn: 0.4, fadeOut: 3, duration: 32, offset: 0, delay: 0 };
export const FIRST_LIGHT_SECONDS = 12;
const HOME_CUT = FIRST_LIGHT_SECONDS - .5;
const CAPTIONS = [
	{ from: 'Eilean Mòr · sunset', text: 'The burner makes the light. Its flame stays at the centre.', start: .5, end: 5.7 },
	{ from: 'The clockwork', text: 'The clockwork turns the optic around the flame. Release its brass stop beside the crank.', start: 6, end: HOME_CUT },
];
// The burner warms faster during the shot so the glow reads within it.
const WARM_RATE = 2.2;
// The camera's arc round the lantern (rad), and the middles of the two gaps
// between the bullseye pairs, relative to the optic's angle.
const SWING = 1.9;
const BEAM_GAPS = [ 0, Math.PI ].map( a => a + ( BULLSEYES[ 1 ] + Math.PI ) / 2 );
const clamp = x => Math.max( 0, Math.min( 1, x ) );
const smooth = x => { x = clamp( x ); return x * x * ( 3 - 2 * x ); };
const ease = x => { x = clamp( x ); return x * x * x * ( x * ( x * 6 - 15 ) + 10 ); };
const mix = ( a, b, t ) => a + ( b - a ) * t;
const _target = new Vector3();

export class FirstLightCutscene {
	constructor( keeper ) {
		this.keeper = keeper; this.s = keeper.s; this.active = false;
		this.music = new RevealMusic( () => this.s.app.audio, FIRST_LIGHT_MUSIC );
		this.cueElapsed = null;
	}

	start() {
		if ( this.active ) return;
		const s = this.s, ui = s.ui, cam = s.app.camera;
		this.active = true;
		this.elapsed = 0;
		this.cueElapsed = 0;
		this.wasBusy = s.app.player.busy;
		this.previousFocus = document.activeElement;
		this.home = { position: cam.position.toArray(), quaternion: cam.quaternion.toArray(), fov: cam.fov };
		this.shot = null;
		// Swing round within a gap between the bullseye beams (a beam aimed at
		// the camera floods the frame), starting as near as possible to the side
		// opposite the sun, so the lantern first stands against the afterglow.
		const sun = s.app.atmosphere?.sunDir?.value;
		const ideal = ( sun ? Math.atan2( sun.z, sun.x ) : 0 ) + Math.PI - .8;
		let best = Infinity;
		for ( const gap of BEAM_GAPS ) for ( const dir of [ 1, -1 ] ) {
			const from = s.lamp.angle + gap - dir * SWING / 2, off = Math.abs( Math.atan2( Math.sin( from - ideal ), Math.cos( from - ideal ) ) );
			if ( off < best ) { best = off; this.from = from; this.dir = dir; }
		}
		this.root = document.createElement( 'section' );
		this.root.className = 'sh-weight-cutscene sh-light-cutscene';
		this.root.setAttribute( 'role', 'dialog' );
		this.root.setAttribute( 'aria-modal', 'true' );
		this.root.setAttribute( 'aria-label', 'The first lighting' );
		this.root.innerHTML = '<div class="sh-light-bars" aria-hidden="true"></div><div class="sh-weight-fade" aria-hidden="true"></div><div class="sh-arrival is-on sh-weight-caption"><div class="sh-arrival-from">Eilean Mòr · sunset</div><div class="sh-arrival-text" aria-live="polite">The light is shown.</div></div><button type="button" class="sh-reveal-skip sh-weight-skip">Continue · Esc</button>';
		this.fade = this.root.querySelector( '.sh-weight-fade' );
		this.captionWrap = this.root.querySelector( '.sh-weight-caption' );
		this.captionFrom = this.root.querySelector( '.sh-arrival-from' );
		this.caption = this.root.querySelector( '.sh-arrival-text' );
		this.button = this.root.querySelector( 'button' );
		if ( s.app.input.touchMode ) this.button.textContent = 'Continue';
		this.button.addEventListener( 'click', () => this.finish() );
		this.key = e => {
			if ( e.code === 'Tab' ) { e.preventDefault(); this.button.focus(); }
			if ( e.code === 'Escape' && ! e.repeat ) { e.preventDefault(); e.stopImmediatePropagation(); this.finish(); }
		};
		window.addEventListener( 'keydown', this.key, true );
		ui._open(); ui.setHUD( false ); ui.arrival( null ); ui.guidance( null, cam );
		ui.root.classList.add( 'is-weight-cutscene' );
		ui.layer.append( this.root );
		s.app.player.busy = true; s.app.player.prompt = null;
		s.app.player.velocity.set( 0, 0, 0 );
		s.interact.current = null;
		this.keeper.note = null; s.sound?.ratchet( false );
		this.render(); this.button.focus( { preventScroll: true } );
	}

	render() {
		const s = this.s, cam = s.app.camera, t = this.elapsed, focal = s.station.focal;
		const shot = t < HOME_CUT ? 'lantern' : 'home';
		if ( shot === 'lantern' ) {
			// One continuous move: round the gallery, easing out and up.
			const u = t / HOME_CUT, k = ease( u );
			const a = this.from + this.dir * SWING * mix( k, u, .35 );
			const r = mix( 6.2, 9.5, smooth( u ) ), y = focal + mix( .2, 2.6, smooth( u ) );
			cam.position.set( Math.cos( a ) * r, y, Math.sin( a ) * r );
			cam.lookAt( _target.set( 0, focal - mix( .15, .45, k ), 0 ) );
		} else {
			cam.position.fromArray( this.home.position ); cam.quaternion.fromArray( this.home.quaternion );
		}
		const caption = CAPTIONS[ t < CAPTIONS[ 1 ].start ? 0 : 1 ];
		if ( this.caption.textContent !== caption.text ) this.caption.textContent = caption.text;
		if ( this.captionFrom.textContent !== caption.from ) this.captionFrom.textContent = caption.from;
		this.captionWrap.style.opacity = ( smooth( ( t - caption.start ) / .4 ) * ( 1 - smooth( ( t - caption.end + .4 ) / .4 ) ) ).toFixed( 3 );
		cam.fov = this.home.fov; cam.updateProjectionMatrix();
		const start = 1 - smooth( t / .6 );
		const end = 1 - smooth( Math.abs( t - HOME_CUT ) / .45 );
		this.fade.style.opacity = Math.max( start, end ).toFixed( 3 );
		if ( shot !== this.shot ) {
			this.shot = shot;
			s.hand.resetMotion?.();
			s.app.cameraCut?.();
		}
	}

	update( dt, blocked ) {
		if ( ! this.active || blocked ) return;
		const step = Math.max( 0, Math.min( dt, 1, FIRST_LIGHT_SECONDS - this.elapsed ) );
		const s = this.s, dh = step * s.clockRate;
		s.h += dh;
		s.lamp.update( step * WARM_RATE, dh );
		s._applyClock();
		this.keeper.drive?.sync( s.lamp.wind );
		this.elapsed += step;
		this.render();
		if ( this.elapsed >= FIRST_LIGHT_SECONDS ) this.finish();
	}

	// Runs every frame, during and after the shot, so the music plays out.
	updateCue( dt, paused ) {
		if ( this.cueElapsed === null ) return;
		if ( ! paused ) this.cueElapsed += Math.max( 0, Math.min( dt, 1 ) );
		if ( ! this.active && this.cueElapsed >= this.music.end ) { this.stopMusic(); return; }
		this.music.update( this.cueElapsed, paused );
	}

	close() {
		if ( ! this.active ) return;
		this.active = false;
		window.removeEventListener( 'keydown', this.key, true );
		this.root.remove();
		const s = this.s, cam = s.app.camera;
		cam.position.fromArray( this.home.position ); cam.quaternion.fromArray( this.home.quaternion );
		cam.fov = this.home.fov; cam.updateProjectionMatrix();
		s.hand.resetMotion?.(); s.app.cameraCut?.();
		s.app.player.busy = this.wasBusy;
		s.app.input.consumeLook();
		s.ui.root.classList.remove( 'is-weight-cutscene' );
		s.ui._close(); s.ui.setHUD( true );
		this.previousFocus?.focus?.( { preventScroll: true } );
	}

	// A reload or a new watch silences the cue too.
	stopMusic() { this.music.stop(); this.cueElapsed = null; }

	finish() {
		if ( ! this.active ) return;
		this.close();
		this.keeper.afterFirstLight();
	}
}
