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

	}

	record( interval, cpu, location ) {

		this.frames ++;
		this.frameIntervalMs = interval;
		this.cpuMs = cpu;
		this.maxCpuMs = Math.max( this.maxCpuMs, cpu );
		if ( interval > 1500 / this.frameRate ) this.longIntervals ++;
		this.samples[ ( this.frames - 1 ) % 512 ] = { interval, cpu, location };

	}

	report() {

		const percentile = ( key ) => {
			const values = this.samples.map( s => s[ key ] ).sort( ( a, b ) => a - b );
			return values.length ? values[ Math.ceil( values.length * 0.95 ) - 1 ] : null;
		};
		return {
			frames: this.frames, scale: this.scale, frameRate: this.frameRate,
			intervalP95Ms: percentile( 'interval' ), cpuP95Ms: percentile( 'cpu' ),
			maxCpuMs: this.maxCpuMs, longIntervals: this.longIntervals, pauses: this.pauses,
			sampleWindow: this.samples.length, gpuTimingMeasured: false,
		};

	}

}
