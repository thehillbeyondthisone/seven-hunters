const $ = (id) => document.getElementById(id);
const projects = {
  field: { title: 'Three.js Field Grass', desc: 'Seven-blade clumps, layered gusts, and a footprint wake that settles back into the wind.', note: 'Watch the pale marker part the grass and leave a short recovering wake.', source: 'https://github.com/matthew-kissinger/threejs-field-grass', license: 'Matthew Kissinger · MIT · source preview 0.1.0' },
  terra: { title: 'Terra', desc: 'Individual curved blades with translucent sunlight, ground light sampling, and a moving wind field.', note: 'The original code has no footprint wake. Watch the fine blade silhouettes and wind instead.', source: 'https://github.com/spacejack/terra', license: 'Mike Linkovich · MIT grass files / CC BY-NC project' },
};
let project = 'field', ready = false;
const settings = { height: 0.18, wind: 1, palette: 'winter', close: false, paused: matchMedia('(prefers-reduced-motion: reduce)').matches };
function send(extra = {}) { if (ready) $('plot').contentWindow.postMessage({ type: 'grass-study-settings', ...settings, ...extra }, location.origin); }
function refreshButtons() { $('pause').textContent = settings.paused ? 'Resume motion' : 'Pause motion'; $('view').textContent = settings.close ? 'Whole patch' : 'Closer view'; }
document.querySelectorAll('[data-project]').forEach((button) => button.addEventListener('click', () => {
  if (project === button.dataset.project) return;
  project = button.dataset.project; ready = false;
  document.body.dataset.project = project;
  document.querySelectorAll('[data-project]').forEach((item) => { item.classList.toggle('selected', item === button); item.setAttribute('aria-pressed', String(item === button)); });
  document.querySelector('.comparison').hidden = project === 'grassworks'; $('commercial').hidden = project !== 'grassworks';
  // Unload the previous renderer rather than run two GPU previews in the background.
  $('plot').src = project === 'grassworks' ? 'about:blank' : `./${project}.html`;
  if (!projects[project]) return;
  const info = projects[project]; $('project-title').textContent = info.title; $('project-desc').textContent = info.desc; $('feature-note').textContent = info.note;
  $('source').href = info.source; $('license').textContent = info.license; $('walk').disabled = project !== 'field';
  $('plot').title = `Interactive ${info.title} test plot`; $('engine-status').textContent = 'Preparing the patch…';
  $('plot-label').textContent = `${project === 'field' ? 'FIELD GRASS' : 'TERRA'} / WINTER COAST`;
}));
window.addEventListener('message', (event) => {
  if (event.origin !== location.origin || event.source !== $('plot').contentWindow) return;
  if (event.data.type === 'grass-study-ready') { ready = true; $('engine-status').textContent = event.data.backend; send(); }
  if (event.data.type === 'grass-study-error') $('engine-status').textContent = event.data.message;
});
$('height').addEventListener('input', () => { settings.height = Number($('height').value) / 100; $('height-label').value = `${$('height').value} cm`; send(); });
$('wind').addEventListener('change', () => { settings.wind = Number($('wind').value); send(); });
$('palette').addEventListener('change', () => { settings.palette = $('palette').value; send(); });
$('view').addEventListener('click', () => { settings.close = !settings.close; refreshButtons(); send(); });
$('pause').addEventListener('click', () => { settings.paused = !settings.paused; refreshButtons(); send(); });
$('walk').addEventListener('click', () => { settings.paused = false; refreshButtons(); send({ walk: true }); });
refreshButtons();
