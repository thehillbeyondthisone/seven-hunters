# The Atlantic Watch: sea and weather pass

Run `npm run dev`, then open <http://127.0.0.1:5189/?weatherPreview>. The preview begins on a raised
step above the west landing. It does not construct the story director or access a saved night.

Choose **Settled**, **Rising sea**, **Atlantic gale**, or **After the squall**. Conditions blend over
several seconds; swell takes longer to ease, and wet surfaces remain after rain stops. The authored
4 minute 20 second cycle rises from settled conditions to a gale, then eases. Location buttons take
you to the west flight, the station yard or the workroom. Click the scene for mouse look; WASD walks,
E opens and shuts doors, Esc releases the mouse, M mutes sound, and H opens settings. Collapse the
weather controls with the minus button without moving the camera.

`?weatherPreview&seaWeather=settled` starts with quieter conditions. `?noCliffSurf` disables the new
cliff layer for comparison. The weather preview is desktop-only; `?vr` retains its existing profile.

## Implementation

- `CliffImpact.js` derives impact sites from the existing terrain, with explicit wall traces for
  the narrow landing geos. Windward shores receive greater energy than the lee side.
- `CliffSurge.js` adds bounded run-up sheets, aerated water that spreads and drains, dense spray,
  droplets and wind-drifted mist. Emission is limited to four nearby sites and 12 spray requests
  per update. The surf-crash recording plays at the same impact, from its cliff position.
- `SeaWeatherState.js` authors and blends wind, sea energy, cloud cover, visibility and rain.
  The preview uses a fixed storm-capable FFT spectrum with smooth amplitude changes to avoid
  phase resets. The same wind feeds cloud drift, rain, particles and sound.
- `SeaWeather.js` supplies wind-driven rain, exposed-material wetness, and shelter in the workroom,
  tower and lantern. Rain is omitted underwater and below the local terrain surface.
- The normal desktop night gains cliff surf at its existing sea state. Its clock, weather visibility,
  dialogue, objectives and saves retain their existing behaviour. Tidewater and VR omit this layer.

These are authored visual and sound effects on the current reconstructed coast. Run-up is analytic,
not a hydrodynamic solution or a recovered weather observation. This milestone does not stage the
historical 110-foot event or add the later story climax. Existing terrain and station geometry are
preserved.

## Verification

`npm run test:weather` checks preview isolation, weather continuity, swell and drying memory,
shelter, finite input handling, terrain-derived impact placement, windward exposure, bounded
spray emission and shared sound/impact timing.
`npm run test:weather-render` compiles and draws the cliff, rain and wet-material shaders on WebGPU.
`npm run shots:weather` renders four matched views in gale and settled conditions with strict
WebGPU validation, then writes the review images and result JSON.
`npm test` checks fishing regression, island/station geometry, the landing-to-walkway route,
the complete first night and crossing/save compatibility, guidance and the WebGPU engine smoke test.
`npm run build` validates the production bundle.

The review renders and comparison page are under `artifacts/sea-weather/`. Browser checks exercise
the weather presets, cycle and location controls. Rendering checks do not establish physical speaker
balance or sustained performance on a particular device.
