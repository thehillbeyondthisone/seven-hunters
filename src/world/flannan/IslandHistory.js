import { Vector3 } from '../../engine/index.js';
import { fittedStoneWall, stoneBlock } from './StoneMasonry.js';

// NRHE 3973 / 171215, approximate grid-to-local rotation (4.8 degrees).
// Chamber dimensions follow the 2014 survey. Stone loss and 1901 roofs are a reconstruction.
export const BOTHIES = { x: -335, z: 12, smaller: { x: -349.3, z: 16.5 } };
export const BOTHY_PATH = [[-280,80],[-300,58],[-318,36],[-329,23],[-329.2,12]];

export function gradeBothies(T) {
  const sites=[{x:BOTHIES.x,z:BOTHIES.z,r:5.4},{...BOTHIES.smaller,r:3.7}];
  for(const s of sites) { s.floor=T.heightAt(s.x,s.z);T.flatten(s.x,s.z,s.r,s.floor,1.8); }
  T.addPath(BOTHY_PATH,{width:.75,mask:.48});
  // A worn approach stops outside the smaller cell, rather than crossing its wall.
  T.addPath([[-329,23],[-340,24],[-355,24],[-355,14],[-349.3,13.9]],{width:.65,mask:.4});
  return sites;
}

export function buildBothies(ctx,village,sites,tint) {
  const {B,colliders}=ctx;let count=0;
  const wall=(s,a,b,h,depth,seed,openings=[])=>{
    const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),ry=Math.atan2(-dz,dx);
    B.pushAt(s.x+a[0],s.floor,s.z+a[1],ry);
    count+=fittedStoneWall(B,{length:L,bottom:-.12,top:h,depth,seed,tint,dry:true,openings});B.pop();
    // Individual wall colliders leave the actual chambers and entrances hollow.
    const intervals=openings.filter(o=>o.y0<.05).sort((a,b)=>a.x0-b.x0);
    let start=0;
    for(const end of [...intervals.map(o=>o.x0),L]) {
      if(end>start)colliders.addBox(new Vector3(s.x+a[0]+dx/L*(start+end)/2+dz/L*depth/2,s.floor+h/2,s.z+a[1]+dz/L*(start+end)/2-dx/L*depth/2),new Vector3((end-start)/2,h/2,depth/2),ry,{tag:'bothy-wall'});
      const hole=intervals.find(o=>o.x0===end);start=hole?hole.x1:end;
    }
  };
  const chamber=(s,cx,cz,rx,rz,height,gaps,seed,walls=true)=>{
    const n=20;
    for(let i=0;i<n;i++){
      const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2,mid=(a+b)/2;
      if(gaps.some(g=>Math.abs(Math.atan2(Math.sin(mid-g),Math.cos(mid-g)))<.24))continue;
      if(walls)wall(s,[cx+Math.cos(a)*rx,cz+Math.sin(a)*rz],[cx+Math.cos(b)*rx,cz+Math.sin(b)*rz],height+.12*Math.sin(i*1.7),.65,seed+i*.173);
    }
    // Short surviving inward corbels, with an open crown. No modern complete dome is asserted.
    for(let row=0;row<3;row++)for(let i=0;i<n;i++){
      const a=(i+.5)/n*Math.PI*2;
      if(gaps.some(g=>Math.abs(Math.atan2(Math.sin(a-g),Math.cos(a-g)))<.3)|| (row===2 && i%4===0))continue;
      B.pushAt(s.x+cx+Math.cos(a)*(rx-.08-row*.12),s.floor+height+.08+row*.12,s.z+cz+Math.sin(a)*(rz-.08-row*.12),-a);
      stoneBlock(B,{x0:-.30,x1:.30,y0:-.055,y1:.055,back:-.30,front:.30,seed:seed+row+i*.31,tint,dry:true});B.pop();count++;
    }
  };
  const [large,small]=sites;
  // Main 2.4 x 2.7 m chamber, a northern aumbry, western cell, eastern passage/lobby.
  wall(large,[-1.2,2],[1.2,2],1.02,.65,4.1);
  wall(large,[1.2,-2],[-1.2,-2],1.05,.65,4.6,[{x0:.95,x1:1.30,y0:.55,y1:.88}]);
  for(const [x,dir] of [[1.85,1],[-1.85,-1]])wall(large,[x,dir*2],[x,-dir*2],1.05,.65,5+x,[{x0:1.7,x1:2.3,y0:-.2,y1:.65}]);
  chamber(large,0,0,1.85,2,1.02,[0,Math.PI],6,false);
  // The curved wall's reference line is its inner face: 1.8 x 1.4 m clear.
  chamber(large,-2.75,0,.9,.7,.62,[0,Math.PI],9);
  wall(large,[1.2,.85],[3.5,.85],.58,.55,12.3);
  wall(large,[3.5,-.85],[1.2,-.85],.58,.55,12.7);
  // Small slab hearth and the aumbry's floor, neither furnished as a modern shelter.
  B.box('stone',large.x,large.floor+.025,large.z,.5,.05,.5,{tint:tint.map(v=>v*.48),data:[.2,.8,0,0]});
  B.box('stone',large.x-.05,large.floor+.55,large.z-1.65,.35,.07,.5,{tint});
  // Earlier measured account: 10.5 x 3.5 feet clear (about 3.2 x 1.07 m).
  chamber(small,0,0,1.6,.535,.92,[-Math.PI/2],18);
  // Curved northern entry; no full-height door or pretend walk-through clearance.
  wall(small,[-.95,-.535],[-.95,-2.3],.7,.5,21);
  wall(small,[.95,-2.3],[.95,-.535],.67,.5,22);
  for(const s of sites){
    village.footprints.push({x:s.x,z:s.z,r:s.r,kind:'building'});
    village.buildings.push({name:s===large?'bothy-large':'bothy-small',x:s.x,z:s.z,floorY:s.floor,roofTop:s.floor+1.5,stilts:false});
  }
  // Sparse upright slab boundary across the headland, leaving an approach gap.
  for(let i=0;i<18;i++){
    if(i===8||i===9)continue;
    const x=-342+i*.8,z=22-i*.35,y=ctx.terrain.heightAt(x,z);
    B.pushAt(x,y+.2,z,.4+i*.07,0,.09*Math.sin(i));
    stoneBlock(B,{x0:-.30,x1:.30,y0:-.28,y1:.28,back:-.09,front:.09,seed:30+i,tint,dry:true,unworked:true});B.pop();count++;
  }
  return {count,sites,roof:'partial corbels; 1901 loss pattern reconstructed',path:BOTHY_PATH};
}
