import * as THREE from 'three';

// Procedural stylized low-poly buffalo built from primitives.
// Returns { group, parts, mats } where parts exposes animated pivots.

const FUR_PALETTE = [0x6b4a2f, 0x5d4130, 0x7a5638, 0x4e3a2a, 0x83603f, 0x59452e];
const DARK_FUR = 0x3c2c1e;

const _matCache = {};
function sharedMat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!_matCache[key]) {
    _matCache[key] = new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts });
  }
  return _matCache[key];
}

function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function cyl(rt, rb, h, seg, mat) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); }
function cone(r, h, seg, mat) { return new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat); }
function sph(r, w, h, mat) { return new THREE.Mesh(new THREE.SphereGeometry(r, w, h), mat); }

export function buildBuffalo(rng, variant = 'normal') {
  const furColor = rng.pick(FUR_PALETTE);
  // Per-instance materials for the flash effect (body + head only).
  const furMat = new THREE.MeshLambertMaterial({ color: furColor, flatShading: true });
  const darkMat = sharedMat(DARK_FUR);
  const hornMat = sharedMat(0xd8c9a3);
  const eyeMat = variant === 'angry' || variant === 'boss'
    ? new THREE.MeshLambertMaterial({ color: 0xff2211, emissive: 0xaa0000 })
    : sharedMat(0xf5f0e6);

  const group = new THREE.Group();
  const parts = {};

  // ---- Body ----
  const body = box(1.5, 1.15, 2.3, furMat);
  body.position.set(0, 1.42, -0.05);
  group.add(body);
  parts.body = body;

  // Hump (front shoulder)
  const hump = sph(0.75, 8, 6, furMat);
  hump.scale.set(0.95, 0.62, 1.0);
  hump.position.set(0, 1.98, 0.42);
  group.add(hump);
  parts.hump = hump;

  // Chest bulk (front)
  const chest = box(1.25, 0.9, 0.7, furMat);
  chest.position.set(0, 1.28, 0.95);
  group.add(chest);

  // ---- Head group ----
  const head = new THREE.Group();
  head.position.set(0, 1.86, 1.32);
  group.add(head);
  parts.head = head;

  const skull = box(0.66, 0.56, 0.72, furMat);
  skull.position.set(0, 0.05, 0.08);
  head.add(skull);

  const muzzle = box(0.46, 0.36, 0.52, darkMat);
  muzzle.position.set(0, -0.14, 0.52);
  head.add(muzzle);
  parts.muzzle = muzzle;

  // Nostrils
  const nL = sph(0.045, 5, 4, sharedMat(0x2a1d12));
  nL.position.set(-0.1, -0.16, 0.79);
  const nR = nL.clone(); nR.position.x = 0.1;
  head.add(nL, nR);

  // Eyes
  const eL = sph(0.075, 6, 5, eyeMat);
  eL.position.set(-0.24, 0.16, 0.45);
  const eR = eL.clone(); eR.position.x = 0.24;
  head.add(eL, eR);

  // Horns: two-segment lyre shape per side
  for (const side of [-1, 1]) {
    const hBase = cone(0.1, 0.5, 6, hornMat);
    hBase.position.set(side * 0.42, 0.3, -0.05);
    hBase.rotation.z = side * -0.85; // sweep outward
    head.add(hBase);
    const hTip = cone(0.07, 0.34, 6, hornMat);
    hTip.position.set(side * 0.62, 0.52, -0.05);
    hTip.rotation.z = side * -1.9; // curl up at the tip
    head.add(hTip);

    // Ears
    const ear = box(0.06, 0.22, 0.3, furMat);
    ear.position.set(side * 0.45, 0.02, 0.18);
    ear.rotation.z = side * 0.5;
    head.add(ear);
  }

  // Mane spikes along neck/top of head
  for (let i = 0; i < 4; i++) {
    const spike = cone(0.09, 0.3, 4, darkMat);
    spike.position.set((i % 2 === 0 ? -1 : 1) * 0.18, 0.42 + (i > 1 ? 0.06 : 0), -0.25 + i * 0.12);
    head.add(spike);
  }

  // ---- Legs (hip pivots for animation) ----
  const legDefs = [
    { x: -0.48, z: 0.78, name: 'legFL' },
    { x: 0.48, z: 0.78, name: 'legFR' },
    { x: -0.48, z: -0.85, name: 'legBL' },
    { x: 0.48, z: -0.85, name: 'legBR' }
  ];
  for (const ld of legDefs) {
    const hip = new THREE.Group();
    hip.position.set(ld.x, 1.02, ld.z);
    group.add(hip);

    const upper = box(0.32, 0.8, 0.34, furMat);
    upper.position.y = -0.4;
    hip.add(upper);
    const lower = box(0.24, 0.75, 0.26, darkMat);
    lower.position.set(0, -1.18, 0.03);
    hip.add(lower);
    const foot = box(0.3, 0.14, 0.44, darkMat);
    foot.position.set(0, -1.52, 0.06);
    hip.add(foot);

    parts[ld.name] = hip;
  }

  // ---- Tail ----
  const tail = new THREE.Group();
  tail.position.set(0, 1.72, -1.18);
  group.add(tail);
  const tailStem = cyl(0.035, 0.05, 0.65, 5, furMat);
  tailStem.position.y = -0.3;
  tailStem.rotation.x = 0.35;
  tail.add(tailStem);
  const tuft = cone(0.12, 0.3, 5, darkMat);
  tuft.position.set(0, -0.72, -0.18);
  tail.add(tuft);
  parts.tail = tail;

  // ---- Accessories by variant ----
  if (variant === 'fair') {
    const hat = cone(0.22, 0.5, 8, sharedMat(0xff4fa0));
    hat.position.set(0, 0.55, -0.1);
    head.add(hat);
    const pom = sph(0.09, 6, 5, sharedMat(0xfff23e));
    pom.position.set(0, 0.82, -0.1);
    head.add(pom);
    // Balloon on horn
    const balloon = sph(0.24, 8, 6, sharedMat(0x3ea6ff, { emissive: 0x0a2a55 }));
    balloon.position.set(0.85, 1.0, -0.05);
    head.add(balloon);
    const string = cyl(0.008, 0.008, 0.5, 3, sharedMat(0xffffff));
    string.position.set(0.72, 0.62, -0.05);
    head.add(string);
    // Bow tie
    const bowL = box(0.16, 0.1, 0.04, sharedMat(0xffe14d));
    bowL.position.set(-0.1, -0.32, 0.5);
    bowL.rotation.z = 0.3;
    const bowR = bowL.clone(); bowR.position.x = 0.1; bowR.rotation.z = -0.3;
    head.add(bowL, bowR);
  } else if (variant === 'security') {
    // Improvised security vest over the body
    const vest = box(1.58, 0.95, 2.0, sharedMat(0x2e4a2e));
    vest.position.set(0, 1.42, -0.05);
    group.add(vest);
    parts.vest = vest;
    // Reflective stripes
    for (const z of [-0.5, 0.3]) {
      const stripe = box(1.62, 0.16, 0.1, sharedMat(0xd8d8d8, { emissive: 0x555555 }));
      stripe.position.set(0, 1.42, z);
      group.add(stripe);
    }
    // Cap
    const cap = cyl(0.3, 0.34, 0.16, 8, sharedMat(0x1d3a6b));
    cap.position.set(0, 0.42, 0.15);
    head.add(cap);
    const brim = box(0.4, 0.05, 0.28, sharedMat(0x16294d));
    brim.position.set(0, 0.36, 0.42);
    head.add(brim);
    // Badge
    const badge = sph(0.07, 6, 5, sharedMat(0xffd700, { emissive: 0x6b5200 }));
    badge.position.set(0.42, 1.55, 0.98);
    group.add(badge);
  } else if (variant === 'traffic') {
    // Confused little road-cone hat
    const coneHat = cone(0.2, 0.42, 8, sharedMat(0xff7a1e));
    coneHat.position.set(0, 0.5, -0.05);
    head.add(coneHat);
    const band = cyl(0.16, 0.19, 0.1, 8, sharedMat(0xffffff));
    band.position.set(0, 0.42, -0.05);
    head.add(band);
  } else if (variant === 'angry') {
    // Lowered aggressive brow
    const brow = box(0.7, 0.14, 0.2, darkMat);
    brow.position.set(0, 0.3, 0.35);
    head.add(brow);
  } else if (variant === 'bandit') {
    // The stolen precinct donut, balanced on the head like a getaway loot.
    const donut = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.12, 6, 12), sharedMat(0xd9a26b));
    donut.position.set(0, 0.66, -0.05);
    donut.rotation.x = Math.PI / 2;
    head.add(donut);
    const icing = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.085, 6, 12), sharedMat(0xff4fa0, { emissive: 0x3a0a24 }));
    icing.position.set(0, 0.72, -0.05);
    icing.rotation.x = Math.PI / 2;
    icing.scale.set(1, 1, 0.55);
    head.add(icing);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const sprinkle = box(0.05, 0.035, 0.035, sharedMat([0x9dff6a, 0x3ea6ff, 0xfff23e, 0xffffff][i % 4]));
      sprinkle.position.set(Math.cos(a) * 0.24, 0.75, -0.05 + Math.sin(a) * 0.24);
      sprinkle.rotation.z = a;
      head.add(sprinkle);
    }
  } else if (variant === 'boss') {
    // Massive crown horns + glowing eyes already set; add spiked collar
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const spike = cone(0.14, 0.5, 4, hornMat);
      spike.position.set(Math.cos(a) * 0.75, 1.9, 0.6 + Math.sin(a) * 0.75);
      spike.rotation.x = -0.5;
      group.add(spike);
    }
  }

  // ---- Blob shadow (fake, cheap) ----
  const shadowGeo = new THREE.CircleGeometry(1.35, 16);
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  group.add(shadow);
  parts.shadow = shadow;

  // Track per-instance materials so the owner can dispose exactly those
  // (shared cached materials must NOT be disposed).
  return { group, parts, mats: { fur: furMat, dark: darkMat, shadow: shadowMat } };
}
