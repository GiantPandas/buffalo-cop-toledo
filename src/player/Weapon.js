import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { nearestCover } from '../utils/cover.js';

// "UZ-TOLEDO" full-auto machine pistol (view model) + firing/reload logic.
// Holding the trigger sprays: each shot blooms the aim (crosshair opens),
// so sustained full-auto drifts off-target unless you let off and converge.
export class Weapon {
  constructor(camera, game) {
    this.game = game;
    // Instance stats (upgrades mutate these; base values come from CONFIG).
    this.magSize = CONFIG.weapon.magSize;
    this.fireCooldown = CONFIG.weapon.fireCooldown;
    this.reloadTime = CONFIG.weapon.reloadTime;
    this.recoil = CONFIG.weapon.recoil;
    this.damage = CONFIG.weapon.damage;
    this.critChance = 0;   // chance per shot to deal double damage
    this.pierce = 0;      // extra buffalo a bullet can pass through
    this.headshotBonus = 0;
    this.precisionMul = 0;  // MARKSMAN COURSE: fractional extra damage on head hits
    this.bloom = 0;         // 0..1 trigger-hold spread bloom
    this.spreadScale = 1;   // DOT SIGHT upgrade multiplies this down
    this.bloomGrowMul = 1;  // FULL THROTTLE sprays it wider, PARADE STOCK slower
    this.bloomDecayMul = 1; // MARKSMAN parts converge faster
    this.holdRamp = 0;      // TRIGGER FINGER upgrade: sustained-fire rate bonus
    this.heatRate = 0;      // TOLEDO HEAT: fire rate per combo tier above x1
    this.heatDamage = 0;    // TOLEDO HEAT: damage per combo tier above x1
    this.focusRate = 0;     // TIME CRIME: extra rate while bullet time is up
    this.lastShell = 0;     // LAST SHELL STANCE: last N rounds in the drum double
    this.tacticalReload = 0;// CASE CATCH: drum fraction that triggers a fast reload
    this.tacticalCut = 0;   // fraction of the reload time the tactical reload removes
    this._holdTime = 0;
    this._jitter = { x: 0, y: 0, tx: 0, ty: 0 }; // smooth aim wobble vector
    this.ammo = this.magSize;
    this.cooldown = 0;
    this.reloading = false;
    this.reloadTimer = 0;
    this._reloadDur = this.reloadTime; // actual duration of the current reload
    this.kick = 0;        // visual recoil offset
    this.raycaster = new THREE.Raycaster();

    // ---- Build the gun model: "UZ-TOLEDO" Toledo PD machine pistol ----
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2e3a4c, flatShading: true });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x141a24, flatShading: true });
    const steelMat = new THREE.MeshLambertMaterial({ color: 0x53637a, flatShading: true });
    const glowMat = new THREE.MeshLambertMaterial({ color: 0x39d7ff, emissive: 0x1a9fd4 });
    const badgeMat = new THREE.MeshLambertMaterial({ color: 0xd8b83e, emissive: 0x4a3a10, flatShading: true });
    this.statusMat = new THREE.MeshBasicMaterial({ color: 0x39d7ff });

    // Receiver + cooling grooves along the top.
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.085, 0.26), bodyMat);
    receiver.position.set(0, 0.03, -0.12);
    g.add(receiver);
    for (let i = 0; i < 6; i++) {
      const groove = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.012, 0.016), darkMat);
      groove.position.set(0, 0.076, -0.22 + i * 0.032);
      g.add(groove);
    }
    // Bolt housing extension (rear) + reciprocating bolt (animated on every shot).
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.072, 0.13), darkMat);
    housing.position.set(0, 0.03, 0.06);
    g.add(housing);
    const BOLT_Z = 0.015;
    this.bolt = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.042, 0.085), steelMat);
    this.bolt.position.set(0, 0.03, BOLT_Z);
    g.add(this.bolt);
    // Charging handle at the very back.
    const charger = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.016, 0.05), steelMat);
    charger.position.set(0, 0.074, 0.115);
    g.add(charger);
    // Barrel shroud + muzzle ring poking out of the receiver front.
    const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.16, 8), darkMat);
    shroud.rotation.x = Math.PI / 2;
    shroud.position.set(0, 0.03, -0.27);
    g.add(shroud);
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.035, 8), steelMat);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.03, -0.395);
    g.add(muzzle);
    // Front grip sleeve under the barrel.
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.085, 0.075), darkMat);
    sleeve.position.set(0, -0.045, -0.2);
    sleeve.rotation.x = -0.15;
    g.add(sleeve);
    // Trigger guard + trigger (in front of the grip, Uzi-style).
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.011, 5, 10, Math.PI), darkMat);
    guard.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    guard.position.set(0, -0.055, 0.015);
    g.add(guard);
    const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.035, 0.012), steelMat);
    trigger.position.set(0, -0.05, 0.015);
    g.add(trigger);
    // Grip (the magazine lives inside it) + panel.
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.15, 0.075), darkMat);
    grip.position.set(0, -0.105, 0.055);
    grip.rotation.x = 0.25;
    g.add(grip);
    const gripPanel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.055), bodyMat);
    gripPanel.position.set(0, -0.095, 0.062);
    gripPanel.rotation.x = 0.25;
    g.add(gripPanel);
    // Drum magazine (animated during reload).
    this.mag = new THREE.Mesh(
      new THREE.BoxGeometry(0.062, 0.14, 0.062),
      new THREE.MeshLambertMaterial({ color: 0x202a3a, flatShading: true })
    );
    this.mag.position.set(0, -0.19, 0.075);
    this.mag.rotation.x = 0.25;
    g.add(this.mag);
    // Sights: rear notch + front hood with a glowing red dot.
    const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.02), bodyMat);
    rearSight.position.set(0, 0.09, 0.02);
    g.add(rearSight);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.045, 0.028), bodyMat);
    hood.position.set(0, 0.095, -0.235);
    g.add(hood);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.006), new THREE.MeshBasicMaterial({ color: 0xff4040 }));
    lens.position.set(0, 0.095, -0.251);
    g.add(lens);
    // Police trim: energy core, cyan status strip along the receiver side, TPD badge.
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.028, 0.12), glowMat);
    core.position.set(0, -0.012, -0.1);
    g.add(core);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.012, 0.15), this.statusMat);
    strip.position.set(0, -0.012, -0.03);
    g.add(strip);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.008), badgeMat);
    badge.position.set(0.046, 0.035, 0.02);
    g.add(badge);

    this.model = g;
    this.model.position.set(0.3, -0.26, -0.55);
    this.model.rotation.z = 0.04;
    camera.add(this.model);

    // Muzzle flash: sprite + light at barrel tip.
    const flashCanvas = document.createElement('canvas');
    flashCanvas.width = flashCanvas.height = 64;
    const fx = flashCanvas.getContext('2d');
    const grad = fx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,220,1)');
    grad.addColorStop(0.35, 'rgba(255,190,60,0.8)');
    grad.addColorStop(1, 'rgba(255,120,20,0)');
    fx.fillStyle = grad;
    fx.fillRect(0, 0, 64, 64);
    this.flashMat = new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(flashCanvas), transparent: true, depthWrite: false, opacity: 0
    });
    this.flash = new THREE.Sprite(this.flashMat);
    this.flash.scale.setScalar(0.3);
    this.flash.position.set(0, 0.03, -0.44);
    g.add(this.flash);

    this.flashLight = new THREE.PointLight(0xffc860, 0, 9, 2);
    this.flashLight.position.set(0, 0.05, -0.45);
    g.add(this.flashLight);

    this._flashTimer = 0;
    this._boltTimer = 0;
    this._boltBaseZ = BOLT_Z;
    this._tip = new THREE.Vector3();

    // ---- Brass shell casings: pooled instances ejected from the port ----
    this._CASINGS = 42;
    this._casingMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.016, 0.014, 0.052, 6),
      new THREE.MeshLambertMaterial({ color: 0xd9a441, flatShading: true }),
      this._CASINGS
    );
    this._casingMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this._casingMesh.frustumCulled = false;
    this._casingDummy = new THREE.Object3D();
    this._casings = [];
    for (let i = 0; i < this._CASINGS; i++) {
      this._casings.push({
        active: false, parked: false, life: 0,
        pos: new THREE.Vector3(), vel: new THREE.Vector3(),
        rot: new THREE.Euler(), spin: new THREE.Vector3()
      });
    }
    game.scene.add(this._casingMesh);
    this._portLocal = new THREE.Vector3(0.05, 0.07, 0.05); // ejection port (right of bolt housing)
    this._sparkRay = new THREE.Raycaster();
    this._sparkPt = new THREE.Vector3();
    this._sparkDir = new THREE.Vector3();
  }

  get canFire() { return !this.reloading && this.ammo > 0 && this.cooldown <= 0; }

  // Current visual spread bloom (0..1), scaled by the DOT SIGHT upgrade.
  get aimBloom() { return Math.min(1, this.bloom * this.spreadScale); }

  // Upgrade hook kept for callers that nudge one stat directly.
  addStat(stat, delta) {
    this[stat] += delta;
    if (stat === 'magSize') this.ammo = Math.min(this.ammo + delta, this.magSize);
  }

  // Rate bonuses stack additively, then invert into a cooldown multiplier:
  // TRIGGER FINGER (sustained hold), TOLEDO HEAT (combo tiers), TIME CRIME
  // (bullet time). 30%/40%/90% of extra rate reads as one clean number here.
  _cooldownMul() {
    let boost = 0;
    if (this.holdRamp > 0) {
      const ramp = Math.min(1, Math.max(0, (this._holdTime - 0.45) / 1.1));
      boost += this.holdRamp * ramp;
    }
    if (this.heatRate > 0) boost += this.heatRate * (this.game.score.multiplier - 1);
    if (this.focusRate > 0 && this.game.focus.active) boost += this.focusRate;
    return boost > 0 ? 1 / (1 + boost) : 1;
  }

  // Damage this round would deal, before crit/precision. LAST SHELL STANCE
  // doubles the end of the drum, TOLEDO HEAT pays out on combo tiers.
  currentDamage() {
    let dmg = this.damage;
    if (this.lastShell > 0 && this.ammo <= this.lastShell) dmg *= 2;
    if (this.heatDamage > 0) dmg *= 1 + this.heatDamage * (this.game.score.multiplier - 1);
    return dmg;
  }

  // Restore base stats + a full mag (called on a fresh run).
  reset() {
    this.magSize = CONFIG.weapon.magSize;
    this.fireCooldown = CONFIG.weapon.fireCooldown;
    this.reloadTime = CONFIG.weapon.reloadTime;
    this.recoil = CONFIG.weapon.recoil;
    this.damage = CONFIG.weapon.damage;
    this.critChance = 0;
    this.pierce = 0;
    this.headshotBonus = 0;
    this.precisionMul = 0;
    this.bloom = 0;
    this.spreadScale = 1;
    this.bloomGrowMul = 1;
    this.bloomDecayMul = 1;
    this.holdRamp = 0;
    this.heatRate = 0;
    this.heatDamage = 0;
    this.focusRate = 0;
    this.lastShell = 0;
    this.tacticalReload = 0;
    this.tacticalCut = 0;
    this._holdTime = 0;
    this._jitter.x = this._jitter.y = this._jitter.tx = this._jitter.ty = 0;
    for (const c of this._casings) { c.active = false; c.parked = false; }
    this.ammo = this.magSize;
    this.cooldown = 0;
    this.reloading = false;
    this.reloadTimer = 0;
    this._reloadDur = this.reloadTime;
  }

  fire() {
    const game = this.game;
    if (this.reloading || this.cooldown > 0) return false;
    if (this.ammo <= 0) {
      game.audio.dryFire();
      game.ui.flashReloadPrompt();
      return false;
    }

    this.ammo--;
    // Rate bonuses can stack hard (ramp + combo heat + bullet time), so clamp
    // the effective cooldown: ~55 rounds/sec is the arcade ceiling.
    this.cooldown = Math.max(0.018, this.fireCooldown * this._cooldownMul());
    this.kick = 1;
    this.bloom = Math.min(1, this.bloom + CONFIG.weapon.bloomPerShot * this.bloomGrowMul);
    this._flashTimer = 0.05;
    this._boltTimer = 0.09;
    this.flashMat.opacity = 0.7 + Math.random() * 0.3;
    this.flash.scale.setScalar(0.26 + Math.random() * 0.1);
    this.flashLight.intensity = 2.4 + Math.random() * 1.4;
    game.audio.shoot();
    game.cameraCtrl.addRecoil(this.recoil);
    game.score.shotFired();
    this._ejectCasing();

    // Raycast from camera through the (sensitivity-scaled + bloomed) aim point.
    const sens = game.options.sensitivity;
    const spread = CONFIG.weapon.spreadMax * this.aimBloom;
    const ndc = new THREE.Vector2(
      clampNdc(game.input.ndc.x * sens + this._jitter.x * spread),
      clampNdc(game.input.ndc.y * sens + this._jitter.y * spread));
    this.raycaster.setFromCamera(ndc, game.camera);

    const targets = [];
    for (const b of game.enemyManager.buffalos) if (b.alive && !b.dead) targets.push(b.group);
    for (const n of game.enemyManager.npcs) targets.push(n.group);
    for (const s of game.levelManager.shootables) if (s.active) targets.push(s.group);

    const hits = this.raycaster.intersectObjects(targets, true);
    // Cover first: if a building/lot stands between the muzzle and the herd,
    // the round stops there and sparks on the wall. Intersections come back
    // near-to-far, so anything past the cover distance is behind the shield.
    const coverT = this._coverDistance();
    let resolved = false;
    let pierceLeft = Math.max(0, this.pierce | 0);
    let buffHits = 0;
    let lastOwner = null;
    for (const h of hits) {
      if (h.distance > coverT) break;
      let o = h.object;
      while (o && !o.userData.owner) o = o.parent;
      if (!o || !o.userData.owner) continue;
      const owner = o.userData.owner;
      if (owner === lastOwner) continue; // one hit per target per bullet
      // Civilians and props are solid: the bullet stops there.
      if (owner.isNPC) { owner.onShot(game); resolved = true; break; }
      if (owner.isShootable) { owner.onShot(game, h.point); resolved = true; break; }
      // Buffalo / boss. Head/horn/muzzle hits are precision kills.
      const isHead = !!(owner.headMeshes && this._headHit(hits, owner));
      game.onBuffaloHit(owner, isHead, h.point);
      if (buffHits++ > 0) game.onRoundPierce(owner); // OVERMATCH / HERD MARK pay per pierce
      resolved = true;
      lastOwner = owner;
      if (pierceLeft > 0) { pierceLeft--; continue; } // Hollow Points: keep going.
      break;
    }
    if (!resolved) {
      game.onMiss();
      this._sparkImpact();
    }
    return true;
  }

  // Brass casing pops out of the ejection port: right, up, tumbling. Lives in
  // world space so the moving rail leaves it behind — it flies off screen.
  _ejectCasing() {
    const game = this.game;
    let cs = null;
    for (const c of this._casings) if (!c.active) { cs = c; break; }
    if (!cs) return;
    cs.active = true;
    cs.parked = false;
    cs.life = 0;
    cs.pos.copy(this._portLocal);
    this.model.localToWorld(cs.pos);
    const q = game.camera.quaternion;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    cs.vel.copy(right).multiplyScalar(2.4 + Math.random() * 1.8)
      .addScaledVector(up, 1.3 + Math.random() * 1.1)
      .addScaledVector(fwd, 0.3 + Math.random() * 0.6);
    cs.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    cs.spin.set(
      (Math.random() - 0.5) * 26, (Math.random() - 0.5) * 26, (Math.random() - 0.5) * 26);
  }

  // How far away the nearest cover solid is along the current aim ray. Used to
  // stop a round on a building so the boss can genuinely duck behind one.
  _coverDistance() {
    return nearestCover(this.raycaster.ray, this.game.levelManager.blockers);
  }

  // Sparks where a missed bullet smacks into world geometry (asphalt, walls).
  _sparkImpact() {
    const game = this.game;
    const pm = game.particles;
    if (!pm || !game.levelManager.world) return;
    this._sparkRay.set(this.raycaster.ray.origin, this.raycaster.ray.direction);
    this._sparkRay.far = 90;
    const hits = this._sparkRay.intersectObject(game.levelManager.world.root, true);
    const p = this._sparkPt;
    if (hits.length > 0) {
      p.copy(hits[0].point);
      if (hits[0].normal) {
        p.addScaledVector(hits[0].normal, 0.16);
        this._sparkDir.copy(hits[0].normal);
      } else {
        this._sparkDir.copy(p).sub(game.camera.position).normalize();
      }
    } else {
      // No surface within reach: puff where the ground would be, else 50m out.
      const d = this.raycaster.ray.direction;
      const t = d.y < -0.02 ? Math.min(60, Math.max(4, -this.raycaster.ray.origin.y / d.y)) : 50;
      p.copy(this.raycaster.ray.origin).addScaledVector(d, t);
      this._sparkDir.set(0, 1, 0);
    }
    pm.spawnBurst(p, {
      count: 8, streak: true,
      colors: [0xffe08a, 0xffa53b, 0xfff7d0, 0xff7a2e],
      size: [0.1, 0.2], speed: [3.5, 7.5], life: [0.1, 0.26],
      gravity: 9, dir: this._sparkDir, dirStrength: 2.5, grow: 0, upBias: 0.6
    });
    pm.spawnBurst(p, {
      count: 3, colors: [0xfff2c0, 0xffb060],
      size: [0.14, 0.26], speed: [0.6, 1.6], life: [0.12, 0.24],
      gravity: 0.5, grow: 0.9
    });
  }

  _headHit(hits, owner) {
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.owner) o = o.parent;
      if (o && o.userData.owner === owner && owner.headMeshes.has(h.object)) return true;
    }
    return false;
  }

  reload() {
    if (this.reloading || this.ammo === this.magSize) return;
    // CASE CATCH: a mostly-full drum gets topped off with a quick tactical reload.
    const tactical = this.tacticalCut > 0 && this.ammo >= this.magSize * this.tacticalReload;
    this.reloading = true;
    this._reloadDur = this.reloadTime * (tactical ? 1 - this.tacticalCut : 1);
    this.reloadTimer = this._reloadDur;
    this.game.audio.reloadStart();
  }

  update(dt) {
    const game = this.game;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.kick = Math.max(0, this.kick - dt * 7);
    if (this.holdRamp > 0) {
      if (game.input.firing && !this.reloading) this._holdTime += dt;
      else this._holdTime = Math.max(0, this._holdTime - dt * 3);
    }

    // Convergence: bloom relaxes when you let off; the aim wobble drifts
    // smoothly so spraying walks the shots around instead of teleporting them.
    this.bloom = Math.max(0, this.bloom - dt * CONFIG.weapon.bloomDecay * this.bloomDecayMul);
    const j = this._jitter;
    if (Math.random() < dt * 10) {
      j.tx = Math.random() * 2 - 1;
      j.ty = Math.random() * 2 - 1;
    }
    const k = Math.min(1, dt * 9);
    j.x += (j.tx - j.x) * k;
    j.y += (j.ty - j.y) * k;

    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      if (this._flashTimer <= 0) {
        this.flashMat.opacity = 0;
        this.flashLight.intensity = 0;
      }
    }

    // Reload state machine.
    if (this.reloading) {
      this.reloadTimer -= dt;
      const t = 1 - Math.max(0, this.reloadTimer) / (this._reloadDur || this.reloadTime);
      // Dip the gun; drum mag drops out of the grip, fresh mag rises in.
      this.model.rotation.x = Math.sin(t * Math.PI) * 0.9;
      let dy = 0;
      if (t > 0.15 && t < 0.45) dy = -0.06 * Math.sin(((t - 0.15) / 0.3) * Math.PI);
      else if (t >= 0.45 && t < 0.8) dy = -0.12 * (1 - (t - 0.45) / 0.35);
      this.mag.position.y = -0.19 + dy;
      this.mag.rotation.z = dy !== 0 ? dy * 2.2 : 0;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        this.ammo = this.magSize;
        this.model.rotation.x = 0;
        this.mag.position.y = -0.19;
        this.mag.rotation.z = 0;
        game.audio.reloadEnd();
      }
    } else {
      // Idle sway + recoil kick.
      const t = game.time;
      this.model.position.x = 0.3 + Math.sin(t * 1.7) * 0.004;
      this.model.position.y = -0.26 + Math.cos(t * 2.3) * 0.004 - this.kick * 0.02;
      this.model.position.z = -0.55 + this.kick * 0.07;
      this.model.rotation.x = this.kick * 0.18;
    }

    // Bolt cycles back on every shot (continuous at full-auto rate).
    if (this._boltTimer > 0) {
      const p = 1 - this._boltTimer / 0.09;
      this.bolt.position.z = this._boltBaseZ + 0.055 * Math.sin(p * Math.PI);
      this._boltTimer -= dt;
    } else {
      this.bolt.position.z = this._boltBaseZ;
    }

    // Casings: fly out, tumble, bounce off the asphalt, die after 1.8s.
    {
      const cm = this._casingMesh;
      const dummy = this._casingDummy;
      let dirty = false;
      for (let i = 0; i < this._casings.length; i++) {
        const c = this._casings[i];
        if (!c.active) {
          if (c.parked) continue;
          dummy.position.set(0, -60, 0);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.setScalar(0.0001);
          dummy.updateMatrix();
          cm.setMatrixAt(i, dummy.matrix);
          c.parked = true;
          dirty = true;
          continue;
        }
        dirty = true;
        c.life += dt;
        c.vel.y -= 9.8 * dt;
        c.pos.addScaledVector(c.vel, dt);
        if (c.pos.y < 0.026) {
          c.pos.y = 0.026;
          if (c.vel.y < 0) {
            c.vel.y *= -0.32;
            c.vel.x *= 0.55; c.vel.z *= 0.55;
          }
          c.spin.multiplyScalar(0.55);
          if (Math.abs(c.vel.y) < 0.7) c.vel.y = 0;
        }
        c.rot.x += c.spin.x * dt; c.rot.y += c.spin.y * dt; c.rot.z += c.spin.z * dt;
        dummy.position.copy(c.pos);
        dummy.rotation.copy(c.rot);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        cm.setMatrixAt(i, dummy.matrix);
        if (c.life > 1.8) { c.active = false; c.parked = false; }
      }
      if (dirty) cm.instanceMatrix.needsUpdate = true;
    }

    // Status strip: cyan ready, amber low ammo, red reloading/empty. When
    // LAST SHELL STANCE is armed the last rounds glow hot — empty the gun.
    const hot = this.lastShell > 0 && this.ammo < this.lastShell;
    this.statusMat.color.setHex(
      this.reloading || this.ammo === 0 ? 0xff3b3b
      : hot ? 0xffd23e
      : this.ammo <= Math.ceil(this.magSize * 0.15) ? 0xffa13b : 0x39d7ff
    );

    game.ui.updateAmmo(this.ammo, this.reloading);
  }
}

function clampNdc(v) { return Math.max(-1.5, Math.min(1.5, v)); }
