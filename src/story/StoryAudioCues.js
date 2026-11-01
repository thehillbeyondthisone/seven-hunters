import { RevealMusic } from '../audio/RevealMusic.js';

// Deliberately unassigned: the user is supplying these recordings. A cue hook
// must not fetch a guessed file, substitute an unrelated score, or play at smoke.
export const STORY_CUES = {
	'paper': { files: [], gain: .24, duration: 2, fadeIn: .02, fadeOut: .2 },
	'gate-discovery': { file: null, gain: .4, duration: 5, fadeIn: .1, fadeOut: 1 },
	'relief-delay': { file: null, gain: .4, duration: 7, fadeIn: .1, fadeOut: 2 },
	'morning-preparation': { file: null, gain: .32, duration: 90, fadeIn: 2, fadeOut: 4 },
};

export class StoryAudioCues {
	constructor( story, cues = STORY_CUES ) { this.s = story; this.cues = cues; this.voices = []; this.last = {}; }
	play( name ) {
		const cue = this.cues[ name ];
		if ( ! cue ) return false;
		const files = cue.files?.filter( Boolean );
		const candidates = files?.filter( file => file !== this.last[ name ] );
		const choices = candidates?.length ? candidates : files;
		const file = choices?.length ? choices[ Math.floor( Math.random() * choices.length ) ] : cue.file;
		if ( ! file ) return false;
		this.last[ name ] = file;
		const music = new RevealMusic( () => this.s.app.audio, { ...cue, file, delay: 0, offset: 0 } );
		this.voices.push( { music, elapsed: 0 } );
		return true;
	}
	update( dt, paused ) {
		for ( const voice of this.voices ) {
			if ( ! paused ) voice.elapsed += Math.max( 0, Math.min( dt, 1 ) );
			voice.music.update( voice.elapsed, paused );
		}
		this.voices = this.voices.filter( voice => { if ( voice.elapsed < voice.music.end ) return true; voice.music.stop(); return false; } );
	}
	stop() { for ( const voice of this.voices ) voice.music.stop(); this.voices = []; }
}
