import * as THREE from 'three';

// Pooled sprite particle system. One shared soft-circle texture, per-particle materials.
const POOL_SIZE = 260;

function makeParticleTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

class Particle {
  constructor() {
    this.active = false;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.life = 0;
    this.maxLife = 1;
    this.size0 = 1;
    this.grow = 0;
    this.gravity = 0;
    this.sprite = null;
    this.mat = null;
  }
}

export class ParticleManager {
  constructor(scene) {
    this.scene = scene;
    this.texture = makeParticleTexture();
    this.pool = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const p = new Particle();
      p.mat = new THREE.SpriteMaterial({
        map: this.texture, color: 0xffffff, transparent: true,
        depthWrite: false, opacity: 0
      });
      p.sprite = new THREE.Sprite(p.mat);
      p.sprite.visible = false;
      p.sprite.scale.setScalar(0.1);
      scene.add(p.sprite);
      this.pool.push(p);
    }
    this._cursor = 0;
  }

  _acquire() {
    // Round-robin; if all active, steal the oldest slot.
    for (let i = 0; i < POOL_SIZE; i++) {
      this._cursor = (this._cursor + 1) % POOL_SIZE;
      const p = this.pool[this._cursor];
      if (!p.active) return p;
    }
    return this.pool[this._cursor];
  }

  // Spawn a burst. opts: count, colors[], size [min,max], speed [min,max],
  // life [min,max], gravity, dir (Vector3), spread (0..1 random sphere bias)
  spawnBurst(pos, opts = {}) {
    const count = opts.count ?? 12;
    for (let i = 0; i < count; i++) {
      const p = this._acquire();
      p.active = true;
      p.pos.copy(pos);
      p.vel.set(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2 + (opts.upBias ?? 0.4),
        (Math.random() - 0.5) * 2
      );
      const sp = opts.speed ? opts.speed[0] + Math.random() * (opts.speed[1] - opts.speed[0]) : 3;
      p.vel.multiplyScalar(sp);
      if (opts.dir) {
        p.vel.addScaledVector(opts.dir, opts.dirStrength ?? 2.5);
      }
      p.maxLife = p.life = (opts.life ? opts.life[0] + Math.random() * (opts.life[1] - opts.life[0]) : 0.6);
      p.size0 = opts.size ? opts.size[0] + Math.random() * (opts.size[1] - opts.size[0]) : 0.5;
      p.grow = opts.grow ?? 0.8;
      p.gravity = opts.gravity ?? 0;
      const colors = opts.colors || [0xffffff];
      p.mat.color.setHex(colors[(Math.random() * colors.length) | 0]);
      p.mat.opacity = 1;
      p.sprite.visible = true;
      p.sprite.position.copy(p.pos);
      p.sprite.scale.setScalar(p.size0);
    }
  }

  update(dt) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.sprite.visible = false;
        continue;
      }
      const t = 1 - p.life / p.maxLife;
      p.vel.y -= p.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.sprite.position.copy(p.pos);
      p.sprite.scale.setScalar(Math.max(0.02, p.size0 + p.grow * t));
      p.mat.opacity = 1 - t * t;
    }
  }

  clear() {
    for (const p of this.pool) {
      p.active = false;
      p.sprite.visible = false;
      p.mat.opacity = 0;
    }
  }
}
