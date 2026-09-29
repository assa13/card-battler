// Publish the editable atlas and its coordinates; runtime never reads the source inventory.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'icon-atlas/emoji');
const manifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'), 'utf8'));
const atlas = manifest.atlases.small;
const bytes = fs.readFileSync(path.join(source, atlas.image));
const revision = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
const target = 'assets/ui/atlas/small-icons.png';
fs.mkdirSync(path.dirname(path.join(root, 'public', target)), { recursive: true });
fs.writeFileSync(path.join(root, 'public', target), bytes);
const config = {
  image: `${target}?v=${revision}`,
  cellSize: atlas.cellSize, cols: atlas.cols, rows: atlas.rows,
  icons: Object.fromEntries(manifest.icons.filter(icon => icon.sizeClass === 'small').map(icon => [
    path.basename(icon.file, '.png'),
    { slot: icon.atlasSlot, glyph: icon.glyph, label: icon.label, aliases: icon.aliases },
  ])),
};
fs.writeFileSync(path.join(root, 'src/config/smallIcons.json'), `${JSON.stringify(config, null, 2)}\n`);
console.log(`Published ${Object.keys(config.icons).length} small UI icons (${revision}).`);
