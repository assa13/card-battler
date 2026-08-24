import { useLayoutEffect, useRef, useState } from 'react';
import { BASE_HEIGHT, BASE_WIDTH } from '../screenScale';

// Кладёт вёрстку фиксированного размера на холст 3200×1800.
//
// ScreenStage не накладывает transform, а задаёт контейнеру высоту в CSS, и
// содержимое сцены живёт в процентах от него. Поэтому пиксели внутри сцены сами
// по себе не масштабируются: виджет, свёрстанный в абсолютных координатах
// макета, остался бы одного размера на любом экране.
//
// Внешний бокс здесь живёт в процентах холста, а содержимое ужимается одним
// transform: scale(). Так виджет уменьшается целиком — вместе с кеглем шрифта и
// границами 9-slice. Если вместо этого менять размер бокса, границы остались бы
// в родных пикселях атласа и растянулся бы только центр: у мелкой карточки были
// бы уголки исходного размера.
//
// x, y, width, height — координаты макета в пикселях холста.
const StageBox = ({ x, y, width, height, zIndex, className = '', style, children }) => {
  const ref = useRef(null);
  const [scale, setScale] = useState(null);

  useLayoutEffect(() => {
    const node = ref.current;
    const measure = () => setScale(node.clientWidth / width);

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        position: 'absolute',
        left: `${(x / BASE_WIDTH) * 100}%`,
        top: `${(y / BASE_HEIGHT) * 100}%`,
        width: `${(width / BASE_WIDTH) * 100}%`,
        height: `${(height / BASE_HEIGHT) * 100}%`,
        zIndex,
        ...style,
      }}
      data-stage-box=""
    >
      {/* До первого замера содержимое не рисуется: иначе кадр уйдёт в
          неотмасштабированном размере. useLayoutEffect успевает до отрисовки. */}
      {scale != null && (
        <div style={{ width, height, transformOrigin: 'top left', transform: `scale(${scale})` }}>
          {children}
        </div>
      )}
    </div>
  );
};

export default StageBox;
