# Coastal mist

`CoastalMist.js` adds four finite sea-spray banks around the east and west landing
geos, north coves and south shore of Eilean Mòr. The layout is artistic direction,
not a reconstruction of the weather on a particular historical day. Each bank
has a smooth compact ellipsoidal density, integrated exactly along the view ray.
Its top lies at most 14 m above sea level, leaving the station rooms and high
signal-light bearings clear. The shader stops at the actual scene depth so
foreground cliffs, masonry and rails cannot inherit fog from behind them.

The banks drift slowly along and across the simulation wind within 17 m of
their original positions. They use simulation time, not wall-clock time. Held
review frames therefore stay identical; camera cuts and re-enabling require no
history reset. Existing camera-underwater and per-pixel water-lens bypasses
remain in force. Lighthouse beams and far-light additions keep their existing
order after the local mist.

The bank colour comes from the same directional horizon sky as the existing
haze, including moonlight. It adds no unlit white billboards at night. The
maximum additional optical depth is .28 (about 24% opacity); individual default
paths are usually considerably thinner. Higher wind gently raises the spray
amount. Global visibility, SeaWeather density and SeaDread's separate low spray
layer are unchanged.

## Controls and cost

Flannan enables the treatment by default through the AirHaze `coastalMist`
constructor option; other worlds omit its module. `?noCoastalMist` omits it for
matched comparisons. `app.haze.coastalMist.enabled` is a boolean;
`app.haze.coastalMist.strength` is numeric from 0 to 2, default 1. Strength 0 or
disabled returns before evaluating the four banks. The ordinary Atmosphere
panel and landscape study expose the strength control.

The treatment uses the existing haze composite. It adds one small uniform
binding, four analytic ray/bank intersections for eligible pixels, and no new
render passes, textures, targets, jitter or temporal history. High rays bypass
the intersections. This is still additional full-resolution ALU work; the
matched landscape timings establish its observed cost on the review adapter.
No phone or headset performance claim follows from desktop fixture results.

The banks model local spray/sea mist rather than general volumetric weather.
They do not simulate turbulence, ray-march shadows, or wet every cove equally.
Their low fixed domain is intentionally local to Eilean Mòr.

## Focused checks

- `node test/coastal-mist.mjs`: numeric controls, optional module composition,
  height bounds, no texture/storage binding, weather and signal ordering.
- `node test/coastal-mist-render.mjs`: native WGSL against independent numerical
  integration; foreground depth, high light bearings, below-water bounds,
  held-frame determinism, slow drift and exact off/re-enable; GPU validation.

The existing haze and room-air controls/defines tests also pass. Full-scene
before/after views and measured timings are recorded in `LANDSCAPE-PASS.md` and
its comparison gallery.
