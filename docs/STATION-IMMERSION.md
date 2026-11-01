# Station atmosphere · 23 October 2026

This pass strengthens the contrast between the working rooms and the weather
outside. It changes environmental rendering; chapter text, objectives, interactions
and watch timing are unchanged.

## Interior air

`StationMotes` adds sparse lint to the keepers’ room, kitchen, berth and lantern.
The field stays in fixed architectural volumes. It has no outdoor seeds, insects
or pollen and does not follow the camera. Slow drift pauses with the simulation.

Particles scatter the actual window and oil-lamp colours, using the existing
lamp ranges, cones and room bounds. Sunlight uses the station shadow maps and
cloud shadows. Unlit particles discard colour, depth and motion writes. Coverage
falls with projected size and at the volume boundaries; their own motion feeds
the temporal resolve. Distant rooms cull the entire mesh.

The four volumes share one draw and no new textures. At the recommended 1× there
are 768 instanced quads; 10× draws 7,680. This is an artistic atmosphere effect,
not a historical claim about the rooms.

## Window shafts and warm lamp haze

`RoomAir` adds continuous scattering inside the keeper room, kitchen and berth.
Seven apertures derive from the actual sash clearances, glass inset, central
mullion, horizontal rail and both faces of the 0.6 m stone reveals. The tower
cylinder is excluded from the keeper room's rectangular bounds. The 23 October
landscape follow-up opens the two extra bedrooms through their existing sashes
and extends the room-air layout to five rooms and twelve apertures.

Sun shafts follow the dated sun, scene shadows, terrain and clouds. Clear station
panes share a timber material batch; they now transmit the shadow pass while
the separately modeled timber and masonry still cast shadows. The keeper room's
only exterior window faces north, so it does not invent afternoon sunlight there.
The berth's south windows offer the strongest winter shafts around noon. Narrow
east/west windows admit only grazing slivers near sunrise/sunset because of the
deep reveals.

Warm scattering copies up to four existing packed lamp sources after selection,
flicker and strength/scale changes. It uses their exact colour, cone, range and
room masks; the carried lamp can contribute when lit and indoors. Cool daylight
and window-bounce fills never produce fake beams. Fixed lamps retain room
confinement and scene-depth cutoff. The storm lantern additionally casts shadows
from the actual station geometry.

The storm lantern has a 6.5 m reach and a shared emission profile: its cap shades
the upper hemisphere and its fount softens the pool below. Surface lighting,
room air and individual motes follow the same swinging source axis. Its room-air
contribution is 12% of the surface source, keeping indoor contrast clear while
retaining a trace of warm scattering. The flame flickers gently; indoor brightness
blends across doorways. Close wall contact retracts both the model and its flame
to the player's side of the partition.

Six 90° depth views at the flame now shadow furniture, walls, floors and moving
doors in every direction, including behind the camera. Surface lighting, dust
and room-air scattering share the same visibility. Existing material shadow
hooks keep clear glass transmitting light. Real shadows replace the lantern's
surface room-box cutoff, allowing spill through open doorways.

The six 512² faces (256² with compact rendering) occupy one reserved layer of
the existing sun-shadow texture array: no extra sampled texture binding. This
adds 16 MiB at a 2048² atlas, or 4 MiB at 1024². Large material batches use
bounded shadow index lists and share their original vertex buffers. Stationary
maps are reused, with immediate updates for source/door movement and a 0.15 s
refresh for shader deformation. An extinguished lantern submits no shadow maps.

`npm run test:lantern` checks the actual GPU emission, finite range, wall contact,
extinction, doorway transition, real geometry shadows, moving casters, glass
transmission, bounded indices, pickup reminder and broad roof-vane interaction.
`node tools/shots/lantern-light.mjs after` captures fixed-exposure room, desk,
berth and yard views under `artifacts/lantern-light/after/`.
Add `--compare-shadows --timings` for matched shadow on/off captures and native
GPU timestamps with all six faces refreshed every measured on frame.

One reduced-resolution RGBA16F target holds 16 stable integration samples, with
depth-aware upsampling in the existing beauty composite. Analytic aperture
footprint filtering softens undersampled edges without animated noise or another
history buffer. Only the occupied/nearby room is evaluated; doorway approach
fades the effect over 1.5 m. Exterior, underwater, disabled and unlit views skip
the march and bypass the composite. Indoor density is independent of coastal
visibility and dust particle population.

**H → Sky → Atmosphere → Window shafts / Lamp haze** both range from Off to 3×;
1× is recommended. **H → Performance → Room air GPU** reports the local pass
when GPU profiling is available. The live study adds a Room atmosphere checkbox
for matched on/off comparison and starts at the berth's noon windows. The same
Low/Balanced/High light-ray detail controls indoor and outdoor ray resolution.

```powershell
npm run shots:room-air
npm run shots:room-air -- --mobile
```

The native gallery and raw timestamp measurements are saved under
`artifacts/room-air/desktop/`; the default-limit mobile render profile is under
`artifacts/room-air/mobile/`. Comparisons use fixed cameras and clock, a frozen
exposure adapted with the effect off, three bracketed measurement rounds and
the same ordinary fixed lamps. No invisible carried lamp is enabled in these
review scenes. `verification.json` retains source hashes and raw samples.

At 1340 × 880 on the RTX 4060 / D3D12, three bracketed rounds of 32 measured
frames per treatment (2,304 measured frames total) produced these full-scene
GPU differences with the default room atmosphere versus Off:

| View | Whole-scene difference | Local scattering pass |
| --- | ---: | ---: |
| Kitchen, first east light | +0.26 ms | 0.29 ms |
| Berth, south windows at noon | +1.04 ms | 0.91 ms |
| Berth, grazing west light | +1.41 ms | 1.03 ms |
| Desk lamp at night | +0.80 ms | 0.70 ms |
| North-facing keeper room by day | Within timing noise | Skipped |
| Exterior approach | Within timing noise | Skipped |

Total scene GPU time averaged about 5.9–7.2 ms in the lit-room treatments.
The 3× density comparison uses the same samples and had essentially the same
local-pass cost. Small full-scene fluctuations remain (especially in the west
view), so the paired total and direct pass timing are both retained. No GPU
validation errors occurred, and source hashes were unchanged during the run.
These costs include room compositing in the total; the live Room air GPU field
counts just the scattering pass. Low ray detail reduces the local target to a
quarter of Balanced's pixels; its whole-frame saving has not been measured in
this run. Native timings exclude browser presentation and do not certify a
sustained physical phone or headset frame rate.

The full 844 × 550 mobile render profile also passed with the 16 sampled-texture
limit, including all 18 on/off/stress captures and zero GPU errors. The room
target was 295 × 193 at that profile's 0.7 scene scale. The berth and lamp views
were visually inspected; this is compatibility coverage on the desktop GPU,
not physical mobile performance. `npm run test:immersion` passes the aperture,
live-source/lifecycle, shader-feature and native rendering regressions.

Final browser QA covered the study's room-atmosphere bypass, window and lamp
sliders, Low/Balanced/High ray detail, the normal Sky panel's two new sliders and
Performance's Room air GPU readout. Settled views showed 60 fps at the observed
903 × 778 render size. Browser logs contained no GPU errors; the existing shore
field fallback warning remains. A controls screenshot is saved at
`artifacts/room-air/live-lamp-controls.png`. The user's saved 3.6× dust setting
was preserved, and both new light controls were restored to the recommended 1×.

## Rain and shelter

Rain now checks shelter at each drop rather than at the viewer. Entering a room
keeps it dry while leaving the rain outside visible through openings. The existing
depth buffer blocks rain behind walls. Particle count and rendering passes are
unchanged.

## Chimney smoke

The stove plume follows the same wind direction and speed as the weather. It
rises more in light air and trails lower, wider and thinner in strong wind. Wind
changes ease over time, and paused/reading time freezes the plume. Its existing
strength control remains with the stove. The 22 wisps now share one instanced
draw instead of 22 materials and draws. It responds to daylight while retaining
the previous authored minimum brightness after dark. The generic distant-return
review is very dark; it does not establish how readily the night plume can be
noticed during the January watch.

## Review and checks

```powershell
npm run test:immersion
npm run shots:immersion
$env:WEBGPU_DEFAULT_LIMITS = '1'
npm run shots:immersion -- --mobile
Remove-Item Env:WEBGPU_DEFAULT_LIMITS
```

The review is written to `artifacts/station-immersion/desktop/index.html` (or
`mobile/index.html`). With the local server running it can be opened at
`/artifacts/station-immersion/desktop/`. Daylight and lamplight views include
matched captures with interior dust disabled; doorway rain and breeze/gale smoke
views use the actual station renderer without loading a story save.

The focused WebGPU checks measure visible rain beyond a sheltered camera and no
rain in its sheltered near field; plume wind reversal, gale shape, paused time,
stove visibility and draw count; and dust colour, lamp extinction, partition
masking, relighting and absence of unlit colour/depth/motion writes. Default-limit
checks exercise the 16-texture profile. These are rendering checks, not physical
phone or headset performance measurements.

The production build, focused atmosphere checks and scene-warmup regression
passed. The full-scene review passed at 1340 × 880 and at 844 × 550 with the
mobile profile and 16 sampled textures, without GPU validation errors. The
daylight, lamp and doorway captures were visually inspected in both profiles.

## Live controls and performance

Open `/test/atmosphere-browser.html?profile` for a live local study. It offers
daylight, lamplight, coastal fog and night-beam viewpoints, an Off–10× dust slider,
ray strength and independent ray resolution. The normal game has **H → Sky →
Atmosphere → Interior dust**. The dust amount is saved on this device and changes
population without moving existing particles, allocating particle buffers or
recompiling shaders. Off submits no particle draw.

**H → Performance → Quality → Light ray detail** offers Low, Balanced and High.
These render the ray march at one quarter, one half and three quarters of the
scene dimensions respectively; global render scale composes with that choice.
High uses 2.25× Balanced’s ray pixels, and Low uses one quarter. Default Balanced
preserves the prior appearance. The live GPU field measures active ray passes
when `profile` is present in the URL, including the previously missing temporal
resolve; it excludes the final fog composite. It is not whole-frame GPU timing.

Sun-ray passes now fully skip when their strength is zero, haze is disabled, or
the camera is underwater. Analytic aerial fog and lighthouse beams retain their
existing controls. Re-enabling, resizing and camera cuts reset shaft history.

The reproducible benchmark is:

```powershell
node tools/shots/atmosphere-performance.mjs --frames=16 --warm=8 --rounds=3
```

Results are under `artifacts/atmosphere-performance/native.json`. This run used
the NVIDIA RTX 4060 / D3D12, 1340 × 880 output, fixed cameras and clock, GPU
timestamps, three paired rounds and 2,496 measured frames. No GPU errors occurred.

| Change | Measured whole-scene GPU difference |
| --- | ---: |
| Dust Off → 10× | −0.02 ms in the room, +0.08 ms at the desk; near timing noise |
| Sun shafts Off → 1× | +0.18–0.29 ms across four views |
| Balanced → High rays | +0.19 ms room / +0.22 ms approach |
| Balanced → Low rays | −0.26 ms approach; room difference inconclusive |

Typical full-scene GPU time in these native views was 3.6–5.3 ms. The newly
skipped disabled passes previously cost about 0.007–0.020 ms: their disappearance
is verified, but their whole-frame saving is below this run’s noise. Timestamp
durations were quantized to 65.536 μs. These measurements exclude browser
presentation and physical phone/headset performance; they do not establish a
sustained frame rate on those devices. Tenfold dust is inexpensive on this GPU,
but should still be reviewed on slower hardware.

The live in-app browser study was checked at 1280 × 720: Off and 10× dust,
Low/Balanced/High rays, zero shaft strength, the normal Sky slider and Performance
readouts all worked. The sampled views held 60 fps, including 10× dust. This is
an observed local session, not a sustained device certification. No browser GPU
errors were reported; the existing shore-field fallback warning remains.

## Where the next visual pass helps most

1. **Drifting low coastal mist — implemented.** The landscape follow-up adds four
   bounded, slowly moving banks around the landings and coves. The artistic
   density remains separate from watch visibility and distant lights. See
   [the landscape review](LANDSCAPE-PASS.md) and [mist notes](COASTAL-MIST.md).
2. **Thin-edge and motion quality.** Review rays near window frames, rails and
   rocks while moving. Higher ray resolution is available now; stronger temporal
   accumulation needs testing for trails and should follow those motion captures.

Avoid evaluating all eight local lights at all sixteen outdoor ray-march steps.
That would add up to 128 light evaluations per ray pixel even when the viewer is
far from a room. Local, bounded work offers a better path to richer lighting.
