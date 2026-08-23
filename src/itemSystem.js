export const RARITY_ORDER = [
  'COMMON', 'RARE', 'EPIC', 'LEGENDARY',
  'MYTHIC', 'ANCIENT', 'RELIC', 'CELESTIAL', 'ABYSSAL',
  'ELDRITCH', 'DIVINE', 'PRIMORDIAL', 'TRANSCENDENT', 'ETERNAL',
];

export const ITEM_RARITIES = {
  COMMON:       { name: 'Обычный',           color: '#64748b', border: 'border-slate-500' },
  RARE:         { name: 'Редкий',             color: '#0ea5e9', border: 'border-sky-400' },
  EPIC:         { name: 'Эпический',          color: '#a855f7', border: 'border-purple-500' },
  LEGENDARY:    { name: 'Легендарный',        color: '#f59e0b', border: 'border-amber-400' },
  MYTHIC:       { name: 'Мифический',         color: '#f43f5e', border: 'border-rose-500' },
  ANCIENT:      { name: 'Древний',            color: '#fb7185', border: 'border-rose-300' },
  RELIC:        { name: 'Реликтовый',         color: '#f97316', border: 'border-orange-500' },
  CELESTIAL:    { name: 'Небесный',           color: '#22d3ee', border: 'border-cyan-400' },
  ABYSSAL:      { name: 'Бездонный',          color: '#6366f1', border: 'border-indigo-500' },
  ELDRITCH:     { name: 'Запредельный',       color: '#d946ef', border: 'border-fuchsia-500' },
  DIVINE:       { name: 'Божественный',       color: '#fde047', border: 'border-yellow-300' },
  PRIMORDIAL:   { name: 'Первородный',        color: '#34d399', border: 'border-emerald-400' },
  TRANSCENDENT: { name: 'Трансцендентный',    color: '#f0abfc', border: 'border-fuchsia-300' },
  ETERNAL:      { name: 'Вечный',             color: '#ffffff', border: 'border-white' },
};

export const EMBER_JUNK_THRESHOLD = 11;
const LOOT_DROP_CHANCE = 1.3;
const BASE_RANGES = {
  COMMON: [4, 7], RARE: [9, 14], EPIC: [17, 25], LEGENDARY: [30, 45],
};
const BASE_PRICES = { COMMON: 20, RARE: 50, EPIC: 120, LEGENDARY: 350 };
const BASE_JUNK = { COMMON: 1, RARE: 4, EPIC: 10, LEGENDARY: 25 };
const BASE_BURN_XP = { COMMON: 4, RARE: 8, EPIC: 16, LEGENDARY: 30 };

const POST_LEGENDARY = RARITY_ORDER.slice(4);
POST_LEGENDARY.forEach((rarity, index) => {
  const previous = index === 0 ? BASE_RANGES.LEGENDARY : BASE_RANGES[POST_LEGENDARY[index - 1]];
  BASE_RANGES[rarity] = [Math.round(previous[0] * 1.5), Math.round(previous[1] * 1.5)];
  BASE_PRICES[rarity] = Math.round(BASE_PRICES.LEGENDARY * Math.pow(1.6, index + 1));
  BASE_JUNK[rarity] = Math.round(BASE_JUNK.LEGENDARY * Math.pow(1.65, index + 1));
  BASE_BURN_XP[rarity] = Math.round(BASE_BURN_XP.LEGENDARY * Math.pow(1.5, index + 1));
});

export const RARITY_TINT = Object.fromEntries(
  RARITY_ORDER.map(rarity => [rarity, rarity === 'COMMON' ? null : ITEM_RARITIES[rarity].color]),
);

const PREFIXES = Object.fromEntries(RARITY_ORDER.map(rarity => [rarity, ITEM_RARITIES[rarity].name]));
PREFIXES.COMMON = '';

const ITEM_TEMPLATES = [
  { name: 'Инструменты палача', icon: 'item_11.webp', rarity: 'COMMON' },
  { name: 'Запас зелий', icon: 'item_13.webp', rarity: 'COMMON' },
  { name: 'Статуя горгульи', icon: 'item_14.webp', rarity: 'COMMON' },
  { name: 'Зловещий кинжал', icon: 'item_20.webp', rarity: 'COMMON' },
  { name: 'Ступка алхимика', icon: 'item_31.webp', rarity: 'COMMON' },
  { name: 'Кожаная перчатка', icon: 'item_34.webp', rarity: 'COMMON' },
  { name: 'Связка ключей', icon: 'item_36.webp', rarity: 'COMMON' },
  { name: 'Проклятые монеты', icon: 'item_39.webp', rarity: 'COMMON' },
  { name: 'Канделябр', icon: 'item_41.webp', rarity: 'COMMON' },
  { name: 'Забытая шестерня', icon: 'item_43.webp', rarity: 'COMMON' },
  { name: 'Свиток нетопыря', icon: 'item_45.webp', rarity: 'COMMON' },
  { name: 'Астролябия', icon: 'item_15.webp', rarity: 'RARE' },
  { name: 'Кости предков', icon: 'item_30.webp', rarity: 'RARE' },
  { name: 'Букет аконита', icon: 'item_32.webp', rarity: 'RARE' },
  { name: 'Рунические камни', icon: 'item_33.webp', rarity: 'RARE' },
  { name: 'Фляга с ядом', icon: 'item_38.webp', rarity: 'RARE' },
  { name: 'Ржавые кандалы', icon: 'item_42.webp', rarity: 'RARE' },
  { name: 'Перо и чернила', icon: 'item_44.webp', rarity: 'RARE' },
  { name: 'Древний гримуар', icon: 'item_10.webp', rarity: 'EPIC' },
  { name: 'Череп ворона', icon: 'item_12.webp', rarity: 'EPIC' },
  { name: 'Терновый венец', icon: 'item_25.webp', rarity: 'EPIC' },
  { name: 'Рутиловый кристалл', icon: 'item_35.webp', rarity: 'EPIC' },
  { name: 'Крылатый череп', icon: 'item_37.webp', rarity: 'EPIC' },
  { name: 'Зеркало скорби', icon: 'item_40.webp', rarity: 'LEGENDARY' },
  { name: 'Проклятый гроб', icon: 'item_46.webp', rarity: 'LEGENDARY' },
];

const shuffle = (array) => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const rollStats = (rarity) => {
  const [min, max] = BASE_RANGES[rarity] || BASE_RANGES.COMMON;
  const tier = Math.max(0, RARITY_ORDER.indexOf(rarity));
  const count = Math.min(4, 1 + Math.floor((tier + 1) / 2));
  const damageStat = Math.random() < 0.5 ? 'atk' : 'matk';
  const pool = shuffle([damageStat, 'crit', 'hp']).slice(0, count);
  const stats = {};
  pool.forEach((stat, index) => {
    const base = min + Math.floor(Math.random() * (max - min + 1));
    let value = Math.max(1, Math.round(base * (index === 0 ? 1 : 0.42)));
    if (stat === 'hp') value = Math.max(4, Math.round(value * 2.5));
    if (stat === 'crit') value = Math.max(1, Math.round(value * 0.5));
    stats[stat] = value;
  });
  return stats;
};

const pickTemplate = (rarity) => {
  const targetIndex = RARITY_ORDER.indexOf(rarity);
  const native = ITEM_TEMPLATES.filter(item => RARITY_ORDER.indexOf(item.rarity) === targetIndex);
  if (native.length) return { template: native[Math.floor(Math.random() * native.length)], tinted: false };
  const available = ITEM_TEMPLATES.filter(item => RARITY_ORDER.indexOf(item.rarity) <= targetIndex);
  return { template: available[Math.floor(Math.random() * available.length)], tinted: true };
};

export const getItemIconUrl = (icon) => `./icons/${icon}`;
export const sortItemsByRarity = (items) => [...items].sort((left, right) => {
  const rarityDelta = RARITY_ORDER.indexOf(right?.rarity) - RARITY_ORDER.indexOf(left?.rarity);
  if (rarityDelta !== 0) return rarityDelta;
  return String(left?.name || '').localeCompare(String(right?.name || ''), 'ru');
});
export const sortUniqueItemsByRarity = (items) => {
  const uniqueItems = new Map();
  items.filter(Boolean).forEach((item) => {
    if (item.uid) uniqueItems.set(item.uid, item);
  });
  return sortItemsByRarity([...uniqueItems.values()]);
};
export const getNextRarity = (rarity) => {
  const index = RARITY_ORDER.indexOf(rarity);
  return index >= 0 && index < RARITY_ORDER.length - 1 ? RARITY_ORDER[index + 1] : null;
};
export const getItemBuyPrice = (item) => BASE_PRICES[item?.rarity] || BASE_PRICES.COMMON;
export const getItemSellPrice = (item) => Math.max(1, Math.round(getItemBuyPrice(item) * 0.35));
export const getItemBurnXp = (item) => BASE_BURN_XP[item?.rarity] || 0;
export const getItemJunkPoints = (item) => BASE_JUNK[item?.rarity] || 0;
export const sumJunkPoints = (items) => items.reduce((total, item) => total + getItemJunkPoints(item), 0);

export const generateItemOfRarity = (rarity) => {
  const safeRarity = ITEM_RARITIES[rarity] ? rarity : 'COMMON';
  const { template, tinted } = pickTemplate(safeRarity);
  const prefix = PREFIXES[safeRarity];
  return {
    uid: `item_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    name: tinted && prefix ? `${prefix} ${template.name.toLowerCase()}` : template.name,
    icon: template.icon,
    rarity: safeRarity,
    tinted,
    stats: rollStats(safeRarity),
  };
};

export const rollItemRarity = (sector = 1, stage = 0) => {
  const depth = Math.max(0, (sector - 1) * 6 + Math.max(0, stage - 1));
  const t = Math.min(1, depth / 22);
  const weights = [
    ['COMMON', Math.round(78 - t * 38)],
    ['RARE', Math.round(16 + t * 14)],
    ['EPIC', Math.round(5 + t * 15)],
    ['LEGENDARY', Math.round(1 + t * 9)],
  ];
  let roll = Math.random() * weights.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [rarity, weight] of weights) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  return 'COMMON';
};

export const rollLootDrops = (sector = 1, stage = 0) => {
  const count = Math.floor(LOOT_DROP_CHANCE) + (Math.random() < LOOT_DROP_CHANCE % 1 ? 1 : 0);
  return Array.from({ length: count }, () => generateItemOfRarity(rollItemRarity(sector, stage)));
};

export const createShopStock = (count = 35) => Array.from({ length: count }, (_, index) => {
  // Первые десять ячеек гарантируют по одному предмету каждого shop-tier.
  if (index < POST_LEGENDARY.length) return generateItemOfRarity(POST_LEGENDARY[index]);
  // Остаток ассортимента смещён к нижним сверхлегендарным редкостям.
  const tier = Math.min(
    POST_LEGENDARY.length - 1,
    Math.floor(Math.pow(Math.random(), 1.8) * POST_LEGENDARY.length),
  );
  return generateItemOfRarity(POST_LEGENDARY[tier]);
});
