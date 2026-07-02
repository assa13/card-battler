import React, { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } from 'react';
import TavernHubScreen from './TavernHubScreen';
import QteOverlay from './QteOverlay';
import { qteSlowMo } from './qteTimeScale';

// --- 1. КОНСТАНТЫ И НАСТРОЙКИ ---

const MAX_MANA = 3;
const ENEMY_POWER_MULT = 0.5; // глобальный нерф врагов: HP и урон ×0.5
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
  { id: 'p1', name: 'Воин', baseMaxHp: 50, hp: 50, maxHp: 50, atk: 0, matk: 0, crit: 0, armor: 0, icon: '🛡️', bg: 'bg-blue-900', currentCard: null, hasActed: false },
  { id: 'p2', name: 'Разбойник', baseMaxHp: 35, hp: 35, maxHp: 35, atk: 0, matk: 0, crit: 0, armor: 0, icon: '🗡️', bg: 'bg-green-900', currentCard: null, hasActed: false },
  { id: 'p3', name: 'Маг', baseMaxHp: 25, hp: 25, maxHp: 25, atk: 0, matk: 0, crit: 0, armor: 0, icon: '🔮', bg: 'bg-purple-900', currentCard: null, hasActed: false },
];

// Рост максимального HP за уровень отряда (воин — танк, растёт быстрее)
const HP_PER_LEVEL = { p1: 8, p2: 6, p3: 4 };

// Цветовые акценты бойцов (для подсветки слотов руки в экране колоды)
const HERO_ACCENT = { p1: '#3b82f6', p2: '#22c55e', p3: '#a855f7' };

// Вторичные эффекты абилок. Сила отвязана от статов — считается от SECONDARY_BASE_POWER × уровень × combo.
// duration — в ХОДАХ врага (тикает, когда враги ходят). mark — без длительности (до первого удара).
const SECONDARY_EFFECTS = {
  stun:   { icon: '💫', color: 'text-amber-300', label: 'Оглушение',      duration: 1 },
  vuln:   { icon: '🛡️', color: 'text-blue-400',  label: 'Пробитие брони', duration: 2 },
  bleed:  { icon: '🩸', color: 'text-red-400',   label: 'Кровотечение',   duration: 3 },
  blind:  { icon: '🌀', color: 'text-blue-400',  label: 'Ослепление',     duration: 2 },
  weaken: { icon: '⬇️', color: 'text-red-400',   label: 'Ослабление',     duration: 2 },
  mark:   { icon: '🎯', color: 'text-green-400', label: 'Метка',          duration: 0 },
};

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
// Возможные типы бонусов предмета — прямые модификаторы, без привязки к статам:
// atk  — +% к физическому урону, matk — +% к магическому урону,
// crit — +% к шансу крита, hp — +к здоровью (плоское).
const ITEM_STAT_TYPES = ['atk', 'matk', 'crit', 'hp'];
const ITEM_HP_MULT = 2.5;
const ITEM_CRIT_MULT = 0.5;

const rollItemStatBundle = (rarity) => {
  const range = ITEM_STAT_RANGES[rarity];
  const roll = () => Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
  const [minC, maxC] = ITEM_BONUS_COUNTS[rarity] || [1, 1];
  const count = minC + Math.floor(Math.random() * (maxC - minC + 1));
  // GDD 6.2: atk и matk взаимоисключающие — предмет либо «оружие воина», либо «инструмент мага».
  // Сначала фиксируем тип урона (50/50), затем чистим противоположный из пула возможных бонусов.
  const damageStat = Math.random() < 0.5 ? 'atk' : 'matk';
  const excluded = damageStat === 'atk' ? 'matk' : 'atk';
  const availablePool = ITEM_STAT_TYPES.filter(s => s !== excluded);
  // Гарантируем, что первый (главный) бонус — именно выбранный тип урона, чтобы фокус предмета был очевиден.
  const others = shuffleArray(availablePool.filter(s => s !== damageStat));
  const picked = [damageStat, ...others].slice(0, Math.min(count, availablePool.length));
  const stats = {};
  picked.forEach((stat, idx) => {
    const base = roll();
    const mult = idx === 0 ? 1 : 0.32 + Math.random() * 0.18;
    let val = Math.max(1, Math.round(base * mult));
    if (stat === 'hp') val = Math.max(4, Math.round(val * ITEM_HP_MULT));
    else if (stat === 'crit') val = Math.max(1, Math.round(val * ITEM_CRIT_MULT));
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
  { name: 'Инструменты палача', icon: 'item_11.webp', focus: 'str', rarity: 'COMMON' },
  { name: 'Запас зелий', icon: 'item_13.webp', focus: 'dex', rarity: 'COMMON' },
  { name: 'Статуя горгульи', icon: 'item_14.webp', focus: 'str', rarity: 'COMMON' },
  { name: 'Зловещий кинжал', icon: 'item_20.webp', focus: 'dex', rarity: 'COMMON' },
  { name: 'Ступка алхимика', icon: 'item_31.webp', focus: 'int', rarity: 'COMMON' },
  { name: 'Кожаная перчатка', icon: 'item_34.webp', focus: 'dex', rarity: 'COMMON' },
  { name: 'Связка ключей', icon: 'item_36.webp', focus: 'dex', rarity: 'COMMON' },
  { name: 'Проклятые монеты', icon: 'item_39.webp', focus: 'dex', rarity: 'COMMON' },
  { name: 'Канделябр', icon: 'item_41.webp', focus: 'int', rarity: 'COMMON' },
  { name: 'Забытая шестерня', icon: 'item_43.webp', focus: 'str', rarity: 'COMMON' },
  { name: 'Свиток нетопыря', icon: 'item_45.webp', focus: 'int', rarity: 'COMMON' },
  // RARE (7)
  { name: 'Астролябия', icon: 'item_15.webp', focus: 'int', rarity: 'RARE' },
  { name: 'Кости предков', icon: 'item_30.webp', focus: 'str', rarity: 'RARE' },
  { name: 'Букет аконита', icon: 'item_32.webp', focus: 'int', rarity: 'RARE' },
  { name: 'Рунические камни', icon: 'item_33.webp', focus: 'int', rarity: 'RARE' },
  { name: 'Фляга с ядом', icon: 'item_38.webp', focus: 'dex', rarity: 'RARE' },
  { name: 'Ржавые кандалы', icon: 'item_42.webp', focus: 'str', rarity: 'RARE' },
  { name: 'Перо и чернила', icon: 'item_44.webp', focus: 'int', rarity: 'RARE' },
  // EPIC (5)
  { name: 'Древний гримуар', icon: 'item_10.webp', focus: 'int', rarity: 'EPIC' },
  { name: 'Череп ворона', icon: 'item_12.webp', focus: 'int', rarity: 'EPIC' },
  { name: 'Терновый венец', icon: 'item_25.webp', focus: 'int', rarity: 'EPIC' },
  { name: 'Рутиловый кристалл', icon: 'item_35.webp', focus: 'int', rarity: 'EPIC' },
  { name: 'Крылатый череп', icon: 'item_37.webp', focus: 'str', rarity: 'EPIC' },
  // LEGENDARY (2)
  { name: 'Зеркало скорби', icon: 'item_40.webp', focus: 'int', rarity: 'LEGENDARY' },
  { name: 'Проклятый гроб', icon: 'item_46.webp', focus: 'str', rarity: 'LEGENDARY' },
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
const ItemIcon = React.memo(({ item, className = '', imgClassName = 'w-full h-full object-cover' }) => {
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
});

// Атласы idle-анимаций персонажей игрока: спрайт-лист 1280x1280, кадр 320x320, сетка 4x4
const CHAR_ATLASES = {
  p1: { url: './chars/warrior_atlas.webp', cols: 4, rows: 4, frameCount: 15, fps: 7.5 },
  p2: { url: './chars/rogue_atlas.webp',   cols: 4, rows: 4, frameCount: 16, fps: 7.5 },
  p3: { url: './chars/priest_atlas.webp',  cols: 4, rows: 4, frameCount: 16, fps: 7.5 },
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
  'Гоблин':     { url: './chars/goblin_atlas.webp',     cols: 4, rows: 4, frameCount: 16, fps: 7.5 },
  'Волк':       { url: './chars/wolf_atlas.webp',       cols: 4, rows: 4, frameCount: 16, fps: 7.5 },
  'Бандит':     { url: './chars/bandit_atlas.webp',     cols: 4, rows: 4, frameCount: 16, fps: 7.5 },
  'Орк':        { url: './chars/orc_atlas.webp',        cols: 4, rows: 4, frameCount: 16, fps: 7.5 },
  'Зомби':      { url: './chars/zombie_atlas.webp',     cols: 4, rows: 4, frameCount: 16, fps: 7.5 },
  'Слизень':    { url: './chars/squish_atlas.webp',     cols: 4, rows: 4, frameCount: 16, fps: 7.5 },
  'Стрелок':    { url: './chars/shooter_atlas.webp',    cols: 4, rows: 4, frameCount: 16, fps: 7.5 },
  'Тёмный маг': { url: './chars/dark_mage_atlas.webp',  cols: 4, rows: 4, frameCount: 16, fps: 7.5 },
  'Глаз':       { url: './chars/eye_atlas.webp',        cols: 4, rows: 4, frameCount: 16, fps: 7.5 },
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
const CharSprite = React.memo(({ atlas, size = 110, className = '', style = {}, hue, sat }) => {
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
});

// Мини HP-бар врага: прямоугольный, скрыт по умолчанию, всплывает при получении урона
// и плавно исчезает. Двухслойная анимация: белый «откушенный» кусок сужается до текущего HP.
const EnemyHpBar = React.memo(({ hp, maxHp }) => {
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
});

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
  const atk = (player.atk || 0) + (bonus.atk || 0);
  const matk = (player.matk || 0) + (bonus.matk || 0);
  const crit = (player.crit || 0) + (bonus.crit || 0);
  const maxHp = (player.baseMaxHp ?? 20) + (bonus.hp || 0);
  return { ...player, atk, matk, crit, maxHp };
};

// Список бонусов предмета: [{ label, display }] — для зелёного отображения в тултипе
const formatItemStatsList = (stats = {}) => {
  const parts = [];
  if (stats.atk) parts.push({ label: 'Атака', display: `+${stats.atk}%` });
  if (stats.matk) parts.push({ label: 'Маг. атака', display: `+${stats.matk}%` });
  if (stats.crit) parts.push({ label: 'Крит', display: `+${stats.crit}%` });
  if (stats.hp) parts.push({ label: 'HP', display: `+${stats.hp}` });
  return parts;
};
const formatItemStats = (stats = {}) => {
  const parts = formatItemStatsList(stats).map(p => `${p.label} ${p.display}`);
  return parts.length ? parts.join(' · ') : 'Без бонусов';
};

// Цели атаки: all — все враги (дефолт, ~70%), random2 — 2 случайных, strongest — самый сильный
const CARD_TARGETING = { ALL: 'all', RANDOM2: 'random2', STRONGEST: 'strongest' };

const getCardTargeting = (card) => {
  if (!card || card.modType) return null;
  if (card.targeting) return card.targeting;
  if (card.type === 'splash') return CARD_TARGETING.ALL;
  if (card.priority === 'highestHp') return CARD_TARGETING.STRONGEST;
  if (card.priority === 'lowestHp') return CARD_TARGETING.RANDOM2;
  return CARD_TARGETING.ALL;
};

const getTargetingLabel = (targeting, short = false) => {
  switch (targeting) {
    case CARD_TARGETING.RANDOM2: return short ? 'по 2 случайным' : 'Бьёт 2 случайных врагов';
    case CARD_TARGETING.STRONGEST: return short ? 'по сильнейшему' : 'Бьёт самого сильного врага';
    default: return short ? 'по всем врагам' : 'Бьёт всех врагов';
  }
};

const pickRandomAliveIndices = (alive, count, seed = null) => {
  const pool = [...alive];
  if (seed != null) {
    let h = 0;
    const seedStr = String(seed);
    for (let i = 0; i < seedStr.length; i++) h = ((h << 5) - h + seedStr.charCodeAt(i)) | 0;
    for (let i = pool.length - 1; i > 0; i--) {
      h = ((h << 5) - h + i) | 0;
      const j = Math.abs(h) % (i + 1);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
  } else {
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
  }
  return pool.slice(0, Math.min(count, pool.length)).map(e => e.originalIndex);
};

// GDD 3.2: чёткие архетипы. Воин — Джаггернаут (тяжёлые одиночные удары, CC, скейл от брони).
// Разбойник — Тысяча порезов (дешёвые мульти-удары, кровотечение, мостики комбо).
// Маг — Катализатор (дорогие нюки, метка/дебаффы, спред эффектов).
const HERO_ABILITIES = {
  p1: {
    basic: { id: 'b1', name: 'Удар мечом', cost: 1, mult: 1.8, dmgType: 'melee', icon: '⚔️', targeting: 'all', rarity: 'COMMON', vfxType: 'slash' },
    skills: [
      { id: 's1_1', ownerId: 'p1', name: 'Молот Тора', cost: 2, mult: 2.8, dmgType: 'melee', icon: '🔨', targeting: 'strongest', rarity: 'EPIC', vfxType: 'smash', secondary: { effect: 'stun' } },
      { id: 's1_2', ownerId: 'p1', name: 'Размах', cost: 2, mult: 1.7, dmgType: 'melee', icon: '🌪️', targeting: 'all', rarity: 'COMMON', vfxType: 'slash' },
      { id: 's1_3', ownerId: 'p1', name: 'Рывок', cost: 1, mult: 1.6, dmgType: 'melee', icon: '🏃', targeting: 'strongest', rarity: 'COMMON', vfxType: 'slash', secondary: { effect: 'vuln' } },
      { id: 's1_4', ownerId: 'p1', name: 'Берсерк', cost: 3, mult: 3.0, dmgType: 'melee', icon: '🪓', targeting: 'all', rarity: 'EPIC', vfxType: 'smash', secondary: { effect: 'stun' } }
    ]
  },
  p2: {
    basic: { id: 'b2', name: 'Кинжал', cost: 0, mult: 2.0, dmgType: 'ranged', icon: '🗡️', targeting: 'random2', rarity: 'COMMON', vfxType: 'dagger_single' },
    skills: [
      { id: 's2_1', ownerId: 'p2', name: 'Яд', cost: 1, mult: 1.8, dmgType: 'ranged', icon: '🧪', targeting: 'random2', rarity: 'COMMON', vfxType: 'poison', secondary: { effect: 'bleed' } },
      { id: 's2_2', ownerId: 'p2', name: 'Тысяча порезов', cost: 1, mult: 1.4, dmgType: 'ranged', icon: '✂️', targeting: 'all', rarity: 'RARE', vfxType: 'daggers', secondary: { effect: 'bleed' } },
      { id: 's2_3', ownerId: 'p2', name: 'Танец стали', cost: 2, mult: 2.2, dmgType: 'ranged', icon: '⚔️', targeting: 'all', rarity: 'RARE', vfxType: 'daggers' },
      { id: 's2_4', ownerId: 'p2', name: 'Кровопускание', cost: 3, mult: 2.6, dmgType: 'ranged', icon: '🩸', targeting: 'all', rarity: 'EPIC', vfxType: 'daggers', secondary: { effect: 'bleed' } }
    ]
  },
  p3: {
    basic: { id: 'b3', name: 'Искра', cost: 2, mult: 1.0, dmgType: 'magic', icon: '✨', targeting: 'all', rarity: 'COMMON', vfxType: 'magic_spark' },
    skills: [
      { id: 's3_1', ownerId: 'p3', name: 'Огненный шар', cost: 3, mult: 2.5, dmgType: 'magic', icon: '☄️', targeting: 'all', rarity: 'RARE', vfxType: 'fireball' },
      { id: 's3_2', ownerId: 'p3', name: 'Ледяной шип', cost: 2, mult: 1.6, dmgType: 'magic', icon: '❄️', targeting: 'all', rarity: 'RARE', vfxType: 'ice_spike', secondary: { effect: 'mark' } },
      { id: 's3_3', ownerId: 'p3', name: 'Цепная молния', cost: 3, mult: 2.0, dmgType: 'magic', icon: '⚡', targeting: 'random2', rarity: 'RARE', vfxType: 'lightning', secondary: { effect: 'vuln' } },
      { id: 's3_4', ownerId: 'p3', name: 'Чёрная дыра', cost: 5, mult: 3.2, dmgType: 'magic', icon: '🌌', targeting: 'all', rarity: 'LEGENDARY', vfxType: 'dark_void', secondary: { effect: 'weaken' } }
    ]
  }
};

// Пулл карт бойца: всего слотов на героя. Старт — 1 заполненный (базовая карта) + 3 свободных
// под будущие карты. «Пустышек»-балласта в колоде нет — только реально существующие карты.
const CARD_POOL_SIZE = 4;
const DECK_SIZE = INITIAL_PLAYERS_DATA.length * CARD_POOL_SIZE; // верхний предел (для справки)

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
  { id: 'stats', title: 'Эликсир Мощи', desc: 'Атака и магическая атака каждого бойца увеличиваются на +5%.', icon: '💪' },
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

// Fisher–Yates. `sort(() => random-0.5)` статистически смещён и портит
// баланс раздачи карт/лута/наград — не использовать.
const shuffleArray = (array) => {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

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

// Стартовая карта героя — его базовая атака как полноценная карта колоды (1-й заполненный слот).
// id не начинается с 'b', поэтому isRealDeckCard === true (карта считается в пулле).
const createStarterCard = (heroId) => {
  const basic = HERO_ABILITIES[heroId].basic;
  return { ...basic, id: `start_${heroId}`, ownerId: heroId, level: 1, skillId: basic.id, isStarter: true };
};

// Стартовые универсальные мод-карты: по умолчанию в общей колоде (без владельца).
const createStarterModCards = () => MOD_CARD_LIST.map(m => ({ ...m, id: `mod_start_${m.modType}`, level: 1 }));

// Старт: каждому герою по 1 реальной карте (базовая) + 2 универсальные мод-карты в общую колоду.
const createInitialDeck = () => shuffleArray([
  ...INITIAL_PLAYERS_DATA.map(({ id }) => createStarterCard(id)),
  ...createStarterModCards(),
]);

// Гарантирует, что у каждого героя есть хотя бы стартовая карта (без пустышек-балласта)
const ensureFullDeck = (cards) => {
  const deck = [...cards];
  INITIAL_PLAYERS_DATA.forEach(({ id }) => {
    const hasReal = deck.some(c => c.ownerId === id && isRealDeckCard(c));
    if (!hasReal) deck.push(createStarterCard(id));
  });
  return deck;
};

// Уровень карты — растёт при выборе улучшения на level-up (x2 урона за каждый уровень)
const getCardLevel = (card) => (card && card.level) || 1;
const getLevelMultiplier = (card) => Math.pow(2, getCardLevel(card) - 1);

// --- МОДИФИКАЦИОННЫЕ КАРТЫ: универсальные, не привязаны к классу, выдаются любому герою ---
// armor: +броня герою до конца раунда (сбрасывается при новой раздаче). chain: +к следующей карте в этом ходу игрока.
const MOD_CARDS = {
  armor: { id: 'mod_armor', name: 'Закал брони', cost: 0, icon: '🛡️', type: 'self', rarity: 'RARE', vfxType: null, modType: 'armor', modValue: 8 },
  chain: { id: 'mod_chain', name: 'Усиление цепи', cost: 1, icon: '🔗', type: 'self', rarity: 'RARE', vfxType: null, modType: 'chain', modValue: 12 },
};
const MOD_CARD_LIST = Object.values(MOD_CARDS);
const isModCard = (card) => !!(card && card.modType);
// Значение мод-карты растёт линейно с уровнем (ур.2 = x2 и т.д.)
const getModValue = (card) => Math.round((card?.modValue || 0) * getCardLevel(card));

const getMaxHpFromStats = (player, equippedItem = null) => {
  return (player.baseMaxHp ?? 20) + (equippedItem?.stats?.hp || 0);
};

const syncPlayerMaxHp = (player, equippedItem = null) => {
  const maxHp = getMaxHpFromStats(player, equippedItem);
  return { ...player, maxHp, hp: Math.min(player.hp, maxHp) };
};

const getCardDmgType = (card) => card?.dmgType || 'melee';

// Цвет урона карты по типу урона: магия → синий, дальний → зелёный, ближний → красный
const getCardStatColor = (card) => {
  const t = getCardDmgType(card);
  if (t === 'magic') return 'text-blue-400';
  if (t === 'ranged') return 'text-green-400';
  return 'text-red-400';
};

// Базовая мощность карты (вместо привязки к статам героя).
// Нерф ×0.5 (было 15): единая точка урона всех карт — превью, розыгрыш и
// проверка летальности QTE считаются через неё же, ничего не расходится.
const CARD_BASE_POWER = 7.5;

// ЕДИНАЯ формула урона: базовая мощность карты × уровень × модификатор предметов × бонус.
// Урон НЕ зависит от силы/ловкости/интеллекта. Предметы дают прямые модификаторы:
//   физ. карты усиливаются +Атакой (%), магические — +Магической атакой (%).
const computeCardDamage = (owner, card, bonus = 1) => {
  if (!card) return { damage: 0, critChance: 0 };
  const base = (card.mult || 1) * CARD_BASE_POWER * getLevelMultiplier(card);
  const isMagic = getCardDmgType(card) === 'magic';
  const atkPct = isMagic ? (owner?.matk || 0) : (owner?.atk || 0);
  const total = base * (1 + atkPct / 100) * bonus;
  const critChance = Math.min(0.75, (owner?.crit || 0) / 100);
  return { damage: Math.max(1, Math.round(total)), critChance };
};

const getCardDamage = (owner, card, bonus = 1) => computeCardDamage(owner, card, bonus).damage;

// Превью урона при наведении на абилку (без рандомного крита; метка/vuln учитываются)
const computePreviewDamageOnEnemy = (owner, card, enemy, comboMult = 1, chainBonus = 0) => {
  let { damage: baseDamage } = computeCardDamage(owner, card, comboMult);
  if (chainBonus > 0) baseDamage += chainBonus;
  let dmg = baseDamage;
  const mark = enemy.statuses?.mark;
  if (mark) dmg = Math.floor(dmg * 2 * (mark.mult || 1));
  const vuln = enemy.statuses?.vuln;
  if (vuln) dmg = Math.floor(dmg * (1 + vuln.amount));
  return { damage: dmg, isLethal: dmg >= enemy.hp };
};

// --- Прогрессия: пороги уровней ---
// Нерф темпа ×2 (было 60 + 50×N): уровни приходили слишком часто.
// Действует ВМЕСТЕ с нерфом входящего XP ×0.5 в gainXp — суммарно темп ×4 медленнее исходного.
const XP_BASE_THRESHOLD = 120; // XP до 2-го уровня
const XP_THRESHOLD_STEP = 100; // прирост порога за каждый уровень

// --- QTE «Perfect Hit» ---
// Множитель итогового урона карты по результату QTE
const QTE_RESULT_MULT = { perfect: 1.35, good: 1.15, miss: 1.0 };
const QTE_BASE_MS = 900;
const QTE_MIN_MS = 350; // хард-кап: предел человеческой реакции
const QTE_RARITY_PENALTY_MS = { RARE: 100, EPIC: 250, LEGENDARY: 400 };

// Скорость сужения кольца: чем сильнее карта и глубже комбо — тем быстрее.
// chainPos — 1-based позиция карты в цепочке комбо (1 = одиночная / первое звено).
const calculateQteDuration = (card, chainPos) => {
  const rarityPenalty = QTE_RARITY_PENALTY_MS[card.rarity] || 0;
  const comboPenalty = chainPos >= 3 ? 200 : chainPos === 2 ? 100 : 0;
  return Math.max(QTE_MIN_MS, QTE_BASE_MS - rarityPenalty - comboPenalty);
};

// QTE положен, если карта «важная»: звено комбо 2+, эпик/легендарка,
// в целях босс или цель с Меткой, либо удар ожидаемо летален.
const shouldTriggerQte = (card, chainPos, targets, expectedLethal) =>
  chainPos >= 2 ||
  card.rarity === 'EPIC' || card.rarity === 'LEGENDARY' ||
  targets.some(t => t.isBoss) ||
  targets.some(t => t.statuses?.mark) ||
  expectedLethal;

// Броня поглощает урон и уменьшается; остаток идёт в HP
const applyIncomingDamage = (player, rawDmg) => {
  const armor = player.armor || 0;
  const absorbed = Math.min(armor, rawDmg);
  const hpLoss = Math.max(0, rawDmg - absorbed);
  return {
    newHp: Math.max(0, player.hp - hpLoss),
    newArmor: armor - absorbed,
    hpLoss,
  };
};

const rollCardDamage = (owner, card, bonus = 1) => {
  const { damage, critChance } = computeCardDamage(owner, card, bonus);
  const isCrit = Math.random() < critChance;
  return { damage: isCrit ? Math.floor(damage * 2) : damage, isCrit, critChance };
};

// --- ВТОРИЧНЫЕ ЭФФЕКТЫ АБИЛОК ---

// База силы вторичных эффектов (отвязана от статов). Растёт с уровнем карты.
const SECONDARY_BASE_POWER = 14;
const getSecondaryStatValue = (owner, effect, card) => {
  return SECONDARY_BASE_POWER * getLevelMultiplier(card || {});
};

// Краткое описание эффекта с подсчитанной величиной (для тултипа карточки)
const getSecondaryDesc = (owner, card) => {
  if (!card?.secondary) return null;
  const effect = card.secondary.effect;
  const def = SECONDARY_EFFECTS[effect];
  if (!def) return null;
  const v = getSecondaryStatValue(owner, effect, card);
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
  const targetLine = getTargetingLabel(getCardTargeting(card));
  const secondary = getSecondaryDesc(owner, card);
  const effectLine = secondary
    ? { icon: secondary.def.icon, label: secondary.def.label, value: secondary.valueText, color: secondary.def.color }
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
  const v = getSecondaryStatValue(owner, effect, card) * comboMult;
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

const getTargetText = (targeting) => {
  switch (targeting) {
    case CARD_TARGETING.RANDOM2: return '2 случайным врагам.';
    case CARD_TARGETING.STRONGEST: return 'самому сильному врагу.';
    default: return 'всем врагам.';
  }
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
  // Компактная карта: средние слои 2–3 узла (было 2–6) — читаемее и быстрее проходится
  const counts = [
    1,
    2,
    Math.floor(Math.random() * 2) + 2,
    Math.floor(Math.random() * 2) + 2,
    Math.floor(Math.random() * 2) + 2,
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
        if (curr[c].next.length < 2) {
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
      // Меньше ветвлений: максимум 2 исходящих ребра (было до 3) — граф читается сразу
      const numBranches = Math.floor(Math.random() * 2) + 1;
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
    const hp = Math.round((baseHp + s * perStage) * mult * ENEMY_POWER_MULT);
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

const CardTiltContext = createContext({ x: 0, y: 0, isHovered: false });

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

    const rotateX = ((centerY - y) / centerY) * 16;
    const rotateY = ((x - centerX) / centerX) * 16;

    setRotation({ x: rotateX, y: rotateY });
    setGlare({ x: (x / card.width) * 100, y: (y / card.height) * 100, opacity: 0.18 });
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
    <CardTiltContext.Provider value={{ x: rotation.x, y: rotation.y, isHovered: isHovered && !isDisabled }}>
    <div 
      className={`relative ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `scale(${isHovered && !isDisabled ? 1.14 : 1}) translate(${globalShake.x * 0.5}px, ${globalShake.y * 0.5}px)`,
        transition: 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)',
        transformStyle: 'preserve-3d',
        zIndex: isHovered ? 50 : 1,
      }}
    >
      <div
        className="relative w-full h-full"
        style={{
          transform: `perspective(1000px) rotateX(${rotation.x + globalShake.rot}deg) rotateY(${rotation.y + globalShake.rot}deg)`,
          transformStyle: 'preserve-3d',
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
    </div>
    </CardTiltContext.Provider>
  );
};

const CARD_DEAL_FLY_MS = 725;
const CARD_DEAL_STAGGER_MS = 150; // было 300
const CARD_DEAL_FINISH_PAD_MS = 500; // было 1000

const FlyingCard = React.memo(({ startX, startY, endX, endY, isDiscard = false, isReshuffle = false, flyMs = 850 }) => {
  const [style, setStyle] = useState({
    left: `${startX}px`, top: `${startY}px`, transform: 'translate(-50%, -50%) scale(0.2)', opacity: 0,
  });

  useEffect(() => {
    const t = setTimeout(() => {
      setStyle({
        left: `${endX}px`, top: `${endY}px`,
        transform: `translate(-50%, -50%) scale(${isDiscard || isReshuffle ? 0.3 : 1.0}) rotate(${isReshuffle ? -360 : isDiscard ? 720 : 0}deg)`,
        opacity: 1,
        transition: `all ${flyMs}ms ${isDiscard || isReshuffle ? 'cubic-bezier(0.5, -0.5, 0.5, 1.5)' : 'cubic-bezier(0.16, 1, 0.3, 1)'}`
      });
    }, 20);
    return () => clearTimeout(t);
  }, [endX, endY, isDiscard, isReshuffle, flyMs]);

  return (
    <div className={`fixed z-[999] w-40 h-60 border-2 border-amber-400 rounded-xl bg-slate-800 shadow-2xl pointer-events-none ${isReshuffle ? 'brightness-125' : ''}`} style={style}>
      <div className="h-6 w-full bg-[#7a1c1c] rounded-t-lg"></div>
      <div className="flex-1 flex items-center justify-center p-3 bg-slate-900/60 h-[calc(100%-24px)] rounded-b-lg">
        <div className="w-12 h-12 border-4 border-dashed border-slate-700 rounded-full opacity-30"></div>
      </div>
    </div>
  );
});

const DamagePopup = React.memo(({ id, value, x, y, isCrit, text, color, onComplete }) => {
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
});

const FlyingXp = React.memo(({ id, amount, startX, startY, endX, endY, onComplete }) => {
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
});

const FlyingItem = React.memo(({ id, item, startX, startY, endX, endY, onComplete }) => {
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
});

const ItemTooltip = React.memo(({ item, x, y }) => {
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
      {(() => {
        const list = formatItemStatsList(item.stats);
        if (!list.length) return <div className="text-[12px] text-slate-400 leading-relaxed font-medium">Без бонусов</div>;
        return (
          <div className="flex flex-col gap-0.5">
            {list.map((p, i) => (
              <div key={i} className="text-[12px] leading-relaxed font-bold flex justify-between">
                <span className="text-slate-300">{p.label}</span>
                <span className="text-green-400">{p.display}</span>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
});

// Крутящийся символ комбо/синергии справа от арены. Две руны вращаются
// независимо в разные стороны, в центре — номер карты в цепочке комбо.
const ComboIndicator = React.memo(({ count }) => {
  if (!count) return null;
  return (
    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-[45%] z-30 pointer-events-none flex items-center justify-center w-60 h-60 animate-in fade-in zoom-in-75 duration-300">
      <img src="./combo_rune_outer.webp" alt="" className="absolute inset-0 w-full h-full object-contain opacity-80"
        style={{ animation: 'comboSpinCW 9s linear infinite', filter: 'drop-shadow(0 0 10px rgba(245,158,11,0.75))' }} />
      <img src="./combo_rune_inner.webp" alt="" className="absolute inset-0 w-full h-full object-contain opacity-90"
        style={{ animation: 'comboSpinCCW 6s linear infinite', filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.9))' }} />
      <span key={count} className="relative z-10 text-7xl font-black text-amber-200 drop-shadow-[0_0_12px_rgba(245,158,11,1)]"
        style={{ animation: 'comboNumPop 0.35s ease-out' }}>{count}</span>
    </div>
  );
});

const ItemSlot = React.memo(({ item, selected, emptyLabel, onClick, onMouseEnter, onMouseLeave, size = 'md', draggable: isDraggable, onDragStart, onDragOver, onDragLeave, onDrop, isDragOver, equip = false }) => {
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
});

const BloodParticle = React.memo(({ id, x, y, onComplete }) => {
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
});

// Масштаб VFX атаки по длине комбо: 1-я карта / 2-я / 3-я+
const COMBO_VFX_SCALE = [1, 1.35, 1.65];
const VFX_MULTI_TYPES = new Set(['daggers', 'poison']);
const COMBO_VFX_PARTICLE_COUNT = [6, 9, 12];
const COMBO_VFX_DUR_MS = [420, 460, 500];
const COMBO_BLOOD_COUNT = [18, 14, 10];

// Эффект «печати» при получении брони / усиления цепи
const ModStampEffect = ({ id, icon, amount, variant, x, y, onComplete }) => {
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => {
    const t = setTimeout(() => onCompleteRef.current(id), 1300);
    return () => clearTimeout(t);
  }, [id]);

  const isArmor = variant === 'armor';
  const ringColor = isArmor ? 'rgba(56,189,248,0.85)' : 'rgba(251,191,36,0.85)';
  const glowColor = isArmor ? 'rgba(56,189,248,0.55)' : 'rgba(251,191,36,0.55)';

  return (
    <div className="fixed z-[980] pointer-events-none" style={{ left: x, top: y }}>
      <div className="absolute rounded-full border-[10px]" style={{
        left: 0, top: 0, width: 400, height: 400, marginLeft: -200, marginTop: -200,
        borderColor: ringColor, animation: 'modStampRing 650ms ease-out forwards',
      }} />
      <div className="absolute flex flex-col items-center justify-center" style={{
        left: 0, top: 0, width: 320, height: 320, marginLeft: -160, marginTop: -160,
        animation: 'modStampSlam 550ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
        filter: `drop-shadow(0 0 56px ${glowColor}) drop-shadow(0 16px 0 rgba(0,0,0,0.85))`,
      }}>
        <span className="leading-none select-none" style={{ fontSize: 176 }}>{icon}</span>
        <span className={`font-black text-4xl mt-2 ${isArmor ? 'text-sky-200' : 'text-amber-200'}`}
          style={{ WebkitTextStroke: '3px rgba(0,0,0,0.9)', textShadow: '4px 4px 0 rgba(0,0,0,1)' }}>
          +{amount}
        </span>
      </div>
    </div>
  );
};

// Прицел с цифрой урона на подсвеченной цели
const TargetReticle = ({ damage, lethal }) => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[70]">
    <div className={`relative w-[72px] h-[72px] ${lethal ? 'text-red-500' : 'text-sky-100'}`}>
      <div className="absolute left-1/2 top-0 bottom-0 w-[2px] -translate-x-1/2 bg-current opacity-90 rounded-full" />
      <div className="absolute top-1/2 left-0 right-0 h-[2px] -translate-y-1/2 bg-current opacity-90 rounded-full" />
      <div className={`absolute inset-2 border-2 rounded-full ${lethal ? 'border-red-500' : 'border-current'} opacity-75`} />
      <div className={`absolute inset-[18px] border border-dashed rounded-full ${lethal ? 'border-red-400/60' : 'border-white/40'} opacity-60`} />
      <span
        className={`absolute inset-0 flex items-center justify-center font-black text-xl tabular-nums ${lethal ? 'text-red-400' : 'text-white'}`}
        style={{ WebkitTextStroke: '2px rgba(0,0,0,0.95)', textShadow: '0 2px 6px rgba(0,0,0,1)' }}
      >
        {damage}
      </span>
    </div>
  </div>
);

// Бейджи мод-эффектов поверх спрайта героя на поле боя (GDD 2.3 / 3.4)
const HeroFieldBadges = ({ armor, chainBonus }) => {
  const showArmor = armor > 0;
  const showChain = chainBonus > 0;
  if (!showArmor && !showChain) return null;
  return (
    <div className="absolute inset-0 z-[60] pointer-events-none flex flex-col items-center justify-start gap-1">
      {showArmor && (
        <div className="flex items-center gap-0.5 bg-slate-950/95 border-2 border-sky-500/70 rounded-xl px-2 py-1 shadow-[0_0_14px_rgba(56,189,248,0.45)] -translate-y-3">
          <span className="text-base leading-none">🛡️</span>
          <span className="text-sm font-black text-sky-200 tabular-nums leading-none">{armor}</span>
        </div>
      )}
      {showChain && (
        <div className="flex items-center gap-0.5 bg-slate-950/95 border-2 border-amber-500/70 rounded-xl px-2 py-1 shadow-[0_0_14px_rgba(251,191,36,0.45)] -translate-y-3">
          <span className="text-base leading-none">🔗</span>
          <span className="text-sm font-black text-amber-200 tabular-nums leading-none">+{chainBonus}</span>
        </div>
      )}
    </div>
  );
};

const CombatVfx = ({ vfx }) => {
  const cs = vfx.comboScale || 1;
  const tier = vfx.comboTier || 0;
  const durMs = COMBO_VFX_DUR_MS[tier] || 420;
  const tx = vfx.endX - vfx.startX;
  const ty = vfx.endY - vfx.startY;
  const isTravel = ['magic_spark', 'fireball', 'ice_spike', 'lightning', 'dark_void', 'enemy', 'daggers', 'poison', 'dagger_single', 'arrow'].includes(vfx.type);
  const originX = isTravel ? vfx.startX + (vfx.scatterX || 0) : vfx.endX;
  const originY = isTravel ? vfx.startY + (vfx.scatterY || 0) : vfx.endY;

  const baseStyle = {
    left: originX,
    top: originY,
    willChange: 'transform, opacity',
  };

  const [style, setStyle] = useState({
    ...baseStyle,
    opacity: 0,
    transform: 'translate(-50%, -50%) translate3d(0,0,0) scale(0.1)',
  });

  useEffect(() => {
    const timers = [];
    const run = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); };
    const tf = (dx, dy, scale, rot = '') =>
      `translate(-50%, -50%) translate3d(${dx}px, ${dy}px, 0) scale(${scale})${rot ? ` ${rot}` : ''}`;
    const trans = `transform ${durMs}ms ease-out, opacity ${Math.min(durMs, 320)}ms ease-out`;

    run(() => {
      if (['magic_spark', 'fireball', 'ice_spike', 'lightning', 'dark_void', 'enemy'].includes(vfx.type)) {
        setStyle(s => ({ ...s, opacity: 1, transform: tf(0, 0, 0.5 * cs) }));
        run(() => setStyle(s => ({ ...s, opacity: 1, transform: tf(tx, ty, 1.5 * cs), transition: trans })), 20);
      } else if (['slash', 'smash', 'dark_strike'].includes(vfx.type)) {
        setStyle(s => ({ ...s, opacity: 1, transform: tf(0, 0, 0.2 * cs, 'rotate(-45deg)') }));
        run(() => setStyle(s => ({ ...s, opacity: 0, transform: tf(0, 0, 2 * cs, 'rotate(45deg)'), transition: trans })), 20);
      } else if (['daggers', 'poison', 'dagger_single', 'arrow'].includes(vfx.type)) {
        const angle = Math.atan2(ty, tx) * 180 / Math.PI;
        const spin = vfx.type === 'arrow' ? 0 : 360;
        setStyle(s => ({ ...s, opacity: 1, transform: tf(0, 0, cs, `rotate(${angle + 90}deg)`) }));
        run(() => setStyle(s => ({
          ...s, opacity: 1,
          transform: tf(tx, ty, cs, `rotate(${angle + 90 + spin}deg)`),
          transition: trans,
        })), 20);
      }
    }, vfx.delay || 0);

    return () => timers.forEach(clearTimeout);
  }, [vfx, cs, durMs, tx, ty]);

  const sparkCount = vfx.showSparks ? (tier >= 2 ? 4 : tier >= 1 ? 3 : 0) : 0;
  const sparks = sparkCount > 0 ? Array.from({ length: sparkCount }, (_, i) => ({
    key: i,
    left: 50 + Math.cos(i * (Math.PI * 2 / sparkCount)) * (36 + tier * 10),
    top: 50 + Math.sin(i * (Math.PI * 2 / sparkCount)) * (36 + tier * 10),
    size: 3 + tier * 2,
  })) : [];

  const wrap = (node) => (
    <div style={style} className="fixed z-[1000] pointer-events-none flex items-center justify-center">
      {node}
      {sparks.map(s => (
        <div key={s.key} className="absolute rounded-full bg-white opacity-90"
          style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, transform: 'translate(-50%,-50%)', boxShadow: '0 0 6px rgba(255,255,255,0.8)' }} />
      ))}
    </div>
  );

  const heroId = vfx.heroId;

  // --- Маг (p3): фиолетовое + черепа ---
  if (heroId === 'p3') {
    if (vfx.type === 'magic_spark') return wrap(
      <div className="rounded-full bg-purple-300 shadow-[0_0_20px_#fff,0_0_40px_#a855f7,0_0_80px_#581c87] flex items-center justify-center" style={{ width: 56 * cs, height: 56 * cs }}>
        <span className="drop-shadow-[0_0_10px_#a855f7]" style={{ fontSize: `${28 * cs}px` }}>💀</span>
      </div>
    );
    if (vfx.type === 'fireball') return wrap(
      <div className="drop-shadow-[0_0_28px_#a855f7]" style={{ fontSize: `${56 * cs}px`, filter: `drop-shadow(0 0 ${20 * cs}px #7e22ce) drop-shadow(0 0 ${10 * cs}px #c084fc)` }}>💀</div>
    );
    if (vfx.type === 'ice_spike') return wrap(
      <div style={{ fontSize: `${50 * cs}px`, filter: `drop-shadow(0 0 ${14 * cs}px #a855f7) drop-shadow(0 0 ${6 * cs}px #f5d0fe)` }}>💀</div>
    );
    if (vfx.type === 'lightning') return wrap(
      <div style={{ fontSize: `${62 * cs}px`, filter: `drop-shadow(0 0 ${22 * cs}px #c084fc) drop-shadow(0 0 ${8 * cs}px #581c87)` }}>⚡</div>
    );
    if (vfx.type === 'dark_void') return wrap(
      <div className="rounded-full bg-black border-2 border-purple-400 shadow-[0_0_70px_#a855f7,inset_0_0_24px_#3b0764] flex items-center justify-center" style={{ width: 96 * cs, height: 96 * cs }}>
        <span style={{ fontSize: `${44 * cs}px`, filter: `drop-shadow(0 0 ${10 * cs}px #c084fc)` }}>💀</span>
      </div>
    );
  }

  // --- Воин (p1): красное + огонь ---
  if (heroId === 'p1') {
    if (vfx.type === 'slash') return wrap(
      <div className="border-t-[18px] border-r-[18px] border-red-400 rounded-full shadow-[0_0_30px_#ef4444,0_0_60px_#7f1d1d]" style={{ width: 200 * cs, height: 200 * cs }} />
    );
    if (vfx.type === 'smash') return wrap(
      <div className="flex items-center justify-center" style={{ width: 260 * cs, height: 260 * cs }}>
        <div className="absolute border-t-[24px] border-r-[24px] border-orange-500 rounded-full shadow-[0_0_50px_#ea580c,0_0_90px_#7f1d1d]" style={{ width: 260 * cs, height: 260 * cs }} />
        <span style={{ fontSize: `${64 * cs}px`, filter: `drop-shadow(0 0 ${18 * cs}px #f59e0b)` }}>🔥</span>
      </div>
    );
  }

  // --- Разбойник (p2): зелёное ---
  if (heroId === 'p2') {
    if (vfx.type === 'dagger_single' || vfx.type === 'daggers') return wrap(
      <div style={{ fontSize: `${38 * cs}px`, filter: `drop-shadow(0 0 ${12 * cs}px #22c55e) drop-shadow(0 0 ${4 * cs}px #4ade80)` }}>🗡️</div>
    );
    if (vfx.type === 'poison') return wrap(
      <div style={{ fontSize: `${38 * cs}px`, filter: `drop-shadow(0 0 ${20 * cs}px #16a34a) drop-shadow(0 0 ${8 * cs}px #86efac)` }}>🧪</div>
    );
  }

  // --- Враги / дефолт ---
  if (vfx.type === 'magic_spark') return wrap(<div className="w-12 h-12 bg-white rounded-full shadow-[0_0_20px_#fff,0_0_40px_#42C0E8,0_0_80px_#E33371] flex items-center justify-center" style={{ transform: `scale(${cs})` }}><div className="w-8 h-8 bg-[#42C0E8] rounded-full blur-[2px] opacity-90" /></div>);
  if (vfx.type === 'fireball') return wrap(<div className="bg-orange-500 rounded-full shadow-[0_0_40px_#ea580c,inset_0_0_15px_#fef08a]" style={{ width: 56 * cs, height: 56 * cs }} />);
  if (vfx.type === 'ice_spike') return wrap(<div className="drop-shadow-[0_0_15px_#06b6d4]" style={{ fontSize: `${48 * cs}px` }}>🧊</div>);
  if (vfx.type === 'lightning') return wrap(<div className="drop-shadow-[0_0_20px_#eab308]" style={{ fontSize: `${60 * cs}px` }}>⚡</div>);
  if (vfx.type === 'dark_void') return wrap(<div className="bg-black rounded-full shadow-[0_0_60px_#9333ea,inset_0_0_20px_#4c1d95] border-2 border-purple-500" style={{ width: 80 * cs, height: 80 * cs }} />);
  if (vfx.type === 'enemy') return wrap(<div className="bg-[#D32F2F] rounded-full shadow-[0_0_30px_#D32F2F]" style={{ width: 32 * cs, height: 32 * cs }} />);

  if (vfx.type === 'slash') return wrap(<div className="border-t-[16px] border-r-[16px] border-white rounded-full shadow-[0_0_20px_#1E88E5]" style={{ width: 192 * cs, height: 192 * cs }} />);
  if (vfx.type === 'smash') return wrap(<div className="border-t-[24px] border-r-[24px] border-amber-500 rounded-full shadow-[0_0_40px_#d97706]" style={{ width: 256 * cs, height: 256 * cs }} />);
  if (vfx.type === 'dark_strike') return wrap(<div className="border-t-[20px] border-r-[20px] border-purple-900 rounded-full shadow-[0_0_30px_#000]" style={{ width: 224 * cs, height: 224 * cs }} />);

  if (vfx.type === 'dagger_single' || vfx.type === 'daggers') return wrap(<div className="drop-shadow-[0_0_10px_#36B373]" style={{ fontSize: `${36 * cs}px` }}>🗡️</div>);
  if (vfx.type === 'arrow') return wrap(<div className="drop-shadow-[0_0_8px_#94a3b8]" style={{ fontSize: `${28 * cs}px` }}>🏹</div>);
  if (vfx.type === 'poison') return wrap(<div className="drop-shadow-[0_0_20px_#22c55e]" style={{ fontSize: `${36 * cs}px` }}>🧪</div>);

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

const BG_MASK_URL = './bg/mask.webp';
// ЧБ пиксель-арт локации. Красятся на лету через mix-blend-mode: color —
// аналог Hue/Saturation (Colorize) из Photoshop: hue/sat берутся из оверлея, яркость из картинки.
const BG_LOCATION_SETS = [
  { name: 'cemetery',      hue: 191, sat: 25, images: ['./bg/locations/cemetery_01.webp', './bg/locations/cemetery_02.webp', './bg/locations/cemetery_03.webp'] },
  { name: 'torture',       hue: 14,  sat: 20, images: ['./bg/locations/torture_01.webp', './bg/locations/torture_02.webp', './bg/locations/torture_03.webp'] },
  { name: 'dungeon_reach', hue: 304, sat: 30, images: ['./bg/locations/dungeon_reach_01.webp', './bg/locations/dungeon_reach_02.webp', './bg/locations/dungeon_reach_03.webp'] },
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

const AbilityCard = ({ card, owner, mana, maxMana, isDisabled, showOwnerLabel = false, comboState, growDamage = false, chainBonus = 0 }) => {
  const [grow, setGrow] = useState(false);
  const tilt = useContext(CardTiltContext);
  useEffect(() => {
    if (!growDamage) return;
    const t0 = setTimeout(() => setGrow(true), 60);
    const t1 = setTimeout(() => setGrow(false), 1100);
    return () => { clearTimeout(t0); clearTimeout(t1); };
  }, [growDamage]);

  if (!card) return null;
  const rarity = RARITIES[card.rarity] || RARITIES.COMMON;
  const { isCandidate, willGiveBonus, comboStep = 0, comboPct = 0 } = comboState;
  const targeting = getCardTargeting(card);
  const level = getCardLevel(card);
  const mod = isModCard(card);
  // Значение мод-карты с учётом комбо-скейла (если карта — следующее звено цепочки)
  const modBase = getModValue(card);
  const modAmount = (mod && willGiveBonus) ? Math.round(modBase * COMBO_DAMAGE_MULT[Math.min(comboStep, 2)]) : modBase;

  const calcDmg = (o) => {
    if (mod || !o) return 0;
    let d = getCardDamage(o, card);
    if (willGiveBonus) d = Math.floor(d * COMBO_DAMAGE_MULT[Math.min(comboStep, 2)]);
    if (chainBonus > 0) d += chainBonus;
    return d;
  };
  const dmg = calcDmg(owner);
  const buffedByChain = !mod && chainBonus > 0;
  const statColor = getCardStatColor(card);
  const base = getCardDescription(owner, card);
  const effectLine = base.effectLine;
  // Цель — текстом в тот же абзац (без отдельного блока)
  const targetSuffix = getTargetingLabel(targeting, true);

  const displayRarityName = showOwnerLabel && owner ? `${rarity.name} - ${owner.name}` : rarity.name;
  const parallaxX = tilt.y * 0.5;
  const parallaxY = -tilt.x * 0.5;

  return (
    <div className={`w-full h-full border ${rarity.border} rounded-2xl flex flex-col overflow-hidden relative shadow-inner bg-[#45475a] ${isCandidate && !isDisabled ? 'ring-2 ring-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.6)]' : ''}`}>
      <div className={`${rarity.header} py-1.5 px-2.5 border-b border-black/20 flex items-center justify-between shadow-md`}>
        <span className={`font-bold text-[11px] ${rarity.text} uppercase tracking-wider truncate drop-shadow-md`}>{String(card.name)}{level > 1 && <span className="text-amber-300"> ур.{String(level)}</span>}</span>
        <div className={`w-[22px] h-[22px] rounded-full flex items-center justify-center font-black text-[10px] border-2 border-white/20 shadow-lg text-white ${mana < card.cost ? 'bg-red-500' : 'bg-[#1E88E5]'}`}>{String(card.cost)}</div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center relative p-1 bg-[#373945] min-h-[40px] overflow-visible" style={{ transformStyle: 'preserve-3d' }}>
        {isCandidate && (<div className="absolute top-1 left-1 bg-yellow-400 text-black text-[9px] font-black px-1.5 py-0.5 rounded shadow-lg animate-bounce z-10">COMBO{willGiveBonus && comboPct > 0 ? ` +${comboPct}%` : '!'}</div>)}
        <span
          className="drop-shadow-2xl select-none leading-none"
          style={{
            fontSize: '2.03rem',
            transform: `translate3d(${parallaxX}px, ${parallaxY}px, 0)`,
            transition: 'none',
          }}
        >{String(card.icon)}</span>
      </div>
      <div className="text-center leading-none bg-[#50546d] border-t border-slate-600/30 px-2 pt-4 pb-2 flex flex-col justify-center gap-0.5 min-h-[76px] relative">
        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full ${rarity.badgeBg} shadow-md z-10 whitespace-nowrap`}>
          <span className="text-[10px] font-black italic text-[#FFFFE0] uppercase tracking-wide drop-shadow-sm">{displayRarityName}</span>
        </div>
        {mod ? (
          <>
            <p className="text-[11px] text-slate-100 font-semibold leading-tight">
              {card.modType === 'armor' ? (
                <>Броня <span className={`font-black text-[14px] ${willGiveBonus ? 'text-yellow-400' : 'text-sky-300'}`}>+{modAmount}</span></>
              ) : (
                <>След. карта <span className={`font-black text-[14px] ${willGiveBonus ? 'text-yellow-400' : 'text-amber-300'}`}>+{modAmount}</span> урона</>
              )}
            </p>
            <p className="text-[10px] leading-none mt-0.5 text-slate-400">{card.modType === 'armor' ? 'Снижает урон до конца раунда' : 'Бонус к следующей карте в этом ходу'}</p>
          </>
        ) : (
          <>
            <p className="text-[11px] text-slate-100 font-semibold leading-tight">
              Наносит{' '}
              <span
                className={`font-black text-[13px] transition-all duration-300 ${grow ? 'text-green-400' : (willGiveBonus ? 'text-yellow-400' : (buffedByChain ? 'text-amber-300' : statColor))}`}
                style={{ display: 'inline-block', transform: grow ? 'scale(1.4)' : 'scale(1)', textShadow: grow ? '0 0 14px rgba(34,197,94,0.95)' : 'none' }}
              >{String(dmg)}</span>{' '}
              урона <span className="text-slate-300">{targetSuffix}</span>
            </p>
            {effectLine && (
              <p className={`text-[10px] font-bold leading-none mt-0.5 ${effectLine.color}`}>
                {effectLine.icon} {effectLine.label}{effectLine.value ? `: ${effectLine.value}` : ''}
              </p>
            )}
          </>
        )}
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
  './corner.webp',
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

const PrepScreen = ({ players, pools, soulEmbers, soulProgress = 0, emberThreshold = EMBER_JUNK_THRESHOLD, prepCardsBought, onBuyCard, onBurnCard, onStart, fromTavern = false, onClose }) => {
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
                          {!card.isStarter && (
                          <button
                            type="button"
                            onClick={() => soulEmbers >= PREP_BURN_COST && onBurnCard(card.id)}
                            disabled={soulEmbers < PREP_BURN_COST}
                            title={soulEmbers >= PREP_BURN_COST ? 'Сжечь карту (1 🔥)' : 'Нужен 1 огонёк души'}
                            className={`absolute -top-2 -right-2 w-6 h-6 rounded-full border text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-110 transition-all shadow-lg z-10 ${soulEmbers >= PREP_BURN_COST ? 'bg-red-900 border-red-500 cursor-pointer' : 'bg-slate-800 border-slate-600 opacity-40 cursor-not-allowed'}`}
                          >🔥</button>
                          )}
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

        {fromTavern ? (
          <button type="button" onClick={onClose ?? onStart} className="px-16 py-5 bg-white text-slate-900 rounded-full font-black text-2xl hover:scale-110 active:scale-95 transition-all shadow-[0_0_30px_rgba(255,255,255,0.4)] uppercase tracking-tighter">ОК</button>
        ) : (
          <button type="button" onClick={onStart} className="px-16 py-5 bg-white text-slate-900 rounded-full font-black text-2xl hover:scale-110 active:scale-95 transition-all shadow-[0_0_30px_rgba(255,255,255,0.4)] uppercase tracking-tighter">Старт</button>
        )}
      </div>

      {/* Режим «оверлей поверх таверны»: крестик закрытия. */}
      {fromTavern && (
        <button
          type="button"
          onClick={onClose ?? onStart}
          className="absolute top-4 right-4 z-30 w-12 h-12 flex items-center justify-center
                     rounded-full bg-black/60 hover:bg-black/85 text-white text-3xl font-black
                     border border-white/20 hover:border-white/40 transition-all shadow-lg"
          aria-label="Закрыть"
        >
          ×
        </button>
      )}
    </div>
  );
};

// --- СЕКВЕНЦИЯ РАСКРЫТИЯ ПОЛУЧЕННОЙ КАРТЫ (открытие слота) ---
// Фаза 1: карта появляется рубашкой к игроку. Фаза 2: саспенс — масштаб нарастает
// (easeInCubic). Фаза 3: на пике карта переворачивается, показывая лицо. Длительность ~3с.
// GDD 9.3: «snappy» reveal — 0.7 s total, прерываемый кликом/пробелом.
// 0.00s slam-in (overshoot scale) → 0.25s auto-flip + tier-colored flash → 0.70s settled+interactable.
const CardRevealOverlay = ({ card, owner, bgHue = 260, bgSat = 60, onDismiss }) => {
  const [slammed, setSlammed] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [flash, setFlash] = useState(false);
  const [settled, setSettled] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const timersRef = useRef([]);
  const skippedRef = useRef(false);

  // Мгновенно проматывает анимацию в конечное состояние, не вызывая dismiss.
  const skipAnimation = () => {
    if (skippedRef.current) return;
    skippedRef.current = true;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setSlammed(true);
    setFlipped(true);
    setFlash(false);
    setSettled(true);
  };

  useEffect(() => {
    playSound('./assets/sfx/ui/card_deal.wav', 0.5);
    const add = (fn, ms) => { const id = setTimeout(fn, ms); timersRef.current.push(id); };
    add(() => setSlammed(true), 16);
    add(() => { setFlipped(true); setFlash(true); playSound('./assets/sfx/game/level_up.wav'); }, 250);
    add(() => setFlash(false), 600);
    add(() => setSettled(true), 700);
    return () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };
  }, []);

  useEffect(() => {
    const handler = () => {
      // settled — анимация доиграла либо была пропущена. До этого момента клик/клавиша
      // только пропускает анимацию; после — сразу закрывает overlay.
      if (!settled) { skipAnimation(); return; }
      onDismiss();
    };
    window.addEventListener('keydown', handler);
    window.addEventListener('pointerdown', handler);
    return () => { window.removeEventListener('keydown', handler); window.removeEventListener('pointerdown', handler); };
  }, [onDismiss, settled]);

  const handleMove = (e) => {
    if (!settled) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    setTilt({ x: ((r.height / 2 - py) / (r.height / 2)) * 9, y: ((px - r.width / 2) / (r.width / 2)) * 9 });
  };

  const glow = RARITY_GLOW[card.rarity] || '#64748b';
  // Slam-in: 0.6 → 1.08 (overshoot) → 1.0; CSS transition с cubic-bezier даёт «упругий» удар.
  const scale = slammed ? 1 : 0.6;

  return (
    <div className="absolute inset-0 z-[2600] overflow-hidden flex flex-col items-center justify-center animate-in fade-in duration-150">
      <ShaderBackground hue={bgHue} sat={bgSat} speed={0.6} embedded />
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />
      <div className="relative" style={{ perspective: '1400px' }} onMouseMove={handleMove} onMouseLeave={() => setTilt({ x: 0, y: 0 })}>
        {/* Tier-colored flash burst — расширяющееся кольцо в момент переворота */}
        {flash && (
          <>
            <div
              className="absolute left-1/2 top-1/2 pointer-events-none rounded-full"
              style={{
                width: 24, height: 24, marginLeft: -12, marginTop: -12,
                border: `6px solid ${glow}`,
                boxShadow: `0 0 60px ${glow}`,
                animation: 'modStampRing 380ms ease-out forwards',
              }}
            />
            <div
              className="absolute left-1/2 top-1/2 pointer-events-none rounded-full"
              style={{
                width: 220, height: 220, marginLeft: -110, marginTop: -110,
                background: `radial-gradient(circle, ${glow}55 0%, transparent 70%)`,
                animation: 'modStampSlam 350ms ease-out forwards',
              }}
            />
          </>
        )}
        <div
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${scale})`,
            transition: 'transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <div
            className="w-52 h-[290px] relative"
            style={{
              transformStyle: 'preserve-3d',
              transform: `rotateY(${flipped ? 0 : 180}deg)`,
              transition: 'transform 350ms cubic-bezier(0.34, 1.2, 0.64, 1)',
            }}
          >
            <div className="absolute inset-0 rounded-2xl overflow-hidden" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', boxShadow: `0 0 55px ${glow}` }}>
              <AbilityCard card={card} owner={owner} mana={5} maxMana={5} isDisabled={false} comboState={{ isCandidate: false, willGiveBonus: false }} />
            </div>
            <div
              className="absolute inset-0 rounded-2xl border-2 border-slate-600 bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center"
              style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', boxShadow: 'inset 0 0 40px rgba(0,0,0,0.7)' }}
            >
              <img src="./corner.webp" alt="" aria-hidden="true" className="absolute top-1.5 left-1.5 w-16 h-16 opacity-40 pointer-events-none" />
              <img src="./corner.webp" alt="" aria-hidden="true" className="absolute bottom-1.5 right-1.5 w-16 h-16 opacity-40 pointer-events-none" style={{ transform: 'scale(-1)' }} />
              <span className="text-7xl opacity-25 select-none">✦</span>
            </div>
          </div>
        </div>
      </div>
      <p className="absolute bottom-16 text-slate-200 text-xs uppercase tracking-[0.35em] font-black drop-shadow-[0_0_12px_rgba(0,0,0,0.95)] opacity-70">
        {settled ? 'Клик / пробел — продолжить' : 'Клик / пробел — пропустить'}
      </p>
    </div>
  );
};

// --- ОКНО КОЛОДЫ: пуллы бойцов + живая очередь ротации карт ---

const DeckWindow = ({ players, pools, drawPile, onClose }) => {
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

  // Очередь = реальные карты резерва живых бойцов (без пустышек и паддинга);
  // в реальном порядке drawPile со сквозной нумерацией после руки.
  const liveDraw = drawPile.filter(c => !deadIds.has(c.ownerId) && isRealDeckCard(c));
  const deckSlots = liveDraw.map(c => ({ card: c, num: ++queueNum }));

  return (
    <div className="absolute inset-0 z-[1100] bg-black/45 flex flex-col items-center justify-center backdrop-blur-md animate-in fade-in duration-300 p-10">
      <div className="relative w-full max-w-5xl bg-slate-900/80 border border-slate-700 rounded-[32px] flex flex-col max-h-[85vh] overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
           <div>
             <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic">Колода</h2>
             <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">Пулл карт отряда · {String(CARD_POOL_SIZE)} слота на бойца · карт {String(Object.values(pools).reduce((a, arr) => a + arr.length, 0))}</p>
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
      <img src="./corner.webp" alt="" aria-hidden="true" className="pointer-events-none select-none absolute top-0 left-0 w-[340px] h-[340px] opacity-80 drop-shadow-[0_0_10px_rgba(0,0,0,0.9)]" />
      <img src="./corner.webp" alt="" aria-hidden="true" className="pointer-events-none select-none absolute top-0 right-0 w-[340px] h-[340px] opacity-80 drop-shadow-[0_0_10px_rgba(0,0,0,0.9)]" style={{ transform: 'scaleX(-1)' }} />
      <img src="./corner.webp" alt="" aria-hidden="true" className="pointer-events-none select-none absolute bottom-0 left-0 w-[340px] h-[340px] opacity-80 drop-shadow-[0_0_10px_rgba(0,0,0,0.9)]" style={{ transform: 'scaleY(-1)' }} />
      <img src="./corner.webp" alt="" aria-hidden="true" className="pointer-events-none select-none absolute bottom-0 right-0 w-[340px] h-[340px] opacity-80 drop-shadow-[0_0_10px_rgba(0,0,0,0.9)]" style={{ transform: 'scale(-1, -1)' }} />

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
      <img src="./corner.webp" alt="" aria-hidden="true" className="pointer-events-none select-none absolute top-0 left-0 w-[300px] h-[300px] opacity-60" />
      <img src="./corner.webp" alt="" aria-hidden="true" className="pointer-events-none select-none absolute top-0 right-0 w-[300px] h-[300px] opacity-60" style={{ transform: 'scaleX(-1)' }} />
      <img src="./corner.webp" alt="" aria-hidden="true" className="pointer-events-none select-none absolute bottom-0 left-0 w-[300px] h-[300px] opacity-60" style={{ transform: 'scaleY(-1)' }} />
      <img src="./corner.webp" alt="" aria-hidden="true" className="pointer-events-none select-none absolute bottom-0 right-0 w-[300px] h-[300px] opacity-60" style={{ transform: 'scale(-1, -1)' }} />

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

// --- ИЗОЛИРОВАННЫЙ СЛОЙ ЭФЕМЕРНЫХ ЭФФЕКТОВ ---
// Держит свой state для частиц/попапов/летящих сущностей. App общается с ним через ref —
// его setState'ы НЕ ребилдят боевое дерево App.
const FxLayer = React.forwardRef((_props, ref) => {
  const [damagePopups, setDamagePopups] = useState([]);
  const [bloodParticles, setBloodParticles] = useState([]);
  const [flyingXps, setFlyingXps] = useState([]);
  const [flyingItems, setFlyingItems] = useState([]);
  const [modStamps, setModStamps] = useState([]);
  const [flyingCards, setFlyingCards] = useState([]);

  // Хранилище таймеров автоудаления FlyingCard — чтобы корректно вычищать на unmount.
  const cardTimersRef = useRef(new Map());
  useEffect(() => () => {
    cardTimersRef.current.forEach(t => clearTimeout(t));
    cardTimersRef.current.clear();
  }, []);

  React.useImperativeHandle(ref, () => ({
    spawnDamagePopup: (popup) => setDamagePopups(prev => [...prev, popup]),
    spawnDamagePopups: (popups) => { if (popups?.length) setDamagePopups(prev => [...prev, ...popups]); },
    spawnBlood: (particles) => { if (particles?.length) setBloodParticles(prev => [...prev, ...particles]); },
    spawnFlyingXp: (xp) => setFlyingXps(prev => [...prev, xp]),
    spawnFlyingItem: (item) => setFlyingItems(prev => [...prev, item]),
    spawnModStamp: (stamp) => setModStamps(prev => [...prev, stamp]),
    // Карта с автоудалением и опциональным колбэком по истечении lifetime
    spawnFlyingCard: (card, lifetimeMs = 850, onExpire) => {
      setFlyingCards(prev => [...prev, card]);
      const id = card.id;
      const t = setTimeout(() => {
        setFlyingCards(prev => prev.filter(f => f.id !== id));
        cardTimersRef.current.delete(id);
        try { onExpire?.(); } catch (e) { console.error('[FxLayer] flyingCard onExpire failed:', e); }
      }, lifetimeMs);
      cardTimersRef.current.set(id, t);
    },
    clearAll: () => {
      setDamagePopups([]); setBloodParticles([]); setFlyingXps([]);
      setFlyingItems([]); setModStamps([]); setFlyingCards([]);
      cardTimersRef.current.forEach(t => clearTimeout(t));
      cardTimersRef.current.clear();
    },
  }), []);

  return (
    <>
      {flyingCards.map(card => <FlyingCard key={card.id} {...card} />)}
      {modStamps.map(s => (
        <ModStampEffect key={s.id} {...s}
          onComplete={(id) => setModStamps(prev => prev.filter(x => x.id !== id))} />
      ))}
      {damagePopups.map(dp => (
        <DamagePopup key={dp.id} {...dp}
          onComplete={(id) => setDamagePopups(prev => prev.filter(x => x.id !== id))} />
      ))}
      {bloodParticles.map(bp => (
        <BloodParticle key={bp.id} {...bp}
          onComplete={(id) => setBloodParticles(prev => prev.filter(x => x.id !== id))} />
      ))}
      {flyingXps.map(xp => (
        <FlyingXp key={xp.id} {...xp}
          onComplete={(id, amount) => {
            setFlyingXps(prev => prev.filter(x => x.id !== id));
            try { xp.onArrive?.(amount); } catch (e) { console.error('[FxLayer] flyingXp onArrive failed:', e); }
          }} />
      ))}
      {flyingItems.map(fi => (
        <FlyingItem key={fi.id} {...fi}
          onComplete={(id, item) => {
            setFlyingItems(prev => prev.filter(x => x.id !== id));
            try { fi.onArrive?.(item); } catch (e) { console.error('[FxLayer] flyingItem onArrive failed:', e); }
          }} />
      ))}
    </>
  );
});

// --- КАРТА СЕКТОРА: оверлей поверх боя (бесшовный переход, flow state) ---
// НЕ отдельный экран/роут: рендерится поверх живого боевого UI через быстрый
// дизолв (.dissolve, opacity 0.2s) — без жёстких катов и размонтирования боя.
const MapOverlay = ({ sector, nodes, links, completedNodes, currentNodeId, isNodeClickable, onNodeClick }) => (
  <div className="absolute inset-0 z-[1200] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-8 dissolve">
    <h1 className="text-7xl font-black text-amber-500 uppercase italic tracking-widest mb-8 text-center drop-shadow-2xl">Карта сектора {String(sector)}</h1>
    <div className="relative w-full max-w-4xl h-[500px] bg-slate-900/90 rounded-[40px] border border-slate-700 shadow-2xl overflow-hidden">
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        {links.map(link => {
          const isLinkActive = (completedNodes.includes(link.source.id) || currentNodeId === link.source.id) && (completedNodes.includes(link.target.id) || isNodeClickable(link.target));
          if (isLinkActive) return null;
          return (
            <path key={`inact-${link.source.id}-${link.target.id}`} d={getSubwayPath(link)} fill="none" stroke={link.color} strokeWidth={3} opacity={0.3} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeDasharray="4, 4" className="transition-all duration-500" />
          )
        })}
        {links.map(link => {
          const isLinkActive = (completedNodes.includes(link.source.id) || currentNodeId === link.source.id) && (completedNodes.includes(link.target.id) || isNodeClickable(link.target));
          if (!isLinkActive) return null;
          return (
            <path key={`act-${link.source.id}-${link.target.id}`} d={getSubwayPath(link)} fill="none" stroke={link.color} strokeWidth={6} vectorEffect="non-scaling-stroke" strokeLinecap="round" className="transition-all duration-500" />
          )
        })}
      </svg>

      {nodes.map(node => {
         const isCompleted = completedNodes.includes(node.id);
         const isCurrent = currentNodeId === node.id;
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
              onClick={() => isClickable && onNodeClick(node)}
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

    {/* Быстрый дизолв: transition/animation по opacity, 0.2s ease-in-out */}
    <style>{`
      .dissolve { animation: dissolveIn 0.2s ease-in-out both; }
      @keyframes dissolveIn { from { opacity: 0; } to { opacity: 1; } }
    `}</style>
  </div>
);

// --- 3. ГЛАВНОЕ ПРИЛОЖЕНИЕ ---

export default function App() {
  const [players, setPlayers] = useState(() => INITIAL_PLAYERS_DATA.map(p => syncPlayerMaxHp({ ...p })));
  const [enemies, setEnemies] = useState([]);
  
  const [maxMana, setMaxMana] = useState(MAX_MANA);
  const [mana, setMana] = useState(0); 
  const [turnState, setTurnState] = useState('map'); 
  
  const [drawPile, setDrawPile] = useState(() => createInitialDeck());
  const [discardPile, setDiscardPile] = useState([]);
  const [xp, setXp] = useState(0);
  const [playerLevel, setPlayerLevel] = useState(1); 
  const [xpToNext, setXpToNext] = useState(XP_BASE_THRESHOLD);
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
  const xpToNextRef = useRef(XP_BASE_THRESHOLD);
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

  // Эфемерные эффекты (попапы, частицы, летящие карты/XP/предметы, штампы)
  // живут в собственном компоненте FxLayer и обновляются через imperative API.
  // Их частые setState'ы НЕ перерисовывают App.
  const fxRef = useRef(null);
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
  // Стартовый экран Таверны-Хаба: показывается один раз после прелоадера,
  // закрывается по клику на дверь → отряд попадает на карту сектора.
  const [showTavern, setShowTavern] = useState(true);
  const [vfxList, setVfxList] = useState([]);
  const [flashingTargets, setFlashingTargets] = useState([]);

  const [shake, setShake] = useState({ x: 0, y: 0, rot: 0 });
  const [flash, setFlash] = useState(false);
  const [lastPlayedCost, setLastPlayedCost] = useState(null);
  const [comboStreak, setComboStreak] = useState(0);
  // Число для крутящегося символа комбо справа от арены (0 = скрыт).
  const [comboCount, setComboCount] = useState(0);
  // Бонус к мощности следующей карты в цепочке (от мод-карты «Усиление цепи»).
  const [chainAttackBonus, setChainAttackBonus] = useState(0);

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

  // QTE «Perfect Hit»: активный оверлей { targetType, targetNode, duration, resolve } | null.
  // setQte — событие (1 раз на розыгрыш), покадровая анимация живёт внутри QteOverlay.
  // qteActiveRef — синхронный гвард: при параллельном розыгрыше второй QTE не запускается.
  // СЛОУ-МО: пока QTE активен, мир плавно замедляется через qteSlowMo (см. qteTimeScale.js):
  // все CSS-анимации/транзишены получают playbackRate, импакт ждёт «игровое» время.
  // Кольцо и тайминг-судья — в РЕАЛЬНОМ времени. НЕ растягивать длительности вручную
  // под qte.duration — это ломает окна ±60/±150мс (см. инцидент в истории).
  const [qte, setQte] = useState(null);
  const qteActiveRef = useRef(false);
  const enemyZoneRef = useRef(null);

  // Watchdog: страховка от «замираний» боя. Любая боевая анимация укладывается в ~600мс.
  // Если флаг isAnimating висит true дольше COMBAT_ANIM_TIMEOUT_MS — значит сетTimeout-колбэк
  // упал с исключением и не вызвал setIsAnimating(false). Принудительно разморозим бой.
  const COMBAT_ANIM_TIMEOUT_MS = 3000;
  useEffect(() => {
    if (!isAnimating) return;
    const t = setTimeout(() => {
      console.warn('[combat] watchdog: forcing animation reset (callback likely crashed)');
      setIsAnimating(false);
      setAnimatingPlayerId(null);
      setAnimatingEnemyId(null);
      setAnimatingTargetIds([]);
      setAttackTranslate({ dx: 0, dy: 0 });
      setEnemyAttackTranslate({ dx: 0, dy: 0 });
      setVfxList([]);
    }, COMBAT_ANIM_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [isAnimating]);

  // Безопасная обёртка для боевых setTimeout-колбэков: ловит исключения,
  // не даёт упавшему callback'у заморозить анимационные флаги.
  const safeAnim = useCallback((cb) => () => {
    try {
      cb();
    } catch (err) {
      console.error('[combat] animation callback crashed:', err);
      setIsAnimating(false);
      setAnimatingPlayerId(null);
      setAnimatingEnemyId(null);
      setAnimatingTargetIds([]);
      setVfxList([]);
      setAttackTranslate({ dx: 0, dy: 0 });
      setEnemyAttackTranslate({ dx: 0, dy: 0 });
    }
  }, []);

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
       // Новый бой: броня и бонус цепи обнуляются
       setPlayers(prev => prev.map(p => ({ ...p, armor: 0 })));
       setChainAttackBonus(0);
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
        setPlayers(prev => prev.map(p => ({
           ...p,
           atk: (p.atk || 0) + 5,
           matk: (p.matk || 0) + 5,
        })));
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
    if (turnState !== 'player' || player.hp <= 0 || !player.currentCard || player.hasActed || isAnimating || showLevelUp) return;
    playSound('./assets/sfx/ui/hover.wav', 0.4);
    setHoveredPlayerId(player.id);
    // Мод-карты (баффы) не целят врагов — подсветку целей пропускаем
    if (isModCard(player.currentCard)) { setHoveredTargetIds([]); return; }
    // Считаем шаг комбо так же, как playCard: если карта продолжит серию — шаг +1
    const targetIndices = getTargets(player.currentCard, playerIndex, enemies, { preview: true });
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
      setXp(0); setXpToNext(XP_BASE_THRESHOLD); xpToNextRef.current = XP_BASE_THRESHOLD; setPlayerLevel(1); setMaxMana(MAX_MANA);
      setDrawPile(createInitialDeck()); setDiscardPile([]);
      setInventory(Array(INVENTORY_SIZE).fill(null));
      if (fullReset) setEquipped({ p1: null, p2: null, p3: null });
    } else {
      // Новый сектор: статы, уровень, мана, колода и предметы сохраняются,
      // бойцы воскресают с полным HP
      setPlayers(prev => prev.map(p => syncPlayerMaxHp({
        ...p,
        hp: getMaxHpFromStats(p, equipped[p.id]),
        armor: 0,
        currentCard: null,
        hasActed: false,
        justDealt: false,
      }, equipped[p.id])));
      setDrawPile(shuffleArray(ensureFullDeck(currentFullDeck)));
      setDiscardPile([]);
    }

    // Висящий QTE резолвим нейтрально (×1.0), чтобы Promise розыгрыша не завис навечно.
    // Слоу-мо выключаем принудительно: onResolve оверлея при сбросе не вызовется.
    setQte(prev => { prev?.resolve?.(1.0); return null; });
    qteActiveRef.current = false;
    qteSlowMo.end();
    setEnemies([]); setMana(0); setLastPlayedCost(null); setComboStreak(0); setComboCount(0); setChainAttackBonus(0); fxRef.current?.clearAll(); setShowLevelUp(false); setSlotsPopup(null); setLevelUpQueue(0); setRewardOptions([]);
    setDragSrcIdx(null); setDragOverPlayerId(null); setItemTooltip(null);
    setShowCraft(false); setCraftSlots([null, null, null]); setCraftWarning('');
    setCurrentEvent(null);
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
    // Цикл замыкается на Таверне: после смерти возвращаемся в неё, а не на экран подготовки.
    setShowTavern(true);
  };

  // Покупка стартовой карты: система сама случайно выбирает карту из доступного пула
  // героя и заменяет ею пустую карту-балласт в колоде
  const buyPrepCard = (heroId) => {
    const price = getPrepSlotPrice(prepCardsBought);
    if (prepCardsBought >= PREP_MAX_BUYS || soulEmbers < price) return;
    const all = [...drawPileRef.current, ...discardPileRef.current];
    const owned = all.filter(c => c.ownerId === heroId && isRealDeckCard(c));
    const ownedKeys = getOwnedSkillKeys(heroId, owned);
    // Скиллы — только в свободный слот пулла героя. Мод-карты универсальны: не занимают
    // персональные слоты, учитываются глобально (по всей колоде).
    const skillOptions = owned.length >= CARD_POOL_SIZE ? [] : getUnownedSkills(heroId, ownedKeys);
    const ownedModTypes = new Set(all.filter(isModCard).map(c => c.modType));
    const modOptions = MOD_CARD_LIST.filter(m => !ownedModTypes.has(m.modType));
    const options = [...skillOptions, ...modOptions];
    if (options.length === 0) return;
    const pick = options[Math.floor(Math.random() * options.length)];
    const isMod = isModCard(pick);
    // Мод-карта — без ownerId (попадает в общую колоду, придёт в руку по очереди раздачи).
    const newCard = isMod
      ? { ...pick, id: `mod_${Date.now()}_${Math.random()}`, level: 1 }
      : { ...pick, id: `prep_${Date.now()}_${Math.random()}`, level: 1, skillId: pick.id };
    setDrawPile(prev => [...prev, newCard]);
    setSoulEmbers(e => e - price);
    setPrepCardsBought(c => c + 1);
    const owner = isMod ? null : players.find(p => p.id === heroId);
    setCardReveal({ card: newCard, owner });
  };

  // Сжечь карту на экране подготовки → −1 огонёк, карта удаляется из колоды (слот освобождается).
  // Стартовую (базовую) карту сжечь нельзя.
  const burnPrepCard = (cardId) => {
    if (soulEmbers < PREP_BURN_COST) return;
    const all = [...drawPileRef.current, ...discardPileRef.current];
    const card = all.find(c => c.id === cardId);
    if (!card || !isRealDeckCard(card) || card.isStarter) return;
    setDrawPile(prev => prev.filter(c => c.id !== cardId));
    setDiscardPile(prev => prev.filter(c => c.id !== cardId));
    setSoulEmbers(e => e - PREP_BURN_COST);
    playSound('./assets/sfx/ui/card_discard.wav', 0.6);
  };

  const getTargets = useCallback((card, playerIndex, currentEnemies, { preview = false } = {}) => {
    const alive = currentEnemies.map((e, i) => ({ ...e, originalIndex: i })).filter(e => !e.isDead);
    if (alive.length === 0) return [];

    const targeting = getCardTargeting(card) || CARD_TARGETING.ALL;

    if (targeting === CARD_TARGETING.ALL) {
      return alive.map(e => e.originalIndex);
    }
    if (targeting === CARD_TARGETING.STRONGEST) {
      alive.sort((a, b) => (b.maxHp - a.maxHp) || (b.hp - a.hp));
      return [alive[0].originalIndex];
    }
    // random2: при наведении — стабильный превью-сид, при розыгрыше — настоящий рандом
    const seed = preview
      ? `${card.id}_${card.ownerId || playerIndex}_${alive.map(e => e.id).join('_')}`
      : null;
    return pickRandomAliveIndices(alive, 2, seed);
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
    // Глобальный нерф темпа: XP от всех источников (убийства, сжигание предметов) ×0.25
    // (два последовательных нерфа ×0.5). Пороги уровней (XP_BASE_THRESHOLD +
    // XP_THRESHOLD_STEP×N) тоже понерфлены ×2 — суммарно темп ×8 медленнее исходного.
    amount = Math.max(1, Math.round(amount * 0.25));
    setXp(prev => {
      let total = prev + amount;
      let cur = xpToNextRef.current;
      let levels = 0;
      // За один прирост XP можно перешагнуть сразу несколько уровней —
      // считаем их все, чтобы ни один не потерялся.
      while (total >= cur) {
        total -= cur;
        levels += 1;
        cur += XP_THRESHOLD_STEP;
      }
      if (levels > 0) {
        setXpToNext(cur); xpToNextRef.current = cur;
        setPlayerLevel(l => l + levels);
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
      // Новые скиллы — только если есть свободный слот пулла героя
      if (owned.length < CARD_POOL_SIZE) {
        unownedSkills.forEach(s => candidates.push({ kind: 'new', card: s }));
      }
      // Улучшения — только для реально имеющихся карт героя
      owned.forEach(c => candidates.push({ kind: 'upgrade', card: c }));
    });
    // Универсальные мод-карты: общие, не в слотах героев. Новые — глобально (без ownerId);
    // улучшения — для уже имеющихся в колоде мод-карт.
    if (aliveIds.size > 0) {
      const deckMods = full.filter(isModCard);
      const ownedModTypes = new Set(deckMods.map(c => c.modType));
      MOD_CARD_LIST.filter(m => !ownedModTypes.has(m.modType))
        .forEach(m => candidates.push({ kind: 'new', card: { ...m } }));
      deckMods.forEach(c => candidates.push({ kind: 'upgrade', card: c }));
    }
    return shuffleArray(candidates).slice(0, 3);
  };

  // Босс повержен: сразу заставка следующего сектора (отдельного экрана победы нет)
  const startNextSector = () => {
    playSound('./assets/sfx/game/victory.wav');
    setSectorSplash({ text: SECTOR_NARRATIVES[Math.floor(Math.random() * SECTOR_NARRATIVES.length)], sector: sector + 1 });
  };

  // Мгновенный пост-бой (flow state): смерть последнего врага → БЕЗ пауз, victory_wait
  // и экрана «СЕКТОР ЗАЧИЩЕН». Обычный узел — дизолв карты поверх боя (MapOverlay),
  // босс — заставка нового сектора. Открытый level-up откладывает переход.
  const triggerVictoryTransition = () => {
    setCompletedNodes(prev => prev.includes(currentMapNodeId) ? prev : [...prev, currentMapNodeId]);
    const target = currentStage === 5 ? 'nextSector' : 'map';
    if (showLevelUpRef.current) { pendingTransitionRef.current = target; return; }
    if (target === 'nextSector') startNextSector();
    else setTurnState('map');
  };

  // Выполняет отложенный переход (карта/новый сектор), назначенный во время диалога
  const runPendingTransition = () => {
    const pending = pendingTransitionRef.current;
    if (pending) {
      pendingTransitionRef.current = null;
      if (pending === 'nextSector') startNextSector();
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

    // Мод-карта (универсальная): без владельца, в общую колоду; дедуп — глобальный по modType
    if (isModCard(option.card)) {
      const hand = playersRef.current.map(p => p.currentCard).filter(Boolean);
      const all = [...drawPileRef.current, ...discardPileRef.current, ...hand];
      if (all.some(c => isModCard(c) && c.modType === option.card.modType)) {
        if (remaining === 0) runPendingTransition();
        return;
      }
      const newCard = { ...option.card, id: `mod_${Date.now()}_${Math.random()}`, level: 1 };
      setDrawPile(prev => [...prev, newCard]);
      setSlotsPopup({ newCardId: newCard.id });
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
    // Колода без балласта: новая карта просто добавляется в резерв (в свободный слот пулла)
    setDrawPile(prev => [...prev, newCard]);
    // Показываем схему слотов отряда; следующий уровень/переход — при закрытии попапа
    setSlotsPopup({ newCardId: newCard.id });
  };

  const closeSlotsPopup = () => {
    const wasFromTavern = slotsPopup?.fromTavern;
    setSlotsPopup(null);
    if (wasFromTavern) {
      // Возврат в Таверну — никаких отложенных боевых переходов не запускаем.
      setShowTavern(true);
      return;
    }
    // Очередь пуста — выполняем отложенный переход; иначе эффект откроет следующий выбор
    if (levelUpQueue <= 0) runPendingTransition();
  };

  const endPlayerPhase = useCallback(() => {
    setTurnState(ts => {
      if (ts !== 'player') return ts;
      playSound('./assets/sfx/game/enemy_turn.wav', 0.6);
      return 'enemy';
    });
    // GDD 3.4: усиление цепи — только текущий ход игрока; сгорает при завершении, если не потрачено.
    setChainAttackBonus(0);
    setComboCount(0);
  }, []);

  useEffect(() => {
    if (turnState !== 'dealing' || showLevelUp) return;
    setLastPlayedCost(null); setComboStreak(0); setComboCount(0);
    // GDD 2.3: броня переживает фазу врага; обнуляется только в начале нового раунда (dealing).
    setPlayers(prev => prev.map(p => ({ ...p, armor: 0 })));
    actingRef.current = new Set();
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
                fxRef.current?.spawnFlyingCard({ id: flyId, startX: discRect.left + discRect.width/2, startY: discRect.top + discRect.height/2, endX: deckRect.left + deckRect.width/2, endY: deckRect.top + deckRect.height/2, isReshuffle: true }, 850);
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
    const alivePlayers = players.filter(p => p.hp > 0);
    alivePlayers.forEach(p => {
      if (tempDraw.length > 0) {
        // Герой берёт первую в очереди карту, которая ИЛИ его, ИЛИ универсальная мод-карта (без владельца)
        const candidateIndex = tempDraw.findIndex(c => c.ownerId === p.id || (isModCard(c) && !c.ownerId));
        if (candidateIndex !== -1) { assignments[p.id] = tempDraw.splice(candidateIndex, 1)[0]; }
      }
    });
    let delay = 0; const deckRect = deckRef.current?.getBoundingClientRect();
    players.forEach(p => {
      if (p.hp <= 0) return;
      const drawn = assignments[p.id];
      // Колода без балласта: если в резерве нет карты этого героя на этот ход —
      // бесплатно выдаём базовую атаку (карты вернутся при обновлении колоды).
      const cardToDeal = drawn || HERO_ABILITIES[p.id].basic;
      const slotRect = slotRefs.current[p.id]?.getBoundingClientRect();
      if (deckRect && slotRect) {
        const flyId = `deal_${p.id}_${Date.now()}`;
        setTimeout(() => {
          playSound('./assets/sfx/ui/card_deal.wav', 0.5);
          fxRef.current?.spawnFlyingCard(
            { id: flyId, startX: deckRect.left + deckRect.width/2, startY: deckRect.top + deckRect.height/2, endX: slotRect.left + slotRect.width/2, endY: slotRect.top + slotRect.height * 0.75, flyMs: CARD_DEAL_FLY_MS },
            CARD_DEAL_FLY_MS,
            () => setPlayers(prev => prev.map(hero => hero.id === p.id ? { ...hero, currentCard: cardToDeal, justDealt: true } : hero))
          );
        }, delay);
      }
      delay += CARD_DEAL_STAGGER_MS; 
    });
    setTimeout(() => { playSound('./assets/sfx/game/mana_restore.wav', 0.5); setDrawPile(tempDraw); setDiscardPile(currentDiscard); setPlayers(prev => prev.map(p => ({ ...p, hasActed: false, justDealt: false }))); setMana(maxMana); setTurnState('player'); }, delay + CARD_DEAL_FINISH_PAD_MS);
  }, [turnState, showLevelUp, maxMana]);

  // Розыгрыш мод-карты (бафф): без цели по врагу, лёгкая анимация, участвует в цепочке комбо.
  const playModCard = (playerIndex, card) => {
    const player = players[playerIndex];
    if (actingRef.current.has(player.id) || manaRef.current < card.cost) return;
    actingRef.current.add(player.id);
    const isContinuing = lastPlayedCost !== null && card.cost === lastPlayedCost + 1;
    const nextComboStreak = isContinuing ? comboStreak + 1 : 0;

    playSound('./assets/sfx/ui/click.wav', 0.6);
    manaRef.current -= card.cost; setMana(manaRef.current);

    // Эффект мод-карты тоже множится в комбо тем же коэффициентом, что урон (2-я +50%, 3-я +150%)
    const comboStep = nextComboStreak;
    const comboMult = COMBO_DAMAGE_MULT[Math.min(comboStep, 2)];
    const amount = Math.round(getModValue(card) * comboMult);
    const aRect = avatarRefs.current[player.id]?.getBoundingClientRect();
    if (aRect) {
      fxRef.current?.spawnModStamp({
        id: `stamp_${Date.now()}_${player.id}`,
        icon: card.modType === 'armor' ? '🛡️' : '🔗',
        amount,
        variant: card.modType,
        x: aRect.left + aRect.width / 2,
        y: aRect.top + aRect.height / 2,
      });
    }
    if (card.modType === 'armor') {
      setPlayers(prev => prev.map(p => p.id === player.id ? { ...p, armor: (p.armor || 0) + amount, currentCard: null, hasActed: true } : p));
      playSound('./assets/sfx/game/mana_restore.wav', 0.4);
    } else { // chain
      setChainAttackBonus(b => b + amount);
      setPlayers(prev => prev.map(p => p.id === player.id ? { ...p, currentCard: null, hasActed: true } : p));
      playSound('./assets/sfx/ui/click.wav', 0.5);
    }

    // Бухгалтерия комбо: мод-карты тоже звено цепочки
    if (isContinuing) setComboStreak(s => s + 1); else setComboStreak(0);
    setLastPlayedCost(card.cost);
    {
      const chainPos = nextComboStreak + 1;
      const hasFollowup = players.some(o => o.id !== player.id && o.hp > 0 && !o.hasActed && o.currentCard && o.currentCard.cost === card.cost + 1);
      setComboCount((chainPos >= 2 || hasFollowup) ? chainPos : 0);
    }

    // Карта в сброс (с анимацией полёта)
    if (isRealDeckCard(card)) {
      const slotRect = slotRefs.current[player.id]?.getBoundingClientRect();
      const discardRect = discardRef.current?.getBoundingClientRect();
      if (slotRect && discardRect) {
        const flyId = `disc_${Date.now()}`;
        playSound('./assets/sfx/ui/card_discard.wav', 0.4);
        fxRef.current?.spawnFlyingCard(
          { id: flyId, startX: slotRect.left + slotRect.width / 2, startY: slotRect.top + slotRect.height * 0.75, endX: discardRect.left + discardRect.width / 2, endY: discardRect.top + discardRect.height / 2, isDiscard: true },
          850,
          () => setDiscardPile(prev => [...prev, card])
        );
      } else {
        setDiscardPile(prev => [...prev, card]);
      }
    }
  };

  const playCard = (playerIndex, card) => {
    const player = players[playerIndex];
    const effectivePlayer = getEffectivePlayer(player, equipped[player.id]);
    // Ввод не блокируется анимациями: гварды синхронные (actingRef/manaRef)
    if (turnState !== 'player' || manaRef.current < card.cost || player.hp <= 0 || player.hasActed || actingRef.current.has(player.id)) return;
    if (isModCard(card)) { playModCard(playerIndex, card); return; }
    actingRef.current.add(player.id);

    // Бонус к мощности от мод-карты «Усиление цепи» — применяется к этой (следующей) карте
    const chainBonusAtPlay = chainAttackBonus;

    const isContinuing = lastPlayedCost !== null && card.cost === lastPlayedCost + 1;
    const nextComboStreak = isContinuing ? comboStreak + 1 : 0;
    // comboStep: 0 — первая карта, 1 — вторая (+50%), 2+ — третья (+150%)
    const comboStep = nextComboStreak;
    // % прибавка к урону карты в комбо: 2-я карта +50%, 3-я+ +150%
    const comboDamageMult = COMBO_DAMAGE_MULT[Math.min(comboStep, 2)];
    // эффекты карты тоже множатся в комбо тем же коэффициентом
    const comboEffectMult = comboDamageMult;

    const targetIndices = getTargets(card, playerIndex, enemiesRef.current);
    if (targetIndices.length === 0) { actingRef.current.delete(player.id); return; }

    // --- QTE «Perfect Hit» ---
    // Промис резолвится множителем итогового урона (1.0 / 1.15 / 1.35).
    // Если QTE не положен или другой уже активен — мгновенный resolve(1.0),
    // боевой пайплайн не задерживается ни на кадр.
    const chainPos = nextComboStreak + 1; // 1-based позиция карты в цепочке комбо
    const qteTargets = targetIndices.map(idx => enemiesRef.current[idx]).filter(t => t && !t.isDead);
    const expectedLethal = qteTargets.some(t =>
      computePreviewDamageOnEnemy(effectivePlayer, card, t, comboDamageMult, chainBonusAtPlay).isLethal);
    let qtePromise = Promise.resolve(1.0);
    let qteDurationMs = 0;
    if (!qteActiveRef.current && shouldTriggerQte(card, chainPos, qteTargets, expectedLethal)) {
      // Массовая атака (или random2 задел >1 цели) — центр зоны врагов, укрупнённо;
      // одиночная (или жив 1 враг) — локально над спрайтом цели.
      const isAoe = qteTargets.length > 1;
      const rect = isAoe
        ? enemyZoneRef.current?.getBoundingClientRect()
        : enemyRefs.current[qteTargets[0]?.id]?.getBoundingClientRect();
      if (rect) {
        qteActiveRef.current = true;
        qteDurationMs = calculateQteDuration(card, chainPos);
        // Bullet-time: мир плавно замедляется на время кольца (выход — в onResolve)
        qteSlowMo.start();
        qtePromise = new Promise(resolve => setQte({
          targetType: isAoe ? 'aoe' : 'single',
          targetNode: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
          duration: qteDurationMs,
          card: { icon: card.icon, name: card.name }, // контекст: что усиливаем
          resolve,
        }));
      }
    }

    playSound('./assets/sfx/ui/click.wav', 0.6);
    // Ману тратим синхронно (manaRef), помечаем ход бойца сразу — чтобы быстрые клики
    // не перерасходовали ману и авто-завершение хода видело статус мгновенно.
    manaRef.current -= card.cost; setMana(manaRef.current);
    const playSlotRect = slotRefs.current[player.id]?.getBoundingClientRect();
    setPlayers(prev => prev.map(p => p.id === player.id ? { ...p, currentCard: null, hasActed: true } : p));
    setAnimatingPlayerId(player.id); setAnimatingTargetIds(targetIndices.map(idx => enemiesRef.current[idx]?.id).filter(Boolean));

    // Прыжок — только у ближников (физ. урон). Дальники (ranged/magic) стоят на месте.
    setAttackTranslate({ dx: 0, dy: 0 });
    const isMelee = getCardDmgType(card) === 'melee';
    if (isMelee) {
      const aRect = avatarRefs.current[player.id]?.getBoundingClientRect();
      const firstTargetId = targetIndices.length > 0 ? enemiesRef.current[targetIndices[0]]?.id : null;
      const tRect = firstTargetId ? enemyRefs.current[firstTargetId]?.getBoundingClientRect() : null;
      const leapDx = aRect && tRect ? (tRect.left + tRect.width/2) - (aRect.left + aRect.width/2) : 200;
      const leapDy = aRect && tRect ? (tRect.top  + tRect.height/2) - (aRect.top  + aRect.height/2) : 0;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setAttackTranslate({ dx: leapDx * 0.75, dy: leapDy * 0.75 });
      }));
    }

    if (isContinuing) setComboStreak(s => s + 1); else setComboStreak(0);
    setLastPlayedCost(card.cost);
    // Символ комбо: 1-based позиция в цепочке. Не показываем, если у карты нет
    // потенциальных звеньев — т.е. одиночная карта (поз. 1) без бойца,
    // способного продолжить цепочку (есть карта стоимостью cost+1).
    {
      const chainPos = nextComboStreak + 1;
      const hasFollowup = players.some(o => o.id !== player.id && o.hp > 0 && !o.hasActed && o.currentCard && o.currentCard.cost === card.cost + 1);
      setComboCount((chainPos >= 2 || hasFollowup) ? chainPos : 0);
    }

    const aRect = avatarRefs.current[player.id]?.getBoundingClientRect();
    const comboTier = Math.min(comboStep, 2);
    const comboScale = COMBO_VFX_SCALE[comboTier];
    const vfxArr = [];
    targetIndices.forEach(idx => {
       const tRect = enemyRefs.current[enemiesRef.current[idx]?.id]?.getBoundingClientRect();
       if (aRect && tRect) {
          const baseVfx = {
             startX: aRect.left + aRect.width/2, startY: aRect.top + aRect.height/2,
             endX: tRect.left + tRect.width/2, endY: tRect.top + tRect.height/2,
             comboScale, comboTier,
          };
          const type = card.vfxType || 'slash';
          const vfxCount = VFX_MULTI_TYPES.has(type) ? COMBO_VFX_PARTICLE_COUNT[comboTier] : 1;
          const stagger = vfxCount > 1 ? Math.max(10, Math.round(18 / (comboTier + 1))) : 0;
          const scatterR = VFX_MULTI_TYPES.has(type) ? 72 * comboScale : 0;

          for (let k = 0; k < vfxCount; k++) {
             vfxArr.push({
               id: Math.random(),
               type,
               heroId: player.id,
               delay: k * stagger,
               showSparks: k === 0,
               scatterX: scatterR ? (Math.random() - 0.5) * scatterR : 0,
               scatterY: scatterR ? (Math.random() - 0.5) * scatterR : 0,
               ...baseVfx,
             });
          }
       }
    });
    setVfxList(vfxArr);

    const animDuration = player.id === 'p2' ? 600 : 300;

    // Импакт и QTE идут параллельно: урон применяется, когда прошла задержка удара
    // И игрок разрешил QTE (или QTE не было — resolve(1.0) мгновенный).
    // Импакт — 300мс ИГРОВОГО времени (qteSlowMo.delay): без QTE это обычные 300мс,
    // под слоу-мо тянется вместе с замедленным прыжком/снарядом — удар синхронен
    // с визуалом. Судья тайминга кольца при этом живёт в реальном времени.
    const impactDelay = qteSlowMo.delay(300);
    Promise.all([impactDelay, qtePromise]).then(([, qteMult]) => safeAnim(() => {
      setVfxList([]); 
      let { damage: baseDamage, critChance } = computeCardDamage(effectivePlayer, card, comboDamageMult);
      // Бонус от «Усиления цепи» добавляется к мощности этой карты и тратится
      if (chainBonusAtPlay > 0) { baseDamage += chainBonusAtPlay; setChainAttackBonus(0); }
      // QTE «Perfect Hit»: множитель тайминга применяется к итоговому урону карты
      if (qteMult > 1) baseDamage = Math.round(baseDamage * qteMult);
      // База — актуальное состояние врагов из рефа (важно при параллельных розыгрышах)
      const newEnemies = enemiesRef.current.map(e => ({...e})); let xpToSpawn = []; let lootToSpawn = [];

      playSound(getCombatHitSound(card.vfxType || 'slash'));

      const hitEnemyIds = targetIndices.map(idx => newEnemies[idx]?.id).filter(Boolean);
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
           fxRef.current?.spawnDamagePopup({ id: Math.random(), value: dmg, isCrit, x: eRect.left + eRect.width / 2, y: eRect.top + eRect.height / 2 });
           const bloodN = COMBO_BLOOD_COUNT[comboTier] || 18;
           for(let i=0; i<bloodN; i++) {
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
      fxRef.current?.spawnBlood(newBlood);
      if (statusPopups.length) setTimeout(() => fxRef.current?.spawnDamagePopups(statusPopups), 260);

      // Синхронно обновляем реф, чтобы параллельный розыгрыш видел свежий HP врагов
      enemiesRef.current = newEnemies; setEnemies(newEnemies);
      // Сбрасываем прыжок только если с тех пор не начал бить другой боец
      setAnimatingPlayerId(prev => prev === player.id ? null : prev);
      setTimeout(() => setAnimatingTargetIds([]), 350);
      setHoveredPlayerId(null); setHoveredTargetIds([]);
      
      xpToSpawn.forEach(xpData => {
        const eRect = enemyRefs.current[xpData.id]?.getBoundingClientRect(); const bRect = xpBarRef.current?.getBoundingClientRect();
        if (eRect && bRect) fxRef.current?.spawnFlyingXp({
          id: Math.random(), amount: xpData.amount,
          startX: eRect.left + eRect.width/2, startY: eRect.top,
          endX: bRect.left + bRect.width / 2, endY: bRect.top + bRect.height / 2,
          onArrive: (amount) => { playSound('./assets/sfx/game/xp_gain.wav', 0.5); gainXp(amount); },
        });
      });

      lootToSpawn.forEach(lootData => {
        const eRect = enemyRefs.current[lootData.id]?.getBoundingClientRect();
        const iRect = inventoryRef.current?.getBoundingClientRect();
        if (eRect && iRect) {
          fxRef.current?.spawnFlyingItem({
            id: Math.random(), item: lootData.item,
            startX: eRect.left + eRect.width / 2, startY: eRect.top + eRect.height / 2,
            endX: iRect.left + iRect.width / 2, endY: iRect.top + iRect.height / 2,
            onArrive: (item) => { addItemToInventory(item); playSound('./assets/sfx/game/xp_gain.wav', 0.35); },
          });
        } else {
          addItemToInventory(lootData.item);
        }
      });
      
      // МГНОВЕННЫЙ триггер пост-боя: HP последнего врага достиг 0 → сразу дизолв
      // карты поверх боя (никаких victory_wait, таймаутов и смены экрана).
      const allDead = newEnemies.every(e => e.isDead);
      if (allDead) triggerVictoryTransition();

      if (isRealDeckCard(card)) {
        // currentCard/hasActed уже сброшены синхронно при розыгрыше; здесь только анимация сброса
        const discardRect = discardRef.current?.getBoundingClientRect();
        if (playSlotRect && discardRect) {
          const flyId = `disc_${Date.now()}`;
          playSound('./assets/sfx/ui/card_discard.wav', 0.4);
          fxRef.current?.spawnFlyingCard(
            { id: flyId, startX: playSlotRect.left + playSlotRect.width/2, startY: playSlotRect.top + playSlotRect.height * 0.75, endX: discardRect.left + discardRect.width/2, endY: discardRect.top + discardRect.height/2, isDiscard: true },
            850,
            () => { setDiscardPile(prev => [...prev, card]); }
          );
        } else { setDiscardPile(prev => [...prev, card]); }
      }
    })());
  };

  const playersRef = useRef(players);
  useEffect(() => { playersRef.current = players; }, [players]);
  const enemiesRef = useRef(enemies);
  useEffect(() => { enemiesRef.current = enemies; }, [enemies]);
  // Синхронные источники истины для мгновенного (асинхронного) розыгрыша карт без блокировки ввода:
  // manaRef — чтобы быстрые клики не перерасходовали ману; actingRef — чтобы один герой не сыграл дважды.
  const manaRef = useRef(mana);
  useEffect(() => { manaRef.current = mana; }, [mana]);
  const actingRef = useRef(new Set());
  const drawPileRef = useRef(drawPile);
  useEffect(() => { drawPileRef.current = drawPile; }, [drawPile]);
  const discardPileRef = useRef(discardPile);
  useEffect(() => { discardPileRef.current = discardPile; }, [discardPile]);
  useEffect(() => { showLevelUpRef.current = showLevelUp; }, [showLevelUp]);

  // Авто-завершение хода: как только ни один живой боец не может сделать легальный ход
  // (нет маны / разыграны все карты), фаза игрока автоматически переходит к врагу.
  // Небольшая задержка — чтобы дать долететь урону последней карты и сработать проверке победы.
  useEffect(() => {
    if (turnState !== 'player' || showLevelUp) return;
    const canAct = players.some(p => p.hp > 0 && !p.hasActed && p.currentCard && mana >= (p.currentCard.cost || 0));
    // Активный QTE удерживает фазу игрока: урон последней карты ещё не применён
    if (canAct || qte) return;
    const t = setTimeout(endPlayerPhase, 500);
    return () => clearTimeout(t);
  }, [players, mana, turnState, showLevelUp, qte, endPlayerPhase]);

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
          fxRef.current?.spawnDamagePopups([
            { id: Math.random(), value: bl.dmg, x: eRect.left + eRect.width/2, y: eRect.top + eRect.height/2 },
            { id: Math.random(), text: '🩸', color: 'text-red-400', x: eRect.left + eRect.width/2, y: eRect.top - 10 },
          ]);
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
        if (eRect && bRect) fxRef.current?.spawnFlyingXp({
          id: Math.random(), amount: xd.amount,
          startX: eRect.left + eRect.width/2, startY: eRect.top,
          endX: bRect.left + bRect.width/2, endY: bRect.top + bRect.height/2,
          onArrive: (amount) => { playSound('./assets/sfx/game/xp_gain.wav', 0.5); gainXp(amount); },
        });
      });
      bleedLoot.forEach(ld => {
        const eRect = enemyRefs.current[ld.id]?.getBoundingClientRect(); const iRect = inventoryRef.current?.getBoundingClientRect();
        if (eRect && iRect) fxRef.current?.spawnFlyingItem({
          id: Math.random(), item: ld.item,
          startX: eRect.left + eRect.width/2, startY: eRect.top + eRect.height/2,
          endX: iRect.left + iRect.width/2, endY: iRect.top + iRect.height/2,
          onArrive: (item) => { addItemToInventory(item); playSound('./assets/sfx/game/xp_gain.wav', 0.35); },
        });
        else addItemToInventory(ld.item);
      });
    }

    // === Победа, если кровотечение добило всех: тот же мгновенный дизолв ===
    if (startEnemies.every(e => e.isDead)) {
      triggerVictoryTransition();
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
            if (eR) fxRef.current?.spawnDamagePopup({ id: Math.random(), text: '💫 ОГЛУШЁН', color: 'text-amber-300', x: eR.left + eR.width/2, y: eR.top - 10 });
            return;
         }

         const base = Math.floor((Math.random() * 8 + 8 + (currentStage * 3)) * ENEMY_POWER_MULT);
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

            setTimeout(safeAnim(() => {
               setVfxList([]);
               playSound('./assets/sfx/combat/enemy_attack.wav');
               const missed = Math.random() < blindChance;
               if (missed) {
                  targets.forEach(t => { const pr = avatarRefs.current[t.id]?.getBoundingClientRect(); if (pr) fxRef.current?.spawnDamagePopup({ id: Math.random(), text: 'ПРОМАХ', color: 'text-slate-200', x: pr.left + pr.width/2, y: pr.top - 10 }); });
                  setAnimatingEnemyId(null); setTimeout(() => setAnimatingTargetIds([]), 350); setIsAnimating(false);
                  return;
               }
               triggerImpact(dmg * 1.4);
               setFlashingTargets(prev => [...prev, ...targets.map(t => t.id)]);
               setTimeout(() => setFlashingTargets(prev => prev.filter(id => !targets.some(t => t.id === id))), 250);

               targets.forEach(t => {
                  const pRect = avatarRefs.current[t.id]?.getBoundingClientRect();
                  if (pRect) {
                     const { hpLoss } = applyIncomingDamage(t, dmg);
                     if (hpLoss > 0) {
                       fxRef.current?.spawnDamagePopup({ id: Math.random(), value: hpLoss, x: pRect.left + pRect.width/2, y: pRect.top + pRect.height/2 });
                       const nb = []; for (let i=0; i<20; i++) nb.push({ id: Math.random(), x: pRect.left + pRect.width/2, y: pRect.top + pRect.height/2 });
                       fxRef.current?.spawnBlood(nb);
                     }
                  }
               });

               setPlayers(currentPs => currentPs.map(p => {
                  if (!targets.some(t => t.id === p.id)) return p;
                  const { newHp, newArmor } = applyIncomingDamage(p, dmg);
                  if (newHp === 0) purgeHeroFromDeck(p.id, p.currentCard);
                  return { ...p, hp: newHp, armor: newArmor, currentCard: null };
               }));

               setAnimatingEnemyId(null);
               setTimeout(() => setAnimatingTargetIds([]), 350);
               setIsAnimating(false);
            }), 300);
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

         setTimeout(safeAnim(() => {
            setVfxList([]);
            playSound('./assets/sfx/combat/enemy_attack.wav');
            const missed = Math.random() < blindChance;
            if (missed) {
               if (pRect) fxRef.current?.spawnDamagePopup({ id: Math.random(), text: 'ПРОМАХ', color: 'text-slate-200', x: pRect.left + pRect.width/2, y: pRect.top - 10 });
               setAnimatingEnemyId(null); setTimeout(() => setAnimatingTargetIds([]), 350); setIsAnimating(false);
               return;
            }
            triggerImpact(dmg);

            setFlashingTargets(prev => [...prev, target.id]);
            setTimeout(() => setFlashingTargets(prev => prev.filter(id => id !== target.id)), 250);

            if (pRect) {
               const { hpLoss } = applyIncomingDamage(target, dmg);
               if (hpLoss > 0) {
                 fxRef.current?.spawnDamagePopup({ id: Math.random(), value: hpLoss, x: pRect.left + pRect.width / 2, y: pRect.top + pRect.height / 2 });
                 const newBlood = [];
                 for(let i=0; i<30; i++) newBlood.push({ id: Math.random(), x: pRect.left + pRect.width/2, y: pRect.top + pRect.height/2 });
                 fxRef.current?.spawnBlood(newBlood);
               }
            }

            setPlayers(currentPs => currentPs.map(p => {
               if (p.id === target.id) {
                  const { newHp, newArmor } = applyIncomingDamage(p, dmg);
                  if (newHp === 0) purgeHeroFromDeck(p.id, p.currentCard);
                  return { ...p, hp: newHp, armor: newArmor, currentCard: null };
               }
               return p;
            }));

            setAnimatingEnemyId(null);
            setTimeout(() => setAnimatingTargetIds([]), 350);
            setIsAnimating(false);
         }), hitDelay);
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
    if (!card) return { isCandidate: false, willGiveBonus: false, comboStep: 0, comboPct: 0 };
    const willGiveBonus = lastPlayedCost !== null && card.cost === lastPlayedCost + 1;
    const comboStep = willGiveBonus ? Math.min(comboStreak + 1, 2) : 0;
    const comboPct = COMBO_DAMAGE_PCT[comboStep];
    const isCandidate = willGiveBonus;
    return { isCandidate, willGiveBonus, comboStep, comboPct };
  };

  const hoverTargetPreview = useMemo(() => {
    if (!hoveredPlayerId || hoveredTargetIds.length === 0) return {};
    const player = players.find(p => p.id === hoveredPlayerId);
    if (!player?.currentCard || isModCard(player.currentCard)) return {};
    const eff = getEffectivePlayer(player, equipped[player.id]);
    const isContinuing = lastPlayedCost !== null && player.currentCard.cost === lastPlayedCost + 1;
    const comboStep = isContinuing ? comboStreak + 1 : 0;
    const comboMult = COMBO_DAMAGE_MULT[Math.min(comboStep, 2)];
    const map = {};
    hoveredTargetIds.forEach(id => {
      const enemy = enemies.find(e => e.id === id);
      if (enemy && !enemy.isDead) {
        map[id] = computePreviewDamageOnEnemy(eff, player.currentCard, enemy, comboMult, chainAttackBonus);
      }
    });
    return map;
  }, [hoveredPlayerId, hoveredTargetIds, players, enemies, equipped, lastPlayedCost, comboStreak, chainAttackBonus]);

  const aliveCount = players.filter(p => p.hp > 0).length;
  // Счётчик колоды: реальные карты живых бойцов. Числитель — в резерве, знаменатель — всего.
  // Реальная карта в колоде: либо принадлежит живому герою, либо это универсальная мод-карта (без владельца)
  const aliveOwnsReal = (c) => isRealDeckCard(c) && ((isModCard(c) && !c.ownerId) || players.some(p => p.hp > 0 && p.id === c.ownerId));
  const liveHandReal = players.filter(p => p.hp > 0).map(p => p.currentCard).filter(c => c && isRealDeckCard(c));
  const liveDrawCount = drawPile.filter(aliveOwnsReal).length;
  const totalDeckSize = liveDrawCount + discardPile.filter(aliveOwnsReal).length + liveHandReal.length;

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

      {appReady && showTavern && (
        <TavernHubScreen
          activeParty={players.map(p => ({
            id: p.id,
            name: p.name,
            // Передаём атлас целиком — TavernSprite сам анимирует idle по cols/rows/frameCount/fps.
            sprite: CHAR_ATLASES[p.id],
          }))}
          currentSector={sector}
          onAction={(payload) => {
            if (!payload) return;
            if (payload.action === 'OPEN_MAP') {
              playSound('./assets/sfx/map/node_click.wav', 0.55);
              setShowTavern(false);
              return;
            }
            // Прочие действия (OPEN_BARTENDER_DIALOG, INSPECT_RECRUIT)
            // подключим, когда будут готовы соответствующие экраны.
          }}
          onOpenPrepScreen={() => {
            // HERO_ACTIVE → переход на экран подготовки к бою.
            // Таверну прячем (PrepScreen рендерится при !showTavern && showPrep).
            playSound('./assets/sfx/ui/click.wav', 0.5);
            setShowTavern(false);
            setShowPrep(true);
          }}
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
          <img src="./corner.webp" alt="" aria-hidden="true" className="pointer-events-none select-none absolute top-[24px] left-0 w-[325px] h-[325px] z-[0] opacity-90 drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]" />
          <img src="./corner.webp" alt="" aria-hidden="true" className="pointer-events-none select-none absolute top-[24px] right-0 w-[325px] h-[325px] z-[0] opacity-90 drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]" style={{ transform: 'scaleX(-1)' }} />
          <img src="./corner.webp" alt="" aria-hidden="true" className="pointer-events-none select-none absolute bottom-0 left-0 w-[325px] h-[325px] z-[0] opacity-90 drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]" style={{ transform: 'scaleY(-1)' }} />
          <img src="./corner.webp" alt="" aria-hidden="true" className="pointer-events-none select-none absolute bottom-0 right-0 w-[325px] h-[325px] z-[0] opacity-90 drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]" style={{ transform: 'scale(-1, -1)' }} />
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
        @keyframes modStampSlam {
          0%   { opacity: 0; transform: scale(2.6) rotate(-14deg); }
          18%  { opacity: 1; transform: scale(2.6) rotate(-14deg); }
          55%  { opacity: 1; transform: scale(0.88) rotate(3deg); }
          72%  { transform: scale(1.12) rotate(-2deg); }
          88%  { transform: scale(1) rotate(0deg); }
          100% { opacity: 0; transform: scale(0.95) rotate(0deg); }
        }
        @keyframes modStampRing {
          0%   { opacity: 0.95; transform: scale(0.25); }
          100% { opacity: 0; transform: scale(2.4); }
        }
        @keyframes comboSpinCW { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes comboSpinCCW { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
        @keyframes comboNumPop { 0% { transform: scale(0.2); opacity: 0; } 55% { transform: scale(1.35); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes slotPushLeft {
          0%   { transform: translateX(0) rotate(0deg); }
          55%  { transform: translateX(-18px) rotate(-1.75deg); }
          78%  { transform: translateX(-18px) rotate(0.875deg); }
          100% { transform: translateX(-18px) rotate(0deg); }
        }
        @keyframes slotPushRight {
          0%   { transform: translateX(0) rotate(0deg); }
          55%  { transform: translateX(18px) rotate(1.75deg); }
          78%  { transform: translateX(18px) rotate(-0.875deg); }
          100% { transform: translateX(18px) rotate(0deg); }
        }
        .card-nudge-wrap {
          transform-origin: center bottom;
          transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .card-nudge-wrap.slot-push-left  { animation: slotPushLeft  0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        .card-nudge-wrap.slot-push-right { animation: slotPushRight 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
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
      <FxLayer ref={fxRef} />
      {itemTooltip && <ItemTooltip item={itemTooltip.item} x={itemTooltip.x} y={itemTooltip.y} />}

      {/* --- ИНТЕРФЕЙС БОЯ (ВСЕГДА РЕНДЕРИТСЯ НА ФОНЕ) --- */}
      <div className="flex w-full max-w-5xl justify-center relative z-0 p-1 py-4 my-auto">
        <div className="flex-1 flex flex-col justify-start w-full relative">
          <div className="bg-slate-950/60 py-10 px-16 rounded-[40px] border border-slate-800/60 shadow-[0_0_30px_rgba(0,0,0,0.5)] flex justify-between items-center relative h-[355px] overflow-visible backdrop-blur-md">
            <ComboIndicator count={comboCount} />
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
                   // duration-300 совпадает с impactDelay — прыжок долетает точно в момент удара.
                   // НЕ синхронизировать с qte.duration: кольцо и импакт — независимые тайминги.
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
                    <div className={`relative ${CHAR_ATLASES[player.id] ? '' : 'text-6xl'} ${isHovered && !isAnimating ? 'drop-shadow-[0_0_25px_rgba(59,130,246,0.4)]' : ''} ${flashingTargets.includes(player.id) ? 'brightness-0 invert drop-shadow-[0_0_40px_white] scale-150 -translate-y-4 z-[2000]' : ''}`} style={{ transition: 'all 0.15s ease-out' }}>
                      <HeroFieldBadges armor={player.armor || 0} chainBonus={turnState === 'player' ? chainAttackBonus : 0} />
                      {CHAR_ATLASES[player.id] ? <CharSprite atlas={CHAR_ATLASES[player.id]} size={CHAR_SPRITE_SIZE} {...CHAR_COLORIZE[player.id]} /> : String(player.icon)}
                      {isBeingAttacked && <div className="absolute inset-0 flex items-center justify-center text-red-500 text-6xl animate-bounce pointer-events-none z-50">💥</div>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="absolute left-1/2 top-16 bottom-16 w-px bg-gradient-to-b from-transparent via-slate-700 to-transparent opacity-50"></div>
            <div ref={enemyZoneRef} className="relative w-1/2 z-10 h-full overflow-visible">
              {enemies.map((enemy, eIdx) => {
                const isHoveredTarget = hoveredTargetIds.includes(enemy.id); 
                const targetPreview = hoverTargetPreview[enemy.id];
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
                        {isHoveredTarget && !isAnimating && targetPreview && (
                          <TargetReticle damage={targetPreview.damage} lethal={targetPreview.isLethal} />
                        )}
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
              {(() => {
                const hoveredSlotIdx = hoveredPlayerId ? players.findIndex(pl => pl.id === hoveredPlayerId) : -1;
                return players.map((p, i) => {
                const card = p.currentCard; const isDead = p.hp <= 0; const isDisabled = turnState !== 'player' || mana < (card?.cost || 0) || isDead || p.hasActed || showLevelUp || turnState === 'map'; const comboStatus = getCardComboStatus(p.id, card);
                const eff = getEffectivePlayer(p, equipped[p.id]);
                const eqItem = equipped[p.id];
                const isSlotHovered = hoveredSlotIdx === i;
                const slotNeighborClass = hoveredSlotIdx !== -1 && !isSlotHovered && !isDead
                  ? (i < hoveredSlotIdx ? 'slot-push-left' : 'slot-push-right')
                  : '';
                return (
                  <div key={p.id} className="flex flex-col items-center" style={{ zIndex: isSlotHovered ? 40 : slotNeighborClass ? 5 : 10 }}>
                  <div className={`card-nudge-wrap w-52 ${slotNeighborClass}`}>
                  <TiltWrapper isDisabled={isDisabled} globalShake={shake} className={`w-52 h-[290px] relative z-10 rounded-2xl transition-shadow duration-300 ${comboStatus.willGiveBonus && !isDisabled ? 'shadow-[0_0_34px_8px_rgba(250,204,21,0.65)] animate-pulse' : ''}`}>
                    <div ref={(el) => setSlotRef(p.id, el)} onClick={() => !isDisabled && card && playCard(i, card)} onMouseEnter={() => handleCardHover(i)} onMouseLeave={() => { setHoveredPlayerId(null); setHoveredTargetIds([]); }} className={`w-full h-full bg-slate-800 border-2 rounded-2xl flex flex-col overflow-hidden relative group ${isDead ? 'border-slate-700 opacity-40 grayscale scale-95' : 'border-slate-600 shadow-2xl shadow-black/80'} ${!isDisabled ? 'cursor-pointer hover:border-[#1E88E5]' : ''}`}>
                      <div className={`${p.bg} py-1.5 px-3 border-b border-white/10 flex justify-between items-center`}><span className="text-sm">{String(p.icon)}</span><span className="font-black uppercase tracking-tighter text-[10px] text-white">{String(p.name)}</span><span className="text-[8px] font-mono text-red-400">{String(p.hp)}/{String(eff.maxHp)} HP</span></div>
                      <div className="p-1.5 bg-slate-900/50"><div className="h-1.5 bg-slate-950 rounded-full overflow-hidden shadow-inner"><div className="h-full bg-[#D32F2F] transition-all duration-500" style={{ width: `${(p.hp/eff.maxHp)*100}%` }}></div></div></div>
                      <div className="p-1.5 bg-slate-950 relative flex flex-col items-center justify-center flex-1 min-h-[190px] overflow-visible" style={{ transformStyle: 'preserve-3d' }}>
                        {isDead ? <span className="text-[9px] uppercase text-slate-600 font-black tracking-widest">Павший</span> : !card && p.hasActed ? (
                          <div className="flex flex-col items-center opacity-30 animate-pulse"><span className="text-4xl text-[#1E88E5]">⏳</span><span className="text-[8px] uppercase font-black mt-2 tracking-widest text-center leading-tight text-white">Ход завершен</span></div>
                        ) : card ? (
                          <AbilityCard card={card} owner={eff} mana={mana} maxMana={maxMana} isDisabled={isDisabled} comboState={comboStatus} chainBonus={chainAttackBonus} />
                        ) : <div className="w-full h-full border-2 border-dashed border-slate-800 rounded-xl flex items-center justify-center text-[#1E88E5]/40 font-black italic">...</div>}
                      </div>
                    </div>
                  </TiltWrapper>
                  </div>
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
              });
              })()}
            </div>

            <div className="flex flex-col justify-end gap-6 items-center mb-[19px] w-32 -translate-y-[60px]">
              <button onClick={endPlayerPhase} disabled={turnState !== 'player' || showLevelUp || !!qte || turnState === 'map'} className="w-full py-4 bg-[#D32F2F] hover:bg-red-700 disabled:opacity-50 disabled:bg-red-900 disabled:cursor-not-allowed rounded-2xl font-black uppercase tracking-widest text-[9px] transition-all shadow-[0_0_20px_rgba(211,47,47,0.4)] border border-red-500 hover:scale-105 active:scale-95 text-white">{turnState === 'dealing' ? 'ЖДИТЕ' : turnState === 'player' ? 'ЗАВЕРШИТЬ' : 'ВРАГ...'}</button>
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

      {/* --- QTE «Perfect Hit»: сужающееся кольцо поверх цели / зоны врагов --- */}
      {qte && (
        <QteOverlay
          targetType={qte.targetType}
          targetNode={qte.targetNode}
          duration={qte.duration}
          card={qte.card}
          onArm={() => playSound('./assets/sfx/ui/click.wav', 0.18)}
          onResolve={(res) => {
            // Вердикт получен — мир плавно разгоняется обратно (ramp ~250мс)
            qteSlowMo.end();
            if (res === 'perfect') playSound('./assets/sfx/combat/hit_heavy.wav', 0.55);
            else if (res === 'good') playSound('./assets/sfx/ui/click.wav', 0.5);
            qte.resolve(QTE_RESULT_MULT[res] ?? 1.0);
          }}
          onDone={() => { qteActiveRef.current = false; setQte(null); }}
        />
      )}

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

      {/* --- КАРТА СЕКТОРА: MapOverlay поверх живого боя, быстрый дизолв --- */}
      {turnState === 'map' && (
        <MapOverlay
          sector={sector}
          nodes={gameMap}
          links={mapLinks}
          completedNodes={completedNodes}
          currentNodeId={currentMapNodeId}
          isNodeClickable={isNodeClickable}
          onNodeClick={handleNodeClick}
        />
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
          // PrepScreen сейчас открывается ИСКЛЮЧИТЕЛЬНО из таверны (HERO_ACTIVE-клик),
          // потому это всегда оверлей-режим: крестик + кнопка «ОК» вместо «Старт».
          fromTavern={true}
          onClose={() => {
            setShowPrep(false);
            setShowTavern(true);
          }}
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

      {/* Экрана «СЕКТОР ЗАЧИЩЕН» больше нет: босс → сразу заставка нового сектора */}
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
          onClose={() => setShowReserve(false)}
        />
      )}
      </div>
    </div>
  );
}