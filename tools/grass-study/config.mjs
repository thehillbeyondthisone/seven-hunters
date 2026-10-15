import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const three = resolve(root, '.local/grass-study/node_modules/three/build');
export default {
  root: resolve(root, 'tools/grass-study'),
  base: '/tools/grass-study/',
  publicDir: resolve(root, '.local/grass-study/terra/public/js/vendor'),
  resolve: { alias: [
    { find: 'three/webgpu', replacement: resolve(three, 'three.webgpu.js') },
    { find: 'three/tsl', replacement: resolve(three, 'three.tsl.js') },
    { find: /^three$/, replacement: resolve(three, 'three.module.js') },
  ] },
  optimizeDeps: { noDiscovery: true, include: ['three/webgpu', 'three/tsl'] },
  server: { host: '127.0.0.1', port: 5192, strictPort: true, open: '/tools/grass-study/', fs: { allow: [root] } },
};
