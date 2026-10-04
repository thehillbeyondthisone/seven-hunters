// Run from the project root: node tools/water-feasibility/evaluate.mjs
// Writes only artifacts/water-feasibility. No game code or saved nights are touched.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import assert from 'node:assert/strict';
import { gravity, waveProperties, initialPacket, stepCPU, stats } from './model.mjs';
const root = resolve('public/terrain/flannan');
globalThis.fetch = async url => new Response(readFileSync(resolve(root, basename(String(url).replaceAll('\\', '/')))));
const { loadFlannanData } = await import('../../src/world/flannan/FlannanData.js');
const { FlannanTerrainData } = await import('../../src/world/flannan/FlannanTerrain.js');
const { buildStation } = await import('../../src/world/flannan/Station.js');
const { Builder } = await import('../../src/world/village/GeoBuilder.js');
const { InstancedProps, Rand } = await import('../../src/world/Props.js');
const { Colliders } = await import('../../src/world/Colliders.js');
const { mulberry32 } = await import('../../src/util/Noise.js');
const F = await loadFlannanData(), terrain = new FlannanTerrainData(F.grids.island);
const B = new Builder(), colliders = new Colliders(), lights = [], checks = [];
const village = { buildings: [], footprints: [] };
buildStation({ B, terrain, colliders, rand: new Rand(mulberry32(90210)), lights, checks, inst: new InstancedProps(B) }, village);
const out = resolve('artifacts/water-feasibility'); mkdirSync(out, { recursive: true });
const quantile = (values, q) => values[Math.floor((values.length - 1) * q)];
const patches = [];
for (const name of ['west', 'east']) {
	const landing = terrain.landing(name), n = 128, cell = 2, heights = [], wet = [], transect = [];
	const [dx, dz] = landing.dir;
	for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
		const along = -40 + (x + 0.5) * cell, across = -128 + (y + 0.5) * cell;
		const height = terrain.heightAt(landing.stage.x + dx * along - dz * across, landing.stage.z + dz * along + dx * across);
		heights.push(Number(height.toFixed(4))); if (height < -0.05) wet.push(-height);
	}
	wet.sort((a, b) => a - b);
	for (let along = 0; along <= 200; along += 5) transect.push({ offshore: along, depth: Math.max(0, -terrain.heightAt(landing.stage.x + dx * along, landing.stage.z + dz * along)) });
	const depthQuantiles = [0.1, 0.5, 0.9].map(q => ({ quantile: q, depth: quantile(wet, q) }));
	patches.push({ name, n, cell, stage: landing.stage, direction: landing.dir, heights, wetFraction: wet.length / heights.length,
		depthQuantiles, transect, dispersion: depthQuantiles.flatMap(({ quantile, depth }) => [9, 14].map(period => ({ quantile, ...waveProperties(depth, period) }))) });
}
// Tests exercise observable behaviour, not only the formula's implementation.
const checksRun = [];
const check = (name, fn) => { const detail = fn(); checksRun.push({ name, passed: true, ...detail }); console.log('PASS', name, JSON.stringify(detail)); };
check('lake at rest on variable depth including a dry wall', () => {
	const n = 48, d = Float32Array.from({ length: n * n }, (_, i) => i % n > 38 ? 0 : 1 + (i % n) * 0.6);
	const s = new Float32Array(n * n * 4), scratch = new Float32Array(s.length);
	for (let i = 0; i < 200; i++) stepCPU(s, d, n, 1, 0.01, scratch);
	assert.equal(stats(s, d).peak, 0); return { maxSurfaceMotion: 0 };
});
check('reflection and returning flow at a solid wall', () => {
	const n = 96, wall = 78, depth = 12, dx = 1;
	const d = Float32Array.from({ length: n * n }, (_, i) => i % n >= wall ? 0 : depth);
	const s = initialPacket(n, d, dx, 25, 6), scratch = new Float32Array(s.length), start = stats(s, d);
	const dt = 0.018, steps = 550; let crestAtWall = 0, returnedVelocity = 0;
	for (let t = 0; t < steps; t++) {
		stepCPU(s, d, n, dx, dt, scratch);
		crestAtWall = Math.max(crestAtWall, s[((n / 2) * n + wall - 1) * 4]);
		if (t > 350) returnedVelocity = Math.min(returnedVelocity, s[((n / 2) * n + 55) * 4 + 1]);
	}
	const end = stats(s, d), drift = Math.abs(end.mass - start.mass) / Math.abs(start.mass);
	assert.ok(end.finite && end.dryPeak === 0 && drift < 1e-5);
	assert.ok(crestAtWall > 0.3 && returnedVelocity < -0.08);
	return { crestAtWall, returnedVelocity, relativeMassDrift: drift, dryLandMotion: end.dryPeak };
});
check('ten-minute reconstructed west landing stability, no forcing or damping', () => {
	const patch = patches[0], n = 64, d = new Float32Array(n * n);
	for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) d[y * n + x] = Math.max(0, -patch.heights[(y * 2) * 128 + x * 2]);
	const s = initialPacket(n, d, 4), scratch = new Float32Array(s.length), start = stats(s, d);
	const dt = 0.04, steps = 15000;
	for (let i = 0; i < steps; i++) stepCPU(s, d, n, 4, dt, scratch);
	const end = stats(s, d), drift = Math.abs(end.mass - start.mass) / Math.abs(start.mass);
	assert.ok(end.finite && end.dryPeak === 0 && drift < 1e-4 && end.peak < 0.8);
	return { simulatedSeconds: dt * steps, relativeMassDrift: drift, peakSurfaceHeight: end.peak, dryLandMotion: end.dryPeak };
});
const depthCases = [2, 6, 12, 30, 60, 90].flatMap(depth => [9, 14].map(period => waveProperties(depth, period)));
const report = { generated: new Date().toISOString(), scope: 'Isolated mathematical/compute feasibility study. No production integration or fluid visual acceptance.',
	terrain: 'Current Flannan reconstructed heightfield after station grading. Near-coast bathymetry is procedural, not a measured coastal survey.',
	model: 'Linear depth-averaged wave probe, fixed wet/dry mask, closed boundaries; no dispersion correction, nonlinear advection, moving shoreline, overturning or spray.',
	checks: checksRun, depthCases, patches };
writeFileSync(resolve(out, 'analysis.json'), JSON.stringify(report, null, 2));
console.log('Depth samples:', JSON.stringify(patches.map(p => ({ name: p.name, wetFraction: p.wetFraction, depthQuantiles: p.depthQuantiles, dispersion: p.dispersion }))));
