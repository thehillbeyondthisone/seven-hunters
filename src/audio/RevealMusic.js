// User-selected hilltop score, routed through the existing island audio master.
// A null file still disables music and leaves the live island ambience audible.
export const ISLAND_REVEAL_MUSIC = { file: 'the-three-note-reach.mp3', gain: 0.6, fadeIn: 2.5, fadeOut: 4, duration: 45, offset: 0, delay: 0 };

export class RevealMusic {

	constructor( scape, cue = ISLAND_REVEAL_MUSIC ) {
		this.scape = scape; this.cue = { ...cue }; this.buffer = null; this.loading = false; this.failed = false;
		this.source = null; this.gain = null;
	}

	get end() {
		if ( ! this.cue.file || this.failed ) return 0;
		const available = this.buffer ? this.buffer.duration - ( this.cue.offset || 0 ) : this.cue.duration;
		return ( this.cue.delay || 0 ) + Math.max( 0, Math.min( this.cue.duration, available ) );
	}

	update( elapsed, paused ) {
		const s = this.scape(), c = s?.ctx, cue = this.cue;
		if ( ! cue.file || ! c || ! s.master ) return;
		if ( ! this.loading ) {
			this.loading = true;
			const base = import.meta.env?.BASE_URL || './';
			fetch( `${ base }audio/${ cue.file }` ).then( r => { if ( ! r.ok ) throw new Error( 'Cue unavailable' ); return r.arrayBuffer(); } )
				.then( a => c.decodeAudioData( a ) ).then( b => { this.buffer = b; } ).catch( () => { this.failed = true; } );
		}
		if ( paused || c.state !== 'running' ) { this.stop(); return; }
		const playTime = elapsed - ( cue.delay || 0 );
		if ( ! this.buffer ) return;
		if ( playTime < 0 || elapsed >= this.end ) { this.stop(); return; }
		if ( ! this.source ) {
			this.source = c.createBufferSource(); this.source.buffer = this.buffer;
			this.gain = c.createGain(); this.gain.gain.value = 0;
			this.source.connect( this.gain ).connect( s.master ); // shares volume, mute and limiter
			this.source.start( c.currentTime, ( cue.offset || 0 ) + playTime );
		}
		const envelope = Math.min( 1, cue.fadeIn > 0 ? playTime / cue.fadeIn : 1, cue.fadeOut > 0 ? ( this.end - elapsed ) / cue.fadeOut : 1 );
		this.gain.gain.setTargetAtTime( cue.gain * Math.max( 0, envelope ), c.currentTime, 0.06 );
	}

	stop() {
		if ( ! this.source ) return;
		const src = this.source, gn = this.gain, c = this.scape()?.ctx;
		if ( c ) {
			gn.gain.cancelScheduledValues( c.currentTime );
			gn.gain.setTargetAtTime( 0, c.currentTime, 0.03 );
			src.stop( c.currentTime + 0.15 );
		} else src.stop();
		src.onended = () => { src.disconnect(); gn.disconnect(); };
		this.source = this.gain = null;
	}

}
