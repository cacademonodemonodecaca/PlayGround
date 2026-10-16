import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { attachCommon } from './entities.js';

// Modelos 3D reales (Sketchfab, licencia CC Attribution — ver *.attribution.json y README):
//  - Yan Fei (pyro)  -> "Anime School Girl (rigged)" de Sxnneh (cabello rubio, lazo rojo)
//  - Ning Mei (geo)  -> "Anime schoolgirl in uniform" de arcyaa
//  - Lan Yun (anemo) -> "Intruder and Alternate - Mandela Catalogue" de Vibapop (terror analógico)
const URLS = {
  aether: '/models/twintails.glb',
  geo: '/models/schoolgirl.glb',
  intruder: '/models/intruder.glb',
};
const TARGET_HEIGHT = 2.6;
const cache = {};   // heroKey -> { scene, animations }
const mixers = [];  // AnimationMixer activos (modelos con clips)
let loaded = false;

export function waifusReady() { return loaded; }

export async function preloadWaifus(onProgress) {
  const loader = new GLTFLoader();
  const keys = Object.keys(URLS);
  let done = 0;
  await Promise.all(keys.map(async (k) => {
    try {
      const gltf = await loader.loadAsync(URLS[k]);
      cache[k] = gltf;
    } catch (err) {
      console.warn('[waifu] no se pudo cargar ' + URLS[k] + ', se usará modelo procedural:', err?.message || err);
      cache[k] = null;
    }
    done++;
    onProgress?.(done / keys.length);
  }));
  loaded = true;
}

export function updateWaifuMixers(dt) {
  for (let i = mixers.length - 1; i >= 0; i--) {
    try { mixers[i].update(dt); } catch { mixers.splice(i, 1); }
  }
}

function normalizeScale(inner) {
  const box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());
  const h = Math.max(0.001, size.y);
  const s = TARGET_HEIGHT / h;
  inner.scale.setScalar(s);
  // re-medir con la escala para apoyar los pies en y=0
  const box2 = new THREE.Box3().setFromObject(inner);
  inner.position.y -= box2.min.y;
  inner.position.x -= (box2.min.x + box2.max.x) / 2;
  inner.position.z -= (box2.min.z + box2.max.z) / 2;
  return s;
}

function relaxArmsTPose(clone) {
  // twintails usa rig Bip001 en pose T: bajar los brazos a los costados
  const l = clone.getObjectByName('Bip001_L_UpperArm_22');
  const r = clone.getObjectByName('Bip001_R_UpperArm_90');
  if (l) l.rotation.z -= 1.05;
  if (r) r.rotation.z += 1.05;
  const lf = clone.getObjectByName('Bip001_L_Forearm_19');
  const rf = clone.getObjectByName('Bip001_R_Forearm_87');
  if (lf) lf.rotation.z -= 0.15;
  if (rf) rf.rotation.z += 0.15;
}

/** LAN YUN — Intruder analógico real + enjambre de ojos y esporas.
 *  Si el GLB falla, devuelve null y el juego usa el horror procedural. */
const INTRUDER_HEIGHT = 3.1;
const INTRUDER_YAW = 0; // ajustar si el modelo mira de espaldas
export function buildAnalogHorror(element) {
  const gltf = cache.intruder;
  if (!loaded || !gltf) return null;
  try {
    const clone = SkeletonUtils.clone(gltf.scene);
    clone.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    const inner = new THREE.Group();
    inner.add(clone);
    inner.rotation.y = INTRUDER_YAW;
    normalizeScale(inner);
    const group = new THREE.Group();
    group.add(inner);
    group.userData.inner = inner;
    // ojos extra flotando alrededor (el Intruder ya trae los suyos)
    const eyeWhiteM = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.2 });
    const pupilM = new THREE.MeshStandardMaterial({ color: 0xff1a1a, emissive: 0xff1a1a, emissiveIntensity: 2.4 });
    const orbitEyes = [];
    for (let i = 0; i < 6; i++) {
      const eg = new THREE.Group();
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), eyeWhiteM); eg.add(w);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), pupilM); p.position.z = 0.07; eg.add(p);
      group.add(eg);
      orbitEyes.push({ g: eg, r: 1.0 + (i % 3) * 0.35, h: 1.1 + (i % 4) * 0.5, sp: (0.4 + (i % 2) * 0.3) * (i % 2 ? -1 : 1), ph: i * 1.05 });
    }
    // esporas oscuras
    const N = 40;
    const pos = new Float32Array(N * 3);
    const seeds = [];
    for (let i = 0; i < N; i++) seeds.push({ a: Math.random() * 6.28, r: 0.7 + Math.random() * 1.0, h: Math.random() * 2.9, sp: 0.4 + Math.random() * 0.8 });
    const sporeGeo = new THREE.BufferGeometry();
    sporeGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const spores = new THREE.Points(sporeGeo, new THREE.PointsMaterial({ color: 0x8a2be2, size: 0.08, transparent: true, opacity: 0.8 }));
    group.add(spores);
    attachCommon(group, element, INTRUDER_HEIGHT);
    group.userData.ring.material.color.set(0x8a2be2);
    group.userData.wings.children.forEach((w) => { w.material = w.material.clone(); w.material.color.set(0x120a24); w.material.opacity = 0.96; });
    group.userData.shield.material.color.set(0x8a2be2);
    group.userData.animate = (t, moving) => {
      // balanceo inquietante + jitter analógico tipo VHS
      inner.rotation.z = Math.sin(t * 0.9) * 0.07;
      inner.position.y = (moving ? Math.abs(Math.sin(t * 7)) * 0.1 : Math.sin(t * 1.3) * 0.05) + (Math.random() - 0.5) * 0.008;
      inner.rotation.y = INTRUDER_YAW + Math.sin(t * 0.45) * 0.12;
      for (const e of orbitEyes) {
        const a = t * e.sp + e.ph;
        e.g.position.set(Math.cos(a) * e.r, e.h + Math.sin(t * 1.7 + e.ph) * 0.12, Math.sin(a) * e.r);
        e.g.lookAt(cameraPosSafe());
      }
      const arr = spores.geometry.attributes.position.array;
      for (let i = 0; i < N; i++) {
        const sd = seeds[i];
        const a = sd.a + t * sd.sp;
        arr[i * 3] = Math.cos(a) * sd.r;
        arr[i * 3 + 1] = 0.15 + ((sd.h + t * 0.3) % 2.9);
        arr[i * 3 + 2] = Math.sin(a) * sd.r;
      }
      spores.geometry.attributes.position.needsUpdate = true;
    };
    return { group, mixer: null };
  } catch (err) {
    console.warn('[horror] fallo al instanciar intruder:', err?.message || err);
    return null;
  }
}
let _camPos = null;
export function setHorrorCam(pos) { _camPos = pos; }
function cameraPosSafe() { return _camPos || new THREE.Vector3(0, 2, 10); }

/** Devuelve { group, mixer } con el modelo GLB real + accesorios, o null si no está disponible. */
export function buildWaifu(heroKey, element) {
  const gltf = cache[heroKey];
  if (!loaded || !gltf) return null;
  try {
    const clone = SkeletonUtils.clone(gltf.scene);
    clone.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.frustumCulled = false; // los skinned meshes animados no deben desaparecer por bounds
      }
    });
    if (heroKey === 'aether') relaxArmsTPose(clone);
    const inner = new THREE.Group();
    inner.add(clone);
    normalizeScale(inner);
    // Si el GLB trae clips, reproducir el primero en bucle
    let mixer = null;
    const clips = gltf.animations || [];
    const standby = THREE.AnimationClip.findByName(clips, 'Standby') || clips[0];
    if (standby) {
      mixer = new THREE.AnimationMixer(clone);
      const action = mixer.clipAction(standby, clone);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.clampWhenFinished = false;
      action.play();
      mixers.push(mixer);
    }
    const group = new THREE.Group();
    group.add(inner);
    group.userData.inner = inner;
    group.userData.mixer = mixer;
    attachCommon(group, element, TARGET_HEIGHT);
    // animación procedural sutil para los modelos estáticos (los animados ya se mueven por mixer)
    if (!mixer) {
      group.userData.animate = (t, moving) => {
        inner.position.y = (moving ? Math.abs(Math.sin(t * 9)) * 0.06 : Math.sin(t * 2) * 0.02);
        inner.rotation.y = moving ? Math.sin(t * 9) * 0.03 : 0;
      };
    }
    return { group, mixer };
  } catch (err) {
    console.warn('[waifu] fallo al instanciar ' + heroKey + ':', err?.message || err);
    return null;
  }
}
