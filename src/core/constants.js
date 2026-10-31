import * as THREE from 'three';

const $ = s => document.querySelector(s);
const D = Math.PI / 180,
  R = 3,
  G = 9.8,
  GY = R + 1.05,
  KMH = 3.6,
  STEP = 1 / 120,
  MU = 1.1,
  HIT = 0.95,
  NEAR = 1.8,
  CLOSE = 1.35;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const V3 = THREE.Vector3,
  YAX = new V3(0, 1, 0);

export { $, D, G, GY, HIT, R, V3, YAX, clamp };
