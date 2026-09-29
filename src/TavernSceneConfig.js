import { CHARACTER_SHADOW } from './lighting/groundShadow';
// Декларативный конфиг сцены Таверны-Хаба.
//
// Источник истины компоновки: Figma-холст 3200×1800 (см. screenScale.js, шаблон
// «Screen Template 3200×1800» в Figma). Координаты сущностей — проценты от сцены:
//   cx% = (left + width/2)  / 3200 × 100
//   cy% = (top  + height/2) / 1800 × 100
//   scale = size / 1800
// flipX:true соответствует Figma-обёртке `-scale-y-100 rotate-180` (горизонтальный флип).
//
// Глубина (z-sorting) задаётся ИНДИВИДУАЛЬНО через поле `zIndex`. Никаких DOM-«слоёв».
//
// Z-зоны (ориентир):
//   0     — подсобка за аркой (bg_base_under, видна сквозь прозрачную арку фона)
//   1     — фон таверны (bg_base)
//   4     — ночная тонировка окружения (TavernHubScreen)
//   5     — огонь в камине
//   6-8   — свет камина по окружению (TavernLighting)
//   9     — тени на полу (TavernShadows)
//   10    — бармен за стойкой
//   20    — стойка бара (перекрывает бармена снизу)
//   30-32 — активная тройка героев у стойки
//   40-63 — массовка/мебель ближнего плана (по индивидуальному порядку Figma)
//   200+  — UI-бейджи и подписи поверх сцены


// Пропорция сцены = натуральному aspect фона bg_base (1024×529 ≈ 1.936).
// Шире стандартного 16∶9 — object-cover заполняет контейнер без обрезания
// боков; все сущности (% от сцены) масштабируются вместе с холстом.
export const TAVERN_STAGE_RATIO = 1024 / 529;

// Both door states share a hinge and top edge. The open leaf extends left;
// it must not be positioned independently over the staircase.
const DOOR_SCALE = 0.59;
const doorCenterX = aspect => `${97.5 - DOOR_SCALE * aspect / TAVERN_STAGE_RATIO * 50}%`;

// Ночная фаза (NIGHT_KNOCKING): таверна пустеет — скрываются все посетители
// и активные герои, остаётся только бармен (NPC), фон, мебель и клик-зоны.
export const NIGHT_HIDDEN_ENTITY_TYPES = ['VISITOR', 'HERO_ACTIVE'];

// Центр огня в камине (% сцены) — общий якорь спрайта огня и слоёв освещения
// (TavernLighting, tavernLight.js). Проём камина в bg_base: x 97–190 из 1024×529.
export const TAVERN_FIREPLACE = { left: 14.1, top: 61.34 };

// Тени на полу: центр пятна и размер в долях бокса сущности (TavernShadows).
// Ноги в кадрах атласов персонажей — на ~87% высоты кадра, низ стола — на ~96%.
const CHAR_SHADOW = CHARACTER_SHADOW;
const TABLE_SHADOW = { top: 0.93, width: 0.84, height: 0.14 };

// Атласы персонажей таверны: 4×4 кадра, покадровая idle-анимация.
// fps=4 — нарочито медленный «ленивый» ритм таверны (в 2 раза медленнее боевых).
const TAVERN_ATLAS = (url, fps = 4) => ({ url, cols: 4, rows: 4, frameCount: 16, fps });

export const TAVERN_ENTITIES = [
  // ─── ФОН ────────────────────────────────────────────────────────────
  {
    id: 'bg_base',
    type: 'BG',
    assetUrl: './assets/tavern/bg_base.webp',
    pos: { left: '50%', top: '50%' },
    zIndex: 1,
    interactive: false,
  },

  // ─── ПОДСОБКА ЗА АРКОЙ ──────────────────────────────────────────────
  // Арка в bg_base прозрачная (481,102 → 645,304 из 1024×529); подсобка
  // 220×276 больше проёма. Центр совпадает с центром арки.
  {
    id: 'bg_base_under',
    type: 'PROP',
    assetUrl: './assets/tavern/bg_base_under.webp',
    pos: { left: '54.98%', top: '38.37%' },
    scale: 0.5217, // 276/529
    aspect: 220 / 276,
    zIndex: 0,
    lit: false,
    interactive: false,
  },

  // ─── ОГОНЬ В КАМИНЕ ─────────────────────────────────────────────────
  // Атлас 3×1 кадра 112×112. Цвет даёт свет TavernLighting поверх огня.
  {
    id: 'fireplace_fire',
    type: 'PROP',
    sprite: { url: './assets/tavern/fireplace_fire.webp', cols: 3, rows: 1, frameCount: 3, fps: 4 },
    pos: { left: `${TAVERN_FIREPLACE.left}%`, top: `${TAVERN_FIREPLACE.top}%` },
    scale: 0.192,
    aspect: 1,
    zIndex: 5,
    lit: false,
    interactive: false,
  },

  // ─── ДВЕРЬ (отдельный спрайт поверх проёма в bg_base) ───────────────
  // Фон теперь БЕЗ двери: дверь — свой спрайт, чтобы её можно было трясти
  // при ночном стуке (и позже открывать).
  // Источник: Figma node 3621:11967 (frame 3621:9346), координаты взяты
  // ОТНОСИТЕЛЬНО фоновой картинки (bg_base 1: 2433×1260 @ 19,10):
  //   door 162×750 @ 2268,384 → cx=0.9574, cy=0.5944, h=0.5952 от фона.
  // Сцена теперь в пропорции фона (кропа нет) — проценты фона == процентам сцены.
  // Ночное состояние: дверь закрыта (в неё стучат). Видна ТОЛЬКО ночью.
  {
    id: 'door_night',
    type: 'PROP',
    assetUrl: './assets/tavern/door.webp',
    pos: { left: doorCenterX(162 / 750), top: '55.5%' },
    scale: DOOR_SCALE,
    aspect: 162 / 750, // натуральная пропорция спрайта — держит ширину у края сцены
    zIndex: 24, // над фоном/тонировкой пола, под клик-зоной door_to_map (25)
    visibleWhen: 'NIGHT',
    interactive: false,
  },
  // Дневное состояние: распахнутая створка держится на той же правой петле.
  {
    id: 'door_day',
    type: 'PROP',
    assetUrl: './assets/tavern/door_open.webp',
    pos: { left: doorCenterX(296 / 750), top: '55.5%' },
    scale: DOOR_SCALE,
    aspect: 296 / 750,
    zIndex: 24,
    visibleWhen: 'DAY',
    interactive: false,
  },

  // ─── БАРМЕН (за стойкой) ────────────────────────────────────────────
  // Анимированный атлас barman.webp (4×4, протирает кружку полотенцем).
  {
    id: 'npc_bartender',
    type: 'NPC',
    sprite: TAVERN_ATLAS('./assets/tavern/barman.webp'),
    pos: { left: '42.61%', top: '35.57%' },
    scale: 0.4003, // 556/1389
    zIndex: 10,
    interactive: true,
    // Бармен виден из-за стойки — широкая верхняя половина «грудь+голова».
    hitbox: { left: '15%', top: '10%', width: '70%', height: '70%' },
    payload: { action: 'OPEN_SHOP' },
  },

  // ─── СТОЙКА БАРА (перекрывает бармена снизу) ────────────────────────
  {
    id: 'bar_counter',
    type: 'PROP',
    assetUrl: './assets/tavern/bar_counter.webp',
    pos: { left: '48.28%', top: '27.86%' },
    scale: 0.7559, // 1050/1389
    zIndex: 20,
    interactive: false,
  },

  // ─── СКЕЛЕТ-ПОРУЧИТЕЛЬ У КАМИНА ────────────────────────────────────
  // Появляется после обязательного визита первой смерти. TavernHubScreen
  // скрывает сущность до команды TASK_MASTER_JOIN_TAVERN и подменяет атлас:
  // task_master — есть новые поручения/награда, inactive — всё разобрано.
  {
    id: 'npc_task_master',
    type: 'NPC',
    sprite: TAVERN_ATLAS('./assets/tavern/task_master_inactive.webp'),
    pos: { left: '18%', top: '55%' },
    scale: 0.42,
    aspect: 1,
    flipX: false,
    zIndex: 55,
    shadow: CHAR_SHADOW,
    visibleWhen: 'DAY',
    interactive: true,
    hitbox: { left: '24%', top: '8%', width: '52%', height: '88%' },
    payload: { action: 'OPEN_TASK_MASTER' },
  },

  // ─── АКТИВНАЯ ТРОЙКА ГЕРОЕВ У СТОЙКИ ────────────────────────────────
  // Конкретные герои подаются через props.activeParty[slotIndex].
  // Hero2 и Hero1 в Figma зеркалены (смотрят на бармена).
  {
    id: 'hero_slot_0',
    type: 'HERO_ACTIVE',
    slotIndex: 0,
    pos: { left: '34.68%', top: '54.09%' },
    scale: 0.4403,
    flipX: true,
    zIndex: 30,
    shadow: CHAR_SHADOW,
    interactive: true,
    // Узкая центральная вертикаль — корпус персонажа без воздуха по бокам.
    hitbox: { left: '32%', top: '10%', width: '36%', height: '85%' },
    payload: { action: 'OPEN_HERO_INVENTORY', slot: 0 },
  },
  {
    id: 'hero_slot_1',
    type: 'HERO_ACTIVE',
    slotIndex: 1,
    pos: { left: '50.20%', top: '53.73%' },
    scale: 0.4403,
    flipX: true,
    zIndex: 31,
    shadow: CHAR_SHADOW,
    interactive: true,
    hitbox: { left: '32%', top: '10%', width: '36%', height: '85%' },
    payload: { action: 'OPEN_HERO_INVENTORY', slot: 1 },
  },
  {
    id: 'hero_slot_2',
    type: 'HERO_ACTIVE',
    slotIndex: 2,
    pos: { left: '65.13%', top: '54.09%' },
    scale: 0.4403,
    flipX: false,
    zIndex: 32,
    shadow: CHAR_SHADOW,
    interactive: true,
    hitbox: { left: '32%', top: '10%', width: '36%', height: '85%' },
    payload: { action: 'OPEN_HERO_INVENTORY', slot: 2 },
  },

  // ─── МАССОВКА ДАЛЬНЕГО ПЛАНА ────────────────────────────────────────
  // Посетители — анимированные атласы visitor0/visitor1 (4×4), чередуются.
  {
    id: 'visitor_cloaked_back_right',
    type: 'VISITOR',
    sprite: TAVERN_ATLAS('./assets/tavern/visitor0.webp'),
    pos: { left: '90.19%', top: '72.58%' },
    scale: 0.4879, // 616/1389 × 1.1
    aspect: 1, // кадр атласа квадратный; без aspect у края сцены контейнер схлопывается
    flipX: true,
    zIndex: 40,
    shadow: CHAR_SHADOW,
    interactive: false,
  },

  // ─── СТОЛЫ ──────────────────────────────────────────────────────────
  {
    id: 'table_round_right',
    type: 'PROP',
    assetUrl: './assets/tavern/table_round.webp',
    pos: { left: '82.49%', top: '73.60%' },
    scale: 0.4403, // как у остальных столов (0.7 был компенсацией старого сжатия)
    aspect: 1, // спрайт 320×320; фиксирует ширину у правого края (искажался)
    zIndex: 50,
    shadow: TABLE_SHADOW,
    interactive: false,
  },
  {
    id: 'table_round_center',
    type: 'PROP',
    assetUrl: './assets/tavern/table_round.webp',
    pos: { left: '51.53%', top: '75.76%' },
    scale: 0.4403,
    aspect: 1,
    zIndex: 51,
    shadow: TABLE_SHADOW,
    interactive: false,
  },
  {
    id: 'table_round_left',
    type: 'PROP',
    assetUrl: './assets/tavern/table_round.webp',
    pos: { left: '20.88%', top: '70.00%' },
    scale: 0.4403,
    aspect: 1,
    zIndex: 52,
    shadow: TABLE_SHADOW,
    interactive: false,
  },

  // ─── ПОСЕТИТЕЛИ ПЕРЕДНЕГО ПЛАНА ─────────────────────────────────────
  {
    id: 'visitor_walker_a_center',
    type: 'VISITOR',
    sprite: TAVERN_ATLAS('./assets/tavern/visitor1.webp'),
    pos: { left: '59.73%', top: '76.34%' },
    scale: 0.4879,
    flipX: true,
    zIndex: 60,
    shadow: CHAR_SHADOW,
    interactive: false,
  },
  {
    id: 'visitor_drunk_right',
    type: 'VISITOR',
    sprite: TAVERN_ATLAS('./assets/tavern/visitor0.webp'),
    pos: { left: '73.57%', top: '75.60%' },
    scale: 0.4879,
    zIndex: 61,
    shadow: CHAR_SHADOW,
    interactive: false,
  },
  {
    id: 'visitor_cloaked_center',
    type: 'VISITOR',
    sprite: TAVERN_ATLAS('./assets/tavern/visitor1.webp'),
    pos: { left: '41.05%', top: '77.06%' },
    scale: 0.4879,
    zIndex: 62,
    shadow: CHAR_SHADOW,
    interactive: false,
  },
  {
    id: 'visitor_walker_a_left',
    type: 'VISITOR',
    sprite: TAVERN_ATLAS('./assets/tavern/visitor0.webp'),
    pos: { left: '10.79%', top: '73.80%' },
    scale: 0.4879,
    flipX: true,
    zIndex: 63,
    shadow: CHAR_SHADOW,
    interactive: false,
  },

  // ─── ЛЕСТНИЦА → СОН (невидимая клик-зона на лестнице в bg_base) ─────
  // В текущем фоне лестница справа от центральной арки.
  // Сон обязателен перед выходом в поход (см. hasRested в TavernHubScreen).
  {
    id: 'stairs_to_rest',
    type: 'PORTAL',
    pos: { left: '79.5%', top: '39%' },
    scale: 0.45,
    aspect: 0.55,
    zIndex: 18, // фоновая глубина: под героями/мебелью, над самим bg
    interactive: true,
    hitbox: { left: '0%', top: '0%', width: '100%', height: '100%' },
    payload: { action: 'OPEN_SLEEP_MODAL', label: 'Спать' },
  },

  // ─── ДВЕРЬ → КАРТА (невидимая клик-зона на месте двери в bg_base) ───
  // В Figma отдельный ассет двери отсутствует — дверь нарисована в bg_base
  // на правом краю. Кликаем по прозрачной зоне поверх неё.
  {
    id: 'door_to_map',
    type: 'PORTAL',
    pos: { left: '92%', top: '55.5%' },
    scale: DOOR_SCALE,
    aspect: 0.44, // covers both open and closed leaves
    zIndex: 25,
    interactive: true,
    minSectorRequired: 1,
    // Портал не имеет визуала — хитбокс == bbox сущности.
    hitbox: { left: '0%', top: '0%', width: '100%', height: '100%' },
    payload: { action: 'OPEN_MAP', label: 'В поход' },
  },
];
