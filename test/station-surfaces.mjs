// Bake/readback contracts for real PBR maps, distinct from visual review.
import './headless.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GPU } from '../src/engine/gpu/GPU.js';
import '../src/engine/render/Frame.js';
import { readTexture } from '../src/engine/gpu/Readback.js';
import { VillageTextures } from '../src/world/village/TextureBaker.js';
import { writePNG } from '../tools/shots/png.mjs';

const out = process.argv[ 2 ] ? resolve( process.argv[ 2 ] ) : null;
if ( out ) mkdirSync( out, { recursive: true } );
await GPU.init( { headless: true } );
GPU.syncPipelines = true;
let errors = 0;
GPU.device.addEventListener( 'uncapturederror', () => { errors ++; } );
const textures = new VillageTextures();
const originalBytes = textures.bytes;
textures.addStoneGrain();
const stoneBytes = textures.bytes;
textures.addStationSurfaces();
const fullBytes = textures.bytes;
textures.addStationSurfaces();
assert.equal( textures.bytes, fullBytes, 'registering again must not allocate duplicate maps' );
assert( Math.abs( ( fullBytes - stoneBytes ) / 1024 / 1024 - 32 / 3 ) < 1e-9, 'station map memory budget' );
for ( const t of Object.values( textures.textures ) ) t.usageList.push( 'copySrc' );
textures.bake();
GPU.submit();
await GPU.device.queue.onSubmittedWorkDone();
const report = { addedMiB: ( fullBytes - stoneBytes ) / 1024 / 1024, stoneMiB: ( stoneBytes - originalBytes ) / 1024 / 1024, maps: {} };
for ( const name of [ 'indoorWoodN', 'limeN', 'keptPaintN', 'castIronN', 'stoneGrainN' ] ) {
	const t = textures.textures[ name ];
	const { data, width: w, height: h } = await readTexture( t );
	const pixels = new Uint8Array( data ), normal = new Uint8Array( pixels.length ), rough = new Uint8Array( pixels.length );
	let minR = 255, maxR = 0, sumR = 0, sumR2 = 0, maxTilt = 0;
	for ( let i = 0; i < pixels.length; i += 4 ) {
		const nx = pixels[ i ] / 255 * 2 - 1, ny = pixels[ i + 1 ] / 255 * 2 - 1;
		const length2 = nx * nx + ny * ny;
		assert( length2 < 1.01, `${ name }: normal must have a real Z component` );
		maxTilt = Math.max( maxTilt, Math.sqrt( length2 ) );
		const nz = Math.sqrt( Math.max( 0, 1 - length2 ) );
		normal.set( [ pixels[ i ], pixels[ i + 1 ], Math.round( ( nz * .5 + .5 ) * 255 ), 255 ], i );
		rough.set( [ pixels[ i + 2 ], pixels[ i + 2 ], pixels[ i + 2 ], 255 ], i );
		minR = Math.min( minR, pixels[ i + 2 ] ); maxR = Math.max( maxR, pixels[ i + 2 ] );
		sumR += pixels[ i + 2 ]; sumR2 += pixels[ i + 2 ] ** 2;
	}
	assert( minR > 70 && maxR <= 255 && maxR - minR > 12, `${ name }: useful bounded roughness variation` );
	assert( maxTilt > .02 && maxTilt < .85, `${ name }: restrained non-flat normals` );
	// Compare the wrap seam to ordinary adjacent texels in the same neighbourhood.
	let seam = 0, near = 0;
	for ( let y = 0; y < h; y ++ ) for ( let c = 0; c < 3; c ++ ) {
		const first = ( y * w ) * 4 + c, last = ( y * w + w - 1 ) * 4 + c;
		seam += Math.abs( pixels[ first ] - pixels[ last ] );
		near += ( Math.abs( pixels[ first ] - pixels[ first + 4 ] ) + Math.abs( pixels[ last ] - pixels[ last - 4 ] ) ) * .5;
	}
	for ( let x = 0; x < w; x ++ ) for ( let c = 0; c < 3; c ++ ) {
		const first = x * 4 + c, last = ( ( h - 1 ) * w + x ) * 4 + c;
		seam += Math.abs( pixels[ first ] - pixels[ last ] );
		near += ( Math.abs( pixels[ first ] - pixels[ first + w * 4 ] ) + Math.abs( pixels[ last ] - pixels[ last - w * 4 ] ) ) * .5;
	}
	assert( seam < near * 1.7 + ( w + h ), `${ name }: no discontinuity at tile boundary` );
	const mip = await readTexture( t, { mip: t.mipLevelCount - 1 } );
	const mean = sumR / ( w * h );
	assert( Math.abs( new Uint8Array( mip.data )[ 2 ] - mean ) < 4, `${ name }: roughness mean survives the mip chain` );
	report.maps[ name ] = { width: w, height: h, roughness: [ minR / 255, maxR / 255 ], roughnessStd: Math.sqrt( sumR2 / ( w * h ) - mean ** 2 ) / 255, maxNormalTilt: maxTilt, seamRatio: seam / near };
	if ( out ) {
		writePNG( resolve( out, name + '-normal.png' ), w, h, normal );
		writePNG( resolve( out, name + '-roughness.png' ), w, h, rough );
		writePNG( resolve( out, name + '-packed.png' ), w, h, pixels );
	}
	console.log( `ok ${ name }: normal, roughness, tiling and mip readback` );
}
await GPU.device.queue.onSubmittedWorkDone();
assert.equal( errors, 0, 'no GPU validation errors' );
if ( out ) writeFileSync( resolve( out, 'map-audit.json' ), JSON.stringify( report, null, 2 ) );
textures.dispose();
console.log( 'Station surface maps passed. Added texture memory:', report.addedMiB.toFixed( 2 ), 'MiB.' );
process.exit( 0 );
