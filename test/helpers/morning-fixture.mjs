import { resolve } from 'node:path';
import { installBrowser } from '../../tools/shots/browser.mjs';
Object.defineProperty( globalThis, 'navigator', { value: {}, writable: true, configurable: true } );
installBrowser( { search: '?morningPreview', root: resolve( 'public' ) } );
const E = await import( '../../src/engine/index.js' );
const { loadFlannanData } = await import( '../../src/world/flannan/FlannanData.js' );
const { FlannanTerrainData } = await import( '../../src/world/flannan/FlannanTerrain.js' );
const { buildStation, TOWER, ROOM, STATION } = await import( '../../src/world/flannan/Station.js' );
const { Builder } = await import( '../../src/world/village/GeoBuilder.js' );
const { InstancedProps, Rand } = await import( '../../src/world/Props.js' );
const { Colliders } = await import( '../../src/world/Colliders.js' );
const { mulberry32 } = await import( '../../src/util/Noise.js' );
const { Player } = await import( '../../src/player/Player.js' );
const { Lamp } = await import( '../../src/station/Lamp.js' );
const { HandLamp } = await import( '../../src/station/HandLamp.js' );
const { Story } = await import( '../../src/story/Story.js' );
const { mobileAction } = await import( '../../src/mobile/MobileOptions.js' );
export { E, TOWER, ROOM, STATION, mobileAction };

export async function fixture( familiar = false, options = {} ) {
	const F = await loadFlannanData(), terrain = new FlannanTerrainData( F.grids.island );
	const B = new Builder(), colliders = new Colliders(), village = { buildings: [], footprints: [] };
	const st = buildStation( { B, terrain, colliders, keeperStudy: true, morningStudy: options.morningStudy ?? true, rand: new Rand( mulberry32( 90210 ) ), lights: [], inst: new InstancedProps( B ), checks: [] }, village );
	st.moving = { doors: st.parts.doors, telescope: { visible: true } };
	const keys = new Set(), taps = new Set(), input = { enabled: true, keys, rightDown: false, down: c => keys.has( c ), hit: c => taps.delete( c ), consumeLook: () => ( { x: 0, y: 0 } ), consumeWheel: () => 0, requestLock() {} };
	const camera = new E.PerspectiveCamera( 70, 16 / 9, .1, 150000 );
	const query = { cpuValid: false, cpu: new Float32Array( 128 ), allocate: () => 0, setPoint() {} };
	const player = new Player( { camera, input, terrain, colliders, query, boat: null } );
	const app = { qs: new URLSearchParams( options.search ?? ( familiar ? 'morningPreview=familiar' : 'morningPreview' ) ), village, terrainData: terrain, colliders, camera, player, input, query,
		lamp: new Lamp( { origin: new E.Vector3( 0, st.focal, 0 ) } ), handLamp: new HandLamp(), settings: { timeOfDay: 12, timeSpeed: 0 }, setting: { dayOffset: 0 },
		haze: { density: { value: 1 } }, clouds: { coverage: { value: .4 } }, ui: { ui: { toast() {} } }, flannan: F };
	const s = app.story = new Story( app ); s.ui.card = s.ui.fade = async () => {};
	s.ui.journal = async () => ( {} ); s.ui.read = async () => {};
	await s.start();
	const step = seconds => { for ( let t = 0; t < seconds - 1e-8; t += 1 / 60 ) { player.update( 1 / 60 ); s.update( 1 / 60 ); } };
	const place = ( x, y, z ) => { player.position.set( x, y, z ); player.velocity.set( 0, 0, 0 ); player._camY = null; player.update( 0 ); };
	const face = at => { const d = at.clone().sub( camera.position ).normalize(); player.yaw = Math.atan2( -d.x, -d.z ); player.pitch = Math.asin( d.y ); player.update( 0 ); camera.updateMatrixWorld(); };
	return { app, s, m: s.morning, keys, taps, player, camera, st, terrain, colliders, builder: B, step, place, face };
}
