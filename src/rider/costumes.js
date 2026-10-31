import * as THREE from 'three';
import { V3 } from '../core/constants.js';

/* ---------- costumes: each outfit repaints the race suit and adds sculpted props ----------
   PAL      extra colours (sRGB hex) for the outfit; main colour comes from the catalogue / suit picker
   design   (part, code, t, n, p, X, Y, Z) -> colour for one vertex of a suit part, or null to keep the suit's panel
            part: torso pelvis hump uarm farm shoulder cuff thigh shin knee boot bootplate foot
            t: 0..1 along the part, n: normal, p: position (x = rider's right), X/Y/Z: part frame (Z = front)
   helmet   (x, y, z) on the unit helmet (z = front, y = up) -> colour or null
   props    sculpted extras (crowns, horns, collars…), built in rider space from anchor points */

const C3 = h => new THREE.Color(h).convertSRGBToLinear();
const sm = (a, b, x) => Math.min(1, Math.max(0, (x - a) / (b - a)));
const ang = (n, X, Z) => Math.atan2(n.dot(X), n.dot(Z));
const hash3 = (x, y, z) => {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
};
const LIMB = { uarm: 1, farm: 1, thigh: 1, shin: 1 };
const LOWER = { boot: 1, bootplate: 1, foot: 1 };

/* polka dots on a 3D grid (so they sit evenly on every part) */
function dot(p, size, cols) {
  const q = p.clone().multiplyScalar(1 / size),
    ix = Math.floor(q.x),
    iy = Math.floor(q.y),
    iz = Math.floor(q.z);
  let best = 9,
    pick = 0;
  for (let dx = 0; dx <= 1; dx++)
    for (let dy = 0; dy <= 1; dy++)
      for (let dz = 0; dz <= 1; dz++) {
        const cx = ix + dx,
          cy = iy + dy,
          cz = iz + dz,
          j = hash3(cx, cy, cz),
          d = Math.hypot(q.x - cx - (j - 0.5) * 0.3, q.y - cy - (hash3(cy, cz, cx) - 0.5) * 0.3, q.z - cz);
        if (d < best) {
          best = d;
          pick = j;
        }
      }
  return best < 0.3 ? cols[Math.floor(pick * cols.length)] : null;
}
/* five-point star outline */
function starShape(r) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2,
      rr = i % 2 ? r * 0.42 : r;
    i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return s;
}
const extrude = (shape, depth, bevel = 0.004) => {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  return g;
};
/* tapered tube along a curve: r(u) radius profile */
function taperTube(curve, r0, r1, seg = 24, rad = 10) {
  const g = new THREE.TubeGeometry(curve, seg, 1, rad, false),
    P = g.attributes.position,
    pt = new V3();
  for (let i = 0; i < P.count; i++) {
    const s = Math.floor(i / (rad + 1)) / seg,
      c = curve.getPoint(Math.min(1, s), pt),
      r = r0 + (r1 - r0) * s;
    P.setXYZ(i, c.x + (P.getX(i) - c.x) * r, c.y + (P.getY(i) - c.y) * r, c.z + (P.getZ(i) - c.z) * r);
  }
  g.computeVertexNormals();
  return g;
}
/* frilled ring (clown ruff, ermine collar): radius R, depth of the frill, number of folds */
function ruff(R, w, folds, amp, tilt = 0) {
  const g = new THREE.CylinderGeometry(R, R + w, 0.05, folds * 6, 2, true),
    P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i),
      z = P.getZ(i),
      a = Math.atan2(z, x),
      k = 1 + amp * Math.sin(a * folds);
    const y = P.getY(i) * (1 + amp * 2 * Math.cos(a * folds));
    P.setXYZ(i, x * k, y + tilt * z, z * k);
  }
  g.computeVertexNormals();
  return g;
}
const mat = (c, x = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.45, metalness: 0.05 }, x));

const COSTUMES = {
  /* stunt-legend jumpsuit: white with a blue star yoke, red/blue racing stripes, gold buckle */
  daredevil: {
    pal: { sec: 0xd71f2c, blk: 0x1f3fa6 },
    design(part, code, t, n, p, X, Y, Z) {
      const lat = n.dot(X),
        fr = n.dot(Z),
        out = n.x * Math.sign(p.x || 1);
      if (part === 'torso') {
        if (t > 0.72) return 'BLK';
        if (t > 0.13 && t < 0.2) return C3(0xd4a017); // belt
        if (Math.abs(lat) < 0.07) return 'SEC';
        if (Math.abs(lat) < 0.13) return 'BLK';
        return 'MAIN';
      }
      if (part === 'hump') return Math.abs(n.dot(X)) < 0.2 ? 'SEC' : 'MAIN';
      if (LIMB[part] || part === 'pelvis') {
        if (out > 0.82) return 'SEC';
        if (out > 0.66) return 'BLK';
        return 'MAIN';
      }
      if (part === 'shoulder') return 'BLK';
      if (part === 'cuff' || LOWER[part] || part === 'knee') return part === 'knee' ? 'BLK' : 'MAIN';
      return fr > 2 ? null : 'MAIN';
    },
    helmet(x, y, z, hp) {
      if (Math.abs(x) < 0.09 && y > 0.1) return C3(0x1f3fa6);
      if (Math.abs(x) < 0.16 && y > 0.1) return C3(0xd71f2c);
      if (y < -0.55) return C3(0x1f3fa6);
      return hp.main;
    },
    props(add, ctx, M) {
      const white = mat(0xffffff, { roughness: 0.3 }),
        gold = mat(0xd4a017, { metalness: 1, roughness: 0.25 });
      // five white stars across the blue chest yoke
      for (let i = 0; i < 5; i++) {
        const k = (i - 2) / 2,
          p = ctx.at(k * 0.11, 0.42 - Math.abs(k) * 0.03, 0.125 - Math.abs(k) * 0.03);
        const s = add(extrude(starShape(0.022), 0.008), white);
        s.position.copy(p);
        s.quaternion.copy(ctx.qFront);
      }
      // oval belt buckle
      const b = add(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 20), gold);
      b.scale.set(1.4, 1, 1);
      b.position.copy(ctx.at(0, 0.075, 0.13));
      b.quaternion.copy(ctx.qFront).multiply(new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), Math.PI / 2));
    },
  },

  /* circus clown: yellow suit with bright polka dots, harlequin legs and arms, ruff collar, pom-poms, rainbow hair, red nose */
  clown: {
    pal: { sec: 0xff4fa3, blk: 0x2ec4b6 },
    dots: [0xff4fa3, 0x2ec4b6, 0x3a6df0, 0xe63946],
    design(part, code, t, n, p) {
      if (LIMB[part] && p.x < 0) {
        const d = dot(p, 0.08, [0xffd23f]);
        return d ? C3(d) : 'BLK';
      }
      if (LOWER[part]) return C3(0xe63946);
      if (part === 'cuff') return 'SEC';
      const d = dot(p, 0.075, this.dots);
      return d ? C3(d) : 'MAIN';
    },
    helmet(x, y, z, hp) {
      const d = dot(new V3(x, y, z), 0.32, [0xffffff]);
      if (y < -0.55) return hp.blk;
      return d ? C3(d) : hp.main;
    },
    props(add, ctx) {
      const ruffM = mat(0xffffff, { roughness: 0.7, side: THREE.DoubleSide }),
        nose = mat(0xff1a1a, { roughness: 0.15, metalness: 0.1 });
      // two stacked frilled layers so the ruff stands out round the neck
      [[0.07, 0.17, 0.02], [0.065, 0.12, 0.05]].forEach(([R, w, h], k) => {
        const r = add(ruff(R, w, 12, 0.2), k ? mat(0xff4fa3, { roughness: 0.7, side: THREE.DoubleSide }) : ruffM);
        r.position.copy(ctx.neck).addScaledVector(ctx.u, -0.03 + h);
        r.quaternion.copy(ctx.qUp);
        r.scale.set(1, 3, 1);
      });
      // pom-pom buttons down the chest
      [0x2ec4b6, 0xff4fa3, 0x3a6df0].forEach((c, i) => {
        const b = add(new THREE.IcosahedronGeometry(0.028, 2), mat(c, { roughness: 0.95 }));
        b.position.copy(ctx.at(0, 0.36 - i * 0.11, 0.135));
      });
      // red nose on the chin bar
      const addH = ctx.addH || add;
      const n = addH(new THREE.SphereGeometry(0.032, 16, 12), nose);
      n.position.copy(ctx.head(0, -0.035, 0.17));
      // rainbow hair tufts poking out of the helmet sides
      const hair = [0xff4fa3, 0xffd23f, 0x2ec4b6, 0x3a6df0, 0xe63946];
      [1, -1].forEach(sx =>
        hair.forEach((c, i) => {
          const a = ctx.head(sx * 0.13, 0.02 + i * 0.022, -0.04 - i * 0.012),
            b = a.clone().add(ctx.hX.clone().multiplyScalar(sx * (0.09 + (i % 2) * 0.03))).addScaledVector(ctx.hu, 0.03 - i * 0.012);
          const curve = new THREE.QuadraticBezierCurve3(a, a.clone().lerp(b, 0.5).addScaledVector(ctx.hu, 0.04), b);
          addH(taperTube(curve, 0.016, 0.003, 10, 6), mat(c, { roughness: 0.9 }));
        }),
      );
    },
  },

  /* skeleton: black suit with a painted ribcage, spine, pelvis and limb bones; skull helmet with teeth */
  skeleton: {
    pal: { sec: 0xefe9da, blk: 0x0c0c0f },
    design(part, code, t, n, p, X, Y, Z) {
      const lat = n.dot(X),
        fr = n.dot(Z),
        bone = C3(0xefe9da),
        black = 'BLK';
      if (part === 'torso') {
        if (fr > 0.25) {
          if (t > 0.42 && t < 0.88 && Math.abs(lat) < 0.07) return bone; // sternum
          const rib = Math.sin((t - 0.42) * Math.PI * 9 - Math.abs(lat) * 2.2);
          if (t > 0.42 && t < 0.86 && rib > 0.55 && Math.abs(lat) < 0.8) return bone;
          return black;
        }
        if (fr < -0.2 && Math.abs(lat) < 0.1 && t > 0.1 && Math.sin(t * Math.PI * 22) > -0.6) return bone; // spine
        if (fr < -0.3 && t > 0.5 && t < 0.85 && Math.sin((t - 0.5) * Math.PI * 8 - Math.abs(lat) * 1.5) > 0.7 && Math.abs(lat) < 0.75) return bone; // back ribs
        return black;
      }
      if (part === 'hump') return Math.abs(lat) < 0.1 && Math.sin(t * Math.PI * 14) > -0.5 ? bone : black;
      if (part === 'pelvis') return fr > 0.2 && Math.abs(lat) > 0.18 && Math.abs(lat) < 0.75 && t > 0.35 ? bone : black;
      if (LIMB[part]) {
        const knob = t < 0.12 || t > 0.88;
        if (fr > 0.2 && Math.abs(lat) < (knob ? 0.45 : 0.2)) return bone;
        return black;
      }
      if (part === 'cuff') return black;
      return black;
    },
    helmet(x, y, z, hp) {
      const bone = C3(0xefe9da);
      // teeth across the chin bar, dark nose hole, cheek hollows
      if (z > 0.55 && y < -0.2 && y > -0.62) return Math.sin(x * 46) > 0.6 || Math.abs(y + 0.42) < 0.03 ? C3(0x111111) : bone;
      if (Math.abs(x) > 0.55 && y < 0.1 && y > -0.35 && z > 0.1) return C3(0x6a6658);
      if (y < -0.62) return C3(0x111111);
      return bone;
    },
  },

  /* punk: black leather biker jacket with an off-centre zip, red tartan trousers, studs, pink mohawk */
  punk: {
    pal: { sec: 0xc9ccd2, blk: 0x0d0d10 },
    design(part, code, t, n, p, X, Y, Z) {
      const lat = n.dot(X),
        fr = n.dot(Z);
      if (part === 'thigh' || part === 'shin' || part === 'pelvis') {
        const a = Math.sin(p.y * 70),
          b = Math.sin((p.x + p.z) * 70),
          base = C3(0xa3121e);
        if (Math.abs(a) > 0.94 || Math.abs(b) > 0.94) return C3(0xf2c230);
        if (a > 0.6 || b > 0.6) return C3(0x1a0a0c);
        return base;
      }
      if (part === 'torso') {
        if (fr > 0.3 && Math.abs(lat - (0.35 - t * 0.5)) < 0.03 && t > 0.15) return 'SEC'; // asymmetric zip
        if (t > 0.86) return 'SEC'; // silver collar trim
        return C3(0x141417);
      }
      if (part === 'cuff') return C3(0x141417);
      return C3(0x141417);
    },
    helmet(x, y, z, hp) {
      if (Math.abs(x) < 0.12 && y > 0) return C3(0xff2d95);
      return y < -0.55 ? C3(0x0a0a0a) : C3(0x18181c);
    },
    props(add, ctx) {
      const stud = mat(0xd8dce2, { metalness: 1, roughness: 0.2 }),
        pink = mat(0xff2d95, { roughness: 0.6 });
      // pyramid studs on both shoulders and around the collar
      [1, -1].forEach(sx => {
        for (let i = 0; i < 3; i++)
          for (let j = 0; j < 2; j++) {
            const s = add(new THREE.ConeGeometry(0.011, 0.022, 4), stud);
            s.position.copy(ctx.at(sx * (0.15 + i * 0.03), 0.5 - j * 0.035, -0.01 + j * 0.03)).addScaledVector(ctx.u, 0.035);
            s.quaternion.copy(ctx.qUp);
          }
      });
      // mohawk: a row of tall tapered spikes along the helmet centre
      const addH = ctx.addH || add;
      for (let i = 0; i < 7; i++) {
        const a = -0.55 + i * 0.19,
          base = ctx.head(0, 0.14 * Math.cos(a) + 0.02, 0.15 * Math.sin(a)),
          dir = ctx.hu.clone().multiplyScalar(Math.cos(a)).addScaledVector(ctx.hf, Math.sin(a)).normalize(),
          tip = base.clone().addScaledVector(dir, 0.11 + 0.04 * (i % 2));
        addH(taperTube(new THREE.LineCurve3(base, tip), 0.022, 0.002, 6, 8), pink);
      }
      // wallet chain at the hip
      const chain = mat(0xc0c4cc, { metalness: 1, roughness: 0.3 });
      for (let i = 0; i < 6; i++) {
        const l = add(new THREE.TorusGeometry(0.012, 0.003, 6, 10), chain);
        l.position.copy(ctx.hip(0.13, -0.03 - i * 0.018, 0.05 - i * 0.012));
        l.rotation.set(i % 2 ? Math.PI / 2 : 0, 0.3, 0);
      }
    },
  },

  /* superhero: blue suit, red boots, gloves and briefs, gold belt, shield emblem with a lightning bolt, red cape */
  hero: {
    pal: { sec: 0xd62828, blk: 0x13246b },
    design(part, code, t, n, p, X, Y, Z) {
      if (part === 'pelvis') return 'SEC';
      if (part === 'torso') {
        if (t < 0.2 && t > 0.12) return C3(0xffd23f);
        if (t <= 0.12) return 'SEC';
        return n.dot(X) > 0.85 || n.dot(X) < -0.85 ? 'BLK' : 'MAIN';
      }
      if (part === 'shin' && t > 0.45) return 'SEC';
      if (LOWER[part] || part === 'cuff') return 'SEC';
      if (part === 'farm' && t > 0.55) return 'SEC';
      if (part === 'knee') return 'SEC';
      return 'MAIN';
    },
    helmet(x, y, z, hp) {
      if (Math.abs(x) < 0.1 && y > 0.05) return C3(0xffd23f);
      return y < -0.55 ? C3(0xd62828) : hp.main;
    },
    props(add, ctx) {
      const shield = new THREE.Shape();
      [[0, 0.075], [0.065, 0.045], [0.05, -0.03], [0, -0.075], [-0.05, -0.03], [-0.065, 0.045]].forEach(([x, y], i) => (i ? shield.lineTo(x, y) : shield.moveTo(x, y)));
      const bolt = new THREE.Shape();
      [[0.012, 0.05], [-0.022, -0.002], [0.002, -0.002], [-0.014, -0.05], [0.026, 0.008], [0.004, 0.008], [0.02, 0.05]].forEach(([x, y], i) => (i ? bolt.lineTo(x, y) : bolt.moveTo(x, y)));
      const s = add(extrude(shield, 0.01), mat(0xffd23f, { roughness: 0.3, metalness: 0.3 }));
      s.position.copy(ctx.at(0, 0.38, 0.13));
      s.quaternion.copy(ctx.qFront);
      const b = add(extrude(bolt, 0.006), mat(0xd62828, { roughness: 0.3 }));
      b.position.copy(ctx.at(0, 0.38, 0.14));
      b.quaternion.copy(ctx.qFront);
    },
    cape: { col: 0xd62828, lining: 0x8f1018 },
  },

  /* devil: red suit with black flames licking up from the boots, gloves and belt; curved horns, a spade-tipped tail */
  devil: {
    pal: { sec: 0x1a0508, blk: 0x0d0204 },
    design(part, code, t, n, p, X, Y, Z) {
      const a = ang(n, X, Z);
      const flame = edge => edge + 0.12 * Math.sin(a * 5 + p.y * 9) + 0.05 * Math.sin(a * 11);
      if (part === 'shin') return t > flame(0.45) ? 'BLK' : 'MAIN';
      if (part === 'farm') return t > flame(0.55) ? 'BLK' : 'MAIN';
      if (part === 'torso') return t < flame(0.3) ? 'BLK' : t > 0.9 ? 'BLK' : 'MAIN';
      if (part === 'pelvis') return 'BLK';
      if (LOWER[part] || part === 'cuff' || part === 'knee') return 'BLK';
      if (part === 'hump') return 'BLK';
      return 'MAIN';
    },
    helmet(x, y, z, hp) {
      if (y < -0.55) return C3(0x0d0204);
      if (Math.abs(x) > 0.5 && z < 0.4 && y > -0.2 && Math.abs(y - (0.25 - 0.5 * z) + 0.1 * Math.sin(z * 14)) < 0.09) return C3(0x0d0204);
      return hp.main;
    },
    props(add, ctx) {
      const addH = ctx.addH || add;
      // curved horns: up, out and back, tapering to dark points
      [1, -1].forEach(sx => {
        const a = ctx.head(sx * 0.085, 0.115, 0.04),
          o = ctx.hX.clone().multiplyScalar(sx);
        const curve = new THREE.CubicBezierCurve3(
          a,
          a.clone().addScaledVector(o, 0.06).addScaledVector(ctx.hu, 0.04),
          a.clone().addScaledVector(o, 0.09).addScaledVector(ctx.hu, 0.12).addScaledVector(ctx.hf, -0.02),
          a.clone().addScaledVector(o, 0.06).addScaledVector(ctx.hu, 0.19).addScaledVector(ctx.hf, 0.04),
        );
        const g = taperTube(curve, 0.03, 0.002, 20, 10),
          P = g.attributes.position,
          C = new Float32Array(P.count * 3);
        for (let i = 0; i < P.count; i++) {
          const s = Math.floor(i / 11) / 20,
            c = 1 - 0.8 * sm(0.55, 1, s);
          C[i * 3] = C[i * 3 + 1] = C[i * 3 + 2] = c;
        }
        g.setAttribute('color', new THREE.BufferAttribute(C, 3));
        addH(g, mat(0xefe3c8, { roughness: 0.35, vertexColors: true }));
      });
      // tail: a long S-curve from the base of the back, ending in a spade
      const t0 = ctx.hip(0, 0.05, -0.13),
        back = ctx.f.clone().negate();
      const tail = new THREE.CubicBezierCurve3(
        t0,
        t0.clone().addScaledVector(back, 0.25).addScaledVector(ctx.u, -0.15),
        t0.clone().addScaledVector(back, 0.35).addScaledVector(ctx.u, 0.15).add(new V3(0.12, 0, 0)),
        t0.clone().addScaledVector(back, 0.55).addScaledVector(ctx.u, 0.12).add(new V3(0.05, 0, 0)),
      );
      add(taperTube(tail, 0.016, 0.008, 28, 8), mat(0xb3121f, { roughness: 0.4 }));
      const spade = new THREE.Shape();
      spade.moveTo(0, 0);
      spade.quadraticCurveTo(0.05, 0.02, 0.0, 0.07);
      spade.quadraticCurveTo(-0.05, 0.02, 0, 0);
      const sp = add(extrude(spade, 0.01), mat(0x0d0204, { roughness: 0.3 }));
      sp.position.copy(tail.getPoint(1));
      sp.lookAt(sp.position.clone().add(tail.getTangent(1)));
      sp.rotateX(Math.PI / 2);
    },
    cape: { col: 0x14070a, lining: 0xb3121f, short: 1 },
  },

  /* ghost: glowing translucent white with a pale sheen; a ragged sheet streams from the shoulders */
  ghost: {
    pal: { sec: 0xdfe9ff, blk: 0xc9d6f0 },
    design(part) {
      return 'MAIN';
    },
    helmet(x, y, z, hp) {
      return hp.main;
    },
    cape: { col: 0xf4f7ff, lining: 0xdfe6f5, ragged: 1, ghost: 1 },
  },

  /* the king: royal purple with gold braid, ermine collar and cuffs, jewelled crown, medallion, red ermine-trimmed cape */
  king: {
    pal: { sec: 0xd4a017, blk: 0x3d0f63 },
    design(part, code, t, n, p, X, Y, Z) {
      const lat = n.dot(X),
        fr = n.dot(Z),
        gold = C3(0xd4a017);
      if (part === 'torso') {
        if (fr > 0.3 && Math.abs(Math.abs(lat) - 0.16) < 0.03 && t > 0.15) return gold; // braid down the front
        if (t > 0.13 && t < 0.19) return gold;
        return Math.abs(lat) > 0.8 ? 'BLK' : 'MAIN';
      }
      if (LIMB[part]) return Math.abs(n.x) > 0.9 ? gold : 'MAIN';
      if (LOWER[part]) return C3(0x1a0a24);
      if (part === 'cuff') return gold;
      return 'MAIN';
    },
    helmet(x, y, z, hp) {
      if (y < -0.55) return C3(0xd4a017);
      return hp.main;
    },
    props(add, ctx) {
      const gold = mat(0xe8b923, { metalness: 1, roughness: 0.22 });
      // ermine collar: fluffy white with black tail spots
      const er = ruff(0.1, 0.07, 18, 0.06),
        P = er.attributes.position,
        C = new Float32Array(P.count * 3);
      for (let i = 0; i < P.count; i++) {
        const a = Math.atan2(P.getZ(i), P.getX(i)),
          spot = Math.sin(a * 9) > 0.93 && P.getY(i) > 0;
        C[i * 3] = C[i * 3 + 1] = C[i * 3 + 2] = spot ? 0.04 : 0.95;
      }
      er.setAttribute('color', new THREE.BufferAttribute(C, 3));
      const e = add(er, mat(0xffffff, { roughness: 0.95, vertexColors: true, side: THREE.DoubleSide }));
      e.position.copy(ctx.neck).addScaledVector(ctx.u, -0.03);
      e.quaternion.copy(ctx.qUp);
      // medallion on a chain
      const m = add(new THREE.CylinderGeometry(0.03, 0.03, 0.008, 24), gold);
      m.position.copy(ctx.at(0, 0.3, 0.135));
      m.quaternion.copy(ctx.qFront).multiply(new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), Math.PI / 2));
      const gem = add(new THREE.OctahedronGeometry(0.014), mat(0xc0102a, { roughness: 0.05, metalness: 0.3 }));
      gem.position.copy(ctx.at(0, 0.3, 0.142));
      const addH = ctx.addH || add;
      // crown: band with fleur points, arches, cross on top and jewels
      const band = addH(new THREE.CylinderGeometry(0.105, 0.098, 0.045, 32, 1, true), mat(0xe8b923, { metalness: 1, roughness: 0.22, side: THREE.DoubleSide }));
      band.position.copy(ctx.head(0, 0.15, -0.01));
      band.quaternion.copy(ctx.qHead);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2,
          pt = addH(new THREE.ConeGeometry(0.014, 0.05, 6), gold);
        pt.position.copy(ctx.head(Math.cos(a) * 0.1, 0.19, Math.sin(a) * 0.1 - 0.01));
        pt.quaternion.copy(ctx.qHead);
        const j = addH(new THREE.SphereGeometry(0.009, 10, 8), mat([0xc0102a, 0x1f4fd6, 0x15803d][i % 3], { roughness: 0.05 }));
        j.position.copy(ctx.head(Math.cos(a) * 0.106, 0.15, Math.sin(a) * 0.106 - 0.01));
      }
      [0, Math.PI / 2].forEach(r => {
        const arch = addH(new THREE.TorusGeometry(0.095, 0.006, 6, 24, Math.PI), gold);
        arch.position.copy(ctx.head(0, 0.17, -0.01));
        arch.quaternion.copy(ctx.qHead).multiply(new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), r));
        arch.scale.set(1, 0.7, 1);
      });
      const orb = addH(new THREE.SphereGeometry(0.016, 12, 10), gold);
      orb.position.copy(ctx.head(0, 0.25, -0.01));
      const cross = addH(new THREE.BoxGeometry(0.008, 0.035, 0.008), gold);
      cross.position.copy(ctx.head(0, 0.28, -0.01));
      cross.quaternion.copy(ctx.qHead);
      const crossB = addH(new THREE.BoxGeometry(0.024, 0.008, 0.008), gold);
      crossB.position.copy(ctx.head(0, 0.285, -0.01));
      crossB.quaternion.copy(ctx.qHead);
    },
    cape: { col: 0x9b111e, lining: 0xf4f1ea, ermine: 1 },
  },

  /* gold suit: mirror-gold with a black diamond harlequin pattern and black side panels */
  goldsuit: {
    pal: { sec: 0x111114, blk: 0x111114 },
    design(part, code, t, n, p, X, Y, Z) {
      if (part === 'torso' && n.dot(Z) > 0.2 && t > 0.25 && t < 0.85) {
        const a = Math.abs(((p.x + p.y) * 14) % 2) - 1,
          b = Math.abs(((p.x - p.y) * 14) % 2) - 1;
        if (Math.abs(a) < 0.08 || Math.abs(b) < 0.08) return 'BLK';
      }
      if (LIMB[part] && Math.abs(n.x) > 0.85) return 'BLK';
      if (LOWER[part] || part === 'cuff' || part === 'knee') return 'BLK';
      return null;
    },
    cape: { col: 0xd4a017, lining: 0x111114, metal: 1 },
  },
};

/* a shaped cape: narrow at the collar, wide at the hem, gentle folds, contrasting lining (two meshes) */
function makeCape(spec, len, width) {
  const g = new THREE.PlaneGeometry(1, 1, 10, 16),
    P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const u = P.getX(i) + 0.5,
      v = 0.5 - P.getY(i),
      w = width * (0.42 + 0.58 * v),
      hem = spec.ragged ? 0.08 * Math.max(0, Math.sin(u * 37) * Math.sin(u * 13 + 1)) : 0;
    P.setXYZ(i, (u - 0.5) * w, -v * len * (1 - hem * (v > 0.9 ? 1 : 0)), -Math.sin(u * Math.PI * 4) * 0.025 * v - 0.04 * v * v);
  }
  g.computeVertexNormals();
  // the cloth's +z face points at the rider's back, so the outer colour goes on the back face
  const front = new THREE.MeshStandardMaterial({
      color: C3(spec.lining),
      roughness: spec.metal ? 0.25 : 0.65,
      metalness: spec.metal ? 0.85 : 0.05,
      side: THREE.FrontSide,
      transparent: !!spec.ghost,
      opacity: spec.ghost ? 0.55 : 1,
    }),
    back = front.clone();
  back.color = C3(spec.col);
  back.side = THREE.BackSide;
  if (spec.ermine) {
    // vertex colours mark the ermine edge on both faces
    const ec = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) {
      const v = -P.getY(i) / len,
        x = Math.abs(P.getX(i)),
        edge = v > 0.92 || x > width * (0.42 + 0.58 * v) * 0.5 - 0.035,
        u = P.getX(i) / width;
      const spot = edge && Math.sin(u * 70) * Math.sin(v * 60) > 0.75;
      ec.set(edge ? (spot ? [0.02, 0.02, 0.02] : [0.96, 0.95, 0.92]) : [1, 1, 1], i * 3); // pure white marks plain cloth
    }
    g.setAttribute('color', new THREE.BufferAttribute(ec, 3));
    front.vertexColors = back.vertexColors = true;
    front.onBeforeCompile = back.onBeforeCompile = sh => {
      // the edge colour replaces the cloth colour instead of tinting it
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <color_fragment>',
        '#ifdef USE_COLOR\nif(vColor.r>0.99&&vColor.g>0.99){}else{diffuseColor.rgb=vColor*0.9;}\n#endif',
      );
    };
  }
  const grp = new THREE.Group(),
    a = new THREE.Mesh(g, front),
    b = new THREE.Mesh(g, back);
  a.castShadow = true;
  grp.add(a, b);
  const base = P.array.slice();
  const flutter = (t, amt, still = 0) => {
    const p = P.array;
    for (let i = 0; i < p.length; i += 3) {
      const d = -base[i + 1] / len;
      p[i + 2] = base[i + 2] - still * d * 0.1 + Math.sin(t * (still ? 2.2 : 14) - d * (still ? 4 : 7) + base[i] * 4) * (still ? 0.03 : 0.07) * d * (still ? 1 : amt);
    }
    g.attributes.position.needsUpdate = true;
  };
  return { grp, flutter };
}

export { COSTUMES, C3, makeCape };
