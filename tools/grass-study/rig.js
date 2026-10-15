// The shared scene belongs only to this study. No game, story, or save imports.
export const ROCKS = [[-1.65, -0.8, 0.56], [1.65, 1.05, 0.32], [-2.5, 2.15, 0.23]];
export const heightAt = (x, z) => 0.055 + 0.13 * Math.exp(-((x + 1.4) ** 2 + (z - 0.4) ** 2) / 5) + 0.025 * Math.sin(x * 1.3) * Math.cos(z * 1.1);
export const growsAt = (x, z) => x * x + z * z < 17.8 && !ROCKS.some(([rx, rz, r]) => Math.hypot(x - rx, z - rz) < r * 1.05);
export function random(seed = 1901) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const winter = { dark: '#555e36', light: '#9b9d65', surround: '#7b8051', wornEarth: '#958468', sunGlow: '#cbbb85' };
export const green = { dark: '#496338', light: '#91aa57', surround: '#6f8b49', wornEarth: '#958468', sunGlow: '#d8cb80' };
export function report(message, error = false) {
  parent.postMessage({ type: error ? 'grass-study-error' : 'grass-study-ready', ...(error ? { message } : { backend: message }) }, location.origin);
  if (error) document.getElementById('failure').textContent = message;
}
export function makeRig(THREE, renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9eaeaa');
  scene.fog = new THREE.Fog('#9eaeaa', 14, 90);
  const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.03, 200);
  const legacy = parseInt(THREE.REVISION, 10) < 150;
  const ambient = new THREE.HemisphereLight('#dce8df', '#4b4b32', legacy ? .65 : 1.8); scene.add(ambient);
  const sun = new THREE.DirectionalLight('#ffe1ad', legacy ? .8 : 2.1); sun.position.set(-5, 6, -6); scene.add(sun);
  // Identical procedural substrate and rock layout in both implementations.
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d'), pixels = ctx.createImageData(256, 256), rng = random(71);
  for (let i = 0; i < 256 * 256; i++) {
    const n = rng(), mottled = Math.sin((i % 256) * .06) * Math.cos(Math.floor(i / 256) * .07) * 7;
    pixels.data.set([64 + n * 30 + mottled, 70 + n * 26 + mottled, 39 + n * 23, 255], i * 4);
  }
  ctx.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(3, 3);
  if ('colorSpace' in texture) texture.colorSpace = THREE.SRGBColorSpace;
  const GroundGeometry = THREE.PlaneBufferGeometry ?? THREE.PlaneGeometry;
  const groundGeo = new GroundGeometry(10, 10, 70, 70); groundGeo.rotateX(-Math.PI / 2);
  const pos = groundGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  groundGeo.computeVertexNormals();
  scene.add(new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ map: texture, roughness: 1 })));
  const base = new THREE.Mesh(new THREE.BoxGeometry(10, .22, 10), new THREE.MeshStandardMaterial({ color: '#3c4339', roughness: 1 })); base.position.y = -.105; scene.add(base);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ color: '#708f91', roughness: .42, metalness: .15 })); water.rotation.x = -Math.PI / 2; water.position.y = -.24; scene.add(water);
  for (const [x, z, radius] of ROCKS) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 0), new THREE.MeshStandardMaterial({ color: '#777b73', roughness: 1, flatShading: true }));
    rock.position.set(x, heightAt(x, z) + radius * .32, z); rock.scale.set(1.2, .7, .85); rock.rotation.set(.2, x, .1); scene.add(rock);
  }
  // One metre scale, with no font/texture dependencies.
  const marker = new THREE.Group();
  for (let i = 0; i < 4; i++) { const segment = new THREE.Mesh(new THREE.BoxGeometry(.25, .026, .075), new THREE.MeshStandardMaterial({ color: i % 2 ? '#dedcc3' : '#34483e', roughness: 1 })); segment.position.set(-.375 + i * .25, 0, 0); marker.add(segment); }
  marker.position.set(1.5, heightAt(1.5, 3.2) + .025, 3.2); scene.add(marker);
  const walker = new THREE.Mesh(new THREE.SphereGeometry(.13, 16, 12), new THREE.MeshStandardMaterial({ color: '#eee2bd', roughness: .8 })); walker.scale.set(.7, 1.65, .7); walker.visible = false; scene.add(walker);
  let azimuth = .55, elevation = .34, distance = 9.5, dragging = false, px = 0, py = 0, close = false;
  const target = new THREE.Vector3(0, .12, 0), screen = renderer.domElement;
  function positionCamera() { camera.position.set(target.x + Math.sin(azimuth) * Math.cos(elevation) * distance, target.y + Math.sin(elevation) * distance, target.z + Math.cos(azimuth) * Math.cos(elevation) * distance); camera.lookAt(target); }
  screen.addEventListener('pointerdown', (event) => { dragging = true; px = event.clientX; py = event.clientY; screen.setPointerCapture(event.pointerId); screen.style.cursor = 'grabbing'; });
  screen.addEventListener('pointermove', (event) => { if (!dragging) return; azimuth -= (event.clientX - px) * .006; elevation = Math.max(.09, Math.min(1.25, elevation + (event.clientY - py) * .004)); px = event.clientX; py = event.clientY; positionCamera(); });
  screen.addEventListener('pointerup', () => { dragging = false; screen.style.cursor = 'grab'; });
  screen.addEventListener('pointercancel', () => { dragging = false; });
  screen.addEventListener('wheel', (event) => { event.preventDefault(); distance = Math.max(1.3, Math.min(16, distance * Math.exp(event.deltaY * .001))); positionCamera(); }, { passive: false });
  function setClose(value) { if (value === close) return; close = value; azimuth = .55; elevation = close ? .17 : .34; distance = close ? 3.2 : 9.5; target.set(0, close ? .18 : .12, 0); positionCamera(); }
  function resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); renderer.setSize(innerWidth, innerHeight); }
  addEventListener('resize', resize); resize(); positionCamera();
  return { scene, camera, walker, setClose };
}
export function onSettings(callback) { addEventListener('message', (event) => { if (event.origin === location.origin && event.source === parent && event.data.type === 'grass-study-settings') callback(event.data); }); }
