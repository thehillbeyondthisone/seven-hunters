import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
export default defineConfig({root,base:'./',build:{target:'esnext',outDir:fileURLToPath(new URL('../../artifacts/water-preview/build',import.meta.url)),emptyOutDir:false,chunkSizeWarningLimit:4000,rollupOptions:{input:fileURLToPath(new URL('../../water-preview.html',import.meta.url))}}});
