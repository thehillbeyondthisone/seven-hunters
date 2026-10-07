import { BufferGeometry, BufferAttribute, Mesh, Vector3, Quaternion, Euler } from '../engine/index.js';
import { Material } from '../engine/webgpu.js';
import { G } from '../core/Globals.js';
import { LAYERS } from '../core/SceneRenderer.js';
import { stationShelter } from './SeaWeather.js';
import { SeaDreadState, SEA_DREAD_TIME } from './SeaDreadState.js';

export class SeaDread {
	constructor( app ) {
		this.app = app;
		this.model = new SeaDreadState( { reduced: app.qs.has( 'reducedEffects' ) || globalThis.matchMedia?.( '(prefers-reduced-motion: reduce)' ).matches === true } );
		this.basePose = new Quaternion(); this.offset = new Quaternion(); this.euler = new Euler( 0, 0, 0, 'YXZ' );
		this.source = new Vector3(); this.forward = new Vector3(); this.rendering = false;
		this.basePost = Object.fromEntries( [ 'vignette', 'saturation', 'warmth', 'contrast' ].map( ( k ) => [ k, app.post.params[ k ].value ] ) );
		this.baseGrade = Object.fromEntries( [ 'gradeMode', 'gradeLift', 'gradeGamma', 'gradeGain' ].map( ( k ) => [ k, app.post.params[ k ].value.clone?.() ?? app.post.params[ k ].value ] ) );
		this.baseSpray = app.spray.params.intensity.value;
		this.boltMaterial = new Material( {
			name: 'Distant Atlantic lightning', lit: false, transparent: true, blending: 'premultiplied', depthWrite: false, side: 'double', underwaterLighting: 'none',
			uniforms: { flash: [ 'f32', 0 ] },
			output: 'r.color = vec4f( vec3f( 3.5, 4.3, 5.0 ) * mat.flash, mat.flash );',
		} );
		const geometry = new BufferGeometry();
		geometry.setAttribute( 'position', new BufferAttribute( new Float32Array( 36 * 6 * 3 ), 3 ) );
		geometry.setAttribute( 'normal', new BufferAttribute( new Float32Array( 36 * 6 * 3 ).fill( 0.1 ), 3 ) );
		this.bolt = new Mesh( geometry, this.boltMaterial ); this.bolt.visible = false; this.bolt.frustumCulled = false;
		this.bolt.layers.set( LAYERS.TRANSPARENT ); this.bolt.renderOrder = 21; app.scene.add( this.bolt );
		if ( app.cliffSurge ) app.cliffSurge.onImpact = ( site, strength ) => this.cliffImpact( site, strength );
		app.settings.timeOfDay = SEA_DREAD_TIME; app.settings.timeSpeed = 0;
	}
	cliffImpact( site, strength ) {
		if ( ! this.model.enabled || stationShelter( this.app.camera.position ) ) return;
		const p = this.app.camera.position;
		const distance = Math.hypot( site.x - p.x, site.z - p.z, p.y );
		const amount = Math.max( 0, 1 - distance / 130 ) ** 2 * Math.min( 1, strength );
		this.model.hit( amount * 0.85 );
		if ( amount > 0.12 ) this.sound( 'impact', amount );
	}
	strike() {
		const a = this.app, p = a.camera.position;
		this.forward.set( 0, 0, - 1 ).applyQuaternion( a.camera.quaternion ); this.forward.y = 0;
		if ( this.forward.lengthSq() < 0.01 ) this.forward.set( - 1, 0, 0 );
		this.forward.normalize();
		this.source.copy( p ).addScaledVector( this.forward, 1100 ); this.source.y = 0;
		if ( ! this.model.strike( p.distanceTo( this.source ) ) ) return;
		// A narrow branching silhouette gives the flash a distant source and a sense of scale.
		const positions = this.bolt.geometry.attributes.position;
		const side = new Vector3( - this.forward.z, 0, this.forward.x );
		const points = []; let sideways = 0;
		for ( let i = 0; i <= 28; i ++ ) {
			sideways += ( this.model.rand() - 0.5 ) * 13;
			points.push( this.source.clone().addScaledVector( side, sideways ).add( new Vector3( 0, 280 * ( 1 - i / 28 ), 0 ) ) );
		}
		for ( let i = 0; i < 8; i ++ ) {
			const root = points[ 7 + i * 2 ];
			points.push( root.clone(), root.clone().addScaledVector( side, ( i % 2 ? - 1 : 1 ) * ( 18 + this.model.rand() * 24 ) ).add( new Vector3( 0, - 25, 0 ) ) );
		}
		let cursor = 0;
		const segment = ( u, v, width ) => {
			const d = side.clone().multiplyScalar( width );
			for ( const q of [ u.clone().sub( d ), u.clone().add( d ), v.clone().sub( d ), v.clone().sub( d ), u.clone().add( d ), v.clone().add( d ) ] ) {
				positions.array.set( [ q.x, q.y, q.z ], cursor ); cursor += 3;
			}
		};
		for ( let i = 0; i < 28; i ++ ) segment( points[ i ], points[ i + 1 ], 0.9 );
		for ( let i = 29; i < points.length; i += 2 ) segment( points[ i ], points[ i + 1 ], 0.45 );
		positions.needsUpdate = true;
	}
	update( dt ) {
		const weather = this.app.seaWeather?.state, storm = Math.min( 1, weather?.surf || 0 );
		const events = this.model.update( dt, storm );
		if ( events.strike ) this.strike();
		if ( events.thunder ) this.sound( 'thunder', stationShelter( this.app.camera.position ) ? 0.25 : 0.8 );
		this.boltMaterial.uniforms.flash.value = this.model.flash;
		this.bolt.visible = this.model.flash > 0.005;
	}
	applyLighting() {
		if ( ! this.model.enabled ) return;
		const a = this.app, m = this.model, storm = Math.min( 1, a.seaWeather?.state.surf || 0 );
		const breath = 0.82 + Math.sin( m.time * 0.075 ) * 0.12 + Math.sin( m.time * 0.031 + 2 ) * 0.06;
		if ( a.haze ) a.haze.seaMist.value.set( ( 0.002 + storm * 0.005 ) * breath, 16 );
		// Keep the nearby rain from turning into a dark curtain over the sea.
		if ( a.seaWeather ) a.seaWeather.uniforms.fields.rain.value *= 0.45;
		const sky = G.skyIrradiance.value, sun = G.sunColor.value;
		sky.r *= 0.58; sky.g *= 0.73; sky.b *= 0.9;
		sun.r *= 0.65; sun.g *= 0.77; sun.b *= 0.92;
		// Broad sheet-lightning fill; the distant bolt supplies the visible source.
		const f = m.flash * ( stationShelter( a.camera.position ) ? 0.15 : 1 );
		const fill = Math.max( 0.12, ( sky.r + sky.g + sky.b ) * 0.8 );
		sky.r += f * fill * 0.8; sky.g += f * fill; sky.b += f * fill * 1.2;
		a.spray.params.intensity.value = this.baseSpray * 0.62;
	}
	beginRender() {
		this.endRender();
		const a = this.app, m = this.model, P = a.post.params;
		if ( ! m.enabled ) return;
		P.saturation.value = 0.2; P.warmth.value = - 0.09; P.contrast.value = 1.05;
		// An authored overcast grade removes the sunset's warm cast while retaining the sea's detail.
		P.gradeMode.value = 1; P.gradeLift.value.set( 0.003, 0.005, 0.007, 0 );
		P.gradeGamma.value.set( 1, 1, 1, 0 ); P.gradeGain.value.set( 0.52, 0.8, 1.06, 1 );
		P.vignette.value = 0.36 + m.impact * 0.1;
		if ( a.xr?.active || ! m.shake ) return;
		this.basePose.copy( a.camera.quaternion ); this.rendering = true;
		const t = m.time, k = m.shake * 0.0048;
		this.euler.set( Math.sin( t * 23 ) * k, Math.sin( t * 17 ) * k * 0.3, Math.sin( t * 19 ) * k * 0.55, 'YXZ' );
		a.camera.quaternion.multiply( this.offset.setFromEuler( this.euler ) );
	}
	endRender() {
		if ( ! this.rendering ) return;
		this.app.camera.quaternion.copy( this.basePose ); this.app.camera.updateMatrixWorld(); this.rendering = false;
	}
	setEnabled( enabled ) {
		this.endRender(); this.model.setEnabled( enabled ); this.bolt.visible = false;
		this.app.spray.params.intensity.value = this.baseSpray;
		if ( this.app.haze ) this.app.haze.seaMist.value.set( 0, 16 );
		for ( const [ k, v ] of Object.entries( this.basePost ) ) this.app.post.params[ k ].value = v;
		for ( const [ k, v ] of Object.entries( this.baseGrade ) ) {
			const field = this.app.post.params[ k ];
			if ( field.value.copy ) field.value.copy( v ); else field.value = v;
		}
		for ( const voice of this.voices || [] ) { try { voice.stop(); } catch {} }
	}
	sound( kind, amount ) {
		const s = this.app.audio, c = s?.ctx;
		if ( ! c || c.state !== 'running' || ! s.aboveOut || s.muted ) return;
		this.voices ||= new Set();
		if ( this.voices.size >= 5 ) return;
		if ( ! this.noise ) {
			this.noise = c.createBuffer( 1, c.sampleRate * 5, c.sampleRate );
			const data = this.noise.getChannelData( 0 );
			for ( let i = 0; i < data.length; i ++ ) data[ i ] = Math.random() * 2 - 1;
		}
		const source = c.createBufferSource(), low = c.createBiquadFilter(), high = c.createBiquadFilter(), gain = c.createGain();
		source.buffer = this.noise;
		low.type = 'lowpass'; low.frequency.value = kind === 'thunder' ? 260 : 95;
		high.type = 'highpass'; high.frequency.value = 35;
		const t = c.currentTime, duration = kind === 'thunder' ? 4.8 : 1.6;
		gain.gain.setValueAtTime( 0, t ); gain.gain.linearRampToValueAtTime( amount * ( kind === 'thunder' ? 0.65 : 0.35 ), t + 0.12 );
		gain.gain.exponentialRampToValueAtTime( 0.0001, t + duration );
		source.connect( low ).connect( high ).connect( gain ).connect( s.aboveOut );
		this.voices.add( source ); source.start(); source.stop( t + duration );
		source.onended = () => { this.voices.delete( source ); source.disconnect(); low.disconnect(); high.disconnect(); gain.disconnect(); };
	}
}
