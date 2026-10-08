// The words of the first night (docs/PLAN.md §3): the cards, the things you read, the Watcher's
// messages and your answers. Fiction on a real record: the keepers lost in December 1900 appear only
// through what the record says (§2.7); Walter Innes and Ceit Macleod are invented.

import { pressureAt } from '../weather/WeatherReadings.js';

export const TITLE = 'Seven Hunters';

export const DAY = {
	date: 'Thursday, 3rd January 1901',
	place: 'Eilean Mòr, the Flannan Isles',
};

// Retained by the story desk as an outline of the landing; the crossing is now playable.
export const PROLOGUE = [
	'The Hesperus could not lie off the east landing for long in that swell.',
	'They got you up onto the stage with a bag and a crate of stores, and then the sea came up the geo and the coxswain took her out again. The other two men were still aboard.',
	'"Keep her lit," he shouted. "We\'ll be back within the fortnight."',
	'The light has to be lit at sunset. The station is at the top of the steps.',
];

// The personal letter and embarkation slip are fiction. Moore's 28 December letter predates
// this scene; its summary follows the Board's transcript, not Muirhead's later 8 January report.
// Source: https://www.nlb.org.uk/history/flannan-isles/
export const CROSSING_PAPERS = [
	{
		id: 'home', label: 'A letter from home', sub: 'Folded inside your coat. 1st January 1901.',
		title: 'My dear Walter,',
		body: [
			'1st January 1901',
			'I have put the thick stockings at the bottom of your bag. The blue pair are still damp at the heel; let them dry before you wear them.',
			'You said there would be three of you. I am glad of that. A fortnight is not long when there is someone to talk to.',
			'Write when the boat comes back. Tell me something ordinary: what you had for your supper, or whether the stove draws. The newspapers have told us quite enough of the island already.',
			'I shall keep your place at the table.',
			'Your sister, Mary',
		],
		provenance: 'A fictional letter to Walter Innes, an invented keeper.',
	},
	{
		id: 'moore', label: 'What the relief found', sub: 'A summary of Joseph Moore’s letter, 28th December.',
		title: 'Flannan Islands · 28th December 1900',
		body: [
			'An office summary of Assistant Keeper Joseph Moore’s account.',
			'On 26 December the relief vessel received no answer from the island. Moore went ashore to investigate.',
			'At the station he found no keepers. The beds were empty and the fire cold. The lamp had been cleaned and its oil supply filled.',
			'Moore returned with volunteers to maintain the light. A search found no trace of the missing men.',
			'The sea had damaged the west landing’s railings and washed away a box of ropes and tackle. Moore could not establish what had happened to the men.',
		],
		provenance: 'Paraphrased from Moore’s surviving letter. The office summary is a fictional prop; it is not an archival quotation.',
		source: 'https://www.nlb.org.uk/history/flannan-isles/',
	},
	{
		id: 'posting', label: 'Your posting', sub: 'The embarkation slip. The work waiting ashore.',
		title: 'W. Innes · Flannan Islands',
		body: [
			'3rd January 1901 · Embarkation slip',
			'Passage aboard Hesperus with the replacement keepers and station stores. Land at the east landing if the sea permits.',
			'The light must be shown at sunset. Written instructions await you on the desk in the keepers’ room.',
			'Your bag is to go with you. The rest of the stores will follow when the boat can make another landing.',
			'Relief depends upon the weather. Bring sufficient clothing for a delay.',
		],
		provenance: 'Fictional posting and arrival within the game’s 3 January 1901 premise.',
	},
];

export const CROSSING_LINES = [
	{ at: 0, until: 21, lesson: true, from: '3rd January 1901 · The east approach', text: 'The Hesperus is a lighthouse tender, bringing keepers and supplies. Her landing boat carries you the last stretch to the island.' },
	{ at: 27, until: 41, from: 'The boatman', text: '“That’s the light up there. Keep your bag close.”' },
	{ at: 47, until: 65, lesson: true, from: 'The relief', text: 'Relief means a change of keepers. A fortnight is two weeks. The boat’s return depends on the sea.' },
	{ at: 71, until: 85, from: 'The boatman', text: '“We’ll put you up first. Then we’ll see about the others.”' },
	{ at: 90, until: Infinity, from: 'The east landing', text: 'The boat holds under the cliff. Your bag is ready.' },
];

// objectives, by beat
export const GOALS = {
	crossing: 'B · Read your papers. Look around as the island draws closer.',
	climb: 'Go up the steps to the light station.',
	room: 'Find the keepers\' room: the door in the east side of the house.',
	letter: 'Read the Board\'s letter on the desk.',
	light: 'Light the lamp at sunset. The tower door is in the corner of the keepers\' room.',
	lightWait: 'The lamp is lit at sunset. Face the lens and hold E to wait for it.',
	lightHere: 'Face the lens and hold E to light the lamp.',
	machine: 'Wind the machine that turns the lens.',
	machineHere: 'Wind the machine: hold E at the crank on the lens\'s pedestal.',
	watch: 'Keep the watch. Gallan Head should show a light after dark.',
	gallan: 'Gallan Head is calling. Take the telescope from the lantern’s sill, then use the signal lamp on the outside balcony.',
	answer: 'Use the signal lamp on the outside balcony: look at it and press E to choose your reply.',
	obs: 'Chalk the six o\'clock observations on the slate in the keepers\' room.',
	bell: 'The machine is running down. Wind it.',
	evening: 'Keep the watch. The machine wants winding every three hours.',
	haar: 'Keep the watch.',
	gate: 'See to the gate in the yard below: use E on it.',
	night: 'Keep the watch until dawn. Use E at the lantern’s stool or the chair by the desk.',
	dawn: 'Put the lamp out at sunrise.',
	journal: 'Write up the journal at the desk.',
};

export const SUNSET = 15.15; // local solar time on the day (Setting.js: 15:09)
export const SUNRISE = 8.9;

// The Board's letter is a fictional prop. The lamp link, signal book and its numbered groups
// belong to the game, not to a documented Flannan installation.
export const LETTER = {
	title: 'Northern Lighthouse Board, 84 George Street, Edinburgh',
	body: [
		'31st December 1900',
		'To the Assistant Keeper, Flannan Islands.',
		'Until the arrival of the Principal Keeper you will take sole charge of the light, and you will keep it in accordance with the General Instructions.',
		'The light is to be exhibited from sunset to sunrise without interruption. Light the lamp at sunset precisely and set the machine going.',
		'Wind the machine before its weight reaches the foot of the tube. Attend to the warning bell without delay.',
		'Enter the barometer, wind, sea and visibility on the slate at six in the evening and at the prescribed hours. Copy the entries fair into the journal each morning, including the times of lighting and extinguishing.',
		'The observer at Gallan Head on Lewis keeps a nightly lookout. Use the signal lamp when the air is clear. The station signal book is in the lantern drawer.',
		'You will not leave the station, nor go down to either landing in a heavy sea.',
		'I am, Sir, your obedient servant,',
		'Secretary.',
	],
};

export const NOTES = {
	journal: { title: 'The station journal', body: [ 'A new book. The old journal went to Edinburgh with the Superintendent.', 'The first page is ruled for the 3rd of January and is empty. It is written up in the morning, from the slate.' ] },
	slate: { title: 'The slate', body: [ 'Wiped clean, the chalk on its ledge.' ] },
	oilskins: { title: 'The oilskins', body: [ 'One set of oilskins on the pegs. Two pegs empty.', 'There are places for three men to hang their things.' ] },
	stove: { title: 'The stove', body: [ 'Cold. There is coal in the scuttle.' ] },
	bag: { title: 'Your bag', body: [ 'The thick stockings are at the bottom, where Mary said she put them.', 'You can unpack after the light is burning.' ] },
	westDoor: { title: 'The bedrooms', body: [ 'The beds are beyond this door. First, the light.' ] },
	kitchenDoor: { title: 'The kitchen', body: [ 'Your crate and the bread are in there. They can wait until the light is burning.' ] },
	chapel: { title: 'Teampull Beannachadh', body: [ 'St Flannan\'s chapel: a cell of dry stone with a doorway you would have to stoop through.', 'The fowlers who came here once a year took off their caps when they reached the top of the island, and turned sunwise, and never called the island by its name.' ] },
	ropeBox: { title: 'The west landing', body: [ 'A box for the ropes and the landing gear, in a cleft of the rock 110 feet above the sea.', 'The one that stood here in December was gone when the Superintendent came on the 29th, and the railings round the crane were twisted out of shape.' ] },
};

// the barometer: by the hour of the night (it falls as the haar comes in)
export function barometer( h ) {

	const v = pressureAt( h );
	return `${ v.toFixed( 2 ) } inches, ${ h < 19 ? 'steady' : 'falling a little' }.`;

}

// the observation form: what you can choose for each, and the right answers by the time of the night
export const OBS = {
	wind: [ 'Calm', 'Light airs, SW', 'Moderate breeze, SW', 'Fresh breeze, SW', 'Strong breeze, W', 'Gale, W' ],
	sea: [ 'Smooth', 'Slight', 'Moderate', 'Rough', 'Very rough' ],
	visibility: [ 'Very good: Lewis in sight', 'Good', 'Moderate', 'Haze', 'Fog' ],
	truth: ( h ) => ( { wind: 'Fresh breeze, SW', sea: 'Moderate', visibility: h < 20.5 || h > 30.5 ? 'Very good: Lewis in sight' : 'Fog' } ),
};

// ---- the Watcher
//
// Her messages are sent letter by letter by lamp (Morse) and read through the telescope. Your answers are
// a group from the fictional station book (quick, formal) or a message spelled out (slow, your own words):
// each costs the night's clock `minutes`. say: whether a message says the island's name on the island.
// Routine transmissions aim for 5–15 words; brief answers may be shorter. The game's K invites
// a reply and never closes a conversation. Node IDs/order retain existing save and choice paths.
//
//   node: { her: 'MESSAGE', options: [ { code?: n, text, minutes, next } ], end? }
export const CALL = 'FLANNAN FLANNAN K';
export const SIGNAL_UI = {
	title: 'The signal book',
	callHint: 'K means “answer”. Reply at the signal lamp on the balcony.',
	replyHint: 'Your turn to answer',
	replyInstruction: 'Choose your reply. The lamp sends it for you.',
	readingHint: 'Reply at the signal lamp on the balcony',
};

export const WATCHER = {
	start: 'hello',
	nodes: {
		hello: {
			her: 'GALLAN HEAD TO FLANNAN. LIGHT SEEN. K',
			options: [
				{ code: 4, text: 'LIGHT LIT. ALL WELL.', minutes: 3, next: 'who' },
				{ text: 'NEW KEEPER HERE. ALONE.', minutes: 9, next: 'alone' },
			],
		},
		who: {
			her: 'WHO HAS THE WATCH',
			options: [
				{ text: 'INNES. ASSISTANT. FROM LEITH.', minutes: 8, next: 'ceit' },
				{ text: 'NEW MAN. ALONE TILL THE BOAT.', minutes: 10, next: 'alone' },
			],
		},
		alone: {
			her: 'ALONE. WHERE ARE THE OTHERS',
			options: [
				{ text: 'BOAT TURNED BACK IN THE SWELL.', minutes: 9, next: 'ceit' },
				{ code: 9, text: 'BOAT RETURNING.', minutes: 3, next: 'ceit' },
			],
		},
		ceit: {
			her: 'CEIT MACLEOD HERE. CALL ME CATE. I WATCH YOUR LIGHT FOR THE BOARD.',
			options: [
				{ text: 'GLAD OF IT.', minutes: 4, next: 'pay' },
				{ text: 'DID YOU WATCH IT IN DECEMBER', minutes: 9, next: 'december' },
				{ code: 11, text: 'SIGNAL UNDERSTOOD.', minutes: 3, next: 'name' },
			],
		},
		pay: {
			her: 'THE BOARD PAYS EIGHT POUNDS A YEAR. I WOULD WATCH FOR LESS.',
			options: [
				{ text: 'WHY', minutes: 2, next: 'nothing' },
				{ code: 11, text: 'SIGNAL UNDERSTOOD.', minutes: 3, next: 'name' },
			],
		},
		nothing: {
			her: 'NOT MUCH ELSE TO LOOK AT FROM HERE.',
			options: [ { code: 11, text: 'SIGNAL UNDERSTOOD.', minutes: 3, next: 'name' } ],
		},
		december: {
			her: 'I COULD NOT SEE THE LIGHT. I TOLD MYSELF IT WAS THE MIST.',
			options: [
				{ text: 'IT WAS THE WEATHER.', minutes: 6, next: 'maybe' },
				{ text: 'NOT YOUR FAULT.', minutes: 5, next: 'maybe' },
				{ code: 11, text: 'SIGNAL UNDERSTOOD.', minutes: 3, next: 'name' },
			],
		},
		maybe: {
			her: 'MAYBE.',
			options: [ { code: 11, text: 'SIGNAL UNDERSTOOD.', minutes: 3, next: 'name' } ],
		},
		name: {
			her: 'ON THE ISLAND SAY THE COUNTRY. DO NOT SAY ITS NAME.',
			options: [
				{ text: 'WHY', minutes: 2, next: 'fowlers' },
				{ text: 'SUPERSTITION.', minutes: 5, next: 'humour' },
				{ code: 11, text: 'SIGNAL UNDERSTOOD.', minutes: 3, next: 'west' },
			],
		},
		fowlers: {
			her: 'THE OLD FOWLERS NEVER DID. I WOULD NOT START.',
			options: [ { code: 11, text: 'SIGNAL UNDERSTOOD.', minutes: 3, next: 'west' } ],
		},
		humour: {
			her: 'AYE. HUMOUR ME.',
			options: [ { code: 11, text: 'SIGNAL UNDERSTOOD.', minutes: 3, next: 'west' } ],
		},
		west: {
			her: 'GLASS FALLING HERE. MIND THE WEST LANDING.',
			options: [
				{ text: 'GOOD NIGHT GALLAN HEAD.', minutes: 5, next: 'end' },
				{ text: 'GOOD NIGHT FROM FLANNAN.', minutes: 5, next: 'end', say: true },
				{ code: 2, text: 'GOOD NIGHT.', minutes: 3, next: 'end' },
			],
		},
		end: { her: 'GOOD NIGHT. KEEP HER LIT.', end: true },
	},
};

// at dawn, the night's entry in the journal: remarks you may make or leave out
export const REMARKS = {
	islet: { yes: 'A light seen on Eilean Tighe at {t}, for a minute or less. No vessel.', no: null, ask: 'The light on Eilean Tighe' },
	gate: { yes: 'Entrance gate found standing open at {t}. Secured.', no: null, ask: 'The gate' },
	gallan: { yes: 'Signals exchanged with Gallan Head.', no: 'No signal from Gallan Head.', ask: null },
};

export const ENDING = [
	'The relief did not come that day, or the next.',
	'End of the first night.',
];
