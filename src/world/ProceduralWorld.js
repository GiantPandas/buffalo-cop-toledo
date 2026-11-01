import * as THREE from 'three';
import { addBox, addCyl, makePrism, buildStrip, disposeTree } from './geometry.js';
import { placeLandmarks } from './landmarks.js';
import {
  makeBuildingTexture, makeGlassTowerTexture, makeRoadTexture, makeSidewalkTexture, makeGrassTexture,
  makeDirtTexture, makeConcreteTexture, makeWaterTexture, makeSignTexture,
  makeStripeTexture, makeTentTexture
} from './textures.js';

// ================= MATERIAL CACHE (per build) =================
let MAT = null;
export function mats(theme) {
  if (MAT) return MAT;
  const M = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...o });
  MAT = {
    brick: M(0x7a4a32), brickDark: M(0x5e3a28), concrete: M(0x9a9da1),
    roof: M(0x4a4a52), metal: M(0x6a7078), darkMetal: M(0x3a3f46),
    wood: M(0x8a6a42), woodDark: M(0x6a4e30), leaf: M(0x4a7a30), leafDark: M(0x3a6226),
    trunk: M(0x5e4429), hay: M(0xc8a84a), tire: M(0x1c1c20), glass: M(0x27404f, { emissive: 0x0a1a24 }),
    white: M(0xe8e8e8), red: M(0xb03a3a), yellow: M(0xd8b83e), blue: M(0x3a5a8a),
    water: new THREE.MeshLambertMaterial({ map: makeWaterTexture() }),
    road: new THREE.MeshLambertMaterial({ map: makeRoadTexture() }),
    sidewalk: new THREE.MeshLambertMaterial({ map: makeSidewalkTexture() }),
    grass: new THREE.MeshLambertMaterial({ map: makeGrassTexture() }),
    dirt: new THREE.MeshLambertMaterial({ map: makeDirtTexture() }),
    concreteTex: new THREE.MeshLambertMaterial({ map: makeConcreteTexture() }),
    neon: (t) => new THREE.MeshBasicMaterial({ map: t, transparent: true }),
  };
  return MAT;
}
export function resetMatCache() { MAT = null; }

// ================= BUILDINGS =================
function makeBuilding(rng, M, facadeTex, w, d, h) {
  const g = new THREE.Group();
  const sideColor = rng.pick([0x6a4230, 0x5c5a54, 0x7a6a58, 0x4e4a44, 0x6b5a4a]);
  const sideMat = new THREE.MeshLambertMaterial({ color: sideColor, flatShading: true });
  const topMat = M.roof;
  const botMat = new THREE.MeshLambertMaterial({ color: 0x5e3a28, flatShading: true });
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    [sideMat, sideMat, topMat, botMat, new THREE.MeshLambertMaterial({ map: facadeTex, flatShading: true }), sideMat]
  );
  body.position.y = h / 2;
  g.add(body);
  // Parapet / roof edge
  addBox(g, w + 0.4, 0.5, d + 0.4, 0, h + 0.25, 0, M.roof);
  // Ground-floor band at street level (darker plinth + glass line)
  addBox(g, w + 0.12, 1.1, d + 0.12, 0, 0.55, 0, new THREE.MeshLambertMaterial({ color: 0x241f1a, flatShading: true }));
  addBox(g, w + 0.16, 0.14, d + 0.16, 0, 1.18, 0, new THREE.MeshLambertMaterial({ color: 0xb8a888, flatShading: true }));
  // Storefront awning on the facade (+z) sometimes
  if (rng.chance(0.6)) {
    const aw = addBox(g, w * 0.8, 0.3, 1.4, 0, 3.4, d / 2 + 0.7,
      new THREE.MeshLambertMaterial({ map: makeStripeTexture(
        rng.pick(['#c23a3a', '#3a5a8a', '#b03a7a', '#d8b83e']), '#f0ead8'), flatShading: true }));
    aw.rotation.x = 0.18;
  }
  // Setback upper floor on taller buildings — real city silhouettes step back
  if (h > 12 && rng.chance(0.45)) {
    const uh = rng.range(3.5, 7);
    addBox(g, w * 0.62, uh, d * 0.62, rng.range(-1.5, 1.5), h + uh / 2 + 0.4, rng.range(-1.5, 1.5), sideMat);
    addBox(g, w * 0.62 + 0.3, 0.35, d * 0.62 + 0.3, 0, h + uh + 0.55, 0, M.roof);
  }
  // Roof clutter: water tanks, AC units, vents
  if (rng.chance(0.4)) addCyl(g, 0.9, 0.9, 1.6, rng.range(-w * 0.25, w * 0.25), h + 1.1, rng.range(-d * 0.25, d * 0.25), M.woodDark, 8);
  if (rng.chance(0.5)) addBox(g, 1.4, 0.8, 1.0, rng.range(-w * 0.3, w * 0.3), h + 0.7, rng.range(-d * 0.3, d * 0.3), M.metal);
  if (rng.chance(0.3)) addCyl(g, 0.22, 0.26, 1.1, rng.range(-w * 0.3, w * 0.3), h + 0.85, rng.range(-d * 0.3, d * 0.3), M.darkMetal, 6);
  return g;
}

function makeStorefront(rng, M, text) {
  const g = new THREE.Group();
  const w = 10, d = 8, h = 6;
  addBox(g, w, h, d, 0, h / 2, 0, M.brick);
  // Big window front
  addBox(g, w * 0.85, 2.6, 0.3, 0, 1.9, d / 2 + 0.05, M.glass);
  // Sign board
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.9, 1.8),
    M.neon(makeSignTexture(text, '#101820', rng.pick(['#ffd23e', '#7fd4ff', '#ff7ab0'])))
  );
  sign.position.set(0, h - 1.4, d / 2 + 0.15);
  g.add(sign);
  return g;
}

// ================= PROPS =================
function makeStreetlight(M) {
  const g = new THREE.Group();
  addCyl(g, 0.09, 0.13, 6.5, 0, 3.25, 0, M.darkMetal, 6);
  addBox(g, 1.6, 0.12, 0.12, 0.7, 6.4, 0, M.darkMetal);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0xfff2c0, emissive: 0xffd97a }));
  bulb.position.set(1.4, 6.3, 0);
  g.add(bulb);
  return g;
}

function makeUtilityPole(M) {
  const g = new THREE.Group();
  addCyl(g, 0.1, 0.16, 8, 0, 4, 0, M.woodDark, 6);
  addBox(g, 2.6, 0.1, 0.1, 0, 7.5, 0, M.woodDark);
  for (const s of [-1, 1]) {
    const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.25, 6), M.white);
    ins.position.set(s * 1.1, 7.35, 0);
    ins.rotation.z = Math.PI / 2;
    g.add(ins);
  }
  return g;
}

function makeCar(M, color) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color, flatShading: true });
  addBox(g, 1.9, 0.75, 4.2, 0, 0.75, 0, bodyMat);
  addBox(g, 1.7, 0.6, 2.2, 0, 1.35, -0.2, M.glass);
  for (const [x, z] of [[-0.85, 1.4], [0.85, 1.4], [-0.85, -1.4], [0.85, -1.4]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10), M.tire);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.36, z);
    g.add(w);
  }
  // Headlights
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5),
      new THREE.MeshLambertMaterial({ color: 0xfff8d0, emissive: 0xd8c27a }));
    hl.position.set(s * 0.6, 0.72, 2.1);
    g.add(hl);
  }
  return g;
}

function makePoliceCar(M) {
  const g = makeCar(M, 0xd8dce0);
  addBox(g, 1.95, 0.28, 4.25, 0, 0.55, 0, new THREE.MeshLambertMaterial({ color: 0x1c2733, flatShading: true }));
  const bar = addBox(g, 0.9, 0.22, 0.4, 0, 1.78, -0.2, M.darkMetal);
  bar.name = 'lightbar';
  const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.3),
    new THREE.MeshLambertMaterial({ color: 0xff3a3a, emissive: 0xaa1111 }));
  l1.position.set(-0.25, 0.14, 0); bar.add(l1);
  const l2 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x3a6aff, emissive: 0x1133aa }));
  l2.position.set(0.25, 0.14, 0); bar.add(l2);
  return g;
}

function makeTruck(M, color) {
  const g = new THREE.Group();
  addBox(g, 2.1, 1.6, 3.2, 0, 1.3, 1.4, new THREE.MeshLambertMaterial({ color, flatShading: true })); // cab
  addBox(g, 2.2, 2.2, 5.4, 0, 1.6, -2.2, M.concrete); // box
  for (const [x, z] of [[-0.95, 2.2], [0.95, 2.2], [-0.95, -3.4], [0.95, -3.4], [-0.95, -1.8], [0.95, -1.8]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10), M.tire);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.42, z);
    g.add(w);
  }
  return g;
}

function makeTree(rng, M) {
  const g = new THREE.Group();
  const h = rng.range(1.6, 2.6);
  addCyl(g, 0.18, 0.3, h, 0, h / 2, 0, M.trunk, 6);
  if (rng.chance(0.5)) {
    for (let i = 0; i < 3; i++) {
      const r = rng.range(1.2, 1.9) * (1 - i * 0.22);
      const c = new THREE.Mesh(new THREE.ConeGeometry(r, h * 0.75, 7), rng.chance(0.5) ? M.leaf : M.leafDark);
      c.position.y = h + i * h * 0.32;
      g.add(c);
    }
  } else {
    for (let i = 0; i < 4; i++) {
      const r = rng.range(1, 1.7);
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), rng.chance(0.5) ? M.leaf : M.leafDark);
      s.position.set(rng.range(-0.8, 0.8), h + rng.range(0.4, 1.6), rng.range(-0.8, 0.8));
      g.add(s);
    }
  }
  return g;
}

export function makeHayBale(M) {
  const g = new THREE.Group();
  addBox(g, 1.2, 1.1, 1.9, 0, 0.55, 0, M.hay);
  addBox(g, 1.24, 0.3, 1.94, 0, 0.75, 0, new THREE.MeshLambertMaterial({ color: 0xb89838, flatShading: true }));
  return g;
}

function makeSilo(M) {
  const g = new THREE.Group();
  addCyl(g, 2.4, 2.6, 12, 0, 6, 0, M.concreteTex, 12);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.metal);
  dome.position.y = 12;
  g.add(dome);
  addCyl(g, 0.3, 0.3, 2, 0, 13.4, 0, M.darkMetal, 6);
  return g;
}

function makeBarn(rng, M) {
  const g = new THREE.Group();
  const w = rng.range(9, 13), d = rng.range(8, 11), h = 5.5;
  addBox(g, w, h, d, 0, h / 2, 0, M.wood);
  const roof = new THREE.Mesh(makePrism(w + 0.6, 3, d + 0.6), M.red);
  roof.position.y = h;
  g.add(roof);
  // Big doors
  addBox(g, w * 0.5, h * 0.7, 0.2, 0, h * 0.35, d / 2 + 0.1, M.woodDark);
  // X brace on doors
  const braceMat = M.white;
  for (const s of [-1, 1]) {
    const b = addBox(g, w * 0.48, 0.35, 0.24, 0, h * 0.35, d / 2 + 0.12, braceMat);
    b.rotation.z = s * 0.6;
  }
  return g;
}

function makeFence(run, M) {
  const g = new THREE.Group();
  const posts = Math.max(2, Math.floor(run / 3));
  for (let i = 0; i <= posts; i++) {
    addBox(g, 0.16, 1.5, 0.16, -run / 2 + (i * run) / posts, 0.75, 0, M.woodDark);
  }
  addBox(g, run, 0.12, 0.08, 0, 1.1, 0, M.wood);
  addBox(g, run, 0.12, 0.08, 0, 0.6, 0, M.wood);
  return g;
}

export function makeBarrel(M) {
  const g = new THREE.Group();
  addCyl(g, 0.45, 0.45, 1.1, 0, 0.55, 0, M.yellow, 10);
  addCyl(g, 0.47, 0.47, 0.12, 0, 0.8, 0, M.darkMetal, 10);
  return g;
}

export function makeCrate(M) {
  const g = new THREE.Group();
  addBox(g, 1.1, 1.1, 1.1, 0, 0.55, 0, M.wood);
  addBox(g, 1.14, 0.16, 1.14, 0, 1.05, 0, M.woodDark);
  return g;
}

function makeWaterTank(M) {
  const g = new THREE.Group();
  addCyl(g, 3, 3, 4, 0, 6, 0, M.metal, 12);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.darkMetal);
  dome.position.y = 4;
  g.add(dome);
  for (const [x, z] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) {
    addBox(g, 0.4, 4, 0.4, x, 2, z, M.darkMetal);
  }
  return g;
}

function makeStorageBuilding(M) {
  const g = new THREE.Group();
  addBox(g, 16, 7, 10, 0, 3.5, 0, M.metal);
  const roof = new THREE.Mesh(makePrism(16.6, 2, 10.6), M.darkMetal);
  roof.position.y = 7;
  g.add(roof);
  addBox(g, 4, 3.4, 0.2, -4, 1.7, 5.1, M.darkMetal); // roll-up door
  return g;
}

// ================= SPECIAL STRUCTURES =================
export function makeFeedStore(rng, M) {
  const g = new THREE.Group();
  addBox(g, 16, 7, 12, 0, 3.5, 0, M.brick);
  const roof = new THREE.Mesh(makePrism(16.8, 2.4, 12.8), M.red);
  roof.position.y = 7;
  g.add(roof);
  // Big sliding doors (front +z)
  addBox(g, 10, 5, 0.3, 0, 2.5, 6.1, M.woodDark);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.4),
    M.neon(makeSignTexture('FEED & SEED', '#2a1c10', '#ffd23e', 'OPEN... PROBABLY')));
  sign.position.set(0, 8.6, 6.2);
  g.add(sign);
  // Hay piles
  for (let i = 0; i < 4; i++) {
    const pile = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2, 7), M.hay);
    pile.position.set(-5 + i * 3.4, 1, 8.5);
    g.add(pile);
  }
  // Silos beside
  const s1 = makeSilo(M); s1.position.set(12, 0, -2); g.add(s1);
  const s2 = makeSilo(M); s2.position.set(15.5, 0, 1); s2.scale.setScalar(0.8); g.add(s2);
  return g;
}

export function makeGasStation(rng, M) {
  const g = new THREE.Group();
  // Canopy
  addBox(g, 14, 0.5, 9, 0, 4.6, 0, M.white);
  for (const [x, z] of [[-6, -3.5], [6, -3.5], [-6, 3.5], [6, 3.5]]) {
    addCyl(g, 0.25, 0.25, 4.4, x, 2.2, z, M.metal, 8);
  }
  // Price sign (neon)
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 3),
    M.neon(makeSignTexture('TOLEDO FUEL', '#0a1420', '#7fd4ff', 'GAS $0.99 / GALLON')));
  sign.position.set(0, 7.5, 0);
  g.add(sign);
  // Pumps
  for (const s of [-1, 1]) {
    addBox(g, 0.8, 1.4, 0.8, s * 3, 0.7, 0, M.red);
    addBox(g, 0.5, 0.6, 0.1, s * 3, 1.2, 0.45, M.darkMetal);
  }
  // Old building
  addBox(g, 8, 4.5, 7, 0, 2.25, -9, M.brickDark);
  return g;
}

export function makeCarWash(rng, M) {
  const g = new THREE.Group();
  // Three arches (the classic old car wash look)
  for (let i = 0; i < 3; i++) {
    const z = -4 + i * 4;
    addBox(g, 0.7, 5.5, 0.7, -3.2, 2.75, z, M.metal);
    addBox(g, 0.7, 5.5, 0.7, 3.2, 2.75, z, M.metal);
    addBox(g, 7.1, 0.8, 0.7, 0, 5.4, z, M.darkMetal);
    // Hanging brush bar
    const bar = addCyl(g, 0.25, 0.25, 6.4, 0, 3.6, z, M.yellow, 8);
    bar.rotation.z = Math.PI / 2;
    g.userData['arch' + i] = bar;
  }
  // Old control shack
  addBox(g, 4, 3.2, 3.5, -6, 1.6, 0, M.brickDark);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.8),
    M.neon(makeSignTexture('WASH-O-MATIC', '#0a1420', '#ff7ab0', 'OUT OF ORDER SINCE 1987')));
  sign.position.set(-6, 4.2, 1.76);
  g.add(sign);
  // Drainage channel
  addBox(g, 8, 0.2, 14, 0, 0.1, 0, M.darkMetal);
  return g;
}

export function makeFerrisWheel(rng, M) {
  const g = new THREE.Group();
  // Legs (A-frame)
  for (const s of [-1, 1]) {
    const leg = addBox(g, 0.8, 15, 0.8, s * 3, 7.5, 0, M.blue);
    leg.rotation.z = s * -0.22;
  }
  const wheel = new THREE.Group();
  wheel.position.y = 14;
  g.add(wheel);

  const rimMat = new THREE.MeshLambertMaterial({ color: 0xd83a5a, flatShading: true });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(9, 0.32, 8, 24), rimMat);
  wheel.add(rim);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), M.white);
  wheel.add(hub);

  const gondolaPivots = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    // Spoke
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 9, 6), M.white);
    spoke.position.set(Math.cos(a) * 4.5, Math.sin(a) * 4.5, 0);
    spoke.rotation.z = a + Math.PI / 2;
    wheel.add(spoke);
    // Gondola pivot at rim point
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(a) * 9, Math.sin(a) * 9, 0);
    wheel.add(pivot);
    const cart = addBox(pivot, 1.6, 1.4, 1.2, 0, -1.5, 0,
      new THREE.MeshLambertMaterial({ color: rng.pick([0xd8b83e, 0x7fd4ff, 0xff7ab0, 0x9dff6a]), flatShading: true }));
    cart.name = 'gondola';
    gondolaPivots.push(pivot);
  }

  const update = (dt) => {
    wheel.rotation.z += dt * 0.25;
    for (const p of gondolaPivots) p.rotation.z = -wheel.rotation.z; // keep carts level
  };
  return { group: g, update };
}

export function makeTent(rng, M) {
  const g = new THREE.Group();
  const r = rng.range(4, 6);
  addCyl(g, r, r, 3.2, 0, 1.6, 0, M.white, 10);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(r + 0.5, 3, 10),
    new THREE.MeshLambertMaterial({ map: makeTentTexture(), flatShading: true }));
  roof.position.y = 4.7;
  g.add(roof);
  return g;
}

export function makeFoodStand(rng, M) {
  const g = new THREE.Group();
  addBox(g, 6, 3.4, 5, 0, 1.7, 0, M.white);
  const aw = addBox(g, 6.6, 0.25, 2.4, 0, 3.6, 2.6,
    new THREE.MeshLambertMaterial({ map: makeStripeTexture('#c23a3a', '#f0ead8'), flatShading: true }));
  aw.rotation.x = 0.25;
  const texts = ['HOT DOGS', 'LEMONADE', 'FUNNEL CAKE', 'COTTON CANDY'];
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.3),
    M.neon(makeSignTexture(rng.pick(texts), '#101820', '#ffd23e')));
  sign.position.set(0, 4.5, 2.55);
  g.add(sign);
  return g;
}

export function makeCarnivalGame(rng, M) {
  const g = new THREE.Group();
  addBox(g, 3, 2.6, 1.6, 0, 1.3, 0, M.blue);
  // Targets on top
  for (let i = 0; i < 3; i++) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.5, 10),
      new THREE.MeshLambertMaterial({ color: i % 2 ? 0xffffff : 0xd83a3a, flatShading: true }));
    t.position.set(-0.9 + i * 0.9, 2.9, 0);
    g.add(t);
  }
  return g;
}

export function makeBalloonCluster(rng, M) {
  const g = new THREE.Group();
  const colors = [0xff4fa0, 0x3ea6ff, 0xfff23e, 0x9dff6a];
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6),
      new THREE.MeshLambertMaterial({ color: colors[i % 4], flatShading: true }));
    b.position.set(rng.range(-0.7, 0.7), rng.range(2.4, 3.6), rng.range(-0.5, 0.5));
    g.add(b);
  }
  addCyl(g, 0.04, 0.04, 2.4, 0, 1.2, 0, M.white, 4); // pole
  const update = (t) => { g.position.y = Math.sin(t * 1.3 + rng.next() * 6) * 0.15; };
  return { group: g, update };
}

export function makeJokeSign(text, sub, M, w = 4) {
  const g = new THREE.Group();
  addCyl(g, 0.08, 0.08, 2.6, -w / 2 + 0.3, 1.3, 0, M.darkMetal, 5);
  addCyl(g, 0.08, 0.08, 2.6, w / 2 - 0.3, 1.3, 0, M.darkMetal, 5);
  const board = new THREE.Mesh(new THREE.BoxGeometry(w, 2, 0.15),
    [M.white, M.white, M.white, M.white,
     new THREE.MeshLambertMaterial({ map: makeSignTexture(text, '#f0ead8', '#1c2733', sub) }),
     new THREE.MeshLambertMaterial({ map: makeSignTexture(text, '#f0ead8', '#1c2733', sub) })]);
  board.position.y = 3;
  g.add(board);
  return g;
}

export function makeTrafficLight(M) {
  const g = new THREE.Group();
  addCyl(g, 0.1, 0.14, 5.5, 0, 2.75, 0, M.darkMetal, 6);
  addBox(g, 0.7, 1.8, 0.5, 0, 5.6, 0, M.darkMetal);
  const colors = [0xff3a3a, 0xd8b83e, 0x4ad84a];
  g.userData.lights = [];
  for (let i = 0; i < 3; i++) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshLambertMaterial({ color: colors[i], emissive: 0x000000 }));
    lamp.position.set(0, 6.2 - i * 0.5, 0.3);
    g.add(lamp);
    g.userData.lights.push(lamp);
  }
  // Start with red on.
  g.userData.lights[0].material.emissive.setHex(0xaa1111);
  return g;
}

function makePen(M) {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    addBox(g, 6, 1.4, 0.12, -3 + i * 1.5, 0.7, -3, M.metal);
    addBox(g, 6, 1.4, 0.12, -3 + i * 1.5, 0.7, 3, M.metal);
    addBox(g, 0.12, 1.4, 6, -3, 0.7, -1.5 + i * 1.5, M.metal);
    addBox(g, 0.12, 1.4, 6, 3, 0.7, -1.5 + i * 1.5, M.metal);
  }
  return g;
}

function makeDrainageChannel(M) {
  const g = new THREE.Group();
  addBox(g, 1.2, 0.3, 18, 0, 0.15, 0, M.darkMetal);
  addBox(g, 0.9, 0.1, 17.6, 0, 0.32, 0, new THREE.MeshLambertMaterial({ color: 0x1a3a4a }));
  return g;
}

// ================= DEAD-END FINALE =================
// Every ride ends at a lit last-stand plaza, not a dead street into empty
// fields: paved apron, police barricade with blinking beacons, floodlights,
// a final sign, and a themed skyline closing the horizon.
function buildEndcap({ w, rng, M, curve, roadWidth, worldRoot, anims, facades }) {
  const end = curve.getPointAt(1, new THREE.Vector3());
  const tan = curve.getTangentAt(1, new THREE.Vector3());
  tan.y = 0; tan.normalize();
  const right = new THREE.Vector3(-tan.z, 0, tan.x);
  const yaw = Math.atan2(tan.x, tan.z);
  const at = (along, lat) => new THREE.Vector3(
    end.x + tan.x * along + right.x * lat, 0, end.z + tan.z * along + right.z * lat);
  const faceBack = (obj, along, lat) => {
    const q = at(along, lat);
    obj.rotation.y = Math.atan2(end.x - q.x, end.z - q.z);
  };
  const theme = w.theme;

  // Paved/dirt apron so the road terminates on a lot, not on grass.
  const apron = addBox(worldRoot, roadWidth + 20, 0.1, 36, 0, 0, 0,
    (theme === 'farm' || theme === 'fair') ? M.dirt : M.concreteTex);
  apron.position.copy(at(17, 0)); apron.position.y = 0.03; apron.rotation.y = yaw;

  // Police barricade across the road — the finale herd storms through it.
  const barrierMat = new THREE.MeshLambertMaterial(
    { map: makeStripeTexture('#d8b83e', '#1c2733'), flatShading: true });
  for (const s of [-1, 1]) {
    const rail = addBox(worldRoot, roadWidth * 0.52, 0.34, 0.3, 0, 1.0, 0, barrierMat);
    rail.position.copy(at(7, s * roadWidth * 0.25)); rail.rotation.y = yaw + Math.PI / 2;
    const post = addBox(worldRoot, 0.18, 1.2, 0.18, 0, 0.6, 0, M.darkMetal);
    post.position.copy(at(7, s * roadWidth * 0.53)); post.rotation.y = yaw;
    const beaconMat = new THREE.MeshLambertMaterial({ color: 0xffc23e, emissive: 0xd88a10 });
    const beacon = addBox(worldRoot, 0.28, 0.24, 0.28, 0, 1.32, 0, beaconMat);
    beacon.position.copy(at(7, s * roadWidth * 0.53)); beacon.rotation.y = yaw;
    anims.push((dt, time) => { beaconMat.emissiveIntensity = 0.5 + 0.7 * Math.sin(time * 5 + s * 2.4); });
  }

  // Floodlights on the plaza corners — the finale is lit like a shooting range.
  for (const s of [-1, 1]) {
    const foot = at(13, s * (roadWidth / 2 + 9));
    addBox(worldRoot, 0.35, 0.5, 0.35, 0, 0.25, 0, M.darkMetal).position.copy(foot);
    addBox(worldRoot, 0.3, 9, 0.3, 0, 4.75, 0, M.darkMetal).position.copy(foot);
    const headMat = new THREE.MeshLambertMaterial({ color: 0xfff2c8, emissive: 0xffb84a });
    const head = addBox(worldRoot, 1.7, 0.85, 1.0, 0, 9.1, 0, headMat);
    head.position.copy(foot);
    faceBack(head, 13, s * (roadWidth / 2 + 9));
    anims.push((dt, time) => { headMat.emissiveIntensity = 0.85 + 0.12 * Math.sin(time * 2.2 + s); });
  }

  // The sign at the end of the world.
  const sign = makeJokeSign('DEAD END', 'THE BUFFALO ALL CAME THIS WAY', M, 5);
  sign.position.copy(at(11, 0));
  faceBack(sign, 11, 0);
  worldRoot.add(sign);

  // ---- Themed skyline: the horizon past the plaza is never empty ----
  const place = (obj, along, lat, ry = true) => {
    obj.position.copy(at(along, lat));
    if (ry) faceBack(obj, along, lat);
    worldRoot.add(obj);
  };
  if (theme === 'city' || theme === 'downtown') {
    for (let i = 0; i < 6; i++) {
      const h = rng.range(theme === 'downtown' ? 12 : 8, theme === 'downtown' ? 26 : 17);
      place(makeBuilding(rng, M, facades[i % facades.length], rng.range(9, 15), rng.range(8, 12), h),
        rng.range(24, 40), (i % 2 ? 1 : -1) * rng.range(8, 30));
    }
    place(makeWaterTank(M), 30, rng.sign() * rng.range(16, 28));
  } else if (theme === 'farm') {
    place(makeBarn(rng, M), 26, -rng.range(10, 20));
    place(makeBarn(rng, M), 35, rng.range(12, 24));
    place(makeSilo(M), 24, rng.range(8, 14));
    place(makeSilo(M), 31, -rng.range(14, 22));
    for (let i = 0; i < 5; i++) {
      const bale = makeHayBale(M);
      place(bale, rng.range(14, 24), rng.sign() * rng.range(6, 18), false);
      bale.rotation.y = rng.range(0, Math.PI);
    }
  } else if (theme === 'fair') {
    const fw = makeFerrisWheel(rng, M);
    place(fw.group, 36, rng.sign() * rng.range(10, 22));
    anims.push(fw.update);
    for (let i = 0; i < 3; i++) place(makeTent(rng, M), rng.range(22, 33), rng.sign() * rng.range(8, 24));
    place(makeFoodStand(rng, M), 20, rng.sign() * rng.range(7, 12));
    const bc = makeBalloonCluster(rng, M);
    place(bc.group, 16, rng.sign() * rng.range(6, 10), false);
    anims.push((dt, time) => bc.update(time));
  } else { // industrial
    place(makeStorageBuilding(M), 28, -rng.range(8, 16));
    place(makeStorageBuilding(M), 36, rng.range(10, 22));
    place(makeWaterTank(M), 24, rng.range(8, 16));
    place(makeWaterTank(M), 33, -rng.range(14, 24));
    for (let i = 0; i < 3; i++) { // Libbey-style smokestacks
      const stack = new THREE.Group();
      const hh = rng.range(16, 26);
      addCyl(stack, 1.0, 1.5, hh, 0, hh / 2, 0, M.brickDark, 8);
      addCyl(stack, 1.2, 1.2, 0.9, 0, hh, 0, M.metal, 8);
      place(stack, rng.range(30, 44), rng.sign() * rng.range(12, 30));
    }
  }
}

// ================= MAIN WORLD BUILD =================
/**
 * levelData.world = {
 *   theme: 'city'|'downtown'|'farm'|'fair'|'industrial',
 *   ground: 'grass'|'dirt'|'concrete',
 *   roadWidth: number,
 *   structures: [{type, u, side(-1|1), dist, ry?}],  // placed along the rail
 *   riverSide: -1|1|null,
 * }
 */
export function buildWorld(scene, curve, levelData, rng) {
  const M = mats(levelData.world.theme);
  const anims = [];
  const worldRoot = new THREE.Group();
  scene.add(worldRoot);

  const w = levelData.world;
  const roadWidth = w.roadWidth || 10;

  // ---- Ground plane centered on the curve midpoint ----
  const mid = curve.getPointAt(0.5, new THREE.Vector3());
  const groundMat = w.ground === 'dirt' ? M.dirt : (w.ground === 'concrete' ? M.concreteTex : M.grass);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(mid.x, -0.05, mid.z);
  worldRoot.add(ground);

  // ---- Road + sidewalks ----
  const road = buildStrip(curve, { width: roadWidth, y: 0, mat: M.road, samples: 160, uvRepeatV: 40 });
  worldRoot.add(road);
  const swL = buildStrip(curve, { width: 3.2, offset: -(roadWidth / 2 + 1.6), y: 0.02, mat: M.sidewalk, samples: 160, uvRepeatV: 40 });
  const swR = buildStrip(curve, { width: 3.2, offset: roadWidth / 2 + 1.6, y: 0.02, mat: M.sidewalk, samples: 160, uvRepeatV: 40 });
  worldRoot.add(swL, swR);

  // ---- River (optional) ----
  if (w.riverSide) {
    const river = buildStrip(curve, { width: 16, offset: w.riverSide * (roadWidth / 2 + 9), y: -0.25, mat: M.water, samples: 160, uvRepeatV: 30 });
    worldRoot.add(river);
    anims.push((dt) => { M.water.map.offset.y -= dt * 0.03; });
  }

  // ---- Facade texture pool ----
  const facades = [];
  const FACADE_COLORS = ['#7a4a32', '#6e4430', '#83563c', '#5e3a28', '#8a8578', '#6b7a80', '#9c7a5a', '#7a6a58', '#84413a', '#5f6b74'];
  for (let i = 0; i < 12; i++) {
    facades.push(makeBuildingTexture(rng, FACADE_COLORS[i % FACADE_COLORS.length], rng.int(2, 5), rng.int(3, 5), 0.3));
  }
  const glassFacades = [];
  for (let i = 0; i < 4; i++) glassFacades.push(makeGlassTowerTexture(rng, rng.int(6, 9), rng.int(3, 5), 0.2));

  // ---- Solid footprint registry ----
  // Level structures are placed FIRST; buildings and props skip any spot whose
  // world-space Box3 overlaps something solid, so nothing spawns clipped inside.
  const solidBoxes = [];
  const _probe = new THREE.Box3();
  const _test = new THREE.Box3();
  const rememberSolid = (obj) => { _probe.setFromObject(obj); solidBoxes.push(_probe.clone()); };
  const hitsSolid = (obj, margin = 0) => {
    _test.setFromObject(obj);
    if (margin > 0) _test.expandByScalar(-margin);
    return solidBoxes.some((b) => b.intersectsBox(_test));
  };
  // ---- Road clearance guard: no footprint may intrude into the roadway ----
  // Overhead-only structures (box entirely above head height) are exempt via
  // crossesRoad; buildings and street-level props are checked with wallsRoad.
  const _roadPts = [];
  for (let i = 0; i <= 160; i++) _roadPts.push(curve.getPointAt(i / 160, new THREE.Vector3()));
  const _rc = new THREE.Box3(), _corner = new THREE.Vector3();
  // Corner-to-road-polyline distance (XZ). Measuring against the segments, not
  // just the sample points, keeps a tight bend from hiding asphalt from the guard.
  const _nearRoad = (pt, reach) => {
    const r2 = reach * reach;
    for (let i = 0; i < _roadPts.length - 1; i++) {
      const a = _roadPts[i], b = _roadPts[i + 1];
      const abx = b.x - a.x, abz = b.z - a.z;
      const px = pt.x - a.x, pz = pt.z - a.z;
      const len2 = abx * abx + abz * abz;
      const s = len2 > 0 ? Math.max(0, Math.min(1, (px * abx + pz * abz) / len2)) : 0;
      const dx = px - abx * s, dz = pz - abz * s;
      if (dx * dx + dz * dz < r2) return true;
    }
    return false;
  };
  const footprintHitsRoad = (obj, extra) => {
    obj.updateMatrixWorld(true);
    _rc.setFromObject(obj);
    const reach = roadWidth / 2 + extra;
    for (let cx = 0; cx < 2; cx++) {
      for (let cz = 0; cz < 2; cz++) {
        _corner.set(cx ? _rc.max.x : _rc.min.x, 0, cz ? _rc.max.z : _rc.min.z);
        if (_nearRoad(_corner, reach)) return true;
      }
    }
    return false;
  };
  const crossesRoad = (obj, extra = 0.4) => {
    obj.updateMatrixWorld(true);
    _rc.setFromObject(obj);
    if (_rc.max.y > 2.6) return false; // pass under, not across
    return footprintHitsRoad(obj, extra);
  };
  // Height-blind: a footprint on the asphalt walls the street off no matter how
  // tall the object is, so buildings, structures and props are checked with this.
  const wallsRoad = (obj, extra = 0.3) => footprintHitsRoad(obj, extra);
  const p = new THREE.Vector3(), t = new THREE.Vector3(), right = new THREE.Vector3();
  // Drops obj at (u, side, dist), facing the road, then slides it outward until
  // it clears the asphalt and everything already placed. false = no spot works.
  const placeClear = (obj, u, side, dist, opts = {}) => {
    const { ry = null, margin = 0.3, push = 2.4, tries = 6, solidMargin = 0.3 } = opts;
    curve.getPointAt(u, p);
    curve.getTangentAt(u, t);
    right.set(-t.z, 0, t.x).normalize();
    const yaw = ry === 'tangent' ? Math.atan2(t.x, t.z) : ry;
    let dd = dist;
    for (let i = 0; i <= tries; i++) {
      obj.position.set(p.x - right.x * side * dd, opts.y ?? 0, p.z - right.z * side * dd);
      obj.rotation.y = yaw != null ? yaw : Math.atan2(p.x - obj.position.x, p.z - obj.position.z);
      if (!wallsRoad(obj, margin) && !hitsSolid(obj, solidMargin)) return true;
      dd += push;
    }
    return false;
  };

  // ---- Placed structures (from level data) ----
  for (const s of w.structures || []) {
    const dist = s.dist || (roadWidth / 2 + 12);
    let obj = null, update = null;
    switch (s.type) {
      case 'feedstore': obj = makeFeedStore(rng, M); break;
      case 'gasstation': obj = makeGasStation(rng, M); break;
      case 'carwash': obj = makeCarWash(rng, M); update = (dt) => { for (const k of ['arch0', 'arch1', 'arch2']) if (obj.userData[k]) obj.userData[k].rotation.x += dt * 2; }; break;
      case 'ferriswheel': { const fw = makeFerrisWheel(rng, M); obj = fw.group; update = fw.update; break; }
      case 'tent': obj = makeTent(rng, M); break;
      case 'foodstand': obj = makeFoodStand(rng, M); break;
      case 'carnivalgame': obj = makeCarnivalGame(rng, M); break;
      case 'barn': obj = makeBarn(rng, M); break;
      case 'silo': obj = makeSilo(M); break;
      case 'storefront': obj = makeStorefront(rng, M, s.text || 'GENERAL STORE'); break;
      case 'policecar': obj = makePoliceCar(M); break;
      case 'truck': obj = makeTruck(M, rng.pick([0x8a6a42, 0xb03a3a, 0x5e7a4a])); break;
      case 'sign': obj = makeJokeSign(s.text || '', s.sub || null, M, s.w || 4); break;
      case 'trafficlight': obj = makeTrafficLight(M); break;
    }
    if (!obj) continue;
    // Face toward the road unless a custom ry is given; slide outward if the
    // footprint would wall off the roadway (sharp bends pull the road sideways).
    if (!placeClear(obj, s.u, s.side, dist, { ry: s.ry ?? null, margin: 0.3 })) continue;
    worldRoot.add(obj);
    rememberSolid(obj);
    if (update) anims.push(update);
  }

  // ---- Toledo landmarks (stylized real Glass City structures) ----
  placeLandmarks({ theme: w.theme, rng, M, curve, roadWidth, riverSide: w.riverSide || 0, worldRoot, anims, rememberSolid, hitsSolid, roadCheck: crossesRoad, wallCheck: wallsRoad });

  // ---- Buildings along both sides ----
  let bi = 0;
  for (let u = 0.03; u < 0.985; u += 0.042) {
    for (const side of [-1, 1]) {
      if (rng.chance(0.18)) continue; // gaps / lots
      const dist = roadWidth / 2 + 3.2 + rng.range(4, 8);
      const bw = rng.range(8, 14), bd = rng.range(7, 11);
      const bh = (w.theme === 'downtown' ? rng.int(3, 6) : rng.int(2, 3)) * 4.2;
      const tex = (w.theme === 'downtown' && rng.chance(0.45))
        ? glassFacades[bi++ % glassFacades.length]
        : facades[bi++ % facades.length];
      const b = makeBuilding(rng, M, tex, bw, bd, bh);
      // Facade (+z) faces the road; slide out until the lot clears the asphalt,
      // never build on top of a structure or neighbor.
      if (!placeClear(b, u, side, dist, { margin: 0.4, solidMargin: 0.6 })) continue;
      worldRoot.add(b);
      rememberSolid(b);
    }
  }

  // ---- Streetlights + utility poles ----
  for (let u = 0.02; u < 0.98; u += 0.05) {
    curve.getPointAt(u, p);
    curve.getTangentAt(u, t);
    right.set(-t.z, 0, t.x).normalize();
    const side = Math.round(u * 100) % 2 === 0 ? -1 : 1;
    const d = roadWidth / 2 + 2.2;
    const sl = makeStreetlight(M);
    sl.position.set(p.x - right.x * side * d, 0, p.z - right.z * side * d);
    sl.rotation.y = Math.atan2(right.x * side, right.z * side);
    if (!hitsSolid(sl, 0.3) && !wallsRoad(sl, 0)) worldRoot.add(sl);
    if (rng.chance(0.3)) {
      const up = makeUtilityPole(M);
      up.position.set(p.x + right.x * side * d, 0, p.z + right.z * side * d);
      if (!hitsSolid(up, 0.3) && !wallsRoad(up, 0)) worldRoot.add(up);
    }
  }

  // ---- Street furniture: hydrants + trash cans enliven sidewalks ----
  if (w.theme === 'city' || w.theme === 'downtown' || w.theme === 'fair') {
    for (let u = 0.03; u < 0.97; u += rng.range(0.05, 0.09)) {
      curve.getPointAt(u, p);
      curve.getTangentAt(u, t);
      right.set(-t.z, 0, t.x).normalize();
      const side = rng.sign();
      const d = roadWidth / 2 + rng.range(1.6, 2.6);
      let prop = null;
      if (rng.chance(0.45)) {
        prop = new THREE.Group();
        addCyl(prop, 0.16, 0.2, 0.72, 0, 0.36, 0, M.red, 7);
        addBox(prop, 0.5, 0.12, 0.12, 0, 0.56, 0, M.red);
        addCyl(prop, 0.1, 0.1, 0.18, 0, 0.8, 0, M.red, 6);
      } else {
        prop = new THREE.Group();
        const canMat = rng.chance(0.5) ? M.darkMetal
          : new THREE.MeshLambertMaterial({ color: 0x3a5a4a, flatShading: true });
        addCyl(prop, 0.3, 0.34, 0.85, 0, 0.42, 0, canMat, 8);
        addBox(prop, 0.66, 0.08, 0.66, 0, 0.88, 0, M.darkMetal);
      }
      prop.position.set(p.x - right.x * side * d, 0, p.z - right.z * side * d);
      prop.rotation.y = Math.atan2(t.x, t.z);
      if (!hitsSolid(prop, 0.15) && !crossesRoad(prop, 0.3)) { worldRoot.add(prop); rememberSolid(prop); }
    }
  }

  // ---- Parked cars on shoulders ----
  const carColors = [0xb03a3a, 0x3a5a8a, 0xd8d890, 0x6a6a72, 0x4a7a4a, 0xc28a3a];
  for (let u = 0.05; u < 0.97; u += rng.range(0.06, 0.1)) {
    if (rng.chance(0.5)) continue;
    curve.getPointAt(u, p);
    curve.getTangentAt(u, t);
    right.set(-t.z, 0, t.x).normalize();
    const side = rng.sign();
    const rotated = rng.chance(0.3);
    const d = roadWidth / 2 + (rotated ? 3.6 : 1.4); // rotated cars lie sideways: keep further out
    const car = makeCar(M, rng.pick(carColors));
    car.position.set(p.x - right.x * side * d, 0, p.z - right.z * side * d);
    car.rotation.y = Math.atan2(t.x, t.z) + (rotated ? Math.PI / 2 : 0);
    if (!hitsSolid(car, 0.3) && !crossesRoad(car, 0.3)) worldRoot.add(car);
  }

  // ---- Theme extras ----
  if (w.theme === 'city' || w.theme === 'downtown') {
    // Park trees on one side
    for (let u = 0.1; u < 0.9; u += 0.08) {
      if (rng.chance(0.4)) continue;
      // City: keep trees on the dry side of the river.
      const side = w.theme === 'city' && w.riverSide ? -w.riverSide : rng.sign();
      const d = roadWidth / 2 + (w.riverSide === side ? 14 : 5) + rng.range(0, 3);
      const tree = makeTree(rng, M);
      if (placeClear(tree, u, side, d, { ry: 0, margin: 0.4, solidMargin: 0.4 })) worldRoot.add(tree);
    }
    if (w.theme === 'city' && w.riverSide) {
      // Bridge spans the river: deck crosses the road direction (narrow along
      // the tangent), placed clear of the roadway, piers in the water.
      curve.getPointAt(0.12, p);
      curve.getTangentAt(0.12, t);
      right.set(-t.z, 0, t.x).normalize();
      const bridge = new THREE.Group();
      addBox(bridge, 9, 0.7, 20, 0, 0.75, 0, M.concreteTex);
      addBox(bridge, 0.6, 0.9, 20, -4.2, 1.35, 0, M.concrete);
      addBox(bridge, 0.6, 0.9, 20, 4.2, 1.35, 0, M.concrete);
      addBox(bridge, 1.4, 2.4, 1.4, 0, 0.1, -5.5, M.concrete);
      addBox(bridge, 1.4, 2.4, 1.4, 0, 0.1, 5.5, M.concrete);
      bridge.position.set(
        p.x - right.x * w.riverSide * (roadWidth / 2 + 12), 0.35,
        p.z - right.z * w.riverSide * (roadWidth / 2 + 12)
      );
      bridge.rotation.y = Math.atan2(right.x, right.z);
      if (!hitsSolid(bridge, 0.5) && !crossesRoad(bridge, 0.8)) { worldRoot.add(bridge); rememberSolid(bridge); }
    }
  }

  if (w.theme === 'farm') {
    // Fences, hay bales, fields on both sides
    for (let u = 0.06; u < 0.95; u += 0.12) {
      for (const side of [-1, 1]) {
        if (rng.chance(0.3)) continue;
        const d = roadWidth / 2 + 6;
        const f = makeFence(rng.range(10, 18), M);
        if (placeClear(f, u, side, d, { ry: 'tangent', margin: 0.4, solidMargin: 0.3 })) worldRoot.add(f);
        const hb = makeHayBale(M);
        if (placeClear(hb, u, side, d + 3, { ry: 0, margin: 0.4, solidMargin: 0.2 })) worldRoot.add(hb);
      }
    }
    // Scattered trees
    for (let i = 0; i < 14; i++) {
      const u = rng.range(0.05, 0.95);
      const side = rng.sign();
      const d = roadWidth / 2 + rng.range(12, 30);
      const tree = makeTree(rng, M);
      if (placeClear(tree, u, side, d, { ry: 0, margin: 0.4, solidMargin: 0.4 })) worldRoot.add(tree);
    }
  }

  if (w.theme === 'fair') {
    // Dirt parking + tents/stands scattered wide
    for (let i = 0; i < 10; i++) {
      const u = rng.range(0.08, 0.92);
      const side = rng.sign();
      const d = roadWidth / 2 + rng.range(10, 26);
      const thing = rng.pick(['tent', 'food', 'game', 'balloon']);
      if (thing === 'tent') {
        const tnt = makeTent(rng, M);
        if (placeClear(tnt, u, side, d, { margin: 0.4, solidMargin: 0.4 })) worldRoot.add(tnt);
      } else if (thing === 'food') {
        const fs = makeFoodStand(rng, M);
        if (placeClear(fs, u, side, d, { margin: 0.4, solidMargin: 0.4 })) worldRoot.add(fs);
      } else if (thing === 'game') {
        const cg = makeCarnivalGame(rng, M);
        if (placeClear(cg, u, side, d, { margin: 0.4, solidMargin: 0.4 })) worldRoot.add(cg);
      } else {
        const bc = makeBalloonCluster(rng, M);
        if (placeClear(bc.group, u, side, d + 2, { ry: 0, margin: 0.4, solidMargin: 0.2 })) {
          worldRoot.add(bc.group);
          anims.push((dt, time) => bc.update(time));
        }
      }
    }
    // Animal pens
    for (let i = 0; i < 4; i++) {
      const u = rng.range(0.15, 0.85);
      const side = rng.sign();
      const d = roadWidth / 2 + rng.range(14, 22);
      const pen = makePen(M);
      if (placeClear(pen, u, side, d, { ry: 'tangent', margin: 0.4, solidMargin: 0.4 })) worldRoot.add(pen);
    }
  }

  if (w.theme === 'industrial') {
    for (let i = 0; i < 6; i++) {
      const u = rng.range(0.1, 0.9);
      const side = rng.sign();
      const d = roadWidth / 2 + rng.range(12, 24);
      const thing = rng.pick(['tank', 'storage', 'drainage']);
      if (thing === 'tank') {
        const tk = makeWaterTank(M);
        if (placeClear(tk, u, side, d, { ry: 0, margin: 0.4, solidMargin: 0.4 })) worldRoot.add(tk);
      } else if (thing === 'storage') {
        const sb = makeStorageBuilding(M);
        if (placeClear(sb, u, side, d, { ry: 'tangent', margin: 0.4, solidMargin: 0.4 })) worldRoot.add(sb);
      } else {
        const dr = makeDrainageChannel(M);
        if (placeClear(dr, u, side, d + 4, { ry: 'tangent', margin: 0.3, solidMargin: 0.3 })) worldRoot.add(dr);
      }
    }
  }

  // ---- The dead-end finale: a lit last-stand plaza past the terminus ----
  buildEndcap({ w, rng, M, curve, roadWidth, worldRoot, anims, facades });

  return { root: worldRoot, anims, solidBoxes };
}

export function clearWorld(scene, world) {
  if (!world) return;
  disposeTree(world.root);
  scene.remove(world.root);
  resetMatCache();
}
