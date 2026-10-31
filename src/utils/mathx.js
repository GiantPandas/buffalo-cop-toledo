// Small math helpers.
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// Frame-rate independent damping toward a target.
export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function pad(n, len = 6) {
  return String(Math.max(0, Math.floor(n))).padStart(len, '0');
}

export function fmt(n) {
  return Math.floor(n).toLocaleString('en-US');
}
