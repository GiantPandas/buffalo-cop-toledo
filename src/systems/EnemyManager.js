import { Buffalo } from '../enemies/Buffalo.js';
import { NPC } from '../enemies/NPC.js';

// Owns all live enemies + NPCs. Handles spawning, updates, cleanup.
export class EnemyManager {
  constructor(game) {
    this.game = game;
    this.buffalos = [];
    this.npcs = [];
  }

  // Hard cap keeps herds looking huge without wrecking the frame rate.
  static MAX_BUFFALO = 36;

  spawnBuffalo(variant, position) {
    if (this.buffalos.length >= EnemyManager.MAX_BUFFALO) {
      // Recycle the oldest passive buffalo to make room.
      const idx = this.buffalos.findIndex((b) => !b.dead && (b.state === 'idle' || b.state === 'walk') &&
        ['normal', 'traffic', 'fair'].includes(b.variant));
      if (idx >= 0) {
        this.buffalos[idx].dispose();
        this.buffalos.splice(idx, 1);
      } else {
        return null; // board is full; skip this spawn.
      }
    }
    const b = new Buffalo(variant, position, this.game);
    this.buffalos.push(b);
    return b;
  }

  spawnNPC(kind, position) {
    const n = new NPC(kind, position, this.game);
    this.npcs.push(n);
    return n;
  }

  // Flat list of hit-testable root groups (buffalo + npc).
  hitTargets() {
    const out = [];
    for (const b of this.buffalos) if (!b.dead) out.push(b.group);
    for (const n of this.npcs) out.push(n.group);
    return out;
  }

  update(dt, time) {
    for (const b of this.buffalos) {
      if (b._gone || (b.dead && time >= b.removeAt)) continue;
      b.update(dt, time);
    }
    // Remove dead/finished.
    for (let i = this.buffalos.length - 1; i >= 0; i--) {
      const b = this.buffalos[i];
      if (b._gone || (b.dead && time >= b.removeAt)) {
        b.dispose();
        this.buffalos.splice(i, 1);
      }
    }
    for (const n of this.npcs) n.update(dt, time);
  }

  clear() {
    for (const b of this.buffalos) b.dispose();
    for (const n of this.npcs) n.dispose();
    this.buffalos = [];
    this.npcs = [];
  }
}
