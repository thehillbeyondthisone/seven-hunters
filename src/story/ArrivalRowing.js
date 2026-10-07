const TAU = Math.PI * 2;
export const ROWING_PERIOD = TAU / 1.7;
const ease = t => { t = Math.max( 0, Math.min( 1, t ) ); return t * t * ( 3 - 2 * t ); };

// One shared clock for blade entry, pull, lift, recovery and recorded Foley.
export function rowingPose( seconds, active = true ) {
	const cycle = Math.max( 0, seconds ) / ROWING_PERIOD;
	const phase = cycle - Math.floor( cycle );
	const pull = ease( ( phase - 0.06 ) / 0.5 );
	const recovery = ease( ( phase - 0.64 ) / 0.36 );
	const immersion = ease( phase / 0.06 ) * ( 1 - ease( ( phase - 0.56 ) / 0.08 ) );
	return { cycle: Math.floor( cycle ), phase, immersion: active ? immersion : 0,
		sweep: active ? -0.32 + 0.64 * pull - 0.64 * recovery : 0,
		lean: active ? Math.sin( ( pull - recovery ) * Math.PI ) * 0.055 : 0,
	};
}
