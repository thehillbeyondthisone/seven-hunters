// Geometry contracts for fitted stonework: packing, closed volumes, winding,
// apertures and bounded off-path reuse. Visual likeness is reviewed separately.
import assert from 'node:assert/strict';
import { Builder } from '../src/world/village/GeoBuilder.js';
import { stoneLayout, stoneBlock, fittedStoneWall, islandStoneScatter } from '../src/world/flannan/StoneMasonry.js';

const layout = stoneLayout( { length: 5.1, height: 1.75, seed: 32.1 } );
assert.deepEqual( layout, stoneLayout( { length: 5.1, height: 1.75, seed: 32.1 } ) );
assert.notDeepEqual( layout, stoneLayout( { length: 5.1, height: 1.75, seed: 32.2 } ) );
assert.equal( stoneLayout( { length: 0, height: 1 } ).length, 0 );
let sum = 0;
for ( let i = 0; i < layout.length; i ++ ) {
	const a = layout[i];
	assert( a.x0 >= 0 && a.x1 <= 5.1+1e-8 && a.y0 >= 0 && a.y1 <= 1.75+1e-8 );
	sum += (a.x1-a.x0)*(a.y1-a.y0);
	for ( const b of layout.slice(i+1) ) assert( Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0) < 1e-8 || Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0) < 1e-8 );
}
assert( Math.abs(sum-5.1*1.75) < 1e-7 );
assert( new Set(layout.map(a=>(a.y1-a.y0).toFixed(3))).size >= 3 );
console.log( 'ok   seeded packing fills its envelope without overlaps, with mixed stone heights' );

const tint = [.3,.31,.32];
for ( const unworked of [ false, true ] ) {
	const B = new Builder();
	stoneBlock( B, { x0: 0, x1: .7, y0: 0, y1: .3, back: -.5, front: 0, seed: 31, tint, unworked } );
	const batch = B.batches.stationMasonry;
	const edges = new Map();
	const vertex = i => batch.pos.slice(i*3,i*3+3);
	const key = p => p.map(v=>v.toFixed(7)).join(',');
	for ( let i = 0; i < batch.idx.length; i += 3 ) {
		const ids = batch.idx.slice(i,i+3), points = ids.map(vertex);
		const [a,b,c] = points, u = b.map((v,k)=>v-a[k]), v = c.map((v,k)=>v-a[k]);
		const normal = [ u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0] ];
		assert( Math.hypot(...normal) > 1e-10 );
		assert( normal.reduce((s,x,k)=>s+x*batch.nrm[ids[0]*3+k],0) > 0 );
		for ( let e = 0; e < 3; e ++ ) {
			const edge = [ key(points[e]),key(points[(e+1)%3]) ].sort().join('|');
			edges.set(edge,(edges.get(edge)||0)+1);
		}
	}
	assert( [...edges.values()].every(count=>count===2) );
	assert( batch.pos.some((v,i)=>i%3===2 && v<-.45) && batch.pos.some((v,i)=>i%3===2 && v>0) );
	assert( batch.data.filter((_,i)=>i%4===1).every(v=>v===3) );
	if ( unworked ) assert( new Set(batch.pos.filter((v,i)=>i%3===2 && v>-.2).map(v=>v.toFixed(3))).size > 5 );
}
console.log( 'ok   fitted and unworked stones are closed full-depth volumes with consistent face winding' );

// Independently clip projected triangles to the opening: checking only vertices
// would miss a triangle spanning the doorway with its vertices outside it.
function clip( poly, axis, value, sign ) {
	const out = [];
	for ( let i = 0; i < poly.length; i ++ ) {
		const a=poly[i],b=poly[(i+1)%poly.length],da=(a[axis]-value)*sign,db=(b[axis]-value)*sign;
		if (da>=0) out.push(a);
		if ((da>=0)!==(db>=0)) {const t=da/(da-db);out.push(a.map((v,k)=>v+(b[k]-v)*t));}
	}
	return out;
}
const door = { x0: .8, x1: 1.25, y0: -.5, y1: .95 }, wall = new Builder();
fittedStoneWall( wall, { length: 3.27, bottom: -.25, top: 2.5, depth: .65, seed: 2.71, dry: true, tint,
	contour: [[0,-.25],[3.27,-.25],[3.27,1.3],[1.635,2.5],[0,1.3]], openings:[door] } );
const W = wall.batches.stationMasonry;
for ( let i=0; i<W.idx.length; i+=3 ) {
	let poly = W.idx.slice(i,i+3).map(id=>[W.pos[id*3],W.pos[id*3+1]]);
	poly=clip(clip(clip(clip(poly,0,door.x0,1),0,door.x1,-1),1,door.y0,1),1,door.y1,-1);
	const area = Math.abs(poly.reduce((s,p,k)=>{const q=poly[(k+1)%poly.length];return s+p[0]*q[1]-q[0]*p[1];},0))/2;
	assert(area<1e-7,'stone triangle crosses doorway');
}
assert(W.pos.every(Number.isFinite));
assert(Math.max(...W.pos.filter((_,i)=>i%3===1))<=2.5+1e-8);
console.log( 'ok   dry-stone gable clipping leaves the complete narrow doorway clear' );

const terrain = { heightAt:()=>20, normalAt:(x,z,out)=>out.set(0,1,0), pathDistance:(x,z)=>Math.abs(z-55)-.5 };
const footprints = [{x:-3.5,z:55.5,r:2.2}], scatter = islandStoneScatter(new Builder(),terrain,footprints,tint);
assert(scatter.length>0 && scatter.length<=124);
for(const p of scatter) {
	assert(terrain.pathDistance(p.x,p.z)>=p.width+.7);
	assert(Math.hypot(p.x+3.5,p.z-55.5)>=2.2+p.width+.4);
}
assert.equal(islandStoneScatter(new Builder(),{...terrain,normalAt:(x,z,out)=>out.set(.8,.6,0)},[],tint).length,0);
console.log( 'ok   loose stone reuse is bounded and excludes paths, buildings and steep slopes' );
