# Weather observations through exploration

The first evening's six and nine o'clock observations now require reading the room barometer, reading a shaded north-wall air thermometer, inspecting the cupola vane from the yard, watching open sea from the balcony, and checking Gallan Head and Eilean Tighe bearings. Return to the slate for a single **Chalk observations** action. There are no weather answer selectors.

Use `weather-observations.html` for separate six/nine o'clock and desktop/touch previews. Their save keys are `sevenhunters.weather-observations-preview.18.v1` and `.21.v1`; they never load or write `sevenhunters.night1.v1`.

The pressure pointer uses the existing authored pressure timeline. Shaded temperature falls from 42°F at six to 40°F at nine. The vane rotates from the renderer's wind vector; strength uses that vector's speed. Nine existing GPU water queries across a 50-metre patch accumulate four seconds of fresh readings. Four times the sampled height standard deviation estimates significant wave height; this short spatial/time estimate is an aid to a qualitative game observation, not a calibrated sea measurement. Stale, displaced, non-finite or shallow-water results cannot complete the observation.

Visibility uses each landmark's rendered curvature, actual haze extinction, opaque station geometry, intervening terrain, daylight and Gallan Head's current lamp output. A checked bearing hidden by fog counts as evidence; an obstructed view does not. Clear air in darkness without a light yields an uncertain report, never an automatic claim that Lewis is visible. The unusual story light on Eilean Tighe is not treated as a visibility landmark lamp.

Capture times, sources and player positions are stored in optional `flags.weatherObservations` drafts. Chalking copies those readings into the existing observation slot and retains evidence with the completed entry. Journal rows use the actual chalking time. Completed legacy entries and the scripted three o'clock entry are preserved. Unfinished drafts do not count as completed entries or stop deadline expiry. An active unfinished round multiplies normal clock advancement by 0.4; existing signalling modifiers and lamp consumption still apply. Pausing, open papers and backgrounded observation never accumulate sea-reading time.

## Historical boundaries

The [Northern Lighthouse Board report](https://www.nlb.org.uk/history/flannan-isles/) confirms barometer, thermometer and wind readings on the slate, subsequently transferred to the log. The local `docs/references/flannan-interior/station-original-sheet-01.jpg` shows the lantern's roof vane. Exact barometer type, thermometer placement, face typography, reading values and six/nine o'clock handling are reconstructions, not a recovered station inventory or January 1901 weather record.

[Met Office Beaufort guidance](https://weather.metoffice.gov.uk/guides/coast-and-sea/beaufort-scale) and [sea-state terminology](https://weather.metoffice.gov.uk/guides/coast-and-sea) calibrate descriptions. Their modern thresholds do not establish the terminology or procedure used at this station in 1901.

The review route also accepts `weatherLocation=thermometer`, `vane`, `sea`, `landmarks`, `island` or `slate` for individual interaction checks. These entry poses apply only to the isolated preview; the default round starts at the barometer.

Run `node test/weather-observations.mjs`, `node test/demo-story.mjs --weather-walk`, the story/guidance/mobile suites, `npm test`, `npm run build`, and `node tools/shots/weather-observations.mjs` (also `--portrait`). The walking harness uses real player movement, colliders, story time and lamp interactions, with synthetic GPU readback; it completes both rounds while tending the light. Render inspection uses the native WebGPU scene and real instrument textures. Physical touch, audio and play-feel acceptance remain separate checks.
