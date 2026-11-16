import * as THREE from 'three';
import { cv, tex } from '../render/textures.js';

/* ---------- hand-built scenery: a coral reef (Underwater) and cave formations (Crystal cavern) ----------
   Everything is made of a few prototype shapes drawn many times (InstancedMesh, per-instance colour), so
   it's rich to look at but cheap to draw. */

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const YA = V(0, 1, 0);
function seeded(s) {
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
/* join several geometries into one (positions + normals, optional vertex colours) */
function mergeGeos(list) {
  const P = [],
    N = [],
    C = [];
  let hasC = false;
  list.forEach(g0 => {
    const g = g0.index ? g0.toNonIndexed() : g0;
    P.push(...g.attributes.position.array);
    N.push(...g.attributes.normal.array);
    if (g.attributes.color) {
      hasC = true;
      C.push(...g.attributes.color.array);
    } else for (let i = 0; i < g.attributes.position.count; i++) C.push(1, 1, 1);
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  if (hasC) out.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  return out;
}
/* a tapered segment from a to b */
function seg(a, b, r0, r1, rad = 5) {
  const g = new THREE.CylinderGeometry(r1, r0, a.distanceTo(b), rad, 1);
  g.applyMatrix4(
    new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(YA, b.clone().sub(a).normalize()), V(1, 1, 1)),
  );
  return g;
}
/* a rock: a ball pushed about by smooth noise of its own position (so the facets never tear apart) */
function rockGeo(seed, detail = 2, flatTop = false) {
  const g = new THREE.IcosahedronGeometry(1, detail),
    p = g.attributes.position,
    col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    const n = Math.sin(x * 2.1 + seed) * Math.sin(z * 2.7 + seed * 1.3) * 0.32 + Math.sin(x * 4.7 + y * 3.9 + z * 4.1 + seed * 2.1) * 0.16,
      d = 1 + n;
    x *= d;
    z *= d;
    y = y * (0.75 + n * 0.5);
    if (flatTop && y > 0.45) y = 0.45 + (y - 0.45) * 0.3;
    y = Math.max(-0.15, y);
    p.setXYZ(i, x, y, z);
    const v = 0.55 + n * 0.5 + y * 0.25;
    col.set([v, v, v], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
const scatter = (mesh, n, place) => {
  const o = new THREE.Object3D(),
    c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    o.position.set(0, 0, 0);
    o.rotation.set(0, 0, 0);
    o.scale.set(1, 1, 1);
    const colHex = place(o, i);
    o.updateMatrix();
    mesh.setMatrixAt(i, o.matrix);
    if (colHex != null) mesh.setColorAt(i, c.setHex(colHex));
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
};
/* sway: plants bend with the current (more toward their tips), each one out of step with its neighbours */
function swayMat(mat, uT, amt = 0.12) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uT = uT;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uT;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float ph = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.5;
        #else
          float ph = 0.0;
        #endif
        float bend = transformed.y * transformed.y * ${amt.toFixed(3)};
        transformed.x += sin(uT * 1.1 + ph + transformed.y * 0.6) * bend;
        transformed.z += cos(uT * 0.8 + ph * 1.3 + transformed.y * 0.5) * bend * 0.6;`,
      );
  };
  return mat;
}

function reef(g) {
  const rnd = seeded(77),
    uT = { value: 0 },
    std = (o = {}) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.75 }, o)),
    spot = (r0, r1) => {
      const a = rnd() * Math.PI * 2,
        r = r0 + rnd() * (r1 - r0);
      return [Math.cos(a) * r, Math.sin(a) * r];
    };
  /* rock outcrops, some flat-topped, weed-green on top */
  {
    const m = std({ vertexColors: true, flatShading: true, color: 0x6b7f86 });
    [rockGeo(1.3, 2), rockGeo(4.1, 2, true), rockGeo(7.7, 2)].forEach((geo, k) =>
      g.add(
        scatter(new THREE.InstancedMesh(geo, m, 9), 9, o => {
          const [x, z] = spot(23, 64),
            s = 1.6 + rnd() * 3.6;
          o.position.set(x, 0, z);
          o.scale.set(s * (0.8 + rnd() * 0.6), s * (0.6 + rnd() * 0.9), s);
          o.rotation.y = rnd() * 6.28;
          return [0x8fa3a8, 0x7d9690, 0x9a9488][k];
        }),
      ),
    );
  }
  /* staghorn coral: real branching */
  const CORAL = [0xff6a8f, 0xff8f3d, 0xb46cff, 0xffd447, 0x35d0c0, 0xff5470];
  {
    const proto = sd => {
      const r = seeded(sd),
        geos = [];
      const grow = (p, dir, len, rad, depth) => {
        const tip = p.clone().addScaledVector(dir, len);
        geos.push(seg(p, tip, rad, rad * 0.72));
        if (!depth) {
          const cap = new THREE.SphereGeometry(rad * 0.74, 5, 4);
          cap.translate(tip.x, tip.y, tip.z);
          geos.push(cap);
          return;
        }
        const n = r() < 0.35 ? 3 : 2;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * 6.28 + r() * 1.5,
            d = dir.clone().add(V(Math.cos(a) * 0.75, 0.25, Math.sin(a) * 0.75)).normalize();
          grow(tip, d, len * (0.68 + r() * 0.15), rad * 0.72, depth - 1);
        }
      };
      for (let t = 0; t < 3; t++) grow(V((r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3), V((r() - 0.5) * 0.5, 1, (r() - 0.5) * 0.5).normalize(), 0.5, 0.085, 2);
      return mergeGeos(geos);
    };
    const m = std({ roughness: 0.6 });
    m.emissive = new THREE.Color(0x221111);
    [11, 23, 37].forEach(sd =>
      g.add(
        scatter(new THREE.InstancedMesh(proto(sd), m, 16), 16, (o, i) => {
          const [x, z] = spot(21, 50);
          o.position.set(x, 0, z);
          o.scale.setScalar(1.2 + rnd() * 1.6);
          o.rotation.y = rnd() * 6.28;
          return CORAL[(i + sd) % CORAL.length];
        }),
      ),
    );
  }
  /* table coral: a wide wavy plate on a stalk; and tube sponges in clusters */
  {
    const plate = (() => {
      const pts = [
        [0.12, 0],
        [0.1, 0.5],
        [0.25, 0.72],
        [0.9, 0.86],
        [1.0, 0.9],
        [0.9, 0.95],
        [0.3, 0.9],
        [0.0, 0.88],
      ].map(q => new THREE.Vector2(q[0], q[1]));
      const geo = new THREE.LatheGeometry(pts, 18),
        p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const a = Math.atan2(p.getZ(i), p.getX(i)),
          r = Math.hypot(p.getX(i), p.getZ(i));
        p.setY(i, p.getY(i) + Math.sin(a * 5) * 0.06 * r);
        const k = 1 + Math.sin(a * 3 + 1) * 0.12 * r;
        p.setX(i, p.getX(i) * k);
        p.setZ(i, p.getZ(i) * k);
      }
      geo.computeVertexNormals();
      return geo;
    })();
    g.add(
      scatter(new THREE.InstancedMesh(plate, std({ side: THREE.DoubleSide, roughness: 0.7 }), 14), 14, (o, i) => {
        const [x, z] = spot(22, 52);
        o.position.set(x, 0, z);
        o.scale.set(1.2 + rnd() * 1.4, 0.9 + rnd() * 0.7, 1.2 + rnd() * 1.4);
        o.rotation.set((rnd() - 0.5) * 0.25, rnd() * 6.28, (rnd() - 0.5) * 0.25);
        return [0xc9a25a, 0x8fb86a, 0xd98a5a, 0x9a7fc9][i % 4];
      }),
    );
    const tube = (() => {
      const geos = [];
      for (let k = 0; k < 5; k++) {
        const h = 0.7 + ((k * 37) % 10) / 12,
          r = 0.14 + ((k * 13) % 7) / 80,
          pts = [
            [r * 0.6, 0],
            [r, h * 0.5],
            [r * 1.1, h],
            [r * 0.85, h],
            [r * 0.7, h * 0.4],
          ].map(q => new THREE.Vector2(q[0], q[1])),
          t = new THREE.LatheGeometry(pts, 9);
        t.rotateZ(((k % 3) - 1) * 0.22);
        t.translate(Math.cos(k * 1.26) * 0.24, 0, Math.sin(k * 1.26) * 0.24);
        geos.push(t);
      }
      return mergeGeos(geos);
    })();
    g.add(
      scatter(new THREE.InstancedMesh(tube, std({ side: THREE.DoubleSide, roughness: 0.8 }), 14), 14, (o, i) => {
        const [x, z] = spot(21, 46);
        o.position.set(x, 0, z);
        o.scale.setScalar(1.3 + rnd() * 1.3);
        o.rotation.y = rnd() * 6.28;
        return [0xffc23d, 0xff7a3d, 0xe85a9a][i % 3];
      }),
    );
  }
  /* brain coral: grooved domes */
  {
    const [c, x] = cv(256, 256);
    x.fillStyle = '#c9c0a8';
    x.fillRect(0, 0, 256, 256);
    x.strokeStyle = 'rgba(60,50,40,.75)';
    x.lineWidth = 5;
    x.lineCap = 'round';
    for (let i = 0; i < 60; i++) {
      let px = rnd() * 256,
        py = rnd() * 256,
        a = rnd() * 6.28;
      x.beginPath();
      x.moveTo(px, py);
      for (let k = 0; k < 10; k++) {
        a += (rnd() - 0.5) * 1.6;
        px += Math.cos(a) * 14;
        py += Math.sin(a) * 14;
        x.lineTo(px, py);
      }
      x.stroke();
    }
    const t = tex(c, true);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 2);
    const geo = new THREE.SphereGeometry(1, 20, 12, 0, 6.3, 0, Math.PI / 2);
    g.add(
      scatter(new THREE.InstancedMesh(geo, std({ map: t, roughness: 0.85 }), 16), 16, (o, i) => {
        const [x2, z] = spot(21, 50);
        o.position.set(x2, 0, z);
        const s = 0.7 + rnd() * 1.3;
        o.scale.set(s, s * (0.6 + rnd() * 0.3), s);
        o.rotation.y = rnd() * 6.28;
        return [0xf2d8a8, 0xe8a8b8, 0xa8e0c8, 0xf0c090][i % 4];
      }),
    );
  }
  /* sea fans: flat lacy fans across the current */
  {
    const [c, x] = cv(256, 256);
    x.strokeStyle = '#fff';
    x.lineCap = 'round';
    const br = (px, py, a, len, w, d) => {
      const ex = px + Math.cos(a) * len,
        ey = py + Math.sin(a) * len;
      x.lineWidth = w;
      x.beginPath();
      x.moveTo(px, py);
      x.lineTo(ex, ey);
      x.stroke();
      if (d > 0) for (const da of [-0.42, 0.05, 0.45]) br(ex, ey, a + da + (rnd() - 0.5) * 0.2, len * 0.72, Math.max(1.2, w * 0.7), d - 1);
    };
    br(128, 252, -Math.PI / 2, 62, 9, 4);
    const t = tex(c, true),
      geo = new THREE.PlaneGeometry(2, 2, 2, 6);
    geo.translate(0, 1, 0);
    const m = swayMat(std({ alphaMap: t, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.8, emissive: 0x220a18 }), uT, 0.04);
    g.add(
      scatter(new THREE.InstancedMesh(geo, m, 18), 18, (o, i) => {
        const [x2, z] = spot(21, 48);
        o.position.set(x2, 0, z);
        o.scale.setScalar(0.9 + rnd() * 1.3);
        o.rotation.y = rnd() * 6.28;
        return [0xc23a8a, 0xe8543a, 0x9a4ad0, 0xf2a03a][i % 4];
      }),
    );
  }
  /* kelp: tall wavy blades in stands, swaying */
  {
    const geo = new THREE.PlaneGeometry(0.5, 1, 2, 14);
    geo.translate(0, 0.5, 0);
    const p = geo.attributes.position,
      col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i),
        edge = Math.abs(p.getX(i)) > 0.2;
      // a wavy-edged blade tapering to a point, twisting as it rises
      const w = (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, y * 0.9 + 0.1))) * (1 + (edge ? Math.sin(y * 34) * 0.18 : 0)),
        tw = y * 2.2,
        x0 = p.getX(i) * w;
      p.setX(i, x0 * Math.cos(tw));
      p.setZ(i, x0 * Math.sin(tw));
      const v = 0.55 + y * 0.45 + (edge ? 0.12 : 0);
      col.set([v * 0.75, v, v * 0.5], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const m = swayMat(std({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.6, color: 0x3f8a3a, emissive: 0x0a2a0c }), uT, 0.05);
    const N = 150,
      clumps = Array.from({ length: 16 }, () => spot(24, 58));
    g.add(
      scatter(new THREE.InstancedMesh(geo, m, N), N, (o, i) => {
        const [cx, cz] = clumps[i % clumps.length];
        o.position.set(cx + (rnd() - 0.5) * 4, 0, cz + (rnd() - 0.5) * 4);
        o.scale.set(0.8 + rnd() * 0.6, 1.6 + rnd() * 3, 0.8 + rnd() * 0.6); // kept short (owner asked for smaller seaweed)
        o.rotation.y = rnd() * 6.28;
        return [0xffffff, 0xd8f0c0, 0xc0d8a0][i % 3];
      }),
    );
  }
  /* starfish and shells on the sand */
  {
    const sh = new THREE.Shape();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2,
        r = k % 2 ? 0.16 : 0.5;
      k ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 });
    geo.rotateX(-Math.PI / 2);
    g.add(
      scatter(new THREE.InstancedMesh(geo, std({ roughness: 0.9 }), 22), 22, (o, i) => {
        const [x2, z] = spot(20.5, 44);
        o.position.set(x2, 0.06, z);
        o.scale.setScalar(0.7 + rnd() * 0.8);
        o.rotation.y = rnd() * 6.28;
        return [0xff7a3d, 0xe8453a, 0xf2b84a, 0xb85ad0][i % 4];
      }),
    );
  }
  const prev = g.userData.tick;
  g.userData.tick = t => {
    if (prev) prev(t);
    uT.value = t;
  };
  return g;
}

/* ---------- Crystal cavern: real cave formations ---------- */
function caveFormations(g) {
  const rnd = seeded(31),
    spot = (r0, r1) => {
      const a = rnd() * Math.PI * 2,
        r = r0 + rnd() * (r1 - r0);
      return [Math.cos(a) * r, Math.sin(a) * r];
    };
  /* stalagmites: stepped flowstone, each tier a little narrower, ridged and wet-looking (not plain cones) */
  const stal = sd => {
    const RS = 12,
      HS = 14,
      pos = [],
      colr = [],
      idx = [];
    for (let j = 0; j <= HS; j++) {
      const h = j / HS,
        tier = 1 - Math.pow(h, 0.8),
        step = 1 + 0.1 * Math.sin(h * 26 + sd); // ripples down its length
      for (let i = 0; i <= RS; i++) {
        const a = (i / RS) * Math.PI * 2,
          rr = (0.08 + tier * (1 + 0.5 * Math.pow(1 - h, 4))) * step * (1 + 0.12 * Math.sin(a * 3 + h * 5 + sd) + 0.07 * Math.sin(a * 7));
        pos.push(Math.cos(a) * rr, h, Math.sin(a) * rr);
        const v = 0.32 + 0.3 * h + 0.1 * Math.sin(h * 26 + sd);
        colr.push(v * 0.95, v * 0.85, v * 1.05);
      }
    }
    for (let j = 0; j < HS; j++)
      for (let i = 0; i < RS; i++) {
        const a0 = j * (RS + 1) + i,
          b0 = a0 + 1,
          c0 = a0 + RS + 1,
          d0 = c0 + 1;
        idx.push(a0, c0, b0, b0, c0, d0);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  };
  const rockM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.1, color: 0x8a7a8e });
  [3, 9].forEach(sd =>
    g.add(
      scatter(new THREE.InstancedMesh(stal(sd), rockM, 22), 22, ob => {
        const [x, z] = spot(22, 62),
          s = 0.9 + rnd() * 1.9;
        ob.position.set(x, 0, z);
        ob.scale.set(s, s * (2.2 + rnd() * 3.4), s);
        ob.rotation.y = rnd() * 6.28;
        return null;
      }),
    ),
  );
  /* big crystal clusters: hexagonal prisms with pointed tips, splayed out from a base, glowing from inside */
  const crystal = (() => {
    const geos = [];
    const cr = seeded(5);
    for (let k = 0; k < 9; k++) {
      const h = 0.7 + cr() * 1.5,
        r = 0.1 + cr() * 0.14,
        body = new THREE.CylinderGeometry(r, r * 0.85, h, 6, 1),
        tip = new THREE.ConeGeometry(r, r * 2.2, 6);
      body.translate(0, h / 2, 0);
      tip.translate(0, h + r * 1.1, 0);
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler((cr() - 0.5) * 1.3, cr() * 6.28, (cr() - 0.5) * 1.3));
      m.setPosition((cr() - 0.5) * 0.5, 0, (cr() - 0.5) * 0.5);
      body.applyMatrix4(m);
      tip.applyMatrix4(m);
      geos.push(body, tip);
    }
    return mergeGeos(geos);
  })();
  const crM = new THREE.MeshStandardMaterial({ roughness: 0.12, metalness: 0.2, flatShading: true, transparent: true, opacity: 0.92, emissive: 0xffffff, emissiveIntensity: 0.35 });
  crM.onBeforeCompile = sh => {
    // glow in each cluster's own colour
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance *= vColor;\n#endif');
  };
  g.add(
    scatter(new THREE.InstancedMesh(crystal, crM, 26), 26, (ob, i) => {
      const [x, z] = spot(21, 58);
      ob.position.set(x, 0, z);
      ob.scale.setScalar(1.6 + rnd() * 2.6);
      ob.rotation.y = rnd() * 6.28;
      return [0x9fe8ff, 0xd9a0ff, 0xff9ad8, 0x9affc8][i % 4];
    }),
  );
  /* boulders and rubble at the foot of the walls */
  const bm = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, color: 0x6a5f70 });
  g.add(
    scatter(new THREE.InstancedMesh(rockGeo(2.2, 2), bm, 30), 30, ob => {
      const [x, z] = spot(24, 70),
        s = 0.8 + rnd() * 3;
      ob.position.set(x, 0, z);
      ob.scale.set(s, s * (0.5 + rnd() * 0.7), s * (0.7 + rnd() * 0.6));
      ob.rotation.y = rnd() * 6.28;
      return null;
    }),
  );
  return g;
}

export { caveFormations, mergeGeos, reef, rockGeo, seeded };
