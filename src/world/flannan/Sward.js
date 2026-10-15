import { InstancedBufferGeometry, Float32BufferAttribute, Uint32BufferAttribute, InstancedBufferAttribute, Mesh, Group,
	Vector3, Matrix4, Box3, Frustum, DynamicDrawUsage } from '../../engine/index.js';
import { Texture } from '../../engine/gpu/Texture.js';
import { ShaderModule } from '../../engine/gpu/Shader.js';
import { standard } from '../../materials/Materials.js';
import { mulberry32, Noise2D, smoothstep } from '../../util/Noise.js';
import { FlannanSward as LegacySward } from './SwardLegacy.js';

// Blade taper, natural curvature and height-dependent wind adapted from Terra's MIT grass shaders
// by Mike Linkovich (2016–2017). See docs/licenses/terra-grass.txt. Native WGSL, no Terra assets.
// Historical photos support short maritime turf, not a measured 1901 species/colour/height survey.
export const SWARD = Object.freeze( {
	cell: 8, counts: [ 40960, 16384, 4096 ], segments: [ 3, 2, 1 ],
	near: 10, mid: 22, far: 48, minHeight: .065, maxHeight: .18,
} );

// Individual blades belong near the viewer on Quest; the terrain carries distant turf.
// Keep the desktop distribution and authoring profile intact.
export const QUEST_SWARD = Object.freeze( {
	...SWARD, counts: [ 8192, 2048, 256 ], segments: [ 2, 1, 1 ],
	near: 6, mid: 14, far: 28, widthScale: 1.8,
} );

// A shuffled stratified patch: every LOD is a prefix of the SAME seeded root distribution.
// Cells translate/wrap this patch rather than recycling roots around the moving camera.
export function swardRoots( seed = 1901 ) {
	const rand = mulberry32( seed ), count = SWARD.counts[ 0 ], columns = 160, rows = count / columns;
	const roots = Array.from( { length: count }, ( _, i ) => ( {
		x: ( i % columns + rand() ) / columns * SWARD.cell,
		z: ( Math.floor( i / columns ) + rand() ) / rows * SWARD.cell,
		yaw: rand() * Math.PI * 2, width: .006 + rand() * .005,
		height: SWARD.minHeight + Math.pow( rand(), 2 ) * ( SWARD.maxHeight - SWARD.minHeight ),
		lean: .04 + rand() * .24, curve: .07 + rand() * .24,
	} ) );
	for ( let i = count - 1; i > 0; i -- ) {
		const j = Math.floor( rand() * ( i + 1 ) ); [ roots[ i ], roots[ j ] ] = [ roots[ j ], roots[ i ] ];
	}
	return roots;
}

export function swardPatch( roots, level, profile = SWARD ) {
	const count = profile.counts[ level ], segments = profile.segments[ level ], vertices = segments * 2 + 1;
	const position = new Float32Array( count * vertices * 3 ), normal = new Float32Array( position.length );
	const uv = new Float32Array( count * vertices * 2 );
	const root = new Float32Array( count * vertices * 4 ), shape = new Float32Array( root.length );
	const indices = new Uint32Array( count * ( segments * 2 - 1 ) * 3 );
	let idx = 0;
	for ( let b = 0; b < count; b ++ ) {
		const r = roots[ b ], base = b * vertices;
		for ( let v = 0; v < vertices; v ++ ) {
			const k = base + v, tip = v === vertices - 1, t = tip ? 1 : Math.floor( v / 2 ) / segments;
			position[ k * 3 ] = tip ? 0 : v % 2 - .5; position[ k * 3 + 1 ] = t;
			normal[ k * 3 + 1 ] = 1;
			uv.set( [ tip ? .5 : v % 2, t ], k * 2 );
			root.set( [ r.x, r.z, r.yaw, ( b + .5 ) / profile.counts[ 0 ] ], k * 4 );
			shape.set( [ r.width * ( profile.widthScale || 1 ), r.height, r.lean, r.curve ], k * 4 );
		}
		for ( let s = 0; s < segments; s ++ ) {
			const k = base + s * 2;
			indices.set( [ k, k + 1, k + 2 ], idx ); idx += 3;
			if ( s < segments - 1 ) { indices.set( [ k + 2, k + 1, k + 3 ], idx ); idx += 3; }
		}
	}
	const g = new InstancedBufferGeometry();
	g.setAttribute( 'position', new Float32BufferAttribute( position, 3 ) );
	g.setAttribute( 'normal', new Float32BufferAttribute( normal, 3 ) );
	g.setAttribute( 'uv', new Float32BufferAttribute( uv, 2 ) );
	g.setAttribute( 'aRoot', new Float32BufferAttribute( root, 4 ) );
	g.setAttribute( 'aShape', new Float32BufferAttribute( shape, 4 ) );
	g.setIndex( new Uint32BufferAttribute( indices, 1 ) );
	return g;
}

// Conservative mask erosion leaves a margin even after bilinear filtering: roots stay off paved
// paths / building pads, cliffs, water and bare outcrops. Full island domain, no hard meadow rectangle.
export function buildSwardMask( terrain, footprints, seed = 1901 ) {
	const { res, texel, origin, heights, rock } = terrain, data = new Uint8Array( res * res );
	const noise = new Noise2D( seed ), n = new Vector3();
	for ( let j = 1; j < res - 1; j ++ ) for ( let i = 1; i < res - 1; i ++ ) {
		const k = j * res + i, y = heights[ k ];
		if ( y < 8 || y > 100 || rock[ k ] > .38 ) continue;
		const x = origin + ( i + .5 ) * texel, z = origin + ( j + .5 ) * texel;
		if ( footprints.some( f => Math.hypot( x - f.x, z - f.z ) < f.r + 1.05 ) ) continue;
		if ( terrain.pathDistance( x, z ) < 1.05 ) continue;
		terrain.normalAt( x, z, n );
		if ( n.y < .82 ) continue;
		const patch = noise.noise( x / 9, z / 9 ) * .5 + .5;
		const density = ( .62 + patch * .32 ) * smoothstep( .82, .96, n.y ) * ( 1 - smoothstep( .12, .38, rock[ k ] ) );
		data[ k ] = Math.round( density * 255 );
	}
	return data;
}

export class FlannanSward {
	constructor( { scene, terrain, village, seed = 1901, profile = SWARD } ) {
		// Bounded visual comparison / fallback, never changes save data or story progress.
		if ( new URLSearchParams( globalThis.location?.search || '' ).get( 'grass' ) === 'legacy' ) return new LegacySward( { scene, terrain, village, seed } );
		this.terrain = terrain;
		this.profile = profile;
		this.group = new Group(); this.group.name = 'Flannan maritime turf · Terra blades';
		this.mask = buildSwardMask( terrain, village.getFootprints(), seed );
		this.heightTex = new Texture( { label: 'swardHeights', width: terrain.res, height: terrain.res, format: 'r32float', data: terrain.heights } );
		this.maskTex = new Texture( { label: 'swardMask', width: terrain.res, height: terrain.res, format: 'r8unorm', data: this.mask } );
		this.material = swardMaterial( this );
		const roots = swardRoots( seed );
		// The square enclosing the entire range is an upper bound even with no frustum culling.
		this.levels = profile.counts.map( ( _, level ) => {
			const radius = [ profile.near, profile.mid, profile.far ][ level ];
			const max = ( Math.ceil( radius * 2 / profile.cell ) + 3 ) ** 2;
			const geometry = swardPatch( roots, level, profile ), arr = new Float32Array( max * 4 );
			const attr = new InstancedBufferAttribute( arr, 4 ); attr.setUsage( DynamicDrawUsage );
			geometry.setAttribute( 'iCell', attr ); geometry.instanceCount = 0;
			const mesh = new Mesh( geometry, this.material ); mesh.name = `sward-${ level }`;
			mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true;
			mesh.matrixAutoUpdate = false; this.group.add( mesh );
			return { geometry, arr, attr, mesh, max, count: 0 };
		} );
		this.cellsPerSide = Math.ceil( terrain.size / SWARD.cell );
		this.cells = new Map();
		for ( let j = 0; j < terrain.res; j ++ ) for ( let i = 0; i < terrain.res; i ++ ) {
			const k = j * terrain.res + i;
			if ( ! this.mask[ k ] ) continue;
			const ci = Math.floor( ( i + .5 ) * terrain.texel / SWARD.cell ), cj = Math.floor( ( j + .5 ) * terrain.texel / SWARD.cell );
			const key = cj * this.cellsPerSide + ci, y = terrain.heights[ k ];
			const c = this.cells.get( key );
			if ( c ) { c.min = Math.min( c.min, y ); c.max = Math.max( c.max, y ); }
			else this.cells.set( key, { min: y, max: y } );
		}
		this._frustum = new Frustum(); this._matrix = new Matrix4(); this._box = new Box3();
		this._last = new Float64Array( 32 ).fill( NaN );
		this.stats = { tiles: this.cells.size, triangles: 0, visibleCells: [ 0, 0, 0 ] };
		scene.add( this.group );
	}
	update( camera ) {
		const m = camera.matrixWorld.elements, p = camera.projectionMatrix.elements;
		if ( m.every( ( v, i ) => v === this._last[ i ] ) && p.every( ( v, i ) => v === this._last[ 16 + i ] ) ) return;
		this._last.set( m ); this._last.set( p, 16 );
		this._matrix.multiplyMatrices( camera.projectionMatrix, camera.matrixWorldInverse );
		this._frustum.setFromProjectionMatrix( this._matrix, camera.coordinateSystem, camera.reversedDepth );
		const cx = m[ 12 ], cz = m[ 14 ], { origin } = this.terrain, { cell, far, near, mid } = this.profile;
		const n = this.cellsPerSide;
		for ( const l of this.levels ) l.count = 0;
		for ( let j = Math.max( 0, Math.floor( ( cz - far - origin ) / cell ) ); j <= Math.min( n - 1, Math.floor( ( cz + far - origin ) / cell ) ); j ++ ) {
			for ( let i = Math.max( 0, Math.floor( ( cx - far - origin ) / cell ) ); i <= Math.min( n - 1, Math.floor( ( cx + far - origin ) / cell ) ); i ++ ) {
				const c = this.cells.get( j * n + i ); if ( ! c ) continue;
				const x = origin + i * cell, z = origin + j * cell;
				const d = Math.hypot( Math.max( x - cx, 0, cx - x - cell ), Math.max( z - cz, 0, cz - z - cell ) );
				if ( d > far ) continue;
				this._box.min.set( x - .25, c.min - .5, z - .25 );
				this._box.max.set( x + cell + .25, c.max + .5, z + cell + .25 );
				if ( ! this._frustum.intersectsBox( this._box ) ) continue;
				const l = this.levels[ d < near ? 0 : d < mid ? 1 : 2 ];
				l.arr.set( [ x, z, 0, 0 ], l.count * 4 ); l.count ++;
			}
		}
		for ( const l of this.levels ) {
			l.geometry.instanceCount = l.count;
			l.attr.clearUpdateRanges(); l.attr.addUpdateRange( 0, Math.max( 1, l.count ) * 4 ); l.attr.needsUpdate = true;
		}
		this.stats.visibleCells = this.levels.map( l => l.count ); this.stats.triangles = this.triangles;
	}
	get triangles() { return this.levels.reduce( ( sum, l ) => sum + l.count * l.geometry.index.count / 3, 0 ); }
	dispose() {
		this.group.removeFromParent();
		for ( const l of this.levels ) l.geometry.dispose();
		this.material.dispose(); this.heightTex.destroy(); this.maskTex.destroy();
	}
}

function swardMaterial( field ) {
	const t = field.terrain, p = field.profile, f = x => Number( x ).toFixed( 6 );
	const bladeModule = new ShaderModule( { name: 'maritimeSward', code: /* wgsl */`
fn swHash( p: vec2f ) -> f32 { return fract( sin( dot( p, vec2f( 127.1, 311.7 ) ) ) * 43758.5453 ); }
// Progressive density and width compensation are continuous BEFORE each cell's LOD swap.
fn swDensity( d: f32 ) -> f32 {
	return mix( 1.0, .4, smoothstep( ${ f( p.near * .5 ) }, ${ f( p.near ) }, d ) ) * mix( 1.0, .25, smoothstep( ${ f( p.mid * 14 / 22 ) }, ${ f( p.mid ) }, d ) );
}
struct SwBlade { position: vec3f, normal: vec3f };
fn swBlade( xz: vec2f, ground: f32, shape: vec4f, yaw: f32, across: f32, h: f32, rank: f32,
	density: f32, time: f32, cam: vec3f ) -> SwBlade {
	let d = length( xz - cam.xz );
	let fraction = swDensity( d );
	let keep = ( 1.0 - smoothstep( fraction - .02, fraction, rank ) ) * ( 1.0 - smoothstep( ${ f( p.far * 2 / 3 ) }, ${ f( p.far ) }, d ) );
	let present = smoothstep( swHash( xz * 7.13 ) - .025, swHash( xz * 7.13 ) + .025, density ) * select( 0.0, 1.0, density > .001 );
	let growth = .92 + .18 * sin( xz.x * .21 + sin( xz.y * .17 ) );
	let height = shape.y * growth;
	let front = vec2f( -sin( yaw ), cos( yaw ) );
	let side = vec3f( cos( yaw ), 0.0, sin( yaw ) );
	let gust = .5 + .28 * sin( dot( xz, vec2f( .19, .12 ) ) - time * 1.1 )
		+ .22 * sin( dot( xz, vec2f( -.11, .27 ) ) - time * .67 );
	let wind = min( frame.windSpeed / 18.0, 1.4 );
	let flutter = sin( time * 4.0 + yaw * .2 * height + xz.x + xz.y );
	// Terra's cubic taper and increasing lean/curve. Direction normalisation preserves blade length.
	let angle = shape.z + ( shape.w * 2.0 + .07 * flutter ) * h;
	let natural = vec3f( front.x * sin( angle ), cos( angle ), front.y * sin( angle ) );
	let direction = normalize( natural + vec3f( frame.windDir.x, 0.0, frame.windDir.y ) * ( h * wind * ( .24 + gust * .62 ) ) );
	let width = shape.x * min( 3.2, inverseSqrt( fraction ) ) * ( 1.0 - h * h * h );
	let base = vec3f( xz.x, ground - .012, xz.y );
	let offset = direction * ( height * h ) + side * ( across * width );
	return SwBlade( base + offset * keep * present, normalize( cross( side, direction ) * .55 + vec3f( 0.0, .75, 0.0 ) ) );
}
` } );
	return standard( {
		name: 'FlannanTerraSward', side: 'double', roughness: .88, localLightsCheap: p === QUEST_SWARD,
		attributes: { iCell: 'vec4f', aRoot: 'vec4f', aShape: 'vec4f' },
		textures: { swardHeights: field.heightTex, swardMask: field.maskTex }, modules: [ bladeModule ],
		varyings: { vSward: 'vec4f' },
		vertex: /* wgsl */`
	let shift = vec2f( swHash( v.iCell.xy ), swHash( v.iCell.yx + 41.0 ) ) * 8.0;
	let local = v.aRoot.xy + shift;
	let xz = v.iCell.xy + local - floor( local / 8.0 ) * 8.0;
	let hf = ( xz - ${ f( t.origin ) } ) / ${ f( t.texel ) } - .5;
	let ij = vec2i( clamp( floor( hf ), vec2f( 0.0 ), vec2f( ${ f( t.res - 2 ) } ) ) );
	let w = fract( hf );
	let ground = mix( mix( textureLoad( swardHeights, ij, 0 ).r, textureLoad( swardHeights, ij + vec2i( 1, 0 ), 0 ).r, w.x ),
		mix( textureLoad( swardHeights, ij + vec2i( 0, 1 ), 0 ).r, textureLoad( swardHeights, ij + vec2i( 1, 1 ), 0 ).r, w.x ), w.y );
	let mask = textureSampleLevel( swardMask, smpLinearClamp, ( xz - ${ f( t.origin ) } ) / ${ f( t.size ) }, 0.0 ).r;
	let yaw = v.aRoot.z + swHash( v.iCell.xy + 17.0 ) * 6.283185;
	let blade = swBlade( xz, ground, v.aShape, yaw, v.position.x, v.uv.y, v.aRoot.w, mask, frame.time, frame.cameraPos );
	v.useWorld = true; v.worldPos = blade.position; v.worldNormal = blade.normal;
#if PASS_MAIN
	let prev = swBlade( xz, ground, v.aShape, yaw, v.position.x, v.uv.y, v.aRoot.w, mask, frame.time - frame.dt, frame.prevCameraPos );
	v.prevWorldPos = prev.position;
#endif
	let tonePatch = .5 + .5 * sin( xz.x * .073 + sin( xz.y * .091 ) * 2.0 );
	o.vSward = vec4f( v.uv.y, swHash( xz * 2.31 ), tonePatch, v.uv.x );
`,
		surface: /* wgsl */`
	let h = in.vs.vSward.x; let rnd = in.vs.vSward.y; let tonePatch = in.vs.vSward.z;
	// Linear colours: subdued living olive mixed with old straw. No ornamental flowers / seed heads.
	let green = mix( vec3f( .105, .142, .045 ), vec3f( .18, .205, .075 ), tonePatch );
	let straw = vec3f( .29, .245, .115 );
	let dry = smoothstep( .70, .94, rnd + tonePatch * .15 );
	let tone = mix( green, straw, dry * .7 );
	let root = tone * vec3f( .42, .40, .32 );
	s.albedo = mix( root, tone, smoothstep( .02, .85, h ) ) * ( .88 + rnd * .24 );
	// A restrained centre rib gives Terra's leaf detail without an alpha / texture card.
	s.albedo *= 1.0 + pow( 1.0 - abs( in.vs.vSward.w * 2.0 - 1.0 ), 6.0 ) * .09;
	s.ao = mix( .48, 1.0, smoothstep( 0.0, .8, h ) );
	s.specularIntensity = .32;
	s.translucency = s.albedo * ( .55 * smoothstep( .1, 1.0, h ) );
`,
	} );
}
