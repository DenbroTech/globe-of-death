import * as THREE from 'three';
import { game } from '../core/state.js';
import { scene } from '../render/renderer.js';
import { netTex } from '../render/textures.js';
import { D, GY, R, V3, YAX } from '../core/constants.js';

let stand, globe, steel, RG, cageParts, base;

export function initGlobe() {
  /* ---------- globe ---------- */
  stand = new THREE.Group();
  scene.add(stand);
  globe = new THREE.Group();
  globe.position.y = GY;
  scene.add(globe);
  steel = new THREE.MeshStandardMaterial({ color: 0xcfd2d8, metalness: 0.95, roughness: 0.26, envMapIntensity: 1.3 });
  RG = R + 0.07;
  for (let lat = -75; lat <= 75; lat += 15) {
    const r = RG * Math.cos(lat * D);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, lat === 0 ? 0.06 : 0.03, 8, 120), steel);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = RG * Math.sin(lat * D);
    ring.castShadow = true;
    globe.add(ring);
  }
  for (let k = 0; k < 12; k++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(RG, 0.03, 8, 140), steel);
    ring.rotation.y = (k * Math.PI) / 12;
    ring.castShadow = true;
    globe.add(ring);
  }
  [1, -1].forEach(s => {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 24), steel);
    cap.position.y = s * (RG + 0.02);
    globe.add(cap);
  });
  globe.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(R + 0.05, 72, 36),
      new THREE.MeshStandardMaterial({
        color: 0x9aa1ab,
        metalness: 0.85,
        roughness: 0.35,
        alphaMap: netTex,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    ),
  );
  /* --- cage detail: a clamp at every crossing, a bolted equator band, a door hatch --- */
  {
    const dark = new THREE.MeshStandardMaterial({ color: 0x4a4e57, metalness: 0.9, roughness: 0.4 }),
      o = new THREE.Object3D();
    // clamps: one small collar where each hoop crosses each meridian (one draw call)
    const lats = [];
    for (let lat = -75; lat <= 75; lat += 15) lats.push(lat);
    const clamps = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 8), dark, lats.length * 24);
    let n = 0;
    lats.forEach(lat => {
      for (let k = 0; k < 24; k++) {
        const a = (k * Math.PI) / 12,
          r = RG * Math.cos(lat * D);
        o.position.set(Math.cos(a) * r, RG * Math.sin(lat * D), Math.sin(a) * r);
        o.quaternion.setFromUnitVectors(YAX, o.position.clone().normalize());
        o.updateMatrix();
        clamps.setMatrixAt(n++, o.matrix);
      }
    });
    globe.add(clamps);
    // equator: a flanged band (two flat hoops) with a ring of bolts
    for (const dy of [-0.075, 0.075]) {
      const fl = new THREE.Mesh(new THREE.TorusGeometry(RG + 0.03, 0.022, 6, 96), dark);
      fl.rotation.x = Math.PI / 2;
      fl.position.y = dy;
      globe.add(fl);
    }
    const bolts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.022, 0.022, 0.2, 6), steel, 48);
    for (let k = 0; k < 48; k++) {
      const a = (k / 48) * Math.PI * 2 + Math.PI / 48;
      o.position.set(Math.cos(a) * (RG + 0.05), 0, Math.sin(a) * (RG + 0.05));
      o.quaternion.identity();
      o.updateMatrix();
      bolts.setMatrixAt(k, o.matrix);
    }
    globe.add(bolts);
    // the riders' door: a framed hatch low on one side, with hinges and a latch
    const P = (lat, lon, rr = RG + 0.02) => new V3(Math.cos(lat * D) * Math.cos(lon * D) * rr, Math.sin(lat * D) * rr, Math.cos(lat * D) * Math.sin(lon * D) * rr),
      pts = [];
    const L0 = 75,
      L1 = 105,
      B0 = -60,
      B1 = -30; // between two meridians, two hoops
    for (let i = 0; i <= 8; i++) pts.push(P(B0, L0 + ((L1 - L0) * i) / 8));
    for (let i = 1; i <= 8; i++) pts.push(P(B0 + ((B1 - B0) * i) / 8, L1));
    for (let i = 1; i <= 8; i++) pts.push(P(B1, L1 - ((L1 - L0) * i) / 8));
    for (let i = 1; i < 8; i++) pts.push(P(B1 - ((B1 - B0) * i) / 8, L0));
    const frame = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.05), 80, 0.05, 8, true), new THREE.MeshStandardMaterial({ color: 0xd8a21a, metalness: 0.85, roughness: 0.3 }));
    globe.add(frame);
    for (const b of [-52, -38]) {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.26, 8), dark);
      h.position.copy(P(b, L0, RG + 0.07));
      h.quaternion.setFromUnitVectors(YAX, P(b + 4, L0).sub(P(b - 4, L0)).normalize());
      globe.add(h);
    }
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.12), dark);
    latch.position.copy(P(-45, L1, RG + 0.07));
    latch.lookAt(0, 0, 0);
    globe.add(latch);
  }
  cageParts = globe.children.slice();
  game.bubbleMesh = null;
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + Math.PI / 4,
      top = new V3(
        Math.cos(a) * RG * Math.cos(50 * D),
        GY - RG * Math.sin(50 * D),
        Math.sin(a) * RG * Math.cos(50 * D),
      ),
      foot = new V3(Math.cos(a) * 3.4, 0, Math.sin(a) * 3.4),
      len = top.distanceTo(foot);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, len, 10), steel);
    leg.position.copy(top).add(foot).multiplyScalar(0.5);
    leg.quaternion.setFromUnitVectors(YAX, top.clone().sub(foot).normalize());
    leg.castShadow = true;
    stand.add(leg);
  }
  base = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.09, 8, 64), steel);
  base.rotation.x = Math.PI / 2;
  base.position.y = 0.1;
  stand.add(base);
  /* --- stand detail: cradle ring, cross-braces, bolted foot plates, footlights --- */
  {
    const dark = new THREE.MeshStandardMaterial({ color: 0x3c4048, metalness: 0.9, roughness: 0.4 }),
      rod = (a, b, r, m) => {
        const e = new THREE.Mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 8), m);
        e.position.copy(a).add(b).multiplyScalar(0.5);
        e.quaternion.setFromUnitVectors(YAX, b.clone().sub(a).normalize());
        stand.add(e);
        return e;
      };
    // the ring the cage sits in
    const cr = RG * Math.cos(50 * D),
      cy = GY - RG * Math.sin(50 * D),
      cradle = new THREE.Mesh(new THREE.TorusGeometry(cr + 0.06, 0.07, 8, 64), steel);
    cradle.rotation.x = Math.PI / 2;
    cradle.position.y = cy - 0.04;
    stand.add(cradle);
    // an inner ground ring and a hoop half-way up the legs
    const mid = new THREE.Mesh(new THREE.TorusGeometry((3.4 + cr) / 2 + 0.02, 0.045, 6, 64), steel);
    mid.rotation.x = Math.PI / 2;
    mid.position.y = cy / 2;
    stand.add(mid);
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + Math.PI / 4,
        a2 = a + Math.PI / 2,
        top = t => new V3(Math.cos(t) * cr, cy, Math.sin(t) * cr),
        foot = t => new V3(Math.cos(t) * 3.4, 0.1, Math.sin(t) * 3.4);
      // X-brace between neighbouring legs
      rod(foot(a), top(a2), 0.035, dark);
      rod(foot(a2), top(a), 0.035, dark);
      // foot plate with four bolts
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.06, 8), dark);
      plate.position.set(Math.cos(a) * 3.4, 0.03, Math.sin(a) * 3.4);
      stand.add(plate);
      for (let b = 0; b < 4; b++) {
        const bo = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 6), steel);
        bo.position.set(plate.position.x + Math.cos(b * 1.57 + 0.78) * 0.25, 0.06, plate.position.z + Math.sin(b * 1.57 + 0.78) * 0.25);
        stand.add(bo);
      }
    }
    // footlights round the base ring, shining up at the cage
    const can = new THREE.CylinderGeometry(0.11, 0.08, 0.22, 10),
      lensG = new THREE.CircleGeometry(0.1, 12),
      lensM = new THREE.MeshBasicMaterial({ color: 0xfff1c8 });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2,
        p = new V3(Math.cos(a) * 3.4, 0.26, Math.sin(a) * 3.4),
        aim = new V3(0, GY, 0).sub(p).normalize(),
        c = new THREE.Mesh(can, dark),
        l = new THREE.Mesh(lensG, lensM);
      c.position.copy(p);
      c.quaternion.setFromUnitVectors(YAX, aim);
      l.position.copy(p).addScaledVector(aim, 0.112);
      l.quaternion.setFromUnitVectors(new V3(0, 0, 1), aim);
      stand.add(c, l);
    }
  }
}

export { cageParts, globe, stand };
