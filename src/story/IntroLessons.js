// First landfall only: location-led reading, without taking the walker or camera.
// These words are authored for the game. Sources support the facts, not the voice.
const history = { label: 'Northern Lighthouse Board · contemporary accounts', url: 'https://www.nlb.org.uk/history/flannan-isles/' };
const station = { label: 'Northern Lighthouse Board · station history', url: 'https://www.nlb.org.uk/lighthouses/flannan-islands/' };
const building = { label: 'Historic Environment Scotland · station and tramways', url: 'https://portal.historicenvironment.scot/designation/LB48143' };

export const INTRO_PAPERS = [
	{ id: 'intro-relief', label: 'The boat and the relief', sub: 'Tender, landing boat, relief and fortnight.', title: 'The boat and the relief',
		body: [
			'A lighthouse tender is the service vessel that brings keepers and supplies. The Hesperus made the relief at Flannan on 26 December 1900; Joseph Moore went ashore from a smaller boat.',
			'Relief means a change of keepers. A fortnight is two weeks. A planned return still depends on being able to land.',
		], provenance: 'Historical background written for the game. Walter’s posting, the boatman’s dialogue and the promised return are fiction. This is not a recovered instruction sheet.', sources: [ history ] },
	{ id: 'intro-landings', label: 'Steps, rails and stores', sub: 'How the landing places serve the station.', title: 'Steps, rails and stores',
		body: [
			'The island has east and west landing places. A landing is where a boat can put people and supplies ashore; it is not a sheltered harbour.',
			'The tramways are rail routes for hauling supplies between the landings and the lighthouse. The stairs carry the men; the rails help carry the stores.',
		], provenance: 'The landings, stairs and tramways are documented. Their exact appearance and the route you walk here are reconstructions.', sources: [ station, building ] },
	{ id: 'intro-shore', label: 'The people ashore', sub: 'The keepers’ families and the shore station.', title: 'The people ashore',
		body: [
			'The Board built houses for the lightkeepers’ families at Breasclete on Lewis. The shore station was close to sheltered water in Loch Roag, where the tender could wait when relief was delayed.',
			'A watch out on the rock separated the keepers from their households ashore. Walter’s sister Mary and her letter belong to this story.',
		], provenance: 'The shore station and family accommodation are historical. Walter, Mary and their correspondence are fictional.', sources: [ station ] },
	{ id: 'intro-station', label: 'A working station', sub: 'A new lighthouse, and what it means to show the light.', title: 'A working station',
		body: [
			'The Flannan light was established in 1899. In January 1901 this was a young working station, not an abandoned ruin.',
			'The instruction to “exhibit the light” means to show it. Walter’s posting requires him to keep it burning from sunset to sunrise; he still has to learn the machinery inside.',
		], provenance: 'The establishment date is historical. Walter’s instructions and solitary arrival are authored for the game; interiors and fittings are partly reconstructed.', sources: [ station ] },
	{ id: 'intro-keepers', label: 'The men before you', sub: 'The surviving account, before rumour.', title: 'The men before you',
		body: [
			'James Ducat was Principal Keeper, Thomas Marshall the second Assistant, and Donald McArthur the Occasional Keeper, covering for William Ross.',
			'Moore’s letter of 28 December describes empty beds, a cold fire and a lamp cleaned and supplied with oil. He and volunteers kept the light operating. The search had found no trace of the men.',
		], provenance: 'A paraphrase of the Board’s contemporary records, including Moore’s letter, available before the game’s 3 January opening. It does not import the later 8 January investigation into Walter’s papers. Walter’s arrival is fiction.', sources: [ history ] },
];

export const INTRO_CLIMB = [
	{ id: 'landings', route: 'steps', at: 0.08, topic: 'intro-landings', from: 'The landing places', text: 'A landing is where a boat can put men and stores ashore. There is another on the west side; today, you have come by the east.' },
	{ id: 'rails', route: 'steps', at: 0.36, topic: 'intro-landings', from: 'The tramway', text: 'The tramway is a rail route for hauling stores to the station. The men climb the steps; the supplies have their own way up.' },
	{ id: 'shore', route: 'steps', at: 0.68, topic: 'intro-shore', from: 'The people ashore', text: 'The keepers’ families live at Breasclete, on Lewis. Their houses are ashore; the watch is out here on the rock.' },
	{ id: 'station', topic: 'intro-station', from: 'A working station', text: 'The light was established in 1899. Barely a year later, three of its keepers were missing. The station still has work to do.' },
	{ id: 'yard', topic: 'intro-keepers', from: 'The men before you', text: 'James Ducat. Thomas Marshall. Donald McArthur. Moore found the station empty on 26 December. Tonight, keeping the light falls to you.' },
];

// Project onto the real graded flight / tramway, rather than an island-wide height trigger.
export function introRouteProgress( p, points ) {
	let length = 0, travelled = 0, best = Infinity, at = 0;
	for ( let i = 1; i < points.length; i ++ ) {
		const a = points[ i - 1 ], b = points[ i ], hasY = a.length === 3;
		const dx = b[ 0 ] - a[ 0 ], dz = b.at( -1 ) - a.at( -1 ), dy = hasY ? b[ 1 ] - a[ 1 ] : 0;
		const l2 = dx * dx + dy * dy + dz * dz, l = Math.sqrt( l2 );
		const x = p.x - a[ 0 ], z = p.z - a.at( -1 ), y = hasY ? p.y - a[ 1 ] : 0;
		const t = l2 ? Math.max( 0, Math.min( 1, ( x * dx + y * dy + z * dz ) / l2 ) ) : 0;
		const distance = Math.hypot( x - dx * t, y - dy * t, z - dz * t );
		if ( distance < best ) { best = distance; at = travelled + l * t; }
		travelled += l; length += l;
	}
	return { progress: length ? at / length : 0, distance: best };
}

export class IntroLessons {
	// The crest closes the stair passages, including any unread backlog. Full
	// explanations remain in Papers; the next passage belongs to the station.
	finishClimb() {
		const state = this.story.flags.introLessons ||= { seen: [], pending: [], active: null, gap: 0, yard: false, done: false };
		const stairs = INTRO_CLIMB.filter( cue => cue.route === 'steps' ).map( cue => cue.id );
		state.seen = [ ...new Set( [ ...state.seen, ...stairs ] ) ];
		state.pending = state.pending.filter( id => ! stairs.includes( id ) );
		if ( stairs.includes( state.active?.id ) ) state.active = null;
		state.gap = Math.max( state.gap, 6 );
	}
	constructor( story ) { this.story = story; }

	afterBoardLetter() {
		const state = this.story.flags.introLessons;
		if ( ! state || state.seen.includes( 'station' ) ) return;
		state.pending = [ 'station' ]; state.active = null;
		state.stationAfterLetter = true; state.yard = true; state.done = false; state.gap = 6;
		this.story.save();
	}

	update( dt, { blocked = false } = {} ) {
		const s = this.story;
		const arrival = [ 'climb', 'room' ].includes( s.beat );
		if ( ( ! arrival && ! s.flags.introLessons?.stationAfterLetter ) || ! s.flags.landed ) return null;
		// Older saves beyond the climb do not acquire an unsolicited arrival scene.
		if ( s.beat === 'room' && ! s.flags.introLessons ) return null;
		const state = s.flags.introLessons ||= { seen: [], pending: [], active: null, gap: 0, yard: false, done: false };
		if ( blocked || state.done || s.islandReveal?.quietWalk ) return null;
		if ( s.beat === 'room' && ! state.yard ) {
			state.yard = true;
			// A hurried first climb stays readable, but its backlog does not spill into the house.
			state.pending = [ 'yard' ];
		}
		if ( ! state.yard && s.app.player.mode === 'walk' && s.app.player.grounded ) {
			const landing = s.station.landings.east;
			const routes = { steps: introRouteProgress( s.app.player.position, landing.steps.pts ),
				track: introRouteProgress( s.app.player.position, s.station.tracks.east ) };
			for ( const cue of INTRO_CLIMB ) {
				const r = routes[ cue.route ];
				if ( ! r || r.distance > 3 || r.progress < cue.at || cue.route === 'track' && ! s.flags.islandRevealSeen ) continue;
				if ( ! state.seen.includes( cue.id ) && ! state.pending.includes( cue.id ) ) state.pending.push( cue.id );
			}
		}
		// dt is a visible reading clock; modal reading, the reveal and backgrounding freeze it.
		const elapsed = Math.max( 0, Math.min( dt, 1 ) );
		if ( state.active ) {
			state.active.remaining -= elapsed;
			if ( state.active.remaining <= 0 ) { state.active = null; state.gap = 6; }
		} else state.gap = Math.max( 0, state.gap - elapsed );
		if ( ! state.active && state.gap === 0 && state.pending.length ) {
			const id = state.pending.shift();
			const cue = INTRO_CLIMB.find( c => c.id === id );
			if ( cue ) {
				state.active = { id: cue.id, remaining: Math.max( 17, cue.text.split( /\s+/ ).length / 2 + 5 ) };
				state.seen.push( cue.id );
				s.save();
			}
		}
		if ( state.yard && ! state.active && ! state.pending.length ) state.done = true;
		const cue = INTRO_CLIMB.find( c => c.id === state.active?.id );
		return cue ? { ...cue, lesson: true } : null;
	}
}
