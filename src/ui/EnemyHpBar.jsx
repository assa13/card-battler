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
  const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
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
      className={`absolute left-1/2 -translate-x-1/2 z-[70] pointer-events-none transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
      style={{
        width,
        height,
        bottom,
        border: `${borderWidth}px solid transparent`,
        borderImage: `url('./assets/ui/kit/PB_empty.png') 17 38 fill / ${height * 17 / 38}px ${height}px stretch`,
      }}
    >
      {/* The border already reserves the padding. Additional scaled insets
          reduced the 4px/16px bars' fill to zero height. */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        {/* Preserve the delayed white damage trail beneath the kit's red fill. */}
        <div className="absolute inset-y-0 left-0 bg-white" style={{ width: `${ghostPct}%`, transition: 'width 0.45s ease-out' }} />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pct}% 0 0)`,
          background: "url('./assets/ui/kit/PB.png') center / 100% 100% no-repeat" }} />
      </div>
    </div>
  );
});

export default EnemyHpBar;
