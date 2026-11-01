// Roguelike upgrades: pick one per cleared level, persists for the run.
// A rarity-weighted draft — commons are dependable issue, rares are field
// modifications, epics bend the rules of the gun itself.

export const UPGRADES = [
  // ---- COMMON: dependable precinct issue ----
  { id: 'magsize', name: 'DRUM MAG', rarity: 'common', icon: '🥁',
    desc: '+10 rounds in the drum.',
    flavor: '"It clicked off the supply shelf by itself."',
    apply: (g) => g.player.weapon.addStat('magSize', 10) },
  { id: 'speedload', name: 'SPEED LOADER', rarity: 'common', icon: '🛠️',
    desc: 'Reloads 45% faster.',
    flavor: 'Rubber bands and civic pride.',
    apply: (g) => g.player.weapon.addStat('reloadTime', -0.45) },
  { id: 'sights', name: 'DOT SIGHT', rarity: 'common', icon: '🎯',
    desc: 'Bloom spread −40% — full auto behaves.',
    flavor: 'Glass-filled. Police grade. Slightly stolen.',
    apply: (g) => g.player.weapon.spreadScale *= 0.6 },
  { id: 'healer', name: 'PRECINCT MEDKIT', rarity: 'common', icon: '⛑️',
    desc: 'Heal 3 health.',
    flavor: 'Salve, bandage, and a stern word about posture.',
    apply: (g) => g.player.heal(3) },
  { id: 'armor', name: 'KEVLAR VEST', rarity: 'common', icon: '🛡️',
    desc: 'Charge damage −15%.',
    flavor: 'Smells faintly of the parade.',
    apply: (g) => g.player.damageReduction += 0.15 },

  // ---- RARE: field modifications ----
  { id: 'hairtrigger', name: 'HAIR TRIGGER', rarity: 'rare', icon: '💥',
    desc: '+1 damage per round.',
    flavor: 'The gunsmith winked while filing it.',
    apply: (g) => g.player.weapon.addStat('damage', 1) },
  { id: 'triggerfinger', name: 'TRIGGER FINGER', rarity: 'rare', icon: '👆',
    desc: 'Holding the trigger ramps fire rate up to +40%.',
    flavor: 'Two years of state-fair ribbon work pays off.',
    apply: (g) => g.player.weapon.holdRamp = 0.4 },
  { id: 'lucky', name: 'LUCKY TIE', rarity: 'rare', icon: '🍀',
    desc: 'Misses have a 35% chance to keep your combo.',
    flavor: 'Found on the sidewalk. Kept for luck.',
    apply: (g) => { g.luckyMiss = true; } },
  { id: 'chrome', name: 'CHROME BUMPER', rarity: 'rare', icon: '💰',
    desc: 'Every kill pays a +$150 bounty.',
    flavor: 'The city pays per head. Don\'t ask for receipts.',
    apply: (g) => { g.killCash = (g.killCash || 0) + 150; } },
  { id: 'extra', name: 'OVERTIME FORM', rarity: 'rare', icon: '📈',
    desc: 'All score +25%.',
    flavor: 'Signed by a lieutenant who never rode the rail.',
    apply: (g) => g.score.bonusMul *= 1.25 },

  // ---- EPIC: the legends ----
  { id: 'flashbang', name: 'FLASH STEER', rarity: 'epic', icon: '📢',
    desc: 'Kills flash-stun nearby buffalo for 1.6s.',
    flavor: 'The herds hate it. The auditors hate it more.',
    apply: (g) => { g.stunOnKill = true; } },
  { id: 'fullthrottle', name: 'FULL THROTTLE', rarity: 'epic', icon: '🔥',
    desc: 'Fire rate +30% and +6 rounds.',
    flavor: 'The Uzi thanks you. Probably.',
    apply: (g) => { g.player.weapon.fireCooldown *= 0.72; g.player.weapon.addStat('magSize', 6); } },
  { id: 'plate', name: 'RAM PLATING', rarity: 'epic', icon: '🚔',
    desc: '−1 damage from every charge and heal 2.',
    flavor: 'Bumper off a patrol car that already lost that fight.',
    apply: (g) => { g.player.flatDamageReduction += 1; g.player.heal(2); } }
];

export const UPGRADE_IDS = UPGRADES.map((u) => u.id);
