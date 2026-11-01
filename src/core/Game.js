import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { InputManager } from './InputManager.js';
import { AudioManager } from './AudioManager.js';
import { SaveManager } from './SaveManager.js';
import { ScoreManager } from './ScoreManager.js';
import { CameraController } from '../systems/CameraController.js';
import { ParticleManager } from '../systems/ParticleManager.js';
import { EnemyManager } from '../systems/EnemyManager.js';
import { LevelManager } from '../systems/LevelManager.js';
import { Player } from '../player/Player.js';
import { UIManager } from '../systems/UIManager.js';
import { PARTS, PART_IDS, PART_BY_ID, applyBuild, draftWeight } from '../systems/upgrades.js';
import { coverBlocks } from '../utils/cover.js';
import { LEVELS } from '../levels/index.js';

const THEMES = {
  city:        { bg: 0x8fbce8, fog: 0xa9cbe6 },
  downtown:   { bg: 0x8ab4de, fog: 0x9dbfe2 },
  farm:        { bg: 0xb8dcee, fog: 0xcfe6f2 },
  fair:        { bg: 0x513a72, fog: 0x5d4680 },
  industrial: { bg: 0x8a9aa8, fog: 0x98a8b6 }
};

export class Game {
  constructor(container) {
    this.container = container;
    this.state = 'menu';
    this.time = 0;
    this._lastT = 0;
    this.levels = LEVELS;
    this.currentLevelId = 1;
    this.stats = { killed: 0, damageTaken: 0 };
    this.railFwd = new THREE.Vector3(0, 0, -1);
    this._announceLast = 0;
    this._announcePending = null;
    // Bullet time ("Last of the Herd"): slowed world while the trigger stays real-speed.
    this.timeScale = 1;
    this.focus = { active: false, timer: 0, lastAt: -999 };

    // Persistence + options.
    this.save = new SaveManager();
    this.options = { ...this.save.options };
    this.score = new ScoreManager();
    this.upgradePool = [...PART_IDS]; // parts still in the draft this run
    this._lastUpgrade = null;
    // Weapon build: owned part ids + the derived flags/notes resolveBuild() wrote.
    this.build = [];
    this.buildFlags = {
      luckyMiss: false, stunOnKill: false, bountyCombo: false,
      killCash: 0, pierceScore: 0, stunRadius: 9, stunTime: 1.6
    };
    this.buildNotes = [];

    // Renderer (graceful fallback if WebGL is unavailable).
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-family:monospace;font-size:20px;text-align:center;padding:40px';
      d.textContent = 'YOUR BROWSER COULD NOT START WEBGL.\nPLEASE USE A MODERN DESKTOP BROWSER TO PLAY BUFFALO COP.';
      container.appendChild(d);
      this._dead = true;
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    this.renderer = renderer;
    container.appendChild(renderer.domElement);

    // Scene + lights.
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(THEMES.city.bg);
    this.scene.fog = new THREE.Fog(THEMES.city.fog, 60, 240);
    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x3a2c1c, 1.15);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d8, 1.7);
    sun.position.set(60, 90, 40);
    this.scene.add(sun);

    // Camera (in scene so the gun view model renders).
    this.camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.1, 500);
    this.camera.position.set(0, 2.2, -170);
    this.scene.add(this.camera);
    this.cameraCtrl = new CameraController(this.camera);

    // Managers (order matters).
    this.input = new InputManager();
    this.audio = new AudioManager();
    this.particles = new ParticleManager(this.scene);
    this.enemyManager = new EnemyManager(this);
    this.levelManager = new LevelManager(this);
    this.player = new Player(this.camera, this);
    this.ui = new UIManager(this);
    this.ui.init();

    // Input + menu wiring.
    this.input.attach(renderer.domElement);
    window.addEventListener('resize', () => {
      const w = container.clientWidth, h = container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });

    // First user gesture unlocks audio.
    const unlock = () => {
      this.audio.init();
      if (this.state === 'menu') this.audio.playMusic('menu');
    };
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', unlock);

    this._wireMenu();
    this.applyOptions();
    this.ui.showScreen('screen-menu');
    this.ui.showHud(false);
  }

  // ---------------- Menu wiring ----------------
  _wireMenu() {
    const ui = this.ui;
    const onAction = (action) => {
      switch (action) {
        case 'start':
          this.audio.init();
          this.audio.uiSelect();
          this.startRun();
          break;
        case 'levelselect':
          this.audio.uiSelect();
          ui.showLevelSelect();
          break;
        case 'highscores':
          this.audio.uiSelect();
          ui.showHighScores();
          break;
        case 'options':
          this.audio.uiSelect();
          ui.showOptions('menu');
          break;
        case 'back':
          this.audio.uiMove();
          if (ui._optionsFrom === 'pause' && this.state === 'paused') {
            ui.showScreen('screen-pause');
          } else {
            this.state = 'menu';
            ui.showScreen('screen-menu');
          }
          break;
        case 'begin':
          this.audio.uiSelect();
          this.beginLevel();
          break;
        case 'resume':
          this.audio.uiSelect();
          this.resumeGame();
          break;
        case 'restart':
          this.audio.uiSelect();
          this.retryLevel();
          break;
        case 'pause-options':
          this.audio.uiMove();
          ui.showOptions('pause');
          break;
        case 'quit':
          this.audio.uiSelect();
          this.quitToMenu();
          break;
        case 'next':
          this.audio.uiSelect();
          this._afterResults();
          break;
        case 'retry':
          this.audio.uiSelect();
          this.retryLevel();
          break;
        case 'quit2': case 'quit3':
          this.audio.uiSelect();
          this.quitToMenu();
          break;
        case 'play-again':
          this.audio.uiSelect();
          this.startRun();
          break;
        case 'confirm-name-go':
          ui.confirmName('go-name-input', () => { this.audio.uiSelect(); this.quitToMenu(); });
          break;
        case 'confirm-name-vic':
          ui.confirmName('vic-name-input', () => { this.audio.uiSelect(); this.quitToMenu(); });
          break;
      }
    };

    document.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onAction(btn.dataset.action);
      });
    });

    // Enter key = begin mission from briefing.
    this.input.onKeyDown = (e) => {
      if (e.key === 'Enter' && this.state === 'briefing') this.beginLevel();
    };
  }

  applyOptions() {
    const o = this.options;
    this.audio.setOptions({
      masterVolume: o.masterVolume, musicVolume: o.musicVolume, sfxVolume: o.sfxVolume
    });
    this.cameraCtrl.shakeEnabled = !!o.screenShake;
    this.ui._applyOptionsDom();
  }

  get difficulty() { return CONFIG.difficulty[this.options.difficulty] || CONFIG.difficulty.normal; }

  levelDataFor(idx) { return this.levels[idx]; }

  // ---------------- Flow ----------------
  startRun() {
    this._freshRun(0);
  }

  // Every run begins by picking a starting upgrade (the loadout).
  _freshRun(idx) {
    this.score.reset();
    this.stats = { killed: 0, damageTaken: 0 };
    this.resetUpgrades();
    this._pendingLevel = idx;
    this.currentLevelId = idx + 1;
    this.state = 'upgrades';
    this._pickIsLoadout = true;
    this.ui.showUpgrades(this._rollUpgrades(), 'CHOOSE YOUR LOADOUT');
  }

  startLevel(idx) {
    // Coming from the menu means a fresh run: pick a loadout first.
    if (this.state === 'menu') {
      this._freshRun(idx);
      return;
    }
    this.currentLevelId = idx + 1;
    this._scoreAtLevelStart = this.score.score;
    this.state = 'briefing';
    this.ui.showBriefing(this.levelDataFor(idx));
    // Keep menu music until the level actually begins.
  }

  beginLevel() {
    const idx = this.currentLevelId - 1;
    this.state = 'playing';
    this._endFocus();
    this.player.hp = this.player.maxHp;
    this.player.alive = true;
    this.player.weapon.ammo = this.player.weapon.magSize; // respects EXTENDED MAG upgrade
    this.player.weapon.reloading = false;
    this.stats = { killed: 0, damageTaken: 0 };
    this._announcePending = null; // no stale shout leaks into the new level
    this.levelManager.load(idx);
    this.ui.updateHp(this.player.maxHp, this.player.maxHp);
    this.ui.updateScore(this.score.score);
    this.ui.showCombo();
    // Reset camera to rail start.
    const p = this.levelManager.rail.sampleAt(0, new THREE.Vector3());
    const l = this.levelManager.rail.sampleAt(0.02, new THREE.Vector3());
    this.cameraCtrl.reset(p, l);
    this.ui.showScreen(null);
    this.ui.showHud(true);
    this.audio.init();
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.ui.showScreen('screen-pause');
    this.audio.uiMove();
  }

  resumeGame() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.showScreen(null);
    this.audio.uiSelect();
  }

  retryLevel() {
    // Restore score to what it was at the start of this level.
    this.score.score = this._scoreAtLevelStart || 0;
    this.stats = { killed: 0, damageTaken: 0 };
    this.beginLevel();
  }

  quitToMenu() {
    this.state = 'menu';
    this._endFocus();
    this.levelManager.dispose();
    this.ui.showScreen('screen-menu');
    this.ui.showHud(false);
    this.audio.playMusic('menu');
  }

  completeLevel(isVictory) {
    if (this.state !== 'playing') return;
    const bonus = Math.round(
      this.player.hp * 100 +
      (this.player.weapon.ammo / this.player.weapon.magSize) * 2000 +
      this.score.accuracy * 5000);
    this.score.addFlat(bonus);
    this._lastBonus = bonus;
    this._isVictory = isVictory;
    this.state = 'results';
    if (!isVictory) {
      this.save.unlockLevel(this.currentLevelId - 1 + 1); // unlock next
    } else {
      this.save.unlockLevel(LEVELS.length - 1);
    }
    this.audio.victory();
    this.ui.showResults({
      killed: this.stats.killed,
      accuracy: this.score.accuracy,
      bestCombo: this.score.bestCombo,
      damageTaken: this.stats.damageTaken
    }, bonus, this.score.score, isVictory);
  }

  _afterResults() {
    if (this._isVictory) {
      const qualifies = this.save.qualifies(this.score.score);
      this.state = 'victory';
      this.ui.showVictory(this.score.score, qualifies);
    } else if (this.upgradePool.length > 0) {
      // Roguelike: offer a pick for the rest of the run.
      this.state = 'upgrades';
      this.ui.showUpgrades(this._rollUpgrades());
    } else {
      this.startLevel(this.currentLevelId); // next level index
    }
  }

  resetUpgrades() {
    this.player.weapon.reset();
    this.player.resetRun();
    this.build = [];
    this.upgradePool = [...PART_IDS];
    this._lastUpgrade = null;
    // Recomputes every derived stat, flag and note from the (empty) loadout.
    applyBuild(this, this.build);
  }

  _rollUpgrades() {
    // Rarity-weighted draft, biased toward synergy: a part that would complete
    // a pair or a set right now is almost twice as likely to show up.
    const ids = [...this.upgradePool];
    if (ids.some((id) => !PART_BY_ID[id])) {
      // Never soft-lock the pick screen on a bad id (stale pool, stale module).
      this.upgradePool = [...PART_IDS];
      this._lastUpgrade = null;
      return PARTS.slice(0, 3);
    }
    const last = ids.indexOf(this._lastUpgrade);
    if (ids.length > 1 && last >= 0) ids.splice(last, 1);
    const picks = [];
    while (picks.length < 3 && ids.length > 0) {
      let total = 0;
      for (const id of ids) total += draftWeight(id, this.build);
      let r = Math.random() * total;
      let idx = 0;
      for (let i = 0; i < ids.length; i++) {
        r -= draftWeight(ids[i], this.build);
        if (r <= 0) { idx = i; break; }
      }
      picks.push(ids.splice(idx, 1)[0]);
    }
    return picks.map((id) => PART_BY_ID[id]);
  }

  pickUpgrade(id) {
    if (this.state !== 'upgrades') return;
    const part = PART_BY_ID[id];
    if (!part || !this.upgradePool.includes(id)) return;
    this.upgradePool.splice(this.upgradePool.indexOf(id), 1);
    this.build.push(id);
    if (part.once) part.once(this); // one-shot effects (medkit heal) never re-fire
    const ownedBefore = new Set(this.buildNotes.map((n) => n.label));
    applyBuild(this, this.build);
    this._lastUpgrade = id;
    this.audio.uiSelect();

    const gained = this.buildNotes.filter((n) => !ownedBefore.has(n.label));
    if (gained.length) {
      this.showBigText(`${gained[0].label} ACTIVE`, 1.6);
      this.announce(gained.map((n) => n.desc).join(' '));
    }

    if (this._pickIsLoadout) {
      // Loadout picked: roll to the briefing for mission one.
      this._pickIsLoadout = false;
      this.startLevel(this._pendingLevel || 0);
    } else {
      // Advance to the next mission with the new part in hand.
      this.startLevel(this.currentLevelId);
    }
  }

  onGameOver() {
    if (this.state !== 'playing') return;
    this.state = 'gameover';
    this.audio.stopMusic();
    this.audio.gameover();
    const qualifies = this.save.qualifies(this.score.score);
    this.ui.showHud(false);
    this.ui.showGameOver(this.score.score, qualifies);
  }

  // ---------------- Per-frame callbacks (from systems) ----------------
  announce(text) {
    if (this.time - this._announceLast < 1.6) {
      // Don't drop it — queue the latest line for when the announcer is free.
      this._announcePending = text;
      return;
    }
    this.announceForce(text);
  }

  // Unthrottled: for moments that must not be skipped.
  announceForce(text) {
    this._announcePending = null;
    this._announceLast = this.time;
    this.ui.announce(text);
    this.audio.warning();
  }

  announceMaybe(text) {
    if (Math.random() < 0.6) this.announce(text);
  }

  showBigText(text, seconds) {
    this.ui.showBigText(text, seconds);
  }

  onBuffaloHit(buffalo, isHead, hitPoint) {
    const s = CONFIG.scoring;
    let base = s.hit;
    if (isHead) base += s.precision;
    if (this.time - buffalo.spawnTime < s.fastTakedownWindow) base += s.fastTakedown;
    if (this.focus.active) base *= 2; // bullet-time doubles the score
    const prevMult = this.score.multiplier;
    this.score.registerHit(base);
    this.audio.hit(isHead);
    this.ui.updateScore(this.score.score);
    this.ui.showCombo();
    this.ui.flashHitMarker(this.input.mouse.x, this.input.mouse.y);

    const w = this.player.weapon;
    let dmg = w.currentDamage();
    if (isHead) dmg += w.headshotBonus + dmg * w.precisionMul; // notch + marksman course
    let crit = false;
    if (w.critChance > 0 && Math.random() < w.critChance) { dmg *= 2; crit = true; this.audio.crit(); }
    buffalo.damage(dmg, isHead);
    // Brown fur chunks fly off away from the player + a dust puff.
    if (hitPoint) this._spawnHitChunks(hitPoint, isHead);
    // Damage number floating up from the exact hit point.
    if (hitPoint) {
      const sp = this._projectToScreen(hitPoint);
      this.ui.spawnDamageFloat(sp.x, sp.y, Math.round(buffalo.dealt), { crit, head: isHead });
    }
    const mult = this.score.multiplier;
    if (mult > prevMult && mult >= 3) this.showBigText(`COMBO x${mult} — TOLEDO APPROVES`, 0.8);
  }

  // Brown chunk burst at the exact hit point (hitPoint carries the raycast
  // normal): fur debris tumbles away from the player, plus a dust puff.
  _spawnHitChunks(hitPoint, isHead) {
    if (!this._hitTmp) { this._hitTmp = new THREE.Vector3(); this._hitDir = new THREE.Vector3(); }
    const p = this._hitTmp.copy(hitPoint);
    const dir = this._hitDir.copy(hitPoint).sub(this.camera.position).normalize();
    if (hitPoint.normal) p.addScaledVector(hitPoint.normal, 0.14);
    p.addScaledVector(dir, 0.12);
    this.particles.spawnBurst(p, {
      count: isHead ? 9 : 12, chunk: true, spin: [5, 14],
      colors: [0x6b4a2f, 0x5d4130, 0x83603f, 0x4e3a2a, 0x3c2c1e],
      size: [0.13, 0.3], speed: [2.4, 5.5], life: [0.45, 0.9],
      gravity: 8.5, dir, dirStrength: 3.2, grow: 0.06, upBias: 0.5
    });
    this.particles.spawnBurst(p, {
      count: 4, colors: [0xe8dcc0, 0xc9b28a],
      size: [0.18, 0.4], speed: [1, 2.6], life: [0.3, 0.55],
      gravity: 3, grow: 1.2
    });
    if (isHead) {
      // Horn spark glint on precision hits.
      this.particles.spawnBurst(p, {
        count: 6, streak: true, colors: [0xfff2c0, 0xffd97a, 0xffffff],
        size: [0.14, 0.26], speed: [4, 8], life: [0.08, 0.2],
        gravity: 1.5, grow: 0
      });
    }
  }

  _projectToScreen(worldPos) {
    if (!this._projTmp) this._projTmp = new THREE.Vector3();
    const v = this._projTmp.copy(worldPos);
    v.project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-v.y * 0.5 + 0.5) * window.innerHeight
    };
  }

  onBuffaloKilled(buffalo) {
    this.stats.killed++;
    const f = this.buildFlags;
    if (f.killCash > 0) {
      // CHROME BUMPER: the city pays per head. GRANT MONEY scales with combo.
      const tier = 1 + (f.bountyCombo ? (this.score.multiplier - 1) * 0.5 : 0);
      const bounty = Math.round(f.killCash * tier * this.score.bonusMul);
      this.score.addFlat(bounty);
      this.ui.updateScore(this.score.score);
    }
    if (f.stunOnKill) {
      // FLASH STEER: the kill pops a flash that rattles nearby buffalo.
      const pos = buffalo.group.position;
      for (const other of this.enemyManager.buffalos) {
        if (other !== buffalo && other.alive && other.variant !== 'boss' &&
            other.group.position.distanceTo(pos) <= f.stunRadius) {
          other.forceStagger(f.stunTime);
        }
      }
      this.particles.spawnBurst(pos.clone().setY(1.3), {
        count: 16,
        colors: [0xffffff, 0xf4d67a, 0xfff2c0],
        speed: [6, 13],
        size: [0.25, 0.6],
        life: [0.14, 0.28],
        gravity: 0,
        grow: 1.6,
      });
    }
    if (buffalo.variant === 'bandit') this.onBanditKilled(buffalo);
    if (this.focus.active) {
      if (this._aliveHerdCount() === 0) {
        const bonus = Math.round(750 * this.score.bonusMul);
        this.score.addFlat(bonus);
        this.ui.updateScore(this.score.score);
        this.showBigText(`HERD CLEARED! +${bonus}`, 1.6);
      }
      this._endFocus();
    }
  }

  onBanditKilled(bandit) {
    // The stolen precinct donuts, recovered the hard way.
    const bonus = Math.round(400 * this.score.bonusMul);
    this.score.addFlat(bonus);
    this.ui.updateScore(this.score.score);
    this.announceForce('DONUT RECOVERED! +400');
    this.audio.crit();
    this.particles.spawnBurst(bandit.group.position.clone().setY(1.2), {
      count: 20,
      colors: [0xff4fa0, 0xd9a26b, 0x9dff6a, 0xffffff],
      speed: [3, 7],
      life: [0.5, 1],
      size: [0.08, 0.18],
      upBias: 0.7
    });
  }

  onBanditEscaped() {
    this.announceMaybe('THE DONUT GOT AWAY.');
  }

  // Barrel explosion: splash damage on nearby buffalo + chain to neighbouring barrels.
  barrelBlast(pos, depth = 0, exclude = null) {
    const R = 6.5;
    let targets = 0;
    for (const b of this.enemyManager.buffalos) {
      if (!b.alive) continue;
      const p = b.group.position;
      const r = b.variant === 'boss' ? R * 1.4 : R;
      if (Math.hypot(p.x - pos.x, p.z - pos.z) > r) continue;
      targets++;
      // Flat points, not registerHit: splash shouldn't inflate combo or accuracy.
      this.score.addFlat(Math.round(75 * this.score.multiplier * this.score.bonusMul));
      b.damage(b.variant === 'boss' ? 1 : 2, false);
      if (!this._blastTmp) this._blastTmp = new THREE.Vector3();
      const sp = this._projectToScreen(b.chestPos(this._blastTmp));
      this.ui.spawnDamageFloat(sp.x, sp.y, b.variant === 'boss' ? 1 : 2, {});
    }
    if (targets >= 2) this.announceMaybe('CHAIN REACTION! BARREL BLAST!');
    else if (targets === 1) this.announceMaybe('BARREL BLAST!');
    this.ui.updateScore(this.score.score);
    if (depth < 3) {
      for (const s of this.levelManager.shootables) {
        if (!s.active || s === exclude || s.type !== 'barrel') continue;
        const p = s.group.position;
        if (Math.hypot(p.x - pos.x, p.z - pos.z) <= 8) s.onShot(this, p.clone().setY(1), depth + 1);
      }
    }
  }

  _aliveHerdCount() {
    let n = 0;
    for (const b of this.enemyManager.buffalos) if (b.alive && b.variant !== 'boss') n++;
    return n;
  }

  _updateFocus(rawDt) {
    const f = this.focus;
    if (f.active) {
      f.timer -= rawDt; // real seconds, so slow-mo doesn't stretch the effect
      if (f.timer <= 0 || this._aliveHerdCount() === 0) this._endFocus();
      return;
    }
    if (this.state !== 'playing') return;
    const lm = this.levelManager;
    if (lm.bossActive || lm.bossEnding || lm.frozen > 0 || lm.rail.finished) return;
    if (this.time - f.lastAt < 10) return; // cooldown between triggers
    if (this._aliveHerdCount() === 1) {
      f.active = true;
      f.timer = 3.5;
      this.timeScale = 0.34;
      this.ui.setFocus(true);
      this.audio.focus();
      this.showBigText('LAST OF THE HERD', 1.4);
    }
  }

  _endFocus() {
    const f = this.focus;
    if (!f.active) return;
    f.active = false;
    this.timeScale = 1;
    f.lastAt = this.time;
    this.ui.setFocus(false);
  }

  onBuffaloCharge() {
    this.announce('LOOK OUT!');
  }

  onMiss() {
    if (this.buildFlags.luckyMiss && Math.random() < 0.35) return; // LUCKY TIE keeps the streak
    this.score.breakCombo();
    this.ui.showCombo();
  }

  // A round that pierces into a second buffalo pays OVERMATCH / HERD MARK.
  onRoundPierce(buffalo) {
    const pay = this.buildFlags.pierceScore;
    if (pay <= 0) return;
    const bonus = Math.round(pay * this.score.bonusMul);
    this.score.addFlat(bonus);
    this.ui.updateScore(this.score.score);
    const sp = this._projectToScreen(buffalo.group.position.clone().setY(1.6));
    this.ui.spawnDamageFloat(sp.x, sp.y, bonus, { pierce: true });
  }

  onCivilianShot(npc) {
    this.score.addFlat(-CONFIG.scoring.civilianPenalty);
    this.score.breakCombo();
    this.audio.civilian();
    this.announce('CIVILIAN!');
    this.ui.flashDamage();
    this.ui.updateScore(this.score.score);
  }

  onBossPhase(boss, p) {
    const texts = {
      2: 'IT WANTS A CHARGE.',
      3: 'IT MOVES BETWEEN COVER.',
      4: 'THE HERD ANSWERS THE CALL.'
    };
    if (texts[p]) this.showBigText(texts[p], 1.8);
    this.audio.warning();
  }

  onBossObstacleHit() {
    this.announce('CHARGED INTO THE OBSTACLE!');
  }

  onBossDefeated() {
    this.levelManager.onBossDefeated();
  }

  // ---------------- Main loop ----------------
  start() {
    const loop = (t) => {
      requestAnimationFrame(loop);
      this.tick(t);
    };
    requestAnimationFrame(loop);
  }

  tick(t) {
    if (this._dead) return;
    const dt = Math.min(0.05, Math.max(0, (t - this._lastT) / 1000));
    this._lastT = t;
    // Bullet time: the world runs on sdt, the trigger keeps real dt.
    this._updateFocus(dt);
    const sdt = dt * this.timeScale;
    this.time += sdt;

    this.checkPause();

    if (this.state === 'playing') {
      // Rail forward for spawn math.
      const rail = this.levelManager.rail;
      if (rail && !this.levelManager.bossActive) {
        rail.tangentAt(rail.progress, this.railFwd);
      }

      this.levelManager.update(sdt, this.time);
      if (this._announcePending && this.time - this._announceLast >= 1.6) {
        this.announceForce(this._announcePending);
      }
      if (this.player.alive && this.levelManager.frozen <= 0) this.player.update(dt);

      // Camera follows the rail (or holds during boss).
      if (!this.levelManager.bossActive && rail) {
        const pos = rail.sampleAt(rail.progress, new THREE.Vector3());
        const look = rail.sampleAt(Math.min(1, rail.progress + 0.02), new THREE.Vector3());
        this.cameraCtrl.update(sdt, pos, look);
      } else if (this.levelManager.bossActive) {
        // Gentle idle sway at the end of the rail, looking at the boss's CHEST:
        // he is tall, and aiming at his feet would put his horns off-screen.
        const pos = rail.sampleAt(1, new THREE.Vector3());
        const boss = this.levelManager.boss;
        const look = boss
          ? boss.chestPos(new THREE.Vector3())
          : rail.sampleAt(1, new THREE.Vector3());
        look.x += Math.sin(this.time * 0.5) * 0.4;
        look.z += Math.cos(this.time * 0.4) * 0.2;
        this.cameraCtrl.update(sdt, pos, look);
      }

      // Particles always update (so muzzle flashes die).
      this.particles.update(sdt, this.camera);

      // Crosshair + targeting.
      this._updateCrosshair();
    } else if (this.state === 'paused') {
      // Frozen frame; keep rendering only.
    }

    // Render every state so menus sit over a live (or last) scene.
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  _updateCrosshair() {
    const sens = this.options.sensitivity;
    const ndc = new THREE.Vector2(
      Math.max(-1.5, Math.min(1.5, this.input.ndc.x * sens)),
      Math.max(-1.5, Math.min(1.5, this.input.ndc.y * sens)));
    const rc = new THREE.Raycaster();
    rc.setFromCamera(ndc, this.camera);
    rc.far = 220;
    const targets = [];
    for (const b of this.enemyManager.buffalos) if (!b.dead) targets.push(b.group);
    for (const s of this.levelManager.shootables) if (s.active) targets.push(s.group);
    const hits = rc.intersectObjects(targets, true);
    let targeting = false;
    if (hits.length > 0 && !coverBlocks(rc.ray, this.levelManager.blockers, hits[0].distance)) {
      // Only valid targets (buffalo/npc/shootable), not the world — and not
      // one hiding behind a building, which is what the crosshair is for.
      targeting = true;
    }
    const w = this.player.weapon;
    this.ui.updateCrosshair(this.input.mouse.x, this.input.mouse.y, targeting, w ? w.aimBloom : 0);
  }

  // Pause via ESC/P (edge from input).
  checkPause() {
    if (this.input.pausePressed) {
      if (this.state === 'playing') this.pauseGame();
      else if (this.state === 'paused') this.resumeGame();
    }
  }
}
