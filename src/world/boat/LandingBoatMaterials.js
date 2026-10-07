import { standard } from '../../materials/Materials.js';
import { commonModule } from '../../engine/render/wgsl/common.js';

// Share the station's metre-scale, mipmapped fields and lighting model.
// Dampness stays in the moving boat frame; no new texture allocations.
export function detailedLandingMaterials( textures ) {
	const base = { modules: [ commonModule ], underwaterLighting: 'lite',
		attributes: { tint: 'vec3f', vdata: 'vec4f' },
		varyings: { vTint: 'vec3f', vData: 'vec4f', vBoat: 'vec3f' },
		vertex: 'o.vTint = v.tint; o.vData = v.vdata; o.vBoat = v.position;',
	};
	const wood = standard( { ...base, name: 'LandingStationTimber', roughness: 0.7,
		bindings: { arrivalWoodA: { texture: textures.indoorWoodA }, arrivalWoodN: { texture: textures.indoorWoodN }, arrivalPaintN: { texture: textures.keptPaintN } },
	} );
	wood.surface = /* wgsl */`
	let p = in.vs.vBoat; let d = in.vs.vData;
	let uv0 = in.uv;
	let end = step( 500.0, uv0.x );
	let uv = uv0 - vec2f( select( 0.0, select( 1000.0, 2000.0, uv0.x > 1500.0 ), end > 0.5 ), 0.0 );
	let q = uv / vec2f( 2.8, 0.76 ) + vec2f( d.x * 7.13, d.x * 3.71 );
	let A = textureSample( arrivalWoodA, smpAnisoRepeat, q );
	let N = textureSample( arrivalWoodN, smpAnisoRepeat, q );
	let paintN = textureSample( arrivalPaintN, smpAnisoRepeat, uv / vec2f( 1.0, 0.5 ) );
	let broad = mx_noise_float3( p * vec3f( 1.1, 2.4, 0.8 ) + vec3f( d.x * 17.0 ) );
	let contact = smoothstep( 0.0, 0.5, A.a ) * 0.12;
	let paint = d.y * ( 1.0 - contact );
	let damp = ( 1.0 - smoothstep( 0.18, 0.94, p.y ) ) * ( 0.72 + broad * 0.18 );
	let raw = vec3f( 0.19, 0.155, 0.105 ) * A.rgb * ( in.vs.vTint * 1.2 + 0.72 );
	s.albedo = mix( raw, in.vs.vTint * ( 0.97 + broad * 0.035 ), paint ) * ( 1.0 - damp * 0.23 );
	s.roughness = clamp( mix( N.b, paintN.b, paint ) - damp * 0.16 - contact * 0.08, 0.35, 0.9 );
	let nm = mix( N.rg, paintN.rg, paint ) * 2.0 - 1.0;
	s.normal = perturbNormalByMap( in.P, in.N, uv, normalize( vec3f( nm * ( 1.0 - end * 0.65 ), 1.0 ) ) );
	s.ao = mix( N.a, 1.0, paint );
`;
	const hard = standard( { ...base, name: 'LandingStationFittings', roughness: 0.65,
		bindings: { arrivalIronN: { texture: textures.castIronN }, arrivalRope: { texture: textures.rope } },
	} );
	hard.surface = /* wgsl */`
	let d = in.vs.vData; let p = in.vs.vBoat;
	let isRope = step( 1.5, d.w );
	let N = textureSample( arrivalIronN, smpAnisoRepeat, in.uv );
	let radius = max( d.w - 2.0, 0.004 );
	let R = textureSample( arrivalRope, smpAnisoRepeat, in.uv / ( radius * TWO_PI ) );
	let n = mx_noise_float3( p * 43.0 + vec3f( d.x * 7.0 ) );
	let rust = smoothstep( 0.1, 0.6, n ) * d.y;
	let hardCol = mix( in.vs.vTint * ( 0.94 + n * 0.07 ), vec3f( 0.2, 0.075, 0.025 ), rust );
	s.albedo = mix( hardCol, in.vs.vTint * mix( 0.52, 1.18, R.r ), isRope );
	s.roughness = mix( clamp( d.w + ( N.b - 0.55 ) * 0.18, 0.28, 0.98 ), 0.94, isRope );
	s.metalness = d.z * ( 1.0 - isRope );
	let nm = mix( ( N.rg * 2.0 - 1.0 ) * 0.25, R.ba * 2.0 - 1.0, isRope );
	s.normal = perturbNormalByMap( in.P, in.N, in.uv, normalize( vec3f( nm, 1.0 ) ) );
`;
	const cloth = standard( { ...base, name: 'LandingWorkCloth', roughness: 0.95 } );
	cloth.surface = /* wgsl */`
	let p = in.vs.vBoat;
	let folds = mx_noise_float3( p * vec3f( 9.0, 3.0, 9.0 ) );
	let px = max( length( fwidth( p ) ), 0.0001 );
	let near = 1.0 - smoothstep( 0.003, 0.012, px );
	let weave = sin( in.uv.x * 1700.0 ) * sin( in.uv.y * 1450.0 ) * near;
	s.albedo = in.vs.vTint * ( 0.94 + folds * 0.07 );
	s.roughness = in.vs.vData.w;
	let bump = folds * 0.001 + weave * 0.00012;
	s.normal = perturbNormalByHeight( in.P, in.N, dpdx( bump ), dpdy( bump ), 1.0 );
`;
	return { wood, hard, rope: hard, cloth };
}
