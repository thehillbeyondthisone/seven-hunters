import '../../src/core/BenchSeed.js';
import { App } from '../../src/App.js';
import { GPU } from '../../src/engine/webgpu.js';
import { Vector3 } from '../../src/engine/index.js';
import { Setting } from '../../src/sky/Setting.js';
import { installCoastalPreview, preparePreviewScene } from './CoastalPreview.js';

// This entry never creates Story, AppUI or Game. It never reads/writes story saves.
const loading=document.querySelector('#loading'), app=new App();
app.qs=new URLSearchParams('nostory&noAudio&noCliffSurf');
app.setting=new Setting('flannan');app.isVRPreview=false;app.isWeatherPreview=false;
installCoastalPreview(app);
window.__waterPreviewReady=(async()=>{
 await app.init((p,text)=>loading.textContent=`${Math.round(p*100)}% · ${text}`);
 preparePreviewScene(app);
 const coast=app.coastalPreview;window.__coast=coast;
 loading.textContent='Letting the swell reach the rocks…';await coast.warm(45);
 window.__view('fWestWatch');app.post.autoExposure.snap.value=1;
 const status=document.querySelector('#status');
 const buttons=[...document.querySelectorAll('[data-mode]')];
 buttons.forEach(b=>b.onclick=()=>{coast.mode(Number(b.dataset.mode));buttons.forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>window.__view(b.dataset.view));
 document.querySelector('#overhead').onclick=()=>{
  app.setFreeCam(true);const l=coast.landing;
  app.fly.setPose(new Vector3(l.stage.x+l.dir[0]*100,200,l.stage.z+l.dir[1]*100),Math.atan2(-l.dir[0],-l.dir[1]),-1.36);app.cameraCut();
 };
 document.querySelector('#pause').onclick=e=>{coast.running=!coast.running;e.currentTarget.textContent=coast.running?'Pause waves':'Resume waves';};
 const change=()=>coast.configure({period:Number(document.querySelector('#period').value),angle:Number(document.querySelector('#angle').value),amplitude:Number(document.querySelector('#amplitude').value),irregular:document.querySelector('#irregular').value==='1'});
 document.querySelectorAll('select').forEach(s=>s.onchange=change);document.querySelector('#restart').onclick=change;
 document.querySelector('#collapse').onclick=e=>{const hidden=document.body.classList.toggle('collapsed');e.currentTarget.setAttribute('aria-expanded',String(!hidden));e.currentTarget.textContent=hidden?'+':'−';};
 const map=document.querySelector('#map'),canvas=map.querySelector('canvas'),ctx=canvas.getContext('2d');
 document.querySelector('#mapToggle').onclick=e=>{map.hidden=!map.hidden;e.currentTarget.textContent=map.hidden?'Show motion map':'Hide motion map';};
 let reading=false;
 const draw=async()=>{
  status.textContent=`${coast.model.time.toFixed(1)} s · ${coast.running?'running':'paused'}${coast.model.time<35?' · swell travelling toward the cliff':''}`;
  if(reading||map.hidden)return;reading=true;
  try{
   const s=await coast.read(),n=coast.n,im=ctx.createImageData(n,n),contact=coast.observe(s);
   status.textContent+=` · at rock ${contact.height.toFixed(2)} m · ${contact.crests} crests`;
   for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const i=y*n+x,o=((n-1-y)*n+x)*4,h=Math.max(-1,Math.min(1,s[i*4]/2.5)),wet=coast.model.depths[i]>.05;
    const rgb=wet?(h>=0?[35+h*210,83+h*92,103-h*50]:[35,83+h*42,103-h*130]):[71,75,70];
    im.data.set([...rgb,255],o);
   }
   const off=document.createElement('canvas');off.width=n;off.height=n;off.getContext('2d').putImageData(im,0,0);ctx.drawImage(off,0,0,canvas.width,canvas.height);
   ctx.strokeStyle='#e7eece';ctx.lineWidth=1;
   for(let y=8;y<n;y+=12)for(let x=8;x<n;x+=12){const i=y*n+x;if(coast.model.depths[i]<.05)continue;const vx=s[i*4+1],vy=s[i*4+2],mag=Math.hypot(vx,vy);if(mag<.03)continue;const X=x*2,Y=(n-y)*2,len=Math.min(13,mag*14),a=vx/mag*len,b=-vy/mag*len;ctx.beginPath();ctx.moveTo(X,Y);ctx.lineTo(X+a,Y+b);ctx.lineTo(X+a-a*.3+b*.25,Y+b-b*.3-a*.25);ctx.moveTo(X+a,Y+b);ctx.lineTo(X+a-a*.3-b*.25,Y+b-b*.3+a*.25);ctx.stroke();}
  }finally{reading=false;}
 };
 setInterval(draw,250);await draw();
 app.engine.domElement.addEventListener('pointerdown',()=>app.input.requestLock());
 document.querySelector('#controls').hidden=false;loading.hidden=true;app.start();
 return {app,coast};
})().catch(e=>{loading.textContent=`Preview could not start: ${e.message}`;console.error(e);throw e;});
