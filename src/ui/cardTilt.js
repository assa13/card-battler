import { createContext, useMemo, useState } from 'react';

// Наклон слота, который TiltWrapper раздаёт своему содержимому: внутренние слои
// карты доворачиваются на эти же углы и дают параллакс.
export const CardTiltContext = createContext({ x: 0, y: 0, isHovered: false });

/**
 * Состояние наклона отдельно от разметки.
 *
 * Обычно мышь ловит сам TiltWrapper, но на боевом холсте слот лежит внутри
 * 3D-контекста (perspective + preserve-3d) и вдобавок под общим transform:
 * scale() сцены. Попадание мыши в такой поддереве считается ненадёжно — на
 * практике слот отзывался только на текст и на нижнюю кромку. Поэтому там мышь
 * ловит плоский слой поверх слота, а углы наклона приходят сюда.
 *
 * rect берётся у элемента, на котором висят обработчики, — он и задаёт систему
 * координат наклона.
 */
// Максимальный угол наклона в градусах по каждой оси. На старом экране было 16,
// но карточка на холсте крупнее и тот же угол читался слишком размашисто.
const MAX_TILT_DEG = 12;

export const useCardTilt = (isDisabled) => {
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handlers = useMemo(() => ({
    onMouseMove: (event) => {
      if (isDisabled) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      setRotation({
        x: ((centerY - y) / centerY) * MAX_TILT_DEG,
        y: ((x - centerX) / centerX) * MAX_TILT_DEG,
      });
      setGlare({ x: (x / rect.width) * 100, y: (y / rect.height) * 100, opacity: 0.18 });
    },
    onMouseEnter: () => { if (!isDisabled) setIsHovered(true); },
    onMouseLeave: () => {
      setIsHovered(false);
      setRotation({ x: 0, y: 0 });
      setGlare((prev) => ({ ...prev, opacity: 0 }));
    },
  }), [isDisabled]);

  return { tilt: { rotation, glare, isHovered }, tiltHandlers: handlers };
};
