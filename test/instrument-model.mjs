import assert from 'node:assert/strict';
import { INSTRUMENT_MODEL } from '../src/world/flannan/InstrumentModel.js';
import { instrumentBuilder } from '../src/world/flannan/InstrumentCraft.js';

// Check the Blender -> custom engine conversion, its close-up mesh budget, and
// the unglazed openings needed by the separate animated instrument faces.
let triangles = 0;
for ( const [ name, finishes ] of Object.entries( INSTRUMENT_MODEL ) ) {
 const bounds = [ [ Infinity, -Infinity ], [ Infinity, -Infinity ], [ Infinity, -Infinity ] ];
 for ( const [ finish, part ] of Object.entries( finishes ) ) {
  const count = part.p.length/3;
  assert.equal( part.n.length, part.p.length ); assert.equal( part.uv.length, count*2 );
  assert.ok( [ ...part.p, ...part.n, ...part.uv ].every( Number.isFinite ), `${ name }/${ finish }: finite export` );
  assert.ok( part.idx.every( i => Number.isInteger( i ) && i >= 0 && i < count ), 'valid indices' );
  for ( let i=0; i<count; i++ ) {
   assert.ok( Math.abs( Math.hypot( ...part.n.slice( i*3, i*3+3 ) ) - 1 ) < .001, 'unit engine normals' );
   for ( let a=0; a<3; a++ ) { bounds[a][0]=Math.min(bounds[a][0],part.p[i*3+a]); bounds[a][1]=Math.max(bounds[a][1],part.p[i*3+a]); }
  }
  triangles += part.idx.length/3;
 }
 const B = instrumentBuilder( name );
 assert.ok( Object.values( B.batches ).every( batch => batch.build().attributes.position.count > 0 ), 'all exported finishes build in the engine' );
 if ( name==='telescope' ) {
  assert.ok( bounds[0][0] >= -.42 && bounds[0][1] <= .43 && bounds[1][0] >= -.045 && bounds[1][1] <= .045, 'scope fits its pickup envelope' );
 } else {
  assert.ok( bounds[2][0] > -.065 && bounds[2][1] < .12, 'wall models retain shallow metre-scale depth' );
 }
}
assert.ok( triangles < 16000, 'combined close-up instrument mesh budget' );
// The case can project around a face, but must not place an opaque cap over it.
const g = INSTRUMENT_MODEL.barometer.brass;
for ( let t=0; t<g.idx.length; t+=3 ) {
 const p=g.idx.slice(t,t+3).map(i=>g.p.slice(i*3,i*3+3));
 const centre=[0,1,2].map(a=>p.reduce((s,v)=>s+v[a],0)/3);
 const radius=Math.hypot(centre[0],centre[1]);
 assert.ok( centre[2] < 0 || radius < .008 || radius > .09, 'dial remains open except its small pointer cap' );
}
console.log( `PASS Blender export: ${ triangles } triangles, finite indexed geometry, unit normals, engine batches, pickup bounds and open dial.` );
