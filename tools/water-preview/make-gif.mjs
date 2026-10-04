// Local motion handoff. Adaptive palette; original PNG frames stay intact.
import {readFileSync,writeFileSync} from 'node:fs';
import {readPNG} from '../shots/png.mjs';
import assert from 'node:assert/strict';
const root='artifacts/water-preview',w=480,h=135,chunks=[],frames=[],hist=new Map();
const key=(r,g,b)=>(r>>4)*256+(g>>4)*16+(b>>4);
let difference=0,motion=0,previous;
for(let frame=0;frame<80;frame++){
 const free=readPNG(readFileSync(`${root}/free-${String(frame).padStart(3,'0')}.png`)),solved=readPNG(readFileSync(`${root}/solved-${String(frame).padStart(3,'0')}.png`));
 const rgb=Buffer.alloc(w*h*3);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const shot=x<w/2?free:solved,sx=(x%(w/2))*4,sy=y*4,i=(sy*shot.width+sx)*4;
  const r=shot.rgba[i],g=shot.rgba[i+1],b=shot.rgba[i+2],o=(y*w+x)*3;rgb.set([r,g,b],o);
  const k=key(r,g,b),v=hist.get(k)||[0,0,0,0];v[0]++;v[1]+=r;v[2]+=g;v[3]+=b;hist.set(k,v);
 }
 for(let i=0;i<free.rgba.length;i+=4){difference+=Math.abs(free.rgba[i]-solved.rgba[i])+Math.abs(free.rgba[i+1]-solved.rgba[i+1])+Math.abs(free.rgba[i+2]-solved.rgba[i+2]);if(previous)motion+=Math.abs(solved.rgba[i]-previous[i]);}
 previous=solved.rgba;frames.push(rgb);
}
assert.ok(difference>1e7&&motion>1e7,'moving comparison must contain visible motion and a distinct coast response');
function box(points){const count=points.reduce((a,p)=>a+p.count,0),mean=[0,1,2].map(c=>points.reduce((a,p)=>a+p.rgb[c]*p.count,0)/count),variance=[0,1,2].map(c=>points.reduce((a,p)=>a+(p.rgb[c]-mean[c])**2*p.count,0)/count);return{points,count,mean,variance,score:count*Math.max(...variance)};}
const boxes=[box([...hist.values()].map(v=>({count:v[0],rgb:v.slice(1).map(x=>x/v[0])})))];
while(boxes.length<256){boxes.sort((a,b)=>b.score-a.score);const b=boxes.shift();if(b.points.length<2){boxes.unshift(b);break;}const c=b.variance.indexOf(Math.max(...b.variance));b.points.sort((a,z)=>a.rgb[c]-z.rgb[c]);let count=0,split=1;for(;split<b.points.length;split++){count+=b.points[split-1].count;if(count>b.count/2)break;}split=Math.min(split,b.points.length-1);boxes.push(box(b.points.slice(0,split)),box(b.points.slice(split)));}
const palette=Buffer.alloc(256*3);boxes.forEach((b,i)=>palette.set(b.mean.map(Math.round),i*3));
const lut=new Uint8Array(4096);for(let k=0;k<4096;k++){const v=hist.get(k),rgb=v?v.slice(1).map(x=>x/v[0]):[(k>>8)*16+8,((k>>4)&15)*16+8,(k&15)*16+8];let score=Infinity,best=0;boxes.forEach((b,i)=>{const d=rgb.reduce((a,x,c)=>a+(x-b.mean[c])**2,0);if(d<score){score=d;best=i;}});lut[k]=best;}
const u16=n=>Buffer.from([n&255,n>>8]);chunks.push(Buffer.from('GIF89a'),u16(w),u16(h),Buffer.from([0xf7,0,0]),palette,Buffer.from([0x21,0xff,11]),Buffer.from('NETSCAPE2.0'),Buffer.from([3,1,0,0,0]));
for(const rgb of frames){
 chunks.push(Buffer.from([0x21,0xf9,4,0]),u16(15),Buffer.from([0,0,0x2c]),u16(0),u16(0),u16(w),u16(h),Buffer.from([0,8]));
 const packed=[];let bits=0,value=0;const code=c=>{value|=c<<bits;bits+=9;while(bits>=8){packed.push(value&255);value>>>=8;bits-=8;}};
 for(let start=0;start<w*h;start+=200){code(256);for(let i=start;i<Math.min(start+200,w*h);i++){const o=i*3;code(lut[key(rgb[o],rgb[o+1],rgb[o+2])]);}}
 code(257);if(bits)packed.push(value&255);const data=Buffer.from(packed);
 for(let i=0;i<data.length;i+=255){const b=data.subarray(i,i+255);chunks.push(Buffer.from([b.length]),b);}chunks.push(Buffer.from([0]));
}
chunks.push(Buffer.from([0x3b]));writeFileSync(root+'/comparison.gif',Buffer.concat(chunks));console.log(JSON.stringify({file:root+'/comparison.gif',difference,motion,width:w,height:h,frames:80,seconds:12}));
