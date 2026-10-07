import { Group, Mesh, Vector3, Quaternion, SphereGeometry, CylinderGeometry } from '../engine/index.js';
import { standard } from '../materials/Materials.js';
import { G } from '../core/Globals.js';
import { loadMinigun } from './MinigunModel.js';
import { traceWeapon } from './WeaponTrace.js';

const UP = new Vector3( 0, 1, 0 );
const sphere = new SphereGeometry( 1, 8, 6 );
const tube = new CylinderGeometry( 1, 1, 1, 6 );
const buoyGeometry = new SphereGeometry( 0.34, 18, 12 );
const bright = ( color ) => standard( { color: 0x000000, emissive: color, emissiveIntensity: 6, roughness: 1, defines: { NO_LOCAL_LIGHTS: 1 } } );

function pool( root, count, geometry, material ) {
	return Array.from( { length: count }, () => {
		const mesh = new Mesh( geometry, material ); mesh.visible = false; mesh.frustumCulled = false; root.add( mesh );
		return { mesh, life: 0, velocity: new Vector3() };
	} );
}

export class DevArmory {
	static async create( app ) {
		const model = await loadMinigun();
		return new DevArmory( app, model );
	}

	constructor( app, model ) {
		this.app = app; this.model = model; this.equipped = true;
		this.root = new Group(); this.root.name = 'temporary dev armory'; app.scene.add( this.root );
		this.held = new Group(); this.held.add( model.group ); this.root.add( this.held );
		this.time = 0; this.spin = 0; this.shots = 0; this.hits = 0; this.accumulator = 0; this.kick = 0;
		this.tracers = pool( this.root, 20, tube, bright( 0xffb349 ) );
		this.sparks = pool( this.root, 48, sphere, bright( 0xffc76a ) );
		this.cases = pool( this.root, 32, tube, standard( { color: 0x9a7129, roughness: 0.35, metalness: 0.8 } ) );
		this.flash = new Mesh( sphere, bright( 0xffbd4e ) ); this.flash.visible = false; this.flash.frustumCulled = false; this.held.add( this.flash );
		this.flash.position.set( 0, 0, - 0.755 );
		this.targets = []; this._tracer = 0; this._spark = 0; this._case = 0;
		this.direction = new Vector3(); this.muzzle = new Vector3(); this.offset = new Vector3(); this.rotation = new Quaternion();
		this.targetMaterial = standard( {
			name: 'dev practice buoys', color: 0xe86c1b, roughness: 0.6,
			surface: 's.albedo = mix( s.albedo, vec3f( 0.88, 0.82, 0.65 ), step( 0.72, fract( in.uv.y * 5.0 ) ) );',
		} );
		this.makeHUD();
		this._resetPending = app.qs.has( 'devTargets' );
		this.pose( 0, false );
	}

	makeHUD() {
		const el = this.hud = document.createElement( 'aside' );
		el.id = 'dev-armory';
		el.style.cssText = 'position:fixed;left:24px;bottom:24px;z-index:90;padding:15px 19px;border:1px solid #ffa84d77;border-radius:5px;background:#151c22e8;color:#f4e4cb;font:12px/1.7 monospace;pointer-events:none;max-width:310px;box-shadow:0 8px 24px #0006';
		el.innerHTML = '<div style="color:#ffae57;font-size:10px;letter-spacing:2px">UNAUTHORISED KEEPER EQUIPMENT</div><strong style="font-size:18px">The Keeper’s Minigun</strong><div data-status></div><div style="height:3px;background:#494037;margin:9px 0"><div data-spin style="height:3px;background:#ffac51;width:0"></div></div><div>Hold left click / X · fire<br>G · summon / reset practice buoys<br>F8 · holster / equip</div><div style="color:#acb4bb;margin-top:8px">Infinite ammunition. Zero historical accuracy.</div>';
		this.status = el.querySelector( '[data-status]' ); this.spinBar = el.querySelector( '[data-spin]' );
		document.body.appendChild( el );
		this.crosshair = document.createElement( 'div' );
		this.crosshair.style.cssText = 'position:fixed;left:50%;top:50%;width:14px;height:14px;transform:translate(-50%,-50%);border:1px solid #ffe5b688;border-radius:50%;pointer-events:none;z-index:89';
		document.body.appendChild( this.crosshair );
	}

	toggle() {
		this.equipped = ! this.equipped;
		this.root.visible = this.equipped;
		if ( ! this.equipped ) { this.spin = 0; this.accumulator = 0; this.flash.visible = false; this.sound( false, 0 ); }
		this.held.visible = this.equipped;
		this.hud.hidden = ! this.equipped; this.crosshair.hidden = ! this.equipped;
	}

	canUse() {
		const a = this.app, s = a.story, ui = a.ui?.ui;
		return this.equipped && a.input.enabled && ! a.devMenu?.open && ! a.isMobile && ! a.xr?.active && ! ui?._start && ! ui?.photoMode
			&& ! ( s && ( s.paused || s.ui.open || s.signal || s.tel > 0.05 || s.aboard ) );
	}

	pose( dt, firing ) {
		const camera = this.app.camera;
		const sway = Math.sin( this.time * 5 ) * Math.min( this.app.player.velocity.length(), 3 ) * 0.003;
		this.offset.set( 0.24 + sway, - 0.28 + sway + this.kick * 0.015, - 0.47 + this.kick * 0.045 ).applyQuaternion( camera.quaternion );
		this.held.position.copy( camera.position ).add( this.offset );
		this.rotation.setFromAxisAngle( new Vector3( 1, 0, 0 ), this.kick * 0.025 );
		this.held.quaternion.copy( camera.quaternion ).multiply( this.rotation );
		this.model.barrels.rotation.z -= this.spin * dt * 90;
		this.held.updateMatrixWorld( true );
		this.muzzle.set( 0, 0, - 0.76 ).applyMatrix4( this.held.matrixWorld );
		this.flash.visible = firing;
		this.flash.scale.set( 0.055 + Math.random() * 0.035, 0.05, 0.15 + Math.random() * 0.12 );
		this.flash.rotation.z = this.time * 77;
	}

	update( dt ) {
		dt = Math.min( Math.max( dt, 0 ), 0.05 ); this.time += dt;
		const usable = this.canUse(), input = this.app.input;
		if ( this._resetPending ) { this._resetPending = false; this.resetTargets(); }
		const visible = usable && ( ! this.app.freeCam || this.app.handInView );
		if ( usable && input.hit( 'KeyG' ) ) this.resetTargets();
		const trigger = visible && ! window.__ui?.isPointerOverUI && ( ( input.locked && input.mouseDown ) || input.down( 'KeyX' ) );
		this.spin = Math.max( 0, Math.min( 1, this.spin + dt * ( trigger ? 2.5 : - 1.6 ) ) );
		const firing = trigger && this.spin >= 0.8;
		this.kick *= Math.exp( - dt * 18 );
		this.pose( dt, firing ); this.held.visible = visible;
		if ( firing ) {
			this.accumulator += dt * 40;
			while ( this.accumulator >= 1 ) { this.accumulator --; this.fire(); }
		} else this.accumulator = 0;
		this.sound( firing, this.spin );
		for ( const e of this.tracers ) { e.life -= dt; e.mesh.visible = e.life > 0; }
		for ( const e of [ ...this.sparks, ...this.cases ] ) {
			if ( e.life <= 0 ) continue;
			e.life -= dt; e.mesh.visible = e.life > 0;
			e.velocity.y -= 9.8 * dt; e.mesh.position.addScaledVector( e.velocity, dt );
			e.mesh.rotation.x += dt * 12; e.mesh.rotation.z += dt * 7;
		}
		for ( const t of this.targets ) {
			// Small substeps keep buoy bounces stable on slower development builds.
			for ( let h = dt; h > 0; ) {
				const step = Math.min( h, 1 / 120 ); h -= step;
				const field = this.app.extremeSea;
				if ( field?.active && this.app.terrainData.heightAt( t.mesh.position.x, t.mesh.position.z ) < G.seaLevel.value ) {
					const p = t.mesh.position, flow = field.sample( p.x, p.z ), surface = G.seaLevel.value + flow.height;
					if ( p.y < surface + t.radius ) {
						const wet = Math.max( 0, Math.min( 1, ( surface + t.radius - p.y ) / ( t.radius * 2 ) ) );
						t.velocity.y += ( wet * 22 - t.velocity.y * wet * 3 ) * step;
						t.velocity.x += ( flow.u - t.velocity.x ) * wet * step * 2;
						t.velocity.z += ( flow.v - t.velocity.z ) * wet * step * 2;
					}
				}
				t.velocity.y -= 9.8 * step; t.mesh.position.addScaledVector( t.velocity, step );
				const p = t.mesh.position, floor = Math.max( this.app.terrainData.heightAt( p.x, p.z ), this.app.colliders.groundHeightAt( p.x, p.z, p.y + t.radius ) );
				if ( p.y < floor + t.radius ) {
					p.y = floor + t.radius; t.velocity.y = Math.abs( t.velocity.y ) > 0.6 ? Math.abs( t.velocity.y ) * 0.56 : 0;
					t.velocity.x *= Math.exp( - step * 3 ); t.velocity.z *= Math.exp( - step * 3 );
				}
				const feet = p.clone(); feet.y -= t.radius;
				if ( this.app.colliders.resolveCapsule( feet, t.radius, t.radius * 2, 0 ) ) {
					p.x = feet.x; p.z = feet.z; t.velocity.x *= - 0.3; t.velocity.z *= - 0.3;
				}
			}
			t.mesh.rotation.x += t.velocity.z * dt; t.mesh.rotation.z -= t.velocity.x * dt;
			if ( t.mesh.position.y < - 20 || t.mesh.position.distanceTo( this.app.camera.position ) > 220 ) t.mesh.visible = false;
		}
		this.hud.hidden = ! visible; this.crosshair.hidden = ! visible;
		this.spinBar.style.width = ( this.spin * 100 ).toFixed( 0 ) + '%';
		this.status.textContent = `${ firing ? 'BRRRRRRR' : this.spin > 0.05 ? 'Motor turning' : 'NLB approval: revoked' } · ${ this.shots } rounds · ${ this.hits } buoy hits`;
	}

	fire() {
		this.shots ++; this.kick = 0.8 + Math.random() * 0.4;
		this.direction.set( ( Math.random() - 0.5 ) * 0.009, ( Math.random() - 0.5 ) * 0.009, - 1 ).normalize().applyQuaternion( this.app.camera.quaternion );
		const hit = traceWeapon( this.app.camera.position, this.direction, {
			colliders: this.app.colliders, terrain: this.app.terrainData, targets: this.targets.filter( t => t.mesh.visible ), seaLevel: G.seaLevel.value,
		} );
		// Start the beam before nearby walls rather than letting the view model shoot through them.
		const start = hit.distance < 1.2 ? this.app.camera.position : this.muzzle;
		const t = this.tracers[ this._tracer ++ % this.tracers.length ];
		const delta = hit.point.clone().sub( start ), length = delta.length();
		t.mesh.position.copy( start ).addScaledVector( delta, 0.5 );
		t.mesh.quaternion.setFromUnitVectors( UP, delta.normalize() ); t.mesh.scale.set( 0.009, length, 0.009 ); t.life = 0.065; t.mesh.visible = true;
		if ( hit.kind !== 'air' ) {
			for ( let i = 0; i < 4; i ++ ) {
				const e = this.sparks[ this._spark ++ % this.sparks.length ];
				e.mesh.position.copy( hit.point ); e.mesh.scale.setScalar( hit.kind === 'water' ? 0.045 : 0.018 );
				e.velocity.set( ( Math.random() - 0.5 ) * 4, 1 + Math.random() * 3, ( Math.random() - 0.5 ) * 4 ); e.life = 0.18 + Math.random() * 0.2;
			}
		}
		if ( hit.target ) {
			this.hits ++; hit.target.velocity.addScaledVector( this.direction, 2.5 ); hit.target.velocity.y += 1.8;
			hit.target.velocity.clampLength( 0, 18 );
		}
		const e = this.cases[ this._case ++ % this.cases.length ];
		e.mesh.position.set( 0.13, 0, 0.02 ).applyQuaternion( this.held.quaternion ).add( this.held.position );
		e.mesh.scale.set( 0.007, 0.04, 0.007 ); e.velocity.set( 1.5, 1.1, 0.2 ).applyQuaternion( this.held.quaternion ); e.life = 0.65;
	}

	resetTargets() {
		this.hits = 0;
		const a = this.app, forward = new Vector3( 0, 0, - 1 ).applyQuaternion( a.camera.quaternion ); forward.y = 0; forward.normalize();
		const right = new Vector3( - forward.z, 0, forward.x );
		// Keep the rack on this side of the nearest wall/cliff; G can be used anywhere on the island.
		const clearance = traceWeapon( a.camera.position, forward, { colliders: a.colliders, terrain: a.terrainData, seaLevel: G.seaLevel.value }, 12 ).distance;
		const reach = Math.max( 1.5, Math.min( 9, clearance - 1 ) );
		for ( let i = 0; i < 7; i ++ ) {
			if ( ! this.targets[ i ] ) {
				const mesh = new Mesh( buoyGeometry, this.targetMaterial ); mesh.castShadow = true; this.root.add( mesh );
				this.targets.push( { mesh, radius: 0.34, velocity: new Vector3() } );
			}
			const { mesh, velocity } = this.targets[ i ]; mesh.visible = true; mesh.rotation.set( 0, 0, 0 ); velocity.set( 0, 0, 0 );
			mesh.position.copy( a.camera.position ).addScaledVector( forward, reach ).addScaledVector( right, ( i - 3 ) * 1.05 );
			const p = mesh.position;
			p.y = Math.max( a.terrainData.heightAt( p.x, p.z ), a.colliders.groundHeightAt( p.x, p.z, a.camera.position.y ) ) + 0.34;
		}
	}

	sound( firing, spin ) {
		const s = this.app.audio;
		if ( ! s?.ctx || ! s.near || s.ctx.state !== 'running' ) return;
		const c = s.ctx, now = c.currentTime;
		if ( ! this._audio ) {
			const motor = c.createOscillator(), motorGain = c.createGain(), noiseGain = c.createGain(), filter = c.createBiquadFilter();
			motor.type = 'sawtooth'; motorGain.gain.value = 0; noiseGain.gain.value = 0;
			motor.connect( motorGain ).connect( s.near ); motor.start();
			const buf = c.createBuffer( 1, c.sampleRate, c.sampleRate ), data = buf.getChannelData( 0 );
			for ( let i = 0; i < data.length; i ++ ) data[ i ] = Math.random() * 2 - 1;
			const noise = c.createBufferSource(); noise.buffer = buf; noise.loop = true;
			filter.type = 'bandpass'; filter.frequency.value = 1000; filter.Q.value = 0.6;
			noise.connect( filter ).connect( noiseGain ).connect( s.near ); noise.start();
			const pulse = c.createOscillator(), pulseGain = c.createGain(); pulse.frequency.value = 40; pulseGain.gain.value = 0;
			pulse.connect( pulseGain ).connect( noiseGain.gain ); pulse.start();
			this._audio = { motor, motorGain, noiseGain, pulseGain };
		}
		const audio = this._audio;
		audio.motor.frequency.setTargetAtTime( 40 + spin * 150, now, 0.04 );
		audio.motorGain.gain.setTargetAtTime( spin * 0.018, now, 0.04 );
		audio.noiseGain.gain.setTargetAtTime( firing ? 0.14 : 0, now, 0.025 );
		audio.pulseGain.gain.setTargetAtTime( firing ? 0.07 : 0, now, 0.025 );
	}
}
