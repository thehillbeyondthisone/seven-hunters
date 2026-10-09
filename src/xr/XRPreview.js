import { Group, Mesh, SphereGeometry, CylinderGeometry, Matrix4, Vector3 } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';
import { GPU } from '../engine/gpu/GPU.js';
import { updateDoor } from '../world/flannan/Station.js';
import { VIEWS } from '../core/DebugViews.js';
import { Locomotion, ControllerInput, controllerState } from './Locomotion.js';
import { projectionScale, supportMessage } from './PreviewOptions.js';
import { XRRenderer } from './XRRenderer.js';
import { SessionStats } from './SessionStats.js';

export const LOCATIONS = [
	[ 'Station approach', 'fApproach' ], [ 'Station yard', 'fYard' ],
	[ "Keepers’ room", 'dRoom' ], [ 'Tower stairs', 'dStair' ],
	[ 'Lantern room', 'dLantern' ], [ 'East landing', 'dLanding' ],
];

export function pickDoor( doors, origin, direction ) {

	let best = null, score = Infinity;
	for ( const d of doors ) {

		const delta = new Vector3().subVectors( d.center, origin );
		const distance = delta.length(), along = delta.dot( direction );
		if ( distance > 2.8 || along < 0 ) continue;
		const off = Math.sqrt( Math.max( 0, distance * distance - along * along ) );
		if ( off > Math.max( 0.6, d.width / 2 ) ) continue;
		if ( distance + off < score ) { score = distance + off; best = d; }

	}
	return best;

}

export class XRPreview {

	constructor( app, ui ) {

		this.app = app;
		this.ui = ui;
		this.active = false;
		this.entering = false;
		this.session = null;
		this.location = 0;
		this.scale = projectionScale( app.qs.get( 'xrScale' ) );
		this.stats = new SessionStats( this.scale );
		this._matrix = new Matrix4();
		this._scale = new Vector3();
		this.controllers = new Map();
		this.controllerInput = new ControllerInput();
		this._buildUI();
		this.selectLocation( 0 );
		this._checkSupport();
		window.__xr = this;

	}

	_buildUI() {

		const root = this.root = document.createElement( 'section' );
		root.className = 'xr-preview';
		root.setAttribute( 'aria-label', 'Seven Hunters VR preview' );
		root.innerHTML = `<p class="xr-kicker">SEVEN HUNTERS · EXPERIMENTAL PREVIEW</p>
<h1>The island, at your scale.</h1>
<p>Explore Eilean Mòr and the light station in VR or on desktop. This preview has simplified graphics and its own unsaved exploration mode.</p>
<label>Start location <select class="xr-location"></select></label>
<label>VR resolution <select class="xr-scale"><option value="0.5">Low · 50%</option><option value="0.65">Balanced · 65%</option><option value="0.85">Higher · 85%</option><option value="1">Full · 100%</option></select></label>
<div class="xr-actions"><button type="button" class="xr-enter" disabled>Checking VR…</button><button type="button" class="xr-desktop">Explore on desktop</button></div>
<p class="xr-status" role="status" aria-live="polite"></p>
<details><summary>Quest controls</summary><p>Left stick: walk · Right stick: turn 30°<br>Right trigger: open or close a nearby door / gate<br>A: next location · B: recenter · Left Y: exit VR</p><p>Head movement is tracked. There is no added head bob, swimming, boat ride, telescope or story interface in this first preview.</p></details>
<details class="xr-diagnostics" hidden><summary>Last VR session</summary><p class="xr-metrics"></p><p>Intervals include browser scheduling. CPU time measures frame submission; GPU time, comfort and tracking quality require headset testing.</p></details>
<a class="xr-normal" href="./">Return to the normal game</a>`;
		this.enterButton = root.querySelector( '.xr-enter' );
		this.status = root.querySelector( '.xr-status' );
		this.locationSelect = root.querySelector( '.xr-location' );
		LOCATIONS.forEach( ( [ label ], i ) => {

			const option = document.createElement( 'option' );
			option.value = i;
			option.textContent = label;
			this.locationSelect.append( option );

		} );
		this.locationSelect.addEventListener( 'change', () => this.selectLocation( Number( this.locationSelect.value ) ) );
		this.scaleSelect = root.querySelector( '.xr-scale' );
		if ( ! Array.from( this.scaleSelect.options ).some( option => Number( option.value ) === this.scale ) ) {
			const option = document.createElement( 'option' );
			option.value = this.scale;
			option.textContent = `Custom · ${ Math.round( this.scale * 100 ) }%`;
			this.scaleSelect.append( option );
		}
		this.scaleSelect.value = this.scale;
		this.scaleSelect.addEventListener( 'change', () => { this.scale = projectionScale( this.scaleSelect.value ); } );
		this.enterButton.addEventListener( 'click', () => this.enter() );
		root.querySelector( '.xr-desktop' ).addEventListener( 'click', () => {

			if ( this.app.audio ) this.app.audio.resume();
			this.app.input.requestLock();
			root.classList.add( 'is-compact' );

		} );
		this.ui.startEl.hidden = true;
		document.body.append( root );

	}

	async _checkSupport() {

		let reason = supportMessage();
		if ( ! reason ) {

			try {

				if ( ! await navigator.xr.isSessionSupported( 'immersive-vr' ) ) reason = 'No immersive VR headset found. You can still explore on desktop.';

			} catch ( e ) { reason = 'Unable to check VR support: ' + e.message; }

		}
		this.enterButton.disabled = !! reason;
		this.enterButton.textContent = reason ? 'VR unavailable' : 'Enter VR';
		this.status.textContent = reason || 'VR is available. Start with Balanced resolution; lower it if motion is uneven.';

	}

	selectLocation( index ) {

		this.location = ( index + LOCATIONS.length ) % LOCATIONS.length;
		this.locationSelect.value = this.location;
		const app = this.app, v = VIEWS[ LOCATIONS[ this.location ][ 1 ] ];
		const p = new Vector3( ...v.p );
		const ground = app.player.groundAt( p.x, p.z, p.y );
		app.player.position.set( p.x, Number.isFinite( ground ) ? ground : p.y - 1.62, p.z );
		app.player.yaw = v.yaw;
		if ( v.at ) app.player.yaw = Math.atan2( p.x - v.at[ 0 ], p.z - v.at[ 2 ] );
		app.player.pitch = 0;
		app.player.velocity.set( 0, 0, 0 );
		app.player.mode = 'walk';
		app.freeCam = false;
		app.settings.timeOfDay = 13.6;
		if ( this.locomotion ) this.locomotion.recenter();
		app.cameraCut();

	}

	async enter() {

		if ( this.active || this.entering ) return;
		this.entering = true;
		this.enterButton.disabled = true;
		this.status.textContent = 'Opening VR…';
		let session;
		try {

			const reason = supportMessage();
			if ( reason ) throw new Error( reason );
			// Request immediately from the click so browser user activation is retained.
			session = await navigator.xr.requestSession( 'immersive-vr', {
				requiredFeatures: [ 'webgpu' ], optionalFeatures: [ 'local-floor', 'bounded-floor' ],
			} );
			this.session = session;
			session.addEventListener( 'end', () => this._ended( session ), { once: true } );
			const binding = new XRGPUBinding( session, GPU.device );
			const format = binding.getPreferredColorFormat();
			const layer = binding.createProjectionLayer( { colorFormat: format, scaleFactor: this.scale } );
			this.binding = binding;
			this.layer = layer;
			session.updateRenderState( { layers: [ layer ], depthNear: 0.06, depthFar: this.app.camera.far } );
			let localFloor = true, space;
			try { space = await session.requestReferenceSpace( 'local-floor' ); }
			catch { localFloor = false; space = await session.requestReferenceSpace( 'local' ); }
			if ( this.session !== session ) return;
			this.space = space;
			// Reuse the output pipeline on re-entry instead of compiling it and
			// allocating another binding set for every visit to VR.
			if ( this.rendererFormat !== format ) {
				this.renderer = new XRRenderer( this.app, format );
				this.rendererFormat = format;
			}
			await GPU.pipelinesReady();
			if ( this.session !== session ) return;
			this.locomotion = new Locomotion( this.app.player, { localFloor } );
			this.controllerInput.reset();
			this._resetSpace = () => {
				this.locomotion.recenter();
				this.controllerInput.reset();
			};
			space.addEventListener( 'reset', this._resetSpace );
			this.saved = { fov: this.app.camera.fov, near: this.app.camera.near, width: this.app.sceneRenderer.width, height: this.app.sceneRenderer.height };
			this.app.engine.stop();
			this.active = true;
			this.app.input.enabled = false;
			this.app.input.reset();
			if ( document.pointerLockElement ) document.exitPointerLock();
			this.app.camera.fov = 110; // conservative central frustum for terrain LOD / shadows
			this.app.camera.near = 0.06;
			this.app.camera.updateProjectionMatrix();
			if ( this.app.audio ) this.app.audio.resume();
			this.root.hidden = true;
			this.lastTime = null;
			this.stats = new SessionStats( this.scale, session.frameRate || 72 );
			this.paused = false;
			const rates = session.supportedFrameRates;
			if ( rates && Array.from( rates ).includes( 72 ) ) session.updateTargetFrameRate( 72 ).catch( () => {} );
			this._raf = session.requestAnimationFrame( ( t, frame ) => this._frame( t, frame ) );

		} catch ( e ) {

			if ( session ) await session.end().catch( () => {} );
			this.status.textContent = 'Could not enter VR: ' + e.message;
			console.error( 'VR preview:', e );
		} finally {

			this.entering = false;
			this.enterButton.disabled = false;
			this.enterButton.textContent = 'Enter VR';

		}

	}

	_frame( time, frame ) {

		if ( ! this.active || frame.session !== this.session ) return;
		const t0 = performance.now();
		try {

			const pose = frame.getViewerPose( this.space );
			const interval = this.lastTime === null ? 1000 / ( frame.session.frameRate || 72 ) : time - this.lastTime;
			this.lastTime = time;
			const dt = Math.min( Math.max( interval / 1000, 0 ), 0.05 );
			if ( pose && frame.session.visibilityState === 'visible' ) {

				const state = this.controllerInput.sample( controllerState( frame.session.inputSources ) );
				if ( this.locomotion.edge( state, 'exit' ) ) { this.exit(); return; }
				if ( this.locomotion.edge( state, 'next' ) ) this.selectLocation( this.location + 1 );
				if ( this.locomotion.edge( state, 'recenter' ) ) this.locomotion.recenter();
				const rig = this.locomotion.update( pose, state, dt );
				this.paused = false;
				this._matrix.multiplyMatrices( rig, new Matrix4().fromArray( pose.transform.matrix ) );
				this._matrix.decompose( this.app.camera.position, this.app.camera.quaternion, this._scale );
				this.app.camera.updateMatrixWorld();
				this._controllers( frame, rig );
				const controller = this.controllers.get( 'right' );
				if ( this.locomotion.edge( state, 'use' ) && controller?.visible ) {

					const origin = controller.position, q = controller.quaternion;
					const door = pickDoor( this.app.village.station.moving.doors, origin, new Vector3( 0, 0, - 1 ).applyQuaternion( q ) );
					if ( door ) door.target = door.target > 0.5 ? 0 : 1;

				}
				for ( const door of this.app.village.station.moving.doors ) updateDoor( door, dt );
				this.views = pose.views.map( ( view ) => ( { view, subImage: this.binding.getViewSubImage( this.layer, view ) } ) );
				this.app.frame( dt );
				this.stats.frameRate = frame.session.frameRate || this.stats.frameRate;
				this.stats.record( interval, performance.now() - t0, LOCATIONS[ this.location ][ 0 ] );

			} else {

				// No simulation or locomotion while tracking is absent / system UI is open.
				if ( ! this.paused ) this.stats.pauses ++;
				this.paused = true;
				this.locomotion.recenter();
				this.locomotion.previous = {};
				this.controllerInput.reset();
				for ( const controller of this.controllers.values() ) controller.visible = false;
				this.lastTime = null;

			}
			this._raf = frame.session.requestAnimationFrame( ( t, f ) => this._frame( t, f ) );

		} catch ( e ) {

			console.error( 'VR frame failed:', e );
			this.failure = e.message;
			this.exit();

		}

	}

	_controllers( frame, rig ) {

		for ( const c of this.controllers.values() ) c.visible = false;
		for ( const source of frame.session.inputSources ) {

			if ( ! [ 'left', 'right' ].includes( source.handedness ) || ! source.targetRaySpace ) continue;
			const pose = frame.getPose( source.targetRaySpace, this.space );
			if ( ! pose ) continue;
			let group = this.controllers.get( source.handedness );
			if ( ! group ) {

				group = new Group();
				group.name = 'XR-' + source.handedness;
				const color = source.handedness === 'left' ? 0x94becb : 0xefc783;
				const material = new Material( { name: group.name, lit: false, color, underwaterLighting: 'none' } );
				group.add( new Mesh( new SphereGeometry( 0.028, 8, 6 ), material ) );
				group.add( new Mesh( new CylinderGeometry( 0.003, 0.003, 0.6, 6 ).rotateX( Math.PI / 2 ).translate( 0, 0, - 0.3 ), material ) );
				this.controllers.set( source.handedness, group );
				this.app.scene.add( group );

			}
			this._matrix.multiplyMatrices( rig, new Matrix4().fromArray( pose.transform.matrix ) );
			this._matrix.decompose( group.position, group.quaternion, this._scale );
			group.visible = true;

		}

	}

	render() { this.renderer.render( this.views, this.locomotion.rig ); }

	async exit() {

		if ( this.session ) await this.session.end().catch( ( e ) => { this.status.textContent = e.message; } );

	}

	_ended( session ) {

		if ( this.session !== session ) return;
		const wasActive = this.active;
		this.active = false;
		this.session = null;
		if ( this._raf !== undefined ) session.cancelAnimationFrame?.( this._raf );
		this._raf = undefined;
		this.space?.removeEventListener( 'reset', this._resetSpace );
		this._resetSpace = null;
		this.space = null;
		this.layer?.destroy?.();
		this.layer = null;
		this.binding = null;
		this.views = null;
		for ( const c of this.controllers.values() ) c.visible = false;
		if ( wasActive ) {

			const app = this.app;
			app.camera.fov = this.saved.fov;
			app.camera.near = this.saved.near;
			app.camera.updateProjectionMatrix();
			app.sceneRenderer.setSize( this.saved.width, this.saved.height );
			app.post._outW = 0;
			app.input.enabled = true;
			app.input.reset();
			// Quest's browser viewport can resize while immersive mode is open.
			app.engine.resize();
			app.player.velocity.set( 0, 0, 0 );
			app.cameraCut();
			app.start();

		}
		this.root.hidden = false;
		this.enterButton.disabled = false;
		this.enterButton.textContent = 'Enter VR';
		this.status.textContent = this.failure ? 'VR stopped: ' + this.failure : 'Returned to desktop. Choose another location or resolution to explore again.';
		const diagnostics = this.root.querySelector( '.xr-diagnostics' );
		if ( wasActive && this.stats.frames ) {
			const report = this.lastReport = this.stats.report();
			diagnostics.hidden = false;
			this.root.querySelector( '.xr-metrics' ).textContent = `${ report.frames } frames at ${ Math.round( report.scale * 100 ) }% resolution. Last ${ report.sampleWindow } frames: 95th percentile interval ${ report.intervalP95Ms.toFixed( 1 ) } ms; CPU ${ report.cpuP95Ms.toFixed( 1 ) } ms. ${ report.longIntervals } long intervals; ${ report.pauses } tracking / overlay pauses.`;
		}
		this.failure = null;

	}

}
