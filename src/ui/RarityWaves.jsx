import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { getRarityWavesParams, subscribeRarityWavesParams } from './rarityWavesParams';

// Живой фон карточки: пиксельная лава-лампа цвета редкости.
//
// Слоя два. Нижний — сплошная заливка притушенной редкостью, она задаёт тон
// всей панели. Верхний — капли, тем же цветом в полную силу. На голой тёмной
// заливке панели капля читалась вяло: ей нужен свой фон, во что бить.
//
// Рисует не шейдер, а крошечный canvas в низком разрешении: одна точка сетки
// равна PIXEL пикселям макета, картинка растягивается с imageRendering
// pixelated. Поле под иконкой 326×198 при нынешнем шаге в 5 — это 68 на 42
// точки шестнадцать раз в секунду. Дешевле, чем держать WebGL-контекст на
// каждую из трёх карт, и ступенчатость получается сама собой, а не имитируется
// поверх сглаженного градиента.
//
// Поле считается как метаболы: каждая капля добавляет в точку величину, обратную
// квадрату расстояния, и вклады складываются. Отсюда и повадка лавы — капли
// тянутся друг к другу, сливаются в одну и снова расходятся, а срез поля по
// порогу даёт округлые замкнутые контуры. Плоские волны так не умеют: они дают
// полосы, а не комки.
//
// Границы нарочно резкие: значение режется на четыре ступени, между ними нет
// растяжки. Шум подмешан чуть-чуть и только чтобы кромка не выглядела
// вычислительно гладкой; много шума размыло бы контур в дизеринг.

// Числовые настройки — ступени заливки, пороги поля, скос метрики, темп и
// прочее — живут в src/ui/rarityWavesParams.js: их крутит дев-панель по F8.
// Здесь остаётся только то, что задаёт саму механику.

// Капли. Стартовые позиции — доли поля, радиус — доля меньшей стороны, поэтому
// картина одинакова в окне любого размера. Скорости и частоты качания взяты
// вразнобой: с общим шагом капли выстроились бы в правильную решётку и лампа
// превратилась бы в бегущий орнамент.
// Радиус — доля меньшей стороны поля до порога слияния; видимое тело капли
// примерно на пятую часть меньше. Таблица задаёт пропорции между каплями, общий
// размер тянет radiusScale из настроек. Покрытие к нему очень чувствительно:
// вклады пяти капель складываются, и при нынешнем множителе плотная лава держит
// около двух третей окна, пустым остаётся чуть больше десятой части.
const BLOBS = [
  { x: 0.18, y: 0.72, radius: 0.24, speed: 1.00, wobble: 0.31, sway: 0.16 },
  { x: 0.62, y: 0.88, radius: 0.18, speed: 1.35, wobble: 0.23, sway: 0.24 },
  { x: 0.84, y: 0.40, radius: 0.21, speed: 0.80, wobble: 0.17, sway: 0.20 },
  { x: 0.40, y: 0.24, radius: 0.14, speed: 1.55, wobble: 0.27, sway: 0.13 },
  { x: 0.05, y: 0.10, radius: 0.20, speed: 1.15, wobble: 0.21, sway: 0.27 },
];

const hexToRgb = (hex) => {
  const value = parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

const hashNoise = (index) => {
  const n = Math.sin(index * 12.9898) * 43758.5453;
  return n - Math.floor(n);
};

const wrap = (value, size) => ((value % size) + size) % size;

const RarityWaves = ({
  color,
  width,
  height,
  // Запас со всех сторон, внутри которого фон ездит от параллакса. Полотно
  // больше окна ровно на него, поэтому сдвиг не открывает пустую кромку.
  amplitude = 6,
  shiftX = 0,
  shiftY = 0,
  // Сдвиг фазы: с общим нулём три карты в руке шли бы кадр в кадр и читались
  // одной анимацией на всю руку.
  seed = 0,
  animated = true,
  style,
}) => {
  const canvasRef = useRef(null);
  const params = useSyncExternalStore(subscribeRarityWavesParams, getRarityWavesParams, getRarityWavesParams);
  const { pixel, fps, opacity, baseMix } = params;
  const cols = Math.ceil((width + amplitude * 2) / pixel);
  const rows = Math.ceil((height + amplitude * 2) / pixel);
  const noise = useMemo(() => Float32Array.from({ length: cols * rows }, (_, i) => hashNoise(i + 1)), [cols, rows]);
  const baseColor = useMemo(() => {
    const [r, g, b] = hexToRgb(color);
    return `rgb(${Math.round(r * baseMix)}, ${Math.round(g * baseMix)}, ${Math.round(b * baseMix)})`;
  }, [color, baseMix]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const image = context.createImageData(cols, rows);
    const pixels = image.data;
    const [r, g, b] = hexToRgb(color);
    const { shard, tempo, dither, radiusScale, swayScale, blobCount, driftAngle } = params;
    const levelAlpha = [0, params.alpha1, params.alpha2, params.alpha3];
    const levelEdge = [params.edge1, params.edge2, params.edge3];
    const blobs = BLOBS.slice(0, Math.max(1, Math.min(BLOBS.length, blobCount)));
    const angle = (driftAngle * Math.PI) / 180;
    const driftX = Math.cos(angle);
    const driftY = -Math.sin(angle);
    const frameMs = 1000 / fps;
    const halfCols = cols / 2;
    const halfRows = rows / 2;
    const unit = Math.min(cols, rows);
    const centerX = new Float32Array(blobs.length);
    const centerY = new Float32Array(blobs.length);
    const radiusSq = Float32Array.from(blobs, (blob) => (blob.radius * radiusScale * unit) ** 2);
    let raf = 0;
    let last = -Infinity;

    const draw = (ts) => {
      if (animated) raf = requestAnimationFrame(draw);
      if (ts - last < frameMs) return;
      last = ts;

      const time = ts / 1000;
      for (let k = 0; k < blobs.length; k += 1) {
        const blob = blobs[k];
        // Капли уезжают за край и возвращаются с противоположного: поле
        // замкнуто в тор, поэтому лампа не пустеет со временем.
        const drift = time * blob.speed * tempo;
        const wobble = time * blob.wobble * tempo;
        centerX[k] = wrap(
          blob.x * cols + drift * driftX + Math.sin(wobble + seed + k) * blob.sway * swayScale * cols,
          cols,
        );
        centerY[k] = wrap(
          blob.y * rows + drift * driftY + Math.cos(wobble * 0.8 + seed * 1.3 + k) * blob.sway * swayScale * rows,
          rows,
        );
      }

      let i = 0;
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          let field = 0;
          for (let k = 0; k < blobs.length; k += 1) {
            // Расстояние считается по кратчайшему пути вокруг тора, иначе на
            // шве капля разрывалась бы надвое.
            let dx = x - centerX[k];
            if (dx > halfCols) dx -= cols; else if (dx < -halfCols) dx += cols;
            let dy = y - centerY[k];
            if (dy > halfRows) dy -= rows; else if (dy < -halfRows) dy += rows;
            // Слагаемое со скосом растягивает расстояние по диагоналям: круг
            // превращается в ромб с острыми углами.
            const distSq = dx * dx + dy * dy + shard * Math.abs(dx * dy);
            // Квадрат обратного квадрата: вблизи капля плотная, вдали её вклад
            // гаснет быстро и пять капель не заливают поле целиком.
            const share = radiusSq[k] / (distSq + 1);
            field += share * share;
          }

          const value = field + (noise[i] - 0.5) * dither;
          const level = value > levelEdge[2] ? 3 : value > levelEdge[1] ? 2 : value > levelEdge[0] ? 1 : 0;
          const offset = i * 4;
          pixels[offset] = r;
          pixels[offset + 1] = g;
          pixels[offset + 2] = b;
          pixels[offset + 3] = levelAlpha[level] * 255;
          i += 1;
        }
      }
      context.putImageData(image, 0, 0);
    };

    if (animated) raf = requestAnimationFrame(draw);
    else draw(0);
    return () => cancelAnimationFrame(raf);
  }, [cols, rows, color, fps, noise, seed, params, animated]);

  return (
    <div
      className="pointer-events-none absolute overflow-hidden"
      style={{ width, height, opacity, backgroundColor: baseColor, ...style }}
    >
      <canvas
        ref={canvasRef}
        width={cols}
        height={rows}
        style={{
          position: 'absolute',
          left: -amplitude,
          top: -amplitude,
          width: cols * pixel,
          height: rows * pixel,
          // Без transition: сдвиг обязан идти кадр в кадр с наклоном карточки.
          transform: `translate3d(${shiftX}px, ${shiftY}px, 0)`,
          transition: 'none',
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
};

export default RarityWaves;
