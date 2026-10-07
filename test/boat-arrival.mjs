import assert from 'node:assert/strict';
import { BoatArrival, DEPARTURE_VISIBLE_SECONDS } from '../src/story/BoatArrival.js';
import { LANDING_PROBES, LANDING_FLOOR } from '../src/world/boat/LandingBoat.js';
import { Group, PerspectiveCamera, Vector3 } from '../src/engine/index.js';
import { G } from '../src/engine/render/Frame.js';

const query = { cpu: new Float32Array( 256 ), inputs: new Float32Array( 256 ), resultInputs: new Float32Array( 256 ),
	cpuValid: false, version: 0, resultTime: 0, allocate: () => 3,
	setPoint( i, x, z ) { this.inputs[ i * 4 ] = x; this.inputs[ i * 4 + 1 ] = z; },
};
const app = { query, scene: new Group(), camera: new PerspectiveCamera( 70, 16 / 9, 0.1, 1000 ),
	village: { station: { landings: { east: { stage: { x: 123, z: 44 }, dir: [ 0.94, 0.34 ] } } } },
	player: { velocity: new Vector3(), position: new Vector3(), yaw: 0, pitch: 0 },
	input: { enabled: true, consumeLook: () => ( { x: 0, y: 0 } ) }, freeCam: false,
};
const detailed = process.argv.includes( '--atmosphere' );
app.isArrivalAtmosphere = detailed;
const boat = new BoatArrival( app );
G.seaLevel.value = 0; G.time.value = 0;
boat.begin();
assert.ok( app.camera.position.y > ( detailed ? 2.45 : 2.7 ), 'initial eye has freeboard before the first water readback' );
query.cpuValid = true;
query.cpu.fill( 150 ); // distant origin result, never the arrival's position
boat.update( 1 / 60, { aboard: true, paused: true } );
assert.equal( boat.hasWater, false, 'reject readbacks issued at a different position' );
assert.ok( app.camera.position.y < 4, 'stale heights cannot throw the passenger skyward' );
query.cpuValid = false;

// A three-frame delayed, uneven crossing sea. Includes a long title-screen wait,
// reading, a moving approach, landing wait and departure, at several frame rates.
const water = ( x, z, t ) => 1.2 * Math.sin( t * 1.2 + x * 0.12 + z * 0.17 )
	+ 0.5 * Math.sin( t * 2.4 + x * 0.62 - z * 0.2 );
let minEye = Infinity, minFloor = Infinity, lowestY = Infinity, highestY = -Infinity;
const v = new Vector3();
for ( const dt of [ 1 / 120, 1 / 30, 1 / 12 ] ) {
	boat.begin(); boat.elapsed = 0;
	const pending = [];
	for ( let i = 0; i < Math.ceil( 150 / dt ); i ++ ) {
		G.time.value += dt;
		const paused = i * dt < 25 || ( i * dt > 45 && i * dt < 65 );
		boat.update( dt, { aboard: true, paused } );
		if ( i * dt < 25 ) assert.equal( boat.elapsed, 0, 'title screen holds the route clock' );
		const t = G.time.value, inputs = query.inputs.slice();
		pending.push( { t, inputs } );
		if ( pending.length > 3 ) {
			const s = pending.shift(); query.resultInputs.set( s.inputs );
			for ( let j = 0; j < LANDING_PROBES.length; j ++ ) {
				const k = ( boat.slot + j ) * 4;
				query.cpu[ k ] = water( s.inputs[ k ], s.inputs[ k + 1 ], s.t );
			}
			query.cpuValid = true; query.resultTime = s.t; query.version ++;
		}
		if ( i < 10 ) continue;
		const eye = app.camera.position;
		minEye = Math.min( minEye, eye.y - water( eye.x, eye.z, t ) );
		for ( const [ x, z ] of LANDING_PROBES ) {
			v.set( x, LANDING_FLOOR, z ).applyMatrix4( boat.group.matrixWorld );
			minFloor = Math.min( minFloor, v.y - water( v.x, v.z, t ) );
		}
		lowestY = Math.min( lowestY, boat.heave ); highestY = Math.max( highestY, boat.heave );
		assert.ok( Number.isFinite( eye.y ), 'finite camera during delayed readback' );
	}
}
assert.ok( minEye > 0.9, `passenger lens stays above the delayed sea: ${ minEye.toFixed( 3 ) }m` );
assert.ok( minFloor > 0.02, `floor stays above water even at 12fps / 250ms latency: ${ minFloor.toFixed( 3 ) }m` );
assert.ok( highestY - lowestY > 1, 'boat follows the waves while paused' );
boat.departure = 0;
const oldMotion = boat.motionTime;
boat.update( 1, { paused: true } );
assert.equal( boat.departure, 0, 'photo mode holds departure progress' );
assert.ok( boat.motionTime > oldMotion, 'departing hull still floats in photo mode' );
boat.update( 70 ); assert.equal( boat.group.visible, true, 'boat remains visible for the stair-crest look back' );
boat.update( DEPARTURE_VISIBLE_SECONDS ); assert.equal( boat.group.visible, false, 'departure eventually leaves the scene' );
console.log( `PASS arrival flotation: title / reading / approach / landing / departure, 120/30/12fps, three-frame readback delay; minimum lens ${ minEye.toFixed( 2 ) }m, floor ${ minFloor.toFixed( 2 ) }m above simulated water.` );
