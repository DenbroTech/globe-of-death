import * as THREE from 'three';
import { sharkGeo } from './props.js';
import { V3 } from '../core/constants.js';
import { rand } from './life.js';

let bubbleMat;

/* ---------- sea life: real-looking fish species and sharks, with a swimming tail wag ---------- */
function mergeG(parts) {
  let n = 0;
  parts.forEach(g => (n += g.attributes.position.count));
  const pos = new Float32Array(n * 3),
    nor = new Float32Array(n * 3),
    col = new Float32Array(n * 3),
    idx = [];
  let o = 0;
  parts.forEach(g => {
    const P = g.attributes.position,
      N = g.attributes.normal,
      C = g.attributes.color;
    for (let i = 0; i < P.count; i++) {
      const j = (o + i) * 3;
      pos[j] = P.getX(i);
      pos[j + 1] = P.getY(i);
      pos[j + 2] = P.getZ(i);
      nor[j] = N.getX(i);
      nor[j + 1] = N.getY(i);
      nor[j + 2] = N.getZ(i);
      col[j] = C.getX(i);
      col[j + 1] = C.getY(i);
      col[j + 2] = C.getZ(i);
    }
    if (g.index) {
      const I = g.index.array;
      for (let k = 0; k < I.length; k++) idx.push(I[k] + o);
    } else for (let k = 0; k < P.count; k++) idx.push(k + o);
    o += P.count;
  });
  const G = new THREE.BufferGeometry();
  G.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  G.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  G.setAttribute('color', new THREE.BufferAttribute(col, 3));
  G.setIndex(idx);
  return G;
}
function paintG(g, fn) {
  const P = g.attributes.position,
    N = g.attributes.normal,
    c = new Float32Array(P.count * 3),
    tc = new THREE.Color();
  for (let i = 0; i < P.count; i++) {
    const v = fn(P.getX(i), P.getY(i), P.getZ(i), N.getX(i), N.getY(i), N.getZ(i));
    tc.set(v);
    c[i * 3] = tc.r;
    c[i * 3 + 1] = tc.g;
    c[i * 3 + 2] = tc.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
function triG(pts) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts.flat()), 3));
  g.computeVertexNormals();
  return g;
}
/* spec: W,H half width/height, body colour fn(x,y,z), fin colour, tail colour, dorsal height */
function fishGeo(sp) {
  const body = new THREE.SphereGeometry(1, 26, 16);
  body.scale(sp.W, sp.H, 0.5);
  paintG(body, (x, y, z, nx, ny) => sp.body(x / sp.W, y / sp.H, z, ny));
  const th = sp.tailH || 0.3,
    tail = paintG(
      triG([
        [0, 0, -0.42],
        [0, th, -0.8],
        [0, 0, -0.66],
        [0, 0, -0.42],
        [0, 0, -0.66],
        [0, -th, -0.8],
      ]),
      (x, y, z) => sp.tail(z, y),
    );
  const dh = sp.dorsal || 0.18,
    dor = paintG(
      triG([
        [0, sp.H * 0.92, 0.2],
        [0, sp.H + dh, -0.05],
        [0, sp.H * 0.8, -0.36],
      ]),
      (x, y) => sp.fin(y),
    );
  const ven = paintG(
    triG([
      [0, -sp.H * 0.9, 0.05],
      [0, -sp.H - dh * 0.6, -0.12],
      [0, -sp.H * 0.75, -0.32],
    ]),
    (x, y) => sp.fin(y),
  );
  const pec = [1, -1].map(s =>
    paintG(
      triG([
        [s * sp.W * 0.9, -sp.H * 0.2, 0.18],
        [s * (sp.W + 0.16), -sp.H * 0.45, 0.02],
        [s * sp.W * 0.9, -sp.H * 0.35, -0.02],
      ]),
      () => sp.finCol || '#ffffff',
    ),
  );
  const eyes = [1, -1].map(s => {
    const e = new THREE.SphereGeometry(Math.max(0.035, sp.H * 0.16), 8, 6);
    e.translate(s * sp.W * 0.78, sp.H * 0.25, 0.3);
    return paintG(e, (x, y, z, nx) => (Math.abs(nx) > 0.85 ? '#05070a' : '#f4f4f4'));
  });
  const g = mergeG([body, tail, dor, ven, ...pec, ...eyes]);
  g.scale(sp.size, sp.size, sp.size);
  return g;
}
const band = (z, c, w = 0.05) => Math.abs(z - c) < w;
const FISH = {
  clown: {
    size: 0.55,
    W: 0.2,
    H: 0.24,
    dorsal: 0.14,
    tailH: 0.24,
    n: 26,
    body: (x, y, z) => {
      for (const c of [0.22, -0.02, -0.32]) {
        if (band(z, c, 0.055)) return '#ffffff';
        if (band(z, c, 0.075)) return '#111111';
      }
      return '#ff6a0d';
    },
    fin: () => '#ff7a1a',
    tail: z => (z < -0.74 ? '#111111' : '#ff7a1a'),
  },
  tang: {
    size: 0.68,
    W: 0.13,
    H: 0.34,
    dorsal: 0.1,
    tailH: 0.28,
    n: 30,
    body: (x, y, z) =>
      y > 0.05 && y < 0.55 && z < 0.32 && z > -0.38 && !(y > 0.2 && y < 0.4 && z < 0.2 && z > -0.2)
        ? '#0b0d1a'
        : '#1d5fe6',
    fin: y => '#0b1c66',
    tail: () => '#ffd23f',
    finCol: '#1d5fe6',
  },
  yellow: {
    size: 0.58,
    W: 0.11,
    H: 0.4,
    dorsal: 0.16,
    tailH: 0.26,
    n: 30,
    body: (x, y, z) => (band(z, -0.4, 0.03) && Math.abs(y) < 0.3 ? '#ffffff' : '#ffe034'),
    fin: () => '#ffd000',
    tail: () => '#ffd000',
    finCol: '#ffe034',
  },
  angel: {
    size: 0.75,
    W: 0.09,
    H: 0.46,
    dorsal: 0.38,
    tailH: 0.3,
    n: 16,
    body: (x, y, z) =>
      band(z, 0.24, 0.035) || band(z, 0.0, 0.05) || band(z, -0.26, 0.035) ? '#141414' : y > 0.4 ? '#ffd84a' : '#dfe7ef',
    fin: y => (y > 0 ? '#ffd84a' : '#141414'),
    tail: () => '#e8e8e8',
    finCol: '#dfe7ef',
  },
  sardine: {
    size: 0.42,
    W: 0.09,
    H: 0.12,
    dorsal: 0.06,
    tailH: 0.16,
    n: 150,
    body: (x, y, z, ny) => (y > 0.25 ? '#2f6a9a' : y > -0.1 ? '#a9c8de' : '#eef4f8'),
    fin: () => '#b9d0e0',
    tail: () => '#9fbcd2',
    finCol: '#cfe0ec',
  },
};
function swimMat(freq, amp) {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.45,
    metalness: 0.12,
    side: THREE.DoubleSide,
  });
  m.userData.u = { uTime: { value: 0 }, uFreq: { value: freq }, uAmp: { value: amp } };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, m.userData.u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;uniform float uFreq;uniform float uAmp;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nfloat ph=0.0;\n#ifdef USE_INSTANCING\nph=instanceMatrix[3].x*1.3+instanceMatrix[3].z*.7+instanceMatrix[3].y*2.1;\n#endif\nfloat tw=smoothstep(.15,-.9,position.z);transformed.x+=sin(uTime*uFreq+ph-position.z*3.2)*uAmp*tw;',
      );
  };
  m.customProgramCacheKey = () => 'swim' + freq;
  return m;
}
function makeSeaLife(g) {
  const mats = [],
    o = new THREE.Object3D(),
    groups = [];
  const plans = {
    clown: [
      [7, 3, 0.35],
      [11, 6, -0.3],
    ],
    tang: [
      [9, 9, 0.28],
      [16, 4, -0.24],
      [24, 13, 0.2],
    ],
    yellow: [
      [13, 7, -0.3],
      [20, 16, 0.26],
    ],
    angel: [
      [10, 12, 0.22],
      [18, 5, -0.2],
    ],
  };
  for (const k in FISH) {
    const sp = FISH[k],
      m = swimMat(k === 'sardine' ? 16 : 11, k === 'sardine' ? 0.05 : 0.09);
    mats.push(m);
    const im = new THREE.InstancedMesh(fishGeo(sp), m, sp.n);
    im.frustumCulled = false;
    g.add(im);
    const fd = [];
    for (let i = 0; i < sp.n; i++) {
      if (k === 'sardine')
        fd.push({
          u: new V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
            .normalize()
            .multiplyScalar(0.6 + Math.random() * 2.2),
          ph: Math.random() * 6,
        });
      else {
        const pl = plans[k][i % plans[k].length];
        fd.push({
          r: pl[0] + rand(-1.2, 1.2),
          h: pl[1] + rand(-1.5, 1.5),
          w: pl[2] * rand(0.85, 1.15),
          o: rand(-0.5, 0.5),
          ph: rand(0, 6),
        });
      }
    }
    groups.push({ k, im, fd });
  }
  const sm = swimMat(4, 0.16);
  mats.push(sm);
  const sg = sharkGeo();
  const sharks = [
    [13, 6, 0.13, 0],
    [20, 11, -0.1, 2],
    [28, 4, 0.08, 4],
  ].map(([r, h, w, ph]) => {
    const s = new THREE.Mesh(sg, sm);
    s.scale.setScalar(2.1);
    s.castShadow = true;
    g.add(s);
    return { s, r, h, w, ph };
  });
  const ball = new V3(),
    q = new THREE.Quaternion(),
    eu = new THREE.Euler();
  return t => {
    mats.forEach(m => (m.userData.u.uTime.value = t));
    for (const G of groups) {
      const { k, im, fd } = G;
      if (k === 'sardine') {
        const a = t * 0.18;
        ball.set(Math.cos(a) * 10, 9 + Math.sin(t * 0.4) * 2, Math.sin(a) * 10);
        fd.forEach((f, i) => {
          const sp = t * 1.4 + f.ph;
          o.position.set(
            ball.x + f.u.x * Math.cos(sp) - f.u.z * Math.sin(sp),
            ball.y + f.u.y * 0.6 + Math.sin(t * 2 + f.ph) * 0.2,
            ball.z + f.u.x * Math.sin(sp) + f.u.z * Math.cos(sp),
          );
          o.lookAt(
            ball.x + f.u.x * Math.cos(sp + 0.2) - f.u.z * Math.sin(sp + 0.2),
            o.position.y,
            ball.z + f.u.x * Math.sin(sp + 0.2) + f.u.z * Math.cos(sp + 0.2),
          );
          o.updateMatrix();
          im.setMatrixAt(i, o.matrix);
        });
      } else
        fd.forEach((f, i) => {
          const a = t * f.w + f.o,
            y = f.h + Math.sin(t * 0.9 + f.ph) * 0.5;
          o.position.set(Math.cos(a) * f.r, y, Math.sin(a) * f.r);
          const s = Math.sign(f.w);
          o.lookAt(Math.cos(a + 0.08 * s) * f.r, y + Math.cos(t * 0.9 + f.ph) * 0.05, Math.sin(a + 0.08 * s) * f.r);
          o.updateMatrix();
          im.setMatrixAt(i, o.matrix);
        });
      im.instanceMatrix.needsUpdate = true;
    }
    sharks.forEach(S => {
      const a = t * S.w + S.ph,
        r = S.r + Math.sin(t * 0.13 + S.ph) * 5,
        y = S.h + Math.sin(t * 0.21 + S.ph) * 2;
      S.s.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      const s = Math.sign(S.w);
      S.s.lookAt(Math.cos(a + 0.06 * s) * r, y, Math.sin(a + 0.06 * s) * r);
      S.s.rotateZ(-s * 0.18);
    });
  };
}

export function initSealife() {
  /* the globe becomes a soap-bubble underwater */
  bubbleMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `#include <common>\n#include <logdepthbuf_pars_vertex>\nvarying vec3 vN;varying vec3 vV;varying vec3 vP;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);vP=position;gl_Position=projectionMatrix*mv;\n#include <logdepthbuf_vertex>\n}`,
    fragmentShader: `#include <common>\n#include <logdepthbuf_pars_fragment>\nuniform float uTime;varying vec3 vN;varying vec3 vV;varying vec3 vP;
    vec3 hue(float h){return clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.);}
    void main(){\n#include <logdepthbuf_fragment>\nfloat f=1.-abs(dot(normalize(vN),normalize(vV)));float rim=pow(f,2.2);
      float sw=sin(vP.y*2.1+uTime*.7)*.5+sin(vP.x*1.7-uTime*.5)*.5;vec3 c=mix(vec3(.75,.95,1.),hue(f*1.4+sw*.25+uTime*.03),.55);
      float spec=pow(max(0.,dot(normalize(vN),normalize(vec3(.4,.8,.45)))),40.)*.9;gl_FragColor=vec4(c*(.35+rim)+spec,.06+rim*.55+spec);}`,
  });
}

export { bubbleMat, makeSeaLife, mergeG, paintG };
