// Bounded analytic cliff-surf study. Sites are derived from the current walkable heightfield;
// this is not a fluid simulation or an archival measurement of run-up.
const clamp = ( x, a = 0, b = 1 ) => Math.max( a, Math.min( b, x ) );
export function cliffPulse( time, phase, period ) {
	const s = time / Math.max( 4, period ) + phase;
	const p = s - Math.floor( s );
	const smooth = ( x, a, b ) => { x = clamp( ( x - a ) / ( b - a ) ); return x * x * ( 3 - 2 * x ); };
	return smooth( p, 0, 0.075 ) * ( 1 - smooth( p, 0.13, 0.34 ) );
}
export function buildCliffSites( terrain, count = 80 ) {
	const sites = [];
	// The geos are narrower than the island-wide sampling interval. Trace their side walls
	// explicitly so the playable landings receive local impacts as well as distant surf.
	for ( const name of [ 'west', 'east' ] ) {
		const l = terrain.landing( name ), [ dx, dz ] = l.dir, px = - dz, pz = dx;
		for ( const along of [ 7, 18 ] ) for ( const side of [ - 1, 1 ] ) {
			const cx = l.stage.x + dx * along, cz = l.stage.z + dz * along;
			let cross = 0;
			while ( cross < 18 && terrain.heightAt( cx + px * cross * side, cz + pz * cross * side ) < 0.2 ) cross += 0.25;
			if ( cross < 2 || cross >= 18 ) continue;
			const x = cx + px * cross * side, z = cz + pz * cross * side, nx = - px * side, nz = - pz * side;
			const height = terrain.heightAt( x - nx * 12, z - nz * 12 );
			if ( height < 5 || terrain.heightAt( x + nx * 5, z + nz * 5 ) > 0.2 || terrain.heightAt( x + nx * 3, z + nz * 3 ) > 0.2 ) continue;
			const exposure = name === 'west' ? 0.9 : 0.18;
			sites.push( { x, z, nx, nz, exposure, phase: ( x * 0.94 - z * 0.342 ) / 180, height, width: 6 } );
		}
	}
	for ( let i = 0; i < count; i ++ ) {
		const a = i / count * Math.PI * 2, rx = Math.cos( a ), rz = Math.sin( a );
		let r = 8;
		while ( r < 850 && terrain.heightAt( rx * r, rz * r ) > 0.2 ) r += 1.5;
		if ( r >= 850 ) continue;
		const x = rx * r, z = rz * r, e = 2;
		let nx = terrain.heightAt( x - e, z ) - terrain.heightAt( x + e, z );
		let nz = terrain.heightAt( x, z - e ) - terrain.heightAt( x, z + e );
		const len = Math.hypot( nx, nz );
		if ( len < 0.1 ) { nx = rx; nz = rz; } else { nx /= len; nz /= len; }
		if ( terrain.heightAt( x + nx * 5, z + nz * 5 ) > 0 || terrain.heightAt( x + nx * 3, z + nz * 3 ) > 0 ) { nx = rx; nz = rz; }
		if ( terrain.heightAt( x + nx * 5, z + nz * 5 ) > 0.2 || terrain.heightAt( x + nx * 3, z + nz * 3 ) > 0.2 ) continue;
		const cliff = terrain.heightAt( x - nx * 6, z - nz * 6 );
		if ( cliff < 5 ) continue; // exclude shelves, paths and the stages themselves
		if ( sites.some( ( s ) => Math.hypot( s.x - x, s.z - z ) < 13 ) ) continue;
		const exposure = 0.12 + 0.88 * Math.pow( clamp( - nx * 0.94 + nz * 0.342 ), 1.5 );
		const phase = ( x * 0.94 - z * 0.342 ) / 180 + Math.sin( i * 7.13 ) * 0.08;
		sites.push( { x, z, nx, nz, exposure, phase, height: cliff, width: 10 + ( i % 4 ) * 2 } );
	}
	return sites;
}
