import { lazy, Suspense, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ATLAS_URL } from './dungeonTestMap.js';
import { COLS, ROWS, ENTITY_URLS, CHARACTERS_FIGMA_URL, generateDungeon } from './dungeonGenerator.js';
import { WIDTH, HEIGHT, RENDER_WIDTH, RENDER_HEIGHT, createDungeonRenderer } from './dungeonRenderer.js';
import { adjacentTargets, createDungeonRun, dungeonRunReducer, ENCOUNTER_NAMES, visibleEntities } from './dungeonInteraction.js';
import './DungeonTest.css';

const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const DungeonCombat = lazy(() => import('../App.jsx'));

export default function DungeonTest() {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const [assets, setAssets] = useState(null);
  const assetManifest = JSON.stringify({ atlas: ATLAS_URL, ...ENTITY_URLS });
  const [error, setError] = useState(false);
  const [pixelScale, setPixelScale] = useState(1);
  const [showGrid, setShowGrid] = useState(false);
  const [run, dispatch] = useReducer(dungeonRunReducer, null, () => createDungeonRun(generateDungeon(newSeed())));
  const level = useMemo(() => ({ ...run.level, entities: visibleEntities(run) }), [run]);
  const nearby = useMemo(() => adjacentTargets(run), [run]);
  const highlightedIds = useMemo(() => new Set(nearby.map(entity => entity.id)), [nearby]);
  const [seedInput, setSeedInput] = useState(String(level.seed));
  const enemies = level.entities.filter(entity => entity.kind === 'enemy').length;
  const chests = level.entities.filter(entity => entity.kind === 'chest').length;

  useEffect(() => {
    if (run.encounter) return;
    const observer = new ResizeObserver(([entry]) => {
      setPixelScale(Math.max(1, Math.min(2, Math.floor(entry.contentRect.width / WIDTH))));
    });
    observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, [run.encounter]);

  useEffect(() => {
    let active = true;
    const load = url => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
    Promise.all(Object.entries(JSON.parse(assetManifest)).map(async ([name, url]) => [name, await load(url)]))
      .then(entries => { if (active) setAssets(Object.fromEntries(entries)); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [assetManifest]);

  useEffect(() => {
    if (!assets || Object.keys(ENTITY_URLS).some(name => !assets[name]) || run.encounter) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const render = createDungeonRenderer(ctx, assets.atlas, level, assets);
    let frameId;
    let lastDraw = -Infinity;
    const animate = timestamp => {
      if (timestamp - lastDraw >= 1000 / 30) {
        render({ showGrid, time: timestamp / 1000, highlightedIds });
        lastDraw = timestamp;
      }
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [assets, showGrid, level, highlightedIds, run.encounter]);

  useEffect(() => {
    if (!run.path.length || run.encounter) return;
    const timer = setTimeout(() => dispatch({ type: 'tick' }), 130);
    return () => clearTimeout(timer);
  }, [run.path, run.encounter]);

  useEffect(() => {
    if (run.encounter) return;
    const moves = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
      ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
    let lastStep = -Infinity;
    const onKeyDown = event => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      const move = moves[event.code];
      if (!move) return;
      event.preventDefault();
      const now = performance.now();
      if (event.repeat && now - lastStep < 100) return;
      lastStep = now;
      dispatch({ type: 'step', dx: move[0], dy: move[1] });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [run.encounter]);

  function generate(seed) {
    const next = generateDungeon(seed);
    dispatch({ type: 'reset', level: next });
    setSeedInput(String(next.seed));
  }

  function clickMap(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const cell = { x: Math.floor((event.clientX - rect.left) / rect.width * COLS),
      y: Math.floor((event.clientY - rect.top) / rect.height * ROWS) };
    event.currentTarget.focus();
    dispatch({ type: 'click', cell });
  }

  if (run.encounter) {
    const finishBattle = result => dispatch({ type: 'battle-result', id: run.encounter.id, ...result });
    return (
      <div className="dungeon-battle">
        <div className="dungeon-battle-return">
          <button type="button" onClick={() => finishBattle({ victory: false })}>← Вернуться на карту</button>
          <span>{run.encounter.title}</span>
        </div>
        <Suspense fallback={<p className="dungeon-battle-loading">Загрузка боя…</p>}>
          <DungeonCombat key={run.encounter.id} dungeonEncounter={run.encounter} onDungeonEncounterEnd={finishBattle} />
        </Suspense>
      </div>
    );
  }

  return (
    <main className="dungeon-test">
      <header className="dungeon-test-header">
        <div>
          <p className="dungeon-test-eyebrow">Генератор подземелий · {COLS} × {ROWS}</p>
          <h1>Холодные крипты</h1>
        </div>
        <nav aria-label="Материалы уровня">
          <a href={ATLAS_URL} target="_blank" rel="noreferrer">Тайлсет ↗</a>
          <a href={CHARACTERS_FIGMA_URL} target="_blank" rel="noreferrer">Персонажи ↗</a>
          <a href="#">К игре ↗</a>
        </nav>
      </header>
      <div className="dungeon-test-controls">
        <button className="dungeon-test-generate" type="button" onClick={() => generate(newSeed())}>Новый уровень ↻</button>
        <form className="dungeon-test-seed" onSubmit={event => { event.preventDefault(); generate(Number(seedInput)); }}>
          <label htmlFor="dungeon-seed">Код карты</label>
          <input id="dungeon-seed" type="number" min="0" max="4294967295" step="1" required
            value={seedInput} onChange={event => setSeedInput(event.target.value)} />
          <button type="submit">Открыть</button>
        </form>
      </div>
      <div className="dungeon-test-stats" aria-label="Состав уровня">
        <span>Комнаты <b>{level.rooms.length}</b></span>
        <span>Тупики <b>{level.deadEnds.length}</b></span>
        <span>Враги <b>{enemies}</b></span>
        <span>Сундуки <b>{chests}</b></span>
        <span>Огни <b>{level.lights.length}</b></span>
        <span className="dungeon-test-entry">Вход <b>1</b></span>
        <span className="dungeon-test-exit">Выход <b>1</b></span>
      </div>
      <div ref={frameRef} className="dungeon-test-frame">
        <canvas ref={canvasRef} width={RENDER_WIDTH} height={RENDER_HEIGHT} role="img"
          tabIndex={0} onClick={clickMap}
          style={{ width: WIDTH * pixelScale, height: HEIGHT * pixelScale }}
          aria-label={`Карта ${level.seed}: ${COLS} на ${ROWS} тайлов. Герой: столбец ${run.hero.x + 1}, строка ${run.hero.y + 1}. Передвижение стрелками, WASD или кликом по полу.`} />
      </div>
      <footer className="dungeon-test-footer">
        <div>
          <p role="status">{error ? 'Не удалось загрузить изображения. Обнови страницу.' : !assets ? 'Загрузка подземелья…' : run.notice || `Карта № ${level.seed} · ${COLS} × ${ROWS} тайлов`}</p>
          <small>Стрелки / WASD или клик по полу · жёлтая обводка — можно начать бой</small>
        </div>
        <button type="button" aria-pressed={showGrid} onClick={() => setShowGrid(value => !value)}>
          {showGrid ? 'Скрыть сетку' : 'Показать сетку'}
        </button>
      </footer>
      {nearby.length > 0 && (
        <div className="dungeon-test-nearby" aria-label="Встречи рядом">
          {nearby.map(entity => <button key={entity.id} type="button"
            onClick={() => dispatch({ type: 'click', cell: entity })}>
            Бой: {ENCOUNTER_NAMES[entity.sprite]}
          </button>)}
        </div>
      )}
    </main>
  );
}
