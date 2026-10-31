import * as THREE from 'three';

// Geometry helpers for procedural construction.

export function addBox(parent, w, h, d, x, y, z, mat, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  parent.add(m);
  return m;
}

export function addCyl(parent, rt, rb, h, x, y, z, mat, seg = 10) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

// Triangular prism (gable roof / barn shape). Width w (x), height h (y), depth d (z).
export function makePrism(w, h, d) {
  const geo = new THREE.BufferGeometry();
  const hw = w / 2, hd = d / 2;
  const v = [
    // front triangle
    -hw, 0, hd,   hw, 0, hd,   0, h, hd,
    // back triangle
    hw, 0, -hd,  -hw, 0, -hd,  0, h, -hd,
    // left slope
    -hw, 0, -hd, -hw, 0, hd,  0, h, hd,
    -hw, 0, -hd,  0, h, hd,   0, h, -hd,
    // right slope
    hw, 0, hd,   hw, 0, -hd,  0, h, -hd,
    hw, 0, hd,   0, h, -hd,   0, h, hd,
    // bottom
    -hw, 0, hd,  -hw, 0, -hd, hw, 0, -hd,
    -hw, 0, hd,   hw, 0, -hd, hw, 0, hd
  ];
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  geo.computeVertexNormals();
  return geo;
}

// Build a flat ribbon (road/sidewalk) following a curve.
// offset: lateral shift from curve center. Returns a Mesh.
export function buildStrip(curve, { width = 4, offset = 0, y = 0, mat, samples = 140, uvRepeatV = 6 }) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  const right = new THREE.Vector3();

  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    curve.getPointAt(u, p);
    curve.getTangentAt(u, t);
    right.set(-t.z, 0, t.x).normalize();
    const cx = p.x + right.x * offset;
    const cz = p.z + right.z * offset;
    positions.push(cx - right.x * width / 2, y, cz - right.z * width / 2);
    positions.push(cx + right.x * width / 2, y, cz + right.z * width / 2);
    const v = u * uvRepeatV;
    uvs.push(0, v, 1, v);
    if (i < samples) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

// Dispose a whole subtree's geometries/materials (on level teardown).
export function disposeTree(root) {
  root.traverse((o) => {
    if (o.isMesh || o.isSprite) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (m.map) m.map.dispose();
          m.dispose();
        }
      }
    }
  });
}
