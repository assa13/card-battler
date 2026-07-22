// Единая система разрешения экранов проекта.
//
// Базовый холст: 3200 × 1800 (16∶9) — источник истины для Figma и кода.
// Масштабирование: контент вписывается в viewport, ПРИОРИТЕТ — высота окна
// (letterbox по бокам на ультрашироких мониторах; на узких — min() ограничивает
// по ширине, высота уменьшается пропорционально).
//
// Figma → код (сущности сцены):
//   cx% = (left + width/2)  / 3200 × 100
//   cy% = (top  + height/2) / 1800 × 100
//   scale = size / 1800   (размер от высоты холста)

export const BASE_WIDTH = 3200;
export const BASE_HEIGHT = 1800;
export const BASE_ASPECT = BASE_WIDTH / BASE_HEIGHT; // 16/9
export const SCREEN_PADDING_PX = 32;

/** Доля viewport, которую занимает сцена (1 = на всю доступную высоту). */
export const STAGE_FILL = 1;

/**
 * CSS-высота сцены: min(высота viewport, ширина/aspect) × fill.
 * aspect — соотношение сторон контейнера (по умолчанию 16∶9); для таверны
 * передаётся натуральный aspect фона, чтобы object-cover не резал края.
 */
export const stageHeightCss = (fill = STAGE_FILL, aspect = BASE_ASPECT) =>
  `min(calc((100vh - ${SCREEN_PADDING_PX * 2}px) * ${fill}),` +
  ` calc((100vw - ${SCREEN_PADDING_PX * 2}px) * ${fill} / ${aspect}))`;

/** JS-множитель scale() для transform-обёртки 3200×1800. */
export const computeStageScale = (vw, vh, fill = STAGE_FILL) => {
  const availW = vw - SCREEN_PADDING_PX * 2;
  const availH = vh - SCREEN_PADDING_PX * 2;
  return Math.min(availH / BASE_HEIGHT, availW / BASE_WIDTH) * fill;
};

/**
 * Пиксельный прямоугольник сцены (16∶9, BASE_ASPECT) на экране: {left, top,
 * width, height}. Нужен оверлеям ВНЕ ScreenStage (диалоги, модалки), которым
 * требуется позиционировать элементы по координатам холста 3200×1800 в px
 * viewport, а не в % контейнера (см. docs/screen-scale.md §8).
 */
export const computeStageRect = (vw, vh, fill = STAGE_FILL) => {
  const scale = computeStageScale(vw, vh, fill);
  const width = BASE_WIDTH * scale;
  const height = BASE_HEIGHT * scale;
  return { left: (vw - width) / 2, top: (vh - height) / 2, width, height, scale };
};

// ─── Конвертеры Figma → проценты сцены ───────────────────────────────────────

export const figmaCx = (left, width) => ((left + width / 2) / BASE_WIDTH) * 100;
export const figmaCy = (top, height) => ((top + height / 2) / BASE_HEIGHT) * 100;
export const figmaScale = (size) => size / BASE_HEIGHT;
export const figmaLeft = (left) => (left / BASE_WIDTH) * 100;
export const figmaTop = (top) => (top / BASE_HEIGHT) * 100;
