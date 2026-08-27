// Раскладка боевого экрана на холсте 3200×1800.
//
// Источник — фрейм Frame 4010 в Figma, координаты сняты через get_metadata и
// оставлены в пикселях макета: пересчёт в проценты делает StageBox. Вложенные
// фреймы развёрнуты в абсолютные координаты холста, чтобы в коде не было
// цепочек смещений.
//
// Внутри фрейма подложкой лежит скриншот старого боя (image 14) — он только
// ориентир для разметки и в код не переносится.

export const BATTLE_FIGMA = {
  fileKey: 'zG9zihyiBTJFjR5dVta74Z',
  nodeId: '130:3323',
  url: 'https://www.figma.com/design/zG9zihyiBTJFjR5dVta74Z/card-crawler?node-id=130-3323',
};

export const BATTLE_LAYOUT = {
  // Картинка локации внутри рамки — не из атласа, приходит отдельным ассетом.
  fieldBackground: { x: 564, y: 115, width: 2071, height: 816 },
  locationFrame: { x: 521, y: 69, width: 2156, height: 876 },
  inventoryBg: { x: 503, y: 891, width: 2167, height: 180 },
  mergeButton: { x: 2547, y: 868, width: 210, height: 212 },
  manaCounter: { x: 587, y: 1267, width: 256, height: 256 },
  buttonRed: { x: 2337, y: 1330, width: 312, height: 130 },
};

// Арт локации кладётся в fieldBackground как в маску: картинка 2048×2048 крупнее
// окна и сдвинута, видна только её нижняя полоса. Смещение снято с макета
// (Frame 5, node 177:2313) относительно левого верхнего угла окна.
// Локаций будет несколько — здесь только их геометрия, выбор делает бой.
export const FIELD_ART = {
  fight: { url: './assets/battle/fight_bg.webp', x: 11, y: -775, size: 2048 },
};

export const HERO_SLOTS = [
  { x: 930, y: 1081, width: 422, height: 574 },
  { x: 1389, y: 1081, width: 422, height: 574 },
  { x: 1848, y: 1081, width: 422, height: 574 },
];

// Девять слотов предметов внутри панели, шаг 106 при размере 96.
export const ITEM_SLOTS = { x: 1103.5, y: 933, size: 96, step: 106, count: 9 };

// Декор рисуется 360×360 при регионе 320×320 — растяжение по решению дизайна.
// В атласе горгулья одна, правая — её горизонтальное зеркало.
// Горгульи стоят на одной линии и симметрично относительно оси рамки локации:
// правая — зеркало левой и по горизонтали, и по вертикали.
const FRAME_AXIS = BATTLE_LAYOUT.locationFrame.x * 2 + BATTLE_LAYOUT.locationFrame.width;
const DECOR_LEFT = { id: 'decor-left', x: 532, y: 1023, size: 360, flip: false };

export const DECOR = [
  DECOR_LEFT,
  { ...DECOR_LEFT, id: 'decor-right', x: FRAME_AXIS - DECOR_LEFT.x - DECOR_LEFT.size, flip: true },
];

// Стопки карт повёрнуты на ±2°, рисуются в родном размере региона. Координаты —
// левый верхний угол неповёрнутой картинки: габарит 130×176 в макете это bbox
// поворота, а не растяжение.
export const CARD_DECKS = [
  { id: 'deck-draw', x: 649.96, y: 1557.33, width: 124, height: 172, rotate: -2 },
  { id: 'deck-discard', x: 2431.93, y: 1553, width: 124, height: 172, rotate: 2 },
];

// Спрайты бойцов на поле — абсолютные координаты холста.
export const FIELD_UNITS = [
  { id: 'hero2', x: 556, y: 180, size: 441 },
  { id: 'hero3', x: 613, y: 467, size: 442 },
  { id: 'hero1', x: 936, y: 291, size: 441 },
];

/** Позиция героя по индексу в отряде: p1 — первый. */
export const HERO_UNITS = ['hero1', 'hero2', 'hero3'].map(
  (id) => FIELD_UNITS.find((unit) => unit.id === id),
);

// Врагов в макете нет — их места это зеркало героев относительно вертикальной
// оси поля, ровно как на старом экране. Ось: середина fieldBackground.
const FIELD_AXIS = BATTLE_LAYOUT.fieldBackground.x * 2 + BATTLE_LAYOUT.fieldBackground.width;
const mirror = (unit) => ({ ...unit, x: FIELD_AXIS - unit.x - unit.size });

// Строй врагов по их числу повторяет старый экран: одиночка встаёт напротив
// воина, пара — напротив разбойника и мага, тройка занимает все три места.
export const ENEMY_FORMATIONS = {
  1: [mirror(HERO_UNITS[0])],
  2: [mirror(HERO_UNITS[1]), mirror(HERO_UNITS[2])],
  3: [mirror(HERO_UNITS[1]), mirror(HERO_UNITS[0]), mirror(HERO_UNITS[2])],
};

// Босс крупнее рядового и от этого визуально проваливается вниз — тот же
// сдвиг, что на старом экране, пересчитанный в масштаб холста.
export const BOSS_SCALE = 1.5625;

// Панель слияния артефактов (Figma 243:1817).
//
// Выезжает вниз «из-под арены»: в макете её верхние 160 px закрыты рамкой поля.
// По слоям панель, наоборот, лежит выше HUD — иначе её прятал бы ещё и
// инвентарь, — а эффект даёт обрезка: MERGE_PANEL_CLIP начинается ровно на
// нижней кромке рамки, и всё выше неё срезается.
export const MERGE_PANEL = {
  x: 1181.5,
  y: 785,
  width: 832,
  height: 750,
  // Тёмная подложка внутри рамки — сплошная заливка из макета.
  bg: { left: 38, top: 45, width: 762, height: 679, color: '#151515' },
  slotSize: 169.587,
  slotTop: 330.12,
  slotLefts: [115, 332.59, 548.89],
  // Иконка предмета в гнезде.
  slotIcon: { size: 136, radius: 11.663 },
  button: { left: 115, top: 544, width: 602, height: 113 },
};

const ARENA_BOTTOM = BATTLE_LAYOUT.locationFrame.y + BATTLE_LAYOUT.locationFrame.height;

/** Запас снизу под перелёт: на отскоке панель ныряет ниже своего места. */
const MERGE_PANEL_BOUNCE = 60;

export const MERGE_PANEL_CLIP = {
  x: MERGE_PANEL.x,
  y: ARENA_BOTTOM,
  width: MERGE_PANEL.width,
  height: MERGE_PANEL.y + MERGE_PANEL.height + MERGE_PANEL_BOUNCE - ARENA_BOTTOM,
};

/** Насколько верх панели уходит под арену, в координатах обрезающего бокса. */
export const MERGE_PANEL_OFFSET_Y = MERGE_PANEL.y - ARENA_BOTTOM;

/** Сдвиг убранной панели: нижняя кромка встаёт вровень с верхом обрезки. */
export const MERGE_PANEL_HIDDEN_Y = -(MERGE_PANEL_OFFSET_Y + MERGE_PANEL.height);

// Карта сектора занимает всю зону HUD: по ширине идёт вровень с рамкой арены,
// сверху начинается сразу под ней и тянется до нижней кромки холста.
//
// Внутри она пока свёрстана в своих старых пикселях (MAP_PANEL_DESIGN) — до
// редизайна её содержимое не трогаем, а к боксу на холсте приводим одним
// scale(). Поэтому высота бокса не задаётся вручную, а считается из ширины по
// пропорции старой вёрстки: иначе карту растянуло бы неравномерно.
export const MAP_PANEL_DESIGN = { width: 1024, height: 403 };

const MAP_PANEL_WIDTH = BATTLE_LAYOUT.locationFrame.width;

export const MAP_PANEL = {
  x: BATTLE_LAYOUT.locationFrame.x,
  y: BATTLE_LAYOUT.locationFrame.y + BATTLE_LAYOUT.locationFrame.height,
  width: MAP_PANEL_WIDTH,
  height: Math.round(MAP_PANEL_WIDTH * (MAP_PANEL_DESIGN.height / MAP_PANEL_DESIGN.width)),
};
