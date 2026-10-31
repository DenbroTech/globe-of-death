import * as THREE from 'three';
import { neonify } from '../render/neon.js';
import { rebuildGarageSet, showroom } from '../ui/garage.js';
import { V3 } from '../core/constants.js';
import { triplanar } from '../bikes/finishes.js';
import { findItem } from '../bikes/catalog.js';
import { envify } from '../render/envmap.js';
import { ik2 } from './ik.js';
import { costumeExtras, riderKit, riderMats } from './rider.js';

let riderWaiting;

/* ---------- rider model: Mixamo "X Bot" human body as the base, dressed as a rider (one-piece leathers, gloves, boots, full-face helmet) ---------- */
let RIDER_GLTF = null;
function prepRider(g) {
  const scene = g.scene;
  scene.updateMatrixWorld(true);
  const drop = [],
    keep = [];
  scene.traverse(n => {
    if (!n.isSkinnedMesh) return;
    const nm = n.name;
    if (/Headwear|Wolf3D_Head|Beard|Teeth|Eye/.test(nm)) {
      drop.push(n);
      return;
    }
    n.userData.part = /Top|Bottom/.test(nm) ? 'suit' : /Footwear/.test(nm) ? 'boot' : 'skin';
    keep.push(n);
  });
  drop.forEach(n => n.parent.remove(n));
  if (!keep.length) return null;
  const gc = (at, i, k) => (k === 0 ? at.getX(i) : k === 1 ? at.getY(i) : k === 2 ? at.getZ(i) : at.getW(i));
  keep.forEach(mesh => {
    if (!/Top/.test(mesh.name)) return;
    const geo = mesh.geometry,
      bones = mesh.skeleton.bones,
      si = geo.attributes.skinIndex,
      sw = geo.attributes.skinWeight,
      pos = geo.attributes.position;
    const hipsB = bones.find(b => /Hips$/.test(b.name)),
      hy = hipsB ? hipsB.getWorldPosition(new V3()).y : 1;
    const low = new Set(bones.map((b, i) => (/(Hips|UpLeg)$/.test(b.name) ? i : -1)).filter(i => i >= 0));
    const tail = i => {
      let best = -1,
        bi = 0;
      for (let k = 0; k < 4; k++) {
        const w = gc(sw, i, k);
        if (w > best) {
          best = w;
          bi = gc(si, i, k);
        }
      }
      return low.has(bi) && pos.getY(i) < hy - 0.04;
    };
    const idx = geo.index ? Array.from(geo.index.array) : [...Array(pos.count).keys()],
      out = [];
    for (let t = 0; t < idx.length; t += 3) {
      if (tail(idx[t]) && tail(idx[t + 1]) && tail(idx[t + 2])) continue;
      out.push(idx[t], idx[t + 1], idx[t + 2]);
    }
    geo.setIndex(out);
  });
  return { scene, unit: 1 };
}
function loadRiderModel() {
  if (!THREE.GLTFLoader || !THREE.SkeletonUtils) return;
  try {
    const ok = g => {
        try {
          RIDER_GLTF = prepRider(g);
          if (RIDER_GLTF) upgradeRiders();
        } catch (e) {
          RIDER_GLTF = null;
        }
      },
      el = document.getElementById('riderData');
    if (el && el.textContent.length > 100) {
      new THREE.GLTFLoader().parse(el.textContent, '', ok, () => {});
    } else new THREE.GLTFLoader().load('rider.json', ok, undefined, () => {});
  } catch (e) {}
}
function riderSkinMat(m, unit, leather) {
  const c = m.clone();
  c.skinning = true;
  c.userData.neon = m.userData.neon;
  c.side = THREE.FrontSide;
  if (leather && !m.map && m.userData.neon == null && !(m.metalness > 0.8)) {
    c.roughness = 0.42;
    c.metalness = 0.18;
  }
  if (m.userData.triScale) {
    c.onBeforeCompile = () => {};
    triplanar(c, m.userData.triScale / unit);
  }
  c.needsUpdate = true;
  return c;
}
function aimBone(bone, child, target) {
  bone.updateMatrixWorld(true);
  const b = bone.getWorldPosition(new V3()),
    c = child.getWorldPosition(new V3()),
    cur = c.sub(b),
    want = target.clone().sub(b);
  if (cur.lengthSq() < 1e-10 || want.lengthSq() < 1e-10) return;
  const dq = new THREE.Quaternion().setFromUnitVectors(cur.normalize(), want.normalize()),
    bw = bone.getWorldQuaternion(new THREE.Quaternion()),
    pw = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  bone.quaternion.copy(pw.invert().multiply(dq.multiply(bw)));
  bone.updateMatrixWorld(true);
}
function curlFingers(B, side, amt) {
  ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'].forEach(f => {
    for (let k = 1; k <= 3; k++) {
      const b = B(side + 'Hand' + f + k);
      if (!b) continue;
      const a = f === 'Thumb' ? amt * 0.45 : amt;
      b.rotateZ((side === 'Left' ? 1 : -1) * a * (k === 1 ? 0.9 : 1.1));
    }
  });
}
function riderClone(o, C, P) {
  const M = riderMats(o, C, P),
    root = THREE.SkeletonUtils.clone(RIDER_GLTF.scene),
    U = RIDER_GLTF.unit;
  const seamC = new THREE.Color(M.suit.userData.neon != null ? M.suit.userData.neon : M.suit.color).offsetHSL(
      0,
      0,
      -0.14,
    ),
    seam =
      M.suit.userData.neon != null
        ? M.suit
        : new THREE.MeshStandardMaterial({ color: seamC, roughness: 0.5, metalness: 0.15 });
  root.traverse(n => {
    if (!n.isSkinnedMesh) return;
    n.frustumCulled = false;
    n.castShadow = true;
    const nm0 = n.material.normalMap,
      part = n.userData.part;
    const mm = riderSkinMat(part === 'suit' ? M.suit : part === 'boot' ? M.boot : M.blk, U, part === 'suit');
    if (nm0 && mm.userData.neon == null && part !== 'suit') {
      mm.normalMap = nm0;
    }
    mm.side = THREE.DoubleSide;
    n.material = mm;
  });
  const B = nm => root.getObjectByName(nm) || root.getObjectByName('mixamorig' + nm);
  root.updateMatrixWorld(true);
  if (B('LeftArm').getWorldPosition(new V3()).x < 0) {
    root.rotation.y = Math.PI;
    root.updateMatrixWorld(true);
  }
  const len = (a, b) => B(a).getWorldPosition(new V3()).distanceTo(B(b).getWorldPosition(new V3())),
    thigh = len('LeftUpLeg', 'LeftLeg'),
    sc = Math.min(1.3, Math.max(0.7, 0.43 / thigh));
  root.scale.multiplyScalar(sc);
  root.updateMatrixWorld(true);
  return {
    root,
    B,
    M,
    L: {
      thigh: len('LeftUpLeg', 'LeftLeg'),
      shin: len('LeftLeg', 'LeftFoot'),
      up: len('LeftArm', 'LeftForeArm'),
      fore: len('LeftForeArm', 'LeftHand'),
    },
  };
}
/* full-face helmet built with the rider kit, fixed to the head bone so it follows the head */
function fitHelmet(R, opts = {}) {
  const { root, B, M } = R,
    head = B('Head'),
    top = B('HeadTop_End') || head;
  root.updateMatrixWorld(true);
  const hp = head.getWorldPosition(new V3()),
    tp = top.getWorldPosition(new V3()),
    up = tp.clone().sub(hp),
    hl = up.length() || 0.18;
  up.normalize();
  const fwd = new V3(0, 0, 1).applyQuaternion(root.quaternion);
  const eyes = B('LeftEye');
  if (eyes) {
    const e = eyes.getWorldPosition(new V3()).sub(hp);
    e.addScaledVector(up, -e.dot(up));
    if (e.lengthSq() > 1e-8) fwd.copy(e.normalize());
  }
  const hg = new THREE.Group();
  riderKit(hg, M).helmet(new V3(0, 0, 0), new V3(0, 1, 0), new V3(0, 0, 1), opts);
  const s = Math.min(1.08, Math.max(0.82, hl / 0.24));
  hg.scale.setScalar(s);
  const X = new V3().crossVectors(up, fwd).normalize(),
    F = new V3().crossVectors(X, up).normalize();
  hg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, up, F));
  hg.position
    .copy(hp)
    .addScaledVector(up, hl * 0.52)
    .addScaledVector(F, hl * 0.06);
  hg.updateMatrixWorld(true);
  head.attach(hg);
  return hg;
}
function buildRiderModel(rider, S, st, C, o, P, X) {
  const V = (x, y, z) => new V3(x, y, z),
    R = riderClone(o, C, P),
    { root, B, L } = R;
  const lean = S.lean,
    seatTop = S.seat[0],
    Hp = V(0, seatTop + 0.12, S.seat[1] + 0.04),
    u = V(0, Math.cos(lean), Math.sin(lean)),
    f = V(0, -Math.sin(lean), Math.cos(lean));
  const hw = B('Hips').getWorldPosition(new V3());
  root.position.add(Hp.clone().sub(hw));
  root.updateMatrixWorld(true);
  const N = Hp.clone().addScaledVector(u, 0.52);
  aimBone(B('Spine'), B('Neck'), N);
  const lookUp = Math.max(0, lean - 0.4) * 0.9,
    headT = B('Neck')
      .getWorldPosition(new V3())
      .add(V(0, 0.2, 0.04 + lookUp * 0.08));
  aimBone(B('Neck'), B('Head'), headT);
  [
    ['Left', 1],
    ['Right', -1],
  ].forEach(([sd, sx]) => {
    const hipJ = B(sd + 'UpLeg').getWorldPosition(new V3()),
      an = V(sx * 0.17, S.peg[0] + 0.1, S.peg[1] - 0.04),
      kn = ik2(hipJ, an, L.thigh, L.shin, V(sx * 0.2, 0.6, 1));
    aimBone(B(sd + 'UpLeg'), B(sd + 'Leg'), kn);
    aimBone(B(sd + 'Leg'), B(sd + 'Foot'), an);
    if (B(sd + 'ToeBase')) aimBone(B(sd + 'Foot'), B(sd + 'ToeBase'), an.clone().add(V(0, -0.07, 0.13)));
    const sh = B(sd + 'Arm').getWorldPosition(new V3()),
      gc = X.gripP(sx)
        .clone()
        .add(V(-sx * 0.05, 0, 0)),
      wr = gc.clone().add(V(-sx * 0.045, 0.03, -0.05)),
      el = ik2(sh, wr, L.up, L.fore, V(sx * 0.7, -0.45, -0.35));
    aimBone(B(sd + 'Arm'), B(sd + 'ForeArm'), el);
    aimBone(B(sd + 'ForeArm'), B(sd + 'Hand'), wr);
    const mid = B(sd + 'HandMiddle1');
    if (mid) aimBone(B(sd + 'Hand'), mid, gc.clone().add(V(sx * 0.05, -0.01, 0.05)));
    curlFingers(B, sd, 1.05);
  });
  fitHelmet(R, { mx: st === 'dirt' });
  const sets = {};
  [
    ['Left', 1],
    ['Right', -1],
  ].forEach(([sd, sx]) => {
    const bones = [sd + 'Arm', sd + 'ForeArm', sd + 'UpLeg', sd + 'Leg'].map(B),
      ride = bones.map(b => b.quaternion.clone());
    const sh = B(sd + 'Arm').getWorldPosition(new V3());
    aimBone(B(sd + 'Arm'), B(sd + 'ForeArm'), sh.clone().add(V(sx * 0.5, 0.14, 0.02)));
    aimBone(B(sd + 'ForeArm'), B(sd + 'Hand'), sh.clone().add(V(sx * 0.9, 0.24, 0.03)));
    const hip = B(sd + 'UpLeg').getWorldPosition(new V3());
    aimBone(B(sd + 'UpLeg'), B(sd + 'Leg'), hip.clone().add(V(sx * 0.36, -0.25, -0.18)));
    aimBone(B(sd + 'Leg'), B(sd + 'Foot'), hip.clone().add(V(sx * 0.62, -0.48, -0.34)));
    const trick = bones.map(b => b.quaternion.clone());
    bones.forEach((b, i) => b.quaternion.copy(ride[i]));
    sets[sx] = { bones, ride, trick };
  });
  let lastK = -1,
    lastS = 0;
  const poseTrick = (k, side) => {
    side = side < 0 ? -1 : 1;
    if (Math.abs(k - lastK) < 0.01 && side === lastS) return;
    lastK = k;
    lastS = side;
    for (const sx of [1, -1]) {
      const st2 = sets[sx],
        kk = sx === side ? k : 0;
      st2.bones.forEach((b, i) => b.quaternion.copy(st2.ride[i]).slerp(st2.trick[i], kk));
    }
  };
  let flutter = null;
  if (C.cape) {
    const cg = new THREE.PlaneGeometry(0.4, 0.85, 4, 10);
    cg.translate(0, -0.425, 0);
    const base = cg.attributes.position.array.slice();
    const cape = new THREE.Mesh(
      cg,
      new THREE.MeshStandardMaterial({
        color: C.cape,
        side: THREE.DoubleSide,
        roughness: 0.6,
        metalness: C.metal ? 0.8 : 0.1,
      }),
    );
    cape.position.copy(N).addScaledVector(f, -0.15);
    cape.rotation.x = 0.85;
    cape.castShadow = true;
    rider.add(cape);
    flutter = (t, amt) => {
      const p = cg.attributes.position.array;
      for (let i = 0; i < p.length; i += 3) {
        const d = -base[i + 1];
        p[i + 2] = base[i + 2] + Math.sin(t * 14 - d * 7 + base[i] * 4) * 0.07 * d * amt;
      }
      cg.attributes.position.needsUpdate = true;
    };
  }
  const trick = new THREE.Group();
  rider.add(trick);
  {
    const hc = B('Head')
        .getWorldPosition(new V3())
        .add(V(0, 0.08, 0)),
      add = (g, m) => {
        const e = new THREE.Mesh(g, m);
        e.castShadow = true;
        rider.add(e);
        return e;
      };
    costumeExtras(add, C, Hp.clone().addScaledVector(u, 0.3), f, u, hc);
  }
  rider.add(root);
  neonify(rider);
  envify(rider);
  return { trick, flutter, poseTrick };
}
function figureFromModel(cid, paintHex, suitHex, suitId, helmId) {
  const C = findItem('costume', cid),
    f = new THREE.Group(),
    V = (x, y, z) => new V3(x, y, z);
  const R = riderClone({ suitHex: suitHex ?? undefined, helmetHex: paintHex, suit: suitId, helmet: helmId }, C, {
      c: paintHex,
    }),
    { root, B } = R;
  root.updateMatrixWorld(true);
  const pose = up => {
    [
      ['Left', 1],
      ['Right', -1],
    ].forEach(([sd, sx]) => {
      const sh = B(sd + 'Arm').getWorldPosition(new V3());
      if (up) {
        aimBone(B(sd + 'Arm'), B(sd + 'ForeArm'), sh.clone().add(V(sx * 0.14, 0.27, 0.03)));
        aimBone(B(sd + 'ForeArm'), B(sd + 'Hand'), sh.clone().add(V(sx * 0.2, 0.55, 0.05)));
      } else {
        aimBone(B(sd + 'Arm'), B(sd + 'ForeArm'), sh.clone().add(V(sx * 0.07, -0.28, 0.0)));
        aimBone(B(sd + 'ForeArm'), B(sd + 'Hand'), sh.clone().add(V(sx * 0.1, -0.54, 0.06)));
      }
    });
  };
  const arm = ['LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm'].map(B);
  pose(true);
  const upQ = arm.map(b => b.quaternion.clone());
  pose(false);
  const downQ = arm.map(b => b.quaternion.clone());
  ['Left', 'Right'].forEach(sd => curlFingers(B, sd, 0.35));
  fitHelmet(R);
  f.add(root);
  const head = B('Head'),
    h0 = head.quaternion.clone(),
    y0 = root.position.y;
  if (C.cape) {
    const cg = new THREE.PlaneGeometry(0.5, 1.15, 4, 10);
    cg.translate(0, -0.575, 0);
    const cape = new THREE.Mesh(
      cg,
      new THREE.MeshStandardMaterial({
        color: C.cape,
        side: THREE.DoubleSide,
        roughness: 0.6,
        metalness: C.metal ? 0.8 : 0.1,
      }),
    );
    cape.position.set(0, 1.5, -0.2);
    cape.rotation.x = 0.12;
    f.add(cape);
  }
  costumeExtras(
    (g, m) => {
      const e = new THREE.Mesh(g, m);
      e.castShadow = true;
      f.add(e);
      return e;
    },
    C,
    V(0, 1.25, 0),
    V(0, 0, 1),
    V(0, 1, 0),
    head.getWorldPosition(new V3()).add(V(0, 0.08, 0)),
  );
  let k = 0;
  f.userData.tick = (t, cheer) => {
    k += ((cheer ? 1 : 0) - k) * 0.15;
    root.position.y = y0 + Math.sin(t * 2) * 0.01 + cheer * Math.max(0, Math.sin(t * 12)) * 0.12;
    arm.forEach((b, i) => {
      b.quaternion.copy(downQ[i]).slerp(upQ[i], k);
      if (k > 0.5) b.rotateX(Math.sin(t * 12 + i) * 0.08);
    });
    head.quaternion.copy(h0);
    head.rotateY(Math.sin(t * 0.7) * 0.25);
  };
  neonify(f);
  envify(f);
  return f;
}
function upgradeRiders() {
  for (const b of riderWaiting) {
    const a = b.riderArgs;
    if (!a) continue;
    while (b.rider.children.length) b.rider.remove(b.rider.children[0]);
    const R_ = buildRiderModel(b.rider, ...a);
    b.trick = R_.trick;
    b.flutter = R_.flutter;
    b.poseTrick = R_.poseTrick;
  }
  riderWaiting.clear();
  try {
    if (typeof rebuildGarageSet === 'function' && showroom) rebuildGarageSet();
  } catch (e) {}
}

export function initRiderModel() {
  riderWaiting = new Set();
}

export { RIDER_GLTF, buildRiderModel, figureFromModel, riderWaiting };
