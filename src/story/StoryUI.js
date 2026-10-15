
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
		this.guideEl = el( 'div', 'sh-guidance' );
		this.guideEl.setAttribute( 'aria-hidden', 'true' );
		this.guideMark = el( 'span', 'sh-guide-mark' );
		this.guidePulse = el( 'span', 'sh-guide-pulse' );
		this.guidePulse.innerHTML = '<i></i><i></i><b></b>';
		this.guideArrow = el( 'span', 'sh-guide-arrow' );
		this.guideArrow.innerHTML = '<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M14 3 L25 23 L14 18 L3 23 Z" fill="currentColor" stroke="#142029" stroke-width="2.5" stroke-linejoin="round"/></svg>';
		this.guideLabel = el( 'span', 'sh-guide-label' );
		this.guideEl.append( this.guidePulse, this.guideMark, this.guideArrow, this.guideLabel );
		this.safetyEl = el( 'div', 'sh-safety' ); this.safetyEl.hidden = true; this.safetyEl.setAttribute( 'role', 'status' );
		this.root.append( this.vignette, this.objective, this.guideEl, this.stripEl, this.arrivalEl, this.layer, this.revealSkip );
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
	_page( build, { dismiss = true, cls = '', dismissKeys = [ 'Escape', 'KeyE', 'Enter' ], trapFocus = false, focusSelector = 'button:not(:disabled)' } = {} ) {

		return new Promise( ( resolve ) => {

			this._open();
			const wrap = el( 'div', 'sh-page-wrap ' + cls );
			const page = el( 'div', 'sh-page' );
			wrap.append( page );
			let settled = false;
			const done = ( v ) => {

				if ( settled ) return;
				settled = true;
				wrap.inert = true;
				window.removeEventListener( 'keydown', key, true );
				wrap.classList.remove( 'is-on' );
				setTimeout( () => wrap.remove(), 350 );
				this._close();
				resolve( v );

			};

			const key = ( e ) => {

				if ( trapFocus && e.code === 'Tab' ) {
					const buttons = [ ...page.querySelectorAll( focusSelector ) ].filter( b => ! b.closest( '[hidden]' ) );
					const i = buttons.indexOf( document.activeElement );
					e.preventDefault();
					e.stopImmediatePropagation();
					buttons[ ( i + ( e.shiftKey ? -1 : 1 ) + buttons.length ) % buttons.length ]?.focus();
					return;
				}
				if ( dismiss && dismissKeys.includes( e.code ) ) {

					e.preventDefault();
					e.stopPropagation();
					done( null );

				}

			};

			build( page, done );
			window.addEventListener( 'keydown', key, true );
			this.layer.append( wrap );
			void wrap.offsetWidth;
			wrap.classList.add( 'is-on' );
			if ( trapFocus ) page.querySelector( 'button' )?.focus( { preventScroll: true } );

		} );

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
	fade( text = '', hold = 1600 ) {

		return new Promise( ( resolve ) => {

			const f = el( 'div', 'sh-fade' );
			if ( text ) f.append( el( 'p', 'sh-fade-text', text ) );
			this.layer.append( f );
			void f.offsetWidth;
			f.classList.add( 'is-on' );
			setTimeout( () => {

				resolve();
				setTimeout( () => {

					f.classList.remove( 'is-on' );
					setTimeout( () => f.remove(), 1200 );

				}, hold );

			}, 900 );

		} );

	}

	// Two seconds in either direction: a step/turn, fade through black, then
	// settle at the destination. Move only at full black, with input locked.
	async travel( text, move, animate = () => {} ) {

		this._open();
		const f = el( 'div', 'sh-fade' );
		f.style.transition = 'none';
		f.style.background = '#050708';
		f.append( el( 'p', 'sh-fade-text', text ) );
		this.layer.append( f );
		try {
			await new Promise( ( resolve, reject ) => {
				const start = performance.now();
				let arrived = false;
				const frame = now => {
					try {
						const progress = Math.min( 1, ( now - start ) / 2000 );
						const opacity = Math.min( 1, progress / .325, ( 1 - progress ) / .325 );
						f.style.opacity = String( opacity );
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

	guidance( target, camera, hasPrompt = false ) {

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
		this.guideEl.classList.toggle( 'is-visible', ! hidden );
		if ( hidden ) return;
		// Identity, not position: moving stair markers and brief modal/aim hides must
		// not repeatedly announce the same destination. A new objective can reuse a door.
		const key = `${ this._goal || '' }|${ target.id || target.label }`;
		if ( key !== this._guideKey ) {
			this._guideKey = key;
			this._guidePingUntil = performance.now() + 1450;
			this.guideEl.classList.remove( 'is-pinging' );
			void this.guidePulse.offsetWidth;
			this.guideEl.classList.add( 'is-pinging' );
		}
		const pinging = performance.now() < this._guidePingUntil;
		this.guideEl.classList.toggle( 'is-pinging', pinging );
		this.guideEl.style.left = `${ pos.x.toFixed( 1 ) }px`;
		this.guideEl.style.top = `${ pos.y.toFixed( 1 ) }px`;
		this.guideEl.classList.toggle( 'is-edge', ! pos.onScreen );
		this.guideEl.classList.toggle( 'has-label', pinging || ! pos.onScreen && ! this.input?.touchMode || pos.onScreen && pos.distance < 12 );
		this.guideEl.classList.toggle( 'label-right', pos.x < 130 );
		this.guideEl.classList.toggle( 'label-left', pos.x > window.innerWidth - 130 );
		this.guideArrow.style.transform = `translate(-50%, -50%) rotate(${ pos.angle.toFixed( 1 ) }deg)`;
		this.guideLabel.textContent = this.input?.touchMode ? touchInstruction( target.label ) : target.label;

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
		if ( s.morse ) this.stripEl.append( el( 'div', 'sh-strip-morse', s.morse ) );
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
			page.scrollTop = 0;
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

	// Original facsimiles have their own reader: fit, zoom and scroll without
	// opening an external tab or resuming the watch. Prose stays separate from pixels.
	archive( paper ) {
		const previousFocus = document.activeElement;
		return this._page( ( page, done ) => {
			page.classList.add( 'sh-archive-page' );
			page.setAttribute( 'role', 'dialog' );
			page.setAttribute( 'aria-modal', 'true' );
			page.setAttribute( 'aria-label', paper.title );
			page.append( el( 'div', 'sh-paper-kind', 'Original document · ' + paper.date ), el( 'h2', 'sh-page-title', paper.title ) );
			const tools = el( 'div', 'sh-archive-tools' );
			const viewport = el( 'div', 'sh-archive-viewport' );
			viewport.tabIndex = 0;
			viewport.setAttribute( 'aria-label', 'Document image; scroll to inspect when enlarged' );
			const image = el( 'img', 'sh-archive-image' );
			image.src = paper.image; image.alt = paper.alt; image.draggable = false;
			viewport.append( image );
			const buttons = [];
			for ( const [ label, scale ] of [ [ 'Fit width', 1 ], [ '2×', 2 ], [ '3×', 3 ] ] ) {
				const button = el( 'button', 'sh-btn is-quiet', label );
				button.setAttribute( 'aria-pressed', String( scale === 1 ) );
				button.addEventListener( 'click', () => {
					image.style.width = `${ scale * 100 }%`;
					for ( const other of buttons ) other.setAttribute( 'aria-pressed', String( other === button ) );
				} );
				buttons.push( button ); tools.append( button );
			}
			const close = el( 'button', 'sh-btn', 'Put it back' );
			close.addEventListener( 'click', () => done( null ) ); tools.append( close );
			queueMicrotask( () => close.focus() );
			page.addEventListener( 'keydown', e => {
				if ( e.code !== 'Tab' ) return;
				const focusable = [ ...page.querySelectorAll( 'button, summary, a[href], [tabindex="0"]' ) ].filter( element => element.getClientRects().length );
				const first = focusable[ 0 ], last = focusable.at( -1 );
				if ( e.shiftKey && document.activeElement === first ) { e.preventDefault(); last?.focus(); }
				else if ( ! e.shiftKey && document.activeElement === last ) { e.preventDefault(); first?.focus(); }
			} );
			image.addEventListener( 'error', () => {
				viewport.innerHTML = '';
				viewport.append( el( 'p', 'sh-page-p', 'The scan could not be loaded. Its source is listed below.' ) );
			} );
			page.append( tools, viewport );
			for ( const line of paper.body ) page.append( el( 'p', 'sh-page-p', line ) );
			const details = el( 'details', 'sh-paper-source' );
			details.append( el( 'summary', '', 'Source and story placement' ), el( 'p', '', paper.provenance ) );
			for ( const source of paper.sources ) {
				const link = el( 'a', '', source.label ); link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
				const row = el( 'p' ); row.append( link ); details.append( row );
			}
			page.append( details );
		}, { cls: 'is-archive', dismissKeys: [ 'Escape', 'KeyE' ] } ).then( value => { previousFocus?.focus?.(); return value; } );
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
			const confirm = el( 'div', 'sh-save-confirm' ); confirm.hidden = true;
			confirm.setAttribute( 'role', 'group' ); confirm.setAttribute( 'aria-label', 'Confirm a new watch' );
			confirm.append( el( 'h3', '', 'Begin again?' ), el( 'p', '', 'This replaces your saved watch and returns you to the landing boat.' ) );
			const keep = el( 'button', 'sh-save-continue', 'Keep this watch' ); keep.type = 'button';
			const replace = el( 'button', 'sh-save-restart', 'Replace save & begin again' ); replace.type = 'button';
			const back = () => { confirm.hidden = true; actions.hidden = false; restart.focus(); };
			keep.addEventListener( 'click', back );
			replace.addEventListener( 'click', () => done( 'new' ) );
			confirm.append( keep, replace );
			restart.addEventListener( 'click', () => { actions.hidden = true; confirm.hidden = false; keep.focus(); } );
			page.addEventListener( 'keydown', e => {
				if ( e.code === 'Escape' && ! confirm.hidden ) { e.preventDefault(); e.stopPropagation(); back(); }
			} );
			paper.append( actions, confirm, el( 'p', 'sh-save-footnote', 'Your watch saves automatically in this browser.' ) );
			page.append( cover, paper );

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

	// the last screen: the page as written, and play again
	end( { heading, rows, lines, credits, next = null } ) {

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
		const stay = el( 'button', 'sh-btn is-quiet', 'Stay on the island' );
		stay.addEventListener( 'click', () => {

			c.classList.remove( 'is-on' );
			setTimeout( () => c.remove(), 900 );
			this._close();

		} );
		side.append( again, stay );
		if ( next ) {
			const onward = el( 'button', 'sh-btn', next.label );
			onward.addEventListener( 'click', () => { c.remove(); this._close(); next.use(); } );
			side.prepend( onward );
		}
		c.append( page, side );
		this.layer.append( c );
		void c.offsetWidth;
		c.classList.add( 'is-on' );

	}

}
