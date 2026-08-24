// Приёмка нового экспорта ui_atlas из Figma.
//
//   node scripts/import-atlas.mjs <путь-к-скачанному-png>
//
// Ссылку на экспорт даёт Figma MCP (download_assets по узлу 150:1577), она
// живёт недолго — качать сразу. Скрипт сверяет размер с конфигом, показывает
// долю непрозрачных пикселей в каждом регионе (пустой регион значит, что
// координаты разъехались с макетом), кладёт lossless WebP в public и
// проверяет, что сжатие не тронуло ни одного видимого пикселя.
import sharp from 'sharp';
import { readFileSync, statSync } from 'node:fs';

const SRC = process.argv[2];
const OUT = 'public/assets/ui/atlas/ui_atlas.webp';
const config = JSON.parse(readFileSync('src/config/uiAtlas.json', 'utf8'));

const raw = (f) => sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const kib = (f) => `${(statSync(f).size / 1024).toFixed(0)} KiB`;

const meta = await sharp(SRC).metadata();
console.log(`экспорт: ${meta.width}×${meta.height} ${meta.format} hasAlpha=${meta.hasAlpha} ${kib(SRC)}`);
if (meta.width !== config.width || meta.height !== config.height) {
  console.log(`  ВНИМАНИЕ: конфиг ждёт ${config.width}×${config.height}`);
}

const { data, info } = await raw(SRC);
const alphaAt = (x, y) => data[(y * info.width + x) * info.channels + 3];

let clear = 0;
for (let i = 3; i < data.length; i += info.channels) if (data[i] === 0) clear += 1;
console.log(`прозрачных пикселей ${((clear / (info.width * info.height)) * 100).toFixed(1)}%\n`);

const elements = [
  ...Object.entries(config.slices).map(([n, e]) => ['9-slice', n, e]),
  ...Object.entries(config.sprites).map(([n, e]) => ['спрайт ', n, e]),
];

console.log('содержимое регионов (доля непрозрачных пикселей — регион не должен быть пустым):');
for (const [kind, name, element] of elements) {
  const r = element.region;
  if (r.x + r.width > info.width || r.y + r.height > info.height) {
    console.log(`  ${kind} ${name.padEnd(20)} РЕГИОН ЗА ПРЕДЕЛАМИ АТЛАСА`);
    continue;
  }
  let ink = 0;
  for (let y = r.y; y < r.y + r.height; y += 1) {
    for (let x = r.x; x < r.x + r.width; x += 1) if (alphaAt(x, y) > 0) ink += 1;
  }
  const pct = (ink / (r.width * r.height)) * 100;
  console.log(`  ${kind} ${name.padEnd(20)} ${pct.toFixed(1).padStart(5)}%${pct < 1 ? '  ← ПУСТО' : ''}`);
}

await sharp(SRC).webp({ lossless: true, effort: 6 }).toFile(OUT);

const { data: webp } = await raw(OUT);
let visibleDiff = 0;
let alphaDiff = 0;
for (let i = 0; i < data.length; i += 4) {
  if (data[i + 3] !== webp[i + 3]) alphaDiff += 1;
  else if (data[i + 3] > 0 && (data[i] !== webp[i] || data[i + 1] !== webp[i + 1] || data[i + 2] !== webp[i + 2])) {
    visibleDiff += 1;
  }
}
console.log(`\nWebP lossless: расхождений по альфе ${alphaDiff}, по видимым пикселям ${visibleDiff}`);
console.log(`размер: PNG ${kib(SRC)} → WebP ${kib(OUT)}`);
