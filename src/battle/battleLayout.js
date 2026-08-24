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

export const HERO_SLOTS = [
  { x: 930, y: 1081, width: 422, height: 574 },
  { x: 1389, y: 1081, width: 422, height: 574 },
  { x: 1848, y: 1081, width: 422, height: 574 },
];

// Девять слотов предметов внутри панели, шаг 106 при размере 96.
export const ITEM_SLOTS = { x: 1103.5, y: 933, size: 96, step: 106, count: 9 };

// Декор рисуется 360×360 при регионе 320×320 — растяжение по решению дизайна.
// В атласе горгулья одна, правая — её горизонтальное зеркало.
export const DECOR = [
  { id: 'decor-left', x: 532, y: 1023, size: 360, flip: false },
  { id: 'decor-right', x: 2667, y: 1023, size: 360, flip: true },
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
