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

// HP больше НЕ зависит от статов: базовое значение + рост за уровень + события + предметы
const INITIAL_PLAYERS_DATA = [
  { id: 'p1', name: 'Воин', baseMaxHp: 50, hp: 50, maxHp: 50, str: 15, agi: 5, int: 2, icon: '🛡️', bg: 'bg-blue-900', currentCard: null, hasActed: false },
  { id: 'p2', name: 'Разбойник', baseMaxHp: 35, hp: 35, maxHp: 35, str: 6, agi: 18, int: 4, icon: '🗡️', bg: 'bg-green-900', currentCard: null, hasActed: false },
  { id: 'p3', name: 'Маг', baseMaxHp: 25, hp: 25, maxHp: 25, str: 2, agi: 6, int: 20, icon: '🔮', bg: 'bg-purple-900', currentCard: null, hasActed: false },
];

// Рост максимального HP за уровень отряда (воин — танк, растёт быстрее)
const HP_PER_LEVEL = { p1: 8, p2: 6, p3: 4 };

// Цветовые акценты бойцов (для подсветки слотов руки в экране колоды)
const HERO_ACCENT = { p1: '#3b82f6', p2: '#22c55e', p3: '#a855f7' };

// Вторичные эффекты абилок. Каждый масштабируется от ВТОРОСТЕПЕННОГО стата владельца.
// duration — в ХОДАХ врага (тикает, когда враги ходят). mark — без длительности (до первого удара).
const SECONDARY_EFFECTS = {
  stun:   { stat: 'dex', icon: '💫', color: 'text-amber-300', label: 'Оглушение',      duration: 1 },
  vuln:   { stat: 'int', icon: '🛡️', color: 'text-blue-400',  label: 'Пробитие брони', duration: 2 },
  bleed:  { stat: 'str', icon: '🩸', color: 'text-red-400',   label: 'Кровотечение',   duration: 3 },
  blind:  { stat: 'int', icon: '🌀', color: 'text-blue-400',  label: 'Ослепление',     duration: 2 },
  weaken: { stat: 'str', icon: '⬇️', color: 'text-red-400',   label: 'Ослабление',     duration: 2 },
  mark:   { stat: 'dex', icon: '🎯', color: 'text-green-400', label: 'Метка',          duration: 0 },
};
const STAT_TEXT_COLOR = { str: 'text-red-400', dex: 'text-green-400', int: 'text-blue-400' };

// Краткое описание дебаффа врага для тултипа при наведении
const describeStatus = (key, val = {}) => {
  switch (key) {
    case 'stun':   return 'Пропускает ход';
    case 'vuln':   return `Получает +${Math.round((val.amount || 0) * 100)}% урона`;
    case 'bleed':  return `Теряет ${val.dmg || 0} HP в начале хода`;
    case 'blind':  return `Шанс промаха ${Math.round((val.chance || 0) * 100)}%`;
    case 'weaken': return `Атака ослаблена на ${Math.round((val.atk || 0) * 100)}%`;
    case 'mark':   return `Следующий удар ×${val.mult || 1}`;
    default:       return '';
  }
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

// «Огонёк души» — мета-валюта: хлам копит очки в ГЛОБАЛЬНУЮ шкалу прогресса,
// которая переносится между забегами и не сгорает при смерти. 1 огонёк за порог,
// остаток сверх порога переходит в следующий цикл заполнения.
const JUNK_SOUL_POINTS = { COMMON: 1, RARE: 4, EPIC: 10, LEGENDARY: 25 };
const EMBER_JUNK_THRESHOLD = 11; // было 15; −30% к стоимости огонька (меньше очков хлама за 1 🔥)
const getItemJunkPoints = (item) => (item && JUNK_SOUL_POINTS[item.rarity]) || 0;
const sumJunkPoints = (items) => items.reduce((s, it) => s + getItemJunkPoints(it), 0);
// Цена открытия слотов на экране подготовки: каждый следующий ×2, базовые значения −30%
const PREP_SLOT_PRICES = [1, 1, 3, 6, 11, 22];
const getPrepSlotPrice = (boughtCount) => PREP_SLOT_PRICES[Math.min(boughtCount, PREP_SLOT_PRICES.length - 1)];
const PREP_MAX_BUYS = 2;
const PREP_BURN_COST = 1; // сжигание карты всегда стоит ровно 1 огонёк

// Готичные фразы для экрана подготовки перед забегом
const GOTHIC_PHRASES = [
  'Прошлые путники сгинули во тьме, оставив лишь пугающие слухи о своих страданиях.',
  'Тени этих коридоров сотканы из криков тех, кто пришел сюда до вас.',
  'Они искали здесь славу, но обрели лишь вечный холод и прах.',
  'Смерть в этом месте — не избавление, а лишь начало бесконечной агонии.',
  'Кости предшественников устилают вам путь. Ступайте тихо.',
  'Мрак уже поглотил их надежды. Теперь он голоден до ваших.',
  'Никто не возвращался из этой бездны. Вы — лишь следующая жертва.',
];
// Главный стат предмета — чёткая градация по рарности, ощутимые значения
const ITEM_STAT_RANGES = {
  COMMON: { min: 4, max: 7 },
  RARE: { min: 9, max: 14 },
  EPIC: { min: 17, max: 25 },
  LEGENDARY: { min: 30, max: 45 },
};
// Кол-во случайных бонусов на предмет по рарности
const ITEM_BONUS_COUNTS = { COMMON: [1, 1], RARE: [1, 2], EPIC: [2, 3], LEGENDARY: [2, 4] };
// Возможные типы бонусов предмета
const ITEM_STAT_TYPES = ['str', 'dex', 'int', 'hp'];
const ITEM_HP_MULT = 2.5;

const rollItemStatBundle = (rarity) => {
  const range = ITEM_STAT_RANGES[rarity];
  const roll = () => Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
  const [minC, maxC] = ITEM_BONUS_COUNTS[rarity] || [1, 1];
  const count = minC + Math.floor(Math.random() * (maxC - minC + 1));
  const picked = shuffleArray(ITEM_STAT_TYPES).slice(0, count);
  const stats = {};
  picked.forEach((stat, idx) => {
    const base = roll();
    const mult = idx === 0 ? 1 : 0.32 + Math.random() * 0.18;
    let val = Math.max(1, Math.round(base * mult));
    if (stat === 'hp') val = Math.max(4, Math.round(val * ITEM_HP_MULT));
    stats[stat] = val;
  });
  return stats;
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
  p1: { url: './chars/warrior_atlas.png', cols: 4, rows: 4, frameCount: 15, fps: 7.5 },
  p2: { url: './chars/rogue_atlas.png',   cols: 4, rows: 4, frameCount: 16, fps: 7.5 },
  p3: { url: './chars/priest_atlas.png',  cols: 4, rows: 4, frameCount: 16, fps: 7.5 },
};
// Hue/Sat (Photoshop Colorize) для героев: p1 — воин, p2 — разбойник, p3 — маг.
const CHAR_COLORIZE = {
  p1: { hue: 196, sat: 32 },
  p2: { hue: 80,  sat: 48 },
  p3: { hue: 286, sat: 34 },
};
// Colorize без оверлея: sepia + hue-rotate + saturate на видимом кадре (аналог PS Hue/Sat Colorize).
const charColorizeFilter = (hue, sat) => {
  const hueRotate = hue - 38; // sepia(1) ≈ 38° на цветовом круге
  const saturate = Math.round(80 + sat * 2.8);
  return `sepia(1) saturate(${saturate}%) hue-rotate(${hueRotate}deg)`;
};

// Зигзаг-формация бойцов игрока. Координаты из макета (контейнер 545px высотой, спрайт 254px)
// отмасштабированы под высоту арены 355px (коэф. ≈0.651).
const CHAR_SPRITE_SIZE = 166;
const CHAR_FORMATION = {
  p1: { left: 171, top: 42 },   // воин — по центру, шаг вперёд
  p2: { left: 5, top: -46 },    // разбойник — сверху слева
  p3: { left: 5, top: 121 },    // маг — снизу слева
};

// Атласы врагов (спрайты зеркалятся через scaleX(-1))
const ENEMY_ATLASES = {
  'Гоблин':     { url: './chars/goblin_atlas.png',     cols: 4, rows: 4, frameCount: 16, fps: 7.5 },
  'Волк':       { url: './chars/wolf_atlas.png',       cols: 4, rows: 4, frameCount: 16, fps: 7.5 },
  'Бандит':     { url: './chars/bandit_atlas.png',     cols: 4, rows: 4, frameCount: 16, fps: 7.5 },
  'Орк':        { url: './chars/orc_atlas.png',        cols: 4, rows: 4, frameCount: 16, fps: 7.5 },
  'Зомби':      { url: './chars/zombie_atlas.png',     cols: 4, rows: 4, frameCount: 16, fps: 7.5 },
  'Слизень':    { url: './chars/squish_atlas.png',     cols: 4, rows: 4, frameCount: 16, fps: 7.5 },
  'Стрелок':    { url: './chars/shooter_atlas.png',    cols: 4, rows: 4, frameCount: 16, fps: 7.5 },
  'Тёмный маг': { url: './chars/dark_mage_atlas.png',  cols: 4, rows: 4, frameCount: 16, fps: 7.5 },
  'Глаз':       { url: './chars/eye_atlas.png',        cols: 4, rows: 4, frameCount: 16, fps: 7.5 },
};

// Роли врагов: стиль атаки и множитель урона
// melee  — прыгает к цели, бьёт одного
// ranged — не прыгает, снаряд к цели, бьёт одного
// aoe    — не прыгает, бьёт ВСЕХ игроков одновременно
const ENEMY_TYPES = {
  'Гоблин':     { dmgMult: 0.80, attackStyle: 'melee',  vfxType: 'enemy'       },
  'Волк':       { dmgMult: 1.00, attackStyle: 'melee',  vfxType: 'enemy'       },
  'Бандит':     { dmgMult: 1.10, attackStyle: 'melee',  vfxType: 'enemy'       },
  'Орк':        { dmgMult: 1.40, attackStyle: 'melee',  vfxType: 'smash'       },
  'Зомби':      { dmgMult: 0.85, attackStyle: 'melee',  vfxType: 'enemy'       },
  'Слизень':    { dmgMult: 0.65, attackStyle: 'melee',  vfxType: 'enemy'       },
  'Стрелок':    { dmgMult: 1.10, attackStyle: 'ranged', vfxType: 'arrow'       },
  'Тёмный маг': { dmgMult: 1.45, attackStyle: 'ranged', vfxType: 'dark_void'   },
  'Глаз':       { dmgMult: 1.70, attackStyle: 'aoe',    vfxType: 'dark_void'   },
};

// Зеркальная формация врагов — точное зеркало CHAR_FORMATION (left→right, top одинаковые)
const ENEMY_FORMATIONS = {
  1: [{ right: 171, top: 42  }],                          // зеркало p1 — шаг вперёд
  2: [{ right: 5,   top: -46 }, { right: 5, top: 121 }],  // зеркала p2 и p3
  3: [{ right: 5,   top: -46 }, { right: 171, top: 42 }, { right: 5, top: 121 }], // зеркала p1, p2, p3
};

// Анимированный спрайт из атласа. Покраска — CSS filter на видимый кадр, без оверлея поверх.
const CharSprite = ({ atlas, size = 110, className = '', style = {}, hue, sat }) => {
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
  const sheetW = atlas.cols * size;
  const sheetH = atlas.rows * size;

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        overflow: 'hidden',
        ...(hue != null ? { filter: charColorizeFilter(hue, sat) } : {}),
        ...style,
      }}
    >
      <img
        src={atlas.url}
        alt=""
        draggable={false}
        className="block max-w-none select-none"
        style={{
          width: sheetW,
          height: sheetH,
          marginLeft: -col * size,
          marginTop: -row * size,
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
};

// Мини HP-бар врага: прямоугольный, скрыт по умолчанию, всплывает при получении урона
// и плавно исчезает. Двухслойная анимация: белый «откушенный» кусок сужается до текущего HP.
const EnemyHpBar = ({ hp, maxHp }) => {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const [visible, setVisible] = useState(false);
  const [ghostPct, setGhostPct] = useState(pct);
  const prevHpRef = useRef(hp);
  const hideTimerRef = useRef(null);

  useEffect(() => {
    const prev = prevHpRef.current;
    prevHpRef.current = hp;
    if (hp < prev) {
      // Урон: показать бар, белый «призрак» = прежняя ширина, затем сузить до текущего HP
      setVisible(true);
      setGhostPct(Math.max(0, Math.min(100, (prev / maxHp) * 100)));
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setGhostPct(pct)));
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setVisible(false), 1000);
      return () => cancelAnimationFrame(raf);
    } else {
      // Лечение/сброс — без всплытия, просто синхронизируем
      setGhostPct(pct);
    }
  }, [hp, maxHp, pct]);

  useEffect(() => () => clearTimeout(hideTimerRef.current), []);

  return (
    <div className={`absolute left-1/2 -translate-x-1/2 -bottom-1 w-[32px] h-1 bg-slate-950/80 border border-black/60 z-[70] pointer-events-none overflow-hidden transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      {/* Белый «откушенный» кусок (под красным): сужается от прежнего значения к текущему */}
      <div className="absolute inset-y-0 left-0 bg-white" style={{ width: `${ghostPct}%`, transition: 'width 0.45s ease-out' }} />
      {/* Реальное HP поверх — красный, меняется мгновенно */}
      <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-700 to-red-500" style={{ width: `${pct}%` }} />
    </div>
  );
};

// Пузырь речи врага: белый с красной обводкой и хвостиком над спрайтом.
// Сдвигается внутрь, если упирается в верх/край экрана, чтобы всегда был виден.
const EnemySpeechBubble = ({ text }) => {
  const ref = useRef(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pad = 12;
    const r = el.getBoundingClientRect();
    let dx = 0, dy = 0;
    if (r.top < pad) dy = pad - r.top;
    if (r.left < pad) dx = pad - r.left;
    if (r.right > window.innerWidth - pad) dx = window.innerWidth - pad - r.right;
    setOffset({ x: dx, y: dy });
  }, [text]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-1/2 mb-3 w-max max-w-[180px] bg-white text-red-900 text-[11px] font-black px-4 py-2 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] z-[100] animate-in fade-in zoom-in-75 duration-300 leading-tight uppercase border-[3px] border-red-500 pointer-events-none"
      style={{ transform: `translate(calc(-50% + ${offset.x}px), ${offset.y}px)` }}
    >
      {text}
      <div className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-b-[3px] border-r-[3px] border-red-500 rotate-45" style={{ marginLeft: -offset.x }}></div>
    </div>
  );
};

const rollItemRarity = (sector = 1, stage = 0) => {
  // Чем глубже заход — тем выше шанс редкого лута (сектор + этап карты)
  const depth = Math.max(0, (sector - 1) * 6 + Math.max(0, stage - 1));
  const t = Math.min(1, depth / 22);
  const weights = {
    COMMON: Math.round(78 - t * 38),
    RARE: Math.round(16 + t * 14),
    EPIC: Math.round(5 + t * 15),
    LEGENDARY: Math.round(1 + t * 9),
  };
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (const [rarity, weight] of Object.entries(weights)) {
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
  const stats = rollItemStatBundle(rarity);
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

const generateRandomItem = (sector = 1, stage = 0) => generateItemOfRarity(rollItemRarity(sector, stage));

const rollLootDrop = (sector = 1, stage = 0) => (Math.random() < LOOT_DROP_CHANCE ? generateRandomItem(sector, stage) : null);

const getEffectivePlayer = (player, equippedItem) => {
  if (!player) return player;
  const bonus = equippedItem?.stats || {};
  const str = player.str + (bonus.str || 0);
  const agi = player.agi + (bonus.dex || bonus.agi || 0);
  const int = player.int + (bonus.int || 0);
  const maxHp = (player.baseMaxHp ?? 20) + (bonus.hp || 0);
  return { ...player, str, agi, int, maxHp };
};

const formatItemStats = (stats = {}) => {
  const parts = [];
  if (stats.str) parts.push(`Сила +${stats.str}`);
  if (stats.dex || stats.agi) parts.push(`Ловкость +${stats.dex || stats.agi}`);
  if (stats.int) parts.push(`Инт +${stats.int}`);
  if (stats.hp) parts.push(`HP +${stats.hp}`);
  return parts.length ? parts.join(' · ') : 'Без бонусов';
};

// comboSplash: true — карта бьёт одиночно, но при комбо (2-я карта: +50, 3-я: +150) бьёт по площади.
// type: 'single' у всех комбо-сплэшей; 'splash' только у базовых (без comboSplash).
const HERO_ABILITIES = {
  p1: { 
    basic: { id: 'b1', name: 'Удар мечом', cost: 0, mult: 1.8, scale: { str: 1.0, dex: 0.2 }, dmgType: 'melee', icon: '⚔️', type: 'single', priority: 'direct', rarity: 'COMMON', vfxType: 'slash' },
    skills: [
      { id: 's1_1', ownerId: 'p1', name: 'Молот Тора', cost: 2, mult: 2.8, scale: { str: 1.0, dex: 0.15 }, dmgType: 'melee', icon: '🔨', type: 'single', priority: 'highestHp', rarity: 'EPIC', vfxType: 'smash', secondary: { effect: 'stun' }, comboSplash: true },
      { id: 's1_2', ownerId: 'p1', name: 'Размах', cost: 2, mult: 1.7, scale: { str: 0.9, dex: 0.25 }, dmgType: 'melee', icon: '🌪️', type: 'single', priority: 'highestHp', rarity: 'COMMON', vfxType: 'slash', comboSplash: true },
      { id: 's1_3', ownerId: 'p1', name: 'Рывок', cost: 1, mult: 1.6, scale: { str: 1.0, dex: 0.35 }, dmgType: 'melee', icon: '🏃', type: 'single', priority: 'lowestHp', rarity: 'COMMON', vfxType: 'slash' },
      { id: 's1_4', ownerId: 'p1', name: 'Землетрясение', cost: 4, mult: 1.8, scale: { str: 0.8, int: 0.4 }, dmgType: 'magic', icon: '🌋', type: 'single', priority: 'highestHp', rarity: 'EPIC', vfxType: 'smash', secondary: { effect: 'vuln' }, comboSplash: true }
    ]
  },
  p2: { 
    basic: { id: 'b2', name: 'Кинжал', cost: 0, mult: 2.0, scale: { dex: 1.0, str: 0.35 }, dmgType: 'ranged', icon: '🗡️', type: 'single', priority: 'lowestHp', rarity: 'COMMON', vfxType: 'dagger_single' },
    skills: [
      { id: 's2_1', ownerId: 'p2', name: 'Яд', cost: 1, mult: 1.8, scale: { dex: 1.0, int: 0.25 }, dmgType: 'ranged', icon: '🧪', type: 'single', priority: 'lowestHp', rarity: 'COMMON', vfxType: 'poison', secondary: { effect: 'bleed' } },
      { id: 's2_2', ownerId: 'p2', name: 'Танец стали', cost: 3, mult: 2.4, scale: { dex: 0.8, int: 0.4 }, dmgType: 'ranged', icon: '⚔️', type: 'single', priority: 'highestHp', rarity: 'RARE', vfxType: 'daggers', comboSplash: true },
      { id: 's2_3', ownerId: 'p2', name: 'Теневой шаг', cost: 2, mult: 2.6, scale: { dex: 1.0, str: 0.35 }, dmgType: 'ranged', icon: '🥷', type: 'single', priority: 'highestHp', rarity: 'RARE', vfxType: 'dark_strike', secondary: { effect: 'blind' } },
      { id: 's2_4', ownerId: 'p2', name: 'Шквал ножей', cost: 3, mult: 2.6, scale: { dex: 0.8, int: 0.4 }, dmgType: 'ranged', icon: '🗡️', type: 'single', priority: 'highestHp', rarity: 'EPIC', vfxType: 'daggers', comboSplash: true }
    ]
  },
  p3: { 
    basic: { id: 'b3', name: 'Искра', cost: 0, mult: 1.0, scale: { int: 1.0, dex: 0.2 }, dmgType: 'magic', icon: '✨', type: 'single', priority: 'direct', rarity: 'COMMON', vfxType: 'magic_spark' },
    skills: [
      { id: 's3_1', ownerId: 'p3', name: 'Огненный шар', cost: 3, mult: 2.5, scale: { int: 1.0, str: 0.3 }, dmgType: 'magic', icon: '☄️', type: 'single', priority: 'highestHp', rarity: 'RARE', vfxType: 'fireball', comboSplash: true },
      { id: 's3_2', ownerId: 'p3', name: 'Ледяной шип', cost: 2, mult: 1.6, scale: { int: 1.0, dex: 0.25 }, dmgType: 'magic', icon: '❄️', type: 'single', priority: 'highestHp', rarity: 'RARE', vfxType: 'ice_spike', secondary: { effect: 'mark' } },
      { id: 's3_3', ownerId: 'p3', name: 'Цепная молния', cost: 3, mult: 2.0, scale: { int: 0.8, dex: 0.4 }, dmgType: 'magic', icon: '⚡', type: 'single', priority: 'highestHp', rarity: 'RARE', vfxType: 'lightning', comboSplash: true },
      { id: 's3_4', ownerId: 'p3', name: 'Черная дыра', cost: 5, mult: 3.2, scale: { int: 1.0, str: 0.3 }, dmgType: 'magic', icon: '🌌', type: 'single', priority: 'highestHp', rarity: 'LEGENDARY', vfxType: 'dark_void', secondary: { effect: 'weaken' }, comboSplash: true }
    ]
  }
};

// Пулл карт бойца: максимум карт (кроме базовой), которые может держать один герой.
// Колода всегда полная (DECK_SIZE): старт — только «пустые» карты-балласт, пулл наполняется на level-up.
const CARD_POOL_SIZE = 3;
const DECK_SIZE = INITIAL_PLAYERS_DATA.length * CARD_POOL_SIZE;

// Комбо-бонус к урону по шагу серии: [1-я карта, 2-я, 3-я+] => +0% / +50% / +150%
const COMBO_DAMAGE_MULT = [1, 1.5, 2.5];
// % прибавки для отображения в UI (соответствует COMBO_DAMAGE_MULT)
const COMBO_DAMAGE_PCT = [0, 50, 150];

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
  { id: 'stats', title: 'Эликсир Мощи', desc: 'Основная характеристика каждого бойца увеличивается на +2%.', icon: '💪' },
  { id: 'hp', title: 'Семя Жизни', desc: 'Максимальное здоровье всех героев увеличивается на +50%.', icon: '❤️' },
  { id: 'cards', title: 'Древний Фолиант', desc: 'Выбрать одну из 3 карт: новую или улучшение имеющейся.', icon: '📜' }
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

const isBasicCard = (card) => card && card.id.startsWith('b');
const isEmptyCard = (card) => card && card.isEmpty;
const isRealDeckCard = (card) => card && !isBasicCard(card) && !isEmptyCard(card);
const isDeckCard = (card) => card && !isBasicCard(card);

// Стабильный ключ скилла в колоде (имя + id шаблона) — для дедупа на level-up / prep
const getHeroSkillCatalog = (heroId) => HERO_ABILITIES[heroId]?.skills || [];
const resolveSkillTemplate = (heroId, card) => {
  if (!card) return null;
  const catalog = getHeroSkillCatalog(heroId);
  if (card.skillId) return catalog.find(s => s.id === card.skillId) || null;
  return catalog.find(s => s.id === card.id || s.name === card.name) || null;
};
const getOwnedSkillKeys = (heroId, cards) => {
  const keys = new Set();
  cards.filter(c => c.ownerId === heroId && isRealDeckCard(c)).forEach(c => {
    keys.add(c.name);
    if (c.skillId) keys.add(c.skillId);
    const tmpl = resolveSkillTemplate(heroId, c);
    if (tmpl) { keys.add(tmpl.id); keys.add(tmpl.name); }
  });
  return keys;
};
const getUnownedSkills = (heroId, ownedKeys) =>
  getHeroSkillCatalog(heroId).filter(s => !ownedKeys.has(s.id) && !ownedKeys.has(s.name));
const heroOwnsSkill = (heroId, skill, ownedKeys) =>
  ownedKeys.has(skill.id) || ownedKeys.has(skill.name);

const createEmptyCard = (ownerId, slotIndex) => ({
  id: `empty_${ownerId}_${slotIndex}`,
  ownerId,
  isEmpty: true,
  name: 'Пусто',
  icon: '🙨',
});

const createInitialDeck = () => {
  const cards = [];
  INITIAL_PLAYERS_DATA.forEach(({ id }) => {
    for (let i = 0; i < CARD_POOL_SIZE; i++) cards.push(createEmptyCard(id, i));
  });
  return shuffleArray(cards);
};

// Добивает колоду до DECK_SIZE пустыми картами (на случай старых сохранений)
const ensureFullDeck = (cards) => {
  const deck = [...cards];
  INITIAL_PLAYERS_DATA.forEach(({ id }) => {
    const ownerCards = deck.filter(c => c.ownerId === id);
    const missing = CARD_POOL_SIZE - ownerCards.length;
    for (let i = 0; i < missing; i++) {
      deck.push(createEmptyCard(id, ownerCards.length + i));
    }
  });
  return deck;
};

// Уровень карты — растёт при выборе улучшения на level-up (x2 урона за каждый уровень)
const getCardLevel = (card) => (card && card.level) || 1;
const getLevelMultiplier = (card) => Math.pow(2, getCardLevel(card) - 1);

const getPlayerDex = (player) => player?.agi ?? 0;

const getMaxHpFromStats = (player, equippedItem = null) => {
  return (player.baseMaxHp ?? 20) + (equippedItem?.stats?.hp || 0);
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

// Случайного крита больше нет: крит существует только через 🎯 Метку мага
const getCritChance = () => 0;

const formatCardScale = (card) => {
  const s = getCardScale(card);
  const parts = [];
  if (s.str) parts.push(`STR×${Math.round(s.str * 100)}%`);
  if (s.dex) parts.push(`DEX×${Math.round(s.dex * 100)}%`);
  if (s.int) parts.push(`INT×${Math.round(s.int * 100)}%`);
  return parts.join(' ');
};

// Цвет урона карты по доминирующей характеристике (как в панели статов):
// сила → красный, ловкость → зелёный, интеллект → синий
const getCardStatColor = (card) => {
  const s = getCardScale(card);
  const str = s.str || 0, dex = s.dex || 0, int = s.int || 0;
  if (int > str && int >= dex) return 'text-blue-400';
  if (dex > str && dex >= int) return 'text-green-400';
  return 'text-red-400';
};

// ЕДИНАЯ формула урона: mult × (статы по скейлу карты) × уровень карты × бонус.
// Никаких глобальных добавок от статов — статы качают только урон карт и их вторичные эффекты.
const computeCardDamage = (owner, card, bonus = 1) => {
  if (!owner || !card) return { damage: 0, critChance: 0 };
  const scale = getCardScale(card);
  const str = owner.str ?? 0;
  const dex = getPlayerDex(owner);
  const int = owner.int ?? 0;

  const scaledStats =
    str * (scale.str || 0) +
    dex * (scale.dex || 0) +
    int * (scale.int || 0);

  const total = card.mult * scaledStats * getLevelMultiplier(card) * bonus;

  return { damage: Math.max(0, Math.floor(total)), critChance: 0 };
};

const getCardDamage = (owner, card, bonus = 1) => computeCardDamage(owner, card, bonus).damage;

const rollCardDamage = (owner, card, bonus = 1) => {
  const { damage, critChance } = computeCardDamage(owner, card, bonus);
  const isCrit = Math.random() < critChance;
  return { damage: isCrit ? Math.floor(damage * 2) : damage, isCrit, critChance };
};

// --- ВТОРИЧНЫЕ ЭФФЕКТЫ АБИЛОК ---

// «Сила» эффекта = значение второстепенного стата владельца
const getSecondaryStatValue = (owner, effect) => {
  const stat = SECONDARY_EFFECTS[effect]?.stat;
  if (stat === 'str') return owner?.str ?? 0;
  if (stat === 'dex') return getPlayerDex(owner);
  if (stat === 'int') return owner?.int ?? 0;
  return 0;
};

// Краткое описание эффекта с подсчитанной величиной (для тултипа карточки)
const getSecondaryDesc = (owner, card) => {
  if (!card?.secondary) return null;
  const effect = card.secondary.effect;
  const def = SECONDARY_EFFECTS[effect];
  if (!def) return null;
  const v = owner ? getSecondaryStatValue(owner, effect) : 0;
  let valueText = '';
  switch (effect) {
    case 'stun':   valueText = `${Math.round(Math.min(0.75, v * 0.02) * 100)}% шанс`; break;
    case 'vuln':   valueText = `+${Math.round(Math.min(0.50, v * 0.01) * 100)}% урона`; break;
    case 'bleed':  valueText = `${Math.max(1, Math.round(v * 0.5))}/ход ×${def.duration}`; break;
    case 'blind':  valueText = `${Math.round(Math.min(0.75, v * 0.02) * 100)}% пром.`; break;
    case 'weaken': valueText = `−${Math.round(Math.min(0.50, v * 0.01) * 100)}% атк`; break;
    case 'mark':   valueText = `крит +${Math.round(v * 1)}%`; break;
    default: break;
  }
  return { effect, def, valueText };
};

// Полное описание карты для UI
const getCardDescription = (owner, card) => {
  if (!card) return { targetLine: '', effectLine: null };
  const targetLine = card.type === 'splash'
    ? 'Бьёт всех врагов'
    : card.priority === 'lowestHp' ? 'Бьёт самого слабого'
    : card.priority === 'highestHp' ? 'Бьёт самого живучего'
    : 'Одиночная цель';
  const secondary = getSecondaryDesc(owner, card);
  const effectLine = secondary
    ? { icon: secondary.def.icon, label: secondary.def.label, value: secondary.valueText, color: STAT_TEXT_COLOR[secondary.def.stat] }
    : null;
  return { targetLine, effectLine };
};

// Готовит payload эффекта для наложения на врага (величины посчитаны от владельца).
// comboMult >= 1 масштабирует величины эффектов для 2-й и 3-й карт комбо.
const buildSecondaryPayload = (owner, card, comboMult = 1) => {
  if (!card?.secondary) return null;
  const effect = card.secondary.effect;
  const def = SECONDARY_EFFECTS[effect];
  if (!def) return null;
  const v = getSecondaryStatValue(owner, effect) * comboMult;
  switch (effect) {
    case 'stun':   return { effect, chance: Math.min(0.95, v * 0.02), duration: def.duration };
    case 'vuln':   return { effect, amount: Math.min(0.80, v * 0.01), duration: def.duration };
    case 'bleed':  return { effect, dmg: Math.max(1, Math.round(v * 0.5)), duration: def.duration };
    case 'blind':  return { effect, chance: Math.min(0.95, v * 0.02), duration: def.duration };
    case 'weaken': return { effect, atk: Math.min(0.80, v * 0.01), hpLoss: Math.max(1, Math.round(v * 0.5)), duration: def.duration };
    case 'mark':   return { effect, mult: 1 + v * 0.01 };
    default: return null;
  }
};

// Накладывает эффект на копию statuses врага (возвращает новый объект statuses).
// Возвращает { statuses, immediateHpLoss, applied } — immediateHpLoss для weaken.
const applyStatusToEnemy = (enemyStatuses, payload) => {
  const statuses = { ...(enemyStatuses || {}) };
  let immediateHpLoss = 0;
  let applied = true;
  switch (payload.effect) {
    case 'stun':
      if (Math.random() < payload.chance) statuses.stun = { remaining: payload.duration };
      else applied = false;
      break;
    case 'vuln': {
      const prev = statuses.vuln;
      statuses.vuln = { remaining: Math.max(payload.duration, prev?.remaining || 0), amount: Math.max(payload.amount, prev?.amount || 0) };
      break;
    }
    case 'bleed': {
      const prev = statuses.bleed;
      statuses.bleed = { remaining: payload.duration, dmg: Math.max(payload.dmg, prev?.dmg || 0) };
      break;
    }
    case 'blind': {
      const prev = statuses.blind;
      statuses.blind = { remaining: Math.max(payload.duration, prev?.remaining || 0), chance: Math.max(payload.chance, prev?.chance || 0) };
      break;
    }
    case 'weaken': {
      const prev = statuses.weaken;
      statuses.weaken = { remaining: Math.max(payload.duration, prev?.remaining || 0), atk: Math.max(payload.atk, prev?.atk || 0) };
      immediateHpLoss = payload.hpLoss;
      break;
    }
    case 'mark':
      statuses.mark = { mult: payload.mult };
      break;
    default:
      applied = false;
  }
  return { statuses, immediateHpLoss, applied };
};

// Уменьшает длительность всех временных статусов на 1; убирает истёкшие. mark не трогаем.
const decrementStatuses = (enemy) => {
  const s = enemy.statuses;
  if (!s) return enemy;
  const next = {};
  ['stun', 'vuln', 'bleed', 'blind', 'weaken'].forEach(k => {
    if (s[k] && s[k].remaining > 1) next[k] = { ...s[k], remaining: s[k].remaining - 1 };
  });
  if (s.mark) next.mark = s.mark;
  return { ...enemy, statuses: next };
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
  const s = (stage || 1) + (sector - 1) * 6;
  const mult = Math.pow(1.55, sector - 1);
  let counter = 0;
  const mk = (prefix, name, baseHp, perStage, icon, xp) => {
    const { dmgMult, attackStyle, vfxType } = ENEMY_TYPES[name] || { dmgMult: 1, attackStyle: 'melee', vfxType: 'enemy' };
    const hp = Math.round((baseHp + s * perStage) * mult);
    return {
      id: `${prefix}_${Date.now()}_${counter++}`,
      name, hp, maxHp: hp, icon, isDead: false,
      xpReward: Math.round(xp * mult),
      dmgMult, attackStyle, vfxType,
      statuses: {},
    };
  };

  if (type === 'boss') {
    // Глаз — единственный босс, AoE. Понерфлен: −30% HP, −25% к атаке
    const boss = mk('boss', 'Глаз', 280, 65, '👁️', 400);
    boss.hp = Math.round(boss.hp * 0.7);
    boss.maxHp = boss.hp;
    boss.dmgMult = boss.dmgMult * 0.75;
    boss.isBoss = true;
    return [boss];
  } else if (type === 'combat_hard') {
    return shuffleArray([
      mk('h1', 'Орк',        100, 28, '🪓', 150),
      mk('h2', 'Тёмный маг',  60, 18, '🧙', 140),
      mk('h3', 'Зомби',       95, 26, '🧟', 130),
    ]);
  } else if (type === 'combat_medium') {
    return shuffleArray([
      mk('m1', 'Зомби',    70, 18, '🧟', 90),
      mk('m2', 'Стрелок',  55, 14, '🏹', 85),
      mk('m3', 'Слизень',  45, 11, '🟢', 65),
    ]).slice(0, 2);
  } else {
    return shuffleArray([
      mk('e1', 'Слизень', 35, 10, '🟢', 50),
      mk('e2', 'Гоблин',  45, 12, '👺', 55),
      mk('e3', 'Волк',    40, 11, '🐺', 50),
      mk('e4', 'Бандит',  48, 13, '🦹', 60),
    ]).slice(0, 1 + Math.floor(Math.random() * 2));
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

const DamagePopup = ({ id, value, x, y, isCrit, text, color, onComplete }) => {
  const isStatus = !!text;
  const [offset, setOffset] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const [scale, setScale] = useState(isStatus ? 1.4 : (isCrit ? 3.2 : 2.5));
  
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    const t = setTimeout(() => { setOffset(isStatus ? -70 : -120); setOpacity(0); setScale(isStatus ? 1.1 : 0.8); }, 50);
    const c = setTimeout(() => onCompleteRef.current(id), isStatus ? 1400 : 2000);
    return () => { clearTimeout(t); clearTimeout(c); };
  }, [id, isStatus]);

  // Текстовый статус-попап (оглушён, кровотечение, промах и т.п.)
  if (isStatus) {
    return (
      <div className={`fixed z-[905] font-black pointer-events-none uppercase tracking-tight ${color || 'text-white'}`}
        style={{ left: x, top: y, fontSize: '15px', opacity, transform: `translate(-50%, ${offset}px) scale(${scale})`, transition: 'all 1400ms cubic-bezier(0.18, 0.89, 0.32, 1.28)', WebkitTextStroke: '1px rgba(0,0,0,0.9)', textShadow: '2px 2px 0 rgba(0,0,0,0.9)' }}>
        {String(text)}
      </div>
    );
  }

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
      <div className="text-[12px] text-slate-200 leading-relaxed font-medium">{formatItemStats(item.stats)}</div>
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
        } else if (['daggers', 'poison', 'dagger_single', 'arrow'].includes(vfx.type)) {
           const angle = Math.atan2(vfx.endY - vfx.startY, vfx.endX - vfx.startX) * 180 / Math.PI;
           const scatterX = (vfx.type === 'dagger_single' || vfx.type === 'arrow') ? 0 : (Math.random() - 0.5) * 80;
           const scatterY = (vfx.type === 'dagger_single' || vfx.type === 'arrow') ? 0 : (Math.random() - 0.5) * 80;
           setStyle({ left: vfx.startX + scatterX, top: vfx.startY + scatterY, opacity: 1, transform: `translate(-50%, -50%) rotate(${angle + 90}deg)` });
           t1 = setTimeout(() => {
             setStyle({ left: vfx.endX, top: vfx.endY, opacity: 1, transform: `translate(-50%, -50%) rotate(${angle + 90 + (vfx.type === 'arrow' ? 0 : 1080)}deg)`, transition: 'all 450ms ease-out' });
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
  if (vfx.type === 'arrow') return <div style={style} className="fixed z-[1000] text-3xl drop-shadow-[0_0_8px_#94a3b8] pointer-events-none">🏹</div>;
  if (vfx.type === 'poison') return <div style={style} className="fixed z-[1000] text-4xl drop-shadow-[0_0_20px_#22c55e] pointer-events-none">🧪</div>;

  return null;
};

const ShaderBackground = ({ hue = 210, sat = 60, speed = 0, embedded = false }) => {
  const canvasRef = useRef(null);
  const targetSpeedRef = useRef(0);
  const speedRef = useRef(0);
  // [dark, bright] цвета небулы. Плавно интерполируются к цвету текущей локации.
  const targetColorRef = useRef([[0.02, 0.05, 0.12], [0.10, 0.40, 0.78]]);
  const colorRef = useRef([[0.02, 0.05, 0.12], [0.10, 0.40, 0.78]]);

  useEffect(() => { targetSpeedRef.current = Math.min(1, Math.max(0, speed)); }, [speed]);

  useEffect(() => {
    // Используем hue локации; насыщенность/яркость подобраны под тёмную небулу, чуть усилены от sat локации.
    const satBright = Math.min(95, sat * 0.6 + 55);
    const satDark = Math.min(90, sat * 0.6 + 45);
    targetColorRef.current = [hslToRgb01(hue, satDark, 8), hslToRgb01(hue, satBright, 44)];
  }, [hue, sat]);

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
      uniform float iSpeed;
      uniform vec3 uColorDark;
      uniform vec3 uColorBright;
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
          float spd = clamp(iSpeed, 0.0, 1.0);
          float speed = mix(0.30, 1.6, spd) * 0.5 * MOTION_BOOST;
          float t = iTime * speed;

          vec2 c = p - 1.75;
          float ang = t * (0.02 + 0.06 * spd) * MOTION_BOOST;
          c = rot(ang) * c;
          p = c + 1.75;

          float slow = t / (3.0 / MOTION_BOOST);
          vec2 offset1 = vec2(sin(slow * 0.7 * MOTION_BOOST), cos(slow * 0.9 * MOTION_BOOST)) * (0.25 + 0.35 * spd);
          vec2 offset2 = vec2(sin(t * 1.3 * MOTION_BOOST), cos(t * 1.1 * MOTION_BOOST)) * (0.4 * MOTION_BOOST);
          float warp = 1.0 + spd * 0.55;
          return fractalNoise( p + offset1 + warp * fractalNoise( p + 1.5 * fractalNoise( p - offset2 ) ) );
      }

      void main() {
          vec2 uv = gl_FragCoord.xy / iResolution.xy;
          vec2 sp = uv * (3.5 + iSpeed * 0.4);
          float n = complexFBM(sp);
          vec3 col = mix(uColorDark, uColorBright, clamp(n * 1.15, 0.0, 1.0));
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
    const iSpeedLocation = gl.getUniformLocation(program, 'iSpeed');
    const uColorDarkLocation = gl.getUniformLocation(program, 'uColorDark');
    const uColorBrightLocation = gl.getUniformLocation(program, 'uColorBright');

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
      speedRef.current += (targetSpeedRef.current - speedRef.current) * 0.02;
      const cur = colorRef.current, tgt = targetColorRef.current;
      for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) cur[i][j] += (tgt[i][j] - cur[i][j]) * 0.03;
      gl.uniform1f(iTimeLocation, (Date.now() - startTime) / 1000);
      gl.uniform1f(iSpeedLocation, speedRef.current);
      gl.uniform3f(uColorDarkLocation, cur[0][0], cur[0][1], cur[0][2]);
      gl.uniform3f(uColorBrightLocation, cur[1][0], cur[1][1], cur[1][2]);
      gl.uniform2f(iResolutionLocation, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    let lastRaf = 0, intervalSum = 0, intervalCount = 0, evalAt = 0;
    const render = (now = 0) => {
      animationFrameId = requestAnimationFrame(render);
      // Скрытая вакладка: браузер замораживает rAF. Сбрасываем тайминги, чтобы кадр
      // после возврата не посчитался гигантским интервалом и не «уронил» оценку.
      if (document.hidden) { lastRaf = 0; evalAt = 0; intervalSum = 0; intervalCount = 0; return; }

      if (lastRaf) {
        const dt = now - lastRaf;
        // Игнорируем выбросы (возврат из фона, GC, тяжёлый ререндер при смене ноды),
        // чтобы единичные лаги не деградировали и не останавливали шейдер.
        if (dt < 100) { intervalSum += dt; intervalCount++; }
      }
      lastRaf = now;
      if (!evalAt) evalAt = now + 1500;
      // Оцениваем производительность только по полному окну с достаточным числом выборок.
      if (now >= evalAt && intervalCount >= 20) {
        const avg = intervalSum / intervalCount;
        intervalSum = 0; intervalCount = 0; evalAt = now + 1500;
        // Деградируем по тирам при стабильно низком FPS, но НИКОГДА не отключаем рендер полностью.
        if (avg > 30 && tier < TIERS.length - 1) {
          tier++; frameInterval = 1000 / TIERS[tier].fps; resize();
        }
      } else if (now >= evalAt) {
        evalAt = now + 1500; intervalSum = 0; intervalCount = 0;
      }

      if (now - lastFrame < frameInterval) return;
      lastFrame = now;
      draw();
    };

    if (tier >= TIERS.length - 1) draw();
    animationFrameId = requestAnimationFrame(render);

    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(animationFrameId); };
  }, []);

  return <canvas ref={canvasRef} className={`${embedded ? 'absolute inset-0 z-0' : 'fixed inset-0 z-[-2]'} w-full h-full pointer-events-none`} />;
};

// HSL (H 0-360, S/L 0-100) → [r,g,b] в диапазоне 0..1 для шейдера.
const hslToRgb01 = (h, s, l) => {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [r + m, g + m, b + m];
};

const BG_MASK_URL = './bg/mask.png';
// ЧБ пиксель-арт локации. Красятся на лету через mix-blend-mode: color —
// аналог Hue/Saturation (Colorize) из Photoshop: hue/sat берутся из оверлея, яркость из картинки.
const BG_LOCATION_SETS = [
  { name: 'cemetery',      hue: 191, sat: 25, images: ['./bg/locations/cemetery_01.png', './bg/locations/cemetery_02.png', './bg/locations/cemetery_03.png'] },
  { name: 'torture',       hue: 14,  sat: 20, images: ['./bg/locations/torture_01.png', './bg/locations/torture_02.png', './bg/locations/torture_03.png'] },
  { name: 'dungeon_reach', hue: 304, sat: 30, images: ['./bg/locations/dungeon_reach_01.png', './bg/locations/dungeon_reach_02.png', './bg/locations/dungeon_reach_03.png'] },
];
// Сектор = один набор: сектор 1 — cemetery, 2 — torture, 3 — dungeon_reach, после третьего цикл.
// Цифра картинки (01/02/03) растёт с дистанцией, пройденной по карте сектора (stage 1–5 → 01/01/02/02/03).
const pickBgLocation = (sector = 1, stage = 0) => {
  const set = BG_LOCATION_SETS[(sector - 1) % BG_LOCATION_SETS.length];
  // Карта сектора: stage 1–5 (5 = босс) → варианты 01,01,02,02,03
  const variant = Math.min(set.images.length - 1, Math.floor(Math.max(0, stage - 1) * set.images.length / 5));
  return { url: set.images[variant], hue: set.hue, sat: set.sat };
};

// Сплеш стартового экрана: случайная локация + случайный холодный оттенок (циан→синий→индиго).
const pickColdSplash = () => {
  const all = BG_LOCATION_SETS.flatMap(s => s.images);
  return {
    url: all[Math.floor(Math.random() * all.length)],
    hue: 185 + Math.floor(Math.random() * 70), // 185..255
    sat: 22 + Math.floor(Math.random() * 14),   // 22..35
  };
};

// Картинка поверх шейдера: масштаб от ширины экрана, градиентная маска (якорь сверху, 100% ширины).
// Маска 100%×100% элемента картинки. PNG-маска + CSS-градиент (intersect) — гарантированный fade.
const ImageBackground = ({ imageUrl, hue, sat, opacity = 1, embedded = false }) => {
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
    <div className={`${embedded ? 'absolute inset-0 z-[1]' : 'fixed inset-0 z-[-1]'} pointer-events-none overflow-hidden`} style={{ opacity }}>
      {/* Маска на обёртке, чтобы покрасочный оверлей выцветал вместе с картинкой.
          isolation: blend «color» смешивается только с картинкой, не с тем, что позади. */}
      <div key={imageUrl} className="absolute top-0 left-0 w-full" style={{ ...maskStyle, isolation: 'isolate', transform: 'scale(1.045)', transformOrigin: 'center center' }}>
        <img
          src={imageUrl}
          alt=""
          className="block w-full h-auto select-none"
          draggable={false}
        />
        {hue != null && (
          <div
            className="absolute inset-0"
            style={{ backgroundColor: `hsl(${hue} ${sat}% 50%)`, mixBlendMode: 'color' }}
          />
        )}
      </div>
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
  const { isCandidate, willGiveBonus, comboStep = 0, comboPct = 0, willSplash = false } = comboState;
  const level = getCardLevel(card);
  
  let dmg = owner ? getCardDamage(owner, card) : 0;
  if (willGiveBonus) dmg = Math.floor(dmg * COMBO_DAMAGE_MULT[Math.min(comboStep, 2)]);
  const statColor = getCardStatColor(card);
  const base = getCardDescription(owner, card);
  // В комбо удар по площади у comboSplash-карт
  const targetLine = willSplash ? '💥 Бьёт всех врагов' : base.targetLine;
  const effectLine = base.effectLine;

  const displayRarityName = showOwnerLabel && owner ? `${rarity.name} - ${owner.name}` : rarity.name;

  return (
    <div className={`w-full h-full border ${rarity.border} rounded-2xl flex flex-col overflow-hidden transition-all duration-300 relative shadow-inner bg-[#45475a] ${isCandidate && !isDisabled ? 'ring-2 ring-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.6)]' : ''} ${!isDisabled ? 'group-hover:brightness-110' : ''}`}>
      <div className={`${rarity.header} py-1.5 px-2.5 border-b border-black/20 flex items-center justify-between shadow-md`}>
        <span className={`font-bold text-[11px] ${rarity.text} uppercase tracking-wider truncate drop-shadow-md`}>{String(card.name)}{level > 1 && <span className="text-amber-300"> ур.{String(level)}</span>}</span>
        <div className={`w-[22px] h-[22px] rounded-full flex items-center justify-center font-black text-[10px] border-2 border-white/20 shadow-lg text-white ${mana < card.cost ? 'bg-red-500' : 'bg-[#1E88E5]'}`}>{String(card.cost)}</div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center relative p-1 bg-[#373945] min-h-[40px]">
        {isCandidate && (<div className="absolute top-1 left-1 bg-yellow-400 text-black text-[9px] font-black px-1.5 py-0.5 rounded shadow-lg animate-bounce z-10">COMBO{willGiveBonus && comboPct > 0 ? ` +${comboPct}%` : '!'}</div>)}
        {willSplash && (<div className="absolute top-1 right-1 bg-orange-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-lg z-10">💥 AoE</div>)}
        <span className="text-[1.35rem] drop-shadow-2xl group-hover:scale-110 transition-transform duration-500">{String(card.icon)}</span>
      </div>
      <div className="text-center leading-none bg-[#50546d] border-t border-slate-600/30 px-2 pt-4 pb-2 flex flex-col justify-center gap-0.5 min-h-[76px] relative">
        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full ${rarity.badgeBg} shadow-md z-10 whitespace-nowrap`}>
          <span className="text-[10px] font-black italic text-[#FFFFE0] uppercase tracking-wide drop-shadow-sm">{displayRarityName}</span>
        </div>
        <p className="text-[11px] text-slate-100 font-semibold leading-none">
          Наносит{' '}
          <span
            className={`font-black text-[13px] transition-all duration-500 ${grow ? 'text-green-400' : (willGiveBonus ? 'text-yellow-400' : statColor)}`}
            style={{ display: 'inline-block', transform: grow ? 'scale(1.4)' : 'scale(1)', textShadow: grow ? '0 0 14px rgba(34,197,94,0.95)' : 'none' }}
          >{String(dmg)}</span>{' '}
          урона
        </p>
        {effectLine && (
          <p className={`text-[10px] font-bold leading-none ${effectLine.color}`}>
            {effectLine.icon} {effectLine.label}{effectLine.value ? `: ${effectLine.value}` : ''}
          </p>
        )}
        <p className={`text-[10px] leading-none mt-0.5 ${willSplash ? 'text-orange-400 font-bold' : 'text-slate-400'}`}>{targetLine}</p>
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
  // Атласы спрайтов: прогреваем заранее, чтобы враги/бойцы не подгружались рывками в бою
  ...Object.values(CHAR_ATLASES).map(a => a.url),
  ...Object.values(ENEMY_ATLASES).map(a => a.url),
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

// --- СХЕМА СЛОТОВ ОТРЯДА (бойцы + пуллы карт) ---

const RARITY_GLOW = { COMMON: '#64748b', RARE: '#0ea5e9', EPIC: '#9333ea', LEGENDARY: '#f59e0b' };

// Переиспользуется в попапе новой карты и в окне колоды.
// hoveredId/onHoverCard — двусторонняя подсветка карт между слотами и очередью колоды.
const SquadSlotsBoard = ({ players, pools, newCardId = null, hoveredId = null, onHoverCard = null }) => (
  <div className="flex flex-col gap-4">
    {players.map(p => {
      const cards = pools[p.id] || [];
      const isDead = p.hp <= 0;
      return (
        <div key={p.id} className={`flex items-center gap-6 bg-slate-900/70 border border-slate-700/60 rounded-3xl px-8 py-3 min-w-[560px] animate-in slide-in-from-bottom-4 fade-in duration-500 ${isDead ? 'grayscale' : ''}`}>
          <div className={`w-[100px] h-[100px] overflow-hidden flex items-end justify-center shrink-0 ${isDead ? 'opacity-50' : ''}`}>
            <CharSprite atlas={CHAR_ATLASES[p.id]} size={100} {...CHAR_COLORIZE[p.id]} />
          </div>
          <div className="w-28 shrink-0">
            <p className={`font-black uppercase tracking-tight ${isDead ? 'text-slate-500' : 'text-white'}`}>{String(p.name)}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">{isDead ? 'Павший' : `${String(cards.length)}/${String(CARD_POOL_SIZE)} карт`}</p>
          </div>
          <div className="flex gap-3">
            {Array.from({ length: CARD_POOL_SIZE }).map((_, i) => {
              const card = cards[i];
              if (!card) {
                return (
                  <div key={i} className="w-16 h-20 rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/30 flex items-center justify-center">
                    <span className="text-slate-700 text-xl font-black">+</span>
                  </div>
                );
              }
              if (isDead) {
                // Карты павшего бойца — пустые рубашки с черепом
                return (
                  <div key={i} className="relative w-16 h-20 rounded-xl border-2 border-slate-700 bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center opacity-50">
                    <span className="text-2xl" style={{ opacity: 0.4 }}>💀</span>
                  </div>
                );
              }
              const glow = RARITY_GLOW[card.rarity] || '#64748b';
              const isNew = card.id === newCardId;
              const isHover = hoveredId === card.id;
              return (
                <div
                  key={i}
                  onMouseEnter={onHoverCard ? (e) => onHoverCard(card, e) : undefined}
                  onMouseLeave={onHoverCard ? () => onHoverCard(null, null) : undefined}
                  className={`relative w-16 h-20 rounded-xl border-2 bg-slate-800 flex flex-col items-center justify-center gap-0.5 transition-transform duration-150 ${isNew ? 'animate-bounce' : ''} ${isHover ? 'scale-110 z-10' : ''}`}
                  style={{ borderColor: isHover ? '#ffffff' : glow, boxShadow: isNew || isHover ? `0 0 25px ${glow}` : `inset 0 0 12px ${glow}33` }}
                >
                  {isNew && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-20 bg-amber-500 text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase whitespace-nowrap shadow-lg pointer-events-none">Новая</div>
                  )}
                  <span className="text-2xl drop-shadow-lg">{String(card.icon)}</span>
                  <span className="text-[9px] font-black uppercase" style={{ color: glow }}>ур.{String(getCardLevel(card))}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    })}
  </div>
);

const SquadSlotsPopup = ({ players, pools, newCardId, onClose }) => {
  const [showPrompt, setShowPrompt] = useState(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const t = setTimeout(() => setShowPrompt(true), 1200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!showPrompt) return;
    const advance = () => onCloseRef.current();
    window.addEventListener('keydown', advance);
    window.addEventListener('pointerdown', advance);
    return () => {
      window.removeEventListener('keydown', advance);
      window.removeEventListener('pointerdown', advance);
    };
  }, [showPrompt]);

  return (
    <div className="absolute inset-0 z-[2600] bg-black/92 flex flex-col items-center justify-center backdrop-blur-xl animate-in fade-in duration-300">
      <h2 className="text-4xl font-black text-amber-400 uppercase italic tracking-tighter mb-1 text-center drop-shadow-2xl">Новая карта в колоде!</h2>
      <p className="text-slate-500 text-xs uppercase tracking-[0.3em] mb-8 text-center">Пулл карт отряда · {String(CARD_POOL_SIZE)} слота на бойца</p>

      <SquadSlotsBoard players={players} pools={pools} newCardId={newCardId} />

      {showPrompt && (
        <div className="absolute bottom-10 left-0 right-0 flex justify-center animate-in fade-in duration-500">
          <p className="text-slate-200 text-sm uppercase tracking-[0.3em] font-black animate-pulse drop-shadow-[0_0_10px_rgba(0,0,0,0.9)]">Нажмите любую клавишу чтобы продолжить</p>
        </div>
      )}
    </div>
  );
};

// --- ЭКРАН СМЕРТИ: автопродажа хлама -> огоньки души ---

const DeathScreen = ({ items, startProgress = 0, threshold = EMBER_JUNK_THRESHOLD, onDone }) => {
  // Хлам копится в ГЛОБАЛЬНУЮ шкалу, продолжая её с предыдущего забега (startProgress).
  // При пересечении порога выдаётся огонёк, остаток переносится дальше.
  const junkPoints = useMemo(() => sumJunkPoints(items), [items]);
  const totalPoints = startProgress + junkPoints;

  // acc — текущее анимированное значение очков (от startProgress до totalPoints)
  const [acc, setAcc] = useState(startProgress);
  const [phase, setPhase] = useState(junkPoints > 0 ? 'selling' : 'done'); // selling | done

  useEffect(() => {
    if (phase !== 'selling') return;
    const DURATION = 2200;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / DURATION);
      setAcc(startProgress + t * junkPoints);
      if (t < 1) raf = requestAnimationFrame(tick);
      else { setAcc(totalPoints); setPhase('done'); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, startProgress, junkPoints, totalPoints]);

  const embersBefore = Math.floor(startProgress / threshold);
  const shownEmbers = Math.floor(acc / threshold) - embersBefore;
  const barValue = Math.floor(acc % threshold);
  const barFill = (acc % threshold) / threshold;
  const sellFraction = junkPoints > 0 ? (acc - startProgress) / junkPoints : 1;
  const soldCount = Math.round(sellFraction * items.length);

  return (
    <div className="absolute inset-0 z-[2000] bg-red-950/85 flex flex-col items-center justify-center backdrop-blur-xl animate-in fade-in duration-700 p-6">
      <h1 className="text-7xl font-black text-white drop-shadow-[0_0_40px_rgba(239,68,68,1)] mb-2 tracking-tighter uppercase italic text-center">ОТРЯД ПАЛ</h1>
      <p className="text-lg text-red-300 font-bold uppercase tracking-[0.4em] mb-10 text-center">Уровень обнулён · снаряжение обращается в пепел</p>

      {/* Хлам на продажу */}
      <div className="flex flex-col items-center gap-4 mb-8">
        <p className="text-xs text-slate-400 uppercase tracking-[0.3em] font-black">Накопленный хлам: {String(items.length)}</p>
        <div className="flex gap-2 flex-wrap justify-center max-w-xl min-h-[3.5rem]">
          {items.map((item, i) => (
            <div key={i} className={`w-12 h-12 rounded-lg border overflow-hidden transition-all duration-300 ${i < soldCount ? 'opacity-15 grayscale scale-75' : 'border-slate-600'}`}>
              <ItemIcon item={item} className="w-full h-full" />
            </div>
          ))}
          {items.length === 0 && <p className="text-slate-600 text-sm italic">Пусто — нечего продавать</p>}
        </div>

        {/* Глобальная шкала прогресса огонька души: [текущее] / [порог] */}
        <div className="w-96 flex flex-col gap-1">
          <div className="flex justify-between text-[10px] uppercase tracking-[0.25em] font-black text-amber-300/80">
            <span>Шкала огонька души</span>
            <span>{String(barValue)} / {String(threshold)}</span>
          </div>
          <div className="w-full h-4 bg-slate-900/80 rounded-full border border-slate-700 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-600 to-amber-300 rounded-full transition-none" style={{ width: `${barFill * 100}%` }}></div>
          </div>
        </div>

        {/* Огоньки души */}
        <div className={`flex items-center gap-3 transition-all duration-500 ${shownEmbers > 0 || phase === 'done' ? 'opacity-100 scale-100' : 'opacity-30 scale-90'}`}>
          <span className="text-4xl drop-shadow-[0_0_15px_rgba(96,165,250,0.9)]">🔥</span>
          <span className="text-4xl font-black text-sky-300 drop-shadow-[0_0_15px_rgba(96,165,250,0.7)]">+{String(shownEmbers)}</span>
          <span className="text-xs text-sky-400/80 uppercase tracking-[0.25em] font-black self-end pb-1.5">Огоньки души</span>
        </div>
      </div>

      {phase === 'done' && (
        <button onClick={onDone} className="px-16 py-6 bg-white text-red-900 rounded-full font-black text-2xl hover:scale-110 active:scale-95 transition-all shadow-[0_0_30px_rgba(255,255,255,0.4)] uppercase tracking-tighter animate-in fade-in zoom-in-95 duration-500">Принять судьбу</button>
      )}
    </div>
  );
};

// --- ЭКРАН ПОДГОТОВКИ: покупка стартовых карт за огоньки души ---

const PrepScreen = ({ players, pools, soulEmbers, soulProgress = 0, emberThreshold = EMBER_JUNK_THRESHOLD, prepCardsBought, onBuyCard, onBurnCard, onStart }) => {
  const phrase = useMemo(() => GOTHIC_PHRASES[Math.floor(Math.random() * GOTHIC_PHRASES.length)], []);
  const bgSplash = useMemo(() => pickColdSplash(), []);

  const slotPrice = getPrepSlotPrice(prepCardsBought);
  const hasEmptySlot = players.some(p => (pools[p.id] || []).length < CARD_POOL_SIZE);
  const canBuyMore = prepCardsBought < PREP_MAX_BUYS && hasEmptySlot && soulEmbers >= slotPrice;

  // Покупка слота: карта определяется системой автоматически и случайно (см. buyPrepCard)
  const buySlot = (heroId) => {
    if (!canBuyMore) return;
    onBuyCard(heroId);
  };

  return (
    <div className="absolute inset-0 z-[2000] animate-in fade-in duration-500 overflow-hidden">
      {/* Непрозрачная база перекрывает боевую сцену: на фоне виден только шейдер + картинка */}
      <div className="absolute inset-0 bg-slate-950" />
      <ShaderBackground hue={bgSplash.hue} sat={bgSplash.sat} speed={0.4} embedded />
      <ImageBackground imageUrl={bgSplash.url} hue={bgSplash.hue} sat={bgSplash.sat} embedded opacity={0.9} />
      <div className="relative z-10 flex flex-col items-center justify-center p-6 overflow-y-auto custom-scrollbar min-h-full">
        <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter mb-3 text-center drop-shadow-2xl">Подготовка к вылазке</h2>
        <p className="text-slate-200 italic text-xl max-w-2xl text-center mb-2 leading-relaxed font-medium drop-shadow-lg">«{phrase}»</p>

        <div className="flex items-center gap-6 mb-8 mt-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl drop-shadow-[0_0_12px_rgba(96,165,250,0.9)]">🔥</span>
            <span className="text-2xl font-black text-sky-300">{String(soulEmbers)}</span>
            <span className="text-[10px] text-sky-400/80 uppercase tracking-[0.25em] font-black self-end pb-1">Огоньки души</span>
          </div>
          {/* Глобальная шкала прогресса: переносится между забегами */}
          <div className="flex flex-col gap-1 w-44">
            <div className="flex justify-between text-[9px] uppercase tracking-[0.2em] font-black text-amber-300/70">
              <span>След. огонёк</span>
              <span>{String(soulProgress)} / {String(emberThreshold)}</span>
            </div>
            <div className="w-full h-2.5 bg-slate-900/80 rounded-full border border-slate-700 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-600 to-amber-300 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (soulProgress / emberThreshold) * 100)}%` }}></div>
            </div>
          </div>
          <span className="text-xs text-slate-400 uppercase tracking-widest font-black">Следующий слот: {String(slotPrice)} 🔥</span>
        </div>

        <div className="flex flex-col gap-4 mb-10">
          {players.map(p => {
            const cards = pools[p.id] || [];
            return (
              <div key={p.id} className="flex items-center gap-6 bg-slate-900/60 backdrop-blur-md border border-slate-700/60 rounded-3xl px-8 py-3 min-w-[560px] animate-in slide-in-from-bottom-4 fade-in duration-500">
                <div className="w-[100px] h-[100px] overflow-hidden flex items-end justify-center shrink-0">
                  <CharSprite atlas={CHAR_ATLASES[p.id]} size={100} {...CHAR_COLORIZE[p.id]} />
                </div>
                <div className="w-28 shrink-0">
                  <p className="font-black uppercase tracking-tight text-white">{String(p.name)}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest">{String(cards.length)}/{String(CARD_POOL_SIZE)} карт</p>
                </div>
                <div className="flex gap-3">
                  {Array.from({ length: CARD_POOL_SIZE }).map((_, i) => {
                    const card = cards[i];
                    if (card) {
                      const glow = RARITY_GLOW[card.rarity] || '#64748b';
                      return (
                        <div key={i} className="relative group w-16 h-20 rounded-xl border-2 bg-slate-800 flex flex-col items-center justify-center gap-0.5" style={{ borderColor: glow, boxShadow: `inset 0 0 12px ${glow}33` }}>
                          <span className="text-2xl drop-shadow-lg">{String(card.icon)}</span>
                          <span className="text-[9px] font-black uppercase" style={{ color: glow }}>ур.{String(getCardLevel(card))}</span>
                          <button
                            type="button"
                            onClick={() => soulEmbers >= PREP_BURN_COST && onBurnCard(card.id)}
                            disabled={soulEmbers < PREP_BURN_COST}
                            title={soulEmbers >= PREP_BURN_COST ? 'Сжечь карту (1 🔥)' : 'Нужен 1 огонёк души'}
                            className={`absolute -top-2 -right-2 w-6 h-6 rounded-full border text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-110 transition-all shadow-lg z-10 ${soulEmbers >= PREP_BURN_COST ? 'bg-red-900 border-red-500 cursor-pointer' : 'bg-slate-800 border-slate-600 opacity-40 cursor-not-allowed'}`}
                          >🔥</button>
                        </div>
                      );
                    }
                    const isFirstEmpty = i === cards.length;
                    if (isFirstEmpty) {
                      const canBuy = canBuyMore && cards.length < CARD_POOL_SIZE;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={canBuy ? () => buySlot(p.id) : undefined}
                          disabled={!canBuy}
                          className={`relative w-16 h-20 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${canBuy ? 'border-sky-400 bg-sky-950/40 hover:scale-110 hover:shadow-[0_0_20px_rgba(56,189,248,0.5)] cursor-pointer' : 'border-slate-700 bg-slate-800/30 opacity-50 cursor-not-allowed'}`}
                        >
                          <span className="text-xl">🔥</span>
                          <span className={`text-[10px] font-black uppercase ${canBuy ? 'text-sky-300' : 'text-slate-500'}`}>{String(slotPrice)}</span>
                        </button>
                      );
                    }
                    return (
                      <div key={i} className="w-16 h-20 rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/30 flex items-center justify-center">
                        <span className="text-slate-700 text-xl font-black">+</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <button type="button" onClick={onStart} className="px-16 py-5 bg-white text-slate-900 rounded-full font-black text-2xl hover:scale-110 active:scale-95 transition-all shadow-[0_0_30px_rgba(255,255,255,0.4)] uppercase tracking-tighter">Старт</button>
      </div>
    </div>
  );
};

// --- СЕКВЕНЦИЯ РАСКРЫТИЯ ПОЛУЧЕННОЙ КАРТЫ (открытие слота) ---
// Фаза 1: карта появляется рубашкой к игроку. Фаза 2: саспенс — масштаб нарастает
// (easeInCubic). Фаза 3: на пике карта переворачивается, показывая лицо. Длительность ~3с.
const CardRevealOverlay = ({ card, owner, bgHue = 260, bgSat = 60, onDismiss }) => {
  const [scale, setScale] = useState(0.4);
  const [flipped, setFlipped] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [shake, setShake] = useState({ x: 0, y: 0, rot: 0 });
  const canDismissRef = useRef(false);

  useEffect(() => {
    playSound('./assets/sfx/ui/card_deal.wav', 0.5);
    const GROW_MS = 1850;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / GROW_MS);
      const eased = t * t * t; // easeInCubic — нарастание «напряжения»
      setScale(0.4 + eased * 0.6);
      // Шейк нарастает по мере увеличения карты (фаза «саспенса», карта ещё рубашкой)
      const amp = t * t * 9; // амплитуда растёт квадратично
      setShake({
        x: (Math.random() - 0.5) * 2 * amp,
        y: (Math.random() - 0.5) * 2 * amp,
        rot: (Math.random() - 0.5) * 2 * amp * 0.35,
      });
      if (t < 1) raf = requestAnimationFrame(tick);
      else setShake({ x: 0, y: 0, rot: 0 });
    };
    raf = requestAnimationFrame(tick);
    const tFlip = setTimeout(() => { setFlipped(true); setShake({ x: 0, y: 0, rot: 0 }); playSound('./assets/sfx/game/level_up.wav'); }, GROW_MS);
    const tPrompt = setTimeout(() => { setShowPrompt(true); canDismissRef.current = true; }, 3000);
    return () => { cancelAnimationFrame(raf); clearTimeout(tFlip); clearTimeout(tPrompt); };
  }, []);

  useEffect(() => {
    const handler = () => { if (canDismissRef.current) onDismiss(); };
    window.addEventListener('keydown', handler);
    window.addEventListener('pointerdown', handler);
    return () => { window.removeEventListener('keydown', handler); window.removeEventListener('pointerdown', handler); };
  }, [onDismiss]);

  const handleMove = (e) => {
    if (!canDismissRef.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    setTilt({ x: ((r.height / 2 - py) / (r.height / 2)) * 9, y: ((px - r.width / 2) / (r.width / 2)) * 9 });
  };

  const glow = RARITY_GLOW[card.rarity] || '#64748b';

  return (
    <div className="absolute inset-0 z-[2600] overflow-hidden flex flex-col items-center justify-center animate-in fade-in duration-300">
      <ShaderBackground hue={bgHue} sat={bgSat} speed={0.6} embedded />
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />
      <div className="relative" style={{ perspective: '1400px' }} onMouseMove={handleMove} onMouseLeave={() => setTilt({ x: 0, y: 0 })}>
        {/* Внешний слой: шейк (rAF) + масштаб (rAF) + наклон мышью */}
        <div style={{ transformStyle: 'preserve-3d', transform: `translate(${shake.x}px, ${shake.y}px) rotate(${shake.rot}deg) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${scale})` }}>
          {/* Внутренний слой: переворот лицо/рубашка */}
          <div
            className="w-52 h-[290px] relative"
            style={{ transformStyle: 'preserve-3d', transform: `rotateY(${flipped ? 0 : 180}deg)`, transition: 'transform 600ms cubic-bezier(0.34, 1.2, 0.64, 1)' }}
          >
            {/* Лицо карты — как в бою */}
            <div className="absolute inset-0 rounded-2xl overflow-hidden" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', boxShadow: `0 0 55px ${glow}` }}>
              <AbilityCard card={card} owner={owner} mana={5} maxMana={5} isDisabled={false} comboState={{ isCandidate: false, willGiveBonus: false }} />
            </div>
            {/* Рубашка */}
            <div
              className="absolute inset-0 rounded-2xl border-2 border-slate-600 bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center"
              style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', boxShadow: 'inset 0 0 40px rgba(0,0,0,0.7)' }}
            >
              <img src="./corner.png" alt="" aria-hidden="true" className="absolute top-1.5 left-1.5 w-16 h-16 opacity-40 pointer-events-none" />
              <img src="./corner.png" alt="" aria-hidden="true" className="absolute bottom-1.5 right-1.5 w-16 h-16 opacity-40 pointer-events-none" style={{ transform: 'scale(-1)' }} />
              <span className="text-7xl opacity-25 select-none">✦</span>
            </div>
          </div>
        </div>
      </div>
      {showPrompt && (
        <p className="absolute bottom-16 text-slate-200 text-sm uppercase tracking-[0.35em] font-black animate-pulse drop-shadow-[0_0_12px_rgba(0,0,0,0.95)]">Нажмите любую кнопку</p>
      )}
    </div>
  );
};

// --- ОКНО КОЛОДЫ: пуллы бойцов + живая очередь ротации карт ---

const DeckWindow = ({ players, pools, drawPile, discardPile, maxMana, onClose }) => {
  // Двусторонняя подсветка: слот бойца <-> карта в очереди + тултип с реальной картой
  const [hoverId, setHoverId] = useState(null);
  const [tooltip, setTooltip] = useState(null); // { card, x, top, bottom }

  const handleHoverCard = (card, e) => {
    if (!card) { setHoverId(null); setTooltip(null); return; }
    setHoverId(card.id);
    const r = e.currentTarget.getBoundingClientRect();
    setTooltip({ card, x: r.left + r.width / 2, top: r.top, bottom: r.bottom });
  };

  // Слоты павших — статичные рубашки 💀 без номеров: в руке на месте бойца,
  // в колоде — закреплены в хвосте секции (в ротации не участвуют, не двигаются).
  // Живые карты показываются в реальном порядке drawPile со сквозной нумерацией.
  const deadIds = new Set(players.filter(p => p.hp <= 0).map(p => p.id));
  const aliveCount = players.length - deadIds.size;
  const liveDiscard = discardPile.filter(c => !deadIds.has(c.ownerId));

  let queueNum = 0;
  const handSlots = players.map(p => {
    const isDead = p.hp <= 0;
    return {
      player: p,
      isDead,
      card: !isDead && isDeckCard(p.currentCard) ? p.currentCard : null,
      num: isDead ? null : ++queueNum,
    };
  });

  // По 2 позиции ротации на живого бойца (3-я карта в руке)
  const liveDeckLen = aliveCount * (CARD_POOL_SIZE - 1);
  const liveDraw = drawPile.filter(c => !deadIds.has(c.ownerId));
  const deckSlots = liveDraw.slice(0, liveDeckLen).map(c => ({ card: c, num: ++queueNum }));
  while (deckSlots.length < liveDeckLen) deckSlots.push({ gone: true, num: ++queueNum });
  // Хвост очереди: статичные черепа павших (по 2 на бойца), без номеров
  players.filter(p => p.hp <= 0).forEach(p => {
    for (let k = 0; k < CARD_POOL_SIZE - 1; k++) deckSlots.push({ isDead: true, player: p });
  });

  const discardSlotCount = Math.max(1, aliveCount);
  const recentDiscards = liveDiscard.slice(-discardSlotCount);
  const discardSlots = Array.from({ length: discardSlotCount }, (_, i) => {
    const startIdx = discardSlotCount - recentDiscards.length;
    const card = i >= startIdx ? recentDiscards[i - startIdx] : null;
    const opacity = discardSlotCount === 1 ? 1 : 0.35 + i * (0.65 / Math.max(1, discardSlotCount - 1));
    return { card, opacity };
  });

  return (
    <div className="absolute inset-0 z-[1100] bg-black/45 flex flex-col items-center justify-center backdrop-blur-md animate-in fade-in duration-300 p-10">
      <div className="relative w-full max-w-5xl bg-slate-900/80 border border-slate-700 rounded-[32px] flex flex-col max-h-[85vh] overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
           <div>
             <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic">Колода</h2>
             <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">Пулл карт отряда · {String(CARD_POOL_SIZE)} слота на бойца · карт {String(DECK_SIZE)}</p>
           </div>
           <button onClick={onClose} className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-white hover:bg-red-900 hover:border-red-500 transition-all group">
             <span className="text-2xl group-hover:scale-125 transition-transform">✕</span>
           </button>
        </div>
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar flex flex-col items-center gap-8">
           <SquadSlotsBoard players={players} pools={pools} hoveredId={hoverId} onHoverCard={handleHoverCard} />
           <div className="w-full border-t border-slate-800 pt-6 flex flex-col items-center">
             <div className="flex gap-3 justify-center items-end">
               {/* Секция «Рука» — первые позиции общей очереди */}
               <div className="flex flex-col items-center gap-2">
                 <p className="text-[10px] text-sky-400 uppercase tracking-[0.3em] font-black">Рука</p>
                 <div className="flex gap-3">
                   {handSlots.map(({ player, card, isDead, num }, i) => {
                     const isHover = card && hoverId === card.id;
                     const accent = HERO_ACCENT[player.id] || '#64748b';
                     const numBadge = () => (
                       <span className="absolute -top-2 -left-1 w-5 h-5 rounded-full bg-slate-900 border text-[9px] font-black flex items-center justify-center z-10" style={{ borderColor: accent, color: accent }}>{String(num)}</span>
                     );
                     if (isDead) {
                       return (
                         <div key={`h-dead-${player.id}`} className="relative w-16 h-20 rounded-xl border-2 bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center opacity-50" style={{ borderColor: `${accent}66`, filter: 'brightness(0.9)' }}>
                           <span className="text-2xl" style={{ opacity: 0.4 }}>💀</span>
                         </div>
                       );
                     }
                     if (!card || isEmptyCard(card)) {
                       // Базовая атака / пустая карта — рубашка с акцентом героя
                       return (
                         <div key={`h-basic-${player.id}`} className="relative w-16 h-20 rounded-xl border-2 bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center opacity-70" style={{ borderColor: `${accent}88`, boxShadow: `inset 0 0 12px ${accent}22` }}>
                           {numBadge()}
                           <span className="text-2xl" style={{ opacity: 0.2 }}>🙨</span>
                         </div>
                       );
                     }
                     const glow = RARITY_GLOW[card.rarity] || '#64748b';
                     return (
                       <div
                         key={`h-${card.id}-${i}`}
                         onMouseEnter={(e) => handleHoverCard(card, e)}
                         onMouseLeave={() => handleHoverCard(null, null)}
                         className={`relative w-16 h-20 rounded-xl border-2 bg-slate-800 flex flex-col items-center justify-center gap-0.5 transition-transform duration-150 ${isHover ? 'scale-110 z-10' : ''}`}
                         style={{ borderColor: isHover ? '#ffffff' : accent, boxShadow: isHover ? `0 0 25px ${accent}` : `inset 0 0 12px ${glow}55` }}
                       >
                         {numBadge()}
                         <span className="text-2xl drop-shadow-lg">{String(card.icon)}</span>
                         <span className="text-[9px] font-black uppercase" style={{ color: glow }}>ур.{String(getCardLevel(card))}</span>
                       </div>
                     );
                   })}
                 </div>
               </div>

               {/* Разделитель рука | колода */}
               <div className="w-px h-16 bg-slate-700 mx-2 shrink-0"></div>

               {deckSlots.map((slot, i) => {
                 const { card, gone, isDead, player, num } = slot;
                 const isHover = card && hoverId === card.id;
                 const numBadge = (color, border) => (
                   <span className="absolute -top-2 -left-1 w-5 h-5 rounded-full bg-slate-900 border text-[9px] font-black flex items-center justify-center z-10" style={{ borderColor: border, color }}>{String(num)}</span>
                 );
                 if (isDead) {
                   const accent = HERO_ACCENT[player.id] || '#64748b';
                   return (
                     <div key={`q-dead-${player.id}-${i}`} className="relative w-16 h-20 rounded-xl border-2 bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center opacity-50" style={{ borderColor: `${accent}66`, filter: 'brightness(0.9)' }}>
                       <span className="text-2xl" style={{ opacity: 0.4 }}>💀</span>
                     </div>
                   );
                 }
                 if (gone) {
                   // Слот карты, ушедшей в сброс — рубашка с ⧖ до обновления колоды
                   return (
                     <div key={`q-gone-${i}`} className="relative w-16 h-20 rounded-xl border-2 border-slate-700 bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center opacity-50" style={{ filter: 'brightness(0.9)' }}>
                       {numBadge('#475569', '#334155')}
                       <span className="text-2xl text-slate-300">⧖</span>
                     </div>
                   );
                 }
                 if (isEmptyCard(card)) {
                   // Пустая карта-балласт в колоде — рубашка с 🙨
                   return (
                     <div key={`q-empty-${card.id}-${i}`} className="relative w-16 h-20 rounded-xl border-2 border-slate-700 bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center">
                       {numBadge('#475569', '#334155')}
                       <span className="text-2xl" style={{ opacity: 0.2 }}>🙨</span>
                     </div>
                   );
                 }
                 const glow = RARITY_GLOW[card.rarity] || '#64748b';
                 return (
                   <div
                     key={`q-${card.id}-${i}`}
                     onMouseEnter={(e) => handleHoverCard(card, e)}
                     onMouseLeave={() => handleHoverCard(null, null)}
                     className={`relative w-16 h-20 rounded-xl border-2 bg-slate-800 flex flex-col items-center justify-center gap-0.5 transition-transform duration-150 ${isHover ? 'scale-110 z-10' : ''}`}
                     style={{ borderColor: isHover ? '#ffffff' : glow, boxShadow: isHover ? `0 0 25px ${glow}` : `inset 0 0 12px ${glow}33` }}
                   >
                     {numBadge(glow, glow)}
                     <span className="text-2xl drop-shadow-lg">{String(card.icon)}</span>
                     <span className="text-[9px] font-black uppercase" style={{ color: glow }}>ур.{String(getCardLevel(card))}</span>
                   </div>
                 );
               })}

               {/* Разделитель колода | сброс */}
               <div className="w-px h-16 bg-slate-700 mx-2 shrink-0"></div>

               {/* Секция «Сброс» */}
               <div className="flex flex-col items-center gap-2">
                 <p className="text-[10px] text-red-400 uppercase tracking-[0.3em] font-black">Сброс</p>
                 <div className="flex gap-3">
               {discardSlots.map(({ card, opacity }, i) => {
                 const isHover = card && hoverId === card.id;
                 if (!card) {
                   return (
                     <div key={`d-pad-${i}`} className="relative w-16 h-20 rounded-xl border-2 border-red-900/40 bg-gradient-to-br from-red-950/30 to-slate-950 flex items-center justify-center" style={{ opacity }}>
                       <span className="text-2xl text-red-400/40">⧖</span>
                     </div>
                   );
                 }
                 const showFace = isRealDeckCard(card);
                 return (
                   <div
                     key={`d-${card.id}-${i}`}
                     onMouseEnter={showFace ? (e) => handleHoverCard(card, e) : undefined}
                     onMouseLeave={showFace ? () => handleHoverCard(null, null) : undefined}
                     className={`relative w-16 h-20 rounded-xl border-2 bg-red-950/60 flex flex-col items-center justify-center gap-0.5 transition-transform duration-150 ${isHover ? 'scale-110 z-10' : ''}`}
                     style={{ borderColor: '#ef4444', boxShadow: isHover ? '0 0 25px #ef4444' : 'inset 0 0 12px #ef444433', opacity: isHover ? 1 : opacity }}
                   >
                     {showFace ? (
                       <>
                         <span className="text-2xl drop-shadow-lg" style={{ filter: 'grayscale(0.4)' }}>{String(card.icon)}</span>
                         <span className="text-[9px] font-black uppercase text-red-400">ур.{String(getCardLevel(card))}</span>
                       </>
                     ) : (
                       <span className="text-2xl text-red-400/70">🙨</span>
                     )}
                   </div>
                 );
               })}
                 </div>
               </div>
             </div>
           </div>
        </div>
      </div>
      <div className="absolute inset-0 -z-10" onClick={onClose}></div>

      {tooltip && (() => {
        // Тултип с реальной картой: над мини-картой, если не влезает — под ней; по X — в пределах экрана
        const TIP_W = 192, TIP_H = 270, PAD = 8;
        const placeAbove = tooltip.top - TIP_H - PAD >= 0;
        const top = placeAbove ? tooltip.top - TIP_H - PAD : tooltip.bottom + PAD;
        const left = Math.min(Math.max(tooltip.x - TIP_W / 2, PAD), window.innerWidth - TIP_W - PAD);
        return (
          <div className="fixed z-[1300] pointer-events-none animate-in fade-in zoom-in-95 duration-150" style={{ left, top, width: TIP_W, height: TIP_H }}>
            <AbilityCard card={tooltip.card} owner={players.find(p => p.id === tooltip.card.ownerId)} mana={maxMana} maxMana={maxMana} isDisabled={false} showOwnerLabel={true} comboState={{ isCandidate: false, willGiveBonus: false }} />
          </div>
        );
      })()}
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
  const splash = useMemo(() => pickColdSplash(), []);

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
    <div className="fixed inset-0 z-[3000] bg-[#17191C] flex flex-col items-center justify-center overflow-hidden">
      {/* Сплеш: те же параметры что в бою (маска+градиент), но случайная локация и случайный холодный оттенок */}
      <ImageBackground imageUrl={splash.url} hue={splash.hue} sat={splash.sat} opacity={0.8} />
      <img src="./corner.png" alt="" aria-hidden="true" className="pointer-events-none select-none absolute top-0 left-0 w-[300px] h-[300px] opacity-60" />
      <img src="./corner.png" alt="" aria-hidden="true" className="pointer-events-none select-none absolute top-0 right-0 w-[300px] h-[300px] opacity-60" style={{ transform: 'scaleX(-1)' }} />
      <img src="./corner.png" alt="" aria-hidden="true" className="pointer-events-none select-none absolute bottom-0 left-0 w-[300px] h-[300px] opacity-60" style={{ transform: 'scaleY(-1)' }} />
      <img src="./corner.png" alt="" aria-hidden="true" className="pointer-events-none select-none absolute bottom-0 right-0 w-[300px] h-[300px] opacity-60" style={{ transform: 'scale(-1, -1)' }} />

      <h1 className="text-6xl md:text-7xl font-black text-amber-500 uppercase italic tracking-widest mb-3 text-center drop-shadow-[0_0_30px_rgba(245,158,11,0.6)]">Card Battler</h1>
      <p className="text-slate-500 text-xs uppercase tracking-[0.5em] mb-12">Подготовка к спуску</p>

      <div className="w-[min(80vw,420px)]">
        <div className="h-3 w-full bg-slate-800/80 rounded-full overflow-hidden border border-slate-700 shadow-inner">
          <div
            className="h-full bg-white transition-all duration-300 ease-out"
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
  
  const [drawPile, setDrawPile] = useState(() => createInitialDeck());
  const [discardPile, setDiscardPile] = useState([]);
  const [xp, setXp] = useState(0);
  const [playerLevel, setPlayerLevel] = useState(1); 
  const [xpToNext, setXpToNext] = useState(60);
  // Мета-валюта: переживает смерть, тратится на стартовые карты на экране подготовки
  const [soulEmbers, setSoulEmbers] = useState(0);
  // Глобальная шкала прогресса огонька души (очки хлама): переносится между забегами,
  // не сгорает при смерти; остаток сверх порога копится дальше.
  const [soulProgress, setSoulProgress] = useState(0);
  // Очередь невыбранных левелапов: каждый полученный уровень = 1 выбор карт по очереди
  const [levelUpQueue, setLevelUpQueue] = useState(0);
  const [showPrep, setShowPrep] = useState(false);
  const [prepCardsBought, setPrepCardsBought] = useState(0);
  // Секвенция раскрытия полученной карты: { card, owner } | null
  const [cardReveal, setCardReveal] = useState(null);
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
  const sectorRef = useRef(sector);
  const currentStageRef = useRef(currentStage);
  useEffect(() => { sectorRef.current = sector; }, [sector]);
  useEffect(() => { currentStageRef.current = currentStage; }, [currentStage]);
  const [bgLocation, setBgLocation] = useState(() => pickBgLocation(1, 0));

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
  const [rewardTitle, setRewardTitle] = useState('УРОВЕНЬ ПОВЫШЕН!');
  // Попап «слоты отряда» после добавления новой карты: { newCardId }
  const [slotsPopup, setSlotsPopup] = useState(null);
  const [showReserve, setShowReserve] = useState(false);
  const [appReady, setAppReady] = useState(false);
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
  // Счётчик раздач: каждые 3 хода колода обновляется (сброс замешивается в резерв)
  const dealCounterRef = useRef(0);

  const [isAnimating, setIsAnimating] = useState(false);
  const [animatingPlayerId, setAnimatingPlayerId] = useState(null);
  const [animatingEnemyId, setAnimatingEnemyId] = useState(null);
  // Реальный вектор прыжка атакующего (в px, вычисляется из рефов)
  const [attackTranslate, setAttackTranslate] = useState({ dx: 0, dy: 0 });
  const [enemyAttackTranslate, setEnemyAttackTranslate] = useState({ dx: 0, dy: 0 });
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
    setBgLocation(pickBgLocation(sector, node.stage));

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
           if (p.id === 'p1') updated.str = Math.round(updated.str * 1.02);
           if (p.id === 'p2') updated.agi = Math.round(updated.agi * 1.02);
           if (p.id === 'p3') updated.int = Math.round(updated.int * 1.02);
           const maxHp = getMaxHpFromStats(updated);
           const hpGain = maxHp - p.maxHp;
           return syncPlayerMaxHp({ ...updated, hp: p.hp + Math.max(0, hpGain) });
        }));
     } else if (powerupId === 'hp') {
        setPlayers(prev => prev.map(p => {
           const bonus = Math.floor(p.maxHp * 0.5);
           return syncPlayerMaxHp({ ...p, baseMaxHp: (p.baseMaxHp ?? p.maxHp) + bonus, hp: p.hp + bonus });
        }));
     } else if (powerupId === 'cards') {
        playSound('./assets/sfx/events/powerup_select.wav');
        setCompletedNodes(prev => [...prev, currentMapNodeId]);
        setTurnState('map');
        setCurrentEvent(null);
        // открываем тот же выбор из 3 карт, что и на level-up
        setRewardTitle('ДРЕВНИЙ ФОЛИАНТ');
        setRewardOptions(buildLevelUpOptions());
        setShowLevelUp(true);
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
    // Считаем шаг комбо так же, как playCard: если карта продолжит серию — шаг +1
    const willCombo = lastPlayedCost !== null && player.currentCard.cost === lastPlayedCost + 1;
    const prospectiveStep = willCombo ? comboStreak + 1 : 0;
    const targetIndices = getTargets(player.currentCard, playerIndex, enemies, prospectiveStep);
    setHoveredTargetIds(targetIndices.map(idx => enemies[idx].id));
  };

  const resetGame = (fullReset = false, advanceSector = false, fromDeath = false) => {
    const nextSector = (fullReset || fromDeath) ? 1 : advanceSector ? sector + 1 : sector;
    setSector(nextSector);

    musicFadeToRandom();

    // Сначала собираем карты с рук (до очистки currentCard)
    let handCards = [];
    players.forEach(p => { if (p.currentCard && isDeckCard(p.currentCard)) handCards.push(p.currentCard); });
    const currentFullDeck = [...drawPile, ...discardPile, ...handCards];

    if (fullReset || fromDeath) {
      // Новая игра или смерть: уровень обнуляется, колода — пустой балласт.
      // При смерти надетый шмот сохраняется (ненадетый продан за огоньки на экране смерти).
      setPlayers(INITIAL_PLAYERS_DATA.map(p => syncPlayerMaxHp({ ...p }, fromDeath ? equipped[p.id] : null)));
      // Уровень/опыт обнуляются. xpToNextRef синхронизируем тут же: он обновляется
      // отложенным эффектом, иначе первый gainXp после смерти взял бы старый порог.
      setXp(0); setXpToNext(60); xpToNextRef.current = 60; setPlayerLevel(1); setMaxMana(5);
      setDrawPile(createInitialDeck()); setDiscardPile([]);
      setInventory(Array(INVENTORY_SIZE).fill(null));
      if (fullReset) setEquipped({ p1: null, p2: null, p3: null });
    } else {
      // Новый сектор: статы, уровень, мана, колода и предметы сохраняются,
      // бойцы воскресают с полным HP
      setPlayers(prev => prev.map(p => syncPlayerMaxHp({
        ...p,
        hp: getMaxHpFromStats(p, equipped[p.id]),
        currentCard: null,
        hasActed: false,
        justDealt: false,
      }, equipped[p.id])));
      setDrawPile(shuffleArray(ensureFullDeck(currentFullDeck)));
      setDiscardPile([]);
    }

    setEnemies([]); setMana(0); setLastPlayedCost(null); setComboStreak(0); setDamagePopups([]); setFlyingXps([]); setFlyingItems([]); setShowLevelUp(false); setSlotsPopup(null); setLevelUpQueue(0); setRewardOptions([]);
    setDragSrcIdx(null); setDragOverPlayerId(null); setItemTooltip(null);
    setShowCraft(false); setCraftSlots([null, null, null]); setCraftWarning('');
    setCurrentEvent(null);
    setBloodParticles([]);
    setFlashingTargets([]);
    setSectorSplash(null);
    pendingTransitionRef.current = null;
    dealCounterRef.current = 0;
    
    if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
    setSpeakingEnemy(null);

    const newMap = generateMap();
    setGameMap(newMap); setCurrentMapNodeId(newMap[0].id); setCompletedNodes([newMap[0].id]); setCurrentStage(0);
    setBgLocation(pickBgLocation(nextSector, 0));
    setTurnState('map');
  };

  // Экран смерти завершён: зачисляем огоньки за проданный хлам, обнуляем забег,
  // открываем экран подготовки (покупка стартовых карт)
  const handleDeathDone = () => {
    const items = inventory.filter(Boolean);
    // Очки хлама добавляются к глобальной шкале; огоньки выдаются за каждый порог,
    // остаток сверх порога переносится на следующий цикл.
    const total = soulProgress + sumJunkPoints(items);
    setSoulEmbers(e => e + Math.floor(total / EMBER_JUNK_THRESHOLD));
    setSoulProgress(total % EMBER_JUNK_THRESHOLD);
    resetGame(false, false, true);
    setPrepCardsBought(0);
    setShowPrep(true);
  };

  // Покупка стартовой карты: система сама случайно выбирает карту из доступного пула
  // героя и заменяет ею пустую карту-балласт в колоде
  const buyPrepCard = (heroId) => {
    const price = getPrepSlotPrice(prepCardsBought);
    if (prepCardsBought >= PREP_MAX_BUYS || soulEmbers < price) return;
    const owned = [...drawPileRef.current, ...discardPileRef.current].filter(c => c.ownerId === heroId && isRealDeckCard(c));
    const ownedKeys = getOwnedSkillKeys(heroId, owned);
    const options = getUnownedSkills(heroId, ownedKeys);
    if (options.length === 0) return;
    const targetEmpty = drawPileRef.current.find(c => isEmptyCard(c) && c.ownerId === heroId);
    if (!targetEmpty) return;
    const skill = options[Math.floor(Math.random() * options.length)];
    const newCard = { ...skill, id: `prep_${Date.now()}_${Math.random()}`, level: 1, skillId: skill.id };
    setDrawPile(prev => prev.map(c => c.id === targetEmpty.id ? newCard : c));
    setSoulEmbers(e => e - price);
    setPrepCardsBought(c => c + 1);
    const owner = players.find(p => p.id === heroId);
    setCardReveal({ card: newCard, owner });
  };

  // Сжечь карту на экране подготовки → −1 огонёк, слот снова пустой (балласт)
  const burnPrepCard = (cardId) => {
    if (soulEmbers < PREP_BURN_COST) return;
    const all = [...drawPileRef.current, ...discardPileRef.current];
    const card = all.find(c => c.id === cardId);
    if (!card || !isRealDeckCard(card)) return;
    const toEmpty = (c) => (c && c.id === cardId) ? createEmptyCard(c.ownerId, 0) : c;
    setDrawPile(prev => prev.map(toEmpty));
    setDiscardPile(prev => prev.map(toEmpty));
    setSoulEmbers(e => e - PREP_BURN_COST);
    playSound('./assets/sfx/ui/card_discard.wav', 0.6);
  };

  const getTargets = useCallback((card, playerIndex, currentEnemies, comboStep = 0) => {
    const alive = currentEnemies.map((e, i) => ({...e, originalIndex: i})).filter(e => !e.isDead);
    if (alive.length === 0) return [];
    // comboSplash: бьёт по площади начиная со 2-й карты комбо (comboStep >= 1)
    if (card.type === 'splash' || (card.comboSplash && comboStep >= 1)) {
      return currentEnemies.map((e, i) => !e.isDead ? i : -1).filter(i => i !== -1);
    }
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
      let total = prev + amount;
      let cur = xpToNextRef.current;
      let levels = 0;
      // За один прирост XP можно перешагнуть сразу несколько уровней —
      // считаем их все, чтобы ни один не потерялся.
      while (total >= cur) {
        total -= cur;
        levels += 1;
        cur += 50;
      }
      if (levels > 0) {
        setXpToNext(cur); xpToNextRef.current = cur;
        setPlayerLevel(l => l + levels);
        setMaxMana(m => m + levels);
        // Рост HP за уровень отряда (вместо отвязанного от статов str→hp)
        setPlayers(prev2 => prev2.map(p => {
          const grow = (HP_PER_LEVEL[p.id] || 5) * levels;
          return { ...p, baseMaxHp: (p.baseMaxHp ?? p.maxHp) + grow, maxHp: p.maxHp + grow, hp: p.hp > 0 ? p.hp + grow : p.hp };
        }));
        // Кладём КАЖДЫЙ уровень в очередь — попап выбора карт откроется по одному разу на уровень
        setLevelUpQueue(q => q + levels);
      }
      return total;
    });
  }, []);

  // Драйвер очереди левелапов: пока есть невыбранные уровни и не открыт другой попап —
  // показываем выбор награды (каждый уровень — отдельный выбор, поочерёдно).
  useEffect(() => {
    if (levelUpQueue <= 0 || showLevelUp || slotsPopup) return;
    const opts = buildLevelUpOptions();
    if (opts.length === 0) { setLevelUpQueue(0); runPendingTransition(); return; }
    setRewardTitle('УРОВЕНЬ ПОВЫШЕН!');
    setRewardOptions(opts);
    setShowLevelUp(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelUpQueue, showLevelUp, slotsPopup]);

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

  // Реальные карты способностей на руках (без базовых и пустых балласт-карт)
  const getRealHandCards = () => players.map(p => p.currentCard).filter(isRealDeckCard);

  // Пуллы карт каждого бойца (только реальные способности, без пустых балласт-карт)
  const getHeroPools = () => {
    const full = [...drawPile, ...discardPile, ...getRealHandCards()];
    const pools = {};
    INITIAL_PLAYERS_DATA.forEach(p => { pools[p.id] = []; });
    full.filter(isRealDeckCard).forEach(c => { if (pools[c.ownerId]) pools[c.ownerId].push(c); });
    Object.keys(pools).forEach(pid => {
      const order = HERO_ABILITIES[pid].skills.map(s => s.name);
      pools[pid].sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
    });
    return pools;
  };

  // Собирает 3 варианта награды: новые карты (пока пулл бойца не полон) и улучшения имеющихся.
  // Когда все пуллы заполнены — остаются только улучшения. Читает состояние через рефы,
  // потому что вызывается из мемоизированного gainXp.
  const buildLevelUpOptions = () => {
    const hand = playersRef.current.map(p => p.currentCard).filter(isRealDeckCard);
    const full = [...drawPileRef.current, ...discardPileRef.current, ...hand];
    const aliveIds = new Set(playersRef.current.filter(p => p.hp > 0).map(p => p.id));
    const candidates = [];
    INITIAL_PLAYERS_DATA.forEach(({ id: pid }) => {
      if (!aliveIds.has(pid)) return;
      const owned = full.filter(c => c.ownerId === pid && isRealDeckCard(c));
      const ownedKeys = getOwnedSkillKeys(pid, owned);
      const unownedSkills = getUnownedSkills(pid, ownedKeys);
      // Новые карты — только если в колоде есть пустой слот И остались уникальные скиллы
      if (owned.length < CARD_POOL_SIZE && unownedSkills.length > 0) {
        unownedSkills.forEach(s => candidates.push({ kind: 'new', card: s }));
      }
      // Улучшения — только для реально имеющихся карт
      owned.forEach(c => candidates.push({ kind: 'upgrade', card: c }));
    });
    return shuffleArray(candidates).slice(0, 3);
  };

  // Выполняет отложенный переход (победа/карта), если он был назначен во время диалога
  const runPendingTransition = () => {
    const pending = pendingTransitionRef.current;
    if (pending) {
      pendingTransitionRef.current = null;
      if (pending === 'victory') { playSound('./assets/sfx/game/victory.wav'); setTurnState('victory'); }
      else setTurnState(pending);
    }
  };

  // Боец погиб: его карты удаляются из ротации (резерв + рука), в сброс не попадают.
  const purgeHeroFromDeck = (heroId, currentCard) => {
    setDrawPile(prev => prev.filter(c => c.ownerId !== heroId));
    setDiscardPile(prev => prev.filter(c => c.ownerId !== heroId));
  };

  // Повышает уровень карты, где бы она ни находилась (резерв, сброс, руки)
  const upgradeCardById = (cardId) => {
    const bump = c => (c && c.id === cardId) ? { ...c, level: getCardLevel(c) + 1 } : c;
    setDrawPile(prev => prev.map(bump));
    setDiscardPile(prev => prev.map(bump));
    setPlayers(prev => prev.map(p => p.currentCard ? { ...p, currentCard: bump(p.currentCard) } : p));
  };

  // Выбор награды на level-up: новая карта в пулл бойца или +1 уровень существующей.
  // Снимаем один уровень с очереди; следующий выбор откроет эффект-драйвер (если очередь не пуста).
  const selectReward = (option) => {
    playSound('./assets/sfx/game/level_up.wav');
    setShowLevelUp(false);
    const remaining = Math.max(0, levelUpQueue - 1);
    setLevelUpQueue(remaining);

    if (option.kind === 'upgrade') {
      upgradeCardById(option.card.id);
      // Если очередь опустела — выполняем отложенный переход; иначе эффект покажет след. уровень
      if (remaining === 0) runPendingTransition();
      return;
    }

    // Защита: мёртвым бойцам карты не выдаём (на случай гибели владельца к моменту выбора)
    const ownerAlive = playersRef.current.some(p => p.id === option.card.ownerId && p.hp > 0);
    if (!ownerAlive) {
      if (remaining === 0) runPendingTransition();
      return;
    }

    const ownerId = option.card.ownerId;
    const hand = playersRef.current.map(p => p.currentCard).filter(isRealDeckCard);
    const full = [...drawPileRef.current, ...discardPileRef.current, ...hand];
    const ownedKeys = getOwnedSkillKeys(ownerId, full.filter(c => c.ownerId === ownerId));
    // Дубликат: скилл уже есть у героя (любой уровень) — не выдаём повторно
    if (heroOwnsSkill(ownerId, option.card, ownedKeys)) {
      if (remaining === 0) runPendingTransition();
      return;
    }

    const newCard = { ...option.card, id: `rew_${Date.now()}_${Math.random()}`, level: 1, skillId: option.card.id };
    // Находим ОДНУ конкретную пустую карту бойца (в резерве или сбросе) и заменяем её по id,
    // чтобы не продублировать награду, если пустые есть в обеих стопках
    const targetEmpty = [...drawPileRef.current, ...discardPileRef.current]
      .find(c => isEmptyCard(c) && c.ownerId === ownerId);
    const replaceById = (pile) => pile.map(c => (targetEmpty && c.id === targetEmpty.id) ? newCard : c);
    setDrawPile(prev => replaceById(prev));
    setDiscardPile(prev => replaceById(prev));
    // Показываем схему слотов отряда; следующий уровень/переход — при закрытии попапа
    setSlotsPopup({ newCardId: newCard.id });
  };

  const closeSlotsPopup = () => {
    setSlotsPopup(null);
    // Очередь пуста — выполняем отложенный переход; иначе эффект откроет следующий выбор
    if (levelUpQueue <= 0) runPendingTransition();
  };

  useEffect(() => {
    if (turnState !== 'dealing' || showLevelUp) return;
    setLastPlayedCost(null); setComboStreak(0);
    // Колода обновляется каждые 3 хода: сброс замешивается среди ВСЕХ существующих карт
    // (резерв + сброс перетасовываются вместе), а не когда резерв опустел.
    const checkAndReshuffle = () => {
      const deadSet = new Set(players.filter(p => p.hp <= 0).map(p => p.id));
      let currentDraw = drawPile.filter(c => !deadSet.has(c.ownerId));
      let currentDiscard = discardPile.filter(c => !deadSet.has(c.ownerId));
      const isRefreshTurn = dealCounterRef.current > 0 && dealCounterRef.current % 3 === 0;
      if (isRefreshTurn && currentDiscard.length > 0) {
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
    dealCounterRef.current += 1;
    const tempDraw = [...currentDraw]; const assignments = {};
    const emptiesToDiscard = [];
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
      const drawn = assignments[p.id];
      let cardToDeal;
      if (drawn && isEmptyCard(drawn)) {
        cardToDeal = HERO_ABILITIES[p.id].basic;
        emptiesToDiscard.push(drawn);
      } else if (drawn) {
        cardToDeal = drawn;
      } else {
        cardToDeal = HERO_ABILITIES[p.id].basic;
      }
      const slotRect = slotRefs.current[p.id]?.getBoundingClientRect();
      if (deckRect && slotRect) {
        const flyId = `deal_${p.id}_${Date.now()}`;
        setTimeout(() => { playSound('./assets/sfx/ui/card_deal.wav', 0.5); setFlyingCards(prev => [...prev, { id: flyId, startX: deckRect.left + deckRect.width/2, startY: deckRect.top + deckRect.height/2, endX: slotRect.left + slotRect.width/2, endY: slotRect.top + slotRect.height * 0.75 }]); }, delay);
        setTimeout(() => { setFlyingCards(prev => prev.filter(f => f.id !== flyId)); setPlayers(prev => prev.map(hero => hero.id === p.id ? { ...hero, currentCard: cardToDeal, justDealt: true } : hero)); }, delay + 850); 
      }
      delay += 300; 
    });
    setTimeout(() => { playSound('./assets/sfx/game/mana_restore.wav', 0.5); setDrawPile(tempDraw); setDiscardPile([...currentDiscard, ...emptiesToDiscard]); setPlayers(prev => prev.map(p => ({ ...p, hasActed: false, justDealt: false }))); setMana(maxMana); setTurnState('player'); }, delay + 1000); 
  }, [turnState, showLevelUp, maxMana]);

  const playCard = (playerIndex, card) => {
    const player = players[playerIndex];
    const effectivePlayer = getEffectivePlayer(player, equipped[player.id]);
    if (turnState !== 'player' || mana < card.cost || player.hp <= 0 || player.hasActed || isAnimating) return;

    const isContinuing = lastPlayedCost !== null && card.cost === lastPlayedCost + 1;
    const nextComboStreak = isContinuing ? comboStreak + 1 : 0;
    // comboStep: 0 — первая карта, 1 — вторая (+50%), 2+ — третья (+150%)
    const comboStep = nextComboStreak;
    // % прибавка к урону карты в комбо: 2-я карта +50%, 3-я+ +150%
    const comboDamageMult = COMBO_DAMAGE_MULT[Math.min(comboStep, 2)];
    // эффекты карты тоже множатся в комбо тем же коэффициентом
    const comboEffectMult = comboDamageMult;

    const targetIndices = getTargets(card, playerIndex, enemies, comboStep);
    if (targetIndices.length === 0) return;

    playSound('./assets/sfx/ui/click.wav', 0.6);
    setIsAnimating(true); setMana(m => m - card.cost); setAnimatingPlayerId(player.id); setAnimatingTargetIds(targetIndices.map(idx => enemies[idx].id));

    // Вычисляем вектор прыжка игрока. Сначала сбрасываем translate в 0,
    // затем через rAF устанавливаем цель — браузер animates transition плавно.
    setAttackTranslate({ dx: 0, dy: 0 });
    {
      const aRect = avatarRefs.current[player.id]?.getBoundingClientRect();
      const firstTargetId = targetIndices.length > 0 ? enemies[targetIndices[0]].id : null;
      const tRect = firstTargetId ? enemyRefs.current[firstTargetId]?.getBoundingClientRect() : null;
      const leapDx = aRect && tRect ? (tRect.left + tRect.width/2) - (aRect.left + aRect.width/2) : 200;
      const leapDy = aRect && tRect ? (tRect.top  + tRect.height/2) - (aRect.top  + aRect.height/2) : 0;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setAttackTranslate({ dx: leapDx * 0.75, dy: leapDy * 0.75 });
      }));
    }

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
      const { damage: baseDamage, critChance } = computeCardDamage(effectivePlayer, card, comboDamageMult);
      const newEnemies = enemies.map(e => ({...e})); let xpToSpawn = []; let lootToSpawn = [];

      playSound(getCombatHitSound(card.vfxType || 'slash'));

      const hitEnemyIds = targetIndices.map(idx => enemies[idx].id);
      setFlashingTargets(prev => [...prev, ...hitEnemyIds]);
      setTimeout(() => setFlashingTargets(prev => prev.filter(id => !hitEnemyIds.includes(id))), 250);

      const newBlood = [];
      let anyCrit = false;
      let maxDealt = 0;
      const statusPopups = [];
      targetIndices.forEach(idx => {
        const target = newEnemies[idx];
        target.statuses = { ...(target.statuses || {}) };

        // Урон с учётом метки (гарант. крит + бонус) и пробития брони (vuln)
        let dmg = baseDamage;
        let isCrit = Math.random() < critChance;
        const mark = target.statuses.mark;
        if (mark) { isCrit = true; }
        if (isCrit) dmg = Math.floor(dmg * 2);
        if (mark) { dmg = Math.floor(dmg * (mark.mult || 1)); delete target.statuses.mark; }
        const vuln = target.statuses.vuln;
        if (vuln) dmg = Math.floor(dmg * (1 + vuln.amount));
        if (isCrit) anyCrit = true;
        maxDealt = Math.max(maxDealt, dmg);

        target.hp -= dmg;

        const eRect = enemyRefs.current[target.id]?.getBoundingClientRect();
        if (eRect) {
           setDamagePopups(prev => [...prev, { id: Math.random(), value: dmg, isCrit, x: eRect.left + eRect.width / 2, y: eRect.top + eRect.height / 2 }]);
           for(let i=0; i<30; i++) {
              newBlood.push({ id: Math.random(), x: eRect.left + eRect.width/2, y: eRect.top + eRect.height/2 });
           }
        }

        // Наложение вторичного эффекта карты (масштабируется в комбо)
        if (card.secondary && !target.isDead) {
          const payload = buildSecondaryPayload(effectivePlayer, card, comboEffectMult);
          if (payload) {
            const { statuses, immediateHpLoss, applied } = applyStatusToEnemy(target.statuses, payload);
            target.statuses = statuses;
            if (immediateHpLoss) target.hp -= immediateHpLoss;
            if (applied && eRect) {
              const def = SECONDARY_EFFECTS[payload.effect];
              statusPopups.push({ id: Math.random(), text: `${def.icon} ${def.label}`, color: def.color, x: eRect.left + eRect.width / 2, y: eRect.top - 10 });
            }
          }
        }

        if (target.hp <= 0 && !target.isDead) {
          target.hp = 0; target.isDead = true;
          xpToSpawn.push({ id: target.id, amount: target.xpReward });
          // Босс всегда даёт легендарный предмет
          const loot = target.isBoss ? generateItemOfRarity('LEGENDARY') : rollLootDrop(sectorRef.current, currentStageRef.current);
          if (loot) lootToSpawn.push({ id: target.id, item: loot });
          playSound('./assets/sfx/combat/death.wav', 0.7);
        }
      });
      if (anyCrit) playSound('./assets/sfx/combat/hit_heavy.wav', 0.7);
      triggerImpact(maxDealt);
      setBloodParticles(prev => [...prev, ...newBlood]);
      if (statusPopups.length) setTimeout(() => setDamagePopups(prev => [...prev, ...statusPopups]), 260);

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

      if (isRealDeckCard(card)) {
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
  const enemiesRef = useRef(enemies);
  useEffect(() => { enemiesRef.current = enemies; }, [enemies]);
  const drawPileRef = useRef(drawPile);
  useEffect(() => { drawPileRef.current = drawPile; }, [drawPile]);
  const discardPileRef = useRef(discardPile);
  useEffect(() => { discardPileRef.current = discardPile; }, [discardPile]);
  useEffect(() => { showLevelUpRef.current = showLevelUp; }, [showLevelUp]);

  useEffect(() => {
    if (turnState !== 'enemy' || showLevelUp) return;

    // === Тик кровотечения в начале фазы врага ===
    const startEnemies = enemiesRef.current.map(e => ({ ...e, statuses: { ...(e.statuses || {}) } }));
    const bleedXp = []; const bleedLoot = []; let bleedHappened = false;
    startEnemies.forEach(e => {
      if (e.isDead) return;
      const bl = e.statuses.bleed;
      if (bl && bl.remaining > 0 && bl.dmg > 0) {
        bleedHappened = true;
        e.hp = Math.max(0, e.hp - bl.dmg);
        const eRect = enemyRefs.current[e.id]?.getBoundingClientRect();
        if (eRect) {
          setDamagePopups(dp => [...dp, { id: Math.random(), value: bl.dmg, x: eRect.left + eRect.width/2, y: eRect.top + eRect.height/2 }]);
          setDamagePopups(dp => [...dp, { id: Math.random(), text: '🩸', color: 'text-red-400', x: eRect.left + eRect.width/2, y: eRect.top - 10 }]);
        }
        if (e.hp <= 0 && !e.isDead) {
          e.isDead = true; e.hp = 0;
          bleedXp.push({ id: e.id, amount: e.xpReward });
          // Босс всегда даёт легендарный предмет
          const loot = e.isBoss ? generateItemOfRarity('LEGENDARY') : rollLootDrop(sectorRef.current, currentStageRef.current); if (loot) bleedLoot.push({ id: e.id, item: loot });
          playSound('./assets/sfx/combat/death.wav', 0.7);
        }
      }
    });
    if (bleedHappened) {
      setEnemies(startEnemies);
      bleedXp.forEach(xd => {
        const eRect = enemyRefs.current[xd.id]?.getBoundingClientRect(); const bRect = xpBarRef.current?.getBoundingClientRect();
        if (eRect && bRect) setFlyingXps(prev => [...prev, { id: Math.random(), amount: xd.amount, startX: eRect.left + eRect.width/2, startY: eRect.top, endX: bRect.left + bRect.width/2, endY: bRect.top + bRect.height/2 }]);
      });
      bleedLoot.forEach(ld => {
        const eRect = enemyRefs.current[ld.id]?.getBoundingClientRect(); const iRect = inventoryRef.current?.getBoundingClientRect();
        if (eRect && iRect) setFlyingItems(prev => [...prev, { id: Math.random(), item: ld.item, startX: eRect.left + eRect.width/2, startY: eRect.top + eRect.height/2, endX: iRect.left + iRect.width/2, endY: iRect.top + iRect.height/2 }]);
        else addItemToInventory(ld.item);
      });
    }

    // === Победа, если кровотечение добило всех ===
    if (startEnemies.every(e => e.isDead)) {
      setCompletedNodes(prev => [...prev, currentMapNodeId]);
      setTimeout(() => {
        if (showLevelUpRef.current) pendingTransitionRef.current = currentStage === 5 ? 'victory' : 'map';
        else if (currentStage === 5) { playSound('./assets/sfx/game/victory.wav'); setTurnState('victory'); }
        else setTurnState('map');
      }, 1200);
      return;
    }

    let delay = bleedHappened ? 450 : 0;
    const aliveEnemies = startEnemies.filter(e => !e.isDead);
    aliveEnemies.forEach((enemy) => {
      setTimeout(() => {
         const alivePlayers = playersRef.current.filter(p => p.hp > 0);
         if (alivePlayers.length === 0) return;

         const st = enemy.statuses || {};

         // Оглушение — пропуск хода
         if (st.stun && st.stun.remaining > 0) {
            const eR = enemyRefs.current[enemy.id]?.getBoundingClientRect();
            if (eR) setDamagePopups(dp => [...dp, { id: Math.random(), text: '💫 ОГЛУШЁН', color: 'text-amber-300', x: eR.left + eR.width/2, y: eR.top - 10 }]);
            return;
         }

         const base = Math.floor(Math.random() * 8) + 8 + (currentStage * 3);
         const weakenAtk = st.weaken?.atk || 0;
         const dmg = Math.max(1, Math.round(base * (enemy.dmgMult || 1.0) * (1 - weakenAtk)));
         const style = enemy.attackStyle || 'melee';
         const vfxType = enemy.vfxType || 'enemy';
         const blindChance = st.blind?.chance || 0;

         // AoE (Глаз): бьёт всех живых игроков одновременно
         if (style === 'aoe') {
            const targets = alivePlayers;
            setAnimatingEnemyId(enemy.id);
            setAnimatingTargetIds(targets.map(t => t.id));
            setIsAnimating(true);
            setEnemyAttackTranslate({ dx: 0, dy: 0 }); // не прыгает

            const eRect = enemyRefs.current[enemy.id]?.getBoundingClientRect();
            const newVfx = targets.flatMap(t => {
               const pRect = avatarRefs.current[t.id]?.getBoundingClientRect();
               if (!eRect || !pRect) return [];
               return [{ id: Math.random(), type: vfxType, delay: 0,
                  startX: eRect.left + eRect.width/2, startY: eRect.top + eRect.height/2,
                  endX: pRect.left + pRect.width/2,   endY: pRect.top + pRect.height/2 }];
            });
            setVfxList(newVfx);

            setTimeout(() => {
               setVfxList([]);
               playSound('./assets/sfx/combat/enemy_attack.wav');
               const missed = Math.random() < blindChance;
               if (missed) {
                  targets.forEach(t => { const pr = avatarRefs.current[t.id]?.getBoundingClientRect(); if (pr) setDamagePopups(dp => [...dp, { id: Math.random(), text: 'ПРОМАХ', color: 'text-slate-200', x: pr.left + pr.width/2, y: pr.top - 10 }]); });
                  setAnimatingEnemyId(null); setTimeout(() => setAnimatingTargetIds([]), 350); setIsAnimating(false);
                  return;
               }
               triggerImpact(dmg * 1.4);
               setFlashingTargets(prev => [...prev, ...targets.map(t => t.id)]);
               setTimeout(() => setFlashingTargets(prev => prev.filter(id => !targets.some(t => t.id === id))), 250);

               targets.forEach(t => {
                  const pRect = avatarRefs.current[t.id]?.getBoundingClientRect();
                  if (pRect) {
                     setDamagePopups(dp => [...dp, { id: Math.random(), value: dmg, x: pRect.left + pRect.width/2, y: pRect.top + pRect.height/2 }]);
                     const nb = []; for (let i=0; i<20; i++) nb.push({ id: Math.random(), x: pRect.left + pRect.width/2, y: pRect.top + pRect.height/2 });
                     setBloodParticles(prev => [...prev, ...nb]);
                  }
               });

               setPlayers(currentPs => currentPs.map(p => {
                  if (!targets.some(t => t.id === p.id)) return p;
                  const newHp = Math.max(0, p.hp - dmg);
                  if (newHp === 0) purgeHeroFromDeck(p.id, p.currentCard);
                  return { ...p, hp: newHp, currentCard: null };
               }));

               setAnimatingEnemyId(null);
               setTimeout(() => setAnimatingTargetIds([]), 350);
               setIsAnimating(false);
            }, 300);
            return;
         }

         // Одиночная атака (melee / ranged)
         const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];

         setAnimatingEnemyId(enemy.id);
         setAnimatingTargetIds([target.id]);
         setIsAnimating(true);

         const eRect = enemyRefs.current[enemy.id]?.getBoundingClientRect();
         const pRect = avatarRefs.current[target.id]?.getBoundingClientRect();

         setEnemyAttackTranslate({ dx: 0, dy: 0 });

         if (style === 'ranged') {
            if (eRect && pRect) {
               setVfxList([{ id: Math.random(), type: vfxType, delay: 0,
                  startX: eRect.left + eRect.width/2, startY: eRect.top + eRect.height/2,
                  endX: pRect.left + pRect.width/2,   endY: pRect.top + pRect.height/2 }]);
            }
         } else {
            const leapDx = eRect && pRect ? (pRect.left + pRect.width/2) - (eRect.left + eRect.width/2) : -200;
            const leapDy = eRect && pRect ? (pRect.top  + pRect.height/2) - (eRect.top  + eRect.height/2) : 0;
            requestAnimationFrame(() => requestAnimationFrame(() => {
               setEnemyAttackTranslate({ dx: leapDx * 0.75, dy: leapDy * 0.75 });
            }));
         }

         const hitDelay = style === 'ranged' ? 480 : 300;

         setTimeout(() => {
            setVfxList([]);
            playSound('./assets/sfx/combat/enemy_attack.wav');
            const missed = Math.random() < blindChance;
            if (missed) {
               if (pRect) setDamagePopups(dp => [...dp, { id: Math.random(), text: 'ПРОМАХ', color: 'text-slate-200', x: pRect.left + pRect.width/2, y: pRect.top - 10 }]);
               setAnimatingEnemyId(null); setTimeout(() => setAnimatingTargetIds([]), 350); setIsAnimating(false);
               return;
            }
            triggerImpact(dmg);

            setFlashingTargets(prev => [...prev, target.id]);
            setTimeout(() => setFlashingTargets(prev => prev.filter(id => id !== target.id)), 250);

            if (pRect) {
               setDamagePopups(dp => [...dp, { id: Math.random(), value: dmg, x: pRect.left + pRect.width / 2, y: pRect.top + pRect.height / 2 }]);
               const newBlood = [];
               for(let i=0; i<30; i++) newBlood.push({ id: Math.random(), x: pRect.left + pRect.width/2, y: pRect.top + pRect.height/2 });
               setBloodParticles(prev => [...prev, ...newBlood]);
            }

            setPlayers(currentPs => currentPs.map(p => {
               if (p.id === target.id) {
                  const newHp = Math.max(0, p.hp - dmg);
                  if (newHp === 0) purgeHeroFromDeck(p.id, p.currentCard);
                  return { ...p, hp: newHp, currentCard: null };
               }
               return p;
            }));

            setAnimatingEnemyId(null);
            setTimeout(() => setAnimatingTargetIds([]), 350);
            setIsAnimating(false);
         }, hitDelay);
      }, delay); 
      delay += 800; 
    });
    
    setTimeout(() => { 
        // Конец фазы: уменьшаем длительность всех статусов
        setEnemies(prev => prev.map(e => e.isDead ? e : decrementStatuses(e)));
        if (playersRef.current.every(p => p.hp <= 0)) {
            playSound('./assets/sfx/game/gameover.wav');
            setTurnState('gameover');
        } else {
            setTurnState(ts => ts === 'enemy' ? 'dealing' : ts);
        }
    }, delay + 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnState, showLevelUp, currentStage]);

  const getCardComboStatus = (pId, card) => {
    if (!card) return { isCandidate: false, willGiveBonus: false, comboStep: 0, comboPct: 0, willSplash: false };
    const willGiveBonus = lastPlayedCost !== null && card.cost === lastPlayedCost + 1;
    const comboStep = willGiveBonus ? Math.min(comboStreak + 1, 2) : 0;
    const comboPct = COMBO_DAMAGE_PCT[comboStep];
    const willSplash = !!card.comboSplash && comboStep >= 1;
    let isCandidate = false;
    if (willGiveBonus) isCandidate = true;
    else if (lastPlayedCost === null) {
      const hasFollowup = players.some(otherP => otherP.id !== pId && !otherP.hasActed && otherP.currentCard?.cost === card.cost + 1);
      isCandidate = hasFollowup;
    }
    return { isCandidate, willGiveBonus, comboStep, comboPct, willSplash };
  };

  const aliveCount = players.filter(p => p.hp > 0).length;
  const totalDeckSize = aliveCount * CARD_POOL_SIZE;
  const liveDrawCount = drawPile.filter(c => players.some(p => p.hp > 0 && p.id === c.ownerId)).length;

  const currentNode = gameMap.find(n => n.id === currentMapNodeId);
  const currentNodeInfo = getNodeInfo(currentNode?.type);
  // Скорость движения шейдера растёт с продвижением по карте сектора (stage 0..5 → 0..1), плавно.
  const bgSpeed = Math.min(1, Math.max(0, currentStage / 5));

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
      {/* Экран подготовки рисует собственный шейдер+картинку. Чтобы не было двух шейдеров
          и лишних наложений одновременно, глобальный фон и декор боя под ним отключены. */}
      {!showPrep && (
        <>
          <ShaderBackground hue={bgLocation.hue} sat={bgLocation.sat} speed={bgSpeed} />
          <ImageBackground imageUrl={bgLocation.url} hue={bgLocation.hue} sat={bgLocation.sat} />

          {/* Декоративные уголки сцены боя: слой над фоном, но под HUD; не пересекают верхний прогрессбар */}
          <img src="./corner.png" alt="" aria-hidden="true" className="pointer-events-none select-none absolute top-[24px] left-0 w-[325px] h-[325px] z-[0] opacity-90 drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]" />
          <img src="./corner.png" alt="" aria-hidden="true" className="pointer-events-none select-none absolute top-[24px] right-0 w-[325px] h-[325px] z-[0] opacity-90 drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]" style={{ transform: 'scaleX(-1)' }} />
          <img src="./corner.png" alt="" aria-hidden="true" className="pointer-events-none select-none absolute bottom-0 left-0 w-[325px] h-[325px] z-[0] opacity-90 drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]" style={{ transform: 'scaleY(-1)' }} />
          <img src="./corner.png" alt="" aria-hidden="true" className="pointer-events-none select-none absolute bottom-0 right-0 w-[325px] h-[325px] z-[0] opacity-90 drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]" style={{ transform: 'scale(-1, -1)' }} />
        </>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 12px; width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(15, 23, 42, 0.5); border-radius: 10px; margin: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(51, 65, 85, 0.8); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(71, 85, 105, 1); }
        
        @keyframes speechWobble {
          0%, 100% { transform: rotate(-2.5deg); }
          50% { transform: rotate(2.5deg); }
        }
        @keyframes lowHpPulse {
          /* Тёмно-красный (≈#641212) тинт по пикселям спрайта (колоризация как у героев),
             тусклый и приглушённый — интенсивность/яркость снижены ~втрое от яркого красного */
          0%, 100% { filter: none; }
          50% { filter: brightness(0.6) sepia(1) hue-rotate(-32deg) saturate(250%); }
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
                let transitionClass = 'transition-all duration-600 ease-out';
                if (isAttacking) {
                   avatarTransform = `translate(${attackTranslate.dx}px, ${attackTranslate.dy}px) scale(1.15)`;
                   // duration-300 совпадает с animDuration — игрок долетает до цели точно в момент удара
                   transitionClass = 'transition-all duration-300 ease-out';
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
                    <div className={`relative ${CHAR_ATLASES[player.id] ? '' : 'text-6xl'} ${isHovered && !isAnimating ? 'drop-shadow-[0_0_25px_rgba(59,130,246,0.4)]' : ''} ${flashingTargets.includes(player.id) ? 'brightness-0 invert drop-shadow-[0_0_40px_white] scale-150 -translate-y-4 z-[2000]' : ''}`} style={{ transition: 'all 0.15s ease-out' }}>{CHAR_ATLASES[player.id] ? <CharSprite atlas={CHAR_ATLASES[player.id]} size={CHAR_SPRITE_SIZE} {...CHAR_COLORIZE[player.id]} /> : String(player.icon)}{isBeingAttacked && <div className="absolute inset-0 flex items-center justify-center text-red-500 text-6xl animate-bounce pointer-events-none z-50">💥</div>}</div>
                  </div>
                );
              })}
            </div>
            <div className="absolute left-1/2 top-16 bottom-16 w-px bg-gradient-to-b from-transparent via-slate-700 to-transparent opacity-50"></div>
            <div className="relative w-1/2 z-10 h-full overflow-visible">
              {enemies.map((enemy, eIdx) => {
                const isHoveredTarget = hoveredTargetIds.includes(enemy.id); 
                const isBeingAttacked = animatingTargetIds.includes(enemy.id); 
                const isAttacking = animatingEnemyId === enemy.id;
                const isSpeaking = speakingEnemy && speakingEnemy.id === enemy.id && !enemy.isDead;
                const enemyAtlas = ENEMY_ATLASES[enemy.name] || null;
                const formation = ENEMY_FORMATIONS[enemies.length] || ENEMY_FORMATIONS[3];
                const basePos = formation[eIdx] || formation[formation.length - 1];
                const isBoss = enemy.attackStyle === 'aoe';
                const lowHp = !enemy.isDead && enemy.hp / enemy.maxHp < 0.3;
                const enemySize = isBoss ? Math.round(CHAR_SPRITE_SIZE * 1.5625) : CHAR_SPRITE_SIZE;
                // Босс крупнее; right уменьшается = сдвиг вправо, top увеличивается = ниже
                const pos = isBoss ? { right: basePos.right - 95, top: basePos.top - 10 } : basePos;
                
                // moveTransform — движение (прыжок/hover/shake) на ВНЕШНЕМ div с transition
                // mirrorTransform — зеркало scaleX(-1) всегда на ВНУТРЕННЕМ div (без transition)
                let moveTransform = '';
                let transitionClass = 'transition-all duration-600 ease-out';
                if (isAttacking) {
                  const doesLeap = enemy.attackStyle === 'melee' || !enemy.attackStyle;
                  moveTransform = doesLeap
                    ? `translate(${enemyAttackTranslate.dx}px, ${enemyAttackTranslate.dy}px) scale(1.15)`
                    : 'scale(1.15)';
                  transitionClass = 'transition-all duration-300 ease-out';
                }
                else if (isHoveredTarget && !isAnimating) moveTransform = 'translate(-16px, 0)';
                else if (isBeingAttacked && shake.x !== 0) {
                   moveTransform = `translate(${shake.x * 0.5}px, ${shake.y * 0.5}px) rotate(${shake.rot * 0.5}deg) scale(1.1)`;
                   transitionClass = 'transition-none';
                }
                else if (isBeingAttacked) moveTransform = 'scale(1.1)';

                return (
                  <div key={String(enemy.id)} ref={(el) => setEnemyRef(enemy.id, el)} className={`absolute ${transitionClass} ${enemy.isDead ? 'opacity-20 grayscale scale-75' : ''} ${isAttacking ? 'z-50 drop-shadow-[0_0_40px_rgba(239,68,68,1)]' : ''} ${isBeingAttacked && shake.x === 0 ? 'brightness-150 animate-pulse' : ''}`} style={{ transform: moveTransform, right: pos.right, top: pos.top }}>
                    {isSpeaking && <EnemySpeechBubble text={speakingEnemy.text} />}
                    {!enemy.isDead && enemy.statuses && Object.keys(enemy.statuses).filter(k => SECONDARY_EFFECTS[k]).length > 0 && (
                      <div className="group absolute left-1/2 -translate-x-1/2 -top-3 flex gap-1 z-[80]">
                        {Object.entries(enemy.statuses).map(([key, val]) => {
                          const def = SECONDARY_EFFECTS[key]; if (!def) return null;
                          return (
                            <div key={key} className="flex items-center bg-slate-900/85 border border-slate-600 rounded-md px-1 py-0.5 text-[11px] leading-none shadow-lg">
                              <span>{def.icon}</span>
                              {val.remaining ? <span className="ml-0.5 font-black text-white text-[9px]">{val.remaining}</span> : null}
                            </div>
                          );
                        })}
                        {/* Тултип с краткой инфой о дебаффах, появляется при наведении */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-950/95 border border-slate-600 rounded-lg p-2 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-150 pointer-events-none z-[90]">
                          <div className="flex flex-col gap-1.5">
                            {Object.entries(enemy.statuses).map(([key, val]) => {
                              const def = SECONDARY_EFFECTS[key]; if (!def) return null;
                              return (
                                <div key={key} className="flex items-start gap-1.5 text-left">
                                  <span className="text-sm leading-none mt-0.5">{def.icon}</span>
                                  <div className="flex-1 leading-tight">
                                    <div className={`text-[10px] font-black uppercase tracking-wide ${def.color}`}>{def.label}{val.remaining ? ` · ${val.remaining} х.` : ''}</div>
                                    <div className="text-[9px] text-slate-300">{describeStatus(key, val)}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Мини HP-бар без цифр: скрыт, всплывает при уроне */}
                    {!enemy.isDead && <EnemyHpBar hp={enemy.hp} maxHp={enemy.maxHp} />}
                    <div className="relative" style={{ transform: 'scaleX(-1)' }}>
                      <div
                        className={`relative ${enemyAtlas ? '' : 'text-6xl'} ${isHoveredTarget || isBeingAttacked ? 'drop-shadow-[0_0_25px_rgba(239,68,68,0.4)]' : ''} ${flashingTargets.includes(enemy.id) ? 'brightness-0 invert drop-shadow-[0_0_40px_white] scale-150 -translate-y-4 z-[2000]' : ''}`}
                        style={{ animation: isSpeaking && !isBeingAttacked && !isAttacking ? 'speechWobble 0.4s ease-in-out infinite' : (lowHp && !isBeingAttacked && !isAttacking && !flashingTargets.includes(enemy.id) ? 'lowHpPulse 0.9s ease-in-out infinite' : 'none'), transition: 'all 0.15s ease-out' }}
                      >
                        {enemyAtlas ? <CharSprite atlas={enemyAtlas} size={enemySize} /> : String(enemy.icon)}
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
                   <span className="text-slate-300 drop-shadow-md text-3xl">{String(liveDrawCount)}<span className="text-[#1E88E5] text-lg">/{String(totalDeckSize)}</span></span>
                   <span className="text-[9px] uppercase font-black tracking-widest text-[#1E88E5] mt-2">Колода</span>
                </div>
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
        <DeathScreen
          items={inventory.filter(Boolean)}
          startProgress={soulProgress}
          threshold={EMBER_JUNK_THRESHOLD}
          onDone={handleDeathDone}
        />
      )}

      {showPrep && (
        <PrepScreen
          players={players}
          pools={getHeroPools()}
          soulEmbers={soulEmbers}
          soulProgress={soulProgress}
          emberThreshold={EMBER_JUNK_THRESHOLD}
          prepCardsBought={prepCardsBought}
          onBuyCard={buyPrepCard}
          onBurnCard={burnPrepCard}
          onStart={() => setShowPrep(false)}
        />
      )}

      {cardReveal && (
        <CardRevealOverlay
          card={cardReveal.card}
          owner={cardReveal.owner}
          bgHue={bgLocation.hue}
          bgSat={bgLocation.sat}
          onDismiss={() => setCardReveal(null)}
        />
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
          <h2 className="text-6xl font-black text-amber-500 drop-shadow-2xl mb-8 uppercase italic tracking-tighter text-center">{String(rewardTitle)}</h2>
          <div className="relative border-2 border-indigo-500/30 rounded-2xl p-10 pt-12 pb-10 bg-slate-900/60 shadow-[0_0_80px_rgba(99,102,241,0.15)] flex flex-col items-center">
            <div className="absolute -top-3 px-4 bg-[#1e1f2e] text-slate-400 text-sm tracking-[0.3em] uppercase whitespace-nowrap">ВЫБЕРИТЕ НАГРАДУ:</div>
            <div className="flex gap-6 items-center">
              {rewardOptions.map((option, idx) => {
                const { card, kind } = option;
                const isUpgrade = kind === 'upgrade';
                const preview = isUpgrade ? { ...card, level: getCardLevel(card) + 1 } : card;
                return (
                <div key={`${card.id}-${kind}-${idx}`} className="relative">
                  <TiltWrapper className={`w-48 h-[270px] ${isUpgrade ? 'drop-shadow-[0_0_25px_rgba(245,158,11,0.5)]' : 'drop-shadow-[0_0_25px_rgba(14,165,233,0.4)]'}`}>
                    <div onClick={() => selectReward(option)} className="w-full h-full cursor-pointer">
                      <AbilityCard card={preview} owner={players.find(p=>p.id===card.ownerId)} mana={maxMana} isDisabled={false} showOwnerLabel={true} comboState={{isCandidate: false, willGiveBonus: false}} />
                    </div>
                    {/* Плашка — последний ребёнок TiltWrapper: масштабируется вместе с карточкой
                        (общий transform) и всегда поверх неё (порядок отрисовки + высокий z) */}
                    {isUpgrade ? (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-[80] bg-amber-500 text-black text-[10px] font-black px-3 py-1 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.8)] uppercase tracking-widest whitespace-nowrap pointer-events-none">▲ Улучшение · ур.{String(getCardLevel(card))} → {String(getCardLevel(card) + 1)}</div>
                    ) : (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-[80] bg-sky-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-[0_0_20px_rgba(14,165,233,0.8)] uppercase tracking-widest whitespace-nowrap pointer-events-none">✦ Новая карта</div>
                    )}
                  </TiltWrapper>
                </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {slotsPopup && (
        <SquadSlotsPopup
          players={players}
          pools={getHeroPools()}
          newCardId={slotsPopup.newCardId}
          onClose={closeSlotsPopup}
        />
      )}

      {showReserve && (
        <DeckWindow
          players={players}
          pools={getHeroPools()}
          drawPile={drawPile}
          discardPile={discardPile}
          maxMana={maxMana}
          onClose={() => setShowReserve(false)}
        />
      )}
      </div>
    </div>
  );
}