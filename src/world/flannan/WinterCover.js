import { Matrix4, Vector3 } from '../../engine/index.js';
import { Material } from '../../engine/render/Material.js';
import { Part } from '../village/GeoBuilder.js';
import { lin } from '../Props.js';
import { mulberry32 } from '../../util/Noise.js';

// Regional maritime grassland forms, not an asserted botanical census of Eilean Mor in 1901.
// January: basal leaves and straw only. No thrift flowers or tall summer seed heads.
export function winterCoverMaterial(){return new Material({name:'Winter maritime leaves',side:'double',roughness:.91,
  attributes:{tint:'vec3f'},varyings:{vLeafTint:'vec3f'},vertex:'o.vLeafTint = v.tint;',surface:'s.albedo = in.vs.vLeafTint;'});}
export function winterCoverSites(T,footprints,seed=1011901){
  const rand=mulberry32(seed),normal=new Vector3(),sites=[];
  for(let i=0;i<14000;i++){
    const x=-390+rand()*510,z=-140+rand()*360,y=T.heightAt(x,z);
    if(y<14||y>86||T.pathDistance(x,z)<1.15||footprints.some(f=>Math.hypot(x-f.x,z-f.z)<f.r+.6))continue;
    T.normalAt(x,z,normal);if(normal.y<.91)continue;
    const k=Math.floor((z-T.origin)/T.texel)*T.res+Math.floor((x-T.origin)/T.texel);
    if(T.rock[k]>.3)continue;
    // Irregular coherent patches, avoiding an evenly scattered garden.
    const patch=Math.sin(x*.11+Math.sin(z*.09)*2)*Math.cos(z*.13);
    if(patch<.18||rand()>.28)continue;
    sites.push({x,z,y,kind:rand()<.48?'plantain':'thrift',seed:rand()});
  }
  return sites;
}
export function buildWinterCover(B,T,footprints){
  const sites=winterCoverSites(T,footprints),I=new Matrix4();
  for(const s of sites){
    const random=mulberry32(Math.round(s.seed*1e8)),count=s.kind==='plantain'?9:75;
    const tint=lin(s.kind==='plantain'?0x59664a:0x5e6952);
    for(let j=0;j<count;j++){
      const a=j/count*Math.PI*2+random()*.6,len=(s.kind==='plantain'?.16:.05)+random()*.10;
      const w=s.kind==='plantain'?.007:.003,h=(s.kind==='plantain'?.10:.04)+random()*.055;
      const c=Math.cos(a),sn=Math.sin(a);
      const leaf=(x,z,lift)=>[x,T.heightAt(x,z)+.012+lift,z];
      // Upright strap leaves among the short turf; thrift is a dense basal cushion.
      const x=s.x+(s.kind==='thrift'?(random()-.5)*.22:0),z=s.z+(s.kind==='thrift'?(random()-.5)*.22:0);
      const tip=s.kind==='plantain'?.055+random()*.04:.015;
      const p=[...leaf(x,z,0),...leaf(x+c*len*.48-sn*w,z+sn*len*.48+c*w,h),...leaf(x+c*len,z+sn*len,tip),...leaf(x+c*len*.48+sn*w,z+sn*len*.48-c*w,h)];
      B.add('winterCover',new Part(p,[0,1,0,0,1,0,0,1,0,0,1,0],[0,0,.5,0,1,0,.5,1],[0,1,3,1,2,3]),I,tint.map(v=>v*(.8+random()*.35)));
    }
  }
  return {count:sites.length,plantain:sites.filter(s=>s.kind==='plantain').length,thrift:sites.filter(s=>s.kind==='thrift').length,flowers:0};
}
