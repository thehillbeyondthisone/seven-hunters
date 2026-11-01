import { Vector3, Euler } from '../engine/math/index.js';
import { KITCHEN } from '../world/flannan/NextRooms.js';

const rotation = new Euler( 0, 0, 0, 'YXZ' );
const ease = n => { const t = Math.max( 0, Math.min( 1, n ) ); return t * t * t * ( t * ( t * 6 - 15 ) + 10 ); };
export const SMOKE_DISCOVERY_SECONDS = 7;
export const SMOKE_WITNESS_SECONDS = 2.1;
export const SMOKE_DISCOVERY_FOV = 6.5;

// Return a marker only six metres along the actual tramway from the closest
// point. It is recomputed every frame, so dense fog never leaves a thirty-metre
// gap between fixed markers. An off-route player first rejoins the rails.
export function tramwayMarker( s, home = true ) {

	const p = s.app.player.position;
	let pts = s.station.tracks.west.filter( q => q[ 0 ] >= -160 );
	if ( ! home ) pts = pts.slice().reverse();
	let nearest = null;
	for ( let i = 0; i < pts.length - 1; i ++ ) {
		const a = pts[ i ], b = pts[ i + 1 ], dx = b[ 0 ] - a[ 0 ], dz = b[ 1 ] - a[ 1 ], length = Math.hypot( dx, dz );
		const t = Math.max( 0, Math.min( 1, ( ( p.x - a[ 0 ] ) * dx + ( p.z - a[ 1 ] ) * dz ) / ( length * length ) ) );
		const x = a[ 0 ] + t * dx, z = a[ 1 ] + t * dz, distance = Math.hypot( p.x - x, p.z - z );
		if ( ! nearest || distance < nearest.distance ) nearest = { i, x, z, distance, remaining: ( 1 - t ) * length };
	}
	if ( ! nearest ) return null;
	let { x, z, i, remaining } = nearest, advance = nearest.distance > 5 ? 0 : 6;
	while ( advance > remaining && i < pts.length - 2 ) {
		advance -= remaining; i ++; x = pts[ i ][ 0 ]; z = pts[ i ][ 1 ];
		remaining = Math.hypot( pts[ i + 1 ][ 0 ] - x, pts[ i + 1 ][ 1 ] - z );
	}
	if ( advance > 0 && remaining > 0 ) {
		const t = Math.min( 1, advance / remaining ); x += ( pts[ i + 1 ][ 0 ] - x ) * t; z += ( pts[ i + 1 ][ 1 ] - z ) * t;
	}
	return { at: new Vector3( x, s.app.terrainData.heightAt( x, z ) + 1, z ), label: home ? 'Follow the tramway — station' : 'Follow the tramway — upper shed', id: home ? 'return' : 'westTramway' };

}

// The player remains standing at the first unobstructed view after the chain
// job. Their head turns and the lens briefly frames the lower chimney plume.
// No music is loaded or triggered by this sequence.
// Its complete state lives in nextWatch flags, including interrupted saves.
export class SmokeDiscovery {

	constructor( next ) { this.next = next; this.s = next.s; this.entered = false; this.key = e => {
		if ( ! this.active || ! [ 'Escape', 'KeyB' ].includes( e.code ) ) return;
		e.preventDefault(); e.stopImmediatePropagation?.();
		if ( e.code === 'Escape' && ! e.repeat ) this.continue();
	}; }
	get state() { return this.next.state.smokeCutscene; }
	get active() { return !! this.state; }
	get target() { return KITCHEN.chimney.clone().add( new Vector3( 3, 3, 1 ) ); }
	clearView() {
		const a = this.s.app, eye = a.camera.position, plume = this.target;
		if ( a.player.position.distanceTo( KITCHEN.chimney ) < 35 ) return false;
		for ( let i = 1; i < 24; i ++ ) {
			const q = eye.clone().lerp( plume, i / 24 );
			if ( q.y <= a.terrainData.heightAt( q.x, q.z ) + .25 ) return false;
		}
		return true;
	}
	start() {
		if ( this.active || this.next.state.smokeSeen || this.s.beat !== 'd3return' || ! this.clearView() ) return false;
		const a = this.s.app, p = a.player, delta = this.target.sub( a.camera.position );
		const yaw = Math.atan2( -delta.x, -delta.z );
		this.next.state.smokeCutscene = { elapsed: 0, feet: p.position.toArray(), eye: a.camera.position.toArray(),
			yaw: p.yaw, pitch: p.pitch, fov: a.camera.fov, inputEnabled: !! a.input.enabled, busy: !! p.busy, toYaw: p.yaw + Math.atan2( Math.sin( yaw - p.yaw ), Math.cos( yaw - p.yaw ) ),
			toPitch: Math.atan2( delta.y, Math.hypot( delta.x, delta.z ) ) };
		this.enter(); this.apply(); this.s.save(); return true;
	}
	enter() {
		if ( this.entered ) return;
		this.entered = true; this.wasBusy = typeof this.state.busy === 'boolean' ? this.state.busy : this.s.app.player.busy;
		// Older cinematic saves began during enabled normal play. New saves
		// preserve an intentional controller lock across the whole sequence.
		this.wasInputEnabled = typeof this.state.inputEnabled === 'boolean' ? this.state.inputEnabled : true;
		this.s.app.player.busy = true; this.s.app.player.velocity.set( 0, 0, 0 ); this.s.app.player.prompt = null;
		this.s.app.input.enabled = false; this.s.app.input.consumeLook?.();
		globalThis.window?.addEventListener( 'keydown', this.key, true );
	}
	apply() {
		const r = this.state, a = this.s.app, p = a.player, t = ease( ( r.elapsed - .25 ) / 1.65 );
		p.position.set( ...r.feet ); p.velocity.set( 0, 0, 0 ); p.prompt = null;
		p.yaw = r.yaw + ( r.toYaw - r.yaw ) * t; p.pitch = r.pitch + ( r.toPitch - r.pitch ) * t;
		a.camera.position.set( ...r.eye ); a.camera.quaternion.setFromEuler( rotation.set( p.pitch, p.yaw, 0 ) );
		// A brief authorial lens framing within the approved first-person
		// cutscene, not a new instrument or a change in the weather/time.
		const originalFov = Number.isFinite( r.fov ) ? r.fov : this.s.baseFov;
		const frame = ease( ( r.elapsed - .25 ) / 1.4 ) * ( 1 - ease( ( r.elapsed - 5.6 ) / 1.4 ) );
		a.camera.fov = originalFov + ( Math.min( SMOKE_DISCOVERY_FOV, originalFov ) - originalFov ) * frame; a.camera.updateProjectionMatrix();
		a.camera.updateMatrixWorld();
		if ( r.elapsed >= SMOKE_WITNESS_SECONDS && ! this.next.state.smokeSeen ) {
			this.next.state.smokeSeen = this.s.h; this.s.save();
		}
		this.s.ui.arrival( r.elapsed >= SMOKE_WITNESS_SECONDS ? { from: 'My watch', text: 'Smoke from the house. I banked the stove before I left.' } : null,
			r.elapsed >= 3.5 ? this.s.app.input.touchMode ? 'The way back is along the upper tramway.' : 'Esc — return to the watch' : '' );
	}
	update( dt, paused = false ) {
		if ( ! this.active ) return false;
		const r = this.state;
		if ( ! [ 'elapsed', 'yaw', 'pitch', 'toYaw', 'toPitch' ].every( k => Number.isFinite( r[ k ] ) ) ||
			! [ r.feet, r.eye ].every( v => Array.isArray( v ) && v.length === 3 && v.every( Number.isFinite ) ) ) { this.finish(); return false; }
		this.enter(); this.s.app.input.enabled = false; this.s.app.input.consumeLook?.();
		if ( ! paused ) r.elapsed = Math.min( SMOKE_DISCOVERY_SECONDS, r.elapsed + Math.max( 0, dt ) );
		this.apply();
		if ( ! paused && r.elapsed >= SMOKE_DISCOVERY_SECONDS ) this.finish();
		return true;
	}
	continue() {
		if ( ! this.active || this.s.paused || this.s.ui.open || this.s.app.mobile?.paused ) return;
		// An early press finishes the turn, then leaves the smoke in view for a
		// short beat. A later press returns control without undoing the evidence.
		if ( this.state.elapsed < 3.5 ) { this.state.elapsed = Math.max( this.state.elapsed, SMOKE_WITNESS_SECONDS ); this.apply(); }
		else { this.state.elapsed = Math.max( this.state.elapsed, 5.6 ); this.apply(); }
	}
	release() {
		if ( ! this.entered ) return;
		if ( Number.isFinite( this.state?.fov ) ) { this.s.app.camera.fov = this.state.fov; this.s.app.camera.updateProjectionMatrix(); }
		this.entered = false; globalThis.window?.removeEventListener( 'keydown', this.key, true );
		this.s.app.player.busy = !! this.wasBusy; this.s.app.player._camY = this.s.app.camera.position.y;
		this.s.app.input.reset?.();
		this.s.app.input.enabled = this.wasInputEnabled && ! ( this.s.paused || this.s.ui.open || this.s.app.mobile?.paused || this.s.app.devMenu?.open );
	}
	finish() {
		this.s.app.camera.fov = Number.isFinite( this.state?.fov ) ? this.state.fov : this.s.baseFov; this.s.app.camera.updateProjectionMatrix();
		delete this.next.state.smokeCutscene; this.release(); this.s.ui.arrival( null ); this.s.save();
	}

}
