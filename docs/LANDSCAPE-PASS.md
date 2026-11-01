# Weather, work, and the island

Environment pass, 23 October 2026. The aim is a continuous winter landscape around
a young, maintained working lighthouse: grass grounded in its soil, weather
shaped by the coast, rooms open to daylight, and historically supported working
details.

## Local review

With the dev server running, open `/landscape-preview.html` for the live island.
The study provides the station approach, walking-height turf, worn path edges,
both bedrooms, daylight assistance fittings, east/west coastal mist and night.
It creates no Story and opens no saved watch. Grass blades, local mist and motion
can be toggled independently. These study controls do not save preferences.

`/artifacts/landscape-pass/index.html` is the matched comparison gallery.
It uses native game renders, never concept artwork. Drag its divider or switch
the viewpoint. The original source for the before captures is preserved locally
under `artifacts/landscape-pass/baseline-src/src/`, including the user's earlier
uncommitted changes. The review never resets the working checkout.

```powershell
node tools/shots/landscape-pass.mjs --baseline --timings --motion
node tools/shots/landscape-pass.mjs --timings --motion
node tools/shots/landscape-pass.mjs --mobile
node tools/shots/landscape-gallery.mjs
```

The first command requires that local pre-pass snapshot. The remaining commands
use the current source. Both desktop treatments use identical cameras, 1280 × 800
output, fixed simulation time and 48 settling frames. The timing option runs
three rounds of 32 measured frames after 12 warm-up frames. The six-second moving
camera crosses grass cells and detail ranges without camera cuts. Selected
frames are retained; this is an offscreen traversal, not a real-time recording.

The mobile profile forces the 16-sampled-texture compatibility limit and uses
844 × 550 output on the same desktop adapter. It does not establish physical
phone or headset performance. Raw reports retain the source hashes and GPU
validation errors; source changes during a review fail the run.

## Historical basis

[Muirhead's report, 8 January 1901](https://www.nlb.org.uk/history/flannan-isles/)
describes balls or discs on poles projecting from the balcony. Their number and
position requested assistance from Lewis. His report discusses and rejects a
routine daily all-well signal. The new fittings remain stowed; examining them
does not send a message, complete an objective or change story state. The exact
disc dimensions, pole positions, lashings and hardware remain reconstructed.
The later report is research evidence, not a document placed prematurely in
the fictional keeper's 3 January papers.

[HES LB48143](https://portal.historicenvironment.scot/designation/LB48143), the
existing source photographs and station opening geometry guide the bedroom work.
Room assignments and furniture arrangements remain the playable reconstruction.
The station's maintained paintwork and clean apparatus are retained.

The original house archive remains an explicit gap. On 23 October the
[Trove domestic sheet, DP 038541 / DC 8666B](https://www.trove.scot/image/1104665)
returned HTTP 403 in the web reader and an Azure WAF access block in the browser.
Its indexed catalogue title identifies roof, kitchen, bedroom and coal-cellar
sections; the full image was not obtained or inspected. No newly invented room
measurement is attributed to that drawing. See the existing
[interior reference notes](references/flannan-interior/README.md).

The photographs and modern habitat sources support low maritime grassland.
The new colour, exposure, shelter, wear and mist patterns are art direction, not
a measured 1901 botanical or meteorological reconstruction. Existing winter
plantain/thrift foliage, quiet coastal birds, chapel and bothies are retained.

## Verification

- Ground and blades share one broad palette and a cached 4 m directional
  terrain/masonry shelter field. Existing blade counts, LOD roots and exclusion
  margins remain intact; the diagnostic noVeg/legacy routes use terrain-only
  shelter because those routes do not initialize the new blade field.
- Five existing bedroom sashes are clear through the original shell. Nine
  perimeter/partition wall colliders, furniture and door positions remain
  numerically identical to the baseline. Room air now covers five rooms and
  twelve apertures.
- Daylight signals add 972 static triangles in existing material batches. Their
  inspection is gated to the actual gallery, so it cannot prompt through the
  lantern drum. Reading preserves time, apparatus, conversations and saved flags.
- Four analytic mist banks add one uniform binding and no texture, target,
  history or render pass. Their density is art-directed and separate from
  weather visibility. H → Sky → Atmosphere → Coastal mist offers Off–2×.

Passed: full npm test, production build, diff whitespace check, flannan-sward,
maritime-turf, bedroom-windows, room-air-layout, archive-documents, coastal-mist
and native coastal-mist-render checks. Existing haze-controls and room-air
controls/defines also passed. The native mist fixture compares the WGSL chord
integral against independent 16,000-step numerical quadrature.

All ten final desktop and all ten 16-texture mobile-profile views rendered
without GPU validation errors. The continuous six-second desktop traversal
checked 13 complete velocity buffers: 53,248,000 half-float components, with no
NaN or infinity. The original fence-filter check remains effective, reducing
its isolated distant jitter variation by 90.8%; that filter predates this pass.

After closing other native render jobs and pausing the live browser, separate
before/after source runs produced these bounded full-scene GPU averages:

| View | Before | After | Difference |
| --- | ---: | ---: | ---: |
| Station approach | 5.20 ms | 5.30 ms | +0.10 ms |
| Walking turf | 6.21 ms | 6.18 ms | −0.03 ms |
| Bedroom | 5.05 ms | 4.90 ms | −0.15 ms |
| East coast | 5.40 ms | 5.44 ms | +0.04 ms |

These small differences should be treated as near timing noise rather than a
claimed speed improvement. The runs use three rounds per view at 1280 × 800 on
the local NVIDIA/D3D12 adapter. Reports preserve raw round values and hashes.
Timings exclude browser presentation, sustained frame rate and physical devices.

Visual inspection covered the turf, approach, window reveals, daylight
fittings, low coastal banks and night, plus the live study in the in-app
browser. Only the pre-existing shore-field fallback warning was observed;
no page or GPU errors remained in the final scene. An initial study-page
settings-button handler was corrected and its normal Sky-panel control verified.
Live controls were checked separately
from timing runs. The matched gallery loads the original and final images.


Browser checks covered grass Off/restore, mist Off/2×, pause, the normal Sky
panel mist Off/reset, and paired gallery image loading. The local observed
view held 60 fps; this is not a sustained physical-device claim. Review state
is recorded in `artifacts/landscape-pass/browser-review.json`.
