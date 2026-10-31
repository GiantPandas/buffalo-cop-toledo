import { CONFIG } from '../config.js';
import { comboMultiplier } from '../config.js';

// Arcade scoring with combo multiplier tiers.
export class ScoreManager {
  constructor() { this.reset(); }

  reset() {
    this.score = 0;
    this.comboHits = 0;
    this.bestCombo = 1;
    this.shotsFired = 0;
    this.hitsLanded = 0;
    this.bonusMul = 1; // run upgrade: kills & hits pay more
  }

  get multiplier() { return comboMultiplier(this.comboHits); }

  shotFired() { this.shotsFired++; }

  // Register a successful hit worth `raw` base points. Returns total added.
  registerHit(raw) {
    this.hitsLanded++;
    this.comboHits++;
    const mult = this.multiplier;
    if (mult > this.bestCombo) this.bestCombo = mult;
    const added = Math.round(raw * mult * this.bonusMul);
    this.score += added;
    return added;
  }

  addFlat(points) { this.score += points; return points; }

  // A miss or a civilian shot breaks the combo.
  breakCombo() { this.comboHits = 0; }

  get accuracy() {
    if (this.shotsFired === 0) return 0;
    return this.hitsLanded / this.shotsFired;
  }
}
