import { PlaneGeometry, Mesh } from '../engine/index.js';
import { UniformBlock, ShaderModule, Material, commonModule, LAYERS } from '../engine/webgpu.js';
import { G } from '../core/Globals.js';
import { hazeDensityForVisibility } from '../post/AirHaze.js';
import { TOWER, ROOM } from '../world/flannan/Station.js';
import { SeaWeatherState } from './SeaWeatherState.js';

export function stationShelter( p ) {
	return ( Math.hypot( p.x, p.z ) < TOWER.rIn && p.y < TOWER.deck + 4.3 && p.y >= TOWER.floor - 0.15 ) ||
		( p.x > ROOM.x0 && p.x < ROOM.x1 && p.z > ROOM.z0 && p.z < ROOM.z1 && p.y < ROOM.ceiling && p.y >= TOWER.floor - 0.15 );
}

export class SeaWeather {
	constructor( app ) {
		this.app = app;
		this.model = new SeaWeatherState( app.qs.get( 'seaWeather' ) || 'gale' );
		this.uniforms = new UniformBlock( 'SeaWeatherParams', { rain: [ 'f32', 0 ], wet: [ 'f32', 0 ] }, { label: 'seaWeather' } );
		const f = ( x ) => Number( x ).toFixed( 4 );
		this.module = new ShaderModule( { name: 'seaWeather', deps: [ commonModule ], uniforms: this.uniforms, uniformName: 'seaWeather', code: /* wgsl */`
fn seaWeatherShelter( p: vec3f ) -> bool {
	let tower = length( p.xz ) < ${ f( TOWER.rIn ) } && p.y < ${ f( TOWER.deck + 4.3 ) } && p.y >= ${ f( TOWER.floor - 0.15 ) };
	let room = p.x > ${ f( ROOM.x0 ) } && p.x < ${ f( ROOM.x1 ) } && p.z > ${ f( ROOM.z0 ) } && p.z < ${ f( ROOM.z1 ) } && p.y < ${ f( ROOM.ceiling ) } && p.y >= ${ f( TOWER.floor - 0.15 ) };
	return tower || room;
}
` } );
		// Fixed storm-capable spectrum; smooth displacement scaling avoids rebuilding FFT phases
		// when a preset changes. The old desktop night and the VR quality profile keep their spectra.
		Object.assign( app.fft.local, { windSpeed: 18, fetch: 700, windDirection: - 35 } );
		Object.assign( app.fft.swell, { scale: 0.9, windSpeed: 10, fetch: 2400, windDirection: - 20 } );
		app.fft.updateSpectrumUniforms();
		app.shore.period.value = 14;
		this.installWetSurfaces();
		this.makeRain();
		this.update( 0 );
	}
	installWetSurfaces() {
		const seen = new Set();
		for ( const root of [ this.app.terrain.mesh, this.app.rocks.group, this.app.village.group ] ) root.traverse( ( o ) => {
			for ( const m of ( o.material ? ( Array.isArray( o.material ) ? o.material : [ o.material ] ) : [] ) ) {
				if ( seen.has( m ) || m.transparent || m.name === 'Cliff run-up' ) continue;
				seen.add( m ); m.modules.push( this.module );
				m.surface += /* wgsl */`
	// Rain darkens exposed stone and timber; the room, shaft and lantern stay dry.
	let weatherWet = select( seaWeather.wet, 0.0, seaWeatherShelter( in.P ) );
	let upwardWet = weatherWet * mix( 0.4, 1.0, sat( in.N.y ) );
	s.albedo *= 1.0 - upwardWet * 0.24;
	s.roughness = mix( s.roughness, min( s.roughness, 0.32 ), upwardWet * 0.72 );
`;
				m.needsUpdate = true;
			}
		} );
	}
	makeRain() {
		const material = new Material( {
			name: 'Wind-driven rain', modules: [ this.module, this.app.terrainGPU.module ],
			lit: false, transparent: true, blending: 'premultiplied', depthWrite: false, side: 'double',
			underwaterLighting: 'none', varyings: { vRain: 'vec3f' },
			vertex: /* wgsl */`
	let id = f32( v.instance );
	let h = fract( sin( vec3f( id + 0.13, id * 1.37 + 4.2, id * 2.71 + 7.3 ) ) * 43758.5453 );
	let vel = vec3f( frame.windDir.x * frame.windSpeed * 0.45, - 19.0, frame.windDir.y * frame.windSpeed * 0.45 );
	let span = 24.0;
	let cam = frame.cameraPos;
	let home = h * span + vel * frame.time;
	let q = home - floor( ( home - cam + span * 0.5 ) / span ) * span;
	let axis = normalize( vel );
	let toEye = normalize( cam - q + vec3f( 0.001 ) );
	let side = normalize( cross( axis, toEye ) + vec3f( 0.00001 ) );
	let uv = v.uv * 2.0 - 1.0;
	let world = q + side * uv.x * 0.014 + axis * uv.y * 0.6;
	let inside = seaWeatherShelter( world ) || seaWeatherShelter( cam );
	let live = ! inside && world.y > max( terrainHeightAt( world.xz ) + 0.1, frame.seaLevel ) && frame.cameraUnderwater < 0.5;
	v.useWorld = true; v.worldPos = select( vec3f( 0.0, -1e5, 0.0 ), world, live );
	v.worldNormal = toEye; v.prevWorldPos = v.worldPos - vel * frame.dt;
	o.vRain = vec3f( uv, select( 0.0, seaWeather.rain, live ) );
`,
			surface: /* wgsl */`
	let q = in.vs.vRain;
	let alpha = q.z * ( 1.0 - abs( q.x ) ) * ( 1.0 - abs( q.y ) ) * 0.12;
	if ( alpha < 0.002 ) { discard; }
	s.alpha = alpha;
	s.albedo = ( frame.skyIrradiance * 0.65 + frame.sunColor * 0.015 ) * alpha;
`, output: 'r.color = vec4f( s.albedo, s.alpha );',
		} );
		const geometry = new PlaneGeometry( 1, 1 ); geometry.instanceCount = 6000;
		this.rain = new Mesh( geometry, material ); this.rain.frustumCulled = false;
		this.rain.castShadow = false; this.rain.layers.set( LAYERS.TRANSPARENT );
		this.rain.renderOrder = 23; this.app.scene.add( this.rain );
	}
	update( dt ) {
		const s = this.model.update( dt ), a = this.app;
		this.state = s;
		const gust = 1 + 0.07 * Math.sin( G.time.value * 0.63 ) * Math.sin( G.time.value * 0.19 + 1 );
		G.windSpeed.value = s.wind * gust;
		G.windDir.value.set( Math.cos( - 35 * Math.PI / 180 ), Math.sin( - 35 * Math.PI / 180 ) );
		if ( a.clouds ) { a.clouds.coverage.value = s.clouds; a.clouds.weatherWindSpeed = s.wind; a.clouds.weatherContinuous = true; }
		if ( a.haze ) a.haze.density.value = hazeDensityForVisibility( s.vis );
		a.sky.sunDiskIntensity.value = 1 - Math.min( 1, s.rain / 0.85 ) * 0.99;
		a.surface.amplitude.value = s.sea;
		a.surface.foamCoverage.value = 0.55 + s.surf * 0.75;
		a.shore.amplitude.value = 0.22 + s.surf * 1.8;
		this.uniforms.fields.rain.value = s.rain; this.uniforms.fields.wet.value = s.wet;
		if ( this.onUpdate ) this.onUpdate( s );
	}
	applyLighting() {
		// Broad overcast fills gaps in the broken-cumulus model during the squall. Applied after
		// the atmosphere readback each frame, so it cannot accumulate or alter the normal night.
		if ( ! this.app.atmosphere.sunTransmittance ) return;
		const storm = Math.min( 1, this.state.rain / 0.85 );
		const sun = G.sunColor.value, sky = G.skyIrradiance.value;
		sun.r *= 1 - storm * 0.97; sun.g *= 1 - storm * 0.96; sun.b *= 1 - storm * 0.95;
		sky.r *= 1 - storm * 0.36; sky.g *= 1 - storm * 0.25; sky.b *= 1 - storm * 0.12;
	}
}
