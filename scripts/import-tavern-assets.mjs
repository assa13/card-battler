// Одноразовый импорт исходных PNG из new_imgs/ в public/assets/tavern/ в формате WebP.
// Запуск: node scripts/import-tavern-assets.mjs
//
// Маппинг исходник → целевое имя задаётся в MAP. Имена целевых файлов синхронизированы
// с TavernSceneConfig.js, чтобы конфиг не пришлось править после импорта.

import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';

const SRC_DIR = 'new_imgs';
const DST_DIR = 'public/assets/tavern';

// [source filename, target basename (без расширения), lossless?]
const MAP = [
  ['bg_base_figma.png',         'bg_base',          false],
  ['bar_counter_figma.png',     'bar_counter',      true],
  ['npc_bartender_figma.png',   'npc_bartender',    true],
  ['table_round_figma.png',     'table_round',      true],
  ['visitor_drunk_figma.png',   'visitor_drunk',    true],
  ['visitor_cloaked_figma.png', 'visitor_cloaked',  true],
  ['visitor_walker_a_figma.png','visitor_walker_a', true],
];

const fmtKb = (b) => (b / 1024).toFixed(1) + ' KB';

await fs.mkdir(DST_DIR, { recursive: true });

let totalIn = 0, totalOut = 0;

for (const [srcName, dstBase, lossless] of MAP) {
  const src = path.join(SRC_DIR, srcName);
  const dst = path.join(DST_DIR, dstBase + '.webp');
  try {
    const inputBytes = (await fs.stat(src)).size;
    const buf = await sharp(src).webp(
      lossless
        ? { lossless: true, effort: 6, smartSubsample: true }
        : { quality: 85, effort: 6 }
    ).toBuffer();
    await fs.writeFile(dst, buf);
    const ratio = ((1 - buf.length / inputBytes) * 100).toFixed(1);
    console.log(`  ${srcName.padEnd(14)} → ${dstBase}.webp  ${fmtKb(inputBytes).padStart(10)} → ${fmtKb(buf.length).padStart(9)}  (-${ratio}%)`);
    totalIn += inputBytes;
    totalOut += buf.length;
  } catch (err) {
    console.error(`  ! пропуск ${srcName}: ${err.message}`);
  }
}

console.log(`\nИтого: ${fmtKb(totalIn)} → ${fmtKb(totalOut)} (-${((1 - totalOut / totalIn) * 100).toFixed(1)}%)`);
console.log(`Готово: ${DST_DIR}/`);
