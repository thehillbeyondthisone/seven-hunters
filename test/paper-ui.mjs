// Real Chrome UI checks; no watch saves are read or written. Uses the local
// fixture and retains the sheets/detail views under artifacts/review-paper-ui/.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=join(root,'artifacts','review-paper-ui');await mkdir(output,{recursive:true});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const port=await new Promise((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})});
const browserCandidates=[process.env.CHROME_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean);let browserPath;
for(const path of browserCandidates){try{await access(path);browserPath=path;break}catch{}}
assert.ok(browserPath,'Set CHROME_PATH to Chrome/Edge for rendered paper checks.');
const base=process.env.PAPER_UI_URL||'http://127.0.0.1:5191';let vite;
try{const r=await fetch(base+'/test/paper-review.html');assert.ok(r.ok);assert.match(await r.text(),/paper sheets review/)}catch{
 const url=new URL(base);assert.equal(url.hostname,'127.0.0.1','Only a local review server is started.');
 vite=spawn(process.execPath,[join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',url.port,'--strictPort'],{cwd:root,stdio:'ignore',windowsHide:true});
 let ready=false;for(let i=0;i<100;i++){try{const r=await fetch(base+'/test/paper-review.html');if(r.ok){ready=true;break}}catch{}await pause(100)}assert.ok(ready,'Local paper fixture starts.');
}
const profile=await mkdtemp(join(tmpdir(),'flannan-paper-ui-'));
const browser=spawn(browserPath,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore',windowsHide:true});
let ws;const reports=[];
try{
 let target;for(let i=0;i<100;i++){try{target=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'}).then(r=>r.json());if(target.webSocketDebuggerUrl)break}catch{}await pause(100)}assert.ok(target?.webSocketDebuggerUrl,'Isolated Chrome review starts.');
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let id=0;const waiting=new Map();
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(!m.id)return;const p=waiting.get(m.id);if(p){waiting.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result)}});
 const c=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;waiting.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}))});
 const evaluate=async expression=>{const r=await c('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.result?.description||r.exceptionDetails.text);return r.result?.value};
 const shot=async name=>{const r=await c('Page.captureScreenshot',{format:'png'});await writeFile(join(output,name+'.png'),Buffer.from(r.data,'base64'))};
 const load=async(view,path='/test/paper-review.html')=>{await c('Page.navigate',{url:`${base}${path}?${path.includes('guided-')?'step':'view'}=${view}`});for(let i=0;i<80;i++){await pause(50);if(await evaluate(path.includes('guided-')?'Boolean(window.review)':'Boolean(window.paperReady)'))break}await pause(400)};
 const layout=()=>evaluate(`(()=>{const p=document.querySelector('.sh-page'),w=p.querySelector('.sh-sheet-window'),r=p.getBoundingClientRect(),b=w.getBoundingClientRect();const bad=[];for(const n of p.querySelectorAll('*')){const s=getComputedStyle(n);if(/auto|scroll/.test(s.overflowX+' '+s.overflowY))bad.push(n.className)}const cuts=[];const walker=document.createTreeWalker(p.querySelector('.sh-sheet-flow'),NodeFilter.SHOW_TEXT);while(walker.nextNode()){const n=walker.currentNode;if(!n.textContent.trim()||n.parentElement.closest('[hidden]'))continue;const range=document.createRange();range.selectNodeContents(n);for(const q of range.getClientRects()){if(q.width&&q.height&&(q.top<b.top-2||q.bottom>b.bottom+2))cuts.push(n.textContent.slice(0,60))}}return{errors:window.paperErrors||[],sheets:Number(p.dataset.sheets),sheet:Number(p.dataset.sheet),bad,cuts:cuts.slice(0,8),onscreen:r.left>=-.5&&r.top>=-.5&&r.right<=innerWidth+.5&&r.bottom<=innerHeight+.5,height:w.clientHeight,width:w.clientWidth}})()`);
 await c('Page.enable');await c('Runtime.enable');
 for(const [width,height,forceTouch=false] of [[1440,900],[844,390],[844,390,true],[390,844],[320,568]]){
  await c('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:forceTouch||width<500});
  for(const view of ['read','packet','guide','letter','archive','choice','journal','form','save','album']){
   await load(view);if(forceTouch){await evaluate(`document.documentElement.classList.add('is-mobile')`);await pause(100)}const s=await layout();reports.push({width,height,forceTouch,view,...s});assert.deepEqual(s.errors,[],`${view}: no runtime errors`);assert.equal(s.onscreen,true,`${view}: paper remains within ${width}x${height}`);assert.deepEqual(s.bad,[],`${view}: no scrolling paper children`);assert.deepEqual(s.cuts,[],`${view}: no lines cut vertically`);assert.ok(s.sheets>=1&&s.height>60,`${view}: readable sheet space`);
   if(width===844&&['read','archive','save'].includes(view))await shot(`${view}-${width}x${height}-first`);
   if(view==='read'){
    assert.ok(s.sheets>1,'Long material receives multiple sheets.');
    await evaluate(`document.querySelector('.sh-sheet-pager button:last-child').click()`);assert.equal((await layout()).sheet,2,'A deliberate page turn moves one sheet.');
    await evaluate(`document.querySelector('.sh-page').dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowRight',repeat:true,bubbles:true}))`);assert.equal((await layout()).sheet,2,'A held arrow cannot skip sheets.');
    await evaluate(`(()=>{const p=document.querySelector('.sh-page'),count=Number(p.dataset.sheets);for(let i=0;i<count;i++)p.querySelector('.sh-sheet-pager button:last-child').click()})()`);assert.equal((await layout()).sheet,s.sheets,'Last sheet remains reachable.');
    if(width===844)await shot('read-844x390-last');
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',bubbles:true}))`);assert.equal(await evaluate('paperInput.enabled'),true,'Dismissal restores walking input.');
   }
   if(view==='guide'){
    await evaluate(`(()=>{const p=document.querySelector('.sh-page');for(let i=0;i<Number(p.dataset.sheets);i++)p.querySelector('.sh-sheet-pager button:last-child').click();p.querySelectorAll('.sh-reader-tabs button')[1].click()})()`);await pause(100);assert.equal((await layout()).sheet,1,'A new field-guide chapter begins at its first sheet.');
   }
   if(view==='archive'){
    assert.equal(await evaluate(`document.querySelector('.sh-page')._paper.visible(document.querySelector('.sh-archive-scan'))`),true,'The original scan appears on the first sheet.');
    await evaluate(`document.querySelectorAll('.sh-archive-tools button')[1].click()`);await pause(100);
    const detail1=await evaluate(`({status:document.querySelector('.sh-archive-status').textContent,image:document.querySelector('canvas').toDataURL()})`);assert.match(detail1.status,/Detail 1 of/,'Detail view is labelled.');
    await evaluate(`document.querySelector('.sh-archive-detail-nav button:last-child').click()`);const detail2=await evaluate(`({status:document.querySelector('.sh-archive-status').textContent,image:document.querySelector('canvas').toDataURL()})`);assert.match(detail2.status,/Detail 2 of/,'Next detail is reachable.');assert.notEqual(detail1.image,detail2.image,'Different original scan pixels appear in each detail.');assert.equal(await evaluate(`document.querySelector('.sh-page')._paper.visible(document.querySelector('.sh-archive-scan'))`),true,'Detail controls remain on the visible sheet.');
    if(width===844)await shot('archive-844x390-detail2');
   }
   if(view==='choice'){
    await evaluate(`(()=>{const p=document.querySelector('.sh-page');for(let i=0;i<Number(p.dataset.sheets);i++)p.querySelector('.sh-sheet-pager button:last-child').click();p.querySelectorAll('.sh-option')[5].click()})()`);assert.equal(await evaluate('paperResult'),5,'A reply on a later sheet returns its original value.');
   }
   if(view==='journal'){
    await evaluate(`(()=>{const p=document.querySelector('.sh-page'),fields=p.querySelectorAll('.sh-field');fields[0].children[0].click();p.querySelector('.sh-sheet-pager button:last-child').click();fields[1].children[1].click();p.querySelector('.sh-sheet-actions button').click()})()`);assert.deepEqual(await evaluate('paperResult'),{gate:true,weather:false},'Journal selections survive page turns and signing.');
   }
   if(view==='save'){
    await evaluate(`document.querySelector('.sh-save-restart').click()`);await pause(400);assert.equal(await evaluate('paperUI.modal'),2,'Reset asks for a separate deliberate confirmation.');
    if(width===844)await shot('save-844x390-confirm');
    await evaluate(`[...document.querySelectorAll('.sh-page-wrap:last-child button')].find(b=>b.textContent==='Keep this watch').click()`);assert.equal(await evaluate('paperUI.modal'),1,'Cancelling reset returns to the saved watch.');assert.equal(await evaluate('paperInput.enabled'),false,'Saved watch still owns input.');
    await evaluate(`document.querySelector('.sh-save-continue').click()`);assert.equal(await evaluate('paperResult'),'continue','Continue retains the saved watch.');assert.equal(await evaluate('paperInput.enabled'),true,'Resume restores controls.');
   }
  }
  await load('study');if(forceTouch){await evaluate(`document.documentElement.classList.add('is-mobile')`);await pause(100)}const studyStates=[];
  for(const chapter of ['explore','light','send']){await evaluate(`paperStudy.chapter='${chapter}';paperStudy.refresh()`);await pause(80);const state=await evaluate(`(()=>{const p=document.querySelector('.sh-lamp-study'),r=p.getBoundingClientRect(),w=p.querySelector('.sh-sheet-window'),controls=[...p.querySelectorAll('.sh-lamp-foot button,.sh-lamp-key-row button')];return{errors:paperErrors,onscreen:r.top>=0&&r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,space:w.clientHeight,controlsInside:controls.every(n=>{const q=n.getBoundingClientRect();return q.top>=r.top&&q.bottom<=r.bottom&&q.left>=r.left&&q.right<=r.right}),scrolling:[...p.querySelectorAll('*')].some(n=>/auto|scroll/.test(getComputedStyle(n).overflowX+' '+getComputedStyle(n).overflowY))}})()`);assert.deepEqual(state.errors,[],'Daylight lamp panel has no runtime errors.');assert.equal(state.onscreen,true,'Daylight lamp panel fits the viewport.');assert.equal(state.controlsInside,true,'All daylight lamp controls fit inside its paper.');assert.equal(state.scrolling,false,'Daylight lamp uses sheets without scrolling.');assert.ok(state.space>=90,'Daylight lamp keeps readable space for its lesson.');studyStates.push({chapter,...state});}
  reports.push({width,height,forceTouch,study:studyStates});await shot(`study-${width}x${height}${forceTouch?'-touch':''}`);
  if(width!==320){for(const step of ['reply','help']){
   await load(step,'/test/guided-signal-browser.html');await evaluate(`(async()=>{await import('/src/mobile/mobile.css');document.documentElement.classList.toggle('is-mobile',${forceTouch||width<500})})()`);await pause(100);const g=await evaluate(`(()=>{const p=document.querySelector('.sh-guided-signal .sh-page'),r=p.getBoundingClientRect();return{onscreen:r.top>=0&&r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,hiddenKeys:document.querySelector('.sh-guided-signal-actions').hidden,keysDisplay:getComputedStyle(document.querySelector('.sh-guided-signal-actions')).display}})()`);assert.equal(g.onscreen,true,'Guided Morse controls fit the viewport.');if(step==='help')assert.equal(g.keysDisplay,'none','Help hides unavailable shutter controls.');reports.push({width,height,guided:step,...g});await shot(`guided-${step}-${width}x${height}`);
  }}
 }
 for(const [width,height,mobile] of [[844,390,false],[844,390,true],[390,844,true]]){
  await c('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await c('Page.navigate',{url:`${base}/test/story-ui.html?view=intro-boat${mobile?'&mobile':''}`});await pause(700);const arrival=await evaluate(`(()=>{const p=document.querySelector('.sh-arrival'),h=document.querySelector('.sh-objective'),r=p.getBoundingClientRect(),q=h.getBoundingClientRect();return{onscreen:r.top>=0&&r.left>=0&&r.bottom<=innerHeight&&r.right<=innerWidth,overlap:r.left<q.right&&r.right>q.left&&r.top<q.bottom&&r.bottom>q.top}})()`);assert.equal(arrival.onscreen,true,'Arrival remark remains readable on screen.');assert.equal(arrival.overlap,false,'Arrival remark leaves the objective clear.');reports.push({width,height,mobile,arrival});await shot(`arrival-${width}x${height}-${mobile?'touch':'desktop'}`);
 }
 // Resize an open reader: content remains, sheets are recalculated, controls recover.
 await c('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:false});await load('read');const words=await evaluate(`document.querySelector('.sh-sheet-flow').textContent`);await c('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await pause(150);assert.equal(await evaluate(`document.querySelector('.sh-sheet-flow').textContent`),words,'Viewport changes preserve every word.');assert.deepEqual((await layout()).cuts,[],'Resized reader has no clipped lines.');
 await writeFile(join(output,'results.json'),JSON.stringify({passed:true,reports},null,2));console.log(`PASS ${reports.length} rendered paper/Morse layouts; page turns, long prose, source details, choices, journal state, save/reset cancellation and input recovery. Captures: ${output}`);
}finally{ws?.close();browser.kill();vite?.kill()}
