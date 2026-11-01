import { Vector3, Group, Mesh } from '../engine/index.js';
import { TOWER, ROOM, STATION } from '../world/flannan/Station.js';
import { KITCHEN } from '../world/flannan/NextRooms.js';
import { Beams } from '../station/Beams.js';
import { Watcher } from './Watcher.js';
import { routeGuidance } from './Guidance.js';
import { chapterFrame } from './WatchChapter.js';
import { LandingDamage } from './LandingDamage.js';
import { clearTerrainSightline } from './ReturningLight.js';
import { Builder } from '../world/village/GeoBuilder.js';
import { roomCraft } from '../world/flannan/RoomCraft.js';
import { COAST_PERIOD } from '../ocean/CoastalState.js';
import { StormScopeCutscene } from './StormScopeCutscene.js';
import { StormWorkProps } from '../world/flannan/StormWorkProps.js';

// Let the player read the intact landing before one actual coastal crest reaches
// it. Scheduling on the shared field keeps the visible water and damage together.
export function stormCrestAt(coast,at,startedAt){
	const site=coast.sites.find(s=>s.name==='west');
	const along=(at.x-site.x)*site.dx+(at.z-site.z)*site.dz;
	const offset=along/9+site.phase;
	return (Math.ceil((startedAt+offset+8)/COAST_PERIOD-.13)+.13)*COAST_PERIOD-offset;
}

export const STORM_SIGNAL={start:'seen',nodes:{
	seen:{her:'I CAN SEE THE LIGHT. I CANNOT SEE YOU.',options:[{text:'I AM AT THE STATION. WEST LANDING GONE.',minutes:2,next:'report'}]},
	report:{her:'I REPORTED THAT I COULD NOT CONFIRM YOUR SAFETY.',options:[{text:'THANK YOU. THE LIGHT IS BURNING.',minutes:2,next:'end'}]},
	end:{her:'KEEP HER LIT. I AM WATCHING.',end:true},
}};
export class StormReview {
	constructor(s){this.s=s;this.busy=false;this.endShown=false;this.damage=new LandingDamage(s.app);
		const l=s.app.terrainData.landing('west'),pts=l.steps.pts;
		// Stop on the intact upper flight, close enough to see its lower joint.
		// The old crest hid that joint behind fourteen metres of foreground steps.
		const top=pts.find(p=>p[1]>=33.5)||pts.at(-1);this.lookout=new Vector3(top[0],top[1],top[2]);
		const low=pts.find(p=>p[1]>=21.3)||pts[12];this.damageTarget=new Vector3(low[0]+l.dir[0]*.8-l.dir[1]*3.7,low[1]+1.6,low[2]+l.dir[1]*.8+l.dir[0]*3.7);
		this.platformY=low[1];
		findLookout:for(const offset of [0,2,4,6,8,10,12]){
			const at=new Vector3(top[0]-l.dir[0]*offset,0,top[2]-l.dir[1]*offset);
			const terrainY=s.app.terrainData.heightAt(at.x,at.z),support=s.app.player.groundAt(at.x,at.z,terrainY+4);
			at.y=Number.isFinite(support)?support:terrainY;
			for(const height of [1.6,2,2.4,2.8,3.2]){this.damageTarget.y=this.platformY+height;if(at.y>32&&clearTerrainSightline(s.app.terrainData,at.clone().add(new Vector3(0,1.62,0)),this.damageTarget)){this.lookout.copy(at);break findLookout;}}
		}
		this.cutscene=new StormScopeCutscene(this);
		if(s.app.scene&&s.app.village.materials){
			const B=new Builder();roomCraft(B,'oilCan');this.oilCan=new Group();this.oilCan.name='storm-oil-supply';
			for(const [key,batch]of Object.entries(B.batches)){const mesh=new Mesh(batch.build(),s.app.village.materials[key]);mesh.castShadow=mesh.receiveShadow=true;this.oilCan.add(mesh);}
			this.oilCan.visible=false;s.app.scene.add(this.oilCan);
		}
		this.workProps=new StormWorkProps(s);
	}
	// Coordinate-only compatibility for older local capture tools. No lantern,
	// light source, signal or human-presence beat is created at this location.
	get serviceLight(){return this.damageTarget;}
	get active(){return this.s.beat.startsWith('storm-');}
	get state(){return this.s.flags.storm||(this.s.flags.storm={elapsed:0,looked:0});}
	get strength(){return this.s.beat==='storm-prepare'?.58:['storm-look','storm-wave','storm-coast'].includes(this.s.beat)?1.5:1;}
	install(){const s=this.s,I=s.interact;
		I.add({id:'stormOil',at:KITCHEN.crate,reach:2,size:.4,hold:1.2,when:()=>s.beat==='storm-prepare'&&!this.state.oilTaken,text:'Take the capped oil supply',detail:'Keep the cap shut while carrying it to the lantern shelf.',use:()=>{this.state.oilTaken=true;s.app.player.carryingHeavy=true;s.toast('The cap is shut. I can carry this to the lantern shelf.');s.save();}});
		I.add({id:'stormShelf',at:TOWER.telescope.clone().add(new Vector3(0,-.45,0)),reach:2,size:.4,hold:1.2,when:()=>s.beat==='storm-prepare'&&this.state.oilTaken&&!this.state.oilStowed,text:'Set the oil supply safely in the lantern',detail:'Set the can upright on the shelf, clear of the moving apparatus.',use:()=>{this.state.oilStowed=true;s.app.player.carryingHeavy=false;s.toast('The oil is upright and secure. It will be here when I need it.');this.prepared();s.save();}});
		const gate=I.add({id:'stormGate',at:new Vector3(STATION.southGate.x,STATION.yard+1,STATION.southGate.z),reach:2.4,size:.45,when:()=>s.beat==='storm-prepare'&&!this.state.secured,
			text:()=>this.outsideGate?this.gateReady?'Close the gate and wrap the rope behind you':'Open the gate to finish the station preparations':'Open the gate and step outside',
			detail:()=>this.outsideGate&&this.gateReady?'A quick rope wrap keeps the prepared station secure while I inspect the coast.':'The oil supply and machine should be ready before I secure the gate behind me.',use:()=>this.outsideGate&&this.gateReady?this.secureGate():this.openGateForDeparture()});
		Object.defineProperty(gate,'hold',{configurable:true,get:()=>this.outsideGate&&this.gateReady?1.5:0});
		I.add({id:'stormScope',at:()=>this.damageTarget,reach:100,size:1,aimDegrees:28,hold:.4,when:()=>s.beat==='storm-look'&&s.app.player.position.distanceTo(this.lookout)<4.2,text:'Inspect the lower landing through the telescope',detail:'Stay on the upper footing. The lower steps are unsafe.',use:()=>this.startWave()});
		const journal=I.get('journal'),old=journal.use;journal.use=()=>this.active?this.journal():old();
	}
	async begin(coastOnly=false,{connected=false}={}){this.cutscene.close();this.busy=true;const s=this.s;try{
		this.endShown=false;this.damage.set(false);s.flags.storm={elapsed:0,looked:0,started:true,coastOnly,connected,reliefDelayKnown:connected,reliefStory:{status:'awaiting-return',promise:null,missedArrival:null}};s.flags.landed=true;s.h=connected?Math.max(s.h,615.5):615.5;s.arrival.group.visible=false;s.hasTelescope=true;s.moving.telescope.visible=false;s.hand.carried=s.hand.lit=true;s.lamp.ignite();s.lamp.wind=.7;s.lamp.start();
		const p=s.app.player;if(coastOnly){const l=s.app.terrainData.landing('west');p.position.set(l.stage.x,l.stage.y,l.stage.z);s.app.coastal.strength=1;s.app.coastal.time=COAST_START;s.app.coastal.sync?.();}
		else if(!connected)p.position.set(-1,TOWER.floor,4);
		p.mode='walk';p.grounded=true;p.velocity.set(0,0,0);p._camY=null;s.watcher=new Watcher();s.watcher.state='done';s.paused=false;s.setBeat(coastOnly?'storm-coast':'storm-prepare');s._applyClock();
		await s.ui.card(coastOnly?['Watch the larger sets reach the landing. The water you see can take your footing.','Hold E at an intact rail to brace. If you fall, reach the rungs and hold E to climb.']:[connected?'The gale reaches the station. The lower west steps are already unsafe.':'An isolated review of the later storm. This scene has its own save.','Bring up the capped oil supply, wind the machine and wrap the station gate with its securing rope.','Follow the upper tramway to the lookout. Inspect the lower landing from above; keep clear of the lower steps.'],{kicker:connected?'Monday 28th January · The extra large sea':'The extra large sea · review',title:coastOnly?'The dangerous landing':'A station against the Atlantic'});
		s.app.seaWeather?.select('fresh');s.app.seaDread?.setEnabled(true);
		s.app.keeperSafety?.reset();s.safeCheckpoint=JSON.parse(JSON.stringify(s._snapshot()));s.save();s.app.cameraCut?.();
	}finally{this.busy=false;}}
	get outsideGate(){return this.s.app.player.position.z>STATION.southGate.z+.5;}
	get gateReady(){return this.state.oilStowed&&(this.state.woundForDeparture||this.s.lamp.wind>=.95);}
	openGateForDeparture(){const s=this.s;if(s.beat!=='storm-prepare'||this.state.secured)return false;
		const doors=s.doors.southGate||[s.doors.gate[1]];for(const door of doors)door.target=1;
		s.firstWatch?.openGate(1);this.state.gateOpened=true;
		s.sound?.door('gate',true,doors[0].center);
		s.toast(this.gateReady?'I can step through, then draw the gate shut and wrap it behind me.':'The oil and winding need to be ready before I secure the station.',5500);s.save();return true;
	}
	secureGate(){const s=this.s;if(s.beat!=='storm-prepare'||this.state.secured||!this.outsideGate||!this.gateReady)return false;
		if(s.firstWatch?.secureGate)s.firstWatch.secureGate(1,{reason:'storm'});
		else{for(const d of s.doors.southGate||[s.doors.gate[1]])d.target=0;s.flags.gateRopes||={};s.flags.gateRopes[1]={secured:true,at:s.h};}
		this.state.secured=true;this.state.ropeSecured=true;
		s.toast('The rope holds the gate shut behind me. The upper tramway leads to the lookout.',6000);this.prepared();s.save();return true;
	}
	startWave(){const s=this.s;if(s.beat!=='storm-look'||this.cutscene.active||s.app.player.position.distanceTo(this.lookout)>4.2)return false;
		const eye=s.app.camera.position;
		if(!clearTerrainSightline(s.app.terrainData,eye,this.damageTarget))return false;
		this.state.waveAt=s.app.coastal.time;this.state.crestAt=stormCrestAt(s.app.coastal,this.damageTarget,this.state.waveAt);
		s.setBeat('storm-wave');this.cutscene.start();s.save();return true;
	}
	prepared(){if(this.s.beat!=='storm-prepare')return;
		if(this.s.lamp.wind>=.95&&!this.state.woundForDeparture){this.state.woundForDeparture=true;this.s.save();}
		if(this.state.secured&&this.s.flags.gateRopes?.[1]?.secured===false)this.state.secured=false;
		if(this.state.oilStowed&&this.state.secured&&this.state.woundForDeparture){this.s.setBeat('storm-look');this.s.app.seaWeather?.select('gale');}
	}
	goal(){const b=this.s.beat;if(b==='storm-prepare')return!this.state.oilTaken?'Bring a capped oil supply from the kitchen stores to the lantern.':!this.state.oilStowed?'Set the capped oil supply safely in the lantern.':!this.state.woundForDeparture&&this.s.lamp.wind<.95?'Wind the machine fully before going out.':!this.outsideGate?'Open the south gate and step outside. Close and wrap it behind you.':'Close the station gate and wrap the rope behind you.';
		return{'storm-look':this.s.app.player.position.distanceTo(this.lookout)<4?'Inspect the lower landing through the telescope. Stay on the upper footing.':'Follow the west tramway to the upper lookout. Stay above the lower landing.','storm-wave':'Watch from the upper lookout. A larger set is approaching.','storm-return':'The lower landing has gone. I can get home by the upper tramway.','storm-contact-pending':'','storm-keep':'Wind the machine and keep the lamp burning.','storm-signal':'Gallan Head is visible again. Answer Cate at the signal lamp.','storm-journal':'Write up the storm observations at the desk.','storm-complete':'','storm-coast':'Watch the sets. Brace at a rail; reach the rungs if swept into the sea.'}[b]||'';}
	lensText(){return !this.s.lamp.lit?'Relight the main lamp':'';}
	useLens(){this.s.lamp.ignite();this.s.sound?.ignite();this.onWind();}
	onWind(){this.prepared();if(this.s.beat==='storm-keep'&&this.s.lamp.wind>=.95&&this.s.lamp.lit){this.conversation();this.s.setBeat('storm-signal');}}
	watchText(){return '';}
	keepWatch(){}
	conversation(saved=null){const s=this.s;s.watcher=new Watcher(STORM_SIGNAL);s.watcher.familiar=true;s.watcher.onSent=(text,minutes)=>{s.h+=minutes/60;};s.watcher.appear();if(saved)s.watcher.load(saved);}
	restore(saved){
		this.cutscene.close();const s=this.s;
		this.damage.set(!!this.state.routeDestroyed);s.app.seaWeather?.select(s.beat==='storm-prepare'?'fresh':'gale');s.app.seaDread?.setEnabled(true);
		s.app.player.carryingHeavy=!!this.state.oilTaken&&!this.state.oilStowed;this.endShown=false;
		if(this.state.connected&&['storm-keep','storm-signal','storm-journal','storm-complete'].includes(s.beat)){
			this.state.legacyContact||={beat:s.beat,watcher:saved};this.state.returnQuiet=0;
			s.watcher=new Watcher();s.watcher.state='done';s.setBeat('storm-contact-pending');
		}else if(s.beat==='storm-signal')this.conversation(saved);else s.watcher.load(saved);
		// Story restores the feet and view after restoring chapter flags. Resume
		// on its next update so old saves without scopeHome use that saved footing.
		this.resumeScope=s.beat==='storm-wave';
	}
	guidance(){const s=this.s,p=s.app.player.position,b=s.beat;if(this.cutscene.active||['storm-complete','storm-coast','storm-contact-pending'].includes(b))return null;
		if(b==='storm-look'||b==='storm-wave'){return westRoute(s,this.lookout,'Upper lookout · do not descend');}
		if(b==='storm-return')return westRoute(s,new Vector3(-3,TOWER.floor,1),'Return to the station',true);
		if(b==='storm-prepare'&&this.gateReady&&this.state.gateOpened&&!this.outsideGate&&p.z>STATION.southGate.z-4)return{at:new Vector3(STATION.southGate.x,STATION.yard+1,STATION.southGate.z+1.3),label:'Step outside, then secure the gate behind you',id:'stormStepOutside'};
		let id=b==='storm-prepare'?!this.state.oilTaken?'stormOil':!this.state.oilStowed?'stormShelf':!this.state.woundForDeparture&&s.lamp.wind<.95?'crank':'stormGate':b==='storm-keep'?'crank':b==='storm-signal'?'signal':'journal';
		if(b==='storm-keep'&&!s.lamp.lit)id='lens';const item=s.interact.get(id);if(!item)return null;const at=typeof item.at==='function'?item.at():item.at;
		return routeGuidance(p,{at,label:this.goal(),id},['crank','lens','stormShelf'].includes(id)?'lantern':id==='signal'?'gallery':id==='stormGate'?'yard':'room');}
	async journal(){if(this.s.beat!=='storm-journal'||this.busy)return;const s=this.s;this.busy=true;try{await s.ui.journal({heading:this.state.connected?'Monday 28th January · The extra large sea':'The extra large sea · isolated review',rows:[[ 'Evening','Lower west landing destroyed by a large sea. Returned by the upper tramway.' ],['Watch','Station secured. Lamp maintained. Gallan Head informed.']],remarks:[],footer:'W. Innes, Assistant Keeper'});s.row(s.h,'Storm watch maintained. Cate reported inability to confirm keeper safety.');s.setBeat('storm-complete');this.showEnd();}finally{this.busy=false;}}
	showEnd(){if(this.endShown)return;this.endShown=true;
		if(this.state.connected)return this.holdRevisedStory();
		this.s.ui.end({heading:'The light is still burning',rows:[],lines:['You are back inside. The lower landing is gone.','Cate reported what she could not confirm.','End of the isolated storm review.'],credits:'An authored fictional storm, with a separate save. The later contact and ending remain under review.'});
	}
	holdRevisedStory(){
		const state=this.state;
		state.reliefStory||={promise:null,missedArrival:null};
		state.reliefStory.status='awaiting-authored-contact';
		state.reliefStory.returnCompleted=true;
		// The approved direction is a company promise carried by Cate, followed by
		// a missed expected arrival. Exact dialogue, expectation, cause and the
		// intervening story are not approved. Do not manufacture them or jump to
		// the held February ending. Sources and the isolated scene-19 review remain.
		this.s.later?.holdForStoryReview?.('storm-contact');
		this.s.save();
	}
	prepareHazards(time){
		const s=this.s,coast=s.app.coastal;if(!coast)return;
		if(s.beat==='storm-wave'&&!Number.isFinite(this.state.crestAt))this.state.crestAt=stormCrestAt(coast,this.damageTarget,this.state.waveAt??time);
		const crest=this.state.crestAt??time;
		coast.rogue=s.beat==='storm-wave'?48*Math.max(0,Math.min(1,(time-(crest-8))/3,(crest+7-time)/4)):0;
		if(s.beat==='storm-wave'&&!this.state.routeDestroyed&&coast.sample(this.damageTarget,{time,strength:this.strength,ground:this.platformY}).washDepth>3){
			this.damage.set(true);this.state.routeDestroyed=true;this.state.destroyedAt=time;s.row(s.h,'A large sea destroyed the lower west landing. Upper tramway remains passable.');s.toast('The lower landing has broken away. Stay here until the water drains.',6500);
			const impact={x:this.damageTarget.x,y:this.platformY,z:this.damageTarget.z};s.sound?.cliffImpact(impact,1.5);s.sound?.fittingRattle(impact,1.5);s.app.seaDread?.cliffImpact(impact,1.5);
		}
	}
	update(dt){const s=this.s,b=s.beat,app=s.app,weather=app.seaWeather?.state;
		if(b==='storm-prepare')this.prepared();
		if(this.resumeScope){this.resumeScope=false;this.cutscene.start();}
		const paused=s.paused||s.ui.open||app.mobile?.paused||app.devMenu?.open||app.freeCam||app.ui?.ui?.photoMode||globalThis.document?.hidden||app.keeperSafety?.state==='dead';
		// Winding belongs to preparation and tower watches. The apparatus keeps
		// turning, but its charge cannot expire while the keeper is out on this job.
		const away=['storm-look','storm-wave','storm-return','storm-contact-pending'].includes(b)||(b==='storm-prepare'&&this.state.woundForDeparture);
		const go=chapterFrame(s,dt,{communicate:b==='storm-signal',visibility:b==='storm-signal'?60:weather?.vis||4.5,clouds:weather?.clouds||.92,blocked:this.busy||this.cutscene.active,rate:away?0:1/900,cap:620});
		Beams.uniforms.far.value[1].w=0;
		if(this.cutscene.active){
			this.cutscene.update(dt,paused);
			if(!paused){
				this.state.elapsed+=dt;
				if(this.state.routeDestroyed&&app.coastal.time>=(this.state.crestAt??this.state.waveAt+20)+8){
					app.coastal.rogue=0;app.coastal.sync?.();this.cutscene.close({completed:true});
					s.setBeat('storm-return');s.toast('The lower platform is gone. I can get home by the intact upper tramway.',6500);s.save();
				}
			}
			return;
		}
		if(!go)return;this.state.elapsed+=dt;
		if(this.oilCan){
			this.oilCan.visible=true;const cam=s.app.camera;
			if(this.state.oilTaken&&!this.state.oilStowed){const f=new Vector3(-Math.sin(s.app.player.yaw),0,-Math.cos(s.app.player.yaw)),r=new Vector3(-f.z,0,f.x);this.oilCan.position.copy(cam.position).addScaledVector(f,.45).addScaledVector(r,-.3);this.oilCan.position.y-=.8;this.oilCan.rotation.y=s.app.player.yaw;}
			else this.oilCan.position.copy(this.state.oilStowed?TOWER.telescope.clone().add(new Vector3(0,-.45,0)):KITCHEN.crate.clone().add(new Vector3(0,.33,0)));
		}
		const looking=new Vector3(0,0,-1).applyQuaternion(s.app.camera.quaternion).dot(this.damageTarget.clone().sub(s.app.camera.position).normalize())>.866;
		// Looking steadily from this same safe spot also begins the inspection,
		// so missing a contextual prompt cannot strand the scene.
		if(b==='storm-look'&&s.app.player.position.distanceTo(this.lookout)<4&&looking&&clearTerrainSightline(s.app.terrainData,s.app.camera.position,this.damageTarget)){this.state.looked+=dt;if(this.state.looked>=4)this.startWave();}
		if(b==='storm-wave')this.cutscene.start();
		if(b==='storm-return'&&s.app.player.position.x>ROOM.x0&&s.app.player.position.x<ROOM.x1&&s.app.player.position.z>ROOM.z0&&s.app.player.position.z<ROOM.z1){
			this.state.returnedAt=s.h;this.state.returnQuiet=0;
			if(this.state.connected)s.setBeat('storm-contact-pending');
			else{s.lamp.wind=Math.min(s.lamp.wind,.45);s.setBeat('storm-keep');}
			s.save();
		}
		if(b==='storm-contact-pending'){this.state.returnQuiet=(this.state.returnQuiet||0)+dt;if(this.state.returnQuiet>=2&&!this.endShown){this.endShown=true;this.holdRevisedStory();}}
		if(b==='storm-signal'){if(s.app.haze)s.app.haze.density.value=.00001;if(s.app.seaWeather)s.app.seaWeather.state.vis=60;if(s.watcher.state==='done'&&!s.watcher.lost&&!s.signal)s.setBeat('storm-journal');}
		if(b==='storm-complete')this.showEnd();
	}
}
const COAST_START=6.9;
export function westRoute(s,target,label,home=false){
	const p=s.app.player.position;
	const house=p.x>-21.4&&p.x<ROOM.x1&&p.z>ROOM.z0&&p.z<ROOM.z1;
	const wing=p.x>-5.4&&p.x<1.2&&p.z>5.4&&p.z<14.4;
	const store=p.x>7.25&&p.x<11.35&&p.z>-4.35&&p.z<-.85;
	if(p.y>TOWER.floor+.65&&Math.hypot(p.x,p.z)<4.2 || house||wing||store)return routeGuidance(p,{at:target,label,id:'stormRoute'},home?'room':'yard');
	const points=s.station.tracks.west;
	if(!home&&p.x>-20){
		if(p.x>7&&p.z<2)return{at:new Vector3(9.3,TOWER.floor+1,2),label:'Workshop entrance',id:'stormStoreExit'};
		if(p.z<4||p.x<4&&p.z<16)return{at:new Vector3(4.5,TOWER.floor+1,4.6),label:'Round the house',id:'stormHouseCorner'};
		if(p.z<17.5)return{at:new Vector3(4.5,TOWER.floor+1,18.5),label:'South side of the house',id:'stormHouseSouth'};
		if(p.x>STATION.southGate.x+2)return{at:new Vector3(STATION.southGate.x,STATION.yard+1,18.5),label:'South gate · west tramway',id:'stormGateApproach'};
		if(p.z<23.5)return{at:new Vector3(STATION.southGate.x,STATION.yard+1,24),label:'South gate · E',id:'stormGateRoute'};
	}
	if(home&&p.x>-25){if(p.z>21)return{at:new Vector3(STATION.southGate.x,STATION.yard+1,Math.abs(p.x-STATION.southGate.x)>1?24:18.5),label:'Station gate · E',id:'stormHomeGate'};if(p.x<3.5)return{at:new Vector3(4.5,TOWER.floor+1,18.5),label:'House entrance',id:'stormHouseSouth'};if(p.z>6)return{at:new Vector3(4.5,TOWER.floor+1,4.6),label:'House entrance',id:'stormHouseEast'};return{at:new Vector3(ROOM.door.x-.7,TOWER.floor+1,ROOM.door.z),label:'Keepers’ room door · E',id:'houseDoor'};}
	const path=home?points:points.slice().reverse();
	const next=home?path.find(q=>q[0]>p.x+8):path.find(q=>q[0]<p.x-8);
	if(next&&(home||p.x>points[0][0]+5))return{at:new Vector3(next[0],s.app.terrainData.heightAt(...next)+1,next[1]),label:'Upper tramway',id:'stormTramway'};
	return{at:target.clone().add(new Vector3(0,1,0)),label,id:'stormLookout'};
}
