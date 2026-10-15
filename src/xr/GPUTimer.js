import { GPU } from '../engine/gpu/GPU.js';

export function eyeTimestampMs( t ) {
	const [ a, b, c, d ] = t;
	if ( b < a || d < c ) return null;
	// Count overlapping pass intervals once, excluding submission gaps.
	const overlap = ( b < d ? b : d ) - ( a > c ? a : c );
	const ms = Number( b - a + d - c - ( overlap > 0n ? overlap : 0n ) ) / 1e6;
	// Timestamp quantization can collapse tiny passes to zero.
	return Number.isFinite( ms ) && ms > 0 && ms < 1000 ? ms : null;
}

// Asynchronous eye-pass timestamps; excludes simulation, shadows and transfer.
export class XRGPUTimer {
	constructor() {
		this.enabled = GPU.hasTimestamp;
		this.sequence = 0; this.frame = 0; this.generation = 0;
		if ( ! this.enabled ) return;
		this.queries = GPU.device.createQuerySet( { type: 'timestamp', count: 4 } );
		this.resolve = GPU.device.createBuffer( { label: 'XR timing resolve', size: 32, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC } );
		this.read = GPU.device.createBuffer( { label: 'XR timing readback', size: 32, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ } );
	}
	reset() { this.latest = null; this.frame = 0; this.generation ++; }
	beginFrame() { this.sampling = this.enabled && ! this.busy && this.frame ++ % 30 === 0; }
	writes( eye ) {
		return this.sampling && eye < 2 ? { querySet: this.queries, beginningOfPassWriteIndex: eye * 2, endOfPassWriteIndex: eye * 2 + 1 } : undefined;
	}
	finish( eyes ) {
		if ( ! this.sampling || eyes !== 2 ) return;
		this.busy = true;
		const generation = this.generation;
		const encoder = GPU.getEncoder();
		encoder.resolveQuerySet( this.queries, 0, 4, this.resolve, 0 );
		encoder.copyBufferToBuffer( this.resolve, 0, this.read, 0, 32 );
		GPU.onSubmit( null, () => {
			this.read.mapAsync( GPUMapMode.READ ).then( () => {
				const t = new BigUint64Array( this.read.getMappedRange().slice( 0 ) );
				this.read.unmap();
				const ms = eyeTimestampMs( t );
				if ( generation === this.generation && ms !== null ) this.latest = { sequence: ++ this.sequence, ms };
			} ).catch( () => {} ).finally( () => { this.busy = false; } );
		} );
	}
	dispose() { this.enabled = false; this.reset(); this.queries?.destroy(); this.resolve?.destroy(); this.read?.destroy(); }
}
