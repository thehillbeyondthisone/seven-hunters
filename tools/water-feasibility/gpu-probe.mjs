// Isolated compute-cost probe on the RTX 4060 through Dawn D3D12.
// Includes no game rendering, foam, particles, FFT coupling or moving shoreline.
import { create, globals } from 'webgpu';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { initialPacket, stepCPU, stats, wgsl, gravity } from './model.mjs';
Object.assign(globalThis, globals);
const gpu = create(['backend=d3d12', 'adapter=NVIDIA GeForce RTX 4060']);
// Dawn's provider must remain reachable throughout asynchronous device work.
globalThis.__waterFeasibilityGPU = gpu;
const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
assert.ok(adapter && adapter.features.has('timestamp-query'), 'GPU timestamp query is required for this probe');
const device = await adapter.requestDevice({ requiredFeatures: ['timestamp-query'] });
const errors = []; device.addEventListener('uncapturederror', e => errors.push(e.error.message));
device.pushErrorScope('validation');
const analysisPath = resolve('artifacts/water-feasibility/analysis.json');
const analysis = JSON.parse(readFileSync(analysisPath)), patch = analysis.patches[0];
const results = [];
function buffer(data, usage) {
	const b = device.createBuffer({ size: data.byteLength, usage: usage | GPUBufferUsage.COPY_DST });
	device.queue.writeBuffer(b, 0, data); return b;
}
async function read(b) {
	const stage = device.createBuffer({ size: b.size, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
	const encoder = device.createCommandEncoder(); encoder.copyBufferToBuffer(b, 0, stage, 0, b.size);
	device.queue.submit([encoder.finish()]); await stage.mapAsync(GPUMapMode.READ);
	const copy = stage.getMappedRange().slice(0); stage.unmap(); stage.destroy(); return copy;
}
const quantile = (a, q) => [...a].sort((x, y) => x - y)[Math.floor((a.length - 1) * q)];
for (const n of [128, 256, 512]) {
	console.log('Preparing compute probe', n);
	const dx = 256 / n, depth = new Float32Array(n * n);
	for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
		const px = Math.min(127, Math.floor((x + 0.5) * 128 / n)), py = Math.min(127, Math.floor((y + 0.5) * 128 / n));
		depth[y * n + x] = Math.max(0, -patch.heights[py * 128 + px]);
	}
	const maxDepth = depth.reduce((a, b) => Math.max(a, b), 0);
	const substeps = Math.ceil(Math.sqrt(2 * gravity * maxDepth) / dx * (1 / 60) / 0.4), dt = 1 / (60 * substeps);
	const initial = initialPacket(n, depth, dx);
	const a = buffer(initial, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC), b = buffer(new Float32Array(initial.length), GPUBufferUsage.STORAGE);
	const d = buffer(depth, GPUBufferUsage.STORAGE), module = device.createShaderModule({ code: wgsl(n, dx, dt) });
	const compile = await module.getCompilationInfo(); assert.ok(!compile.messages.some(m => m.type === 'error'), JSON.stringify(compile.messages));
	const vel = device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'velocity' } });
	const height = device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'height' } });
	const group = (pipeline, src, dst) => device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries:
		[{ binding: 0, resource: { buffer: src } }, { binding: 1, resource: { buffer: dst } }, { binding: 2, resource: { buffer: d } }] });
	const vg = group(vel, a, b), hg = group(height, b, a);
	const step = pass => {
		pass.setPipeline(vel); pass.setBindGroup(0, vg); pass.dispatchWorkgroups(Math.ceil(n / 8), Math.ceil(n / 8));
		pass.setPipeline(height); pass.setBindGroup(0, hg); pass.dispatchWorkgroups(Math.ceil(n / 8), Math.ceil(n / 8));
	};
	// CPU/GPU comparison before timing; no rendering or readback inside the measured pass.
	const encoder = device.createCommandEncoder(), pass = encoder.beginComputePass();
	for (let i = 0; i < 40; i++) step(pass); pass.end(); device.queue.submit([encoder.finish()]);
	const output = new Float32Array(await read(a));
	const cpu = initial.slice(), scratch = new Float32Array(cpu.length);
	for (let i = 0; i < 40; i++) stepCPU(cpu, depth, n, dx, dt, scratch);
	let maxDifference = 0;
	for (let i = 0; i < cpu.length; i++) maxDifference = Math.max(maxDifference, Math.abs(cpu[i] - output[i]));
	assert.ok(maxDifference < 1e-5 && stats(output, depth).finite, `CPU/GPU mismatch ${maxDifference}`);
	// Dawn timestamps are quantized to 65.536 us on this adapter. Measure batches
	// rather than claiming zero cost when one small dispatch falls below that quantum.
	const frames = 40, framesPerBatch = 16, queries = device.createQuerySet({ type: 'timestamp', count: frames * 2 });
	const resolved = device.createBuffer({ size: frames * 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
	const bench = device.createCommandEncoder();
	for (let frame = 0; frame < frames + 30; frame++) {
		const timed = frame >= 30, index = (frame - 30) * 2;
		const p = bench.beginComputePass(timed ? { timestampWrites: { querySet: queries, beginningOfPassWriteIndex: index, endOfPassWriteIndex: index + 1 } } : {});
		for (let i = 0; i < substeps * (timed ? framesPerBatch : 1); i++) step(p); p.end();
	}
	bench.resolveQuerySet(queries, 0, frames * 2, resolved, 0); device.queue.submit([bench.finish()]);
	const stamps = new BigUint64Array(await read(resolved)), times = [];
	for (let i = 0; i < frames; i++) times.push(Number(stamps[i * 2 + 1] - stamps[i * 2]) / 1e6 / framesPerBatch);
	const item = { n, cellMetres: dx, patchMetres: 256, substepsPer60HzFrame: substeps, dispatchesPerFrame: substeps * 2,
		storageMiB: (a.size + b.size + d.size) / 1048576, medianBatchMeanComputeMs: quantile(times, 0.5), p95BatchMeanComputeMs: quantile(times, 0.95),
		cpuGpuMaxDifference: maxDifference, measuredBatches: frames, framesPerBatch, warmupFrames: 30 };
	results.push(item); console.log(JSON.stringify(item));
	for (const resource of [a, b, d, resolved, queries]) resource.destroy();
}
assert.equal(await device.popErrorScope(), null); assert.deepEqual(errors, []);
analysis.gpuProbe = { adapter: 'NVIDIA GeForce RTX 4060', backend: 'Dawn D3D12', timestampQuery: true,
	conditions: 'Isolated compute batches; 40 batches of 16 frames following 30 warmup frames. Timestamp quantization is amortized over each batch; these are batch means, not individual frame percentiles. No full-scene/browser/XR cost. Fixed land mask and linear waves only.',
	validationErrors: errors, results };
writeFileSync(analysisPath, JSON.stringify(analysis, null, 2));
device.destroy(); process.exit(0);
