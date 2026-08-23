// Сборка иконок проекта в атласы 5x5.
// Запуск: node scripts/build-icon-atlas.mjs
// Выход: icon-atlas/ (атласы WebP + manifest.json + sources/ с оригиналами)
import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'icon-atlas');
const SRC_DIR = path.join(OUT_DIR, 'sources');

const COLS = 5;
const ROWS = 5;
const CELL = 256;

// Группа 1: иконки предметов (public/icons), порядок — по номеру в имени файла.
async function listItemIcons() {
  const dir = path.join(ROOT, 'public', 'icons');
  const files = (await fs.readdir(dir)).filter((f) => /^item_\d+\.webp$/.test(f));
  files.sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  return files.map((f) => ({ name: f.replace(/\.webp$/, ''), src: path.join(dir, f) }));
}

// Группа 2: UI-иконки, реально используемые в src (TaskMaster, QTE, комбо-руны, декор-угол).
function listUiIcons() {
  const ui = (p) => path.join(ROOT, 'public', p);
  return [
    { name: 'task-master/skull', src: ui('assets/ui/task-master/icon-1.svg') },
    { name: 'task-master/play', src: ui('assets/ui/task-master/icon-2.svg') },
    { name: 'task-master/icon-3', src: ui('assets/ui/task-master/icon-3.svg') },
    { name: 'task-master/shadow', src: ui('assets/ui/task-master/icon-4.svg') },
    { name: 'task-master/icon-5', src: ui('assets/ui/task-master/icon-5.svg') },
    { name: 'enemy-defense-cue-1', src: ui('assets/ui/enemy-defense-cue-1.png') },
    { name: 'enemy-defense-cue-2', src: ui('assets/ui/enemy-defense-cue-2.png') },
    { name: 'combo-rune-inner', src: ui('combo_rune_inner.webp') },
    { name: 'combo-rune-outer', src: ui('combo_rune_outer.webp') },
    { name: 'corner', src: ui('corner.webp') },
  ];
}

async function iconToCell(icon) {
  const isSvg = icon.src.endsWith('.svg');
  let img = sharp(icon.src, isSvg ? { density: 384 } : {});
  const meta = await img.metadata();
  const w = meta.width;
  const h = meta.height;
  // Апскейл — только nearest (пиксель-арт), даунскейл — lanczos.
  const kernel = w <= CELL && h <= CELL ? 'nearest' : 'lanczos3';
  const buf = await img
    .resize(CELL, CELL, { fit: 'contain', kernel, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return buf;
}

async function buildAtlas(groupName, icons) {
  if (icons.length > COLS * ROWS) {
    throw new Error(`Группа ${groupName}: ${icons.length} иконок не влезает в сетку ${COLS}x${ROWS}`);
  }
  const composites = [];
  const entries = [];
  for (let i = 0; i < icons.length; i++) {
    const icon = icons[i];
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = col * CELL;
    const y = row * CELL;
    composites.push({ input: await iconToCell(icon), left: x, top: y });
    entries.push({
      name: icon.name,
      source: path.relative(ROOT, icon.src).split(path.sep).join('/'),
      index: i,
      row,
      col,
      x,
      y,
      width: CELL,
      height: CELL,
    });
    // Копия оригинала в sources/
    const flatName = icon.name.replace(/\//g, '_') + path.extname(icon.src);
    await fs.copyFile(icon.src, path.join(SRC_DIR, flatName));
  }
  const atlasName = `${groupName}-5x5.webp`;
  await sharp({
    create: {
      width: COLS * CELL,
      height: ROWS * CELL,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .webp({ lossless: true })
    .toFile(path.join(OUT_DIR, atlasName));
  return { atlas: atlasName, entries };
}

await fs.mkdir(SRC_DIR, { recursive: true });

const groups = [
  ['items', await listItemIcons()],
  ['ui', listUiIcons()],
];

const manifest = { cellSize: CELL, cols: COLS, rows: ROWS, atlases: {} };
for (const [name, icons] of groups) {
  const { atlas, entries } = await buildAtlas(name, icons);
  manifest.atlases[atlas] = entries;
  console.log(`${atlas}: ${entries.length} иконок`);
}

await fs.writeFile(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('manifest.json записан');
