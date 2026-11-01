import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Buffalo } from './Buffalo.js';
import { buildPowerMul } from '../systems/upgrades.js';
import { clamp } from '../utils/mathx.js';

const _tmp = new THREE.Vector3();

// THE BIGGEST BUFFALO IN TOLEDO — multi-phase boss.
//
// Framing: he is scaled to fit the boss camera and the fight camera looks at
// his chest, so horns and vulnerable orbs stay on screen (CONFIG.boss.scale).
// Movement: he is never a statue. Every phase runs a strafe/dodge beat that
// walks him lane to lane across the plaza and tucks his outer shoulder behind
// the lots flanking the arena — LevelManager.blockers — which really stop
// rounds, so the player has to shoot the half he is still showing.
export class BossBuffalo extends Buffalo {
  constructor(position, game) {
    super('boss', position, game);
    this.scaleMul = CONFIG.boss.scale;
    this.group.scale.setScalar(this.scaleMul);
    // HP rides the run's gun: an issue drum and a maxed-out parts build both
    // get roughly the same fight length.
    this.maxHp = Math.round(
      CONFIG.boss.hp * clamp(buildPowerMul(game.build), 1, CONFIG.boss.hpMaxMul));
    this.hp = this.maxHp;
    this.name = CONFIG.boss.name;

    this.phase = 1;
    this.homePos = position.clone();
    this.camHome = game.camera.position.clone();
    this.roadW = game.levelManager.levelData.world.roadWidth || 10;

    // Arena axes: depth runs camera -> boss, lateral runs across the plaza.
    const origin = this.camHome.clone(); origin.y = 0;
    const axis = new THREE.Vector3().subVectors(this.homePos, origin); axis.y = 0; axis.normalize();
    this.origin = origin;
    this.axis = axis;
    this.right = new THREE.Vector3(-axis.z, 0, axis.x);
    this.homeAlong = _tmp.subVectors(this.homePos, origin).dot(axis);

    this.slots = this._coverSlots();
    this.slotIndex = 0;
    this.slotPos = this.slots[0].pos.clone();
    this.dodgeTimer = 1.2;
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

  _lateral(v) { return _tmp.subVectors(v, this.origin).dot(this.right); }

  // Lane markers: the middle of the plaza plus one stand-behind spot for every
  // tall footprint in the arena. Slots stay inside the frame and keep his head
  // camera-side of the lot, so cover hides a shoulder and never the whole him.
  _coverSlots() {
    const boxes = (this.game.levelManager && this.game.levelManager.blockers) || [];
    const halfTan = Math.tan(this.game.camera.fov * Math.PI / 360);
    const aspect = this.game.camera.aspect;
    const out = [{ pos: this.homePos.clone().setY(0), cover: false }];
    for (const b of boxes) {
      _tmp.set((b.min.x + b.max.x) / 2 - this.origin.x, 0, (b.min.z + b.max.z) / 2 - this.origin.z);
      const along = _tmp.dot(this.axis);
      const lat = _tmp.dot(this.right);
      if (along < CONFIG.boss.minDist || along > this.homeAlong + 6) continue;
      if (Math.abs(lat) < this.roadW / 2 + 3) continue; // nothing to peek past
      // Stand a little toward the road so the lot clips off his far side only,
      // and never so wide he slides out of the screen.
      const wide = Math.min(along * halfTan * aspect * 0.6, this.roadW / 2 + 3);
      const off = clamp(Math.abs(lat) * 0.56, 1.5, wide);
      const pos = this.origin.clone()
        .addScaledVector(this.axis, this.homeAlong + 2)
        .addScaledVector(this.right, (lat < 0 ? -1 : 1) * off);
      pos.y = 0;
      out.push({ pos, cover: true });
    }
    // Left lane, centre, right lane: he has to cross the screen to change lanes.
    out.sort((a, b) => this._lateral(a.pos) - this._lateral(b.pos));
    return out;
  }

  _nextSlot() {
    if (this.slots.length < 2) return;
    const cur = this._lateral(this.group.position);
    let pick = (this.slotIndex + 1) % this.slots.length;
    for (let i = 1; i < this.slots.length; i++) {
      const i2 = (this.slotIndex + i) % this.slots.length;
      if (Math.sign(this._lateral(this.slots[i2].pos)) !== Math.sign(cur)) { pick = i2; break; }
    }
    const slot = this.slots[pick];
    this.slotIndex = pick;
    this.slotPos.copy(slot.pos);
    if (slot.cover) this.game.announceMaybe('HE IS HIDING!');
  }

  // Returns true while he is mid-strafe (the phase logic leaves the state to it).
  _updateDodge(dt, camPos) {
    const cfg = CONFIG.boss.dodge[this.phase] || CONFIG.boss.dodge[1];
    if (this.state === 'walk') {
      _tmp.subVectors(this.slotPos, this.group.position); _tmp.y = 0;
      const len = _tmp.length();
      if (len < 0.7) {
        this.state = 'idle';
        this.stateTimer = 0;
        this.dodgeTimer = cfg.interval * (0.75 + this.rng.next() * 0.5);
        return false;
      }
      this.chargeDir.copy(_tmp).divideScalar(len);
      this.group.position.addScaledVector(this.chargeDir, cfg.speed * dt);
      this._faceToward(camPos, dt, 4); // strafes sideways while still staring you down
      return true;
    }
    this.dodgeTimer -= dt;
    if (this.dodgeTimer > 0) return false;
    this.dodgeTimer = 0; // queued: he steps off as soon as he is idle again
    if (this.state !== 'idle') return false;
    this._nextSlot();
    this.state = 'walk';
    this.stateTimer = 0;
    return true;
  }

  // Charge bookkeeping the shared buffalo charge can't do on its own: obstacle
  // collisions, reaching the player, then falling back behind a lot.
  _updateBossCharge(hdist) {
    const obs = this.game.levelManager ? this.game.levelManager.obstacles : [];
    // Judge the barrels against the charge path, not his centre: he charges
    // from whichever lane he is in, and a barrel by the road still stops him.
    _tmp.copy(this.chargeTarget); _tmp.y = 0;
    const ax = this.group.position.x, az = this.group.position.z;
    const bx = _tmp.x - ax, bz = _tmp.z - az;
    const segLen2 = (bx * bx + bz * bz) || 1;
    const reach = 3.5 * this.scaleMul * 0.4;
    for (const o of obs) {
      if (!o.active) continue;
      const px = o.pos.x - ax, pz = o.pos.z - az;
      const s = clamp((px * bx + pz * bz) / segLen2, 0, 1);
      const d = Math.hypot(px - bx * s, pz - bz * s);
      if (d < reach) {
        o.active = false;
        this.hp -= this.maxHp * 0.05;
        this.stunTimer = 1.8;
        this.state = 'stagger';
        this.stateTimer = 0;
        this.game.audio.explosion();
        this.game.cameraCtrl.addShake(1.0);
        this.game.particles.spawnBurst(o.pos.clone().setY(1), {
          count: 24, colors: [0xc9b28a, 0xffd23e, 0xffffff],
          size: [0.6, 1.4], speed: [3, 7], life: [0.5, 1], gravity: 2, grow: 1.5
        });
        this.game.onBossObstacleHit(this);
        if (this.hp <= 0) { this._startDefeat(); return; }
        this._checkPhase();
        this.dodgeTimer = 0.3; // dazed, then straight behind a wall
        return;
      }
    }
    if (hdist <= CONFIG.boss.minDist + 1.5) {
      // He reaches the barricade line and you: shove, then back off to cover.
      const hit = CONFIG.boss.contactDamage + (this.phase === 4 ? 2 : 0);
      this.game.player.takeDamage(hit * this.game.difficulty.damageTaken);
      this.game.cameraCtrl.addShake(1.2);
      this.state = 'stagger';
      this.stateTimer = 0;
      this.attackCooldown = (this.phase === 4 ? 2.2 : 3.5) * this.game.difficulty.telegraph;
      this.dodgeTimer = 0.35;
    }
  }

  // Phase 4 flank friends: spawned between the boss and the camera, on asphalt.
  _updateMinions(dt) {
    this.minionTimer -= dt;
    if (this.minionTimer > 0) return;
    this.minionTimer = 7;
    const alive = this.game.enemyManager.buffalos.filter((b) => b.alive && !b.defeated).length;
    if (alive >= 4) return;
    const toCam = new THREE.Vector3().subVectors(this.camHome, this.group.position);
    toCam.y = 0; toCam.normalize();
    const flank = 1 + Math.random() * (this.roadW / 2 - 3);
    const pos = new THREE.Vector3(
      this.group.position.x + toCam.x * (4 + Math.random() * 6), 0,
      this.group.position.z + toCam.z * (4 + Math.random() * 6));
    pos.x += -toCam.z * (Math.random() < 0.5 ? -1 : 1) * flank;
    pos.z += toCam.x * (Math.random() < 0.5 ? -1 : 1) * flank;
    this.game.enemyManager.spawnBuffalo(Math.random() < 0.5 ? 'angry' : 'panicked', pos);
    this.game.announceMaybe('TOO MANY!');
  }

  // Keeps him on screen: never so close he fills the frame, never so far he
  // leaves it.
  _clampArena() {
    const p = this.group.position;
    const dx = p.x - this.camHome.x, dz = p.z - this.camHome.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.001) return;
    const want = clamp(d, CONFIG.boss.minDist, CONFIG.boss.maxDist);
    if (want === d) return;
    p.x = this.camHome.x + dx * (want / d);
    p.z = this.camHome.z + dz * (want / d);
  }

  _checkPhase() {
    const r = this.hpRatio;
    let p = 1;
    if (r <= 0.25) p = 4;
    else if (r <= 0.5) p = 3;
    else if (r <= 0.75) p = 2;
    if (p !== this.phase) {
      this.phase = p;
      this.game.onBossPhase(this, p);
      this.dodgeTimer = Math.min(this.dodgeTimer, 0.5); // changes lanes on the way out
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
    // Getting chewed on sends him sideways: never let the dodge beat idle out.
    if (this.state !== 'charge') this.dodgeTimer = Math.min(this.dodgeTimer, 0.3);
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

    this.stateTimer += dt;

    // Stun (from obstacle collision).
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      this.group.rotation.z = Math.sin(time * 30) * 0.04;
      if (this.stunTimer <= 0) {
        this.group.rotation.z = 0;
        this.state = 'idle';
        this.stateTimer = 0;
        this.dodgeTimer = 0.4;
      }
      this._animate(dt, time);
      return;
    }

    const camPos = this.game.camera.position;
    // Horizontal distance: chest height would make "he reached you" arrive late.
    const hdist = Math.hypot(this.group.position.x - camPos.x, this.group.position.z - camPos.z);

    // The dodge beat runs in every phase — he is never a statue.
    const dodging = this._updateDodge(dt, camPos);

    switch (this.phase) {
      case 1: // Blocks the road, faces player, sidesteps between your shots.
        if (!dodging) {
          this.state = 'idle';
          this._faceToward(camPos, dt, 3);
        }
        if (this.stateTimer > 4) { this.game.announceMaybe('BIG ONE!'); this.stateTimer = 0; }
        break;

      case 2: // Periodic charges; obstacles stop them, cover hides the rest.
        if (this.state === 'charge') this._updateBossCharge(hdist);
        else {
          // The countdown runs whether or not he is mid-strafe, so dodging
          // delays a charge instead of cancelling it.
          this.attackCooldown -= dt;
          if (this.state === 'idle' && this.attackCooldown <= 0) {
            this.state = 'telegraph';
            this.stateTimer = 0;
            this.chargeTarget.copy(camPos);
            this.game.audio.chargeRoar();
            this.game.announceMaybe('LOOK OUT!');
          }
        }
        break;

      case 3: // Works the lanes behind the lots, head kept exposed.
        if (!dodging) this._faceToward(camPos, dt, 4);
        break;

      case 4: // Frenzy: fast charges, quicker lanes, minions.
        if (this.state === 'charge') this._updateBossCharge(hdist);
        else {
          this.attackCooldown -= dt;
          if (this.state === 'idle' && this.attackCooldown <= 0) {
            this.state = 'telegraph';
            this.stateTimer = 0;
            this.chargeTarget.copy(camPos);
            this.game.audio.chargeRoar();
          }
        }
        this._updateMinions(dt);
        break;
    }

    // Telegraph/charge/stagger shared behavior (inherited).
    if (this.state === 'telegraph') this._updateTelegraph(dt, camPos);
    else if (this.state === 'charge') this._updateCharge(dt, camPos);
    else if (this.state === 'stagger' && this.stateTimer > 0.5) {
      this.state = 'idle'; this.stateTimer = 0;
    }

    this._clampArena();
    this._animate(dt, time);
    this.game.ui.setBossHp(this.hpRatio);
  }

  dispose() {
    super.dispose();
    this.orbs.forEach((o) => { o.geometry.dispose(); o.material.dispose(); });
  }
}
