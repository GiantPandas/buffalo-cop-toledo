// Roguelike upgrades: pick one per cleared level, persists for the run.
// Each def mutates live game state (see Weapon.reset() / Player.resetRun() for base values).
export const UPGRADES = [
  { id: 'rof', name: 'OVERCLOCKED TRIGGER', desc: '+25% FIRE RATE', apply(g) { g.player.weapon.fireCooldown *= 0.8; } },
  { id: 'damage', name: 'HEAVY CALIBER', desc: '+1 DAMAGE PER SHOT', apply(g) { g.player.weapon.damage += 1; } },
  { id: 'magsize', name: 'EXTENDED MAG', desc: '+2 MAG SIZE', apply(g) { const w = g.player.weapon; w.magSize += 2; w.ammo = w.magSize; } },
  { id: 'reload', name: 'QUICK SWAP', desc: '-20% RELOAD TIME', apply(g) { g.player.weapon.reloadTime *= 0.8; } },
  { id: 'recoil', name: 'STABILIZER', desc: 'LESS CAMERA KICK', apply(g) { g.player.weapon.recoil *= 0.6; } },
  { id: 'crit', name: 'LUCKY ROUNDS', desc: '+8% CHANCE TO CRIT · CRITS DEAL 2× DAMAGE', apply(g) { g.player.weapon.critChance += 0.08; } },
  { id: 'pierce', name: 'HOLLOW POINTS', desc: 'BULLETS PIERCE +1 BUFFALO', apply(g) { g.player.weapon.pierce += 1; } },
  { id: 'headshot', name: 'SNIPER GLASS', desc: '+3 DAMAGE ON HEADSHOTS', apply(g) { g.player.weapon.headshotBonus += 3; } },
  { id: 'armor', name: 'REINFORCED VEST', desc: '-20% DAMAGE FROM CHARGES (MAX 75%)', apply(g) { g.player.damageReduction = Math.min(0.75, g.player.damageReduction + 0.2); } },
  { id: 'plating', name: 'CERAMIC PLATING', desc: '-3 DAMAGE PER HIT TAKEN', apply(g) { g.player.flatDamageReduction += 3; } },
  { id: 'medic', name: 'FIELD MEDIC', desc: '+20 MAX HP · FULL HEAL NOW', apply(g) { g.player.maxHp += 20; g.player.hp = g.player.maxHp; } },
  { id: 'greed', name: 'CASH FOR BUFFALO', desc: 'KILLS & HITS PAY +25% MORE', apply(g) { g.score.bonusMul += 0.25; } }
];

export const UPGRADE_IDS = UPGRADES.map((u) => u.id);
