# East landing: coming ashore

This graphical pass uses real east-landing photographs for the scale and construction language around the player's arrival. The maintained January 1901 scene is a reconstruction, not a surveyed replica of today's remains.

## References inspected

- [Marc Calhoun, Destination Flannan, May 2017 visit](https://marccalhoun.blogspot.com/2017/06/destination-flannan.html): the wide East Landing photograph and annotated close-up. Tilted grey bedrock, quartz streaks, ochre lichen, small platforms, iron rungs and the separate concrete steps to the water inform the pass. Today's missing steps and corroded rungs are not copied into the working 1901 east landing.
- [Chris Downer, path from the landing, August 2012](https://www.geograph.org.uk/photo/3201944): the exposed steep stair/track connection and scale of the ascent. Photograph licensed CC BY-SA 2.0; referenced, not used as a game texture.
- [Chris Downer, looking down on the trackbed](https://www.geograph.org.uk/photo/3206221): the stage's small size relative to the cliff and open sea. Modern rail removal and vegetation are not evidence for January 1901 dressing.
- [Northern Lighthouse Board, Flannan Isles primary accounts](https://www.nlb.org.uk/history/flannan-isles/): Moore and Muirhead describe the east landing and its stored ropes as intact after the disappearance. Their damaged railings and the 70-foot crane platform relate to the west landing.

## Implemented

- A single merged bedrock batch adds leaning, fractured volumes beside the lower east flight, low rock shelves around the plinth, mineral seams, lichen and a wet tidal belt. The opaque batch participates in the existing shared shadow draw.
- A local terrain material blend gives the east approach cooler mineral faces and quartz seams. The winter sky, terrain height, upper route and distant shores retain their broader scene direction.
- Asymmetric lower rock shoulders soften the regular trench profile without changing the central graded stair heights.
- Complete iron rungs, a small stair to the water with walkable tread support, a return rail, rope coils, a stores crate and a slim communication pipe add details readable from the boat and at walking height.
- The exposed landing concrete uses unjointed mineral grain, fine aggregate, dampness and sparse casting lifts. No masonry grid is painted onto the concrete.
- The boat stops 8.2 m from the stage centre, with its bow clear of the sea face. The original start position and 90-second crossing duration are retained. The first standing pose looks farther up the flight and resets the camera's ground smoothing.

## Reconstruction limits

Individual rock shapes, platform footprint, the precise placement and design of the fittings, pipe route, 1901 finishes and boat dimensions are inferred. The real DEM remains the island's broad foundation; the dock cutting is artistic terrain, not photogrammetry. No modern decay, rubber fenders, electric lamps or signage have been added.

The photos are reference material only and are not bundled into the game. Normal-watch saves retain their keys and story progression. Review play uses `?arrivalPreview`.

## Verification

Matched captures and a reference comparison are in `artifacts/landing-pass/index.html`. The geometry/story suites check the actual graded ascent, finite world geometry, the working stage, crossing pause/save behavior and disembarkation. Dawn render captures exercise the new material shaders. The real FFT/shore-water arrival check passed 1,510 samples over 155 simulated seconds; the minimum lens clearance was 1.94 m, with no GPU validation errors. These checks do not establish physical-device performance, touch feel, speaker audio or historical dimensional accuracy.

| Check run for this pass | Coverage |
| --- | --- |
| `npm run build` | Production bundle, including the final bedrock shaders. |
| `node test/flannan.mjs` | Finite geometry, real DEM foundation, both landings and the elevated west crane. |
| `node test/demo-walk.mjs` | Actual landing-to-lantern ascent and return routes. |
| `node test/demo-story.mjs` | Crossing, papers pause, save/resume, disembarkation, later watch progression and legacy saves. |
| `node test/stair-movement.mjs` | Walking/running and camera support at 30, 60 and 120 FPS. |
| `node test/boat-arrival.mjs` | Analytic sea clearance across different frame rates. |
| `node test/boat-arrival-sea.mjs --out=artifacts/landing-pass/sea-check` | Real FFT/shore-water clearance through title, crossing, papers, approach and waiting at the landing. |
| `node test/arrival-atmosphere.mjs` | Arrival sound-state and pause/departure behavior; no speaker-audibility claim. |

Browser review exercised the dated card, **Go to landing**, **Step ashore**, the first standing view and the restored walking controls using the isolated arrival preview. The reference images loaded and the comparison slider endpoints were checked.


---

## Earlier pass record: 4 October 2026

The following dated record is preserved for the earlier east/west landing and crane work. The current east-arrival refinements are described above.

### Landing and stair visual pass

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
