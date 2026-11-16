import * as THREE from 'three';
import { mergeGroup } from '../bikes/bike.js';
import { neonify } from '../render/neon.js';
import { RIDER_GLTF, figureFromModel } from './riderModel.js';
import { V3, YAX } from '../core/constants.js';
import { applyFinish, deep, finishTex } from '../bikes/finishes.js';
import { NEON_T } from '../render/neon.js';
import { findItem } from '../bikes/catalog.js';
import { envify } from '../render/envmap.js';
import { ik2 } from './ik.js';
import { COSTUMES, makeCape } from './costumes.js';
import { ARM, LEG, limb, patch, ringDir, ringPoint, skin, torsoRings } from './body.js';

/* ---------- riders: sculpted bodies (smooth profiles, not tubes) plus real riding kit ---------- */
function sculptGeo(a, b, front, prof, ws = 16, hs = 18, k = 0.3, cfn = null, flat = false) {
  const L = Math.max(1e-4, a.distanceTo(b)),
    g = new THREE.SphereGeometry(1, ws, hs),
    P = g.attributes.position,
    T = new Float32Array(P.count);
  const at = t => {
    let i = 0;
    while (i < prof.length - 2 && prof[i + 1][0] < t) i++;
    const p0 = prof[i],
      p1 = prof[i + 1],
      u0 = Math.min(1, Math.max(0, (t - p0[0]) / (p1[0] - p0[0] || 1))),
      s = u0 * u0 * (3 - 2 * u0);
    const g0 = (p, j) => (j === 1 ? p[1] : j === 2 ? (p[2] ?? p[1]) : (p[3] ?? 0));
    return [1, 2, 3].map(j => g0(p0, j) * (1 - s) + g0(p1, j) * s);
  };
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i),
      y = P.getY(i),
      z = P.getZ(i),
      t = (y + 1) / 2,
      s = Math.sqrt(Math.max(0, 1 - y * y)),
      f = s > 1e-6 ? Math.pow(s, k) / s : 0,
      [rx, rz, dz] = at(t);
    T[i] = t;
    P.setXYZ(i, x * f * rx, t * L, z * f * rz + dz * Math.pow(s, 0.6));
  }
  const Y = b.clone().sub(a).normalize(),
    Z = front.clone().addScaledVector(Y, -front.dot(Y));
  if (Z.lengthSq() < 1e-6) Z.set(0, 0, 1).addScaledVector(Y, -Y.z);
  Z.normalize();
  const X = new V3().crossVectors(Y, Z);
  g.applyMatrix4(new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(a));
  g.computeVertexNormals();
  if (cfn && flat) {
    /* crisp panels: one colour per quad (taken at its centre) instead of blending between vertices, so the
       edges of suit panels are clean lines along the mesh rather than blurry smears. Shading stays smooth
       (the vertex normals are kept). */
    const N = g.attributes.normal,
      pos = [],
      nor = [],
      colr = [],
      n = new V3(),
      p = new V3(),
      W1 = ws + 1,
      put = (i, c) => {
        pos.push(P.getX(i), P.getY(i), P.getZ(i));
        nor.push(N.getX(i), N.getY(i), N.getZ(i));
        typeof c === 'number' ? colr.push(c, c, c) : colr.push(c.r, c.g, c.b);
      };
    for (let iy = 0; iy < hs; iy++)
      for (let ix = 0; ix < ws; ix++) {
        const qa = iy * W1 + ix + 1,
          qb = iy * W1 + ix,
          qc = (iy + 1) * W1 + ix,
          qd = (iy + 1) * W1 + ix + 1,
          q = [qa, qb, qc, qd];
        n.set(0, 0, 0);
        p.set(0, 0, 0);
        let t = 0;
        q.forEach(i => {
          n.x += N.getX(i);
          n.y += N.getY(i);
          n.z += N.getZ(i);
          p.x += P.getX(i);
          p.y += P.getY(i);
          p.z += P.getZ(i);
          t += T[i];
        });
        // which way this strip of the limb faces is taken half-way along it, so a panel edge stays on one
        // line of the mesh from end to end (a straight seam) instead of stepping where the limb tapers
        const m0 = (hs >> 1) * W1 + ix;
        n.set(N.getX(m0) + N.getX(m0 + 1), N.getY(m0) + N.getY(m0 + 1), N.getZ(m0) + N.getZ(m0 + 1)).normalize();
        p.multiplyScalar(0.25);
        const c = cfn(t / 4, n, p, X, Y, Z);
        if (iy !== 0) [qa, qb, qd].forEach(i => put(i, c));
        if (iy !== hs - 1) [qb, qc, qd].forEach(i => put(i, c));
      }
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g2.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g2.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    g.dispose();
    return g2;
  }
  if (cfn) {
    const N = g.attributes.normal,
      C = new Float32Array(P.count * 3),
      n = new V3(),
      p = new V3();
    for (let i = 0; i < P.count; i++) {
      n.set(N.getX(i), N.getY(i), N.getZ(i));
      p.set(P.getX(i), P.getY(i), P.getZ(i));
      // cfn returns a grey multiplier (number) or a colour ({r,g,b}) for this vertex
      const c = cfn(T[i], n, p, X, Y, Z);
      if (typeof c === 'number') C[i * 3] = C[i * 3 + 1] = C[i * 3 + 2] = c;
      else {
        C[i * 3] = c.r;
        C[i * 3 + 1] = c.g;
        C[i * 3 + 2] = c.b;
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  }
  return g;
}
function helmetDeform(g, r) {
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    let x = P.getX(i) / r,
      y = P.getY(i) / r,
      z = P.getZ(i) / r;
    // a real full-face helmet rather than a ball: longer front to back, narrower across, a flatter crown,
    // a chin bar that pushes forward and squares off, cheeks drawing in smoothly to the neck opening
    z *= 1.15;
    x *= 0.93;
    if (y > 0.45) y = 0.45 + (y - 0.45) * 0.86;
    if (y > 0.1) x *= 1 - 0.07 * (y - 0.1);
    if (z > 0 && y < 0.05) {
      const k = Math.min(0.75, 0.05 - y);
      z += k * 0.36 * z;
      y -= k * 0.06;
    }
    if (y < -0.25) {
      const k = Math.min(1, (-0.25 - y) / 0.55);
      x *= 1 - 0.17 * k * k;
      z *= 1 - 0.06 * k * (z < 0 ? 1.6 : 0.3);
    }
    if (z < -0.4 && y > -0.25 && y < 0.6) z -= 0.07 * Math.sin(((y + 0.25) / 0.85) * Math.PI);
    if (y < -0.8) y = -0.8 - (y + 0.8) * 0.3;
    P.setXYZ(i, x * r, y * r, z * r);
  }
  g.computeVertexNormals();
  return g;
}
/* riding kit v3: one-piece race leathers (main colour + black side panels + white trims), armour sliders, hump, race boots, gauntlets, race helmet */
/* panel codes returned by colour functions: MAIN suit colour, BLK black, SEC white/grey stripe, DIM shaded main */
const BLK = 0.018,
  MAIN = 1,
  SEC = 2,
  DIM = 3;
function riderKit(par, M) {
  const mesh = (geo, mat) => {
      const e = new THREE.Mesh(geo, mat);
      e.castShadow = true;
      par.add(e);
      return e;
    },
    V = (x, y, z) => new V3(x, y, z);
  /* costume designs repaint the suit: M.design(part, code, ...cfnArgs) may return a new code or a colour */
  /* tint: a panel code (MAIN / SEC / BLK / DIM) → the suit colour for it, after any costume design */
  const tint = (code, ...a) => toneFn(M.pal, () => code)(...a);
  const toneFn =
    (pal, cfn) =>
    (...a) => {
      let c = cfn ? cfn(...a) : MAIN;
      if (M.design && pal === M.pal) {
        const o = M.design(M.part, c, ...a);
        if (o != null) c = o;
      }
      if (c && c.isColor) return c;
      return c === MAIN
        ? pal.main
        : c === BLK
          ? pal.blk
          : c === SEC
            ? pal.sec
            : c === DIM
              ? pal.dim
              : pal.main.clone().multiplyScalar(c);
    };
  const sc = (a, b, front, prof, mat, ws, hs, k, cfn) => {
    if (M.pal && mat === M.suit) cfn = toneFn(M.pal, cfn);
    else if (M.hpal && mat === M.helm) cfn = toneFn(M.hpal, cfn);
    // plain leathers: suit panels are coloured per quad for crisp edges (the torso keeps per-vertex data for its
    // drawn chevron; costumes with their own painted design keep smooth per-vertex colour)
    return mesh(sculptGeo(a, b, front, prof, ws, hs, k, cfn, !!cfn && mat === M.suit && M.part !== 'torso' && !M.design), mat);
  };
  const ball = (p, s, mat, seg = 14) => {
    const e = mesh(new THREE.SphereGeometry(1, seg, Math.max(8, (seg * 0.7) | 0)), mat);
    e.position.copy(p);
    e.scale.set(...s);
    return e;
  };
  const puck = (p, axis, r, th, mat) => {
    const e = mesh(new THREE.CylinderGeometry(r, r * 0.85, th, 18), mat);
    e.position.copy(p);
    e.quaternion.setFromUnitVectors(YAX, axis.clone().normalize());
    return e;
  };
  const line = (a, b, r, mat) => {
    const e = mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 6), mat);
    e.position.copy(a).add(b).multiplyScalar(0.5);
    e.quaternion.setFromUnitVectors(YAX, b.clone().sub(a).normalize());
    return e;
  };
  const trim = (pts, r, mat) =>
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 8, r, 5, false), mat);
  const K = {
    mesh,
    sc,
    ball,
    puck,
    line,
    trim,
    torso(H, N, f, opts = {}) {
      const u = N.clone().sub(H).normalize(),
        L = H.distanceTo(N),
        X = new V3().crossVectors(u, f).normalize();
      /* torso panels (race-suit layout): main-colour chest and back, white chevron front and back,
         white shoulder yoke, black side panels under the arms, black collar and lower back */
      /* ONE skin from crotch to neck: hips and glutes, a drawn-in waist, ribcage and chest, shoulders sloping
         up into the neck. (It used to be a torso capsule with a separate pelvis ball under it.) */
      const TR = torsoRings(H, N, f, 36),
        tOld = q => (q * L + 0.05) / (L + 0.05), // the old torso's 0..1 coordinate (designs and the chevron use it)
        nOf = (r, th) => {
          const cs = Math.cos(th),
            sn = Math.sin(th);
          return X.clone().multiplyScalar(cs / r.rx).addScaledVector(f, sn / (sn >= 0 ? r.rf : r.rb)).normalize();
        },
        code = (q, n) => {
          const lat = n.dot(X),
            side = Math.abs(lat),
            fr = n.dot(f),
            t = tOld(q);
          if (q < 0.02) return fr > 0.4 && side < 0.6 && q > -0.1 ? MAIN : BLK; // hips: black seat, main front
          if (q > 0.95) return BLK; // collar
          if (q > 0.85) return SEC; // shoulder yoke
          if (side > 0.62 && t > 0.22 && t < 0.86) return BLK;
          if (!M.suit.userData.chev) {
            if (fr > 0.45 && t > 0.5 && t < 0.8 && Math.abs(Math.abs(lat) - (t - 0.52) * 1.7) < 0.075) return SEC;
            if (fr < -0.45 && t > 0.42 && t < 0.74 && Math.abs(Math.abs(lat) - (0.74 - t) * 1.5) < 0.08) return SEC;
          }
          if (fr < -0.3 && t < 0.34) return BLK;
          if (t < 0.24 && side > 0.6) return BLK;
          return MAIN;
        };
      mesh(
        skin(TR.rings, 44, {
          flat: !M.design,
          capA: true,
          colorAt: (q, th, r) => {
            const n = nOf(r, th);
            M.part = q < 0.02 ? 'pelvis' : 'torso';
            // panels are laid out by angle round the body, so their seams run straight up it
            const c = code(q, ringDir(r, th));
            return M.pal ? tint(c, q < 0.02 ? (q * L + 0.12) / 0.25 : tOld(q), n, ringPoint(r, th), X, u, f) : c;
          },
          chevAt: (q, th, r) => {
            const n = nOf(r, th);
            return [n.dot(X), tOld(q), n.dot(f), q < 0.02 ? 0 : 1];
          },
        }),
        M.suit,
      );
      // seams: the waist join and the yoke seam, fine dark lines following the body
      [0.2, 0.845].forEach(q => {
        const i = Math.round(((q + 0.22) / 1.28) * (TR.rings.length - 1)),
          r = TR.rings[i];
        trim(
          Array.from({ length: 25 }, (_, k) => ringPoint(r, (k / 24) * Math.PI * 2, 0.0015)),
          0.0022,
          M.blk,
        );
      });
      /* aero hump: main colour, white spine stripe, black flanks */
      if (opts.hump) {
      M.part = 'hump';
      sc(
        N.clone().addScaledVector(u, -0.27).addScaledVector(f, -0.1),
        N.clone().addScaledVector(u, 0.06).addScaledVector(f, -0.07),
        f.clone().negate(),
        [
          [0, 0.06, 0.02],
          [0.35, 0.092, 0.058],
          [0.78, 0.08, 0.052],
          [1, 0.04, 0.02],
        ],
        M.suit,
        32,
        22,
        0.3,
        (t, n) => {
          const s = Math.abs(n.dot(X));
          return s > 0.62 ? BLK : s < 0.17 && t > 0.15 && t < 0.92 ? SEC : MAIN;
        },
      );
      }
      /* zip + collar */
      // the front zip, lying on the chest
      trim(
        [0.12, 0.3, 0.5, 0.66, 0.8, 0.9].map(q => {
          const i = Math.round(((q + 0.22) / 1.28) * (TR.rings.length - 1));
          return ringPoint(TR.rings[i], Math.PI / 2, 0.002);
        }),
        0.0035,
        M.buckle,
      );
      sc(
        N.clone().addScaledVector(u, -0.05),
        N.clone().addScaledVector(u, 0.035),
        f,
        [
          [0, 0.072],
          [0.6, 0.064],
          [1, 0.06],
        ],
        M.blk,
        14,
        8,
      );
      return u;
    },
    helmet(hc, u, f, opts = {}) {
      const r = 0.134, // adult proportions: the old big helmet made the rider read as a toy
        X = new V3().crossVectors(u, f).normalize(),
        orient = new THREE.Matrix4().makeBasis(X, u, f).setPosition(hc);
      /* shell with graphics: helmet colour, black chin and lower rim, dark centre stripe */
      const shell = helmetDeform(new THREE.SphereGeometry(r, 56, 40), r);
      {
        const Pp = shell.attributes.position,
          C = new Float32Array(Pp.count * 3),
          // sharp helmet: the centre stripe and side swoosh are drawn per pixel from these coordinates
          sharp = M.helm.userData.hsharp && !M.hdesign,
          HV = sharp ? new Float32Array(Pp.count * 4) : null;
        for (let i = 0; i < Pp.count; i++) {
          const x = Pp.getX(i) / r,
            y = Pp.getY(i) / r,
            z = Pp.getZ(i) / r;
          /* race-helmet graphics: main shell, white centre stripe and side swoosh, black lower rim */
          const hp = M.hpal || {
            main: { r: 1, g: 1, b: 1 },
            sec: { r: 0.22, g: 0.22, b: 0.22 },
            blk: { r: BLK, g: BLK, b: BLK },
          };
          let c = hp.main;
          if (sharp) {
            HV.set([x, y, z, 2], i * 4);
            if (y < -0.55) c = hp.blk;
          } else if (y < -0.55) c = hp.blk;
          else if (Math.abs(x) < 0.13 && y > 0.18 && z < 0.7) c = hp.sec;
          else if (Math.abs(x) > 0.45 && z < 0.35 && Math.abs(y - (0.02 - 0.42 * z)) < 0.085) c = hp.sec;
          else if (Math.abs(x) > 0.45 && z < 0.35 && Math.abs(y - (0.02 - 0.42 * z)) < 0.13) c = hp.blk;
          if (M.hdesign) c = M.hdesign(x, y, z, hp) || c;
          C[i * 3] = c.r;
          C[i * 3 + 1] = c.g;
          C[i * 3 + 2] = c.b;
        }
        shell.setAttribute('color', new THREE.BufferAttribute(C, 3));
        if (sharp) shell.setAttribute('chev', new THREE.BufferAttribute(HV, 4));
      }
      shell.applyMatrix4(orient);
      mesh(shell, M.helm);
      const vz = helmetDeform(
        new THREE.SphereGeometry(r * 1.012, 30, 14, Math.PI / 2 - 1.05, 2.1, 1.08, 0.78),
        r * 1.012,
      );
      vz.applyMatrix4(orient);
      mesh(vz, M.visor);
      [1.07, 1.86].forEach(th => {
        const s = helmetDeform(
          new THREE.SphereGeometry(r * 1.02, 30, 2, Math.PI / 2 - 1.07, 2.14, th, 0.035),
          r * 1.02,
        );
        s.applyMatrix4(orient);
        mesh(s, M.blk);
      });
      const Pp = (x, y, z) => hc.clone().addScaledVector(X, x).addScaledVector(u, y).addScaledVector(f, z);
      // padded neck roll closing the base of the shell
      {
        const roll = mesh(new THREE.TorusGeometry(r * 0.5, 0.016, 8, 26), M.blk);
        roll.position.copy(Pp(0, -r * 0.8, -0.004));
        roll.quaternion.setFromUnitVectors(V(0, 0, 1), u);
      }
      [1, -1].forEach(s => {
        puck(Pp(s * 0.147, -0.01, 0.075), X, 0.02, 0.006, M.blk);
      });
      const cv = mesh(new THREE.BoxGeometry(0.05, 0.02, 0.012), M.blk);
      cv.position.copy(Pp(0, -0.112, 0.178));
      cv.quaternion.setFromRotationMatrix(orient);
      sc(
        Pp(-0.08, 0.06, -0.168),
        Pp(0.08, 0.06, -0.168),
        f.clone().negate(),
        [
          [0, 0.01, 0.006],
          [0.5, 0.034, 0.018],
          [1, 0.01, 0.006],
        ],
        M.helm,
        12,
        8,
      );
      if (opts.mx) {
        sc(
          Pp(-0.13, 0.1, 0.13),
          Pp(0.13, 0.1, 0.13),
          u,
          [
            [0, 0.02, 0.006],
            [0.5, 0.08, 0.008, 0.055],
            [1, 0.02, 0.006],
          ],
          M.helm,
          12,
          6,
        );
        const gg = mesh(new THREE.TorusGeometry(r * 1.07, 0.012, 6, 32), M.blk);
        gg.position.copy(Pp(0, 0.03, 0));
        gg.quaternion.setFromUnitVectors(V(0, 0, 1), u);
        gg.scale.set(1, 1.1, 1);
        sc(
          Pp(-0.085, 0.035, 0.172),
          Pp(0.085, 0.035, 0.172),
          f,
          [
            [0, 0.025, 0.012],
            [0.5, 0.03, 0.016],
            [1, 0.025, 0.012],
          ],
          M.goggle,
          12,
          8,
        );
      }
    },
    arm(sh, el, wr, sx, f, grip) {
      const d1 = el.clone().sub(sh).normalize(),
        d2 = wr.clone().sub(el).normalize(),
        out = V(sx, 0, 0);
      /* ONE skin from shoulder to wrist, curving through the elbow: deltoid, biceps and triceps, the point of
         the elbow, the forearm's belly tapering to the wrist. Main colour on the outside with a white stripe
         running the whole length, black on the inside. */
      const lb = limb(sh, el, wr, f, 1, ARM),
        thO = lb.angleOf(out, 0.2),
        flatA = !M.design,
        paint = (part, c, t, th, r) => {
          M.part = part;
          return M.pal ? tint(c, t, ringDir(r, th), ringPoint(r, th), r.X, r.T, r.Z) : c;
        };
      mesh(
        skin(lb.rings(30), 16, {
          flat: flatA,
          colorAt: (s0, th, r) => {
            const d = Math.cos(th - thO),
              c = d > 0.9 && s0 > 0.05 && s0 < 0.9 ? SEC : d > -0.15 && s0 > 0.03 ? MAIN : BLK;
            return s0 < 0.5 ? paint('uarm', c, s0 * 2, th, r) : paint('farm', c, (s0 - 0.5) * 2, th, r);
          },
        }),
        M.suit,
      );
      /* protection moulded into the suit: a shoulder cup and an elbow guard, low raised panels */
      mesh(
        patch(lb, 0.0, 0.27, thO, 1.05, 0.011, (s0, th, r) => paint('shoulder', Math.abs(th - thO) < 0.22 ? SEC : MAIN, s0 / 0.27, th, r), 10, 10),
        M.suit,
      );
      mesh(patch(lb, 0.42, 0.61, -Math.PI / 2, 0.95, 0.011, (s0, th, r) => paint('shoulder', BLK, 0.5, th, r), 10, 8), M.suit);
      /* gauntlet cuff over the end of the sleeve */
      mesh(
        skin(lb.rings(7, 0.83, 1.02), 14, {
          flat: flatA,
          capB: true,
          lift: s0 => 0.006 + 0.007 * Math.min(1, (s0 - 0.83) / 0.17),
          colorAt: (s0, th, r) => paint('cuff', Math.cos(th - thO) > 0.2 && s0 > 0.88 ? MAIN : BLK, (s0 - 0.83) / 0.19, th, r),
        }),
        M.suit,
      );
      if (grip) {
        const gc = grip,
          palm0 = wr.clone(),
          palm1 = gc.clone().add(V(0, 0.03, -0.005));
        sc(
          palm0,
          palm1,
          V(0, 1, 0.2),
          [
            [0, 0.038, 0.024],
            [0.5, 0.044, 0.028],
            [1, 0.04, 0.024],
          ],
          M.glove,
          12,
          10,
        );
        for (let i = 0; i < 4; i++) {
          const x = sx * (-0.03 + i * 0.02),
            rr = 0.033,
            pts = [95, 40, -15, -60].map(a => {
              const t = (a * Math.PI) / 180;
              return gc.clone().add(V(x, Math.sin(t) * rr, Math.cos(t) * rr));
            });
          for (let j = 0; j < 3; j++)
            sc(
              pts[j],
              pts[j + 1],
              V(0, 1, 0),
              [
                [0, 0.0115],
                [0.5, 0.012],
                [1, 0.0105],
              ],
              M.glove,
              8,
              6,
            );
          ball(pts[0], [0.0135, 0.0135, 0.0135], M.glove, 8);
        }
        sc(
          gc.clone().add(V(-sx * 0.045, 0.02, -0.02)),
          gc.clone().add(V(-sx * 0.01, -0.025, 0.03)),
          V(0, 1, 0),
          [
            [0, 0.013],
            [1, 0.011],
          ],
          M.glove,
          8,
          6,
        );
        sc(
          gc.clone().add(V(-sx * 0.035, 0.045, 0.0)),
          gc.clone().add(V(sx * 0.035, 0.045, 0.012)),
          V(0, 1, 0),
          [
            [0, 0.012, 0.01],
            [0.5, 0.016, 0.012],
            [1, 0.012, 0.01],
          ],
          M.slider,
          10,
          6,
        );
      } else {
        const fw = d2.clone();
        sc(
          wr,
          wr.clone().addScaledVector(fw, 0.09),
          f,
          [
            [0, 0.038, 0.022],
            [0.5, 0.044, 0.026],
            [1, 0.038, 0.022],
          ],
          M.glove,
          12,
          10,
        );
        for (let i = 0; i < 4; i++) {
          const a = wr
              .clone()
              .addScaledVector(fw, 0.085)
              .add(V(0, 0, (i - 1.5) * 0.018)),
            b = a
              .clone()
              .addScaledVector(fw, 0.06)
              .add(V(-sx * 0.012, 0, 0.01));
          sc(
            a,
            b,
            V(0, 0, 1),
            [
              [0, 0.011],
              [1, 0.009],
            ],
            M.glove,
            8,
            6,
          );
        }
        sc(
          wr
            .clone()
            .addScaledVector(fw, 0.03)
            .add(V(-sx * 0.03, 0, 0.02)),
          wr
            .clone()
            .addScaledVector(fw, 0.08)
            .add(V(-sx * 0.04, 0, 0.04)),
          V(0, 0, 1),
          [
            [0, 0.012],
            [1, 0.01],
          ],
          M.glove,
          8,
          6,
        );
      }
    },
    leg(hip, kn, an, sx, fwd) {
      const out = V(sx, 0, 0),
        dth = kn.clone().sub(hip).normalize(),
        dsh = an.clone().sub(kn).normalize();
      /* ONE skin from hip to ankle, curving through the knee: quad and hamstring, kneecap, calf, ankle. */
      const lb = limb(hip, kn, an, fwd, -1, LEG),
        thO = lb.angleOf(out, 0.25),
        flatL = !M.design,
        paint = (part, c, t, th, r) => {
          M.part = part;
          return M.pal ? tint(c, t, ringDir(r, th), ringPoint(r, th), r.X, r.T, r.Z) : c;
        };
      mesh(
        skin(lb.rings(34), 20, {
          flat: flatL,
          colorAt: (s0, th, r) => {
            const d = Math.cos(th - thO),
              back = Math.sin(th) < -0.55;
            if (s0 < 0.5) {
              // thigh: main front, white stripe down the outside, black inside and seat
              const c = d > 0.9 && s0 > 0.04 ? SEC : d < -0.5 || s0 < 0.03 || (back && s0 < 0.2) ? BLK : MAIN;
              return paint('thigh', c, s0 * 2, th, r);
            }
            // shin: main front and outside, black calf side
            return paint('shin', d > 0.9 && s0 < 0.72 ? SEC : d > -0.55 ? MAIN : BLK, (s0 - 0.5) * 2, th, r);
          },
        }),
        M.suit,
      );
      /* knee protector moulded over the kneecap, with a small slider on the outside */
      mesh(patch(lb, 0.41, 0.62, Math.PI / 2, 1.0, 0.013, (s0, th, r) => paint('knee', BLK, 0.5, th, r), 12, 10), M.suit);
      {
        const kr = lb.ring(0.5);
        puck(ringPoint(kr, thO + 0.5, 0.006), ringDir(kr, thO + 0.5), 0.02, 0.006, M.slider);
      }
      /* race boot: the shaft is part of the leg's line (a layer over the shin), white band at the top, a shin
         plate in the suit colour; then a properly shaped foot: heel, instep, toe box. */
      mesh(
        skin(lb.rings(9, 0.7, 1.0), 18, {
          flat: flatL,
          lift: 0.009,
          colorAt: (s0, th, r) => {
            const t = (s0 - 0.7) / 0.3;
            if (t < 0.13) return paint('boot', SEC, 0.95, th, r);
            return Math.abs(Math.sin((th - Math.PI / 2) / 2)) < 0.3 && t < 0.8 ? paint('bootplate', MAIN, t, th, r) : paint('boot', BLK, 1 - t, th, r);
          },
        }),
        M.suit,
      );
      const ankle = an,
        sole0 = ankle.clone().add(V(0, -0.075, -0.07)),
        toe = ankle.clone().add(V(0, -0.08, 0.17));
      {
        const FOOT = [
            [0, 0.018, 0.03, 0.014],
            [0.08, 0.038, 0.058, 0.02],
            [0.3, 0.042, 0.078, 0.022],
            [0.5, 0.045, 0.052, 0.022],
            [0.75, 0.045, 0.036, 0.02],
            [0.92, 0.037, 0.029, 0.018],
            [1, 0.016, 0.015, 0.012],
          ],
          FX = V(1, 0, 0),
          FZ = V(0, 1, 0),
          FT = V(0, 0, 1),
          rings = [];
        for (let i = 0; i <= 16; i++) {
          const v = i / 16;
          let k = 0;
          while (k < FOOT.length - 2 && FOOT[k + 1][0] < v) k++;
          const a = FOOT[k],
            b = FOOT[k + 1],
            w = (v - a[0]) / (b[0] - a[0]),
            m = w * w * (3 - 2 * w),
            L = j => a[j] + (b[j] - a[j]) * m;
          rings.push({ c: ankle.clone().add(V(0, -0.052 - 0.016 * v, -0.075 + 0.25 * v)), X: FX, Z: FZ, T: FT, rx: L(1), rf: L(2), rb: L(3), n: 2.5, s: v });
        }
        mesh(
          skin(rings, 14, {
            flat: flatL,
            capA: true,
            capB: true,
            colorAt: (v, th, r) => paint('foot', v > 0.5 && Math.sin(th) > 0.25 ? MAIN : BLK, v, th, r),
          }),
          M.suit,
        );
      }
      sc(
        sole0.clone().add(V(0, 0, -0.012)),
        toe.clone().add(V(0, -0.002, 0.012)),
        V(0, 1, 0),
        [
          [0, 0.046, 0.014],
          [0.5, 0.05, 0.016],
          [1, 0.03, 0.012],
        ],
        M.sole,
        14,
        8,
      );
      ball(toe.clone().add(V(sx * 0.033, 0.016, -0.03)), [0.012, 0.018, 0.032], M.slider, 10);
    },
  };
  return K;
}
/* the suit's chest and back chevrons, drawn per pixel from per-vertex torso coordinates (lat, t, fr) so
   the edges are crisp lines instead of the stair-steps vertex colours give */
function sharpChevron(mat, pal) {
  mat.userData.chev = true;
  mat.extensions = Object.assign(mat.extensions || {}, { derivatives: true });
  const prev = mat.onBeforeCompile,
    prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uSec = { value: pal.sec };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 chev;\nvarying vec4 vChev;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvChev = chev;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSec;\nvarying vec4 vChev;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        #define HAS_CHEV
        float chevM = 0.0;
        if (vChev.w > 0.5) {
          float t = vChev.y, fr = vChev.z, al = abs(vChev.x), d = 1e3;
          if (fr > 0.45 && t > 0.5 && t < 0.8 && al < 0.62) d = abs(al - (t - 0.52) * 1.7) - 0.075;
          if (fr < -0.45 && t > 0.42 && t < 0.74 && al < 0.62) d = abs(al - (0.74 - t) * 1.5) - 0.08;
          float aa = max(fwidth(d), 1e-4);
          chevM = 1.0 - smoothstep(-aa, aa, d);
          diffuseColor.rgb = mix(diffuseColor.rgb, uSec, chevM);
        }`,
      );
  };
  mat.customProgramCacheKey = () => prevKey + '|chev';
}
/* helmet centre stripe and side swoosh drawn per pixel (the helmet carries its shell coordinates in the
   'chev' attribute with w = 2), so the edges are crisp instead of vertex-colour stair-steps */
function sharpHelmet(mat, hp) {
  mat.userData.hsharp = true;
  mat.extensions = Object.assign(mat.extensions || {}, { derivatives: true });
  const prev = mat.onBeforeCompile,
    prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uHSec = { value: hp.sec };
    sh.uniforms.uHBlk = { value: hp.blk };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 chev;\nvarying vec4 vHg;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHg = chev;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uHSec;\nuniform vec3 uHBlk;\nvarying vec4 vHg;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        if (vHg.w > 1.5 && vHg.y >= -0.55) {
          vec3 h = vHg.xyz;
          float ax = abs(h.x);
          // centre stripe
          float d1 = max(ax - 0.13, max(0.18 - h.y, h.z - 0.7));
          float a1 = max(fwidth(d1), 1e-4);
          // side swoosh: black edge band with a stripe inside it
          float e = abs(h.y - (0.02 - 0.42 * h.z));
          float gate = max(0.45 - ax, h.z - 0.35);
          float dB = max(e - 0.13, gate), dS = max(e - 0.085, gate);
          float aB = max(fwidth(dB), 1e-4), aS = max(fwidth(dS), 1e-4);
          diffuseColor.rgb = mix(diffuseColor.rgb, uHBlk, 1.0 - smoothstep(-aB, aB, dB));
          diffuseColor.rgb = mix(diffuseColor.rgb, uHSec, 1.0 - smoothstep(-aS, aS, dS));
          diffuseColor.rgb = mix(diffuseColor.rgb, uHSec, 1.0 - smoothstep(-a1, a1, d1));
        }`,
      );
  };
  mat.customProgramCacheKey = () => prevKey + '|hsharp';
}
/* trim in a neon or a pattern: the trim panels (vertex colour = the trim colour, plus the shader-drawn
   chevron) glow like neon tubes, or show the real pattern texture instead of its flat base colour */
function trimFx(mat, pal, it) {
  if (!it || !(it.neon || it.tex)) return;
  const T = it.tex ? finishTex(it.tex) : null,
    sc = T ? T.scale.toFixed(3) : '1.',
    prev = mat.onBeforeCompile,
    prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uTrimC = { value: pal.sec };
    sh.uniforms.uTrimT = NEON_T;
    if (T) sh.uniforms.uTrimMap = { value: T.map };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTrP;\nvarying vec3 vTrN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTrP = position;\nvTrN = normal;');
    let code = `{
        float tm = 1.0 - smoothstep(0.02, 0.06, distance(vColor.rgb, uTrimC));
        #ifdef HAS_CHEV
        tm = max(tm, chevM);
        #endif
        `;
    if (T) {
      code += `vec3 tw = pow(abs(normalize(vTrN)), vec3(4.0)); tw /= (tw.x + tw.y + tw.z);
        vec3 tc = texture2D(uTrimMap, vTrP.zy * ${sc}).rgb * tw.x + texture2D(uTrimMap, vTrP.zx * ${sc}).rgb * tw.y + texture2D(uTrimMap, vTrP.xy * ${sc}).rgb * tw.z;
        tc = pow(tc, vec3(2.2));
        diffuseColor.rgb = mix(diffuseColor.rgb, tc, tm);`;
      if (T.glow) code += `totalEmissiveRadiance += tc * tm * ${T.glow.toFixed(2)};`;
    }
    if (it.neon)
      code += `float bz = 0.86 + 0.14 * sin(uTrimT * 31.0) * sin(uTrimT * 17.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), tm * 0.3);
        totalEmissiveRadiance += uTrimC * tm * 2.4 * bz;`;
    code += '}';
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec3 uTrimC;\nuniform float uTrimT;\n${T ? 'uniform sampler2D uTrimMap;\n' : ''}varying vec3 vTrP;\nvarying vec3 vTrN;`)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + code);
  };
  mat.customProgramCacheKey = () => prevKey + '|trim' + it.id;
}
function riderMats(o, C, P) {
  const SM = (c, r, mt, x = {}) =>
    new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r, metalness: mt }, x));
  const suit = new THREE.MeshStandardMaterial({
    color: deep(o.suitHex ?? (o.suit ? findItem('paint', o.suit).c : (C.suit ?? P.c))),
    roughness: C.metal ? 0.25 : 0.4,
    metalness: C.metal ? 0.9 : 0.18,
    vertexColors: true,
    transparent: !!C.ghost,
    opacity: C.ghost ? 0.55 : 1,
    emissive: C.ghost ? 0x8899aa : 0,
    emissiveIntensity: C.ghost ? 0.5 : 0,
  });
  const HC = o.helmetHex ?? (o.helmet ? findItem('paint', o.helmet).c : null),
    helm = new THREE.MeshStandardMaterial({
      color: deep(HC ?? C.helmet ?? P.c),
      metalness: 0.45,
      roughness: 0.16,
      vertexColors: true,
      transparent: !!C.ghost,
      opacity: C.ghost ? 0.6 : 1,
    });
  if (o.suit) applyFinish(suit, findItem('paint', o.suit));
  if (o.helmet) applyFinish(helm, findItem('paint', o.helmet));
  const base = suit.userData.neon != null ? new THREE.Color(suit.userData.neon) : suit.color,
    light = base.getHSL({}).l > 0.75;
  /* colour-blocked leathers: the material is white and each panel carries its own colour
     (main / secondary stripe / black), like real race suits. Neon keeps one glowing colour. */
  const tones = mat => {
    const neon = mat.userData.neon != null,
      main = mat.map ? new THREE.Color(0xffffff) : mat.color.clone(),
      hsl = (neon ? new THREE.Color(mat.userData.neon) : main).getHSL({}),
      sec = new THREE.Color(hsl.l > 0.72 || (mat.map && !neon) ? 0x34373e : 0xf2f2f0);
    if (!neon) mat.color.set(0xffffff);
    return { main, sec, blk: new THREE.Color(0x111115), dim: main.clone().multiplyScalar(0.55) };
  };
  const pal = tones(suit),
    hpal = tones(helm),
    D = COSTUMES[C.id];
  // outfit palette: its own stripe and panel colours (the suit picker still sets the main colour)
  if (D && D.pal && suit.userData.neon == null) {
    if (D.pal.sec != null) pal.sec = new THREE.Color(D.pal.sec).convertSRGBToLinear();
    if (D.pal.blk != null) pal.blk = new THREE.Color(D.pal.blk).convertSRGBToLinear();
  }
  // trim colour picked in the garage replaces the white/grey stripes
  if (o.trim && suit.userData.neon == null) {
    pal.sec = deep(findItem('paint', o.trim).c);
    // trim panels are found by their colour, so keep it apart from the suit colour if they're near-identical
    const dc = Math.abs(pal.sec.r - pal.main.r) + Math.abs(pal.sec.g - pal.main.g) + Math.abs(pal.sec.b - pal.main.b);
    if (dc < 0.15) pal.sec.offsetHSL(0, 0, pal.sec.getHSL({}).l > 0.5 ? -0.12 : 0.12);
    trimFx(suit, pal, findItem('paint', o.trim)); // before the chevron so its code runs after it
  }
  // chest/back chevron drawn per pixel (sharp edge) on plain leathers; see riderKit torso
  if (!(D && D.design) && !C.ghost) sharpChevron(suit, pal);
  if (!(D && D.helmet) && !C.ghost && helm.userData.neon == null) sharpHelmet(helm, hpal);
  const CODE = { MAIN, SEC, BLK, DIM };
  return {
    suit,
    helm,
    pal,
    hpal,
    design:
      D && D.design && !C.ghost
        ? (...a) => {
            const r = D.design(...a);
            return typeof r === 'string' ? CODE[r] : r;
          }
        : null,
    hdesign: D && D.helmet ? (x, y, z, hp) => D.helmet(x, y, z, hp) : null,
    costume: D,
    pad: SM(0x1e2026, 0.38, 0.3),
    blk: SM(0x111114, 0.6, 0.15),
    visor: SM(0x1a3550, 0.04, 0.95, { emissive: 0x0a1a2a, emissiveIntensity: 0.3 }),
    accent: SM(light ? 0x222226 : 0xf2f2f2, 0.35, 0.1),
    sole: SM(0x161616, 0.9, 0),
    buckle: SM(0xc0c4cc, 0.25, 0.9),
    boot: SM(0x18181c, 0.35, 0.25, { vertexColors: true }),
    glove: SM(0x141417, 0.5, 0.15, { vertexColors: true }),
    slider: SM(0x9aa0aa, 0.3, 0.6),
    goggle: SM(0xffa040, 0.08, 0.6, { transparent: true, opacity: 0.85 }),
  };
}
function costumeExtras(add, C, tc, f, u, hc) {
  const glowM = h => new THREE.MeshBasicMaterial({ color: h }),
    V = (x, y, z) => new V3(x, y, z),
    fr = d => tc.clone().addScaledVector(f, d);
  const put = (geo, mat, p, q) => {
      const e = add(geo, mat);
      e.position.copy(p);
      if (q) e.quaternion.copy(q);
      return e;
    },
    qU = new THREE.Quaternion().setFromUnitVectors(YAX, u);
  if (C.stripe) {
    put(new THREE.BoxGeometry(0.06, 0.46, 0.01), glowM(C.stripe), fr(0.15), qU);
    put(new THREE.BoxGeometry(0.04, 0.02, 0.32), glowM(C.stripe), hc.clone().add(V(0, 0.165, 0)));
  }
  if (C.stars)
    [1, -1].forEach(sx =>
      put(new THREE.OctahedronGeometry(0.04), glowM(0x2563eb), tc.clone().add(V(sx * 0.15, 0.08, 0))),
    );
  if (C.bones)
    for (let i = 0; i < 4; i++)
      put(new THREE.BoxGeometry(0.26, 0.025, 0.02), glowM(0xf0f0e8), fr(0.15).addScaledVector(u, -0.12 + i * 0.08), qU);
  if (C.emblem) put(new THREE.OctahedronGeometry(0.06), glowM(C.emblem), fr(0.17));
  if (C.horns)
    [1, -1].forEach(sx => {
      const h = put(new THREE.ConeGeometry(0.035, 0.14, 8), glowM(0xf4e8d0), hc.clone().add(V(sx * 0.09, 0.15, 0)));
      h.rotation.z = -sx * 0.5;
    });
  if (C.crest)
    for (let i = 0; i < 5; i++)
      put(
        new THREE.ConeGeometry(0.03, 0.1 + 0.03 * (i % 2), 6),
        glowM(C.crest),
        hc.clone().add(V(0, 0.17, 0.1 - i * 0.05)),
      );
  if (C.nose) put(new THREE.SphereGeometry(0.04, 10, 8), glowM(0xff2020), hc.clone().add(V(0, -0.03, 0.19)));
  if (C.crown) {
    const cm = new THREE.MeshStandardMaterial({
      color: 0xffd23f,
      metalness: 1,
      roughness: 0.2,
      side: THREE.DoubleSide,
    });
    put(new THREE.CylinderGeometry(0.09, 0.08, 0.07, 8, 1, true), cm, hc.clone().add(V(0, 0.17, 0)));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      put(
        new THREE.ConeGeometry(0.018, 0.06, 5),
        cm,
        hc.clone().add(V(Math.cos(a) * 0.085, 0.23, Math.sin(a) * 0.085)),
      );
    }
  }
}
/* anchor points and orientations costume props are placed from (rider on the bike or standing figure) */
function costumeCtx(Hp, N, u, f, hc, hu, hf) {
  const X = new V3().crossVectors(u, f).normalize(),
    hX = new V3().crossVectors(hu, hf).normalize(),
    q = (a, b, c) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(a, b, c));
  const pt = (o, a, b, c) => (x, y, z) => o.clone().addScaledVector(a, x).addScaledVector(b, y).addScaledVector(c, z);
  return {
    u,
    f,
    X,
    hu,
    hf,
    hX,
    neck: N.clone(),
    qUp: new THREE.Quaternion().setFromUnitVectors(YAX, u),
    qFront: q(X, u, f),
    qHead: q(hX, hu, hf),
    at: pt(Hp, X, u, f),
    hip: pt(Hp, X, u, f),
    head: pt(hc, hX, hu, hf),
  };
}
function buildRider(rider, S, st, C, o, P, X) {
  const V = (x, y, z) => new V3(x, y, z),
    M = riderMats(o, C, P),
    G = new THREE.Group();
  rider.add(G);
  const K = riderKit(G, M);
  const lean = S.lean,
    seatTop = S.seat[0],
    Hp = V(0, seatTop + 0.1, S.seat[1] + 0.06),
    u0 = V(0, Math.cos(lean), Math.sin(lean)),
    f = V(0, -Math.sin(lean), Math.cos(lean)),
    N = Hp.clone().addScaledVector(u0, 0.52);
  const u = K.torso(Hp, N, f, { hump: st === 'sport' || st === 'rocket' });
  const lookUp = Math.max(0, lean - 0.4) * 0.9,
    hc = N.clone()
      .addScaledVector(u, 0.115)
      .addScaledVector(f, 0.02 + lookUp * 0.06)
      .add(V(0, lookUp * 0.04, 0)),
    hu = V(0, 1, 0).lerp(u, 0.35).normalize(),
    hf = V(0, 0, 1).lerp(f, 0.3).normalize();
  K.helmet(hc, hu, hf, { mx: st === 'dirt' });
  const arms = [];
  /* each side's riding arm + leg is its own group, so the seat-stand pose can hide them on that side */
  const limbs = {};
  [1, -1].forEach(sx => {
    limbs[sx] = new THREE.Group();
    rider.add(limbs[sx]);
  });
  [1, -1].forEach(sx => {
    const sh = N.clone()
        .add(V(sx * 0.175, -0.05, 0))
        .addScaledVector(f, -0.01),
      gc = X.gripP(sx)
        .clone()
        .add(V(-sx * 0.05, 0, 0)),
      wr = gc.clone().add(V(-sx * 0.05, 0.025, -0.045));
    const el = ik2(sh, wr, 0.31, 0.29, V(sx * 0.7, -0.45, -0.35));
    riderKit(limbs[sx], M).arm(sh, el, wr, sx, f, gc);
    arms.push({ sh });
  });
  [1, -1].forEach(sx => {
    const hip = Hp.clone().add(V(sx * 0.1, -0.02, 0)),
      an = V(sx * 0.17, S.peg[0] + 0.1, S.peg[1] - 0.02);
    const kn = ik2(hip, an, 0.42, 0.42, V(sx * 0.18, 0.6, 1));
    riderKit(limbs[sx], M).leg(hip, kn, an, sx, V(0, 0, 1));
  });
  if (M.costume && M.costume.props) M.costume.props(K.mesh, costumeCtx(Hp, N, u, f, hc, hu, hf));
  const trick = new THREE.Group();
  trick.visible = false;
  trick.userData.keep = true;
  rider.add(trick);
  {
    const TK = riderKit(trick, M),
      sh = arms[0].sh,
      wr = sh.clone().add(V(0.5, 0.16, 0.02)),
      el = sh
        .clone()
        .lerp(wr, 0.5)
        .add(V(0, 0.03, -0.02));
    TK.arm(sh, el, wr, 1, f, null);
    const hip = Hp.clone().add(V(0.1, -0.02, 0)),
      an = hip.clone().add(V(0.5, -0.22, -0.24)),
      kn = hip
        .clone()
        .lerp(an, 0.5)
        .add(V(0, 0.04, 0.04));
    TK.leg(hip, kn, an, 1, V(0.3, 0, 1).normalize());
  }
  let flutter = null;
  const capeSpec = (M.costume && M.costume.cape) || (C.cape ? { col: C.cape, lining: C.cape, metal: C.metal } : null);
  if (capeSpec) {
    const cape = makeCape(capeSpec, capeSpec.short ? 0.6 : 0.85, 0.5);
    cape.grp.position.copy(N).addScaledVector(f, -0.15);
    cape.grp.rotation.x = 0.85;
    cape.grp.userData.keep = true;
    rider.add(cape.grp);
    flutter = (t, amt) => cape.flutter(t, amt);
  }
  mergeGroup(G);
  mergeGroup(limbs[1]);
  mergeGroup(limbs[-1]);
  mergeGroup(trick);
  return { trick, flutter, limbs };
}
function makeFigure(cid, paintHex, suitHex, suitId, helmId, trimId) {
  if (RIDER_GLTF)
    try {
      return figureFromModel(cid, paintHex, suitHex, suitId, helmId);
    } catch (e) {}
  const C = findItem('costume', cid),
    f = new THREE.Group(),
    body = new THREE.Group();
  f.add(body);
  const V = (x, y, z) => new V3(x, y, z);
  const M = riderMats({ suitHex: suitHex ?? undefined, helmetHex: paintHex, suit: suitId, helmet: helmId, trim: trimId }, C, {
      c: paintHex,
    }),
    K = riderKit(body, M),
    F = V(0, 0, 1),
    U = V(0, 1, 0);
  const Hp = V(0, 0.98, 0),
    N = V(0, 1.56, 0);
  K.torso(Hp, N, F);
  [1, -1].forEach(sx => {
    const hip = V(sx * 0.1, 0.97, 0),
      kn = V(sx * 0.11, 0.55, 0.035),
      an = V(sx * 0.115, 0.17, -0.01);
    K.leg(hip, kn, an, sx, F);
  });
  const arms = [];
  [1, -1].forEach(sx => {
    const sh = new THREE.Group();
    sh.position.set(sx * 0.2, 1.47, 0);
    body.add(sh);
    const AK = riderKit(sh, M);
    AK.arm(V(0, 0, 0), V(sx * 0.03, -0.3, 0.02), V(sx * 0.05, -0.55, 0.07), sx, F, null);
    arms.push(sh);
  });
  const head = new THREE.Group();
  head.position.set(0, 1.69, 0.01);
  body.add(head);
  riderKit(head, M).helmet(V(0, 0, 0), U, F);
  if (M.costume && M.costume.props) {
    const add = grp => (g, m) => {
      const e = new THREE.Mesh(g, m);
      e.castShadow = true;
      grp.add(e);
      return e;
    };
    const ctx = costumeCtx(Hp, N, U, F, V(0, 0, 0), U, F);
    ctx.addH = add(head);
    M.costume.props(add(body), ctx);
  }
  let cape = null;
  const capeSpec = (M.costume && M.costume.cape) || (C.cape ? { col: C.cape, lining: C.cape, metal: C.metal } : null);
  if (capeSpec) {
    cape = makeCape(capeSpec, capeSpec.short ? 0.8 : 1.15, 0.62);
    cape.grp.position.set(0, 1.58, -0.2);
    cape.grp.rotation.x = 0.12;
    body.add(cape.grp);
  }
  f.userData.tick = (t, cheer) => {
    body.position.y = Math.sin(t * 2) * 0.01 + cheer * Math.max(0, Math.sin(t * 12)) * 0.12;
    head.rotation.y = Math.sin(t * 0.7) * 0.25;
    arms[0].rotation.z = cheer ? 2.6 + Math.sin(t * 12) * 0.2 : 0.08 + Math.sin(t * 1.3) * 0.03;
    arms[1].rotation.z = cheer ? -2.6 - Math.sin(t * 12) * 0.2 : -0.08 - Math.sin(t * 1.3) * 0.03;
    if (cape) cape.flutter(t, 1, 1);
  };
  neonify(f);
  envify(f);
  return f;
}

export { buildRider, costumeExtras, makeFigure, riderKit, riderMats, sculptGeo };
