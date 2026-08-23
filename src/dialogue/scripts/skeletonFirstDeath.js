// Обязательный ночной визит после первой смерти отряда.
// Скелет не торгуется о входе: игрок может выразить удивление и сомнение,
// но согласие появляется только после обеих реплик и остаётся единственным
// способом закончить разговор.

export const SKELETON_FIRST_DEATH_SCRIPT = {
  id: 'skeleton_first_death',
  mandatory: true,
  encounter: {
    character: 'task_master',
    offset: { x: 160, y: -40 },
    size: 1813,
    flipX: true,
  },
  speakers: {
    skeleton: { anchorEntityId: 'encounter_visitor', name: 'Скелет' },
  },
  start: 'intro',
  nodes: {
    intro: {
      speaker: 'skeleton',
      lines: [
        'Не пугайтесь. Ваши мёртвые рассказали мне, где вас искать.',
        'Я составляю поручения для тех, кому одной смерти оказалось мало.',
        'Пустите меня к огню. У меня найдётся работа для каждого из вас.',
      ],
      next: 'doubts',
    },

    doubts: {
      speaker: 'skeleton',
      lines: ['Спрашивайте. Рассвет всё равно не наступит, пока мы не договоримся.'],
      choices: [
        {
          text: 'Ты же скелет!',
          next: 'surprise',
          condition: { notFlag: 'asked_surprise' },
          commands: [
            { type: 'SET_FLAG', flag: 'asked_surprise' },
            { type: 'ADD_VAR', var: 'doubts_spoken', amount: 1 },
          ],
        },
        {
          text: 'Тебе нельзя доверять',
          next: 'distrust',
          condition: { notFlag: 'asked_distrust' },
          commands: [
            { type: 'SET_FLAG', flag: 'asked_distrust' },
            { type: 'ADD_VAR', var: 'doubts_spoken', amount: 1 },
          ],
        },
        {
          text: 'Других вариантов нет',
          next: 'agree',
          condition: { var: 'doubts_spoken', gte: 2 },
        },
      ],
    },

    surprise: {
      speaker: 'skeleton',
      lines: [
        'Наблюдательно.',
        'Кости не требуют жалованья, не спят и прекрасно ведут счёт.',
      ],
      next: 'doubts',
    },

    distrust: {
      speaker: 'skeleton',
      lines: [
        'И правильно. Доверие портит хорошие договоры.',
        'Читайте условия. Награду получите только после исполнения.',
      ],
      next: 'doubts',
    },

    agree: {
      speaker: 'skeleton',
      lines: [
        'Вот и славно.',
        'Поставьте меня у камина. Там сухо, а пергамент боится сырости.',
        'Когда над моей головой появится знак — значит, для вас есть работа.',
      ],
      next: 'join',
    },

    join: {
      commands: [
        { type: 'TASK_MASTER_JOIN_TAVERN' },
        { type: 'SHOW_TOAST', text: 'Скелет открыл книгу поручений' },
        { type: 'END_NIGHT_SLEEP' },
      ],
      next: null,
    },
  },
};

