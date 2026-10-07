# Flannan photograph reference pass

Implemented 4 October 2026 for the winter 1900–01 setting. The seven supplied
photographs remain intact in `reference/`. They guide the game's architecture and
materials; they are not runtime textures or a measured survey.

Open the local [comparison board](../artifacts/reference-pass/index.html) for
eight fixed-camera before/after views and the corresponding source photographs.
The baseline is the user's working scene immediately before this pass, including
the existing interior, boat, weather and VR work.

## What changed

- **Lantern silhouette:** a pale lower drum with recessed circular portholes,
  fine seams and iron rims; a broader upper gallery with two fine rails. The
  existing lower corbelled walkway, diagonal lantern glazing, large original
  hyperradial optic, focal height and playable stair/door arrangement remain.
  The porthole stage is documented; port count, spacing, dimensions and painted
  metal finish are reconstructed from the photographs rather than drawings.
- **Keepers' house:** taller, narrower sash openings, finer margins and sills,
  thinner roof courses and a restrained buff trim. The projecting south face now
  has three windows, the recessed south face a door and window, and the north
  face a door and three windows. These arrangements follow the HES description;
  the existing L-shaped footprint and playable room are retained. Exact opening
  sizes and the 1901 trim colour are provisional.
- **Compound:** fine iron palings on the low front plinth, masonry gate piers and
  individual saddleback coping stones. Other enclosure walls remain. The front
  fence is visibly supported by the historical photographs; its iron section,
  spacing, height and exact extent are approximated. Gate interaction and the
  boundary colliders remain functional.
- **Masonry:** a dedicated Flannan material replaces the generic cellular rubble
  on station structures, with roughly squared courses, narrow mortar beds and
  restrained whitewash wear. Chapel stones use a separate uncoursed mode and
  irregular physical slabs, with thin overlapping wall and roof courses. The
  chapel retains the existing small corbelled cell and narrow west opening.
- **Island surfaces:** exposed cliff faces have a cooler grey stone palette and
  directional fractures; embedded slab outcrops have a more coherent orientation.
  Short winter grass is less yellow. The heightfield, coastline, routes and
  path/building exclusions are retained. This is an appearance pass, not a
  geological survey or an exact trace of the wide photograph.

The maritime material/outcrop changes are conditional on the Flannan setting.
Tidewater retains its own palette and generation branch. No story events, normal
save formats or lamp operation were deliberately changed.

## Photograph provenance and limits

Dates and rights were not supplied with these files. Monochrome or postcard
appearance alone does not establish a 1900–01 date. `FI1.jpg` contains the same
elevated station photograph as the long-named JPG below; these are one view,
not two independent confirmations.

| File | Useful visible evidence | How it is used / limit |
| --- | --- | --- |
| `Old Photograph Lighthouse Flannan Isles Scotland.JPG` | Principal elevation, tall narrow windows, fine fence, thin roof bands, pale porthole stage | Strong silhouette/reference match; exact date, dimensions and colours unverified. |
| `FLANNAN.jpg` | Station, people for approximate scale, signal mast, elaborate flag display | Confirms architectural relationships. The festive display is not treated as normal daily practice or automatically added to the game. |
| `flannan_5829.jpg` | Close stair approach, squared/rubble masonry and margins | Material and construction guide. Solar gantry, modern equipment/rails and exposed finish are not a specification for 1901. |
| `FI1.jpg` | Keeper group and elevated compound view | Relative massing and enclosure only; group identities/date not inferred. Right-hand image duplicates the following file. |
| `628a4-0236ad_04bc29fcc7ac47a4b2153fbc2047dccdmv2.jpg` | Tower, galleries, house outline and enclosure from above | Layout/silhouette reference; no measured coordinates or separate corroboration from FI1. |
| `zw-lighthouse.jpg` | Treeless short sward, long approach, fractured and ledged coastal rock | Surface language and outcrop placement; island geometry remains reconstructed. |
| `3c6d592f797087511e_sf1.jpg` | Small chapel, narrow opening, irregular thin stonework and corbelling | Construction/material guide. Its modern roof condition is not asserted to match 1901. Solar structure is excluded. |

## Source checks

Primary/institutional sources checked on 4 October 2026:

- [Historic Environment Scotland, LB48143](https://portal.historicenvironment.scot/designation/LB48143):
  1899 Stevenson station, 23 m tower, whitewashed squared rubble, raised margins,
  corbelled gallery, porthole stage, narrower cast-iron gallery, diagonal lantern
  glazing, L-plan house and elevation openings, boundary coping and piers. The
  listing includes later equipment observed during its modern survey, so it is
  not a complete 1901 specification.
- [Northern Lighthouse Board, contemporary disappearance reports](https://www.nlb.org.uk/history/flannan-isles/):
  Moore's 28 December 1900 report and Muirhead's 8 January 1901 report describe an
  orderly station and a clean lamp. An abandoned meal, overturned chair or
  invented dramatic log entries are not introduced. The accounts also establish
  tramway rails and the flagstaff in 1900; existing rails are retained.
- [Museum of Scottish Lighthouses, original Flannan prism, SLM.1997.9316](https://www.goindustrial.co.uk/collections/lighthouses-museum/collection/prism-flannan-isle):
  original 1899 hyperradial optic, destroyed during the 1971 conversion. The
  game's existing large optic is retained rather than replaced with modern
  automated equipment.
- [Western Isles Historic Environment Record, MWE3971](https://her.cne-siar.gov.uk/Monument/MWE3971):
  early medieval corbelled oratory, historical dimensions/observations and
  substantial roof rebuilding. The new stones do not establish a dated roof
  reconstruction.
- [National Records of Scotland, Flannan keepers](https://blog.nrscotland.gov.uk/2023/12/12/flannan-isles-lighthouse-keepers-the-disappearance/):
  historical context and circa-1900 keeper photograph; its modern exterior image
  is distinguished from period evidence.

The HES/Trove catalogue identifies station/house/lantern drawings, including
DC8664–DC8672. Their full sheets have not been inspected in this pass. Exact
elevations, enclosure dimensions, lantern port count and period finishes remain
open to a later drawing-led revision. The interior remains a documented
reconstruction using comparable period objects, not a verified room photograph.

## Review and verification

`artifacts/reference-pass/review.mjs` captures the current application at
1200 × 800, with fixed cameras, seeded generation and 32 frames per view. The
eight before/after pairs include the front elevation, elevated compound, lantern,
chapel, coast, night exterior, walking approach and furnished workroom. Baseline
PNGs are retained; rerunning `after` does not reconstruct an earlier source tree.
The additional `lit` night view deliberately lights the lamp and is labelled
separately. Ordinary comparison night views have the lamp off in both versions.

Commands:

```sh
node artifacts/reference-pass/review.mjs after
node artifacts/reference-pass/review.mjs lit refNight
npm test
npm run test:weather
npm run test:weather-render
npm run build
git diff --check
```

The game-logic, station geometry, walking/stair/door route, complete first-night,
boat/save compatibility, guidance and GPU smoke suites passed. Weather logic and
WebGPU weather rendering also passed. The fixed-camera renders were inspected,
and the live desktop browser loaded the updated scene without console errors.
The comparison board's view selector, before/after controls, changing captions
and photograph links were also exercised in the browser without console errors.
The renderer's existing
shore-field fallback warning remains; it uses terrain shore sampling.

These checks establish application behaviour and successful GPU rendering on
this machine. They do not establish a surveyed 1901 reconstruction, physical
headset/controller/audio acceptance or sustained device performance. All review
artifacts and reference photographs remain local; nothing was published.
