import { rowingPose } from '../story/ArrivalRowing.js';

// Recorded Foley shares the animation clock. Voices stay with the departing
// boat while wind and water continue around the listener.
export class ArrivalSound {
	constructor( soundscape ) {
		this.s = soundscape;
		this.lastTime = null;
		this.lastStrokeCycle = -1;
		this.creakTimer = 2;
		this.lastHeave = null;
	}
	update( dt, boat ) {
		const s = this.s;
		if ( ! boat?.visible || ! s.enabled ) { this.lastTime = null; this.lastHeave = null; this.lastStrokeCycle = -1; return; }
		const p = boat.position, e = s.env;
		const distance = Math.hypot( p.x-e.lx, p.y-e.ly, p.z-e.lz );
		if ( distance > 140 ) { this.lastTime = boat.rowingTime; return; }
		s._want( 'arrival_stroke' ); s._want( 'arrival_creak' );
		const time = boat.rowingTime, pose = rowingPose( time, boat.rowing );
		const previous = this.lastTime === null ? null : rowingPose( this.lastTime );
		if ( this.lastTime !== null && time < this.lastTime ) this.lastStrokeCycle = -1;
		const entry = boat.rowing && previous && time >= this.lastTime &&
			( pose.cycle > previous.cycle || ( previous.phase < 0.02 && pose.phase >= 0.02 ) );
		if ( entry && pose.cycle !== this.lastStrokeCycle ) {
			s._shotAt( 'arrival_stroke', 'arrivalStroke', p.x, p.y+0.8, p.z, -28, 0.98 + Math.random()*0.04, 0, 3, 1.25 );
			this.lastStrokeCycle = pose.cycle;
		}
		this.lastTime = time;
		this.creakTimer -= dt;
		const heave = this.lastHeave === null ? 0 : Math.abs( p.y-this.lastHeave ) / Math.max( dt, 0.001 );
		this.lastHeave = p.y;
		if ( this.creakTimer <= 0 && ( heave > 0.25 || boat.rowing ) && ! boat.paused ) {
			s._shotAt( 'arrival_creak', 'arrivalCreak', p.x, p.y+0.7, p.z, -39, 0.94 + Math.random()*0.1, 0, 2.5, 1.3 );
			this.creakTimer = 4 + Math.random()*5;
		}
	}
}
