// These are authored fictional incidents, with fixed dates and causality.
// The plot/evidence contract is in docs/STORY-CONTINUATION.md.
// Gaelic phrases: LearnGaelic's Little by Little greetings/phrasebook.
// Keep each routine transmission within 15 words. Short acknowledgements and farewells are
// allowed to be shorter than five. IDs, option order, wire groups and evidence flags stay stable.
export const NOTES = {
	crate: { title: 'The stores from home', body: [
		'Tea. Sugar. A loaf wrapped in linen. The thick stockings Mary said she had packed.',
		'Beneath them, a note for the daylight round: follow the west tramway to the upper hauling shed. Inspect the brake and retaining chain. Stay above the landing stairs.',
		'Two groups are marked in the signal book: 1, LIGHT SEEN. 4, ALL WELL. K asks for an answer. Other messages must be spelled out.',
	] },
	breakfast: { title: 'The kitchen', body: [ 'The stove draws. The kettle begins to tremble.', 'Tea and bread at the table. Daylight in the window. You leave your cup where you can reach it.' ] },
	survey: { title: 'The upper hauling shed', body: [ 'The brake holds. The loose retaining chain rests beside the windlass.', 'Before the wind rises, loop the chain through the brake wheel and pin it to the iron eye. For now the machinery is still.', 'From the doorway, you can see the station beyond the folds of ground.' ] },
	bank: { title: 'Before you go out', body: [ 'You close the stove damper and rake ash over the coals. Their colour dulls.', 'The kitchen lamp stays on. You leave the kettle beside the range.' ] },
	embers: { title: 'The stove', body: [ 'The damper is where you left it. A little red shows beneath the ash.', 'A gust at the chimney draws a thread of smoke from the coals. The kettle is still warm.' ] },
	bed: { title: 'Your berth', body: [ 'Your bag at the foot of the bed. The folded letter in your coat.', 'Through the wall, the machine turns with a low, even sound.' ] },
};

const reply = ( text, next, minutes = 2, extra = {} ) => ( { text, next, minutes, ...extra } );
export const EVENING_TWO = {
	start: 'light', nodes: {
		light: { her: 'LIGHT SEEN. K', wire: '1 K', options: [ reply( 'ALL WELL.', 'kitchen', 1, { code: 4, wire: '4' } ) ] },
		kitchen: { her: 'HOW DOES THE STOVE DRAW', options: [ reply( 'WELL. TEA AND BREAD.', 'home' ), reply( 'BETTER THAN THE BOAT.', 'home' ) ] },
		home: { her: 'PUT THAT IN YOUR LETTER HOME. THEY WILL BE GLAD OF IT.', options: [ reply( 'MY SISTER ASKED THE SAME.', 'sleep' ), reply( 'I WILL.', 'sleep' ) ] },
		sleep: { her: 'WIND FULL BEFORE RESTING. TWO HOURS, THEN BACK TO THE MACHINE.', options: [ reply( 'I WILL. MIND YOURSELF TOO.', 'thanks' ), reply( 'YOU NEED REST AS WELL.', 'thanks' ) ] },
		thanks: { her: 'TAPADH LEAT', language: 'Gaelic', translation: 'Thank you.', options: [ reply( 'GOOD NIGHT CATE.', 'end' ) ] },
		end: { her: 'OIDHCHE MHATH', language: 'Gaelic', translation: 'Good night.', end: true },
	},
};

export const EVENING_THREE = {
	start: 'question', nodes: {
		question: { her: 'WERE YOU CALLING LAST NIGHT', options: [ reply( 'WHEN', 'time' ) ] },
		time: { her: 'AFTER TWO. A SMALL LIGHT BESIDE THE TOWER. I THOUGHT IT WAS YOURS.', options: [ reply( 'I WAS ASLEEP.', 'rest' ), reply( 'WHAT DID YOU SEE', 'detail' ), reply( 'NOTHING URGENT.', 'weather', 2, { flag: 'keptSleepQuiet' } ) ] },
		detail: { her: 'IT CAME AND WENT. I WAITED FOR A MESSAGE.', options: [ reply( 'I WAS ASLEEP THEN.', 'rest' ), reply( 'PERHAPS THE MAIN LIGHT.', 'rest' ) ] },
		rest: { her: 'I MAY HAVE MISTAKEN IT. YOU NEEDED YOUR REST.', options: [ reply( 'YES.', 'weather' ), reply( 'THE LANTERN WAS DOWNSTAIRS.', 'weather' ) ] },
		weather: { her: 'WIND RISING. SEE TO THE UPPER HAULING GEAR. STAY ABOVE THE LANDING STAIRS.', options: [ reply( 'BRAKE HOLDS. I WILL SECURE THE CHAIN.', 'end' ) ] },
		end: { her: 'GOOD NIGHT. KEEP HER LIT.', end: true },
	},
};

export const EVENING_FOUR = {
	start: 'clear', nodes: {
		clear: { her: 'LIGHT SEEN. K', wire: '1 K', options: [ reply( 'COULD YOU SEE THE HOUSE LAST NIGHT', 'house' ) ] },
		house: { her: 'ONLY THE TOWER. WHY', options: [ reply( 'SMOKE FROM THE KITCHEN WHILE I WAS OUT.', 'smoke', 3, { flag: 'toldSmoke' } ), reply( 'JUST WONDERING.', 'quiet', 1, { flag: 'keptSmokeQuiet' } ) ] },
		smoke: { her: 'WAS THERE STILL COAL IN THE STOVE', options: [ reply( 'A LITTLE. UNDER ASH.', 'coal' ) ] },
		coal: { her: 'WIND CAN SET A CHIMNEY DRAWING. I COULD NOT SEE YOUR WINDOWS.', options: [ reply( 'THANK YOU.', 'stay' ), reply( 'I KNOW.', 'stay' ) ] },
		quiet: { her: 'I COULD NOT SEE THE LIGHT. I KEPT WATCH.', options: [ reply( 'GLAD YOU DID.', 'stay' ), reply( 'ALL WELL.', 'stay', 1, { code: 4, wire: '4' } ) ] },
		stay: { her: 'I AM HERE AGAIN TONIGHT.', options: [ reply( 'SO AM I.', 'end' ), reply( 'GOOD NIGHT CATE.', 'end' ) ] },
		end: { her: 'OIDHCHE MHATH', language: 'Gaelic', translation: 'Good night.', end: true },
	},
};
export const EPISODES = { 2: EVENING_TWO, 3: EVENING_THREE, 4: EVENING_FOUR };
