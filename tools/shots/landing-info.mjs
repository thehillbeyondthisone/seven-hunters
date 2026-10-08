import { readFileSync } from 'node:fs';
const root = new URL( '../../public/terrain/flannan/', import.meta.url );
globalThis.fetch = async url => new Response( readFileSync( new URL( String(url).split('/').pop(), root ) ) );
const { loadFlannanData } = await import('../../src/world/flannan/FlannanData.js');
const { FlannanTerrainData } = await import('../../src/world/flannan/FlannanTerrain.js');
const f = await loadFlannanData();
const t = new FlannanTerrainData(f.grids.island), l = t.landings.east;
const local = (x,y,z) => [l.head.x+x*l.dir[0]-z*l.dir[1], y, l.head.z+x*l.dir[1]+z*l.dir[0]];
console.log(JSON.stringify({head:l.head,stage:l.stage,dir:l.dir,frames:{
  stage:{p:local(4.7,l.stage.y+1.62,-1.15),at:local(-3.5,l.stage.y+2.1,0)},
  rungs:{p:local(12,2.7,3.2),at:local(7.5,2.4,1.14)},
  oblique:{p:local(27,7,-21),at:local(-5,10,0)}
}},null,2));
process.exit(0);
