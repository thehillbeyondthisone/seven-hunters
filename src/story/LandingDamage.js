// A reversible local break for the isolated storm scene. CPU support, collision,
// terrain rendering and the authored lower landing change together.
export class LandingDamage {
	constructor(app){this.app=app;this.changed=[];this.boxes=[];this.destroyed=false;}
	set(destroyed){
		if(!!destroyed===this.destroyed)return;
		const a=this.app,t=a.terrainData,l=t.landing('west'),[dx,dz]=l.dir;
		if(destroyed){
			const limit=48,n=t.res;
			const imin=Math.max(0,Math.floor((l.head.x-limit-t.origin)/t.texel)),imax=Math.min(n-1,Math.ceil((l.head.x+limit-t.origin)/t.texel));
			const jmin=Math.max(0,Math.floor((l.head.z-limit-t.origin)/t.texel)),jmax=Math.min(n-1,Math.ceil((l.head.z+limit-t.origin)/t.texel));
			for(let j=jmin;j<=jmax;j++)for(let i=imin;i<=imax;i++){
				const x=t.origin+(i+.5)*t.texel-l.head.x,z=t.origin+(j+.5)*t.texel-l.head.z,along=x*dx+z*dz,across=-x*dz+z*dx,k=j*n+i;
				if(along>-34&&along<9&&Math.abs(across)<6.5&&t.heights[k]>-2&&t.heights[k]<30){this.changed.push([k,t.heights[k]]);t.heights[k]=-2-Math.abs(Math.sin(i*3.1+j*1.7))*2;}
			}
			for(const b of a.colliders.boxes){const x=b.center.x-l.head.x,z=b.center.z-l.head.z,along=x*dx+z*dz,across=-x*dz+z*dx;
				if(along>-35&&along<10&&Math.abs(across)<7&&b.top<29&&['stage','steps','cranePlatform','landingRail-west'].includes(b.tag)){this.boxes.push([b,b.solid,b.walkable]);b.solid=false;b.walkable=false;}}
		}else{for(const [k,h]of this.changed)t.heights[k]=h;for(const[b,solid,walkable]of this.boxes){b.solid=solid;b.walkable=walkable;}this.changed=[];this.boxes=[];}
		this.destroyed=!!destroyed;t.buildMinMax();a.terrainGPU?.heightTexture.upload(t.heights);if(a.query)a.query.cpuValid=false;
		const lower=a.village.station.moving.westLanding?.lower;if(lower)lower.visible=!destroyed;
		for(const r of a.keeperSafety?.rails||[])if(r.name==='west'&&r.at.y<29)r.intact=!destroyed;
		for(const r of a.keeperSafety?.anchors||[])if(r.name==='west')r.intact=!destroyed;
		a.cameraCut?.();
	}
}
