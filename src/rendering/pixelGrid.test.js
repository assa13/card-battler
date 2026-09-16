import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PIXEL_GRID, gridSampleCoordinate, normalizePixelGrid, PIXEL_GRID_DISPLACEMENT_SCALE } from './pixelGrid.js';

test('grid controls retain safe defaults and constrain persisted values', () => {
  for (const input of [undefined, null, '', {}, []]) assert.deepEqual(normalizePixelGrid(input), DEFAULT_PIXEL_GRID);
  assert.deepEqual(normalizePixelGrid({ size: 12, strength: -1, offsetX: -200, offsetY: '3' }),
    { size: 4, strength: 0, offsetX: -64, offsetY: 3 });
  assert.equal(normalizePixelGrid({ strength: Infinity }).strength, 25);
});

test('every pixel in a cell samples one exact source pixel for sizes 1 through 4', () => {
  for (const size of [1, 2, 3, 4]) {
    for (let offset = -5; offset <= 5; offset++) {
      for (let cell = -4; cell <= 4; cell++) {
        const samples = Array.from({ length: size }, (_, pixel) =>
          gridSampleCoordinate(cell * size + offset + pixel + 0.5, size, offset));
        assert.equal(new Set(samples).size, 1);
        assert.equal(samples[0] % 1 === 0.5 || samples[0] % 1 === -0.5, true);
      }
    }
  }
});

test('size one is identity and moving the grid by one period is equivalent', () => {
  for (let pixel = -12; pixel <= 12; pixel++) {
    assert.equal(gridSampleCoordinate(pixel + 0.5, 1, 3), pixel + 0.5);
    for (const size of [2, 3, 4]) {
      assert.equal(gridSampleCoordinate(pixel + 0.5, size, -2), gridSampleCoordinate(pixel + 0.5, size, -2 + size));
    }
  }
});

test('RGBA8 displacement preserves exact nearest samples, including partial edge cells', () => {
  const scale = PIXEL_GRID_DISPLACEMENT_SCALE;
  for (const width of [1, 2, 3, 7, 18, 703]) {
    for (const size of [2, 3, 4]) {
      for (const offset of [-64, -3, 0, 1, 64]) {
        for (let pixel = 0; pixel < width; pixel++) {
          const position = pixel + 0.5;
          const target = Math.max(0.5, Math.min(width - 0.5, gridSampleCoordinate(position, size, offset)));
          const byte = Math.round((0.5 + (target - position) / scale) * 255);
          const decoded = position + scale * (byte / 255 - 0.5);
          assert.equal(Math.floor(decoded), Math.floor(target));
          assert.ok(decoded >= 0 && decoded < width);
        }
      }
    }
  }
});
