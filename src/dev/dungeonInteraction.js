import { findPath, isFloor } from './dungeonGenerator.js';

export const cellKey = ({ x, y }) => `${x},${y}`;
export const isAdjacent = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
export const isEncounter = entity => entity.kind === 'enemy' || entity.kind === 'chest';
export const ENCOUNTER_NAMES = {
  wolf: 'Волк', zombie: 'Зомби', dark_wized: 'Тёмный маг',
  boss_skeletal_golem: 'Костяной Король', chest: 'Охрана сундука',
};

export function createDungeonRun(level) {
  const hero = level.entities.find(entity => entity.kind === 'hero');
  return { level, hero: { x: hero.x, y: hero.y }, cleared: [], path: [], encounter: null, notice: '' };
}

export function visibleEntities(run) {
  return run.level.entities.filter(entity => !run.cleared.includes(entity.id))
    .map(entity => entity.kind === 'hero' ? { ...entity, ...run.hero } : entity);
}

export function adjacentTargets(run) {
  return visibleEntities(run).filter(entity => isEncounter(entity) && isAdjacent(run.hero, entity));
}

export function canWalkTo(run, cell) {
  return isFloor(run.level.tiles[cell.y]?.[cell.x]) && !visibleEntities(run)
    .some(entity => entity.kind !== 'hero' && cellKey(entity) === cellKey(cell));
}

export function dungeonRunReducer(run, action) {
  if (action.type === 'reset') return createDungeonRun(action.level);
  if (action.type === 'battle-result') {
    if (run.encounter?.id !== action.id) return run;
    return { ...run, encounter: null, path: [],
      cleared: action.victory ? [...run.cleared, action.id] : run.cleared,
      notice: action.victory ? 'Победа. Можно продолжать путь.' : 'Ты вернулся на карту. Встреча остаётся на месте.' };
  }
  if (run.encounter) return run;
  if (action.type === 'step') {
    if (Math.abs(action.dx) + Math.abs(action.dy) !== 1) return run;
    const target = { x: run.hero.x + action.dx, y: run.hero.y + action.dy };
    return canWalkTo(run, target) ? { ...run, hero: target, path: [], notice: '' } : { ...run, path: [] };
  }
  if (action.type === 'tick') {
    const next = run.path[0];
    if (!next || !isAdjacent(run.hero, next) || !canWalkTo(run, next)) return { ...run, path: [] };
    return { ...run, hero: next, path: run.path.slice(1) };
  }
  if (action.type === 'click') {
    const entity = visibleEntities(run).find(item => item.kind !== 'hero' && cellKey(item) === cellKey(action.cell));
    if (entity && isEncounter(entity)) {
      if (!isAdjacent(run.hero, entity)) return { ...run, path: [], notice: 'Подойди к объекту на соседнюю клетку, затем нажми на него.' };
      return { ...run, path: [], encounter: {
        ...entity,
        title: ENCOUNTER_NAMES[entity.sprite],
        enemyName: entity.kind === 'chest' ? 'Зомби' : ENCOUNTER_NAMES[entity.sprite],
      }, notice: '' };
    }
    if (!canWalkTo(run, action.cell)) return { ...run, path: [], notice: 'Здесь пройти нельзя.' };
    const blocked = new Set(visibleEntities(run).filter(item => item.kind !== 'hero').map(cellKey));
    const path = findPath(run.level.tiles, run.hero, action.cell, blocked).slice(1);
    return { ...run, path, notice: path.length || cellKey(run.hero) === cellKey(action.cell) ? '' : 'Нет свободного пути.' };
  }
  return run;
}
