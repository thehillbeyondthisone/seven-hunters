import './core/BenchSeed.js';
import { App } from './App.js';
import { UI } from './ui/UI.js';
import { AppUI } from './ui/AppUI.js';
import './mobile/mobile.css';

// ?bench runs in background tabs too (automation): rAF does not fire in a hidden page
if ( /[?&]bench\b/.test( location.search ) ) {

	const raf = window.requestAnimationFrame.bind( window ), caf = window.cancelAnimationFrame.bind( window );
	window.requestAnimationFrame = ( cb ) => document.visibilityState === 'hidden' ? setTimeout( () => cb( performance.now() ), 16 ) : raf( cb );
	window.cancelAnimationFrame = ( id ) => ( clearTimeout( id ), caf( id ) );

}

const app = new App();
if ( app.isArrivalAtmosphere ) {
	document.querySelector( '.loader-kicker.sh-only' ).textContent = 'Eilean Mòr · Arrival study';
	document.querySelector( '.loader-tagline.sh-only' ).textContent = 'A wooden boat, a narrow landing, and the sound of company receding across the water.';
}
if ( app.isMobile ) {
	document.documentElement.classList.add( 'is-mobile' );
	document.querySelector( '.loader-tip-list.sh-only' ).innerHTML = `
		<p>Drag on the left to walk and on the right to look. Landscape gives you the clearest view.</p>
		<p>Tools holds your papers, lantern and telescope. The action button names what you can do nearby.</p>
		<p>Hold the action button to light the lamp and wind the machine. Its border shows your progress.</p>
		<p>On the boat, tap Read papers for your packet. Tap Go to landing to finish the crossing, then Step ashore to leave the boat.</p>
		<p>The watch saves in this browser. Pause before putting your phone away.</p>`;
}
const ui = new UI();
window.__ui = ui;

if ( app.qs.has( 'keeperPreview' ) ) {
	document.querySelector( '.loader-kicker.sh-only' ).textContent = 'Eilean Mòr · Keeper’s duties study';
	document.querySelector( '.loader-tagline.sh-only' ).textContent = 'A prepared lamp, the revolving optic, and the weight that drives it. Keep the evening light.';
	document.querySelector( '.loader-tip-list.sh-only' ).innerHTML = app.isMobile ? `
		<p>Drag on the left to walk and on the right to look. Landscape gives you the clearest view.</p>
		<p>Tap the action button to examine the lamp, light the burner and release the clockwork stop. Hold it at the crank to wind.</p>
		<p>Winding raises the driving weight. The brass stop beside the crank starts the optic. The burner supplies the light.</p>
		<p>Listen to the ratchet and watch the apparatus. This study has no completion meter. Tools holds the teaching notes in Papers.</p>` : `
		<p>Use WASD to walk and the mouse to look. E examines the lamp, lights the burner and releases the clockwork stop.</p>
		<p>Hold E at the crank to raise the driving weight. Listen to the ratchet and watch the apparatus; there is no completion meter.</p>
		<p>The flame and the revolving optic do different jobs. Attend to both before leaving the lantern.</p>
		<p>B opens Papers, including teaching notes and the reconstruction boundaries. This study has its own save.</p>`;
}
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

if ( app.qs.has( 'seaDread' ) && app.isWeatherPreview ) {
	document.title = 'The Black Atlantic · Seven Hunters';
	document.querySelector( '.loader-title.sh-only' ).textContent = 'The Black Atlantic';
	document.querySelector( '.loader-kicker.sh-only' ).textContent = 'Eilean Mòr · Above the deep';
	document.querySelector( '.loader-tagline.sh-only' ).textContent = 'A small island. A narrow landing. Water to the horizon, and darkness beneath it.';
	document.querySelector( '.loader-tip-list.sh-only' ).innerHTML = '<p>Face the Atlantic from the landing, or retreat into the workroom.</p><p>Low sea mist, distant lightning and delayed thunder follow the storm. Nearby cliff impacts briefly shake the view.</p><p>Reduced effects turns off camera shake and lightning flashes. Press M to mute sound.</p><p>Click the scene to look · WASD walks · E opens doors · Esc releases the mouse.</p>';
}

if ( app.qs.has( 'simulation' ) ) {
	document.title = 'Simulation room · Seven Hunters';
	document.querySelector( '.loader-title.sh-only' ).textContent = 'Simulation room';
	document.querySelector( '.loader-kicker.sh-only' ).textContent = 'Eilean Mòr · The Atlantic unleashed';
	document.querySelector( '.loader-tagline.sh-only' ).textContent = 'Storms, tsunami surges and underwater explosions in a separate island sandbox.';
	document.querySelector( '.loader-tip-list.sh-only' ).innerHTML = '<p class="loader-tip">Press <kbd>`</kbd> for the debug menu. Equip the minigun, choose weather or launch an extreme event.</p><p class="loader-tip">WASD walks · F flies · E opens doors. Reset weather & events restores the session’s starting conditions.</p><p class="loader-tip">This exploration lab does not open or save a keeper’s watch.</p>';
}

if ( app.qs.has( 'playground' ) ) {
	document.title = 'Keeper’s Playground · Seven Hunters';
	document.querySelector( '.loader-title.sh-only' ).textContent = 'Keeper’s Playground';
	document.querySelector( '.loader-kicker.sh-only' ).textContent = 'Admiralty Experimental Equipment';
	document.querySelector( '.loader-tagline.sh-only' ).textContent = 'Gravity has been temporarily reassigned. The lighthouse has acquired a dance floor.';
	document.querySelector( '.loader-tip-list.sh-only' ).innerHTML = '<p>Click a buoy or supply crate to grab it. Click again to place; Q drops it.</p><p>Hold right click, then release to throw. The wheel changes distance; R turns a held prop.</p><p>G resets the toys. J starts the lighthouse disco. Backtick opens palettes, mist, tempo and the optional synth beat.</p><p>This playground opens no story or watch save. Desktop keyboard and mouse.</p>';
}

app.init( ( p, text, until ) => ui.setLoading( p, text, until ) ).then( async () => {

	app.ui = new AppUI( app, ui );
	if ( app.playground ) {
		ui.startEl.querySelector( '.tw-start-title' ).textContent = 'KEEPER’S PLAYGROUND';
		ui.startEl.querySelector( '.tw-start-cta span:last-child' ).textContent = 'Unpack the questionable equipment';
	}
	if ( ! app.isVRPreview && ! app.qs.has( 'bench' ) ) app.devMenu = new ( await import( './dev/DebugMenu.js' ) ).DebugMenu( app );
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
	if ( app.isMobile ) app.mobile = new ( await import( './mobile/MobileControls.js' ) ).MobileControls( app );
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
		app.mobile?.start();

	} );
	if ( app.story ) app.story.start();
	if ( app.qs.has( 'debug' ) ) app.devMenu?.show();

} ).catch( ( e ) => {

	console.error( e );
	ui.setLoadingError( 'Something went wrong: ' + e.message );

} );
