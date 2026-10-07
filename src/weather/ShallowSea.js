// Finite-volume Saint-Venant model: Rusanov flux with hydrostatic reconstruction.
// Coastal sandbox, not an inundation forecast. The game's reconstructed seabed,
// coarse grid, numerical diffusion and absorbing border limit fidelity.
const GRAVITY = 9.81, DRY = 0.005;
const finite = ( n, fallback = 0 ) => Number.isFinite( n ) ? n : fallback;
const smooth = ( a, b, x ) => { const t = Math.max( 0, Math.min( 1, ( x - a ) / ( b - a ) ) ); return t * t * ( 3 - 2 * t ); };

export class ShallowSea {
	constructor( { heightAt, res = 128, size = 1024, level = 0 } ) {
		this.res = res; this.size = size; this.dx = size / res; this.min = - size / 2; this.level = level;
		const n = res * res;
		for ( const key of [ 'bed', 'rest', 'h', 'mx', 'mz', 'dh', 'dmx', 'dmz' ] ) this[ key ] = new Float64Array( n );
		this.field = new Float32Array( n * 4 ); this.time = 0;
		for ( let z = 0; z < res; z ++ ) for ( let x = 0; x < res; x ++ ) {
			const i = z * res + x;
			this.bed[ i ] = Math.max( - 120, finite( heightAt( this.min + ( x + 0.5 ) * this.dx, this.min + ( z + 0.5 ) * this.dx ), 100 ) );
			this.rest[ i ] = Math.max( 0, level - this.bed[ i ] );
		}
		this.reset();
	}
	reset() { this.h.set( this.rest ); this.mx.fill( 0 ); this.mz.fill( 0 ); this.field.fill( 0 ); this.time = 0; }
	seedTsunami( { x, z, nx = 1, nz = 0, amplitude = 10, width = 46 } ) {
		const len = Math.hypot( nx, nz ) || 1; nx /= len; nz /= len;
		amplitude = Math.max( 0, Math.min( 250, finite( amplitude, 10 ) ) );
		width = Math.max( this.dx * 2, finite( width, 46 ) );
		const span = Math.max( 310, width * 1.5 );
		this.reset();
		for ( let iz = 0; iz < this.res; iz ++ ) for ( let ix = 0; ix < this.res; ix ++ ) {
			const i = iz * this.res + ix, d = this.rest[ i ]; if ( d < 0.5 ) continue;
			const rx = this.min + ( ix + 0.5 ) * this.dx - x, rz = this.min + ( iz + 0.5 ) * this.dx - z;
			const along = rx * nx + rz * nz, across = - rx * nz + rz * nx;
			// Leading drawdown followed by a broad positive pulse, travelling shoreward.
			const eta = amplitude * ( Math.exp( - ( ( along / width ) ** 2 ) ) - 0.28 * Math.exp( - ( ( ( along - width * 1.7 ) / width ) ** 2 ) ) ) * Math.exp( - ( ( across / span ) ** 4 ) );
			this.h[ i ] = Math.max( DRY, d + eta );
			// Nonlinear simple-wave velocity remains usable for the extreme range;
			// linear eta*sqrt(g/d) greatly overdrives large pulses in shallow cells.
			const u = 2 * ( Math.sqrt( GRAVITY * this.h[ i ] ) - Math.sqrt( GRAVITY * d ) );
			this.mx[ i ] = this.h[ i ] * u * nx; this.mz[ i ] = this.h[ i ] * u * nz;
		}
		this.pack();
	}
	seedBlast( { x, z, amplitude = 12, radius = 24 } ) {
		this.reset(); radius = Math.max( this.dx * 2, finite( radius, 24 ) );
		amplitude = Math.max( 0, Math.min( 18, finite( amplitude, 12 ) ) );
		for ( let iz = 0; iz < this.res; iz ++ ) for ( let ix = 0; ix < this.res; ix ++ ) {
			const i = iz * this.res + ix, d = this.rest[ i ]; if ( d < 0.5 ) continue;
			const r = Math.hypot( this.min + ( ix + 0.5 ) * this.dx - x, this.min + ( iz + 0.5 ) * this.dx - z ) / radius;
			// A raised annulus and central cavity model the surface displacement only.
			// Detonation pressure, cavitation and a compressible bubble are not solved.
			const eta = amplitude * ( 1.4 * Math.exp( - ( ( ( r - 1 ) / 0.5 ) ** 2 ) ) - Math.exp( - ( ( r / 0.55 ) ** 2 ) ) );
			this.h[ i ] = Math.max( DRY, d + eta );
		}
		this.pack();
	}
	face( a, b, axis, ratio ) {
		const hA = this.h[ a ], hB = this.h[ b ], bed = Math.max( this.bed[ a ], this.bed[ b ] );
		const ha = Math.max( 0, hA + this.bed[ a ] - bed ), hb = Math.max( 0, hB + this.bed[ b ] - bed );
		const ua = hA > DRY ? this.mx[ a ] / hA : 0, va = hA > DRY ? this.mz[ a ] / hA : 0;
		const ub = hB > DRY ? this.mx[ b ] / hB : 0, vb = hB > DRY ? this.mz[ b ] / hB : 0;
		const na = axis === 0 ? ua : va, nb = axis === 0 ? ub : vb;
		const speed = Math.max( Math.abs( na ) + Math.sqrt( GRAVITY * ha ), Math.abs( nb ) + Math.sqrt( GRAVITY * hb ) );
		const mass = ( ha * na + hb * nb - speed * ( hb - ha ) ) * 0.5;
		let fx = ( ha * ua * na + hb * ub * nb - speed * ( hb * ub - ha * ua ) ) * 0.5;
		let fz = ( ha * va * na + hb * vb * nb - speed * ( hb * vb - ha * va ) ) * 0.5;
		const pressure = GRAVITY * ( ha * ha + hb * hb ) * 0.25;
		if ( axis === 0 ) fx += pressure; else fz += pressure;
		this.dh[ a ] -= ratio * mass; this.dh[ b ] += ratio * mass;
		this.dmx[ a ] -= ratio * fx; this.dmx[ b ] += ratio * fx;
		this.dmz[ a ] -= ratio * fz; this.dmz[ b ] += ratio * fz;
		const correctionA = ratio * GRAVITY * ( hA * hA - ha * ha ) * 0.5;
		const correctionB = ratio * GRAVITY * ( hB * hB - hb * hb ) * 0.5;
		const momentum = axis === 0 ? this.dmx : this.dmz;
		momentum[ a ] -= correctionA; momentum[ b ] += correctionB;
	}
	step( dt ) {
		this.dh.fill( 0 ); this.dmx.fill( 0 ); this.dmz.fill( 0 );
		const n = this.res, ratio = dt / this.dx;
		for ( let z = 0; z < n; z ++ ) for ( let x = 0; x < n; x ++ ) {
			const i = z * n + x;
			if ( x < n - 1 ) this.face( i, i + 1, 0, ratio );
			if ( z < n - 1 ) this.face( i, i + n, 1, ratio );
		}
		for ( let z = 0; z < n; z ++ ) for ( let x = 0; x < n; x ++ ) {
			const i = z * n + x, edge = Math.min( x, z, n - 1 - x, n - 1 - z );
			if ( edge === 0 ) { this.h[ i ] = this.rest[ i ]; this.mx[ i ] = this.mz[ i ] = 0; continue; }
			const absorb = edge < 10 ? 1 - Math.exp( - dt * ( 10 - edge ) * 0.3 ) : 0;
			this.h[ i ] = Math.max( 0, this.h[ i ] + this.dh[ i ] );
			this.h[ i ] += ( this.rest[ i ] - this.h[ i ] ) * absorb;
			const drag = Math.exp( - dt * ( 0.009 + 0.04 / Math.max( 0.2, this.h[ i ] ) ) ) * ( 1 - absorb );
			this.mx[ i ] = ( this.mx[ i ] + this.dmx[ i ] ) * drag; this.mz[ i ] = ( this.mz[ i ] + this.dmz[ i ] ) * drag;
			if ( this.h[ i ] < DRY ) { this.mx[ i ] = this.mz[ i ] = 0; }
		}
		this.time += dt;
	}
	update( dt ) {
		let remaining = Math.max( 0, Math.min( 0.1, finite( dt ) ) );
		while ( remaining > 1e-6 ) {
			let speed = 1;
			for ( let i = 0; i < this.h.length; i ++ ) if ( this.h[ i ] > DRY ) speed = Math.max( speed, ( Math.abs( this.mx[ i ] ) + Math.abs( this.mz[ i ] ) ) / this.h[ i ] + Math.sqrt( GRAVITY * this.h[ i ] ) );
			const substep = Math.min( remaining, 0.2 * this.dx / speed );
			this.step( substep ); remaining -= substep;
		}
		this.pack();
	}
	pack() {
		for ( let i = 0; i < this.h.length; i ++ ) {
			const wet = this.h[ i ] > DRY, u = wet ? this.mx[ i ] / this.h[ i ] : 0, v = wet ? this.mz[ i ] / this.h[ i ] : 0;
			this.field[ i * 4 ] = wet ? this.h[ i ] + this.bed[ i ] - this.level : 0;
			this.field[ i * 4 + 1 ] = u; this.field[ i * 4 + 2 ] = v;
			// Keep depth for wet-aware surface interpolation. Blending a flooded
			// hillside's elevation with zero-height dry cells produced sharp spikes.
			this.field[ i * 4 + 3 ] = wet ? this.h[ i ] : 0;
		}
	}
	sample( x, z ) {
		const ix = Math.floor( ( x - this.min ) / this.dx ), iz = Math.floor( ( z - this.min ) / this.dx );
		if ( ix < 0 || iz < 0 || ix >= this.res || iz >= this.res ) return { height: 0, u: 0, v: 0, foam: 0 };
		const i = ( iz * this.res + ix ) * 4;
		const height = this.field[ i ], u = this.field[ i + 1 ], v = this.field[ i + 2 ];
		const depth = this.field[ i + 3 ], froude = Math.hypot( u, v ) / Math.sqrt( GRAVITY * Math.max( depth, 0.1 ) );
		return { height, u, v, foam: depth > DRY ? smooth( 0.65, 1.4, froude ) * ( 1 - smooth( 6, 24, depth ) ) : 0 };
	}
}
