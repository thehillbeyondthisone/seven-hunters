import { Vector3 } from '../engine/math/index.js';
import { STATION, TOWER, ROOM } from '../world/flannan/Station.js';
import { WARN } from '../station/Lamp.js';

const view = new Vector3();

// Work in camera space before projection: a target behind the player must never
// become an apparently visible diamond through perspective division.
export function projectGuidance( at, camera, width, height ) {

	if ( ! at || width < 1 || height < 1 ) return null;
	camera.updateMatrixWorld();
	view.copy( at ).applyMatrix4( camera.matrixWorldInverse );
	const distance = view.length();
	if ( distance < 0.1 ) return null;
	const e = camera.projectionMatrix.elements;
	const depth = Math.max( Math.abs( view.z ), 0.05 );
	let dx = view.x * e[ 0 ] / depth * width / 2;
	let dy = - view.y * e[ 5 ] / depth * height / 2;
	const padX = Math.min( 44, width * 0.12 ), padY = Math.min( 86, height * 0.22 );
	const rx = width / 2 - padX, ry = height / 2 - padY;
	const onScreen = view.z < - 0.05 && Math.abs( dx ) < rx && Math.abs( dy ) < ry;
	if ( ! onScreen ) {

		// Directly behind: the bottom edge asks you to turn around. Otherwise use
		// the target's actual left/right bearing, including on portrait screens.
		if ( view.z >= - 0.05 && Math.abs( dx ) < 0.5 && Math.abs( dy ) < 0.5 ) dy = height;
		const scale = Math.min( rx / Math.max( Math.abs( dx ), 0.001 ), ry / Math.max( Math.abs( dy ), 0.001 ) );
		dx *= scale;
		dy *= scale;

	}
	return { x: width / 2 + dx, y: height / 2 + dy, onScreen, distance, angle: Math.atan2( dy, dx ) * 180 / Math.PI + 90 };

}

const marker = ( at, label, id ) => ( { at, label, id } );
const v = ( x, y, z ) => new Vector3( x, y, z );
const towerDoor = () => marker( v( Math.cos( TOWER.doorAngle ) * 2.6, TOWER.floor + 1, Math.sin( TOWER.doorAngle ) * 2.6 ), 'Tower stair', 'towerDoor' );
const houseDoor = () => marker( v( ROOM.door.x - 0.15, TOWER.floor + 1.1, ROOM.door.z ), 'Keepers’ room door', 'houseDoor' );
const galleryDoor = () => marker( v( Math.cos( TOWER.galleryDoor ) * 2.28, TOWER.deck + 1, Math.sin( TOWER.galleryDoor ) * 2.28 ), 'Balcony door', 'galleryDoor' );

function stair( p, up ) {

	const T = TOWER, H = T.hatch;
	if ( p.y >= T.landing + ( up ? - 0.25 : 0.2 ) ) {

		const s = up ? H.run : 0, r = H.r;
		return marker( v( Math.cos( H.angle ) * r - Math.sin( H.angle ) * s, ( up ? T.deck : T.landing ) + 0.6, Math.sin( H.angle ) * r + Math.cos( H.angle ) * s ), up ? 'Up into the lantern' : 'Down the stair', 'hatch' );

	}
	const i = Math.max( 0, Math.min( T.count - 1, Math.floor( ( p.y - T.floor ) / T.riser ) + ( up ? 4 : - 4 ) ) );
	const a = T.start + ( i + 0.5 ) * T.dTread;
	return marker( v( Math.cos( a ) * 1.6, T.floor + ( i + 1 ) * T.riser + 0.55, Math.sin( a ) * 1.6 ), up ? 'Up the tower stair' : 'Down the tower stair', 'stair' );

}

// Route across the real thresholds rather than pointing at a desk through the
// tower floor. These are directions, not new story triggers or navigation locks.
export function routeGuidance( p, target, zone ) {

	const r = Math.hypot( p.x, p.z );
	const inRoom = p.x > ROOM.x0 && p.x < ROOM.x1 + 0.4 && p.z > ROOM.z0 && p.z < ROOM.z1 && r > TOWER.rIn;
	const above = p.y > TOWER.floor + 0.65 && r < 4.2;
	if ( zone === 'room' || zone === 'yard' ) {

		if ( above ) {

			if ( p.y >= TOWER.deck - 0.3 ) {

				if ( r > 2.35 ) return galleryDoor();
				const H = TOWER.hatch;
				return marker( v( Math.cos( H.angle ) * H.r - Math.sin( H.angle ) * H.run, TOWER.deck + 0.3, Math.sin( H.angle ) * H.r + Math.cos( H.angle ) * H.run ), 'Down to the keepers’ room', 'hatch' );

			}
			return stair( p, false );

		}
		if ( r < TOWER.rIn && p.distanceTo( towerDoor().at ) > 1.6 ) return towerDoor();
		if ( zone === 'room' ) return inRoom || r < TOWER.rIn ? target : houseDoor();
		return inRoom || r < TOWER.rIn ? houseDoor() : target;

	}
	if ( p.y < TOWER.deck - 0.3 ) {

		if ( r < TOWER.rIn + 0.12 ) return stair( p, true );
		return inRoom ? towerDoor() : houseDoor();

	}
	if ( zone === 'gallery' && r < 2.35 || zone === 'lantern' && r > 2.35 ) return galleryDoor();
	return target;

}

export function storyGuidance( story ) {

	const s = story, p = s.app.player.position, L = s.lamp, W = s.watcher, b = s.beat;
	if ( b === 'intro' || b === 'crossing' || b === 'end' || s.signal || s.tel > 0.6 || s.paused || s.ui.open || s.app.freeCam || s.app.ui?.ui?.photoMode || s.app.settings.guidance === false ) return null;
	let target, zone;
	const item = ( id, label, region ) => {

		const it = s.interact.get( id );
		if ( ! it ) return;
		target = marker( ( typeof it.at === 'function' ? it.at() : it.at ).clone(), label, id );
		zone = region;

	};
	if ( L.lit && ( L.wind <= 0 || L.running && L.wind < WARN ) ) item( 'crank', 'Wind the machine · hold E', 'lantern' );
	else if ( b === 'gate' ) item( 'gate', 'See to the gate · E', 'yard' );
	else if ( s._obsDue() && b !== 'dawn' && b !== 'journal' ) item( 'slate', 'Observations · E', 'room' );
	else if ( [ 'calling', 'waiting' ].includes( W.state ) || W.state === 'steady' && L.lit ) item( s.hasTelescope ? 'signal' : 'telescope', s.hasTelescope ? 'Signal lamp · E' : 'Take the telescope · E', s.hasTelescope ? 'gallery' : 'lantern' );
	else if ( b === 'climb' ) { target = marker( v( STATION.eastGate.x - 0.25, STATION.yard + 0.8, STATION.eastGate.z ), 'Light station', 'station' ); zone = 'yard'; }
	else if ( b === 'room' ) { target = houseDoor(); zone = 'room'; }
	else if ( b === 'letter' ) item( 'letter', 'Board’s letter · E', 'room' );
	else if ( b === 'light' || b === 'dawn' ) item( 'lens', b === 'dawn' ? 'Lamp · hold E' : 'Light the lamp · hold E', 'lantern' );
	else if ( b === 'machine' ) item( 'crank', 'Wind the machine · hold E', 'lantern' );
	else if ( b === 'journal' ) item( 'journal', 'Write the journal · E', 'room' );
	else if ( b === 'haar' ) {

		// Never mark the unexplained light: simply get the keeper onto the balcony.
		if ( p.y >= TOWER.deck - 0.3 && rOnBalcony( p ) ) return null;
		target = galleryDoor(); zone = 'gallery';

	} else if ( s._watchText() ) item( p.y > TOWER.floor + 1 ? 'stool' : 'chair', 'Keep the watch · E', p.y > TOWER.floor + 1 ? 'lantern' : 'room' );
	return target ? routeGuidance( p, target, zone ) : null;

}

function rOnBalcony( p ) { return Math.hypot( p.x, p.z ) > 2.35; }
