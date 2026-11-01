import { Texture } from '../../engine/gpu/Texture.js';
import { ShaderModule } from '../../engine/gpu/Shader.js';
import { smoothstep } from '../../util/Noise.js';

// Visual exposure proxy, not a wind simulation or a historical plant survey.
// One cached 4 m RGBA map: shelter from +X, -X, +Z, -Z. No per-frame CPU work.
const fields = new WeakMap();
const DIRECTIONS = [ [ 1, 0 ], [ -1, 0 ], [ 0, 1 ], [ 0, -1 ] ];

export function buildTurfShelter( terrain, colliders = null ) {
	const { origin, size } = terrain, res = Math.max( 2, Math.ceil( size / 4 ) ), texel = size / res;
	const data = new Uint8Array( res * res * 4 );
	const heightAt = terrain.heightAt ? ( x, z ) => terrain.heightAt( x, z ) : ( x, z ) => {
		const i = Math.max( 0, Math.min( terrain.res - 1, Math.floor( ( x - origin ) / terrain.texel ) ) );
		const j = Math.max( 0, Math.min( terrain.res - 1, Math.floor( ( z - origin ) / terrain.texel ) ) );
		return terrain.heights[ j * terrain.res + i ];
	};
	// Rasterize bounded collider regions once. Floors, furniture, gates and doors
	// are excluded, so an exclusion footprint does not invent a large windbreak.
	const blockers = new Float32Array( res * res ).fill( -Infinity );
	for ( const b of colliders?.boxes || [] ) {
		if ( b.enabled === false || b.solid === false || ! /wall|house|shed|chapel|bothy|tower/.test( b.tag || '' ) ) continue;
		const radius = Math.hypot( b.half.x, b.half.z ) + texel, top = b.top ?? b.center.y + b.half.y;
		const cos = b.cos ?? Math.cos( b.rotY || 0 ), sin = b.sin ?? Math.sin( b.rotY || 0 );
		const i0 = Math.max( 0, Math.floor( ( b.center.x - radius - origin ) / texel ) ), i1 = Math.min( res - 1, Math.ceil( ( b.center.x + radius - origin ) / texel ) );
		const j0 = Math.max( 0, Math.floor( ( b.center.z - radius - origin ) / texel ) ), j1 = Math.min( res - 1, Math.ceil( ( b.center.z + radius - origin ) / texel ) );
		for ( let j = j0; j <= j1; j ++ ) for ( let i = i0; i <= i1; i ++ ) {
			const dx = origin + ( i + .5 ) * texel - b.center.x, dz = origin + ( j + .5 ) * texel - b.center.z;
			if ( Math.abs( dx * cos - dz * sin ) <= b.half.x + texel * .5 && Math.abs( dx * sin + dz * cos ) <= b.half.z + texel * .5 ) {
				blockers[ j * res + i ] = Math.max( blockers[ j * res + i ], top );
			}
		}
	}
	for ( const ring of [ ...( colliders?.rings || [] ), ...( colliders?.cylinders || [] ) ] ) {
		if ( ring.enabled === false || ! /wall|tower|chapel|bothy/.test( ring.tag || '' ) ) continue;
		const radius = ( ring.rOut ?? ring.radius ) + texel * .5;
		const i0 = Math.max( 0, Math.floor( ( ring.x - radius - origin ) / texel ) ), i1 = Math.min( res - 1, Math.ceil( ( ring.x + radius - origin ) / texel ) );
		const j0 = Math.max( 0, Math.floor( ( ring.z - radius - origin ) / texel ) ), j1 = Math.min( res - 1, Math.ceil( ( ring.z + radius - origin ) / texel ) );
		for ( let j = j0; j <= j1; j ++ ) for ( let i = i0; i <= i1; i ++ ) {
			if ( Math.hypot( origin + ( i + .5 ) * texel - ring.x, origin + ( j + .5 ) * texel - ring.z ) <= radius ) blockers[ j * res + i ] = Math.max( blockers[ j * res + i ], ring.yMax );
		}
	}
	for ( let j = 0; j < res; j ++ ) for ( let i = 0; i < res; i ++ ) {
		const x = origin + ( i + .5 ) * texel, z = origin + ( j + .5 ) * texel, y = heightAt( x, z );
		if ( y < 7 || y > 102 ) continue;
		for ( const [ channel, [ dx, dz ] ] of DIRECTIONS.entries() ) {
			let shelter = 0;
			for ( let step = 1; step <= 6; step ++ ) {
				const u = i + dx * step, v = j + dz * step, distance = step * texel;
				if ( u < 0 || v < 0 || u >= res || v >= res ) break;
				const obstacle = Math.max( heightAt( x + dx * distance, z + dz * distance ), blockers[ v * res + u ] );
				const angle = ( obstacle - y - .22 ) / distance;
				shelter = Math.max( shelter, smoothstep( .035, .32, angle ) * ( 1 - .45 * step / 6 ) );
			}
			data[ ( j * res + i ) * 4 + channel ] = Math.round( shelter * 255 );
		}
	}
	return { data, res, texel, origin, size };
}

export function turfShelterAt( field, x, z ) {
	const fx = Math.max( 0, Math.min( field.res - 1, ( x - field.origin ) / field.texel - .5 ) );
	const fz = Math.max( 0, Math.min( field.res - 1, ( z - field.origin ) / field.texel - .5 ) );
	const i = Math.floor( fx ), j = Math.floor( fz ), ix = Math.min( field.res - 1, i + 1 ), jz = Math.min( field.res - 1, j + 1 );
	const a = fx - i, b = fz - j, channels = [];
	for ( let c = 0; c < 4; c ++ ) {
		const v = ( u, w ) => field.data[ ( w * field.res + u ) * 4 + c ] / 255;
		channels.push( ( v( i, j ) * ( 1 - a ) + v( ix, j ) * a ) * ( 1 - b ) + ( v( i, jz ) * ( 1 - a ) + v( ix, jz ) * a ) * b );
	}
	return { channels, growth: Math.max( ...channels ) * .55 + channels.reduce( ( a, b ) => a + b, 0 ) * .1125 };
}

export function acquireMaritimeTurf( terrain, colliders = null ) {
	let field = fields.get( terrain );
	if ( ! field ) {
		field = buildTurfShelter( terrain, colliders );
		field.texture = new Texture( { label: 'maritimeTurfShelter', width: field.res, height: field.res, format: 'rgba8unorm', data: field.data } );
		field.module = new ShaderModule( { name: 'maritimeTurf', bindings: { maritimeTurfShelter: { texture: field.texture } }, code: /* wgsl */`
fn maritimeShelterAt( xz: vec2f ) -> vec4f {
	return textureSampleLevel( maritimeTurfShelter, smpLinearClamp, ( xz - ${ Number( terrain.origin ).toFixed( 6 ) } ) / ${ Number( terrain.size ).toFixed( 6 ) }, 0.0 );
}
${ MARITIME_TURF_WGSL }
` } );
		field.refs = 0;
		field.release = () => { if ( --field.refs === 0 ) { field.texture.destroy(); fields.delete( terrain ); } };
		fields.set( terrain, field );
	}
	field.refs ++;
	return field;
}

// Shared broad green/straw pattern and restrained linear palette. World anchored,
// low frequency fields keep the same patches when blades thin into the ground.
export const MARITIME_TURF_WGSL = /* wgsl */`
fn maritimeGrowthShelter( shelter: vec4f ) -> f32 {
	return max( max( shelter.x, shelter.y ), max( shelter.z, shelter.w ) ) * .55 + dot( shelter, vec4f( .1125 ) );
}
fn maritimeWindShelter( shelter: vec4f, wind: vec2f ) -> f32 {
	let upstream = -wind;
	let directional = vec4f( max( upstream.x, 0.0 ), max( -upstream.x, 0.0 ), max( upstream.y, 0.0 ), max( -upstream.y, 0.0 ) );
	return dot( shelter, directional * directional ) / max( dot( directional, directional ), .001 );
}
fn maritimeDryness( xz: vec2f, shelter: f32 ) -> f32 {
	let broad = .5 + .25 * sin( dot( xz, vec2f( .052, .031 ) ) + .7 * sin( xz.y * .079 ) )
		+ .25 * sin( dot( xz, vec2f( -.071, .113 ) ) + .6 * sin( xz.x * .043 ) );
	return clamp( .17 + broad * .62 + ( 1.0 - shelter ) * .17, 0.0, 1.0 );
}
fn maritimeTuft( xz: vec2f ) -> f32 {
	return .5 + .5 * sin( xz.x * 1.72 + sin( xz.y * 1.37 ) * 1.5 ) * sin( xz.y * 2.13 + xz.x * .43 );
}
fn maritimeTurfTone( dry: f32 ) -> vec3f {
	let green = mix( vec3f( .082, .118, .049 ), vec3f( .132, .155, .071 ), smoothstep( .15, .72, dry ) );
	return mix( green, vec3f( .225, .193, .107 ), smoothstep( .58, .92, dry ) * .67 );
}
fn maritimeGust( xz: vec2f, time: f32 ) -> f32 {
	return .5 + .28 * sin( dot( xz, vec2f( .19, .12 ) ) - time * 1.1 )
		+ .22 * sin( dot( xz, vec2f( -.11, .27 ) ) - time * .67 );
}
`;
