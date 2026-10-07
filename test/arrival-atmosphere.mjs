import assert from 'node:assert/strict';
import { ArrivalSound } from '../src/audio/ArrivalSound.js';
import { rowingPose, ROWING_PERIOD } from '../src/story/ArrivalRowing.js';
import { BANK } from '../src/audio/soundBank.js';

for ( const fps of [ 120, 30, 12 ] ) {
	const calls = [];
	const s = { enabled: true, env: { lx: 0, ly: 2, lz: 0 }, _want() {}, _shotAt( ...args ) { calls.push( args ); } };
	const sound = new ArrivalSound( s );
	const boat = { visible: true, position: { x: 0, y: 0, z: 0 }, rowing: true, rowingTime: 0, paused: false };
	sound.update( 0, boat );
	for ( let i = 1; i <= Math.floor( ROWING_PERIOD * 5 * fps ); i++ ) {
		boat.rowingTime = i/fps; sound.update( 1/fps, boat );
	}
	const strokes = () => calls.filter( c => c[0] === 'arrival_stroke' );
	assert.equal( strokes().length, 5, `one sound per visible stroke at ${ fps }fps` );
	const count = calls.length;
	boat.rowing = false; boat.paused = true;
	for ( let i=0; i<fps*10; i++ ) sound.update( 1/fps, boat );
	assert.equal( calls.length, count, 'reading holds rowing and timber Foley' );
	boat.paused = false; boat.rowing = true;
	boat.position.x = 300;
	for ( let i=0; i<fps*10; i++ ) { boat.rowingTime += 1/fps; sound.update( 1/fps, boat ); }
	assert.equal( calls.length, count, 'distant departure cannot create audible close Foley' );
	boat.visible = false; sound.update( 1/fps, boat );
	assert.equal( calls.length, count, 'hidden boat is silent' );
}
assert.equal( rowingPose( ROWING_PERIOD*.3 ).immersion, 1, 'blade is immersed during pull' );
assert.equal( rowingPose( ROWING_PERIOD*.8 ).immersion, 0, 'blade clears water during recovery' );
for ( const name of [ 'arrival_stroke', 'arrival_creak' ] ) {
	assert.ok( BANK[name].slices.length >= 3 );
	assert.equal( BANK[name].slices.length, BANK[name].lufs.length );
	assert.ok( BANK[name].lufs.every( n => Number.isFinite(n) && n<0 ) );
}
assert.equal( BANK.arrival_water.file, BANK.pier_lap.file, 'external laps use dock water rather than fibreglass knocks' );
assert.equal( BANK.arrival_water.lufs, BANK.pier_lap.lufs, 'same source has same gain calibration' );
console.log( 'PASS arrival Foley: one stroke per cycle at 120/30/12fps, reading pause, distant/hidden departure, blade phase and bank calibration.' );
