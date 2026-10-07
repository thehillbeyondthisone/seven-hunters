import { Group, Mesh, Vector3, Quaternion, SphereGeometry, TorusGeometry, RoundedBoxGeometry, CylinderGeometry } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';
import { standard } from '../materials/Materials.js';
import { LAYERS } from '../core/SceneRenderer.js';
import { G } from '../core/Globals.js';
import { createGravityGrabberModel } from './GravityGrabberModel.js';
import { traceWeapon } from './WeaponTrace.js';
import { stepPlaygroundProp, separatePlaygroundProps } from './PlaygroundPhysics.js';
import { LighthouseDisco } from './LighthouseDisco.js';
import { Interact } from '../story/Interact.js';
import { updateDoor } from '../world/flannan/Station.js';

const UP = new Vector3( 0, 1, 0 );
export class KeeperPlayground {
	constructor( app ) {
		this.app = app; this.equipped = true; this.time = 0; this.grip = 0; this.charge = 0; this.reach = 3.2; this.thrown = 0;
		this.root = new Group(); this.root.name = 'Keeper’s Playground · temporary props'; app.scene.add( this.root );
		this.model = createGravityGrabberModel(); this.heldModel = new Group(); this.heldModel.add( this.model.group ); this.root.add( this.heldModel );
		this.model.group.scale.setScalar( .85 );
		this.direction = new Vector3(); this.destination = new Vector3(); this.muzzle = new Vector3(); this.offset = new Vector3(); this.aim = null; this.held = null;
		this.bodies = []; this.makeProps(); this.disco = new LighthouseDisco( app );
		this.coreLight = app.localLights.add( { position: new Vector3(), color: this.model.glow.emissive.clone(), intensity: .7, range: 3, kind: 'gravity core', always: true, enabled: false } );
		this.beamMat = new Material( { name: 'braided induction tether', lit: false, transparent: true, blending: 'additive', depthWrite: false, side: 'double', underwaterLighting: 'none',
			uniforms: { strength: [ 'f32', .4 ] }, output: 'r.color = vec4f( vec3f( .05, 1.2, .9 ) * mat.strength, mat.strength );' } );
		this.tethers = Array.from( { length: 3 }, () => { const mesh = new Mesh( new CylinderGeometry( 1, 1, 1, 6 ), this.beamMat ); mesh.layers.set( LAYERS.TRANSPARENT ); mesh.frustumCulled = false; mesh.visible = false; this.root.add( mesh ); return mesh; } );
		this.halo = new Mesh( new TorusGeometry( 1, .015, 6, 64 ), this.beamMat ); this.halo.layers.set( LAYERS.TRANSPARENT ); this.halo.visible = false; this.root.add( this.halo );
		this.doors = app.village?.station?.moving.doors || [];
		if ( this.doors.length ) {
			this.interact = new Interact( { camera: app.camera, input: app.input, player: app.player } );
			for ( const d of this.doors ) this.interact.add( { id: d.name, at: d.center, reach: 2.4, size: Math.max( .45, d.width / 2 ),
				text: () => `${ d.target > .5 ? 'Shut' : 'Open' } the ${ d.name === 'gate' ? 'gate' : 'door' }`,
				use: () => { const target = d.target > .5 ? 0 : 1; for ( const leaf of this.doors.filter( leaf => leaf.name === d.name ) ) leaf.target = target; app.stationSound?.door( d.name, !! target, d.center ); },
			} );
		}
		this.makeHUD(); this.placeYard(); this.resetProps();
		if ( app.qs.has( 'disco' ) ) this.disco.setEnabled( true );
	}
	makeProps() {
		const striped = standard( { name: 'playground cork buoy', color: 0xd85f2b, roughness: .55, surface: 's.albedo = mix( s.albedo, vec3f( .88, .82, .66 ), step( .72, fract( in.uv.y * 5.0 ) ) );' } );
		const wood = standard( { name: 'playground wooden crate', color: 0x9d7447, roughness: .83, surface: 's.albedo *= .75 + .25 * abs( sin( in.uv.x * 100.0 + sin( in.uv.y * 11.0 ) ) );' } );
		const iron = standard( { color: 0x293337, metalness: .72, roughness: .55 } );
		const brass = standard( { color: 0xb99746, metalness: .65, roughness: .35 } );
		for ( let i = 0; i < 9; i ++ ) {
			const mesh = new Group(), crate = i % 3 === 2, radius = crate ? .44 : .34;
			mesh.name = crate ? 'Supply crate ' + ( i + 1 ) : 'Practice buoy ' + ( i + 1 );
			if ( crate ) {
				mesh.add( new Mesh( new RoundedBoxGeometry( .58, .82, .58, 1, .015 ), wood ) );
				for ( const x of [ - .18, .18 ] ) { const band = new Mesh( new RoundedBoxGeometry( .045, .83, .59, 1, .01 ), iron ); band.position.x = x; mesh.add( band ); }
			} else {
				mesh.add( new Mesh( new SphereGeometry( radius, 24, 16 ), striped ) );
				const loop = new Mesh( new TorusGeometry( .065, .012, 6, 16 ), brass ); loop.position.y = .36; mesh.add( loop );
			}
			mesh.traverse( m => { if ( m.isMesh ) m.castShadow = true; } ); this.root.add( mesh );
			this.bodies.push( { mesh, radius, velocity: new Vector3(), name: mesh.name } );
		}
	}
	makeHUD() {
		this.hud = document.createElement( 'aside' ); this.hud.className = 'keeper-playground-hud';
		this.hud.innerHTML = '<small>ADMIRALTY EXPERIMENTAL EQUIPMENT · No. 03</small><strong>The Gravity Grabber</strong><div data-grab-status></div><div class="keeper-charge"><i data-charge></i></div><p>Click / X · grab or place<br>Hold right click / C, release · throw<br>Wheel · distance &nbsp; R · rotate &nbsp; Q · drop<br>G · reset props &nbsp; F9 · holster &nbsp; J · disco</p><em>Zero historical accuracy. Excellent paperwork.</em>';
		this.status = this.hud.querySelector( '[data-grab-status]' ); this.chargeBar = this.hud.querySelector( '[data-charge]' ); document.body.append( this.hud );
		this.crosshair = document.createElement( 'div' ); this.crosshair.className = 'keeper-grab-crosshair'; document.body.append( this.crosshair );
	}
	placeYard() {
		const a = this.app, p = a.player; a.setFreeCam?.( false );
		if ( ! p.position ) return;
		p.mode = 'walk'; p.busy = false; p.velocity.set( 0, 0, 0 ); p.position.set( - 11, Math.max( 80.65, a.terrainData.heightAt( - 11, 14 ) ), 14 );
		p.yaw = -.48; p.pitch = -.12; p.update?.( 0 ); a.cameraCut?.();
	}
	watchDisco() {
		const a = this.app, p = a.player; this.drop(); a.setFreeCam?.( false );
		if ( ! p.position ) return;
		p.mode = 'walk'; p.busy = false; p.velocity.set( 0, 0, 0 ); p.position.set( - 14, a.terrainData.heightAt( - 14, 32 ) + .05, 32 );
		p.yaw = Math.atan2( - 14, 32 ); p.pitch = Math.atan2( 95 - p.position.y - 1.62, Math.hypot( 14, 32 ) ); p.update?.( 0 ); a.cameraCut?.();
	}
	resetProps() {
		this.drop(); const a = this.app, forward = this.direction.set( 0, 0, - 1 ).applyQuaternion( a.camera.quaternion ); forward.y = 0; forward.normalize();
		const right = new Vector3( - forward.z, 0, forward.x );
		const clear = traceWeapon( a.camera.position, forward, { colliders: a.colliders, terrain: a.terrainData, seaLevel: G.seaLevel.value }, 10 ).distance;
		const reach = Math.max( 1.5, Math.min( 5.5, clear - .8 ) );
		for ( let i = 0; i < this.bodies.length; i ++ ) {
			const b = this.bodies[ i ], p = b.mesh.position; b.mesh.visible = true; b.mesh.rotation.set( 0, 0, 0 ); b.velocity.set( 0, 0, 0 );
			p.copy( a.camera.position ).addScaledVector( forward, reach + Math.floor( i / 3 ) * 1.2 ).addScaledVector( right, ( i % 3 - 1 ) * 1.25 );
			p.y = Math.max( a.terrainData.heightAt( p.x, p.z ), a.colliders.groundHeightAt( p.x, p.z, a.camera.position.y ) ) + b.radius;
			stepPlaygroundProp( b, 1 / 180, a );
		}
		this.thrown = 0;
	}
	canUse() {
		const a = this.app, ui = a.ui?.ui;
		return this.equipped && a.input.enabled && ! a.devMenu?.open && ! a.isMobile && ! a.xr?.active && ! ui?._start && ! ui?.photoMode && ! a.story && ( ! a.freeCam || a.handInView );
	}
	toggle() { this.equipped = ! this.equipped; if ( ! this.equipped ) this.drop(); }
	drop( launch = false ) {
		if ( this.held ) {
			if ( launch ) { this.held.velocity.copy( this.direction ).multiplyScalar( 8 + this.charge * 27 ); this.thrown ++; }
			else this.held.velocity.multiplyScalar( .15 );
		}
		this.held = null; this.charge = 0;
	}
	grab() { if ( this.aim ) { this.held = this.aim; this.held.velocity.set( 0, 0, 0 ); this.reach = Math.max( 1.5, Math.min( 5, this.held.mesh.position.distanceTo( this.app.camera.position ) ) ); } }
	update( dt ) {
		dt = Number.isFinite( dt ) ? Math.max( 0, Math.min( .05, dt ) ) : 0; this.time += dt;
		const a = this.app, input = a.input, usable = this.canUse(), visible = usable && ( ! a.freeCam || a.handInView );
		this.direction.set( 0, 0, - 1 ).applyQuaternion( a.camera.quaternion );
		if ( ! usable ) this.drop();
		this.aim = usable ? traceWeapon( a.camera.position, this.direction, { colliders: a.colliders, terrain: a.terrainData, targets: this.bodies.filter( b => b.mesh.visible ), seaLevel: G.seaLevel.value }, 12 ).target : null;
		const click = usable && ! window.__ui?.isPointerOverUI && ( ( input.locked && input.mouseDown ) || input.down( 'KeyX' ) || input.hit( 'KeyX' ) );
		const trigger = usable && ( ( input.locked && input.rightDown ) || input.down( 'KeyC' ) );
		if ( click && ! this.wasClick ) this.held ? this.drop() : this.grab();
		if ( usable && input.hit( 'KeyQ' ) ) this.drop();
		if ( usable && input.hit( 'KeyG' ) ) this.resetProps();
		if ( a.input.enabled && ! a.devMenu?.open && ! a.ui?.ui._start && input.hit( 'KeyJ' ) ) this.disco.setEnabled( ! this.disco.enabled );
		if ( this.held ) {
			this.reach = Math.max( 1.4, Math.min( 7, this.reach + ( input.consumeWheel?.() || 0 ) * .35 ) );
			if ( trigger ) this.charge = Math.min( 1, this.charge + dt / .85 );
			if ( ! trigger && this.wasTrigger ) this.drop( true );
			if ( this.held ) {
				const clearance = traceWeapon( a.camera.position, this.direction, { colliders: a.colliders, terrain: a.terrainData, seaLevel: - Infinity }, this.reach ).distance;
				this.destination.copy( a.camera.position ).addScaledVector( this.direction, Math.max( .65, Math.min( this.reach, clearance - this.held.radius - .07 ) ) );
				if ( input.down( 'KeyR' ) ) this.held.mesh.rotation.y += dt * 2;
			}
		} else if ( usable ) input.consumeWheel?.();
		this.wasClick = click; this.wasTrigger = trigger;
		for ( const body of this.bodies ) stepPlaygroundProp( body, dt, a, body === this.held ? this.destination : null );
		separatePlaygroundProps( this.bodies, this.held );
		for ( const body of this.bodies ) if ( body.mesh.position.y < - 140 || body.mesh.position.distanceTo( a.camera.position ) > 450 ) body.mesh.visible = false;
		this.grip += ( ( this.held ? 1 : 0 ) - this.grip ) * ( 1 - Math.exp( - dt * 9 ) );
		const sway = Math.sin( this.time * 5 ) * Math.min( a.player.velocity.length(), 3 ) * .002;
		this.offset.set( .19 + sway, - .25 + sway, - .45 + this.charge * .012 ).applyQuaternion( a.camera.quaternion );
		this.heldModel.position.copy( a.camera.position ).add( this.offset ); this.heldModel.quaternion.copy( a.camera.quaternion );
		this.model.animate( this.time, this.grip, this.charge ); this.heldModel.visible = visible; this.heldModel.updateMatrixWorld( true );
		this.muzzle.set( 0, 0, - .56 * .85 ).applyMatrix4( this.heldModel.matrixWorld );
		this.coreLight.position.copy( this.heldModel.position ); this.coreLight.enabled = visible;
		this.tethers.forEach( ( mesh, i ) => {
			mesh.visible = visible && !! this.held; if ( ! mesh.visible ) return;
			const start = this.muzzle.clone().add( new Vector3( Math.cos( this.time * 3 + i * 2.094 ) * .018, Math.sin( this.time * 3 + i * 2.094 ) * .018, 0 ) );
			const delta = this.held.mesh.position.clone().sub( start ), length = delta.length();
			mesh.position.copy( start ).addScaledVector( delta, .5 ); mesh.quaternion.setFromUnitVectors( UP, delta.normalize() ); mesh.scale.set( .002 + this.charge * .0015, length, .002 );
		} );
		this.beamMat.uniforms.strength.value = .22 + this.charge * .3;
		this.halo.visible = visible && !! this.held;
		if ( this.held ) { this.halo.position.copy( this.held.mesh.position ); this.halo.quaternion.copy( a.camera.quaternion ); this.halo.scale.setScalar( this.held.radius + .08 ); }
		this.hud.hidden = ! visible; this.crosshair.hidden = ! visible;
		this.crosshair.dataset.ready = String( !! this.aim || !! this.held );
		this.chargeBar.style.width = ( this.charge * 100 ).toFixed( 0 ) + '%';
		this.status.textContent = this.held ? `${ this.held.name } · ${ this.reach.toFixed( 1 ) } m · ${ this.charge > .05 ? 'Charging…' : 'Suspended' }` : this.aim ? `Click to grab ${ this.aim.name.toLowerCase() }` : 'Aim at a buoy or supply crate';
		if ( this.interact ) { this.interact.enabled = a.input.enabled && ! a.freeCam && ! a.devMenu?.open && ! a.ui?.ui._start && ! a.ui?.ui.photoMode; this.interact.update( dt ); }
		for ( const d of this.doors ) updateDoor( d, dt );
		this.disco.update( dt ); this.sound( usable );
	}
	sound( usable ) {
		const audio = this.app.audio, ctx = audio?.ctx; if ( ! ctx || ctx.state !== 'running' || ! audio.near ) return;
		if ( ! this.voice ) { const osc = ctx.createOscillator(), gain = ctx.createGain(); osc.type = 'sine'; gain.gain.value = 0; osc.connect( gain ).connect( audio.near ); osc.start(); this.voice = { osc, gain }; }
		this.voice.osc.frequency.setTargetAtTime( 68 + this.grip * 65 + this.charge * 90, ctx.currentTime, .06 );
		this.voice.gain.gain.setTargetAtTime( usable && this.held ? .035 : 0, ctx.currentTime, .04 );
	}
}
