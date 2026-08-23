import { STRANGER_COLORIZE } from '../spriteColorize';

// Реестр персонажей для экрана ночной встречи (NightEncounterScreen).
//
// История в своём конфиге указывает персонажа ПО ID из этого реестра +
// смещение от центра холста — вместо копипасты путей/параметров атласов:
//
//   encounter: {
//     character: 'cloaked_visitor',   // id из ENCOUNTER_CHARACTERS
//     offset: { x: 160, y: -40 },     // px от центра холста 3200×1800 (опц.)
//     size: 1813,                     // высота спрайта в px холста (опц.)
//     flipX: true,                    // горизонтальный флип (опц.)
//   }
//
// Новый персонаж = одна запись здесь (ассет уже должен лежать в public/).
// Все атласы — сетка 4×4, 16 кадров idle; fps по «настроению» ассета.

export const ENCOUNTER_CHARACTERS = {
  // ─── Монстры (боевые атласы public/chars) ───────────────────────────
  eye:        { atlas: { url: './chars/eye_atlas.webp',       cols: 4, rows: 4, frameCount: 16, fps: 6 } },
  bandit:     { atlas: { url: './chars/bandit_atlas.webp',    cols: 4, rows: 4, frameCount: 16, fps: 6 } },
  wolf:       { atlas: { url: './chars/wolf_atlas.webp',      cols: 4, rows: 4, frameCount: 16, fps: 6 } },
  goblin:     { atlas: { url: './chars/goblin_atlas.webp',    cols: 4, rows: 4, frameCount: 16, fps: 6 } },
  zombie:     { atlas: { url: './chars/zombie_atlas.webp',    cols: 4, rows: 4, frameCount: 16, fps: 6 } },
  orc:        { atlas: { url: './chars/orc_atlas.webp',       cols: 4, rows: 4, frameCount: 16, fps: 6 } },
  dark_mage:  { atlas: { url: './chars/dark_mage_atlas.webp', cols: 4, rows: 4, frameCount: 16, fps: 6 } },
  squish:     { atlas: { url: './chars/squish_atlas.webp',    cols: 4, rows: 4, frameCount: 16, fps: 6 } },
  shooter:    { atlas: { url: './chars/shooter_atlas.webp',   cols: 4, rows: 4, frameCount: 16, fps: 6 } },

  // ─── Люди (атласы таверны, ленивый ритм fps=4) ──────────────────────
  cloaked_visitor: { atlas: { url: './assets/tavern/visitor1.webp', cols: 4, rows: 4, frameCount: 16, fps: 4 } },
  common_visitor:  { atlas: { url: './assets/tavern/visitor0.webp', cols: 4, rows: 4, frameCount: 16, fps: 4 } },
  barman:          { atlas: { url: './assets/tavern/barman.webp',   cols: 4, rows: 4, frameCount: 16, fps: 4 } },
  // Наёмник Незнакомец (сюжет 2-й смерти): атлас 1280×1280, 4×4.
  stranger:        {
    atlas: { url: './assets/tavern/stranger.png', cols: 4, rows: 4, frameCount: 16, fps: 4 },
    colorize: STRANGER_COLORIZE,
  },
  // Скелет-поручитель (сюжет 1-й смерти): активный атлас с книгой заданий.
  task_master:      { atlas: { url: './assets/tavern/task_master.webp', cols: 4, rows: 4, frameCount: 16, fps: 4 } },
};

// Дефолтная постановка гостя в проёме окошка — Figma фрейм dialogue 3721:13570:
// центр спрайта (1760.5, 860.5) на холсте 3200×1800 → offset от центра
// (+160, −40), высота 1813px, зеркален (смотрит на игрока).
const DEFAULT_PLACEMENT = { offset: { x: 160, y: -40 }, size: 1813, flipX: true };
const DEFAULT_CHARACTER_ID = 'eye';

const CANVAS_W = 3200;
const CANVAS_H = 1800;

/**
 * Разворачивает encounter-конфиг истории в параметры рендера гостя:
 * `{ sprite, assetUrl, left, top, height, flipX }` (left/top/height — % сцены).
 *
 * Поддерживает и легаси-поля (visitorAtlas / visitorUrl) — они имеют
 * приоритет над character, чтобы старые скрипты не сломались.
 */
export const resolveEncounterGuest = (encounter) => {
  const char = encounter?.character ? ENCOUNTER_CHARACTERS[encounter.character] : null;

  // Спрайт: легаси-поля → реестр → дефолтный монстр.
  let sprite = null;
  let assetUrl;
  if (encounter?.visitorAtlas) sprite = encounter.visitorAtlas;
  else if (encounter?.visitorUrl) assetUrl = encounter.visitorUrl;
  else if (char?.atlas) sprite = char.atlas;
  else if (char?.url) assetUrl = char.url;
  else sprite = ENCOUNTER_CHARACTERS[DEFAULT_CHARACTER_ID].atlas;

  const offset = encounter?.offset ?? DEFAULT_PLACEMENT.offset;
  const size = encounter?.size ?? DEFAULT_PLACEMENT.size;
  const flipX = encounter?.flipX ?? DEFAULT_PLACEMENT.flipX;

  return {
    sprite,
    assetUrl,
    left: `${((CANVAS_W / 2 + (offset.x ?? 0)) / CANVAS_W) * 100}%`,
    top: `${((CANVAS_H / 2 + (offset.y ?? 0)) / CANVAS_H) * 100}%`,
    height: `${(size / CANVAS_H) * 100}%`,
    flipX,
    colorize: char?.colorize,
  };
};
