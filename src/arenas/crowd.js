import * as THREE from 'three';
import CROWD_URI from '../assets/crowd-atlas.png';
import { game } from '../core/state.js';
import { clamp } from '../core/constants.js';

let crowdTx, EXCL, CHARS;

function makeCrowd(c) {
  const list = [],
    grp = new THREE.Group();
  grp.position.set(0, c.oy || 0, 0);
  const stepMat = new THREE.MeshStandardMaterial({
    color: c.stepCol ?? 0x22160f,
    roughness: 0.95,
    side: THREE.DoubleSide,
  });
  // `arcs`: several [start, length] pieces per tier (e.g. people at both ends of the pirate ship)
  const ARCS = c.arcs || [[c.a0 || 0, c.arc || Math.PI * 2]];
  /* a board behind the back row of every stand, as tall as the people, with a rail along the top: from
     outside you see the back of the stand, never the backs of the crowd */
  {
    const rB = c.r0 + (c.tiers - 1) * c.dr + c.dr * 0.62,
      yTop = c.y0 + (c.tiers - 1) * c.dy + (c.size || 1.25) * 1.18,
      y0 = c.steps === false ? c.y0 - 0.25 : 0,
      wood = c.steps === false,
      // the board takes the stand's own colour (a shade darker) unless the level names one, so it belongs there:
      // sandy wood on the beach, stone in the castle, snow at the pole…
      boardM = new THREE.MeshStandardMaterial({
        color: wood ? 0x7a4a26 : c.boardCol != null ? c.boardCol : new THREE.Color(c.stepCol ?? 0x22160f).multiplyScalar(0.8),
        roughness: 0.85,
        side: THREE.DoubleSide,
      }),
      railM = new THREE.MeshStandardMaterial({ color: wood ? 0x4e2f18 : 0xb9bec6, roughness: 0.4, metalness: wood ? 0 : 0.7 });
    for (const [aStart, aLen] of ARCS) {
      // a part-ring board runs a little past each end of its rows, so the end people aren't seen side-on
      const full = aLen >= Math.PI * 2 - 1e-3,
        pad = full ? 0 : 0.7 / rB,
        a0 = aStart - pad,
        arc = aLen + pad * 2,
        seg = Math.max(8, Math.round((arc / (Math.PI * 2)) * 96)),
        board = new THREE.Mesh(new THREE.CylinderGeometry(rB, rB, yTop - y0, seg, 1, true, Math.PI / 2 - a0 - arc, arc), boardM);
      board.position.y = (yTop + y0) / 2;
      grp.add(board);
      const rail = new THREE.Mesh(new THREE.TorusGeometry(rB, 0.07, 6, seg, arc), railM);
      rail.rotation.x = Math.PI / 2;
      rail.rotation.z = -a0 - arc;
      rail.position.y = yTop;
      grp.add(rail);
      // posts along it (and one at each open end)
      const np = Math.max(2, Math.round((arc * rB) / 3.2));
      for (let k = 0; k <= np; k++) {
        if (full && k === np) break;
        const a = a0 + (arc * k) / np,
          post = new THREE.Mesh(new THREE.BoxGeometry(0.16, yTop - y0 + 0.12, 0.16), railM);
        post.position.set(Math.cos(a) * (rB + 0.06), (yTop + y0) / 2, Math.sin(a) * (rB + 0.06));
        post.rotation.y = -a;
        grp.add(post);
      }
    }
  }
  for (let t = 0; t < c.tiers; t++)
    for (const [a0, arc] of ARCS) {
      const r = c.r0 + t * c.dr,
        y = c.y0 + t * c.dy,
        n = Math.floor((arc * r) / c.gap);
      if (c.steps !== false) {
        const st = new THREE.Mesh(new THREE.RingGeometry(r - c.dr / 2, r + c.dr / 2, 96, 1, a0, arc), stepMat);
        st.rotation.x = Math.PI / 2;
        st.position.y = y - 0.02;
        st.receiveShadow = true;
        grp.add(st);
        if (t > 0 && c.dy > 0) {
          const rs = new THREE.Mesh(
            new THREE.CylinderGeometry(r - c.dr / 2, r - c.dr / 2, c.dy, 96, 1, true, Math.PI / 2 - a0 - arc, arc),
            stepMat,
          );
          rs.position.y = y - c.dy / 2;
          grp.add(rs);
        }
      }
      for (let i = 0; i < n; i++) {
        if (Math.random() < (c.empty ?? 0.08)) continue;
        list.push({
          a: a0 + ((i + 0.5) / n) * arc + (Math.random() - 0.5) * 0.01,
          r: r + (Math.random() - 0.5) * 0.2,
          y,
          ph: Math.random() * 6.28,
          s: (c.size || 1.25) * (0.9 + Math.random() * 0.2),
          v: CHARS[Math.floor(Math.random() * CHARS.length)],
          hype: 0,
          up: -1,
        });
      }
    }
  {
    const ord = list.map((_, i) => i).sort(() => Math.random() - 0.5);
    ord.forEach((li, r) => (list[li].rank = r));
  }
  let shown = list.length;
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.translate(0, 0.5, 0);
  const uvA = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 2), 2);
  geo.setAttribute('instUv', uvA);
  const mat = new THREE.MeshLambertMaterial({
    map: crowdTx,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    emissive: 0xffffff,
    emissiveMap: crowdTx,
    emissiveIntensity: 0.5,
  });
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <uv_pars_vertex>', '#include <uv_pars_vertex>\nattribute vec2 instUv;')
      .replace(
        '#include <uv_vertex>',
        '#include <uv_vertex>\n#ifdef USE_UV\nvUv = uv*vec2(0.1,0.05) + instUv;\n#endif',
      );
    // seen from behind (e.g. the near end of the pirate ship from the Arena camera) people show as dark
    // backs in shade instead of a mirrored front
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_fragment>', '#include <map_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb = vec3(0.05, 0.045, 0.05);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nif (!gl_FrontFacing) totalEmissiveRadiance = vec3(0.02);');
  };
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  mesh.frustumCulled = false;
  grp.add(mesh);
  const o = new THREE.Object3D();
  let idleT = 0;
  function setPose(p, i, up) {
    if (p.up === up) return;
    p.up = up;
    const col = p.v % 10,
      row = Math.floor(p.v / 10) * 2 + (up ? 1 : 0);
    uvA.setXY(i, col / 10, 1 - (row + 1) / 20);
    uvA.needsUpdate = true;
  }
  function update(cheer, time, dt, force) {
    idleT -= dt;
    let busy = cheer > 0.02;
    if (!busy)
      for (const p of list)
        if (p.hype > 0.02) {
          busy = true;
          break;
        }
    if (!busy && idleT > 0 && !force) return;
    idleT = 0.15;
    list.forEach((p, i) => {
      if (p.rank >= shown) {
        o.position.set(0, -999, 0);
        o.scale.setScalar(0);
        o.updateMatrix();
        mesh.setMatrixAt(i, o.matrix);
        return;
      }
      p.hype = Math.max(0, p.hype - dt * (busy ? 0.6 : 0));
      const ex = clamp(cheer * (0.6 + 0.4 * Math.sin(p.ph * 7)) + p.hype, 0, 1);
      const j = ex > 0.05 ? ex * Math.max(0, Math.sin(time * (9 + p.ph) + p.ph)) * 0.45 * p.s : 0;
      setPose(p, i, ex > 0.2 ? Math.sin(time * 6 + p.ph * 3) > -0.5 : Math.sin(time * 0.5 + p.ph * 5) > 0.97);
      o.position.set(Math.cos(p.a) * p.r, p.y + j, Math.sin(p.a) * p.r);
      o.rotation.set(0, 0, 0);
      o.lookAt(0, p.y + j, 0);
      if (ex > 0.2) o.rotateZ(Math.sin(time * 11 + p.ph) * 0.12 * ex);
      o.scale.setScalar(p.s);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
  function wave() {
    for (const p of list) if (Math.random() < 0.85) p.hype = Math.min(1, p.hype + 0.6 + Math.random() * 0.4);
  }
  update(0, 0, 1, true);
  return {
    grp,
    mat,
    update,
    wave,
    setShown(n) {
      shown = Math.min(list.length, n);
      update(0, 0, 1, true);
    },
    total: list.length,
  };
}
const fansFor = n => Math.round(7 * Math.pow(1.5, n));
const crowd = {
  update(c, t, d) {
    if (game.curCrowd) game.curCrowd.update(c, t, d);
  },
  wave() {
    if (game.curCrowd) game.curCrowd.wave();
  },
  sync() {
    if (game.curCrowd) game.curCrowd.setShown(game.unlockAll ? 1e9 : game.fans);
  },
};

export function initCrowd() {
  /* ---------- crowds: sprite people from the two sheets (10 cols x 20 rows, idle/cheer row pairs) ---------- */
  crowdTx = new THREE.TextureLoader().load(CROWD_URI);
  crowdTx.encoding = THREE.sRGBEncoding;
  crowdTx.magFilter = THREE.NearestFilter;
  crowdTx.anisotropy = 4;
  EXCL = new Set([54, 62, 75, 87, 89]);
  CHARS = [...Array(100).keys()].filter(i => !EXCL.has(i));
  game.curCrowd = null;
  game.crowdLight = 1;
  game.plays = 0;
  try {
    game.plays = +localStorage.getItem('god-plays') || 0;
  } catch (e) {}
  // fans are earned (10 per act cleared, 1 per 30 s of free ride) and come back every time; start with 7
  game.fans = Math.max(7, fansFor(game.plays));
  try {
    const f = localStorage.getItem('god-fans');
    if (f !== null) game.fans = Math.max(7, +f || 0);
  } catch (e) {}
}

export { CHARS, crowd, crowdTx, fansFor, makeCrowd };
