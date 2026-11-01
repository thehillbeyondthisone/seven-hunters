import { Group, Matrix4, Vector3, Quaternion } from '../engine/index.js';
import { craftMesh, handMesh } from '../world/flannan/KeeperCraft.js';
import { KEEPER_HAND_POSES } from '../world/flannan/KeeperHandPosesModel.js';
import { TOWER } from '../world/flannan/Station.js';

const UP=new Vector3(0,1,0),Y=new Vector3(0,1,0);
const Q=new Quaternion(),target=new Vector3(),elbow=new Vector3();
const CONTACT=KEEPER_HAND_POSES.attachments,POSES=KEEPER_HAND_POSES.poses,look=new Matrix4();

// Presentation reads existing story state; it never advances an action or writes
// a save. The hands are world-space geometry, so normal depth hides them behind
// nearby equipment. They are suppressed for photographs, reading and XR.
export class KeeperHands {
 constructor(app) {
  this.app=app;this.group=new Group();this.group.name='keeper-first-person-hands';
  app.scene.add(this.group);this.mode='hidden';this.time=0;this._equipmentMode='hidden';this._equipT=0;this._windT=0;
  this.hands=[-1,1].map(side=>{
   const group=new Group(),mesh=handMesh('grip','near',side<0),sleeve=craftMesh('keeperForearm');
   group.add(mesh);group.name=side<0?'keeper-left-hand':'keeper-right-hand';
   sleeve.castShadow=false;this.group.add(group,sleeve);return{side,group,mesh,sleeve,pose:'grip'};
  });
  this.camera=new Group();this.camera.name='held-brownie';this.camera.rotation.y=CONTACT.camera.rotationY;
  this.camera.add(craftMesh('brownie'));
  this.key=new Group();this.key.position.fromArray(CONTACT.camera.key);this.key.add(craftMesh('brownieKey'));this.camera.add(this.key);
  this.shutter=craftMesh('brownieShutter');this.shutter.position.fromArray(CONTACT.camera.shutter);this.camera.add(this.shutter);
  this.cameraRoot=new Group();this.cameraRoot.add(this.camera);this.group.add(this.cameraRoot);
  this.crankContact=new Group();this.crankContact.name='authored-winding-handle-contact';this.group.add(this.crankContact);
  this.hide();
 }
 hide() {
  this.mode='hidden';this.group.visible=false;
  for(const h of this.hands){h.group.visible=false;h.sleeve.visible=false;}
  this.cameraRoot.visible=false;
 }
 place(index,grip,quaternion,pose='grip') {
  const h=this.hands[index],cam=this.app.camera;
  if(h.pose!==pose){const source=handMesh(pose,'near',h.side<0);h.mesh.geometry=source.geometry;h.pose=pose;}
  h.group.visible=h.sleeve.visible=true;
  h.group.quaternion.copy(quaternion);
  h.group.position.copy(grip).add(new Vector3(0,-.075,.015).applyQuaternion(quaternion));
  // Forearm exits toward the shoulder below the view, without moving the grip.
  elbow.set(h.side*.32,-.55,.03).applyQuaternion(cam.quaternion).add(cam.position);
  h.sleeve.position.copy(h.group.position);
  const delta=elbow.sub(h.group.position);h.sleeve.quaternion.setFromUnitVectors(UP,delta.clone().normalize());
  h.sleeve.scale.y=Math.min(.7,delta.length())/.28;
 }
 // Positions and complete finger contacts below are exported from the editable
 // Blender study. Runtime only attaches them to the item and its existing state.
 authored(index,item,pose,{pivot=null,turn=0,drop=0}={}) {
  const h=this.hands[index],cam=this.app.camera,model=POSES[pose];
  if(h.pose!==pose){h.mesh.geometry=handMesh(pose).geometry;h.pose=pose;}
  item.updateWorldMatrix(true,false);item.getWorldQuaternion(Q);item.getWorldPosition(target);
  h.group.visible=h.sleeve.visible=true;h.group.position.copy(target);h.group.quaternion.copy(Q);
  const wrist=new Vector3().fromArray(model.wrist);
  if(pivot&&turn){
   const axis=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),turn),p=new Vector3().fromArray(pivot);
   const offset=p.clone().sub(p.clone().applyQuaternion(axis));
   h.group.position.add(offset.applyQuaternion(Q));h.group.quaternion.multiply(axis);
  }
  h.group.position.y-=drop;
  h.sleeve.position.copy(wrist.applyQuaternion(h.group.quaternion).add(h.group.position));
  const shoulder=CONTACT.forearm.shoulderOffset;
  elbow.set(h.side*shoulder[0],shoulder[1],shoulder[2]).applyQuaternion(cam.quaternion).add(cam.position);
  const delta=elbow.sub(h.sleeve.position);h.sleeve.quaternion.setFromUnitVectors(UP,delta.clone().normalize());
  h.sleeve.scale.y=Math.min(CONTACT.forearm.maxPresentationReach,delta.length())/CONTACT.forearm.length;
 }
 equipment(dt,mode) {
  if(this._equipmentMode!==mode){this._equipmentMode=mode;this._equipT=0;}
  this._equipT=Math.min(1,this._equipT+Math.max(0,dt)/CONTACT.transitionSeconds);
  return CONTACT.transitionDrop*(1-this._equipT)*(1-this._equipT);
 }
 get photographyView() {
  if(this.mode!=='camera')return null;
  this.camera.updateWorldMatrix(true,false);
  return {position:this.camera.localToWorld(new Vector3().fromArray(CONTACT.camera.lens)),quaternion:this.cameraRoot.getWorldQuaternion(new Quaternion())};
 }
 update(dt) {
  this.time+=Math.max(0,dt);this.hide();
  const a=this.app,s=a.story,c=a.camera,H=a.handLamp;
  const blocked=a.isVRPreview||a.freeCam||a.ui?.ui?.photoMode||a.mobile?.paused||a.devMenu?.open||
   s?.aboard||s?.ui.open||s?.signal||s?.tel>.3||s?.cinematic||s?.keeper?.cinematic||s?.cutsceneReview?.active||s?.towerTravel?.active||
   s?.photography?.capturing||a.devArmory?.canUse()||a.playground?.canUse();
  if(blocked){this._equipmentMode='hidden';return;}
  this.group.visible=true;
  const morning=s?.morning,models=morning?.enabled?morning.models:null;
  const action=morning?.motion?.action,current=s?.interact.current;
  const held=a.input?.down('KeyE');
  if(s?.photography?.equipped) {
   this.mode='camera';this.cameraRoot.visible=true;
   if(H)H.group.visible=false;
   const continuing=this._equipmentMode==='camera',drop=this.equipment(dt,'camera'),braced=!!(s.photography.tutorialPending&&s.photography.tutorial?.braced&&s.photography.atChairTable);
   const wantedPosition=new Vector3(),wantedRotation=new Quaternion();
   if(braced){
    wantedPosition.fromArray(CONTACT.braced.tablePosition);wantedPosition.y+=TOWER.floor;
    target.fromArray(CONTACT.braced.chairTarget);target.y+=TOWER.floor;
    wantedRotation.setFromRotationMatrix(look.lookAt(wantedPosition,target,UP));
   }else{
    wantedPosition.fromArray(CONTACT.camera.eyeOffset).applyQuaternion(c.quaternion).add(c.position);
    wantedPosition.y-=drop;wantedRotation.copy(c.quaternion);
   }
   if(continuing&&this._wasBraced!==braced)this._cameraSettle={time:0,position:this.cameraRoot.position.clone(),quaternion:this.cameraRoot.quaternion.clone()};
   if(!continuing)this._cameraSettle=null;
   if(this._cameraSettle){
    const settle=this._cameraSettle;settle.time=Math.min(1,settle.time+Math.max(0,dt)/CONTACT.transitionSeconds);
    const t=settle.time*settle.time*(3-2*settle.time);
    this.cameraRoot.position.copy(settle.position).lerp(wantedPosition,t);this.cameraRoot.quaternion.copy(settle.quaternion).slerp(wantedRotation,t);
    if(settle.time===1)this._cameraSettle=null;
   }else{this.cameraRoot.position.copy(wantedPosition);this.cameraRoot.quaternion.copy(wantedRotation);}
   this._wasBraced=braced;
   const wind=held&&current?.id==='filmWind';
   this._windT=wind?this._windT+Math.max(0,dt):0;
   this.key.rotation.x=wind?Math.sin(this._windT/CONTACT.camera.windSeconds*Math.PI*2)*CONTACT.camera.windAngle:0;
   const shutter=held&&current?.id.startsWith('photo-')&&current.id!=='photo-brace';
   this.shutter.position.y=CONTACT.camera.shutter[1]-(shutter?CONTACT.camera.shutterTravel:0);
   this.cameraRoot.updateMatrixWorld(true);
   this.authored(0,this.camera,shutter?'cameraLeftShutter':'cameraLeft');
   this.authored(1,this.camera,wind?'cameraRightWind':'cameraRight',wind?{pivot:CONTACT.camera.key,turn:this.key.rotation.x}:{});
  } else if(models&&(action||morning.state.canPlace==='carried'||morning.state.kitPlace==='carried')) {
   this.mode=action||'supplies';
   if(action==='glass'||action==='housing'||action==='familiar'||action==='wick') {
    const tool=models.trimmer.visible?models.trimmer:models.housingTool.visible?models.housingTool:models.tool;
    tool.localToWorld(target.set(0,-.17,0));this.place(1,target,tool.quaternion,tool===models.trimmer?'pinch':'grip');
   } else if(action==='pour'||action==='fill'||morning.state.canPlace==='carried') {
    models.can.localToWorld(target.set(0,.47,0));this.place(1,target,models.can.quaternion);
   }
   if(morning.state.kitPlace==='carried'){models.kit.localToWorld(target.set(-.17,.09,0));this.place(0,target,c.quaternion);}
   if(H)H.group.visible=false;
  } else if(s?.storm?.workProps?.handContacts&&s.storm.workProps.handContacts()?.length) {
   this.mode='storm-work';
   for(const contact of s.storm.workProps.handContacts())this.place(contact.index,contact.position,contact.quaternion,contact.pose);
   if(H)H.group.visible=false;
  } else if(s?.next?.domestic?.handContacts&&s.next.domestic.handContacts()?.length) {
   this.mode='domestic';
   for(const contact of s.next.domestic.handContacts())this.place(contact.index,contact.position,contact.quaternion,contact.pose);
   if(H)H.group.visible=false;
  } else if(current?.id==='crank'&&held&&s.lamp.wind<.999&&s.moving.crank) {
   this.mode='winding';const crank=s.moving.crank;
   crank.localToWorld(target.fromArray(CONTACT.crank.point));this.crankContact.position.copy(target);
   // The timber handle spins freely about its own axis. The hand follows its
   // orbit while retaining the MCP-authored grip frame, rather than rolling
   // the wrist through a full revolution with the forged arm.
   (CONTACT.crank.freeSpinningGrip&&crank.parent?crank.parent:crank).getWorldQuaternion(Q);
   this.crankContact.quaternion.copy(Q).multiply(new Quaternion().fromArray(CONTACT.crank.quaternion));
   this.crankContact.updateMatrixWorld(true);this.authored(1,this.crankContact,'crankGrip');if(H)H.group.visible=false;
  } else if(H?.carried&&H.group.visible) {
   this.mode='lantern';this.equipment(dt,'lantern');this.authored(1,H.group,'lanternBail');
  } else {this.hide();this._equipmentMode='hidden';}
 }
}
