import { mobileAction, stickMotion } from './MobileOptions.js';

const paths = {
	lamp: 'M8 7V5a4 4 0 0 1 8 0v2M7 8h10l1 11H6L7 8Zm-2 13h14M9 4h6M10 10v6m4-6v6',
	scope: 'm4 16 11-9 4 5-11 9-4-5Zm11-9 3-2 4 5-3 2M6 14l-3 2 3 4 3-2',
	papers: 'M5 3h10l4 4v14H5V3Zm10 0v5h4M8 12h8M8 16h6',
	pause: 'M8 5v14M16 5v14',
	hand: 'M8 13V6a2 2 0 0 1 4 0v6-3a2 2 0 0 1 4 0v4-2a2 2 0 0 1 4 0v6c0 4-3 6-6 6-3 0-5-1-7-4l-3-4a2 2 0 0 1 3-2l3 3',
	tools: 'M4 8h16v12H4V8Zm4 0V4h8v4M4 12h16m-10 0v3h4v-3',
	hurry: 'm3 7 5 5-5 5m8-10 5 5-5 5',
	jump: 'M12 20V4m-6 6 6-6 6 6',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ paths[ name ] }"/></svg>`;

// Activate on pointer release so a second finger can use a button while the
// first keeps looking/walking. Ignore the browser's later compatibility click.
export function bindTouchTap( button, activate ) {
	let press = null, lastPointer = -Infinity;
	button.addEventListener( 'pointerdown', event => {
		if ( button.disabled || press || event.button > 0 ) return;
		event.preventDefault(); button.setPointerCapture( event.pointerId );
		press = { id: event.pointerId, x: event.clientX, y: event.clientY, cancelled: false };
	} );
	button.addEventListener( 'pointermove', event => {
		if ( press?.id === event.pointerId && Math.hypot( event.clientX - press.x, event.clientY - press.y ) > 14 ) press.cancelled = true;
	} );
	button.addEventListener( 'pointerup', event => {
		if ( press?.id !== event.pointerId ) return;
		event.preventDefault(); const tap = ! press.cancelled && ! button.disabled;
		press = null; lastPointer = performance.now();
		if ( tap ) activate();
	} );
	for ( const type of [ 'pointercancel', 'lostpointercapture' ] ) button.addEventListener( type, event => {
		if ( press?.id === event.pointerId ) { press = null; lastPointer = performance.now(); }
	} );
	button.addEventListener( 'click', event => {
		if ( button.disabled || performance.now() - lastPointer < 700 ) return;
		activate();
	} );
}

export class MobileControls {
	constructor( app ) {
		this.app = app; this.input = app.input; this.started = false; this.menuOpen = false;
		this.gestures = new Map();
		const root = this.root = document.createElement( 'div' );
		root.className = 'sm-controls'; root.hidden = true;
		root.innerHTML = `
			<div class="sm-zone sm-move" aria-label="Drag on the left to walk"></div>
			<div class="sm-zone sm-look" aria-label="Drag on the right to look"></div>
			<div class="sm-stick" aria-hidden="true"><span></span></div>
			<div class="sm-move-hint"><i></i><strong>Drag to walk</strong><small>Anywhere on the left</small></div>
			<div class="sm-look-hint">— &nbsp; Drag to look &nbsp; —</div>
			<button class="sm-pause-button" aria-label="Pause the watch">${ icon( 'pause' ) }<span>Pause</span></button>
			<div class="sm-actions">
				<button class="sm-papers" aria-label="Read papers">${ icon( 'papers' ) }<span>Read papers</span></button>
				<button class="sm-read" hidden aria-label="Read signal faster"><span>Read on</span></button>
				<button class="sm-action" disabled><span class="sm-progress"></span><span class="sm-action-copy"><span class="sm-action-text">Look at an object</span><small class="sm-action-detail"></small></span><span class="sm-action-arrow" aria-hidden="true">›</span></button>
				<button class="sm-tools" aria-label="Open tools" aria-expanded="false">${ icon( 'tools' ) }<span>Tools</span></button>
			</div>
			<div class="sm-drawer" hidden>
				<button data-tool="lamp" aria-label="Storm lantern" aria-pressed="false">${ icon( 'lamp' ) }<span>Lantern</span></button>
				<button data-tool="scope" aria-label="Telescope" aria-pressed="false">${ icon( 'scope' ) }<span>Telescope</span></button>
				<button data-tool="papers" aria-label="Read your papers">${ icon( 'papers' ) }<span>Papers</span></button>
				<button data-tool="hurry" aria-label="Hurry" aria-pressed="false">${ icon( 'hurry' ) }<span>Hurry</span></button>
				<button data-tool="jump" aria-label="Jump">${ icon( 'jump' ) }<span>Jump</span></button>
				<button data-tool="read" aria-label="Read signal faster" hidden>${ icon( 'hurry' ) }<span>Read on</span></button>
			</div>`;
		document.body.append( root );
		this.actionButton = root.querySelector( '.sm-action' );
		this.actionText = root.querySelector( '.sm-action-text' );
		this.actionDetail = root.querySelector( '.sm-action-detail' );
		this.papersButton = root.querySelector( '.sm-papers' );
		this.readButton = root.querySelector( '.sm-read' );
		this.stick = root.querySelector( '.sm-stick' );
		this.stickThumb = this.stick.firstElementChild;
		this.drawer = root.querySelector( '.sm-drawer' );
		this.toolsButton = root.querySelector( '.sm-tools' );
		bindTouchTap( this.toolsButton, () => this.setDrawer( this.drawer.hidden ) );
		bindTouchTap( this.papersButton, () => this.useTool( 'papers' ) );
		bindTouchTap( this.readButton, () => this.useTool( 'read' ) );
		bindTouchTap( root.querySelector( '.sm-pause-button' ), () => this.pause( true ) );
		this.bindZone( root.querySelector( '.sm-move' ), 'move' );
		this.bindZone( root.querySelector( '.sm-look' ), 'look' );
		this.actionButton.addEventListener( 'pointerdown', event => {
			if ( ! this.available || ! this.action?.hold || this.holdPointer != null ) return;
			event.preventDefault(); this.actionButton.setPointerCapture( event.pointerId );
			this.holdPointer = event.pointerId; this.holdTarget = this.action.target;
			this.input.setTouchKey( this.action.key, true ); this.resumeAudio();
		} );
		for ( const type of [ 'pointerup', 'pointercancel', 'lostpointercapture' ] ) this.actionButton.addEventListener( type, event => { if ( event.pointerId === this.holdPointer ) this.releaseHold(); } );
		bindTouchTap( this.actionButton, () => {
			if ( ! this.available || this.action?.hold ) return;
			this.resumeAudio();
			if ( this.action.kind === 'landing' || this.action.kind === 'leave' ) app.story.mobileCommand( this.action.kind );
			else if ( ! this.action.disabled ) this.input.tapKey( this.action.key );
		} );
		root.querySelectorAll( '[data-tool]' ).forEach( button => bindTouchTap( button, () => this.useTool( button.dataset.tool ) ) );
		root.addEventListener( 'pointerdown', () => this.resumeAudio() );
		this.buildPause();
		window.addEventListener( 'blur', () => { this.resetGestures(); if ( this.started ) this.pause( true ); } );
		window.addEventListener( 'resize', () => this.resetGestures() );
		document.addEventListener( 'visibilitychange', () => {
			this.resetGestures();
			if ( document.hidden && this.started ) this.pause( true );
		} );
		// The start overlay remains a real user gesture for Web Audio.
		const ui = app.ui.ui;
		ui.startEl.querySelector( '.tw-start-cta span:last-child' ).textContent = 'Tap to begin';
		ui.startEl.querySelector( '.tw-start-keys' ).textContent = 'Left thumb to walk · Right thumb to look · Tools for your equipment';
		ui.startEl.querySelector( '.tw-start-cta svg' ).outerHTML = icon( 'hand' ).replace( '<svg ', '<svg class="tw-ico" ' );
		// Keep the shared graphics panel usable without keyboard-only exits.
		ui.panel.querySelector( '[aria-label="Photo mode (P)"]' ).hidden = true;
		for ( const [ old, label ] of [ [ 'Controls (F1)', 'Touch controls' ], [ 'Collapse (H)', 'Close settings' ] ] ) {
			const button = ui.panel.querySelector( `[aria-label="${ old }"]` );
			button.setAttribute( 'aria-label', label ); button.dataset.tip = label;
		}
		ui.panel.querySelector( '.tw-panel-foot' ).hidden = true;
		ui.helpEl.querySelector( '.tw-help-head p' ).textContent = 'Your thumbs control the watch. Landscape gives you the clearest view.';
		ui.helpEl.querySelector( '.tw-help-grid' ).innerHTML = `<section><h3>Move</h3><p>Drag anywhere on the left to walk. Drag on the right to look. Use both thumbs together.</p></section>
			<section><h3>Interact</h3><p>Look at an object to reveal its action. Hold the button to light or wind; release to stop.</p></section>
			<section><h3>Leave the boat</h3><p>Tap Read papers to open your packet. Tap Go to landing to finish the crossing, then Step ashore to leave the boat. You can also wait for the boat to arrive.</p></section>
			<section><h3>Tools</h3><p>Open Tools for your papers, lantern, telescope, Hurry and Jump. Tap Telescope again to lower it.</p></section>`;
		ui.helpEl.querySelector( '.tw-help-guide span' ).textContent = 'Light the lamp at sunset, keep the machine wound, answer Gallan Head when the air is clear, and write up the journal in the morning. Tap Read on to speed up signals.';
		ui.helpEl.querySelector( '.tw-help-close' ).dataset.tip = 'Close controls';
	}

	start() { this.started = true; }
	resumeAudio() { this.app.audio?.resume(); }
	get paused() { const ui = this.app.ui.ui; return this.menuOpen || !! this.app.devMenu?.open || ui.panelOpen || ! ui.helpEl.hidden; }
	get available() { const s = this.app.story; return this.started && ! this.paused && ! s?.paused && ! s?.ui.open && ! s?.islandReveal?.active && s?.beat !== 'intro' && s?.beat !== 'end' && ! this.app.ui.ui.photoMode; }

	setDrawer( open ) {
		this.drawer.hidden = ! open;
		this.toolsButton.setAttribute( 'aria-expanded', String( open ) );
		if ( open ) this.resetGestures( false );
	}

	bindZone( zone, kind ) {
		zone.addEventListener( 'pointerdown', event => {
			if ( ! this.available || ! this.input.enabled || this.app.story?.aboard && kind === 'move' ) return;
			if ( [ ...this.gestures.values() ].some( g => g.kind === kind ) ) return;
			event.preventDefault(); zone.setPointerCapture( event.pointerId ); this.setDrawer( false );
			this.gestures.set( event.pointerId, { kind, x: event.clientX, y: event.clientY } );
			this.root.querySelector( kind === 'move' ? '.sm-move-hint' : '.sm-look-hint' ).classList.add( 'is-dismissed' );
			if ( kind === 'move' ) {
				this.stick.style.left = `${ event.clientX }px`; this.stick.style.top = `${ event.clientY }px`;
				this.stick.classList.add( 'is-moving' );
			}
		} );
		zone.addEventListener( 'pointermove', event => {
			const g = this.gestures.get( event.pointerId ); if ( ! g || ! this.input.enabled ) return;
			event.preventDefault();
			if ( g.kind === 'move' ) {
				const move = stickMotion( event.clientX - g.x, event.clientY - g.y );
				this.input.setTouchMove( move.x, move.y ); this.stickThumb.style.transform = `translate(${ move.px }px,${ move.py }px)`;
			} else {
				this.input.look.x += ( event.clientX - g.x ) * 1.65;
				this.input.look.y += ( event.clientY - g.y ) * 1.65;
				g.x = event.clientX; g.y = event.clientY;
			}
		} );
		for ( const type of [ 'pointerup', 'pointercancel', 'lostpointercapture' ] ) zone.addEventListener( type, event => {
			const g = this.gestures.get( event.pointerId ); this.gestures.delete( event.pointerId );
			if ( g?.kind === 'move' ) { this.input.setTouchMove( 0, 0 ); this.stick.classList.remove( 'is-moving' ); this.stickThumb.style.transform = ''; }
		} );
	}

	releaseHold() { this.input.setTouchKey( 'KeyE', false ); this.holdPointer = null; this.holdTarget = null; }
	resetGestures( all = true ) {
		this.gestures.clear(); this.stick.classList.remove( 'is-moving' ); this.stickThumb.style.transform = '';
		this.input.setTouchMove( 0, 0 ); this.releaseHold();
		if ( all ) this.input.resetTouch();
	}

	useTool( tool ) {
		if ( ! this.available ) return;
		const app = this.app;
		if ( tool === 'papers' ) app.story?.mobileCommand( 'papers' );
		if ( tool === 'read' ) app.story?.mobileCommand( 'read' );
		if ( tool === 'lamp' ) this.input.tapKey( 'KeyL' );
		if ( tool === 'scope' ) this.input.touchScope = ! this.input.touchScope;
		if ( tool === 'hurry' ) this.input.setTouchKey( 'ShiftLeft', ! this.input.touchKeys.has( 'ShiftLeft' ) );
		if ( tool === 'jump' ) this.input.tapKey( 'Space' );
		this.setDrawer( false ); this.resumeAudio();
	}

	buildPause() {
		const menu = this.menu = document.createElement( 'div' ); menu.className = 'sm-pause'; menu.hidden = true;
		menu.setAttribute( 'role', 'dialog' ); menu.setAttribute( 'aria-modal', 'true' ); menu.setAttribute( 'aria-label', 'Watch paused' );
		menu.innerHTML = `<section><div class="sm-menu-kicker">SEVEN HUNTERS</div><h2>The watch is paused.</h2>
			<p>On the boat, tap Go to landing, then Step ashore. Read papers opens your packet. Ashore, drag on the left to walk and on the right to look. Tools holds your equipment.</p>
			<button data-menu="resume">Return to the watch</button><button data-menu="experiences">Experiences</button><button data-menu="sound">Sound</button><button data-menu="graphics">Graphics settings</button>
			<small>Landscape gives you the clearest view.</small></section>`;
		document.body.append( menu );
		menu.querySelector( '[data-menu="resume"]' ).addEventListener( 'click', () => { this.pause( false ); this.resumeAudio(); } );
		menu.querySelector( '[data-menu="experiences"]' ).addEventListener( 'click', () => { this.pause( false ); this.app.devMenu?.show(); } );
		menu.querySelector( '[data-menu="sound"]' ).addEventListener( 'click', () => { const audio = this.app.audio; if ( audio ) audio.setMuted( ! audio.muted ); this.refreshSound(); } );
		menu.querySelector( '[data-menu="graphics"]' ).addEventListener( 'click', () => { this.pause( false ); this.app.ui.ui.togglePanel( true ); } );
		menu.addEventListener( 'keydown', event => { if ( event.key === 'Escape' ) this.pause( false ); } );
	}
	refreshSound() { const audio = this.app.audio; const b = this.menu.querySelector( '[data-menu="sound"]' ); b.textContent = audio?.muted ? 'Turn sound on' : 'Mute sound'; b.disabled = ! audio; }
	pause( open ) {
		this.menuOpen = open; this.menu.hidden = ! open; this.resetGestures(); this.setDrawer( false );
		if ( open ) {
			const story = this.app.story;
			if ( story && story.beat !== 'intro' && story.beat !== 'end' ) story.save();
			this.refreshSound(); this.menu.querySelector( '[data-menu="resume"]' ).focus();
		}
	}

	beforeFrame() {
		if ( this.paused ) {
			this.input.enabled = false; this.blockedInput = true;
			this.app.player.velocity.x = this.app.player.velocity.z = 0;
		} else if ( this.blockedInput ) {
			this.blockedInput = false;
			const s = this.app.story;
			if ( ! s?.ui.open && ! s?.signal && ! s?.paused ) this.input.enabled = true;
		}
	}

	update() {
		const show = this.available;
		if ( ! show && ! this.root.hidden ) { this.resetGestures(); this.setDrawer( false ); }
		this.root.hidden = ! show;
		if ( ! show ) return;
		const app = this.app, s = app.story;
		this.root.classList.toggle( 'is-aboard', !! s?.aboard );
		this.root.classList.toggle( 'is-signalling', !! s?.signal );
		this.papersButton.hidden = ! s?.aboard;
		this.readButton.hidden = ! s?.signal;
		this.toolsButton.hidden = !! s?.aboard || !! s?.signal;
		this.action = mobileAction( app );
		if ( this.holdPointer != null && ( ! this.action.hold || this.action.target !== this.holdTarget ) ) this.releaseHold();
		this.actionText.textContent = this.action.label;
		this.actionDetail.textContent = this.action.detail || '';
		this.actionButton.setAttribute( 'aria-label', this.action.label );
		this.actionButton.disabled = !! this.action.disabled;
		this.actionButton.style.setProperty( '--progress', `${ Math.max( 0, Math.min( 1, this.action.progress || 0 ) ) * 360 }deg` );
		for ( const button of this.root.querySelectorAll( '[data-tool]' ) ) {
			const t = button.dataset.tool;
			button.disabled = t === 'lamp' ? ! app.handLamp?.carried || !! s?.aboard || !! s?.signal
				: t === 'scope' ? ! s?.hasTelescope || !! s?.signal : t === 'hurry' || t === 'jump' ? !! s?.aboard || !! s?.signal
					: t === 'papers' ? !! s?.signal : false;
			if ( t === 'hurry' && s?.islandReveal?.quietWalk ) button.disabled = true;
			if ( t === 'read' ) button.hidden = ! s?.signal;
			if ( [ 'lamp', 'scope', 'hurry' ].includes( t ) ) button.setAttribute( 'aria-pressed', String( t === 'lamp' ? !! app.handLamp?.lit : t === 'scope' ? !! this.input.touchScope : this.input.touchKeys.has( 'ShiftLeft' ) ) );
		}
	}
}
