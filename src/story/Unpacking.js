import { ROOM, TOWER } from '../world/flannan/Station.js';
import { WARN } from '../station/Lamp.js';

export const BROWNIE_PAPER = {
	id: 'brownie', label: 'Your Brownie', sub: 'One roll. Six pictures to bring home.', title: 'The Brownie camera',
	body: [
		'A little black box, scarcely larger than your palm. The covering looks like leather; beneath it are card and wood. A small lens at the front, a shutter lever on top, a winding key at the side.',
		'There is no finder to look through. The two lines on the top give you the direction. Hold the box level and steady; choose your picture in good daylight.',
		'Mary had the shop load a roll before you left. Six square pictures. After each exposure the film must be wound to the next number in the little red window at the back. Keep the back shut until the roll is finished.',
		'Begin with the place where you sit, as Mary asked. In the later daylight photography watch, rest the box securely, frame the chair and make a supported time exposure. The shutter guide will lead each step. Afterwards the remaining views are yours.',
		'You cannot see what you have taken. The film will have to go ashore to be developed when the relief comes.',
		'Her note is folded under the box: “Bring me a picture of the place where you sit. Then I shall know where to put you when I think of you.”',
	],
	provenance: 'Walter, Mary, her gift and this note are fiction. The prop represents the original 1900 Brownie, with approximate dimensions and controls. The museum documents its February 1900 introduction, card-and-wood box, optional finder and six 2¼-inch square negatives on 117 roll film. The camera can be taken after unpacking and used in daylight. The prints are developed after Walter goes ashore.',
	sources: [
		{ label: 'Eastman Kodak: Brownie instructions, January 1900, printed pages 13–17 (time exposures indoors)', url: 'https://manuals.plus/m/ad159776d5786e3094c8bdc6c3c72eeabcd3de73de75beb3e8b1b8069ac8fd0a_optim.pdf' },
		{ label: 'National Science and Media Museum · the original Brownie', url: 'https://blog.scienceandmediamuseum.org.uk/a-z-photography-collection-b-is-for-brownie/' },
		{ label: 'Science Museum Group · surviving Brownie box camera', url: 'https://collection.sciencemuseumgroup.org.uk/objects/co8406729/no-1-brownie-box-camera' },
		{ label: 'Early Photography collection · 1900 model and sight lines', url: 'https://www.earlyphotography.co.uk/site/entry_X30.html' },
	],
};

const LINES = [
	null,
	{ from: 'Your bag', text: 'Salt in the buckles. You work them loose and fold back the canvas. The things inside still smell faintly of home.' },
	{ from: 'The blue stockings', text: 'Mary was right about the heels. You lay the shirt and stockings over the empty chair to dry. A small parcel is tucked against the side of the bag.' },
	{ from: 'A Brownie', text: 'A little black box, with a lens no bigger than a shirt button. Mary had it loaded at the shop. One roll. Six pictures to bring home.' },
	{ from: 'Mary’s note', text: '“Bring me a picture of the place where you sit. Then I shall know where to put you when I think of you.” You set the Brownie beside the journal.' },
];
const ACTIONS = [ 'Unbuckle your bag', 'Lay out the shirt and stockings', 'Unwrap the small parcel', 'Set the Brownie on the desk', 'Examine the Brownie and Mary’s note' ];

// A short, player-led pause between the first lighting and the watch. Each E
// advances one physical action. Progress and the current thought live in flags.
export class Unpacking {
	constructor( story ) { this.s = story; }
	get state() { return this.s.flags.unpacking; }
	get stage() { return Math.max( 0, Math.min( 4, Math.floor( Number( this.state?.stage ) || 0 ) ) ); }
	get inRoom() {
		const p = this.s.app.player.position;
		return p.x > ROOM.x0 && p.x < ROOM.x1 - .35 && p.z > ROOM.z0 && p.z < ROOM.z1 && Math.abs( p.y - TOWER.floor ) < .4;
	}
	get ready() {
		const s = this.s;
		return ! s.next?.active && ! [ 'intro', 'crossing', 'climb', 'room', 'letter', 'light', 'machine', 'dawn', 'journal', 'end' ].includes( s.beat ) &&
			s.lamp.lit && s.lamp.running && s.lamp.wind >= WARN && ( ! s.keeper?.active || s.keeper.state.rewound );
	}
	get urgent() {
		const s = this.s;
		return !! s._obsDue() || s.beat === 'gate' || s.watcher.talking || [ 'steady', 'calling', 'waiting' ].includes( s.watcher.state );
	}
	get pending() { return !! this.state && ! this.state.examined && this.ready && ! this.urgent; }
	get holdsClock() { return this.pending && this.stage > 0 && this.inRoom; }
	install() {
		const I = this.s.interact, bag = I.get( 'bag' );
		if ( ! bag ) return;
		bag.text = () => this.stage === 4 ? 'Your unpacked bag' : this.ready ? ACTIONS[ this.stage ] : 'Your bag';
		bag.when = () => this.stage < 3 || this.stage === 4;
		bag.use = () => this.useBag();
		I.add( { id: 'brownieParcel', at: () => this.s.station.parts.unpacking?.parcel || ROOM.bag, size: .16, reach: 1.8,
			when: () => this.stage === 3, text: ACTIONS[ 3 ], use: () => this.advance() } );
		I.add( { id: 'brownie', at: () => this.s.station.parts.unpacking?.desk || ROOM.letter, size: .1, reach: 1.8,
			when: () => this.stage === 4 && ! this.s.flags.photography?.taken,
			text: () => this.state?.examined ? 'Take the Brownie · one roll, six pictures' : 'Examine the Brownie and Mary’s note',
			use: () => this.state?.examined ? this.s.photography.take() : this.examine() } );
		this.sync();
	}
	async useBag() {
		if ( this.stage === 4 ) return this.s.ui.read( { title: 'Your bag', body: [ 'The canvas lies open. Your shirt and the blue stockings are drying on the chair.', this.s.flags.photography?.taken ? 'You have Mary’s Brownie with you. Keep its back shut until you go ashore.' : 'The Brownie is on the desk, beside the journal. You can take it with you.' ] } );
		if ( ! this.ready ) return this.s.ui.read( { title: 'Your bag', body: [ 'The thick stockings are at the bottom, where Mary said she put them.', 'See to the light and its machinery first. Your things can wait.' ] } );
		this.s.flags.unpacking ||= { stage: 0 };
		this.advance();
	}
	advance() {
		const s = this.s;
		if ( ! this.state || this.stage >= 4 || ! this.ready || s.paused || s.ui.open || s.app.mobile?.paused || s.app.devMenu?.open || s.app.freeCam || s.app.ui?.ui?.photoMode || globalThis.document?.hidden ) return;
		this.state.stage = this.stage + 1;
		this.state.lineRemaining = 16;
		this.sync(); s.save();
	}
	async examine() {
		if ( this.stage !== 4 ) return;
		this.state.lineRemaining = 0;
		await this.s.ui.read( BROWNIE_PAPER );
		this.state.examined = true; this.s.toast( 'The Brownie can be taken from the desk. One roll, six pictures in daylight.', 6000 ); this.s.save();
	}
	sync() {
		const objects = this.s.moving.unpacking;
		if ( ! objects ) return;
		const stage = this.stage;
		for ( const [ name, obj ] of Object.entries( objects ) ) {
			if(name==='brownieOnDesk' && this.s.flags.photography?.taken){obj.visible=false;continue;}
			obj.visible = name === 'closed' ? stage === 0 : name === 'open' ? stage > 0 :
				name === 'packedClothes' ? stage === 1 : name === 'laidClothes' ? stage >= 2 :
				name === 'parcel' ? stage === 1 || stage === 2 : name === 'wrapper' ? stage >= 3 :
				name === 'brownieInBag' ? stage === 3 : stage === 4;
		}
	}
	goal() { return this.pending ? this.stage === 0 ? 'The light is working. Return to the keepers’ room and unpack your bag.' : ACTIONS[ this.stage ] + '.' : null; }
	guidance() {
		if ( ! this.pending ) return null;
		const id = this.stage === 4 ? 'brownie' : this.stage === 3 ? 'brownieParcel' : 'bag';
		const it = this.s.interact.get( id );
		const at = typeof it.at === 'function' ? it.at() : it.at;
		const selected = this.s.interact.current?.id === id;
		const distant = this.s.app.camera.position.distanceTo( at ) > it.reach + it.size;
		const name = id === 'bag' ? 'your bag' : id === 'brownieParcel' ? 'the small parcel' : 'the Brownie on the desk';
		return { at, label: selected ? ACTIONS[ this.stage ] : distant ? `Move closer to ${ name }` : `Look at ${ name }`, id };
	}
	update( dt, { blocked = false } = {} ) {
		if ( blocked || ! this.inRoom || ! this.state?.lineRemaining || this.urgent ) return null;
		const line = LINES[ this.stage ];
		if ( ! line ) return null;
		this.state.lineRemaining = Math.max( 0, this.state.lineRemaining - Math.max( 0, Math.min( dt, 1 ) ) );
		return { ...line, lesson: true };
	}
}
