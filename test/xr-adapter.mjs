import assert from 'node:assert/strict';
import { GPU } from '../src/engine/gpu/GPU.js';

const originalNavigator = Object.getOwnPropertyDescriptor( globalThis, 'navigator' );
const device = { queue: {}, limits: {}, lost: new Promise( () => {} ), addEventListener() {}, createSampler: () => ( {} ) };
const adapter = { limits: {}, features: new Set(), async requestDevice() { return device; } };
let calls;
const mock = request => {
	calls = [];
	Object.defineProperty( globalThis, 'navigator', { configurable: true, value: { gpu: {
		async requestAdapter( options ) { calls.push( options ); return request( options ); },
	} } } );
};
const xrOptions = { powerPreference: 'high-performance', xrCompatible: true };
const ordinaryOptions = { powerPreference: 'high-performance' };
try {
	mock( () => adapter ); await GPU.init( { headless: true, xrCompatible: true } );
	assert.deepEqual( calls, [ xrOptions ] ); assert.equal( GPU.xrCompatible, true ); assert.equal( GPU.adapter, adapter );
	console.log( 'PASS native XR adapter succeeds without requesting an ordinary adapter.' );

	mock( options => options.xrCompatible ? null : adapter ); await GPU.init( { headless: true, xrCompatible: true } );
	assert.deepEqual( calls, [ xrOptions, ordinaryOptions ] ); assert.equal( GPU.xrCompatible, false ); assert.equal( GPU.device, device );
	mock( options => { if ( options.xrCompatible ) throw Error( 'Experimental XR adapter rejected' ); return adapter; } );
	await GPU.init( { headless: true, xrCompatible: true } ); assert.deepEqual( calls, [ xrOptions, ordinaryOptions ] ); assert.equal( GPU.xrCompatible, false );
	console.log( 'PASS absent or rejected native XR adapter retains ordinary WebGPU rendering for compatibility mode.' );

	mock( () => adapter ); await GPU.init( { headless: true } );
	assert.deepEqual( calls, [ ordinaryOptions ] ); assert.equal( GPU.xrCompatible, false );
	mock( () => null ); await assert.rejects( GPU.init( { headless: true } ), /No WebGPU adapter found/ );
	assert.deepEqual( calls, [ ordinaryOptions ] );
	mock( () => null ); await assert.rejects( GPU.init( { headless: true, xrCompatible: true } ), /No WebGPU adapter found/ );
	assert.deepEqual( calls, [ xrOptions, ordinaryOptions ] );
	mock( options => { if ( options.xrCompatible ) return null; throw Error( 'Ordinary adapter failed' ); } );
	await assert.rejects( GPU.init( { headless: true, xrCompatible: true } ), /Ordinary adapter failed/ );
	assert.deepEqual( calls, [ xrOptions, ordinaryOptions ] );
	Object.defineProperty( globalThis, 'navigator', { configurable: true, value: {} } );
	await assert.rejects( GPU.init( { headless: true, xrCompatible: true } ), /WebGPU is not available/ );
	console.log( 'PASS plain adapter is requested once; no adapter, ordinary failures and missing WebGPU stay visible.' );
} finally {
	if ( originalNavigator ) Object.defineProperty( globalThis, 'navigator', originalNavigator ); else delete globalThis.navigator;
}
