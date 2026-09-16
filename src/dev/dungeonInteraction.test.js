import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDungeon, findPath, floorNeighbors } from './dungeonGenerator.js';
import { adjacentTargets, canWalkTo, cellKey, createDungeonRun, dungeonRunReducer, isAdjacent, visibleEntities } from './dungeonInteraction.js';
import { AMBIENT_LIGHT, torchFlicker } from './dungeonLighting.js';

test('steps stop at walls, objects and map borders; diagonal moves are rejected', () => {
  const level = generateDungeon(0);
  for (const row of level.tiles.keys()) {
    for (let x = 0; x < level.width; x++) {
      const run = { ...createDungeonRun(level), hero: { x, y: row } };
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const cell = { x: x + dx, y: row + dy };
        const next = dungeonRunReducer(run, { type: 'step', dx, dy });
        assert.deepEqual(next.hero, canWalkTo(run, cell) ? cell : run.hero);
      }
      assert.equal(dungeonRunReducer(run, { type: 'step', dx: 1, dy: 1 }), run);
    }
  }
});

test('click-to-walk follows the free route one adjacent cell at a time', () => {
  let run = createDungeonRun(generateDungeon(42));
  const target = run.level.portals[1].access;
  run = dungeonRunReducer(run, { type: 'click', cell: target });
  assert.ok(run.path.length > 0);
  let steps = 0;
  while (run.path.length) {
    const previous = run.hero;
    run = dungeonRunReducer(run, { type: 'tick' });
    assert.ok(isAdjacent(previous, run.hero));
    assert.ok(++steps < 108);
  }
  assert.deepEqual(run.hero, target);
});

test('both enemy and chest require orthogonal adjacency, launch battle, and clear only on victory', () => {
  const level = generateDungeon(0);
  for (const kind of ['enemy', 'chest']) {
    let run = createDungeonRun(level);
    const target = visibleEntities(run).find(entity => entity.kind === kind);
    const farRun = { ...run, hero: { x: 0, y: 0 } };
    assert.equal(dungeonRunReducer(farRun, { type: 'click', cell: target }).encounter, null);
    const diagonal = { ...run, hero: { x: target.x - 1, y: target.y - 1 } };
    assert.equal(adjacentTargets(diagonal).some(entity => entity.id === target.id), false);
    const blocked = new Set(visibleEntities(run).filter(entity => entity.kind !== 'hero').map(cellKey));
    const access = floorNeighbors(level.tiles, target).find(cell => !blocked.has(cellKey(cell)) && findPath(level.tiles, run.hero, cell, blocked).length);
    assert.ok(access);
    run = { ...run, hero: access };
    assert.ok(adjacentTargets(run).some(entity => entity.id === target.id));
    run = dungeonRunReducer(run, { type: 'click', cell: target });
    assert.equal(run.encounter.id, target.id);
    assert.ok(run.encounter.enemyName);
    assert.equal(dungeonRunReducer(run, { type: 'step', dx: 1, dy: 0 }), run);
    assert.equal(dungeonRunReducer(run, { type: 'click', cell: level.portals[1].access }), run);
    const cancelled = dungeonRunReducer(run, { type: 'battle-result', id: target.id, victory: false });
    assert.ok(visibleEntities(cancelled).some(entity => entity.id === target.id));
    assert.deepEqual(cancelled.hero, access);
    assert.equal(cancelled.encounter, null);
    const won = dungeonRunReducer(run, { type: 'battle-result', id: target.id, victory: true });
    assert.ok(!visibleEntities(won).some(entity => entity.id === target.id));
    assert.deepEqual(won.hero, access);
    assert.equal(won.level.seed, level.seed);
    assert.equal(dungeonRunReducer(won, { type: 'battle-result', id: target.id, victory: true }), won);
  }
});

test('reset cancels walking and clears encounter progress', () => {
  let run = createDungeonRun(generateDungeon(0));
  run = dungeonRunReducer(run, { type: 'click', cell: run.level.portals[1].access });
  const next = dungeonRunReducer(run, { type: 'reset', level: generateDungeon(1) });
  assert.equal(next.level.seed, 1);
  assert.deepEqual(next.path, []);
  assert.deepEqual(next.cleared, []);
  assert.deepEqual(next.hero, next.level.portals[0].access);
});

test('ambient level drops by 12.5%; fast flicker remains bounded and independent', () => {
  assert.equal(AMBIENT_LIGHT / 0.82, 0.875);
  const first = { x: 2, y: 0 };
  const second = { x: 7, y: 4 };
  let crossings = 0;
  let min = 1;
  let max = 1;
  let previous = torchFlicker(first, 0) - 1;
  for (let i = 1; i <= 300; i++) {
    const value = torchFlicker(first, i / 100);
    assert.ok(value >= 0.82 && value <= 1.18);
    min = Math.min(min, value);
    max = Math.max(max, value);
    if ((value - 1) * previous < 0) crossings++;
    previous = value - 1;
  }
  assert.ok(crossings >= 6);
  assert.ok(max - min > 0.25, 'Torch flutter should be visibly stronger than the previous 5%');
  assert.notEqual(torchFlicker(first, 0.4), torchFlicker(second, 0.4));
});
