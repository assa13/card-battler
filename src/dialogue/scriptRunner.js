// Ядро системы ветвящихся диалогов (Yarn-like).
//
// Идея заимствована у Yarn Spinner / Ink: история — граф УЗЛОВ. Узел =
// реплики одного спикера + (опционально) ВЫБОРЫ игрока и КОМАНДЫ-триггеры.
// Скрипт — чистые данные (JS-объект), никакого кода: его может писать
// нарративный агент, не зная React. Формат и правила адаптации историй —
// docs/dialogue-authoring.md.
//
// Схема скрипта:
// {
//   id: 'night_wanderer',
//   speakers: {
//     stranger: { anchorEntityId: 'door_night', name: 'Голос за дверью' },
//     barkeep:  { anchorEntityId: 'npc_bartender', name: 'Бармен' },
//   },
//   start: 'intro',
//   nodes: {
//     intro: {
//       speaker: 'stranger',
//       lines: ['Реплика 1', 'Реплика 2'],   // печатаются последовательно
//       commands: [{ type: 'SET_FLAG', flag: 'met' }], // при входе в узел
//       choices: [                             // после последней реплики
//         { text: 'Открыть', next: 'open', condition: { notFlag: 'scared' } },
//         { text: 'Уйти', next: 'leave', commands: [...] },
//       ],
//       next: 'other',  // если choices нет; null/отсутствует = конец
//     },
//   },
// }
//
// Состояние прогона (flags/vars) живёт ТОЛЬКО внутри одного прогона скрипта.
// Долгоживущие последствия — через внешние команды (их исполняет экран/App).

// Внутренние команды (мутируют состояние прогона, наружу не уходят).
const INTERNAL_COMMANDS = new Set(['SET_FLAG', 'CLEAR_FLAG', 'SET_VAR', 'ADD_VAR']);

export const createRunState = () => ({ flags: {}, vars: {} });

// Декларативные условия: { flag }, { notFlag }, { var, gte|lte|eq }.
// Отсутствие условия = всегда истинно. Неизвестная форма = истинно (fail-open,
// чтобы опечатка в скрипте не запирала диалог).
export const evalCondition = (cond, state) => {
  if (!cond) return true;
  if (cond.flag != null) return !!state.flags[cond.flag];
  if (cond.notFlag != null) return !state.flags[cond.notFlag];
  if (cond.var != null) {
    const v = state.vars[cond.var] ?? 0;
    if (cond.gte != null) return v >= cond.gte;
    if (cond.lte != null) return v <= cond.lte;
    if (cond.eq != null) return v === cond.eq;
  }
  return true;
};

// Выполняет список команд: внутренние применяет к state, внешние отдаёт
// в onExternal (диспетчер экрана: награды, тосты, завершение ночи и т.п.).
export const runCommands = (commands, state, onExternal) => {
  for (const cmd of commands ?? []) {
    if (!cmd?.type) continue;
    if (INTERNAL_COMMANDS.has(cmd.type)) {
      switch (cmd.type) {
        case 'SET_FLAG': state.flags[cmd.flag] = cmd.value ?? true; break;
        case 'CLEAR_FLAG': delete state.flags[cmd.flag]; break;
        case 'SET_VAR': state.vars[cmd.var] = cmd.value ?? 0; break;
        case 'ADD_VAR': state.vars[cmd.var] = (state.vars[cmd.var] ?? 0) + (cmd.amount ?? 1); break;
        default: break;
      }
    } else {
      onExternal?.(cmd);
    }
  }
};

// Видимые игроку выборы узла (с учётом условий).
export const getVisibleChoices = (node, state) =>
  (node?.choices ?? []).filter(c => evalCondition(c.condition, state));

// Взвешенный выбор скрипта из реестра [{ script, weight }].
export const pickWeightedScript = (registry) => {
  if (!registry?.length) return null;
  const total = registry.reduce((s, e) => s + (e.weight ?? 1), 0);
  let roll = Math.random() * total;
  for (const entry of registry) {
    roll -= entry.weight ?? 1;
    if (roll <= 0) return entry.script;
  }
  return registry[registry.length - 1].script;
};
