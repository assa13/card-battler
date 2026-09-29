// Uneven flame motion with continuous velocity at the knots. Shared by CSS
// environment/sprite layers and Spine uniforms; no React updates per frame.
export const FIRE_DURATION = 3.73;
export const FIRE_STOPS = [
  [0, .96], [.055, .88], [.13, 1], [.205, .94], [.31, .86], [.37, .97],
  [.47, .91], [.585, 1], [.64, .93], [.745, .98], [.82, .87], [.925, .99], [1, .96],
];
export const NATURAL_FIRE_ANIMATION = `sceneNaturalFire ${FIRE_DURATION}s cubic-bezier(.333333,0,.666667,1) infinite`;
export const NATURAL_FIRE_KEYFRAMES = `@keyframes sceneNaturalFire { ${FIRE_STOPS
  .map(([at, value]) => `${at * 100}% { opacity: ${value}; }`).join(' ')} }`;

export function naturalFireAt(time, offset = 0) {
  const phase = (((time + offset) % FIRE_DURATION) + FIRE_DURATION) % FIRE_DURATION / FIRE_DURATION;
  const end = FIRE_STOPS.findIndex(([at]) => at > phase);
  const [a, v0] = FIRE_STOPS[end - 1];
  const [b, v1] = FIRE_STOPS[end];
  const t = (phase - a) / (b - a);
  return v0 + (v1 - v0) * t * t * (3 - 2 * t);
}
