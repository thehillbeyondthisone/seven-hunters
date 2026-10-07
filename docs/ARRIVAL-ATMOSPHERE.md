# Arrival atmosphere study, 6 October 2026

Launch `start-arrival-atmosphere.bat`, or open the running local server at
`http://127.0.0.1:5189/artifacts/arrival-atmosphere/index.html`. The board compares
eleven matched views and auditions the three recorded sound layers. Play at
`http://127.0.0.1:5189/?arrivalAtmospherePreview`. B opens Papers; Enter moves to the
landing, and a separate Enter steps ashore. On the title screen, Begin again restarts
this preview. Its save key is `sevenhunters.arrival-atmosphere-preview.v1`.

The review stays isolated while we judge the overall quality level. The boat uses
the same mipmapped wood, paint, iron and rope fields as the station, with dampness
in boat-local coordinates. Cloth has restrained folds and filtered fine weave.
The passenger camera is 24 cm lower. The rowing pose has entry, pull, lift and
recovery phases, with blade depth following the sampled sea. The hull shape and
nine-probe flotation envelope remain in place.

The landing gains aggregate normal detail and wetter tidal roughness from the
station's shared stone fields. Fine sea normals diminish with distance, keeping
large waves and near-water detail. That sea treatment applies around the island;
wave displacement and buoyancy queries retain the same values. No new texture
images are allocated. The boatman, island geometry and room furnishings retain
their existing procedural forms; this is a shared surface pass, not a completed
island-wide asset replacement.

Six CC0 rowing excerpts are synchronized to the animation clock. Their spatial
sources stay with the departing boat; occasional CC0 wooden creaks share that
position. The creaks are floor Foley used as a boat proxy. Close water reuses the
existing dock-water recording, while wind and surf retain their environmental
mix. The preview suppresses the fishing boat's fiberglass lap/slap effects.
Papers and photo mode hold rowing and its stroke events while flotation continues.

Sources and processing are in `public/audio/CREDITS.md` and
`tools/audio/arrival-bank.json`. `tools/audio/build-arrival.py` rebuilds the banks
from downloaded source metadata and previews under ignored `tools/audio/raw/`.
It uses numpy and soundfile, resamples to 48 kHz mono, applies short fades,
normalizes each bank to -3 dBFS peak and measures the slices' loudness. The review
players audition these exported banks, not their quieter in-game mix.

Boat form, finishes, crew and sound interpretation are artistic reconstruction;
the recordings do not establish historical boat construction or acoustics.

Validation completed:

- `npm run test:arrival-atmosphere`: one stroke per cycle at 120, 30 and 12 fps,
  pause/resume, hidden and distant boat suppression, rowing pose, bank calibration
  and delayed-sea flotation with the lower camera.
- `node test/boat-arrival-sea.mjs --atmosphere`: actual FFT/shore sea and Story for
  155 simulated seconds, 1,510 clearance checks, minimum passenger clearance
  1.743 m, no clearance/underwater failures. Report under
  `artifacts/arrival-atmosphere/sea-check/`.
- `npm run test:boat`, `npm test`, `npm run build`, `git diff --check`.
- Eleven matched desktop WebGPU views at 960 × 640; six compact landscape views
  at 844 × 390 under the 16 sampled-texture limit. Screenshots compare the boat,
  landing, station approach, keeper's room and floor. No GPU validation errors.
- Live browser: begin crossing, open/close Papers, advance to the landing and
  step ashore. No console errors; the existing shore-field fallback warning remains.

These checks verify timing, rendering, interaction and sea clearance. Speaker or
headphone mix balance and physical-device performance need a listening/play session.
