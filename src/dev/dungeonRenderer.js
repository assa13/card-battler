import { TILE, SOURCE_TILE, ATLAS_COLUMNS, ATLAS_ROWS, BACKGROUND, SPRITES } from './dungeonTestMap.js';
import { COLS, ROWS } from './dungeonGenerator.js';
import { drawDungeonLighting, torchFlicker } from './dungeonLighting.js';

export const WIDTH = COLS * TILE;
export const HEIGHT = ROWS * TILE;
export const RENDER_WIDTH = COLS * SOURCE_TILE;
export const RENDER_HEIGHT = ROWS * SOURCE_TILE;

const outlines = new WeakMap();
const OUTLINE_PAD = 3;
function getOutline(image) {
  if (outlines.has(image)) return outlines.get(image);
  const mask = document.createElement('canvas');
  mask.width = image.naturalWidth;
  mask.height = image.naturalHeight;
  const maskCtx = mask.getContext('2d');
  maskCtx.drawImage(image, 0, 0);
  maskCtx.globalCompositeOperation = 'source-in';
  maskCtx.fillStyle = '#ffda45';
  maskCtx.fillRect(0, 0, mask.width, mask.height);
  const outline = document.createElement('canvas');
  outline.width = mask.width + OUTLINE_PAD * 2;
  outline.height = mask.height + OUTLINE_PAD * 2;
  const outlineCtx = outline.getContext('2d');
  for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3], [-2, -2], [2, -2], [-2, 2], [2, 2]]) {
    outlineCtx.drawImage(mask, OUTLINE_PAD + dx, OUTLINE_PAD + dy);
  }
  outlineCtx.globalCompositeOperation = 'destination-out';
  outlineCtx.drawImage(image, OUTLINE_PAD, OUTLINE_PAD);
  outlines.set(image, outline);
  return outline;
}

export const createDungeonRenderer = (ctx, atlas, level, entityImages) => {
  if (atlas.naturalWidth !== ATLAS_COLUMNS * SOURCE_TILE || atlas.naturalHeight !== ATLAS_ROWS * SOURCE_TILE) {
    throw new Error('Unexpected Figma atlas dimensions');
  }
  return ({ showGrid = false, time = null, highlightedIds = new Set() } = {}) => {
    // Retain source-resolution detail; CSS controls the compact display size.
    ctx.setTransform(ctx.canvas.width / WIDTH, 0, 0, ctx.canvas.height / HEIGHT, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    level.tiles.forEach((row, y) => row.forEach((name, x) => {
      if (name === '.') return;
      if (name === 'partition') {
        // Join the two stone-facing halves; their exterior purple halves must
        // never appear inside a room. The logical tile stays square and solid.
        for (const [sprite, offset] of [['wallE', 0], ['wallW', 0.5]]) {
          const [column, line] = SPRITES[sprite];
          ctx.drawImage(atlas, (column + offset) * SOURCE_TILE, line * SOURCE_TILE,
            SOURCE_TILE / 2, SOURCE_TILE, (x + offset) * TILE, y * TILE, TILE / 2, TILE);
        }
        return;
      }
      const [column, line] = SPRITES[name];
      ctx.drawImage(atlas,
        column * SOURCE_TILE, line * SOURCE_TILE, SOURCE_TILE, SOURCE_TILE,
        x * TILE, y * TILE, TILE, TILE);
    }));
    // Transparent author-supplied PNGs keep their proportions inside square cells.
    [...level.entities].sort((a, b) => a.y - b.y || a.x - b.x).forEach(entity => {
      if (level.lights.some(light => light.entityId === entity.id)) return;
      const image = entityImages[entity.sprite];
      const scale = TILE / Math.max(image.naturalWidth, image.naturalHeight);
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      ctx.drawImage(image, entity.x * TILE + (TILE - width) / 2,
        (entity.y + 1) * TILE - height, width, height);
    });
    drawDungeonLighting(ctx, level, TILE, time);
    // Outline the actual transparent silhouette, after lighting so yellow stays clear.
    level.entities.filter(entity => highlightedIds.has(entity.id)).forEach(entity => {
      const image = entityImages[entity.sprite];
      const scale = TILE / Math.max(image.naturalWidth, image.naturalHeight);
      const outline = getOutline(image);
      const x = entity.x * TILE + (TILE - image.naturalWidth * scale) / 2;
      const y = (entity.y + 1) * TILE - image.naturalHeight * scale;
      ctx.drawImage(outline, x - OUTLINE_PAD * scale, y - OUTLINE_PAD * scale,
        outline.width * scale, outline.height * scale);
    });
    // The source itself remains bright after the ambient darkness pass.
    level.lights.forEach(light => {
      const image = entityImages[light.sprite];
      const scale = TILE / Math.max(image.naturalWidth, image.naturalHeight);
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      ctx.save();
      ctx.filter = `brightness(${torchFlicker(light, time)})`;
      ctx.drawImage(image, light.x * TILE + (TILE - width) / 2,
        (light.y + 1) * TILE - height, width, height);
      ctx.restore();
    });
    level.portals.forEach(portal => {
      const entrance = portal.kind === 'entrance';
      ctx.fillStyle = entrance ? '#91d8ee' : '#e3bd78';
      ctx.fillRect(portal.x * TILE + 10, portal.y * TILE + 24, TILE - 20, 2);
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(entrance ? 'ВХОД' : 'ВЫХОД', (portal.x + 0.5) * TILE, portal.y === 0 ? 8 : HEIGHT - 1);
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

