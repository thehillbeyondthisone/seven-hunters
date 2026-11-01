import { Vector3 } from '../../engine/math/index.js';

// Two clear working bays, away from the door swing and the signal-lamp tripod.
// Shared by physical fittings, interaction eligibility, guidance and debug views.
export const GALLERY_WATCH_BAYS = [
	{ id: 'eastWatchBay', label: 'East lookout rail', angle: .78, seaBearing: .2, radius: 3.2, size: 1.35 },
	{ id: 'westWatchBay', label: 'West lookout rail', angle: Math.PI + .32, seaBearing: Math.PI + .32, radius: 3.2, size: 1.35 },
];

export function galleryBayPosition( bay, deck, height = 0, radius = bay.radius ) {
	return new Vector3( Math.cos( bay.angle ) * radius, deck + height, Math.sin( bay.angle ) * radius );
}

export function galleryBayAt( position, deck ) {
	if ( Math.abs( position.y - deck ) > .55 ) return null;
	return GALLERY_WATCH_BAYS.find( bay => Math.hypot( position.x - Math.cos( bay.angle ) * bay.radius, position.z - Math.sin( bay.angle ) * bay.radius ) <= bay.size ) || null;
}

export function nearestGalleryBay( position ) {
	return GALLERY_WATCH_BAYS.reduce( ( nearest, bay ) => {
		const distance = b => Math.hypot( position.x - Math.cos( b.angle ) * b.radius, position.z - Math.sin( b.angle ) * b.radius );
		return distance( bay ) < distance( nearest ) ? bay : nearest;
	} );
}
