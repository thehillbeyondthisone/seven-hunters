import { Group, Matrix4, Mesh } from '../../engine/index.js';
import { Material } from '../../engine/render/Material.js';
import { ShaderModule } from '../../engine/gpu/Shader.js';
import { Builder, Part } from '../village/GeoBuilder.js';

// A 16–18 mm paling is much narrower than a pixel in the establishing shot.
// Rasterising each cylinder there produces false diagonals as samples hit/miss
// the bars. Blend to an area-filtered planar representation before that happens.
// The transition follows projected bar width, including render scale and FOV.
const FILTER = new ShaderModule( { name: 'yardFenceFilter', code: /* wgsl */`
fn fenceDetail( P: vec3f ) -> f32 {
	let depth = max( 0.01, -( frame.view * vec4f( P, 1.0 ) ).z );
	let pixels = 0.018 * abs( frame.proj[1][1] ) * frame.resolution.y * 0.5 / depth;
	return smoothstep( 0.65, 1.3, pixels );
}
fn fenceIntegral( x: f32, duty: f32 ) -> f32 {
	return floor( x ) * duty + min( fract( x ), duty );
}
fn fenceBars( x: f32, footprint: f32, duty: f32 ) -> f32 {
	let w = max( footprint, 0.00001 );
	let coverage = ( fenceIntegral( x + w * 0.5 + duty * 0.5, duty )
		- fenceIntegral( x - w * 0.5 + duty * 0.5, duty ) ) / w;
	// Remove unresolved repetition gradually, preserving its average coverage.
	return mix( clamp( coverage, 0.0, 1.0 ), duty, smoothstep( 0.33, 0.85, w ) );
}
fn fenceBand( x: f32, lo: f32, hi: f32, footprint: f32 ) -> f32 {
	let w = max( footprint, 0.00001 );
	return clamp( min( x + w * 0.5, hi ) - max( x - w * 0.5, lo ), 0.0, w ) / w;
}
` } );

export function buildYardFence( frame, parts, start, end, bottom, z, iron ) {
	const fence = parts.yardFence ||= { detail: new Builder(), filtered: new Builder() };
	const B = fence.detail;
	B.frame.copy( frame );
	const height = 1.05, count = Math.max( 1, Math.round( ( end - start ) / 0.17 ) );
	for ( const y of [ bottom + 0.26, bottom + 0.81 ] ) B.box( 'hard', ( start + end ) / 2, y, z, end - start, 0.027, 0.025, iron );
	for ( let i = 0; i <= count; i ++ ) {
		const x = start + ( end - start ) * i / count, post = i % 12 === 0;
		B.rod( 'hard', [ x, bottom, z ], [ x, bottom + height, z ], post ? 0.017 : 0.009, post ? 0.014 : 0.008, { segs: 5, ...iron } );
		B.lathe( 'hard', x, bottom + height, z, [ [ 0.009, 0 ], [ 0.018, 0.027 ], [ 0.001, 0.085 ] ], { segs: 5, ...iron } );
	}
	const length = end - start, pad = 0.25;
	const xy = [ [ -pad, -pad ], [ length + pad, -pad ], [ length + pad, height + 0.085 + pad ], [ -pad, height + 0.085 + pad ] ];
	const p = [], n = [], uv = [];
	for ( const [ x, y ] of xy ) { p.push( x + start, y + bottom, z ); n.push( 0, 0, 1 ); uv.push( x, y ); }
	const F = fence.filtered;
	F.frame.copy( frame );
	F.add( 'fence', new Part( p, n, uv, [ 0, 1, 2, 0, 2, 3 ] ), new Matrix4(), iron.tint, [ length / count, length, 0, 0 ] );
}

export function assembleYardFence( parts, detailMaterial, bake ) {
	const fence = parts.yardFence;
	if ( ! fence ) return null;
	const group = new Group(); group.name = 'station-yard-fence';
	detailMaterial.name = 'YardFenceDetail';
	detailMaterial.transparent = true;
	detailMaterial.blending = 'normal';
	detailMaterial.depthWrite = false;
	detailMaterial.modules.push( FILTER );
	detailMaterial.surface += '\ns.alpha = fenceDetail( in.P );\n';
	detailMaterial.uniforms.maintenance.value = 1;
	const filtered = new Material( {
		name: 'YardFenceFiltered', color: 0x1c1d1d, roughness: 0.88, metalness: 0.25,
		transparent: true, side: 'double', depthWrite: false, velocityWeight: 0,
		modules: [ FILTER ], attributes: { vdata: 'vec4f' }, varyings: { vFence: 'vec2f' },
		vertex: 'o.vFence = v.vdata.xy;',
		surface: /* wgsl */`
	let spacing = in.vs.vFence.x;
	let length = in.vs.vFence.y;
	let footprint = max( fwidth( in.uv ), vec2f( 0.00001 ) );
	let body = fenceBand( in.uv.y, 0.0, 1.05, footprint.y );
	let bars = fenceBars( in.uv.x / spacing, footprint.x / spacing, 0.017 / spacing );
	let posts = fenceBars( in.uv.x / ( spacing * 12.0 ), footprint.x / ( spacing * 12.0 ), 0.031 / ( spacing * 12.0 ) );
	let rails = max( fenceBand( in.uv.y, 0.2465, 0.2735, footprint.y ), fenceBand( in.uv.y, 0.7965, 0.8235, footprint.y ) );
	let tips = fenceBand( in.uv.y, 1.05, 1.135, footprint.y )
		* fenceBars( in.uv.x / spacing, footprint.x / spacing, 0.020 / spacing );
	let vertical = max( bars, posts ) * body;
	let coverage = 1.0 - ( 1.0 - vertical ) * ( 1.0 - rails ) * ( 1.0 - tips );
	s.alpha = coverage * fenceBand( in.uv.x, -0.018, length + 0.018, footprint.x ) * ( 1.0 - fenceDetail( in.P ) );
`,
	} );
	for ( const [ name, builder, key, material, shadow ] of [
		[ 'yard-fence-detail', fence.detail, 'hard', detailMaterial, true ],
		[ 'yard-fence-filtered', fence.filtered, 'fence', filtered, false ],
	] ) {
		const mesh = new Mesh( builder.batches[ key ].build(), material );
		mesh.name = name; mesh.castShadow = shadow; mesh.receiveShadow = true;
		mesh.onBeforeRender = bake; group.add( mesh );
	}
	return group;
}
