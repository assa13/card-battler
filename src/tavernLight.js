import { TAVERN_FIREPLACE, TAVERN_STAGE_RATIO } from './TavernSceneConfig';
import { computeSpriteLight } from './lighting/lightModel';

// Сцена освещения Таверны (формат — см. lighting/lightModel.js).
// Единственный источник — камин; ночь отличается только эмбиентом.

const FLAME_Y = TAVERN_FIREPLACE.top - 4; // визуальный центр пламени выше центра спрайта

const FIREPLACE_LIGHT = {
  x: TAVERN_FIREPLACE.left,
  y: FLAME_Y,
  radius: 120, // на этом расстоянии (% высоты сцены) свет камина гаснет полностью
  color: [255, 130, 45],
  coreColor: [255, 190, 120],
  intensity: 1,
  flicker: 'fire',
  env: { tint: 0.28, glow: 0.18, core: 0.28, floor: 0.11 },
};

export const TAVERN_LIGHT_DAY = {
  ratio: TAVERN_STAGE_RATIO,
  ambient: 0.8,
  lightGain: 0.3,
  ambientTint: { color: [110, 125, 190], strength: 0.18 },
  vignette: { strength: 0.6, start: 0.5, edge: 0.85, band: 9 },
  shade: { color: [157, 153, 176] },
  lights: [FIREPLACE_LIGHT],
};

const TAVERN_LIGHT_NIGHT = {
  ...TAVERN_LIGHT_DAY,
  ambient: 0.5,
  ambientTint: { color: [90, 110, 190], strength: 0.55 },
};

// entity.pos — строки вида '41.05%'. null — свет камина сущности не касается
// (фон, огонь, порталы, lit: false).
export function computeTavernSpriteLight(entity, isNight) {
  if (entity.lit === false || entity.type === 'BG' || entity.type === 'PORTAL') return null;
  return computeSpriteLight(
    { x: parseFloat(entity.pos.left), y: parseFloat(entity.pos.top), flipX: entity.flipX },
    isNight ? TAVERN_LIGHT_NIGHT : TAVERN_LIGHT_DAY,
  );
}
