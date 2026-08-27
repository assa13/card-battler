import { useEffect, useRef, useState } from 'react';
import EnemyDefenseCue from './EnemyDefenseCue';
import useStageSpace from './ui/useStageSpace';

const HORSE_COUNT = 8;
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
const MARKER_BORDER = 7;
const LINE_WIDTH = 5;
const FLASH_SIZE = 240;
const FLASH_BORDER = 10;
const IMPACT_SIZE = 240;
const IMPACT_BORDER = 13;
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

const HorseAtlasSprite = ({ active, size, speedFactor }) => {
  const [frame, setFrame] = useState(0);
  const atlas = active ? HORSE_ATLASES.active : HORSE_ATLASES.default;
  const fps = atlas.fps * BASE_ANIMATION_SPEED * speedFactor;

  useEffect(() => {
    const timer = setInterval(
      () => setFrame(previous => (previous + 1) % atlas.frameCount),
      1000 / fps,
    );
    return () => clearInterval(timer);
  }, [fps, atlas.frameCount]);

  const col = frame % atlas.cols;
  const row = Math.floor(frame / atlas.cols);
  return (
    <div style={{ width: size, height: size, overflow: 'hidden' }}>
      <img
        src={atlas.url}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="block max-w-none select-none"
        style={{
          width: atlas.cols * size,
          height: atlas.rows * size,
          marginLeft: -col * size,
          marginTop: -row * size,
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
};

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
    const impactAt = (target) => {
      const current = spaceRef.current;
      const hit = callbacksRef.current.onImpact?.({
        ...target,
        x: current.x(target.x),
        y: current.y(target.y),
      });
      return hit ? toCanvasNode(hit, current) : target;
    };

    const tick = (now) => {
      const elapsed = now - startedAtRef.current;
      let openedWindows = 0;
      const nextHorses = horsesRef.current.map(horse => {
        const localMs = elapsed - horse.spawnAt;
        const progress = clamp(localMs / horse.runMs, 0, 1);
        const x = arena.left - horseSize + progress * (arena.width + horseSize * 2);
        const reachedTarget = horse.active && horse.target && x >= horse.target.x;
        const impacted = horse.impacted || reachedTarget;
        const windowOpened = !horse.windowSignaled
          && localMs >= horse.runMs / 2 - WINDOW_HALF_MS;

        if (windowOpened) openedWindows += 1;
        const impactTarget = reachedTarget && !horse.impacted
          ? impactAt(horse.target)
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
      setHorses(nextHorses);
      if (openedWindows > 0) setWindowFlashSeq(sequence => sequence + openedWindows);

      if (elapsed >= totalMs && !resolvedRef.current) {
        const activatedCount = nextHorses.filter(horse => horse.active).length;
        resolvedRef.current = true;
        setResolved(true);
        setResultCount(activatedCount);
        const multiplier = Math.min(1.35, 1 + activatedCount * (0.35 / HORSE_COUNT));
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
          {card?.icon} {card?.name}
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
        className="fixed rounded-full bg-purple-400/10 pointer-events-none"
        style={{
          left: space.x(markerX),
          top: space.y(markerY),
          width: space.size(MARKER_SIZE),
          height: space.size(MARKER_SIZE),
          border: `${space.size(MARKER_BORDER)}px solid rgba(243,232,255,0.9)`,
          transform: 'translate(-50%, -50%)',
          boxShadow: '0 0 24px rgba(216,180,254,0.95), inset 0 0 20px rgba(168,85,247,0.55)',
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
            className="fixed rounded-full border-white"
            style={{
              left: space.x(markerX),
              top: space.y(markerY),
              width: space.size(FLASH_SIZE),
              height: space.size(FLASH_SIZE),
              borderWidth: space.size(FLASH_BORDER),
              boxShadow: '0 0 45px 16px rgba(255,255,255,0.95)',
              animation: 'horseHerdWindowMarkerFlash 300ms cubic-bezier(0.16, 1, 0.3, 1) both',
            }}
          />
        </div>
      )}

      {horses.map(horse => {
        if (horse.progress < 0 || horse.impacted) return null;
        const x = arena.left - horseSize + horse.progress * (arena.width + horseSize * 2);
        const fadeIn = clamp(horse.progress / 0.14, 0, 1);
        const fadeOut = clamp((1 - horse.progress) / 0.14, 0, 1);
        const opacity = Math.min(fadeIn, fadeOut);
        return (
          <div
            key={horse.id}
            className={`fixed pointer-events-none ${horse.active ? 'drop-shadow-[0_0_34px_rgba(168,85,247,1)]' : 'drop-shadow-[0_0_18px_rgba(148,163,184,0.65)]'}`}
            style={{
              left: space.x(x),
              top: space.y(horse.y),
              width: space.size(horseSize),
              height: space.size(horseSize),
              opacity,
              transform: `translate(-50%, -50%) scale(${horse.active ? 1.12 : 1})`,
              transition: 'filter 80ms ease-out, transform 80ms ease-out',
            }}
          >
            <HorseAtlasSprite
              active={horse.active}
              size={space.size(horseSize)}
              speedFactor={horse.speedFactor}
            />
            {horse.active && (
              <div
                key={`ignite-${horse.activatedAt}`}
                className="absolute inset-[-12%] rounded-full pointer-events-none"
                style={{
                  background: 'radial-gradient(circle, rgba(125,211,252,0.8) 0%, rgba(139,92,246,0.55) 36%, transparent 72%)',
                  boxShadow: '0 0 42px 16px rgba(59,130,246,0.7), 0 0 70px 28px rgba(139,92,246,0.5)',
                  animation: 'horseHerdIgniteFlash 460ms cubic-bezier(0.16, 1, 0.3, 1) both',
                  mixBlendMode: 'screen',
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
            className="rounded-full border-purple-100 bg-fuchsia-400/50 shadow-[0_0_55px_25px_rgba(168,85,247,0.9)]"
            style={{
              width: space.size(IMPACT_SIZE),
              height: space.size(IMPACT_SIZE),
              borderWidth: space.size(IMPACT_BORDER),
              borderStyle: 'solid',
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
          0% { opacity: 1; transform: scale(0.35); filter: brightness(2.4); }
          45% { opacity: 0.95; transform: scale(1.15); filter: brightness(1.7); }
          100% { opacity: 0; transform: scale(1.5); filter: brightness(1); }
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
