import { Vector3, MathUtils } from '../engine/math/index.js';
import { Watcher } from './Watcher.js';
import { STATION, TOWER, ROOM, updateDoor } from '../world/flannan/Station.js';
import { KITCHEN, BERTH, HAULING_SHED } from '../world/flannan/NextRooms.js';
import { routeGuidance, storyGuidance } from './Guidance.js';
import { hazeDensityForVisibility } from '../post/AirHaze.js';
import { Beams } from '../station/Beams.js';
import { NOTES, EPISODES } from './NextScript.js';

const nextBeat = b => /^d[234]/.test( b );
const marker = ( at, label, id ) => ( { at: at.clone(), label, id } );
const within = ( p, R ) => p.x > R.x0 && p.x < R.x1 && p.z > R.z0 && p.z < R.z1;
const CAPS = { d2kitchen: 35.5, d2crate: 35.5, d2survey: 36.5, d2rest: 39.1, d2light: 39.4, d2wind: 40.4, d2signal: 44, d2sleep: 48.4, d2wake: 52, d2dawn: 56.9, d3journal: 57.1, d3breakfast: 60, d3light: 63.4, d3wind: 64.4, d3signal: 66, d3bank: 66, d3remote: 67, d3return: 67.5, d3sleep: 68, d4journalMorning: 81.1, d4rest: 87.1, d4light: 87.4, d4wind: 88.4, d4signal: 91, d4journal: 92 };

export class NextWatch {
	constructor( story ) { this.s = story; this.busy = false; this.endShown = false; }
	get active() { return nextBeat( this.s.beat ); }
	get state() { return this.s.flags.nextWatch || ( this.s.flags.nextWatch = {} ); }

	install() {
		const s = this.s, I = s.interact;
		const door = ( id, at, name, label ) => {
			I.add( { id, at, reach: 2.2, size: 0.5, text: () => this.active ? `${ s.doors[ name ][ 0 ].target > 0.5 ? 'Shut' : 'Open' } the ${ label }` : 'The kitchen',
				use: () => this.active ? s._toggle( name ) : s.ui.read( NOTES.bed ) } );
		};
		// Replace the old kitchen note target rather than stacking two prompts.
		const kitchen = I.get( 'kitchenDoor' );
		kitchen.at = KITCHEN.door;
		kitchen.text = () => this.active ? `${ s.doors.kitchen[ 0 ].target > 0.5 ? 'Shut' : 'Open' } the kitchen door` : 'The kitchen';
		const oldUse = kitchen.use;
		kitchen.use = () => this.active ? s._toggle( 'kitchen' ) : oldUse();
		door( 'berthDoor', BERTH.door, 'berth', 'berth door' );
		I.add( { id: 'kitchenStove', at: KITCHEN.stove, reach: 2, size: 0.35, hold: 1.2, when: () => this.active,
			text: () => s.beat === 'd3bank' ? 'Bank the stove before you go' : s.beat === 'd3return' ? 'Look at the stove' : this.state.fireLit ? 'The kitchen stove' : 'Get the stove going', use: () => this.stove() } );
		I.add( { id: 'storesCrate', at: KITCHEN.crate, size: 0.3, when: () => this.active, text: () => this.state.crate ? 'Read the signal book' : 'Unpack your stores', use: async () => {
			await s.ui.read( this.state.crate ? this.signalBook() : NOTES.crate );
			if ( s.beat === 'd2crate' ) { this.state.crate = true; s.setBeat( 'd2survey' ); }
		} } );
		I.add( { id: 'berth', at: BERTH.bed, size: 0.5, when: () => this.active, text: () => this.sleepText(), use: () => this.sleep() } );
		I.add( { id: 'haulingBrake', at: HAULING_SHED.brake, reach: 2, size: 0.4, hold: 3,
			when: () => this.active && [ 'd2survey', 'd3remote' ].includes( s.beat ),
			text: () => s.beat === 'd3remote' ? 'Secure the brake with the retaining chain' : 'Inspect the hauling brake', use: () => this.brake() } );
		const journal = I.get( 'journal' ), oldJournal = journal.use;
		journal.text = () => this.active && /journal/i.test( s.beat ) ? 'Write up the journal' : s.beat === 'journal' ? 'Write up the journal' : 'Look at the journal';
		journal.use = () => this.active ? this.journal() : oldJournal();
	}

	async begin() {
		const s = this.s;
		this.state.started = true;
		this.state.signals = [ { day: 1, log: s.watcher.log.slice() } ];
		s.setBeat( 'd2kitchen' );
		await s.ui.card( [ 'The first watch is written up.', 'Daylight reaches the kitchen door. You have not unpacked your crate.' ], { kicker: 'Day two', title: 'Friday 4th January 1901' } );
	}
	signalBook() {
		const groups = [ ...( this.state.signals || [] ), ...( this.state.episode ? [ { day: this.state.episode, log: this.s.watcher.log } ] : [] ) ];
		return { title: 'The signal book', body: [ NOTES.crate.body[ 2 ], ...groups.flatMap( g => [ `Watch of ${ g.day +2 } January`, ...g.log.map( l => {
			const n = Object.values( EPISODES[ g.day ]?.nodes || {} ).find( q => q.her === l.text );
			return `${ l.from === 'her' ? 'Gallan Head' : 'You' }: ${ l.text }${ n?.translation ? ` — ${ n.translation }` : '' }`;
		} ) ] ) ] };
	}

	goal() {
		const s = this.s, b = s.beat;
		if ( s.lamp.lit && s.lamp.wind < 0.15 && ! [ 'd3remote', 'd3return' ].includes( b ) ) return 'The machine is running down. Wind it.';
		return {
			d2kitchen: 'Open the kitchen door beneath the clock. Get the stove going.', d2crate: 'Unpack your crate beside the kitchen table.',
			d2survey: 'Follow the west tramway to the upper hauling shed. Inspect the brake; stay above the landing stairs.',
			d2rest: 'Return to the station. Your berth is through the kitchen. Rest until sunset.',
			d2light: 'Light the lamp for the second watch.', d2wind: 'Wind the machine fully.', d2signal: 'Cate is watching. Answer at the signal lamp on the balcony.',
			d2sleep: 'Keep the watch until the small hours, then wind fully and rest in your berth.', d2wake: 'Your two hours are up. Wind the machine again.',
			d2dawn: 'Keep the watch until sunrise, then put out the lamp.', d3journal: 'Write up the second watch at the desk.',
			d3breakfast: 'There is daylight in the kitchen. Make tea before the next watch.', d3light: 'Rest if you wish, then light the lamp at sunset.',
			d3wind: 'Wind the machine fully before the evening round.', d3signal: 'Gallan Head is calling. Answer Cate at the signal lamp.',
			d3bank: s.hand.carried ? 'Bank the kitchen stove before going to the upper hauling shed.' : this.state.lanternInBerth ? 'Take your storm lantern from the berth washstand, then bank the kitchen stove.' : 'Take the storm lantern from the keepers’ table, then bank the kitchen stove.',
			d3remote: 'Follow the west tramway. Secure the retaining chain in the upper hauling shed.',
			d3return: 'Return to the station.', d3sleep: 'Wind the machine, then keep the remaining watch from your berth.',
			d4journalMorning: 'Put out the lamp and write up the watch at the desk.', d4rest: 'Rest in your berth until the next clear evening.',
			d4light: 'Light the lamp at sunset.', d4wind: 'Wind the machine.', d4signal: 'Gallan Head is in sight. Ask Cate at the signal lamp.',
			d4journal: 'Write the evening’s remarks in the journal.', d4complete: '',
		}[ b ] || '';
	}

	lensText() {
		const s = this.s;
		if ( /light$/.test( s.beat ) ) return s.h % 24 < 15.1 ? 'Wait for sunset' : 'Light the lamp';
		if ( s.lamp.lit && [ 'd2dawn', 'd4journalMorning' ].includes( s.beat ) ) return s.h % 24 < 8.65 ? 'Keep the watch until sunrise' : 'Put out the lamp';
		return '';
	}
	async useLens() {
		const s = this.s;
		if ( /light$/.test( s.beat ) ) {
			const d = Number( s.beat[ 1 ] );
			if ( s.h % 24 < 15.1 ) { await s._skipTo( ( d - 1 ) * 24 + 15.12, 'You wait for the last daylight to leave the glass.' ); return; }
			s.lamp.ignite(); s.sound?.ignite(); s.row( s.h, 'Lamp lit.' );
			this.episode( d ); s.setBeat( `d${ d }wind` );
			if ( s.lamp.wind >= 0.95 ) this.onWind();
		} else if ( s.lamp.lit && s.h % 24 >= 8.65 ) {
			s.lamp.extinguish(); s.lamp.stop(); s.sound?.extinguish(); s.row( s.h, 'Lamp extinguished. Machine stopped.' );
			s.setBeat( s.beat === 'd2dawn' ? 'd3journal' : 'd4journalMorning' ); this.state.morningLampOut = true;
		} else await s._skipTo( 56.9, 'Daylight reaches the eastern glass.' );
	}
	onWind() {
		const s = this.s;
		if ( s.lamp.wind < 0.95 ) return;
		if ( /wind$/.test( s.beat ) ) { s.row( s.h, 'Machine fully wound.' ); s.setBeat( s.beat.replace( 'wind', 'signal' ) ); }
		else if ( s.beat === 'd2wake' ) s.setBeat( 'd2dawn' );
	}

	episode( n ) {
		const s = this.s;
		if ( this.state.episode === n ) return;
		if ( this.state.episode ) ( this.state.signals || ( this.state.signals = [] ) ).push( { day: this.state.episode, log: s.watcher.log.slice() } );
		this.state.episode = n;
		// Never offer Walter a claim about smoke he has not actually noticed.
		const script = n === 4 && ! this.state.smokeSeen ? {
			...EPISODES[ n ], nodes: { ...EPISODES[ n ].nodes, house: { ...EPISODES[ n ].nodes.house,
				options: EPISODES[ n ].nodes.house.options.filter( o => o.flag !== 'toldSmoke' ) } },
		} : EPISODES[ n ];
		s.watcher = new Watcher( script );
		s.watcher.familiar = !! this.state.crate;
		s.watcher.onSent = ( text, minutes ) => { s.h += minutes / 60; };
		s.watcher.appear();
	}
	restore( savedWatcher ) {
		if ( ! this.active ) return;
		const n = this.state.episode;
		if ( this.state.lanternInBerth ) this.s.hand.setRest( BERTH.lantern, 0.4 );
		if ( n && EPISODES[ n ] ) {
			this.state.episode = 0; this.episode( n ); this.s.watcher.load( savedWatcher );
		} else this.s.watcher.load( savedWatcher );
	}

	async stove() {
		const s = this.s;
		if ( this.busy ) return;
		this.busy = true;
		try {
			if ( s.beat === 'd3bank' ) {
				if ( ! s.hand.carried ) { s.toast( this.state.lanternInBerth ? 'Your storm lantern is on the washstand in your berth.' : 'The storm lantern is on the keepers’ table. Take it before going out.' ); return; }
				await s.ui.read( NOTES.bank ); this.state.banked = s.h; s.row( s.h, 'Kitchen stove banked before the evening round.' );
				// Rewind immediately before the round if the signal exchange consumed time.
				s.lamp.wind = 1; s.lamp.warned = false; s.row( s.h, 'Machine wound before the evening round.' ); s.setBeat( 'd3remote' );
			} else if ( s.beat === 'd3return' ) {
				await s.ui.read( NOTES.embers ); this.state.inspected = s.h; s.setBeat( 'd3sleep' );
			} else if ( [ 'd2kitchen', 'd3breakfast' ].includes( s.beat ) ) {
				await s.ui.read( NOTES.breakfast ); this.state.fireLit = true; s.row( s.h, 'Made tea in the kitchen.' );
				s.setBeat( s.beat === 'd2kitchen' ? 'd2crate' : 'd3light' );
			} else await s.ui.read( this.state.banked ? NOTES.embers : NOTES.breakfast );
		} finally { this.busy = false; s.save(); }
	}
	async brake() {
		const s = this.s;
		if ( s.beat === 'd2survey' ) {
			await s.ui.read( NOTES.survey ); this.state.survey = true; s.row( s.h, 'Upper hauling gear inspected. Brake holds; retaining chain loose.' ); s.setBeat( 'd2rest' );
		} else if ( s.beat === 'd3remote' ) {
			// The job finishes in the player's view. No fade, forced turn, discovery toast or sound cue.
			this.state.chainSecured = s.h; s.row( s.h, 'Retaining chain secured on the upper hauling brake.' ); s.setBeat( 'd3return' );
		}
	}

	sleepText() {
		const b = this.s.beat;
		if ( b === 'd2rest' || b === 'd3light' || b === 'd4rest' ) return 'Rest until the evening watch';
		if ( b === 'd2sleep' ) return 'Take two hours’ rest after winding';
		if ( b === 'd3sleep' ) return 'Keep the remaining watch from your berth';
		return 'Your berth';
	}
	async sleep() {
		const s = this.s, b = s.beat;
		if ( this.busy ) return;
		this.busy = true;
		try {
			if ( [ 'd2rest', 'd3light', 'd4rest' ].includes( b ) ) {
				const t = b === 'd2rest' ? 39.12 : b === 'd3light' ? 63.12 : 87.12;
				await s._skipTo( t, 'A little sleep. Then the evening watch.' );
				s.setBeat( b === 'd2rest' ? 'd2light' : b === 'd4rest' ? 'd4light' : b );
			} else if ( b === 'd2sleep' ) {
				if ( s.h < 48.35 ) { s.toast( 'Keep the watch at the stool or desk chair until the small hours.' ); return; }
				if ( s.lamp.wind < 0.95 ) { s.toast( 'Wind the machine fully before resting.' ); return; }
				this.state.sleepFrom = s.h; this.state.sleepUntil = s.h + 2;
				s.hand.lit = false;
				if ( s.hand.carried ) { s.hand.setRest( BERTH.lantern, 0.4 ); s.hand.carried = false; this.state.lanternInBerth = true; }
				s.row( s.h, 'Machine fully wound. Storm lantern left unlit. Two hours’ rest.' );
				await s._skipTo( this.state.sleepUntil, this.state.lanternInBerth ? 'You leave the storm lantern on the washstand. Two hours. The machine will want you again.' : 'Two hours. The machine will want you again.' );
				s.row( s.h, 'Resumed the watch after two hours’ rest.' );
				this.place( -2.7, TOWER.floor, 12.1, 0, 0 ); s.setBeat( 'd2wake' );
			} else if ( b === 'd3sleep' ) {
				if ( s.lamp.wind < 0.9 ) { s.toast( 'Wind fully before keeping the remaining watch from here.' ); return; }
				await s.ui.card( [ 'You take the remaining watch in short stretches, returning to the machine between them.', 'Once, from the stair, you listen to the kitchen. Only the draught in the flue.' ], { kicker: 'The remaining watch' } );
				s.row( 72, 'Machine wound.' ); s.row( 75, 'Machine wound.' ); s.row( 78, 'Machine wound.' ); s.h = 80.9; s.lamp.wind = 0.62; s.lamp.warned = false;
				s.hand.lit = false; s.setBeat( 'd4journalMorning' );
			} else await s.ui.read( NOTES.bed );
		} finally { this.busy = false; s.save(); }
	}

	watchText() {
		if ( this.s.beat === 'd2sleep' && this.s.h < 48.35 ) return 'Keep the watch until the small hours';
		if ( this.s.beat === 'd2dawn' && this.s.h < 56.65 ) return 'Keep the watch until sunrise';
		return '';
	}
	async keepWatch() {
		const s = this.s;
		if ( s.beat === 'd2sleep' ) {
			await s.ui.fade( 'The watch passes. You tend the light between rounds.' ); s.h = 48.4; s.lamp.wind = 0.65; s.lamp.warned = false; s.row( 45.4, 'Machine wound.' );
		} else if ( s.beat === 'd2dawn' ) {
			await s.ui.fade( 'You wind again before dawn. The eastern glass grows pale.' ); s.h = 56.9; s.lamp.wind = 0.6; s.lamp.warned = false; s.row( 54.4, 'Machine wound.' );
		}
		s.save();
	}

	async journal() {
		const s = this.s, b = s.beat;
		if ( ! /journal/i.test( b ) ) { await s.ui.read( { title: 'The station journal', body: s.rows.slice( -12 ).map( ( [ h, text ] ) => `${ this.date( h ) } · ${ text }` ) } ); return; }
		if ( b === 'd4journalMorning' && s.lamp.lit ) { s.toast( 'Put the lamp out at sunrise before writing up the watch.' ); return; }
		const remarks = b === 'd4journal' && this.state.smokeSeen ? [ { key: 'smoke', ask: 'Smoke seen from the kitchen while you were at the hauling shed' } ] : [];
		const chosen = await s.ui.journal( { heading: b === 'd3journal' ? 'Friday 4th to Saturday 5th January 1901' : 'Saturday 5th to Sunday 6th January 1901', rows: s.rows.filter( r => r[ 0 ] >= ( b === 'd3journal' ? 33 : 57 ) ).map( ( [ h, text ] ) => [ this.date( h ), text ] ), remarks, footer: 'W. Innes, Assistant Keeper' } );
		if ( ! chosen ) return;
		if ( b === 'd3journal' ) s.setBeat( 'd3breakfast' );
		else if ( b === 'd4journalMorning' ) { this.state.morningLampOut = false; s.setBeat( 'd4rest' ); }
		else {
			this.state.recordedSmoke = !! chosen.smoke;
			if ( chosen.smoke ) s.row( s.h, 'Smoke observed from the kitchen chimney during the evening round. Embers remained beneath the ash on return.' );
			s.setBeat( 'd4complete' ); this.showEnd();
		}
	}
	date( h ) { const m = Math.floor( ( h % 24 ) * 60 ); return `${ 3 + Math.floor( h / 24 ) } Jan ${ String( Math.floor( m / 60 ) ).padStart( 2, '0' ) }.${ String( m % 60 ).padStart( 2, '0' ) }`; }
	showEnd() {
		if ( this.endShown ) return;
		this.endShown = true;
		this.s.ui.end( { heading: 'The next watch', rows: this.s.rows.filter( r => r[ 0 ] >= 57 ).map( ( [ h, text ] ) => [ this.date( h ), text ] ), lines: [ 'The kitchen is warm. Beyond the glass, the sea is dark.', 'Cate is watching from Gallan Head.', 'End of this chapter. The relief has still to come.' ], credits: 'Seven Hunters. Walter Innes and Cate Macleod are fictional. The new rooms, hauling shed and incidents are authored reconstructions.' } );
	}

	guidance() {
		const s = this.s, p = s.app.player.position, b = s.beat;
		if ( b === 'd4complete' ) return null;
		let id, zone = 'room';
		if ( s.lamp.lit && s.lamp.wind < 0.15 && ! [ 'd3remote', 'd3return' ].includes( b ) || /wind$/.test( b ) || b === 'd2wake' ) { id = 'crank'; zone = 'lantern'; }
		else if ( /signal$/.test( b ) ) { id = s.hasTelescope ? 'signal' : 'telescope'; zone = s.hasTelescope ? 'gallery' : 'lantern'; }
		else if ( /light$/.test( b ) || b === 'd2dawn' && ! this.watchText() || b === 'd4journalMorning' && s.lamp.lit ) { id = 'lens'; zone = 'lantern'; }
		else if ( /journal/i.test( b ) ) id = 'journal';
		else if ( b === 'd2crate' ) id = 'storesCrate';
		else if ( b === 'd2survey' || b === 'd3remote' ) {
			if ( p.y > TOWER.floor + 1 && Math.hypot( p.x, p.z ) < 4.2 ) return routeGuidance( p, marker( HAULING_SHED.door, 'Upper hauling shed', 'haulingShed' ), 'yard' );
			if ( within( p, BERTH ) ) return marker( BERTH.door, 'Kitchen', 'berthDoor' );
			if ( within( p, KITCHEN ) ) return marker( KITCHEN.door, 'Keepers’ room', 'kitchenDoor' );
			if ( within( p, ROOM ) ) return marker( new Vector3( ROOM.door.x, TOWER.floor +1, ROOM.door.z ), 'Yard door', 'houseDoor' );
			if ( p.z < 23 && p.x > -30 ) return marker( new Vector3( -12, STATION.yard +1, 23 ), 'West tramway', 'westTramway' );
			const path = [ [ -22, 27 ], [ -45, 27.5 ], [ -80, 27 ], [ -120, 29 ], [ -160, 35 ] ];
			if ( p.x > -151 ) { const next = path.find( q => q[ 0 ] < p.x - 5 ) || path.at( -1 ); return marker( new Vector3( next[ 0 ], s.app.terrainData.heightAt( ...next ) +1, next[ 1 ] ), 'West tramway', 'westTramway' ); }
			const inShed = Math.abs( p.x +160 ) < 1.75 && p.z > 38.3 && p.z < 41.6;
			if ( ! inShed ) {
				let x, z;
				if ( p.z < 37.8 && p.x < -156 ) { x = -155; z = 35; }
				else if ( p.x >= -156 && p.z < 43.5 ) { x = -155; z = 44; }
				else if ( p.x > -158.3 ) { x = -160; z = 44; }
				if ( x !== undefined ) return marker( new Vector3( x, s.app.terrainData.heightAt( x, z ) +1, z ), 'Upper hauling shed', 'shedApproach' );
				return marker( new Vector3( -160, HAULING_SHED.floor +1, 40.8 ), 'Upper hauling shed', 'haulingShed' );
			}
			id = 'haulingBrake'; zone = 'shed';
		} else if ( [ 'd3return', 'd2rest' ].includes( b ) && p.x < -30 ) {
			if ( p.x < -157.3 && p.z > 37.8 && p.z < 43.5 ) return marker( new Vector3( -160, HAULING_SHED.floor +1, 44 ), 'Tramway', 'shedExit' );
			if ( p.x < -155 && p.z > 41.8 ) return marker( new Vector3( -155, HAULING_SHED.floor +1, 44 ), 'Station', 'return' );
			const x = p.x < -125 ? -120 : p.x < -85 ? -80 : p.x < -50 ? -45 : -22;
			const z = x === -120 ? 29 : 27;
			return marker( new Vector3( x, s.app.terrainData.heightAt( x, z ) +1, z ), 'Station', 'return' );
		} else if ( [ 'd3return', 'd2rest' ].includes( b ) && p.z > 20 ) {
			const z = p.z > 21.5 && Math.abs( p.x +12 ) > 1 ? 24 : 18.5;
			return marker( new Vector3( -12, STATION.yard +1, z ), 'Station', 'return' );
		} else if ( b === 'd3return' && ! within( p, KITCHEN ) ) {
			id = 'kitchenStove';
		} else if ( b === 'd3bank' && ! s.hand.carried ) id = 'handLamp';
		else if ( /rest$/.test( b ) || b === 'd3sleep' || b === 'd2sleep' && ! this.watchText() ) id = 'berth';
		else if ( this.watchText() ) { id = p.y > TOWER.floor +1 ? 'stool' : 'chair'; zone = id === 'stool' ? 'lantern' : 'room'; }
		else id = 'kitchenStove';
		const it = s.interact.get( id ); if ( ! it ) return null;
		const at = typeof it.at === 'function' ? it.at() : it.at, target = marker( at, id === 'kitchenStove' && b === 'd3return' ? 'Kitchen' : id === 'berth' ? 'Your berth' : id === 'lens' ? 'Lamp · hold E' : id === 'crank' ? 'Wind · hold E' : id === 'signal' ? 'Signal lamp · E' : id === 'journal' ? 'Journal · E' : id === 'storesCrate' ? 'Your stores · E' : id === 'haulingBrake' ? 'Hauling brake · hold E' : 'Keep the watch · E', id );
		if ( zone === 'shed' ) return target;
		const inKitchen = within( p, KITCHEN ), inBerth = within( p, BERTH );
		// Approach the house's east door around the south wing, not through its corner.
		if ( ! within( p, ROOM ) && ! inKitchen && ! inBerth && p.y < TOWER.floor +1 && ( zone === 'room' || zone === 'lantern' ) ) {
			if ( p.z > 15.2 && p.x < 3.5 ) return marker( new Vector3( 4.5, STATION.yard +1, 18.5 ), 'House entrance', 'houseApproach' );
			if ( p.z > 5.5 && p.x >= 3.5 ) return marker( new Vector3( 4.5, STATION.yard +1, 4.6 ), 'House entrance', 'houseApproach' );
		}
		if ( at.z > 10.8 && inKitchen || inBerth && at.z < 10.8 ) return marker( BERTH.door, 'Berth door · E', 'berthDoor' );
		if ( ( inKitchen || inBerth ) && at.z < 5.4 ) return marker( KITCHEN.door, 'Keepers’ room · E', 'kitchenDoor' );
		if ( at.z > 5.4 && ! inKitchen && ! inBerth && within( p, ROOM ) ) return marker( KITCHEN.door, 'Kitchen door · E', 'kitchenDoor' );
		if ( ( inKitchen || inBerth ) && at.z > 5.4 && zone === 'room' ) return target;
		return routeGuidance( p, target, zone );
	}

	update( dt, modal ) {
		const s = this.s, app = s.app, b = s.beat, hold = this.busy || s.paused || modal || app.freeCam || app.ui?.ui?.photoMode;
		if ( ! hold && b !== 'd4complete' ) {
			const cap = CAPS[ b ] ?? s.h, rate = [ 'd3remote', 'd3return' ].includes( b ) ? 1 / 300 : s.watcher.talking ? 1 / 600 : 1 / 150;
			const dh = Math.max( 0, Math.min( dt * rate, cap -s.h ) ); s.h += dh; s.lamp.update( dt, dh );
		} else s.lamp.update( dt, 0 );
		s._applyClock();
		const remoteFog = [ 'd3remote', 'd3return', 'd3sleep' ].includes( b );
		const density = hazeDensityForVisibility( remoteFog ? 2.5 : 60 );
		if ( app.haze ) app.haze.density.value = density;
		if ( app.clouds?.coverage ) app.clouds.coverage.value = remoteFog ? 0.82 : 0.62;
		Beams.uniforms.far.value[ 1 ].w = 0;
		for ( const ds of Object.values( s.doors ) ) for ( const d of ds ) updateDoor( d, dt );
		const want = s.signal || s.hasTelescope && app.input.rightDown && app.input.enabled && ! hold;
		s.tel += ( Number( !! want ) -s.tel ) * ( 1 - Math.exp( -dt /0.12 ) );
		const fov = MathUtils.lerp( s.baseFov, 3.5, s.tel ); app.camera.fov = fov; app.camera.updateProjectionMatrix(); app.player.lookScale = fov /s.baseFov;
		s.ui.telescope( MathUtils.smoothstep( s.tel, 0.4, 0.95 ) ); Beams.uniforms.gain.value = 1 +6 *s.tel;
		if ( ! hold ) s._updateWatcher( dt, density );
		if ( s._leaveIn > 0 && ( s._leaveIn -= dt ) <= 0 && s.signal ) s._leaveSignal();
		if ( s.signal ) { app.input.enabled = false; app.camera.position.set( TOWER.signalStand.x, TOWER.deck +1.62, TOWER.signalStand.z ); app.camera.lookAt( s._herRender( new Vector3() ) ); app.player.prompt = null; }
		else if ( ! hold ) s.interact.update( dt );
		if ( /signal$/.test( s.beat ) && s.watcher.state === 'done' && ! s.watcher.lost ) {
			const n = Number( s.beat[ 1 ] ); this.state[ `conversation${ n }` ] = true;
			s.setBeat( n === 2 ? 'd2sleep' : n === 3 ? 'd3bank' : 'd4journal' );
		}
		const smokeStrength = [ 'd3return', 'd3sleep' ].includes( s.beat ) ? 1 : this.state.fireLit && ! this.state.banked ? 0.3 : 0;
		s.moving.smoke?.update( hold ? 0 : dt, app.camera, smokeStrength );
		const fire = app.localLights?.sources.find( l => l.kind === 'kitchenFire' ); if ( fire ) fire.scale = this.state.fireLit ? this.state.banked ? 0.12 : 1 : 0;
		if ( s.moving.haulingChains ) {
			s.moving.haulingChains.loose.visible = ! this.state.chainSecured;
			s.moving.haulingChains.secured.visible = !! this.state.chainSecured;
		}
		const p = app.player.position, outsideShed = Math.abs( p.x - HAULING_SHED.x ) > 2.5 || Math.abs( p.z - HAULING_SHED.z ) > 2.1;
		if ( b === 'd3return' && outsideShed && ! hold && ! this.state.smokeSeen && p.distanceTo( KITCHEN.chimney ) > 35 ) {
			const plume = KITCHEN.chimney.clone().add( new Vector3( 3, 7, 1 ) ), direction = plume.clone().sub( app.camera.position ).normalize();
			let clear = true;
			for ( let i = 1; i < 20 && clear; i ++ ) {
				const q = app.camera.position.clone().lerp( plume, i /20 ); clear = q.y > app.terrainData.heightAt( q.x, q.z ) +0.25;
			}
			if ( clear && new Vector3( 0, 0, -1 ).applyQuaternion( app.camera.quaternion ).dot( direction ) > Math.cos( MathUtils.degToRad( 25 ) ) ) { this.state.smokeSeen = s.h; s.save(); }
		}
		s.ui.setClock( `${ this.date( s.h ) } · ${ s.dayText() }` ); s.ui.setObjective( this.goal() ); s.ui.guidance( storyGuidance( s ), app.camera, !! app.player.prompt );
		s.saveT += dt; if ( s.saveT > 20 && ! hold ) s.save();
		if ( b === 'd4complete' && ! hold ) this.showEnd();
	}

	place( x, y, z, yaw, pitch = 0 ) {
		const s = this.s, p = s.app.player; p.position.set( x, y, z ); p.velocity.set( 0, 0, 0 ); p.yaw = yaw; p.pitch = pitch; p.mode = 'walk';
		s.app.cameraCut?.();
	}
	async preview( which = 'kitchen' ) {
		const s = this.s;
		s.arrival.group.visible = false; s.flags.firstNightComplete = 32.9; this.state.started = true; s.hasTelescope = true; s.moving.telescope.visible = false;
		if ( which === 'kitchen' ) { s.h = 33; s.beat = 'd2kitchen'; this.place( -2.2, TOWER.floor, 4.1, Math.PI ); }
		else {
			Object.assign( this.state, { crate: true, survey: true, fireLit: true, sleepFrom: 48.4, sleepUntil: 50.4 } );
			s.hand.carried = true; s.hand.lit = true; s.hand.glow = 1;
			if ( which === 'report' ) { s.h = 64.4; s.beat = 'd3signal'; this.episode( 3 ); this.place( TOWER.signalStand.x, TOWER.deck, TOWER.signalStand.z, 0 ); }
			else if ( which === 'after' ) { s.h = 88.4; s.beat = 'd4signal'; this.state.banked = 65; this.state.smokeSeen = 66; this.episode( 4 ); this.place( TOWER.signalStand.x, TOWER.deck, TOWER.signalStand.z, 0 ); }
			else { s.h = 66; s.beat = which === 'remote' ? 'd3remote' : 'd3return'; this.state.banked = 65; this.state.chainSecured = which === 'remote' ? 0 : 66; this.place( HAULING_SHED.x, HAULING_SHED.floor, HAULING_SHED.z +1, 0, -0.2 ); s.watcher.state = 'done'; }
			s.lamp.ignite(); s.lamp.wind = 1;
		}
		s._applyClock(); await s.ui.card( [ 'This chapter preview uses its own save slot.' ], { kicker: 'Seven Hunters', title: 'The next watch' } ); s.paused = false; s.save();
	}
}
