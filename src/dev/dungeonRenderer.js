import { TILE, SOURCE_TILE, ATLAS_COLUMNS, ATLAS_ROWS, SPRITES } from './dungeonTestMap.js';
import { COLS, ROWS, ENTITY_FRAMES } from './dungeonGenerator.js';
import { drawDungeonLighting, torchFlicker } from './dungeonLighting.js';

export const WIDTH = COLS * TILE;
export const HEIGHT = ROWS * TILE;
export const RENDER_PADDING = 4;
export const RENDER_WIDTH = COLS * SOURCE_TILE + RENDER_PADDING * 2;
export const RENDER_HEIGHT = ROWS * SOURCE_TILE + RENDER_PADDING * 2;

const outlines = new WeakMap();
const spriteFrames = new WeakMap();
const OUTLINE_PAD = 3;
// Four source pixels become approximately 3 px at the current display scale.
const MAP_OUTLINE_RADIUS = RENDER_PADDING;
const MAP_OUTLINE_COLOR = '#0b0d18';

function drawTileLayer(ctx, atlas, tiles, tileSize) {
  tiles.forEach((row, y) => row.forEach((name, x) => {
    if (name === '.') return;
    if (name === 'partition') {
      for (const [sprite, offset] of [['wallE', 0], ['wallW', 0.5]]) {
        const [column, line] = SPRITES[sprite];
        ctx.drawImage(atlas, (column + offset) * SOURCE_TILE, line * SOURCE_TILE,
          SOURCE_TILE / 2, SOURCE_TILE, (x + offset) * tileSize, y * tileSize, tileSize / 2, tileSize);
      }
      return;
    }
    const [column, line] = SPRITES[name];
    ctx.drawImage(atlas,
      column * SOURCE_TILE, line * SOURCE_TILE, SOURCE_TILE, SOURCE_TILE,
      x * tileSize, y * tileSize, tileSize, tileSize);
  }));
}

function createMapOutline(atlas, tiles) {
  const mask = document.createElement('canvas');
  mask.width = RENDER_WIDTH;
  mask.height = RENDER_HEIGHT;
  const maskCtx = mask.getContext('2d');
  maskCtx.translate(RENDER_PADDING, RENDER_PADDING);
  drawTileLayer(maskCtx, atlas, tiles, SOURCE_TILE);
  maskCtx.setTransform(1, 0, 0, 1, 0, 0);
  maskCtx.globalCompositeOperation = 'source-in';
  maskCtx.fillStyle = MAP_OUTLINE_COLOR;
  maskCtx.fillRect(0, 0, mask.width, mask.height);

  const outline = document.createElement('canvas');
  outline.width = RENDER_WIDTH;
  outline.height = RENDER_HEIGHT;
  const outlineCtx = outline.getContext('2d');
  for (let dy = -MAP_OUTLINE_RADIUS; dy <= MAP_OUTLINE_RADIUS; dy++) {
    for (let dx = -MAP_OUTLINE_RADIUS; dx <= MAP_OUTLINE_RADIUS; dx++) {
      if (dx * dx + dy * dy > MAP_OUTLINE_RADIUS * MAP_OUTLINE_RADIUS) continue;
      outlineCtx.drawImage(mask, dx, dy);
    }
  }
  outlineCtx.globalCompositeOperation = 'destination-out';
  outlineCtx.drawImage(mask, 0, 0);
  return outline;
}

function getSpriteImage(image, sprite) {
  const frame = ENTITY_FRAMES[sprite];
  if (!frame) return image;
  let cached = spriteFrames.get(image);
  if (!cached) {
    cached = new Map();
    spriteFrames.set(image, cached);
  }
  if (cached.has(sprite)) return cached.get(sprite);
  const canvas = document.createElement('canvas');
  canvas.width = frame.width;
  canvas.height = frame.height;
  canvas.getContext('2d').drawImage(
    image,
    frame.x, frame.y, frame.width, frame.height,
    0, 0, frame.width, frame.height,
  );
  cached.set(sprite, canvas);
  return canvas;
}

function getOutline(image) {
  if (outlines.has(image)) return outlines.get(image);
  const mask = document.createElement('canvas');
  mask.width = image.naturalWidth || image.width;
  mask.height = image.naturalHeight || image.height;
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
  const mapOutline = createMapOutline(atlas, level.tiles);
  return ({ showGrid = false, time = null, highlightedIds = new Set() } = {}) => {
    // Retain source-resolution detail; CSS controls the compact display size.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(mapOutline, 0, 0);
    const sourceScale = SOURCE_TILE / TILE;
    ctx.setTransform(sourceScale, 0, 0, sourceScale, RENDER_PADDING, RENDER_PADDING);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    drawTileLayer(ctx, atlas, level.tiles, TILE);
    (level.coins || []).forEach(coin => {
      const image = entityImages.coin;
      const size = TILE * 0.58;
      ctx.drawImage(image,
        coin.x * TILE + (TILE - size) / 2,
        coin.y * TILE + (TILE - size) / 2,
        size, size);
    });
    // Transparent author-supplied PNGs keep their proportions inside square cells.
    [...level.entities].sort((a, b) => a.y - b.y || a.x - b.x).forEach(entity => {
      if (level.lights.some(light => light.entityId === entity.id)) return;
      const image = getSpriteImage(entityImages[entity.sprite], entity.sprite);
      const imageWidth = image.naturalWidth || image.width;
      const imageHeight = image.naturalHeight || image.height;
      const scale = TILE / Math.max(imageWidth, imageHeight);
      const width = imageWidth * scale;
      const height = imageHeight * scale;
      ctx.save();
      if (entity.opened) {
        ctx.filter = 'grayscale(1) brightness(0.72)';
        ctx.globalAlpha = 0.48;
      }
      ctx.drawImage(image, entity.x * TILE + (TILE - width) / 2,
        (entity.y + 1) * TILE - height, width, height);
      ctx.restore();
    });
    drawDungeonLighting(ctx, level, TILE, time);
    // Outline the actual transparent silhouette, after lighting so yellow stays clear.
    level.entities.filter(entity => highlightedIds.has(entity.id)).forEach(entity => {
      const image = getSpriteImage(entityImages[entity.sprite], entity.sprite);
      const imageWidth = image.naturalWidth || image.width;
      const imageHeight = image.naturalHeight || image.height;
      const scale = TILE / Math.max(imageWidth, imageHeight);
      const outline = getOutline(image);
      const x = entity.x * TILE + (TILE - imageWidth * scale) / 2;
      const y = (entity.y + 1) * TILE - imageHeight * scale;
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
      if (portal.side === 'east' || portal.side === 'west') {
        ctx.fillRect(portal.x * TILE + (portal.side === 'east' ? 6 : TILE - 8), portal.y * TILE + 10, 2, TILE - 20);
      } else {
        ctx.fillRect(portal.x * TILE + 10, portal.y * TILE + (portal.side === 'north' ? 24 : 6), TILE - 20, 2);
      }
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

