import * as THREE from 'three';
import { scene } from '../render/renderer.js';
import { cv, floorTex, stripeTex, tex } from '../render/textures.js';

let bigtop, floor, curbT, curb, tentT, tent, roof;

export function initStage() {
  /* ---------- arena ---------- */
  bigtop = new THREE.Group();
  scene.add(bigtop);
  floor = new THREE.Mesh(
    new THREE.CircleGeometry(30, 72),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  bigtop.add(floor);
  curbT = stripeTex(48, '#b3151f', '#efe3cc');
  curb = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 9, 0.55, 96, 1, true),
    new THREE.MeshStandardMaterial({ map: curbT, roughness: 0.6, side: THREE.DoubleSide }),
  );
  curb.position.y = 0.27;
  bigtop.add(curb);
  /* the tent: red and cream canvas panels with soft fold shading, lit from within so the stripes always read */
  const canvasTex = (n, rows) => {
    const [c, x] = cv(1024, 256);
    for (let i = 0; i < n; i++) {
      const x0 = (i * 1024) / n,
        w = 1024 / n,
        g = x.createLinearGradient(x0, 0, x0 + w, 0),
        red = i % 2;
      g.addColorStop(0, red ? '#7a0f18' : '#c9b68f');
      g.addColorStop(0.5, red ? '#c41c28' : '#f3e6c8');
      g.addColorStop(1, red ? '#7a0f18' : '#c9b68f');
      x.fillStyle = g;
      x.fillRect(x0, 0, w + 1, 256);
    }
    // seams, and shade toward the ground and the eaves
    x.fillStyle = 'rgba(0,0,0,.25)';
    for (let r = 1; r < rows; r++) x.fillRect(0, (r * 256) / rows - 1, 1024, 2);
    const v = x.createLinearGradient(0, 0, 0, 256);
    v.addColorStop(0, 'rgba(0,0,0,.35)');
    v.addColorStop(0.3, 'rgba(0,0,0,0)');
    v.addColorStop(0.75, 'rgba(0,0,0,.1)');
    v.addColorStop(1, 'rgba(0,0,0,.55)');
    x.fillStyle = v;
    x.fillRect(0, 0, 1024, 256);
    return tex(c, true);
  };
  tentT = canvasTex(36, 3);
  const tentM = () => new THREE.MeshStandardMaterial({ map: tentT, side: THREE.BackSide, roughness: 1, emissive: 0xffffff, emissiveMap: tentT, emissiveIntensity: 0.22 });
  tent = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 26, 72, 1, true), tentM());
  tent.position.y = 13;
  bigtop.add(tent);
  // the roof sweeps up to the peak in a curve, like canvas hung from the king poles
  roof = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        [30, 26],
        [24, 27.6],
        [17, 30.2],
        [10, 33.6],
        [5, 36.8],
        [1.2, 39.5],
      ].map(q => new THREE.Vector2(q[0], q[1])),
      72,
    ),
    tentM(),
  );
  bigtop.add(roof);
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9a520, metalness: 0.8, roughness: 0.3 }),
    wood = new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.8 }),
    o = new THREE.Object3D(),
    col = new THREE.Color();
  // scalloped gold-and-red valance round the eaves
  {
    const sc = new THREE.CircleGeometry(1.35, 14, Math.PI, Math.PI),
      val = new THREE.InstancedMesh(sc, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.8, emissive: 0x331a00 }), 72);
    for (let k = 0; k < 72; k++) {
      const a = (k / 72) * Math.PI * 2;
      o.position.set(Math.cos(a) * 29.6, 26, Math.sin(a) * 29.6);
      o.rotation.set(0, -a + Math.PI / 2, 0);
      o.updateMatrix();
      val.setMatrixAt(k, o.matrix);
      val.setColorAt(k, col.setHex(k % 2 ? 0xd9a520 : 0xb3151f));
    }
    bigtop.add(val);
  }
  // quarter poles behind the stands holding the canvas up
  {
    const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.2, 27.5, 8), wood, 12),
      caps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.32, 10, 8), gold, 12);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + 0.13;
      o.rotation.set(0, 0, 0);
      o.position.set(Math.cos(a) * 27.5, 13.75, Math.sin(a) * 27.5);
      o.updateMatrix();
      poles.setMatrixAt(k, o.matrix);
      o.position.y = 26.4;
      o.updateMatrix();
      caps.setMatrixAt(k, o.matrix);
    }
    bigtop.add(poles, caps);
  }
  // festoon lights: strings of coloured bulbs swooping from the peak out to the eaves, and a ring round the wall
  {
    const N = 16,
      PER = 15,
      bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial(), N * PER + 96),
      cols = [0xfff0c0, 0xffd23f, 0xff5a5a, 0x7ad7ff, 0xfff0c0],
      wire = [];
    let n = 0;
    for (let s = 0; s < N; s++) {
      const a = (s / N) * Math.PI * 2;
      let last = null;
      for (let i = 0; i <= PER; i++) {
        const f = i / PER,
          r = 2 + f * 27,
          y = 37.5 - f * 12.5 - Math.sin(f * Math.PI) * 3.2,
          p = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
        if (last) wire.push(last, p);
        last = p;
        if (i === 0) continue;
        o.position.copy(p);
        o.position.y -= 0.22;
        o.updateMatrix();
        bulbs.setMatrixAt(n, o.matrix);
        bulbs.setColorAt(n++, col.setHex(cols[(i + s) % cols.length]));
      }
    }
    for (let k = 0; k < 96; k++) {
      const a = (k / 96) * Math.PI * 2;
      o.position.set(Math.cos(a) * 29.2, 24.4, Math.sin(a) * 29.2);
      o.updateMatrix();
      bulbs.setMatrixAt(n, o.matrix);
      bulbs.setColorAt(n++, col.setHex(cols[k % cols.length]));
    }
    bigtop.add(bulbs);
    bigtop.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wire), new THREE.LineBasicMaterial({ color: 0x1a1210 })));
  }
  // a lighting truss ring hung over the cage, with spot cans
  {
    const truss = new THREE.MeshStandardMaterial({ color: 0x2a2c31, metalness: 0.8, roughness: 0.45 });
    for (const [r, y] of [
      [7.2, 17],
      [7.2, 17.7],
      [6.6, 17.35],
    ]) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 6, 64), truss);
      t.rotation.x = Math.PI / 2;
      t.position.y = y;
      bigtop.add(t);
    }
    const struts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, 0.76, 5), truss, 48),
      cans = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.28, 0.6, 10), truss, 12),
      lenses = new THREE.InstancedMesh(new THREE.CircleGeometry(0.26, 12), new THREE.MeshBasicMaterial(), 12),
      lc = [0xfff1c8, 0xff7ad0, 0x7ad7ff, 0xffd23f];
    for (let k = 0; k < 48; k++) {
      const a = (k / 48) * Math.PI * 2;
      o.position.set(Math.cos(a) * 7.2, 17.35, Math.sin(a) * 7.2);
      o.rotation.set(0, 0, k % 2 ? 0.5 : -0.5);
      o.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -a + Math.PI / 2);
      o.updateMatrix();
      struts.setMatrixAt(k, o.matrix);
    }
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2,
        p = new THREE.Vector3(Math.cos(a) * 7.2, 16.5, Math.sin(a) * 7.2),
        aim = new THREE.Vector3(0, 4, 0).sub(p).normalize();
      o.position.copy(p);
      o.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), aim);
      o.updateMatrix();
      cans.setMatrixAt(k, o.matrix);
      o.position.copy(p).addScaledVector(aim, 0.31);
      o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), aim);
      o.updateMatrix();
      lenses.setMatrixAt(k, o.matrix);
      lenses.setColorAt(k, col.setHex(lc[k % 4]));
    }
    bigtop.add(struts, cans, lenses);
    // hung from the roof on four cables
    const cab = [];
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4;
      cab.push(new THREE.Vector3(Math.cos(a) * 7.2, 17.7, Math.sin(a) * 7.2), new THREE.Vector3(Math.cos(a) * 5, 36.5, Math.sin(a) * 5));
    }
    bigtop.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(cab), new THREE.LineBasicMaterial({ color: 0x222222 })));
  }
  // two lit show signs on the tent wall above the stands, each over a velvet-curtained entrance
  {
    const [c, x] = cv(512, 128);
    x.fillStyle = '#5a0a12';
    x.fillRect(0, 0, 512, 128);
    x.strokeStyle = '#ffd23f';
    x.lineWidth = 6;
    x.strokeRect(8, 8, 496, 112);
    x.fillStyle = '#ffe9a8';
    for (let i = 0; i < 30; i++) {
      for (const yy of [8, 120]) {
        x.beginPath();
        x.arc(16 + i * 16.5, yy, 3.5, 0, 7);
        x.fill();
      }
    }
    x.font = '900 62px Impact, "Arial Black", sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = '#ffd23f';
    x.fillText('GLOBE RIDERS', 256, 68);
    const signT = tex(c, true),
      signM = new THREE.MeshBasicMaterial({ map: signT }),
      velvet = new THREE.MeshStandardMaterial({ color: 0x7a0f1b, roughness: 1, side: THREE.DoubleSide, emissive: 0x2a0508 });
    for (const a of [Math.PI / 2, -Math.PI / 2]) {
      const grp = new THREE.Group();
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(13, 3.25), signM);
      sign.position.y = 18.5;
      grp.add(sign);
      // swagged curtains either side of a dark doorway
      const door = new THREE.Mesh(new THREE.PlaneGeometry(6, 9.5), new THREE.MeshBasicMaterial({ color: 0x050304 }));
      door.position.set(0, 11.6, -0.05);
      grp.add(door);
      for (const sx of [-1, 1]) {
        const sh = new THREE.Shape();
        sh.moveTo(0, 0);
        sh.lineTo(sx * 4.2, 0);
        sh.lineTo(sx * 4.2, -9.6);
        sh.lineTo(sx * 2.6, -9.6);
        sh.quadraticCurveTo(sx * 2.9, -4.5, 0, -1.2);
        const cur = new THREE.Mesh(new THREE.ShapeGeometry(sh, 10), velvet);
        cur.position.set(0, 16.4, 0.02);
        grp.add(cur);
        const tie = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.09, 6, 14), gold);
        tie.position.set(sx * 3.1, 11.4, 0.1);
        grp.add(tie);
      }
      const pelmet = new THREE.Mesh(new THREE.BoxGeometry(9, 0.5, 0.3), gold);
      pelmet.position.set(0, 16.6, 0.1);
      grp.add(pelmet);
      grp.position.set(Math.cos(a) * 29.3, 0, Math.sin(a) * 29.3);
      grp.rotation.y = -a - Math.PI / 2;
      bigtop.add(grp);
    }
  }
}

export { bigtop };
