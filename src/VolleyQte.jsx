import { useEffect, useRef } from 'react';
import EnemyDefenseCue from './EnemyDefenseCue';

const FIRST_OUTBOUND_MS = 720;
const RETURN_MS = [640, 556, 484, 420];
const WINDOW_HALF_MS = [150, 131, 114, 99];
const RESULT_HOLD_MS = 340;
const MAX_DEFLECTS = 4;

const easeInOut = (value) => (
  value < 0.5 ? 2 * value * value : 1 - ((-2 * value + 2) ** 2) / 2
);

export default function VolleyQte({
  heroNode,
  card,
  onRequestTarget,
  onPrompt,
  onDeflect,
  onImpact,
  onResolve,
  onDone,
}) {
  const ballRef = useRef(null);
  const cueRef = useRef(null);
  const labelRef = useRef(null);
  const statusRef = useRef(null);
  const rafRef = useRef(0);
  const finishTimerRef = useRef(0);
  const doneRef = useRef(false);
  const promptedRef = useRef(false);
  const deflectsRef = useRef(0);
  const phaseRef = useRef(null);
  const callbacksRef = useRef({
    onRequestTarget,
    onPrompt,
    onDeflect,
    onImpact,
    onResolve,
    onDone,
  });

  useEffect(() => {
    callbacksRef.current = {
      onRequestTarget,
      onPrompt,
      onDeflect,
      onImpact,
      onResolve,
      onDone,
    };
  }, [onRequestTarget, onPrompt, onDeflect, onImpact, onResolve, onDone]);

  const setBallPosition = (x, y, scale = 1) => {
    if (!ballRef.current) return;
    ballRef.current.style.left = `${x}px`;
    ballRef.current.style.top = `${y}px`;
    ballRef.current.style.transform = `translate(-50%, -50%) scale(${scale})`;
  };

  const finish = (reason) => {
    if (doneRef.current) return;
    doneRef.current = true;
    cancelAnimationFrame(rafRef.current);
    if (cueRef.current) cueRef.current.style.opacity = '0';
    if (statusRef.current) {
      statusRef.current.textContent = reason === 'max'
        ? 'МАКСИМАЛЬНАЯ СЕРИЯ!'
        : `${deflectsRef.current}/${MAX_DEFLECTS} отбивов`;
      statusRef.current.style.color = reason === 'max' ? '#fbbf24' : '#cbd5e1';
    }
    if (reason !== 'max' && ballRef.current) {
      ballRef.current.style.transition = 'transform 180ms ease-in, opacity 260ms ease-out, filter 180ms';
      ballRef.current.style.transform = 'translate(-50%, 35px) scale(0.45)';
      ballRef.current.style.opacity = '0';
      ballRef.current.style.filter = 'grayscale(1) brightness(0.35)';
      ballRef.current.animate(
        [
          { marginLeft: '0px' },
          { marginLeft: '-14px' },
          { marginLeft: '11px' },
          { marginLeft: '-7px' },
          { marginLeft: '0px' },
        ],
        { duration: 220, easing: 'ease-out' },
      );
    }
    callbacksRef.current.onResolve?.(deflectsRef.current);
    finishTimerRef.current = window.setTimeout(
      () => callbacksRef.current.onDone?.(),
      RESULT_HOLD_MS,
    );
  };

  const beginOutbound = (target, hitNumber, duration) => {
    promptedRef.current = false;
    if (cueRef.current) cueRef.current.style.opacity = '0';
    phaseRef.current = {
      kind: 'outbound',
      startedAt: performance.now(),
      duration,
      from: heroNode,
      to: target,
      target,
      hitNumber,
    };
  };

  const beginReturn = (target, bounceIndex) => {
    promptedRef.current = false;
    if (labelRef.current) {
      labelRef.current.textContent = 'ЖМИ';
      labelRef.current.style.color = '#fbbf24';
    }
    phaseRef.current = {
      kind: 'return',
      startedAt: performance.now(),
      duration: RETURN_MS[bounceIndex],
      from: target,
      to: heroNode,
      target,
      bounceIndex,
    };
  };

  useEffect(() => {
    const firstTarget = callbacksRef.current.onRequestTarget?.(0);
    if (!firstTarget) {
      finish('empty');
      return undefined;
    }
    beginOutbound(firstTarget, 0, FIRST_OUTBOUND_MS);

    const tick = (now) => {
      if (doneRef.current) return;
      const phase = phaseRef.current;
      if (!phase) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const elapsed = now - phase.startedAt;
      const progress = Math.min(1, Math.max(0, elapsed / phase.duration));
      const eased = easeInOut(progress);
      setBallPosition(
        phase.from.x + (phase.to.x - phase.from.x) * eased,
        phase.from.y + (phase.to.y - phase.from.y) * eased,
        0.82 + Math.sin(progress * Math.PI) * 0.38,
      );

      if (phase.kind === 'outbound' && progress >= 1) {
        const hasTargets = callbacksRef.current.onImpact?.(phase.target, phase.hitNumber);
        if (hasTargets === false) {
          finish(phase.hitNumber >= MAX_DEFLECTS ? 'max' : 'complete');
          return;
        }
        if (phase.hitNumber >= MAX_DEFLECTS) {
          finish('max');
          return;
        }
        beginReturn(phase.target, phase.hitNumber);
      } else if (phase.kind === 'return') {
        const halfWindow = WINDOW_HALF_MS[phase.bounceIndex];
        const distanceToArrival = Math.abs(elapsed - phase.duration);
        const cueVisible = elapsed >= phase.duration - halfWindow * 1.65;
        if (cueRef.current) cueRef.current.style.opacity = cueVisible ? '1' : '0';
        if (distanceToArrival <= halfWindow && !promptedRef.current) {
          promptedRef.current = true;
          cueRef.current?.animate(
            [
              { opacity: 0.45 },
              { opacity: 1 },
              { opacity: 0.72 },
            ],
            { duration: halfWindow * 2, easing: 'ease-out' },
          );
          callbacksRef.current.onPrompt?.(phase.bounceIndex);
        }
        if (elapsed > phase.duration + halfWindow) {
          finish('late');
          return;
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(finishTimerRef.current);
    };
    // Геометрия фиксируется на короткую (до 2 с) серию.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePointerDown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (doneRef.current || event.button !== 0) return;
    const phase = phaseRef.current;
    if (!phase || phase.kind !== 'return') return;

    const elapsed = performance.now() - phase.startedAt;
    const halfWindow = WINDOW_HALF_MS[phase.bounceIndex];
    // Ранний клик не наказывает: игрок может нажать снова, когда шар подлетит.
    if (elapsed < phase.duration - halfWindow) return;
    if (elapsed > phase.duration + halfWindow) return;

    deflectsRef.current += 1;
    callbacksRef.current.onDeflect?.(phase.bounceIndex);
    const nextHitNumber = phase.bounceIndex + 1;
    const nextTarget = callbacksRef.current.onRequestTarget?.(nextHitNumber);
    if (!nextTarget) {
      finish('complete');
      return;
    }
    setBallPosition(heroNode.x, heroNode.y, 1.3);
    beginOutbound(
      nextTarget,
      nextHitNumber,
      Math.round(RETURN_MS[phase.bounceIndex] * 0.45),
    );
  };

  return (
    <div
      className="fixed inset-0 z-[8250] cursor-crosshair select-none"
      style={{ touchAction: 'none', fontFamily: "'Greybeard', sans-serif" }}
      onPointerDown={handlePointerDown}
      onContextMenu={(event) => event.preventDefault()}
      data-qte-overlay="volley"
    >
      <div className="absolute inset-0 bg-slate-950/45 pointer-events-none" />
      <div
        ref={ballRef}
        className="fixed h-20 w-20 rounded-full border-4 border-emerald-100 pointer-events-none"
        style={{
          left: heroNode.x,
          top: heroNode.y,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle at 35% 30%, #f8fafc 0%, #6ee7b7 18%, #059669 52%, #022c22 100%)',
          boxShadow: '0 0 24px #6ee7b7, 0 0 60px rgba(16,185,129,0.8), inset 0 0 16px rgba(255,255,255,0.8)',
          willChange: 'left, top, transform',
        }}
      >
        <span className="absolute inset-0 flex items-center justify-center text-4xl">✦</span>
      </div>

      <div
        ref={cueRef}
        className="fixed inset-0 pointer-events-none opacity-0"
        style={{
          transition: 'opacity 45ms linear',
        }}
      >
        <EnemyDefenseCue
          targetNode={{ x: heroNode.x - 48, y: heroNode.y - 160 }}
          size={96}
          zIndex={8252}
        />
        <div
          ref={labelRef}
          className="fixed -translate-x-1/2 rounded-lg border-2 border-amber-300/70 bg-slate-950/90 px-5 py-1 text-3xl text-amber-300"
          style={{
            left: heroNode.x,
            top: heroNode.y - 58,
            textShadow: '0 0 14px currentColor',
          }}
        >
          ЖМИ
        </div>
      </div>

      <div
        ref={statusRef}
        className="fixed left-1/2 top-10 -translate-x-1/2 rounded-full border border-emerald-300/40 bg-slate-950/85 px-7 py-3 text-2xl text-emerald-100 pointer-events-none"
        style={{ textShadow: '0 3px 8px rgba(0,0,0,0.95)' }}
      >
        {card?.icon} ШАР БЬЁТ САМ · ЖМИТЕ У ГЕРОЯ
      </div>
    </div>
  );
}
