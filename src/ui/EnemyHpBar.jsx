import React, { useEffect, useRef, useState } from 'react';

/**
 * Мини HP-бар врага: прямоугольный, скрыт по умолчанию, всплывает при получении
 * урона и плавно исчезает. Двухслойная анимация: белый «откушенный» кусок
 * сужается до текущего HP.
 *
 * Геометрия задаётся снаружи, потому что бар живёт на двух экранах сразу.
 * Умолчания — размеры старой вёрстки в экранных пикселях; боевой холст передаёт
 * свои, вчетверо крупнее, и рисует бар в пикселях сцены — там спрайт врага во
 * столько же больше, и бар экранного размера рядом с ним теряется.
 */
const EnemyHpBar = React.memo(({ hp, maxHp, width = 32, height = 4, bottom = -4, borderWidth = 1 }) => {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const [visible, setVisible] = useState(false);
  const [ghostPct, setGhostPct] = useState(pct);
  const prevHpRef = useRef(hp);
  const hideTimerRef = useRef(null);

  useEffect(() => {
    const prev = prevHpRef.current;
    prevHpRef.current = hp;
    if (hp < prev) {
      // Урон: показать бар, белый «призрак» = прежняя ширина, затем сузить до текущего HP
      setVisible(true);
      setGhostPct(Math.max(0, Math.min(100, (prev / maxHp) * 100)));
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setGhostPct(pct)));
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setVisible(false), 1000);
      return () => cancelAnimationFrame(raf);
    } else {
      // Лечение/сброс — без всплытия, просто синхронизируем
      setGhostPct(pct);
    }
  }, [hp, maxHp, pct]);

  useEffect(() => () => clearTimeout(hideTimerRef.current), []);

  return (
    <div
      className={`absolute left-1/2 -translate-x-1/2 bg-slate-950/80 z-[70] pointer-events-none overflow-hidden transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
      style={{
        width,
        height,
        bottom,
        border: `${borderWidth}px solid rgba(0,0,0,0.6)`,
      }}
    >
      {/* Белый «откушенный» кусок (под красным): сужается от прежнего значения к текущему */}
      <div className="absolute inset-y-0 left-0 bg-white" style={{ width: `${ghostPct}%`, transition: 'width 0.45s ease-out' }} />
      {/* Реальное HP поверх — красный, меняется мгновенно */}
      <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-700 to-red-500" style={{ width: `${pct}%` }} />
    </div>
  );
});

export default EnemyHpBar;
