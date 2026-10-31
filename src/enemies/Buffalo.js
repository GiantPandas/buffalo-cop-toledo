import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { buildBuffalo } from '../world/buffaloModel.js';
import { Rng } from '../utils/rng.js';
import { clamp, damp } from '../utils/mathx.js';

// Arcade buffalo: procedural model + state machine AI.
export class Buffalo {
  constructor(variant, position, game) {
    this.variant = variant;
    this.game = game;
    this.rng = new Rng((Math.random() * 1e9) | 0);

    const def = CONFIG.buffalos[variant] || CONFIG.buffalos.normal;
    this.maxHp = def.hp;
    this.hp = this.maxHp;
    this.baseSpeed = def.speed;
    this.scaleMul = this.rng.range(def.scale[0], def.scale[1]);

    const built = buildBuffalo(this.rng, variant);
    this.group = built.group;
    this.parts = built.parts;
    this.mats = built.mats;
    this.group.scale.setScalar(this.scaleMul);
    this.group.position.copy(position);
    // Face roughly toward the rail/camera on spawn.
    const camPos = game.camera.position;
    this.group.rotation.y = Math.atan2(camPos.x - position.x, camPos.z - position.z);

    // Tag meshes for hit detection.
    this.headMeshes = new Set();
    this.group.traverse((o) => {
      if (o.isMesh) {
        o.userData.owner = this;
        let p = o.parent;
        while (p && p !== this.group) {
          if (p === this.parts.head) { this.headMeshes.add(o); break; }
          p = p.parent;
        }
      }
    });

    this.state = 'idle';
    this.stateTimer = 0;
    this.spawnTime = game.time;
    this.flashTimer = 0;
    this.painTimer = 0;       // one-shot flinch, refreshed on every hit
    this.attackCooldown = this.rng.range(1.5, 4);
    this.walkPhase = this.rng.range(0, Math.PI * 2);
    this.headPhase = this.rng.range(0, Math.PI * 2);
    this.chargeTarget = new THREE.Vector3();
    this.chargeDir = new THREE.Vector3();
    this.dustTimer = 0;
    this.hoofTimer = 0;
    this.despawnAt = 0;      // >0: remove after this game time (panicked runners)
    this.dead = false;
    this.removeAt = 0;       // when death anim finishes

    // Variant-specific init.
    if (variant === 'panicked') {
      this.state = 'run';
      // Run across the road, perpendicular to travel direction.
      const rail = game.levelManager && game.levelManager.rail;
      const right = rail ? rail.rightVector(new THREE.Vector3()) : new THREE.Vector3(1, 0, 0);
      this.chargeDir.copy(right).multiplyScalar(this.rng.sign());
      this.baseSpeed = CONFIG.buffalos.panicked.speed * (0.9 + this.rng.next() * 0.3);
    } else if (variant === 'bandit') {
      // Donut thief: sprints across the road with the goods.
      this.state = 'run';
      const rail = game.levelManager && game.levelManager.rail;
      const right = rail ? rail.rightVector(new THREE.Vector3()) : new THREE.Vector3(1, 0, 0);
      this.chargeDir.copy(right).multiplyScalar(this.rng.sign());
      this.baseSpeed = CONFIG.buffalos.bandit.speed * (0.85 + this.rng.next() * 0.25);
    } else if (variant === 'angry') {
      this.attackCooldown = this.rng.range(0.8, 2.5);
    }

    game.scene.add(this.group);
  }

  get alive() { return !this.dead; }

  // World-space point at chest height (for effects / AI).
  chestPos(out) {
    return out.setFromMatrixPosition(this.group.matrixWorld).add(
      new THREE.Vector3(0, 1.4 * this.scaleMul, 0));
  }

  distanceToCamera() {
    const p = this.chestPos(new THREE.Vector3());
    return p.distanceTo(this.game.camera.position);
  }

  damage(n, isHead) {
    if (this.dead) return 'dead';
    this.dealt = n; // last hit's damage, for the floating number
    this.hp -= n;
    this.flashTimer = 0.18;
    this.painTimer = 0.32;      // punchy flinch on every hit, even mid-charge
    this.stateTimer = Math.max(this.stateTimer, 0);
    if (this.hp <= 0) {
      this.die();
      return 'dead';
    }
    // Hit reaction: brief stagger unless mid-charge (charges are interrupted by enough hits).
    if (this.state === 'idle' || this.state === 'walk') {
      this.state = 'stagger';
      this.stateTimer = 0.35;
    } else if (this.state === 'telegraph') {
      this.state = 'stagger';
      this.stateTimer = 0.4;
    }
    return 'hit';
  }

  die() {
    this.dead = true;
    this.state = 'dead';
    this.stateTimer = 0;
    this.painTimer = 0;
    this.group.scale.setScalar(this.scaleMul); // drop any in-flight flinch squash
    this.removeAt = this.game.time + 1.5;
    const p = this.chestPos(new THREE.Vector3());
    this.game.particles.spawnBurst(p, {
      count: 16, colors: [0xc9b28a, 0x8a7355, 0xe8dcc0],
      size: [0.4, 0.9], speed: [2, 5], life: [0.5, 1.0], gravity: 2, grow: 1.4
    });
    this.game.audio.kill();
    this.game.onBuffaloKilled(this);
  }

  update(dt, time) {
    if (this.dead) {
      // Fall over + sink, then mark for removal.
      this.stateTimer += dt;
      const t = clamp(this.stateTimer / 0.45, 0, 1);
      this.group.rotation.x = -t * Math.PI / 2 * (this.rng.sign() || 1) * 0.9;
      this.group.position.y = -t * t * 0.35;
      if (time >= this.removeAt) this._gone = true;
      return;
    }

    // Flash decay.
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      const f = Math.max(0, this.flashTimer / 0.18);
      this.mats.fur.emissive.setRGB(f * 0.9, f * 0.9, f * 0.75);
    } else {
      this.mats.fur.emissive.setRGB(0, 0, 0);
    }
    if (this.painTimer > 0) this.painTimer = Math.max(0, this.painTimer - dt);

    const camPos = this.game.camera.position;
    const dist = this.distanceToCamera();
    this.stateTimer += dt;

    switch (this.state) {
      case 'idle': this._updateIdle(dt, time, camPos, dist); break;
      case 'walk': this._updateWalk(dt, time, camPos, dist); break;
      case 'telegraph': this._updateTelegraph(dt, camPos); break;
      case 'charge': this._updateCharge(dt, camPos); break;
      case 'run': this._updateRun(dt); break;
      case 'stagger':
        if (this.stateTimer > 0.35) { this.state = 'idle'; this.stateTimer = 0; }
        break;
    }

    this._animate(dt, time);
  }

  _faceToward(pos, dt, strength = 4) {
    const dx = pos.x - this.group.position.x;
    const dz = pos.z - this.group.position.z;
    const target = Math.atan2(dx, dz);
    let diff = target - this.group.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.group.rotation.y += diff * clamp(strength * dt, 0, 1);
  }

  _updateIdle(dt, time, camPos, dist) {
    // Slowly face the player when close.
    if (dist < 16) this._faceToward(camPos, dt, 2.5);

    // Aggressive variants: start a charge when in range and off cooldown.
    if ((this.variant === 'angry' || this.variant === 'security') && dist < 17) {
      this.attackCooldown -= dt;
      if (this.attackCooldown <= 0) {
        this.state = 'telegraph';
        this.stateTimer = 0;
        this.chargeTarget.copy(camPos);
        this.game.audio.grunt(1);
        this.game.announceMaybe('LOOK OUT!');
      }
    } else if (this.variant === 'normal' || this.variant === 'fair') {
      // Occasionally wander a little.
      if (this.stateTimer > 2.5 && this.rng.chance(dt * 0.4)) {
        this.state = 'walk';
        this.stateTimer = 0;
        const a = this.rng.range(0, Math.PI * 2);
        this.chargeDir.set(Math.sin(a), 0, Math.cos(a));
      }
    }
  }

  _updateWalk(dt, time, camPos, dist) {
    if (this.stateTimer > 1.6 || (dist < 4 && this.variant !== 'angry')) {
      this.state = 'idle';
      this.stateTimer = 0;
      return;
    }
    const sp = this.baseSpeed * dt;
    this.group.position.addScaledVector(this.chargeDir, sp);
    this._faceToward(this.group.position.clone().add(this.chargeDir), dt, 8);
  }

  _updateTelegraph(dt, camPos) {
    // Shake in place, warning growl.
    const telegraphTime = (this.variant === 'security' ? 1.0 : 0.85) * this.game.difficulty.telegraph;
    if (this.stateTimer > telegraphTime) {
      this.state = 'charge';
      this.stateTimer = 0;
      // Lock target to where the camera is NOW.
      this.chargeTarget.copy(camPos);
      const d = new THREE.Vector3().subVectors(this.chargeTarget, this.group.position);
      d.y = 0;
      if (d.lengthSq() < 0.01) d.set(0, 0, -1);
      this.chargeDir.copy(d.normalize());
      this.game.audio.chargeRoar();
      this.game.onBuffaloCharge(this);
    }
  }

  _updateCharge(dt, camPos) {
    const speed = 9.5 * this.game.difficulty.chargeSpeed;
    this.group.position.addScaledVector(this.chargeDir, speed * dt);
    this._faceToward(this.group.position.clone().add(this.chargeDir), dt, 10);

    // Dust + hooves while charging.
    this.dustTimer -= dt;
    if (this.dustTimer <= 0) {
      this.dustTimer = 0.22;
      const p = this.group.position.clone(); p.y = 0.3;
      this.game.particles.spawnBurst(p, {
        count: 5, colors: [0xb8a67e, 0x9c8a64], size: [0.3, 0.7],
        speed: [1, 2.5], life: [0.4, 0.8], gravity: -0.5, grow: 1.6
      });
    }
    this.hoofTimer -= dt;
    if (this.hoofTimer <= 0) {
      this.hoofTimer = 0.32;
      this.game.audio.hooves();
    }

    // Reached the player?
    const dx = camPos.x - this.group.position.x;
    const dz = camPos.z - this.group.position.z;
    if (Math.hypot(dx, dz) < 3.2 || this.stateTimer > 4.5) {
      if (Math.hypot(dx, dz) < 3.6) {
        this.game.player.takeDamage(15 * this.game.difficulty.damageTaken);
        this.game.cameraCtrl.addShake(0.9);
      }
      this.state = 'idle';
      this.stateTimer = 0;
      this.attackCooldown = this.rng.range(3, 6) * this.game.difficulty.telegraph;
    }
  }

  _updateRun(dt) {
    // Panicked: sprint across the road, then despawn.
    const sp = this.baseSpeed * dt;
    this.group.position.addScaledVector(this.chargeDir, sp);
    this._faceToward(this.group.position.clone().add(this.chargeDir), dt, 10);
    this.dustTimer -= dt;
    if (this.dustTimer <= 0) {
      this.dustTimer = 0.28;
      const p = this.group.position.clone(); p.y = 0.3;
      this.game.particles.spawnBurst(p, {
        count: 4, colors: [0xb8a67e], size: [0.25, 0.55],
        speed: [1, 2], life: [0.3, 0.6], gravity: -0.5, grow: 1.2
      });
    }
    if (this.group.position.distanceTo(this.game.camera.position) > 34) {
      if (this.variant === 'bandit' && !this._escapeLogged) {
        this._escapeLogged = true;
        this.game.onBanditEscaped(this);
      }
      this._gone = true;
    }
  }

  // ---------- Procedural animation ----------
  _animate(dt, time) {
    const t = time + this.walkPhase;
    const P = this.parts;
    const speedMul = this.state === 'charge' || this.state === 'run' ? 6 : (this.state === 'walk' ? 3.2 : 1);
    const pain = clamp(this.painTimer / 0.32, 0, 1); // 1 right after a hit -> 0 as it settles

    if (this.dead) return; // frozen in fall pose

    // Legs: diagonal gait + a scramble kick when struck.
    const gait = this.state === 'charge' || this.state === 'run' ? 0.75 : (this.state === 'walk' ? 0.45 : 0.06);
    const swing = Math.sin(t * speedMul * 2.2) * gait + Math.sin(pain * Math.PI) * 0.5;
    P.legFL.rotation.x = swing;
    P.legBR.rotation.x = swing;
    P.legFR.rotation.x = -swing;
    P.legBL.rotation.x = -swing;

    // Body bob + a little hop on impact.
    const bobAmp = this.state === 'charge' || this.state === 'run' ? 0.12 : 0.035;
    this.group.position.y = (this.dead ? this.group.position.y : 0) + Math.sin(t * speedMul * 4.4) * bobAmp + Math.sin(pain * Math.PI) * 0.18;

    // Head: idle look-around, or track the player when close.
    if (this.state === 'telegraph') {
      P.head.rotation.x = -0.34 + Math.sin(time * 42) * 0.12; // lowered, aggressive shake
    } else if (this.state === 'stagger') {
      P.head.rotation.x = 0.3;
      P.head.rotation.y = Math.sin(this.stateTimer * 20) * 0.4; // dazed head wobble
    } else {
      const dist = this.distanceToCamera();
      if (dist < 12 && this.state !== 'charge' && this.state !== 'run') {
        // Look at player: compute relative yaw.
        const camPos = this.game.camera.position;
        const worldYaw = Math.atan2(camPos.x - this.group.position.x, camPos.z - this.group.position.z);
        let rel = worldYaw - this.group.rotation.y;
        while (rel > Math.PI) rel -= Math.PI * 2;
        while (rel < -Math.PI) rel += Math.PI * 2;
        P.head.rotation.y = damp(P.head.rotation.y, clamp(rel, -0.9, 0.9), 6, dt);
      } else {
        P.head.rotation.y = Math.sin(t * 0.8 + this.headPhase) * 0.4;
      }
      P.head.rotation.x = Math.sin(t * 1.3) * 0.08 - (this.variant === 'angry' ? 0.12 : 0);
    }

    // Pain flinch: head snaps up/back and shakes as the hit lands.
    P.head.rotation.x += Math.sin(pain * Math.PI) * 0.55;
    P.head.rotation.y += Math.sin(pain * 14) * 0.25 * pain;

    // Tail wag (panicked on a hit).
    P.tail.rotation.x = Math.sin(t * 2.4 + this.headPhase) * 0.25 + Math.sin(pain * Math.PI) * 0.3;
    P.tail.rotation.z = Math.sin(t * 1.7) * 0.15;

    // Charge lean.
    const targetLean = (this.state === 'charge' || this.state === 'run') ? -0.18 : 0;
    this.group.rotation.x = damp(this.group.rotation.x, targetLean, 6, dt);

    // Impact squash: a quick whole-body flinch that settles back out.
    this.group.scale.setScalar(this.scaleMul * (1 - Math.sin(pain * Math.PI) * 0.12));
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    // Free GPU resources: geometries are per-instance, fur/shadow materials too.
    this.group.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
    this.mats.fur.dispose();
    if (this.mats.shadow) this.mats.shadow.dispose();
    this.game.scene.remove(this.group);
  }
}
