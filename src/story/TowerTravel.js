import { Vector3 } from '../engine/math/index.js';
import { TOWER } from '../world/flannan/Station.js';

const radial = ( r, a, y ) => new Vector3( Math.cos( a ) * r, y, Math.sin( a ) * r );
const T = TOWER, H = T.hatch;
const head = new Vector3( Math.cos( H.angle ) * H.r - Math.sin( H.angle ) * ( H.run + 0.15 ), T.deck,
	Math.sin( H.angle ) * H.r + Math.cos( H.angle ) * ( H.run + 0.15 ) );
const headAngle = Math.atan2( head.z, head.x );
const smooth = t => { const k = Math.max( 0, Math.min( 1, t ) ); return k * k * k * ( k * ( k * 6 - 15 ) + 10 ); };
const turnTo = ( from, to, t ) => from + Math.atan2( Math.sin( to - from ), Math.cos( to - from ) ) * t;
const hatchPoint = ( run, y ) => new Vector3( Math.cos( H.angle ) * H.r - Math.sin( H.angle ) * run, y,
	Math.sin( H.angle ) * H.r + Math.cos( H.angle ) * run );

// The only playable route between tower levels. The historic stair stays in
// view; journeys never skip a duty, advance the clock or change held equipment.
export class TowerTravel {

	constructor( story ) {
		this.s = story;
		this.active = false;
		this.bottom = radial( 1.35, T.doorAngle, T.floor );
		// Step beyond the existing hatch handrail, with capsule clearance.
		this.top = radial( 1.75, headAngle + 0.45, T.deck );
	}

	canUse( up ) {
		const s = this.s, a = s.app, p = a.player;
		if ( this.active || s.paused || s.ui.open || s.signal || s.tel > 0.1 || p.busy || p.mode !== 'walk' || ! p.grounded
			|| a.input.enabled === false || a.freeCam || a.mobile?.paused || a.devMenu?.open || a.ui?.ui?.photoMode || s.islandReveal?.active || s.keeper?.cinematic ) return false;
		if ( Math.hypot( p.position.x, p.position.z ) >= 2.1 || Math.abs( p.position.y - ( up ? T.floor : T.deck ) ) >= .4 ) return false;
		// Start at the open entrance: a use from across the tower would send
		// the approach camera through the weight tube or hatch handrails.
		if ( up ) return p.position.distanceTo( this.bottom ) < 1.5;
		const run = -Math.sin( H.angle ) * p.position.x + Math.cos( H.angle ) * p.position.z;
		return run > H.run + .12 && p.position.distanceTo( head ) < 1.2;
	}

	install() {
		const a = this.s.app, c = a.colliders;
		// The stair is scenery during free walking. Safety thresholds hand the
		// player to the automatic journey; they are not invented iron gates.
		for ( const surface of c.surfaces ) if ( surface.tag === 'stair' ) surface.enabled = false;
		for ( const box of c.boxes ) {
			if ( box.tag === 'hatchStair' ) box.walkable = false;
			if ( box.tag === 'hatchRail' ) { box.half.y = 1.1; box.center.y = T.deck + 1.1; box.top = T.deck + 2.2; }
		}
		const threshold = ( from, to ) => {
			const d = to.clone().sub( from ), center = from.clone().add( to ).multiplyScalar( .5 ); center.y += 1.1;
			c.addBox( center, new Vector3( d.length() / 2, 1.1, .035 ), Math.atan2( -d.z, d.x ), { tag: 'towerTravelThreshold' } );
		};
		threshold( radial( T.newel, T.start - .03, T.floor ), radial( T.rIn, T.start - .03, T.floor ) );
		const hatchEdge = w => new Vector3( Math.cos( H.angle ) * ( H.r + w ) - Math.sin( H.angle ) * ( H.run + .03 ), T.deck,
			Math.sin( H.angle ) * ( H.r + w ) + Math.cos( H.angle ) * ( H.run + .03 ) );
		threshold( hatchEdge( -H.half - .08 ), hatchEdge( H.half + .08 ) );
		const detail = 'One press — you walk the stairs automatically';
		this.s.interact.add( { id: 'towerUp', at: radial( 1.35, T.start + 0.18, T.floor + 1.0 ), reach: 2, size: 0.7,
			text: 'Take the stairs to the lantern', detail, when: () => this.canUse( true ), use: () => this.go( true ) } );
		this.s.interact.add( { id: 'towerDown', at: head.clone().setY( T.deck + 1.1 ), reach: 2, size: 0.65,
			text: 'Take the stairs to the keeper’s room', detail: 'Press to descend — you walk the stairs automatically', when: () => this.canUse( false ), use: () => this.go( false ) } );
	}

	update() {
		const { app } = this.s, p = app.player, input = app.input;
		// Walking into the lower entrance starts the same journey as E. At the
		// lantern, descending always needs a press: the crank stands beside the
		// hatch, and looking down while approaching it must not take you away.
		let forward = Number( input.down( 'KeyW' ) ) - Number( input.down( 'KeyS' ) );
		let side = Number( input.down( 'KeyD' ) ) - Number( input.down( 'KeyA' ) );
		const touch = input.move;
		if ( touch ) { forward += touch.y; side += touch.x; }
		const dx = -Math.sin( p.yaw ) * forward + Math.cos( p.yaw ) * side;
		const dz = -Math.cos( p.yaw ) * forward - Math.sin( p.yaw ) * side;
		if ( Math.hypot( dx, dz ) < .15 ) return false;
		if ( this.canUse( true ) ) {
			const angle = Math.atan2( p.position.z, p.position.x );
			const delta = Math.atan2( Math.sin( angle - T.start ), Math.cos( angle - T.start ) );
			const toThreshold = Math.sin( delta ) * Math.hypot( p.position.x, p.position.z );
			if ( delta > -Math.PI / 2 && delta < .08 && toThreshold > -.5
				&& -Math.sin( T.start ) * dx + Math.cos( T.start ) * dz > .15 ) return this.go( true );
		}
		return false;
	}

	restorePosition() {
		const p = this.s.app.player;
		const onOldHatch = Math.abs( p.position.y - T.deck ) < .4 && this.s.app.colliders.groundHeightAt( p.position.x, p.position.z, T.deck + .1 ) < T.deck - .4;
		if ( Math.hypot( p.position.x, p.position.z ) < T.rIn && ( onOldHatch || p.position.y > T.floor + .4 && p.position.y < T.deck - .4 ) ) {
			p.position.copy( p.position.y > ( T.floor + T.deck ) / 2 ? this.top : this.bottom );
			p._camY = null;
		}
	}

	async go( up ) {
		if ( ! this.canUse( up ) ) return false;
		const s = this.s, a = s.app, p = a.player;
		this.active = true;
		s.paused = true;
		p.busy = true;
		p.velocity.set( 0, 0, 0 );
		p.prompt = null;
		const departure = { eye: a.camera.position.clone(), yaw: p.yaw, pitch: p.pitch };
		let arrival, step = 0;
		const reduced = a.settings.cameraBob === false || a.settings.cameraBob === undefined && globalThis.matchMedia?.( '(prefers-reduced-motion: reduce)' )?.matches;
		const lower = q => {
			const angle = T.doorAngle + ( T.start + .65 - T.doorAngle ) * q;
			return radial( 1.35, angle, T.floor + 1.62 + Math.max( 0, angle - T.start ) / T.dTread * T.riser );
		};
		const upper = q => {
			const run = .72 + q * ( H.run + .27 - .72 );
			return hatchPoint( run, T.landing + 1.62 + Math.min( 1, run / H.run ) * ( T.deck - T.landing ) );
		};
		const animate = ( progress, arrived ) => {
			const q = smooth( arrived ? ( progress - .57 ) / .43 : progress / .42 );
			let yaw, pitch;
			if ( up && ! arrived ) {
				// Follow the real first tread arc, rather than sliding straight
				// through the risers. Ease position and gaze independently.
				a.camera.position.copy( departure.eye ).lerp( lower( q ), smooth( q / .45 ) );
				yaw = turnTo( departure.yaw, Math.PI - ( T.doorAngle + ( T.start + .65 - T.doorAngle ) * q ), q );
				pitch = departure.pitch + ( -.12 - departure.pitch ) * q;
			} else if ( ! up && ! arrived ) {
				if ( q < .45 ) a.camera.position.copy( departure.eye ).lerp( upper( 1 ), smooth( q / .45 ) );
				else a.camera.position.copy( upper( 1 - smooth( ( q - .45 ) / .55 ) ) );
				yaw = turnTo( departure.yaw, -H.angle, q );
				pitch = departure.pitch + ( -.35 - departure.pitch ) * q;
			} else if ( up ) {
				if ( q < .7 ) a.camera.position.copy( upper( smooth( q / .7 ) ) );
				else a.camera.position.copy( upper( 1 ) ).lerp( arrival.eye, smooth( ( q - .7 ) / .3 ) );
				yaw = turnTo( Math.PI - H.angle, arrival.yaw, q );
				pitch = -.12 + ( arrival.pitch + .12 ) * q;
			} else {
				a.camera.position.copy( lower( 1 - q ) ).lerp( arrival.eye, smooth( ( q - .7 ) / .3 ) );
				yaw = turnTo( -( T.start + .65 ), arrival.yaw, q );
				pitch = -.24 + ( arrival.pitch + .24 ) * q;
			}
			if ( ! reduced ) a.camera.position.y += Math.sin( q * Math.PI * 6 ) * Math.sin( q * Math.PI ) ** 2 * .009;
			a.camera.rotation.set( pitch, yaw, 0, 'YXZ' );
			// Footfalls continue through the hidden middle of the climb.
			const nextStep = Math.floor( progress * 10 );
			if ( nextStep > step && progress < .98 ) p.audio?.footstep( 'rock' );
			step = nextStep;
		};
		try {
			await s.ui.travel( up ? 'You climb the iron stair to the lantern.' : 'You descend the iron stair to the keeper’s room.', () => {
				p.position.copy( up ? this.top : this.bottom );
				p.velocity.set( 0, 0, 0 );
				p.grounded = true;
				p.bob = p.stepDist = 0;
				p.pitch = -0.12;
				const look = up ? radial( 1.8, headAngle + 0.8, T.deck ) : radial( 3.5, T.doorAngle, T.floor );
				p.yaw = Math.atan2( p.position.x - look.x, p.position.z - look.z );
				p._camY = null;
				// The safety controller pauses Player.update during travel. Set the
				// destination pose explicitly so the visible arrival never eases back
				// to the departure camera before walking resumes.
				a.camera.position.copy( p.position ).add( new Vector3( 0, 1.62, 0 ) );
				a.camera.rotation.set( p.pitch, p.yaw, 0, 'YXZ' );
				a.cameraCut?.();
				arrival = { eye: a.camera.position.clone(), yaw: p.yaw, pitch: p.pitch };
			}, animate );
		} finally {
			p.busy = false;
			s.paused = false;
			this.active = false;
		}
		s.save();
		return true;
	}

}
