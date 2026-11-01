import { WATCHER } from './Script.js';
import { MORSE, morse } from './Watcher.js';

// First contact teaches the shutter without changing Cate's script. The lesson
// is stored with the watch; a held key is deliberately never restored as down.
export const SIGNAL_PRACTICE = [ 'E', 'T', 'A' ];
const DEMO_UNIT = .26;
const DEMO = morse( 'A' );
const GLYPHS = code => String( code || '' ).replace( /\./g, '·' ).replace( /-/g, '—' );
const make = ( tag, cls, text ) => {
	const node = document.createElement( tag );
	if ( cls ) node.className = cls;
	if ( text !== undefined ) node.textContent = text;
	return node;
};

export class GuidedSignal {
	constructor( story ) {
		this.s = story;
		this.active = false;
		this.phase = '';
		this.pressed = false;
		this.lamp = 0;
		this.elapsed = 0;
		this.cooldown = 0;
		this.held = 0;
		this.notice = '';
		this.panel = null;
		this.helpEl = null;
	}

	get state() {
		return this.s.flags.signalLesson || ( this.s.flags.signalLesson = { practiceIndex: 0, practiceSymbol: 0 } );
	}

	get eligible() { return this.s.watcher?.script === WATCHER; }
	get blocked() {
		const s = this.s, a = s.app;
		return s.paused || s.ui.open || a.mobile?.paused || a.devMenu?.open || a.freeCam || globalThis.document?.hidden === true;
	}

	// Called on taking up the lamp. True means the lesson owns this frame; false
	// means the existing Watcher may answer or resume normally.
	enter() {
		if ( ! this.eligible ) return false;
		if ( this.s.watcher.manualReply ) { this._start( 'reply' ); return true; }
		if ( ! this.state.practised && ( [ 'calling', 'steady' ].includes( this.s.watcher.state ) || this.state.pendingChoice !== undefined ) ) {
			this._start( this.state.demoSeen ? 'practice' : 'demo' );
			return true;
		}
		return false;
	}

	// Opt in only for the first selected outgoing message. Every later choice
	// follows the existing automatic transmission, with current-message hurry.
	reply( index ) {
		if ( ! this.eligible || this.state.firstReplyDone || ! this.s.watcher.options?.[ index ] ) return false;
		if ( ! this.state.practised ) {
			this.state.pendingChoice = index;
			this._start( this.state.demoSeen ? 'practice' : 'demo' );
			this.s.save?.();
			return true;
		}
		if ( ! this.s.watcher.reply( index, { manual: true } ) ) return false;
		delete this.state.pendingChoice;
		this._start( 'reply' );
		this.s.save?.();
		return true;
	}

	_start( phase ) {
		this.active = true;
		this.phase = phase;
		this.elapsed = 0;
		this.cooldown = 0;
		this.notice = '';
		this._pulse = null;
		this._release( false );
		this.s._hurry = false;
		this.s.ui.strip?.( null );
		this.helpEl?.remove(); this.helpEl = null;
		if ( globalThis.document?.pointerLockElement ) document.exitPointerLock?.();
		this._build();
		this.refresh();
	}

	// Interrupting the lesson keeps completed letters and the selected reply.
	// It does not call Watcher.reply again when the player returns.
	pause() {
		this._release( false );
		this.active = false;
		this._pulse = null;
		this.panel?.remove(); this.panel = null;
		this.helpEl?.remove(); this.helpEl = null;
		globalThis.window?.removeEventListener?.( 'keydown', this._down, true );
		globalThis.window?.removeEventListener?.( 'keyup', this._up, true );
		globalThis.window?.removeEventListener?.( 'blur', this._blur );
		globalThis.document?.removeEventListener?.( 'visibilitychange', this._visibility );
		this.s.save?.();
	}

	leave() { this.pause(); this.s._leaveSignal?.(); }

	interrupt() { this._release( false ); this._pulse = null; this.refresh(); }

	help() {
		if ( ! this.eligible || ! this.s.signal || this.s.ui.open ) return;
		if ( this.active && this.phase === 'help' ) return this.closeHelp();
		this._helpReturn = this.active ? this.phase : null;
		if ( ! this.active ) this._start( 'help' );
		else { this._release( false ); this._pulse = null; this.phase = 'help'; }
		this.refresh();
	}

	closeHelp() {
		const phase = this._helpReturn;
		this._helpReturn = null;
		if ( phase ) { this.phase = phase; this.refresh(); }
		else this.pause();
	}

	repeat() {
		if ( ! this.active || this.phase === 'help' ) return;
		this._release( false );
		this._pulse = null;
		this._demoReturn = this.phase === 'demo' ? this._demoReturn || 'practice' : this.phase;
		this.phase = 'demo'; this.elapsed = 0;
		this.refresh();
	}

	retry() {
		if ( ! this.active || ! [ 'practice', 'reply' ].includes( this.phase ) ) return;
		this._release( false ); this._pulse = null; this.cooldown = 0;
		if ( this.phase === 'reply' ) this.s.watcher.retryManualLetter();
		else this.state.practiceSymbol = 0;
		this.notice = 'Try this letter again. The earlier letters are safe.';
		this.s.save?.(); this.refresh();
	}

	get chunk() {
		if ( this.phase === 'reply' ) return this.s.watcher.manualChunk;
		const index = this.state.practiceIndex || 0, letter = SIGNAL_PRACTICE[ index ];
		return { letter, code: MORSE[ letter ], index, symbol: this.state.practiceSymbol || 0, total: SIGNAL_PRACTICE.length, complete: index >= SIGNAL_PRACTICE.length };
	}

	get threshold() { return 2 * ( this.state.unit || .24 ); }

	press( down ) {
		if ( down ) {
			if ( ! this.active || this.blocked || this.pressed || this._pulse || this.cooldown > 0 || ! [ 'practice', 'reply' ].includes( this.phase ) || this.chunk?.complete ) return;
			this.pressed = true; this.held = 0; this._setLamp( true ); this.refresh();
		} else this._release( true );
	}

	_release( accept ) {
		const wasPressed = this.pressed;
		this.pressed = false;
		this._setLamp( false );
		if ( ! wasPressed || ! accept ) return;
		if ( this.held < .025 ) { this.notice = 'Hold the shutter a little longer, then release.'; this.refresh(); return; }
		const mark = this.held < this.threshold ? '.' : '-';
		const sample = mark === '.' ? this.held : this.held / 3;
		this.state.unit = Math.max( .12, Math.min( .42, ( this.state.unit || .24 ) * .8 + sample * .2 ) );
		this._accept( mark );
	}

	// Named short/long flashes are an accessible alternative to timing a hold.
	flash( mark ) {
		if ( ! [ '.', '-' ].includes( mark ) || ! this.active || this.blocked || this.pressed || this._pulse || this.cooldown > 0 || ! [ 'practice', 'reply' ].includes( this.phase ) || this.chunk?.complete ) return false;
		this._pulse = { mark, remaining: ( this.state.unit || .24 ) * ( mark === '.' ? 1 : 3 ) };
		this._setLamp( true ); this.refresh();
		return true;
	}

	_accept( mark ) {
		const chunk = this.chunk;
		if ( ! chunk || chunk.complete ) return;
		const correct = this.phase === 'reply' ? this.s.watcher.manualMark( mark ) : chunk.code[ chunk.symbol ] === mark;
		if ( this.phase === 'practice' ) {
			if ( correct ) this.state.practiceSymbol = ( this.state.practiceSymbol || 0 ) + 1;
			else this.state.practiceSymbol = 0;
		}
		if ( ! correct ) this.notice = `That was ${ mark === '.' ? 'short' : 'long' }. Try ${ chunk.letter } again; follow the marks shown.`;
		else if ( chunk.symbol + 1 >= chunk.code.length ) {
			this.notice = `${ chunk.letter } sent. A small gap before the next letter.`;
			if ( this.phase === 'practice' ) { this.state.practiceIndex ++; this.state.practiceSymbol = 0; }
			this.cooldown = .55;
		} else this.notice = 'Good. Now the next mark.';
		this.s.save?.(); this.refresh();
	}

	_setLamp( on ) {
		const next = Number( !! on );
		this.s.watcher?.manualPress?.( !! on );
		if ( this.lamp === next ) return;
		this.lamp = next;
		if ( this.s.signalLight ) this.s.signalLight.scale = next;
		( this.s.sound || this.s.app.stationSound )?.signalShutter?.( !! on );
	}

	_finishPractice() {
		this.state.practised = true;
		const choice = this.state.pendingChoice;
		this.pause();
		if ( choice !== undefined ) this.reply( choice );
		else this.s.watcher.answer();
		this.s.save?.();
	}

	// Called before Story updates Watcher. True reserves the current frame; no
	// hurried incoming line or outgoing automatic message can also consume Space.
	update( dt ) {
		if ( ! this.active ) {
			if ( this.s.signal && this.eligible && ! this.helpEl ) this._buildHelp();
			else if ( ! this.s.signal || ! this.eligible ) { this.helpEl?.remove(); this.helpEl = null; }
			return false;
		}
		if ( ! this.s.signal || ! this.eligible ) { this.pause(); return false; }
		if ( this.phase === 'reply' && ! this.s.watcher.manualReply ) { this.pause(); return false; }
		this.s._hurry = false;
		if ( this.blocked ) { this.interrupt(); return true; }
		if ( this.phase === 'help' ) return true;
		dt = Math.max( 0, Math.min( .25, dt ) );
		if ( this.phase === 'demo' ) {
			this.elapsed += dt;
			const t = this.elapsed / DEMO_UNIT;
			this._setLamp( DEMO.on.some( ( [ a, b ] ) => t >= a && t < b ) );
			if ( t >= DEMO.length + 2 ) {
				this._setLamp( false ); this.state.demoSeen = true;
				this.phase = this._demoReturn || 'practice'; this._demoReturn = null;
				this.s.save?.();
			}
		} else {
			if ( this.pressed ) this.held += dt;
			if ( this._pulse ) {
				this._pulse.remaining -= dt;
				if ( this._pulse.remaining <= 0 ) { const mark = this._pulse.mark; this._pulse = null; this._setLamp( false ); this._accept( mark ); }
			}
			if ( this.cooldown > 0 ) this.cooldown = Math.max( 0, this.cooldown - dt );
			if ( this.cooldown === 0 && this.chunk?.complete ) {
				if ( this.phase === 'practice' ) this._finishPractice();
				else if ( this.phase === 'reply' && this.s.watcher.finishManualReply() ) {
					this.state.firstReplyDone = true; this.pause(); this.s.save?.();
				}
				return true;
			}
		}
		this.refresh();
		return true;
	}

	keydown( event ) {
		if ( ! this.active || this.s.ui.open ) return;
		if ( event.code === 'Space' ) {
			// Native buttons retain Space activation; the physical shutter takes it
			// everywhere else. Both contexts stop Story's fast-forward handler.
			event.stopImmediatePropagation?.();
			if ( event.target?.closest?.( 'button' ) && event.target !== this.keyEl ) return;
			event.preventDefault(); if ( ! event.repeat ) this.press( true );
		} else if ( event.code === 'Escape' ) {
			event.preventDefault(); event.stopImmediatePropagation?.();
			if ( this.phase === 'help' ) this.closeHelp(); else this.leave();
		} else if ( event.code === 'Tab' && this.panel ) {
			const buttons = [ ...this.panel.querySelectorAll( 'button:not(:disabled)' ) ].filter( button => ! button.hidden && button.getClientRects().length );
			if ( ! buttons.length ) return;
			const first = buttons[ 0 ], last = buttons.at( -1 );
			if ( event.shiftKey && document.activeElement === first ) { event.preventDefault(); last.focus(); }
			else if ( ! event.shiftKey && document.activeElement === last ) { event.preventDefault(); first.focus(); }
		}
	}

	keyup( event ) {
		if ( ! this.active || event.code !== 'Space' ) return;
		event.stopImmediatePropagation?.();
		if ( this.pressed ) { event.preventDefault(); this.press( false ); }
	}

	_buildHelp() {
		if ( ! globalThis.document || ! this.s.ui.root ) return;
		const help = this.helpEl = make( 'button', 'sh-btn sh-signal-help', 'Lamp help' );
		help.addEventListener( 'click', () => this.help() );
		this.s.ui.root.append( help );
	}

	_build() {
		if ( this.panel || ! globalThis.document || ! this.s.ui.root ) return;
		const overlay = this.panel = make( 'div', 'sh-guided-signal' );
		const page = make( 'section', 'sh-page' ); page.setAttribute( 'role', 'dialog' ); page.setAttribute( 'aria-label', 'Work the signal lamp' );
		this.kickerEl = make( 'div', 'sh-reader-kicker' );
		this.titleEl = make( 'h2', 'sh-page-title' );
		this.instructionEl = make( 'p', 'sh-page-p' );
		this.cueEl = make( 'div', 'sh-guided-signal-cue' ); this.cueEl.setAttribute( 'aria-hidden', 'true' );
		this.resultEl = make( 'p', 'sh-guided-signal-result' ); this.resultEl.setAttribute( 'aria-live', 'polite' );
		const keys = this.keysEl = make( 'div', 'sh-guided-signal-actions' );
		this.keyEl = make( 'button', 'sh-btn', this.s.app.isMobile ? 'Hold shutter' : 'Hold shutter · Space' );
		this.keyEl.addEventListener( 'pointerdown', event => { event.preventDefault(); this.keyEl.setPointerCapture?.( event.pointerId ); this.press( true ); } );
		this.keyEl.addEventListener( 'pointerup', () => this.press( false ) );
		for ( const event of [ 'pointercancel', 'lostpointercapture' ] ) this.keyEl.addEventListener( event, () => this._release( false ) );
		this.dotEl = make( 'button', 'sh-btn sh-btn-soft', 'Short ·' ); this.dotEl.addEventListener( 'click', () => this.flash( '.' ) );
		this.dashEl = make( 'button', 'sh-btn sh-btn-soft', 'Long —' ); this.dashEl.addEventListener( 'click', () => this.flash( '-' ) );
		keys.append( this.keyEl, this.dotEl, this.dashEl );
		const actions = make( 'div', 'sh-guided-signal-help' );
		this.repeatEl = make( 'button', 'sh-btn is-quiet', 'Watch A again' ); this.repeatEl.addEventListener( 'click', () => this.repeat() );
		this.retryEl = make( 'button', 'sh-btn is-quiet', 'Retry letter' ); this.retryEl.addEventListener( 'click', () => this.retry() );
		this.guideEl = make( 'button', 'sh-btn is-quiet', 'Lamp help' ); this.guideEl.addEventListener( 'click', () => this.help() );
		this.backEl = make( 'button', 'sh-btn is-quiet', 'Pause lesson' ); this.backEl.addEventListener( 'click', () => this.phase === 'help' ? this.closeHelp() : this.leave() );
		actions.append( this.repeatEl, this.retryEl, this.guideEl, this.backEl );
		page.append( this.kickerEl, this.titleEl, this.instructionEl, this.cueEl, this.resultEl, keys, actions ); overlay.append( page );
		this.s.ui.root.append( overlay );
		this._down = event => this.keydown( event ); this._up = event => this.keyup( event ); this._blur = () => this.interrupt();
		this._visibility = () => { if ( document.hidden ) this.interrupt(); };
		window.addEventListener( 'keydown', this._down, true ); window.addEventListener( 'keyup', this._up, true ); window.addEventListener( 'blur', this._blur );
		document.addEventListener( 'visibilitychange', this._visibility );
		this.keyEl.focus?.();
	}

	refresh() {
		if ( ! this.panel ) return;
		const demo = this.phase === 'demo', help = this.phase === 'help', chunk = this.chunk;
		this.kickerEl.textContent = help ? 'The lamp · help' : demo ? 'Watch the shutter' : this.phase === 'practice' ? `Practice ${ Math.min( chunk.index + 1, chunk.total ) } of ${ chunk.total }` : `Your chosen reply · letter ${ Math.min( chunk.index + 1, chunk.total ) } of ${ chunk.total }`;
		this.titleEl.textContent = help ? 'A short flash, a long flash' : demo ? 'A is short, then long' : chunk.complete ? 'Message sent' : `${ chunk.letter }   ${ GLYPHS( chunk.code ).split( '' ).join( ' ' ) }`;
		const holding = this.pressed ? this.held < this.threshold ? 'Release now for a short flash.' : 'Release now for a long flash.' : '';
		this.instructionEl.textContent = help ? this.state.firstReplyDone ? 'Later replies send after you choose them. Space finishes only the current message; each new reply is still yours to choose.' : "Tap the shutter for a dot; hold for a dash. Follow each letter's marks. Short and Long buttons give the same flashes without timing a hold." : demo ? 'The light and shutter show the same rhythm as the marks. Then try it at your own pace.' : holding || ( this.cooldown > 0 ? this.notice : chunk.complete ? 'The chosen words are complete.' : `Next: ${ chunk.code[ chunk.symbol ] === '.' ? 'tap for a dot' : 'hold for a dash' }. No need to memorise the code.` );
		this.cueEl.textContent = help ? '·   —' : demo ? GLYPHS( DEMO.symbols.filter( symbol => symbol.end <= this.elapsed / DEMO_UNIT ).map( symbol => symbol.mark ).join( '' ) ) || '· —' : `${ GLYPHS( chunk.code?.slice( 0, chunk.symbol ) ) }${ this.lamp ? '  ●' : '' }` || '○';
		this.cueEl.classList.toggle( 'is-lit', !! this.lamp );
		this.resultEl.textContent = help ? 'Pause and return whenever you need. Completed letters and your reply choice are kept.' : demo ? this.lamp ? 'Light showing' : 'Shutter closed' : this.notice;
		this.keysEl.hidden = demo || help || chunk.complete;
		for ( const button of [ this.keyEl, this.dotEl, this.dashEl ] ) button.disabled = this.cooldown > 0 || !! this._pulse;
		this.keyEl.classList.toggle( 'is-down', this.pressed );
		this.repeatEl.hidden = demo || help;
		this.retryEl.hidden = demo || help || chunk.complete;
		this.guideEl.hidden = help;
		this.backEl.textContent = help ? 'Back to the lamp' : 'Pause lesson';
	}
}
