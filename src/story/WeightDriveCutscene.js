import { Color, Vector3 } from '../engine/math/index.js';
import { TOWER } from '../world/flannan/Station.js';

export const WEIGHT_CUTSCENE_SECONDS = 12;
const OPTIC_CUT = 8;
const RETURN_CUT = 11.5;
const clamp = x => Math.max( 0, Math.min( 1, x ) );
const smooth = x => { x = clamp( x ); return x * x * ( 3 - 2 * x ); };

// Two views of the actual station. The player remains beside the crank;
// the existing watch clock, weight, cable, optic and lighting keep working.
export class WeightDriveCutscene {
	constructor( keeper ) { this.keeper = keeper; this.s = keeper.s; this.active = false; }

	start( elapsed = 0 ) {
		if ( this.active ) return;
		const s = this.s, ui = s.ui, cam = s.app.camera;
		this.active = true;
		this.elapsed = this.savedElapsed = elapsed;
		this.wasBusy = s.app.player.busy;
		this.previousFocus = document.activeElement;
		this.home = this.keeper.state.cutsceneHome || { position: cam.position.toArray(), quaternion: cam.quaternion.toArray(), fov: cam.fov };
		this.keeper.state.cutsceneHome = this.home;
		this.shot = null;
		this.root = document.createElement( 'section' );
		this.root.className = 'sh-weight-cutscene';
		this.root.setAttribute( 'role', 'dialog' );
		this.root.setAttribute( 'aria-modal', 'true' );
		this.root.setAttribute( 'aria-label', 'The driving weight' );
		this.root.innerHTML = '<div class="sh-weight-fade" aria-hidden="true"></div><div class="sh-arrival is-on sh-weight-caption"><div class="sh-arrival-from"></div><div class="sh-arrival-text" aria-live="polite" aria-atomic="true"></div></div><button type="button" class="sh-reveal-skip sh-weight-skip">Continue · Esc</button>';
		this.fade = this.root.querySelector( '.sh-weight-fade' );
		this.from = this.root.querySelector( '.sh-arrival-from' );
		this.caption = this.root.querySelector( '.sh-arrival-text' );
		this.captionWrap = this.root.querySelector( '.sh-weight-caption' );
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
		this.keeper.state.cutsceneElapsed = this.elapsed;
		s.save();
	}

	render() {
		const s = this.s, cam = s.app.camera, way = this.keeper.drive.way;
		const shot = this.elapsed < OPTIC_CUT ? 'weight' : this.elapsed < RETURN_CUT ? 'optic' : 'home';
		const a = way.angle;
		// The cutaway visits a dark shaft, away from the lantern-room lights.
		// A contained warm fill makes the iron stack and cable readable even when
		// the keeper's own lantern is out; it exists only for this teaching view.
		if ( ! this.weightLight && s.app.localLights ) {
			this.weightLight = s.app.localLights.add( {
				position: new Vector3(), color: new Color( 1, .78, .52 ),
				intensity: 5, range: 2.4, kind: 'weightStudy', always: true,
				bounds: { min: [ -.65, way.bottom - .2, -.65 ], max: [ .65, way.anchor, .65 ], softness: .2 },
			} );
		}
		if ( this.weightLight ) {
			this.weightLight.enabled = shot === 'weight';
			this.weightLight.position.set( Math.cos( a ) * .8 - Math.sin( a ) * .25,
				this.keeper.drive.at.y + .5, Math.sin( a ) * .8 + Math.cos( a ) * .25 );
		}
		let from, text;
		if ( shot === 'weight' ) {
			// Look into the existing open face from below the upper landing.
			// Keep the view still: the iron discs move against the column and treads.
			cam.position.set( Math.cos( a ) * 1.25, way.top + .25, Math.sin( a ) * 1.25 );
			cam.lookAt( new Vector3( 0, way.top - .30, 0 ) );
			from = 'The driving weight';
			text = 'The iron weights descend through the column, drawing the cable through the clockwork.';
		} else if ( shot === 'optic' ) {
			cam.position.set( Math.cos( TOWER.crankAngle ) * 1.85, TOWER.deck + 1.65, Math.sin( TOWER.crankAngle ) * 1.85 );
			cam.lookAt( new Vector3( 0, s.station.focal - .10, 0 ) );
			from = 'The revolving apparatus';
			text = s.lamp.lit ? 'Their fall turns the optic. The flame stays at the centre.' : 'Their fall turns the optic. The burner is still unlit.';
		} else {
			cam.position.fromArray( this.home.position ); cam.quaternion.fromArray( this.home.quaternion );
		}
		if ( from && this.from.textContent !== from ) this.from.textContent = from;
		if ( text && this.caption.textContent !== text ) this.caption.textContent = text;
		this.captionWrap.hidden = shot === 'home';
		// Use the player's normal field of view and the station's own render style.
		cam.fov = this.home.fov; cam.updateProjectionMatrix();
		const start = 1 - smooth( this.elapsed / .55 );
		const cut = 1 - smooth( Math.abs( this.elapsed - OPTIC_CUT ) / .4 );
		const end = 1 - smooth( Math.abs( this.elapsed - RETURN_CUT ) / .5 );
		this.fade.style.opacity = Math.max( start, cut, end ).toFixed( 3 );
		if ( shot !== this.shot ) {
			this.shot = shot;
			s.hand.resetMotion?.();
			s.app.cameraCut?.();
		}
	}

	update( dt, blocked ) {
		if ( ! this.active || blocked ) return;
		const step = Math.max( 0, Math.min( dt, 1, WEIGHT_CUTSCENE_SECONDS - this.elapsed ) );
		const s = this.s, dh = step * s.clockRate;
		s.h += dh;
		s.lamp.update( step, dh );
		s._applyClock();
		this.keeper.drive.sync( s.lamp.wind );
		this.elapsed += step;
		this.keeper.state.cutsceneElapsed = this.elapsed;
		this.render();
		if ( this.elapsed >= WEIGHT_CUTSCENE_SECONDS ) this.finish();
		else if ( this.elapsed - this.savedElapsed >= 2 ) { this.savedElapsed = this.elapsed; s.save(); }
	}

	close() {
		if ( ! this.active ) return;
		this.active = false;
		if ( this.weightLight ) this.weightLight.enabled = false;
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

	finish() {
		if ( ! this.active ) return;
		this.close();
		const state = this.keeper.state;
		delete state.cutsceneElapsed; delete state.cutsceneHome;
		state.driveCutsceneSeen = state.descentSeen = true;
		state.descentWind = this.s.lamp.wind;
		this.s.row( this.s.h, 'Driving weights seen descending in the column; revolving apparatus set going.' );
		this.keeper.afterDriveCutscene();
		this.s.save();
	}
}
