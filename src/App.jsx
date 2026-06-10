import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// --- 1. КОНСТАНТЫ И НАСТРОЙКИ ---

const MAX_MANA = 5;
const NUM_STAGES = 15; 
const STAGE_WIDTH = 160; 

const RARITIES = {
  COMMON: { name: 'Обычная', border: 'border-slate-500', header: 'bg-[#4a3b69]', text: 'text-slate-300', badgeBg: 'bg-slate-500' }, 
  RARE: { name: 'Редкая', border: 'border-[#0EA5E9]', header: 'bg-[#3b5384]', text: 'text-[#0EA5E9]', badgeBg: 'bg-[#0EA5E9]' },     
  EPIC: { name: 'Эпическая', border: 'border-purple-600', header: 'bg-[#7a3b3b]', text: 'text-purple-300', badgeBg: 'bg-purple-600' }, 
  LEGENDARY: { name: 'Легендарная', border: 'border-amber-400', header: 'bg-[#8a6b3b]', text: 'text-amber-400', badgeBg: 'bg-amber-500' }
};

const INITIAL_PLAYERS_DATA = [
  { id: 'p1', name: 'Воин', baseMaxHp: 35, hp: 50, maxHp: 50, str: 15, agi: 5, int: 2, icon: '🛡️', bg: 'bg-blue-900', currentCard: null, hasActed: false },
  { id: 'p2', name: 'Разбойник', baseMaxHp: 29, hp: 35, maxHp: 35, str: 6, agi: 18, int: 4, icon: '🗡️', bg: 'bg-green-900', currentCard: null, hasActed: false },
  { id: 'p3', name: 'Маг', baseMaxHp: 23, hp: 25, maxHp: 25, str: 2, agi: 6, int: 20, icon: '🔮', bg: 'bg-purple-900', currentCard: null, hasActed: false },
];

// Базовые эффекты характеристик (за 1 очко)
const STAT_EFFECTS = {
  str: { hp: 1, universalDmg: 0.35 },
  dex: { rangedDmg: 1, critChance: 0.01 },
  int: { magicDmg: 1, splashPower: 0.05 },
};

// Классовые веса (для справки / будущей экипировки)
const CLASS_WEIGHTS = {
  p1: { str: 1.0, dex: 0.35, int: 0.2 },
  p2: { str: 0.45, dex: 1.0, int: 0.3 },
  p3: { str: 0.3, dex: 0.4, int: 1.0 },
};

const INVENTORY_SIZE = 9;
const LOOT_DROP_CHANCE = 0.65;
const ITEM_RARITY_WEIGHTS = { COMMON: 68, RARE: 21, EPIC: 9, LEGENDARY: 2 };
const ITEM_BURN_XP = { COMMON: 4, RARE: 8, EPIC: 16, LEGENDARY: 30 };
const getItemBurnXp = (item) => (item && ITEM_BURN_XP[item.rarity]) || 0;
// Главный стат предмета — чёткая градация по рарности, ощутимые значения
const ITEM_STAT_RANGES = {
  COMMON: { min: 4, max: 7 },
  RARE: { min: 9, max: 14 },
  EPIC: { min: 17, max: 25 },
  LEGENDARY: { min: 30, max: 45 },
};
// Вторичный стат: шанс появления и доля от главного
const ITEM_SECONDARY = {
  COMMON: { chance: 0, ratio: 0 },
  RARE: { chance: 0.4, ratio: 0.35 },
  EPIC: { chance: 0.7, ratio: 0.45 },
  LEGENDARY: { chance: 1.0, ratio: 0.55 },
};
// Префикс названия отражает редкость
const ITEM_RARITY_PREFIX = {
  COMMON: '',
  RARE: 'Редкий',
  EPIC: 'Эпический',
  LEGENDARY: 'Легендарный',
};

// Каждый предмет имеет ФИКСИРОВАННУЮ базовую рарность (названия соответствуют иконкам).
// Распределение пирамидой: больше всего обычных, меньше редких/эпиков, мало легендарок.
const ITEM_TEMPLATES = [
  // COMMON (11)
  { name: 'Инструменты палача', icon: 'item_11.png', focus: 'str', rarity: 'COMMON' },
  { name: 'Запас зелий', icon: 'item_13.png', focus: 'dex', rarity: 'COMMON' },
  { name: 'Статуя горгульи', icon: 'item_14.png', focus: 'str', rarity: 'COMMON' },
  { name: 'Зловещий кинжал', icon: 'item_20.png', focus: 'dex', rarity: 'COMMON' },
  { name: 'Ступка алхимика', icon: 'item_31.png', focus: 'int', rarity: 'COMMON' },
  { name: 'Кожаная перчатка', icon: 'item_34.png', focus: 'dex', rarity: 'COMMON' },
  { name: 'Связка ключей', icon: 'item_36.png', focus: 'dex', rarity: 'COMMON' },
  { name: 'Проклятые монеты', icon: 'item_39.png', focus: 'dex', rarity: 'COMMON' },
  { name: 'Канделябр', icon: 'item_41.png', focus: 'int', rarity: 'COMMON' },
  { name: 'Забытая шестерня', icon: 'item_43.png', focus: 'str', rarity: 'COMMON' },
  { name: 'Свиток нетопыря', icon: 'item_45.png', focus: 'int', rarity: 'COMMON' },
  // RARE (7)
  { name: 'Астролябия', icon: 'item_15.png', focus: 'int', rarity: 'RARE' },
  { name: 'Кости предков', icon: 'item_30.png', focus: 'str', rarity: 'RARE' },
  { name: 'Букет аконита', icon: 'item_32.png', focus: 'int', rarity: 'RARE' },
  { name: 'Рунические камни', icon: 'item_33.png', focus: 'int', rarity: 'RARE' },
  { name: 'Фляга с ядом', icon: 'item_38.png', focus: 'dex', rarity: 'RARE' },
  { name: 'Ржавые кандалы', icon: 'item_42.png', focus: 'str', rarity: 'RARE' },
  { name: 'Перо и чернила', icon: 'item_44.png', focus: 'int', rarity: 'RARE' },
  // EPIC (5)
  { name: 'Древний гримуар', icon: 'item_10.png', focus: 'int', rarity: 'EPIC' },
  { name: 'Череп ворона', icon: 'item_12.png', focus: 'int', rarity: 'EPIC' },
  { name: 'Терновый венец', icon: 'item_25.png', focus: 'int', rarity: 'EPIC' },
  { name: 'Рутиловый кристалл', icon: 'item_35.png', focus: 'int', rarity: 'EPIC' },
  { name: 'Крылатый череп', icon: 'item_37.png', focus: 'str', rarity: 'EPIC' },
  // LEGENDARY (2)
  { name: 'Зеркало скорби', icon: 'item_40.png', focus: 'int', rarity: 'LEGENDARY' },
  { name: 'Проклятый гроб', icon: 'item_46.png', focus: 'str', rarity: 'LEGENDARY' },
];

// Цвет тинта по рарности — позволяет «перекрашивать» базовую иконку под новую рарность
const RARITY_TINT = {
  COMMON: null,
  RARE: '#0EA5E9',
  EPIC: '#a855f7',
  LEGENDARY: '#f59e0b',
};

const getItemIconUrl = (icon) => `./icons/${icon}`;

// Иконка предмета с опциональным цветным оверлеем (тинтом) для перекрашенной рарности
const ItemIcon = ({ item, className = '', imgClassName = 'w-full h-full object-cover' }) => {
  if (!item) return null;
  const tint = item.tinted ? RARITY_TINT[item.rarity] : null;
  return (
    <div className={`relative ${className}`}>
      <img src={getItemIconUrl(item.icon)} alt={item.name || ''} className={imgClassName} draggable={false} />
      {tint && (
        // Дешёвая перекраска: один полупрозрачный слой обычным наложением (без mix-blend-mode,
        // который заставлял компоновщик пересчитывать блендинг с анимированным фоном каждый кадр)
        <div className="absolute inset-0 pointer-events-none rounded-[inherit]" style={{ backgroundColor: tint, opacity: 0.5 }} />
      )}
    </div>
  );
};

// Атласы idle-анимаций персонажей игрока: спрайт-лист 1280x1280, кадр 320x320, сетка 4x4
const CHAR_ATLASES = {
  p1: { url: './chars/warrior_atlas.png', cols: 4, rows: 4, frameCount: 15, fps: 12 },
  p2: { url: './chars/rogue_atlas.png',   cols: 4, rows: 4, frameCount: 16, fps: 12 },
  p3: { url: './chars/priest_atlas.png',  cols: 4, rows: 4, frameCount: 16, fps: 12 },
};

// Зигзаг-формация бойцов игрока. Координаты из макета (контейнер 545px высотой, спрайт 254px)
// отмасштабированы под высоту арены 355px (коэф. ≈0.651).
const CHAR_SPRITE_SIZE = 166;
const CHAR_FORMATION = {
  p1: { left: 55, top: 4 },    // воин — сверху слева
  p2: { left: 221, top: 92 },  // разбойник — по центру, шаг вперёд
  p3: { left: 55, top: 171 },  // маг — снизу слева
};

// Анимированный спрайт из атласа: проигрывает кадры по сетке через background-position
const CharSprite = ({ atlas, size = 110, className = '', style = {} }) => {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!atlas) return;
    const interval = 1000 / (atlas.fps || 12);
    const id = setInterval(() => {
      setFrame((f) => (f + 1) % atlas.frameCount);
    }, interval);
    return () => clearInterval(id);
  }, [atlas]);
  if (!atlas) return null;
  const col = frame % atlas.cols;
  const row = Math.floor(frame / atlas.cols);
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${atlas.url})`,
        backgroundSize: `${atlas.cols * size}px ${atlas.rows * size}px`,
        backgroundPosition: `-${col * size}px -${row * size}px`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        ...style,
      }}
    />
  );
};

const rollItemRarity = () => {
  const total = Object.values(ITEM_RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (const [rarity, weight] of Object.entries(ITEM_RARITY_WEIGHTS)) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  return 'COMMON';
};

const RARITY_ORDER = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'];
const getNextRarity = (rarity) => {
  const idx = RARITY_ORDER.indexOf(rarity);
  return idx >= 0 && idx < RARITY_ORDER.length - 1 ? RARITY_ORDER[idx + 1] : null;
};

// Подбор шаблона под целевую рарность:
// - «родные» шаблоны этой рарности идут без тинта (с весом)
// - шаблоны более низкой рарности можно «перекрасить» под целевую (тинт) — расширяет ассортимент
const pickTemplateForRarity = (rarity) => {
  const targetIdx = RARITY_ORDER.indexOf(rarity);
  const pool = [];
  for (const t of ITEM_TEMPLATES) {
    const tIdx = RARITY_ORDER.indexOf(t.rarity);
    if (tIdx === targetIdx) {
      // родной шаблон — больший вес, чтобы доминировал
      pool.push({ template: t, tinted: false });
      pool.push({ template: t, tinted: false });
      pool.push({ template: t, tinted: false });
    } else if (tIdx < targetIdx) {
      // более низкий — перекрашиваем под целевую рарность
      pool.push({ template: t, tinted: true });
    }
  }
  if (pool.length === 0) {
    return { template: ITEM_TEMPLATES[Math.floor(Math.random() * ITEM_TEMPLATES.length)], tinted: false };
  }
  return pool[Math.floor(Math.random() * pool.length)];
};

const generateItemOfRarity = (rarity) => {
  const { template, tinted } = pickTemplateForRarity(rarity);
  const range = ITEM_STAT_RANGES[rarity];
  const mainVal = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
  const stats = { [template.focus]: mainVal };
  const sec = ITEM_SECONDARY[rarity];
  if (sec.chance > 0 && Math.random() < sec.chance) {
    const secondary = ['str', 'dex', 'int'].filter(s => s !== template.focus);
    const pick = secondary[Math.floor(Math.random() * secondary.length)];
    stats[pick] = Math.max(1, Math.round(mainVal * sec.ratio));
  }
  // Перекрашенный предмет получает префикс новой рарности, родной — своё базовое имя
  const prefix = ITEM_RARITY_PREFIX[rarity];
  const name = tinted && prefix ? `${prefix} ${template.name.toLowerCase()}` : template.name;
  return {
    uid: `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    icon: template.icon,
    rarity,
    tinted,
    stats,
  };
};

const generateRandomItem = () => generateItemOfRarity(rollItemRarity());

const rollLootDrop = () => (Math.random() < LOOT_DROP_CHANCE ? generateRandomItem() : null);

const getEffectivePlayer = (player, equippedItem) => {
  if (!player) return player;
  const bonus = equippedItem?.stats || {};
  const str = player.str + (bonus.str || 0);
  const agi = player.agi + (bonus.dex || bonus.agi || 0);
  const int = player.int + (bonus.int || 0);
  const maxHp = (player.baseMaxHp ?? 20) + str * STAT_EFFECTS.str.hp;
  return { ...player, str, agi, int, maxHp };
};

const formatItemStats = (stats = {}) => {
  const parts = [];
  if (stats.str) parts.push(`Сила +${stats.str}`);
  if (stats.dex || stats.agi) parts.push(`Ловкость +${stats.dex || stats.agi}`);
  if (stats.int) parts.push(`Инт +${stats.int}`);
  return parts.length ? parts.join(' · ') : 'Без бонусов';
};

const HERO_ABILITIES = {
  p1: { 
    basic: { id: 'b1', name: 'Удар мечом', cost: 0, mult: 1.5, scale: { str: 1.0, dex: 0.2 }, dmgType: 'melee', icon: '⚔️', type: 'single', priority: 'direct', rarity: 'COMMON', vfxType: 'slash' },
    skills: [
      { id: 's1_1', ownerId: 'p1', name: 'Молот Тора', cost: 2, mult: 2.5, scale: { str: 1.0, dex: 0.15 }, dmgType: 'melee', icon: '🔨', type: 'single', priority: 'highestHp', rarity: 'EPIC', vfxType: 'smash' },
      { id: 's1_2', ownerId: 'p1', name: 'Размах', cost: 2, mult: 1.2, scale: { str: 0.9, dex: 0.25 }, dmgType: 'melee', icon: '🌪️', type: 'splash', rarity: 'COMMON', vfxType: 'slash' },
      { id: 's1_3', ownerId: 'p1', name: 'Рывок', cost: 1, mult: 1.3, scale: { str: 1.0, dex: 0.35 }, dmgType: 'melee', icon: '🏃', type: 'single', priority: 'lowestHp', rarity: 'COMMON', vfxType: 'slash' },
      { id: 's1_4', ownerId: 'p1', name: 'Землетрясение', cost: 4, mult: 1.8, scale: { str: 0.4, int: 0.8 }, dmgType: 'magic', icon: '🌋', type: 'splash', rarity: 'EPIC', vfxType: 'smash' }
    ]
  },
  p2: { 
    basic: { id: 'b2', name: 'Кинжал', cost: 0, mult: 1.2, scale: { dex: 1.0, str: 0.35 }, dmgType: 'ranged', icon: '🗡️', type: 'single', priority: 'lowestHp', rarity: 'COMMON', vfxType: 'dagger_single' },
    skills: [
      { id: 's2_1', ownerId: 'p2', name: 'Яд', cost: 1, mult: 1.0, scale: { dex: 1.0, int: 0.25 }, dmgType: 'ranged', icon: '🧪', type: 'single', priority: 'lowestHp', rarity: 'COMMON', vfxType: 'poison' },
      { id: 's2_2', ownerId: 'p2', name: 'Танец стали', cost: 3, mult: 1.4, scale: { dex: 0.8, int: 0.4 }, dmgType: 'ranged', icon: '⚔️', type: 'splash', rarity: 'RARE', vfxType: 'daggers' },
      { id: 's2_3', ownerId: 'p2', name: 'Теневой шаг', cost: 2, mult: 1.8, scale: { dex: 1.0, str: 0.35 }, dmgType: 'ranged', icon: '🥷', type: 'single', priority: 'highestHp', rarity: 'RARE', vfxType: 'dark_strike' },
      { id: 's2_4', ownerId: 'p2', name: 'Шквал ножей', cost: 3, mult: 1.6, scale: { dex: 0.8, int: 0.4 }, dmgType: 'ranged', icon: '🗡️', type: 'splash', rarity: 'EPIC', vfxType: 'daggers' }
    ]
  },
  p3: { 
    basic: { id: 'b3', name: 'Искра', cost: 0, mult: 1.0, scale: { int: 1.0, dex: 0.2 }, dmgType: 'magic', icon: '✨', type: 'single', priority: 'direct', rarity: 'COMMON', vfxType: 'magic_spark' },
    skills: [
      { id: 's3_1', ownerId: 'p3', name: 'Огненный шар', cost: 3, mult: 1.5, scale: { int: 1.0, str: 0.3 }, dmgType: 'magic', icon: '☄️', type: 'splash', rarity: 'RARE', vfxType: 'fireball' },
      { id: 's3_2', ownerId: 'p3', name: 'Ледяной шип', cost: 2, mult: 1.6, scale: { int: 1.0, dex: 0.25 }, dmgType: 'magic', icon: '❄️', type: 'single', priority: 'highestHp', rarity: 'RARE', vfxType: 'ice_spike' },
      { id: 's3_3', ownerId: 'p3', name: 'Цепная молния', cost: 3, mult: 1.4, scale: { dex: 0.8, int: 0.4 }, dmgType: 'magic', icon: '⚡', type: 'splash', rarity: 'RARE', vfxType: 'lightning' },
      { id: 's3_4', ownerId: 'p3', name: 'Черная дыра', cost: 5, mult: 2.2, scale: { int: 1.0, str: 0.3 }, dmgType: 'magic', icon: '🌌', type: 'splash', rarity: 'LEGENDARY', vfxType: 'dark_void' }
    ]
  }
};

const INITIAL_DECK = [
  ...HERO_ABILITIES.p1.skills.slice(0, 2),
  ...HERO_ABILITIES.p2.skills.slice(0, 2),
  ...HERO_ABILITIES.p3.skills.slice(0, 2),
];

const REWARD_POOL = [
  ...HERO_ABILITIES.p1.skills,
  ...HERO_ABILITIES.p2.skills,
  ...HERO_ABILITIES.p3.skills,
];

const EVENT_NARRATIVES = [
  { title: "Загадочный торговец", text: "Среди обломков вы замечаете фигуру в плаще. Торговец не просит золота, его интересуют лишь истории битв. В обмен он предлагает вашему отряду нечто особенное." },
  { title: "Алтарь Древних", text: "В центре разрушенной площади возвышается пульсирующий кристалл. Вы чувствуете, как древняя магия проникает в ваш разум, предлагая могущественный дар." },
  { title: "Привал у костра", text: "Вы находите безопасное и скрытое от ветров место для отдыха. Пока отряд переводит дух, вы обнаруживаете забытый кем-то тайник." },
  { title: "Странствующий мудрец", text: "Слепой старец преграждает вам путь. «Я ждал вас,» — хрипло говорит он, протягивая руки. «Выберите то, что поможет вам в грядущей бойне»." },
  { title: "Искажение реальности", text: "Пространство вокруг вас начинает идти рябью, цвета меркнут. Голос из самой пустоты шепчет: «Возьми силу, пока разлом не закрылся»." },
  { title: "Заброшенный караван", text: "Разграбленная повозка у обочины хранит в себе уцелевшие ценности. Похоже, нападавшие сильно спешили и забрали далеко не всё." }
];

const POWERUPS = [
  { id: 'mana', title: 'Осколок Эфира', desc: 'Максимальная мана увеличивается на +1.', icon: '🔵' },
  { id: 'stats', title: 'Эликсир Мощи', desc: 'Основная характеристика каждого бойца удваивается (x2).', icon: '💪' },
  { id: 'hp', title: 'Семя Жизни', desc: 'Максимальное здоровье всех героев увеличивается на +50%.', icon: '❤️' },
  { id: 'cards', title: 'Древний Фолиант', desc: 'Получить 1 легендарную и 2 эпические карты в резерв.', icon: '📜' }
];

// --- НОВЫЙ БЛОК: ФРАЗЫ ВРАГОВ ---
const ENEMY_INSULTS = [
  "Ну всё, вам пиздец, уебки!",
  "Я ваши кишки на хуй намотаю!",
  "Сюда идите, сучары!",
  "Ебать вы лохи, конечно!",
  "Засуньте свою магию себе в жопу!",
  "Хули вы тут забыли, мрази?",
  "Я твою мать на вертеле крутил!",
  "Ща я вам ебальники вскрою!",
  "Сосите хуй, ублюдки!",
  "Гниды ебаные, на куски порву!"
];

const shuffleArray = (array) => [...array].sort(() => Math.random() - 0.5);

// Уровень карты — обеспечивает бесконечный рост урона при слиянии (x2 за каждое слияние)
const getCardLevel = (card) => (card && card.level) || 1;
const getLevelMultiplier = (card) => Math.pow(2, getCardLevel(card) - 1);

const getPlayerDex = (player) => player?.agi ?? 0;

const getMaxHpFromStats = (player, equippedItem = null) => {
  const str = player.str + (equippedItem?.stats?.str || 0);
  return (player.baseMaxHp ?? 20) + str * STAT_EFFECTS.str.hp;
};

const syncPlayerMaxHp = (player, equippedItem = null) => {
  const maxHp = getMaxHpFromStats(player, equippedItem);
  return { ...player, maxHp, hp: Math.min(player.hp, maxHp) };
};

const getCardScale = (card) => {
  if (card?.scale) return card.scale;
  if (card?.stat === 'agi') return { dex: 1.0, str: 0.35 };
  if (card?.stat === 'int') return { int: 1.0, str: 0.3 };
  return { str: 1.0, dex: 0.2 };
};

const getCardDmgType = (card) => card?.dmgType || 'melee';

const getCritChance = (player) => Math.min(0.75, getPlayerDex(player) * STAT_EFFECTS.dex.critChance);

const formatCardScale = (card) => {
  const s = getCardScale(card);
  const parts = [];
  if (s.str) parts.push(`STR×${Math.round(s.str * 100)}%`);
  if (s.dex) parts.push(`DEX×${Math.round(s.dex * 100)}%`);
  if (s.int) parts.push(`INT×${Math.round(s.int * 100)}%`);
  return parts.join(' ');
};

const computeCardDamage = (owner, card, bonus = 1) => {
  if (!owner || !card) return { damage: 0, critChance: 0 };
  const scale = getCardScale(card);
  const str = owner.str ?? 0;
  const dex = getPlayerDex(owner);
  const int = owner.int ?? 0;
  const dmgType = getCardDmgType(card);

  const scaledStats =
    str * (scale.str || 0) +
    dex * (scale.dex || 0) +
    int * (scale.int || 0);

  let total = card.mult * scaledStats;
  total += str * STAT_EFFECTS.str.universalDmg;
  if (dmgType === 'ranged') total += dex * STAT_EFFECTS.dex.rangedDmg;
  if (dmgType === 'magic') total += int * STAT_EFFECTS.int.magicDmg;

  total *= getLevelMultiplier(card) * bonus;

  if (card.type === 'splash') {
    total *= 1 + int * STAT_EFFECTS.int.splashPower;
  }

  // Баланс: маг (p3) слишком доминировал и ваншотил — урезаем все его коэффициенты вдвое
  if (owner.id === 'p3') total *= 0.5;

  return { damage: Math.max(0, Math.floor(total)), critChance: getCritChance(owner) };
};

const getCardDamage = (owner, card, bonus = 1) => computeCardDamage(owner, card, bonus).damage;

const rollCardDamage = (owner, card, bonus = 1) => {
  const { damage, critChance } = computeCardDamage(owner, card, bonus);
  const isCrit = Math.random() < critChance;
  return { damage: isCrit ? Math.floor(damage * 2) : damage, isCrit, critChance };
};

// Сливает пары одинаковых карт (имя + редкость + уровень), повышая уровень. Рарность не меняется,
// поэтому слияние возможно всегда и при любых условиях — урон карты растёт бесконечно.
const checkAndMerge = (deck) => {
  const allMerges = [];
  let currentDeck = [...deck];
  let foundMerge = true;

  while (foundMerge) {
    foundMerge = false;
    const groups = {};
    currentDeck.forEach((card, idx) => {
      const key = `${card.name}__${card.rarity}__${getCardLevel(card)}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(idx);
    });

    const toRemove = new Set();
    const toAdd = [];

    for (const [, indices] of Object.entries(groups)) {
      const available = indices.filter(i => !toRemove.has(i));
      if (available.length >= 2) {
        const base = currentDeck[available[0]];
        toRemove.add(available[0]);
        toRemove.add(available[1]);
        const result = { ...base, level: getCardLevel(base) + 1, id: `merged_${Date.now()}_${Math.random()}` };
        toAdd.push(result);
        allMerges.push({ card1: currentDeck[available[0]], card2: currentDeck[available[1]], result });
        foundMerge = true;
      }
    }

    if (foundMerge) {
      currentDeck = currentDeck.filter((_, idx) => !toRemove.has(idx));
      toAdd.forEach(card => {
        const pos = Math.floor(Math.random() * (currentDeck.length + 1));
        currentDeck.splice(pos, 0, card);
      });
    }
  }

  return { newDeck: currentDeck, merges: allMerges };
};

const getTargetText = (type, priority) => {
  if (type === 'splash') return 'всем врагам.';
  if (priority === 'lowestHp') return 'самому слабому.';
  if (priority === 'highestHp') return 'самому здоровому.';
  return 'атакующим.';
};

// Подпись и иконка текущей ноды (сектора) для плашки в арене
const NODE_INFO = {
  base: { label: 'База', icon: '🏰' },
  boss: { label: 'Босс', icon: '🐲' },
  combat_hard: { label: 'Сложный враг', icon: '☠️' },
  combat_medium: { label: 'Средний враг', icon: '⚔️' },
  combat_easy: { label: 'Лёгкий враг', icon: '🗡️' },
  event: { label: 'Событие', icon: '✨' },
};
const getNodeInfo = (type) => NODE_INFO[type] || { label: 'Сектор', icon: '⚔️' };

// --- ФУНКЦИИ ГЕНЕРАЦИИ КАРТЫ ---

const MAP_Y_POSITIONS = {
  1: [50],
  2: [35, 65],
  3: [20, 50, 80],
  4: [15, 38, 62, 85],
  5: [10, 30, 50, 70, 90],
  6: [8, 25, 42, 58, 75, 92]
};

const LINE_COLORS = ['#1E88E5', '#D32F2F', '#36B373', '#FFAB00', '#A14EE3', '#00B8D9'];

const getSubwayPath = (link) => {
  const { source, target, midX, y1Offset, y2Offset } = link;
  const x1 = source.x;
  const y1 = source.y + y1Offset;
  const x2 = target.x;
  const y2 = target.y + y2Offset;

  const yDiff = y2 - y1;
  const absYDiff = Math.abs(yDiff);

  const rx_base = 2; 
  const ry_base = rx_base * 1.8; 

  const scale = Math.min(1, absYDiff / (2 * ry_base), Math.abs(midX - x1) / rx_base, Math.abs(x2 - midX) / rx_base);
  const rx = rx_base * scale;
  const ry = ry_base * scale;

  if (scale < 0.01) {
    return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
  }

  const dirY = Math.sign(yDiff);
  const sweep1 = dirY > 0 ? 1 : 0;
  const sweep2 = dirY > 0 ? 0 : 1;

  return `M ${x1} ${y1} 
          L ${midX - rx} ${y1} 
          A ${rx} ${ry} 0 0 ${sweep1} ${midX} ${y1 + ry * dirY} 
          L ${midX} ${y2 - ry * dirY} 
          A ${rx} ${ry} 0 0 ${sweep2} ${midX + rx} ${y2} 
          L ${x2} ${y2}`;
};

const getConicGradient = (colors, innerBg) => {
  if (!colors || colors.length === 0) return { background: innerBg, borderColor: '#44286E' };
  if (colors.length === 1) return { background: innerBg, borderColor: colors[0] };
  
  const step = 100 / colors.length;
  let stops = [];
  colors.forEach((c, i) => {
    stops.push(`${c} ${i * step}%`, `${c} ${(i + 1) * step}%`);
  });
  
  return {
    background: `linear-gradient(${innerBg}, ${innerBg}) padding-box, conic-gradient(${stops.join(', ')}) border-box`,
    borderColor: 'transparent'
  };
};

const generateMap = () => {
  const counts = [
    1, 
    Math.floor(Math.random() * 2) + 2, 
    Math.floor(Math.random() * 5) + 2, 
    Math.floor(Math.random() * 5) + 2, 
    Math.floor(Math.random() * 5) + 2, 
    1
  ]; 
  const layers = [];
  const runId = Math.random().toString(36).substring(2, 9);
  let nextId = 0;

  for (let i = 0; i < counts.length; i++) {
    const layer = [];
    const count = counts[i];
    for (let j = 0; j < count; j++) {
      let type = 'combat_easy';
      if (i === 0) type = 'base';
      else if (i === counts.length - 1) type = 'boss';
      else {
        const rand = Math.random();
        if (rand > 0.85) type = 'event';
        else if (rand > 0.6) type = 'combat_hard';
        else if (rand > 0.3) type = 'combat_medium';
        else type = 'combat_easy';
      }

      layer.push({
        id: `node_${runId}_${nextId++}`, 
        stage: i,
        type,
        x: 10 + i * 16, 
        y: MAP_Y_POSITIONS[count][j],
        next: [],
        colors: [] 
      });
    }
    layers.push(layer);
  }

  for (let i = 0; i < layers.length - 1; i++) {
    const curr = layers[i];
    const next = layers[i + 1];

    next.forEach((nextNode, nIdx) => {
      let bestSrc = -1;
      let minDist = 999;
      for(let c = 0; c < curr.length; c++) {
        if (curr[c].next.length < 3) {
          let dist = Math.abs(c / curr.length - nIdx / next.length);
          if (dist < minDist) { minDist = dist; bestSrc = c; }
        }
      }
      if (bestSrc !== -1) curr[bestSrc].next.push(nextNode.id);
    });

    curr.forEach((currNode, cIdx) => {
      if (currNode.next.length === 0) {
        let targetIdx = Math.floor((cIdx / curr.length) * next.length);
        currNode.next.push(next[targetIdx].id);
      }
    });

    curr.forEach((currNode, cIdx) => {
      if (i === layers.length - 2) return; 
      const numBranches = Math.floor(Math.random() * 3) + 1;
      let attempts = 0;
      let centerTargetIdx = Math.floor((cIdx / curr.length) * next.length);
      while (currNode.next.length < numBranches && attempts < 10) {
        attempts++;
        let offset = Math.floor(Math.random() * 3) - 1; 
        let tIdx = centerTargetIdx + offset;
        if (tIdx >= 0 && tIdx < next.length) {
          if (!currNode.next.includes(next[tIdx].id)) currNode.next.push(next[tIdx].id);
        }
      }
    });
  }
  return layers.flat();
};

const spawnEnemies = (type, stage, sector = 1) => {
  // Сложность задаётся в первую очередь СЕКТОРОМ: чем дальше прошёл — тем сильнее враги.
  // Множитель растёт экспоненциально по секторам, чтобы успевать за ростом силы отряда (слияние карт ×2).
  // Не дорос до сектора — проигрываешь и начинаешь заново (ресурсы сохраняются).
  const s = (stage || 1) + (sector - 1) * 6;
  const mult = Math.pow(1.55, sector - 1);
  let counter = 0;
  const mk = (prefix, name, baseHp, perStage, icon, xp) => {
    const hp = Math.round((baseHp + s * perStage) * mult);
    return {
      id: `${prefix}_${Date.now()}_${counter++}`,
      name, hp, maxHp: hp, icon, isDead: false,
      xpReward: Math.round(xp * mult),
    };
  };
  if (type === 'boss') {
    return [ mk('boss', 'Лорд Демонов', 300, 50, '🐲', 400) ];
  } else if (type === 'combat_hard') {
    return [
      mk('h1', 'Орк-Чемпион', 120, 30, '👹', 150),
      mk('h2', 'Темный Маг', 80, 20, '🧙‍♂️', 120),
      mk('h3', 'Голем', 70, 20, '🪨', 100),
    ];
  } else if (type === 'combat_medium') {
    return [
      mk('m1', 'Бандит', 60, 15, '🥷', 90),
      mk('m2', 'Арбалетчик', 40, 15, '🏹', 70),
    ];
  } else {
    const enemies = [
      mk('e1', 'Гоблин', 45, 15, '👺', 60),
      mk('e2', 'Волк', 35, 10, '🐺', 45),
    ];
    return shuffleArray(enemies).slice(0, 1 + Math.floor(Math.random() * 2));
  }
};

// --- 2. ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ ---

const TiltWrapper = ({ children, className, isDisabled, globalShake = {x:0, y:0, rot:0} }) => {
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e) => {
    if (isDisabled) return;
    const card = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - card.left;
    const y = e.clientY - card.top;
    const centerX = card.width / 2;
    const centerY = card.height / 2;

    const rotateX = ((centerY - y) / centerY) * 12; 
    const rotateY = ((x - centerX) / centerX) * 12;

    setRotation({ x: rotateX, y: rotateY });
    setGlare({ x: (x / card.width) * 100, y: (y / card.height) * 100, opacity: 0.15 });
  };

  const handleMouseEnter = () => { if (!isDisabled) setIsHovered(true); };
  const handleMouseLeave = () => { setIsHovered(false); setRotation({ x: 0, y: 0 }); setGlare(prev => ({ ...prev, opacity: 0 })); };

  const borderMask = {
    WebkitMaskImage: `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
    WebkitMaskComposite: 'xor',
    maskComposite: 'exclude',
    padding: '3px' 
  };

  return (
    <div 
      className={`transition-all duration-300 ease-out relative ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(1000px) rotateX(${rotation.x + globalShake.rot}deg) rotateY(${rotation.y + globalShake.rot}deg) scale(${isHovered ? 1.05 : 1}) translate(${globalShake.x * 0.5}px, ${globalShake.y * 0.5}px)`,
        zIndex: isHovered ? 50 : 1,
      }}
    >
      <div 
        className="absolute -inset-[2px] pointer-events-none rounded-2xl z-50 transition-opacity duration-300"
        style={{
          ...borderMask,
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(220px circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,${glare.opacity}) 0%, rgba(255,255,255,${glare.opacity * 0.3}) 40%, transparent 100%)`,
        }}
      />
      <div 
        className="absolute -inset-[12px] pointer-events-none rounded-3xl z-40 transition-opacity duration-500"
        style={{
          opacity: isHovered ? 0.15 : 0,
          background: `radial-gradient(180px circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.2) 0%, transparent 100%)`,
          filter: 'blur(15px)'
        }}
      />
      {children}
    </div>
  );
};

const FlyingCard = ({ startX, startY, endX, endY, isDiscard = false, isReshuffle = false }) => {
  const [style, setStyle] = useState({
    left: `${startX}px`, top: `${startY}px`, transform: 'translate(-50%, -50%) scale(0.2)', opacity: 0,
  });

  useEffect(() => {
    const t = setTimeout(() => {
      setStyle({
        left: `${endX}px`, top: `${endY}px`,
        transform: `translate(-50%, -50%) scale(${isDiscard || isReshuffle ? 0.3 : 1.0}) rotate(${isReshuffle ? -360 : isDiscard ? 720 : 0}deg)`,
        opacity: 1,
        transition: `all 850ms ${isDiscard || isReshuffle ? 'cubic-bezier(0.5, -0.5, 0.5, 1.5)' : 'cubic-bezier(0.34, 1.56, 0.64, 1)'}`
      });
    }, 20);
    return () => clearTimeout(t);
  }, [endX, endY, isDiscard, isReshuffle]);

  return (
    <div className={`fixed z-[999] w-40 h-60 border-2 border-amber-400 rounded-xl bg-slate-800 shadow-2xl pointer-events-none ${isReshuffle ? 'brightness-125' : ''}`} style={style}>
      <div className="h-6 w-full bg-[#7a1c1c] rounded-t-lg"></div>
      <div className="flex-1 flex items-center justify-center p-3 bg-slate-900/60 h-[calc(100%-24px)] rounded-b-lg">
        <div className="w-12 h-12 border-4 border-dashed border-slate-700 rounded-full opacity-30"></div>
      </div>
    </div>
  );
};

const DamagePopup = ({ id, value, x, y, isCrit, onComplete }) => {
  const [offset, setOffset] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const [scale, setScale] = useState(isCrit ? 3.2 : 2.5);
  
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    const t = setTimeout(() => { setOffset(-120); setOpacity(0); setScale(0.8); }, 50);
    const c = setTimeout(() => onCompleteRef.current(id), 2000);
    return () => { clearTimeout(t); clearTimeout(c); };
  }, [id]);

  const fontSize = Math.min(32 + (value / 1.5), 100);
  const colorClass = isCrit ? 'text-yellow-300' : 'text-red-500';
  const shadow = isCrit
    ? '0 0 24px rgba(250,204,21,0.95), 5px 5px 0px rgba(0,0,0,1)'
    : '0 0 20px rgba(239, 68, 68, 0.8), 5px 5px 0px rgba(0,0,0,1)';
  return (
    <div className={`fixed z-[900] font-black pointer-events-none italic ${colorClass}`}
      style={{ left: x, top: y, fontSize: `${fontSize}px`, opacity: opacity, transform: `translate(-50%, ${offset}px) scale(${scale})`, transition: 'all 2000ms cubic-bezier(0.18, 0.89, 0.32, 1.28)', WebkitTextStroke: '2px white', textShadow: shadow }}>
      {isCrit ? `${String(value)} CRIT!` : String(value)}
    </div>
  );
};

const FlyingXp = ({ id, amount, startX, startY, endX, endY, onComplete }) => {
  const [pos, setPos] = useState({ x: startX, y: startY, opacity: 1, scale: 1 });
  
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    const t = setTimeout(() => setPos({ x: endX, y: endY, opacity: 0, scale: 0.5 }), 50);
    const c = setTimeout(() => onCompleteRef.current(id, amount), 750);
    return () => { clearTimeout(t); clearTimeout(c); };
  }, [id, amount, endX, endY]);
  
  return (
    <div className="fixed z-[800] font-black text-yellow-400 text-2xl pointer-events-none drop-shadow-lg"
      style={{ left: 0, top: 0, transform: `translate(${pos.x - 20}px, ${pos.y - 20}px) scale(${pos.scale})`, opacity: pos.opacity, transition: 'all 700ms ease-in' }}>
      +{String(amount)}
    </div>
  );
};

const FlyingItem = ({ id, item, startX, startY, endX, endY, onComplete }) => {
  const [pos, setPos] = useState({ x: startX, y: startY, scale: 1.2, rotate: 0 });
  const [flash, setFlash] = useState(0);
  const [fade, setFade] = useState(1);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    const t = setTimeout(() => setPos({ x: endX, y: endY, scale: 0.7, rotate: 360 }), 50);
    const f1 = setTimeout(() => setFlash(1), 640);
    const f2 = setTimeout(() => { setFlash(0); setFade(0); }, 770);
    const c = setTimeout(() => onCompleteRef.current(id, item), 830);
    return () => { [t, f1, f2, c].forEach(clearTimeout); };
  }, [id, item, endX, endY]);

  const rarity = RARITIES[item.rarity] || RARITIES.COMMON;
  return (
    <div className="fixed z-[810] pointer-events-none"
      style={{ left: 0, top: 0, transform: `translate(${pos.x - 24}px, ${pos.y - 24}px) scale(${pos.scale}) rotate(${pos.rotate}deg)`, opacity: fade, transition: 'transform 600ms cubic-bezier(0.22, 1, 0.36, 1), opacity 120ms ease-out' }}>
      <div className={`w-12 h-12 rounded-lg border-2 ${rarity.border} bg-slate-900 shadow-[0_0_20px_rgba(250,204,21,0.5)] overflow-hidden relative`}>
        <ItemIcon item={item} className="w-full h-full" />
        <div className="absolute inset-0 bg-white rounded-md" style={{ opacity: flash, transform: `scale(${1 + flash * 0.6})`, boxShadow: flash ? '0 0 25px 8px rgba(255,255,255,0.9)' : 'none', transition: 'opacity 130ms ease-out, transform 130ms ease-out' }} />
      </div>
    </div>
  );
};

const ItemTooltip = ({ item, x, y }) => {
  if (!item) return null;
  const rarity = RARITIES[item.rarity] || RARITIES.COMMON;
  const TT_H = 130; // ориентировочная высота тултипа
  const left = Math.min(x + 14, window.innerWidth - 220);
  // Если внизу не помещается — показываем над курсором
  const fitsBelow = y - 10 + TT_H <= window.innerHeight - 8;
  const top = fitsBelow
    ? Math.max(8, y - 10)
    : Math.max(8, y - TT_H - 10);
  return (
    <div className="fixed z-[5000] pointer-events-none w-52 bg-slate-950/95 border border-slate-600 rounded-xl p-3 shadow-2xl backdrop-blur-md"
      style={{ left, top }}>
      <div className="flex items-center gap-2 mb-2">
        <ItemIcon item={item} className="w-10 h-10 rounded-lg border border-slate-600 overflow-hidden" />
        <div>
          <div className="text-xs font-black text-white uppercase tracking-tight">{item.name}</div>
          <div className={`text-[9px] font-bold uppercase ${rarity.text}`}>{rarity.name}</div>
        </div>
      </div>
      <div className="text-[10px] text-slate-300 leading-relaxed">{formatItemStats(item.stats)}</div>
    </div>
  );
};

const ItemSlot = ({ item, selected, emptyLabel, onClick, onMouseEnter, onMouseLeave, size = 'md', draggable: isDraggable, onDragStart, onDragOver, onDragLeave, onDrop, isDragOver, equip = false }) => {
  const sizeClass = size === 'sm' ? 'w-[64px] h-[64px]' : 'w-[52px] h-[52px]';
  const rarity = item ? (RARITIES[item.rarity] || RARITIES.COMMON) : null;
  const emptyClass = equip
    ? 'border-slate-700/40 border-dashed bg-slate-900/25 hover:border-slate-500/50'
    : 'border-slate-700 border-dashed bg-slate-900/50 hover:border-slate-500';
  const filledClass = rarity
    ? (equip
      ? `${rarity.border} bg-slate-900/40 hover:brightness-110`
      : `${rarity.border} bg-slate-900 hover:brightness-125`)
    : '';
  return (
    <div
      draggable={isDraggable && !!item}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`${sizeClass} rounded-lg border-2 flex items-center justify-center transition-all relative overflow-hidden select-none
        ${item ? `${filledClass} cursor-grab active:cursor-grabbing` : `${emptyClass} cursor-default`}
        ${isDragOver ? 'ring-2 ring-amber-400 scale-110 border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)]' : ''}
        ${selected ? 'ring-2 ring-amber-400 scale-105 shadow-[0_0_15px_rgba(251,191,36,0.5)]' : ''}
        ${equip ? 'mt-[18px]' : ''}`}>
      {item ? (
        <ItemIcon item={item} className="w-full h-full pointer-events-none" imgClassName="w-full h-full object-cover pointer-events-none" />
      ) : (
        <span className="text-[8px] text-slate-600 font-bold uppercase">{emptyLabel || ''}</span>
      )}
    </div>
  );
};

const BloodParticle = ({ id, x, y, onComplete }) => {
  const size = useMemo(() => 6 + Math.random() * 12, []);
  const [style, setStyle] = useState({ left: x, top: y, opacity: 1, transform: 'translate(-50%, -50%) scale(0.1)' });
  
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 60 + Math.random() * 120;
    const destX = x + Math.cos(angle) * distance;
    const destY = y + Math.sin(angle) * distance + (40 + Math.random() * 60);

    const t = setTimeout(() => {
      setStyle({
        left: destX,
        top: destY,
        opacity: 0,
        transform: `translate(-50%, -50%) scale(${1 + Math.random() * 1.5}) rotate(${Math.random() * 360}deg)`,
        transition: 'all 500ms cubic-bezier(0.17, 0.84, 0.44, 1)'
      });
    }, 20);

    const c = setTimeout(() => onCompleteRef.current(id), 500);
    return () => { clearTimeout(t); clearTimeout(c); };
  }, [x, y, id]);

  return <div className="fixed z-[850] bg-red-500 rounded-full pointer-events-none shadow-[0_0_15px_rgba(239,68,68,1)]" style={{ ...style, width: size, height: size }} />;
};

const CombatVfx = ({ vfx }) => {
  const [style, setStyle] = useState({ left: vfx.startX, top: vfx.startY, opacity: 0, transform: 'translate(-50%, -50%) scale(0.1)' });
  
  useEffect(() => {
    const t0 = setTimeout(() => {
        let t1;
        if (['magic_spark', 'fireball', 'ice_spike', 'lightning', 'dark_void', 'enemy'].includes(vfx.type)) {
           setStyle({ left: vfx.startX, top: vfx.startY, opacity: 1, transform: 'translate(-50%, -50%) scale(0.5)' });
           t1 = setTimeout(() => {
             setStyle({ left: vfx.endX, top: vfx.endY, opacity: 1, transform: 'translate(-50%, -50%) scale(1.5)', transition: 'all 450ms ease-out' });
           }, 20);
        } else if (['slash', 'smash', 'dark_strike'].includes(vfx.type)) {
           setStyle({ left: vfx.endX, top: vfx.endY, opacity: 1, transform: 'translate(-50%, -50%) scale(0.2) rotate(-45deg)' });
           t1 = setTimeout(() => {
             setStyle({ left: vfx.endX, top: vfx.endY, opacity: 0, transform: 'translate(-50%, -50%) scale(2) rotate(45deg)', transition: 'all 450ms ease-out' });
           }, 20);
        } else if (['daggers', 'poison', 'dagger_single'].includes(vfx.type)) {
           const angle = Math.atan2(vfx.endY - vfx.startY, vfx.endX - vfx.startX) * 180 / Math.PI;
           const scatterX = vfx.type === 'dagger_single' ? 0 : (Math.random() - 0.5) * 80;
           const scatterY = vfx.type === 'dagger_single' ? 0 : (Math.random() - 0.5) * 80;
           setStyle({ left: vfx.startX + scatterX, top: vfx.startY + scatterY, opacity: 1, transform: `translate(-50%, -50%) rotate(${angle + 90}deg)` });
           t1 = setTimeout(() => {
             setStyle({ left: vfx.endX, top: vfx.endY, opacity: 1, transform: `translate(-50%, -50%) rotate(${angle + 90 + 1080}deg)`, transition: 'all 450ms ease-out' });
           }, 20);
        }
    }, vfx.delay || 0);
    
    return () => clearTimeout(t0);
  }, [vfx]);

  if (vfx.type === 'magic_spark') return <div style={style} className="fixed z-[1000] w-12 h-12 bg-white rounded-full shadow-[0_0_20px_#fff,0_0_40px_#42C0E8,0_0_80px_#E33371] pointer-events-none flex items-center justify-center"><div className="w-8 h-8 bg-[#42C0E8] rounded-full blur-[2px] opacity-90" /></div>;
  if (vfx.type === 'fireball') return <div style={style} className="fixed z-[1000] w-14 h-14 bg-orange-500 rounded-full shadow-[0_0_40px_#ea580c,inset_0_0_15px_#fef08a] pointer-events-none" />;
  if (vfx.type === 'ice_spike') return <div style={style} className="fixed z-[1000] text-5xl drop-shadow-[0_0_15px_#06b6d4] pointer-events-none">🧊</div>;
  if (vfx.type === 'lightning') return <div style={style} className="fixed z-[1000] text-6xl drop-shadow-[0_0_20px_#eab308] pointer-events-none">⚡</div>;
  if (vfx.type === 'dark_void') return <div style={style} className="fixed z-[1000] w-20 h-20 bg-black rounded-full shadow-[0_0_60px_#9333ea,inset_0_0_20px_#4c1d95] pointer-events-none border-2 border-purple-500" />;
  if (vfx.type === 'enemy') return <div style={style} className="fixed z-[1000] w-8 h-8 bg-[#D32F2F] rounded-full shadow-[0_0_30px_#D32F2F] pointer-events-none" />;
  
  if (vfx.type === 'slash') return <div style={style} className="fixed z-[1000] w-48 h-48 border-t-[16px] border-r-[16px] border-white rounded-full shadow-[0_0_20px_#1E88E5] pointer-events-none" />;
  if (vfx.type === 'smash') return <div style={style} className="fixed z-[1000] w-64 h-64 border-t-[24px] border-r-[24px] border-amber-500 rounded-full shadow-[0_0_40px_#d97706] pointer-events-none" />;
  if (vfx.type === 'dark_strike') return <div style={style} className="fixed z-[1000] w-56 h-56 border-t-[20px] border-r-[20px] border-purple-900 rounded-full shadow-[0_0_30px_#000] pointer-events-none" />;
  
  if (vfx.type === 'dagger_single' || vfx.type === 'daggers') return <div style={style} className="fixed z-[1000] text-4xl drop-shadow-[0_0_10px_#36B373] pointer-events-none">🗡️</div>;
  if (vfx.type === 'poison') return <div style={style} className="fixed z-[1000] text-4xl drop-shadow-[0_0_20px_#22c55e] pointer-events-none">🧪</div>;

  return null;
};

const ShaderBackground = ({ intensity = 0 }) => {
  const canvasRef = useRef(null);
  const targetIntensityRef = useRef(0);
  const intensityRef = useRef(0);

  useEffect(() => { targetIntensityRef.current = Math.min(1, Math.max(0, intensity)); }, [intensity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl');
    if (!gl) return;

    const vsSource = `
      attribute vec2 position;
      void main() { gl_Position = vec4(position, 0.0, 1.0); }
    `;

    const fsSource = `
      precision mediump float;
      uniform vec2 iResolution;
      uniform float iTime;
      uniform float iIntensity;
      #define OCTAVES 5.0

      float rand2(vec2 co){ return fract(cos(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453); }

      float valueNoiseSimple(vec2 vl) {
         float minStep = 1.0;
         vec2 grid = floor(vl);
         vec2 gridPnt1 = grid;
         vec2 gridPnt2 = vec2(grid.x, grid.y + minStep);
         vec2 gridPnt3 = vec2(grid.x + minStep, grid.y);
         vec2 gridPnt4 = vec2(gridPnt3.x, gridPnt2.y);
         float s = rand2(grid); float t = rand2(gridPnt3); float u = rand2(gridPnt2); float v = rand2(gridPnt4);
         float x1 = smoothstep(0., 1., fract(vl.x));
         float interpX1 = mix(s, t, x1); float interpX2 = mix(u, v, x1);
         float y = smoothstep(0., 1., fract(vl.y));
         return mix(interpX1, interpX2, y);
      }

      float fractalNoise(vec2 vl) {
          float persistance = 2.0; float amplitude = 0.5; float rez = 0.0; vec2 p = vl;
          for (float i = 0.0; i < OCTAVES; i++) {
              rez += amplitude * valueNoiseSimple(p); amplitude /= persistance; p *= persistance;
          }
          return rez;
      }

      mat2 rot(float a) { float s = sin(a); float c = cos(a); return mat2(c, -s, s, c); }

      float complexFBM(vec2 p) {
          #define MOTION_BOOST 1.25
          float speed = mix(0.35, 1.1, clamp(iIntensity, 0.0, 1.0)) * 0.5 * MOTION_BOOST;
          float t = iTime * speed;

          vec2 c = p - 1.75;
          float ang = t * (0.02 + 0.06 * iIntensity) * MOTION_BOOST;
          c = rot(ang) * c;
          p = c + 1.75;

          float slow = t / (3.0 / MOTION_BOOST);
          vec2 offset1 = vec2(sin(slow * 0.7 * MOTION_BOOST), cos(slow * 0.9 * MOTION_BOOST)) * (0.25 + 0.35 * iIntensity);
          vec2 offset2 = vec2(sin(t * 1.3 * MOTION_BOOST), cos(t * 1.1 * MOTION_BOOST)) * (0.4 * MOTION_BOOST);
          float warp = 1.0 + iIntensity * 0.55;
          return fractalNoise( p + offset1 + warp * fractalNoise( p + 1.5 * fractalNoise( p - offset2 ) ) );
      }

      void main() {
          vec2 uv = gl_FragCoord.xy / iResolution.xy;
          vec2 sp = uv * (3.5 + iIntensity * 0.4);
          float n = complexFBM(sp);
          float blend = clamp(iIntensity, 0.0, 1.0);

          vec3 cold = mix(vec3(0.02, 0.05, 0.12), vec3(0.10, 0.40, 0.78), clamp(n * 1.15, 0.0, 1.0));
          vec3 red = mix(vec3(0.09, 0.02, 0.04), vec3(0.82, 0.16, 0.12), clamp(n * 1.15, 0.0, 1.0));
          vec3 twoTone = mix(cold, red, n);
          vec3 col = mix(cold, twoTone, blend);

          gl_FragColor = vec4(col, 1.0);
      }
    `;

    const compileShader = (gl, type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };

    const program = gl.createProgram();
    gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vsSource));
    gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fsSource));
    gl.linkProgram(program);
    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const iTimeLocation = gl.getUniformLocation(program, 'iTime');
    const iResolutionLocation = gl.getUniformLocation(program, 'iResolution');
    const iIntensityLocation = gl.getUniformLocation(program, 'iIntensity');

    const TIERS = [
      { scale: 0.6, fps: 30 },
      { scale: 0.45, fps: 24 },
      { scale: 0.3, fps: 20 },
    ];
    let tier = 0;

    try {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const rendererName = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
      if (/swiftshader|software|llvmpipe|microsoft basic|paravirtual/i.test(rendererName)) {
        tier = TIERS.length - 1;
      }
    } catch (e) { /* расширение недоступно */ }

    const resize = () => {
      const scale = TIERS[tier].scale;
      canvas.width = Math.max(1, Math.round(window.innerWidth * scale));
      canvas.height = Math.max(1, Math.round(window.innerHeight * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    window.addEventListener('resize', resize); resize();

    let animationFrameId; const startTime = Date.now();
    let frameInterval = 1000 / TIERS[tier].fps;
    let lastFrame = -Infinity;

    const draw = () => {
      intensityRef.current += (targetIntensityRef.current - intensityRef.current) * 0.02;
      gl.uniform1f(iTimeLocation, (Date.now() - startTime) / 1000);
      gl.uniform1f(iIntensityLocation, intensityRef.current);
      gl.uniform2f(iResolutionLocation, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    let lastRaf = 0, intervalSum = 0, intervalCount = 0, evalAt = 0;
    const render = (now = 0) => {
      animationFrameId = requestAnimationFrame(render);
      if (document.hidden) { lastRaf = 0; return; }

      if (lastRaf) { intervalSum += now - lastRaf; intervalCount++; }
      lastRaf = now;
      if (!evalAt) evalAt = now + 1500;
      if (now >= evalAt) {
        const avg = intervalCount ? intervalSum / intervalCount : 16;
        intervalSum = 0; intervalCount = 0; evalAt = now + 1500;
        if (avg > 30) {
          if (tier < TIERS.length - 1) {
            tier++; frameInterval = 1000 / TIERS[tier].fps; resize();
          } else {
            cancelAnimationFrame(animationFrameId);
            return;
          }
        }
      }

      if (now - lastFrame < frameInterval) return;
      lastFrame = now;
      draw();
    };

    if (tier >= TIERS.length - 1) draw();
    animationFrameId = requestAnimationFrame(render);

    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(animationFrameId); };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full z-[-2] pointer-events-none" />;
};

const BG_MASK_URL = './bg/mask.png';
// Сжатые JPEG локации (1280px, q80)
const BG_LOCATIONS = [
  './bg/locations/loc_01.jpg',
  './bg/locations/loc_02.jpg',
];
const pickRandomBgLocation = () => BG_LOCATIONS[Math.floor(Math.random() * BG_LOCATIONS.length)];

// Картинка поверх шейдера: масштаб от ширины экрана, градиентная маска (якорь сверху, 100% ширины).
// Маска 100%×100% элемента картинки. PNG-маска + CSS-градиент (intersect) — гарантированный fade.
const ImageBackground = ({ imageUrl }) => {
  const maskStyle = {
    WebkitMaskImage: `url('${BG_MASK_URL}'), linear-gradient(to bottom, #000 0%, #000 25%, transparent 100%)`,
    maskImage: `url('${BG_MASK_URL}'), linear-gradient(to bottom, #000 0%, #000 25%, transparent 100%)`,
    WebkitMaskSize: '100% 100%, 100% 100%',
    maskSize: '100% 100%, 100% 100%',
    WebkitMaskPosition: 'top center, top center',
    maskPosition: 'top center, top center',
    WebkitMaskRepeat: 'no-repeat, no-repeat',
    maskRepeat: 'no-repeat, no-repeat',
    WebkitMaskComposite: 'source-in',
    maskComposite: 'intersect',
  };

  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden">
      <img
        src={imageUrl}
        key={imageUrl}
        alt=""
        className="absolute top-0 left-0 block w-full h-auto select-none"
        style={maskStyle}
        draggable={false}
      />
    </div>
  );
};

const AbilityCard = ({ card, owner, mana, maxMana, isDisabled, showOwnerLabel = false, comboState, growDamage = false }) => {
  const [grow, setGrow] = useState(false);
  useEffect(() => {
    if (!growDamage) return;
    const t0 = setTimeout(() => setGrow(true), 60);
    const t1 = setTimeout(() => setGrow(false), 1100);
    return () => { clearTimeout(t0); clearTimeout(t1); };
  }, [growDamage]);

  if (!card) return null;
  const rarity = RARITIES[card.rarity] || RARITIES.COMMON;
  const { isCandidate, willGiveBonus } = comboState;
  const level = getCardLevel(card);
  
  let dmg = owner ? getCardDamage(owner, card) : 0;
  if (willGiveBonus) dmg = Math.floor(dmg * 1.5);
  const critPct = owner ? Math.round(getCritChance(owner) * 100) : 0;
  const scaleLine = formatCardScale(card);

  const displayRarityName = showOwnerLabel && owner ? `${rarity.name} - ${owner.name}` : rarity.name;

  return (
    <div className={`w-full h-full border ${rarity.border} rounded-2xl flex flex-col overflow-hidden transition-all duration-300 relative shadow-inner bg-[#45475a] ${isCandidate && !isDisabled ? 'ring-2 ring-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.6)]' : ''} ${!isDisabled ? 'group-hover:brightness-110' : ''}`}>
      <div className={`${rarity.header} py-1.5 px-3 border-b border-black/20 flex items-center justify-between shadow-md`}>
        <span className={`font-bold text-[10px] ${rarity.text} uppercase tracking-wider truncate drop-shadow-md`}>{String(card.name)}{level > 1 && <span className="text-amber-300"> ур.{String(level)}</span>}</span>
        <div className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] border-2 border-white/20 shadow-lg text-white ${mana < card.cost ? 'bg-red-500' : 'bg-[#1E88E5]'}`}>{String(card.cost)}</div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center relative p-1 bg-[#373945] min-h-[50px]">
        {isCandidate && (<div className="absolute top-1 left-1 bg-yellow-400 text-black text-[9px] font-black px-1.5 py-0.5 rounded shadow-lg animate-bounce z-10">COMBO!</div>)}
        <span className="text-3xl drop-shadow-2xl group-hover:scale-110 transition-transform duration-500">{String(card.icon)}</span>
      </div>
      <div className="text-center leading-none bg-[#50546d] border-t border-slate-600/30 p-2 pt-5 pb-3 flex flex-col justify-center min-h-[60px] relative">
        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-0.5 rounded-full ${rarity.badgeBg} shadow-md z-10 whitespace-nowrap`}>
          <span className="text-[11px] font-black italic text-[#FFFFE0] uppercase tracking-wide drop-shadow-sm">{displayRarityName}</span>
        </div>
        <p className="text-[10px] text-slate-200 font-medium">
          Наносит <span
            className={`font-bold transition-all duration-500 ${grow ? 'text-green-400' : (willGiveBonus ? 'text-yellow-400 text-sm' : 'text-amber-400')}`}
            style={{ display: 'inline-block', transform: grow ? 'scale(1.9)' : 'scale(1)', textShadow: grow ? '0 0 14px rgba(34,197,94,0.95)' : 'none' }}
          >{String(dmg)}</span> урона.<br/>
          <span className="text-[7px] text-slate-400 mt-0.5 block leading-tight">{scaleLine}{critPct > 0 && ` · Крит ${critPct}%`}</span>
          <span className="text-[8px] text-slate-300 mt-1 block">Приоритет {String(getTargetText(card.type, card.priority))}</span>
        </p>
      </div>
    </div>
  );
};

// --- 3. ЗВУКИ ---

const _audioCache = {};
let _sfxVolume = 0.35; // глобальный множитель громкости SFX

// Все ассеты, которые нужно прогреть до старта игры
const PRELOAD_ASSETS = [
  './assets/sfx/combat/death.wav',
  './assets/sfx/combat/enemy_attack.wav',
  './assets/sfx/combat/hit_heavy.wav',
  './assets/sfx/combat/hit_light.wav',
  './assets/sfx/combat/hit_magic.wav',
  './assets/sfx/combat/hit_poison.wav',
  './assets/sfx/events/event_start.wav',
  './assets/sfx/events/powerup_select.wav',
  './assets/sfx/game/enemy_turn.wav',
  './assets/sfx/game/gameover.wav',
  './assets/sfx/game/level_up.wav',
  './assets/sfx/game/mana_restore.wav',
  './assets/sfx/game/victory.wav',
  './assets/sfx/game/xp_gain.wav',
  './assets/sfx/map/move.wav',
  './assets/sfx/map/node_click.wav',
  './assets/sfx/ui/card_deal.wav',
  './assets/sfx/ui/card_discard.wav',
  './assets/sfx/ui/click.wav',
  './assets/sfx/ui/hover.wav',
  './corner.png',
];

const MUSIC_URL = './file.mp3';

function playSound(path, volume = 1.0) {
  try {
    const cached = _audioCache[path];
    // Если звук уже играет — клонируем, иначе переиспользуем
    const audio = (cached && !cached.paused) ? new Audio(path) : (cached || new Audio(path));
    if (!cached) _audioCache[path] = audio;
    audio.currentTime = 0;
    audio.volume = Math.min(1, Math.max(0, volume * _sfxVolume));
    audio.play().catch(() => {});
  } catch (_) {}
}

/** Возвращает путь к звуку удара по типу vfxType карты */
function getCombatHitSound(vfxType) {
  if (['fireball', 'ice_spike', 'lightning', 'dark_void', 'magic_spark'].includes(vfxType))
    return './assets/sfx/combat/hit_magic.wav';
  if (['smash'].includes(vfxType))
    return './assets/sfx/combat/hit_heavy.wav';
  if (['poison'].includes(vfxType))
    return './assets/sfx/combat/hit_poison.wav';
  return './assets/sfx/combat/hit_light.wav';
}

// --- АНИМАЦИЯ СЛИЯНИЯ КАРТ ---

const MergeAnimation = ({ mergeQueue, players, maxMana, onComplete }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [phase, setPhase] = useState('show'); // show | merge | result
  const [showPrompt, setShowPrompt] = useState(false);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    setPhase('show');
    setShowPrompt(false);
    const t1 = setTimeout(() => setPhase('merge'), 1000);
    const t2 = setTimeout(() => setPhase('result'), 1600);
    // подсказку показываем через 2 секунды после появления результата
    const t3 = setTimeout(() => setShowPrompt(true), 1600 + 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [currentIdx]);

  // Продолжение по любой клавише/клику после появления подсказки
  useEffect(() => {
    if (!showPrompt) return;
    const advance = () => {
      if (currentIdx < mergeQueue.length - 1) setCurrentIdx(i => i + 1);
      else onCompleteRef.current();
    };
    window.addEventListener('keydown', advance);
    window.addEventListener('pointerdown', advance);
    return () => {
      window.removeEventListener('keydown', advance);
      window.removeEventListener('pointerdown', advance);
    };
  }, [showPrompt, currentIdx, mergeQueue.length]);

  const current = mergeQueue[currentIdx];
  if (!current) return null;

  const owner = players.find(p => p.id === current.result.ownerId);
  const glowColors = { COMMON: '#64748b', RARE: '#0ea5e9', EPIC: '#9333ea', LEGENDARY: '#f59e0b' };
  const glow = glowColors[current.result.rarity] || '#ffffff';

  return (
    <div className="absolute inset-0 z-[2600] bg-black/92 flex flex-col items-center justify-center backdrop-blur-xl animate-in fade-in duration-300">
      <div className="text-center mb-8">
        <h2 className="text-5xl font-black text-amber-400 uppercase tracking-widest drop-shadow-2xl">⚗️ СЛИЯНИЕ!</h2>
        {mergeQueue.length > 1 && (
          <p className="text-slate-500 text-xs uppercase tracking-widest mt-2">{currentIdx + 1} из {mergeQueue.length}</p>
        )}
      </div>

      <div className="relative flex items-center justify-center" style={{ minHeight: 300 }}>
        {/* Две карты до слияния */}
        {phase !== 'result' && (
          <div className="flex items-center gap-10">
            <div style={{
              width: 176, height: 256,
              transform: phase === 'merge' ? 'translateX(110px) scale(0.1) rotate(12deg)' : 'translateX(0) scale(1)',
              opacity: phase === 'merge' ? 0 : 1,
              transition: 'all 500ms cubic-bezier(0.4, 0, 0.6, 1)',
            }}>
              <AbilityCard card={current.card1} owner={owner} mana={maxMana} maxMana={maxMana} isDisabled={true} comboState={{ isCandidate: false, willGiveBonus: false }} />
            </div>

            <div style={{
              fontSize: 30, fontWeight: 900,
              color: phase === 'merge' ? '#f59e0b' : 'white',
              transform: phase === 'merge' ? 'scale(2.5)' : 'scale(1)',
              transition: 'all 400ms',
              textShadow: phase === 'merge' ? '0 0 30px #f59e0b' : 'none',
            }}>✕</div>

            <div style={{
              width: 176, height: 256,
              transform: phase === 'merge' ? 'translateX(-110px) scale(0.1) rotate(-12deg)' : 'translateX(0) scale(1)',
              opacity: phase === 'merge' ? 0 : 1,
              transition: 'all 500ms cubic-bezier(0.4, 0, 0.6, 1)',
            }}>
              <AbilityCard card={current.card2} owner={owner} mana={maxMana} maxMana={maxMana} isDisabled={true} comboState={{ isCandidate: false, willGiveBonus: false }} />
            </div>
          </div>
        )}

        {/* Результат слияния */}
        {phase === 'result' && (
          <div className="flex flex-col items-center gap-5 animate-in zoom-in-75 fade-in duration-300">
            <div style={{ width: 200, height: 280, position: 'relative' }}>
              {/* мягкое свечение под карточкой */}
              <div style={{
                position: 'absolute', inset: 10, borderRadius: 18,
                background: glow, filter: 'blur(38px)', opacity: 0.55,
                zIndex: 0, pointerEvents: 'none',
              }} />
              <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}>
                <TiltWrapper className="w-full h-full">
                  <AbilityCard card={current.result} owner={owner} mana={maxMana} maxMana={maxMana} isDisabled={false} comboState={{ isCandidate: false, willGiveBonus: false }} growDamage={true} />
                </TiltWrapper>
              </div>
            </div>
            <div style={{ color: glow, fontWeight: 900, fontSize: 18, textTransform: 'uppercase', letterSpacing: '0.2em', textShadow: `0 0 20px ${glow}` }}>
              ▲ Уровень {getCardLevel(current.result)}
            </div>
          </div>
        )}
      </div>

      {/* Подсказка продолжения (через 2с после результата) */}
      {showPrompt && (
        <div className="absolute bottom-10 left-0 right-0 flex justify-center animate-in fade-in duration-500">
          <p className="text-slate-200 text-sm uppercase tracking-[0.3em] font-black animate-pulse drop-shadow-[0_0_10px_rgba(0,0,0,0.9)]">Нажмите любую клавишу чтобы продолжить</p>
        </div>
      )}
    </div>
  );
};

// --- Нарративные вставки между секторами ---
const SECTOR_NARRATIVES = [
  'Путник спускался во всё более мрачные катакомбы, где даже эхо боялось своего голоса.',
  'Воздух стал гуще, пропитанный пеплом и тысячелетней пылью забытых сражений.',
  'За спиной отряда обрушился последний мост в мир живых. Назад дороги больше нет.',
  'Стены нового сектора шептали имена тех, кто рискнул пройти здесь до вас.',
  'Холод подземелья сменился жаром: где-то впереди билось огненное сердце бездны.',
  'Отряд переступил порог, и тьма сомкнулась за ними, словно пасть голодного зверя.',
  'Кости павших устилали путь вперёд — немое предупреждение всем, кто идёт следом.',
  'Чем глубже спускался отряд, тем тише становился мир и громче — стук собственного сердца.',
  'Древние руны вспыхнули на сводах, признавая в пришедших достойных противников.',
  'Здесь время текло иначе. Каждый шаг отдалял от дома на целую вечность.',
  'Сквозь трещины в реальности сочился чужой свет — впереди ждал новый круг испытаний.',
  'Запах гари и металла усилился. Сектор глубже — и враги в нём свирепее прежних.',
];

const SectorSplashScreen = ({ text, sector, onContinue }) => {
  const [showPrompt, setShowPrompt] = useState(false);
  const onContinueRef = useRef(onContinue);
  useEffect(() => { onContinueRef.current = onContinue; }, [onContinue]);

  useEffect(() => {
    const t = setTimeout(() => setShowPrompt(true), 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!showPrompt) return;
    const advance = () => onContinueRef.current();
    window.addEventListener('keydown', advance);
    window.addEventListener('pointerdown', advance);
    return () => {
      window.removeEventListener('keydown', advance);
      window.removeEventListener('pointerdown', advance);
    };
  }, [showPrompt]);

  return (
    <div className="absolute inset-0 z-[2700] bg-[#0a0a0f] flex flex-col items-center justify-center overflow-hidden animate-in fade-in duration-700">
      <img src="./corner.png" alt="" aria-hidden="true" className="pointer-events-none select-none absolute top-0 left-0 w-[340px] h-[340px] opacity-80 drop-shadow-[0_0_10px_rgba(0,0,0,0.9)]" />
      <img src="./corner.png" alt="" aria-hidden="true" className="pointer-events-none select-none absolute top-0 right-0 w-[340px] h-[340px] opacity-80 drop-shadow-[0_0_10px_rgba(0,0,0,0.9)]" style={{ transform: 'scaleX(-1)' }} />
      <img src="./corner.png" alt="" aria-hidden="true" className="pointer-events-none select-none absolute bottom-0 left-0 w-[340px] h-[340px] opacity-80 drop-shadow-[0_0_10px_rgba(0,0,0,0.9)]" style={{ transform: 'scaleY(-1)' }} />
      <img src="./corner.png" alt="" aria-hidden="true" className="pointer-events-none select-none absolute bottom-0 right-0 w-[340px] h-[340px] opacity-80 drop-shadow-[0_0_10px_rgba(0,0,0,0.9)]" style={{ transform: 'scale(-1, -1)' }} />

      <div className="max-w-2xl px-10 text-center relative z-10">
        <p className="text-amber-500/70 text-sm font-black uppercase tracking-[0.5em] mb-8 animate-in fade-in slide-in-from-top-4 duration-1000">Сектор {String(sector)}</p>
        <p className="text-slate-100 text-2xl md:text-3xl font-semibold leading-relaxed italic drop-shadow-[0_0_20px_rgba(0,0,0,0.9)] animate-in fade-in slide-in-from-bottom-4 duration-1000">
          «{text}»
        </p>
      </div>

      {showPrompt && (
        <div className="absolute bottom-12 left-0 right-0 flex justify-center animate-in fade-in duration-700">
          <p className="text-slate-300 text-sm uppercase tracking-[0.3em] font-black animate-pulse drop-shadow-[0_0_10px_rgba(0,0,0,0.9)]">Нажмите любую клавишу чтобы продолжить</p>
        </div>
      )}
    </div>
  );
};

// --- Экран загрузки (прогрев звуков и ассетов) ---
const Preloader = ({ assets, onEnter }) => {
  const [sfxLoaded, setSfxLoaded] = useState(0);
  const totalUnits = assets.length;
  const pct = Math.min(100, Math.round((sfxLoaded / totalUnits) * 100));
  const ready = sfxLoaded >= assets.length;

  useEffect(() => {
    let cancelled = false;
    let sfxCount = 0;
    const bumpSfx = () => {
      if (cancelled) return;
      sfxCount++;
      setSfxLoaded(sfxCount);
    };

    assets.forEach((src) => {
      const isAudio = /\.(wav|mp3|ogg)$/i.test(src);
      if (isAudio) {
        const a = new Audio();
        a.preload = 'auto';
        const fin = () => bumpSfx();
        a.addEventListener('canplaythrough', fin, { once: true });
        a.addEventListener('error', fin, { once: true });
        a.src = src;
        a.load();
        _audioCache[src] = a;
      } else {
        const img = new Image();
        img.onload = bumpSfx;
        img.onerror = bumpSfx;
        img.src = src;
      }
    });

    return () => { cancelled = true; };
  }, [assets]);

  return (
    <div className="fixed inset-0 z-[3000] bg-[#0a0a0f] flex flex-col items-center justify-center overflow-hidden">
      <img src="./corner.png" alt="" aria-hidden="true" className="pointer-events-none select-none absolute top-0 left-0 w-[300px] h-[300px] opacity-60" />
      <img src="./corner.png" alt="" aria-hidden="true" className="pointer-events-none select-none absolute top-0 right-0 w-[300px] h-[300px] opacity-60" style={{ transform: 'scaleX(-1)' }} />
      <img src="./corner.png" alt="" aria-hidden="true" className="pointer-events-none select-none absolute bottom-0 left-0 w-[300px] h-[300px] opacity-60" style={{ transform: 'scaleY(-1)' }} />
      <img src="./corner.png" alt="" aria-hidden="true" className="pointer-events-none select-none absolute bottom-0 right-0 w-[300px] h-[300px] opacity-60" style={{ transform: 'scale(-1, -1)' }} />

      <h1 className="text-6xl md:text-7xl font-black text-amber-500 uppercase italic tracking-widest mb-3 text-center drop-shadow-[0_0_30px_rgba(245,158,11,0.6)]">Card Battler</h1>
      <p className="text-slate-500 text-xs uppercase tracking-[0.5em] mb-12">Подготовка к спуску</p>

      <div className="w-[min(80vw,420px)]">
        <div className="h-3 w-full bg-slate-800/80 rounded-full overflow-hidden border border-slate-700 shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-[#1E88E5] via-amber-400 to-[#D32F2F] transition-all duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between mt-3 text-[11px] uppercase tracking-widest font-black">
          <span className="text-slate-500">{ready ? 'Готово' : 'Загрузка ассетов…'}</span>
          <span className="text-slate-300">{pct}%</span>
        </div>
      </div>

      <div className="mt-12 h-16 flex items-center justify-center">
        {ready && pct >= 100 ? (
          <button
            onClick={onEnter}
            className="px-14 py-5 bg-white text-slate-900 rounded-full font-black text-xl uppercase tracking-tighter hover:scale-110 active:scale-95 transition-all shadow-[0_0_30px_rgba(255,255,255,0.45)] animate-in fade-in zoom-in-90 duration-500"
          >
            Войти
          </button>
        ) : (
          <div className="w-10 h-10 border-4 border-slate-700 border-t-amber-500 rounded-full animate-spin" />
        )}
      </div>
    </div>
  );
};

// --- 3. ГЛАВНОЕ ПРИЛОЖЕНИЕ ---

export default function App() {
  const [players, setPlayers] = useState(() => INITIAL_PLAYERS_DATA.map(p => syncPlayerMaxHp({ ...p })));
  const [enemies, setEnemies] = useState([]);
  
  const [maxMana, setMaxMana] = useState(5);
  const [mana, setMana] = useState(0); 
  const [turnState, setTurnState] = useState('map'); 
  
  const [drawPile, setDrawPile] = useState(() => shuffleArray([...INITIAL_DECK]));
  const [discardPile, setDiscardPile] = useState([]);
  const [xp, setXp] = useState(0);
  const [playerLevel, setPlayerLevel] = useState(1); 
  const [xpToNext, setXpToNext] = useState(60);
  const xpToNextRef = useRef(60);
  const [rewardOptions, setRewardOptions] = useState([]);
  
  const [currentEvent, setCurrentEvent] = useState(null);
  
  // Состояние говорящего врага
  const [speakingEnemy, setSpeakingEnemy] = useState(null);
  const speakingTimeoutRef = useRef(null);

  const initialMapRef = useRef(null);
  if (!initialMapRef.current) {
    initialMapRef.current = generateMap();
  }

  const [gameMap, setGameMap] = useState(initialMapRef.current);
  const [currentMapNodeId, setCurrentMapNodeId] = useState(initialMapRef.current[0].id);
  const [completedNodes, setCompletedNodes] = useState([initialMapRef.current[0].id]);
  const [currentStage, setCurrentStage] = useState(0); 
  const [sector, setSector] = useState(1);
  const [sectorSplash, setSectorSplash] = useState(null);
  const [bgLocation, setBgLocation] = useState(() => pickRandomBgLocation());

  const [flyingXps, setFlyingXps] = useState([]);
  const [flyingItems, setFlyingItems] = useState([]);
  const [inventory, setInventory] = useState(Array(INVENTORY_SIZE).fill(null));
  const [equipped, setEquipped] = useState({ p1: null, p2: null, p3: null });
  const [dragSrcIdx, setDragSrcIdx] = useState(null);
  const [dragOverPlayerId, setDragOverPlayerId] = useState(null);
  const [itemTooltip, setItemTooltip] = useState(null);
  const [showCraft, setShowCraft] = useState(false);
  const [craftSlots, setCraftSlots] = useState([null, null, null]);
  const [craftWarning, setCraftWarning] = useState('');
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [mergeQueue, setMergeQueue] = useState([]);
  const [showReserve, setShowReserve] = useState(false);
  const [showAllCards, setShowAllCards] = useState(false);
  const [burnConfirmId, setBurnConfirmId] = useState(null);
  const [appReady, setAppReady] = useState(false);
  const [ownedCards, setOwnedCards] = useState([]);
  const [cardRewardCards, setCardRewardCards] = useState([]);
  const pendingCardRewardRef = useRef(null);
  const [flyingCards, setFlyingCards] = useState([]);
  const [damagePopups, setDamagePopups] = useState([]);
  const [vfxList, setVfxList] = useState([]);
  const [bloodParticles, setBloodParticles] = useState([]);
  const [flashingTargets, setFlashingTargets] = useState([]);

  const [shake, setShake] = useState({ x: 0, y: 0, rot: 0 });
  const [flash, setFlash] = useState(false);
  const [lastPlayedCost, setLastPlayedCost] = useState(null);
  const [comboStreak, setComboStreak] = useState(0);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState(false);
  const [musicOn, setMusicOn] = useState(true);
  const [sfxVolume, setSfxVolume] = useState(0.35);
  const [musicVolume, setMusicVolume] = useState(0.35);
  const musicVolumeRef = useRef(0.35);
  const musicFadeRef = useRef(null);
  const musicOnRef = useRef(true);

  const musicBlobUrlRef = useRef(null);
  const musicStartedRef = useRef(false);
  const enteredRef = useRef(false);
  const [mediaBytes, setMediaBytes] = useState({ loaded: 0, total: 0, done: false });

  useEffect(() => { _sfxVolume = sfxVolume; }, [sfxVolume]);
  useEffect(() => {
    musicVolumeRef.current = musicVolume;
    if (audioRef.current && musicOn) audioRef.current.volume = musicVolume;
  }, [musicVolume, musicOn]);
  useEffect(() => { musicOnRef.current = musicOn; }, [musicOn]);
  useEffect(() => { xpToNextRef.current = xpToNext; }, [xpToNext]);

  const startBackgroundMusic = useCallback(() => {
    if (musicStartedRef.current) return;
    const audio = audioRef.current;
    if (!audio || !musicOnRef.current || !musicBlobUrlRef.current) return;
    musicStartedRef.current = true;
    const play = () => {
      if (audio.duration && isFinite(audio.duration)) audio.currentTime = Math.random() * audio.duration;
      audio.volume = musicVolumeRef.current;
      audio.play().catch(() => {});
    };
    if (audio.readyState >= 2) play();
    else audio.addEventListener('canplay', play, { once: true });
  }, []);

  const applyMusicSource = useCallback(() => {
    const audio = audioRef.current;
    if (audio && musicBlobUrlRef.current) {
      audio.src = musicBlobUrlRef.current;
      audio.loop = true;
      audio.load();
    }
  }, []);

  const handleEnterGame = useCallback(() => {
    enteredRef.current = true;
    if (musicBlobUrlRef.current) {
      applyMusicSource();
      startBackgroundMusic();
    }
    setAppReady(true);
  }, [applyMusicSource, startBackgroundMusic]);

  // Фоновая загрузка музыки: качаем только первую половину файла (обрезка трека вдвое)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(MUSIC_URL);
        if (!res.ok) throw new Error('music fetch failed');
        const total = Number(res.headers.get('content-length')) || 0;
        const halfTotal = total > 0 ? Math.floor(total / 2) : 0;
        const target = halfTotal || total;
        const reader = res.body.getReader();
        const chunks = [];
        let received = 0;
        setMediaBytes({ loaded: 0, total: target, done: false });
        while (true) {
          const { done, value } = await reader.read();
          if (cancelled) return;
          if (done) break;
          chunks.push(value);
          received += value.length;
          setMediaBytes({ loaded: Math.min(received, target || received), total: target || received, done: false });
          if (halfTotal && received >= halfTotal) {
            try { await reader.cancel(); } catch { /* ignore */ }
            break;
          }
        }
        if (cancelled) return;
        // Склеиваем загруженное и обрезаем до последней целой MP3-границы кадра,
        // иначе аудио не декодируется и не играет
        let merged = new Uint8Array(received);
        let offset = 0;
        for (const c of chunks) { merged.set(c, offset); offset += c.length; }
        if (halfTotal) {
          let cut = merged.length;
          for (let i = merged.length - 2; i > merged.length - 4000 && i > 0; i--) {
            if (merged[i] === 0xff && (merged[i + 1] & 0xe0) === 0xe0) { cut = i; break; }
          }
          merged = merged.subarray(0, cut);
        }
        const blob = new Blob([merged], { type: 'audio/mpeg' });
        musicBlobUrlRef.current = URL.createObjectURL(blob);
        setMediaBytes(prev => ({ loaded: prev.total || received, total: prev.total || received, done: true }));
      } catch {
        if (cancelled) return;
        musicBlobUrlRef.current = MUSIC_URL;
        setMediaBytes({ loaded: 1, total: 1, done: true });
      }
      if (!cancelled && enteredRef.current) {
        applyMusicSource();
        startBackgroundMusic();
      }
    })();
    return () => { cancelled = true; };
  }, [applyMusicSource, startBackgroundMusic]);

  const appRef = useRef(null);
  const slotRefs = useRef({});
  const enemyRefs = useRef({});
  const avatarRefs = useRef({});
  const deckRef = useRef(null);
  const discardRef = useRef(null);
  const xpBarRef = useRef(null);
  const inventoryRef = useRef(null);
  const mapScrollRef = useRef(null);
  const audioRef = useRef(null);
  const showLevelUpRef = useRef(false);
  const pendingTransitionRef = useRef(null);

  const [isAnimating, setIsAnimating] = useState(false);
  const [animatingPlayerId, setAnimatingPlayerId] = useState(null);
  const [animatingEnemyId, setAnimatingEnemyId] = useState(null);
  const [animatingTargetIds, setAnimatingTargetIds] = useState([]);
  const [hoveredPlayerId, setHoveredPlayerId] = useState(null);
  const [hoveredTargetIds, setHoveredTargetIds] = useState([]);

  useEffect(() => {
    if (turnState === 'map' && mapScrollRef.current && currentMapNodeId) {
      const currNode = gameMap.find(n => n.id === currentMapNodeId);
      if (currNode) {
        const containerWidth = mapScrollRef.current.clientWidth;
        const scrollPos = currNode.x - containerWidth / 2 + 30; 
        mapScrollRef.current.scrollTo({ left: Math.max(0, scrollPos), behavior: 'smooth' });
      }
    }
  }, [turnState, currentMapNodeId, gameMap]);

  const setSlotRef = (id, el) => { if (el) slotRefs.current[id] = el; };
  const setEnemyRef = (id, el) => { if (el) enemyRefs.current[id] = el; };
  const setAvatarRef = (id, el) => { if (el) avatarRefs.current[id] = el; };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Плавно меняет громкость аудио от from до to за durationMs
  const fadeAudio = (audio, from, to, durationMs, onDone) => {
    if (musicFadeRef.current) clearInterval(musicFadeRef.current);
    const steps = 40;
    const stepTime = durationMs / steps;
    let step = 0;
    audio.volume = Math.max(0, Math.min(1, from));
    musicFadeRef.current = setInterval(() => {
      step++;
      const v = from + (to - from) * (step / steps);
      audio.volume = Math.max(0, Math.min(1, v));
      if (step >= steps) {
        clearInterval(musicFadeRef.current);
        musicFadeRef.current = null;
        if (onDone) onDone();
      }
    }, stepTime);
  };

  // Перематывает музыку в случайное место с фейдом вниз-вверх
  const musicFadeToRandom = () => {
    const audio = audioRef.current;
    if (!audio || !musicOn) return;
    const target = musicVolumeRef.current;
    fadeAudio(audio, audio.volume, 0, 800, () => {
      if (audio.duration && isFinite(audio.duration)) {
        audio.currentTime = Math.random() * audio.duration;
      }
      audio.play().catch(() => {});
      fadeAudio(audio, 0, target, 1200, null);
    });
  };

  const toggleMusic = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (musicOn) {
      fadeAudio(audio, audio.volume, 0, 600, () => { audio.pause(); });
      setMusicOn(false);
    } else {
      if (audio.duration && isFinite(audio.duration)) {
        audio.currentTime = Math.random() * audio.duration;
      }
      audio.play().catch(() => {});
      fadeAudio(audio, 0, musicVolumeRef.current, 1000, null);
      setMusicOn(true);
    }
  };

  const isNodeClickable = (node) => {
    if (completedNodes.includes(node.id)) return false;
    if (currentMapNodeId) {
      const currNode = gameMap.find(n => n.id === currentMapNodeId);
      if (currNode && currNode.next.includes(node.id)) return true;
    }
    return false;
  };

  const handleNodeClick = (node) => {
    if (!isNodeClickable(node)) return;
    playSound('./assets/sfx/map/node_click.wav');
    setCurrentMapNodeId(node.id);
    setCurrentStage(node.stage);
    setBgLocation(pickRandomBgLocation());

    if (node.type === 'event') {
      playSound('./assets/sfx/events/event_start.wav');
       const randomNarrative = EVENT_NARRATIVES[Math.floor(Math.random() * EVENT_NARRATIVES.length)];
       const randomPowerups = shuffleArray([...POWERUPS]).slice(0, 3);
       setCurrentEvent({ narrative: randomNarrative, options: randomPowerups });
       setTurnState('event');
    } else {
       const spawnedEnemies = spawnEnemies(node.type, node.stage, sector);
       setEnemies(spawnedEnemies);
       setTurnState('dealing');
       
       // Логика выкрикивания случайного оскорбления
       if (spawnedEnemies.length > 0) {
         const randEnemy = spawnedEnemies[Math.floor(Math.random() * spawnedEnemies.length)];
         const randInsult = ENEMY_INSULTS[Math.floor(Math.random() * ENEMY_INSULTS.length)];
         setSpeakingEnemy({ id: randEnemy.id, text: randInsult });
         
         if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
         speakingTimeoutRef.current = setTimeout(() => {
            setSpeakingEnemy(null);
         }, 3500); // Баббл висит 3.5 секунды
       }
    }
  };

  const handleEventChoice = (powerupId) => {
     if (powerupId === 'mana') {
        setMaxMana(m => m + 1);
     } else if (powerupId === 'stats') {
        setPlayers(prev => prev.map(p => {
           let updated = { ...p };
           if (p.id === 'p1') updated.str *= 2;
           if (p.id === 'p2') updated.agi *= 2;
           if (p.id === 'p3') updated.int *= 2;
           const maxHp = getMaxHpFromStats(updated);
           const hpGain = maxHp - p.maxHp;
           return syncPlayerMaxHp({ ...updated, hp: p.hp + Math.max(0, hpGain) });
        }));
     } else if (powerupId === 'hp') {
        setPlayers(prev => prev.map(p => {
           const bonus = Math.floor(p.maxHp * 0.5);
           return syncPlayerMaxHp({ ...p, baseMaxHp: (p.baseMaxHp ?? p.maxHp - p.str) + bonus, hp: p.hp + bonus });
        }));
     } else if (powerupId === 'cards') {
        const legendaries = REWARD_POOL.filter(c => c.rarity === 'LEGENDARY');
        const epics = REWARD_POOL.filter(c => c.rarity === 'EPIC');
        const newCards = [];
        if (legendaries.length) {
           const leg = legendaries[Math.floor(Math.random() * legendaries.length)];
           newCards.push({ ...leg, id: `evt_${Date.now()}_l_${Math.random()}` });
        }
        for (let i = 0; i < 2; i++) {
           if (epics.length) {
              const ep = epics[Math.floor(Math.random() * epics.length)];
              newCards.push({ ...ep, id: `evt_${Date.now()}_e${i}_${Math.random()}` });
           }
        }

        playSound('./assets/sfx/events/powerup_select.wav');
        setCompletedNodes(prev => [...prev, currentMapNodeId]);
        setTurnState('map');
        setCurrentEvent(null);
        // показываем экран получения карт (с пометками слияния)
        showCardReward(newCards);
        return;
     }

     playSound('./assets/sfx/events/powerup_select.wav');
     setCompletedNodes(prev => [...prev, currentMapNodeId]);
     setTurnState('map');
     setCurrentEvent(null);
  };

  const handleCardHover = (playerIndex) => {
    const player = players[playerIndex];
    if (turnState !== 'player' || player.hp <= 0 || !player.currentCard || player.hasActed || isAnimating || showLevelUp || turnState === 'victory_wait') return;
    playSound('./assets/sfx/ui/hover.wav', 0.4);
    setHoveredPlayerId(player.id);
    const targetIndices = getTargets(player.currentCard, playerIndex, enemies);
    setHoveredTargetIds(targetIndices.map(idx => enemies[idx].id));
  };

  const resetGame = (fullReset = false, advanceSector = false, fromDeath = false) => {
    if (fullReset) setSector(1);
    else if (advanceSector) setSector(s => s + 1);
    else if (fromDeath) setSector(1);

    musicFadeToRandom();

    // Сначала собираем карты с рук (до очистки currentCard)
    let handCards = [];
    players.forEach(p => { if (p.currentCard && !p.currentCard.id.startsWith('b')) handCards.push(p.currentCard); });
    const currentFullDeck = [...drawPile, ...discardPile, ...handCards];

    if (fullReset) {
      setPlayers(INITIAL_PLAYERS_DATA.map(p => syncPlayerMaxHp({ ...p })));
      setXp(0); setXpToNext(60); setPlayerLevel(1); setMaxMana(5);
      setDrawPile(shuffleArray([...INITIAL_DECK])); setDiscardPile([]);
      setInventory(Array(INVENTORY_SIZE).fill(null));
      setEquipped({ p1: null, p2: null, p3: null });
    } else {
      // Смерть / новый сектор: статы, уровень, мана, колода и предметы сохраняются,
      // бойцы воскресают с полным HP
      setPlayers(prev => prev.map(p => syncPlayerMaxHp({
        ...p,
        hp: getMaxHpFromStats(p, equipped[p.id]),
        currentCard: null,
        hasActed: false,
        justDealt: false,
      }, equipped[p.id])));
      setDrawPile(shuffleArray(currentFullDeck.length > 0 ? currentFullDeck : [...INITIAL_DECK]));
      setDiscardPile([]);
    }

    setEnemies([]); setMana(0); setLastPlayedCost(null); setComboStreak(0); setDamagePopups([]); setFlyingXps([]); setFlyingItems([]); setShowLevelUp(false); setMergeQueue([]);
    setDragSrcIdx(null); setDragOverPlayerId(null); setItemTooltip(null);
    setShowCraft(false); setCraftSlots([null, null, null]); setCraftWarning('');
    setCurrentEvent(null);
    setBloodParticles([]);
    setFlashingTargets([]);
    setCardRewardCards([]);
    setSectorSplash(null);
    setBurnConfirmId(null);
    pendingCardRewardRef.current = null;
    pendingTransitionRef.current = null;
    
    if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
    setSpeakingEnemy(null);

    const newMap = generateMap();
    setGameMap(newMap); setCurrentMapNodeId(newMap[0].id); setCompletedNodes([newMap[0].id]); setCurrentStage(0);
    setTurnState('map');
  };

  const getTargets = useCallback((card, playerIndex, currentEnemies) => {
    if (card.type === 'splash') return currentEnemies.map((e, i) => !e.isDead ? i : -1).filter(i => i !== -1);
    const alive = currentEnemies.map((e, i) => ({...e, originalIndex: i})).filter(e => !e.isDead);
    if (alive.length === 0) return [];
    if (card.priority === 'lowestHp') {
      alive.sort((a, b) => a.hp - b.hp); return [alive[0].originalIndex];
    } else if (card.priority === 'highestHp') {
      alive.sort((a, b) => b.hp - a.hp); return [alive[0].originalIndex];
    } else {
      if (!currentEnemies[playerIndex]?.isDead && currentEnemies[playerIndex]) return [playerIndex];
      return [alive[0].originalIndex];
    }
  }, []);

  const triggerImpact = (damageValue) => {
    setFlash(true); setTimeout(() => setFlash(false), 100);
    const intensity = Math.min(Math.max(damageValue, 15), 150) * 0.8; 
    
    const shakeInterval = setInterval(() => {
      setShake({ 
        x: (Math.random() - 0.5) * intensity, 
        y: (Math.random() - 0.5) * intensity,
        rot: (Math.random() - 0.5) * (intensity * 0.2) 
      });
    }, 20);
    
    setTimeout(() => { clearInterval(shakeInterval); setShake({ x: 0, y: 0, rot: 0 }); }, 350);
  };

  const gainXp = useCallback((amount) => {
    if (!amount || amount <= 0) return;
    setXp(prev => {
      const total = prev + amount;
      const cur = xpToNextRef.current;
      if (total >= cur) {
        setRewardOptions(shuffleArray([...REWARD_POOL]).slice(0, 3));
        setShowLevelUp(true); setPlayerLevel(l => l + 1); setMaxMana(m => m + 1);
        setXpToNext(cur + 50); xpToNextRef.current = cur + 50;
        return total - cur;
      }
      return total;
    });
  }, []);

  const handleXpGained = (id, amount) => {
    playSound('./assets/sfx/game/xp_gain.wav', 0.5);
    setFlyingXps(prev => prev.filter(x => x.id !== id));
    gainXp(amount);
  };

  const addItemToInventory = useCallback((item) => {
    let burnedXp = 0;
    setInventory(prev => {
      const idx = prev.findIndex(s => s === null);
      if (idx === -1) {
        // Инвентарь полон: первый предмет сгорает в опыт, остальные сдвигаются
        burnedXp = getItemBurnXp(prev[0]);
        return [...prev.slice(1), item];
      }
      const next = [...prev];
      next[idx] = item;
      return next;
    });
    if (burnedXp > 0) gainXp(burnedXp);
    return true;
  }, [gainXp]);

  const handleItemLanded = useCallback((id, item) => {
    setFlyingItems(prev => prev.filter(x => x.id !== id));
    addItemToInventory(item);
    playSound('./assets/sfx/game/xp_gain.wav', 0.35);
  }, [addItemToInventory]);

  const showItemTip = (item, e) => {
    if (!item) return;
    setItemTooltip({ item, x: e.clientX, y: e.clientY });
  };

  const hideItemTip = () => setItemTooltip(null);

  const handleInvDragStart = (idx) => (e) => {
    setDragSrcIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleEquipDragOver = (playerId) => (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverPlayerId(playerId);
  };

  const handleEquipDragLeave = () => setDragOverPlayerId(null);

  const handleEquipDrop = (playerId) => (e) => {
    e.preventDefault();
    setDragOverPlayerId(null);
    if (dragSrcIdx === null || !inventory[dragSrcIdx]) return;
    const item = inventory[dragSrcIdx];
    const current = equipped[playerId];
    setInventory(prev => { const n = [...prev]; n[dragSrcIdx] = current; return n; });
    setEquipped(prev => ({ ...prev, [playerId]: item }));
    setPlayers(prev => prev.map(p => p.id === playerId ? syncPlayerMaxHp(p, item) : p));
    playSound('./assets/sfx/events/powerup_select.wav', 0.45);
    setDragSrcIdx(null);
  };

  const handleUnequip = (playerId) => {
    const current = equipped[playerId];
    if (!current) return;
    const freeIdx = inventory.findIndex(s => s === null);
    if (freeIdx === -1) return;
    setInventory(prev => { const n = [...prev]; n[freeIdx] = current; return n; });
    setEquipped(prev => ({ ...prev, [playerId]: null }));
    setPlayers(prev => prev.map(p => p.id === playerId ? syncPlayerMaxHp(p, null) : p));
    playSound('./assets/sfx/ui/card_discard.wav', 0.35);
  };

  // --- Крафт ---
  const openCraft = () => {
    setCraftSlots([null, null, null]);
    setCraftWarning('');
    setShowCraft(true);
    setItemTooltip(null);
    playSound('./assets/sfx/ui/click.wav', 0.5);
  };

  const closeCraft = () => {
    // Вернуть предметы из слотов крафта обратно в инвентарь
    const placed = craftSlots.filter(Boolean);
    if (placed.length > 0) {
      setInventory(prev => {
        const n = [...prev];
        placed.forEach(it => {
          const free = n.findIndex(s => s === null);
          if (free !== -1) n[free] = it;
        });
        return n;
      });
    }
    setShowCraft(false);
    setCraftSlots([null, null, null]);
    setCraftWarning('');
  };

  // Перетаскивание предмета из инвентаря в конкретный слот крафта
  const handleCraftDrop = (slotIdx) => (e) => {
    e.preventDefault();
    if (dragSrcIdx === null || !inventory[dragSrcIdx]) return;
    const item = inventory[dragSrcIdx];
    setCraftWarning('');
    setCraftSlots(prev => {
      const n = [...prev];
      // Если в слоте уже был предмет — вернём его в инвентарь
      const displaced = n[slotIdx];
      n[slotIdx] = item;
      setInventory(inv => {
        const ni = [...inv];
        ni[dragSrcIdx] = displaced || null;
        return ni;
      });
      return n;
    });
    setDragSrcIdx(null);
    playSound('./assets/sfx/ui/click.wav', 0.35);
  };

  const removeFromCraft = (slotIdx) => {
    setCraftWarning('');
    setCraftSlots(prev => {
      const item = prev[slotIdx];
      if (!item) return prev;
      const freeIdx = inventory.findIndex(s => s === null);
      if (freeIdx === -1) return prev;
      setInventory(inv => { const ni = [...inv]; ni[freeIdx] = item; return ni; });
      const n = [...prev]; n[slotIdx] = null; return n;
    });
  };

  const doCraft = () => {
    const items = craftSlots.filter(Boolean);
    if (items.length < 3) {
      setCraftWarning('Нужно поместить 3 предмета');
      return;
    }
    const rarity = items[0].rarity;
    if (!items.every(it => it.rarity === rarity)) {
      setCraftWarning('Все предметы должны быть одной редкости');
      return;
    }
    const next = getNextRarity(rarity);
    if (!next) {
      setCraftWarning('Легендарные предметы нельзя улучшить');
      return;
    }
    const result = generateItemOfRarity(next);
    setInventory(prev => {
      const idx = prev.findIndex(s => s === null);
      const n = [...prev];
      if (idx !== -1) n[idx] = result;
      return n;
    });
    setCraftSlots([null, null, null]);
    playSound('./assets/sfx/events/powerup_select.wav', 0.6);
    setShowCraft(false);
    setCraftWarning('');
  };

  const collectAllDeckCards = () => {
    const hand = players.map(p => p.currentCard).filter(c => c && !c.id.startsWith('b'));
    const seen = new Set();
    return [...drawPile, ...discardPile, ...hand].filter(c => c && !seen.has(c.id) && seen.add(c.id));
  };

  const openAllCardsView = () => {
    setOwnedCards(collectAllDeckCards());
    setShowAllCards(true);
  };

  // Реальные карты, которые сейчас на руках (без базовых "b*"), включая павших героев
  const getRealHandCards = () => players.map(p => p.currentCard).filter(c => c && !c.id.startsWith('b'));

  // Применяет результат слияния, корректно учитывая карты на руках:
  // слитые карты убираются с рук, оставшиеся на руках не дублируются в колоде.
  const commitMergedDeck = (newDeck, merges) => {
    const survivingIds = new Set(newDeck.map(c => c.id));
    const realHand = getRealHandCards();
    setPlayers(prev => prev.map(p => (p.currentCard && !p.currentCard.id.startsWith('b') && !survivingIds.has(p.currentCard.id)) ? { ...p, currentCard: null } : p));
    const stillInHand = new Set(realHand.filter(c => survivingIds.has(c.id)).map(c => c.id));
    setDrawPile(shuffleArray(newDeck.filter(c => !stillInHand.has(c.id))));
    setDiscardPile([]);
    setMergeQueue(merges);
  };

  // Сливает любые имеющиеся пары во всей колоде (резерв + сброс + руки). Возвращает true, если было слияние.
  const settleMerges = () => {
    const full = [...drawPile, ...discardPile, ...getRealHandCards()];
    const { newDeck, merges } = checkAndMerge(full);
    if (merges.length === 0) return false;
    commitMergedDeck(newDeck, merges);
    return true;
  };

  // Проверяет, приведёт ли добавление карты к слиянию (для меток "СЛИЯНИЕ")
  const rewardWouldMerge = (card) => {
    const { merges } = checkAndMerge([...drawPile, ...discardPile, ...getRealHandCards(), { ...card, id: `chk_${Math.random()}` }]);
    return merges.length > 0;
  };

  // Показывает окно получения карт с пометкой готовых к слиянию
  const showCardReward = (newCards) => {
    const fullDeck = [...drawPile, ...discardPile, ...getRealHandCards(), ...newCards];
    const { newDeck, merges } = checkAndMerge(fullDeck);
    const surviving = new Set(newDeck.map(c => c.id));
    const displayCards = newCards.map(c => ({ ...c, willMerge: !surviving.has(c.id) }));
    pendingCardRewardRef.current = { newCards };
    setCardRewardCards(displayCards);
  };

  const finishCardReward = () => {
    const pending = pendingCardRewardRef.current;
    pendingCardRewardRef.current = null;
    setCardRewardCards([]);
    if (!pending) return;
    const full = [...drawPile, ...discardPile, ...getRealHandCards(), ...pending.newCards];
    const { newDeck, merges } = checkAndMerge(full);
    if (merges.length > 0) {
      playSound('./assets/sfx/game/level_up.wav');
      commitMergedDeck(newDeck, merges);
    } else {
      setDrawPile(prev => [...prev, ...pending.newCards]);
    }
  };

  // Сжечь карту из колоды за -1 к максимальной мане (удаляет её из любой части ротации)
  const burnCard = (card) => {
    if (maxMana <= 1) return;
    setBurnConfirmId(null);
    setDrawPile(prev => prev.filter(c => c.id !== card.id));
    setDiscardPile(prev => prev.filter(c => c.id !== card.id));
    setPlayers(prev => prev.map(p => (p.currentCard && p.currentCard.id === card.id) ? { ...p, currentCard: null } : p));
    setMaxMana(prev => {
      const nm = Math.max(1, prev - 1);
      setMana(m => Math.min(m, nm));
      return nm;
    });
    playSound('./assets/sfx/game/enemy_turn.wav', 0.5);
  };

  const selectReward = (card) => {
    playSound('./assets/sfx/game/level_up.wav');
    const newCard = { ...card, id: `rew_${Date.now()}_${Math.random()}` };
    const fullDeck = [...drawPile, ...discardPile, ...getRealHandCards(), newCard];
    const { newDeck, merges } = checkAndMerge(fullDeck);

    if (merges.length > 0) {
      commitMergedDeck(newDeck, merges);
    } else {
      setDrawPile(prev => {
        const pile = [...prev];
        const randomIndex = Math.floor(Math.random() * (pile.length + 1));
        pile.splice(randomIndex, 0, newCard);
        return pile;
      });
    }

    setShowLevelUp(false);
    // Если нет слияний — сразу выполняем отложенный переход
    if (merges.length === 0) {
      const pending = pendingTransitionRef.current;
      if (pending) {
        pendingTransitionRef.current = null;
        if (pending === 'victory') { playSound('./assets/sfx/game/victory.wav'); setTurnState('victory'); }
        else setTurnState(pending);
      }
    }
  };

  const handleMergeComplete = () => {
    setMergeQueue([]);
    const pending = pendingTransitionRef.current;
    if (pending) {
      pendingTransitionRef.current = null;
      if (pending === 'victory') { playSound('./assets/sfx/game/victory.wav'); setTurnState('victory'); }
      else setTurnState(pending);
    }
  };

  useEffect(() => {
    if (turnState !== 'dealing' || showLevelUp) return;
    setLastPlayedCost(null); setComboStreak(0);
    const checkAndReshuffle = () => {
      let currentDraw = [...drawPile]; let currentDiscard = [...discardPile];
      const alivePlayersCount = players.filter(p => p.hp > 0).length;
      if (currentDraw.length < alivePlayersCount && currentDiscard.length > 0) {
        const discRect = discardRef.current?.getBoundingClientRect(); const deckRect = deckRef.current?.getBoundingClientRect();
        if (discRect && deckRect) {
          for (let i = 0; i < 5; i++) {
             setTimeout(() => {
                const flyId = `reshuffle_${Date.now()}_${i}`;
                setFlyingCards(prev => [...prev, { id: flyId, startX: discRect.left + discRect.width/2, startY: discRect.top + discRect.height/2, endX: deckRect.left + deckRect.width/2, endY: deckRect.top + deckRect.height/2, isReshuffle: true }]);
                setTimeout(() => setFlyingCards(p => p.filter(f => f.id !== flyId)), 850);
             }, i * 100);
          }
        }
        currentDraw = shuffleArray([...currentDraw, ...currentDiscard]); currentDiscard = [];
      }
      return { currentDraw, currentDiscard };
    };
    const { currentDraw, currentDiscard } = checkAndReshuffle();
    const tempDraw = [...currentDraw]; const assignments = {}; 
    const alivePlayers = players.filter(p => p.hp > 0);
    alivePlayers.forEach(p => {
      if (tempDraw.length > 0) {
        const candidateIndex = tempDraw.findIndex(c => c.ownerId === p.id);
        if (candidateIndex !== -1) { assignments[p.id] = tempDraw.splice(candidateIndex, 1)[0]; }
      }
    });
    let delay = 0; const deckRect = deckRef.current?.getBoundingClientRect();
    players.forEach(p => {
      if (p.hp <= 0) return;
      const cardToDeal = assignments[p.id] || HERO_ABILITIES[p.id].basic;
      const slotRect = slotRefs.current[p.id]?.getBoundingClientRect();
      if (deckRect && slotRect) {
        const flyId = `deal_${p.id}_${Date.now()}`;
        setTimeout(() => { playSound('./assets/sfx/ui/card_deal.wav', 0.5); setFlyingCards(prev => [...prev, { id: flyId, startX: deckRect.left + deckRect.width/2, startY: deckRect.top + deckRect.height/2, endX: slotRect.left + slotRect.width/2, endY: slotRect.top + slotRect.height * 0.75 }]); }, delay);
        setTimeout(() => { setFlyingCards(prev => prev.filter(f => f.id !== flyId)); setPlayers(prev => prev.map(hero => hero.id === p.id ? { ...hero, currentCard: cardToDeal, justDealt: true } : hero)); }, delay + 850); 
      }
      delay += 300; 
    });
    setTimeout(() => { playSound('./assets/sfx/game/mana_restore.wav', 0.5); setDrawPile(tempDraw); setDiscardPile(currentDiscard); setPlayers(prev => prev.map(p => ({ ...p, hasActed: false, justDealt: false }))); setMana(maxMana); setTurnState('player'); }, delay + 1000); 
  }, [turnState, showLevelUp, maxMana]);

  const playCard = (playerIndex, card) => {
    const player = players[playerIndex];
    const effectivePlayer = getEffectivePlayer(player, equipped[player.id]);
    if (turnState !== 'player' || mana < card.cost || player.hp <= 0 || player.hasActed || isAnimating) return;
    const targetIndices = getTargets(card, playerIndex, enemies);
    if (targetIndices.length === 0) return;

    playSound('./assets/sfx/ui/click.wav', 0.6);
    setIsAnimating(true); setMana(m => m - card.cost); setAnimatingPlayerId(player.id); setAnimatingTargetIds(targetIndices.map(idx => enemies[idx].id));

    const isContinuing = lastPlayedCost !== null && card.cost === lastPlayedCost + 1;
    const multiplier = isContinuing ? 1.5 : 1.0;
    
    if (isContinuing) setComboStreak(s => s + 1); else setComboStreak(0);
    setLastPlayedCost(card.cost);

    const aRect = avatarRefs.current[player.id]?.getBoundingClientRect();
    const vfxArr = [];
    targetIndices.forEach(idx => {
       const tRect = enemyRefs.current[enemies[idx].id]?.getBoundingClientRect();
       if (aRect && tRect) {
          const baseVfx = {
             startX: aRect.left + aRect.width/2, startY: aRect.top + aRect.height/2,
             endX: tRect.left + tRect.width/2, endY: tRect.top + tRect.height/2
          };
          
          let vfxCount = 1;
          const type = card.vfxType || 'slash';
          if (type === 'daggers' || type === 'poison') vfxCount = 12;
          
          for (let k = 0; k < vfxCount; k++) {
             vfxArr.push({ id: Math.random(), type, delay: k * (vfxCount > 1 ? 15 : 0), ...baseVfx });
          }
       }
    });
    setVfxList(vfxArr);

    const animDuration = player.id === 'p2' ? 600 : 300;

    setTimeout(() => {
      setVfxList([]); 
      const { damage, isCrit } = rollCardDamage(effectivePlayer, card, multiplier);
      const newEnemies = enemies.map(e => ({...e})); let xpToSpawn = []; let lootToSpawn = [];
      
      playSound(getCombatHitSound(card.vfxType || 'slash'));
      if (isCrit) playSound('./assets/sfx/combat/hit_heavy.wav', 0.7);
      triggerImpact(damage);

      const hitEnemyIds = targetIndices.map(idx => enemies[idx].id);
      setFlashingTargets(prev => [...prev, ...hitEnemyIds]);
      setTimeout(() => setFlashingTargets(prev => prev.filter(id => !hitEnemyIds.includes(id))), 250);

      const newBlood = [];
      targetIndices.forEach(idx => {
        const target = newEnemies[idx]; target.hp -= damage;
        const eRect = enemyRefs.current[target.id]?.getBoundingClientRect();
        if (eRect) {
           setDamagePopups(prev => [...prev, { id: Math.random(), value: damage, isCrit, x: eRect.left + eRect.width / 2, y: eRect.top + eRect.height / 2 }]);
           for(let i=0; i<30; i++) {
              newBlood.push({ id: Math.random(), x: eRect.left + eRect.width/2, y: eRect.top + eRect.height/2 });
           }
        }
        if (target.hp <= 0 && !target.isDead) {
          target.hp = 0; target.isDead = true;
          xpToSpawn.push({ id: target.id, amount: target.xpReward });
          const loot = rollLootDrop();
          if (loot) lootToSpawn.push({ id: target.id, item: loot });
          playSound('./assets/sfx/combat/death.wav', 0.7);
        }
      });
      setBloodParticles(prev => [...prev, ...newBlood]);

      setEnemies(newEnemies); setAnimatingPlayerId(null); 
      setTimeout(() => setAnimatingTargetIds([]), 350); 
      setHoveredPlayerId(null); setHoveredTargetIds([]);
      
      xpToSpawn.forEach(xpData => {
        const eRect = enemyRefs.current[xpData.id]?.getBoundingClientRect(); const bRect = xpBarRef.current?.getBoundingClientRect();
        if (eRect && bRect) setFlyingXps(prev => [...prev, { id: Math.random(), amount: xpData.amount, startX: eRect.left + eRect.width/2, startY: eRect.top, endX: bRect.left + bRect.width / 2, endY: bRect.top + bRect.height / 2 }]);
      });

      lootToSpawn.forEach(lootData => {
        const eRect = enemyRefs.current[lootData.id]?.getBoundingClientRect();
        const iRect = inventoryRef.current?.getBoundingClientRect();
        if (eRect && iRect) {
          setFlyingItems(prev => [...prev, {
            id: Math.random(), item: lootData.item,
            startX: eRect.left + eRect.width / 2, startY: eRect.top + eRect.height / 2,
            endX: iRect.left + iRect.width / 2, endY: iRect.top + iRect.height / 2,
          }]);
        } else {
          addItemToInventory(lootData.item);
        }
      });
      
      const allDead = newEnemies.every(e => e.isDead);
      if (allDead) { setTurnState('victory_wait'); }

      const finish = () => {
        setIsAnimating(false);
        if (allDead) {
          setCompletedNodes(prev => [...prev, currentMapNodeId]);
          setTimeout(() => {
            if (showLevelUpRef.current) {
              // level-up dialog is open — defer transition until player picks a card
              pendingTransitionRef.current = currentStage === 5 ? 'victory' : 'map';
            } else {
              if (currentStage === 5) { playSound('./assets/sfx/game/victory.wav'); setTurnState('victory'); } else { setTurnState('map'); }
            }
          }, 1500);
        }
      };

      if (!card.id.startsWith('b')) {
        const slotRect = slotRefs.current[player.id]?.getBoundingClientRect(); const discardRect = discardRef.current?.getBoundingClientRect();
        setPlayers(prev => prev.map(p => p.id === player.id ? { ...p, currentCard: null, hasActed: true } : p));
        if (slotRect && discardRect) {
          const flyId = `disc_${Date.now()}`;
          playSound('./assets/sfx/ui/card_discard.wav', 0.4);
          setFlyingCards(prev => [...prev, { id: flyId, startX: slotRect.left + slotRect.width/2, startY: slotRect.top + slotRect.height * 0.75, endX: discardRect.left + discardRect.width/2, endY: discardRect.top + discardRect.height/2, isDiscard: true }]);
          setTimeout(() => { setFlyingCards(prev => prev.filter(f => f.id !== flyId)); setDiscardPile(prev => [...prev, card]); finish(); }, 850);
        } else { setDiscardPile(prev => [...prev, card]); finish(); }
      } else { setPlayers(prev => prev.map(p => p.id === player.id ? { ...p, currentCard: null, hasActed: true } : p)); finish(); }
    }, 300); 
  };

  const playersRef = useRef(players);
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { showLevelUpRef.current = showLevelUp; }, [showLevelUp]);

  // Слияние происходит всегда: как только в колоде (резерв+сброс+руки) есть пара —
  // сливаем, но только в стабильном состоянии (не во время анимаций/раздачи/диалогов).
  useEffect(() => {
    if (mergeQueue.length > 0 || showLevelUp || cardRewardCards.length > 0 || isAnimating) return;
    if (turnState !== 'player' && turnState !== 'map') return;
    settleMerges();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawPile, discardPile, players, turnState, mergeQueue, showLevelUp, cardRewardCards, isAnimating]);

  useEffect(() => {
    if (turnState !== 'enemy' || showLevelUp) return;
    let delay = 0; const aliveEnemies = enemies.filter(e => !e.isDead);
    aliveEnemies.forEach((enemy) => {
      setTimeout(() => {
         const alivePlayers = playersRef.current.filter(p => p.hp > 0);
         if (alivePlayers.length === 0) return;
         const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
         const dmg = Math.floor(Math.random() * 8) + 8 + (currentStage * 3);

         setAnimatingEnemyId(enemy.id); 
         setAnimatingTargetIds([target.id]); 
         setIsAnimating(true);

         const eRect = enemyRefs.current[enemy.id]?.getBoundingClientRect();
         const pRect = avatarRefs.current[target.id]?.getBoundingClientRect();
         if (eRect && pRect) {
            setVfxList([{ id: Math.random(), type: 'enemy', delay: 0, startX: eRect.left + eRect.width/2, startY: eRect.top + eRect.height/2, endX: pRect.left + pRect.width/2, endY: pRect.top + pRect.height/2 }]);
         }

         setTimeout(() => {
            setVfxList([]);
            playSound('./assets/sfx/combat/enemy_attack.wav');
            triggerImpact(dmg);
            
            setFlashingTargets(prev => [...prev, target.id]);
            setTimeout(() => setFlashingTargets(prev => prev.filter(id => id !== target.id)), 250);

            if (pRect) {
               setDamagePopups(dp => [...dp, { id: Math.random(), value: dmg, x: pRect.left + pRect.width / 2, y: pRect.top + pRect.height / 2 }]);
               const newBlood = [];
               for(let i=0; i<30; i++) {
                  newBlood.push({ id: Math.random(), x: pRect.left + pRect.width/2, y: pRect.top + pRect.height/2 });
               }
               setBloodParticles(prev => [...prev, ...newBlood]);
            }

            setPlayers(currentPs => currentPs.map(p => {
               if (p.id === target.id) {
                  const newHp = Math.max(0, p.hp - dmg);
                  if (newHp === 0 && p.currentCard && !p.currentCard.id.startsWith('b')) {
                     setDiscardPile(dp => [...dp, p.currentCard]);
                  }
                  return { ...p, hp: newHp, currentCard: null };
               }
               return p;
            }));

            setAnimatingEnemyId(null);
            setTimeout(() => setAnimatingTargetIds([]), 350);
            setIsAnimating(false);
         }, 300);
      }, delay); 
      delay += 800; 
    });
    
    setTimeout(() => { 
        if (playersRef.current.every(p => p.hp <= 0)) {
            playSound('./assets/sfx/game/gameover.wav');
            setTurnState('gameover');
        } else {
            setTurnState(ts => ts === 'enemy' ? 'dealing' : ts);
        }
    }, delay + 1000);
  }, [turnState, showLevelUp, currentStage, enemies]);

  const getCardComboStatus = (pId, card) => {
    if (!card) return { isCandidate: false, willGiveBonus: false };
    const willGiveBonus = lastPlayedCost !== null && card.cost === lastPlayedCost + 1;
    let isCandidate = false;
    if (willGiveBonus) isCandidate = true;
    else if (lastPlayedCost === null) {
      const hasFollowup = players.some(otherP => otherP.id !== pId && !otherP.hasActed && otherP.currentCard?.cost === card.cost + 1);
      isCandidate = hasFollowup;
    }
    return { isCandidate, willGiveBonus };
  };

  const totalDeckSize = drawPile.length + discardPile.length + players.filter(p => p.currentCard && !p.currentCard.id.startsWith('b')).length;

  const currentNode = gameMap.find(n => n.id === currentMapNodeId);
  const currentNodeInfo = getNodeInfo(currentNode?.type);
  // Фон отражает ТОЛЬКО текущий сектор (не меняется от врага к врагу): синий -> оранжевый
  // 0 — только холодный синий; 1 — полное смешение с красным (по секторам)
  const bgIntensity = Math.min(1, Math.max(0, (sector - 1) / 4));

  const mapLinks = useMemo(() => {
    const links = [];
    gameMap.forEach(n => n.colors = []);
    const stage1 = gameMap.filter(n => n.stage === 1);
    stage1.forEach((n, i) => { n.colors.push(LINE_COLORS[i % LINE_COLORS.length]); });

    for (let i = 0; i <= 5; i++) {
      const currLayer = gameMap.filter(n => n.stage === i);
      const nextLayer = gameMap.filter(n => n.stage === i + 1);
      const stageLinks = [];
      
      currLayer.forEach(node => {
        node.next.forEach(tId => {
          const target = nextLayer.find(n => n.id === tId);
          if (target) {
            let linkColor = node.colors.length > 0 ? node.colors[0] : '#ffffff';
            if (node.type === 'base') { linkColor = target.colors.length > 0 ? target.colors[0] : LINE_COLORS[0]; }
            stageLinks.push({ source: node, target, color: linkColor });
            if (target.type !== 'base' && !target.colors.includes(linkColor)) { target.colors.push(linkColor); }
          }
        });
      });

      stageLinks.sort((a, b) => (a.source.y - b.source.y) || (a.target.y - b.target.y));
      stageLinks.forEach((link, idx) => {
        const fraction = stageLinks.length > 1 ? idx / (stageLinks.length - 1) : 0.5;
        link.midX = link.source.x + (link.target.x - link.source.x) * (0.35 + 0.3 * fraction); 
      });

      currLayer.forEach(node => {
        const outgoing = stageLinks.filter(l => l.source.id === node.id).sort((a, b) => a.target.y - b.target.y);
        outgoing.forEach((link, idx) => {
          const f = outgoing.length > 1 ? (idx / (outgoing.length - 1)) - 0.5 : 0; link.y1Offset = f * 3; 
        });
      });

      nextLayer.forEach(node => {
        const incoming = stageLinks.filter(l => l.target.id === node.id).sort((a, b) => a.source.y - b.source.y);
        incoming.forEach((link, idx) => {
          const f = incoming.length > 1 ? (idx / (incoming.length - 1)) - 0.5 : 0; link.y2Offset = f * 3;
        });
      });

      links.push(...stageLinks);
    }

    const baseNode = gameMap.find(n => n.type === 'base');
    if (baseNode) { baseNode.colors = stage1.map(n => n.colors[0]); }
    return links;
  }, [gameMap]);

  return (
    <div
      className={`${isFullscreen ? 'fixed inset-0 z-[9999]' : 'h-screen relative'} w-full bg-transparent text-slate-200 flex flex-col items-center font-sans select-none transition-all duration-300 overflow-hidden`}
    >
      {!appReady && (
        <Preloader
          assets={PRELOAD_ASSETS}
          onEnter={handleEnterGame}
        />
      )}

      {appReady && !mediaBytes.done && (
        <div className="fixed bottom-4 left-4 z-[9500] bg-slate-900/90 border border-slate-700 rounded-xl px-3 py-2 backdrop-blur-sm shadow-lg flex items-center gap-2.5 animate-in fade-in duration-300">
          <div className="w-4 h-4 border-2 border-slate-700 border-t-amber-500 rounded-full animate-spin shrink-0" />
          <div className="flex flex-col gap-1 min-w-[120px]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[8px] uppercase font-black tracking-widest text-amber-500">Загрузка медиа</span>
              <span className="text-[8px] font-mono text-slate-400">
                {(mediaBytes.loaded / 1048576).toFixed(1)} / {(Math.max(mediaBytes.total, mediaBytes.loaded) / 1048576).toFixed(1)} МБ
              </span>
            </div>
            <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 transition-all duration-200" style={{ width: `${mediaBytes.total ? Math.min(100, Math.round((mediaBytes.loaded / mediaBytes.total) * 100)) : 0}%` }} />
            </div>
          </div>
        </div>
      )}
      <ShaderBackground intensity={bgIntensity} />
      <ImageBackground imageUrl={bgLocation} />

      {/* Декоративные уголки сцены боя: слой над фоном, но под HUD; не пересекают верхний прогрессбар */}
      <img src="./corner.png" alt="" aria-hidden="true" className="pointer-events-none select-none absolute top-[24px] left-0 w-[325px] h-[325px] z-[0] opacity-90 drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]" />
      <img src="./corner.png" alt="" aria-hidden="true" className="pointer-events-none select-none absolute top-[24px] right-0 w-[325px] h-[325px] z-[0] opacity-90 drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]" style={{ transform: 'scaleX(-1)' }} />
      <img src="./corner.png" alt="" aria-hidden="true" className="pointer-events-none select-none absolute bottom-0 left-0 w-[325px] h-[325px] z-[0] opacity-90 drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]" style={{ transform: 'scaleY(-1)' }} />
      <img src="./corner.png" alt="" aria-hidden="true" className="pointer-events-none select-none absolute bottom-0 right-0 w-[325px] h-[325px] z-[0] opacity-90 drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]" style={{ transform: 'scale(-1, -1)' }} />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 12px; width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(15, 23, 42, 0.5); border-radius: 10px; margin: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(51, 65, 85, 0.8); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(71, 85, 105, 1); }
        
        @keyframes speechWobble {
          0%, 100% { transform: rotate(-2.5deg); }
          50% { transform: rotate(2.5deg); }
        }
      `}</style>
      <div 
        ref={appRef} 
        className="w-full h-full flex flex-col items-center relative overflow-y-auto overflow-x-hidden custom-scrollbar" 
        style={{ transform: `translate(${shake.x * 0.5}px, ${shake.y * 0.5}px)` }}
      >
      
      {flash && <div className="absolute inset-0 z-[1000] bg-white opacity-20 pointer-events-none transition-opacity duration-100"></div>}
      
      {fullscreenError && (
        <div className="absolute top-20 right-4 z-[9999] bg-[#E33371]/90 text-white px-4 py-2 rounded-xl border border-[#F2C94C] shadow-xl backdrop-blur-md animate-in fade-in duration-300 text-lg">
          Полноэкранный режим заблокирован в текущей среде.
        </div>
      )}

      <audio ref={audioRef} loop preload="auto" />

      {/* Музыка + SFX + полноэкран */}
      <div className="absolute top-4 right-[52px] z-[9000] flex items-center gap-3 bg-slate-900/80 border border-slate-700 rounded-xl px-3 py-2 backdrop-blur-sm shadow-lg">
        {/* Кнопка вкл/выкл музыки */}
        <button onClick={toggleMusic} className="text-slate-400 hover:text-white transition-colors flex items-center" title={musicOn ? "Выключить музыку" : "Включить музыку"}>
          {musicOn ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M9 3v10.55A4 4 0 1 0 11 17V7h4V3z"/></svg>
          ) : (
            <svg className="w-5 h-5 opacity-40" fill="currentColor" viewBox="0 0 24 24"><path d="M9 3v10.55A4 4 0 1 0 11 17V7h4V3z"/><line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="2"/></svg>
          )}
        </button>
        {/* Громкость музыки */}
        <input type="range" min="0" max="1" step="0.05" value={musicVolume}
          onChange={e => setMusicVolume(parseFloat(e.target.value))}
          className="w-14 h-1 accent-purple-400 cursor-pointer" title="Громкость музыки" />
        <div className="w-px h-4 bg-slate-600" />
        {/* Громкость SFX */}
        <span className="text-slate-400 text-sm select-none">{sfxVolume === 0 ? '🔇' : sfxVolume < 0.5 ? '🔉' : '🔊'}</span>
        <input type="range" min="0" max="1" step="0.05" value={sfxVolume}
          onChange={e => setSfxVolume(parseFloat(e.target.value))}
          className="w-14 h-1 accent-[#1E88E5] cursor-pointer" title="Громкость SFX" />
      </div>

      <button onClick={toggleFullscreen} className="absolute top-4 right-4 z-[9100] bg-slate-900/80 border border-slate-700 text-slate-400 hover:text-white hover:border-[#1E88E5] p-2 rounded-xl backdrop-blur-sm transition-all shadow-lg flex items-center justify-center group" title={isFullscreen ? "Выйти из полноэкранного режима" : "Развернуть игру на всё окно"}>
        {isFullscreen ? (
          <svg className="w-5 h-5 group-hover:scale-110 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></svg>
        ) : (
          <svg className="w-5 h-5 group-hover:scale-110 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
        )}
      </button>

      <div className="w-full h-6 shrink-0 bg-slate-900 border-b border-amber-600/30 relative shadow-2xl z-[150] flex items-center" ref={xpBarRef}>
        <div className="h-full bg-gradient-to-r from-yellow-700 via-amber-500 to-yellow-300 transition-all duration-1000 ease-out shadow-xl" style={{ width: `${(xp / xpToNext) * 100}%` }}></div>
        <div className="absolute inset-0 flex items-center justify-center"><div className="text-[10px] font-black tracking-[0.2em] text-white drop-shadow-md uppercase">ПРОГРЕСС ОТРЯДА: {String(xp)} / {String(xpToNext)} XP (LVL {String(playerLevel)})</div></div>
      </div>

      {vfxList.map(v => <CombatVfx key={v.id} vfx={v} />)}
      {flyingCards.map(fc => <FlyingCard key={fc.id} {...fc} />)}
      {flyingXps.map(fx => <FlyingXp key={fx.id} {...fx} onComplete={handleXpGained} />)}
      {flyingItems.map(fi => <FlyingItem key={fi.id} {...fi} onComplete={handleItemLanded} />)}
      {itemTooltip && <ItemTooltip item={itemTooltip.item} x={itemTooltip.x} y={itemTooltip.y} />}
      {damagePopups.map(dp => (<DamagePopup key={dp.id} {...dp} onComplete={(id) => setDamagePopups(p => p.filter(x => x.id !== id))} />))}
      {bloodParticles.map(bp => <BloodParticle key={bp.id} {...bp} onComplete={(id) => setBloodParticles(p => p.filter(x => x.id !== id))} />)}

      {/* --- ИНТЕРФЕЙС БОЯ (ВСЕГДА РЕНДЕРИТСЯ НА ФОНЕ) --- */}
      <div className="flex w-full max-w-5xl justify-center relative z-0 p-1 py-4 my-auto">
        <div className="flex-1 flex flex-col justify-start w-full relative">
          <div className="bg-slate-950/60 py-10 px-16 rounded-[40px] border border-slate-800/60 shadow-[0_0_30px_rgba(0,0,0,0.5)] flex justify-between items-center relative h-[355px] overflow-visible backdrop-blur-md">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 flex flex-col items-center">
               <div className="bg-slate-700 text-white px-6 py-1 rounded-full font-black text-sm shadow-[0_0_20px_rgba(0,0,0,0.5)] border-2 border-slate-500 uppercase italic tracking-tighter flex items-center gap-2"><span className="not-italic">{currentNodeInfo.icon}</span>{currentNodeInfo.label}</div>
               <div className="w-[120px] h-[2px] bg-gradient-to-r from-transparent via-slate-500/50 to-transparent mt-2"></div>
            </div>
            <div className="relative w-1/2 z-20 h-full overflow-visible">
              {players.map((player, pIdx) => {
                const isHovered = hoveredPlayerId === player.id; const isAttacking = animatingPlayerId === player.id; const isBeingAttacked = animatingTargetIds.includes(player.id);
                
                let avatarTransform = '';
                let transitionClass = 'transition-all duration-300 ease-out';
                if (isAttacking) {
                   if (player.id === 'p1') avatarTransform = 'translate(250px, 0) scale(1.25)'; 
                   else avatarTransform = 'scale(1.25)'; 
                }
                else if (isHovered && !isAnimating) avatarTransform = 'translate(16px, 0)';
                else if (isBeingAttacked && shake.x !== 0) {
                   avatarTransform = `translate(${shake.x * 0.5}px, ${shake.y * 0.5}px) rotate(${shake.rot * 0.5}deg) scale(1.1)`;
                   transitionClass = 'transition-none'; 
                }
                else if (isBeingAttacked) avatarTransform = 'scale(1.1)';

                const pos = CHAR_FORMATION[player.id] || { left: 0, top: pIdx * 110 };
                return (
                  <div key={`field-${player.id}`} ref={el => setAvatarRef(player.id, el)} className={`absolute flex items-center ${transitionClass} ${player.hp <= 0 ? 'opacity-30 grayscale scale-75' : ''} ${isAttacking ? 'z-50 drop-shadow-[0_0_40px_rgba(59,130,246,1)]' : ''} ${isBeingAttacked && shake.x === 0 ? 'brightness-150 animate-pulse' : ''}`} style={{ transform: avatarTransform, left: pos.left, top: pos.top }}>
                    <div className={`relative ${CHAR_ATLASES[player.id] ? '' : 'text-6xl'} ${isHovered && !isAnimating ? 'drop-shadow-[0_0_25px_rgba(59,130,246,0.4)]' : ''} ${flashingTargets.includes(player.id) ? 'brightness-0 invert drop-shadow-[0_0_40px_white] scale-150 -translate-y-4 z-[2000]' : ''}`} style={{ transition: 'all 0.15s ease-out' }}>{CHAR_ATLASES[player.id] ? <CharSprite atlas={CHAR_ATLASES[player.id]} size={CHAR_SPRITE_SIZE} /> : String(player.icon)}{isBeingAttacked && <div className="absolute inset-0 flex items-center justify-center text-red-500 text-6xl animate-bounce pointer-events-none z-50">💥</div>}</div>
                  </div>
                );
              })}
            </div>
            <div className="absolute left-1/2 top-16 bottom-16 w-px bg-gradient-to-b from-transparent via-slate-700 to-transparent opacity-50"></div>
            <div className="flex flex-col gap-14 w-1/3 relative z-10">
              {enemies.map((enemy) => {
                const isHoveredTarget = hoveredTargetIds.includes(enemy.id); 
                const isBeingAttacked = animatingTargetIds.includes(enemy.id); 
                const isAttacking = animatingEnemyId === enemy.id;
                
                // Проверяем, говорит ли сейчас этот враг
                const isSpeaking = speakingEnemy && speakingEnemy.id === enemy.id && !enemy.isDead;
                
                let enemyTransform = '';
                let transitionClass = 'transition-all duration-300 ease-out';
                if (isAttacking) enemyTransform = 'translate(-250px, 0) scale(1.25)';
                else if (isHoveredTarget && !isAnimating) enemyTransform = 'translate(-16px, 0)';
                else if (isBeingAttacked && shake.x !== 0) {
                   enemyTransform = `translate(${shake.x * 0.5}px, ${shake.y * 0.5}px) rotate(${shake.rot * 0.5}deg) scale(1.1)`;
                   transitionClass = 'transition-none'; 
                }
                else if (isBeingAttacked) enemyTransform = 'scale(1.1)';

                return (
                  <div key={String(enemy.id)} ref={(el) => setEnemyRef(enemy.id, el)} className={`flex items-center justify-end gap-6 ${transitionClass} ${enemy.isDead ? 'opacity-20 grayscale scale-75' : ''} ${isAttacking ? 'z-50 drop-shadow-[0_0_40px_rgba(239,68,68,1)]' : ''} ${isBeingAttacked && shake.x === 0 ? 'brightness-150 animate-pulse' : ''}`} style={{ transform: enemyTransform }}>
                    <div className={`flex flex-col items-end transition-opacity duration-300 ${(isAttacking || isBeingAttacked) ? 'opacity-0' : 'opacity-100'}`}><span className={`font-black transition-colors ${isHoveredTarget || isBeingAttacked ? 'text-white' : 'text-red-500'} text-xl uppercase tracking-tighter`}>{String(enemy.name)}</span>{!enemy.isDead && <span className="text-xs font-mono text-red-400 font-bold drop-shadow-sm">{String(enemy.hp)} HP</span>}</div>
                    
                    {/* Контейнер для баббла речи и иконки */}
                    <div className="relative flex items-center justify-center">
                       {isSpeaking && (
                         <div className="absolute bottom-full right-[70%] mb-2 w-max max-w-[160px] bg-white text-red-900 text-[11px] font-black px-4 py-2 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] z-[100] animate-in fade-in zoom-in-75 duration-300 leading-tight uppercase border-[3px] border-red-500 pointer-events-none">
                            {speakingEnemy.text}
                            {/* Хвостик для баббла, указывающий на врага */}
                            <div className="absolute -bottom-[7px] right-6 w-3 h-3 bg-white border-b-[3px] border-r-[3px] border-red-500 transform rotate-45"></div>
                         </div>
                       )}
                       <div 
                         className={`text-6xl relative ${isHoveredTarget || isBeingAttacked ? 'drop-shadow-[0_0_25px_rgba(239,68,68,0.4)]' : ''} ${flashingTargets.includes(enemy.id) ? 'brightness-0 invert drop-shadow-[0_0_40px_white] scale-150 -translate-y-4 z-[2000]' : ''}`}
                         style={{ animation: isSpeaking && !isBeingAttacked && !isAttacking ? 'speechWobble 0.4s ease-in-out infinite' : 'none', transition: 'all 0.15s ease-out' }}
                       >
                         {String(enemy.icon)}
                         {isHoveredTarget && !isAnimating && <div className="absolute -inset-2 border-2 border-red-500 rounded-full animate-ping opacity-40"></div>}
                         {isBeingAttacked && <div className="absolute inset-0 flex items-center justify-center text-red-500 text-6xl animate-bounce pointer-events-none z-50">💥</div>}
                       </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-between items-end w-full gap-4 relative z-10 mt-[5px]">
            <div className="flex flex-col justify-end gap-4 items-center mb-[19px] w-32 relative -translate-y-[60px]">
              <div className="flex flex-col items-center w-full">
                <div className="text-[#1E88E5] font-black uppercase tracking-widest text-[8px] mb-1">Энергия</div>
                <div className="w-24 h-24 rounded-full bg-slate-900 border-[6px] border-[#1E88E5] shadow-[0_0_25px_rgba(30,136,229,0.5)] flex items-center justify-center relative overflow-hidden">
                   <div className="absolute bottom-0 left-0 right-0 bg-[#1E88E5]/50 transition-all duration-700" style={{ height: `${(mana/maxMana)*100}%` }}></div>
                   <span className="text-5xl font-black text-white z-10 drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">{String(mana)}</span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <div ref={deckRef} onClick={() => turnState !== 'map' && setShowReserve(true)} className={`w-20 h-28 bg-slate-800 rounded-xl border-2 border-[#1E88E5]/40 flex flex-col items-center justify-center font-black shadow-[0_0_15px_rgba(30,136,229,0.3)] transition-all ${turnState !== 'map' ? 'hover:scale-105 hover:border-[#1E88E5] cursor-help' : 'opacity-50 grayscale'} ${turnState === 'dealing' ? 'border-[#1E88E5] animate-pulse' : ''}`}>
                   <span className="text-slate-300 drop-shadow-md text-3xl">{String(drawPile.length)}<span className="text-[#1E88E5] text-lg">/{String(totalDeckSize)}</span></span>
                   <span className="text-[9px] uppercase font-black tracking-widest text-[#1E88E5] mt-2">Резерв</span>
                </div>
                <button onClick={openAllCardsView} className="text-[8px] uppercase font-black tracking-widest text-slate-300 bg-slate-800/80 border border-slate-600 rounded-md px-2 py-1 hover:border-[#1E88E5] hover:text-white transition-all">Все карты</button>
              </div>
            </div>

            <div className="flex justify-center gap-3 flex-1 translate-y-[10px]">
              {players.map((p, i) => {
                const card = p.currentCard; const isDead = p.hp <= 0; const isDisabled = turnState !== 'player' || mana < (card?.cost || 0) || isDead || p.hasActed || isAnimating || showLevelUp || turnState === 'map' || turnState === 'victory_wait'; const comboStatus = getCardComboStatus(p.id, card);
                const eff = getEffectivePlayer(p, equipped[p.id]);
                const eqItem = equipped[p.id];
                const renderStat = (base, effective, color) => effective > base
                  ? <span className={`text-xs font-bold ${color}`}>{String(effective)}<span className="text-[8px] text-green-400 ml-0.5">+{effective - base}</span></span>
                  : <span className={`text-xs font-bold ${color}`}>{String(base)}</span>;
                return (
                  <div key={p.id} className="flex flex-col items-center">
                  <TiltWrapper isDisabled={isDisabled} globalShake={shake} className="w-52 h-[290px] relative z-10">
                    <div ref={(el) => setSlotRef(p.id, el)} onClick={() => !isDisabled && card && playCard(i, card)} onMouseEnter={() => handleCardHover(i)} onMouseLeave={() => { setHoveredPlayerId(null); setHoveredTargetIds([]); }} className={`w-full h-full bg-slate-800 border-2 rounded-2xl flex flex-col overflow-hidden relative group ${isDead ? 'border-slate-700 opacity-40 grayscale scale-95' : 'border-slate-600 shadow-2xl shadow-black/80'} ${!isDisabled ? 'cursor-pointer hover:border-[#1E88E5]' : ''}`}>
                      <div className={`${p.bg} py-1.5 px-3 border-b border-white/10 flex justify-between items-center`}><span className="text-sm">{String(p.icon)}</span><span className="font-black uppercase tracking-tighter text-[10px] text-white">{String(p.name)}</span><span className="text-[8px] font-mono text-red-400">{String(p.hp)}/{String(eff.maxHp)} HP</span></div>
                      <div className="p-1.5 bg-slate-900/50 flex flex-col gap-1.5"><div className="h-1.5 bg-slate-950 rounded-full overflow-hidden shadow-inner"><div className="h-full bg-[#D32F2F] transition-all duration-500" style={{ width: `${(p.hp/eff.maxHp)*100}%` }}></div></div><div className="flex justify-between border-t border-white/5 pt-1 px-1"><div className="flex flex-col items-center w-1/3"><span className="text-[7px] text-slate-500 font-bold uppercase">Сил</span>{renderStat(p.str, eff.str, 'text-red-400')}</div><div className="flex flex-col items-center border-l border-r border-slate-800 px-2"><span className="text-[7px] text-slate-500 font-bold uppercase">Лов</span>{renderStat(p.agi, eff.agi, 'text-green-400')}</div><div className="flex flex-col items-center w-1/3"><span className="text-[7px] text-slate-500 font-bold uppercase">Инт</span>{renderStat(p.int, eff.int, 'text-blue-400')}</div></div></div>
                      <div className="p-1.5 bg-slate-950 relative flex flex-col items-center justify-center flex-1 min-h-[190px]">
                        {isDead ? <span className="text-[9px] uppercase text-slate-600 font-black tracking-widest">Павший</span> : !card && p.hasActed ? (
                          <div className="flex flex-col items-center opacity-30 animate-pulse"><span className="text-4xl text-[#1E88E5]">⏳</span><span className="text-[8px] uppercase font-black mt-2 tracking-widest text-center leading-tight text-white">Ход завершен</span></div>
                        ) : card ? (
                          <AbilityCard card={card} owner={eff} mana={mana} maxMana={maxMana} isDisabled={isDisabled} comboState={comboStatus} />
                        ) : <div className="w-full h-full border-2 border-dashed border-slate-800 rounded-xl flex items-center justify-center text-[#1E88E5]/40 font-black italic">...</div>}
                      </div>
                    </div>
                  </TiltWrapper>
                  {!isDead && (
                    <ItemSlot
                      item={eqItem}
                      size="sm"
                      equip
                      isDragOver={dragOverPlayerId === p.id}
                      onDragOver={handleEquipDragOver(p.id)}
                      onDragLeave={handleEquipDragLeave}
                      onDrop={handleEquipDrop(p.id)}
                      onClick={() => handleUnequip(p.id)}
                      onMouseEnter={(e) => showItemTip(eqItem, e)}
                      onMouseLeave={hideItemTip}
                      emptyLabel="⬇"
                    />
                  )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col justify-end gap-6 items-center mb-[19px] w-32 -translate-y-[60px]">
              <button onClick={() => { playSound('./assets/sfx/game/enemy_turn.wav', 0.6); setTurnState('enemy'); }} disabled={turnState !== 'player' || isAnimating || showLevelUp || turnState === 'map' || turnState === 'victory_wait'} className="w-full py-4 bg-[#D32F2F] hover:bg-red-700 disabled:opacity-50 disabled:bg-red-900 disabled:cursor-not-allowed rounded-2xl font-black uppercase tracking-widest text-[9px] transition-all shadow-[0_0_20px_rgba(211,47,47,0.4)] border border-red-500 hover:scale-105 active:scale-95 text-white">{turnState === 'dealing' ? 'ЖДИТЕ' : turnState === 'player' ? 'ЗАВЕРШИТЬ' : 'ВРАГ...'}</button>
              <div className="flex flex-col items-center">
                <div ref={discardRef} className="w-20 h-28 bg-slate-900/60 rounded-xl border-2 border-slate-700 border-dashed flex items-center justify-center font-black text-3xl opacity-60 transition-all hover:opacity-100 shadow-inner overflow-hidden">
                   <span className="text-[#D32F2F] drop-shadow-md">{String(discardPile.length)}</span>
                   <span className="text-[9px] uppercase font-black tracking-widest text-[#D32F2F] mt-2">Сброс</span>
                </div>
              </div>
            </div>
          </div>

          {/* Инвентарь — горизонтальная полоса под карточками + кнопка крафта справа */}
          <div ref={inventoryRef} className="relative flex items-center justify-center gap-1.5 rounded-2xl px-[55px] py-3 w-fit mx-auto" style={{ marginTop: '33px', background: 'linear-gradient(to right, rgba(15,23,42,0) 0%, rgba(15,23,42,0.6) 50%, rgba(15,23,42,0) 100%)' }}>
            {inventory.map((item, idx) => (
              <ItemSlot
                key={idx}
                item={item}
                selected={dragSrcIdx === idx}
                draggable={true}
                onDragStart={handleInvDragStart(idx)}
                onMouseEnter={(e) => showItemTip(item, e)}
                onMouseLeave={hideItemTip}
              />
            ))}
            <button onClick={openCraft} title="Крафт" className="w-[52px] h-[52px] ml-2 rounded-lg bg-gradient-to-b from-amber-500 to-amber-700 border-2 border-amber-400/60 text-white font-black uppercase tracking-tight text-[9px] leading-none shadow-[0_0_12px_rgba(245,158,11,0.45)] hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center gap-0.5">
              <span className="text-base">⚒</span>
              Крафт
            </button>
          </div>
        </div>
      </div>

      {/* --- КРАФТ: затемнение + слоты по центру (инвентарь остаётся внизу) --- */}
      {showCraft && (
        <div className="fixed inset-0 z-[6000] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300" onClick={closeCraft}>
          <div className="relative flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button onClick={closeCraft} className="absolute -top-12 -right-12 w-10 h-10 rounded-full bg-slate-800 border border-slate-600 text-slate-300 hover:text-white hover:border-red-500 hover:bg-red-900/40 transition-all flex items-center justify-center font-black text-lg">✕</button>

            <p className="text-slate-300 text-[11px] uppercase tracking-[0.3em] text-center mb-6 font-black drop-shadow-md">Перетащите 3 предмета одной редкости из инвентаря</p>

            {/* Слоты крафта (drop-таргеты) */}
            <div className="flex items-center justify-center gap-5 mb-7">
              {craftSlots.map((slot, i) => (
                <React.Fragment key={i}>
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleCraftDrop(i)}
                    onClick={() => slot && removeFromCraft(i)}
                    onMouseEnter={(e) => showItemTip(slot, e)}
                    onMouseLeave={hideItemTip}
                    className={`w-24 h-24 rounded-2xl border-2 flex items-center justify-center overflow-hidden transition-all ${slot ? `${(RARITIES[slot.rarity] || RARITIES.COMMON).border} bg-slate-950 cursor-pointer hover:brightness-125` : 'border-slate-500 border-dashed bg-slate-950/60 hover:border-amber-400'}`}>
                    {slot ? (
                      <ItemIcon item={slot} className="w-full h-full" />
                    ) : (
                      <span className="text-slate-600 text-4xl font-black">+</span>
                    )}
                  </div>
                  {i < 2 && <span className="text-amber-500 text-3xl font-black drop-shadow-md">+</span>}
                </React.Fragment>
              ))}
            </div>

            {/* Кнопка слияния + предупреждение */}
            <button onClick={doCraft} className="px-14 py-3 rounded-full bg-gradient-to-b from-amber-500 to-amber-700 border border-amber-400/60 text-white font-black uppercase tracking-widest text-sm shadow-[0_0_20px_rgba(245,158,11,0.5)] hover:scale-105 active:scale-95 transition-all">
              Слияние
            </button>
            <div className="h-5 mt-2">
              {craftWarning && (
                <p className="text-red-400 text-[11px] font-bold uppercase tracking-wide animate-in fade-in duration-200">{craftWarning}</p>
              )}
            </div>
          </div>

          {/* Инвентарь внутри оверлея — источник предметов для перетаскивания */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center justify-center gap-1.5 rounded-2xl px-8 py-3 bg-slate-900/80 border border-slate-700/70 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <span className="text-[8px] uppercase font-black tracking-widest text-amber-500 mr-2 whitespace-nowrap">Инвентарь</span>
            {inventory.map((item, idx) => (
              <ItemSlot
                key={`craft-inv-${idx}`}
                item={item}
                selected={dragSrcIdx === idx}
                draggable={true}
                onDragStart={handleInvDragStart(idx)}
                onMouseEnter={(e) => showItemTip(item, e)}
                onMouseLeave={hideItemTip}
              />
            ))}
          </div>
        </div>
      )}

      {/* --- ИНТЕРФЕЙС КАРТЫ СЕКТОРА --- */}
      {turnState === 'map' && (
        <div className="absolute inset-0 z-[1200] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
          <h1 className="text-7xl font-black text-amber-500 uppercase italic tracking-widest mb-8 text-center drop-shadow-2xl">Карта сектора {String(sector)}</h1>
          <div className="relative w-full max-w-4xl h-[500px] bg-slate-900/90 rounded-[40px] border border-slate-700 shadow-2xl overflow-hidden">
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
              {mapLinks.map(link => {
                const isLinkActive = (completedNodes.includes(link.source.id) || currentMapNodeId === link.source.id) && (completedNodes.includes(link.target.id) || isNodeClickable(link.target));
                if (isLinkActive) return null;
                return (
                  <path key={`inact-${link.source.id}-${link.target.id}`} d={getSubwayPath(link)} fill="none" stroke={link.color} strokeWidth={3} opacity={0.3} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeDasharray="4, 4" className="transition-all duration-500" />
                )
              })}
              {mapLinks.map(link => {
                const isLinkActive = (completedNodes.includes(link.source.id) || currentMapNodeId === link.source.id) && (completedNodes.includes(link.target.id) || isNodeClickable(link.target));
                if (!isLinkActive) return null;
                return (
                  <path key={`act-${link.source.id}-${link.target.id}`} d={getSubwayPath(link)} fill="none" stroke={link.color} strokeWidth={6} vectorEffect="non-scaling-stroke" strokeLinecap="round" className="transition-all duration-500" />
                )
              })}
            </svg>
            
            {gameMap.map(node => {
               const isCompleted = completedNodes.includes(node.id);
               const isCurrent = currentMapNodeId === node.id;
               const isClickable = isNodeClickable(node);
               let innerBg = '#0B0515';
               let icon = '🗡️';
               let sizeClasses = 'w-12 h-12 border-[6px] -ml-6 -mt-6 text-2xl'; 
               
               if (node.type === 'base') { innerBg = '#ffffff'; icon = '🏰'; sizeClasses = 'w-16 h-16 border-[6px] -ml-8 -mt-8 text-4xl'; } 
               else if (node.type === 'boss') { innerBg = '#ffffff'; icon = '🐲'; sizeClasses = 'w-16 h-16 border-[6px] -ml-8 -mt-8 text-4xl'; } 
               else if (node.type === 'combat_hard') { icon = '☠️'; } 
               else if (node.type === 'combat_medium') { icon = '⚔️'; } 
               else if (node.type === 'event') { innerBg = '#1E1035'; icon = '✨'; }

               const nodeColorStyle = getConicGradient(node.colors, innerBg);
               
               return (
                 <div 
                    key={node.id} 
                    onClick={() => isClickable && handleNodeClick(node)} 
                    className={`absolute flex items-center justify-center rounded-full shadow-xl transition-all duration-300 ${sizeClasses} ${isCompleted && node.type !== 'base' ? 'grayscale opacity-60' : isCurrent ? 'scale-125 drop-shadow-[0_0_20px_rgba(255,255,255,0.4)] z-20' : isClickable ? 'hover:scale-125 cursor-pointer animate-pulse z-10' : 'opacity-50' }`} 
                    style={{ left: `${node.x}%`, top: `${node.y}%`, ...nodeColorStyle }}
                 >
                    {icon}
                    {isClickable && <div className="absolute -inset-2 border-[3px] rounded-full animate-ping opacity-40" style={{ borderColor: node.colors[0] || '#1E88E5' }}></div>}
                 </div>
               );
            })}
          </div>
          
          <div className="flex justify-between items-center w-full max-w-4xl mt-6 px-4">
            <div className="flex gap-5 items-center text-[9px] font-bold uppercase tracking-widest text-slate-400 bg-slate-900/80 px-6 py-3 rounded-2xl border border-slate-700/50 shadow-inner">
              <span className="flex items-center gap-1.5"><span className="text-base drop-shadow-md">🏰</span> База</span>
              <span className="flex items-center gap-1.5"><span className="text-base drop-shadow-md">🗡️</span> Легкий</span>
              <span className="flex items-center gap-1.5"><span className="text-base drop-shadow-md">⚔️</span> Средний</span>
              <span className="flex items-center gap-1.5"><span className="text-base drop-shadow-md">☠️</span> Сложный</span>
              <span className="flex items-center gap-1.5"><span className="text-base drop-shadow-md">✨</span> Событие</span>
              <span className="flex items-center gap-1.5"><span className="text-base drop-shadow-md">🐲</span> Босс</span>
            </div>
            <p className="text-slate-300 font-black text-sm tracking-widest uppercase text-right drop-shadow-md">Выберите следующий этап пути</p>
          </div>
        </div>
      )}

      {/* --- МОДАЛЬНОЕ ОКНО СОБЫТИЯ --- */}
      {turnState === 'event' && currentEvent && (
        <div className="absolute inset-0 z-[3000] bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
           <div className="w-full max-w-4xl bg-slate-900 border-2 border-indigo-500/30 rounded-[32px] p-10 shadow-[0_0_80px_rgba(99,102,241,0.15)] flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute -top-20 -right-20 text-[200px] opacity-10 pointer-events-none">✨</div>
              
              <h2 className="text-5xl font-black text-amber-500 uppercase tracking-widest mb-6 drop-shadow-md">
                 {currentEvent.narrative.title}
              </h2>
              <p className="text-xl text-slate-300 mb-12 leading-relaxed max-w-2xl">
                 {currentEvent.narrative.text}
              </p>

              <div className="flex justify-center gap-6 w-full">
                 {currentEvent.options.map(opt => (
                    <div 
                       key={opt.id} 
                       onClick={() => handleEventChoice(opt.id)}
                       className="flex-1 bg-slate-800 border border-slate-600 hover:border-indigo-400 rounded-2xl p-6 cursor-pointer hover:-translate-y-2 transition-all hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] group flex flex-col items-center"
                    >
                       <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">{opt.icon}</div>
                       <h3 className="text-xl font-bold text-white mb-2">{opt.title}</h3>
                       <p className="text-sm text-slate-400 leading-tight">{opt.desc}</p>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      {/* --- МОДАЛЬНЫЕ ОКНА --- */}
      {turnState === 'gameover' && (
        <div className="absolute inset-0 z-[2000] bg-red-950/80 flex flex-col items-center justify-center backdrop-blur-xl animate-in fade-in duration-700 p-6">
           <h1 className="text-8xl font-black text-white drop-shadow-[0_0_40px_rgba(239,68,68,1)] mb-4 tracking-tighter uppercase italic text-center">ОТРЯД ПАЛ</h1>
           <p className="text-2xl text-red-300 font-bold uppercase tracking-[0.5em] mb-12 text-center">Колода и статы сохранены · возврат в сектор 1</p>
           <button onClick={() => resetGame(false, false, true)} className="px-16 py-6 bg-white text-red-900 rounded-full font-black text-2xl hover:scale-110 active:scale-95 transition-all shadow-[0_0_30px_rgba(255,255,255,0.4)] uppercase tracking-tighter">Вернуться на Базу (Stage 0)</button>
        </div>
      )}

      {turnState === 'victory' && (
        <div className="absolute inset-0 z-[2000] bg-green-950/80 flex flex-col items-center justify-center backdrop-blur-xl animate-in fade-in duration-700 p-6">
           <h1 className="text-8xl font-black text-amber-400 drop-shadow-[0_0_40px_rgba(245,158,11,1)] mb-4 tracking-tighter uppercase italic text-center">СЕКТОР ЗАЧИЩЕН</h1>
           <p className="text-2xl text-green-300 font-bold uppercase tracking-[0.5em] mb-12 text-center">Босс повержен! Вы готовы к новому вызову.</p>
           <button onClick={() => setSectorSplash({ text: SECTOR_NARRATIVES[Math.floor(Math.random() * SECTOR_NARRATIVES.length)], sector: sector + 1 })} className="px-16 py-6 bg-white text-green-900 rounded-full font-black text-2xl hover:scale-110 active:scale-95 transition-all shadow-[0_0_30px_rgba(255,255,255,0.4)] uppercase tracking-tighter">Следующий Сектор</button>
        </div>
      )}

      {sectorSplash && (
        <SectorSplashScreen
          text={sectorSplash.text}
          sector={sectorSplash.sector}
          onContinue={() => { setSectorSplash(null); resetGame(false, true); }}
        />
      )}

      {showLevelUp && (
        <div className="absolute inset-0 z-[2500] bg-black/80 flex flex-col items-center justify-center backdrop-blur-md animate-in fade-in duration-500">
          <h2 className="text-6xl font-black text-amber-500 drop-shadow-2xl mb-8 uppercase italic tracking-tighter text-center">УРОВЕНЬ ПОВЫШЕН!</h2>
          <div className="relative border-2 border-indigo-500/30 rounded-2xl p-10 pt-12 pb-10 bg-slate-900/60 shadow-[0_0_80px_rgba(99,102,241,0.15)] flex flex-col items-center">
            <div className="absolute -top-3 px-4 bg-[#1e1f2e] text-slate-400 text-sm tracking-[0.3em] uppercase whitespace-nowrap">ВЫБЕРИТЕ НОВУЮ КАРТУ:</div>
            <div className="flex gap-6 items-center">
              {rewardOptions.map((card, idx) => {
                const willMerge = rewardWouldMerge(card);
                return (
                <div key={`${card.id}-${idx}`} className="relative">
                  {willMerge && (<div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 bg-amber-500 text-black text-[10px] font-black px-3 py-1 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.8)] uppercase tracking-widest animate-bounce whitespace-nowrap">⚗️ Слияние</div>)}
                  <TiltWrapper className={`w-48 h-[200px] ${willMerge ? 'drop-shadow-[0_0_25px_rgba(245,158,11,0.5)]' : ''}`}>
                    <div onClick={() => selectReward(card)} className="w-full h-full cursor-pointer hover:-translate-y-2 transition-transform duration-300">
                      <AbilityCard card={card} owner={players.find(p=>p.id===card.ownerId)} mana={maxMana} isDisabled={false} showOwnerLabel={true} comboState={{isCandidate: false, willGiveBonus: false}} />
                    </div>
                  </TiltWrapper>
                </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {mergeQueue.length > 0 && (
        <MergeAnimation
          mergeQueue={mergeQueue}
          players={players}
          maxMana={maxMana}
          onComplete={handleMergeComplete}
        />
      )}

      {cardRewardCards.length > 0 && (
        <div className="absolute inset-0 z-[2400] bg-black/80 flex flex-col items-center justify-center backdrop-blur-md animate-in fade-in duration-300 p-10">
          <h2 className="text-5xl font-black text-amber-500 uppercase italic tracking-widest mb-2 drop-shadow-2xl text-center">Получены карты</h2>
          <p className="text-slate-400 text-xs uppercase tracking-[0.3em] mb-8 text-center">Новое пополнение резерва</p>
          <div className="flex gap-6 items-end justify-center flex-wrap">
            {cardRewardCards.map((card, idx) => (
              <div key={`reward-${idx}`} className="relative">
                {card.willMerge && (<div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 bg-amber-500 text-black text-[10px] font-black px-3 py-1 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.8)] uppercase tracking-widest animate-bounce whitespace-nowrap">⚗️ Слияние</div>)}
                <TiltWrapper className={`w-48 h-[260px] ${card.willMerge ? 'drop-shadow-[0_0_25px_rgba(245,158,11,0.5)]' : ''}`}>
                  <AbilityCard card={card} owner={players.find(p=>p.id===card.ownerId)} mana={maxMana} maxMana={maxMana} isDisabled={false} showOwnerLabel={true} comboState={{isCandidate: false, willGiveBonus: false}} />
                </TiltWrapper>
              </div>
            ))}
          </div>
          <button onClick={finishCardReward} className="mt-10 px-12 py-4 bg-white text-slate-900 rounded-full font-black text-lg hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(255,255,255,0.3)] uppercase tracking-widest">Забрать</button>
        </div>
      )}

      {(showReserve || showAllCards) && (() => {
        const closeDeckView = () => { setShowReserve(false); setShowAllCards(false); setBurnConfirmId(null); };
        // Полная база карт (статичная, не зависит от текущей ротации/анимаций)
        const allCards = ownedCards;
        const list = showAllCards ? allCards : drawPile;
        return (
        <div className="absolute inset-0 z-[1100] bg-black/45 flex flex-col items-center justify-center backdrop-blur-md animate-in fade-in duration-300 p-10">
          <div className="relative w-full max-w-5xl bg-slate-900/80 border border-slate-700 rounded-[32px] flex flex-col max-h-[80vh] overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
               <div>
                 <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic text-center">{showAllCards ? 'Все карты' : 'Ваша колода'}</h2>
                 <p className="text-xs text-slate-500 uppercase tracking-widest mt-1 text-center">{showAllCards ? `Всего карт: ${String(allCards.length)} · нажмите на карту, чтобы сжечь (−1 к макс. мане)` : `Абсолютное число карт: ${String(totalDeckSize)} (в резерве: ${String(drawPile.length)})`}</p>
               </div>
               <button onClick={closeDeckView} className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-white hover:bg-red-900 hover:border-red-500 transition-all group">
                 <span className="text-2xl group-hover:scale-125 transition-transform">✕</span>
               </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
               <div className="grid grid-cols-5 gap-6">
                 {list.map((card, idx) => {
                   const isConfirming = showAllCards && burnConfirmId === card.id;
                   return (
                   <div key={`deckview-${card.id}-${idx}`} className="relative h-[280px]">
                     <div
                       onClick={() => showAllCards && setBurnConfirmId(isConfirming ? null : card.id)}
                       className={showAllCards ? 'h-full cursor-pointer' : 'h-full'}
                     >
                       <TiltWrapper className="h-full" isDisabled={true}>
                          <AbilityCard card={card} owner={players.find(p=>p.id===card.ownerId)} mana={maxMana} isDisabled={false} showOwnerLabel={true} comboState={{isCandidate: false, willGiveBonus: false}} />
                       </TiltWrapper>
                     </div>
                     {isConfirming && (
                       <div className="absolute inset-0 z-20 rounded-2xl bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center gap-2 p-3 animate-in fade-in zoom-in-95 duration-200">
                         <span className="text-5xl drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]">🔥</span>
                         <p className="text-center text-sm text-white font-black uppercase tracking-wide">Сжечь карту?</p>
                         {maxMana <= 1 ? (
                           <p className="text-center text-[10px] text-red-400 font-bold uppercase leading-tight">Нельзя:<br/>мана не может быть ниже 1</p>
                         ) : (
                           <>
                             <p className="text-center text-[11px] text-amber-400 font-black uppercase">Цена: −1 к макс. мане</p>
                             <button onClick={(e) => { e.stopPropagation(); burnCard(card); }} className="mt-1 px-5 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-white font-black text-xs uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-[0_0_18px_rgba(239,68,68,0.5)]">Сжечь</button>
                           </>
                         )}
                         <button onClick={(e) => { e.stopPropagation(); setBurnConfirmId(null); }} className="text-[10px] text-slate-400 uppercase tracking-widest hover:text-white transition-colors">Отмена</button>
                       </div>
                     )}
                   </div>
                   );
                 })}
               </div>
            </div>
          </div>
          <div className="absolute inset-0 -z-10" onClick={closeDeckView}></div>
        </div>
        );
      })()}
      </div>
    </div>
  );
}