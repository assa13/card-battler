// Геометрия слота героя из фрейма hero_slot (Figma 150:1665, файл
// zG9zihyiBTJFjR5dVta74Z). Вынесена из виджета отдельно: боевой экран кладёт по
// этим же координатам плоские слои для мыши поверх слота.

export const HERO_SLOT_SIZE = { width: 421, height: 573 };

/** Гнездо под карточку — ровно тот бокс, который в макете занимает MagicCard. */
export const HERO_SLOT_CARD_BODY = { left: 23, top: 108, width: 374, height: 434 };

/** Слот артефакта свисает ниже кромки слота — так в макете. */
export const HERO_SLOT_ARTEFACT = { left: 57, top: 544.99, width: 311, height: 163.01 };
