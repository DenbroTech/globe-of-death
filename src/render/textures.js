import * as THREE from 'three';

let glowTex, floorTex, netTex;

/* ---------- textures ---------- */
function cv(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c, srgb) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.encoding = THREE.sRGBEncoding;
  t.anisotropy = 4;
  return t;
}
const stripeTex = (n, a, b) => {
  const [c, x] = cv(1024, 8);
  for (let i = 0; i < n; i++) {
    x.fillStyle = i % 2 ? a : b;
    x.fillRect((i * 1024) / n, 0, 1024 / n + 1, 8);
  }
  return tex(c, true);
};

export function initTextures() {
  glowTex = (() => {
    const [c, x] = cv(64, 64);
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return tex(c);
  })();
  floorTex = (() => {
    const [c, x] = cv(1024, 1024);
    const g = x.createRadialGradient(512, 512, 40, 512, 512, 512);
    g.addColorStop(0, '#5a4128');
    g.addColorStop(0.45, '#3b2a19');
    g.addColorStop(1, '#120b07');
    x.fillStyle = g;
    x.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 14000; i++) {
      x.fillStyle =
        Math.random() < 0.5 ? `rgba(255,220,170,${Math.random() * 0.12})` : `rgba(0,0,0,${Math.random() * 0.2})`;
      x.fillRect(Math.random() * 1024, Math.random() * 1024, 2, 2);
    }
    return tex(c, true);
  })();
  netTex = (() => {
    const [c, x] = cv(256, 256);
    x.strokeStyle = '#fff';
    x.lineWidth = 5;
    for (let k = -256; k <= 512; k += 64) {
      x.beginPath();
      x.moveTo(k, 0);
      x.lineTo(k + 256, 256);
      x.stroke();
      x.beginPath();
      x.moveTo(k, 256);
      x.lineTo(k + 256, 0);
      x.stroke();
    }
    const t = tex(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(28, 14);
    return t;
  })();
}

export { cv, floorTex, glowTex, netTex, stripeTex, tex };
