import { TILE, SOURCE_TILE, ATLAS_COLUMNS, ATLAS_ROWS, BACKGROUND, SPRITES, LEVEL, COLS, ROWS } from './dungeonTestMap.js';

export const WIDTH = COLS * TILE;
export const HEIGHT = ROWS * TILE;

export const createDungeonRenderer = (ctx, atlas, level = LEVEL) => {
  if (atlas.naturalWidth !== ATLAS_COLUMNS * SOURCE_TILE || atlas.naturalHeight !== ATLAS_ROWS * SOURCE_TILE) {
    throw new Error('Unexpected Figma atlas dimensions');
  }
  return ({ showGrid = false } = {}) => {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    level.forEach((row, y) => row.forEach((name, x) => {
      if (name === '.') return;
      const [column, line] = SPRITES[name];
      ctx.drawImage(atlas,
        column * SOURCE_TILE, line * SOURCE_TILE, SOURCE_TILE, SOURCE_TILE,
        x * TILE, y * TILE, TILE, TILE);
    }));
    if (showGrid) {
      ctx.fillStyle = '#d8e8ec55';
      for (let x = 0; x < WIDTH; x += TILE) ctx.fillRect(x, 0, 1, HEIGHT);
      for (let y = 0; y < HEIGHT; y += TILE) ctx.fillRect(0, y, WIDTH, 1);
      ctx.fillRect(WIDTH - 1, 0, 1, HEIGHT);
      ctx.fillRect(0, HEIGHT - 1, WIDTH, 1);
    }
  };
};

