import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { inventoryReducer, inventorySlots, EMPTY_INVENTORY, INVENTORY_CAPACITY } from '../src/inventoryCapacity.js';
import { getItemBurnXp } from '../src/itemSystem.js';
import { spriteRenderResolution } from '../src/lighting/renderBudget.js';
import { BATTLE_LAYOUT, ITEM_SLOTS } from '../src/battle/battleLayout.js';
import { resolveCardQte } from '../src/qteMechanics.js';

const item = (id, rarity = 'COMMON') => ({ uid: String(id), name: `Item ${id}`, rarity });
const initial = Array.from({ length: 14 }, (_, index) => item(index));
let state = inventoryReducer(EMPTY_INVENTORY, initial);
assert.equal(state.items.length, INVENTORY_CAPACITY);
assert.equal(state.overflowXp, 0);
const rare = item('overflow', 'LEGENDARY');
const full = inventoryReducer(state, previous => [...previous, rare, rare]);
assert.deepEqual(full.items, state.items); // No replacement of an equipped/saved favourite.
assert.equal(full.overflowCount, 1); // Duplicate uid is one item.
assert.equal(full.overflowXp, getItemBurnXp(rare));
assert.deepEqual(inventoryReducer(state, previous => [...previous, rare, rare]), full); // StrictMode replay is pure.
state = inventoryReducer(full, previous => [...previous.filter(entry => entry.uid !== '0'), item('swap', 'RARE')]);
assert.equal(state.items.length, 14);
assert.equal(state.overflowCount, 1); // Equip/unequip swap uses the freed slot.
state = inventoryReducer(state, previous => previous.filter(entry => entry.uid !== '1'));
state = inventoryReducer(state, previous => [...previous, item('loot-a'), item('loot-b')]);
assert.equal(state.items.length, 14);
assert.equal(state.overflowCount, 2);
assert.equal(state.overflowXp, getItemBurnXp(rare) + getItemBurnXp(item('loot-b')));
const cleared = inventoryReducer(state, []);
assert.equal(cleared.items.length, 0);
assert.equal(cleared.overflowXp, state.overflowXp); // A reset cannot credit the same overflow again.
assert.equal(inventorySlots([]).length, 14);
assert.equal(inventorySlots(state.items).filter(Boolean).length, 14);
assert.ok(ITEM_SLOTS.x >= BATTLE_LAYOUT.inventoryBg.x);
assert.ok(ITEM_SLOTS.x + 13 * ITEM_SLOTS.step + ITEM_SLOTS.size < BATTLE_LAYOUT.mergeButton.x);
assert.equal(spriteRenderResolution(2071, 1035.5, 2), 1);
assert.equal(spriteRenderResolution(2071, 1035.5, 1), 0.5);
assert.equal(spriteRenderResolution(2071, 2071, 3), 1);
assert.equal(resolveCardQte({ cost: 2, qte: { mechanic: 'VOLLEY' } }, { chainPos: 0, targets: [], expectedLethal: false }), 'PRECISION');

const manifest = JSON.parse(await fs.readFile(new URL('../icon-atlas/combat-ui/manifest.json', import.meta.url), 'utf8'));
for (const name of manifest.sprites) {
  const file = new URL(`../public/assets/ui/combat/${name}.png`, import.meta.url);
  const image = sharp(await fs.readFile(file));
  const metadata = await image.metadata();
  assert.equal(metadata.width, 64); assert.equal(metadata.height, 64); assert.ok(metadata.hasAlpha);
  const raw = await image.ensureAlpha().raw().toBuffer();
  assert.ok(raw[3] <= 1, `${name}: transparent gutter`);
  if (name.startsWith('target') || name === 'qte-ring') {
    for (let y = 25; y <= 37; y++) for (let x = 25; x <= 37; x++) {
      // A one-step alpha quantization fringe is invisible (<0.4% opacity).
      assert.ok(raw[(y * 64 + x) * 4 + 3] <= 1, `${name}: clear number/timing center`);
    }
  }
}
console.log('14-slot transactions, overflow XP, layout bounds, render resolution, retired QTE migration and six transparent UI sprites passed.');
