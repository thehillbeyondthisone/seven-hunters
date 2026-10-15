import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const local = resolve(root, '.local/grass-study');
const projects = [
  ['field-grass', 'https://github.com/matthew-kissinger/threejs-field-grass.git', '2a0d3a3256dc8d8f6d9de68f3dc1636a621559c5'],
  ['terra', 'https://github.com/spacejack/terra.git', 'ed8d04dfc52874fbd1489ac7a39638092619a618'],
];
function run(command, args, cwd = root) {
  const result = command === 'npm.cmd'
    ? spawnSync('cmd.exe', ['/d', '/c', 'npm', ...args], { cwd, stdio: 'inherit' })
    : spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} failed. Check network access and try again.`);
}
mkdirSync(local, { recursive: true });
for (const [name, url, revision] of projects) {
  const dir = resolve(local, name);
  if (!existsSync(dir)) {
    run('git', ['clone', url, dir]);
    run('git', ['checkout', '--detach', revision], dir);
  }
  const actual = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).stdout?.trim();
  if (actual !== revision) throw new Error(`${name} has a different revision. Keep your local changes; use a separate clean copy at ${revision}.`);
}
writeFileSync(resolve(local, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: { three: '0.185.1' } }, null, 2) + '\n');
if (!existsSync(resolve(local, 'node_modules/three/package.json'))) {
  run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], local);
}
console.log('Grass study sources ready. Main game dependencies and saves are unchanged.');
