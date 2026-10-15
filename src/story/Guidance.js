import { Vector3 } from '../engine/math/index.js';
import { STATION, TOWER, ROOM } from '../world/flannan/Station.js';
import { KITCHEN, BERTH } from '../world/flannan/NextRooms.js';
import { WARN } from '../station/Lamp.js';

const view = new Vector3();

// Work in camera space before projection: a target behind the player must never
// become an apparently visible diamond through perspective division.
export function projectGuidance( at, camera, width, height, insets = {} ) {

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
	const left=Math.min(width*.4,insets.left??padX),right=Math.min(width*.4,insets.right??padX);
	const minX=left-width/2,maxX=width/2-right;
	const top = Math.min( height * .4, insets.top ?? padY ), bottom = Math.min( height * .4, insets.bottom ?? padY );
	const minY=top-height/2,maxY=height/2-bottom;
	const onScreen = view.z < - 0.05 && dx>minX && dx<maxX && dy > minY && dy < maxY;
	if ( ! onScreen ) {

		// Directly behind: the bottom edge asks you to turn around. Otherwise use
		// the target's actual left/right bearing, including on portrait screens.
		if ( view.z >= - 0.05 && Math.abs( dx ) < 0.5 && Math.abs( dy ) < 0.5 ) dy = height;
		const scale = Math.min( (dx<0?-minX:maxX) / Math.max( Math.abs( dx ), 0.001 ), (dy<0?-minY:maxY) / Math.max( Math.abs( dy ), 0.001 ) );
		dx *= scale;
		dy *= scale;
			dx = Math.max(minX,Math.min(maxX,dx));
		dy = Math.max( top - height / 2, Math.min( height / 2 - bottom, dy ) );

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
	if ( up ) return marker( v( Math.cos( T.start + .18 ) * 1.35, T.floor + 1, Math.sin( T.start + .18 ) * 1.35 ), 'Climb to the lantern · E', 'towerUp' );
	return marker( v( Math.cos( H.angle ) * H.r - Math.sin( H.angle ) * ( H.run + .15 ), T.deck + 1.1,
		Math.sin( H.angle ) * H.r + Math.cos( H.angle ) * ( H.run + .15 ) ), 'Descend to the keeper’s room · E', 'towerDown' );

}

// Route across the real thresholds rather than pointing at a desk through the
// tower floor. These are directions, not new story triggers or navigation locks.
export function routeGuidance( p, target, zone ) {

	const r = Math.hypot( p.x, p.z );
	const inRoom = p.x > ROOM.x0 && p.x < ROOM.x1 + 0.4 && p.z > ROOM.z0 && p.z < ROOM.z1 && r > TOWER.rIn;
	const above = p.y > TOWER.floor + 0.65 && r < 4.2;
	const inside = room => p.x>room.x0&&p.x<room.x1&&p.z>room.z0&&p.z<room.z1&&Math.abs(p.y-TOWER.floor)<1;
	const kitchen=inside(KITCHEN),berth=inside(BERTH);
	if(berth&&(target.at.z<10.8||zone!=='room'))return marker(BERTH.door,'Berth door · E','berthDoor');
	if(kitchen&&zone==='room'&&target.at.z>10.8)return marker(BERTH.door,'Berth door · E','berthDoor');
	if((kitchen||berth)&&(target.at.z<5.4||zone!=='room'))return marker(KITCHEN.door,'Keepers’ room · E','kitchenDoor');
	if(inRoom&&zone==='room'&&target.at.z>5.4)return marker(KITCHEN.door,'Kitchen door · E','kitchenDoor');
	if(!inRoom&&!kitchen&&!berth&&!above&&r>TOWER.rIn){
		const E=STATION.eastGate,C=STATION.compound;
		if(zone!=='yard'&&p.x>E.x+1)return marker(v(E.x+1.5,STATION.yard+1,E.z),'East gate · E','eastReturnGate');
		if(zone==='yard'&&p.x>C.x0&&p.x<C.x1&&p.z>C.z0&&p.z<C.z1){
			if(target.at.x>E.x)return marker(v(E.x-.25,STATION.yard+1,E.z),'East gate · E','eastExitGate');
			if(target.at.x<C.x0)return marker(v(STATION.southGate.x,STATION.yard+1,STATION.southGate.z-.25),'South gate · E','southExitGate');
		}
	}
	if ( zone === 'weight' ) {
		if ( p.y >= TOWER.deck - .3 ) {
			if ( r > 2.35 ) return galleryDoor();
			const H = TOWER.hatch;
			return marker( v( Math.cos( H.angle ) * H.r - Math.sin( H.angle ) * H.run, TOWER.deck + .3, Math.sin( H.angle ) * H.r + Math.cos( H.angle ) * H.run ), 'Down to the driving weight', 'hatch' );
		}
		if ( r > TOWER.rIn + .12 ) return inRoom ? towerDoor() : houseDoor();
		return Math.abs( p.y + 1.55 - target.at.y ) > 1.35 ? stair( p, p.y + 1.55 < target.at.y ) : target;
	}
	if ( zone === 'room' || zone === 'yard' ) {

		if ( above ) {

			if ( p.y >= TOWER.deck - 0.3 ) {

				if ( r > 2.35 ) return galleryDoor();
				return stair( p, false );

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
	if ( b === 'intro' || b === 'crossing' || b === 'end' || s.signal || s.tel > 0.6 || s.paused || s.ui.open || s.app.devMenu?.open || s.app.freeCam || s.app.ui?.ui?.photoMode || s.app.settings.guidance === false ) return null;
	if ( s.app.keeperSafety?.active && s.app.keeperSafety?.state !== 'normal' ) return s.app.keeperSafety.guidance();
	if ( s.storm?.active ) return s.storm.guidance();
	if ( s.returningLight?.active ) return s.returningLight.guidance();
	if ( s.morning?.enabled ) return s.morning.guidance();
	if ( s.next?.active ) return s.next.guidance();
	const keeper = s.keeper?.guidance();
	if ( keeper ) return routeGuidance( p, marker( keeper.at, keeper.label, 'keeperDuty' ), keeper.zone );
	let target, zone;
	const item = ( id, label, region ) => {

		const it = s.interact.get( id );
		if ( ! it ) return;
		target = marker( ( typeof it.at === 'function' ? it.at() : it.at ).clone(), label, id );
		zone = region;

	};
	if ( L.lit && ( L.wind <= 0 || L.running && L.wind < WARN ) ) item( 'crank', 'Wind the machine · hold E', 'lantern' );
	else if ( b === 'gate' ) item( 'gate', 'See to the gate · E', 'yard' );
	else if ( s._obsDue() && b !== 'dawn' && b !== 'journal' ) {
		const weather = s.weatherObservations?.guidance();
		if ( weather ) return routeGuidance( p, marker( weather.at, weather.label, weather.id ), weather.zone );
		item( 'slate', 'Observations · E', 'room' );
	}
	else if ( [ 'calling', 'waiting' ].includes( W.state ) || W.state === 'steady' && L.lit ) item( s.hasTelescope ? 'signal' : 'telescope', s.hasTelescope ? 'Signal lamp · E' : 'Take the telescope · E', s.hasTelescope ? 'gallery' : 'lantern' );
	else if ( s.unpacking?.pending ) { target = s.unpacking.guidance(); zone = 'room'; }
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
