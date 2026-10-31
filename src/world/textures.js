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

// Brick facade with window grid. litChance controls glowing windows.
export function makeBuildingTexture(rng, base = '#7a4a32', stories = 3, cols = 4, litChance = 0.35) {
  const [c, g] = canvas(256, 256);
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  // Brick lines
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 2;
  const bh = 14, bw = 32;
  for (let y = 0; y < 256; y += bh) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke();
    const off = (y / bh) % 2 === 0 ? 0 : bw / 2;
    for (let x = -bw; x < 256 + bw; x += bw) {
      g.beginPath(); g.moveTo(x + off, y); g.lineTo(x + off, y + bh); g.stroke();
    }
  }
  // Windows
  const ww = 34, wh = 40;
  const mx = (256 - cols * ww) / (cols + 1);
  const my = 30;
  for (let s = 0; s < stories; s++) {
    for (let i = 0; i < cols; i++) {
      const x = mx + i * (ww + mx);
      const y = my + s * ((256 - my) / stories);
      const lit = rng.chance(litChance);
      g.fillStyle = lit ? '#ffd97a' : '#1c2733';
      g.fillRect(x, y, ww, wh);
      g.strokeStyle = 'rgba(0,0,0,0.6)';
      g.lineWidth = 3;
      g.strokeRect(x, y, ww, wh);
      // Cross mullions
      g.beginPath();
      g.moveTo(x + ww / 2, y); g.lineTo(x + ww / 2, y + wh);
      g.moveTo(x, y + wh / 2); g.lineTo(x + ww, y + wh / 2);
      g.stroke();
    }
  }
  return toTexture(c);
}

export function makeRoadTexture() {
  const [c, g] = canvas(128, 256);
  g.fillStyle = '#3a3d42';
  g.fillRect(0, 0, 128, 256);
  // Asphalt noise
  for (let i = 0; i < 900; i++) {
    const v = 40 + Math.random() * 30 | 0;
    g.fillStyle = `rgba(${v},${v},${v + 4},0.5)`;
    g.fillRect(Math.random() * 128, Math.random() * 256, 2, 2);
  }
  // Center dashes (vertical)
  g.fillStyle = '#d8c23e';
  for (let y = 0; y < 256; y += 64) g.fillRect(60, y, 8, 36);
  // Edge lines
  g.fillStyle = '#cfcfcf';
  g.fillRect(8, 0, 4, 256);
  g.fillRect(116, 0, 4, 256);
  return toTexture(c, 1, 8);
}

export function makeSidewalkTexture() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#8d8f93';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(0,0,0,0.3)';
  g.lineWidth = 3;
  for (let i = 0; i <= 128; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke();
  }
  for (let i = 0; i < 300; i++) {
    const v = 120 + Math.random() * 40 | 0;
    g.fillStyle = `rgba(${v},${v},${v},0.4)`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
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
