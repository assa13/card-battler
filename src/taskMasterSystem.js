import { generateItemOfRarity, RARITY_ORDER } from './itemSystem';

export const TASK_METRICS = {
  BATTLES_WON: 'battles_won',
  ENEMIES_KILLED: 'enemies_killed',
  CARDS_PLAYED: 'cards_played',
};

const QUEST_BLUEPRINTS = [
  {
    key: 'recover_lost_rite',
    title: 'Вернуть утраченный обряд',
    description: 'Выиграйте бои, чтобы скелет восстановил страницу из старого гримуара.',
    metric: TASK_METRICS.BATTLES_WON,
    baseTarget: 2,
    targetStep: 1,
    reward: { type: 'card', icon: '🃏', label: 'Новая карта герою' },
  },
  {
    key: 'bones_for_relic',
    title: 'Кости для реликвии',
    description: 'Уничтожьте врагов. Из оставшихся костей получится достойная вещь.',
    metric: TASK_METRICS.ENEMIES_KILLED,
    baseTarget: 6,
    targetStep: 2,
    reward: { type: 'item', icon: '🎁', label: 'Редкий предмет' },
  },
  {
    key: 'prove_your_hand',
    title: 'Докажите твёрдость руки',
    description: 'Разыграйте карты в бою. Скелет платит только тем, кто действует.',
    metric: TASK_METRICS.CARDS_PLAYED,
    baseTarget: 8,
    targetStep: 2,
    reward: { type: 'gold', icon: '🪙', label: 'Золото' },
  },
  {
    key: 'feed_the_embers',
    title: 'Накормить угли',
    description: 'Побеждайте в боях, чтобы разжечь погасшие огоньки душ.',
    metric: TASK_METRICS.BATTLES_WON,
    baseTarget: 4,
    targetStep: 1,
    reward: { type: 'embers', icon: '🔥', label: 'Огоньки души' },
  },
];

const POWERFUL_ITEM_RARITIES = RARITY_ORDER.slice(RARITY_ORDER.indexOf('MYTHIC'));

export const getTaskRewardItem = (reward, questId = 'legacy') => (
  reward?.item || {
    uid: `task_reward_${questId}`,
    name: 'Мифическая реликвия поручителя',
    icon: 'item_40.webp',
    rarity: 'MYTHIC',
    tinted: true,
    stats: { atk: 52, matk: 52, crit: 18, hp: 110 },
  }
);

const createQuestWave = (wave) => QUEST_BLUEPRINTS.map((blueprint) => {
  const reward = { ...blueprint.reward };
  if (reward.type === 'gold') reward.amount = 80 + wave * 30;
  if (reward.type === 'embers') reward.amount = 2 + wave;
  if (reward.type === 'item') {
    reward.rarity = POWERFUL_ITEM_RARITIES[Math.min(wave, POWERFUL_ITEM_RARITIES.length - 1)];
    reward.item = generateItemOfRarity(reward.rarity);
  }
  return {
    id: `${blueprint.key}_${wave}`,
    key: blueprint.key,
    title: blueprint.title,
    description: blueprint.description,
    metric: blueprint.metric,
    target: blueprint.baseTarget + blueprint.targetStep * wave,
    progress: 0,
    status: 'active',
    reward,
  };
});

export const createTaskMasterState = () => ({
  unlocked: false,
  wave: 0,
  quests: [],
});

export const unlockTaskMaster = (state) => {
  if (state.unlocked) return state;
  return {
    ...state,
    unlocked: true,
    quests: state.quests.length ? state.quests : createQuestWave(state.wave),
  };
};

// Новая волна появляется утром после следующей ночёвки, а не мгновенно после
// последней награды. Поэтому inactive-спрайт успевает обозначить: работы нет.
export const replenishTaskMasterQuests = (state) => {
  if (!state.unlocked || state.quests.length > 0) return state;
  return { ...state, quests: createQuestWave(state.wave) };
};

export const progressTaskQuests = (state, metric, amount = 1) => {
  if (!state.unlocked || !metric || amount <= 0) return state;
  let changed = false;
  const quests = state.quests.map((quest) => {
    // `available` поддерживается только как миграция уже созданных заданий:
    // теперь все поручения начинают выполняться автоматически.
    if (!['active', 'available'].includes(quest.status) || quest.metric !== metric) return quest;
    const progress = Math.min(quest.target, quest.progress + amount);
    if (progress === quest.progress) return quest;
    changed = true;
    return {
      ...quest,
      progress,
      status: progress >= quest.target ? 'completed' : 'active',
    };
  });
  return changed ? { ...state, quests } : state;
};

export const claimTaskQuest = (state, questId) => {
  const quests = state.quests.map((quest) => (
    quest.id === questId && quest.status === 'completed'
      ? { ...quest, status: 'claimed' }
      : quest
  ));
  if (!quests.every((quest) => quest.status === 'claimed')) {
    return { ...state, quests };
  }
  return { ...state, wave: state.wave + 1, quests: [] };
};

export const taskMasterHasRewards = (state) =>
  state.unlocked && state.quests.some((quest) => quest.status === 'completed');

export const taskMasterHasTasks = (state) =>
  state.unlocked && state.quests.some((quest) => quest.status !== 'claimed');

