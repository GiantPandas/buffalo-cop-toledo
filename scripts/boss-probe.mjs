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
  out.bossScale = b.scaleMul;
  out.bossMaxHp = b.maxHp;
  out.blockers = g.levelManager.blockers.length;
  out.ammo = w.ammo;
  out.reloading = w.reloading;
  out.canFireBefore = w.canFire;
  out.activeShootables = g.levelManager.shootables.filter((s) => s.active).length;

  // FRAMING: every corner of his body has to land inside the screen.
  {
    const V = g.camera.position.constructor;
    const corners = [];
    const s = b.scaleMul;
    for (const sx of [-1.5, 1.5]) for (const sy of [-0.6, 2.5]) for (const sz of [-1.9, 1.9]) {
      corners.push(new V(b.group.position.x + sx * s, sy * s, b.group.position.z + sz * s));
    }
    let off = 0, ymax = -9, ymin = 9, xmax = 0;
    for (const v of corners) {
      v.applyMatrix4(g.camera.matrixWorldInverse).applyMatrix4(g.camera.projectionMatrix);
      if (Math.abs(v.x) > 1 || Math.abs(v.y) > 1) off++;
      ymax = Math.max(ymax, v.y); ymin = Math.min(ymin, v.y);
      xmax = Math.max(xmax, Math.abs(v.x));
    }
    out.framing = { cornersOutsideScreen: off, ndcY: [+ymin.toFixed(2), +ymax.toFixed(2)], ndcXMax: +xmax.toFixed(2) };
  }

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
  // MOVEMENT + COVER: where he stands each frame, and whether a lot is between
  // the muzzle and his chest.
  const V = g.camera.position.constructor;
  const Ray = w.raycaster.ray.constructor;
  // Measure in the boss's own arena frame: depth runs camera -> boss, lateral
  // runs across the plaza. (The camera yaw tracks him, so it is a bad ruler.)
  const right = b.right.clone();
  const origin = b.origin.clone();
  const chest = new V(); const rel = new V(); const probe = new V(); const shoulder = new V();
  const lats = [], dists = [], phases = [];
  let walkFrames = 0, laneChanges = 0, shoulderCovered = 0, shoulderClear = 0, chestShielded = 0, lastLane = 0;
  const log = [];
  const mark = (i) => log.push({ i, alive: g.player.alive, frozen: g.levelManager.frozen, cd: +w.cooldown.toFixed(3), rel: w.reloading, ammo: w.ammo, state: g.state });
  for (let i = 0; i < 900 && g.state === 'playing'; i++) {
    if (i === 0 || i === 1 || i === 2 || i === 15 || i === 30 || i === 60 || i === 120) mark(i);
    step(16.7);
    if (!b.defeated) {
      b.chestPos(chest);
      rel.set(chest.x - origin.x, 0, chest.z - origin.z);
      const lat = rel.dot(right);
      lats.push(lat); dists.push(rel.length()); phases.push(b.phase);
      if (Math.abs(lat) > 1.5 && lastLane !== 0 && Math.sign(lat) !== lastLane) laneChanges++;
      if (Math.abs(lat) > 1.5) lastLane = Math.sign(lat);
      if (b.state === 'walk') walkFrames++;
      // Cover check: his far shoulder should get shielded by a lot sometimes,
      // while his chest/head stays shootable.
      shoulder.set(b.group.position.x + right.x * b.scaleMul * 1.5, chest.y * 0.8,
        b.group.position.z + right.z * b.scaleMul * 1.5);
      const sRay = new Ray(g.camera.position.clone(), shoulder.clone().sub(g.camera.position).normalize());
      let blocked = false;
      for (const bx of g.levelManager.blockers) if (sRay.intersectBox(bx, probe)) { blocked = true; break; }
      if (blocked) shoulderCovered++; else shoulderClear++;
      const cRay = new Ray(g.camera.position.clone(), rel.clone().setY(chest.y - g.camera.position.y).normalize());
      for (const bx of g.levelManager.blockers) if (cRay.intersectBox(bx, probe)) { chestShielded++; break; }
    }
    g.input.ndc.x = 0; g.input.ndc.y = 0;
    if (g.player.alive && w.canFire) { w.fire(); shots++; }
  }
  out.stepLog = log;
  out.movement = {
    laneChanges,
    walkFrames,
    lateral: [+Math.min(...lats).toFixed(1), +Math.max(...lats).toFixed(1)],
    dist: [+Math.min(...dists).toFixed(1), +Math.max(...dists).toFixed(1)],
    phasesSeen: [...new Set(phases)].sort(),
    framesShoulderCovered: shoulderCovered,
    framesShoulderClear: shoulderClear,
    framesChestShielded: chestShielded
  };

  // COVER: aim at whichever shoulder a lot is shielding and fire. Rounds must
  // stop on the building, not travel through it into the buffalo.
  {
    let blockedShots = 0, hitsThroughCover = 0, tries = 0;
    while (blockedShots < 12 && tries++ < 1200 && g.state === 'playing') {
      step(16.7);
      b.chestPos(chest);
      shoulder.set(b.group.position.x + right.x * b.scaleMul * 1.5, chest.y * 0.8,
        b.group.position.z + right.z * b.scaleMul * 1.5);
      const ray = new Ray(g.camera.position.clone(), shoulder.clone().sub(g.camera.position).normalize());
      let blocked = false;
      for (const bx of g.levelManager.blockers) if (ray.intersectBox(bx, probe)) { blocked = true; break; }
      if (!blocked) continue;
      const proj = shoulder.clone().applyMatrix4(g.camera.matrixWorldInverse).applyMatrix4(g.camera.projectionMatrix);
      g.input.ndc.x = proj.x; g.input.ndc.y = proj.y;
      const h0 = hits;
      if (g.player.alive && w.canFire) { w.fire(); blockedShots++; }
      if (hits > h0) hitsThroughCover++;
    }
    out.coverTest = { blockedShots, hitsThroughCover };
  }

  out.shotsFired = shots;
  out.hpDelta = hpBefore - b.hp;
  out.buffaloHits = hits;
  out.misses = misses;
  out.obstacleHits = obstacleHits;
  out.bossDefeated = !!b.defeated;
  out.stateAfter = g.state;
  out.bossPhase = b.phase;
  out.bossHpLeft = Math.max(0, Math.round(b.hp));
  // Contact damage the boss managed to land (the probe player starts at 9999).
  out.playerDamageTaken = 9999 - g.player.hp;
  return JSON.stringify(out, null, 2);
})()
`;

const res = await send('Runtime.evaluate', { expression: pageScript, awaitPromise: true, returnByValue: true, timeout: 180000 });
if (res.exceptionDetails) {
  console.error('PAGE EXCEPTION:', res.exceptionDetails.exception?.description || res.exceptionDetails.text);
  ws.close(); chrome.kill(); server.close();
  process.exit(1);
}
console.log(res.result.value);

// Verdict: the boss must stay framed, keep moving, and really be shielded by
// cover when he ducked behind it.
{
  const o = JSON.parse(res.result.value);
  const fails = [];
  if (!o.bossActive) fails.push('boss fight never started');
  if (o.framing && o.framing.cornersOutsideScreen > 0) fails.push(`boss leaves the screen (${o.framing.cornersOutsideScreen} corners off-frame)`);
  const span = o.movement ? o.movement.lateral[1] - o.movement.lateral[0] : 0;
  if (span < 8) fails.push(`boss barely dodges (lateral span ${span.toFixed(1)}m)`);
  if (!o.movement || o.movement.walkFrames < 60) fails.push('boss barely walks between lanes');
  if (!o.movement || o.movement.framesShoulderCovered < 30) fails.push('cover never shields him');
  if (!o.coverTest || o.coverTest.blockedShots < 5) fails.push('probe could not aim behind cover');
  else if (o.coverTest.hitsThroughCover > 0) fails.push(`rounds pass through cover (${o.coverTest.hitsThroughCover} hits)`);
  for (const f of fails) console.error('FAIL:', f);
  console.log(fails.length ? `${fails.length} BOSS FAILURES` : 'BOSS OK: framed, dodging, shielded by cover');
  process.exitCode = fails.length ? 1 : 0;
}
ws.close();
chrome.kill();
server.close();
