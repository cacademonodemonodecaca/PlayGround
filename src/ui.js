import { SHOP_ITEMS } from './config.js';

export function initUI(game) {
  const $ = (id) => document.getElementById(id);
  const ui = {
    hpFill: $('hp-fill'), hpText: $('hp-text'), mpFill: $('mp-fill'), mpText: $('mp-text'),
    xpFill: $('xp-fill'), level: $('level-badge'), gold: $('gold'), kda: $('kda'),
    stamina: $('stamina-fill'), timer: $('match-timer'),
    sb: $('score-blue'), sr: $('score-red'),
    feed: $('killfeed'), announce: $('announce'),
    shop: $('shop'), shopItems: $('shop-items'), scoreboard: $('scoreboard'),
    cds: { q: document.querySelector('#ab-q i'), w: document.querySelector('#ab-w i'), e: document.querySelector('#ab-e i'), r: document.querySelector('#ab-r i') },
    abs: { q: $('ab-q'), w: $('ab-w'), e: $('ab-e'), r: $('ab-r') },
    mmap: $('minimap').getContext('2d'),
  };
  // shop render
  ui.shopItems.innerHTML = '';
  for (const it of SHOP_ITEMS) {
    const d = document.createElement('div');
    d.className = 'shop-item';
    d.innerHTML = `<b>${it.name}</b><div style="font-size:12px;opacity:.8">${it.desc}</div><div style="color:gold">💰 ${it.cost}</div>`;
    d.onclick = () => game.buyItem(it.id);
    ui.shopItems.appendChild(d);
  }
  ui.say = (t, ms = 1800) => {
    ui.announce.textContent = t;
    ui.announce.style.opacity = 1;
    clearTimeout(ui.say._t);
    ui.say._t = setTimeout(() => (ui.announce.style.opacity = 0), ms);
  };
  ui.feedKill = (killer, victim, team) => {
    const d = document.createElement('div');
    d.className = 'kill';
    d.innerHTML = `<span style="color:${team === 'blue' ? '#5db4ff' : '#ff6b6b'}">⚔ ${killer}</span> → ${victim}`;
    ui.feed.prepend(d);
    while (ui.feed.children.length > 5) ui.feed.lastChild.remove();
    setTimeout(() => d.remove(), 6000);
  };
  ui.updateScoreboard = () => {
    const rows = game.heroes.map((h) => `<tr><td>${h.isPlayer ? '⭐' : ''}${h.name}</td><td>${h.team}</td><td>${h.level}</td><td>${h.kills}/${h.deaths}/${h.assists}</td><td>${Math.round(h.gold)}</td><td>${Math.round(h.ad)}/${Math.round(h.ap)}</td></tr>`).join('');
    ui.scoreboard.innerHTML = `<h3>Scoreboard <small>(TAB)</small></h3><table><tr><th>Hero</th><th>Team</th><th>Lv</th><th>KDA</th><th>Gold</th><th>AD/AP</th></tr>${rows}</table>`;
  };
  ui.drawMinimap = () => {
    const g = ui.mmap, S = 180;
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#12240f'; g.fillRect(0, 0, S, S);
    const w2m = (v) => ((v + 70) / 140) * S;
    // river
    g.strokeStyle = '#3fa7d6'; g.lineWidth = 8;
    g.beginPath(); g.moveTo(0, S); g.lineTo(S, 0); g.stroke();
    // lanes approx
    g.strokeStyle = '#c9b183'; g.lineWidth = 3;
    const lanes = [
      [[w2m(-52), w2m(-52)], [w2m(-52), w2m(20)], [w2m(-20), w2m(52)], [w2m(20), w2m(52)], [w2m(52), w2m(52)]],
      [[w2m(-52), w2m(-52)], [w2m(-30), w2m(-30)], [w2m(52), w2m(52)]],
      [[w2m(-52), w2m(-52)], [w2m(20), w2m(-52)], [w2m(52), w2m(-20)], [w2m(52), w2m(52)]],
    ];
    for (const l of lanes) { g.beginPath(); l.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
    const dot = (x, z, color, r = 3) => { g.fillStyle = color; g.beginPath(); g.arc(w2m(x), w2m(z), r, 0, 7); g.fill(); };
    for (const t of game.towers) if (t.alive) dot(t.pos.x, t.pos.z, t.team === 'blue' ? '#4da6ff' : '#ff5b5b', t.kind === 'nexus' ? 6 : 4);
    for (const m of game.minions) if (m.alive) dot(m.pos.x, m.pos.z, m.team === 'blue' ? '#9ecbff' : '#ff9a9a', 1.6);
    for (const h of game.heroes) if (h.alive) dot(h.pos.x, h.pos.z, h.isPlayer ? '#ffe14d' : h.team === 'blue' ? '#1aff66' : '#ff2222', h.isPlayer ? 4.5 : 3.2);
    // view box
    if (game.player) dot(game.player.pos.x, game.player.pos.z, '#ffffff', 1);
  };
  return ui;
}
