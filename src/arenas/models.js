import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import castleTex from '../assets/models/castle/colormap.png';
import penguinObj from '../assets/models/penguin.obj?raw';
import penguinTex from '../assets/models/penguin.png';
import bearObj from '../assets/models/bear.obj?raw';
import bearTex from '../assets/models/bear.png';
import ladyObj from '../assets/models/ladybug.obj?raw';
import ladyTex from '../assets/models/ladybug.png';

/* ---------- imported 3D models ----------
   Kenney Castle Kit (CC0) as .glb, and Poly-by-Google animals (CC-BY 3.0, credited in Settings) as .obj.
   Everything is bundled into the app (the single-file build inlines them). Models load asynchronously:
   `model(name)` resolves to a fresh clone, so an arena adds a placeholder-free group and fills it in. */

const CASTLE = import.meta.glob('../assets/models/castle/*.glb', { eager: true, query: '?url', import: 'default' });
const manager = new THREE.LoadingManager();
// the Kenney .glb files point at "Textures/colormap.png": hand them the bundled texture instead
manager.setURLModifier(url => (/colormap\.png$/.test(url) ? castleTex : url));
const gltf = new GLTFLoader(manager),
  texLoader = new THREE.TextureLoader();
const cache = {};

function texture(url) {
  const t = texLoader.load(url);
  t.encoding = THREE.sRGBEncoding;
  return t;
}
/* an .obj with one texture: centred on the ground, scaled to `height` units tall */
function objModel(text, texUrl, height, matOpts = {}) {
  const o = new OBJLoader().parse(text),
    mat = new THREE.MeshStandardMaterial(Object.assign({ map: texUrl ? texture(texUrl) : null, roughness: 0.8 }, matOpts));
  o.traverse(m => m.isMesh && (m.material = mat));
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
};

function model(name) {
  if (!cache[name]) {
    if (MAKERS[name]) cache[name] = Promise.resolve(MAKERS[name]());
    else {
      const url = CASTLE[`../assets/models/castle/${name}.glb`];
      cache[name] = url
        ? gltf.loadAsync(url).then(r => {
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

export { model };
