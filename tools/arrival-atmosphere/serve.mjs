import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath( new URL( '../../', import.meta.url ) ), port = 5189;
const url = `http://127.0.0.1:${ port }/artifacts/arrival-atmosphere/index.html`;
const open = () => {

	if ( ! process.argv.includes( '--no-open' ) ) spawn( 'cmd.exe', [ '/c', 'start', '', url ], { windowsHide: true, stdio: 'ignore' } ).unref();

};
try {

	const response = await fetch( `http://127.0.0.1:${ port }/src/App.js`, { signal: AbortSignal.timeout( 1500 ) } );
	if ( response.ok && ( await response.text() ).includes( 'isArrivalAtmosphere' ) ) {

		console.log( `Using the running game server: ${ url }` ); open(); process.exit( 0 );

	}

} catch {}
const server = await createServer( { root, server: { host: '127.0.0.1', port, strictPort: true } } );
try {

	await server.listen(); console.log( `\nArrival atmosphere study\n${ url }\nClose this window to stop the preview server.\n` ); open();

} catch ( e ) {

	console.error( `Could not use port ${ port }: ${ e.message }\nAn existing listener was left running.` );
	await server.close(); process.exit( 1 );

}
for ( const signal of [ 'SIGINT', 'SIGTERM' ] ) process.once( signal, async () => { await server.close(); process.exit( 0 ); } );
