import { useEffect, useState } from 'react';
import { computeStageScale } from '../screenScale';

/**
 * Текущий масштаб сцены: во сколько раз пиксель холста 3200×1800 меньше пикселя
 * экрана. Нужен всему, что приходит в сцену в экранных координатах.
 *
 * Такое приходит от старого боевого кода: векторы прыжков считаются через
 * `getBoundingClientRect`, то есть уже в пикселях экрана, а применяются внутри
 * `StageBox`, где всё ужато этим же множителем. Без деления на него прыжок
 * выходит короче нужного ровно во столько же раз.
 */
const useStageScale = () => {
  const [scale, setScale] = useState(() => computeStageScale(window.innerWidth, window.innerHeight));

  useEffect(() => {
    const measure = () => setScale(computeStageScale(window.innerWidth, window.innerHeight));
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  return scale;
};

export default useStageScale;
