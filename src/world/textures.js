import * as THREE from 'three';

// Procedural canvas textures — no external image assets needed.

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.magFilter = THREE.NearestFilter; // chunky arcade pixels
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Brick facade with window grid + storefront ground floor + cornice. litChance controls glowing windows.
export function makeBuildingTexture(rng, base = '#7a4a32', stories = 3, cols = 4, litChance = 0.35) {
  const [c, g] = canvas(256, 256);
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  // Subtle weathering gradient (dirty toward the bottom)
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(255,255,255,0.05)');
  grad.addColorStop(0.75, 'rgba(0,0,0,0.06)');
  grad.addColorStop(1, 'rgba(0,0,0,0.22)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  // Brick lines
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 2;
  const bh = 14, bw = 32;
  for (let y = 0; y < 200; y += bh) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke();
    const off = (y / bh) % 2 === 0 ? 0 : bw / 2;
    for (let x = -bw; x < 256 + bw; x += bw) {
      g.beginPath(); g.moveTo(x + off, y); g.lineTo(x + off, y + bh); g.stroke();
    }
  }
  // Cornice band at the top
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(0, 0, 256, 7);
  g.fillStyle = 'rgba(255,240,210,0.25)';
  g.fillRect(0, 7, 256, 3);
  // Windows (upper floors only — ground floor is storefronts)
  const ww = 34, wh = 40;
  const mx = (256 - cols * ww) / (cols + 1);
  const my = 26;
  for (let s = 0; s < stories; s++) {
    for (let i = 0; i < cols; i++) {
      const x = mx + i * (ww + mx);
      const y = my + s * ((200 - my) / stories);
      const lit = rng.chance(litChance);
      g.fillStyle = lit ? (rng.chance(0.8) ? '#ffd97a' : '#a8d4ff') : '#1c2733';
      g.fillRect(x, y, ww, wh);
      g.strokeStyle = 'rgba(0,0,0,0.6)';
      g.lineWidth = 3;
      g.strokeRect(x, y, ww, wh);
      // Sill
      g.fillStyle = 'rgba(255,240,210,0.18)';
      g.fillRect(x - 2, y + wh, ww + 4, 3);
      // Cross mullions
      g.beginPath();
      g.moveTo(x + ww / 2, y); g.lineTo(x + ww / 2, y + wh);
      g.moveTo(x, y + wh / 2); g.lineTo(x + ww, y + wh / 2);
      g.stroke();
    }
  }
  // Ground floor: glass storefront band with doors and one lit shop
  const gy = 200;
  g.fillStyle = '#241f1a';
  g.fillRect(0, gy, 256, 56);
  for (let i = 0; i < cols; i++) {
    const x = mx + i * (ww + mx);
    const lit = rng.chance(0.45);
    g.fillStyle = lit ? '#ffcf78' : '#16222e';
    g.fillRect(x, gy + 8, ww, 44);
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.lineWidth = 3;
    g.strokeRect(x, gy + 8, ww, 44);
    if (lit && rng.chance(0.5)) { // silhouetted shelf
      g.fillStyle = 'rgba(40,26,12,0.75)';
      g.fillRect(x + 4, gy + 30, ww - 8, 10);
    }
  }
  // Base plinth
  g.fillStyle = 'rgba(0,0,0,0.4)';
  g.fillRect(0, 250, 256, 6);
  return toTexture(c);
}

// Downtown glass tower facade: curtain wall grid, scattered lit offices.
export function makeGlassTowerTexture(rng, rows = 8, cols = 4, litChance = 0.22) {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#20303f';
  g.fillRect(0, 0, 256, 256);
  const cw = 256 / cols, ch = 256 / rows;
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < cols; i++) {
      const x = i * cw, y = r * ch;
      // Glass tint varies per panel
      const tint = 34 + Math.random() * 22 | 0;
      g.fillStyle = `rgb(${tint},${tint + 14},${tint + 26})`;
      g.fillRect(x + 2, y + 2, cw - 4, ch - 4);
      if (rng.chance(litChance)) {
        g.fillStyle = rng.chance(0.6) ? '#cfe0ff' : '#ffe2a8';
        g.fillRect(x + 4, y + 4, cw - 8, ch - 8);
      }
      // Reflection streak
      if (rng.chance(0.25)) {
        g.fillStyle = 'rgba(160,200,230,0.16)';
        g.fillRect(x + 2, y + 2, cw - 4, ch * 0.4);
      }
    }
  }
  // Mullions
  g.strokeStyle = 'rgba(10,16,22,0.8)';
  g.lineWidth = 2.5;
  for (let x = 0; x <= 256; x += cw) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  for (let y = 0; y <= 256; y += ch) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  return toTexture(c);
}

export function makeRoadTexture() {
  const [c, g] = canvas(128, 256);
  g.fillStyle = '#3a3d42';
  g.fillRect(0, 0, 128, 256);
  // Tire lanes slightly worn lighter, gutters darker
  g.fillStyle = 'rgba(70,74,80,0.35)';
  g.fillRect(20, 0, 28, 256); g.fillRect(80, 0, 28, 256);
  g.fillStyle = 'rgba(24,26,30,0.45)';
  g.fillRect(0, 0, 12, 256); g.fillRect(116, 0, 12, 256);
  // Asphalt noise
  for (let i = 0; i < 1100; i++) {
    const v = 40 + Math.random() * 30 | 0;
    g.fillStyle = `rgba(${v},${v},${v + 4},0.5)`;
    g.fillRect(Math.random() * 128, Math.random() * 256, 2, 2);
  }
  // Tar repair patches
  for (let i = 0; i < 3; i++) {
    const px = 14 + Math.random() * 86, py = Math.random() * 210;
    const pw = 16 + Math.random() * 26, ph = 10 + Math.random() * 18;
    g.fillStyle = 'rgba(22,24,28,0.55)';
    g.fillRect(px, py, pw, ph);
    g.strokeStyle = 'rgba(80,84,90,0.4)';
    g.lineWidth = 1.5;
    g.strokeRect(px, py, pw, ph);
  }
  // Hairline cracks
  for (let i = 0; i < 5; i++) {
    const y = Math.random() * 256;
    g.strokeStyle = 'rgba(18,20,24,0.4)';
    g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= 128; x += 16) g.lineTo(x, y + Math.sin(x * 0.5 + i * 2.1) * 4);
    g.stroke();
  }
  // Transverse expansion seams
  g.fillStyle = 'rgba(25,27,31,0.5)';
  for (let y = 0; y < 256; y += 64) g.fillRect(0, y, 128, 2);
  // Center dashes (faded halo like real paint)
  for (let y = 0; y < 256; y += 64) {
    g.fillStyle = 'rgba(216,194,62,0.3)';
    g.fillRect(57, y - 1, 14, 38);
    g.fillStyle = '#d8c23e';
    g.fillRect(60, y, 8, 36);
  }
  // Edge lines, worn in spots
  g.fillStyle = 'rgba(214,214,214,0.9)';
  g.fillRect(10, 0, 4, 256); g.fillRect(114, 0, 4, 256);
  for (let i = 0; i < 12; i++) {
    const y = Math.random() * 250 | 0;
    g.fillStyle = '#3a3d42';
    g.fillRect(10, y, 4, 3 + (Math.random() * 6 | 0));
    g.fillRect(114, y, 4, 3 + (Math.random() * 6 | 0));
  }
  // A manhole cover
  g.fillStyle = '#2c2f34';
  g.beginPath(); g.arc(92, 132, 9, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(96,102,110,0.55)';
  g.lineWidth = 2;
  g.beginPath(); g.arc(92, 132, 9, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(92, 132, 5, 0, Math.PI * 2); g.stroke();
  return toTexture(c, 1, 8);
}

export function makeSidewalkTexture() {
  const [c, g] = canvas(128, 128);
  // Panels with slight tonal variation (real sidewalk slabs never match)
  for (let px = 0; px < 4; px++) {
    for (let py = 0; py < 4; py++) {
      const v = 132 + Math.random() * 24 | 0;
      g.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
      g.fillRect(px * 32, py * 32, 32, 32);
    }
  }
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 3;
  for (let i = 0; i <= 128; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke();
  }
  // A few cracks + a tree-pit patch
  g.strokeStyle = 'rgba(40,40,44,0.5)';
  g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(32, 74); g.lineTo(58, 66); g.lineTo(82, 78); g.lineTo(112, 70); g.stroke();
  g.beginPath(); g.moveTo(64, 32); g.lineTo(70, 60); g.stroke();
  g.fillStyle = 'rgba(46,42,36,0.55)';
  g.fillRect(16, 16, 22, 22);
  g.fillStyle = 'rgba(90,120,60,0.5)';
  g.fillRect(19, 19, 7, 7);
  // Specks + gum spots
  for (let i = 0; i < 340; i++) {
    const v = 110 + Math.random() * 45 | 0;
    g.fillStyle = `rgba(${v},${v},${v},0.4)`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  for (let i = 0; i < 8; i++) {
    g.fillStyle = 'rgba(190,180,160,0.5)';
    g.fillRect(Math.random() * 126, Math.random() * 126, 3, 2);
  }
  return toTexture(c, 2, 6);
}

export function makeGrassTexture() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#4a7a30';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1600; i++) {
    const v = Math.random();
    g.fillStyle = v > 0.5 ? 'rgba(90,140,50,0.6)' : 'rgba(60,100,35,0.6)';
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 3);
  }
  return toTexture(c, 24, 24);
}

export function makeDirtTexture() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#7a5c3a';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1400; i++) {
    const v = Math.random();
    g.fillStyle = v > 0.5 ? 'rgba(140,110,70,0.6)' : 'rgba(90,70,45,0.6)';
    g.fillRect(Math.random() * 128, Math.random() * 128, 3, 2);
  }
  return toTexture(c, 12, 12);
}

export function makeConcreteTexture() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#9a9da1';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 3;
  for (let i = 0; i <= 128; i += 64) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke();
  }
  for (let i = 0; i < 500; i++) {
    const v = 130 + Math.random() * 40 | 0;
    g.fillStyle = `rgba(${v},${v},${v},0.35)`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  return toTexture(c, 8, 8);
}

export function makeWaterTexture() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#2a5a7a';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = `rgba(120,190,230,${0.1 + Math.random() * 0.25})`;
    g.lineWidth = 2 + Math.random() * 2;
    const y = Math.random() * 128;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 128; x += 16) g.lineTo(x, y + Math.sin(x * 0.2 + i) * 3);
    g.stroke();
  }
  return toTexture(c, 6, 2);
}

// Text sign (joke boards, store signs).
export function makeSignTexture(text, bg = '#1c2733', fg = '#ffd23e', sub = null) {
  const [c, g] = canvas(512, 256);
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 256);
  g.strokeStyle = fg;
  g.lineWidth = 8;
  g.strokeRect(10, 10, 492, 236);
  g.fillStyle = fg;
  g.font = 'bold 52px "Courier New", monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const lines = String(text).split('\n');
  if (sub) {
    g.font = 'bold 44px "Courier New", monospace';
    lines.forEach((l, i) => g.fillText(l, 256, 90 + i * 56));
    g.font = 'bold 30px "Courier New", monospace';
    g.fillStyle = '#cfeaff';
    g.fillText(sub, 256, 210);
  } else {
    const size = lines.length > 1 ? 40 : 56;
    g.font = `bold ${size}px "Courier New", monospace`;
    const lh = size + 14;
    const y0 = 128 - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => g.fillText(l, 256, y0 + i * lh));
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Striped awning.
export function makeStripeTexture(a = '#c23a3a', b = '#f0ead8') {
  const [c, g] = canvas(128, 64);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 === 0 ? a : b;
    g.fillRect(i * 16, 0, 16, 64);
  }
  return toTexture(c, 3, 1);
}

export function makeTentTexture(a = '#b03a5a', b = '#f0ead8') {
  const [c, g] = canvas(256, 256);
  for (let i = 0; i < 16; i++) {
    g.fillStyle = i % 2 === 0 ? a : b;
    g.beginPath();
    g.moveTo(i * 16, 256);
    g.lineTo((i + 0.5) * 16, 0);
    g.lineTo((i + 1) * 16, 256);
    g.closePath();
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
