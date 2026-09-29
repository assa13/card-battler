import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { parse } from '@babel/parser';
import { createSectorChoices, layoutSectorChoices, canEnterSector, SECTOR_MAP_LINKS } from '../src/sectorSelection.js';
import { hitsRoomAlpha, pickAlphaRoom } from '../src/sectorAlphaHitTest.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const figmaPositions = [[984,520],[1275,726],[1570,920],[1881,726],[2170,520],[2433,334],[1570,1244],[1570,1577]];
for (let sector = 1; sector <= 12; sector++) {
  const rooms = createSectorChoices(sector, sector, sector - 1);
  assert.equal(rooms.length, 8);
  assert.deepEqual(rooms.map(room => [room.x, room.y]), figmaPositions, 'Original spacing must be restored');
  assert(rooms.find(room => room.sector === sector && !room.locked && !room.completed));
  assert.equal(rooms.filter(room => room.sector == null && room.locked).length, 5);
  for (const room of rooms) {
    assert.equal(canEnterSector(room.sector, sector), !room.locked);
    if (room.locked) assert.equal(room.image, 'locked-room.png');
    const ordinary = layoutSectorChoices(rooms, room.id, false);
    const expanded = layoutSectorChoices(rooms, room.id, true);
    const focus = expanded.find(entry => entry.id === room.id);
    assert.deepEqual([focus.centerX, focus.centerY, focus.size, focus.blur, focus.opacity], [1600,900,748,0,1]);
    assert.equal(ordinary.find(entry => entry.id === room.id).size, 552);
    for (const entry of expanded) {
      assert.equal(entry.blur, entry.distance > 2 ? 16 : entry.distance > 1 ? 6 : 0);
      assert.equal(entry.opacity, entry.distance > 2 ? 0.5 : 1);
      assert(Number.isFinite(entry.distance));
      if (entry.id !== room.id) {
        const before = ordinary.find(item => item.id === entry.id);
        assert(Math.abs(Math.hypot(entry.centerX - before.centerX, entry.centerY - before.centerY) - 98) < 0.0001);
      }
    }
    for (const [a,b] of SECTOR_MAP_LINKS) assert.equal(Math.abs(expanded[a].distance-expanded[b].distance),1);
  }
}
for (const invalid of [null, undefined,-1,0,1.5,NaN,Infinity,'2',10]) assert(!canEnterSector(invalid,3));
assert(createSectorChoices(3,3,2).slice(0,2).every(room => room.completed && !room.locked && room.status === 'Пройдено'));
assert(!canEnterSector(3,2), 'Sequential progress must not unlock a parallel branch');

// Transparent foreground pixels must neither hover nor block a visible room behind.
const mask = { width: 2, height: 2, data: new Uint8ClampedArray(16) };
mask.data[7] = 255;
mask.data[11] = 128;
const rect = { left: 100, top: 200, width: 80, height: 80 };
assert(!hitsRoomAlpha(mask, rect, 110, 210));
assert(hitsRoomAlpha(mask, rect, 170, 210));
assert(hitsRoomAlpha(mask, rect, 110, 270));
assert(!hitsRoomAlpha(mask, rect, 180, 210));
assert(!hitsRoomAlpha(mask, rect, 99, 210));
assert(!hitsRoomAlpha(null, rect, 170, 210));
const opaque = { ...mask, data: new Uint8ClampedArray(16).fill(255) };
const candidates = [{ id: 0, mask, rect, zIndex: 20 }, { id: 1, mask: opaque, rect, zIndex: 1 }];
assert.equal(pickAlphaRoom(candidates, 110, 210), 1);
assert.equal(pickAlphaRoom(candidates, 170, 210), 0);
assert.equal(pickAlphaRoom(candidates, 10, 10), null);
assert(hitsRoomAlpha(mask, { left: 300, top: 50, width: 160, height: 160 }, 440, 70));

// Exercise only the route handlers with state setters stubbed; no game, DOM or assets are started.
const app = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
const ast = parse(app, { sourceType: 'module', plugins: ['jsx'] });
const handlers = new Map();
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'VariableDeclarator' && ['startNextSector', 'selectExpeditionSector', 'closeSectorSelection', 'mapPanelNode'].includes(node.id.name)) {
    handlers.set(node.id.name, app.slice(node.init.start, node.init.end));
  }
  for (const [key, value] of Object.entries(node)) {
    if (['loc', 'comments', 'leadingComments', 'trailingComments'].includes(key)) continue;
    if (Array.isArray(value)) value.forEach(visit); else visit(value);
  }
}
visit(ast);
const calls = [];
const context = {
  sectorSelection: { sector: 2, restart: true }, sector: 1, maxSectorReached: 2,
  canEnterSector, playSound: () => {}, retreatInProgressRef: { current: true },
  resetGame: (...args) => calls.push(['reset', ...args]),
  setSectorSelection: value => calls.push(['selection', value]),
  setTavernRested: value => calls.push(['rested', value]),
  setShowTavern: value => calls.push(['tavern', value]),
  setMaxSectorCompleted: updater => calls.push(['completed', updater(0)]),
  setMaxSectorReached: updater => calls.push(['reached', updater(1)]),
};
const handler = name => new Function(...Object.keys(context), 'return (' + handlers.get(name) + ');')(...Object.values(context));
handler('selectExpeditionSector')(3);
assert.equal(calls.length, 0, 'Locked sector must not modify gameplay');
handler('selectExpeditionSector')(2);
assert.deepEqual(calls[0], ['reset', false, false, false, 2]);
assert(calls.some(([key, value]) => key === 'tavern' && value === false));
assert(calls.some(([key, value]) => key === 'rested' && value === false));
calls.length = 0;
handler('closeSectorSelection')();
assert.deepEqual(calls[0], ['reset', false, false, false, 2]);
assert(calls.some(([key, value]) => key === 'tavern' && value === true));
calls.length = 0;
handler('startNextSector')();
assert.deepEqual(calls, [['completed', 1], ['reached', 2], ['selection', { sector: 2, restart: true }]]);
context.sectorSelection = { sector: 1, restart: false };
calls.length = 0;
handler('selectExpeditionSector')(1);
assert(!calls.some(([key]) => key === 'reset'), 'Continuing current sector preserves its level');
calls.length = 0;
handler('closeSectorSelection')();
assert(!calls.some(([key]) => key === 'rested' || key === 'reset'), 'Back preserves rest and live run');
assert(handlers.get('mapPanelNode').includes('if (sectorSelection) return null'));

const expected = {
  'cemetery.png': [368, 368], 'torture.png': [368, 368], 'rich-dungeon.png': [368, 368], 'locked-room.png': [368, 368],
  'background.png': [1672, 941], 'map-header.png': [589, 95], 'back-button.png': [172, 172], 'back-icon.png': [122, 122],
  'symbols.png': [1774, 887], 'completed-bg.png': [80, 82], 'completed-check.svg': [90, 90],
  'tooltip-pointer.svg': [34, 44], 'vignette.svg': [5214, 3296],
};
for (const [name, dimensions] of Object.entries(expected)) {
  const file = path.join(root, 'public/assets/sector-map', name);
  assert(fs.statSync(file).size > 0);
  const info = await sharp(file).metadata();
  assert.deepEqual([info.width, info.height], dimensions, name);
  if (name.endsWith('.png') && name !== 'background.png') {
    const stats = await sharp(file).stats();
    assert.equal(stats.channels[3]?.min, 0, `${name}: transparency must survive export (not just an opaque alpha channel)`);
    assert.equal(stats.channels[3]?.max, 255, `${name}: visible pixels must remain`);
  }
}
const atlas = JSON.parse(fs.readFileSync(path.join(root, 'src/config/uiAtlas.json'), 'utf8'));
for (const key of ['sector_map_header', 'sector_map_back_button', 'sector_map_back_icon', 'sector_map_completed_bg']) {
  const sprite = atlas.sprites[key];
  const file = path.join(root, 'public', sprite.texture.image);
  const info = await sharp(file).metadata();
  assert.deepEqual([sprite.texture.width, sprite.texture.height], [info.width, info.height]);
  assert.deepEqual([sprite.region.x, sprite.region.y, sprite.region.width, sprite.region.height], [0, 0, info.width, info.height]);
}
const screen = fs.readFileSync(path.join(root, 'src/SectorSelectScreen.jsx'), 'utf8');
const screenAst = parse(screen, { sourceType: 'module', plugins: ['jsx'] });
assert(!screen.includes('figma.com/api/mcp'));
assert(screen.includes('zIndex={9500}'));
assert(screen.includes('data-completed={!hovered.locked && hovered.completed}'));
const screenFunction = screenAst.program.body.find(node => node.type === 'ExportDefaultDeclaration').declaration;
const screenHandlers = Object.fromEntries(screenFunction.body.body
  .filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
  .filter(node => ['hoverRoomAtPointer', 'selectRoom'].includes(node.id.name))
  .map(node => [node.id.name, screen.slice(node.init.start, node.init.end)]));
const interactionCalls = [];
const availableRoom = { id: 0, sector: 1, locked: false };
const lockedRoom = { id: 1, sector: 2, locked: true };
const interaction = {
  expanded: false, focused: availableRoom, lastPointer: { current: null },
  roomAtPointer: () => lockedRoom,
  setHoveredId: id => interactionCalls.push(['hover', id]),
  setFocusedId: id => interactionCalls.push(['focus', id]),
  setExpanded: value => interactionCalls.push(['expand', value]),
  onSelect: sector => interactionCalls.push(['enter', sector]),
};
const interact = name => new Function(...Object.keys(interaction), 'return (' + screenHandlers[name] + ');')(...Object.values(interaction));
interact('hoverRoomAtPointer')({ pointerType: 'mouse', clientX: 10, clientY: 20 });
assert.deepEqual(interactionCalls, [['hover',1]], 'Hover shows tooltip without expanding');
interactionCalls.length = 0;
interact('selectRoom')(availableRoom);
assert.deepEqual(interactionCalls, [['hover',0],['focus',0],['expand',true]], 'First click expands');
interaction.expanded = true;
interactionCalls.length = 0;
interact('selectRoom')(availableRoom);
assert.deepEqual(interactionCalls, [['hover',0],['enter',1]], 'Second click enters');
interaction.focused = lockedRoom;
interactionCalls.length = 0;
interact('selectRoom')(lockedRoom);
assert.deepEqual(interactionCalls, [['hover',1]], 'Locked room cannot be entered');
assert(screen.includes('sector-select-lock'));
assert(!screen.includes('brightness(0.3)'));
assert(!screen.includes('sector-select-links'));
console.log('PASS: original 8-room layout/spacing, 98px expansion, locks/completed states, sequential progression, alpha hit testing, tooltip/click behavior and assets.');
