import { useEffect, useRef, useState } from 'react';
import { ATLAS_URL, FIGMA_URL, COLS, ROWS, LEVELS } from './dungeonTestMap.js';
import { WIDTH, HEIGHT, createDungeonRenderer } from './dungeonRenderer.js';
import './DungeonTest.css';

export default function DungeonTest() {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const [atlas, setAtlas] = useState(null);
  const [error, setError] = useState(false);
  const [pixelScale, setPixelScale] = useState(1);
  const [showGrid, setShowGrid] = useState(false);
  const [levelIndex, setLevelIndex] = useState(1);
  const level = LEVELS[levelIndex];

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      setPixelScale(Math.max(1, Math.min(2, Math.floor(entry.contentRect.width / WIDTH))));
    });
    observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const image = new Image();
    image.onload = () => setAtlas(image);
    image.onerror = () => setError(true);
    image.src = ATLAS_URL;
    return () => { image.onload = null; image.onerror = null; };
  }, []);

  useEffect(() => {
    if (!atlas) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) createDungeonRenderer(ctx, atlas, level.tiles)({ showGrid });
  }, [atlas, showGrid, level]);

  return (
    <main className="dungeon-test">
      <header className="dungeon-test-header">
        <div>
          <p className="dungeon-test-eyebrow">Тестовый уровень · тайлсет из Figma</p>
          <h1>{level.title}</h1>
        </div>
        <nav aria-label="Материалы уровня">
          <a href={ATLAS_URL} target="_blank" rel="noreferrer">Тайлсет ↗</a>
          <a href={FIGMA_URL} target="_blank" rel="noreferrer">Figma ↗</a>
          <a href="#">К игре ↗</a>
        </nav>
      </header>
      <div className="dungeon-test-levels" role="group" aria-label="Выбор уровня">
        {LEVELS.map((item, index) => (
          <button key={item.id} type="button" aria-pressed={levelIndex === index}
            onClick={() => setLevelIndex(index)}>
            {String(index + 1).padStart(2, '0')} · {item.title}
          </button>
        ))}
      </div>
      <div ref={frameRef} className="dungeon-test-frame">
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT}
          style={{ width: WIDTH * pixelScale, height: HEIGHT * pixelScale }}
          aria-label={`${level.title}. ${level.description}`} />
      </div>
      <footer className="dungeon-test-footer">
        <div>
          <p role="status">{error ? 'Не удалось загрузить тайлсет. Обнови страницу.' : !atlas ? 'Загрузка тайлсета…' : level.description}</p>
          <small>{COLS} × {ROWS} клеток · квадратные тайлы · 2.5D, вид сверху</small>
        </div>
        <button type="button" aria-pressed={showGrid} onClick={() => setShowGrid(value => !value)}>
          {showGrid ? 'Скрыть сетку' : 'Показать сетку'}
        </button>
      </footer>
    </main>
  );
}

