// Механика «Руна защиты»: прямой отрезок, который игрок сам прочерчивает
// маркером, зажав кнопку мыши.
//
// ТЕМП ЗАДАЁТ ИГРОК, А НЕ ИГРА. Никакого бегунка по расписанию: подготовка
// босса — это дедлайн, а не метроном. Успел довести маркер до конца — защита
// сработала, не успел — получаешь удар. Внутри окна веди как хочешь.
//
// МАРКЕР НА РЕЛЬСЕ. Сойти с линии нельзя: в прогресс идёт только составляющая
// движения вдоль неё, поперёк маркер упирается. Поэтому наказывать за срыв
// нечем и не нужно — работа игрока в том, чтобы толкнуть маркер по нужной оси
// на всю длину, пока босс замирает.
//
// ДВА ИНВАРИАНТА:
//  1. Длина фиксирована на звено серии — сложность не должна зависеть от того,
//     какой отрезок выпал.
//  2. Отрезок вписывается в безопасный прямоугольник (без карт, полос HP и
//     краёв) — подбирается поворотом целиком, а не обрезкой.

export const RUNE_TRACE = Object.freeze({
  // Длина пути в пикселях при высоте экрана 1080; масштабируется под сцену.
  targetLengthPx: 560,
  // Толщина линии: руна — крупный объект на арене, а не тонкий UI-штрих.
  trackWidthPx: 36,
  inkWidthPx: 28,
  flashWidthPx: 44,
  // Маркер игрока крупнее линии, иначе теряется в её толщине.
  penRadiusPx: 15,
  // Кольцо старта и зона конечной точки.
  startRadiusPx: 48,
  endRadiusPx: 62,
  // Максимальный шаг по рельсе за одно событие мыши: телепорт указателя через
  // половину руны не должен считаться прочерченной линией.
  maxJumpPx: 120,
  // Доля линии, с которой руна считается начерченной: до пикселя доводить не
  // заставляем, конечная точка и так крупная.
  completeRatio: 0.97,
  // Сколько линия горит красным после сброса (отпустил кнопку на полпути).
  strayFlashMs: 260,
});

const toRad = (deg) => (deg * Math.PI) / 180;

/** Отрезок заданной длины под случайным углом, начало в (0,0). */
export const generateRuneShape = ({ lengthPx = RUNE_TRACE.targetLengthPx } = {}) => {
  const angle = toRad(Math.random() * 360);
  return [
    { x: 0, y: 0 },
    { x: Math.cos(angle) * lengthPx, y: Math.sin(angle) * lengthPx },
  ];
};

export const rotateRuneShape = (points, deg) => {
  const cos = Math.cos(toRad(deg));
  const sin = Math.sin(toRad(deg));
  return points.map(point => ({
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  }));
};

const boundsOf = (points) => {
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  };
};

const overflowOf = (points, anchor, safeRect) => {
  const box = boundsOf(points);
  return Math.max(0, safeRect.left - (anchor.x + box.left))
    + Math.max(0, (anchor.x + box.right) - safeRect.right)
    + Math.max(0, safeRect.top - (anchor.y + box.top))
    + Math.max(0, (anchor.y + box.bottom) - safeRect.bottom);
};

/**
 * Поворачиваем руну целиком так, чтобы она уместилась в свободной зоне от
 * позиции героя. Перебор восьми поворотов дешевле любой умной геометрии;
 * если не влезает ни один, берём наименее вылезающий и доводим сдвигом.
 */
export const fitRuneShape = ({ points, anchor, safeRect }) => {
  let best = { points, overflow: Infinity };
  for (let deg = 0; deg < 360; deg += 45) {
    const rotated = rotateRuneShape(points, deg);
    const overflow = overflowOf(rotated, anchor, safeRect);
    if (overflow < best.overflow) best = { points: rotated, overflow };
    if (overflow === 0) break;
  }

  const box = boundsOf(best.points);
  const shift = { x: 0, y: 0 };
  if (anchor.x + box.left < safeRect.left) shift.x = safeRect.left - (anchor.x + box.left);
  if (anchor.x + box.right > safeRect.right) shift.x = safeRect.right - (anchor.x + box.right);
  if (anchor.y + box.top < safeRect.top) shift.y = safeRect.top - (anchor.y + box.top);
  if (anchor.y + box.bottom > safeRect.bottom) shift.y = safeRect.bottom - (anchor.y + box.bottom);

  return best.points.map(point => ({
    x: anchor.x + point.x + shift.x,
    y: anchor.y + point.y + shift.y,
  }));
};

export const buildRunePath = (points) => {
  if (points.length < 2) return '';
  const from = points[0];
  const to = points[points.length - 1];
  return `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} L ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
};

/** Длина отрезка по номеру звена серии: чем дальше, тем длиннее проход. */
export const runeLengthForStep = (index) => (
  RUNE_TRACE.targetLengthPx * (index <= 0 ? 1 : index === 1 ? 1.15 : 1.3)
);
