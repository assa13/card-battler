// Модель 2D-освещения сцены (таверна и бой). Чистая математика,
// без React. Координаты — % сцены (x — от ширины, y — от высоты); расстояния —
// в % ВЫСОТЫ: горизонталь домножается на scene.ratio, чтобы круг света
// не сплющивался по ширине.
//
// Описание сцены:
// {
//   ratio,                          // aspect сцены (ширина/высота)
//   ambient, lightGain,             // яркость спрайта: ambient + lightGain × свет
//   ambientTint: { color, strength } // холодный тон в тени (гаснет у источников)
//   vignette: { strength, start, edge, band },
//   shade: { color, strength }      // multiply-затенение окружения от главного света
//   lights: [{
//     x, y, radius,                 // центр и радиус затухания
//     color, coreColor,             // [r,g,b]; coreColor — ядро источника в окружении
//     intensity, flicker,           // flicker — ключ из FLICKER
//     env: { tint, glow, core, floor }, // альфы слоёв окружения (0 — слоя нет)
//   }],
// }

// Анимации мерцания: keyframes объявляет SceneLighting. Спрайты используют
// те же имена — монтируются в один коммит с окружением и мерцают в такт.
import { NATURAL_FIRE_ANIMATION } from './fireFlicker.js';

export const FLICKER = {
  naturalFire: NATURAL_FIRE_ANIMATION,
  fire: 'sceneLightFlicker 2.3s steps(1, end) infinite',
  fireCore: 'sceneLightCore 1.7s steps(1, end) infinite',
};

export const lightAnimation = light => light.flicker
  ? `${FLICKER[light.flicker]}${light.flickerOffset ? ` -${light.flickerOffset}s` : ''}` : undefined;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smoothstep = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const fx = (n) => n.toFixed(3);
export const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${fx(a)})`;

// Затемнение виньетки в точке (0…1): радиальная часть + полосы по краям кадра.
// band — ширина полосы в % высоты; по горизонтали пересчитывается через ratio.
export function vignetteAt(x, y, scene) {
  const v = scene.vignette;
  if (!v) return 0;
  const r = Math.hypot((x - 50) / 50, (y - 50) / 50) / Math.SQRT2;
  const radial = v.strength * smoothstep(v.start, 1, r);
  const bandX = v.band / scene.ratio;
  const edgeX = 1 - smoothstep(0, bandX, Math.min(x, 100 - x));
  const edgeY = 1 - smoothstep(0, v.band, Math.min(y, 100 - y));
  const edge = v.edge * Math.max(edgeX, edgeY);
  return 1 - (1 - radial) * (1 - edge);
}

// Свет на спрайт. Возвращает { filter, layers, gpu, shadowShift, shadowStretch };
// layers рисует SpriteLightLayers поверх спрайта, обрезая альфой кадра:
//   { blend, background, animation? }.
export function computeSpriteLight({ x, y, flipX }, scene) {
  let best = null;
  let total = 0;
  for (const L of scene.lights) {
    const dx = (x - L.x) * scene.ratio;
    const dy = y - L.y;
    const k = clamp01(1 - Math.hypot(dx, dy) / L.radius) * (L.intensity ?? 1);
    total += k;
    if (!best || k > best.k) best = { L, k, dx, dy };
  }
  const k = Math.min(1, total);
  // Слои живут внутри сущности с scaleX(-1) — горизонталь зеркалим обратно.
  const mirror = flipX ? -1 : 1;
  const vig = vignetteAt(x, y, scene);

  const layers = [];
  if (best && best.k > 0.02) {
    const { L, dx, dy } = best;
    const kl = best.k;
    const animation = lightAnimation(L);
    const sourceGain = scene.sourceGain ?? 1;
    // Луч от света к спрайту (CSS-угол: 0deg — вверх, 90deg — вправо):
    // начало градиента (0%) — сторона, обращённая к источнику.
    const angle = (Math.atan2(dx * mirror, -dy) * 180) / Math.PI;
    layers.push({ blend: 'overlay', background: rgba(L.color, 0.35 * kl * sourceGain), animation });
    layers.push({
      blend: 'screen',
      background: `linear-gradient(${fx(angle)}deg, ${rgba(L.color, 0.45 * kl ** 1.5 * sourceGain)} 0%, ${rgba(L.color, 0)} 55%)`,
      animation,
    });
  }
  const tint = scene.ambientTint;
  const cool = tint ? tint.strength * (1 - k) : 0;
  if (cool > 0.02) layers.push({ blend: 'multiply', background: rgba(tint.color, cool) });
  const brightness = (scene.ambient + scene.lightGain * k) * (1 - vig);
  const saturation = 0.8 + 0.2 * k;
  const distance = best ? Math.hypot(best.dx, best.dy) : 0;

  return {
    filter: `brightness(${fx(brightness)}) saturate(${fx(saturation)})`,
    layers,
    // Numeric equivalent for alpha-preserving lighting of live WebGL/Spine frames.
    gpu: {
      brightness, saturation,
      ambientColor: (tint?.color || [255, 255, 255]).map(channel => channel / 255),
      ambientStrength: cool,
      lightColor: (best?.L.color || [255, 255, 255]).map(channel => channel / 255),
      lightStrength: best?.k || 0,
      sourceGain: scene.sourceGain ?? 1,
      direction: distance ? [best.dx * mirror / distance, best.dy / distance] : [0, 1],
      flicker: best?.L.flicker || false,
      flickerOffset: best?.L.flickerOffset || 0,
    },
    // Тень отбрасывается от главного света: смещение (доля ширины бокса) и вытягивание.
    shadowShift: best ? Math.sign(best.dx) * 0.06 * k : 0,
    shadowStretch: 1 + 0.4 * k,
  };
}
