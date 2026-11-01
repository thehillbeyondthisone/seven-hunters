import { Vector3 } from '../engine/index.js';
import { TOWER, ROOM, STATION } from '../world/flannan/Station.js';
import { HAULING_SHED } from '../world/flannan/NextRooms.js';
import { Beams } from '../station/Beams.js';
import { Watcher, morse, UNIT } from './Watcher.js';
import { chapterFrame } from './WatchChapter.js';
import { routeGuidance } from './Guidance.js';
import { westRoute } from './StormReview.js';
import { clearTerrainSightline } from './ReturningLight.js';
import { PHOTO_SIGNAL, confessionScript, PREPARE_SIGNAL, farewellScript } from './LaterScript.js';

const DONE = 'lw-complete';
const HELD_ENDING_BEATS=new Set(['lw-relief-look','lw-handover','lw-farewell','lw-pack','lw-depart','lw-ashore',DONE]);
const WATCH_CAPS={camera:230,belongings:230,photos:230,'photo-signal':236,'photo-journal':236,fog:379,'fog-journal':379,confession:476,'confession-journal':476,workshop:614.5,repair:614.5,'repair-return':614.5,'prepare-signal':619,'relief-look':734,handover:734,farewell:734,pack:734,depart:734};
const FRAGMENT = morse('1 K');
// An occluded vessel lamp: the K never completes. There is no sentence behind it.
export const FRAGMENT_CUTOFF = FRAGMENT.symbols.find(e=>e.separator===' / ').start+2;
export class LaterWatch {
	constructor(s){this.s=s;this.busy=false;this.endShown=false;this.fragmentAt=new Vector3(1900,3,-1100);this.reliefAt=s.returningLight.viewpoint;}
	get active(){return this.s.beat.startsWith('lw-');}
	get state(){return this.s.flags.laterWatch||(this.s.flags.laterWatch={});}
	get legacyReview(){return !!this.state.legacyReview||['admission','relief'].includes(this.s.app.qs?.get('laterWatchPreview'));}
	// These are authoring boundaries, not invented events or dialogue for Walter.
	holdForStoryReview(reason='missing-middle'){
		const s=this.s,a=s.app;this.state.reviewBoundary=reason;
		this.state.reviewEnvironment={haze:a.haze?.density.value,clouds:a.clouds?.coverage.value,weather:a.seaWeather?.active?{preset:a.seaWeather.model?.preset,state:{...a.seaWeather.state}}:null};
		s.photography.raised=false;if(reason==='held-ending')s.arrival.group.visible=false;
		if(s.signal)s._leaveSignal();s.watcher.state='done';s.watcher.options=null;
		s.setBeat('lw-review');this.endShown=false;s.save();this.showReviewBoundary();
	}
	showReviewBoundary(){
		if(this.endShown)return;this.endShown=true;const s=this.s,scene13=this.state.reviewBoundary==='scene13';
		s.ui.end({heading:'Story review boundary',rows:[],
			lines:scene13?['Author review: scene thirteen’s reconnection dialogue is still undecided. The original confession remains available only in its legacy review.','This is the end of the current revised sequence. The next approved storm chapter can be reviewed separately.']:['Author review: the expanded storm sequence reaches the safe station return. Cate’s company-relief promise, its missed arrival, the missing middle and scene nineteen’s placement still need story decisions.','The original scenes twenty through twenty-two are retained on hold; this revised sequence does not advance into that ending.'],
			credits:'Review status — this panel is outside Walter’s story.',stayLabel:'Explore this watch',
			next:scene13?{label:'Review storm preparations',use:()=>{this.endShown=false;this.state.reviewBoundary=null;return this.beginPreparation();}}:this.state.reviewBoundary==='held-ending'&&this.state.legacySourceSnapshot?{label:'Review original held ending',use:()=>this.resumeLegacySource()}:null});
	}
	resumeLegacySource(){
		const source=this.state.legacySourceSnapshot;if(!source)return false;
		this.state.legacyReview=true;this.state.reviewBoundary=null;this.endShown=false;
		this.s.h=source.h;this.s.setBeat(source.beat);this.restore(source.watcher);this.s._applyClock();this.s.save();return true;
	}
	install(){const s=this.s,I=s.interact;
		const brownie=I.get('brownie'),oldWhen=brownie.when;brownie.when=()=>!this.active&&oldWhen();
		I.add({id:'brownieTake',at:()=>s.station.parts.unpacking?.desk||ROOM.letter,reach:2,size:.22,when:()=>s.beat==='lw-camera',text:()=>s.photography.state.taken?'Read Mary’s note · the photography watch':'Take the Brownie and Mary’s note',use:()=>s.photography.take()});
		I.add({id:'westBedrooms',at:()=>ROOM.westDoor,reach:2,size:.6,when:()=>this.active,text:()=>`${s.doors.bedrooms?.[0].target>.5?'Shut':'Open'} the west bedroom door`,use:()=>s._toggle('bedrooms')});
		I.add({id:'secondBedroom',at:()=>s.station.parts.keepsakes.secondDoor,reach:2,size:.5,when:()=>this.active,text:()=>`${s.doors.spareBedroom?.[0].target>.5?'Shut':'Open'} the second bedroom door`,use:()=>s._toggle('spareBedroom')});
		I.add({id:'belongings',at:()=>s.station.parts.keepsakes.belongings,reach:2,size:.5,when:()=>s.beat==='lw-belongings',text:'Look at the belongings left in the bedroom',use:()=>this.belongings()});
		I.add({id:'leaveFragment',at:TOWER.signal,reach:2,size:.4,when:()=>s.beat==='lw-fog',text:'Leave the uncertain flashes and keep the light',use:()=>this.finishFragment()});
		I.add({id:'workshopDoor',at:new Vector3(9.3,STATION.yard+1,-.58),reach:2,size:.5,when:()=>this.active,text:()=>`${s.doors.oilStore?.[0].target>.5?'Shut':'Open'} the workshop and oil-store door`,use:()=>s._toggle('oilStore')});
		I.add({id:'workshopTools',at:()=>s.station.parts.keepsakes.tools,reach:2,size:.5,hold:1.2,when:()=>s.beat==='lw-workshop',text:'Take the spanner and replacement chain pin',use:()=>this.takeTools()});
		I.add({id:'repairBrake',at:HAULING_SHED.brake,reach:2,size:.4,hold:4,when:()=>s.beat==='lw-repair',text:'Replace the worn pin in the upper brake retaining chain',use:()=>this.renewPin()});
		I.add({id:'handover',at:ROOM.journal,reach:2,size:.4,hold:1.5,when:()=>s.beat==='lw-handover'&&s.lamp.wind>=.95,text:'Hand over the station and signed journal',use:()=>{s.lamp.stop();this.state.handover={at:s.h,lamp:s.lamp.save(),journal:structuredClone(s.rows)};s.row(s.h,'Station handed over. Apparatus in order; west landing damage reported.');this.conversation('farewell');s.setBeat('lw-farewell');s.save();}});
		I.add({id:'packRoll',at:()=>s.station.parts.unpacking?.desk||ROOM.letter,reach:2,size:.3,hold:1.2,when:()=>s.beat==='lw-pack',text:'Pack the Brownie with its film still inside',use:()=>{this.state.packed=true;s.photography.raised=false;s.setBeat('lw-depart');s.save();}});
		I.add({id:'leaveIsland',at:()=>this.reliefAt.clone().add(new Vector3(0,1,0)),reach:3,size:.6,when:()=>s.beat==='lw-depart',text:'Go home with the relief crew',use:()=>this.ashore()});
		const journal=I.get('journal'),old=journal.use,oldText=journal.text,oldJournalWhen=journal.when;journal.when=()=>s.beat!=='lw-handover'&&oldJournalWhen();journal.use=()=>this.active?this.journal():old();journal.text=()=>this.active?s.beat==='lw-review'?'Reopen the story review boundary':s.beat==='lw-photos'?'Finish the photography watch':s.beat.endsWith('journal')?'Write up the journal':'Look at the journal':typeof oldText==='function'?oldText():oldText;
	}
	takeTools(){const s=this.s;if(s.beat!=='lw-workshop')return false;this.state.tools=true;s.toast('Spanner and replacement pin taken. The upper brake is reached by the safe tramway.',6000);s.setBeat('lw-repair');s.save();return true;}
	renewPin(){const s=this.s;if(s.beat!=='lw-repair')return false;this.state.repaired=true;s.flags.nextWatch||={};s.flags.nextWatch.chainSecured=s.h;s.row(s.h,'Worn retaining-chain pin renewed at the upper hauling brake.');s.toast('The new pin is seated. The retaining chain holds the brake. I can return by the upper tramway.',6500);s.setBeat('lw-repair-return');s.save();return true;}
	async transition(h,beat,title,lines){if(this.busy)return;this.busy=true;const s=this.s;try{
		await s.ui.card(lines,{kicker:'Selected watches · Eilean Mòr',title});s.h=h;s.watcher=new Watcher();s.watcher.state='done';s.setBeat(beat);s._applyClock();s.save();
	}finally{this.busy=false;}}
	async begin(preview=''){
		const s=this.s;s.app.player.carryingHeavy=false;this.state.packed=false;this.state.ashore=false;this.state.ending=false;this.state.relief=false;this.state.reliefSeen=0;s.ui.root?.classList.remove('is-ashore');this.state.legacyReview=['admission','relief'].includes(preview);this.state.reviewBoundary=null;this.endShown=false;s.photography.raised=false;s.flags.landed=true;s.arrival.group.visible=false;s.paused=false;s.hasTelescope=true;s.moving.telescope.visible=false;s.hand.carried=true;s.hand.lit=false;
		if(preview){s.app.player.position.set(-1,TOWER.floor,4);s.app.player.velocity.set(0,0,0);s.app.player.grounded=true;s.app.player.mode='walk';s.app.player._camY=null;}
		s.flags.unpacking={...s.flags.unpacking,stage:4,examined:true};s.unpacking.sync();s.lamp.extinguish();s.lamp.stop();s.lamp.wind=1;
		if(preview==='relief'){s.flags.storm={connected:true,routeDestroyed:true};s.storm.damage.set(true);return this.beginRelief({legacy:true});}
		if(preview==='preparation')return this.beginPreparation();
		if(preview==='admission'){await this.transition(472.5,'lw-confession','Tuesday 22nd January',['A clear watch after several days of fog. Cate has returned to her lamp.']);s.lamp.ignite();s.lamp.start();this.conversation('confession');return;}
		if(preview==='fog')return this.beginFog();
		await this.transition(228,'lw-camera','Saturday 12th January',['The days acquire a shape: glass, oil, machine, slate. The relief is still a long way off.','Mary asked for the place where you sit. Her note is beside the journal; there may still be pictures on the roll.']);
		s.app.cameraCut?.();
	}
	async belongings(){if(this.busy)return;this.busy=true;const s=this.s;try{await s.ui.read({title:'The things a man leaves in a room',body:['Boots have been brushed and set together below the bed. A folded shirt. A book with a strip of paper marking a place.','Other men will sleep here on other watches. For now the rooms are empty. You leave the drawer shut.','Your own things are becoming ordinary here too. Mary wants a picture of that.'],provenance:'These rooms and belongings are authored reconstruction, not recovered evidence about the missing December keepers.'});this.state.belongings=true;s.photography.raised=false;s.setBeat('lw-photos');s.toast(s.app.isMobile?'Tools — Brownie to raise the camera. Mary’s chair is my first picture.':'C raises the Brownie. Mary’s chair is my first picture.',6500);s.save();}finally{this.busy=false;}}
	async finishPictures(){if(this.busy||this.s.beat!=='lw-photos')return;this.busy=true;const s=this.s;try{
		if(s.photography.tutorialPending){
			await s.ui.read({title:'Mary’s first picture',body:[s.photography.state.frames.length>=6?'The existing roll is already full. I can rehearse the chair exposure at the table without opening the camera or replacing any photographs.':'Mary asked for the chair beside my journal. I will take that picture first, with the Brownie steadied at the table in daylight.',s.app.isMobile?'Tools — Brownie raises the camera. Follow the named actions; release between each one.':'C raises the Brownie. Follow the named E actions; release E between each one.']});return;
		}
		if(s.photography.missing&&s.photography.state.frames.length<6){const answer=await s.ui.choose({title:'The pictures can wait',intro:'There is still daylight for the marked views. You can also put the camera away and attend to the next watch.',options:[{label:'Keep taking pictures',value:'pictures'},{label:'Put the camera away and continue duties',value:'duties'}],cancel:null});if(answer!=='duties')return;this.state.photographyDeclined=true;}
		s.photography.raised=false;await s.ui.fade('The daylight watch passes. You prepare the light for evening.');s.h=232.5;s.lamp.ignite();s.lamp.start();s.lamp.wind=1;this.conversation('photos');s.setBeat('lw-photo-signal');s.save();
	}finally{this.busy=false;}}
	conversation(kind,saved=null){const s=this.s;if(kind==='confession'&&!this.legacyReview)return this.holdForStoryReview('scene13');this.state.conversation=kind;
		const script=kind==='photos'?PHOTO_SIGNAL:kind==='confession'?confessionScript(!!this.state.fragment?.marks):kind==='prepare'?PREPARE_SIGNAL:farewellScript(this.state.response);
		s.watcher=new Watcher(script);s.watcher.familiar=true;s.watcher.onSent=(text,minutes)=>{s.h+=minutes/60;};s.watcher.appear();s.watcher.call();if(saved)s.watcher.load(saved);
	}
	async beginFog(){await this.transition(376.7,'lw-fog','Friday 18th January',['The fog has held for days. There is no promise of a landing.','In a gap to the northeast, a few flashes begin like the familiar group. Use the telescope, or leave them and keep the light.']);this.s.lamp.ignite();this.s.lamp.start();this.s.lamp.wind=1;this.state.fragment={elapsed:0,read:0,marks:'',letters:'',finished:false};this.s.save();}
	finishFragment(){if(this.s.beat!=='lw-fog')return;const s=this.s,f=this.state.fragment;f.finished=true;Beams.uniforms.far.value[1].w=0;s.ui.strip(null);s.toast(f.marks?'The flashes stop. No complete message was received.':'No message received. The main light still needs its keeper.',6000);s.setBeat('lw-fog-journal');s.save();}
	fragment(dt){const s=this.s,f=this.state.fragment;
		const watched=s.tel>.6&&new Vector3(0,0,-1).applyQuaternion(s.app.camera.quaternion).dot(this.fragmentAt.clone().sub(s.app.camera.position).normalize())>.998&&clearTerrainSightline(s.app.terrainData,s.app.camera.position,this.fragmentAt);
		if(!f.started){if(watched){f.started=true;f.at=s.h;}else{Beams.uniforms.far.value[1].set(this.fragmentAt.x,this.fragmentAt.y,this.fragmentAt.z,6500);return;}}
		f.elapsed+=dt;
		// This is a one-time transmission, not a repeating decoded message. Looking away loses marks.
		const t=f.elapsed/UNIT,previous=(f.elapsed-dt)/UNIT;
		if(watched){const received=FRAGMENT.symbols.filter(e=>e.end>previous&&e.end<=Math.min(t,FRAGMENT_CUTOFF));for(const e of received)f.marks+=e.separator+e.mark;f.read+=received.length;}
		const on=t<FRAGMENT_CUTOFF&&FRAGMENT.on.some(([a,b])=>t>=a&&t<b);Beams.uniforms.far.value[1].set(this.fragmentAt.x,this.fragmentAt.y,this.fragmentAt.z,on?15000:0);
		if(watched)s.ui.strip({from:'Flashes in the fog · source unknown',text:'',morse:f.marks,hint:'An unfinished group. No complete message.'});
		if(t>=FRAGMENT_CUTOFF&&f.elapsed>6)this.finishFragment();
	}
	async beginPreparation(){const s=this.s;await this.transition(609.5,'lw-workshop','Monday 28th January',['The forecast brings a new urgency to the same small jobs. Relief cannot approach in this sea.','The upper brake’s retaining chain is secure, but its pin is worn. Open the workshop beside the oil store, take the spare pin, and renew it before the gale.','The lower west steps are unsafe. Use the upper tramway and shed.']);s.hand.carried=s.hand.lit=true;s.lamp.extinguish();s.lamp.stop();s.lamp.wind=1;s.app.seaWeather?.select('fresh');s.save();}
	async beginStorm(){if(this.busy)return;this.busy=true;try{await this.s.storm.begin(false,{connected:true});}finally{this.busy=false;}}
	async beginRelief({legacy=false}={}){if(!legacy&&!this.legacyReview)return this.holdForStoryReview('held-ending');this.state.legacyReview=true;const s=this.s;await this.transition(729.5,'lw-relief-look','Saturday 2nd February',['The gale passes. Four days later a landing becomes possible on the eastern side.','The relief boat is below the east headland. Look from safe ground; the damaged west route remains closed.']);s.lamp.extinguish();s.lamp.stop();s.lamp.wind=.65;s.app.seaWeather?.reset();s.app.seaDread?.setEnabled(false);this.state.relief=true;this.showReliefBoat();s.save();}
	showReliefBoat(){const a=this.s.arrival;a.elapsed=90;a.departure=null;a.group.visible=true;a.heave=.85;a.pose(0);}
	restore(saved){this.endShown=false;this.s.photography.restore();
		if(!this.legacyReview&&(['lw-confession','lw-confession-journal'].includes(this.s.beat)||HELD_ENDING_BEATS.has(this.s.beat))){
			this.state.legacySourceSnapshot={beat:this.s.beat,h:this.s.h,watcher:saved};this.holdForStoryReview(HELD_ENDING_BEATS.has(this.s.beat)?'held-ending':'scene13');return;
		}this.s.ui.root?.classList.toggle('is-ashore',!!this.state.ashore);if(['lw-photo-signal','lw-confession','lw-prepare-signal','lw-farewell'].includes(this.s.beat))this.conversation(this.state.conversation,saved);else this.s.watcher.load(saved);
		this.s.storm.damage.set(!!this.s.flags.storm?.routeDestroyed);if(this.s.beat.startsWith('lw-relief')||['lw-handover','lw-farewell','lw-pack','lw-depart'].includes(this.s.beat))this.showReliefBoat();
		if(this.s.beat==='lw-review'&&this.state.reviewEnvironment?.weather){const weather=this.s.app.seaWeather;weather?.select(this.state.reviewEnvironment.weather.preset);if(weather?.model?.state)Object.assign(weather.model.state,this.state.reviewEnvironment.weather.state);}
		else if(['lw-workshop','lw-repair','lw-repair-return','lw-prepare-signal'].includes(this.s.beat))this.s.app.seaWeather?.select('fresh');else this.s.app.seaWeather?.reset();
	}
	goal(){const b=this.s.beat;return {
		'lw-camera':this.s.photography.state.taken?'Read Mary’s note beside the journal.':'Take Mary’s Brownie from the desk.','lw-belongings':'Open the west bedrooms and look at the ordinary belongings in the second room.',
		'lw-photos':this.s.photography.tutorialPending?(!this.s.photography.raised?(this.s.app.isMobile?'Raise the Brownie from Tools for Mary’s first picture.':'Press C to raise the Brownie for Mary’s first picture.'):this.s.photography.tutorialHint):this.s.photography.state.frames.length>=6?'The roll is full. Return to the journal to finish this watch.':!this.s.photography.state.wound?'Wind the Brownie film before the next exposure.':this.s.photography.missing?{chair:'Photograph your chair for Mary. Hold steady in daylight.',apparatus:'Photograph the lighthouse apparatus. Hold steady in daylight.',landing:'Photograph the west landing from the safe upper lookout.'}[this.s.photography.missing.id]:'Return to the journal to finish this watch, or use the remaining frames.',
		'lw-photo-signal':'The lamp is ready. Answer Cate at the balcony signal lamp.','lw-photo-journal':'Write up the watch at the desk.',
		'lw-fog':'Look northeast through the telescope for the uncertain flashes, or leave them at the signal lamp.',
		'lw-fog-journal':'Record only the flashes you received. Return to the journal.','lw-confession':'Cate is back. Answer her at the balcony signal lamp.',
		'lw-confession-journal':'Write up the clear watch and choose what to disclose in the journal.',
		'lw-workshop':'Open the workshop by the oil store. Take the spanner and spare chain pin.',
		'lw-repair':'Renew the worn chain pin at the upper hauling shed. Keep above the lower steps.',
		'lw-repair-return':'Return by the upper tramway. Cate has news of the coming weather.',
		'lw-prepare-signal':'Answer Cate at the signal lamp before the storm preparations.',
		'lw-relief-look':'Look down at the relief boat from the safe east headland.',
		'lw-handover':this.s.lamp.wind<.95?'Wind the apparatus fully for the incoming keeper.':'Return to the desk. Hand over the apparatus and your signed journal.',
		'lw-farewell':'Before leaving, say goodbye to Cate at the signal lamp.','lw-pack':'Pack the Brownie at the desk. Leave its back shut.',
		'lw-depart':'Meet the relief crew at the east headland. Go home.','lw-ashore':'The film has gone to the shop. Collect your prints and write to Mary.',
		'lw-review':'The revised story is paused at its author review boundary. Explore this watch.',
		[DONE]:'',
	}[b]||'';}
	lensText(){return !this.s.lamp.lit&&this.s.beat.includes('signal')?'Relight the main lamp':'';}
	useLens(){this.s.lamp.ignite();this.s.lamp.start();this.s.sound?.ignite();}
	onWind(){}
	watchText(){return '';}
	keepWatch(){}
	guidance(){const s=this.s,p=s.app.player.position,b=s.beat,k=s.station.parts.keepsakes;
		if(b==='lw-photos')return s.photography.guidance();
		if(b==='lw-fog')return routeGuidance(p,{at:p.y<TOWER.deck-.3?TOWER.signal:this.fragmentAt,label:'Northeast · flashes in the fog',id:'fogFragment'},'gallery');
		if(b==='lw-belongings'){if(p.x>-9.5)return routeGuidance(p,{at:ROOM.westDoor,label:'West bedrooms · E',id:'westBedrooms'},'room');return{at:p.x>-15?k.secondDoor:k.belongings,label:p.x>-15?'Second bedroom · E':'Belongings · E',id:p.x>-15?'secondBedroom':'belongings'};}
		if(p.x<-9.5&&p.x>-21.4&&p.z>ROOM.z0&&p.z<ROOM.z1&&Math.abs(p.y-TOWER.floor)<1)return{at:p.x<-15?k.secondDoor:ROOM.westDoor,label:'Return to the keepers’ room · E',id:p.x<-15?'secondBedroom':'westBedrooms'};
		if(b==='lw-repair')return upperShedRoute(s);
		if(b==='lw-repair-return'){
			if(p.x<-157.3&&p.x>-162.7&&p.z>37.8&&p.z<43.5)return{at:new Vector3(-160,HAULING_SHED.floor+1,44),label:'Leave the upper shed',id:'repairShedExit'};
			if(p.x<-157.3&&p.x>-164&&p.z>=43.5&&p.z<46)return{at:new Vector3(-157,HAULING_SHED.floor+1,44),label:'Upper tramway',id:'repairShedOutside'};
			return westRoute(s,new Vector3(-3,TOWER.floor,1),'Return to the station',true);
		}
		if(['lw-relief-look','lw-depart'].includes(b))return routeGuidance(p,{at:this.reliefAt.clone().add(new Vector3(0,1,0)),label:b==='lw-depart'?'Relief crew · go home':'East headland · look at the relief boat',id:'reliefView'},'yard');
		if(b==='lw-workshop'&&p.z>-.85&&p.x<7.25&&!(p.x>ROOM.x0&&p.x<ROOM.x1&&p.z>ROOM.z0&&p.z<ROOM.z1)&&p.y<TOWER.floor+.65){const at=p.x<4?new Vector3(4.5,TOWER.floor+1,4.6):new Vector3(9.3,TOWER.floor+1,2);return{at,label:'Workshop entrance',id:'workshopApproach'};}
		let id=b==='lw-workshop'?(p.z>-.9?'workshopDoor':'workshopTools'):b==='lw-handover'?(s.lamp.wind<.95?'crank':'handover'):b==='lw-camera'?'brownieTake':b==='lw-pack'?'packRoll':b.includes('signal')||b==='lw-confession'||b==='lw-farewell'||b==='lw-repair-return'?'signal':b.endsWith('journal')?'journal':null;
		if(!id)return null;const it=s.interact.get(id),at=typeof it.at==='function'?it.at():it.at;
		return routeGuidance(p,{at,label:this.goal(),id},id==='crank'?'lantern':id==='signal'?'gallery':b==='lw-workshop'?'yard':'room');
	}
	async journal(){const s=this.s,b=s.beat;if(b==='lw-review'){this.endShown=false;this.showReviewBoundary();return;}if(b==='lw-photos')return this.finishPictures();if(!b.endsWith('journal'))return s.ui.read({title:'The journal',body:['Complete the present duty before signing the watch.']});if(this.busy)return;this.busy=true;
		try{const f=this.state.fragment,remarks=b==='lw-fog-journal'&&f?.marks?[{key:'fragment',ask:`Record ${f.marks} [tail missing]. No whole message; source unknown.`}]:b==='lw-confession-journal'?[{key:'disclose',ask:'Record Cate’s admission that her December reassurance was unconfirmed'}]:[];
			const chosen=await s.ui.journal({heading:s.dayText(),rows:s.rows.filter(([h])=>Math.floor(h/24)===Math.floor(s.h/24)).map(([h,t])=>[`${Math.floor(h%24)}.${String(Math.floor(h%1*60)).padStart(2,'0')}`,t]),remarks,footer:'W. Innes, Assistant Keeper'});
			if(b==='lw-fog-journal'&&chosen.fragment&&f?.marks)s.row(f.at??s.h,`Uncertain flashes received: ${f.marks} [tail missing]. No whole message; source unknown.`);
			if(b==='lw-confession-journal'&&chosen.disclose)s.row(s.h,'Cate stated that she reported reassurance in December when weather prevented observation. Consequences cannot be established.');
			if(b==='lw-photo-journal')s.row(s.h,`${s.photography.state.frames.length} Brownie exposures made. Film remains undeveloped.`);
			this.state[b]=chosen;s.save();
		}finally{this.busy=false;}
		if(b==='lw-photo-journal')await this.beginFog();
		else if(b==='lw-fog-journal'){if(!this.legacyReview){this.holdForStoryReview('scene13');return;}await this.transition(472.5,'lw-confession','Tuesday 22nd January',['The intervening watches pass behind fog. A clear evening opens the distance again.','Cate is at the lamp. Ask whether she sent those flashes.']);s.lamp.ignite();s.lamp.start();s.lamp.wind=1;this.conversation('confession');s.save();}
		else await this.beginPreparation();
	}
	async ashore(){if(this.busy)return;this.busy=true;const s=this.s;try{
		await s.ui.fade('The relief crew takes you down the sound eastern landing. You leave the island with your bag and the unopened camera.');
		this.state.ashore=true;s.ui.root?.classList.add('is-ashore');s.setBeat('lw-ashore');s.arrival.group.visible=false;s.save();
		await this.finishAshore();
	}finally{this.busy=false;}}
	async finishAshore(){const s=this.s;if(this.state.ending)return this.showEnd();
		await s.ui.album({title:'Lewis · a few days later',frames:s.photography.state.frames,intro:'The shop has developed the roll. Here are the views you actually exposed. The machinery, the chair, the small foothold above the sea.'});
		const detail=await s.ui.choose({title:'A letter to Mary',intro:'Give her an ordinary piece of your life there.',options:[{label:'The chair by the journal',value:'chair'},{label:'Tea in the kitchen',value:'tea'},{label:'The blue stockings',value:'stockings'}],cancel:null});
		this.state.letter=detail;const line=detail==='tea'?'I learned how long the kettle takes on that range. I should like tea from our own kettle now.':detail==='stockings'?'The blue stockings held at the heels. You were right to put them in.':'My chair was by the journal. After a week I stopped thinking of it as somebody else’s chair.';
		await s.ui.read({title:'Dear Mary',body:['I am safely ashore. The station is in the next keeper’s hands. The west landing took a terrible sea; we kept the light going.',line,s.photography.state.frames.length?'The pictures are back from the shop. I shall bring them home with me.':'I brought the camera home. I have more to tell you than I put on the film.','I want to sit with you and hear the ordinary news.','Your Walter']});
		this.state.ending=true;s.setBeat(DONE);s.save();this.showEnd();
	}
	showEnd(){if(this.endShown)return;this.endShown=true;const s=this.s;s.ui.end({heading:'Someone comes',rows:s.rows.slice(-12).map(([h,t])=>[s.dayText(h),t]),lines:['Walter Innes is safely ashore. The station has another keeper.','Cate reported what she could see, and what she could not.',this.state.farewell==='warm'?'You have promised to write to her.':'You parted with plain words, and a wish for safe passage.','There are ordinary things to take home.'],credits:'Seven Hunters · End of the story. Walter, Cate and these events are fiction; the historical December disappearance remains unexplained.',stayLabel:'Explore the island'});}
	update(dt){const s=this.s,b=s.beat,communicate=['lw-photo-signal','lw-confession','lw-prepare-signal','lw-farewell'].includes(b);
		if(s.moving.unpacking?.brownieOnDesk)s.moving.unpacking.brownieOnDesk.visible=!this.state.packed&&(!s.photography.state.taken||b==='lw-pack');
		const go=chapterFrame(s,dt,{communicate,blocked:this.busy||s.photography.capturing,visibility:b==='lw-fog'?8:60,clouds:b==='lw-fog'?.82:.64,rate:1/1200,cap:b==='lw-review'?s.h:WATCH_CAPS[b.slice(3)]??s.h});
		if(b==='lw-review'&&this.state.reviewEnvironment){const held=this.state.reviewEnvironment;if(s.app.haze&&Number.isFinite(held.haze))s.app.haze.density.value=held.haze;if(s.app.clouds?.coverage&&Number.isFinite(held.clouds))s.app.clouds.coverage.value=held.clouds;}
		Beams.uniforms.far.value[1].w=0;if(!go)return;
		if(b==='lw-review'){this.showReviewBoundary();return;}
		if(b==='lw-prepare-signal'&&!this.state.reliefDelayKnown&&s.watcher.log.some(entry=>entry.from==='her'&&entry.text==='RELIEF DELAYED. HEAVY WEATHER COMING.')){
			this.state.reliefDelayKnown=true;s.audioCues?.play('relief-delay');s.app.seaDread?.setEnabled(true);s.save();
		}
		if(b==='lw-fog')this.fragment(dt);
		if(b==='lw-repair-return'&&s.app.player.position.distanceTo(new Vector3(-3,TOWER.floor,1))<5){s.h=615.5;s.lamp.ignite();s.lamp.start();s.lamp.wind=1;this.conversation('prepare');s.setBeat('lw-prepare-signal');}
		if(communicate&&s.watcher.state==='done'&&!s.watcher.lost&&!s.signal){
			if(b==='lw-photo-signal'){this.state.warm=!!s.watcher.flags.warm;s.setBeat('lw-photo-journal');}
			if(b==='lw-confession'){this.state.response=s.watcher.flags.angry?'angry':s.watcher.flags.kind?'kind':'guarded';s.setBeat('lw-confession-journal');}
			if(b==='lw-prepare-signal')this.beginStorm();
			if(b==='lw-farewell'){this.state.farewell=s.watcher.flags.warm?'warm':'reserved';s.setBeat('lw-pack');}
		}
		if(this.legacyReview&&this.state.relief&&!this.state.ashore&&['lw-relief-look','lw-handover','lw-farewell','lw-pack','lw-depart'].includes(b)){this.showReliefBoat();if(b==='lw-relief-look'&&s.app.player.position.distanceTo(this.reliefAt)<5&&new Vector3(0,0,-1).applyQuaternion(s.app.camera.quaternion).dot(s.arrival.group.position.clone().sub(s.app.camera.position).normalize())>.9){this.state.reliefSeen=(this.state.reliefSeen||0)+dt;if(this.state.reliefSeen>2){s.toast('The landing boat is here. Return to the desk and hand over the station.',6500);s.setBeat('lw-handover');}}}
		if(b==='lw-ashore'&&!this.busy){this.busy=true;this.finishAshore().finally(()=>{this.busy=false;});}
		if(b===DONE)this.showEnd();
	}
}

export function upperShedRoute(s){
	const p=s.app.player.position,F=HAULING_SHED.floor;
	if(p.x>-20)return westRoute(s,HAULING_SHED.brake,'Upper hauling shed');
	if(p.x>-148){const next=s.station.tracks.west.slice().reverse().find(q=>q[0]<p.x-8&&q[0]>=-160);if(next)return{at:new Vector3(next[0],s.app.terrainData.heightAt(...next)+1,next[1]),label:'Upper tramway · hauling shed',id:'repairTramway'};}
	if(p.z<37.8&&p.x<-157.2)return{at:new Vector3(-157,F+1,35),label:'Upper shed · east side',id:'repairShedSide'};
	if(p.x>-157.3&&p.z<43.5)return{at:new Vector3(-157,F+1,44),label:'Upper hauling shed entrance',id:'repairShedApproach'};
	if(p.z>43.5)return{at:new Vector3(-160,F+1,Math.abs(p.x+160)>.6?44:40.8),label:'Upper hauling shed entrance',id:'repairShedEntrance'};
	return{at:HAULING_SHED.brake,label:'Upper brake · hold to renew pin',id:'repairBrake'};
}
