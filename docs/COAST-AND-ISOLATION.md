# Coast and isolation

Open `/coast-and-isolation.html` for the three review scenes. They use separate
`sevenhunters.returning-light-preview.v1`, `sevenhunters.coast-preview.v1` and
`sevenhunters.storm-preview.v1` saves. Normal watches continue into the 8–9 January
investigation from the existing 6 January chapter page.

## Guidance and reading

Explicit first-night hints are retained. Desktop edge arrows are 28 px, opaque
ivory with a dark outline, with persistent destination labels after the arrival
pulse. Mobile arrows are 22 px and retain brief labels. Desktop objectives are
22 px, clock text 17 px and marker labels 16 px; player-facing reading, signals
and shared menus have larger type. Mobile controls keep their separate layout.
Edge placement respects the touch action row; reading pages scroll.

## Water and footing

`CoastalState` defines bounded east/west landing events with a shared clock,
five-wave set pattern, surface height, incoming flow, drainage and foam. The
offshore FFT remains. `CoastalSurge` supplies the same field to the ocean shader,
fine local landing sheets and water queries; CPU gameplay samples the same
coefficients. This is authored run-up, not a production coastal fluid solver.
Independent cliff effects are excluded around these gameplay landing sites.

The field advances before walking. Light wash slows, stronger wash pushes and
heavy wash sweeps. Solid stair rails constrain the capsule. At designated rails,
hold E/the named touch action to brace. No random slip rolls are used. Carried
heavy supplies restrict sprinting. The station and upper return route remain
above the normal landing wash.

In normal desktop/touch story play, immersion replaces free swimming with a
12-second struggle and limited steering. Surfacing does not refill this authored
budget. Reach an unobstructed handhold within 1.8 m and hold for 1.2 seconds to
recover, or regain shallow supported footing. The hand lantern goes out but is
retained. These durations are gameplay values, not physiological claims.

Safe checkpoints contain clock, apparatus, conversations, observations, carried
lamp, doors, pose and coastal phase. Unsafe autosaves are suppressed. Death offers
**Retry from safety**; reload during danger also returns to the last safe save.
Old version-one saves accept optional new fields. Reading, pause, photo mode,
hidden tabs and tower travel hold local hazards and struggle timers. Tidewater
and XR retain their existing swimming/locomotion.

## Storm review

Prepare oil, wind and secure the gate. Follow the upper west tramway to the
lookout, observe the separate service lantern, witness a large set and return.
The visible lower landing, walkable colliders, rail handholds and local terrain
support are removed together when the wash reaches the platform. Damage is
reversible on retry. The required route stays above the break. The review then
requires a working light, a signal to Cate and a journal entry; it is not relief.

Indoor wind and upper surf frequencies fall with door-aware shelter while low
impacts, clockwork and room sounds remain. Exertion/recovery breaths and bounded
fitting rattles use the existing mixer. The sea-dread grade retains more coastal
detail; camera-bob and reduced-motion preferences suppress optional shake.

## Checks

- `node test/coastal-safety.mjs`: sets, pause, saved retry, immersion, handhold
  reach/occlusion, touch actions, actual ridge/channel sightlines, evidence and
  reversible terrain/collision damage.
- `node test/coastal-render.mjs`: native WebGPU sheets and CPU/GPU field parity.
- `node test/coastal-walk.mjs`: both chapters through actual doors, tower travel,
  selectable actions, telescope observations, conversations and journals.
- `node tools/shots/coast-and-isolation.mjs`: full native ocean/query/landing
  renders, reversible destruction and no WebGPU validation errors. Images and
  verification are in `artifacts/coast-and-isolation/`.
- `/test/coastal-browser.html`: continuous automated walking in the real browser,
  with the actual reading, reply, investigation and journal screens.
- Existing story, guidance, mobile, weather and walking tests remain required.
- `/test/story-ui.html?view=waypoint&edge` reviews guidance without loading the
  island. Add `mobile` for touch typography.

The full regression script and production build pass. Browser layout checks cover
1280×720, 1920×1080, 2560×1440, 390×844 and 844×390, including long objectives,
bright and dark guidance, dialogue, signals and scrolling reading pages. These
are viewport checks, not physical-device performance certification.
The continuous browser investigation review passes through both conversations,
the ridge/channel observations, return watch and signed journal. Coastal tests
also cover equivalent heavy-wash outcomes, bracing and repeated exhaustion/retry
at 30/60/120 FPS. Human reading time is excluded from the review harness timeout.

Rendered and automated checks cannot establish how frightening the experience
feels or certify physical phone/headset performance. Headphone/speaker balance
and the final danger timings require a human play/listening pass.
