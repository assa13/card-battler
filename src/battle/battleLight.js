import { computeSpriteLight } from '../lighting/lightModel.js';
import { BATTLE_LAYOUT } from './battleLayout.js';

const field = BATTLE_LAYOUT.fieldBackground;
// Figma 286:4870 / BG 286:4883: 84px markers at (226,69) and (1756,69).
// Coordinates are relative to the 2071x816 arena viewport, not the full artwork.
export const BATTLE_LIGHT_MARKERS = [
  { id: '523:5475', x: 268, y: 111 },
  { id: '523:5476', x: 1798, y: 111 },
];

export const BATTLE_LIGHT_SCENE = {
  ratio: field.width / field.height,
  ambient: 0.76,
  backgroundBrightness: 0.9,
  lightGain: 0.36 * 1.25,
  sourceGain: 1.25,
  ambientTint: { color: [110, 125, 190], strength: 0.18 },
  lights: BATTLE_LIGHT_MARKERS.map(({ id, x, y }, index) => ({
    id, x: x / field.width * 100, y: y / field.height * 100,
    radius: 82, intensity: 1,
    color: [255, 150, 77], coreColor: [255, 207, 140], flicker: 'naturalFire',
    flickerOffset: index * 1.37,
    // The supplied art already contains flame cores and warm tint. Keep just
    // one animated glow/floor layer per light instead of three arena-wide passes.
    env: { tint: 0, glow: 0.14 * 1.25, core: 0, floor: 0.09 * 1.25, floorOffsetX: 0, floorOffsetY: 28 },
  })),
};

export function computeBattleSpriteLight(unit, { flipX = false, dx = 0, dy = 0 } = {}) {
  return computeSpriteLight({
    x: (unit.x + unit.size * 0.5 + dx - field.x) / field.width * 100,
    y: (unit.y + unit.size * 0.55 + dy - field.y) / field.height * 100,
    flipX,
  }, BATTLE_LIGHT_SCENE);
}
