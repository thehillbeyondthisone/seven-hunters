import { ROOM_CRAFT_MODEL as models } from '../../src/world/flannan/RoomCraftModel.js';
import { Matrix4, Quaternion, Vector3 } from '../../src/engine/index.js';
const V=(x,y,z)=>new Vector3(x,y,z),UP=V(0,1,0),triangles=[];
const matrix=(at,yaw=0,scale=[1,1,1])=>new Matrix4().compose(V(...at),new Quaternion().setFromAxisAngle(UP,yaw),V(...scale));
const table=matrix([-5.4,.745,3.3],.1);
function add(name,model,transform){for(const g of Object.values(models[model]))for(let i=0;i<g.idx.length;i+=3)triangles.push({name,points:g.idx.slice(i,i+3).map(index=>V(...g.p.slice(index*3,index*3+3)).applyMatrix4(transform))});}
add('table top','tableTop',matrix([-5.4,.69,3.3],.1,[1.4,1,.8]));
for(const [name,model,at] of [['cup','cup',[.02,.005,-.17]],['blue cup','cup',[-.48,.005,-.15]],['folded cloth','foldedCloth',[.34,.008,-.12]],['tin','tin',[.48,.008,.08]],['plate','plate',[-.26,0,.02]]])add(name,model,table.clone().multiply(matrix(at)));
for(const [name,x,z,yaw]of[['near chair',-4.7,2.55,-.2],['west chair',-6.4,2.6,Math.PI*.6],['south chair',-5.95,4.05,Math.PI+.25]])add(name,'chair',matrix([x,0,z],yaw));
const cloth=(u,v)=>V((u-.5)*.66,.007+Math.sin(u*31)*.002-Math.max(0,Math.abs(v-.5)*1.12-.39)*.95,(v-.5)*1.12).applyMatrix4(table);
for(let i=0;i<28;i++)for(let j=0;j<20;j++){const a=cloth(i/28,j/20),b=cloth((i+1)/28,j/20),c=cloth((i+1)/28,(j+1)/20),d=cloth(i/28,(j+1)/20);triangles.push({name:'draped cloth',points:[a,b,c]},{name:'draped cloth',points:[a,c,d]});}
function hit(origin,direction,tri){const[a,b,c]=tri.points,e1=b.clone().sub(a),e2=c.clone().sub(a),h=direction.clone().cross(e2),det=e1.dot(h);if(Math.abs(det)<1e-9)return Infinity;const f=1/det,s=origin.clone().sub(a),u=f*s.dot(h);if(u<0||u>1)return Infinity;const q=s.clone().cross(e1),v=f*direction.dot(q);if(v<0||u+v>1)return Infinity;const t=f*e2.dot(q);return t>.0001?t:Infinity;}
export function supportGeometry(origin,{fov=70}={}){
 const target=V(-6.5,.65,-.2),q=new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(V(...origin),target,UP)),lens=V(0,.0381,-.069).applyQuaternion(q).add(V(...origin)),hits={},central={};
 const tan=Math.tan(fov/2*Math.PI/180),size=41;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const u=(x/(size-1)-.5)*2,v=(y/(size-1)-.5)*2,dir=V(u*tan,v*tan,-1).applyQuaternion(q).normalize();let nearest=Infinity,id='';for(const tri of triangles){const distance=hit(lens,dir,tri);if(distance<nearest){nearest=distance;id=tri.name;}}if(nearest<3){hits[id]=(hits[id]||0)+1;if(Math.abs(u)<.35&&Math.abs(v)<.65)central[id]=(central[id]||0)+1;}}
 const inverse=matrix([-5.4,0,3.3],.1).invert(),foot=[];
 for(const x of[-.0381,.0381])for(const z of[-.0635,.0635]){const p=V(-x,0,-z).applyQuaternion(q).add(V(...origin)).applyMatrix4(inverse),u=p.x/.66+.5,v=p.z/1.12+.5,clothTop=u>=0&&u<=1&&v>=0&&v<=1?.745+.007+Math.sin(u*31)*.002-Math.max(0,Math.abs(v-.5)*1.12-.39)*.95:null;foot.push({x:p.x,y:p.y,z:p.z,supported:Math.abs(p.x)<=.7&&Math.abs(p.z)<=.3992,clothTop,clothClearance:clothTop===null?null:p.y-clothTop});}
 return{origin,lens:lens.toArray(),fov,squareGrid:size*size,foregroundHits:hits,centralForegroundHits:central,footCorners:foot,supportedCorners:foot.filter(p=>p.supported).length,tableTopHeight:.74};
}
for(const origin of [[-5.2,.742,3.5],[-5.2,.742,2.95],[-5.2,.756,2.95]])console.log(JSON.stringify(supportGeometry(origin)));
