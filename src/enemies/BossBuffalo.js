import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Buffalo } from './Buffalo.js';
import { clamp, damp } from '../utils/mathx.js';

// THE BIGGEST BUFFALO IN TOLEDO — multi-phase boss.
export class BossBuffalo extends Buffalo {
  constructor(position, game) {
    super('boss', position, game);
    this.maxHp = CONFIG.boss.hp;
    this.hp = this.maxHp;
    this.scaleMul = 5.2;
    this.group.scale.setScalar(this.scaleMul);
    this.name = CONFIG.boss.name;

    this.phase = 1;
    this.homePos = position.clone();
    this.camHome = game.camera.position.clone();
    // Cover points: to the boss's left/right, a bit toward the camera.
    {
      const toCam = new THREE.Vector3().subVectors(this.camHome, position);
      toCam.y = 0; toCam.normalize();
      const right = new THREE.Vector3(-toCam.z, 0, toCam.x);
      // Cover offsets stay on the asphalt (never in the building zone).
      const roadW = game.levelManager.levelData.world.roadWidth || 10;
      const coverOff = Math.min(7, roadW / 2 - 0.5);
      this.coverL = position.clone().addScaledVector(toCam, 4).addScaledVector(right, -coverOff);
      this.coverR = position.clone().addScaledVector(toCam, 4).addScaledVector(right, coverOff);
    }
    this.coverTarget = this.coverL;
    this.minionTimer = 0;
    this.stunTimer = 0;
    this.defeated = false;
    this.defeatTimer = 0;

    // Vulnerable spot markers (pulsing orbs on head + hump).
    const orbMat = new THREE.MeshBasicMaterial({ color: 0xff5a2a, transparent: true, opacity: 0.9 });
    this.orbL = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), orbMat);
    this.orbL.position.set(0.3, 2.45, 1.5);
    this.orbR = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), orbMat.clone());
    this.orbR.position.set(-0.3, 2.45, 1.5);
    this.orbHump = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), orbMat.clone());
    this.orbHump.position.set(0, 2.75, 0.42);
    this.group.add(this.orbL, this.orbR, this.orbHump);
    this.orbs = [this.orbL, this.orbR, this.orbHump];
    // Orbs are part of the boss for hit detection (vulnerable spot markers).
    for (const o of this.orbs) o.userData.owner = this;

    game.ui.showBossHp(this.name);
  }

  get hpRatio() { return clamp(this.hp / this.maxHp, 0, 1); }

  _checkPhase() {
    const r = this.hpRatio;
    let p = 1;
    if (r <= 0.25) p = 4;
    else if (r <= 0.5) p = 3;
    else if (r <= 0.75) p = 2;
    if (p !== this.phase) {
      this.phase = p;
      this.game.onBossPhase(this, p);
    }
  }

  damage(n, isHead) {
    if (this.dead || this.defeated) return 'dead';
    // Head/hump hits count double.
    const dmg = isHead ? n * 2 : n;
    this.dealt = dmg; // last hit's damage, for the floating number
    this.hp -= dmg;
    this.flashTimer = 0.15;
    this.painTimer = isHead ? 0.45 : 0.3; // big flinch, bigger on a head shot
    this.game.audio.bossHit();
    this.game.cameraCtrl.addShake(isHead ? 0.35 : 0.2);
    const p = this.chestPos(new THREE.Vector3());
    this.game.particles.spawnBurst(p, {
      count: 10, colors: isHead ? [0xffd23e, 0xffffff] : [0xc9b28a, 0x8a7355],
      size: [0.5, 1.1], speed: [3, 6], life: [0.4, 0.8], gravity: 3, grow: 1
    });
    if (this.hp <= 0) {
      this._startDefeat();
      return 'dead';
    }
    this._checkPhase();
    // Interrupt charge on a head shot.
    if (isHead && this.state === 'charge') {
      this.state = 'stagger';
      this.stateTimer = 0;
    }
    return 'hit';
  }

  _startDefeat() {
    this.defeated = true;
    this.dead = true;
    this.state = 'dead';
    this.stateTimer = 0;
    this.painTimer = 0;
    this.group.scale.setScalar(this.scaleMul); // drop any in-flight flinch squash
    this.removeAt = Infinity; // cinematic handles removal
    this.orbs.forEach((o) => o.visible = false);
    this.game.ui.hideBossHp();
    this.game.audio.explosion();
    this.game.cameraCtrl.addShake(1.4);
    this.game.onBossDefeated(this);
  }

  update(dt, time) {
    // Pulsing vulnerable orbs.
    const pulse = 0.7 + Math.sin(time * 6) * 0.3;
    for (const o of this.orbs) if (o.visible) o.material.opacity = pulse;

    if (this.defeated) {
      // Slow dramatic fall.
      this.defeatTimer += dt;
      const t = clamp(this.defeatTimer / 1.6, 0, 1);
      this.group.rotation.x = -t * Math.PI / 2 * 0.92;
      if (Math.random() < 0.3) {
        const p = this.group.position.clone(); p.y = 0.5 + Math.random() * 2;
        this.game.particles.spawnBurst(p, {
          count: 6, colors: [0xb8a67e, 0xe8dcc0], size: [0.8, 1.6],
          speed: [2, 5], life: [0.6, 1.2], gravity: -1, grow: 2
        });
      }
      return;
    }

    // Stun (from obstacle collision).
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      this.group.rotation.z = Math.sin(time * 30) * 0.04;
      if (this.stunTimer <= 0) { this.group.rotation.z = 0; this.state = 'idle'; this.stateTimer = 0; }
      this._animate(dt, time);
      return;
    }

    const camPos = this.game.camera.position;
    const dist = this.distanceToCamera();

    switch (this.phase) {
      case 1: // Blocks the road, faces player.
        this.state = 'idle';
        this._faceToward(camPos, dt, 3);
        if (this.stateTimer > 4) { this.game.announceMaybe('BIG ONE!'); this.stateTimer = 0; }
        break;

      case 2: // Periodic charges; obstacles stop them.
        if (this.state === 'idle') {
          this.attackCooldown -= dt;
          if (this.attackCooldown <= 0) {
            this.state = 'telegraph';
            this.stateTimer = 0;
            this.chargeTarget.copy(camPos);
            this.game.audio.chargeRoar();
            this.game.announceMaybe('LOOK OUT!');
          }
        } else if (this.state === 'charge') {
          // Obstacle collision check.
          const obs = this.game.levelManager ? this.game.levelManager.obstacles : [];
          for (const o of obs) {
            if (!o.active) continue;
            const d = Math.hypot(o.pos.x - this.group.position.x, o.pos.z - this.group.position.z);
            if (d < 3.5 * this.scaleMul * 0.4) {
              o.active = false;
              this.hp -= 2;
              this.stunTimer = 1.8;
              this.state = 'stagger';
              this.game.audio.explosion();
              this.game.cameraCtrl.addShake(1.0);
              this.game.particles.spawnBurst(o.pos.clone().setY(1), {
                count: 24, colors: [0xc9b28a, 0xffd23e, 0xffffff],
                size: [0.6, 1.4], speed: [3, 7], life: [0.5, 1], gravity: 2, grow: 1.5
              });
              this.game.onBossObstacleHit(this);
              if (this.hp <= 0) { this._startDefeat(); return; }
              this._checkPhase();
              break;
            }
          }
        } else if (this.state === 'idle' && dist < 8) {
          // Reached the player.
          this.game.player.takeDamage(20 * this.game.difficulty.damageTaken);
          this.game.cameraCtrl.addShake(1.2);
          this.state = 'stagger';
          this.stateTimer = 0;
          this.attackCooldown = 3.5 * this.game.difficulty.telegraph;
        }
        break;

      case 3: // Moves between cover, head exposed.
        if (this.state === 'idle' || this.state === 'stagger') {
          if (this.stateTimer > 1.8) {
            this.coverTarget = this.coverTarget === this.coverL ? this.coverR : this.coverL;
            this.state = 'walk';
            this.stateTimer = 0;
            const d = new THREE.Vector3().subVectors(this.coverTarget, this.group.position);
            d.y = 0;
            this.chargeDir.copy(d.normalize());
          }
        } else if (this.state === 'walk') {
          const sp = 4.5 * dt;
          this.group.position.addScaledVector(this.chargeDir, sp);
          this._faceToward(camPos, dt, 4);
          if (this.group.position.distanceTo(this.coverTarget) < 1.2) {
            this.state = 'idle';
            this.stateTimer = 0;
          }
        }
        break;

      case 4: // Frenzy: fast charges + minions.
        if (this.state === 'idle') {
          this.attackCooldown -= dt;
          if (this.attackCooldown <= 0) {
            this.state = 'telegraph';
            this.stateTimer = 0;
            this.chargeTarget.copy(camPos);
            this.game.audio.chargeRoar();
          }
        } else if (this.state === 'idle' && dist < 9) {
          this.game.player.takeDamage(22 * this.game.difficulty.damageTaken);
          this.game.cameraCtrl.addShake(1.3);
          this.state = 'stagger';
          this.stateTimer = 0;
          this.attackCooldown = 2.2 * this.game.difficulty.telegraph;
        }
        // Minion spawns on the flanks between boss and camera.
        this.minionTimer -= dt;
        if (this.minionTimer <= 0) {
          this.minionTimer = 7;
          const alive = this.game.enemyManager.buffalos.filter((b) => b.alive && !b.defeated).length;
          if (alive < 4) {
            const toCam = new THREE.Vector3().subVectors(this.camHome, this.group.position);
            toCam.y = 0; toCam.normalize();
            const side = Math.random() < 0.5 ? -1 : 1;
            // Flank offset kept on the asphalt so minions never spawn in buildings.
            const roadW = this.game.levelManager.levelData.world.roadWidth || 10;
            const flank = 1 + Math.random() * (roadW / 2 - 3);
            const pos = new THREE.Vector3(
              this.group.position.x + toCam.x * (4 + Math.random() * 6), 0,
              this.group.position.z + toCam.z * (4 + Math.random() * 6));
            pos.x += -toCam.z * side * flank;
            pos.z += toCam.x * side * flank;
            this.game.enemyManager.spawnBuffalo(Math.random() < 0.5 ? 'angry' : 'panicked', pos);
            this.game.announceMaybe('TOO MANY!');
          }
        }
        break;
    }

    // Telegraph/charge/stagger shared behavior (inherited).
    if (this.state === 'telegraph') this._updateTelegraph(dt, camPos);
    else if (this.state === 'charge') this._updateCharge(dt, camPos);
    else if (this.state === 'stagger' && this.stateTimer > 0.5) {
      this.state = 'idle'; this.stateTimer = 0;
    }

    this._animate(dt, time);
    this.game.ui.setBossHp(this.hpRatio);
  }

  dispose() {
    super.dispose();
    this.orbs.forEach((o) => { o.geometry.dispose(); o.material.dispose(); });
  }
}
