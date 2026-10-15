// Compare this pass against the preserved local pre-pass station. No GPU required.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { installBrowser } from './browser.mjs';
import { Builder } from '../../src/world/village/GeoBuilder.js';
import { Rand, InstancedProps } from '../../src/world/Props.js';
import { Colliders } from '../../src/world/Colliders.js';
import { mulberry32 } from '../../src/util/Noise.js';
import { loadFlannanData } from '../../src/world/flannan/FlannanData.js';
import { FlannanTerrainData } from '../../src/world/flannan/FlannanTerrain.js';
import { STATION_CRAFT_MODEL } from '../../src/world/flannan/StationCraftModel.js';
import { buildStation } from '../../src/world/flannan/Station.js';

const root=resolve('.'),out=resolve('artifacts/prop-quality');
Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});
installBrowser({search:'?nostory&setting=flannan',root:resolve('public')});
const sourceURL=pathToFileURL(resolve('src/world/flannan/Station.js'));
const absoluteImports=(source,base,overrides={})=>source.replace(/from\s+(['"])(\.[^'"]+)\1/g,(whole,quote,path)=>`from ${quote}${overrides[path] || new URL(path,base).href}${quote}`);
const asModule=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const oldNext=asModule(absoluteImports(readFileSync(resolve(out,'original/src/world/flannan/NextRooms.js'),'utf8'),sourceURL));
const oldStation=asModule(absoluteImports(readFileSync(resolve(out,'original/src/world/flannan/Station.js'),'utf8'),sourceURL,{'./NextRooms.js':oldNext}));
const {buildStation:beforeBuild}=await import(oldStation);
const data=await loadFlannanData();
function station(build,study){
 const B=new Builder(),colliders=new Colliders(),village={buildings:[],footprints:[]};
 const result=build({B,terrain:new FlannanTerrainData(data.grids.island),colliders,keeperStudy:true,morningStudy:study,rand:new Rand(mulberry32(90210)),lights:[],inst:new InstancedProps(B),checks:[]},village);
 const moving=result.parts.doors.reduce((sum,door)=>sum+door.B.triangles,0);
 return {B,colliders,result,moving};
}
const summary={exports:{},profiles:[]};
for(const [name,finishes] of Object.entries(STATION_CRAFT_MODEL)){
 let triangles=0;
 for(const g of Object.values(finishes)){
  const count=g.p.length/3;
  assert.equal(g.n.length,g.p.length);assert.equal(g.uv.length,count*2);
  assert.ok([...g.p,...g.n,...g.uv].every(Number.isFinite),`${name}: finite export`);
  assert.ok(g.idx.every(i=>Number.isInteger(i)&&i>=0&&i<count),`${name}: indexed bounds`);
  for(let i=0;i<count;i++)assert.ok(Math.abs(Math.hypot(...g.n.slice(i*3,i*3+3))-1)<.001,`${name}: unit corner normals`);
  for(let i=0;i<g.idx.length;i+=3){
   const points=g.idx.slice(i,i+3).map(index=>g.p.slice(index*3,index*3+3));
   const a=points[1].map((v,k)=>v-points[0][k]),b=points[2].map((v,k)=>v-points[0][k]);
   assert.ok(Math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])>1e-12,`${name}: nondegenerate triangles`);
  }
  triangles+=g.idx.length/3;
 }
 summary.exports[name]=triangles;
}
for(const study of [false,true]){
 const before=station(beforeBuild,study),after=station(buildStation,study);
 for(const key of ['boxes','rings','cylinders'])assert.deepEqual(JSON.parse(JSON.stringify(after.colliders[key])),JSON.parse(JSON.stringify(before.colliders[key])),`${key}: unchanged collision envelopes`);
 const doors=s=>s.result.parts.doors.map(({name,hinge,ry,swing,width,height,center})=>({name,hinge:hinge.toArray(),ry,swing,width,height,center:center.toArray()}));
 assert.deepEqual(doors(after),doors(before),'all door pivots, sizes, swings and interaction centres unchanged');
 for(let x=-3;x<=3;x+=.3)for(let z=-3;z<=3;z+=.3)for(const maxY of [82,88,97,99])assert.equal(after.colliders.groundHeightAt(x,z,maxY),before.colliders.groundHeightAt(x,z,maxY),'tower walking surfaces unchanged');
 for(const batch of Object.values(after.B.batches))assert.ok(batch.pos.every(Number.isFinite),'finite assembled scene');
 const added=after.B.triangles+after.moving-before.B.triangles-before.moving;
 assert.ok(added<40000,'bounded station detail budget');
 summary.profiles.push({morningStudy:study,beforeStaticTriangles:before.B.triangles,afterStaticTriangles:after.B.triangles,beforeDoorTriangles:before.moving,afterDoorTriangles:after.moving,addedTriangles:added,boxes:after.colliders.boxes.length,collisionAndDoorParametersUnchanged:true});
}
writeFileSync(resolve(out,'geometry-audit.json'),JSON.stringify(summary,null,2));
console.log('PASS Blender export health, exact pre-pass collision/door parameters, tower walking surfaces and added geometry budget.');
console.log(JSON.stringify(summary.profiles));
