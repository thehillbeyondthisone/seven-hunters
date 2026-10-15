# Eilean Mòr maritime turf

Terra was selected from the local source studies on 9 October 2026. The main game now uses a native WebGPU adaptation of its curved, tapered grass blades. The original source study remains available at `/tools/grass-study/`; `/grass-preview.html` compares the new turf and previous grass in the actual island scene without creating Story or reading/writing saved watches.

## Reference comparison

| Evidence | What it supports | Boundary |
| --- | --- | --- |
| `reference/Old Photograph Lighthouse Flannan Isles Scotland.JPG` | Close, low, irregular turf in front of the station, with exposed texture rather than a tall meadow silhouette. People provide a broad scale cue. | Supplied monochrome photo; exact date and measured blade height are not established. |
| `reference/zw-lighthouse.jpg` | Open, treeless grass-covered slopes, exposed rock bands and a clearly readable path. The hill reads as a continuous low surface. | Undated monochrome view, not evidence of January colour. |
| `reference/FLANNAN.jpg` | Short, rough ground around the keepers and station; no tall ornamental heads or flowering meadow. | Tinted postcard; tint is not a reliable historical foliage palette. |
| [NatureScot Flannan Isles SPA citation, September 2009](https://www.nature.scot/sites/default/files/special-protection-area/8502/spa-citation.pdf) | Identifies the islands' vegetation as predominantly maritime grassland. | Modern habitat context, not a 1901 plant survey. |

The adaptation is credible in *form*: fine short leaves, a low wind-combed silhouette, continuous turf broken by rock and worn paths. The unbent nominal blades are 6.5–18 cm; local growth variation makes them roughly 5–20 cm before bending. These dimensions, the olive/green/straw winter palette, and procedural density patterns are art reconstruction choices. No species identification, exact historical grazing height, or measured 1901 winter colour is claimed. No flowers, ornamental seed heads, trees or tropical vegetation were added.

## Implementation and scope

- `src/world/flannan/Sward.js` retains the same constructor/update interface used by App. It adapts Terra's cubic taper, increasing lean/curve and height-dependent wind into native WGSL. The game's existing sun, moon, shadows, fog and local lights shade the leaves. Previous-frame blade positions include wind and density changes for temporal reconstruction.
- Three reusable 8 m patch geometries share seeded, shuffled roots. Each lower detail level is a prefix of the same roots; cells stay anchored to the island. Distance thinning completes before each cell changes detail. Coverage falls smoothly to zero between 32 and 48 m. Three instanced draws replace whole-island blade meshes.
- Nearby nominal density is 640 blades/m², reduced by the terrain mask and distance. The full terrain domain is eligible; there is no rectangular grass-field boundary on the island.
- The mask excludes water, steep cliff faces, bare rock, building footprints and paths. A conservative 1.05 m mask margin accounts for 1 m terrain sampling and interpolation. The old implementation compared the floating-point rock mask (0–1) against 100; that ineffective exclusion is corrected.
- No save format, progression, story, input or architecture changes are needed. The turf is environmental dressing throughout play, not limited to the first night. `?grass=legacy` retains the old grass for a bounded visual fallback. The review page can toggle both without moving the camera or advancing a paused scene.
- Only the individually MIT-marked Terra grass code informs the adaptation. No noncommercial Terra artwork/audio, Three.js dependency, Field Grass code or Grassworks assets enter the game. See [source attribution](licenses/terra-grass.txt).

## Verification

`node test/flannan-sward.mjs` checks seeded roots, valid topology, finite attributes, shared LOD prefixes, height bounds, sea/rock/slope/path/building exclusions, cell traversal, instance capacity and disposal. `node test/flannan.mjs` checks the real island/station geometry and routes. `npm run build` checks production bundling.

`node tools/shots/sward.mjs` renders matched walking-height, path, turf and station views in the real native game, plus night views and a 100-frame camera traversal. It writes `artifacts/terra-integration/render-report.json`, including GPU validation errors and a bounded before/after benchmark at 1280×720 (12 warm-up + 36 measured frames per view). This is local desktop evidence; it does not establish mobile/VR or long-session performance. Browser screenshots and the live comparison complement the automated renders.

The final native run passed with **zero GPU validation errors**. Mean GPU frame time was 5.50 ms at walking height and 5.24 ms in the wider turf view, versus 4.21 / 4.19 ms with the previous grass, an increase of about 1.1–1.3 ms in these bounded desktop samples. The live browser remained at 60 fps in the walking-height view during the check. The reference gallery at `/artifacts/terra-integration/` includes the supplied photographs, matched old/new native renders and the report.
