import {TOWER as T,ROOM,STATION} from '../../src/world/flannan/Station.js';
import {HAULING_SHED} from '../../src/world/flannan/NextRooms.js';
import {walkControls,walkStormReview} from './coastal-route.mjs';
import {CHAIR_EXPOSURE_HOLD} from '../../src/story/Photography.js';
export async function walkLaterStory(f){
	const {s,player,step,face}=f,c=walkControls(f),{walk,use,work,up,down,balcony,inside,signal}=c;
	const check=(v,m)=>{if(!v)throw Error(m);},pause=async()=>{await f.yield?.();await Promise.resolve();};
	const arc=(r,from,to)=>{const delta=Math.atan2(Math.sin(to-from),Math.cos(to-from));return Array.from({length:24},(_,i)=>[Math.cos(from+delta*(i+1)/24)*r,Math.sin(from+delta*(i+1)/24)*r]);};
	const roomDesk=()=>walk([[-3.6,3.4],[ROOM.journal.x+.5,ROOM.journal.z+.7]],'journal desk');
	const angle=()=>Math.atan2(player.position.z,player.position.x);
	await roomDesk();await use('brownieTake');check(s.beat==='lw-belongings','camera opens belongings watch');
	await walk([[-7,1.5],[-7.6,2.6]],'west bedroom door');await use('westBedrooms');step(1);await walk([[-11,2.6],[-13.9,2.6]],'first west bedroom');await use('secondBedroom');step(1);await walk([[-17,2.6],[-18.6,3.8]],'second bedroom belongings');await use('belongings');
	await walk([[-17,2.6],[-14,2.6],[-10.5,2.6],[-7.7,2.6],[-3.8,1.7],[-4.25,3.5]],'return to Mary’s chair');
	const expose=async id=>{if(!s.photography.equipped){check(s.photography.toggle(),'raise the Brownie');step(.1);}const site=s.photography.sites.find(q=>q.id===id);face(site.at);if(id==='chair'&&s.photography.tutorialPending)await work('photo-brace',1);await work(`photo-${id}`,id==='chair'?CHAIR_EXPOSURE_HOLD+.2:.9);while(s.photography.capturing)await pause();check(s.photography.state.frames.some(q=>q.subject===id),`${id} exposure saved`);if(s.photography.state.frames.length<6)await work('filmWind',1.4);check(s.photography.toggle(),'put away the Brownie before using doors or stairs');step(.1);};
	await expose('chair');await up();const apparatus=s.photography.sites[1];await walk(arc(1.8,angle(),Math.atan2(apparatus.stand.z,apparatus.stand.x)),'apparatus photograph');await expose('apparatus');await down();
	const leaveWest=async()=>{if(s.doors.house[0].target<.5){await walk([[.3,4.6]],'house door');await use('houseDoor');step(1);}await walk([[3,4.6],[4.5,4.6],[4.5,18.5],[STATION.southGate.x,18.5]],'south station gate');if((s.doors.southGate?.[0]||s.doors.gate[1]).target<.5){await use('southGate');step(1);}await walk([[STATION.southGate.x,24]],'west tramway');};
	const westHome=async()=>{await walk(s.station.tracks.west.filter(q=>q[0]>player.position.x+5&&q[0]<-20),'upper tramway home');await walk([[STATION.southGate.x,24]],'station gate home');if((s.doors.southGate?.[0]||s.doors.gate[1]).target<.5){await use('southGate');step(1);}await walk([[STATION.southGate.x,18.5],[4.5,18.5],[4.5,4.6],[3,4.6],[.3,4.6],[-1,4]],'station shelter');};
	await leaveWest();await walk([...s.station.tracks.west.slice().reverse().filter(q=>q[0]<-20),[s.storm.lookout.x,s.storm.lookout.z]],'daylight west landing photograph');await expose('landing');await westHome();await roomDesk();await use('journal');check(s.beat==='lw-photo-signal','pictures lead to evening contact');
	await up();await balcony();await signal();check(s.beat==='lw-photo-journal','companionship exchange finishes');await inside();await down();await roomDesk();await use('journal');check(s.beat==='lw-fog','selected fog watch follows journal');
	await up();await balcony();await walk(arc(3.2,angle(),Math.atan2(s.later.fragmentAt.z,s.later.fragmentAt.x)),'northeast flashes');face(s.later.fragmentAt);s.app.input.rightDown=true;step(.6);for(let t=0;t<7;t+=.1){step(.1);await pause();}s.app.input.rightDown=false;step(.6);check(s.beat==='lw-fog-journal'&&s.later.state.fragment.marks,'actual fragment received');
	await inside();await down();await roomDesk();await use('journal');check(s.beat==='lw-review'&&s.later.state.reviewBoundary==='scene13','the unresolved reconnection reaches an explicit author review boundary');
	// The next approved chapter is a deliberate review entry, not invented continuity.
	if(!f.reviewBoundary)return c;await f.reviewBoundary('scene13');while(s.ui.open||s.later.busy)await pause();check(s.beat==='lw-workshop','deliberate review entry opens storm preparation');
	if(s.doors.house[0].target<.5){await walk([[.3,4.6]],'workshop house door');await use('houseDoor');step(1);}await walk([[-.5,4.6],[.3,4.6],[3,4.6],[4.5,4.6],[9.3,2],[9.3,1]],'workshop entrance');await use('workshopDoor');step(1);await walk([[9.3,-1.5],[9.5,-2.8]],'workshop bench');await work('workshopTools',1.5);await walk([[9.3,-1.5],[9.3,1],[4.5,4.6]],'leave workshop');
	await leaveWest();await walk([...s.station.tracks.west.slice().reverse().filter(q=>q[0]<-20&&q[0]>-157),[-157,39],[-160,43.8]],'upper hauling shed');await walk([[-160,42],[-160,40]],'upper brake');await work('repairBrake',4.3);await walk([[-160,42],[-160,44],[-157,39],[-160,35]],'leave upper shed');await westHome();check(s.beat==='lw-prepare-signal','repair return opens weather exchange');await up();await balcony();await signal();while(s.later.busy||s.storm.busy)await pause();check(s.beat==='storm-prepare'&&s.storm.state.connected,'normal story enters connected storm');await inside();await down();
	await walkStormReview(f,c,{resume:true});check(s.storm.state.connected,'storm keeps its normal continuation');
	check(s.beat==='lw-review'&&s.later.state.reviewBoundary==='storm-contact','the revised storm stops before unresolved contact, middle and held ending');
	return c;
}
