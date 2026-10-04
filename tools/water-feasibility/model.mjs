// Numerical feasibility probe only. Linear depth-averaged waves with horizontal
// face velocities, fixed wet/dry mask and reflecting walls. No production imports,
// breaking, moving shoreline, spray or nonlinear flow. Do not ship as coastal physics.
export const gravity = 9.81;
export function waveProperties(depth, period) {
	const omega = 2 * Math.PI / period;
	let lo = 0, hi = Math.max(omega * omega / gravity, omega / Math.sqrt(gravity * depth)) * 4;
	for (let i = 0; i < 80; i++) {
		const k = (lo + hi) / 2;
		if (gravity * k * Math.tanh(k * depth) > omega * omega) hi = k; else lo = k;
	}
	const k = (lo + hi) / 2, exact = omega / k, shallow = Math.sqrt(gravity * depth);
	// Uniform-depth response of WakeSim.js's current four blended operators.
	// This analytical comparison does not test its coastline boundary treatment.
	let weights;
	if (depth > 6) { const w = 1 - Math.exp(-(depth - 6) / 9); weights = [w, 1 - w, 0, 0]; }
	else if (depth > 1.8) { const w = ((depth - 1.8) / 4.2) ** 0.8; weights = [0, w, 1 - w, 0]; }
	else if (depth > 0.6) { const w = ((depth - 0.6) / 1.2) ** 0.85; weights = [0, 0, w, 1 - w]; }
	else weights = [0, 0, 0, Math.min(1, depth / 0.6)];
	const dispersion = weights[0] + weights[1] * Math.tanh(k * 6) + weights[2] * Math.tanh(k * 1.8) + weights[3] * Math.tanh(k * 0.6);
	const wakeSpeed = Math.sqrt(gravity / k * dispersion);
	return { depth, period, wavelength: 2 * Math.PI / k, exactSpeed: exact,
		shallowSpeed: shallow, speedErrorPercent: 100 * (shallow / exact - 1),
		currentWakeSpeed: wakeSpeed, currentWakeSpeedErrorPercent: 100 * (wakeSpeed / exact - 1) };
}
export function faceDepth(a, b) { return a > 0 && b > 0 ? 2 * a * b / (a + b) : 0; }
export function initialPacket(n, depth, dx, center = n * 0.25, width = n * 0.07) {
	const s = new Float32Array(n * n * 4);
	for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
		const i = y * n + x, h = Math.exp(-0.5 * ((x - center) / width) ** 2) * 0.2;
		if (depth[i] <= 0) continue;
		s[4 * i] = h;
		const d = x < n - 1 ? faceDepth(depth[i], depth[i + 1]) : 0;
		s[4 * i + 1] = d > 0 ? h * Math.sqrt(gravity / d) : 0;
	}
	return s;
}
export function stepCPU(state, depth, n, dx, dt, scratch = new Float32Array(state.length)) {
	for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
		const i = y * n + x, j = i * 4, h = state[j];
		scratch[j] = h;
		scratch[j + 1] = x < n - 1 && faceDepth(depth[i], depth[i + 1]) > 0 ? state[j + 1] - gravity * dt / dx * (state[j + 4] - h) : 0;
		scratch[j + 2] = y < n - 1 && faceDepth(depth[i], depth[i + n]) > 0 ? state[j + 2] - gravity * dt / dx * (state[j + n * 4] - h) : 0;
	}
	for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
		const i = y * n + x, j = i * 4;
		const east = x < n - 1 ? faceDepth(depth[i], depth[i + 1]) * scratch[j + 1] : 0;
		const west = x > 0 ? faceDepth(depth[i], depth[i - 1]) * scratch[j - 3] : 0;
		const north = y < n - 1 ? faceDepth(depth[i], depth[i + n]) * scratch[j + 2] : 0;
		const south = y > 0 ? faceDepth(depth[i], depth[i - n]) * scratch[j - n * 4 + 2] : 0;
		state[j] = depth[i] > 0 ? scratch[j] - dt / dx * (east - west + north - south) : 0;
		state[j + 1] = scratch[j + 1]; state[j + 2] = scratch[j + 2];
	}
	return state;
}
export function stats(state, depth) {
	let mass = 0, peak = 0, energy = 0, dryPeak = 0, finite = true;
	for (let i = 0; i < depth.length; i++) {
		const h = state[i * 4], u = state[i * 4 + 1], v = state[i * 4 + 2];
		finite &&= Number.isFinite(h) && Number.isFinite(u) && Number.isFinite(v);
		if (depth[i] > 0) { mass += h; peak = Math.max(peak, Math.abs(h)); energy += gravity * h * h + depth[i] * (u * u + v * v); }
		else dryPeak = Math.max(dryPeak, Math.abs(h));
	}
	return { mass, peak, energy, dryPeak, finite };
}
export function wgsl(n, dx, dt) {
	return `
@group(0) @binding(0) var<storage, read> src: array<vec4f>;
@group(0) @binding(1) var<storage, read_write> dst: array<vec4f>;
@group(0) @binding(2) var<storage, read> depth: array<f32>;
const N: u32 = ${n}u;
const R: f32 = ${Number(dt / dx).toPrecision(12)};
fn face(a: f32, b: f32) -> f32 {
 if (a <= 0.0 || b <= 0.0) { return 0.0; }
 return 2.0 * a * b / (a + b);
}
@compute @workgroup_size(8, 8)
fn velocity(@builtin(global_invocation_id) p: vec3u) {
 if (p.x >= N || p.y >= N) { return; }
 let i = p.y * N + p.x; let s = src[i];
 var u = 0.0; var v = 0.0;
 if (p.x + 1u < N && face(depth[i], depth[i + 1u]) > 0.0) { u = s.y - 9.81 * R * (src[i + 1u].x - s.x); }
 if (p.y + 1u < N && face(depth[i], depth[i + N]) > 0.0) { v = s.z - 9.81 * R * (src[i + N].x - s.x); }
 dst[i] = vec4f(s.x, u, v, 0.0);
}
@compute @workgroup_size(8, 8)
fn height(@builtin(global_invocation_id) p: vec3u) {
 if (p.x >= N || p.y >= N) { return; }
 let i = p.y * N + p.x;
 var east = 0.0; var west = 0.0; var north = 0.0; var south = 0.0;
 if (p.x + 1u < N) { east = face(depth[i], depth[i + 1u]) * src[i].y; }
 if (p.x > 0u) { west = face(depth[i], depth[i - 1u]) * src[i - 1u].y; }
 if (p.y + 1u < N) { north = face(depth[i], depth[i + N]) * src[i].z; }
 if (p.y > 0u) { south = face(depth[i], depth[i - N]) * src[i - N].z; }
 var h = 0.0;
 if (depth[i] > 0.0) { h = src[i].x - R * (east - west + north - south); }
 dst[i] = vec4f(h, src[i].y, src[i].z, 0.0);
}`;
}
