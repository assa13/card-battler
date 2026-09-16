import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PixelGridDebug from './PixelGridDebug.jsx';
import { normalizePixelGrid, PIXEL_GRID_DISPLACEMENT_SCALE, PIXEL_GRID_STORAGE_KEY } from './pixelGrid.js';
import { createPixelGridMap } from './pixelGridMap.js';

function loadSettings() {
  try { return normalizePixelGrid(JSON.parse(localStorage.getItem(PIXEL_GRID_STORAGE_KEY))); }
  catch { return normalizePixelGrid(); }
}

export default function PixelGridEffect() {
  const [settings, setSettings] = useState(loadSettings);
  const [map, setMap] = useState(null);
  const [error, setError] = useState('');
  const renderer = useRef(null);
  const filterId = `pixel-grid-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { size, strength, offsetX, offsetY } = settings;
  const enabled = size > 1 && strength > 0;

  useEffect(() => () => {
    renderer.current?.dispose();
    renderer.current = null;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let frame = 0;
    let pendingImage;
    let revision = 0;
    let densityQuery;
    const refresh = () => {
      const currentRevision = ++revision;
      try {
        renderer.current ??= createPixelGridMap(() => setError('Контекст WebGL потерян — обновите страницу'));
        const dpr = window.devicePixelRatio || 1;
        const width = window.innerWidth;
        const height = window.innerHeight;
        const href = renderer.current.render(Math.round(width * dpr), Math.round(height * dpr), { size, offsetX, offsetY });
        // Activate only after the compositor can decode the lookup image.
        pendingImage = new Image();
        pendingImage.onload = () => {
          if (cancelled || currentRevision !== revision) return;
          setMap({ href, width, height, dpr, size, offsetX, offsetY });
          setError('');
        };
        pendingImage.onerror = () => {
          if (!cancelled && currentRevision === revision) setError('Не удалось загрузить сетку');
        };
        pendingImage.src = href;
        densityQuery?.removeEventListener('change', schedule);
        densityQuery = window.matchMedia(`(resolution: ${dpr}dppx)`);
        densityQuery.addEventListener('change', schedule);
      } catch (failure) {
        if (!cancelled) setError(failure.message);
      }
    };
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(refresh);
    }
    schedule();
    window.addEventListener('resize', schedule);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (pendingImage) pendingImage.onload = pendingImage.onerror = null;
      densityQuery?.removeEventListener('change', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [enabled, size, offsetX, offsetY]);

  const ready = enabled && !error && map && map.size === size && map.offsetX === offsetX && map.offsetY === offsetY;
  useEffect(() => {
    if (!ready) return;
    const root = document.getElementById('root');
    const previous = root.style.filter;
    root.style.filter = `url("#${filterId}")`;
    return () => { root.style.filter = previous; };
  }, [ready, filterId]);

  const update = value => {
    const next = normalizePixelGrid(value);
    setSettings(next);
    try { localStorage.setItem(PIXEL_GRID_STORAGE_KEY, JSON.stringify(next)); }
    catch { /* The preview also works with browser storage disabled. */ }
  };
  const status = !enabled ? 'Выключено · исходное изображение'
    : error ? `${error} · эффект выключен`
      : ready ? 'WebGL + compositor · физические px' : 'Подготовка сетки…';

  // Portals sit outside #root, keeping the controls crisp and independently clickable.
  return createPortal(<>
    <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute', pointerEvents: 'none' }}>
      <defs>
        {map && <filter id={filterId} x="0" y="0" width={map.width} height={map.height}
          filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feImage href={map.href} x="0" y="0" width={map.width} height={map.height}
            preserveAspectRatio="none" style={{ imageRendering: 'pixelated' }} result="grid" />
          <feDisplacementMap in="SourceGraphic" in2="grid" scale={PIXEL_GRID_DISPLACEMENT_SCALE / map.dpr}
            xChannelSelector="R" yChannelSelector="G" result="snapped" />
          <feComposite in="snapped" in2="SourceGraphic" operator="arithmetic"
            k1="0" k2={strength / 100} k3={1 - strength / 100} k4="0" />
        </filter>}
      </defs>
    </svg>
    <PixelGridDebug settings={settings} onChange={update} status={status} />
  </>, document.body);
}
