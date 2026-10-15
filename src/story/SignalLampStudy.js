import { MathUtils, Matrix4, Quaternion, Vector3 } from '../engine/index.js';
import { G } from '../core/Globals.js';
import { TOWER } from '../world/flannan/Station.js';
import { MORSE } from './Watcher.js';

// "Examine the signal lamp": by daylight, the walkway's Begbie-pattern lamp (Lamp, signalling, "B") can be
// looked over, prepared, lit, laid and worked, as a signaller of 1901 would have done it. The lamp is a small
// physical model driven by the story clock: kerosene burns from the fount, the wick chars, a cold lamp or a
// pushed-down chimney draws badly and smokes if the wick is turned too high, smoke clouds the glass, and the
// shutter key shows the light only while it is held. Nothing here is scored or timed.
//
// Evidence (docs/SIGNAL-LAMP.md): the Army's 1889 signalling catechism (dot and dash, the unit intervals), the
// 1893 equipment regulations (lamp "B", glass chimneys, wick, kerosene), the 1910 and 1915 handbooks (six-inch
// bullseye, flat wick in a circular burner, ten hours' fount, noisy shutter, 4-8 or up to 10 miles' range).
// Vane count, chimney travel, warm-up and smoking thresholds are authored reconstructions.

export const SIGNAL_LAMP_PAPER = {
	id: 'signal-lamp', label: 'Lamp, signalling, “B”', sub: 'The Begbie lamp on the balcony, and how it is worked.', title: 'Lamp, signalling, “B” (the Begbie lamp)',
	body: [
		'A black sheet-iron box with a six-inch bullseye lens in front. Inside, a flat wick burns in a circular burner, turned edge-on to the lens, with a glass chimney round the flame. Kerosene is carried in the fount under the burner: a full fount lasts about ten hours. Spare oil and chimneys travel in the lamp’s box. Lamp and box together weigh about 35 pounds.',
		'Behind the lens are shutter vanes. They are closed at rest. Pressing the brass key on the lid opens them, and a spring closes them again when the key is released. Signals are made by showing the light: a short flash is a dot, and a dash lasts as long as three dots. Leave one dot’s length between the parts of a letter, three between letters and six between words. Keep these proportions at any speed.',
		'To prepare the lamp, fill the fount and trim the wick while the lamp is cold. Draw up the chimney. Open the side door, lift the glass chimney, light the wick turned low, then seat the glass and shut the door. Turn the wick up slowly as the lamp warms. A wick turned up too soon or too high smokes. The smoke blackens the glass and dims the beam.',
		'Lay the lamp on the distant station with the sights on the lid. The beam is narrow, and off the line nothing is seen. By night the Army reckoned the lamp readable at four to eight miles, and up to ten in England. By day the heliograph did the work. The shutter is noisy, and on a still night its clatter carries several hundred yards.',
		'To put the lamp out, turn the wick down until the flame dies. Let the lamp cool before trimming the wick or cleaning the glass. Never fill a lit lamp.',
	],
	provenance: 'The lamp’s type, fuel, lens size, burner, fount endurance, weight, noisy shutter and ranges come from the Army’s own handbooks and equipment lists. The dot-and-dash proportions are those of the 1889 Army signalling catechism. Nothing found places a Begbie lamp at the Flannan station. It is the period-correct portable shuttered lamp for 1901, not a documented fitting. The vane count, chimney travel, side door, warm-up time and smoking threshold are reconstructions. Gallan Head is about twenty miles from Eilean Mòr, beyond the ranges the handbooks give. The story’s night exchanges with Cate are fiction.',
	sources: [
		{ label: 'Edye & Rhodes · Catechism on the Manual of Instruction in Army Signalling (1889)', url: 'https://archive.org/details/catechismonmanua00edyerich' },
		{ label: 'Regulations for the Equipment of the Regular Army (1893) · lamps, signalling, “B”', url: 'https://archive.org/details/regsequipmentreguarmy1893' },
		{ label: 'The Active Service Pocket Book (1915) · the Begbie lamp', url: 'https://archive.org/details/activeservicepocketbook1915' },
		{ label: 'Priestley · The Signal Service in the European War (1921)', url: 'https://archive.org/details/signalserviceine00prie' },
		{ label: 'Collections WA · Begbie signal lamp, 1885–1915', url: 'https://collectionswa.net.au/items/4cc23cb3-5ea2-46f7-8b9e-e66ccfb941ae' },
		{ label: 'Soldiers of Oxfordshire Museum · Begbie oil signal lamp', url: 'https://www.sofo.org.uk/exhibits/begbie-oil-signal-lamp/' },
	],
	chapters: [
		{ title: 'Meet the lamp', kicker: '01 · A beam across the water', heading: 'A flame, a lens and a shutter', paragraphs: [
			'A kerosene flame supplies the light. The six-inch bullseye lens gathers it into a narrow beam. Sights on the lid help the signaller aim at another station.',
			'The shutter stays closed at rest. Hold the brass key to show the light; release it and a spring closes the vanes. You send a message by choosing how long each flash lasts.',
		], takeaway: 'Try it: examine the bullseye, then hold and release the shutter key.' },
		{ title: 'Light it', kicker: '02 · Prepare and tend', heading: 'Start with a low flame', paragraphs: [
			'With the lamp cold, fill the fount and trim the wick. Draw up the copper chimney so air can flow through the lamp.',
			'Open the side door and lift the glass chimney. Light a low wick, seat the glass and shut the door. Raise the wick gradually as the lamp warms.',
			'Too much wick too soon makes smoke, which blackens the glass and dims the beam. Turn the wick down to put the lamp out. Let it cool before filling, trimming or cleaning.',
		], takeaway: 'Watch for a clear flame. A full fount was reckoned to last about ten hours.' },
		{ title: 'Send a letter', kicker: '03 · Speak in flashes', heading: 'Short flash, long flash', paragraphs: [
			'A dot is a short flash. A dash lasts three dots. Leave one dot between the parts of a letter, three between letters and six between words: the proportions in the 1889 Army catechism.',
			'Keep the same rhythm as you change speed. In the study, your flashes appear below the key and are read back as letters. Start with E (one dot), then T (one dash), then A (dot–dash).',
		], takeaway: 'Try it: light the lamp, choose “Send a letter”, and make your own flashes.' },
		{ title: 'History & story', kicker: '04 · What the evidence supports', heading: 'Period equipment, fictional posting', paragraphs: [
			'Army equipment lists and handbooks describe the Begbie-pattern lamp, its kerosene fuel, lens, burner and shutter. They give a night range of four to eight miles, sometimes up to ten. Daylight signallers used the heliograph.',
			'No source found places this lamp at Flannan. Gallan Head is about twenty miles away, beyond the recorded range. Cate’s exchanges belong to the story.',
			'The internal vane count, side door, chimney movement and simulation’s warming and smoking rates are reconstructions. The sources below explain the boundary.',
		], takeaway: 'Explore a period mechanism while keeping the station’s documented history separate.' },
	],
};

export const FULL_HOURS = 10; // a full fount at a full flame (Active Service Pocket Book, 1915)
const WARM = 0.08; // game hours: the lamp's warming time constant (authored)
const COOL = 0.3;
const DECODE = Object.fromEntries( Object.entries( MORSE ).map( ( [ k, v ] ) => [ v, k ] ) );
const FRESH = () => ( { oil: 1, char: 0, soot: 0, door: false, raised: false, lifted: false, lit: false, wick: 0.2, heat: 0, examined: false, seen: [] } );

// camera framings, in the lamp's own frame (metres; +z is the way the lens faces, +x the side door)
const VIEWS = {
	front: { eye: [ 0.6, 1.4, 1.22 ], at: [ 0, 1.08, 0.06 ] },
	lens: { eye: [ 0.22, 1.18, 0.72 ], at: [ 0, 1.09, 0.13 ] },
	door: { eye: [ 0.68, 1.28, 0.12 ], at: [ 0.02, 1.08, 0 ] },
	top: { eye: [ 0.3, 1.62, 0.3 ], at: [ 0, 1.29, 0 ] },
	sights: { eye: [ 0.08, 1.287, - 0.34 ], at: [ 0.08, 1.287, 20 ] },
	tripod: { eye: [ 0.95, 0.95, 0.6 ], at: [ 0, 0.6, 0 ] },
	can: { eye: [ 0.55, 0.55, - 0.55 ], at: [ - 0.13, 0.12, - 0.2 ] },
};

const LOOKS = [
	{ id: 'lens', label: 'The bullseye', view: 'lens', text: 'A six-inch plano-convex lens in a brass bezel. It gathers the flame into a narrow beam, so the lamp must be laid on the far station. Off that line, the flashes are not seen.' },
	{ id: 'shutter', label: 'Shutter and key', view: 'top', text: 'Behind the glass, iron vanes turn together like a Venetian blind. The brass key on the lid opens them only while it is pressed, and a spring shuts them again. Signals are made by showing the light. The action is noisy, and on a still night it carries.' },
	{ id: 'burner', label: 'The burner', view: 'door', when: s => s.door, text: 'A flat wick in a circular burner, turned edge-on to the lens, with a glass chimney round the flame. The fount below holds the kerosene, about ten hours at a full flame. A knob on the far side turns the wick up and down.' },
	{ id: 'chimney', label: 'The chimney', view: 'top', text: 'The copper chimney telescopes. It is pushed down for packing and drawn up for use, so that the lamp draws and the flame burns clear. The vented cap keeps out wind and rain.' },
	{ id: 'sights', label: 'The sights', view: 'sights', text: 'A foresight and a backsight stand on the lid. Bring the far station into line with both, and the beam is laid on it.' },
	{ id: 'tripod', label: 'Tripod', view: 'tripod', text: 'A wooden tripod with brass fittings, of the pattern issued for both the lamp and the heliograph. The box screws onto its head. Lamp and box together weigh about 35 pounds.' },
	{ id: 'can', label: 'The oil can', view: 'can', text: 'Kerosene, as the 1893 equipment list names it. Fill the fount only when the lamp is out and cool enough to handle.' },
];

	const _a = new Vector3(), _b = new Vector3(), _q = new Quaternion(), _m = new Vector3(), _right = new Vector3(), _up = new Vector3( 0, 1, 0 ), _look = new Matrix4();

export class SignalLampStudy {

	constructor( story ) {

		this.s = story;
		this.active = false;
		this.view = 'front';
		this.note = '';
		this.pressed = false; // the key, held
		this.open = 0; // the vanes, 0 shut .. 1 open (they follow the key quickly)
		this.morse = { marks: '', text: '', unit: 0.24, down: 0, up: 0, letter: '', sent: false };
		this._lastH = null;
		this._flicker = 0;
		this._rangeNoted = false;
		this.el = null;
		this.chapter = 'explore';
		this.challenge = 'E';

	}

	get state() {

		const f = this.s.flags;
		if ( ! f.signalLamp ) f.signalLamp = FRESH();
		return f.signalLamp;

	}

	// ---- the lamp as a physical thing

	get draught() {

		const st = this.state;
		return ( st.raised ? 1 : 0.55 ) * ( st.lifted ? 0.4 : 1 ) * ( st.door ? 0.85 : 1 );

	}

	// flame size from the wick (0 out .. 1 a full working flame), starved as the fount runs dry
	get flame() {

		const st = this.state;
		if ( ! st.lit ) return 0;
		return MathUtils.clamp( ( st.wick - 0.05 ) / 0.75, 0, 1.3 ) * Math.min( 1, st.oil / 0.02 );

	}

	// the largest flame the lamp will burn clearly now: a cold lamp, or one that draws badly, smokes sooner
	get limit() {

		return 0.3 + 0.6 * this.state.heat * this.draught;

	}

	get smoking() {

		return this.state.lit && this.flame > this.limit + 0.03;

	}

	// light through the lens with the shutter open (0..1)
	get output() {

		const st = this.state;
		if ( ! st.lit ) return 0;
		const clear = Math.min( this.flame, this.limit ) / 0.85;
		return MathUtils.clamp( clear * ( 0.35 + 0.65 * st.heat ) * ( 1 - 0.65 * st.soot ) * ( 1 - 0.35 * st.char ), 0, 1 );

	}

	// the lamp burns, warms, cools and chars on the story clock, whether or not anyone is at it
	tick( dh ) {

		const st = this.state;
		if ( ! ( dh > 0 ) ) return;
		const flame = this.flame;
		const target = st.lit ? Math.min( 1, 0.45 + 0.8 * flame ) : 0;
		st.heat += ( target - st.heat ) * ( 1 - Math.exp( - dh / ( target > st.heat ? WARM : COOL ) ) );
		if ( ! st.lit ) return;
		if ( this.smoking ) st.soot = Math.min( 1, st.soot + dh * ( flame - this.limit ) * 8 );
		st.char = Math.min( 1, st.char + dh * flame / 5 );
		st.oil = Math.max( 0, st.oil - dh * flame / FULL_HOURS );
		if ( st.oil <= 0 ) {

			st.lit = false;
			if ( this.active ) this.say( 'The flame shrinks, flickers and goes out. The fount is dry.' );

		}

	}

	// ---- what can be done, as things stand

	actions() {

		const st = this.state, out = [];
		const add = ( id, label, run ) => out.push( { id, label, run } );
		add( 'door', st.door ? 'Shut the side door' : 'Open the side door', () => this.door( ! st.door ) );
		add( 'raise', st.raised ? 'Push the chimney down' : 'Draw up the chimney', () => this.chimney( ! st.raised ) );
		if ( st.door ) add( 'glass', st.lifted ? 'Seat the glass chimney' : 'Lift the glass chimney', () => this.glass( ! st.lifted ) );
		if ( st.door && ! st.lit ) {

			add( 'match', 'Strike a match to the wick', () => this.light() );
			add( 'fill', 'Fill the fount from the can', () => this.fill() );
			add( 'trim', 'Trim the wick', () => this.trim() );
			add( 'clean', 'Clean the glass chimney', () => this.clean() );

		}

		add( 'up', 'Turn the wick up', () => this.turn( 0.1 ) );
		add( 'down', 'Turn the wick down', () => this.turn( - 0.1 ) );
		return out;

	}

	door( open ) {

		this.state.door = open;
		this.say( open ? 'The side door swings open on the burner and the fount.' : 'You shut the side door and turn the catch.' );
		this.focus( open ? 'door' : 'front' );
		this.s.save();

	}

	chimney( up ) {

		const st = this.state;
		st.raised = up;
		this.say( up ? 'You draw the copper chimney up to its full height. The lamp will draw better.' : st.lit ? 'You push the chimney down. With the draught cut, the flame lengthens and starts to smoke unless the wick is lowered.' : 'You push the chimney down into its packing position.' );
		this.focus( 'top' );
		this.s.save();

	}

	glass( lift ) {

		const st = this.state;
		st.lifted = lift;
		this.say( lift ? st.lit ? 'You lift the glass. The flame wavers and smokes in the open air.' : 'You lift the glass chimney clear of the wick.' : 'You lower the glass chimney onto its seat round the burner.' );
		this.focus( 'door' );
		this.s.save();

	}

	light() {

		const st = this.state;
		this.focus( 'door' );
		if ( ! st.lifted ) return this.say( 'The glass chimney is in the way. Lift it before you put a match to the wick.' );
		if ( st.oil <= 0.02 ) return this.say( 'The match flares, but the wick is dry. Fill the fount first.' );
		if ( st.wick < 0.1 ) return this.say( 'The wick is down inside the burner, so the match cannot reach it. Turn it up a little.' );
		st.lit = true;
		const sound = this.sound;
		if ( sound?.handLamp ) sound.handLamp( true, TOWER.signal );
		this.say( st.wick > 0.45 ? 'The wick catches all along its edge in a tall, ragged flame. It is turned up too high for a cold lamp.' : 'The wick catches along its edge in a low, steady flame. Seat the glass, shut the door, and let the lamp warm before turning it up.' );
		this.s.save();

	}

	fill() {

		const st = this.state;
		this.focus( 'can' );
		if ( st.heat > 0.3 ) return this.say( 'The fount is still hot. Let the lamp cool before you pour kerosene near it.' );
		const before = st.oil;
		st.oil = 1;
		this.say( before > 0.95 ? 'You unscrew the filler cap. The fount is already full to the neck.' : 'You unscrew the filler and pour from the can until the fount is full. You wipe the spilled oil off the brass.' );
		this.s.save();

	}

	trim() {

		const st = this.state;
		this.focus( 'door' );
		if ( ! st.lifted ) return this.say( 'Lift the glass chimney to reach the wick.' );
		if ( st.heat > 0.3 ) return this.say( 'The burner is too hot to touch. Let it cool before you trim the wick.' );
		const had = st.char;
		st.char = 0;
		this.say( had > 0.15 ? 'You cut the charred crust off square and nip the corners, so the flame will burn evenly.' : 'The wick is already square and clean. A touch of the scissors evens one corner.' );
		this.s.save();

	}

	clean() {

		const st = this.state;
		this.focus( 'door' );
		if ( st.heat > 0.3 ) return this.say( 'The glass is too hot to handle yet.' );
		const had = st.soot;
		st.soot = 0;
		this.say( had > 0.1 ? 'You lift out the glass and polish off the soot until it is clear again.' : 'You lift out the glass and polish it. It was clean already.' );
		this.s.save();

	}

	turn( d ) {

		const st = this.state, was = st.lit;
		st.wick = MathUtils.clamp( Math.round( ( st.wick + d ) * 10 ) / 10, 0, 1 );
		if ( this.view !== 'door' && this.view !== 'front' ) this.focus( 'front' );
		if ( was && st.wick < 0.05 ) {

			st.lit = false;
			const sound = this.sound;
			if ( sound?.handLamp ) sound.handLamp( false, TOWER.signal );
			return this.say( 'You turn the wick right down. The flame shrinks to a blue bead and goes out.' );

		}

		if ( ! st.lit ) return this.say( st.wick < 0.1 ? 'The wick sinks below the slot of the burner.' : `The wick stands ${ st.wick > 0.5 ? 'well up' : 'a little' } above the burner.` );
		const f = this.flame, lim = this.limit;
		this.say( f > lim + 0.03 ? 'The flame climbs and begins to smoke. Black threads rise from the cap.' : f > lim - 0.12 ? 'The flame is broad and bright, just short of smoking.' : st.heat < 0.6 ? 'The flame grows. The lamp is still warming and will take more wick as it heats.' : 'The flame settles a little brighter.' );

	}

	// ---- the shutter key: a held key shows the light; flashes are read back as Morse

	press( on ) {

		if ( on === this.pressed ) return;
		this.pressed = on;
		const sound = this.sound;
		if ( sound?.signalShutter ) sound.signalShutter( on );
		const m = this.morse;
		if ( on ) {

			if ( this.view !== 'front' && this.view !== 'lens' ) this.focus( 'front' );
			m.down = 0;

		} else this._mark( m.down );

	}

	_mark( d ) {

		const m = this.morse;
		const dot = d < 2 * m.unit;
		m.unit = MathUtils.clamp( MathUtils.lerp( m.unit, dot ? d : d / 3, 0.3 ), 0.08, 0.8 );
		m.letter += dot ? '.' : '-';
		m.marks += dot ? '·' : '–';
		m.up = 0;
		if ( m.marks.length > 60 ) m.marks = m.marks.slice( - 60 );
		const st = this.state;
		if ( ! st.lit ) {

			if ( ! m.sent ) this.say( 'The vanes clatter open and shut. With the lamp unlit there is nothing to show.' );
			m.sent = true;

		} else if ( ! this._rangeNoted ) {

			this._rangeNoted = true;
			const miles = this.s.her ? Math.round( this.s.her.distanceTo( TOWER.signal ) / 1609.344 ) : 20;
			this.say( `In this daylight the flash is a yellow wink in the glass. Gallan Head is about ${ miles } miles off, and the Army reckoned this lamp good for four to eight miles at night. By day, signallers used the heliograph.` );

		}

	}

	_spaces( dt ) {

		const m = this.morse;
		if ( this.pressed ) {

			m.down += dt;
			return;

		}

		m.up += dt;
		// a letter ends after a gap of three units, a word after six (taken at the midpoints, 2 and 4.5)
		if ( m.letter && m.up > 2 * m.unit ) {

			m.text += DECODE[ m.letter ] || '?';
			m.letter = '';
			m.marks += ' ';

		}

		if ( m.text && ! m.text.endsWith( ' ' ) && ! m.letter && m.up > 4.5 * m.unit ) {

			m.text += ' ';
			m.marks += '/ ';

		}

		if ( m.text.length > 40 ) m.text = m.text.slice( - 40 );

	}

	// ---- being at the lamp

	get daylight() {

		return ( G.night?.value ?? 0 ) < 0.5;

	}

	available() {

		const s = this.s;
		return this.daylight && ! this.active && ! s.signal && ! s.ui.open && ! s.islandReveal?.active && ! [ 'intro', 'crossing', 'end' ].includes( s.beat );

	}

	// the night signal item keeps the lamp when Cate is calling or talking
	offered() {

		const w = this.s.watcher;
		return this.available() && ! ( w && ( w.talking || w.state === 'calling' ) );

	}

	get sound() {

		return this.s.sound || this.s.app.stationSound || null;

	}

	install() {

		const s = this.s, I = s.interact;
		I.add( { id: 'signalLampExamine', at: () => this.world( _m.set( 0, 1.12, 0 ) ), reach: 2.0, size: 0.3,
			when: () => this.offered(), text: () => this.state.lit ? 'Examine the signal lamp · burning' : 'Examine the signal lamp', use: () => this.enter() } );
		const sig = I.get( 'signal' );
		if ( sig ) {

			const when = sig.when;
			sig.when = () => when() && ! this.offered();

		}

		this.sync();

	}

	// a point in the lamp's frame, in the world
	world( v, out = v ) {

		const L = TOWER.signalLamp;
		if ( ! L ) return out.copy( TOWER.signal || v );
		const c = Math.cos( L.ry ), sn = Math.sin( L.ry );
		return out.set( L.position.x + v.x * c + v.z * sn, L.position.y + v.y, L.position.z - v.x * sn + v.z * c );

	}

	enter() {

		if ( ! this.available() ) return false;
		const s = this.s, app = s.app, p = app.player, cam = app.camera;
		this.active = true;
		const rail = s.moving?.balconyRail;
		this._railVisible = rail?.visible;
		if ( rail ) rail.visible = false;
		this.state.examined = true;
		this.previous = { position: p.position.clone(), yaw: p.yaw, pitch: p.pitch, busy: p.busy, fov: cam.fov };
		p.busy = true;
		app.input.enabled = false;
		app.input.reset?.();
		if ( globalThis.document?.exitPointerLock && document.pointerLockElement ) document.exitPointerLock();
		if ( TOWER.signalStand ) p.position.set( TOWER.signalStand.x, TOWER.deck, TOWER.signalStand.z );
		s.ui.setHUD( false );
		s.ui.strip( null );
		this._from = { position: cam.position.clone(), quaternion: cam.quaternion.clone() };
		this._blend = 0;
		this.focus( 'front' );
		this.say( 'The Army’s signalling lamp, pattern “B”, on its tripod. The bullseye is laid on Gallan Head.' );
		this.morse = { marks: '', text: '', unit: 0.24, down: 0, up: 0, letter: '', sent: false };
		this.buildPanel();
		s.save();
		return true;

	}

	leave() {

		if ( ! this.active ) return;
		const s = this.s, app = s.app, p = app.player, cam = app.camera, v = this.previous;
		this.press( false );
		this.active = false;
		if ( s.moving?.balconyRail ) s.moving.balconyRail.visible = this._railVisible ?? true;
		this.el?.remove();
		this.el = null;
		window.removeEventListener( 'keydown', this._down, true );
		window.removeEventListener( 'keyup', this._up, true );
		window.removeEventListener( 'blur', this._release );
		if ( v ) {

			p.position.copy( v.position );
			p.yaw = v.yaw;
			p.pitch = v.pitch;
			p.busy = v.busy;
			cam.fov = v.fov;
			cam.updateProjectionMatrix();

		}

		app.input.enabled = true;
		app.input.keys?.clear?.();
		app.input.requestLock?.();
		s.ui.setHUD( true );
		app.cameraCut?.();
		s.save();

	}

	focus( view ) {

		if ( ! VIEWS[ view ] || view === this.view && this._blend >= 1 ) return;
		const cam = this.s.app.camera;
		this._from = { position: cam.position.clone(), quaternion: cam.quaternion.clone() };
		this.view = view;
		this._blend = 0;

	}

	say( text ) {

		this.note = text;
		this._dirty = true;

	}

	// ---- the panel

	buildPanel() {

		if ( ! globalThis.document ) return;
		const root = this.s.ui.root;
		const el = this.el = document.createElement( 'div' );
		el.className = 'sh-lamp-study';
		el.setAttribute( 'role', 'dialog' );
		el.setAttribute( 'aria-label', 'The signal lamp' );
		el.innerHTML = '<div class="sh-lamp-kicker">Keeper’s field guide</div><div class="sh-lamp-head"><h2>The signal lamp</h2></div>' +
			'<p class="sh-lamp-cutaway">Study cutaway · balcony rail hidden</p><nav class="sh-lamp-tabs" aria-label="Lamp lesson"></nav>' +
			'<div class="sh-lamp-scroll"><div class="sh-lamp-lesson"><span class="sh-lamp-step"></span><h3></h3><p class="sh-lamp-hint"></p><button class="sh-btn sh-lamp-next"></button></div>' +
			'<div class="sh-lamp-row sh-lamp-looks" aria-label="Lamp parts"></div>' +
			'<div class="sh-lamp-challenge" hidden><div class="sh-lamp-targets" aria-label="Choose a letter"></div><p class="sh-lamp-result" aria-live="polite"></p></div>' +
			'<p class="sh-lamp-note" aria-live="polite"></p><div class="sh-lamp-state"></div>' +
			'<div class="sh-lamp-morse" aria-live="polite"></div>' +
			'<details class="sh-lamp-controls"><summary>All lamp controls</summary><div class="sh-lamp-row sh-lamp-work"></div></details>' +
			'</div><div class="sh-lamp-key-row"></div><div class="sh-lamp-row sh-lamp-foot"></div>';
		for ( const [ id, label ] of [ [ 'explore', '1 · Explore' ], [ 'light', '2 · Light it' ], [ 'send', '3 · Send a letter' ] ] ) {
			const b = document.createElement( 'button' );
			b.textContent = label; b.dataset.chapter = id;
			b.addEventListener( 'click', () => { this.chapter = id; this.focus( 'front' ); this.refresh(); } );
			el.querySelector( '.sh-lamp-tabs' ).append( b );
		}
		for ( const [ letter, marks ] of [ [ 'E', '·' ], [ 'T', '—' ], [ 'A', '· —' ] ] ) {
			const b = document.createElement( 'button' ); b.className = 'sh-chip';
			b.textContent = `${ letter }  ${ marks }`; b.dataset.letter = letter;
			b.addEventListener( 'click', () => { this.challenge = letter; this.resetFlashes(); } );
			el.querySelector( '.sh-lamp-targets' ).append( b );
		}
		el.querySelector( '.sh-lamp-next' ).addEventListener( 'click', () => this.lesson().run?.() );
		const foot = el.querySelector( '.sh-lamp-foot' );
		const key = this.keyEl = document.createElement( 'button' );
		key.className = 'sh-btn sh-lamp-key';
		key.textContent = this.s.app.isMobile ? 'Hold to flash' : 'Hold to flash · Space';
		const down = ( e ) => { e.preventDefault(); key.setPointerCapture?.( e.pointerId ); this.press( true ); };
		const up = () => this.press( false );
		key.addEventListener( 'pointerdown', down );
		key.addEventListener( 'pointerup', up );
		key.addEventListener( 'pointercancel', up );
		key.addEventListener( 'lostpointercapture', up );
		const read = document.createElement( 'button' );
		read.className = 'sh-btn sh-btn-soft';
		read.textContent = 'Read the field guide';
		this.readEl = read;
		read.addEventListener( 'click', () => this.read() );
		const back = document.createElement( 'button' );
		back.className = 'sh-btn sh-btn-soft';
		back.textContent = this.s.app.isMobile ? 'Step away' : 'Step away · Esc';
		back.addEventListener( 'click', () => this.leave() );
		el.querySelector( '.sh-lamp-key-row' ).append( key );
		const clear = document.createElement( 'button' ); clear.className = 'sh-chip'; clear.textContent = 'Clear flashes';
		clear.addEventListener( 'click', () => this.resetFlashes() );
		el.querySelector( '.sh-lamp-key-row' ).append( clear );
		foot.append( read, back );
		root.append( el );
		this._down = ( e ) => this.keydown( e );
		this._up = ( e ) => this.keyup( e );
		window.addEventListener( 'keydown', this._down, true );
		window.addEventListener( 'keyup', this._up, true );
		this._release = () => this.press( false );
		window.addEventListener( 'blur', this._release );
		this._listKey = '';
		this._lessonKey = '';
		this._resultText = '';
		this._stateText = this._morseText = null;
		this._dirty = true;
		this.refresh();

	}

	keydown( e ) {

		if ( ! this.active || this.s.ui.open ) return;
		if ( e.code === 'Space' && e.target?.closest?.( 'button, summary' ) && e.target !== this.keyEl ) return;
		if ( e.code === 'Space' ) {

			e.preventDefault();
			e.stopImmediatePropagation();
			if ( ! e.repeat ) this.press( true );

		} else if ( e.code === 'Escape' ) {

			e.preventDefault();
			e.stopImmediatePropagation();
			this.leave();

		} else if ( /^Digit[1-9]$/.test( e.code ) && ! e.repeat ) {

			const a = this.actions()[ Number( e.code.slice( 5 ) ) - 1 ];
			if ( a ) {

				e.preventDefault();
				e.stopImmediatePropagation();
				a.run();

			}

		}

	}

	keyup( e ) {

		if ( e.code === 'Space' && this.active ) {

			e.preventDefault();
			this.press( false );

		}

	}

	async read() {
		if ( this._reading || this.s.ui.open ) return;
		this._reading = true;
		if ( this.readEl ) this.readEl.disabled = true;
		this.press( false );
		try { await this.s.ui.read( SIGNAL_LAMP_PAPER ); }
		finally {
			this._reading = false;
			if ( this.readEl ) { this.readEl.disabled = false; this.readEl.focus?.(); }
		}
	}

	resetFlashes() {
		this.press( false );
		this.morse = { marks: '', text: '', unit: 0.24, down: 0, up: 0, letter: '', sent: false };
		this.refresh();
	}

	lesson() {
		const st = this.state;
		const step = ( n, title, hint, action, run ) => ( { n, title, hint, action, run } );
		if ( this.chapter === 'explore' ) return step( 'Explore the mechanism', 'How do you send light?', 'A flame supplies the light. A lens gathers it. A shutter turns it into a message. Choose a part to move in closer.', 'Show the whole lamp', () => this.focus( 'front' ) );
		if ( this.chapter === 'send' ) return step( 'Try it yourself', 'Send a single letter', 'E is one short flash. T is a flash three times as long. A is short, then long. Release the key and leave a gap to see your letter.', st.lit ? '' : 'First, light the lamp', () => { this.chapter = 'light'; this.refresh(); } );
		if ( this.smoking ) return step( 'Tend the flame', 'A little less wick', 'Smoke dims the beam. Lower the wick until the flame burns clearly.', 'Lower the wick', () => this.turn( -0.1 ) );
		if ( ! st.raised ) return step( 'Step 1 of 7', 'Give the flame a draught', 'Draw up the copper chimney so air can move through the lamp.', 'Raise the chimney', () => this.chimney( true ) );
		if ( ! st.lit ) {
			if ( ! st.door ) return step( 'Step 2 of 7', 'Reach the burner', 'Open the side door to reach the wick and glass chimney.', 'Open the side door', () => this.door( true ) );
			if ( ! st.lifted ) return step( 'Step 3 of 7', 'Make room for a match', 'Lift the glass chimney clear of the wick.', 'Lift the glass', () => this.glass( true ) );
			if ( st.oil <= 0.02 ) return step( 'Prepare the fount', 'The lamp needs oil', 'Fill the fount when the lamp is out and cool.', 'Fill the fount', () => this.fill() );
			if ( st.wick < 0.1 || st.wick > 0.3 ) return step( 'Prepare the wick', 'Start low', 'A low wick catches without smoking. Adjust it before lighting.', 'Set a low wick', () => this.turn( st.wick < 0.1 ? 0.1 : -0.1 ) );
			return step( 'Step 4 of 7', 'Light the wick', 'The match catches along the wick’s edge. Keep the flame low at first.', 'Strike a match', () => this.light() );
		}
		if ( st.lifted ) return step( 'Step 5 of 7', 'Protect the flame', 'Seat the glass chimney around the burner.', 'Seat the glass', () => this.glass( false ) );
		if ( st.door ) return step( 'Step 6 of 7', 'Close the lamp', 'Shut the side door to steady the draught.', 'Shut the side door', () => this.door( false ) );
		if ( st.heat < 0.55 ) return step( 'Step 7 of 7 · Warming', 'Let the flame settle', 'Watch the low flame warm the lamp. Then raise the wick a little at a time. There is no hurry.', '' );
		if ( st.wick < 0.6 ) return step( 'Step 7 of 7', 'Build a clear flame', 'The lamp is warming. Raise the wick by one small turn and watch how the flame responds.', 'Raise the wick a little', () => this.turn( 0.1 ) );
		return step( 'Ready to signal', 'You have a working light', 'Now give the flame a rhythm. Hold the shutter key to show the beam and release it to hide the light.', 'Try sending a letter', () => { this.chapter = 'send'; this.focus( 'front' ); this.refresh(); } );
	}

	status() {

		const st = this.state, parts = [];
		if ( ! st.lit ) parts.push( st.heat > 0.3 ? 'Out, still hot' : 'Cold' );
		else if ( this.smoking ) parts.push( 'Burning and smoking' );
		else parts.push( st.heat < 0.35 ? 'Burning, the lamp still cold' : st.heat < 0.8 ? 'Burning, warming through' : 'Burning clear' );
		if ( st.lit ) parts.push( this.flame < 0.3 ? 'flame low' : this.flame < 0.7 ? 'flame moderate' : 'flame full' );
		parts.push( st.oil > 0.9 ? 'fount full' : st.oil > 0.5 ? 'fount over half full' : st.oil > 0.15 ? 'fount low' : 'fount nearly dry' );
		parts.push( st.char > 0.5 ? 'wick crusted' : st.char > 0.2 ? 'wick charred' : 'wick trimmed' );
		if ( st.soot > 0.25 ) parts.push( 'glass smoked' );
		parts.push( st.raised ? 'chimney up' : 'chimney down' );
		parts.push( st.door ? 'door open' : 'door shut' );
		return parts.join( ' · ' );

	}

	refresh() {

		const el = this.el;
		if ( ! el ) return;
		const lesson = this.lesson();
		const lessonKey = `${ this.chapter }|${ this.challenge }|${ lesson.n }|${ lesson.title }|${ lesson.action }`;
		if ( lessonKey !== this._lessonKey ) {
			this._lessonKey = lessonKey;
			el.querySelector( '.sh-lamp-step' ).textContent = lesson.n;
			el.querySelector( '.sh-lamp-lesson h3' ).textContent = lesson.title;
			el.querySelector( '.sh-lamp-hint' ).textContent = lesson.hint;
			const next = el.querySelector( '.sh-lamp-next' ); next.hidden = ! lesson.action; next.textContent = lesson.action || '';
			for ( const b of el.querySelectorAll( '[data-chapter]' ) ) b.setAttribute( 'aria-pressed', String( b.dataset.chapter === this.chapter ) );
			el.querySelector( '.sh-lamp-looks' ).hidden = this.chapter !== 'explore';
			el.querySelector( '.sh-lamp-challenge' ).hidden = this.chapter !== 'send';
			for ( const b of el.querySelectorAll( '[data-letter]' ) ) b.setAttribute( 'aria-pressed', String( b.dataset.letter === this.challenge ) );
		}
		const decoded = this.morse.text.trim().slice( -1 );
		const result = ! this.state.lit ? 'Light the lamp to show a signal.' : decoded === this.challenge ? `${ this.challenge } received — you made a letter with light. Try another.` : decoded ? `That read as ${ decoded }. Clear the flashes and try ${ this.challenge } again.` : `Your turn: send ${ this.challenge }.`;
		if ( result !== this._resultText ) el.querySelector( '.sh-lamp-result' ).textContent = this._resultText = result;
		const st = this.state;
		const looks = LOOKS.filter( ( l ) => ! l.when || l.when( st ) );
		const acts = this.actions();
		const listKey = looks.map( ( l ) => l.id ).join() + '|' + acts.map( ( a ) => a.label ).join();
		if ( listKey !== this._listKey ) {

			this._listKey = listKey;
			const L = el.querySelector( '.sh-lamp-looks' ), W = el.querySelector( '.sh-lamp-work' );
			L.querySelectorAll( 'button' ).forEach( ( b ) => b.remove() );
			W.querySelectorAll( 'button' ).forEach( ( b ) => b.remove() );
			for ( const l of looks ) {

				const b = document.createElement( 'button' );
				b.className = 'sh-chip';
				b.textContent = l.label;
				b.dataset.part = l.id;
				b.addEventListener( 'click', () => this.look( l.id ) );
				L.append( b );

			}

			acts.forEach( ( a, i ) => {

				const b = document.createElement( 'button' );
				b.className = 'sh-chip is-work';
				b.textContent = this.s.app.isMobile ? a.label : `${ i + 1 } · ${ a.label }`;
				b.addEventListener( 'click', () => this.actions().find( ( x ) => x.id === a.id )?.run() );
				W.append( b );

			} );

		}
		for ( const b of el.querySelectorAll( '[data-part]' ) ) b.setAttribute( 'aria-pressed', String( LOOKS.find( l => l.id === b.dataset.part )?.view === this.view ) );

		const stateText = this.status(), stateKey = `${ stateText }|${ Math.round( st.oil * 100 ) }|${ Math.round( st.wick * 100 ) }`;
		if ( stateKey !== this._stateText ) {
			this._stateText = stateKey;
			const badge = el.querySelector( '.sh-lamp-state' );
			badge.textContent = `${ st.lit ? this.smoking ? 'Smoking' : 'Flame lit' : st.heat > 0.3 ? 'Cooling' : 'Cold' } · Oil ${ Math.round( st.oil * 100 ) }% · Wick ${ Math.round( st.wick * 100 ) }%`;
			badge.title = stateText;
		}
		if ( this._dirty ) {

			el.querySelector( '.sh-lamp-note' ).textContent = this.note;
			this._dirty = false;

		}

		const m = this.morse, mt = m.marks.trim() ? `Your flashes: ${ m.marks.trim() }    Read as: ${ ( m.text + ( m.letter ? '…' : '' ) ).trim() || '…' }` : '';
		if ( mt !== this._morseText ) el.querySelector( '.sh-lamp-morse' ).textContent = this._morseText = mt;
		this.keyEl?.classList.toggle( 'is-down', this.pressed );

	}

	look( id ) {

		const l = LOOKS.find( ( x ) => x.id === id );
		if ( ! l ) return;
		const st = this.state;
		if ( ! st.seen.includes( id ) ) st.seen.push( id );
		this.focus( l.view );
		this.say( l.text );

	}

	// ---- every frame (after the story has moved the camera)

	update( dt ) {

		const s = this.s;
		if ( this._lastH !== null ) this.tick( Math.min( 48, Math.max( 0, s.h - this._lastH ) ) );
		this._lastH = s.h;
		const target = this.pressed ? 1 : 0;
		this.open += ( target - this.open ) * ( 1 - Math.exp( - dt / 0.035 ) );
		if ( this.active ) {

			this._spaces( dt );
			this.camera( dt );
			this.refresh();
			if ( s.app.player ) s.app.player.prompt = null;

		}

		this.sync( dt );

	}

	camera( dt ) {

		const cam = this.s.app.camera, v = VIEWS[ this.view ];
		let at = this.world( _b.fromArray( v.at ) );
		if ( this.view === 'sights' && this.s.her ) at = this.s._herRender ? this.s._herRender( _b ) : _b.copy( this.s.her );
		const eye = this.world( _a.fromArray( v.eye ) );
		const narrow = ( globalThis.window?.innerWidth || 1200 ) <= 700;
		if ( narrow && this.view === 'front' ) eye.addScaledVector( _right.copy( eye ).sub( at ), 0.25 );
		// Reserve the right margin on desktop and the lower half on a narrow screen.
		if ( this.view !== 'sights' ) {
			const distance = eye.distanceTo( at );
			if ( narrow ) at.y -= distance * 0.23;
			else at.addScaledVector( _right.copy( at ).sub( eye ).cross( _up ).normalize(), distance * 0.23 );
		}
		this._blend = Math.min( 1, this._blend + dt / 0.6 );
		const k = MathUtils.smoothstep( this._blend, 0, 1 );
		const look = _q.setFromRotationMatrix( _look.lookAt( eye, at, _up ) );
		cam.position.copy( this._from.position ).lerp( eye, k );
		cam.quaternion.copy( this._from.quaternion ).slerp( look, k );
		const fov = this.view === 'sights' ? 30 : 50;
		if ( Math.abs( cam.fov - fov ) > 1e-3 ) {

			cam.fov = fov;
			cam.updateProjectionMatrix();

		}

		cam.updateMatrixWorld?.();

	}

	// the moving parts follow the lamp's state
	sync( dt = 0 ) {

		const L = this.s.moving?.signalLamp, st = this.state;
		const out = this.output, open = this.open;
		// (the night exchange drives the same light while you reply to Cate)
		if ( this.s.signalLight ) this.s.signalLight.scale = Math.max( this.s.watcher?.yourLamp || 0, out * open );
		if ( ! L ) return;
		const P = L.parts, k = dt > 0 ? 1 - Math.exp( - dt / 0.12 ) : 1;
		const ease = ( obj, key, to ) => {

			if ( ! obj ) return;
			obj.userData[ key ] = obj.userData[ key ] === undefined ? to : obj.userData[ key ] + ( to - obj.userData[ key ] ) * k;
			return obj.userData[ key ];

		};

		const rest = ( g ) => g.userData.rest;
		if ( P.door ) P.door.rotation.y = ease( P.door, 'a', st.door ? 1.75 : 0 );
		if ( P.plunger ) P.plunger.position.y = rest( P.plunger ).y - 0.012 * open;
		for ( let i = 0; i < 6; i ++ ) if ( P[ 'vane' + i ] ) P[ 'vane' + i ].rotation.x = ( 1 - open ) * Math.PI / 2;
		if ( P.vaneLink ) P.vaneLink.position.y = rest( P.vaneLink ).y + 0.008 * ( 1 - open );
		if ( P.chimneyTop ) P.chimneyTop.position.y = rest( P.chimneyTop ).y + ease( P.chimneyTop, 'h', st.raised ? 0 : - 0.045 );
		if ( P.glassChimney ) P.glassChimney.position.y = rest( P.glassChimney ).y + ease( P.glassChimney, 'h', st.lifted ? 0.035 : 0 );
		if ( P.wick ) P.wick.position.y = rest( P.wick ).y + ( st.wick - 0.5 ) * 0.008;
		if ( P.wickKnob ) P.wickKnob.rotation.x = st.wick * Math.PI * 3;
		const flame = this.flame;
		this._flicker += dt * ( 9 + Math.random() * 4 );
		const unsettled = ( st.door ? 0.08 : 0 ) + ( st.lifted ? 0.18 : 0 ) + ( this.smoking ? 0.12 : 0 );
		const wobble = 1 + unsettled * Math.sin( this._flicker ) * Math.sin( this._flicker * 1.7 + 1 );
		if ( P.flame ) {

			P.flame.visible = st.lit && flame > 0.01;
			const h = Math.max( 0.15, flame ) * wobble;
			P.flame.scale.set( 1, h, 0.6 + 0.4 * Math.min( 1, flame ) );
			if ( L.flameMaterial ) L.flameMaterial.uniforms.glow.value = st.lit ? 0.6 + 0.4 * Math.min( 1, flame ) : 0;

		}

		if ( P.lensGlow ) {

			const g = out * open * wobble;
			P.lensGlow.visible = g > 0.01;
			if ( L.glowMaterial ) L.glowMaterial.uniforms.glow.value = g * 1.4;

		}

	}

}
