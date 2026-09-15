// Seeded topology and placements are independent of rendering and gameplay state.
export const COLS = 18;
export const ROWS = 6;
export const ENEMY_SPRITES = ['wolf', 'zombie', 'dark_wized', 'boss_skeletal_golem'];
export const DECOR_SPRITES = ['vase_decor', 'stones_decor', 'bones_decor'];
export const ENTITY_URLS = Object.fromEntries(['hero', 'chest', 'torch_decor', ...ENEMY_SPRITES, ...DECOR_SPRITES]
  .map(name => [name, `./assets/dev/dungeon/entities/${name}.png?v=transparent-20260915`]));
export const CHARACTERS_FIGMA_URL = 'https://www.figma.com/design/zG9zihyiBTJFjR5dVta74Z/card-crawler?node-id=379-5514';
export const isFloor = tile => tile === 'floor' || Boolean(tile?.startsWith('floor_shadow_'));
const key = ({ x, y }) => `${x},${y}`;
const directions = [[1, 0], [0, 1], [0, -1], [-1, 0]];

function randomSource(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function floorNeighbors(tiles, cell) {
  return directions.map(([dx, dy]) => ({ x: cell.x + dx, y: cell.y + dy }))
    .filter(({ x, y }) => isFloor(tiles[y]?.[x]));
}

export function findPath(tiles, start, end, blocked = new Set()) {
  const queue = [start];
  const parents = new Map([[key(start), null]]);
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i];
    if (key(cell) === key(end)) {
      const path = [];
      for (let step = cell; step; step = parents.get(key(step))) path.push(step);
      return path.reverse();
    }
    for (const next of floorNeighbors(tiles, cell)) {
      if (parents.has(key(next)) || blocked.has(key(next))) continue;
      parents.set(key(next), cell);
      queue.push(next);
    }
  }
  return [];
}

export function generateDungeon(seed) {
  const normalizedSeed = Number(seed) >>> 0;
  const random = randomSource(normalizedSeed);
  const integer = (min, max) => min + Math.floor(random() * (max - min + 1));
  const pick = values => values[integer(0, values.length - 1)];
  const shuffle = values => {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) {
      const j = integer(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };
  const roomCount = integer(4, 5);
  const widths = Array(roomCount).fill(2);
  for (let extra = COLS - 2 - (roomCount - 1) - roomCount * 2; extra > 0; extra--) widths[integer(0, roomCount - 1)]++;
  let nextX = 1;
  const rooms = widths.map((width, index) => {
    const room = { id: index, x: nextX, y: 1, width, height: 3 };
    nextX += width + 1;
    return room;
  });
  const tiles = Array.from({ length: ROWS }, (_, y) => Array.from({ length: COLS }, (_, x) => {
    if (x === 0) return ['outerNW', 'pillarTopW', 'pillarW', 'wallLowerW', 'outerSW', 'baseW'][y];
    if (x === COLS - 1) return ['outerNE', 'wallE', 'pillarE', 'wallLowerE', 'outerSE', 'baseE'][y];
    return y === 0 ? 'wallN' : y === 4 ? 'wallS' : y === 5 ? 'base' : 'floor';
  }));
  const firstOpening = pick([1, 3]);
  const openings = rooms.slice(0, -1).map((room, index) => {
    const x = room.x + room.width;
    const y = index % 2 ? 4 - firstOpening : firstOpening;
    for (let row = 1; row <= 3; row++) tiles[row][x] = row === y ? 'floor' : row === 2 ? 'wallN' : 'partition';
    return { x, y };
  });

  // Two side chambers get a solid cross-wall, leaving a winding route on one side
  // and a real blind branch on the other. The other chambers retain open floor.
  const branchRooms = shuffle(rooms.slice(1, -1)).slice(0, 2);
  for (const room of branchRooms) {
    const verticalX = pick([room.x, room.x + room.width - 1]);
    for (let x = room.x; x < room.x + room.width; x++) {
      if (x !== verticalX) tiles[2][x] = 'wallN';
    }
  }

  const portals = [
    { kind: 'entrance', x: rooms[0].x, y: pick([0, 4]) },
    { kind: 'exit', x: COLS - 2, y: pick([0, 4]) },
  ].map(portal => ({ ...portal, access: { x: portal.x, y: portal.y === 0 ? 1 : 3 } }));
  for (const portal of portals) tiles[portal.y][portal.x] = portal.y === 0 ? 'stairsN' : 'stairsS';

  // Select shadows from neighboring stone. Portal cells do not imply a wall shadow.
  for (let y = 1; y <= 3; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      if (!isFloor(tiles[y][x])) continue;
      const north = !isFloor(tiles[y - 1][x]) && tiles[y - 1][x] !== 'stairsN';
      const west = !isFloor(tiles[y][x - 1]);
      const east = !isFloor(tiles[y][x + 1]);
      tiles[y][x] = north ? west ? 'floor_shadow_NW' : east ? 'floor_shadow_NE' : 'floor_shadow_N'
        : west ? 'floor_shadow_W' : east ? 'floor_shadow_E' : 'floor';
    }
  }
  const floor = tiles.flatMap((row, y) => row.flatMap((tile, x) => isFloor(tile) ? [{ x, y }] : []));
  const deadEnds = floor.filter(cell => floorNeighbors(tiles, cell).length === 1 && !portals.some(portal => key(portal.access) === key(cell)));
  const route = findPath(tiles, portals[0].access, portals[1].access);
  const reserved = new Set(route.map(key));
  // Keep the approach to every blind end open so loot never seals off a branch.
  for (const end of deadEnds) {
    const approach = findPath(tiles, portals[0].access, end).slice(0, -1);
    approach.forEach(cell => reserved.add(key(cell)));
  }
  const entities = [{ id: 'hero', kind: 'hero', sprite: 'hero', ...portals[0].access }];
  const occupied = new Set(portals.map(portal => key(portal.access)));
  const candidates = shuffle(floor.filter(cell => !reserved.has(key(cell)) && !occupied.has(key(cell)) &&
    floorNeighbors(tiles, cell).some(neighbor => reserved.has(key(neighbor)))));
  function place(kind, sprite, preferred = []) {
    const cell = [...preferred, ...candidates].find(candidate => !occupied.has(key(candidate)) && !reserved.has(key(candidate)));
    if (!cell) return false;
    occupied.add(key(cell));
    entities.push({ id: `${kind}-${entities.length}`, kind, sprite, ...cell });
    return true;
  }
  const chestCount = Math.min(integer(2, 3), candidates.length - 4);
  for (let i = 0; i < chestCount; i++) place('chest', 'chest', shuffle(deadEnds));
  const freeCells = candidates.filter(cell => !occupied.has(key(cell))).length;
  const enemyCount = Math.min(integer(3, 5), freeCells - 1);
  for (let i = 0; i < enemyCount; i++) place('enemy', pick(ENEMY_SPRITES));
  for (let i = 0; i < 2; i++) place('decor', pick(DECOR_SPRITES));

  const lights = rooms.map((room, index) => {
    const y = index % 2 ? 4 : 0;
    const choices = Array.from({ length: room.width }, (_, dx) => ({ x: room.x + dx, y }))
      .filter(cell => !portals.some(portal => key(portal) === key(cell)));
    return { id: `torch-${index}`, sprite: 'torch_decor', ...pick(choices), radius: 2.6 };
  });
  return { seed: normalizedSeed, width: COLS, height: ROWS, tiles, rooms, portals, entities, lights, deadEnds, route, openings };
}
