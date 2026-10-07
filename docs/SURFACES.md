# Station surfaces

Applied locally on 5 October 2026. Launch `start.bat`, then open the
[before/after board](http://127.0.0.1:5189/artifacts/surface-pass/index.html).
Direct scene routes include `/?nostory&view=dFloor&noAudio`,
`/?nostory&view=dRoomNight&lamp&noAudio` and
`/?nostory&view=stoneBoundary&noAudio`.

## Material response

- Indoor timber: periodic growth rings bend around small knots. Fine grain and
  shallow pores drive the normal; broad wear drives roughness. Board dimensions,
  seams, joinery orientation and existing timber colours remain.
- Limewash: overlapping shallow trowel sweeps, fine lime pores and restrained
  colour variation replace the previous painted-timber relief. Roughness stays
  diffuse (the baked map ranges from approximately 0.83 to 0.98).
- Painted joinery: a separate maintained film carries brush marks and a satin
  roughness response. No large peeling or weathered wood cracks are added.
- Iron: fine casting texture and uneven finish drive normals and roughness on
  the stove, fittings, stairs and rails. The shared hard-material shader enables
  this branch only for the station; its rope/tide/rust handling is retained.
- Stone: fine directional fissures and mineral patches enrich the existing
  unjointed grain maps. Individual stone volumes, joints and mortar geometry
  remain. Stone flags use this grain rather than a jointed masonry normal map.
- Cliffs and boulders: reuse the same stone normal/roughness map with world-space
  triplanar projection. Fine normals fade at distance; roughness decreases near
  the wet shoreline. Terrain and rock silhouettes remain.

These are artistic material reconstructions. Exact 1901 grain, microstructure,
wear and paint finish are unverified. No source photograph became a runtime
texture. Lighting, layouts, geometry, collisions, story and save logic were
preserved. Tidewater retains its existing material branch and texture sets.

## Maps and cost

`StationTextureFields.js` supplies four optional periodic WGSL generators to
`VillageTextures`. Height/roughness fields bake once on the GPU. Sobel normals
and ambient occlusion share a linear RGBA8 map: RG stores normal XY, B roughness,
A occlusion. Maps have full mip chains and use repeat/anisotropic sampling.
Colour/mask fields carry no painted lighting.

New station maps add approximately **10.67 MiB** of mipmapped texture memory.
The stone grain set already existed; changing and sharing it adds no new stone
map allocation. Cliffs sample the shared map on three projection planes. No new
geometry or material draw ranges were introduced. Sustained desktop, phone and
physical headset performance has not been measured.

Readback exports in `artifacts/surface-pass/maps/` include conventional RGB
normal previews, greyscale roughness previews and exact packed runtime data.
`map-audit.json` records ranges, variation and tile-boundary statistics.

## Validation and reproduction

```powershell
npm run test:surfaces
npm test
node test/stone-masonry.mjs
npm run build
node artifacts/surface-pass/review.mjs after
git diff --check
```

The map tests execute the real GPU bake and read back all five normal/roughness
sets. They check valid normal vectors, useful bounded roughness, repeat-boundary
continuity, mipmap mean preservation, registration idempotence and allocation
budget. They passed with no GPU errors.

`npm test` passed its game logic, Flannan geometry, walking route, complete
story/continuation, objective guidance, WebGPU smoke and mobile input suites.
The production build and fitted-stone geometry checks passed. The existing Vite
dynamic-import warning for `LocalLights.js` remains.

Twelve matched before/after renders were captured at 1200 × 800 with seeded
simulation, adapted exposure, 32 settling frames and the same cameras/times.
Daylight timber, night room, door, staircase, stone boundary and cliff renders
were inspected. The current scene and review page also loaded in an isolated
Chrome session: no page, console or GPU errors; the existing shore-field fallback
warning remains. The comparison selector, full-after button and image loading
were checked.

The mobile profile rendered timber, boundary stone and the whole approach at
844 × 390 with the WebGPU limit forced to 16 sampled textures. This passed without
GPU/shader errors; it is a rendering check, not a physical phone trial. Reproduce:

```powershell
$env:WEBGPU_DEFAULT_LIMITS = '1'
$env:SURFACE_REVIEW_MOBILE = '1'
node artifacts/surface-pass/review.mjs mobile dFloor,stoneBoundary,fApproach
```

`original/` preserves the touched source files as they stood before this work.
`baseline-src/` is an isolated source tree with those originals restored so
`node artifacts/surface-pass/review.mjs before` can reproduce the earlier scene
without changing the working application. The comparison and exports remain
local; no publication was performed.
