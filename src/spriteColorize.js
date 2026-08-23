export const HERO_COLORIZE = {
  p1: { hue: 196, sat: 32 },
  p2: { hue: 80, sat: 48 },
  p3: { hue: 286, sat: 34 },
};

// Незнакомец получает отдельный ржаво-красный тон — он не наследует цвет
// заменённого класса ни в бою, ни в таверне.
export const STRANGER_COLORIZE = { hue: 18, sat: 38 };

// Colorize без оверлея: sepia + hue-rotate + saturate на видимом кадре.
export const spriteColorizeFilter = (hue, sat = 0) => {
  const hueRotate = hue - 38;
  const saturate = Math.round(80 + sat * 2.8);
  return `sepia(1) saturate(${saturate}%) hue-rotate(${hueRotate}deg)`;
};
