// Metre-scale, periodic height / roughness fields for the maintained station.
// Baked once with VillageTextures' Sobel normal + mip chain. No lighting is
// painted into the colour/mask maps. RG = normal XY, B = roughness, A = AO.
// Construction, joints and silhouettes remain in the existing geometry.
export const STATION_SURFACE_SETS = [
	{ name: 'stationWood', w: 1024, h: 512, mx: 2.8, my: .76, hs: .0009, ao: .35, out: 'indoorWoodA', nra: 'indoorWoodN' },
	{ name: 'stationPlaster', w: 512, h: 512, mx: 1.6, my: 1.6, hs: .002, ao: .3, out: 'limeA', nra: 'limeN' },
	{ name: 'stationPaint', w: 512, h: 512, mx: 1, my: .5, hs: .00065, ao: .2, out: null, nra: 'keptPaintN' },
	{ name: 'stationIron', w: 512, h: 512, mx: 1, my: 1, hs: .0012, ao: .35, out: null, nra: 'castIronN' },
];

export const STATION_SURFACE_FIELDS = {
	stationWood: /* wgsl */`
fn vlgGen( X: f32, Y: f32 ) -> VlgOut {
	// Occasional small knots; the surrounding growth rings bend around them.
	let k = vlgPwr( X, Y, 5.0, 5.0, 1201.0, .85 );
	let knotMask = step( .84, k.w );
	let radius = length( k.xy * vec2f( 2.8 / 5.0, .76 / 5.0 ) );
	let influence = exp( -radius * 38.0 ) * knotMask;
	let core = ( 1.0 - smoothstep( .009, .024, radius ) ) * knotMask;
	let warp = vlgPf( X, Y, 2.0, 4.0, 3, 1203.0, .5 );
	let rings = Y * 74.0 + warp * 2.8 + influence * 5.5;
	let growth = .5 + .5 * sin( rings * VLG_TAU );
	let late = smoothstep( .68, .95, growth );
	let fibres = vlgPn( X, Y, 9.0, 200.0, 1207.0 );
	let pores = smoothstep( .18, .5, -vlgPn( X, Y, 24.0, 160.0, 1209.0 ) );
	let broad = vlgN01( vlgPf( X, Y, 3.0, 5.0, 3, 1211.0, .5 ) );
	let wear = smoothstep( .45, .8, broad );
	let height = .5 + late * .12 + fibres * .038 - pores * .035 - core * .06;
	let tone = .96 - late * .16 + fibres * .025 - core * .25;
	let rough = clamp( .68 + late * .1 + pores * .08 - wear * .17, .46, .88 );
	return VlgOut( vec4f( height, rough, 1.0 - pores * .04, 0.0 ), vec4f( vec3f( tone ) * vec3f( 1.0, .985, .96 ), wear ) );
}
`,
	stationPlaster: /* wgsl */`
fn vlgGen( X: f32, Y: f32 ) -> VlgOut {
	let broad = vlgPf( X, Y, 3.0, 3.0, 3, 1301.0, .5 );
	let warp = vlgPn( X, Y, 4.0, 4.0, 1303.0 );
	// Overlapping shallow trowel sweeps, with fine lime/sand pores above them.
	let trowel = vlgPn( X + warp * .025, Y, 8.0, 17.0, 1305.0 );
	let film = vlgPn( X, Y, 11.0, 64.0, 1307.0 );
	let sand = vlgPn( X, Y, 135.0, 135.0, 1309.0 );
	let pore = smoothstep( .25, .56, -sand );
	let height = .5 + broad * .22 + trowel * .13 + film * .028 + sand * .024 - pore * .055;
	let rough = clamp( .88 + trowel * .05 + pore * .07 - broad * .025, .79, .98 );
	return VlgOut( vec4f( height, rough, 1.0 - pore * .03, 0.0 ), vec4f( vlgN01( broad ), pore, vlgN01( trowel ), 1.0 ) );
}
`,
	stationPaint: /* wgsl */`
fn vlgGen( X: f32, Y: f32 ) -> VlgOut {
	let body = vlgPf( X, Y, 4.0, 7.0, 3, 1401.0, .5 );
	let brush = vlgPn( X, Y, 6.0, 160.0, 1403.0 );
	let under = vlgPn( X, Y, 3.0, 36.0, 1405.0 );
	let grain = vlgPn( X, Y, 160.0, 160.0, 1407.0 );
	let height = .5 + brush * .085 + under * .045 + body * .025 + grain * .012;
	let rough = clamp( .54 + body * .11 + brush * .035, .4, .7 );
	return VlgOut( vec4f( height, rough, 1.0, 0.0 ), vec4f( 0.0 ) );
}
`,
	stationIron: /* wgsl */`
fn vlgGen( X: f32, Y: f32 ) -> VlgOut {
	let casting = vlgPf( X, Y, 28.0, 28.0, 3, 1501.0, .5 );
	let fine = vlgPn( X, Y, 150.0, 150.0, 1503.0 );
	let finish = vlgPf( X, Y, 4.0, 5.0, 3, 1505.0, .5 );
	let pits = smoothstep( .34, .62, -fine );
	let height = .5 + casting * .14 + fine * .03 - pits * .055;
	let rough = clamp( .53 + finish * .15 + casting * .07 + pits * .13, .36, .82 );
	return VlgOut( vec4f( height, rough, 1.0 - pits * .055, 0.0 ), vec4f( 0.0 ) );
}
`,
};
