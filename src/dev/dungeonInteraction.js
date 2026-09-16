import { findPath, isFloor } from './dungeonGenerator.js';

export const cellKey = ({ x, y }) => `${x},${y}`;
export const isAdjacent = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
export const isEncounter = entity => entity.kind === 'enemy' || (entity.kind === 'chest' && !entity.opened);
export const ENCOUNTER_NAMES = {
  wolf: 'Волк', zombie: 'Зомби', dark_wized: 'Тёмный маг',
  boss_worm: 'Червь', boss_eye: 'Глаз',
  boss_skeletal_golem: 'Костяной Король', chest: 'Охрана сундука',
};

export function createDungeonRun(level) {
  const hero = level.entities.find(entity => entity.kind === 'hero');
  return {
    level,
    hero: { x: hero.x, y: hero.y },
    cleared: [],
    openedChests: [],
    collectedCoins: [],
    goldCollected: 0,
    popups: [],
    path: [],
    encounter: null,
    chest: null,
    exit: null,
    notice: '',
  };
}

export function visibleEntities(run) {
  return run.level.entities.filter(entity => !run.cleared.includes(entity.id))
    .map(entity => {
      if (entity.kind === 'hero') return { ...entity, ...run.hero };
      if (entity.kind === 'chest' && (run.openedChests || []).includes(entity.id)) {
        return { ...entity, opened: true };
      }
      return entity;
    });
}

export function visibleCoins(run) {
  return (run.level.coins || []).filter(coin => !run.collectedCoins.includes(coin.id));
}

export function adjacentTargets(run) {
  return visibleEntities(run).filter(entity => isEncounter(entity) && isAdjacent(run.hero, entity));
}

export function canWalkTo(run, cell) {
  return isFloor(run.level.tiles[cell.y]?.[cell.x]) && !visibleEntities(run)
    .some(entity => entity.kind !== 'hero' && cellKey(entity) === cellKey(cell));
}

function moveHero(run, hero, path = []) {
  const coin = visibleCoins(run).find(item => cellKey(item) === cellKey(hero));
  const exit = run.level.portals.find(portal =>
    portal.kind === 'exit' && cellKey(portal.access) === cellKey(hero)) || null;
  return {
    ...run,
    hero,
    path: exit ? [] : path,
    collectedCoins: coin ? [...run.collectedCoins, coin.id] : run.collectedCoins,
    goldCollected: run.goldCollected + (coin?.value || 0),
    popups: coin ? [...(run.popups || []), {
      id: `coin:${coin.id}`,
      kind: 'coin',
      x: coin.x,
      y: coin.y,
      value: coin.value,
    }] : run.popups,
    exit,
    notice: coin ? `Монета: +${coin.value} золота.` : '',
  };
}

export function dungeonRunReducer(run, action) {
  if (action.type === 'reset') return createDungeonRun(action.level);
  if (action.type === 'consume-exit') return { ...run, exit: null };
  if (action.type === 'dismiss-popup') {
    const currentPopups = run.popups || [];
    const popups = currentPopups.filter(popup => popup.id !== action.id);
    return popups.length === currentPopups.length ? run : { ...run, popups };
  }
  if (action.type === 'chest-result') {
    if (run.chest?.id !== action.id) return run;
    return {
      ...run,
      chest: null,
      openedChests: [...(run.openedChests || []), action.id],
      popups: action.itemImage ? [...(run.popups || []), {
        id: `item:${action.id}`,
        kind: 'item',
        x: run.chest.x,
        y: run.chest.y,
        image: action.itemImage,
        name: action.itemName,
      }] : run.popups,
      notice: action.itemName ? `В сундуке: ${action.itemName}.` : 'Сундук открыт.',
    };
  }
  if (action.type === 'battle-result') {
    if (run.encounter?.id !== action.id) return run;
    return { ...run, encounter: null, path: [], popups: [],
      cleared: action.victory ? [...run.cleared, action.id] : run.cleared,
      notice: action.victory ? 'Победа. Можно продолжать путь.' : 'Ты вернулся на карту. Встреча остаётся на месте.' };
  }
  if (run.encounter || run.chest) return run;
  if (action.type === 'step') {
    if (Math.abs(action.dx) + Math.abs(action.dy) !== 1) return run;
    const target = { x: run.hero.x + action.dx, y: run.hero.y + action.dy };
    return canWalkTo(run, target) ? moveHero(run, target) : { ...run, path: [] };
  }
  if (action.type === 'tick') {
    const next = run.path[0];
    if (!next || !isAdjacent(run.hero, next) || !canWalkTo(run, next)) return { ...run, path: [] };
    return moveHero(run, next, run.path.slice(1));
  }
  if (action.type === 'click') {
    const entity = visibleEntities(run).find(item => item.kind !== 'hero' && cellKey(item) === cellKey(action.cell));
    if (entity && isEncounter(entity)) {
      if (!isAdjacent(run.hero, entity)) return { ...run, path: [], notice: 'Подойди к объекту на соседнюю клетку, затем нажми на него.' };
      if (entity.kind === 'chest') {
        return { ...run, path: [], chest: entity, notice: '' };
      }
      return { ...run, path: [], popups: [], encounter: {
        ...entity,
        title: entity.enemyName || ENCOUNTER_NAMES[entity.sprite],
        enemyName: entity.enemyName || ENCOUNTER_NAMES[entity.sprite],
      }, notice: '' };
    }
    if (!canWalkTo(run, action.cell)) return { ...run, path: [], notice: 'Здесь пройти нельзя.' };
    const blocked = new Set(visibleEntities(run).filter(item => item.kind !== 'hero').map(cellKey));
    const path = findPath(run.level.tiles, run.hero, action.cell, blocked).slice(1);
    return { ...run, path, notice: path.length || cellKey(run.hero) === cellKey(action.cell) ? '' : 'Нет свободного пути.' };
  }
  return run;
}
