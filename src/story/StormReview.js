import { Vector3, Group, Mesh } from '../engine/index.js';
import { TOWER, ROOM, STATION } from '../world/flannan/Station.js';
import { KITCHEN } from '../world/flannan/NextRooms.js';
import { Beams } from '../station/Beams.js';
import { HandLamp } from '../station/HandLamp.js';
import { Watcher } from './Watcher.js';
import { routeGuidance } from './Guidance.js';
import { chapterFrame } from './WatchChapter.js';
import { LandingDamage } from './LandingDamage.js';
import { clearTerrainSightline } from './ReturningLight.js';
import { Builder } from '../world/village/GeoBuilder.js';
import { roomCraft } from '../world/flannan/RoomCraft.js';

export const STORM_SIGNAL={start:'seen',nodes:{
	seen:{her:'I CAN SEE THE LIGHT. I CANNOT SEE YOU.',options:[{text:'I AM AT THE STATION. WEST LANDING GONE.',minutes:2,next:'report'}]},
	report:{her:'I REPORTED THAT I COULD NOT CONFIRM YOUR SAFETY.',options:[{text:'THANK YOU. THE LIGHT IS BURNING.',minutes:2,next:'end'}]},
	end:{her:'KEEP HER LIT. I AM WATCHING.',end:true},
}};
export class StormReview {
	constructor(s){this.s=s;this.busy=false;this.endShown=false;this.damage=new LandingDamage(s.app);
		const l=s.app.terrainData.landing('west'),pts=l.steps.pts;
		const top=pts.find(p=>p[1]>=40)||pts.at(-1);this.lookout=new Vector3(top[0],top[1],top[2]);
		const low=pts.find(p=>p[1]>=21.3)||pts[12];this.serviceLight=new Vector3(low[0]+l.dir[0]*.8-l.dir[1]*3.7,low[1]+1.6,low[2]+l.dir[1]*.8+l.dir[0]*3.7);
		this.platformY=low[1];
		findLookout:for(const height of [1.6,2,2.4,2.8,3.2]){this.serviceLight.y=this.platformY+height;for(const offset of [0,2,4,6,8,10,12]){const at=new Vector3(top[0]-l.dir[0]*offset,0,top[2]-l.dir[1]*offset);at.y=s.app.terrainData.heightAt(at.x,at.z);if(at.y>32&&clearTerrainSightline(s.app.terrainData,at.clone().add(new Vector3(0,1.62,0)),this.serviceLight)){this.lookout.copy(at);break findLookout;}}}
		if(s.app.qs?.has('stormPreview')&&s.app.scene){this.lantern=new HandLamp();this.lantern.setRest(this.serviceLight);this.lantern.lit=true;this.lantern.group.visible=false;s.app.scene.add(this.lantern.group);}
		if(s.app.qs?.has('stormPreview')&&s.app.scene&&s.app.village.materials){
			const B=new Builder();roomCraft(B,'oilCan');this.oilCan=new Group();this.oilCan.name='storm-oil-supply';
			for(const [key,batch]of Object.entries(B.batches)){const mesh=new Mesh(batch.build(),s.app.village.materials[key]);mesh.castShadow=mesh.receiveShadow=true;this.oilCan.add(mesh);}
			this.oilCan.visible=false;s.app.scene.add(this.oilCan);
		}
	}
	get active(){return this.s.beat.startsWith('storm-');}
	get state(){return this.s.flags.storm||(this.s.flags.storm={elapsed:0,looked:0});}
	get strength(){return this.s.beat==='storm-prepare'?.58:['storm-look','storm-wave','storm-coast'].includes(this.s.beat)?1.5:1;}
	install(){const s=this.s,I=s.interact;
		I.add({id:'stormOil',at:KITCHEN.crate,reach:2,size:.4,hold:1.5,when:()=>s.beat==='storm-prepare'&&!this.state.oilTaken,text:'Take the capped oil supply',use:()=>{this.state.oilTaken=true;s.app.player.carryingHeavy=true;s.toast('Carry the capped oil supply to the lantern.');s.save();}});
		I.add({id:'stormShelf',at:TOWER.telescope.clone().add(new Vector3(0,-.45,0)),reach:2,size:.4,hold:1.5,when:()=>s.beat==='storm-prepare'&&this.state.oilTaken&&!this.state.oilStowed,text:'Set the oil supply safely in the lantern',use:()=>{this.state.oilStowed=true;s.app.player.carryingHeavy=false;this.prepared();s.save();}});
		I.add({id:'stormGate',at:new Vector3(STATION.southGate.x,STATION.yard+1,STATION.southGate.z),reach:2.4,size:.45,hold:1.5,when:()=>s.beat==='storm-prepare'&&!this.state.secured,text:'Check and secure the station gate latch',use:()=>{for(const d of s.doors.gate)d.target=0;this.state.secured=true;s.toast('The latch holds. Open the gate to pass, then shut it behind you.',6000);this.prepared();s.save();}});
		const journal=I.get('journal'),old=journal.use;journal.use=()=>this.active?this.journal():old();
	}
	async begin(coastOnly=false){this.busy=true;const s=this.s;try{
		this.damage.set(false);s.flags.storm={elapsed:0,looked:0,started:true,coastOnly};s.flags.landed=true;s.h=615.5;s.arrival.group.visible=false;s.hasTelescope=true;s.moving.telescope.visible=false;s.hand.carried=s.hand.lit=true;s.lamp.ignite();s.lamp.wind=.7;s.lamp.start();
		const p=s.app.player;if(coastOnly){const l=s.app.terrainData.landing('west');p.position.set(l.stage.x,l.stage.y,l.stage.z);s.app.coastal.strength=1;s.app.coastal.time=COAST_START;s.app.coastal.sync?.();}
		else p.position.set(-1,TOWER.floor,4);
		p.mode='walk';p.grounded=true;p.velocity.set(0,0,0);p._camY=null;s.watcher=new Watcher();s.watcher.state='done';s.paused=false;s.setBeat(coastOnly?'storm-coast':'storm-prepare');s._applyClock();
		await s.ui.card(coastOnly?['Watch the larger sets reach the landing. The water you see can take your footing.','Hold E at an intact rail to brace. If you fall, reach the rungs and hold E to climb.']:['An isolated review of the later storm. This scene has its own save.','Bring up the capped oil supply, wind the machine and secure the station gate.','Watch the west landing from the upper lookout. Do not descend into the breaking sea.'],{kicker:'The extra large sea · review',title:coastOnly?'The dangerous landing':'A station against the Atlantic'});
		s.app.keeperSafety?.reset();s.safeCheckpoint=JSON.parse(JSON.stringify(s._snapshot()));s.save();s.app.cameraCut?.();
	}finally{this.busy=false;}}
	prepared(){if(this.s.beat==='storm-prepare'&&this.state.oilStowed&&this.state.secured&&this.s.lamp.wind>=.95){this.s.setBeat('storm-look');this.s.app.seaWeather?.select('gale');}}
	goal(){const b=this.s.beat;if(b==='storm-prepare')return!this.state.oilTaken?'Bring a capped oil supply from the kitchen stores to the lantern.':!this.state.oilStowed?'Set the capped oil supply safely in the lantern.':!this.state.secured?'Secure the station gate.':'Wind the machine fully before going out.';
		return{'storm-look':'Follow the west tramway to the upper lookout. Stay above the lower landing.','storm-wave':'Watch from the upper lookout. A larger set is approaching.','storm-return':'The lower landing has gone. Return by the upper tramway to the station.','storm-keep':'Wind the machine and keep the lamp burning.','storm-signal':'Gallan Head is visible again. Answer Cate at the signal lamp.','storm-journal':'Write up the storm observations at the desk.','storm-complete':'','storm-coast':'Watch the sets. Brace at a rail; reach the rungs if swept into the sea.'}[b]||'';}
	lensText(){return !this.s.lamp.lit?'Relight the main lamp':'';}
	useLens(){this.s.lamp.ignite();this.s.sound?.ignite();this.onWind();}
	onWind(){this.prepared();if(this.s.beat==='storm-keep'&&this.s.lamp.wind>=.95&&this.s.lamp.lit){this.conversation();this.s.setBeat('storm-signal');}}
	watchText(){return '';}
	keepWatch(){}
	conversation(saved=null){const s=this.s;s.watcher=new Watcher(STORM_SIGNAL);s.watcher.familiar=true;s.watcher.onSent=(text,minutes)=>{s.h+=minutes/60;};s.watcher.appear();if(saved)s.watcher.load(saved);}
	restore(saved){this.damage.set(!!this.state.routeDestroyed);this.s.app.player.carryingHeavy=!!this.state.oilTaken&&!this.state.oilStowed;if(this.s.beat==='storm-signal')this.conversation(saved);else this.s.watcher.load(saved);this.endShown=false;}
	guidance(){const s=this.s,p=s.app.player.position,b=s.beat;if(['storm-complete','storm-coast'].includes(b))return null;
		if(b==='storm-look'||b==='storm-wave'){return westRoute(s,this.lookout,'Upper lookout · do not descend');}
		if(b==='storm-return')return westRoute(s,new Vector3(4.5,TOWER.floor,4.6),'Return to the station',true);
		let id=b==='storm-prepare'?!this.state.oilTaken?'stormOil':!this.state.oilStowed?'stormShelf':!this.state.secured?'stormGate':'crank':b==='storm-keep'?'crank':b==='storm-signal'?'signal':'journal';
		if(b==='storm-keep'&&!s.lamp.lit)id='lens';const item=s.interact.get(id);if(!item)return null;const at=typeof item.at==='function'?item.at():item.at;
		return routeGuidance(p,{at,label:this.goal(),id},['crank','lens','stormShelf'].includes(id)?'lantern':id==='signal'?'gallery':id==='stormGate'?'yard':'room');}
	async journal(){if(this.s.beat!=='storm-journal')return;const s=this.s;await s.ui.journal({heading:'The extra large sea · isolated review',rows:[[ 'Evening','Lower west landing destroyed by a large sea. Returned by the upper tramway.' ],['Watch','Station secured. Lamp maintained. Gallan Head informed.']],remarks:[],footer:'W. Innes, Assistant Keeper'});s.setBeat('storm-complete');this.showEnd();}
	showEnd(){if(this.endShown)return;this.endShown=true;this.s.ui.end({heading:'The light is still burning',rows:[],lines:['You are back inside. The lower landing is gone.','Cate reported what she could not confirm.','End of the storm review. This is not the relief ending.'],credits:'An authored fictional storm, with separate saves. The unresolved Eilean Tighe light remains a different incident.'});}
	prepareHazards(time){
		const s=this.s,coast=s.app.coastal;if(!coast)return;
		const elapsed=time-(this.state.waveAt??time);
		coast.rogue=s.beat==='storm-wave'&&elapsed>3&&elapsed<28?48*Math.min(1,(elapsed-3)/3,(28-elapsed)/3):0;
		if(s.beat==='storm-wave'&&!this.state.routeDestroyed&&coast.sample(this.serviceLight,{time,strength:this.strength,ground:this.platformY}).washDepth>3){
			this.damage.set(true);this.state.routeDestroyed=true;s.row(s.h,'A large sea destroyed the lower west landing. Upper tramway remains passable.');s.toast('The lower route is gone. Return by the upper tramway.',6500);
			const impact={x:this.serviceLight.x,y:this.platformY,z:this.serviceLight.z};s.sound?.cliffImpact(impact,1.5);s.sound?.fittingRattle(impact,1.5);s.app.seaDread?.cliffImpact(impact,1.5);
		}
	}
	update(dt){const s=this.s,b=s.beat,weather=s.app.seaWeather?.state,go=chapterFrame(s,dt,{communicate:b==='storm-signal',visibility:b==='storm-signal'?60:weather?.vis||4.5,clouds:weather?.clouds||.92,blocked:this.busy,rate:1/900,cap:620});
		Beams.uniforms.far.value[1].w=0;if(!go)return;this.state.elapsed+=dt;
		if(this.oilCan){
			this.oilCan.visible=true;const cam=s.app.camera;
			if(this.state.oilTaken&&!this.state.oilStowed){const f=new Vector3(-Math.sin(s.app.player.yaw),0,-Math.cos(s.app.player.yaw)),r=new Vector3(-f.z,0,f.x);this.oilCan.position.copy(cam.position).addScaledVector(f,.45).addScaledVector(r,-.3);this.oilCan.position.y-=.8;this.oilCan.rotation.y=s.app.player.yaw;}
			else this.oilCan.position.copy(this.state.oilStowed?TOWER.telescope.clone().add(new Vector3(0,-.45,0)):KITCHEN.crate.clone().add(new Vector3(0,.33,0)));
		}
		if(this.lantern){this.lantern.lit=!this.state.routeDestroyed;const at=this.serviceLight.clone();at.x+=Math.sin(this.state.elapsed*2.1)*.2;at.y+=Math.sin(this.state.elapsed*1.2)*.15;this.lantern.setRest(at);this.lantern.update(dt,s.app.camera);this.lantern.group.visible=['storm-look','storm-wave'].includes(b);}
		if(b==='storm-look'||b==='storm-wave')Beams.uniforms.far.value[1].set(this.serviceLight.x,this.serviceLight.y,this.serviceLight.z,this.state.routeDestroyed?0:140*(.65+.35*Math.sin(this.state.elapsed*2.1)**2));
		const looking=new Vector3(0,0,-1).applyQuaternion(s.app.camera.quaternion).dot(this.serviceLight.clone().sub(s.app.camera.position).normalize())>.866;
		if(b==='storm-look'&&s.app.player.position.distanceTo(this.lookout)<4&&looking&&clearTerrainSightline(s.app.terrainData,s.app.camera.position,this.serviceLight)){this.state.looked+=dt;if(this.state.looked>=4){this.state.waveAt=s.app.coastal.time;s.setBeat('storm-wave');s.toast('The lantern below moves with the hauling gear. Stay above the stairs.',6500);}}
		if(b==='storm-wave'){
			const elapsed=s.app.coastal.time-this.state.waveAt;
			if(elapsed>=28&&this.state.routeDestroyed){s.app.coastal.rogue=0;s.app.coastal.sync?.();s.setBeat('storm-return');}
		}
		if(b==='storm-return'&&s.app.player.position.x>ROOM.x0&&s.app.player.position.x<ROOM.x1&&s.app.player.position.z>ROOM.z0&&s.app.player.position.z<ROOM.z1){s.lamp.wind=Math.min(s.lamp.wind,.45);s.setBeat('storm-keep');}
		if(b==='storm-signal'){if(s.app.haze)s.app.haze.density.value=.00001;if(s.app.seaWeather)s.app.seaWeather.state.vis=60;if(s.watcher.state==='done'&&!s.watcher.lost&&!s.signal)s.setBeat('storm-journal');}
		if(b==='storm-complete')this.showEnd();
	}
}
const COAST_START=6.9;
export function westRoute(s,target,label,home=false){
	const p=s.app.player.position;
	if(p.y>TOWER.floor+.65&&Math.hypot(p.x,p.z)<4.2 || p.x>ROOM.x0&&p.x<ROOM.x1&&p.z>ROOM.z0&&p.z<ROOM.z1)return routeGuidance(p,{at:target,label,id:'stormRoute'},'yard');
	const points=s.station.tracks.west;
	if(!home&&p.x>-20){const z=p.z<21?18.5:24;return{at:new Vector3(-12,STATION.yard+1,z),label:'South gate · west tramway',id:'stormGateRoute'};}
	if(home&&p.x>-25){if(p.z>21)return{at:new Vector3(-12,STATION.yard+1,18.5),label:'Station gate',id:'stormHomeGate'};if(p.x<3.5)return{at:new Vector3(4.5,TOWER.floor+1,18.5),label:'House entrance',id:'stormHouseSouth'};if(p.z>6)return{at:new Vector3(4.5,TOWER.floor+1,4.6),label:'House entrance',id:'stormHouseEast'};return{at:new Vector3(ROOM.door.x-.7,TOWER.floor+1,ROOM.door.z),label:'Keepers’ room door · E',id:'houseDoor'};}
	const path=home?points:points.slice().reverse();
	const next=home?path.find(q=>q[0]>p.x+8):path.find(q=>q[0]<p.x-8);
	if(next&&(home||p.x>points[0][0]+5))return{at:new Vector3(next[0],s.app.terrainData.heightAt(...next)+1,next[1]),label:'Upper tramway',id:'stormTramway'};
	return{at:target.clone().add(new Vector3(0,1,0)),label,id:'stormLookout'};
}
