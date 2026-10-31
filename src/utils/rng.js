// Seeded RNG (mulberry32) + helpers for controlled procedural variation.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed = 1337) { this.fn = mulberry32(seed); }
  next() { return this.fn(); }
  range(min, max) { return min + (max - min) * this.fn(); }
  int(min, max) { return Math.floor(this.range(min, max + 1)); }
  pick(arr) { return arr[Math.floor(this.fn() * arr.length)]; }
  chance(p) { return this.fn() < p; }
  sign() { return this.fn() < 0.5 ? -1 : 1; }
}
