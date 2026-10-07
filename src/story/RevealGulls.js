import { BIRD } from '../world/wildlife/BirdShapes.js';
import { createPose, flapWings, tuckLegs, storePrevious, resetPrevious } from '../world/wildlife/BirdPose.js';
import { FLIGHT } from '../world/wildlife/Flight.js';
import { qYawPitchRoll } from '../world/wildlife/Kit.js';
import { BirdBatch } from '../world/wildlife/BirdBatch.js';

// Three gulls share the existing wildlife draw and articulation. Their crossing
// is timed to the look back, well beyond the cliff edge and above the viewer.
export class RevealGulls {
	constructor( { scene = null, csm = null } = {} ) {
		this.poses = [ 0, 1, 2 ].map( i => {
			const p = createPose( BIRD.GULL, .21 + i * .23 ); p.scale = 1.25; return p;
		} );
		this.elapsed = 0; this.origin = null; this.dir = null;
		this.batch = scene ? new BirdBatch( { csm } ) : null;
		if ( this.batch ) { this.batch.mesh.name = 'hilltop-gulls'; this.batch.mesh.visible = false; scene.add( this.batch.mesh ); }
	}

	update() {
		if ( ! this.batch ) return;
		this.batch.mesh.visible = !! this.origin && this.elapsed >= 6 && this.elapsed <= 24;
		this.batch.begin(); this.draw( this.batch ); this.batch.commit();
	}

	begin( eye, dir, elapsed = 0 ) {
		this.origin = eye.slice(); this.dir = dir.slice(); this.elapsed = elapsed;
		this.poses.forEach( p => { p.fresh = true; } );
	}

	point( elapsed, i = 0 ) {
		const [ dx, dz ] = this.dir, o = this.origin;
		// A closer, oblique pass gives the wings a readable silhouette. The flock
		// follows the same authored clock as the camera (~9m/s at 1x, ~6.6m/s at 0.75x).
		const across = ( elapsed - 10.5 ) * 8.4 - i * 3.6, out = 14 + i * 2.6 + ( elapsed - 10.5 ) * 2.6;
		return [ o[ 0 ] + dx * out - dz * across, o[ 1 ] + 5.5 + i * 1.2 + Math.sin( elapsed * .6 + i ) * .5,
			o[ 2 ] + dz * out + dx * across ];
	}

	draw( batch ) {
		if ( ! this.origin || this.elapsed < 6 || this.elapsed > 24 ) return;
		const cfg = FLIGHT[ BIRD.GULL ], t = this.elapsed;
		for ( let i = 0; i < this.poses.length; i ++ ) {
			const p = this.poses[ i ]; storePrevious( p );
			p.pos = this.point( t, i );
			const [ dx, dz ] = this.dir;
			qYawPitchRoll( p.q, Math.atan2( dx * 2.6 - dz * 8.4, dz * 2.6 + dx * 8.4 ), .025, .45 + Math.sin( t * .5 + i ) * .12 );
			// A short flap bout at the start of the pass, then a settled glide.
			const amp = t > 7 + i * .2 && t < 8.5 + i * .2 ? .32 : .06;
			flapWings( p, cfg.glide, t * cfg.freq * Math.PI * 2 + i * 1.7, amp ); tuckLegs( p );
			if ( p.fresh ) resetPrevious( p );
			batch.write( p );
		}
	}
}
