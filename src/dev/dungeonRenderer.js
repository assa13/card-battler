import { TILE, SOURCE_TILE, ATLAS_COLUMNS, ATLAS_ROWS, BACKGROUND, SPRITES } from './dungeonTestMap.js';
import { COLS, ROWS } from './dungeonGenerator.js';

export const WIDTH = COLS * TILE;
export const HEIGHT = ROWS * TILE;

export const createDungeonRenderer = (ctx, atlas, level, entityImages) => {
  if (atlas.naturalWidth !== ATLAS_COLUMNS * SOURCE_TILE || atlas.naturalHeight !== ATLAS_ROWS * SOURCE_TILE) {
    throw new Error('Unexpected Figma atlas dimensions');
  }
  return ({ showGrid = false } = {}) => {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    level.tiles.forEach((row, y) => row.forEach((name, x) => {
      if (name === '.') return;
      const [column, line] = SPRITES[name];
      ctx.drawImage(atlas,
        column * SOURCE_TILE, line * SOURCE_TILE, SOURCE_TILE, SOURCE_TILE,
        x * TILE, y * TILE, TILE, TILE);
    }));
    // Transparent author-supplied PNGs keep their proportions inside square cells.
    [...level.entities].sort((a, b) => a.y - b.y || a.x - b.x).forEach(entity => {
      const image = entityImages[entity.sprite];
      const scale = TILE / Math.max(image.naturalWidth, image.naturalHeight);
      const width = Math.round(image.naturalWidth * scale);
      const height = Math.round(image.naturalHeight * scale);
      ctx.drawImage(image, entity.x * TILE + Math.floor((TILE - width) / 2),
        (entity.y + 1) * TILE - height, width, height);
    });
    level.portals.forEach(portal => {
      const entrance = portal.kind === 'entrance';
      ctx.fillStyle = entrance ? '#91d8ee' : '#e3bd78';
      ctx.fillRect(portal.x * TILE + 10, portal.y * TILE + 21, TILE - 20, 2);
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(entrance ? 'ВХОД' : 'ВЫХОД', (portal.x + 0.5) * TILE, HEIGHT - 1);
    });
    if (showGrid) {
      ctx.fillStyle = '#d8e8ec55';
      for (let x = 0; x < WIDTH; x += TILE) ctx.fillRect(x, 0, 1, HEIGHT);
      for (let y = 0; y < HEIGHT; y += TILE) ctx.fillRect(0, y, WIDTH, 1);
      ctx.fillRect(WIDTH - 1, 0, 1, HEIGHT);
      ctx.fillRect(0, HEIGHT - 1, WIDTH, 1);
    }
  };
};

