// Restrained procedural call studies: herring gull yelps and lower hoarse black-backed barks.
// These are synthesized interpretations, not species-verified field recordings.
export class WinterBirdCalls {
  constructor(ecology,random=Math.random){this.ecology=ecology;this.random=random;this.remaining=28;this.buffer=null;this.context=null;}
  update(dt,scape){
    const e=scape.env;
    if(!scape.enabled||!scape.ctx||scape.ctx.state!=='running'||e.day<.35||e.u>.1||e.indoor>.45)return;
    this.remaining-=dt;if(this.remaining>0)return;
    this.remaining=42+this.random()*55;
    const candidates=this.ecology.agents.filter(a=>a.visible&&Math.hypot(a.P.pos[0]-e.lx,a.P.pos[2]-e.lz)<145);
    if(!candidates.length)return;
    const a=candidates[Math.floor(this.random()*candidates.length)];this.call(scape,a);
  }
  call(scape,a){
    const c=scape.ctx;
    if(this.context!==c){
      this.context=c;this.buffer=c.createBuffer(1,c.sampleRate,c.sampleRate);
      const noise=this.buffer.getChannelData(0);for(let i=0;i<noise.length;i++)noise[i]=this.random()*2-1;
    }
    const pan=scape._panner(scape.above,12,1.2),P=a.P.pos;
    pan.positionX.value=P[0];pan.positionY.value=P[1];pan.positionZ.value=P[2];
    const low=a.species==='great black-backed gull',start=c.currentTime+.02,n=low?2:3;
    let pending=n;
    for(let i=0;i<n;i++){
      const t=start+i*(low?.4:.31),dur=low?.24:.22,osc=c.createOscillator(),noise=c.createBufferSource(),bp=c.createBiquadFilter(),gain=c.createGain();
      osc.type='triangle';osc.frequency.setValueAtTime(low?425:1030,t);osc.frequency.exponentialRampToValueAtTime(low?270:630,t+dur);
      noise.buffer=this.buffer;bp.type='bandpass';bp.frequency.value=low?650:1300;bp.Q.value=low?1.6:3;
      const hiss=c.createGain();hiss.gain.value=low?.6:.22;noise.connect(bp).connect(hiss).connect(gain);osc.connect(gain);
      gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.028,t+.035);gain.gain.exponentialRampToValueAtTime(.0001,t+dur);
      gain.connect(pan);osc.start(t);noise.start(t,this.random()*.5);osc.stop(t+dur+.03);noise.stop(t+dur+.03);
      osc.onended=()=>{osc.disconnect();noise.disconnect();bp.disconnect();hiss.disconnect();gain.disconnect();if(--pending===0)pan.disconnect();};
    }
  }
}
