// Cost probe of the existing boat-wake solver, without changing its source.
// Current landing heights are sampled by a minimal terrain shader. The boat's
// source is present: this is not an incoming-ocean coupling or cliff-impact test.
import '../../test/headless.mjs';
import { create } from 'webgpu';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { GPU, ShaderModule, Texture } from '../../src/engine/webgpu.js';
import { readBuffer } from '../../src/engine/gpu/Readback.js';
import { Vector3 } from '../../src/engine/index.js';
import { G } from '../../src/core/Globals.js';
import { HullLines } from '../../src/world/boat/HullLines.js';
import { WakeSim } from '../../src/ocean/WakeSim.js';
const path = resolve('artifacts/water-feasibility/analysis.json'), report = JSON.parse(readFileSync(path)), patch = report.patches[0];
// Use the same explicitly selected physical adapter as gpu-probe.mjs.
Object.defineProperty(globalThis, 'navigator', { value: { gpu: create(['backend=d3d12', 'adapter=NVIDIA GeForce RTX 4060']) }, configurable: true });
await GPU.init({ headless: true }); GPU.syncPipelines = true;
const errors = []; GPU.device.addEventListener('uncapturederror', e => errors.push(e.error.message));
GPU.device.pushErrorScope('validation');
const texture = new Texture({ width: 128, height: 128, format: 'r32float', data: new Float32Array(patch.heights), usage: ['sample', 'copyDst'] });
const f = x => Number(x).toFixed(10);
const [dx, dz] = patch.direction, stage = patch.stage;
const terrain = { module: new ShaderModule({ name: 'feasibilityTerrain', bindings: { probeHeight: { texture } }, code: `
fn terrainHeightAt(p: vec2f) -> f32 {
 let r = p - vec2f(${f(stage.x)}, ${f(stage.z)});
 let along = dot(r, vec2f(${f(dx)}, ${f(dz)}));
 let across = dot(r, vec2f(${f(-dz)}, ${f(dx)}));
 let c = vec2f((along + 40.0) / 2.0 - 0.5, (across + 128.0) / 2.0 - 0.5);
 if (any(c < vec2f(0.0)) || any(c > vec2f(127.0))) { return -35.0; }
 let q = clamp(c, vec2f(0.0), vec2f(126.999)); let ij = vec2i(floor(q)); let t = fract(q);
 return mix(mix(textureLoad(probeHeight, ij, 0).x, textureLoad(probeHeight, ij + vec2i(1,0), 0).x, t.x),
 mix(textureLoad(probeHeight, ij + vec2i(0,1), 0).x, textureLoad(probeHeight, ij + vec2i(1,1), 0).x, t.x), t.y);
}` }) };
const boat = { model: { lines: new HullLines() }, position: new Vector3(stage.x + dx * 65, 0, stage.z + dz * 65),
	velocity: new Vector3(dx * 2, 0, dz * 2), driven: false, forward: v => v.set(dx, 0, dz) };
const wake = new WakeSim(null, { terrainGPU: terrain, boat });
console.log('Compiling existing wake solver'); await GPU.pipelinesReady();
G.dt.value = 1 / 60; G.time.value = 0; G.seaLevel.value = 0;
for (let i = 0; i < 30; i++) { GPU.beginFrame(); G.time.value += 1 / 60; wake.update(1 / 60); GPU.submit(); }
await GPU.queue.onSubmittedWorkDone();
const batches = 40, framesPerBatch = 8, queries = GPU.device.createQuerySet({ type: 'timestamp', count: batches * 2 });
const resolved = GPU.device.createBuffer({ size: batches * 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
for (let i = 0; i < batches; i++) {
	const pass = GPU.getEncoder().beginComputePass({ timestampWrites: { querySet: queries, beginningOfPassWriteIndex: i * 2, endOfPassWriteIndex: i * 2 + 1 } });
	for (let frame = 0; frame < framesPerBatch; frame++) {
		wake.rowKernel.dispatch(512, { pass }); wake.colKernel.dispatch(512, { pass }); wake.invKernel.dispatch(512, { pass });
	}
	pass.end();
}
GPU.getEncoder().resolveQuerySet(queries, 0, batches * 2, resolved, 0); GPU.submit();
const timestamps = new BigUint64Array(await readBuffer(resolved, resolved.size)), costs = [];
for (let i = 0; i < batches; i++) costs.push(Number(timestamps[i * 2 + 1] - timestamps[i * 2]) / 1e6 / framesPerBatch);
costs.sort((a, b) => a - b);
const state = new Float32Array(await readBuffer(wake.state, 512 * 512 * 16));
assert.ok(state.every(Number.isFinite));
assert.equal(await GPU.device.popErrorScope(), null); assert.deepEqual(errors, []);
report.wakeProbe = { adapter: 'NVIDIA GeForce RTX 4060', backend: 'Dawn D3D12', driver: GPU.adapter.info.description,
	grid: 512, cellMetres: 0.4, windowMetres: 204.8, dispatchesPerStep: 3,
	medianBatchMeanComputeMs: costs[19], p95BatchMeanComputeMs: costs[37], measuredBatches: batches, framesPerBatch, warmupFrames: 30,
	validationErrors: errors, finiteReadback: true,
	conditions: 'Existing WakeSim with boat disturbance and reconstructed landing heights; compute only, repeated fixed uniforms in measured batches. No FFT-ocean forcing, nonlinear run-up or visual acceptance.' };
writeFileSync(path, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report.wakeProbe)); process.exit(0);
