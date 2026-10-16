import * as THREE from 'three';
import { HEROES } from './config.js';
import { buildWaifu, buildAnalogHorror } from './waifuModels.js';

let UID = 1;
export const dmgAfterArmor = (raw, armor) => raw * (100 / (100 + Math.max(0, armor)));

export function makeNameSprite(text, color = '#ffffff') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 30px sans-serif'; g.textAlign = 'center';
  g.shadowColor = '#000'; g.shadowBlur = 6;
  g.fillStyle = color; g.fillText(text.slice(0, 16), 128, 42);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(5, 1.25, 1);
  return s;
}

/** Accesorios comunes de héroe: anillo elemental, alas planeadoras, escudo y gema.
 *  Se reutilizan tanto en el modelo procedural como en los GLB reales. */
export function attachCommon(grp, element, height = 2.6) {
  const ringColor = element === 'pyro' ? 0xff7b00 : element === 'anemo' ? 0x4de8c2 : 0xd8b45a;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.8, 24), new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; grp.add(ring);
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.92, side: THREE.DoubleSide, roughness: 0.5 });
  const wings = new THREE.Group();
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.0), wingMat);
    w.position.set(s * 0.95, height * 0.77, -0.4); w.rotation.y = s * 0.5; wings.add(w);
  }
  wings.visible = false; grp.add(wings);
  const shield = new THREE.Mesh(new THREE.SphereGeometry(height * 0.48, 14, 12), new THREE.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.26 }));
  shield.position.y = height * 0.54; shield.visible = false; grp.add(shield);
  const gemCol = element === 'pyro' ? 0xff4400 : element === 'anemo' ? 0x4de8c2 : 0xffd76a;
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), new THREE.MeshStandardMaterial({
    color: gemCol, emissive: gemCol, emissiveIntensity: 0.9, roughness: 0.2
  }));
  gem.position.set(0, height * 0.68, 0.24); grp.add(gem);
  grp.userData.ring = ring; grp.userData.wings = wings; grp.userData.shield = shield; grp.userData.gem = gem;
  return { ring, wings, shield, gem };
}

export function makeHeroMesh(colorHex, element, heroKey = 'aether') {
  const def = HEROES[heroKey] || { hair: 0x2b1a12, dress: colorHex, accent: 0xffffff, hairLong: true };
  const grp = new THREE.Group();
  // PBR materials — look "realista" con luz suave
  const skin = new THREE.MeshStandardMaterial({ color: 0xffd9b8, roughness: 0.55, metalness: 0.02 });
  const hairM = new THREE.MeshStandardMaterial({ color: def.hair, roughness: 0.35, metalness: 0.15 });
  const dressM = new THREE.MeshStandardMaterial({ color: def.dress, roughness: 0.6, metalness: 0.08 });
  const accentM = new THREE.MeshStandardMaterial({ color: def.accent, roughness: 0.4, metalness: 0.3, emissive: def.accent, emissiveIntensity: 0.15 });
  const darkM = new THREE.MeshStandardMaterial({ color: 0x2a2438, roughness: 0.7 });
  const sockM = new THREE.MeshStandardMaterial({ color: 0xf5f0ff, roughness: 0.7 });
  const shoeM = new THREE.MeshStandardMaterial({ color: element === 'pyro' ? 0x7a1f1f : 0x223344, roughness: 0.4, metalness: 0.2 });

  const add = (mesh, x = 0, y = 0, z = 0) => { mesh.position.set(x, y, z); mesh.castShadow = true; grp.add(mesh); return mesh; };

  // ---- piernas femeninas: muslos + medias altas + zapatos ----
  for (const s of [-1, 1]) {
    const thigh = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.32, 4, 10), skin), s * 0.18, 0.62, 0);
    thigh.scale.set(1, 1, 0.9);
    add(new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.42, 4, 10), sockM), s * 0.18, 0.28, 0.02);
    const shoe = add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.34), shoeM), s * 0.18, 0.06, 0.06);
    shoe.userData.leg = s;
    grp.userData['leg' + (s < 0 ? 'L' : 'R')] = shoe;
  }
  // ---- falda estilo qipao / vestido ----
  const skirt = add(new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.75, 12, 1, true), dressM), 0, 1.0, 0);
  skirt.material.side = THREE.DoubleSide;
  const skirtTrim = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.045, 8, 18), accentM);
  skirtTrim.rotation.x = Math.PI / 2; skirtTrim.position.y = 0.64; grp.add(skirtTrim);
  // ---- torso femenino: qipao ajustado ----
  const torso = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.5, 6, 12), dressM), 0, 1.62, 0);
  torso.scale.set(1.15, 1, 0.82);
  // cinturón obi + lazo
  const obi = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.31, 0.16, 12), accentM);
  obi.position.set(0, 1.38, 0); grp.add(obi);
  const bowKnot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), accentM);
  bowKnot.position.set(0, 1.38, -0.3); grp.add(bowKnot);
  for (const s of [-1, 1]) {
    const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.4), accentM);
    tail.position.set(s * 0.1, 1.15, -0.33); tail.rotation.x = 0.25; tail.material.side = THREE.DoubleSide; grp.add(tail);
  }
  // cuello + clavícula
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.16, 10), skin), 0, 2.02, 0);
  // ---- brazos delgados con mangas separadas ----
  const arms = [];
  for (const s of [-1, 1]) {
    const sleeve = add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.3, 8), dressM), s * 0.36, 1.82, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.4, 4, 8), skin);
    arm.position.set(s * 0.42, 1.5, 0.05); arm.castShadow = true; grp.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), skin);
    hand.position.set(s * 0.42, 1.22, 0.08); grp.add(hand);
    arms.push(arm);
  }
  grp.userData.arms = arms;
  // ---- cabeza anime: cara + ojos grandes + rubor ----
  const head = add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 16), skin), 0, 2.32, 0);
  head.scale.set(0.92, 1.05, 0.95);
  // ojos (blanco + iris + brillo)
  for (const s of [-1, 1]) {
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }));
    white.position.set(s * 0.11, 2.33, 0.25); white.scale.set(1, 1.35, 0.5); grp.add(white);
    const irisCol = element === 'pyro' ? 0xb03010 : element === 'anemo' ? 0x1f8f7a : 0x8a6d1f;
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), new THREE.MeshStandardMaterial({ color: irisCol, roughness: 0.15, emissive: irisCol, emissiveIntensity: 0.35 }));
    iris.position.set(s * 0.11, 2.32, 0.3); iris.scale.set(1, 1.3, 0.4); grp.add(iris);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    shine.position.set(s * 0.10, 2.35, 0.33); grp.add(shine);
    // pestañas
    const lash = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.02), darkM);
    lash.position.set(s * 0.11, 2.40, 0.27); lash.rotation.z = s * -0.25; grp.add(lash);
    // rubor
    const blush = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff9aa8, transparent: true, opacity: 0.55, roughness: 1 }));
    blush.position.set(s * 0.19, 2.26, 0.20); blush.scale.set(1, 0.6, 0.4); grp.add(blush);
  }
  // cejas finas
  for (const s of [-1, 1]) {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.018, 0.02), hairM);
    brow.position.set(s * 0.11, 2.46, 0.26); brow.rotation.z = s * -0.12; grp.add(brow);
  }
  // boca pequeña
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.018, 0.01), new THREE.MeshStandardMaterial({ color: 0xc25a6a }));
  mouth.position.set(0, 2.20, 0.28); grp.add(mouth);

  // ---- cabello estilo chino: flequillo + mechones + coleta ----
  const bangsZ = 0.18;
  for (let i = -2; i <= 2; i++) {
    const bang = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.3 + (i % 2) * 0.06, 6), hairM);
    bang.position.set(i * 0.09, 2.52, bangsZ + 0.1);
    bang.rotation.x = 0.35; bang.rotation.z = i * -0.08;
    bang.castShadow = true; grp.add(bang);
  }
  // casco superior
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.325, 16, 12, 0, Math.PI * 2, 0, 1.5), hairM);
  cap.position.set(0, 2.36, -0.03); cap.castShadow = true; grp.add(cap);
  // mechones laterales (hime)
  const locks = [];
  for (const s of [-1, 1]) {
    const lock = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, def.hairLong ? 0.65 : 0.3, 4, 8), hairM);
    lock.position.set(s * 0.30, def.hairLong ? 2.05 : 2.2, 0.05);
    lock.rotation.z = s * 0.08; lock.castShadow = true; grp.add(lock);
    locks.push(lock);
  }
  // cabello trasero largo
  let backHair = null;
  if (def.hairLong) {
    backHair = new THREE.Mesh(new THREE.CapsuleGeometry(0.20, 0.85, 6, 10), hairM);
    backHair.position.set(0, 1.95, -0.28); backHair.rotation.x = 0.12;
    backHair.castShadow = true; grp.add(backHair);
    // coletas gemelas para pyro / coleta alta geo
    if (element === 'pyro') {
      for (const s of [-1, 1]) {
        const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.7, 4, 8), hairM);
        tail.position.set(s * 0.38, 1.9, -0.15); tail.rotation.z = s * 0.35;
        tail.castShadow = true; grp.add(tail);
        locks.push(tail);
        const tie = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 6, 10), accentM);
        tie.position.set(s * 0.30, 2.35, -0.08); tie.rotation.x = 0.4; grp.add(tie);
      }
    } else {
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 6, 12), accentM);
      tie.position.set(0, 2.5, -0.2); tie.rotation.x = 0.5; grp.add(tie);
    }
  } else {
    // moño + horquilla para anemo
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), hairM);
    bun.position.set(0, 2.62, -0.12); bun.castShadow = true; grp.add(bun);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6), accentM);
    pin.position.set(0, 2.62, -0.12); pin.rotation.z = 1.1; grp.add(pin);
    const flower = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff7eb0, emissive: 0xff7eb0, emissiveIntensity: 0.4 }));
    flower.position.set(0.22, 2.55, 0.1); grp.add(flower);
  }
  // ahoge
  const ahoge = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 10, Math.PI * 1.5), hairM);
  ahoge.position.set(0.03, 2.72, 0); ahoge.rotation.z = -0.6; grp.add(ahoge);

  // ---- arma según elemento ----
  if (element === 'anemo') {
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 8, 16, Math.PI * 1.5), new THREE.MeshStandardMaterial({ color: 0x9ff5e4, emissive: 0x4de8c2, emissiveIntensity: 0.5, roughness: 0.3 }));
    bow.position.set(0.55, 1.5, 0.15); bow.rotation.z = 0.5; grp.add(bow);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.0, 4), darkM);
    string.position.set(0.42, 1.5, 0.15); string.rotation.z = 0.5; grp.add(string);
  } else {
    const bladeM = new THREE.MeshStandardMaterial({ color: 0xf2f6ff, metalness: 0.85, roughness: 0.25, emissive: colorHex, emissiveIntensity: 0.25 });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.5, 0.2), bladeM);
    blade.position.set(0.58, 1.45, 0.25); blade.rotation.z = -0.2; blade.castShadow = true; grp.add(blade);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.26), accentM);
    guard.position.set(0.5, 0.72, 0.22); grp.add(guard);
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.3, 8), darkM);
    hilt.position.set(0.48, 0.55, 0.22); grp.add(hilt);
  }
  // accesorios compartidos con los modelos GLB reales
  const { gem } = attachCommon(grp, element, 2.6);

  // animación idle/caminar: balanceo de falda, cabello y brazos
  grp.userData.animate = (t, moving) => {
    const sway = moving ? Math.sin(t * 10) * 0.12 : Math.sin(t * 2) * 0.04;
    skirt.rotation.y = sway * 0.5;
    if (backHair) { backHair.rotation.x = 0.12 + (moving ? Math.sin(t * 10) * 0.08 : Math.sin(t * 2) * 0.03); }
    locks.forEach((l, i) => { l.rotation.x = moving ? Math.sin(t * 10 + i) * 0.15 : Math.sin(t * 2 + i) * 0.05; });
    arms.forEach((a, i) => { a.rotation.x = moving ? Math.sin(t * 10 + i * Math.PI) * 0.5 : Math.sin(t * 2 + i) * 0.08; });
    gem.rotation.y = t * 2;
    ahoge.rotation.z = -0.6 + Math.sin(t * 3) * 0.15;
  };
  return grp;
}

/** LAN YUN — horror fuera de la comprensión humana.
 *  Masa abisal flotante: tentáculos ondulantes, corona de cuernos, ojos que parpadean,
 *  fauces dentadas, fragmentos orbitales y aura de esporas oscuras. Todo procedural animado. */
export function makeHorrorMesh() {
  const HEIGHT = 3.2;
  const grp = new THREE.Group();
  const inner = new THREE.Group();
  inner.position.y = 0.85;
  grp.add(inner);
  grp.userData.inner = inner;

  const fleshM = new THREE.MeshStandardMaterial({ color: 0x150b22, roughness: 0.32, metalness: 0.45, emissive: 0x2a0a55, emissiveIntensity: 0.5 });
  const fleshDark = new THREE.MeshStandardMaterial({ color: 0x0a0512, roughness: 0.45, metalness: 0.3, emissive: 0x1a0530, emissiveIntensity: 0.6 });
  const boneM = new THREE.MeshStandardMaterial({ color: 0xcfc3a8, roughness: 0.55, metalness: 0.05 });
  const eyeWhiteM = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.15, metalness: 0 });
  const pupilM = new THREE.MeshStandardMaterial({ color: 0xff1a1a, emissive: 0xff1a1a, emissiveIntensity: 2.2, roughness: 0.2 });
  const mawGlowM = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff2200, emissiveIntensity: 1.4, roughness: 0.4 });
  const add = (parent, mesh, x = 0, y = 0, z = 0) => { mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh; };

  // ---- masa central: tres lóbulos apilados ----
  const lobe1 = add(inner, new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 16), fleshM), 0, 1.15, 0);
  lobe1.scale.set(1, 1.15, 0.9);
  const lobe2 = add(inner, new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 14), fleshDark), 0.12, 0.55, 0.08);
  lobe2.scale.set(1.1, 0.9, 1);
  add(inner, new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), fleshM), -0.1, 1.85, -0.05);

  // ---- corona de cuernos ----
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const horn = add(inner, new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.75 + (i % 3) * 0.2, 7), boneM),
      Math.cos(a) * 0.42, 2.25, Math.sin(a) * 0.42);
    horn.rotation.set(Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55);
  }

  // ---- ojos: uno central grande + enjambre ----
  const eyes = [];
  const mkEye = (parent, x, y, z, r) => {
    const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
    const w = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), eyeWhiteM); g.add(w);
    const p = new THREE.Mesh(new THREE.SphereGeometry(r * 0.45, 10, 8), pupilM); p.position.z = r * 0.72; g.add(p);
    eyes.push({ g, phase: Math.random() * 6.28 });
    return g;
  };
  mkEye(inner, 0, 1.35, 0.5, 0.17);
  const swarmPos = [[-0.35, 1.0, 0.4], [0.4, 1.05, 0.35], [-0.2, 1.7, 0.3], [0.28, 1.75, 0.22], [-0.45, 0.6, 0.25], [0.45, 0.62, 0.2], [0, 0.9, -0.5], [-0.3, 1.4, -0.4]];
  for (const [x, y, z] of swarmPos) mkEye(inner, x, y, z, 0.07 + Math.random() * 0.035);
  grp.userData.eyes = eyes;

  // ---- fauces dentadas ----
  const maw = new THREE.Group(); maw.position.set(0, 0.95, 0.42); inner.add(maw);
  const mawDark = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 1 }));
  mawDark.scale.set(1.25, 0.7, 0.6); maw.add(mawDark);
  const mawGlow = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), mawGlowM);
  mawGlow.scale.set(1.1, 0.5, 0.5); mawGlow.position.z = 0.05; maw.add(mawGlow);
  for (let i = 0; i < 9; i++) {
    const a = (i / 8 - 0.5) * Math.PI * 1.1;
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 5), boneM);
    tooth.position.set(Math.sin(a) * 0.26, 0.1 + Math.cos(a) * 0.1, 0.12);
    tooth.rotation.z = -a; tooth.rotation.x = Math.PI; maw.add(tooth);
  }
  grp.userData.maw = maw;

  // ---- tentáculos: 8 cadenas de 3 segmentos ----
  const tentacles = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const root = new THREE.Group();
    root.position.set(Math.cos(a) * 0.4, 0.45, Math.sin(a) * 0.4);
    root.rotation.y = -a + Math.PI / 2;
    inner.add(root);
    let parent = root;
    const joints = [];
    for (let s = 0; s < 3; s++) {
      const j = new THREE.Group();
      j.position.y = s === 0 ? 0 : -0.42;
      parent.add(j);
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.13 - s * 0.035, 0.16 - s * 0.035, 0.46, 8), s % 2 ? fleshDark : fleshM);
      seg.position.y = -0.21; seg.castShadow = true; j.add(seg);
      joints.push(j); parent = j;
    }
    if (i % 3 === 0) mkEye(parent, 0, -0.5, 0.08, 0.075);
    else {
      const sting = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 6), boneM);
      sting.position.y = -0.55; sting.rotation.x = Math.PI; parent.add(sting);
    }
    root.rotation.x = 0.5;
    tentacles.push({ root, joints, phase: (i / 8) * Math.PI * 2 });
  }
  grp.userData.tentacles = tentacles;

  // ---- zarcillos colgantes ----
  const danglers = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    const d = add(inner, new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.9 + (i % 2) * 0.4, 6), fleshDark),
      Math.cos(a) * 0.3, -0.15, Math.sin(a) * 0.3);
    d.rotation.x = Math.PI;
    danglers.push({ m: d, phase: i * 1.3 });
  }
  grp.userData.danglers = danglers;

  // ---- fragmentos orbitales ----
  const shards = [];
  const shardM = new THREE.MeshStandardMaterial({ color: 0x241533, roughness: 0.4, metalness: 0.5, emissive: 0x6a1aff, emissiveIntensity: 0.7 });
  for (let i = 0; i < 5; i++) {
    const sh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.11 + (i % 2) * 0.05), shardM);
    sh.castShadow = true; grp.add(sh);
    shards.push({ m: sh, r: 1.1 + (i % 3) * 0.3, h: 0.8 + (i % 4) * 0.45, sp: 0.5 + (i % 2) * 0.35, ph: i * 1.26 });
  }
  grp.userData.shards = shards;

  // ---- esporas oscuras en espiral ----
  const N = 46;
  const pos = new Float32Array(N * 3);
  const seeds = [];
  for (let i = 0; i < N; i++) seeds.push({ a: Math.random() * 6.28, r: 0.7 + Math.random() * 1.1, h: Math.random() * 2.8, sp: 0.4 + Math.random() * 0.8 });
  const sporeGeo = new THREE.BufferGeometry();
  sporeGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const spores = new THREE.Points(sporeGeo, new THREE.PointsMaterial({ color: 0xb44dff, size: 0.09, transparent: true, opacity: 0.85 }));
  grp.add(spores);
  grp.userData.spores = { pts: spores, seeds, N };

  // ---- accesorios héroe teñidos de horror ----
  attachCommon(grp, 'anemo', HEIGHT);
  grp.userData.ring.material.color.set(0xb44dff);
  grp.userData.wings.children.forEach((w) => { w.material = w.material.clone(); w.material.color.set(0x1c0b33); w.material.opacity = 0.96; });
  grp.userData.shield.material.color.set(0x8a2be2);

  grp.userData.animate = (t, moving) => {
    inner.position.y = 0.85 + Math.sin(t * 1.7) * 0.14 + (moving ? Math.abs(Math.sin(t * 6)) * 0.08 : 0);
    inner.rotation.y = Math.sin(t * 0.6) * 0.18;
    for (const tn of tentacles) {
      tn.root.rotation.x = 0.5 + Math.sin(t * 1.8 + tn.phase) * 0.22;
      tn.joints.forEach((j, s) => {
        j.rotation.x = Math.sin(t * 2.4 + tn.phase + s * 0.9) * (0.3 + s * 0.12);
        j.rotation.z = Math.cos(t * 1.9 + tn.phase * 1.7 + s) * 0.25;
      });
    }
    for (const d of danglers) d.m.rotation.z = Math.sin(t * 2 + d.phase) * 0.2;
    for (const e of eyes) {
      const blink = (Math.sin(t * 0.9 + e.phase * 3) > 0.985) ? 0.12 : 1;
      e.g.scale.y = blink;
    }
    const mPulse = 1 + Math.sin(t * 3.1) * 0.12;
    maw.scale.set(mPulse, 1 / mPulse, 1);
    for (const s of shards) {
      const a = t * s.sp + s.ph;
      s.m.position.set(Math.cos(a) * s.r, s.h + Math.sin(t * 2 + s.ph) * 0.15, Math.sin(a) * s.r);
      s.m.rotation.x += 0.02; s.m.rotation.y += 0.03;
    }
    const attr = grp.userData.spores;
    const arr = attr.pts.geometry.attributes.position.array;
    for (let i = 0; i < attr.N; i++) {
      const sd = attr.seeds[i];
      const a = sd.a + t * sd.sp;
      arr[i * 3] = Math.cos(a) * sd.r;
      arr[i * 3 + 1] = 0.2 + ((sd.h + t * 0.35) % 2.8);
      arr[i * 3 + 2] = Math.sin(a) * sd.r;
    }
    attr.pts.geometry.attributes.position.needsUpdate = true;
  };
  return grp;
}

export function attachBars(grp, width = 2.6, y = 3.3) {  const bg = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.28), new THREE.MeshBasicMaterial({ color: 0x111111, depthTest: false, transparent: true }));
  bg.position.y = y; grp.add(bg);
  const fg = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.2), new THREE.MeshBasicMaterial({ color: 0x3ddc5f, depthTest: false, transparent: true }));
  fg.position.set(0, y, 0.01); fg.position.y = y; grp.add(fg);
  // render on top
  bg.renderOrder = 10; fg.renderOrder = 11;
  return { bg, fg, width };
}

export class Hero {
  constructor(scene, team, heroKey, opts = {}) {
    this.id = UID++;
    this.team = team; this.heroKey = heroKey;
    const base = HEROES[heroKey];
    this.base = base;
    this.name = opts.name || base.name;
    this.isPlayer = !!opts.isPlayer;
    this.lane = opts.lane || 'mid';
    this.scene = scene;
    this.level = 1; this.xp = 0; this.gold = 475;
    this.kills = 0; this.deaths = 0; this.assists = 0;
    this.items = { ad: 0, ap: 0, hp: 0, armor: 0, speed: 0 };
    this.maxHp = base.hp; this.hp = base.hp;
    this.maxMp = base.mp; this.mp = base.mp;
    this.ad = base.ad; this.ap = base.ap; this.armor = base.armor; this.speed = base.speed; this.range = base.range;
    this.pos = new THREE.Vector3(opts.x || 0, 0, opts.z || 0);
    this.vel = new THREE.Vector3();
    this.vy = 0; this.grounded = true; this.gliding = false;
    this.stamina = 100;
    this.cd = { q: 0, w: 0, e: 0, r: 0 };
    this.shield = 0; this.shieldT = 0;
    this.burnT = 0; this.swirlT = 0;
    this.alive = true; this.respawnT = 0;
    this.attackT = 0;
    this.ai = { state: 'push', wpIndex: 1, retreatHp: 0.3, wanderT: 0, tx: 0, tz: 0 };
    this.moveTarget = null; // right-click destination
    this.hasAK = false;
    // Modelo: Lan Yun es el Intruder analógico (fallback: horror procedural); resto GLB/procedural
    if (this.heroKey === 'anemo') {
      this.mesh = (buildAnalogHorror(base.element) || { group: makeHorrorMesh() }).group;
      this.mixer = null;
    } else {
      const waifu = buildWaifu(this.heroKey, base.element);
      if (waifu) {
        this.mesh = waifu.group;
        this.mixer = waifu.mixer;
      } else {
        this.mesh = makeHeroMesh(base.color, base.element, this.heroKey);
        this.mixer = null;
      }
    }
    this.mesh.position.copy(this.pos);
    scene.add(this.mesh);
    this.bars = attachBars(this.mesh);
    this.label = makeNameSprite(this.isPlayer ? 'YOU • ' + this.name : this.name, team === 'blue' ? '#7ec8ff' : '#ff9a9a');
    this.label.position.y = 3.9; this.mesh.add(this.label);
    this.recalc();
    this.hp = this.maxHp;
  }
  recalc() {
    const b = this.base, L = this.level - 1;
    this.maxHp = b.hp + L * 95 + this.items.hp;
    this.maxMp = b.mp + L * 25;
    this.ad = b.ad + L * 6 + this.items.ad;
    this.ap = b.ap + L * 8 + this.items.ap;
    this.armor = b.armor + L * 3 + (this.items.armor || 0);
    this.speed = b.speed * (1 + (this.items.speed || 0));
  }
  xpNeed() { return 150 + this.level * 90; }
  gainXp(v) {
    if (!this.alive || this.level >= 18) return;
    this.xp += v;
    let need = this.xpNeed();
    while (this.xp >= need && this.level < 18) {
      this.xp -= need; this.level++;
      this.recalc();
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.25);
      this.mp = Math.min(this.maxMp, this.mp + 60);
      need = this.xpNeed();
    }
  }
  heal(v) { if (this.alive) this.hp = Math.min(this.maxHp, this.hp + v); }
  takeDamage(raw, from) {
    if (!this.alive) return 0;
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, raw);
      this.shield -= absorbed; raw -= absorbed;
      if (this.shield <= 0) this.mesh.userData.shield.visible = false;
    }
    const dmg = dmgAfterArmor(raw, this.armor);
    this.hp -= dmg;
    if (this.hp <= 0) { this.hp = 0; this.die(from); }
    return dmg;
  }
  die(from) {
    this.alive = false;
    this.deaths++;
    this.respawnT = 6 + this.level * 1.2;
    this.mesh.visible = false;
    if (from && from.gainXp) { from.gainXp(120 + this.level * 20); from.gold += 300; from.kills++; }
  }
  respawn(x, z) {
    this.alive = true; this.hp = this.maxHp; this.mp = this.maxMp;
    this.pos.set(x, 0, z); this.vy = 0;
    this.mesh.visible = true; this.mesh.position.copy(this.pos);
  }
  updateBars() {
    const f = Math.max(0, this.hp / this.maxHp);
    this.bars.fg.scale.x = Math.max(0.001, f);
    this.bars.fg.material.color.set(f > 0.5 ? 0x3ddc5f : f > 0.25 ? 0xffb300 : 0xff4444);
  }
}

// Geometrías/materiales compartidos de minions (menos basura para la GPU)
const MGEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  helm: new THREE.SphereGeometry(0.24, 14, 10),
  pauldron: new THREE.SphereGeometry(0.14, 10, 8),
  limb: new THREE.CapsuleGeometry(0.08, 0.34, 3, 6),
  shaft: new THREE.CylinderGeometry(0.045, 0.045, 1.7, 6),
  tip: new THREE.ConeGeometry(0.09, 0.35, 6),
  shield: new THREE.BoxGeometry(0.12, 0.7, 0.5),
  boss: new THREE.SphereGeometry(0.1, 8, 6),
  robe: new THREE.ConeGeometry(0.44, 1.35, 9),
  hood: new THREE.SphereGeometry(0.26, 14, 10),
  face: new THREE.SphereGeometry(0.16, 10, 8),
  orb: new THREE.SphereGeometry(0.13, 12, 10),
};
const MMAT = {};
function minionMats(team) {
  if (!MMAT[team]) {
    const blue = team === 'blue';
    MMAT[team] = {
      armor: new THREE.MeshStandardMaterial({ color: blue ? 0x4a6fa5 : 0x8a4438, roughness: 0.45, metalness: 0.65 }),
      trim: new THREE.MeshStandardMaterial({ color: blue ? 0xd8b45a : 0x2b2b33, roughness: 0.35, metalness: 0.7 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.8 }),
      plume: new THREE.MeshStandardMaterial({ color: blue ? 0x3d7bff : 0xff3b30, roughness: 0.7 }),
      glow: new THREE.MeshStandardMaterial({ color: blue ? 0x7ec8ff : 0xff6a5e, emissive: blue ? 0x2f6fd0 : 0xd03a3a, emissiveIntensity: 1.6 }),
      robe: new THREE.MeshStandardMaterial({ color: blue ? 0x2c3a6e : 0x5e2430, roughness: 0.85 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x5a3d22, roughness: 0.8 }),
      steel: new THREE.MeshStandardMaterial({ color: 0xb9c2cc, roughness: 0.3, metalness: 0.85 }),
    };
  }
  return MMAT[team];
}

export class Minion {
  constructor(scene, team, lane, kind, x, z) {
    this.id = UID++;
    this.kind = 'minion'; this.team = team; this.lane = lane;
    this.melee = kind === 'melee';
    this.maxHp = kind === 'melee' ? 480 : 300;
    this.hp = this.maxHp;
    this.ad = kind === 'melee' ? 22 : 32;
    this.range = kind === 'melee' ? 2.2 : 9;
    this.speed = 4.2;
    this.alive = true; this.attackT = 0;
    this.wpIndex = 1;
    this.hover = !this.melee;
    this.pos = new THREE.Vector3(x, 0, z);
    const M = minionMats(team);
    const g = new THREE.Group();
    const put = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; g.add(m); return m;
    };
    if (this.melee) {
      // ---- soldado acorazado de línea ----
      put(MGEO.box, M.dark, 0, 0.22, 0, 0.42, 0.44, 0.34);                       // grebas
      const tassets = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.3, 8), M.armor);
      tassets.position.y = 0.55; tassets.castShadow = true; g.add(tassets);     // faldar
      put(MGEO.box, M.armor, 0, 0.95, 0, 0.56, 0.55, 0.38);                     // coraza
      put(MGEO.box, M.trim, 0, 1.05, 0.2, 0.3, 0.3, 0.04);                      // emblema pecho
      put(MGEO.pauldron, M.trim, -0.34, 1.2, 0).scale.set(1, 0.7, 1);           // hombreras
      put(MGEO.pauldron, M.trim, 0.34, 1.2, 0).scale.set(1, 0.7, 1);
      put(MGEO.limb, M.dark, -0.36, 0.92, 0);                                   // brazos
      put(MGEO.limb, M.dark, 0.36, 0.92, 0);
      put(MGEO.helm, M.armor, 0, 1.45, 0);                                      // yelmo
      put(MGEO.box, M.trim, 0, 1.62, 0, 0.1, 0.12, 0.3);                        // cresta-portapenacho
      put(MGEO.box, M.plume, 0, 1.66, -0.1, 0.07, 0.1, 0.42);                    // penacho
      put(MGEO.box, M.glow, 0, 1.44, 0.2, 0.26, 0.06, 0.05);                     // visor brillante
      const sh = put(MGEO.shield, M.armor, -0.5, 0.95, 0.12);                   // escudo
      sh.rotation.y = 0.25;
      put(MGEO.boss, M.trim, -0.57, 0.95, 0.12);
      const sp = put(MGEO.shaft, M.wood, 0.52, 1.0, 0.15);                      // lanza
      sp.rotation.z = -0.12;
      const tp = put(MGEO.tip, M.steel, 0.62, 1.95, 0.15);
      tp.rotation.z = -0.12;
    } else {
      // ---- taumaturgo encapuchado flotante ----
      const robe = new THREE.Mesh(MGEO.robe, M.robe);
      robe.position.y = 0.75; robe.castShadow = true; g.add(robe);
      const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.12, 9), M.trim);
      sash.position.y = 0.85; g.add(sash);
      put(MGEO.hood, M.robe, 0, 1.5, 0);
      put(MGEO.face, M.dark, 0, 1.46, 0.12, 1, 1, 0.7);                          // rostro en sombra
      put(MGEO.box, M.glow, -0.07, 1.48, 0.24, 0.06, 0.05, 0.03);                // ojos arcanos
      put(MGEO.box, M.glow, 0.07, 1.48, 0.24, 0.06, 0.05, 0.03);
      put(MGEO.limb, M.robe, -0.3, 1.05, 0.1).rotation.z = 0.5;                  // mangas
      put(MGEO.limb, M.robe, 0.3, 1.05, 0.1).rotation.z = -0.5;
      const st = put(MGEO.shaft, M.wood, 0.48, 1.0, 0);                          // báculo
      put(MGEO.orb, M.glow, 0.48, 1.95, 0);                                     // orbe
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 14), M.trim);
      halo.position.set(0.48, 1.95, 0); halo.rotation.x = 0.5; g.add(halo);
    }
    g.position.copy(this.pos);
    scene.add(g);
    this.mesh = g;
    this.bars = attachBars(g, 1.6, 2.3);
    this.goldValue = this.melee ? 62 : 48;
  }
  takeDamage(raw) {
    if (!this.alive) return 0;
    const dmg = raw; // minions no armor
    this.hp -= dmg;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; this.mesh.visible = false; }
    return dmg;
  }
  updateBars() {
    const f = Math.max(0, this.hp / this.maxHp);
    this.bars.fg.scale.x = Math.max(0.001, f);
  }
}

export function makeTowerMesh(team) {
  const g = new THREE.Group();
  const baseCol = team === 'blue' ? 0x2f6fd0 : 0xd03a3a;
  const stone = new THREE.MeshStandardMaterial({ color: 0xb9c2cc, roughness: 0.85 });
  const darkStone = new THREE.MeshStandardMaterial({ color: 0x7a8490, roughness: 0.9 });
  const crystal = new THREE.MeshStandardMaterial({ color: baseCol, emissive: baseCol, emissiveIntensity: 0.9, roughness: 0.25 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8b45a, roughness: 0.4, metalness: 0.7 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.0, 1.4, 8), darkStone);
  base.position.y = 0.7; base.castShadow = true; base.receiveShadow = true; g.add(base);
  // escalones
  for (let i = 0; i < 2; i++) {
    const step = new THREE.Mesh(new THREE.CylinderGeometry(2.9 - i * 0.3, 3.1 - i * 0.3, 0.3, 8), stone);
    step.position.y = 0.15 + i * 0.3; step.receiveShadow = true; g.add(step);
  }
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.6, 5.5, 8), stone);
  pillar.position.y = 4; pillar.castShadow = true; g.add(pillar);
  // filos dorados + runas emisivas
  const trim = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.09, 8, 16), gold);
  trim.rotation.x = Math.PI / 2; trim.position.y = 5.6; g.add(trim);
  const rune = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.05, 6, 24), new THREE.MeshStandardMaterial({ color: baseCol, emissive: baseCol, emissiveIntensity: 1.4 }));
  rune.rotation.x = Math.PI / 2; rune.position.y = 3.1; g.add(rune);
  g.userData.rune = rune;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.2, 1.2, 8), stone);
  top.position.y = 7.3; top.castShadow = true; g.add(top);
  // almenas
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.4), darkStone);
    merlon.position.set(Math.cos(a) * 1.6, 8.1, Math.sin(a) * 1.6); g.add(merlon);
  }
  const cry = new THREE.Mesh(new THREE.OctahedronGeometry(1.1), crystal);
  cry.position.y = 8.8; cry.userData.spin = true; g.add(cry);
  g.userData.crystal = cry;
  // estandarte de guerra
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 6), darkStone);
  pole.position.set(1.9, 8.6, 0); g.add(pole);
  const bannerMat = new THREE.MeshStandardMaterial({ color: baseCol, side: THREE.DoubleSide, roughness: 0.8, emissive: baseCol, emissiveIntensity: 0.25 });
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.9, 1, 3), bannerMat);
  banner.position.set(2.5, 9.3, 0); g.add(banner);
  g.userData.banner = banner;
  // brasero con llama
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.25, 0.35, 8), darkStone);
  bowl.position.set(-1.9, 8.0, 0); g.add(bowl);
  const flameM = new THREE.MeshBasicMaterial({ color: 0xff9a2a, transparent: true, opacity: 0.9 });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.8, 8), flameM);
  flame.position.set(-1.9, 8.6, 0); g.add(flame);
  g.userData.flame = flame;
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.4, 3.9, 32), new THREE.MeshBasicMaterial({ color: baseCol, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; g.add(ring);
  return g;
}

export class Tower {
  constructor(scene, team, lane, x, z, isNexus = false) {
    this.id = UID++;
    this.kind = isNexus ? 'nexus' : 'tower';
    this.team = team; this.lane = lane;
    this.maxHp = isNexus ? 2200 : 1250;
    this.hp = this.maxHp;
    this.ad = isNexus ? 90 : 110;
    this.range = isNexus ? 11 : 12;
    this.alive = true; this.attackT = 0;
    this.pos = new THREE.Vector3(x, 0, z);
    this.mesh = makeTowerMesh(team);
    if (isNexus) this.mesh.scale.setScalar(1.5);
    this.mesh.position.copy(this.pos);
    scene.add(this.mesh);
    this.bars = attachBars(this.mesh, isNexus ? 5 : 3.6, isNexus ? 13 : 10.2);
    const label = makeNameSprite(isNexus ? (team === 'blue' ? '💎 ALLY NEXUS' : '💀 ENEMY NEXUS') : (team === 'blue' ? 'Ally Turret' : 'Enemy Turret'), team === 'blue' ? '#7ec8ff' : '#ff9a9a');
    label.position.y = isNexus ? 14.5 : 11.5; this.mesh.add(label);
  }
  takeDamage(raw) {
    if (!this.alive) return 0;
    this.hp -= raw * 0.85;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; this.mesh.visible = false; }
    return raw;
  }
  updateBars() {
    const f = Math.max(0, this.hp / this.maxHp);
    this.bars.fg.scale.x = Math.max(0.001, f);
    this.bars.fg.material.color.set(this.team === 'blue' ? 0x4da6ff : 0xff5b5b);
  }
}

export class ProjectilePool {
  constructor(scene) {
    this.scene = scene; this.items = [];
    this.geo = new THREE.SphereGeometry(0.32, 10, 8);
  }
  fire(fromPos, target, opts) {
    const mat = new THREE.MeshBasicMaterial({ color: opts.color || 0xffaa00 });
    const m = new THREE.Mesh(this.geo, mat);
    const start = fromPos.clone(); start.y += opts.y || 1.6;
    m.position.copy(start);
    this.scene.add(m);
    // glow light-ish sprite
    this.items.push({
      mesh: m, target, team: opts.team, from: opts.from,
      damage: opts.damage, speed: opts.speed || 26, life: opts.life || 2.2,
      aoe: opts.aoe || 0, color: opts.color, kind: opts.kind || 'bolt',
      dir: opts.dir ? opts.dir.clone() : null, effect: opts.effect || null
    });
  }
  update(dt, hitCallback) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life -= dt;
      let dest = null;
      if (p.target && (p.target.alive === undefined || p.target.alive)) {
        dest = p.target.pos ? p.target.pos.clone().setY(1.4) : p.target.mesh.position.clone().setY(1.4);
        // tower / nexus have pos
        if (p.target.pos) dest = p.target.pos.clone(); dest.y = p.kind === 'meteor' ? 0 : 1.4;
      }
      if (p.kind === 'meteor') {
        p.mesh.position.y -= dt * 30;
        p.mesh.scale.multiplyScalar(1 + dt * 2);
        if (p.mesh.position.y <= 0.6) { hitCallback(p); this.scene.remove(p.mesh); p.mesh.material.dispose(); this.items.splice(i, 1); continue; }
      } else if (dest && !p.dir) {
        const d = dest.clone().sub(p.mesh.position);
        const dist = d.length();
        if (dist < 1.0) { hitCallback(p); this.scene.remove(p.mesh); p.mesh.material.dispose(); this.items.splice(i, 1); continue; }
        d.normalize();
        p.mesh.position.addScaledVector(d, p.speed * dt);
      } else {
        const dir = p.dir || new THREE.Vector3(1, 0, 0);
        p.mesh.position.addScaledVector(dir, p.speed * dt);
        // hit check proximity done by caller? simple life-based aoe for skillshots
        if (p.life <= 0 && p.aoe) hitCallback(p);
      }
      if (p.life <= 0) { this.scene.remove(p.mesh); p.mesh.material.dispose(); this.items.splice(i, 1); }
    }
  }
  clear() { for (const p of this.items) { this.scene.remove(p.mesh); } this.items.length = 0; }
}

export class ParticleBurst {
  constructor(scene) {
    this.scene = scene; this.pools = [];
  }
  spawn(pos, color = 0xffaa00, n = 14, spread = 4, up = 5) {
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(n * 3);
    const vel = [];
    for (let i = 0; i < n; i++) {
      arr[i * 3] = pos.x; arr[i * 3 + 1] = pos.y + 1; arr[i * 3 + 2] = pos.z;
      vel.push(new THREE.Vector3((Math.random() - 0.5) * spread * 2, Math.random() * up, (Math.random() - 0.5) * spread * 2));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const mat = new THREE.PointsMaterial({ color, size: 0.45, transparent: true, opacity: 1 });
    const pts = new THREE.Points(geo, mat);
    this.scene.add(pts);
    this.pools.push({ pts, vel, life: 0.7 });
  }
  update(dt) {
    for (let i = this.pools.length - 1; i >= 0; i--) {
      const p = this.pools[i];
      p.life -= dt;
      const a = p.pts.geometry.attributes.position;
      for (let j = 0; j < p.vel.length; j++) {
        a.array[j * 3] += p.vel[j].x * dt;
        a.array[j * 3 + 1] += p.vel[j].y * dt;
        a.array[j * 3 + 2] += p.vel[j].z * dt;
        p.vel[j].y -= 12 * dt;
      }
      a.needsUpdate = true;
      p.pts.material.opacity = Math.max(0, p.life / 0.7);
      if (p.life <= 0) { this.scene.remove(p.pts); p.pts.geometry.dispose(); p.pts.material.dispose(); this.pools.splice(i, 1); }
    }
  }
}
