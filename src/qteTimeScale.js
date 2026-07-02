// Bullet-time для QTE «Perfect Hit»: пока кольцо сужается, весь мир плавно
// замедляется, а кольцо и тайминг-судья остаются в РЕАЛЬНОМ времени.
//
// КАК РАБОТАЕТ (и почему именно так):
//  - Мир = все Web Animations документа (CSS-анимации + CSS-транзишены:
//    прыжок героя, полёт снарядов, idle-атласы, попапы). Единый rAF-цикл
//    каждый кадр выставляет им playbackRate = текущий масштаб. Ловит и
//    анимации, созданные УЖЕ во время замедления (VFX спавнятся позже старта QTE).
//  - Оверлей QTE (узел с [data-qte-overlay]) исключён: кольцо крутится в
//    реальном времени, его окна ±60/±150 мс — настоящие миллисекунды.
//  - «Игровое» время: delay(ms) резолвится, когда накопится ms СКАЛИРОВАННЫХ
//    миллисекунд (dt × scale). Импакт-задержка боя живёт в игровом времени —
//    урон приходит синхронно с замедленным прыжком/снарядом.
//  - Масштаб меняется плавно (ramp): вход в слоу-мо ~120 мс, выход ~250 мс.
//
// НЕЛЬЗЯ: растягивать длительности транзишенов/сетТаймаутов вручную под
// qte.duration — это рассинхронизирует судью тайминга (см. инцидент в истории).
// Единственная точка замедления мира — этот модуль.

const SLOW_SCALE = 0.35;   // скорость мира во время QTE
const RAMP_IN_MS = 260;    // вход в слоу-мо: ease-in — сперва еле заметно, в конце «провал»
const RAMP_OUT_MS = 300;   // выход: ease-out — резкий разгон, мягкий доезд до ×1
const MAX_FRAME_DT = 100;  // кап dt: после сворачивания вкладки не «прыгаем»

const easeInCubic = (p) => p * p * p;
const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);

let current = 1;      // текущий масштаб мира
let target = 1;       // целевой масштаб
let ramp = null;      // { from, to, t, dur, ease } — активный переход масштаба
let rafId = 0;
let lastTs = 0;
let lastApplied = 1;  // чтобы не перебирать анимации, когда всё уже на 1
let waiters = [];     // { left: остаток игровых мс, resolve }

const applyRate = (rate) => {
  for (const anim of document.getAnimations()) {
    const el = anim.effect?.target;
    if (el?.closest?.('[data-qte-overlay]')) continue; // кольцо — реальное время
    if (anim.playbackRate !== rate) anim.playbackRate = rate;
  }
  lastApplied = rate;
};

const tick = (ts) => {
  const dt = Math.min(MAX_FRAME_DT, ts - lastTs);
  lastTs = ts;

  if (ramp) {
    ramp.t += dt;
    const k = Math.min(1, ramp.t / ramp.dur);
    current = ramp.from + (ramp.to - ramp.from) * ramp.ease(k);
    if (k >= 1) { current = ramp.to; ramp = null; }
  }

  if (current !== 1 || lastApplied !== 1) applyRate(current);

  if (waiters.length) {
    const gameDt = dt * current;
    waiters = waiters.filter(w => {
      w.left -= gameDt;
      if (w.left <= 0) { w.resolve(); return false; }
      return true;
    });
  }

  if (current === 1 && target === 1 && waiters.length === 0) { rafId = 0; return; }
  rafId = requestAnimationFrame(tick);
};

const ensureLoop = () => {
  if (rafId) return;
  lastTs = performance.now();
  rafId = requestAnimationFrame(tick);
};

export const qteSlowMo = {
  /** Вход в слоу-мо (вызывать при старте QTE). Ease-in: погружение нарастает к концу. */
  start() {
    if (target === SLOW_SCALE) return;
    target = SLOW_SCALE;
    ramp = { from: current, to: SLOW_SCALE, t: 0, dur: RAMP_IN_MS, ease: easeInCubic };
    ensureLoop();
  },
  /** Выход из слоу-мо (вердикт QTE / resetGame). Ease-out: быстрый разгон, мягкий доезд. */
  end() {
    if (target === 1) return;
    target = 1;
    ramp = { from: current, to: 1, t: 0, dur: RAMP_OUT_MS, ease: easeOutCubic };
    ensureLoop();
  },
  /** Промис через ms ИГРОВОГО времени (при масштабе 1 ≈ setTimeout). */
  delay(ms) {
    return new Promise(resolve => {
      waiters.push({ left: ms, resolve });
      ensureLoop();
    });
  },
};
