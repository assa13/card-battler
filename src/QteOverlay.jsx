import { useEffect, useRef, useState } from 'react';

// Окна тайминга (мс) вокруг момента, когда сужающееся кольцо совпадает с мишенью.
// Клик с |отклонением| <= PERFECT — «PERFECT!», <= GOOD — «GOOD», дальше — промах.
const PERFECT_WINDOW_MS = 60;
const GOOD_WINDOW_MS = 150;
// Игнор: если игрок не кликнул до конца good-окна — авто-мисс (урон ×1.0, бой не ждёт).
const IGNORE_TIMEOUT_MS = GOOD_WINDOW_MS;
const RESULT_LINGER_MS = 600;   // сколько висит вердикт после резолва
const RING_START_SCALE = 3.0;   // стартовый масштаб кольца
const RING_MIN_SCALE = 0.72;    // до какого масштаба кольцо «проваливается» при игноре
const AOE_SCALE = 1.35;         // укрупнение оверлея для массовых атак
const BASE = 128;               // px, диаметр мишени (кольцо scale=1)

const RESULT_STYLE = {
  perfect: { text: 'PERFECT!', color: '#fbbf24', glow: 'rgba(251,191,36,0.95)' },
  good:    { text: 'GOOD',     color: '#38bdf8', glow: 'rgba(56,189,248,0.8)' },
  miss:    { text: 'MISS',     color: '#94a3b8', glow: 'rgba(148,163,184,0.4)' },
};

// ИЗИНГ КОЛЬЦА: ease-in-quad. Первую половину времени кольцо еле ползёт —
// игрок успевает прочитать сетап (карту, зоны); в конце ныряет в мишень
// с ускорением — напряжение нарастает к моменту клика (референс: osu!,
// active reload из Gears). Судья тайминга живёт во ВРЕМЕНИ (окна ±60/±150мс
// не зависят от кривой) — изинг только визуальный, а зоны-пояса ниже
// пересчитаны через ту же кривую, так что геометрия честная.
const easeInQuad = (p) => p * p;

// Масштаб кольца в момент t: до duration — ease-in к 1.0; после — линейный
// «провал» вниз с терминальной скоростью (визуальный сигнал опоздания).
const scaleAt = (t, duration) => {
  const span = RING_START_SCALE - 1;
  if (t <= duration) return RING_START_SCALE - span * easeInQuad(Math.max(0, t) / duration);
  const vEnd = (span * 2) / duration; // скорость ease-in-quad в точке p=1
  return Math.max(RING_MIN_SCALE, 1 - vEnd * (t - duration));
};

// Кольцо-пояс (annulus) от innerScale до outerScale вокруг центра мишени.
const Annulus = ({ outer, inner, color, glow }) => {
  const size = BASE * outer;
  const borderW = Math.max(1, (BASE * outer - BASE * inner) / 2);
  return (
    <div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size, height: size,
        left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        border: `${borderW}px solid ${color}`,
        boxShadow: glow || 'none',
      }}
    />
  );
};

/**
 * QTE «Perfect Hit» v2: сужающееся кольцо с ease-in, видимыми зонами тайминга,
 * виньеткой-фокусом и крупной картой-контекстом.
 *
 * ТИК-МЕНЕДЖЕР: единственный rAF-цикл. Каждый кадр elapsed берётся из
 * performance.now() (РЕАЛЬНОЕ время — мир вокруг замедлен qteSlowMo, кольцо нет),
 * scale пишется напрямую в style DOM-ноды через ref — ноль setState на кадр.
 * Тот же rAF «заряжает» кольцо при входе в good-окно (цвет + onArm-тик).
 *
 * Резолв — ровно один раз (doneRef): клик ИЛИ авто-мисс по таймауту.
 *
 * Props:
 *  - targetType: 'aoe' | 'single' — aoe укрупняется (×1.35).
 *  - targetNode: { x, y } — viewport-координаты центра.
 *  - duration:   мс сужения кольца до мишени.
 *  - card:       { icon, name } | null — разыгрываемая карта (контекст над кольцом).
 *  - onArm:      () => void — кольцо вошло в good-окно (тик-звук), 1 раз.
 *  - onResolve:  (result: 'perfect'|'good'|'miss') => void.
 *  - onDone:     () => void — сигнал на размонтирование.
 */
export default function QteOverlay({ targetType = 'single', targetNode, duration, card, onArm, onResolve, onDone }) {
  const ringRef = useRef(null);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const doneRef = useRef(false);
  const armedRef = useRef(false);
  const [result, setResult] = useState(null);

  const finish = (res) => {
    if (doneRef.current) return;
    doneRef.current = true;
    onResolve(res);
    setResult(res);
    setTimeout(onDone, RESULT_LINGER_MS);
  };

  useEffect(() => {
    startRef.current = performance.now();
    const tick = (now) => {
      if (doneRef.current) return;
      const elapsed = now - startRef.current;
      const scale = scaleAt(elapsed, duration);
      const ring = ringRef.current;
      if (ring) {
        ring.style.transform = `translate(-50%, -50%) scale(${scale})`;
        // «Заряд»: внутри good-окна кольцо вспыхивает янтарным — сигнал «жми сейчас»
        const inWindow = Math.abs(elapsed - duration) <= GOOD_WINDOW_MS;
        if (inWindow && !armedRef.current) {
          armedRef.current = true;
          ring.style.borderColor = '#fbbf24';
          ring.style.boxShadow = '0 0 24px rgba(251,191,36,0.9), 0 0 60px rgba(251,191,36,0.4)';
          onArm?.();
        }
      }
      if (elapsed > duration + IGNORE_TIMEOUT_MS) { finish('miss'); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  const handleClick = (e) => {
    e.stopPropagation();
    if (doneRef.current) return;
    const delta = Math.abs(performance.now() - startRef.current - duration);
    finish(delta <= PERFECT_WINDOW_MS ? 'perfect' : delta <= GOOD_WINDOW_MS ? 'good' : 'miss');
  };

  const style = result ? RESULT_STYLE[result] : null;
  const wrapScale = targetType === 'aoe' ? AOE_SCALE : 1;

  // Видимые зоны тайминга: пояса в scale-пространстве через ту же кривую изинга.
  // Игрок видит геометрию окна — «клик, когда белое кольцо в золотом поясе».
  const goodOuter = scaleAt(duration - GOOD_WINDOW_MS, duration);
  const goodInner = scaleAt(duration + GOOD_WINDOW_MS, duration);
  const perfOuter = scaleAt(duration - PERFECT_WINDOW_MS, duration);
  const perfInner = scaleAt(duration + PERFECT_WINDOW_MS, duration);

  return (
    // Полноэкранный клик-катчер: тайминг жмётся В ЛЮБОМ месте экрана.
    // После вердикта pointer-events отключаются — управление мгновенно
    // возвращается картам, пока догорает вердикт.
    <div
      className="fixed inset-0 z-[7000] select-none cursor-pointer"
      style={{ pointerEvents: result ? 'none' : 'auto' }}
      onMouseDown={handleClick}
      data-qte-overlay={targetType}
    >
      {/* Виньетка-фокус: бой гаснет, светится только зона QTE (Sekiro-style) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at ${targetNode.x}px ${targetNode.y}px, rgba(2,6,23,0) ${150 * wrapScale}px, rgba(2,6,23,0.72) ${470 * wrapScale}px)`,
          animation: 'qteFadeIn 0.28s ease-out both',
          opacity: result ? 0 : 1,
          transition: 'opacity 0.45s ease',
        }}
      />

      {/* Сцена QTE: всё позиционируется от центра цели, AoE укрупняется целиком */}
      <div
        className="absolute w-96 h-96 pointer-events-none"
        style={{
          left: targetNode.x,
          top: targetNode.y,
          transform: `translate(-50%, -50%) scale(${wrapScale})`,
        }}
      >
        {/* Карта-контекст: ЧТО усиливаем (иконка + имя, крупно, над кольцом) */}
        {card && !result && (
          <div
            className="absolute left-1/2 flex flex-col items-center"
            style={{ top: -44, transform: 'translateX(-50%)', animation: 'qteCardIn 0.32s cubic-bezier(0.2, 1.4, 0.4, 1) both' }}
          >
            <div style={{ fontSize: 72, lineHeight: 1, filter: 'drop-shadow(0 0 18px rgba(251,191,36,0.55)) drop-shadow(0 6px 10px rgba(0,0,0,0.9))' }}>
              {card.icon}
            </div>
            <div
              className="mt-1 px-4 py-1 rounded-full font-black uppercase tracking-widest text-[13px] text-amber-300 bg-slate-950/85 border border-amber-500/50"
              style={{ textShadow: '0 0 12px rgba(251,191,36,0.6)', boxShadow: '0 0 20px rgba(251,191,36,0.25)' }}
            >
              {card.name}
            </div>
          </div>
        )}

        {!result && (
          <>
            {/* Зона GOOD: широкий тусклый пояс */}
            <Annulus outer={goodOuter} inner={goodInner} color="rgba(251,191,36,0.13)" />
            {/* Зона PERFECT: узкий яркий пояс */}
            <Annulus
              outer={perfOuter} inner={perfInner}
              color="rgba(251,191,36,0.4)"
              glow="0 0 18px rgba(251,191,36,0.25)"
            />
          </>
        )}

        {/* Мишень: статичное кольцо с пульсом-приглашением */}
        <div
          className="absolute rounded-full"
          style={{
            width: BASE, height: BASE,
            left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)',
            border: '2.5px solid rgba(251,191,36,0.9)',
            boxShadow: '0 0 20px rgba(251,191,36,0.5), inset 0 0 14px rgba(251,191,36,0.25)',
            animation: result ? 'none' : 'qteTargetPulse 0.9s ease-in-out infinite',
          }}
        />

        {/* Сужающееся кольцо: transform пишется напрямую из rAF-цикла */}
        {!result && (
          <div
            ref={ringRef}
            className="absolute rounded-full"
            style={{
              width: BASE, height: BASE,
              left: '50%', top: '50%',
              transform: `translate(-50%, -50%) scale(${RING_START_SCALE})`,
              border: '4px solid rgba(255,255,255,0.95)',
              boxShadow: '0 0 14px rgba(255,255,255,0.7)',
              willChange: 'transform',
            }}
          />
        )}

        {/* Вердикт: ударная волна + искры (perfect) + текст */}
        {result && (
          <>
            {result !== 'miss' && (
              <div
                className="absolute rounded-full"
                style={{
                  width: BASE, height: BASE,
                  left: '50%', top: '50%',
                  border: `5px solid ${style.color}`,
                  boxShadow: `0 0 40px ${style.glow}`,
                  animation: 'qteShockwave 0.55s cubic-bezier(0.1, 0.8, 0.3, 1) both',
                }}
              />
            )}
            {result === 'perfect' && Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: 7, height: 7,
                  left: '50%', top: '50%',
                  background: '#fde68a',
                  boxShadow: '0 0 10px rgba(251,191,36,0.9)',
                  '--qte-spark-angle': `${i * 45}deg`,
                  animation: 'qteSpark 0.6s ease-out both',
                }}
              />
            ))}
            <div
              className="absolute inset-0 flex items-center justify-center font-black uppercase tracking-tight"
              style={{
                color: style.color,
                fontSize: result === 'perfect' ? 42 : 32,
                textShadow: `0 0 20px ${style.glow}, 0 4px 8px rgba(0,0,0,0.9)`,
                animation: 'qtePop 0.38s cubic-bezier(0.2, 1.6, 0.4, 1) both',
              }}
            >
              {style.text}
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes qtePop { from { transform: scale(0.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes qteFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes qteCardIn { from { transform: translateX(-50%) translateY(18px) scale(0.6); opacity: 0; } to { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; } }
        @keyframes qteTargetPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(251,191,36,0.5), inset 0 0 14px rgba(251,191,36,0.25); }
          50% { box-shadow: 0 0 34px rgba(251,191,36,0.85), inset 0 0 20px rgba(251,191,36,0.4); }
        }
        @keyframes qteShockwave {
          from { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          to { transform: translate(-50%, -50%) scale(2.6); opacity: 0; }
        }
        @keyframes qteSpark {
          from { transform: translate(-50%, -50%) rotate(var(--qte-spark-angle)) translateX(60px); opacity: 1; }
          to { transform: translate(-50%, -50%) rotate(var(--qte-spark-angle)) translateX(170px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
