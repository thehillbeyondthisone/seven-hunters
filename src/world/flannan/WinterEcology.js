import { BIRD } from '../wildlife/BirdShapes.js';
import { BirdBatch } from '../wildlife/BirdBatch.js';
import { createPose, flapWings, tuckLegs, setWings, storePrevious, resetPrevious } from '../wildlife/BirdPose.js';
import { FLIGHT } from '../wildlife/Flight.js';
import { qYawPitchRoll } from '../wildlife/Kit.js';
import { mulberry32 } from '../../util/Noise.js';
import { WinterBirdCalls } from '../../audio/WinterBirdCalls.js';

export const WINTER_BIRDS = [
  {species:'herring gull',x:42,z:42,rx:38,rz:22,period:117,offset:0,active:43,seed:.24,scale:1.45},
  {species:'herring gull',x:-82,z:75,rx:44,rz:28,period:151,offset:57,active:47,seed:.48,scale:1.45},
  {species:'great black-backed gull',x:-322,z:26,rx:36,rz:20,period:173,offset:96,active:55,seed:.79,scale:1.85},
  {species:'great black-backed gull',x:-164,z:-80,rx:45,rz:28,period:211,offset:139,active:50,seed:.91,scale:1.85},
];

// Four independently timed birds over the whole island. Long empty intervals are intentional.
export class WinterEcology {
  constructor({scene=null,csm=null,terrain,seed=1901}={}){
    this.terrain=terrain;this.elapsed=0;this.agents=WINTER_BIRDS.map(c=>({...c,P:createPose(BIRD.GULL,c.seed),visible:false,resting:false,flee:0}));
    for(const a of this.agents)a.P.scale=a.scale;
    this.batch=scene?new BirdBatch({csm,capacity:4,plumage:'flannan-winter'}):null;
    if(this.batch){this.batch.mesh.name='January coastal gulls';scene.add(this.batch.mesh);}
    this.calls=new WinterBirdCalls(this,mulberry32(seed));
  }
  update(dt,camera,{daylight=1,wind=8,suppressed=false,paused=false}={}){
    if(!paused)this.elapsed+=Math.min(Math.max(dt,0),.1);
    this.batch?.begin();
    for(const [i,a] of this.agents.entries()){
      const t=(this.elapsed+a.offset)%a.period,p=a.P;storePrevious(p);
      a.visible=!suppressed&&daylight>.22&&t<a.active;
      if(!a.visible){p.fresh=true;continue;}
      const phase=t/a.active*Math.PI*2,ground=this.terrain.heightAt(a.x,a.z);
      // The dark gull at Tom na Geodha spends the middle of its visit resting.
      const rest=i===2&&t>18&&t<36;
      const near=camera&&Math.hypot(camera.position.x-a.x,camera.position.z-a.z)<14;
      if(rest&&near&&a.wasResting)a.flee=35;
      if(!paused)a.flee=Math.max(0,a.flee-dt);
      a.resting=rest&&a.flee===0;
      if(a.resting){
        p.pos[0]=a.x;p.pos[1]=ground+.22;p.pos[2]=a.z;p.fold=1;
        setWings(p,0,0,0,0,0,0);qYawPitchRoll(p.q,1.4,0,0);
        p.footL=[.022,-.12,.025];p.footR=[-.022,-.12,.025];p.kneeL=[.022,-.06,-.02];p.kneeR=[-.022,-.06,-.02];
      }else{
        const ease=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
        let spread=1;
        if(i===2)spread=a.flee>0?ease((35-a.flee)/4):t<18?1-ease((t-10)/8):ease((t-36)/8);
        const x=a.x+Math.cos(phase)*a.rx*spread,z=a.z+Math.sin(phase)*a.rz*spread;
        // Ease down toward / up from a resting perch; never descend through the ground.
        const lift=14*spread;
        p.pos[0]=x;p.pos[2]=z;p.pos[1]=Math.max(ground+lift+.22,this.terrain.heightAt(x,z)+.22+6*spread);
        p.fold=0;qYawPitchRoll(p.q,Math.atan2(-Math.sin(phase)*a.rx,Math.cos(phase)*a.rz),.025,-.18);
        const g=FLIGHT[BIRD.GULL];flapWings(p,g.glide,this.elapsed*g.freq*6.283+i,.05+(t%11<1.8?.28:0)+Math.min(wind,22)*.001);tuckLegs(p);
      }
      if(p.fresh||a.resting!==a.wasResting)resetPrevious(p);a.wasResting=a.resting;
      this.batch?.write(p);
    }
    this.batch?.commit();if(this.batch)this.batch.mesh.visible=this.agents.some(a=>a.visible);
  }
  snapshot(){return this.agents.filter(a=>a.visible).map(a=>({species:a.species,position:a.P.pos.slice(),behavior:a.resting?'resting':'flap-glide transit'}));}
}
