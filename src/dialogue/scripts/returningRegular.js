// Ночной гость: «Завсегдатай вернулся».
// Посетитель бара стучится ночью — выходил домой кое-что забрать. Мы ему
// не верим; он доказывает, что «свой», описывая бармена. Первый факт —
// «он с бородой»; можно согласиться и вытянуть второй факт, и лишь тогда
// впустить. Обвинение во лжи в любой момент — гость уходит.
//
// Структура: intro → hub (спросить про бармена / прогнать) →
// barman1 (мини-история + «с бородой») → barman2 (второй факт) →
// let_in. Ветки liar / refuse — гость уходит. Все концовки → END_NIGHT_SLEEP.

export const RETURNING_REGULAR_SCRIPT = {
  id: 'night_returning_regular',
  encounter: {
    character: 'common_visitor',
    offset: { x: 160, y: -40 },
    size: 1813,
    flipX: true,
  },
  speakers: {
    visitor: { anchorEntityId: 'encounter_visitor', name: 'Посетитель' },
  },
  start: 'intro',
  nodes: {
    intro: {
      speaker: 'visitor',
      lines: [
        'Это я. Выходил домой — кое-что забрать.',
        'Впустите обратно, я же свой.',
      ],
      next: 'hub',
    },

    hub: {
      speaker: 'visitor',
      lines: ['Ну? Что застыли?'],
      choices: [
        { text: 'Как выглядит бармен?', next: 'barman1' },
        { text: 'Прогнать', next: 'refuse' },
      ],
    },

    barman1: {
      speaker: 'visitor',
      lines: [
        'Я тут каждый вечер грею бок у очага.',
        'Наливает молча, зыркнет исподлобья — и всё.',
        'Такое лицо не забудешь. Он **с бородой**.',
      ],
      choices: [
        { text: 'А что ещё?', next: 'barman2' },
        { text: 'Ты лжёшь', next: 'liar' },
      ],
    },

    barman2: {
      speaker: 'visitor',
      lines: [
        'Ещё? Левая рука сухая — кружку держит правой.',
        'И **шрам** через бровь. Ну, разглядели?',
      ],
      choices: [
        { text: 'Впустить', next: 'let_in' },
        { text: 'Ты лжёшь', next: 'liar' },
      ],
    },

    let_in: {
      speaker: 'visitor',
      lines: [
        'Вот спасибо. Замёрз как пёс.',
        'Сяду в свой угол, никого не трону.',
      ],
      next: 'let_in_reward',
    },
    let_in_reward: {
      commands: [
        { type: 'SHOW_TOAST', text: 'Завсегдатай вернулся к очагу' },
        { type: 'GIVE_GOLD', amount: 20 },
        { type: 'END_NIGHT_SLEEP' },
      ],
      next: null,
    },

    liar: {
      speaker: 'visitor',
      lines: [
        'Вру? Я?..',
        'Ну и мёрзни один. Ухожу.',
      ],
      next: 'liar_end',
    },
    liar_end: {
      commands: [{ type: 'END_NIGHT_SLEEP' }],
      next: null,
    },

    refuse: {
      speaker: 'visitor',
      lines: [
        'Гонишь своего же...',
        'Ладно. Найду другую дверь.',
      ],
      next: 'refuse_end',
    },
    refuse_end: {
      commands: [{ type: 'END_NIGHT_SLEEP' }],
      next: null,
    },
  },
};
