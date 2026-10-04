import { defineConfig } from 'vite';

export default defineConfig( {
	// Relative assets let the release run under /seven-hunters/ on GitHub Pages.
	base: './',
	build: { target: 'esnext', chunkSizeWarningLimit: 4000 },
	server: { port: 5188, strictPort: true, host: '127.0.0.1' },
} );
