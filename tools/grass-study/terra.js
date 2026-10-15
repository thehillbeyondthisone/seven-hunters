// Original Terra mesh generation and GLSL; original Three r93 runtime lives in this iframe only.
import * as grass from '../../.local/grass-study/terra/src/grass.ts';
import vertScript from '../../.local/grass-study/terra/public/shader/grass.vert.glsl?raw';
import fragScript from '../../.local/grass-study/terra/public/shader/grass.frag.glsl?raw';
import { makeRig, heightAt, growsAt, random, report, onSettings } from './rig.js';
const THREE = window.THREE;
try {
  const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('canvas'), antialias: true });
  renderer.gammaOutput = true;
  const rig = makeRig(THREE, renderer), size = 256, map = new Uint8Array(size * size * 4), noise = random(1910);
  // Terra's red=height, green=light/wind noise, blue=transition-noise contract.
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const wx = (x / (size - 1) - .5) * 10, wz = -(y / (size - 1) - .5) * 10;
    const n = .72 + .14 * Math.sin(x * .08) * Math.cos(y * .07) + noise() * .08;
    map.set([Math.round(heightAt(wx, wz) * 255), Math.round(n * 255), 128, 255], (y * size + x) * 4);
  }
  const heightMap = new THREE.DataTexture(map, size, size, THREE.RGBAFormat); heightMap.needsUpdate = true; heightMap.minFilter = heightMap.magFilter = THREE.LinearFilter;
  const bladeTexture = new THREE.DataTexture(new Uint8Array([255,255,238,255, 220,223,190,255, 255,255,238,255, 242,242,211,255]), 2, 2, THREE.RGBAFormat); bladeTexture.needsUpdate = true;
  // Isolate upstream Math.random use to a reproducible mesh construction call.
  const originalRandom = Math.random; Math.random = random(1901);
  let mesh;
  try { mesh = grass.createMesh({ numBlades: 43400, radius: 4.3, texture: bladeTexture, vertScript, fragScript, heightMap, heightMapScale: { x: .1, y: .1, z: 1 }, lightDir: { x: -.6, y: .5, z: .5 }, fogColor: { r: .62, g: .68, b: .67 }, fogFar: 90, grassFogFar: 120, grassColor: { r: .55, g: .58, b: .34 }, transitionLow: -.1, transitionHigh: -.01, windIntensity: 1 }); }
  finally { Math.random = originalRandom; }
  mesh.rotation.x = -Math.PI / 2; rig.scene.add(mesh);
  const shape = mesh.geometry.attributes.shape, offsets = mesh.geometry.attributes.offset;
  const originalShape = new Float32Array(shape.array);
  function reshape(height) {
    for (let i = 0; i < shape.count; i++) {
      const x = offsets.getX(i) + (offsets.getX(i) > 0 ? -4.3 : 4.3), y = offsets.getY(i) + (offsets.getY(i) > 0 ? -4.3 : 4.3);
      shape.setX(i, .009 + (originalShape[i * 4] - .15) * .08);
      shape.setY(i, growsAt(x, -y) ? originalShape[i * 4 + 1] * height / 2.7 : 0);
    }
    shape.needsUpdate = true;
  }
  let settings = { height: .18, wind: 1, palette: 'winter', paused: false }, elapsed = 0, previous = performance.now();
  reshape(.18);
  onSettings((next) => {
    if (settings.height !== next.height) reshape(next.height);
    settings = { ...settings, ...next }; rig.setClose(next.close);
    mesh.material.uniforms.windIntensity.value = settings.wind * .65;
    mesh.material.uniforms.grassColor.value = settings.palette === 'winter' ? [.53,.46,.34] : [.38,.58,.25];
  });
  function frame(now) {
    const dt = Math.min((now - previous) / 1000, .05); previous = now; if (!settings.paused) elapsed += dt;
    const direction = new THREE.Vector3(); rig.camera.getWorldDirection(direction);
    grass.update(mesh, elapsed, { x: rig.camera.position.x, y: -rig.camera.position.z, z: rig.camera.position.y }, { x: direction.x, y: -direction.z, z: direction.y }, { x: 0, y: 0 });
    renderer.render(rig.scene, rig.camera); requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame); report('WebGL · 43,400 blades');
} catch (error) { console.error(error); report(`This preview could not start: ${error.message}`, true); }
