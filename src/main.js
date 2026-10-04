import './core/BenchSeed.js';
import { App } from './App.js';
import { UI } from './ui/UI.js';
import { AppUI } from './ui/AppUI.js';

// ?bench runs in background tabs too (automation): rAF does not fire in a hidden page
if ( /[?&]bench\b/.test( location.search ) ) {

	const raf = window.requestAnimationFrame.bind( window ), caf = window.cancelAnimationFrame.bind( window );
	window.requestAnimationFrame = ( cb ) => document.visibilityState === 'hidden' ? setTimeout( () => cb( performance.now() ), 16 ) : raf( cb );
	window.cancelAnimationFrame = ( id ) => ( clearTimeout( id ), caf( id ) );

}

const ui = new UI();
const app = new App();
window.__ui = ui;

if ( app.isWeatherPreview ) {

	document.title = 'The Atlantic Watch · Seven Hunters';
	document.querySelector( '.loader-title.sh-only' ).textContent = 'The Atlantic Watch';
	document.querySelector( '.loader-kicker.sh-only' ).textContent = 'Eilean Mòr · Sea and weather';
	document.querySelector( '.loader-tagline.sh-only' ).textContent = 'Keep watch above the west landing as the Atlantic rises, breaks against the cliffs and eases again.';
	document.querySelector( '.loader-tip-list.sh-only' ).innerHTML = `
		<p class="loader-tip">Choose settled weather, rising seas, the gale or the easing squall.</p>
		<p class="loader-tip">Swell takes longer to ease than the wind; wet stone dries slowly after rain.</p>
		<p class="loader-tip">Click the scene to look. Use <kbd>WASD</kbd> to walk and <kbd>Esc</kbd> to release the mouse.</p>
		<p class="loader-tip">Use the location buttons to visit the west landing, the station yard and the sheltered workroom.</p>
		<p class="loader-tip">Press <kbd>E</kbd> to open doors and <kbd>M</kbd> to mute sound.</p>
		<p class="loader-tip">The weather cycle rises from settled conditions to a gale, then eases over four minutes and twenty seconds.</p>`;

}

app.init( ( p, text, until ) => ui.setLoading( p, text, until ) ).then( async () => {

	app.ui = new AppUI( app, ui );
	// the first night on Eilean Mòr (the demo): not in the benchmark or the review shots, nor with ?nostory
	const story = app.flannan && ! app.qs.has( 'bench' ) && ! app.qs.has( 'nostory' );
	if ( story ) {

		app.story = new ( await import( './story/Story.js' ) ).Story( app );
		app.story.sound = app.stationSound;

	}
	ui.setLoading( 1, 'Ready' );
	await ui.hideLoader();
	if ( app.qs.has( 'vr' ) && ! app.qs.has( 'bench' ) ) {

		await import( './xr/preview.css' );
		app.xr = new ( await import( './xr/XRPreview.js' ) ).XRPreview( app, ui );
		app.start();
		return;

	}
	if ( app.isWeatherPreview && ! app.qs.has( 'bench' ) ) app.weatherPreview = new ( await import( './weather/WeatherPreview.js' ) ).WeatherPreview( app );
	// frame-time benchmark and reference shots (see core/Bench.js): it drives the frames itself
	if ( app.qs.has( 'bench' ) ) ( await import( './core/Bench.js' ) ).startBench( app );
	else {
		if ( ! story && app.qs.has( 'view' ) ) window.__view( app.qs.get( 'view' ) );
		app.start();
	}
	await ui.showStartOverlay( () => {

		app.input.requestLock();
		if ( app.audio ) app.audio.resume();

	} );
	if ( app.story ) app.story.start();

} ).catch( ( e ) => {

	console.error( e );
	ui.setLoadingError( 'Something went wrong: ' + e.message );

} );
