import * as THREE from 'three';
import { game } from '../core/state.js';
import { app, renderer, scene } from '../render/renderer.js';
import { cv, tex } from '../render/textures.js';
import { hemi, spots } from '../render/lights.js';
import { globe, stand } from '../arenas/globe.js';
import { glowSpr, sky, sun } from '../arenas/arenas.js';
import { arenaId, built, setArena } from '../arenas/current.js';
import { makeBike } from '../bikes/bike.js';
import { garage, saveGarage } from '../game/save.js';
import { orientOnWall, posAt, tanAt } from '../game/path.js';
import { player } from '../game/objects.js';
import { ov } from './hud.js';
import { cam } from '../render/camera.js';
import { start } from '../game/run.js';
import { $, R, V3 } from '../core/constants.js';
import { finishCss } from '../bikes/finishes.js';
import { CATALOG, findItem } from '../bikes/catalog.js';
import { makeFigure } from '../rider/rider.js';
import { BIKE_STATS, STAT_NAMES } from '../bikes/stats.js';
import { showStart } from './menus.js';

let G0, garageRoom;

let gFig = null,
  gBike = null;
function rebuildGarageSet() {
  if (gFig) garageRoom.remove(gFig);
  if (gBike) garageRoom.remove(gBike.g);
  const gs = garage.sel,
    GC = findItem('costume', gs.costume);
  gFig = makeFigure(
    gs.costume,
    gs.helmet ? findItem('paint', gs.helmet).c : (GC.helmet ?? findItem('paint', gs.paint).c),
    gs.suit ? findItem('paint', gs.suit).c : null,
    gs.suit,
    gs.helmet,
  );
  gFig.position.set(-0.75, 0, 0.55);
  gFig.rotation.y = 0.35;
  garageRoom.add(gFig);
  gBike = makeBike(garage.sel);
  gBike.rider.visible = false;
  gBike.g.scale.setScalar(1.15);
  gBike.g.position.set(0.75, 0, 0.1);
  gBike.g.rotation.y = -1.05;
  garageRoom.add(gBike.g);
  game.gCheer = 1.2;
}
function garageEnv(on) {
  for (const k in built) {
    built[k].g.visible = false;
    built[k].c.grp.visible = false;
  }
  globe.visible = !on;
  stand.visible = !on;
  if (on) {
    garageRoom.visible = true;
    scene.background = new THREE.Color(0x0b0b0e);
    scene.fog.near = 200;
    scene.fog.far = 400;
    sky.visible = false;
    hemi.intensity = 0.35;
    hemi.color.setHex(0xffe8cc);
    hemi.groundColor.setHex(0x202024);
    sun.intensity = 0;
    spots.forEach(s => (s.intensity = 0));
    renderer.toneMappingExposure = 1.1;
    rebuildGarageSet();
  } else {
    garageRoom.visible = false;
    setArena(arenaId);
  }
}
let showroom = false,
  garageTab = 'style';
function rebuildPlayerBike() {
  const vis = player.bike.g.visible;
  globe.remove(player.bike.g);
  player.bike = makeBike(garage.sel);
  globe.add(player.bike.g);
  player.bike.g.visible = vis;
}
const PCATS = [
  ['Solid', it => !it.tex && !it.neon && !(it.metal >= 0.8)],
  ['Metallic', it => !it.tex && !it.neon && it.metal >= 0.8],
  [
    'Patterns',
    it => ['flames', 'stripes', 'checker', 'carbon', 'camo', 'lightning', 'lava', 'galaxy', 'holo'].includes(it.tex),
  ],
  ['Animal', it => ['tiger', 'leopard', 'zebra', 'dalmatian', 'snake'].includes(it.tex)],
  ['Neon', it => !!it.neon || ['synth', 'tubes'].includes(it.tex)],
];
const catOf = id => {
  const it = CATALOG.paint.find(i => i.id === id);
  if (!it) return 'Solid';
  return (PCATS.find(([, f]) => f(it)) || PCATS[0])[0];
};
let gCat = {},
  gPart = 'suit';
function showGarage(msg) {
  app.classList.add('menu');
  game.running = false;
  if (!showroom) {
    cam.snap = true;
    garageEnv(true);
  }
  showroom = true;
  ov.hidden = false;
  ov.classList.add('garage');
  const keep = {};
  ov.querySelectorAll('[data-hs]').forEach(e => (keep[e.dataset.hs] = e.scrollLeft));
  const oldTop = ov.scrollTop;
  const tab = garageTab === 'rider' ? 'rider' : 'bike',
    sel = garage.sel,
    hex = finishCss;
  const cards = k =>
    `<div class="igrid">${CATALOG[k].map(it => `<button class="item${sel[k] === it.id ? ' sel' : ''}" data-k="${k}" data-id="${it.id}"><b>${it.name}</b><span>${sel[k] === it.id ? (k === 'style' ? 'Riding' : 'Wearing') : 'Owned'}</span></button>`).join('')}</div>`;
  const palette = (key, def) => {
    const cur = sel[key],
      cat = gCat[key] || (cur ? catOf(cur) : 'Solid');
    gCat[key] = cat;
    const list = CATALOG.paint.filter(PCATS.find(c => c[0] === cat)[1]);
    return `<div class="cats">${PCATS.map(([c]) => `<button class="cat" data-cat="${c}" data-key="${key}" aria-pressed="${c === cat}">${c}</button>`).join('')}</div>
      <div class="hs" data-hs="sw-${key}-${cat}">${def && cat === 'Solid' ? `<button class="swb def${cur ? '' : ' sel'}" data-sw="${key}" data-id="" aria-label="Costume colour" title="Costume colour"></button>` : ''}${list.map(it => `<button class="swb${cur === it.id ? ' sel' : ''}${it.neon ? ' neon' : ''}" data-sw="${key}" data-id="${it.id}" title="${it.name}" aria-label="${it.name}" style="background:${hex(it)}${it.neon ? ';color:#' + it.c.toString(16).padStart(6, '0') : ''}"></button>`).join('')}</div>`;
  };
  const st = BIKE_STATS[sel.style],
    pname = k => (sel[k] ? findItem('paint', sel[k]).name : 'Costume colour');
  ov.innerHTML = `<div class="card gcard">
    <div class="ghead"><h2>Garage</h2><div class="seg gseg"><button class="tab" data-tab="bike" aria-pressed="${tab === 'bike'}">Bike</button><button class="tab" data-tab="rider" aria-pressed="${tab === 'rider'}">Rider</button></div></div>
    ${
      tab === 'bike'
        ? `<div class="glabel">Model <b>${findItem('style', sel.style).name}</b></div>${cards('style')}
      <div class="mstats" title="${st.tag}">${Object.keys(STAT_NAMES)
        .map(
          k =>
            `<div>${STAT_NAMES[k]}<i>${[1, 2, 3, 4, 5].map(v => `<b class="${v <= st[k] ? 'on' : ''}"></b>`).join('')}</i></div>`,
        )
        .join('')}</div>
      <div class="glabel">Paint <b>${findItem('paint', sel.paint).name}</b></div>${palette('paint')}`
        : `<div class="glabel">Outfit <b>${findItem('costume', sel.costume).name}</b></div>${cards('costume')}
      <div class="seg"><button data-part="suit" aria-pressed="${gPart === 'suit'}">Suit</button><button data-part="helmet" aria-pressed="${gPart === 'helmet'}">Helmet</button></div><div class="glabel">${gPart === 'suit' ? 'Suit' : 'Helmet'} colour <b>${pname(gPart)}</b></div>${palette(gPart, 1)}`
    }
    ${msg ? `<p class="gmsg">${msg}</p>` : ''}
    <div style="display:flex;gap:10px"><button class="go" id="ride">Ride</button><button class="go ghost" id="back">Back</button></div></div>`;
  ov.querySelectorAll('[data-hs]').forEach(e => {
    if (keep[e.dataset.hs] != null) e.scrollLeft = keep[e.dataset.hs];
    else {
      const s2 = e.querySelector('.sel');
      if (s2) e.scrollLeft = Math.max(0, s2.offsetLeft - e.clientWidth / 2 + s2.offsetWidth / 2);
    }
  });
  ov.scrollTop = oldTop;
  ov.querySelectorAll('.tab').forEach(
    b =>
      (b.onclick = () => {
        garageTab = b.dataset.tab;
        showGarage();
      }),
  );
  ov.querySelectorAll('[data-part]').forEach(
    b =>
      (b.onclick = () => {
        gPart = b.dataset.part;
        showGarage();
      }),
  );
  ov.querySelectorAll('.cat').forEach(
    b =>
      (b.onclick = () => {
        gCat[b.dataset.key] = b.dataset.cat;
        showGarage();
      }),
  );
  const pick = (k, id) => {
    garage.sel[k] = id || null;
    saveGarage();
    rebuildPlayerBike();
    rebuildGarageSet();
    showGarage();
  };
  ov.querySelectorAll('.item').forEach(b => (b.onclick = () => pick(b.dataset.k, b.dataset.id)));
  ov.querySelectorAll('.swb').forEach(b => (b.onclick = () => pick(b.dataset.sw, b.dataset.id)));
  $('#ride').onclick = () => {
    leaveGarage();
    start();
  };
  $('#back').onclick = () => {
    leaveGarage();
    showStart();
  };
}
function leaveGarage() {
  if (showroom) garageEnv(false);
  showroom = false;
  ov.classList.remove('garage');
}
function parkBike() {
  if (game.running) return;
  const P = player;
  posAt(0, P.p);
  tanAt(0, P.t);
  orientOnWall(P.bike.g, P.p, P.t, 0);
  P.bike.g.position.copy(P.p).multiplyScalar(R);
  P.bike.g.visible = true;
}

export function initGarage() {
  /* ---------- garage screen ---------- */
  /* ---------- the garage set (built once, far from the arena) ---------- */
  G0 = new V3(300, 0, 0);
  garageRoom = new THREE.Group();
  garageRoom.position.copy(G0);
  garageRoom.visible = false;
  scene.add(garageRoom);
  (function () {
    const g = garageRoom;
    const conc = (() => {
      const [c, x] = cv(512, 512);
      x.fillStyle = '#55565c';
      x.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 14000; i++) {
        x.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.12)';
        x.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
      }
      for (let i = 0; i < 6; i++) {
        x.fillStyle = 'rgba(10,10,14,.35)';
        x.beginPath();
        x.ellipse(
          Math.random() * 512,
          Math.random() * 512,
          20 + Math.random() * 50,
          10 + Math.random() * 25,
          Math.random() * 3,
          0,
          7,
        );
        x.fill();
      }
      x.strokeStyle = 'rgba(0,0,0,.4)';
      x.lineWidth = 3;
      for (let i = 0; i <= 512; i += 128) {
        x.beginPath();
        x.moveTo(i, 0);
        x.lineTo(i, 512);
        x.stroke();
        x.beginPath();
        x.moveTo(0, i);
        x.lineTo(512, i);
        x.stroke();
      }
      const t = tex(c, true);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(3, 3);
      return t;
    })();
    const brick = (() => {
      const [c, x] = cv(256, 256);
      x.fillStyle = '#4a2c25';
      x.fillRect(0, 0, 256, 256);
      for (let r = 0; r < 16; r++)
        for (let k = -1; k < 5; k++) {
          const off = r % 2 ? 32 : 0;
          x.fillStyle = ['#8a3f30', '#7b382b', '#94473a', '#6e3326'][(r * 7 + k * 3) & 3];
          x.fillRect(k * 64 + off + 2, r * 16 + 2, 60, 12);
        }
      const t = tex(c, true);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(4, 2);
      return t;
    })();
    const peg = (() => {
      const [c, x] = cv(256, 256);
      x.fillStyle = '#b48a5a';
      x.fillRect(0, 0, 256, 256);
      x.fillStyle = '#6e5234';
      for (let i = 8; i < 256; i += 16)
        for (let j = 8; j < 256; j += 16) {
          x.beginPath();
          x.arc(i, j, 2, 0, 7);
          x.fill();
        }
      x.strokeStyle = '#2a2a30';
      x.lineWidth = 8;
      x.lineCap = 'round';
      [
        [40, 40, 40, 120],
        [80, 30, 80, 110],
        [130, 40, 170, 110],
        [200, 30, 200, 120],
      ].forEach(([a, b, cc, d]) => {
        x.beginPath();
        x.moveTo(a, b);
        x.lineTo(cc, d);
        x.stroke();
      });
      x.fillStyle = '#c0392b';
      x.fillRect(30, 160, 90, 40);
      x.fillStyle = '#2a2a30';
      x.beginPath();
      x.arc(190, 190, 30, 0, 7);
      x.lineWidth = 10;
      x.stroke();
      return tex(c, true);
    })();
    const M = (col, o) => new THREE.MeshStandardMaterial(Object.assign({ color: col, roughness: 0.85 }, o || {}));
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 9),
      M(0xffffff, { map: conc, roughness: 0.6, metalness: 0.1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    g.add(floor);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(12, 4.6), M(0xffffff, { map: brick }));
    back.position.set(0, 2.3, -3);
    g.add(back);
    [
      [-5.2, 1],
      [5.2, -1],
    ].forEach(([x0, s]) => {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.6), M(0x3b3d44));
      w.position.set(x0, 2.3, 1.5);
      w.rotation.y = (s * Math.PI) / 2;
      g.add(w);
    });
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(12, 9), M(0x1d1e22));
    ceil.position.set(0, 4.6, 1.5);
    ceil.rotation.x = Math.PI / 2;
    g.add(ceil);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), M(0xffffff, { map: peg }));
    board.position.set(3.2, 2.2, -2.97);
    g.add(board);
    const bench = new THREE.Group();
    bench.position.set(3.2, 0, -2.4);
    g.add(bench);
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 0.9), M(0x8b5a2b));
    top.position.y = 0.95;
    bench.add(top);
    [
      [-1.3, -0.35],
      [1.3, -0.35],
      [-1.3, 0.35],
      [1.3, 0.35],
    ].forEach(([x, z]) => {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.95, 0.08), M(0x333));
      l.position.set(x, 0.47, z);
      bench.add(l);
    });
    const tb = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.35), M(0xc0392b, { metalness: 0.4, roughness: 0.4 }));
    tb.position.set(-0.6, 1.18, 0);
    bench.add(tb);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.55), M(0xc0392b, { metalness: 0.4, roughness: 0.4 }));
    cab.position.set(-4.4, 0.55, -2.6);
    g.add(cab);
    for (let i = 0; i < 4; i++) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.02, 0.02), M(0xdddddd, { metalness: 0.9 }));
      d.position.set(-4.4, 0.25 + i * 0.25, -2.32);
      g.add(d);
    }
    for (let i = 0; i < 4; i++) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.14, 10, 24), M(0x111114, { roughness: 0.95 }));
      t.rotation.x = Math.PI / 2;
      t.position.set(-4.2, 0.14 + i * 0.28, -0.6);
      g.add(t);
    }
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.9, 18),
      M(0x2563eb, { metalness: 0.5, roughness: 0.4 }),
    );
    drum.position.set(4.5, 0.45, 0);
    g.add(drum);
    const [nc, nx] = cv(512, 128);
    nx.fillStyle = 'rgba(0,0,0,0)';
    nx.fillRect(0, 0, 512, 128);
    nx.font = 'bold 46px Impact, "Arial Black", sans-serif';
    nx.textAlign = 'center';
    nx.textBaseline = 'middle';
    nx.shadowColor = '#ff4fa3';
    nx.shadowBlur = 24;
    nx.fillStyle = '#ffd1ea';
    nx.fillText('GLOBO DE LA MUERTE', 256, 64);
    const neon = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 1),
      new THREE.MeshBasicMaterial({ map: tex(nc, true), transparent: true }),
    );
    neon.position.set(0, 3.35, -2.95);
    g.add(neon);
    const ng = glowSpr(0xff4fa3, 5, 0.35);
    ng.position.set(0, 3.35, -2.8);
    g.add(ng);
    const [pc, px] = cv(256, 384);
    px.fillStyle = '#f4e3c1';
    px.fillRect(0, 0, 256, 384);
    px.fillStyle = '#c0392b';
    px.fillRect(14, 14, 228, 356);
    px.fillStyle = '#f4e3c1';
    px.font = 'bold 46px Impact, sans-serif';
    px.textAlign = 'center';
    px.fillText('DAREDEVIL', 128, 80);
    px.font = 'bold 28px Impact, sans-serif';
    px.fillText('NIGHTLY', 128, 330);
    px.beginPath();
    px.arc(128, 200, 70, 0, 7);
    px.lineWidth = 10;
    px.strokeStyle = '#f4e3c1';
    px.stroke();
    const poster = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1.5),
      new THREE.MeshStandardMaterial({ map: tex(pc, true) }),
    );
    poster.position.set(-5.17, 2.2, -1);
    poster.rotation.y = Math.PI / 2;
    g.add(poster);
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.35, 0.3, 20, 1, true),
      M(0x2d6a4f, { side: THREE.DoubleSide, metalness: 0.5 }),
    );
    shade.position.set(0, 3.6, 0.4);
    g.add(shade);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1), M(0x111));
    cord.position.set(0, 4.1, 0.4);
    g.add(cord);
    const bulb = glowSpr(0xffe2a8, 1.4);
    bulb.position.set(0, 3.42, 0.4);
    g.add(bulb);
    const lamp = new THREE.PointLight(0xffd9a0, 1.6, 14, 1.4);
    lamp.position.set(0, 3.3, 0.4);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(512, 512);
    g.add(lamp);
    const fill = new THREE.PointLight(0x9fb8ff, 0.5, 14, 1.6);
    fill.position.set(-3, 2.5, 4);
    g.add(fill);
    const mat = new THREE.Mesh(new THREE.CircleGeometry(1.6, 40), M(0x15161a, { roughness: 0.4, metalness: 0.3 }));
    mat.rotation.x = -Math.PI / 2;
    mat.position.set(0.9, 0.01, 0.2);
    g.add(mat);
  })();
  /* standing rider in costume */
  game.gCheer = 0;
}

export { G0, gBike, gFig, leaveGarage, parkBike, rebuildGarageSet, rebuildPlayerBike, showGarage, showroom };
