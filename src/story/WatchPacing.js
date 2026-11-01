import { TOWER } from '../world/flannan/Station.js';

// Watch compression is a gameplay choice. This is not evidence for a historical
// winding interval. Required work away from the lantern never spends the weight.
export function upkeepHours( story, hours ) {

	if ( hours <= 0 ) return 0;
	if ( story.signal || story.watcher?.talking || story.guidedSignal?.active || story.cinematic || story.ui?.open ) return 0;
	const p = story.app?.player?.position;
	if ( ! p || p.y < TOWER.deck - .5 || Math.hypot( p.x, p.z ) > 5 ) return 0;
	return hours;

}
