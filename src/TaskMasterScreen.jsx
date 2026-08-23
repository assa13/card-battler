import { useState } from 'react';
import AtlasSprite from './AtlasSprite';
import { getItemIconUrl, ITEM_RARITIES } from './itemSystem';
import { getTaskRewardItem } from './taskMasterSystem';
import { CARD_RARITY_GLOW } from './cardRarity';

const FIGMA_ASSETS = {
  skull: './assets/ui/task-master/icon-1.svg',
  play: './assets/ui/task-master/icon-2.svg',
  shadow: './assets/ui/task-master/icon-4.svg',
};

const ACTIVE_SPRITE = {
  url: './assets/tavern/task_master.webp',
  cols: 4,
  rows: 4,
  frameCount: 16,
  fps: 4,
};

const INACTIVE_SPRITE = {
  ...ACTIVE_SPRITE,
  url: './assets/tavern/task_master_inactive.webp',
};

const objectiveText = (quest) => {
  switch (quest.key) {
    case 'recover_lost_rite':
      return `Победить в ${quest.target} боях ради утраченного обряда`;
    case 'bones_for_relic':
      return `Победить ${quest.target} врагов для костяной реликвии`;
    case 'prove_your_hand':
      return `Разыграть ${quest.target} карт в бою`;
    case 'feed_the_embers':
      return `Одержать ${quest.target} победы для огоньков душ`;
    default:
      return quest.title;
  }
};

const rewardText = (reward) => {
  if (reward.type === 'gold') return `+${reward.amount}`;
  if (reward.type === 'embers') return `+${reward.amount}`;
  if (reward.type === 'item') return 'ПРЕДМЕТ';
  return 'КАРТА';
};

const MagicCardReward = ({ reward }) => {
  const card = reward.card || null;
  const glow = CARD_RARITY_GLOW[card?.rarity] || '#9333ea';
  return (
    <div
      className="group relative flex h-[88px] w-[88px] shrink-0 flex-col items-center justify-center rounded-[14px] border-2 bg-slate-800"
      style={{
        borderColor: glow,
        boxShadow: `inset 0 0 14px ${glow}55`,
      }}
    >
      <span className="absolute -top-[7px] left-1/2 z-10 -translate-x-1/2 rounded-full bg-amber-500 px-[7px] py-[2px] text-[9px] font-black leading-none text-black">
        НОВАЯ
      </span>
      <span className="text-[40px] font-black leading-none text-white drop-shadow-lg">
        {card ? String(card.icon) : '?'}
      </span>
      <span className="mt-[3px] text-[11px] font-black leading-none" style={{ color: glow }}>
        МАГИЯ
      </span>
      <div className="pointer-events-none absolute bottom-[calc(100%+12px)] left-1/2 z-50 w-[250px] -translate-x-1/2 rounded-[10px] border-2 border-[#80622f] bg-[#100d0b] p-[12px] text-left opacity-0 shadow-2xl transition-opacity group-hover:opacity-100">
        <p className="text-[18px] font-black leading-tight text-[#f0d4a1]">
          {card?.name || 'Случайная карта магии'}
        </p>
        <p className="mt-[5px] text-[13px] leading-[17px] text-[#a8937e]">
          {card?.description || 'Конкретная карта откроется при получении награды.'}
        </p>
      </div>
    </div>
  );
};

const ItemReward = ({ reward, questId, onHover, onLeave }) => {
  const item = getTaskRewardItem(reward, questId);
  const rarity = ITEM_RARITIES[item.rarity] || ITEM_RARITIES.MYTHIC;
  return (
    <div
      className="relative flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-[14px] border-2 bg-slate-900 shadow-[0_6px_7px_rgba(0,0,0,0.4)]"
      style={{
        borderColor: rarity.color,
        boxShadow: `inset 0 0 14px ${rarity.color}55, 0 6px 7px rgba(0,0,0,0.4)`,
      }}
      onMouseEnter={(event) => onHover(item, event)}
      onMouseMove={(event) => onHover(item, event)}
      onMouseLeave={onLeave}
    >
      <img
        src={getItemIconUrl(item.icon)}
        alt={item.name}
        draggable={false}
        className="block h-[62px] w-[62px] max-w-none object-contain"
        style={{
          imageRendering: 'pixelated',
          filter: item.tinted ? `sepia(0.35) saturate(1.8) drop-shadow(0 0 8px ${rarity.color})` : undefined,
        }}
      />
      <span className="absolute bottom-[4px] left-1/2 -translate-x-1/2 whitespace-nowrap text-[12px] font-black leading-none" style={{ color: rarity.color }}>
        {rarity.name.toUpperCase()}
      </span>
    </div>
  );
};

const RewardCard = ({ reward, questId, onItemHover, onItemLeave }) => {
  if (reward.type === 'card') return <MagicCardReward reward={reward} />;
  if (reward.type === 'item') {
    return (
      <ItemReward
        reward={reward}
        questId={questId}
        onHover={onItemHover}
        onLeave={onItemLeave}
      />
    );
  }

  const isGold = reward.type === 'gold';
  const isEmbers = reward.type === 'embers';
  return (
    <div className="relative flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-[14px] border-[1.2px] border-[rgba(212,163,89,0.4)] bg-gradient-to-r from-[#231e19] to-[#191014] shadow-[0_6px_7px_rgba(0,0,0,0.4)]">
      <span className="text-[42px] leading-none">{isGold ? '🪙' : '🔥'}</span>
      <span className={`absolute bottom-[5px] left-1/2 -translate-x-1/2 whitespace-nowrap text-[18px] font-black leading-none ${
        isEmbers ? 'text-sky-300' : 'text-[#f1b82d]'
      }`}>
        {rewardText(reward)}
      </span>
    </div>
  );
};

const QuestStatus = ({ quest, onClaim }) => {
  if (quest.status === 'completed') {
    return (
      <button
        type="button"
        onClick={() => onClaim(quest.id)}
        className="relative flex h-[68px] w-[168px] items-center justify-center rounded-[16px] bg-[#468a18] text-[25px] font-black text-white shadow-[0_10px_12px_rgba(0,0,0,0.4),inset_0_0_14px_rgba(255,255,255,0.2)] hover:brightness-125 active:scale-95"
      >
        СОБРАТЬ
      </button>
    );
  }

  if (quest.status === 'claimed') {
    return (
      <div className="flex h-[68px] w-[168px] items-center justify-center rounded-[16px] bg-[#26201b] text-[20px] font-black text-[#6f6258]">
        СОБРАНО
      </div>
    );
  }

  return (
    <div
      title="Задание выполняется"
      className="flex h-[68px] w-[168px] items-center justify-center rounded-[16px] bg-[#6b2c00]"
    >
      <img
        src={FIGMA_ASSETS.play}
        alt=""
        draggable={false}
        className="block h-[36px] w-[36px] max-w-none"
      />
    </div>
  );
};

const QuestRow = ({ quest, onClaim, onItemHover, onItemLeave }) => {
  const progress = Math.min(100, Math.round((quest.progress / quest.target) * 100));
  const isCompleted = quest.status === 'completed';

  return (
    <article
      className={`flex h-[142px] w-full shrink-0 items-center gap-[20px] rounded-[12px] border-4 bg-[#1e1814] px-[20px] py-[20px] ${
        isCompleted
          ? 'border-[rgba(78,184,7,0.8)]'
          : 'border-[#412f1f]'
      }`}
    >
      <div className="flex h-[96px] w-[96px] shrink-0 items-center justify-center rounded-full border-4 border-[#d4a359] bg-[#161311]">
        <img
          src={FIGMA_ASSETS.skull}
          alt=""
          draggable={false}
          className="block h-[58px] w-[58px] max-w-none"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col items-start gap-[6px]">
        <p
          className={`w-full overflow-hidden text-[26px] leading-[29px] text-white ${
          isCompleted ? 'font-black' : 'font-medium'
          }`}
          style={{
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
          }}
        >
          {objectiveText(quest)}
        </p>
        <div className="relative flex h-[28px] w-full shrink-0 items-center overflow-hidden rounded-[5px] border-2 border-[#424242] bg-[#1e1a17]">
          <div
            className={`h-full transition-all duration-500 ${isCompleted ? 'bg-[#468a18]' : 'bg-[#f1b82d]'}`}
            style={{ width: `${progress}%` }}
          />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[21px] font-black leading-none text-[#e8dcd0]">
            {String(quest.progress)}/{String(quest.target)}
          </span>
        </div>
      </div>

      <div className="flex h-full w-[96px] shrink-0 items-center justify-center">
        <RewardCard
          reward={quest.reward}
          questId={quest.id}
          onItemHover={onItemHover}
          onItemLeave={onItemLeave}
        />
      </div>

      <div className="flex h-full w-[180px] shrink-0 items-center justify-center">
        <QuestStatus quest={quest} onClaim={onClaim} />
      </div>
    </article>
  );
};

export default function TaskMasterScreen({
  state,
  isActive,
  onClaim,
  onClose,
  renderItemTooltip,
}) {
  const sprite = isActive ? ACTIVE_SPRITE : INACTIVE_SPRITE;
  const [hoveredItem, setHoveredItem] = useState(null);
  const showItemTooltip = (item, event) => {
    setHoveredItem({ item, x: event.clientX, y: event.clientY });
  };

  return (
    <div
      className="fixed inset-0 z-[9460] bg-black"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <img
        src={FIGMA_ASSETS.shadow}
        alt=""
        draggable={false}
        className="pointer-events-none absolute left-[7.8%] top-[71.5%] block h-[140.811px] w-[566.948px] max-w-none"
      />
      <div className="pointer-events-none absolute left-[4.375%] top-[17.111%] h-[65.778%] aspect-square">
        <div
          className="absolute inset-0"
          style={{ animation: 'taskMasterFocus 480ms cubic-bezier(0.16, 1, 0.3, 1) both' }}
        >
          <AtlasSprite sprite={sprite} alt="Скелет-поручитель" />
        </div>
      </div>

      <section
        className="absolute left-[46.53125%] top-[4.44444%] z-10 flex h-[91.11111%] w-[50.96875%] flex-col items-start gap-[36px] rounded-[28px] border-[10px] border-[#d4a359] bg-[#0b0a09] p-[56px] text-[#e8dcd0] shadow-[15px_20px_20px_rgba(0,0,0,0.9)]"
        style={{ fontFamily: "'Greybeard', 'Geist Mono', monospace" }}
      >
        <header className="flex w-full shrink-0 flex-col items-start gap-[20px]">
          <div className="flex w-full items-center justify-between">
            <h1 className="whitespace-nowrap text-[76px] font-black leading-none text-[#f1b82d]">
              ЗАДАНИЯ
            </h1>
            <button
              type="button"
              onClick={onClose}
              className="text-[48px] leading-none text-[#8c7a70] hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="h-[8px] w-full shrink-0 rounded-[4px] bg-[#d4a359]" />
        </header>

        <div className="flex min-h-0 w-full flex-1 flex-col items-start gap-[16px] overflow-visible">
          {state.quests.length > 0 ? (
            state.quests.map((quest) => (
              <QuestRow
                key={quest.id}
                quest={quest}
                onClaim={onClaim}
                onItemHover={showItemTooltip}
                onItemLeave={() => setHoveredItem(null)}
              />
            ))
          ) : (
            <div className="flex h-[142px] w-full items-center gap-[20px] rounded-[12px] border-4 border-[#412f1f] bg-[#1e1814] px-[20px]">
              <div className="flex h-[96px] w-[96px] shrink-0 items-center justify-center rounded-full border-4 border-[#d4a359] bg-[#161311] opacity-50">
                <img src={FIGMA_ASSETS.skull} alt="" className="h-[58px] w-[58px] max-w-none" />
              </div>
              <div>
                <h2 className="text-[34px] font-black leading-[38px] text-[#9c8873]">Книга пуста</h2>
                <p className="mt-2 text-[22px] leading-normal text-[#685c53]">
                Все долги закрыты. После следующей ночёвки скелет подготовит новый круг поручений.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
      {hoveredItem && renderItemTooltip?.(hoveredItem)}

      <style>{`
        @keyframes taskMasterFocus {
          from { opacity: 0; transform: scale(0.82) translateY(8%); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

