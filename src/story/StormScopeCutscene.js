import { Quaternion, MathUtils } from '../engine/index.js';

const clamp = x => Math.max( 0, Math.min( 1, x ) );
const smooth = x => { x = clamp( x ); return x * x * ( 3 - 2 * x ); };

// The existing telescope is used from the keeper's own safe upper footing.
// This camera treatment makes no claim that this instrument was issued at Flannan.
export class StormScopeCutscene {
	constructor( storm ) { this.storm = storm; this.s = storm.s; this.active = false; }

	start() {
		if ( this.active ) return;
		const s = this.s, p = s.app.player, cam = s.app.camera, state = this.storm.state;
		this.home = state.scopeHome || {
			position: cam.position.toArray(), quaternion: cam.quaternion.toArray(),
			feet: p.position.toArray(), yaw: p.yaw, pitch: p.pitch, fov: s.baseFov || cam.fov,
			inputEnabled: s.app.input.enabled, busy: !!p.busy,
		};
		state.scopeHome = this.home;
		this.elapsed = state.scopeElapsed || 0;
		this.savedElapsed = this.elapsed;
		this.active = true;
		this.startQuaternion = new Quaternion().fromArray( this.home.quaternion );
		cam.position.fromArray( this.home.position );
		cam.lookAt( this.storm.damageTarget );
		this.aimQuaternion = cam.quaternion.clone();
		p.busy = true; p.prompt = null; p.velocity.set( 0, 0, 0 );
		s.app.input.enabled = false;
		s.interact.current = null;
		s.ui.setHUD( false ); s.ui.guidance( null, cam ); s.ui.strip( null );
		s.sound?.ratchet( false );
		s.hand.resetMotion?.(); s.app.cameraCut?.();
		this.render(); s.save();
	}

	render() {
		if ( !this.active ) return;
		const s = this.s, cam = s.app.camera, state = this.storm.state;
		const coastTime = s.app.coastal?.time ?? state.waveAt;
		const lower = state.routeDestroyed ? smooth( ( coastTime - state.crestAt - 6.7 ) / 1.3 ) : 0;
		const raise = smooth( this.elapsed / 1.2 ) * ( 1 - lower );
		s.app.player.position.fromArray( this.home.feet ); s.app.player.velocity.set( 0, 0, 0 );
		cam.position.fromArray( this.home.position );
		cam.quaternion.copy( this.startQuaternion ).slerp( this.aimQuaternion, smooth( this.elapsed / 1.05 ) );
		// A nearby landing needs a broad scope view, rather than the 3.5-degree
		// long-distance contact view. The railings and incoming water remain together.
		cam.fov = MathUtils.lerp( this.home.fov, Math.min( 34, this.home.fov ), raise );
		cam.updateProjectionMatrix(); cam.updateMatrixWorld();
		s.tel = raise;
		s.app.player.lookScale = cam.fov / s.baseFov;
		s.ui.telescope( raise );
		s.ui.arrival( state.routeDestroyed && coastTime > state.destroyedAt + 5 ? {
			from: 'Walter', text: 'The lower rails have gone. I can get back by the upper tramway.',
		} : this.elapsed < 4 ? {
			from: 'Walter', text: 'I can see the lower platform and its railings from here.',
		} : null );
	}

	update( dt, blocked ) {
		if ( !this.active ) return;
		if ( !blocked ) {
			this.elapsed += Math.max( 0, Math.min( dt, .1 ) );
			this.storm.state.scopeElapsed = this.elapsed;
			if ( this.elapsed - this.savedElapsed >= 2 ) { this.savedElapsed = this.elapsed; this.s.save(); }
		}
		this.render();
	}

	close( { completed = false } = {} ) {
		if ( !this.active ) return;
		const s = this.s, p = s.app.player, cam = s.app.camera;
		this.active = false;
		p.position.fromArray( this.home.feet ); p.velocity.set( 0, 0, 0 ); p._camY = null;
		cam.position.fromArray( this.home.position );
		cam.quaternion.fromArray( this.home.quaternion );
		p.yaw = this.home.yaw; p.pitch = this.home.pitch;
		if ( completed ) {
			const d = this.storm.damageTarget.clone().sub( cam.position ).normalize();
			p.yaw = Math.atan2( -d.x, -d.z ); p.pitch = Math.asin( d.y );
			cam.quaternion.copy( this.aimQuaternion );
		}
		cam.fov = this.home.fov; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
		s.tel = 0; p.lookScale = 1; p.busy = this.home.busy;
		s.app.input.enabled = this.home.inputEnabled !== false;
		s.app.input.consumeLook();
		s.ui.telescope( 0 ); s.ui.arrival( null ); s.ui.setHUD( true );
		s.hand.resetMotion?.(); s.app.cameraCut?.();
		if ( completed ) {
			this.storm.state.scopeSeen = true;
			delete this.storm.state.scopeElapsed; delete this.storm.state.scopeHome;
		}
	}
}
