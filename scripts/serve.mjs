// Launches `vite preview` detached so it survives after this script exits.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const p = spawn('cmd', ['/c', 'npm.cmd run preview -- --port 4173'], {
  cwd: root,
  detached: true,
  stdio: 'ignore',
});
p.unref();
