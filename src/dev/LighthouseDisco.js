import { Group, Mesh, Vector3, Color, SphereGeometry, PlaneGeometry, CylinderGeometry, BoxGeometry, TorusGeometry, mergeGeometries } from '../engine/index.js';
import { standard } from '../materials/Materials.js';
import { Beams } from '../station/Beams.js';

export const DISCO_PALETTES = {
	prism: [ 0x36f3dd, 0xff4bab, 0x7970ff, 0xffb947 ],
	aurora: [ 0x37ffaf, 0x21bfef, 0x9376ff, 0x40e7d3 ],
	sunset: [ 0xff7243, 0xffd168, 0xff3c88, 0xb079ff ],
};
const clamp = ( n, lo, hi, fallback ) => Number.isFinite( Number( n ) ) ? Math.max( lo, Math.min( hi, Number( n ) ) ) : fallback;

export class LighthouseDisco {
	constructor( app ) {
		this.app = app; this.enabled = false; this.palette = 'prism'; this.tempo = 112; this.intensity = .75; this.mist = .45;
		this.frozen = false; this.music = false; this.time = 0; this.phase = 0; this.reduced = globalThis.matchMedia?.( '(prefers-reduced-motion: reduce)' )?.matches === true;
		this.colors = DISCO_PALETTES.prism.map( hex => new Color( hex ) );
		this.root = new Group(); this.root.name = 'temporary disco mirror ball'; this.root.visible = false; app.scene.add( this.root );
		const ground = Math.max( app.terrainData.heightAt( - 9, 14 ), app.village?.station ? 80.6 : 0 );
		this.root.position.set( - 9, ground + 2.6, 14 );
		this.ball = new Group(); this.root.add( this.ball );
		this.ball.add( new Mesh( new SphereGeometry( .44, 32, 20 ), standard( { color: 0x202f37, metalness: 1, roughness: .18 } ) ) );
		const tiles = [];
		for ( let row = 1; row < 15; row ++ ) {
			const polar = row * Math.PI / 16, ring = Math.max( 5, Math.round( 30 * Math.sin( polar ) ) );
			for ( let col = 0; col < ring; col ++ ) {
				const angle = col * Math.PI * 2 / ring, normal = new Vector3( Math.sin( polar ) * Math.cos( angle ), Math.cos( polar ), Math.sin( polar ) * Math.sin( angle ) );
				const tile = new Mesh( new PlaneGeometry( .068, .07 ), null ); tile.position.copy( normal ).multiplyScalar( .45 );
				tile.quaternion.setFromUnitVectors( new Vector3( 0, 0, 1 ), normal ); tile.updateMatrix();
				tiles.push( tile.geometry.applyMatrix4( tile.matrix ) );
			}
		}
		this.ball.add( new Mesh( mergeGeometries( tiles ), standard( { name: 'individual silver mirror facets', color: 0xc5d9df, metalness: 1, roughness: .1 } ) ) );
		const hardware = [], iron = standard( { name: 'portable disco gantry', color: 0x405052, metalness: .8, roughness: .4 } );
		for ( const x of [ - 1.2, 1.2 ] ) {
			hardware.push( new CylinderGeometry( .03, .04, 3.6, 12 ).translate( x, - .8, 0 ) );
			hardware.push( new BoxGeometry( .6, .05, .6 ).translate( x, - 2.575, 0 ) );
		}
		hardware.push( new CylinderGeometry( .035, .035, 2.5, 12 ).rotateZ( Math.PI / 2 ).translate( 0, 1, 0 ) );
		for ( let i = 0; i < 8; i ++ ) hardware.push( new TorusGeometry( .025, .006, 5, 12 ).rotateY( i % 2 * Math.PI / 2 ).translate( 0, .51 + i * .06, 0 ) );
		this.root.add( new Mesh( mergeGeometries( hardware ), iron ) );
		this.sources = this.colors.map( color => app.localLights.add( {
			position: this.root.position.clone(), color, intensity: 200, range: 32, dir: new Vector3( 0, - 1, 0 ),
			cosInner: .83, cosOuter: .3, kind: 'playground disco', enabled: false, always: true,
		} ) );
	}
	configure( values ) {
		if ( values.palette in DISCO_PALETTES ) { this.palette = values.palette; DISCO_PALETTES[ this.palette ].forEach( ( hex, i ) => this.colors[ i ].setHex( hex ) ); }
		for ( const [ key, lo, hi ] of [ [ 'tempo', 40, 160 ], [ 'intensity', 0, 1 ], [ 'mist', 0, 1 ] ] ) if ( key in values ) this[ key ] = clamp( values[ key ], lo, hi, this[ key ] );
		for ( const key of [ 'frozen', 'music', 'reduced' ] ) if ( key in values ) this[ key ] = !! values[ key ];
		if ( ! this.music || this.frozen ) this.stopMusic();
	}
	setEnabled( enabled ) {
		enabled = !! enabled; if ( enabled === this.enabled ) return;
		const a = this.app, B = Beams.uniforms;
		if ( enabled ) {
			this.original = { time: a.settings.timeOfDay, speed: a.settings.timeSpeed, haze: a.haze?.density.value, spread: B.spread.value,
				color: B.color.value.clone(), palette: B.colors.value.map( c => c.clone() ), lamp: a.lamp?.save(), lampSpeed: a.lamp?.speed };
			a.settings.timeOfDay = 18.8; a.settings.timeSpeed = 0; a.updateSun?.();
		} else {
			const o = this.original;
			a.settings.timeOfDay = o.time; a.settings.timeSpeed = o.speed;
			if ( a.haze ) a.haze.density.value = o.haze;
			B.spread.value = o.spread; B.color.value.copy( o.color ); B.colors.value.forEach( ( c, i ) => c.copy( o.palette[ i ] ) );
			if ( a.lamp && o.lamp ) { a.lamp.load( o.lamp ); a.lamp.speed = o.lampSpeed; a.lamp.update( 0 ); }
			a.updateSun?.(); this.stopMusic();
		}
		this.enabled = enabled; this.root.visible = enabled; this.sources.forEach( s => { s.enabled = enabled; } );
		if ( enabled ) this.update( 0 );
	}
	update( dt ) {
		if ( ! this.enabled ) return;
		dt = clamp( dt, 0, .1, 0 ); if ( ! this.frozen ) { this.time += dt; this.phase += dt * this.tempo / 60; }
		const a = this.app, B = Beams.uniforms;
		const sweep = this.phase * ( this.reduced ? .025 : .13 ), pulse = this.reduced ? 1 : .88 + .12 * Math.sin( this.phase * Math.PI * 2 );
		B.count.value = 4; B.origin.value.copy( a.lamp?.origin || new Vector3( 0, 101, 0 ) ); B.spread.value = .06;
		if ( a.haze ) a.haze.density.value = ( this.original.haze ?? 1 ) + this.mist * 8;
		if ( a.lamp ) {
			a.lamp.glow = 1;
			if ( a.lamp.lens ) a.lamp.lens.rotation.y = - sweep;
			if ( a.lamp.lensMaterial ) { a.lamp.lensMaterial.uniforms.glow.value = 1; a.lamp.lensMaterial.uniforms.angle.value = sweep; }
			if ( a.lamp.light ) a.lamp.light.scale = .6;
		}
		for ( let i = 0; i < 4; i ++ ) {
			const angle = sweep + i * Math.PI / 2, tilt = - .23 - .1 * Math.sin( sweep * .7 + i );
			const dir = this.sources[ i ].dir.set( Math.cos( angle ), tilt, Math.sin( angle ) ).normalize();
			B.dirs.value[ i ].set( dir.x, dir.y, dir.z, 35000 * this.intensity * pulse );
			const c = this.colors[ i ]; B.colors.value[ i ].set( c.r, c.g, c.b, 1 );
			this.sources[ i ].dir.set( Math.cos( angle ) * .7, - .85, Math.sin( angle ) * .7 ).normalize();
			this.sources[ i ].intensity = 150 * this.intensity * pulse;
		}
		this.ball.rotation.y = sweep * 2; this.ball.rotation.z = Math.sin( sweep ) * .05;
		this.updateMusic();
	}
	updateMusic() {
		const audio = this.app.audio, ctx = audio?.ctx;
		if ( ! this.music || this.frozen || this.app.devMenu?.open || ! ctx || ctx.state !== 'running' || ! audio.near ) { this.stopMusic(); return; }
		if ( ! this.musicGain ) { this.musicGain = ctx.createGain(); this.musicGain.gain.value = .16; this.musicGain.connect( audio.near ); this.voices = new Set(); }
		const step = Math.floor( this.phase * 2 ); if ( step === this.lastStep ) return; this.lastStep = step;
		const now = ctx.currentTime;
		const note = ( frequency, type, length, volume, end = frequency ) => {
			const osc = ctx.createOscillator(), gain = ctx.createGain(); osc.type = type; osc.frequency.setValueAtTime( frequency, now );
			osc.frequency.exponentialRampToValueAtTime( end, now + length ); gain.gain.setValueAtTime( .001, now );
			gain.gain.exponentialRampToValueAtTime( volume, now + .008 ); gain.gain.exponentialRampToValueAtTime( .001, now + length );
			osc.connect( gain ).connect( this.musicGain ); this.voices.add( osc );
			osc.onended = () => { osc.disconnect(); gain.disconnect(); this.voices.delete( osc ); };
			osc.start( now ); osc.stop( now + length + .015 );
		};
		if ( step % 2 === 0 ) note( 115, 'sine', .17, .55, 43 );
		if ( step % 4 === 2 ) note( 190, 'triangle', .095, .13, 110 );
		const bass = [ 65.41, 77.78, 87.31, 58.27 ][ Math.floor( step / 8 ) % 4 ];
		note( bass * ( step % 4 === 3 ? 2 : 1 ), 'triangle', .16, .16 );
		if ( step % 2 ) note( bass * 8, 'sine', .12, .035 );
	}
	stopMusic() {
		for ( const voice of this.voices || [] ) { try { voice.stop(); } catch {} }
		this.lastStep = undefined;
	}
}
