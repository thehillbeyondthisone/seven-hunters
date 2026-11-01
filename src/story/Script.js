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
	'Hesperus brought you to the island. The landing boat carries you the last stretch.',
	'The boatman points out the instructions in your coat and the desk in the keepers’ room. See to the light first.',
	'“Mind your footing. Keep her lit.”',
	'The boat goes back. The station is at the top of the steps.',
];

// The personal letter and embarkation slip are fiction. Moore's 28 December letter predates
// this scene; its summary follows the Board's transcript, not Muirhead's later 8 January report.
// Source: https://www.nlb.org.uk/history/flannan-isles/
export { CROSSING_PAPERS, CROSSING_LINES } from './ArrivalConversation.js';

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
	bell: 'The machine is running down. Wind it.',
	evening: 'Keep the watch. Attend to the driving weight while you are in the tower.',
	haar: 'Keep the watch.',
	gate: 'Secure the gate. Hold E to close it and wrap the rope again.',
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
		'For the first watch, attend to the lamp and machine, answer the observer when the air is clear, and write the lighting and extinguishing times in the morning journal. Begin the weather round by daylight on your second day: instruments, sea and the two landmarks. Thereafter enter the evening readings on the slate and copy them fair into the journal.',
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
	chapel: { title: 'Teampull Beannachadh', body: [ 'A single dry-stone chamber, only 2.5 by 1.5 metres inside. Its low western opening admits a person crawling, rather than walking upright.', 'The corbelled roof shown here is a reconstruction. Archaeological accounts record rebuilding; its exact condition in January 1901 is uncertain.', 'Martin Martin’s account, published in 1703, describes prayers made by visiting Lewismen. The chapel’s date and the identity of its saint remain uncertain.' ] },
	bothies: { title: 'The bothies at Tom na Geodha', body: [ 'Low chambers, narrow passages and inward-stepping stone roofs: shelters associated with the island’s fowlers. The larger building has a central chamber, western cell and eastern entrance passage; the smaller may have served as a store.', 'Later archaeological surveys record these layouts, a small hearth and storage recesses. Early records disagree about roof condition. The partial roofs and fallen stones shown here are a reconstruction of uncertain January 1901 condition.', 'The traditional name is the Bothies of the Clan MacPhail. A monastic origin has been suggested, but is not established by the surviving evidence.' ] },
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
