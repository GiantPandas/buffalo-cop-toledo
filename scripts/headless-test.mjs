// Headless Chrome integration test for BUFFALO COP.
// Serves dist/ statically, drives the real game loop via CDP, simulates full levels.
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const dist = path.join(root, 'dist');
const PORT = 4173;
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9377;

// ---------- static server for dist/ ----------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
function serve(req, res) {
  let urlPath = decodeURIComponent(new URL(req.url, `http://localhost`).pathname);
  if (urlPath === '/') urlPath = '/index.html';
  const file = path.join(dist, urlPath);
  if (!file.startsWith(dist)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  const ext = path.extname(file);
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}
const server = http.createServer(serve);
await new Promise((r) => server.listen(PORT, r));
console.log('static server on', PORT);

// ---------- launch chrome ----------
const userData = path.join(os.tmpdir(), 'buffalo-cop-test-' + Date.now());
fs.rmSync(userData, { recursive: true, force: true });
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${userData}`,
  '--no-first-run',
  '--enable-unsafe-swiftshader',
  `http://127.0.0.1:${PORT}/` // load target directly; skip CDP Page.navigate
], { stdio: ['ignore', 'pipe', 'pipe'] });
let chromeErr = '';
chrome.stderr.on('data', (d) => { chromeErr += d.toString(); });
process.on('exit', () => { try { chrome.kill(); } catch (e) {} });

async function httpJson(p) {
  const r = await fetch(`http://127.0.0.1:${DEBUG_PORT}${p}`);
  return r.json();
}

let target;
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 250));
  try {
    const list = await httpJson('/json/list');
    target = list.find((t) => t.type === 'page' && String(t.url).includes(String(PORT)));
    if (target) break;
  } catch (e) {}
}
if (!target) {
  console.error('CHROME FAILED TO START. stderr tail:');
  console.error(chromeErr.slice(-2000));
  process.exit(2);
}

// ---------- CDP over raw WebSocket ----------
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let msgId = 0;
const pending = new Map();
const consoleErrors = [];
const pageErrors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const { resolve } = pending.get(m.id); pending.delete(m.id); resolve(m.result); return; }
  if (!m.method) return;
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    consoleErrors.push((m.params.args || []).map((a) => a.value ?? a.unserializableValue ?? '').join(' '));
  } else if (m.method === 'Runtime.exceptionThrown') {
    pageErrors.push(m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description || ''));
  }
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

// Wait for load.
const t0 = Date.now();
while (Date.now() - t0 < 20000) {
  await new Promise((r) => setTimeout(r, 300));
  const st = await send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
  if (st && st.result && st.result.value === 'complete') break;
}

// ---------- in-page test driver ----------
const pageScript = `
(async () => {
  const g = window.__BUFFALO_COP__;
  if (!g) throw new Error('game did not boot');
  if (g._dead) throw new Error('WebGL renderer failed to start');
  const results = { frames: 0 };

  // Kill the game's own rAF loop so manual stepping is the only clock.
  window.requestAnimationFrame = () => 0;
  // Skip GPU work (SwiftShader is slow) but keep the matrix updates raycasts depend on.
  g.renderer.render = (s, c) => { s.updateMatrixWorld(); c.updateMatrixWorld(); };
  try { g.audio.init(); } catch (e) {}

  const step = (ms) => { t += ms; g.tick(t); results.frames++; };
  let t = performance.now();

   // --- Menu -> start run (now begins with a loadout upgrade pick) ---
   results.initialState = g.state;
   g.startRun();
   results.afterStart = g.state;
   if (g.state === 'upgrades') {
     const card = document.querySelector('#upgrade-grid .upg-card');
     results.loadoutOffered = !!card;
     if (card) card.click();
     results.afterLoadout = g.state;
   }
   g.beginLevel();
  // Keep the test deterministic: validate completion paths, not survivability.
  g.player.maxHp = 9999; g.player.hp = 9999;
  results.afterBegin = g.state;

  // 5 seconds of play.
  for (let i = 0; i < 300; i++) step(16.7);
  results.buffalosAt5s = g.enemyManager.buffalos.length;

  // Shoot at screen center a few times.
  g.input.ndc.x = 0; g.input.ndc.y = 0;
  let fired = 0;
  for (let i = 0; i < 6; i++) { if (g.player.weapon.fire()) fired++; }
  results.fired = fired;
  results.ammoAfterShots = g.player.weapon.ammo;

  // Run to the end of level 1, shooting at whatever's ahead.
  let guard = 0;
  const killsBefore = g.stats.killed;
  while (!g.levelManager.rail.finished && g.state === 'playing' && guard++ < 8000) {
    step(16.7);
    if (g.player.alive && g.player.weapon.canFire) g.player.weapon.fire();
  }
  for (let i = 0; i < 200 && g.state === 'playing'; i++) {
    step(16.7);
    if (g.player.alive && g.player.weapon.canFire) g.player.weapon.fire();
  }
  results.l1EndState = g.state;
  results.l1Score = g.score.score;
  results.l1Killed = g.stats.killed - killsBefore;

  if (g.state === 'gameover') {
    // Player died: retry the mission.
    g.retryLevel();
    results.retryState = g.state;
    for (let i = 0; i < 300 && g.state === 'playing'; i++) step(16.7);
    results.afterRetry = g.state;
  } else if (g.state === 'results') {
    // Continue through the UI button -> upgrade pick -> level 2.
    document.querySelector('[data-action="next"]').click();
    results.nextState = g.state;               // expect 'upgrades'
    if (g.state === 'upgrades') {
      const card = document.querySelector('#upgrade-grid .upg-card');
      results.upgradeOffered = !!card;
      if (card) card.click();
      results.afterUpgrade = g.state;          // expect 'briefing'
      results.lastUpgrade = g._lastUpgrade;
    }
    g.beginLevel();
    for (let i = 0; i < 300 && g.state === 'playing'; i++) step(16.7);
    results.l2state = g.state;
    results.l2buffalos = g.enemyManager.buffalos.length;
    // Pause / resume check.
    g.pauseGame();
    results.pausedState = g.state;
    g.resumeGame();
    results.resumedState = g.state;

    // Damage + game over pipeline (explicit).
    g.player.takeDamage(9999);
    results.gameOverState = g.state;
    g.retryLevel();
    results.afterRetry = g.state;
    for (let i = 0; i < 120 && g.state === 'playing'; i++) step(16.7);
  }

   // --- Boss fight: jump to level 5 and run it. ---
   g.quitToMenu();
   g.startLevel(4);       // L5 (fresh run -> loadout pick first)
   if (g.state === 'upgrades') {
     const card = document.querySelector('#upgrade-grid .upg-card');
     if (card) card.click();
   }
   g.beginLevel();
   // Fresh run reset HP to base; re-inject god mode for the boss section.
   g.player.maxHp = 9999; g.player.hp = 9999;
  let bossSeen = false, bossDead = false;
  guard = 0;
  while (guard++ < 12000) {
    step(16.7);
    if (g.levelManager.bossActive || g.levelManager.bossEnding) bossSeen = true;
    // Keep the player shooting at the center of the screen (the boss blocks the road).
    g.input.ndc.x = 0; g.input.ndc.y = 0;
    if (g.player.alive && g.player.weapon.canFire) g.player.weapon.fire();
    if (g.levelManager.boss && g.levelManager.boss.defeated) { bossDead = true; }
    if (g.state === 'results' || g.state === 'gameover') break;
  }
  results.bossSeen = bossSeen;
  results.bossDead = bossDead;
  results.l5EndState = g.state;
  results.finalScore = g.score.score;

  // If the boss was not beaten, force-finish it to validate the victory pipeline.
  if (!bossDead && g.levelManager.boss) {
    g.levelManager.boss.hp = 1;
    g.input.ndc.x = 0; g.input.ndc.y = 0;
    for (let i = 0; i < 600 && g.state === 'playing'; i++) { step(16.7); if (g.player.weapon.canFire) g.player.weapon.fire(); }
    results.forcedBossEnd = g.state;
  }

  // Walk the victory/results pipeline to the end screens.
  for (let i = 0; i < 400 && !['results', 'victory', 'gameover'].includes(g.state); i++) step(16.7);
  if (g.state === 'results') {
    document.querySelector('[data-action="next"]').click();
    results.victoryShown = g.state;
  }

  // Submit a high-score entry through the victory screen.
  const nameWrap = document.getElementById('vic-name-wrap');
  if (g.state === 'victory' && nameWrap && !nameWrap.classList.contains('hidden')) {
    document.getElementById('vic-name-input').value = 'ACE';
    document.querySelector('[data-action="confirm-name-vic"]').click();
    results.scoresSaved = g.save.scores.length;
    results.backInMenu = g.state;
  }

  return JSON.stringify(results, null, 2);
})()
`;

const res = await send('Runtime.evaluate', { expression: pageScript, awaitPromise: true, returnByValue: true, timeout: 120000 });
if (res.exceptionDetails) {
  console.error('PAGE EXCEPTION:', res.exceptionDetails.exception?.description || res.exceptionDetails.text);
} else {
  console.log('=== RESULTS ===');
  console.log(res.result.value);
}

// Give a moment for async errors to surface.
await new Promise((r) => setTimeout(r, 500));
console.log('=== CONSOLE ERRORS (' + consoleErrors.length + ') ===');
for (const e of consoleErrors.slice(0, 20)) console.error('  ', e.slice(0, 300));
console.log('=== PAGE EXCEPTIONS (' + pageErrors.length + ') ===');
for (const e of pageErrors.slice(0, 10)) console.error('  ', e.slice(0, 400));

ws.close();
chrome.kill();
server.close();
const ok = consoleErrors.length + pageErrors.length === 0 && !!(res && res.result && res.result.value);
process.exit(ok ? 0 : 1);
