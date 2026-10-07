// The demo's night played through (no GPU): the Story director on the real station, terrain, colliders,
// player and lamp, with its pages answered by script (the code book: the first answer each time, unless
// SAY_NAME, then the island's name at the end). Checks the beats in order, the Watcher's exchange, the
// lamp's character, the haar, the light on Eilean Tighe, the gate, the journal at dawn, and the save.
//   node test/demo-story.mjs
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installBrowser } from '../tools/shots/browser.mjs';

const ROOT = join( dirname( fileURLToPath( import.meta.url ) ), '../public' );
Object.defineProperty( globalThis, 'navigator', { value: {}, writable: true, configurable: true } );
installBrowser( { search: '', root: ROOT } );

const E = await import( '../src/engine/index.js' );
const { loadFlannanData } = await import( '../src/world/flannan/FlannanData.js' );
const { FlannanTerrainData } = await import( '../src/world/flannan/FlannanTerrain.js' );
const { buildStation, TOWER, ROOM, STATION } = await import( '../src/world/flannan/Station.js' );
const { CURVATURE } = await import( '../src/world/flannan/FarShore.js' );
const { Builder } = await import( '../src/world/village/GeoBuilder.js' );
const { InstancedProps, Rand } = await import( '../src/world/Props.js' );
const { Colliders } = await import( '../src/world/Colliders.js' );
const { mulberry32 } = await import( '../src/util/Noise.js' );
const { Player } = await import( '../src/player/Player.js' );
const { Lamp } = await import( '../src/station/Lamp.js' );
const { HandLamp } = await import( '../src/station/HandLamp.js' );
const { Beams, hazeTransmittance } = await import( '../src/station/Beams.js' );
const { Story, clockText, weatherAt } = await import( '../src/story/Story.js' );
const { morse, Watcher } = await import( '../src/story/Watcher.js' );
const { KITCHEN, BERTH, HAULING_SHED } = await import( '../src/world/flannan/NextRooms.js' );
const { storyGuidance } = await import( '../src/story/Guidance.js' );
const { hazeDensityForVisibility } = await import( '../src/post/AirHaze.js' );

let fails = 0;
const ok = ( c, msg ) => {

	if ( ! c ) { fails ++; console.log( 'FAIL', msg ); } else console.log( 'ok  ', msg );

};

// ---- Morse
{

	const m = morse( 'SOS' );
	ok( m.on.length === 9 && m.letters.map( ( l ) => l[ 0 ] ).join( '' ) === 'SOS', 'Morse: SOS is nine elements, three letters' );
	ok( m.on[ 3 ][ 1 ] - m.on[ 3 ][ 0 ] === 3 && m.on[ 3 ][ 0 ] - m.on[ 2 ][ 1 ] === 3, 'Morse: a dash is three units, letters three apart' );
	const w = new Watcher( { start: 'g', nodes: { g: { her: 'OIDHCHE MHATH', translation: 'Good night.', end: true } } } );
	w.appear(); w.answer(); w.update( 0.08, { watched: false } );
	ok( w.rawMorse === '' && w.text === '' && w.translation === '', 'unwatched Morse reveals neither symbols nor translation' );
	w.update( 0.045, { watched: true } );
	ok( w.text === '' && w.rawMorse === '', 'a dash must finish before appearing on the strip' );
	w.update( 0.09, { watched: true } );
	ok( w.rawMorse === '–' && w.text === '', 'received symbols appear before the completed letter' );
	w.update( 100, { watched: true } );
	ok( w.text === 'OIDHCHE MHATH' && w.translation === 'Good night.', 'Gaelic remains visible beside its translation' );
	const script = { start: 'q', nodes: { q: { her: 'WHEN', options: [ { text: 'AFTER TWO.', wire: '2', minutes: 1, next: 'end' } ] }, end: { her: 'GOOD NIGHT', end: true } } };
	const incoming = new Watcher( script ); incoming.appear(); incoming.answer(); incoming.update( 0.4, { watched: true } );
	const loaded = new Watcher( script ); loaded.load( incoming.save() );
	ok( loaded.text === incoming.text && loaded.rawMorse === incoming.rawMorse, 'save/load preserves partially received symbols' );
	incoming.update( 100, { watched: true } ); incoming.reply( 0 ); incoming.update( 0.08 );
	loaded.load( incoming.save() ); let sent = 0; loaded.onSent = () => sent ++;
	loaded.update( 100 );
	ok( loaded.node === script.nodes.end && loaded.log.filter( l => l.from === 'you' ).length === 1 && sent === 1, 'resuming an outgoing reply advances once without repeating its choice' );

}

// ---- the weather and her lamp's visibility
{

	const her = new E.Vector3( 32503, 60, 5435 ), eye = new E.Vector3( 3, 99.8, 1 );
	const T = ( h ) => hazeTransmittance( eye, her, hazeDensityForVisibility( weatherAt( h ).vis ) );
	ok( T( 17 ) > 0.15, `at dusk her lamp is seen through ${ ( T( 17 ) * 100 ).toFixed( 0 ) } % of the haze` );
	ok( T( 22 ) < 1e-6, `in the haar it is lost (${ T( 22 ).toExponential( 1 ) })` );

}

// ---- the world, as the app builds it at the Flannans
const F = await loadFlannanData();
const terrainData = new FlannanTerrainData( F.grids.island );
const B = new Builder(), colliders = new Colliders();
const village = { buildings: [], footprints: [] };
const st = buildStation( { B, terrain: terrainData, colliders, rand: new Rand( mulberry32( 90210 ) ), lights: [], inst: new InstancedProps( B ), checks: [] }, village );
st.moving = { doors: st.parts.doors, telescope: { visible: true }, lens: null };

const keys = new Set();
const input = { enabled: true, keys, rightDown: false, down: ( c ) => keys.has( c ), hit: () => false, consumeLook: () => ( { x: 0, y: 0 } ), consumeWheel: () => 0, requestLock() {} };
const query = { n: 0, cpu: new Float32Array( 64 ), cpuValid: true, allocate( n, k ) { const s = this.n; this.n += k; return s; }, setPoint() {} };
const camera = new E.PerspectiveCamera( 70, 16 / 9, 0.1, 150000 );
const player = new Player( { camera, input, terrain: terrainData, colliders, query, boat: null } );
const toasts = [];
const handLamp = new HandLamp();
handLamp.setRest( new E.Vector3( - 4.95, TOWER.floor + 0.74, 3.12 ), 0.4 );
const app = {
	handLamp,
	village: { station: st }, lamp: new Lamp( { origin: new E.Vector3( 0, st.focal, 0 ) } ), input, camera, player, terrainData, colliders,
	settings: { timeOfDay: 12, timeSpeed: 0 }, setting: { dayOffset: 0 }, haze: { density: { value: 1 } }, clouds: { coverage: { value: 0.4 } },
	flannan: F, curvature: CURVATURE, freeCam: false, ui: { ui: { toast: ( t ) => toasts.push( t ) } },
};

const story = new Story( app );
const S = await import( '../src/story/Script.js' );
const shown = { cards: 0, read: [], choose: [], forms: 0, journal: null, end: null };
const SAY_NAME = process.argv.includes( '--say' );
story.ui.card = async () => { shown.cards ++; };
story.ui.fade = async () => {};
story.ui.read = async ( n ) => { shown.read.push( n.title ); };
story.ui.packet = async ( papers, read, onRead ) => { onRead( papers[ 0 ].id ); shown.read.push( papers[ 0 ].title ); };
story.ui.choose = async ( q ) => {

	shown.choose.push( q.title );
	if ( q.title === S.SIGNAL_UI.title && SAY_NAME && q.options.length === 3 && q.options[ 1 ].label.includes( 'FLANNAN' ) ) return 1;
	return q.options[ 0 ].value;

};
story.ui.form = async ( f ) => {

	shown.forms ++;
	return Object.fromEntries( f.fields.map( ( q ) => [ q.key, q.options[ 2 ] ] ) );

};
story.ui.journal = async ( j ) => {

	shown.journal = j;
	return Object.fromEntries( j.remarks.map( ( r ) => [ r.key, true ] ) );

};
story.ui.end = ( e ) => { shown.end = e; };

const item = ( id ) => story.interact.get( id );
const step = ( sec, dt = 1 / 30 ) => {

	for ( let t = 0; t < sec; t += dt ) {

		if ( ! story.islandReveal.active ) player.update( dt );
		story.update( dt );

	}

};

// The opening crossing, optional reading, saves and the landing.
await story.start();
ok( story.beat === 'crossing' && shown.cards === 1 && story.aboard, 'one dated card opens into the playable boat approach' );
ok( storyGuidance( story ) === null, 'the crossing has no onshore objective marker' );
app.isMobile = true; story.update( 0 );
ok( story.ui.arrivalHint.textContent === '', 'touch historical boat notes omit the Papers prompt' );
app.isMobile = false; story.update( 0 );
ok( story.ui.arrivalHint.textContent === '', 'desktop historical notes omit the Papers prompt' );
ok( story.goal().includes( 'B · Read' ), 'boat objective uses B for Papers' );
const paperCount = shown.read.length;
story._key( { code: 'KeyB', preventDefault() {} } );
ok( shown.read.length === paperCount + 1, 'B opens the Papers packet aboard through the keyboard handler' );
input.hit = code => code === 'KeyE'; story.update( 0 ); input.hit = () => false;
ok( shown.read.length === paperCount + 1, 'E no longer opens Papers on the boat' );
const distanceToStage = () => Math.hypot( player.position.x - st.landings.east.stage.x, player.position.z - st.landings.east.stage.z );
const offshore = distanceToStage();
step( 30 );
ok( distanceToStage() < offshore - 50 && distanceToStage() > 100, 'the boat carries the player closer to the real east landing' );
const crossingSave = story.arrival.elapsed;
story.ui.modal = 1;
step( 20 );
ok( story.arrival.elapsed === crossingSave, 'reading holds the boat and its clock' );
story.ui.modal = 0;
await story._readPapers();
ok( story.flags.papersRead.includes( 'home' ), 'the optional personal letter is recorded as read' );
story.save();
const aboardSave = story.loadSave();
step( 5 );
story._restore( aboardSave );
ok( story.aboard && Math.abs( story.arrival.elapsed - crossingSave ) < 0.001, 'a saved crossing resumes aboard at the same point' );
app.isMobile = true;
story.ui.modal = 1; story.mobileCommand( 'landing' );
ok( story.arrival.elapsed === crossingSave, 'touch landing cannot act through an open paper' );
story.ui.modal = 0; app.mobile = { paused: true }; story.mobileCommand( 'landing' );
ok( story.arrival.elapsed === crossingSave, 'touch landing cannot act through pause' );
app.mobile.paused = false; story.mobileCommand( 'landing' );
ok( story.arrival.ready && story.beat === 'crossing' && ! story.flags.landed, 'Go to landing finishes the approach and waits for Step ashore' );
story._restore( aboardSave );
step( 100 );
ok( story.arrival.ready && clockText( story.h ) === '13.40' && story.rows.length === 0, 'the boat waits for consent to land without consuming the afternoon or logging a false landing' );
step( 100 );
ok( clockText( story.h ) === '13.40', 'waiting at the landing costs no daylight' );
await story.mobileCommand( 'landing' );
ok( story.beat === 'climb' && ! story.aboard && story.rows.length === 1 && story.arrival.departure === 0, 'stepping ashore logs one landing and sends the boat away' );
await story.mobileCommand( 'landing' );
ok( story.rows.length === 1, 'repeated disembarkation cannot duplicate the landing' );
ok( ! toasts.at( -1 ).includes( 'B reads' ), 'touch landing toast describes the visible Tools button' );
app.isMobile = false; delete app.mobile;
story.save();
const legacySave = story.loadSave();
delete legacySave.voyage;
delete legacySave.pitch;
story._restore( legacySave );
ok( ! story.aboard && ! story.arrival.group.visible && distanceToStage() < 3, 'a pre-crossing save still resumes ashore without replaying the boat' );
story.arrival.elapsed = 90;
story.arrival.departure = 0;
story.arrival.group.visible = true;
story.arrival.update( 70 );
ok( story.arrival.group.visible, 'the departing boat remains visible during the climb and look back' );
ok( storyGuidance( story )?.id === 'station', 'the landing points to the light station' );
app.ui.ui.photoMode = true;
ok( storyGuidance( story ) === null, 'photo mode hides objective markers' );
app.ui.ui.photoMode = false;
app.settings.guidance = false;
ok( storyGuidance( story ) === null, 'the marker preference hides guidance without changing the beat' );
app.settings.guidance = true;
ok( Math.hypot( player.position.x - st.landings.east.stage.x, player.position.z - st.landings.east.stage.z ) < 3, 'you stand on the east landing\'s stage' );

// Walk the actual last six metres of the east flight, rather than teleporting
// into an approximate trigger sphere. Save/reload in the middle of the turn.
{
	const L = st.landings.east, top = L.top, near = L.steps.pts.at( - 7 );
	player.position.set( near[ 0 ], near[ 1 ], near[ 2 ] );
	player.grounded = true; player.velocity.set( 0, 0, 0 ); player._camY = null;
	player.yaw = Math.atan2( L.dir[ 0 ], L.dir[ 1 ] ); player.pitch = 0.12;
	player.update( 0 );
	ok( ! story.islandReveal.canStart(), 'the reveal does not fire before the final treads' );
	keys.add( 'KeyW' );
	for ( let i = 0; i < 600 && ! story.islandReveal.active; i ++ ) step( 1 / 60, 1 / 60 );
	ok( story.islandReveal.active, `walking reaches the true hill crest (${ Math.hypot( player.position.x-top.x, player.position.z-top.z ).toFixed( 2 ) }m from crest)` );
	const feet = player.position.clone(), hour = story.h, depart = story.arrival.departure;
	keys.clear(); step( 9.4 );
	ok( player.position.distanceTo( feet ) < 1e-9 && story.h === hour && ! input.enabled, 'reveal holds the feet, daylight clock and player input' );
	const view = player.getViewDir( new E.Vector3() );
	ok( view.x * L.dir[ 0 ] + view.z * L.dir[ 1 ] > 0.97, 'ocean hold looks back down the east flight' );
	ok( story.arrival.group.visible && story.arrival.departure > depart + 6, 'the boat keeps rowing into the distance through the scene' );
	story.save(); const midReveal = story.loadSave(), pose = camera.quaternion.clone();
	story.islandReveal.state = null; story._restore( midReveal );
	ok( story.islandReveal.active && Math.abs( camera.quaternion.dot( pose ) ) > 0.99999999, 'mid-scene save resumes the same camera pose and timeline' );
	app.ui.ui.photoMode = true; const elapsed = story.islandReveal.state.elapsed;
	step( 5 );
	ok( story.islandReveal.state.elapsed === elapsed && story.arrival.departure === midReveal.voyage.departure, 'photo mode holds both authored turn and departure' );
	app.ui.ui.photoMode = false; step( 19 );
	ok( ! story.islandReveal.active && story.flags.islandRevealSeen && input.enabled, '28-second reveal finishes once and restores control' );
	ok( story.islandReveal.cueElapsed < 45, 'the music timeline continues after camera control returns' );
	ok( ! player.canSprint(), 'post-reveal walking stays at walking pace while music plays' );
	const front = new E.Vector3( -feet.x, st.focal-feet.y-1.62, -feet.z ).normalize();
	ok( player.getViewDir( new E.Vector3() ).dot( front ) > 0.9999, 'handoff faces the lighthouse at normal field of view' );
	story.save(); const afterReveal = story.loadSave(); story._restore( afterReveal ); step( 0.2 );
	ok( ! story.islandReveal.active, 'completed reveal never repeats after reloading at the crest' );
	story.islandReveal.update( 45 - story.islandReveal.cueElapsed );
	ok( player.canSprint(), 'sprint returns when the music cue finishes' );
}

// up to the yard, in at the keepers' door
player.position.set( 0, STATION.yard, 15 );
step( 0.2 );
ok( story.beat === 'room', `in the yard: '${ story.beat }'` );
player.position.set( - 3, TOWER.floor, 3 );
step( 0.2 );
ok( story.beat === 'letter', `in the keepers' room: '${ story.beat }'` );
ok( storyGuidance( story )?.id === 'letter', 'the letter objective marks the actual desk item' );
await item( 'letter' ).use();
ok( story.beat === 'light' && shown.read.includes( S.LETTER.title ), 'the Board\'s letter read: now light the lamp' );

// the storm lantern on the table: looked at from across it, taken
ok( ! handLamp.carried && item( 'handLamp' ).when(), 'the storm lantern stands on the table' );
player.position.set( - 4.0, TOWER.floor, 2.4 );
player.yaw = Math.atan2( - ( - 4.95 + 4.0 ), - ( 3.12 - 2.4 ) );
player.pitch = - 0.6;
step( 0.1 );
ok( story.interact.current && story.interact.current.id === 'handLamp', `looking at it, the prompt: '${ story.interact.current && story.interact.current.id }'` );
item( 'handLamp' ).use();
ok( handLamp.carried && ! item( 'handLamp' ).when(), 'the lantern taken' );

// in the lantern, the lens is found looking at it at eye level (its focal plane is above your head)
{

	const a = TOWER.crankAngle + 2.2, r = 1.25;
	player.position.set( Math.cos( a ) * r, TOWER.deck, Math.sin( a ) * r );
	player.yaw = Math.atan2( Math.cos( a ), Math.sin( a ) );
	player.pitch = 0;
	step( 0.1 );
	ok( story.interact.current && story.interact.current.id === 'lens', `facing the lens: '${ story.interact.current && story.interact.current.id }'` );
	ok( story.goal() === S.GOALS.lightWait, `in the lantern before sunset: '${ story.goal() }'` );

}

// the lamp: wait for sunset, light it, wind the machine
ok( item( 'lens' ).text() === 'Wait for sunset', `before sunset the lens offers: '${ item( 'lens' ).text() }'` );
await item( 'lens' ).use();
ok( Math.abs( story.h - ( S.SUNSET - 0.03 ) ) < 0.01, `waited until ${ clockText( story.h ) }` );
step( 2 );
await item( 'lens' ).use();
ok( app.lamp.lit && story.beat === 'machine', `lamp lit at ${ clockText( story.h ) }` );
for ( let i = 0; i < 200 && app.lamp.wind < 1; i ++ ) item( 'crank' ).onHold( 1 / 30 );
step( 1 );
ok( app.lamp.wind > 0.99 && story.beat === 'watch', `machine wound (${ app.lamp.wind.toFixed( 2 ) }): '${ story.beat }'` );
step( 20 );
ok( app.lamp.glow > 0.9 && app.lamp.speed > 0.9, `after 20 s the flame is up (${ app.lamp.glow.toFixed( 2 ) }) and the lens turning` );

// keep the watch until Gallan Head shows
const watchText = item( 'stool' ).text();
ok( /Keep the watch \(until 16\.2\d\)/.test( watchText ), `the stool: '${ watchText }'` );
await item( 'stool' ).use();
step( 8 );
ok( story.watcher.state === 'calling' && story.beat === 'gallan', `${ clockText( story.h ) }: Gallan Head is ${ story.watcher.state } ('${ story.beat }')` );
ok( Beams.uniforms.far.value[ 0 ].w > 0 || story.watcher.lamp === 0, 'her lamp is drawn as a far light' );

// the telescope and the signal lamp
await item( 'telescope' ).use();
ok( story.hasTelescope && ! st.moving.telescope.visible, 'the telescope taken from the sill' );
player.position.set( TOWER.signalStand.x, TOWER.deck, TOWER.signalStand.z );
item( 'signal' ).use();
ok( story.signal && story.watcher.state === 'sending', 'at the signal lamp: she sends' );
const t0 = story.h;
for ( let i = 0; i < 6000 && story.watcher.state !== 'done'; i ++ ) {

	step( 0.1 );
	await new Promise( ( r ) => setImmediate( r ) );

}

const said = story.watcher.log.filter( ( l ) => l.from === 'you' ).map( ( l ) => l.text );
ok( story.watcher.state === 'done' && said.length >= 4, `the exchange: ${ said.length } answers from you, ${ clockText( t0 ) } to ${ clockText( story.h ) }` );
console.log( '     you sent: ' + said.join( ' / ' ) );
ok( story.rows.some( ( r ) => r[ 1 ].includes( 'Signals exchanged' ) ), 'the journal has it' );
step( 2.5 );
ok( ! story.signal && input.enabled, 'back from the signal lamp' );

// the six o'clock observations, the machine's bell
if ( story.h < 17.9 ) await item( 'stool' ).use();
while ( story.h < 17.95 ) step( 1 );
ok( story.goal().startsWith( 'Chalk the six' ), `${ clockText( story.h ) }: '${ story.goal() }'` );
await item( 'slate' ).use();
ok( story.obs[ 18 ] && shown.forms === 1, 'six o\'clock chalked on the slate' );
let bell = false;
const onWarn = app.lamp.onWarning;
app.lamp.onWarning = () => { bell = true; onWarn(); };
for ( let i = 0; i < 400 && ! bell; i ++ ) step( 1 );
ok( bell && story.goal() === S.GOALS.bell, `${ clockText( story.h ) }: the bell, '${ story.goal() }'` );
for ( let i = 0; i < 200 && app.lamp.wind < 1; i ++ ) item( 'crank' ).onHold( 1 / 30 );
ok( app.lamp.wind > 0.99 && story.goal() !== S.GOALS.bell, 'wound again' );

// the haar
while ( story.h < story.haar + 0.1 ) {

	const t = item( 'stool' ).text();
	if ( t && story.watcher.state === 'done' ) await item( 'stool' ).use();
	else step( 1 );
	if ( story._obsDue() ) await item( 'slate' ).use();

}

step( 1 );
ok( story.beat === 'haar' && weatherAt( story.h + 0.5, story.haar ).vis < 2, `${ clockText( story.h ) }: the haar ('${ story.beat }'), visibility ${ weatherAt( story.h + 0.5, story.haar ).vis.toFixed( 1 ) } km` );

// out on the walkway: the light on Eilean Tighe, then the gate
player.position.set( Math.cos( 1.2 ) * 3.0, TOWER.deck, Math.sin( 1.2 ) * 3.0 );
player.yaw = Math.atan2( - ( 164 - player.position.x ), - ( 540 - player.position.z ) );
player.pitch = - 0.1;
for ( let i = 0; i < 120 && ! story.islet; i ++ ) step( 1 );
ok( !! story.islet, `${ clockText( story.h ) }: a light on Eilean Tighe` );
step( 42 );
ok( story.flags.isletSeen && story.beat === 'gate', `seen (${ clockText( story.flags.isletSeen ) }); then the gate: '${ story.goal() }'` );
const gateWind = app.lamp.wind;
app.lamp.wind = 1;
ok( storyGuidance( story )?.id === 'galleryDoor', 'the gate objective routes through the balcony door' );
app.lamp.wind = gateWind;
const gateWas = st.parts.doors.find( ( d ) => d.name === 'gate' ).target;
item( 'gate' ).use();
ok( story.beat === 'night' && st.parts.doors.find( ( d ) => d.name === 'gate' ).target !== gateWas, 'the gate seen to' );

// to dawn
if ( story._obsDue() ) await item( 'slate' ).use();
ok( item( 'stool' ).text() === 'Keep the watch until dawn', `the stool: '${ item( 'stool' ).text() }'` );
await item( 'stool' ).use();
ok( story.beat === 'dawn' && story.h > 32, `the small hours pass: ${ clockText( story.h ) } on the 4th ('${ story.beat }')` );
await item( 'lens' ).use();
step( 1 );
await item( 'lens' ).use();
ok( ! app.lamp.lit && story.beat === 'journal', `${ clockText( story.h ) }: the lamp out` );

// the journal
await item( 'journal' ).use();
ok( ! shown.end && story.beat === 'd2kitchen', 'the first journal leads into the second morning' );
const rows = story._journalRows().map( ( r ) => r.join( ' ' ) );
console.log( rows.map( ( r ) => '     ' + r ).join( '\n' ) );
ok( rows.some( ( r ) => r.includes( 'Lamp lit' ) ) && rows.some( ( r ) => r.includes( 'Lamp extinguished' ) ), 'lit and extinguished' );
ok( rows.some( ( r ) => r.includes( 'Eilean Tighe' ) ) && rows.some( ( r ) => r.includes( 'gate' ) ), 'the remarks entered' );
ok( rows.some( ( r ) => r.startsWith( '03.00' ) && ( SAY_NAME ? r.includes( 'country' ) : r.includes( 'west landing' ) ) ), 'and a line at three o\'clock' );
ok( JSON.parse( localStorage.getItem( story.saveKey ) ).beat === 'd2kitchen', 'the next morning is saved in the continuing watch' );

// The continuation: real director, lamp and terrain, with only the pages answered automatically.
const windFully = () => { for ( let i = 0; i < 200 && app.lamp.wind < 1; i ++ ) item( 'crank' ).onHold( 1 /30 ); };
async function exchange() {
	player.position.set( TOWER.signalStand.x, TOWER.deck, TOWER.signalStand.z );
	item( 'signal' ).use();
	for ( let i = 0; i < 6000 && story.watcher.state !== 'done'; i ++ ) { step( 0.1 ); await new Promise( r => setImmediate( r ) ); }
	step( 2.5 );
}
await item( 'kitchenDoor' ).use();
await item( 'kitchenStove' ).use();
player.position.set( -2.2, TOWER.floor, 8 );
ok( story.beat === 'd2crate' && storyGuidance( story )?.id === 'storesCrate', 'kitchen breakfast points to the crate inside the room' );
await item( 'storesCrate' ).use();
// Follow the actual guidance markers with the real walker, so a marker cannot
// send the player through the shed's back wall despite a manually valid route.
player.position.set( -22, terrainData.heightAt( -22, 27 ), 27 ); player.velocity.set( 0, 0, 0 );
keys.add( 'KeyW' );
for ( let i = 0; i < 16000; i ++ ) {
	const guide = storyGuidance( story ); if ( guide?.id === 'haulingBrake' ) break;
	if ( ! guide ) break;
	player.yaw = Math.atan2( player.position.x -guide.at.x, player.position.z -guide.at.z ); player.pitch = 0;
	step( 1 /60, 1 /60 );
}
keys.delete( 'KeyW' );
ok( storyGuidance( story )?.id === 'haulingBrake', 'following the real markers reaches the hauling brake around the shed walls' );
await item( 'haulingBrake' ).use();
ok( story.beat === 'd2rest' && story.next.state.survey, 'daylight inspection introduces the loose chain' );
player.position.set( -160, HAULING_SHED.floor, 40 );
ok( storyGuidance( story )?.id === 'shedExit', 'the daylight return first leads through the shed doorway' );
player.position.set( -2.2, TOWER.floor, 8 );
ok( storyGuidance( story )?.id === 'berthDoor', 'the berth route passes through its real doorway' );
await item( 'berthDoor' ).use(); await item( 'berth' ).use();
await item( 'lens' ).use(); windFully();
await exchange();
ok( story.beat === 'd2sleep' && story.watcher.familiar && story.watcher.log.some( l => l.text === 'TAPADH LEAT' ), 'the second watch exchanges familiar codes and Gaelic' );
await item( 'berth' ).use();
ok( story.beat === 'd2sleep' && ! story.next.state.sleepFrom, 'the berth cannot skip the evening watch before the small hours' );
await item( 'chair' ).use(); await item( 'berth' ).use();
ok( story.beat === 'd2sleep', 'rest requires a fully wound machine' );
windFully(); await item( 'berth' ).use();
ok( story.beat === 'd2wake' && Math.abs( story.h -story.next.state.sleepUntil ) < 1e-8 && Math.abs( story.next.state.sleepUntil -story.next.state.sleepFrom -2 ) < 1e-8 && app.lamp.lit && ! story.hand.lit && ! story.hand.carried && story.hand.rest.position.distanceTo( BERTH.lantern ) < 1e-8, 'two recorded hours asleep; the lighthouse burns and the lantern rests on the washstand' );
windFully(); await item( 'chair' ).use(); await item( 'lens' ).use(); await item( 'journal' ).use();
await item( 'kitchenStove' ).use(); await item( 'berth' ).use(); await item( 'lens' ).use(); windFully(); await exchange();
ok( story.beat === 'd3bank' && story.watcher.log.some( l => /AFTER TWO/.test( l.text ) ), 'Cate reports the little light the evening after the player slept' );
story.hand.carried = true; story.hand.lit = true;
await item( 'kitchenStove' ).use();
ok( story.beat === 'd3remote' && story.next.state.banked && story.hand.carried, 'banked coals and a storm lantern precede the remote task' );
player.position.set( HAULING_SHED.x, HAULING_SHED.floor, HAULING_SHED.z +0.8 );
const beforeLook = [ player.yaw, player.pitch ], pages = shown.read.length;
await item( 'haulingBrake' ).use();
ok( story.beat === 'd3return' && story.goal() === 'Return to the station.' && shown.read.length === pages && player.yaw === beforeLook[ 0 ] && player.pitch === beforeLook[ 1 ], 'the remote job ends without a page, forced turn or smoke objective' );
camera.position.copy( player.position ).add( new E.Vector3( 0, 1.62, 0 ) ); camera.lookAt( KITCHEN.chimney ); camera.updateMatrixWorld();
story.next.update( 0.1, false );
ok( ! story.next.state.smokeSeen, 'the shed walls do not count as noticing distant smoke' );
player.position.set( -157, terrainData.heightAt( -157, 44 ), 44 );
camera.position.copy( player.position ).add( new E.Vector3( 0, 1.62, 0 ) ); camera.lookAt( KITCHEN.chimney.clone().add( new E.Vector3( 3, 4, 1 ) ) ); camera.updateMatrixWorld();
story.next.update( 0.1, false );
ok( story.next.state.smokeSeen && hazeTransmittance( camera.position, story._herRender( new E.Vector3() ), app.haze.density.value ) < 0.012, 'a voluntary look notices smoke while Gallan Head is lost in fog' );
keys.add( 'KeyW' );
for ( let i = 0; i < 16000; i ++ ) {
	const guide = storyGuidance( story ); if ( guide?.id === 'houseDoor' ) break;
	if ( ! guide ) break;
	player.yaw = Math.atan2( player.position.x -guide.at.x, player.position.z -guide.at.z ); player.pitch = 0;
	step( 1 /60, 1 /60 );
}
keys.delete( 'KeyW' );
ok( storyGuidance( story )?.id === 'houseDoor' && player.position.x > 3, 'the marked return crosses the south gateway and goes around the house to its door' );
story.save();
const savedReturn = story.loadSave();
const resumed = new Story( app ); resumed.ui.fade = async () => {}; await resumed._restore( savedReturn );
ok( resumed.beat === 'd3return' && resumed.next.state.smokeSeen && resumed.watcher.script.nodes.time && resumed.doors.kitchen[ 0 ].target === 1, 'resume retains the remote evidence and named new doors' );
await item( 'kitchenStove' ).use(); windFully(); await item( 'berth' ).use();
await item( 'lens' ).use(); await item( 'journal' ).use(); await item( 'berth' ).use(); await item( 'lens' ).use(); windFully(); await exchange();
ok( story.beat === 'd4journal' && story.watcher.flags.toldSmoke && story.watcher.log.some( l => l.text === 'ONLY THE TOWER. WHY' ), 'the following clear evening gives the plain house question and smoke choice' );
await item( 'journal' ).use();
ok( story.beat === 'd4complete' && shown.end && story.next.state.recordedSmoke && story.loadSave().beat === 'd4complete', 'the chapter closes with a persistent journal and evidence choice' );
ok( story.next.signalBook().body.some( l => /TAPADH LEAT.*Thank you/.test( l ) ), 'received Gaelic and translation remain readable in the signal book' );
const normalSlot = localStorage.getItem( story.saveKey ); app.qs = new URLSearchParams( 'chapterPreview=kitchen' );
const preview = new Story( app ); preview.ui.card = async () => {}; await preview.start();
ok( preview.beat === 'd2kitchen' && preview.saveKey !== story.saveKey && localStorage.getItem( story.saveKey ) === normalSlot && preview.loadSave().beat === 'd2kitchen', 'chapter preview has its own save and leaves the normal watch untouched' );
preview.clearSave(); app.qs = new URLSearchParams();

// Missing the smoke must also remain a valid, honest path.
const unseen = new Story( app ); unseen.beat = 'd4signal'; unseen.next.state.episode = 0; unseen.next.episode( 4 );
ok( unseen.watcher.script.nodes.house.options.every( o => o.flag !== 'toldSmoke' ), 'unseen smoke is absent from Walter’s dialogue options' );
// Positional v1 saves predate the two new doors; their old gate states still map correctly.
const oldSave = { ...savedReturn, beat: 'watch', flags: {}, doors: [ 1, 0, 1, 0 ] }; delete oldSave.doorStates;
const oldReader = new Story( app ); oldReader.ui.fade = async () => {}; oldSave.watcher = null;
await oldReader._restore( oldSave );
ok( oldReader.doors.gallery[ 0 ].target === 1 && oldReader.doors.house[ 0 ].target === 0 && oldReader.doors.gate[ 0 ].target === 1 && oldReader.doors.gate[ 1 ].target === 0, 'legacy saves preserve original door/gate states after adding two rooms' );
story.clearSave();

// a night where the machine is wound before the lamp is lit: lighting it sets the watch going
{

	const s3 = new Story( app );
	s3.ui.card = s3.ui.fade = async () => {};
	s3.ui.read = async () => {};
	app.lamp.lit = false;
	app.lamp.wind = 0;
	await s3.start();
	s3.setBeat( 'light' );
	for ( let i = 0; i < 200 && app.lamp.wind < 1; i ++ ) s3.interact.get( 'crank' ).onHold( 1 / 30 );
	s3.h = S.SUNSET;
	await s3.interact.get( 'lens' ).use();
	ok( app.lamp.lit && s3.beat === 'watch', `wound first, then lit: '${ s3.beat }'` );
	s3.clearSave();

}

// a night where she is never answered: the haar takes her, the objective moves on
{

	const s2 = new Story( app );
	s2.ui.card = s2.ui.fade = async () => {};
	s2.ui.read = async () => {};
	await s2.start();
	app.lamp.lit = true;
	app.lamp.wind = 1;
	app.lamp.running = true;
	s2.setBeat( 'watch' );
	s2.h = 16.6;
	s2.update( 0.1 );
	s2.h = 21.5;
	app.lamp.wind = 1;
	for ( let i = 0; i < 5; i ++ ) s2.update( 0.1 );
	ok( s2.watcher.state === 'done' && ! /Gallan Head/.test( s2.goal() ), `unanswered, the haar takes her: '${ s2.goal() }'` );

}

console.log( fails ? `${ fails } failed` : 'all passed' );
process.exit( fails ? 1 : 0 );
