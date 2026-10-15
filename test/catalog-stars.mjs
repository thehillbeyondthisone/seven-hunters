// CPU astronomy/index validation; intentionally independent of a browser or GPU.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Matrix3, Vector3 } from '../src/engine/math/index.js';
import { greenwichSiderealTime, worldToEquatorialMatrix, precessJ2000, propagateStar } from '../src/sky/StarCoordinates.js';
import { STAR_GRID, STAR_SUPPORT, buildStarIndex, starCell } from '../src/sky/CatalogStars.js';

const J2000 = Date.UTC( 2000, 0, 1, 12 ), RAD = Math.PI / 180;
const historicalTime = Date.UTC( 1901, 0, 15, 22 );
const near = ( actual, expected, tolerance, label ) => assert.ok( Math.abs( actual - expected ) <= tolerance, `${ label }: ${ actual } vs ${ expected }` );
const vectorNear = ( actual, expected, tolerance, label ) => assert.ok( actual.distanceTo( expected ) <= tolerance, `${ label }: ${ actual.toArray() } vs ${ expected.toArray() }` );
const signedDegrees = ( angle ) => ( ( angle + 180 ) % 360 + 360 ) % 360 - 180;
const eq = ( ra, dec ) => new Vector3( Math.cos( dec * RAD ) * Math.cos( ra * RAD ), Math.cos( dec * RAD ) * Math.sin( ra * RAD ), Math.sin( dec * RAD ) );
const toWorld = ( v, ms, lat, lon, turn = 0 ) => v.clone().applyMatrix3( worldToEquatorialMatrix( ms, lat, lon, turn ).transpose() );

// J2000 epoch value and Earth rotation rate: a solar day advances the fixed-star sky,
// whereas a sidereal day returns it. The rounded 23h56m4s value is within 0.001 deg.
near( greenwichSiderealTime( J2000 ), 280.46061837, 1e-9, 'GMST at J2000' );
near( signedDegrees( greenwichSiderealTime( J2000 + 86400000 ) - greenwichSiderealTime( J2000 ) ), .98564736629, 1e-8, 'one solar day' );
near( signedDegrees( greenwichSiderealTime( historicalTime + 86164000 ) - greenwichSiderealTime( historicalTime ) ), 0, .001, 'one rounded sidereal day' );
near( signedDegrees( greenwichSiderealTime( historicalTime + 6 * 3600000 ) - greenwichSiderealTime( historicalTime ) ), 90.24641184, 1e-6, 'six-hour night rotation' );
assert.ok( greenwichSiderealTime( historicalTime ) >= 0 && greenwichSiderealTime( historicalTime ) < 360 );

// World axes are east/up/south. These geometrically exact cases catch longitude,
// transpose and handedness mistakes without repeating the implementation formula.
const zeroSiderealLongitude = - greenwichSiderealTime( J2000 );
vectorNear( toWorld( eq( 0, 0 ), J2000, 0, zeroSiderealLongitude ), new Vector3( 0, 1, 0 ), 1e-12, 'equatorial meridian at zenith' );
vectorNear( toWorld( eq( 90, 0 ), J2000, 0, zeroSiderealLongitude ), new Vector3( 1, 0, 0 ), 1e-12, 'rising star is east' );
vectorNear( toWorld( eq( 270, 0 ), J2000, 0, zeroSiderealLongitude ), new Vector3( - 1, 0, 0 ), 1e-12, 'setting star is west' );
const latitude = 58.288;
vectorNear( toWorld( eq( 0, 90 ), J2000, latitude, zeroSiderealLongitude ), new Vector3( 0, Math.sin( latitude * RAD ), - Math.cos( latitude * RAD ) ), 1e-12, 'north pole altitude equals latitude' );
vectorNear( toWorld( eq( 90, 0 ), J2000, 0, zeroSiderealLongitude + 90 ), new Vector3( 0, 1, 0 ), 1e-12, 'east longitude advances local sidereal time' );
const turn = .83, up = new Vector3( 0, 1, 0 ), direction = eq( 37, - 12 );
vectorNear( toWorld( direction, historicalTime, latitude, - 7.588, turn ), toWorld( direction, historicalTime, latitude, - 7.588 ).applyAxisAngle( up, turn ), 1e-12, 'same azimuth rotation as sun/moon' );
const matrix = new Matrix3();
assert.equal( worldToEquatorialMatrix( J2000, latitude, - 7.588, 0, matrix ), matrix, 'caller-owned matrix is reused' );
near( matrix.determinant(), 1, 1e-12, 'orientation preserves handedness' );
console.log( 'ok sidereal epoch/rate, rising/setting, latitude/longitude, handedness and azimuth' );

// Independent numeric fixture: IAU SOFA release 2023-10-11, t_sofa_c.c / t_pmat76.
// Official source bundle: https://www.iausofa.org/2023-10-11c
// JD = 2400000.5 + 50123.9999. The fixture is the J2000 -> date rotation.
const fixtureTime = J2000 + ( 2450124.4999 - 2451545 ) * 86400000;
const sofaRows = [
  [ .9999995504328350733, .0008696632209480960785, .0003779153474959888345 ],
  [ -.0008696632209485112192, .9999996218428560614, -.0000001643284776111886407 ],
  [ -.0003779153474950335077, -.0000001643306746147366896, .9999999285899790119 ],
];
for ( let column = 0; column < 3; column ++ ) {
  const basis = new Vector3( column === 0 ? 1 : 0, column === 1 ? 1 : 0, column === 2 ? 1 : 0 );
  vectorNear( precessJ2000( basis, fixtureTime ), new Vector3( ...sofaRows.map( row => row[ column ] ) ), 2e-13, `SOFA precession basis ${ column }` );
}
vectorNear( precessJ2000( direction, J2000 ), direction, 1e-12, 'J2000 identity precession' );

// pmra is mu_alpha*cos(dec), so 1000 mas/year is 100 arcsec along the
// tangent over 100 Julian years even at dec=60, with a positive eastward sign.
const row = [ 1, 1, 'synthetic', 0, 60, 2, null, 1000, 0 ], still = [ ...row ];
still[ 7 ] = 0;
const future = J2000 + 100 * 365.25 * 86400000;
const moved = propagateStar( row, future ), fixed = propagateStar( still, future );
near( moved.angleTo( fixed ), Math.atan( 100 / 3600 * RAD ), 1e-10, 'tangential proper-motion amplitude' );
assert.ok( moved.clone().sub( fixed ).dot( precessJ2000( new Vector3( 0, 1, 0 ), future ) ) > 0, 'positive pmra moves east' );
const polar = propagateStar( [ 2, 2, 'polar', 120, 90, 2, null, 1000, - 1000 ], historicalTime );
assert.ok( polar.toArray().every( Number.isFinite ), 'proper motion remains finite at celestial poles' );
near( polar.length(), 1, 1e-12, 'propagated star is normalized' );
console.log( 'ok SOFA precession fixture and proper-motion amplitude/sign/pole safety' );

const catalog = JSON.parse( readFileSync( new URL( '../src/sky/data/bright-stars.json', import.meta.url ), 'utf8' ) );
assert.deepEqual( catalog.columns, [ 'id', 'hip', 'name', 'ra', 'dec', 'mag', 'ci', 'pmra', 'pmdec' ] );
assert.ok( catalog.stars.length > 8000 && catalog.stars.length < 10000, 'naked-eye catalog contains thousands of real stars' );
assert.equal( new Set( catalog.stars.map( row => row[ 0 ] ) ).size, catalog.stars.length, 'catalog IDs are unique' );
for ( const row of catalog.stars ) {
  assert.ok( row[ 3 ] >= 0 && row[ 3 ] < 360 && row[ 4 ] >= - 90 && row[ 4 ] <= 90, 'catalog RA/Dec bounds' );
  assert.ok( row[ 5 ] <= 6.5 && row[ 5 ] > - 2, 'naked-eye magnitude selection excludes the sun' );
  assert.ok( row.slice( 3 ).every( value => value === null || Number.isFinite( value ) ), 'finite catalog photometry/astrometry' );
}
const byHip = new Map( catalog.stars.map( row => [ row[ 1 ], row ] ) );
for ( const hip of [ 11767, 32349, 27989, 24436, 26727, 26311, 25930, 91262, 24608 ] ) assert.ok( byHip.has( hip ), `recognizable bright star HIP ${ hip }` );
near( byHip.get( 32349 )[ 5 ], - 1.44, .03, 'Sirius visual magnitude' );
const polaris = propagateStar( byHip.get( 11767 ), historicalTime );
const poleOffset = polaris.angleTo( new Vector3( 0, 0, 1 ) ) / RAD;
assert.ok( poleOffset > 1.1 && poleOffset < 1.3, `1901 Polaris pole offset reflects historical precession: ${ poleOffset } deg` );

// The belt must retain its recognizable spacing; a bad degree/hour conversion,
// coordinate column swap or source truncation turns these into unrelated points.
const belt = [ 26727, 26311, 25930 ].map( hip => propagateStar( byHip.get( hip ), historicalTime ) );
const beltDistances = [ belt[ 0 ].angleTo( belt[ 1 ] ), belt[ 1 ].angleTo( belt[ 2 ] ) ].map( a => a / RAD );
assert.ok( beltDistances.every( a => a > 1.2 && a < 1.5 ), `Orion belt neighbors: ${ beltDistances } deg` );
console.log( `ok ${ catalog.stars.length } catalog rows, bright-star identities, historical Polaris and Orion belt` );

function containsStar( index, direction, query, magnitude, seed ) {
  const cell = starCell( query ), start = index.data[ cell * 4 ], count = index.data[ cell * 4 + 1 ];
  for ( let k = 0; k < count; k ++ ) {
    const offset = ( start + 2 * k ) * 4, d = index.data;
    if ( Math.hypot( d[ offset ] - direction.x, d[ offset + 1 ] - direction.y, d[ offset + 2 ] - direction.z ) < 1e-6
      && Math.abs( d[ offset + 3 ] - magnitude ) < 1e-5 && Math.abs( d[ offset + 7 ] - seed ) < 1e-6 ) return true;
  }
  return false;
}

const index = buildStarIndex( catalog.stars, historicalTime );
assert.equal( index.count, catalog.stars.length );
assert.equal( index.cellCount, 6 * STAR_GRID * STAR_GRID );
assert.ok( index.data instanceof Float32Array && index.data.length > index.cellCount * 4 );
let maximum = 0, candidates = 0;
for ( let cell = 0; cell < index.cellCount; cell ++ ) {
  const start = index.data[ cell * 4 ], count = index.data[ cell * 4 + 1 ];
  assert.ok( Number.isInteger( start ) && Number.isInteger( count ) && count >= 0, 'integer index headers' );
  assert.ok( start >= index.cellCount && ( start + 2 * count ) * 4 <= index.data.length, 'candidate span in storage buffer' );
  maximum = Math.max( maximum, count ); candidates += count;
}
assert.equal( maximum, index.maxOccupancy );
assert.equal( index.data.length, index.cellCount * 4 + candidates * 8, 'no unused storage tail' );
assert.ok( maximum < 64, `bounded shader loop candidates: ${ maximum }` );
for ( const row of catalog.stars ) {
  const d = propagateStar( row, historicalTime ), seed = ( row[ 0 ] * .61803398875 ) % 1;
  assert.ok( containsStar( index, d, d, row[ 5 ], seed ), `indexed centroid of HIP ${ row[ 1 ] } / HYG ${ row[ 0 ] }` );
}

// Exercise every face seam, both signs, and all corners. A query within the
// point-source support must find its source even when it changes cube faces.
const seamDirections = [];
for ( let axis = 0; axis < 3; axis ++ ) for ( let sign = - 1; sign <= 1; sign += 2 ) {
  const d = [ 0, 0, 0 ]; d[ axis ] = sign; seamDirections.push( new Vector3( ...d ) );
}
for ( let minor = 0; minor < 3; minor ++ ) for ( let a = - 1; a <= 1; a += 2 ) for ( let b = - 1; b <= 1; b += 2 ) {
  for ( const along of [ - 1, -.99, -.7, -.1, 0, .1, .7, .99, 1 ] ) for ( const epsilon of [ - 1e-7, 0, 1e-7 ] ) {
    const d = [ 0, 0, 0 ];
    d[ minor ] = along; d[ ( minor + 1 ) % 3 ] = a; d[ ( minor + 2 ) % 3 ] = b * ( 1 + epsilon );
    seamDirections.push( new Vector3( ...d ).normalize() );
  }
}
const synthetic = seamDirections.map( ( d, i ) => [ i + 1, 0, '', ( Math.atan2( d.y, d.x ) / RAD + 360 ) % 360, Math.asin( d.z ) / RAD, 1, null, 0, 0 ] );
const seams = buildStarIndex( synthetic, J2000 );
let supportChecks = 0;
for ( let i = 0; i < synthetic.length; i ++ ) {
  const row = synthetic[ i ], d = propagateStar( row, J2000 ), seed = ( row[ 0 ] * .61803398875 ) % 1;
  const reference = Math.abs( d.z ) < .9 ? new Vector3( 0, 0, 1 ) : new Vector3( 1, 0, 0 );
  const tangent = new Vector3().crossVectors( d, reference ).normalize(), bitangent = new Vector3().crossVectors( d, tangent ).normalize();
  for ( const radius of [ 0, STAR_SUPPORT * .5, STAR_SUPPORT * .999 ] ) for ( let angle = 0; angle < 32; angle ++ ) {
    const a = angle * Math.PI / 16;
    const q = d.clone().multiplyScalar( Math.cos( radius ) ).addScaledVector( tangent, Math.sin( radius ) * Math.cos( a ) ).addScaledVector( bitangent, Math.sin( radius ) * Math.sin( a ) );
    assert.ok( containsStar( seams, d, q, row[ 5 ], seed ), `missing PSF support at cube seam ${ i } / ${ radius } / ${ angle }` );
    supportChecks ++;
  }
}
console.log( `ok every catalog centroid and ${ supportChecks } synthetic support queries across cube faces/seams/corners; max ${ maximum } candidates/cell, ${ index.data.byteLength } bytes` );

// Exercise the actual time plumbing and daily cache, while GPU resources remain lazy.
const { Sky } = await import( '../src/sky/Sky.js' );
const { Setting } = await import( '../src/sky/Setting.js' );
const sky = new Sky( {} ), setting = new Setting( 'flannan' );
assert.equal( sky.starCatalog.gpu, null, 'sky/catalog construction needs no GPU' );
setting.dayOffset = 31;
const time = setting.update( 22 );
near( time.ut, Date.UTC( 1901, 0, 15, 22 ) - setting.lon / 15 * 3600000, .001, 'Flannan local solar time -> UT across calendar/year boundary' );
sky.setStarTime( time.ut, setting.lat, setting.lon, turn );
const firstIndex = sky.starIndex, firstBuffer = sky.starCatalog;
const firstMatrix = sky.params.fields.worldToStars.value.clone();
sky.setStarTime( time.ut + 3600000, setting.lat, setting.lon, turn );
assert.equal( sky.starIndex, firstIndex, 'within-day time changes reuse star index' );
assert.equal( sky.starCatalog, firstBuffer, 'within-day time changes reuse storage' );
assert.ok( ! sky.params.fields.worldToStars.value.equals( firstMatrix ), 'orientation follows the night within cached day' );
sky.setStarTime( time.ut + 3600000, setting.lat, setting.lon, turn + .25 );
assert.equal( sky.starIndex, firstIndex, 'azimuth changes reuse catalog' );
assert.ok( sky.params.fields.worldToStars.value.equals( worldToEquatorialMatrix( time.ut + 3600000, setting.lat, setting.lon, turn + .25 ) ), 'azimuth updates orientation on cached day' );
sky.setStarTime( time.ut + 86400000, setting.lat, setting.lon, turn );
assert.notEqual( sky.starIndex, firstIndex, 'date change rebuilds astrometric positions' );
assert.equal( sky.starCatalog.gpu, null, 'daily rebuild remains GPU-lazy' );
assert.equal( sky.starCatalog.pendingData, sky.starIndex.data, 'next render receives new daily positions' );
assert.equal( sky.module.bindings.skyCatalog.storage(), sky.starCatalog, 'module resolves the current catalog buffer' );
const tidewater = new Setting( 'tidewater' ), tropical = tidewater.update( 12 );
assert.equal( tropical.dated, false );
assert.equal( tropical.ut, J2000, 'undated world uses documented J2000 reference noon' );
const { sunDirectionFromTime } = await import( '../src/sky/Sky.js' );
vectorNear( tropical.sun, sunDirectionFromTime( 12, tidewater.lat, tidewater.declination ), 1e-12, 'undated sun behavior preserved' );
console.log( 'ok dated/undated time plumbing, calendar rollover, daily index cache and GPU-lazy updates' );

// Call the live App.updateSun implementation on a minimal host, avoiding renderer setup.
const { App } = await import( '../src/App.js' );
const call = [], integratedSky = {
  starIntensity: { value: 0 }, moonDir: { value: new Vector3() }, moonShade: { value: 0 }, moonLight: { value: 0 },
  setStarTime: ( ...args ) => call.push( args ),
};
const host = { setting, settings: { timeOfDay: 21, sunAzimuth: 37 }, atmosphere: { sunDir: { value: new Vector3() } }, sky: integratedSky };
App.prototype.updateSun.call( host );
assert.equal( call.length, 1 );
near( call[ 0 ][ 0 ], setting.update( 21 ).ut, .001, 'App forwards current dated UT' );
assert.deepEqual( call[ 0 ].slice( 1 ), [ setting.lat, setting.lon, 37 * RAD ], 'App forwards site and same sun/moon azimuth' );
host.settings.timeOfDay = 23;
App.prototype.updateSun.call( host );
near( call[ 1 ][ 0 ] - call[ 0 ][ 0 ], 7200000, .001, 'App updates star orientation as time advances' );
console.log( 'ok live App.updateSun forwards UT, observing site and azimuth every update' );
