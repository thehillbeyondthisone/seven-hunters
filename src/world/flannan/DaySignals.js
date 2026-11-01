import { Vector3 } from '../../engine/math/index.js';
import { lin, HARD, WOOD } from '../Props.js';

// Muirhead's 8 January 1901 report describes balls or discs displayed on poles
// projecting from either side of the balcony to request mainland assistance:
// https://www.nlb.org.uk/history/flannan-isles/
// This is assistance equipment, never a daily 'all well' signal or an automatic
// reply. Pole angles, dimensions, disc construction, fittings and stowage below
// the rail are restrained reconstruction; no surviving engineering plan is claimed.
export const DAY_SIGNALS = Object.freeze( {
	angles: Object.freeze( [ -1.45, 1.45 ] ),
	mountRadius: 3.82, tipRadius: 5.1, tipHeight: 2.25,
	discRadius: .34, discHeight: .57,
	state: 'stowed', purpose: 'assistance',
	source: 'https://www.nlb.org.uk/history/flannan-isles/',
} );

export function buildDaySignals( B, tower ) {
	const S = DAY_SIGNALS, deck = tower.deck;
	const pole = { tint: lin( 0x536151 ), data: WOOD( .63, .025, 1 ) };
	const dark = { tint: lin( 0x29312e ), data: WOOD( .59, .02, 1 ) };
	const iron = { tint: lin( 0x3c4441 ), data: HARD( .47, -1, 0, .57 ) };
	const rope = { tint: lin( 0x9d957e ), data: HARD( .6, 0, 0, .92 ) };
	for ( const angle of S.angles ) {
		const c = Math.cos( angle ), s = Math.sin( angle );
		const at = ( r, y, side = 0 ) => [ c * r - s * side, deck + y, s * r + c * side ];
		// Project above and beyond the outer rail, leaving the entire walking lane
		// and observation bays clear. They add no locomotion colliders or textures.
		B.rod( 'stationTimber', at( S.mountRadius, .49 ), at( S.tipRadius, S.tipHeight ), .04, .025, { segs: 12, capBot: true, ...pole } );
		B.rod( 'hard', at( S.mountRadius - .025, .46 ), at( S.mountRadius + .19, .8 ), .048, .048, { segs: 12, capBot: true, ...iron } );
		for ( const y of [ .52, .97 ] ) {
			B.rod( 'hard', at( tower.gallery.rail, y ), at( S.mountRadius + .065, y ), .027, .027, { segs: 10, ...iron } );
			B.rod( 'hard', at( S.mountRadius, y, -.08 ), at( S.mountRadius, y, .08 ), .012, .012, { segs: 8, ...iron } );
		}
		// The empty halyard is made fast. The dark disc is tied beneath the rail;
		// no shape is hoisted into the assistance position in an ordinary watch.
		for ( const side of [ -.032, .032 ] ) B.rod( 'hard', at( S.mountRadius + .1, .75, side ), at( S.tipRadius - .045, S.tipHeight - .035, side ), .0045, .0045, { segs: 5, ...rope } );
		const d = at( S.mountRadius + .04, S.discHeight );
		B.cyl( 'stationTimber', ...d, S.discRadius, S.discRadius, .022, { rx: Math.PI / 2, ry: Math.PI / 2 - angle, segs: 48, capBot: true, ...dark } );
		for ( const side of [ -.2, .2 ] ) B.rod( 'hard', at( S.mountRadius + .069, .35, side ), at( S.mountRadius + .069, .79, side ), .007, .007, { segs: 6, ...rope } );
		B.rod( 'hard', at( S.mountRadius, .22 ), at( S.mountRadius + .12, .22 ), .016, .016, { segs: 8, ...iron } );
	}
	const inspectAngle = S.angles[ 1 ], inspectRadius = tower.gallery.rail - .06;
	return {
		at: new Vector3( Math.cos( inspectAngle ) * inspectRadius, deck + .8, Math.sin( inspectAngle ) * inspectRadius ),
		state: S.state, purpose: S.purpose, source: S.source,
	};
}
