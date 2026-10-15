import { Part } from '../village/GeoBuilder.js';
import { lin, WOOD, HARD } from '../Props.js';
import { ROOM_CRAFT_MODEL } from './RoomCraftModel.js';
import { physical } from '../../materials/Materials.js';

// Editable Blender prototypes, merged into the room's existing material batches.
// Finishes can be overridden without copying geometry or creating materials.
const finishes = {

	oak: [ 'stationTimber', 0x795b3d, WOOD( .4, .035 ) ],
	darkOak: [ 'stationTimber', 0x4f3e2c, WOOD( .43, .025 ) ],
	iron: [ 'hard', 0x343d39, HARD( .64, .025, .65, .43 ) ],
	black: [ 'hard', 0x181d1b, HARD( .42, 0, .1, .8 ) ],
	brass: [ 'hard', 0xa48a50, HARD( .45, .015, .85, .32 ) ],
	tin: [ 'hard', 0x858a80, HARD( .34, .015, .75, .44 ) ],
	linen: [ 'hard', 0xc8bea1, HARD( .48, 0, 0, .96 ) ],
	wool: [ 'hard', 0x465e73, HARD( .33, 0, 0, .98 ) ],
	oilskin: [ 'hard', 0xa18a4e, HARD( .35, .015, 0, .70 ) ],
	leather: [ 'hard', 0x493324, HARD( .61, .02, 0, .78 ) ],
	paper: [ 'hard', 0xe3d7ba, HARD( .39, 0, 0, .94 ) ],
	cream: [ 'hard', 0xd8d1ba, HARD( .23, 0, 0, .30 ) ],
	blue: [ 'hard', 0x40595e, HARD( .25, 0, 0, .32 ) ],
	glass: [ 'roomLampGlass', 0xdde5dd, [ .5, 1, 1, 0 ] ],
	slate: [ 'hard', 0x2e383b, HARD( .57, 0, 0, .87 ) ],
	chalk: [ 'hard', 0xcbd0bc, HARD( .45, 0, 0, .98 ) ],

};
const geometry = new Map();

export function roomCraft( B, name, x = 0, y = 0, z = 0, options = {}, overrides = {} ) {

	for ( const [ key, g ] of Object.entries( ROOM_CRAFT_MODEL[ name ] ) ) {

		const id = name + '/' + key, finish = key.split( '/' )[ 0 ];
		if ( ! geometry.has( id ) ) geometry.set( id, new Part( g.p, g.n, g.uv, g.idx ) );
		const [ material, color, defaults ] = finishes[ finish ];
		const data = defaults.slice();
		if ( options.seed !== undefined ) data[ 0 ] = options.seed;
		B.part( material, geometry.get( id ), x, y, z, { tint: lin( color ), data, ...options, ...overrides[ finish ] } );

	}

}

// Dedicated transparent surfaces keep a clear chimney from becoming an opaque
// village window. All room chimneys share one batch, as do the tiny flame meshes.
export function roomLampGlassMaterial() {
	const material = physical( { color:0xdde5dd, roughness:.06, ior:1.45, transparent:true, opacity:.12, side:'double', depthWrite:false, velocityWeight:0 } );
	material.name = 'room-lamp-clear-chimneys';
	material.surface = `
		let grazing = pow(1.0 - abs(dot(normalize(in.N), normalize(in.V))), 3.0);
		s.albedo = mat.color;
		s.alpha = 0.065 + grazing * 0.28;
		s.roughness = 0.06;
	`;
	return material;
}

export function roomLampFlameMaterial() {
	const material = physical( { transparent:true, depthWrite:false, side:'double', defines:{NO_LOCAL_LIGHTS:1} } );
	material.name = 'room-lamp-wicks';
	material.surface = `
		let nightOn = smoothstep(0.15, 0.75, frame.night);
		let flicker = 0.92 + 0.08 * sin(frame.time * 8.3) * sin(frame.time * 5.7);
		s.albedo = vec3f(0.0);
		s.alpha = nightOn * 0.84;
		s.emissive = vec3f(1.0, 0.59, 0.23) * nightOn * flicker * 6.0;
	`;
	return material;
}

export function roomLampFlame( B, x, y, z, scale = 1 ) {
	B.lathe('roomLampFlame',x,y-.01*scale,z,[[0,0],[.003,.003],[.006,.011],[.004,.022],[0,.034]],{segs:12,sx:scale,sy:scale,sz:scale});
}
