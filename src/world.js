import * as THREE from 'three';
import { MAP_SIZE, LANES } from './config.js';

export function makeGroundTexture() {
  const S = 2048;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  // base hierba con gradiente
  const grad = g.createLinearGradient(0, 0, S, S);
  grad.addColorStop(0, '#3d7a38'); grad.addColorStop(0.45, '#4f9a42'); grad.addColorStop(1, '#386b34');
  g.fillStyle = grad; g.fillRect(0, 0, S, S);
  // moteado jungla oscura
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(${20 + Math.random() * 30},${70 + Math.random() * 40},${25 + Math.random() * 25},0.4)`;
    g.beginPath(); g.ellipse(Math.random() * S, Math.random() * S, 20 + Math.random() * 90, 15 + Math.random() * 60, Math.random() * 3, 0, 7); g.fill();
  }
  // parches claros de pradera
  for (let i = 0; i < 200; i++) {
    g.fillStyle = `rgba(${90 + Math.random() * 50},${150 + Math.random() * 50},${70 + Math.random() * 30},0.28)`;
    g.beginPath(); g.ellipse(Math.random() * S, Math.random() * S, 15 + Math.random() * 60, 10 + Math.random() * 40, Math.random() * 3, 0, 7); g.fill();
  }
  // briznas de hierba (trazo fino)
  g.lineWidth = 2;
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * S, y = Math.random() * S, h = 4 + Math.random() * 9;
    g.strokeStyle = `rgba(${50 + Math.random() * 40},${120 + Math.random() * 60},${50 + Math.random() * 30},0.5)`;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 4, y - h); g.stroke();
  }
  // florecillas
  const flowerCols = ['#ffffff', '#ffd94d', '#ff9ec6', '#c9a0ff'];
  for (let i = 0; i < 700; i++) {
    g.fillStyle = flowerCols[(Math.random() * flowerCols.length) | 0];
    g.beginPath(); g.arc(Math.random() * S, Math.random() * S, 2 + Math.random() * 3, 0, 7); g.fill();
  }
  const w2m = (v) => ((v + MAP_SIZE / 2) / MAP_SIZE) * S;
  const lanePx = (lane) => lane.map(([x, z]) => [w2m(x), w2m(z)]);
  // orillas arenosas del río
  g.strokeStyle = '#d9c493'; g.lineWidth = 52; g.lineCap = 'round';
  g.beginPath(); g.moveTo(w2m(-70), w2m(70)); g.lineTo(w2m(70), w2m(-70)); g.stroke();
  // río
  g.strokeStyle = '#2f7fae'; g.lineWidth = 38;
  g.beginPath(); g.moveTo(w2m(-70), w2m(70)); g.lineTo(w2m(70), w2m(-70)); g.stroke();
  g.strokeStyle = '#6fc4e8'; g.lineWidth = 20;
  g.beginPath(); g.moveTo(w2m(-70), w2m(70)); g.lineTo(w2m(70), w2m(-70)); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.65)'; g.lineWidth = 3;
  for (let i = 0; i < 40; i++) {
    const t = Math.random(), x = w2m(-70) + (w2m(70) - w2m(-70)) * t + (Math.random() - 0.5) * 30;
    const y = w2m(70) + (w2m(-70) - w2m(70)) * t + (Math.random() - 0.5) * 30;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 14, y - 6); g.stroke();
  }
  // carriles: base arena + losas de piedra
  for (const lane of Object.values(LANES)) {
    const pts = lanePx(lane);
    g.strokeStyle = '#b89a67'; g.lineWidth = 34; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    g.strokeStyle = '#cbb37f'; g.lineWidth = 24;
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
  }
  // losas
  g.fillStyle = '#a89268';
  for (const lane of Object.values(LANES)) {
    const pts = lanePx(lane);
    for (let s = 0; s < pts.length - 1; s++) {
      const [ax, ay] = pts[s], [bx, by] = pts[s + 1];
      const len = Math.hypot(bx - ax, by - ay), n = Math.floor(len / 34);
      const ang = Math.atan2(by - ay, bx - ax) + Math.PI / 2;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
        g.save(); g.translate(x, y); g.rotate(ang);
        g.fillRect(-11, -7, 22, 14);
        g.strokeStyle = 'rgba(60,45,25,0.5)'; g.lineWidth = 2; g.strokeRect(-11, -7, 22, 14);
        g.restore();
      }
    }
  }
  // plazas de base con baldosas
  for (const [bx, bz, col] of [[-52, -52, '#4da6ff'], [52, 52, '#ff5b5b']]) {
    const cx = w2m(bx), cy = w2m(bz);
    g.fillStyle = '#cfc6b4'; g.beginPath(); g.arc(cx, cy, 105, 0, 7); g.fill();
    g.strokeStyle = '#8a7f66'; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, 105, 0, 7); g.stroke();
    g.strokeStyle = 'rgba(90,80,60,0.5)'; g.lineWidth = 3;
    for (let r = 30; r < 105; r += 24) { g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); }
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 105, cy + Math.sin(a) * 105); g.stroke();
    }
    g.fillStyle = col + '44'; g.beginPath(); g.arc(cx, cy, 105, 0, 7); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function buildWorld(scene) {
  const colliders = []; // {x,z,r}
  // lights
  scene.fog = new THREE.Fog(0x9fc5e8, 90, 260);
  const hemi = new THREE.HemisphereLight(0xbdd8ff, 0x3a5f3a, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d0, 1.6);
  sun.position.set(60, 90, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.15));

  // sky dome
  const skyGeo = new THREE.SphereGeometry(400, 16, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x2a4d8f) }, mid: { value: new THREE.Color(0x9fc5e8) }, bot: { value: new THREE.Color(0xf6d9a0) } },
    vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top,mid,bot; void main(){ float h=normalize(vP).y; vec3 c=h>0.15?mix(mid,top,smoothstep(0.15,0.8,h)):mix(bot,mid,smoothstep(-0.1,0.15,h)); gl_FragColor=vec4(c,1.0); }'
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // distant mountains (Genshin vibe)
  const mtnMat = new THREE.MeshLambertMaterial({ color: 0x6b8cae });
  const mtnMat2 = new THREE.MeshLambertMaterial({ color: 0x8fa9c9 });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const r = 170 + Math.random() * 40;
    const h = 40 + Math.random() * 60;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(22 + Math.random() * 18, h, 5), i % 2 ? mtnMat : mtnMat2);
    cone.position.set(Math.cos(a) * r, h / 2 - 4, Math.sin(a) * r);
    scene.add(cone);
    // snow cap
    const cap = new THREE.Mesh(new THREE.ConeGeometry(7, h * 0.28, 5), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    cap.position.set(cone.position.x, h - h * 0.14 - 4, cone.position.z);
    scene.add(cap);
  }

  // ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_SIZE + 40, MAP_SIZE + 40, 1, 1),
    new THREE.MeshLambertMaterial({ map: makeGroundTexture() })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // border cliffs
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x5a6b7d });
  for (const [x, z, w, d] of [[0, -85, 200, 8], [0, 85, 200, 8], [-85, 0, 8, 200], [85, 0, 8, 200]]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 10, d), wallMat);
    wall.position.set(x, 3, z); scene.add(wall);
  }

  // jungle trees + rocks
  // jungle trees + rocks (PBR + 3 variantes de follaje)
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.9 });
  const leafMats = [0x2e7d32, 0x43a047, 0x256b2b].map((col) => new THREE.MeshStandardMaterial({ color: col, roughness: 0.85 }));
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8d8d8d, roughness: 0.95 });
  const mossMat = new THREE.MeshStandardMaterial({ color: 0x4a7a3a, roughness: 0.9 });
  const treePositions = [];
  const laneNear = (x, z) => {
    for (const lane of Object.values(LANES))
      for (let i = 0; i < lane.length - 1; i++) {
        const [ax, az] = lane[i], [bx, bz] = lane[i + 1];
        // dist point-segment
        const dx = bx - ax, dz = bz - az;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
        const px = ax + dx * t, pz = az + dz * t;
        if (Math.hypot(x - px, z - pz) < 9) return true;
      }
    if (Math.abs(x + z) < 8) return true; // river
    if (Math.hypot(x + 52, z + 52) < 16 || Math.hypot(x - 52, z - 52) < 16) return true;
    return false;
  };
  let placed = 0, guard = 0;
  while (placed < 90 && guard++ < 2000) {
    const x = (Math.random() - 0.5) * 150, z = (Math.random() - 0.5) * 150;
    if (Math.abs(x) > 72 || Math.abs(z) > 72) continue;
    if (laneNear(x, z)) continue;
    const s = 0.8 + Math.random() * 0.9;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * s, 0.5 * s, 3 * s, 6), trunkMat);
    trunk.position.set(x, 1.5 * s, z); trunk.castShadow = true; scene.add(trunk);
    const lm = leafMats[placed % 3];
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(2.2 * s, 3.5 * s, 7), lm);
    c1.position.set(x, 3.8 * s, z); c1.castShadow = true; scene.add(c1);
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(1.5 * s, 2.4 * s, 7), leafMats[(placed + 1) % 3]);
    c2.position.set(x, 5.4 * s, z); scene.add(c2);
    colliders.push({ x, z, r: 1.0 });
    treePositions.push({ x, z });
    placed++;
  }
  for (let i = 0; i < 26; i++) {
    const x = (Math.random() - 0.5) * 130, z = (Math.random() - 0.5) * 130;
    if (laneNear(x, z)) continue;
    const sc = 0.8 + Math.random() * 1.2;
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(sc), rockMat);
    r.position.set(x, sc * 0.55, z); r.rotation.set(Math.random() * 3, Math.random() * 3, 0); r.castShadow = true; scene.add(r);
    const moss = new THREE.Mesh(new THREE.SphereGeometry(sc * 0.7, 8, 6), mossMat); // musgo encima
    moss.position.set(x, sc * 1.05, z); moss.scale.y = 0.45; scene.add(moss);
    colliders.push({ x, z, r: sc });
  }
  // glowing waypoint statues (Genshin Statues of Seven vibe)
  const statueMat = new THREE.MeshLambertMaterial({ color: 0x9aa7b8, emissive: 0x223344 });
  for (const [x, z] of [[-20, -20], [20, 20], [-40, 30], [30, -40]]) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 1.2, 8), rockMat);
    base.position.set(x, 0.6, z); scene.add(base);
    const st = new THREE.Mesh(new THREE.BoxGeometry(1, 3.4, 1), statueMat);
    st.position.set(x, 2.8, z); st.castShadow = true; scene.add(st);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), new THREE.MeshBasicMaterial({ color: 0x7bffea }));
    orb.position.set(x, 4.9, z); orb.userData.float = true; scene.add(orb);
    colliders.push({ x, z, r: 2.2 });
  }

  // bushes (tall grass patches)
  const bushGeo = new THREE.ConeGeometry(1.1, 1.2, 5);
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x2f8f3a, roughness: 0.9 });
  const bushes = [];
  for (let i = 0; i < 80; i++) {
    const x = (Math.random() - 0.5) * 140, z = (Math.random() - 0.5) * 140;
    if (Math.abs(x) > 70 || Math.abs(z) > 70) continue;
    const b = new THREE.Mesh(bushGeo, bushMat);
    b.position.set(x, 0.5, z);
    b.rotation.y = Math.random() * 6;
    scene.add(b); bushes.push(b);
  }

  // chests (jungle gold)
  const chests = [];
  const chestSpots = [[-35, 5], [5, -35], [35, -5], [-5, 35], [-15, -45], [45, 15]];
  const chestMat = new THREE.MeshLambertMaterial({ color: 0x8a5a2b });
  const goldMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
  for (const [x, z] of chestSpots) {
    const grp = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 1.2), chestMat);
    box.position.y = 0.5; box.castShadow = true; grp.add(box);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 1.2), new THREE.MeshLambertMaterial({ color: 0xa06a35 }));
    lid.position.y = 1.1; grp.add(lid);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), goldMat);
    glow.position.y = 1.7; grp.add(glow);
    grp.position.set(x, 0, z);
    scene.add(grp);
    chests.push({ mesh: grp, glow, x, z, taken: false, respawn: 0 });
  }

  // tower spot helper
  function lanePoint(lane, t) {
    // piecewise interpolate
    const pts = LANES[lane];
    const segs = pts.length - 1;
    const f = t * segs, i = Math.min(segs - 1, Math.floor(f)), u = f - i;
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    return [ax + (bx - ax) * u, az + (bz - az) * u];
  }
  const towerSpots = [];
  for (const lane of ['mid', 'top', 'bot']) {
    const [bx, bz] = lanePoint(lane, 0.32);
    const [rx, rz] = lanePoint(lane, 0.68);
    towerSpots.push({ lane, team: 'blue', x: bx, z: bz });
    towerSpots.push({ lane, team: 'red', x: rx, z: rz });
  }

  // ---- hierba instanciada (1 draw call) ----
  {
    const tuft = new THREE.ConeGeometry(0.16, 0.75, 4);
    const tuftMat = new THREE.MeshStandardMaterial({ color: 0x55a04a, roughness: 0.9 });
    const COUNT = 550;
    const inst = new THREE.InstancedMesh(tuft, tuftMat, COUNT);
    const d = new THREE.Object3D();
    let n = 0, guard = 0;
    while (n < COUNT && guard++ < 6000) {
      const x = (Math.random() - 0.5) * 140, z = (Math.random() - 0.5) * 140;
      if (Math.abs(x) > 70 || Math.abs(z) > 70 || laneNear(x, z) || Math.abs(x + z) < 5) continue;
      d.position.set(x, 0.32, z);
      d.rotation.y = Math.random() * 6.28;
      d.scale.setScalar(0.7 + Math.random() * 1.1);
      d.updateMatrix(); inst.setMatrixAt(n, d.matrix); n++;
    }
    inst.count = n; inst.instanceMatrix.needsUpdate = true;
    scene.add(inst);
  }
  // ---- flores instanciadas con color por instancia ----
  {
    const bud = new THREE.IcosahedronGeometry(0.11, 0);
    const budMat = new THREE.MeshStandardMaterial({ roughness: 0.6 });
    const COUNT = 150;
    const inst = new THREE.InstancedMesh(bud, budMat, COUNT);
    const d = new THREE.Object3D();
    const cols = [new THREE.Color(0xffffff), new THREE.Color(0xffd94d), new THREE.Color(0xff9ec6)];
    let n = 0, guard = 0;
    while (n < COUNT && guard++ < 3000) {
      const x = (Math.random() - 0.5) * 130, z = (Math.random() - 0.5) * 130;
      if (Math.abs(x) > 68 || Math.abs(z) > 68 || laneNear(x, z)) continue;
      d.position.set(x, 0.35 + Math.random() * 0.25, z);
      d.scale.setScalar(0.8 + Math.random() * 0.9);
      d.updateMatrix(); inst.setMatrixAt(n, d.matrix);
      inst.setColorAt(n, cols[n % 3]); n++;
    }
    inst.count = n; inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    // tallos
    const stem = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 4), new THREE.MeshStandardMaterial({ color: 0x3a7a30, roughness: 0.9 }), COUNT);
    for (let i = 0; i < n; i++) {
      inst.getMatrixAt(i, d.matrix); d.matrix.decompose(d.position, d.quaternion, d.scale);
      const p = d.position.clone(); p.y = 0.2;
      d.position.copy(p); d.scale.setScalar(1); d.rotation.set(0, 0, 0); d.updateMatrix();
      stem.setMatrixAt(i, d.matrix);
    }
    stem.count = n; stem.instanceMatrix.needsUpdate = true;
    scene.add(inst); scene.add(stem);
  }
  // ---- río animado (lámina de agua con espuma en movimiento) ----
  const waterTex = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 256;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 64, 256);
    for (let i = 0; i < 26; i++) {
      g.strokeStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.4})`;
      g.lineWidth = 1 + Math.random() * 3;
      const y = Math.random() * 256;
      g.beginPath(); g.moveTo(4 + Math.random() * 10, y); g.lineTo(40 + Math.random() * 20, y + (Math.random() - 0.5) * 12); g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 7);
    return t;
  })();
  {
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x2fa8cc, transparent: true, opacity: 0.72, roughness: 0.12, metalness: 0.25, alphaMap: waterTex });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(13, 205), waterMat);
    const wg = new THREE.Group();
    water.rotation.x = -Math.PI / 2; water.position.y = 0.04;
    wg.add(water); wg.rotation.y = Math.PI * 0.75; scene.add(wg);
  }
  // ---- nubes + sol ----
  const clouds = [];
  {
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.92 });
    for (let i = 0; i < 6; i++) {
      const grp = new THREE.Group();
      const npuff = 2 + (i % 2);
      for (let k = 0; k < npuff; k++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(6 + Math.random() * 5, 10, 8), cloudMat);
        puff.position.set(k * 8 - npuff * 4, Math.random() * 2, Math.random() * 4 - 2);
        puff.scale.y = 0.45; grp.add(puff);
      }
      grp.position.set((Math.random() - 0.5) * 240, 58 + Math.random() * 20, (Math.random() - 0.5) * 240);
      scene.add(grp);
      clouds.push({ grp, sp: 0.7 + Math.random() * 0.9 });
    }
    const sc = document.createElement('canvas'); sc.width = sc.height = 128;
    const sg = sc.getContext('2d');
    const grd = sg.createRadialGradient(64, 64, 4, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,250,220,1)'); grd.addColorStop(0.35, 'rgba(255,240,190,0.85)'); grd.addColorStop(1, 'rgba(255,240,190,0)');
    sg.fillStyle = grd; sg.fillRect(0, 0, 128, 128);
    const sunSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, fog: false }));
    sunSpr.position.set(190, 150, 70); sunSpr.scale.set(90, 90, 1); scene.add(sunSpr);
  }
  // ---- polvo dorado flotante ----
  const dust = (() => {
    const N = 220;
    const arr = new Float32Array(N * 3), seeds = [];
    for (let i = 0; i < N; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 130; arr[i * 3 + 1] = Math.random() * 9; arr[i * 3 + 2] = (Math.random() - 0.5) * 130;
      seeds.push(0.3 + Math.random() * 0.9);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffe9a8, size: 0.14, transparent: true, opacity: 0.6, depthWrite: false }));
    scene.add(pts);
    return { pts, seeds, N };
  })();
  // ---- puertas chinas en las bases (pilares rojos + farolillos) ----
  const lanternMats = [];
  for (const [bx, bz] of [[-52, -52], [52, 52]]) {
    const gate = new THREE.Group();
    const pilM = new THREE.MeshStandardMaterial({ color: 0xa8232a, roughness: 0.55 });
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.8 });
    for (const s of [-1, 1]) {
      const px = bx + s * 5.2, pz = bz - s * 5.2;
      const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 7, 10), pilM);
      pil.position.set(px, 3.5, pz); pil.castShadow = true; scene.add(pil);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.2, 0.8, 10), new THREE.MeshStandardMaterial({ color: 0x9a938a, roughness: 0.9 }));
      base.position.set(px, 0.4, pz); scene.add(base);
      const lantM = new THREE.MeshStandardMaterial({ color: 0xff9a2a, emissive: 0xff7b00, emissiveIntensity: 1.6, roughness: 0.4 });
      const lant = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), lantM);
      lant.position.set(px, 5.6, pz); lant.scale.y = 1.2; scene.add(lant);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.3, 0.3, 8), darkWood);
      cap.position.set(px, 6.25, pz); scene.add(cap);
      lanternMats.push(lantM);
      gate.userData['p' + s] = pil;
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 14.5), darkWood);
    lintel.position.set(bx, 7.2, bz); lintel.rotation.y = Math.PI / 4; lintel.castShadow = true; scene.add(lintel);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.4, 4), new THREE.MeshStandardMaterial({ color: 0x2b4a3f, roughness: 0.7 }));
    roof.position.set(bx, 8.4, bz); roof.rotation.y = Math.PI / 4; scene.add(roof);
    colliders.push({ x: bx + 5.2, z: bz - 5.2, r: 1.2 }, { x: bx - 5.2, z: bz + 5.2, r: 1.2 });
  }

  function updateWorld(dt, t) {
    waterTex.offset.y -= dt * 0.22;
    for (const c of clouds) {
      c.grp.position.x += c.sp * dt;
      if (c.grp.position.x > 140) c.grp.position.x = -140;
    }
    const arr = dust.pts.geometry.attributes.position.array;
    for (let i = 0; i < dust.N; i++) {
      arr[i * 3 + 1] += dust.seeds[i] * dt;
      arr[i * 3] += Math.sin(t * 0.5 + i) * dt * 0.3;
      if (arr[i * 3 + 1] > 9.5) arr[i * 3 + 1] = 0;
    }
    dust.pts.geometry.attributes.position.needsUpdate = true;
    lanternMats.forEach((m, i) => { m.emissiveIntensity = 1.5 + Math.sin(t * 3 + i * 1.7) * 0.35; });
  }

  return { colliders, towerSpots, chests, bushes, lanePoint, sun, hemi, updateWorld };
}
