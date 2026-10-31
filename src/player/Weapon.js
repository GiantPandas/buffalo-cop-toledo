import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Original futuristic police sidearm (view model) + firing/reload logic.
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
    this.ammo = this.magSize;
    this.cooldown = 0;
    this.reloading = false;
    this.reloadTimer = 0;
    this.kick = 0;        // visual recoil offset
    this.raycaster = new THREE.Raycaster();

    // ---- Build the gun model: "TPD-9" Toledo PD issue sidearm ----
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2e3a4c, flatShading: true });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x141a24, flatShading: true });
    const steelMat = new THREE.MeshLambertMaterial({ color: 0x53637a, flatShading: true });
    const glowMat = new THREE.MeshLambertMaterial({ color: 0x39d7ff, emissive: 0x1a9fd4 });
    const badgeMat = new THREE.MeshLambertMaterial({ color: 0xd8b83e, emissive: 0x4a3a10, flatShading: true });
    this.statusMat = new THREE.MeshBasicMaterial({ color: 0x39d7ff });

    // Frame + top rail with grooves
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.055, 0.34), bodyMat);
    frame.position.set(0, 0.012, -0.03);
    g.add(frame);
    for (let i = 0; i < 5; i++) {
      const groove = new THREE.Mesh(new THREE.BoxGeometry(0.098, 0.014, 0.018), darkMat);
      groove.position.set(0, 0.046, -0.16 + i * 0.032);
      g.add(groove);
    }
    // Slide + serrations
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.062, 0.24), steelMat);
    slide.position.set(0, 0.062, -0.08);
    g.add(slide);
    for (let i = 0; i < 5; i++) {
      const serr = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.04, 0.012), darkMat);
      serr.position.set(0, 0.062, 0.0 + i * 0.024);
      g.add(serr);
    }
    // Barrel shroud + muzzle brake
    const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8), darkMat);
    shroud.rotation.x = Math.PI / 2;
    shroud.position.set(0, 0.02, -0.28);
    g.add(shroud);
    for (const [r, len, z] of [[0.045, 0.05, -0.36], [0.04, 0.03, -0.40]]) {
      const brake = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), steelMat);
      brake.rotation.x = Math.PI / 2;
      brake.position.set(0, 0.02, z);
      g.add(brake);
    }
    // Foregrip + animated pump block
    const fgrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.13, 0.09), darkMat);
    fgrip.position.set(0, -0.07, -0.22);
    fgrip.rotation.x = -0.3;
    g.add(fgrip);
    this.pump = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.055, 0.1), steelMat);
    this.pump.position.set(0, -0.035, -0.17);
    g.add(this.pump);
    // Trigger guard + trigger
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.011, 5, 10, Math.PI), darkMat);
    guard.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    guard.position.set(0, -0.05, -0.02);
    g.add(guard);
    const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.035, 0.012), steelMat);
    trigger.position.set(0, -0.045, -0.02);
    g.add(trigger);
    // Grip + panel
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.17, 0.11), darkMat);
    grip.position.set(0, -0.11, 0.1);
    grip.rotation.x = 0.3;
    g.add(grip);
    const gripPanel = new THREE.Mesh(new THREE.BoxGeometry(0.084, 0.09, 0.07), bodyMat);
    gripPanel.position.set(0, -0.1, 0.106);
    gripPanel.rotation.x = 0.3;
    g.add(gripPanel);
    // Magazine (animated during reload)
    this.mag = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.15, 0.09),
      new THREE.MeshLambertMaterial({ color: 0x202a3a, flatShading: true })
    );
    this.mag.position.set(0, -0.1, -0.05);
    this.mag.rotation.x = 0.06;
    g.add(this.mag);
    // Red-dot sight + rear sight
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.075), bodyMat);
    housing.position.set(0, 0.115, -0.14);
    g.add(housing);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.038, 0.004), new THREE.MeshBasicMaterial({ color: 0xff4040 }));
    lens.position.set(0, 0.115, -0.177);
    g.add(lens);
    const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.02), bodyMat);
    rearSight.position.set(0, 0.105, 0.04);
    g.add(rearSight);
    // Energy core + status strip + TPD badge
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.14), glowMat);
    core.position.set(0, -0.01, -0.1);
    g.add(core);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.098, 0.012, 0.14), this.statusMat);
    strip.position.set(0, -0.004, -0.06);
    g.add(strip);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.008), badgeMat);
    badge.position.set(0.049, 0.012, -0.05);
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
    this.flash.scale.setScalar(0.35);
    this.flash.position.set(0, 0.02, -0.44);
    g.add(this.flash);

    this.flashLight = new THREE.PointLight(0xffc860, 0, 9, 2);
    this.flashLight.position.set(0, 0.05, -0.45);
    g.add(this.flashLight);

    this._flashTimer = 0;
    this._pumpTimer = 0;
    this._tip = new THREE.Vector3();
  }

  get canFire() { return !this.reloading && this.ammo > 0 && this.cooldown <= 0; }

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
    this.ammo = this.magSize;
    this.cooldown = 0;
    this.reloading = false;
    this.reloadTimer = 0;
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
    this.cooldown = this.fireCooldown;
    this.kick = 1;
    this._flashTimer = 0.05;
    this._pumpTimer = 0.13;
    this.flashMat.opacity = 1;
    this.flashLight.intensity = 3.2;
    game.audio.shoot();
    game.cameraCtrl.addRecoil(this.recoil);
    game.score.shotFired();

    // Raycast from camera through the (sensitivity-scaled) aim point.
    const sens = game.options.sensitivity;
    const ndc = new THREE.Vector2(
      clampNdc(game.input.ndc.x * sens),
      clampNdc(game.input.ndc.y * sens));
    this.raycaster.setFromCamera(ndc, game.camera);

    const targets = [];
    for (const b of game.enemyManager.buffalos) if (b.alive && !b.dead) targets.push(b.group);
    for (const n of game.enemyManager.npcs) targets.push(n.group);
    for (const s of game.levelManager.shootables) if (s.active) targets.push(s.group);

    const hits = this.raycaster.intersectObjects(targets, true);
    let resolved = false;
    let pierceLeft = Math.max(0, this.pierce | 0);
    let lastOwner = null;
    for (const h of hits) {
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
      resolved = true;
      lastOwner = owner;
      if (pierceLeft > 0) { pierceLeft--; continue; } // Hollow Points: keep going.
      break;
    }
    if (!resolved) game.onMiss();
    return true;
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
    this.reloading = true;
    this.reloadTimer = this.reloadTime;
    this.game.audio.reloadStart();
  }

  update(dt) {
    const game = this.game;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.kick = Math.max(0, this.kick - dt * 7);

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
      const t = 1 - Math.max(0, this.reloadTimer) / this.reloadTime;
      // Dip the gun; mag drops out, fresh mag rises in.
      this.model.rotation.x = Math.sin(t * Math.PI) * 0.9;
      let dy = 0;
      if (t > 0.15 && t < 0.45) dy = -0.06 * Math.sin(((t - 0.15) / 0.3) * Math.PI);
      else if (t >= 0.45 && t < 0.8) dy = -0.12 * (1 - (t - 0.45) / 0.35);
      this.mag.position.y = -0.1 + dy;
      this.mag.rotation.z = dy !== 0 ? dy * 2.2 : 0;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        this.ammo = this.magSize;
        this.model.rotation.x = 0;
        this.mag.position.y = -0.1;
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

    // Pump cycles back on every shot.
    if (this._pumpTimer > 0) {
      const p = 1 - this._pumpTimer / 0.13;
      this.pump.position.z = -0.17 + 0.07 * Math.sin(p * Math.PI);
      this._pumpTimer -= dt;
    } else {
      this.pump.position.z = -0.17;
    }

    // Status strip: cyan ready, amber low ammo, red reloading/empty.
    this.statusMat.color.setHex(
      this.reloading || this.ammo === 0 ? 0xff3b3b : this.ammo <= 1 ? 0xffa13b : 0x39d7ff
    );

    game.ui.updateAmmo(this.ammo, this.reloading);
  }
}

function clampNdc(v) { return Math.max(-1.5, Math.min(1.5, v)); }
