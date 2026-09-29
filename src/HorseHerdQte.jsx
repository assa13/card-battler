import { HORSE_COUNT, HORSE_QTE_BONUS } from './encounterBalance.js';
import SmallIconText from './ui/SmallIconText';
import { useEffect, useRef, useState } from 'react';
import EnemyDefenseCue from './EnemyDefenseCue';
import useStageSpace from './ui/useStageSpace';

const BASE_RUN_MS = 2084;
const CENTER_INTERVAL_MS = 600;
const WINDOW_HALF_MS = 121;
const RESULT_HOLD_MS = 300;
// Галоп идёт в темпе бега: пробег вдвое короче прежнего — значит и ноги
// переставляются вдвое чаще, иначе лошадь скользит по экрану.
const BASE_ANIMATION_SPEED = 2.6;
const HORSE_ATLASES = {
  default: { url: './chars/necro_horse_default.webp', cols: 4, rows: 4, frameCount: 16, fps: 10 },
  active: { url: './chars/necro_horse_active.webp', cols: 4, rows: 4, frameCount: 16, fps: 10 },
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Весь эффект считается в пикселях холста 3200×1800 и переводится в экранные
// только на отрисовке (см. ui/useStageSpace.js). Так задумано намеренно:
// раньше табун жил в экранных координатах, снятых на старте, и при ресайзе окна
// линия QTE уезжала от центра арены — момент нажатия переставал совпадать с
// картинкой. Заодно это правило для будущих QTE: проектируем в холсте, размер
// окна не должен влиять ни на геометрию, ни на тайминги.
const HORSE_SIZE_RATIO = 0.63;
const HORSE_SIZE_MIN = 488;
const HORSE_SIZE_MAX = 863;
const HORSE_ROW_JITTER = 117;
const MARKER_SIZE = 188;
const LINE_WIDTH = 5;
const FLASH_SIZE = 240;
const IMPACT_SIZE = 240;
const CUE_SIZE = 107;
const CUE_OFFSET_X = 47;
const CUE_OFFSET_Y = 43;

const getHorseSize = (arena) => clamp(
  arena.height * HORSE_SIZE_RATIO,
  HORSE_SIZE_MIN,
  HORSE_SIZE_MAX,
);

/** Прямоугольник и точки из DOM приходят в экранных пикселях — переводим в холст. */
const toCanvasRect = (rect, space) => ({
  left: space.canvasX(rect.left),
  top: space.canvasY(rect.top),
  width: space.canvasSize(rect.width),
  height: space.canvasSize(rect.height),
  bottom: space.canvasY(rect.bottom ?? rect.top + rect.height),
});

const toCanvasNode = (node, space) => ({
  ...node,
  x: space.canvasX(node.x),
  y: space.canvasY(node.y),
});

const createHorses = (arena, targetNodes) => {
  const safeTop = arena.top + arena.height * 0.2;
  const safeBottom = arena.bottom - arena.height * 0.2;
  const step = HORSE_COUNT > 1 ? (safeBottom - safeTop) / (HORSE_COUNT - 1) : 0;
  const firstCenterAt = (BASE_RUN_MS / 0.8) / 2;

  return Array.from({ length: HORSE_COUNT }, (_, index) => {
    const speedFactor = 0.8 + Math.random() * 0.4;
    const runMs = BASE_RUN_MS / speedFactor;
    const orderedY = safeTop + step * index;
    const jitter = (Math.random() - 0.5) * Math.min(HORSE_ROW_JITTER, arena.height * 0.11);
    const y = clamp(orderedY + jitter, safeTop, safeBottom);
    const target = [...targetNodes]
      .filter(node => node.x > arena.left + arena.width * 0.45)
      .sort((a, b) => Math.abs(a.y - y) - Math.abs(b.y - y))[0] || null;

    return {
      id: `horse_${index}_${Math.random().toString(36).slice(2)}`,
      index,
      // Центр арены каждый конь пересекает через стабильный интервал независимо
      // от своей случайной скорости — быстрые не догоняют медленных у QTE-линии.
      spawnAt: firstCenterAt + index * CENTER_INTERVAL_MS - runMs / 2,
      speedFactor,
      runMs,
      y,
      target,
      progress: -1,
      active: false,
      activatedAt: 0,
      impacted: false,
      impactTarget: null,
      windowSignaled: false,
    };
  });
};

const HorseHerdQte = ({
  arenaRect,
  targetNodes = [],
  card,
  onActivate,
  onImpact,
  onResolve,
  onDone,
}) => {
  const space = useStageSpace();
  // Арена и цели снимаются с DOM один раз на старте и дальше живут в холсте:
  // пересчитывать их при ресайзе не нужно, сцена сама встанет на новое место.
  const [arena] = useState(() => toCanvasRect(arenaRect, space));
  const [targets] = useState(() => targetNodes.map(node => toCanvasNode(node, space)));
  const [horses, setHorses] = useState(() => createHorses(arena, targets));
  const horsesRef = useRef(horses);
  const horseNodesRef = useRef(new Map());
  const [resolved, setResolved] = useState(false);
  const [resultCount, setResultCount] = useState(0);
  const [windowFlashSeq, setWindowFlashSeq] = useState(0);
  const startedAtRef = useRef(0);
  const rafRef = useRef(0);
  const finishTimerRef = useRef(0);
  const resolvedRef = useRef(false);
  const callbacksRef = useRef({ onActivate, onImpact, onResolve, onDone });
  // Экран в текущем кадре: обратный вызов об ударе уходит в бой экранной точкой,
  // там ждут именно её.
  const spaceRef = useRef(space);
  useEffect(() => { spaceRef.current = space; }, [space]);

  useEffect(() => {
    callbacksRef.current = { onActivate, onImpact, onResolve, onDone };
  }, [onActivate, onImpact, onResolve, onDone]);

  useEffect(() => {
    const totalMs = Math.max(...horsesRef.current.map(horse => horse.spawnAt + horse.runMs));
    const horseSize = getHorseSize(arena);
    startedAtRef.current = performance.now();

    // Бой отвечает свежей точкой удара в экранных пикселях — возвращаем её в холст.
    const impactAt = (target, active) => {
      const current = spaceRef.current;
      const hit = callbacksRef.current.onImpact?.({
        ...target,
        x: current.x(target.x),
        y: current.y(target.y),
      }, active);
      return hit ? toCanvasNode(hit, current) : target;
    };

    const tick = (now) => {
      const elapsed = now - startedAtRef.current;
      let openedWindows = 0;
      let changed = false;
      const nextHorses = horsesRef.current.map(horse => {
        const localMs = elapsed - horse.spawnAt;
        const progress = clamp(localMs / horse.runMs, 0, 1);
        const x = arena.left - horseSize + progress * (arena.width + horseSize * 2);
        const reachedTarget = horse.target && x >= horse.target.x;
        if (reachedTarget && !horse.impacted) changed = true;
        const impacted = horse.impacted || reachedTarget;
        const windowOpened = !horse.windowSignaled
          && localMs >= horse.runMs / 2 - WINDOW_HALF_MS;

        if (windowOpened) openedWindows += 1;
        const impactTarget = reachedTarget && !horse.impacted
          ? impactAt(horse.target, horse.active)
          : horse.impactTarget;
        return localMs < 0 ? horse : {
          ...horse,
          progress,
          impacted,
          impactTarget,
          windowSignaled: horse.windowSignaled || windowOpened,
        };
      });
      horsesRef.current = nextHorses;
      // Position and sprite UV updates do not go through React or layout.
      const current = spaceRef.current;
      for (const horse of nextHorses) {
        const node = horseNodesRef.current.get(horse.id);
        if (!node) continue;
        const visible = horse.progress >= 0 && horse.progress < 1 && !horse.impacted;
        node.style.visibility = visible ? 'visible' : 'hidden';
        if (!visible) continue;
        const x = arena.left - horseSize + horse.progress * (arena.width + horseSize * 2);
        node.style.transform = `translate3d(${current.x(x)}px, ${current.y(horse.y)}px, 0) translate(-50%, -50%)`;
        node.style.opacity = Math.min(clamp(horse.progress / 0.14, 0, 1), clamp((1 - horse.progress) / 0.14, 0, 1));
        const atlas = HORSE_ATLASES.default;
        const frame = Math.floor(Math.max(0, elapsed - horse.spawnAt) / 1000 * atlas.fps * BASE_ANIMATION_SPEED * horse.speedFactor) % atlas.frameCount;
        if (node.dataset.frame !== String(frame)) {
          node.firstElementChild.style.backgroundPosition = `${frame % atlas.cols / (atlas.cols - 1) * 100}% ${Math.floor(frame / atlas.cols) / (atlas.rows - 1) * 100}%`;
          node.dataset.frame = String(frame);
        }
      }
      if (changed) setHorses(nextHorses);
      if (openedWindows > 0) setWindowFlashSeq(sequence => sequence + openedWindows);

      if (elapsed >= totalMs && !resolvedRef.current) {
        const activatedCount = nextHorses.filter(horse => horse.active).length;
        resolvedRef.current = true;
        setResolved(true);
        setResultCount(activatedCount);
        const multiplier = 1 + activatedCount * (HORSE_QTE_BONUS / HORSE_COUNT);
        callbacksRef.current.onResolve?.(multiplier);
        finishTimerRef.current = window.setTimeout(
          () => callbacksRef.current.onDone?.(),
          RESULT_HOLD_MS,
        );
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(finishTimerRef.current);
    };
  }, [arena]);

  const activateCurrentHorse = (event) => {
    event.preventDefault();
    if (resolvedRef.current) return;
    const elapsed = performance.now() - startedAtRef.current;
    const candidate = horsesRef.current
      .filter(horse => !horse.active && !horse.impacted)
      .map(horse => ({
        horse,
        distance: Math.abs((elapsed - horse.spawnAt) - horse.runMs / 2),
      }))
      .filter(entry => entry.distance <= WINDOW_HALF_MS)
      .sort((a, b) => a.distance - b.distance)[0]?.horse;

    if (!candidate) return;
    callbacksRef.current.onActivate?.(candidate.index);
    const nextHorses = horsesRef.current.map(
      horse => horse.id === candidate.id
        ? { ...horse, active: true, activatedAt: performance.now() }
        : horse,
    );
    horsesRef.current = nextHorses;
    setHorses(nextHorses);
  };

  const horseSize = getHorseSize(arena);
  const markerX = arena.left + arena.width / 2;
  const markerY = arena.top + arena.height / 2;

  return (
    <div
      data-qte-overlay
      className="fixed inset-0 z-[8100] cursor-crosshair select-none"
      onPointerDown={activateCurrentHorse}
    >
      <div className="absolute inset-0 bg-purple-950/10 pointer-events-none" />
      <div
        className="fixed top-8 left-1/2 -translate-x-1/2 rounded-full border border-purple-300/40 bg-slate-950/80 px-5 py-2 text-center shadow-[0_0_35px_rgba(168,85,247,0.35)] pointer-events-none"
      >
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-purple-300">
          <SmallIconText>{card?.icon}</SmallIconText> {card?.name}
        </div>
        <div className="mt-1 text-xs font-bold text-white">
          {resolved ? `${resultCount}/${HORSE_COUNT} активировано` : 'Нажимайте, когда лошадь пересекает центр'}
        </div>
      </div>

      <div
        className="fixed bg-gradient-to-b from-transparent via-purple-200/50 to-transparent pointer-events-none"
        style={{
          left: space.x(markerX),
          top: space.y(arena.top),
          width: space.size(LINE_WIDTH),
          height: space.size(arena.height),
          transform: 'translateX(-50%)',
          boxShadow: '0 0 18px rgba(216, 180, 254, 0.4)',
        }}
      />
      <div
        className="fixed pointer-events-none"
        style={{
          left: space.x(markerX),
          top: space.y(markerY),
          width: space.size(MARKER_SIZE),
          height: space.size(MARKER_SIZE),
          border: `${space.size(7)}px solid rgba(243,232,255,0.9)`,
          borderRadius: '50%',
          background: 'rgba(192,132,252,0.1)',
          transform: 'translate(-50%, -50%)',

          animation: 'horseHerdMarkerPulse 720ms ease-in-out infinite',
        }}
      />
      <EnemyDefenseCue
        targetNode={{
          x: space.x(markerX - CUE_OFFSET_X),
          y: space.y(markerY - CUE_OFFSET_Y),
        }}
        size={space.size(CUE_SIZE)}
        zIndex={8200}
      />
      {windowFlashSeq > 0 && (
        <div key={`window-flash-${windowFlashSeq}`} className="fixed inset-0 pointer-events-none">
          <div
            className="absolute inset-0 bg-white"
            style={{ animation: 'horseHerdWindowScreenFlash 240ms ease-out both' }}
          />
          <div
            className="fixed"
            style={{
              left: space.x(markerX),
              top: space.y(markerY),
              width: space.size(FLASH_SIZE),
              height: space.size(FLASH_SIZE),
              border: `${space.size(10)}px solid white`,
              borderRadius: '50%',
              animation: 'horseHerdWindowMarkerFlash 300ms cubic-bezier(0.16, 1, 0.3, 1) both',
            }}
          />
        </div>
      )}

      {horses.map(horse => {
        if (horse.impacted) return null;
        return (
          <div
            key={horse.id}
            ref={node => { if (node) horseNodesRef.current.set(horse.id, node); else horseNodesRef.current.delete(horse.id); }}
            className="fixed pointer-events-none"
            style={{
              left: 0,
              top: 0,
              width: space.size(horseSize),
              height: space.size(horseSize),
              visibility: 'hidden',
              willChange: 'transform, opacity',
            }}
          >
            <div aria-hidden="true" style={{ width: '100%', height: '100%',
              backgroundImage: `url("${horse.active ? HORSE_ATLASES.active.url : HORSE_ATLASES.default.url}")`,
              backgroundSize: '400% 400%', backgroundRepeat: 'no-repeat', imageRendering: 'pixelated',
              transform: `scale(${horse.active ? 1.12 : 1})`, transition: 'transform 80ms ease-out',
            }} />
            {horse.active && (
              <div
                key={`ignite-${horse.activatedAt}`}
                className="absolute inset-[-12%] rounded-full pointer-events-none"
                style={{
                  background: 'radial-gradient(circle, rgba(125,211,252,0.8) 0%, rgba(139,92,246,0.55) 36%, transparent 72%)',
                  animation: 'horseHerdIgniteFlash 460ms cubic-bezier(0.16, 1, 0.3, 1) both',
                }}
              />
            )}
          </div>
        );
      })}

      {horses.filter(horse => horse.impacted && horse.impactTarget).map(horse => (
        <div
          key={`impact_${horse.id}`}
          className="fixed pointer-events-none"
          style={{
            left: space.x(horse.impactTarget.x),
            top: space.y(horse.impactTarget.y),
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            className="relative"
            style={{
              width: space.size(IMPACT_SIZE),
              height: space.size(IMPACT_SIZE),
              border: `${space.size(13)}px solid rgba(216,180,254,0.95)`,
              borderRadius: '50%',
              animation: 'horseHerdImpact 420ms cubic-bezier(0.16, 1, 0.3, 1) both',
            }}
          />
        </div>
      ))}
      <style>{`
        @keyframes horseHerdWindowScreenFlash {
          0% { opacity: 0; }
          18% { opacity: 0.32; }
          100% { opacity: 0; }
        }
        @keyframes horseHerdWindowMarkerFlash {
          0% { opacity: 1; transform: translate(-50%, -50%) scale(0.55); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1.65); }
        }
        @keyframes horseHerdIgniteFlash {
          0% { opacity: 1; transform: scale(0.35); }
          45% { opacity: 0.95; transform: scale(1.15); }
          100% { opacity: 0; transform: scale(1.5); }
        }
        @keyframes horseHerdMarkerPulse {
          0%, 100% { opacity: 0.72; transform: translate(-50%, -50%) scale(0.9); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.12); }
        }
        @keyframes horseHerdImpact {
          0% { opacity: 1; transform: scale(0.25); }
          45% { opacity: 0.95; transform: scale(1.15); }
          100% { opacity: 0; transform: scale(1.8); }
        }
      `}</style>
    </div>
  );
};

export default HorseHerdQte;
