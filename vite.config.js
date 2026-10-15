import { defineConfig } from 'vite';

export default defineConfig( {
	// Relative assets let the release run under /seven-hunters/ on GitHub Pages.
	base: './',
	// The Three.js grass comparisons have their own server and dependencies.
	// Scan the playable entry only, rather than every experimental HTML file.
	optimizeDeps: { entries: [ 'index.html' ] },
	build: { target: 'esnext', chunkSizeWarningLimit: 4000 },
	server: { port: 5188, strictPort: true, host: '127.0.0.1' },
} );
