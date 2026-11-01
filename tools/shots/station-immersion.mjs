// Matched full-scene review of the interior air, rain threshold and wind plume.
import '../../test/headless.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { installBrowser } from './browser.mjs';
import { bgraShot, writePNG } from './png.mjs';

const mobile = process.argv.includes( '--mobile' );
const width = mobile ? 844 : 1340, height = mobile ? 550 : 880;
const out = resolve( 'artifacts/station-immersion', mobile ? 'mobile' : 'desktop' );
mkdirSync( out, { recursive: true } );
installBrowser( {
	search: '?bench&noAudio&setting=flannan&adapt&handlamp&weatherPreview&seaWeather=gale' + (mobile ? '&mobile' : ''),
	width, height, root: resolve( 'public' ),
	onPost: async ( url, body ) => {
		const name = decodeURIComponent( url.split( '/' ).pop() ).replace( /\.bgra$/, '' );
		const shot = bgraShot( Buffer.from( body.buffer, body.byteOffset, body.byteLength ) );
		writePNG( resolve( out, name + '.png' ), shot.w, shot.h, shot.rgba );
		console.log( 'saved', name );
	},
} );
await import( '../../src/core/BenchSeed.js' );
const { App } = await import( '../../src/App.js' );
const { startBench } = await import( '../../src/core/Bench.js' );
const { GPU } = await import( '../../src/engine/gpu/GPU.js' );
const { G } = await import( '../../src/core/Globals.js' );
const { VIEWS } = await import( '../../src/core/DebugViews.js' );
const { SeaWeather } = await import( '../../src/weather/SeaWeather.js' );
const errors = [], init = GPU.init.bind( GPU );
GPU.init = async options => {
	const result = await init( options );
	GPU.device.addEventListener( 'uncapturederror', event => errors.push( event.error.message ) );
	GPU.device.pushErrorScope( 'validation' );
	return result;
};
const views = {
	room: { p: [ -.4, 82.67, 4.4 ], at: [ -6.8, 82.1, .1 ], fov: 65, time: 14.2 },
	lamp: { p: [ -5.0, 82.67, .35 ], at: [ -6.7, 81.84, -.6 ], fov: 62, time: 19 },
	rain: { p: [ .65, 82.67, 4.6 ], at: [ 7.8, 82.4, 4.7 ], fov: 66, time: 13.7 },
	smoke: { p: [ -20, 87, 26 ], at: [ -2.1, 88.4, 10.5 ], fov: 65, time: 13.6 },
};
for ( const [ name, v ] of Object.entries( views ) ) {
	const [ x, y, z ] = v.p, [ a, b, c ] = v.at;
	VIEWS[ name ] = { ...v, yaw: Math.atan2( x - a, z - c ), pitch: Math.atan2( b - y, Math.hypot( a - x, c - z ) ) };
}
const app = new App();
let stage = '';
await app.init( ( p, text ) => { if ( text !== stage ) console.log( `${Math.round(p*100)}% ${stage=text}` ); } );
const bench = startBench( app );
const capture = ( names, tag ) => bench.shots( names, { tag, frames: 40, width, height, dt: 0 } );
app.seaWeather?.reset();
for ( const [ tag, intensity ] of [ [ 'before', 0 ], [ 'after', 1 ] ] ) {
	app.stationMotes.material.uniforms.intensity.value = intensity;
	await capture( [ 'room', 'lamp' ], tag );
}
app.seaWeather ||= new SeaWeather( app );
app.seaWeather.select( 'gale' ); app.seaWeather.model.update( 600 ); app.seaWeather.update( 0 );
const house = app.village.station.moving.doors.find( d => d.name === 'house' );
assert( house, 'real house door is available' );
house.open = house.target = 1;
house.obj.rotation.y = house.ry + house.swing;
await capture( [ 'rain' ], 'after' );
app.seaWeather.reset();
app.qs.set( 'chimneySmoke', '' );
for ( const [ tag, wind, direction ] of [ [ 'breeze', 3, [ 1, 0 ] ], [ 'gale', 22, [ -.819, .574 ] ] ] ) {
	G.windSpeed.value = wind; G.windDir.value.set( ...direction );
	const plume = app.village.station.moving.smoke;
	// Reach a mature wind state without changing the camera or the story clock.
	for ( let i = 0; i < 600; i++ ) plume.update( 1 / 60, app.camera, 1 );
	await capture( [ 'smoke' ], tag );
}
await GPU.pipelinesReady(); await GPU.queue.onSubmittedWorkDone();
const validation = await GPU.device.popErrorScope();
assert.equal( validation, null, validation?.message ); assert.deepEqual( errors, [] );
writeFileSync( resolve( out, 'verification.json' ), JSON.stringify( { width, height, mobile, textureLimit: GPU.limits.maxSampledTexturesPerShaderStage, gpuErrors: errors, interiorInstances: app.stationMotes.mesh.geometry.instanceCount }, null, 2 ) );
const photos = [ [ 'after-room', 'Winter daylight in the keepers’ room' ], [ 'after-lamp', 'Sparse dust in the lamplight' ], [ 'after-rain', 'The weather beyond the shelter' ], [ 'breeze-smoke', 'Chimney smoke in a light breeze' ], [ 'gale-smoke', 'Chimney smoke in a gale' ] ];
writeFileSync( resolve( out, 'index.html' ), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Seven Hunters · station atmosphere</title><style>body{max-width:1100px;margin:40px auto;padding:0 20px;background:#101b20;color:#e5dfd0;font:18px/1.6 Georgia}h1{font-weight:normal}img{width:100%;display:block}figure{margin:32px 0}figcaption{margin-bottom:8px}a{color:#c6d7d9}details{margin:18px 0}</style><h1>Seven Hunters · station atmosphere</h1><p>Interior air, rain beyond the doorway, and smoke following the wind. Captured in the game’s own WebGPU renderer. The story and saves are untouched by this review.</p>${photos.map(([name,label])=>`<figure><figcaption>${label}</figcaption><img src="${name}.png" alt="${label}" loading="lazy"></figure>`).join('')}<details><summary>Matched views with the new interior dust disabled</summary><img src="before-room.png" alt="Room without dust"><img src="before-lamp.png" alt="Lamp without dust"></details>` );
console.log( 'PASS full-scene station immersion review, no GPU validation errors.', out );
process.exit( 0 );
