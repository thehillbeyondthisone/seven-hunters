# Grass source studies

Terra was selected on 9 October 2026 and adapted into the native game renderer. See [the photo comparison and integration notes](../../docs/MARITIME-TURF.md). The original source plots below remain isolated studies; `/grass-preview.html` now compares the adopted turf with the previous grass in the game world.

Run **start-grass-study.bat**, then open http://127.0.0.1:5192/tools/grass-study/.
The launcher opens the browser. First run downloads the two public source repositories and Three.js into the ignored `.local/grass-study` folder. The game dependency manifest, normal launch route, scene, and saves are untouched. Nothing is committed automatically.

## What is running

1. [Three.js Field Grass](https://github.com/matthew-kissinger/threejs-field-grass), Matthew Kissinger, MIT, revision `2a0d3a3256dc8d8f6d9de68f3dc1636a621559c5`. Direct imports of `generateScatter`, `encodeScatter`, `decodeTufts`, `createGrassLayer`, and `createInteractionField` from the upstream source. Three.js 0.185.1 / WebGPURenderer. Upstream clumps, TSL lighting, wind, and wake are retained. The test supplies narrow 18 cm blades, shorter interaction reach, winter colours, and a deterministic 6,200-tuft scatter. It remains a stylized material, not a physically based botanical model.
2. [Terra](https://github.com/spacejack/terra), Mike Linkovich, revision `ed8d04dfc52874fbd1489ac7a39638092619a618`. Direct imports of `src/grass.ts`, its math dependencies, and `public/shader/grass.{vert,frag}.glsl`. These grass/shader/math files are individually marked MIT; simplex noise is public domain. The overall repository is CC BY-NC 4.0. Original Three.js r93 is served locally in a separate iframe. No original artwork/audio is used. The harness supplies a procedural blade texture and height/light map, narrows/shortens the generated shape buffer, and excludes rocks. Wind and lighting are upstream GLSL. There is no contact interaction in this example.
3. [Grassworks](https://grassworks.techredux.co/demo), official running demo only. The user has no licensed source copy. It is not downloaded, reproduced, or bundled. Try **Sheep Fescue**, a shorter Grass Height, and **Wind**. This is not the identical camera/scene comparison used for the first two.

`field.js` and `terra.js` are the small integration examples. `rig.js` is the shared scene. No upstream grass algorithm was substituted with an imitation. Wind presets are qualitative controls, not equivalent physical wind speeds between shaders. Both local plots allocate 43,400 blades; Terra collapses blades outside the plot and rocks. Their topology, renderer, and lighting costs differ; this is a visual study, not a main-game benchmark.

## Historical boundary

Fine, short maritime turf, irregular clumps, rocky exclusions, olive winter foliage, and straw tones are proposed art direction for January on Eilean Mòr. They are not a species identification or measured reconstruction of the island in 1901. These procedural blades have no species identity. The Grassworks Sheep Fescue preset is an aesthetic comparison, not evidence of its historical presence.

## Integration boundary

The main game uses its own native WebGPU engine. Neither Three.js sample is a drop-in production integration. Field Grass would need a deliberate WGSL/geometry port or renderer boundary; Terra's MIT grass files could inform a native implementation, while other CC BY-NC assets remain excluded. Grassworks needs licensed source before any local implementation. No whole-island replacement is included in this study.

## Checked locally, 9 October 2026

- `node tools/grass-study/setup.mjs` verifies both pinned source revisions and the isolated dependency setup; repeat launch succeeds without reinstalling.
- `node --check` passes for the study JS/MJS modules.
- Browser: Field Grass rendered through WebGPU; Terra rendered through its original WebGL runtime. Height, wind, colour, close/whole-patch switching, and the Field Grass walk marker were exercised. Switching projects retains the selected controls and unloads the other renderer.
- Pause: two successive native browser captures were byte-identical for each paused local renderer. Both can resume through the named control. The general full-page screenshot API resized its offscreen capture, so that API was excluded from the pause comparison.
- Grassworks' official demo loaded and ran with Sheep Fescue, Wind Strength 1.3, and Grass Height clamped by its UI to 0.5. Reducing height leaves width unchanged; this preset therefore needs further shape control to become fine, short coastal turf. Its scene is not a historical reference.
- Screenshots are in `artifacts/grass-study/field-grass.jpg`, `terra.jpg`, and `grassworks-official.jpg`. No mobile-device, whole-island performance, or production integration claim is made.
