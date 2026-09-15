export const lightPosition = light => ({ x: light.x + 0.5, y: light.y + 0.35 });

export function lightAt(level, target) {
  // The foundation includes the exterior backdrop and keeps the ambient level.
  if (target.y >= 5) return 0;
  let strength = 0;
  for (const light of level.lights) {
    const origin = lightPosition(light);
    const distance = Math.hypot(target.x - origin.x, target.y - origin.y);
    const t = Math.min(1, distance / light.radius);
    // Smooth radial falloff by proximity, independent of walls or sight lines.
    const falloff = 1 - t * t * (3 - 2 * t);
    strength = Math.max(strength, falloff);
  }
  return strength;
}

export function drawDungeonLighting(ctx, level, tileSize) {
  ctx.save();
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      // A whole tile shares one brightness; the original pixel detail stays crisp.
      const light = lightAt(level, { x: x + 0.5, y: y + 0.5 });
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(8, 15, 31, ${0.18 * (1 - light)})`;
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
