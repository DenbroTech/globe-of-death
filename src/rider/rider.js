import * as THREE from 'three';
import { mergeGroup } from '../bikes/bike.js';
import { neonify } from '../render/neon.js';
import { RIDER_GLTF, figureFromModel } from './riderModel.js';
import { V3, YAX } from '../core/constants.js';
import { applyFinish, deep } from '../bikes/finishes.js';
import { findItem } from '../bikes/catalog.js';
import { envify } from '../render/envmap.js';
import { ik2 } from './ik.js';
import { COSTUMES, makeCape } from './costumes.js';

/* ---------- riders: sculpted bodies (smooth profiles, not tubes) plus real riding kit ---------- */
function sculptGeo(a, b, front, prof, ws = 16, hs = 18, k = 0.3, cfn = null) {
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
    z *= 1.12;
    if (z > 0 && y < 0.08) {
      const k = 0.08 - y;
      z += k * 0.34 * z;
      y -= k * 0.08;
    }
    if (y < -0.5) {
      x *= 0.9;
      z *= 0.95;
    }
    if (z < -0.5 && y > -0.2 && y < 0.62) z -= 0.08 * Math.sin(((y + 0.2) / 0.82) * Math.PI);
    if (y > 0.15) x *= 1 - 0.05 * (y - 0.15);
    if (y < -0.78) y = -0.78 - (y + 0.78) * 0.4;
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
    return mesh(sculptGeo(a, b, front, prof, ws, hs, k, cfn), mat);
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
      const cv = [];
      const tc = (t, n) => {
        const side = Math.abs(n.dot(X)),
          lat = n.dot(X),
          fr = n.dot(f),
          up = n.dot(u);
        cv.push(lat, t, fr, 1);
        if (t > 0.91) return BLK;
        if (t > 0.8 && up > 0.4) return SEC;
        if (side > 0.62 && t > 0.22 && t < 0.86) return BLK;
        if (!M.suit.userData.chev) {
          if (fr > 0.45 && t > 0.5 && t < 0.8 && Math.abs(Math.abs(lat) - (t - 0.52) * 1.7) < 0.075) return SEC;
          if (fr < -0.45 && t > 0.42 && t < 0.74 && Math.abs(Math.abs(lat) - (0.74 - t) * 1.5) < 0.08) return SEC;
        }
        if (fr < -0.3 && t < 0.34) return BLK;
        if (t < 0.24 && side > 0.42) return BLK;
        return MAIN;
      };
      M.part = 'torso';
      const tor = sc(
        H.clone().addScaledVector(u, -0.05),
        N,
        f,
        [
          [0, 0.135, 0.105],
          [0.1, 0.142, 0.108, 0.004],
          [0.3, 0.118, 0.094, 0],
          [0.52, 0.162, 0.118, 0.02],
          [0.72, 0.205, 0.13, 0.02],
          [0.83, 0.196, 0.118, 0.006],
          [0.9, 0.152, 0.096],
          [0.96, 0.09, 0.075],
          [1, 0.06, 0.06],
        ],
        M.suit,
        48,
        44,
        0.26,
        tc,
      );
      if (cv.length === tor.geometry.attributes.position.count * 4)
        tor.geometry.setAttribute('chev', new THREE.BufferAttribute(new Float32Array(cv), 4));
      /* pelvis/seat: black with main-colour front */
      M.part = 'pelvis';
      sc(
        H.clone().addScaledVector(u, -0.12).addScaledVector(f, -0.015),
        H.clone().addScaledVector(u, 0.13),
        f,
        [
          [0, 0.11, 0.09],
          [0.35, 0.156, 0.126, -0.014],
          [0.7, 0.148, 0.116],
          [1, 0.136, 0.104],
        ],
        M.suit,
        32,
        20,
        0.3,
        (t, n) => (n.dot(f) > 0.4 && t > 0.4 && Math.abs(n.dot(X)) < 0.6 ? MAIN : BLK),
      );
      /* aero hump: main colour, white spine stripe, black flanks */
      M.part = 'hump';
      sc(
        N.clone().addScaledVector(u, -0.27).addScaledVector(f, -0.1),
        N.clone().addScaledVector(u, 0.06).addScaledVector(f, -0.07),
        f.clone().negate(),
        [
          [0, 0.075, 0.03],
          [0.35, 0.112, 0.082],
          [0.78, 0.096, 0.074],
          [1, 0.05, 0.03],
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
      /* zip + collar */
      line(
        H.clone().addScaledVector(u, 0.14).addScaledVector(f, 0.124),
        H.clone()
          .addScaledVector(u, L * 0.9)
          .addScaledVector(f, 0.1),
        0.004,
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
      const r = 0.15,
        X = new V3().crossVectors(u, f).normalize(),
        orient = new THREE.Matrix4().makeBasis(X, u, f).setPosition(hc);
      /* shell with graphics: helmet colour, black chin and lower rim, dark centre stripe */
      const shell = helmetDeform(new THREE.SphereGeometry(r, 56, 40), r);
      {
        const Pp = shell.attributes.position,
          C = new Float32Array(Pp.count * 3);
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
          if (y < -0.55) c = hp.blk;
          else if (Math.abs(x) < 0.13 && y > 0.18 && z < 0.7) c = hp.sec;
          else if (Math.abs(x) > 0.45 && z < 0.35 && Math.abs(y - (0.02 - 0.42 * z)) < 0.085) c = hp.sec;
          else if (Math.abs(x) > 0.45 && z < 0.35 && Math.abs(y - (0.02 - 0.42 * z)) < 0.13) c = hp.blk;
          if (M.hdesign) c = M.hdesign(x, y, z, hp) || c;
          C[i * 3] = c.r;
          C[i * 3 + 1] = c.g;
          C[i * 3 + 2] = c.b;
        }
        shell.setAttribute('color', new THREE.BufferAttribute(C, 3));
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
      /* upper arm: main outside with a white stripe, black inside; forearm: main on top, black underneath.
         Segments overlap at the elbow (no ball joint), the elbow slider covers the bend. */
      const oc = (t, n) => {
          const o = n.dot(out);
          return o > 0.72 && t > 0.1 ? SEC : o > -0.15 && t > 0.08 ? MAIN : BLK;
        },
        fc = (t, n) => (n.dot(YAX) > 0.15 && t < 0.86 ? MAIN : BLK);
      M.part = 'uarm';
      sc(
        sh,
        el.clone().addScaledVector(d1, 0.035),
        f,
        [
          [0, 0.062],
          [0.12, 0.068, 0.064],
          [0.45, 0.063, 0.059],
          [0.82, 0.051, 0.049],
          [1, 0.044],
        ],
        M.suit,
        26,
        22,
        0.3,
        oc,
      );
      M.part = 'farm';
      sc(
        el.clone().addScaledVector(d2, -0.04),
        wr,
        f,
        [
          [0, 0.046],
          [0.2, 0.053, 0.05],
          [0.6, 0.046, 0.043],
          [1, 0.036, 0.033],
        ],
        M.suit,
        24,
        20,
        0.3,
        fc,
      );
      const o1 = out.clone().addScaledVector(d1, -out.dot(d1)).normalize();
      /* shoulder armour: one moulded cap, white on top, black underneath, with a slider */
      M.part = 'shoulder';
      sc(
        sh.clone().add(V(-sx * 0.02, 0.05, 0)),
        sh.clone().add(V(sx * 0.085, -0.075, 0)),
        f,
        [
          [0, 0.03, 0.05],
          [0.45, 0.046, 0.068],
          [1, 0.03, 0.048],
        ],
        M.suit,
        18,
        12,
        0.45,
        (t, n) => (n.dot(YAX) > 0.1 ? SEC : BLK),
      );
      puck(sh.clone().add(V(sx * 0.082, -0.045, 0)), out, 0.024, 0.008, M.slider);
      /* elbow slider */
      puck(
        el
          .clone()
          .addScaledVector(d1, -0.01)
          .addScaledVector(o1, 0.045)
          .add(V(0, -0.02, 0)),
        o1,
        0.03,
        0.014,
        M.slider,
      );
      /* gauntlet: cuff, back of hand, knuckle armour */
      M.part = 'cuff';
      sc(
        wr.clone().addScaledVector(d2, -0.11),
        wr.clone().addScaledVector(d2, 0.012),
        f,
        [
          [0, 0.047, 0.045],
          [0.6, 0.056, 0.052],
          [1, 0.05, 0.048],
        ],
        M.suit,
        14,
        10,
        0.3,
        (t, n) => (n.dot(out) > 0.2 && t > 0.3 ? MAIN : BLK),
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
      const thighFront = V(0, 0.3, 1)
        .addScaledVector(dth, -V(0, 0.3, 1).dot(dth))
        .normalize();
      /* thigh: main front, white stripe down the outside, black inside and seat */
      M.part = 'thigh';
      sc(
        hip,
        kn.clone().addScaledVector(dth, 0.035),
        V(0, 0.3, 1),
        [
          [0, 0.094, 0.1],
          [0.22, 0.099, 0.108, 0.01],
          [0.6, 0.084, 0.09, 0.006],
          [0.88, 0.066, 0.064],
          [1, 0.056],
        ],
        M.suit,
        30,
        26,
        0.3,
        (t, n) => {
          const fr = n.dot(thighFront),
            o = n.dot(out);
          if (o > 0.74 && t > 0.06 && t < 0.92) return SEC;
          if (o < -0.5 || t < 0.06) return BLK; // inner thigh grip panel
          return fr > -0.55 || t > 0.4 ? MAIN : BLK; // seat panel stays black
        },
      );
      /* shin: main front, black calf; overlaps the knee (no ball joint) */
      M.part = 'shin';
      sc(
        kn.clone().addScaledVector(dsh, -0.035),
        an,
        fwd,
        [
          [0, 0.056],
          [0.2, 0.064, 0.07, -0.012],
          [0.45, 0.06, 0.064, -0.01],
          [0.8, 0.048, 0.048],
          [1, 0.044],
        ],
        M.suit,
        26,
        22,
        0.3,
        (t, n) => (t < 0.74 && n.dot(out) > -0.55 ? MAIN : BLK),
      );
      /* knee armour + big slider */
      const kd = dth.clone().add(dsh).normalize(),
        kf = fwd.clone().addScaledVector(kd, -fwd.dot(kd)).normalize();
      M.part = 'knee';
      sc(
        kn.clone().addScaledVector(kd, -0.08).addScaledVector(kf, 0.056),
        kn.clone().addScaledVector(kd, 0.08).addScaledVector(kf, 0.056),
        kf,
        [
          [0, 0.05, 0.022],
          [0.5, 0.068, 0.034],
          [1, 0.05, 0.022],
        ],
        M.suit,
        18,
        12,
        0.3,
        () => BLK,
      );
      const ko = out.clone().addScaledVector(kf, -out.dot(kf)).normalize();
      puck(kn.clone().addScaledVector(ko, 0.068).addScaledVector(kf, 0.01), ko, 0.045, 0.022, M.slider);
      puck(kn.clone().addScaledVector(ko, 0.08).addScaledVector(kf, 0.01), ko, 0.032, 0.01, M.blk);
      /* race boot: black shaft with a main-colour shin plate and white top band, sole, toe slider, heel cup */
      const ankle = an,
        sole0 = ankle.clone().add(V(0, -0.075, -0.07)),
        toe = ankle.clone().add(V(0, -0.08, 0.17));
      M.part = 'boot';
      sc(
        ankle.clone().addScaledVector(dsh, -0.3),
        ankle.clone().add(V(0, -0.02, 0)),
        fwd,
        [
          [0, 0.064, 0.066],
          [0.4, 0.067, 0.07],
          [1, 0.064, 0.066],
        ],
        M.suit,
        18,
        12,
        0.3,
        t => (t > 0.86 ? SEC : BLK),
      );
      M.part = 'bootplate';
      sc(
        ankle.clone().addScaledVector(dsh, -0.26).addScaledVector(fwd, 0.062),
        ankle.clone().addScaledVector(fwd, 0.072),
        fwd,
        [
          [0, 0.036, 0.012],
          [0.5, 0.05, 0.019],
          [1, 0.04, 0.014],
        ],
        M.suit,
        14,
        8,
        0.3,
        () => MAIN,
      );
      M.part = 'foot';
      sc(
        sole0.clone().add(V(0, 0.035, 0)),
        toe.clone().add(V(0, 0.03, 0)),
        V(0, 1, 0),
        [
          [0, 0.045, 0.05],
          [0.35, 0.05, 0.055],
          [0.75, 0.046, 0.04],
          [1, 0.03, 0.022],
        ],
        M.suit,
        16,
        12,
        0.3,
        (t, n) => (t > 0.55 && n.dot(YAX) > 0.2 ? MAIN : BLK),
      );
      sc(
        sole0.clone().add(V(0, 0, -0.012)),
        toe.clone().add(V(0, -0.002, 0.012)),
        V(0, 1, 0),
        [
          [0, 0.048, 0.016],
          [0.5, 0.054, 0.018],
          [1, 0.034, 0.014],
        ],
        M.sole,
        14,
        8,
      );
      ball(toe.clone().add(V(sx * 0.035, 0.02, -0.025)), [0.018, 0.026, 0.04], M.slider, 10);
      ball(sole0.clone().add(V(0, 0.05, -0.005)), [0.045, 0.045, 0.03], M.slider, 10);
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
        if (vChev.w > 0.5) {
          float t = vChev.y, fr = vChev.z, al = abs(vChev.x), d = 1e3;
          if (fr > 0.45 && t > 0.5 && t < 0.8 && al < 0.62) d = abs(al - (t - 0.52) * 1.7) - 0.075;
          if (fr < -0.45 && t > 0.42 && t < 0.74 && al < 0.62) d = abs(al - (0.74 - t) * 1.5) - 0.08;
          float aa = max(fwidth(d), 1e-4);
          diffuseColor.rgb = mix(diffuseColor.rgb, uSec, 1.0 - smoothstep(-aa, aa, d));
        }`,
      );
  };
  mat.customProgramCacheKey = () => prevKey + '|chev';
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
  if (o.trim && suit.userData.neon == null) pal.sec = deep(findItem('paint', o.trim).c);
  // chest/back chevron drawn per pixel (sharp edge) on plain leathers; see riderKit torso
  if (!(D && D.design) && !C.ghost) sharpChevron(suit, pal);
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
