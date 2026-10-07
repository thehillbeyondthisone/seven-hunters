# Landing and stair visual pass

Implemented 4 October 2026. Local review: [before/after board](../artifacts/landing-pass/index.html).

The supplied island photograph and station approach photograph guide construction
and the relationship with exposed rock. Neither is a close east-landing survey.
The earlier generated `02-east-landing.png` guides material and equipment readability;
it remains a reconstruction, not historical photographic evidence.

The [Northern Lighthouse Board contemporary reports](https://www.nlb.org.uk/history/flannan-isles/)
confirm concrete west steps, iron railings, supply ropes, cranes and the west crane
platform at 70 feet above the sea. Its former water-level placement was corrected.
The platform is approximately 22.2 m up: the existing one-metre sampled flight
provides the adjacent tread elevation. Crane design, stair route, stage dimensions,
concrete colour, rock cutting and fitting arrangements are still inferred.
The report describes west railing damage and lost gear; the game's existing intact
railings and rope-box dressing are retained as fictional presentation. This pass
does not establish an exact January 1901 condition reconstruction.

Changes:

- Separate cast-concrete material with metre-scale aggregate, gentle mottling,
  sparse construction joints, and a darker damp band near sea level.
- Clipped landing corners and battered sides; existing boat arrival position and
  stage walking surface retained.
- Full concrete risers, small bevels on tread edges, and continuous side cheeks.
  Terrain now clears the concrete bed instead of covering the risers. The tread
  heights, centerline and stair colliders retain their existing route.
- Wider, irregular blended rock cutting removes the narrow slot beside the flight.
  The coast and underlying DEM remain reconstructed at landing-detail scale.
- Flanged iron post sockets and collars; a riveted jib with flange/web section,
  head pulley, hook, drum, wire windings, handwheel, coarse gear and crank.
- Separate elevated west crane platform cut into the rock, with a lower boat stage.
  East stage has modest rope and timber-box working details.

The Flannan material is registered in the settlement's shared opaque batches.
Tidewater does not generate it. Unrelated source changes, reference originals,
story state and save formats were preserved.

Verification:

```sh
node artifacts/landing-pass/review.mjs after
npm test
npm run build
git diff --check
```

The review captures seven fixed before/after views plus an additional west crane
view at 1200 × 800, 32 settling frames per view. Boat arrival is captured last so
its camera controller cannot override later static review cameras. Final images
were visually inspected. The full test suite includes station geometry, both
landing climbs, the full east landing-to-lantern walk, first-night story/save
behaviour, guidance, GPU smoke and mobile input. Added checks cover the elevated
west crane collider and the west stair climb. Existing shore-field fallback and
build chunking warnings remain. Device, audio and sustained performance acceptance
are not established by these checks. Nothing was published.
