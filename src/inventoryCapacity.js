import { getItemBurnXp, sortUniqueItemsByRarity } from './itemSystem.js';

export const INVENTORY_CAPACITY = 14;
export const EMPTY_INVENTORY = { items: [], overflowXp: 0, overflowCount: 0 };

// Pure transaction: every acquisition path (loot, chest, shop, unequip, craft)
// has the same capacity. Retained items take priority over new arrivals.
export function inventoryReducer(state, update) {
  const requested = sortUniqueItemsByRarity(typeof update === 'function' ? update(state.items) : update);
  const previousIds = new Set(state.items.map(item => item.uid));
  const retained = requested.filter(item => previousIds.has(item.uid));
  const arrivals = requested.filter(item => !previousIds.has(item.uid));
  const ordered = [...retained, ...arrivals];
  const overflow = ordered.slice(INVENTORY_CAPACITY);
  return {
    items: sortUniqueItemsByRarity(ordered.slice(0, INVENTORY_CAPACITY)),
    overflowXp: state.overflowXp + overflow.reduce((sum, item) => sum + getItemBurnXp(item), 0),
    overflowCount: state.overflowCount + overflow.length,
  };
}

export const inventorySlots = items => Array.from({ length: INVENTORY_CAPACITY }, (_, index) => items[index] || null);
