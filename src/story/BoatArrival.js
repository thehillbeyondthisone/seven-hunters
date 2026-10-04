import { Group, Mesh, Vector3, Euler, MathUtils } from '../engine/index.js';
import { Builder } from '../world/village/GeoBuilder.js';
import { lin, WOOD, HARD, ropeCoil } from '../world/Props.js';

export const CROSSING_SECONDS = 90;
const eye = new Vector3( 0, 1.78, 1.15 ), rotation = new Euler( 0, 0, 0, 'YXZ' );
const point = new Vector3();

// A period-plausible open landing boat, not a measured model of a Hesperus boat.
// It shares the station's timber/iron shaders. The diesel fishing boat stays in Tidewater.
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
		this.slot = app.query?.allocate( 'arrival', 1 );
		this._build( app.village.materials );
		app.scene?.add( this.group );
		if ( app.sceneRenderer && this.hullVolume ) app.sceneRenderer.addHullMask( this.hullVolume, this.group );

	}

	_meshes( B, parent, materials ) {

		for ( const [ key, batch ] of Object.entries( B.batches ) ) {

			if ( ! materials?.[ key ] ) continue;
			const mesh = new Mesh( batch.build(), materials[ key ] );
			mesh.name = 'arrival-' + key;
			mesh.castShadow = mesh.receiveShadow = true;
			parent.add( mesh );

		}

	}

	_build( materials ) {

		const B = new Builder();
		const timber = { tint: lin( 0x796248 ), data: WOOD( 0.37, 0.28, 0 ) };
		const paint = { tint: lin( 0x35453f ), data: WOOD( 0.61, 0.2, 0.8 ) };
		const iron = { tint: lin( 0x282725 ), data: HARD( 0.3, 0.1, 0.7, 0.5 ) };
		const width = ( z ) => 1.12 * Math.pow( Math.max( 0.02, Math.sin( ( z + 3.5 ) / 7 * Math.PI ) ), 0.6 );
		// Clinker planks: separate overlapping strakes, with a rising sheer at the bow.
		for ( let i = 0; i < 28; i ++ ) {

			const z0 = - 3.35 + i * 6.7 / 28, z1 = z0 + 6.7 / 28;
			for ( const side of [ - 1, 1 ] ) for ( let j = 0; j < 7; j ++ ) {

				const a = j / 7, b = ( j + 1 ) / 7;
				const at = ( z, t ) => new Vector3( side * width( z ) * ( 0.22 + 0.78 * Math.sin( t * Math.PI / 2 ) ), - 0.38 + t * ( 1.42 + Math.pow( z / 3.5, 4 ) * 0.2 ), z );
				B.slab( 'wood', [ at( z0, a ), at( z1, a ), at( z1, b ), at( z0, b ) ], 0.042, j < 3 ? paint : timber );

			}
			for ( const side of [ - 1, 1 ] ) B.beam( 'wood', [ side * width( z0 ), 1.06 + Math.pow( z0 / 3.5, 4 ) * 0.2, z0 ], [ side * width( z1 ), 1.06 + Math.pow( z1 / 3.5, 4 ) * 0.2, z1 ], 0.08, 0.08, timber );
			// Floorboards stay above the design waterline.
			B.box( 'wood', 0, 0.24, ( z0 + z1 ) / 2, width( ( z0 + z1 ) / 2 ) * 1.45, 0.07, 6.7 / 28 - 0.004, timber );

		}
		B.beam( 'wood', [ 0, - 0.32, - 3.4 ], [ 0, - 0.32, 3.4 ], 0.16, 0.16, timber );
		// Close the ends: a narrow transom aft and planks meeting at the bow stem.
		const stern = width( - 3.35 ), bow = width( 3.35 );
		B.slab( 'wood', [ new Vector3( - stern, 1.24, - 3.35 ), new Vector3( stern, 1.24, - 3.35 ), new Vector3( stern * 0.22, - 0.38, - 3.35 ), new Vector3( - stern * 0.22, - 0.38, - 3.35 ) ], 0.045, timber );
		for ( const side of [ - 1, 1 ] ) {

			B.slab( 'wood', [ new Vector3( side * bow, 1.24, 3.35 ), new Vector3( 0, 1.3, 3.68 ), new Vector3( 0, - 0.38, 3.68 ), new Vector3( side * bow * 0.22, - 0.38, 3.35 ) ], 0.045, timber );
			B.beam( 'wood', [ side * bow, 1.24, 3.35 ], [ 0, 1.3, 3.68 ], 0.08, 0.08, timber );

		}
		B.slab( 'wood', [ new Vector3( - bow * 0.72, 0.28, 3.35 ), new Vector3( 0, 0.28, 3.68 ), new Vector3( bow * 0.72, 0.28, 3.35 ) ], 0.07, { ...timber, up: new Vector3( 0, 1, 0 ) } );
		B.rod( 'wood', [ 0, - 0.4, 3.68 ], [ 0, 1.34, 3.68 ], 0.05, 0.05, timber );
		// Closed volume for the ocean's hull exclusion pass: waves stay outside the boat.
		const mask = new Builder(), rim = [];
		for ( let i = 0; i <= 28; i ++ ) {

			const z = - 3.35 + i * 6.7 / 28;
			rim.push( new Vector3( width( z ), 1.15, z ) );

		}
		for ( let i = 28; i >= 0; i -- ) {

			const z = - 3.35 + i * 6.7 / 28;
			rim.push( new Vector3( - width( z ), 1.15, z ) );

		}
		mask.slab( 'wood', rim, 1.6, { up: new Vector3( 0, 1, 0 ) } );
		this.hullVolume = mask.batches.wood.build();
		for ( const z of [ - 2.3, - 0.2, 1.55 ] ) B.box( 'wood', 0, 0.72, z, width( z ) * 1.92, 0.085, 0.31, timber );
		B.box( 'wood', 0.35, 0.48, 2.35, 0.64, 0.45, 0.8, { ...timber, tint: lin( 0x837354 ) } );
		for ( const z of [ 2.05, 2.65 ] ) B.box( 'hard', 0.35, 0.49, z, 0.67, 0.48, 0.035, iron );
		ropeCoil( B, - 0.4, 0.28, 2.2, 0.018, 0.22, 4, 0.41 );
		// A spare envelope on the stores beside the forward seat.
		B.box( 'wood', 0.35, 0.72, 2.35, 0.32, 0.025, 0.23, { tint: lin( 0xd3c6a7 ), data: WOOD( 0.3, 0, 1 ) } );
		B.box( 'hard', 0.35, 0.74, 2.35, 0.012, 0.008, 0.24, { tint: lin( 0x776444 ), data: HARD( 0.1, 0, 0, 1 ) } );
		// A rower in wool and oilskins; deliberately modest procedural detail.
		const coat = { tint: lin( 0x3b403c ), data: HARD( 0.6, 0, 0, 0.94 ) };
		const skin = { tint: lin( 0x9e7d66 ), data: HARD( 0.2, 0, 0, 0.9 ) };
		B.lathe( 'hard', 0, 0.75, - 0.15, [ [ 0.23, 0 ], [ 0.29, 0.12 ], [ 0.25, 0.48 ], [ 0.14, 0.6 ] ], { ...coat, segs: 16 } );
		B.lathe( 'hard', 0, 1.3, - 0.16, [ [ 0.05, 0 ], [ 0.075, 0.025 ], [ 0.105, 0.07 ], [ 0.115, 0.15 ], [ 0.11, 0.22 ], [ 0.07, 0.27 ], [ 0, 0.28 ] ], { ...skin, segs: 20 } );
		B.cyl( 'hard', 0, 1.44, - 0.265, 0.018, 0.03, 0.045, { ...skin, rx: - Math.PI / 2, segs: 8, capBot: true } );
		B.lathe( 'hard', 0, 1.5, - 0.16, [ [ 0.14, 0 ], [ 0.14, 0.04 ], [ 0.12, 0.12 ], [ 0.02, 0.14 ] ], { ...coat, segs: 16 } );
		for ( const side of [ - 1, 1 ] ) {

			B.rod( 'hard', [ side * 0.19, 1.22, - 0.15 ], [ side * 0.4, 0.92, - 0.55 ], 0.1, 0.07, coat );
			B.rod( 'hard', [ side * 0.4, 0.92, - 0.55 ], [ side * 0.66, 1.02, - 0.3 ], 0.07, 0.045, coat );
			B.box( 'hard', side * 0.16, 0.46, - 0.77, 0.17, 0.18, 0.55, coat );
			const oar = new Group(), O = new Builder();
			oar.position.set( side * 0.93, 1.04, - 0.3 );
			O.rod( 'wood', [ - side * 0.48, 0, 0 ], [ side * 2.55, - 0.55, 0 ], 0.032, 0.027, timber );
			O.box( 'wood', side * 2.25, - 0.49, 0, 0.66, 0.055, 0.2, { ...timber, rz: - side * 0.18 } );
			this._meshes( O, oar, materials );
			this.group.add( oar );
			this.oars.push( oar );

		}
		this._meshes( B, this.group, materials );

	}

	get ready() { return this.elapsed >= CROSSING_SECONDS; }

	begin( elapsed = 0 ) {

		this.elapsed = MathUtils.clamp( elapsed, 0, CROSSING_SECONDS );
		this.departure = null;
		this.group.visible = true;
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
		const q = this.app.query;
		if ( q && this.slot !== undefined ) {

			q.setPoint( this.slot, this.group.position.x, this.group.position.z );
			const h = q.cpuValid ? q.cpu[ this.slot * 4 ] : 0;
			if ( Number.isFinite( h ) ) this.heave += ( h - this.heave ) * ( 1 - Math.exp( - dt * 1.8 ) );

		}
		this.group.position.y = this.heave;
		this.group.rotation.x = Math.sin( this.elapsed * 0.9 + ( this.departure || 0 ) ) * 0.018;
		this.group.rotation.z = Math.sin( this.elapsed * 1.2 + ( this.departure || 0 ) ) * 0.025;
		for ( let i = 0; i < this.oars.length; i ++ ) {

			const phase = ( this.elapsed + ( this.departure || 0 ) ) * 1.7;
			this.oars[ i ].rotation.y = ( i ? - 1 : 1 ) * Math.sin( phase ) * 0.28;
			this.oars[ i ].rotation.z = ( i ? 1 : - 1 ) * Math.max( 0, Math.cos( phase ) ) * 0.08;

		}
		this.group.updateMatrixWorld( true );

	}

	get speed() {

		return this.departure !== null ? 2.8 : this.ready ? 0 : 235 * 1.25 / CROSSING_SECONDS * Math.pow( 1 - this.elapsed / CROSSING_SECONDS, 0.25 );

	}

	camera() {

		const p = this.app.player, cam = this.app.camera;
		cam.position.copy( eye ).applyMatrix4( this.group.matrixWorld );
		p.position.copy( cam.position ).add( point.set( 0, - 1.62, 0 ) );
		p.velocity.set( 0, 0, 0 );
		p.prompt = null;
		cam.quaternion.setFromEuler( rotation.set( p.pitch, p.yaw, this.group.rotation.z * 0.35 ) );

	}

	update( dt, { aboard = false, paused = false } = {} ) {

		if ( ! this.group.visible ) return;
		if ( aboard ) {

			if ( ! paused ) this.elapsed = Math.min( CROSSING_SECONDS, this.elapsed + dt );
			this.pose( paused ? 0 : dt );
			if ( this.app.freeCam ) return;
			const p = this.app.player, inp = this.app.input;
			const look = inp.consumeLook();
			if ( ! paused && inp.enabled ) {

				p.yaw -= look.x * 0.0022;
				p.pitch = MathUtils.clamp( p.pitch - look.y * 0.0022, - 1.35, 1.35 );

			}
			this.camera();

		} else if ( this.departure !== null && ! paused ) {

			this.departure += dt;
			this.pose( dt );
			if ( this.departure > 65 ) this.group.visible = false;

		}

	}

}
