import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import config from './config.mjs';

const url = 'http://127.0.0.1:5192/tools/grass-study/';
const open = !process.argv.includes('--no-open');
let existing = false;
try {
  const response = await fetch(url, { signal: AbortSignal.timeout(1200) });
  existing = response.ok && (await response.text()).includes('<title>Seven Hunters · Grass studies</title>');
} catch { /* A first launch has no server yet. */ }
if (existing) {
  console.log(`Grass study already running: ${url}`);
  if (open) {
    const command = process.platform === 'win32' ? 'cmd.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    const args = process.platform === 'win32' ? ['/d', '/c', 'start', '""', url] : [url];
    spawn(command, args, { windowsHide: true, stdio: 'ignore' }).unref();
  }
} else {
  const server = await createServer({ ...config, configFile: false, server: { ...config.server, open: open ? '/tools/grass-study/' : false } });
  await server.listen();
  server.printUrls();
}
