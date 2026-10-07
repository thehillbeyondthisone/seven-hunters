# Fitted Flannan stonework

Implemented locally on 4 October 2026. The compound walls and chapel now use
individual closed stone volumes. The original working source snapshots and
fixed-camera baseline images are preserved in `artifacts/stone-pass/`.

Open `http://127.0.0.1:5189/artifacts/stone-pass/index.html` for the before/after
board and supplied photographs. The established `start.bat` starts the local
development server. Direct review routes are `/?nostory&view=stoneBoundary` and
`/?nostory&view=stoneChapel`.

## Construction and scope

- Compound: mixed-height, roughly squared blocks and small snecks packed with a
  skyline layout. Shared distorted beds, chipped outlines, recessed mortar and
  full-depth bevelled volumes replace the flat wall's shader-drawn joints.
  Both faces and exposed ends are real geometry. Existing saddleback coping,
  gate caps, iron fence, gate interaction and collision envelopes remain.
- Chapel: thinner dry-stone blocks form its walls and gables. End walls own the
  corners; side walls fit between them. Gable clipping and explicit doorway
  subtraction preserve the small west opening. Separate overlapping slabs form
  the corbelled roof; the previous flat shell and decorative slab rows are gone.
- Island: 113 unworked angular fragments reuse the stone geometry and grain in
  five sparse patches near the chapel and routes. Placement excludes paths,
  buildings, the compound interior and steep slopes. These small embedded
  fragments are visual dressing and use terrain collision.
- Surface: optional Flannan-only GPU-baked grain maps provide mottling, mineral
  flecks and fine relief with no masonry grid. The old materials remain for the
  limewashed house/tower and other settings. The new maps add about 2.7 MiB of
  mipmapped texture data and no extra material draw range.

The shapes are generated once from private seeded random streams, then joined
into the station's existing material batches and shared shadow draw. Indexed
face vertices reduce duplication and keep bevel/side creases. There are 1,905
compound stones, 36 gate-pier stones and 512 chapel pieces, plus the loose stones.
Static station geometry increases from 118,358 to 359,200 triangles. The
`geometry-audit.json` report includes per-batch vertex counts and source hashes.
Both versions register the same 589 collision boxes. This is a real geometry
cost; sustained headset/tablet performance has not been measured, and there is
no new distance LOD system in this pass.

## Evidence and reconstruction

The [HES station listing](https://portal.historicenvironment.scot/designation/LB48143)
describes snecked roughly squared rubble and random rubble boundaries. The
[Western Isles chapel record](https://her.cne-siar.gov.uk/Monument/MWE3971)
describes thin slabs and corbelling and records substantial roof rebuilding.
The supplied photographs in `reference/` guide construction type and surface
character. Individual stone layouts, wear, finish and loose-stone placement
are artistic reconstruction. Modern roof condition and exposed pointing do
not establish an exact 1901 state. Reference images remain local study media.

## Verification

```sh
node test/stone-masonry.mjs
npm test
npm run build
node artifacts/stone-pass/audit.mjs
node artifacts/stone-pass/review.mjs after
git diff --check
```

The stone tests check deterministic packing, coverage without overlaps, closed
volumes, face winding, complete doorway clearance, and off-path placement.
The existing suite covers game logic, Flannan terrain/station geometry, the
walking/stair/door route, the first-night story and saves, guidance, engine GPU
smoke and mobile input. Fixed-camera application renders cover close masonry,
chapel corners/roof, loose stones, overall approach and evening views.
Visual likeness is evaluated separately from these structural checks.

The commands above passed. Nine 1200 x 800 desktop application comparisons
completed without GPU/shader errors. The live browser scene also rendered with
no console errors. Additional wall and loose-stone renders passed with
`STONE_REVIEW_MOBILE=1 WEBGPU_DEFAULT_LIMITS=1` (the mobile graphics profile,
16 sampled textures per stage).

Forcing the desktop water profile onto that same 16-texture limit fails in
the water shader's 23/24-texture bind groups. The new masonry material compiles
within the limit; water bindings are outside this stonework change. The invalid
`limits-stoneBoundary.png` render is diagnostic only and is not part of the
comparison board. Neither successful profile establishes physical-device
performance.

All changes and review artifacts remain local; nothing was published.
