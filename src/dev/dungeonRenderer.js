import { TILE, SOURCE_TILE, ATLAS_COLUMNS, ATLAS_ROWS, SPRITES } from './dungeonTestMap.js';
import { COLS, ROWS } from './dungeonGenerator.js';
import { ENTITY_ANIMATIONS, entityAnimationFrame, entityFrameRect } from './dungeonAnimations.js';
import { CHARACTER_SHADOW, GROUND_SHADOW_STOPS, characterShadowBox } from '../lighting/groundShadow.js';
import { drawDungeonLighting, torchFlicker, lightAt, lightPosition } from './dungeonLighting.js';

export const WIDTH = COLS * TILE;
export const HEIGHT = ROWS * TILE;
export const RENDER_PADDING = 4;
export const RENDER_WIDTH = COLS * SOURCE_TILE + RENDER_PADDING * 2;
export const RENDER_HEIGHT = ROWS * SOURCE_TILE + RENDER_PADDING * 2;

const tintedAtlases = new WeakMap();
function getTintedAtlas(atlas, tint) {
  if (!tint || !Number.isFinite(tint.hue) || !Number.isFinite(tint.sat)) return atlas;
  let cache = tintedAtlases.get(atlas);
  if (!cache) { cache = new Map(); tintedAtlases.set(atlas, cache); }
  const key = `${tint.hue}:${tint.sat}`;
  if (cache.has(key)) return cache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = atlas.naturalWidth;
  canvas.height = atlas.naturalHeight;
  const context = canvas.getContext('2d');
  context.drawImage(atlas, 0, 0);
  // Same hue/saturation as the battle background; retain tile luminance and alpha.
  context.globalCompositeOperation = 'color';
  context.fillStyle = `hsl(${tint.hue} ${tint.sat}% 50%)`;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = 'destination-in';
  context.drawImage(atlas, 0, 0);
  cache.set(key, canvas);
  return canvas;
}

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

function getSpriteImage(image, sprite, frameIndex = 0) {
  if (!ENTITY_ANIMATIONS[sprite]) return image;
  const frame = entityFrameRect(sprite, image.naturalWidth, image.naturalHeight, frameIndex);
  const key = `${sprite}:${frameIndex}`;
  let cached = spriteFrames.get(image);
  if (!cached) {
    cached = new Map();
    spriteFrames.set(image, cached);
  }
  if (cached.has(key)) return cached.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = frame.width;
  canvas.height = frame.height;
  canvas.getContext('2d').drawImage(
    image,
    frame.x, frame.y, frame.width, frame.height,
    0, 0, frame.width, frame.height,
  );
  cached.set(key, canvas);
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

function drawCharacterShadows(ctx, level, time) {
  for (const entity of level.entities) {
    if (entity.kind !== 'hero' && entity.kind !== 'enemy') continue;
    const center = { x: entity.x + 0.5, y: entity.y + 0.5 };
    let nearest = null, distance = Infinity;
    for (const light of level.lights) {
      const origin = lightPosition(light);
      const d = Math.hypot(center.x - origin.x, center.y - origin.y);
      if (d < distance) { nearest = origin; distance = d; }
    }
    const strength = lightAt(level, center, time);
    const shadow = characterShadowBox({ x: entity.x * TILE, y: entity.y * TILE, size: TILE }, {
      shadowShift: nearest ? Math.sign(center.x - nearest.x) * 0.06 * strength : 0,
      shadowStretch: 1 + 0.4 * strength,
    }, { ...CHARACTER_SHADOW, top: 92 / 96 });
    ctx.save();
    ctx.translate(shadow.x, shadow.y);
    ctx.scale(shadow.width / 2, shadow.height / 2);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    for (const [at, alpha] of GROUND_SHADOW_STOPS) gradient.addColorStop(at, `rgba(0,0,0,${alpha})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }
}

export const createDungeonRenderer = (ctx, atlas, level, entityImages) => {
  if (atlas.naturalWidth !== ATLAS_COLUMNS * SOURCE_TILE || atlas.naturalHeight !== ATLAS_ROWS * SOURCE_TILE) {
    throw new Error('Unexpected Figma atlas dimensions');
  }
  const mapOutline = createMapOutline(atlas, level.tiles);
  const tileAtlas = getTintedAtlas(atlas, level.locationTint);
  // The foundation is static for this level. Reuse it while flames and actors
  // animate instead of drawing all 108 atlas regions on every map frame.
  const foundation = document.createElement('canvas');
  foundation.width = RENDER_WIDTH;
  foundation.height = RENDER_HEIGHT;
  const foundationContext = foundation.getContext('2d');
  const tileScale = SOURCE_TILE / TILE;
  foundationContext.setTransform(tileScale, 0, 0, tileScale, RENDER_PADDING, RENDER_PADDING);
  drawTileLayer(foundationContext, tileAtlas, level.tiles, TILE);
  return ({ showGrid = false, time = null, highlightedIds = new Set() } = {}) => {
    // Retain source-resolution detail; CSS controls the compact display size.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(mapOutline, 0, 0);
    const sourceScale = SOURCE_TILE / TILE;
    ctx.setTransform(sourceScale, 0, 0, sourceScale, RENDER_PADDING, RENDER_PADDING);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(foundation, -RENDER_PADDING / sourceScale, -RENDER_PADDING / sourceScale,
      RENDER_WIDTH / sourceScale, RENDER_HEIGHT / sourceScale);
    (level.coins || []).forEach(coin => {
      const image = entityImages.coin;
      const size = TILE * 0.58;
      ctx.drawImage(image,
        coin.x * TILE + (TILE - size) / 2,
        coin.y * TILE + (TILE - size) / 2,
        size, size);
    });
    drawCharacterShadows(ctx, level, time);
    // Registered animation frames keep the same size and ground anchor.
    [...level.entities].sort((a, b) => a.y - b.y || a.x - b.x).forEach(entity => {
      if (level.lights.some(light => light.entityId === entity.id)) return;
      const image = getSpriteImage(entityImages[entity.sprite], entity.sprite, entityAnimationFrame(entity, time));
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
      const image = getSpriteImage(entityImages[entity.sprite], entity.sprite, entityAnimationFrame(entity, time));
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

