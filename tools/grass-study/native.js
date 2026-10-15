import '../../src/core/BenchSeed.js';
import { App } from '../../src/App.js';
import { Vector3 } from '../../src/engine/index.js';
import { GPU } from '../../src/engine/gpu/GPU.js';
import { FlannanSward as LegacySward } from '../../src/world/flannan/SwardLegacy.js';

// No Story or Game is created here. No save/settings storage is read or written.
const app = new App(), loading = document.querySelector( '#loading' );
app.qs.set( 'setting', 'flannan' ); app.qs.set( 'nostory', '' ); app.qs.set( 'noAudio', '' ); app.qs.set( 'fly', '' );
const { Setting } = await import( '../../src/sky/Setting.js' ); app.setting = new Setting( 'flannan' );
try {
	await app.init( ( p, text ) => loading.textContent = `${Math.round(p*100)}% · ${text}` );
	const terra = app.sward; let legacy, running = true, revision = 0;
	const settle = async () => {
		const own = ++revision;
		if ( running ) return;
		app.frame( 0 ); await GPU.pipelinesReady();
		for ( let i = 0; i < 64 && ! running && own === revision; i ++ ) {
			app.frame( 0 ); await GPU.queue.onSubmittedWorkDone();
		}
	};
	const view = () => {
		const selected = document.querySelector( '#view' ).value;
		if ( selected === 'approach' ) window.__view( 'fApproach' );
		else if ( selected === 'rock' ) window.__view( 'stoneScatter' );
		else {
			const [ x, z, tx, tz ] = selected === 'path' ? [ -32, 35, -24, 28 ] : [ -44, 48, -38, 43 ];
			const y = app.terrainData.heightAt( x, z ) + 1.62, ty = app.terrainData.heightAt( tx, tz ) + .1;
			const dx = tx - x, dz = tz - z;
			app.setFreeCam( true ); app.fly.setPose( new Vector3( x, y, z ), Math.atan2( -dx, -dz ), Math.atan2( ty - y, Math.hypot( dx, dz ) ) );
			app.fly.velocity.set( 0, 0, 0 ); app.cameraCut();
		}
		app.settings.timeOfDay = Number( document.querySelector( '#light' ).value );
		settle();
	};
	const choose = old => {
		if ( old && ! legacy ) legacy = new LegacySward( { scene: app.scene, terrain: app.terrainData, village: app.village } );
		terra.group.visible = ! old; if ( legacy ) legacy.group.visible = old;
		app.sward = old ? legacy : terra;
		document.querySelector( '#terra' ).setAttribute( 'aria-pressed', String( ! old ) );
		document.querySelector( '#legacy' ).setAttribute( 'aria-pressed', String( old ) );
		app.cameraCut(); settle();
	};
	document.querySelector( '#terra' ).onclick = () => choose( false );
	document.querySelector( '#legacy' ).onclick = () => choose( true );
	document.querySelector( '#view' ).onchange = view; document.querySelector( '#reset' ).onclick = view;
	document.querySelector( '#light' ).onchange = () => { app.settings.timeOfDay = Number( document.querySelector( '#light' ).value ); app.cameraCut(); settle(); };
	document.querySelector( '#pause' ).onclick = e => { running = ! running; e.currentTarget.textContent = running ? 'Pause scene' : 'Resume scene'; if ( running ) app.start(); else app.engine.stop(); };
	document.querySelector( '#collapse' ).onclick = e => { const collapsed = document.querySelector( 'aside' ).classList.toggle( 'collapsed' ); e.currentTarget.textContent = collapsed ? '+' : '−'; e.currentTarget.setAttribute( 'aria-expanded', String( ! collapsed ) ); };
	app.post.autoExposure.snap.value = 1;
	app.engine.domElement.addEventListener( 'pointerdown', () => app.input.requestLock() );
	view(); document.querySelector( 'aside' ).hidden = false; loading.hidden = true; app.start();
	setInterval( () => { const s = app.sward.stats; document.querySelector( '#status' ).textContent = app.sward === terra ? `${s.visibleCells.join(' / ')} cells · ${(s.triangles/1e6).toFixed(2)}M submitted grass triangles` : 'Previous sparse winter grass'; }, 500 );
} catch ( e ) { loading.textContent = `Grass preview could not start: ${e.message}`; console.error( e ); }
