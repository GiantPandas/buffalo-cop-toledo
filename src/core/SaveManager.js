import { CONFIG } from '../config.js';

// LocalStorage persistence with graceful fallback when storage is unavailable.
const SCORES_KEY = 'buffaloCop.scores.v1';
const OPTIONS_KEY = 'buffaloCop.options.v1';
const PROGRESS_KEY = 'buffaloCop.progress.v1';

function safeGet(key) {
  try { return window.localStorage.getItem(key); } catch (e) { return null; }
}
function safeSet(key, val) {
  try { window.localStorage.setItem(key, val); return true; } catch (e) { return false; }
}

export class SaveManager {
  constructor() {
    this.scores = [];
    this.options = { ...CONFIG.defaults };
    this.progress = { maxUnlocked: 1 };
    this.load();
  }

  load() {
    const s = safeGet(SCORES_KEY);
    if (s) { try { this.scores = JSON.parse(s) || []; } catch (e) { this.scores = []; } }
    const o = safeGet(OPTIONS_KEY);
    if (o) { try { this.options = { ...CONFIG.defaults, ...JSON.parse(o) }; } catch (e) {} }
    const p = safeGet(PROGRESS_KEY);
    if (p) { try { this.progress = { maxUnlocked: 1, ...JSON.parse(p) }; } catch (e) {} }
  }

  saveScores() { safeSet(SCORES_KEY, JSON.stringify(this.scores)); }
  saveOptions() { safeSet(OPTIONS_KEY, JSON.stringify(this.options)); }
  saveProgress() { safeSet(PROGRESS_KEY, JSON.stringify(this.progress)); }

  // Returns rank (0-based) if the score made the top 10, else -1.
  addScore(entry) {
    const e = {
      name: String(entry.name || '???').toUpperCase().slice(0, 3).padEnd(3, ' '),
      score: Math.floor(entry.score),
      accuracy: Math.floor(entry.accuracy * 100),
      level: entry.level,
      date: new Date().toISOString().slice(0, 10)
    };
    this.scores.push(e);
    this.scores.sort((a, b) => b.score - a.score);
    this.scores = this.scores.slice(0, 10);
    const rank = this.scores.indexOf(e);
    this.saveScores();
    return rank;
  }

  qualifies(score) {
    if (this.scores.length < 10) return score > 0;
    return score > this.scores[this.scores.length - 1].score;
  }

  unlockLevel(idx) {
    if (idx + 1 > this.progress.maxUnlocked) {
      this.progress.maxUnlocked = idx + 1;
      this.saveProgress();
    }
  }
}
