// Simulate spawn-vs-building overlap to confirm the bug.
import * as THREE from 'three';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
class Rng {
  constructor(seed = 1337) { this.fn = mulberry32(seed); }
  next() { return this.fn(); }
  range(min, max) { return min + (max - min) * this.fn(); }
  int(min, max) { return Math.floor(this.range(min, max + 1)); }
  pick(arr) { return arr[Math.floor(this.fn() * arr.length)]; }
  chance(p) { return this.fn() < p; }
  sign() { return this.fn() < 0.5 ? -1 : 1; }
}

const levels = [
  { id: 1, roadWidth: 11, theme: 'city', path: [[-170,2.2,0],[-140,2.2,1],[-110,2.2,-2],[-80,2.2,3],[-50,2.2,-3],[-20,2.2,2],[10,2.2,-2],[40,2.2,3],[70,2.2,0],[100,2.2,-2],[130,2.2,1],[160,2.2,0]] },
  { id: 2, roadWidth: 12, theme: 'downtown', path: [[-160,2.2,-30],[-120,2.2,-20],[-85,2.2,-30],[-50,2.2,-15],[-15,2.2,-25],[20,2.2,-10],[55,2.2,-22],[90,2.2,-8],[125,2.2,-20],[160,2.2,-10]] },
  { id: 3, roadWidth: 9, theme: 'farm', path: [[-150,2.2,10],[-115,2.2,-4],[-80,2.2,8],[-45,2.2,-6],[-10,2.2,6],[25,2.2,-4],[60,2.2,8],[95,2.2,-2],[130,2.2,6],[155,2.2,0]] },
  { id: 4, roadWidth: 10, theme: 'fair', path: [[-160,2.2,0],[-130,2.2,-8],[-100,2.2,4],[-70,2.2,-6],[-40,2.2,6],[-10,2.2,-4],[20,2.2,6],[50,2.2,-4],[80,2.2,4],[110,2.2,-6],[140,2.2,2],[160,2.2,0]] },
];

for (const L of levels) {
  const curve = new THREE.CatmullRomCurve3(
    L.path.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal');
  const roadWidth = L.roadWidth;

  // Replicate building placement exactly (same rng consumption order).
  const rng = new Rng(L.id * 7919 + 42);
  const buildings = [];
  const P = new THREE.Vector3(), T = new THREE.Vector3(), R = new THREE.Vector3();
  for (let u = 0.03; u < 0.985; u += 0.042) {
    for (const side of [-1, 1]) {
      if (rng.chance(0.18)) continue;
      curve.getPointAt(u, P);
      curve.getTangentAt(u, T);
      R.set(-T.z, 0, T.x).normalize();
      const dist = roadWidth / 2 + 3.2 + rng.range(4, 8);
      const bw = rng.range(8, 14), bd = rng.range(7, 11);
      const bh = (L.theme === 'downtown' ? rng.int(3, 5) : rng.int(2, 3)) * 4.2;
      buildings.push({ u, side, dist, bw, bd, P: P.clone(), T: T.clone(), R: R.clone() });
    }
  }

  // NEW spawn math (roadSpawnPos): point ON the curve ahead of the camera,
  // plus a lateral offset clamped to the asphalt. Verify zero building overlap.
  const ease = (x) => { const s = x * x * (3 - 2 * x); return x * 0.7 + s * 0.3; };
  const len = curve.getLength();
  const maxLat = roadWidth / 2 - 1.5;
  let worst = 0, worstInfo = null;
  const insideCount = { n: 0 };
  let tested = 0;
  for (let p = 0; p <= 1; p += 0.004) {
    const uSpawnBase = Math.min(1, ease(p));
    for (const ahead of [3, 8, 14, 20, 26]) {
      for (let k = 0; k < 6; k++) {
        // lateral per encounter type: herd spread / traffic line / normal sides
        const lateralRaw = (Math.random() - 0.5) * (roadWidth - 3);
        const lateral = Math.max(-maxLat, Math.min(maxLat, lateralRaw));
        const uSpawn = Math.min(1, uSpawnBase + ahead / len);
        curve.getPointAt(uSpawn, P);
        curve.getTangentAt(uSpawn, T);
        R.set(-T.z, 0, T.x).normalize();
        const S = new THREE.Vector3(P.x + R.x * lateral, 0, P.z + R.z * lateral);
        tested++;
        for (const b of buildings) {
          const d = new THREE.Vector3().subVectors(S, b.P);
          const lat = d.dot(b.R);       // +right side
          const along = d.dot(b.T);     // along road
          const cLat = -b.side * b.dist;
          if (Math.abs(lat - cLat) <= b.bd / 2 && Math.abs(along) <= b.bw / 2) {
            insideCount.n++;
            const depth = Math.abs(lat - cLat); // how far into building
            if (depth > worst) { worst = depth; worstInfo = { level: L.id, p: +p.toFixed(3), ahead, side: b.side, u: +b.u.toFixed(3), lat: +lat.toFixed(1), dist: +b.dist.toFixed(1) }; }
          }
        }
      }
    }
  }
  console.log(`Level ${L.id}: buildings=${buildings.length} testedSpawns=${tested} insideHits=${insideCount.n} worstDepthIntoBuilding=${worst.toFixed(2)} info=${JSON.stringify(worstInfo)}`);
}
