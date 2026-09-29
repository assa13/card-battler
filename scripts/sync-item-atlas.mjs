import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifestPath = path.join(root, 'icon-atlas/items/manifest.json');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const atlas = path.resolve(path.dirname(manifestPath), manifest.atlas);
const { width, height, hasAlpha } = await sharp(atlas).metadata();
if (!hasAlpha || width !== manifest.columns * manifest.cellSize || height !== manifest.rows * manifest.cellSize) {
  throw new Error('Atlas dimensions/alpha do not match icon-atlas/items/manifest.json');
}
for (const item of manifest.items) {
  const { x: left, y: top, width, height } = item.rect;
  if (!/^item_\d+\.webp$/.test(item.icon)) throw new Error(`Invalid item filename: ${item.icon}`);
  await sharp(atlas).extract({ left, top, width, height }).webp({ lossless: true })
    .toFile(path.join(root, 'public/assets/items', item.icon));
}
console.log(`Updated ${manifest.items.length} item sprites from the atlas.`);
