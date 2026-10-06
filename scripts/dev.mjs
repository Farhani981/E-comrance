import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const children = new Set();
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
function launch(args, cwd, env = process.env) {
  const child = spawn(process.execPath, args, { cwd, env, stdio: 'inherit', windowsHide: true });
  children.add(child);
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => { children.delete(child); if (!stopping) stop(code ?? 1); });
  return child;
}
async function available() {
  try {
    const response = await fetch('http://127.0.0.1:5000/', { signal: AbortSignal.timeout(1000) });
    const data = await response.json();
    return response.ok && data.success && data.endpoints?.auth === '/api/auth';
  } catch { return false; }
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
try {
  if (await available()) console.log('Using the running ShopHub backend on port 5000.');
  else {
    console.log('Starting ShopHub backend...');
    launch(['--watch', 'server.js'], path.join(root, 'server'), { ...process.env, PORT: '5000' });
    let ready = false;
    for (let attempt = 0; attempt < 60 && !stopping; attempt++) {
      if (await available()) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error('Backend did not start. Check the server output above and ensure port 5000 is available.');
  }
  if (!stopping) launch([path.join(root, 'my-app/node_modules/vite/bin/vite.js'), ...process.argv.slice(2)], path.join(root, 'my-app'));
} catch (error) { console.error(error.message); stop(1); }
