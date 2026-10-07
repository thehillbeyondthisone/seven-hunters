import { createServer } from 'vite';
import { readFileSync, existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { X509Certificate } from 'node:crypto';

const root = resolve( dirname( fileURLToPath( import.meta.url ) ), '../..' );
// Reuse the existing local certificate tooling and certificate; no trust changes.
const certDir = join( root, '.local', 'xr' );
const addresses = [ '127.0.0.1', ...new Set( Object.values( networkInterfaces() ).flat().filter( i => i?.family === 'IPv4' && ! i.internal ).map( i => i.address ) ) ];
const networks = Object.entries( networkInterfaces() ).flatMap( ( [ name, rows ] ) => rows.filter( i => i?.family === 'IPv4' && ! i.internal ).map( i => ( { name, address:i.address } ) ) );
const wireless = networks.filter( i => /wi-?fi|wlan|wireless/i.test( i.name ) );
const phoneNetworks = wireless.length ? wireless : networks.filter( i => ! /vethernet|virtual|wsl|docker|loopback/i.test( i.name ) );
let renew = ! existsSync( join( certDir, 'cert.pem' ) ) || ! existsSync( join( certDir, 'key.pem' ) );
if ( ! renew ) {
	const cert = new X509Certificate( readFileSync( join( certDir, 'cert.pem' ) ) );
	renew = Date.parse( cert.validTo ) < Date.now() + 86400000 || addresses.some( ip => ! cert.checkIP( ip ) );
}
if ( renew ) {
	console.log( 'Creating the local HTTPS certificate…' );
	const generated = spawnSync( 'pwsh', [ '-NoProfile', '-File', join( root, 'tools', 'xr', 'certificate.ps1' ), '-OutputDirectory', certDir, '-Addresses', addresses.join( ',' ) ], { stdio:'inherit', windowsHide:true } );
	if ( generated.error || generated.status !== 0 ) throw generated.error || new Error( 'Certificate generation failed. PowerShell 7 (pwsh) is required.' );
}
const server = await createServer( { configFile:join( root, 'vite.config.js' ), root,
	server:{ host:'0.0.0.0', port:5444, strictPort:false,
		https:{ cert:readFileSync( join( certDir, 'cert.pem' ) ), key:readFileSync( join( certDir, 'key.pem' ) ) },
		fs:{ deny:[ '**/.git/**', '**/.env', '**/.env.*', '**/.local/**', '**/*.pem', '**/*.key', '**/*.pfx' ] },
	},
} );
server.middlewares.use( ( req, res, next ) => {
	if ( req.url !== '/mobile-certificate.cer' ) return next();
	res.setHeader( 'Content-Type', 'application/pkix-cert' );
	res.setHeader( 'Content-Disposition', 'attachment; filename="seven-hunters-local.cer"' );
	res.end( readFileSync( join( certDir, 'certificate.cer' ) ) );
} );
await server.listen();
const port = server.httpServer.address().port;
console.log( '\nSeven Hunters — mobile play\n' );
console.log( `Desktop touch review: https://127.0.0.1:${ port }/?mobile` );
for ( const network of phoneNetworks ) console.log( `Phone on the same network (${ network.name }): https://${ network.address }:${ port }/?mobile` );
console.log( '\nUse Safari on iPhone/iPad, or a WebGPU-capable browser on Android. Landscape is recommended.' );
console.log( 'WebGPU needs a secure connection. This local certificate is self-signed; see docs/MOBILE.md for phone trust setup.' );
console.log( 'Private keys stay local. Existing servers and certificate trust settings are left alone.' );
console.log( 'Press Ctrl+C to stop.\n' );
for ( const signal of [ 'SIGINT', 'SIGTERM' ] ) process.once( signal, async () => { await server.close(); process.exit( 0 ); } );
