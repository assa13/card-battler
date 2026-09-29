import fs from 'node:fs/promises';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
const atlas = JSON.parse(await fs.readFile(new URL('../src/config/uiAtlas.json', import.meta.url), 'utf8'));
const source = new URL(`../public/${atlas.image.replace(/^\.\//, '')}`, import.meta.url);
const output = new URL('../public/assets/ui/kit/', import.meta.url);
await fs.mkdir(output, { recursive: true });
for (const name of ['icon_bg', 'button_red', 'button_default', 'PB_empty', 'PB', 'header', 'card_bg', 'item_slot']) {
  const { x, y, width, height } = (atlas.slices[name] || atlas.sprites[name]).region;
  await sharp(await fs.readFile(source)).extract({ left: x, top: y, width, height })
    .png().toFile(fileURLToPath(new URL(`${name}.png`, output)));
}
console.log('Exported eight original UI-kit regions for responsive controls.');
