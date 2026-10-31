import * as THREE from 'three';
import { scene } from '../render/renderer.js';
import { floorTex, stripeTex } from '../render/textures.js';

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
  tentT = stripeTex(36, '#3d0b12', '#1d1517');
  tent = new THREE.Mesh(
    new THREE.CylinderGeometry(30, 30, 26, 72, 1, true),
    new THREE.MeshStandardMaterial({ map: tentT, side: THREE.BackSide, roughness: 1 }),
  );
  tent.position.y = 13;
  bigtop.add(tent);
  roof = new THREE.Mesh(
    new THREE.ConeGeometry(30, 12, 72, 1, true),
    new THREE.MeshStandardMaterial({ map: tentT, side: THREE.BackSide, roughness: 1 }),
  );
  roof.position.y = 32;
  bigtop.add(roof);
}

export { bigtop };
