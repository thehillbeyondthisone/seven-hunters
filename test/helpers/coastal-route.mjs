import { TOWER as T, ROOM, STATION } from '../../src/world/flannan/Station.js';

// Shared by the CPU regression and live browser review. Every journey walks
// through the actual collision world; only the established tower travel moves
// between floors. Interactions must be selectable from the resulting pose.
export async function walkReturningLight(f){
	const {s,player,keys,step,face}=f,chapter=s.returningLight;
	const check=(value,message)=>{if(!value)throw new Error(message);};
	const pause=async label=>{await f.checkpoint?.(label);await f.yield?.();};
	const radial=(r,a)=>[Math.cos(a)*r,Math.sin(a)*r];
	const angle=()=>Math.atan2(player.position.z,player.position.x);
	const arc=(r,from,to)=>{const delta=Math.atan2(Math.sin(to-from),Math.cos(to-from)),n=Math.max(1,Math.ceil(Math.abs(delta)/.18));return Array.from({length:n},(_,i)=>radial(r,from+delta*(i+1)/n));};
	async function walk(points,label,reach=.2){
		keys.add('KeyW');let ticks=0;
		for(const [x,z]of points){let best=Infinity,stuck=0;
			while(Math.hypot(x-player.position.x,z-player.position.z)>reach){
				if(s.ui.open){keys.delete('KeyW');await pause(label);continue;}
				keys.add('KeyW');const dx=x-player.position.x,dz=z-player.position.z,d=Math.hypot(dx,dz);
				if(d<best-.025){best=d;stuck=0;}else stuck+=1/30;
				check(stuck<4,`${label}: stuck at ${player.position.toArray()} toward ${x},${z}`);
				player.yaw=Math.atan2(-dx,-dz);player.pitch=0;step(1/30);
				if(++ticks%18===0)await f.yield?.();
			}
		}
		keys.clear();step(.1);await pause(label);
	}
	async function use(id){const it=s.interact.get(id);check(!!it,`missing ${id}`);face(typeof it.at==='function'?it.at():it.at);check(s.interact.pick()?.id===id,`${id} not selectable: ${s.interact.pick()?.id}, feet ${player.position.toArray()}`);await it.use();step(.1);await pause(id);}
	async function work(id,seconds){const it=s.interact.get(id);face(typeof it.at==='function'?it.at():it.at);check(s.interact.pick()?.id===id,`${id} not selectable: ${s.interact.pick()?.id}; feet ${player.position.toArray()}; eye ${s.app.camera.position.toArray()}; target ${(typeof it.at==='function'?it.at():it.at).toArray()}`);keys.add('KeyE');for(let t=0;t<seconds;t+=.1){step(.1);await f.yield?.();}keys.delete('KeyE');step(.1);await pause(id);}
	const H=T.hatch,hx=Math.cos(H.angle)*H.r-Math.sin(H.angle)*(H.run+.15),hz=Math.sin(H.angle)*H.r+Math.cos(H.angle)*(H.run+.15),topA=Math.atan2(hz,hx);
	async function up(){await walk([[-.5,4.6],[-2.5,3.2],radial(4,T.doorAngle),radial(3,T.doorAngle),radial(1.8,T.doorAngle)],'house to tower');await use('towerUp');await walk(arc(1.9,angle(),T.crankAngle),'lantern winding position');}
	async function down(){await walk(arc(1.9,angle(),topA+.35),'lantern hatch');await use('towerDown');await walk([radial(1.8,T.doorAngle),radial(3,T.doorAngle),radial(4,T.doorAngle),[-2.5,3.2],[-.5,4.6]],'tower to room');}
	async function balcony(){await walk(arc(1.9,angle(),T.galleryDoor),'gallery door');if(s.doors.gallery[0].target<.5){await use('galleryDoor');step(1);}await walk([radial(3.2,T.galleryDoor)],'onto balcony');}
	async function inside(){await walk(arc(3.2,angle(),T.galleryDoor),'balcony to door');await walk([radial(1.9,T.galleryDoor)],'back into lantern');}
	async function signal(){await walk(arc(3.2,angle(),Math.atan2(T.signalStand.z,T.signalStand.x)),'signal lamp');await use('signal');
		for(let i=0;i<5000&&(s.signal||s.watcher.state!=='done');){if(s.ui.open){await f.yield?.();continue;}i++;s._hurry=true;step(.2);await f.yield?.();await Promise.resolve();}
		check(s.watcher.state==='done'&&!s.watcher.lost,'signal exchange finishes');step(2);await pause('signal completed');}
	await up();await work('lens',2.5);await work('crank',3);check(s.beat==='rl-look','light and wind lead to the sighting');await balcony();face(chapter.light);step(3.4);await pause('returning light observed');
	while(chapter.busy||s.ui.open)await pause('Read the actual islet observation page');
	check(s.beat==='rl-signal','observed light opens Cate conversation');await signal();check(s.beat==='rl-rest','first exchange leads to rest');await inside();await down();
	await walk([[-2.2,4.9]],'kitchen threshold');if(s.doors.kitchen[0].target<.5){await use('kitchenDoor');step(1);}await walk([[-2.2,7.8],[-2.2,9.5]],'through kitchen');if(s.doors.berth[0].target<.5){await use('berthDoor');step(1);}await walk([[-2.2,11.9]],'berth');await use('rlBerth');check(s.beat==='rl-view','daylight choice opens shore investigation');
	await walk([[-2.2,10.3],[-2.2,6.1],[-2.2,4.9],[-.5,4.6],[.3,4.6]],'berth to house entrance');if(s.doors.house[0].target<.5){await use('houseDoor');step(1);}
	const E=s.station.landings.east;
	const gate=s.interact.get('gate').at,gateAt=typeof gate==='function'?gate():gate;
	await walk([[3,4.6],[5,4.6],[gateAt.x-1.5,gateAt.z]],'east gate');if(s.doors.gate[0].target<.5){await use('gate');step(1);}
	await walk([[gateAt.x+2,gateAt.z],[E.top.x,E.top.z],[chapter.viewpoint.x,chapter.viewpoint.z]],'east headland');
	s.app.input.rightDown=true;face(chapter.light);step(.5);await work('rlStudy',4.2);check(!!chapter.state.ridge,'ridge observed');face(chapter.channel);await work('rlStudy',4.2);check(s.beat==='rl-return'&&chapter.state.channel,'channel observed separately');s.app.input.rightDown=false;step(.6);
	await walk([[E.top.x,E.top.z],[gateAt.x+2,gateAt.z],[gateAt.x-2,gateAt.z],[5,4.6],[3,4.6],[.3,4.6],[-1,4]],'return to station');
	while(chapter.busy||s.ui.open)await pause('Afternoon transition');await up();await work('lens',2.5);await work('crank',3);check(s.beat==='rl-report','evening apparatus prepared before reporting');await balcony();await signal();check(s.beat==='rl-journal','report leads to journal');await inside();await down();
	await walk([[-3.6,3.4],[ROOM.journal.x+.5,ROOM.journal.z+.7]],'journal desk');await use('journal');check(s.beat==='rl-complete','signed journal completes the chapter');
	return {walk,use,work,up,down,balcony,inside,signal};
}

export async function walkStormReview(f,c){
	const {s,player,step,face}=f,{walk,use,work,up,down,balcony,inside,signal}=c,storm=s.storm;
	const check=(value,text)=>{if(!value)throw new Error(text);};
	await storm.begin();
	await walk([[-2.2,4.9]],'storm kitchen');if(s.doors.kitchen[0].target<.5){await use('kitchenDoor');step(1);}await walk([[-2.2,7.8],[-1.4,9.1]],'oil supply');await work('stormOil',1.7);check(player.carryingHeavy,'oil is carried with weight');
	await walk([[-2.2,7.8],[-2.2,4.9],[-.5,4.6]],'carry oil to tower');await up();
	const shelf=s.interact.get('stormShelf').at,a=Math.atan2(shelf.z,shelf.x),n=24,from=Math.atan2(player.position.z,player.position.x),delta=Math.atan2(Math.sin(a-from),Math.cos(a-from));
	await walk(Array.from({length:n},(_,i)=>[Math.cos(from+delta*(i+1)/n)*1.9,Math.sin(from+delta*(i+1)/n)*1.9]),'lantern supply shelf');await work('stormShelf',1.7);check(!player.carryingHeavy,'oil stowed');
	await walk([[Math.cos(T.crankAngle)*1.9,Math.sin(T.crankAngle)*1.9]],'storm winding square');await work('crank',3);await down();
	if(s.doors.house[0].target<.5){await walk([[.3,4.6]],'storm house door');await use('houseDoor');step(1);}
	await walk([[3,4.6],[4.5,4.6],[4.5,18.5],[STATION.southGate.x,18.5]],'station gate preparation');await work('stormGate',1.7);check(s.beat==='storm-look','preparation opens lookout objective');
	await use('southGate');step(1);await walk([[STATION.southGate.x,24]],'leave station');await use('southGate');step(1);
	const path=s.station.tracks.west.slice().reverse().filter(p=>p[0]<-20);await walk([...path,[storm.lookout.x,storm.lookout.z]],'upper west tramway');
	face(storm.serviceLight);step(4.5);check(s.beat==='storm-wave',`observed lantern opens the larger set; beat ${s.beat}, feet ${player.position.toArray()}, lookout ${storm.lookout.toArray()}, lantern ${storm.serviceLight.toArray()}, looked ${storm.state.looked}`);
	for(let t=0;t<40&&s.beat==='storm-wave';t+=.1){face(storm.serviceLight);step(.1);await f.yield?.();}
	check(storm.state.routeDestroyed&&s.beat==='storm-return','visible water destroys lower route and leaves upper return');check(player.position.y>28,'required lookout remains above the break');
	await walk(s.station.tracks.west.filter(p=>p[0]<-20),'return by upper tramway');await walk([[STATION.southGate.x,24]],'return to station gate');if(s.doors.gate[1].target<.5){await use('southGate');step(1);}await walk([[STATION.southGate.x,18.5],[4.5,18.5],[4.5,4.6],[3,4.6],[.3,4.6],[-1,4]],'return indoors');check(s.beat==='storm-keep','return requires keeping the apparatus');
	await up();await work('crank',3);check(s.beat==='storm-signal',`working light opens contact: ${s.beat}, wind ${s.lamp.wind}, lit ${s.lamp.lit}, watcher ${s.watcher.state}/${s.watcher.lost}`);await balcony();await signal();check(s.beat==='storm-journal','Cate exchange opens storm journal');await inside();await down();await walk([[-3.6,3.4],[ROOM.journal.x+.5,ROOM.journal.z+.7]],'storm journal desk');await use('journal');check(s.beat==='storm-complete','review ends before relief');
}
