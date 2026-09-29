import EnemyDifficultyTooltip from '../ui/EnemyDifficultyTooltip';
import SmallIconText from '../ui/SmallIconText';
import GameIcon from '../ui/GameIcon';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ATLAS_URL } from './dungeonTestMap.js';
import { COLS, ROWS, ENTITY_URLS } from './dungeonGenerator.js';
import {
  RENDER_HEIGHT,
  RENDER_PADDING,
  RENDER_WIDTH,
  createDungeonRenderer,
} from './dungeonRenderer.js';
import { adjacentTargets, visibleCoins, visibleEntities, ENCOUNTER_NAMES } from './dungeonInteraction.js';
import './DungeonTest.css';

export default function DungeonMap({
  run,
  dispatch,
  branches = [],
  sector = 1,
  stage = 1,
  locationTint = null,
  onEncounter,
  onChest,
  onExit,
  onCoinsCollected,
}) {
  const canvasRef = useRef(null);
  const [assets, setAssets] = useState(null);
  const [assetError, setAssetError] = useState(false);
  const assetManifest = JSON.stringify({ atlas: ATLAS_URL, ...ENTITY_URLS });
  const level = useMemo(() => ({
    ...run.level,
    entities: visibleEntities(run),
    coins: visibleCoins(run),
    locationTint,
  }), [run, locationTint]);
  const nearby = useMemo(() => adjacentTargets(run), [run]);
  const highlightedIds = useMemo(() => new Set(nearby.map(entity => entity.id)), [nearby]);
  const handledEncounterRef = useRef(null);
  const handledChestRef = useRef(null);
  const handledExitRef = useRef(null);

  useEffect(() => {
    if (!run.encounter) {
      handledEncounterRef.current = null;
      return;
    }
    if (handledEncounterRef.current === run.encounter.id) return;
    handledEncounterRef.current = run.encounter.id;
    onEncounter?.(run.encounter);
  }, [onEncounter, run.encounter]);

  useEffect(() => {
    if (!run.chest) {
      handledChestRef.current = null;
      return;
    }
    if (handledChestRef.current === run.chest.id) return;
    handledChestRef.current = run.chest.id;
    onChest?.(run.chest);
  }, [onChest, run.chest]);

  useEffect(() => {
    if (!run.exit) {
      handledExitRef.current = null;
      return;
    }
    const exitKey = `${run.level.seed}:${run.exit.id}`;
    if (handledExitRef.current === exitKey) return;
    handledExitRef.current = exitKey;
    onExit?.(run.exit);
  }, [onExit, run.exit, run.level.seed]);

  useEffect(() => {
    onCoinsCollected?.(run.collectedCoins, run.level.coins || []);
  }, [onCoinsCollected, run.collectedCoins, run.level.coins]);

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
      .catch(() => { if (active) setAssetError(true); });
    return () => { active = false; };
  }, [assetManifest]);

  useEffect(() => {
    if (!assets || Object.keys(ENTITY_URLS).some(name => !assets[name])) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const render = createDungeonRenderer(ctx, assets.atlas, level, assets);
    let frameId;
    let lastDraw = -Infinity;
    const animate = timestamp => {
      if (timestamp - lastDraw >= 1000 / 30) {
        render({ time: timestamp / 1000, highlightedIds });
        lastDraw = timestamp;
      }
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [assets, level, highlightedIds]);

  useEffect(() => {
    if (!run.path.length || run.encounter || run.chest || run.exit) return;
    const timer = setTimeout(() => dispatch({ type: 'tick' }), 130);
    return () => clearTimeout(timer);
  }, [dispatch, run.path, run.encounter, run.chest, run.exit]);

  useEffect(() => {
    if (run.encounter || run.chest || run.exit) return;
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
  }, [dispatch, run.encounter, run.chest, run.exit]);

  function clickMap(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const sourceX = (event.clientX - rect.left) / rect.width * RENDER_WIDTH - RENDER_PADDING;
    const sourceY = (event.clientY - rect.top) / rect.height * RENDER_HEIGHT - RENDER_PADDING;
    const cell = {
      x: Math.floor(sourceX / (RENDER_WIDTH - RENDER_PADDING * 2) * COLS),
      y: Math.floor(sourceY / (RENDER_HEIGHT - RENDER_PADDING * 2) * ROWS),
    };
    event.currentTarget.focus();
    dispatch({ type: 'click', cell });
  }

  return (
    <div className="dungeon-map-only" data-asset-error={assetError || undefined}>
      <div className="dungeon-map-stage" style={{ aspectRatio: `${RENDER_WIDTH} / ${RENDER_HEIGHT}` }}>
        <canvas ref={canvasRef} width={RENDER_WIDTH} height={RENDER_HEIGHT} role="img"
          tabIndex={0} onClick={clickMap}
          aria-label={`Карта подземелья. Герой: столбец ${run.hero.x + 1}, строка ${run.hero.y + 1}. Передвижение стрелками, WASD или кликом.`} />
        {level.entities.filter(entity => entity.kind === 'enemy').map(entity => (
          <button key={entity.id} type="button" className="dungeon-enemy-target enemy-hover-target"
            aria-label={`${entity.enemyName || ENCOUNTER_NAMES[entity.sprite]}. Показать сложность, нажать для нападения.`}
            style={{
              left: `${(RENDER_PADDING + entity.x * (RENDER_WIDTH - RENDER_PADDING * 2) / COLS) / RENDER_WIDTH * 100}%`,
              top: `${(RENDER_PADDING + entity.y * (RENDER_HEIGHT - RENDER_PADDING * 2) / ROWS) / RENDER_HEIGHT * 100}%`,
              width: `${(RENDER_WIDTH - RENDER_PADDING * 2) / COLS / RENDER_WIDTH * 100}%`,
              height: `${(RENDER_HEIGHT - RENDER_PADDING * 2) / ROWS / RENDER_HEIGHT * 100}%`,
            }}
            onClick={() => dispatch({ type: 'click', cell: { x: entity.x, y: entity.y } })}>
            <EnemyDifficultyTooltip name={entity.enemyName || ENCOUNTER_NAMES[entity.sprite]}
              type={entity.difficultyType} sector={sector} stage={stage}
              nearby={highlightedIds.has(entity.id)}
              align={entity.x < 3 ? 'left' : entity.x > COLS - 4 ? 'right' : 'center'} />
          </button>
        ))}
        {(run.popups || []).map(popup => {
          const style = {
            left: `${((RENDER_PADDING + (popup.x + 0.5) * (RENDER_WIDTH - RENDER_PADDING * 2) / COLS) / RENDER_WIDTH) * 100}%`,
            top: `${((RENDER_PADDING + (popup.y + 0.5) * (RENDER_HEIGHT - RENDER_PADDING * 2) / ROWS) / RENDER_HEIGHT) * 100}%`,
          };
          const dismiss = () => dispatch({ type: 'dismiss-popup', id: popup.id });
          if (popup.kind === 'item') {
            return (
              <span key={popup.id} className="dungeon-item-popup" style={style}
                onAnimationEnd={dismiss}>
                <img src={popup.image} alt={popup.name || 'Предмет из сундука'} />
              </span>
            );
          }
          return (
            <span key={popup.id} className="dungeon-coin-popup" style={style}
              onAnimationEnd={dismiss}><SmallIconText>+</SmallIconText>{popup.value}</span>
          );
        })}
        {level.portals.filter(portal => portal.kind === 'exit').map(portal => {
          const branch = branches[portal.branchIndex] || branches[0];
          return (
            <button
              key={portal.id}
              type="button"
              className="dungeon-exit-marker"
              style={{
                left: `${((RENDER_PADDING + (portal.x + 0.5) * (RENDER_WIDTH - RENDER_PADDING * 2) / COLS) / RENDER_WIDTH) * 100}%`,
                top: `${((RENDER_PADDING + (portal.y + 0.5) * (RENDER_HEIGHT - RENDER_PADDING * 2) / ROWS) / RENDER_HEIGHT) * 100}%`,
              }}
              aria-label={branch?.label || 'Выход'}
              onClick={event => {
                event.stopPropagation();
                dispatch({ type: 'click', cell: { x: portal.x, y: portal.y } });
              }}
            >
              <GameIcon name={branch?.type || 'exit'} size={32} />
              <span role="tooltip" className="dungeon-exit-tooltip">
                {branch?.label || 'Следующая ветвь'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
