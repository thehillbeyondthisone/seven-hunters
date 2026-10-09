// Check the running local HTTPS server without changing any certificate trust.
import assert from 'node:assert/strict';
import https from 'node:https';
import { readFileSync } from 'node:fs';
import { X509Certificate } from 'node:crypto';
import { spawn } from 'node:child_process';

let server, origin = `https://127.0.0.1:${ Number( process.env.XR_PORT ) || 5443 }`;
if ( process.argv.includes( '--spawn' ) ) {
	// Launch and probe in one process tree, which also works in isolated test
	// environments where another shell's loopback server is not reachable.
	server = spawn( process.execPath, ['tools/xr/serve.mjs'], { env: { ...process.env, XR_PORT: process.env.XR_PORT || '5543' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] } );
	await new Promise( ( resolve, reject ) => {
		let output = '';
		const timer = setTimeout( () => reject( Error( 'HTTPS server did not become ready' ) ), 30000 );
		server.once( 'error', reject );
		server.once( 'exit', code => { clearTimeout( timer ); reject( Error( `HTTPS server exited ${ code }` ) ); } );
		server.stderr.on( 'data', data => { output += data; } );
		server.stdout.on( 'data', data => {
			output += data;
			const ready = output.match( /Desktop: (https:\/\/127\.0\.0\.1:\d+)\/\?vr/ );
			if ( ready ) { origin = ready[1]; clearTimeout( timer ); resolve(); }
		} );
	} ).catch( error => { server.kill(); throw error; } );
}
const get = path => new Promise( ( resolve, reject ) => {
	const req = https.get( origin + path, { rejectUnauthorized: false }, res => {
		const chunks = [];
		res.on( 'data', chunk => chunks.push( chunk ) );
		res.on( 'end', () => {
			const bytes = Buffer.concat( chunks );
			resolve( { status: res.statusCode, body: bytes.toString( 'utf8' ), bytes, type: res.headers['content-type'] } );
		} );
	} );
	req.on( 'error', reject ); req.setTimeout( 10000, () => req.destroy( Error( 'Local HTTPS server timed out' ) ) );
} );
try {
const page = await get( '/?vr' ); assert.equal( page.status, 200 ); assert.match( page.body, /Seven Hunters/ );
const cert = new X509Certificate( readFileSync( '.local/xr/cert.pem' ) );
assert.ok( cert.checkIP( '127.0.0.1' ) ); assert.ok( Date.parse( cert.validTo ) > Date.now() );
const publicCert = await get( '/xr-preview-certificate.cer' );
assert.equal( publicCert.status, 200 ); assert.equal( publicCert.type, 'application/pkix-cert' );
assert.equal( new X509Certificate( publicCert.bytes ).fingerprint256, cert.fingerprint256 );
for ( const path of [ '/.local/xr/key.pem', '/@fs/' + process.cwd().replaceAll( '\\', '/' ) + '/.local/xr/key.pem', '/.git/config' ] ) {
	const response = await get( path );
	assert.ok( [ 403, 404 ].includes( response.status ), 'Private route is not denied' );
	assert.ok( !response.body.includes( 'PRIVATE KEY' ), 'Private material was exposed' );
}
console.log( 'PASS local HTTPS page, unexpired address-matching certificate, public certificate route and denied private routes.' );
console.log( 'This verifies the PC endpoint. Headset reachability and certificate trust still require the Quest.' );
} finally { server?.kill(); }
