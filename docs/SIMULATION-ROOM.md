# Simulation room

Launch the local game with `start.bat`. **Backtick (`)** or the top-right **Menu** button
opens the compact desktop menu. Collapsible folders keep controls in a 248 px column. Weather and locations use this one menu; the old large weather dock and vertical icon rail are hidden on desktop. **Display & help** opens the compact graphics panel. **Esc** closes it and returns control to the player. The menu pauses
story progression and blocks movement/firing while the environment continues to simulate.
No debug setting is written into watch saves or the inventory.

The menu also launches all current experiences in the same tab: the normal watch, boat arrival,
island reveal, keeper duties, day two and all four later chapter starts (under a spoiler fold),
free exploration, Atlantic weather, The Black Atlantic, simulation lab, minigun practice,
water comparison, Tidewater, touch arrival/keeper previews and WebXR exploration.
Links start with clean route parameters; story previews retain their existing separate save slots.
The desktop menu is also available in The Black Atlantic and Tidewater. On mobile, tap
**Experiences** at the top left or in the pause menu. Island links preserve touch controls;
opening the menu cancels held gestures and pauses the watch. Simulation controls
appear only where the coastal simulation is supported; minigun practice is marked desktop only.
Headset entry still requires the VR server and a secure context.

**Keeper’s Playground** and **Lighthouse disco** open a separate desktop toybox
with an original brass gravity grabber, movable buoys/crates, colored lighthouse
beams and a mirror ball. Run `start-playground.bat` or choose either named entry.
See [controls, model and checks](KEEPER-PLAYGROUND.md).

For a separate exploration lab, open **http://127.0.0.1:5189/simulation.html**. This uses
`?simulation&seaWeather=settled&debug`, starts at the west landing, and does not construct the
story or load/save a watch. Desktop controls: WASD walk, F fly, E doors, M sound.
Mobile and immersive XR retain their existing lighter water profile; extreme events are desktop only.

| Control | Result |
|---|---|
| Equip / holster minigun | Existing F8 equipment, now discoverable; left click / X fires |
| Summon practice buoys | Existing seven physical targets; G resets them |
| Settled / rising sea / gale / after squall | Smooth changes in wind, clouds, rain, visibility, swell and surf |
| Violent storm / hurricane force | Force 11 / 12 wind, driving rain, reduced visibility, persistent swell, wet surfaces and stronger cliff spray; standing walkers remain planted |
| Crest · m / Launch tsunami | 1–250 m incoming crest, with broader pulses at high settings; a leading drawdown and shoreward flood off the west landing; replaces the previous event. Terrain determines actual run-up. |
| Underwater explosion | A displaced annulus/cavity at a sea location ahead, a ballistic water plume, synthetic bass boom and outward waves; replaces the previous event |
| Reset weather & events | Removes event displacement/currents/plume and restores the pre-override weather parameters |
| Replay waypoint ping | In a story session, announces the current destination again |

Water follows the reconstructed terrain in a 160 × 160 finite-volume grid across 1,536 metres
(9.6 m cells). The nonlinear depth-averaged shallow-water equations use Rusanov fluxes,
hydrostatic reconstruction, adaptive CFL substeps, bottom drag and absorbing borders.
This preserves resting water over variable topography, permits wet/dry flow onto low ground,
and produces propagation, shoaling and reflection. Event elevation, normals and a heuristic
foam signal feed the existing FFT ocean. The boat and swimmer's GPU water-height queries use
the same displacement; swimmers and submerged practice buoys respond to the solver's currents.
Tsunamis expire after 180 simulation seconds; blast ripples after 90 seconds and are freely replayable.

The solver is based on [Audusse et al. (2004), hydrostatic reconstruction](https://publications.imp.fu-berlin.de/478/1/file_2004_siam.pdf).
The physical depth dependence of tsunami propagation is described by
[NOAA](https://www.ncei.noaa.gov/products/natural-hazards/tsunamis-earthquakes-volcanoes/tsunamis/global-historical-data).
Wind preset names follow the [National Weather Service Beaufort scale](https://www.weather.gov/boi/beaufort).
Hurricane **force** refers to wind strength; this does not model a complete tropical cyclone.

This is an experimental game simulation over an approximate seabed, with depth clipped at 120 m,
coarse spatial resolution, numerical diffusion and an absorbing boundary. Source pulse shape,
rain density, sea scaling, wind drag, foam and plume are authored approximations. It does not
simulate compressible shock pressure, cavitation, a detonation bubble, building damage, debris
destruction, or predictive inundation. It does not reconstruct a historical Flannan weather event.

`npm run test:waypoint` checks arrival/retrigger behavior and projection/routing.
`npm run test:extreme-sea` checks resting-water balance, outward propagation, symmetry,
wet/dry flooding, finite positive depths, frame-rate agreement and reset, then renders the actual
island/ocean/plume with native WebGPU validation. Render evidence is in `artifacts/extreme-sea/`.
`npm run test:weather`, `npm run test:weather-render`, `npm run test:dev-weapons` and the
existing `npm test` cover the retained systems. These checks do not establish physical audio
audibility, mobile/XR support or sustained gameplay performance.

## Stable coastal rendering and extreme range

Island wind/surf displacement is smoothly limited by local depth, and horizontal compression
is reduced so increasing offshore height does not multiply mesh folds. Flannan disables the
sandy-bay curling lip sheets and retains standing cliff surf, spray and whitewater. Tidewater
retains its original beach profile. Dry water fragments are clipped against the terrain rather
than pulling mesh vertices down through the cliff: that discontinuity produced the large shards.
Event sampling interpolates only wet cells, and solved inundation bypasses the ordinary beach
swash clipping. Wave-driven flood elevation is not capped by the original seabed depth.

The crest slider describes the incoming wave, not a promised run-up altitude or a permanent
sea-level rise. The 250 m upper end is an intentionally extreme sandbox case and can inundate
all land cells in this reconstructed island grid. It is not a plausible ordinary Atlantic storm
or a site-specific tsunami forecast. Larger pulses use the nonlinear shallow-water simple-wave
velocity rather than extrapolating the small-amplitude velocity formula.
[NOAA describes tsunami landfall as a flood or bore and distinguishes run-up from wave height](https://www.noaa.gov/jetstream/tsunamis/tsunami-inundation).

`node test/sea-cleanup.mjs` checks the maximum crest against the actual island terrain,
finite/nonnegative water depths, simultaneous flooding of all land cells and reset. Its measured
result is saved under `artifacts/sea-cleanup/flood-verification.json`. The standing/currents
regression is in `node test/stair-movement.mjs`; mouse/touch selection is checked by
`node test/mobile-input.mjs`. Physical controller/device testing remains separate.
