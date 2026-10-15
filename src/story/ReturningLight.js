import { Vector3, MathUtils } from '../engine/index.js';
import { TOWER, ROOM, STATION } from '../world/flannan/Station.js';
import { BERTH } from '../world/flannan/NextRooms.js';
import { Beams } from '../station/Beams.js';
import { routeGuidance } from './Guidance.js';
import { Watcher } from './Watcher.js';
import { chapterFrame } from './WatchChapter.js';

export const ISLET_LIGHT = new Vector3(164,44.6,540);
export function isletLightPosition(terrain){return new Vector3(ISLET_LIGHT.x,Math.max(ISLET_LIGHT.y,terrain.heightAt(ISLET_LIGHT.x,ISLET_LIGHT.z)+1.4),ISLET_LIGHT.z);}
export function clearTerrainSightline(terrain,eye,at){for(let i=1;i<60;i++){const p=eye.clone().lerp(at,i/60);if(terrain.heightAt(p.x,p.z)>p.y-.1)return false;}return true;}
export function investigationViewpoint(terrain){
	const l=terrain.landing('east'),start=new Vector3(l.top.x,terrain.heightAt(l.top.x,l.top.z),l.top.z),light=isletLightPosition(terrain);let best=start,score=Infinity;
	for(let x=36;x<=174;x+=6)for(let z=36;z<=240;z+=6){
		const y=terrain.heightAt(x,z);if(y<25)continue;const p=new Vector3(x,y,z),eye=p.clone().add(new Vector3(0,1.62,0)),channel=light.clone().lerp(p,.45);channel.y=.4;
		if(terrain.heightAt(channel.x,channel.z)>-.5||!clearTerrainSightline(terrain,eye,light)||!clearTerrainSightline(terrain,eye,channel))continue;
		if([[4,0],[-4,0],[0,4],[0,-4]].some(([a,b])=>Math.abs(terrain.heightAt(x+a,z+b)-y)>3))continue;
		const distance=Math.hypot(x-start.x,z-start.z);if(distance>=score)continue;
		let previous=start.y,walkable=true;for(let i=1;i<=Math.ceil(distance);i++){const q=start.clone().lerp(p,i/Math.ceil(distance)),h=terrain.heightAt(q.x,q.z);if(h<20||Math.abs(h-previous)>.85){walkable=false;break;}previous=h;}
		if(walkable){best=p;score=distance;}
	}
	return best;
}
const reply=(text,next,flag)=>({text,next,minutes:2,...(flag?{flag}:{})});
export function returningScript( firstSeen, evidence, report=false ) {
	return {start:'hello',nodes:report?{
		hello:{her:'LIGHT SEEN. K',wire:'1 K',options:[reply(evidence.channel?'NO BOAT SEEN IN THE CHANNEL.':'I KEPT TO THE STATION.','answer')]},
		answer:{her:evidence.ridge?'DID YOU FIND A HOUSE':'YOU DID RIGHT TO KEEP THE WATCH.',options:[reply(evidence.ridge?(evidence.seen?'ONLY THE RIDGE WHERE I SAW THE LIGHT.':'ONLY THE RIDGE. NO LIGHT BY DAY.'):'THE LIGHT STILL TROUBLES ME.','uncertain')]},
		uncertain:{her:'I CANNOT TELL YOU WHO WAS THERE.',options:[reply('I WILL WRITE WHAT I SAW.','end'),reply('I WILL LEAVE IT OUT OF THE JOURNAL.','end','omitLight')]},
		end:{her:'GOOD NIGHT. KEEP HER LIT.',end:true},
	}:{
		hello:{her:'LIGHT SEEN. K',wire:'1 K',options:[reply(firstSeen?'THAT LIGHT ON EILEAN TIGHE HAS RETURNED.':'A SMALL LIGHT ON EILEAN TIGHE.','where')]},
		where:{her:'WHERE ON THE ISLAND',options:[reply('HIGH ON THE RIDGE. IT COMES AND GOES.','see')]},
		see:{her:'I CANNOT SEE THAT SHORE FROM HERE.',options:[reply('I COULD LOOK BY DAYLIGHT.','care'),reply('I WILL STAY WITH THE LIGHT.','care')]},
		care:{her:'LOOK FROM YOUR OWN SHORE. DO NOT TRY THE CHANNEL.',options:[reply('UNDERSTOOD. GOOD NIGHT CATE.','end')]},
		end:{her:'GOOD NIGHT. KEEP HER LIT.',end:true},
	} };
}

export class ReturningLight {
	constructor(s){this.s=s;this.busy=false;this.endShown=false;this.light=isletLightPosition(s.app.terrainData);this.viewpoint=investigationViewpoint(s.app.terrainData);this.channel=this.light.clone().lerp(this.viewpoint,.45);this.channel.y=.4;}
	get active(){return this.s.beat.startsWith('rl-');}
	get state(){return this.s.flags.returningLight||(this.s.flags.returningLight={elapsed:0,seenSeconds:0});}
	install(){
		const s=this.s,I=s.interact;
		I.add({id:'rlLeave',at:TOWER.signal,reach:2,size:.35,when:()=>s.beat==='rl-look',text:'Leave the islet light and keep the watch',use:()=>this.finishSighting(false)});
		I.add({id:'rlBerth',at:BERTH.bed,size:.5,when:()=>s.beat==='rl-rest',text:'Keep the watch, then rest until daylight',use:()=>this.daylight()});
		I.add({id:'rlStudy',at:()=>s.app.camera.position.clone().addScaledVector(new Vector3(0,0,-1).applyQuaternion(s.app.camera.quaternion),1),reach:3,size:.6,hold:4,
			when:()=>s.beat==='rl-view'&&this.nearViewpoint()&&s.tel>.6&&this.looking(this.state.ridge?this.channel:this.light),
			text:()=>this.state.ridge?'Watch the channel for a vessel':'Examine the ridge through the telescope',use:()=>this.observe()});
		const journal=I.get('journal'),old=journal.use;
		journal.use=()=>this.active?this.journal():old();
	}
	async begin(preview=false){
		const s=this.s;this.endShown=false;this.busy=true;
		try{
			if(!preview)await s.ui.card(['The intervening watches pass. The relief has not returned.','On the next clear evening, Eilean Tighe is visible again.'],{kicker:'A returning light',title:'Tuesday 8th January 1901'});
			s.h=135.12;s.arrival.group.visible=false;s.flags.landed=true;s.flags.returningLight={elapsed:0,seenSeconds:0,started:true};
			s.lamp.extinguish();s.lamp.stop();s.lamp.glow=s.lamp.speed=0;s.lamp.wind=.65;s.hand.carried=true;s.hand.lit=true;
			if(preview){s.hasTelescope=true;s.moving.telescope.visible=false;const p=s.app.player;p.position.set(-1,TOWER.floor,4);p.grounded=true;p.mode='walk';p.velocity.set(0,0,0);p._camY=null;}
			s.watcher=new Watcher();s.watcher.state='done';s.paused=false;s.setBeat('rl-light');s._applyClock();s.app.cameraCut?.();
		}finally{this.busy=false;}
	}
	goal(){return {'rl-light':this.state.nextEvening?'Light the lamp before reporting to Cate.':'Light the lamp for the next watch.','rl-wind':'Wind the machine fully.','rl-look':'A light on Eilean Tighe. Look southeast from the balcony, or leave it and keep watch.','rl-signal':'Ask Cate about the light at the signal lamp.','rl-rest':'Keep the night watch, then rest in your berth.','rl-view':this.state.ridge?'Through the telescope, watch the channel below Eilean Tighe for a vessel.':'Go to the east headland above the landing. Examine Eilean Tighe through the telescope.','rl-return':'Return to the station.','rl-report':'Report your observations to Cate at the signal lamp.','rl-journal':'Write only what you observed in the journal.','rl-complete':''}[this.s.beat]||'';}
	lensText(){return this.s.beat==='rl-light'?'Light the lamp':'';}
	useLens(){if(this.s.beat!=='rl-light')return;this.s.lamp.ignite();this.s.sound?.ignite();this.s.row(this.s.h,`Lamp lit for the watch of ${this.state.nextEvening?9:8} January.`);this.s.setBeat('rl-wind');this.onWind();}
	onWind(){if(this.s.beat==='rl-wind'&&this.s.lamp.wind>=.95){if(this.state.nextEvening){this.conversation(true);this.s.setBeat('rl-report');}else this.s.setBeat('rl-look');}}
	watchText(){return this.s.beat==='rl-rest'?'Keep watch, then rest until daylight':'';}
	keepWatch(){return this.daylight();}
	looking(at){const c=this.s.app.camera,eye=c.position;if(this.s.app.player.position.y<TOWER.deck-.3&&this.s.beat==='rl-look')return false;const d=at.clone().sub(eye).normalize(),f=new Vector3(0,0,-1).applyQuaternion(c.quaternion);return f.dot(d)>=Math.cos(MathUtils.degToRad(Math.max(1.5,c.fov*.32)))&&clearTerrainSightline(this.s.app.terrainData,eye,at);}
	nearViewpoint(){return this.s.app.player.position.distanceTo(this.viewpoint)<4;}
	async finishSighting(seen){
		if(this.busy||this.s.beat!=='rl-look')return;this.busy=true;const s=this.s;
		try{
			if(seen){this.state.seen=true;this.state.bearing=Math.round((Math.atan2(this.light.x-s.app.camera.position.x,-(this.light.z-s.app.camera.position.z))*180/Math.PI+360)%360);this.state.at=s.h;}
			Beams.uniforms.far.value[1].w=0;
			if(seen){await s.ui.read({title:'The light on Eilean Tighe',body:[s.flags.isletSeen?'The light has returned to the same ridge.':'A small light, high on Eilean Tighe.','You can ask Cate at the signal lamp. Its source is not visible.']});this.conversation(false);s.setBeat('rl-signal');}
			else{s.watcher.state='done';s.setBeat('rl-rest');}
		}finally{this.busy=false;s.save();}
	}
	conversation(report,saved=null){const s=this.s;this.state.report=report;s.watcher=new Watcher(returningScript(!!s.flags.isletSeen,this.state,report));s.watcher.familiar=true;s.watcher.onSent=(text,minutes)=>{s.h+=minutes/60;};s.watcher.appear();if(saved)s.watcher.load(saved);}
	restore(saved){if(['rl-signal','rl-report'].includes(this.s.beat))this.conversation(this.s.beat==='rl-report',saved);else this.s.watcher.load(saved);this.endShown=false;}
	async daylight(){if(this.busy||this.s.beat!=='rl-rest')return;this.busy=true;const s=this.s;try{
		await s.ui.fade('You wind the machine through the night. Daylight reaches the eastern glass.');s.h=153.3;s.lamp.extinguish();s.lamp.stop();s.lamp.wind=1;s.row(s.h,'Night watch maintained. Lamp extinguished at daylight.');
		const answer=await s.ui.choose({title:'The shore of Eilean Tighe',intro:'You can examine the island from the east headland above your landing. The channel remains beyond reach.',options:[{label:'Take the telescope to the headland',value:'go'},{label:'Stay with the station duties',value:'stay'}],cancel:null});
		this.state.investigate=answer==='go';s.setBeat(answer==='go'?'rl-view':'rl-return');
	}finally{this.busy=false;s.save();}}
	observe(){if(this.s.beat!=='rl-view')return;if(!this.state.ridge){const eye=this.s.app.camera.position,bearing=Math.round((Math.atan2(this.light.x-eye.x,-(this.light.z-eye.z))*180/Math.PI+360)%360);this.state.ridge={at:this.s.h,bearing};this.s.toast('The ridge is in view. Now look down over the channel for a vessel.',6000);}
		else{this.state.channel={at:this.s.h,vesselVisible:false};this.s.toast('No vessel visible in the channel during your observation. Return to the station.',6000);this.s.setBeat('rl-return');}this.s.save();}
	async returnToStation(){if(this.busy)return;this.busy=true;const s=this.s;try{await s.ui.fade('You attend to the station through the afternoon. The next evening light is due.');s.h=159.12;this.state.nextEvening=true;s.lamp.extinguish();s.lamp.stop();s.lamp.wind=.65;s.setBeat('rl-light');}finally{this.busy=false;s.save();}}
	async journal(){const s=this.s;if(s.beat!=='rl-journal')return s.ui.read({title:'The journal',body:['Finish the watch before writing the remarks.']});
		const remarks=(this.state.seen||this.state.ridge||this.state.channel)&&!s.watcher.flags.omitLight?[{key:'light',ask:'Record only the light and shore details you actually observed'}]:[];
		const chosen=await s.ui.journal({heading:'8th–9th January 1901',rows:s.rows.filter(r=>r[0]>=135).map(([h,t])=>[`${Math.floor(h%24)}.${String(Math.floor(h%1*60)).padStart(2,'0')}`,t]),remarks,footer:'W. Innes, Assistant Keeper'});
		if(chosen.light){if(this.state.seen)s.row(this.state.at,`Small light observed high on Eilean Tighe, bearing ${this.state.bearing}°, for about ${Math.max(1,Math.round(this.state.seenSeconds||3))} seconds in total. Light varied in brightness; source not established.`);if(this.state.ridge)s.row(this.state.ridge.at,`By daylight, examined the ridge of Eilean Tighe, bearing ${this.state.ridge.bearing}°, through the telescope. No light visible during this observation.`);if(this.state.channel)s.row(this.state.channel.at,'No vessel visible in the channel during the observation.');}
		this.state.recorded=!!chosen.light;s.setBeat('rl-complete');this.showEnd();}
	showEnd(){if(this.endShown)return;this.endShown=true;this.s.ui.end({heading:'The returning light',rows:this.s.rows.filter(r=>r[0]>=135).map(([h,t])=>[`${Math.floor(h%24)}.${String(Math.floor(h%1*60)).padStart(2,'0')}`,t]),lines:['The station remains your only shelter.','The light on Eilean Tighe has no name in the journal.','End of this chapter. The later storm and relief remain ahead.'],credits:'Seven Hunters. This investigation is original fiction. No crossing to Eilean Tighe is available.'});}
	guidance(){const s=this.s,p=s.app.player.position,b=s.beat;
		if(b==='rl-complete')return null;
		if(b==='rl-look'){if(p.y<TOWER.deck-.3||Math.hypot(p.x,p.z)<2.35)return routeGuidance(p,{at:TOWER.signal,label:'Balcony · look southeast',id:'rlBalcony'},'gallery');return{at:this.light,label:'Eilean Tighe · look southeast',id:'rlLight'};}
		if(b==='rl-view'){if(!this.nearViewpoint())return routeGuidance(p,{at:this.viewpoint.clone().add(new Vector3(0,1,0)),label:'East headland · stay above the landing',id:'rlViewpoint'},'yard');return{at:this.state.ridge?this.channel:this.light,label:this.state.ridge?'Watch the channel · telescope, hold E':'Examine the ridge · telescope, hold E',id:'rlStudy'};}
		const id=b==='rl-light'?'lens':b==='rl-wind'?'crank':b==='rl-signal'||b==='rl-report'?'signal':b==='rl-rest'?'rlBerth':'journal';const item=s.interact.get(id);if(!item)return null;const at=typeof item.at==='function'?item.at():item.at;
		return routeGuidance(p,{at,label:this.goal(),id},['lens','crank'].includes(id)?'lantern':id==='signal'?'gallery':'room');}
	update(dt){const s=this.s,b=s.beat,go=chapterFrame(s,dt,{communicate:['rl-signal','rl-report'].includes(b),blocked:this.busy,rate:1/600,cap:Math.floor(s.h/24)*24+(s.h%24<15?14:20)});Beams.uniforms.far.value[1].w=0;
		if(!go)return;
		if(b==='rl-look'){this.state.elapsed+=dt;const k=.75+.25*Math.sin(this.state.elapsed*1.7)**2;Beams.uniforms.far.value[1].set(this.light.x,this.light.y,this.light.z,160*k);if(this.looking(this.light)){this.state.seenSeconds+=dt;if(this.state.seenSeconds>=3)this.finishSighting(true);}}
		if(['rl-signal','rl-report'].includes(b)&&s.watcher.state==='done'&&!s.watcher.lost&&!s.signal)s.setBeat(b==='rl-signal'?'rl-rest':'rl-journal');
		if(b==='rl-return'&&s.app.player.position.distanceTo(new Vector3(-3,TOWER.floor,1))<5)this.returnToStation();
		if(b==='rl-complete')this.showEnd();
	}
}
