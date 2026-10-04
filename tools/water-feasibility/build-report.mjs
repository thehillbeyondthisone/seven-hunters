import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const r = JSON.parse(readFileSync('artifacts/water-feasibility/analysis.json'));
assert.ok(r.checks.every(c => c.passed) && r.gpuProbe && r.wakeProbe);
const round = (x, d = 2) => Number(x).toFixed(d);
const phases = r.patches.flatMap(p => p.dispersion.filter(c => c.quantile === 0.5).map(c =>
	`| ${p.name} | ${round(c.depth, 1)} m | ${c.period} s | ${round(c.wavelength, 1)} m | +${round(c.speedErrorPercent, 1)}% | +${round(c.currentWakeSpeedErrorPercent, 1)}% |`)).join('\n');
const costs = r.gpuProbe.results.map(c => `| Linear flow probe ${c.n}² | ${c.substepsPer60HzFrame} | ${round(c.medianBatchMeanComputeMs, 3)} ms | ${round(c.p95BatchMeanComputeMs, 3)} ms | ${round(c.storageMiB, 2)} MiB |`).join('\n');
const w = r.wakeProbe;
const document = `# Flannan water feasibility gate — 4 October 2026

**Decision: hold the broad coastal/water pass. A tightly bounded dispersive-wave prototype has a credible cost case, but its visual benefit is not yet established.**

The simple shallow-water replacement proposed earlier is unsuitable as the sole coastal wave model at the current landing depths. The existing boat-wake solver offers reusable compute infrastructure, but should not be enabled unchanged for the coast. Full 3D fluid simulation is not justified by this study.

This work created only isolated tools, results and this report. The game, terrain source, story, saves and existing preview routes were not edited.

## What the current water actually does

- \`OceanFFT.js\` synthesizes offshore waves with finite-depth dispersion using one ocean depth parameter. It does not solve coastline collision.
- \`ShoreWaves.js\` prescribes depth-aware wave profiles. Its normal default period is 9 seconds; the weather preview selects 14 seconds.
- \`ShoreSim.js\` advects foam and tracks wetness using flow from the prescribed waves. It does not solve the pressure/momentum exchange of a cliff impact.
- \`CliffSurge.js\` schedules its run-up, foam, spray and sound by period and site phase. These events are not caused by sampling the incoming FFT crest.
- \`WakeSim.js\` already solves small free-surface disturbances with a dispersive spectral operator. It has height and vertical velocity, not a full horizontal-current field. Its boat forcing, moving window, obstacle treatment and depth fit were built for wakes.

## The physical mismatch is measurable

Sampled two 256 m square patches around the actual reconstructed landings, after applying station grading. Offshore coordinates span -40 to +216 m from each landing stage, with ±128 m across its axis. These numbers describe the game heightfield. Its cliff cuts and near-coast bathymetry are procedural reconstructions, not a measured seabed survey.

For each representative depth, solved the linear dispersion relation

\`omega² = g k tanh(k d)\`

and compared the wave speed to \`sqrt(g d)\` and to the current wake solver's blended spectral operators. The wake comparison assumes uniform depth and does not validate its coast boundaries.

| Patch | Median wet depth | Period | Reference wavelength | Basic shallow-water speed error | Current wake-operator speed error |
|---|---:|---:|---:|---:|---:|
${phases}

The shallow-water approximation produces a substantial phase mismatch against the offshore waves. The current wake operator is much closer for 9-second waves, but its depth fit is poor for the longer 14-second swell. Its source comments limit the depth-fit claim to 1–100 m wavelengths; the preview swell is roughly 207–226 m at these representative depths.

The wake window is 204.8 m wide, with an absorbing edge band. At the west patch's median depth, one 14-second wavelength is already about 206.6 m. A larger physical window, better depth operators and boundary forcing must be designed together. Merely changing grid resolution does not solve this.

## What was actually tested

Built an isolated linear depth-averaged wave probe with water height, horizontal face velocities, reflecting boundaries and a fixed wet/dry mask. This is a numerical/cost diagnostic, not a production fluid solver. It has no nonlinear velocity advection, changing wet/dry shoreline, dispersion correction, overturning, foam or spray.

- Still water over variable depth and a dry wall remained still.
- A 0.2 m incident pulse reflected from a solid wall, reaching about 0.398 m at the wall; returning velocity became negative. This is the expected small-amplitude reflection behaviour in the synthetic tank.
- A 600-second simulated west-landing run remained finite, with zero dry-land surface motion and relative perturbation-volume drift about ${r.checks[2].relativeMassDrift.toExponential(2)}. This run had closed boundaries, no forcing and no damping; it does not establish storm stability.
- At 128², 256² and 512², GPU state after 40 substeps agreed with the CPU reference to less than 0.000001 in the stored state components. No WebGPU validation errors occurred.
- The existing wake solver compiled and ran against a sampled west-landing terrain shader, with a boat disturbance. Readback was finite and WebGPU validation was clean. This did not test incoming FFT-ocean forcing, a reflected-swell boundary or run-up.

## Cost measured on this machine

Physical adapter: NVIDIA GeForce RTX 4060, Dawn D3D12; ${w.driver}.

| Probe | Substeps per 60 Hz frame | Median batch-mean compute cost | P95 batch-mean compute cost | Core state storage |
|---|---:|---:|---:|---:|
${costs}
| Existing wake solver 512² | 1 | ${round(w.medianBatchMeanComputeMs, 3)} ms | ${round(w.p95BatchMeanComputeMs, 3)} ms | Not inventoried |

The linear probes use 40 measured batches of 16 simulated frames after 30 warmup frames; wake uses batches of 8 steps. GPU timestamps are quantized, so batching avoids reporting a falsely zero cost. These are compute-only **batch averages**, not full-scene per-frame percentiles. The wake timing repeats fixed uniforms. Simulation-buffer storage excludes readback, textures and production rendering resources.

These measurements support affordability of a local compute stage on this desktop. They do not measure browser scheduling, extra material bindings, rendering, spray, sound/readback coupling, sustained in-game frame time or Quest performance. A more capable solver will cost more than the deliberately simple linear probe.

## The candidate worth investigating

Keep the existing offshore FFT. Investigate a fixed coastal patch with a finite-depth dispersive wave model, using the existing wake FFT/pipeline infrastructure where it helps. The required additions are:

1. Depth operators fitted to the coast's longer waves, not only short boat wakes.
2. Incoming-wave boundary forcing matched to the offshore ocean, plus outgoing-wave absorption. Avoid double-counting the incident surface when compositing the patch.
3. Explicit validation of reflective solid boundaries. Current weak obstacle response is insufficient evidence of correct cliff reflection.
4. Impact detection from solved arrival/velocity, replacing independent clock pulses locally.
5. Foam transport and a representation of return flow. The existing wake state alone does not supply the needed horizontal current.
6. A transition back to the open ocean that remains continuous in motion and with camera movement.

This is a wave-interaction prototype. Substantial vertical water sheets, curling breakers, trapped air and violently overturning cliff impacts remain beyond a single-valued heightfield. If those are the main acceptance target, the heightfield prototype should be rejected rather than expanded into an unrelated full-fluid project.

A non-hydrostatic wave-and-flow model is a more capable alternative if currents/run-up are essential. That adds pressure solving and validation work. SWASH demonstrates the relevant coastal physics, but its documented scientific solver is a reference, not a measured WebGPU implementation or a proposed direct port.

## Gate before any broad pass

Proposed desktop targets below are project acceptance criteria, not measured achievements:

- **Propagation:** no more than 5% phase-speed error across relevant 9- and 14-second waves at representative patch depths; confirm this in moving waves, not only analytical formulas.
- **Interaction:** an incoming crest causes the local impact; changing direction and timing changes the response. Reflected waves and return flow remain visible with spray/foam disabled.
- **Boundary correctness:** flat-wall reflection has the expected phase; dry rock has no leakage; the external patch boundary does not visibly bounce incoming energy back.
- **Stability:** test still water, pulse reflection, irregular forcing, timestep changes, sustained gale forcing and exit/re-entry. Track perturbation volume with a boundary-source/sink budget.
- **Integration cost:** target no more than 1 ms additional P95 GPU frame time on this RTX 4060 at the same output size and quality, measured with full-scene on/off runs. Isolated compute numbers do not satisfy this gate.
- **Player benefit:** matched landing views and continuous motion should show a clear improvement over current water before any coast-wide work. Human visual acceptance remains outstanding.

Timebox the first implementation attempt to two focused development sessions. Stop if it cannot show geometry-dependent wave interaction at that point; do not spend those sessions polishing foam. If it passes, renderer integration, current/foam transport and sustained storm validation are separate follow-up work. Production scheduling should follow the prototype, not precede it.

Land materials, vegetation and station dressing can proceed independently, provided they preserve the test coast. No wave-dependent shoreline reshaping, full 3D fluid work or Quest expansion is recommended now.

## Reproduce

From the project root, using the existing Node/WebGPU dependencies:

\`\`\`powershell
node tools/water-feasibility/evaluate.mjs
node tools/water-feasibility/gpu-probe.mjs
node tools/water-feasibility/wake-probe.mjs
node tools/water-feasibility/build-report.mjs
\`\`\`

Run in that order: the evaluation writes fresh analysis; the probes append measurements; the final step builds this report. The GPU probes explicitly select this Windows machine's RTX 4060. They are not a cross-device benchmark suite. Raw data are in \`artifacts/water-feasibility/analysis.json\`.

## Research used

- [Chentanez and Müller: Real-time Simulation of Large Bodies of Water with Small Scale Details](https://matthias-research.github.io/pages/publications/hfFluid.pdf): height/flow grids coupled to particles, open-boundary absorption, conservation and heightfield limitations. Its published performance is not our engine's performance.
- [SWASH user manual](https://swash.sourceforge.io/online_doc/swashuse/swashuse.html): non-hydrostatic pressure and vertical layers for frequency dispersion in coastal wave/flow modelling.
- [SWASH validation examples](https://swash.sourceforge.io/examples/examples.htm): propagation, dispersion, refraction, reflection/run-up and wet/dry cases relevant to an eventual validation plan.
`;
writeFileSync('docs/WATER-FEASIBILITY.md', document);
console.log('Saved docs/WATER-FEASIBILITY.md');
