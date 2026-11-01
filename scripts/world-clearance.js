// World clearance check: builds each level's world headlessly (stubbed canvas)
// and reports any object whose ground footprint lands on the asphalt.
//   node scripts/world-clearance.js
import * as THREE from 'three';

// ---- Minimal DOM stub so the procedural canvas textures can be built in Node ----
const gradient = { addColorStop() {} };
function makeCtx(canvas) {
  const store = {};
  return new Proxy(canvas, {
    get(_, key) {
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
      if (key === 'measureText') return () => ({ width: 10 });
      if (key in store) return store[key];
      return () => undefined;
    },
    set(_, key, value) { store[key] = value; return true; }
  });
}
globalThis.document = {
  createElement(tag) {
    if (tag !== 'canvas') return {};
    const c = { width: 256, height: 256, nodeType: 1, style: {} };
    c.getContext = () => makeCtx(c);
    return c;
  }
};

const { LEVELS } = await import('../src/levels/index.js');
const { buildWorld } = await import('../src/world/ProceduralWorld.js');
const { Rng } = await import('../src/utils/rng.js');

// Walks every mesh below `root`, reporting the deepest intrusion into the asphalt band.
function findRoadBlockers(root, curve, half, ribbons) {
  const road = [];
  for (let i = 0; i <= 400; i++) road.push(curve.getPointAt(i / 400, new THREE.Vector3()));
  const distToBox = (pt, b) => {
    const dx = Math.max(b.min.x - pt.x, 0, pt.x - b.max.x);
    const dz = Math.max(b.min.z - pt.z, 0, pt.z - b.max.z);
    return Math.hypot(dx, dz);
  };
  const box = new THREE.Box3();
  const offenders = [];
  let index = 0;
  for (const child of root.children) {
    index++;
    if (index <= ribbons) continue; // road / sidewalk / river ribbons
    if (child.userData.watercraft) continue; // ships and weirs live in the water
    let worst = Infinity, dims = null, ymin = 0, ymax = 0;
    child.traverse((o) => {
      if (!o.isMesh && !o.isInstancedMesh) return;
      box.setFromObject(o);
      if (!Number.isFinite(box.min.x)) return;
      if (box.min.y > 1.2 || box.max.y <= 0.35) return; // overhead dressing only touches the sky
      for (const pt of road) {
        const d = distToBox(pt, box);
        if (d < worst) { worst = d; dims = `${(box.max.x - box.min.x).toFixed(1)}x${(box.max.z - box.min.z).toFixed(1)}x${(box.max.y - box.min.y).toFixed(1)}`; ymin = box.min.y; ymax = box.max.y; }
      }
    });
    if (worst < half) offenders.push({ index, worst: +worst.toFixed(2), dims, y: `${ymin.toFixed(1)}..${ymax.toFixed(1)}` });
  }
  return offenders;
}

let total = 0;
const SEEDS = [1, 42, 7919, 123456, 999983];
for (const lvl of LEVELS) {
  const curve = new THREE.CatmullRomCurve3(
    lvl.path.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal');
  const roadWidth = lvl.world.roadWidth || 10;
  const half = roadWidth / 2;

  let offenders = [];
  for (const seed of SEEDS) {
    const scene = new THREE.Scene();
    const world = buildWorld(scene, curve, lvl, new Rng(lvl.id * 7919 + seed));
    world.root.updateMatrixWorld(true);
    // Skipped leading children: ground, road, two sidewalks, and the river ribbon.
    offenders = offenders.concat(findRoadBlockers(world.root, curve, half, lvl.world.riverSide ? 5 : 4)
      .map((o) => ({ ...o, seed })));
  }

  total += offenders.length;
  console.log(`Level ${lvl.id} (${lvl.world.theme}, road ${roadWidth}, ${SEEDS.length} seeds): ${offenders.length} object(s) on the asphalt`);
  for (const o of offenders.slice(0, 14)) {
    console.log(`   seed ${o.seed} child #${String(o.index).padStart(2)}  intrusion ${(half - o.worst).toFixed(2)}m past the curb  footprint ${o.dims}  y ${o.y}`);
  }
  if (offenders.length > 14) console.log(`   ... and ${offenders.length - 14} more`);
}
console.log(total === 0 ? '\nCLEAR: no world object blocks the roadway' : `\n${total} ROAD BLOCKERS`);
process.exit(total === 0 ? 0 : 1);
