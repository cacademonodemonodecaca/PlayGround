import * as THREE from 'three';

// Estado del AK-47 (una instancia: solo el jugador lo usa)
export const akState = {
  owned: false, active: false,
  ammo: 30, magSize: 30,
  reloading: 0, reloadTime: 2.1,
  cooldown: 0, fireInterval: 0.105,
  kick: 0, damage: 42,
};

// ---------- viewmodel del AK (detallado, pegado a la cámara) ----------
export function buildAKViewmodel() {
  const steel = new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.45, metalness: 0.8 });
  const steelLight = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.35, metalness: 0.85 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a4a22, roughness: 0.6, metalness: 0.05 });
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x5a3418, roughness: 0.65 });
  const g = new THREE.Group();
  const add = (mesh, x, y, z, rx = 0, ry = 0, rz = 0) => {
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); g.add(mesh); return mesh;
  };
  // cajón de mecanismos + tapa
  add(new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.09, 0.42), steel), 0, 0, 0);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.02, 0.4), steelLight), 0, 0.055, 0);
  // cañón + punto de mira + bocacha
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.34, 10), steel), 0, 0.012, -0.37, Math.PI / 2, 0, 0);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, 0.012), steelLight), 0, 0.045, -0.5);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.09, 8), steelLight), 0, 0.012, -0.56, Math.PI / 2, 0, 0);
  // alza trasera
  add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.02), steelLight), 0, 0.07, -0.12);
  // guardamanos de madera
  add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.075, 0.26), wood), 0, -0.005, -0.3);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.084, 0.02, 0.26), woodDark), 0, -0.045, -0.3);
  // cargador curvo (segmentos)
  const magCurve = new THREE.Group(); magCurve.position.set(0, -0.05, -0.02); magCurve.rotation.x = 0.5; g.add(magCurve);
  const mag1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.09), steel); mag1.position.y = -0.06; magCurve.add(mag1);
  const mag2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.09), steel); mag2.position.set(0, -0.16, 0.035); mag2.rotation.x = -0.45; magCurve.add(mag2);
  // pistolete + culata
  const grip = add(new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.13, 0.06), woodDark), 0, -0.1, 0.1);
  grip.rotation.x = 0.35;
  const stock = add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, 0.3), wood), 0, -0.02, 0.36);
  stock.rotation.x = -0.06;
  add(new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.13, 0.03), steel), 0, -0.02, 0.5);
  // palanca de montar
  add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.07), steelLight), 0.05, 0.03, -0.05);
  // manitas con guantes (inmersión FPS)
  const glove = new THREE.MeshStandardMaterial({ color: 0x2e2a24, roughness: 0.9 });
  const handF = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.12), glove);
  handF.position.set(0, -0.075, -0.3); handF.rotation.x = 0.2; g.add(handF);
  const handT = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.07), glove);
  handT.position.set(0, -0.14, 0.1); handT.rotation.x = 0.35; g.add(handT);
  // fogonazo
  const flashTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const grd = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,230,1)'); grd.addColorStop(0.4, 'rgba(255,190,60,0.9)'); grd.addColorStop(1, 'rgba(255,120,0,0)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, transparent: true, depthWrite: false, depthTest: false }));
  flash.position.set(0, 0.012, -0.66); flash.scale.set(0.34, 0.34, 1); flash.visible = false;
  g.add(flash);
  // punto de referencia de la boca del cañón (origen de trazadoras)
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.012, -0.62); g.add(muzzle);

  g.position.set(0.27, -0.25, -0.5);
  g.rotation.y = 0.02;
  return { group: g, flash, muzzle, basePos: g.position.clone() };
}

// ---------- trazadoras ----------
const tracers = [];
export function ensureTracerPool(scene, n = 10) {
  while (tracers.length < n) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.025, 1),
      new THREE.MeshBasicMaterial({ color: 0xffe28a, transparent: true, opacity: 0.9, depthWrite: false })
    );
    m.visible = false; scene.add(m);
    tracers.push({ m, life: 0 });
  }
}
export function fireTracer(from, to) {
  const t = tracers.find((x) => x.life <= 0) || tracers[0];
  const dir = to.clone().sub(from);
  const len = dir.length();
  t.m.position.copy(from).addScaledVector(dir, 0.5);
  t.m.lookAt(to);
  t.m.scale.set(1, 1, Math.max(0.1, len));
  t.m.visible = true;
  t.life = 0.07;
}
export function updateTracers(dt) {
  for (const t of tracers) {
    if (t.life > 0) {
      t.life -= dt;
      t.m.material.opacity = Math.max(0, t.life / 0.07) * 0.9;
      if (t.life <= 0) t.m.visible = false;
    }
  }
}

// ---------- sonido sintetizado (sin assets) ----------
let AC = null, noiseBuf = null;
function ac() {
  if (!AC) {
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  }
  if (AC && AC.state === 'suspended') AC.resume().catch(() => {});
  return AC;
}
export function sfxShoot() {
  const ctx = ac(); if (!ctx) return;
  try {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.2);
    }
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3200;
    const gn = ctx.createGain(); gn.gain.value = 0.5;
    src.connect(f); f.connect(gn); gn.connect(ctx.destination); src.start();
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(160, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.09);
    const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.35, ctx.currentTime);
    g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    o.connect(g2); g2.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.11);
  } catch { /* noop */ }
}
export function sfxReload() {
  const ctx = ac(); if (!ctx) return;
  try {
    [0, 0.28, 0.62].forEach((dt, i) => {
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = i === 2 ? 900 : 420;
      const gn = ctx.createGain(); gn.gain.value = 0.12;
      o.connect(gn); gn.connect(ctx.destination);
      o.start(ctx.currentTime + dt); o.stop(ctx.currentTime + dt + 0.06);
    });
  } catch { /* noop */ }
}
export function sfxHit(head) {
  const ctx = ac(); if (!ctx) return;
  try {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = head ? 1500 : 1050;
    const gn = ctx.createGain(); gn.gain.value = 0.14;
    o.connect(gn); gn.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.06);
  } catch { /* noop */ }
}
