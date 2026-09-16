import { generateDungeon, findPath } from '../dev/dungeonGenerator.js';
import { createDungeonRun, dungeonRunReducer, cellKey } from '../dev/dungeonInteraction.js';

export function createSectorDungeon(seed = crypto.getRandomValues(new Uint32Array(1))[0]) {
  return createDungeonRun(generateDungeon(seed));
}

export function atDungeonPortal(run, kind) {
  const portal = run.level.portals.find(item => item.kind === kind);
  return cellKey(run.hero) === cellKey(portal.access);
}

export function sectorDungeonReducer(run, action) {
  if (run.exiting && action.type !== 'reset') return run;
  // Clicking the stairs walks to their approach. Arrival is enough to leave;
  // remaining enemies and chests never gate the next sector.
  const exit = run.level.portals.find(portal => portal.kind === 'exit');
  const nextAction = action.type === 'click' && cellKey(action.cell) === cellKey(exit)
    ? { ...action, cell: exit.access } : action;
  const next = dungeonRunReducer(run, nextAction);
  return !next.encounter && atDungeonPortal(next, 'exit')
    ? { ...next, path: [], exiting: true } : next;
}

export function getDungeonEncounter(run) {
  const encounter = run.encounter;
  if (!encounter) return null;
  const entrance = run.level.portals.find(portal => portal.kind === 'entrance');
  const distance = findPath(run.level.tiles, entrance.access, encounter).length - 1;
  const stage = Math.max(1, Math.min(5, Math.ceil(distance / (run.level.route.length - 1) * 5)));
  return {
    id: `dungeon_${run.level.seed}_${encounter.id}`,
    stage,
    type: encounter.kind === 'chest' ? 'event'
      : encounter.sprite === 'boss_skeletal_golem' ? 'boss'
        : stage <= 1 ? 'combat_easy' : stage <= 3 ? 'combat_medium' : 'combat_hard',
    requiredEnemy: encounter.kind === 'enemy' ? encounter.enemyName : null,
  };
}

// Preserve the visible enemy even when the sector's normal pool excludes it.
// Companions still come from that pool, so the miniature need not depict everyone.
export function selectEncounterRoster(pool, count, requiredEnemy, random = Math.random) {
  const candidates = [...new Set(pool)].filter(name => name !== requiredEnemy);
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  return Array.from({ length: Math.max(1, count) }, (_, index) =>
    index === 0 || !candidates.length ? requiredEnemy : candidates[(index - 1) % candidates.length]);
}
