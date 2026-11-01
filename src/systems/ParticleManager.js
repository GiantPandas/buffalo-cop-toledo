import * as THREE from 'three';

// Pooled sprite particle system. Shared textures (soft dot / hot streak / fur
// chunk), per-particle materials so each burst can pick a texture + blending.
const POOL_SIZE = 480;

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

// Elongated hot streak: tracers/sparks that align to their velocity.
function makeStreakTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 24;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(2, 0, 62, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.75, 'rgba(255,235,170,0.65)');
  grad.addColorStop(1, 'rgba(255,200,90,0)');
  g.fillStyle = grad;
  g.fillRect(0, 5, 64, 14);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.fillRect(24, 9, 18, 6);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

// Irregular lumpy blob: brown fur chunks / debris (tinted via material.color).
function makeChunkTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 48;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.beginPath();
  g.moveTo(24, 5); g.lineTo(37, 11); g.lineTo(42, 25); g.lineTo(33, 40);
  g.lineTo(17, 42); g.lineTo(7, 27); g.lineTo(11, 12);
  g.closePath(); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.30)';
  g.fillRect(16, 16, 9, 9);
  g.fillRect(28, 25, 6, 7);
  g.fillStyle = 'rgba(255,255,255,0.4)';
  g.fillRect(22, 30, 4, 4);
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
    this.rot = 0;         // sprite rotation (rad)
    this.spin = 0;        // rotation speed (rad/s)
    this.streak = false;  // align rotation to screen-space velocity
    this.sprite = null;
    this.mat = null;
  }
}

export class ParticleManager {
  constructor(scene) {
    this.scene = scene;
    this.texture = makeParticleTexture();
    this.streakTexture = makeStreakTexture();
    this.chunkTexture = makeChunkTexture();
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
  // life [min,max], gravity, dir (Vector3), spread (0..1 random sphere bias),
  // streak (hot tracer particles, additive, align to velocity),
  // chunk (lumpy debris sprites, tinted, tumbling), spin (tumble rad/s)
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
      p.streak = !!opts.streak;
      p.mat.map = opts.chunk ? this.chunkTexture : (p.streak ? this.streakTexture : this.texture);
      p.mat.blending = p.streak ? THREE.AdditiveBlending : THREE.NormalBlending;
      p.rot = Math.random() * Math.PI * 2;
      p.spin = opts.spin ? opts.spin[0] + Math.random() * (opts.spin[1] - opts.spin[0]) : 0;
      p.mat.rotation = p.rot;
      p.mat.needsUpdate = true;
      p.mat.opacity = 1;
      p.sprite.visible = true;
      p.sprite.position.copy(p.pos);
      p.sprite.scale.setScalar(p.size0);
      if (p.streak) p.sprite.scale.set(p.size0 * 2.4, p.size0 * 0.75, 1);
    }
  }

  update(dt, camera) {
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
      if (p.streak) p.sprite.scale.set((p.size0 + p.grow * t) * 2.4, p.size0 * 0.75, 1);
      if (p.spin) {
        p.rot += p.spin * dt;
        p.mat.rotation = p.rot;
      } else if (p.streak && camera) {
        // Align the streak to its screen-space direction.
        const rx = camera.matrixWorld.elements[0], ry = camera.matrixWorld.elements[4], rz = camera.matrixWorld.elements[8];
        const ux = camera.matrixWorld.elements[1], uy = camera.matrixWorld.elements[5], uz = camera.matrixWorld.elements[9];
        const sx = p.vel.x * rx + p.vel.y * ry + p.vel.z * rz;
        const sy = p.vel.x * ux + p.vel.y * uy + p.vel.z * uz;
        p.mat.rotation = Math.atan2(sy, sx);
      }
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
