import { useEffect, useState } from 'react';
import { computeStageRect } from '../screenScale';

/**
 * Сцена в экранных пикселях плюс переводы координат холста 3200×1800 туда и
 * обратно.
 *
 * Адрес для всего, что рисуется ВНЕ ScreenStage, но обязано жить по её
 * правилам: полноэкранные эффекты, QTE, оверлеи поверх сцены. Такое проектируют
 * в координатах холста — иначе геометрия и тайминги начинают зависеть от
 * размера окна, — а в экранные пиксели переводят только на отрисовке, каждый
 * кадр от текущего размера окна. Тогда при ресайзе эффект едет вместе со
 * сценой, а его внутренняя математика не сдвигается ни на пиксель.
 */
const readSpace = () => {
  const rect = computeStageRect(window.innerWidth, window.innerHeight);
  return {
    ...rect,
    /** Пиксель холста → экранный: по горизонтали, по вертикали и просто длина. */
    x: (value) => rect.left + value * rect.scale,
    y: (value) => rect.top + value * rect.scale,
    size: (value) => value * rect.scale,
    /** Экранный пиксель → холст. Нужен на входе: DOM меряется в экранных. */
    canvasX: (value) => (value - rect.left) / rect.scale,
    canvasY: (value) => (value - rect.top) / rect.scale,
    canvasSize: (value) => value / rect.scale,
  };
};

const useStageSpace = () => {
  const [space, setSpace] = useState(readSpace);

  useEffect(() => {
    const measure = () => setSpace(readSpace());
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  return space;
};

export default useStageSpace;
