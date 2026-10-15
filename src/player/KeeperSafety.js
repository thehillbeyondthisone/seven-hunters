import { Vector3 } from '../engine/index.js';

export const STRUGGLE_SECONDS = 12;
export const RECOVERY_SECONDS = 1.2;
export const HANDHOLD_REACH = 1.8;

export class KeeperSafety {
	constructor( app, story ) {
		this.app = app; this.story = story; this.coast = app.coastal; this.player = app.player;
		this.state = 'normal'; this.remaining = STRUGGLE_SECONDS; this.recovery = 0; this.exertion = 0; this.target = null;
		this.player.safety = this;
		this.anchors = []; this.rails = [];
		for ( const name of [ 'east', 'west' ] ) {
			const l = app.terrainData.landing( name ), [ dx, dz ] = l.dir;
			const point = ( along, across, y ) => new Vector3( l.head.x + dx*along - dz*across, y, l.head.z + dz*along + dx*across );
			this.anchors.push( { id: `${ name }Rungs`, label: 'Climb the landing rungs', at: point( 7.73, 1.14, 1.1 ),
				to: point( 6.4, 1.14, l.stage.y ), name } );
			for ( const t of [ 5, 13, 23 ] ) {
				const p = l.steps.pts[ Math.min( t, l.steps.pts.length-1 ) ];
				this.rails.push( { id: `${ name }Rail${ t }`, label: 'Hold E to brace against the rail', at: point( -t, .93, p[1]+.8 ), name, intact: true } );
			}
		}
	}
	get active() { return ! this.story.aboard && ! this.story.titleView && ! [ 'intro', 'crossing', 'end' ].includes( this.story.beat ); }
	get paused() { const a=this.app,s=this.story; return !this.active || s.paused || s.ui.open || a.mobile?.paused || a.devMenu?.open || a.freeCam || a.ui?.ui?.photoMode || !!globalThis.document?.hidden || !!s.towerTravel?.active || !!s.ruinInspect; }
	get canCheckpoint() {
		const p=this.player, q=this.coast.sample(p.position);
		if ( this.state!=='normal' || p.mode!=='walk' || !p.grounded || q.washDepth>.03 || p.position.y < this.waterHeight(p.waterH)+.8 ) return false;
		// Do not save in a jump or on the unsupported lip of a cliff.
		return [ [ .6,0 ],[-.6,0],[0,.6],[0,-.6] ].every( ([x,z]) => Math.abs(p.groundAt(p.position.x+x,p.position.z+z,p.position.y+.4)-p.position.y)<.65 );
	}
	waterHeight( height ) {
		const p=this.player,q=p.query,old=q.resultCoast;
		if(q.currentHeight)return q.currentHeight(p.slot,p.position,height);
		if (!old) return Math.max(height,this.coast.sample(p.position).surfaceHeight);
		const at={x:q.resultInputs[p.slot*4],z:q.resultInputs[p.slot*4+1]};
		return height-this.coast.sample(at,old).height+this.coast.sample(p.position).height;
	}
	checkpointIsSafe(data){
		if(!Array.isArray(data?.pos)||data.pos.length!==3||!data.pos.every(Number.isFinite))return false;
		const p=new Vector3(...data.pos),g=this.player.groundAt(p.x,p.z,p.y+.45),water=this.coast.sample(p,data.coast||{}).surfaceHeight;
		return p.y>water+.6&&Number.isFinite(g)&&Math.abs(p.y-g)<.75;
	}
	beforeFrame( dt ) {
		this.dt=Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0));
		const storm=this.story.storm;
		if(!this.paused&&this.state!=='dead'&&storm?.active)storm.prepareHazards(this.coast.time+this.dt);
		this.coast.update(this.dt,{paused:this.paused||this.state==='dead',strength:storm?.active ? storm.strength : this.app.seaWeather?.active ? this.app.seaWeather.state.surf : .22});
		if(this.paused||this.state==='dead') return;
		if(!this.story.safeCheckpoint){const data=this.story._snapshot();if(!this.canCheckpoint){const g=this.app.terrainData.landing('east');data.pos=[g.stage.x,g.stage.y,g.stage.z];data.yaw=Math.atan2(g.dir[0],g.dir[1]);}this.story.safeCheckpoint=JSON.parse(JSON.stringify(data));}
		this.exertion=Math.max(0,this.exertion-this.dt*.08);
		this.brace=null;
		if(this.state!=='struggling'&&this.state!=='recovering') {
			this.brace=this.rails.find(r=>r.intact && this.reachable(r.at,2));
			this.state=this.brace&&this.app.input.down('KeyE')?'braced':this.state==='swept'?'swept':'normal';
		}
	}
	reachable( at, reach=HANDHOLD_REACH ) {
		const from=this.player.position.clone().add(new Vector3(0,this.player.mode==='swim'?.35:1,0));
		if(from.distanceTo(at)>reach) return false;
		const count=Math.ceil(from.distanceTo(at)/.12);
		for(let i=1;i<count;i++) {
			const p=from.clone().lerp(at,i/count),resolved=p.clone();
			this.app.colliders.resolveCapsule(resolved,.045,.08,0);
			if(resolved.distanceTo(p)>.025 || this.app.terrainData.heightAt(p.x,p.z)>p.y+.1) return false;
		}
		return true;
	}
	get speedScale() { return this.state==='braced'?0:this.state==='swept'?.35:1-Math.min(.5,this.coast.sample(this.player.position).washDepth*.35); }
	applyWalk( dt ) {
		const p=this.player,q=this.coast.sample(p.position);
		if(this.state==='braced') { p.velocity.x=p.velocity.z=0; return; }
		if(q.washDepth>.08) {
			const k=Math.min(2.4,q.washDepth*2);
			p.velocity.x+=q.flowX*k*dt; p.velocity.z+=q.flowZ*k*dt;
			if(q.washDepth>.65 && Math.hypot(q.flowX,q.flowZ)>1.5) { this.state='swept'; this.exertion=1; }
		} else if(this.state==='swept') this.state='normal';
	}
	immerse() {
		if(this.state==='struggling'||this.state==='recovering'||this.state==='dead') return;
		this.state='struggling'; this.remaining=STRUGGLE_SECONDS; this.recovery=0; this.exertion=1;
		this.story.hand.lit=false; this.story.hand.glow=0;
		this.story.tel=0;this.app.input.rightDown=false;this.player.lookScale=1;this.app.camera.fov=this.story.baseFov;this.app.camera.updateProjectionMatrix();this.story.ui.telescope(0);this.app.audio?.submerge();
		this.story.toast('The sea has you. Reach the landing rungs or a low ledge. Hold E to climb.',6500);
	}
	updateSwim( dt ) {
		this.immerse();
		const p=this.player,inp=this.app.input,q=this.coast.sample(p.position),wish=new Vector3();
		const f=new Vector3(-Math.sin(p.yaw),0,-Math.cos(p.yaw)),r=new Vector3(-f.z,0,f.x);
		if(inp.down('KeyW'))wish.add(f); if(inp.down('KeyS'))wish.sub(f); if(inp.down('KeyD'))wish.add(r); if(inp.down('KeyA'))wish.sub(r);
		if(inp.enabled&&inp.move)wish.addScaledVector(f,inp.move.y).addScaledVector(r,inp.move.x);
		if(wish.lengthSq()>1)wish.normalize(); wish.multiplyScalar(.75);
		p.velocity.x=wish.x+q.flowX; p.velocity.z=wish.z+q.flowZ;
		p.position.x+=p.velocity.x*dt;p.position.z+=p.velocity.z*dt;
		p.position.y+=(p.waterH-.12-p.position.y)*(1-Math.exp(-dt*7));p.velocity.y=0;
		this.app.colliders.resolveCapsule(p.position,.3,.8,0);
		this.remaining=Math.max(0,this.remaining-dt);
		this.target=this.anchors.find(a=>a.intact!==false&&this.reachable(a.at));
		const holding=this.target && inp.down('KeyE');
		this.state=holding?'recovering':'struggling'; this.recovery=holding?this.recovery+dt:0;
		if(this.recovery>=RECOVERY_SECONDS) { this.recover(this.target.to); return; }
		const g=p.groundAt(p.position.x,p.position.z,p.position.y+.3);
		if(Number.isFinite(g)&&p.waterH-g<.25&&q.washDepth<.25) { this.recover(new Vector3(p.position.x,g,p.position.z));return; }
		if(this.remaining<=0) this.die();
		p.stepDist+=Math.hypot(p.velocity.x,p.velocity.z)*dt;
		if(p.stepDist>1.3){p.stepDist=0;this.app.audio?.swimStroke();}
	}
	recover( to ) {
		const p=this.player,check=to.clone(); this.app.colliders.resolveCapsule(check,.3,1.75,.4);
		if(check.distanceTo(to)>.2||this.coast.sample(to).washDepth>.25) {this.recovery=0;return false;}
		p.position.copy(to);p.mode='walk';p.grounded=true;p.velocity.set(0,0,0);p._camY=null;p.waterMean=null;
		this.state='normal';this.remaining=STRUGGLE_SECONDS;this.recovery=0;this.exertion=1;this.target=null;
		this.story.toast('You have a footing. Get above the wash. Your lantern is out.',5000);this.app.audio?.emerge();return true;
	}
	guidance() { return this.target?{at:this.target.at,label:'Reach the rungs · hold E',id:this.target.id}:null; }
	afterFrame() {
		if(this.paused||this.state==='dead') {this.story.ui.safety(null);return;}
		const p=this.player;
		if(p.mode==='swim')this.immerse();
		if(this.target&&['struggling','recovering'].includes(this.state))p.prompt={key:'E',text:this.target.label,hold:true,progress:this.recovery/RECOVERY_SECONDS,safetyTarget:this.target.id};
		else if(this.brace&&p.mode==='walk'&&!p.prompt)p.prompt={key:'E',text:'Brace against the rail',hold:true,hideProgress:true,safetyTarget:this.brace.id};
		const messages={braced:'Braced against the rail. Release to move.',swept:'The wash is taking your footing. Get above the water.',struggling:'Reach the rungs or a low ledge. Hold E to climb.',recovering:'Hold on. Keep pressed to climb.'};
		this.story.ui.safety(messages[this.state]||null);
		if(this.exertion>.1&&this.app.camera.position.y>p.waterH-.1)this.app.stationSound?.breathing(this.exertion,this.state==='struggling');
	}
	reset() {this.state='normal';this.remaining=STRUGGLE_SECONDS;this.recovery=0;this.target=null;this.brace=null;this.exertion=0;this.story.ui.safety(null);}
	async die() {
		if(this.state==='dead')return;this.state='dead';this.story.paused=true;this.player.velocity.set(0,0,0);
		await this.story.ui.choose({title:'The sea takes you',intro:'There is no footing within reach.',options:[{label:'Retry from safety',value:'retry'}],cancel:null});
		this.story.retryFromSafety();
	}
}
