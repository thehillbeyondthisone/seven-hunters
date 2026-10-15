// Asset health and exact collision/interaction comparison against retained originals.
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
import { ROOM_CRAFT_MODEL } from '../../src/world/flannan/RoomCraftModel.js';
import { STATION_CRAFT_MODEL } from '../../src/world/flannan/StationCraftModel.js';
import * as current from '../../src/world/flannan/Station.js';

Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});
installBrowser({search:'?nostory&setting=flannan',root:resolve('public')});
const base=pathToFileURL(resolve('src/world/flannan/Station.js'));
const original=resolve('artifacts/room-craft/original'), output=resolve('artifacts/room-craft');
const modules={};
function oldModule(name){
 if(modules[name]) return modules[name];
 const source=readFileSync(resolve(original,name),'utf8').replace(/from\s+(['"])(\.[^'"]+)\1/g,(all,q,path)=>{
  const dependency=path.slice(2);
  return `from ${q}${['InteriorCraft.js','InteriorDressing.js','UnpackingProps.js','StationCraft.js','NextRooms.js'].includes(dependency)?oldModule(dependency):new URL(path,base).href}${q}`;
 });
 return modules[name]='data:text/javascript;base64,'+Buffer.from(source).toString('base64');
}
const beforeModule=await import(oldModule('Station.js'));
const terrain=await loadFlannanData();
function build(module,morningStudy){
 const B=new Builder(),colliders=new Colliders(),lights=[];
 const result=module.buildStation({B,terrain:new FlannanTerrainData(terrain.grids.island),colliders,keeperStudy:true,morningStudy,rand:new Rand(mulberry32(90210)),lights,inst:new InstancedProps(B),checks:[]},{buildings:[],footprints:[]});
 const transparent=['roomLampGlass','roomLampFlame'].reduce((n,key)=>n+(result.parts[key]?.triangles||0),0);
 return {B,colliders,result,lights,transparent,room:module.ROOM,doors:result.parts.doors.reduce((n,d)=>n+d.B.triangles,0)};
}
const report={models:{},profiles:[]};
for(const [name,groups] of Object.entries({...ROOM_CRAFT_MODEL,...STATION_CRAFT_MODEL})){
 let triangles=0;
 for(const g of Object.values(groups)){
  const count=g.p.length/3;
  assert.equal(g.n.length,g.p.length);assert.equal(g.uv.length,count*2);
  assert.ok(g.p.every(Number.isFinite)&&g.n.every(Number.isFinite)&&g.uv.every(Number.isFinite),`${name}: finite attributes`);
  assert.ok(g.idx.every(i=>Number.isInteger(i)&&i>=0&&i<count),`${name}: index bounds`);
  for(let i=0;i<count;i++) assert.ok(Math.abs(Math.hypot(...g.n.slice(i*3,i*3+3))-1)<.001,`${name}: unit normals`);
  for(let i=0;i<g.idx.length;i+=3){
   const ps=g.idx.slice(i,i+3).map(j=>g.p.slice(j*3,j*3+3));
   const a=ps[1].map((v,k)=>v-ps[0][k]),b=ps[2].map((v,k)=>v-ps[0][k]);
   assert.ok(Math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])>1e-12,`${name}: triangle area`);
  }
  triangles+=g.idx.length/3;
 }
 report.models[name]=triangles;
}
const plain=value=>JSON.parse(JSON.stringify(value));
for(const morning of [false,true]){
 const before=build(beforeModule,morning),after=build(current,morning);
 for(const key of ['boxes','rings','cylinders']) assert.deepEqual(plain(after.colliders[key]),plain(before.colliders[key]),`${key}: unchanged`);
 for(const key of ['journal','slate','letter','stove','oilskins','barometer','thermometer','clock','bag']) assert.deepEqual(plain(after.room[key]),plain(before.room[key]),`${key}: target alignment`);
 const doors=s=>s.result.parts.doors.map(({name,hinge,ry,swing,width,height,center})=>({name,hinge,ry,swing,width,height,center}));
 assert.deepEqual(plain(doors(after)),plain(doors(before)),'door parameters');
 assert.equal(after.lights.length,before.lights.length,'no added light sources');
 for(let i=0;i<after.lights.length;i++) for(const axis of ['x','y','z']) assert.ok(Math.abs(after.lights[i].position[axis]-before.lights[i].position[axis])<1e-10,'lamp source alignment');
 for(const batch of Object.values(after.B.batches)) assert.ok(batch.pos.every(Number.isFinite),'assembled positions');
 assert.deepEqual(Object.keys(after.B.batches).sort(),Object.keys(before.B.batches).sort(),'same material batches');
 report.profiles.push({morning,beforeStatic:before.B.triangles,afterOpaqueStatic:after.B.triangles,roomTransparent:after.transparent,addedStatic:after.B.triangles+after.transparent-before.B.triangles,doorTriangles:after.doors,collisionAndTargetsUnchanged:true,sameOpaqueMaterialBatches:true,addedTransparentDraws:2});
}
writeFileSync(resolve(output,'geometry-audit.json'),JSON.stringify(report,null,2));
console.log('PASS finite indexed models, unit normals, triangle areas, exact collision envelopes, door parameters, interaction targets, lamp source alignment and material batches.');
console.log(JSON.stringify(report.profiles));
