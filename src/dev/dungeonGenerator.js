// Seeded topology and placements are independent of rendering and gameplay state.
export const COLS = 18;
export const ROWS = 6;
export const ENEMY_SPRITES = ['wolf', 'zombie', 'dark_wized', 'boss_skeletal_golem'];
export const DECOR_SPRITES = ['vase_decor', 'stones_decor', 'bones_decor'];
export const ENTITY_URLS = Object.fromEntries(['hero', 'chest', 'torch_decor', 'candle', ...ENEMY_SPRITES, ...DECOR_SPRITES]
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

function boundaryTiles() {
  return Array.from({ length: ROWS }, (_, y) => Array.from({ length: COLS }, (_, x) => {
    if (x === 0) return ['outerNW', 'pillarTopW', 'wallLowerW', 'wallLowerW', 'outerSW', 'baseW'][y];
    if (x === COLS - 1) return ['outerNE', 'wallE', 'wallLowerE', 'wallLowerE', 'outerSE', 'baseE'][y];
    return y === 0 ? 'wallN' : y === 4 ? 'wallS' : y === 5 ? 'base' : 'floor';
  }));
}

function planTopology(tiles, portals) {
  const [start, end] = portals.map(portal => portal.access);
  if (!isFloor(tiles[start.y][start.x]) || !isFloor(tiles[end.y][end.x])) return null;
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
  const route = findPath(tiles, start, end);
  let turns = 0;
  for (let i = 2; i < route.length; i++) {
    if (route[i].x - route[i - 1].x !== route[i - 1].x - route[i - 2].x ||
        route[i].y - route[i - 1].y !== route[i - 1].y - route[i - 2].y) turns++;
  }
  if (route.length < 20 || turns < 6) return null;
  const reserved = new Set(route.map(key));
  // Reserve each blind branch's approach, but leave its last cell for a chest.
  for (const cell of deadEnds) findPath(tiles, start, cell).slice(0, -1).forEach(step => reserved.add(key(step)));
  const candidates = floor.filter(cell => !reserved.has(key(cell)) &&
    floorNeighbors(tiles, cell).some(neighbor => reserved.has(key(neighbor))));
  // Room for at least two chests, three enemies and two decorations.
  if (candidates.length < 7) return null;
  return { deadEnds, route, reserved, candidates };
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
  function sampleTopology() {
    const widths = Array(integer(4, 5)).fill(2);
    for (let extra = COLS - 2 - (widths.length - 1) - widths.length * 2; extra > 0; extra--) widths[integer(0, widths.length - 1)]++;
    let nextX = 1;
    const rooms = widths.map((width, id) => {
      const shapes = ['open', 'bend', 'bend', 'notch', 'fork', 'stagger'];
      if (width >= 3) shapes.push('island', 'split');
      const room = { id, x: nextX, y: 1, width, height: 3, shape: pick(shapes) };
      nextX += width + 1;
      return room;
    });
    const tiles = boundaryTiles();
    for (const room of rooms.slice(0, -1)) {
      const x = room.x + room.width;
      const opening = pick([1, 2, 3]);
      for (let y = 1; y <= 3; y++) tiles[y][x] = y === opening ? 'floor' : 'partition';
      // Some connections have two arms, allowing an alternate route around stone.
      if (opening !== 2 && random() < 0.18) tiles[4 - opening][x] = 'floor';
    }
    for (const { x, width, shape } of rooms) {
      const right = x + width - 1;
      const side = pick([x, right]);
      if (shape === 'bend' || shape === 'split') {
        for (let col = x; col <= right; col++) {
          if (col !== side && (shape !== 'split' || (col !== x && col !== right))) tiles[2][col] = 'partition';
        }
      }
      if (shape === 'notch') tiles[pick([1, 3])][side] = 'partition';
      if (shape === 'fork') {
        const row = pick([1, 3]);
        for (let col = x; col <= right; col++) if (col !== side) tiles[row][col] = 'partition';
      }
      if (shape === 'island') tiles[2][integer(x + 1, right - 1)] = 'partition';
      if (shape === 'stagger') {
        tiles[1][side] = 'partition';
        tiles[3][side === x ? right : x] = 'partition';
      }
    }
    const portals = [
      { kind: 'entrance', x: 1 }, { kind: 'exit', x: COLS - 2 },
    ].map(portal => {
      const y = pick([1, 3].filter(row => isFloor(tiles[row][portal.x])));
      return { ...portal, y: y === 1 ? 0 : 4, access: { x: portal.x, y } };
    });
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
    ['..#....###......', '..##.#...##.#...', '.....#......#.##'].forEach((row, y) => {
      [...row].forEach((cell, x) => { tiles[y + 1][x + 1] = cell === '.' ? 'floor' : 'partition'; });
    });
    const rooms = [[1, 2], [4, 2], [7, 3], [11, 2], [14, 3]].map(([x, width], id) =>
      ({ id, x, y: 1, width, height: 3, shape: ['open', 'bend', 'fork', 'bend', 'fork'][id] }));
    const portals = [{ kind: 'entrance', x: 1 }, { kind: 'exit', x: 16 }]
      .map(portal => ({ ...portal, y: 0, access: { x: portal.x, y: 1 } }));
    topology = { tiles, rooms, portals };
    plan = planTopology(tiles, portals);
  }
  const { tiles, rooms, portals } = topology;
  const { deadEnds, route, reserved } = plan;
  const openings = rooms.slice(0, -1).flatMap(room => [1, 2, 3]
    .filter(y => isFloor(tiles[y][room.x + room.width]))
    .map(y => ({ x: room.x + room.width, y })));
  for (const room of rooms) {
    room.cells = [];
    for (let y = 1; y <= 3; y++) {
      for (let x = room.x; x < room.x + room.width; x++) {
        if (isFloor(tiles[y][x])) room.cells.push({ x, y });
      }
    }
  }
  for (let y = 1; y <= 3; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      if (!isFloor(tiles[y][x])) tiles[y][x] = isFloor(tiles[y + 1][x]) ? 'wallN' : 'partition';
    }
  }
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
  const entities = [{ id: 'hero', kind: 'hero', sprite: 'hero', ...portals[0].access }];
  const occupied = new Set(portals.map(portal => key(portal.access)));
  const candidates = shuffle(plan.candidates);
  function place(kind, sprite, preferred = []) {
    const cell = [...preferred, ...candidates].find(candidate => !occupied.has(key(candidate)) && !reserved.has(key(candidate)));
    if (!cell) return false;
    occupied.add(key(cell));
    entities.push({ id: `${kind}-${entities.length}`, kind, sprite, ...cell });
    return entities.at(-1);
  }
  const chestCount = Math.min(integer(2, 3), candidates.length - 4);
  for (let i = 0; i < chestCount; i++) place('chest', 'chest', shuffle(deadEnds));
  const freeCells = candidates.filter(cell => !occupied.has(key(cell))).length;
  const enemyCount = Math.min(integer(3, 5), freeCells - 1);
  for (let i = 0; i < enemyCount; i++) place('enemy', pick(ENEMY_SPRITES));
  const candle = place('decor', 'candle');
  place('decor', pick(DECOR_SPRITES));

  const lights = rooms.map((room, index) => {
    const y = index % 2 ? 4 : 0;
    const choices = Array.from({ length: room.width }, (_, dx) => ({ x: room.x + dx, y }))
      .filter(cell => !portals.some(portal => key(portal) === key(cell)));
    return { id: `torch-${index}`, sprite: 'torch_decor', ...pick(choices), radius: 2.6 };
  });
  if (candle) lights.push({ id: `light-${candle.id}`, entityId: candle.id, sprite: 'candle', x: candle.x, y: candle.y, radius: 1.8 });
  return { seed: normalizedSeed, width: COLS, height: ROWS, tiles, rooms, portals, entities, lights, deadEnds, route, openings };
}
