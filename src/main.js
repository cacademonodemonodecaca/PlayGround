import * as THREE from 'three';
import { MAP_SIZE, HEROES, LANES, BOT_DEFS, ENEMY_DEFS, SHOP_ITEMS } from './config.js';
import { buildWorld } from './world.js';
import { Hero, Minion, Tower, ProjectilePool, ParticleBurst } from './entities.js';
import { initUI } from './ui.js';
import { preloadWaifus, updateWaifuMixers, setHorrorCam } from './waifuModels.js';
import { akState, buildAKViewmodel, ensureTracerPool, fireTracer, updateTracers, sfxShoot, sfxReload, sfxHit } from './ak47.js';

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// Gráficos realistas: tone mapping cine + color correcto + sombras suaves
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
if ('useLegacyLights' in renderer) renderer.useLegacyLights = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc5e8);
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 800);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const world = buildWorld(scene);
const projectiles = new ProjectilePool(scene);
const particles = new ParticleBurst(scene);

const game = {
  heroes: [], minions: [], towers: [],
  time: 0, waveT: 2, goldT: 0, started: false, over: false,
  blueKills: 0, redKills: 0, firstBlood: false,
  player: null, ui: null, selectedHero: 'aether',
};
game.buyItem = (id) => {
  const p = game.player; if (!p || !p.alive) return;
  const it = SHOP_ITEMS.find((i) => i.id === id);
  if (!it || p.gold < it.cost) { game.ui?.say('Not enough gold!'); return; }
  if (id === 'ak47' && p.hasAK) { game.ui?.say('¡Ya tienes el AK-47! (G para alternar)'); return; }
  p.gold -= it.cost;
  if (it.ad) p.items.ad += it.ad;
  if (it.ap) p.items.ap += it.ap;
  if (it.hp) { p.items.hp += it.hp; p.maxHp += it.hp; p.hp += it.hp; }
  if (it.armor) p.items.armor += it.armor;
  if (it.speed) p.items.speed += it.speed;
  if (it.heal) p.heal(it.heal);
  if (id === 'ak47') {
    p.hasAK = true;
    akState.owned = true; akState.ammo = akState.magSize; akState.reloading = 0;
    game.ui.say('🔫 ¡AK-47! MODO CSGO: clic disparar • R recargar • G salir');
    enterAKMode();
  } else {
    game.ui.say(`${it.name} purchased!`);
  }
  p.recalc(); p.hp = Math.min(p.maxHp, p.hp + (it.hp || 0));
  blip(660);
};

// ---------- AK-47 modo CSGO ----------
let akView = null;
function ensureAKView() {
  if (!akView) {
    akView = buildAKViewmodel();
    camera.add(akView.group);
    scene.add(camera);
    ensureTracerPool(scene);
  }
  return akView;
}
function akEye(out) {
  const p = game.player;
  return (out || new THREE.Vector3()).set(p.pos.x, p.pos.y + 2.35, p.pos.z);
}
function akDir(out) {
  const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
  return (out || new THREE.Vector3()).set(Math.sin(camYaw) * cp, sp, Math.cos(camYaw) * cp);
}
function enterAKMode() {
  const p = game.player;
  if (!p?.hasAK || !p.alive || game.over) return;
  ensureAKView();
  akState.active = true;
  p.mesh.visible = false;
  camPitch = 0.06;
  p.mesh.rotation.y = camYaw;
  document.getElementById('crosshair').classList.remove('hidden');
  document.getElementById('ammo').classList.remove('hidden');
  document.getElementById('ak-banner').classList.remove('hidden');
  try { canvas.requestPointerLock?.(); } catch { /* sin pointer lock: órbita con drag */ }
  game.ui?.say('🔫 MODO CSGO');
}
function exitAKMode() {
  akState.active = false;
  if (game.player?.alive) game.player.mesh.visible = true;
  document.getElementById('crosshair').classList.add('hidden');
  document.getElementById('ammo').classList.add('hidden');
  document.getElementById('ak-banner').classList.add('hidden');
  try { document.exitPointerLock?.(); } catch { /* noop */ }
}
function akShoot() {
  const p = game.player;
  if (!p?.alive || game.over || !akState.active) return;
  if (akState.reloading > 0 || akState.cooldown > 0) return;
  if (akState.ammo <= 0) { startReload(); game.ui?.say('¡Sin balas! R para recargar'); return; }
  akState.ammo--; akState.cooldown = akState.fireInterval;
  akState.kick = Math.min(1, akState.kick + 0.22);
  camPitch = Math.min(1.2, camPitch + 0.011);
  const eye = akEye(), dir = akDir();
  // hitscan: enemigo con menor ángulo al centro del crosshair (máx 70m)
  let best = null, bestAng = 0.055, bestDist = 70;
  for (const e of enemiesOf(p.team)) {
    const ep = e.pos || e.mesh.position;
    const h = e instanceof Hero ? 2.3 : e.kind === 'minion' ? 1.1 : 4.5;
    const chest = new THREE.Vector3(ep.x, (ep.y || 0) + h * 0.55, ep.z);
    const to = chest.clone().sub(eye);
    const dist = to.length();
    if (dist > 70 || dist < 0.5) continue;
    const ang = to.normalize().angleTo(dir);
    const radius = (e.kind === 'nexus' ? 3.2 : e.kind === 'tower' ? 2.4 : e.kind === 'minion' ? 0.85 : 1.0) / dist;
    if (ang < bestAng + radius && dist < bestDist) { best = { e, dist }; bestAng = ang; bestDist = dist; }
  }
  sfxShoot();
  if (akView) {
    akView.flash.visible = true; akView.flash.material.rotation = Math.random() * 6.28;
    const mz = new THREE.Vector3(); akView.muzzle.getWorldPosition(mz);
    setTimeout(() => { if (akView) akView.flash.visible = false; }, 45);
    if (best) {
      const ep = best.e.pos || best.e.mesh.position;
      const h = best.e instanceof Hero ? 2.3 : best.e.kind === 'minion' ? 1.1 : 4.5;
      const aim = new THREE.Vector3(ep.x, (ep.y || 0) + h * 0.55, ep.z);
      // headshot: el rayo pasa más cerca de la cabeza que del pecho
      const head = new THREE.Vector3(ep.x, (ep.y || 0) + h * 0.92, ep.z);
      const ray = new THREE.Ray(eye, dir);
      const dHead = ray.distanceToPoint(head);
      const headshot = best.e instanceof Hero && dHead < 0.5;
      const dmg = (akState.damage + p.ad * 0.35) * (headshot ? 2.2 : 1);
      fireTracer(mz, aim);
      particles.spawn(aim, headshot ? 0xff2222 : 0xffd76a, headshot ? 16 : 10, 3, 5);
      if (best.e.kind === 'minion') { best.e.takeDamage(dmg); if (!best.e.alive) onKill(p, best.e); }
      else if (best.e instanceof Hero) dealHeroDamage(p, best.e, dmg);
      else { best.e.takeDamage(dmg); if (!best.e.alive) onKill(p, best.e); }
      sfxHit(headshot);
      const hm = document.getElementById('hitmarker');
      hm.classList.remove('hidden');
      hm.style.borderColor = headshot ? '#ff2222' : '#fff';
      clearTimeout(hm._t); hm._t = setTimeout(() => hm.classList.add('hidden'), headshot ? 220 : 120);
      if (headshot) game.ui?.say('💥 HEADSHOT x2.2');
    } else {
      fireTracer(mz, eye.clone().addScaledVector(dir, 60));
    }
  }
  updateAmmoHUD();
}
function startReload() {
  if (!akState.active || akState.reloading > 0 || akState.ammo >= akState.magSize) return;
  akState.reloading = akState.reloadTime;
  sfxReload();
  game.ui?.say('🔄 Recargando...');
}
function updateAmmoHUD() {
  const el = document.getElementById('ammo');
  if (el) el.innerHTML = `🔫 <b>${akState.ammo}</b> / ∞ ${akState.reloading > 0 ? '🔄' : ''}`;
}
function updateAK(dt) {
  if (!akState.owned) return;
  akState.cooldown = Math.max(0, akState.cooldown - dt);
  if (akState.reloading > 0) {
    akState.reloading -= dt;
    if (akState.reloading <= 0) { akState.ammo = akState.magSize; updateAmmoHUD(); }
  }
  akState.kick = Math.max(0, akState.kick - dt * 4);
  if (akView) {
    akView.group.position.z = akView.basePos.z + akState.kick * 0.09;
    akView.group.position.y = akView.basePos.y + akState.kick * 0.03;
    akView.group.rotation.x = akState.kick * 0.12 + (akState.reloading > 0 ? -0.35 : 0);
  }
  if (akState.active) updateAmmoHUD();
}

// ---------- setup map structures ----------
function addTower(team, lane, x, z, isNexus = false) {
  const t = new Tower(scene, team, lane, x, z, isNexus);
  game.towers.push(t);
  if (!isNexus) world.colliders.push({ x, z, r: 2.6 });
  else world.colliders.push({ x, z, r: 4 });
  return t;
}
for (const s of world.towerSpots) addTower(s.team, s.lane, s.x, s.z, false);
const blueNexus = addTower('blue', 'mid', -52, -52, true);
const redNexus = addTower('red', 'mid', 52, 52, true);

function spawnHero(team, heroKey, lane, x, z, opts = {}) {
  const h = new Hero(scene, team, heroKey, { lane, x, z, ...opts });
  game.heroes.push(h);
  return h;
}
// heroes created on start (so menu pick applies)
function createTeams() {
  for (const h of game.heroes) scene.remove(h.mesh);
  game.heroes.length = 0;
  for (const m of game.minions) scene.remove(m.mesh);
  game.minions.length = 0;
  game.player = spawnHero('blue', game.selectedHero, 'mid', -44, -44, { isPlayer: true, name: HEROES[game.selectedHero].name });
  BOT_DEFS.forEach((d, i) => {
    const off = i === 0 ? [-42, -46] : [-46, -42];
    spawnHero('blue', d.hero, d.lane, off[0], off[1], { name: (i === 0 ? 'Ally ' : 'Ally ') + HEROES[d.hero].name });
  });
  ENEMY_DEFS.forEach((d) => {
    spawnHero('red', d.hero, d.lane, 44, 44, { name: d.name });
  });
  game.blueKills = 0; game.redKills = 0; game.time = 0; game.waveT = 1; game.over = false;
  document.getElementById('end-screen').classList.add('hidden');
}

// ---------- input ----------
const keys = {};
let camYaw = Math.PI * 0.25 + Math.PI; // behind player looking to mid
let camPitch = 0.42, camDist = 12;
let dragging = false, dragBtn = 0, lastX = 0, lastY = 0, downX = 0, downY = 0, downT = 0;
let rightDown = null;

addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.code === 'Tab') document.getElementById('scoreboard').classList.remove('hidden');
  if (e.code === 'KeyB') document.getElementById('shop').classList.toggle('hidden');
  if (!game.started || game.over) return;
  // Habilidades en botones nuevos: Z/X/C/V + 1/2/3/4 + J/K/L/I
  // (Q/W/E/R eran incómodos: W choca con WASD; se dejan Q/E/R como alternativa, W NO)
  if (e.code === 'KeyZ' || e.code === 'Digit1' || e.code === 'KeyJ' || e.code === 'KeyQ') castQ(game.player);
  if (e.code === 'KeyX' || e.code === 'Digit2' || e.code === 'KeyK') castW(game.player);
  if (e.code === 'KeyC' || e.code === 'Digit3' || e.code === 'KeyL' || e.code === 'KeyE') castE(game.player);
  if (e.code === 'KeyV' || e.code === 'Digit4' || e.code === 'KeyI') castR(game.player);
  if (e.code === 'KeyR') { if (akState.active) startReload(); else castR(game.player); }
  if (e.code === 'KeyF') { if (akState.active) akShoot(); else playerAttack(); }
  if (e.code === 'KeyG') {
    if (akState.active) exitAKMode();
    else if (game.player?.hasAK) enterAKMode();
    else game.ui?.say('Compra el 🔫 AK-47 en la tienda (B)');
  }
});
addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (e.code === 'Tab') document.getElementById('scoreboard').classList.add('hidden');
});
canvas.addEventListener('pointerdown', (e) => {
  dragging = true; dragBtn = e.button; lastX = e.clientX; lastY = e.clientY;
  downX = e.clientX; downY = e.clientY; downT = performance.now();
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) {
    camYaw -= dx * 0.005;
    camPitch = Math.min(1.2, Math.max(0.08, camPitch + dy * 0.004));
  }
});
canvas.addEventListener('pointerup', (e) => {
  dragging = false;
  const quick = Math.hypot(e.clientX - downX, e.clientY - downY) < 6 && performance.now() - downT < 400;
  if (quick && game.started && !game.over) {
    if (e.button === 0) handleLeftClick(e.clientX, e.clientY);
    if (e.button === 2) handleRightClick(e.clientX, e.clientY);
  }
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('wheel', (e) => { camDist = Math.min(22, Math.max(6, camDist + e.deltaY * 0.01)); }, { passive: true });

function screenRay(cx, cy) {
  const r = new THREE.Raycaster();
  const ndc = new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
  r.setFromCamera(ndc, camera);
  return r;
}
function groundPoint(cx, cy) {
  const ray = screenRay(cx, cy);
  const t = -ray.ray.origin.y / ray.ray.direction.y;
  if (t < 0 || t > 500) return null;
  return ray.ray.origin.clone().addScaledVector(ray.ray.direction, t);
}
function pickEnemy(cx, cy, team) {
  let best = null, bestD = 60;
  for (const h of game.heroes) {
    if (h.team === team || !h.alive) continue;
    const v = h.pos.clone(); v.y = 1.5; v.project(camera);
    if (v.z > 1) continue;
    const sx = ((v.x + 1) / 2) * innerWidth, sy = ((-v.y + 1) / 2) * innerHeight;
    const d = Math.hypot(sx - cx, sy - cy);
    if (d < bestD) { bestD = d; best = h; }
  }
  for (const m of game.minions) {
    if (m.team === team || !m.alive) continue;
    const v = m.pos.clone(); v.y = 1; v.project(camera);
    if (v.z > 1) continue;
    const sx = ((v.x + 1) / 2) * innerWidth, sy = ((-v.y + 1) / 2) * innerHeight;
    const d = Math.hypot(sx - cx, sy - cy);
    if (d < bestD) { bestD = d; best = m; }
  }
  for (const t of game.towers) {
    if (t.team === team || !t.alive) continue;
    const v = t.pos.clone(); v.y = 4; v.project(camera);
    if (v.z > 1) continue;
    const sx = ((v.x + 1) / 2) * innerWidth, sy = ((-v.y + 1) / 2) * innerHeight;
    const d = Math.hypot(sx - cx, sy - cy);
    if (d < bestD + 20) { bestD = d; best = t; }
  }
  return best;
}
function handleLeftClick(cx, cy) {
  if (akState.active) { akShoot(); return; } // modo CSGO: clic = disparo
  const p = game.player;
  const enemy = pickEnemy(cx, cy, p.team);
  if (enemy) {
    p.target = enemy;
    attack(p, enemy);
    const gp = groundPoint(cx, cy);
    if (gp) p.faceX = gp.x, p.faceZ = gp.z;
  } else {
    playerAttack(); // attack nearest in front
  }
}
// FPS: ratón mira directamente con pointer lock
document.addEventListener('mousemove', (e) => {
  if (akState.active && document.pointerLockElement === canvas) {
    camYaw -= (e.movementX || 0) * 0.0022;
    camPitch = Math.min(1.2, Math.max(-1.2, camPitch - (e.movementY || 0) * 0.0022));
  }
});
canvas.addEventListener('click', () => {
  if (akState.active && document.pointerLockElement !== canvas) {
    try { canvas.requestPointerLock?.(); } catch { /* noop */ }
  }
});
function handleRightClick(cx, cy) {
  const gp = groundPoint(cx, cy);
  if (!gp) return;
  gp.x = Math.max(-68, Math.min(68, gp.x));
  gp.z = Math.max(-68, Math.min(68, gp.z));
  game.player.moveTarget = gp;
  game.player.target = null;
  spawnPing(gp);
}
const pingMeshes = [];
function spawnPing(pos) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.8, 20), new THREE.MeshBasicMaterial({ color: 0x7bff00, side: THREE.DoubleSide, transparent: true }));
  m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.1, pos.z);
  scene.add(m); pingMeshes.push({ m, life: 0.8 });
}

// ---------- audio (tiny synth, no assets) ----------
let AC = null;
function blip(freq = 440, dur = 0.08, type = 'square', vol = 0.05) {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = vol; o.connect(g); g.connect(AC.destination);
    o.start(); g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
    o.stop(AC.currentTime + dur);
  } catch { /* ignore */ }
}

// ---------- combat ----------
function enemiesOf(team) {
  return [
    ...game.heroes.filter((h) => h.team !== team && h.alive),
    ...game.minions.filter((m) => m.team !== team && m.alive),
    ...game.towers.filter((t) => t.team !== team && t.alive),
  ];
}
function nearestEnemy(pos, team, range, filter = null) {
  let best = null, bd = range;
  for (const e of enemiesOf(team)) {
    if (filter && !filter(e)) continue;
    const p = e.pos || e.mesh.position;
    const d = Math.hypot(p.x - pos.x, p.z - pos.z);
    if (d < bd) { bd = d; best = e; }
  }
  return best ? { e: best, d: bd } : null;
}
function dealHeroDamage(from, target, raw, element = null) {
  let dealt = 0;
  if (target.kind === 'minion') dealt = target.takeDamage(raw);
  else if (target instanceof Hero) {
    dealt = target.takeDamage(raw, from);
    if (element === 'pyro') target.burnT = 3;
    if (element === 'anemo' && target.burnT > 0) {
      // SWIRL reaction: AoE around target
      target.swirlT = 2;
      particles.spawn(target.pos, 0xff8c00, 22, 6, 8);
      for (const e of enemiesOf(from.team)) {
        const p = e.pos || e.mesh.position;
        if (Math.hypot(p.x - target.pos.x, p.z - target.pos.z) < 6 && e !== target) {
          if (e.kind === 'minion') e.takeDamage(40 + from.ap * 0.4);
          else if (e instanceof Hero) e.takeDamage(40 + from.ap * 0.4, from);
          else e.takeDamage(40 + from.ap * 0.4);
        }
      }
      game.ui?.say('🌪️🔥 SWIRL REACTION!');
    }
  } else dealt = target.takeDamage(raw);
  particles.spawn(target.pos || target.mesh.position, element === 'pyro' ? 0xff6a00 : element === 'anemo' ? 0x4de8c2 : 0xffd76a, 10, 3, 5);
  if (target.alive === false) onKill(from, target);
  return dealt;
}
function onKill(from, target) {
  const kn = from?.name || 'Unknown';
  const tn = target.name || (target.kind === 'minion' ? 'Minion' : target.kind === 'nexus' ? 'NEXUS' : 'Turret');
  if (target instanceof Hero) {
    if (!game.firstBlood) { game.firstBlood = true; game.ui.say('🩸 FIRST BLOOD — ' + kn + '!'); }
    else game.ui.feedKill(kn, tn, from.team);
    blip(220, 0.25, 'sawtooth', 0.08);
    if (from.team === 'blue') game.blueKills++; else game.redKills++;
    // assist gold nearby allies
    for (const h of game.heroes) {
      if (h.team === from.team && h !== from && h.alive && h.pos.distanceTo(target.pos) < 22) { h.gold += 120; h.gainXp(60); }
    }
  } else if (target.kind === 'minion') {
    if (from instanceof Hero) {
      from.gold += target.goldValue;
      // xp aura to nearby allies
      for (const h of game.heroes) if (h.team === from.team && h.alive && h.pos.distanceTo(target.pos) < 20) h.gainXp(55);
      if (from.isPlayer) blip(880, 0.05, 'square', 0.03);
    }
  } else if (target.kind === 'tower' || target.kind === 'nexus') {
    game.ui.say(target.kind === 'nexus' ? '💥 NEXUS DESTROYED!' : '🧱 Turret destroyed!');
    for (const h of game.heroes) if (h.team === from.team && h.alive) { h.gold += 150; h.gainXp(80); }
    blip(140, 0.4, 'sawtooth', 0.1);
    if (target.kind === 'nexus') endGame(from.team === 'blue' ? 'blue' : 'red');
  }
  target.updateBars?.();
}
function attack(attacker, target) {
  if (!attacker.alive || attacker.attackT > 0) return;
  const ap = attacker.pos, tp = target.pos || target.mesh.position;
  const d = Math.hypot(tp.x - ap.x, tp.z - ap.z);
  if (d > attacker.range + (target.kind === 'nexus' ? 3 : 1.5)) return;
  attacker.attackT = attacker.melee === undefined && attacker.range > 5 ? 0.9 : 0.75;
  // face
  attacker.mesh.rotation.y = Math.atan2(tp.x - ap.x, tp.z - ap.z);
  const isRanged = attacker.range > 5;
  if (isRanged || attacker.kind === 'minion' && !attacker.melee) {
    projectiles.fire(ap, target, { team: attacker.team, from: attacker, damage: attacker.ad, speed: 30, color: attacker.team === 'blue' ? 0x7ec8ff : 0xff7b7b });
  } else if (attacker instanceof Hero && attacker.range > 5) {
    projectiles.fire(ap, target, { team: attacker.team, from: attacker, damage: attacker.ad, speed: 34, color: 0x7bffea });
  } else {
    dealHeroDamage(attacker, target, attacker.ad);
    blip(300 + Math.random() * 200, 0.06, 'square', 0.04);
  }
}

// ---------- abilities ----------
function castQ(h) {
  if (!h?.alive || h.cd.q > 0 || h.mp < 40 || game.over) return;
  h.cd.q = h.heroKey === 'anemo' ? 3.5 : 5; h.mp -= 40;
  const yaw = h.mesh.rotation.y;
  const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const el = h.base.element;
  const dmg = (h.heroKey === 'anemo' ? 65 : 85) + h.ap * 0.65;
  // find target in front, else skillshot projectile
  const hit = nearestEnemy(h.pos.clone().addScaledVector(dir, 5), h.team, 7);
  if (hit) {
    dealHeroDamage(h, hit.e, dmg, el);
    game.ui.say(el === 'pyro' ? '🔥 Pyro Blast!' : el === 'anemo' ? '🌪️ Gale Arrow!' : '🪨 Stone Edge!');
  } else {
    projectiles.fire(h.pos, null, { team: h.team, from: h, damage: dmg, speed: 30, life: 1.1, dir, aoe: 4, color: el === 'pyro' ? 0xff5e00 : el === 'anemo' ? 0x4de8c2 : 0xd8b45a, kind: 'skill', effect: el });
  }
  particles.spawn(h.pos, el === 'pyro' ? 0xff6a00 : 0x4de8c2, 12, 3, 4);
  blip(520, 0.12, 'sawtooth', 0.06);
  // skillshot landing check each frame via projectile life end — handled in update via aoe scan
}
function castW(h) {
  if (!h?.alive || h.cd.w > 0 || h.mp < 25 || game.over) return;
  h.cd.w = 8; h.mp -= 25;
  const yaw = h.mesh.rotation.y;
  const dash = h.heroKey === 'anemo' ? 11 : 8;
  const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  h.pos.addScaledVector(dir, dash);
  h.pos.x = Math.max(-68, Math.min(68, h.pos.x));
  h.pos.z = Math.max(-68, Math.min(68, h.pos.z));
  particles.spawn(h.pos, 0xffffff, 16, 4, 3);
  game.ui.say(h.heroKey === 'anemo' ? '💨 Swift Dash!' : '⚡ Combat Dash!');
  blip(700, 0.1, 'sine', 0.06);
}
function castE(h) {
  if (!h?.alive || h.cd.e > 0 || h.mp < 50 || game.over) return;
  h.cd.e = 12; h.mp -= 50;
  const amt = (h.heroKey === 'geo' ? 200 : 120) + h.ap * 0.5;
  h.shield = amt; h.shieldT = 4;
  h.mesh.userData.shield.visible = true;
  if (h.heroKey === 'geo') h.heal(80 + h.ap * 0.3);
  particles.spawn(h.pos, 0x8fd0ff, 18, 3, 6);
  game.ui.say('🛡️ Elemental Shield!');
  blip(440, 0.15, 'sine', 0.06);
}
function castR(h) {
  if (!h?.alive || h.cd.r > 0 || h.mp < 100 || game.over) return;
  if (h.level < 6) { game.ui.say('🔒 Ultimate unlocks at Lv 6!'); return; }
  h.cd.r = 45; h.mp -= 100;
  // target: nearest enemy hero, else point ahead
  const found = nearestEnemy(h.pos, h.team, 26, (e) => e instanceof Hero);
  const at = found ? (found.e.pos.clone()) : h.pos.clone().add(new THREE.Vector3(Math.sin(h.mesh.rotation.y) * 12, 0, Math.cos(h.mesh.rotation.y) * 12));
  const m = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 10), new THREE.MeshBasicMaterial({ color: 0xff4400 }));
  m.position.set(at.x, 28, at.z);
  scene.add(m);
  // store falling meteor as projectile with target pos
  projectiles.fire(new THREE.Vector3(at.x, 28, at.z), { pos: new THREE.Vector3(at.x, 0, at.z), alive: true }, { team: h.team, from: h, damage: 220 + h.ap * 0.9, speed: 0, color: 0xff4400, kind: 'meteor', aoe: 8 });
  // remove visual helper, projectile has own mesh; remove helper now
  scene.remove(m);
  game.ui.say('☄️ METEOR FALL!');
  blip(90, 0.5, 'sawtooth', 0.1);
}
function playerAttack() {
  const p = game.player;
  if (!p?.alive) return;
  if (p.target?.alive === false || !p.target) {
    const n = nearestEnemy(p.pos, p.team, p.range + 1.5);
    if (n) { p.target = n.e; attack(p, n.e); }
  } else attack(p, p.target);
}

// ---------- waves ----------
function spawnWave() {
  for (const lane of Object.keys(LANES)) {
    for (const team of ['blue', 'red']) {
      const base = team === 'blue' ? [-50, -50] : [50, 50];
      for (let i = 0; i < 3; i++) {
        const m = new Minion(scene, team, lane, 'melee', base[0] + (Math.random() - 0.5) * 4, base[1] + (Math.random() - 0.5) * 4);
        game.minions.push(m);
      }
      for (let i = 0; i < 2; i++) {
        const m = new Minion(scene, team, lane, 'caster', base[0] + (Math.random() - 0.5) * 5, base[1] + (Math.random() - 0.5) * 5);
        game.minions.push(m);
      }
    }
  }
}

// ---------- physics helpers ----------
function collide(pos, r = 0.8) {
  for (const c of world.colliders) {
    const dx = pos.x - c.x, dz = pos.z - c.z;
    const d = Math.hypot(dx, dz), min = r + c.r;
    if (d < min && d > 0.001) {
      pos.x = c.x + (dx / d) * min;
      pos.z = c.z + (dz / d) * min;
    }
  }
  pos.x = Math.max(-69, Math.min(69, pos.x));
  pos.z = Math.max(-69, Math.min(69, pos.z));
}
function laneWaypoint(lane, idx, team) {
  const pts = LANES[lane];
  if (team === 'blue') return pts[Math.min(pts.length - 1, idx)];
  return pts[Math.max(0, pts.length - 1 - idx)];
}

// ---------- player update (Genshin-style) ----------
function updatePlayer(dt) {
  const p = game.player;
  if (!p.alive) {
    p.respawnT -= dt;
    if (p.respawnT <= 0) { p.respawn(-44, -44); game.ui.say('✨ Revived!'); }
    return;
  }
  // regen
  p.mp = Math.min(p.maxMp, p.mp + 8 * dt);
  p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.012 * dt);
  for (const k of ['q', 'w', 'e', 'r']) p.cd[k] = Math.max(0, p.cd[k] - dt);
  p.attackT = Math.max(0, p.attackT - dt);
  if (p.shieldT > 0) { p.shieldT -= dt; if (p.shieldT <= 0) { p.shield = 0; p.mesh.userData.shield.visible = false; } }
  if (p.burnT > 0) { p.burnT -= dt; p.hp -= 6 * dt; if (p.hp <= 0) { p.hp = 0; p.die(null); } }

  // movement input
  let ix = 0, iz = 0;
  if (keys.KeyW) iz += 1;
  if (keys.KeyS) iz -= 1;
  if (keys.KeyA) ix -= 1;
  if (keys.KeyD) ix += 1;
  const hasInput = ix !== 0 || iz !== 0;
  if (hasInput) p.moveTarget = null; // WASD overrides click-move
  const sprinting = keys.ShiftLeft && p.stamina > 1 && hasInput;
  let speed = p.speed * (sprinting ? 1.55 : 1);
  if (sprinting) p.stamina = Math.max(0, p.stamina - 22 * dt);
  else p.stamina = Math.min(100, p.stamina + 14 * dt);

  const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
  let mx = 0, mz = 0;
  if (hasInput) {
    const l = Math.hypot(ix, iz); ix /= l; iz /= l;
    // W = hacia donde mira la cámara (también en modo CSGO), D = derecha en pantalla
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    const rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
    mx = rx * ix + fx * iz;
    mz = rz * ix + fz * iz;
    p.mesh.rotation.y = Math.atan2(mx, mz);
  } else if (akState.active) {
    // en CSGO el cuerpo sigue la vista aunque no te muevas
    p.mesh.rotation.y = camYaw;
  } else if (p.moveTarget) {
    const dx = p.moveTarget.x - p.pos.x, dz = p.moveTarget.z - p.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.8) p.moveTarget = null;
    else { mx = dx / d; mz = dz / d; speed = p.speed; p.mesh.rotation.y = Math.atan2(mx, mz); }
  } else if (p.target && p.target.alive !== false) {
    const tp = p.target.pos || p.target.mesh.position;
    const d = Math.hypot(tp.x - p.pos.x, tp.z - p.pos.z);
    if (d > p.range) { mx = (tp.x - p.pos.x) / d; mz = (tp.z - p.pos.z) / d; p.mesh.rotation.y = Math.atan2(mx, mz); }
    else { p.mesh.rotation.y = Math.atan2(tp.x - p.pos.x, tp.z - p.pos.z); attack(p, p.target); }
  }
  if (mx !== 0 || mz !== 0) {
    p.pos.x += mx * speed * dt;
    p.pos.z += mz * speed * dt;
    // run bob
    p.mesh.position.y = Math.abs(Math.sin(game.time * 10)) * 0.08;
  }
  // jump / glide
  const wantJump = keys.Space;
  if (p.grounded && wantJump && p.stamina > 5) {
    p.vy = 8.5; p.grounded = false; p.stamina -= 5;
    blip(300, 0.08, 'sine', 0.04);
  }
  if (!p.grounded) {
    if (wantJump && p.vy < 0 && p.stamina > 0) {
      // gliding (Genshin)
      p.gliding = true;
      p.vy = Math.max(p.vy - 4 * dt, -2.2);
      p.stamina = Math.max(0, p.stamina - 10 * dt);
      p.mesh.userData.wings.visible = true;
      // glide forward boost
      p.pos.x += Math.sin(p.mesh.rotation.y) * 4 * dt;
      p.pos.z += Math.cos(p.mesh.rotation.y) * 4 * dt;
    } else {
      p.gliding = false;
      p.mesh.userData.wings.visible = false;
      p.vy -= 24 * dt;
    }
    p.pos.y += p.vy * dt;
    if (p.pos.y <= 0) { p.pos.y = 0; p.vy = 0; p.grounded = true; p.gliding = false; p.mesh.userData.wings.visible = false; }
  }
  collide(p.pos);
  p.mesh.visible = !akState.active; // en CSGO no ves tu cuerpo
  p.mesh.position.x = p.pos.x; p.mesh.position.z = p.pos.z;
  if (p.grounded) p.mesh.position.y = Math.abs(Math.sin(game.time * 10)) * (mx ? 0.08 : 0);
  else p.mesh.position.y = p.pos.y;
  p.mesh.userData.ring.rotation.z += dt * 1.5;
  try { p.mesh.userData.animate?.(game.time, !!(mx || mz)); } catch {}
  p.updateBars();
  billboard(p);

  // chests pickup
  for (const c of world.chests) {
    if (c.taken) continue;
    if (Math.hypot(c.x - p.pos.x, c.z - p.pos.z) < 2.6) {
      c.taken = true; c.respawn = 60; c.mesh.visible = false;
      p.gold += 150; p.heal(200); p.gainXp(40);
      game.ui.say('🎁 Jungle chest! +150g +heal');
      particles.spawn(p.pos, 0xffd700, 20, 4, 7);
      blip(990, 0.2, 'sine', 0.07);
    }
  }
}
function billboard(h) {
  h.bars.bg.lookAt(camera.position);
  h.bars.fg.lookAt(camera.position);
}

// ---------- bot AI ----------
let aiTick = 0;
function updateBots(dt) {
  aiTick -= dt;
  const doThink = aiTick <= 0;
  if (doThink) aiTick = 0.3;
  for (const h of game.heroes) {
    if (h.isPlayer || !h.alive) {
      if (!h.alive && h !== game.player) {
        h.respawnT -= dt;
        if (h.respawnT <= 0) {
          const bx = h.team === 'blue' ? -44 : 44, bz = h.team === 'blue' ? -44 : 44;
          h.respawn(bx, bz);
        }
      }
      continue;
    }
    for (const k of ['q', 'w', 'e', 'r']) h.cd[k] = Math.max(0, h.cd[k] - dt);
    h.attackT = Math.max(0, h.attackT - dt);
    h.mp = Math.min(h.maxMp, h.mp + 8 * dt);
    h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.012 * dt);
    if (h.shieldT > 0) { h.shieldT -= dt; if (h.shieldT <= 0) { h.shield = 0; h.mesh.userData.shield.visible = false; } }
    if (h.burnT > 0) { h.burnT -= dt; h.hp -= 6 * dt; if (h.hp <= 0) { h.hp = 0; h.die(null); continue; } }
    h.gold += dt * 2.2; // passive

    if (doThink) {
      // retreat check
      const f = h.hp / h.maxHp;
      const threat = nearestEnemy(h.pos, h.team, 16, (e) => e instanceof Hero);
      if (f < 0.28) h.ai.state = 'retreat';
      else if (f > 0.75 && h.ai.state === 'retreat') h.ai.state = 'push';
      else if (h.ai.state !== 'retreat') h.ai.state = 'push';
      h.ai.threat = threat?.e || null;
      // waypoint advance: find closest lane index toward enemy
      const pts = LANES[h.lane];
      let bestI = h.ai.wpIndex, bd = 1e9;
      pts.forEach(([x, z], i) => {
        const d = Math.hypot(x - h.pos.x, z - h.pos.z);
        if (d < bd) { bd = d; bestI = i; }
      });
      h.ai.wpIndex = h.team === 'blue' ? Math.min(pts.length - 1, bestI + (bd < 5 ? 1 : 0)) : Math.max(0, bestI - (bd < 5 ? 1 : 0));
      // auto buy
      if (h.gold > 950) { h.gold -= 900; h.items.ad += 20; h.items.ap += 12; h.items.hp += 80; h.recalc(); }
    }
    let mvx = 0, mvz = 0, mvSpeed = h.speed;
    if (h.ai.state === 'retreat') {
      const bx = h.team === 'blue' ? -50 : 50, bz = h.team === 'blue' ? -50 : 50;
      const dx = bx - h.pos.x, dz = bz - h.pos.z, d = Math.hypot(dx, dz) || 1;
      mvx = dx / d; mvz = dz / d;
      if (Math.hypot(dx, dz) < 6) h.heal(h.maxHp * 0.05);
    } else {
      // engage nearest in 14 else follow lane
      const near = nearestEnemy(h.pos, h.team, 14);
      if (near) {
        const tp = near.e.pos || near.e.mesh.position;
        const d = Math.hypot(tp.x - h.pos.x, tp.z - h.pos.z);
        h.mesh.rotation.y = Math.atan2(tp.x - h.pos.x, tp.z - h.pos.z);
        if (d <= h.range + 1) {
          attack(h, near.e);
          // cast Q often
          if (h.cd.q <= 0 && h.mp > 60 && d < 12 && Math.random() < 0.06) castQ(h);
          if (h.cd.e <= 0 && h.hp / h.maxHp < 0.6 && Math.random() < 0.05) castE(h);
          if (h.cd.r <= 0 && h.level >= 6 && near.e instanceof Hero && near.e.hp / near.e.maxHp < 0.5) castR(h);
        } else { mvx = (tp.x - h.pos.x) / d; mvz = (tp.z - h.pos.z) / d; }
      } else {
        const [wx, wz] = laneWaypoint(h.lane, h.ai.wpIndex, h.team);
        const dx = wx - h.pos.x, dz = wz - h.pos.z, d = Math.hypot(dx, dz) || 1;
        if (d > 2) { mvx = dx / d; mvz = dz / d; h.mesh.rotation.y = Math.atan2(mvx, mvz); }
      }
    }
    if (mvx || mvz) {
      h.pos.x += mvx * mvSpeed * dt;
      h.pos.z += mvz * mvSpeed * dt;
      if (!h.ai.threat) h.mesh.rotation.y = Math.atan2(mvx, mvz);
    }
    h.pos.y = 0;
    collide(h.pos);
    h.mesh.position.set(h.pos.x, Math.abs(Math.sin(game.time * 8 + h.id)) * 0.06, h.pos.z);
    try { h.mesh.userData.animate?.(game.time + h.id, !!(mvx || mvz)); } catch {}
    h.updateBars();
    h.bars.bg.lookAt(camera.position);
    h.bars.fg.lookAt(camera.position);
  }
}

// ---------- minions & towers ----------
function updateMinions(dt) {
  for (let i = game.minions.length - 1; i >= 0; i--) {
    const m = game.minions[i];
    if (!m.alive) { scene.remove(m.mesh); game.minions.splice(i, 1); continue; }
    m.attackT = Math.max(0, m.attackT - dt);
    const near = nearestEnemy(m.pos, m.team, m.melee ? m.range + 1 : 11);
    if (near) {
      const tp = near.e.pos || near.e.mesh.position;
      const d = Math.hypot(tp.x - m.pos.x, tp.z - m.pos.z);
      if (d <= m.range + 0.8) {
        m.mesh.rotation.y = Math.atan2(tp.x - m.pos.x, tp.z - m.pos.z);
        if (m.attackT <= 0) {
          m.attackT = 1.1;
          if (m.melee) {
            const dealt = near.e.kind === 'minion' ? (near.e.takeDamage(m.ad), m.ad) : dealHeroDamage(m, near.e, m.ad);
            if (near.e.alive === false) onKill(m, near.e);
          } else {
            projectiles.fire(m.pos, near.e, { team: m.team, from: m, damage: m.ad, speed: 24, color: m.team === 'blue' ? 0x9ecbff : 0xff9a9a });
          }
        }
      } else {
        const dx = (tp.x - m.pos.x) / d, dz = (tp.z - m.pos.z) / d;
        m.pos.x += dx * m.speed * dt; m.pos.z += dz * m.speed * dt;
        m.mesh.rotation.y = Math.atan2(dx, dz);
      }
    } else {
      const pts = LANES[m.lane];
      let bi = 0, bd = 1e9;
      pts.forEach(([x, z], idx) => {
        const d = Math.hypot(x - m.pos.x, z - m.pos.z);
        if (d < bd) { bd = d; bi = idx; }
      });
      const ni = m.team === 'blue' ? Math.min(pts.length - 1, bi + 1) : Math.max(0, bi - 1);
      const [wx, wz] = pts[ni];
      const dx = wx - m.pos.x, dz = wz - m.pos.z, d = Math.hypot(dx, dz) || 1;
      if (d > 1.5) {
        m.pos.x += (dx / d) * m.speed * dt;
        m.pos.z += (dz / d) * m.speed * dt;
        m.mesh.rotation.y = Math.atan2(dx, dz);
      }
    }
    collide(m.pos, 0.6);
    m.mesh.position.set(m.pos.x, m.hover ? 0.18 + Math.sin(game.time * 3 + m.id) * 0.09 : Math.abs(Math.sin(game.time * 9 + m.id)) * 0.04, m.pos.z);
    m.updateBars();
    m.bars.bg.lookAt(camera.position);
    m.bars.fg.lookAt(camera.position);
  }
}
function updateTowers(dt) {
  for (const t of game.towers) {
    if (!t.alive) continue;
    t.attackT = Math.max(0, t.attackT - dt);
    t.mesh.userData.crystal.rotation.y += dt * 1.2;
    if (t.mesh.userData.rune) t.mesh.userData.rune.rotation.z += dt * 0.8;
    if (t.mesh.userData.banner) t.mesh.userData.banner.rotation.y = Math.sin(game.time * 2.2 + t.id) * 0.35;
    if (t.mesh.userData.flame) {
      const f = t.mesh.userData.flame;
      f.scale.set(1 + Math.sin(game.time * 11 + t.id) * 0.18, 1 + Math.sin(game.time * 13 + t.id * 2) * 0.25, 1);
    }
    // prefer minions, then heroes
    let target = nearestEnemy(t.pos, t.team, t.range, (e) => e.kind === 'minion')?.e
      || nearestEnemy(t.pos, t.team, t.range)?.e;
    if (target && t.attackT <= 0) {
      t.attackT = 1.4;
      projectiles.fire(new THREE.Vector3(t.pos.x, 8, t.pos.z), target, { team: t.team, from: t, damage: t.ad, speed: 26, color: t.team === 'blue' ? 0x4da6ff : 0xff4444 });
      blip(180, 0.1, 'square', 0.03);
    }
    t.updateBars();
    t.bars.bg.lookAt(camera.position);
    t.bars.fg.lookAt(camera.position);
  }
}
function updateProjectiles(dt) {
  projectiles.update(dt, (p) => {
    const from = p.from;
    if (p.kind === 'meteor') {
      const at = p.mesh.position.clone(); at.y = 0;
      particles.spawn(at, 0xff4400, 30, 8, 10);
      particles.spawn(at, 0xffd700, 20, 6, 8);
      blip(70, 0.4, 'sawtooth', 0.12);
      for (const e of enemiesOf(p.team)) {
        const ep = e.pos || e.mesh.position;
        if (Math.hypot(ep.x - at.x, ep.z - at.z) < (p.aoe || 7)) {
          if (e.kind === 'minion') { e.takeDamage(p.damage); if (!e.alive) onKill(from, e); }
          else if (e instanceof Hero) { const was = e.alive; dealHeroDamage(from, e, p.damage, 'pyro'); }
          else { e.takeDamage(p.damage); if (!e.alive) onKill(from, e); }
        }
      }
      // scorch decal
      return;
    }
    if (p.kind === 'skill' && !p.target) {
      // skillshot landing: aoe at current pos
      const at = p.mesh.position;
      for (const e of enemiesOf(p.team)) {
        const ep = e.pos || e.mesh.position;
        if (Math.hypot(ep.x - at.x, ep.z - at.z) < (p.aoe || 4)) {
          if (e.kind === 'minion') { e.takeDamage(p.damage); if (!e.alive) onKill(from, e); }
          else if (e instanceof Hero) dealHeroDamage(from, e, p.damage, p.effect);
          else { e.takeDamage(p.damage); if (!e.alive) onKill(from, e); }
        }
      }
      particles.spawn(at, p.color || 0xffaa00, 14, 4, 5);
      return;
    }
    const t = p.target;
    if (!t || t.alive === false) return;
    if (t.kind === 'minion') { t.takeDamage(p.damage); if (!t.alive) onKill(from, t); }
    else if (t instanceof Hero) dealHeroDamage(from, t, p.damage, p.effect);
    else { t.takeDamage(p.damage); if (!t.alive) onKill(from, t); }
    blip(500, 0.05, 'square', 0.03);
  });
}

// ---------- HUD ----------
function updateHUD() {
  const ui = game.ui, p = game.player;
  if (!ui || !p) return;
  ui.hpFill.style.width = `${(p.hp / p.maxHp) * 100}%`;
  ui.hpText.textContent = `${Math.ceil(p.hp)} / ${Math.ceil(p.maxHp)}`;
  ui.mpFill.style.width = `${(p.mp / p.maxMp) * 100}%`;
  ui.mpText.textContent = `${Math.ceil(p.mp)} / ${Math.ceil(p.maxMp)}`;
  ui.xpFill.style.width = `${(p.xp / (150 + p.level * 90)) * 100}%`;
  ui.level.textContent = `Lv ${p.level}`;
  ui.gold.textContent = `💰 ${Math.floor(p.gold)}`;
  ui.kda.textContent = `${p.kills} / ${p.deaths} / ${p.assists}`;
  ui.stamina.style.width = `${p.stamina}%`;
  const mm = String(Math.floor(game.time / 60)).padStart(2, '0'), ss = String(Math.floor(game.time % 60)).padStart(2, '0');
  ui.timer.textContent = `${mm}:${ss}`;
  ui.sb.textContent = game.blueKills;
  ui.sr.textContent = game.redKills;
  const cds = [['q', 5], ['w', 8], ['e', 12], ['r', 45]];
  for (const [k, max] of cds) {
    const cd = p.cd[k];
    ui.cds[k].style.height = `${cd > 0 ? (cd / (k === 'q' && p.heroKey === 'anemo' ? 3.5 : max)) * 100 : 0}%`;
    ui.abs[k].classList.toggle('ready', cd <= 0 && p.mp >= (k === 'q' ? 40 : k === 'w' ? 25 : k === 'e' ? 50 : 100));
  }
  if (Math.floor(game.time * 2) % 2 === 0) { ui.updateScoreboard(); ui.drawMinimap(); }
}

// ---------- camera ----------
function updateCamera(dt) {
  const p = game.player;
  if (!p) return;
  if (akState.active) {
    // FPS estilo CSGO: ojo en la cabeza, mira = camYaw/camPitch
    const eye = akEye();
    const dir = akDir();
    camera.position.copy(eye);
    camera.lookAt(eye.clone().addScaledVector(dir, 10));
    return;
  }
  const target = new THREE.Vector3(p.pos.x, p.pos.y + 2.6, p.pos.z);
  const cx = target.x - Math.sin(camYaw) * Math.cos(camPitch) * camDist;
  const cz = target.z - Math.cos(camYaw) * Math.cos(camPitch) * camDist;
  const cy = target.y + Math.sin(camPitch) * camDist;
  const desired = new THREE.Vector3(cx, Math.max(2, cy), cz);
  camera.position.lerp(desired, 1 - Math.pow(0.0001, dt));
  camera.lookAt(target);
}

// ---------- end ----------
function endGame(winner) {
  if (game.over) return;
  game.over = true;
  const win = winner === 'blue';
  document.getElementById('end-title').textContent = win ? '🏆 VICTORY!' : '💀 DEFEAT';
  document.getElementById('end-title').style.color = win ? 'gold' : '#ff6b6b';
  const p = game.player;
  document.getElementById('end-stats').textContent = `Time ${document.getElementById('match-timer').textContent} • KDA ${p.kills}/${p.deaths}/${p.assists} • Level ${p.level} • Gold ${Math.floor(p.gold)}`;
  document.getElementById('end-screen').classList.remove('hidden');
  game.ui.say(win ? '🏆 VICTORY!' : '💀 DEFEAT', 4000);
}

// ---------- menu ----------
document.querySelectorAll('.hero-pick').forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll('.hero-pick').forEach((x) => x.classList.remove('selected'));
    b.classList.add('selected');
    game.selectedHero = b.dataset.hero;
  };
});
document.getElementById('play-btn').onclick = () => startGame();
document.getElementById('again-btn').onclick = () => { createTeams(); game.started = true; };
function startGame() {
  document.getElementById('menu').classList.add('hidden');
  createTeams();
  game.started = true;
  game.ui = game.ui || initUI(game);
  game.ui.say('⚔️ Destroy the enemy Nexus!', 2500);
  // portrait color
  const base = HEROES[game.selectedHero];
  const por = document.getElementById('portrait');
  por.textContent = base.icon.slice(0, 2) || 'A';
}

// ---------- main loop ----------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (game.started && !game.over) {
    game.time += dt;
    game.waveT -= dt;
    if (game.waveT <= 0) { game.waveT = 22; spawnWave(); if (game.time > 5) game.ui?.say('🌊 Minions have spawned!'); }
    game.goldT += dt;
    if (game.goldT > 1) { game.goldT = 0; for (const h of game.heroes) if (h.alive) { h.gold += 6; h.gainXp(4); } }
    updatePlayer(dt);
    updateBots(dt);
    updateMinions(dt);
    updateTowers(dt);
    updateProjectiles(dt);
    particles.update(dt);
    updateWaifuMixers(dt);
    updateAK(dt);
    updateTracers(dt);
    // chests respawn
    for (const c of world.chests) {
      if (c.taken) {
        c.respawn -= dt;
        if (c.respawn <= 0) { c.taken = false; c.mesh.visible = true; }
      } else c.glow.rotation.y += dt * 2;
    }
    // pings
    for (let i = pingMeshes.length - 1; i >= 0; i--) {
      const pg = pingMeshes[i];
      pg.life -= dt; pg.m.scale.multiplyScalar(1 + dt * 3);
      pg.m.material.opacity = pg.life;
      if (pg.life <= 0) { scene.remove(pg.m); pingMeshes.splice(i, 1); }
    }
    // day drift
    world.sun.position.x = 60 * Math.cos(game.time * 0.02);
    world.sun.position.z = 30 + 40 * Math.sin(game.time * 0.02);
    updateHUD();
    updateCamera(dt);
  } else if (!game.started) {
    // menu idle camera orbit
    const t = performance.now() * 0.0001;
    camera.position.set(Math.sin(t) * 70, 30, Math.cos(t) * 70);
    camera.lookAt(0, 0, 0);
  } else {
    updateCamera(dt);
  }
  world.updateWorld(dt, performance.now() / 1000);
  setHorrorCam(camera.position);
  renderer.render(scene, camera);
}
// idle world behind menu (con waifus procedurales hasta que carguen los GLB reales)
createTeams();
game.ui = initUI(game);
// Carga de modelos 3D reales: el botón espera a que terminen (con fallback si falla la red)
const playBtn = document.getElementById('play-btn');
playBtn.disabled = true;
playBtn.textContent = '⏳ CARGANDO MODELOS 3D...';
preloadWaifus().finally(() => {
  playBtn.disabled = false;
  playBtn.textContent = '▶ ENTER THE RIFT (Desktop 3D)';
  if (new URLSearchParams(location.search).get('autostart') === '1') {
    startGame();
  } else {
    game.started = false;
    document.getElementById('menu').classList.remove('hidden');
  }
});
animate();

// expose for debugging / tests
window.__game = game;
window.__aim = (yaw, pitch) => { camYaw = yaw; camPitch = Math.max(-1.2, Math.min(1.2, pitch)); };
