// Реестр ночных историй: взвешенный ролл в момент, когда игрок открывает
// модалку сна (гость выбирается ОДИН раз за ночь и до рассвета не меняется).
//
// Каждая история — ОТДЕЛЬНЫЙ файл в этой папке (см. nightWanderer.js как
// эталон формата и docs/dialogue-authoring.md как спецификацию).
// Новая история = новый файл + импорт + одна запись в массиве ниже.
// Чем выше weight, тем чаще история выпадает.
//
// Типы гостей задаются полями САМОГО скрипта (не реестра — сюжетные скрипты
// приходят из App мимо ролла и должны нести свой тип с собой):
//   • обычный              — можно проспать и можно сбежать из фазы стука;
//   • `escapable: false`   — не скипаемый: пришёл — разговор не оборвать
//                            (nightCollector.js);
//   • `mandatory: true`    — обязательный: этой ночью «Спать до утра»
//                            недоступно, сбежать тоже нельзя
//                            (strangerSecondDeath.js).
// Награды («гость, который что-то даёт») — обычные команды концовок:
// UNLOCK_HERO_CARD, GIVE_GOLD, TAKE_GOLD.

import { NIGHT_WANDERER_SCRIPT } from './nightWanderer';
import { RETURNING_REGULAR_SCRIPT } from './returningRegular';
import { NIGHT_COLLECTOR_SCRIPT } from './nightCollector';

export const NIGHT_VISITOR_SCRIPTS = [
  { script: NIGHT_WANDERER_SCRIPT, weight: 1 },
  { script: RETURNING_REGULAR_SCRIPT, weight: 1 },
  { script: NIGHT_COLLECTOR_SCRIPT, weight: 1 },
  // Тихая ночь: script === null — никто не приходит, «прислушаться» вернёт
  // тишину, а сон пройдёт без стука. Вес держит долю спокойных ночей.
  { script: null, weight: 1 },
];

// Сюжетные скрипты: НЕ входят в ночной ролл — App запускает их сам по
// игровым событиям (проп nightScript таверны). Реэкспорт для удобства.
export { STRANGER_SECOND_DEATH_SCRIPT } from './strangerSecondDeath';
export { SKELETON_FIRST_DEATH_SCRIPT } from './skeletonFirstDeath';
