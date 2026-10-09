import { Matrix4, Quaternion, Vector3 } from '../engine/math/index.js';

const UP = new Vector3( 0, 1, 0 );

export function axis( value, deadzone = 0.18 ) {

	if ( ! Number.isFinite( value ) || Math.abs( value ) <= deadzone ) return 0;
	return Math.sign( value ) * Math.min( 1, ( Math.abs( value ) - deadzone ) / ( 1 - deadzone ) );

}

export function heading( q ) {

	const f = new Vector3( 0, 0, - 1 ).applyQuaternion( q );
	return Math.atan2( - f.x, - f.z );

}

// WebGPU XR projections use conventional 0..1 depth. Keep the headset's asymmetric
// x/y projection exactly, converting only z to this engine's reversed depth.
export function reversedProjection( out, projection ) {

	out.fromArray( projection );
	const e = out.elements;
	for ( const i of [ 2, 6, 10, 14 ] ) e[ i ] = projection[ i + 1 ] - projection[ i ];
	return out;

}

export function controllerState( sources ) {

	const state = { x: 0, z: 0, turn: 0, next: false, recenter: false, exit: false, use: false };
	for ( const source of sources ) {

		const g = source.gamepad;
		if ( ! g || g.mapping !== 'xr-standard' ) continue;
		// xr-standard puts the thumbstick at 2/3, with 0/1 reserved for a touchpad.
		const a = g.axes.length >= 4 ? 2 : 0;
		const button = ( i ) => !! g.buttons[ i ]?.pressed;
		if ( source.handedness === 'left' ) {

			state.x = axis( g.axes[ a ] );
			state.z = axis( g.axes[ a + 1 ] );
			state.exit = button( 5 );

		} else if ( source.handedness === 'right' ) {

			state.turn = Number.isFinite( g.axes[ a ] ) ? g.axes[ a ] : 0;
			state.next = button( 4 );
			state.recenter = button( 5 );
			state.use = button( 0 );

		}

	}
	return state;

}

// A system overlay can leave sticks/buttons held when tracking returns. Require
// a neutral sample before handing control back, including on session entry.
export class ControllerInput {

	constructor() { this.reset(); }
	reset() { this.armed = false; }
	sample( state ) {

		if ( ! this.armed ) {

			this.armed = state.x === 0 && state.z === 0 && Math.abs( state.turn ) < 0.25
				&& ! state.next && ! state.recenter && ! state.exit && ! state.use;
			return { x: 0, z: 0, turn: 0, next: false, recenter: false, exit: false, use: false };

		}
		return state;

	}

}

export class Locomotion {

	constructor( player, { localFloor = true, speed = 1.6 } = {} ) {

		this.player = player;
		this.localFloor = localFloor;
		this.speed = speed;
		this.yaw = player.yaw;
		this.rig = new Matrix4();
		this.rotation = new Quaternion();
		this.tracked = null;
		this.snapReady = true;
		this.previous = {};
		this.heightOffset = 0;
		this.groundY = null;

	}

	edge( state, key ) {

		const hit = state[ key ] && ! this.previous[ key ];
		this.previous[ key ] = state[ key ];
		return hit;

	}

	recenter() {

		this.tracked = null;
		this.groundY = null;
		this.player.velocity.set( 0, 0, 0 );

	}

	update( pose, state, dt ) {

		const head = pose.transform.position, q = pose.transform.orientation;
		this.groundY ??= this.player.position.y;
		if ( ! this.tracked ) {

			this.yaw = this.player.yaw - heading( q );
			this.heightOffset = this.localFloor ? 0 : 1.62 - head.y;
			this.tracked = { x: head.x, z: head.z };

		}
		// Move the collision capsule with physical steps too; the rig is rebuilt about
		// the tracked head, so a snap turn never swings the viewer round an origin.
		const dx = head.x - this.tracked.x, dz = head.z - this.tracked.z;
		this._move( Math.cos( this.yaw ) * dx + Math.sin( this.yaw ) * dz, - Math.sin( this.yaw ) * dx + Math.cos( this.yaw ) * dz );
		this.tracked = { x: head.x, z: head.z };
		if ( Math.abs( state.turn ) < 0.25 ) this.snapReady = true;
		if ( this.snapReady && Math.abs( state.turn ) > 0.65 ) {

			this.yaw -= Math.sign( state.turn ) * Math.PI / 6;
			this.snapReady = false;

		}
		const h = this.yaw + heading( q );
		const length = Math.max( 1, Math.hypot( state.x, state.z ) );
		const distance = this.speed * Math.min( Math.max( dt, 0 ), 0.05 ) / length;
		const mx = ( Math.cos( h ) * state.x + Math.sin( h ) * state.z ) * distance;
		const mz = ( - Math.sin( h ) * state.x + Math.cos( h ) * state.z ) * distance;
		this._move( mx, mz );
		this.rotation.setFromAxisAngle( UP, this.yaw );
		const offset = new Vector3( head.x, 0, head.z ).applyQuaternion( this.rotation );
		const p = this.player.position;
		// Ease only the artificial floor-height changes on treads. Real head motion
		// remains unfiltered, and recenter/location changes reset this immediately.
		this.groundY += ( p.y - this.groundY ) * ( 1 - Math.exp( - 16 * Math.min( Math.max( dt, 0 ), 0.05 ) ) );
		this.groundY = Math.max( p.y - 0.4, Math.min( p.y + 0.4, this.groundY ) );
		this.rig.compose( new Vector3( p.x - offset.x, this.groundY + this.heightOffset, p.z - offset.z ), this.rotation, new Vector3( 1, 1, 1 ) );
		this.player.yaw = h;
		this.player.velocity.set( 0, 0, 0 );
		this.player.mode = 'walk';
		return this.rig;

	}

	_move( dx, dz ) {

		const p = this.player.position;
		// Short steps prevent tunnelling, including when tracking resumes after a reset.
		const distance = Math.hypot( dx, dz );
		if ( distance > 2 ) return;
		const n = Math.max( 1, Math.ceil( distance / 0.06 ) );
		for ( let i = 0; i < n; i ++ ) {

			const candidate = p.clone().add( new Vector3( dx / n, 0, dz / n ) );
			this.player.colliders.resolveCapsule( candidate, 0.3, 1.75, 0.4 );
			const ground = this.player.groundAt( candidate.x, candidate.z, p.y + 0.45 );
			// This preview stays on land, with no swimming or falls from the cliffs.
			if ( ! Number.isFinite( ground ) || ground < 0.25 || ground - p.y > 0.45 || p.y - ground > 0.55 ) continue;
			candidate.y = ground;
			p.copy( candidate );

		}

	}

}
