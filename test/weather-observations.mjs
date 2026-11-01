import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { installBrowser } from '../tools/shots/browser.mjs';
Object.defineProperty( globalThis, 'navigator', { value: {}, writable: true, configurable: true } );
installBrowser( { root: resolve( 'public' ) } );
const { Vector3, PerspectiveCamera, Mesh, Group, BoxGeometry, BufferGeometry, Float32BufferAttribute } = await import( '../src/engine/index.js' );
const { G } = await import( '../src/core/Globals.js' );
const { pressureAt, pressureAngle, temperatureAt, windReading, seaReading, landmarkReport, visibilityReading } = await import( '../src/weather/WeatherReadings.js' );
const { SeaObservation, WeatherObservations, opaqueSegmentBlocked } = await import( '../src/story/WeatherObservations.js' );
const { prepareObservationOcclusion } = await import( '../src/story/ObservationOcclusion.js' );
const { ROOM, TOWER } = await import( '../src/world/flannan/Station.js' );
const { StoryUI } = await import( '../src/story/StoryUI.js' );
assert.equal( pressureAt( 18 ), 29.94 ); assert.equal( pressureAt( 21 ), 29.86 );
assert.ok( pressureAngle( pressureAt( 21 ) ) < pressureAngle( pressureAt( 18 ) ) );
assert.equal( temperatureAt( 18 ), 42 ); assert.equal( temperatureAt( 21 ), 40 );
assert.equal( temperatureAt( 19.5 ), 41 );
for ( const [ x, z, expected ] of [ [ 0, 1, 'N' ], [ -1, 0, 'E' ], [ 0, -1, 'S' ], [ 1, 0, 'W' ], [ 1, -1, 'SW' ] ] ) assert.equal( windReading( x, z, 9 ).direction, expected );
assert.equal( windReading( 1, -1, 9 ).label, 'Fresh breeze, SW' );
assert.equal( windReading( 1, 0, .1 ).label, 'Calm' ); assert.equal( windReading( NaN, 0, 8 ), null );
assert.equal( seaReading( Array( 9 ).fill( 0 ) ).label, 'Smooth' );
assert.equal( seaReading( [ -.5, 0, .5, -.5, 0, .5, -.5, 0, .5 ] ).label, 'Moderate' );
assert.equal( seaReading( [ 0, NaN, 0 ] ), null );
const dark = landmarkReport( { blocked: false, transmittance: .5, daylight: 0, lit: false, nearby: true } );
assert.equal( dark.status, 'dark' ); assert.ok( ! dark.label.includes( 'fog' ) );
const lamp = landmarkReport( { blocked: false, transmittance: .5, daylight: 0, lit: true, nearby: false } );
assert.equal( lamp.status, 'visible' ); assert.ok( lamp.label.includes( 'light' ) );
const fog = landmarkReport( { blocked: false, transmittance: 1e-12, daylight: 0, lit: true, nearby: false } );
assert.equal( fog.status, 'fog' );
assert.equal( landmarkReport( { blocked: true, transmittance: 0, daylight: 0, lit: true } ).status, 'blocked' );
assert.equal( visibilityReading( { status: 'blocked' }, dark ), null );
assert.ok( visibilityReading( fog, dark ).label.includes( 'darkness' ) );

const box = new Mesh( new BoxGeometry( 1, 1, 1 ), { name: 'wall' } );
assert.ok( opaqueSegmentBlocked( [ box ], new Vector3( -2, 0, 0 ), new Vector3( 2, 0, 0 ) ) );
box.position.y = 3;
assert.ok( ! opaqueSegmentBlocked( [ box ], new Vector3( -2, 0, 0 ), new Vector3( 2, 0, 0 ) ), 'real moved geometry releases a sightline' );
box.position.y = 0; const hiddenGroup = new Group(); hiddenGroup.add(box); hiddenGroup.visible = false;
assert.ok(!opaqueSegmentBlocked([box],new Vector3(-2,0,0),new Vector3(2,0,0)),'hidden scene variants do not obstruct observations');

// Material batches span distant objects. Once their bounds have been prepared,
// a clear view must not revisit every triangle merely because the mesh spans it.
const triangles = 8192, positions = new Float32Array( triangles * 9 );
for ( let i = 0; i < triangles; i ++ ) {
	const y = i < triangles / 2 ? 10 : -10;
	positions.set( [ 0, y - 1, -1, 0, y + 1, -1, 0, y, 1 ], i * 9 );
}
const batchGeometry = new BufferGeometry(); batchGeometry.setAttribute( 'position', new Float32BufferAttribute( positions, 3 ) );
const batch = new Mesh( batchGeometry, { name: 'station metalwork' } ), start = new Vector3( -2, 0, 0 ), end = new Vector3( 2, 0, 0 );
const position = batchGeometry.getAttribute( 'position' ), getX = position.getX;
let vertexReads = 0; position.getX = function ( i ) { vertexReads ++; return getX.call( this, i ); };
batch.visible = false;
prepareObservationOcclusion( [ {}, { geometry: {} }, batch ] );
assert.ok( vertexReads > 0, 'loading prepares hidden opaque variants and skips fixtures without geometry' );
batch.visible = true; vertexReads = 0;
assert.equal( opaqueSegmentBlocked( [ batch ], start, end ), false );
assert.equal( vertexReads, 0, 'the first observation reuses prepared spatial bounds without scanning triangles' );
position.setXYZ( 0, 0, -1, -1 ); position.setXYZ( 1, 0, 1, -1 ); position.setXYZ( 2, 0, 0, 1 ); position.needsUpdate = true;
assert.equal( opaqueSegmentBlocked( [ batch ], start, end ), true, 'edited geometry rebuilds its visibility bounds' );
batch.position.x = 3;
assert.equal( opaqueSegmentBlocked( [ batch ], start, end ), false, 'geometry beyond the target cannot block a finite sightline' );

const query = { cpuValid: true, cpu: new Float32Array( 256 ), resultInputs: new Float32Array( 256 ), resultTime: 0, version: 0, allocate: () => 1,
	setPoint( i, x, z ) { this.resultInputs[ i*4 ] = x; this.resultInputs[ i*4+1 ] = z; this.cpu[ i*4 ] = ( i % 3 - 1 ) * .5; this.cpu[ i*4+3 ] = -20; } };
const sea = new SeaObservation( query ); sea.begin( new Vector3( 300, 0, 0 ) );
for ( let i = 1; i <= 40; i++ ) { query.resultTime = i*.1; query.version++; sea.step( .1, query.resultTime ); }
assert.equal( sea.reading.label, 'Moderate' );
sea.step( 0, query.resultTime + .5 ); assert.equal( sea.reading, null, 'stale GPU results cannot complete a capture' );
assert.ok( sea.elapsed >= 4 - 1e-6, 'a delayed readback pauses rather than erases a completed steady hold' );
query.resultTime = 4.5; query.version ++; assert.ok( sea.step( 0, 4.5 ), 'fresh samples resume the existing hold' );

// Slow GPUs can deliver matching samples several frames late. Intermittent
// long frames still complete, while a stopped readback never records evidence.
sea.begin( new Vector3( 300, 0, 0 ) ); query.latency = .2;
for ( let i = 1; i <= 40; i ++ ) {
	query.resultTime = i * .1; query.version ++;
	sea.step( .1, query.resultTime + .6 );
	if ( i === 20 ) { const held = sea.elapsed; assert.equal( sea.step( .1, query.resultTime + 2 ), null ); assert.equal( sea.elapsed, held ); }
}
assert.equal( sea.reading.label, 'Moderate', 'measured GPU latency permits the four-second observation to complete' );
assert.equal( sea.step( 0, query.resultTime + 2 ), null, 'stopped readbacks cannot commit the reading' );
delete query.latency;
query.resultTime = 5; query.resultInputs[ 4 ] = 900; sea.step( .1, 5 ); assert.equal( sea.elapsed, 0, 'old patch results cannot accumulate' );
sea.begin( new Vector3( 300, 0, 0 ) ); query.cpu[ 4 ] = Infinity; sea.step( .1, 5 ); assert.equal( sea.elapsed, 0 );
query.cpu[ 4 ] = .2; query.cpu[ 7 ] = 0; sea.step( .1, 5 ); assert.equal( sea.elapsed, 0, 'shallow or land points remain pending' );
sea.begin( new Vector3(300,0,0) ); query.resultInputs[4] = NaN; sea.step(.1,5); assert.equal(sea.elapsed,0,'non-finite patch coordinates remain pending');
sea.begin( new Vector3(300,0,0) ); query.cpu[5] = NaN; sea.step(.1,5); assert.equal(sea.elapsed,0,'non-finite water results remain pending'); query.cpu[5] = 0;

ROOM.barometer = new Vector3( -3.6, TOWER.floor + 1.95, ROOM.z0 + .078 );
ROOM.thermometer = new Vector3( -5, TOWER.floor + 1.6, ROOM.z0 - .69 );
const camera = new PerspectiveCamera( 70, 16/9, .1, 100000 );
camera.position.copy( ROOM.barometer ).add( new Vector3( 0, 0, 1 ) ); camera.lookAt( ROOM.barometer );
const input = { enabled: true, keys: new Set(), requestLock() {}, down: () => false };
const player = { position: camera.position.clone().setY( TOWER.floor ), yaw: .4, pitch: .1, busy: false, query };
const s = { h: 18, flags: {}, obs: {}, paused: false, signal: false, rows: [], saves: 0,
	app: { camera, player, input, query, terrainData: { heightAt: () => -60 }, village: { meshes: [] }, ui: { ui: {} } }, moving: {},
	station: { parts: { windVane: new Vector3( 0, 106, 0 ) } }, her: new Vector3( 33000, 80, 0 ),
	_obsDue() { return ! this.obs[18] && this.h >= 17.9 && this.h < 20.5 ? 18 : ! this.obs[21] && this.h >= 20.9 && this.h < 23.5 ? 21 : 0; },
	save() { this.saves++; }, toast() {}, row( h, text ) { this.rows.push( [ h, text ] ); }, _readSlate() {} };
s.ui = new StoryUI( { input } );
const w = s.weatherObservations = new WeatherObservations( s );
assert.equal( w.clockScale, .4, 'the currently due unfinished round slows the clock before the first capture' ); w.begin();
const due = s._obsDue; s._obsDue = () => 0; assert.equal(w.clockScale,1,'an orphaned first-night draft does not slow a watch without weather duties'); s._obsDue = due;
s.ui.inspection = async ( { onRecord } ) => { w.updateFocus(); assert.ok( camera.fov < 30 ); onRecord(); };
const pose = camera.quaternion.clone(), feet = player.position.clone();
await w.inspect( 'pressure' );
assert.equal( w.draft.readings.pressure.value, 29.94 ); assert.equal( camera.fov, 70 );
assert.ok( camera.quaternion.dot( pose ) > .99999 && player.position.equals( feet ) && ! player.busy, 'inspection restores the actual view and feet' );
s.h = 19.2;
assert.equal( w.draft.readings.pressure.value, 29.94, 'captured pressure is not replaced by the later pointer value' );
s.flags = structuredClone( s.flags ); assert.equal( w.draft.readings.pressure.h, 18, 'partial drafts survive save restoration' );
for ( const key of [ 'temperature', 'wind', 'sea', 'visibility' ] ) w.store( key, { value: key === 'temperature' ? 42 : 1, label: key }, 'fixture' );
s.ui.observations = async q => { assert.ok( q.complete ); return 'chalk'; };
await w.slate(); assert.ok( s.obs[18].evidence ); assert.equal( s.obs[18].pressure, 29.94 );
const rowCount = s.rows.length; await w.slate(); assert.equal( s.rows.length, rowCount, 'duplicate chalking cannot duplicate the journal' );
s.h = 21; w.begin(); assert.equal( Object.keys( w.draft.readings ).length, 0, 'nine o’clock requires new evidence' );
s.ui.observations = async () => 'chalk'; await w.slate(); assert.equal( s.obs[21], undefined, 'an incomplete slate cannot be committed' );
s.h = 23.5; assert.equal( w.clockScale, 1 ); assert.equal( w.store( 'sea', { label: 'Moderate' }, 'expired' ), false, 'expired drafts never complete later entries' );
s.h = 21; document.hidden = true; assert.ok( ! w.available() ); document.hidden = false;
s.app.freeCam = true; assert.ok( ! w.available() ); s.app.freeCam = false;
s.app.ui.ui.photoMode = true; assert.ok( ! w.available() ); s.app.ui.ui.photoMode = false;
s.obs[21] = { wind: 'legacy', sea: 'Moderate', visibility: 'Fog' }; assert.equal( w.due, 0, 'legacy completed observations remain valid' );
console.log( 'PASS weather readings, wind conventions, actual geometry, fresh nine-point sea samples, darkness/fog, physical focus restoration, captured values, deadlines, duplicates and legacy save compatibility.' );
