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
import { UPGRADES, UPGRADE_IDS } from '../systems/upgrades.js';
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
    // Bullet time ("Last of the Herd"): slowed world while the trigger stays real-speed.
    this.timeScale = 1;
    this.focus = { active: false, timer: 0, lastAt: -999 };

    // Persistence + options.
    this.save = new SaveManager();
    this.options = { ...this.save.options };
    this.score = new ScoreManager();
    this.upgradePool = [...UPGRADE_IDS]; // remaining picks for this run
    this._lastUpgrade = null;

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
    this.upgradePool = [...UPGRADE_IDS];
    this._lastUpgrade = null;
    this.ui.rebuildAmmoDots(this.player.weapon.magSize);
  }

  _rollUpgrades() {
    const ids = [...this.upgradePool];
    for (let i = ids.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids.slice(0, 3).map((id) => UPGRADES.find((u) => u.id === id));
  }

  pickUpgrade(id) {
    if (this.state !== 'upgrades') return;
    const def = UPGRADES.find((u) => u.id === id);
    if (!def || !this.upgradePool.includes(id)) return;
    def.apply(this);
    this._lastUpgrade = id;
    this.upgradePool.splice(this.upgradePool.indexOf(id), 1);
    if (id === 'magsize') this.ui.rebuildAmmoDots(this.player.weapon.magSize);
    this.audio.uiSelect();
    if (this._pickIsLoadout) {
      // Loadout picked: roll to the briefing for mission one.
      this._pickIsLoadout = false;
      this.startLevel(this._pendingLevel || 0);
    } else {
      // Advance to the next mission with the new stat in hand.
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
    if (this.time - this._announceLast < 2.2) return;
    this.announceForce(text);
  }

  // Unthrottled: for moments that must not be skipped.
  announceForce(text) {
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
    let dmg = w.damage + (isHead ? w.headshotBonus : 0);
    let crit = false;
    if (w.critChance > 0 && Math.random() < w.critChance) { dmg *= 2; crit = true; this.audio.crit(); }
    buffalo.damage(dmg, isHead);
    // Damage number floating up from the exact hit point.
    if (hitPoint) {
      const sp = this._projectToScreen(hitPoint);
      this.ui.spawnDamageFloat(sp.x, sp.y, Math.round(buffalo.dealt), { crit, head: isHead });
    }
    const mult = this.score.multiplier;
    if (mult > prevMult && mult >= 3) this.showBigText(`COMBO x${mult} — TOLEDO APPROVES`, 0.8);
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
    this.score.breakCombo();
    this.ui.showCombo();
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
      if (this.player.alive && this.levelManager.frozen <= 0) this.player.update(dt);

      // Camera follows the rail (or holds during boss).
      if (!this.levelManager.bossActive && rail) {
        const pos = rail.sampleAt(rail.progress, new THREE.Vector3());
        const look = rail.sampleAt(Math.min(1, rail.progress + 0.02), new THREE.Vector3());
        this.cameraCtrl.update(sdt, pos, look);
      } else if (this.levelManager.bossActive) {
        // Gentle idle sway at the end of the rail, looking at the boss.
        const pos = rail.sampleAt(1, new THREE.Vector3());
        const look = this.levelManager.boss
          ? this.levelManager.boss.group.position.clone()
          : rail.sampleAt(1, new THREE.Vector3());
        look.x += Math.sin(this.time * 0.5) * 0.4;
        look.z += Math.cos(this.time * 0.4) * 0.2;
        this.cameraCtrl.update(sdt, pos, look);
      }

      // Particles always update (so muzzle flashes die).
      this.particles.update(sdt);

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
    if (hits.length > 0) {
      // Only valid targets (buffalo/npc/shootable), not the world.
      targeting = true;
    }
    this.ui.updateCrosshair(this.input.mouse.x, this.input.mouse.y, targeting);
  }

  // Pause via ESC/P (edge from input).
  checkPause() {
    if (this.input.pausePressed) {
      if (this.state === 'playing') this.pauseGame();
      else if (this.state === 'paused') this.resumeGame();
    }
  }
}
