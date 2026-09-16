export const DEFAULT_PIXEL_GRID = Object.freeze({ size: 2, strength: 25, offsetX: 0, offsetY: 0 });
export const PIXEL_GRID_STORAGE_KEY = 'card-battler:pixel-grid:v1';

const bounded = (value, fallback, min, max) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
};

export function normalizePixelGrid(value = {}) {
  if (!value || typeof value !== 'object') value = {};
  return {
    size: bounded(value.size ?? DEFAULT_PIXEL_GRID.size, DEFAULT_PIXEL_GRID.size, 1, 4),
    strength: bounded(value.strength ?? DEFAULT_PIXEL_GRID.strength, DEFAULT_PIXEL_GRID.strength, 0, 100),
    offsetX: bounded(value.offsetX ?? 0, 0, -64, 64),
    offsetY: bounded(value.offsetY ?? 0, 0, -64, 64),
  };
}

// One cell samples one actual source pixel, never the boundary between pixels.
export function gridSampleCoordinate(position, size, offset = 0) {
  return Math.floor((position - offset) / size) * size + offset + Math.floor(size / 2) + 0.5;
}

export const PIXEL_GRID_VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = (a_position + 1.0) * 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

// Encode a displacement lookup for the browser compositor. An 8-pixel range
// keeps RGBA8 rounding below 0.016 px, safely inside nearest-neighbour samples.
export const PIXEL_GRID_DISPLACEMENT_SCALE = 8;
export const PIXEL_GRID_FRAGMENT_SHADER = `
precision highp float;
uniform vec2 u_resolution;
uniform float u_gridSize;
uniform vec2 u_gridOffset;
void main() {
  vec2 position = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
  vec2 cell = floor((position - u_gridOffset) / u_gridSize) * u_gridSize + u_gridOffset;
  vec2 samplePoint = clamp(cell + floor(u_gridSize * 0.5) + 0.5, vec2(0.5), u_resolution - 0.5);
  gl_FragColor = vec4(0.5 + (samplePoint - position) / 8.0, 0.0, 1.0);
}`;
