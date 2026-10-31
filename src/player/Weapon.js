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

    // ---- Build the gun model ----
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2a3444, flatShading: true });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x161c26, flatShading: true });
    const glowMat = new THREE.MeshLambertMaterial({ color: 0x39d7ff, emissive: 0x1a9fd4 });

    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.075, 0.3), bodyMat);
    g.add(slide);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.16, 8), darkMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.015, -0.2);
    g.add(barrel);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.1), darkMat);
    grip.position.set(0, -0.1, 0.07);
    grip.rotation.x = 0.25;
    g.add(grip);
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.14), glowMat);
    core.position.set(0, -0.01, -0.08);
    g.add(core);
    const sightF = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.02), bodyMat);
    sightF.position.set(0, 0.055, -0.14);
    g.add(sightF);
    const sightR = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.02), bodyMat);
    sightR.position.set(0, 0.055, 0.12);
    g.add(sightR);

    this.model = g;
    this.model.position.set(0.3, -0.26, -0.55);
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
    this.flash.position.set(0, 0.015, -0.32);
    g.add(this.flash);

    this.flashLight = new THREE.PointLight(0xffc860, 0, 9, 2);
    this.flashLight.position.set(0, 0.05, -0.4);
    g.add(this.flashLight);

    this._flashTimer = 0;
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
      // Dip the gun down and back up.
      this.model.rotation.x = Math.sin(t * Math.PI) * 0.9;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        this.ammo = this.magSize;
        this.model.rotation.x = 0;
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

    game.ui.updateAmmo(this.ammo, this.reloading);
  }
}

function clampNdc(v) { return Math.max(-1.5, Math.min(1.5, v)); }
