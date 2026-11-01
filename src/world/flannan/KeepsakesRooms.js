import { Vector3, Color } from '../../engine/index.js';
import { lin, WOOD, HARD } from '../Props.js';
import { keeperTable, keeperChair } from './InteriorCraft.js';
import { stationCraft } from './StationCraft.js';
import { roomCraft } from './RoomCraft.js';
import { bedroomWindowLinings } from './BedroomWindows.js';

// Authored interiors within the existing house footprint, not a recovered room plan.
export function keepsakesRooms(ctx,parts,F,ceiling,makeDoor){
	// stationMasonry uses [seed, style, cover, splash], not HARD's metal layout.
	const {B,colliders,lights}=ctx,wood={tint:lin(0x786047),data:WOOD(.58,.06)},plaster={tint:lin(0xcac5b5),data:[.7,1,.25,1]};
	const wall=(x0,z0,x1,z1,y0=F,y1=ceiling)=>{B.box('stationMasonry',(x0+x1)/2,(y0+y1)/2,(z0+z1)/2,x1-x0,y1-y0,z1-z0,plaster);colliders.addBox(new Vector3((x0+x1)/2,(y0+y1)/2,(z0+z1)/2),new Vector3((x1-x0)/2,(y1-y0)/2,(z1-z0)/2),0,{tag:'bedroom-wall'});};
	// The shell already contains these windowed exterior walls. Retain continuous
	// safety colliders but remove the duplicate solid masonry behind the glass.
	// Interior partitions, door clearances and furniture remain in place.
	for(const [x0,z0,x1,z1] of [[-22,-1.8,-21.4,6],[-21.4,-1.8,-9.6,-1.2],[-21.4,5.4,-9.6,6]])colliders.addBox(new Vector3((x0+x1)/2,(F+ceiling)/2,(z0+z1)/2),new Vector3((x1-x0)/2,(ceiling-F)/2,(z1-z0)/2),0,{tag:'bedroom-wall'});
	bedroomWindowLinings(B,F);
	for(const [x,name] of [[-9.3,'bedrooms'],[-15.3,'spareBedroom']]){
		wall(x-.3,-1.2,x+.3,2);wall(x-.3,3.2,x+.3,5.4);wall(x-.3,2,x+.3,3.2,F+2.15);
		parts.doors.push(makeDoor(ctx,{name,hinge:new Vector3(x,F,2.04),ry:-Math.PI/2,swing:-1.6,width:1.12,height:2.08,leaf:L=>stationCraft(L,'interiorDoor')}));
	}
	B.box('stationFloor',-15.5,F-.04,2.1,12.4,.08,6.6,{grain:0,...wood});B.box('stationTimber',-15.5,ceiling,2.1,12.4,.08,6.6,{grain:2,tint:plaster.tint,data:WOOD(.7,.015,1)});
	colliders.addBox(new Vector3(-15.5,F-.18,2.1),new Vector3(6.2,.18,3.3),0,{solid:false,walkable:true,tag:'floor'});
	for(const x of [-12.5,-18.5]){
		B.box('stationTimber',x,F+.3,.1,1.7,.15,2.1,wood);B.box('hard',x,F+.46,.1,1.58,.22,2,{tint:lin(0xa2a394),data:HARD(.7,0,0,.9)});
		for(const z of [-.95,1.15])B.box('stationTimber',x,F+.65,z,1.75,.6,.07,wood);
		colliders.addBox(new Vector3(x,F+.4,.1),new Vector3(.88,.4,1.1),0,{tag:'furniture'});
		keeperTable(B,x-1.3,F,4.75,1.3,.65,.75,0,.6,true);keeperChair(B,x-1.3,F,3.9,0,.6);
		colliders.addBox(new Vector3(x-1.3,F+.4,4.75),new Vector3(.65,.4,.33),0,{tag:'furniture'});
		roomCraft(B,'foldedCloth',x-1.5,F+.8,4.75);B.box('stationTimber',x-.95,F+.8,4.75,.25,.055,.33,{tint:lin(0x565343),data:WOOD(.6,.1)});
		for(const dx of [-.14,.14])B.box('hard',x+dx,F+.12,1.5,.18,.24,.35,{tint:lin(0x3d3530),data:HARD(.7,0,0,.8)});
		// Cool window bounce follows an actual open reveal in each room.
		const westRoom=x < -15;
		lights.push({position:new Vector3(westRoom ? -18.4 : -14.5,F+1.6,westRoom ? 5.3 : -1.1),dir:new Vector3(0,-.2,westRoom ? -1 : 1).normalize(),color:new Color(.8,.88,1),intensity:2.5,range:7,kind:'daylight',day:true});
	}
	parts.keepsakes={secondDoor:new Vector3(-15.3,F+1,2.6),belongings:new Vector3(-19.8,F+.85,4.75),tools:new Vector3(10.6,F+.85,-3.7)};
}

export function workshopBench(ctx,F){
	const {B,colliders}=ctx,wood={tint:lin(0x786047),data:WOOD(.62,.12)},iron={tint:lin(0x5b6058),data:HARD(.5,0,.7,.55)};
	keeperTable(B,10.6,F,-3.7,1.1,.65,.75,0,.65,true);colliders.addBox(new Vector3(10.6,F+.38,-3.7),new Vector3(.55,.38,.33),0,{tag:'workshop-bench'});
	// Separate working tools are supplied by the Blender-MCP-authored
	// StormWorkProps, so taking them removes their visible bench copies.
}
