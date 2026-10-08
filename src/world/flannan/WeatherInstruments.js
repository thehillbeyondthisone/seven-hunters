import { Group, Mesh, Vector3 } from '../../engine/index.js';
import { standard } from '../../materials/Materials.js';
import { Builder, Part, quad01Part } from '../village/GeoBuilder.js';
import { loadTexture } from '../marine/WhaleTextures.js';
import { HARD, lin } from '../Props.js';
import { G } from '../../core/Globals.js';
import { pressureAt, pressureAngle, temperatureAt } from '../../weather/WeatherReadings.js';

// Designs/placement are reconstructions; the cupola arrow follows the retained
// original lantern drawing. Faces are local assets and work in headless renders.
export async function loadWeatherInstruments( village ) {
	const parts = village.station.parts, group = new Group();
	group.name = 'station-weather-instruments';
	const base = ( import.meta.env?.BASE_URL || '/' ) + 'instruments/';
	const face = async ( name, at, width, height, ry = 0 ) => {
		const texture = await loadTexture( base + name + '.png', true );
		const material = standard( { name: name + '-face', roughness: .85, textures: { instrumentFace: texture }, surface:
			's.albedo = textureSample( instrumentFace, smpAnisoClamp, vec2f( in.uv.x, 1.0-in.uv.y ) ).rgb;' } );
		let geometry = quad01Part( width, height );
		if ( name === 'barometer' ) {
			const p = [ 0, 0, 0 ], n = [ 0, 0, 1 ], uv = [ .5, .5 ], idx = [];
			for ( let i = 0; i <= 64; i++ ) { const a = i/64*Math.PI*2, x = Math.cos(a), y = Math.sin(a); p.push(x*width/2,y*height/2,0); n.push(0,0,1); uv.push(x*.5+.5,y*.5+.5); if(i) idx.push(0,i,i+1); }
			geometry = new Part( p, n, uv, idx );
		}
		const B = new Builder(); B.part( 'face', geometry, 0, 0, 0 );
		const mesh = new Mesh( B.batches.face.build(), material );
		mesh.position.copy( at ); mesh.rotation.y = ry; mesh.receiveShadow = true;
		mesh.name = name + '-graduated-face'; group.add( mesh ); return mesh;
	};
	await face( 'barometer', parts.barometerFace, .188, .188 );
	await face( 'thermometer', parts.thermometerFace, .13, .52, Math.PI );
	const B = new Builder();
	B.rod( 'hard', [ 0, -.022, 0 ], [ 0, .077, 0 ], .0027, .0007, { segs: 6, tint: lin( 0x232620 ), data: HARD( .2, 0, .5, .5 ) } );
	const needle = new Mesh( B.batches.hard.build(), village.materials.hard );
	needle.position.copy( parts.barometerFace ).add( new Vector3( 0, 0, .0015 ) );
	needle.name = 'barometer-pressure-pointer'; group.add( needle );
	const columnB = new Builder();
	columnB.box( 'hard', 0, .5, 0, .0028, 1, .001, { tint: lin( 0x9b3227 ), data: HARD( .2, 0, .1, .4 ) } );
	const column = new Mesh( columnB.batches.hard.build(), village.materials.hard );
	column.name = 'thermometer-liquid-column';
	column.position.copy( parts.thermometerFace ).add( new Vector3( -.017, -.177, -.0015 ) ); group.add( column );
	const vane = new Group(); vane.name = 'cupola-wind-vane'; vane.position.copy( parts.windVane );
	const V = new Builder(), iron = { tint: lin( 0x242626 ), data: HARD( .5, .1, .55, .5 ) };
	// Arrow points along local +X. Tail fins echo sheet no. 1 without inventing a new weather post.
	V.rod( 'hard', [ -.56, 0, 0 ], [ .56, 0, 0 ], .008, .008, { segs: 5, ...iron } );
	V.box( 'hard', -.31, .02, 0, .38, .16, .014, iron );
	V.rod( 'hard', [ .42, -.09, 0 ], [ .62, 0, 0 ], .012, .012, { segs: 5, ...iron } );
	V.rod( 'hard', [ .42, .09, 0 ], [ .62, 0, 0 ], .012, .012, { segs: 5, ...iron } );
	const arrow = new Mesh( V.batches.hard.build(), village.materials.hard ); arrow.castShadow = true;
	vane.add( arrow ); group.add( vane ); village.scene.add( group );
	const result = { group, needle, column, vane, update( hour ) {
		needle.rotation.z = -pressureAngle( pressureAt( hour ) );
		column.scale.y = ( temperatureAt( hour ) - 20 ) / 40 * .335;
		vane.rotation.y = -Math.atan2( -G.windDir.value.y, -G.windDir.value.x );
	} };
	result.update( 18 ); return result;
}
