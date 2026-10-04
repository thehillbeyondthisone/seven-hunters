import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SEA_WEATHER, SeaWeatherState, weatherCycleAt, configureSeaPreview } from '../src/weather/SeaWeatherState.js';
import { buildCliffSites, cliffPulse } from '../src/ocean/CliffImpact.js';
import { stationShelter } from '../src/weather/SeaWeather.js';
import { TOWER } from '../src/world/flannan/Station.js';
import { CliffSurge } from '../src/ocean/CliffSurge.js';
import { G } from '../src/core/Globals.js';
import { Scene, Vector3 } from '../src/engine/index.js';
import { ShaderModule } from '../src/engine/gpu/Shader.js';
import { VIEWS } from '../src/core/DebugViews.js';

const q = new URLSearchParams( 'weatherPreview' );
assert.equal( configureSeaPreview( q ), true );
assert.equal( q.get( 'setting' ), 'flannan' );
assert.equal( q.has( 'nostory' ), true, 'weather exploration never constructs Story or reads/writes its save' );
const normal = new URLSearchParams( 'setting=tidewater' );
assert.equal( configureSeaPreview( normal ), false ); assert.equal( normal.toString(), 'setting=tidewater' );
const vr = new URLSearchParams( 'vr&weatherPreview' );
assert.equal( configureSeaPreview( vr ), false, 'preserve the separately validated VR rendering profile' );
console.log( 'ok preview isolation: normal game, saves and VR' );

const weather = new SeaWeatherState( 'gale' );
weather.select( 'settled' );
for ( let i = 0; i < 150; i ++ ) weather.update( 0.1 );
assert.ok( weather.state.wind < 7, 'wind eases' );
assert.ok( weather.state.sea > SEA_WEATHER.settled.sea + 0.2, 'swell energy persists after wind eases' );
assert.ok( weather.state.rain < 0.04 && weather.state.wet > 0.6, 'wet stone remains after rain ends' );
assert.equal( weather.select( 'unknown' ), false );
weather.update( NaN ); weather.update( - 100 );
assert.ok( Object.values( weather.state ).filter( ( x ) => typeof x === 'number' ).every( Number.isFinite ) );
let maxWindStep = 0;
for ( let t = 0; t < 260; t += 0.1 ) {
	const a = weatherCycleAt( t ), b = weatherCycleAt( t + 0.1 );
	maxWindStep = Math.max( maxWindStep, Math.abs( a.wind - b.wind ) );
	assert.ok( a.rain >= 0 && a.rain <= 1 && a.vis > 0 && a.sea > 0 );
}
assert.ok( maxWindStep < 0.04, 'cycle keys blend without abrupt jumps' );
weather.cycle();
for ( let i = 0; i < 2601; i ++ ) weather.update( 0.1 );
assert.equal( weather.cycling, false ); assert.equal( weather.preset, 'settled' );
console.log( 'ok weather cycle: continuity, finite inputs, swell memory, drying, completion' );

assert.ok( stationShelter( { x: - 5, y: TOWER.floor + 1.62, z: 2 } ) );
assert.ok( stationShelter( { x: 0, y: TOWER.deck + 1.62, z: 0 } ) );
assert.ok( ! stationShelter( { x: 3.2, y: TOWER.deck + 1.62, z: 0 } ) );
assert.ok( ! stationShelter( { x: - 5, y: 86, z: 2 } ), 'roof is exposed' );
console.log( 'ok shelter: workroom, lantern, exposed walkway and roof' );

globalThis.fetch = async ( url ) => new Response( readFileSync( new URL( '../public/terrain/flannan/' + String( url ).split( '/' ).pop(), import.meta.url ) ) );
const { loadFlannanData } = await import( '../src/world/flannan/FlannanData.js' );
const { FlannanTerrainData } = await import( '../src/world/flannan/FlannanTerrain.js' );
const F = await loadFlannanData(), T = new FlannanTerrainData( F.grids.island );
const sites = buildCliffSites( T );
assert.ok( sites.length > 30 && sites.length <= 80 );
for ( const s of sites ) {
	assert.ok( T.heightAt( s.x + s.nx * 5, s.z + s.nz * 5 ) < 0.3, 'spray launches seaward of a cliff' );
	assert.ok( s.height >= 5, 'no sandy shore/stage emitters' );
}
const windward = sites.filter( ( s ) => s.nx < - 0.6 ), lee = sites.filter( ( s ) => s.nx > 0.6 );
const avg = ( list ) => list.reduce( ( n, s ) => n + s.exposure, 0 ) / list.length;
assert.ok( avg( windward ) > avg( lee ) * 3, 'Atlantic-facing cliffs take stronger impacts' );
const west = T.landing( 'west' );
const watch = VIEWS.fWestWatch.p;
assert.ok( watch[ 1 ] > T.heightAt( watch[ 0 ], watch[ 2 ] ) + 0.5, 'landing review camera is above the actual steps' );
assert.ok( sites.some( ( s ) => Math.hypot( s.x - west.stage.x, s.z - west.stage.z ) < 35 ), 'surf reaches the west geo' );
assert.deepEqual( sites, buildCliffSites( T ), 'deterministic placement' );
assert.equal( cliffPulse( 0, 0, 14 ), 0 );
assert.ok( cliffPulse( 1.2, 0, 14 ) > 0.95 );
assert.equal( cliffPulse( 7, 0, 14 ), 0 );
assert.ok( Math.abs( cliffPulse( 15.2, 0, 14 ) - cliffPulse( 1.2, 0, 14 ) ) < 1e-6 );
console.log( `ok cliff surf: ${ sites.length } terrain-derived sites, west geo, exposure and timed impact envelope` );

let requests = 0, impacts = 0;
const surge = new CliffSurge( { scene: new Scene(), terrain: T, terrainGPU: { module: new ShaderModule( { name: 'weatherTestTerrain', code: '' } ) },
	shore: { period: { value: 14 } }, spray: { emit( p, v, count ) { requests ++; assert.ok( count > 0 && Number.isFinite( v.y ) ); } },
	audio: { cliffImpact() { impacts ++; } },
} );
const camera = { position: new Vector3( west.stage.x, 20, west.stage.z ) };
for ( let i = 0; i < 28 * 60; i ++ ) {
	requests = 0; G.time.value = i / 60;
	surge.update( 1 / 60, camera, { surf: 1 } ); assert.ok( requests <= 12, 'bounded shared spray requests' );
}
assert.ok( impacts > 0 && impacts <= 8, 'one sound per nearby site per swell period' );
const beforeJump = impacts; G.time.value = 1000;
surge.update( 1 / 60, camera, { surf: 1 } );
assert.equal( impacts, beforeJump, 'camera/review time jumps do not replay old impact sounds' );
console.log( 'ok cliff integration: bounded emission, shared impact timing and discontinuity handling' );
