import { useEffect, useMemo, useRef, useState } from 'react';
import { ATLAS_URL } from '../dev/dungeonTestMap.js';
import { COLS, ROWS, ENTITY_URLS } from '../dev/dungeonGenerator.js';
import { adjacentTargets, visibleEntities, ENCOUNTER_NAMES } from '../dev/dungeonInteraction.js';
import { createDungeonRenderer, RENDER_WIDTH, RENDER_HEIGHT } from '../dev/dungeonRenderer.js';
import './SectorDungeon.css';

const MOVES = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };

export default function SectorDungeon({ run, sector, active, onAction }) {
  const canvasRef = useRef(null);
  const boardRef = useRef(null);
  const actionRef = useRef(onAction);
  const [assets, setAssets] = useState(null);
  const [error, setError] = useState(false);
  const [size, setSize] = useState({ width: 576, height: 192 });
  const manifest = JSON.stringify({ atlas: ATLAS_URL, ...ENTITY_URLS });
  const level = useMemo(() => ({ ...run.level, entities: visibleEntities(run) }), [run]);
  const nearby = useMemo(() => adjacentTargets(run), [run]);
  const highlightedIds = useMemo(() => new Set(nearby.map(entity => entity.id)), [nearby]);
  const enemies = level.entities.filter(entity => entity.kind === 'enemy').length;
  const chests = level.entities.filter(entity => entity.kind === 'chest').length;

  useEffect(() => { actionRef.current = onAction; }, [onAction]);
  useEffect(() => {
    let live = true;
    const load = url => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
    Promise.all(Object.entries(JSON.parse(manifest)).map(async ([name, url]) => [name, await load(url)]))
      .then(entries => { if (live) { setAssets(Object.fromEntries(entries)); setError(false); } })
      .catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [manifest]);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(1, Math.min(entry.contentRect.width, entry.contentRect.height * COLS / ROWS));
      setSize({ width, height: width * ROWS / COLS });
    });
    observer.observe(boardRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!assets || Object.keys(ENTITY_URLS).some(name => !assets[name])) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const render = createDungeonRenderer(ctx, assets.atlas, level, assets);
    render({ highlightedIds });
    if (!active) return;
    let frameId;
    let lastDraw = -Infinity;
    const animate = time => {
      if (time - lastDraw >= 1000 / 30) {
        render({ time: time / 1000, highlightedIds });
        lastDraw = time;
      }
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [assets, level, active, highlightedIds]);

  useEffect(() => {
    if (!active || !run.path.length) return;
    const timer = setTimeout(() => actionRef.current({ type: 'tick' }), 130);
    return () => clearTimeout(timer);
  }, [active, run.path]);

  useEffect(() => {
    if (!active) return;
    let lastStep = -Infinity;
    const onKeyDown = event => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      const move = MOVES[event.code];
      if (!move) return;
      event.preventDefault();
      const now = performance.now();
      if (event.repeat && now - lastStep < 100) return;
      lastStep = now;
      actionRef.current({ type: 'step', dx: move[0], dy: move[1] });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active]);

  function clickMap(event) {
    if (!active) return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.focus();
    onAction({ type: 'click', cell: {
      x: Math.floor((event.clientX - rect.left) / rect.width * COLS),
      y: Math.floor((event.clientY - rect.top) / rect.height * ROWS),
    } });
  }

  return (
    <section className={`sector-dungeon${active ? ' is-active' : ''}`} aria-label={`Подземелье сектора ${sector}`}>
      <header>
        <strong>Сектор {sector}</strong>
        <span>Враги {enemies} · Сундуки {chests}</span>
        <span className="sector-dungeon-exit">Выход → следующий сектор</span>
      </header>
      <div ref={boardRef} className="sector-dungeon-board">
        <canvas ref={canvasRef} width={RENDER_WIDTH} height={RENDER_HEIGHT} style={size}
          role="img" tabIndex={active ? 0 : -1} onClick={clickMap}
          aria-label={`Карта сектора ${sector}, 18 на 6 тайлов. Герой: столбец ${run.hero.x + 1}, строка ${run.hero.y + 1}.`} />
      </div>
      <footer>
        <span role="status">{error ? 'Не удалось загрузить карту. Обнови страницу.' : !assets ? 'Загрузка карты…'
          : run.notice || 'WASD / стрелки или клик по полу. Подойди к объекту, чтобы взаимодействовать.'}</span>
        <div className="sector-dungeon-actions">
          {nearby.map(entity => <button key={entity.id} type="button" disabled={!active}
            onClick={() => onAction({ type: 'click', cell: entity })}>
            {entity.kind === 'chest' ? 'Открыть сундук' : `Бой: ${ENCOUNTER_NAMES[entity.sprite]}`}
          </button>)}
        </div>
      </footer>
    </section>
  );
}
