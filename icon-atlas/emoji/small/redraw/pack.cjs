// Pack generated art onto the game grid and export its specified five-color palette.
const sharp = require('sharp');
const path = require('node:path');

(async () => {
  const source = path.join(__dirname, 'generated.png');
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // Generation kept the order, but vertical spacing was not an exact tile grid.
  // These clear gutters separate the four complete rows in the 1774x887 source.
  if (info.width !== 1774 || info.height !== 887) throw Error('Unexpected generated source size');
  const rows = [0, 250, 470, 690, 887];
  const overlays = [];
  const placements = [];
  for (let slot = 0; slot < 26; slot++) {
    const col = slot % 8, row = Math.floor(slot / 8);
    const left = Math.round(col * info.width / 8), right = Math.round((col + 1) * info.width / 8);
    let x0 = right, y0 = rows[row + 1], x1 = left, y1 = rows[row], count = 0;
    for (let y = rows[row]; y < rows[row + 1]; y++) {
      for (let x = left; x < right; x++) {
        if (data[(y * info.width + x) * 4 + 3] > 16) {
          x0 = Math.min(x0, x); y0 = Math.min(y0, y);
          x1 = Math.max(x1, x); y1 = Math.max(y1, y); count++;
        }
      }
    }
    if (!count) throw Error(`Empty icon ${slot}`);
    const maxSize = ({ 3: 14, 8: 14, 10: 22, 11: 20, 22: 8, 24: 4, 25: 22 })[slot] || 24;
    const scale = Math.min(maxSize / (x1 - x0 + 1), maxSize / (y1 - y0 + 1));
    const width = Math.max(1, Math.round((x1 - x0 + 1) * scale));
    const height = Math.max(1, Math.round((y1 - y0 + 1) * scale));
    const input = await sharp(source).extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
      .resize(width, height, { kernel: 'nearest', fit: 'fill' }).png().toBuffer();
    overlays.push({ input, left: col * 32 + Math.floor((32 - width) / 2), top: row * 32 + Math.floor((32 - height) / 2) });
    placements.push({ slot, source: [x0, y0, x1, y1], width, height });
  }
  const packed = path.join(__dirname, 'import.png');
  const pixels = await sharp({ create: { width: 256, height: 128, channels: 4, background: '#00000000' } })
    .composite(overlays).raw().toBuffer();
  // Sprite export: binary alpha and no dithering/antialias colors or stray neon fringes.
  const palette = [[20, 23, 32], [52, 59, 75], [104, 116, 135], [181, 189, 203], [227, 229, 223]];
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) {
      pixels.fill(0, i, i + 4);
      continue;
    }
    let best = palette[0], distance = Infinity;
    for (const color of palette) {
      const d = color.reduce((sum, value, channel) => sum + (value - pixels[i + channel]) ** 2, 0);
      if (d < distance) { best = color; distance = d; }
    }
    pixels.set([...best, 255], i);
  }
  await sharp(pixels, { raw: { width: 256, height: 128, channels: 4 } }).png().toFile(packed);
  await sharp(packed).resize(1024, 512, { kernel: 'nearest' }).png().toFile(path.join(__dirname, 'preview.png'));
  console.log(JSON.stringify(placements));
})().catch(error => { console.error(error); process.exit(1); });
