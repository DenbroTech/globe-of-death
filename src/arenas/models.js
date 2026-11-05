import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { SkeletonUtils } from 'three/examples/jsm/utils/SkeletonUtils.js';
import pirateTex from '../assets/models/pirate/colormap.png';
import antObj from '../assets/models/ant.obj?raw';
import antTex from '../assets/models/ant.png';
import waspObj from '../assets/models/wasp.obj?raw';
import sharkObj from '../assets/models/shark.obj?raw';
import sharkTex from '../assets/models/shark.png';
import waspTex from '../assets/models/wasp.png';
import castleTex from '../assets/models/castle/colormap.png';
import penguinObj from '../assets/models/penguin.obj?raw';
import penguinTex from '../assets/models/penguin.png';
import bearObj from '../assets/models/bear.obj?raw';
import bearTex from '../assets/models/bear.png';
import ladyObj from '../assets/models/ladybug.obj?raw';
import ladyTex from '../assets/models/ladybug.png';
import heliObj from '../assets/models/heli.obj?raw';
import heliMtl from '../assets/models/heli.mtl?raw';
import planeObj from '../assets/models/plane.obj?raw';
import planeTex from '../assets/models/plane.png';
import airshipObj from '../assets/models/airship.obj?raw';
import airshipTex from '../assets/models/airship.png';
import tugObj from '../assets/models/tug.obj?raw';
import tugMtl from '../assets/models/tug.mtl?raw';
import subObj from '../assets/models/sub.obj?raw';
import subMtl from '../assets/models/sub.mtl?raw';
import octoObj from '../assets/models/octopus.obj?raw';
import octoMtl from '../assets/models/octopus.mtl?raw';
import shipUrl from '../assets/models/spaceship.glb?url';

/* ---------- imported 3D models ----------
   Kenney Castle Kit (CC0) as .glb, and Poly-by-Google animals (CC-BY 3.0, credited in Settings) as .obj.
   Everything is bundled into the app (the single-file build inlines them). Models load asynchronously:
   `model(name)` resolves to a fresh clone, so an arena adds a placeholder-free group and fills it in. */

const CASTLE = import.meta.glob('../assets/models/castle/*.glb', { eager: true, query: '?url', import: 'default' });
const PIRATE = import.meta.glob('../assets/models/pirate/*.glb', { eager: true, query: '?url', import: 'default' });
const DINO = import.meta.glob('../assets/models/dino/*.fbx', { eager: true, query: '?url', import: 'default' });
// each Kenney kit's .glb files point at "Textures/colormap.png": hand them that kit's bundled texture
const kitLoader = tex => {
  const m = new THREE.LoadingManager();
  m.setURLModifier(url => (/colormap\.png$/.test(url) ? tex : url));
  return new GLTFLoader(m);
};
const gltf = kitLoader(castleTex),
  gltfPirate = kitLoader(pirateTex),
  texLoader = new THREE.TextureLoader();
const cache = {};

function texture(url) {
  const t = texLoader.load(url);
  t.encoding = THREE.sRGBEncoding;
  return t;
}
/* the Kd colours of an .mtl file, by material name */
function mtlColours(text) {
  const out = {};
  let cur = null;
  text.split('\n').forEach(l => {
    const p = l.trim().split(/\s+/);
    if (p[0] === 'newmtl') cur = p.slice(1).join(' ');
    else if (p[0] === 'Kd' && cur) out[cur] = new THREE.Color(+p[1], +p[2], +p[3]).convertSRGBToLinear();
  });
  return out;
}
/* an .obj with one texture (or the flat colours of its .mtl): centred on the ground, scaled to `height` units tall */
function objModel(text, texUrl, height, matOpts = {}, mtl = null) {
  const o = new OBJLoader().parse(text),
    mat = new THREE.MeshStandardMaterial(Object.assign({ map: texUrl ? texture(texUrl) : null, roughness: 0.8 }, matOpts));
  if (mtl) {
    // one shared material per .mtl colour
    const cols = mtlColours(mtl),
      mats = {};
    const pick = m => {
      const c = cols[m.name] || new THREE.Color(0x888888);
      return (mats[m.name] = mats[m.name] || new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.6 }, matOpts)));
    };
    o.traverse(m => m.isMesh && (m.material = Array.isArray(m.material) ? m.material.map(pick) : pick(m.material)));
  } else o.traverse(m => m.isMesh && (m.material = mat));
  const box = new THREE.Box3().setFromObject(o),
    s = height / (box.max.y - box.min.y),
    c = box.getCenter(new THREE.Vector3());
  o.scale.setScalar(s);
  o.position.set(-c.x * s, -box.min.y * s, -c.z * s);
  const g = new THREE.Group();
  g.add(o);
  return g;
}
const MAKERS = {
  penguin: () => objModel(penguinObj, penguinTex, 1.9),
  // the black bear, re-coloured as a polar bear
  polarbear: () => objModel(bearObj, null, 3.2, { color: 0xf2efe6, roughness: 0.9 }),
  ladybug: () => objModel(ladyObj, ladyTex, 1.2, { roughness: 0.35 }),
  ant: () => objModel(antObj, antTex, 0.6, { roughness: 0.4 }),
  wasp: () => objModel(waspObj, waspTex, 0.9, { roughness: 0.4 }),
  shark: () => objModel(sharkObj, sharkTex, 0.6, { roughness: 0.45 }),
  // nose along -z; the main rotor blades are re-parented onto a pivot named "rotor" so they can spin
  heli: () => {
    const g = objModel(heliObj, null, 1.6, { metalness: 0.3, roughness: 0.45 }, heliMtl),
      o = g.children[0],
      rotor = new THREE.Group();
    rotor.name = 'rotor';
    rotor.position.set(-932.5, 236, -172.5);
    o.add(rotor);
    ['Box04_Box014', 'Box20183'].forEach(n => {
      const b = o.getObjectByName(n);
      if (b) {
        rotor.add(b);
        b.position.set(932.5, -236, 172.5);
      }
    });
    return g;
  },
  plane: () => objModel(planeObj, planeTex, 1.2, { roughness: 0.5 }),
  airship: () => objModel(airshipObj, airshipTex, 1, { roughness: 0.55 }),
  tug: () => objModel(tugObj, null, 1, { roughness: 0.55 }, tugMtl),
  sub: () => objModel(subObj, null, 1, { metalness: 0.35, roughness: 0.45 }, subMtl),
  octopus: () => objModel(octoObj, null, 1, { roughness: 0.5 }, octoMtl),
  spaceship: () =>
    new GLTFLoader().loadAsync(shipUrl).then(r => {
      r.scene.traverse(m => m.isMesh && m.material.map && (m.material.map.encoding = THREE.sRGBEncoding));
      return r.scene;
    }),
};

function model(name) {
  if (!cache[name]) {
    if (MAKERS[name]) cache[name] = Promise.resolve(MAKERS[name]());
    else {
      const cu = CASTLE[`../assets/models/castle/${name}.glb`],
        pu = PIRATE[`../assets/models/pirate/${name}.glb`],
        url = cu || pu;
      cache[name] = url
        ? (cu ? gltf : gltfPirate).loadAsync(url).then(r => {
            r.scene.traverse(m => {
              if (m.isMesh) {
                m.castShadow = m.receiveShadow = true;
                if (m.material.map) m.material.map.encoding = THREE.sRGBEncoding;
              }
            });
            return r.scene;
          })
        : Promise.reject(new Error('no model ' + name));
    }
  }
  return cache[name].then(m => m.clone());
}

/* animated dinosaurs (Quaternius, CC0): resolves to { obj, mixer, play(clipName) } — a fresh skinned copy
   with its own animation mixer; call mixer.update(dt) every frame. `length` sets its nose-to-tail size. */
const fbxCache = {};
function dino(name, length) {
  if (!fbxCache[name])
    fbxCache[name] = new FBXLoader().loadAsync(DINO[`../assets/models/dino/${name}.fbx`]).then(src => {
      // smooth the faceted low-poly look: shared normals + softer material
      src.traverse(m => {
        if (m.isMesh) {
          m.geometry.deleteAttribute('normal');
          m.geometry.computeVertexNormals();
          [].concat(m.material).forEach(x => (x.flatShading = false));
        }
      });
      return src;
    });
  return fbxCache[name].then(src => {
    const obj = SkeletonUtils.clone(src),
      wrap = new THREE.Group();
    obj.traverse(m => {
      if (m.isMesh) {
        m.frustumCulled = false; // skinned meshes move away from their bind-pose bounds
        // the FBX colours come in linear and read near-black: lift them to the intended sRGB look
        [].concat(m.material).forEach(x => {
          if (!x.userData.lifted) {
            x.color.convertLinearToSRGB();
            x.userData.lifted = true;
          }
          x.roughness = 0.75;
        });
      }
    });
    const box = new THREE.Box3().setFromObject(src),
      sz = box.getSize(new THREE.Vector3());
    obj.scale.setScalar(length / Math.max(sz.x, sz.z));
    obj.position.y = -box.min.y * obj.scale.y; // feet on the ground
    wrap.add(obj);
    const mixer = new THREE.AnimationMixer(obj),
      clips = src.animations;
    let cur = null;
    const play = key => {
      const c = clips.find(a => a.name.toLowerCase().includes(key.toLowerCase()));
      if (!c) return;
      const act = mixer.clipAction(c);
      if (cur && cur !== act) cur.fadeOut(0.3);
      act.reset().fadeIn(0.3).play();
      cur = act;
    };
    return { obj: wrap, mixer, play };
  });
}

export { dino, model };
