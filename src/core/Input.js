// Keyboard / mouse input with pointer lock support.
export class Input {

	constructor( dom, { touch = false } = {} ) {

		this.dom = dom;
		this.touchMode = touch;
		this.touchKeys = new Set();
		this.touchPressed = new Set();
		this.move = { x: 0, y: 0 };
		this.keys = new Set();
		this.pressed = new Set();
		this.look = { x: 0, y: 0 };
		this.wheel = 0;
		this.mouseDown = false;
		this.rightDown = false;
		this.locked = false;
		this.enabled = true;

		window.addEventListener( 'keydown', ( e ) => {

			if ( e.target && ( e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA' ) ) return;
			if ( ! this.keys.has( e.code ) ) this.pressed.add( e.code );
			this.keys.add( e.code );
			if ( [ 'Space', 'ArrowUp', 'ArrowDown', 'Tab' ].includes( e.code ) ) e.preventDefault();

		} );
		window.addEventListener( 'keyup', ( e ) => this.keys.delete( e.code ) );
		window.addEventListener( 'blur', () => this.reset() );
		document.addEventListener( 'visibilitychange', () => { if ( document.hidden ) this.reset(); } );

		dom.addEventListener( 'mousedown', ( e ) => {
			if ( this.touchMode ) return;

			if ( e.button === 0 ) this.mouseDown = true;
			if ( e.button === 2 ) this.rightDown = true;

		} );
		window.addEventListener( 'mouseup', ( e ) => {

			if ( e.button === 0 ) this.mouseDown = false;
			if ( e.button === 2 ) this.rightDown = false;

		} );
		dom.addEventListener( 'contextmenu', ( e ) => e.preventDefault() );
		window.addEventListener( 'mousemove', ( e ) => {
			if ( this.touchMode ) return;

			if ( this.locked || this.mouseDown || this.rightDown ) {

				this.look.x += e.movementX;
				this.look.y += e.movementY;

			}

		} );
		dom.addEventListener( 'wheel', ( e ) => {

			this.wheel += Math.sign( e.deltaY );
			e.preventDefault();

		}, { passive: false } );

		document.addEventListener( 'pointerlockchange', () => {

			this.locked = document.pointerLockElement === dom;

		} );

	}

	requestLock() {

		if ( this.touchMode ) return;
		if ( ! this.locked ) this.dom.requestPointerLock?.()?.catch?.( () => {} );

	}

	down( code ) {

		return this.enabled && ( this.keys.has( code ) || this.touchKeys.has( code ) );

	}

	// true once per physical key press
	hit( code ) {

		return this.enabled && ( this.pressed.has( code ) || this.touchPressed.has( code ) );

	}

	consumeLook() {

		const l = { x: this.look.x, y: this.look.y };
		this.look.x = 0;
		this.look.y = 0;
		return l;

	}

	consumeWheel() {

		const w = this.wheel;
		this.wheel = 0;
		return w;

	}

	endFrame() {

		this.pressed.clear();
		this.touchPressed.clear();

	}

	get enabled() { return this._enabled; }
	set enabled( value ) {
		this._enabled = !! value;
		if ( ! value ) this.resetTouch();
	}

	get rightDown() { return !! ( this._rightDown || this.touchScope ); }
	set rightDown( value ) { this._rightDown = value; }

	setTouchKey( code, held ) {
		if ( ! held ) { this.touchKeys.delete( code ); return; }
		if ( ! this.enabled ) return;
		if ( ! this.touchKeys.has( code ) ) this.touchPressed.add( code );
		this.touchKeys.add( code );
	}

	tapKey( code ) { if ( this.enabled ) this.touchPressed.add( code ); }

	setTouchMove( x, y ) {
		this.move.x = this.enabled ? x : 0;
		this.move.y = this.enabled ? y : 0;
	}

	resetTouch() {
		this.touchKeys?.clear();
		this.touchPressed?.clear();
		if ( this.move ) this.move.x = this.move.y = 0;
		this.touchScope = false;
		if ( this.look ) this.look.x = this.look.y = 0;
	}

	reset() {
		this.keys.clear(); this.pressed.clear();
		this.mouseDown = this.rightDown = false;
		this.resetTouch();
	}

}
