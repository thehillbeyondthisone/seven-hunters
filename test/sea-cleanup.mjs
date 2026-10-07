// Extreme range acceptance against the actual island terrain, without a GPU.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ShallowSea } from '../src/weather/ShallowSea.js';

globalThis.fetch = async u => new Response( readFileSync( resolve( 'public/terrain/flannan', String( u ).split( '/' ).pop() ) ) );
const { loadFlannanData } = await import( '../src/world/flannan/FlannanData.js' );
const { FlannanTerrainData } = await import( '../src/world/flannan/FlannanTerrain.js' );
const data = await loadFlannanData(), terrain = new FlannanTerrainData( data.grids.island );
const l = terrain.landing( 'west' ), len = Math.hypot( ...l.dir ), nx = l.dir[ 0 ] / len, nz = l.dir[ 1 ] / len;
const sea = new ShallowSea( { heightAt: ( x, z ) => terrain.heightAt( x, z ), res: 160, size: 1536 } );
const land = [ ...sea.bed.keys() ].filter( i => sea.bed[ i ] > 1 );
sea.seedTsunami( { x: l.stage.x + nx * 320, z: l.stage.z + nz * 320, nx: -nx, nz: -nz, amplitude: 250, width: 750 } );
let peakWet = 0, peakTime = 0, peakMinDepth = 0;
for ( let step = 0; step < 700; step ++ ) {
	sea.update( 0.1 );
	const wet = land.filter( i => sea.h[ i ] > 0.1 ).length;
	if ( wet > peakWet ) { peakWet = wet; peakTime = sea.time; peakMinDepth = Math.min( ...land.map( i => sea.h[ i ] ) ); }
	assert.ok( sea.field.every( Number.isFinite ) && sea.h.every( h => h >= 0 ), 'maximum crest retains finite, nonnegative water' );
	if ( wet === land.length ) break;
}
mkdirSync( 'artifacts/sea-cleanup', { recursive: true } );
const result = { incomingCrestM:250, landCells:land.length, floodedLandCells:peakWet, coverage:peakWet/land.length, timeSeconds:peakTime, minimumDepthM:peakMinDepth, highestTerrainM:Math.max( ...sea.bed ), predictiveModel:false };
writeFileSync( 'artifacts/sea-cleanup/flood-verification.json', JSON.stringify( result, null, 2 ) );
console.log( result );
assert.equal( peakWet, land.length, 'extreme setting can inundate the entire reconstructed island terrain' );
sea.reset(); assert.ok( sea.field.every( x => x === 0 ), 'reset clears the extreme flood' );
console.log( 'PASS maximum crest floods all island land cells, remains finite and resets cleanly.' );
