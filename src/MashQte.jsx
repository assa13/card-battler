import { useEffect, useRef, useState } from 'react';
import EnemyDefenseCue from './EnemyDefenseCue';
import VfxStrip from './vfx/VfxStrip';
import { FIREBALL_VFX } from './vfx/vfxCatalog';

const FLIGHT_MS = 520;
const BURN_MS = 7000;
const RESULT_HOLD_MS = 420;
const CLICK_RATE_WINDOW_MS = 1000;

const easeInOut = (value) => (
  value < 0.5 ? 2 * value * value : 1 - ((-2 * value + 2) ** 2) / 2
);

export default function MashQte({
  heroNode,
  targetNodes,
  card,
  onImpact,
  onBurnTick,
  onResolve,
  onDone,
}) {
  const projectileRef = useRef(null);
  const fireRefs = useRef([]);
  const cueRef = useRef(null);
  const counterRef = useRef(null);
  const timerRef = useRef(null);
  const instructionRef = useRef(null);
  const rafRef = useRef(0);
  const finishTimerRef = useRef(0);
  const startedAtRef = useRef(0);
  const burnStartedAtRef = useRef(0);
  const phaseRef = useRef('flight');
  const doneRef = useRef(false);
  const clicksRef = useRef(0);
  const clickTimesRef = useRef([]);
  const callbacksRef = useRef({ onImpact, onBurnTick, onResolve, onDone });
  const primaryTarget = targetNodes[0] || heroNode;
  const flightAngle = Math.atan2(
    primaryTarget.y - heroNode.y,
    primaryTarget.x - heroNode.x,
  ) * 180 / Math.PI;
  const [impactStarted, setImpactStarted] = useState(false);

  useEffect(() => {
    callbacksRef.current = { onImpact, onBurnTick, onResolve, onDone };
  }, [onImpact, onBurnTick, onResolve, onDone]);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    cancelAnimationFrame(rafRef.current);
    if (cueRef.current) cueRef.current.style.opacity = '0';
    if (instructionRef.current) instructionRef.current.textContent = 'ПЛАМЯ УГАСАЕТ';
    callbacksRef.current.onResolve?.(clicksRef.current);
    finishTimerRef.current = window.setTimeout(
      () => callbacksRef.current.onDone?.(),
      RESULT_HOLD_MS,
    );
  };

  useEffect(() => {
    startedAtRef.current = performance.now();

    const tick = (now) => {
      if (doneRef.current) return;

      if (phaseRef.current === 'flight') {
        const progress = Math.min(1, (now - startedAtRef.current) / FLIGHT_MS);
        const eased = easeInOut(progress);
        if (projectileRef.current) {
          projectileRef.current.style.left = `${heroNode.x + (primaryTarget.x - heroNode.x) * eased}px`;
          projectileRef.current.style.top = `${heroNode.y + (primaryTarget.y - heroNode.y) * eased}px`;
          projectileRef.current.style.transform = `translate(-50%, -50%) rotate(${flightAngle}deg) scale(${(0.7 + Math.sin(progress * Math.PI) * 0.65) * 2})`;
        }
        if (progress >= 1) {
          const hasTargets = callbacksRef.current.onImpact?.();
          if (hasTargets === false) {
            finish();
            return;
          }
          setImpactStarted(true);
          phaseRef.current = 'burn';
          burnStartedAtRef.current = now;
          if (projectileRef.current) projectileRef.current.style.opacity = '0';
          if (cueRef.current) cueRef.current.style.opacity = '1';
          if (instructionRef.current) instructionRef.current.textContent = 'ЖМИТЕ ЛКМ КАК МОЖНО БЫСТРЕЕ';
        }
      } else {
        const burnElapsed = now - burnStartedAtRef.current;
        const remainingMs = Math.max(0, BURN_MS - burnElapsed);
        if (timerRef.current) timerRef.current.textContent = `${(remainingMs / 1000).toFixed(1)}с`;

        clickTimesRef.current = clickTimesRef.current.filter(
          (clickedAt) => now - clickedAt <= CLICK_RATE_WINDOW_MS,
        );
        const clicksPerSecond = clickTimesRef.current.length;
        const rateIntensity = Math.min(1, clicksPerSecond / 10);
        const accumulatedIntensity = Math.min(1, clicksRef.current / 40);
        const intensity = Math.max(0.12, rateIntensity * 0.72 + accumulatedIntensity * 0.28);
        fireRefs.current.forEach((node, index) => {
          if (!node) return;
          const pulse = 1 + Math.sin(now / 65 + index) * 0.08;
          node.style.opacity = `${0.3 + intensity * 0.7}`;
          node.style.transform = `translate(-50%, -50%) scale(${(0.72 + intensity * 0.85) * pulse})`;
          node.style.filter = `brightness(${0.8 + intensity * 1.3}) saturate(${1.1 + intensity * 1.7})`;
        });
        if (cueRef.current) {
          cueRef.current.style.transform = `scale(${0.88 + rateIntensity * 0.24})`;
        }

        if (burnElapsed >= BURN_MS) {
          finish();
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
    // Геометрия и колбэки фиксируются ref-ами на время одного QTE.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePointerDown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (doneRef.current || event.button !== 0 || phaseRef.current !== 'burn') return;

    clicksRef.current += 1;
    clickTimesRef.current.push(performance.now());
    const clickCount = clicksRef.current;
    // Каждый следующий тик сильнее предыдущего; после 41-го рост одного тика
    // ограничен половиной базового удара, но общая сумма продолжает расти.
    const damageScale = Math.min(0.5, 0.1 + (clickCount - 1) * 0.01);
    const hasTargets = callbacksRef.current.onBurnTick?.({ clickCount, damageScale });
    if (counterRef.current) counterRef.current.textContent = `${clickCount} УДАРОВ`;
    fireRefs.current.forEach((node) => {
      node?.animate(
        [
          { boxShadow: '0 0 35px rgba(249,115,22,0.65)' },
          { boxShadow: '0 0 95px rgba(254,215,170,1)' },
          { boxShadow: '0 0 45px rgba(239,68,68,0.8)' },
        ],
        { duration: 130, easing: 'ease-out' },
      );
    });
    if (hasTargets === false) finish();
  };

  return (
    <div
      className="fixed inset-0 z-[8200] cursor-pointer select-none"
      style={{ touchAction: 'none', fontFamily: "'Greybeard', sans-serif" }}
      onPointerDown={handlePointerDown}
      onContextMenu={(event) => event.preventDefault()}
      data-qte-overlay="mash"
    >
      <div className="absolute inset-0 bg-slate-950/55 pointer-events-none" />

      <div
        className="fixed pointer-events-none"
        style={{
          left: heroNode.x,
          top: heroNode.y,
          transform: `translate(-50%, -50%) rotate(${flightAngle}deg)`,
        }}
      >
        <VfxStrip sheet={FIREBALL_VFX.muzzle} realTime />
      </div>

      <div
        ref={projectileRef}
        className="fixed pointer-events-none"
        style={{
          left: heroNode.x,
          top: heroNode.y,
          transform: `translate(-50%, -50%) rotate(${flightAngle}deg) scale(1.4)`,
          willChange: 'left, top, transform',
        }}
      >
        <VfxStrip sheet={FIREBALL_VFX.projectile} loop realTime />
      </div>

      {impactStarted && targetNodes.map((target, index) => (
        <div
          key={`fireball-impact-${target.id}`}
          className="fixed pointer-events-none"
          style={{
            left: target.x,
            top: target.y,
            transform: `translate(-50%, -50%) rotate(${flightAngle}deg)`,
          }}
        >
          <VfxStrip
            sheet={FIREBALL_VFX.hits[index % FIREBALL_VFX.hits.length]}
            realTime
          />
        </div>
      ))}

      {targetNodes.map((target, index) => (
        <div
          key={target.id}
          ref={(node) => { fireRefs.current[index] = node; }}
          className="fixed h-56 w-56 rounded-full pointer-events-none opacity-0"
          style={{
            left: target.x,
            top: target.y,
            transform: 'translate(-50%, -50%) scale(0.7)',
            background: 'radial-gradient(circle, rgba(254,240,138,0.88) 0%, rgba(249,115,22,0.62) 24%, rgba(220,38,38,0.34) 52%, transparent 73%)',
            boxShadow: '0 0 35px rgba(249,115,22,0.65)',
            transition: 'opacity 90ms linear',
            willChange: 'transform, filter, opacity',
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center text-8xl">🔥</div>
        </div>
      ))}

      <div
        ref={cueRef}
        className="fixed inset-0 opacity-0 pointer-events-none origin-center"
        style={{ transition: 'opacity 100ms ease-out', willChange: 'transform' }}
      >
        <EnemyDefenseCue
          targetNode={{ x: primaryTarget.x - 48, y: primaryTarget.y - 150 }}
          size={96}
          zIndex={8202}
        />
      </div>

      <div className="fixed left-1/2 top-9 -translate-x-1/2 rounded-full border border-orange-300/50 bg-slate-950/90 px-8 py-3 text-center pointer-events-none">
        <div ref={instructionRef} className="text-2xl text-orange-100">
          {card?.icon} ОГНЕННЫЙ ШАР ЛЕТИТ
        </div>
        <div className="mt-1 flex items-center justify-center gap-8 text-xl">
          <span ref={counterRef} className="text-amber-300">0 УДАРОВ</span>
          <span ref={timerRef} className="text-white">7.0с</span>
        </div>
      </div>
    </div>
  );
}
