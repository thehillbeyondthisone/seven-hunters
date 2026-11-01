import { PerspectiveCamera } from '../engine/scene/Camera.js';
import { Matrix4, Vector3, Sphere, Frustum } from '../engine/math/index.js';
import { ShaderModule, UniformBlock } from '../engine/gpu/Shader.js';
import { shadowMapModule } from '../engine/render/wgsl/lighting.js';
import { createViewUniforms, setFrameCamera, G } from '../engine/render/Frame.js';
import { HandLampShadowCasters } from './HandLampShadowCasters.js';

export const handLampShadowParams = new UniformBlock( 'HandLampShadowParams', {
	enabled: [ 'f32', 0 ], layer: [ 'i32', 0 ], faceSize: [ 'f32', 512 ], mapSize: [ 'f32', 2048 ],
	position: [ 'vec3f', new Vector3() ], range: [ 'f32', 6.5 ],
	matrices: [ 'mat4x4f[6]', Array.from( { length: 6 }, () => new Matrix4() ) ],
}, { label: 'handLampShadow' } );

export const handLampShadowModule = new ShaderModule( {
	name: 'hand-lamp-shadow', deps: [ shadowMapModule ], uniforms: handLampShadowParams, uniformName: 'handLampShadow',
	code: /* wgsl */`
fn handLampShadowActive( source: vec3f ) -> bool {
	return handLampShadow.enabled > .5 && distance( source, handLampShadow.position ) < .01;
}

fn handLampShadowVisibility( P: vec3f, N: vec3f ) -> f32 {
	if ( handLampShadow.enabled < .5 ) { return 1.0; }
	let delta = P - handLampShadow.position;
	let dist = length( delta );
	if ( dist < .09 || dist > handLampShadow.range ) { return 1.0; }
	// A small normal offset keeps fine joinery from shadowing its own surface.
	// Volumes pass N=0: their samples receive no surface bias.
	let normalBias = .006 + .012 * ( 1.0 - abs( dot( N, delta / dist ) ) );
	let receiver = P + N * normalBias;
	let d = receiver - handLampShadow.position; let a = abs( d );
	var face = select( 1i, 0i, d.x >= 0.0 );
	if ( a.y > a.x && a.y >= a.z ) { face = select( 3i, 2i, d.y >= 0.0 ); }
	else if ( a.z > a.x && a.z > a.y ) { face = select( 5i, 4i, d.z >= 0.0 ); }
	let clip = handLampShadow.matrices[ face ] * vec4f( receiver, 1.0 );
	let ndc = clip.xyz / clip.w;
	let pixel = vec2f( ndc.x * .5 + .5, .5 - ndc.y * .5 ) * handLampShadow.faceSize;
	let tile = vec2f( f32( face % 3 ), f32( face / 3 ) ) * handLampShadow.faceSize;
	var visibility = 0.0;
	// Four bilinear depth comparisons soften the small flame's shadow edge.
	// Clamp within this face so filtering cannot read another atlas tile.
	for ( var y = 0; y < 2; y ++ ) {
		for ( var x = 0; x < 2; x ++ ) {
			let offset = ( vec2f( f32( x ), f32( y ) ) - .5 ) * 1.25;
			let uv = ( tile + clamp( pixel + offset, vec2f( .5 ), vec2f( handLampShadow.faceSize - .5 ) ) ) / handLampShadow.mapSize;
			visibility += textureSampleCompareLevel( sunShadowMap, smpShadow, uv, handLampShadow.layer, ndc.z - .00002 );
		}
	}
	return visibility * .25;
}
`,
} );

// Six conventional 90-degree views, packed into one extra shadow-array layer.
// Reuse the sun's depth pipelines, actual opaque geometry, and glass/alpha hooks.
const DIRECTIONS = [ [1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1] ];
const _target = new Vector3(), _sphere = new Sphere(), _vp = new Matrix4(), _frustum = new Frustum();

export class HandLampShadows {

	constructor( atlas, { size = 512 } = {} ) {

		this.atlas = atlas;
		this.size = Math.min( size, Math.floor( atlas.size / 3 ) );
		this.enabled = true;
		this.valid = false;
		this.faces = DIRECTIONS.map( ( dir, i ) => {
			const camera = new PerspectiveCamera( 90, 1, .06, 6.5 );
			camera.reversedDepth = false; camera.isShadowCamera = true;
			camera.up.set( 0, Math.abs( dir[ 1 ] ) ? 0 : 1, Math.abs( dir[ 1 ] ) ? -dir[ 1 ] : 0 );
			return { camera, block: createViewUniforms( 'lantern shadow ' + i ), dir: new Vector3( ...dir ), timestampWrites: null };
		} );
		this._lastPosition = new Vector3( Infinity, Infinity, Infinity );
		this._casters = [];
		this.casters = new HandLampShadowCasters();
		this.stats = { passes: 0, draws: 0, triangles: 0 };

	}

	prepare( scene ) { this.casters.prepare( scene ); }

	_near( mesh, position, range ) {

		const geometry = mesh.geometry;
		let sphere = mesh.isInstancedMesh ? mesh.boundingSphere : geometry.boundingSphere;
		if ( ! sphere && mesh.isInstancedMesh ) { mesh.computeBoundingSphere(); sphere = mesh.boundingSphere; }
		if ( ! sphere && ! mesh.isInstancedMesh ) { geometry.computeBoundingSphere(); sphere = geometry.boundingSphere; }
		if ( ! sphere || ! Number.isFinite( sphere.radius ) ) return true;
		_sphere.copy( sphere ).applyMatrix4( mesh.matrixWorld );
		return _sphere.center.distanceTo( position ) <= range + _sphere.radius;

	}

	render( scene, renderer, light ) {

		const U = handLampShadowParams.fields;
		this.stats = { passes: 0, draws: 0, triangles: 0 };
		U.enabled.value = 0;
		if ( ! this.enabled || ! this.atlas.enabled || this.atlas.localShadowLayer < 0 || ! light?.on || ! light.lantern || ( light.scale ?? 1 ) < .002 ) { this.valid = false; return; }
		const position = light.position, range = light.range;
		for ( const [ i, face ] of this.faces.entries() ) {
			const cam = face.camera;
			cam.position.copy( position ); cam.far = range; cam.updateProjectionMatrix();
			cam.lookAt( _target.copy( position ).add( face.dir ) ); cam.updateMatrixWorld();
			U.matrices.value[ i ].multiplyMatrices( cam.projectionMatrix, cam.matrixWorldInverse );
		}
		const lists = renderer.collect( scene, { kind: 'depth', camera: this.faces[ 0 ].camera, cull: false,
			layerMask: this.atlas.layerMask, filter: mesh => this._near( mesh, position, range ) } );
		const casters = [ ...lists.opaque, ...lists.transparent ];
		let changed = ! this.valid || ! position.equals( this._lastPosition ) || range !== this._lastRange || casters.length !== this._casters.length || renderer.precompiling;
		for ( let i = 0; i < casters.length; i ++ ) {
			const it = casters[ i ], previous = this._casters[ i ];
			if ( ! previous || previous.object !== it.object || previous.material !== it.material ||
				previous.version !== it.material.version || previous.geometry !== it.geometry ||
				previous.index !== it.geometry.index || previous.position !== it.geometry.attributes.position ||
				previous.start !== it.start || previous.count !== it.count ||
				previous.indexVersion !== it.geometry.index?.version || previous.positionVersion !== it.geometry.attributes.position?.version ||
				it.object.isSkinnedMesh || ! it.object.matrixWorld.elements.every( ( n, j ) => n === previous.matrix[ j ] ) ) changed = true;
		}
		// Refresh shader-deformed casters periodically even when their transforms
		// are still. Moving lamps and opening doors always update immediately.
		if ( Math.abs( G.time.value - ( this._lastTime ?? -Infinity ) ) > .15 ) changed = true;
		if ( changed ) {
			const selected = { opaque: lists.opaque.map( it => this.casters.select( it, position, range ) ), transparent: lists.transparent.map( it => this.casters.select( it, position, range ) ) };
			const depthView = this.atlas.texture.view( { dimension: '2d', baseArrayLayer: this.atlas.localShadowLayer, arrayLayerCount: 1 } );
			const before = { ...renderer.stats };
			for ( const [ i, face ] of this.faces.entries() ) {
				setFrameCamera( face.camera, this.size, this.size, { block: face.block } );
				_frustum.setFromProjectionMatrix( _vp.multiplyMatrices( face.camera.projectionMatrix, face.camera.matrixWorldInverse ), undefined, false );
				const visible = it => {
					const sphere = it.object.isInstancedMesh ? it.object.boundingSphere : it.geometry.boundingSphere;
					return ! sphere || ! Number.isFinite( sphere.radius ) || _frustum.intersectsSphere( _sphere.copy( sphere ).applyMatrix4( it.object.matrixWorld ) );
				};
				const items = { opaque: selected.opaque.filter( visible ), transparent: selected.transparent.filter( visible ) };
				renderer.render( scene, { label: 'lantern shadow ' + i, kind: 'depth', camera: face.camera, frameBlock: face.block,
					depthView, depthFormat: 'depth32float', clearDepth: i === 0 ? 1 : null, depthCompare: 'less-equal',
					viewport: [ ( i % 3 ) * this.size, Math.floor( i / 3 ) * this.size, this.size, this.size, 0, 1 ],
					items, depthBias: 2, depthBiasSlopeScale: 1.5, timestampWrites: face.timestampWrites } );
			}
			this.stats = { passes: 6, draws: renderer.stats.draws - before.draws, triangles: renderer.stats.triangles - before.triangles };
			this._casters = casters.map( it => ( { object: it.object, material: it.material, version: it.material.version, geometry: it.geometry,
				index: it.geometry.index, position: it.geometry.attributes.position, start: it.start, count: it.count,
				indexVersion: it.geometry.index?.version, positionVersion: it.geometry.attributes.position?.version, matrix: it.object.matrixWorld.elements.slice() } ) );
			this._lastPosition.copy( position ); this._lastRange = range; this._lastTime = G.time.value; this.valid = true;
		}
		U.position.value.copy( position ); U.range.value = range; U.layer.value = this.atlas.localShadowLayer;
		U.faceSize.value = this.size; U.mapSize.value = this.atlas.size; U.enabled.value = 1;

	}

}
