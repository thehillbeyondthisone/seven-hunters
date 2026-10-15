import { Vector3 } from '../engine/math/index.js';
import { TOWER } from '../world/flannan/Station.js';
import { Mesh } from '../engine/index.js';
import { Builder } from '../world/village/GeoBuilder.js';
import { lin, HARD } from '../world/Props.js';

const radial = ( r, a, y ) => new Vector3( Math.cos( a ) * r, y, Math.sin( a ) * r );
const T = TOWER, H = T.hatch;
const head = new Vector3( Math.cos( H.angle ) * H.r - Math.sin( H.angle ) * ( H.run + 0.15 ), T.deck,
	Math.sin( H.angle ) * H.r + Math.cos( H.angle ) * ( H.run + 0.15 ) );
const headAngle = Math.atan2( head.z, head.x );

// The only playable route between tower levels. The historic stair stays in
// view; journeys never skip a duty, advance the clock or change held equipment.
export class TowerTravel {

	constructor( story ) {
		this.s = story;
		this.active = false;
		this.bottom = radial( 1.35, T.doorAngle, T.floor );
		// Step beyond the hatch guard, with capsule clearance on both sides.
		this.top = radial( 1.75, headAngle + 0.45, T.deck );
	}

	canUse( up ) {
		const s = this.s, a = s.app, p = a.player;
		if ( this.active || s.paused || s.ui.open || s.signal || s.tel > 0.1 || p.busy || p.mode !== 'walk' || ! p.grounded
			|| a.input.enabled === false || a.freeCam || a.mobile?.paused || a.devMenu?.open || a.ui?.ui?.photoMode || s.islandReveal?.active ) return false;
		return Math.hypot( p.position.x, p.position.z ) < 2.1
			&& Math.abs( p.position.y - ( up ? T.floor : T.deck ) ) < 0.4;
	}

	install() {
		const a = this.s.app, c = a.colliders;
		// Retain the stair as scenery, with visible guards at its two entrances.
		for ( const surface of c.surfaces ) if ( surface.tag === 'stair' ) surface.enabled = false;
		for ( const box of c.boxes ) {
			if ( box.tag === 'hatchStair' ) box.walkable = false;
			if ( box.tag === 'hatchRail' ) { box.half.y = 1.1; box.center.y = T.deck + 1.1; box.top = T.deck + 2.2; }
		}
		const B = new Builder(), iron = { tint: lin( 0x424946 ), data: HARD( .55, 0, .65, .2 ) };
		const gate = ( from, to ) => {
			for ( const height of [ .5, 1.02 ] ) B.rod( 'hard', from.clone().add( new Vector3( 0, height, 0 ) ).toArray(), to.clone().add( new Vector3( 0, height, 0 ) ).toArray(), .018, .018, { segs: 6, ...iron } );
			for ( let i = 0; i <= 5; i ++ ) {
				const foot = from.clone().lerp( to, i / 5 );
				B.rod( 'hard', foot.toArray(), foot.clone().add( new Vector3( 0, 1.02, 0 ) ).toArray(), .012, .012, { segs: 6, ...iron } );
			}
			const d = to.clone().sub( from ), center = from.clone().add( to ).multiplyScalar( .5 ); center.y += 1.1;
			c.addBox( center, new Vector3( d.length() / 2, 1.1, .035 ), Math.atan2( -d.z, d.x ), { tag: 'towerTravelGuard' } );
		};
		gate( radial( T.newel, T.start - .03, T.floor ), radial( T.rIn, T.start - .03, T.floor ) );
		const hatchPoint = w => new Vector3( Math.cos( H.angle ) * ( H.r + w ) - Math.sin( H.angle ) * ( H.run + .03 ), T.deck,
			Math.sin( H.angle ) * ( H.r + w ) + Math.cos( H.angle ) * ( H.run + .03 ) );
		gate( hatchPoint( -H.half - .08 ), hatchPoint( H.half + .08 ) );
		const village = a.village, group = this.s.moving.group;
		if ( group && village.materials?.hard ) {
			const mesh = new Mesh( B.batches.hard.build(), village.materials.hard );
			mesh.name = 'tower-travel-guards'; mesh.castShadow = mesh.receiveShadow = true;
			mesh.onBeforeRender = () => village.textures.bake(); group.add( mesh );
		}
		this.s.interact.add( { id: 'towerUp', at: radial( 1.35, T.start + 0.18, T.floor + 1.0 ), reach: 2, size: 0.55,
			text: 'Climb to the lantern', when: () => this.canUse( true ), use: () => this.go( true ) } );
		this.s.interact.add( { id: 'towerDown', at: head.clone().setY( T.deck + 1.1 ), reach: 2, size: 0.25,
			text: 'Descend to the keeper’s room', when: () => this.canUse( false ), use: () => this.go( false ) } );
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
		let eye = a.camera.position.clone(), yaw = p.yaw, pitch = p.pitch;
		const reduced = a.settings.cameraBob === false || a.settings.cameraBob === undefined && globalThis.matchMedia?.( '(prefers-reduced-motion: reduce)' )?.matches;
		const animate = ( progress, arrived ) => {
			const phase = arrived ? ( progress - .5 ) * 2 : progress * 2;
			const step = reduced ? 0 : Math.sin( Math.PI * phase );
			a.camera.position.copy( eye );
			a.camera.position.y += ( up ? 1 : -1 ) * step * .08;
			a.camera.rotation.set( pitch + ( up ? .07 : -.07 ) * step, yaw + ( up ? -.12 : .12 ) * step, 0, 'YXZ' );
		};
		try {
			await s.ui.travel( up ? 'Up the tower stair' : 'Down the tower stair', () => {
				p.position.copy( up ? this.top : this.bottom );
				p.velocity.set( 0, 0, 0 );
				p.grounded = true;
				p.bob = p.stepDist = 0;
				p.pitch = -0.12;
				const look = up ? radial( 1.8, headAngle + 0.8, T.deck ) : radial( 3.5, T.doorAngle, T.floor );
				p.yaw = Math.atan2( p.position.x - look.x, p.position.z - look.z );
				p._camY = null;
				p.update( 0 );
				a.cameraCut?.();
				eye = a.camera.position.clone(); yaw = p.yaw; pitch = p.pitch;
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
