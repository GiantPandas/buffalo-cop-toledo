import { pad, fmt } from '../utils/mathx.js';
import { CONFIG } from '../config.js';

// All DOM-based UI: menus, HUD, announcer, results, high scores, options.
export class UIManager {
  constructor(game) {
    this.game = game;
    this.el = {};
    this._screens = [
      'screen-menu', 'screen-briefing', 'screen-levelselect', 'screen-highscores',
      'screen-options', 'screen-pause', 'screen-results', 'screen-upgrades',
      'screen-gameover', 'screen-victory'
    ];
    this._comboVisible = false;
    this._floatCount = 0;
  }

  init() {
    for (const id of this._screens) this.el[id] = document.getElementById(id);
    this.el.hud = document.getElementById('hud');
    this.el.score = document.getElementById('score-value');
    this.el.comboWrap = document.getElementById('combo-wrap');
    this.el.comboText = document.getElementById('combo-text');
    this.el.hpFill = document.getElementById('hp-fill');
    this.el.hpValue = document.getElementById('hp-value');
    this.el.mission = document.getElementById('mission-label');
    this.el.ammoCount = document.getElementById('ammo-count');
    this.el.ammoFill = document.getElementById('ammo-fill');
    this.el.ammoReload = document.getElementById('ammo-reload');
    this.el.bossWrap = document.getElementById('boss-hp-wrap');
    this.el.bossName = document.getElementById('boss-name');
    this.el.bossFill = document.getElementById('boss-fill');
    this.el.crosshair = document.getElementById('crosshair');
    this.el.hitmarker = document.getElementById('hitmarker');
    this.el.announce = document.getElementById('announce');
    this.el.bigtext = document.getElementById('bigtext');
    this.el.damageVignette = document.getElementById('damage-vignette');
    this.el.dmgLayer = document.getElementById('dmg-layer');
    this.el.focusOverlay = document.getElementById('focus-overlay');
    this.el.crt = document.getElementById('crt-overlay');

    // Mag display sizing for the current weapon.
    this.setMagSize(this.game.player ? this.game.player.weapon.magSize : CONFIG.weapon.magSize);

    this._bindOptions();
    this._applyOptionsDom();
  }

  // ---------- Screen management ----------
  showScreen(id) {
    for (const s of this._screens) {
      this.el[s].classList.toggle('hidden', s !== id);
    }
  }

  showHud(show) {
    this.el.hud.classList.toggle('hidden', !show);
    this.el.crosshair.classList.toggle('hidden', !show);
    if (!show) {
      this.el.comboWrap.classList.add('hidden');
      this._comboVisible = false;
    }
  }

  // ---------- HUD ----------
  setMission(id, name) {
    this.el.mission.textContent = `MISSION ${pad(id, 2)} — ${name}`;
  }

  updateScore(score) {
    this.el.score.textContent = pad(score);
  }

  showCombo() {
    const mult = this.game.score.multiplier;
    if (mult > 1) {
      this.el.comboText.textContent = `BUFFALO COMBO x${mult}`;
      this.el.comboWrap.classList.remove('hidden');
      // Re-trigger pop animation.
      this.el.comboText.style.animation = 'none';
      void this.el.comboText.offsetWidth;
      this.el.comboText.style.animation = '';
      if (!this._comboVisible) {
        this._comboVisible = true;
        this.game.audio.comboUp(mult);
      }
    } else {
      this.el.comboWrap.classList.add('hidden');
      this._comboVisible = false;
    }
  }

  updateHp(hp, maxHp) {
    const r = Math.max(0, hp / maxHp);
    this.el.hpFill.style.width = `${r * 100}%`;
    this.el.hpValue.textContent = String(Math.ceil(hp));
    this.el.hpFill.style.background =
      r > 0.5 ? 'linear-gradient(90deg,#7dff6a,#3ad84a)' :
      r > 0.25 ? 'linear-gradient(90deg,#ffd23e,#ff9a1e)' :
      'linear-gradient(90deg,#ff5252,#c22e2e)';
  }

  updateAmmo(ammo, reloading) {
    if (ammo !== this._lastAmmo) {
      this._lastAmmo = ammo;
      this.el.ammoCount.textContent = `${ammo}/${this._magSize}`;
      this.el.ammoFill.style.width = `${(ammo / this._magSize) * 100}%`;
      this.el.ammoFill.classList.toggle('low', ammo <= Math.ceil(this._magSize * 0.15));
    }
    this.el.ammoReload.classList.toggle('hidden', !(reloading || ammo === 0));
    this.el.ammoReload.textContent = reloading ? 'RELOADING...' : 'RELOAD!';
  }

  showBossHp(name) {
    this.el.bossName.textContent = name;
    this.el.bossFill.style.width = '100%';
    this.el.bossWrap.classList.remove('hidden');
  }

  setBossHp(ratio) {
    this.el.bossFill.style.width = `${Math.max(0, ratio * 100)}%`;
  }

  hideBossHp() {
    this.el.bossWrap.classList.add('hidden');
  }

  // ---------- Crosshair / hit feedback ----------
  // bloom: 0..1 full-auto spread bloom — the brackets open as the trigger is held.
  updateCrosshair(x, y, targeting, bloom = 0) {
    const ch = this.el.crosshair;
    ch.style.left = `${x}px`;
    ch.style.top = `${y}px`;
    ch.style.transform = `scale(${1 + Math.min(1, bloom) * 0.8})`;
    ch.classList.toggle('targeting', !!targeting);
  }

  flashHitMarker(x, y) {
    const hm = this.el.hitmarker;
    hm.style.left = `${x}px`;
    hm.style.top = `${y}px`;
    hm.classList.remove('hidden');
    hm.classList.remove('flash');
    void hm.offsetWidth;
    hm.classList.add('flash');
  }

  flashDamage() {
    const v = this.el.damageVignette;
    v.style.transition = 'none';
    v.style.opacity = '0.9';
    requestAnimationFrame(() => {
      v.style.transition = 'opacity 0.5s';
      v.style.opacity = '0';
    });
  }

  flashReloadPrompt() {
    this.el.ammoReload.classList.remove('hidden');
    this.el.ammoReload.textContent = 'RELOAD!';
  }

  // ---------- Announcer / big text ----------
  announce(text) {
    const a = this.el.announce;
    a.textContent = text;
    a.classList.remove('hidden');
    a.classList.remove('fading');
    a.classList.remove('show');
    void a.offsetWidth;
    a.classList.add('show');
    clearTimeout(this._announceT);
    clearTimeout(this._announceFadeT);
    // Hold long enough to actually read a full Toledo travel-brochure line.
    this._announceT = setTimeout(() => a.classList.add('fading'), 2600);
    this._announceFadeT = setTimeout(() => {
      a.classList.add('hidden');
      a.classList.remove('show', 'fading');
    }, 3150);
  }

  showBigText(text, seconds) {
    const b = this.el.bigtext;
    b.textContent = text;
    b.classList.remove('hidden');
    clearTimeout(this._bigT);
    this._bigT = setTimeout(() => b.classList.add('hidden'), seconds * 1000);
  }

  // Bullet-time overlay ("Last of the Herd").
  setFocus(on) {
    const f = this.el.focusOverlay;
    if (f) f.classList.toggle('hidden', !on);
  }

  // ---------- Results screen ----------
  showResults(stats, bonus, total, isVictory) {
    this.showScreen('screen-results');
    document.getElementById('results-title').textContent =
      isVictory ? 'TOLEDO IS SAVED' : 'MISSION COMPLETE';
    const targets = {
      'res-kills': [stats.killed, (v) => String(v)],
      'res-accuracy': [Math.round(stats.accuracy * 100), (v) => `${Math.round(v)}%`],
      'res-combo': [stats.bestCombo, (v) => `x${Math.max(1, Math.round(v))}`],
      'res-damage': [stats.damageTaken, (v) => String(Math.round(v))],
      'res-bonus': [bonus, (v) => fmt(v)]
    };
    const start = performance.now();
    const dur = 1800;
    if (this._resultsAnim) cancelAnimationFrame(this._resultsAnim);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - t, 3); // ease-out cubic
      for (const [id, [val, f]] of Object.entries(targets)) {
        document.getElementById(id).textContent = f(val * e);
      }
      document.getElementById('res-total').textContent = fmt(total * e);
      if (t < 1) this._resultsAnim = requestAnimationFrame(tick);
    };
    this._resultsAnim = requestAnimationFrame(tick);
  }

  // ---------- Damage floaters ----------
  // Floating damage numbers at the exact hit point (screen space).
  spawnDamageFloat(x, y, amount, opts = {}) {
    const layer = this.el.dmgLayer;
    if (!layer) return;
    if (this._floatCount > 48) return; // don't flood the screen
    this._floatCount++;
    const el = document.createElement('span');
    el.className = 'dmg-float' + (opts.crit ? ' crit' : '') + (opts.head ? ' head' : '');
    el.textContent = String(amount);
    // Slight jitter so overlapping hits don't stack in the same pixel.
    el.style.left = `${x + (Math.random() - 0.5) * 14}px`;
    el.style.top = `${y + (Math.random() - 0.5) * 10}px`;
    layer.appendChild(el);
    let done = false;
    const kill = () => { if (done) return; done = true; el.remove(); this._floatCount--; };
    el.addEventListener('animationend', kill, { once: true });
    setTimeout(kill, 950); // safety net if animationend is skipped
  }

  // ---------- Upgrade pick (roguelike) ----------
  setMagSize(count) {
    this._magSize = count;
    this._lastAmmo = -1; // force a HUD refresh next frame
    this.el.ammoCount.textContent = `${count}/${count}`;
    this.el.ammoFill.style.width = '100%';
  }

  showUpgrades(options, title) {
    const t = document.getElementById('upg-title');
    if (t) t.textContent = title || 'CHOOSE YOUR NEXT EDGE';
    const grid = document.getElementById('upgrade-grid');
    grid.innerHTML = '';
    options.forEach((u, i) => {
      const card = document.createElement('button');
      card.className = `upg-card r-${u.rarity}`;
      card.innerHTML = `
        <div class="uc-icon">${u.icon}</div>
        <div class="uc-body">
          <div class="uc-rarity">${u.rarity}</div>
          <div class="uc-name">${u.name}</div>
          <div class="uc-desc">${u.desc}</div>
          <div class="uc-flavor">${u.flavor}</div>
        </div>`;
      card.style.animationDelay = `${i * 0.14}s`;
      card.addEventListener('click', () => { this.game.audio.uiSelect(); this.game.pickUpgrade(u.id); });
      grid.appendChild(card);
    });
    this.showScreen('screen-upgrades');
  }

  // ---------- High scores ----------
  showHighScores() {
    const table = document.getElementById('hs-table');
    const scores = this.game.save.scores;
    if (scores.length === 0) {
      table.innerHTML = '<div class="hs-row"><span class="hs-rank">-</span><span class="hs-name">---</span><span class="hs-score">NO SCORES YET</span><span class="hs-acc"></span><span class="hs-level"></span></div>';
    } else {
      table.innerHTML = scores.map((s, i) => `
        <div class="hs-row">
          <span class="hs-rank">${i + 1}</span>
          <span class="hs-name">${s.name.trim() || '???'}</span>
          <span class="hs-score">${fmt(s.score)}</span>
          <span class="hs-acc">${s.accuracy}%</span>
          <span class="hs-level">L${s.level}</span>
        </div>`).join('');
    }
    this.showScreen('screen-highscores');
  }

  // ---------- Level select ----------
  showLevelSelect() {
    const grid = document.getElementById('level-grid');
    grid.innerHTML = '';
    const unlocked = this.game.save.progress.maxUnlocked;
    for (const lvl of this.game.levels) {
      const locked = lvl.id > unlocked;
      const card = document.createElement('button');
      card.className = 'level-card' + (locked ? ' locked' : '');
      card.innerHTML = `
        <div>
          <div class="lc-name">${lvl.name}</div>
          <div class="lc-sub">${lvl.objective}${locked ? ' — LOCKED' : ''}</div>
        </div>
        <div class="lc-num">${pad(lvl.id, 2)}</div>`;
      if (!locked) {
        card.addEventListener('click', () => {
          this.game.audio.uiSelect();
          this.game.startLevel(lvl.id - 1);
        });
      } else {
        card.addEventListener('click', () => this.game.audio.dryFire());
      }
      grid.appendChild(card);
    }
    this.showScreen('screen-levelselect');
  }

  // ---------- Options ----------
  showOptions(from) {
    const o = this.game.options;
    document.getElementById('opt-sensitivity').value = o.sensitivity;
    document.getElementById('opt-master').value = o.masterVolume;
    document.getElementById('opt-music').value = o.musicVolume;
    document.getElementById('opt-sfx').value = o.sfxVolume;
    document.getElementById('opt-shake').value = o.screenShake ? 'on' : 'off';
    document.getElementById('opt-crt').value = o.crt ? 'on' : 'off';
    document.getElementById('opt-crosshair').value = o.crosshairSize;
    document.getElementById('opt-difficulty').value = o.difficulty;
    this._optionsFrom = from || 'menu';
    this.showScreen('screen-options');
  }

  _bindOptions() {
    const g = this.game;
    const set = (key, val) => {
      g.options[key] = val;
      g.save.options = { ...g.options };
      g.save.saveOptions();
      g.applyOptions();
    };
    document.getElementById('opt-sensitivity').addEventListener('input', (e) => set('sensitivity', parseFloat(e.target.value)));
    document.getElementById('opt-master').addEventListener('input', (e) => set('masterVolume', parseFloat(e.target.value)));
    document.getElementById('opt-music').addEventListener('input', (e) => set('musicVolume', parseFloat(e.target.value)));
    document.getElementById('opt-sfx').addEventListener('input', (e) => set('sfxVolume', parseFloat(e.target.value)));
    document.getElementById('opt-shake').addEventListener('change', (e) => set('screenShake', e.target.value === 'on'));
    document.getElementById('opt-crt').addEventListener('change', (e) => set('crt', e.target.value === 'on'));
    document.getElementById('opt-crosshair').addEventListener('input', (e) => set('crosshairSize', parseFloat(e.target.value)));
    document.getElementById('opt-difficulty').addEventListener('change', (e) => set('difficulty', e.target.value));
  }

  _applyOptionsDom() {
    const o = this.game.options;
    this.el.crt.classList.toggle('off', !o.crt);
    const s = o.crosshairSize;
    this.el.crosshair.style.width = `${46 * s}px`;
    this.el.crosshair.style.height = `${46 * s}px`;
    this.el.crosshair.style.margin = `${-23 * s}px 0 0 ${-23 * s}px`;
  }

  // ---------- Briefing ----------
  showBriefing(levelData) {
    document.getElementById('brief-mission').textContent = `MISSION ${pad(levelData.id, 2)}`;
    document.getElementById('brief-name').textContent = levelData.name;
    document.getElementById('brief-objective').textContent = `OBJECTIVE: ${levelData.objective}`;
    document.getElementById('brief-flavor').textContent = (levelData.flavor || []).join('\n');
    this.showScreen('screen-briefing');
  }

  // ---------- Game over / victory ----------
  showGameOver(score, qualifies) {
    document.getElementById('go-score').textContent = fmt(score);
    const wrap = document.getElementById('go-name-wrap');
    wrap.classList.toggle('hidden', !qualifies);
    if (qualifies) document.getElementById('go-name-input').value = '';
    this.showScreen('screen-gameover');
  }

  showVictory(score, qualifies) {
    document.getElementById('vic-score').textContent = fmt(score);
    const wrap = document.getElementById('vic-name-wrap');
    wrap.classList.toggle('hidden', !qualifies);
    if (qualifies) document.getElementById('vic-name-input').value = '';
    this.showScreen('screen-victory');
  }

  confirmName(inputId, action) {
    const name = (document.getElementById(inputId).value || '???').toUpperCase().slice(0, 3);
    const g = this.game;
    const entry = {
      name,
      score: g.score.score,
      accuracy: g.score.accuracy,
      level: g.currentLevelId
    };
    g.save.addScore(entry);
    action(name);
  }
}
