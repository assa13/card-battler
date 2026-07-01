// Конвертирует PNG-ассеты в WebP. Для пиксель-арта используем lossless+nearLossless.
// Запуск: node scripts/convert-images.mjs [--apply]
//   без --apply — dry-run с отчётом по размеру.
//   с --apply  — создаёт .webp рядом с .png (исходники не удаляются).

import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';

const ROOTS = [
  { dir: 'public/chars', lossless: true, recursive: false },
  { dir: 'public/icons', lossless: false, recursive: false, quality: 88 },
  { dir: 'public/bg/locations', lossless: false, recursive: false, quality: 82 },
  { dir: 'public/bg', lossless: true, recursive: false },
  { dir: 'public', lossless: true, recursive: false },
];

const apply = process.argv.includes('--apply');

const listPngs = async (dir) => {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter(e => e.isFile() && e.name.toLowerCase().endsWith('.png')).map(e => path.join(dir, e.name));
  } catch {
    return [];
  }
};

const fmtKb = (b) => (b / 1024).toFixed(1) + ' KB';

let totalIn = 0, totalOut = 0, count = 0;

for (const root of ROOTS) {
  const files = await listPngs(root.dir);
  if (!files.length) {
    console.log(`(skip) ${root.dir} — нет PNG`);
    continue;
  }
  console.log(`\n== ${root.dir} (${files.length} файлов, lossless=${root.lossless}) ==`);
  for (const file of files) {
    const inputBytes = (await fs.stat(file)).size;
    const out = file.replace(/\.png$/i, '.webp');
    const pipeline = sharp(file).webp(
      root.lossless
        ? { lossless: true, effort: 6, smartSubsample: true }
        : { quality: root.quality, effort: 6 }
    );
    const buf = await pipeline.toBuffer();
    if (apply) await fs.writeFile(out, buf);
    const ratio = ((1 - buf.length / inputBytes) * 100).toFixed(1);
    console.log(`  ${path.basename(file)}: ${fmtKb(inputBytes)} → ${fmtKb(buf.length)} (-${ratio}%)`);
    totalIn += inputBytes;
    totalOut += buf.length;
    count++;
  }
}

console.log(`\n--- ИТОГО ---`);
console.log(`Файлов:  ${count}`);
console.log(`Входной размер:  ${fmtKb(totalIn)}`);
console.log(`Выходной размер: ${fmtKb(totalOut)}`);
console.log(`Экономия: ${fmtKb(totalIn - totalOut)} (-${((1 - totalOut / totalIn) * 100).toFixed(1)}%)`);
if (!apply) console.log(`\nЗапусти с --apply, чтобы записать .webp файлы.`);
