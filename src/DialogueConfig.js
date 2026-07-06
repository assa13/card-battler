// Конфиг диалоговой системы: мини-истории, сгруппированные по событиям-триггерам.
//
// speakerId должен совпадать с DOM-якорем спикера на текущем экране:
// ищется элемент [data-entity-id="<speakerId>"], затем #sprite-<speakerId>.
// В Таверне это id сущностей из TavernSceneConfig (npc_bartender, hero_slot_0, ...).
//
// Каждый триггер:
//   pick:    'randomStory' — сыграть одну случайную историю целиком;
//            'all'         — сыграть все истории подряд (катсцена).
//   stories: [ [ { speakerId, name?, text }, ... ], ... ] — история = цепочка реплик,
//            проигрывается последовательно по клику.
//
// Новый триггер = новая запись здесь + один вызов getDialogueForTrigger(triggerId)
// из любого экрана. Ничего больше менять не нужно.

export const DIALOGUE_TRIGGERS = {
  TAVERN_ENTER: {
    pick: 'randomStory',
    stories: [
      [
        { speakerId: 'npc_bartender', name: 'Бармен', text: 'Вчера заходил рыцарь.' },
        { speakerId: 'npc_bartender', name: 'Бармен', text: 'Заказал эля на всех.' },
        { speakerId: 'npc_bartender', name: 'Бармен', text: 'Пил один. Его люди — в земле.' },
      ],
      [
        { speakerId: 'visitor_drunk_right', name: 'Пьянчуга', text: 'Ик... слышишь скрип?' },
        { speakerId: 'visitor_drunk_right', name: 'Пьянчуга', text: 'Это виселица у ворот.' },
        { speakerId: 'visitor_drunk_right', name: 'Пьянчуга', text: 'Ей давно не скучно.' },
      ],
      [
        { speakerId: 'visitor_cloaked_center', name: 'Незнакомец', text: 'Видел свет в катакомбах?' },
        { speakerId: 'visitor_cloaked_center', name: 'Незнакомец', text: 'Это не факелы.' },
        { speakerId: 'visitor_cloaked_center', name: 'Незнакомец', text: 'Туда не ходи.' },
      ],
      [
        { speakerId: 'hero_slot_0', name: 'Воин', text: 'Опять этот сон.' },
        { speakerId: 'hero_slot_2', name: 'Маг', text: 'Про яму с костями?' },
        { speakerId: 'hero_slot_0', name: 'Воин', text: 'Мы там были. Оба.' },
      ],
      [
        { speakerId: 'npc_bartender', name: 'Бармен', text: 'Погреб опять шумит.' },
        { speakerId: 'npc_bartender', name: 'Бармен', text: 'Я туда не спускаюсь.' },
        { speakerId: 'npc_bartender', name: 'Бармен', text: 'И тебе не советую.' },
      ],
      [
        { speakerId: 'visitor_walker_a_left', name: 'Бродяга', text: 'Кладбище растёт.' },
        { speakerId: 'visitor_walker_a_left', name: 'Бродяга', text: 'Само. По ночам.' },
        { speakerId: 'visitor_cloaked_center', name: 'Незнакомец', text: 'Он не врёт.' },
      ],
    ],
  },

  // Первая смерть отряда: незнакомец рассказывает мрачную историю,
  // после которой отряд бесплатно получает новые карты в слоты (см. App.jsx).
  FIRST_DEATH: {
    pick: 'randomStory',
    stories: [
      [
        { speakerId: 'visitor_cloaked_center', name: 'Незнакомец', text: 'Первая смерть — как первый глоток.' },
        { speakerId: 'visitor_cloaked_center', name: 'Незнакомец', text: 'Дальше будет легче.' },
        { speakerId: 'visitor_cloaked_center', name: 'Незнакомец', text: 'Тьма запомнила ваши имена.' },
        { speakerId: 'visitor_cloaked_center', name: 'Незнакомец', text: 'Вот. Возьмите.' },
        { speakerId: 'visitor_cloaked_center', name: 'Незнакомец', text: 'Мёртвым они уже не нужны.' },
      ],
    ],
  },

  // Примеры будущих триггеров — добавляются без изменения кода системы:
  // HERO_CLICK:  { pick: 'randomStory', stories: [...] },
  // TAVERN_IDLE: { pick: 'randomStory', stories: [...] },
};

// ─── Ночное событие: реакции бармена на визитёра за дверью ────────────────
// Лор-конфиг, редактируемый без кода: ключ = тип визитёра, значение = пул
// мини-историй с весами (weight). Чем выше вес, тем чаще история выпадает.
// Новый тип визитёра = новая запись здесь + вызов getBarkeepHint('ТИП').
export const BARKEEP_WARNINGS = {
  UNKNOWN_VISITOR: [
    { text: 'Говорят, в такие ночи мёртвые ищут тех, кому задолжали при жизни. Не пускай его, если не хочешь платить чужой долг...', weight: 0.3 },
    { text: 'Я слышал такой стук в Чёрном Лесу. Три ночи подряд. На четвёртую хозяин дома открыл. Это не человек. Пустишь — и оно заберёт твой голос.', weight: 0.2 },
    { text: 'Просто очередной бродяга, ищущий тепло. Но нож держи наготове. Прошлый «бродяга» ушёл отсюда с моей кассой.', weight: 0.5 },
  ],
};

// Взвешенный ролл мини-истории бармена. Возвращает очередь реплик,
// готовую для DialogueOverlay (якорь — npc_bartender).
export const getBarkeepHint = (visitorType = 'UNKNOWN_VISITOR') => {
  const pool = BARKEEP_WARNINGS[visitorType] ?? BARKEEP_WARNINGS.UNKNOWN_VISITOR ?? [];
  if (!pool.length) return [];
  const total = pool.reduce((sum, entry) => sum + (entry.weight ?? 1), 0);
  let roll = Math.random() * total;
  let chosen = pool[pool.length - 1];
  for (const entry of pool) {
    roll -= entry.weight ?? 1;
    if (roll <= 0) { chosen = entry; break; }
  }
  return [{ speakerId: 'npc_bartender', name: 'Бармен', text: chosen.text }];
};

// Возвращает массив реплик для проигрывания по триггеру (пустой — если триггера нет).
export const getDialogueForTrigger = (triggerId) => {
  const trigger = DIALOGUE_TRIGGERS[triggerId];
  if (!trigger || !trigger.stories?.length) return [];
  if (trigger.pick === 'all') return trigger.stories.flat();
  const story = trigger.stories[Math.floor(Math.random() * trigger.stories.length)];
  return [...story];
};
