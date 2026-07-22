// Персистентный инвентарь карт героев. Таксономия карт (см. docs/meta.md):
//   1. Run-карты  — награды level-up в бою; живут ТОЛЬКО в drawPile/discard,
//      при смерти отряда исчезают вместе с колодой. Сюда НЕ пишутся.
//   2. Перманентные — покупка за огоньки души (prep) и награды событий/диалогов
//      (UNLOCK_HERO_CARD). Хранятся здесь (localStorage), переживают смерть,
//      открыты с начала каждого рана.
//   3. Стартовая карта героя — хардкод (HERO_ABILITIES[id].basic), не хранится.
//   4. У каждого героя лимит перманентных слотов — MAX_PERMANENT_CARDS.

const STORAGE_KEY = 'idler_permanentlyUnlockedCards';
const HERO_INVENTORY_META_STORAGE_KEY = 'idler_heroInventoryMeta';

/** Сброс мета-прогресса при перезапуске (сохранения пока нет). */
export const clearMetaSessionStorage = () => {
  [STORAGE_KEY, HERO_INVENTORY_META_STORAGE_KEY].forEach((key) => {
    try { localStorage.removeItem(key); } catch { /* quota / private mode */ }
  });
};

export const HERO_IDS = ['p1', 'p2', 'p3'];
export const HERO_CARD_LOADOUT_SIZE = 2;
export const MAX_CARD_LEVEL = 5;
export const UPGRADE_COSTS = [25, 60, 140, 320];

// Экономика инвентаря героя (см. docs/meta.md):
//   - разблокировка КАРТЫ коллекции — золото 🪙, цена по редкости;
//   - каждый СЛОТ лоадаута разблокируется отдельно за огоньки души 🔥.
export const CARD_UNLOCK_GOLD_COSTS = { COMMON: 40, RARE: 90, EPIC: 180, LEGENDARY: 350 };
export const getCardUnlockGoldCost = (rarity) =>
  CARD_UNLOCK_GOLD_COSTS[rarity] ?? CARD_UNLOCK_GOLD_COSTS.COMMON;
// Цены разблокировки слотов лоадаута — та же лестница, что на экране подготовки
// (PREP_SLOT_PRICES): каждый купленный слот у любого героя дорожает следующий.
export const LOADOUT_SLOT_UNLOCK_PRICES = [1, 1, 3, 6, 11, 22];
export const countPurchasedLoadoutSlots = (slotsUnlocked) =>
  HERO_IDS.reduce((sum, heroId) => (
    sum + Math.max(0, (slotsUnlocked?.[heroId] ?? DEFAULT_UNLOCKED_SLOTS) - DEFAULT_UNLOCKED_SLOTS)
  ), 0);
export const getLoadoutSlotUnlockPrice = (slotsUnlocked) => {
  const bought = countPurchasedLoadoutSlots(slotsUnlocked);
  return LOADOUT_SLOT_UNLOCK_PRICES[Math.min(bought, LOADOUT_SLOT_UNLOCK_PRICES.length - 1)];
};
export const DEFAULT_UNLOCKED_SLOTS = 0;

export const createDefaultSlotsUnlocked = () =>
  Object.fromEntries(HERO_IDS.map((id) => [id, DEFAULT_UNLOCKED_SLOTS]));

// Лимит перманентных карт на героя (сверх стартовой). Пул героя — 4 слота
// (CARD_POOL_SIZE): 1 стартовая + до 2 перманентных + минимум 1 под run-карты.
export const MAX_PERMANENT_CARDS = { p1: 2, p2: 2, p3: 2 };

export const getPermanentCount = (state, heroId) => (state[heroId] || []).length;
export const hasFreePermanentSlot = (state, heroId) =>
  getPermanentCount(state, heroId) < (MAX_PERMANENT_CARDS[heroId] ?? 0);

export const createEmptyUnlockedCards = () =>
  Object.fromEntries(HERO_IDS.map((id) => [id, []]));

export const createEmptyHeroCardLoadouts = () =>
  Object.fromEntries(HERO_IDS.map((id) => [id, []]));

export const createEmptyHeroCardProgression = () =>
  Object.fromEntries(HERO_IDS.map((id) => [id, {}]));

export const createEmptyHeroInventoryMeta = () => ({
  cardLoadouts: createEmptyHeroCardLoadouts(),
  cardProgression: createEmptyHeroCardProgression(),
  slotsUnlocked: createDefaultSlotsUnlocked(),
  gold: 0,
  ascensionShards: 0,
});

const normalizeHeroMap = (value, factory, normalizeValue) => {
  const base = factory();
  HERO_IDS.forEach((heroId) => {
    base[heroId] = normalizeValue(value?.[heroId], heroId);
  });
  return base;
};

export const loadHeroInventoryMeta = (fallbackUnlocked = null) => {
  try {
    const raw = localStorage.getItem(HERO_INVENTORY_META_STORAGE_KEY);
    if (!raw) {
      const meta = createEmptyHeroInventoryMeta();
      if (fallbackUnlocked) {
        HERO_IDS.forEach((heroId) => {
          meta.cardLoadouts[heroId] = (fallbackUnlocked[heroId] || []).slice(0, HERO_CARD_LOADOUT_SIZE);
        });
      }
      return meta;
    }
    const parsed = JSON.parse(raw);
    return {
      cardLoadouts: normalizeHeroMap(
        parsed?.cardLoadouts,
        createEmptyHeroCardLoadouts,
        (cards) => Array.isArray(cards)
          ? cards.slice(0, HERO_CARD_LOADOUT_SIZE).map((id, index, list) => (
            typeof id === 'string' && list.indexOf(id) === index ? id : null
          ))
          : [],
      ),
      cardProgression: normalizeHeroMap(
        parsed?.cardProgression,
        createEmptyHeroCardProgression,
        (levels) => Object.fromEntries(
          Object.entries(levels || {})
            .filter(([cardId, level]) => typeof cardId === 'string' && Number.isFinite(level))
            .map(([cardId, level]) => [cardId, Math.max(1, Math.min(MAX_CARD_LEVEL, Math.floor(level)))]),
        ),
      ),
      slotsUnlocked: normalizeHeroMap(
        parsed?.slotsUnlocked,
        createDefaultSlotsUnlocked,
        (count) => Math.max(DEFAULT_UNLOCKED_SLOTS, Math.min(HERO_CARD_LOADOUT_SIZE, Math.floor(Number(count) || DEFAULT_UNLOCKED_SLOTS))),
      ),
      gold: Math.max(0, Math.floor(Number(parsed?.gold) || 0)),
      ascensionShards: Math.max(0, Math.floor(Number(parsed?.ascensionShards) || 0)),
    };
  } catch {
    return createEmptyHeroInventoryMeta();
  }
};

export const saveHeroInventoryMeta = (meta) => {
  try {
    localStorage.setItem(HERO_INVENTORY_META_STORAGE_KEY, JSON.stringify(meta));
  } catch { /* quota / private mode */ }
};

export const getCardLevel = (progression, heroId, cardId) =>
  Math.max(1, Math.min(MAX_CARD_LEVEL, progression?.[heroId]?.[cardId] || 1));

export const getUpgradeCost = (level) => UPGRADE_COSTS[Math.max(0, Math.min(UPGRADE_COSTS.length - 1, level - 1))];

export const sanitizeHeroCardLoadouts = (state, permanentlyUnlocked, abilities) =>
  normalizeHeroMap(
    state,
    createEmptyHeroCardLoadouts,
    (cards, heroId) => {
      const allowed = new Set(permanentlyUnlocked?.[heroId] || []);
      return Array.isArray(cards)
        ? cards.slice(0, HERO_CARD_LOADOUT_SIZE).map((cardId, index, list) => (
          typeof cardId === 'string'
          && list.indexOf(cardId) === index
          && allowed.has(cardId)
          && resolveSkillById(heroId, cardId, abilities)
            ? cardId
            : null
        ))
        : [];
    },
  );

export const sanitizeHeroCardProgression = (state, abilities) =>
  normalizeHeroMap(
    state,
    createEmptyHeroCardProgression,
    (levels, heroId) => Object.fromEntries(
      Object.entries(levels || {})
        .filter(([cardId, level]) => Number.isFinite(level) && resolveSkillById(heroId, cardId, abilities))
        .map(([cardId, level]) => [cardId, Math.max(1, Math.min(MAX_CARD_LEVEL, Math.floor(level)))]),
    ),
  );

export const assignHeroLoadoutCard = (state, heroId, cardId, permanentlyUnlocked, targetIndex = null, maxSlots = HERO_CARD_LOADOUT_SIZE) => {
  if (!HERO_IDS.includes(heroId) || !permanentlyUnlocked?.[heroId]?.includes(cardId)) return state;
  const current = Array.from({ length: HERO_CARD_LOADOUT_SIZE }, (_, index) => state[heroId]?.[index] || null);
  if (current.includes(cardId)) return state;
  // Заблокированные слоты (index >= maxSlots) недоступны для назначения.
  const freeIndex = Number.isInteger(targetIndex) && targetIndex < maxSlots && !current[targetIndex]
    ? targetIndex
    : current.findIndex((id, index) => !id && index < maxSlots);
  if (freeIndex < 0) return state;
  const next = [...current];
  next[freeIndex] = cardId;
  return { ...state, [heroId]: next };
};

export const reorderHeroLoadoutCard = (state, heroId, fromIndex, toIndex, maxSlots = HERO_CARD_LOADOUT_SIZE) => {
  const current = Array.from({ length: HERO_CARD_LOADOUT_SIZE }, (_, index) => state[heroId]?.[index] || null);
  if (!HERO_IDS.includes(heroId) || fromIndex === toIndex || !current[fromIndex] || toIndex < 0 || toIndex >= Math.min(HERO_CARD_LOADOUT_SIZE, maxSlots)) return state;
  const next = [...current];
  [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
  return { ...state, [heroId]: next };
};

export const removeHeroLoadoutCard = (state, heroId, cardId) => {
  if (!HERO_IDS.includes(heroId)) return state;
  return { ...state, [heroId]: (state[heroId] || []).map((id) => id === cardId ? null : id) };
};

export const upgradeHeroCard = (progression, heroId, cardId) => {
  if (!HERO_IDS.includes(heroId) || !cardId) return progression;
  const current = getCardLevel(progression, heroId, cardId);
  if (current >= MAX_CARD_LEVEL) return progression;
  return {
    ...progression,
    [heroId]: { ...(progression[heroId] || {}), [cardId]: current + 1 },
  };
};

export const loadPermanentlyUnlockedCards = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyUnlockedCards();
    const parsed = JSON.parse(raw);
    const base = createEmptyUnlockedCards();
    HERO_IDS.forEach((id) => {
      if (Array.isArray(parsed[id])) base[id] = [...new Set(parsed[id])];
    });
    return base;
  } catch {
    return createEmptyUnlockedCards();
  }
};

export const savePermanentlyUnlockedCards = (state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* quota / private mode */ }
};

/** Иммутабельный редьюсер UNLOCK_HERO_CARD — только массив конкретного heroId.
 *  Дубликаты и переполнение лимита MAX_PERMANENT_CARDS молча игнорируются. */
export const unlockHeroCard = (state, heroId, cardId) => {
  if (!HERO_IDS.includes(heroId) || !cardId) return state;
  const current = state[heroId] || [];
  if (current.includes(cardId)) return state;
  if (current.length >= (MAX_PERMANENT_CARDS[heroId] ?? 0)) return state;
  return { ...state, [heroId]: [...current, cardId] };
};

export const removeUnlockedHeroCard = (state, heroId, cardId) => {
  if (!HERO_IDS.includes(heroId) || !cardId) return state;
  const current = state[heroId] || [];
  if (!current.includes(cardId)) return state;
  return { ...state, [heroId]: current.filter((id) => id !== cardId) };
};

/** Базовые skillId героя (стартовая атака) — не персистятся. */
export const getBaseCardIds = (heroId, abilities) => {
  const basicId = abilities[heroId]?.basic?.id;
  return basicId ? [basicId] : [];
};

export const resolveSkillById = (heroId, cardId, abilities) => {
  const hero = abilities[heroId];
  if (!hero) return null;
  if (hero.basic?.id === cardId) return hero.basic;
  return hero.skills?.find((s) => s.id === cardId) || null;
};

/** Слияние базовых + разблокированных skillId для героя. */
export const getHeroAvailableCardIds = (heroId, permanentlyUnlocked, abilities) => {
  const base = getBaseCardIds(heroId, abilities);
  const unlocked = permanentlyUnlocked[heroId] || [];
  return [...new Set([...base, ...unlocked])];
};

/** Полные шаблоны карт (base + unlocked) для UI/гидрации. */
export const getHeroAvailableCards = (heroId, permanentlyUnlocked, abilities) =>
  getHeroAvailableCardIds(heroId, permanentlyUnlocked, abilities)
    .map((id) => resolveSkillById(heroId, id, abilities))
    .filter(Boolean);

/** Инстансы разблокированных карт для колоды (без базовой стартовой). */
export const instantiateUnlockedCards = (
  heroId,
  permanentlyUnlocked,
  abilities,
  existingDeck = [],
  selectedSkillIds = null,
  progression = {},
) => {
  const unlocked = permanentlyUnlocked[heroId] || [];
  const selected = Array.isArray(selectedSkillIds)
    ? unlocked.filter((skillId) => selectedSkillIds.includes(skillId))
    : unlocked;
  const existingSkillIds = new Set(
    existingDeck
      .filter((c) => c.ownerId === heroId)
      .map((c) => c.skillId || c.id),
  );
  return selected
    .filter((skillId) => !existingSkillIds.has(skillId))
    .map((skillId) => {
      const tmpl = resolveSkillById(heroId, skillId, abilities);
      if (!tmpl || tmpl.id?.startsWith('b')) return null;
      return {
        ...tmpl,
        id: `persist_${heroId}_${skillId}`,
        ownerId: heroId,
        level: getCardLevel(progression, heroId, skillId),
        skillId,
      };
    })
    .filter(Boolean);
};
