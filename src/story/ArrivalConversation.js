// A practical fictional handover aboard Hesperus's landing boat. The historical
// record supports the context, not a documented visit by Walter on 3 January.
// See NLB's contemporary Moore letter (28 December), rather than importing the
// later 8 January investigation into the papers carried on this crossing.
export const ARRIVAL_HANDOVER = [
	{ from: 'The boatman', text: '"Keep your bag close. Your orders are in your coat, with Moore’s account and the letter from home. Have a look while we come in."', duration: 17 },
	{ from: 'Walter', text: '"Where do I begin when I’m up there?"', duration: 7 },
	{ from: 'The boatman', text: '"The desk in the keepers’ room. Written instructions there. See to the light first; your bag can wait."', duration: 14 },
	{ from: 'Walter', text: '"I’ll keep the papers dry, then. Thank you."', duration: 7 },
	{ from: 'The boatman', text: '"Aye. Easier reading here than on those steps. Mind your footing."', duration: 9 },
];

// The packet keeps personal fiction, fictional orders and the historical account
// distinct. The redundant tender/relief and missing-keepers background sheets
// have been removed from IntroLessons; their useful context is retained here.
export const CROSSING_PAPERS = [
	{
		id: 'home', label: 'A letter from home', sub: 'Your sister Mary. 1st January 1901.',
		title: 'My dear Walter,',
		body: [
			'1st January 1901',
			'I have put the thick stockings at the bottom of your bag. The blue pair are still damp at the heel; let them dry before you wear them.',
			'Write when the boat comes back. Tell me something ordinary: what you had for your supper, or whether the stove draws. The newspapers have told us quite enough of the island already.',
			'I shall keep your place at the table.',
			'Your sister, Mary',
		],
		provenance: 'A fictional letter to Walter Innes, an invented keeper. Mary is his sister.',
	},
	{
		id: 'posting', label: 'Your posting', sub: 'Hesperus. The work waiting ashore.',
		title: 'W. Innes — Flannan Islands',
		body: [
			'3rd January 1901 — Embarkation slip',
			'Passage aboard Hesperus. Land at the east landing if the sea permits.',
			'The light must be shown at sunset. Written instructions await you on the desk in the keepers’ room. See to the light before unpacking.',
			'Your bag is to go with you. A planned relief depends upon being able to land; bring sufficient clothing for a delay.',
		],
		provenance: 'Walter’s posting and this slip are fiction within the game’s 3 January 1901 premise. This is not a record of the documented December relief party.',
	},
	{
		id: 'moore', label: 'What the relief found', sub: 'Joseph Moore’s account, 28th December.',
		title: 'Flannan Islands — 28th December 1900',
		body: [
			'An office summary of Assistant Keeper Joseph Moore’s account.',
			'Hesperus reached the island on 26 December. Moore found no keepers: James Ducat, Thomas Marshall and Donald McArthur were missing. The beds were empty and the fire cold; the lamp had been cleaned and its oil supply filled.',
			'Moore returned with volunteers to maintain the light. Their search found no trace of the men.',
			'On the west side, a box of ropes and tackle was gone and railings were damaged. Moore could not establish what had happened to the men.',
		],
		provenance: 'Paraphrased from Moore’s surviving letter of 28 December. This office summary is a fictional prop, not an archival quotation. The later 8 January investigation is not included.',
		source: 'https://www.nlb.org.uk/history/flannan-isles/',
	},
];

// Compatibility for review screens. Live play uses the saved controller below,
// so bringing the landing closer cannot skip the whole exchange.
let at = 0;
export const CROSSING_LINES = ARRIVAL_HANDOVER.map( remark => {
	const line = { ...remark, at, until: at + remark.duration };
	at = line.until;
	return line;
} );
CROSSING_LINES.push( { at, until: Infinity, from: 'Walter', text: 'The papers are in my coat. The station is above the steps.', lesson: true } );

export class ArrivalConversation {
	constructor( story ) { this.s = story; }
	get state() {
		const state = this.s.flags.arrivalConversation ||= { index: 0, elapsed: 0, done: false };
		state.index = Math.max( 0, Math.min( ARRIVAL_HANDOVER.length, Math.floor( Number( state.index ) || 0 ) ) );
		state.elapsed = Math.max( 0, Number( state.elapsed ) || 0 );
		if ( state.index === ARRIVAL_HANDOVER.length ) state.done = true;
		return state;
	}
	get available() {
		return this.s.beat === 'crossing' && ! this.s.flags.landed && ! this.state.departed
			&& this.s.arrival?.departure == null;
	}
	get active() { return this.available && ! this.state.done; }
	get hint() {
		if ( ! this.active ) return '';
		return this.s.app.isMobile ? 'Read papers · Next remark — Continue the handover'
			: 'B — Papers     Enter — Next remark';
	}
	// One deliberate input advances one remark. Calls before a newly displayed
	// remark has had a frame to appear are consumed, preventing a double activation
	// from advancing the boat or dismissing a second line in the same frame.
	advance() {
		if ( ! this.active ) return false;
		if ( this.state.elapsed < .15 ) return true;
		this._next();
		return true;
	}
	_next() {
		const state = this.state;
		state.index ++; state.elapsed = 0;
		state.done = state.index >= ARRIVAL_HANDOVER.length;
		this.s.save();
	}
	update( dt, { blocked = false } = {} ) {
		if ( ! this.available || blocked ) return null;
		if ( ! this.state.done ) {
			const remark = ARRIVAL_HANDOVER[ this.state.index ];
			this.state.elapsed += Math.max( 0, Math.min( Number( dt ) || 0, 1 ) );
			if ( this.state.elapsed >= remark.duration ) this._next();
		}
		const remark = ARRIVAL_HANDOVER[ this.state.index ];
		return remark ? { ...remark, dialogue: true } : {
			from: 'Walter', text: this.s.arrival.ready ? 'I can step ashore. The station is above the steps.' : 'The papers are in my coat. The station is above the steps.', lesson: true,
		};
	}
	depart() {
		const state = this.state;
		state.departed = state.done = true;
		state.index = ARRIVAL_HANDOVER.length;
		state.elapsed = 0;
	}
}
