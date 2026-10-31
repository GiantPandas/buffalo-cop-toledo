import * as THREE from 'three';
import { clamp } from '../utils/mathx.js';

// Spline-based rail: the camera rides a CatmullRom path with a separate look-target path.
// Level designers supply position points, look points and a duration.
export class RailSystem {
  constructor(positions, lookAts, duration) {
    this.posCurve = new THREE.CatmullRomCurve3(
      positions.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal');
    this.lookCurve = new THREE.CatmullRomCurve3(
      lookAts.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal');
    this.duration = Math.max(5, duration);
    this.time = 0;
    this.finished = false;
    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3();
  }

  get progress() { return clamp(this.time / this.duration, 0, 1); }

  // Eased progress — where the camera actually is on the curve.
  easedProgress() { return this._ease(this.progress); }

  update(dt) {
    if (this.finished) return;
    this.time += dt;
    if (this.time >= this.duration) {
      this.time = this.duration;
      this.finished = true;
    }
  }

  // Gentle ease-in/out blend so the ride starts and ends smoothly.
  _ease(x) {
    const s = x * x * (3 - 2 * x); // smoothstep
    return x * 0.7 + s * 0.3;
  }

  // Sample rail position + look target at current time.
  sample(outPos, outLook) {
    const u = this._ease(this.progress);
    this.posCurve.getPointAt(u, outPos);
    this.lookCurve.getPointAt(u, outLook);
    return { pos: outPos, look: outLook };
  }

  // Sample at an arbitrary progress (for spawning ahead of the camera).
  sampleAt(u, outPos) {
    this.posCurve.getPointAt(clamp(u, 0, 1), outPos);
    return outPos;
  }

  tangentAt(u, out) {
    return this.posCurve.getTangentAt(clamp(u, 0, 1), out);
  }

  // World position a given distance ahead of the camera (approx via arc length).
  pointAhead(distance, out) {
    const len = this.posCurve.getLength();
    const u = clamp(this.easedProgress() + distance / len, 0, 1);
    return this.sampleAt(u, out);
  }

  // Lateral offset vector (right of travel direction) at progress u.
  rightVector(out, u = this.easedProgress()) {
    const t = this.tangentAt(u, new THREE.Vector3());
    return out.set(-t.z, 0, t.x).normalize();
  }
}
