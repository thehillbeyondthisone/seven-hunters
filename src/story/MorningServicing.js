import { Vector3 } from '../engine/index.js';
import { TOWER, ROOM, updateDoor } from '../world/flannan/Station.js';
import { createMorningModels } from '../world/flannan/MorningServiceProps.js';
import { routeGuidance } from './Guidance.js';
import { SUNRISE, SUNSET } from './Script.js';

const EPS = 1e-6, CAN = .65;
const time = h => `${ String( Math.floor( h ) % 24 ).padStart( 2, '0' ) }.${ String( Math.floor( h % 1 * 60 ) ).padStart( 2, '0' ) }`;
export const MORNING_PAPER = {
	id: 'morning-service-study', label: 'Preparing the next light', title: 'The morning service', sub: 'Extinguish, inspect, clean, prepare and record.',
	body: [
		'At sunrise put out the light and stop the machine. Look over the apparatus while the optic comes to rest. Examine its condition before choosing work.',
		'The store holds a closed oil supply, a portable can and a service kit. Fill the can with the hand lantern out, secure its cap, and carry the can and kit to the shelf in the lantern.',
		'With the flame out and optic stationary, open the service section. Keep the glass cloth separate from the cloth for the burner housing. Attend to the wick edge, replenish the working supply and close the apparatus. Raise the weight with the machine stopped.',
		'Examine the prepared apparatus. Return the can and tools, put used oily cloths in the covered receptacle and close the store. Copy the night’s slate and the work actually done into the journal.',
	],
	provenance: 'Authored teaching reconstruction, not recovered station instructions. The initial night slate, oil levels and deposits are representative study conditions, not measurements of a played watch. NLB records establish filled fountains and canteens and cleaned apparatus. Trinity House’s 1839 instructions are comparative evidence for morning preparation and even wick trimming. The original Flannan burner, wick count, capacities, oil rate, service access, tools, storage fittings and compressed handling remain unverified. Internal oil amounts are conserved but are not litres or gallons. Muirhead’s 8 January report is research, not a document available to Walter on 3 January. This preview does not simulate burner temperature or oil combustion.',
	sources: [
		{ label: 'NLB · Flannan records (includes the later 8 January report)', url: 'https://www.nlb.org.uk/history/flannan-isles/' },
		{ label: 'Trinity House · 1839 keeper instructions (comparative)', url: 'https://trinityhouse.co.uk/about-us/history-of-trinity-house/from-the-archives/instructions-for-lighthouse-keepers-1839' },
	],
};

export class MorningServicing {
	constructor( story ) { this.s = story; this.layout = story.station.parts.morning; this.note = null; this.motion = null; }
	get enabled() { return !! this.s.app.qs?.has( 'morningPreview' ); }
	get state() {
		return this.s.flags.morningService ||= {
			v: 1, familiar: this.s.app.qs?.get( 'morningPreview' ) === 'familiar', inspected: false,
			oil: { bulk: 3, can: 0, fountain: .35 }, canPlace: 'home', kitPlace: 'home', canCapped: true,
			panelOpen: false, fountainCapped: true, glass: 1, housing: 1, wick: 1,
			usedCloths: false, disposed: false, checked: false, done: false, records: {},
		};
	}
	get inStore() { const p = this.s.app.player.position; return p.x > 7.15 && p.x < 11.4 && p.z < -.75 && p.z > -4.4 && Math.abs( p.y - this.layout.floor ) < .5; }
	get inLantern() { return this.s._inLantern(); }
	get safe() { const L = this.s.lamp; return ! L.lit && ! L.running && L.glow <= .002 && L.speed <= .02; }
	get serviced() { const q = this.state; return q.glass <= EPS && q.housing <= EPS && q.wick <= EPS && q.oil.fountain >= 1 - EPS; }
	get ready() { return this.serviced && ! this.state.panelOpen && this.state.fountainCapped && this.s.lamp.wind >= .999 && this.safe; }
	get stowed() { const q = this.state; return q.canPlace === 'home' && q.kitPlace === 'home' && q.canCapped && ( ! q.usedCloths || q.disposed ); }
	at( key ) {
		const p = this.layout.targets[ key ].clone();
		if ( [ 'panel', 'glass' ].includes( key ) ) p.applyAxisAngle( new Vector3( 0, 1, 0 ), -this.s.lamp.angle );
		return p;
	}
	// Engine rotation.y = -angle maps (cos(a), sin(a)) to a + angle.
	get atOpening() {
		const p = this.s.app.player.position, a = this.layout.angle + this.s.lamp.angle;
		return this.inLantern && Math.abs( Math.atan2( Math.sin( Math.atan2( p.z, p.x ) - a ), Math.cos( Math.atan2( p.z, p.x ) - a ) ) ) < Math.PI / 12;
	}
	say( text ) { this.note = { from: 'The morning service', text, lesson: true, remaining: Math.max( 9, text.split( /\s+/ ).length / 2 + 3 ) }; }
	record( key, text ) {
		if ( this.state.records[ key ] ) return;
		this.state.records[ key ] = true; this.s.row( this.s.h, text );
	}
	install() {
		if ( ! this.enabled ) return;
		if ( ! this.layout ) throw new Error( 'Morning preview requires its isolated station layout' );
		this.models = createMorningModels( this.s.app.village, this.layout );
		const I = this.s.interact;
		// Keep shared doors, papers and movement; night narrative actions never run.
		for ( const it of I.items ) if ( ! [ 'houseDoor', 'galleryDoor', 'journal', 'slate', 'clock', 'lens', 'crank' ].includes( it.id ) ) it.when = () => false;
		const journal = I.get( 'journal' ); journal.text = () => this.state.done ? 'Read the signed morning journal' : 'Copy the slate and sign the journal'; journal.use = () => this.journal();
		const slate = I.get( 'slate' ); slate.text = 'Read the night’s slate'; slate.use = () => this.s.ui.read( { title: 'The night’s slate · study handover', body: this.s.rows.filter( r => r[ 0 ] < SUNRISE + 24 ).map( r => `${ time( r[ 0 ] ) } · ${ r[ 1 ] }` ) } );
		const crank = I.get( 'crank' ); crank.hideProgress = true;
		crank.when = () => this.serviced && ! this.state.panelOpen && ! this.state.done;
		crank.text = () => this.s.lamp.wind >= .999 ? 'Driving weight fully raised' : 'Raise the driving weight · machine stopped';
		const add = ( id, key, text, action, when, hold = false ) => I.add( {
			id: 'morning' + id, at: () => this.at( key ), reach: key === 'wick' || key === 'burner' ? 2.5 : 1.8, size: .16,
			text: typeof text === 'function' ? text : () => text,
			when: () => ( ! this.state.done || action === 'door' ) && when(), hold: hold ? 1e9 : 0, hideProgress: true,
			use: hold ? undefined : () => this.act( action ),
			serviceAction: action,
			onHold: hold ? dt => this.work( action, dt ) : undefined,
			onRelease: () => { this.motion = null; this.s.save(); },
		} );
		add( 'StoreDoor', 'door', () => this.s.doors.oilStore[ 0 ].target > .5 ? 'Shut the oil store' : 'Open the oil store', 'door', () => true );
		add( 'Inspect', 'panel', 'Inspect the extinguished apparatus', 'inspect', () => this.inLantern && ! this.s.lamp.lit && ! this.state.inspected );
		add( 'Kit', 'kitHome', () => this.state.kitPlace === 'carried' ? 'Return the service kit' : 'Take the service kit', 'kit', () => this.inStore && this.state.inspected && this.state.kitPlace !== 'shelf' );
		add( 'Can', 'canHome', () => this.state.canPlace === 'carried' ? 'Return the capped oil can' : 'Take the oil can', 'can', () => this.inStore && this.state.inspected && this.state.canPlace !== 'shelf' );
		add( 'Fill', 'fill', () => this.s.hand.lit ? 'Put out the hand lantern before handling oil' : 'Fill the oil can · keep pressed', 'fill', () => this.inStore && [ 'carried', 'filling' ].includes( this.state.canPlace ) && this.state.oil.can < CAN - EPS && ! this.state.checked, true );
		add( 'Cap', 'fill', 'Secure the can’s cap', 'cap', () => this.inStore && ! this.state.canCapped && this.state.canPlace === 'filling' && this.state.oil.can >= CAN - EPS );
		add( 'Shelf', 'shelf', () => this.state.checked ? 'Take the can and kit downstairs' : 'Set the capped can and service kit on the shelf', 'shelf', () => this.inLantern && ( this.state.checked ? this.state.canPlace === 'shelf' || this.state.kitPlace === 'shelf' : this.state.canPlace === 'carried' || this.state.kitPlace === 'carried' ) );
		add( 'Panel', 'panel', () => this.state.panelOpen ? 'Close the apparatus service section' : 'Open the apparatus service section', 'panel', () => this.inLantern && this.state.inspected && this.state.kitPlace === 'shelf' && ( this.state.panelOpen ? this.serviced && this.state.fountainCapped : ! this.serviced ) && ! this.state.checked );
		add( 'Glass', 'glass', 'Wipe the glass with the clean glass cloth · keep pressed', 'glass', () => this.inLantern && this.state.panelOpen && this.state.glass > EPS && ! this.state.familiar, true );
		add( 'Housing', 'burner', 'Wipe the burner housing with its own cloth · keep pressed', 'housing', () => this.atOpening && this.state.panelOpen && this.state.glass <= EPS && this.state.housing > EPS && ! this.state.familiar, true );
		add( 'Wick', 'wick', 'Dress the wick edge evenly · keep pressed', 'wick', () => this.atOpening && this.state.panelOpen && this.state.housing <= EPS && this.state.wick > EPS && ! this.state.familiar, true );
		add( 'Familiar', 'panel', 'Clean the apparatus and dress the wick · keep pressed', 'familiar', () => this.atOpening && this.state.panelOpen && ( this.state.glass > EPS || this.state.housing > EPS || this.state.wick > EPS ) && this.state.familiar, true );
		add( 'Fountain', 'fountain', 'Open the working oil supply', 'fountain', () => this.inLantern && this.state.panelOpen && this.state.fountainCapped && this.state.oil.fountain < 1 - EPS );
		add( 'Pour', 'fountain', 'Replenish the working supply · keep pressed', 'pour', () => this.inLantern && ! this.state.fountainCapped && this.state.oil.fountain < 1 - EPS, true );
		add( 'Seal', 'fountain', 'Secure both oil caps', 'seal', () => this.inLantern && ! this.state.fountainCapped && this.state.oil.fountain >= 1 - EPS );
		add( 'Check', 'panel', 'Examine the apparatus prepared for evening', 'check', () => this.inLantern && this.ready && ! this.state.checked );
		add( 'Cloths', 'tin', 'Put used oily cloths in the covered receptacle', 'cloths', () => this.inStore && this.state.usedCloths && ! this.state.disposed );
		this.sync();
	}
	async start() {
		const s = this.s, p = s.app.player;
		s.flags.keeperRoutine = true; s.flags.introLessons = { done: true, seen: [], pending: [] };
		s.flags.keeperDuty = { inspected: true, verified: true, descentSeen: true, rewound: true };
		s.flags.landed = s.flags.islandRevealSeen = true;
		s.h = SUNRISE + 24; s.beat = 'morningService'; s.arrival.group.visible = false;
		s.rows = [ [ SUNSET, 'Lamp lit. Machine set going. (Study handover.)' ], [ 27, 'Slate: wind SW; sea moderate; poor visibility. (Representative study entry.)' ] ];
		s.lamp.wind = .42; s.lamp.ignite(); s.lamp.start(); s.lamp.glow = s.lamp.speed = 1; s.lamp.angle = 0;
		s.hand.carried = true; s.hand.lit = false; s.hand.glow = 0;
		const a = this.layout.angle;
		p.position.set( Math.cos( a ) * 1.85, TOWER.deck, Math.sin( a ) * 1.85 );
		p.mode = 'walk'; p.grounded = true; p.velocity.set( 0, 0, 0 ); p.yaw = Math.atan2( p.position.x, p.position.z ); p.pitch = .15; p._camY = null; p.update( 0 );
		s._applyClock(); s.app.cameraCut?.(); this.sync();
		await s.ui.card( [ 'The eastern glass is pale. Put out the light, inspect the apparatus and prepare it for evening.', 'The oil store holds your can and service kit. The night slate and apparatus conditions are authored study examples.', 'Burner details, tools and service access are reconstructions. This study has its own save.' ], { kicker: 'Keeper’s duties · morning study', title: this.state.familiar ? 'A familiar dawn' : 'Preparing the next light' } );
		s.paused = false; s.save();
	}
	fail( text ) { this.say( text ); return false; }
	act( action ) {
		const s = this.s, q = this.state;
		if ( this.blocked || q.done && action !== 'door' ) return false;
		if ( action === 'extinguish' ) {
			if ( ! s.lamp.lit ) return false;
			s.lamp.extinguish(); s.lamp.stop(); s.sound?.extinguish();
			this.record( 'out', 'Lamp extinguished at sunrise. Machine stopped.' );
			this.say( 'The flame dies away and the optic coasts to rest. Inspect the apparatus, then fetch the can and service kit from the oil store.' );
		} else if ( action === 'inspect' ) {
			if ( s.lamp.lit || ! q.records.out || q.inspected ) return false;
			q.inspected = true; this.record( 'inspect', 'Morning inspection: oil supply part-used; light deposits on glass and burner housing; wick edge requires attention. Fittings sound.' );
			this.say( 'A little deposit on the glass and burner housing, a dark wick edge, and a part-used oil supply. The fittings are sound. These are representative overnight study conditions. Fetch the kit and a capped can of oil.' );
		} else if ( action === 'door' ) {
			const d = s.doors.oilStore[ 0 ];
			if ( d.target > .5 && q.checked && ! this.stowed ) return this.fail( 'Put away the can, tools and used cloths before securing the store.' );
			d.target = d.target > .5 ? 0 : 1;
		} else if ( action === 'kit' || action === 'can' ) {
			if ( ! this.inStore || ! q.inspected ) return false;
			const key = action + 'Place';
			if ( q[ key ] === 'shelf' ) return false;
			if ( action === 'can' && ! q.canCapped ) return this.fail( 'Secure the oil can’s cap before carrying or storing it.' );
			q[ key ] = q[ key ] === 'home' ? 'carried' : 'home';
		} else if ( action === 'cap' ) {
			if ( ! this.inStore || q.canCapped ) return false;
			q.canCapped = true; q.canPlace = 'carried';
		} else if ( action === 'shelf' ) {
			if ( ! this.inLantern || ! q.canCapped ) return this.fail( 'Secure the can’s cap before carrying it upstairs.' );
			if ( q.checked ) { for ( const key of [ 'canPlace', 'kitPlace' ] ) if ( q[ key ] === 'shelf' ) q[ key ] = 'carried'; }
			else {
				if ( q.canPlace !== 'carried' || q.kitPlace !== 'carried' || q.oil.can <= EPS ) return this.fail( 'Bring the service kit and a filled, capped can together.' );
				q.canPlace = q.kitPlace = 'shelf';
			}
		} else if ( action === 'panel' ) {
			if ( ! this.safe || ! q.inspected || q.kitPlace !== 'shelf' ) return this.fail( 'The flame must be out and the optic stationary. Set the kit on the shelf first.' );
			if ( q.panelOpen && ( ! this.serviced || ! q.fountainCapped || ! q.canCapped ) ) return this.fail( 'Finish the cleaning, wick and oil work and secure both oil caps first.' );
			q.panelOpen = ! q.panelOpen;
			this.say( q.panelOpen ? 'The service section is open. Use the glass cloth on the glass, then the separate cloth on the housing. This opening is a teaching reconstruction.' : 'The apparatus is closed. Raise the driving weight with the machine stopped, then examine the prepared light.' );
		} else if ( action === 'fountain' ) {
			if ( ! this.safe || ! q.panelOpen || q.canPlace !== 'shelf' || s.hand.lit ) return this.fail( 'Put out the hand lantern and stop the apparatus before handling its oil supply.' );
			q.fountainCapped = false;
		} else if ( action === 'seal' ) {
			if ( q.oil.fountain < 1 - EPS || q.fountainCapped ) return false;
			q.fountainCapped = q.canCapped = true;
			this.record( 'oil', 'Working oil supply replenished; can and fountain secured. No measured consumption claimed.' );
		} else if ( action === 'check' ) {
			if ( ! this.ready || q.checked ) return false;
			q.checked = true; this.record( 'ready', 'Glass and burner housing clean; wick edge prepared; oil supply ready; machine stopped with driving weight raised.' );
			this.say( 'The apparatus is ready for evening. Take the can and kit from the shelf, return them to the store and separate the used cloths. Then write up the slate.' );
		} else if ( action === 'cloths' ) {
			if ( ! this.inStore || ! q.usedCloths || q.disposed || q.kitPlace === 'shelf' ) return false;
			q.disposed = true; this.record( 'cloths', 'Used oily cloths separated into the covered receptacle.' );
		} else return false;
		this.sync(); s.save(); return true;
	}
	work( action, dt ) {
		const s = this.s, q = this.state;
		if ( this.blocked || q.done || dt <= 0 ) return;
		dt = Math.min( dt, .1 );
		if ( action === 'fill' || action === 'pour' ) {
			const filling = action === 'fill';
			if ( s.hand.lit || ( filling ? ! this.inStore || ! [ 'carried', 'filling' ].includes( q.canPlace ) || ! q.inspected || q.checked : ! this.inLantern || ! this.safe || ! q.panelOpen || q.fountainCapped || q.canPlace !== 'shelf' ) ) { this.fail( 'Handle oil with the hand lantern out, at the proper filling surface and with the apparatus stopped.' ); return; }
			const from = filling ? 'bulk' : 'can', to = filling ? 'can' : 'fountain', limit = filling ? CAN : 1;
			const amount = Math.min( dt * .22, q.oil[ from ], Math.max( 0, limit - q.oil[ to ] ) );
			if ( amount <= EPS ) { this.motion = null; return; }
			q.canCapped = false; if ( filling ) q.canPlace = 'filling'; q.oil[ from ] -= amount; q.oil[ to ] += amount;
			this.motion = { action, t: ( this.motion?.t || 0 ) + dt };
			if ( filling ) this.record( 'issue', 'Oil issued from the store into the service can. Quantity uncalibrated in this study.' );
			if ( q.oil[ to ] >= limit - EPS ) { this.motion = null; this.say( filling ? 'The can is filled. Secure its cap before carrying it upstairs.' : 'The working supply is ready. Secure both caps.' ); }
		} else {
			if ( ! this.inLantern || ! this.safe || ! q.panelOpen || q.kitPlace !== 'shelf' || ( action !== 'glass' && ! this.atOpening ) ) return;
			const keys = action === 'familiar' ? [ 'glass', 'housing', 'wick' ] : [ action ];
			if ( keys.some( k => ! [ 'glass', 'housing', 'wick' ].includes( k ) ) ) return;
			if ( action === 'housing' && q.glass > EPS || action === 'wick' && q.housing > EPS ) return;
			if ( keys.every( k => q[ k ] <= EPS ) ) { this.motion = null; return; }
			this.motion = { action, t: ( this.motion?.t || 0 ) + dt }; q.usedCloths = true;
			for ( const k of keys ) {
				q[ k ] = Math.max( 0, q[ k ] - dt / ( action === 'familiar' ? 6 : 3 ) );
				if ( q[ k ] <= EPS ) { q[ k ] = 0; this.record( k, { glass: 'Optic glass wiped with its clean cloth.', housing: 'Burner housing wiped with its separate cloth.', wick: 'Wick edge dressed evenly. Burner details reconstructed.' }[ k ] ); }
			}
			if ( keys.every( k => q[ k ] <= EPS ) ) { this.motion = null; this.say( action === 'glass' ? 'The glass is clear. Move round to the open service section for the burner housing.' : action === 'housing' ? 'The housing is clean. Attend to the wick edge through the opening.' : 'The wick edge is prepared. Replenish the oil supply before closing the apparatus.' ); }
		}
		this.sync(); s.save();
	}
	wind( dt ) {
		if ( this.blocked || ! this.safe || ! this.serviced || this.state.panelOpen || this.state.done ) return;
		const L = this.s.lamp, before = L.wind;
		L.addWind( Math.max( 0, Math.min( dt, .1 ) ) / 10, { start: false } );
		if ( before < .999 && this.s.moving.crank ) this.s.moving.crank.rotation.z -= dt * Math.PI * 1.8;
		this.s.sound?.ratchet( L.wind < .999 );
		if ( before < .999 && L.wind >= .999 ) { this.record( 'wind', 'Driving weight raised for evening; machine remains stopped.' ); this.say( 'The weight is raised and the stop holds it. Examine the prepared apparatus.' ); this.s.save(); }
	}
	next() {
		const q = this.state;
		if ( q.done ) return null;
		if ( this.s.lamp.lit ) return [ 'lens', 'Extinguish the lamp and stop the machine', 'lantern' ];
		if ( ! q.inspected ) return [ 'morningInspect', 'Inspect the apparatus', 'lantern' ];
		if ( q.checked ) {
			if ( q.canPlace === 'shelf' || q.kitPlace === 'shelf' ) return [ 'morningShelf', 'Take the can and kit downstairs', 'lantern' ];
			if ( q.usedCloths && ! q.disposed ) return [ 'morningCloths', 'Separate the used cloths', 'store' ];
			if ( q.kitPlace !== 'home' ) return [ 'morningKit', 'Return the service kit', 'store' ];
			if ( q.canPlace !== 'home' ) return [ 'morningCan', 'Return the capped can', 'store' ];
			if ( this.s.doors.oilStore[ 0 ].target > .5 || this.s.doors.oilStore[ 0 ].open > .01 ) return [ 'morningStoreDoor', 'Secure the oil store', 'storeExit' ];
			return [ 'journal', 'Copy the slate and sign the journal', 'room' ];
		}
		if ( q.kitPlace === 'home' ) return [ 'morningKit', 'Take the service kit from the oil store', 'store' ];
		if ( q.canPlace === 'home' ) return [ 'morningCan', 'Take the oil can', 'store' ];
		if ( [ 'carried', 'filling' ].includes( q.canPlace ) && q.oil.can < CAN - EPS ) return [ 'morningFill', 'Fill the service can', 'store' ];
		if ( ! q.canCapped && q.canPlace === 'filling' ) return [ 'morningCap', 'Secure the can’s cap', 'store' ];
		if ( q.canPlace === 'carried' || q.kitPlace === 'carried' ) return [ 'morningShelf', 'Set the can and kit on the lantern shelf', 'lantern' ];
		if ( this.serviced && ! q.fountainCapped ) return [ 'morningSeal', 'Secure both oil caps', 'lantern' ];
		if ( this.serviced && q.panelOpen ) return [ 'morningPanel', 'Close the service section', 'lantern' ];
		if ( this.serviced && this.s.lamp.wind < .999 ) return [ 'crank', 'Raise the weight · keep pressed', 'lantern' ];
		if ( this.ready ) return [ 'morningCheck', 'Examine the prepared apparatus', 'lantern' ];
		if ( ! q.panelOpen ) return [ 'morningPanel', this.safe ? 'Open the service section' : 'Let the optic come to rest', 'lantern' ];
		if ( q.familiar && ( q.glass > EPS || q.housing > EPS || q.wick > EPS ) ) return [ 'morningFamiliar', 'Clean and prepare the apparatus through the opening', 'lantern' ];
		if ( q.glass > EPS ) return [ 'morningGlass', 'Wipe the glass with its clean cloth', 'lantern' ];
		if ( q.housing > EPS ) return [ 'morningHousing', 'Work through the open service section · wipe the housing', 'opening' ];
		if ( q.wick > EPS ) return [ 'morningWick', 'Work through the opening · dress the wick edge', 'opening' ];
		return [ q.fountainCapped ? 'morningFountain' : 'morningPour', 'Replenish the working oil supply', 'lantern' ];
	}
	goal() { return this.next()?.[ 1 ] || 'The apparatus is ready for evening. The morning journal is signed.'; }
	guidance() {
		if ( this.blocked || this.s.app.settings.guidance === false ) return null;
		const next = this.next(); if ( ! next ) return null;
		const [ id, label, zone ] = next, p = this.s.app.player.position;
		const it = this.s.interact.get( id );
		let at = typeof it.at === 'function' ? it.at() : it.at;
		if ( zone === 'opening' ) at = this.at( 'panel' );
		if ( zone.startsWith( 'store' ) ) {
			if ( ! this.inStore ) {
				const door = this.at( 'door' );
				if ( p.distanceTo( door ) > 1.7 || this.s.doors.oilStore[ 0 ].target < .5 && zone !== 'storeExit' ) return routeGuidance( p, { at: door, label: 'Oil store door', id: 'morningStoreDoor' }, 'yard' );
			} else if ( zone === 'storeExit' ) return { at: this.at( 'door' ), label: 'Leave the store and secure its door', id };
			return routeGuidance( p, { at, label, id }, 'yard' );
		}
		// Route from inside the store through its actual doorway first.
		if ( this.inStore ) return { at: this.at( 'door' ), label: 'Out through the oil store door', id: 'morningStoreDoor' };
		return routeGuidance( p, { at, label, id }, zone === 'opening' ? 'lantern' : zone );
	}
	async journal() {
		if ( this.state.done ) return this.s.ui.read( { title: 'The signed morning journal', body: this.s.rows.map( r => `${ time( r[ 0 ] ) } · ${ r[ 1 ] }` ) } );
		if ( ! this.ready || ! this.state.checked || ! this.stowed || this.s.doors.oilStore[ 0 ].open > .01 || this.s.doors.oilStore[ 0 ].target > .5 ) return this.fail( 'Finish the service, examine the prepared apparatus, put away the supplies and secure the store before signing.' );
		const chosen = await this.s.ui.journal( { heading: 'Friday 4th January 1901 · morning study', rows: this.s.rows.map( r => [ time( r[ 0 ] ), r[ 1 ] ] ), footer: 'W. Innes, Assistant Keeper · authored study' } );
		if ( chosen == null || this.state.done ) return;
		this.record( 'signed', 'Night slate copied fair; morning service entered and signed. Apparatus ready for evening.' );
		this.state.done = true; this.say( 'The next light is ready. The can and tools are in their places. Your morning entry is signed.' ); this.s.save();
	}
	sync() {
		if ( ! this.enabled ) return;
		const q = this.state, m = this.models, L = this.s.lamp;
		L.update( 0, 0 ); // Apply restored/staged state to the flame, beams and optic.
		this.s.interact.get( 'lens' ).hold = 0;
		this.s.interact.get( 'crank' ).hideProgress = true;
		this.s.keeper.drive.sync( L.wind );
		if ( this.s.moving.servicePanel ) {
			const a = this.layout.angle, k = q.panelOpen ? 1 : 0;
			this.s.moving.servicePanel.position.set( -Math.sin( a ) * .85 * k + Math.cos( a ) * .3 * k, 0, Math.cos( a ) * .85 * k + Math.sin( a ) * .3 * k );
		}
		if ( ! m ) return;
		const camera = this.s.app.camera, shelf = this.at( 'shelf' );
		const place = ( g, where, home, offset ) => {
			g.rotation.set( 0, 0, 0 );
			if ( where === 'carried' ) { g.position.copy( offset ).applyQuaternion( camera.quaternion ).add( camera.position ); g.quaternion.copy( camera.quaternion ); }
			else g.position.copy( where === 'home' ? home : shelf );
		};
		place( m.can, q.canPlace, this.at( 'canHome' ).add( new Vector3( 0, -.08, 0 ) ), new Vector3( .28, -.42, -.62 ) );
		place( m.kit, q.kitPlace, this.at( 'kitHome' ).add( new Vector3( 0, -.13, 0 ) ), new Vector3( -.30, -.40, -.65 ) );
		if ( q.canPlace === 'shelf' ) m.can.position.z += .18;
		if ( q.kitPlace === 'shelf' ) m.kit.position.z -= .18;
		const action = this.motion?.action, t = this.motion?.t || 0;
		if ( action === 'fill' || q.canPlace === 'filling' ) { m.can.position.copy( this.at( 'fill' ) ).add( new Vector3( -.1, -.54, .2 ) ); m.can.rotation.set( 0, 0, 0 ); }
		if ( action === 'pour' ) { m.can.position.copy( this.at( 'fountain' ) ).add( new Vector3( -.12, .35, 0 ) ); m.can.rotation.set( 0, 0, -1 ); }
		m.cap.position.copy( m.can.position ); m.cap.quaternion.copy( m.can.quaternion ); m.cap.visible = q.canCapped;
		m.canOil.position.copy( m.can.position ).add( new Vector3( 0, .04 + q.oil.can / CAN * .21, 0 ) ); m.canOil.visible = ! q.canCapped && q.oil.can > EPS;
		m.fountainCap.position.copy( m.fountain.position ).add( new Vector3( 0, .275, 0 ) ); m.fountainCap.visible = q.fountainCapped;
		m.fountainOil.position.copy( m.fountain.position ).add( new Vector3( 0, .06 + q.oil.fountain * .17, 0 ) ); m.fountainOil.visible = ! q.fountainCapped;
		m.glassFilm.rotation.y = -L.angle; m.glassFilm.visible = q.glass > EPS;
		m.burnerFilm.visible = q.housing > EPS; m.carbon.visible = q.wick > EPS;
		m.usedCloths.position.copy( m.kit.position ); m.usedCloths.visible = q.usedCloths && ! q.disposed;
		m.tool.visible = action === 'glass' || action === 'familiar' && t < 2;
		m.housingTool.visible = action === 'housing' || action === 'familiar' && t >= 2 && t < 4;
		m.trimmer.visible = action === 'wick' || action === 'familiar' && t > 4;
		const working = action === 'glass' || action === 'familiar' && t < 2 ? this.at( 'glass' ) : this.at( 'burner' );
		m.tool.position.copy( working ); m.tool.position.y += Math.sin( t * 7 ) * .055;
		m.housingTool.position.copy( working ); m.housingTool.position.y += Math.sin( t * 7 ) * .045;
		m.trimmer.position.copy( this.at( 'wick' ) ); m.trimmer.rotation.z = Math.sin( t * 8 ) * .15;
		m.stream.visible = action === 'fill' || action === 'pour';
		if ( m.stream.visible ) {
			const from = action === 'fill' ? this.at( 'fill' ).add( new Vector3( -.13, -.03, .11 ) ) : new Vector3( .29, .39, 0 ).applyQuaternion( m.can.quaternion ).add( m.can.position );
			const to = action === 'fill' ? m.can.position.clone().add( new Vector3( 0, .38, 0 ) ) : this.at( 'fountain' ).add( new Vector3( 0, -.02, 0 ) );
			const direction = to.clone().sub( from ); m.stream.position.copy( from ); m.stream.scale.y = direction.length(); m.stream.quaternion.setFromUnitVectors( new Vector3( 0, 1, 0 ), direction.normalize() );
		}
	}
	get blocked() { const s = this.s, a = s.app; return s.paused || s.ui.open || a.mobile?.paused || a.devMenu?.open || a.freeCam || a.ui?.ui?.photoMode || globalThis.document?.hidden || a.input.enabled === false; }
	update( dt ) {
		const s = this.s, blocked = this.blocked;
		if ( ! blocked ) { s.h = Math.min( 35, s.h + ( this.state.done ? 0 : dt / 600 ) ); s.lamp.update( dt, 0 ); }
		s._applyClock();
		for ( const d of s.moving.doors ) updateDoor( d, blocked ? 0 : dt );
		this.sync();
		if ( ! blocked ) s.interact.update( dt );
		if ( blocked || ! s.app.input.down( 'KeyE' ) || s.interact.current?.serviceAction !== this.motion?.action ) this.motion = null;
		if ( blocked || ! s.app.input.down( 'KeyE' ) || s.interact.current?.id !== 'crank' ) s.sound?.ratchet( false );
		this.sync();
		const store = s.doors.oilStore[ 0 ];
		if ( ! blocked && ! this.state.done && this.state.checked && this.stowed && store.target === 0 && store.open === 0 ) this.record( 'secured', 'Oil can and tools returned; used materials separated; store secured.' );
		s.ui.setClock( `${ time( s.h ) } · Friday 4th January` ); s.ui.setObjective( this.goal() ); s.ui.guidance( this.guidance(), s.app.camera, !! s.app.player.prompt );
		if ( this.note && ! blocked ) { this.note.remaining -= Math.min( dt, 1 ); if ( this.note.remaining <= 0 ) this.note = null; }
		s.ui.arrival( blocked ? null : this.note );
		s.saveT += dt; if ( s.saveT > 5 && ! blocked ) s.save();
	}
	beforeSave() { if ( this.enabled ) this.state.speed = this.s.lamp.speed; }
	restore() { if ( this.enabled ) { if ( Number.isFinite( this.state.speed ) ) this.s.lamp.speed = this.state.speed; this.motion = null; this.note = null; this.sync(); } }
}
