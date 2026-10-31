// Spawn/pacing audit: simulates each level's rail + encounter firing and reports
// spawn distance ahead, reaction time to contact for chargers, encounter spacing,
// and concurrent-alive estimates. Pure node, no rendering.
import { LEVELS as levels } from '../src/levels/index.js';
import { CONFIG } from '../src/config.js';

const diff = CONFIG.difficulty.normal;

// Rail ease (must match RailSystem._ease) and its derivative.
const ease = (x) => x * 0.7 + x * x * (3 - 2 * x) * 0.3;
const easeD = (x) => 0.7 + 0.3 * 6 * x * (1 - x);

const speedOf = (b) => CONFIG.buffalos[b]?.speed ?? 1;
const isCharger = (t) => ['angry', 'security', 'giant'].includes(t);
const REACTION_AHEAD = { angry: 28, security: 28, giant: 30, herd: 24, traffic: 18, bandit: 22, panicked: 18 };

for (const L of levels) {
  const path = L.path.map((p) => ({ x: p[0], y: p[1], z: p[2] }));
  // Approximate arc length with polyline (curve is centripetal catmull — close enough for pacing).
  let len = 0;
  for (let i = 1; i < path.length; i++) len += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);

  const encs = [...(L.encounters || [])].sort((a, b) => a.time - b.time);
  console.log(`\n=== L${L.id} ${L.name} — dur ${L.duration}s, len ~${len.toFixed(0)}m, avg ${(len / L.duration).toFixed(2)} m/s ===`);

  // alive model: with the offstage despawn, a spawned buffalo lives until the
  // rail passes it plus ~34m of behind-camera margin (worst case: player kills nothing)
  const lifetime = (e) => {
    const p = Math.min(1, e.time / L.duration);
    const sp = (len / L.duration) * easeD(p);
    const a = e.type === 'feedstore_burst' ? 17 : Math.max(e.ahead || 20, REACTION_AHEAD[e.type] || 18, sp * 4 + 10);
    return (a + 34) / sp;
  };
  const aliveAt = (t) => encs.filter((e) => e.time <= t && t - e.time < lifetime(e))
    .reduce((s, e) => s + Math.max(1, Math.round((e.count || 1) * diff.spawnScale)), 0);

  let prevStation = 0;
  let prev = 0;
  let worstRT = 99;
  let maxAlive = 0;
  for (const e of encs) {
    const p = Math.min(1, e.time / L.duration);
    const speed = (len / L.duration) * easeD(p);
    const station = ease(p) * len;
    const gapM = station - prevStation;
    prevStation = station;
    const n = Math.max(1, Math.round((e.count || 1) * diff.spawnScale));
    let ahead = e.type === 'feedstore_burst' ? 12 : Math.max(e.ahead || 20, REACTION_AHEAD[e.type] || 18, speed * 4 + 10);
    const jitter = e.type === 'feedstore_burst' ? 0 : 2;
    let rt;
    if (isCharger(e.type)) {
      // approach to telegraph(21m) -> cooldown -> telegraph 1s -> charge closing
      const t1 = Math.max(0, (ahead - jitter - 21) / speed);
      const cd = Math.max(0, (e.type === 'security' ? 2.75 : 1.65) - t1);
      const d2 = Math.max(0, 21 - speed * 1.0);
      rt = t1 + cd + 1.0 + d2 / (speed + 9.5 * diff.chargeSpeed);
    } else {
      rt = (ahead - jitter) / speed; // window before it passes the camera
    }
    maxAlive = Math.max(maxAlive, aliveAt(e.time));
    worstRT = Math.min(worstRT, rt);
    console.log(`  t=${String(e.time).padStart(2)} ${e.type.padEnd(15)} x${String(n).padStart(2)} ahead ${ahead} speed ${speed.toFixed(1)} gap ${gapM.toFixed(0)}m RT ${rt.toFixed(1)}s alive~${aliveAt(e.time)}`);
    prev = e.time;
  }
  const total = encs.reduce((s, e) => s + Math.max(1, Math.round((e.count || 1) * diff.spawnScale)), 0);
  console.log(`  TOTAL spawns ${total} (${(total / L.duration * 60).toFixed(0)}/min) worstRT ${worstRT.toFixed(1)}s peakAlive(no-kills) ${maxAlive}`);
}
