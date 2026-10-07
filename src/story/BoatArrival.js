import { Group, Vector3, Euler, MathUtils } from '../engine/index.js';
import { G } from '../engine/render/Frame.js';
import { buildLandingBoat, LANDING_EYE, LANDING_FLOOR, LANDING_PROBES } from '../world/boat/LandingBoat.js';
import { rowingPose } from './ArrivalRowing.js';


export const CROSSING_SECONDS = 90;
export const DEPARTURE_VISIBLE_SECONDS = 480;
const eye = LANDING_EYE, rotation = new Euler( 0, 0, 0, 'YXZ' );
const point = new Vector3();

// A period-plausible open landing boat, not a measured model of a Hesperus boat.
// The diesel fishing boat stays in Tidewater.
export class BoatArrival {

	constructor( app ) {

		this.app = app;
		this.group = new Group();
		this.group.name = 'hesperus-landing-boat';
		this.group.rotation.order = 'YXZ';
		this.group.visible = false;
		this.oars = [];
		this.elapsed = 0;
		this.departure = null;
		this.heave = 0;
		this.slot = app.query?.allocate( 'arrival', LANDING_PROBES.length );
		this.detailed = !! app.isArrivalAtmosphere;
		Object.assign( this, buildLandingBoat( this.group, { detailed: this.detailed, textures: app.village?.textures?.textures } ) );
		this.rowingTime = 0;
		this.rowingPaused = false;
		this.motionTime = 0;
		this.waterHeights = new Float64Array( LANDING_PROBES.length );
		this.waterVersion = -1;
		this.waterTime = 0;
		this.riseSpeed = 0;
		this.hasWater = false;
		app.scene?.add( this.group );
		if ( app.sceneRenderer && this.hullVolume ) app.sceneRenderer.addHullMask( this.hullVolume, this.group );

	}

	get ready() { return this.elapsed >= CROSSING_SECONDS; }

	begin( elapsed = 0 ) {

		this.elapsed = MathUtils.clamp( elapsed, 0, CROSSING_SECONDS );
		this.departure = null;
		this.rowingTime = 0;
		this.rowingPaused = false;
		this.group.visible = true;
		this.hasWater = false;
		this.waterVersion = -1;
		// Conservative initial freeboard until a readback at this location arrives.
		this.heave = ( G.seaLevel.value || 0 ) + 0.85;
		this.pose( 0 );
		const p = this.app.player;
		p.yaw = Math.atan2( this.group.position.x, this.group.position.z );
		p.pitch = 0.12;
		p.velocity.set( 0, 0, 0 );
		this.camera();

	}

	pose( dt ) {

		const L = this.app.village.station.landings.east;
		const t = this.elapsed / CROSSING_SECONDS;
		// The last seconds slow as the bow comes under the cliff. The stage is kept clear.
		const distance = 14 + 235 * Math.pow( 1 - t, 1.25 ) + ( this.departure || 0 ) * 2.8;
		this.group.position.set( L.stage.x + L.dir[ 0 ] * distance, this.heave, L.stage.z + L.dir[ 1 ] * distance );
		const heading = Math.atan2( - L.dir[ 0 ], - L.dir[ 1 ] );
		this.group.rotation.y = heading + ( this.departure === null ? 0 : Math.PI * MathUtils.smoothstep( this.departure, 0, 6 ) );
		this.motionTime += Math.max( 0, dt );
		this.float( dt );
		this.rowingActive = ! this.rowingPaused && this.speed > 0.1;
		if ( this.rowingActive ) this.rowingTime += Math.max( 0, dt );
		const stroke = rowingPose( this.rowingTime, this.rowingActive );
		for ( let i = 0; i < this.oars.length; i ++ ) {

			const phase = this.motionTime * 1.7, rowing = this.speed > 0.1 ? 1 : 0;
			this.oars[ i ].rotation.y = ( i ? - 1 : 1 ) * Math.sin( phase ) * 0.28 * rowing;
			this.oars[ i ].rotation.z = ( i ? 1 : - 1 ) * ( rowing ? Math.max( 0, Math.cos( phase ) ) * 0.08 : 0.12 );
			this.arms[ i ].rotation.x = Math.sin( phase ) * 0.16 * rowing;
			if ( this.detailed ) {
				const side = i ? 1 : -1;
				const sea = this.hasWater ? this.waterHeights[ i ? 4 : 3 ] : G.seaLevel.value;
				const drop = this.oars[ i ].position.y + this.heave - sea + 0.07;
				const dip = MathUtils.clamp( Math.asin( MathUtils.clamp( drop / 2.78, 0, 0.95 ) ) - 0.159, 0.06, 0.9 );
				this.oars[ i ].rotation.y = side * stroke.sweep;
				this.oars[ i ].rotation.z = -side * ( -0.045 + ( dip + 0.045 ) * stroke.immersion );
				this.arms[ i ].rotation.x = stroke.sweep * 0.42;
			}

		}
		if ( this.detailed ) this.rower.rotation.x = stroke.lean;
		this.group.updateMatrixWorld( true );

	}

	float( dt ) {

		const q = this.app.query, pos = this.group.position;
		const yaw = this.group.rotation.y, sn = Math.sin( yaw ), cs = Math.cos( yaw );
		let valid = !! q?.cpuValid && this.slot !== undefined;
		for ( let i = 0; i < LANDING_PROBES.length; i ++ ) {
			const [ x, z ] = LANDING_PROBES[ i ], wx = pos.x + x * cs + z * sn, wz = pos.z - x * sn + z * cs;
			if ( q && this.slot !== undefined ) q.setPoint( this.slot + i, wx, wz );
			// A readback from the origin / previous crossing / pre-skip route is not this boat.
			const j = ( this.slot + i ) * 4;
			if ( ! Number.isFinite( q?.cpu?.[ j ] ) || ( q?.resultInputs && Math.hypot( q.resultInputs[ j ] - wx, q.resultInputs[ j + 1 ] - wz ) > 3 ) ) valid = false;
		}
		if ( valid ) {
			const version = q.version ?? this.motionTime;
			if ( version !== this.waterVersion ) {
				let rise = 0;
				const sampleTime = q.resultTime ?? this.motionTime, span = sampleTime - this.waterTime;
				for ( let i = 0; i < LANDING_PROBES.length; i ++ ) {
					const h = q.cpu[ ( this.slot + i ) * 4 ];
					if ( this.hasWater && span > 0.001 ) rise = Math.max( rise, ( h - this.waterHeights[ i ] ) / span );
					this.waterHeights[ i ] = h;
				}
				this.riseSpeed = MathUtils.clamp( rise, 0, 4 );
				this.waterTime = sampleTime; this.waterVersion = version; this.hasWater = true;
			}
		}
		const H = this.waterHeights, k = 1 - Math.exp( - Math.max( 0, dt ) * 3.5 );
		const pitch = this.hasWater ? MathUtils.clamp( Math.atan2( H[ 2 ] - H[ 1 ], 5.6 ), - 0.08, 0.08 ) : 0;
		const roll = this.hasWater ? MathUtils.clamp( Math.atan2( H[ 4 ] - H[ 3 ], 1.7 ), - 0.09, 0.09 ) : 0;
		this.group.rotation.x += ( pitch - this.group.rotation.x ) * k;
		this.group.rotation.z += ( roll - this.group.rotation.z ) * k;
		if ( this.hasWater ) {
			let target = -Infinity;
			const age = MathUtils.clamp( ( G.time.value || this.motionTime ) - this.waterTime, 0, 0.3 );
			// Dry-floor envelope across the hull, including roll/pitch and readback latency.
			for ( let i = 0; i < H.length; i ++ ) {
				const [ x, z ] = LANDING_PROBES[ i ];
				const floor = LANDING_FLOOR * Math.cos( this.group.rotation.x ) * Math.cos( this.group.rotation.z )
					+ x * Math.sin( this.group.rotation.z ) * Math.cos( this.group.rotation.x ) - z * Math.sin( this.group.rotation.x );
				target = Math.max( target, H[ i ] - floor + 0.32 + this.riseSpeed * age );
			}
			// Rise immediately to clear crests; settle gently into troughs, never smooth below
			// the required clearance. A modal pauses the journey, not the floating hull.
			this.heave = Math.max( target, this.heave + ( target - this.heave ) * k );
		}
		pos.y = this.heave;

	}

	get speed() {

		return this.departure !== null ? 2.8 : this.ready ? 0 : 235 * 1.25 / CROSSING_SECONDS * Math.pow( 1 - this.elapsed / CROSSING_SECONDS, 0.25 );

	}

	camera() {

		const p = this.app.player, cam = this.app.camera;
		cam.position.copy( eye );
		if ( this.detailed ) cam.position.y -= 0.24;
		cam.position.applyMatrix4( this.group.matrixWorld );
		p.position.copy( cam.position ).add( point.set( 0, - 1.62, 0 ) );
		p.velocity.set( 0, 0, 0 );
		p.prompt = null;
		cam.quaternion.setFromEuler( rotation.set( p.pitch, p.yaw, this.group.rotation.z * 0.35 ) );

	}

	reviewCamera() {

		const v = this.reviewView, app = this.app;
		if ( ! v ) return;
		if ( v.departure !== undefined ) {
			app.camera.position.set( ...v.p );
			point.copy( this.group.position ); point.y += 0.7;
			app.camera.lookAt( point );
			app.camera.updateMatrixWorld( true );
			point.setFromMatrixColumn( app.camera.matrixWorld, 2 ).negate();
			app.player.yaw = Math.atan2( -point.x, -point.z );
			app.player.pitch = Math.asin( point.y );
		} else if ( v.boatEye ) {
			app.camera.position.set( ...v.boatEye ).applyMatrix4( this.group.matrixWorld );
			app.camera.lookAt( point.set( ...v.boatAt ).applyMatrix4( this.group.matrixWorld ) );
			app.camera.updateMatrixWorld( true );
			point.setFromMatrixColumn( app.camera.matrixWorld, 2 ).negate();
			app.player.yaw = Math.atan2( - point.x, - point.z );
			app.player.pitch = Math.asin( point.y );
		} else this.camera();
		app.fly?.setPose( app.camera.position.clone(), app.player.yaw, app.player.pitch );

	}

	update( dt, { aboard = false, paused = false } = {} ) {

		if ( ! this.group.visible ) return;
		this.rowingPaused = paused;
		if ( aboard ) {

			if ( ! paused ) this.elapsed = Math.min( CROSSING_SECONDS, this.elapsed + dt );
			this.pose( dt );
			if ( this.app.freeCam ) return;
			const p = this.app.player, inp = this.app.input;
			const look = inp.consumeLook();
			if ( ! paused && inp.enabled ) {

				p.yaw -= look.x * 0.0022;
				p.pitch = MathUtils.clamp( p.pitch - look.y * 0.0022, - 1.35, 1.35 );

			}
			this.camera();

		} else if ( this.departure !== null ) {

			if ( ! paused ) this.departure += dt;
			this.pose( dt );
			// Remain a real departing boat for the stair-crest look back, shrinking
			// naturally with distance rather than vanishing during the climb.
			if ( this.departure > DEPARTURE_VISIBLE_SECONDS ) this.group.visible = false;

		}

	}

}
