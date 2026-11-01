// Global game configuration
export const CONFIG = {
  weapon: {
    // "UZ-TOLEDO" — full-auto Toledo PD machine pistol.
    magSize: 30,          // drum magazine
    fireCooldown: 0.085,  // ~11.7 rounds/sec on hold
    reloadTime: 1.9,
    recoil: 0.014,        // per-shot camera kick (safe for full-auto)
    damage: 1,
    // Convergence: holding the trigger blooms the aim; releasing relaxes it.
    spreadMax: 0.055,     // NDC aim offset at full bloom (~2-3 degrees)
    bloomPerShot: 0.06,   // bloom gained per shot
    bloomDecay: 2.4       // bloom lost per second when not firing
  },
  scoring: {
    hit: 100,
    fastTakedown: 250,   // kill within FAST_TAKEDOWN_WINDOW of spawn
    precision: 300,      // head shot
    environmental: 50,   // shootable props
    bossDamage: 500,
    civilianPenalty: 500,
    fastTakedownWindow: 4.0
  },
  combo: [
    { hits: 30, mult: 5 },
    { hits: 20, mult: 4 },
    { hits: 10, mult: 3 },
    { hits: 5, mult: 2 }
  ],
  player: { maxHp: 100 },
  buffalos: {
    normal: { hp: 2, speed: 1.6, scale: [0.9, 1.1] },
    angry: { hp: 3, speed: 2.4, scale: [0.95, 1.1] },
    panicked: { hp: 1, speed: 7.5, scale: [0.85, 1.05] },
    bandit: { hp: 2, speed: 5.6, scale: [0.9, 1.05] }, // donut thief: fast, lateral, loot on head
    traffic: { hp: 2, speed: 0, scale: [1.0, 1.2] },
    fair: { hp: 2, speed: 1.4, scale: [0.9, 1.1] },
    security: { hp: 4, speed: 1.8, scale: [1.05, 1.2] },
    giant: { hp: 9, speed: 0, scale: [3, 3] }
  },
  boss: {
    // HP is a baseline: it gets multiplied by the run's gun power (see
    // buildPowerMul) so the fight lasts the same ~25s whether you show up with
    // the service-issue drum or a maxed-out parts build.
    hp: 150,
    hpMaxMul: 6,
    name: 'THE BIGGEST BUFFALO IN TOLEDO',
    // Framing: giants are scale 3, so he has to read as bigger — but at 5.2 his
    // horns left the screen. This fits the boss-fight camera at both ends of
    // his dodge band.
    scale: 3.8,
    minDist: 10,   // a charge stops here (he hits you, not the lens)
    maxDist: 30,   // dodging never slides him out of frame
    contactDamage: 20,
    // Per-phase dodge cadence: how long he holds a lane, and how fast he
    // crosses to the next one. Later phases hold shorter and cross faster.
    dodge: {
      1: { interval: 6.5, speed: 3.2 },
      2: { interval: 4.4, speed: 4.4 },
      3: { interval: 3.2, speed: 5.6 },
      4: { interval: 2.4, speed: 6.8 }
    }
  },
  difficulty: {
    easy:   { telegraph: 1.35, chargeSpeed: 0.75, spawnScale: 0.8, damageTaken: 0.6, label: 'EASY' },
    normal: { telegraph: 1.0, chargeSpeed: 1.0, spawnScale: 1.0, damageTaken: 1.0, label: 'NORMAL' },
    hard:   { telegraph: 0.65, chargeSpeed: 1.3, spawnScale: 1.4, damageTaken: 1.4, label: 'HARD' }
  },
  defaults: {
    sensitivity: 1.0,
    masterVolume: 0.8,
    musicVolume: 0.7,
    sfxVolume: 0.9,
    screenShake: true,
    crt: true,
    crosshairSize: 1.0,
    difficulty: 'normal'
  }
};

export function comboMultiplier(hits) {
  for (const tier of CONFIG.combo) {
    if (hits >= tier.hits) return tier.mult;
  }
  return 1;
}
