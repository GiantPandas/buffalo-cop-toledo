// Smoke test: validates level data integrity, rail math, scoring, and RNG.
import * as THREE from 'three';
import { LEVELS } from '../src/levels/index.js';
import { CONFIG, comboMultiplier } from '../src/config.js';
import { ScoreManager } from '../src/core/ScoreManager.js';
import { Rng } from '../src/utils/rng.js';
import { RailSystem } from '../src/systems/RailSystem.js';
import { PARTS, PART_IDS, PART_BY_ID, PAIRS, SETS, resolveBuild, applyBuild, synergiesFor, draftWeight, buildPowerMul } from '../src/systems/upgrades.js';
import { Weapon } from '../src/player/Weapon.js';

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
check(CONFIG.boss.hp > 10 && CONFIG.boss.hp <= 400, `boss hp ${CONFIG.boss.hp} (scaled by build power)`);
check(CONFIG.boss.scale > CONFIG.buffalos.giant.scale[1] && CONFIG.boss.scale <= 4.2,
  `boss scale ${CONFIG.boss.scale}: bigger than a giant, still fits the screen`);
check(Object.keys(CONFIG.boss.dodge).length === 4 && CONFIG.boss.dodge[4].speed > CONFIG.boss.dodge[1].speed
  && CONFIG.boss.dodge[4].interval < CONFIG.boss.dodge[1].interval,
  'boss dodge: 4 phase cadences, and he changes lanes faster as he fades');
check(CONFIG.boss.minDist < CONFIG.boss.maxDist, `boss arena band ${CONFIG.boss.minDist}-${CONFIG.boss.maxDist}m`);
check(!!CONFIG.buffalos.bandit, 'config: donut bandit variant exists');

// ---------- Weapon parts + synergies ----------
{
  const base = () => ({
    player: {
      weapon: {
        magSize: CONFIG.weapon.magSize, fireCooldown: CONFIG.weapon.fireCooldown,
        reloadTime: CONFIG.weapon.reloadTime, recoil: CONFIG.weapon.recoil,
        damage: CONFIG.weapon.damage, ammo: CONFIG.weapon.magSize,
        critChance: 0, pierce: 0, headshotBonus: 0, precisionMul: 0, spreadScale: 1,
        bloomGrowMul: 1, bloomDecayMul: 1, holdRamp: 0, heatRate: 0, heatDamage: 0,
        focusRate: 0, lastShell: 0, tacticalReload: 0, tacticalCut: 0
      },
      maxHp: 100, hp: 100, damageReduction: 0, flatDamageReduction: 0,
      heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }
    },
    score: { bonusMul: 1 },
    ui: { setMagSize() {} }
  });

  check(PARTS.length >= 15, `parts: pool has ${PARTS.length} entries`);
  const ids = new Set(PARTS.map((p) => p.id));
  check(ids.size === PARTS.length, 'parts: unique ids');
  check(PARTS.every((p) => ['common', 'rare', 'epic'].includes(p.rarity)), 'parts: valid rarity on every part');
  check(new Set(PARTS.map((p) => p.rarity)).size === 3, 'parts: all three rarity tiers present');
  check(PARTS.every((p) => p.tags.length > 0 && !!p.icon && !!p.name && !!p.desc && !!p.flavor),
    'parts: tags + icon + name + desc + flavor on every part');
  check(PARTS.every((p) => p.add || p.mul || p.flag || p.once), 'parts: every part does something');
  check(PARTS.every((p) => !p.apply), 'parts: declarative (no imperative apply hooks)');
  check(PARTS.filter((p) => p.add || p.mul || p.once).length >= PARTS.length * 0.7,
    'parts: mostly weapon-focused, not score-only');
  check(PAIRS.every((pr) => ids.has(pr.a) && ids.has(pr.b) && pr.a !== pr.b), 'pairs: every partner id exists');
  const tagNames = new Set(PARTS.flatMap((p) => p.tags));
  check(SETS.every((s) => tagNames.has(s.tag) && s.need >= 2), 'sets: every tag exists and needs 2+ parts');
  check(SETS.every((s) => PARTS.filter((p) => p.tags.includes(s.tag)).length >= s.need),
    'sets: every set is actually reachable');

  // Derived build: order-independent, idempotent, capped.
  const pick = ['drummag', 'sights', 'hairtrigger', 'hollow'];
  const a = resolveBuild(pick), b = resolveBuild([...pick].reverse()), c = resolveBuild([...pick, ...pick]);
  check(JSON.stringify(a) === JSON.stringify(b), 'resolveBuild: pick order changes nothing');
  check(JSON.stringify(a) === JSON.stringify(c), 'resolveBuild: picking twice changes nothing');
  const empty = resolveBuild([]);
  check(empty.add.magSize === CONFIG.weapon.magSize && empty.mul.cooldownMul === 1 && empty.notes.length === 0,
    'resolveBuild: empty loadout is the service-issue gun');

  // Boss HP rides the build so every loadout gets a comparable fight.
  check(buildPowerMul([]) === 1, 'buildPowerMul: the service-issue gun is the baseline');
  check(buildPowerMul(['hairtrigger', 'triggerfinger', 'splittip', 'lastshell']) > buildPowerMul(['hairtrigger']),
    `buildPowerMul: a fuller loadout fights longer (${buildPowerMul(['hairtrigger']).toFixed(2)}x → ${buildPowerMul(['hairtrigger', 'triggerfinger', 'splittip', 'lastshell']).toFixed(2)}x)`);
  check(buildPowerMul(PART_IDS) <= CONFIG.boss.hpMaxMul,
    'buildPowerMul: a maxed loadout cannot out-run the boss HP cap');

  let g = base(); applyBuild(g, ['drummag']);
  check(g.player.weapon.magSize === CONFIG.weapon.magSize + 12 && g.player.weapon.ammo === g.player.weapon.magSize,
    'drum mag: +12 rounds and tops off the drum');
  g = base(); applyBuild(g, ['drummag', 'speedload']);
  check(g.player.weapon.magSize === CONFIG.weapon.magSize + 20, 'LOGISTICS BEAT: +20 rounds across the pair');
  check(g.player.weapon.reloadTime < CONFIG.weapon.reloadTime * 0.6,
    `LOGISTICS BEAT: reload ${g.player.weapon.reloadTime.toFixed(2)}s beats either part alone`);
  g = base(); applyBuild(g, ['sights', 'parade']);
  check(g.player.weapon.spreadScale < 0.45, `STEADY HAND: spread ${g.player.weapon.spreadScale.toFixed(2)}`);
  check(g.buildNotes.some((n) => n.label === 'STEADY HAND' && n.kind === 'pair'), 'pair note recorded');
  check(g.buildNotes.some((n) => n.label === 'MARKSMAN LIST' && n.kind === 'set'), 'set note recorded');
  g = base(); applyBuild(g, ['drummag', 'casecatch']);
  check(g.player.weapon.tacticalCut > 0 && g.player.weapon.tacticalReload <= 0.45,
    'COMBAT RELOAD: tactical top-off threshold lowered');
  g = base(); applyBuild(g, ['hollow', 'splittip']);
  check(g.player.weapon.pierce === 2 && g.buildFlags.pierceScore === 125, 'OVERMATCH: double pierce + bounty per pierce');
  g = base(); applyBuild(g, ['timecrime', 'flashbang']);
  check(g.buildFlags.stunOnKill && g.buildFlags.stunRadius > 9 && g.buildFlags.stunTime > 1.6,
    'CROWD CONTROL: flash stun reaches further and holds longer');
  g = base(); applyBuild(g, ['chrome', 'review']);
  check(g.buildFlags.killCash >= 270 && g.buildFlags.bountyCombo, 'GRANT MONEY: bigger bounty that scales with combo');
  check(g.score.bonusMul > 1.35, `CITY CONTRACT set: score ×${g.score.bonusMul.toFixed(2)}`);
  g = base(); applyBuild(g, ['chrome', 'review', 'lucky']);
  check(g.score.bonusMul > 1.5, `INSURANCE FRAUD on top of the set: score ×${g.score.bonusMul.toFixed(2)}`);
  g = base(); applyBuild(g, ['lucky']);
  check(g.buildFlags.luckyMiss === true, 'lucky tie: combo-saver flag set');
  g = base(); applyBuild(g, ['vest']);
  check(g.player.damageReduction === 0.15, 'kevlar vest: charge damage reduction');
  g = base(); g.player.hp = 90; PART_BY_ID.medkit.once(g);
  check(g.player.hp === 93, 'medkit heals once at pick time');

  g = base(); applyBuild(g, PART_IDS);
  const w = g.player.weapon;
  check(w.damage <= 8 && w.magSize <= 90 && w.fireCooldown > 0.02 && w.spreadScale >= 0.22 &&
    Number.isFinite(w.reloadTime + w.recoil + w.holdRamp + w.focusRate),
    `maxed build stays inside caps (dmg ${w.damage}, drum ${w.magSize}, cd ${w.fireCooldown.toFixed(3)})`);

  // Card UI helper: live vs. hinted synergies.
  const syn = synergiesFor('speedload', ['drummag']);
  check(syn.some((s) => s.live && s.label === 'LOGISTICS BEAT'), 'synergiesFor: live pair flagged');
  check(syn.some((s) => !s.live && s.partner.includes('FEED')), 'synergiesFor: set hint shown as a partner');
  check(draftWeight('speedload', ['drummag']) > draftWeight('speedload', []),
    'draft: synergy-completing parts are offered more often');
  // Live weapon math (prototype methods on a stubbed gun).
  const gun = Object.create(Weapon.prototype);
  gun.game = { score: { multiplier: 3 }, focus: { active: false } };
  gun.damage = CONFIG.weapon.damage; gun.ammo = CONFIG.weapon.magSize;
  gun.holdRamp = 0; gun.heatRate = 0; gun.heatDamage = 0; gun.focusRate = 0;
  gun.lastShell = 0; gun._holdTime = 0;
  check(gun._cooldownMul() === 1 && gun.currentDamage() === CONFIG.weapon.damage,
    'service-issue gun: no rate or damage bonus');
  gun.lastShell = 5; gun.ammo = 5; // the last 5 rounds of the drum
  check(gun.currentDamage() === CONFIG.weapon.damage * 2, 'LAST SHELL STANCE: last rounds hit for double');
  gun.ammo = 6;
  check(gun.currentDamage() === CONFIG.weapon.damage, 'LAST SHELL STANCE: stops at one round to spare');
  gun.lastShell = 0; gun.heatDamage = 0.05; gun.heatRate = 0.09; gun.focusRate = 0.9; gun.holdRamp = 0.45;
  gun._holdTime = 1.6; gun.game.focus.active = true;
  check(gun.currentDamage() > CONFIG.weapon.damage * 1.09, 'TOLEDO HEAT: combo tiers add damage');
  check(gun._cooldownMul() < 0.42, `SUPPRESSION stack: rate ×${(1 / gun._cooldownMul()).toFixed(2)} at x3 combo in bullet time`);
}

console.log(failures === 0 ? '\nALL SMOKE TESTS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
