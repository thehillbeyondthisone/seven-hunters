
// The story's screens over the game (src/story/Story.js): dated cards, the objective and the clock, paper
// pages (letters, the code book, the observation slate, the journal), the Morse strip and the telescope.
// Modal pages free the mouse and stop the walker; closing one (a click, which is a user gesture) captures
// the mouse again.
//
//   await ui.card( lines, { kicker } )                 full-screen card, click / Space to go on
//   ui.setObjective( text ), ui.setClock( text )
//   await ui.read( { title, body } )
//   await ui.choose( { title, intro, options: [ { label, sub, value } ] } ) -> value
//   await ui.form( { title, intro, fields: [ { key, label, options } ] } ) -> { key: value }
//   ui.strip( { from, text, hint } | null )
//   ui.telescope( 0..1 )
//   await ui.fade( text )                             a time skip
//   await ui.journal( { heading, rows, remarks, footer } )

import { projectGuidance } from './Guidance.js';
import { touchInstruction } from '../mobile/MobileOptions.js';

const el = ( tag, cls, text ) => {

	const e = document.createElement( tag );
	if ( cls ) e.className = cls;
	if ( text !== undefined ) e.textContent = text;
	return e;

};

// A paper deck uses CSS columns as real sheets. The browser fragments prose at
// line boundaries, so resizing never drops words, shrinks type or needs a scrollbar.
// The original controls stay alive in the flow; choices and entered values survive
// page turns. Only the current sheet participates in keyboard focus.
function paperDeck( page, onTurn = () => {} ) {
	if ( ! page.getBoundingClientRect().width ) return null; // inert Node renderer
	page._paper?.destroy();
	const source = [ ...page.children ];
	const heading = source.find( node => node.classList.contains( 'sh-page-title' ) );
	const actions = source.filter( node => node.matches( 'button.sh-btn, button.sh-reader-close, .sh-paper-actions' ) );
	const windowEl = el( 'div', 'sh-sheet-window' );
	const flow = el( 'div', 'sh-sheet-flow' );
	const footer = el( 'div', 'sh-sheet-actions' );
	const pager = el( 'nav', 'sh-sheet-pager' ); pager.setAttribute( 'aria-label', 'Paper sheets' );
	const previous = el( 'button', 'sh-btn is-quiet', 'Previous sheet' );
	const label = el( 'span', 'sh-sheet-count' ); label.setAttribute( 'aria-live', 'polite' );
	const next = el( 'button', 'sh-btn is-quiet', 'Next sheet' );
	pager.append( previous, label, next );
	for ( const node of source ) {
		if ( node === heading ) continue;
		( actions.includes( node ) ? footer : flow ).append( node );
	}
	windowEl.append( flow );
	page.replaceChildren( ...( heading ? [ heading ] : [] ), windowEl, pager, ...( actions.length ? [ footer ] : [] ) );
	page.classList.add( 'sh-paged' );
	let index = 0, count = 1, frame = 0, dead = false;
	const refresh = () => {
		frame = 0;
		if ( dead || ! page.isConnected ) return;
		const width = windowEl.clientWidth, height = windowEl.clientHeight;
		if ( ! width || ! height ) return;
		flow.style.setProperty( '--sh-sheet-space', `${ height }px` );
		flow.style.columnWidth = `${ width }px`;
		// Columns may contain subpixel widths. Round to the nearest page after
		// subtracting a one-pixel tolerance, rather than creating a blank last sheet.
		count = Math.max( 1, Math.ceil( ( flow.scrollWidth + 40 - 1 ) / ( width + 40 ) ) );
		index = Math.min( index, count - 1 );
		show( index, false );
	};
	const schedule = () => { if ( ! frame && ! dead ) frame = requestAnimationFrame( refresh ); };
	const show = ( n, focus = true ) => {
		index = Math.max( 0, Math.min( count - 1, n ) );
		flow.style.transform = `translateX(${ -index * ( windowEl.clientWidth + 40 ) }px)`;
		previous.disabled = index === 0; next.disabled = index === count - 1;
		label.textContent = `Sheet ${ index + 1 } of ${ count }`;
		page.dataset.sheet = String( index + 1 ); page.dataset.sheets = String( count );
		if ( focus ) { page.focus( { preventScroll: true } ); onTurn(); }
	};
	const visible = node => {
		if ( node.closest( '[hidden]' ) || ! node.getClientRects().length ) return false;
		if ( ! flow.contains( node ) ) return true;
		const bounds = windowEl.getBoundingClientRect();
		return [ ...node.getClientRects() ].some( r => r.right > bounds.left + 1 && r.left < bounds.right - 1 && r.bottom > bounds.top && r.top < bounds.bottom );
	};
	const focus = e => {
		if ( ! flow.contains( e.target ) || visible( e.target ) ) return;
		const r = e.target.getBoundingClientRect(), bounds = windowEl.getBoundingClientRect();
		show( index + Math.round( ( r.left - bounds.left ) / ( bounds.width + 40 ) ), false );
	};
	const key = e => {
		if ( e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.( 'input, select, textarea, [contenteditable=true]' ) ) return;
		const direction = [ 'ArrowRight', 'PageDown' ].includes( e.code ) ? 1 : [ 'ArrowLeft', 'PageUp' ].includes( e.code ) ? -1 : 0;
		if ( ! direction ) return;
		e.preventDefault(); e.stopPropagation(); show( index + direction );
	};
	previous.addEventListener( 'click', () => show( index - 1 ) );
	next.addEventListener( 'click', () => show( index + 1 ) );
	page.addEventListener( 'keydown', key ); page.addEventListener( 'focusin', focus );
	// Details, packet chapters, confirmation states and loaded images can all
	// change the number of sheets without replacing their interactive elements.
	const mutations = new MutationObserver( schedule );
	mutations.observe( flow, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [ 'hidden', 'open' ] } );
	const resize = new ResizeObserver( schedule ); resize.observe( windowEl );
	flow.addEventListener( 'load', schedule, true ); flow.addEventListener( 'toggle', schedule, true );
	window.addEventListener( 'resize', schedule ); window.visualViewport?.addEventListener( 'resize', schedule );
	document.fonts?.ready.then( schedule );
	const deck = {
		visible, refresh: schedule, first: () => show( 0, false ),
		destroy() {
			dead = true; cancelAnimationFrame( frame ); mutations.disconnect(); resize.disconnect();
			window.removeEventListener( 'resize', schedule ); window.visualViewport?.removeEventListener( 'resize', schedule );
			page.removeEventListener( 'keydown', key ); page.removeEventListener( 'focusin', focus );
			flow.removeEventListener( 'load', schedule, true ); flow.removeEventListener( 'toggle', schedule, true );
		},
	};
	page._paper = deck; refresh();
	return deck;
}

export class StoryUI {

	constructor( { input = null } = {} ) {

		this.input = input;
		document.body.classList.add( 'sh-game' );
		this.root = el( 'div', 'sh-root' );
		this.objective = el( 'div', 'sh-objective' );
		this.clockEl = el( 'div', 'sh-clock' );
		this.goalEl = el( 'div', 'sh-goal' );
		this.objective.append( this.clockEl, this.goalEl );
		this.vignette = el( 'div', 'sh-telescope' );
		this.stripEl = el( 'div', 'sh-strip' );
		this.arrivalEl = el( 'div', 'sh-arrival' );
		this.arrivalFrom = el( 'div', 'sh-arrival-from' );
		this.arrivalText = el( 'div', 'sh-arrival-text' );
		this.arrivalText.setAttribute( 'aria-live', 'polite' );
		this.arrivalText.setAttribute( 'aria-atomic', 'true' );
		this.arrivalHint = el( 'div', 'sh-arrival-hint' );
		this.arrivalEl.append( this.arrivalFrom, this.arrivalText, this.arrivalHint );
		this.revealSkip = el( 'button', 'sh-reveal-skip', 'Continue · Esc' );
		this.revealSkip.hidden = true;
		this.revealSkip.addEventListener( 'click', () => this.onRevealSkip?.() );
		this.layer = el( 'div', 'sh-layer' );
		this.pickupGuide = {};
		for ( const guide of [ this, this.pickupGuide ] ) {
			guide.guideEl = el( 'div', 'sh-guidance' );
			guide.guideEl.setAttribute( 'aria-hidden', 'true' );
			guide.guideMark = el( 'span', 'sh-guide-mark' );
			guide.guidePulse = el( 'span', 'sh-guide-pulse' );
			guide.guidePulse.innerHTML = '<i></i><i></i><b></b>';
			guide.guideArrow = el( 'span', 'sh-guide-arrow' );
			guide.guideArrow.innerHTML = '<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M14 3 L25 23 L14 18 L3 23 Z" fill="currentColor" stroke="#142029" stroke-width="2.5" stroke-linejoin="round"/></svg>';
			guide.guideLabel = el( 'span', 'sh-guide-label' );
			guide.guideEl.append( guide.guidePulse, guide.guideMark, guide.guideArrow, guide.guideLabel );
		}
		this.safetyEl = el( 'div', 'sh-safety' ); this.safetyEl.hidden = true; this.safetyEl.setAttribute( 'role', 'status' );
		this.root.append( this.vignette, this.objective, this.guideEl, this.pickupGuide.guideEl, this.stripEl, this.arrivalEl, this.layer, this.revealSkip );
		this.root.append( this.safetyEl );
		document.body.append( this.root );
		this.modal = 0;

	}

	// ---- modal plumbing
	safety( text ) {
		const copy = this.input?.touchMode ? touchInstruction( text || '' ) : text || '';
		if ( this.safetyEl.textContent !== copy ) this.safetyEl.textContent = copy;
		this.safetyEl.hidden = ! copy;
	}

	_open() {

		if ( ! this.modal ) this._inputWasEnabled = this.input?.enabled;
		this.modal ++;
		this.root.classList.add( 'is-modal' );
		this.objective.setAttribute( 'aria-hidden', 'true' );
		if ( document.exitPointerLock && document.pointerLockElement ) document.exitPointerLock();
		if ( this.input ) this.input.enabled = false;
		this.input?.reset?.();

	}

	_close() {

		this.modal = Math.max( 0, this.modal - 1 );
		if ( this.modal ) return;
		this.root.classList.remove( 'is-modal' );
		this.objective.removeAttribute( 'aria-hidden' );
		if ( this.input ) {

			this.input.enabled = this._inputWasEnabled !== false;
			this.input.keys.clear();
			if ( this.input.enabled ) this.input.requestLock();

		}

	}

	get open() {

		return this.modal > 0;

	}

	// a page on the layer; resolves with what done( value ) is given
	_page( build, { dismiss = true, cls = '', dismissKeys = [ 'Escape', 'KeyE', 'Enter' ], trapFocus = true, focusSelector = 'button:not(:disabled), summary, a[href], select, input' } = {} ) {

		return new Promise( ( resolve ) => {

			this._open();
			const wrap = el( 'div', 'sh-page-wrap ' + cls );
			const page = el( 'div', 'sh-page' );
			page.tabIndex = -1; page.setAttribute( 'role', 'dialog' ); page.setAttribute( 'aria-modal', 'true' );
			wrap.append( page );
			let settled = false;
			const done = ( v ) => {

				if ( settled ) return;
				settled = true;
				page._paper?.destroy();
				page._archiveResize?.disconnect();
				wrap.inert = true;
				window.removeEventListener( 'keydown', key, true );
				wrap.classList.remove( 'is-on' );
				setTimeout( () => wrap.remove(), 350 );
				this._close();
				resolve( v );

			};

			const key = ( e ) => {

				if ( trapFocus && e.code === 'Tab' ) {
					const buttons = [ ...page.querySelectorAll( focusSelector ) ].filter( b => ! b.closest( '[hidden]' ) && ( ! page._paper || page._paper.visible( b ) ) );
					const i = buttons.indexOf( document.activeElement );
					e.preventDefault();
					e.stopImmediatePropagation();
					buttons[ ( i + ( e.shiftKey ? -1 : 1 ) + buttons.length ) % buttons.length ]?.focus();
					return;
				}
				if ( ! e.repeat && dismiss && dismissKeys.includes( e.code ) && ( e.code === 'Escape' || ! e.target.closest?.( 'button, summary, a, input, select' ) ) ) {

					e.preventDefault();
					e.stopPropagation();
					done( null );

				}

			};

			build( page, done );
			window.addEventListener( 'keydown', key, true );
			this.layer.append( wrap );
			paperDeck( page, () => this.onPaper?.( { kind: 'turn' } ) );
			this.onPaper?.( { kind: 'open', title: page.getAttribute( 'aria-label' ) || page.querySelector( 'h1, h2' )?.textContent || '' } );
			void wrap.offsetWidth;
			wrap.classList.add( 'is-on' );
			if ( trapFocus ) [ ...page.querySelectorAll( 'button:not(:disabled)' ) ].find( b => ! page._paper || page._paper.visible( b ) )?.focus( { preventScroll: true } );

		} );

	}

	// A compact existing panel can opt into the same no-scroll sheets.
	paperPanel( container ) {
		return container ? paperDeck( container, () => this.onPaper?.( { kind: 'turn' } ) ) : null;
	}

	// ---- cards

	card( lines, { kicker = '', title = '', wait = 0 } = {} ) {

		return new Promise( ( resolve ) => {

			this._open();
			const c = el( 'div', 'sh-card' );
			if ( kicker ) c.append( el( 'div', 'sh-card-kicker', kicker ) );
			if ( title ) c.append( el( 'div', 'sh-card-title', title ) );
			for ( const l of lines ) c.append( el( 'p', 'sh-card-line', l ) );
			const more = el( 'button', 'sh-card-more', this.input?.touchMode ? 'Tap to continue' : 'Click to continue' );
			more.type = 'button';
			more.setAttribute( 'aria-label', 'Continue' );
			c.append( more );
			this.layer.append( c );
			void c.offsetWidth;
			c.classList.add( 'is-on' );
			const t0 = performance.now();
			let closed = false;
			const go = ( e ) => {

				if ( closed ) return;
				if ( performance.now() - t0 < 600 + wait ) return;
				if ( e.type === 'keydown' && e.code !== 'Space' && e.code !== 'Enter' ) return;
				if ( e.type === 'keydown' ) {

					e.preventDefault();
					e.stopPropagation();

				}

				closed = true;
				c.inert = true;
				c.removeEventListener( 'click', go );
				window.removeEventListener( 'keydown', go, true );
				c.classList.remove( 'is-on' );
				setTimeout( () => c.remove(), 900 );
				this._close();
				resolve();

			};

			c.addEventListener( 'click', go );
			window.addEventListener( 'keydown', go, true );
			more.focus( { preventScroll: true } );

		} );

	}

	// a short black-out (a skip of the clock): resolves when it is fully dark, then fades back in
	fade( text = '', hold = 1600, ready = null ) {

		return new Promise( ( resolve, reject ) => {

			const f = el( 'div', 'sh-fade' );
			if ( text ) f.append( el( 'p', 'sh-fade-text', text ) );
			this.layer.append( f );
			void f.offsetWidth;
			f.classList.add( 'is-on' );
			setTimeout( () => {

				Promise.resolve().then( () => ready?.() ).then( () => {
					resolve();
					setTimeout( () => {

						f.classList.remove( 'is-on' );
						setTimeout( () => f.remove(), 1200 );

					}, hold );
				}, error => { f.remove(); reject( error ); } );

			}, 900 );

		} );

	}

	// Short real tread paths at either end, with the long middle climb hidden.
	// Quintic fades have zero speed/acceleration at the ends, avoiding a snap
	// when handing the camera back to walking.
	async travel( text, move, animate = () => {} ) {

		this._open();
		const f = el( 'div', 'sh-fade' );
		f.style.transition = 'none';
		f.style.background = '#000';
		f.style.opacity = '0';
		const words = el( 'p', 'sh-fade-text', text );
		words.style.opacity = '0';
		words.style.transition = 'opacity .12s ease';
		f.setAttribute( 'role', 'status' );
		f.append( words );
		this.layer.append( f );
		try {
			await new Promise( ( resolve, reject ) => {
				const start = performance.now();
				let arrived = false;
				const frame = now => {
					try {
						const progress = Math.min( 1, ( now - start ) / 5600 );
						const ease = t => { const k = Math.max( 0, Math.min( 1, t ) ); return k * k * k * ( k * ( k * 6 - 15 ) + 10 ); };
						const opacity = ease( ( progress - .28 ) / .14 ) * ( 1 - ease( ( progress - .57 ) / .33 ) );
						f.style.opacity = String( opacity );
						words.style.opacity = progress >= .42 && progress <= .57 ? '.85' : '0';
						if ( progress >= .5 && ! arrived ) { f.style.opacity = '1'; move(); arrived = true; }
						animate( progress, arrived );
						if ( progress < 1 ) requestAnimationFrame( frame ); else resolve();
					} catch ( error ) { reject( error ); }
				};
				requestAnimationFrame( frame );
			} );

		} finally {

			f.remove();
			this._close();

		}

	}

	// ---- HUD

	guidance( target, camera, hasPrompt = false, guide = this ) {

		let insets;
		if ( this.input?.touchMode ) {
			const actions = document.querySelector( '.sm-actions' )?.getBoundingClientRect();
			const moveHint = document.querySelector( '.sm-move-hint' )?.getBoundingClientRect();
			const objective = this.objective.getBoundingClientRect();
			const style=globalThis.getComputedStyle?.(this.root),safe=side=>parseFloat(style?.getPropertyValue(`--sh-safe-${side}`))||0;
			insets={left:Math.max(44,safe('left')+22),right:Math.max(44,safe('right')+22),top:Math.max(94,safe('top')+30,Number.isFinite(objective?.bottom)?objective.bottom+22:94),bottom:Math.max(86,safe('bottom')+30)};
			if ( Number.isFinite( actions?.top ) && actions.width > 0 ) insets.bottom=Math.max(insets.bottom,window.innerHeight-actions.top+30);
			if ( Number.isFinite( moveHint?.top ) && moveHint.width > 0 ) insets.bottom=Math.max(insets.bottom,window.innerHeight-moveHint.top+30);
		}
		const pos = target && projectGuidance( target.at, camera, window.innerWidth, window.innerHeight, insets );
		const hidden = ! pos || this.open || hasPrompt && pos.onScreen && pos.distance < 3;
		guide.guideEl.classList.toggle( 'is-visible', ! hidden );
		if ( hidden ) return;
		// Identity, not position: moving stair markers and brief modal/aim hides must
		// not repeatedly announce the same destination. A new objective can reuse a door.
		const key = `${ target.pingEvery ? 'pickup' : this._goal || '' }|${ target.id || target.label }`;
		const now = performance.now();
		if ( key !== guide._guideKey || target.pingEvery && now >= guide._guideNextPing ) {
			guide._guideKey = key;
			guide._guidePingUntil = now + 1450;
			guide._guideNextPing = now + ( target.pingEvery || Infinity );
			guide.guideEl.classList.remove( 'is-pinging' );
			void guide.guidePulse.offsetWidth;
			guide.guideEl.classList.add( 'is-pinging' );
		}
		const pinging = now < guide._guidePingUntil;
		guide.guideEl.classList.toggle( 'is-pinging', pinging );
		guide.guideEl.style.left = `${ pos.x.toFixed( 1 ) }px`;
		guide.guideEl.style.top = `${ pos.y.toFixed( 1 ) }px`;
		guide.guideEl.classList.toggle( 'is-edge', ! pos.onScreen );
		guide.guideEl.classList.toggle( 'has-label', target.labelAlways || pinging || ! pos.onScreen && ! this.input?.touchMode || pos.onScreen && pos.distance < 12 );
		guide.guideEl.classList.toggle( 'label-right', pos.x < 130 );
		guide.guideEl.classList.toggle( 'label-left', pos.x > window.innerWidth - 130 );
		guide.guideArrow.style.transform = `translate(-50%, -50%) rotate(${ pos.angle.toFixed( 1 ) }deg)`;
		guide.guideLabel.textContent = this.input?.touchMode ? touchInstruction( target.label ).replace( / · E\b/g, ' · tap' ) : target.label;

	}

	setObjective( text ) {

		if ( this.input?.touchMode ) text = touchInstruction( text );
		if ( text === this._goal ) return;
		this._goal = text;
		this.goalEl.textContent = text || '';
		this.objective.classList.toggle( 'has-goal', !! text );
		this.objective.classList.remove( 'is-new' );
		void this.objective.offsetWidth;
		if ( text ) this.objective.classList.add( 'is-new' );

	}

	setClock( text ) {

		if ( text !== this._clock ) this.clockEl.textContent = this._clock = text;

	}

	setHUD( on ) {

		this.objective.classList.toggle( 'is-hidden', ! on );

	}

	telescope( k ) {

		this.vignette.style.opacity = k.toFixed( 3 );

	}

	strip( s ) {

		if ( ! s ) {

			this.stripEl.classList.remove( 'is-on' );
			return;

		}

		this.stripEl.classList.add( 'is-on' );
		const key = s.from + '|' + s.text + '|' + ( s.hint || '' ) + '|' + ( s.morse || '' ) + '|' + ( s.translation || '' );
		if ( key === this._strip ) return;
		this._strip = key;
		this.stripEl.innerHTML = '';
		this.stripEl.append( el( 'div', 'sh-strip-from', s.from ) );
		const t = el( 'div', 'sh-strip-text' );
		t.append( document.createTextNode( s.text ) );
		if ( s.cursor ) t.append( el( 'span', 'sh-strip-cursor', '▍' ) );
		this.stripEl.append( t );
		if ( s.translation ) this.stripEl.append( el( 'div', 'sh-strip-translation', `${ s.language || 'Translation' } · ${ s.translation }` ) );
		if ( s.morse ) {
			if ( s.morse.length <= 90 ) this.stripEl.append( el( 'div', 'sh-strip-morse', s.morse ) );
			else {
				const marks = el( 'button', 'sh-strip-marks', 'Read received marks' );
				marks.addEventListener( 'click', () => this.read( { title: s.from, body: [ s.morse, s.text, s.translation ].filter( Boolean ) } ) );
				this.stripEl.append( marks );
			}
		}
		if ( s.hint ) this.stripEl.append( el( 'div', 'sh-strip-hint', s.hint ) );

	}

	// ---- pages

	islandReveal( active, skip = null ) {
		if ( active ) this.arrival( null );
		this.root.classList.toggle( 'is-island-reveal', active );
		document.body.classList.toggle( 'is-island-reveal', active );
		this.revealSkip.hidden = ! active;
		this.revealSkip.textContent = this.input?.touchMode ? 'Continue' : 'Continue · Esc';
		this.onRevealSkip = skip;
	}

	arrival( line, hint = '' ) {

		if ( line?.lesson ) hint = '';
		this.arrivalEl.classList.toggle( 'is-on', !! line || !! hint );
		this.arrivalEl.classList.toggle( 'is-lesson', !! line?.lesson );
		if ( this.arrivalFrom.textContent !== ( line?.from || '' ) ) this.arrivalFrom.textContent = line?.from || '';
		if ( this.arrivalText.textContent !== ( line?.text || '' ) ) this.arrivalText.textContent = line?.text || '';
		if ( this.arrivalHint.textContent !== hint ) this.arrivalHint.textContent = hint;

	}

	// One page with a packet index and individual papers. Switching papers never resumes the sea.
	packet( papers, read = [], onRead = () => {} ) {

		return this._page( ( page, done ) => {

			const render = ( paper = null ) => {

				page._paper?.destroy();
				page.innerHTML = '';
				if ( paper ) {

					page.append( el( 'h2', 'sh-page-title', paper.title ) );
					if ( paper.sources ) page.append( el( 'p', 'sh-paper-kind', 'Historical background · Written for the game' ) );
					if ( paper.chapters ) this._chapterReader( page, paper );
					else for ( const p of paper.body ) page.append( el( 'p', 'sh-page-p', p ) );
					const details = el( 'details', 'sh-paper-source' );
					details.append( el( 'summary', '', 'History and story · About this document' ), el( 'p', '', paper.provenance ) );
					const sources = paper.sources || ( paper.source ? [ { label: paper.sourceLabel || 'Northern Lighthouse Board transcript', url: paper.source } ] : [] );
					for ( const source of sources ) {

						const link = el( 'a', '', source.label );
						link.href = source.url;
						link.target = '_blank';
						link.rel = 'noopener noreferrer';
						const row = el( 'p' ); row.append( link ); details.append( row );

					}
					page.append( details );
					const back = el( 'button', 'sh-btn is-quiet', 'Back to the packet' );
					back.addEventListener( 'click', () => render() );
					page.append( back );
					onRead( paper.id );

				} else {

					page.append( el( 'h2', 'sh-page-title', 'The papers in your coat' ), el( 'p', 'sh-page-p', 'Your letter and posting, the last relief’s account, and notes for finding your feet. Read whatever you wish.' ) );
					const options = el( 'div', 'sh-options' );
					for ( const p of papers ) {

						const b = el( 'button', 'sh-option' );
						b.append( el( 'span', 'sh-option-label', p.label + ( read.includes( p.id ) ? ' · Read' : '' ) ), el( 'span', 'sh-option-sub', p.sub ) );
						b.addEventListener( 'click', () => render( p ) );
						options.append( b );

					}
					page.append( options );

				}
				const close = el( 'button', 'sh-btn', 'Put the papers away' );
				close.addEventListener( 'click', () => done( null ) );
				page.append( close );
				if ( page.isConnected ) { paperDeck( page, () => this.onPaper?.( { kind: 'turn' } ) ); page.focus( { preventScroll: true } ); }

			};
			render();

		} );

	}

	// The instrument itself stays in the rendered world; only the actions sit over it.
	inspection( { title, onRecord } ) {
		return new Promise( resolve => {
			this._open();
			const panel = el( 'div', 'sh-instrument-actions' );
			panel.setAttribute( 'role', 'dialog' ); panel.setAttribute( 'aria-modal', 'true' ); panel.setAttribute( 'aria-label', title );
			panel.append( el( 'h2', '', title ), el( 'p', '', 'Read the graduated face, then note the reading.' ) );
			const record = el( 'button', 'sh-btn', 'Record reading' ), back = el( 'button', 'sh-btn sh-btn-soft', 'Back' );
			let closed = false;
			const done = capture => {
				if ( closed ) return; closed = true;
				if ( capture ) onRecord();
				window.removeEventListener( 'keydown', key, true ); panel.remove(); this._close(); resolve( capture );
			};
			const key = e => { if ( ! e.repeat && [ 'Escape', 'KeyE', 'Enter' ].includes( e.code ) ) { e.preventDefault(); e.stopImmediatePropagation?.(); done( e.code !== 'Escape' ); } };
			record.addEventListener( 'click', () => done( true ) ); back.addEventListener( 'click', () => done( false ) );
			panel.append( record, back ); this.layer.append( panel ); window.addEventListener( 'keydown', key, true );
		} );
	}

	observations( { title, rows, complete, hint } ) {
		return this._page( ( page, done ) => {
			page.classList.add( 'is-slate' );
			page.append( el( 'h2', 'sh-page-title', title ) );
			for ( const row of rows ) {
				const line = el( 'p', 'sh-slate-row' ); line.append( el( 'strong', '', row.title ), el( 'span', '', row.value ) ); page.append( line );
			}
			page.append( el( 'p', 'sh-page-p', hint ) );
			const chalk = el( 'button', 'sh-btn', 'Chalk observations' ); chalk.disabled = ! complete;
			chalk.addEventListener( 'click', () => { if ( complete ) done( 'chalk' ); } );
			const back = el( 'button', 'sh-btn sh-btn-soft', 'Back to the watch' ); back.addEventListener( 'click', () => done( null ) );
			page.append( chalk, back );
		} );
	}

	_chapterReader( page, paper ) {
		page.classList.add( 'sh-field-guide' );
		const nav = el( 'nav', 'sh-reader-tabs' ); nav.setAttribute( 'aria-label', 'Field guide chapters' );
		const article = el( 'article', 'sh-reader-article' ); article.tabIndex = -1;
		const pager = el( 'div', 'sh-reader-pager' );
		const previous = el( 'button', 'sh-btn is-quiet', 'Previous' ), next = el( 'button', 'sh-btn', 'Next chapter' );
		let index = 0;
		const render = ( n, moveFocus = false ) => {
			index = n;
			const chapter = paper.chapters[ index ];
			article.replaceChildren( el( 'div', 'sh-reader-kicker', chapter.kicker ), el( 'h3', '', chapter.heading ) );
			for ( const text of chapter.paragraphs ) article.append( el( 'p', 'sh-page-p', text ) );
			article.append( el( 'p', 'sh-reader-takeaway', chapter.takeaway ) );
			if ( index === paper.chapters.length - 1 ) {
				const details = el( 'details', 'sh-paper-source' );
				details.append( el( 'summary', '', 'Sources and reconstruction notes' ), el( 'p', '', paper.provenance ) );
				for ( const source of paper.sources || [] ) {
					const link = el( 'a', '', source.label ); link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
					const row = el( 'p' ); row.append( link ); details.append( row );
				}
				article.append( details );
			}
			for ( const [ i, b ] of [ ...nav.children ].entries() ) b.setAttribute( 'aria-current', i === index ? 'page' : 'false' );
			previous.disabled = index === 0; next.hidden = index === paper.chapters.length - 1;
			if ( moveFocus ) article.focus( { preventScroll: true } );
			page._paper?.first();
		};
		paper.chapters.forEach( ( chapter, i ) => {
			const button = el( 'button', '', chapter.title ); button.addEventListener( 'click', () => render( i ) ); nav.append( button );
		} );
		previous.addEventListener( 'click', () => render( index - 1, true ) );
		next.addEventListener( 'click', () => render( index + 1, true ) );
		pager.append( previous, next ); page.append( nav, article, pager ); render( 0 );
	}

	ruinInspection( note ) {
		const previousFocus=document.activeElement;
		return this._page((page,done)=>{
			page.setAttribute('role','dialog');page.setAttribute('aria-modal','true');page.setAttribute('aria-label',note.title);
			page.append(el('h2','sh-page-title',note.title),el('p','sh-page-p',note.body[0]));
			const history=el('details');history.append(el('summary','','History and reconstruction'));
			for(const line of note.body.slice(1))history.append(el('p','sh-page-p',line));
			const back=el('button','sh-btn','Step back');back.addEventListener('click',()=>done(null));
			page.append(history,back);
		},{cls:'is-ruin',trapFocus:true,focusSelector:'button:not(:disabled), summary',dismissKeys:['Escape','KeyE']}).finally(()=>{
			if(previousFocus?.isConnected)previousFocus.focus?.({preventScroll:true});
		});
	}

	read( paper ) {
		if ( this._readPromise ) return this._readPromise;
		const { title, body, chapters } = paper;
		const previousFocus = document.activeElement;
		const openedAt = performance.now();

		this._readPromise = this._page( ( page, done ) => {

			page.append( el( 'h2', 'sh-page-title', title ) );
			if ( chapters ) this._chapterReader( page, paper );
			else for ( const p of body ) page.append( el( 'p', 'sh-page-p', p ) );
			const b = el( 'button', 'sh-btn sh-reader-close', chapters ? 'Back to the lamp' : 'Put it down' );
			// The reader's close button can appear beneath the opening click. Do not
			// let the second half of a double-click immediately put the guide away.
			b.addEventListener( 'click', () => { if ( ! chapters || performance.now() - openedAt > 500 ) done( null ); } );
			page.append( b );

		}, { trapFocus: true, dismissKeys: chapters ? [ 'Escape' ] : [ 'Escape', 'KeyE', 'Enter' ] } ).finally( () => {
			this._readPromise = null;
			if ( previousFocus?.isConnected ) previousFocus.focus?.( { preventScroll: true } );
		} );
		return this._readPromise;

	}

	// Original scans stay unchanged. Fit shows the whole sheet; detail views
	// tile every part of it in a fixed window, with explicit navigation.
	archive( paper ) {
		const previousFocus = document.activeElement;
		return this._page( ( page, done ) => {
			page.classList.add( 'sh-archive-page' );
			page.setAttribute( 'aria-label', paper.title );
			page.append( el( 'div', 'sh-paper-kind', 'Original document · ' + paper.date ), el( 'h2', 'sh-page-title', paper.title ) );
			const scan = el( 'section', 'sh-archive-scan' );
			const tools = el( 'div', 'sh-archive-tools' );
			const canvas = el( 'canvas', 'sh-archive-image' );
			canvas.tabIndex = 0; canvas.setAttribute( 'role', 'img' ); canvas.setAttribute( 'aria-label', paper.alt + ' Use the detail buttons to inspect the original without scrolling.' );
			const status = el( 'p', 'sh-archive-status', 'Loading original scan…' ); status.setAttribute( 'aria-live', 'polite' );
			const image = el( 'img' ); image.src = paper.image;
			let scale = 1, tile = 0, tiles = 1, columns = 1;
			const draw = () => {
				if ( ! image.naturalWidth ) return;
				const width = Math.max( 300, canvas.clientWidth ), height = Math.max( 100, canvas.clientHeight );
				const pixelRatio = Math.min( 2, window.devicePixelRatio || 1 );
				canvas.width = Math.round( width * pixelRatio ); canvas.height = Math.round( height * pixelRatio );
				const ctx = canvas.getContext( '2d' ); ctx.clearRect( 0, 0, canvas.width, canvas.height );
				columns = scale;
				const sw = image.naturalWidth / scale;
				const sh = scale === 1 ? image.naturalHeight : Math.min( image.naturalHeight, sw * canvas.height / canvas.width );
				tiles = scale === 1 ? 1 : columns * Math.ceil( image.naturalHeight / sh );
				tile = Math.min( tile, tiles - 1 );
				const fit = Math.min( canvas.width / sw, canvas.height / sh );
				ctx.drawImage( image, ( tile % columns ) * sw, Math.min( Math.floor( tile / columns ) * sh, image.naturalHeight - sh ), sw, sh, ( canvas.width - sw * fit ) / 2, ( canvas.height - sh * fit ) / 2, sw * fit, sh * fit );
				status.textContent = scale === 1 ? 'Whole original sheet' : `Detail ${ tile + 1 } of ${ tiles } · left to right, top to bottom`;
				back.disabled = scale === 1 || tile === 0; forward.disabled = scale === 1 || tile === tiles - 1;
				for ( const [ n, button ] of zooms ) button.setAttribute( 'aria-pressed', String( n === scale ) );
			};
			const zooms = [];
			for ( const [ label, n ] of [ [ 'Whole sheet', 1 ], [ '2× details', 2 ], [ '3× details', 3 ] ] ) {
				const button = el( 'button', 'sh-btn is-quiet', label );
				button.addEventListener( 'click', () => { scale = n; tile = 0; draw(); } );
				zooms.push( [ n, button ] ); tools.append( button );
			}
			const detailNav = el( 'div', 'sh-archive-detail-nav' );
			const back = el( 'button', 'sh-btn is-quiet', 'Previous detail' ), forward = el( 'button', 'sh-btn is-quiet', 'Next detail' );
			back.disabled = forward.disabled = true;
			back.addEventListener( 'click', () => { tile = Math.max( 0, tile - 1 ); draw(); } );
			forward.addEventListener( 'click', () => { tile = Math.min( tiles - 1, tile + 1 ); draw(); } );
			detailNav.append( back, forward ); scan.append( tools, canvas, status, detailNav ); page.append( scan );
			image.addEventListener( 'load', () => { draw(); page._paper?.refresh(); } );
			image.addEventListener( 'error', () => { status.textContent = 'The scan could not be loaded. Its source is on the following sheets.'; } );
			const resize = new ResizeObserver( draw ); resize.observe( canvas );
			for ( const line of paper.body ) page.append( el( 'p', 'sh-page-p', line ) );
			page.append( el( 'h3', 'sh-source-title', 'Source and story placement' ), el( 'p', 'sh-page-p', paper.provenance ) );
			for ( const source of paper.sources || [] ) {
				const link = el( 'a', '', source.label ); link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
				const row = el( 'p', 'sh-page-p sh-source-link' ); row.append( link ); page.append( row );
			}
			const close = el( 'button', 'sh-btn', 'Put it back' );
			close.addEventListener( 'click', () => { resize.disconnect(); done( null ); } ); page.append( close );
			// The outer page can also dismiss by keyboard.
			page._archiveResize = resize;
		}, { cls: 'is-archive', dismissKeys: [ 'Escape', 'KeyE' ] } ).then( value => { previousFocus?.focus?.( { preventScroll: true } ); return value; } );
	}

	savedWatch( { date, time, objective = '', entry = '' } ) {

		return this._page( ( page, done ) => {

			page.classList.add( 'sh-save' );
			page.setAttribute( 'role', 'dialog' );
			page.setAttribute( 'aria-modal', 'true' );
			page.setAttribute( 'aria-labelledby', 'sh-save-title' );
			const cover = el( 'div', 'sh-save-cover' );
			cover.append( el( 'p', 'sh-save-eyebrow', 'Eilean Mòr · January 1901' ) );
			const mark = el( 'div', 'sh-save-mark' );
			mark.setAttribute( 'aria-hidden', 'true' );
			mark.innerHTML = '<svg viewBox="0 0 120 136" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M39 119h42M44 113l5-66h22l5 66M44 47h32M47 38h26v9H47zM46 38l14-9 14 9M60 22v7M56 113V99h8v14M55 61h10v10H55zM54 80h12M51 42h18M12 43l25-7M83 36l25 7M10 59l27-12M83 47l27 12M17 124c15-7 27 7 43 0s28 7 43 0"/><circle cx="60" cy="42" r="3"/></svg>';
			const title = el( 'h1', 'sh-save-title', 'Seven Hunters' ); title.id = 'sh-save-title';
			cover.append( mark, title, el( 'p', 'sh-save-subtitle', 'The keeper’s journal' ), el( 'span', 'sh-save-cover-rule' ), el( 'p', 'sh-save-quote', 'A light to keep.\nA watch to return to.' ) );
			const paper = el( 'div', 'sh-save-paper' );
			paper.append( el( 'p', 'sh-save-eyebrow', 'Your saved watch' ), el( 'h2', 'sh-save-heading', 'Return to the island' ), el( 'p', 'sh-save-date', date ) );
			const stamp = el( 'div', 'sh-save-stamp' );
			stamp.append( el( 'span', 'sh-save-time', time ), el( 'span', 'sh-save-stamp-label', 'Island time\nProgress saved' ) );
			paper.append( stamp );
			if ( objective ) {
				const duty = el( 'div', 'sh-save-duty' );
				duty.append( el( 'span', 'sh-save-eyebrow', 'Next duty' ), el( 'p', '', this.input?.touchMode ? touchInstruction( objective ) : objective ) );
				paper.append( duty );
			}
			if ( entry ) {
				const last = el( 'div', 'sh-save-entry' );
				last.append( el( 'span', 'sh-save-eyebrow', 'Last journal entry' ), el( 'p', '', entry ) );
				paper.append( last );
			}
			const actions = el( 'div', 'sh-save-actions' );
			const resume = el( 'button', 'sh-save-continue', 'Continue the watch' ); resume.type = 'button';
			const arrow = el( 'span', '', '→' ); arrow.setAttribute( 'aria-hidden', 'true' ); resume.append( arrow );
			resume.addEventListener( 'click', () => done( 'continue' ) );
			const restart = el( 'button', 'sh-save-restart', 'Begin a new watch' ); restart.type = 'button';
			actions.append( resume, restart );
			actions.classList.add( 'sh-paper-actions' );
			restart.addEventListener( 'click', async () => {
				const choice = await this.choose( { title: 'Begin again?', intro: 'This replaces your saved watch and returns you to the landing boat.', options: [ { label: 'Replace save & begin again', value: 'new' } ], cancel: 'Keep this watch' } );
				if ( choice === 'new' ) done( 'new' ); else restart.focus( { preventScroll: true } );
			} );
			paper.append( el( 'p', 'sh-save-footnote', 'Your watch saves automatically in this browser.' ) );
			page.append( cover, paper, actions );

		}, { cls: 'is-save', dismiss: false, trapFocus: true } );

	}

	choose( { title, intro = '', options, cancel = 'Not now' } ) {

		return this._page( ( page, done ) => {

			page.append( el( 'h2', 'sh-page-title', title ) );
			if ( intro ) page.append( el( 'p', 'sh-page-p sh-page-intro', intro ) );
			const list = el( 'div', 'sh-options' );
			for ( const o of options ) {

				const b = el( 'button', 'sh-option' );
				b.append( el( 'span', 'sh-option-label', o.label ) );
				if ( o.sub ) b.append( el( 'span', 'sh-option-sub', o.sub ) );
				b.addEventListener( 'click', () => done( o.value ) );
				list.append( b );

			}

			page.append( list );
			if ( cancel ) {

				const c = el( 'button', 'sh-btn is-quiet', cancel );
				c.addEventListener( 'click', () => done( null ) );
				page.append( c );

			}

		}, { cls: 'is-choose', dismiss: !! cancel, trapFocus: ! cancel } );

	}

	form( { title, intro = '', fields, submit = 'Chalk it up' } ) {

		return this._page( ( page, done ) => {

			page.append( el( 'h2', 'sh-page-title', title ) );
			if ( intro ) page.append( el( 'p', 'sh-page-p sh-page-intro', intro ) );
			const values = {};
			for ( const f of fields ) {

				page.append( el( 'div', 'sh-field-label', f.label ) );
				const row = el( 'div', 'sh-field' );
				for ( const o of f.options ) {

					const b = el( 'button', 'sh-chip', o );
					b.addEventListener( 'click', () => {

						values[ f.key ] = o;
						for ( const c of row.children ) c.classList.toggle( 'is-on', c === b );
						ok.disabled = fields.some( ( q ) => ! values[ q.key ] );

					} );
					row.append( b );

				}

				page.append( row );

			}

			const ok = el( 'button', 'sh-btn', submit );
			ok.disabled = true;
			ok.addEventListener( 'click', () => done( values ) );
			const c = el( 'button', 'sh-btn is-quiet', 'Later' );
			c.addEventListener( 'click', () => done( null ) );
			page.append( ok, c );

		}, { cls: 'is-form' } );

	}

	// the journal page at dawn: rows [ time, text ]; remarks: [ { key, ask, yes, no } ] to choose; resolves
	// with the chosen remarks { key: bool } when it is signed
	journal( { heading, rows, remarks = [], footer = '' } ) {

		return this._page( ( page, done ) => {

			page.classList.add( 'is-journal' );
			page.append( el( 'h2', 'sh-page-title', heading ) );
			const table = el( 'div', 'sh-journal' );
			const addRow = ( t, text, cls = '' ) => {

				const r = el( 'div', 'sh-journal-row ' + cls );
				r.append( el( 'span', 'sh-journal-t', t ), el( 'span', 'sh-journal-text', text ) );
				table.append( r );
				return r;

			};

			for ( const [ t, text ] of rows ) addRow( t, text );
			page.append( table );
			const chosen = {};
			for ( const r of remarks ) {

				page.append( el( 'div', 'sh-field-label', r.ask ) );
				const row = el( 'div', 'sh-field' );
				for ( const [ label, v ] of [ [ 'Enter it', true ], [ 'Leave it out', false ] ] ) {

					const b = el( 'button', 'sh-chip', label );
					b.addEventListener( 'click', () => {

						chosen[ r.key ] = v;
						for ( const c of row.children ) c.classList.toggle( 'is-on', c === b );
						sign.disabled = remarks.some( ( q ) => chosen[ q.key ] === undefined );

					} );
					row.append( b );

				}

				page.append( row );

			}

			if ( footer ) page.append( el( 'p', 'sh-page-p sh-journal-footer', footer ) );
			const sign = el( 'button', 'sh-btn', 'Sign the page' );
			sign.disabled = remarks.length > 0;
			sign.addEventListener( 'click', () => done( chosen ) );
			page.append( sign );

		}, { dismiss: false, cls: 'is-journal-wrap' } );

	}

	album( { title, frames, intro } ) {
		return this._page( ( page, done ) => {
			page.append( el('h2','sh-page-title',title),el('p','sh-page-p',intro) );
			const grid=el('div','sh-prints');
			for(const [i,frame] of frames.entries()){
				const figure=el('figure','sh-print'),img=el('img');img.src=frame.image;img.alt=frame.label;img.width=img.height=384;
				figure.append(img,el('figcaption','',`Frame ${i+1} · ${frame.label}`));grid.append(figure);
			}
			if(!frames.length)grid.append(el('p','sh-page-p','No exposures on the roll. The camera has come home safely.'));
			page.append(grid);const close=el('button','sh-btn','Write to Mary');close.addEventListener('click',()=>done());page.append(close);
		},{dismiss:false,trapFocus:true});
	}

	// the last screen: the page as written, and play again
	end( { heading, rows, lines, credits, next = null, stayLabel = 'Stay on the island' } ) {

		this._open();
		const c = el( 'div', 'sh-end' );
		const page = el( 'div', 'sh-page is-journal' );
		page.append( el( 'h2', 'sh-page-title', heading ) );
		const table = el( 'div', 'sh-journal' );
		for ( const [ t, text ] of rows ) {

			const r = el( 'div', 'sh-journal-row' );
			r.append( el( 'span', 'sh-journal-t', t ), el( 'span', 'sh-journal-text', text ) );
			table.append( r );

		}

		page.append( table );
		const side = el( 'div', 'sh-end-side' );
		for ( const l of lines ) side.append( el( 'p', 'sh-card-line', l ) );
		side.append( el( 'p', 'sh-end-credits', credits ) );
		const again = el( 'button', 'sh-btn', 'Begin again' );
		again.addEventListener( 'click', () => this.onRestart && this.onRestart() );
		const stay = el( 'button', 'sh-btn is-quiet', stayLabel );
		stay.addEventListener( 'click', () => {

			page._paper?.destroy();
			c.classList.remove( 'is-on' );
			setTimeout( () => c.remove(), 900 );
			this._close();

		} );
		side.append( again, stay );
		if ( next ) {
			const onward = el( 'button', 'sh-btn', next.label );
			onward.addEventListener( 'click', () => { page._paper?.destroy(); c.remove(); this._close(); next.use(); } );
			side.prepend( onward );
		}
		page.append( side ); c.append( page );
		this.layer.append( c );
		paperDeck( page, () => this.onPaper?.( { kind: 'turn' } ) );
		void c.offsetWidth;
		c.classList.add( 'is-on' );

	}

}
