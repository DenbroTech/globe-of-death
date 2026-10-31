import * as THREE from 'three';
import { makePalm } from './props.js';
import { scene } from '../render/renderer.js';
import { cv, glowTex, stripeTex, tex } from '../render/textures.js';
import { bigtop } from './stage.js';
import { V3 } from '../core/constants.js';

let sun, sky, turntable, ringGlow;

function grad(stops) {
  const [c, x] = cv(4, 256);
  const g = x.createLinearGradient(0, 0, 0, 256);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  x.fillStyle = g;
  x.fillRect(0, 0, 4, 256);
  return tex(c, true);
}
function noiseTex(base, specks, size = 512, rep = 1) {
  const [c, x] = cv(size, size);
  x.fillStyle = base;
  x.fillRect(0, 0, size, size);
  for (let i = 0; i < (size * size) / 12; i++) {
    const s = specks[i % specks.length];
    x.fillStyle = s;
    x.globalAlpha = Math.random() * 0.5;
    x.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  x.globalAlpha = 1;
  const t = tex(c, true);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep, rep);
  return t;
}
const glowSpr = (hex, sc, op = 1) => {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: hex,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: op,
    }),
  );
  s.scale.setScalar(sc);
  return s;
};
const std = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85 }, o));
const ARENAS = {
  bigtop: {
    name: 'Big Top',
    songs: [0, 5],
    kit: { lead: 'organ', stab: 'organ', hit: 'organ', jump: 'slide' },
    blurb: 'Sawdust, stripes and spotlights.',
    env: {
      bg: 0x07060a,
      fog: [0x07060a, 22, 55],
      sky: null,
      hemi: [0x6e5c80, 0x140c08, 0.45],
      sun: 0,
      spots: 1,
      beams: 1,
      exp: 1.15,
    },
    crowd: { tiers: 7, r0: 15, dr: 1.3, y0: 0.55, dy: 0.85, gap: 0.62, stepCol: 0x22160f },
    build() {
      return bigtop;
    },
  },
  beach: {
    name: 'Beach',
    songs: [6, 7, 1],
    kit: { lead: 'pan', stab: 'pan', hit: 'pan', jump: 'pan' },
    blurb: 'Sunset, palm trees and the surf behind you.',
    env: {
      bg: 0xf6c9a0,
      fog: [0xf3c7a3, 40, 120],
      sky: [
        [0, '#2b5fa8'],
        [0.45, '#7fb2e5'],
        [0.75, '#ffc9a0'],
        [1, '#ff9a6b'],
      ],
      hemi: [0xbfe3ff, 0xb89a70, 0.6],
      sun: 1.0,
      sunPos: [-40, 22, -50],
      sunCol: 0xffc890,
      spots: 0.25,
      beams: 0,
      exp: 0.82,
    },
    crowdGlow: 0.4,
    crowd: {
      tiers: 5,
      r0: 12,
      dr: 1.25,
      y0: 0.4,
      dy: 0.55,
      gap: 0.62,
      stepCol: 0x8a5a34,
      arc: Math.PI * 1.45,
      a0: Math.PI * 0.78,
    },
    build() {
      const g = new THREE.Group();
      const sand = new THREE.Mesh(
        new THREE.CircleGeometry(34, 64),
        std(0xd8c09a, { map: noiseTex('#e8cf9e', ['#c9a86f', '#fff3d6', '#b89262'], 512, 4) }),
      );
      sand.rotation.x = -Math.PI / 2;
      sand.receiveShadow = true;
      g.add(sand);
      const sea = new THREE.Mesh(
        new THREE.CircleGeometry(160, 48),
        new THREE.MeshStandardMaterial({ color: 0x1d7fb0, roughness: 0.35, metalness: 0 }),
      );
      sea.rotation.x = -Math.PI / 2;
      sea.position.y = -0.08;
      g.add(sea);
      g.userData.sea = sea;
      const foam = new THREE.Mesh(
        new THREE.RingGeometry(33.4, 35, 64),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }),
      );
      foam.visible = false;
      for (let i = 0; i < 10; i++) {
        const a = Math.PI * 0.85 + (i / 9) * Math.PI * 1.3,
          r = 21 + Math.random() * 7,
          p = makePalm(6 + Math.random() * 3);
        p.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        p.rotation.y = Math.random() * 6;
        g.add(p);
      }
      const cols = ['#ff5d73', '#ffd23f', '#2ec4b6', '#ffffff'];
      for (let i = 0; i < 6; i++) {
        const a = Math.PI * 0.95 + (i / 5) * Math.PI * 1.1,
          r = 10.5,
          u = new THREE.Group();
        u.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), std(0xeeeeee));
        pole.position.y = 1.2;
        u.add(pole);
        const top = new THREE.Mesh(
          new THREE.ConeGeometry(1.3, 0.6, 10, 1, true),
          new THREE.MeshStandardMaterial({ map: stripeTex(10, cols[i % 4], '#ffffff'), side: THREE.DoubleSide }),
        );
        top.position.y = 2.4;
        u.add(top);
        g.add(u);
      }
      const sunS = glowSpr(0xffb070, 26, 0.9);
      sunS.position.set(-55, 9, -70);
      sunS.material.fog = false;
      g.add(sunS);
      return g;
    },
  },
  stadium: {
    name: 'Stadium',
    songs: [2, 4],
    kit: { lead: 'brass', stab: 'brass', hit: 'brass', jump: 'horn' },
    blurb: 'Floodlights and a full house.',
    env: {
      bg: 0x060914,
      fog: [0x060914, 45, 140],
      sky: [
        [0, '#02040c'],
        [0.6, '#0b1430'],
        [1, '#1d2a55'],
      ],
      hemi: [0x8090c0, 0x1a3a1a, 0.5],
      sun: 0,
      spots: 1,
      spotCol: 0xffffff,
      beams: 1,
      exp: 1,
    },
    crowd: { tiers: 11, r0: 19, dr: 1.45, y0: 0.9, dy: 1.05, gap: 0.68, stepCol: 0x3a3d46 },
    build() {
      const g = new THREE.Group();
      const [c, x] = cv(512, 512);
      for (let i = 0; i < 16; i++) {
        x.fillStyle = i % 2 ? '#2f7d32' : '#3a8f3c';
        x.fillRect(0, i * 32, 512, 32);
      }
      x.strokeStyle = 'rgba(255,255,255,.85)';
      x.lineWidth = 4;
      x.strokeRect(40, 20, 432, 472);
      x.beginPath();
      x.moveTo(40, 256);
      x.lineTo(472, 256);
      x.stroke();
      x.beginPath();
      x.arc(256, 256, 60, 0, 7);
      x.stroke();
      x.strokeRect(156, 20, 200, 70);
      x.strokeRect(156, 422, 200, 70);
      const pitch = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), std(0xb8c8b8, { map: tex(c, true) }));
      pitch.rotation.x = -Math.PI / 2;
      pitch.receiveShadow = true;
      g.add(pitch);
      const apron = new THREE.Mesh(new THREE.RingGeometry(18, 60, 64), std(0x24272d));
      apron.rotation.x = -Math.PI / 2;
      apron.position.y = -0.06;
      g.add(apron);
      const roofM = std(0x1b1d22, { side: THREE.DoubleSide });
      const rf = new THREE.Mesh(new THREE.CylinderGeometry(36, 34, 1, 64, 1, true), roofM);
      rf.position.y = 14;
      g.add(rf);
      const ad = new THREE.Mesh(
        new THREE.CylinderGeometry(17.6, 17.6, 0.9, 96, 1, true),
        new THREE.MeshBasicMaterial({ map: stripeTex(24, '#e63946', '#1d4ed8'), side: THREE.DoubleSide }),
      );
      ad.position.y = 0.45;
      g.add(ad);
      [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ].forEach(([sx, sz]) => {
        const t = new THREE.Group();
        t.position.set(sx * 31, 0, sz * 31);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 26, 8), std(0x777b85, { metalness: 0.6 }));
        pole.position.y = 13;
        t.add(pole);
        const bank = new THREE.Mesh(
          new THREE.BoxGeometry(4, 2.4, 0.4),
          new THREE.MeshBasicMaterial({ color: 0xf4f8ff }),
        );
        bank.position.y = 26.5;
        bank.lookAt(-sx * 31, 4, -sz * 31);
        t.add(bank);
        const gl = glowSpr(0xdfe9ff, 14, 0.85);
        gl.position.y = 26.5;
        t.add(gl);
        g.add(t);
      });
      return g;
    },
  },
  crane: {
    name: 'Sky crane',
    songs: [3, 4],
    kit: { hit: 'metal', jump: 'metal' },
    blurb: 'Hanging over the city on a single cable.',
    env: {
      bg: 0x090a1a,
      fog: [0x0d0d22, 70, 330],
      sky: [
        [0, '#010208'],
        [0.45, '#050820'],
        [0.78, '#0c0d28'],
        [0.92, '#16112e'],
        [1, '#0d0d22'],
      ],
      hemi: [0x7080c0, 0x140e1c, 0.5],
      sun: 0.35,
      sunPos: [-40, 60, -30],
      sunCol: 0xa8b8ff,
      spots: 1,
      beams: 1,
      exp: 1.05,
      noStand: 1,
      sway: 1,
      stars: 1,
    },
    crowd: { tiers: 6, r0: 9, dr: 1.3, y0: 0.35, dy: 0.7, gap: 0.6, stepCol: 0x45404d, oy: -12 },
    build() {
      const g = new THREE.Group();
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(19, 19, 1, 48), std(0x3b3742));
      roof.position.y = -12.5;
      g.add(roof);
      const bld = new THREE.Mesh(
        new THREE.CylinderGeometry(19, 20, 60, 48, 1, true),
        new THREE.MeshLambertMaterial({
          map: windows(),
          emissive: 0xffffff,
          emissiveMap: windows(),
          emissiveIntensity: 1.8,
        }),
      );
      bld.position.y = -43;
      g.add(bld);
      const gridT = (() => {
        const [c, x] = cv(512, 512);
        x.fillStyle = '#07070d';
        x.fillRect(0, 0, 512, 512);
        for (let k = 0; k < 8; k++) {
          const p = k * 64 + 32;
          for (const [w, a] of [
            [10, 0.18],
            [3, 0.9],
          ]) {
            x.strokeStyle = `rgba(255,180,90,${a})`;
            x.lineWidth = w;
            x.beginPath();
            x.moveTo(p, 0);
            x.lineTo(p, 512);
            x.moveTo(0, p);
            x.lineTo(512, p);
            x.stroke();
          }
        }
        for (let i = 0; i < 500; i++) {
          x.fillStyle = Math.random() < 0.7 ? 'rgba(255,220,150,.9)' : 'rgba(160,210,255,.9)';
          x.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
        }
        const t = tex(c, true);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(14, 14);
        return t;
      })();
      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(900, 64),
        new THREE.MeshBasicMaterial({ map: gridT, color: 0xffffff }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -73;
      g.add(ground);
      {
        const pos = new Float32Array(2500 * 3);
        for (let i = 0; i < 2500; i++) {
          const v = new V3(Math.random() - 0.5, Math.random() * 0.9 + 0.12, Math.random() - 0.5)
            .normalize()
            .multiplyScalar(300);
          pos.set([v.x, v.y, v.z], i * 3);
        }
        const sg = new THREE.BufferGeometry();
        sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.add(
          new THREE.Points(
            sg,
            new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, fog: false, transparent: true, opacity: 0.8 }),
          ),
        );
        const moon = glowSpr(0xe8eeff, 22, 1);
        moon.position.set(-120, 140, -200);
        moon.material.fog = false;
        g.add(moon);
        const mh = glowSpr(0x8aa0ff, 70, 0.25);
        mh.position.copy(moon.position);
        mh.material.fog = false;
        g.add(mh);
      }
      const wm = windows();
      const bm = new THREE.MeshLambertMaterial({
        color: 0x222033,
        emissive: 0xffffff,
        emissiveMap: wm,
        emissiveIntensity: 3,
        map: wm,
      });
      const box = new THREE.BoxGeometry(1, 1, 1);
      const NB = 520,
        inst = new THREE.InstancedMesh(box, bm, NB),
        o = new THREE.Object3D();
      for (let i = 0; i < NB; i++) {
        let x, z;
        do {
          const a = Math.random() * 6.283,
            r = 30 + Math.pow(Math.random(), 0.7) * 520;
          x = Math.cos(a) * r;
          z = Math.sin(a) * r;
        } while (Math.hypot(x, z) < 28);
        const h = 15 + Math.random() * 55,
          w = 6 + Math.random() * 8;
        o.position.set(x, -73 + h / 2, z);
        o.scale.set(w, h, w);
        o.updateMatrix();
        inst.setMatrixAt(i, o.matrix);
      }
      g.add(inst);
      /* low-rise city filling every block between the towers, so no bare ground shows */
      {
        const lm = windows(2, 2, 0.5);
        const lmat = new THREE.MeshLambertMaterial({ color: 0x1c1b2a, emissive: 0xffffff, emissiveMap: lm, emissiveIntensity: 2.6, map: lm });
        const cell = 9,
          spots = [];
        for (let gx = -46; gx <= 46; gx++)
          for (let gz = -46; gz <= 46; gz++) {
            if (gx % 5 === 0 || gz % 5 === 0) continue; // avenues
            const x = gx * cell,
              z = gz * cell,
              d = Math.hypot(x, z);
            if (d < 26 || d > 420 || Math.random() < (d > 260 ? 0.45 : 0.08)) continue;
            spots.push([x, z]);
          }
        const low = new THREE.InstancedMesh(box, lmat, spots.length);
        spots.forEach(([x, z], i) => {
          const h = 4 + Math.pow(Math.random(), 2) * 16,
            w = cell * (0.72 + Math.random() * 0.2),
            dd = cell * (0.72 + Math.random() * 0.2);
          o.position.set(x + (Math.random() - 0.5) * 1.2, -73 + h / 2, z + (Math.random() - 0.5) * 1.2);
          o.scale.set(w, h, dd);
          o.rotation.set(0, 0, 0);
          o.updateMatrix();
          low.setMatrixAt(i, o.matrix);
        });
        g.add(low);
      }
      const yel = std(0xf2b705, { metalness: 0.3, roughness: 0.6 });
      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 94, 1.6),
        new THREE.MeshStandardMaterial({
          color: 0xf2b705,
          alphaMap: lattice(),
          alphaTest: 0.5,
          side: THREE.DoubleSide,
          metalness: 0.3,
          roughness: 0.6,
        }),
      );
      tower.position.set(-18, -26, 0);
      g.add(tower);
      const jib = new THREE.Mesh(new THREE.BoxGeometry(34, 1.4, 1.4), tower.material.clone());
      jib.material.alphaMap = lattice(8);
      jib.position.set(-6, 20.5, 0);
      g.add(jib);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2, 2.2), yel);
      cab.position.set(-18, 18.8, 1.6);
      g.add(cab);
      const cw = new THREE.Mesh(new THREE.BoxGeometry(4, 2.2, 2), std(0x555a60));
      cw.position.set(-25, 19.6, 0);
      g.add(cw);
      const trolley = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 1.6), std(0x333));
      trolley.position.set(0, 19.6, 0);
      g.add(trolley);
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 6), std(0x111, { metalness: 0.8 }));
      g.add(cable);
      g.userData.cable = cable;
      const hook = new THREE.Mesh(
        new THREE.TorusGeometry(0.35, 0.08, 8, 20, Math.PI * 1.5),
        std(0x999, { metalness: 0.9, roughness: 0.3 }),
      );
      g.add(hook);
      g.userData.hook = hook;
      const red = glowSpr(0xff2030, 2.5);
      red.position.set(10.5, 21.5, 0);
      g.add(red);
      g.userData.blink = red;
      return g;
    },
  },
  under: {
    name: 'Underwater',
    songs: [8, 9],
    kit: { lead: 'bubble', stab: 'bubble', hit: 'bubble', jump: 'bubbles', lp: 1700 },
    blurb: 'Kelp, coral and fish. Everything sounds a bit muffled down here.',
    env: {
      bg: 0x022538,
      fog: [0x063a55, 9, 52],
      sky: [
        [0, '#4fc0e8'],
        [0.25, '#0f5f8a'],
        [1, '#021d2e'],
      ],
      hemi: [0x6fd0f0, 0x062430, 0.7],
      sun: 0.6,
      sunPos: [10, 40, 10],
      sunCol: 0x9fe8ff,
      spots: 0.35,
      spotCol: 0x9fe8ff,
      beams: 1,
      exp: 0.92,
      bubble: 1,
      noStand: 1,
    },
    crowdGlow: 0.5,
    crowd: {
      tiers: 5,
      r0: 13,
      dr: 1.3,
      y0: 0.45,
      dy: 0.6,
      gap: 0.64,
      stepCol: 0x3c5a5a,
      arc: Math.PI * 1.4,
      a0: Math.PI * 0.8,
    },
    build() {
      const g = new THREE.Group();
      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(120, 64),
        std(0x5d6a5e, { map: noiseTex('#cdbb8c', ['#a99467', '#e8dbb2', '#8f7c55'], 512, 6) }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      g.add(floor);
      const rock = std(0x4a5a5c, { flatShading: true });
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * 6.28,
          r = 22 + Math.random() * 40,
          m = new THREE.Mesh(new THREE.IcosahedronGeometry(1 + Math.random() * 3, 0), rock);
        m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        m.scale.y = 0.6;
        g.add(m);
      }
      const kelpM = new THREE.MeshStandardMaterial({
          color: 0x2f8f3a,
          roughness: 0.7,
          side: THREE.DoubleSide,
          emissive: 0x0a3010,
          emissiveIntensity: 0.4,
        }),
        kelp = [];
      for (let i = 0; i < 90; i++) {
        const a = Math.random() * 6.28,
          r = 21 + Math.random() * 30,
          h = 1.8 + Math.random() * 3.2,
          piv = new THREE.Group();
        piv.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        piv.rotation.y = Math.random() * 6.28;
        const k = new THREE.Mesh(new THREE.PlaneGeometry(0.3, h, 1, 6), kelpM);
        k.position.y = h / 2;
        piv.add(k);
        piv.userData.ph = Math.random() * 6.28;
        g.add(piv);
        kelp.push(piv);
      }
      const ccols = [0xff5d8f, 0xff8a3d, 0xb05cff, 0xffd23f, 0x2ec4b6, 0xff4f6d];
      for (let i = 0; i < 70; i++) {
        const a = Math.random() * 6.28,
          r = 20.5 + Math.random() * 22,
          col = ccols[i % ccols.length],
          cl = new THREE.Group();
        cl.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        const M = std(col, { roughness: 0.6, emissive: col, emissiveIntensity: 0.18, flatShading: true }),
          kind = i % 3;
        if (kind === 0)
          for (let j = 0; j < 5; j++) {
            const c = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.2 + Math.random() * 1.4, 6), M);
            c.position.set((Math.random() - 0.5) * 0.9, 0.6, (Math.random() - 0.5) * 0.9);
            c.rotation.set((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6);
            cl.add(c);
          }
        else if (kind === 1) {
          const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7 + Math.random() * 0.6, 1), M);
          b.position.y = 0.4;
          b.scale.y = 0.7;
          cl.add(b);
        } else
          for (let j = 0; j < 4; j++) {
            const c = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.8 + Math.random() * 1.4, 8, 1, true), M);
            c.position.set((Math.random() - 0.5) * 0.7, 0.6, (Math.random() - 0.5) * 0.7);
            cl.add(c);
          }
        g.add(cl);
      }
      const surf = new THREE.Mesh(
        new THREE.PlaneGeometry(400, 400),
        new THREE.MeshBasicMaterial({
          color: 0x9fe8ff,
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
          fog: false,
        }),
      );
      surf.rotation.x = Math.PI / 2;
      surf.position.y = 34;
      g.add(surf);
      const shaftM = new THREE.MeshBasicMaterial({
        color: 0xcff6ff,
        transparent: true,
        opacity: 0.06,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * 6.28 + Math.random(),
          r = 8 + Math.random() * 22,
          sh = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 3.5, 34, 10, 1, true), shaftM);
        sh.position.set(Math.cos(a) * r, 17, Math.sin(a) * r);
        sh.rotation.z = (Math.random() - 0.5) * 0.25;
        g.add(sh);
      }
      const fishG = new THREE.ConeGeometry(0.16, 0.6, 5);
      fishG.rotateX(Math.PI / 2);
      const NF = 0,
        fish = new THREE.InstancedMesh(fishG, new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.3 }), NF);
      fish.frustumCulled = false;
      const fcols = [0xffb347, 0x7fdbff, 0xfff275, 0xff6b9d, 0x9bff7a],
        tc = new THREE.Color(),
        schools = [...Array(13)].map((_, k) => ({
          r: 5.5 + k * 2.6 + Math.random() * 2,
          h: 1.5 + Math.random() * 24,
          w: (0.16 + Math.random() * 0.22) * (k % 2 ? 1 : -1),
          c: k % 4,
        })),
        fd = [];
      for (let i = 0; i < NF; i++) {
        const sc = i % schools.length;
        fd.push({
          s: schools[sc],
          o: (Math.random() - 0.5) * 1.6,
          dy: (Math.random() - 0.5) * 2.2,
          dr: (Math.random() - 0.5) * 2.5,
          ph: Math.random() * 6,
        });
        fish.setColorAt(i, tc.setHex(fcols[schools[sc].c]));
      }
      g.add(fish);
      const NB = 260,
        bp = new Float32Array(NB * 3),
        bd = [];
      for (let i = 0; i < NB; i++) {
        const a = Math.random() * 6.28,
          r = 6 + Math.random() * 30;
        bd.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y0: Math.random() * 34, v: 0.8 + Math.random() * 1.6 });
      }
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.BufferAttribute(bp, 3));
      g.add(
        new THREE.Points(
          bg,
          new THREE.PointsMaterial({ color: 0xe6fbff, size: 0.18, transparent: true, opacity: 0.7 }),
        ),
      );
      const o = new THREE.Object3D();
      g.userData.tick = t => {
        kelp.forEach(k => {
          k.rotation.z = Math.sin(t * 0.9 + k.userData.ph) * 0.16;
          k.rotation.x = Math.sin(t * 0.7 + k.userData.ph * 1.3) * 0.1;
        });
        fd.forEach((f, i) => {
          const S = f.s,
            a = t * S.w + f.o,
            r = S.r + f.dr,
            y = S.h + f.dy + Math.sin(t * 1.3 + f.ph) * 0.3;
          o.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
          o.lookAt(Math.cos(a + 0.1 * Math.sign(S.w)) * r, y, Math.sin(a + 0.1 * Math.sign(S.w)) * r);
          o.rotateY(Math.sin(t * 9 + f.ph) * 0.15);
          o.updateMatrix();
          fish.setMatrixAt(i, o.matrix);
        });
        fish.instanceMatrix.needsUpdate = true;
        for (let i = 0; i < NB; i++) {
          const b = bd[i],
            y = (b.y0 + t * b.v) % 34;
          bp[i * 3] = b.x + Math.sin(t * 2 + i) * 0.15;
          bp[i * 3 + 1] = y;
          bp[i * 3 + 2] = b.z;
        }
        bg.attributes.position.needsUpdate = true;
      };
      return g;
    },
  },
  moon: {
    name: 'Moon base',
    songs: [10, 3],
    kit: { lead: 'theremin', hit: 'theremin', jump: 'swoop' },
    blurb: 'Low gravity, big Earth, no air to cheer in (they do anyway).',
    env: {
      bg: 0x000000,
      fog: [0x000000, 80, 240],
      sky: [
        [0, '#000000'],
        [1, '#05060c'],
      ],
      hemi: [0xbfd0ff, 0x202028, 0.35],
      sun: 1.0,
      sunPos: [40, 30, 30],
      sunCol: 0xffffff,
      spots: 0.5,
      spotCol: 0xcfe0ff,
      beams: 0,
      exp: 0.95,
      stars: 1,
    },
    crowdGlow: 0.6,
    crowd: { tiers: 6, r0: 14, dr: 1.4, y0: 0.5, dy: 0.8, gap: 0.66, stepCol: 0x55575e },
    build() {
      const g = new THREE.Group();
      const [c, x] = cv(512, 512);
      x.fillStyle = '#8d8f94';
      x.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 9000; i++) {
        x.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.18)';
        x.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
      }
      for (let i = 0; i < 40; i++) {
        const r = 6 + Math.random() * 28,
          px = Math.random() * 512,
          py = Math.random() * 512;
        x.strokeStyle = 'rgba(0,0,0,.35)';
        x.lineWidth = 3;
        x.beginPath();
        x.arc(px, py, r, 0, 7);
        x.stroke();
        x.fillStyle = 'rgba(0,0,0,.12)';
        x.fill();
        x.strokeStyle = 'rgba(255,255,255,.25)';
        x.lineWidth = 1.5;
        x.beginPath();
        x.arc(px - 1, py - 1, r, 3.6, 5.6);
        x.stroke();
      }
      const t = tex(c, true);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(4, 4);
      const fl = new THREE.Mesh(new THREE.CircleGeometry(160, 64), std(0x8a8a90, { map: t }));
      fl.rotation.x = -Math.PI / 2;
      fl.receiveShadow = true;
      g.add(fl);
      const rock = std(0x77797f, { flatShading: true });
      for (let i = 0; i < 40; i++) {
        const a = Math.random() * 6.28,
          r = 25 + Math.random() * 60,
          m = new THREE.Mesh(new THREE.IcosahedronGeometry(1 + Math.random() * 4, 0), rock);
        m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        m.scale.y = 0.5;
        g.add(m);
      }
      const pos = new Float32Array(3000 * 3);
      for (let i = 0; i < 3000; i++) {
        const v = new V3(Math.random() - 0.5, Math.random() * 0.9 + 0.05, Math.random() - 0.5)
          .normalize()
          .multiplyScalar(88);
        pos.set([v.x, v.y, v.z], i * 3);
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, fog: false })));
      const [ec, ex] = cv(256, 256);
      const eg = ex.createRadialGradient(110, 110, 10, 128, 128, 120);
      eg.addColorStop(0, '#7fd0ff');
      eg.addColorStop(0.7, '#1f5fbf');
      eg.addColorStop(1, '#0a1d4a');
      ex.fillStyle = eg;
      ex.beginPath();
      ex.arc(128, 128, 120, 0, 7);
      ex.fill();
      ex.fillStyle = '#3fae5a';
      [
        [90, 90, 30],
        [150, 140, 24],
        [120, 190, 18],
        [180, 80, 14],
      ].forEach(([a, b, r]) => {
        ex.beginPath();
        ex.ellipse(a, b, r, r * 0.7, 0.5, 0, 7);
        ex.fill();
      });
      ex.fillStyle = 'rgba(255,255,255,.6)';
      ex.beginPath();
      ex.ellipse(140, 70, 40, 10, 0.3, 0, 7);
      ex.fill();
      const earth = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(ec, true), fog: false }));
      earth.scale.setScalar(18);
      earth.position.set(-40, 45, -60);
      g.add(earth);
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({
          color: 0x9fd8ff,
          transparent: true,
          opacity: 0.3,
          metalness: 0.9,
          roughness: 0.1,
        }),
      );
      dome.position.set(32, 0, -28);
      g.add(dome);
      return g;
    },
  },
};
function windows(rx = 6, ry = 4, lit = 0.55) {
  /* lit windows: warm and cool tones, some brighter, a few whole floors on */
  const [c, x] = cv(64, 128);
  x.fillStyle = '#000';
  x.fillRect(0, 0, 64, 128);
  for (let yy = 3; yy < 128; yy += 8) {
    const floorOn = Math.random() < 0.12;
    for (let xx = 3; xx < 64; xx += 8)
      if (floorOn || Math.random() < lit) {
        const k = Math.random();
        x.fillStyle = k < 0.62 ? '#ffd27a' : k < 0.84 ? '#fff1c9' : k < 0.95 ? '#9fdcff' : '#ff9c6b';
        x.globalAlpha = 0.7 + Math.random() * 0.3;
        x.fillRect(xx, yy, 5, 6);
      }
  }
  x.globalAlpha = 1;
  const t = tex(c, true);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  return t;
}
function lattice(rep) {
  const [c, x] = cv(64, 64);
  x.strokeStyle = '#fff';
  x.lineWidth = 6;
  x.strokeRect(3, 3, 58, 58);
  x.beginPath();
  x.moveTo(0, 0);
  x.lineTo(64, 64);
  x.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, rep || 60);
  return t;
}

export function initArenas() {
  /* ---------- arenas ---------- */
  sun = new THREE.DirectionalLight(0xfff1d6, 0);
  sun.position.set(-30, 40, -20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.04;
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 10, far: 120 });
  scene.add(sun, sun.target);
  sky = new THREE.Mesh(
    new THREE.SphereGeometry(95, 32, 16),
    new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  sky.renderOrder = -1;
  scene.add(sky);
  turntable = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 1.25, 0.14, 40),
    new THREE.MeshStandardMaterial({ color: 0x2a2a30, metalness: 0.8, roughness: 0.3 }),
  );
  turntable.position.set(0, 0.07, 6.4);
  turntable.visible = false;
  scene.add(turntable);
  ringGlow = new THREE.Mesh(
    new THREE.TorusGeometry(1.2, 0.03, 6, 60),
    new THREE.MeshBasicMaterial({ color: 0xffb347 }),
  );
  ringGlow.rotation.x = Math.PI / 2;
  ringGlow.position.set(0, 0.15, 6.4);
  turntable.add(ringGlow);
  ringGlow.position.set(0, 0.08, 0);
}

export { ARENAS, glowSpr, grad, sky, std, sun, turntable };
