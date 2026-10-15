// A bounded sample window for headset diagnostics. CPU submission time is not
// GPU time; the XR callback interval also includes browser/runtime scheduling.
export class SessionStats {

	constructor( scale, frameRate = 72 ) {

		this.scale = scale;
		this.frameRate = frameRate;
		this.frames = 0;
		this.frameIntervalMs = 0;
		this.cpuMs = 0;
		this.maxCpuMs = 0;
		this.longIntervals = 0;
		this.samples = [];
		this.pauses = 0;
		this.gpuSamples = [];
		this.gpuSequence = null;

	}

	record( interval, cpu, location, metrics = {} ) {

		this.frames ++;
		this.frameIntervalMs = interval;
		this.cpuMs = cpu;
		this.maxCpuMs = Math.max( this.maxCpuMs, cpu );
		if ( interval > 1500 / this.frameRate ) this.longIntervals ++;
		this.samples[ ( this.frames - 1 ) % 512 ] = { interval, cpu, location, ...metrics };
		this.lastMetrics = metrics;
		if ( metrics.gpu && Number.isFinite( metrics.gpu.ms ) && metrics.gpu.ms > 0 && metrics.gpu.sequence !== this.gpuSequence ) {
			this.gpuSequence = metrics.gpu.sequence;
			this.gpuSamples.push( metrics.gpu.ms );
			if ( this.gpuSamples.length > 128 ) this.gpuSamples.shift();
		}

	}

	report() {

		const percentile = ( key ) => {
			const values = this.samples.map( s => s[ key ] ).filter( Number.isFinite ).sort( ( a, b ) => a - b );
			return values.length ? values[ Math.ceil( values.length * 0.95 ) - 1 ] : null;
		};
		const gpu = [ ...this.gpuSamples ].sort( ( a, b ) => a - b );
		return {
			frames: this.frames, scale: this.scale, frameRate: this.frameRate,
			intervalP95Ms: percentile( 'interval' ), cpuP95Ms: percentile( 'cpu' ),
			maxCpuMs: this.maxCpuMs, longIntervals: this.longIntervals, pauses: this.pauses,
			sampleWindow: this.samples.length, gpuTimingMeasured: gpu.length > 0,
			gpuEyeP95Ms: gpu.length ? gpu[ Math.ceil( gpu.length * .95 ) - 1 ] : null, gpuSamples: gpu.length,
			eyeCpuP95Ms: percentile( 'eyeCpuMs' ), transferCpuP95Ms: percentile( 'transferCpuMs' ),
			grassTrianglesPerEye: this.lastMetrics?.grassTrianglesPerEye || 0, sampleCount: this.lastMetrics?.sampleCount || 1,
		};

	}

}
