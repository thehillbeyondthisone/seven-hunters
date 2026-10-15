import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { installBrowser } from '../tools/shots/browser.mjs';
// "Examine the signal lamp" (src/story/SignalLampStudy.js): offered by daylight on the balcony, a working
// model of the Begbie lamp on the story clock, and the shutter key read back as Morse.
Object.defineProperty( globalThis, 'navigator', { value: {}, writable: true, configurable: true } );
installBrowser( { search: '?keeperPreview', root: resolve( 'public' ) } );
const E = await import( '../src/engine/index.js' );
const { G } = await import( '../src/core/Globals.js' );
const { loadFlannanData } = await import( '../src/world/flannan/FlannanData.js' );
const { FlannanTerrainData } = await import( '../src/world/flannan/FlannanTerrain.js' );
const { buildStation, TOWER } = await import( '../src/world/flannan/Station.js' );
const { Builder } = await import( '../src/world/village/GeoBuilder.js' );
const { InstancedProps, Rand } = await import( '../src/world/Props.js' );
const { Colliders } = await import( '../src/world/Colliders.js' );
const { mulberry32 } = await import( '../src/util/Noise.js' );
const { Player } = await import( '../src/player/Player.js' );
const { Lamp } = await import( '../src/station/Lamp.js' );
const { HandLamp } = await import( '../src/station/HandLamp.js' );
const { Story } = await import( '../src/story/Story.js' );
const { SIGNAL_LAMP } = await import( '../src/world/flannan/SignalLampModel.js' );
const F = await loadFlannanData(), terrainData = new FlannanTerrainData( F.grids.island );
const B = new Builder(), colliders = new Colliders(), village = { buildings: [], footprints: [] };
const st = buildStation( { B, terrain: terrainData, colliders, keeperStudy: true, rand: new Rand( mulberry32( 90210 ) ), lights: [], inst: new InstancedProps( B ), checks: [] }, village );
st.moving = { doors: st.parts.doors, telescope: { visible: true } };
village.station = st;
const keys = new Set(), input = { enabled: true, keys, rightDown: false, down: c => keys.has( c ), hit: () => false,
	consumeLook: () => ( { x: 0, y: 0 } ), consumeWheel: () => 0, requestLock() {} };
const camera = new E.PerspectiveCamera( 70, 16 / 9, .1, 150000 );
const query = { cpuValid: false, cpu: new Float32Array( 128 ), allocate: () => 0, setPoint() {} };
const player = new Player( { camera, input, terrain: terrainData, colliders, query, boat: null } );
const signalLight = { scale: 0 };
const app = { qs: new URLSearchParams( 'keeperPreview' ), village, terrainData, colliders, camera, player, input, query, signalLight,
	lamp: new Lamp( { origin: new E.Vector3( 0, st.focal, 0 ) } ), handLamp: new HandLamp(),
	settings: { timeOfDay: 12, timeSpeed: 0 }, setting: { dayOffset: 0 }, haze: { density: { value: 1 } }, clouds: { coverage: { value: .4 } },
	ui: { ui: { toast() {} } }, flannan: F,
};
localStorage.setItem( 'sevenhunters.night1.v1', 'protected normal watch' );
const s = app.story = new Story( app );
s.ui.card = async () => {}; s.ui.fade = async () => {}; const papers = []; s.ui.read = async note => papers.push( note );
await s.start();
const L = s.lampStudy, state = () => s.flags.signalLamp;
st.moving.balconyRail = { visible: true };
const frame = ( dt = 1 / 60 ) => { player.update( dt ); s.update( dt ); };
const ok = ( c, m ) => { assert.ok( c, m ); console.log( 'ok  ', m ); };

// the model: static and moving parts, the lens on the old signal point
ok( SIGNAL_LAMP.static.iron && SIGNAL_LAMP.parts.door && SIGNAL_LAMP.parts.vane5 && SIGNAL_LAMP.parts.flame, 'lamp model has its moving parts' );
ok( st.parts.signalLamp && Object.keys( st.parts.signalLamp.parts ).length >= 15, 'station carries the lamp parts for assembly' );
const lens = L.world( new E.Vector3( 0, 1.09, 0.165 ) );
ok( lens.distanceTo( TOWER.signal ) < 0.02, 'the lens sits where the signal light shines from' );
for ( const [ x, z ] of [ [ 0.24, 0.14 ], [ - 0.24, 0.14 ], [ 0, - 0.28 ] ] ) {
	const foot = L.world( new E.Vector3( x, 0, z ) );
	ok( Math.hypot( foot.x, foot.z ) < 3.64, `tripod foot inside the railing (${ Math.hypot( foot.x, foot.z ).toFixed( 2 ) } m)` );
}
const her = s.her.clone().sub( TOWER.signal ).setY( 0 ).normalize(), axis = L.world( new E.Vector3( 0, 0, 1 ) ).sub( L.world( new E.Vector3() ) ).setY( 0 ).normalize();
console.log( `     lamp axis is ${ ( Math.acos( Math.min( 1, her.dot( axis ) ) ) * 180 / Math.PI ).toFixed( 1 ) } degrees off Gallan Head` );

// offered by day at the lamp, not at night
G.night.value = 0;
player.position.set( TOWER.signalStand.x, TOWER.deck, TOWER.signalStand.z );
const at = L.world( new E.Vector3( 0, 1.12, 0 ) );
player.yaw = Math.atan2( player.position.x - at.x, player.position.z - at.z );
player.pitch = Math.atan2( at.y - player.position.y - 1.62, Math.hypot( at.x - player.position.x, at.z - player.position.z ) );
player._camY = null; frame();
ok( player.prompt?.text === 'Examine the signal lamp', `the prompt reads “${ player.prompt?.text }”` );
ok( ! s.interact.get( 'signal' ).when(), 'by day the examination takes the lamp' );
G.night.value = 1; frame();
ok( ! L.offered() && player.prompt?.text !== 'Examine the signal lamp', 'not offered after dark' );
G.night.value = 0; frame();

// enter: the view is held, the walker stopped
ok( L.enter() && L.active && player.busy && ! input.enabled, 'examining holds the walker' );
ok( ! st.moving.balconyRail.visible, 'the balcony rail is cut away during study' );
ok( state().examined && ! state().lit && state().heat === 0, 'the lamp starts cold' );
for ( let i = 0; i < 60; i ++ ) frame();
ok( camera.position.distanceTo( L.world( new E.Vector3( 0.6, 1.4, 1.22 ) ) ) < 0.01, 'camera framed on the lamp' );
ok( L.world( new E.Vector3( 0, 1.08, 0.06 ) ).project( camera ).x < -0.2, 'lamp sits beside the lesson panel' );
const run = id => { const a = L.actions().find( x => x.id === id ); assert.ok( a, 'action ' + id + ' available' ); a.run(); };
ok( ! L.actions().some( a => a.id === 'match' ), 'no match until the side door is open' );
for ( const id of [ 'lens', 'shutter', 'chimney', 'sights', 'tripod', 'can' ] ) L.look( id );
ok( state().seen.length === 6, 'parts looked over' );

// the key with the lamp cold: the vanes move, nothing shows
L.press( true ); for ( let i = 0; i < 10; i ++ ) frame(); L.press( false ); frame();
ok( signalLight.scale === 0 && /nothing to show/.test( L.note ), 'cold lamp: the key shows no light' );

// light it as a signaller would: door, glass, a low wick, the match
run( 'door' ); run( 'match' );
ok( ! state().lit && /glass chimney is in the way/.test( L.note ), 'the glass must be lifted first' );
run( 'glass' ); run( 'down' ); run( 'down' ); run( 'match' );
ok( ! state().lit && /down inside the burner/.test( L.note ), 'a wick below the slot cannot be lit' );
run( 'up' ); run( 'match' );
ok( state().lit && L.flame > 0, 'lit on a low wick' );
run( 'glass' ); run( 'door' ); run( 'raise' );
const advance = hours => { const step = hours / 120; for ( let i = 0; i < 120; i ++ ) { s.h += step; frame(); } };
// turned up hard while cold: it smokes and smokes the glass
for ( let i = 0; i < 6; i ++ ) run( 'up' );
ok( L.smoking, 'a cold lamp turned up high smokes' );
advance( 0.05 );
ok( state().soot > 0.05, `smoke clouds the glass (${ state().soot.toFixed( 2 ) })` );
for ( let i = 0; i < 5; i ++ ) run( 'down' );
advance( 0.3 );
ok( state().heat > 0.55, `a low flame warms the lamp (${ state().heat.toFixed( 2 ) })` );
run( 'up' ); run( 'up' ); run( 'up' ); advance( 0.3 ); run( 'up' ); run( 'up' ); advance( 0.3 );
ok( state().heat > 0.85, `turned up by stages, it warms through (${ state().heat.toFixed( 2 ) })` );
const warmLimit = L.limit;
ok( ! L.smoking && L.flame <= warmLimit + 0.03, 'warm, it takes more wick without smoking' );
const dim = L.output;
// flash: the key shows the light only while held
L.press( true ); for ( let i = 0; i < 12; i ++ ) frame();
ok( signalLight.scale > 0.2 && Math.abs( signalLight.scale - L.output ) < 0.05, `the key shows the beam (${ signalLight.scale.toFixed( 2 ) })` );
L.press( false ); for ( let i = 0; i < 12; i ++ ) frame();
ok( signalLight.scale < 0.02, 'released, the spring shuts the light off' );
ok( /miles off/.test( L.note ), 'the first daylight flash notes the range' );
// Morse: dot = 1 unit, dash = 3, letters 3 apart, words 6 (1889 catechism); the reading adapts to your speed
L.morse = { marks: '', text: '', unit: 0.24, down: 0, up: 0, letter: '', sent: true };
const key = ( on, units, u = 0.2 ) => { if ( on ) L.press( true ); for ( let t = 0; t < units * u - 1e-6; t += 1 / 60 ) frame(); if ( on ) L.press( false ); };
const send = word => [ ...word ].forEach( ( ch, ci ) => { if ( ci ) key( false, 3 ); [ ...{ S: '...', O: '---', E: '.', T: '-' }[ ch ] ].forEach( ( e, ei ) => { if ( ei ) key( false, 1 ); key( true, e === '.' ? 1 : 3 ); } ); } );
send( 'SOS' ); key( false, 6 ); send( 'TE' ); key( false, 6 );
ok( L.morse.text.trim() === 'SOS TE', `flashes read back as “${ L.morse.text.trim() }”` );
// the fount and the wick on the clock
const oil = state().oil, char = state().char;
advance( 1 );
ok( state().oil < oil && state().char > char, `an hour burns oil (${ ( ( oil - state().oil ) * 100 ).toFixed( 1 ) }% of the fount) and chars the wick` );
// out, cool, then service
for ( let i = 0; i < 10; i ++ ) run( 'down' );
ok( ! state().lit, 'turned right down, the flame goes out' );
run( 'door' ); run( 'fill' );
ok( state().oil < 1 && /still hot/.test( L.note ), 'no filling while the fount is hot' );
advance( 1.5 );
run( 'fill' ); run( 'glass' ); run( 'trim' ); run( 'clean' );
ok( state().oil === 1 && state().char === 0 && state().soot === 0, 'cold: filled, trimmed and cleaned' );
ok( state().heat < 0.3, 'cooled' );
// leave: the walker is given back
L.leave();
ok( ! L.active && ! player.busy && input.enabled, 'stepping away returns the walker' );
ok( st.moving.balconyRail.visible, 'stepping away restores the rail' );
s.save();
const saved = JSON.parse( localStorage.getItem( s.saveKey ) );
ok( saved.flags.signalLamp && saved.flags.signalLamp.oil === 1 && saved.flags.signalLamp.examined, 'lamp state saved with the watch' );
s.ui.read = async n => papers.push( n ); s.ui.packet = async list => papers.push( ...list );
await s._readPapers();
ok( papers.some( p => p.id === 'signal-lamp' ), 'the lamp paper joins your papers' );
// Follow the suggested actions, including closing up before tending the flame.
s.flags.signalLamp = { oil: 1, char: 0, soot: 0, door: false, raised: false, lifted: false, lit: false, wick: 0.2, heat: 0, examined: false, seen: [] };
L.chapter = 'light'; L.enter();
for ( let i = 1; i <= 6; i ++ ) {
	ok( L.lesson().n === `Step ${ i } of 7`, `guided lighting step ${ i } is in physical order` );
	L.lesson().run();
}
ok( state().lit && state().raised && ! state().door && ! state().lifted, 'guided actions leave the flame protected and the chimney raised' );
ok( ! L.lesson().run && /Warming/.test( L.lesson().n ), 'the guide waits for the low flame to warm' );
advance( 0.35 );
for ( let i = 0; i < 4; i ++ ) { L.lesson().run(); advance( 0.1 ); }
ok( L.lesson().n === 'Ready to signal' && ! L.smoking, 'the guided routine produces a clear working flame' );
let finishRead, opens = 0;
s.ui.read = () => { opens ++; return new Promise( resolve => { finishRead = resolve; } ); };
const firstRead = L.read(), repeatRead = L.read();
ok( opens === 1, 'repeated reading requests open one copy' );
finishRead(); await Promise.all( [ firstRead, repeatRead ] );
ok( ! L._reading && ! input.enabled && player.busy, 'closing the guide keeps the lamp study in control' );
L.leave();
const beforeTitle = localStorage.getItem( s.saveKey ), playerBefore = player.position.clone();
s.setTitleView( true ); s.update( 1 / 60 );
ok( camera.position.distanceTo( new E.Vector3( -46, 76.5, 48 ) ) < 1e-6, 'saved watches get the authored title camera' );
ok( player.position.equals( playerBefore ) && localStorage.getItem( s.saveKey ) === beforeTitle, 'title view preserves player position and save' );
s.setTitleView( false );
app.qs = new URLSearchParams( 'signalLampPreview' );
const preview = app.story = new Story( app );
await preview.start();
ok( preview.saveKey === 'sevenhunters.signal-lamp-preview.v1' && preview.lampStudy.active, 'direct preview opens the lesson in its isolated save' );
preview.lampStudy.leave();
ok( player.position.distanceTo( new E.Vector3( TOWER.signalStand.x, TOWER.deck, TOWER.signalStand.z ) ) < 0.01, 'leaving the direct study keeps the player beside the lamp' );
ok( localStorage.getItem( 'sevenhunters.night1.v1' ) === 'protected normal watch', 'the preview preserves the normal watch' );
console.log( 'all passed' );
process.exit( 0 );
