// Existing gameplay order is unchanged; the three environments repeat by cycle.
export const SECTOR_THEMES = [
  { key: 'cemetery', name: 'Кладбище', image: 'cemetery.png', description: 'Босс: Червь.' },
  { key: 'torture', name: 'Пыточные', image: 'torture.png', description: 'Босс: Глаз.' },
  { key: 'rich-dungeon', name: 'Богатое подземелье', image: 'rich-dungeon.png', description: 'Босс: Костяной Король.' },
];

// Original room centers from Figma 512:5614; no spacing multiplier.
const POSITIONS = [[984, 520], [1275, 726], [1570, 920], [1881, 726], [2170, 520], [2433, 334], [1570, 1244], [1570, 1577]];
export const SECTOR_MAP_LINKS = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 6], [6, 7]];
export const ROOM_SIZE = 552;
export const FOCUSED_ROOM_SIZE = 748;

export function createSectorChoices(currentSector, maxSectorReached, maxSectorCompleted) {
  const cycleStart = Math.floor((Math.max(1, currentSector) - 1) / 3) * 3 + 1;
  return POSITIONS.map(([x, y], index) => {
    const theme = SECTOR_THEMES[index];
    const sector = theme ? cycleStart + index : null;
    const locked = sector == null || sector > maxSectorReached;
    const completed = sector != null && sector <= maxSectorCompleted;
    return {
      id: index, x, y, sector, locked, completed,
      image: locked ? 'locked-room.png' : theme.image,
      name: theme?.name || 'Неизвестный сектор',
      status: locked ? 'Заблокирован' : completed ? 'Пройдено' : sector === currentSector ? 'Текущий' : 'Доступен',
      description: !theme ? 'Новая область пока недоступна.' : locked ? 'Пройдите предыдущий сектор.'
        : sector > 3 ? 'Босс: Костяной Король.' : theme.description,
    };
  });
}

export function layoutSectorChoices(rooms, focusedId, expanded = false) {
  const focus = rooms.find(room => room.id === focusedId) || rooms[0];
  const visits = new Map([[focus.id, { distance: 0, branch: null }]]);
  const queue = [focus.id];
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index];
    for (const [a, b] of SECTOR_MAP_LINKS) {
      const next = a === id ? b : b === id ? a : null;
      if (next == null || visits.has(next)) continue;
      const parent = visits.get(id);
      visits.set(next, { distance: parent.distance + 1, branch: parent.branch ?? next });
      queue.push(next);
    }
  }
  return rooms.map(room => {
    const visit = visits.get(room.id);
    const distance = visit?.distance ?? Infinity;
    const branch = rooms.find(candidate => candidate.id === visit?.branch);
    const dx = branch ? branch.x - focus.x : 0;
    const dy = branch ? branch.y - focus.y : 0;
    const length = Math.hypot(dx, dy) || 1;
    const push = expanded && distance > 0 ? (FOCUSED_ROOM_SIZE - ROOM_SIZE) / 2 : 0;
    return {
      ...room, distance,
      centerX: 1600 + room.x - focus.x + dx / length * push,
      centerY: 900 + room.y - focus.y + dy / length * push,
      size: expanded && room.id === focus.id ? FOCUSED_ROOM_SIZE : ROOM_SIZE,
      blur: distance > 2 ? 16 : distance > 1 ? 6 : 0,
      opacity: distance > 2 ? 0.5 : 1,
    };
  });
}

export function canEnterSector(target, maxSectorReached) {
  return Number.isInteger(target) && target >= 1 && target <= maxSectorReached;
}
