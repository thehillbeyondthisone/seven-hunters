import { brownieCraft } from './KeeperCraft.js';
import { unpackingCraft } from './UnpackingCraft.js';
import { Vector3 } from '../../engine/index.js';
import { Builder } from '../village/GeoBuilder.js';

// Authored personal belongings. The Brownie follows the original 1900 box's
// 3 x 3 x 5 inch proportions, rather than a later model with integral finders.
export function unpackingProps( floor, room ) {
	const F = floor, builders = {};
	const make = ( name, x, y, z, draw, ry = 0 ) => {
		const B = new Builder(); B.pushAt( x, y, z, ry ); draw( B ); B.pop(); builders[ name ] = B;
	};
	const bag = new Vector3( -.8, F + .28, 4.99 );
	make( 'closed', -.8, F, 5.07, B => unpackingCraft( B, 'closed' ) );
	make( 'open', -.8, F, 5.07, B => unpackingCraft( B, 'open' ) );
	const clothes = B => unpackingCraft( B, 'clothes' );
	make( 'packedClothes', -1.01, F + .115, 5.045, clothes );
	make( 'laidClothes', -4.7, F + .475, 2.55, clothes, -.2 );
	make( 'parcel', -.64, F + .12, 5.03, B => unpackingCraft( B, 'parcel' ) );
	make( 'wrapper', -.61, F + .165, 5.03, B => unpackingCraft( B, 'wrapper' ) );
	const camera = B => brownieCraft(B);
	make( 'brownieInBag', -.64, F + .18, 5.03, camera, -.12 );
	const desk = new Vector3( -5.99, F + .76, room.z0 + .61 );
	make( 'brownieOnDesk', desk.x, desk.y, desk.z, camera, -.18 );
	make( 'cameraNote', desk.x - .04, desk.y + .002, desk.z + .055, B => unpackingCraft( B, 'note' ), -.12 );
	return { builders, bag, parcel: new Vector3( -.64, F + .25, 5.03 ), desk: desk.clone().add( new Vector3( 0, .038, 0 ) ) };
}
