// One source for map previews, encounter size and battle stat scaling.
export const ENCOUNTER_DIFFICULTIES = {
  combat_easy: { label: 'Обычный', color: '#91b79d', hp: 0.85, attack: 0.9 },
  combat_medium: { label: 'Опасный', color: '#e1bd75', hp: 1, attack: 1 },
  combat_hard: { label: 'Тяжёлый', color: '#de8979', hp: 1.25, attack: 1.1 },
  boss: { label: 'Босс', color: '#c397df', hp: 1, attack: 1 },
};

export function getEncounterProfile(type = 'combat_easy', stage = 1, sector = 1) {
  const difficulty = ENCOUNTER_DIFFICULTIES[type] || ENCOUNTER_DIFFICULTIES.combat_easy;
  const depth = Math.max(1, stage);
  const count = type === 'boss' ? 1 : type === 'combat_hard' ? 4
    : type === 'combat_medium' || depth >= 3 ? 3 : 2;
  // Add bodies before adding burst damage. Preserve the existing boss curve.
  const hpPower = type === 'boss' ? 0.5 : sector === 1
    ? Math.min(0.74, 0.62 + (depth - 1) * 0.04) : 0.65;
  const attackPower = type === 'boss' ? 0.5 : depth <= 1 && sector === 1 ? 0.5 : 0.55;
  return { ...difficulty, count, hpPower, attackPower, type, stage: depth, sector };
}

export function fillEncounterSquad(names, pool, count) {
  const result = [...names];
  for (let index = 0; result.length < count; index += 1) {
    result.push(pool[index % pool.length]);
  }
  return result;
}

export function getOnboardingHint({ wins, turnState, cards, mana }) {
  if (wins >= 3) return null;
  if (turnState === 'map') return wins === 0
    ? 'Начало похода · Стрелки / WASD или клик для движения. Наведите на врага, чтобы оценить отряд; подойдите и нажмите для боя.'
    : wins === 1
      ? 'Первая добыча уже в сумке · Перетащите предмет на героя. Сундуки дают снаряжение, выход доступен без зачистки.'
      : 'Проверьте отряд перед следующим боем · Уровень отряда открывает выбор усиления карты.';
  if (turnState !== 'player') return null;
  const canChain = mana >= 3 && [0, 1, 2].every(cost => cards.some(card => card.cost === cost));
  if (wins > 0 && canChain) return 'Есть цепочка 0 → 1 → 2 · Разыграйте карты в этом порядке, чтобы усилить урон.';
  return wins === 0
    ? 'Первый бой · Наведите на карту: увидите цели и урон. Точные нажатия усиливают атаку; промах по QTE оставляет обычный урон.'
    : 'Следите за маной · Цена карт важна. Нажатие в окне вражеской атаки даёт контрудар, но не отменяет входящий урон.';
}

export const HORSE_COUNT = 8;
export const HORSE_QTE_BONUS = 0.35;

// Cumulative integer allocation prevents rounding eight small hits upwards.
// Every horse has ordinary damage; successful timing adds part of a 35% bonus.
export function createHorseDamageBudget(totalDamage) {
  const total = Math.max(0, Math.round(totalDamage));
  let hits = 0;
  let successes = 0;
  return (active) => {
    if (hits >= HORSE_COUNT) return 0;
    const base = Math.floor(total * (hits + 1) / HORSE_COUNT) - Math.floor(total * hits / HORSE_COUNT);
    const bonus = active
      ? Math.floor(total * HORSE_QTE_BONUS * (successes + 1) / HORSE_COUNT)
        - Math.floor(total * HORSE_QTE_BONUS * successes / HORSE_COUNT) : 0;
    hits += 1;
    if (active) successes += 1;
    return base + bonus;
  };
}
