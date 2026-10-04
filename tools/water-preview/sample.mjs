import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,basename} from 'node:path';
globalThis.fetch=async url=>new Response(readFileSync(resolve('public/terrain/flannan',basename(String(url).replaceAll('\\','/')))));
const {loadFlannanData}=await import('../../src/world/flannan/FlannanData.js'),{FlannanTerrainData}=await import('../../src/world/flannan/FlannanTerrain.js');
const {buildStation}=await import('../../src/world/flannan/Station.js'),{Builder}=await import('../../src/world/village/GeoBuilder.js');
const {Rand,InstancedProps}=await import('../../src/world/Props.js'),{Colliders}=await import('../../src/world/Colliders.js'),{mulberry32}=await import('../../src/util/Noise.js');
const data=await loadFlannanData(),terrain=new FlannanTerrainData(data.grids.island),B=new Builder();
buildStation({B,terrain,colliders:new Colliders(),rand:new Rand(mulberry32(90210)),lights:[],checks:[],inst:new InstancedProps(B)},{buildings:[],footprints:[]});
const n=192,cell=3,along=-80,across=-288,l=terrain.landing('west'),[dx,dz]=l.dir,depths=[];
for(let y=0;y<n;y++)for(let x=0;x<n;x++){const a=along+(x+.5)*cell,b=across+(y+.5)*cell,h=terrain.heightAt(l.stage.x+dx*a-dz*b,l.stage.z+dz*a+dx*b);depths.push(h<-.05?-h:0);}
mkdirSync('artifacts/water-preview',{recursive:true});writeFileSync('artifacts/water-preview/depths.json',JSON.stringify({n,cell,along,across,stage:l.stage,direction:l.dir,depths}));console.log('Sampled full coastal preview patch',Math.max(...depths),'m maximum depth');
