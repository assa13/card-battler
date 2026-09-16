import test from 'node:test';
import assert from 'node:assert/strict';
import { atDungeonPortal, createSectorDungeon, getDungeonEncounter, sectorDungeonReducer, selectEncounterRoster } from './sectorDungeonState.js';
import { findPath, floorNeighbors } from '../dev/dungeonGenerator.js';
import { cellKey, visibleEntities } from '../dev/dungeonInteraction.js';

function approach(run, entity) {
  const blocked = new Set(visibleEntities(run).filter(item => item.kind !== 'hero').map(cellKey));
  const cell = floorNeighbors(run.level.tiles, entity).find(candidate =>
    !blocked.has(cellKey(candidate)) && findPath(run.level.tiles, run.hero, candidate, blocked).length);
  assert.ok(cell);
  return { ...run, hero: cell };
}

test('every enemy miniature requires its own enemy, including when absent from the sector pool', () => {
  const seen = new Set();
  for (let seed = 0; seed < 100; seed++) {
    const run = createSectorDungeon(seed);
    for (const entity of run.level.entities.filter(item => item.kind === 'enemy')) {
      const active = sectorDungeonReducer(approach(run, entity), { type: 'click', cell: entity });
      const encounter = getDungeonEncounter(active);
      assert.ok(encounter.stage >= 1 && encounter.stage <= 5);
      assert.notEqual(encounter.type, 'event');
      seen.add(encounter.requiredEnemy);
      for (const pool of [['Зомби'], ['Бандит', 'Тёмный маг'], ['Орк', 'Зомби', 'Волк']]) {
        for (const count of [1, 2, 3]) {
          const roster = selectEncounterRoster(pool, count, encounter.requiredEnemy, () => 0.4);
          assert.equal(roster.length, count);
          assert.ok(roster.includes(encounter.requiredEnemy));
          assert.ok(roster.every(name => name === encounter.requiredEnemy || pool.includes(name)));
        }
      }
    }
  }
  assert.deepEqual(seen, new Set(['Волк', 'Зомби', 'Тёмный маг', 'Костяной Король']));
  assert.deepEqual(selectEncounterRoster(['Зомби'], 3, 'Волк', () => 0), ['Волк', 'Зомби', 'Зомби']);
});

test('exit stairs allow leaving an uncleared sector and lock repeated transitions', () => {
  for (const seed of [0, 1, 8, 42, 4294967295]) {
    let run = createSectorDungeon(seed);
    assert.ok(atDungeonPortal(run, 'entrance'));
    const exit = run.level.portals.find(portal => portal.kind === 'exit');
    run = sectorDungeonReducer(run, { type: 'click', cell: exit });
    let steps = 0;
    while (run.path.length) {
      run = sectorDungeonReducer(run, { type: 'tick' });
      assert.ok(++steps < 108);
    }
    assert.ok(atDungeonPortal(run, 'exit'));
    assert.equal(run.exiting, true);
    assert.deepEqual(run.cleared, []);
    assert.ok(visibleEntities(run).some(entity => entity.kind === 'enemy'));
    assert.equal(sectorDungeonReducer(run, { type: 'step', dx: -1, dy: 0 }), run);
    const fresh = createSectorDungeon(seed + 1);
    assert.ok(!fresh.exiting);
    assert.ok(atDungeonPortal(fresh, 'entrance'));
  }
});

test('chests open a bonus event without selecting an enemy and clear after the choice', () => {
  let run = createSectorDungeon(42);
  const chest = run.level.entities.find(entity => entity.kind === 'chest');
  run = sectorDungeonReducer(approach(run, chest), { type: 'click', cell: chest });
  assert.equal(getDungeonEncounter(run).type, 'event');
  assert.equal(getDungeonEncounter(run).requiredEnemy, null);
  assert.ok(visibleEntities(run).some(entity => entity.id === chest.id));
  assert.equal(sectorDungeonReducer(run, { type: 'step', dx: 1, dy: 0 }), run);
  const complete = sectorDungeonReducer(run, { type: 'battle-result', id: chest.id, victory: true });
  assert.ok(!visibleEntities(complete).some(entity => entity.id === chest.id));
  assert.deepEqual(complete.hero, run.hero);
  assert.equal(complete.level, run.level);
});

test('winning any encounter, including a boss, returns to the same map and removes only that encounter', () => {
  const base = createSectorDungeon(1);
  for (const enemy of base.level.entities.filter(entity => entity.kind === 'enemy')) {
    const active = sectorDungeonReducer(approach(base, enemy), { type: 'click', cell: enemy });
    const won = sectorDungeonReducer(active, { type: 'battle-result', id: enemy.id, victory: true });
    assert.equal(won.level, base.level);
    assert.deepEqual(won.hero, active.hero);
    assert.deepEqual(won.cleared, [enemy.id]);
    assert.equal(won.encounter, null);
    assert.ok(!won.exiting);
    const failed = sectorDungeonReducer(active, { type: 'battle-result', id: enemy.id, victory: false });
    assert.deepEqual(failed.cleared, []);
  }
});
