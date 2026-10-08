
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
		this.guideArrow.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 8 L6 3 L10 8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
		this.guideLabel = el( 'span', 'sh-guide-label' );
		this.guideEl.append( this.guidePulse, this.guideMark, this.guideArrow, this.guideLabel );
		this.root.append( this.vignette, this.objective, this.guideEl, this.stripEl, this.arrivalEl, this.layer, this.revealSkip );
		document.body.append( this.root );
		this.modal = 0;

	}

	// ---- modal plumbing

	_open() {

		this.modal ++;
		this.root.classList.add( 'is-modal' );
		if ( document.exitPointerLock && document.pointerLockElement ) document.exitPointerLock();
		if ( this.input ) this.input.enabled = false;

	}

	_close() {

		this.modal = Math.max( 0, this.modal - 1 );
		if ( this.modal ) return;
		this.root.classList.remove( 'is-modal' );
		if ( this.input ) {

			this.input.enabled = true;
			this.input.keys.clear();
			this.input.requestLock();

		}

	}

	get open() {

		return this.modal > 0;

	}

	// a page on the layer; resolves with what done( value ) is given
	_page( build, { dismiss = true, cls = '', dismissKeys = [ 'Escape', 'KeyE', 'Enter' ] } = {} ) {

		return new Promise( ( resolve ) => {

			this._open();
			const wrap = el( 'div', 'sh-page-wrap ' + cls );
			const page = el( 'div', 'sh-page' );
			wrap.append( page );
			const done = ( v ) => {

				window.removeEventListener( 'keydown', key, true );
				wrap.classList.remove( 'is-on' );
				setTimeout( () => wrap.remove(), 350 );
				this._close();
				resolve( v );

			};

			const key = ( e ) => {

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
			const more = el( 'div', 'sh-card-more', this.input?.touchMode ? 'Tap to continue' : 'Click to continue' );
			c.append( more );
			this.layer.append( c );
			void c.offsetWidth;
			c.classList.add( 'is-on' );
			const t0 = performance.now();
			const go = ( e ) => {

				if ( performance.now() - t0 < 600 + wait ) return;
				if ( e.type === 'keydown' && e.code !== 'Space' && e.code !== 'Enter' ) return;
				if ( e.type === 'keydown' ) {

					e.preventDefault();
					e.stopPropagation();

				}

				c.removeEventListener( 'click', go );
				window.removeEventListener( 'keydown', go, true );
				c.classList.remove( 'is-on' );
				setTimeout( () => c.remove(), 900 );
				this._close();
				resolve();

			};

			c.addEventListener( 'click', go );
			window.addEventListener( 'keydown', go, true );

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

	// ---- HUD

	guidance( target, camera, hasPrompt = false ) {

		const pos = target && projectGuidance( target.at, camera, window.innerWidth, window.innerHeight );
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
		this.guideEl.classList.toggle( 'has-label', pinging || pos.onScreen && pos.distance < 12 );
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
					for ( const p of paper.body ) page.append( el( 'p', 'sh-page-p', p ) );
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

	read( { title, body } ) {

		return this._page( ( page, done ) => {

			page.append( el( 'h2', 'sh-page-title', title ) );
			for ( const p of body ) page.append( el( 'p', 'sh-page-p', p ) );
			const b = el( 'button', 'sh-btn', 'Put it down' );
			b.addEventListener( 'click', () => done( null ) );
			page.append( b );

		} );

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

		}, { cls: 'is-choose' } );

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
	end( { heading, rows, lines, credits } ) {

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
		c.append( page, side );
		this.layer.append( c );
		void c.offsetWidth;
		c.classList.add( 'is-on' );

	}

}
