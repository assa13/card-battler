import { useEffect, useRef, useState } from 'react';
import EnemyDefenseCue from './EnemyDefenseCue';

const HORSE_COUNT = 8;
const BASE_RUN_MS = 4167;
const CENTER_INTERVAL_MS = 1200;
const WINDOW_HALF_MS = 121;
const RESULT_HOLD_MS = 300;
const BASE_ANIMATION_SPEED = 1.3;
const HORSE_ATLASES = {
  default: { url: './chars/necro_horse_default.webp', cols: 4, rows: 4, frameCount: 16, fps: 10 },
  active: { url: './chars/necro_horse_active.webp', cols: 4, rows: 4, frameCount: 16, fps: 10 },
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const getHorseSize = (arenaRect) => clamp(arenaRect.height * 0.42, 195, 345);

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

const createHorses = (arenaRect, targetNodes) => {
  const safeTop = arenaRect.top + arenaRect.height * 0.2;
  const safeBottom = arenaRect.bottom - arenaRect.height * 0.2;
  const step = HORSE_COUNT > 1 ? (safeBottom - safeTop) / (HORSE_COUNT - 1) : 0;
  const firstCenterAt = (BASE_RUN_MS / 0.8) / 2;

  return Array.from({ length: HORSE_COUNT }, (_, index) => {
    const speedFactor = 0.8 + Math.random() * 0.4;
    const runMs = BASE_RUN_MS / speedFactor;
    const orderedY = safeTop + step * index;
    const jitter = (Math.random() - 0.5) * Math.min(70, arenaRect.height * 0.11);
    const y = clamp(orderedY + jitter, safeTop, safeBottom);
    const target = [...targetNodes]
      .filter(node => node.x > arenaRect.left + arenaRect.width * 0.45)
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
  const [horses, setHorses] = useState(() => createHorses(arenaRect, targetNodes));
  const horsesRef = useRef(horses);
  const [resolved, setResolved] = useState(false);
  const [resultCount, setResultCount] = useState(0);
  const [windowFlashSeq, setWindowFlashSeq] = useState(0);
  const startedAtRef = useRef(0);
  const rafRef = useRef(0);
  const finishTimerRef = useRef(0);
  const resolvedRef = useRef(false);
  const callbacksRef = useRef({ onActivate, onImpact, onResolve, onDone });

  useEffect(() => {
    callbacksRef.current = { onActivate, onImpact, onResolve, onDone };
  }, [onActivate, onImpact, onResolve, onDone]);

  useEffect(() => {
    const totalMs = Math.max(...horsesRef.current.map(horse => horse.spawnAt + horse.runMs));
    const horseSize = getHorseSize(arenaRect);
    startedAtRef.current = performance.now();

    const tick = (now) => {
      const elapsed = now - startedAtRef.current;
      let openedWindows = 0;
      const nextHorses = horsesRef.current.map(horse => {
        const localMs = elapsed - horse.spawnAt;
        const progress = clamp(localMs / horse.runMs, 0, 1);
        const x = arenaRect.left - horseSize + progress * (arenaRect.width + horseSize * 2);
        const reachedTarget = horse.active && horse.target && x >= horse.target.x;
        const impacted = horse.impacted || reachedTarget;
        const windowOpened = !horse.windowSignaled
          && localMs >= horse.runMs / 2 - WINDOW_HALF_MS;

        if (windowOpened) openedWindows += 1;
        const impactTarget = reachedTarget && !horse.impacted
          ? (callbacksRef.current.onImpact?.(horse.target, horse.index) || horse.target)
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
  }, [arenaRect]);

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

  const horseSize = getHorseSize(arenaRect);
  const markerX = arenaRect.left + arenaRect.width / 2;
  const markerY = arenaRect.top + arenaRect.height / 2;

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
        className="fixed w-[3px] bg-gradient-to-b from-transparent via-purple-200/50 to-transparent pointer-events-none"
        style={{
          left: markerX,
          top: arenaRect.top,
          height: arenaRect.height,
          transform: 'translateX(-50%)',
          boxShadow: '0 0 18px rgba(216, 180, 254, 0.4)',
        }}
      />
      <div
        className="fixed w-28 h-28 rounded-full border-4 border-purple-100/90 bg-purple-400/10 pointer-events-none"
        style={{
          left: markerX,
          top: markerY,
          transform: 'translate(-50%, -50%)',
          boxShadow: '0 0 24px rgba(216,180,254,0.95), inset 0 0 20px rgba(168,85,247,0.55)',
          animation: 'horseHerdMarkerPulse 720ms ease-in-out infinite',
        }}
      />
      <EnemyDefenseCue
        targetNode={{ x: markerX - 28, y: markerY - 26 }}
        size={64}
        zIndex={8200}
      />
      {windowFlashSeq > 0 && (
        <div key={`window-flash-${windowFlashSeq}`} className="fixed inset-0 pointer-events-none">
          <div
            className="absolute inset-0 bg-white"
            style={{ animation: 'horseHerdWindowScreenFlash 240ms ease-out both' }}
          />
          <div
            className="fixed w-36 h-36 rounded-full border-[6px] border-white"
            style={{
              left: markerX,
              top: markerY,
              boxShadow: '0 0 45px 16px rgba(255,255,255,0.95)',
              animation: 'horseHerdWindowMarkerFlash 300ms cubic-bezier(0.16, 1, 0.3, 1) both',
            }}
          />
        </div>
      )}

      {horses.map(horse => {
        if (horse.progress < 0 || horse.impacted) return null;
        const x = arenaRect.left - horseSize + horse.progress * (arenaRect.width + horseSize * 2);
        const fadeIn = clamp(horse.progress / 0.14, 0, 1);
        const fadeOut = clamp((1 - horse.progress) / 0.14, 0, 1);
        const opacity = Math.min(fadeIn, fadeOut);
        return (
          <div
            key={horse.id}
            className={`fixed pointer-events-none ${horse.active ? 'drop-shadow-[0_0_34px_rgba(168,85,247,1)]' : 'drop-shadow-[0_0_18px_rgba(148,163,184,0.65)]'}`}
            style={{
              left: x,
              top: horse.y,
              width: horseSize,
              height: horseSize,
              opacity,
              transform: `translate(-50%, -50%) scale(${horse.active ? 1.12 : 1})`,
              transition: 'filter 80ms ease-out, transform 80ms ease-out',
            }}
          >
            <HorseAtlasSprite
              active={horse.active}
              size={horseSize}
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
            left: horse.impactTarget.x,
            top: horse.impactTarget.y,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            className="w-36 h-36 rounded-full border-8 border-purple-100 bg-fuchsia-400/50 shadow-[0_0_55px_25px_rgba(168,85,247,0.9)]"
            style={{ animation: 'horseHerdImpact 420ms cubic-bezier(0.16, 1, 0.3, 1) both' }}
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
