// Weapon parts: pick one per cleared mission, stays for the rest of the run.
//
// Parts are declarative instead of imperative. resolveBuild() recomputes the
// whole gun from the owned set, so picks are order-independent, applying a
// part twice changes nothing, and pair/set synergies land exactly once.

import { CONFIG } from '../config.js';

// ---- Stat vocabulary -------------------------------------------------------
// add: flat delta on a base value. mul: factor on a base value.
// Anything at 0 (add) / 1 (mul) is the untouched service-issue gun.
const ADD_BASE = () => ({
  magSize: CONFIG.weapon.magSize,
  damage: CONFIG.weapon.damage,
  holdRamp: 0,        // TRIGGER FINGER: sustained-fire rate bonus
  critChance: 0,
  pierce: 0,          // extra buffalo a round passes through
  headshotBonus: 0,   // flat extra damage on head/horn hits
  precisionMul: 0,    // fractional extra damage on head/horn hits
  tacticalReload: 0,  // reload fast when the drum is at/above this fraction
  tacticalCut: 0,     // fraction of the reload time that tactical reload removes
  lastShell: 0,       // last N rounds in the drum hit for double
  heatRate: 0,        // fire-rate bonus per combo tier above x1
  heatDamage: 0,      // damage bonus per combo tier above x1
  focusRate: 0,       // extra fire rate while bullet time is active
  killCash: 0,        // bounty per kill
  pierceScore: 0,     // bonus score for every buffalo a round pierces into
  stunRadius: 9,      // FLASH STEER reach
  stunTime: 1.6,      // FLASH STEER hold
  armorPct: 0,
  armorFlat: 0
});
const MUL_BASE = () => ({
  cooldownMul: 1,
  reloadMul: 1,
  recoilMul: 1,
  spreadMul: 1,
  bloomGrowMul: 1,
  bloomDecayMul: 1,
  bonusMul: 1
});
const FLAG_BASE = () => ({ luckyMiss: false, stunOnKill: false, bountyCombo: false });

const CAPS = {
  magSize: [5, 90], damage: [1, 8], holdRamp: [0, 1.1], critChance: [0, 0.5],
  pierce: [0, 4], headshotBonus: [0, 4], precisionMul: [0, 1.2],
  tacticalReload: [0, 0.9], tacticalCut: [0, 0.7], lastShell: [0, 10],
  heatRate: [0, 0.3], heatDamage: [0, 0.25], focusRate: [0, 1.8],
  killCash: [0, 900], pierceScore: [0, 600], stunRadius: [0, 16], stunTime: [0, 3.5],
  armorPct: [0, 0.55], armorFlat: [0, 4],
  cooldownMul: [0.42, 1.6], reloadMul: [0.25, 1.6], recoilMul: [0.2, 1.6],
  spreadMul: [0.22, 1.6], bloomGrowMul: [0.4, 1.8], bloomDecayMul: [0.6, 2.6],
  bonusMul: [1, 3]
};

// ---- Parts -----------------------------------------------------------------
// tags drive the set bonuses; a part with a `once` hook fires that effect at
// pick time only (healing must not re-fire every rebuild).
export const PARTS = [
  // ---- COMMON: dependable precinct issue ----
  { id: 'drummag', name: 'DRUM MAG', rarity: 'common', icon: '🥁', tags: ['feed'],
    desc: '+12 rounds in the drum.',
    flavor: '"It clicked off the supply shelf by itself."',
    add: { magSize: 12 } },
  { id: 'speedload', name: 'SPEED LOADER', rarity: 'common', icon: '🛠️', tags: ['feed'],
    desc: 'Reloads 40% faster.',
    flavor: 'Rubber bands and civic pride.',
    mul: { reloadMul: 0.6 } },
  { id: 'sights', name: 'DOT SIGHT', rarity: 'common', icon: '🎯', tags: ['sight'],
    desc: 'Bloom spread −40%, and the aim converges 25% faster.',
    flavor: 'Glass-filled. Police grade. Slightly stolen.',
    mul: { spreadMul: 0.6, bloomDecayMul: 1.25 } },
  { id: 'parade', name: 'PARADE STOCK', rarity: 'common', icon: '🪖', tags: ['sight'],
    desc: 'Recoil halved, and bloom builds 12% slower.',
    flavor: 'Fitted by a quartermaster who never rode the rail.',
    mul: { recoilMul: 0.5, bloomGrowMul: 0.88 } },
  { id: 'notch', name: 'MARKSMAN NOTCH', rarity: 'common', icon: '🦌', tags: ['sight'],
    desc: 'Head and horn hits bite for +1 damage.',
    flavor: 'Horn-tip practice targets, sold by the crate.',
    add: { headshotBonus: 1 } },
  { id: 'medkit', name: 'PRECINCT MEDKIT', rarity: 'common', icon: '⛑️', tags: ['med'],
    desc: 'Heal 3 health.',
    flavor: 'Salve, bandage, and a stern word about posture.',
    once: (g) => g.player.heal(3) },
  { id: 'vest', name: 'KEVLAR VEST', rarity: 'common', icon: '🛡️', tags: ['med'],
    desc: 'Charge damage −15%.',
    flavor: 'Smells faintly of the parade.',
    add: { armorPct: 0.15 } },

  // ---- RARE: field modifications ----
  { id: 'hairtrigger', name: 'HAIR TRIGGER', rarity: 'rare', icon: '💥', tags: ['rate'],
    desc: '+1 damage per round.',
    flavor: 'The gunsmith winked while filing it.',
    add: { damage: 1 } },
  { id: 'triggerfinger', name: 'TRIGGER FINGER', rarity: 'rare', icon: '👆', tags: ['rate'],
    desc: 'Holding the trigger ramps fire rate up to +45%.',
    flavor: 'Two years of state-fair ribbon work pays off.',
    add: { holdRamp: 0.45 } },
  { id: 'hollow', name: 'HOLLOW POINTS', rarity: 'rare', icon: '🕳️', tags: ['rounds'],
    desc: 'Rounds pass through into one more buffalo.',
    flavor: 'The evidence locker calls these "creative".',
    add: { pierce: 1 } },
  { id: 'splittip', name: 'SPLIT-TIP LOAD', rarity: 'rare', icon: '🎲', tags: ['rounds'],
    desc: '12% chance a round doubles its damage.',
    flavor: 'Lot 42-B. Nobody signed for lot 42-B.',
    add: { critChance: 0.12 } },
  { id: 'casecatch', name: 'CASE CATCH', rarity: 'rare', icon: '🪣', tags: ['feed'],
    desc: 'Reload 60% faster while the drum is above 60% full.',
    flavor: 'Top it off, don\'t empty it.',
    add: { tacticalReload: 0.6, tacticalCut: 0.6 } },
  { id: 'chrome', name: 'CHROME BUMPER', rarity: 'rare', icon: '💰', tags: ['bounty'],
    desc: 'Every kill pays a +$150 bounty.',
    flavor: 'The city pays per head. Don\'t ask for receipts.',
    add: { killCash: 150 } },
  { id: 'review', name: 'PERFORMANCE REVIEW', rarity: 'rare', icon: '📈', tags: ['bounty'],
    desc: 'All score +25%.',
    flavor: 'Signed by a lieutenant who never rode the rail.',
    mul: { bonusMul: 1.25 } },
  { id: 'lucky', name: 'LUCKY TIE', rarity: 'rare', icon: '🍀', tags: ['tac'],
    desc: 'Misses have a 35% chance to keep your combo.',
    flavor: 'Found on the sidewalk. Kept for luck.',
    flag: { luckyMiss: true } },

  // ---- EPIC: the legends ----
  { id: 'fullthrottle', name: 'FULL THROTTLE', rarity: 'epic', icon: '🔥', tags: ['rate'],
    desc: 'Fire rate +39% — but bloom builds 18% faster.',
    flavor: 'The Uzi thanks you. Probably.',
    mul: { cooldownMul: 0.72, bloomGrowMul: 1.18 } },
  { id: 'lastshell', name: 'LAST SHELL STANCE', rarity: 'epic', icon: '🎖️', tags: ['tac'],
    desc: 'The last 5 rounds in the drum hit for double.',
    flavor: 'Departmental doctrine: empty the gun, then reload.',
    add: { lastShell: 5 } },
  { id: 'heat', name: 'TOLEDO HEAT', rarity: 'epic', icon: '🌡️', tags: ['rate'],
    desc: 'Every combo tier adds +9% fire rate and +5% damage.',
    flavor: 'The barrel knows when you are having a good day.',
    add: { heatRate: 0.09, heatDamage: 0.05 } },
  { id: 'timecrime', name: 'TIME CRIME', rarity: 'epic', icon: '⏱️', tags: ['tac'],
    desc: 'In bullet time the gun fires 90% faster.',
    flavor: 'Slow the herd, not the trigger.',
    add: { focusRate: 0.9 } },
  { id: 'flashbang', name: 'FLASH STEER', rarity: 'epic', icon: '📢', tags: ['tac'],
    desc: 'Kills flash-stun nearby buffalo for 1.6s.',
    flavor: 'The herds hate it. The auditors hate it more.',
    flag: { stunOnKill: true } }
];

// ---- Pair synergies: both parts owned, both effects upgrade ----
export const PAIRS = [
  { a: 'drummag', b: 'speedload', label: 'LOGISTICS BEAT',
    desc: '+8 more rounds, and reloads 15% faster again.',
    add: { magSize: 8 }, mul: { reloadMul: 0.85 } },
  { a: 'drummag', b: 'fullthrottle', label: 'ENDLESS DRUM',
    desc: '+10 more rounds to spend at full throttle.',
    add: { magSize: 10 } },
  { a: 'drummag', b: 'casecatch', label: 'COMBAT RELOAD',
    desc: 'Tactical reload threshold drops to 40%.',
    add: { tacticalReload: -0.2 } },
  { a: 'casecatch', b: 'lastshell', label: 'NEVER EMPTY',
    desc: '+6 rounds, and the tactical threshold drops to 50%.',
    add: { magSize: 6, tacticalReload: -0.1 } },
  { a: 'sights', b: 'parade', label: 'STEADY HAND',
    desc: 'Aim 22% tighter, converges 20% faster, +1 on heads.',
    mul: { spreadMul: 0.78, bloomDecayMul: 1.2 }, add: { headshotBonus: 1 } },
  { a: 'sights', b: 'notch', label: 'MARKSMAN COURSE',
    desc: 'Precision hits deal +40% damage.',
    add: { precisionMul: 0.4 } },
  { a: 'hairtrigger', b: 'triggerfinger', label: 'SUSTAINED SUPERIORITY',
    desc: 'The ramp digs 20% deeper and packs another +1 damage.',
    add: { holdRamp: 0.2, damage: 1 } },
  { a: 'hairtrigger', b: 'lastshell', label: 'DRY RANGE',
    desc: '+1 damage, and two more rounds count as last shells.',
    add: { damage: 1, lastShell: 2 } },
  { a: 'hollow', b: 'splittip', label: 'OVERMATCH',
    desc: '+1 pierce, and every pierced buffalo pays $125.',
    add: { pierce: 1, pierceScore: 125 } },
  { a: 'hollow', b: 'heat', label: 'HERD MARK',
    desc: 'Every pierced buffalo pays $150.',
    add: { pierceScore: 150 } },
  { a: 'triggerfinger', b: 'fullthrottle', label: 'SUPPRESSIVE FIRE',
    desc: 'Ramp digs 25% deeper, and the throttle\'s extra bloom is cancelled.',
    add: { holdRamp: 0.25 }, mul: { bloomGrowMul: 0.8 } },
  { a: 'fullthrottle', b: 'heat', label: 'RED LINE',
    desc: 'Another 10% fire rate; combo heat adds 5% more.',
    mul: { cooldownMul: 0.9 }, add: { heatRate: 0.05 } },
  { a: 'timecrime', b: 'heat', label: 'COLD BLOOD',
    desc: 'Bullet time gains 35% more rate; heat adds +5% damage.',
    add: { focusRate: 0.35, heatDamage: 0.05 } },
  { a: 'timecrime', b: 'sights', label: 'SURGICAL',
    desc: 'Aim 20% tighter, and bullet time gains 30% more rate.',
    mul: { spreadMul: 0.8 }, add: { focusRate: 0.3 } },
  { a: 'timecrime', b: 'flashbang', label: 'CROWD CONTROL',
    desc: 'Flash stuns reach 13m and hold 2.3s.',
    add: { stunRadius: 4, stunTime: 0.7 } },
  { a: 'chrome', b: 'review', label: 'GRANT MONEY',
    desc: '+$120 bounty, and bounties scale with your combo tier.',
    add: { killCash: 120 }, flag: { bountyCombo: true } },
  { a: 'lucky', b: 'review', label: 'INSURANCE FRAUD',
    desc: 'All score +15% more.',
    mul: { bonusMul: 1.15 } }
];

// ---- Set bonuses: enough parts sharing a tag changes the gun's character ----
export const SETS = [
  { tag: 'feed', need: 3, label: 'QUARTERMASTER',
    desc: 'Ammunition platoon: +14 rounds and 12% faster reloads.',
    add: { magSize: 14 }, mul: { reloadMul: 0.88 } },
  { tag: 'rate', need: 2, label: 'SUPPRESSION CERTIFIED',
    desc: '10% more fire rate — but bloom builds 12% faster.',
    mul: { cooldownMul: 0.9, bloomGrowMul: 1.12 } },
  { tag: 'rounds', need: 2, label: 'AMMO LOT 42',
    desc: 'Two special loads: +1 damage and +6% crit.',
    add: { damage: 1, critChance: 0.06 } },
  { tag: 'sight', need: 2, label: 'MARKSMAN LIST',
    desc: '15% tighter aim, converging 15% faster.',
    mul: { spreadMul: 0.85, bloomDecayMul: 1.15 } },
  { tag: 'tac', need: 2, label: 'FIELD COMMAND',
    desc: 'Six more rounds and 1 point off every charge.',
    add: { magSize: 6, armorFlat: 1 } },
  { tag: 'bounty', need: 2, label: 'CITY CONTRACT',
    desc: '+$150 per kill and all score +10%.',
    add: { killCash: 150 }, mul: { bonusMul: 1.1 } }
];

export const PART_IDS = PARTS.map((p) => p.id);
export const PART_BY_ID = Object.fromEntries(PARTS.map((p) => [p.id, p]));
export const RARITY_WEIGHT = { common: 2.4, rare: 1.6, epic: 1 };

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));

function merge(target, src, mode) {
  if (!src) return;
  for (const [k, v] of Object.entries(src)) {
    if (mode === 'mul') target[k] = (target[k] ?? 1) * v;
    else if (typeof v === 'boolean') target[k] = target[k] || v;
    else target[k] = (target[k] ?? 0) + v;
  }
}

/** Full derived build for an owned-part list (order-independent). */
export function resolveBuild(ownedIds) {
  const add = ADD_BASE(), mul = MUL_BASE(), flags = FLAG_BASE();
  const notes = [];
  const owned = [...new Set(ownedIds)].filter((id) => PART_BY_ID[id]);

  for (const id of owned) {
    const p = PART_BY_ID[id];
    merge(add, p.add, 'add');
    merge(mul, p.mul, 'mul');
    merge(flags, p.flag, 'add');
  }
  for (const pair of PAIRS) {
    if (!owned.includes(pair.a) || !owned.includes(pair.b)) continue;
    merge(add, pair.add, 'add');
    merge(mul, pair.mul, 'mul');
    merge(flags, pair.flag, 'add');
    notes.push({ label: pair.label, desc: pair.desc, kind: 'pair' });
  }
  for (const set of SETS) {
    const count = owned.filter((id) => PART_BY_ID[id].tags.includes(set.tag)).length;
    if (count < set.need) continue;
    merge(add, set.add, 'add');
    merge(mul, set.mul, 'mul');
    merge(flags, set.flag, 'add');
    notes.push({ label: set.label, desc: set.desc, kind: 'set' });
  }
  for (const k of Object.keys(add)) if (CAPS[k]) add[k] = clamp(add[k], CAPS[k]);
  for (const k of Object.keys(mul)) if (CAPS[k]) mul[k] = clamp(mul[k], CAPS[k]);
  return { add, mul, flags, notes };
}

/** Writes the resolved build onto the live weapon/player/score. Idempotent. */
export function applyBuild(game, ownedIds) {
  const b = resolveBuild(ownedIds);
  const w = game.player.weapon;
  const prevMag = w.magSize;

  w.magSize = Math.round(b.add.magSize);
  w.ammo = Math.min(w.magSize, w.ammo + Math.max(0, w.magSize - prevMag));
  w.fireCooldown = CONFIG.weapon.fireCooldown * b.mul.cooldownMul;
  w.reloadTime = CONFIG.weapon.reloadTime * b.mul.reloadMul;
  w.recoil = CONFIG.weapon.recoil * b.mul.recoilMul;
  w.damage = b.add.damage;
  w.spreadScale = b.mul.spreadMul;
  w.bloomGrowMul = b.mul.bloomGrowMul;
  w.bloomDecayMul = b.mul.bloomDecayMul;
  w.holdRamp = b.add.holdRamp;
  w.critChance = b.add.critChance;
  w.pierce = Math.round(b.add.pierce);
  w.headshotBonus = b.add.headshotBonus;
  w.precisionMul = b.add.precisionMul;
  w.tacticalReload = b.add.tacticalReload;
  w.tacticalCut = b.add.tacticalCut;
  w.lastShell = Math.round(b.add.lastShell);
  w.heatRate = b.add.heatRate;
  w.heatDamage = b.add.heatDamage;
  w.focusRate = b.add.focusRate;

  game.player.damageReduction = b.add.armorPct;
  game.player.flatDamageReduction = b.add.armorFlat;
  game.score.bonusMul = b.mul.bonusMul;
  game.buildFlags = {
    ...b.flags,
    killCash: b.add.killCash,
    pierceScore: b.add.pierceScore,
    stunRadius: b.add.stunRadius,
    stunTime: b.add.stunTime
  };
  game.buildNotes = b.notes;
  game.ui.setMagSize(w.magSize);
  return b;
}

/** Pair synergies for one part: live when the partner is already owned. */
export function synergiesFor(partId, ownedIds) {
  const out = [];
  for (const pair of PAIRS) {
    const other = pair.a === partId ? pair.b : pair.b === partId ? pair.a : null;
    if (!other) continue;
    out.push({
      label: pair.label,
      desc: pair.desc,
      partner: PART_BY_ID[other].name,
      live: ownedIds.includes(other)
    });
  }
  for (const set of SETS) {
    if (!PART_BY_ID[partId].tags.includes(set.tag)) continue;
    const have = ownedIds.filter((id) => PART_BY_ID[id].tags.includes(set.tag)).length;
    out.push({
      label: set.label,
      desc: set.desc,
      partner: `${set.tag.toUpperCase()} ×${set.need}`,
      live: have + 1 >= set.need
    });
  }
  return out;
}

/** Draft pull: partnered parts and set-completing parts show up more often. */
export function draftWeight(partId, ownedIds) {
  let weight = RARITY_WEIGHT[PART_BY_ID[partId].rarity];
  if (synergiesFor(partId, ownedIds).some((s) => s.live)) weight *= 1.9;
  return weight;
}

/** Rough damage-per-second vs the service-issue gun, for scaling boss HP.
 *  Rate comes from the cooldown multiplier plus the sustained-fire ramp; damage
 *  from flat damage, crits and HEAT; precision parts pay off on a head that is
 *  already a double hit. */
export function buildPowerMul(ownedIds) {
  const { add, mul } = resolveBuild(ownedIds || []);
  const rate = (1 + add.holdRamp * 0.75) / Math.max(0.2, mul.cooldownMul);
  const damage = (add.damage / CONFIG.weapon.damage)
    * (1 + add.critChance * 0.6)
    * (1 + add.heatDamage * 1.2);
  const precision = 1 + 0.35 * (add.headshotBonus / CONFIG.weapon.damage + add.precisionMul);
  return clamp(damage * rate * precision, [1, 6]);
}
