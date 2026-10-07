import assert from 'node:assert/strict';
import { ShallowSea } from '../src/weather/ShallowSea.js';
import { configureSeaPreview, SEA_WEATHER, SeaWeatherState } from '../src/weather/SeaWeatherState.js';

const lake = new ShallowSea( { heightAt: ( x, z ) => Math.max( - 25, x * 0.08 + Math.sin( z / 25 ) * 2 ), res: 48, size: 480 } );
for ( let i = 0; i < 150; i ++ ) lake.update( 1 / 30 );
assert.ok( Math.max( ...lake.mx.map( Math.abs ), ...lake.mz.map( Math.abs ) ) < 1e-8, 'lake at rest remains at rest over sloping wet/dry topography' );
assert.ok( lake.h.every( ( h, i ) => Math.abs( h - lake.rest[ i ] ) < 1e-8 ), 'well-balanced bed pressure does not create phantom waves' );

const sea = new ShallowSea( { heightAt: () => - 20, res: 64, size: 512 } );
sea.seedBlast( { x: 0, z: 0, amplitude: 8, radius: 22 } );
const initialFar = Math.abs( sea.sample( 108, 4 ).height );
for ( let i = 0; i < 180; i ++ ) sea.update( 1 / 30 );
assert.ok( Math.abs( sea.sample( 108, 4 ).height ) > initialFar + 0.05, 'blast waves propagate outward rather than scaling a stationary ring' );
assert.ok( sea.h.every( x => Number.isFinite( x ) && x >= 0 ) && sea.field.every( Number.isFinite ) );
assert.ok( Math.abs( sea.sample( 68, 4 ).height - sea.sample( 4, 68 ).height ) < 1e-5, 'radial blast remains symmetric on a flat seabed' );
assert.deepEqual( sea.sample( 9999, 9999 ), { height: 0, u: 0, v: 0, foam: 0 } );

const slope = new ShallowSea( { heightAt: x => x < 0 ? - 8 : x * 0.045, res: 64, size: 512 } );
slope.seedTsunami( { x: - 105, z: 0, nx: 1, nz: 0, amplitude: 7, width: 40 } );
let flooded = false;
for ( let i = 0; i < 500; i ++ ) {
	 slope.update( 1 / 30 );
	 if ( slope.sample( 28, 4 ).height > 1.4 ) flooded = true;
}
assert.ok( flooded, 'a travelling tsunami wets initially dry low ground' );
assert.ok( slope.h.every( x => Number.isFinite( x ) && x >= 0 ) );
slope.update( NaN ); slope.update( - 5 ); slope.update( 100 );
assert.ok( slope.field.every( Number.isFinite ), 'invalid/large frame inputs remain bounded' );
slope.reset(); assert.ok( slope.field.every( x => x === 0 ) && slope.mx.every( x => x === 0 ), 'reset removes event energy and currents' );

const a = new ShallowSea( { heightAt: () => - 15, res: 48, size: 384 } );
const b = new ShallowSea( { heightAt: () => - 15, res: 48, size: 384 } );
a.seedBlast( { x: 0, z: 0 } ); b.seedBlast( { x: 0, z: 0 } );
for ( let i = 0; i < 120; i ++ ) a.update( 1 / 60 );
for ( let i = 0; i < 60; i ++ ) b.update( 1 / 30 );
assert.ok( Math.abs( a.sample( 52, 4 ).height - b.sample( 52, 4 ).height ) < 0.15, '30/60 Hz integration agrees within coarse-grid tolerance' );

const q = new URLSearchParams( 'simulation&debug' );
assert.equal( configureSeaPreview( q ), true ); assert.ok( q.has( 'nostory' ), 'standalone lab uses no watch save' );
assert.ok( SEA_WEATHER.hurricane.wind >= 32.7 && SEA_WEATHER.storm.wind < 32.7 );
const weather = new SeaWeatherState( 'settled' ); weather.select( 'hurricane' );
for ( let i = 0; i < 1200; i ++ ) weather.update( 0.1 );
assert.ok( weather.state.wind > 37 && weather.state.rain > 0.99 && weather.state.sea > 3 );
const deepSurge = new ShallowSea( { heightAt: () => - 100, res: 32, size: 384 } );
deepSurge.seedTsunami( { x:0, z:0, amplitude:250, width:750 } );
assert.equal( deepSurge.sample( 0, 0 ).foam, 0, 'a tall deep surge is not automatically whitewater' );
console.log( 'PASS coastal solver: balanced resting water, radial propagation, symmetry, wet/dry flooding, positive finite depths, frame-rate tolerance, reset and isolated hurricane sandbox.' );
