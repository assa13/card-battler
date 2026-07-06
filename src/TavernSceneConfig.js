// Декларативный конфиг сцены Таверны-Хаба.
//
// Источник истины компоновки: Figma node 3477:18544 (frame 2558×1389).
// Координаты сущностей пересчитаны из Figma в проценты от размеров сцены:
//   cx = (left + size/2) / 2558,  cy = (top + size/2) / 1389,  scale = size / 1389.
// flipX:true соответствует Figma-обёртке `-scale-y-100 rotate-180` (горизонтальный флип).
//
// Глубина (z-sorting) задаётся ИНДИВИДУАЛЬНО через поле `zIndex`. Никаких DOM-«слоёв».
//
// Z-зоны (ориентир):
//   0     — фон таверны (bg_base)
//   10    — бармен за стойкой
//   20    — стойка бара (перекрывает бармена снизу)
//   30-32 — активная тройка героев у стойки
//   40-63 — массовка/мебель ближнего плана (по индивидуальному порядку Figma)
//   200+  — UI-бейджи и подписи поверх сцены

// Aspect ratio сцены == натуральному соотношению фона (1024×529 ≈ 1.936):
// bg_base рисуется object-cover БЕЗ обрезания по ширине — виден весь арт.
// Раньше было строгое 16:9 и бока фона срезались по ~4.4% с каждой стороны.
export const TAVERN_STAGE_RATIO = 1024 / 529;
export const TAVERN_PADDING_PX = 32; // letterbox-отступ от краёв окна

// Ночная фаза (NIGHT_KNOCKING): таверна пустеет — скрываются все посетители
// и активные герои, остаётся только бармен (NPC), фон, мебель и клик-зоны.
export const NIGHT_HIDDEN_ENTITY_TYPES = ['VISITOR', 'HERO_ACTIVE'];

export const TAVERN_ENTITIES = [
  // ─── ФОН ────────────────────────────────────────────────────────────
  {
    id: 'bg_base',
    type: 'BG',
    assetUrl: './assets/tavern/bg_base.webp',
    pos: { left: '50%', top: '50%' },
    zIndex: 0,
    interactive: false,
  },

  // ─── ДВЕРЬ (отдельный спрайт поверх проёма в bg_base) ───────────────
  // Фон теперь БЕЗ двери: дверь — свой спрайт, чтобы её можно было трясти
  // при ночном стуке (и позже открывать).
  // Источник: Figma node 3621:11967 (frame 3621:9346), координаты взяты
  // ОТНОСИТЕЛЬНО фоновой картинки (bg_base 1: 2433×1260 @ 19,10):
  //   door 162×750 @ 2268,384 → cx=0.9574, cy=0.5944, h=0.5952 от фона.
  // Сцена теперь в пропорции фона (кропа нет) — проценты фона == процентам сцены.
  {
    id: 'door_night',
    type: 'PROP',
    assetUrl: './assets/tavern/door.webp',
    pos: { left: '95.74%', top: '59.44%' },
    scale: 0.5952,
    aspect: 162 / 750, // натуральная пропорция спрайта — держит ширину у края сцены
    zIndex: 24, // над фоном/тонировкой пола, под клик-зоной door_to_map (25)
    interactive: false,
  },

  // ─── БАРМЕН (за стойкой) ────────────────────────────────────────────
  {
    id: 'npc_bartender',
    type: 'NPC',
    assetUrl: './assets/tavern/npc_bartender.webp',
    pos: { left: '42.61%', top: '35.57%' },
    scale: 0.4003, // 556/1389
    zIndex: 10,
    interactive: true,
    // Бармен виден из-за стойки — широкая верхняя половина «грудь+голова».
    hitbox: { left: '15%', top: '10%', width: '70%', height: '70%' },
    payload: { action: 'OPEN_BARTENDER_DIALOG' },
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

  // ─── АКТИВНАЯ ТРОЙКА ГЕРОЕВ У СТОЙКИ ────────────────────────────────
  // Конкретные герои подаются через props.activeParty[slotIndex].
  // Hero2 и Hero1 в Figma зеркалены (смотрят на бармена).
  {
    id: 'hero_slot_0',
    type: 'HERO_ACTIVE',
    slotIndex: 0,
    pos: { left: '34.68%', top: '51.55%' },
    scale: 0.4003,
    flipX: true,
    zIndex: 30,
    interactive: true,
    // Узкая центральная вертикаль — корпус персонажа без воздуха по бокам.
    hitbox: { left: '32%', top: '10%', width: '36%', height: '85%' },
    payload: { action: 'OPEN_PREP_SCREEN', slot: 0 },
  },
  {
    id: 'hero_slot_1',
    type: 'HERO_ACTIVE',
    slotIndex: 1,
    pos: { left: '50.20%', top: '51.19%' },
    scale: 0.4003,
    flipX: true,
    zIndex: 31,
    interactive: true,
    hitbox: { left: '32%', top: '10%', width: '36%', height: '85%' },
    payload: { action: 'OPEN_PREP_SCREEN', slot: 1 },
  },
  {
    id: 'hero_slot_2',
    type: 'HERO_ACTIVE',
    slotIndex: 2,
    pos: { left: '65.13%', top: '51.55%' },
    scale: 0.4003,
    flipX: false,
    zIndex: 32,
    interactive: true,
    hitbox: { left: '32%', top: '10%', width: '36%', height: '85%' },
    payload: { action: 'OPEN_PREP_SCREEN', slot: 2 },
  },

  // ─── МАССОВКА ДАЛЬНЕГО ПЛАНА ────────────────────────────────────────
  // Вся зона столов и посетителей опущена на +20px (арт-правка).
  // visitor_cloaked 2 (за самым правым столом, зеркальный)
  {
    id: 'visitor_cloaked_back_right',
    type: 'VISITOR',
    assetUrl: './assets/tavern/visitor_cloaked.webp',
    pos: { left: '90.19%', top: 'calc(68.76% + 20px)' },
    scale: 0.4435, // 616/1389
    aspect: 1, // спрайт 320×320; без aspect у края сцены контейнер схлопывается
    flipX: true,
    zIndex: 40,
    interactive: false,
  },

  // ─── СТОЛЫ ──────────────────────────────────────────────────────────
  {
    id: 'table_round_right',
    type: 'PROP',
    assetUrl: './assets/tavern/table_round.webp',
    pos: { left: '82.49%', top: 'calc(71.06% + 20px)' },
    scale: 0.7003,
    aspect: 1, // спрайт 320×320; фиксирует ширину у правого края (искажался)
    zIndex: 50,
    interactive: false,
  },
  {
    id: 'table_round_center',
    type: 'PROP',
    assetUrl: './assets/tavern/table_round.webp',
    pos: { left: '51.53%', top: 'calc(73.22% + 20px)' },
    scale: 0.4003,
    zIndex: 51,
    interactive: false,
  },
  {
    id: 'table_round_left',
    type: 'PROP',
    assetUrl: './assets/tavern/table_round.webp',
    pos: { left: '20.88%', top: 'calc(67.46% + 20px)' },
    scale: 0.4003,
    zIndex: 52,
    interactive: false,
  },

  // ─── ПОСЕТИТЕЛИ ПЕРЕДНЕГО ПЛАНА ─────────────────────────────────────
  {
    id: 'visitor_walker_a_center',
    type: 'VISITOR',
    assetUrl: './assets/tavern/visitor_walker_a.webp',
    pos: { left: '59.73%', top: 'calc(73.79% + 20px)' },
    scale: 0.4435,
    flipX: true,
    zIndex: 60,
    interactive: false,
  },
  {
    id: 'visitor_drunk_right',
    type: 'VISITOR',
    assetUrl: './assets/tavern/visitor_drunk.webp',
    pos: { left: '73.57%', top: 'calc(71.78% + 20px)' },
    scale: 0.4435,
    zIndex: 61,
    interactive: false,
  },
  {
    id: 'visitor_cloaked_center',
    type: 'VISITOR',
    assetUrl: './assets/tavern/visitor_cloaked.webp',
    pos: { left: '41.05%', top: 'calc(74.51% + 20px)' },
    scale: 0.4435,
    zIndex: 62,
    interactive: false,
  },
  {
    id: 'visitor_walker_a_left',
    type: 'VISITOR',
    assetUrl: './assets/tavern/visitor_walker_a.webp',
    pos: { left: '10.79%', top: 'calc(69.98% + 20px)' },
    scale: 0.4435,
    zIndex: 63,
    interactive: false,
  },

  // ─── ЛЕСТНИЦА → СОН (невидимая клик-зона на лестнице в bg_base) ─────
  // Лестница нарисована в фоне слева; отдельного ассета нет — кликаем по зоне.
  // Сон обязателен перед выходом в поход (см. hasRested в TavernHubScreen).
  {
    id: 'stairs_to_rest',
    type: 'PORTAL',
    pos: { left: '7.5%', top: '42%' },
    scale: 0.55, // высокая зона на весь лестничный пролёт
    aspect: 0.45,
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
    pos: { left: '92.5%', top: '52%' },
    scale: 0.6, // 60% высоты сцены — высокая узкая клик-зона
    aspect: 0.35, // ширина = 35% от высоты (узкий прямоугольник)
    zIndex: 25,
    interactive: true,
    minSectorRequired: 1,
    // Портал не имеет визуала — хитбокс == bbox сущности.
    hitbox: { left: '0%', top: '0%', width: '100%', height: '100%' },
    payload: { action: 'OPEN_MAP', label: 'В поход' },
  },
];
