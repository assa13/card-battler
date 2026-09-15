import test from 'node:test';
import assert from 'node:assert/strict';
import { COLS, ROWS, ENTITY_URLS, ENEMY_SPRITES, generateDungeon, isFloor } from './dungeonGenerator.js';
import { SPRITES } from './dungeonTestMap.js';

const key = ({ x, y }) => `${x},${y}`;

function reachable(level, start, blocked = new Set()) {
  const seen = new Set([key(start)]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const { x, y } = queue[i];
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const cell = { x: x + dx, y: y + dy };
      const tile = level.tiles[cell.y]?.[cell.x];
      if (!tile || !isFloor(tile) || seen.has(key(cell)) || blocked.has(key(cell))) continue;
      seen.add(key(cell));
      queue.push(cell);
    }
  }
  return seen;
}

test('5,000 seeds preserve dimensions, unique placements, portals and connected routes', () => {
  for (let seed = 0; seed < 5000; seed++) {
    const level = generateDungeon(seed);
    const context = `seed ${seed}`;
    assert.equal(level.width, 18, context);
    assert.equal(level.height, 6, context);
    assert.equal(level.tiles.length, ROWS, context);
    for (const row of level.tiles) {
      assert.equal(row.length, COLS, context);
      assert.ok(row.every(tile => tile === '.' || Object.hasOwn(SPRITES, tile)), context);
    }
    assert.equal(level.portals.length, 2, context);
    const entrance = level.portals.filter(portal => portal.kind === 'entrance');
    const exit = level.portals.filter(portal => portal.kind === 'exit');
    assert.equal(entrance.length, 1, context);
    assert.equal(exit.length, 1, context);
    assert.notEqual(key(entrance[0]), key(exit[0]), context);
    assert.equal(level.tiles.flat().filter(tile => tile === 'door').length, 2, context);
    for (const portal of level.portals) {
      assert.equal(level.tiles[portal.y][portal.x], 'door', context);
      assert.ok(isFloor(level.tiles[portal.access.y][portal.access.x]), context);
      assert.equal(Math.abs(portal.x - portal.access.x) + Math.abs(portal.y - portal.access.y), 1, context);
    }
    const heroes = level.entities.filter(entity => entity.kind === 'hero');
    const enemies = level.entities.filter(entity => entity.kind === 'enemy');
    const chests = level.entities.filter(entity => entity.kind === 'chest');
    assert.equal(heroes.length, 1, context);
    assert.equal(key(heroes[0]), key(entrance[0].access), context);
    assert.ok(enemies.length >= 3 && enemies.length <= 5, context);
    assert.ok(chests.length >= 2 && chests.length <= 3, context);
    assert.equal(new Set(level.entities.map(key)).size, level.entities.length, context);
    assert.equal(new Set(level.entities.map(entity => entity.id)).size, level.entities.length, context);
    for (const entity of level.entities) {
      assert.ok(isFloor(level.tiles[entity.y][entity.x]), context);
      assert.ok(Object.hasOwn(ENTITY_URLS, entity.sprite), context);
      assert.notEqual(key(entity), key(exit[0].access), context);
    }
    for (const room of level.rooms) {
      assert.ok(enemies.some(entity => entity.x >= room.x && entity.x < room.x + room.width), context);
    }
    const floorCount = level.tiles.flat().filter(isFloor).length;
    assert.equal(reachable(level, entrance[0].access).size, floorCount, context);
    const blocked = new Set(level.entities.filter(entity => entity.kind !== 'hero').map(key));
    const clearPath = reachable(level, entrance[0].access, blocked);
    assert.ok(clearPath.has(key(exit[0].access)), context);
    for (const entity of level.entities) {
      // Every chest/enemy remains approachable from the shared passage.
      assert.ok([[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) =>
        clearPath.has(key({ x: entity.x + dx, y: entity.y + dy }))), context);
    }
  }
});

test('seed reproduces a complete map, including unsigned boundary values', () => {
  for (const seed of [0, 1, 42, 2147483648, 4294967295]) {
    assert.deepEqual(generateDungeon(seed), generateDungeon(seed));
    assert.equal(generateDungeon(seed).seed, seed);
  }
});

test('generation varies room geometry and uses all supplied enemy types', () => {
  const geometries = new Set();
  const enemies = new Set();
  const roomCounts = new Set();
  for (let seed = 0; seed < 200; seed++) {
    const level = generateDungeon(seed);
    geometries.add(JSON.stringify(level.rooms));
    roomCounts.add(level.rooms.length);
    level.entities.filter(entity => entity.kind === 'enemy').forEach(entity => enemies.add(entity.sprite));
  }
  assert.ok(geometries.size >= 15);
  assert.deepEqual(roomCounts, new Set([2, 3]));
  assert.deepEqual(enemies, new Set(ENEMY_SPRITES));
});
