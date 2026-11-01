// Stylized Toledo landmarks — real Glass City structures built from primitives.
// Placed by ProceduralWorld per theme; every landmark remembers its footprint
// so procedural buildings never grow through it.
import * as THREE from 'three';
import { makeSignTexture, makeBuildingTexture } from './textures.js';

const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const cyl = (rT, rB, h, m, seg = 10) => new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, h, seg), m);
const sph = (r, m, seg = 10) => new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), m);
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

function signMesh(text, w, h, opts = {}) {
  const { bg = '#1c2733', fg = '#ffd23e', sub = null } = opts;
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: makeSignTexture(text, bg, fg, sub), transparent: true })
  );
  return plane;
}

// ---------------------------------------------------------------- landmarks

// Toledo Museum of Art — Greek Revival peristyle, steps, pediment.
export function makeMuseumOfArt(M) {
  const g = new THREE.Group();
  const stone = M.white, dark = M.concrete;
  for (let i = 0; i < 3; i++) g.add(at(box(20 + i * 2.4, 0.45, 11 + i * 2, dark), 0, 0.22 + i * 0.45, 0));
  for (let i = 0; i < 8; i++) g.add(at(cyl(0.55, 0.62, 6.4, stone, 8), -8.4 + i * 2.4, 3.9, 4.4));
  g.add(at(box(19.5, 1.1, 10.5, stone), 0, 7.55, 0));
  const ped = cyl(3.2, 3.2, 10.2, stone, 3); // triangular prism
  ped.rotation.x = Math.PI / 2;
  ped.scale.x = 1.95; // widen into a low pediment
  g.add(at(ped, 0, 9.3, 0));
  g.add(at(box(17, 5.4, 9, M.brickDark), 0, 4.4, -2.2)); // inner hall behind columns
  for (let i = 0; i < 5; i++) g.add(at(box(1.6, 2.6, 0.15, M.glass), -6.4 + i * 3.2, 4.2, -2.28));
  g.add(at(signMesh('TOLEDO MUSEUM\nOF ART', 4.6, 2.3, { fg: '#e8e4d8' }), 0, 3.4, 5.1));
  return g;
}

// Reflecting pool in front of the museum.
export function makeReflectingPool(M) {
  const g = new THREE.Group();
  g.add(at(box(15, 0.3, 7, M.concrete), 0, 0.02, 0));
  const water = at(box(13.6, 0.2, 5.8, M.water), 0, 0.12, 0);
  g.add(water);
  return g;
}

// Antonio Tubini's "The Olympians" — six muscular guardians flanking the museum plaza.
export function makeOlympians(M) {
  const g = new THREE.Group();
  const stone = new THREE.MeshLambertMaterial({ color: 0xd8d2c4, flatShading: true });
  for (let i = 0; i < 6; i++) {
    const x = -7.5 + i * 3;
    const p = new THREE.Group();
    p.add(at(box(1.3, 0.9, 1.3, M.concrete), 0, 0.45, 0));
    p.add(at(box(0.75, 1.5, 0.5, stone), 0, 1.7, 0));
    p.add(at(box(0.34, 1.15, 0.34, stone), -0.26, 0.7 + 0.6, 0));
    p.add(at(box(0.34, 1.15, 0.34, stone), 0.26, 0.7 + 0.6, 0));
    p.add(at(sph(0.34, stone, 8), 0, 2.65, 0));
    p.add(at(box(1.1, 0.34, 0.42, stone), 0, 2.28, 0)); // shoulder bar
    p.position.x = x;
    g.add(p);
  }
  return g;
}

// Toledo Zoo's iconic lion fountain.
export function makeLionFountain(M) {
  const g = new THREE.Group();
  g.add(at(cyl(3.2, 3.4, 0.7, M.concrete, 12), 0, 0.35, 0));
  g.add(at(cyl(2.7, 2.7, 0.16, M.water, 12), 0, 0.68, 0));
  g.add(at(box(1.5, 1.4, 1.1, M.concrete), 0, 1.05, 0));
  const fur = new THREE.MeshLambertMaterial({ color: 0xb08a4a, flatShading: true });
  const mane = new THREE.MeshLambertMaterial({ color: 0x6e4c26, flatShading: true });
  g.add(at(box(2.1, 0.95, 0.8, fur), 0, 2.2, 0));
  g.add(at(box(0.75, 0.75, 0.7, mane), 1.25, 2.6, 0));
  g.add(at(box(0.3, 0.28, 0.22, fur), 1.6, 2.35, 0)); // muzzle
  g.add(at(cyl(0.12, 0.14, 0.7, fur, 6), -1.15, 2.35, 0.4)); // tail hint
  const jets = new THREE.Group();
  const jetMat = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.75 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const j = at(cyl(0.09, 0.05, 1.5, jetMat, 5), Math.cos(a) * 1.8, 1.4, Math.sin(a) * 1.8);
    j.rotation.z = Math.cos(a) * 0.25;
    j.rotation.x = -Math.sin(a) * 0.25;
    jets.add(j);
  }
  g.add(jets);
  g.userData.animate = (t) => { jets.scale.y = 0.85 + 0.25 * Math.sin(t * 6.2); };
  return g;
}

// Five Points interchange — the famous double spiral ramp.
export function makeFivePointsTower(M) {
  const g = new THREE.Group();
  const concrete = M.concrete, dark = M.concreteTex;
  g.add(at(cyl(2.4, 2.8, 13, concrete, 12), 0, 6.5, 0));
  for (let i = 0; i < 5; i++) {
    const ramp = new THREE.Mesh(
      new THREE.TorusGeometry(6.5 + i * 0.3, 1.15, 6, 22),
      i % 2 ? dark : concrete
    );
    ramp.rotation.x = Math.PI / 2;
    ramp.position.set(Math.cos(i * 1.9) * 1.1, 2.6 + i * 2.35, Math.sin(i * 1.9) * 1.1);
    g.add(ramp);
  }
  g.add(at(signMesh('FIVE POINTS\nINTERCHANGE', 4.4, 2.2, { fg: '#ffd23e', sub: 'FIVE ROADS. ONE MESS.' }), 0, 3.2, 3.4));
  return g;
}

// University of Toledo — Walbridge Hall tower.
export function makeWalbridgeHall(M) {
  const g = new THREE.Group();
  g.add(at(box(22, 7.5, 10, M.brick), 0, 3.75, 0));
  for (let i = 0; i < 6; i++) g.add(at(box(1.5, 3, 0.16, M.glass), -8.5 + i * 3.4, 4.3, -5.05));
  g.add(at(box(23, 1.2, 11, M.roof), 0, 8.1, 0));
  g.add(at(box(5.2, 15, 5.2, M.brickDark), 0, 8.5, -1));
  const spire = cyl(0.15, 2.4, 5.4, M.roof, 4);
  g.add(at(spire, 0, 18.7, -1));
  const face = cyl(1.3, 1.3, 0.25, M.white, 12);
  face.rotation.x = Math.PI / 2;
  g.add(at(face, 0, 14.2, -3.75));
  g.add(at(box(0.16, 0.9, 0.12, M.darkMetal), 0, 14.6, -3.95));
  g.add(at(box(0.55, 0.16, 0.12, M.darkMetal), 0.2, 14.2, -3.95));
  g.add(at(signMesh('U TOLEDO', 3.6, 1.8, { fg: '#4cc3ff', bg: '#12304a' }), 0, 3, 5.2));
  return g;
}

// Libbey Glass works — factory, stack, glowing furnaces.
export function makeGlassWorks(M) {
  const g = new THREE.Group();
  g.add(at(box(20, 9, 13, M.brickDark), 0, 4.5, 0));
  g.add(at(box(21, 1, 14, M.metal), 0, 9.5, 0));
  g.add(at(cyl(1.5, 1.8, 21, M.brick, 10), 7.5, 10.5, -3));
  const furnaceMat = new THREE.MeshBasicMaterial({ color: 0xff9a3e });
  const glow = new THREE.Group();
  for (let i = 0; i < 3; i++) glow.add(at(box(2.6, 2.2, 0.16, furnaceMat), -6 + i * 5.5, 2.6, -6.6));
  g.add(glow);
  g.add(at(box(8, 5, 8, M.metal), -8, 2.5, -6)); // shed
  g.add(at(signMesh('GLASS WORKS\nLIBBEY FOUNDRY', 5, 2.5, { fg: '#ffb04a', sub: 'EST. 1885' }), 0, 6.6, -6.65));
  g.userData.animate = (t) => {
    furnaceMat.color.setRGB(1, 0.55 + 0.1 * Math.sin(t * 3.1), 0.2 + 0.08 * Math.sin(t * 2.3));
  };
  return g;
}

// "GLASS CITY" neon banner.
export function makeGlassCitySign(M) {
  const g = new THREE.Group();
  g.add(at(box(0.5, 7.5, 0.5, M.darkMetal), -2.6, 3.75, 0));
  g.add(at(box(0.5, 7.5, 0.5, M.darkMetal), 2.6, 3.75, 0));
  const neonMat = new THREE.MeshBasicMaterial({ color: 0x8fe8ff });
  const banner = at(box(6.4, 2.1, 0.35, neonMat), 0, 8.2, 0);
  g.add(banner);
  const caption = at(signMesh('TOLEDO', 3.4, 1.3, { fg: '#8fe8ff', bg: '#08131d' }), 0, 5.9, 0.3);
  g.add(caption);
  g.userData.animate = (t) => {
    const flick = 0.72 + 0.28 * Math.abs(Math.sin(t * 2.4)) + (Math.sin(t * 19) > 0.985 ? -0.4 : 0);
    banner.scale.setScalar(1);
    neonMat.color.setRGB(0.35 * flick + 0.2, 0.78 * flick + 0.25, 1 * flick + 0.15);
  };
  return g;
}

// Toledo Mud Hens ballpark — octagonal seats, field, scoreboard.
export function makeMudHensField(M) {
  const g = new THREE.Group();
  g.add(at(cyl(8.6, 8.6, 0.2, M.grass, 8), 0, 0.1, 0));
  g.add(at(cyl(5.6, 5.6, 0.24, M.leaf, 8), 0, 0.12, 0)); // infield dirt-green
  const seats = new THREE.Mesh(
    new THREE.CylinderGeometry(9.4, 9.4, 4.4, 8, 1, true), // open-ended: field stays visible inside
    M.concreteTex
  );
  g.add(at(seats, 0, 2.2, 0));
  const boardMat = new THREE.MeshBasicMaterial({ color: 0x2fd46a, map: null });
  g.add(at(box(7.4, 3.4, 0.5, M.darkMetal), 0, 6.6, 0));
  g.add(at(box(6.8, 2.8, 0.14, boardMat), 0, 6.6, -0.36));
  g.add(at(signMesh('MUD HENS', 4, 2, { fg: '#7fe0ff', bg: '#0e2c40', sub: 'TOLEDO' }), 0, 6.6, 0.5));
  g.userData.animate = (t) => {
    boardMat.color.setRGB(0.12 + 0.08 * Math.sin(t * 4), 0.75 + 0.15 * Math.sin(t * 5.3), 0.3);
  };
  return g;
}

// Port of Toledo container crane (boom spans across the road toward the water).
export function makeHarborCrane(M, containerColor = 0xb03a3a) {
  const g = new THREE.Group();
  const legM = M.yellow;
  for (const x of [-2.6, 2.6]) {
    g.add(at(box(0.8, 12.5, 0.8, legM), x, 6.25, -1.6));
    g.add(at(box(0.8, 12.5, 0.8, legM), x, 6.25, 1.6));
  }
  g.add(at(box(7.4, 1.1, 4, legM), 0, 12.7, 0));
  g.add(at(box(15, 1, 2.2, M.metal), 0, 13.6, 0)); // boom across road
  g.add(at(box(2.2, 1.2, 2.2, M.darkMetal), 3.4, 12.6, 0)); // trolley
  g.add(at(cyl(0.06, 0.06, 5.4, M.darkMetal, 4), 3.4, 9.8, 0)); // cable
  g.add(at(box(2.4, 2.2, 2.2, new THREE.MeshLambertMaterial({ color: containerColor, flatShading: true })), 3.4, 6.6, 0));
  g.add(at(box(3.2, 2.4, 3, M.metal), 0, 13.9, 0)); // cab
  return g;
}

// Lake freighter on the Maumee/Western (long hull along local z).
export function makeFreighter(M) {
  const g = new THREE.Group();
  const hull = new THREE.MeshLambertMaterial({ color: 0x35506a, flatShading: true });
  g.add(at(box(11, 4.2, 44, hull), 0, 0, 0));
  g.add(at(box(6, 1.6, 12, hull), 0, -1.2, 21.5)); // bow taper
  g.add(at(box(9, 5.4, 9, M.white), 0, 4.6, -16)); // superstructure aft
  g.add(at(cyl(1.3, 1.5, 4.6, M.darkMetal, 8), 0, 9.2, -16)); // stack
  g.add(at(box(7, 2.2, 3, M.darkMetal), 0, 7.7, -16)); // bridge windows strip
  const cols = [0xb03a3a, 0xd8b83e, 0x3a5a8a, 0x4a7a30, 0x8a6a42];
  for (let i = 0; i < 7; i++) {
    const c = new THREE.MeshLambertMaterial({ color: cols[i % cols.length], flatShading: true });
    g.add(at(box(7.6, 2.6, 4.2, c), 0, 3.4, 3 + i * 4.6));
  }
  g.add(at(box(11.6, 0.5, 44, M.darkMetal), 0, 2.1, 0)); // deck edge
  const t0 = Math.random() * 10;
  g.userData.animate = (t) => { g.position.y = 0.12 * Math.sin(t * 0.7 + t0); };
  return g;
}

// TheLOCKS on the portage canal.
export function makeLockHouse(M) {
  const g = new THREE.Group();
  g.add(at(box(5.5, 4, 4.5, M.brick), 0, 2, 0));
  g.add(at(box(6.4, 0.8, 5.4, M.roof), 0, 4.4, 0));
  g.add(at(box(1.4, 2.4, 0.2, M.glass), 0, 1.9, -2.3));
  g.add(at(box(18, 2.8, 2.6, M.concrete), 9, 1.4, 0)); // lock wall
  g.add(at(box(18, 0.6, 0.4, M.darkMetal), 9, 3.1, 0)); // cap rail
  g.add(at(signMesh('THE LOCKS', 3.4, 1.7, { fg: '#cfeaff', bg: '#22303c', sub: 'PORTAGE CANAL' }), -1.4, 5.6, -2.4));
  return g;
}

// Falls of the Maumee — rapids weir with foam crests.
export function makeRapidsWeir(M) {
  const g = new THREE.Group();
  g.add(at(box(28, 2.2, 3.4, M.concreteTex), 0, 0.6, 0));
  g.add(at(box(28, 0.7, 1.2, M.concrete), 0, 1.9, -1.1));
  const foamMat = new THREE.MeshLambertMaterial({ color: 0xe8f6ff, flatShading: true });
  const foam = new THREE.Group();
  for (let i = 0; i < 3; i++) foam.add(at(box(26 - i * 4, 0.5, 0.8, foamMat), 0, 1.5 - i * 0.5, 1.9 + i * 0.9));
  g.add(foam);
  g.userData.animate = (t) => { foam.scale.x = 1 + 0.05 * Math.sin(t * 3.4); };
  return g;
}

// Toledo Zoo gate arch (Olmsted Brothers design).
export function makeZooArch(M) {
  const g = new THREE.Group();
  const stone = new THREE.MeshLambertMaterial({ color: 0xb9ab90, flatShading: true });
  g.add(at(box(2.6, 6.5, 2.6, stone), -4.2, 3.25, 0));
  g.add(at(box(2.6, 6.5, 2.6, stone), 4.2, 3.25, 0));
  g.add(at(box(11.4, 1.7, 2.8, stone), 0, 7.2, 0));
  g.add(at(box(3.2, 1.1, 3, stone), 0, 8.4, 0)); // keystone block
  g.add(at(signMesh('TOLEDO ZOO', 4.4, 2, { fg: '#9dff6a', bg: '#14291c', sub: 'EST. 1904' }), 0, 5.2, 1.5));
  return g;
}

// Dossin Great American Mall — big-box shell with glass dome.
export function makeDossinMall(M) {
  const g = new THREE.Group();
  g.add(at(box(46, 12, 26, M.concreteTex), 0, 6, 0));
  g.add(at(box(47, 1, 27, M.roof), 0, 12.5, 0));
  const domeMat = new THREE.MeshLambertMaterial({ color: 0x7fd0ff, emissive: 0x14324a, flatShading: true });
  const dome = sph(6, domeMat, 12);
  g.add(at(dome, 0, 12.5, 0));
  g.add(at(box(40, 4, 0.3, M.glass), 0, 4.5, -13.1));
  g.add(at(signMesh('DOSSIN GREAT\nAMERICAN', 5.6, 2.6, { fg: '#ffd23e', sub: 'ONCE THE BIGGEST EVER' }), 0, 8.6, -13.3));
  g.add(at(signMesh('MALL', 3.2, 1.6, { fg: '#cfeaff' }), 14, 6, -13.2));
  g.userData.animate = (t) => {
    dome.scale.setScalar(1 + 0.02 * Math.sin(t * 1.8));
    domeMat.emissive.setRGB(0.05 + 0.05 * Math.sin(t * 2.1), 0.16, 0.28);
  };
  return g;
}

// Distant skyline backdrop strip (NOT solid — pure horizon dressing).
export function buildSkylineStrip(rng, curve, { side, dist, count, base = '#232a36', litChance = 0.16 }) {
  const g = new THREE.Group();
  const facades = [];
  for (let i = 0; i < 5; i++) {
    facades.push(makeBuildingTexture(rng, base, rng.int(4, 8), rng.int(3, 5), litChance));
  }
  const p = new THREE.Vector3(), t = new THREE.Vector3(), right = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const u = Math.min(0.98, Math.max(0.02, 0.03 + 0.94 * (i / Math.max(1, count - 1)) + rng.range(-0.012, 0.012)));
    curve.getPointAt(u, p);
    curve.getTangentAt(u, t);
    right.set(-t.z, 0, t.x).normalize();
    const d = dist + rng.range(0, 18);
    const h = rng.range(16, 46);
    const b = box(rng.range(10, 16), h, rng.range(9, 14), new THREE.MeshLambertMaterial({ map: facades[i % facades.length] }));
    b.position.set(p.x - right.x * side * d, h / 2 - 0.1, p.z - right.z * side * d);
    b.rotation.y = Math.atan2(t.x, t.z);
    g.add(b);
    if (rng.chance(0.32)) {
      const ant = cyl(0.22, 0.22, rng.range(3, 8), new THREE.MeshLambertMaterial({ color: 0x1c2028, flatShading: true }), 5);
      at(ant, b.position.x, h + 3, b.position.z);
      g.add(ant);
    }
  }
  return g;
}

// ---------------------------------------------------------------- placement

export function placeLandmarks(ctx) {
  const { theme, rng, M, curve, roadWidth, riverSide, worldRoot, anims, rememberSolid, hitsSolid, roadCheck, wallCheck } = ctx;
  const half = roadWidth / 2;
  const landSide = riverSide ? -riverSide : (rng.chance(0.5) ? 1 : -1);
  // Waterfront side. buildWorld passes riverSide 0 when the level has no river,
  // and `0 ?? 1` is 0 — which would place waterfront landmarks on the asphalt.
  const shoreSide = riverSide || -landSide;

  const place = (obj, u, side, dist, opts = {}) => {
    const p = new THREE.Vector3(), t = new THREE.Vector3(), right = new THREE.Vector3();
    let ok = false;
    // Try nudges along the rail first, then push the footprint outward: sharp
    // bends swing the road toward the lot line and would wall the street off.
    for (const du of [0, 0.06, -0.06, 0.12, -0.12]) {
      if (ok) break;
      const uu = Math.min(0.96, Math.max(0.04, u + du));
      curve.getPointAt(uu, p);
      curve.getTangentAt(uu, t);
      right.set(-t.z, 0, t.x).normalize();
      for (const push of [0, 3, 6, 9, 12]) {
        const dd = dist + push;
        obj.position.set(p.x - right.x * side * dd, opts.y ?? 0, p.z - right.z * side * dd);
        obj.rotation.y = opts.alignTangent ? Math.atan2(t.x, t.z) : Math.atan2(p.x - obj.position.x, p.z - obj.position.z);
        obj.updateMatrixWorld(true);
        if (hitsSolid(obj, -2)) continue;
        if (roadCheck && roadCheck(obj, 0.5)) continue;
        if (wallCheck && !opts.watercraft && wallCheck(obj, 0.4)) continue;
        ok = true;
        break;
      }
    }
    if (!ok) return null; // no clear spot — skip this landmark
    if (opts.watercraft) obj.userData.watercraft = true; // floats beside the road
    worldRoot.add(obj);
    if (!opts.noSolid) rememberSolid(obj);
    if (obj.userData.animate) {
      let tt = 0;
      anims.push((dt) => { tt += dt; obj.userData.animate(tt); });
    }
    return obj;
  };

  const sky = (opts) => worldRoot.add(buildSkylineStrip(rng, curve, opts));

  switch (theme) {
    case 'city': {
      sky({ side: shoreSide, dist: half + 40, count: 22 });
      sky({ side: landSide, dist: half + 36, count: 24 });
      if (riverSide) place(makeRapidsWeir(M), 0.20, riverSide, half + 9, { alignTangent: true, watercraft: true });
      place(makeMuseumOfArt(M), 0.14, landSide, half + 16);
      place(makeReflectingPool(M), 0.14, landSide, half + 7);
      place(makeOlympians(M), 0.155, landSide, half + 10.5);
      place(makeLionFountain(M), 0.40, landSide, half + 6);
      if (riverSide) place(makeGlassCitySign(M), 0.52, riverSide, half + 4);
      if (riverSide) {
        place(makeFreighter(M), 0.62, riverSide, half + 9, { y: 1.1, alignTangent: true, watercraft: true });
        place(makeHarborCrane(M), 0.70, riverSide, half + 3);
        place(makeHarborCrane(M, 0x3a5a8a), 0.745, riverSide, half + 3);
        place(makeLockHouse(M), 0.82, riverSide, half + 13);
      }
      break;
    }
    case 'downtown': {
      sky({ side: landSide, dist: half + 42, count: 26 });
      if (riverSide) sky({ side: riverSide, dist: half + 46, count: 18 });
      if (riverSide) place(makeGlassCitySign(M), 0.07, riverSide, half + 4);
      else place(makeGlassCitySign(M), 0.07, landSide, half + 5);
      place(makeFivePointsTower(M), 0.24, landSide, half + 18);
      place(makeLionFountain(M), 0.34, -landSide, half + 6);
      place(makeWalbridgeHall(M), 0.45, landSide, half + 16);
      place(makeMudHensField(M), 0.60, -landSide, half + 20);
      if (riverSide) {
        place(makeHarborCrane(M), 0.85, riverSide, half + 3);
        place(makeFreighter(M), 0.90, riverSide, half + 9, { y: 1.1, alignTangent: true, watercraft: true });
      }
      break;
    }
    case 'farm': {
      // Wheat fields, but the Glass City glow is always on the horizon.
      if (riverSide) sky({ side: riverSide, dist: half + 55, count: 14, litChance: 0.12 });
      sky({ side: landSide, dist: half + 60, count: 12, litChance: 0.12 });
      break;
    }
    case 'fair': {
      sky({ side: shoreSide, dist: half + 44, count: 18, litChance: 0.13 });
      sky({ side: landSide, dist: half + 64, count: 12, litChance: 0.13 });
      place(makeZooArch(M), 0.10, landSide, half + 7);
      place(makeLionFountain(M), 0.22, landSide, half + 6);
      place(makeDossinMall(M), 0.42, shoreSide, half + 28);
      break;
    }
    case 'industrial': {
      sky({ side: landSide, dist: half + 46, count: 20 });
      place(makeGlassWorks(M), 0.18, shoreSide, half + 15);
      place(makeGlassWorks(M), 0.58, landSide, half + 15);
      place(makeGlassCitySign(M), 0.36, landSide, half + 5);
      if (riverSide) {
        place(makeHarborCrane(M, 0xd8b83e), 0.75, riverSide, half + 3);
        place(makeFreighter(M), 0.80, riverSide, half + 9, { y: 1.1, alignTangent: true, watercraft: true });
      }
      break;
    }
    default:
      break;
  }
}
