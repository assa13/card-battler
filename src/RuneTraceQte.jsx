import { useEffect, useMemo, useRef, useState } from 'react';

import {
  RUNE_TRACE,
  buildRunePath,
  fitRuneShape,
  generateRuneShape,
  runeLengthForStep,
} from './runeTrace';
import RuneLineVfx from './vfx/RuneLineVfx';

// QTE «Руна защиты»: игрок сам прочерчивает линию маркером, зажав кнопку.
//
// ТЕМП ЗАДАЁТ ИГРОК. Бегунка по расписанию нет: подготовка босса — это дедлайн.
// Довёл маркер до конца, пока босс замирает, — защита сработала, вердикт
// выносится сразу. Не довёл — на выходе обычный пропущенный удар.
//
// МАРКЕР НА РЕЛЬСЕ. Зажимать и двигать мышь можно в любой точке экрана, но
// маркер живёт на линии: в ход идёт только составляющая движения вдоль неё,
// поперёк он упирается. Сойти с линии нельзя, промахнуться мимо неё — тоже.
// Работа игрока — толкнуть маркер по нужной оси на всю длину, пока есть время.
//
// Назад маркер едет так же, как вперёд: рельса физическая, а не храповик.
// Единственный предел — maxJumpPx за событие, чтобы телепорт указателя не
// засчитывался за прочерченную линию.
//
// ТИК-МЕНЕДЖЕР: единственный rAF-цикл только рисует, всё через ref, ноль
// setState на кадр. Прогресс считается в обработчике движения — там шаги мелкие.
// Время РЕАЛЬНОЕ: мир замедлен qteSlowMo, руна нет.
//
// Резолв ровно один раз (doneRef): доведённая линия или конец подготовки.

const RESULT_STYLE = {
  perfect: { text: 'PERFECT!', color: '#fbbf24', glow: 'rgba(251,191,36,0.95)' },
  miss:    { text: 'MISS',     color: '#94a3b8', glow: 'rgba(148,163,184,0.4)' },
};

const HINT = {
  grab: 'ЗАЖМИ И ВЕДИ',
  trace: 'ТОЛКАЙ ДО КОНЦА',
  end: 'ДОВОДИ',
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const buzz = (ms) => {
  try { navigator.vibrate?.(ms); } catch { /* вибрация недоступна — не критично */ }
};

/**
 * Props:
 *  - targetNode: { x, y } — viewport-центр героя, от него чертится руна.
 *  - durationMs: длительность участка подготовки босса = дедлайн на проход.
 *  - stepIndex: номер звена серии — влияет на длину руны.
 *  - label: имя атаки под руной.
 *  - onGrab: () => void — игрок взялся за маркер.
 *  - onBreak: () => void — кнопку отпустили на полпути, маркер вернулся в начало.
 *  - onRelease: (verdict) => void — линия доведена (вызывается только на успех).
 *  - onResolve: ('perfect'|'miss') => void.
 *  - onDone: () => void — сигнал на размонтирование.
 */
export default function RuneTraceQte({
  targetNode,
  durationMs,
  stepIndex = 0,
  label,
  resultLabels = null,
  resultLingerMs = 300,
  showVignette = true,
  onGrab,
  onBreak,
  onRelease,
  onResolve,
  onDone,
}) {
  const viewport = useMemo(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }), []);

  // Руна разыгрывается один раз на монтирование: направление — часть розыгрыша.
  const shape = useMemo(() => {
    const scale = viewport.height / 1080;
    const raw = generateRuneShape({ lengthPx: runeLengthForStep(stepIndex) * scale });
    const points = fitRuneShape({
      points: raw,
      anchor: targetNode,
      safeRect: {
        left: 48,
        top: 48,
        right: viewport.width - 48,
        // Низ экрана занят рукой с картами — руну туда не пускаем.
        bottom: viewport.height * 0.62,
      },
    });
    const start = points[0];
    const end = points[points.length - 1];
    const length = dist(start, end);
    return {
      d: buildRunePath(points),
      start,
      end,
      length,
      // Единичный вектор вдоль линии: по нему раскладываем позицию маркера на
      // «сколько прошёл» и «насколько вылез из коридора».
      dir: { x: (end.x - start.x) / length, y: (end.y - start.y) / length },
      scale,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pathRef = useRef(null);
  const inkRef = useRef(null);
  const startRingRef = useRef(null);
  const endRef = useRef(null);
  const penRef = useRef(null);
  const timerRef = useRef(null);
  const rafRef = useRef(0);
  const startedAtRef = useRef(0);
  const lengthRef = useRef(0);
  // Позиция маркера — одна координата вдоль рельсы, в пикселях от начала.
  const alongRef = useRef(0);
  const rawPointerRef = useRef(null);
  const grabbedRef = useRef(false);
  const resetAtRef = useRef(-Infinity);
  const doneRef = useRef(false);
  const [phase, setPhase] = useState('grab');
  const [result, setResult] = useState(null);

  const maxJump = RUNE_TRACE.maxJumpPx * shape.scale;
  const startRadius = RUNE_TRACE.startRadiusPx * shape.scale;
  const endRadius = RUNE_TRACE.endRadiusPx * shape.scale;

  const finish = (res) => {
    if (doneRef.current) return;
    doneRef.current = true;
    onResolve(res);
    setResult(res);
    setTimeout(onDone, resultLingerMs);
  };

  const penPoint = () => ({
    x: shape.start.x + shape.dir.x * alongRef.current,
    y: shape.start.y + shape.dir.y * alongRef.current,
  });

  useEffect(() => {
    lengthRef.current = pathRef.current?.getTotalLength?.() || shape.length;
    if (inkRef.current) {
      inkRef.current.setAttribute('stroke-dasharray', String(lengthRef.current));
      inkRef.current.setAttribute('stroke-dashoffset', String(lengthRef.current));
    }
    startedAtRef.current = performance.now();

    const tick = (now) => {
      if (doneRef.current) return;
      const elapsed = now - startedAtRef.current;
      const left = clamp(1 - elapsed / durationMs, 0, 1);
      const ratio = alongRef.current / shape.length;
      const dropped = now - resetAtRef.current < RUNE_TRACE.strayFlashMs;

      if (inkRef.current) {
        inkRef.current.setAttribute(
          'stroke-dashoffset',
          String(lengthRef.current * (1 - ratio)),
        );
        inkRef.current.setAttribute(
          'stroke',
          dropped ? 'rgba(248,113,113,0.95)' : 'rgba(251,191,36,0.95)',
        );
      }
      if (startRingRef.current) {
        const pulse = 1 + 0.12 * Math.sin(elapsed / 140);
        startRingRef.current.setAttribute('r', String(startRadius * pulse));
        startRingRef.current.setAttribute('opacity', grabbedRef.current ? '0' : '0.9');
      }
      if (endRef.current) {
        // Конечная точка разгорается по мере прохода: видно, что осталось.
        endRef.current.style.opacity = String(0.35 + ratio * 0.65);
        endRef.current.style.transform = `translate(-50%, -50%) scale(${1 + ratio * 0.35})`;
      }
      if (penRef.current) {
        const point = penPoint();
        penRef.current.style.opacity = grabbedRef.current ? '1' : '0.5';
        penRef.current.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -50%)`;
      }
      if (timerRef.current) {
        // Дедлайн виден полоской у героя, а не бегунком на линии: время давит,
        // но не диктует темп.
        timerRef.current.style.transform = `scaleX(${left})`;
        timerRef.current.style.background = left < 0.25 ? '#f87171' : '#fbbf24';
      }

      const nextPhase = !grabbedRef.current
        ? 'grab'
        : (ratio > 0.75 ? 'end' : 'trace');
      setPhase(prev => (prev === nextPhase ? prev : nextPhase));

      // Единственный выход по времени: живём ровно столько, сколько длится
      // подготовка босса.
      if (elapsed >= durationMs) {
        finish('miss');
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMs]);

  const handlePointerDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    // Зажимать можно где угодно: точка нажатия — только начало отсчёта дельты,
    // сам маркер всегда стартует с начала руны.
    rawPointerRef.current = { x: e.clientX, y: e.clientY };
    if (doneRef.current || grabbedRef.current) return;

    // Захват указателя: при относительном ведении реальный курсор запросто
    // уходит за край оверлея, и без capture жест обрывался бы на полпути.
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* не критично */ }
    grabbedRef.current = true;
    alongRef.current = 0;
    setPhase('trace');
    buzz(8);
    onGrab?.();
  };

  const handlePointerMove = (e) => {
    const raw = rawPointerRef.current;
    rawPointerRef.current = { x: e.clientX, y: e.clientY };
    if (doneRef.current || !grabbedRef.current || !raw) return;

    // Рельса: от движения мыши берём только проекцию на линию. Поперечная
    // составляющая пропадает целиком — маркер в неё упирается.
    const step = clamp(
      (e.clientX - raw.x) * shape.dir.x + (e.clientY - raw.y) * shape.dir.y,
      -maxJump,
      maxJump,
    );
    alongRef.current = clamp(alongRef.current + step, 0, shape.length);

    if (alongRef.current >= shape.length * RUNE_TRACE.completeRatio) {
      onRelease?.('perfect');
      buzz(26);
      finish('perfect');
    }
  };

  const handleRelease = (e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    rawPointerRef.current = null;
    if (doneRef.current || !grabbedRef.current) return;
    // Кнопку надо держать всю дорогу: отпустил на полпути — маркер срывается
    // с рельсы обратно в начало.
    grabbedRef.current = false;
    alongRef.current = 0;
    resetAtRef.current = performance.now();
    setPhase('grab');
    buzz(14);
    onBreak?.();
  };

  const style = result ? RESULT_STYLE[result] : null;
  const verdictText = result && (resultLabels?.[result] ?? style.text);

  return (
    // Полноэкранный катчер: зажимать и вести можно где угодно. Системный курсор
    // скрыт — управление относительное, и два указателя на экране противоречили
    // бы друг другу. data-qte-overlay исключает руну из bullet-time.
    <div
      className="fixed inset-0 z-[7000] select-none"
      style={{ pointerEvents: result ? 'none' : 'auto', touchAction: 'none', cursor: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handleRelease}
      onPointerCancel={handleRelease}
      onContextMenu={(e) => e.preventDefault()}
      data-qte-overlay="rune"
    >
      {showVignette && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at ${targetNode.x}px ${targetNode.y}px, rgba(2,6,23,0) 220px, rgba(2,6,23,0.7) 620px)`,
            animation: 'runeFadeIn 0.28s ease-out both',
            opacity: result ? 0 : 1,
            transition: 'opacity 0.45s ease',
          }}
        />
      )}

      <svg
        className="absolute inset-0 pointer-events-none"
        width={viewport.width}
        height={viewport.height}
      >
        {/* Линия видна целиком с самого начала: игрок сразу знает, куда вести
            и сколько осталось. Неожиданность только в направлении. */}
        <path
          ref={pathRef}
          d={shape.d}
          fill="none"
          stroke="rgba(148,163,184,0.32)"
          strokeWidth={RUNE_TRACE.trackWidthPx * shape.scale}
          strokeLinecap="round"
        />
        {/* Чернила: прочерченный участок руны */}
        {!result && (
          <path
            ref={inkRef}
            d={shape.d}
            fill="none"
            stroke="rgba(251,191,36,0.95)"
            strokeWidth={RUNE_TRACE.inkWidthPx * shape.scale}
            strokeLinecap="round"
            style={{
              filter: 'drop-shadow(0 0 10px rgba(251,191,36,0.6))',
              willChange: 'stroke-dashoffset',
            }}
          />
        )}
        {/* Кольцо старта: гаснет, как только взялись */}
        {!result && (
          <circle
            ref={startRingRef}
            cx={shape.start.x} cy={shape.start.y}
            r={startRadius}
            fill="none"
            stroke="rgba(251,191,36,0.9)"
            strokeWidth={3}
            style={{ filter: 'drop-shadow(0 0 14px rgba(251,191,36,0.5))' }}
          />
        )}
      </svg>

      {result === 'perfect' && (
        <RuneLineVfx
          start={shape.start}
          end={shape.end}
          scale={shape.scale}
        />
      )}

      {/* Конечная точка: разгорается по мере прохода */}
      {!result && (
        <div
          ref={endRef}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: shape.end.x,
            top: shape.end.y,
            width: endRadius * 2,
            height: endRadius * 2,
            transform: 'translate(-50%, -50%)',
            border: '3px solid rgba(255,255,255,0.9)',
            boxShadow: '0 0 26px rgba(255,255,255,0.45)',
            opacity: 0.35,
          }}
        />
      )}

      {/* Маркер игрока: единственный указатель на экране, курсор скрыт */}
      {!result && (
        <div
          ref={penRef}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: 0,
            top: 0,
            width: RUNE_TRACE.penRadiusPx * 2 * shape.scale,
            height: RUNE_TRACE.penRadiusPx * 2 * shape.scale,
            background: 'rgba(255,255,255,0.98)',
            boxShadow: '0 0 18px rgba(255,255,255,0.9)',
          }}
        />
      )}

      {/* Подсказка, таймер и вердикт держим у героя, а не на линии */}
      <div
        className="absolute flex flex-col items-center gap-1 pointer-events-none"
        style={{ left: targetNode.x, top: targetNode.y + 96, transform: 'translateX(-50%)' }}
      >
        {!result ? (
          <>
            <div
              className="px-3 py-0.5 rounded-full font-black uppercase tracking-widest text-[11px] bg-slate-950/85 border whitespace-nowrap"
              style={{
                color: phase === 'end' ? '#fde68a' : '#cbd5e1',
                borderColor: 'rgba(251,191,36,0.45)',
              }}
            >
              {HINT[phase]}
            </div>
            <div className="h-1 w-28 rounded-full bg-slate-900/80 overflow-hidden">
              <div
                ref={timerRef}
                className="h-full w-full origin-left"
                style={{ background: '#fbbf24', transform: 'scaleX(1)' }}
              />
            </div>
            {label && (
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {label}
              </div>
            )}
          </>
        ) : (
          <div
            className="font-black uppercase tracking-tight whitespace-nowrap"
            style={{
              color: style.color,
              fontSize: 40,
              textShadow: `0 0 20px ${style.glow}, 0 4px 8px rgba(0,0,0,0.9)`,
              animation: 'runePop 0.38s cubic-bezier(0.2, 1.6, 0.4, 1) both',
            }}
          >
            {verdictText}
          </div>
        )}
      </div>

      <style>{`
        @keyframes runePop { from { transform: scale(0.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes runeFadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
