import * as THREE from 'three';
import { V3 } from '../core/constants.js';
import { sculptGeo } from '../rider/rider.js';
import { mergeG, paintG } from './sealife.js';

/* ---------- arena props: shaped models built from profiles, not primitives ---------- */

const greyCol = (g, c) => {
  if (!g.attributes.color)
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(c), 3));
  return g;
};
/* a flat outline (array of [a,b] points) extruded thin, with soft bevelled edges */
const finGeo = (pts, depth, bevel = 0.012) => {
  const s = new THREE.Shape();
  pts.forEach(([a, b], i) => (i ? s.lineTo(a, b) : s.moveTo(a, b)));
  const g = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 8,
  });
  g.translate(0, 0, -depth / 2);
  return g;
};
const curve = (a, b, c, n = 10) => new THREE.QuadraticBezierCurve(new THREE.Vector2(...a), new THREE.Vector2(...b), new THREE.Vector2(...c)).getPoints(n).map(p => [p.x, p.y]);

/* Dolphin, nose toward +z, back up. Beak, melon, deep chest, thin tail stock, swept dorsal fin,
   crescent flukes, sickle flippers; dark back fading to a pale belly. Grey values go in the colour attribute. */
function dolphinGeo() {
  const shade = (t, n) => {
    const belly = THREE.MathUtils.smoothstep(-n.y, -0.05, 0.55);
    return 0.16 + 0.84 * belly;
  };
  const body = sculptGeo(
    new V3(0, 0, -0.92),
    new V3(0, 0, 1.0),
    new V3(0, 1, 0),
    [
      [0, 0.02, 0.03],
      [0.1, 0.045, 0.085, 0.01],
      [0.3, 0.12, 0.17, 0.015],
      [0.52, 0.19, 0.225, 0.02],
      [0.7, 0.185, 0.215, 0.025],
      [0.83, 0.14, 0.165, 0.035],
      [0.9, 0.085, 0.1, 0.015],
      [0.925, 0.05, 0.05, -0.035],
      [1, 0.022, 0.02, -0.045],
    ],
    28,
    36,
    0.32,
    shade,
  );
  // dorsal fin in the z/y plane, swept back like a sickle
  const dorsal = finGeo(
    [[0.2, 0.17], ...curve([0.2, 0.17], [0.02, 0.4], [-0.2, 0.5]), ...curve([-0.2, 0.5], [-0.1, 0.3], [-0.26, 0.16]).slice(1)],
    0.035,
  );
  dorsal.rotateY(-Math.PI / 2);
  // flukes: crescent in the x/z plane at the tail
  const fl = [[0, -0.86], ...curve([0, -0.86], [0.28, -0.88], [0.46, -1.16]), ...curve([0.46, -1.16], [0.2, -1.0], [0.0, -1.06]).slice(1)];
  const flukes = finGeo([...fl, ...fl.slice(0, -1).reverse().map(([x, z]) => [-x, z])], 0.03);
  flukes.rotateX(Math.PI / 2);
  // pectoral flippers, angled down and back
  const flip = sx => {
    const g = finGeo([[0, 0], ...curve([0, 0], [0.22, -0.02], [0.32, -0.16]), ...curve([0.32, -0.16], [0.14, -0.1], [0, -0.12]).slice(1)], 0.025);
    g.rotateX(Math.PI / 2);
    g.rotateZ(sx * -0.55);
    if (sx < 0) g.scale(-1, 1, 1);
    g.translate(sx * 0.13, -0.12, 0.4);
    return g;
  };
  const fins = [dorsal, flukes, flip(1), flip(-1)].map(g => greyCol(g, 0.17));
  fins.forEach(g => g.computeVertexNormals());
  return mergeG([body, ...fins]);
}

/* Sailboat (~6 m): lofted hull with a raised bow, deck, cabin, mast, boom, a bellied mainsail and jib. */
function makeSailboat() {
  const boat = new THREE.Group();
  const std = (c, x = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.5 }, x));
  // hull: stations along z, U-shaped sections; colour bands baked per vertex (white topsides, navy stripe, red bottom)
  const NZ = 24,
    NA = 14,
    L = 6,
    pos = [],
    col = [],
    idx = [];
  const white = new THREE.Color(0xf6f6f2),
    navy = new THREE.Color(0x1d3a6e),
    red = new THREE.Color(0xb3202c);
  for (let i = 0; i <= NZ; i++) {
    const u = i / NZ,
      z = -L / 2 + u * L,
      w = 1.05 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.55 + 0.45 * Math.pow(u, 0.6))), 0.8) * (u > 0.85 ? 1 - (u - 0.85) * 4.5 : 1) + 0.04,
      sheer = 0.75 + 0.35 * Math.pow(u, 3),
      keel = -0.55 * Math.sin(Math.PI * Math.min(1, u * 1.1)) - 0.1;
    for (let k = 0; k <= NA; k++) {
      const a = (k / NA) * Math.PI, // 0 = port gunwale, PI = starboard gunwale
        x = -Math.cos(a) * w,
        down = Math.pow(Math.sin(a), 1.6),
        y = sheer * (1 - down) + keel * down;
      pos.push(x, y, z);
      const c = y < -0.05 ? red : y < 0.08 ? navy : white;
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < NZ; i++)
    for (let k = 0; k < NA; k++) {
      const a = i * (NA + 1) + k,
        b = a + NA + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const hg = new THREE.BufferGeometry();
  hg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  hg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  hg.setIndex(idx);
  hg.computeVertexNormals();
  boat.add(new THREE.Mesh(hg, std(0xffffff, { vertexColors: true, side: THREE.DoubleSide, roughness: 0.35 })));
  // deck: fill between the gunwales
  const deckS = new THREE.Shape();
  for (let i = 0; i <= NZ; i++) {
    const j = i * (NA + 1);
    i ? deckS.lineTo(pos[j * 3], pos[j * 3 + 2]) : deckS.moveTo(pos[j * 3], pos[j * 3 + 2]);
  }
  for (let i = NZ; i >= 0; i--) {
    const j = i * (NA + 1) + NA;
    deckS.lineTo(pos[j * 3], pos[j * 3 + 2]);
  }
  const dg = new THREE.ShapeGeometry(deckS);
  dg.rotateX(Math.PI / 2);
  dg.translate(0, 0.78, 0);
  boat.add(new THREE.Mesh(dg, std(0xc8a06a, { side: THREE.DoubleSide, roughness: 0.8 })));
  // cabin
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.42, 1.8, 1, 1, 1), std(0xf2f2ee));
  cab.position.set(0, 1.0, -0.4);
  boat.add(cab);
  const win = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.1, 1.2), std(0x1b2430, { roughness: 0.1, metalness: 0.4 }));
  win.position.set(0, 1.08, -0.4);
  boat.add(win);
  // mast and boom
  const alu = std(0xd8dde3, { metalness: 0.7, roughness: 0.3 });
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 7.2, 8), alu);
  mast.position.set(0, 0.8 + 3.6, 0.6);
  boat.add(mast);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 3.0, 8), alu);
  boom.rotation.x = Math.PI / 2;
  boom.position.set(0, 1.55, 0.6 - 1.5);
  boat.add(boom);
  // sails: subdivided triangles with a belly (camber) so they look filled with wind
  const sail = (A, B, C, belly, colr, stripe) => {
    const n = 10,
      P = [],
      Cc = [],
      I = [];
    const pa = new V3(...A),
      pb = new V3(...B),
      pc = new V3(...C);
    for (let i = 0; i <= n; i++)
      for (let j = 0; j <= n - i; j++) {
        const u = i / n,
          v = j / n,
          w = 1 - u - v,
          p = pa.clone().multiplyScalar(w).addScaledVector(pb, u).addScaledVector(pc, v);
        p.x += belly * 4 * w * (u + v) * (1 - Math.abs(u - v));
        P.push(p.x, p.y, p.z);
        const cc = new THREE.Color(stripe && v < 0.12 && v > 0.05 ? stripe : colr);
        Cc.push(cc.r, cc.g, cc.b);
      }
    let k = 0;
    const row = [];
    for (let i = 0; i <= n; i++) {
      row.push(k);
      k += n - i + 1;
    }
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n - i; j++) {
        const a = row[i] + j,
          b = row[i + 1] + j;
        I.push(a, b, a + 1);
        if (j < n - i - 1) I.push(b, b + 1, a + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
    g.setIndex(I);
    g.computeVertexNormals();
    return new THREE.Mesh(g, std(0xffffff, { vertexColors: true, side: THREE.DoubleSide, roughness: 0.7 }));
  };
  boat.add(sail([0, 1.62, 0.55], [0, 7.9, 0.58], [0, 1.62, -2.35], 0.32, 0xfbfbf6, 0xff5d73));
  boat.add(sail([0, 1.1, 0.75], [0, 7.2, 0.68], [0, 1.0, 2.75], 0.22, 0xfbfbf6));
  boat.traverse(o => (o.castShadow = o.isMesh));
  return boat;
}

/* Palm tree: curved ringed trunk, a crown of arching fronds with tapered, serrated leaflets, coconuts. */
function makePalm(h, rnd = Math.random) {
  const p = new THREE.Group();
  const lean = 0.6 + rnd() * 1.2,
    bend = new THREE.QuadraticBezierCurve3(new V3(0, 0, 0), new V3(lean * 0.2, h * 0.55, 0), new V3(lean, h, 0));
  // trunk: tube with taper and darker growth rings in the vertex colours
  const tg = new THREE.TubeGeometry(bend, 24, 1, 9, false),
    P = tg.attributes.position,
    C = new Float32Array(P.count * 3),
    pt = new V3();
  for (let i = 0; i < P.count; i++) {
    const seg = Math.floor(i / 10),
      u = seg / 24,
      c = bend.getPoint(u, pt),
      r = 0.24 - 0.09 * u;
    const dx = P.getX(i) - c.x,
      dy = P.getY(i) - c.y,
      dz = P.getZ(i) - c.z;
    P.setXYZ(i, c.x + dx * r, c.y + dy * r, c.z + dz * r);
    const ring = 0.6 + 0.4 * Math.pow(Math.abs(Math.sin(u * 60)), 3);
    C[i * 3] = C[i * 3 + 1] = C[i * 3 + 2] = ring;
  }
  tg.setAttribute('color', new THREE.BufferAttribute(C, 3));
  tg.computeVertexNormals();
  const trunk = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.95, vertexColors: true }));
  trunk.castShadow = true;
  p.add(trunk);
  const top = bend.getPoint(1);
  // fronds: a ribbon along an arching midrib; width tapers to a point and alternates for leaflets
  const fr = [],
    fc = [],
    fi = [];
  const NF = 10;
  for (let f = 0; f < NF; f++) {
    const yaw = (f / NF) * Math.PI * 2 + rnd() * 0.3,
      len = 2.6 + rnd() * 0.9,
      rise = 0.5 + rnd() * 0.5,
      droop = 1.6 + rnd() * 0.8,
      dir = new V3(Math.cos(yaw), 0, Math.sin(yaw)),
      side = new V3(-dir.z, 0, dir.x);
    const N = 26,
      base = fr.length / 3;
    for (let i = 0; i <= N; i++) {
      const s = i / N,
        along = s * len,
        y = rise * Math.sin(Math.PI * 0.5 * Math.min(1, s * 1.6)) - droop * s * s,
        mid = top.clone().addScaledVector(dir, along).add(new V3(0, y, 0)),
        w = 0.55 * Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.05)), 0.75) * (i % 2 ? 1 : 0.6) * (s < 0.06 ? s / 0.06 : 1),
        fold = w * 0.35; // edges hang lower than the midrib: V-shaped frond
      const l = mid.clone().addScaledVector(side, w).add(new V3(0, -fold, 0)),
        r = mid.clone().addScaledVector(side, -w).add(new V3(0, -fold, 0));
      fr.push(l.x, l.y, l.z, mid.x, mid.y + 0.02, mid.z, r.x, r.y, r.z);
      const g = 0.5 + 0.45 * s,
        gm = 0.4;
      fc.push(g, g, g, gm, gm, gm, g, g, g);
    }
    for (let i = 0; i < N; i++) {
      const a = base + i * 3,
        b = a + 3;
      fi.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
    }
  }
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.Float32BufferAttribute(fr, 3));
  fg.setAttribute('color', new THREE.Float32BufferAttribute(fc, 3));
  fg.setIndex(fi);
  fg.computeVertexNormals();
  const fronds = new THREE.Mesh(
    fg,
    new THREE.MeshStandardMaterial({ color: 0x2f8a35, roughness: 0.75, side: THREE.DoubleSide, vertexColors: true }),
  );
  fronds.castShadow = true;
  p.add(fronds);
  const nut = new THREE.MeshStandardMaterial({ color: 0x5a3a1c, roughness: 0.6 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4,
      c = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), nut);
    c.position.copy(top).add(new V3(Math.cos(a) * 0.2, -0.22, Math.sin(a) * 0.2));
    p.add(c);
  }
  return p;
}

/* Football: the classic truncated-icosahedron pattern computed per pixel on the sphere (no wrapped
   texture, so no pinching at the poles): 12 black pentagons, 20 white hexagons, dark stitched seams. */
function footballMat() {
  const phi = (1 + Math.sqrt(5)) / 2,
    pts = [];
  // pentagons sit on the 12 icosahedron vertices, hexagons on its 20 face centres
  for (const a of [-1, 1]) for (const b of [-1, 1]) pts.push(new V3(0, a, b * phi), new V3(a, b * phi, 0), new V3(b * phi, 0, a));
  const ico = pts.slice();
  for (let i = 0; i < 12; i++)
    for (let j = i + 1; j < 12; j++)
      for (let k = j + 1; k < 12; k++)
        if ([ico[i].distanceTo(ico[j]), ico[j].distanceTo(ico[k]), ico[i].distanceTo(ico[k])].every(d => Math.abs(d - 2) < 1e-3))
          pts.push(ico[i].clone().add(ico[j]).add(ico[k]));
  pts.forEach(p => p.normalize());
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.38 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uFB = { value: pts };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFB;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFB=normalize(position);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uFB[32];varying vec3 vFB;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {vec3 v=normalize(vFB);float d1=-2.,d2=-2.;float blk=0.;
        for(int i=0;i<32;i++){float d=dot(v,uFB[i])+(i<12?.004:0.);if(d>d1){d2=d1;d1=d;blk=i<12?1.:0.;}else if(d>d2){d2=d;}}
        float e=d1-d2;float seam=1.-smoothstep(.002,.006,e);
        vec3 c=mix(vec3(.96),vec3(.035),blk);c=mix(c,vec3(.28),seam*.85);diffuseColor.rgb*=c;}`,
      );
  };
  m.customProgramCacheKey = () => 'football';
  return m;
}

/* Shark, nose toward +z (about -1.6..1.05 long): conical snout, deep body, thin tail stock, falcate fins
   with real thickness, tall upper tail lobe, gill slits, eyes; slate-blue back with a wavy white belly. */
function sharkGeo() {
  const body = sculptGeo(
    new V3(0, 0, -1.02),
    new V3(0, 0, 1.06),
    new V3(0, 1, 0),
    [
      [0, 0.02, 0.035],
      [0.12, 0.055, 0.085],
      [0.3, 0.15, 0.19],
      [0.5, 0.25, 0.28, -0.01],
      [0.68, 0.27, 0.285, 0],
      [0.82, 0.23, 0.21, 0.015],
      [0.92, 0.15, 0.12, 0.02],
      [1, 0.03, 0.03, 0.03],
    ],
    32,
    40,
    0.34,
  );
  paintG(body, (x, y, z, nx, ny) => {
    const line = -0.04 + 0.05 * Math.sin(z * 7.5) - 0.03 * z;
    const gill = z > 0.38 && z < 0.62 && Math.abs(nx) > 0.6 && y > -0.13 && y < 0.1 && Math.sin((z - 0.38) * 105) > 0.82;
    if (gill) return '#2a3138';
    return y < line ? '#eef1f3' : y < line + 0.03 ? '#8a96a0' : '#46535f';
  });
  const fin = (pts, depth) => finGeo(pts, depth, 0.008);
  // first dorsal (z/y plane)
  const dor = fin([[0.34, 0.24], ...curve([0.34, 0.24], [0.12, 0.62], [-0.1, 0.86]), ...curve([-0.1, 0.86], [-0.06, 0.45], [-0.24, 0.24]).slice(1)], 0.05);
  dor.rotateY(-Math.PI / 2);
  const dor2 = fin([[-0.62, 0.1], [-0.72, 0.24], [-0.78, 0.09]], 0.025);
  dor2.rotateY(-Math.PI / 2);
  // tail: tall upper lobe, smaller lower lobe
  const tail = fin(
    [[-0.92, 0.02], ...curve([-0.92, 0.02], [-1.2, 0.45], [-1.62, 0.92]), ...curve([-1.62, 0.92], [-1.38, 0.32], [-1.2, 0.0]).slice(1), ...curve([-1.2, 0.0], [-1.36, -0.25], [-1.46, -0.5]).slice(1), ...curve([-1.46, -0.5], [-1.2, -0.25], [-0.92, -0.05]).slice(1)],
    0.04,
  );
  tail.rotateY(-Math.PI / 2);
  // pectorals: large, swept back and down
  const pec = sx => {
    const g = fin([[0, 0.12], ...curve([0, 0.12], [0.5, 0.05], [0.8, -0.38]), ...curve([0.8, -0.38], [0.42, -0.12], [0, -0.14]).slice(1)], 0.035);
    g.rotateX(Math.PI / 2);
    g.rotateZ(-0.45);
    if (sx < 0) g.scale(-1, 1, 1);
    g.translate(sx * 0.2, -0.17, 0.38);
    return g;
  };
  const small = (z, sx) => {
    const g = fin([[0, 0.05], [0.16, -0.12], [0, -0.06]], 0.02);
    g.rotateX(Math.PI / 2);
    g.rotateZ(-0.6);
    if (sx < 0) g.scale(-1, 1, 1);
    g.translate(sx * 0.1, -0.2, z);
    return g;
  };
  const fins = [dor, dor2, tail, pec(1), pec(-1), small(-0.28, 1), small(-0.28, -1)];
  fins.forEach(g => {
    g.computeVertexNormals();
    paintG(g, (x, y) => (y < -0.15 ? '#cfd6dc' : '#53626f'));
  });
  const eyes = [1, -1].map(sx => {
    const e = new THREE.SphereGeometry(0.035, 10, 8);
    e.translate(sx * 0.165, 0.07, 0.8);
    return paintG(e, () => '#050608');
  });
  return mergeG([body, ...fins, ...eyes]);
}

/* Sea turtle (nose toward +z, ~2.9 long). Pattern is drawn per pixel: kind 0 = shell (scutes with radiating
   streaks, dark seams, marginal rim, pale plastron), kind 1 = skin (dark scales with yellow edges, pale beak). */
function turtleMat(kind) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: kind ? 0.6 : 0.42, metalness: 0.05, side: THREE.DoubleSide });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTP=position;');
    const shell = `
      vec3 p=vTP;vec3 col;
      if(p.y<0.015){ // plastron: cream with a seam grid
        float g=min(abs(fract(p.z*2.2)-.5),abs(fract(p.x*1.6+.5)-.5));
        col=mix(vec3(.55,.45,.25),vec3(.93,.85,.6),smoothstep(.0,.06,g));
      } else {
        float w=.95*(1.-.12*p.z/1.2),r=length(vec2(p.x/w,p.z/1.25));
        vec2 q=p.xz;float d1=9.,d2=9.;vec2 c1=vec2(0.);
        vec2 C[13];
        C[0]=vec2(0.,.78);C[1]=vec2(0.,.38);C[2]=vec2(0.,-.02);C[3]=vec2(0.,-.42);C[4]=vec2(0.,-.82);
        C[5]=vec2(.52,.55);C[6]=vec2(.58,.12);C[7]=vec2(.55,-.32);C[8]=vec2(.42,-.72);
        C[9]=vec2(-.52,.55);C[10]=vec2(-.58,.12);C[11]=vec2(-.55,-.32);C[12]=vec2(-.42,-.72);
        for(int i=0;i<13;i++){float d=length(q-C[i]);if(d<d1){d2=d1;d1=d;c1=C[i];}else if(d<d2){d2=d;}}
        float seam=1.-smoothstep(.015,.045,d2-d1);
        vec2 v=q-c1;float ang=atan(v.y,v.x);
        float streak=.5+.5*sin(ang*9.+length(v)*20.);
        vec3 base=mix(vec3(.30,.19,.09),vec3(.62,.42,.2),streak*smoothstep(.0,.35,length(v)));
        base=mix(base,vec3(.78,.55,.26),.35*smoothstep(.25,.0,length(v)));
        if(r>.86){ // marginal scutes around the rim
          float a=atan(p.x,p.z);float mseam=1.-smoothstep(.02,.07,abs(fract(a*24./6.2832)-.5)*2.);
          base=mix(vec3(.42,.28,.13),vec3(.55,.37,.17),.5+.5*sin(a*24.));seam=max(mseam*.9,1.-smoothstep(.0,.025,abs(r-.86)));
        }
        col=mix(base,vec3(.12,.07,.03),seam*.85);
      }`;
    const skin = `
      vec3 p=vTP*11.;vec3 ip=floor(p);float d1=9.,d2=9.;
      for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)for(int z=-1;z<=1;z++){
        vec3 c=ip+vec3(x,y,z);vec3 h=fract(sin(vec3(dot(c,vec3(127.1,311.7,74.7)),dot(c,vec3(269.5,183.3,246.1)),dot(c,vec3(113.5,271.9,124.6))))*43758.5);
        float d=length(p-c-h);if(d<d1){d2=d1;d1=d;}else if(d<d2){d2=d;}}
      float edge=1.-smoothstep(.04,.16,d2-d1);
      vec3 col=mix(vec3(.24,.22,.12),vec3(.86,.78,.48),edge);
      if(vTP.z>1.56&&vTP.y<.05)col=mix(col,vec3(.75,.68,.45),.7); // beak
      if(vTP.y<-.08)col=mix(col,vec3(.9,.86,.66),.6); // pale underside`;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTP;')
      .replace('#include <color_fragment>', `#include <color_fragment>\n{${kind ? skin : shell}\ndiffuseColor.rgb*=pow(col,vec3(2.2));}`); // colours above are screen (sRGB) values
  };
  m.customProgramCacheKey = () => 'turtle' + kind;
  return m;
}
function makeTurtle() {
  const T = new THREE.Group(),
    shellM = turtleMat(0),
    skinM = turtleMat(1);
  // carapace: teardrop dome over a flatter plastron
  const cg = new THREE.SphereGeometry(1, 72, 40),
    P = cg.attributes.position;
  for (let i = 0; i < P.count; i++) {
    let x = P.getX(i),
      y = P.getY(i),
      z = P.getZ(i);
    const zz = z * 1.25,
      w = 0.95 * (1 - 0.12 * z) * (z < 0 ? 1 - 0.28 * z * z : 1);
    x *= w;
    y = y > 0 ? y * 0.42 + 0.045 * Math.max(0, 1 - Math.abs(x) * 3) * y : y * 0.17;
    P.setXYZ(i, x, y, zz);
  }
  cg.computeVertexNormals();
  const shell = new THREE.Mesh(cg, shellM);
  T.add(shell);
  // neck + head with a beak
  T.add(new THREE.Mesh(sculptGeo(new V3(0, -0.02, 0.8), new V3(0, 0.02, 1.18), new V3(0, 1, 0), [[0, 0.2, 0.16], [0.6, 0.16, 0.13], [1, 0.15, 0.13]], 20, 12), skinM));
  T.add(
    new THREE.Mesh(
      sculptGeo(new V3(0, 0.02, 1.08), new V3(0, 0.0, 1.7), new V3(0, 1, 0), [[0, 0.15, 0.13], [0.35, 0.19, 0.16], [0.7, 0.17, 0.15, 0.01], [0.9, 0.11, 0.1, -0.015], [1, 0.035, 0.04, -0.035]], 28, 24, 0.32),
      skinM,
    ),
  );
  const eyeM = new THREE.MeshStandardMaterial({ color: 0x0b0806, roughness: 0.15 });
  [1, -1].forEach(sx => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), eyeM);
    e.position.set(sx * 0.15, 0.07, 1.47);
    T.add(e);
  });
  // flippers on pivots so they can stroke
  const flipper = (pts, depth, sx, pos) => {
    const g = finGeo(pts, depth, 0.02);
    g.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(g, skinM),
      piv = new THREE.Group();
    m.scale.x = sx;
    piv.position.set(...pos);
    piv.add(m);
    T.add(piv);
    return piv;
  };
  const front = [[0, 0.12], ...curve([0, 0.12], [0.8, 0.28], [1.55, -0.5]), ...curve([1.55, -0.5], [0.8, -0.18], [0, -0.22]).slice(1)],
    rear = [[0, 0.1], ...curve([0, 0.1], [0.32, 0.08], [0.48, -0.2]), ...curve([0.48, -0.2], [0.22, -0.3], [0, -0.12]).slice(1)];
  const F = [1, -1].map(sx => flipper(front, 0.05, sx, [sx * 0.72, -0.03, 0.62])),
    Rr = [1, -1].map(sx => flipper(rear, 0.04, sx, [sx * 0.58, -0.04, -0.9]));
  T.traverse(o => (o.castShadow = o.isMesh));
  // swimming stroke: front flippers fly (flap + sweep), rear ones steer
  T.userData.swim = t => {
    const s = Math.sin(t * 1.7);
    F.forEach((f, i) => {
      const sx = i ? -1 : 1;
      f.rotation.z = sx * (0.15 + s * 0.6);
      f.rotation.y = sx * (0.25 + Math.sin(t * 1.7 - 1.3) * 0.4);
    });
    Rr.forEach((f, i) => (f.rotation.y = (i ? -1 : 1) * (0.2 + Math.sin(t * 1.7 + 0.8) * 0.18)));
    shell.rotation.x = s * 0.04;
  };
  return T;
}

export { dolphinGeo, footballMat, makePalm, makeSailboat, makeTurtle, sharkGeo };
