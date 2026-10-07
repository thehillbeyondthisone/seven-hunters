import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CALL, SIGNAL_UI, WATCHER } from '../../src/story/Script.js';
import { EPISODES } from '../../src/story/NextScript.js';

// An offline reading copy of the actual scripts. It uses no game save or browser storage.
const watches = { 1: WATCHER, ...EPISODES };
const words = text => text.trim().split( /\s+/ ).length;
let paths = 0;
for ( const [ day, script ] of Object.entries( watches ) ) {
	const walk = ( id, seen = [] ) => {
		const node = script.nodes[ id ];
		if ( ! node || seen.includes( id ) ) throw new Error( `Broken dialogue at ${ day }/${ id }` );
		if ( words( node.her ) > 15 || node.end && /(?:^| )K$/.test( node.her ) ) throw new Error( `Signal needs review: ${ day }/${ id }` );
		if ( node.end ) return 1;
		return node.options.reduce( ( count, option ) => count + walk( option.next, [ ...seen, id ] ), 0 );
	};
	paths += walk( script.start );
}
const incoming = Object.values( watches ).flatMap( script => Object.values( script.nodes ) );
const maximum = Math.max( ...incoming.map( node => words( node.her ) ) );
const data = JSON.stringify( { watches, call: CALL, callHint: SIGNAL_UI.callHint } ).replace( /</g, '\\u003c' );
const html = `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Seven Hunters · The revised signals</title>
<style>
:root{color-scheme:dark;--paper:#eee4cf;--muted:#bac0ba;--gold:#d4b684;--line:#43504c;--panel:#1b2928}*{box-sizing:border-box}body{margin:0;background:#111d1e;color:var(--paper);font:16px/1.6 system-ui,sans-serif}main{max-width:860px;margin:auto;padding:48px 24px}h1,h2,.signal{font-family:Georgia,serif;font-weight:400}h1{font-size:clamp(34px,6vw,56px);line-height:1.1;margin:10px 0 20px}h2{font-size:28px}.eyebrow,.speaker{font:12px/1.5 system-ui;text-transform:uppercase;letter-spacing:.14em;color:var(--gold)}p{margin:8px 0 20px}.lead,.note,small{color:var(--muted)}nav{display:flex;gap:8px;flex-wrap:wrap;margin:28px 0}button{font:inherit;cursor:pointer;color:var(--paper);background:var(--panel);border:1px solid var(--line);border-radius:4px;padding:10px 16px}button:hover,button:focus-visible{border-color:var(--gold)}button[aria-pressed=true]{background:var(--paper);color:#202b28}article{padding:20px 24px;margin:16px 0;background:var(--panel);border-left:2px solid var(--gold)}article.sent{margin-left:36px;border-left-color:var(--line);background:transparent}.signal{font-size:22px;line-height:1.5;margin:8px 0;overflow-wrap:anywhere}.translation{font-style:italic;color:var(--muted)}#replies{display:grid;gap:10px;margin:24px 0}#replies button{text-align:left}.label{display:block}.cost{display:block;font-size:13px;color:var(--muted);margin-top:3px}.note{font-size:14px}.restart{background:transparent;color:var(--gold)}details{margin-top:40px;padding-top:22px;border-top:1px solid var(--line)}summary{cursor:pointer;color:var(--gold)}details section{margin:24px 0}details .signal{font-size:18px}details ul{padding-left:20px;color:var(--muted)}footer{margin-top:40px;padding-top:20px;border-top:1px solid var(--line);font-size:14px;color:var(--muted)}@media(max-width:480px){main{padding:28px 18px}article{padding:16px}article.sent{margin-left:18px}.signal{font-size:20px}}
</style><main>
<div class="eyebrow">Seven Hunters · Dialogue review · Contains spoilers</div>
<h1>A light across the water.</h1>
<p class="lead">The revised conversations, 3–6 January 1901. Choose Walter's replies to read each exchange. These are the words now in the game.</p>
<p class="note">${ incoming.length } incoming messages · longest ${ maximum } words. The lamp link and numbered groups are intentional fiction.</p>
<nav aria-label="Choose a watch">${ Object.keys( watches ).map( day => `<button data-day="${ day }" aria-pressed="${ day === '1' }">${ Number( day ) + 2 } January</button>` ).join( '' ) }</nav>
<h2 id="watch-title"></h2><div id="conversation" aria-live="polite"></div><div id="replies"></div><p id="ending" class="note"></p>
<button id="restart" class="restart">Read this watch again</button>
<details><summary>Read every line, including alternate replies</summary><div id="all-lines"></div></details>
<footer>Mary's letter, the lightkeeping duties and the story's evidence remain the foundation. K invites an answer; a goodbye closes the conversation. Historical ball or disc signals are a possible later addition.</footer>
</main><script type="application/json" id="dialogue-data">${ data }</script><script>
const data=JSON.parse(document.getElementById('dialogue-data').textContent);
const $=id=>document.getElementById(id);
let day='1', node, history=[];
function message(from,text,translation=''){
 const article=document.createElement('article');if(from==='Walter')article.className='sent';
 const speaker=document.createElement('div');speaker.className='speaker';speaker.textContent=from;
 const signal=document.createElement('p');signal.className='signal';signal.textContent=text;
 article.append(speaker,signal);
 if(translation){const p=document.createElement('p');p.className='translation';p.textContent=translation;article.append(p)}
 return article;
}
function render(){
 const current=data.watches[day].nodes[node];
 $('watch-title').textContent=(Number(day)+2)+' January · The evening watch';
 $('conversation').replaceChildren();
 if(day==='1'){$('conversation').append(message('The call',data.call));const p=document.createElement('p');p.className='note';p.textContent=data.callHint;$('conversation').append(p)}
 for(const exchange of history)$('conversation').append(message('Gallan Head',exchange.her,exchange.translation),message('Walter',exchange.reply));
 $('conversation').append(message('Gallan Head',current.her,current.translation));
 $('replies').replaceChildren();$('ending').textContent=current.end?'The exchange is complete.':'';
 for(const option of current.options||[]){
  const b=document.createElement('button'),label=document.createElement('span'),cost=document.createElement('span');
  label.className='label';label.textContent=option.text;cost.className='cost';cost.textContent=(option.code?'Station signal '+option.code:'Spelled out')+' · about '+option.minutes+(option.minutes===1?' minute':' minutes');b.append(label,cost);
  b.addEventListener('click',()=>{history.push({her:current.her,translation:current.translation,reply:option.text});node=option.next;render()});$('replies').append(b);
 }
 document.querySelectorAll('[data-day]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.day===day));
}
function start(which){day=which;node=data.watches[day].start;history=[];render()}
document.querySelectorAll('[data-day]').forEach(b=>b.addEventListener('click',()=>start(b.dataset.day)));
$('restart').addEventListener('click',()=>start(day));
for(const [which,script] of Object.entries(data.watches)){
 const section=document.createElement('section'),heading=document.createElement('h2');heading.textContent=(Number(which)+2)+' January';section.append(heading);
 for(const current of Object.values(script.nodes)){
  section.append(message('Gallan Head',current.her,current.translation));
  if(current.options){const ul=document.createElement('ul');for(const o of current.options){const li=document.createElement('li');li.textContent=o.text;ul.append(li)}section.append(ul)}
 }
 $('all-lines').append(section);
}
start('1');
</script></html>`;
const directory = new URL( '../../artifacts/language-pass/', import.meta.url );
mkdirSync( directory, { recursive: true } );
const output = new URL( 'index.html', directory );
writeFileSync( output, html );
console.log( `${ incoming.length } transmissions, longest ${ maximum } words, ${ paths } complete choice paths.` );
console.log( fileURLToPath( output ) );
