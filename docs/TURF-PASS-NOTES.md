# Maritime turf refinement

The ground and geometric blades now share a world-anchored broad olive/straw palette. The terrain's former tall-meadow contrast is replaced on Flannan by lower-contrast short turf, small shadowed gaps and restrained peaty mottling. Tidewater retains its existing shader path.

A cached 4 m directional exposure texture samples the real graded terrain and conservatively rasterized static wall/building colliders. Six samples in each cardinal direction give a bounded 24 m shelter proxy. It modulates blade height, density, dryness and local gust strength; this is visual reconstruction rather than a physical wind simulation. Doors, gates, furniture and floors do not create windbreaks. No new scene geometry, blade capacity or draw call is added. The texture is shared by ground and blades and reuses the existing linear-clamp sampler.

Grass feathers outward from the existing 1.05 m path/building exclusion margin. Rock and slope exclusions remain. Small coherent tuft fields and occasional low old leaves break up uniform blade scale without seed heads or flowers. The same stable site parameters are used for both current and previous-frame blade positions. Desktop/Quest LOD topology, prefix roots, thinning ranges and budgets remain unchanged.

Species, measured January 1901 colour/height and exact historical wear are not established. This pass improves visual continuity and site-dependent reconstruction; it makes no new historical claim.

Focused CPU checks: `node test/flannan-sward.mjs` and `node test/maritime-turf.mjs`. Native shader compilation, actual appearance and runtime timings require the integrated landscape review. The additional shelter field is baked once and cached; its channels and footprint are tested independently of rendering.
