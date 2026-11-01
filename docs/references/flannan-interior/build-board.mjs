import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import jpeg from 'jpeg-js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(dir, 'references.json'), 'utf8'));
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const manifest = data.images.map(ref => {
  const bytes = fs.readFileSync(path.join(dir, ref.file));
  const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: false });
  return { file: ref.file, bytes: bytes.length, width: decoded.width, height: decoded.height, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
});
fs.writeFileSync(path.join(dir, 'file-manifest.json'), JSON.stringify({ checked: data.prepared, files: manifest }, null, 2) + '\n');

const card = (ref, index) => {
  const info = manifest.find(item => item.file === ref.file);
  return `<article class="card ${esc(ref.kind)}">
  <a class="image-link" href="${esc(ref.file)}" aria-label="Open full image: ${esc(ref.title)}"><img src="${esc(ref.file)}" width="${info.width}" height="${info.height}" alt="${esc(ref.observed)}"></a>
  <div class="caption"><p class="eyebrow">${String(index + 1).padStart(2, '0')} · ${esc(ref.date)}</p><h3>${esc(ref.title)}</h3>
  <p>${esc(ref.observed)}</p><p><b>Use:</b> ${esc(ref.use)}</p><p class="later"><b>Period boundary:</b> ${esc(ref.exclude)}</p>
  <details><summary>Source, date and confidence</summary><p>${esc(ref.dateNote)}</p><p>${esc(ref.reportedAttribution)}</p><p>${esc(ref.confidence)}</p>
  <p><a href="${esc(ref.sourcePage)}" target="_blank" rel="noopener">Source page</a>${ref.downloadUrl ? ` · <a href="${esc(ref.downloadUrl)}" target="_blank" rel="noopener">Downloaded image</a>` : ''}</p>
  <p class="file-info">${info.width} × ${info.height} · ${esc(ref.file)}<br>Original pixels retained; click the photograph to inspect the full file.</p></details></div></article>`;
};
const group = kind => data.images.map((ref, i) => ref.kind === kind ? card(ref, i) : '').join('\n');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(data.title)} — source board</title>
<style>
:root{color-scheme:light;--paper:#f5f1e8;--ink:#222c2e;--muted:#586365;--line:#cfc9ba;--accent:#365b60}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:17px/1.6 Georgia,serif}a{color:var(--accent);text-underline-offset:3px}a:hover{color:#152f34}a:focus-visible,summary:focus-visible{outline:3px solid #bd713a;outline-offset:5px}main{max-width:1360px;margin:auto;padding:46px 40px 70px}.eyebrow{font:12px/1.5 system-ui,sans-serif;letter-spacing:.11em;text-transform:uppercase;color:var(--muted);margin:0 0 9px}h1{font-size:clamp(36px,5vw,66px);font-weight:400;line-height:1.08;margin:10px 0 20px;letter-spacing:-.03em}h2{font-size:32px;font-weight:400;line-height:1.2;margin:42px 0 10px}h3{font-size:25px;font-weight:400;line-height:1.3;margin:0 0 14px}p{margin:0 0 14px}.lead{max-width:840px;font-size:21px}.boundary{border-left:4px solid #a2703e;background:#eee7d9;padding:17px 24px;margin:25px 0 30px;max-width:1080px}.boundary p:last-child{margin-bottom:0}.nav{display:flex;flex-wrap:wrap;gap:20px;margin:20px 0 34px;font:14px system-ui,sans-serif}.section-intro{max-width:880px;color:var(--muted);margin-bottom:25px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px}.card{background:#fffdf7;border:1px solid var(--line);min-width:0}.image-link{display:flex;justify-content:center;align-items:center;background:#dedbd2;padding:16px;min-height:250px}.image-link img{display:block;max-width:100%;width:auto;height:auto;max-height:600px;object-fit:contain}.caption{padding:24px}.caption p{font-size:16px}.caption b{font-weight:600}.later{border-left:2px solid #b89973;padding-left:13px}.file-info{font:12px/1.7 system-ui,sans-serif!important;overflow-wrap:anywhere;color:var(--muted)}details{border-top:1px solid var(--line);padding-top:12px;margin-top:18px}summary{cursor:pointer;font:14px/1.5 system-ui,sans-serif;color:var(--accent);margin-bottom:12px}.drawing .image-link{min-height:0}.optic{display:grid;grid-template-columns:minmax(280px,1fr) minmax(280px,1fr)}.optic .image-link img{max-height:780px}.sources{max-width:980px;border-top:1px solid var(--line);padding-top:10px}.sources li{padding-left:5px;margin-bottom:18px}.sources p{font-size:15px;color:var(--muted);margin-top:3px}.directions{max-width:1000px;padding:22px 28px;border:1px solid var(--line);background:#e8ece6;margin-top:30px}.directions h2{margin-top:0;font-size:27px}footer{font:13px/1.7 system-ui,sans-serif;color:var(--muted);border-top:1px solid var(--line);padding-top:22px;margin-top:40px}@media(max-width:760px){main{padding:30px 18px 40px}.grid{grid-template-columns:1fr}.optic{display:block}.caption{padding:20px}.lead{font-size:19px}.image-link{padding:10px}.boundary{padding:14px 18px}}@media print{details{display:block}details>*{display:block}a{color:inherit}.card{break-inside:avoid}.grid{display:block}.card{margin-bottom:24px}main{padding:10px}}
</style></head><body><main>
<header><p class="eyebrow">Seven Hunters · Eilean Mor · Reference study · 7 October 2026</p><h1>The real Flannan interior</h1><p class="lead">The occupied station, original lantern drawings and the first optic. A factual starting point for the 1901 interior pass.</p>
<div class="boundary"><p><strong>Read the dates before borrowing details.</strong> ${esc(data.dateBoundary)}</p><p>All seven images retain their original pixels. The room photos contain later electrical equipment, glass blocks and modern furniture.</p></div>
<nav class="nav" aria-label="Reference sections"><a href="#rooms">Actual rooms</a><a href="#lantern">Original lantern drawings</a><a href="#optic">Original optic</a><a href="#sources">Sources &amp; archive gap</a><a href="README.md">Full notes</a></nav></header>
<section id="rooms"><h2>Rooms during later occupation</h2><p class="section-intro">Four historical photographs identified as the Flannan interior. Two broad room views and two smaller colour reproductions. Exact 1901 finishes and room assignments remain unresolved.</p><div class="grid">${group('room')}</div></section>
<section id="lantern"><h2>The designed lantern</h2><p class="section-intro">Two original engineering-sheet reproductions, explicitly titled for Flannan. These supply construction relationships, while the archive master is needed for uncertain dates, accession numbers and measurements.</p><div class="grid">${group('drawing')}</div></section>
<section id="optic"><h2>The original light</h2><p class="section-intro">The museum-attributed optic reference from the project's earlier research, retained here alongside the newly gathered room evidence.</p>${group('optic')}</section>
<section class="directions"><h2>What changes in our approach</h2><p>Start with the real room construction: substantial window reveals, timber work, practical shared furniture and a maintained station. The earlier generated kitchen remains an atmospheric study.</p><p>Use period reports for the working objects and original apparatus references for the lantern. Keep the interior preview separate until day and night comparisons are ready.</p></section>
<section id="sources" class="sources"><h2>Sources and the remaining archive gap</h2><p>The kitchen / bedroom / coal-cellar sheet has been identified in the HES catalogue, but its full drawing has not been obtained. Exact domestic geometry will remain labelled as reconstruction until that sheet can be read.</p><ol>${data.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a><p>${esc(s.role)}</p></li>`).join('')}</ol></section>
<footer>${esc(data.scope)} Source photographs retain their original rights and credits. References are local study material, separate from game assets.<br><a href="references.json">Image provenance</a> · <a href="file-manifest.json">File dimensions &amp; hashes</a> · <a href="README.md">Research notes</a></footer>
</main></body></html>`;
fs.writeFileSync(path.join(dir, 'index.html'), html);
console.log(JSON.stringify({ images: manifest.length, files: manifest.map(({ file, width, height }) => ({ file, width, height })), board: path.join(dir, 'index.html') }, null, 2));
