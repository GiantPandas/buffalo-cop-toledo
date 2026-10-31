import * as THREE from 'three';
import { Rng } from '../utils/rng.js';

// Simple procedural arcade NPC (officer, pedestrian, shop owner, fair worker, driver).
const KINDS = {
  cop:       { shirt: 0x1d3a6b, pants: 0x14263f, hat: true },
  shopper:   { shirt: 0xc25a3a, pants: 0x4a4a58, hat: false },
  pedestrian:{ shirt: 0x5a7a4a, pants: 0x3a3a44, hat: false },
  shopowner: { shirt: 0x8a6a2e, pants: 0x2e2e38, hat: false },
  fairworker:{ shirt: 0xb03a7a, pants: 0x3a2e4a, hat: true },
  driver:    { shirt: 0x4a5a6a, pants: 0x2a2a30, hat: false }
};

export class NPC {
  constructor(kind, position, game) {
    this.kind = kind;
    this.isNPC = true;
    this.game = game;
    this.rng = new Rng((Math.random() * 1e9) | 0);
    const def = KINDS[kind] || KINDS.pedestrian;

    const skin = new THREE.MeshLambertMaterial({ color: 0xd9a06b, flatShading: true });
    const shirt = new THREE.MeshLambertMaterial({ color: def.shirt, flatShading: true });
    const pants = new THREE.MeshLambertMaterial({ color: def.pants, flatShading: true });
    this.mats = [skin, shirt, pants];

    this.group = new THREE.Group();
    const P = {};

    // Legs
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.75, 0.18), pants);
      leg.position.set(side * 0.12, 0.38, 0);
      this.group.add(leg);
      if (side < 0) P.legL = leg; else P.legR = leg;
    }
    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.3), shirt);
    torso.position.y = 1.06;
    this.group.add(torso);
    P.torso = torso;
    // Arms
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.58, 0.15), shirt);
      arm.position.set(side * 0.34, 1.08, 0);
      this.group.add(arm);
      if (side < 0) P.armL = arm; else P.armR = arm;
    }
    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.3), skin);
    head.position.y = 1.58;
    this.group.add(head);
    P.head = head;
    if (def.hat) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.12, 8), pants);
      cap.position.y = 1.78;
      this.group.add(cap);
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.16), pants);
      brim.position.set(0, 1.74, 0.18);
      this.group.add(brim);
    }

    this.parts = P;
    this.group.position.copy(position);
    this.homePos = position.clone();
    this.state = 'idle';
    this.phase = this.rng.range(0, Math.PI * 2);
    this.fleeDir = new THREE.Vector3();
    this.pointing = false;

    // Tag for hit detection (shooting civilians is penalized).
    this.group.traverse((o) => { if (o.isMesh) o.userData.owner = this; });
    game.scene.add(this.group);
  }

  update(dt, time) {
    const t = time + this.phase;
    // Find a threatening buffalo (charging/telegraphing within range).
    let threat = null;
    if (this.game.enemyManager) {
      for (const b of this.game.enemyManager.buffalos) {
        if (!b.alive || b.dead) continue;
        if ((b.state === 'charge' || b.state === 'telegraph') &&
            b.group.position.distanceTo(this.group.position) < 10) { threat = b; break; }
      }
    }

    if (threat) {
      // Run away from the threat.
      const d = new THREE.Vector3().subVectors(this.group.position, threat.group.position);
      d.y = 0;
      if (d.lengthSq() > 0.01) this.fleeDir.copy(d.normalize());
      this.state = 'flee';
      this.group.position.addScaledVector(this.fleeDir, 3.2 * dt);
      // Don't run forever: stay near home.
      const fromHome = new THREE.Vector3().subVectors(this.group.position, this.homePos);
      if (fromHome.length() > 7) {
        fromHome.normalize();
        this.group.position.addScaledVector(fromHome, -2.5 * dt);
      }
      // Leg run animation.
      const s = Math.sin(t * 10) * 0.6;
      this.parts.legL.rotation.x = s;
      this.parts.legR.rotation.x = -s;
      this.parts.armL.rotation.x = -s * 0.8;
      this.parts.armR.rotation.x = s * 0.8;
      this.group.position.y = Math.abs(Math.sin(t * 10)) * 0.06;
    } else {
      this.state = 'idle';
      // Drift back home slowly.
      const toHome = new THREE.Vector3().subVectors(this.homePos, this.group.position);
      toHome.y = 0;
      if (toHome.length() > 0.5) this.group.position.addScaledVector(toHome.normalize(), 1.2 * dt);
      // Idle bob + occasional pointing at nearby buffalo.
      this.group.position.y = Math.sin(t * 2) * 0.02;
      this.parts.legL.rotation.x = 0;
      this.parts.legR.rotation.x = 0;
      let nearBuffalo = null;
      if (this.game.enemyManager) {
        for (const b of this.game.enemyManager.buffalos) {
          if (b.alive && !b.dead && b.group.position.distanceTo(this.group.position) < 8) { nearBuffalo = b; break; }
        }
      }
      if (nearBuffalo && !this.pointing) {
        this.pointing = true;
        this.parts.armR.rotation.z = -2.4; // point up
        this.group.lookAt(nearBuffalo.group.position.x, this.group.position.y + 1, nearBuffalo.group.position.z);
      } else if (!nearBuffalo && this.pointing) {
        this.pointing = false;
        this.parts.armR.rotation.z = 0;
      }
    }
  }

  onShot(game) {
    // Penalty for shooting a civilian.
    game.onCivilianShot(this);
    // React: stumble + point accusingly.
    this.state = 'flee';
    const d = new THREE.Vector3().subVectors(this.group.position, game.camera.position);
    d.y = 0; d.normalize();
    this.fleeDir.copy(d);
    this.parts.armR.rotation.z = -2.6;
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.group.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
    for (const m of this.mats) m.dispose();
    this.game.scene.remove(this.group);
  }
}
