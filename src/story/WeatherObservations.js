import { Vector3, Matrix4, Ray, MathUtils } from '../engine/index.js';
import { G } from '../core/Globals.js';
import { STATION, TOWER, ROOM } from '../world/flannan/Station.js';
import { Beams, hazeTransmittance } from '../station/Beams.js';
import { pressureAt, temperatureAt, windReading, seaReading, landmarkReport, visibilityReading } from '../weather/WeatherReadings.js';

const FIELDS = [ [ 'pressure', 'Barometer' ], [ 'temperature', 'Thermometer' ], [ 'wind', 'Wind' ], [ 'sea', 'Sea' ], [ 'visibility', 'Visibility' ] ];
const NEAR = new Vector3( 164, 44.6, 540 );
const clock = h => `${ String( Math.floor( h % 24 ) ).padStart( 2, '0' ) }.${ String( Math.floor( ( h % 1 ) * 60 + 1e-6 ) ).padStart( 2, '0' ) }`;

// Test actual opaque station triangles, including the cupola and open doors.
// Called on capture (and cached during a sea hold), never for every distant pixel.
export function opaqueSegmentBlocked( meshes, origin, target ) {
	const inverse = new Matrix4(), a = new Vector3(), b = new Vector3(), dir = new Vector3(), ray = new Ray();
	for ( const mesh of meshes ) {
		if ( ! mesh.visible || ! mesh.geometry || /glass|lens|flame/i.test( mesh.material?.name || mesh.name || '' ) ) continue;
		let hidden = false;
		for ( let parent = mesh.parent; parent; parent = parent.parent ) if ( parent.visible === false ) { hidden = true; break; }
		if ( hidden ) continue;
		mesh.updateWorldMatrix?.( true, false );
		inverse.copy( mesh.matrixWorld ).invert();
		a.copy( origin ).applyMatrix4( inverse ); b.copy( target ).applyMatrix4( inverse );
		const distance = dir.subVectors( b, a ).length(); dir.normalize(); ray.set( a, dir );
		const geo = mesh.geometry;
		if ( ! geo.boundingBox ) geo.computeBoundingBox();
		if ( ! ray.intersectsBox( geo.boundingBox ) ) continue;
		const pos = geo.getAttribute( 'position' ), idx = geo.index, count = idx?.count ?? pos.count;
		for ( let i = 0; i < count; i += 3 ) {
			const ia = idx ? idx.getX( i ) : i, ib = idx ? idx.getX( i + 1 ) : i + 1, ic = idx ? idx.getX( i + 2 ) : i + 2;
			const ax = pos.getX( ia ), ay = pos.getY( ia ), az = pos.getZ( ia );
			const ex = pos.getX( ib ) - ax, ey = pos.getY( ib ) - ay, ez = pos.getZ( ib ) - az;
			const fx = pos.getX( ic ) - ax, fy = pos.getY( ic ) - ay, fz = pos.getZ( ic ) - az;
			const px = dir.y * fz - dir.z * fy, py = dir.z * fx - dir.x * fz, pz = dir.x * fy - dir.y * fx;
			const det = ex * px + ey * py + ez * pz;
			if ( Math.abs( det ) < 1e-9 ) continue;
			const tx = a.x - ax, ty = a.y - ay, tz = a.z - az;
			const u = ( tx * px + ty * py + tz * pz ) / det;
			if ( u < 0 || u > 1 ) continue;
			const qx = ty * ez - tz * ey, qy = tz * ex - tx * ez, qz = tx * ey - ty * ex;
			const v = ( dir.x * qx + dir.y * qy + dir.z * qz ) / det;
			if ( v < 0 || u + v > 1 ) continue;
			const t = ( fx * qx + fy * qy + fz * qz ) / det;
			if ( t > .04 && t < distance - .08 ) return true;
		}
	}
	return false;
}

export class SeaObservation {
	constructor( query ) {
		this.query = query;
		this.slot = query?.allocate( 'weather-observation', 9 );
		this.reset();
	}
	reset() { this.patch = null; this.elapsed = 0; this.heights = []; this.version = -1; this.versions = 0; }
	begin( patch ) {
		this.reset(); this.patch = patch.clone();
		for ( let i = 0; i < 9; i++ ) this.query?.setPoint( this.slot + i, patch.x + ( i % 3 - 1 ) * 25, patch.z + ( Math.floor( i / 3 ) - 1 ) * 25 );
	}
	step( dt, now ) {
		const q = this.query;
		if ( ! this.patch || this.slot === undefined || ! q?.cpuValid || ! Number.isFinite( q.resultTime ) || now - q.resultTime > .4 || q.resultTime > now + .01 ) return this.invalidate();
		const heights = [];
		for ( let i = 0; i < 9; i++ ) {
			const j = ( this.slot + i ) * 4, x = this.patch.x + ( i % 3 - 1 ) * 25, z = this.patch.z + ( Math.floor( i / 3 ) - 1 ) * 25;
			if ( ! [0,1,2,3].every( k => Number.isFinite(q.cpu[j+k]) ) || ! q.resultInputs || ! Number.isFinite( q.resultInputs[ j ] ) || ! Number.isFinite( q.resultInputs[ j + 1 ] ) || Math.hypot( q.resultInputs[ j ] - x, q.resultInputs[ j + 1 ] - z ) > .1 || q.cpu[ j + 3 ] > -5 ) return this.invalidate();
			heights.push( q.cpu[ j ] );
		}
		this.elapsed += Math.max( 0, Math.min( dt, .1 ) );
		if ( q.version !== this.version ) { this.heights.push( ...heights ); this.version = q.version; this.versions++; }
		return this.elapsed >= 4 - 1e-6 && this.versions >= 2 ? seaReading( this.heights ) : null;
	}
	invalidate() { this.elapsed = 0; this.heights = []; this.version = -1; this.versions = 0; return null; }
	get reading() { return this.elapsed >= 4 - 1e-6 && this.versions >= 2 ? seaReading( this.heights ) : null; }
}

export class WeatherObservations {
	constructor( story ) {
		this.s = story; this.app = story.app; this.focus = null;
		this.sampler = new SeaObservation( this.app.query || this.app.player.query );
		this.seaTarget = new Vector3(); this.seaHolding = false; this.seaCapturedHold = false;
		this.windStand = new Vector3( -23, STATION.yard + 1.2, -4.3 );
	}
	get due() { return this.s._obsDue(); }
	get drafts() { return this.s.flags.weatherObservations || {}; }
	get draft() { return this.drafts[ this.due ]; }
	get clockScale() {
		const active = [18,21].find( at => !this.s.obs[at] && this.s.h >= at-.1 && this.s.h < at+2.5 );
		return !this.s.next?.active && active && ( this.due || this.drafts[active] ) ? .4 : 1;
	}
	begin() {
		const at = this.due;
		if ( ! at ) return null;
		this.s.flags.weatherObservations ||= {};
		return this.s.flags.weatherObservations[ at ] ||= { startedAt: this.s.h, readings: {}, landmarks: {} };
	}
	available() {
		const s = this.s, a = this.app;
		return ! s.paused && ! a.freeCam && ! a.ui?.ui?.photoMode && ! a.mobile?.paused && ! a.devMenu?.open && ! globalThis.document?.hidden && ! s.signal && ! s.ui.open;
	}
	onBalcony() { const p = this.app.player.position, r = Math.hypot( p.x, p.z ); return Math.abs( p.y - TOWER.deck ) < .4 && r > 2.35 && r < 3.8; }
	onYard() { const p = this.app.player.position, c = STATION.compound; return Math.abs( p.y - STATION.yard ) < .2 && p.x > c.x0 && p.x < c.x1 && p.z > c.z0 && p.z < c.z1 && !( p.x > ROOM.x0 && p.x < ROOM.x1 && p.z > ROOM.z0 && p.z < ROOM.z1 ) && Math.hypot( p.x, p.z ) > 3; }
	aimed( at, degrees = 10 ) { const cam = this.app.camera; return cam.getWorldDirection( new Vector3() ).dot( at.clone().sub( cam.position ).normalize() ) > Math.cos( degrees * Math.PI / 180 ); }
	meshes() {
		const out = [ ...( this.app.village.meshes || [] ) ];
		this.s.moving.group?.traverse( node => { if ( node.isMesh ) out.push( node ); } );
		return out;
	}
	clear( at ) {
		const origin = this.app.camera.position, dir = at.clone().sub( origin ), distance = dir.length();
		dir.normalize();
		if ( this.app.colliders?.raycast( origin, dir, distance ) < distance - .1 ) return false;
		if ( opaqueSegmentBlocked( this.meshes(), origin, at ) ) return false;
		// Match rendered terrain curvature along the ray; do not let the target's own hill block its top.
		const F = this.app.flannan, T = this.app.terrainData, curvature = this.app.curvature || 0;
		for ( let t = 2; t < distance - 6; t += t < 1200 ? 5 : 60 ) {
			const x = origin.x + dir.x * t, z = origin.z + dir.z * t;
			const h = Math.abs( x ) < 1024 && Math.abs( z ) < 1024 ? T?.heightAt?.( x, z ) : Math.max( F?.grids.uig.at( x, z ) || 0, F?.grids.hebrides.at( x, z ) || 0, F?.grids.flannans.at( x, z ) || 0 );
			if ( Number.isFinite( h ) && h - curvature * ( ( x-origin.x ) ** 2 + ( z-origin.z ) ** 2 ) > origin.y + dir.y * t + .05 ) return false;
		}
		return true;
	}
	store( key, value, source ) {
		const draft = this.begin();
		if ( ! draft || ! value ) return false;
		draft.readings[ key ] = { ...value, source, h: this.s.h, position: this.app.player.position.toArray() };
		this.s.save(); return true;
	}
	install() {
		const I = this.s.interact;
		I.get( 'barometer' ).use = () => this.inspect( 'pressure' );
		I.add( { id: 'thermometer', at: ROOM.thermometer, size: .2, text: 'Read the shaded thermometer', use: () => this.inspect( 'temperature' ) } );
		I.add( { id: 'weatherVane', at: this.s.station.parts.windVane, reach: 60, size: .8, when: () => this.onYard(), text: 'Observe the roof vane and wind', use: () => this.wind() } );
		I.add( { id: 'weatherSea', at: () => this.seaTarget, reach: 1800, size: 12,
			when: () => this.seaView(), text: 'Watch the open sea', hold: 4, progress: () => Math.min( 1, this.sampler.elapsed / 4 ),
			onHold: dt => this.holdSea( dt ), onRelease: () => this.releaseSea() } );
		for ( const [ id, key, title ] of [ [ 'weatherGallan', 'far', 'Check Gallan Head’s bearing' ], [ 'weatherIsland', 'near', 'Check the nearby island’s bearing' ] ] ) {
			I.add( { id, at: () => this.landmarkPosition( key ), reach: 100000, size: key === 'far' ? 150 : 25,
				when: () => this.onBalcony(), text: title, use: () => this.landmark( key ) } );
		}
	}
	async inspect( key ) {
		const at = key === 'pressure' ? ROOM.barometer : ROOM.thermometer;
		if ( ! this.available() || this.app.camera.position.distanceTo( at ) > 2.05 || ! this.aimed( at, 20 ) || ! this.clear( at ) ) return false;
		this.begin();
		const p = this.app.player, cam = this.app.camera;
		const previous = { position: p.position.clone(), yaw: p.yaw, pitch: p.pitch, fov: cam.fov, camera: cam.position.clone(), quaternion: cam.quaternion.clone(), busy: p.busy };
		this.focus = { at, key, previous, height: key === 'pressure' ? .188 : .52 };
		p.busy = true; this.s.tel = 0; this.updateFocus(); this.app.cameraCut?.();
		const record = () => {
			const value = key === 'pressure' ? { value: pressureAt( this.s.h ), label: `${ pressureAt( this.s.h ).toFixed( 2 ) } inches` } : { value: temperatureAt( this.s.h ), label: `${ temperatureAt( this.s.h ).toFixed( 1 ) }°F` };
			if ( this.store( key, value, key === 'pressure' ? 'room barometer' : 'shaded north-wall thermometer' ) ) this.s.toast( `${ value.label } noted for the slate.` );
			else this.s.toast( `${ value.label }. No evening observation is due.` );
		};
		try { await this.s.ui.inspection( { title: key === 'pressure' ? 'The barometer · inches of mercury' : 'Shaded air · Fahrenheit', onRecord: record } ); }
		finally {
			this.focus = null; p.position.copy( previous.position ); p.yaw = previous.yaw; p.pitch = previous.pitch; p.busy = previous.busy;
			cam.position.copy( previous.camera ); cam.quaternion.copy( previous.quaternion ); cam.fov = previous.fov; cam.updateProjectionMatrix(); this.app.cameraCut?.();
		}
		return true;
	}
	updateFocus() {
		if ( ! this.focus ) return;
		const { at, previous, height, key } = this.focus, cam = this.app.camera;
		cam.position.copy( previous.camera ); cam.lookAt( at.clone().add( new Vector3( 0, -height*.17, 0 ) ) );
		const fit = key === 'pressure' ? Math.max( 1, 1 / cam.aspect ) : 1;
		const fill = cam.aspect > 2 ? .5 : .62;
		cam.fov = MathUtils.clamp( 2 * Math.atan( height * fit / ( 2 * cam.position.distanceTo( at ) * fill ) ) * 180 / Math.PI, 4, 70 );
		cam.updateProjectionMatrix();
	}
	wind() {
		const at = this.s.station.parts.windVane;
		if ( ! this.available() || ! this.onYard() || ! this.aimed( at ) || ! this.clear( at ) ) { this.s.toast( 'Find an open view of the arrow above the cupola.' ); return false; }
		const v = windReading( G.windDir.value.x, G.windDir.value.y, G.windSpeed.value );
		if ( ! v ) return false;
		this.store( 'wind', v, 'cupola vane and rendered wind' );
		this.s.toast( `${ v.label }. The arrow points into the wind. Lewis lies to the east.`, 5000 ); return true;
	}
	seaView() {
		if ( ! this.onBalcony() ) return false;
		if ( this.seaHolding && this.sampler.patch ) { this.seaTarget.copy( this.sampler.patch ); return this.aimed( this.seaTarget, 12 ); }
		const cam = this.app.camera, dir = cam.getWorldDirection( new Vector3() );
		if ( dir.y > -.065 || dir.y < -.8 ) return false;
		const distance = ( ( G.seaLevel?.value || 0 ) - cam.position.y ) / dir.y;
		if ( distance < 120 || distance > 1600 ) return false;
		this.seaTarget.copy( cam.position ).addScaledVector( dir, distance );
		return this.app.terrainData?.heightAt( this.seaTarget.x, this.seaTarget.z ) < -5;
	}
	holdSea( dt ) {
		if ( this.seaCapturedHold ) return;
		if ( ! this.available() || ! this.seaView() ) return this.releaseSea();
		if ( ! this.seaHolding ) {
			if ( ! this.clear( this.seaTarget ) ) return;
			this.begin(); this.sampler.begin( this.seaTarget ); this.seaHolding = true; this.seaOrigin = this.app.camera.position.clone();
		}
		if ( this.seaOrigin.distanceTo( this.app.camera.position ) > .35 ) {
			if ( ! this.clear( this.sampler.patch ) ) return this.releaseSea();
			this.seaOrigin.copy( this.app.camera.position );
		}
		if ( this.sampler.step( dt, G.time.value ) ) this.recordSea();
	}
	releaseSea() { this.seaHolding = false; this.seaCapturedHold = false; this.sampler.reset(); }
	recordSea() {
		const value = this.sampler.step( 0, G.time.value );
		if ( ! this.available() || ! this.onBalcony() || ! this.sampler.patch || ! this.aimed( this.sampler.patch, 12 ) || ! value || ! this.clear( this.sampler.patch ) ) { this.s.toast( 'Keep an open view of the sea.' ); this.releaseSea(); return false; }
		const noted = this.store( 'sea', value, 'nine rendered water samples, four-second observation' );
		this.s.toast( `Sea ${ value.label.toLowerCase() } — ${ noted ? 'noted for the slate' : 'no evening observation is due' }.` ); this.releaseSea(); this.seaCapturedHold = true; return true;
	}
	landmarkPosition( key ) {
		const at = key === 'far' ? this.s.her.clone() : NEAR.clone(), cam = this.app.camera;
		if ( key === 'near' ) at.y = ( this.app.terrainData?.heightAt( at.x, at.z ) ?? at.y ) + 2;
		at.y -= ( this.app.curvature || 0 ) * ( ( at.x - cam.position.x ) ** 2 + ( at.z - cam.position.z ) ** 2 );
		return at;
	}
	landmark( key ) {
		const at = this.landmarkPosition( key );
		if ( ! this.available() || ! this.onBalcony() || ! this.aimed( at ) ) return false;
		const value = landmarkReport( { blocked: ! this.clear( at ), transmittance: hazeTransmittance( this.app.camera.position, at, this.app.haze?.density.value || 0 ),
			daylight: 1 - G.night.value, lit: key === 'far' && Beams.uniforms.far.value[ 0 ].w > 0, nearby: key === 'near' } );
		if ( ! value || value.status === 'blocked' ) { this.s.toast( value?.label || 'The view cannot be read yet.' ); return false; }
		const draft = this.begin();
		if ( draft ) {
			draft.landmarks[ key ] = { ...value, h: this.s.h, source: key === 'far' ? 'Gallan Head bearing' : 'Eilean Tighe bearing', position: this.app.player.position.toArray() };
			const v = visibilityReading( draft.landmarks.far, draft.landmarks.near );
			if ( v ) this.store( 'visibility', v, 'both landmark bearings checked' );
			else this.s.save();
		}
		this.s.toast( value.label, 4200 ); return true;
	}
	complete( draft = this.draft ) { return FIELDS.every( ( [ key ] ) => !! draft?.readings[ key ] ); }
	goal() {
		const r = this.draft?.readings || {}, missing = FIELDS.find( ( [ key ] ) => ! r[ key ] )?.[ 0 ];
		return { pressure: 'Read the room barometer for the evening observations.', temperature: 'Read the shaded thermometer outside the north wall.', wind: 'Step into the yard and inspect the vane above the cupola.', sea: 'On the balcony, look down at open water and hold to observe the sea.', visibility: this.draft?.landmarks.far ? 'Check the nearby island’s bearing from the balcony.' : 'Check Gallan Head’s bearing from an open part of the balcony.' }[ missing ] || 'Return to the slate and chalk the captured observations.';
	}
	guidance() {
		const r = this.draft?.readings || {};
		if ( ! r.pressure ) return { at: ROOM.barometer, label: 'Read barometer · E', id: 'barometer', zone: 'room' };
		const p = this.app.player.position;
		// The north-wall thermometer is reached around the tower's east side.
		if ( this.onYard() && ! r.temperature && p.x > -2 && p.z > -2.8 ) return { at: new Vector3( 5, STATION.yard + 1, -3.6 ), label: 'Around the tower to the north wall', id: 'weatherNorthPath', zone: 'yard' };
		if ( ! r.temperature ) return { at: ROOM.thermometer, label: 'Shaded thermometer · E', id: 'thermometer', zone: 'yard' };
		if ( ! r.wind ) return { at: this.onYard() && this.app.player.position.distanceTo( this.windStand ) < 5 ? this.s.station.parts.windVane : this.windStand, label: 'Roof vane · look up', id: 'weatherVane', zone: 'yard' };
		if ( this.onYard() && p.z < -2.8 && p.x < 3.5 ) return { at: new Vector3( 5, STATION.yard + 1, -3.6 ), label: 'Around the tower to the house door', id: 'weatherNorthPath', zone: 'yard' };
		if ( ! r.sea ) { const radius = Math.hypot( p.x, p.z ); return { at: this.onBalcony() ? new Vector3( p.x / radius * 600, G.seaLevel?.value || 0, p.z / radius * 600 ) : new Vector3( 450, 0, 80 ), label: 'Open sea · look outward and down', id: 'weatherSea', zone: 'gallery' }; }
		if ( ! r.visibility ) {
			const key = this.draft?.landmarks.far ? 'near' : 'far', target = this.landmarkPosition( key );
			if ( this.onBalcony() ) {
				const a = Math.atan2( p.z, p.x ), bearing = Math.atan2( target.z-p.z, target.x-p.x );
				const turn = Math.atan2( Math.sin(bearing-a), Math.cos(bearing-a) );
				if ( Math.abs(turn) > 1.2 ) { const next = a+Math.sign(turn)*.45; return { at: new Vector3(Math.cos(next)*3.1,TOWER.deck+1,Math.sin(next)*3.1), label: 'Around the balcony for an open bearing', id:'weatherBalconyPath', zone:'gallery' }; }
			}
			return { at: target, label: key === 'far' ? 'Gallan Head bearing · E' : 'Nearby island bearing · E', id: key === 'far' ? 'weatherGallan' : 'weatherIsland', zone: 'gallery' };
		}
		return { at: ROOM.slate, label: 'Chalk observations · E', id: 'slate', zone: 'room' };
	}
	async slate() {
		const at = this.due, draft = this.begin();
		if ( ! at || ! draft ) return this.s._readSlate();
		const rows = FIELDS.map( ( [ key, title ] ) => ( { title, value: draft.readings[ key ] ? `${ draft.readings[ key ].label } · ${ clock( draft.readings[ key ].h ) }` : 'Not yet observed' } ) );
		const result = await this.s.ui.observations( { title: `The slate · ${ at === 18 ? 'six' : 'nine' } o’clock`, rows, complete: this.complete( draft ), hint: this.goal() } );
		if ( result !== 'chalk' || this.due !== at || this.s.obs[ at ] || ! this.complete( draft ) ) return false;
		const r = draft.readings;
		this.s.obs[ at ] = { wind: r.wind.label, sea: r.sea.label, visibility: r.visibility.label, pressure: r.pressure.value, temperature: r.temperature.value, capturedAt: this.s.h, evidence: structuredClone( draft ) };
		this.s.row( this.s.h, `${ at === 18 ? 'Six' : 'Nine' } o’clock observations chalked. Bar. ${ r.pressure.value.toFixed( 2 ) }. Therm. ${ r.temperature.value.toFixed( 1 ) }°F. Wind: ${ r.wind.label }. Sea: ${ r.sea.label.toLowerCase() }. Visibility: ${ r.visibility.label }.` );
		delete this.s.flags.weatherObservations[ at ]; this.s.save(); return true;
	}
	update() {
		if ( this.due ) this.begin();
		if ( ! this.available() || this.s.interact.current?.id !== 'weatherSea' || ! this.app.input.down( 'KeyE' ) ) this.releaseSea();
		this.updateFocus();
	}
}
