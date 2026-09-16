import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDungeon, findPath, floorNeighbors } from './dungeonGenerator.js';
import { adjacentTargets, canWalkTo, cellKey, createDungeonRun, dungeonRunReducer, isAdjacent, visibleCoins, visibleEntities } from './dungeonInteraction.js';
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
  const target = run.level.route[5];
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

test('coins are collected once without blocking movement', () => {
  let run = createDungeonRun(generateDungeon(12));
  const coin = visibleCoins(run)[0];
  const approach = floorNeighbors(run.level.tiles, coin)[0];
  run = { ...run, hero: approach };
  const dx = coin.x - approach.x;
  const dy = coin.y - approach.y;
  run = dungeonRunReducer(run, { type: 'step', dx, dy });
  assert.ok(run.collectedCoins.includes(coin.id));
  assert.equal(run.goldCollected, coin.value);
  assert.deepEqual(run.popups[0], {
    id: `coin:${coin.id}`,
    kind: 'coin',
    x: coin.x,
    y: coin.y,
    value: coin.value,
  });
  run = dungeonRunReducer(run, { type: 'dismiss-popup', id: `coin:${coin.id}` });
  assert.deepEqual(run.popups, []);
  run = { ...run, hero: approach };
  run = dungeonRunReducer(run, { type: 'step', dx, dy });
  assert.equal(run.goldCollected, coin.value);
  assert.ok(!visibleCoins(run).some(item => item.id === coin.id));
});

test('required guard blocks every exit until victory', () => {
  let run = createDungeonRun(generateDungeon(33, { exitCount: 3, nodeType: 'combat_hard' }));
  const guard = visibleEntities(run).find(entity => entity.required);
  const exits = run.level.portals.filter(portal => portal.kind === 'exit');
  const blocked = new Set(visibleEntities(run).filter(entity => entity.kind !== 'hero').map(cellKey));
  exits.forEach(portal => assert.equal(
    findPath(run.level.tiles, run.hero, portal.access, blocked).length,
    0,
  ));
  const access = floorNeighbors(run.level.tiles, guard)
    .find(cell => findPath(run.level.tiles, run.hero, cell, blocked).length);
  run = { ...run, hero: access };
  run = dungeonRunReducer(run, { type: 'click', cell: guard });
  run = dungeonRunReducer(run, { type: 'battle-result', id: guard.id, victory: true });
  run = dungeonRunReducer(run, { type: 'click', cell: exits[1].access });
  while (run.path.length) run = dungeonRunReducer(run, { type: 'tick' });
  assert.equal(run.exit?.branchIndex, 1);
});

test('enemy requires orthogonal adjacency, launches battle, and clears only on victory', () => {
  const level = generateDungeon(0);
  let run = createDungeonRun(level);
  const target = visibleEntities(run).find(entity => entity.kind === 'enemy');
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
});

test('chest opens without battle, remains visible, and cannot be looted twice', () => {
  const level = generateDungeon(0);
  let run = createDungeonRun(level);
  const chest = visibleEntities(run).find(entity => entity.kind === 'chest');
  const blocked = new Set(visibleEntities(run)
    .filter(entity => entity.kind !== 'hero' && !entity.required)
    .map(cellKey));
  const access = floorNeighbors(level.tiles, chest).find(cell => !blocked.has(cellKey(cell)) && findPath(level.tiles, run.hero, cell, blocked).length);
  assert.ok(access);
  run = { ...run, hero: access };
  run = dungeonRunReducer(run, { type: 'click', cell: chest });
  assert.equal(run.encounter, null);
  assert.equal(run.chest?.id, chest.id);
  assert.equal(dungeonRunReducer(run, { type: 'step', dx: 1, dy: 0 }), run);
  run = dungeonRunReducer(run, {
    type: 'chest-result',
    id: chest.id,
    itemName: 'Редкий меч',
    itemImage: '/items/sword.png',
  });
  assert.equal(run.chest, null);
  assert.equal(visibleEntities(run).find(entity => entity.id === chest.id)?.opened, true);
  assert.ok(!adjacentTargets(run).some(entity => entity.id === chest.id));
  assert.equal(dungeonRunReducer(run, { type: 'click', cell: chest }).chest, null);
  assert.deepEqual(run.popups[0], {
    id: `item:${chest.id}`,
    kind: 'item',
    x: chest.x,
    y: chest.y,
    image: '/items/sword.png',
    name: 'Редкий меч',
  });
  assert.match(run.notice, /Редкий меч/);
});

test('starting a battle clears finished pickup animations', () => {
  const level = generateDungeon(0);
  let run = createDungeonRun(level);
  const enemy = visibleEntities(run).find(entity => entity.kind === 'enemy');
  const blocked = new Set(visibleEntities(run).filter(entity => entity.kind !== 'hero').map(cellKey));
  const access = floorNeighbors(level.tiles, enemy).find(cell => !blocked.has(cellKey(cell)) && findPath(level.tiles, run.hero, cell, blocked).length);
  run = { ...run, hero: access, popups: [{ id: 'coin:old', kind: 'coin', x: 1, y: 1, value: 2 }] };
  run = dungeonRunReducer(run, { type: 'click', cell: enemy });
  assert.deepEqual(run.popups, []);
});

test('reset cancels walking and clears encounter progress', () => {
  let run = createDungeonRun(generateDungeon(0));
  run = dungeonRunReducer(run, { type: 'click', cell: run.level.portals[1].access });
  const next = dungeonRunReducer(run, { type: 'reset', level: generateDungeon(1) });
  assert.equal(next.level.seed, 1);
  assert.deepEqual(next.path, []);
  assert.deepEqual(next.cleared, []);
  assert.deepEqual(next.openedChests, []);
  assert.deepEqual(next.collectedCoins, []);
  assert.equal(next.goldCollected, 0);
  assert.deepEqual(next.popups, []);
  assert.equal(next.chest, null);
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
