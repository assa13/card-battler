import { ENTITY_ANIMATIONS } from './dungeonAnimations.js';

// Seeded topology and placements are independent of rendering and gameplay state.
export const COLS = 18;
export const ROWS = 7;
export const ENEMY_SPRITES = ['wolf', 'zombie', 'dark_wized'];
export const COIN_DENSITY = 0.25;
export const NODE_ENEMY_TIERS = {
  base: { primary: 'wolf', primaryType: 'combat_easy', lower: null, lowerType: null },
  event: { primary: 'wolf', primaryType: 'combat_easy', lower: null, lowerType: null },
  combat_easy: { primary: 'wolf', primaryType: 'combat_easy', lower: null, lowerType: null },
  combat_medium: { primary: 'zombie', primaryType: 'combat_medium', lower: 'wolf', lowerType: 'combat_easy' },
  combat_hard: { primary: 'dark_wized', primaryType: 'combat_hard', lower: 'zombie', lowerType: 'combat_medium' },
};
export const DECOR_SPRITES = ['vase_decor', 'stones_decor', 'bones_decor'];
export const ENTITY_URLS = {
  ...Object.fromEntries(['hero', 'chest', 'torch_decor', 'candle', 'coin', 'boss_skeletal_golem', ...ENEMY_SPRITES, ...DECOR_SPRITES]
    .map(name => [name, `./assets/dev/dungeon/entities/${name}.png?v=sector-progression-20260916`])),
  ...Object.fromEntries(Object.entries(ENTITY_ANIMATIONS).map(([name, animation]) => [name, animation.url])),
};
export const CHARACTERS_FIGMA_URL = 'https://www.figma.com/design/zG9zihyiBTJFjR5dVta74Z/card-crawler?node-id=379-5514';
export const isFloor = tile => tile === 'floor' || Boolean(tile?.startsWith('floor_shadow_'));
const key = ({ x, y }) => `${x},${y}`;
const directions = [[1, 0], [0, 1], [0, -1], [-1, 0]];
const INTERIOR_TOP = 1;
const INTERIOR_BOTTOM = ROWS - 3;
const SOUTH_WALL_ROW = ROWS - 2;
const BASE_ROW = ROWS - 1;
const THROAT_ROW = 2;
const INTERIOR_ROWS = Array.from(
  { length: INTERIOR_BOTTOM - INTERIOR_TOP + 1 },
  (_, index) => INTERIOR_TOP + index,
);

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

function boundaryTiles() {
  return Array.from({ length: ROWS }, (_, y) => Array.from({ length: COLS }, (_, x) => {
    if (x === 0) {
      if (y === 0) return 'outerNW';
      if (y === INTERIOR_TOP) return 'pillarTopW';
      if (y === SOUTH_WALL_ROW) return 'outerSW';
      if (y === BASE_ROW) return 'baseW';
      return 'wallLowerW';
    }
    if (x === COLS - 1) {
      if (y === 0) return 'outerNE';
      if (y === INTERIOR_TOP) return 'wallE';
      if (y === SOUTH_WALL_ROW) return 'outerSE';
      if (y === BASE_ROW) return 'baseE';
      return 'wallLowerE';
    }
    return y === 0 ? 'wallN' : y === SOUTH_WALL_ROW ? 'wallS' : y === BASE_ROW ? 'base' : 'floor';
  }));
}

function createPortals(exitCount, entranceY) {
  const entrance = {
    id: 'entrance',
    kind: 'entrance',
    side: entranceY === INTERIOR_TOP ? 'north' : 'south',
    x: 1,
    y: entranceY === INTERIOR_TOP ? 0 : SOUTH_WALL_ROW,
    access: { x: 1, y: entranceY },
  };
  const exits = {
    1: [{ side: 'east', x: COLS - 1, y: THROAT_ROW, access: { x: COLS - 2, y: THROAT_ROW } }],
    2: [
      { side: 'north', x: COLS - 2, y: 0, access: { x: COLS - 2, y: INTERIOR_TOP } },
      { side: 'south', x: COLS - 2, y: SOUTH_WALL_ROW, access: { x: COLS - 2, y: INTERIOR_BOTTOM } },
    ],
    3: [
      { side: 'north', x: COLS - 2, y: 0, access: { x: COLS - 2, y: INTERIOR_TOP } },
      { side: 'east', x: COLS - 1, y: THROAT_ROW, access: { x: COLS - 2, y: THROAT_ROW } },
      { side: 'south', x: COLS - 2, y: SOUTH_WALL_ROW, access: { x: COLS - 2, y: INTERIOR_BOTTOM } },
    ],
  }[exitCount];
  return [entrance, ...exits.map((portal, branchIndex) => ({
    ...portal,
    id: `exit-${branchIndex}`,
    kind: 'exit',
    branchIndex,
  }))];
}

function planTopology(tiles, portals) {
  const start = portals[0].access;
  const exits = portals.filter(portal => portal.kind === 'exit');
  if (!isFloor(tiles[start.y][start.x]) || exits.some(portal => !isFloor(tiles[portal.access.y][portal.access.x]))) return null;
  const floor = tiles.flatMap((row, y) => row.flatMap((tile, x) => isFloor(tile) ? [{ x, y }] : []));
  const seen = new Set([key(start)]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    for (const cell of floorNeighbors(tiles, queue[i])) {
      if (seen.has(key(cell))) continue;
      seen.add(key(cell));
      queue.push(cell);
    }
  }
  if (seen.size !== floor.length) return null;
  const deadEnds = floor.filter(cell => floorNeighbors(tiles, cell).length === 1 &&
    !portals.some(portal => key(portal.access) === key(cell)));
  if (deadEnds.length < 3) return null;
  const routes = exits.map(portal => findPath(tiles, start, portal.access));
  if (routes.some(route => route.length === 0)) return null;
  const route = routes.reduce((longest, candidate) => candidate.length > longest.length ? candidate : longest, []);
  let turns = 0;
  for (let i = 2; i < route.length; i++) {
    if (route[i].x - route[i - 1].x !== route[i - 1].x - route[i - 2].x ||
        route[i].y - route[i - 1].y !== route[i - 1].y - route[i - 2].y) turns++;
  }
  if (route.length < 20 || turns < 6) return null;
  const reserved = new Set(routes.flat().map(key));
  // Reserve each blind branch's approach, but leave its last cell for a chest.
  for (const cell of deadEnds) findPath(tiles, start, cell).slice(0, -1).forEach(step => reserved.add(key(step)));
  const candidates = floor.filter(cell => !reserved.has(key(cell)) &&
    floorNeighbors(tiles, cell).some(neighbor => reserved.has(key(neighbor))));
  // Room for at least two chests, three enemies and two decorations.
  if (candidates.length < 7) return null;
  return { deadEnds, route, routes, reserved, candidates };
}

export function generateDungeon(seed, options = {}) {
  const normalizedSeed = Number(seed) >>> 0;
  const exitCount = Math.max(1, Math.min(3, Number(options.exitCount) || 1));
  const nodeType = options.nodeType || 'combat_easy';
  const isBossLevel = nodeType === 'boss';
  const enemyTier = NODE_ENEMY_TIERS[nodeType] || NODE_ENEMY_TIERS.combat_easy;
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
  function sampleTopology() {
    const widths = Array(integer(4, 5)).fill(2);
    for (let extra = COLS - 2 - (widths.length - 1) - widths.length * 2; extra > 0; extra--) widths[integer(0, widths.length - 1)]++;
    let nextX = 1;
    const rooms = widths.map((width, id) => {
      const shapes = ['open', 'bend', 'bend', 'notch', 'fork', 'stagger'];
      if (width >= 3) shapes.push('island', 'split');
      const room = { id, x: nextX, y: INTERIOR_TOP, width, height: INTERIOR_ROWS.length, shape: pick(shapes) };
      nextX += width + 1;
      return room;
    });
    const tiles = boundaryTiles();
    for (const room of rooms.slice(0, -1)) {
      const x = room.x + room.width;
      const opening = pick(INTERIOR_ROWS);
      for (const y of INTERIOR_ROWS) tiles[y][x] = y === opening ? 'floor' : 'partition';
      // Some connections have two arms, allowing an alternate route around stone.
      if (random() < 0.18) tiles[INTERIOR_TOP + INTERIOR_BOTTOM - opening][x] = 'floor';
    }
    for (const { x, width, shape } of rooms) {
      const right = x + width - 1;
      const side = pick([x, right]);
      if (shape === 'bend' || shape === 'split') {
        const row = pick([2, 3]);
        for (let col = x; col <= right; col++) {
          if (col !== side && (shape !== 'split' || (col !== x && col !== right))) tiles[row][col] = 'partition';
        }
      }
      if (shape === 'notch') tiles[pick([INTERIOR_TOP, INTERIOR_BOTTOM])][side] = 'partition';
      if (shape === 'fork') {
        const row = pick([INTERIOR_TOP, INTERIOR_BOTTOM]);
        for (let col = x; col <= right; col++) if (col !== side) tiles[row][col] = 'partition';
      }
      if (shape === 'island') tiles[pick([2, 3])][integer(x + 1, right - 1)] = 'partition';
      if (shape === 'stagger') {
        tiles[INTERIOR_TOP][side] = 'partition';
        tiles[INTERIOR_BOTTOM][side === x ? right : x] = 'partition';
      }
    }
    // Последняя зона заканчивается единым горлом, затем расходится к 1–3 выходам.
    // Охранник в горле физически перекрывает все ветви без отдельного lock-state.
    const lastRoom = rooms.at(-1);
    for (let x = Math.max(1, lastRoom.x - 1); x <= COLS - 2; x++) tiles[THROAT_ROW][x] = 'floor';
    for (const y of INTERIOR_ROWS) {
      if (y !== THROAT_ROW) tiles[y][COLS - 3] = 'partition';
    }
    const entranceY = pick([INTERIOR_TOP, INTERIOR_BOTTOM].filter(row => isFloor(tiles[row][1])));
    const portals = createPortals(exitCount, entranceY);
    portals.forEach(portal => { tiles[portal.access.y][portal.access.x] = 'floor'; });
    return { tiles, rooms, portals };
  }

  let topology;
  let plan;
  for (let attempt = 0; attempt < 128; attempt++) {
    topology = sampleTopology();
    plan = planTopology(topology.tiles, topology.portals);
    if (plan) break;
  }
  if (!plan) {
    // A validated compact layout bounds generation time even for unlucky seeds.
    const tiles = boundaryTiles();
    ['..#....###......', '..##.#...##.#...', '.....#......#.##', '..#....#....#...'].forEach((row, y) => {
      [...row].forEach((cell, x) => { tiles[y + 1][x + 1] = cell === '.' ? 'floor' : 'partition'; });
    });
    const rooms = [[1, 2], [4, 2], [7, 3], [11, 2], [14, 3]].map(([x, width], id) =>
      ({ id, x, y: INTERIOR_TOP, width, height: INTERIOR_ROWS.length, shape: ['open', 'bend', 'fork', 'bend', 'fork'][id] }));
    tiles[THROAT_ROW][COLS - 3] = 'floor';
    for (const y of INTERIOR_ROWS) {
      if (y !== THROAT_ROW) tiles[y][COLS - 3] = 'partition';
    }
    const portals = createPortals(exitCount, INTERIOR_TOP);
    portals.forEach(portal => { tiles[portal.access.y][portal.access.x] = 'floor'; });
    topology = { tiles, rooms, portals };
    plan = planTopology(tiles, portals);
  }
  const { tiles, rooms, portals } = topology;
  const { deadEnds, route, reserved } = plan;
  const openings = rooms.slice(0, -1).flatMap(room => INTERIOR_ROWS
    .filter(y => isFloor(tiles[y][room.x + room.width]))
    .map(y => ({ x: room.x + room.width, y })));
  for (const room of rooms) {
    room.cells = [];
    for (const y of INTERIOR_ROWS) {
      for (let x = room.x; x < room.x + room.width; x++) {
        if (isFloor(tiles[y][x])) room.cells.push({ x, y });
      }
    }
  }
  for (const y of INTERIOR_ROWS) {
    for (let x = 1; x < COLS - 1; x++) {
      if (!isFloor(tiles[y][x])) tiles[y][x] = isFloor(tiles[y + 1][x]) ? 'wallN' : 'partition';
    }
  }
  for (const portal of portals) {
    tiles[portal.y][portal.x] = portal.side === 'north' ? 'stairsN'
      : portal.side === 'south' ? 'stairsS'
        : portal.side === 'east' ? 'stairsE' : 'stairsW';
  }

  // Select shadows from neighboring stone. Portal cells do not imply a wall shadow.
  for (const y of INTERIOR_ROWS) {
    for (let x = 1; x < COLS - 1; x++) {
      if (!isFloor(tiles[y][x])) continue;
      const north = !isFloor(tiles[y - 1][x]) && tiles[y - 1][x] !== 'stairsN';
      const west = !isFloor(tiles[y][x - 1]);
      const east = !isFloor(tiles[y][x + 1]);
      tiles[y][x] = north ? west ? 'floor_shadow_NW' : east ? 'floor_shadow_NE' : 'floor_shadow_N'
        : west ? 'floor_shadow_W' : east ? 'floor_shadow_E' : 'floor';
    }
  }
  const entities = [{ id: 'hero', kind: 'hero', sprite: 'hero', ...portals[0].access }];
  const occupied = new Set(portals.map(portal => key(portal.access)));
  const candidates = shuffle(plan.candidates);
  function place(kind, sprite, preferred = [], details = {}) {
    const cell = [...preferred, ...candidates].find(candidate => !occupied.has(key(candidate)) && !reserved.has(key(candidate)));
    if (!cell) return false;
    occupied.add(key(cell));
    entities.push({ id: `${kind}-${entities.length}`, kind, sprite, ...cell, ...details });
    return entities.at(-1);
  }
  const guard = {
    id: 'guard',
    kind: 'enemy',
    sprite: options.guardSprite || (isBossLevel ? 'boss_skeletal_golem' : enemyTier.primary),
    enemyName: options.guardEnemyName,
    difficultyType: isBossLevel ? 'boss' : enemyTier.primaryType,
    required: true,
    x: COLS - 3,
    y: THROAT_ROW,
  };
  occupied.add(key(guard));
  entities.push(guard);
  const chestCount = !isBossLevel ? Math.min(integer(2, 3), candidates.length - 4) : 0;
  for (let i = 0; i < chestCount; i++) place('chest', 'chest', shuffle(deadEnds));
  if (!isBossLevel) {
    const freeCells = candidates.filter(cell => !occupied.has(key(cell))).length;
    const enemyCount = Math.min(integer(3, 5), freeCells - 1);
    const lowerCount = enemyTier.lower && random() < Math.min(1, enemyCount * 0.2) ? 1 : 0;
    const sprites = shuffle([
      ...Array(Math.max(0, enemyCount - 1 - lowerCount)).fill(enemyTier.primary),
      ...Array(lowerCount).fill(enemyTier.lower),
    ]);
    for (const sprite of sprites) {
      place('enemy', sprite, [], {
        difficultyType: sprite === enemyTier.lower ? enemyTier.lowerType : enemyTier.primaryType,
      });
    }
  }
  const candle = place('decor', 'candle');
  place('decor', pick(DECOR_SPRITES));

  const blockedForCoins = new Set([...occupied, ...entities.map(key)]);
  const coinCells = shuffle(tiles.flatMap((row, y) => row.flatMap((tile, x) =>
    isFloor(tile) && !blockedForCoins.has(key({ x, y })) ? [{ x, y }] : [])));
  const coins = coinCells.slice(0, Math.floor(coinCells.length * COIN_DENSITY))
    .map((cell, index) => ({ id: `coin-${index}`, sprite: 'coin', value: integer(1, 2), ...cell }));

  const lights = rooms.map((room, index) => {
    const y = index % 2 ? SOUTH_WALL_ROW : 0;
    const choices = Array.from({ length: room.width }, (_, dx) => ({ x: room.x + dx, y }))
      .filter(cell => !portals.some(portal => key(portal) === key(cell)));
    return { id: `torch-${index}`, sprite: 'torch_decor', ...pick(choices), radius: 2.6 };
  });
  if (candle) lights.push({ id: `light-${candle.id}`, entityId: candle.id, sprite: 'candle', x: candle.x, y: candle.y, radius: 1.8 });
  return { seed: normalizedSeed, width: COLS, height: ROWS, tiles, rooms, portals, entities, coins, lights, deadEnds, route, openings };
}
