import { Vector3 } from '../engine/index.js';
import { GPU } from '../engine/gpu/GPU.js';
import { readTexture } from '../engine/gpu/Readback.js';
import { TOWER, ROOM } from '../world/flannan/Station.js';
import { routeGuidance } from './Guidance.js';
import { westRoute } from './StormReview.js';
import { SUNRISE, SUNSET } from './Script.js';

export const ROLL_FRAMES = 6;
export const PRINT_SIZE = 384;
// This is a comfortable input duration, not a claim about a 1900 film exposure.
export const CHAIR_EXPOSURE_HOLD = 2.4;
export function photographPixels(data,width,height,bgra=false){
	const side=Math.min(width,height),left=Math.floor((width-side)/2),top=Math.floor((height-side)/2),out=new Uint8ClampedArray(PRINT_SIZE*PRINT_SIZE*4);
	for(let y=0;y<PRINT_SIZE;y++)for(let x=0;x<PRINT_SIZE;x++){
		const i=((top+Math.floor(y*side/PRINT_SIZE))*width+left+Math.floor(x*side/PRINT_SIZE))*4,j=(y*PRINT_SIZE+x)*4;
		const light=.2126*data[i+(bgra?2:0)]+.7152*data[i+1]+.0722*data[i+(bgra?0:2)];
		const edge=Math.min(1,1.12-.16*((x/PRINT_SIZE-.5)**2+(y/PRINT_SIZE-.5)**2)),v=Math.max(0,Math.min(255,light*edge));
		out[j]=v;out[j+1]=v*.97;out[j+2]=v*.91;out[j+3]=255;
	}return out;
}
// The negatives are actual scene pixels. Only these small, bounded prints enter a save.
export class Photography {
	constructor(s){this.s=s;this.pending=null;this.capturing=false;this.generation=0;this.releaseRequired=false;this.raised=false;this.captureView=null;this.renderReturn=null;this.captureSnap=null;}
	ready(){if(!this.s.app.input.down('KeyE'))this.releaseRequired=false;return!this.releaseRequired;}
	get state(){return this.s.flags.photography||(this.s.flags.photography={frames:[],wound:true});}
	get tutorialComplete(){return !!this.state.tutorial?.complete||this.state.frames.some(frame=>frame.subject==='chair');}
	get tutorialPending(){return !this.tutorialComplete;}
	get tutorial(){return this.state.tutorial||(this.state.tutorial={});}
	get tutorialWatch(){return this.s.beat==='lw-photos';}
	get atChairTable(){const p=this.s.app.player.position;return p.x>ROOM.x0&&p.x<ROOM.x1&&p.z>ROOM.z0&&p.z<ROOM.z1&&Math.abs(p.y-TOWER.floor)<.5&&p.distanceTo(this.sites[0].stand)<.85;}
	get chairReady(){return this.tutorialWatch&&this.atChairTable&&this.looking(this.sites[0]);}
	get canExpose(){return !this.tutorialPending||this.tutorialWatch&&this.chairReady&&this.tutorial.braced;}
	get tutorialHint(){
		if(!this.daylight)return 'Too dark for the Brownie — wait for daylight';
		if(!this.tutorialWatch)return "Mary asked for my chair. I will make that first picture during the daylight photography watch.";
		if(!this.atChairTable)return "Stand by the table to steady the Brownie for Mary's chair";
		if(!this.looking(this.sites[0]))return "Frame the chair beside my journal";
		if(!this.tutorial.braced)return 'Steady the Brownie at the table';
		if(this.state.frames.length>=ROLL_FRAMES)return 'The existing roll is full — rehearse the shutter without exposing more film';
		return "Hold steady for Mary's picture, then release the action";
	}
	get daylight(){const hour=((this.s.h%24)+24)%24;return hour>=SUNRISE&&hour<=SUNSET;}
	get carryBlock(){
		const s=this.s,a=s.app,domestic=s.next?.active?s.next.domestic:null;
		if(domestic?.carryingTool)return domestic.carrying?'Finish with the kettle and set it down before raising the Brownie.':'Finish the kitchen action before raising the Brownie.';
		if(s.storm?.active&&s.flags.storm?.oilTaken&&!s.flags.storm.oilStowed)return 'Set the capped oil supply on its shelf before raising the Brownie.';
		if(a.player.carryingHeavy)return 'Set down the supply before raising the Brownie.';
		const action=s.interact.current;
		if(action?.hold>0&&a.input.down('KeyE')&&!action.id?.startsWith('photo-')&&action.id!=='filmWind')return 'Finish the action and put the working tool down before raising the Brownie.';
		return '';
	}
	get available(){const s=this.s,a=s.app;return !!this.state.taken&&!this.carryBlock&&!s.later?.state.packed&&!s.later?.state.ashore&&!s.aboard&&!s.signal&&!s.paused&&!s.ui.open&&!a.mobile?.paused&&!a.devMenu?.open&&!a.freeCam&&!a.ui?.ui?.photoMode&&!s.keeper?.cinematic&&!s.cutsceneReview?.active&&!a.player.busy&&!s.towerTravel?.active&&!s.islandReveal?.active&&!s.morning?.enabled&&!s.lampStudy?.active&&!globalThis.document?.hidden;}
	get equipped(){return this.raised&&this.available;}
	toggle(){
		// Putting the camera away remains available even when another state has
		// become busy or a legacy save restored a carried tool alongside it.
		if(this.raised){this.raised=false;this.s.interact.held=0;this.releaseRequired=this.s.app.input.down('KeyE');this.s.toast('Brownie put away.');return true;}
		const blocked=this.carryBlock;if(blocked){this.s.toast(blocked,5500);return false;}
		if(!this.available||this.capturing)return false;
		this.raised=true;this.s.interact.held=0;this.releaseRequired=this.s.app.input.down('KeyE');
		if(this.raised){this.s.app.input.touchScope=false;this.s.toast(this.tutorialPending?this.tutorialHint:this.s.app.isMobile?'Brownie raised. Hold the exposure action; Tools · Brownie puts it away.':'Brownie raised. Hold E to expose; C puts it away.',5500);}
		return true;
	}
	update(){
		if(this.s.app.input.hit('KeyC'))this.toggle();
		if(this.raised&&this.s.app.input.rightDown)this.raised=false;
	}
	get cameraDetail(){if(this.tutorialPending)return this.tutorialHint;return this.s.app.isMobile?'Tools · Brownie to put away · film develops ashore':'C · put away · film develops ashore';}
	viewTarget(){return this.s.app.camera.position.clone().addScaledVector(new Vector3(0,0,-1).applyQuaternion(this.s.app.camera.quaternion),.8);}
	get aimedSite(){return this.sites.find(site=>this.near(site)&&this.looking(site));}
	get sites(){const s=this.s;return [
		{id:'chair',label:'Mary’s picture · your chair',at:new Vector3(-6.5,TOWER.floor+.65,ROOM.z0+1),stand:new Vector3(-4.25,TOWER.floor,3.5),zone:'room'},
		{id:'apparatus',label:'The machinery of the light',at:new Vector3(0,TOWER.focal||TOWER.deck+1.8,0),stand:new Vector3(Math.cos(TOWER.crankAngle+1)*1.8,TOWER.deck,Math.sin(TOWER.crankAngle+1)*1.8),zone:'lantern'},
		{id:'landing',label:'The vulnerable west landing',at:s.storm.serviceLight,stand:s.storm.lookout,zone:'yard'},
	];}
	get missing(){return this.sites.find(site=>!this.state.frames.some(frame=>frame.subject===site.id));}
	near(site){return this.s.app.player.position.distanceTo(site.stand)<3.5;}
	looking(site){const c=this.s.app.camera;return new Vector3(0,0,-1).applyQuaternion(c.quaternion).dot(site.at.clone().sub(c.position).normalize())>.9;}
	install(){const s=this.s,I=s.interact;
		const target={at:()=>this.viewTarget(),reach:2,size:.4,distanceWeight:-1,detail:()=>this.cameraDetail};
		I.add({...target,id:'filmWind',hold:1.2,
			when:()=>this.equipped&&!this.state.wound&&!this.capturing&&this.state.frames.length<ROLL_FRAMES&&this.ready(),text:'Wind the Brownie film to the next number',use:()=>{if(!this.ready())return;this.state.wound=true;this.releaseRequired=true;s.toast(`Frame ${this.state.frames.length+1} ready. Keep the back shut.`);s.save();}});
		I.add({...target,id:'photo-brace',hold:.8,
			when:()=>this.equipped&&this.tutorialPending&&this.chairReady&&this.daylight&&!this.tutorial.braced&&!this.capturing&&this.ready(),
			text:'Steady the Brownie at the table for Mary’s picture',use:()=>{if(!this.chairReady||!this.ready())return;this.tutorial.braced=true;this.releaseRequired=true;s.toast('The camera is steady. Release the action, then hold it to make the chair exposure.',6500);s.save();}});
		I.add({...target,id:'photo-rehearse',hold:CHAIR_EXPOSURE_HOLD,
			when:()=>this.equipped&&this.tutorialPending&&this.chairReady&&this.tutorial.braced&&this.state.frames.length>=ROLL_FRAMES&&!this.capturing&&this.ready(),
			text:'Rehearse the steady shutter action — the existing roll stays shut',use:()=>{if(!this.chairReady||!this.ready())return;this.tutorial.complete=true;this.tutorial.legacyFullRoll=true;this.releaseRequired=true;s.toast('Shutter practice complete. The six existing exposures are unchanged; keep the camera back shut.',7000);s.save();}});
		for(const site of this.sites)I.add({...target,id:`photo-${site.id}`,hold:site.id==='chair'?CHAIR_EXPOSURE_HOLD:.7,
			when:()=>this.equipped&&this.daylight&&this.canExpose&&(!this.tutorialPending||site.id==='chair')&&this.state.wound&&this.state.frames.length<ROLL_FRAMES&&!this.capturing&&this.ready()&&this.near(site)&&this.looking(site),
			text:()=>`Expose frame ${this.state.frames.length+1} of ${ROLL_FRAMES} · ${site.label}`,use:()=>this.expose(site)});
		I.add({...target,id:'photo-view',hold:.7,
			when:()=>this.equipped&&this.daylight&&!this.tutorialPending&&this.state.wound&&this.state.frames.length<ROLL_FRAMES&&!this.capturing&&this.ready(),
			text:()=>`Expose frame ${this.state.frames.length+1} of ${ROLL_FRAMES} · your view`,use:()=>this.expose(this.aimedSite)});
		// Keep E on the held camera while waiting, in darkness or with a full roll.
		// Otherwise the same key could open a door or start a stair journey behind it.
		I.add({...target,id:'brownieStatus',when:()=>this.equipped,
			text:()=>!this.ready()?'Release E before the next camera action':this.tutorialPending?this.tutorialHint:this.state.frames.length>=ROLL_FRAMES?'The roll is full · keep the back shut':!this.daylight?'Too dark for the Brownie · wait for daylight':!this.ready()?'Release E before the next camera action':'Hold the Brownie steady',key:'',use:()=>{}});
	}
	async take(){const s=this.s,later=s.beat==='lw-camera';await s.ui.read({title:'One roll. Six pictures.',body:[
		'Mary’s first picture is the chair beside my journal. I will make it indoors in the daylight watch, with the Brownie steadied at the table. Her note stays beside the journal.',
		s.app.isMobile?'Tools — Brownie raises or puts away the camera. Hold the named action; release it between exposing a frame and winding the film.':'C raises or puts away the Brownie. Hold E for the named camera action, then release E before the next action.',
		'After that first picture I can choose my own views. There are six frames on this one roll. Keep the back shut; the photographs can only be seen after the film goes ashore.'
	]});this.state.taken=true;s.flags.unpacking={...s.flags.unpacking,stage:4,examined:true};s.unpacking.sync();this.releaseRequired=s.app.input.down('KeyE');this.raised=!later;if(later){s.setBeat('lw-belongings');s.save();}else{s.toast(this.daylight?'Brownie taken. Mary’s chair will be my first picture in the daylight photography watch.':'Brownie taken. I will keep it shut until the daylight photography watch.',6500);s.save();}}

	expose(site){
		if(this.capturing||!this.state.taken||!this.canExpose||this.tutorialPending&&site?.id!=='chair'||!this.daylight||!this.state.wound||this.state.frames.length>=ROLL_FRAMES||!this.ready()||site&&(!this.near(site)||!this.looking(site)))return false;
		const s=this.s,token=this.generation,supported=site?.id==='chair'&&this.chairReady&&!!this.tutorial.braced,view=supported?s.app.keeperHands?.photographyView:null;
		this.captureView=view?{position:view.position.clone(),quaternion:view.quaternion.clone()}:null;
		this.capturing=true;s.app.player.busy=true;
		this.releaseRequired=true;
		const captureDirection=new Vector3(0,0,-1).applyQuaternion(this.captureView?.quaternion||s.app.camera.quaternion);
		const evidence={supported,subject:site?.id||'view',label:site?.label||'A view from Eilean Mòr',at:s.h,position:(this.captureView?.position||s.app.camera.position).toArray(),yaw:Math.atan2(-captureDirection.x,-captureDirection.z),pitch:Math.asin(Math.max(-1,Math.min(1,captureDirection.y)))};
		this.pending=async image=>{if(token!==this.generation||!this.capturing)return;this.pending=null;this.capturing=false;this.captureView=null;this.restoreRenderView();this.restoreCaptureExposure();s.app.cameraCut?.();s.app.player.busy=false;
			if(!image){s.toast('The shutter has not released. Hold steady and try again.',5000);return;}
			this.state.frames.push({...evidence,image});if(evidence.subject==='chair'){this.tutorial.complete=true;this.tutorial.completedAt=s.h;}this.state.wound=false;s.row(evidence.at,`Brownie frame ${this.state.frames.length} exposed: ${evidence.label}. Film remains undeveloped.`);s.toast(`Frame ${this.state.frames.length} exposed${evidence.subject==='chair'?' — Mary’s chair is on the roll':''}. ${this.state.frames.length===ROLL_FRAMES?'The roll is full. Keep its back shut until you go ashore.':this.missing?'Wind the film before the next picture.':'Mary’s three views are taken. You may use the remaining frames.'}`,6500);s.save();
		};
		if(s.app.capturePhotograph)Promise.resolve().then(()=>s.app.capturePhotograph()).then(this.pending,()=>this.pending?.(null));
		return true;
	}
	// The hand system supplies this lens transform from its Blender-authored
	// supported camera. Rendering briefly uses that view, then restores the eye;
	// no actor or equipment transform is authored here.
	beforeRender(){
		if(!this.capturing||!this.captureView)return;
		this.restoreRenderView();const a=this.s.app,c=a.camera;
		this.renderReturn={position:c.position.clone(),quaternion:c.quaternion.clone(),fov:c.fov};
		c.position.copy(this.captureView.position);c.quaternion.copy(this.captureView.quaternion);c.updateMatrixWorld(true);
		if(!this.captureView.started){const snap=a.post?.autoExposure?.snap;if(snap){this.captureSnap=snap.value;snap.value=1;}a.cameraCut?.();this.captureView.started=true;}
	}
	restoreCaptureExposure(){
		if(this.captureSnap===null)return;const snap=this.s.app.post?.autoExposure?.snap;
		if(snap)snap.value=this.captureSnap;this.captureSnap=null;
	}
	restoreRenderView(){
		if(!this.renderReturn)return;const c=this.s.app.camera,p=this.renderReturn;this.renderReturn=null;
		c.position.copy(p.position);c.quaternion.copy(p.quaternion);c.fov=p.fov;c.updateProjectionMatrix();c.updateMatrixWorld(true);
	}
	afterRender(){
		if(!this.pending||this.reading){this.restoreRenderView();return;}this.reading=true;const complete=this.pending;
		try{const target=this.s.app.post.outputTexture,texture=target||GPU.context.getCurrentTexture();
			const source=target||{getGPU:()=>texture,width:GPU.canvas.width,height:GPU.canvas.height,format:GPU.format};
			readTexture(source).then(({data,width,height})=>{
				const bytes=new Uint8Array(data);if(!bytes.some((v,i)=>i%4!==3&&v>0))throw new Error('Empty photograph readback');
				const canvas=document.createElement('canvas');canvas.width=canvas.height=PRINT_SIZE;const ctx=canvas.getContext('2d');
				ctx.putImageData(new ImageData(photographPixels(bytes,width,height,source.format.startsWith('bgra')),PRINT_SIZE,PRINT_SIZE),0,0);
				complete(canvas.toDataURL('image/jpeg',.68));
			}).catch(()=>complete(null)).finally(()=>{this.reading=false;});
		}catch{this.reading=false;complete(null);}
		this.restoreRenderView();
	}
	restore(){this.restoreRenderView();this.restoreCaptureExposure();this.captureView=null;this.generation++;this.pending=null;this.capturing=false;this.releaseRequired=false;this.raised=this.s.beat==='lw-photos'&&!!this.state.taken;this.s.app.player.busy=false;}
	guidance(){const s=this.s,site=this.tutorialPending?this.sites[0]:this.missing||this.sites[0],p=s.app.player.position;if(!this.state.wound&&this.state.frames.length<ROLL_FRAMES)return null;
		if((!this.missing||site.id!=='landing')&&(p.x<-22||p.z>15&&p.x<5))return westRoute(s,new Vector3(-3,TOWER.floor,1),'Return to the station',true);
		if(!this.tutorialPending&&(!this.missing||this.state.frames.length>=ROLL_FRAMES))return routeGuidance(s.app.player.position,{at:ROOM.journal,label:'Journal · finish the photography watch',id:'journal'},'room');
		if(site.id==='landing')return westRoute(s,site.stand,site.label+' · upper lookout');
		return routeGuidance(s.app.player.position,{at:((this.tutorialPending?this.atChairTable:this.near(site))?site.at:site.stand.clone().add(new Vector3(0,1,0))),label:this.tutorialPending?this.tutorialHint:site.label+' · hold to expose',id:`photo-${site.id}`},site.zone);
	}
}
