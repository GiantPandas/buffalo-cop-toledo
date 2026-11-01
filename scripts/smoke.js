// Smoke test: validates level data integrity, rail math, scoring, and RNG.
import * as THREE from 'three';
import { LEVELS } from '../src/levels/index.js';
import { CONFIG, comboMultiplier } from '../src/config.js';
import { ScoreManager } from '../src/core/ScoreManager.js';
import { Rng } from '../src/utils/rng.js';
import { RailSystem } from '../src/systems/RailSystem.js';
import { UPGRADES } from '../src/systems/upgrades.js';

let failures = 0;
function check(cond, msg) {
  if (!cond) {
    failures++;
    console.error('FAIL:', msg);
  } else {
    console.log('ok  :', msg);
  }
}

// ---------- Level data integrity ----------
const VALID_VARIANTS = new Set(Object.keys(CONFIG.buffalos));
for (const lvl of LEVELS) {
  check(!!lvl.id && !!lvl.name && !!lvl.objective, `L${lvl.id} has id/name/objective`);
  check(Array.isArray(lvl.path) && lvl.path.length >= 5, `L${lvl.id} path has ${lvl.path?.length} points`);
  for (const p of lvl.path) {
    if (!Array.isArray(p) || p.length !== 3 || p.some((v) => !Number.isFinite(v))) {
      check(false, `L${lvl.id} bad path point ${JSON.stringify(p)}`);
      break;
    }
  }
  check(lvl.duration > 10, `L${lvl.id} duration ${lvl.duration}s`);
  check(Array.isArray(lvl.encounters) && lvl.encounters.length > 0, `L${lvl.id} has encounters`);
  for (const enc of lvl.encounters) {
    const okType = VALID_VARIANTS.has(enc.type) || enc.type === 'herd' || enc.type === 'feedstore_burst';
    if (!okType) check(false, `L${lvl.id} unknown encounter type ${enc.type}`);
    if (!(enc.time > 0)) check(false, `L${lvl.id} bad encounter time`);
  }
  const times = (lvl.encounters || []).map((e) => e.time).sort((a, b) => a - b);
  for (let i = 1; i < times.length; i++) {
    if (times[i] >= lvl.duration) check(false, `L${lvl.id} encounter at ${times[i]}s beyond duration`);
  }
  check(!!lvl.world && !!lvl.world.theme, `L${lvl.id} world theme ${lvl.world?.theme}`);
  // lookAts derivation (same math as LevelManager).
  const posVecs = lvl.path.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const curve = new THREE.CatmullRomCurve3(posVecs, false, 'centripetal');
  const ahead = lvl.lookAhead || 24;
  const len = curve.getLength();
  const lookAts = [];
  for (let i = 0; i < posVecs.length; i++) {
    const u = Math.min(1, i / (posVecs.length - 1) + ahead / len);
    lookAts.push(curve.getPointAt(u));
  }
  check(lookAts.length === posVecs.length, `L${lvl.id} derived ${lookAts.length} look targets`);

  const rail = new RailSystem(lvl.path, lookAts.map((v) => [v.x, v.y, v.z]), lvl.duration);
  const p0 = rail.sampleAt(0, new THREE.Vector3());
  const p1 = rail.sampleAt(1, new THREE.Vector3());
  check(Number.isFinite(p0.x + p0.y + p0.z) && Number.isFinite(p1.x + p1.y + p1.z), `L${lvl.id} rail endpoints finite`);
  // Simulate full ride.
  let t = 0;
  const dt = 1 / 60;
  let steps = 0;
  while (!rail.finished) { rail.update(dt); t += dt; steps++; if (steps > 20000) break; }
  check(rail.finished, `L${lvl.id} rail completes in ${Math.round(t)}s`);
  check(Math.abs(t - lvl.duration) < 1.5, `L${lvl.id} ride time matches duration (${Math.round(t)}s vs ${lvl.duration}s)`);
}

// ---------- Scoring / combo tiers ----------
{
  const s = new ScoreManager();
  s.registerHit(100); // 1 hit -> x1
  check(s.multiplier === 1, 'combo: 1 hit = x1');
  for (let i = 0; i < 4; i++) s.registerHit(100); // now 5
  check(s.multiplier === 2, 'combo: 5 hits = x2');
  for (let i = 0; i < 5; i++) s.registerHit(100); // now 10
  check(s.multiplier === 3, 'combo: 10 hits = x3');
  for (let i = 0; i < 10; i++) s.registerHit(100); // now 20
  check(s.multiplier === 4, 'combo: 20 hits = x4');
  for (let i = 0; i < 10; i++) s.registerHit(100); // now 30
  check(s.multiplier === 5, 'combo: 30 hits = x5');
  const before = s.score;
  const added = s.registerHit(100);
  check(added === 500, `combo: 31st hit adds 500 (got ${added})`);
  s.breakCombo();
  check(s.multiplier === 1, 'combo: break resets to x1');
  const s2 = new ScoreManager();
  s2.shotFired(); s2.shotFired(); s2.shotFired(); // 3 shots fired (2 of them were misses)
  s2.registerHit(100); // the 3rd shot landed
  check(Math.abs(s2.accuracy - 1/3) < 0.001, `accuracy math (${Math.round(s2.accuracy * 100)}%)`);
  void before;
}

// ---------- comboMultiplier table ----------
check(comboMultiplier(0) === 1 && comboMultiplier(4) === 1, 'mult: <5 = x1');
check(comboMultiplier(5) === 2 && comboMultiplier(9) === 2, 'mult: 5-9 = x2');
check(comboMultiplier(10) === 3, 'mult: 10 = x3');
check(comboMultiplier(20) === 4, 'mult: 20 = x4');
check(comboMultiplier(30) === 5 && comboMultiplier(999) === 5, 'mult: 30+ = x5');

// ---------- Rng determinism ----------
{
  const a = new Rng(42), b = new Rng(42);
  let same = true;
  for (let i = 0; i < 100; i++) if (a.next() !== b.next()) { same = false; break; }
  check(same, 'Rng: same seed => same sequence');
  const c = new Rng(43);
  let diff = false;
  for (let i = 0; i < 100; i++) if (a.next() !== c.next()) { diff = true; break; }
  check(diff, 'Rng: different seed => different sequence');
}

// ---------- Weapon config sanity ----------
check(CONFIG.weapon.magSize >= 20, `weapon: drum mag (${CONFIG.weapon.magSize} rounds)`);
check(CONFIG.weapon.fireCooldown <= 0.12, `weapon: full-auto rate (${CONFIG.weapon.fireCooldown}s cooldown)`);
check(CONFIG.boss.hp > 10 && CONFIG.boss.hp / CONFIG.weapon.damage <= 60, `boss hp ${CONFIG.boss.hp} killable at uzi DPS`);
check(!!CONFIG.buffalos.bandit, 'config: donut bandit variant exists');

// ---------- Roguelike upgrades ----------
{
  const base = () => ({
    player: {
      weapon: {
        magSize: CONFIG.weapon.magSize, fireCooldown: CONFIG.weapon.fireCooldown,
        reloadTime: CONFIG.weapon.reloadTime, recoil: CONFIG.weapon.recoil,
        damage: CONFIG.weapon.damage, ammo: CONFIG.weapon.magSize,
        critChance: 0, pierce: 0, headshotBonus: 0, spreadScale: 1
      },
      maxHp: 100, hp: 100, damageReduction: 0, flatDamageReduction: 0
    },
    score: { bonusMul: 1 }
  });
  check(UPGRADES.length >= 3, `upgrades: pool has ${UPGRADES.length} entries`);
  const ids = new Set(UPGRADES.map((u) => u.id));
  check(ids.size === UPGRADES.length, 'upgrades: unique ids');
  for (const u of UPGRADES) {
    const g = base(); u.apply(g);
    const w = g.player.weapon;
    check(Number.isFinite(w.damage + w.magSize + w.fireCooldown + w.spreadScale), `upgrade ${u.id} leaves finite stats`);
  }
  let g = base(); UPGRADES.find((u) => u.id === 'magsize').apply(g);
  check(g.player.weapon.magSize === CONFIG.weapon.magSize + 10 && g.player.weapon.ammo === CONFIG.weapon.magSize + 10, 'drum mag: +10 and tops off mag');
  g = base(); UPGRADES.find((u) => u.id === 'damage').apply(g);
  check(g.player.weapon.damage === 2, 'damage: +1 per shot');
  g = base(); UPGRADES.find((u) => u.id === 'rof').apply(g);
  check(g.player.weapon.fireCooldown < CONFIG.weapon.fireCooldown, `rof: faster (${g.player.weapon.fireCooldown.toFixed(3)})`);
  g = base(); UPGRADES.find((u) => u.id === 'bloom').apply(g);
  check(g.player.weapon.spreadScale < 1, `bloom: spread reduced (${g.player.weapon.spreadScale.toFixed(2)})`);
}

console.log(failures === 0 ? '\nALL SMOKE TESTS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
