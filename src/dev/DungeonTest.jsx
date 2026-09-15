import { useEffect, useRef, useState } from 'react';
import { ATLAS_URL } from './dungeonTestMap.js';
import { COLS, ROWS, ENTITY_URLS, CHARACTERS_FIGMA_URL, generateDungeon } from './dungeonGenerator.js';
import { WIDTH, HEIGHT, createDungeonRenderer } from './dungeonRenderer.js';
import './DungeonTest.css';

const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];

export default function DungeonTest() {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const [assets, setAssets] = useState(null);
  const [error, setError] = useState(false);
  const [pixelScale, setPixelScale] = useState(1);
  const [showGrid, setShowGrid] = useState(false);
  const [level, setLevel] = useState(() => generateDungeon(newSeed()));
  const [seedInput, setSeedInput] = useState(String(level.seed));
  const enemies = level.entities.filter(entity => entity.kind === 'enemy').length;
  const chests = level.entities.filter(entity => entity.kind === 'chest').length;

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      setPixelScale(Math.max(1, Math.min(2, Math.floor(entry.contentRect.width / WIDTH))));
    });
    observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    const load = url => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
    Promise.all(Object.entries({ atlas: ATLAS_URL, ...ENTITY_URLS }).map(async ([name, url]) => [name, await load(url)]))
      .then(entries => { if (active) setAssets(Object.fromEntries(entries)); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!assets) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) createDungeonRenderer(ctx, assets.atlas, level, assets)({ showGrid });
  }, [assets, showGrid, level]);

  function generate(seed) {
    const next = generateDungeon(seed);
    setLevel(next);
    setSeedInput(String(next.seed));
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
        <span>Враги <b>{enemies}</b></span>
        <span>Сундуки <b>{chests}</b></span>
        <span className="dungeon-test-entry">Вход <b>1</b></span>
        <span className="dungeon-test-exit">Выход <b>1</b></span>
      </div>
      <div ref={frameRef} className="dungeon-test-frame">
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} role="img"
          style={{ width: WIDTH * pixelScale, height: HEIGHT * pixelScale }}
          aria-label={`Карта ${level.seed}: ${COLS} на ${ROWS} тайлов, ${level.rooms.length} комнаты, врагов ${enemies}, сундуков ${chests}. Герой у единственного входа слева, единственный выход справа.`} />
      </div>
      <footer className="dungeon-test-footer">
        <div>
          <p role="status">{error ? 'Не удалось загрузить изображения. Обнови страницу.' : !assets ? 'Загрузка подземелья…' : `Карта № ${level.seed} · ${COLS} × ${ROWS} тайлов`}</p>
          <small>Герой у голубого входа · золотой выход в последней комнате</small>
        </div>
        <button type="button" aria-pressed={showGrid} onClick={() => setShowGrid(value => !value)}>
          {showGrid ? 'Скрыть сетку' : 'Показать сетку'}
        </button>
      </footer>
    </main>
  );
}
