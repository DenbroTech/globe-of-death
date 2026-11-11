import * as THREE from 'three';
import { cv, tex } from '../render/textures.js';

/* ---------- third pass on the premium arenas: owner feedback ----------
   castle gatehouse + drawbridge view, a trippy 3D bar-graph floor for the digital grid, short grass inside
   the garden arena. Each extraX(g) adds to the built group and chains onto its tick. */

const std = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85 }, o));
const seeded = s => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const addTick = (g, f) => {
  const p = g.userData.tick;
  g.userData.tick = t => {
    if (p) p(t);
    f(t);
  };
};
const canvasTex = (w, h, draw) => {
  const [c, x] = cv(w, h);
  draw(x, w, h);
  return tex(c, true);
};

/* ---------- Royal court: a gatehouse on the wall (facing the gap in the stands) ---------- */
function extraCastle(g) {
  const stoneTex = canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#8c8578';
    x.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16)
      for (let xx = (y / 16) % 2 ? -16 : 0; xx < w; xx += 32) {
        x.fillStyle = `rgb(${125 + Math.random() * 35},${118 + Math.random() * 30},${104 + Math.random() * 26})`;
        x.fillRect(xx + 1, y + 1, 30, 14);
      }
  });
  stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping;
  stoneTex.repeat.set(3, 3);
  const stone = std(0xffffff, { map: stoneTex });
  const gate = new THREE.Group();
  // the gate block with an arched opening
  const shape = new THREE.Shape();
  shape.moveTo(-8, 0);
  shape.lineTo(8, 0);
  shape.lineTo(8, 18);
  shape.lineTo(-8, 18);
  shape.lineTo(-8, 0);
  const hole = new THREE.Path();
  hole.moveTo(-3.6, 0);
  hole.lineTo(-3.6, 7);
  hole.absarc(0, 7, 3.6, Math.PI, 0, true);
  hole.lineTo(3.6, 0);
  hole.lineTo(-3.6, 0);
  shape.holes.push(hole);
  const block = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false }), stone);
  block.position.z = -1.5;
  gate.add(block);
  // crenellations on top and two round towers either side
  for (let i = -3; i <= 3; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 3.2), stone);
    c.position.set(i * 2.3, 18.8, 0);
    gate.add(c);
  }
  for (const sx of [-1, 1]) {
    const tw = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 24, 20), stone);
    tw.position.set(sx * 10.5, 12, 0);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 8, 20), std(0x2b3a7a));
    roof.position.set(sx * 10.5, 28, 0);
    gate.add(tw, roof);
  }
  // through the arch: a painted view of the lowered drawbridge over the moat and the hills beyond
  const view = canvasTex(256, 256, (x, w, h) => {
    const sky = x.createLinearGradient(0, 0, 0, h * 0.55);
    sky.addColorStop(0, '#5f93d8');
    sky.addColorStop(1, '#cfe4f8');
    x.fillStyle = sky;
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#6fa84a';
    x.beginPath();
    x.moveTo(0, h * 0.55);
    x.quadraticCurveTo(w * 0.3, h * 0.42, w * 0.6, h * 0.52);
    x.quadraticCurveTo(w * 0.85, h * 0.6, w, h * 0.5);
    x.lineTo(w, h);
    x.lineTo(0, h);
    x.fill();
    x.fillStyle = '#2f6f8f'; // moat
    x.fillRect(0, h * 0.7, w, h * 0.12);
    // the drawbridge: planks in perspective, with chains up to the arch
    x.fillStyle = '#7a4e2b';
    x.beginPath();
    x.moveTo(w * 0.3, h);
    x.lineTo(w * 0.7, h);
    x.lineTo(w * 0.6, h * 0.66);
    x.lineTo(w * 0.4, h * 0.66);
    x.fill();
    x.strokeStyle = 'rgba(40,25,10,.6)';
    for (let i = 0; i < 9; i++) {
      const y = h * 0.66 + (i / 9) * h * 0.34;
      x.beginPath();
      x.moveTo(w * (0.4 - (i / 9) * 0.1), y);
      x.lineTo(w * (0.6 + (i / 9) * 0.1), y);
      x.stroke();
    }
    x.strokeStyle = '#333';
    x.lineWidth = 3;
    x.beginPath();
    x.moveTo(w * 0.4, h * 0.66);
    x.lineTo(w * 0.15, 0);
    x.moveTo(w * 0.6, h * 0.66);
    x.lineTo(w * 0.85, 0);
    x.stroke();
  });
  const vp = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 10.8), new THREE.MeshBasicMaterial({ map: view }));
  vp.position.set(0, 5.3, 1.6);
  vp.rotation.y = Math.PI;
  gate.add(vp);
  // the portcullis: an iron grid that rises and drops
  const iron = std(0x2a2a2e, { metalness: 0.7, roughness: 0.4 }),
    port = new THREE.Group();
  for (let i = -3; i <= 3; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 10.6, 0.22), iron);
    bar.position.x = i * 1.1;
    port.add(bar);
  }
  for (let j = 0; j < 6; j++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.22, 0.22), iron);
    bar.position.y = -5 + j * 2;
    port.add(bar);
  }
  port.position.set(0, 5.3, -0.4);
  gate.add(port);
  // banners either side of the arch
  for (const sx of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 7), new THREE.MeshStandardMaterial({ color: sx > 0 ? 0xc7202c : 0x2a4fb8, side: THREE.DoubleSide }));
    b.position.set(sx * 5.6, 12, -1.7);
    gate.add(b);
  }
  // stand it on the wall at angle 0, facing the middle (the stands have a gap here)
  gate.position.set(41.5, 0, 0);
  gate.lookAt(0, 0, 0);
  g.add(gate);
  addTick(g, t => {
    // up for a while, rattle down, wait, back up
    const k = (t % 16) / 16,
      up = k < 0.5 ? 1 : k < 0.6 ? 1 - (k - 0.5) * 10 : k < 0.85 ? 0 : (k - 0.85) / 0.15;
    port.position.y = 5.3 + up * 9.6;
  });
  return g;
}

/* ---------- Digital grid: a 3D bar-graph floor that pulses and cycles through digital colours ---------- */
function extraMatrix(g) {
  const S = 3,
    N = 44,
    cells = [];
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const x = (i - N / 2) * S,
        z = (j - N / 2) * S,
        r = Math.hypot(x, z);
      if (r > 22 && r < 70) cells.push([x, z, r]);
    }
  // each bar is dark glass with a bright lit cap, so the field reads as glowing columns with depth rather than
  // flat pale boxes
  const barG = new THREE.BoxGeometry(S * 0.86, 1, S * 0.86).translate(0, 0.5, 0);
  {
    const p = barG.attributes.position,
      nrm = barG.attributes.normal,
      vc = new Float32Array(p.count * 3);
    for (let k = 0; k < p.count; k++) {
      const top = nrm.getY(k) > 0.5,
        v = top ? 1 : 0.06 + 0.5 * Math.pow(p.getY(k), 3);
      vc[k * 3] = vc[k * 3 + 1] = vc[k * 3 + 2] = v;
    }
    barG.setAttribute('color', new THREE.BufferAttribute(vc, 3));
  }
  const bars = new THREE.InstancedMesh(barG, new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true }), cells.length);
  const o = new THREE.Object3D(),
    col = new THREE.Color();
  cells.forEach(([x, z], i) => {
    o.position.set(x, 0, z);
    o.updateMatrix();
    bars.setMatrixAt(i, o.matrix);
    bars.setColorAt(i, col.setHex(0x1aff6a));
  });
  g.add(bars);
  // the floor under the cage: a glowing hex grid with pulses rippling out from the middle and data streaking
  // along circuit traces; its hue cycles with the rest of the arena
  const floorU = { uT: { value: 0 }, uHue: { value: 0.33 } };
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(13.6, 96),
    new THREE.ShaderMaterial({
      uniforms: floorU,
      transparent: true,
      depthWrite: false,
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `
        uniform float uT, uHue; varying vec2 vP;
        vec3 hsl(float h){ vec3 k = clamp(abs(mod(h*6.0+vec3(0.,4.,2.),6.)-3.)-1., 0., 1.); return k; }
        float hexd(vec2 p){ p = abs(p); return max(dot(p, normalize(vec2(1.,1.732))), p.x); }
        void main(){
          vec2 p = vP * 0.55;
          // hex tiling
          vec2 r = vec2(1., 1.732), h = r * 0.5;
          vec2 a = mod(p, r) - h, b = mod(p - h, r) - h;
          vec2 g = dot(a,a) < dot(b,b) ? a : b;
          float edge = smoothstep(0.06, 0.0, abs(hexd(g) - 0.5));
          float rad = length(vP);
          // rings pulsing outward and a sweeping radar arm
          float ring = smoothstep(0.35, 0.0, abs(fract(rad * 0.18 - uT * 0.5) - 0.5) - 0.42);
          float ang = atan(vP.y, vP.x);
          float sweep = pow(max(0., cos(ang - uT * 1.2)), 24.0);
          // circuit traces: radial spokes with data blobs racing outward
          float spoke = smoothstep(0.05, 0.0, abs(sin(ang * 12.0)) * rad * 0.12);
          float data = spoke * smoothstep(0.7, 1.0, fract(rad * 0.25 - uT * 1.4 + floor(ang * 12.0 / 6.283) * 0.37));
          vec3 col = hsl(uHue);
          vec3 c = col * (0.18 + edge * 0.9 + ring * 0.8 + sweep * 0.6) + vec3(1.) * data * 0.9 + col * spoke * 0.25;
          float fade = smoothstep(13.6, 11.5, rad);
          gl_FragColor = vec4(c, (0.55 + 0.45 * max(edge, ring)) * fade);
        }`,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.04;
  floor.renderOrder = 1;
  g.add(floor);
  // the floor grid and other green bits shift hue with the bars
  const tinted = [];
  g.traverse(m => {
    if (m.material && !m.isInstancedMesh && !m.isSprite && m.material.color && (m.material.wireframe || m.material.map || m.isMesh)) tinted.push(m.material);
  });
  let f = 0;
  addTick(g, t => {
    if (f++ % 2) return; // every other frame is plenty
    cells.forEach(([x, z, r], i) => {
      const h = 0.4 + Math.max(0, Math.sin(x * 0.18 + t * 2.2) + Math.cos(z * 0.15 - t * 1.6) + Math.sin(r * 0.25 - t * 3)) * 3.2;
      o.position.set(x, 0, z);
      o.scale.set(1, h, 1);
      o.updateMatrix();
      bars.setMatrixAt(i, o.matrix);
      // hue runs green → cyan → blue → purple → magenta and back, rippling out from the middle
      const hue = (0.33 + 0.5 * (0.5 + 0.5 * Math.sin(t * 0.35 - r * 0.06))) % 1;
      bars.setColorAt(i, col.setHSL(hue, 1, 0.35 + Math.min(0.3, h * 0.04)));
    });
    bars.instanceMatrix.needsUpdate = true;
    bars.instanceColor.needsUpdate = true;
    const hue = (0.33 + 0.5 * (0.5 + 0.5 * Math.sin(t * 0.35))) % 1;
    floorU.uT.value = t;
    floorU.uHue.value = hue;
    tinted.forEach(m => m.color.setHSL(hue, 0.9, m.map ? 0.75 : 0.55));
  });
  return g;
}

/* ---------- Back garden: short grass inside the arena so the floor isn't flat green ---------- */
function extraGarden(g) {
  const rnd = seeded(331);
  const blade = (() => {
    const pos = [],
      colr = [],
      idx = [];
    for (let i = 0; i <= 3; i++) {
      const f = i / 3,
        w = 0.09 * (1 - f) + 0.01;
      pos.push(-w, f, f * f * 0.25, w, f, f * f * 0.25);
      const c = new THREE.Color(0x2f6f22).lerp(new THREE.Color(0x8fcf52), f);
      colr.push(c.r, c.g, c.b, c.r, c.g, c.b);
      if (i < 3) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  })();
  const n = 4200,
    im = new THREE.InstancedMesh(blade, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 }), n),
    o = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    const a = rnd() * 6.28,
      r = 4.2 + Math.sqrt(rnd()) * 9.4,
      h = 0.25 + rnd() * 0.55;
    o.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    o.rotation.set(0, rnd() * 6.28, (rnd() - 0.5) * 0.4);
    o.scale.set(1, h, h);
    o.updateMatrix();
    im.setMatrixAt(i, o.matrix);
  }
  g.add(im);
  return g;
}

export { extraCastle, extraGarden, extraMatrix };
