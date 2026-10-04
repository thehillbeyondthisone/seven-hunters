import { createServer } from 'vite';
import { readFileSync, existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { X509Certificate } from 'node:crypto';

const root = resolve( dirname( fileURLToPath( import.meta.url ) ), '../..' );
const certDir = join( root, '.local', 'xr' );
const addresses = [ '127.0.0.1', ...new Set( Object.values( networkInterfaces() ).flat().filter( ( i ) => i && i.family === 'IPv4' && ! i.internal ).map( ( i ) => i.address ) ) ];
let renew = ! existsSync( join( certDir, 'cert.pem' ) ) || ! existsSync( join( certDir, 'key.pem' ) );
if ( ! renew ) {

	const cert = new X509Certificate( readFileSync( join( certDir, 'cert.pem' ) ) );
	renew = Date.parse( cert.validTo ) < Date.now() + 86400000 || addresses.some( ( ip ) => ! cert.checkIP( ip ) );

}
if ( renew ) {

	console.log( 'Creating a local HTTPS certificate (no trust-store changes)…' );
	const generated = spawnSync( 'pwsh', [ '-NoProfile', '-File', join( root, 'tools', 'xr', 'certificate.ps1' ), '-OutputDirectory', certDir, '-Addresses', addresses.join( ',' ) ], { stdio: 'inherit', windowsHide: true } );
	if ( generated.error || generated.status !== 0 ) throw generated.error || new Error( 'Certificate generation failed. PowerShell 7 (pwsh) is required.' );

}
const cert = readFileSync( join( certDir, 'cert.pem' ) );
const server = await createServer( {
	configFile: join( root, 'vite.config.js' ), root,
	server: {
		host: '0.0.0.0', port: Number( process.env.XR_PORT ) || 5443, strictPort: false,
		https: { cert, key: readFileSync( join( certDir, 'key.pem' ) ) },
		// Vite serves the project root; never expose the local certificate's private key.
		fs: { deny: [ '**/.git/**', '**/.env', '**/.env.*', '**/.local/**', '**/*.pem', '**/*.key', '**/*.pfx' ] },
	},
} );
server.middlewares.use( ( req, res, next ) => {

	if ( req.url !== '/xr-preview-certificate.cer' ) return next();
	res.setHeader( 'Content-Type', 'application/pkix-cert' );
	res.setHeader( 'Content-Disposition', 'attachment; filename="seven-hunters-local.cer"' );
	res.end( readFileSync( join( certDir, 'certificate.cer' ) ) );

} );
await server.listen();
const port = server.httpServer.address().port;
console.log( '\nSeven Hunters — local VR preview\n' );
for ( const ip of addresses ) console.log( `${ ip === '127.0.0.1' ? 'Desktop' : 'Quest on the same LAN' }: https://${ ip }:${ port }/?vr` );
console.log( `\nLocal certificate SHA-256: ${ new X509Certificate( cert ).fingerprint256 }` );
console.log( 'The certificate is self-signed. Your browser may require accepting or trusting it before WebXR is available.' );
console.log( 'Quest controls: left stick walk; right stick snap turn; right trigger doors; A next location; B recenter; left Y exit.' );
console.log( 'Press Ctrl+C to stop. Existing servers are left running.\n' );
for ( const signal of [ 'SIGINT', 'SIGTERM' ] ) process.once( signal, async () => { await server.close(); process.exit( 0 ); } );
