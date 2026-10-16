# PlayGround — Teyvat Rift: Elemental Arena

> Genshin Impact × League of Legends 3D MOBA prototype (Desktop + Web). Open-world exploration meets lane-push MOBA.

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://omgithub.com).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://omgithub.com/cacademonodemonodecaca/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/cacademonodemonodecaca/PlayGround)

- 🎮 [Open the project](https://omgithub.com/cacademonodemonodecaca/PlayGround).
- ✨ [Remix this project](https://omgithub.com/?remix=cacademonodemonodecaca%2FPlayGround).
- 💻 [Explore the source](https://github.com/cacademonodemonodecaca/PlayGround).
- 🛠️ [Check build runs](https://github.com/cacademonodemonodecaca/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/cacademonodemonodecaca/PlayGround/issues).
- 👤 [Explore the creator's projects](https://omgithub.com/cacademonodemonodecaca).
- 🌍 [Create with OMGithub](https://omgithub.com).
<!-- omgithub:readme:end -->

## ⚔️ Teyvat Rift — Genshin × LoL 3D (Desktop)

3v3 single-player MOBA with Genshin-style third-person exploration:
- **Genshin:** WASD + jump + hold-Space glide, stamina sprint, jungle chests, statues, elemental reactions (Pyro + Anemo = Swirl), 3 heroes
- **LoL:** 3 lanes + river, 6 turrets + 2 Nexuses, minion waves, last-hit gold, XP 1-18, Q/W/E/R + ultimate at 6, shop (B), minimap, KDA, Tab scoreboard, 5 bot AI

### Run (web preview / desktop browser)
```bash
npm install
npm run dev -- --port 3002 --host   # play at http://localhost:3002
npm run build                        # outputs dist/ (served by start.sh)
```

### Run as Desktop (Electron)
```bash
npm run build
ELECTRON_START_URL=http://localhost:3002 npm run electron   # dev
# or packaged:
npm run start:desktop
```

### Controls
`WASD` mover • arrastrar ratón órbita • rueda zoom • `Espacio` salto / mantén para planear • `Shift` sprint • Habilidades: `Z`/`X`/`C`/`V` (también `1`/`2`/`3`/`4` o `J`/`K`/`L`/`I`) • `F` o clic-izq atacar • clic-der mover estilo LoL • `B` tienda • `Tab` puntos

Waifus: 🔥 Yan Fei (Pyro) • 🌪️ Lan Yun (Anemo) • 💎 Ning Mei (Geo) — modelos anime 3D procedurales con ojos, cabello largo, qipao y animación idle/caminar. Render realista ACES + PBR.

Win by destroying the red Nexus at (52,52). Bots push lanes automatically — follow your minions!

Stack: Three.js + Vite, SwiftShader-compatible.
- **Modelos 3D reales (Sketchfab, CC Attribution):** `public/models/` — Yan Fei = "Anime School Girl (rigged)" de Sxnneh, Ning Mei = "Anime schoolgirl in uniform" de arcyaa, Lan Yun = "Intruder and Alternate - Mandela Catalogue" de Vibapop (terror analógico con ojos orbitales y esporas). Ver `*.attribution.json` en cada modelo. Si la red falla, el juego usa modelos procedurales de respaldo automáticamente.
- **🔫 AK-47 + modo CSGO (1200 oro en tienda):** al comprarlo la cámara pasa a primera persona con el rifle en mano — clic/F disparar (hitscan con headshot x2.2, trazadoras y hitmarker), R recargar (30/∞), G alternarFPS/tercera persona, ratón con pointer-lock. WASD corregido (W avanza hacia donde miras).
- **👁️ Lan Yun, horror fuera de la comprensión humana:** masa abisal flotante 100% procedural y animada — 8 tentáculos ondulantes con ojos y aguijones, enjambre de 9 ojos que parpadean, corona de 7 cuernos, fauces dentadas con brillo infernal, 5 fragmentos orbitales, esporas oscuras en espiral y anillo/alas teñidos de púrpura.
- **Minions ultra-detallados:** soldados acorazados (coraza metálica PBR, yelmo con penacho, visor brillante, escudo con tachón, lanza con punta de acero) y taumaturgos encapuchados flotantes (túnica, rostro en sombra con ojos arcanos, báculo con orbe y halo).
- **Mapa realista:** textura de suelo 2048 (losas, briznas, flores, plazas embaldosadas), 550 matas de hierba + 150 flores instanciadas, río animado con espuma, nubes a la deriva, sol, polvo dorado, puertas chinas con farolillos parpadeantes en las bases, rocas con musgo, torretas con estandartes, runas y braseros.
- **Tienda:** incluye 🍡 Dango de 1 oro (+80 HP al instante, cuesta solo 1 de oro).

