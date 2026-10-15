import { Group, Mesh, Vector2, Vector3, MathUtils } from '../engine/index.js';
import { Builder, Part } from '../world/village/GeoBuilder.js';
import { HAND_LAMP_MODEL } from './HandLampModel.js';
import { createHandLampMaterials } from './HandLampMaterials.js';

// The keeper's storm lantern: a tubular paraffin lantern of the 1890s, a tin
// fount, a glass globe in a wire guard, a cap and a bail. It stands on the keepers' room table until taken
// (the story's item); carried, it hangs from your hand at your side, swings as you walk, and lights all
// round it (the app's hand lamp, LocalLights' flashlight, made a point light: see App.js).
//
//   carried: in your hand (else standing at `rest`)
//   lit: the wick is lit; glow warms up over a couple of seconds, flickers, and dies away when put out
//   lightPosition: where the flame is (the light's source)
//
// Metal reflects the room lights, with a bounded response for its own flame.
// Surface wear stays in object space while the lantern is carried.
const HEIGHT = 0.32; // fount foot to the bail's top
const FLAME = 0.13; // the flame above the foot
// carried: the bail's top below and in front of the eye, to the right (body frame: yaw only)
const HAND = { right: 0.27, forward: 0.36, down: 0.54 };

const _f = new Vector3(), _r = new Vector3(), _v = new Vector3();

function buildLantern() {

	const g = new Group();
	g.name = 'hand_lamp';
	// Blender-authored folded metal, open vents, burner and glass. Each finish is
	// merged into one mesh, including the small screws, seams and controls.
	const materials=createHandLampMaterials(),meshes={};
	const {tin,steel,brass,black,glass,flame}=materials;
	for(const [finish,data] of Object.entries(HAND_LAMP_MODEL)) {
		const B=new Builder();B.part(finish,new Part(data.p,data.n,data.uv,data.idx),0,0,0);
		const mesh=new Mesh(B.batches[finish].build(),materials[finish]);
		mesh.name='storm-lantern-'+finish;mesh.castShadow=false;mesh.receiveShadow=true;
		g.add(mesh);meshes[finish]=mesh;
	}
	meshes.flame.visible=false;
	return {group:g,glass,flame,globe:meshes.glass,flameMesh:meshes.flame,metals:[tin,steel,brass,black]};

}

export class HandLamp {

	constructor() {

		const L = buildLantern();
		this.group = L.group;
		this._glass = L.glass;
		this._flame = L.flame;
		this._flameMesh = L.flameMesh;
		this._metals = L.metals;
		this.carried = false;
		this.lit = false;
		this.glow = 0;
		this.rest = null; // { position: Vector3 (the foot), ry }
		this.lightPosition = new Vector3();
		this._hand = new Vector3();
		this._lastHand = null;
		this._handVel = new Vector3();
		this._swing = new Vector2(); // the pendulum's lean (rad) toward right / forward of the body
		this._swingV = new Vector2();
		this._yaw = 0;
		this._t = Math.random() * 10;

	}

	setRest( position, ry = 0 ) {

		this.rest = { position: position.clone(), ry };

	}

	// show: carried and in view (not in the free camera, not at the signal lamp)
	update( dt, camera, { show = true, motion = 1 } = {} ) {

		this._t += dt;
		// the wick: warms up when lit, and dies quickly when turned down
		const target = this.lit ? 1 : 0;
		this.glow += Math.sign( target - this.glow ) * Math.min( Math.abs( target - this.glow ), dt * ( this.lit ? 0.6 : 2.5 ) );
		const t = this._t;
		const flicker = 0.93 + 0.05 * Math.sin( t * 9.1 ) * Math.sin( t * 5.7 + 1.3 ) + 0.02 * Math.sin( t * 23.0 );
		this.flicker = flicker;
		const k = this.glow * flicker;
		this._glass.emissive.setRGB( .006 * k, .0035 * k, .0015 * k );
		this._flameMesh.visible = k > .001;
		this._flame.opacity = Math.min(1,k*2);
		this._flame.emissive.setRGB( 1.0 * 40 * k, 0.75 * 40 * k, 0.42 * 40 * k );
		for ( const m of this._metals ) m.uniforms.flameLit.value = k;

		const g = this.group;
		if ( ! this.carried ) {

			g.visible = !! this.rest;
			if ( this.rest ) {

				g.position.copy( this.rest.position );
				g.rotation.set( 0, this.rest.ry, 0 );

			}

			this.lightPosition.set( g.position.x, g.position.y + FLAME, g.position.z );
			for ( const m of this._metals ) m.uniforms.flamePos.value.copy( this.lightPosition );
			this._lastHand = null;
			return;

		}

		// the hand, in the body's frame (yaw only)
		camera.updateMatrixWorld();
		const e = camera.matrixWorld.elements;
		_f.set( - e[ 8 ], 0, - e[ 10 ] );
		if ( _f.lengthSq() > 1e-6 ) this._yaw = Math.atan2( - _f.x, - _f.z );
		_f.set( - Math.sin( this._yaw ), 0, - Math.cos( this._yaw ) );
		_r.set( Math.cos( this._yaw ), 0, - Math.sin( this._yaw ) );
		const hand = this._hand.setFromMatrixPosition( camera.matrixWorld ).addScaledVector( _r, HAND.right ).addScaledVector( _f, HAND.forward );
		hand.y -= HAND.down;

		// the swing: a pendulum from the hand, pushed by the hand's acceleration
		if ( this._lastHand && dt > 0 ) {

			_v.subVectors( hand, this._lastHand ).divideScalar( dt );
			const ax = ( _v.x - this._handVel.x ) / dt, az = ( _v.z - this._handVel.z ) / dt;
			this._handVel.copy( _v );
			const ar = MathUtils.clamp( ax * _r.x + az * _r.z, - 40, 40 ), af = MathUtils.clamp( ax * _f.x + az * _f.z, - 40, 40 );
			const len = HEIGHT - 0.04, w2 = 9.81 / len, damp = 3.2;
			const h = Math.min( dt, 1 / 30 );
			this._swingV.x += ( - w2 * Math.sin( this._swing.x ) - damp * this._swingV.x - ar / len * 0.35 ) * h;
			this._swingV.y += ( - w2 * Math.sin( this._swing.y ) - damp * this._swingV.y - af / len * 0.35 ) * h;
			this._swing.addScaledVector( this._swingV, h );
			this._swing.x = MathUtils.clamp( this._swing.x, - 0.6, 0.6 );
			this._swing.y = MathUtils.clamp( this._swing.y, - 0.6, 0.6 );

		} else this._handVel.set( 0, 0, 0 );

		this._lastHand = ( this._lastHand || new Vector3() ).copy( hand );

		// hang it from the bail's top: the foot lies HEIGHT down the swung axis, and the lantern's up axis
		// leans the other way (yaw, then a lean about the body's right and forward axes)
		const sx = this._swing.x * motion, sf = this._swing.y * motion;
		const down = _v.set( 0, - 1, 0 ).addScaledVector( _r, Math.sin( sx ) ).addScaledVector( _f, Math.sin( sf ) ).normalize();
		g.visible = show;
		g.position.copy( hand ).addScaledVector( down, HEIGHT );
		g.rotation.set( sf, this._yaw, sx, 'YXZ' );
		this.lightPosition.copy( hand ).addScaledVector( down, HEIGHT - FLAME );
		for ( const m of this._metals ) m.uniforms.flamePos.value.copy( this.lightPosition );

	}

	save() {

		return { carried: this.carried, lit: this.lit };

	}

	load( s ) {

		if ( ! s ) return;
		this.carried = !! s.carried;
		this.lit = !! s.lit;
		this.glow = this.lit ? 1 : 0;

	}

}
