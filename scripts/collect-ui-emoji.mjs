// Read source text only. Output a JSON inventory for build-emoji-atlas.py.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, parseExpression } from '@babel/parser';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' });
const pictograph = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u2190-\u21ff\u2300-\u23ff\u25a0-\u27ff\u2900-\u297f\u2b00-\u2bff\u00b7\u00d7\u2212\u2022\u2026]/u;
const asciiIcon = /^[+?!<>\-=]$/;
const icons = new Map();
const scanned = [];
const canonical = text => text.replace(/[\ufe0e\ufe0f]/gu, '');

function collect(text, file, line, kind, allowAscii = false) {
  for (const part of segmenter.segment(text)) {
    const glyph = part.segment;
    const isAscii = allowAscii && text.trim() === glyph && asciiIcon.test(glyph);
    if (!pictograph.test(glyph) && !glyph.includes('\u20e3') && !isAscii) continue;
    const key = canonical(glyph);
    const id = `u-${Array.from(key, c => c.codePointAt(0).toString(16)).join('-')}`;
    let entry = icons.get(id);
    if (!entry) {
      entry = { id, glyph, aliases: [], sources: [] };
      icons.set(id, entry);
    }
    if (!entry.aliases.includes(glyph)) entry.aliases.push(glyph);
    if (glyph.includes('\ufe0f')) entry.glyph = glyph;
    const location = { file, line: line + (text.slice(0, part.index).match(/\n/g)?.length || 0), kind };
    if (!entry.sources.some(old => old.file === file && old.line === location.line && old.kind === kind)) entry.sources.push(location);
  }
}

function walk(node, file) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(child => walk(child, file)); return; }
  if (['StringLiteral', 'JSXText'].includes(node.type)) collect(node.value, file, node.loc.start.line, 'ui', true);
  if (node.type === 'TemplateElement') collect(node.value.cooked ?? node.value.raw, file, node.loc.start.line, 'ui');
  for (const [key, child] of Object.entries(node)) {
    if (['loc', 'extra', 'comments', 'leadingComments', 'trailingComments', 'innerComments', 'tokens', 'errors'].includes(key)) continue;
    if (child && typeof child === 'object') walk(child, file);
  }
}

function filesIn(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? filesIn(file) : /\.(jsx?|tsx?|json|css)$/.test(entry.name) ? [file] : [];
  });
}

for (const fullPath of filesIn(path.join(root, 'src'))) {
  const file = path.relative(root, fullPath).replaceAll('\\', '/');
  const source = fs.readFileSync(fullPath, 'utf8');
  scanned.push(file);
  if (file.endsWith('.css')) {
    for (const match of source.matchAll(/content\s*:\s*(['"])(.*?)\1/g)) {
      collect(match[2], file, 1 + (source.slice(0, match.index).match(/\n/g)?.length || 0), 'ui', true);
    }
    continue;
  }
  const options = { sourceType: 'unambiguous', plugins: ['jsx', ...(file.match(/\.tsx?$/) ? ['typescript'] : [])] };
  const tree = file.endsWith('.json') ? parseExpression(source, options) : parse(source, options);
  walk(tree, file);
  // Keep comment-only pictographs too, but distinguish them from rendered UI.
  for (const comment of tree.comments || []) collect(comment.value, file, comment.loc.start.line, 'comment');
}

// Existing exported card atlas includes retired abilities; preserve them too.
const legacyPath = 'icon-atlas/card-icons/manifest.json';
const legacy = JSON.parse(fs.readFileSync(path.join(root, legacyPath), 'utf8'));
for (const card of legacy.cards) collect(card.emoji, legacyPath, 1, 'legacy-card');
scanned.push(legacyPath);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
collect(html, 'index.html', 1, 'html');
scanned.push('index.html');

console.log(JSON.stringify({ scanned, icons: [...icons.values()].sort((a, b) => a.id.localeCompare(b.id)) }, null, 2));
