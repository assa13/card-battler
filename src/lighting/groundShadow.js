// Shared with the tavern: a soft contact ellipse projected away from the key light.
export const CHARACTER_SHADOW = { top: 0.87, width: 0.42, height: 0.08 };
export const GROUND_SHADOW_STOPS = [[0, 0.55], [0.55, 0.3], [1, 0]];
export const GROUND_SHADOW_BACKGROUND = `radial-gradient(ellipse closest-side, ${GROUND_SHADOW_STOPS.map(([at, alpha]) => `rgba(0,0,0,${alpha}) ${at * 100}%`).join(', ')})`;

export function characterShadowBox(unit, light, shape = CHARACTER_SHADOW) {
  return {
    x: unit.x + unit.size * (0.5 + (light?.shadowShift ?? 0)),
    y: unit.y + unit.size * shape.top,
    width: unit.size * shape.width * (light?.shadowStretch ?? 1),
    height: unit.size * shape.height,
  };
}
