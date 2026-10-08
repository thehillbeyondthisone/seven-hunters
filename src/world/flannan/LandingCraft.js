import { Vector3 } from '../../engine/index.js';
import { Part } from '../village/GeoBuilder.js';
import { buildRockGeometry } from '../terrain/RockGeometry.js';
import { lin, HARD, WOOD, ropeCoil } from '../Props.js';
import { mulberry32 } from '../../util/Noise.js';

// East landing photographs: tilted, fractured grey bedrock and small cast
// platforms perched on shelves. Individual rocks/fittings are reconstruction.
// A private random stream leaves the rest of the station's dressing unchanged.
function rockPart( width, height, depth, random ) {
	// Plane-carved subdivided slabs keep fractured silhouettes while avoiding
	// the large flat crystal faces of a simple extruded polygon.
	const geometry = buildRockGeometry( 2, Math.floor( random() * 100000 ), 2 );
	geometry.computeBoundingBox();
	const box = geometry.boundingBox, centre = box.getCenter( new Vector3() ), size = box.getSize( new Vector3() );
	const src = geometry.attributes.position.array, normal = geometry.attributes.normal.array;
	const p = [], n = [], uv = [], scale = [ width/size.x, height/size.y, depth/size.z ];
	for ( let i = 0; i < src.length; i += 3 ) {
		const x = (src[i]-centre.x)*scale[0], y = (src[i+1]-centre.y)*scale[1], z = (src[i+2]-centre.z)*scale[2];
		p.push( x, y, z );
		const v = new Vector3( normal[i]/scale[0], normal[i+1]/scale[1], normal[i+2]/scale[2] ).normalize();
		n.push( v.x, v.y, v.z ); uv.push( x + z * .37, y );
	}
	const part = new Part( p, n, uv, Array.from( geometry.index.array ) );
	geometry.dispose();
	return part;
}

export function dressEastLanding( ctx, L, at ) {
	const { B, terrain, colliders } = ctx, random = mulberry32( 19010103 ), y = L.stage.y;
	const stone = lin( 0x707b7a );
	const iron = { tint: lin( 0x343b3a ), data: HARD( .31, .23, .58, .5 ) };
	const concrete = { tint: lin( 0x858c85 ), data: [ .29, 0, 0, 0 ] };
	const rock = ( x, floor, z, w, h, d, yaw = 0, lean = .2 ) => {
		B.part( 'landingRock', rockPart( w, h, d, random ), x, floor + h * .43, z,
			{ ry: yaw, rz: lean, tint: stone.map( v => v * ( .85 + random() * .22 ) ), data: [ random(), 0, 0, 0 ] } );
	};
	const shelf = ( x, z, width, depth ) => {
		const p = [], n = [], uv = [], idx = [];
		const ground = ( a, b ) => { const wp = B.toWorld( a, 0, b ); return terrain.heightAt( wp.x, wp.z ); };
		const outline = [ [-.5,-.34], [-.25,-.5], [.38,-.45], [.5,-.13], [.43,.39], [.12,.5], [-.43,.36] ]
			.map( ( [a,b] ) => [a*(.8+random()*.4),b*(.8+random()*.4)] );
		const rim = outline.map( ( [ a,b ] ) => {
			const xx = x + a*width + b*depth*.27, zz = z+b*depth;
			return [xx, ground(xx,zz)-.08, zz];
		} );
		const raised = rim.map( v => {
			const xx = x+(v[0]-x)*.7, zz=z+(v[2]-z)*.7;
			return [xx,ground(xx,zz)+.09+random()*.15,zz];
		} );
		const face = vertices => {
			const normal = new Vector3().subVectors(new Vector3(...vertices[1]),new Vector3(...vertices[0]))
				.cross(new Vector3().subVectors(new Vector3(...vertices[2]),new Vector3(...vertices[0]))).normalize();
			const base=p.length/3;
			for(const v of vertices){p.push(...v);n.push(normal.x,normal.y,normal.z);uv.push(v[0],v[2]);}
			for(let i=1;i<vertices.length-1;i++)idx.push(base,base+i,base+i+1);
		};
		// Creased bevels and a broad crown make relief within the actual slope,
		// rather than free-standing stones in an evenly spaced ornamental row.
		const centre = [x,ground(x,z)+.21+random()*.12,z];
		for(let i=0;i<rim.length;i++){
			const j=(i+1)%rim.length;
			face([centre,raised[j],raised[i]]);
			face([raised[i],raised[j],rim[j],rim[i]]);
			face([rim[i],rim[j],[rim[j][0],rim[j][1]-.27,rim[j][2]],[rim[i][0],rim[i][1]-.27,rim[i][2]]]);
		}
		B.part('landingRock',new Part(p,n,uv,idx),0,0,0,{tint:stone,data:[random(),0,0,0]});
	};

	// A broken skirt conceals the submerged plinth; leave its top and the entire
	// centre of the boat approach clear. These volumes are embedded in bedrock.
	for ( const side of [ -1, 1 ] ) {
		rock( 3.2, -2.6, side * 4.1, 9.0, 5.0, 4.5, side * .08, -.25 );
		rock( 6.6, -2.4, side * 3.7, 3.5, 3.0, 3.2, side * .25, -.14 );
		for ( let i = 0; i < 8; i ++ ) {
			const x = -2.5 - i * 4.1 - random()*2.4;
			shelf( x, side*(3.7+random()*.9), 3.4+random()*3.6, 2.2+random()*.8 );
			if(i<6)shelf( x+random()*3.2, side*(7.1+random()*2.4), 4.0+random()*4.5, 2.8+random()*2.1 );
		}
	}
	// Low shelves on the seaward face, leaving the rungs and side stair exposed.
	rock( 6.35, -2.1, -.6, 2.5, 3.7, 3.3, -.08, -.25 );
	rock( 7.35, -2.0, 2.35, 2.1, 3.1, 1.8, .17, -.18 );

	// Photo-supported access language: iron rungs cast into the sea face and a
	// separate stair down to the water. Complete and maintained for January 1901.
	for ( let h = .38; h < y + .28; h += .31 ) {
		for ( const z of [ .85, 1.43 ] ) B.rod( 'hard', [ 7.47, h, z ], [ 7.73, h, z ], .021, .021, { segs: 8, ...iron } );
		B.rod( 'hard', [ 7.73, h, .85 ], [ 7.73, h, 1.43 ], .021, .021, { segs: 8, ...iron } );
	}
	for ( let i = 0; i < 11; i ++ ) {
		const h = y - i * .24, x = 7.38 + i * .28;
		B.box( 'landingConcrete', x, h - .15, -2.55, .31, .3, 1.12, concrete );
		colliders.addBox( B.toWorld( x, h-.15, -2.55 ), new Vector3( .155, .15, .56 ), Math.atan2( -L.dir[1], L.dir[0] ),
			{ walkable: true, solid: false, tag: 'landingAccess' } );
	}
	// A return handrail frames the first step without fencing off the approach.
	for ( const x of [ 2.0, 4.15, 6.3 ] ) {
		B.box( 'hard', x, y + .03, -3.07, .19, .055, .19, iron );
		B.rod( 'hard', [ x, y, -3.07 ], [ x, y + .98, -3.07 ], .025, .025, { segs: 8, ...iron } );
	}
	B.rod( 'hard', [ 2.0, y + .98, -3.07 ], [ 6.3, y + .98, -3.07 ], .025, .025, { segs: 8, ...iron } );
	for ( const z of [ .85, 1.43 ] ) {
		B.rod( 'hard', [ 7.73, y-.12, z ], [ 7.73, y+.7, z ], .025, .025, { segs: 8, ...iron } );
		B.rod( 'hard', [ 7.73, y+.7, z ], [ 7.23, y+.7, z ], .025, .025, { segs: 8, ...iron } );
	}
	// Rope laid at the side, legible from the boat and from the walking camera.
	ropeCoil( B, 5.9, y + .025, -2.25, .042, .38, 4, .51 );
	B.tube( 'rope', [ new Vector3( 5.9, y+.065, -2.25 ), new Vector3( 6.35, y+.05, -2.3 ),
		new Vector3( 6.6, y+.2, -2.6 ), new Vector3( 6.85, y+.12, -2.82 ) ], .033,
		{ tint: lin(0x786d50), data: [.37,0,0,0] } );
	// A slim communication pipe alongside the flight; exact routing is inferred.
	const end = Math.min( 35, L.steps.pts.length - 1 );
	for ( let t = 0; t < end; t ++ ) B.rod( 'hard', [ -t, at(t)+.13, 1.19 ], [ -t-1, at(t+1)+.13, 1.19 ], .021, .021, { segs: 6, ...iron } );
	B.rod( 'hard', [ 0, y+.13, 1.19 ], [ 0, y+1.05, 1.19 ], .027, .027, { segs: 8, ...iron } );
	B.cyl( 'hard', 0, y+1.05, 1.19, .105, .027, .14, { segs: 12, ...iron } );
	// Lash the stores at the side; the central walking route remains clear.
	B.box( 'stationTimber', -.75, y+.21, -2.2, .75, .42, .52, { tint:lin(0x77705e), data:WOOD(.24,.08,.25,.2) } );
	for ( const x of [ -.97, -.54 ] ) B.box( 'hard', x, y+.21, -2.2, .035, .43, .54, iron );
}
