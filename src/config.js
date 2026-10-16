export const MAP_SIZE = 140;
export const HEROES = {
  aether: { name: 'Yan Fei', title: 'Blazing Lawyer', icon: '🔥', color: 0xff5a3c, hair: 0x2b1a12, hairLong: true, dress: 0xc62f3b, accent: 0xffd166, hp: 620, mp: 320, ad: 62, ap: 40, armor: 28, speed: 9.5, range: 3.2, element: 'pyro', desc: 'Pyro • waifu equilibrada' },
  anemo: { name: 'Lan Yun', title: 'Horror de la Grieta', icon: '👁️', color: 0x7a2bd8, hair: 0x0d0518, hairLong: false, dress: 0x140a24, accent: 0xb44dff, hp: 520, mp: 380, ad: 55, ap: 65, armor: 22, speed: 11, range: 9, element: 'anemo', desc: 'Horror • indescriptible' },
  geo: { name: 'Ning Mei', title: 'Jade Guard', icon: '💎', color: 0xd8b45a, hair: 0xd9c9a8, hairLong: true, dress: 0x8a6d2b, accent: 0xfff2c0, hp: 820, mp: 260, ad: 58, ap: 20, armor: 45, speed: 8.2, range: 3.0, element: 'geo', desc: 'Geo • waifu tanque' },
};
export const BOT_DEFS = [
  { hero: 'anemo', lane: 'top' },
  { hero: 'geo', lane: 'bot' },
];
export const ENEMY_DEFS = [
  { hero: 'aether', lane: 'top', name: 'Hu Tao' },
  { hero: 'anemo', lane: 'mid', name: 'Xiao Qing' },
  { hero: 'geo', lane: 'bot', name: 'Bei Dou' },
];
export const LANES = {
  // waypoints from blue base (-52,-52) to red base (52,52)
  mid: [[-52, -52], [-30, -30], [-12, -12], [12, 12], [30, 30], [52, 52]],
  top: [[-52, -52], [-52, 20], [-20, 52], [20, 52], [52, 52]],
  bot: [[-52, -52], [20, -52], [52, -20], [52, 20], [52, 52]],
};
export const SHOP_ITEMS = [
  { id: 'dango', name: '🍡 Dango de 1 oro', cost: 1, heal: 80, desc: '+80 HP al instante • ¡solo 1 de oro!' },
  { id: 'ak47', name: '🔫 AK-47 Táctico', cost: 1200, desc: 'FPS estilo CSGO: clic disparar • R recargar • G alternar' },
  { id: 'sword', name: '🗡️ Ember Blade', cost: 350, ad: 18, ap: 0, hp: 0, desc: '+18 AD' },
  { id: 'tome', name: '📖 Anemo Tome', cost: 350, ad: 0, ap: 25, hp: 0, desc: '+25 AP' },
  { id: 'armor', name: '🛡️ Geo Plate', cost: 300, ad: 0, ap: 0, hp: 200, armor: 15, desc: '+200 HP +15 armor' },
  { id: 'boots', name: '🥾 Wind Boots', cost: 300, speed: 1.2, desc: '+12% move speed' },
  { id: 'infinity', name: '⚔️ Rift Edge', cost: 900, ad: 45, ap: 30, hp: 150, desc: '+45AD +30AP +150HP' },
  { id: 'potion', name: '🧪 Mondstadt Stew', cost: 150, heal: 300, desc: 'Heal 300 on buy' },
];
