import { Vector3, MathUtils } from '../engine/math/index.js';
import { STATION, TOWER, updateDoor } from '../world/flannan/Station.js';
import { SUNSET } from './Script.js';
import { routeGuidance } from './Guidance.js';

export const GATE_WRAP_SECONDS = 1.8;
export const GATE_REVEAL_SECONDS = 8.5;
export const GATE_REVEAL_LEAN = .48;
export const GATE_REVEAL_FOV = 42;
export const GATE_FOCUS_EXPOSURE = 3;

// The first-night revision has no second light. Its uncertainty concerns a
// familiar gate Walter personally closed. Mesh and grip authoring is in Blender.
export class FirstWatchRevision {
	constructor( story ) {
		this.s = story;
		this.cutscene = { active: false, close: () => this.closeReveal() };
		const a = Math.atan2( STATION.eastGate.z, STATION.eastGate.x );
		this.rail = new Vector3( Math.cos( a ) * TOWER.gallery.rail, TOWER.deck + 1, Math.sin( a ) * TOWER.gallery.rail );
	}
	get state() { return this.s.flags.firstWatchRevision ||= { version: 1 }; }
	// Looking beyond the carried flame shields the eyes from its close glare.
	// App uses the normal dark-adaptation response; the lantern stays lit.
	get shieldsLantern() { return this.cutscene.active && this.elapsed >= .3 && this.elapsed < GATE_REVEAL_SECONDS - 1.25; }
	// A brief perceptual focus belongs to the player's actual view. It changes
	// neither the yard's light sources nor the carried lantern's saved state.
	get focusExposure() {
		if ( ! this.cutscene.active ) return 1;
		const focus = MathUtils.smoothstep( this.elapsed, 0, 2 );
		const returning = MathUtils.smoothstep( this.elapsed, GATE_REVEAL_SECONDS - 1.25, GATE_REVEAL_SECONDS );
		return 1 + ( GATE_FOCUS_EXPOSURE - 1 ) * focus * ( 1 - returning );
	}
	get applies() { const s = this.s; return ! s.next?.active && ! s.returningLight?.active && ! s.storm?.active && ! s.later?.active && ! s.morning?.enabled && ! [ 'intro', 'crossing', 'end' ].includes( s.beat ); }
	get needsWrap() { return this.applies && [ 'gate-secure', 'gate' ].includes( this.s.beat ); }
	get readyForReveal() { return this.applies && this.s.beat === 'haar' && this.state.initialSecured && ! this.state.revealed; }
	get clockCap() {
		const s = this.s;
		if ( ! this.applies ) return Infinity;
		const working = s.lamp.lit && s.lamp.running && ( ! s.keeper?.enabled || s.keeper.state.verified );
		if ( ! working && ! s.flags.firstLightMilestone ) return SUNSET - .03;
		if ( ! s.flags.firstLightMilestone ) s.flags.firstLightMilestone = s.h;
		if ( ! s.flags.talked || ! this.state.initialSecured ) return s.haar - .08;
		if ( ! this.state.revealed || s.beat === 'gate' ) return s.haar + .8;
		return Infinity;
	}
	clockAdvance( hours ) {
		if ( this.s.signal || this.s.watcher?.talking || this.s.guidedSignal?.active || this.needsWrap ) return 0;
		return Math.max( 0, Math.min( hours, this.clockCap - this.s.h ) );
	}
	install() {
		const s = this.s, gate = s.interact.get( 'gate' );
		const text = gate.text, use = gate.use;
		gate.text = () => this.needsWrap ? s.beat === 'gate' ? 'Close the gate and wrap the rope again' : 'Close the gate and wrap the rope' : typeof text === 'function' ? text() : text;
		gate.detail = () => this.needsWrap ? 'Hold E to draw it shut and secure it against the wind' : '';
		Object.defineProperty( gate, 'hold', { configurable: true, get: () => this.needsWrap ? GATE_WRAP_SECONDS : 0 } );
		gate.use = () => this.needsWrap ? this.secureGate( 0, { reason: s.beat === 'gate' ? 'resecure' : 'first-night' } ) : use();
		const rail = s.interact.get( 'galleryRail' );
		if ( rail ) { const old = rail.when; rail.when = () => ! this.readyForReveal && old(); }
		s.interact.add( { id: 'gateLookout', at: this.rail, size: .6, reach: 2.6, aimDegrees: 70,
			when: () => this.readyForReveal && Math.abs( s.app.player.position.y - TOWER.deck ) < .35
				&& Math.hypot( s.app.player.position.x, s.app.player.position.z ) > TOWER.gallery.ledgeOuter + .25
				&& s.app.player.position.distanceTo( this.rail ) < 3,
			text: 'Examine the sea from the east rail', detail: 'Look out, then take in the yard below', hold: 1.2,
			use: () => this.startReveal() } );
	}
	secureGate( index = 0, { reason = 'first-night' } = {} ) {
		const s = this.s, doors = index === 0 ? s.doors.gate : s.doors.southGate;
		if ( ! doors?.length ) return false;
		for ( const leaf of doors ) leaf.target = 0;
		s.flags.gateRopes ||= {};
		s.flags.gateRopes[ index ] = { secured: true, at: s.h, reason };
		s.sound?.door( 'gate', 0, doors[ 0 ].center );
		if ( reason === 'first-night' ) {
			this.state.initialSecured = s.h;
			s.row( s.h, 'Entrance gate closed and secured with a rope wrap.' );
			s.setBeat( s.h > s.haar ? 'haar' : 'evening' );
			s.toast( 'I have drawn the rope tight. The gate will hold against the wind.', 5000 );
		} else if ( reason === 'resecure' ) {
			this.state.resecured = s.h;
			s.flags.gateSecured = s.h;
			s.setBeat( 'night' );
			s.toast( 'The gate is shut. The rope is tight again.', 4500 );
		}
		s.save();
		return true;
	}
	openGate( index = 0 ) {
		const state = this.s.flags.gateRopes?.[ index ];
		if ( state ) state.secured = false;
	}
	afterContact() {
		if ( ! this.applies || this.state.initialSecured || [ 'dawn', 'journal' ].includes( this.s.beat ) ) return;
		this.s.setBeat( 'gate-secure' );
		this.s.toast( 'Before I settle in, I must shut the entrance gate and wrap the rope against the wind.', 6500 );
	}
	goal() {
		if ( ! this.applies ) return '';
		if ( this.s.beat === 'gate-secure' ) return 'Close the entrance gate and secure it with the rope. Hold E at the gate.';
		if ( this.s.beat === 'gate' ) return 'Secure the gate. Close it and wrap the rope again.';
		if ( this.readyForReveal ) return 'The far shore is lost in fog. Examine the sea from the east balcony rail.';
		return '';
	}
	guidance() {
		const s = this.s;
		if ( this.needsWrap ) return routeGuidance( s.app.player.position, { at: s.interact.get( 'gate' ).at, id: 'gate', label: 'Secure the entrance gate — hold E' }, 'yard' );
		if ( this.readyForReveal ) return routeGuidance( s.app.player.position, { at: this.rail, id: 'gateLookout', label: 'Examine the sea — hold E' }, 'gallery' );
		return null;
	}
	startReveal() {
		if ( ! this.readyForReveal || this.cutscene.active ) return;
		const s = this.s, camera = s.app.camera;
		this.cutscene.active = true;
		this.elapsed = 0;
		this.home = { position: camera.position.clone(), quaternion: camera.quaternion.clone(), fov: camera.fov, busy: s.app.player.busy, inputEnabled: s.app.input.enabled };
		this.target = new Vector3( STATION.eastGate.x, STATION.yard + .7, STATION.eastGate.z );
		// Walter keeps his feet behind the railing and leans his head forward.
		// Clearing the near handrail lets the familiar opening read below him.
		this.lean = this.target.clone().sub( this.home.position ).setY( 0 ).normalize().multiplyScalar( GATE_REVEAL_LEAN );
		for ( const leaf of s.doors.gate ) { leaf.target = leaf.open = 1; updateDoor( leaf, 0 ); }
		this.openGate();
		this.state.revealPending = true;
		s.flags.gateMoved = s.h;
		s.flags.gateWas = 'open';
		s.app.player.busy = true;
		s.app.player.velocity.set( 0, 0, 0 );
		s.app.input.enabled = false;
		s.app.player.prompt = null;
		s.ui.setHUD( false ); s.ui.arrival( null ); s.ui.strip( null );
		s.interact.current = null;
		s.audioCues?.play( 'gate-discovery' );
		s.save();
	}
	updateReveal( dt, blocked = false ) {
		if ( ! this.cutscene.active ) return false;
		const s = this.s, cam = s.app.camera;
		if ( blocked ) return true;
		this.elapsed += Math.max( 0, Math.min( dt, 1 ) );
		const lookIn = MathUtils.smoothstep( this.elapsed, .3, 2.5 );
		const returnToWatch = MathUtils.smoothstep( this.elapsed, GATE_REVEAL_SECONDS - 1.25, GATE_REVEAL_SECONDS );
		const look = lookIn * ( 1 - returnToWatch );
		cam.position.copy( this.home.position ).addScaledVector( this.lean, look );
		cam.lookAt( this.target );
		this.look = this.look || cam.quaternion.clone(); this.look.copy( cam.quaternion );
		cam.quaternion.copy( this.home.quaternion ).slerp( this.look, look );
		cam.fov = MathUtils.lerp( this.home.fov, Math.min( this.home.fov, GATE_REVEAL_FOV ), look ); cam.updateProjectionMatrix();
		if ( this.elapsed >= GATE_REVEAL_SECONDS ) this.finishReveal();
		return true;
	}
	finishReveal() {
		if ( ! this.cutscene.active ) return;
		const s = this.s;
		this.state.revealed = s.h;
		delete this.state.revealPending;
		this.closeReveal();
		s.setBeat( 'gate' );
		s.toast( 'I shut that gate. Secure the gate.', 5500 );
		s.save();
	}
	closeReveal() {
		if ( ! this.cutscene.active ) return;
		this.cutscene.active = false;
		const s = this.s, camera = s.app.camera;
		camera.position.copy( this.home.position ); camera.quaternion.copy( this.home.quaternion ); camera.fov = this.home.fov; camera.updateProjectionMatrix();
		s.app.player.busy = this.home.busy; s.app.input.enabled = this.home.inputEnabled; s.app.input.consumeLook?.(); s.ui.setHUD( true ); s.app.cameraCut?.();
	}
	restore() {
		const s = this.s;
		if ( ! this.applies ) return;
		// An interrupted reveal resumes as the clear follow-up, with no second
		// sting and no input lock. Existing dawn/completed saves retain progress.
		if ( this.state.revealPending ) { this.state.revealed = s.h; delete this.state.revealPending; s.beat = 'gate'; }
		if ( this.state.resecured && s.beat === 'gate' ) s.beat = 'night';
		if ( s.flags.gateMoved && ! this.state.initialSecured && ! [ 'dawn', 'journal', 'night' ].includes( s.beat ) ) { this.state.legacyGate = true; s.beat = 'gate-secure'; delete s.flags.gateMoved; }
		if ( ! s.lamp.lit && ! s.flags.firstLightMilestone && [ 'climb', 'room', 'letter', 'light', 'machine' ].includes( s.beat ) ) s.h = Math.min( s.h, this.clockCap );
		s.islet = null;
	}
}
