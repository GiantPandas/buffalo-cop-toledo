// Boss-aim probe: boots game headless, runs L5 until bossActive, then measures aim.
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const PORT = 4176;
const DEBUG_PORT = 9382;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
function serve(req, res) {
  let u = new URL(req.url, 'http://x').pathname;
  if (u === '/') u = '/index.html';
  const f = path.join(dist, u);
  if (!fs.existsSync(f)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}
const server = http.createServer(serve);
await new Promise((r) => server.listen(PORT, r));

const userData = path.join(os.tmpdir(), 'buffalo-probe-' + Date.now());
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${userData}`,
  '--no-first-run', '--enable-unsafe-swiftshader', `http://127.0.0.1:${PORT}/`
], { stdio: ['ignore', 'pipe', 'pipe'] });
let chromeErr = '';
chrome.stderr.on('data', (d) => { chromeErr += d.toString(); });
process.on('exit', () => { try { chrome.kill(); } catch (e) {} });

async function httpJson(p) { const r = await fetch(`http://127.0.0.1:${DEBUG_PORT}${p}`); return r.json(); }
let target;
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 250));
  try {
    const list = await httpJson('/json/list');
    target = list.find((t) => t.type === 'page' && String(t.url).includes(String(PORT)));
    if (target) break;
  } catch (e) {}
}
if (!target) { console.error('NO TARGET. stderr:', chromeErr.slice(-2000)); process.exit(2); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let msgId = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const { resolve } = pending.get(m.id); pending.delete(m.id); resolve(m.result); }
};
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('timeout ' + method)); } }, 30000);
  });
}
await send('Runtime.enable');
const t0 = Date.now();
while (Date.now() - t0 < 20000) {
  await new Promise((r) => setTimeout(r, 300));
  const st = await send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
  if (st && st.result && st.result.value === 'complete') break;
}

const pageScript = `
(async () => {
  const g = window.__BUFFALO_COP__;
  if (!g) throw new Error('game did not boot');
  // Kill the game's own rAF loop so manual stepping is the only clock.
  window.requestAnimationFrame = () => 0;
  g.renderer.render = (s, c) => { s.updateMatrixWorld(); c.updateMatrixWorld(); };
  try { g.audio.init(); } catch (e) {}
  let t = performance.now();
  const step = (ms) => { t += ms; g.tick(t); };

  g.startLevel(4);
  g.beginLevel();
  g.player.maxHp = 9999; g.player.hp = 9999;

  let steps = 0;
  while (!g.levelManager.bossActive && steps++ < 8000) step(16.7);
  const out = { bossActive: g.levelManager.bossActive, preBossSteps: steps, state: g.state };
  if (!g.levelManager.bossActive) return JSON.stringify(out);

  // Settle the camera on the boss.
  for (let i = 0; i < 300; i++) step(16.7);

  const b = g.levelManager.boss;
  const w = g.player.weapon;
  out.bossPos = b.group.position.toArray();
  out.camPos = g.camera.position.toArray();
  out.ammo = w.ammo;
  out.reloading = w.reloading;
  out.canFireBefore = w.canFire;
  out.activeShootables = g.levelManager.shootables.filter((s) => s.active).length;

  // Instrument hit/miss/obstacle accounting.
  let hits = 0, misses = 0, obstacleHits = 0;
  const oHit = g.onBuffaloHit.bind(g);
  g.onBuffaloHit = (bf, h) => { hits++; oHit(bf, h); };
  const oMiss = g.onMiss.bind(g);
  g.onMiss = () => { misses++; oMiss(); };
  for (const s of g.levelManager.shootables) {
    if (!s.active) continue;
    const os = s.onShot.bind(s);
    s.onShot = (...a) => { obstacleHits++; os(...a); };
  }

  const hpBefore = b.hp;
  let shots = 0;
  const log = [];
  const mark = (i) => log.push({ i, alive: g.player.alive, frozen: g.levelManager.frozen, cd: +w.cooldown.toFixed(3), rel: w.reloading, ammo: w.ammo, state: g.state });
  for (let i = 0; i < 900 && g.state === 'playing'; i++) {
    if (i === 0 || i === 1 || i === 2 || i === 15 || i === 30 || i === 60 || i === 120) mark(i);
    step(16.7);
    g.input.ndc.x = 0; g.input.ndc.y = 0;
    if (g.player.alive && w.canFire) { w.fire(); shots++; }
  }
  out.stepLog = log;

  out.shotsFired = shots;
  out.hpDelta = hpBefore - b.hp;
  out.buffaloHits = hits;
  out.misses = misses;
  out.obstacleHits = obstacleHits;
  out.bossDefeated = !!b.defeated;
  out.stateAfter = g.state;
  out.bossPhase = b.phase;
  return JSON.stringify(out, null, 2);
})()
`;

const res = await send('Runtime.evaluate', { expression: pageScript, awaitPromise: true, returnByValue: true, timeout: 180000 });
if (res.exceptionDetails) {
  console.error('PAGE EXCEPTION:', res.exceptionDetails.exception?.description || res.exceptionDetails.text);
} else {
  console.log(res.result.value);
}
ws.close();
chrome.kill();
server.close();
