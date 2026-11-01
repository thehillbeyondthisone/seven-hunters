import { Vector3 } from '../engine/math/index.js';

const NS = 'http://www.w3.org/2000/svg';
const el = ( tag, attributes = {} ) => {
	const node = document.createElementNS( NS, tag );
	for ( const [ key, value ] of Object.entries( attributes ) ) node.setAttribute( key, value );
	return node;
};

// Read-only snapshots; never select/use an interaction or alter its hold state.
export function hotspotSnapshot( app ) {
	const interact = app.story?.interact, safety = app.keeperSafety;
	const rows = ( interact?.items || [] ).map( item => {
		const at = typeof item.at === 'function' ? item.at() : item.at;
		return { id: item.id, at: at.clone(), size: item.size, reach: item.reach,
			active: !! item.when(), selected: interact.current === item,
			zones: item.debugZones || [] };
	} );
	for ( const item of safety?.rails || [] ) rows.push( { id: item.id, at: item.at.clone(), size: .16, reach: 2, active: safety.railAvailable( item ), selected: safety.brace === item, zones: [] } );
	for ( const item of safety?.anchors || [] ) rows.push( { id: item.id, at: item.at.clone(), size: .16, reach: 1.8,
		active: safety.active && item.intact !== false && [ 'struggling', 'recovering' ].includes( safety.state ), selected: safety.target === item, zones: [] } );
	return rows;
}

export class HotspotDebug {
	constructor( app ) {
		this.app = app; this.enabled = false; this.showInactive = false; this.elapsed = 1;
		this.root = document.createElement( 'div' ); this.root.className = 'sh-hotspots'; this.root.hidden = true;
		this.root.setAttribute( 'aria-label', 'Interaction hotspot debug overlay' );
		this.svg = el( 'svg', { 'aria-hidden': true } );
		this.info = document.createElement( 'aside' );
		this.root.append( this.svg, this.info ); document.body.append( this.root );
	}
	setEnabled( value ) { this.enabled = !! value; this.root.hidden = ! this.enabled; this.elapsed = 1; }
	update( dt ) {
		if ( ! this.enabled ) return;
		this.elapsed += dt;
		if ( this.elapsed < 1 / 20 ) return;
		this.elapsed = 0;
		const app = this.app, camera = app.camera, width = window.innerWidth, height = window.innerHeight;
		camera.updateMatrixWorld(); this.svg.setAttribute( 'viewBox', `0 0 ${ width } ${ height }` );
		const direction = camera.getWorldDirection( new Vector3() ), focal = height / ( 2 * Math.tan( camera.fov * Math.PI / 360 ) );
		const project = at => {
			if ( at.clone().sub( camera.position ).dot( direction ) <= .02 ) return null;
			const p = at.clone().project( camera );
			return { x: ( p.x * .5 + .5 ) * width, y: ( .5 - p.y * .5 ) * height };
		};
		const rows = hotspotSnapshot( app ), fragment = document.createDocumentFragment(), zones = new Map();
		for ( const row of rows ) {
			for ( const zone of row.zones ) zones.set( zone.id, zone );
			if ( ! row.active && ! this.showInactive ) continue;
			const p = project( row.at ); if ( ! p || p.x < -60 || p.x > width + 60 || p.y < -60 || p.y > height + 60 ) continue;
			const distance = camera.position.distanceTo( row.at ), along = row.at.clone().sub( camera.position ).dot( direction );
			const reachable = distance <= row.reach + row.size;
			const color = row.selected ? '#ffda75' : row.active ? reachable ? '#76f0b5' : '#67c7ed' : '#9a9f9e';
			const group = el( 'g', { opacity: row.active ? 1 : .6 } );
			group.append( el( 'circle', { cx: p.x, cy: p.y, r: Math.max( 4, focal * ( row.size + .04 * along ) / along ), fill: 'none', stroke: color, 'stroke-width': row.selected ? 2.5 : 1, 'stroke-dasharray': row.active ? 'none' : '4 4' } ) );
			const label = el( 'text', { x: p.x + 9, y: p.y - 11, fill: color } );
			label.textContent = `${ row.id } · ${ row.active ? reachable ? 'in reach' : 'available' : 'inactive' }`;
			const detail = el( 'text', { x: p.x + 9, y: p.y + 5, fill: color, 'font-size': 10 } );
			detail.textContent = `${ distance.toFixed( 1 ) }m away · reach ${ row.reach }m · target r ${ row.size }m`;
			group.append( label, detail ); fragment.append( group );
		}
		for ( const zone of zones.values() ) {
			const points = Array.from( { length: 33 }, ( _, i ) => {
				const angle = i / 32 * Math.PI * 2;
				return project( zone.at.clone().add( new Vector3( Math.cos( angle ) * zone.size, 0, Math.sin( angle ) * zone.size ) ) );
			} );
			if ( points.some( p => ! p ) ) continue;
			fragment.append( el( 'path', { d: points.map( ( p, i ) => `${ i ? 'L' : 'M' }${ p.x.toFixed( 1 ) },${ p.y.toFixed( 1 ) }` ).join( ' ' ) + 'Z', fill: '#66c7ed22', stroke: '#67c7ed', 'stroke-width': 2 } ) );
			const p = project( zone.at );
			if ( p ) { const label = el( 'text', { x: p.x, y: p.y - 10, fill: '#9fe3ff', 'text-anchor': 'middle' } ); label.textContent = zone.label; fragment.append( label ); }
		}
		this.svg.replaceChildren( fragment );
		const active = rows.filter( r => r.active ), nearby = rows.filter( r => camera.position.distanceTo( r.at ) < 12 ).sort( ( a, b ) => camera.position.distanceTo( a.at ) - camera.position.distanceTo( b.at ) );
		this.info.replaceChildren();
		const title = document.createElement( 'strong' ); title.textContent = `Hot zones · ${ active.length } available / ${ rows.length } registered`; this.info.append( title );
		const legend = document.createElement( 'p' ); legend.textContent = 'Green: in reach · blue: available · grey: inactive · gold: selected. Rings show aim tolerance; floor outlines show standing areas.'; this.info.append( legend );
		for ( const row of nearby.slice( 0, 8 ) ) { const text = document.createElement( 'div' ); text.textContent = `${ row.active ? '●' : '○' } ${ row.id } · ${ camera.position.distanceTo( row.at ).toFixed( 1 ) }m`; this.info.append( text ); }
	}
}
