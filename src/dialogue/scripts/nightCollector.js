// Ночной гость: «Сборщик долгов» — эталон НЕ СКИПАЕМОГО посетителя.
//
// escapable: false — если игрок выбрал «Прислушаться к ночи» и сборщик пришёл,
// сбежать по лестнице обратно в кровать нельзя: он будет барабанить в дверь до
// рассвета. Проспать его всё ещё можно — лечь сразу («Спать до утра»).
//
// Структура: intro → hub (заплатить / потребовать расписку / отказать).
// «Расписка» — узел-петля, после неё в хабе открывается ветка «подпись
// подделана»: внимательный игрок не платит, а получает плату за молчание.

export const NIGHT_COLLECTOR_SCRIPT = {
  id: 'night_collector',
  escapable: false,
  encounter: {
    character: 'bandit',
    offset: { x: 160, y: -40 },
    size: 1813,
    flipX: true,
  },
  speakers: {
    collector: { anchorEntityId: 'encounter_visitor', name: 'Сборщик' },
  },
  start: 'intro',
  nodes: {
    intro: {
      speaker: 'collector',
      lines: [
        'Обычно я не стучу дважды.',
        'Прежний хозяин этих стен занял у моих людей.',
        'Стены теперь ваши. Значит, и долг ваш.',
      ],
      next: 'hub',
    },

    hub: {
      speaker: 'collector',
      lines: ['Тридцать монет. Или поговорим иначе.'],
      choices: [
        { text: 'Заплатить', next: 'pay' },
        {
          text: 'Показать расписку',
          next: 'paper',
          condition: { notFlag: 'saw_paper' },
          commands: [{ type: 'SET_FLAG', flag: 'saw_paper' }],
        },
        { text: 'Подпись подделана', next: 'bluff', condition: { flag: 'saw_paper' } },
        { text: 'Отказать', next: 'refuse' },
      ],
    },

    paper: {
      speaker: 'collector',
      lines: [
        'Расписка? Держите, грамотей.',
        'Бумага сырая. Чернила свежее вчерашнего хлеба.',
      ],
      next: 'hub',
    },

    bluff: {
      speaker: 'collector',
      lines: [
        'Тише. Не ори на всю улицу.',
        'Держи и забудь, что видел эту бумагу.',
      ],
      next: 'bluff_reward',
    },
    bluff_reward: {
      commands: [
        { type: 'GIVE_GOLD', amount: 25 },
        { type: 'SHOW_TOAST', text: 'Сборщик заплатил за молчание' },
        { type: 'END_NIGHT_SLEEP' },
      ],
      next: null,
    },

    pay: {
      speaker: 'collector',
      lines: [
        'Вот это другой разговор.',
        'Спите спокойно. До следующего долга.',
      ],
      next: 'pay_end',
    },
    pay_end: {
      commands: [
        { type: 'TAKE_GOLD', amount: 30 },
        { type: 'SHOW_TOAST', text: 'Долг закрыт — 30 золота' },
        { type: 'END_NIGHT_SLEEP' },
      ],
      next: null,
    },

    refuse: {
      speaker: 'collector',
      lines: [
        'Как знаете.',
        'Я оставлю метку на вашей двери. Придут другие.',
      ],
      next: 'refuse_end',
    },
    refuse_end: {
      commands: [{ type: 'END_NIGHT_SLEEP' }],
      next: null,
    },
  },
};
