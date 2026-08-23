// Среда QTE-механик карт: реестр механик + резолвер «какой QTE играть».
//
// Каждая карта несёт декларативный профиль:
//   qte: { mechanic: 'NONE' | 'PRECISION' | 'RHYTHM' | 'HORSE_HERD', trigger?: 'ALWAYS' | 'IMPORTANT' }
// Дизайн профилей и ревизия всех карт — docs/qte-design.md.
// Новая механика = запись в QTE_MECHANICS + ветка в resolveCardQte +
// раннер в playCard (App.jsx, точка подключения помечена комментарием).
//
// ИНВАРИАНТ ДВИЖКА (перекрывает любые профили): карты за 0 маны НИКОГДА
// не играют QTE — спам-карты не должны душить игрока кольцами.

export const QTE_MECHANICS = {
  // Без QTE: карта просто наносит урон/эффект.
  NONE: { id: 'NONE', name: 'Без QTE' },
  // Одиночное сужающееся кольцо (perfect/good/miss) с bullet-time.
  // Позиция: над целью; при targeting 'all' — большое кольцо в центре зоны врагов.
  PRECISION: { id: 'PRECISION', name: 'Кольцо точности' },
  // Ритм-стрим мульти-удара: локальное кольцо над КАЖДОЙ целью по очереди,
  // микро-пауза 100мс между звеньями, у ближников — «пинбол»-рывки к целям.
  // Требует 2+ живых целей; с одной целью деградирует в PRECISION/IMPORTANT.
  RHYTHM: { id: 'RHYTHM', name: 'Ритм-стрим' },
  // Табун призрачных лошадей пересекает арену по очереди. Каждая получает отдельное
  // короткое окно активации в центре поля и при успехе врезается в ближайшую цель.
  HORSE_HERD: { id: 'HORSE_HERD', name: 'Призрачный табун' },
  // Будущие механики добавляются сюда, например:
  // HOLD:  { id: 'HOLD',  name: 'Удержание' },   // зажать и отпустить в окно
  // MASH:  { id: 'MASH',  name: 'Закликивание' },// N кликов за время
};

export const QTE_TRIGGERS = {
  ALWAYS: 'ALWAYS',       // механика — идентичность карты, играет каждый розыгрыш
  IMPORTANT: 'IMPORTANT', // только в «важный» момент (см. isImportantContext)
};

// «Важный» контекст розыгрыша: звено комбо 2+, эпик/легендарка, среди целей
// босс или цель с Меткой, либо удар ожидаемо летален.
const isImportantContext = (card, { chainPos, targets, expectedLethal }) =>
  chainPos >= 2 ||
  card.rarity === 'EPIC' || card.rarity === 'LEGENDARY' ||
  targets.some(t => t.isBoss) ||
  targets.some(t => t.statuses?.mark) ||
  !!expectedLethal;

// Дефолтный профиль для карт без поля qte (легаси/новые карты до ревизии):
// повторяет исторические эвристики, чтобы поведение не менялось молча.
const defaultProfile = (card) => {
  if (card.type === 'self') return { mechanic: 'NONE' };
  if (card.targeting && card.targeting !== 'all') return { mechanic: 'RHYTHM', trigger: 'ALWAYS' };
  return { mechanic: 'PRECISION', trigger: 'IMPORTANT' };
};

// Резолвер: какую механику играть на ДАННОМ розыгрыше.
// ctx = { chainPos, targets, expectedLethal }
// Возвращает id механики из QTE_MECHANICS либо null (без QTE).
export const resolveCardQte = (card, ctx) => {
  if (!card.cost) return null; // инвариант: 0 маны = без QTE, перекрывает всё

  const profile = card.qte ?? defaultProfile(card);
  if (!profile || profile.mechanic === 'NONE') return null;

  const trigger = profile.trigger ?? 'IMPORTANT';
  const triggered = trigger === 'ALWAYS' || isImportantContext(card, ctx);

  if (profile.mechanic === 'RHYTHM') {
    // Стрим осмыслен только по 2+ целям; на одной цели карта ведёт себя как
    // обычный удар — кольцо по важности момента (деградация в PRECISION).
    if (ctx.targets.length > 1) return triggered ? 'RHYTHM' : null;
    return isImportantContext(card, ctx) ? 'PRECISION' : null;
  }

  return triggered ? profile.mechanic : null;
};
