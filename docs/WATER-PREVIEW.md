# West-landing wave prototype · 4 October 2026

**Continue the bounded experiment. Hold the broad water pass.** The prototype demonstrates coast-dependent wave motion at an affordable desktop cost. It is ready for visual review, with full offshore coupling and nonlinear storm behaviour still outstanding.

## Run and compare

Double-click `start-water-preview.bat`. It starts a separate local Vite server at **http://127.0.0.1:5192/water-preview.html**, opens the preview, and leaves the usual game server alone. A second launch reuses this preview server. It never kills a process occupying a port.

The initial load compiles the island shaders and lets 45 simulated seconds of swell reach the coast. Small swell (0.5 m incoming amplitude) is the default; larger amplitudes are stress tests of this linear model. The preview offers:

- **Current water:** the existing FFT and prescribed shoreline surface, with foam and spray disabled for this comparison.
- **Free swell:** a controlled incoming set that passes through the coast without solving its response.
- **Coastal solver:** the same controlled incoming set, interacting with the reconstructed depth and dry-rock boundaries.

Switching modes preserves the camera and wave clock. Change period, approach angle, amplitude or regular/mixed waves; pause, restart or choose the landing, cliff or overhead camera. The motion map shows solved height and oscillating face velocities. Its rock-contact crest count comes from observed height maxima, rather than a separate event clock. The map continues to show the solved field in all comparison modes.

The normal entry point never imports the experiment. The preview forces the Flannan setting and creates no Story, Game or AppUI; it does not access story saves. All implementation files are under `tools/water-preview`, plus a new HTML entry and launcher. Existing production source files were not edited by this work.

Recorded comparison: `artifacts/water-preview/index.html` (12 seconds, matched moving views). `comparison.gif` is a smaller motion handoff: free swell on the left, solved coast on the right. The PNG frames retain full colour at 960 × 540.

## Implemented physics

A fixed 576 m square patch, 192² cells at 3 m, samples the actual terrain after station grading. The maximum reconstructed depth in this patch is 51.16 m. This remains procedural bathymetry, not a surveyed seabed.

The solver stores water height and horizontal face velocities. Its continuity update uses conservative depth fluxes; wet/dry faces have zero flux. A pressure-like Helmholtz solve provides frequency dispersion:

`eta_t = -div(d u)`

`u_t = -g grad(eta/6 + 5p/6)`

`(I - 0.4 div(d² grad)) p = eta`

In constant depth, the squared phase-speed ratio is `(1 + (kd)²/15) / (1 + 0.4(kd)²)`, the [2,2] Padé approximation of `tanh(kd)/(kd)`. Rational dispersion fits are established in extended Boussinesq research; this particular variable-bottom extension and finite-volume implementation are experimental. They have not been validated as a complete scientific coastal model. [Madsen and Sørensen model research](https://www.sciencedirect.com/science/article/pii/S002199911100516X).

The prototype uses 64 warm-started Jacobi iterations at 30 simulation steps per second, Neumann rock boundaries, and a 96 m relaxation band for incoming forcing/outgoing absorption. The rendered patch replaces the incoming height, rather than adding a second incident wave. It blends back to the same analytical swell at the outside edge. Small normal detail comes from the existing ocean shader.

## Checks completed

`node tools/water-preview/sample.mjs` followed by `node tools/water-preview/validate.mjs` runs physical-behaviour checks on this machine's RTX 4060 through Dawn D3D12:

- Moving 9- and 14-second waves at 9, 27, 35 and 51 m depth: measured phase-speed error ranges from −0.16% to +1.29%. Amplitude drift over the measured run reaches about +8.9%; this must be improved before long-duration production use.
- Variable-depth still water stays still, including dry rock.
- A 0.2 m pulse reflects from a flat solid wall, reaches about 0.388 m there, and produces outward velocity about 0.164 m/s. Relative volume drift is about 2.1e-8; dry-land height/velocity remain zero.
- An outgoing pulse's remaining interior peak is about 0.68% of the corresponding closed-tank peak after 60 seconds. This is one pulse test, not universal boundary validation.
- Five simulated minutes of mixed 14-second, 2 m-amplitude forcing on the full reconstructed patch remain finite, with zero dry-land state and source/sink budget error below 0.0001%.
- Reset and a changed timestep remain finite. Regular waves work with unused wave slots zeroed. Opposite approach directions produce distinct coastal fields.
- WebGPU validation is clean. The 192² compute solve measures about 0.197 ms per step in the isolated probe, with timestamps quantized by Dawn.

`node tools/water-preview/review.mjs` validates the complete island renderer, captures matched static/moving comparisons, and runs alternating full-scene on/off timings. No GPU validation errors occurred. At 960 × 540, with foam/spray off and the motion-map readback excluded:

| Run | Solver | Median GPU frame | P95 GPU frame | Mean solver stage per rendered frame |
|---|---|---:|---:|---:|
| 1 | off | 10.813 ms | 11.403 ms | 0 |
| 2 | on | 10.945 ms | 11.600 ms | 0.118 ms |
| 3 | on | 10.945 ms | 11.665 ms | 0.103 ms |
| 4 | off | 10.879 ms | 11.469 ms | 0 |

Each run has 32 warmup and 100 measured frames at 60 Hz; the solver advances at 30 Hz. These samples meet the provisional 1 ms additional P95 target in this desktop configuration. Differences in total frame time include noise and changed water geometry; they do not establish a speedup. They do not cover 1080p/4K, sustained browser timing, map overhead, spray integration or Quest.

Browser inspection confirmed the preview loads, renders, switches water modes, and exposes the comparison controls. Human visual acceptance remains open.

## Limits and next gate

The solver uses controlled regular/mixed incoming waves rather than sampling the full offshore FFT spectrum. It is linear, has a fixed shoreline, and does not simulate mean currents, nonlinear advection, breaking dissipation, drying/flooding rock, detached spray, curling breakers or climbing water sheets. Its flow arrows represent oscillatory return motion, not validated sustained backwash.

The strong five-minute test reaches 10.52 m surface displacement in its final state. Numerical finiteness does **not** make this physically credible: reflecting coves can accumulate excessive energy without breaking losses, and the small-amplitude assumptions fail near shallow rock. This rules out promoting the current solver as a gale-water replacement.

Next, review whether the matched moving views offer enough benefit to justify one further integration step: drive the patch from the actual offshore spectrum, improve pressure convergence/amplitude drift, and address shallow-water energy loss. Require continuity at the patch boundary and sustained forcing checks before adding foam or spray. If convincing nonlinear run-up is the essential target, this heightfield approach remains insufficient.

## Reproduce

```powershell
node tools/water-preview/sample.mjs
node tools/water-preview/validate.mjs
node tools/water-preview/review.mjs
node tools/water-preview/make-gif.mjs
node node_modules/vite/bin/vite.js build --config tools/water-preview/vite.config.mjs
```

Raw results: `artifacts/water-preview/validation.json`, `render-result.json` and `depths.json`. The dedicated Vite build writes only `artifacts/water-preview/build`; it does not replace the main game's build output.
