import * as THREE from 'three';
import { addBox, addCyl, makePrism, buildStrip, disposeTree } from './geometry.js';
import {
  makeBuildingTexture, makeRoadTexture, makeSidewalkTexture, makeGrassTexture,
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
  const sideMat = new THREE.MeshLambertMaterial({ color: 0x6a4230, flatShading: true });
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
  // Storefront awning on the facade (+z) sometimes
  if (rng.chance(0.6)) {
    const aw = addBox(g, w * 0.8, 0.3, 1.4, 0, 3.4, d / 2 + 0.7,
      new THREE.MeshLambertMaterial({ map: makeStripeTexture(
        rng.pick(['#c23a3a', '#3a5a8a', '#b03a7a', '#d8b83e']), '#f0ead8'), flatShading: true }));
    aw.rotation.x = 0.18;
  }
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
  for (let i = 0; i < 10; i++) {
    facades.push(makeBuildingTexture(rng, rng.pick(['#7a4a32', '#6e4430', '#83563c', '#5e3a28']),
      rng.int(2, 4), rng.int(3, 5), 0.3));
  }

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
  const p = new THREE.Vector3(), t = new THREE.Vector3(), right = new THREE.Vector3();

  // ---- Placed structures (from level data) ----
  for (const s of w.structures || []) {
    curve.getPointAt(s.u, p);
    curve.getTangentAt(s.u, t);
    right.set(-t.z, 0, t.x).normalize();
    const dist = s.dist || (roadWidth / 2 + 12);
    const x = p.x - right.x * s.side * dist;
    const z = p.z - right.z * s.side * dist;
    let obj = null, update = null;
    switch (s.type) {
      case 'feedstore': obj = makeFeedStore(rng, M); break;
      case 'gasstation': obj = makeGasStation(rng, M); break;
      case 'carwash': obj = makeCarWash(rng, M); update = (dt) => { for (const k of ['arch0', 'arch1', 'arch2']) if (obj.userData[k]) obj.userData[k].rotation.x += dt * 2; }; break;
      case 'ferriswheel': { const fw = makeFerrisWheel(rng, M); obj = fw.group; update = fw.update; break; }
      case 'barn': obj = makeBarn(rng, M); break;
      case 'silo': obj = makeSilo(M); break;
      case 'storefront': obj = makeStorefront(rng, M, s.text || 'GENERAL STORE'); break;
      case 'policecar': obj = makePoliceCar(M); break;
      case 'truck': obj = makeTruck(M, rng.pick([0x8a6a42, 0xb03a3a, 0x5e7a4a])); break;
      case 'sign': obj = makeJokeSign(s.text || '', s.sub || null, M, s.w || 4); break;
      case 'trafficlight': obj = makeTrafficLight(M); break;
    }
    if (!obj) continue;
    // Face toward road unless a custom ry is given.
    const fx = p.x - x, fz = p.z - z;
    obj.rotation.y = s.ry != null ? s.ry : Math.atan2(fx, fz);
    obj.position.set(x, 0, z);
    worldRoot.add(obj);
    rememberSolid(obj);
    if (update) anims.push(update);
  }

  // ---- Buildings along both sides ----
  let bi = 0;
  for (let u = 0.03; u < 0.985; u += 0.042) {
    for (const side of [-1, 1]) {
      if (rng.chance(0.18)) continue; // gaps / lots
      curve.getPointAt(u, p);
      curve.getTangentAt(u, t);
      right.set(-t.z, 0, t.x).normalize();
      const dist = roadWidth / 2 + 3.2 + rng.range(4, 8);
      const bx = p.x - right.x * side * dist;
      const bz = p.z - right.z * side * dist;
      const bw = rng.range(8, 14), bd = rng.range(7, 11);
      const bh = (w.theme === 'downtown' ? rng.int(3, 5) : rng.int(2, 3)) * 4.2;
      const b = makeBuilding(rng, M, facades[bi++ % facades.length], bw, bd, bh);
      // Face facade (+z) toward the road center.
      const fx = p.x - bx, fz = p.z - bz;
      b.rotation.y = Math.atan2(fx, fz);
      b.position.set(bx, 0, bz);
      if (hitsSolid(b, 0.6)) continue; // never build on top of a structure or neighbor
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
    if (!hitsSolid(sl, 0.3)) worldRoot.add(sl);
    if (rng.chance(0.3)) {
      const up = makeUtilityPole(M);
      up.position.set(p.x + right.x * side * d, 0, p.z + right.z * side * d);
      if (!hitsSolid(up, 0.3)) worldRoot.add(up);
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
    const d = roadWidth / 2 + 1.4;
    const car = makeCar(M, rng.pick(carColors));
    car.position.set(p.x - right.x * side * d, 0, p.z - right.z * side * d);
    car.rotation.y = Math.atan2(t.x, t.z) + (rng.chance(0.3) ? Math.PI / 2 : 0);
    if (!hitsSolid(car, 0.3)) worldRoot.add(car);
  }

  // ---- Theme extras ----
  if (w.theme === 'city' || w.theme === 'downtown') {
    // Park trees on one side
    for (let u = 0.1; u < 0.9; u += 0.08) {
      if (rng.chance(0.4)) continue;
      curve.getPointAt(u, p);
      curve.getTangentAt(u, t);
      right.set(-t.z, 0, t.x).normalize();
      // City: keep trees on the dry side of the river.
      const side = w.theme === 'city' && w.riverSide ? -w.riverSide : rng.sign();
      const d = roadWidth / 2 + (w.riverSide === side ? 14 : 5) + rng.range(0, 3);
      const tree = makeTree(rng, M);
      tree.position.set(p.x - right.x * side * d, 0, p.z - right.z * side * d);
      if (!hitsSolid(tree, 0.4)) worldRoot.add(tree);
    }
    if (w.theme === 'city' && w.riverSide) {
      // Bridge over the river near the start
      curve.getPointAt(0.12, p);
      curve.getTangentAt(0.12, t);
      right.set(-t.z, 0, t.x).normalize();
      const bridge = new THREE.Group();
      addBox(bridge, roadWidth + 8, 0.6, 14, 0, 0.5, 0, M.concreteTex);
      addBox(bridge, roadWidth + 8, 0.8, 0.5, 0, 1.2, -7, M.concrete);
      addBox(bridge, roadWidth + 8, 0.8, 0.5, 0, 1.2, 7, M.concrete);
      bridge.position.set(p.x - right.x * w.riverSide * (roadWidth / 2 + 9), 0, p.z - right.z * w.riverSide * (roadWidth / 2 + 9));
      bridge.rotation.y = Math.atan2(right.x, right.z);
      if (!hitsSolid(bridge, 0.5)) worldRoot.add(bridge);
    }
  }

  if (w.theme === 'farm') {
    // Fences, hay bales, fields on both sides
    for (let u = 0.06; u < 0.95; u += 0.12) {
      curve.getPointAt(u, p);
      curve.getTangentAt(u, t);
      right.set(-t.z, 0, t.x).normalize();
      for (const side of [-1, 1]) {
        if (rng.chance(0.3)) continue;
        const d = roadWidth / 2 + 6;
        const f = makeFence(rng.range(10, 18), M);
        f.position.set(p.x - right.x * side * d, 0, p.z - right.z * side * d);
        f.rotation.y = Math.atan2(t.x, t.z);
        if (!hitsSolid(f, 0.3)) worldRoot.add(f);
        const hb = makeHayBale(M);
        hb.position.set(p.x - right.x * side * (d + 3), 0, p.z - right.z * side * (d + 3));
        if (!hitsSolid(hb, 0.2)) worldRoot.add(hb);
      }
    }
    // Scattered trees
    for (let i = 0; i < 14; i++) {
      const u = rng.range(0.05, 0.95);
      curve.getPointAt(u, p);
      curve.getTangentAt(u, t);
      right.set(-t.z, 0, t.x).normalize();
      const side = rng.sign();
      const d = roadWidth / 2 + rng.range(12, 30);
      const tree = makeTree(rng, M);
      tree.position.set(p.x - right.x * side * d, 0, p.z - right.z * side * d);
      if (!hitsSolid(tree, 0.4)) worldRoot.add(tree);
    }
  }

  if (w.theme === 'fair') {
    // Dirt parking + tents/stands scattered wide
    for (let i = 0; i < 10; i++) {
      const u = rng.range(0.08, 0.92);
      curve.getPointAt(u, p);
      curve.getTangentAt(u, t);
      right.set(-t.z, 0, t.x).normalize();
      const side = rng.sign();
      const d = roadWidth / 2 + rng.range(10, 26);
      const thing = rng.pick(['tent', 'food', 'game', 'balloon']);
      if (thing === 'tent') {
        const tnt = makeTent(rng, M);
        tnt.position.set(p.x - right.x * side * d, 0, p.z - right.z * side * d);
        if (!hitsSolid(tnt, 0.4)) worldRoot.add(tnt);
      } else if (thing === 'food') {
        const fs = makeFoodStand(rng, M);
        fs.position.set(p.x - right.x * side * d, 0, p.z - right.z * side * d);
        fs.rotation.y = Math.atan2(right.x * side, right.z * side);
        if (!hitsSolid(fs, 0.4)) worldRoot.add(fs);
      } else if (thing === 'game') {
        const cg = makeCarnivalGame(rng, M);
        cg.position.set(p.x - right.x * side * d, 0, p.z - right.z * side * d);
        cg.rotation.y = Math.atan2(right.x * side, right.z * side);
        if (!hitsSolid(cg, 0.4)) worldRoot.add(cg);
      } else {
        const bc = makeBalloonCluster(rng, M);
        bc.group.position.set(p.x - right.x * side * (d + 2), 0, p.z - right.z * side * (d + 2));
        if (!hitsSolid(bc.group, 0.2)) {
          worldRoot.add(bc.group);
          anims.push((dt, time) => bc.update(time));
        }
      }
    }
    // Animal pens
    for (let i = 0; i < 4; i++) {
      const u = rng.range(0.15, 0.85);
      curve.getPointAt(u, p);
      curve.getTangentAt(u, t);
      right.set(-t.z, 0, t.x).normalize();
      const side = rng.sign();
      const d = roadWidth / 2 + rng.range(14, 22);
      const pen = makePen(M);
      pen.position.set(p.x - right.x * side * d, 0, p.z - right.z * side * d);
      pen.rotation.y = Math.atan2(t.x, t.z);
      if (!hitsSolid(pen, 0.4)) worldRoot.add(pen);
    }
  }

  if (w.theme === 'industrial') {
    for (let i = 0; i < 6; i++) {
      const u = rng.range(0.1, 0.9);
      curve.getPointAt(u, p);
      curve.getTangentAt(u, t);
      right.set(-t.z, 0, t.x).normalize();
      const side = rng.sign();
      const d = roadWidth / 2 + rng.range(12, 24);
      const thing = rng.pick(['tank', 'storage', 'drainage']);
      if (thing === 'tank') {
        const tk = makeWaterTank(M);
        tk.position.set(p.x - right.x * side * d, 0, p.z - right.z * side * d);
        if (!hitsSolid(tk, 0.4)) worldRoot.add(tk);
      } else if (thing === 'storage') {
        const sb = makeStorageBuilding(M);
        sb.position.set(p.x - right.x * side * d, 0, p.z - right.z * side * d);
        sb.rotation.y = Math.atan2(t.x, t.z);
        if (!hitsSolid(sb, 0.4)) worldRoot.add(sb);
      } else {
        const dr = makeDrainageChannel(M);
        dr.position.set(p.x - right.x * side * (d + 4), 0, p.z - right.z * side * (d + 4));
        dr.rotation.y = Math.atan2(t.x, t.z);
        if (!hitsSolid(dr, 0.3)) worldRoot.add(dr);
      }
    }
  }

  return { root: worldRoot, anims, solidBoxes };
}

export function clearWorld(scene, world) {
  if (!world) return;
  disposeTree(world.root);
  scene.remove(world.root);
  resetMatCache();
}
