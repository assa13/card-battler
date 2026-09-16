import { DEFAULT_PIXEL_GRID } from './pixelGrid.js';
import './PixelGridDebug.css';

export default function PixelGridDebug({ settings, onChange, status }) {
  const update = (key, value) => onChange({ ...settings, [key]: Number(value) });
  return (
    <details className="pixel-grid-debug" open onKeyDown={event => event.stopPropagation()}
      onKeyUp={event => event.stopPropagation()}>
      <summary>Pixel Grid <span>DEBUG</span></summary>
      <div className="pixel-grid-debug-body">
        <label>Grid Size
          <select aria-label="Grid Size" value={settings.size} onChange={event => update('size', event.target.value)}>
            {[1, 2, 3, 4].map(size => <option key={size} value={size}>{size} px</option>)}
          </select>
        </label>
        <label htmlFor="pixel-grid-strength">Grid Strength <output>{settings.strength}%</output></label>
        <input id="pixel-grid-strength" aria-label="Grid Strength" type="range" min="0" max="100" step="1"
          value={settings.strength} onChange={event => update('strength', event.target.value)} />
        <div className="pixel-grid-debug-offset">
          <span>Grid Offset</span>
          <label>X <input type="number" min="-64" max="64" step="1" aria-label="Grid Offset X"
            value={settings.offsetX} onChange={event => update('offsetX', event.target.value)} /></label>
          <label>Y <input type="number" min="-64" max="64" step="1" aria-label="Grid Offset Y"
            value={settings.offsetY} onChange={event => update('offsetY', event.target.value)} /></label>
        </div>
        <p role="status">{status}</p>
        <button type="button" onClick={() => onChange({ ...DEFAULT_PIXEL_GRID })}>Сбросить</button>
      </div>
    </details>
  );
}
