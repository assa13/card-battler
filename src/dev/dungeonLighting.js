export const lightPosition = light => ({ x: light.x + 0.5, y: light.y + 0.35 });

export const AMBIENT_LIGHT = 0.82 * 0.875; // 12.5% below the previous ambient level.

// Two fast frequencies give each flame an independent, visible flutter.
export function torchFlicker(light, time) {
  if (time === null) return 1;
  const phase = light.x * 1.7 + light.y * 0.9;
  const amplitude = light.sprite === 'candle' ? 0.12 : 0.18;
  return 1 + (Math.sin(time * 8.5 + phase) * 2 / 3 + Math.sin(time * 19 + phase * 1.3) / 3) * amplitude;
}

export function lightAt(level, target, time = null) {
  // Follow the irregular foundation, which can now occur above the last row.
  const tile = level.tiles?.[Math.floor(target.y)]?.[Math.floor(target.x)];
  if (tile === '.' || tile?.startsWith('base')) return 0;
  let strength = 0;
  for (const light of level.lights) {
    const origin = lightPosition(light);
    const distance = Math.hypot(target.x - origin.x, target.y - origin.y);
    const t = Math.min(1, distance / light.radius);
    // Smooth radial falloff by proximity, independent of walls or sight lines.
    const falloff = 1 - t * t * (3 - 2 * t);
    strength = Math.max(strength, falloff * torchFlicker(light, time));
  }
  return Math.min(1, strength);
}

export function drawDungeonLighting(ctx, level, tileSize, time = null) {
  ctx.save();
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      if (level.tiles[y][x] === '.') continue;
      // A whole tile shares one brightness; the original pixel detail stays crisp.
      const light = lightAt(level, { x: x + 0.5, y: y + 0.5 }, time);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(8, 15, 31, ${(1 - AMBIENT_LIGHT) * (1 - light)})`;
      ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
      if (light > 0) {
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = `rgba(255, 210, 132, ${light * 0.2})`;
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
      }
    }
  }
  ctx.restore();
}
