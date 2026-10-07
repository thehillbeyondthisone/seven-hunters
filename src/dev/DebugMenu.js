import { SeaWeather } from '../weather/SeaWeather.js';
import { SEA_WEATHER } from '../weather/SeaWeatherState.js';
import './debug.css';

export class DebugMenu {
	constructor( app ) {
		this.app = app; this.open = false;
		this.panel = document.createElement( 'section' ); this.panel.className = 'sh-debug'; this.panel.hidden = true;
		this.panel.setAttribute( 'role', 'dialog' ); this.panel.setAttribute( 'aria-modal', String( !! app.isMobile ) ); this.panel.setAttribute( 'aria-label', 'Simulation debug menu' );
		this.panel.innerHTML = `<header><strong>Seven Hunters · Debug</strong><button type="button" data-close aria-label="Close debug menu">×</button></header>
		<details class="sh-debug-experiences"><summary>Experiences</summary><nav aria-label="Available experiences">
		<a href="./">Normal watch</a><a href="./?arrivalPreview">Boat arrival</a><a href="./?islandRevealPreview">First look back</a><a href="./?keeperPreview">Keeper duties</a><a href="./?chapterPreview=kitchen">Day two · kitchen</a>
		<details><summary>Later chapters · spoilers</summary><a href="./?chapterPreview=report">Cate’s report</a><a href="./?chapterPreview=remote">West hauling shed</a><a href="./?chapterPreview=return">The walk home</a><a href="./?chapterPreview=after">Next clear evening</a></details>
		<a href="./?nostory">Explore Eilean Mòr</a><a href="./?weatherPreview">The Atlantic Watch</a><a href="./?seaDread&seaWeather=gale">The Black Atlantic</a><a href="./?simulation&seaWeather=settled&debug">Simulation lab</a><a href="./?devWeapons&devTargets">Minigun & buoys</a><a href="./water-preview.html">Water comparison</a><a href="./?setting=tidewater">Tidewater</a>
		<a href="./?playground">Keeper’s Playground · gravity grabber</a><a href="./?playground&disco">Lighthouse disco</a>
		<details><summary>Device previews</summary><a href="./?mobile&arrivalPreview">Touch · boat arrival</a><a href="./?mobile&keeperPreview">Touch · keeper duties</a><a href="./?vr">WebXR exploration</a></details>
		</nav></details>
		<details data-reveal><summary>First look back · edit</summary>
		<a data-reveal-link href="./?setting=flannan&islandRevealPreview">Open editing preview</a>
		<div data-reveal-controls>
		<output data-reveal-clock aria-live="off"></output>
		<div class="sh-debug-grid"><button type="button" data-reveal-replay>Replay from start</button><button type="button" data-reveal-play>Play from mark</button></div>
		<button type="button" data-reveal-pause>Pause</button>
		<label class="sh-debug-row">Scene position · s<input data-reveal-position type="number" min="0" max="28" step="0.1" value="0" aria-label="Scene position in seconds"></label>
		<input data-reveal-scrub type="range" min="0" max="28" step="0.1" value="0" aria-label="Scrub cutscene">
		<label class="sh-debug-row">Replay mark · s<input data-reveal-setting="previewStart" type="number" min="0" max="84" step="0.1" value="0" aria-label="Replay start time in seconds"></label>
		<label class="sh-debug-row">Camera speed · ×<input data-reveal-setting="speed" type="number" min="0.25" max="2" step="0.05" value="0.75" aria-label="Cutscene playback speed"></label>
		<label class="sh-debug-row">Music in-point · s<input data-reveal-setting="musicOffset" type="number" min="0" max="45" step="0.1" value="0" aria-label="Music in-point in seconds"></label>
		<label class="sh-debug-row">Music starts at · s<input data-reveal-setting="musicDelay" type="number" min="0" max="30" step="0.1" value="0" aria-label="Music start time in scene seconds"></label>
		<label class="sh-debug-row">Music level<input data-reveal-setting="gain" type="number" min="0" max="1" step="0.05" value="0.6" aria-label="Cutscene music level"></label>
		<div class="sh-debug-grid"><label class="sh-debug-row">Fade in · s<input data-reveal-setting="fadeIn" type="number" min="0" max="15" step="0.1" value="2.5" aria-label="Music fade-in seconds"></label><label class="sh-debug-row">Out · s<input data-reveal-setting="fadeOut" type="number" min="0" max="15" step="0.1" value="4" aria-label="Music fade-out seconds"></label></div>
		<button type="button" data-reveal-reset>Reset timing & mix</button>
		<p>Scrubbing pauses. Resume plays from that position. Replay uses a separate preview save. Timing & mix are saved in this browser and used by the normal watch.</p>
		</div></details>
		<details data-locations><summary>Locations</summary><div class="sh-debug-grid"><button type="button" data-place="sea">Face the Atlantic</button><button type="button" data-place="west">West landing</button><button type="button" data-place="yard">Station yard</button><button type="button" data-place="room">Inside</button></div></details>
		<details class="sh-debug-weather" open><summary>Weather</summary><label class="sh-debug-row">Condition<select data-weather aria-label="Weather condition"><option value="watch">Authored watch</option></select></label><button type="button" data-cycle>Run weather cycle</button><div data-dread hidden><button type="button" data-dread-toggle>Sea dread: On</button><button type="button" data-reduced>Reduced effects: Off</button><button type="button" data-lightning>Distant lightning</button></div></details>
		<div class="sh-debug-simulation">
		<details open><summary>Extreme sea</summary><label class="sh-debug-row">Crest · m<input data-height-number type="number" min="1" max="250" step="1" value="10" aria-label="Tsunami crest height in metres"></label><input data-height type="range" min="1" max="250" step="1" value="10" aria-label="Tsunami crest height slider"><p>Incoming wave height; terrain determines run-up.</p><div class="sh-debug-grid"><button type="button" data-event="tsunami">Launch tsunami</button><button type="button" data-event="blast">Underwater blast</button></div><button type="button" data-clear>Reset weather & events</button></details>
		<details><summary>Equipment</summary><button type="button" data-gun>Equip minigun</button><button type="button" data-targets>Summon practice buoys</button><p>Hold click / X to fire · F8 holsters · G resets buoys.</p></details>
		</div>
		<details data-playground open><summary>Keeper’s Playground</summary><button type="button" data-grabber>Holster gravity grabber · F9</button><button type="button" data-props>Reset playground props · G</button><button type="button" data-play-yard>Return to station yard</button><p>Click / X grabs or places · Q drops · hold right click / C and release to throw · wheel sets distance · R rotates.</p></details>
		<details data-disco open><summary>Lighthouse disco</summary><button type="button" data-disco-toggle>Start disco · J</button><button type="button" data-disco-view>Watch the light show</button><label class="sh-debug-row">Palette<select data-disco-setting="palette" aria-label="Disco palette"><option value="prism">Prism</option><option value="aurora">Aurora</option><option value="sunset">Sunset</option></select></label><label class="sh-debug-row">Tempo · BPM<input type="number" data-disco-setting="tempo" min="40" max="160" value="112" aria-label="Disco tempo"></label><label class="sh-debug-row">Brightness<input type="range" data-disco-setting="intensity" min="0" max="1" step="0.05" value="0.75" aria-label="Disco brightness"></label><label class="sh-debug-row">Mist<input type="range" data-disco-setting="mist" min="0" max="1" step="0.05" value="0.45" aria-label="Disco mist"></label><button type="button" data-disco-freeze>Freeze lights</button><button type="button" data-disco-music>Synth beat: Off</button><button type="button" data-disco-reduced>Gentle motion: Off</button><p>Colored lighthouse beams, a mirror ball and moving yard lights. Stop disco restores the previous time, mist and lamp. No strobe.</p></details>
		<details><summary>Display & help</summary><button type="button" data-settings>Graphics settings · H</button><button type="button" data-help>Controls · F1</button><button type="button" data-ping>Replay waypoint ping</button><p>WASD walks · F flies · E doors · M sound. Backtick opens this panel; Esc closes it.</p></details>
		<output data-status aria-live="polite"></output>`;
		document.body.append( this.panel );
		this.panel.querySelector( '[data-reveal]' ).open = !! app.qs?.has( 'islandRevealPreview' );
		for ( const el of this.panel.querySelectorAll( '[data-reveal-setting]' ) ) el.onchange = () => {
			const reveal = app.story?.islandReveal;
			if ( ! reveal?.editingPreview || el.value.trim() === '' ) return;
			reveal.configure( { [ el.dataset.revealSetting ]: Number( el.value ) } ); el.value = reveal.settings[ el.dataset.revealSetting ]; this.sync();
		};
		for ( const el of this.panel.querySelectorAll( '[data-reveal-position], [data-reveal-scrub]' ) ) el.oninput = () => {
			if ( el.value.trim() === '' ) return;
			app.story?.islandReveal.seek( Number( el.value ) ); this.sync();
		};
		const playReveal = at => {
			const reveal = app.story?.islandReveal;
			if ( ! reveal?.editingPreview ) return;
			this.close( false );
			if ( reveal.replay( at ) ) app.input.requestLock();
		};
		this.panel.querySelector( '[data-reveal-replay]' ).onclick = () => playReveal( 0 );
		this.panel.querySelector( '[data-reveal-play]' ).onclick = () => playReveal( app.story?.islandReveal.settings.previewStart || 0 );
		this.panel.querySelector( '[data-reveal-pause]' ).onclick = () => {
			const reveal = app.story?.islandReveal;
			if ( ! reveal?.editingPreview ) return;
			if ( ! reveal.active ) { playReveal( reveal.settings.previewStart ); return; }
			reveal.editorPaused = ! reveal.editorPaused;
			if ( reveal.editorPaused ) reveal.music.stop();
			else { this.close( false ); app.input.requestLock(); }
			this.sync();
		};
		this.panel.querySelector( '[data-reveal-reset]' ).onclick = () => { app.story?.islandReveal.resetSettings(); this.sync(); };
		if ( app.isMobile ) {
			this.panel.classList.add( 'sh-debug-touch' );
			for ( const link of this.panel.querySelectorAll( '.sh-debug-experiences a' ) ) {
				const url = new URL( link.getAttribute( 'href' ), location.href );
				if ( url.searchParams.has( 'devWeapons' ) || url.searchParams.has( 'playground' ) ) { link.removeAttribute( 'href' ); link.setAttribute( 'aria-disabled', 'true' ); link.textContent += ' · Desktop only'; }
				else if ( ! url.searchParams.has( 'vr' ) && url.searchParams.get( 'setting' ) !== 'tidewater' && url.pathname.endsWith( '/' ) && ! url.searchParams.has( 'mobile' ) ) { url.searchParams.set( 'mobile', '' ); link.href = url.href; }
			}
		}
		this.panel.querySelector( '[data-close]' ).onclick = () => this.close();
		this.panel.querySelector( '[data-gun]' ).onclick = async () => { this.close( false ); await app.toggleDevArmory(); this.sync(); };
		this.panel.querySelector( '[data-targets]' ).onclick = async () => { if ( ! app.devArmory ) await app.toggleDevArmory(); app.devArmory?.resetTargets(); this.sync(); };
		this.panel.querySelector( '[data-grabber]' ).onclick = () => { if ( app.devArmory?.equipped ) app.devArmory.toggle(); app.playground?.toggle(); this.sync(); };
		this.panel.querySelector( '[data-props]' ).onclick = () => { app.playground?.resetProps(); this.sync(); };
		this.panel.querySelector( '[data-play-yard]' ).onclick = () => { app.playground?.placeYard(); app.playground?.resetProps(); this.close(); };
		this.panel.querySelector( '[data-disco-toggle]' ).onclick = () => { const d = app.playground?.disco; d?.setEnabled( ! d.enabled ); this.sync(); };
		this.panel.querySelector( '[data-disco-view]' ).onclick = () => { app.playground?.watchDisco(); this.close(); };
		for ( const el of this.panel.querySelectorAll( '[data-disco-setting]' ) ) el.oninput = () => { if ( el.value.trim() !== '' ) app.playground?.disco.configure( { [ el.dataset.discoSetting ]: el.value } ); };
		for ( const [ selector, key ] of [ [ '[data-disco-freeze]', 'frozen' ], [ '[data-disco-music]', 'music' ], [ '[data-disco-reduced]', 'reduced' ] ] ) this.panel.querySelector( selector ).onclick = () => { const d = app.playground?.disco; if ( d ) d.configure( { [ key ]: ! d[ key ] } ); this.sync(); };
		const condition = this.panel.querySelector( '[data-weather]' );
		for ( const [ key, preset ] of Object.entries( SEA_WEATHER ) ) { const option = document.createElement( 'option' ); option.value = key; option.textContent = preset.label; condition.append( option ); }
		condition.onchange = () => {
			if ( condition.value === 'watch' ) app.seaWeather?.reset();
			else { if ( ! app.seaWeather ) app.seaWeather = new SeaWeather( app, { preset: condition.value } ); app.seaWeather.select( condition.value ); }
			this.sync();
		};
		this.panel.querySelector( '[data-cycle]' ).onclick = () => {
			if ( ! app.seaWeather ) app.seaWeather = new SeaWeather( app, { preset: 'settled' } );
			if ( ! app.seaWeather.active ) app.seaWeather.select( 'settled' );
			if ( app.seaWeather.model.cycling ) app.seaWeather.model.select( app.seaWeather.model.preset ); else app.seaWeather.model.cycle();
			this.sync();
		};
		for ( const el of this.panel.querySelectorAll( '[data-height], [data-height-number]' ) ) el.oninput = () => {
			const height = app.extremeSea?.setTsunamiHeight( el.value );
			if ( height === undefined ) return;
			for ( const other of this.panel.querySelectorAll( '[data-height], [data-height-number]' ) ) if ( other !== el ) other.value = height;
		};
		for ( const b of this.panel.querySelectorAll( '[data-event]' ) ) b.onclick = () => {
			app.extremeSea?.launch( b.dataset.event ); this.close();
			app.ui.ui.toast( b.dataset.event === 'tsunami' ? `Tsunami launched · ${ app.extremeSea.tsunamiHeight } m incoming crest` : 'Underwater explosion', 3500 );
		};
		this.panel.querySelector( '[data-clear]' ).onclick = () => { app.seaWeather?.reset(); app.extremeSea?.reset(); this.sync(); };
		this.panel.querySelector( '[data-ping]' ).onclick = () => { if ( app.story?.ui ) app.story.ui._guideKey = null; this.close(); };
		for ( const b of this.panel.querySelectorAll( '[data-place]' ) ) b.onclick = () => { app.weatherPreview?.place( b.dataset.place ); this.close(); };
		this.panel.querySelector( '[data-dread-toggle]' ).onclick = () => { app.seaDread?.setEnabled( ! app.seaDread.model.enabled ); this.sync(); };
		this.panel.querySelector( '[data-reduced]' ).onclick = () => { if ( app.seaDread ) app.seaDread.model.reduced = ! app.seaDread.model.reduced; this.sync(); };
		this.panel.querySelector( '[data-lightning]' ).onclick = () => app.seaDread?.strike();
		this.panel.querySelector( '[data-settings]' ).onclick = () => { if ( this.compact ) this.close( false ); app.ui.ui.togglePanel( true ); };
		this.panel.querySelector( '[data-help]' ).onclick = () => { this.close( false ); app.ui.ui.toggleHelp( true ); };
		window.addEventListener( 'keydown', e => {
			if ( e.repeat ) return;
			if ( e.code === 'Backquote' && ! [ 'INPUT', 'TEXTAREA', 'SELECT' ].includes( e.target?.tagName ) ) { e.preventDefault(); e.stopImmediatePropagation(); this.open ? this.close() : this.show(); }
			else if ( this.open && e.code === 'Escape' ) { e.preventDefault(); e.stopImmediatePropagation(); this.close(); }
			else if ( this.open && this.compact && e.code === 'KeyH' && ! [ 'INPUT', 'TEXTAREA', 'SELECT' ].includes( e.target?.tagName ) ) { e.preventDefault(); e.stopImmediatePropagation(); this.close( false ); app.ui.ui.togglePanel( true ); }
			else if ( this.open && this.compact && e.code === 'Tab' ) {
				const focusable = [ ...this.panel.querySelectorAll( 'button:not(:disabled), a[href], summary, input, select' ) ].filter( el => el.getClientRects().length ), first = focusable[ 0 ], last = focusable.at( -1 );
				if ( e.shiftKey && document.activeElement === first ) { e.preventDefault(); last.focus(); }
				else if ( ! e.shiftKey && document.activeElement === last ) { e.preventDefault(); first.focus(); }
			}
		}, true );
		window.addEventListener( 'resize', () => {
			if ( ! this.open ) return;
			this.panel.setAttribute( 'aria-modal', String( this.compact ) );
			if ( this.compact ) app.ui.ui.togglePanel( false );
		} );
		const launcher = document.createElement( 'button' ); launcher.className = 'sh-debug-launch'; launcher.type = 'button'; launcher.textContent = app.isMobile ? 'Experiences' : 'Debug · `'; launcher.onclick = () => this.show();
		launcher.setAttribute( 'aria-label', app.isMobile ? 'Open experiences menu' : 'Open simulation debug menu (backtick)' ); document.body.append( launcher ); this.launcher = launcher;
	}
	get compact() { return this.app.isMobile || window.innerWidth < 660; }
	show() {
		const a = this.app;
		if ( this.open || a.story?.ui.open || a.xr?.active || a.ui.ui.photoMode ) return;
		this.previousFocus = document.activeElement; this.previousEnabled = a.input.enabled;
		if ( this.compact ) a.ui.ui.togglePanel( false );
		a.mobile?.resetGestures(); a.mobile?.setDrawer( false );
		this.panel.setAttribute( 'aria-modal', String( this.compact ) );
		this.open = true; this.panel.hidden = false; a.input.enabled = false; a.input.reset();
		if ( document.pointerLockElement ) document.exitPointerLock();
		this.sync(); this.panel.querySelector( '[data-close]' ).focus();
	}
	close( capture = true ) {
		if ( ! this.open ) return;
		this.open = false; this.panel.hidden = true; this.app.input.reset(); this.app.input.enabled = this.previousEnabled && ! this.app.story?.islandReveal?.active;
		this.previousFocus?.focus?.();
		if ( capture && this.previousEnabled && ! this.app.ui.ui._start && ! this.app.ui.ui.panelOpen ) this.app.input.requestLock();
	}
	sync() {
		const a = this.app, w = a.seaWeather;
		const playground = a.playground, disco = playground?.disco;
		this.panel.querySelector( '[data-playground]' ).hidden = ! playground;
		this.panel.querySelector( '[data-disco]' ).hidden = ! disco;
		if ( playground ) {
			this.panel.querySelector( '[data-grabber]' ).textContent = `${ playground.equipped ? 'Holster' : 'Equip' } gravity grabber · F9`;
			this.panel.querySelector( '[data-disco-toggle]' ).textContent = `${ disco.enabled ? 'Stop' : 'Start' } disco · J`;
			this.panel.querySelector( '[data-disco-freeze]' ).textContent = disco.frozen ? 'Resume lights' : 'Freeze lights';
			this.panel.querySelector( '[data-disco-music]' ).textContent = `Synth beat: ${ disco.music ? 'On' : 'Off' }`;
			this.panel.querySelector( '[data-disco-reduced]' ).textContent = `Gentle motion: ${ disco.reduced ? 'On' : 'Off' }`;
			for ( const el of this.panel.querySelectorAll( '[data-disco-setting]' ) ) if ( document.activeElement !== el ) el.value = disco[ el.dataset.discoSetting ];
		}
		const reveal = a.story?.islandReveal;
		this.panel.querySelector( '[data-reveal]' ).hidden = ! reveal;
		this.panel.querySelector( '[data-reveal-controls]' ).hidden = ! reveal?.editingPreview;
		this.panel.querySelector( '[data-reveal-link]' ).hidden = !! reveal?.editingPreview;
		if ( reveal?.editingPreview ) {
			for ( const el of this.panel.querySelectorAll( '[data-reveal-setting]' ) ) {
				if ( el.dataset.revealSetting === 'previewStart' ) el.max = reveal.duration.toFixed( 2 );
				if ( document.activeElement !== el ) el.value = reveal.settings[ el.dataset.revealSetting ];
			}
			for ( const el of this.panel.querySelectorAll( '[data-reveal-position], [data-reveal-scrub]' ) ) {
				el.max = reveal.duration.toFixed( 2 ); if ( document.activeElement !== el ) el.value = reveal.sceneTime.toFixed( 2 );
			}
			this.panel.querySelector( '[data-reveal-pause]' ).textContent = reveal.editorPaused ? 'Resume from here' : reveal.active ? 'Pause' : 'Play';
			this.panel.querySelector( '[data-reveal-clock]' ).textContent = `Scene ${ reveal.sceneTime.toFixed( 1 ) } / ${ reveal.duration.toFixed( 1 ) } s · Music ${ ( reveal.cueElapsed || 0 ).toFixed( 1 ) } / ${ reveal.music.end.toFixed( 1 ) } s`;
		}
		this.panel.querySelector( '.sh-debug-simulation' ).hidden = ! a.extremeSea;
		this.panel.querySelector( '[data-locations]' ).hidden = ! a.weatherPreview;
		this.panel.querySelector( '[data-gun]' ).textContent = a._loadingArmory ? 'Loading minigun…' : a.devArmory?.equipped ? 'Holster minigun' : 'Equip minigun';
		this.panel.querySelector( '[data-gun]' ).disabled = !! a._loadingArmory;
		this.panel.querySelector( '[data-ping]' ).disabled = ! a.story;
		const condition = this.panel.querySelector( '[data-weather]' ); if ( document.activeElement !== condition ) condition.value = w?.active ? w.model.preset : 'watch';
		this.panel.querySelector( '[data-cycle]' ).textContent = w?.model.cycling ? `Stop cycle · ${ Math.floor( w.model.elapsed ) } / 260 s` : 'Run weather cycle';
		for ( const el of this.panel.querySelectorAll( '[data-height], [data-height-number]' ) ) if ( document.activeElement !== el ) el.value = a.extremeSea?.tsunamiHeight || 10;
		this.panel.querySelector( '[data-dread]' ).hidden = ! a.seaDread;
		if ( a.seaDread ) {
			const m = a.seaDread.model;
			this.panel.querySelector( '[data-dread-toggle]' ).textContent = `Sea dread: ${ m.enabled ? 'On' : 'Off' }`;
			this.panel.querySelector( '[data-reduced]' ).textContent = `Reduced effects: ${ m.reduced ? 'On' : 'Off' }`;
			this.panel.querySelector( '[data-lightning]' ).disabled = ! m.enabled || m.reduced;
		}
		const status = `${ w?.active ? `${ Math.round( w.state.wind ) } m/s · ${ w.state.vis.toFixed( 1 ) } km visibility` : 'Authored watch weather' }${ a.extremeSea?.active ? ` · ${ a.extremeSea.kind === 'tsunami' ? 'Tsunami' : 'Blast' } ${ a.extremeSea.age.toFixed( 0 ) }s` : '' }`;
		const output = this.panel.querySelector( '[data-status]' ); if ( output.textContent !== status ) output.textContent = status;
	}
	update( dt ) {
		this.elapsed = ( this.elapsed || 0 ) + dt;
		if ( this.open && this.elapsed > 0.5 ) { this.elapsed = 0; this.sync(); }
		this.launcher.hidden = this.open || !! this.app.mobile?.paused || !! this.app.ui.ui._start || !! this.app.story?.ui.open || !! this.app.ui.ui.photoMode || !! this.app.story?.islandReveal?.active;
	}
}
