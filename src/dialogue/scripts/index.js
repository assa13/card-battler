// Реестр ночных историй: взвешенный ролл при клике по двери ночью.
//
// Каждая история — ОТДЕЛЬНЫЙ файл в этой папке (см. nightWanderer.js как
// эталон формата и docs/dialogue-authoring.md как спецификацию).
// Новая история = новый файл + импорт + одна запись в массиве ниже.
// Чем выше weight, тем чаще история выпадает.

import { NIGHT_WANDERER_SCRIPT } from './nightWanderer';
import { RETURNING_REGULAR_SCRIPT } from './returningRegular';

export const NIGHT_VISITOR_SCRIPTS = [
  { script: NIGHT_WANDERER_SCRIPT, weight: 1 },
  { script: RETURNING_REGULAR_SCRIPT, weight: 1 },
];

// Сюжетные скрипты: НЕ входят в ночной ролл — App запускает их сам по
// игровым событиям (проп nightScript таверны). Реэкспорт для удобства.
export { STRANGER_SECOND_DEATH_SCRIPT } from './strangerSecondDeath';
