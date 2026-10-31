import * as THREE from 'three';
import { damp, clamp } from '../utils/mathx.js';

// Applies rail position with smoothing, plus screen shake and recoil kick.
export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.shakeAmount = 0;
    this.recoil = 0;
    this.pitchKick = 0;
    this.smoothPos = new THREE.Vector3();
    this.smoothLook = new THREE.Vector3();
    this._init = false;
    this._fwd = new THREE.Vector3();
    this._shakeVec = new THREE.Vector3();
    this.shakeEnabled = true;
  }

  reset(pos, look) {
    this.smoothPos.copy(pos);
    this.smoothLook.copy(look);
    this.camera.position.copy(pos);
    this.camera.lookAt(look);
    this._init = true;
    this.shakeAmount = 0;
    this.recoil = 0;
    this.pitchKick = 0;
  }

  addShake(n) { this.shakeAmount = clamp(this.shakeAmount + n, 0, 1.4); }
  addRecoil(n) {
    this.recoil = clamp(this.recoil + n, 0, 0.35);
    this.pitchKick = clamp(this.pitchKick + n * 0.6, 0, 0.2);
  }

  update(dt, railPos, railLook) {
    if (!this._init) { this.reset(railPos, railLook); return; }

    // Smooth follow of the rail (fast lambda = tight but no jitter).
    const lam = 14;
    this.smoothPos.x = damp(this.smoothPos.x, railPos.x, lam, dt);
    this.smoothPos.y = damp(this.smoothPos.y, railPos.y, lam, dt);
    this.smoothPos.z = damp(this.smoothPos.z, railPos.z, lam, dt);
    this.smoothLook.x = damp(this.smoothLook.x, railLook.x, 10, dt);
    this.smoothLook.y = damp(this.smoothLook.y, railLook.y, 10, dt);
    this.smoothLook.z = damp(this.smoothLook.z, railLook.z, 10, dt);

    // Decay effects.
    this.shakeAmount = Math.max(0, this.shakeAmount - dt * 1.6);
    this.recoil = Math.max(0, this.recoil - dt * 1.4);
    this.pitchKick = Math.max(0, this.pitchKick - dt * 1.2);

    const cam = this.camera;
    cam.position.copy(this.smoothPos);

    // Shake noise (disabled by option).
    if (this.shakeEnabled && this.shakeAmount > 0.001) {
      const s = this.shakeAmount * 0.35;
      this._shakeVec.set(
        (Math.random() - 0.5) * s,
        (Math.random() - 0.5) * s,
        (Math.random() - 0.5) * s
      );
      cam.position.add(this._shakeVec);
    }

    // Recoil: push back along view direction + slight upward pitch.
    if (this.recoil > 0.0005 || this.pitchKick > 0.0005) {
      cam.lookAt(this.smoothLook);
      cam.getWorldDirection(this._fwd);
      cam.position.addScaledVector(this._fwd, -this.recoil);
      if (this.pitchKick > 0.0005) {
        cam.rotateX(this.pitchKick * 0.25);
      }
    } else {
      cam.lookAt(this.smoothLook);
    }
  }
}
