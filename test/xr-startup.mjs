import assert from 'node:assert/strict';
import { configureXRLaunch, isQuestBrowser } from '../src/xr/Startup.js';
import { configurePreview, supportMessage } from '../src/xr/PreviewOptions.js';
import { configureMobile } from '../src/mobile/MobileOptions.js';

const quest = { navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 12; Quest 3) OculusBrowser/42.0' } };
assert.equal( isQuestBrowser( quest ), true );
const auto = new URLSearchParams();
assert.equal( await configureXRLaunch( auto, quest ), true );
assert.equal( auto.has( 'vr' ), true );
assert.equal( configurePreview( auto ), true );
assert.equal( auto.has( 'nostory' ), true, 'detected Quest cannot open a normal-watch save' );
assert.equal( configureMobile( auto, quest ), false, 'Quest is not mistaken for an Android phone' );
console.log( 'PASS Quest detection selects isolated VR before mobile/story setup, even without experimental WebGPU XR' );

let probes = 0;
const headset = { isSecureContext: true, navigator: { xr: { async isSessionSupported( mode ) {
	assert.equal( mode, 'immersive-vr' ); probes ++; return true;
} } } };
const detected = new URLSearchParams( 'xrScale=0.5' );
assert.equal( await configureXRLaunch( detected, headset ), true );
assert.equal( detected.get( 'xrScale' ), '0.5' );
assert.equal( probes, 1 );
for ( const search of [ 'vr', 'desktop', 'mobile', 'mobile=0', 'bench', 'view=fApproach', 'nostory', 'setting=tidewater',
	'morningPreview', 'keeperPreview', 'weatherObservationsPreview', 'arrivalPreview', 'interiorPreview', 'simulation', 'seaDread', 'playground', 'disco', 'devWeapons' ] ) {
	const qs = new URLSearchParams( search ), before = qs.toString();
	assert.equal( await configureXRLaunch( qs, headset ), false );
	assert.equal( qs.toString(), before );
}
assert.equal( probes, 1, 'explicit routes do not probe or enter immersive mode' );
console.log( 'PASS capability-based headset detection preserves explicit routes, scale and flat-browser opt-out' );

for ( const env of [ {}, { navigator: { userAgent: 'Android Chrome/140' } }, { ...headset, isSecureContext: false },
	{ isSecureContext: true, navigator: { xr: { isSessionSupported: async () => false } } },
	{ isSecureContext: true, navigator: { xr: { isSessionSupported: () => { throw Error( 'Permission denied' ); } } } },
	{ isSecureContext: true, navigator: { xr: { isSessionSupported: async () => { throw Error( 'Runtime unavailable' ); } } } },
	{ isSecureContext: true, navigator: { xr: { isSessionSupported: () => new Promise( () => {} ) } } } ] ) {
	const qs = new URLSearchParams();
	assert.equal( await configureXRLaunch( qs, env, { timeoutMs: 5 } ), false );
	assert.equal( qs.toString(), '' );
}
console.log( 'PASS desktop/phone, permission rejection and stalled XR probes keep normal startup usable' );

const base = { isSecureContext: true, navigator: { gpu: {}, xr: {} } };
assert.equal( supportMessage( { ...base, XRGPUBinding: function () {} } ), null );
assert.equal( supportMessage( { ...base, XRWebGLLayer: function () {} } ), null );
assert.match( supportMessage( base ), /presentation layer/ );
assert.doesNotMatch( supportMessage( base ), /[Uu]pdate/ );
assert.match( supportMessage( { ...base, isSecureContext: false } ), /HTTPS/ );
console.log( 'PASS standard WebXR presentation is allowed without XRGPUBinding; error does not invent an outdated browser' );
