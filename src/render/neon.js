import * as THREE from 'three';

let NOGLOW;

/* ---------- neon: a real glow halo around anything painted neon ---------- */
const NEON_T = { value: 0 };
function glowShellMat(col, inflate, strength, front, skinned) {
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    skinning: !!skinned,
    uniforms: { uC: { value: new THREE.Color(col) }, uS: { value: strength }, uI: { value: inflate }, uT: NEON_T },
    vertexShader: `#include <common>\n#include <skinning_pars_vertex>\n#include <logdepthbuf_pars_vertex>\nuniform float uI;varying vec3 vN;varying vec3 vV;void main(){\n#include <beginnormal_vertex>\n#include <skinbase_vertex>\n#include <skinnormal_vertex>\nvec3 transformed=position+normal*uI;\n#include <skinning_vertex>\nvec4 mv=modelViewMatrix*vec4(transformed,1.);vN=normalize(normalMatrix*objectNormal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;\n#include <logdepthbuf_vertex>\n}`,
    fragmentShader: `#include <common>\n#include <logdepthbuf_pars_fragment>\nuniform vec3 uC;uniform float uS;uniform float uT;varying vec3 vN;varying vec3 vV;void main(){\n#include <logdepthbuf_fragment>\nfloat d=abs(dot(normalize(vN),normalize(vV)));float a=${front ? 'pow(1.-d,1.4)' : 'pow(d,2.2)'};float fl=.78+.22*sin(uT*3.1)+.06*sin(uT*17.)*sin(uT*7.3);gl_FragColor=vec4(uC*a*uS*fl,1.);}`,
  });
  return m;
}
function neonify(root) {
  const add = [];
  root.traverse(o => {
    if (!o.isMesh || o.userData.glow || o.userData.neonDone) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    if (ms.some(m => m && m.userData && m.userData.neon != null)) add.push(o);
  });
  add.forEach(o => {
    o.userData.neonDone = true;
    const arr = Array.isArray(o.material),
      ms = arr ? o.material : [o.material];
    let k = 1;
    if (o.isSkinnedMesh) {
      o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox,
        hh = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z);
      k = hh / 1.85;
    }
    [
      [0.006, 2.4, true],
      [0.02, 0.45, false],
      [0.05, 0.3, false],
      [0.09, 0.19, false],
      [0.14, 0.1, false],
    ].forEach(([inf, s, fr]) => {
      const mats = ms.map(m =>
        m && m.userData && m.userData.neon != null
          ? glowShellMat(m.userData.neon, inf * k, s, fr, o.isSkinnedMesh)
          : NOGLOW,
      );
      let sh;
      if (o.isSkinnedMesh) {
        sh = new THREE.SkinnedMesh(o.geometry, arr ? mats : mats[0]);
        sh.bind(o.skeleton, o.bindMatrix);
        sh.bindMode = o.bindMode;
        o.parent.add(sh);
        sh.position.copy(o.position);
        sh.quaternion.copy(o.quaternion);
        sh.scale.copy(o.scale);
      } else {
        sh = new THREE.Mesh(o.geometry, arr ? mats : mats[0]);
        o.add(sh);
      }
      sh.userData.glow = true;
      sh.renderOrder = 5;
      sh.frustumCulled = false;
    });
  });
}

export function initNeon() {
  NOGLOW = new THREE.MeshBasicMaterial({ visible: false });
}

export { NEON_T, neonify };
