import * as THREE from 'three';
import { game } from '../core/state.js';
import { cv, stripeTex, tex } from '../render/textures.js';
import { CHARS, crowdTx } from './crowd.js';
import { glowSpr, std } from './arenas.js';
import { makeSeaLife, mergeG } from './sealife.js';
import { GY, V3 } from '../core/constants.js';
import { clock2, flyRound, mkBird, mkBursts, rand } from './life.js';
import { sculptGeo } from '../rider/rider.js';
import { dolphinGeo, footballMat, makeSailboat, makeTurtle } from './props.js';

/* ---------- people as sprites (same sheet as the crowd): standing, dancing or lying on towels ---------- */
function spritePeople(g, list) {
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.translate(0, 0.5, 0);
  const uvA = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 2), 2);
  geo.setAttribute('instUv', uvA);
  const mat = new THREE.MeshLambertMaterial({ map: crowdTx, alphaTest: 0.5, side: THREE.DoubleSide });
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <uv_pars_vertex>', '#include <uv_pars_vertex>\nattribute vec2 instUv;')
      .replace(
        '#include <uv_vertex>',
        '#include <uv_vertex>\n#ifdef USE_UV\nvUv = uv*vec2(0.1,0.05) + instUv;\n#endif',
      );
  };
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  mesh.frustumCulled = false;
  g.add(mesh);
  const o = new THREE.Object3D();
  const setUv = (i, v, up) => {
    const col = v % 10,
      row = Math.floor(v / 10) * 2 + (up ? 1 : 0);
    uvA.setXY(i, col / 10, 1 - (row + 1) / 20);
  };
  list.forEach((p, i) => {
    p.v = p.v ?? CHARS[Math.floor(Math.random() * CHARS.length)];
    p.ph = Math.random() * 6.28;
    setUv(i, p.v, false);
  });
  const update = t => {
    list.forEach((p, i) => {
      const s = p.s || 1.2;
      if (p.lie) {
        o.position.set(p.x, p.y ?? 0.07, p.z);
        o.rotation.set(-Math.PI / 2, 0, p.ry || 0);
        o.scale.set(s, s, s);
        if (Math.sin(t * 0.3 + p.ph) > 0.97) {
          o.rotation.z += 0.15;
        }
      } else {
        let y = p.y ?? 0,
          rz = 0;
        if (p.dance) {
          const b = t * (p.bpm || 4.2) + p.ph;
          y += Math.abs(Math.sin(b)) * 0.28;
          rz = Math.sin(b * 0.5) * 0.22;
          setUv(i, p.v, Math.sin(b * 0.5) > 0);
        }
        o.position.set(p.x, y, p.z);
        o.rotation.set(0, 0, 0);
        o.lookAt(p.lx ?? 0, y, p.lz ?? 0);
        o.rotateZ(rz);
        o.scale.set(s, s, s);
      }
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    uvA.needsUpdate = true;
  };
  update(0);
  return { mesh, update };
}
function beachExtras(g) {
  const P = (a, r, y = 0) => new V3(Math.cos(a) * r, y, Math.sin(a) * r),
    M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8 }, o));
  /* --- tiki beach bar in the gap where the stands stop --- */
  const bar = new THREE.Group(),
    BA = Math.PI * 0.5;
  bar.position.copy(P(BA, 20));
  bar.lookAt(0, 0, 0);
  g.add(bar);
  const bamboo = M(0xc9a35a),
    wood = M(0x6b4423),
    straw = M(0xd9b45c, { flatShading: true });
  [
    [-2.1, -1.3],
    [2.1, -1.3],
    [-2.1, 1.3],
    [2.1, 1.3],
  ].forEach(([x, z]) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.9, 8), bamboo);
    p.position.set(x, 1.45, z);
    p.castShadow = true;
    bar.add(p);
  });
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.5, 9, 3), straw);
  roof.position.y = 3.6;
  roof.castShadow = true;
  bar.add(roof);
  {
    const pa = roof.geometry.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      if (pa.getY(i) < -0.7) pa.setY(i, pa.getY(i) - Math.random() * 0.25);
    }
    roof.geometry.computeVertexNormals();
  }
  const fr = new THREE.Mesh(new THREE.CylinderGeometry(3.55, 3.7, 0.45, 36, 1, true), straw);
  fr.position.y = 2.75;
  fr.material.side = THREE.DoubleSide;
  bar.add(fr);
  const ctr = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 1.05, 0.6),
    new THREE.MeshStandardMaterial({ map: stripeTex(28, '#b8913f', '#d8b46a'), roughness: 0.8 }),
  );
  ctr.position.set(0, 0.53, 0.95);
  ctr.castShadow = true;
  bar.add(ctr);
  const top = new THREE.Mesh(new THREE.BoxGeometry(4, 0.09, 0.85), wood);
  top.position.set(0, 1.1, 0.95);
  bar.add(top);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.08, 0.35), wood);
  shelf.position.set(0, 1.75, -1.1);
  bar.add(shelf);
  for (let i = 0; i < 10; i++) {
    const b = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.05, 0.26 + Math.random() * 0.12, 8),
      new THREE.MeshStandardMaterial({
        color: [0x2f8f5a, 0x8a3b1e, 0xd9c26a, 0x3a6fd0, 0xe8e8e8][i % 5],
        roughness: 0.1,
        metalness: 0.2,
        transparent: true,
        opacity: 0.85,
      }),
    );
    b.position.set(-1.4 + i * 0.31, 1.93, -1.1);
    bar.add(b);
  }
  for (let i = 0; i < 4; i++) {
    const st = new THREE.Group();
    st.position.set(-1.5 + i, 0, 1.75);
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.07, 14), M(0xe63946));
    seat.position.y = 0.8;
    st.add(seat);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6), bamboo);
    leg.position.y = 0.4;
    st.add(leg);
    bar.add(st);
  }
  {
    const [c, x] = cv(256, 64);
    x.fillStyle = '#2a160a';
    x.fillRect(0, 0, 256, 64);
    x.font = 'bold 40px sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.shadowColor = '#ff4fa3';
    x.shadowBlur = 12;
    x.fillStyle = '#ffd23f';
    x.fillText('TIKI BAR', 128, 34);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshBasicMaterial({ map: tex(c, true) }));
    sign.position.set(0, 2.45, 1.32);
    bar.add(sign);
  }
  const bulbs = [],
    bc = [0xffd23f, 0xff4fa3, 0x4cc9f0, 0x7cff6b, 0xff7a1a];
  for (const [x0, x1] of [[-2.1, 2.1]])
    for (let k = 0; k <= 12; k++) {
      const t = k / 12,
        s = glowSpr(bc[k % 5], 0.55, 0.95);
      s.position.set(x0 + (x1 - x0) * t, 2.55 - Math.sin(t * Math.PI) * 0.35, 1.35);
      bar.add(s);
      bulbs.push(s);
    }
  [
    [-2.1, 1.3, -5.2, 4.2],
    [2.1, 1.3, 5.2, 4.2],
  ].forEach(([x0, z0, x1, z1]) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.6, 6), bamboo);
    pole.position.set(x1, 1.3, z1);
    bar.add(pole);
    for (let k = 1; k < 10; k++) {
      const t = k / 10,
        s = glowSpr(bc[k % 5], 0.5, 0.95);
      s.position.set(x0 + (x1 - x0) * t, 2.55 - Math.sin(t * Math.PI) * 0.4, z0 + (z1 - z0) * t);
      bar.add(s);
      bulbs.push(s);
    }
  });
  const speak = [-1, 1].map(sx => {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.65, 0.35), M(0x1a1a1a));
    sp.position.set(sx * 2.5, 0.33, 0.6);
    bar.add(sp);
    return sp;
  });
  /* --- people: bartender and dancers in front of the bar (towels are left empty) --- */
  const W = new V3(),
    loc = (x, z) => {
      W.set(x, 0, z);
      return bar.localToWorld(W.clone());
    };
  bar.updateMatrixWorld(true);
  const people = [];
  {
    const b = loc(0, -0.45);
    people.push({ x: b.x, z: b.z, y: 0, s: 1.25, lx: 0, lz: 0 });
  }
  for (let i = 0; i < 12; i++) {
    const p = loc(-3.4 + Math.random() * 6.8, 3 + Math.random() * 3.2);
    people.push({
      x: p.x,
      z: p.z,
      s: 1.15 + Math.random() * 0.2,
      dance: true,
      bpm: 3.6 + Math.random() * 1.4,
      lx: p.x + (Math.random() - 0.5) * 4,
      lz: p.z + (Math.random() - 0.5) * 4,
    });
  }
  const towelCols = [
    ['#ff5d73', '#ffffff'],
    ['#2ec4b6', '#ffd23f'],
    ['#7c3aed', '#ffffff'],
    ['#ff7a1a', '#1d4ed8'],
    ['#22c55e', '#f4f4f4'],
  ];
  const spots = [
    [0.3, 14],
    [0.36, 22],
    [0.42, 16],
    [0.6, 15],
    [0.65, 23],
    [0.71, 17],
    [0.33, 27],
    [0.68, 28],
    [0.5, 26.5],
    [0.56, 30],
  ];
  spots.forEach(([af, r], i) => {
    const a = Math.PI * af,
      p = P(a, r),
      tw = new THREE.Mesh(
        new THREE.BoxGeometry(0.75, 0.02, 1.9),
        new THREE.MeshStandardMaterial({ map: stripeTex(8, ...towelCols[i % 5]), roughness: 0.9 }),
      );
    tw.position.set(p.x, 0.02, p.z);
    tw.rotation.y = -a + (Math.random() - 0.5) * 0.6;
    tw.receiveShadow = true;
    g.add(tw);
    if (i % 3 === 0) {
      const u = new THREE.Group();
      u.position.set(p.x + 0.9, 0, p.z + 0.4);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 6), M(0xeeeeee));
      pole.position.y = 1.1;
      u.add(pole);
      const top = new THREE.Mesh(
        new THREE.ConeGeometry(1.2, 0.5, 10, 1, true),
        new THREE.MeshStandardMaterial({ map: stripeTex(10, towelCols[i % 5][0], '#ffffff'), side: THREE.DoubleSide }),
      );
      top.position.y = 2.2;
      u.add(top);
      u.rotation.z = 0.12;
      g.add(u);
    }
  });
  /* a couple of beach chairs */
  [
    [0.45, 19],
    [0.55, 21],
  ].forEach(([af, r]) => {
    const p = P(Math.PI * af, r),
      c = new THREE.Group();
    c.position.copy(p);
    c.rotation.y = -Math.PI * af;
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.04, 1),
      new THREE.MeshStandardMaterial({ map: stripeTex(6, '#1d4ed8', '#ffffff') }),
    );
    seat.position.y = 0.32;
    c.add(seat);
    const back = seat.clone();
    back.position.set(0, 0.65, -0.6);
    back.rotation.x = -1.0;
    c.add(back);
    g.add(c);
    people.push({ x: p.x, z: p.z, y: 0.25, s: 1.1, lx: p.x * 2, lz: p.z * 2 });
  });
  const crowdS = spritePeople(g, people);
  /* --- dolphins out in the surf --- */
  const dGeo = dolphinGeo();
  const dMat = new THREE.MeshStandardMaterial({
      color: 0x9fb2c4,
      roughness: 0.28,
      metalness: 0.1,
      vertexColors: true,
    }),
    splash = mkBursts(g, 500, 0.35);
  const dol = [0, 1, 2].map(i => {
    const m = new THREE.Mesh(dGeo, dMat);
    m.scale.setScalar(1.6);
    m.visible = false;
    g.add(m);
    return {
      m,
      a: Math.PI * (0.3 + i * 0.2),
      r: 48 + i * 9,
      t: -i * 2.5 - 1,
      dur: 1.5 + Math.random() * 0.4,
      len: 6,
      s0: false,
    };
  });
  /* --- more seabirds out over the water --- */
  const gulls = [...Array(10)].map((_, i) => {
    const b = mkBird(0xf4f4f4, 1.2);
    b.userData = { r: rand(36, 60), h: rand(7, 15), w: rand(0.12, 0.22) * (i % 2 ? 1 : -1), ph: rand(0, 6) };
    g.add(b);
    return b;
  });
  let lastT = null;
  return t => {
    const dt = lastT == null ? 0 : Math.min(0.1, t - lastT);
    lastT = t;
    crowdS.update(t);
    bulbs.forEach((s, i) => {
      s.material.opacity = 0.55 + 0.45 * Math.max(0, Math.sin(t * 3 + i * 0.9));
    });
    speak.forEach(s => (s.scale.y = 1 + Math.max(0, Math.sin(t * 12)) * 0.05));
    gulls.forEach(b => {
      const u = b.userData;
      flyRound(b, t, u.r, u.h + Math.sin(t * 0.4 + u.ph) * 2, u.w, u.ph, 0.8);
      const f = Math.sin(t * 6 + u.ph) * 0.7;
      b.wings[0].rotation.z = f;
      b.wings[1].rotation.z = -f;
    });
    dol.forEach(d => {
      d.t += dt;
      const T = d.t;
      if (T < 0) {
        d.m.visible = false;
        return;
      }
      const s = T / d.dur;
      if (s > 1) {
        d.t = -(2 + Math.random() * 4);
        d.a += (Math.random() - 0.5) * 0.6;
        d.m.visible = false;
        splash.burst(d.ex.x, 0.1, d.ex.z, 0xe8f8ff, 40, 4, { up: 1, gr: 6, fade: 0.9 });
        return;
      }
      const dir = new V3(-Math.sin(d.a), 0, Math.cos(d.a)),
        c = P(d.a, d.r),
        p = c.clone().addScaledVector(dir, (s - 0.5) * d.len);
      p.y = -0.2 + 2.4 * Math.sin(Math.PI * s);
      d.m.visible = true;
      d.m.position.copy(p);
      const vy = (2.4 * Math.PI * Math.cos(Math.PI * s)) / d.len;
      d.m.lookAt(
        p
          .clone()
          .add(dir)
          .add(new V3(0, vy, 0)),
      );
      if (!d.s0 && s < 0.1) {
        splash.burst(p.x, 0.1, p.z, 0xe8f8ff, 30, 3, { up: 1, gr: 6, fade: 0.9 });
        d.s0 = true;
      }
      if (s > 0.9) d.s0 = false;
      d.ex = p;
    });
    splash.tick(dt);
  };
}
const LIFE = {
  bigtop(g) {
    const dtf = clock2(),
      fx = mkBursts(g, 700, 0.3),
      rope = std(0xd8c9a8),
      bar = std(0xd4a017, { metalness: 0.8, roughness: 0.3 });
    const traps = [-1, 1].map((sx, i) => {
      const piv = new THREE.Group();
      piv.position.set(sx * 7, 25, i ? 3 : -3);
      [-0.6, 0.6].forEach(dx => {
        const r = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 9, 4), rope);
        r.position.set(dx, -4.5, 0);
        piv.add(r);
      });
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 8), bar);
      b.rotation.z = Math.PI / 2;
      b.position.y = -9;
      piv.add(b);
      const suit = std(i ? 0xff4fa3 : 0x2ec4b6, { roughness: 0.4, metalness: 0.3 }),
        skin = std(0xf1c7a1);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 1.3, 10), suit);
      body.position.y = -9.85;
      piv.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), skin);
      head.position.y = -10.65;
      piv.add(head);
      [-0.25, 0.25].forEach(dx => {
        const a = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 6), suit);
        a.position.set(dx, -9.3, 0);
        piv.add(a);
      });
      g.add(piv);
      return piv;
    });
    const bcols = [0xe63946, 0xffd23f, 0x2ec4b6, 0x7c3aed, 0xff7a1a, 0xff4fa3, 0x22c55e],
      balloons = [];
    const strM = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
    for (let i = 0; i < 26; i++) {
      const col = bcols[i % bcols.length],
        m = new THREE.Group(),
        ball = new THREE.Mesh(
          new THREE.SphereGeometry(0.24, 14, 12),
          new THREE.MeshStandardMaterial({
            color: col,
            roughness: 0.25,
            metalness: 0,
            emissive: col,
            emissiveIntensity: 0.45,
          }),
        );
      ball.scale.y = 1.2;
      m.add(ball);
      const knot = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.08, 6), ball.material);
      knot.position.y = -0.31;
      knot.rotation.x = Math.PI;
      m.add(knot);
      const str = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 1.3, 3), strM);
      str.position.y = -1;
      m.add(str);
      const a = rand(0, 6.28),
        r = rand(14, 26);
      m.userData = { a, r, y: rand(3, 28), v: rand(0.5, 1.1), ph: rand(0, 6) };
      g.add(m);
      balloons.push(m);
    }
    let conf = 0;
    return t => {
      const dt = dtf(t);
      traps.forEach((p, i) => {
        p.rotation.z = Math.sin(t * 1.25 + i * Math.PI) * 0.75;
      });
      balloons.forEach(b => {
        const u = b.userData;
        u.y += u.v * dt;
        if (u.y > 30) {
          u.y = 3;
          u.a = rand(0, 6.28);
        }
        b.position.set(Math.cos(u.a) * u.r + Math.sin(t + u.ph) * 0.4, u.y, Math.sin(u.a) * u.r);
        b.rotation.z = Math.sin(t * 1.3 + u.ph) * 0.12;
      });
      conf -= dt;
      if (game.cheer > 0.9 && conf <= 0) {
        conf = 1.2;
        const a = rand(0, 6.28);
        fx.burst(Math.cos(a) * 14, rand(12, 20), Math.sin(a) * 14, bcols, 90, 7, { gr: 1.2, fade: 0.35 });
      }
      fx.tick(dt);
    };
  },

  beach(g) {
    const dtf = clock2(),
      sea = g.userData.sea,
      extra = beachExtras(g);
    const geo = new THREE.RingGeometry(34, 125, 140, 34);
    geo.rotateX(-Math.PI / 2);
    const P = geo.attributes.position,
      n = P.count,
      base = new Float32Array(P.array),
      cols = new Float32Array(n * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const wav = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0 }),
    );
    wav.position.y = -0.06;
    wav.receiveShadow = true;
    g.add(wav);
    const deep = new THREE.Color(0x1673a3),
      shal = new THREE.Color(0x3fc1d6),
      foam = new THREE.Color(0xf4fbff),
      tc = new THREE.Color();
    let nf = 0;
    const gulls = [...Array(9)].map((_, i) => {
      const b = mkBird(0xf4f4f4, 1.1);
      b.userData = { r: rand(16, 32), h: rand(9, 17), w: rand(0.18, 0.32) * (i % 2 ? 1 : -1), ph: rand(0, 6) };
      g.add(b);
      return b;
    });
    const boat = makeSailboat();
    boat.scale.setScalar(1.15);
    g.add(boat);
    const ballT = stripeTex(6, '#ff5d73', '#ffffff'),
      balls = [...Array(3)].map((_, i) => {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(0.45, 16, 12),
          new THREE.MeshStandardMaterial({ map: ballT, roughness: 0.4 }),
        );
        m.userData = { a: Math.PI * (0.95 + i * 0.4), ph: i * 2.1 };
        g.add(m);
        return m;
      });
    return t => {
      const dt = dtf(t);
      extra(t);
      if ((nf++ & 1) === 0) {
        for (let i = 0; i < n; i++) {
          const x = base[i * 3],
            z = base[i * 3 + 2],
            r = Math.hypot(x, z),
            a = Math.atan2(z, x),
            near = Math.min(1, (r - 34) / 14);
          const ph = r * 0.42 + t * 1.7 + Math.sin(a * 3 + t * 0.2) * 0.8,
            sw = Math.sin(ph),
            h =
              (sw * 0.32 * near + Math.sin(r * 1.1 - t * 2.4 + a * 7) * 0.06 + Math.sin(a * 11 + t) * 0.03) *
              (r < 90 ? 1 : 0.6);
          P.array[i * 3 + 1] = h;
          const crest = Math.max(0, (sw - 0.72) / 0.28) * (r < 70 ? 1 : 0.35),
            shore = Math.max(0, 1 - (r - 34) / 2.2) * (0.7 + 0.3 * Math.sin(t * 1.7 + a * 9));
          tc.copy(deep).lerp(shal, Math.max(0, 1 - (r - 34) / 22));
          tc.lerp(foam, Math.min(1, crest * 0.9 + shore));
          cols[i * 3] = tc.r;
          cols[i * 3 + 1] = tc.g;
          cols[i * 3 + 2] = tc.b;
        }
        P.needsUpdate = true;
        geo.attributes.color.needsUpdate = true;
        geo.computeVertexNormals();
      }
      gulls.forEach(b => {
        const u = b.userData;
        flyRound(b, t, u.r, u.h, u.w, u.ph, 0.8);
        const f = Math.sin(t * 7 + u.ph) * 0.7;
        b.wings[0].rotation.z = f;
        b.wings[1].rotation.z = -f;
      });
      {
        const a = t * 0.012 + 1.2;
        boat.position.set(Math.cos(a) * 78, Math.sin(t * 1.1) * 0.25, Math.sin(a) * 78);
        boat.rotation.y = -a;
        boat.rotation.z = Math.sin(t * 0.9) * 0.08;
      }
      balls.forEach(m => {
        const u = m.userData,
          a = u.a + Math.sin(t * 0.15 + u.ph) * 0.5,
          r = 15.5;
        m.position.set(Math.cos(a) * r, 3.6 + Math.abs(Math.sin(t * 2.2 + u.ph)) * 2.6, Math.sin(a) * r);
        m.rotation.x += dt * 3;
        m.rotation.y += dt * 2;
      });
    };
  },

  stadium(g) {
    const dtf = clock2(),
      fx = mkBursts(g, 1400, 0.55);
    let next = 1.5;
    const fcols = [0xff3b5c, 0xffd23f, 0x4cc9f0, 0x7cff6b, 0xff7af6, 0xffffff];
    const blimp = new THREE.Group();
    {
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(1, 24, 16),
        new THREE.MeshStandardMaterial({ map: stripeTex(8, '#e9e9ee', '#1d4ed8'), roughness: 0.4 }),
      );
      body.scale.set(1.4, 1.4, 5);
      blimp.add(body);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 1.2), std(0x1d4ed8));
      fin.position.z = -4.6;
      blimp.add(fin);
      const fin2 = fin.clone();
      fin2.rotation.z = Math.PI / 2;
      blimp.add(fin2);
      const gond = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 1.4), std(0x333));
      gond.position.y = -1.5;
      blimp.add(gond);
      const lt = glowSpr(0xff2030, 2);
      lt.position.y = -1.8;
      blimp.add(lt);
      blimp.userData.lt = lt;
    }
    g.add(blimp);
    const flashes = [...Array(26)].map(() => {
      const s = glowSpr(0xffffff, 1.6, 0);
      const a = rand(0, 6.28),
        r = rand(20, 33);
      s.position.set(Math.cos(a) * r, rand(2, 11), Math.sin(a) * r);
      g.add(s);
      return s;
    });
    const flagM = [0xe63946, 0xffd23f, 0x1d4ed8, 0x22c55e].map(
        c => new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide }),
      ),
      flags = [];
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * 6.28,
        p = new THREE.Group();
      p.position.set(Math.cos(a) * 36, 14.5, Math.sin(a) * 36);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 5), std(0xcccccc));
      pole.position.y = 1.5;
      p.add(pole);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1, 6, 1), flagM[i % 4]);
      f.position.set(0.9, 2.4, 0);
      p.add(f);
      p.userData.f = f;
      p.rotation.y = -a;
      g.add(p);
      flags.push(p);
    }
    const fbGeo = new THREE.SphereGeometry(0.42, 32, 24),
      fbMat = footballMat();
    const balls = [...Array(4)].map((_, i) => {
      const m = new THREE.Mesh(fbGeo, fbMat);
      m.userData = { a: i * 1.6, ph: i * 1.7 };
      g.add(m);
      return m;
    });
    return t => {
      const dt = dtf(t);
      balls.forEach(m => {
        const u = m.userData,
          a = u.a + Math.sin(t * 0.12 + u.ph) * 0.6,
          r = 21;
        m.position.set(Math.cos(a) * r, 5 + Math.abs(Math.sin(t * 2 + u.ph)) * 3.2, Math.sin(a) * r);
        m.rotation.x += dt * 3;
        m.rotation.z += dt * 2;
      });
      next -= dt * (1 + game.cheer * 2);
      if (next <= 0) {
        next = rand(1.2, 3);
        const a = rand(0, 6.28),
          r = rand(18, 34);
        fx.burst(
          Math.cos(a) * r,
          rand(22, 32),
          Math.sin(a) * r,
          fcols[Math.floor(Math.random() * fcols.length)],
          110,
          9,
          { gr: 3, fade: 0.55 },
        );
      }
      fx.tick(dt);
      {
        const a = t * 0.05;
        blimp.position.set(Math.cos(a) * 48, 30 + Math.sin(t * 0.3), Math.sin(a) * 48);
        blimp.lookAt(Math.cos(a + 0.05) * 48, 30, Math.sin(a + 0.05) * 48);
        blimp.userData.lt.material.opacity = Math.sin(t * 4) > 0.3 ? 1 : 0.15;
      }
      flashes.forEach(s => {
        const m = s.material;
        m.opacity = Math.max(0, m.opacity - dt * 6);
        if (Math.random() < dt * (0.15 + game.cheer * 1.8)) m.opacity = 1;
      });
      flags.forEach((p, i) => {
        p.userData.f.rotation.y = Math.sin(t * 3 + i) * 0.35;
      });
    };
  },

  crane(g) {
    const dtf = clock2(),
      fx = mkBursts(g, 600, 0.9);
    let next = 4;
    const heli = new THREE.Group();
    {
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.8, 14, 10),
        std(0x22252b, { metalness: 0.5, roughness: 0.4 }),
      );
      body.scale.set(1, 1, 1.6);
      heli.add(body);
      // long tapered tail boom with a fin and a spinning tail rotor
      const hm = std(0x22252b);
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.26, 4.6, 8), hm);
      tail.rotation.x = Math.PI / 2;
      tail.position.set(0, 0.15, -3.4);
      heli.add(tail);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.1, 0.55), hm);
      fin.position.set(0, 0.6, -5.5);
      fin.rotation.x = -0.35;
      heli.add(fin);
      const stab = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 0.35), hm);
      stab.position.set(0, 0.2, -5.2);
      heli.add(stab);
      const trotor = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.3, 0.12), std(0x111));
      trotor.position.set(0.12, 0.55, -5.7);
      heli.add(trotor);
      heli.userData.trotor = trotor;
      const rotor = new THREE.Mesh(new THREE.BoxGeometry(5, 0.04, 0.18), std(0x111));
      rotor.position.y = 0.9;
      heli.add(rotor);
      heli.userData.rotor = rotor;
      const beam = new THREE.Mesh(
        new THREE.ConeGeometry(2.6, 14, 16, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0xfff2c0,
          transparent: true,
          opacity: 0.09,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      beam.geometry.translate(0, -7, 0);
      heli.add(beam);
      heli.userData.beam = beam;
      const red = glowSpr(0xff2030, 1.2);
      red.position.set(0, 1.1, -5.7);
      heli.add(red);
      heli.userData.red = red;
    }
    g.add(heli);
    const planes = [0, 1].map(i => {
      const p = new THREE.Group();
      const w = glowSpr(0xffffff, 2.2),
        r = glowSpr(0xff3030, 1.6),
        gr = glowSpr(0x30ff60, 1.6);
      r.position.x = -1.5;
      gr.position.x = 1.5;
      p.add(w, r, gr);
      p.userData = { w, ph: i * 40 };
      g.add(p);
      return p;
    });
    const NC = 180,
      cars = new THREE.InstancedMesh(
        new THREE.BoxGeometry(1.2, 0.6, 2.4),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
        NC,
      ),
      cd = [],
      o = new THREE.Object3D(),
      tc = new THREE.Color();
    for (let i = 0; i < NC; i++) {
      const road = i % 6,
        dir = i % 2 ? 1 : -1;
      cd.push({ road, dir, u: rand(-150, 150), v: rand(6, 14) });
      cars.setColorAt(i, tc.setHex(dir > 0 ? 0xfff1c0 : 0xff3b3b));
    }
    g.add(cars);
    const birds = [...Array(8)].map((_, i) => {
      const b = mkBird(0x222222, 0.8);
      b.userData = { r: rand(12, 20), h: rand(2, 9), w: 0.35 * (i % 2 ? 1 : -1), ph: i * 0.8 };
      g.add(b);
      return b;
    });
    return t => {
      const dt = dtf(t);
      {
        const a = t * 0.16;
        heli.position.set(Math.cos(a) * 30, 6 + Math.sin(t * 0.5) * 2, Math.sin(a) * 30);
        heli.lookAt(Math.cos(a + 0.1) * 30, heli.position.y, Math.sin(a + 0.1) * 30);
        heli.userData.rotor.rotation.y += dt * 40;
        heli.userData.trotor.rotation.x += dt * 60;
        const bm = heli.userData.beam;
        bm.lookAt(0, GY, 0);
        bm.rotateX(-Math.PI / 2);
        heli.userData.red.material.opacity = Math.sin(t * 5) > 0 ? 1 : 0.1;
      }
      planes.forEach((p, i) => {
        const u = ((t * 9 + p.userData.ph * 7) % 400) - 200;
        p.position.set(u, 55 + i * 12, i ? -90 : 80);
        p.userData.w.material.opacity = Math.sin(t * 6 + i) > 0.6 ? 1 : 0.2;
      });
      for (let i = 0; i < NC; i++) {
        const c = cd[i];
        c.u += c.v * c.dir * dt;
        if (c.u > 160) c.u = -160;
        if (c.u < -160) c.u = 160;
        const lane = (c.road - 2.5) * 45 + c.dir * 1.6;
        if (c.road < 3) o.position.set(c.u, -72.6, lane);
        else o.position.set(lane, -72.6, c.u);
        o.rotation.set(0, c.road < 3 ? Math.PI / 2 : 0, 0);
        o.updateMatrix();
        cars.setMatrixAt(i, o.matrix);
      }
      cars.instanceMatrix.needsUpdate = true;
      birds.forEach(b => {
        const u = b.userData;
        flyRound(b, t, u.r, u.h, u.w, u.ph, 0.5);
        const f = Math.sin(t * 9 + u.ph) * 0.7;
        u.w0 = f;
        b.wings[0].rotation.z = f;
        b.wings[1].rotation.z = -f;
      });
      next -= dt;
      if (next <= 0) {
        next = rand(3, 7);
        const a = rand(0, 6.28);
        fx.burst(
          Math.cos(a) * 120,
          rand(-10, 15),
          Math.sin(a) * 120,
          [0xff4fa3, 0xffd23f, 0x4cc9f0][Math.floor(rand(0, 3))],
          90,
          14,
          { gr: 3, fade: 0.5 },
        );
      }
      fx.tick(dt);
    };
  },

  moon(g) {
    const dtf = clock2(),
      smoke = mkBursts(g, 900, 0.7);
    const band = cols => {
      const [c, x] = cv(256, 128);
      cols.forEach((cl, i) => {
        x.fillStyle = cl;
        x.fillRect(0, (i * 128) / cols.length, 256, 128 / cols.length + 1);
      });
      for (let i = 0; i < 60; i++) {
        x.fillStyle = 'rgba(255,255,255,.06)';
        x.fillRect(0, Math.random() * 128, 256, 1 + Math.random() * 3);
      }
      return tex(c, true);
    };
    const giant = new THREE.Mesh(
      new THREE.SphereGeometry(16, 40, 30),
      new THREE.MeshLambertMaterial({
        map: band(['#c9a46a', '#e8cf9a', '#b07a48', '#f0dcb0', '#a56b3d', '#d9b47c', '#8f5a32']),
        fog: false,
      }),
    );
    giant.position.set(70, 62, -110);
    g.add(giant);
    const [rc, rx] = cv(256, 8);
    const rg = rx.createLinearGradient(0, 0, 256, 0);
    rg.addColorStop(0, 'rgba(230,210,170,0)');
    rg.addColorStop(0.2, 'rgba(230,210,170,.8)');
    rg.addColorStop(0.5, 'rgba(190,160,120,.35)');
    rg.addColorStop(0.7, 'rgba(240,220,180,.75)');
    rg.addColorStop(1, 'rgba(230,210,170,0)');
    rx.fillStyle = rg;
    rx.fillRect(0, 0, 256, 8);
    const ringGeo = new THREE.RingGeometry(20, 34, 96, 1),
      uv = ringGeo.attributes.uv,
      pp = ringGeo.attributes.position;
    for (let i = 0; i < uv.count; i++) {
      const r = Math.hypot(pp.getX(i), pp.getY(i));
      uv.setXY(i, (r - 20) / 14, 0.5);
    }
    const ring = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        map: tex(rc, true),
        transparent: true,
        side: THREE.DoubleSide,
        fog: false,
        depthWrite: false,
      }),
    );
    ring.position.copy(giant.position);
    ring.rotation.set(1.2, 0.3, 0.2);
    g.add(ring);
    const mars = new THREE.Mesh(
      new THREE.SphereGeometry(5, 28, 20),
      new THREE.MeshLambertMaterial({ map: band(['#b5462a', '#cf6a3e', '#a13c22', '#d97a4a', '#8f321c']), fog: false }),
    );
    mars.position.set(-80, 34, 50);
    g.add(mars);
    const icy = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 20, 16),
      new THREE.MeshLambertMaterial({ color: 0xbfe6ff, fog: false }),
    );
    g.add(icy);
    const mkRocket = () => {
      const r = new THREE.Group(),
        white = std(0xf2f2f2, { metalness: 0.3, roughness: 0.35 }),
        red = std(0xe63946);
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 4, 14), white);
      b.position.y = 2;
      r.add(b);
      const n = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.4, 14), red);
      n.position.y = 4.7;
      r.add(n);
      for (let k = 0; k < 4; k++) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.2, 0.9), red);
        f.position.set(Math.cos(k * 1.57) * 0.6, 0.5, Math.sin(k * 1.57) * 0.6);
        f.rotation.y = -k * 1.57;
        r.add(f);
      }
      const fl = glowSpr(0xffa040, 3.5, 0);
      fl.position.y = -0.4;
      r.add(fl);
      r.userData.fl = fl;
      return r;
    };
    const pads = [0, 1, 2].map(i => {
      const a = (i / 3) * 6.28 + 0.5,
        pad = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 0.4, 16), std(0x666a72));
      pad.position.set(Math.cos(a) * 34, 0.2, Math.sin(a) * 34);
      g.add(pad);
      const r = mkRocket();
      r.position.copy(pad.position);
      r.position.y = 0.4;
      g.add(r);
      return { r, x: pad.position.x, z: pad.position.z, clock: -i * 7 - 3, v: 0 };
    });
    const ufo = new THREE.Group();
    {
      const d = new THREE.Mesh(new THREE.SphereGeometry(2, 24, 10), std(0xb8c0cc, { metalness: 0.9, roughness: 0.25 }));
      d.scale.y = 0.28;
      ufo.add(d);
      const cup = new THREE.Mesh(
        new THREE.SphereGeometry(0.9, 16, 10, 0, 6.28, 0, 1.6),
        new THREE.MeshStandardMaterial({
          color: 0x7fffd4,
          transparent: true,
          opacity: 0.6,
          emissive: 0x2aa,
          emissiveIntensity: 0.6,
        }),
      );
      cup.position.y = 0.3;
      ufo.add(cup);
      const lights = [];
      for (let k = 0; k < 10; k++) {
        const s = glowSpr([0xff4fa3, 0x4cc9f0, 0xffd23f][k % 3], 0.8);
        s.position.set(Math.cos(k * 0.628) * 1.9, -0.1, Math.sin(k * 0.628) * 1.9);
        ufo.add(s);
        lights.push(s);
      }
      ufo.userData.lights = lights;
      const beam = new THREE.Mesh(
        new THREE.ConeGeometry(2.4, 9, 20, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0x7fffd4,
          transparent: true,
          opacity: 0.1,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      beam.position.y = -4.6;
      ufo.add(beam);
      ufo.userData.beam = beam;
    }
    g.add(ufo);
    const sat = new THREE.Group();
    {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 1.2), std(0xd4a017, { metalness: 0.8, roughness: 0.3 }));
      sat.add(b);
      const pm = std(0x1d3fa8, { metalness: 0.6, roughness: 0.3 });
      [-1, 1].forEach(s => {
        const p = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.05, 1), pm);
        p.position.x = s * 1.8;
        sat.add(p);
      });
    }
    g.add(sat);
    const star = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.25, 14, 6),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        fog: false,
        depthWrite: false,
      }),
    );
    g.add(star);
    let sT = -1,
      sNext = 3;
    const sA = new V3(),
      sB = new V3();
    return t => {
      const dt = dtf(t);
      giant.rotation.y = t * 0.02;
      mars.rotation.y = t * 0.05;
      ring.rotation.z = 0.2 + t * 0.003;
      {
        const a = t * 0.07;
        icy.position.set(70 + Math.cos(a) * 32, 62 + Math.sin(a) * 8, -110 + Math.sin(a) * 32);
      }
      pads.forEach(p => {
        p.clock += dt;
        const r = p.r,
          fl = r.userData.fl;
        if (p.clock < 0) {
          r.position.set(p.x, 0.4, p.z);
          fl.material.opacity = 0;
        } else if (p.clock < 1.6) {
          r.position.set(p.x + Math.sin(t * 60) * 0.03, 0.4, p.z);
          fl.material.opacity = 0.6 + Math.random() * 0.4;
          if (Math.random() < 0.5) smoke.burst(p.x, 0.6, p.z, 0x8a8a92, 3, 3, { up: 0.3, gr: -0.3, fade: 0.5 });
        } else {
          p.v += dt * (6 + p.v * 0.6);
          r.position.y += p.v * dt;
          fl.material.opacity = 0.8 + Math.random() * 0.2;
          fl.scale.setScalar(3.5 + Math.random());
          if (Math.random() < 0.8) smoke.burst(p.x, r.position.y - 0.6, p.z, 0xa0a0aa, 2, 1.5, { gr: 0, fade: 0.35 });
          if (r.position.y > 160) {
            p.clock = -rand(8, 16);
            p.v = 0;
          }
        }
      });
      smoke.tick(dt);
      {
        const a = -t * 0.22;
        ufo.position.set(Math.cos(a) * 22, 13 + Math.sin(t * 1.3) * 1.2, Math.sin(a) * 22);
        ufo.rotation.y = t * 1.5;
        ufo.rotation.z = Math.sin(t * 0.9) * 0.12;
        ufo.userData.lights.forEach((s, k) => (s.material.opacity = Math.sin(t * 8 - k) > 0 ? 1 : 0.25));
        ufo.userData.beam.material.opacity = 0.06 + 0.06 * Math.sin(t * 3);
      }
      {
        const a = t * 0.09;
        sat.position.set(Math.cos(a) * 50, 40 + Math.sin(a * 2) * 6, Math.sin(a) * 50);
        sat.rotation.y = t * 0.4;
        sat.rotation.x = t * 0.25;
      }
      sNext -= dt;
      if (sNext <= 0 && sT < 0) {
        sT = 0;
        sNext = rand(3, 8);
        const a = rand(0, 6.28);
        sA.set(Math.cos(a) * 90, rand(40, 70), Math.sin(a) * 90);
        sB.set(Math.cos(a + 1.2) * 90, sA.y - rand(15, 30), Math.sin(a + 1.2) * 90);
      }
      if (sT >= 0) {
        sT += dt / 1.1;
        const m = star.material;
        m.opacity = Math.sin(Math.min(1, sT) * Math.PI);
        star.position.lerpVectors(sA, sB, sT);
        star.lookAt(sB);
        star.rotateX(Math.PI / 2);
        if (sT >= 1) {
          sT = -1;
          m.opacity = 0;
        }
      }
    };
  },

  under(g) {
    const dtf = clock2(),
      bub = mkBursts(g, 500, 0.22),
      seaLife = makeSeaLife(g);
    const jellyM = c =>
      new THREE.MeshBasicMaterial({
        color: c,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
    const jel = [...Array(16)].map((_, i) => {
      const j = new THREE.Group(),
        m = jellyM([0xff7af6, 0x7fdbff, 0xb38cff][i % 3]);
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 10, 0, 6.28, 0, 1.5), m);
      j.add(d);
      for (let k = 0; k < 6; k++) {
        const tt = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.01, rand(1.5, 2.6), 4), m);
        tt.position.set(Math.cos(k) * 0.4, -1.1, Math.sin(k) * 0.4);
        j.add(tt);
      }
      const gl = glowSpr([0xff7af6, 0x7fdbff, 0xb38cff][i % 3], 2.2, 0.5);
      j.add(gl);
      const a = rand(0, 6.28),
        r = rand(7, 30);
      j.userData = { x: Math.cos(a) * r, z: Math.sin(a) * r, y: rand(3, 24), ph: rand(0, 6), d: d };
      g.add(j);
      return j;
    });
    const manta = new THREE.Group();
    {
      const sg = new THREE.BufferGeometry();
      sg.setAttribute(
        'position',
        new THREE.BufferAttribute(
          new Float32Array([0, 0, 2.2, -4, 0, -0.6, 0, 0, -1.4, 0, 0, 2.2, 0, 0, -1.4, 4, 0, -0.6]),
          3,
        ),
      );
      sg.computeVertexNormals();
      const m = new THREE.Mesh(
        sg,
        new THREE.MeshStandardMaterial({ color: 0x1d2a3a, side: THREE.DoubleSide, roughness: 0.6 }),
      );
      manta.add(m);
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 3.5, 4), std(0x1d2a3a));
      tail.rotation.x = Math.PI / 2;
      tail.position.z = -3;
      manta.add(tail);
      manta.userData.m = m;
    }
    manta.scale.setScalar(1.6);
    g.add(manta);
    const turtle = makeTurtle();
    g.add(turtle);
    let bn = 0;
    return t => {
      const dt = dtf(t);
      jel.forEach(j => {
        const u = j.userData,
          p = Math.sin(t * 1.6 + u.ph);
        j.position.set(u.x + Math.sin(t * 0.2 + u.ph) * 1.5, u.y + Math.sin(t * 0.4 + u.ph) * 1.2 + p * 0.2, u.z);
        u.d.scale.set(1 + p * 0.12, 1 - p * 0.18, 1 + p * 0.12);
      });
      {
        const a = t * 0.06;
        manta.position.set(Math.cos(a) * 40, 20 + Math.sin(t * 0.3) * 3, Math.sin(a) * 40);
        manta.lookAt(Math.cos(a + 0.05) * 40, manta.position.y, Math.sin(a + 0.05) * 40);
        manta.rotation.z = Math.sin(t * 1.2) * 0.2;
        const pa = manta.userData.m.geometry.attributes.position,
          fl = Math.sin(t * 1.8) * 0.9;
        pa.setY(1, fl);
        pa.setY(5, fl);
        pa.needsUpdate = true;
      }
      {
        const a = -t * 0.1;
        turtle.position.set(Math.cos(a) * 14, 7 + Math.sin(t * 0.5) * 1.5, Math.sin(a) * 14);
        turtle.lookAt(Math.cos(a - 0.05) * 14, turtle.position.y, Math.sin(a - 0.05) * 14);
        turtle.userData.swim(t);
      }
      seaLife(t);
      bn -= dt;
      if (bn <= 0) {
        bn = rand(0.05, 0.3);
        const a = rand(0, 6.28),
          r = rand(4, 20);
        bub.burst(Math.cos(a) * r, rand(0, 4), Math.sin(a) * r, 0xbff4ff, 3, 0.5, { gr: -3.5, fade: 0.18 });
      }
      bub.tick(dt);
    };
  },
};

export { LIFE };
