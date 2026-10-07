import { SEA_WEATHER } from './SeaWeatherState.js';
import { stationShelter } from './SeaWeather.js';
import { Vector3 } from '../engine/index.js';
import { TOWER, updateDoor } from '../world/flannan/Station.js';
import { Interact } from '../story/Interact.js';
import './weather.css';

export class WeatherPreview {
	constructor( app ) {
		this.app = app;
		this.interact = new Interact( { camera: app.camera, input: app.input, player: app.player } );
		const doors = app.village.station.moving.doors;
		for ( const d of doors ) this.interact.add( {
			id: d.name, at: d.center, reach: 2.4, size: Math.max( 0.45, d.width / 2 ),
			text: () => `${ d.target > 0.5 ? 'Shut' : 'Open' } the ${ d.name === 'gate' ? 'gate' : 'door' }`,
			use: () => {
				const target = d.target > 0.5 ? 0 : 1;
				for ( const leaf of doors.filter( ( leaf ) => leaf.name === d.name ) ) leaf.target = target;
				app.stationSound?.door( d.name, !! target, d.center );
			},
		} );
		const title = app.seaDread ? 'THE BLACK ATLANTIC' : 'THE ATLANTIC WATCH';
		app.ui.ui.startEl.querySelector( '.tw-start-title' ).textContent = title;
		app.ui.ui.startEl.querySelector( '.tw-start-cta span:last-child' ).textContent = 'Explore the west landing';
		const dock = document.createElement( 'section' ); dock.className = 'weather-preview'; dock.setAttribute( 'aria-label', 'Sea and weather preview' );
		dock.innerHTML = `<div class="weather-heading"><strong>THE ATLANTIC WATCH</strong><button type="button" class="weather-collapse" aria-expanded="true" aria-label="Collapse weather controls">−</button></div><div class="weather-controls"><p class="weather-status" aria-live="polite"></p><div class="weather-presets"></div><button type="button" class="weather-cycle">Run weather cycle · 4m 20s</button><div class="weather-places"></div><p class="weather-help">Click the scene to look · WASD walk · E doors · Esc releases mouse · M sound · H settings</p><a href="./">Return to the first night</a></div>`;
		document.body.append( dock ); this.dock = dock;
		// Desktop weather lives in the single compact debug panel.
		if ( ! app.isMobile ) dock.hidden = true;
		if ( app.seaDread ) {
			dock.querySelector( '.weather-heading strong' ).textContent = title;
			const effects = document.createElement( 'div' ); effects.className = 'weather-dread';
			effects.innerHTML = '<button type="button" class="dread-toggle" aria-pressed="true">Sea dread: On</button><button type="button" class="dread-reduced">Reduced effects: Off</button><button type="button" class="dread-reveal">Distant lightning</button><p>Reduced effects turns off camera shake and lightning flashes. Mist and sound remain.</p>';
			dock.querySelector( '.weather-controls' ).prepend( effects );
			const toggle = effects.querySelector( '.dread-toggle' ), reduced = effects.querySelector( '.dread-reduced' ), reveal = effects.querySelector( '.dread-reveal' );
			const sync = () => {
				const m = app.seaDread.model;
				toggle.textContent = `Sea dread: ${ m.enabled ? 'On' : 'Off' }`; toggle.setAttribute( 'aria-pressed', String( m.enabled ) );
				reduced.textContent = `Reduced effects: ${ m.reduced ? 'On' : 'Off' }`; reduced.setAttribute( 'aria-pressed', String( m.reduced ) );
				reveal.disabled = ! m.enabled || m.reduced;
			};
			toggle.onclick = () => { app.seaDread.setEnabled( ! app.seaDread.model.enabled ); sync(); };
			reduced.onclick = () => { app.seaDread.model.reduced = ! app.seaDread.model.reduced; sync(); };
			reveal.onclick = () => app.seaDread.strike(); sync();
		}
		this.buttons = [];
		for ( const [ key, preset ] of Object.entries( SEA_WEATHER ) ) {
			const b = document.createElement( 'button' ); b.type = 'button'; b.textContent = preset.label; b.dataset.preset = key;
			b.addEventListener( 'click', () => app.seaWeather.select( key ) );
			dock.querySelector( '.weather-presets' ).append( b ); this.buttons.push( b );
		}
		this.cycle = dock.querySelector( '.weather-cycle' );
		this.cycle.onclick = () => {
			if ( ! app.seaWeather.active ) app.seaWeather.select( 'settled' );
			if ( app.seaWeather.model.cycling ) app.seaWeather.model.select( app.seaWeather.model.preset );
			else app.seaWeather.model.cycle();
		};
		for ( const [ label, place ] of [ ...( app.seaDread ? [ [ 'Face the Atlantic', 'sea' ] ] : [] ), [ 'West landing', 'west' ], [ 'Station yard', 'yard' ], [ 'Inside', 'room' ] ] ) {
			const b = document.createElement( 'button' ); b.type = 'button'; b.textContent = label;
			b.onclick = () => this.place( place ); dock.querySelector( '.weather-places' ).append( b );
		}
		dock.querySelector( '.weather-collapse' ).onclick = ( e ) => {
			const collapsed = dock.classList.toggle( 'collapsed' );
			e.currentTarget.setAttribute( 'aria-expanded', String( ! collapsed ) );
			e.currentTarget.setAttribute( 'aria-label', `${ collapsed ? 'Expand' : 'Collapse' } weather controls` );
			e.currentTarget.textContent = collapsed ? '+' : '−';
		};
		this.timer = 0;
		app.seaWeather.onUpdate = ( s ) => {
			this.timer ++;
			if ( this.timer % 20 ) return;
			const model = app.seaWeather.model;
			for ( const b of this.buttons ) b.setAttribute( 'aria-pressed', String( ! model.cycling && model.preset === b.dataset.preset ) );
			this.cycle.textContent = model.cycling ? `Stop cycle · ${ Math.floor( model.elapsed ) } / 260 s` : 'Run weather cycle · 4m 20s';
			dock.querySelector( '.weather-status' ).textContent = `${ s.label } · ${ Math.round( s.wind ) } m/s · ${ s.vis.toFixed( 1 ) } km visibility${ stationShelter( app.camera.position ) ? ' · Sheltered' : '' }`;
		};
		if ( ! app.qs.has( 'view' ) ) this.place( app.seaDread ? 'sea' : 'west' );
		if ( app.qs.has( 'simulation' ) ) {
			dock.hidden = true;
			app.ui.ui.startEl.querySelector( '.tw-start-title' ).textContent = 'SIMULATION ROOM';
		}
	}
	update( dt ) {
		this.interact.enabled = ! this.app.freeCam;
		this.interact.update( dt );
		for ( const d of this.app.village.station.moving.doors ) updateDoor( d, dt );
	}
	place( name ) {
		const a = this.app, p = a.player;
		a.setFreeCam( false ); p.mode = 'walk'; p.busy = false; p.velocity.set( 0, 0, 0 );
		let at;
		if ( name === 'west' || name === 'sea' ) {
			const l = a.terrainData.landing( 'west' ), steps = l.steps.pts;
			// A raised step overlooks the geo without dropping the player into the surf.
			const q = steps[ Math.min( 18, steps.length - 1 ) ];
			p.position.set( q[ 0 ], q[ 1 ] + 0.08, q[ 2 ] );
			const distance = name === 'sea' ? 400 : 25;
			at = new Vector3( l.stage.x + l.dir[ 0 ] * distance, 0.5, l.stage.z + l.dir[ 1 ] * distance );
		} else if ( name === 'room' ) {
			p.position.set( - 5, TOWER.floor, 2 ); at = new Vector3( - 7, TOWER.floor + 1.15, - 1 );
		} else {
			p.position.set( - 10, a.terrainData.heightAt( - 10, 14 ) + 0.05, 14 ); at = new Vector3( 0, TOWER.deck, 0 );
		}
		const dx = at.x - p.position.x, dz = at.z - p.position.z;
		p.yaw = Math.atan2( - dx, - dz ); p.pitch = Math.atan2( at.y - p.position.y - 1.62, Math.hypot( dx, dz ) );
		p.update( 0 ); a.cameraCut();
	}
}
