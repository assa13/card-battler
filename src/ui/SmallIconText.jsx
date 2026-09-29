import { Children } from 'react';
import atlas from '../config/smallIcons.json';

const canonical = glyph => glyph.replace(/[\ufe0e\ufe0f]/g, '');
const byGlyph = new Map(Object.entries(atlas.icons).flatMap(([name, icon]) =>
  [icon.glyph, ...icon.aliases].filter(Boolean).map(glyph => [canonical(glyph), name])));
const imageUrl = `${import.meta.env.BASE_URL}${atlas.image}`;
// ASCII punctuation is an icon only when the entire label is a single symbol.
// This leaves dialogue punctuation, hyphens in words and ordinary numbers intact.
const symbolPattern = /[↔⬇→▸✓✕⏳🔒−×↩🔉🔇🔊▼◀▶▲•…·✦][\ufe0e\ufe0f]?/gu;

export function SmallIcon({ name, label, size = '2em', className = '', style }) {
  // Plus always uses the surrounding font and its normal size, never the atlas.
  if (name === 'plus') return '+';
  const icon = atlas.icons[name];
  if (!icon) return null;
  const col = icon.slot % atlas.cols;
  const row = Math.floor(icon.slot / atlas.cols);
  return (
    <span
      role="img"
      aria-label={label ?? icon.label}
      className={className}
      data-small-icon={name}
      style={{
        display: 'inline-block', width: size, height: size, flexShrink: 0,
        verticalAlign: '-0.125em', lineHeight: 1, pointerEvents: 'none',
        backgroundImage: `url("${imageUrl}")`, backgroundRepeat: 'no-repeat',
        backgroundSize: `${atlas.cols * 100}% ${atlas.rows * 100}%`,
        backgroundPosition: `${atlas.cols > 1 ? col / (atlas.cols - 1) * 100 : 0}% ${atlas.rows > 1 ? row / (atlas.rows - 1) * 100 : 0}%`,
        imageRendering: 'pixelated',
        filter: name === 'exclamation' ? 'brightness(1.7) sepia(1) saturate(6)' : undefined,
        ...style,
      }}
    />
  );
}

// Opt-in at render sites: data, comparisons, tooltips and native attributes stay strings.
export default function SmallIconText({ children }) {
  return Children.map(children, child => {
    if (typeof child !== 'string') return child;
    const trimmed = child.trim();
    if (/^[!?-]$/.test(trimmed) && byGlyph.has(trimmed)) {
      const start = child.indexOf(trimmed);
      return [child.slice(0, start), <SmallIcon key="symbol" name={byGlyph.get(trimmed)} />, child.slice(start + 1)];
    }
    const result = [];
    let cursor = 0;
    for (const match of child.matchAll(symbolPattern)) {
      const name = byGlyph.get(canonical(match[0]));
      if (!name) continue;
      result.push(child.slice(cursor, match.index), <SmallIcon key={match.index} name={name} />);
      cursor = match.index + match[0].length;
    }
    if (!cursor) return child;
    result.push(child.slice(cursor));
    return result;
  });
}
