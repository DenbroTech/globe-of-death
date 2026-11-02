import * as THREE from 'three';
import { cv, tex } from '../render/textures.js';
import { NEON_T } from '../render/neon.js';

/* ---------- bikes ---------- */
/* ---------- garage catalogue ---------- */
/* ---------- finishes: seamless canvas textures, projected from three sides so they never stretch ---------- */
const FIN_CACHE = {};
function seam(x, S, fn) {
  for (const dx of [-S, 0, S])
    for (const dy of [-S, 0, S]) {
      x.save();
      x.translate(dx, dy);
      fn();
      x.restore();
    }
}
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
const FIN_GEN = {
  flames(x, S, r) {
    /* classic hot-rod flames: a hot yellow root on one edge, tongues of different lengths that taper
       fast and curl at sharp tips, yellow -> orange -> red, outlined with a thin blue pinstripe.
       Tiles vertically only; each tile starts a fresh burst horizontally. */
    x.fillStyle = '#08080b';
    x.fillRect(0, 0, S, S);
    // mirrored so the root sits at the front of the bike (+z) and the tips trail backwards
    x.translate(S, 0);
    x.scale(-1, 1);
    const vseam = fn => [-S, 0, S].forEach(dy => { x.save(); x.translate(0, dy); fn(); x.restore(); });
    const tongue = (y0, len, w, ph, curl) => {
      const top = [],
        bot = [],
        n = 48;
      for (let i = 0; i <= n; i++) {
        const u = i / n,
          px = u * len,
          cy = y0 + Math.sin(u * 4.2 + ph) * w * 0.9 * u + curl * Math.pow(u, 3) * w * 2.2,
          hw = w * Math.pow(1 - u, 1.35) * (0.82 + 0.18 * Math.sin(u * 9 + ph));
        top.push([px, cy - hw]);
        bot.push([px, cy + hw]);
      }
      x.beginPath();
      x.moveTo(-4, top[0][1]);
      top.forEach(p => x.lineTo(p[0], p[1]));
      for (let i = bot.length - 1; i >= 0; i--) x.lineTo(bot[i][0], bot[i][1]);
      x.lineTo(-4, bot[0][1]);
      x.closePath();
    };
    const grad = len => {
      const g = x.createLinearGradient(0, 0, len, 0);
      g.addColorStop(0, '#fff6c0');
      g.addColorStop(0.16, '#ffd400');
      g.addColorStop(0.42, '#ff8c00');
      g.addColorStop(0.72, '#f0290b');
      g.addColorStop(1, '#9c0508');
      return g;
    };
    const T = [];
    for (let k = 0; k < 5; k++)
      T.push({
        y: (k + 0.5) * (S / 5) + (r() - 0.5) * 10,
        len: S * (0.62 + r() * 0.36),
        w: S * (0.085 + r() * 0.035),
        ph: r() * 6,
        curl: (r() < 0.5 ? -1 : 1) * (0.4 + r() * 0.6),
      });
    T.sort((a, b) => a.len - b.len).reverse();
    vseam(() => {
      /* outline pass first (thick blue), then fill: gives a clean pinstripe around the whole burst */
      x.lineJoin = 'round';
      T.forEach(t => {
        tongue(t.y, t.len, t.w, t.ph, t.curl);
        x.lineWidth = 3.2;
        x.strokeStyle = '#4fc3ff';
        x.stroke();
      });
      T.forEach(t => {
        tongue(t.y, t.len, t.w, t.ph, t.curl);
        x.fillStyle = grad(t.len);
        x.fill();
      });
      T.forEach(t => {
        tongue(t.y + t.w * 0.1, t.len * 0.45, t.w * 0.45, t.ph + 0.2, t.curl * 0.5);
        x.fillStyle = 'rgba(255,250,215,.8)';
        x.fill();
      });
    });
  },
  carbon(x, S) {
    x.fillStyle = '#101114';
    x.fillRect(0, 0, S, S);
    const n = 16,
      w = S / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const h = (i + j) % 2 === 0,
          g = h ? x.createLinearGradient(i * w, 0, i * w + w, 0) : x.createLinearGradient(0, j * w, 0, j * w + w);
        g.addColorStop(0, '#1b1d22');
        g.addColorStop(0.5, h ? '#3a3e47' : '#2b2e35');
        g.addColorStop(1, '#16171b');
        x.fillStyle = g;
        x.fillRect(i * w + 1, j * w + 1, w - 2, w - 2);
      }
  },
  camo(x, S, r) {
    x.fillStyle = '#5b6b3a';
    x.fillRect(0, 0, S, S);
    for (const col of ['#3d4a25', '#8a8250', '#2a2418', '#6f7d45'])
      for (let k = 0; k < 9; k++) {
        const cx = r() * S,
          cy = r() * S,
          rad = S * (0.05 + r() * 0.08);
        seam(x, S, () => {
          x.fillStyle = col;
          x.beginPath();
          for (let a = 0; a < 6.28; a += 0.5) {
            const rr = rad * (0.7 + r() * 0.6);
            x.lineTo(cx + Math.cos(a) * rr * 1.4, cy + Math.sin(a) * rr);
          }
          x.fill();
        });
      }
  },
  tiger(x, S, r) {
    x.fillStyle = '#ff8a1a';
    x.fillRect(0, 0, S, S);
    x.fillStyle = '#120c08';
    for (let k = 0; k < 9; k++) {
      const y0 = (k * S) / 9 + r() * 8,
        th = 4 + r() * 9;
      seam(x, S, () => {
        x.beginPath();
        x.moveTo(0, y0);
        for (let u = 0; u <= S; u += S / 8) x.lineTo(u, y0 + Math.sin((u / S) * 6.28 * 2 + k) * 10 - th * (0.5 + r()));
        for (let u = S; u >= 0; u -= S / 8)
          x.lineTo(u, y0 + Math.sin((u / S) * 6.28 * 2 + k) * 10 + th * (0.3 + r() * 0.7));
        x.fill();
      });
    }
  },
  checker(x, S) {
    const n = 8,
      w = S / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        x.fillStyle = (i + j) % 2 ? '#f4f4f4' : '#111';
        x.fillRect(i * w, j * w, w, w);
      }
  },
  galaxy(x, S, r) {
    const g = x.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, '#0b0628');
    g.addColorStop(0.5, '#1b0b45');
    g.addColorStop(1, '#07122e');
    x.fillStyle = g;
    x.fillRect(0, 0, S, S);
    for (const col of ['rgba(255,60,200,.22)', 'rgba(80,140,255,.22)', 'rgba(150,60,255,.25)'])
      for (let k = 0; k < 5; k++) {
        const cx = r() * S,
          cy = r() * S,
          rad = S * (0.12 + r() * 0.18);
        seam(x, S, () => {
          const rg = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
          rg.addColorStop(0, col);
          rg.addColorStop(1, 'rgba(0,0,0,0)');
          x.fillStyle = rg;
          x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
        });
      }
    for (let k = 0; k < 220; k++) {
      x.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.6})`;
      const s = r() < 0.08 ? 2.4 : 1.1;
      x.fillRect(r() * S, r() * S, s, s);
    }
  },
  lightning(x, S, r) {
    x.fillStyle = '#071330';
    x.fillRect(0, 0, S, S);
    x.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      let px = r() * S,
        py = -10;
      const pts = [[px, py]];
      while (py < S + 10) {
        px += (r() - 0.5) * S * 0.18;
        py += S * (0.06 + r() * 0.07);
        pts.push([px, py]);
      }
      seam(x, S, () => {
        for (const [w, c] of [
          [9, 'rgba(60,170,255,.25)'],
          [4, '#5fd0ff'],
          [1.6, '#f2fbff'],
        ]) {
          x.strokeStyle = c;
          x.lineWidth = w;
          x.beginPath();
          pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b)));
          x.stroke();
        }
      });
    }
  },
  holo(x, S) {
    const g = x.createLinearGradient(0, 0, S, S);
    ['#ff8ad8', '#8ab4ff', '#7affd4', '#fff38a', '#ff9a8a', '#ff8ad8'].forEach((c, i, a) =>
      g.addColorStop(i / (a.length - 1), c),
    );
    x.fillStyle = g;
    x.fillRect(0, 0, S, S);
    x.globalAlpha = 0.35;
    const h = x.createLinearGradient(S, 0, 0, S);
    ['#ffffff', '#b9a0ff', '#ffffff', '#9affff', '#ffffff'].forEach((c, i, a) => h.addColorStop(i / (a.length - 1), c));
    x.fillStyle = h;
    x.fillRect(0, 0, S, S);
    x.globalAlpha = 1;
  },
  leopard(x, S, r) {
    x.fillStyle = '#e0a84f';
    x.fillRect(0, 0, S, S);
    for (let k = 0; k < 26; k++) {
      const cx = r() * S,
        cy = r() * S,
        rad = S * (0.03 + r() * 0.025);
      seam(x, S, () => {
        x.fillStyle = '#8a4f1c';
        x.beginPath();
        x.ellipse(cx, cy, rad, rad * 0.8, r() * 3, 0, 6.28);
        x.fill();
        x.strokeStyle = '#1a1008';
        x.lineWidth = rad * 0.5;
        x.beginPath();
        x.arc(cx, cy, rad * 1.15, r() * 6, r() * 6 + 4.2);
        x.stroke();
      });
    }
  },
  zebra(x, S, r) {
    x.fillStyle = '#f2efe8';
    x.fillRect(0, 0, S, S);
    x.fillStyle = '#111';
    for (let k = 0; k < 10; k++) {
      const y0 = (k * S) / 10,
        ph = r() * 6;
      seam(x, S, () => {
        x.beginPath();
        x.moveTo(0, y0);
        for (let u = 0; u <= S; u += S / 16) x.lineTo(u, y0 + Math.sin((u / S) * 6.28 * 2 + ph) * S * 0.04);
        for (let u = S; u >= 0; u -= S / 16)
          x.lineTo(u, y0 + S * 0.045 + Math.sin((u / S) * 6.28 * 2 + ph) * S * 0.04 * (1 + 0.3 * Math.sin(u * 0.05)));
        x.fill();
      });
    }
  },
  lava(x, S, r) {
    x.fillStyle = '#ff5a0a';
    x.fillRect(0, 0, S, S);
    const pts = [...Array(22)].map(() => [r() * S, r() * S]);
    const id = x.getImageData(0, 0, S, S),
      d = id.data;
    for (let j = 0; j < S; j++)
      for (let i = 0; i < S; i++) {
        let a = 1e9,
          b = 1e9;
        for (const [px, py] of pts) {
          let dx = Math.abs(i - px),
            dy = Math.abs(j - py);
          dx = Math.min(dx, S - dx);
          dy = Math.min(dy, S - dy);
          const q = dx * dx + dy * dy;
          if (q < a) {
            b = a;
            a = q;
          } else if (q < b) b = q;
        }
        const e = Math.sqrt(b) - Math.sqrt(a),
          k = (j * S + i) * 4,
          hot = Math.max(0, 1 - e / 5);
        d[k] = 20 + 235 * hot;
        d[k + 1] = 14 + 150 * hot * hot;
        d[k + 2] = 12 + 40 * hot * hot * hot;
        d[k + 3] = 255;
      }
    x.putImageData(id, 0, 0);
  },
  stripes(x, S) {
    x.fillStyle = '#1d4ed8';
    x.fillRect(0, 0, S, S);
    x.fillStyle = '#f5f5f5';
    x.fillRect(0, S * 0.22, S, S * 0.56);
    x.fillStyle = '#e11d48';
    x.fillRect(0, S * 0.3, S, S * 0.4);
    x.fillStyle = '#f5f5f5';
    x.fillRect(0, S * 0.47, S, S * 0.06);
  },
  tubes(x, S) {
    x.fillStyle = '#0c0a14';
    x.fillRect(0, 0, S, S);
    x.lineCap = 'round';
    [
      ['#ff2fd0', 0.2],
      ['#22d3ff', 0.5],
      ['#39ff6a', 0.8],
    ].forEach(([c, y0], k) => {
      for (const [w, a] of [
        [16, 0.18],
        [9, 0.4],
        [4, 1],
      ]) {
        x.strokeStyle = c;
        x.globalAlpha = a;
        x.lineWidth = w;
        x.beginPath();
        for (let u = 0; u <= S; u += 4) x.lineTo(u, S * y0 + Math.sin((u / S) * 6.283 * 2 + k * 2) * S * 0.07);
        x.stroke();
      }
      x.globalAlpha = 1;
      x.strokeStyle = '#ffffff';
      x.lineWidth = 1.4;
      x.beginPath();
      for (let u = 0; u <= S; u += 4) x.lineTo(u, S * y0 + Math.sin((u / S) * 6.283 * 2 + k * 2) * S * 0.07);
      x.stroke();
    });
  },
  synth(x, S) {
    x.fillStyle = '#14051f';
    x.fillRect(0, 0, S, S);
    for (const [w, c] of [
      [7, 'rgba(255,40,200,.28)'],
      [2.2, '#ff3fd0'],
    ]) {
      x.strokeStyle = c;
      x.lineWidth = w;
      for (let k = 0; k <= 8; k++) {
        const p = (k * S) / 8;
        x.beginPath();
        x.moveTo(p, 0);
        x.lineTo(p, S);
        x.moveTo(0, p);
        x.lineTo(S, p);
        x.stroke();
      }
    }
  },
  snake(x, S) {
    x.fillStyle = '#1f3b1a';
    x.fillRect(0, 0, S, S);
    const n = 10,
      w = S / n;
    for (let j = 0; j <= n * 2; j++)
      for (let i = -1; i <= n; i++) {
        const cx = i * w + (j % 2 ? w / 2 : 0),
          cy = (j * w) / 2,
          g = x.createRadialGradient(cx, cy - w * 0.15, 1, cx, cy, w * 0.6);
        g.addColorStop(0, '#9be36a');
        g.addColorStop(0.6, '#3f7a2a');
        g.addColorStop(1, '#0e1f0b');
        x.fillStyle = g;
        x.beginPath();
        x.ellipse(cx, cy, w * 0.52, w * 0.4, 0, 0, 6.28);
        x.fill();
      }
  },
  dalmatian(x, S, r) {
    x.fillStyle = '#f7f5f0';
    x.fillRect(0, 0, S, S);
    x.fillStyle = '#141414';
    for (let k = 0; k < 22; k++) {
      const cx = r() * S,
        cy = r() * S,
        rad = S * (0.02 + r() * 0.035);
      seam(x, S, () => {
        x.beginPath();
        x.ellipse(cx, cy, rad, rad * (0.7 + r() * 0.4), r() * 3, 0, 6.28);
        x.fill();
      });
    }
  },
};
/* which finishes glow in the dark, and how many repeats per metre of bike */
const FIN_META = {
  tubes: { scale: 1.3, glow: 1.6 },
  // flow: the pattern drifts across the surface (metres per second); flick: the glow flickers like a strike
  flames: { scale: 1.5, glow: 0.5, flow: [0, 0.16, -0.32] },
  lightning: { scale: 1.3, glow: 1.1, flow: [0.06, -0.3, 0.22], flick: 1 },
  lava: { scale: 1.6, glow: 1, flow: [0.03, -0.05, 0.04] },
  synth: { scale: 2.2, glow: 0.9, flow: [0, 0, -0.35] },
  galaxy: { scale: 1.3, glow: 0.35, flow: [0.02, 0.01, 0.03] },
  holo: { scale: 1, flow: [0.08, 0.06, 0] },
  carbon: { scale: 6 },
  camo: { scale: 1.4 },
  tiger: { scale: 1.4 },
  checker: { scale: 2.2 },
  leopard: { scale: 1.6 },
  zebra: { scale: 1.4 },
  stripes: { scale: 0.75 },
  snake: { scale: 3.6 },
  dalmatian: { scale: 1.5 },
};
function finishTex(id) {
  if (FIN_CACHE[id]) return FIN_CACHE[id];
  const S = 256,
    [c, x] = cv(S, S);
  FIN_GEN[id](x, S, rng(id.length * 977 + id.charCodeAt(0) * 31));
  const t = tex(c, true);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const M = FIN_META[id] || {};
  return (FIN_CACHE[id] = { map: t, scale: M.scale || 3, glow: M.glow || 0, flow: M.flow, flick: M.flick, url: c.toDataURL('image/png') });
}
function triplanar(mat, scale, waves, flow, flick) {
  const F = flow ? `vec3(${flow.map(v => v.toFixed(3)).join(',')})` : 'vec3(0.)';
  // triOff shifts the pattern (e.g. flames start at the front of the tank)
  mat.userData.triOff = mat.userData.triOff || { value: new THREE.Vector3() };
  mat.onBeforeCompile = sh => {
    sh.uniforms.triS = { value: scale };
    sh.uniforms.uNT = NEON_T;
    sh.uniforms.triOff = mat.userData.triOff;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTriP;\nvarying vec3 vTriN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTriP=position;vTriN=normal;');
    /* waves: colours roll through the rainbow and a bright pulse travels along the surface */
    const wave = waves
      ? `{float wp=dot(vTriP,vec3(1.3,.9,1.1));float wa=uNT*1.8+wp*2.2;const vec3 wk=vec3(.57735);float wc=cos(wa);
        tcol.rgb=max(tcol.rgb*wc+cross(wk,tcol.rgb)*sin(wa)+wk*dot(wk,tcol.rgb)*(1.-wc),0.)*(.7+.45*sin(uNT*5.-wp*7.));}`
      : '';
    const tri = s =>
      `vec3 tw=pow(abs(normalize(vTriN)),vec3(4.0));tw/=(tw.x+tw.y+tw.z);vec3 tp=vTriP+triOff+${F}*uNT;vec4 tcol=texture2D(${s},tp.zy*triS)*tw.x+texture2D(${s},tp.zx*triS)*tw.y+texture2D(${s},tp.xy*triS)*tw.z;${wave}`;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float triS;uniform float uNT;uniform vec3 triOff;\nvarying vec3 vTriP;\nvarying vec3 vTriN;')
      .replace('#include <map_fragment>', `#ifdef USE_MAP\n${tri('map')}diffuseColor*=mapTexelToLinear(tcol);\n#endif`)
      .replace(
        '#include <emissivemap_fragment>',
        `#ifdef USE_EMISSIVEMAP\n{${tri('emissiveMap')}totalEmissiveRadiance*=emissiveMapTexelToLinear(tcol).rgb;${
          flick ? 'float fk=fract(sin(floor(uNT*11.)*12.9898)*43758.5);totalEmissiveRadiance*=fk>.82?1.9:.65+.25*sin(uNT*37.);' : ''
        }}\n#endif`,
      );
  };
  mat.customProgramCacheKey = () => 'tri' + scale + (waves ? 'w' : '') + F + (flick ? 'k' : '');
}
/* neon tube look for any surface: white-hot where it faces you, saturated colour toward the edges,
   and a live buzz (fast hum + the odd stutter, each material on its own phase) */
const NEON_BUZZ = `float nbT=uNT+uNPh;float nbz=.86+.09*sin(nbT*41.)*sin(nbT*27.3)+.05*sin(nbT*9.1);
  float nbs=fract(sin(floor(nbT*9.)*91.7+uNPh)*4375.5);nbz*=nbs>.94?.45+.4*fract(nbT*53.):1.;`;
function neonTube(mat) {
  const ph = Math.random() * 100;
  mat.onBeforeCompile = sh => {
    sh.uniforms.uNT = NEON_T;
    sh.uniforms.uNPh = { value: ph };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNT;uniform float uNPh;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {float nf=abs(dot(normalize(normal),normalize(vViewPosition)));
        vec3 rim=totalEmissiveRadiance*1.5;vec3 core=mix(totalEmissiveRadiance,vec3(1.),.75)*1.25;
        ${NEON_BUZZ}totalEmissiveRadiance=mix(rim,core,pow(nf,2.2))*nbz;}`,
      );
  };
  mat.customProgramCacheKey = () => 'neonTube';
}
/* catalogue colours are picked as screen (sRGB) colours, like the swatches in the garage;
   three r128 treats material colours as linear, so convert or they come out washed out */
const deep = hex => new THREE.Color(hex).convertSRGBToLinear();
function applyFinish(mat, it) {
  if (!it) return mat;
  if (it.metal != null) {
    mat.metalness = it.metal;
    mat.roughness = it.rough ?? 0.3;
  } else if (it.rough != null) mat.roughness = it.rough;
  if (it.neon) {
    mat.userData.neon = it.c;
    mat.color.set(0x000000);
    mat.emissive.copy(deep(it.c));
    mat.emissiveIntensity = 1;
    mat.toneMapped = false;
    mat.emissiveMap = null;
    mat.map = null;
    mat.metalness = 0;
    mat.roughness = 0.35;
    neonTube(mat);
    mat.needsUpdate = true;
    return mat;
  }
  if (it.tex) {
    const T = finishTex(it.tex);
    mat.map = T.map;
    mat.color.set(0xffffff);
    if (T.glow) {
      mat.emissiveMap = T.map;
      mat.emissive.set(0xffffff);
      mat.emissiveIntensity = T.glow;
    } else {
      mat.emissiveMap = null;
      if (!mat.transparent) mat.emissive.set(0);
    }
    mat.userData.triScale = T.scale;
    triplanar(mat, T.scale, it.tex === 'tubes', T.flow, T.flick);
  } else mat.color.copy(deep(it.c));
  mat.needsUpdate = true;
  return mat;
}
const finishCss = it =>
  it.neon
    ? `radial-gradient(circle at 50% 45%,#fff 0 12%,#${it.c.toString(16).padStart(6, '0')} 42%,#${it.c.toString(16).padStart(6, '0')}99 100%)`
    : it.tex
      ? `url(${finishTex(it.tex).url}) center/180% repeat`
      : it.metal >= 0.8
        ? `radial-gradient(circle at 35% 30%,#fff 0 6%,#${it.c.toString(16).padStart(6, '0')} 40%,#000 120%)`
        : '#' + it.c.toString(16).padStart(6, '0');

export { NEON_BUZZ, applyFinish, deep, finishCss, triplanar };
