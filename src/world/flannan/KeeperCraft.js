import { Group, Mesh, Matrix4 } from '../../engine/index.js';
import { Builder, Part } from '../village/GeoBuilder.js';
import { lin, WOOD, HARD } from '../Props.js';
import { standard } from '../../materials/Materials.js';
import { Texture } from '../../engine/gpu/Texture.js';
import { KEEPER_CRAFT_MODEL } from './KeeperCraftModel.js';
import { KEEPER_HAND_POSES } from './KeeperHandPosesModel.js';
import { STORM_WORK_MODEL } from './StormWorkModel.js';
import { DOMESTIC_CRAFT_MODEL } from './DomesticCraftModel.js';

// Blender prototypes share geometry. Static details join the established station
// batches; articulated actors use one material and one draw per moving segment.
const finishes = {
 oak: ['stationTimber',0x795b3d,WOOD(.51,.035)], darkOak:['stationTimber',0x4f3e2c,WOOD(.57,.025)],
 iron:['hard',0x343d39,HARD(.64,.015,.65,.48)], black:['hard',0x1b201f,HARD(.42,0,.05,.82)],
 brass:['hard',0xa48a50,HARD(.45,.015,.85,.34)], tin:['hard',0x858a80,HARD(.34,.015,.75,.46)],
 linen:['hard',0xc8bea1,HARD(.48,0,0,.96)], wool:['hard',0x3f504e,HARD(.33,0,0,.98)],
 oilskin:['hard',0x77704e,HARD(.35,.015,0,.72)], leather:['hard',0x493b2d,HARD(.61,.02,0,.78)],
 slate:['hard',0x182127,HARD(.57,0,0,.32)], red:['hard',0x6e2722,HARD(.3,0,0,.24)],
 skin:['hard',0xab856b,HARD(.2,0,0,.83)], hair:['hard',0x514b3f,HARD(.5,0,0,.96)],
 rope:['hard',0x92816a,HARD(.43,0,0,.96)],
};
const parts=new Map(), meshes=new Map();
let material;

export function keeperCraft(B,name,x=0,y=0,z=0,options={},overrides={}) {
 const {lod='near',batch=null,...transform}=options;
 const model=KEEPER_CRAFT_MODEL.models[name]?.[lod];
 if(!model)throw new Error(`Unknown keeper prototype ${name}/${lod}`);
 for(const [finish,g] of Object.entries(model)) {
  const id=`${name}/${lod}/${finish}/${batch?'tile':'metres'}`;
  if(!parts.has(id))parts.set(id,new Part(g.p,g.n,batch?g.uv:Float32Array.from(g.uv,n=>n*.06),g.idx));
  const [key,color,data]=finishes[finish];
  B.part(batch||key,parts.get(id),x,y,z,{tint:lin(color),data,...transform,...overrides[finish]});
 }
}

export function brownieCraft(B,options={}) {
 keeperCraft(B,'brownie',0,0,0,options);
 keeperCraft(B,'brownieKey',-.043,.037,-.032,options);
 keeperCraft(B,'brownieShutter',.029,.078,.046,options);
}

export function keeperMaterial() {
 if(material)return material;
 const tile=KEEPER_CRAFT_MODEL.detail;
 const texture=new Texture({label:'Blender keeper detail NRA',width:tile.size,height:tile.size,
  format:'rgba8unorm',data:new Uint8Array(tile.rgba),sampler:'linearRepeat'});
 material=standard({name:'KeeperCraftBaked',attributes:{tint:'vec3f',vdata:'vec4f'},
  varyings:{vTint:'vec3f',vData:'vec4f'},vertex:'o.vTint=v.tint; o.vData=v.vdata;',
  bindings:{keeperDetail:{texture}},surface:`
   let detail=textureSample(keeperDetail,smpLinearRepeat,in.uv);
   let d=in.vs.vData;
   s.albedo=in.vs.vTint;
   s.metalness=d.z;
   s.roughness=clamp(d.w*mix(0.88,1.08,detail.b),0.18,0.99);
   s.ao=mix(1.0,detail.a,0.35);
   let nm=(detail.rg*2.0-1.0)*mix(0.12,0.35,1.0-d.z);
   s.normal=perturbNormalByMap(in.P,in.N,in.uv,normalize(vec3f(nm,1.0)));
  `});
 // This shared shader is needed by the opening boatman as well as the hands.
 // Prepare it with the crossing rather than deferring it with room finishes.
 return material;
}

export function craftMesh(name,lod='near') {
 const key=`${name}/${lod}`;
 if(!meshes.has(key)) {
  const B=new Builder();keeperCraft(B,name,0,0,0,{batch:'craft',lod});
  meshes.set(key,B.batches.craft.build());
 }
 const mesh=new Mesh(meshes.get(key),keeperMaterial());
 mesh.name=`keeper-${name}-${lod}`;mesh.castShadow=mesh.receiveShadow=true;
 return mesh;
}

export function craftLod(name) {
 const group=new Group(),near=craftMesh(name),far=craftMesh(name,'far');
 group.name=`keeper-${name}`;group.add(near,far);far.visible=false;
 group.setFar=value=>{near.visible=!value;far.visible=value;};
 return group;
}

// Finger geometry is merged once for each useful pose, keeping a complete hand
// to one draw. Local +Y runs from wrist toward fingertips; palm faces local -Z.
const handGeometry=new Map();
export function handMesh(pose='grip',lod='near',left=false) {
 const key=pose+'/'+lod+'/'+left;
 if(!handGeometry.has(key)) {
  const B=new Builder(),options={batch:'craft',lod};
  const authored=KEEPER_HAND_POSES.poses[pose] || STORM_WORK_MODEL.poses?.[pose] || DOMESTIC_CRAFT_MODEL.handPoses?.[pose];
  if(authored) {
   for(const [finish,g] of Object.entries(authored.finishes)) {
    const [,color,data]=finishes[finish];
    B.part('craft',new Part(g.p,g.n,g.uv,g.idx),0,0,0,{tint:lin(color),data});
   }
   handGeometry.set(key,B.batches.craft.build());
  } else {
  if(left)B.push(new Matrix4().makeScale(-1,1,1));
  keeperCraft(B,'handPalm',0,0,0,options);
  const curl=pose==='open'?.12:pose==='pinch'?.65:1.22;
  for(let finger=0;finger<4;finger++) {
   const length=[.88,1,.95,.74][finger];
   B.pushAt((finger-1.5)*.019,.081,0,0,-curl*.55);
   keeperCraft(B,'finger',0,0,0,{...options,sy:length});
   B.pushAt(0,.031*length,0,0,-curl);
   keeperCraft(B,'finger',0,0,0,{...options,sy:length*.78,sx:.88,sz:.88});
   B.pushAt(0,.025*length,0,0,-curl*.75);
   keeperCraft(B,'fingerTip',0,0,0,{...options,sy:length});
   B.pop();B.pop();B.pop();
  }
  B.pushAt(-.034,.026,-.002,0,-.6,.85);
  keeperCraft(B,'finger',0,0,0,{...options,sx:1.23,sz:1.23});
  B.pushAt(0,.031,0,0,-curl*.65);
  keeperCraft(B,'fingerTip',0,0,0,{...options,sx:1.2,sz:1.2});
  B.pop();B.pop();
  if(left)B.pop();
  handGeometry.set(key,B.batches.craft.build());
  }
 }
 const mesh=new Mesh(handGeometry.get(key),keeperMaterial());
 mesh.name=`keeper-hand-${pose}`;mesh.castShadow=false;mesh.receiveShadow=true;
 return mesh;
}
