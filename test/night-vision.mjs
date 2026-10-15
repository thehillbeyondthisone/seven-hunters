import assert from 'node:assert/strict';
import { NightVision } from '../src/player/NightVision.js';

const dark = { night: 1, outside: true };
const simulate = ( eyes, seconds, state, fps = 60 ) => {
	for ( let i = 0; i < seconds * fps; i ++ ) eyes.update( 1 / fps, state );
};
for ( const fps of [ 30, 60, 120 ] ) {
	const eyes = new NightVision();
	simulate( eyes, 3, { ...dark, lit: true, glow: 1 }, fps );
	assert.equal( eyes.exposure, 1 );
	simulate( eyes, 1, dark, fps );
	assert( eyes.strength > .4 && eyes.strength < .5, 'detail emerges gradually, without a brightness jump' );
	simulate( eyes, 4, dark, fps );
	assert( eyes.strength > .94 && eyes.exposure < 2.5, 'eyes settle over about five seconds' );
	const held = eyes.strength;
	simulate( eyes, 5, { ...dark, paused: true }, fps );
	assert.equal( eyes.strength, held, 'pauses do not silently finish adaptation' );
	simulate( eyes, 1, { ...dark, lit: true }, fps );
	assert( eyes.strength < .06, 'relighting promptly removes sensitivity' );
	simulate( eyes, 5, dark, fps );
	eyes.update( 0, { ...dark, outside: false } ); assert.equal( eyes.exposure, 1, 'interiors keep their authored lighting' );
	eyes.update( 0, { ...dark, underwater: true } ); assert.equal( eyes.exposure, 1, 'no underwater brightening' );
	eyes.update( 0, { ...dark, night: 0 } ); assert.equal( eyes.exposure, 1, 'no daytime lift' );
}
console.log( 'PASS 30/60/120fps night adaptation, gradual five-second gain, relighting, pause, interior/day/water exclusion.' );
