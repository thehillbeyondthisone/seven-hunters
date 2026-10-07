// Replay the terrain vertex lattice along real shared edges at both landing
// flights. The cliff relief previously left up to 72 cm between these polylines.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { FlannanTerrainData } from '../src/world/flannan/FlannanTerrain.js';
import { loadFlannanData } from '../src/world/flannan/FlannanData.js';
import { buildStation } from '../src/world/flannan/Station.js';
import { Builder } from '../src/world/village/GeoBuilder.js';
import { InstancedProps, Rand } from '../src/world/Props.js';
import { Colliders } from '../src/world/Colliders.js';
import { mulberry32 } from '../src/util/Noise.js';
import { CDLOD } from '../src/core/CDLOD.js';
import { PerspectiveCamera, Vector3 } from '../src/engine/index.js';

const DATA = new URL( '../public/terrain/flannan/', import.meta.url );
globalThis.fetch = async u => new Response( readFileSync( new URL( String( u ).split( '/' ).pop(), DATA ) ) );
const F = await loadFlannanData();
export const terrain = new FlannanTerrainData( F.grids.island );
const B = new Builder();
buildStation( { B, terrain, colliders: new Colliders(), rand: new Rand( mulberry32( 90210 ) ), lights: [], inst: new InstancedProps( B ), checks: [] }, { buildings: [], footprints: [] } );
terrain.buildMinMax();
export const views = {};
for ( const name of [ 'east', 'west' ] ) for ( const t of [ 8, 20, 35 ] ) {
  const L = terrain.landing( name ), p = L.steps.pts, q = p[ Math.min( t, p.length - 2 ) ], target = p[ Math.min( t + 25, p.length - 1 ) ];
  views[ `${ name }Steps${ t }` ] = { p: [ q[0], q[1] + 1.78, q[2] ], at: [ target[0], target[1] + 1.62, target[2] ], time: 13.78, fov: 70 };
}

const lod = new CDLOD( { gridSize: 40, leafSize: 8, levels: 9, rangeFactor: 2, stitchEdges: true, heightBounds: ( x, z, xx, zz ) => terrain.boundsFor( x, z, xx, zz ), center: { x: terrain.origin, z: terrain.origin, size: terrain.size } } );
const camera = new PerspectiveCamera( 70, 1431 / 874, .1, 6000 );
const morph = ( node, x, z ) => {
  let level = node[3];
  if ( x < node[0] + 1e-5 ) level = Math.max( level, node.edges[0] );
  if ( x > node[0] + node[2] - 1e-5 ) level = Math.max( level, node.edges[1] );
  if ( z < node[1] + 1e-5 ) level = Math.max( level, node.edges[2] );
  if ( z > node[1] + node[2] - 1e-5 ) level = Math.max( level, node.edges[3] );
  const h = lod.uSpacing.array[ level ], m = lod.uMorph.array[ level ];
  const ix = Math.floor( x / h + 1e-3 ), iz = Math.floor( z / h + 1e-3 );
  x = ix * h; z = iz * h;
  const y = terrain.heightAt( x, z );
  const d = Math.hypot( x - camera.position.x, y - camera.position.y, z - camera.position.z );
  const k = Math.max( 0, Math.min( 1, ( d - m.x ) * m.y ) );
  x -= ( ( ix % 2 + 2 ) % 2 ) * h * k;
  z -= ( ( iz % 2 + 2 ) % 2 ) * h * k;
  return [ x, terrain.heightAt( x, z ), z ];
};
for ( const [ name, view ] of Object.entries( views ) ) {
  camera.position.set( ...view.p ); camera.lookAt( new Vector3( ...view.at ) ); lod.update( camera );
  const nodes = Array.from( { length: lod.count }, ( _, i ) => Object.assign( Array.from( lod.nodeArray.slice( i * 4, i * 4 + 4 ) ), { edges: Array.from( lod.edgeArray.slice( i * 4, i * 4 + 4 ) ) } ) );
  let gap = 0, worst, boundaries = 0;
  for ( const a of nodes ) for ( const b of nodes ) {
    if ( a[3] >= b[3] ) continue;
    let axis, edge;
    if ( a[0] + a[2] === b[0] || b[0] + b[2] === a[0] ) { axis = 2; edge = Math.max( a[0], b[0] ); }
    else if ( a[1] + a[2] === b[1] || b[1] + b[2] === a[1] ) { axis = 0; edge = Math.max( a[1], b[1] ); }
    else continue;
    const ai = axis === 0 ? 0 : 1, lo = Math.max( a[ai], b[ai] ), hi = Math.min( a[ai]+a[2], b[ai]+b[2] );
    if ( hi <= lo ) continue;
    boundaries ++;
    const points = n => Array.from( { length: lod.G + 1 }, ( _, i ) => {
      const t = n[ai] + n[2] * i / lod.G;
      return morph( n, axis === 0 ? t : edge, axis === 2 ? t : edge );
    } );
    const coarse = points( b );
    let samples = 0;
    for ( const p of points( a ) ) {
      if ( p[axis] < lo - 1e-6 || p[axis] > hi + 1e-6 ) continue;
      const j = coarse.findIndex( ( q, j ) => j < coarse.length-1 && q[axis] <= p[axis]+1e-6 && coarse[j+1][axis] >= p[axis]-1e-6 && coarse[j+1][axis] > q[axis]+1e-6 );
      assert.ok( j >= 0, 'fine edge remains covered by the coarse neighbor' );
      samples ++;
      const q = coarse[j], r = coarse[j+1], f = ( p[axis]-q[axis] ) / ( r[axis]-q[axis] );
      const error = Math.abs( p[1] - ( q[1] + ( r[1]-q[1] ) * f ) );
      if ( error > gap ) { gap = error; worst = { a, b, p }; }
    }
    assert.ok( samples > 0, 'shared boundary has sampled vertices' );
  }
  assert.ok( boundaries > 0, 'view crosses terrain detail transitions' );
  assert.ok( gap < 1e-5, `${ name }: shared terrain edge diverges by ${ gap }m at ${ JSON.stringify( worst ) }` );
  console.log( `PASS ${ name }: ${ boundaries } shared boundaries, maximum gap ${ gap.toExponential(2) }m.` );
}
