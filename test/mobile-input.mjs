import assert from 'node:assert/strict';
import { configureMobile, stickMotion, mobileAction, touchInstruction } from '../src/mobile/MobileOptions.js';
import { Input } from '../src/core/Input.js';
import { Vector3, PerspectiveCamera } from '../src/engine/index.js';
import { Interact } from '../src/story/Interact.js';
import { Story } from '../src/story/Story.js';
import { MobileControls, bindTouchTap } from '../src/mobile/MobileControls.js';

const coarse = { matchMedia: q => ( { matches: q === '(pointer: coarse)' } ) }, fine = { matchMedia: q => ( { matches: q !== '(pointer: coarse)' } ) };
const hybrid = { matchMedia: () => ( { matches: true } ) };
assert.equal( configureMobile( new URLSearchParams(), hybrid ), false, 'hybrid mouse/touch desktop keeps keyboard and mouse' );
const qs = new URLSearchParams();
assert.equal( configureMobile( qs, coarse ), true );
assert.equal( qs.has( 'noSim' ), true ); assert.equal( qs.has( 'noCliffSurf' ), true );
assert.equal( qs.get( 'G' ), '16' ); assert.equal( qs.get( 'scale' ), '0.7' );
for ( const search of [ 'mobile=0', 'vr', 'setting=tidewater', 'bench' ] ) {
	const q = new URLSearchParams( search ), before = q.toString();
	assert.equal( configureMobile( q, coarse ), false ); assert.equal( q.toString(), before );
}
assert.equal( configureMobile( new URLSearchParams(), fine ), false );
for ( const navigator of [ { userAgent: 'iPhone', maxTouchPoints:5 }, { userAgent:'Mozilla/5.0 (Macintosh)', platform:'MacIntel', maxTouchPoints:5 }, { userAgent:'Android', maxTouchPoints:5 } ] ) {
	const env = { ...fine, navigator };
	assert.equal( configureMobile( new URLSearchParams(), env ), true, 'handhelds select touch controls despite desktop pointer reporting' );
	assert.equal( configureMobile( new URLSearchParams( 'mobile=0' ), env ), false, 'explicit mouse override still wins' );
}
assert.equal( configureMobile( new URLSearchParams(), { navigator:{ maxTouchPoints:5 } } ), true, 'touch-only device without media-query support' );
assert.equal( configureMobile( new URLSearchParams(), { ...fine, navigator:{ platform:'MacIntel', maxTouchPoints:0 } } ), false, 'ordinary Macs keep desktop input' );
const override = new URLSearchParams( 'mobile&scale=0.9&G=24&bench' );
assert.equal( configureMobile( override, fine ), true ); assert.equal( override.get( 'scale' ), '0.9' ); assert.equal( override.get( 'G' ), '24' );
assert.equal( stickMotion( 2, 2 ).x, 0 ); assert.equal( stickMotion( 2, 2 ).y, 0 );
const diagonal = stickMotion( 200, -200 );
assert.ok( Math.abs( Math.hypot( diagonal.x, diagonal.y ) - 1 ) < 1e-9 ); assert.ok( diagonal.x > 0 && diagonal.y > 0 );
assert.ok( stickMotion( 0, -25 ).y > 0 && stickMotion( 0, -25 ).y < 1 );
assert.equal( touchInstruction( 'Face the lens and hold E to light the lamp.' ), 'Face the lens and hold the action button to light the lamp.' );
console.log( 'ok mobile selection, desktop/VR exclusions, overrides, analogue dead zone and instruction text' );

globalThis.window = new EventTarget(); globalThis.document = new EventTarget();
const canvas = new EventTarget(); let locks = 0; canvas.requestPointerLock = () => { locks ++; };
const input = new Input( canvas, { touch: true } ); input.requestLock(); assert.equal( locks, 0 );
const fire = ( target, type, props = {} ) => { const event = new Event( type, { cancelable:true } ); Object.assign( event, props ); target.dispatchEvent( event ); };
input.setTouchKey( 'KeyE', true ); assert.equal( input.hit( 'KeyE' ), true ); assert.equal( input.down( 'KeyE' ), true );
input.endFrame(); assert.equal( input.hit( 'KeyE' ), false ); assert.equal( input.down( 'KeyE' ), true );
input.setTouchKey( 'KeyE', false ); assert.equal( input.down( 'KeyE' ), false );
input.tapKey( 'Enter' ); assert.equal( input.hit( 'Enter' ), true ); assert.equal( input.down( 'Enter' ), false ); input.endFrame();
fire( window, 'keydown', { code:'KeyW' } ); input.setTouchKey( 'ShiftLeft', true ); input.setTouchMove( .5, .4 ); input.touchScope = true;
input.enabled = false;
assert.deepEqual( input.move, { x:0, y:0 } ); assert.equal( input.rightDown, false ); assert.equal( input.touchKeys.size, 0 );
input.setTouchKey( 'KeyE', true ); assert.equal( input.touchKeys.size, 0 ); assert.equal( input.down( 'KeyW' ), false );
input.enabled = true; assert.equal( input.down( 'KeyW' ), true ); fire( window, 'keyup', { code:'KeyW' } );
input.setTouchKey( 'KeyE', true ); input.setTouchMove( 1, 1 ); input.touchScope = true; fire( window, 'blur' );
assert.equal( input.down( 'KeyE' ), false ); assert.deepEqual( input.move, { x:0, y:0 } ); assert.equal( input.rightDown, false );
input.setTouchMove( 1, 0 ); document.hidden = true; fire( document, 'visibilitychange' ); assert.equal( input.move.x, 0 ); document.hidden = false;
const mouseInput = new Input( canvas ); mouseInput.requestLock(); assert.equal( locks, 1 );
fire( canvas, 'mousedown', { button:2 } ); assert.equal( mouseInput.rightDown, true ); fire( window, 'mouseup', { button:2 } ); assert.equal( mouseInput.rightDown, false );
console.log( 'ok virtual press/hold/tap, disabled-input gating, independent keyboard input, blur/background cleanup and desktop mouse' );

const camera = new PerspectiveCamera( 70, 2, .1, 100 ); const player = { busy:false, prompt:null };
const interact = new Interact( { camera, input, player } );
let uses = 0, winding = 0;
interact.add( { id:'crank', at:new Vector3( 0, 0, -1 ), text:'Wind the machine', hold:1e9, progress:() => winding, onHold:dt => { winding = Math.min( 1, winding + dt ); } } );
input.setTouchKey( 'KeyE', true ); interact.update( .3 ); input.endFrame(); interact.update( .2 );
assert.equal( winding, .5 ); assert.equal( player.prompt.hold, true ); assert.equal( player.prompt.progress, .5 );
input.setTouchKey( 'KeyE', false ); interact.update( .2 ); assert.equal( winding, .5 );
interact.items = []; interact.add( { id:'gate', at:new Vector3( 0, 0, -1 ), text:'Open gate', use:() => { uses ++; } } );
input.tapKey( 'KeyE' ); interact.update( .1 ); input.endFrame(); interact.update( .1 ); assert.equal( uses, 1 );
const app = { player, story:{ interact, aboard:false } };
assert.equal( mobileAction( app ).target, 'gate' ); assert.equal( mobileAction( app ).label, 'Open gate' );
app.story.aboard = true; app.story.arrival = { ready:false }; assert.equal( mobileAction( app ).kind, 'landing' );
assert.equal( mobileAction( app ).label, 'Go to landing' );
app.story.arrival.ready = true; assert.equal( mobileAction( app ).label, 'Step ashore' );
app.story.signal = true; assert.equal( mobileAction( app ).kind, 'leave' );
app.story.signal = app.story.aboard = false; player.prompt = null; assert.equal( mobileAction( app ).disabled, true );
console.log( 'ok real interaction tap/continuous winding/cancel and boat/shore/signal action routing' );

const button = new EventTarget(); button.setPointerCapture = () => {};
let taps = 0; bindTouchTap( button, () => { taps ++; } );
input.setTouchMove( .5, .8 );
const finger = { pointerId:2, button:0, clientX:100, clientY:100 };
fire( button, 'pointerdown', finger ); fire( button, 'pointerup', finger );
assert.equal( taps, 1, 'button acts on second-finger release while movement is held' );
assert.equal( input.move.y, .8, 'button does not cancel the walking finger' );
fire( button, 'click', { detail:1 } ); assert.equal( taps, 1, 'compatibility click cannot advance twice' );
fire( button, 'pointerdown', finger ); fire( button, 'pointermove', { ...finger, clientX:130 } ); fire( button, 'pointerup', finger );
assert.equal( taps, 1, 'dragging off a button cancels activation' );
fire( button, 'pointerdown', finger ); fire( button, 'pointercancel', finger ); fire( button, 'pointerup', finger );
assert.equal( taps, 1, 'cancelled touch cannot activate' );
button.disabled = true; fire( button, 'pointerdown', finger ); fire( button, 'pointerup', finger ); fire( button, 'click' );
assert.equal( taps, 1, 'disabled button cannot activate' );
const accessibleButton = new EventTarget(); accessibleButton.setPointerCapture = () => {};
bindTouchTap( accessibleButton, () => { taps ++; } ); fire( accessibleButton, 'click', { detail:0 } );
assert.equal( taps, 2, 'assistive/keyboard click remains available' ); input.resetTouch();
console.log( 'ok simultaneous touch activation, duplicate-click suppression, cancellation and accessible clicks' );

let papers = 0, leaves = 0;
const story = Object.assign( Object.create( Story.prototype ), { app:{ mobile:{ paused:true } }, ui:{ open:false }, paused:false, beat:'watch', signal:false,
	_readPapers:() => { papers ++; }, _leaveSignal:() => { leaves ++; }, h:18,
} );
story.mobileCommand( 'papers' ); assert.equal( papers, 0 ); story.update( 10 ); assert.equal( story.h, 18 );
story.app.mobile.paused = false; story.mobileCommand( 'papers' ); assert.equal( papers, 1 );
story.ui.open = true; story.mobileCommand( 'papers' ); assert.equal( papers, 1 ); story.ui.open = false;
story.signal = true; story.mobileCommand( 'read' ); assert.equal( story._hurry, true );
story.mobileCommand( 'leave' ); assert.equal( leaves, 1 ); story.mobileCommand( 'papers' ); assert.equal( papers, 1 );
console.log( 'ok mobile pause freezes the director, modal gating, papers and signal commands' );

const menuApp = { input, devMenu:{ open:true }, ui:{ ui:{ panelOpen:false, helpEl:{ hidden:true }, photoMode:false } },
	player:{ velocity:new Vector3( 2, 0, 3 ) }, story:{ ui:{ open:false }, paused:false, signal:false, beat:'watch' } };
const controls = Object.assign( Object.create( MobileControls.prototype ), { app:menuApp, input, started:true, menuOpen:false } );
input.enabled = true; input.setTouchMove( 1, 0 ); input.setTouchKey( 'KeyE', true );
assert.equal( controls.available, false ); controls.beforeFrame();
assert.equal( input.enabled, false ); assert.equal( input.down( 'KeyE' ), false ); assert.equal( input.move.x, 0 );
assert.equal( menuApp.player.velocity.x, 0 ); assert.equal( menuApp.player.velocity.z, 0 );
controls.beforeFrame(); assert.equal( input.enabled, false, 'menu cannot leak input on a later frame' );
menuApp.devMenu.open = false; controls.beforeFrame();
assert.equal( controls.available, true ); assert.equal( input.enabled, true );
assert.equal( input.down( 'KeyE' ), false, 'closing the menu must not resume a held action' );
console.log( 'ok experiences menu blocks mobile input across frames, stops motion and resumes without held actions' );
