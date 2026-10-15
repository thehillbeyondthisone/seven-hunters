import * as THREE from 'three/webgpu';
import { time } from 'three/tsl';
// Direct upstream implementation: these files are not reimplementations.
import { generateScatter, encodeScatter, decodeTufts, groupFromManifest, createGrassLayer, createInteractionField, FIELD_GRASS_PRESET } from '../../.local/grass-study/field-grass/src/index.ts';
import { makeRig, heightAt, growsAt, winter, green, report, onSettings } from './rig.js';

try {
  const renderer = new THREE.WebGPURenderer({ canvas: document.querySelector('canvas'), antialias: true });
  await renderer.init();
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
  const rig = makeRig(THREE, renderer);
  const recipe = { seed: 1901, groups: [{ id: 'coast', count: 6200, bounds: { minX: -4.3, maxX: 4.3, minZ: -4.3, maxZ: 4.3 }, heightMin: .65, heightMax: 1.2 }] };
  const generated = generateScatter(recipe, (x, z) => ({ y: heightAt(x, z), accept: growsAt(x, z), vigour: .65 + .3 * Math.abs(Math.sin(x * 1.4 + z)) }));
  const baked = encodeScatter('tools/grass-study/field.js', recipe, generated);
  const buffers = decodeTufts(baked.bytes, baked.manifest, groupFromManifest(baked.manifest, 'coast'));
  const interaction = createInteractionField({ minX: -5, maxX: 5, minZ: -5, maxZ: 5, cellSize: .12, maxBodies: 1, strength: .11, ghostsPerBody: 16, minGhostDistance: .12, maxAge: 1.8, footprints: [{ halfLength: .3, halfWidth: .16, falloff: .68 }, { halfLength: .3, halfWidth: .16, falloff: .68 }] });
  let settings = { height: .18, wind: 1, palette: 'winter', paused: false }, grass, walkStart = -100, elapsed = 0;
  // Public TSL update hook: use this study's clock so Pause freezes shader wind too.
  time.onRenderUpdate(() => elapsed);
  function rebuild() {
    grass?.dispose();
    grass = createGrassLayer(buffers, {
      interaction,
      shape: { ...FIELD_GRASS_PRESET.shape, height: settings.height, halfWidth: .007, clumpRadius: .07 },
      palette: settings.palette === 'winter' ? winter : green,
      style: { ...FIELD_GRASS_PRESET.style, windSpeed: 3.8 * settings.wind, windReach: settings.height * .45 * settings.wind, flutterAmplitude: settings.height * .025 * settings.wind, tipGold: .10, tintMin: .88, tintMax: 1.12 },
      sunDirection: new THREE.Vector3(-.6, .5, -.5).normalize(),
    });
    rig.scene.add(grass.mesh);
  }
  rebuild();
  onSettings((next) => {
    const changed = next.height !== settings.height || next.wind !== settings.wind || next.palette !== settings.palette;
    settings = { ...settings, ...next }; rig.setClose(next.close);
    if (changed) rebuild();
    if (next.walk) { walkStart = elapsed; interaction.reset(); }
  });
  let previous = performance.now();
  renderer.setAnimationLoop((now) => {
    now = Number.isFinite(now) ? now : performance.now();
    const dt = Math.min((now - previous) / 1000, .05); previous = now;
    if (!settings.paused) {
      elapsed += dt;
      const progress = (elapsed - walkStart) / 6;
      rig.walker.visible = progress >= 0 && progress <= 1;
      const x = -2.7 + progress * 5.4, z = .5 * Math.sin(progress * Math.PI * 2);
      if (rig.walker.visible) rig.walker.position.set(x, heightAt(x, z) + .22, z);
      interaction.update(dt, rig.walker.visible ? [{ slot: 0, x, z, heading: Math.atan2(.5 * Math.cos(progress * Math.PI * 2), 5.4 / (2 * Math.PI)) }] : []);
    }
    renderer.render(rig.scene, rig.camera);
  });
  report(renderer.backend.isWebGPUBackend ? 'WebGPU · 43,400 blades' : 'WebGL2 fallback · 43,400 blades');
} catch (error) { console.error(error); report(`This preview could not start: ${error.message}`, true); }
