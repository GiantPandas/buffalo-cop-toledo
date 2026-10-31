// Global game configuration
export const CONFIG = {
  weapon: {
    magSize: 6,
    fireCooldown: 0.16,
    reloadTime: 1.25,
    recoil: 0.045,
    damage: 1
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
    hp: 46,
    name: 'THE BIGGEST BUFFALO IN TOLEDO'
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
