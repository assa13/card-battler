// Ночной гость: «Промокший странник» — эталонный скрипт ветвящегося диалога.
// Служит образцом формата для нарративных агентов (docs/dialogue-authoring.md).
//
// Диалог играет на экране ночной встречи (NightEncounterScreen):
//   - персонаж выбирается ПО ID из реестра src/dialogue/encounterCharacters.js
//     (encounter.character), позиция — offset от центра холста 3200×1800;
//   - без поля encounter гость — дефолтный монстр «Глаз» в постановке Figma.
//
// Структура: intro → hub (выборы: впустить / прислушаться / прогнать).
// «Прислушаться» — узел-петля: возвращает в hub, флаг listened прячет
// использованный выбор. Концовки дают награду/последствие и сворачивают
// ночь командой END_NIGHT_SLEEP.

export const NIGHT_WANDERER_SCRIPT = {
  id: 'night_wanderer',
  // Гость — посетитель в плаще из реестра персонажей. offset/size/flipX
  // опциональны (дефолт — постановка «монстр в проёме» из Figma).
  encounter: {
    character: 'cloaked_visitor',
    offset: { x: 160, y: -40 },
    size: 1813,
    flipX: true,
  },
  speakers: {
    stranger: { anchorEntityId: 'encounter_visitor', name: 'Незнакомец' },
  },
  start: 'intro',
  nodes: {
    intro: {
      speaker: 'stranger',
      lines: [
        'Откройте... прошу.',
        'Дождь хлещет, а я иду с самого перевала.',
        'Мне бы только до утра. У меня есть чем заплатить.',
      ],
      next: 'hub',
    },

    // Узел-хаб: держит выборы. Сюда можно возвращаться из веток-петель.
    hub: {
      speaker: 'stranger',
      lines: ['...так что скажете?'],
      choices: [
        { text: 'Открыть дверь', next: 'let_in' },
        {
          text: 'Прислушаться',
          next: 'listen',
          condition: { notFlag: 'listened' },
          commands: [{ type: 'SET_FLAG', flag: 'listened' }],
        },
        { text: 'Прогнать', next: 'refuse' },
      ],
    },

    listen: {
      speaker: 'stranger',
      lines: [
        '...кап. Кап. Кап.',
        'Дождя за дверью не слышно. Только дыхание.',
      ],
      next: 'hub',
    },

    let_in: {
      speaker: 'stranger',
      lines: [
        'Благодарю... вы не пожалеете.',
        'Вот. Нашёл на перевале, у тех, кому уже не нужно.',
      ],
      next: 'let_in_reward',
    },
    // Логический узел: только команды-триггеры, без реплик — мгновенный проскок.
    let_in_reward: {
      commands: [
        { type: 'UNLOCK_HERO_CARD', heroId: 'p2', cardId: 's2_1' },
        { type: 'SHOW_TOAST', text: 'Разбойник получил карту «Яд»' },
        { type: 'END_NIGHT_SLEEP' },
      ],
      next: null,
    },

    refuse: {
      speaker: 'stranger',
      lines: [
        '...понимаю.',
        'Тогда я просто постою здесь. До рассвета.',
      ],
      next: 'refuse_end',
    },
    refuse_end: {
      commands: [{ type: 'END_NIGHT_SLEEP' }],
      next: null,
    },
  },
};

// Реестр ночных историй переехал в ./index.js — новые истории регистрируются там.
