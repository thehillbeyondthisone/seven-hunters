// Real WGSL sky, source-based positions and dated orientation. No game saves are loaded.
// node test/catalog-stars-render.mjs [output-directory]
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GPU, G, E, setFrameCamera, RenderTarget, tonemapPass, savePNG, wait } from './sky-harness.mjs';
import { Atmosphere } from '../src/sky/Atmosphere.js';
import { Sky } from '../src/sky/Sky.js';
import { Setting } from '../src/sky/Setting.js';
import { propagateStar } from '../src/sky/StarCoordinates.js';
import catalog from '../src/sky/data/bright-stars.json' with { type: 'json' };
import { MeshRenderer } from '../src/engine/render/MeshRenderer.js';
import { SceneRenderer } from '../src/engine/render/SceneRenderer.js';
import { ComputeKernel } from '../src/engine/gpu/Compute.js';
import { StorageBuffer } from '../src/engine/gpu/Texture.js';
import { readBuffer } from '../src/engine/gpu/Readback.js';

const out = resolve( process.argv[ 2 ] || 'artifacts/night-sky' );
mkdirSync( out, { recursive: true } );
await GPU.init( { headless: true } );
GPU.device.pushErrorScope( 'validation' );
const errors = [];
GPU.device.addEventListener( 'uncapturederror', ( e ) => errors.push( e.error.message ) );
const W = 1600, H = 900;
const atmosphere = new Atmosphere(), sky = new Sky( atmosphere ), setting = new Setting( 'flannan' );
const camera = new E.PerspectiveCamera( 60, W / H, .1, 60000 );
const sr = new SceneRenderer( new MeshRenderer(), new E.Scene(), camera );
sr.setSize( W, H ); sr.background = sky.background;
const ldr = new RenderTarget( W, H, { colors: [ 'rgba8unorm' ], label: 'catalog sky review' } );
const named = ( name ) => catalog.stars.find( ( s ) => s[ 2 ] === name );
const poses = [
	{ name: 'south-22', h: 22, direction: [ 0, .47, 1 ] },
	{ name: 'south-02', h: 26, direction: [ 0, .47, 1 ] },
	{ name: 'north-22', h: 22, direction: [ 0, 1.5, -1 ] },
	{ name: 'north-02', h: 26, direction: [ 0, 1.5, -1 ] },
	{ name: 'orion-telescope', h: 22, star: 'Alnilam', fov: 8 },
];
const evidence = [];
for ( const pose of poses ) {

	setting.dayOffset = 19 + Math.floor( pose.h / 24 );
	const state = setting.update( pose.h % 24 );
	sky.setStarTime( state.ut, setting.lat, setting.lon );
	sky.starIntensity.value = 1; sky.moonDir.value.copy( state.moon );
	sky.moonShade.value = 1; sky.moonLight.value = state.moonIllumination * E.MathUtils.smoothstep( state.moon.y, -.03, .12 );
	atmosphere.sunDir.value.copy( state.sun ); atmosphere.invalidate();
	G.night.value = 1; G.exposure.value = 5;
	camera.fov = pose.fov || 60; camera.updateProjectionMatrix();
	camera.position.set( 0, 3, 0 );
	const eqToWorld = sky.params.fields.worldToStars.value.clone().transpose();
	const dir = pose.star ? propagateStar( named( pose.star ), state.ut ).applyMatrix3( eqToWorld ) : new E.Vector3( ...pose.direction ).normalize();
	camera.lookAt( dir.clone().add( camera.position ) );
	for ( let frame = 0; frame < 5; frame ++ ) {

		GPU.beginFrame(); atmosphere.update( 1 / 60, 3 ); setFrameCamera( camera, W, H );
		sr.render(); tonemapPass( sr.sceneRT.texture ).render( { colorViews: [ ldr.texture ] } ); GPU.submit();
		await GPU.queue.onSubmittedWorkDone(); await wait( 15 );

	}
	await savePNG( ldr.texture, resolve( out, `${ pose.name }.png` ) );
	const projected = {};
	for ( const name of [ 'Polaris', 'Sirius', 'Betelgeuse', 'Rigel', 'Alnitak', 'Alnilam', 'Mintaka', 'Dubhe', 'Merak' ] ) {

		const v = propagateStar( named( name ), state.ut ).applyMatrix3( eqToWorld );
		projected[ name ] = { altitude: Math.asin( v.y ) * 180 / Math.PI, azimuth: ( Math.atan2( v.x, -v.z ) * 180 / Math.PI + 360 ) % 360 };

	}
	evidence.push( { pose: pose.name, ut: new Date( state.ut ).toISOString(), fov: camera.fov, ...projected } );

}

// Exercise the same function on the GPU at the actual bright-star directions and
// 0.6 degrees away. This catches index/transposition/RA-hour mistakes that compile checks miss.
setting.dayOffset = 19;
const state = setting.update( 22 );
sky.setStarTime( state.ut, setting.lat, setting.lon ); sky.moonLight.value = 0;
atmosphere.sunDir.value.copy( state.sun );
camera.fov = 60; camera.updateProjectionMatrix(); setFrameCamera( camera, W, H );
const directions = [], inverse = sky.params.fields.worldToStars.value.clone().transpose();
for ( const name of [ 'Sirius', 'Betelgeuse', 'Rigel', 'Alnilam', 'Polaris' ] ) {

	const v = propagateStar( named( name ), ( Math.floor( state.ut / 86400000 ) + .5 ) * 86400000 ).applyMatrix3( inverse );
	directions.push( ...v.toArray(), 0, ...v.clone().applyAxisAngle( new E.Vector3( 0, 1, 0 ), .01 ).toArray(), 0 );

}
const samples = new StorageBuffer( { count: directions.length / 4, data: new Float32Array( directions ) } );
const values = new StorageBuffer( { count: directions.length / 4 } );
const kernel = new ComputeKernel( { label: 'catalog point-source verification', modules: [ sky.module ],
	bindings: { samples: { storage: samples }, values: { storage: values, access: 'read_write' } },
	code: `@compute @workgroup_size( 1 ) fn main( @builtin( global_invocation_id ) gid: vec3u ) {
		values[ gid.x ] = vec4f( skyStars( samples[ gid.x ].xyz ), 1.0 );
	}` } );
GPU.beginFrame(); kernel.dispatch( directions.length / 4 ); GPU.submit();
const pixels = new Float32Array( await readBuffer( values, values.byteLength ) );
for ( let i = 0; i < 5; i ++ ) assert.ok( pixels[ i * 8 ] > pixels[ i * 8 + 4 ] * 3, `catalog star ${ i } is brighter at its measured position` );
writeFileSync( resolve( out, 'positions.json' ), JSON.stringify( evidence, null, 2 ) + '\n' );
const validation = await GPU.device.popErrorScope();
assert.equal( validation, null, validation?.message ); assert.deepEqual( errors, [] );
console.log( `Catalog render passed: ${ catalog.stars.length } stars; five dated views, telescope and measured-position GPU probes; ${ sky.starIndex.data.byteLength } byte index, max ${ sky.starIndex.maxOccupancy } candidates/cell.` );
process.exit( 0 );
